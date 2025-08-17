import { PrismaClient } from '@prisma/client';
import { stripe, StripeError, stripeHelpers, STRIPE_PRODUCTS, STRIPE_PRICES } from './stripe-client';
import type { BillingPlan, Organization, Subscription, SubscriptionStatus, PlanTier } from '@prisma/client';
import type Stripe from 'stripe';

const prisma = new PrismaClient();

interface CreateSubscriptionRequest {
  organizationId: string;
  planTier: PlanTier;
  quantity: number;
  trialDays?: number;
  paymentMethodId?: string;
  couponCode?: string;
}

interface UpdateSubscriptionRequest {
  subscriptionId: string;
  planTier?: PlanTier;
  quantity?: number;
  prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice';
}

interface SubscriptionMetrics {
  totalSubscriptions: number;
  activeSubscriptions: number;
  trialingSubscriptions: number;
  canceledSubscriptions: number;
  monthlyRecurringRevenue: number;
  annualRecurringRevenue: number;
  averageRevenuePerUser: number;
  churnRate: number;
  conversionRate: number;
}

export class SubscriptionService {
  /**
   * Create a new subscription for an organization
   */
  async createSubscription(request: CreateSubscriptionRequest): Promise<Subscription> {
    try {
      // Get organization
      const organization = await prisma.organization.findUnique({
        where: { id: request.organizationId },
        include: { subscriptions: true }
      });

      if (!organization) {
        throw new Error('Organization not found');
      }

      // Check for existing active subscription
      const activeSubscription = organization.subscriptions.find(
        sub => sub.status === 'ACTIVE' || sub.status === 'TRIALING'
      );

      if (activeSubscription) {
        throw new Error('Organization already has an active subscription');
      }

      // Get billing plan
      const billingPlan = await prisma.billingPlan.findFirst({
        where: { tier: request.planTier, isActive: true }
      });

      if (!billingPlan) {
        throw new Error(`Billing plan not found for tier: ${request.planTier}`);
      }

      // Create or get Stripe customer
      let stripeCustomer: Stripe.Customer;
      
      if (organization.stripeCustomerId) {
        stripeCustomer = await stripe.customers.retrieve(organization.stripeCustomerId) as Stripe.Customer;
      } else {
        stripeCustomer = await stripe.customers.create({
          name: organization.displayName,
          email: organization.billingEmail,
          metadata: {
            organizationId: organization.id,
            tier: request.planTier
          },
          address: organization.billingAddress as Stripe.Address || undefined,
          payment_method: request.paymentMethodId
        });

        // Update organization with Stripe customer ID
        await prisma.organization.update({
          where: { id: organization.id },
          data: { stripeCustomerId: stripeCustomer.id }
        });
      }

      // Attach payment method if provided
      if (request.paymentMethodId) {
        await stripe.paymentMethods.attach(request.paymentMethodId, {
          customer: stripeCustomer.id
        });

        // Set as default payment method
        await stripe.customers.update(stripeCustomer.id, {
          invoice_settings: {
            default_payment_method: request.paymentMethodId
          }
        });
      }

      // Create Stripe subscription
      const subscriptionData: Stripe.SubscriptionCreateParams = {
        customer: stripeCustomer.id,
        items: [{
          price: billingPlan.stripePriceId!,
          quantity: request.quantity
        }],
        metadata: {
          organizationId: organization.id,
          planTier: request.planTier
        },
        trial_period_days: request.trialDays,
        payment_behavior: 'default_incomplete',
        payment_settings: {
          save_default_payment_method: 'on_subscription'
        },
        expand: ['latest_invoice.payment_intent']
      };

      // Apply coupon if provided
      if (request.couponCode) {
        const coupon = await prisma.coupon.findUnique({
          where: { code: request.couponCode, isActive: true }
        });
        
        if (coupon && new Date() >= coupon.validFrom && new Date() <= coupon.validUntil) {
          subscriptionData.coupon = request.couponCode;
        }
      }

      const stripeSubscription = await stripe.subscriptions.create(subscriptionData);

      // Create subscription in database
      const subscription = await prisma.subscription.create({
        data: {
          organizationId: organization.id,
          planId: billingPlan.id,
          stripeSubscriptionId: stripeSubscription.id,
          status: this.mapStripeStatus(stripeSubscription.status),
          currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
          trialStart: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : null,
          trialEnd: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
          quantity: request.quantity,
          metadata: {
            stripeCustomerId: stripeCustomer.id,
            planTier: request.planTier
          }
        },
        include: {
          organization: true,
          plan: true
        }
      });

      // Create subscription items
      if (stripeSubscription.items && stripeSubscription.items.data.length > 0) {
        await Promise.all(
          stripeSubscription.items.data.map(item =>
            prisma.subscriptionItem.create({
              data: {
                subscriptionId: subscription.id,
                productId: billingPlan.stripeProductId!,
                stripeItemId: item.id,
                quantity: item.quantity || 1,
                unitPrice: billingPlan.monthlyPrice
              }
            })
          )
        );
      }

      return subscription;
    } catch (error) {
      if (error instanceof Error) {
        throw new StripeError(`Failed to create subscription: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Update an existing subscription
   */
  async updateSubscription(request: UpdateSubscriptionRequest): Promise<Subscription> {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { id: request.subscriptionId },
        include: { plan: true, organization: true }
      });

      if (!subscription || !subscription.stripeSubscriptionId) {
        throw new Error('Subscription not found');
      }

      const updateData: Stripe.SubscriptionUpdateParams = {
        proration_behavior: request.prorationBehavior || 'create_prorations',
        metadata: {
          lastUpdated: new Date().toISOString()
        }
      };

      // Update plan tier
      if (request.planTier && request.planTier !== subscription.plan.tier) {
        const newPlan = await prisma.billingPlan.findFirst({
          where: { tier: request.planTier, isActive: true }
        });

        if (!newPlan || !newPlan.stripePriceId) {
          throw new Error(`New billing plan not found for tier: ${request.planTier}`);
        }

        updateData.items = [{
          id: (await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId)).items.data[0].id,
          price: newPlan.stripePriceId,
          quantity: request.quantity || subscription.quantity
        }];

        // Update plan in database
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { planId: newPlan.id }
        });
      }

      // Update quantity
      if (request.quantity && request.quantity !== subscription.quantity) {
        if (!updateData.items) {
          const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
          updateData.items = [{
            id: stripeSubscription.items.data[0].id,
            quantity: request.quantity
          }];
        } else {
          updateData.items[0].quantity = request.quantity;
        }
      }

      // Update Stripe subscription
      const updatedStripeSubscription = await stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        updateData
      );

      // Update database
      const updatedSubscription = await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: this.mapStripeStatus(updatedStripeSubscription.status),
          currentPeriodStart: new Date(updatedStripeSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(updatedStripeSubscription.current_period_end * 1000),
          quantity: request.quantity || subscription.quantity,
          updatedAt: new Date()
        },
        include: {
          organization: true,
          plan: true
        }
      });

      return updatedSubscription;
    } catch (error) {
      if (error instanceof Error) {
        throw new StripeError(`Failed to update subscription: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    cancelAtPeriodEnd: boolean = true,
    reason?: string
  ): Promise<Subscription> {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: { organization: true, plan: true }
      });

      if (!subscription || !subscription.stripeSubscriptionId) {
        throw new Error('Subscription not found');
      }

      let updatedStripeSubscription: Stripe.Subscription;

      if (cancelAtPeriodEnd) {
        // Cancel at period end
        updatedStripeSubscription = await stripe.subscriptions.update(
          subscription.stripeSubscriptionId,
          {
            cancel_at_period_end: true,
            metadata: {
              cancellationReason: reason || 'User requested',
              cancelledAt: new Date().toISOString()
            }
          }
        );
      } else {
        // Cancel immediately
        updatedStripeSubscription = await stripe.subscriptions.cancel(
          subscription.stripeSubscriptionId,
          {
            prorate: true,
            invoice_now: true
          }
        );
      }

      // Update database
      const updatedSubscription = await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: cancelAtPeriodEnd ? 'ACTIVE' : 'CANCELLED',
          cancelAtPeriodEnd,
          cancelledAt: cancelAtPeriodEnd ? null : new Date(),
          updatedAt: new Date()
        },
        include: {
          organization: true,
          plan: true
        }
      });

      return updatedSubscription;
    } catch (error) {
      if (error instanceof Error) {
        throw new StripeError(`Failed to cancel subscription: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Reactivate a canceled subscription
   */
  async reactivateSubscription(subscriptionId: string): Promise<Subscription> {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: { organization: true, plan: true }
      });

      if (!subscription || !subscription.stripeSubscriptionId) {
        throw new Error('Subscription not found');
      }

      if (!subscription.cancelAtPeriodEnd) {
        throw new Error('Subscription is not scheduled for cancellation');
      }

      // Reactivate in Stripe
      const updatedStripeSubscription = await stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        {
          cancel_at_period_end: false,
          metadata: {
            reactivatedAt: new Date().toISOString()
          }
        }
      );

      // Update database
      const updatedSubscription = await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          cancelAtPeriodEnd: false,
          cancelledAt: null,
          status: this.mapStripeStatus(updatedStripeSubscription.status),
          updatedAt: new Date()
        },
        include: {
          organization: true,
          plan: true
        }
      });

      return updatedSubscription;
    } catch (error) {
      if (error instanceof Error) {
        throw new StripeError(`Failed to reactivate subscription: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get subscription metrics and analytics
   */
  async getSubscriptionMetrics(organizationId?: string): Promise<SubscriptionMetrics> {
    try {
      const whereClause = organizationId ? { organizationId } : {};
      
      const [subscriptions, totalCount] = await Promise.all([
        prisma.subscription.findMany({
          where: whereClause,
          include: {
            plan: true,
            organization: true,
            subscriptionItems: true
          }
        }),
        prisma.subscription.count({ where: whereClause })
      ]);

      const activeSubscriptions = subscriptions.filter(s => s.status === 'ACTIVE');
      const trialingSubscriptions = subscriptions.filter(s => s.status === 'TRIALING');
      const canceledSubscriptions = subscriptions.filter(s => s.status === 'CANCELLED');

      // Calculate MRR and ARR
      const monthlyRevenue = activeSubscriptions.reduce((total, sub) => {
        const monthlyPrice = parseFloat(sub.plan.monthlyPrice.toString());
        return total + (monthlyPrice * sub.quantity);
      }, 0);

      const annualRevenue = monthlyRevenue * 12;

      // Calculate ARPU
      const averageRevenuePerUser = activeSubscriptions.length > 0 
        ? monthlyRevenue / activeSubscriptions.length 
        : 0;

      // Calculate churn rate (simplified - last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const churned = subscriptions.filter(
        s => s.cancelledAt && s.cancelledAt >= thirtyDaysAgo
      ).length;
      
      const churnRate = totalCount > 0 ? (churned / totalCount) * 100 : 0;

      // Calculate conversion rate (trial to paid)
      const convertedSubscriptions = subscriptions.filter(
        s => s.trialEnd && s.status === 'ACTIVE'
      ).length;
      
      const totalTrials = subscriptions.filter(s => s.trialEnd).length;
      const conversionRate = totalTrials > 0 ? (convertedSubscriptions / totalTrials) * 100 : 0;

      return {
        totalSubscriptions: totalCount,
        activeSubscriptions: activeSubscriptions.length,
        trialingSubscriptions: trialingSubscriptions.length,
        canceledSubscriptions: canceledSubscriptions.length,
        monthlyRecurringRevenue: monthlyRevenue,
        annualRecurringRevenue: annualRevenue,
        averageRevenuePerUser: averageRevenuePerUser,
        churnRate,
        conversionRate
      };
    } catch (error) {
      throw new Error(`Failed to get subscription metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get upcoming invoice for a subscription
   */
  async getUpcomingInvoice(subscriptionId: string): Promise<Stripe.Invoice | null> {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: { organization: true }
      });

      if (!subscription?.stripeSubscriptionId || !subscription.organization.stripeCustomerId) {
        return null;
      }

      const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
        customer: subscription.organization.stripeCustomerId,
        subscription: subscription.stripeSubscriptionId
      });

      return upcomingInvoice;
    } catch (error) {
      // Stripe throws an error if there's no upcoming invoice
      if (error instanceof Error && error.message.includes('No upcoming invoice')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Preview subscription changes
   */
  async previewSubscriptionChange(
    subscriptionId: string,
    newPlanTier?: PlanTier,
    newQuantity?: number
  ): Promise<Stripe.Invoice> {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: { plan: true, organization: true }
      });

      if (!subscription?.stripeSubscriptionId || !subscription.organization.stripeCustomerId) {
        throw new Error('Subscription not found');
      }

      const items: Stripe.InvoiceRetrieveUpcomingParams.SubscriptionItem[] = [];
      
      if (newPlanTier) {
        const newPlan = await prisma.billingPlan.findFirst({
          where: { tier: newPlanTier, isActive: true }
        });
        
        if (!newPlan?.stripePriceId) {
          throw new Error('New plan not found');
        }

        const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
        
        items.push({
          id: stripeSubscription.items.data[0].id,
          price: newPlan.stripePriceId,
          quantity: newQuantity || subscription.quantity
        });
      } else if (newQuantity) {
        const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
        
        items.push({
          id: stripeSubscription.items.data[0].id,
          quantity: newQuantity
        });
      }

      const preview = await stripe.invoices.retrieveUpcoming({
        customer: subscription.organization.stripeCustomerId,
        subscription: subscription.stripeSubscriptionId,
        subscription_items: items.length > 0 ? items : undefined,
        subscription_proration_behavior: 'create_prorations'
      });

      return preview;
    } catch (error) {
      if (error instanceof Error) {
        throw new StripeError(`Failed to preview subscription change: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Map Stripe subscription status to our enum
   */
  private mapStripeStatus(stripeStatus: Stripe.Subscription.Status): SubscriptionStatus {
    const statusMap: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
      'trialing': 'TRIALING',
      'active': 'ACTIVE',
      'past_due': 'PAST_DUE',
      'canceled': 'CANCELLED',
      'unpaid': 'UNPAID',
      'incomplete': 'INCOMPLETE',
      'incomplete_expired': 'INCOMPLETE',
      'paused': 'CANCELLED'
    };

    return statusMap[stripeStatus] || 'INCOMPLETE';
  }

  /**
   * Sync subscription status from Stripe
   */
  async syncSubscriptionFromStripe(stripeSubscriptionId: string): Promise<Subscription | null> {
    try {
      const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      
      const subscription = await prisma.subscription.findUnique({
        where: { stripeSubscriptionId },
        include: { organization: true, plan: true }
      });

      if (!subscription) {
        return null;
      }

      const updatedSubscription = await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: this.mapStripeStatus(stripeSubscription.status),
          currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          cancelledAt: stripeSubscription.canceled_at 
            ? new Date(stripeSubscription.canceled_at * 1000) 
            : null,
          quantity: stripeSubscription.items.data[0]?.quantity || 1,
          updatedAt: new Date()
        },
        include: {
          organization: true,
          plan: true
        }
      });

      return updatedSubscription;
    } catch (error) {
      console.error('Error syncing subscription from Stripe:', error);
      return null;
    }
  }
}

export const subscriptionService = new SubscriptionService();
