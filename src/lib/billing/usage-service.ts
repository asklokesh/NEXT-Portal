import { PrismaClient } from '@prisma/client';
import { stripe, stripeHelpers, USAGE_BASED_PRODUCTS } from './stripe-client';
import type { ResourceUsage, ResourceType, Organization } from '@prisma/client';
import type Stripe from 'stripe';

const prisma = new PrismaClient();

interface UsageRecord {
  organizationId: string;
  resourceType: ResourceType;
  quantity: number;
  metadata?: Record<string, any>;
  timestamp?: Date;
}

interface UsageMetrics {
  totalUsage: number;
  costThisPeriod: number;
  projectedCost: number;
  breakdown: {
    resourceType: ResourceType;
    quantity: number;
    cost: number;
    unit: string;
  }[];
  alerts: {
    type: 'approaching_limit' | 'over_limit' | 'cost_alert';
    message: string;
    threshold: number;
    current: number;
  }[];
}

interface UsageTier {
  minUnits: number;
  maxUnits: number | null;
  pricePerUnit: number;
  flatFee: number;
}

export class UsageService {
  /**
   * Record usage for an organization
   */
  async recordUsage(usage: UsageRecord): Promise<ResourceUsage> {
    try {
      // Get organization
      const organization = await prisma.organization.findUnique({
        where: { id: usage.organizationId },
        include: {
          subscriptions: {
            where: { status: { in: ['ACTIVE', 'TRIALING'] } },
            include: { plan: { include: { usageTiers: true } } }
          }
        }
      });

      if (!organization) {
        throw new Error('Organization not found');
      }

      // Calculate cost based on usage tiers
      const cost = await this.calculateUsageCost(
        usage.resourceType,
        usage.quantity,
        organization
      );

      // Get current period start (beginning of month)
      const periodStart = new Date();
      periodStart.setDate(1);
      periodStart.setHours(0, 0, 0, 0);

      // Create usage record
      const usageRecord = await prisma.resourceUsage.create({
        data: {
          organizationId: usage.organizationId,
          subscriptionId: organization.subscriptions[0]?.id,
          resourceType: usage.resourceType,
          quantity: usage.quantity,
          unit: this.getResourceUnit(usage.resourceType),
          cost: cost,
          period: usage.timestamp || new Date(),
          metadata: usage.metadata
        }
      });

      // Report usage to Stripe if needed for billing
      if (organization.stripeCustomerId && organization.subscriptions[0]?.stripeSubscriptionId) {
        await this.reportUsageToStripe(
          organization.subscriptions[0].stripeSubscriptionId,
          usage.resourceType,
          usage.quantity,
          usage.timestamp
        );
      }

      // Check for usage alerts
      await this.checkUsageAlerts(organization.id, usage.resourceType);

      return usageRecord;
    } catch (error) {
      throw new Error(`Failed to record usage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Record batch usage for efficiency
   */
  async recordBatchUsage(usageRecords: UsageRecord[]): Promise<ResourceUsage[]> {
    try {
      const results = await Promise.all(
        usageRecords.map(usage => this.recordUsage(usage))
      );
      return results;
    } catch (error) {
      throw new Error(`Failed to record batch usage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get usage metrics for an organization
   */
  async getUsageMetrics(
    organizationId: string,
    period?: { start: Date; end: Date }
  ): Promise<UsageMetrics> {
    try {
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        include: {
          subscriptions: {
            where: { status: { in: ['ACTIVE', 'TRIALING'] } },
            include: { plan: { include: { usageTiers: true } } }
          },
          budgets: {
            where: { isActive: true }
          }
        }
      });

      if (!organization) {
        throw new Error('Organization not found');
      }

      // Default to current month if no period specified
      const defaultPeriod = {
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
      };
      
      const queryPeriod = period || defaultPeriod;

      // Get usage records for the period
      const usageRecords = await prisma.resourceUsage.findMany({
        where: {
          organizationId,
          period: {
            gte: queryPeriod.start,
            lte: queryPeriod.end
          }
        },
        orderBy: { period: 'desc' }
      });

      // Aggregate usage by resource type
      const usageByType = usageRecords.reduce((acc, record) => {
        const existing = acc.find(item => item.resourceType === record.resourceType);
        if (existing) {
          existing.quantity = parseFloat((parseFloat(existing.quantity.toString()) + parseFloat(record.quantity.toString())).toFixed(4));
          existing.cost = parseFloat((parseFloat(existing.cost.toString()) + parseFloat(record.cost.toString())).toFixed(2));
        } else {
          acc.push({
            resourceType: record.resourceType,
            quantity: parseFloat(record.quantity.toString()),
            cost: parseFloat(record.cost.toString()),
            unit: record.unit
          });
        }
        return acc;
      }, [] as { resourceType: ResourceType; quantity: number; cost: number; unit: string }[]);

      const totalUsage = usageByType.reduce((sum, item) => sum + item.quantity, 0);
      const costThisPeriod = usageByType.reduce((sum, item) => sum + item.cost, 0);

      // Project cost for full month if we're mid-month
      const daysInMonth = new Date(queryPeriod.end.getFullYear(), queryPeriod.end.getMonth() + 1, 0).getDate();
      const daysPassed = Math.min(new Date().getDate(), daysInMonth);
      const projectedCost = period ? costThisPeriod : (costThisPeriod / daysPassed) * daysInMonth;

      // Generate alerts
      const alerts = await this.generateUsageAlerts(organization, usageByType, projectedCost);

      return {
        totalUsage,
        costThisPeriod,
        projectedCost,
        breakdown: usageByType,
        alerts
      };
    } catch (error) {
      throw new Error(`Failed to get usage metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate cost for usage based on tiers
   */
  private async calculateUsageCost(
    resourceType: ResourceType,
    quantity: number,
    organization: Organization & {
      subscriptions: Array<{
        plan: {
          usageTiers: Array<{
            resourceType: ResourceType;
            minUnits: number;
            maxUnits: number | null;
            pricePerUnit: number;
            flatFee: number;
          }>;
        };
      }>;
    }
  ): Promise<number> {
    // Get usage tiers for this resource type from the subscription plan
    const usageTiers = organization.subscriptions[0]?.plan.usageTiers
      .filter(tier => tier.resourceType === resourceType)
      .sort((a, b) => a.minUnits - b.minUnits) || [];

    // If no tiers defined, use default pricing
    if (usageTiers.length === 0) {
      const defaultPricing = this.getDefaultPricing(resourceType);
      return this.calculateTieredCost(quantity, defaultPricing);
    }

    // Convert database format to calculation format
    const tiers: UsageTier[] = usageTiers.map(tier => ({
      minUnits: tier.minUnits,
      maxUnits: tier.maxUnits,
      pricePerUnit: parseFloat(tier.pricePerUnit.toString()),
      flatFee: parseFloat(tier.flatFee.toString())
    }));

    return this.calculateTieredCost(quantity, tiers);
  }

  /**
   * Calculate tiered pricing cost
   */
  private calculateTieredCost(quantity: number, tiers: UsageTier[]): number {
    let totalCost = 0;
    let remainingQuantity = quantity;

    for (const tier of tiers) {
      if (remainingQuantity <= 0) break;

      const tierCapacity = tier.maxUnits ? tier.maxUnits - tier.minUnits : Infinity;
      const quantityInTier = Math.min(remainingQuantity, tierCapacity);
      
      if (quantity >= tier.minUnits) {
        totalCost += tier.flatFee;
        totalCost += quantityInTier * tier.pricePerUnit;
        remainingQuantity -= quantityInTier;
      }
    }

    return totalCost;
  }

  /**
   * Get default pricing for resource types
   */
  private getDefaultPricing(resourceType: ResourceType): UsageTier[] {
    const defaultPricing: Record<ResourceType, UsageTier[]> = {
      API_CALLS: [
        { minUnits: 0, maxUnits: 10000, pricePerUnit: 0, flatFee: 0 },
        { minUnits: 10000, maxUnits: 100000, pricePerUnit: 0.0001, flatFee: 0 },
        { minUnits: 100000, maxUnits: null, pricePerUnit: 0.00005, flatFee: 0 }
      ],
      STORAGE_GB: [
        { minUnits: 0, maxUnits: 100, pricePerUnit: 0, flatFee: 0 },
        { minUnits: 100, maxUnits: 1000, pricePerUnit: 0.5, flatFee: 0 },
        { minUnits: 1000, maxUnits: null, pricePerUnit: 0.3, flatFee: 0 }
      ],
      NETWORK_GB: [
        { minUnits: 0, maxUnits: 100, pricePerUnit: 0, flatFee: 0 },
        { minUnits: 100, maxUnits: 1000, pricePerUnit: 0.1, flatFee: 0 },
        { minUnits: 1000, maxUnits: null, pricePerUnit: 0.05, flatFee: 0 }
      ],
      COMPUTE_HOURS: [
        { minUnits: 0, maxUnits: 100, pricePerUnit: 0, flatFee: 0 },
        { minUnits: 100, maxUnits: 1000, pricePerUnit: 5.0, flatFee: 0 },
        { minUnits: 1000, maxUnits: null, pricePerUnit: 3.0, flatFee: 0 }
      ],
      CONTAINERS: [
        { minUnits: 0, maxUnits: 10, pricePerUnit: 0, flatFee: 0 },
        { minUnits: 10, maxUnits: 100, pricePerUnit: 10.0, flatFee: 0 },
        { minUnits: 100, maxUnits: null, pricePerUnit: 8.0, flatFee: 0 }
      ],
      USERS: [
        { minUnits: 0, maxUnits: 50, pricePerUnit: 0, flatFee: 0 },
        { minUnits: 50, maxUnits: 500, pricePerUnit: 25.0, flatFee: 0 },
        { minUnits: 500, maxUnits: null, pricePerUnit: 20.0, flatFee: 0 }
      ],
      PLUGINS: [
        { minUnits: 0, maxUnits: 50, pricePerUnit: 0, flatFee: 0 },
        { minUnits: 50, maxUnits: 200, pricePerUnit: 2.0, flatFee: 0 },
        { minUnits: 200, maxUnits: null, pricePerUnit: 1.0, flatFee: 0 }
      ],
      DEPLOYMENTS: [
        { minUnits: 0, maxUnits: 100, pricePerUnit: 0, flatFee: 0 },
        { minUnits: 100, maxUnits: 1000, pricePerUnit: 0.5, flatFee: 0 },
        { minUnits: 1000, maxUnits: null, pricePerUnit: 0.25, flatFee: 0 }
      ],
      BUILDS: [
        { minUnits: 0, maxUnits: 1000, pricePerUnit: 0, flatFee: 0 },
        { minUnits: 1000, maxUnits: 10000, pricePerUnit: 0.1, flatFee: 0 },
        { minUnits: 10000, maxUnits: null, pricePerUnit: 0.05, flatFee: 0 }
      ],
      CUSTOM: [
        { minUnits: 0, maxUnits: null, pricePerUnit: 0, flatFee: 0 }
      ]
    };

    return defaultPricing[resourceType] || defaultPricing.CUSTOM;
  }

  /**
   * Get resource unit for display
   */
  private getResourceUnit(resourceType: ResourceType): string {
    const units: Record<ResourceType, string> = {
      API_CALLS: 'calls',
      STORAGE_GB: 'GB',
      NETWORK_GB: 'GB',
      COMPUTE_HOURS: 'hours',
      CONTAINERS: 'containers',
      USERS: 'users',
      PLUGINS: 'plugins',
      DEPLOYMENTS: 'deployments',
      BUILDS: 'builds',
      CUSTOM: 'units'
    };

    return units[resourceType] || 'units';
  }

  /**
   * Report usage to Stripe for billing
   */
  private async reportUsageToStripe(
    subscriptionId: string,
    resourceType: ResourceType,
    quantity: number,
    timestamp?: Date
  ): Promise<void> {
    try {
      // Get subscription items from Stripe
      const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['items.data.price.product']
      });

      // Find usage-based subscription item for this resource type
      const usageItem = subscription.items.data.find(item => {
        const product = item.price.product as Stripe.Product;
        return product.metadata?.resourceType === resourceType;
      });

      if (!usageItem) {
        // No usage-based billing for this resource type
        return;
      }

      // Create usage record in Stripe
      await stripe.subscriptionItems.createUsageRecord(
        usageItem.id,
        {
          quantity: Math.ceil(quantity), // Stripe requires integer quantities
          timestamp: timestamp ? Math.floor(timestamp.getTime() / 1000) : undefined,
          action: 'increment'
        },
        {
          idempotencyKey: stripeHelpers.generateIdempotencyKey(
            `usage_${subscriptionId}_${resourceType}_${timestamp?.getTime() || Date.now()}`
          )
        }
      );
    } catch (error) {
      console.error('Error reporting usage to Stripe:', error);
      // Don't throw error as this shouldn't block the main usage recording
    }
  }

  /**
   * Check for usage alerts and create them if needed
   */
  private async checkUsageAlerts(
    organizationId: string,
    resourceType: ResourceType
  ): Promise<void> {
    try {
      const metrics = await this.getUsageMetrics(organizationId);
      const alerts = metrics.alerts;

      // Create billing alerts for critical issues
      for (const alert of alerts) {
        if (alert.type === 'over_limit' || alert.type === 'cost_alert') {
          await prisma.billingAlert.create({
            data: {
              organizationId,
              type: alert.type === 'over_limit' ? 'BUDGET_EXCEEDED' : 'UNUSUAL_USAGE',
              threshold: alert.threshold,
              currentValue: alert.current,
              message: alert.message,
              severity: alert.type === 'over_limit' ? 'CRITICAL' : 'WARNING'
            }
          });
        }
      }
    } catch (error) {
      console.error('Error checking usage alerts:', error);
    }
  }

  /**
   * Generate usage alerts based on current metrics
   */
  private async generateUsageAlerts(
    organization: Organization & {
      budgets: Array<{
        id: string;
        name: string;
        amount: number;
        resourceType: ResourceType | null;
        alertThreshold: number;
      }>;
    },
    usageByType: Array<{
      resourceType: ResourceType;
      quantity: number;
      cost: number;
      unit: string;
    }>,
    projectedCost: number
  ): Promise<Array<{
    type: 'approaching_limit' | 'over_limit' | 'cost_alert';
    message: string;
    threshold: number;
    current: number;
  }>> {
    const alerts: Array<{
      type: 'approaching_limit' | 'over_limit' | 'cost_alert';
      message: string;
      threshold: number;
      current: number;
    }> = [];

    // Check budget alerts
    for (const budget of organization.budgets) {
      const budgetAmount = parseFloat(budget.amount.toString());
      const alertThreshold = parseFloat(budget.alertThreshold.toString());
      const thresholdAmount = budgetAmount * (alertThreshold / 100);

      if (budget.resourceType) {
        // Resource-specific budget
        const resourceUsage = usageByType.find(u => u.resourceType === budget.resourceType);
        if (resourceUsage) {
          if (resourceUsage.cost >= budgetAmount) {
            alerts.push({
              type: 'over_limit',
              message: `${budget.name}: Over budget limit for ${resourceUsage.resourceType}`,
              threshold: budgetAmount,
              current: resourceUsage.cost
            });
          } else if (resourceUsage.cost >= thresholdAmount) {
            alerts.push({
              type: 'approaching_limit',
              message: `${budget.name}: Approaching budget limit for ${resourceUsage.resourceType}`,
              threshold: thresholdAmount,
              current: resourceUsage.cost
            });
          }
        }
      } else {
        // Overall budget
        if (projectedCost >= budgetAmount) {
          alerts.push({
            type: 'over_limit',
            message: `${budget.name}: Projected cost exceeds budget`,
            threshold: budgetAmount,
            current: projectedCost
          });
        } else if (projectedCost >= thresholdAmount) {
          alerts.push({
            type: 'approaching_limit',
            message: `${budget.name}: Projected cost approaching budget limit`,
            threshold: thresholdAmount,
            current: projectedCost
          });
        }
      }
    }

    // Check for unusual usage patterns
    const totalCost = usageByType.reduce((sum, item) => sum + item.cost, 0);
    if (totalCost > 0) {
      // Get historical average for comparison
      const lastMonthStart = new Date();
      lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
      lastMonthStart.setDate(1);
      lastMonthStart.setHours(0, 0, 0, 0);
      
      const lastMonthEnd = new Date(lastMonthStart);
      lastMonthEnd.setMonth(lastMonthEnd.getMonth() + 1);
      lastMonthEnd.setDate(0);
      lastMonthEnd.setHours(23, 59, 59, 999);

      const historicalUsage = await prisma.resourceUsage.findMany({
        where: {
          organizationId: organization.id,
          period: {
            gte: lastMonthStart,
            lte: lastMonthEnd
          }
        }
      });

      const historicalCost = historicalUsage.reduce(
        (sum, record) => sum + parseFloat(record.cost.toString()), 
        0
      );

      // Alert if current cost is 50% higher than historical average
      if (historicalCost > 0 && totalCost > historicalCost * 1.5) {
        alerts.push({
          type: 'cost_alert',
          message: 'Unusual usage detected - costs are significantly higher than normal',
          threshold: historicalCost * 1.5,
          current: totalCost
        });
      }
    }

    return alerts;
  }

  /**
   * Get usage trends over time
   */
  async getUsageTrends(
    organizationId: string,
    resourceType?: ResourceType,
    days: number = 30
  ): Promise<Array<{
    date: Date;
    quantity: number;
    cost: number;
  }>> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      const whereClause: any = {
        organizationId,
        period: {
          gte: startDate
        }
      };

      if (resourceType) {
        whereClause.resourceType = resourceType;
      }

      const usageRecords = await prisma.resourceUsage.findMany({
        where: whereClause,
        orderBy: { period: 'asc' }
      });

      // Group by date
      const groupedUsage = usageRecords.reduce((acc, record) => {
        const dateKey = record.period.toISOString().split('T')[0];
        
        if (!acc[dateKey]) {
          acc[dateKey] = {
            date: new Date(record.period.getFullYear(), record.period.getMonth(), record.period.getDate()),
            quantity: 0,
            cost: 0
          };
        }
        
        acc[dateKey].quantity += parseFloat(record.quantity.toString());
        acc[dateKey].cost += parseFloat(record.cost.toString());
        
        return acc;
      }, {} as Record<string, { date: Date; quantity: number; cost: number }>);

      return Object.values(groupedUsage).sort((a, b) => a.date.getTime() - b.date.getTime());
    } catch (error) {
      throw new Error(`Failed to get usage trends: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Export usage data for reporting
   */
  async exportUsageData(
    organizationId: string,
    period: { start: Date; end: Date },
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    try {
      const usageRecords = await prisma.resourceUsage.findMany({
        where: {
          organizationId,
          period: {
            gte: period.start,
            lte: period.end
          }
        },
        orderBy: { period: 'desc' }
      });

      if (format === 'csv') {
        const csvHeader = 'Date,Resource Type,Quantity,Unit,Cost,Metadata\n';
        const csvData = usageRecords.map(record => 
          `${record.period.toISOString()},${record.resourceType},${record.quantity},${record.unit},${record.cost},"${JSON.stringify(record.metadata || {})}"`
        ).join('\n');
        
        return csvHeader + csvData;
      }

      return JSON.stringify(usageRecords, null, 2);
    } catch (error) {
      throw new Error(`Failed to export usage data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const usageService = new UsageService();
