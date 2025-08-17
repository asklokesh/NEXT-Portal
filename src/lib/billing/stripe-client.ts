import Stripe from 'stripe';
import { config } from '../env-validation';

// Initialize Stripe client
const stripeConfig = config.getStripeConfig();
export const stripe = new Stripe(stripeConfig.secretKey!, {
  apiVersion: '2024-06-20',
  typescript: true,
  maxNetworkRetries: 3,
});

// Stripe webhook configuration
export const STRIPE_WEBHOOK_EVENTS = [
  'customer.created',
  'customer.updated',
  'customer.deleted',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.created',
  'invoice.updated',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
  'invoice.finalized',
  'payment_intent.created',
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'payment_method.attached',
  'payment_method.detached',
  'setup_intent.succeeded',
  'checkout.session.completed',
  'billing_portal.session.created',
] as const;

export type StripeWebhookEvent = typeof STRIPE_WEBHOOK_EVENTS[number];

// Stripe product and price configurations
export const STRIPE_PRODUCTS = {
  STARTER: {
    name: 'Starter Plan',
    description: 'Perfect for small teams getting started with IDP',
    metadata: {
      tier: 'STARTER',
      maxDevelopers: '50',
      features: JSON.stringify([
        'Basic service catalog',
        'Template marketplace',
        'Standard plugins',
        'Email support',
        'Basic analytics'
      ])
    }
  },
  PROFESSIONAL: {
    name: 'Professional Plan',
    description: 'Advanced features for growing engineering teams',
    metadata: {
      tier: 'PROFESSIONAL',
      maxDevelopers: '500',
      features: JSON.stringify([
        'Advanced service catalog',
        'Custom templates',
        'Premium plugins',
        'Priority support',
        'Advanced analytics',
        'RBAC controls',
        'API access'
      ])
    }
  },
  ENTERPRISE: {
    name: 'Enterprise Plan',
    description: 'Full-featured solution for large enterprises',
    metadata: {
      tier: 'ENTERPRISE',
      maxDevelopers: 'unlimited',
      features: JSON.stringify([
        'Enterprise service catalog',
        'Custom integrations',
        'All plugins included',
        'Dedicated support',
        'Custom analytics',
        'Advanced RBAC',
        'SSO integration',
        'Compliance tools',
        'SLA guarantees'
      ])
    }
  }
} as const;

export const STRIPE_PRICES = {
  STARTER_MONTHLY: {
    unit_amount: 5000, // $50.00 per developer
    currency: 'usd',
    recurring: { interval: 'month' as const },
    billing_scheme: 'per_unit' as const,
    tiers_mode: 'graduated' as const,
    tiers: [
      { up_to: 10, unit_amount: 5000 },
      { up_to: 50, unit_amount: 4500 },
      { up_to: 'inf', unit_amount: 4000 }
    ]
  },
  PROFESSIONAL_MONTHLY: {
    unit_amount: 12500, // $125.00 per developer
    currency: 'usd',
    recurring: { interval: 'month' as const },
    billing_scheme: 'per_unit' as const,
    tiers_mode: 'graduated' as const,
    tiers: [
      { up_to: 50, unit_amount: 12500 },
      { up_to: 200, unit_amount: 11000 },
      { up_to: 'inf', unit_amount: 10000 }
    ]
  },
  ENTERPRISE_MONTHLY: {
    unit_amount: 20000, // $200.00 per developer
    currency: 'usd',
    recurring: { interval: 'month' as const },
    billing_scheme: 'per_unit' as const,
    tiers_mode: 'graduated' as const,
    tiers: [
      { up_to: 100, unit_amount: 20000 },
      { up_to: 500, unit_amount: 18000 },
      { up_to: 'inf', unit_amount: 15000 }
    ]
  }
} as const;

// Usage-based pricing for add-ons
export const USAGE_BASED_PRODUCTS = {
  API_CALLS: {
    name: 'API Calls',
    unit_label: 'call',
    tiers: [
      { up_to: 10000, unit_amount: 0 }, // Free tier
      { up_to: 100000, unit_amount: 10 }, // $0.10 per 1000 calls
      { up_to: 'inf', unit_amount: 5 } // $0.05 per 1000 calls
    ]
  },
  STORAGE: {
    name: 'Storage',
    unit_label: 'GB',
    tiers: [
      { up_to: 100, unit_amount: 0 }, // Free tier
      { up_to: 1000, unit_amount: 50 }, // $0.50 per GB
      { up_to: 'inf', unit_amount: 30 } // $0.30 per GB
    ]
  },
  COMPUTE: {
    name: 'Compute Hours',
    unit_label: 'hour',
    tiers: [
      { up_to: 100, unit_amount: 0 }, // Free tier
      { up_to: 1000, unit_amount: 500 }, // $5.00 per hour
      { up_to: 'inf', unit_amount: 300 } // $3.00 per hour
    ]
  },
  PLUGIN_INSTALLS: {
    name: 'Plugin Installations',
    unit_label: 'install',
    tiers: [
      { up_to: 50, unit_amount: 0 }, // Free tier
      { up_to: 200, unit_amount: 200 }, // $2.00 per install
      { up_to: 'inf', unit_amount: 100 } // $1.00 per install
    ]
  }
} as const;

// Marketplace revenue sharing
export const MARKETPLACE_CONFIG = {
  REVENUE_SHARE_PERCENTAGE: 25, // Platform takes 25%
  MINIMUM_PAYOUT_THRESHOLD: 10000, // $100.00
  PAYOUT_SCHEDULE: 'monthly' as const,
  SUPPORTED_PAYMENT_METHODS: ['card', 'bank_transfer', 'wire_transfer'] as const
} as const;

export class StripeError extends Error {
  constructor(
    message: string,
    public stripeError?: Stripe.errors.StripeError,
    public code?: string
  ) {
    super(message);
    this.name = 'StripeError';
  }
}

// Helper functions for Stripe operations
export const stripeHelpers = {
  // Format amount for Stripe (cents)
  formatAmount: (amount: number): number => Math.round(amount * 100),
  
  // Format amount from Stripe (dollars)
  parseAmount: (amount: number): number => amount / 100,
  
  // Generate idempotency key
  generateIdempotencyKey: (prefix: string): string => 
    `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2)}`,
  
  // Validate webhook signature
  validateWebhookSignature: (payload: string, signature: string, secret?: string) => {
    try {
      const webhookSecret = secret || stripeConfig.webhookSecret!;
      return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error) {
      throw new StripeError('Invalid webhook signature', error as Stripe.errors.StripeError);
    }
  },
  
  // Handle Stripe errors gracefully
  handleStripeError: (error: any): never => {
    if (error instanceof Stripe.errors.StripeError) {
      throw new StripeError(
        `Stripe error: ${error.message}`,
        error,
        error.code
      );
    }
    throw new StripeError('Unknown Stripe error occurred', error);
  }
};
