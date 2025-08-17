import { NextRequest, NextResponse } from 'next/server';
import { subscriptionService } from '@/lib/billing/subscription-service';
import { revenueOpsService } from '@/lib/billing/revenue-ops-service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get comprehensive revenue metrics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const organizationId = request.headers.get('x-organization-id'); // For organization-specific metrics

    let period: { start: Date; end: Date } | undefined;
    
    if (startDate && endDate) {
      period = {
        start: new Date(startDate),
        end: new Date(endDate)
      };
    }

    // Get subscription metrics
    const subscriptionMetrics = await subscriptionService.getSubscriptionMetrics(organizationId || undefined);
    
    // Get revenue health metrics
    const revenueHealth = await revenueOpsService.getRevenueHealthMetrics(
      period?.start,
      period?.end
    );
    
    // Get trial conversion metrics
    const trialMetrics = await revenueOpsService.getTrialConversionMetrics(
      period?.start,
      period?.end
    );

    // Calculate additional metrics
    const totalCustomers = await prisma.organization.count({
      where: {
        status: 'ACTIVE',
        createdAt: period ? {
          gte: period.start,
          lte: period.end
        } : undefined
      }
    });

    // Calculate month-over-month growth
    const currentMonth = new Date();
    const lastMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    const currentMonthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    
    const [currentMRR, lastMonthMRR] = await Promise.all([
      getMonthlyRecurringRevenue(currentMonthStart, currentMonth),
      getMonthlyRecurringRevenue(lastMonth, currentMonthStart)
    ]);
    
    const monthOverMonthGrowth = lastMonthMRR > 0 
      ? ((currentMRR - lastMonthMRR) / lastMonthMRR) * 100 
      : 0;

    // Calculate expansion revenue
    const expansionRevenue = await calculateExpansionRevenue(period?.start, period?.end);

    const metrics = {
      // Core revenue metrics
      monthlyRecurringRevenue: subscriptionMetrics.monthlyRecurringRevenue,
      annualRecurringRevenue: subscriptionMetrics.annualRecurringRevenue,
      averageRevenuePerUser: subscriptionMetrics.averageRevenuePerUser,
      
      // Health metrics
      churnRate: subscriptionMetrics.churnRate,
      conversionRate: trialMetrics.conversionRate,
      netRevenueRetention: revenueHealth.netRevenueRetention,
      customerLifetimeValue: revenueHealth.customerLifetimeValue,
      
      // Customer metrics
      totalCustomers,
      activeSubscriptions: subscriptionMetrics.activeSubscriptions,
      trialingCustomers: subscriptionMetrics.trialingSubscriptions,
      
      // Growth metrics
      monthOverMonthGrowth,
      expansionRevenue,
      
      // Additional insights
      billingIssues: revenueHealth.billingIssues,
      dunningSuccess: revenueHealth.dunningSuccess
    };

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Error fetching revenue metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch revenue metrics' },
      { status: 500 }
    );
  }
}

/**
 * Calculate monthly recurring revenue for a specific period
 */
async function getMonthlyRecurringRevenue(startDate: Date, endDate: Date): Promise<number> {
  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      currentPeriodStart: {
        lte: endDate
      },
      currentPeriodEnd: {
        gte: startDate
      }
    },
    include: {
      plan: true
    }
  });

  return subscriptions.reduce((total, subscription) => {
    const monthlyPrice = parseFloat(subscription.plan.monthlyPrice.toString());
    return total + (monthlyPrice * subscription.quantity);
  }, 0);
}

/**
 * Calculate expansion revenue from upgrades and additional seats
 */
async function calculateExpansionRevenue(startDate?: Date, endDate?: Date): Promise<number> {
  const whereClause: any = {
    action: {
      in: ['SUBSCRIPTION_UPGRADED', 'SUBSCRIPTION_SEATS_ADDED']
    }
  };

  if (startDate && endDate) {
    whereClause.timestamp = {
      gte: startDate,
      lte: endDate
    };
  }

  const expansionEvents = await prisma.auditLog.findMany({
    where: whereClause
  });

  // Calculate expansion revenue from audit logs metadata
  return expansionEvents.reduce((total, event) => {
    const metadata = event.metadata as any;
    const expansionAmount = metadata?.expansionAmount || 0;
    return total + expansionAmount;
  }, 0);
}
