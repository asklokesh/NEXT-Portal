import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2023-10-16'
});

interface UsageMetrics {
  pluginId: string;
  period: string;
  computeHours: number;
  storageGB: number;
  networkGB: number;
  apiCalls: number;
  containers: number;
  users: number;
}

interface CostBreakdown {
  compute: number;
  storage: number;
  network: number;
  apiCalls: number;
  containerManagement: number;
  support: number;
  total: number;
  currency: string;
}

interface BillingPlan {
  id: string;
  name: string;
  tier: 'free' | 'starter' | 'professional' | 'enterprise';
  monthlyPrice: number;
  annualPrice: number;
  limits: {
    computeHours: number;
    storageGB: number;
    networkGB: number;
    apiCalls: number;
    containers: number;
    users: number;
  };
  features: string[];
  overage: {
    computePerHour: number;
    storagePerGB: number;
    networkPerGB: number;
    apiCallsPer1000: number;
    containerPerMonth: number;
  };
}

// Pricing configuration
const PRICING = {
  compute: {
    perHour: 0.05, // $0.05 per compute hour
    tiers: [
      { threshold: 100, price: 0.05 },
      { threshold: 1000, price: 0.04 },
      { threshold: 10000, price: 0.03 }
    ]
  },
  storage: {
    perGB: 0.10, // $0.10 per GB per month
    tiers: [
      { threshold: 50, price: 0.10 },
      { threshold: 500, price: 0.08 },
      { threshold: 5000, price: 0.06 }
    ]
  },
  network: {
    perGB: 0.08, // $0.08 per GB transferred
    tiers: [
      { threshold: 100, price: 0.08 },
      { threshold: 1000, price: 0.06 },
      { threshold: 10000, price: 0.04 }
    ]
  },
  apiCalls: {
    per1000: 0.001, // $0.001 per 1000 API calls
    tiers: [
      { threshold: 1000000, price: 0.001 },
      { threshold: 10000000, price: 0.0008 },
      { threshold: 100000000, price: 0.0005 }
    ]
  },
  containers: {
    perMonth: 5.00, // $5.00 per container per month
    tiers: [
      { threshold: 5, price: 5.00 },
      { threshold: 25, price: 4.00 },
      { threshold: 100, price: 3.00 }
    ]
  }
};

// Billing plans
const BILLING_PLANS: BillingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    tier: 'free',
    monthlyPrice: 0,
    annualPrice: 0,
    limits: {
      computeHours: 10,
      storageGB: 1,
      networkGB: 5,
      apiCalls: 100000,
      containers: 1,
      users: 3
    },
    features: [
      'Basic plugin installation',
      'Community support',
      'Public plugins only',
      'Basic monitoring'
    ],
    overage: {
      computePerHour: 0.10,
      storagePerGB: 0.20,
      networkPerGB: 0.15,
      apiCallsPer1000: 0.002,
      containerPerMonth: 10.00
    }
  },
  {
    id: 'starter',
    name: 'Starter',
    tier: 'starter',
    monthlyPrice: 49,
    annualPrice: 490,
    limits: {
      computeHours: 100,
      storageGB: 10,
      networkGB: 50,
      apiCalls: 1000000,
      containers: 5,
      users: 10
    },
    features: [
      'All Free features',
      'Private plugins',
      'Email support',
      'Advanced monitoring',
      'Backup & restore',
      'Version management'
    ],
    overage: {
      computePerHour: 0.08,
      storagePerGB: 0.15,
      networkPerGB: 0.12,
      apiCallsPer1000: 0.0015,
      containerPerMonth: 8.00
    }
  },
  {
    id: 'professional',
    name: 'Professional',
    tier: 'professional',
    monthlyPrice: 199,
    annualPrice: 1990,
    limits: {
      computeHours: 500,
      storageGB: 50,
      networkGB: 250,
      apiCalls: 10000000,
      containers: 25,
      users: 50
    },
    features: [
      'All Starter features',
      'Priority support',
      'Custom plugins',
      'CI/CD integration',
      'Performance profiling',
      'Security scanning',
      'SLA guarantee'
    ],
    overage: {
      computePerHour: 0.06,
      storagePerGB: 0.12,
      networkPerGB: 0.10,
      apiCallsPer1000: 0.001,
      containerPerMonth: 6.00
    }
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tier: 'enterprise',
    monthlyPrice: 999,
    annualPrice: 9990,
    limits: {
      computeHours: 2500,
      storageGB: 500,
      networkGB: 2500,
      apiCalls: 100000000,
      containers: 100,
      users: -1 // Unlimited
    },
    features: [
      'All Professional features',
      'Dedicated support',
      'Custom SLA',
      'Multi-tenant isolation',
      'Advanced security',
      'Compliance reports',
      'Custom integrations',
      'Training & onboarding'
    ],
    overage: {
      computePerHour: 0.04,
      storagePerGB: 0.08,
      networkPerGB: 0.06,
      apiCallsPer1000: 0.0005,
      containerPerMonth: 4.00
    }
  }
];

// Calculate tiered pricing
const calculateTieredPrice = (usage: number, tiers: { threshold: number; price: number }[]): number => {
  let totalCost = 0;
  let remainingUsage = usage;
  let previousThreshold = 0;

  for (const tier of tiers) {
    const tierUsage = Math.min(remainingUsage, tier.threshold - previousThreshold);
    totalCost += tierUsage * tier.price;
    remainingUsage -= tierUsage;
    previousThreshold = tier.threshold;
    
    if (remainingUsage <= 0) break;
  }

  // Apply the last tier price for any remaining usage
  if (remainingUsage > 0) {
    const lastTier = tiers[tiers.length - 1];
    totalCost += remainingUsage * lastTier.price;
  }

  return totalCost;
};

// Calculate cost breakdown
const calculateCostBreakdown = (metrics: UsageMetrics, plan?: BillingPlan): CostBreakdown => {
  let compute = 0;
  let storage = 0;
  let network = 0;
  let apiCalls = 0;
  let containerManagement = 0;

  if (plan) {
    // Calculate overage costs based on plan limits
    const computeOverage = Math.max(0, metrics.computeHours - plan.limits.computeHours);
    const storageOverage = Math.max(0, metrics.storageGB - plan.limits.storageGB);
    const networkOverage = Math.max(0, metrics.networkGB - plan.limits.networkGB);
    const apiOverage = Math.max(0, metrics.apiCalls - plan.limits.apiCalls);
    const containerOverage = Math.max(0, metrics.containers - plan.limits.containers);

    compute = computeOverage * plan.overage.computePerHour;
    storage = storageOverage * plan.overage.storagePerGB;
    network = networkOverage * plan.overage.networkPerGB;
    apiCalls = (apiOverage / 1000) * plan.overage.apiCallsPer1000;
    containerManagement = containerOverage * plan.overage.containerPerMonth;
  } else {
    // Pay-as-you-go pricing with tiered rates
    compute = calculateTieredPrice(metrics.computeHours, PRICING.compute.tiers);
    storage = calculateTieredPrice(metrics.storageGB, PRICING.storage.tiers);
    network = calculateTieredPrice(metrics.networkGB, PRICING.network.tiers);
    apiCalls = calculateTieredPrice(metrics.apiCalls / 1000, PRICING.apiCalls.tiers);
    containerManagement = calculateTieredPrice(metrics.containers, PRICING.containers.tiers);
  }

  const support = plan ? 0 : (compute + storage + network) * 0.1; // 10% for support on pay-as-you-go
  const total = compute + storage + network + apiCalls + containerManagement + support;

  return {
    compute: Math.round(compute * 100) / 100,
    storage: Math.round(storage * 100) / 100,
    network: Math.round(network * 100) / 100,
    apiCalls: Math.round(apiCalls * 100) / 100,
    containerManagement: Math.round(containerManagement * 100) / 100,
    support: Math.round(support * 100) / 100,
    total: Math.round(total * 100) / 100,
    currency: 'USD'
  };
};

// Generate invoice
const generateInvoice = async (
  organizationId: string,
  period: string,
  breakdown: CostBreakdown,
  plan?: BillingPlan
) => {
  const invoice = {
    id: `inv_${Date.now()}`,
    organizationId,
    period,
    createdAt: new Date().toISOString(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    status: 'pending',
    plan: plan?.name || 'Pay-as-you-go',
    planCharge: plan?.monthlyPrice || 0,
    usageCharges: breakdown,
    subtotal: (plan?.monthlyPrice || 0) + breakdown.total,
    tax: 0, // Would calculate based on location
    total: 0,
    currency: 'USD',
    paymentMethod: 'card',
    lineItems: [
      {
        description: plan ? `${plan.name} Plan - Monthly` : 'Base Usage',
        quantity: 1,
        unitPrice: plan?.monthlyPrice || 0,
        amount: plan?.monthlyPrice || 0
      },
      ...(breakdown.compute > 0 ? [{
        description: 'Compute Usage (hours)',
        quantity: breakdown.compute / PRICING.compute.perHour,
        unitPrice: PRICING.compute.perHour,
        amount: breakdown.compute
      }] : []),
      ...(breakdown.storage > 0 ? [{
        description: 'Storage (GB/month)',
        quantity: breakdown.storage / PRICING.storage.perGB,
        unitPrice: PRICING.storage.perGB,
        amount: breakdown.storage
      }] : []),
      ...(breakdown.network > 0 ? [{
        description: 'Network Transfer (GB)',
        quantity: breakdown.network / PRICING.network.perGB,
        unitPrice: PRICING.network.perGB,
        amount: breakdown.network
      }] : []),
      ...(breakdown.apiCalls > 0 ? [{
        description: 'API Calls (per 1000)',
        quantity: breakdown.apiCalls / PRICING.apiCalls.per1000 * 1000,
        unitPrice: PRICING.apiCalls.per1000,
        amount: breakdown.apiCalls
      }] : []),
      ...(breakdown.containerManagement > 0 ? [{
        description: 'Container Management',
        quantity: breakdown.containerManagement / PRICING.containers.perMonth,
        unitPrice: PRICING.containers.perMonth,
        amount: breakdown.containerManagement
      }] : [])
    ]
  };

  // Calculate tax (simplified - would use actual tax API)
  invoice.tax = Math.round(invoice.subtotal * 0.08 * 100) / 100; // 8% tax
  invoice.total = Math.round((invoice.subtotal + invoice.tax) * 100) / 100;

  return invoice;
};

// Create Stripe checkout session
const createCheckoutSession = async (invoice: any, customerEmail: string) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: invoice.lineItems.map((item: any) => ({
        price_data: {
          currency: invoice.currency.toLowerCase(),
          product_data: {
            name: item.description,
          },
          unit_amount: Math.round(item.unitPrice * 100), // Convert to cents
        },
        quantity: Math.round(item.quantity),
      })),
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_URL}/billing/cancel`,
      customer_email: customerEmail,
      metadata: {
        invoiceId: invoice.id,
        organizationId: invoice.organizationId,
        period: invoice.period
      }
    });

    return session;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
};

// Usage forecasting
const forecastUsage = (historicalUsage: UsageMetrics[], months: number = 3): UsageMetrics[] => {
  if (historicalUsage.length < 2) {
    return [];
  }

  // Simple linear regression for each metric
  const forecast: UsageMetrics[] = [];
  const lastUsage = historicalUsage[historicalUsage.length - 1];
  
  // Calculate growth rates
  const growthRates = {
    computeHours: 0,
    storageGB: 0,
    networkGB: 0,
    apiCalls: 0,
    containers: 0,
    users: 0
  };

  // Calculate average growth rate
  for (let i = 1; i < historicalUsage.length; i++) {
    const prev = historicalUsage[i - 1];
    const curr = historicalUsage[i];
    
    growthRates.computeHours += (curr.computeHours - prev.computeHours) / prev.computeHours;
    growthRates.storageGB += (curr.storageGB - prev.storageGB) / prev.storageGB;
    growthRates.networkGB += (curr.networkGB - prev.networkGB) / prev.networkGB;
    growthRates.apiCalls += (curr.apiCalls - prev.apiCalls) / prev.apiCalls;
    growthRates.containers += (curr.containers - prev.containers) / Math.max(prev.containers, 1);
    growthRates.users += (curr.users - prev.users) / Math.max(prev.users, 1);
  }

  // Average growth rates
  const periods = historicalUsage.length - 1;
  Object.keys(growthRates).forEach(key => {
    growthRates[key as keyof typeof growthRates] /= periods;
  });

  // Generate forecast
  for (let month = 1; month <= months; month++) {
    const forecastedUsage: UsageMetrics = {
      pluginId: lastUsage.pluginId,
      period: `Forecast Month ${month}`,
      computeHours: Math.round(lastUsage.computeHours * Math.pow(1 + growthRates.computeHours, month)),
      storageGB: Math.round(lastUsage.storageGB * Math.pow(1 + growthRates.storageGB, month) * 10) / 10,
      networkGB: Math.round(lastUsage.networkGB * Math.pow(1 + growthRates.networkGB, month) * 10) / 10,
      apiCalls: Math.round(lastUsage.apiCalls * Math.pow(1 + growthRates.apiCalls, month)),
      containers: Math.round(lastUsage.containers * Math.pow(1 + growthRates.containers, month)),
      users: Math.round(lastUsage.users * Math.pow(1 + growthRates.users, month))
    };
    
    forecast.push(forecastedUsage);
  }

  return forecast;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'calculate_cost': {
        const { metrics, planId } = body;
        const plan = BILLING_PLANS.find(p => p.id === planId);
        const breakdown = calculateCostBreakdown(metrics, plan);
        
        return NextResponse.json({
          success: true,
          breakdown,
          plan: plan || null,
          recommendations: plan ? [] : BILLING_PLANS.filter(p => 
            p.monthlyPrice < breakdown.total && p.tier !== 'free'
          ).map(p => ({
            plan: p.name,
            monthlySavings: breakdown.total - p.monthlyPrice,
            annualSavings: (breakdown.total * 12) - p.annualPrice
          }))
        });
      }

      case 'generate_invoice': {
        const { organizationId, period, metrics, planId, customerEmail } = body;
        const plan = BILLING_PLANS.find(p => p.id === planId);
        const breakdown = calculateCostBreakdown(metrics, plan);
        const invoice = await generateInvoice(organizationId, period, breakdown, plan);
        
        // Create Stripe checkout session if requested
        let checkoutUrl = null;
        if (body.createCheckout && customerEmail) {
          const session = await createCheckoutSession(invoice, customerEmail);
          checkoutUrl = session.url;
        }
        
        return NextResponse.json({
          success: true,
          invoice,
          checkoutUrl
        });
      }

      case 'forecast_usage': {
        const { historicalUsage, months = 3 } = body;
        const forecast = forecastUsage(historicalUsage, months);
        const forecastCosts = forecast.map(usage => ({
          period: usage.period,
          usage,
          cost: calculateCostBreakdown(usage)
        }));
        
        return NextResponse.json({
          success: true,
          forecast: forecastCosts,
          totalProjectedCost: forecastCosts.reduce((sum, f) => sum + f.cost.total, 0)
        });
      }

      case 'get_plans': {
        return NextResponse.json({
          success: true,
          plans: BILLING_PLANS,
          pricing: PRICING
        });
      }

      case 'upgrade_plan': {
        const { organizationId, currentPlanId, newPlanId } = body;
        const currentPlan = BILLING_PLANS.find(p => p.id === currentPlanId);
        const newPlan = BILLING_PLANS.find(p => p.id === newPlanId);
        
        if (!newPlan) {
          return NextResponse.json({
            success: false,
            error: 'Invalid plan'
          }, { status: 400 });
        }
        
        // Calculate prorated amount
        const daysInMonth = 30;
        const daysRemaining = Math.ceil((new Date().getDate() / daysInMonth) * daysInMonth);
        const proratedAmount = (newPlan.monthlyPrice - (currentPlan?.monthlyPrice || 0)) * (daysRemaining / daysInMonth);
        
        return NextResponse.json({
          success: true,
          upgrade: {
            from: currentPlan?.name || 'Free',
            to: newPlan.name,
            proratedAmount: Math.round(proratedAmount * 100) / 100,
            effectiveDate: new Date().toISOString(),
            nextBillingDate: new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000).toISOString()
          }
        });
      }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Billing API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process billing request'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'usage_report': {
        const organizationId = searchParams.get('organizationId');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        
        // This would fetch from database
        const mockUsage: UsageMetrics = {
          pluginId: 'all',
          period: `${startDate} to ${endDate}`,
          computeHours: 450,
          storageGB: 25,
          networkGB: 120,
          apiCalls: 5000000,
          containers: 12,
          users: 25
        };
        
        const breakdown = calculateCostBreakdown(mockUsage);
        
        return NextResponse.json({
          success: true,
          usage: mockUsage,
          cost: breakdown,
          period: {
            start: startDate,
            end: endDate
          }
        });
      }

      case 'billing_history': {
        const organizationId = searchParams.get('organizationId');
        
        // Mock billing history - would fetch from database
        const history = [
          {
            invoiceId: 'inv_001',
            date: '2024-01-01',
            amount: 249.00,
            status: 'paid',
            plan: 'Professional'
          },
          {
            invoiceId: 'inv_002',
            date: '2024-02-01',
            amount: 267.50,
            status: 'paid',
            plan: 'Professional'
          },
          {
            invoiceId: 'inv_003',
            date: '2024-03-01',
            amount: 299.00,
            status: 'pending',
            plan: 'Professional'
          }
        ];
        
        return NextResponse.json({
          success: true,
          history,
          totalSpent: history.filter(h => h.status === 'paid').reduce((sum, h) => sum + h.amount, 0)
        });
      }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Billing API GET error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch billing data'
    }, { status: 500 });
  }
}