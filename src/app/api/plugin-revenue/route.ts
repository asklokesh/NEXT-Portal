import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

interface RevenueShare {
  pluginId: string;
  developerId: string;
  period: string;
  revenue: RevenueBreakdown;
  payouts: PayoutDetails;
  analytics: UsageAnalytics;
  status: 'pending' | 'processing' | 'paid' | 'held';
}

interface RevenueBreakdown {
  gross: number;
  platformFee: number;
  processingFee: number;
  taxes: number;
  net: number;
  currency: string;
}

interface PayoutDetails {
  method: 'stripe' | 'paypal' | 'bank_transfer' | 'crypto';
  account: string;
  schedule: 'daily' | 'weekly' | 'monthly';
  minimumPayout: number;
  nextPayoutDate: string;
  history: PayoutHistory[];
}

interface PayoutHistory {
  id: string;
  date: string;
  amount: number;
  status: 'completed' | 'pending' | 'failed';
  transactionId: string;
}

interface UsageAnalytics {
  installs: number;
  activeUsers: number;
  apiCalls: number;
  computeHours: number;
  storageGB: number;
  revenue: number;
}

interface PricingModel {
  type: 'free' | 'freemium' | 'subscription' | 'usage' | 'one-time' | 'enterprise';
  price: {
    amount: number;
    currency: string;
    interval?: 'month' | 'year' | 'once';
  };
  trial?: {
    days: number;
    features: string[];
  };
  tiers?: PricingTier[];
  commission: {
    percentage: number;
    minimum: number;
    maximum?: number;
  };
}

interface PricingTier {
  name: string;
  price: number;
  limits: {
    users?: number;
    apiCalls?: number;
    storage?: number;
    features?: string[];
  };
}

interface MarketplaceTransaction {
  id: string;
  pluginId: string;
  customerId: string;
  developerId: string;
  amount: number;
  currency: string;
  type: 'purchase' | 'subscription' | 'renewal' | 'upgrade' | 'refund';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  timestamp: string;
  commission: {
    platform: number;
    developer: number;
  };
  metadata: {
    plan?: string;
    period?: string;
    seats?: number;
    usage?: any;
  };
}

// Commission structure
const COMMISSION_TIERS = [
  { threshold: 0, rate: 0.30 },      // 30% for first $1000
  { threshold: 1000, rate: 0.25 },   // 25% for $1000-$10000
  { threshold: 10000, rate: 0.20 },  // 20% for $10000-$50000
  { threshold: 50000, rate: 0.15 },  // 15% for $50000+
];

// Calculate commission based on lifetime revenue
const calculateCommission = (lifetimeRevenue: number, transactionAmount: number): number => {
  let commission = 0;
  let remaining = transactionAmount;
  let currentRevenue = lifetimeRevenue;

  for (const tier of COMMISSION_TIERS) {
    if (currentRevenue >= tier.threshold) {
      const tierAmount = Math.min(remaining, (COMMISSION_TIERS[COMMISSION_TIERS.indexOf(tier) + 1]?.threshold || Infinity) - currentRevenue);
      commission += tierAmount * tier.rate;
      remaining -= tierAmount;
      currentRevenue += tierAmount;
      
      if (remaining <= 0) break;
    }
  }

  return Math.round(commission * 100) / 100;
};

// Revenue tracking store
const revenueStore = new Map<string, RevenueShare>();
const transactionStore = new Map<string, MarketplaceTransaction>();
const developerRevenue = new Map<string, number>(); // Track lifetime revenue per developer

// Process marketplace transaction
const processTransaction = async (transaction: Omit<MarketplaceTransaction, 'id' | 'timestamp' | 'commission'>) => {
  const transactionId = `txn_${crypto.randomBytes(12).toString('hex')}`;
  const lifetimeRevenue = developerRevenue.get(transaction.developerId) || 0;
  const commission = calculateCommission(lifetimeRevenue, transaction.amount);
  
  const processedTransaction: MarketplaceTransaction = {
    ...transaction,
    id: transactionId,
    timestamp: new Date().toISOString(),
    commission: {
      platform: commission,
      developer: transaction.amount - commission
    }
  };

  // Update developer lifetime revenue
  developerRevenue.set(transaction.developerId, lifetimeRevenue + transaction.amount);
  
  // Store transaction
  transactionStore.set(transactionId, processedTransaction);
  
  // Update revenue share for developer
  const period = new Date().toISOString().slice(0, 7); // YYYY-MM format
  const revenueKey = `${transaction.developerId}_${period}`;
  const existingRevenue = revenueStore.get(revenueKey);
  
  if (existingRevenue) {
    existingRevenue.revenue.gross += transaction.amount;
    existingRevenue.revenue.platformFee += commission;
    existingRevenue.revenue.net += processedTransaction.commission.developer;
    existingRevenue.analytics.revenue += processedTransaction.commission.developer;
  } else {
    const newRevenue: RevenueShare = {
      pluginId: transaction.pluginId,
      developerId: transaction.developerId,
      period,
      revenue: {
        gross: transaction.amount,
        platformFee: commission,
        processingFee: transaction.amount * 0.029 + 0.30, // Stripe fees
        taxes: 0, // Would calculate based on location
        net: processedTransaction.commission.developer,
        currency: transaction.currency
      },
      payouts: {
        method: 'stripe',
        account: `${transaction.developerId}@stripe`,
        schedule: 'monthly',
        minimumPayout: 100,
        nextPayoutDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        history: []
      },
      analytics: {
        installs: 0,
        activeUsers: 0,
        apiCalls: 0,
        computeHours: 0,
        storageGB: 0,
        revenue: processedTransaction.commission.developer
      },
      status: 'pending'
    };
    revenueStore.set(revenueKey, newRevenue);
  }
  
  return processedTransaction;
};

// Process payout
const processPayout = async (developerId: string, amount: number, method: PayoutDetails['method']) => {
  const payoutId = `payout_${crypto.randomBytes(12).toString('hex')}`;
  
  // Simulate payment processing
  const payout: PayoutHistory = {
    id: payoutId,
    date: new Date().toISOString(),
    amount,
    status: 'completed',
    transactionId: `stripe_tr_${crypto.randomBytes(8).toString('hex')}`
  };
  
  // Update revenue shares
  const developerRevenues = Array.from(revenueStore.values()).filter(r => r.developerId === developerId);
  
  // Distribute payout across pending revenues
  let remainingAmount = amount;
  for (const revenue of developerRevenues) {
    if (revenue.status === 'pending' && remainingAmount > 0) {
      const payoutAmount = Math.min(remainingAmount, revenue.revenue.net);
      revenue.payouts.history.push({
        ...payout,
        amount: payoutAmount
      });
      remainingAmount -= payoutAmount;
      
      if (remainingAmount === 0) {
        revenue.status = 'paid';
      }
    }
  }
  
  return payout;
};

// Analytics aggregation
const aggregateAnalytics = (developerId: string, period: string) => {
  const transactions = Array.from(transactionStore.values()).filter(
    t => t.developerId === developerId && t.timestamp.startsWith(period)
  );
  
  return {
    totalTransactions: transactions.length,
    totalRevenue: transactions.reduce((sum, t) => sum + t.commission.developer, 0),
    averageTransactionValue: transactions.length > 0 
      ? transactions.reduce((sum, t) => sum + t.amount, 0) / transactions.length 
      : 0,
    topPlugins: Array.from(new Set(transactions.map(t => t.pluginId))).map(pluginId => ({
      pluginId,
      revenue: transactions.filter(t => t.pluginId === pluginId).reduce((sum, t) => sum + t.commission.developer, 0),
      transactions: transactions.filter(t => t.pluginId === pluginId).length
    })).sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    revenueByType: {
      purchase: transactions.filter(t => t.type === 'purchase').reduce((sum, t) => sum + t.commission.developer, 0),
      subscription: transactions.filter(t => t.type === 'subscription').reduce((sum, t) => sum + t.commission.developer, 0),
      renewal: transactions.filter(t => t.type === 'renewal').reduce((sum, t) => sum + t.commission.developer, 0),
      upgrade: transactions.filter(t => t.type === 'upgrade').reduce((sum, t) => sum + t.commission.developer, 0)
    },
    refunds: transactions.filter(t => t.type === 'refund').length,
    conversionRate: 0.15, // Mock conversion rate
    churnRate: 0.05 // Mock churn rate
  };
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'process_transaction': {
        const { pluginId, customerId, developerId, amount, currency, type, metadata } = body;
        
        const transaction = await processTransaction({
          pluginId,
          customerId,
          developerId,
          amount,
          currency: currency || 'USD',
          type: type || 'purchase',
          status: 'completed',
          metadata: metadata || {}
        });
        
        return NextResponse.json({
          success: true,
          transaction,
          commission: {
            platform: transaction.commission.platform,
            developer: transaction.commission.developer,
            rate: (transaction.commission.platform / amount * 100).toFixed(1) + '%'
          }
        });
      }

      case 'process_payout': {
        const { developerId, amount, method } = body;
        
        const payout = await processPayout(developerId, amount, method || 'stripe');
        
        return NextResponse.json({
          success: true,
          payout,
          message: `Payout of $${amount} processed successfully`
        });
      }

      case 'update_pricing': {
        const { pluginId, pricingModel } = body;
        
        // Store pricing model (would be in database)
        return NextResponse.json({
          success: true,
          pluginId,
          pricingModel,
          estimatedRevenue: pricingModel.price.amount * 100 * (1 - COMMISSION_TIERS[0].rate) // Rough estimate
        });
      }

      case 'simulate_revenue': {
        const { pluginId, developerId, months = 12 } = body;
        
        const simulation = [];
        let cumulativeRevenue = 0;
        
        for (let i = 0; i < months; i++) {
          const monthlyTransactions = Math.floor(Math.random() * 100) + 10;
          const avgTransactionValue = Math.random() * 100 + 20;
          const monthlyRevenue = monthlyTransactions * avgTransactionValue;
          const commission = calculateCommission(cumulativeRevenue, monthlyRevenue);
          const developerRevenue = monthlyRevenue - commission;
          
          cumulativeRevenue += monthlyRevenue;
          
          simulation.push({
            month: i + 1,
            transactions: monthlyTransactions,
            grossRevenue: monthlyRevenue,
            platformFee: commission,
            netRevenue: developerRevenue,
            commissionRate: (commission / monthlyRevenue * 100).toFixed(1) + '%',
            cumulativeRevenue
          });
        }
        
        return NextResponse.json({
          success: true,
          simulation,
          summary: {
            totalGrossRevenue: cumulativeRevenue,
            totalPlatformFees: simulation.reduce((sum, m) => sum + m.platformFee, 0),
            totalNetRevenue: simulation.reduce((sum, m) => sum + m.netRevenue, 0),
            averageCommissionRate: (simulation.reduce((sum, m) => sum + parseFloat(m.commissionRate), 0) / months).toFixed(1) + '%'
          }
        });
      }

      case 'revenue_split': {
        const { amount, developerId } = body;
        const lifetimeRevenue = developerRevenue.get(developerId) || 0;
        const commission = calculateCommission(lifetimeRevenue, amount);
        
        return NextResponse.json({
          success: true,
          split: {
            gross: amount,
            platformFee: commission,
            platformPercentage: (commission / amount * 100).toFixed(1) + '%',
            developerRevenue: amount - commission,
            developerPercentage: ((amount - commission) / amount * 100).toFixed(1) + '%',
            tier: COMMISSION_TIERS.find(t => lifetimeRevenue >= t.threshold)?.rate || COMMISSION_TIERS[0].rate,
            lifetimeRevenue
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
    console.error('Revenue API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process revenue request'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'developer_dashboard': {
        const developerId = searchParams.get('developerId');
        const period = searchParams.get('period') || new Date().toISOString().slice(0, 7);
        
        if (!developerId) {
          return NextResponse.json({
            success: false,
            error: 'Developer ID required'
          }, { status: 400 });
        }
        
        const revenueKey = `${developerId}_${period}`;
        const revenue = revenueStore.get(revenueKey);
        const analytics = aggregateAnalytics(developerId, period);
        const lifetimeRevenue = developerRevenue.get(developerId) || 0;
        
        return NextResponse.json({
          success: true,
          dashboard: {
            currentPeriod: revenue || {
              revenue: { gross: 0, platformFee: 0, net: 0, currency: 'USD' },
              status: 'no_data'
            },
            analytics,
            lifetimeRevenue,
            currentTier: COMMISSION_TIERS.find(t => lifetimeRevenue >= t.threshold)?.rate || COMMISSION_TIERS[0].rate,
            nextTier: COMMISSION_TIERS.find(t => lifetimeRevenue < t.threshold),
            payoutSchedule: revenue?.payouts || {
              method: 'stripe',
              schedule: 'monthly',
              minimumPayout: 100,
              nextPayoutDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            }
          }
        });
      }

      case 'transaction_history': {
        const developerId = searchParams.get('developerId');
        const limit = parseInt(searchParams.get('limit') || '100');
        
        const transactions = Array.from(transactionStore.values())
          .filter(t => !developerId || t.developerId === developerId)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, limit);
        
        return NextResponse.json({
          success: true,
          transactions,
          summary: {
            total: transactions.length,
            totalRevenue: transactions.reduce((sum, t) => sum + t.commission.developer, 0),
            totalPlatformFees: transactions.reduce((sum, t) => sum + t.commission.platform, 0)
          }
        });
      }

      case 'marketplace_stats': {
        const allTransactions = Array.from(transactionStore.values());
        const totalRevenue = allTransactions.reduce((sum, t) => sum + t.amount, 0);
        const platformRevenue = allTransactions.reduce((sum, t) => sum + t.commission.platform, 0);
        const developerRevenue = allTransactions.reduce((sum, t) => sum + t.commission.developer, 0);
        
        return NextResponse.json({
          success: true,
          stats: {
            totalTransactions: allTransactions.length,
            totalGrossRevenue: totalRevenue,
            platformRevenue,
            developerRevenue,
            averageCommissionRate: totalRevenue > 0 ? (platformRevenue / totalRevenue * 100).toFixed(1) + '%' : '0%',
            topDevelopers: Array.from(developerRevenue.entries())
              .sort((a, b) => b[1] - a[1])
              .slice(0, 10)
              .map(([developerId, revenue]) => ({ developerId, revenue })),
            revenueByMonth: {} // Would aggregate by month
          }
        });
      }

      case 'commission_tiers': {
        return NextResponse.json({
          success: true,
          tiers: COMMISSION_TIERS.map(tier => ({
            threshold: tier.threshold,
            rate: (tier.rate * 100).toFixed(0) + '%',
            description: tier.threshold === 0 
              ? `First $${COMMISSION_TIERS[1].threshold}` 
              : tier.threshold === COMMISSION_TIERS[COMMISSION_TIERS.length - 1].threshold
              ? `$${tier.threshold}+`
              : `$${tier.threshold} - $${COMMISSION_TIERS[COMMISSION_TIERS.indexOf(tier) + 1].threshold}`
          }))
        });
      }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Revenue API GET error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch revenue data'
    }, { status: 500 });
  }
}