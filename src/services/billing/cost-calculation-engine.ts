import { PrismaClient, ResourceType, PlanTier, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

interface TierPrice {
  minUnits: number;
  maxUnits: number | null;
  pricePerUnit: number;
  flatFee: number;
}

interface ResourcePricing {
  resourceType: ResourceType;
  tiers: TierPrice[];
}

interface CostBreakdown {
  resourceType: ResourceType;
  quantity: number;
  unit: string;
  unitPrice: number;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

interface InvoiceCalculation {
  organizationId: string;
  period: { start: Date; end: Date };
  subscriptionFee: number;
  usageCharges: CostBreakdown[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  currency: string;
}

export class CostCalculationEngine {
  private prisma: PrismaClient;
  private taxRates: Map<string, number>;
  private exchangeRates: Map<string, number>;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.taxRates = new Map();
    this.exchangeRates = new Map([
      ['USD', 1.0],
      ['EUR', 0.85],
      ['GBP', 0.73],
      ['JPY', 110.0],
      ['AUD', 1.35],
      ['CAD', 1.25],
    ]);
  }

  /**
   * Calculate costs for a billing period
   */
  async calculateBillingPeriodCosts(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<InvoiceCalculation> {
    // Get organization and subscription details
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        subscriptions: {
          where: {
            status: { in: ['ACTIVE', 'PAST_DUE'] },
            currentPeriodStart: { lte: endDate },
            currentPeriodEnd: { gte: startDate },
          },
          include: {
            plan: {
              include: {
                usageTiers: true,
              }
            },
            discounts: {
              where: {
                OR: [
                  { expiresAt: null },
                  { expiresAt: { gte: new Date() } }
                ]
              },
              include: {
                coupon: true,
              }
            }
          }
        }
      }
    });

    if (!organization) {
      throw new Error(`Organization ${organizationId} not found`);
    }

    const subscription = organization.subscriptions[0];
    
    // Calculate subscription base fee
    const subscriptionFee = subscription ? 
      this.calculateSubscriptionFee(subscription, startDate, endDate) : 0;

    // Get resource usage for the period
    const usageRecords = await this.prisma.resourceUsage.findMany({
      where: {
        organizationId,
        period: {
          gte: startDate,
          lte: endDate,
        }
      }
    });

    // Calculate usage charges
    const usageCharges = await this.calculateUsageCharges(
      usageRecords,
      subscription?.plan,
      organization.currency
    );

    // Calculate subtotal
    const subtotal = subscriptionFee + 
      usageCharges.reduce((sum, charge) => sum + charge.subtotal, 0);

    // Apply discounts
    const discount = subscription ? 
      this.calculateDiscounts(subtotal, subscription.discounts) : 0;

    // Calculate tax
    const taxableAmount = subtotal - discount;
    const tax = await this.calculateTax(taxableAmount, organization.country, organization.billingAddress);

    // Calculate total
    const total = taxableAmount + tax;

    return {
      organizationId,
      period: { start: startDate, end: endDate },
      subscriptionFee,
      usageCharges,
      subtotal,
      discount,
      tax,
      total,
      currency: organization.currency,
    };
  }

  /**
   * Calculate subscription fee (prorated if needed)
   */
  private calculateSubscriptionFee(
    subscription: any,
    periodStart: Date,
    periodEnd: Date
  ): number {
    const plan = subscription.plan;
    let fee = 0;

    // Check if we need to prorate
    const subscriptionStart = new Date(subscription.currentPeriodStart);
    const subscriptionEnd = new Date(subscription.currentPeriodEnd);

    if (subscriptionStart <= periodStart && subscriptionEnd >= periodEnd) {
      // Full period covered
      if (subscription.plan.billingCycle === 'MONTHLY') {
        fee = parseFloat(plan.monthlyPrice);
      } else if (subscription.plan.billingCycle === 'ANNUAL') {
        fee = parseFloat(plan.annualPrice) / 12; // Monthly portion
      }
    } else {
      // Prorated period
      const totalDays = (subscriptionEnd.getTime() - subscriptionStart.getTime()) / (1000 * 60 * 60 * 24);
      const coveredDays = Math.min(
        (periodEnd.getTime() - Math.max(periodStart.getTime(), subscriptionStart.getTime())) / (1000 * 60 * 60 * 24),
        totalDays
      );
      const proration = coveredDays / totalDays;
      
      if (subscription.plan.billingCycle === 'MONTHLY') {
        fee = parseFloat(plan.monthlyPrice) * proration;
      } else if (subscription.plan.billingCycle === 'ANNUAL') {
        fee = (parseFloat(plan.annualPrice) / 12) * proration;
      }
    }

    return fee * subscription.quantity;
  }

  /**
   * Calculate usage-based charges
   */
  private async calculateUsageCharges(
    usageRecords: any[],
    plan: any,
    currency: string
  ): Promise<CostBreakdown[]> {
    const charges: CostBreakdown[] = [];
    const usageByType = new Map<ResourceType, { quantity: number; unit: string }>();

    // Aggregate usage by resource type
    for (const record of usageRecords) {
      const existing = usageByType.get(record.resourceType) || { quantity: 0, unit: record.unit };
      existing.quantity += parseFloat(record.quantity.toString());
      usageByType.set(record.resourceType, existing);
    }

    // Calculate charges for each resource type
    for (const [resourceType, usage] of usageByType) {
      const pricing = await this.getResourcePricing(resourceType, plan);
      const cost = this.calculateTieredPrice(usage.quantity, pricing);

      // Check for overage charges if plan has limits
      let overageCharge = 0;
      if (plan && plan.limits) {
        const limits = plan.limits as any;
        const overage = plan.overage as any;
        
        overageCharge = this.calculateOverageCharge(
          resourceType,
          usage.quantity,
          limits,
          overage
        );
      }

      const subtotal = cost + overageCharge;
      const tax = 0; // Tax calculated at invoice level
      const discount = 0; // Discount calculated at invoice level

      charges.push({
        resourceType,
        quantity: usage.quantity,
        unit: usage.unit,
        unitPrice: cost / usage.quantity,
        subtotal,
        discount,
        tax,
        total: subtotal,
      });
    }

    return charges;
  }

  /**
   * Get resource pricing configuration
   */
  private async getResourcePricing(
    resourceType: ResourceType,
    plan: any
  ): Promise<ResourcePricing> {
    // If plan has custom tiers, use those
    if (plan && plan.usageTiers && plan.usageTiers.length > 0) {
      const tiers = plan.usageTiers
        .filter((tier: any) => tier.resourceType === resourceType)
        .map((tier: any) => ({
          minUnits: tier.minUnits,
          maxUnits: tier.maxUnits,
          pricePerUnit: parseFloat(tier.pricePerUnit.toString()),
          flatFee: parseFloat(tier.flatFee.toString()),
        }));

      if (tiers.length > 0) {
        return { resourceType, tiers };
      }
    }

    // Default pricing tiers
    return this.getDefaultPricing(resourceType);
  }

  /**
   * Get default pricing for resource type
   */
  private getDefaultPricing(resourceType: ResourceType): ResourcePricing {
    const defaultTiers: Record<ResourceType, TierPrice[]> = {
      [ResourceType.COMPUTE_HOURS]: [
        { minUnits: 0, maxUnits: 100, pricePerUnit: 0.05, flatFee: 0 },
        { minUnits: 100, maxUnits: 1000, pricePerUnit: 0.04, flatFee: 0 },
        { minUnits: 1000, maxUnits: 10000, pricePerUnit: 0.03, flatFee: 0 },
        { minUnits: 10000, maxUnits: null, pricePerUnit: 0.02, flatFee: 0 },
      ],
      [ResourceType.STORAGE_GB]: [
        { minUnits: 0, maxUnits: 50, pricePerUnit: 0.10, flatFee: 0 },
        { minUnits: 50, maxUnits: 500, pricePerUnit: 0.08, flatFee: 0 },
        { minUnits: 500, maxUnits: 5000, pricePerUnit: 0.06, flatFee: 0 },
        { minUnits: 5000, maxUnits: null, pricePerUnit: 0.04, flatFee: 0 },
      ],
      [ResourceType.NETWORK_GB]: [
        { minUnits: 0, maxUnits: 100, pricePerUnit: 0.08, flatFee: 0 },
        { minUnits: 100, maxUnits: 1000, pricePerUnit: 0.06, flatFee: 0 },
        { minUnits: 1000, maxUnits: 10000, pricePerUnit: 0.04, flatFee: 0 },
        { minUnits: 10000, maxUnits: null, pricePerUnit: 0.02, flatFee: 0 },
      ],
      [ResourceType.API_CALLS]: [
        { minUnits: 0, maxUnits: 1000000, pricePerUnit: 0.000001, flatFee: 0 },
        { minUnits: 1000000, maxUnits: 10000000, pricePerUnit: 0.0000008, flatFee: 0 },
        { minUnits: 10000000, maxUnits: 100000000, pricePerUnit: 0.0000005, flatFee: 0 },
        { minUnits: 100000000, maxUnits: null, pricePerUnit: 0.0000003, flatFee: 0 },
      ],
      [ResourceType.CONTAINERS]: [
        { minUnits: 0, maxUnits: 5, pricePerUnit: 5.00, flatFee: 0 },
        { minUnits: 5, maxUnits: 25, pricePerUnit: 4.00, flatFee: 0 },
        { minUnits: 25, maxUnits: 100, pricePerUnit: 3.00, flatFee: 0 },
        { minUnits: 100, maxUnits: null, pricePerUnit: 2.00, flatFee: 0 },
      ],
      [ResourceType.USERS]: [
        { minUnits: 0, maxUnits: 10, pricePerUnit: 0, flatFee: 0 },
        { minUnits: 10, maxUnits: 50, pricePerUnit: 2.00, flatFee: 0 },
        { minUnits: 50, maxUnits: 200, pricePerUnit: 1.50, flatFee: 0 },
        { minUnits: 200, maxUnits: null, pricePerUnit: 1.00, flatFee: 0 },
      ],
      [ResourceType.PLUGINS]: [
        { minUnits: 0, maxUnits: 5, pricePerUnit: 0, flatFee: 0 },
        { minUnits: 5, maxUnits: 20, pricePerUnit: 10.00, flatFee: 0 },
        { minUnits: 20, maxUnits: 50, pricePerUnit: 8.00, flatFee: 0 },
        { minUnits: 50, maxUnits: null, pricePerUnit: 6.00, flatFee: 0 },
      ],
      [ResourceType.DEPLOYMENTS]: [
        { minUnits: 0, maxUnits: 100, pricePerUnit: 0.10, flatFee: 0 },
        { minUnits: 100, maxUnits: 500, pricePerUnit: 0.08, flatFee: 0 },
        { minUnits: 500, maxUnits: 2000, pricePerUnit: 0.06, flatFee: 0 },
        { minUnits: 2000, maxUnits: null, pricePerUnit: 0.04, flatFee: 0 },
      ],
      [ResourceType.BUILDS]: [
        { minUnits: 0, maxUnits: 100, pricePerUnit: 0.01, flatFee: 0 },
        { minUnits: 100, maxUnits: 1000, pricePerUnit: 0.008, flatFee: 0 },
        { minUnits: 1000, maxUnits: 5000, pricePerUnit: 0.006, flatFee: 0 },
        { minUnits: 5000, maxUnits: null, pricePerUnit: 0.004, flatFee: 0 },
      ],
      [ResourceType.CUSTOM]: [
        { minUnits: 0, maxUnits: null, pricePerUnit: 0.01, flatFee: 0 },
      ],
    };

    return {
      resourceType,
      tiers: defaultTiers[resourceType] || defaultTiers[ResourceType.CUSTOM],
    };
  }

  /**
   * Calculate tiered pricing
   */
  private calculateTieredPrice(quantity: number, pricing: ResourcePricing): number {
    let totalCost = 0;
    let remainingQuantity = quantity;

    for (const tier of pricing.tiers) {
      if (remainingQuantity <= 0) break;

      const tierQuantity = tier.maxUnits 
        ? Math.min(remainingQuantity, tier.maxUnits - tier.minUnits)
        : remainingQuantity;

      if (quantity >= tier.minUnits) {
        totalCost += tierQuantity * tier.pricePerUnit + tier.flatFee;
        remainingQuantity -= tierQuantity;
      }
    }

    return totalCost;
  }

  /**
   * Calculate overage charges
   */
  private calculateOverageCharge(
    resourceType: ResourceType,
    quantity: number,
    limits: any,
    overage: any
  ): number {
    let overageAmount = 0;

    switch (resourceType) {
      case ResourceType.COMPUTE_HOURS:
        if (limits.computeHours && quantity > limits.computeHours) {
          overageAmount = (quantity - limits.computeHours) * (overage.computePerHour || 0.10);
        }
        break;
      case ResourceType.STORAGE_GB:
        if (limits.storageGB && quantity > limits.storageGB) {
          overageAmount = (quantity - limits.storageGB) * (overage.storagePerGB || 0.20);
        }
        break;
      case ResourceType.NETWORK_GB:
        if (limits.networkGB && quantity > limits.networkGB) {
          overageAmount = (quantity - limits.networkGB) * (overage.networkPerGB || 0.15);
        }
        break;
      case ResourceType.API_CALLS:
        if (limits.apiCalls && quantity > limits.apiCalls) {
          overageAmount = ((quantity - limits.apiCalls) / 1000) * (overage.apiCallsPer1000 || 0.002);
        }
        break;
      case ResourceType.CONTAINERS:
        if (limits.containers && quantity > limits.containers) {
          overageAmount = (quantity - limits.containers) * (overage.containerPerMonth || 10.00);
        }
        break;
      case ResourceType.USERS:
        if (limits.users && limits.users > 0 && quantity > limits.users) {
          overageAmount = (quantity - limits.users) * (overage.userPerMonth || 5.00);
        }
        break;
    }

    return overageAmount;
  }

  /**
   * Calculate discounts
   */
  private calculateDiscounts(subtotal: number, discounts: any[]): number {
    let totalDiscount = 0;

    for (const discount of discounts) {
      const coupon = discount.coupon;
      
      switch (coupon.discountType) {
        case 'PERCENTAGE':
          totalDiscount += subtotal * (parseFloat(coupon.discountValue.toString()) / 100);
          break;
        case 'FIXED_AMOUNT':
          totalDiscount += parseFloat(coupon.discountValue.toString());
          break;
      }
    }

    return Math.min(totalDiscount, subtotal); // Discount cannot exceed subtotal
  }

  /**
   * Calculate tax based on location
   */
  private async calculateTax(
    amount: number,
    country: string,
    billingAddress: any
  ): Promise<number> {
    // Get tax rate for the location
    const taxRate = await this.getTaxRate(country, billingAddress?.state);
    return amount * taxRate;
  }

  /**
   * Get tax rate for a location
   */
  private async getTaxRate(country: string, state?: string): Promise<number> {
    // Check cache first
    const cacheKey = `${country}${state ? `:${state}` : ''}`;
    if (this.taxRates.has(cacheKey)) {
      return this.taxRates.get(cacheKey)!;
    }

    // Query database for tax rate
    const taxRate = await this.prisma.taxRate.findFirst({
      where: {
        country,
        state: state || null,
        isActive: true,
      }
    });

    const rate = taxRate ? parseFloat(taxRate.rate.toString()) / 100 : 0;
    this.taxRates.set(cacheKey, rate);
    
    return rate;
  }

  /**
   * Generate invoice from calculation
   */
  async generateInvoice(calculation: InvoiceCalculation): Promise<any> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: calculation.organizationId }
    });

    if (!organization) {
      throw new Error('Organization not found');
    }

    // Generate invoice number
    const invoiceCount = await this.prisma.invoice.count();
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(6, '0')}`;

    // Create invoice
    const invoice = await this.prisma.invoice.create({
      data: {
        organizationId: calculation.organizationId,
        invoiceNumber,
        status: 'OPEN',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        periodStart: calculation.period.start,
        periodEnd: calculation.period.end,
        subtotal: new Prisma.Decimal(calculation.subtotal),
        tax: new Prisma.Decimal(calculation.tax),
        discount: new Prisma.Decimal(calculation.discount),
        total: new Prisma.Decimal(calculation.total),
        currency: calculation.currency,
        lineItems: {
          create: [
            // Subscription fee line item
            ...(calculation.subscriptionFee > 0 ? [{
              description: 'Subscription Fee',
              quantity: new Prisma.Decimal(1),
              unitPrice: new Prisma.Decimal(calculation.subscriptionFee),
              amount: new Prisma.Decimal(calculation.subscriptionFee),
              taxRate: new Prisma.Decimal(0),
            }] : []),
            // Usage charge line items
            ...calculation.usageCharges.map(charge => ({
              description: `${charge.resourceType} Usage`,
              quantity: new Prisma.Decimal(charge.quantity),
              unitPrice: new Prisma.Decimal(charge.unitPrice),
              amount: new Prisma.Decimal(charge.subtotal),
              taxRate: new Prisma.Decimal(0),
              metadata: {
                resourceType: charge.resourceType,
                unit: charge.unit,
              }
            }))
          ]
        }
      },
      include: {
        lineItems: true,
      }
    });

    return invoice;
  }

  /**
   * Calculate cost optimization recommendations
   */
  async generateCostOptimizationRecommendations(
    organizationId: string
  ): Promise<any[]> {
    const recommendations = [];

    // Get recent usage patterns
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const usage = await this.prisma.resourceUsage.groupBy({
      by: ['resourceType'],
      where: {
        organizationId,
        period: { gte: thirtyDaysAgo }
      },
      _avg: { quantity: true },
      _max: { quantity: true },
      _sum: { cost: true },
    });

    // Get current subscription
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        organizationId,
        status: 'ACTIVE',
      },
      include: {
        plan: true,
      }
    });

    // Analyze usage patterns
    for (const usagePattern of usage) {
      const avgUsage = parseFloat(usagePattern._avg.quantity?.toString() || '0');
      const maxUsage = parseFloat(usagePattern._max.quantity?.toString() || '0');
      const totalCost = parseFloat(usagePattern._sum.cost?.toString() || '0');

      // Check for underutilized resources
      if (subscription?.plan.limits) {
        const limits = subscription.plan.limits as any;
        const utilization = this.calculateUtilization(
          usagePattern.resourceType,
          avgUsage,
          limits
        );

        if (utilization < 50) {
          recommendations.push({
            type: 'DOWNGRADE',
            resourceType: usagePattern.resourceType,
            currentUsage: avgUsage,
            currentLimit: this.getResourceLimit(usagePattern.resourceType, limits),
            utilization,
            estimatedSavings: totalCost * 0.3,
            recommendation: `Consider downgrading ${usagePattern.resourceType} allocation. Current utilization is only ${utilization.toFixed(1)}%`,
          });
        }
      }

      // Check for spiky usage patterns
      if (maxUsage > avgUsage * 2) {
        recommendations.push({
          type: 'RESERVED_CAPACITY',
          resourceType: usagePattern.resourceType,
          averageUsage: avgUsage,
          peakUsage: maxUsage,
          estimatedSavings: totalCost * 0.2,
          recommendation: `Consider reserved capacity for ${usagePattern.resourceType} to handle peak loads more cost-effectively`,
        });
      }
    }

    // Check for plan upgrade opportunities
    if (subscription) {
      const betterPlans = await this.findBetterPlans(
        organizationId,
        subscription.plan,
        usage
      );

      for (const plan of betterPlans) {
        recommendations.push({
          type: 'PLAN_UPGRADE',
          currentPlan: subscription.plan.name,
          suggestedPlan: plan.name,
          estimatedSavings: plan.savings,
          recommendation: `Upgrading to ${plan.name} plan could save ${plan.savings.toFixed(2)} ${subscription.plan.currency}/month`,
        });
      }
    }

    return recommendations;
  }

  /**
   * Calculate resource utilization percentage
   */
  private calculateUtilization(
    resourceType: ResourceType,
    usage: number,
    limits: any
  ): number {
    switch (resourceType) {
      case ResourceType.COMPUTE_HOURS:
        return limits.computeHours ? (usage / limits.computeHours) * 100 : 0;
      case ResourceType.STORAGE_GB:
        return limits.storageGB ? (usage / limits.storageGB) * 100 : 0;
      case ResourceType.NETWORK_GB:
        return limits.networkGB ? (usage / limits.networkGB) * 100 : 0;
      case ResourceType.API_CALLS:
        return limits.apiCalls ? (usage / limits.apiCalls) * 100 : 0;
      case ResourceType.CONTAINERS:
        return limits.containers ? (usage / limits.containers) * 100 : 0;
      case ResourceType.USERS:
        return limits.users && limits.users > 0 ? (usage / limits.users) * 100 : 0;
      default:
        return 0;
    }
  }

  /**
   * Get resource limit from plan
   */
  private getResourceLimit(resourceType: ResourceType, limits: any): number {
    switch (resourceType) {
      case ResourceType.COMPUTE_HOURS:
        return limits.computeHours || 0;
      case ResourceType.STORAGE_GB:
        return limits.storageGB || 0;
      case ResourceType.NETWORK_GB:
        return limits.networkGB || 0;
      case ResourceType.API_CALLS:
        return limits.apiCalls || 0;
      case ResourceType.CONTAINERS:
        return limits.containers || 0;
      case ResourceType.USERS:
        return limits.users || 0;
      default:
        return 0;
    }
  }

  /**
   * Find better plan options based on usage
   */
  private async findBetterPlans(
    organizationId: string,
    currentPlan: any,
    usage: any[]
  ): Promise<any[]> {
    const betterPlans = [];

    // Get all available plans
    const plans = await this.prisma.billingPlan.findMany({
      where: {
        isActive: true,
        isPublic: true,
        tier: { not: currentPlan.tier }
      }
    });

    for (const plan of plans) {
      // Calculate potential cost with this plan
      let potentialMonthlyCost = parseFloat(plan.monthlyPrice.toString());
      
      // Add estimated overage costs
      for (const usagePattern of usage) {
        const avgUsage = parseFloat(usagePattern._avg.quantity?.toString() || '0');
        const limits = plan.limits as any;
        const overage = plan.overage as any;
        
        const overageCost = this.calculateOverageCharge(
          usagePattern.resourceType,
          avgUsage,
          limits,
          overage
        );
        
        potentialMonthlyCost += overageCost;
      }

      // Compare with current costs
      const currentMonthlyCost = parseFloat(currentPlan.monthlyPrice.toString()) +
        usage.reduce((sum, u) => sum + parseFloat(u._sum.cost?.toString() || '0'), 0) / 30;

      if (potentialMonthlyCost < currentMonthlyCost * 0.9) { // At least 10% savings
        betterPlans.push({
          ...plan,
          savings: currentMonthlyCost - potentialMonthlyCost,
        });
      }
    }

    return betterPlans.sort((a, b) => b.savings - a.savings).slice(0, 3);
  }

  /**
   * Convert currency
   */
  convertCurrency(amount: number, fromCurrency: string, toCurrency: string): number {
    const fromRate = this.exchangeRates.get(fromCurrency) || 1;
    const toRate = this.exchangeRates.get(toCurrency) || 1;
    return (amount / fromRate) * toRate;
  }
}