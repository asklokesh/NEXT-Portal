import { EventEmitter } from 'events';
import { prisma } from '@/lib/prisma';

interface SalesMetrics {
  pipeline: PipelineMetrics;
  performance: SalesPerformance;
  conversion: ConversionMetrics;
  forecasting: ForecastingMetrics;
}

interface PipelineMetrics {
  totalValue: number;
  dealCount: number;
  averageDealSize: number;
  stages: StageMetrics[];
  velocity: number; // days to close
  winRate: number;
  lossRate: number;
  stagnantDeals: number;
  newDealsThisMonth: number;
  closedDealsThisMonth: number;
  pipelineCoverage: number; // pipeline/quota ratio
}

interface StageMetrics {
  stage: string;
  count: number;
  value: number;
  averageTime: number; // days in stage
  conversionRate: number;
  bottleneck: boolean;
}

interface SalesPerformance {
  quota: number;
  achieved: number;
  attainment: number; // percentage
  reps: RepPerformance[];
  topPerformers: string[];
  underPerformers: string[];
  teamMetrics: TeamMetrics;
}

interface RepPerformance {
  repId: string;
  name: string;
  quota: number;
  achieved: number;
  attainment: number;
  dealsClosed: number;
  averageDealSize: number;
  activities: number;
  rank: number;
}

interface TeamMetrics {
  averageAttainment: number;
  quotaAchievers: number;
  totalQuota: number;
  totalAchieved: number;
  teamRank: number;
}

interface ConversionMetrics {
  leadToOpportunity: number;
  opportunityToProposal: number;
  proposalToClose: number;
  overallConversion: number;
  timeToConvert: number;
  qualificationRate: number;
}

interface ForecastingMetrics {
  currentQuarter: QuarterForecast;
  nextQuarter: QuarterForecast;
  accuracy: number;
  confidence: number;
  risks: string[];
  upside: number;
}

interface QuarterForecast {
  quarter: string;
  committed: number;
  bestCase: number;
  pipeline: number;
  quota: number;
  gap: number;
  probability: number;
}

interface MarketingMetrics {
  campaigns: CampaignMetrics[];
  leads: LeadMetrics;
  attribution: AttributionMetrics;
  content: ContentMetrics;
  channels: ChannelMetrics;
  roi: MarketingROI;
}

interface CampaignMetrics {
  id: string;
  name: string;
  type: 'email' | 'social' | 'content' | 'events' | 'paid-ads' | 'webinar';
  status: 'active' | 'completed' | 'paused' | 'draft';
  budget: number;
  spent: number;
  impressions: number;
  clicks: number;
  conversions: number;
  leads: number;
  opportunities: number;
  deals: number;
  revenue: number;
  roi: number;
  ctr: number; // click-through rate
  conversionRate: number;
  cpl: number; // cost per lead
  cac: number; // customer acquisition cost
  startDate: Date;
  endDate?: Date;
}

interface LeadMetrics {
  totalLeads: number;
  qualifiedLeads: number;
  mql: number; // marketing qualified leads
  sql: number; // sales qualified leads
  leadSources: Record<string, number>;
  leadQuality: number;
  leadVelocity: number;
  leadToCustomer: number;
  averageLeadScore: number;
}

interface AttributionMetrics {
  firstTouch: Record<string, number>;
  lastTouch: Record<string, number>;
  multiTouch: Record<string, number>;
  influencedRevenue: Record<string, number>;
  touchpointAnalysis: TouchpointMetrics[];
}

interface TouchpointMetrics {
  channel: string;
  position: number; // position in customer journey
  influence: number; // influence score
  frequency: number;
  conversion: number;
}

interface ContentMetrics {
  topContent: ContentPerformance[];
  contentTypes: Record<string, number>;
  engagement: number;
  shareability: number;
  leadGeneration: number;
  salesEnablement: number;
}

interface ContentPerformance {
  id: string;
  title: string;
  type: string;
  views: number;
  downloads: number;
  shares: number;
  leads: number;
  score: number;
}

interface ChannelMetrics {
  channels: ChannelPerformance[];
  efficiency: Record<string, number>;
  costs: Record<string, number>;
  returns: Record<string, number>;
  trends: Record<string, number[]>;
}

interface ChannelPerformance {
  channel: string;
  leads: number;
  customers: number;
  revenue: number;
  cost: number;
  roi: number;
  trend: 'up' | 'down' | 'stable';
}

interface MarketingROI {
  totalSpent: number;
  revenueGenerated: number;
  roi: number;
  roas: number; // return on ad spend
  ltv: number; // lifetime value
  paybackPeriod: number;
  efficiency: number;
}

interface PartnerMetrics {
  partners: PartnerPerformance[];
  channelRevenue: number;
  partnerContribution: number;
  enablement: EnablementMetrics;
  satisfaction: PartnerSatisfaction;
}

interface PartnerPerformance {
  partnerId: string;
  name: string;
  type: 'reseller' | 'referral' | 'technology' | 'consulting';
  tier: 'platinum' | 'gold' | 'silver' | 'bronze';
  revenue: number;
  deals: number;
  leads: number;
  certifications: number;
  satisfaction: number;
  growth: number;
}

interface EnablementMetrics {
  trainingCompleted: number;
  certifications: number;
  resourceUsage: number;
  supportRequests: number;
  portalActivity: number;
}

interface PartnerSatisfaction {
  overall: number;
  support: number;
  training: number;
  tools: number;
  communication: number;
  margins: number;
}

interface GeographicMetrics {
  regions: RegionPerformance[];
  marketPenetration: Record<string, number>;
  localization: LocalizationMetrics;
  expansion: ExpansionMetrics;
}

interface RegionPerformance {
  region: string;
  revenue: number;
  customers: number;
  growth: number;
  marketShare: number;
  competition: number;
  opportunities: number;
}

interface LocalizationMetrics {
  languages: number;
  localizedContent: number;
  culturalAdaptation: number;
  localSupport: number;
}

interface ExpansionMetrics {
  newMarkets: number;
  marketEntry: number;
  regulatoryCompliance: number;
  localPartnerships: number;
}

interface UnitEconomics {
  cac: CustomerAcquisitionCost;
  ltv: LifetimeValue;
  payback: PaybackMetrics;
  cohorts: CohortAnalysis[];
  efficiency: EfficiencyMetrics;
}

interface CustomerAcquisitionCost {
  blended: number;
  organic: number;
  paid: number;
  byChannel: Record<string, number>;
  bySegment: Record<string, number>;
  trend: number[];
}

interface LifetimeValue {
  average: number;
  bySegment: Record<string, number>;
  byCohort: Record<string, number>;
  prediction: number;
  factors: string[];
}

interface PaybackMetrics {
  averageMonths: number;
  bySegment: Record<string, number>;
  byChannel: Record<string, number>;
  trends: number[];
}

interface CohortAnalysis {
  cohort: string;
  size: number;
  retention: number[];
  revenue: number[];
  ltv: number;
  churn: number;
}

interface EfficiencyMetrics {
  ltvCacRatio: number;
  magicNumber: number;
  growthEfficiency: number;
  capitalEfficiency: number;
  salesEfficiency: number;
}

export class BusinessPerformance extends EventEmitter {
  private salesData: Map<string, any> = new Map();
  private marketingData: Map<string, any> = new Map();
  private partnerData: Map<string, any> = new Map();
  private monitoringJobs: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
    this.startMonitoring();
    this.initializeMockData();
  }

  private startMonitoring() {
    // Update sales metrics every hour
    this.monitoringJobs.set('sales-metrics', setInterval(
      () => this.collectSalesMetrics(),
      60 * 60 * 1000
    ));

    // Update marketing metrics every 2 hours
    this.monitoringJobs.set('marketing-metrics', setInterval(
      () => this.collectMarketingMetrics(),
      2 * 60 * 60 * 1000
    ));

    // Update partner metrics every 6 hours
    this.monitoringJobs.set('partner-metrics', setInterval(
      () => this.collectPartnerMetrics(),
      6 * 60 * 60 * 1000
    ));

    // Calculate unit economics daily
    this.monitoringJobs.set('unit-economics', setInterval(
      () => this.calculateUnitEconomics(),
      24 * 60 * 60 * 1000
    ));

    // Generate business insights every 4 hours
    this.monitoringJobs.set('business-insights', setInterval(
      () => this.generateBusinessInsights(),
      4 * 60 * 60 * 1000
    ));
  }

  private initializeMockData() {
    // Initialize with mock data for demonstration
    this.generateMockSalesData();
    this.generateMockMarketingData();
    this.generateMockPartnerData();
  }

  private generateMockSalesData() {
    // Mock sales pipeline data
    const stages: StageMetrics[] = [
      { stage: 'Qualified Lead', count: 150, value: 3000000, averageTime: 5, conversionRate: 0.4, bottleneck: false },
      { stage: 'Discovery', count: 60, value: 1800000, averageTime: 14, conversionRate: 0.7, bottleneck: true },
      { stage: 'Proposal', count: 42, value: 1260000, averageTime: 21, conversionRate: 0.6, bottleneck: false },
      { stage: 'Negotiation', count: 25, value: 750000, averageTime: 18, conversionRate: 0.8, bottleneck: false },
      { stage: 'Closed Won', count: 20, value: 600000, averageTime: 0, conversionRate: 1.0, bottleneck: false }
    ];

    const reps: RepPerformance[] = [
      { repId: '1', name: 'Sarah Johnson', quota: 500000, achieved: 520000, attainment: 1.04, dealsClosed: 8, averageDealSize: 65000, activities: 145, rank: 1 },
      { repId: '2', name: 'Mike Chen', quota: 500000, achieved: 480000, attainment: 0.96, dealsClosed: 7, averageDealSize: 68500, activities: 132, rank: 2 },
      { repId: '3', name: 'Emily Rodriguez', quota: 500000, achieved: 460000, attainment: 0.92, dealsClosed: 6, averageDealSize: 76600, activities: 128, rank: 3 },
      { repId: '4', name: 'David Kim', quota: 500000, achieved: 420000, attainment: 0.84, dealsClosed: 5, averageDealSize: 84000, activities: 115, rank: 4 }
    ];

    this.salesData.set('pipeline', {
      totalValue: 7410000,
      dealCount: 297,
      averageDealSize: 24949,
      stages,
      velocity: 78,
      winRate: 0.22,
      lossRate: 0.35,
      stagnantDeals: 12,
      newDealsThisMonth: 45,
      closedDealsThisMonth: 18,
      pipelineCoverage: 3.2
    });

    this.salesData.set('performance', {
      quota: 2000000,
      achieved: 1880000,
      attainment: 0.94,
      reps,
      topPerformers: ['Sarah Johnson', 'Mike Chen'],
      underPerformers: ['David Kim'],
      teamMetrics: {
        averageAttainment: 0.94,
        quotaAchievers: 1,
        totalQuota: 2000000,
        totalAchieved: 1880000,
        teamRank: 2
      }
    });
  }

  private generateMockMarketingData() {
    const campaigns: CampaignMetrics[] = [
      {
        id: 'dev-portal-awareness',
        name: 'Developer Portal Awareness',
        type: 'content',
        status: 'active',
        budget: 50000,
        spent: 32000,
        impressions: 450000,
        clicks: 18000,
        conversions: 720,
        leads: 320,
        opportunities: 64,
        deals: 12,
        revenue: 240000,
        roi: 7.5,
        ctr: 0.04,
        conversionRate: 0.04,
        cpl: 100,
        cac: 2000,
        startDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
      },
      {
        id: 'enterprise-webinar',
        name: 'Enterprise Platform Engineering',
        type: 'webinar',
        status: 'completed',
        budget: 25000,
        spent: 25000,
        impressions: 150000,
        clicks: 7500,
        conversions: 300,
        leads: 180,
        opportunities: 36,
        deals: 8,
        revenue: 160000,
        roi: 6.4,
        ctr: 0.05,
        conversionRate: 0.04,
        cpl: 139,
        cac: 3125,
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
      }
    ];

    this.marketingData.set('campaigns', campaigns);

    this.marketingData.set('leads', {
      totalLeads: 1250,
      qualifiedLeads: 625,
      mql: 875,
      sql: 375,
      leadSources: {
        'organic': 350,
        'paid-search': 280,
        'social': 220,
        'email': 180,
        'events': 140,
        'referral': 80
      },
      leadQuality: 0.68,
      leadVelocity: 14,
      leadToCustomer: 0.08,
      averageLeadScore: 72
    });

    this.marketingData.set('attribution', {
      firstTouch: {
        'organic': 0.28,
        'paid-search': 0.24,
        'social': 0.18,
        'email': 0.15,
        'events': 0.10,
        'referral': 0.05
      },
      lastTouch: {
        'email': 0.32,
        'paid-search': 0.26,
        'organic': 0.18,
        'social': 0.12,
        'events': 0.08,
        'referral': 0.04
      },
      multiTouch: {
        'organic': 0.25,
        'paid-search': 0.22,
        'email': 0.20,
        'social': 0.15,
        'events': 0.12,
        'referral': 0.06
      }
    });

    this.marketingData.set('roi', {
      totalSpent: 250000,
      revenueGenerated: 1800000,
      roi: 7.2,
      roas: 8.1,
      ltv: 45000,
      paybackPeriod: 14,
      efficiency: 0.85
    });
  }

  private generateMockPartnerData() {
    const partners: PartnerPerformance[] = [
      {
        partnerId: 'p1',
        name: 'DevOps Consulting Group',
        type: 'consulting',
        tier: 'platinum',
        revenue: 480000,
        deals: 8,
        leads: 32,
        certifications: 12,
        satisfaction: 4.6,
        growth: 1.25
      },
      {
        partnerId: 'p2',
        name: 'Cloud Solutions Inc',
        type: 'technology',
        tier: 'gold',
        revenue: 320000,
        deals: 6,
        leads: 18,
        certifications: 8,
        satisfaction: 4.2,
        growth: 1.15
      },
      {
        partnerId: 'p3',
        name: 'Platform Resellers',
        type: 'reseller',
        tier: 'silver',
        revenue: 180000,
        deals: 4,
        leads: 12,
        certifications: 4,
        satisfaction: 3.8,
        growth: 1.05
      }
    ];

    this.partnerData.set('partners', partners);

    this.partnerData.set('metrics', {
      channelRevenue: 980000,
      partnerContribution: 0.35,
      enablement: {
        trainingCompleted: 0.78,
        certifications: 24,
        resourceUsage: 0.65,
        supportRequests: 45,
        portalActivity: 0.82
      },
      satisfaction: {
        overall: 4.2,
        support: 4.1,
        training: 4.3,
        tools: 4.0,
        communication: 4.2,
        margins: 3.9
      }
    });
  }

  async collectSalesMetrics(): Promise<SalesMetrics> {
    // In a real implementation, this would query CRM systems
    const pipeline = this.salesData.get('pipeline') as PipelineMetrics;
    const performance = this.salesData.get('performance') as SalesPerformance;

    // Calculate conversion rates
    const conversion: ConversionMetrics = {
      leadToOpportunity: 0.35,
      opportunityToProposal: 0.70,
      proposalToClose: 0.48,
      overallConversion: 0.12,
      timeToConvert: 65,
      qualificationRate: 0.68
    };

    // Generate forecasting
    const forecasting: ForecastingMetrics = {
      currentQuarter: {
        quarter: 'Q1 2025',
        committed: 1800000,
        bestCase: 2200000,
        pipeline: 3500000,
        quota: 2000000,
        gap: 200000,
        probability: 0.85
      },
      nextQuarter: {
        quarter: 'Q2 2025',
        committed: 1200000,
        bestCase: 2800000,
        pipeline: 4200000,
        quota: 2500000,
        gap: 1300000,
        probability: 0.68
      },
      accuracy: 0.92,
      confidence: 0.78,
      risks: ['Pipeline coverage low in Q2', 'Competitive pressure increasing'],
      upside: 800000
    };

    const salesMetrics: SalesMetrics = {
      pipeline,
      performance,
      conversion,
      forecasting
    };

    await this.storeSalesMetrics(salesMetrics);
    this.emit('sales-metrics-updated', salesMetrics);

    return salesMetrics;
  }

  async collectMarketingMetrics(): Promise<MarketingMetrics> {
    const campaigns = this.marketingData.get('campaigns') as CampaignMetrics[];
    const leads = this.marketingData.get('leads') as LeadMetrics;
    const attribution = this.marketingData.get('attribution') as AttributionMetrics;
    const roi = this.marketingData.get('roi') as MarketingROI;

    // Generate content metrics
    const content: ContentMetrics = {
      topContent: [
        { id: '1', title: 'Developer Portal Best Practices', type: 'whitepaper', views: 2500, downloads: 450, shares: 85, leads: 120, score: 89 },
        { id: '2', title: 'Platform Engineering Guide', type: 'ebook', views: 1800, downloads: 320, shares: 62, leads: 95, score: 82 },
        { id: '3', title: 'Service Catalog Webinar', type: 'video', views: 3200, downloads: 0, shares: 128, leads: 145, score: 78 }
      ],
      contentTypes: {
        'whitepapers': 25,
        'ebooks': 18,
        'videos': 32,
        'blogs': 45,
        'webinars': 12
      },
      engagement: 0.72,
      shareability: 0.58,
      leadGeneration: 0.65,
      salesEnablement: 0.71
    };

    // Generate channel metrics
    const channels: ChannelMetrics = {
      channels: [
        { channel: 'organic', leads: 350, customers: 28, revenue: 560000, cost: 45000, roi: 12.4, trend: 'up' },
        { channel: 'paid-search', leads: 280, customers: 22, revenue: 440000, cost: 65000, roi: 6.8, trend: 'stable' },
        { channel: 'social', leads: 220, customers: 15, revenue: 300000, cost: 35000, roi: 8.6, trend: 'up' },
        { channel: 'email', leads: 180, customers: 18, revenue: 360000, cost: 15000, roi: 24.0, trend: 'stable' },
        { channel: 'events', leads: 140, customers: 12, revenue: 240000, cost: 75000, roi: 3.2, trend: 'down' }
      ],
      efficiency: {
        'organic': 0.92,
        'paid-search': 0.78,
        'social': 0.85,
        'email': 0.95,
        'events': 0.65
      },
      costs: {
        'organic': 45000,
        'paid-search': 65000,
        'social': 35000,
        'email': 15000,
        'events': 75000
      },
      returns: {
        'organic': 560000,
        'paid-search': 440000,
        'social': 300000,
        'email': 360000,
        'events': 240000
      },
      trends: {
        'organic': [350, 380, 420, 450, 480],
        'paid-search': [280, 275, 285, 290, 280],
        'social': [220, 240, 260, 280, 320],
        'email': [180, 185, 190, 185, 180],
        'events': [140, 120, 110, 100, 95]
      }
    };

    const marketingMetrics: MarketingMetrics = {
      campaigns,
      leads,
      attribution,
      content,
      channels,
      roi
    };

    await this.storeMarketingMetrics(marketingMetrics);
    this.emit('marketing-metrics-updated', marketingMetrics);

    return marketingMetrics;
  }

  async collectPartnerMetrics(): Promise<PartnerMetrics> {
    const partners = this.partnerData.get('partners') as PartnerPerformance[];
    const metrics = this.partnerData.get('metrics') as any;

    const partnerMetrics: PartnerMetrics = {
      partners,
      channelRevenue: metrics.channelRevenue,
      partnerContribution: metrics.partnerContribution,
      enablement: metrics.enablement,
      satisfaction: metrics.satisfaction
    };

    await this.storePartnerMetrics(partnerMetrics);
    this.emit('partner-metrics-updated', partnerMetrics);

    return partnerMetrics;
  }

  async calculateUnitEconomics(): Promise<UnitEconomics> {
    // Calculate customer acquisition cost
    const cac: CustomerAcquisitionCost = {
      blended: 2500,
      organic: 800,
      paid: 4200,
      byChannel: {
        'organic': 800,
        'paid-search': 2900,
        'social': 1800,
        'email': 650,
        'events': 5200,
        'referral': 400
      },
      bySegment: {
        'enterprise': 8500,
        'mid-market': 3200,
        'smb': 1200
      },
      trend: [2800, 2600, 2400, 2500, 2300]
    };

    // Calculate lifetime value
    const ltv: LifetimeValue = {
      average: 45000,
      bySegment: {
        'enterprise': 125000,
        'mid-market': 45000,
        'smb': 15000
      },
      byCohort: {
        'Q1-2024': 42000,
        'Q2-2024': 46000,
        'Q3-2024': 48000,
        'Q4-2024': 51000
      },
      prediction: 52000,
      factors: ['Retention rate', 'Expansion revenue', 'Contract value']
    };

    // Calculate payback metrics
    const payback: PaybackMetrics = {
      averageMonths: 18,
      bySegment: {
        'enterprise': 8,
        'mid-market': 14,
        'smb': 24
      },
      byChannel: {
        'organic': 12,
        'paid-search': 20,
        'social': 16,
        'email': 10,
        'events': 28
      },
      trends: [20, 19, 18, 17, 16]
    };

    // Generate cohort analysis
    const cohorts: CohortAnalysis[] = [
      {
        cohort: 'Q1-2024',
        size: 45,
        retention: [1.0, 0.95, 0.92, 0.88, 0.85, 0.82, 0.80, 0.78, 0.76, 0.74, 0.72, 0.70],
        revenue: [50000, 95000, 135000, 170000, 200000, 225000, 245000, 260000, 275000, 285000, 295000, 305000],
        ltv: 42000,
        churn: 0.30
      },
      {
        cohort: 'Q2-2024',
        size: 52,
        retention: [1.0, 0.96, 0.93, 0.90, 0.87, 0.84, 0.82, 0.80, 0.78, 0.76],
        revenue: [55000, 105000, 148000, 185000, 218000, 245000, 268000, 285000, 300000, 315000],
        ltv: 46000,
        churn: 0.24
      }
    ];

    // Calculate efficiency metrics
    const efficiency: EfficiencyMetrics = {
      ltvCacRatio: ltv.average / cac.blended,
      magicNumber: 1.8,
      growthEfficiency: 0.75,
      capitalEfficiency: 2.1,
      salesEfficiency: 1.4
    };

    const unitEconomics: UnitEconomics = {
      cac,
      ltv,
      payback,
      cohorts,
      efficiency
    };

    await this.storeUnitEconomics(unitEconomics);
    this.emit('unit-economics-updated', unitEconomics);

    return unitEconomics;
  }

  async generateBusinessInsights(): Promise<string[]> {
    const [sales, marketing, partners, economics] = await Promise.all([
      this.collectSalesMetrics(),
      this.collectMarketingMetrics(),
      this.collectPartnerMetrics(),
      this.calculateUnitEconomics()
    ]);

    const insights: string[] = [];

    // Sales insights
    if (sales.performance.attainment < 0.8) {
      insights.push('Sales team underperforming - only ' + (sales.performance.attainment * 100).toFixed(1) + '% quota attainment');
    }

    if (sales.pipeline.velocity > 90) {
      insights.push('Sales cycle is longer than target - ' + sales.pipeline.velocity + ' days average');
    }

    const bottleneck = sales.pipeline.stages.find(s => s.bottleneck);
    if (bottleneck) {
      insights.push(`Pipeline bottleneck identified at ${bottleneck.stage} stage - ${bottleneck.averageTime} days average time`);
    }

    // Marketing insights
    const bestChannel = marketing.channels.channels
      .sort((a, b) => b.roi - a.roi)[0];
    insights.push(`Best performing channel: ${bestChannel.channel} with ${bestChannel.roi.toFixed(1)}x ROI`);

    const worstChannel = marketing.channels.channels
      .sort((a, b) => a.roi - b.roi)[0];
    if (worstChannel.roi < 2) {
      insights.push(`Underperforming channel: ${worstChannel.channel} with only ${worstChannel.roi.toFixed(1)}x ROI`);
    }

    if (marketing.leads.leadQuality < 0.6) {
      insights.push('Lead quality is below target - consider improving qualification criteria');
    }

    // Partner insights
    const topPartner = partners.partners.sort((a, b) => b.revenue - a.revenue)[0];
    insights.push(`Top partner: ${topPartner.name} contributing $${topPartner.revenue.toLocaleString()}`);

    if (partners.satisfaction.overall < 4.0) {
      insights.push('Partner satisfaction below target - focus on enablement and support');
    }

    // Unit economics insights
    if (economics.efficiency.ltvCacRatio < 3) {
      insights.push(`LTV:CAC ratio of ${economics.efficiency.ltvCacRatio.toFixed(1)}:1 is below healthy threshold of 3:1`);
    }

    if (economics.payback.averageMonths > 24) {
      insights.push(`Payback period of ${economics.payback.averageMonths} months is too long - optimize pricing or reduce CAC`);
    }

    // Growth efficiency
    if (economics.efficiency.growthEfficiency < 0.7) {
      insights.push('Growth efficiency is below target - review go-to-market strategy');
    }

    this.emit('business-insights-generated', insights);
    return insights;
  }

  async getGeographicMetrics(): Promise<GeographicMetrics> {
    // Mock geographic data
    const regions: RegionPerformance[] = [
      {
        region: 'North America',
        revenue: 12500000,
        customers: 450,
        growth: 1.25,
        marketShare: 0.08,
        competition: 0.75,
        opportunities: 125
      },
      {
        region: 'Europe',
        revenue: 8200000,
        customers: 320,
        growth: 1.45,
        marketShare: 0.05,
        competition: 0.65,
        opportunities: 95
      },
      {
        region: 'Asia Pacific',
        revenue: 3800000,
        customers: 180,
        growth: 1.85,
        marketShare: 0.02,
        competition: 0.85,
        opportunities: 220
      }
    ];

    const marketPenetration = {
      'United States': 0.12,
      'Canada': 0.08,
      'United Kingdom': 0.07,
      'Germany': 0.06,
      'France': 0.04,
      'Australia': 0.05,
      'Singapore': 0.03,
      'Japan': 0.02
    };

    const localization: LocalizationMetrics = {
      languages: 8,
      localizedContent: 0.75,
      culturalAdaptation: 0.65,
      localSupport: 0.82
    };

    const expansion: ExpansionMetrics = {
      newMarkets: 3,
      marketEntry: 0.4,
      regulatoryCompliance: 0.88,
      localPartnerships: 12
    };

    return {
      regions,
      marketPenetration,
      localization,
      expansion
    };
  }

  async getBusinessDashboard(): Promise<any> {
    const [sales, marketing, partners, economics, geographic] = await Promise.all([
      this.collectSalesMetrics(),
      this.collectMarketingMetrics(),
      this.collectPartnerMetrics(),
      this.calculateUnitEconomics(),
      this.getGeographicMetrics()
    ]);

    const insights = await this.generateBusinessInsights();

    // Calculate overall business health score
    const businessHealthScore = this.calculateBusinessHealth({
      sales,
      marketing,
      partners,
      economics
    });

    return {
      businessHealthScore,
      sales,
      marketing,
      partners,
      economics,
      geographic,
      insights,
      lastUpdated: new Date()
    };
  }

  private calculateBusinessHealth(metrics: any): number {
    const weights = {
      sales: 0.35,
      marketing: 0.25,
      partners: 0.15,
      economics: 0.25
    };

    // Sales health (0-100)
    let salesHealth = 0;
    salesHealth += Math.min(metrics.sales.performance.attainment * 80, 80); // Max 80 for quota attainment
    salesHealth += Math.min(metrics.sales.pipeline.winRate * 50, 20); // Max 20 for win rate

    // Marketing health (0-100)
    let marketingHealth = 0;
    marketingHealth += Math.min(metrics.marketing.roi.roi / 5 * 50, 50); // Max 50 for ROI (5x = max)
    marketingHealth += Math.min(metrics.marketing.leads.leadQuality * 30, 30); // Max 30 for lead quality
    marketingHealth += Math.min(metrics.marketing.channels.efficiency.organic * 20, 20); // Max 20 for efficiency

    // Partner health (0-100)
    const partnerHealth = (metrics.partners.satisfaction.overall / 5) * 100;

    // Economics health (0-100)
    let economicsHealth = 0;
    economicsHealth += Math.min(metrics.economics.efficiency.ltvCacRatio / 5 * 40, 40); // Max 40 for LTV:CAC (5:1 = max)
    economicsHealth += Math.max(0, 60 - metrics.economics.payback.averageMonths * 2); // Lose 2 points per month over 6

    const totalHealth = 
      salesHealth * weights.sales +
      marketingHealth * weights.marketing +
      partnerHealth * weights.partners +
      economicsHealth * weights.economics;

    return Math.round(Math.max(0, Math.min(100, totalHealth)));
  }

  private async storeSalesMetrics(metrics: SalesMetrics): Promise<void> {
    await prisma.salesMetrics.create({
      data: {
        timestamp: new Date(),
        pipeline: metrics.pipeline,
        performance: metrics.performance,
        conversion: metrics.conversion,
        forecasting: metrics.forecasting
      }
    });
  }

  private async storeMarketingMetrics(metrics: MarketingMetrics): Promise<void> {
    await prisma.marketingMetrics.create({
      data: {
        timestamp: new Date(),
        campaigns: metrics.campaigns,
        leads: metrics.leads,
        attribution: metrics.attribution,
        content: metrics.content,
        channels: metrics.channels,
        roi: metrics.roi
      }
    });
  }

  private async storePartnerMetrics(metrics: PartnerMetrics): Promise<void> {
    await prisma.partnerMetrics.create({
      data: {
        timestamp: new Date(),
        partners: metrics.partners,
        channelRevenue: metrics.channelRevenue,
        partnerContribution: metrics.partnerContribution,
        enablement: metrics.enablement,
        satisfaction: metrics.satisfaction
      }
    });
  }

  private async storeUnitEconomics(metrics: UnitEconomics): Promise<void> {
    await prisma.unitEconomics.create({
      data: {
        timestamp: new Date(),
        cac: metrics.cac,
        ltv: metrics.ltv,
        payback: metrics.payback,
        cohorts: metrics.cohorts,
        efficiency: metrics.efficiency
      }
    });
  }

  cleanup(): void {
    this.monitoringJobs.forEach(job => clearInterval(job));
    this.monitoringJobs.clear();
  }
}