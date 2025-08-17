import { PrismaClient } from '@prisma/client';
import { stripe, STRIPE_PRODUCTS, STRIPE_PRICES, stripeHelpers } from './stripe-client';
import type { BillingPlan, PlanTier, UsageTier, ResourceType } from '@prisma/client';
import type Stripe from 'stripe';

const prisma = new PrismaClient();

interface PricingCalculation {
  planCost: number;
  usageCost: number;
  totalCost: number;
  currency: string;
  breakdown: {
    plan: {
      name: string;
      tier: PlanTier;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    };
    usage: {
      resourceType: ResourceType;
      quantity: number;
      cost: number;
      unit: string;
    }[];
    discounts: {
      name: string;
      type: 'PERCENTAGE' | 'FIXED_AMOUNT';
      amount: number;
    }[];
    taxes: {
      name: string;
      rate: number;
      amount: number;
    }[];
  };
}

interface PlanComparison {
  tier: PlanTier;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  features: string[];
  limits: Record<string, any>;
  recommended: boolean;
  savings?: {
    amount: number;
    percentage: number;
  };
}

interface QuoteRequest {
  organizationId: string;
  planTier: PlanTier;
  quantity: number;
  billingCycle: 'MONTHLY' | 'ANNUAL';
  expectedUsage?: {
    resourceType: ResourceType;
    quantity: number;
  }[];
  customFeatures?: string[];
}

export class PricingService {
  /**
   * Initialize default billing plans
   */
  async initializeDefaultPlans(): Promise<void> {
    try {
      // Define default plans
      const defaultPlans = [
        {
          name: 'starter',
          displayName: 'Starter',
          description: 'Perfect for small teams getting started with IDP',
          tier: 'STARTER' as PlanTier,
          monthlyPrice: 50.00,
          annualPrice: 540.00, // 10% discount
          setupFee: 0,
          trialDays: 14,
          features: {
            maxDevelopers: 50,
            maxServices: 100,
            maxPlugins: 20,
            basicAnalytics: true,
            emailSupport: true,
            standardTemplates: true,
            apiAccess: 'basic'
          },
          limits: {
            apiCallsPerMonth: 10000,
            storageGB: 100,
            computeHours: 50
          },
          overage: {
            apiCalls: { rate: 0.0001, unit: 'call' },
            storage: { rate: 0.50, unit: 'GB' },
            compute: { rate: 5.00, unit: 'hour' }
          }
        },
        {
          name: 'professional',
          displayName: 'Professional',
          description: 'Advanced features for growing engineering teams',
          tier: 'PROFESSIONAL' as PlanTier,
          monthlyPrice: 125.00,
          annualPrice: 1350.00, // 10% discount
          setupFee: 0,
          trialDays: 14,
          features: {
            maxDevelopers: 500,
            maxServices: 1000,
            maxPlugins: 100,
            advancedAnalytics: true,
            prioritySupport: true,
            customTemplates: true,
            apiAccess: 'full',
            rbacControls: true,
            ssoIntegration: 'basic'
          },
          limits: {
            apiCallsPerMonth: 100000,
            storageGB: 1000,
            computeHours: 500
          },
          overage: {
            apiCalls: { rate: 0.00005, unit: 'call' },
            storage: { rate: 0.30, unit: 'GB' },
            compute: { rate: 3.00, unit: 'hour' }
          }
        },
        {
          name: 'enterprise',
          displayName: 'Enterprise',
          description: 'Full-featured solution for large enterprises',
          tier: 'ENTERPRISE' as PlanTier,
          monthlyPrice: 200.00,
          annualPrice: 2160.00, // 10% discount
          setupFee: 0,
          trialDays: 30,
          features: {
            maxDevelopers: -1, // unlimited
            maxServices: -1,
            maxPlugins: -1,
            enterpriseAnalytics: true,
            dedicatedSupport: true,
            customIntegrations: true,
            apiAccess: 'unlimited',
            advancedRBAC: true,
            ssoIntegration: 'advanced',
            complianceTools: true,
            slaGuarantees: true,
            auditLogging: true
          },
          limits: {
            apiCallsPerMonth: -1, // unlimited
            storageGB: -1,
            computeHours: -1
          },
          overage: {
            apiCalls: { rate: 0, unit: 'call' },
            storage: { rate: 0, unit: 'GB' },
            compute: { rate: 0, unit: 'hour' }
          }
        }
      ];

      // Create or update plans
      for (const planData of defaultPlans) {
        // Create Stripe product if it doesn't exist
        let stripeProduct: Stripe.Product;
        const existingProducts = await stripe.products.list({
          limit: 100
        });
        
        const existingProduct = existingProducts.data.find(
          p => p.metadata?.tier === planData.tier
        );
        
        if (existingProduct) {
          stripeProduct = existingProduct;
        } else {
          stripeProduct = await stripe.products.create({
            name: planData.displayName,
            description: planData.description,
            metadata: {
              tier: planData.tier,
              features: JSON.stringify(planData.features)
            }
          });
        }

        // Create Stripe prices for monthly and annual billing
        const monthlyPrice = await stripe.prices.create({
          product: stripeProduct.id,
          unit_amount: stripeHelpers.formatAmount(planData.monthlyPrice),
          currency: 'usd',
          recurring: { interval: 'month' },
          billing_scheme: 'per_unit',
          metadata: {
            tier: planData.tier,
            cycle: 'monthly'
          }
        });

        const annualPrice = await stripe.prices.create({
          product: stripeProduct.id,
          unit_amount: stripeHelpers.formatAmount(planData.annualPrice),
          currency: 'usd',
          recurring: { interval: 'year' },
          billing_scheme: 'per_unit',
          metadata: {
            tier: planData.tier,
            cycle: 'annual'
          }
        });

        // Create or update plan in database
        await prisma.billingPlan.upsert({
          where: { name: planData.name },
          create: {
            name: planData.name,
            displayName: planData.displayName,
            description: planData.description,
            tier: planData.tier,
            monthlyPrice: planData.monthlyPrice,
            annualPrice: planData.annualPrice,
            setupFee: planData.setupFee,
            trialDays: planData.trialDays,
            features: planData.features,
            limits: planData.limits,
            overage: planData.overage,
            stripeProductId: stripeProduct.id,
            stripePriceId: monthlyPrice.id,
            isActive: true,
            isPublic: true
          },
          update: {
            displayName: planData.displayName,
            description: planData.description,
            monthlyPrice: planData.monthlyPrice,
            annualPrice: planData.annualPrice,
            features: planData.features,
            limits: planData.limits,
            overage: planData.overage,
            stripeProductId: stripeProduct.id,
            stripePriceId: monthlyPrice.id
          }
        });

        // Create usage tiers for the plan
        const plan = await prisma.billingPlan.findUnique({
          where: { name: planData.name }
        });

        if (plan) {
          // Clear existing usage tiers
          await prisma.usageTier.deleteMany({
            where: { planId: plan.id }
          });

          // Create usage tiers based on plan limits and overage
          const usageTiers = [
            {
              resourceType: 'API_CALLS' as ResourceType,
              minUnits: 0,
              maxUnits: planData.limits.apiCallsPerMonth > 0 ? planData.limits.apiCallsPerMonth : null,
              pricePerUnit: 0,
              flatFee: 0
            },
            {
              resourceType: 'API_CALLS' as ResourceType,
              minUnits: planData.limits.apiCallsPerMonth || 0,
              maxUnits: null,
              pricePerUnit: planData.overage.apiCalls.rate,
              flatFee: 0
            },
            {
              resourceType: 'STORAGE_GB' as ResourceType,
              minUnits: 0,
              maxUnits: planData.limits.storageGB > 0 ? planData.limits.storageGB : null,
              pricePerUnit: 0,
              flatFee: 0
            },
            {
              resourceType: 'STORAGE_GB' as ResourceType,
              minUnits: planData.limits.storageGB || 0,
              maxUnits: null,
              pricePerUnit: planData.overage.storage.rate,
              flatFee: 0
            },
            {
              resourceType: 'COMPUTE_HOURS' as ResourceType,
              minUnits: 0,
              maxUnits: planData.limits.computeHours > 0 ? planData.limits.computeHours : null,
              pricePerUnit: 0,
              flatFee: 0
            },
            {
              resourceType: 'COMPUTE_HOURS' as ResourceType,
              minUnits: planData.limits.computeHours || 0,
              maxUnits: null,
              pricePerUnit: planData.overage.compute.rate,
              flatFee: 0
            }
          ].filter(tier => tier.minUnits !== null || tier.maxUnits !== null);

          await prisma.usageTier.createMany({
            data: usageTiers.map(tier => ({
              planId: plan.id,
              ...tier
            }))
          });
        }
      }

      console.log('Default billing plans initialized successfully');
    } catch (error) {
      throw new Error(`Failed to initialize default plans: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate pricing for a given configuration
   */
  async calculatePricing(
    planTier: PlanTier,
    quantity: number,
    billingCycle: 'MONTHLY' | 'ANNUAL' = 'MONTHLY',
    expectedUsage?: { resourceType: ResourceType; quantity: number }[],
    discountCode?: string
  ): Promise<PricingCalculation> {
    try {
      // Get billing plan
      const plan = await prisma.billingPlan.findFirst({
        where: { tier: planTier, isActive: true },
        include: { usageTiers: true }
      });

      if (!plan) {
        throw new Error(`Billing plan not found for tier: ${planTier}`);
      }

      // Calculate plan cost
      const unitPrice = billingCycle === 'ANNUAL' 
        ? parseFloat(plan.annualPrice.toString()) / 12 // Convert annual to monthly for comparison
        : parseFloat(plan.monthlyPrice.toString());
      
      const planCost = unitPrice * quantity;

      // Calculate usage cost
      let usageCost = 0;
      const usageBreakdown: {
        resourceType: ResourceType;
        quantity: number;
        cost: number;
        unit: string;
      }[] = [];

      if (expectedUsage) {
        for (const usage of expectedUsage) {
          const tiers = plan.usageTiers
            .filter(tier => tier.resourceType === usage.resourceType)
            .sort((a, b) => a.minUnits - b.minUnits);

          let remainingQuantity = usage.quantity;
          let resourceCost = 0;

          for (const tier of tiers) {
            if (remainingQuantity <= 0) break;

            const tierCapacity = tier.maxUnits ? tier.maxUnits - tier.minUnits : Infinity;
            const quantityInTier = Math.min(remainingQuantity, tierCapacity);
            
            if (usage.quantity >= tier.minUnits) {
              resourceCost += parseFloat(tier.flatFee.toString());
              resourceCost += quantityInTier * parseFloat(tier.pricePerUnit.toString());
              remainingQuantity -= quantityInTier;
            }
          }

          usageCost += resourceCost;
          usageBreakdown.push({
            resourceType: usage.resourceType,
            quantity: usage.quantity,
            cost: resourceCost,
            unit: this.getResourceUnit(usage.resourceType)
          });
        }
      }

      // Apply discounts
      const discounts: {
        name: string;
        type: 'PERCENTAGE' | 'FIXED_AMOUNT';
        amount: number;
      }[] = [];
      
      let totalBeforeDiscount = planCost + usageCost;
      let discountAmount = 0;

      if (discountCode) {
        const coupon = await prisma.coupon.findUnique({
          where: { 
            code: discountCode,
            isActive: true
          }
        });

        if (coupon && new Date() >= coupon.validFrom && new Date() <= coupon.validUntil) {
          if (coupon.discountType === 'PERCENTAGE') {
            discountAmount = totalBeforeDiscount * (parseFloat(coupon.discountValue.toString()) / 100);
          } else {
            discountAmount = Math.min(parseFloat(coupon.discountValue.toString()), totalBeforeDiscount);
          }

          discounts.push({
            name: coupon.name,
            type: coupon.discountType,
            amount: discountAmount
          });
        }
      }

      // Apply annual billing discount
      if (billingCycle === 'ANNUAL') {
        const annualDiscount = planCost * 0.1; // 10% discount for annual billing
        discountAmount += annualDiscount;
        discounts.push({
          name: 'Annual Billing Discount',
          type: 'PERCENTAGE',
          amount: annualDiscount
        });
      }

      const totalCost = Math.max(0, totalBeforeDiscount - discountAmount);

      return {
        planCost,
        usageCost,
        totalCost,
        currency: 'USD',
        breakdown: {
          plan: {
            name: plan.displayName,
            tier: plan.tier,
            quantity,
            unitPrice,
            totalPrice: planCost
          },
          usage: usageBreakdown,
          discounts,
          taxes: [] // Taxes would be calculated based on customer location
        }
      };
    } catch (error) {
      throw new Error(`Failed to calculate pricing: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get plan comparison
   */
  async getPlanComparison(
    billingCycle: 'MONTHLY' | 'ANNUAL' = 'MONTHLY'
  ): Promise<PlanComparison[]> {
    try {
      const plans = await prisma.billingPlan.findMany({
        where: { isActive: true, isPublic: true },
        orderBy: { monthlyPrice: 'asc' }
      });

      return plans.map((plan, index) => {
        const monthlyPrice = parseFloat(plan.monthlyPrice.toString());
        const annualPrice = parseFloat(plan.annualPrice.toString());
        const annualMonthlyCost = annualPrice / 12;
        const savings = monthlyPrice - annualMonthlyCost;
        const savingsPercentage = (savings / monthlyPrice) * 100;

        return {
          tier: plan.tier,
          name: plan.displayName,
          monthlyPrice,
          annualPrice,
          features: this.extractFeaturesList(plan.features),
          limits: plan.limits as Record<string, any>,
          recommended: plan.tier === 'PROFESSIONAL', // Professional is typically recommended
          savings: billingCycle === 'ANNUAL' && savings > 0 ? {
            amount: savings,
            percentage: savingsPercentage
          } : undefined
        };
      });
    } catch (error) {
      throw new Error(`Failed to get plan comparison: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a custom quote
   */
  async generateQuote(request: QuoteRequest): Promise<{
    quoteId: string;
    pricing: PricingCalculation;
    validUntil: Date;
    terms: string[];
  }> {
    try {
      const pricing = await this.calculatePricing(
        request.planTier,
        request.quantity,
        request.billingCycle,
        request.expectedUsage
      );

      // Generate quote ID
      const quoteId = `QUOTE-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      
      // Quote valid for 30 days
      const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      // Standard terms
      const terms = [
        'Quote valid for 30 days from issue date',
        'Prices are in USD and subject to applicable taxes',
        'Setup fees may apply for enterprise plans',
        'Usage charges are billed monthly in arrears',
        'All subscriptions include a free trial period',
        'Custom features may require additional development time',
        'Support level varies by plan tier'
      ];

      // Store quote in database (optional)
      // You might want to store quotes for tracking and follow-up

      return {
        quoteId,
        pricing,
        validUntil,
        terms
      };
    } catch (error) {
      throw new Error(`Failed to generate quote: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get usage-based pricing tiers for a resource type
   */
  async getUsagePricingTiers(resourceType: ResourceType): Promise<UsageTier[]> {
    try {
      const tiers = await prisma.usageTier.findMany({
        where: { resourceType },
        include: { plan: true },
        orderBy: { minUnits: 'asc' }
      });

      return tiers;
    } catch (error) {
      throw new Error(`Failed to get usage pricing tiers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate cost savings for annual vs monthly billing
   */
  async calculateAnnualSavings(
    planTier: PlanTier,
    quantity: number
  ): Promise<{
    monthlyTotal: number;
    annualTotal: number;
    savings: number;
    savingsPercentage: number;
  }> {
    try {
      const [monthlyPricing, annualPricing] = await Promise.all([
        this.calculatePricing(planTier, quantity, 'MONTHLY'),
        this.calculatePricing(planTier, quantity, 'ANNUAL')
      ]);

      const monthlyTotal = monthlyPricing.totalCost * 12;
      const annualTotal = annualPricing.totalCost * 12;
      const savings = monthlyTotal - annualTotal;
      const savingsPercentage = (savings / monthlyTotal) * 100;

      return {
        monthlyTotal,
        annualTotal,
        savings,
        savingsPercentage
      };
    } catch (error) {
      throw new Error(`Failed to calculate annual savings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get recommended plan for usage patterns
   */
  async getRecommendedPlan(
    teamSize: number,
    expectedUsage: { resourceType: ResourceType; quantity: number }[]
  ): Promise<{
    recommendedTier: PlanTier;
    reasoning: string[];
    alternativeOptions?: {
      tier: PlanTier;
      reason: string;
    }[];
  }> {
    try {
      const plans = await prisma.billingPlan.findMany({
        where: { isActive: true },
        include: { usageTiers: true },
        orderBy: { monthlyPrice: 'asc' }
      });

      const reasoning: string[] = [];
      let recommendedTier: PlanTier = 'STARTER';
      const alternativeOptions: { tier: PlanTier; reason: string }[] = [];

      // Analyze team size
      if (teamSize <= 50) {
        recommendedTier = 'STARTER';
        reasoning.push(`Starter plan supports up to 50 developers (you have ${teamSize})`);
      } else if (teamSize <= 500) {
        recommendedTier = 'PROFESSIONAL';
        reasoning.push(`Professional plan supports up to 500 developers (you have ${teamSize})`);
      } else {
        recommendedTier = 'ENTERPRISE';
        reasoning.push(`Enterprise plan supports unlimited developers (you have ${teamSize})`);
      }

      // Analyze usage patterns
      for (const usage of expectedUsage) {
        const starterPlan = plans.find(p => p.tier === 'STARTER');
        const professionalPlan = plans.find(p => p.tier === 'PROFESSIONAL');
        
        if (starterPlan && starterPlan.limits) {
          const limits = starterPlan.limits as any;
          const limitKey = this.getResourceLimitKey(usage.resourceType);
          
          if (limits[limitKey] && usage.quantity > limits[limitKey]) {
            if (recommendedTier === 'STARTER') {
              recommendedTier = 'PROFESSIONAL';
              reasoning.push(`Your expected ${usage.resourceType} usage (${usage.quantity}) exceeds Starter plan limits`);
            }
          }
        }

        if (professionalPlan && professionalPlan.limits) {
          const limits = professionalPlan.limits as any;
          const limitKey = this.getResourceLimitKey(usage.resourceType);
          
          if (limits[limitKey] && usage.quantity > limits[limitKey]) {
            recommendedTier = 'ENTERPRISE';
            reasoning.push(`Your expected ${usage.resourceType} usage (${usage.quantity}) exceeds Professional plan limits`);
          }
        }
      }

      // Add alternative options
      if (recommendedTier === 'PROFESSIONAL') {
        alternativeOptions.push({
          tier: 'STARTER',
          reason: 'More cost-effective if you can optimize usage'
        });
        alternativeOptions.push({
          tier: 'ENTERPRISE',
          reason: 'Better value for larger teams with advanced needs'
        });
      }

      return {
        recommendedTier,
        reasoning,
        alternativeOptions: alternativeOptions.length > 0 ? alternativeOptions : undefined
      };
    } catch (error) {
      throw new Error(`Failed to get recommended plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Helper method to extract features list from plan features JSON
   */
  private extractFeaturesList(features: any): string[] {
    const featureList: string[] = [];
    
    if (typeof features === 'object' && features !== null) {
      Object.entries(features).forEach(([key, value]) => {
        if (typeof value === 'boolean' && value) {
          featureList.push(this.humanizeFeatureName(key));
        } else if (typeof value === 'number' && value > 0) {
          featureList.push(`${this.humanizeFeatureName(key)}: ${value}`);
        } else if (typeof value === 'string') {
          featureList.push(`${this.humanizeFeatureName(key)}: ${value}`);
        } else if (value === -1) {
          featureList.push(`Unlimited ${this.humanizeFeatureName(key)}`);
        }
      });
    }
    
    return featureList;
  }

  /**
   * Helper method to humanize feature names
   */
  private humanizeFeatureName(key: string): string {
    const humanNames: Record<string, string> = {
      maxDevelopers: 'Developers',
      maxServices: 'Services',
      maxPlugins: 'Plugins',
      basicAnalytics: 'Basic Analytics',
      advancedAnalytics: 'Advanced Analytics',
      enterpriseAnalytics: 'Enterprise Analytics',
      emailSupport: 'Email Support',
      prioritySupport: 'Priority Support',
      dedicatedSupport: 'Dedicated Support',
      standardTemplates: 'Standard Templates',
      customTemplates: 'Custom Templates',
      customIntegrations: 'Custom Integrations',
      apiAccess: 'API Access',
      rbacControls: 'RBAC Controls',
      advancedRBAC: 'Advanced RBAC',
      ssoIntegration: 'SSO Integration',
      complianceTools: 'Compliance Tools',
      slaGuarantees: 'SLA Guarantees',
      auditLogging: 'Audit Logging'
    };
    
    return humanNames[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  }

  /**
   * Helper method to get resource unit
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
   * Helper method to get resource limit key
   */
  private getResourceLimitKey(resourceType: ResourceType): string {
    const limitKeys: Record<ResourceType, string> = {
      API_CALLS: 'apiCallsPerMonth',
      STORAGE_GB: 'storageGB',
      NETWORK_GB: 'networkGB',
      COMPUTE_HOURS: 'computeHours',
      CONTAINERS: 'maxContainers',
      USERS: 'maxDevelopers',
      PLUGINS: 'maxPlugins',
      DEPLOYMENTS: 'deploymentsPerMonth',
      BUILDS: 'buildsPerMonth',
      CUSTOM: 'customUnits'
    };
    
    return limitKeys[resourceType] || 'customUnits';
  }
}

export const pricingService = new PricingService();
