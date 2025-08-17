import { EventEmitter } from 'events';
import { prisma } from '@/lib/prisma';

interface LaunchMetric {
  id: string;
  name: string;
  value: number;
  target: number;
  unit: string;
  category: LaunchMetricCategory;
  timestamp: Date;
  metadata?: any;
}

enum LaunchMetricCategory {
  CUSTOMER_ACQUISITION = 'customer_acquisition',
  CONVERSION = 'conversion',
  REVENUE = 'revenue',
  ENGAGEMENT = 'engagement',
  CHURN = 'churn',
  PERFORMANCE = 'performance',
  SATISFACTION = 'satisfaction'
}

interface CustomerAcquisitionMetrics {
  newSignups: number;
  signupRate: number;
  organicSignups: number;
  paidSignups: number;
  referralSignups: number;
  conversionFunnel: {
    visitors: number;
    signups: number;
    activations: number;
    conversions: number;
  };
  customerAcquisitionCost: number;
  lifetimeValue: number;
  paybackPeriod: number;
}

interface ConversionMetrics {
  trialToFreeConversion: number;
  freeToTrialConversion: number;
  trialToPaidConversion: number;
  freeToPaidConversion: number;
  upsellConversion: number;
  crossSellConversion: number;
  averageTrialLength: number;
  conversionTimeToValue: number;
}

interface RevenueMetrics {
  mrr: number;
  arr: number;
  revenue: number;
  revenueGrowthRate: number;
  averageRevenuePerUser: number;
  averageRevenuePerAccount: number;
  expansionRevenue: number;
  contractionRevenue: number;
  netRevenueRetention: number;
  grossRevenueRetention: number;
}

interface EngagementMetrics {
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  sessionDuration: number;
  sessionsPerUser: number;
  featureAdoption: Record<string, number>;
  userStickiness: number;
  timeToFirstValue: number;
  productQualifiedLeads: number;
}

interface ChurnMetrics {
  customerChurnRate: number;
  revenueChurnRate: number;
  userChurnRate: number;
  churnReasons: Record<string, number>;
  churnPredictionScore: number;
  atRiskCustomers: number;
  churnSaveRate: number;
  averageLifespan: number;
}

interface PerformanceMetrics {
  uptime: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  errorRate: number;
  throughput: number;
  globalAvailability: Record<string, number>;
  slaCompliance: number;
  incidentCount: number;
  meanTimeToResolve: number;
}

interface SatisfactionMetrics {
  nps: number;
  csat: number;
  ces: number; // Customer Effort Score
  supportTicketVolume: number;
  avgResolutionTime: number;
  firstContactResolution: number;
  customerHealthScore: number;
  productMarketFit: number;
}

export class LaunchMetricsEngine extends EventEmitter {
  private metrics: Map<string, LaunchMetric> = new Map();
  private targets: Map<string, number> = new Map();
  private alertThresholds: Map<string, { warning: number; critical: number }> = new Map();
  private collectionJobs: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
    this.initializeTargets();
    this.initializeAlertThresholds();
    this.startMetricsCollection();
  }

  private initializeTargets() {
    // Customer Acquisition Targets
    this.targets.set('daily_signups', 50);
    this.targets.set('signup_conversion_rate', 0.05); // 5%
    this.targets.set('cac', 100); // $100 CAC
    this.targets.set('ltv_cac_ratio', 3.0); // 3:1 LTV:CAC ratio
    
    // Conversion Targets
    this.targets.set('trial_to_paid_conversion', 0.20); // 20%
    this.targets.set('free_to_paid_conversion', 0.05); // 5%
    this.targets.set('time_to_value', 7); // 7 days
    
    // Revenue Targets
    this.targets.set('mrr_growth_rate', 0.20); // 20% monthly growth
    this.targets.set('net_revenue_retention', 1.10); // 110% NRR
    this.targets.set('arpu', 50); // $50 ARPU
    
    // Engagement Targets
    this.targets.set('dau', 1000);
    this.targets.set('wau', 3000);
    this.targets.set('mau', 10000);
    this.targets.set('user_stickiness', 0.33); // DAU/MAU ratio
    
    // Churn Targets
    this.targets.set('monthly_churn_rate', 0.05); // 5% monthly churn
    this.targets.set('revenue_churn_rate', 0.03); // 3% revenue churn
    
    // Performance Targets
    this.targets.set('uptime', 0.9999); // 99.99%
    this.targets.set('avg_response_time', 100); // 100ms
    this.targets.set('error_rate', 0.001); // 0.1%
    
    // Satisfaction Targets
    this.targets.set('nps', 50);
    this.targets.set('csat', 4.5); // out of 5
    this.targets.set('customer_health_score', 80);
  }

  private initializeAlertThresholds() {
    // Customer Acquisition Alerts
    this.alertThresholds.set('daily_signups', { warning: 30, critical: 20 });
    this.alertThresholds.set('signup_conversion_rate', { warning: 0.03, critical: 0.02 });
    this.alertThresholds.set('cac', { warning: 150, critical: 200 });
    
    // Conversion Alerts
    this.alertThresholds.set('trial_to_paid_conversion', { warning: 0.15, critical: 0.10 });
    this.alertThresholds.set('free_to_paid_conversion', { warning: 0.03, critical: 0.02 });
    
    // Churn Alerts
    this.alertThresholds.set('monthly_churn_rate', { warning: 0.08, critical: 0.12 });
    this.alertThresholds.set('revenue_churn_rate', { warning: 0.05, critical: 0.08 });
    
    // Performance Alerts
    this.alertThresholds.set('uptime', { warning: 0.999, critical: 0.995 });
    this.alertThresholds.set('avg_response_time', { warning: 200, critical: 500 });
    this.alertThresholds.set('error_rate', { warning: 0.005, critical: 0.01 });
    
    // Satisfaction Alerts
    this.alertThresholds.set('nps', { warning: 30, critical: 10 });
    this.alertThresholds.set('csat', { warning: 3.5, critical: 3.0 });
  }

  private startMetricsCollection() {
    // Collect customer acquisition metrics every 5 minutes
    this.collectionJobs.set('customer_acquisition', setInterval(
      () => this.collectCustomerAcquisitionMetrics(),
      5 * 60 * 1000
    ));

    // Collect conversion metrics every 15 minutes
    this.collectionJobs.set('conversion', setInterval(
      () => this.collectConversionMetrics(),
      15 * 60 * 1000
    ));

    // Collect revenue metrics every hour
    this.collectionJobs.set('revenue', setInterval(
      () => this.collectRevenueMetrics(),
      60 * 60 * 1000
    ));

    // Collect engagement metrics every 5 minutes
    this.collectionJobs.set('engagement', setInterval(
      () => this.collectEngagementMetrics(),
      5 * 60 * 1000
    ));

    // Collect churn metrics every hour
    this.collectionJobs.set('churn', setInterval(
      () => this.collectChurnMetrics(),
      60 * 60 * 1000
    ));

    // Collect performance metrics every minute
    this.collectionJobs.set('performance', setInterval(
      () => this.collectPerformanceMetrics(),
      60 * 1000
    ));

    // Collect satisfaction metrics every 30 minutes
    this.collectionJobs.set('satisfaction', setInterval(
      () => this.collectSatisfactionMetrics(),
      30 * 60 * 1000
    ));
  }

  async collectCustomerAcquisitionMetrics(): Promise<CustomerAcquisitionMetrics> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get new signups today and in the last 30 days
    const [todaySignups, monthlySignups, totalUsers] = await Promise.all([
      prisma.user.count({
        where: { createdAt: { gte: today } }
      }),
      prisma.user.count({
        where: { createdAt: { gte: thirtyDaysAgo } }
      }),
      prisma.user.count()
    ]);

    // Get signup sources
    const signupSources = await prisma.user.groupBy({
      by: ['provider'],
      _count: { id: true },
      where: { createdAt: { gte: thirtyDaysAgo } }
    });

    // Calculate conversion funnel (mock data for now)
    const visitors = todaySignups * 20; // Assume 5% conversion rate
    const activations = Math.floor(todaySignups * 0.8); // 80% activation rate
    const conversions = Math.floor(todaySignups * 0.15); // 15% conversion rate

    // Calculate acquisition costs (mock data)
    const totalMarketingSpend = 10000; // $10k monthly marketing spend
    const cac = monthlySignups > 0 ? totalMarketingSpend / monthlySignups : 0;
    const ltv = 500; // $500 estimated LTV
    const paybackPeriod = cac > 0 ? ltv / cac : 0;

    const metrics: CustomerAcquisitionMetrics = {
      newSignups: todaySignups,
      signupRate: visitors > 0 ? todaySignups / visitors : 0,
      organicSignups: signupSources.find(s => s.provider === 'github')?._count.id || 0,
      paidSignups: signupSources.find(s => s.provider === 'google')?._count.id || 0,
      referralSignups: 0, // TODO: Track referral signups
      conversionFunnel: {
        visitors,
        signups: todaySignups,
        activations,
        conversions
      },
      customerAcquisitionCost: cac,
      lifetimeValue: ltv,
      paybackPeriod
    };

    // Store individual metrics
    await this.storeMetric('daily_signups', todaySignups, LaunchMetricCategory.CUSTOMER_ACQUISITION);
    await this.storeMetric('signup_conversion_rate', metrics.signupRate, LaunchMetricCategory.CUSTOMER_ACQUISITION);
    await this.storeMetric('cac', cac, LaunchMetricCategory.CUSTOMER_ACQUISITION);
    await this.storeMetric('ltv_cac_ratio', cac > 0 ? ltv / cac : 0, LaunchMetricCategory.CUSTOMER_ACQUISITION);

    this.emit('customer-acquisition-metrics', metrics);
    return metrics;
  }

  async collectConversionMetrics(): Promise<ConversionMetrics> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get subscription data
    const [trialSubscriptions, paidSubscriptions, totalUsers] = await Promise.all([
      prisma.subscription.count({
        where: { 
          status: 'TRIALING',
          createdAt: { gte: thirtyDaysAgo }
        }
      }),
      prisma.subscription.count({
        where: { 
          status: 'ACTIVE',
          createdAt: { gte: thirtyDaysAgo }
        }
      }),
      prisma.user.count({
        where: { createdAt: { gte: thirtyDaysAgo } }
      })
    ]);

    // Calculate conversion rates
    const trialToPaidConversion = trialSubscriptions > 0 ? paidSubscriptions / trialSubscriptions : 0;
    const freeToTrialConversion = totalUsers > 0 ? trialSubscriptions / totalUsers : 0;
    const freeToPaidConversion = totalUsers > 0 ? paidSubscriptions / totalUsers : 0;

    // Calculate average trial length
    const completedTrials = await prisma.subscription.findMany({
      where: {
        trialEnd: { lte: now },
        createdAt: { gte: thirtyDaysAgo }
      },
      select: {
        trialStart: true,
        trialEnd: true
      }
    });

    const avgTrialLength = completedTrials.length > 0
      ? completedTrials.reduce((sum, trial) => {
          if (trial.trialStart && trial.trialEnd) {
            return sum + (trial.trialEnd.getTime() - trial.trialStart.getTime()) / (24 * 60 * 60 * 1000);
          }
          return sum;
        }, 0) / completedTrials.length
      : 14; // Default 14 days

    const metrics: ConversionMetrics = {
      trialToFreeConversion: 0, // TODO: Implement free tier tracking
      freeToTrialConversion,
      trialToPaidConversion,
      freeToPaidConversion,
      upsellConversion: 0.05, // Mock data
      crossSellConversion: 0.03, // Mock data
      averageTrialLength: avgTrialLength,
      conversionTimeToValue: 3 // Mock: 3 days average time to value
    };

    // Store key conversion metrics
    await this.storeMetric('trial_to_paid_conversion', trialToPaidConversion, LaunchMetricCategory.CONVERSION);
    await this.storeMetric('free_to_paid_conversion', freeToPaidConversion, LaunchMetricCategory.CONVERSION);
    await this.storeMetric('time_to_value', metrics.conversionTimeToValue, LaunchMetricCategory.CONVERSION);

    this.emit('conversion-metrics', metrics);
    return metrics;
  }

  async collectRevenueMetrics(): Promise<RevenueMetrics> {
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(currentMonth.getTime() - 30 * 24 * 60 * 60 * 1000);
    const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    // Calculate MRR from active subscriptions
    const activeSubscriptions = await prisma.subscription.findMany({
      where: { status: 'ACTIVE' },
      include: { plan: true }
    });

    const mrr = activeSubscriptions.reduce((sum, sub) => {
      if (sub.plan) {
        // Convert to monthly revenue
        const monthlyRevenue = parseFloat(sub.plan.monthlyPrice.toString());
        return sum + (monthlyRevenue * sub.quantity);
      }
      return sum;
    }, 0);

    const arr = mrr * 12;

    // Calculate revenue for current month
    const currentMonthRevenue = await this.calculateMonthlyRevenue(currentMonth);
    const lastMonthRevenue = await this.calculateMonthlyRevenue(lastMonth);

    const revenueGrowthRate = lastMonthRevenue > 0 
      ? (currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue 
      : 0;

    // Calculate ARPU and ARPA
    const activeCustomers = await prisma.user.count({
      where: {
        subscriptions: {
          some: { status: 'ACTIVE' }
        }
      }
    });

    const arpu = activeCustomers > 0 ? mrr / activeCustomers : 0;
    const arpa = activeSubscriptions.length > 0 ? mrr / activeSubscriptions.length : 0;

    // Calculate expansion and contraction revenue (mock for now)
    const expansionRevenue = mrr * 0.15; // 15% expansion
    const contractionRevenue = mrr * 0.05; // 5% contraction

    const metrics: RevenueMetrics = {
      mrr,
      arr,
      revenue: currentMonthRevenue,
      revenueGrowthRate,
      averageRevenuePerUser: arpu,
      averageRevenuePerAccount: arpa,
      expansionRevenue,
      contractionRevenue,
      netRevenueRetention: 1.10, // Mock: 110% NRR
      grossRevenueRetention: 0.95 // Mock: 95% GRR
    };

    // Store key revenue metrics
    await this.storeMetric('mrr', mrr, LaunchMetricCategory.REVENUE);
    await this.storeMetric('arr', arr, LaunchMetricCategory.REVENUE);
    await this.storeMetric('mrr_growth_rate', revenueGrowthRate, LaunchMetricCategory.REVENUE);
    await this.storeMetric('net_revenue_retention', metrics.netRevenueRetention, LaunchMetricCategory.REVENUE);
    await this.storeMetric('arpu', arpu, LaunchMetricCategory.REVENUE);

    this.emit('revenue-metrics', metrics);
    return metrics;
  }

  async collectEngagementMetrics(): Promise<EngagementMetrics> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Count active users (based on last login)
    const [dau, wau, mau] = await Promise.all([
      prisma.user.count({
        where: { lastLogin: { gte: yesterday } }
      }),
      prisma.user.count({
        where: { lastLogin: { gte: weekAgo } }
      }),
      prisma.user.count({
        where: { lastLogin: { gte: monthAgo } }
      })
    ]);

    // Calculate user stickiness (DAU/MAU)
    const userStickiness = mau > 0 ? dau / mau : 0;

    // Get session data from audit logs
    const sessions = await prisma.auditLog.groupBy({
      by: ['userId'],
      _count: { id: true },
      where: {
        timestamp: { gte: today },
        action: 'login'
      }
    });

    const sessionsPerUser = sessions.length > 0 
      ? sessions.reduce((sum, s) => sum + s._count.id, 0) / sessions.length 
      : 0;

    // Mock feature adoption data
    const featureAdoption = {
      'plugin-management': 0.75,
      'service-catalog': 0.65,
      'templates': 0.45,
      'monitoring': 0.35,
      'cost-management': 0.25
    };

    const metrics: EngagementMetrics = {
      dailyActiveUsers: dau,
      weeklyActiveUsers: wau,
      monthlyActiveUsers: mau,
      sessionDuration: 25, // Mock: 25 minutes average session
      sessionsPerUser,
      featureAdoption,
      userStickiness,
      timeToFirstValue: 2, // Mock: 2 days to first value
      productQualifiedLeads: Math.floor(mau * 0.15) // 15% of MAU are PQLs
    };

    // Store key engagement metrics
    await this.storeMetric('dau', dau, LaunchMetricCategory.ENGAGEMENT);
    await this.storeMetric('wau', wau, LaunchMetricCategory.ENGAGEMENT);
    await this.storeMetric('mau', mau, LaunchMetricCategory.ENGAGEMENT);
    await this.storeMetric('user_stickiness', userStickiness, LaunchMetricCategory.ENGAGEMENT);

    this.emit('engagement-metrics', metrics);
    return metrics;
  }

  async collectChurnMetrics(): Promise<ChurnMetrics> {
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(currentMonth.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Calculate customer churn
    const startOfMonthCustomers = await prisma.user.count({
      where: { 
        createdAt: { lt: currentMonth },
        subscriptions: {
          some: { status: 'ACTIVE' }
        }
      }
    });

    const churnedCustomers = await prisma.user.count({
      where: {
        createdAt: { lt: currentMonth },
        subscriptions: {
          every: { 
            OR: [
              { status: 'CANCELLED' },
              { cancelledAt: { gte: currentMonth } }
            ]
          }
        }
      }
    });

    const customerChurnRate = startOfMonthCustomers > 0 
      ? churnedCustomers / startOfMonthCustomers 
      : 0;

    // Calculate revenue churn
    const startOfMonthMRR = await this.calculateMonthlyRevenue(lastMonth);
    const churnedMRR = await this.calculateChurnedRevenue(currentMonth);
    const revenueChurnRate = startOfMonthMRR > 0 ? churnedMRR / startOfMonthMRR : 0;

    // Mock churn reasons
    const churnReasons = {
      'price': 0.35,
      'missing-features': 0.25,
      'poor-support': 0.15,
      'competitor': 0.15,
      'other': 0.10
    };

    // Calculate average customer lifespan
    const cancelledSubscriptions = await prisma.subscription.findMany({
      where: { 
        status: 'CANCELLED',
        cancelledAt: { gte: lastMonth }
      },
      select: {
        createdAt: true,
        cancelledAt: true
      }
    });

    const averageLifespan = cancelledSubscriptions.length > 0
      ? cancelledSubscriptions.reduce((sum, sub) => {
          if (sub.cancelledAt) {
            return sum + (sub.cancelledAt.getTime() - sub.createdAt.getTime()) / (24 * 60 * 60 * 1000);
          }
          return sum;
        }, 0) / cancelledSubscriptions.length
      : 365; // Default 1 year

    const metrics: ChurnMetrics = {
      customerChurnRate,
      revenueChurnRate,
      userChurnRate: customerChurnRate, // Same as customer churn for B2B
      churnReasons,
      churnPredictionScore: 0.75, // Mock: 75% accuracy
      atRiskCustomers: Math.floor(startOfMonthCustomers * 0.12), // 12% at risk
      churnSaveRate: 0.35, // Mock: 35% save rate
      averageLifespan
    };

    // Store key churn metrics
    await this.storeMetric('monthly_churn_rate', customerChurnRate, LaunchMetricCategory.CHURN);
    await this.storeMetric('revenue_churn_rate', revenueChurnRate, LaunchMetricCategory.CHURN);

    this.emit('churn-metrics', metrics);
    return metrics;
  }

  async collectPerformanceMetrics(): Promise<PerformanceMetrics> {
    // Get system performance metrics (mock data for now)
    const uptime = 0.9999; // 99.99% uptime
    const avgResponseTime = 85; // 85ms average
    const p95ResponseTime = 150; // 150ms P95
    const errorRate = 0.0008; // 0.08% error rate
    const throughput = 1250; // 1250 requests/minute

    // Mock global availability
    const globalAvailability = {
      'us-east': 0.9999,
      'us-west': 0.9998,
      'eu-west': 0.9999,
      'ap-south': 0.9997
    };

    // Get incident data
    const incidents = await prisma.alert.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        severity: { in: ['WARNING', 'CRITICAL'] }
      }
    });

    const resolvedIncidents = await prisma.alert.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        resolvedAt: { not: null }
      },
      select: {
        createdAt: true,
        resolvedAt: true
      }
    });

    const meanTimeToResolve = resolvedIncidents.length > 0
      ? resolvedIncidents.reduce((sum, incident) => {
          if (incident.resolvedAt) {
            return sum + (incident.resolvedAt.getTime() - incident.createdAt.getTime()) / (60 * 1000);
          }
          return sum;
        }, 0) / resolvedIncidents.length
      : 0;

    const metrics: PerformanceMetrics = {
      uptime,
      avgResponseTime,
      p95ResponseTime,
      errorRate,
      throughput,
      globalAvailability,
      slaCompliance: 0.998, // Mock: 99.8% SLA compliance
      incidentCount: incidents,
      meanTimeToResolve
    };

    // Store key performance metrics
    await this.storeMetric('uptime', uptime, LaunchMetricCategory.PERFORMANCE);
    await this.storeMetric('avg_response_time', avgResponseTime, LaunchMetricCategory.PERFORMANCE);
    await this.storeMetric('error_rate', errorRate, LaunchMetricCategory.PERFORMANCE);

    this.emit('performance-metrics', metrics);
    return metrics;
  }

  async collectSatisfactionMetrics(): Promise<SatisfactionMetrics> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get support ticket data
    const totalTickets = await prisma.notification.count({
      where: {
        type: 'error',
        createdAt: { gte: thirtyDaysAgo }
      }
    });

    // Mock satisfaction scores
    const nps = 52; // Net Promoter Score
    const csat = 4.3; // Customer Satisfaction (out of 5)
    const ces = 3.8; // Customer Effort Score (out of 5)

    // Calculate customer health score (composite)
    const activeUsers = await prisma.user.count({
      where: {
        lastLogin: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }
      }
    });

    const totalUsers = await prisma.user.count();
    const engagementRatio = totalUsers > 0 ? activeUsers / totalUsers : 0;
    const customerHealthScore = Math.floor((engagementRatio * 50) + (csat * 10) + (nps * 0.4));

    const metrics: SatisfactionMetrics = {
      nps,
      csat,
      ces,
      supportTicketVolume: totalTickets,
      avgResolutionTime: 4.2, // Mock: 4.2 hours
      firstContactResolution: 0.78, // Mock: 78% FCR
      customerHealthScore,
      productMarketFit: 0.68 // Mock: 68% PMF score
    };

    // Store key satisfaction metrics
    await this.storeMetric('nps', nps, LaunchMetricCategory.SATISFACTION);
    await this.storeMetric('csat', csat, LaunchMetricCategory.SATISFACTION);
    await this.storeMetric('customer_health_score', customerHealthScore, LaunchMetricCategory.SATISFACTION);

    this.emit('satisfaction-metrics', metrics);
    return metrics;
  }

  private async calculateMonthlyRevenue(monthStart: Date): Promise<number> {
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    
    const payments = await prisma.payment.findMany({
      where: {
        status: 'SUCCEEDED',
        processedAt: {
          gte: monthStart,
          lte: monthEnd
        }
      }
    });

    return payments.reduce((sum, payment) => sum + parseFloat(payment.amount.toString()), 0);
  }

  private async calculateChurnedRevenue(monthStart: Date): Promise<number> {
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    
    const churnedSubscriptions = await prisma.subscription.findMany({
      where: {
        cancelledAt: {
          gte: monthStart,
          lte: monthEnd
        }
      },
      include: { plan: true }
    });

    return churnedSubscriptions.reduce((sum, sub) => {
      if (sub.plan) {
        return sum + parseFloat(sub.plan.monthlyPrice.toString()) * sub.quantity;
      }
      return sum;
    }, 0);
  }

  private async storeMetric(
    name: string,
    value: number,
    category: LaunchMetricCategory,
    metadata?: any
  ): Promise<void> {
    const target = this.targets.get(name) || 0;
    const threshold = this.alertThresholds.get(name);
    
    const metric: LaunchMetric = {
      id: `${name}-${Date.now()}`,
      name,
      value,
      target,
      unit: this.getMetricUnit(name),
      category,
      timestamp: new Date(),
      metadata
    };

    this.metrics.set(metric.id, metric);

    // Store in database
    await prisma.metricDataPoint.create({
      data: {
        source: 'launch-metrics',
        timestamp: metric.timestamp,
        value: metric.value,
        labels: {
          name: metric.name,
          category: metric.category,
          unit: metric.unit,
          target: target.toString()
        }
      }
    });

    // Check for alerts
    if (threshold) {
      await this.checkAlerts(metric, threshold);
    }

    this.emit('metric-stored', metric);
  }

  private getMetricUnit(name: string): string {
    const units: Record<string, string> = {
      'daily_signups': 'count',
      'signup_conversion_rate': 'percentage',
      'cac': 'dollars',
      'ltv_cac_ratio': 'ratio',
      'trial_to_paid_conversion': 'percentage',
      'free_to_paid_conversion': 'percentage',
      'time_to_value': 'days',
      'mrr': 'dollars',
      'arr': 'dollars',
      'mrr_growth_rate': 'percentage',
      'net_revenue_retention': 'percentage',
      'arpu': 'dollars',
      'dau': 'count',
      'wau': 'count',
      'mau': 'count',
      'user_stickiness': 'ratio',
      'monthly_churn_rate': 'percentage',
      'revenue_churn_rate': 'percentage',
      'uptime': 'percentage',
      'avg_response_time': 'milliseconds',
      'error_rate': 'percentage',
      'nps': 'score',
      'csat': 'score',
      'customer_health_score': 'score'
    };

    return units[name] || 'count';
  }

  private async checkAlerts(
    metric: LaunchMetric,
    threshold: { warning: number; critical: number }
  ): Promise<void> {
    let alertLevel: 'warning' | 'critical' | null = null;
    let message = '';

    // Different logic for different metric types
    if (metric.name.includes('rate') || metric.name.includes('conversion') || metric.name === 'uptime') {
      // For rates and uptime, lower values are bad
      if (metric.value < threshold.critical) {
        alertLevel = 'critical';
        message = `${metric.name} is critically low: ${metric.value} (threshold: ${threshold.critical})`;
      } else if (metric.value < threshold.warning) {
        alertLevel = 'warning';
        message = `${metric.name} is below warning threshold: ${metric.value} (threshold: ${threshold.warning})`;
      }
    } else if (metric.name.includes('churn') || metric.name.includes('error') || metric.name === 'cac') {
      // For churn, errors, and CAC, higher values are bad
      if (metric.value > threshold.critical) {
        alertLevel = 'critical';
        message = `${metric.name} is critically high: ${metric.value} (threshold: ${threshold.critical})`;
      } else if (metric.value > threshold.warning) {
        alertLevel = 'warning';
        message = `${metric.name} is above warning threshold: ${metric.value} (threshold: ${threshold.warning})`;
      }
    } else {
      // For count metrics, lower values are typically bad
      if (metric.value < threshold.critical) {
        alertLevel = 'critical';
        message = `${metric.name} is critically low: ${metric.value} (threshold: ${threshold.critical})`;
      } else if (metric.value < threshold.warning) {
        alertLevel = 'warning';
        message = `${metric.name} is below warning threshold: ${metric.value} (threshold: ${threshold.warning})`;
      }
    }

    if (alertLevel) {
      await prisma.alert.create({
        data: {
          name: `Launch Metric Alert: ${metric.name}`,
          severity: alertLevel.toUpperCase(),
          source: 'launch-metrics',
          message,
          fingerprint: `launch-metric-${metric.name}`,
          status: 'ACTIVE',
          metadata: {
            metricId: metric.id,
            metricValue: metric.value,
            threshold: threshold,
            category: metric.category
          }
        }
      });

      this.emit('alert-triggered', {
        metric,
        level: alertLevel,
        message
      });
    }
  }

  async getLaunchDashboard(): Promise<any> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Get latest metrics for each category
    const [
      customerAcquisition,
      conversion,
      revenue,
      engagement,
      churn,
      performance,
      satisfaction
    ] = await Promise.all([
      this.collectCustomerAcquisitionMetrics(),
      this.collectConversionMetrics(),
      this.collectRevenueMetrics(),
      this.collectEngagementMetrics(),
      this.collectChurnMetrics(),
      this.collectPerformanceMetrics(),
      this.collectSatisfactionMetrics()
    ]);

    // Get recent alerts
    const recentAlerts = await prisma.alert.findMany({
      where: {
        source: 'launch-metrics',
        createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    // Calculate overall launch score
    const launchScore = this.calculateLaunchScore({
      customerAcquisition,
      conversion,
      revenue,
      engagement,
      churn,
      performance,
      satisfaction
    });

    return {
      launchScore,
      metrics: {
        customerAcquisition,
        conversion,
        revenue,
        engagement,
        churn,
        performance,
        satisfaction
      },
      alerts: recentAlerts,
      targets: Object.fromEntries(this.targets),
      lastUpdated: now
    };
  }

  private calculateLaunchScore(metrics: any): number {
    // Weighted scoring based on key launch metrics
    const weights = {
      signups: 0.15,
      conversion: 0.20,
      revenue: 0.25,
      engagement: 0.15,
      churn: 0.10,
      performance: 0.10,
      satisfaction: 0.05
    };

    // Normalize each metric to 0-100 scale
    const signupScore = Math.min((metrics.customerAcquisition.newSignups / (this.targets.get('daily_signups') || 50)) * 100, 100);
    const conversionScore = Math.min((metrics.conversion.trialToPaidConversion / (this.targets.get('trial_to_paid_conversion') || 0.2)) * 100, 100);
    const revenueScore = Math.min((metrics.revenue.revenueGrowthRate / (this.targets.get('mrr_growth_rate') || 0.2)) * 100, 100);
    const engagementScore = Math.min((metrics.engagement.userStickiness / (this.targets.get('user_stickiness') || 0.33)) * 100, 100);
    const churnScore = Math.max(100 - (metrics.churn.customerChurnRate / (this.targets.get('monthly_churn_rate') || 0.05)) * 100, 0);
    const performanceScore = Math.min((metrics.performance.uptime / (this.targets.get('uptime') || 0.9999)) * 100, 100);
    const satisfactionScore = Math.min((metrics.satisfaction.nps / (this.targets.get('nps') || 50)) * 100, 100);

    const totalScore = 
      signupScore * weights.signups +
      conversionScore * weights.conversion +
      revenueScore * weights.revenue +
      engagementScore * weights.engagement +
      churnScore * weights.churn +
      performanceScore * weights.performance +
      satisfactionScore * weights.satisfaction;

    return Math.round(totalScore);
  }

  async getMetricTrends(metricName: string, days: number = 30): Promise<any[]> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const dataPoints = await prisma.metricDataPoint.findMany({
      where: {
        source: 'launch-metrics',
        labels: {
          path: ['name'],
          equals: metricName
        },
        timestamp: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { timestamp: 'asc' }
    });

    return dataPoints.map(dp => ({
      timestamp: dp.timestamp,
      value: dp.value,
      target: this.targets.get(metricName) || 0
    }));
  }

  cleanup(): void {
    this.collectionJobs.forEach(job => clearInterval(job));
    this.collectionJobs.clear();
  }
}