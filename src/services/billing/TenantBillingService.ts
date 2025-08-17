/**
 * Tenant Billing Service
 * Comprehensive billing and subscription management for multi-tenant SaaS platform
 */

import { PrismaClient } from '@prisma/client';
import { TenantAwareDatabase } from '@/lib/database/TenantAwareDatabase';
import { createAuditLog } from '@/lib/audit/AuditService';
import { getTenantContext, TenantContext } from '@/lib/tenancy/TenantContext';
import { NextRequest } from 'next/server';

export interface SubscriptionPlan {
  id: string;
  name: string;
  tier: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  price: number;
  currency: string;
  billingCycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  features: PlanFeature[];
  limits: PlanLimits;
  isActive: boolean;
  trialDays?: number;
  setupFee?: number;
  discountPercentage?: number;
}

export interface PlanFeature {
  key: string;
  name: string;
  description: string;
  included: boolean;
  limit?: number;
  unit?: string;
}

export interface PlanLimits {
  maxUsers: number;
  maxPlugins: number;
  maxStorage: number; // GB
  maxApiCalls: number; // per month
  maxIntegrations: number;
  maxCustomDomains: number;
  supportLevel: 'COMMUNITY' | 'EMAIL' | 'PRIORITY' | 'DEDICATED';
  slaUptime: number; // percentage
}

export interface TenantSubscription {
  id: string;
  tenantId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialStart?: Date;
  trialEnd?: Date;
  canceledAt?: Date;
  cancellationReason?: string;
  nextBillingDate: Date;
  lastBillingDate?: Date;
  autoRenew: boolean;
  metadata: Record<string, any>;
  plan: SubscriptionPlan;
}

export interface Invoice {
  id: string;
  tenantId: string;
  subscriptionId: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  dueDate: Date;
  paidAt?: Date;
  items: InvoiceItem[];
  paymentMethod?: PaymentMethod;
  metadata: Record<string, any>;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  type: 'SUBSCRIPTION' | 'USAGE' | 'ONE_TIME' | 'SETUP' | 'OVERAGE';
  metadata: Record<string, any>;
}

export interface PaymentMethod {
  id: string;
  type: 'CREDIT_CARD' | 'BANK_TRANSFER' | 'PAYPAL' | 'STRIPE' | 'MANUAL';
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
  metadata: Record<string, any>;
}

export interface UsageRecord {
  id: string;
  tenantId: string;
  subscriptionId: string;
  resourceType: UsageResourceType;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
  period: Date;
  recordedAt: Date;
  metadata: Record<string, any>;
}

export interface BillingAlert {
  id: string;
  tenantId: string;
  type: AlertType;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  threshold?: number;
  currentValue?: number;
  isResolved: boolean;
  createdAt: Date;
  resolvedAt?: Date;
}

export interface BillingAnalytics {
  tenantId: string;
  subscription: TenantSubscription;
  currentUsage: CurrentUsage;
  projectedCosts: ProjectedCosts;
  paymentHistory: PaymentSummary;
  alerts: BillingAlert[];
  recommendations: BillingRecommendation[];
  costOptimization: CostOptimizationSuggestion[];
}

export interface CurrentUsage {
  period: { start: Date; end: Date };
  resources: {
    users: { used: number; limit: number; cost: number };
    storage: { used: number; limit: number; cost: number };
    apiCalls: { used: number; limit: number; cost: number };
    plugins: { used: number; limit: number; cost: number };
    integrations: { used: number; limit: number; cost: number };
  };
  totalCost: number;
  projectedMonthlyTotal: number;
}

export interface ProjectedCosts {
  nextMonth: number;
  nextQuarter: number;
  nextYear: number;
  breakdown: {
    subscription: number;
    usage: number;
    overages: number;
  };
}

export interface PaymentSummary {
  totalPaid: number;
  totalOutstanding: number;
  averageMonthlySpend: number;
  paymentHistory: Array<{
    date: Date;
    amount: number;
    status: string;
  }>;
}

export interface BillingRecommendation {
  id: string;
  type: 'PLAN_UPGRADE' | 'PLAN_DOWNGRADE' | 'USAGE_OPTIMIZATION' | 'COST_SAVING';
  title: string;
  description: string;
  estimatedSavings?: number;
  estimatedCost?: number;
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
  actionRequired: boolean;
}

export interface CostOptimizationSuggestion {
  id: string;
  category: 'USAGE' | 'PLAN' | 'FEATURES' | 'BILLING_CYCLE';
  suggestion: string;
  potentialSavings: number;
  implementationEffort: 'LOW' | 'MEDIUM' | 'HIGH';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
}

export type SubscriptionStatus = 
  | 'TRIAL' 
  | 'ACTIVE' 
  | 'PAST_DUE' 
  | 'CANCELED' 
  | 'UNPAID' 
  | 'INCOMPLETE' 
  | 'INCOMPLETE_EXPIRED'
  | 'PAUSED';

export type InvoiceStatus = 
  | 'DRAFT' 
  | 'OPEN' 
  | 'PAID' 
  | 'PAST_DUE' 
  | 'CANCELED' 
  | 'UNCOLLECTIBLE';

export type UsageResourceType = 
  | 'USERS' 
  | 'STORAGE_GB' 
  | 'API_CALLS' 
  | 'PLUGINS' 
  | 'INTEGRATIONS' 
  | 'CUSTOM_DOMAINS' 
  | 'SUPPORT_TICKETS';

export type AlertType = 
  | 'USAGE_LIMIT_APPROACHING' 
  | 'USAGE_LIMIT_EXCEEDED' 
  | 'PAYMENT_FAILED' 
  | 'INVOICE_OVERDUE' 
  | 'TRIAL_EXPIRING' 
  | 'SUBSCRIPTION_CANCELED'
  | 'UPGRADE_RECOMMENDED';

/**
 * Comprehensive Tenant Billing Service
 */
export class TenantBillingService {
  private systemDb: TenantAwareDatabase;
  private tenantDb: TenantAwareDatabase;

  constructor() {
    this.systemDb = new TenantAwareDatabase();
    this.systemDb.createSystemContext();
    this.tenantDb = new TenantAwareDatabase();
  }

  /**
   * Initialize service with tenant context
   */
  async initializeWithRequest(request: NextRequest): Promise<boolean> {
    const tenantContext = getTenantContext(request);
    if (!tenantContext) {
      return false;
    }

    const dbContext = {
      tenantId: tenantContext.tenant.id,
      userId: tenantContext.user?.id,
      userPermissions: tenantContext.permissions,
      isSystemOperation: false
    };

    this.tenantDb.setTenantContext(dbContext);
    return true;
  }

  /**
   * Get tenant subscription information
   */
  async getTenantSubscription(tenantId: string): Promise<TenantSubscription | null> {
    try {
      const subscription = await this.systemDb.findFirst('subscription', {
        where: {
          tenantId,
          status: { not: 'CANCELED' }
        },
        include: {
          plan: true,
          invoices: {
            orderBy: { createdAt: 'desc' },
            take: 5
          }
        }
      });

      return subscription;
    } catch (error) {
      console.error('Failed to get tenant subscription:', error);
      return null;
    }
  }

  /**
   * Get comprehensive billing analytics
   */
  async getBillingAnalytics(tenantId: string): Promise<BillingAnalytics | null> {
    try {
      const subscription = await this.getTenantSubscription(tenantId);
      if (!subscription) {
        return null;
      }

      const [
        currentUsage,
        projectedCosts,
        paymentHistory,
        alerts,
        recommendations,
        costOptimization
      ] = await Promise.all([
        this.getCurrentUsage(tenantId),
        this.getProjectedCosts(tenantId),
        this.getPaymentHistory(tenantId),
        this.getBillingAlerts(tenantId),
        this.generateBillingRecommendations(tenantId),
        this.getCostOptimizationSuggestions(tenantId)
      ]);

      return {
        tenantId,
        subscription,
        currentUsage,
        projectedCosts,
        paymentHistory,
        alerts,
        recommendations,
        costOptimization
      };
    } catch (error) {
      console.error('Failed to get billing analytics:', error);
      return null;
    }
  }

  /**
   * Create or update subscription
   */
  async manageSubscription(
    tenantId: string,
    planId: string,
    options: {
      trialDays?: number;
      prorationBehavior?: 'CREATE_PRORATIONS' | 'NONE';
      paymentMethodId?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<{ success: boolean; subscription?: TenantSubscription; error?: string }> {
    try {
      const plan = await this.getSubscriptionPlan(planId);
      if (!plan) {
        return { success: false, error: 'Subscription plan not found' };
      }

      const existingSubscription = await this.getTenantSubscription(tenantId);
      
      const result = await this.systemDb.transaction(async (client) => {
        let subscription;

        if (existingSubscription) {
          // Update existing subscription
          subscription = await this.updateSubscription(
            client,
            existingSubscription.id,
            planId,
            options
          );
        } else {
          // Create new subscription
          subscription = await this.createSubscription(
            client,
            tenantId,
            planId,
            options
          );
        }

        // Update tenant tier
        await client.update('organization', {
          where: { id: tenantId },
          data: { 
            tier: plan.tier,
            subscriptionId: subscription.id
          }
        });

        // Create audit log
        await createAuditLog({
          tenantId,
          action: existingSubscription ? 'subscription:update' : 'subscription:create',
          resource: 'subscription',
          resourceId: subscription.id,
          metadata: {
            planId,
            tier: plan.tier,
            options
          }
        });

        return subscription;
      });

      return { success: true, subscription: result };
    } catch (error) {
      console.error('Failed to manage subscription:', error);
      return { success: false, error: 'Failed to manage subscription' };
    }
  }

  /**
   * Process usage-based billing
   */
  async recordUsage(
    tenantId: string,
    resourceType: UsageResourceType,
    quantity: number,
    metadata: Record<string, any> = {}
  ): Promise<{ success: boolean; record?: UsageRecord; error?: string }> {
    try {
      const subscription = await this.getTenantSubscription(tenantId);
      if (!subscription) {
        return { success: false, error: 'No active subscription found' };
      }

      // Calculate usage cost
      const pricing = await this.getUsagePricing(subscription.planId, resourceType);
      const amount = quantity * (pricing?.unitPrice || 0);

      // Record usage
      const usageRecord = await this.systemDb.create('usageRecord', {
        data: {
          tenantId,
          subscriptionId: subscription.id,
          resourceType,
          quantity,
          unit: pricing?.unit || 'count',
          unitPrice: pricing?.unitPrice || 0,
          amount,
          period: new Date(),
          recordedAt: new Date(),
          metadata
        }
      });

      // Check usage limits and create alerts if necessary
      await this.checkUsageLimits(tenantId, resourceType, quantity);

      return { success: true, record: usageRecord };
    } catch (error) {
      console.error('Failed to record usage:', error);
      return { success: false, error: 'Failed to record usage' };
    }
  }

  /**
   * Generate invoice
   */
  async generateInvoice(
    tenantId: string,
    billingPeriod: { start: Date; end: Date }
  ): Promise<{ success: boolean; invoice?: Invoice; error?: string }> {
    try {
      const subscription = await this.getTenantSubscription(tenantId);
      if (!subscription) {
        return { success: false, error: 'No active subscription found' };
      }

      const result = await this.systemDb.transaction(async (client) => {
        // Calculate subscription charges
        const subscriptionAmount = this.calculateSubscriptionAmount(subscription, billingPeriod);
        
        // Calculate usage charges
        const usageCharges = await this.calculateUsageCharges(tenantId, billingPeriod);
        
        // Calculate tax
        const subtotal = subscriptionAmount + usageCharges.total;
        const tax = await this.calculateTax(tenantId, subtotal);
        const total = subtotal + tax;

        // Generate invoice number
        const invoiceNumber = await this.generateInvoiceNumber();

        // Create invoice
        const invoice = await client.create('invoice', {
          data: {
            tenantId,
            subscriptionId: subscription.id,
            invoiceNumber,
            status: 'OPEN',
            subtotal,
            tax,
            total,
            currency: subscription.plan.currency,
            billingPeriodStart: billingPeriod.start,
            billingPeriodEnd: billingPeriod.end,
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            items: [
              {
                description: `${subscription.plan.name} subscription`,
                quantity: 1,
                unitPrice: subscriptionAmount,
                amount: subscriptionAmount,
                type: 'SUBSCRIPTION',
                metadata: { planId: subscription.planId }
              },
              ...usageCharges.items
            ],
            metadata: {
              generatedAt: new Date().toISOString(),
              billingPeriod: billingPeriod
            }
          }
        });

        // Create audit log
        await createAuditLog({
          tenantId,
          action: 'invoice:generate',
          resource: 'invoice',
          resourceId: invoice.id,
          metadata: {
            amount: total,
            billingPeriod,
            invoiceNumber
          }
        });

        return invoice;
      });

      return { success: true, invoice: result };
    } catch (error) {
      console.error('Failed to generate invoice:', error);
      return { success: false, error: 'Failed to generate invoice' };
    }
  }

  /**
   * Process payment
   */
  async processPayment(
    tenantId: string,
    invoiceId: string,
    paymentMethodId: string,
    metadata: Record<string, any> = {}
  ): Promise<{ success: boolean; payment?: any; error?: string }> {
    try {
      const invoice = await this.systemDb.findUnique('invoice', {
        where: { id: invoiceId },
        include: { subscription: true }
      });

      if (!invoice || invoice.tenantId !== tenantId) {
        return { success: false, error: 'Invoice not found' };
      }

      if (invoice.status === 'PAID') {
        return { success: false, error: 'Invoice already paid' };
      }

      const result = await this.systemDb.transaction(async (client) => {
        // Process payment (integrate with payment provider)
        const paymentResult = await this.processPaymentWithProvider(
          invoice.total,
          invoice.currency,
          paymentMethodId,
          metadata
        );

        if (!paymentResult.success) {
          throw new Error(paymentResult.error);
        }

        // Update invoice status
        await client.update('invoice', {
          where: { id: invoiceId },
          data: {
            status: 'PAID',
            paidAt: new Date(),
            metadata: {
              ...invoice.metadata,
              paymentResult: paymentResult.payment
            }
          }
        });

        // Create payment record
        const payment = await client.create('payment', {
          data: {
            tenantId,
            invoiceId,
            amount: invoice.total,
            currency: invoice.currency,
            status: 'COMPLETED',
            paymentMethodId,
            externalId: paymentResult.payment.id,
            processedAt: new Date(),
            metadata: paymentResult.payment
          }
        });

        // Update subscription if payment was successful
        if (invoice.subscription.status === 'PAST_DUE') {
          await client.update('subscription', {
            where: { id: invoice.subscriptionId },
            data: { status: 'ACTIVE' }
          });
        }

        return payment;
      });

      // Create audit log
      await createAuditLog({
        tenantId,
        action: 'payment:process',
        resource: 'payment',
        resourceId: result.id,
        metadata: {
          invoiceId,
          amount: invoice.total,
          paymentMethodId
        }
      });

      return { success: true, payment: result };
    } catch (error) {
      console.error('Failed to process payment:', error);
      return { success: false, error: 'Failed to process payment' };
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    tenantId: string,
    reason?: string,
    immediate: boolean = false
  ): Promise<{ success: boolean; subscription?: TenantSubscription; error?: string }> {
    try {
      const subscription = await this.getTenantSubscription(tenantId);
      if (!subscription) {
        return { success: false, error: 'No active subscription found' };
      }

      const cancelDate = immediate ? new Date() : subscription.currentPeriodEnd;

      const updatedSubscription = await this.systemDb.update('subscription', {
        where: { id: subscription.id },
        data: {
          status: immediate ? 'CANCELED' : 'ACTIVE',
          canceledAt: cancelDate,
          cancellationReason: reason,
          autoRenew: false,
          metadata: {
            ...subscription.metadata,
            cancelation: {
              reason,
              immediate,
              canceledAt: cancelDate.toISOString()
            }
          }
        }
      });

      // Create audit log
      await createAuditLog({
        tenantId,
        action: 'subscription:cancel',
        resource: 'subscription',
        resourceId: subscription.id,
        metadata: {
          reason,
          immediate,
          cancelDate: cancelDate.toISOString()
        }
      });

      return { success: true, subscription: updatedSubscription };
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      return { success: false, error: 'Failed to cancel subscription' };
    }
  }

  /**
   * Private helper methods
   */

  private async createSubscription(
    client: any,
    tenantId: string,
    planId: string,
    options: any
  ): Promise<TenantSubscription> {
    const plan = await this.getSubscriptionPlan(planId);
    if (!plan) {
      throw new Error('Plan not found');
    }

    const now = new Date();
    const trialEnd = options.trialDays 
      ? new Date(now.getTime() + options.trialDays * 24 * 60 * 60 * 1000)
      : null;

    const periodStart = trialEnd || now;
    const periodEnd = this.calculatePeriodEnd(periodStart, plan.billingCycle);

    return await client.create('subscription', {
      data: {
        tenantId,
        planId,
        status: trialEnd ? 'TRIAL' : 'ACTIVE',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        trialStart: options.trialDays ? now : null,
        trialEnd,
        nextBillingDate: periodEnd,
        autoRenew: true,
        metadata: options.metadata || {}
      }
    });
  }

  private async updateSubscription(
    client: any,
    subscriptionId: string,
    planId: string,
    options: any
  ): Promise<TenantSubscription> {
    const plan = await this.getSubscriptionPlan(planId);
    if (!plan) {
      throw new Error('Plan not found');
    }

    return await client.update('subscription', {
      where: { id: subscriptionId },
      data: {
        planId,
        metadata: options.metadata || {}
      }
    });
  }

  private calculatePeriodEnd(start: Date, billingCycle: string): Date {
    const end = new Date(start);
    
    switch (billingCycle) {
      case 'MONTHLY':
        end.setMonth(end.getMonth() + 1);
        break;
      case 'QUARTERLY':
        end.setMonth(end.getMonth() + 3);
        break;
      case 'YEARLY':
        end.setFullYear(end.getFullYear() + 1);
        break;
    }
    
    return end;
  }

  // Additional helper method implementations would go here...
  // For brevity, I'm including placeholders for the remaining methods

  private async getSubscriptionPlan(planId: string): Promise<SubscriptionPlan | null> {
    // Implementation for getting subscription plan
    return null;
  }

  private async getCurrentUsage(tenantId: string): Promise<CurrentUsage> {
    // Implementation for current usage calculation
    return {} as CurrentUsage;
  }

  private async getProjectedCosts(tenantId: string): Promise<ProjectedCosts> {
    // Implementation for cost projection
    return {} as ProjectedCosts;
  }

  private async getPaymentHistory(tenantId: string): Promise<PaymentSummary> {
    // Implementation for payment history
    return {} as PaymentSummary;
  }

  private async getBillingAlerts(tenantId: string): Promise<BillingAlert[]> {
    // Implementation for billing alerts
    return [];
  }

  private async generateBillingRecommendations(tenantId: string): Promise<BillingRecommendation[]> {
    // Implementation for billing recommendations
    return [];
  }

  private async getCostOptimizationSuggestions(tenantId: string): Promise<CostOptimizationSuggestion[]> {
    // Implementation for cost optimization
    return [];
  }

  private async getUsagePricing(planId: string, resourceType: UsageResourceType): Promise<any> {
    // Implementation for usage pricing lookup
    return null;
  }

  private async checkUsageLimits(tenantId: string, resourceType: UsageResourceType, quantity: number): Promise<void> {
    // Implementation for usage limit checking
  }

  private calculateSubscriptionAmount(subscription: TenantSubscription, period: any): number {
    // Implementation for subscription amount calculation
    return 0;
  }

  private async calculateUsageCharges(tenantId: string, period: any): Promise<any> {
    // Implementation for usage charges calculation
    return { total: 0, items: [] };
  }

  private async calculateTax(tenantId: string, amount: number): Promise<number> {
    // Implementation for tax calculation
    return 0;
  }

  private async generateInvoiceNumber(): Promise<string> {
    // Implementation for invoice number generation
    return `INV-${Date.now()}`;
  }

  private async processPaymentWithProvider(
    amount: number,
    currency: string,
    paymentMethodId: string,
    metadata: any
  ): Promise<{ success: boolean; payment?: any; error?: string }> {
    // Implementation for payment provider integration
    return { success: true, payment: { id: `pay_${Date.now()}` } };
  }

  /**
   * Cleanup and disconnect
   */
  async disconnect(): Promise<void> {
    await Promise.all([
      this.systemDb.disconnect(),
      this.tenantDb.disconnect()
    ]);
  }
}

export default TenantBillingService;