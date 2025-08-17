import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe, stripeHelpers, STRIPE_WEBHOOK_EVENTS } from '@/lib/billing/stripe-client';
import { subscriptionService } from '@/lib/billing/subscription-service';
import { PrismaClient } from '@prisma/client';
import { config } from '@/lib/env-validation';
import type Stripe from 'stripe';

const prisma = new PrismaClient();

// Webhook endpoint configuration
export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Handle Stripe webhooks
 * This endpoint processes various Stripe events to keep our database in sync
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headersList = headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      console.error('Missing Stripe signature');
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    // Validate webhook signature
    let event: Stripe.Event;
    try {
      event = stripeHelpers.validateWebhookSignature(
        body,
        signature
      );
    } catch (error) {
      console.error('Webhook signature validation failed:', error);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Log the event for debugging
    console.log(`Received Stripe webhook: ${event.type}`, {
      eventId: event.id,
      created: event.created,
      livemode: event.livemode
    });

    // Check if we've already processed this event
    const existingEvent = await prisma.billingEvent.findUnique({
      where: { stripeEventId: event.id }
    });

    if (existingEvent && existingEvent.processed) {
      console.log(`Event ${event.id} already processed, skipping`);
      return NextResponse.json({ received: true });
    }

    // Store the event for idempotency and audit trail
    await prisma.billingEvent.upsert({
      where: { stripeEventId: event.id },
      create: {
        stripeEventId: event.id,
        eventType: event.type,
        eventData: event.data as any,
        processed: false
      },
      update: {
        eventData: event.data as any,
        processed: false
      }
    });

    // Process the event based on its type
    try {
      await processWebhookEvent(event);
      
      // Mark event as processed
      await prisma.billingEvent.update({
        where: { stripeEventId: event.id },
        data: {
          processed: true,
          processedAt: new Date()
        }
      });
      
      console.log(`Successfully processed event ${event.id}`);
    } catch (processingError) {
      // Log processing error but don't fail the webhook
      console.error(`Error processing event ${event.id}:`, processingError);
      
      await prisma.billingEvent.update({
        where: { stripeEventId: event.id },
        data: {
          error: processingError instanceof Error ? processingError.message : 'Unknown error'
        }
      });
      
      // Return success to prevent Stripe from retrying
      // We'll handle failed events separately
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

/**
 * Process individual webhook events
 */
async function processWebhookEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    // Customer events
    case 'customer.created':
      await handleCustomerCreated(event.data.object as Stripe.Customer);
      break;
    
    case 'customer.updated':
      await handleCustomerUpdated(event.data.object as Stripe.Customer);
      break;
    
    case 'customer.deleted':
      await handleCustomerDeleted(event.data.object as Stripe.Customer);
      break;

    // Subscription events
    case 'customer.subscription.created':
      await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
      break;
    
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
      break;
    
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;

    // Invoice events
    case 'invoice.created':
      await handleInvoiceCreated(event.data.object as Stripe.Invoice);
      break;
    
    case 'invoice.updated':
      await handleInvoiceUpdated(event.data.object as Stripe.Invoice);
      break;
    
    case 'invoice.payment_succeeded':
      await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
      break;
    
    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
      break;
    
    case 'invoice.finalized':
      await handleInvoiceFinalized(event.data.object as Stripe.Invoice);
      break;

    // Payment events
    case 'payment_intent.succeeded':
      await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
      break;
    
    case 'payment_intent.payment_failed':
      await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
      break;

    // Payment method events
    case 'payment_method.attached':
      await handlePaymentMethodAttached(event.data.object as Stripe.PaymentMethod);
      break;
    
    case 'payment_method.detached':
      await handlePaymentMethodDetached(event.data.object as Stripe.PaymentMethod);
      break;

    // Checkout events
    case 'checkout.session.completed':
      await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }
}

// Event handlers

async function handleCustomerCreated(customer: Stripe.Customer): Promise<void> {
  console.log(`Customer created: ${customer.id}`);
  
  if (customer.metadata?.organizationId) {
    await prisma.organization.updateMany({
      where: { id: customer.metadata.organizationId },
      data: { stripeCustomerId: customer.id }
    });
  }
}

async function handleCustomerUpdated(customer: Stripe.Customer): Promise<void> {
  console.log(`Customer updated: ${customer.id}`);
  
  const organization = await prisma.organization.findFirst({
    where: { stripeCustomerId: customer.id }
  });
  
  if (organization) {
    await prisma.organization.update({
      where: { id: organization.id },
      data: {
        billingEmail: customer.email || organization.billingEmail,
        billingAddress: customer.address || organization.billingAddress,
        defaultPaymentMethod: customer.invoice_settings?.default_payment_method as string || organization.defaultPaymentMethod
      }
    });
  }
}

async function handleCustomerDeleted(customer: Stripe.Customer): Promise<void> {
  console.log(`Customer deleted: ${customer.id}`);
  
  await prisma.organization.updateMany({
    where: { stripeCustomerId: customer.id },
    data: { stripeCustomerId: null }
  });
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
  console.log(`Subscription created: ${subscription.id}`);
  
  // Sync subscription from Stripe
  await subscriptionService.syncSubscriptionFromStripe(subscription.id);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  console.log(`Subscription updated: ${subscription.id}`);
  
  // Sync subscription from Stripe
  await subscriptionService.syncSubscriptionFromStripe(subscription.id);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  console.log(`Subscription deleted: ${subscription.id}`);
  
  const dbSubscription = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscription.id }
  });
  
  if (dbSubscription) {
    await prisma.subscription.update({
      where: { id: dbSubscription.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        updatedAt: new Date()
      }
    });
  }
}

async function handleInvoiceCreated(invoice: Stripe.Invoice): Promise<void> {
  console.log(`Invoice created: ${invoice.id}`);
  
  const organization = await prisma.organization.findFirst({
    where: { stripeCustomerId: invoice.customer as string }
  });
  
  if (organization) {
    const existingInvoice = await prisma.invoice.findFirst({
      where: { stripeInvoiceId: invoice.id }
    });
    
    if (!existingInvoice) {
      await prisma.invoice.create({
        data: {
          organizationId: organization.id,
          invoiceNumber: invoice.number || `INV-${Date.now()}`,
          stripeInvoiceId: invoice.id,
          status: mapInvoiceStatus(invoice.status),
          dueDate: new Date(invoice.due_date! * 1000),
          periodStart: new Date(invoice.period_start * 1000),
          periodEnd: new Date(invoice.period_end * 1000),
          subtotal: stripeHelpers.parseAmount(invoice.subtotal),
          tax: stripeHelpers.parseAmount(invoice.tax || 0),
          total: stripeHelpers.parseAmount(invoice.total),
          currency: invoice.currency.toUpperCase(),
          metadata: {
            stripeInvoiceUrl: invoice.hosted_invoice_url,
            stripePdfUrl: invoice.invoice_pdf
          }
        }
      });
      
      // Create line items
      if (invoice.lines && invoice.lines.data.length > 0) {
        const dbInvoice = await prisma.invoice.findFirst({
          where: { stripeInvoiceId: invoice.id }
        });
        
        if (dbInvoice) {
          const lineItems = invoice.lines.data.map(line => ({
            invoiceId: dbInvoice.id,
            description: line.description || 'Subscription charge',
            quantity: line.quantity || 1,
            unitPrice: stripeHelpers.parseAmount(line.price?.unit_amount || 0),
            amount: stripeHelpers.parseAmount(line.amount)
          }));
          
          await prisma.invoiceLineItem.createMany({
            data: lineItems
          });
        }
      }
    }
  }
}

async function handleInvoiceUpdated(invoice: Stripe.Invoice): Promise<void> {
  console.log(`Invoice updated: ${invoice.id}`);
  
  const dbInvoice = await prisma.invoice.findFirst({
    where: { stripeInvoiceId: invoice.id }
  });
  
  if (dbInvoice) {
    await prisma.invoice.update({
      where: { id: dbInvoice.id },
      data: {
        status: mapInvoiceStatus(invoice.status),
        subtotal: stripeHelpers.parseAmount(invoice.subtotal),
        tax: stripeHelpers.parseAmount(invoice.tax || 0),
        total: stripeHelpers.parseAmount(invoice.total),
        paidAt: invoice.status === 'paid' && invoice.status_transitions?.paid_at 
          ? new Date(invoice.status_transitions.paid_at * 1000) 
          : null,
        voidedAt: invoice.status === 'void' && invoice.status_transitions?.voided_at 
          ? new Date(invoice.status_transitions.voided_at * 1000) 
          : null,
        updatedAt: new Date()
      }
    });
  }
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  console.log(`Invoice payment succeeded: ${invoice.id}`);
  
  const dbInvoice = await prisma.invoice.findFirst({
    where: { stripeInvoiceId: invoice.id }
  });
  
  if (dbInvoice) {
    await prisma.invoice.update({
      where: { id: dbInvoice.id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        updatedAt: new Date()
      }
    });
    
    // Create payment record
    await prisma.payment.create({
      data: {
        organizationId: dbInvoice.organizationId,
        invoiceId: dbInvoice.id,
        amount: dbInvoice.total,
        currency: dbInvoice.currency,
        status: 'SUCCEEDED',
        method: 'CARD', // Default, could be enhanced to detect actual method
        processedAt: new Date()
      }
    });
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  console.log(`Invoice payment failed: ${invoice.id}`);
  
  const dbInvoice = await prisma.invoice.findFirst({
    where: { stripeInvoiceId: invoice.id }
  });
  
  if (dbInvoice) {
    await prisma.invoice.update({
      where: { id: dbInvoice.id },
      data: {
        status: 'OPEN',
        updatedAt: new Date()
      }
    });
    
    // Create billing alert
    await prisma.billingAlert.create({
      data: {
        organizationId: dbInvoice.organizationId,
        type: 'PAYMENT_FAILED',
        threshold: dbInvoice.total,
        currentValue: 0,
        message: `Payment failed for invoice ${dbInvoice.invoiceNumber}`,
        severity: 'CRITICAL'
      }
    });
  }
}

async function handleInvoiceFinalized(invoice: Stripe.Invoice): Promise<void> {
  console.log(`Invoice finalized: ${invoice.id}`);
  
  // Update invoice status when finalized
  await handleInvoiceUpdated(invoice);
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  console.log(`Payment intent succeeded: ${paymentIntent.id}`);
  
  // Handle one-time payments or setup payments
  if (paymentIntent.metadata?.organizationId) {
    await prisma.payment.create({
      data: {
        organizationId: paymentIntent.metadata.organizationId,
        stripePaymentId: paymentIntent.id,
        amount: stripeHelpers.parseAmount(paymentIntent.amount),
        currency: paymentIntent.currency.toUpperCase(),
        status: 'SUCCEEDED',
        method: 'CARD', // Could be enhanced to detect actual method
        processedAt: new Date()
      }
    });
  }
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  console.log(`Payment intent failed: ${paymentIntent.id}`);
  
  if (paymentIntent.metadata?.organizationId) {
    await prisma.payment.create({
      data: {
        organizationId: paymentIntent.metadata.organizationId,
        stripePaymentId: paymentIntent.id,
        amount: stripeHelpers.parseAmount(paymentIntent.amount),
        currency: paymentIntent.currency.toUpperCase(),
        status: 'FAILED',
        method: 'CARD',
        failureReason: paymentIntent.last_payment_error?.message || 'Payment failed'
      }
    });
  }
}

async function handlePaymentMethodAttached(paymentMethod: Stripe.PaymentMethod): Promise<void> {
  console.log(`Payment method attached: ${paymentMethod.id}`);
  
  if (paymentMethod.customer) {
    const organization = await prisma.organization.findFirst({
      where: { stripeCustomerId: paymentMethod.customer as string }
    });
    
    if (organization && !organization.defaultPaymentMethod) {
      await prisma.organization.update({
        where: { id: organization.id },
        data: { defaultPaymentMethod: paymentMethod.id }
      });
    }
  }
}

async function handlePaymentMethodDetached(paymentMethod: Stripe.PaymentMethod): Promise<void> {
  console.log(`Payment method detached: ${paymentMethod.id}`);
  
  // Remove as default if it was the default
  await prisma.organization.updateMany({
    where: { defaultPaymentMethod: paymentMethod.id },
    data: { defaultPaymentMethod: null }
  });
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  console.log(`Checkout session completed: ${session.id}`);
  
  // Handle successful checkout sessions for marketplace purchases or subscription signups
  if (session.metadata?.organizationId) {
    if (session.mode === 'subscription' && session.subscription) {
      // Subscription checkout completed - sync subscription
      await subscriptionService.syncSubscriptionFromStripe(session.subscription as string);
    } else if (session.mode === 'payment' && session.payment_intent) {
      // One-time payment completed - handle marketplace purchase
      await handleMarketplacePurchase(session);
    }
  }
}

async function handleMarketplacePurchase(session: Stripe.Checkout.Session): Promise<void> {
  if (!session.metadata?.marketplacePluginId || !session.metadata?.organizationId) {
    return;
  }
  
  const marketplacePlugin = await prisma.marketplacePlugin.findUnique({
    where: { id: session.metadata.marketplacePluginId }
  });
  
  if (marketplacePlugin) {
    const amount = session.amount_total ? stripeHelpers.parseAmount(session.amount_total) : 0;
    const commission = amount * 0.25; // 25% platform fee
    const netAmount = amount - commission;
    
    await prisma.pluginSale.create({
      data: {
        marketplacePluginId: marketplacePlugin.id,
        buyerOrgId: session.metadata.organizationId,
        amount,
        commission,
        netAmount,
        currency: session.currency?.toUpperCase() || 'USD',
        status: 'COMPLETED',
        paymentId: session.payment_intent as string
      }
    });
  }
}

// Helper functions

function mapInvoiceStatus(stripeStatus: Stripe.Invoice.Status | null): 'DRAFT' | 'OPEN' | 'PAID' | 'VOID' | 'UNCOLLECTIBLE' {
  const statusMap: Record<string, 'DRAFT' | 'OPEN' | 'PAID' | 'VOID' | 'UNCOLLECTIBLE'> = {
    draft: 'DRAFT',
    open: 'OPEN',
    paid: 'PAID',
    void: 'VOID',
    uncollectible: 'UNCOLLECTIBLE'
  };
  
  return statusMap[stripeStatus || 'draft'] || 'DRAFT';
}
