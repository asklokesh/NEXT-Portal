import Stripe from 'stripe';
import { PrismaClient, Prisma, PaymentStatus, PaymentMethod } from '@prisma/client';
import { EventEmitter } from 'events';

interface PaymentIntent {
  organizationId: string;
  amount: number;
  currency: string;
  description?: string;
  metadata?: Record<string, string>;
  paymentMethodId?: string;
}

interface SubscriptionCreate {
  organizationId: string;
  planId: string;
  paymentMethodId: string;
  trialDays?: number;
  couponCode?: string;
  quantity?: number;
}

interface RefundRequest {
  paymentId: string;
  amount?: number;
  reason?: string;
}

export class StripePaymentService extends EventEmitter {
  private stripe: Stripe;
  private prisma: PrismaClient;
  private webhookSecret: string;

  constructor(prisma: PrismaClient) {
    super();
    this.prisma = prisma;
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2023-10-16',
    });
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  }

  /**
   * Create or get Stripe customer for organization
   */
  async ensureStripeCustomer(organizationId: string): Promise<string> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId }
    });

    if (!organization) {
      throw new Error('Organization not found');
    }

    if (organization.stripeCustomerId) {
      return organization.stripeCustomerId;
    }

    // Create new Stripe customer
    const customer = await this.stripe.customers.create({
      email: organization.billingEmail,
      name: organization.displayName,
      metadata: {
        organizationId,
      },
      tax_id_data: organization.taxId ? [{
        type: 'us_ein',
        value: organization.taxId,
      }] : undefined,
    });

    // Update organization with Stripe customer ID
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { stripeCustomerId: customer.id }
    });

    return customer.id;
  }

  /**
   * Create payment intent for one-time payment
   */
  async createPaymentIntent(intent: PaymentIntent): Promise<Stripe.PaymentIntent> {
    const customerId = await this.ensureStripeCustomer(intent.organizationId);

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(intent.amount * 100), // Convert to cents
      currency: intent.currency.toLowerCase(),
      customer: customerId,
      description: intent.description,
      metadata: {
        organizationId: intent.organizationId,
        ...intent.metadata,
      },
      payment_method: intent.paymentMethodId,
      confirm: !!intent.paymentMethodId,
      automatic_payment_methods: !intent.paymentMethodId ? {
        enabled: true,
      } : undefined,
    });

    // Record payment in database
    await this.prisma.payment.create({
      data: {
        organizationId: intent.organizationId,
        stripePaymentId: paymentIntent.id,
        amount: new Prisma.Decimal(intent.amount),
        currency: intent.currency,
        status: this.mapStripeStatus(paymentIntent.status),
        method: 'CARD',
        metadata: intent.metadata,
      }
    });

    return paymentIntent;
  }

  /**
   * Create subscription
   */
  async createSubscription(data: SubscriptionCreate): Promise<Stripe.Subscription> {
    const customerId = await this.ensureStripeCustomer(data.organizationId);
    
    // Get billing plan
    const plan = await this.prisma.billingPlan.findUnique({
      where: { id: data.planId }
    });

    if (!plan) {
      throw new Error('Billing plan not found');
    }

    // Ensure Stripe product and price exist
    const { productId, priceId } = await this.ensureStripeProductAndPrice(plan);

    // Attach payment method to customer
    await this.stripe.paymentMethods.attach(data.paymentMethodId, {
      customer: customerId,
    });

    // Set as default payment method
    await this.stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: data.paymentMethodId,
      }
    });

    // Apply coupon if provided
    let promotionCode;
    if (data.couponCode) {
      promotionCode = await this.findOrCreatePromotionCode(data.couponCode);
    }

    // Create subscription
    const subscription = await this.stripe.subscriptions.create({
      customer: customerId,
      items: [{
        price: priceId,
        quantity: data.quantity || 1,
      }],
      trial_period_days: data.trialDays || plan.trialDays,
      promotion_code: promotionCode?.id,
      metadata: {
        organizationId: data.organizationId,
        planId: data.planId,
      },
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
    });

    // Record subscription in database
    await this.prisma.subscription.create({
      data: {
        organizationId: data.organizationId,
        planId: data.planId,
        stripeSubscriptionId: subscription.id,
        status: this.mapStripeSubscriptionStatus(subscription.status),
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : undefined,
        trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : undefined,
        quantity: data.quantity || 1,
        metadata: {
          stripeCustomerId: customerId,
        }
      }
    });

    this.emit('subscription-created', { organizationId: data.organizationId, subscription });
    return subscription;
  }

  /**
   * Update subscription
   */
  async updateSubscription(
    subscriptionId: string,
    updates: {
      planId?: string;
      quantity?: number;
      cancelAtPeriodEnd?: boolean;
      trialEnd?: 'now' | number;
    }
  ): Promise<Stripe.Subscription> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId }
    });

    if (!subscription || !subscription.stripeSubscriptionId) {
      throw new Error('Subscription not found');
    }

    const updateParams: Stripe.SubscriptionUpdateParams = {};

    if (updates.planId) {
      const plan = await this.prisma.billingPlan.findUnique({
        where: { id: updates.planId }
      });

      if (!plan) {
        throw new Error('Billing plan not found');
      }

      const { priceId } = await this.ensureStripeProductAndPrice(plan);
      
      // Get current subscription items
      const stripeSubscription = await this.stripe.subscriptions.retrieve(
        subscription.stripeSubscriptionId
      );

      updateParams.items = [{
        id: stripeSubscription.items.data[0].id,
        price: priceId,
      }];
    }

    if (updates.quantity !== undefined) {
      updateParams.items = updateParams.items || [];
      updateParams.items[0] = {
        ...updateParams.items[0],
        quantity: updates.quantity,
      };
    }

    if (updates.cancelAtPeriodEnd !== undefined) {
      updateParams.cancel_at_period_end = updates.cancelAtPeriodEnd;
    }

    if (updates.trialEnd !== undefined) {
      updateParams.trial_end = updates.trialEnd;
    }

    const updatedStripeSubscription = await this.stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      updateParams
    );

    // Update database
    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        planId: updates.planId || subscription.planId,
        quantity: updates.quantity || subscription.quantity,
        cancelAtPeriodEnd: updates.cancelAtPeriodEnd ?? subscription.cancelAtPeriodEnd,
        status: this.mapStripeSubscriptionStatus(updatedStripeSubscription.status),
      }
    });

    this.emit('subscription-updated', { subscriptionId, updates });
    return updatedStripeSubscription;
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string, immediately: boolean = false): Promise<void> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId }
    });

    if (!subscription || !subscription.stripeSubscriptionId) {
      throw new Error('Subscription not found');
    }

    if (immediately) {
      await this.stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
      
      await this.prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
        }
      });
    } else {
      await this.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      await this.prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          cancelAtPeriodEnd: true,
        }
      });
    }

    this.emit('subscription-cancelled', { subscriptionId, immediately });
  }

  /**
   * Process refund
   */
  async processRefund(request: RefundRequest): Promise<Stripe.Refund> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: request.paymentId }
    });

    if (!payment || !payment.stripePaymentId) {
      throw new Error('Payment not found');
    }

    const refund = await this.stripe.refunds.create({
      payment_intent: payment.stripePaymentId,
      amount: request.amount ? Math.round(request.amount * 100) : undefined,
      reason: this.mapRefundReason(request.reason),
      metadata: {
        paymentId: request.paymentId,
      }
    });

    // Record refund in database
    await this.prisma.refund.create({
      data: {
        paymentId: request.paymentId,
        stripeRefundId: refund.id,
        amount: new Prisma.Decimal(refund.amount / 100),
        reason: request.reason as any || 'REQUESTED_BY_CUSTOMER',
        status: this.mapStripeRefundStatus(refund.status),
        processedAt: new Date(),
      }
    });

    // Update payment refunded amount
    const refundedAmount = parseFloat(payment.refundedAmount.toString()) + (refund.amount / 100);
    await this.prisma.payment.update({
      where: { id: request.paymentId },
      data: {
        refundedAmount: new Prisma.Decimal(refundedAmount),
        status: refundedAmount >= parseFloat(payment.amount.toString()) 
          ? 'REFUNDED' 
          : 'PARTIALLY_REFUNDED',
      }
    });

    this.emit('refund-processed', { paymentId: request.paymentId, refund });
    return refund;
  }

  /**
   * Create checkout session for complex payment flows
   */
  async createCheckoutSession(data: {
    organizationId: string;
    lineItems: Array<{
      name: string;
      amount: number;
      quantity: number;
    }>;
    successUrl: string;
    cancelUrl: string;
    mode?: 'payment' | 'subscription';
  }): Promise<Stripe.Checkout.Session> {
    const customerId = await this.ensureStripeCustomer(data.organizationId);

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      line_items: data.lineItems.map(item => ({
        price_data: {
          currency: 'usd',
          product_data: {
            name: item.name,
          },
          unit_amount: Math.round(item.amount * 100),
        },
        quantity: item.quantity,
      })),
      mode: data.mode || 'payment',
      success_url: data.successUrl,
      cancel_url: data.cancelUrl,
      metadata: {
        organizationId: data.organizationId,
      }
    });

    return session;
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(payload: string, signature: string): Promise<void> {
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
    } catch (err) {
      throw new Error(`Webhook signature verification failed: ${err}`);
    }

    // Record event
    await this.prisma.billingEvent.create({
      data: {
        eventType: event.type,
        eventData: event.data as any,
        stripeEventId: event.id,
        processed: false,
      }
    });

    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
          break;

        case 'invoice.paid':
          await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        case 'charge.dispute.created':
          await this.handleDisputeCreated(event.data.object as Stripe.Dispute);
          break;

        default:
          console.log(`Unhandled webhook event type: ${event.type}`);
      }

      // Mark event as processed
      await this.prisma.billingEvent.update({
        where: { stripeEventId: event.id },
        data: { 
          processed: true,
          processedAt: new Date(),
        }
      });
    } catch (error) {
      // Log error but don't throw to avoid webhook retry
      console.error(`Error processing webhook ${event.type}:`, error);
      
      await this.prisma.billingEvent.update({
        where: { stripeEventId: event.id },
        data: { 
          error: (error as Error).message,
        }
      });
    }
  }

  /**
   * Handle successful payment
   */
  private async handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    await this.prisma.payment.updateMany({
      where: { stripePaymentId: paymentIntent.id },
      data: {
        status: 'SUCCEEDED',
        processedAt: new Date(),
      }
    });

    this.emit('payment-succeeded', { paymentIntentId: paymentIntent.id });
  }

  /**
   * Handle failed payment
   */
  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    await this.prisma.payment.updateMany({
      where: { stripePaymentId: paymentIntent.id },
      data: {
        status: 'FAILED',
        failureReason: paymentIntent.last_payment_error?.message,
      }
    });

    // Create billing alert
    const payment = await this.prisma.payment.findFirst({
      where: { stripePaymentId: paymentIntent.id }
    });

    if (payment) {
      await this.prisma.billingAlert.create({
        data: {
          organizationId: payment.organizationId,
          type: 'PAYMENT_FAILED',
          threshold: new Prisma.Decimal(0),
          currentValue: payment.amount,
          message: `Payment of ${payment.amount} ${payment.currency} failed`,
          severity: 'CRITICAL',
        }
      });
    }

    this.emit('payment-failed', { paymentIntentId: paymentIntent.id });
  }

  /**
   * Handle paid invoice
   */
  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    await this.prisma.invoice.updateMany({
      where: { stripeInvoiceId: invoice.id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      }
    });

    this.emit('invoice-paid', { invoiceId: invoice.id });
  }

  /**
   * Handle failed invoice payment
   */
  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { stripeSubscriptionId: invoice.subscription as string }
    });

    if (subscription) {
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'PAST_DUE' }
      });

      // Create billing alert
      await this.prisma.billingAlert.create({
        data: {
          organizationId: subscription.organizationId,
          type: 'PAYMENT_FAILED',
          threshold: new Prisma.Decimal(0),
          currentValue: new Prisma.Decimal(invoice.amount_due / 100),
          message: `Invoice payment failed. Subscription is now past due.`,
          severity: 'CRITICAL',
        }
      });
    }

    this.emit('invoice-payment-failed', { invoiceId: invoice.id });
  }

  /**
   * Handle subscription update
   */
  private async handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
    await this.prisma.subscription.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        status: this.mapStripeSubscriptionStatus(subscription.status),
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      }
    });

    this.emit('subscription-updated-webhook', { subscriptionId: subscription.id });
  }

  /**
   * Handle subscription deletion
   */
  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    await this.prisma.subscription.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      }
    });

    this.emit('subscription-deleted', { subscriptionId: subscription.id });
  }

  /**
   * Handle dispute creation
   */
  private async handleDisputeCreated(dispute: Stripe.Dispute): Promise<void> {
    // Find related payment
    const payment = await this.prisma.payment.findFirst({
      where: { stripePaymentId: dispute.payment_intent as string }
    });

    if (payment) {
      // Create critical billing alert
      await this.prisma.billingAlert.create({
        data: {
          organizationId: payment.organizationId,
          type: 'PAYMENT_FAILED',
          threshold: new Prisma.Decimal(0),
          currentValue: new Prisma.Decimal(dispute.amount / 100),
          message: `Payment dispute created for ${dispute.amount / 100} ${dispute.currency}. Reason: ${dispute.reason}`,
          severity: 'CRITICAL',
        }
      });
    }

    this.emit('dispute-created', { disputeId: dispute.id });
  }

  /**
   * Ensure Stripe product and price exist for a billing plan
   */
  private async ensureStripeProductAndPrice(plan: any): Promise<{ productId: string; priceId: string }> {
    let productId = plan.stripeProductId;
    let priceId = plan.stripePriceId;

    if (!productId) {
      // Create product in Stripe
      const product = await this.stripe.products.create({
        name: plan.displayName,
        description: plan.description,
        metadata: {
          planId: plan.id,
          tier: plan.tier,
        }
      });
      productId = product.id;

      // Update plan with Stripe product ID
      await this.prisma.billingPlan.update({
        where: { id: plan.id },
        data: { stripeProductId: productId }
      });
    }

    if (!priceId) {
      // Create price in Stripe
      const price = await this.stripe.prices.create({
        product: productId,
        unit_amount: Math.round(parseFloat(plan.monthlyPrice.toString()) * 100),
        currency: plan.currency.toLowerCase(),
        recurring: {
          interval: 'month',
        },
        metadata: {
          planId: plan.id,
        }
      });
      priceId = price.id;

      // Update plan with Stripe price ID
      await this.prisma.billingPlan.update({
        where: { id: plan.id },
        data: { stripePriceId: priceId }
      });
    }

    return { productId, priceId };
  }

  /**
   * Find or create promotion code
   */
  private async findOrCreatePromotionCode(code: string): Promise<Stripe.PromotionCode | null> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code }
    });

    if (!coupon || !coupon.isActive) {
      return null;
    }

    // Check if promotion code already exists in Stripe
    const promotionCodes = await this.stripe.promotionCodes.list({
      code,
      limit: 1,
    });

    if (promotionCodes.data.length > 0) {
      return promotionCodes.data[0];
    }

    // Create Stripe coupon if not exists
    const stripeCoupon = await this.stripe.coupons.create({
      id: code,
      name: coupon.name,
      percent_off: coupon.discountType === 'PERCENTAGE' ? 
        parseFloat(coupon.discountValue.toString()) : undefined,
      amount_off: coupon.discountType === 'FIXED_AMOUNT' ? 
        Math.round(parseFloat(coupon.discountValue.toString()) * 100) : undefined,
      currency: coupon.discountType === 'FIXED_AMOUNT' ? 'usd' : undefined,
      max_redemptions: coupon.maxRedemptions || undefined,
      metadata: {
        couponId: coupon.id,
      }
    });

    // Create promotion code
    const promotionCode = await this.stripe.promotionCodes.create({
      coupon: stripeCoupon.id,
      code,
    });

    return promotionCode;
  }

  /**
   * Map Stripe payment status to our enum
   */
  private mapStripeStatus(status: string): PaymentStatus {
    switch (status) {
      case 'succeeded':
        return 'SUCCEEDED';
      case 'processing':
        return 'PROCESSING';
      case 'requires_payment_method':
      case 'requires_confirmation':
      case 'requires_action':
        return 'PENDING';
      case 'canceled':
        return 'CANCELLED';
      default:
        return 'FAILED';
    }
  }

  /**
   * Map Stripe subscription status to our enum
   */
  private mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): any {
    switch (status) {
      case 'active':
        return 'ACTIVE';
      case 'past_due':
        return 'PAST_DUE';
      case 'unpaid':
        return 'UNPAID';
      case 'canceled':
        return 'CANCELLED';
      case 'incomplete':
      case 'incomplete_expired':
        return 'INCOMPLETE';
      case 'trialing':
        return 'TRIALING';
      default:
        return 'CANCELLED';
    }
  }

  /**
   * Map Stripe refund status
   */
  private mapStripeRefundStatus(status: string | null): any {
    switch (status) {
      case 'succeeded':
        return 'SUCCEEDED';
      case 'failed':
        return 'FAILED';
      case 'canceled':
        return 'CANCELLED';
      case 'pending':
      default:
        return 'PENDING';
    }
  }

  /**
   * Map refund reason to Stripe format
   */
  private mapRefundReason(reason?: string): Stripe.RefundCreateParams.Reason | undefined {
    switch (reason) {
      case 'DUPLICATE':
        return 'duplicate';
      case 'FRAUDULENT':
        return 'fraudulent';
      case 'REQUESTED_BY_CUSTOMER':
      default:
        return 'requested_by_customer';
    }
  }
}