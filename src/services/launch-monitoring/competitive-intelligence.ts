import { EventEmitter } from 'events';
import { prisma } from '@/lib/prisma';

interface CompetitorProfile {
  id: string;
  name: string;
  website: string;
  type: 'direct' | 'indirect' | 'substitute';
  category: 'enterprise' | 'mid-market' | 'smb' | 'startup';
  fundingStage: 'seed' | 'seriesA' | 'seriesB' | 'seriesC' | 'public' | 'private';
  employees: number;
  headquarters: string;
  foundedYear: number;
  description: string;
  tags: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface CompetitorMetrics {
  competitorId: string;
  timestamp: Date;
  marketShare: number;
  pricing: PricingIntel;
  features: FeatureComparison;
  marketing: MarketingIntel;
  social: SocialIntel;
  financial: FinancialIntel;
  technology: TechnologyIntel;
  customers: CustomerIntel;
  hiring: HiringIntel;
  news: NewsItem[];
}

interface PricingIntel {
  startingPrice: number;
  enterprisePrice: number;
  freeTier: boolean;
  trialDays: number;
  pricingModel: 'subscription' | 'usage' | 'perpetual' | 'freemium';
  lastUpdated: Date;
  changes: PricingChange[];
}

interface PricingChange {
  date: Date;
  type: 'increase' | 'decrease' | 'new-tier' | 'removed-tier';
  description: string;
  impact: 'low' | 'medium' | 'high';
}

interface FeatureComparison {
  totalFeatures: number;
  newFeatures: string[];
  removedFeatures: string[];
  featureGaps: string[];
  competitiveAdvantages: string[];
  featureMatrix: Record<string, boolean>;
  lastUpdated: Date;
}

interface MarketingIntel {
  campaigns: MarketingCampaign[];
  messaging: string[];
  positioning: string;
  targetAudience: string[];
  channels: string[];
  contentStrategy: string;
  brandSentiment: number;
  shareOfVoice: number;
}

interface MarketingCampaign {
  name: string;
  type: 'product-launch' | 'awareness' | 'demand-gen' | 'retention';
  startDate: Date;
  endDate?: Date;
  budget?: number;
  channels: string[];
  effectiveness: number;
}

interface SocialIntel {
  platforms: Record<string, SocialMetrics>;
  engagement: number;
  followers: number;
  growth: number;
  mentions: number;
  sentiment: number;
}

interface SocialMetrics {
  followers: number;
  posts: number;
  engagement: number;
  growth: number;
}

interface FinancialIntel {
  revenue: number;
  growth: number;
  funding: number;
  valuation: number;
  investors: string[];
  lastFundingDate?: Date;
  lastFundingAmount?: number;
  burnRate?: number;
  runway?: number;
}

interface TechnologyIntel {
  techStack: string[];
  integrations: string[];
  apis: string[];
  infrastructure: string[];
  certifications: string[];
  patents: number;
  openSource: boolean;
}

interface CustomerIntel {
  totalCustomers: number;
  enterpriseCustomers: number;
  customerLogos: string[];
  churnRate: number;
  nps: number;
  caseStudies: number;
  testimonials: number;
  winLossRatio: number;
}

interface HiringIntel {
  totalEmployees: number;
  growth: number;
  openPositions: number;
  departments: Record<string, number>;
  locations: string[];
  keyHires: KeyHire[];
}

interface KeyHire {
  name: string;
  role: string;
  previousCompany: string;
  startDate: Date;
  significance: 'low' | 'medium' | 'high';
}

interface NewsItem {
  title: string;
  source: string;
  url: string;
  publishedAt: Date;
  sentiment: number;
  type: 'funding' | 'product' | 'partnership' | 'acquisition' | 'press' | 'other';
  summary: string;
  impact: 'low' | 'medium' | 'high';
}

interface MarketTrend {
  id: string;
  name: string;
  description: string;
  category: 'technology' | 'market' | 'customer' | 'regulatory';
  impact: 'positive' | 'negative' | 'neutral';
  confidence: number;
  timeframe: 'immediate' | 'short' | 'medium' | 'long';
  sources: string[];
  createdAt: Date;
}

interface WinLossAnalysis {
  id: string;
  competitorId: string;
  outcome: 'win' | 'loss';
  dealSize: number;
  reason: string;
  customerSegment: string;
  salesCycle: number;
  factors: string[];
  createdAt: Date;
}

export class CompetitiveIntelligence extends EventEmitter {
  private competitors: Map<string, CompetitorProfile> = new Map();
  private metrics: Map<string, CompetitorMetrics> = new Map();
  private trends: Map<string, MarketTrend> = new Map();
  private monitoringJobs: Map<string, NodeJS.Timeout> = new Map();
  private dataSources: string[] = [];

  constructor() {
    super();
    this.initializeCompetitors();
    this.initializeDataSources();
    this.startMonitoring();
  }

  private initializeCompetitors() {
    const defaultCompetitors: Omit<CompetitorProfile, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        name: 'Backstage.io',
        website: 'https://backstage.io',
        type: 'direct',
        category: 'enterprise',
        fundingStage: 'public',
        employees: 0, // Open source
        headquarters: 'Global',
        foundedYear: 2020,
        description: 'Open source developer portal platform by Spotify',
        tags: ['open-source', 'developer-portal', 'service-catalog'],
        isActive: true
      },
      {
        name: 'Port.run',
        website: 'https://port.run',
        type: 'direct',
        category: 'enterprise',
        fundingStage: 'seriesB',
        employees: 150,
        headquarters: 'Tel Aviv, Israel',
        foundedYear: 2021,
        description: 'Internal developer portal for engineering teams',
        tags: ['developer-portal', 'service-catalog', 'infrastructure'],
        isActive: true
      },
      {
        name: 'Cortex.io',
        website: 'https://cortex.io',
        type: 'direct',
        category: 'enterprise',
        fundingStage: 'seriesA',
        employees: 75,
        headquarters: 'San Francisco, CA',
        foundedYear: 2019,
        description: 'Internal developer portal and service catalog',
        tags: ['developer-portal', 'service-catalog', 'microservices'],
        isActive: true
      },
      {
        name: 'Spotify Backstage Enterprise',
        website: 'https://spotify.com/backstage',
        type: 'direct',
        category: 'enterprise',
        fundingStage: 'public',
        employees: 9000,
        headquarters: 'Stockholm, Sweden',
        foundedYear: 2021,
        description: 'Enterprise version of Backstage with commercial support',
        tags: ['backstage', 'enterprise', 'developer-portal'],
        isActive: true
      },
      {
        name: 'Humanitec',
        website: 'https://humanitec.com',
        type: 'indirect',
        category: 'enterprise',
        fundingStage: 'seriesB',
        employees: 200,
        headquarters: 'Berlin, Germany',
        foundedYear: 2019,
        description: 'Platform Orchestrator for cloud-native applications',
        tags: ['platform-engineering', 'kubernetes', 'devops'],
        isActive: true
      },
      {
        name: 'GitLab',
        website: 'https://gitlab.com',
        type: 'indirect',
        category: 'enterprise',
        fundingStage: 'public',
        employees: 1300,
        headquarters: 'San Francisco, CA',
        foundedYear: 2011,
        description: 'DevOps platform with developer portal features',
        tags: ['devops', 'ci-cd', 'git', 'developer-tools'],
        isActive: true
      }
    ];

    defaultCompetitors.forEach(competitor => {
      this.addCompetitor(competitor);
    });
  }

  private initializeDataSources() {
    this.dataSources = [
      'crunchbase-api',
      'github-api',
      'linkedin-api',
      'twitter-api',
      'google-trends',
      'web-scraping',
      'news-apis',
      'job-boards',
      'app-stores',
      'product-hunt'
    ];
  }

  private startMonitoring() {
    // Monitor competitor websites every 6 hours
    this.monitoringJobs.set('website-monitoring', setInterval(
      () => this.monitorCompetitorWebsites(),
      6 * 60 * 60 * 1000
    ));

    // Monitor pricing changes every 24 hours
    this.monitoringJobs.set('pricing-monitoring', setInterval(
      () => this.monitorPricingChanges(),
      24 * 60 * 60 * 1000
    ));

    // Monitor feature releases every 12 hours
    this.monitoringJobs.set('feature-monitoring', setInterval(
      () => this.monitorFeatureReleases(),
      12 * 60 * 60 * 1000
    ));

    // Monitor social media every 2 hours
    this.monitoringJobs.set('social-monitoring', setInterval(
      () => this.monitorSocialMedia(),
      2 * 60 * 60 * 1000
    ));

    // Monitor news and press every 4 hours
    this.monitoringJobs.set('news-monitoring', setInterval(
      () => this.monitorNews(),
      4 * 60 * 60 * 1000
    ));

    // Monitor hiring trends every 24 hours
    this.monitoringJobs.set('hiring-monitoring', setInterval(
      () => this.monitorHiring(),
      24 * 60 * 60 * 1000
    ));

    // Analyze market trends every 48 hours
    this.monitoringJobs.set('trend-analysis', setInterval(
      () => this.analyzeMarketTrends(),
      48 * 60 * 60 * 1000
    ));
  }

  async addCompetitor(competitor: Omit<CompetitorProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<CompetitorProfile> {
    const newCompetitor: CompetitorProfile = {
      ...competitor,
      id: `competitor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.competitors.set(newCompetitor.id, newCompetitor);
    
    // Store in database
    await prisma.competitor.create({
      data: {
        id: newCompetitor.id,
        name: newCompetitor.name,
        website: newCompetitor.website,
        type: newCompetitor.type,
        category: newCompetitor.category,
        metadata: {
          fundingStage: newCompetitor.fundingStage,
          employees: newCompetitor.employees,
          headquarters: newCompetitor.headquarters,
          foundedYear: newCompetitor.foundedYear,
          description: newCompetitor.description,
          tags: newCompetitor.tags
        },
        isActive: newCompetitor.isActive
      }
    });

    this.emit('competitor-added', newCompetitor);
    return newCompetitor;
  }

  private async monitorCompetitorWebsites(): Promise<void> {
    for (const competitor of this.competitors.values()) {
      if (!competitor.isActive) continue;

      try {
        await this.scrapeCompetitorWebsite(competitor);
      } catch (error) {
        console.error(`Error monitoring ${competitor.name}:`, error);
        this.emit('monitoring-error', { competitor: competitor.name, error });
      }
    }

    this.emit('website-monitoring-completed');
  }

  private async scrapeCompetitorWebsite(competitor: CompetitorProfile): Promise<void> {
    // Mock web scraping - in reality, this would use a web scraping service
    const mockData = {
      features: this.generateMockFeatures(competitor),
      pricing: this.generateMockPricing(competitor),
      news: this.generateMockNews(competitor)
    };

    const metrics: CompetitorMetrics = {
      competitorId: competitor.id,
      timestamp: new Date(),
      marketShare: this.calculateMarketShare(competitor),
      pricing: mockData.pricing,
      features: mockData.features,
      marketing: this.generateMockMarketing(competitor),
      social: this.generateMockSocial(competitor),
      financial: this.generateMockFinancial(competitor),
      technology: this.generateMockTechnology(competitor),
      customers: this.generateMockCustomers(competitor),
      hiring: this.generateMockHiring(competitor),
      news: mockData.news
    };

    this.metrics.set(`${competitor.id}-${Date.now()}`, metrics);
    await this.storeMetrics(metrics);
  }

  private generateMockFeatures(competitor: CompetitorProfile): FeatureComparison {
    const baseFeatures = [
      'Service Catalog',
      'API Documentation',
      'Template Gallery',
      'CI/CD Integration',
      'Monitoring Dashboard',
      'Cost Tracking',
      'RBAC',
      'Plugin System',
      'Multi-tenant',
      'Cloud Integration'
    ];

    const competitorFeatures = [...baseFeatures];
    
    // Add competitor-specific features
    if (competitor.name === 'Backstage.io') {
      competitorFeatures.push('Open Source', 'Extensible Architecture', 'Large Community');
    } else if (competitor.name === 'Port.run') {
      competitorFeatures.push('No-Code Setup', 'Advanced Automation', 'Entity Management');
    } else if (competitor.name === 'Cortex.io') {
      competitorFeatures.push('Service Scorecards', 'Deployment Tracking', 'On-call Management');
    }

    return {
      totalFeatures: competitorFeatures.length,
      newFeatures: competitorFeatures.slice(-2), // Last 2 as "new"
      removedFeatures: [],
      featureGaps: ['Advanced Analytics', 'AI-Powered Recommendations'],
      competitiveAdvantages: competitorFeatures.slice(0, 3),
      featureMatrix: Object.fromEntries(
        baseFeatures.map(feature => [feature, competitorFeatures.includes(feature)])
      ),
      lastUpdated: new Date()
    };
  }

  private generateMockPricing(competitor: CompetitorProfile): PricingIntel {
    const pricingMap: Record<string, Partial<PricingIntel>> = {
      'Backstage.io': {
        startingPrice: 0,
        enterprisePrice: 0,
        freeTier: true,
        trialDays: 0,
        pricingModel: 'freemium'
      },
      'Port.run': {
        startingPrice: 29,
        enterprisePrice: 299,
        freeTier: true,
        trialDays: 14,
        pricingModel: 'subscription'
      },
      'Cortex.io': {
        startingPrice: 19,
        enterprisePrice: 199,
        freeTier: false,
        trialDays: 30,
        pricingModel: 'subscription'
      },
      'Spotify Backstage Enterprise': {
        startingPrice: 50,
        enterprisePrice: 500,
        freeTier: false,
        trialDays: 30,
        pricingModel: 'subscription'
      }
    };

    const defaultPricing = {
      startingPrice: 25,
      enterprisePrice: 250,
      freeTier: true,
      trialDays: 14,
      pricingModel: 'subscription' as const
    };

    const pricing = { ...defaultPricing, ...pricingMap[competitor.name] };

    return {
      ...pricing,
      lastUpdated: new Date(),
      changes: [] // No recent changes in mock
    };
  }

  private generateMockNews(competitor: CompetitorProfile): NewsItem[] {
    const newsTypes: NewsItem['type'][] = ['funding', 'product', 'partnership', 'press'];
    
    return Array.from({ length: 3 }, (_, i) => ({
      title: `${competitor.name} ${newsTypes[i % newsTypes.length]} announcement`,
      source: 'TechCrunch',
      url: `https://techcrunch.com/${competitor.name.toLowerCase()}-news`,
      publishedAt: new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000),
      sentiment: 0.7 + Math.random() * 0.3,
      type: newsTypes[i % newsTypes.length],
      summary: `Recent development from ${competitor.name} regarding their platform capabilities`,
      impact: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as any
    }));
  }

  private generateMockMarketing(competitor: CompetitorProfile): MarketingIntel {
    return {
      campaigns: [
        {
          name: 'Developer Experience Campaign',
          type: 'awareness',
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          endDate: new Date(),
          channels: ['social', 'content', 'events'],
          effectiveness: 0.75
        }
      ],
      messaging: [
        'Streamline developer workflows',
        'Reduce cognitive load',
        'Accelerate time to market'
      ],
      positioning: 'The most comprehensive developer portal',
      targetAudience: ['Platform Engineers', 'DevOps Teams', 'Engineering Managers'],
      channels: ['LinkedIn', 'Twitter', 'GitHub', 'Developer Communities'],
      contentStrategy: 'Technical thought leadership and use cases',
      brandSentiment: 0.8,
      shareOfVoice: 0.15
    };
  }

  private generateMockSocial(competitor: CompetitorProfile): SocialIntel {
    const baseFollowers = competitor.fundingStage === 'public' ? 10000 : 
                         competitor.fundingStage === 'seriesB' ? 5000 : 2000;

    return {
      platforms: {
        twitter: {
          followers: baseFollowers,
          posts: 150,
          engagement: 0.05,
          growth: 0.15
        },
        linkedin: {
          followers: baseFollowers * 2,
          posts: 50,
          engagement: 0.08,
          growth: 0.20
        },
        github: {
          followers: baseFollowers * 0.5,
          posts: 200,
          engagement: 0.12,
          growth: 0.10
        }
      },
      engagement: 0.07,
      followers: baseFollowers * 3.5,
      growth: 0.15,
      mentions: 250,
      sentiment: 0.75
    };
  }

  private generateMockFinancial(competitor: CompetitorProfile): FinancialIntel {
    const fundingMap: Record<string, number> = {
      'seed': 2,
      'seriesA': 15,
      'seriesB': 50,
      'seriesC': 150,
      'public': 1000,
      'private': 100
    };

    const funding = fundingMap[competitor.fundingStage] || 10;
    
    return {
      revenue: funding * 2,
      growth: 1.5,
      funding,
      valuation: funding * 8,
      investors: ['Sequoia Capital', 'Andreessen Horowitz', 'General Catalyst'],
      lastFundingDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      lastFundingAmount: funding,
      burnRate: funding * 0.1,
      runway: 24
    };
  }

  private generateMockTechnology(competitor: CompetitorProfile): TechnologyIntel {
    return {
      techStack: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'Kubernetes'],
      integrations: ['GitHub', 'Jenkins', 'Jira', 'Slack', 'AWS', 'GCP'],
      apis: ['REST API', 'GraphQL', 'Webhooks'],
      infrastructure: ['AWS', 'Kubernetes', 'Docker', 'Terraform'],
      certifications: ['SOC2', 'ISO27001', 'GDPR'],
      patents: 3,
      openSource: competitor.name === 'Backstage.io'
    };
  }

  private generateMockCustomers(competitor: CompetitorProfile): CustomerIntel {
    const customerBase = competitor.fundingStage === 'public' ? 1000 : 
                        competitor.fundingStage === 'seriesB' ? 200 : 50;

    return {
      totalCustomers: customerBase,
      enterpriseCustomers: Math.floor(customerBase * 0.3),
      customerLogos: ['Netflix', 'Spotify', 'Airbnb', 'Uber', 'Shopify'],
      churnRate: 0.05,
      nps: 45,
      caseStudies: 12,
      testimonials: 25,
      winLossRatio: 0.65
    };
  }

  private generateMockHiring(competitor: CompetitorProfile): HiringIntel {
    return {
      totalEmployees: competitor.employees,
      growth: 0.25,
      openPositions: Math.floor(competitor.employees * 0.15),
      departments: {
        'Engineering': Math.floor(competitor.employees * 0.6),
        'Sales': Math.floor(competitor.employees * 0.2),
        'Marketing': Math.floor(competitor.employees * 0.1),
        'Other': Math.floor(competitor.employees * 0.1)
      },
      locations: [competitor.headquarters, 'Remote'],
      keyHires: [
        {
          name: 'Jane Smith',
          role: 'VP of Engineering',
          previousCompany: 'Google',
          startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          significance: 'high'
        }
      ]
    };
  }

  private calculateMarketShare(competitor: CompetitorProfile): number {
    // Mock market share calculation based on various factors
    let marketShare = 0.1; // Base 10%

    if (competitor.fundingStage === 'public') marketShare += 0.3;
    else if (competitor.fundingStage === 'seriesC') marketShare += 0.2;
    else if (competitor.fundingStage === 'seriesB') marketShare += 0.1;

    if (competitor.type === 'direct') marketShare += 0.1;
    if (competitor.employees > 500) marketShare += 0.1;
    if (competitor.foundedYear < 2015) marketShare += 0.05;

    return Math.min(marketShare, 0.4); // Cap at 40%
  }

  private async monitorPricingChanges(): Promise<void> {
    for (const competitor of this.competitors.values()) {
      if (!competitor.isActive) continue;

      // Get latest pricing data
      const latestMetrics = await this.getLatestMetrics(competitor.id);
      if (!latestMetrics) continue;

      // Compare with previous pricing
      const previousMetrics = await this.getPreviousMetrics(competitor.id);
      if (previousMetrics) {
        const pricingChanges = this.detectPricingChanges(
          previousMetrics.pricing,
          latestMetrics.pricing
        );

        if (pricingChanges.length > 0) {
          await this.alertPricingChanges(competitor, pricingChanges);
        }
      }
    }

    this.emit('pricing-monitoring-completed');
  }

  private detectPricingChanges(
    previous: PricingIntel,
    current: PricingIntel
  ): PricingChange[] {
    const changes: PricingChange[] = [];

    if (previous.startingPrice !== current.startingPrice) {
      changes.push({
        date: new Date(),
        type: current.startingPrice > previous.startingPrice ? 'increase' : 'decrease',
        description: `Starting price changed from $${previous.startingPrice} to $${current.startingPrice}`,
        impact: 'high'
      });
    }

    if (previous.enterprisePrice !== current.enterprisePrice) {
      changes.push({
        date: new Date(),
        type: current.enterprisePrice > previous.enterprisePrice ? 'increase' : 'decrease',
        description: `Enterprise price changed from $${previous.enterprisePrice} to $${current.enterprisePrice}`,
        impact: 'medium'
      });
    }

    return changes;
  }

  private async alertPricingChanges(
    competitor: CompetitorProfile,
    changes: PricingChange[]
  ): Promise<void> {
    for (const change of changes) {
      await prisma.alert.create({
        data: {
          name: `Competitor Pricing Change: ${competitor.name}`,
          severity: change.impact.toUpperCase(),
          source: 'competitive-intelligence',
          message: change.description,
          fingerprint: `pricing-change-${competitor.id}-${change.type}`,
          status: 'ACTIVE',
          metadata: {
            competitorId: competitor.id,
            competitorName: competitor.name,
            change
          }
        }
      });
    }

    this.emit('pricing-changes-detected', { competitor, changes });
  }

  private async monitorFeatureReleases(): Promise<void> {
    for (const competitor of this.competitors.values()) {
      if (!competitor.isActive) continue;

      // Mock feature release detection
      const newFeatures = await this.detectNewFeatures(competitor);
      if (newFeatures.length > 0) {
        await this.alertFeatureReleases(competitor, newFeatures);
      }
    }

    this.emit('feature-monitoring-completed');
  }

  private async detectNewFeatures(competitor: CompetitorProfile): Promise<string[]> {
    // Mock feature detection - in reality, this would analyze changelog, docs, etc.
    const possibleFeatures = [
      'AI-Powered Service Discovery',
      'Advanced Cost Analytics',
      'Multi-Cloud Support',
      'Service Mesh Integration',
      'GitOps Workflows',
      'Compliance Automation'
    ];

    // Randomly detect 0-2 new features
    const newFeatureCount = Math.floor(Math.random() * 3);
    return possibleFeatures.slice(0, newFeatureCount);
  }

  private async alertFeatureReleases(
    competitor: CompetitorProfile,
    features: string[]
  ): Promise<void> {
    for (const feature of features) {
      await prisma.alert.create({
        data: {
          name: `Competitor Feature Release: ${competitor.name}`,
          severity: 'MEDIUM',
          source: 'competitive-intelligence',
          message: `${competitor.name} released new feature: ${feature}`,
          fingerprint: `feature-release-${competitor.id}-${feature.replace(/\s+/g, '-')}`,
          status: 'ACTIVE',
          metadata: {
            competitorId: competitor.id,
            competitorName: competitor.name,
            feature
          }
        }
      });
    }

    this.emit('feature-releases-detected', { competitor, features });
  }

  private async monitorSocialMedia(): Promise<void> {
    // Mock social media monitoring
    for (const competitor of this.competitors.values()) {
      if (!competitor.isActive) continue;

      const socialMetrics = this.generateMockSocial(competitor);
      
      // Check for significant changes
      const previousMetrics = await this.getPreviousMetrics(competitor.id);
      if (previousMetrics) {
        const followerGrowth = (socialMetrics.followers - previousMetrics.social.followers) / previousMetrics.social.followers;
        const engagementChange = socialMetrics.engagement - previousMetrics.social.engagement;

        if (followerGrowth > 0.2) {
          this.emit('competitor-viral', { competitor, growth: followerGrowth });
        }

        if (engagementChange > 0.1) {
          this.emit('competitor-engagement-spike', { competitor, change: engagementChange });
        }
      }
    }

    this.emit('social-monitoring-completed');
  }

  private async monitorNews(): Promise<void> {
    for (const competitor of this.competitors.values()) {
      if (!competitor.isActive) continue;

      const news = this.generateMockNews(competitor);
      const highImpactNews = news.filter(n => n.impact === 'high');

      if (highImpactNews.length > 0) {
        for (const newsItem of highImpactNews) {
          await prisma.alert.create({
            data: {
              name: `Competitor News: ${competitor.name}`,
              severity: 'INFO',
              source: 'competitive-intelligence',
              message: newsItem.title,
              fingerprint: `news-${competitor.id}-${newsItem.title.replace(/\s+/g, '-')}`,
              status: 'ACTIVE',
              metadata: {
                competitorId: competitor.id,
                competitorName: competitor.name,
                newsItem
              }
            }
          });
        }

        this.emit('competitor-news', { competitor, news: highImpactNews });
      }
    }

    this.emit('news-monitoring-completed');
  }

  private async monitorHiring(): Promise<void> {
    for (const competitor of this.competitors.values()) {
      if (!competitor.isActive) continue;

      const hiringMetrics = this.generateMockHiring(competitor);
      
      // Alert on key hires
      const keyHires = hiringMetrics.keyHires.filter(h => h.significance === 'high');
      if (keyHires.length > 0) {
        for (const hire of keyHires) {
          await prisma.alert.create({
            data: {
              name: `Competitor Key Hire: ${competitor.name}`,
              severity: 'INFO',
              source: 'competitive-intelligence',
              message: `${competitor.name} hired ${hire.name} as ${hire.role} from ${hire.previousCompany}`,
              fingerprint: `key-hire-${competitor.id}-${hire.name.replace(/\s+/g, '-')}`,
              status: 'ACTIVE',
              metadata: {
                competitorId: competitor.id,
                competitorName: competitor.name,
                hire
              }
            }
          });
        }

        this.emit('competitor-key-hires', { competitor, hires: keyHires });
      }
    }

    this.emit('hiring-monitoring-completed');
  }

  private async analyzeMarketTrends(): Promise<void> {
    // Mock market trend analysis
    const trends = [
      {
        name: 'AI-Driven Developer Experience',
        description: 'Increasing adoption of AI tools in developer workflows',
        category: 'technology' as const,
        impact: 'positive' as const,
        confidence: 0.85,
        timeframe: 'medium' as const,
        sources: ['industry-reports', 'competitor-analysis', 'customer-feedback']
      },
      {
        name: 'Platform Engineering Maturity',
        description: 'Organizations investing heavily in platform engineering capabilities',
        category: 'market' as const,
        impact: 'positive' as const,
        confidence: 0.9,
        timeframe: 'short' as const,
        sources: ['survey-data', 'job-market-analysis', 'funding-trends']
      },
      {
        name: 'Multi-Cloud Strategy Adoption',
        description: 'Enterprises adopting multi-cloud strategies for better resilience',
        category: 'technology' as const,
        impact: 'positive' as const,
        confidence: 0.8,
        timeframe: 'medium' as const,
        sources: ['cloud-adoption-reports', 'enterprise-surveys']
      }
    ];

    for (const trendData of trends) {
      const trend: MarketTrend = {
        ...trendData,
        id: `trend-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date()
      };

      this.trends.set(trend.id, trend);
      
      // Store high-confidence trends
      if (trend.confidence > 0.8) {
        await prisma.marketTrend.create({
          data: {
            id: trend.id,
            name: trend.name,
            description: trend.description,
            category: trend.category,
            impact: trend.impact,
            confidence: trend.confidence,
            timeframe: trend.timeframe,
            sources: trend.sources
          }
        });
      }
    }

    this.emit('market-trends-analyzed', trends);
  }

  async recordWinLoss(analysis: Omit<WinLossAnalysis, 'id' | 'createdAt'>): Promise<WinLossAnalysis> {
    const winLoss: WinLossAnalysis = {
      ...analysis,
      id: `winloss-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date()
    };

    await prisma.winLossAnalysis.create({
      data: {
        id: winLoss.id,
        competitorId: winLoss.competitorId,
        outcome: winLoss.outcome,
        dealSize: winLoss.dealSize,
        reason: winLoss.reason,
        customerSegment: winLoss.customerSegment,
        salesCycle: winLoss.salesCycle,
        factors: winLoss.factors
      }
    });

    this.emit('win-loss-recorded', winLoss);
    return winLoss;
  }

  async getCompetitiveAnalysis(): Promise<any> {
    const competitors = Array.from(this.competitors.values())
      .filter(c => c.isActive)
      .slice(0, 10);

    const competitorMetrics = await Promise.all(
      competitors.map(async (competitor) => {
        const latestMetrics = await this.getLatestMetrics(competitor.id);
        return {
          competitor,
          metrics: latestMetrics
        };
      })
    );

    const marketTrends = Array.from(this.trends.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);

    // Get recent win/loss data
    const winLossData = await prisma.winLossAnalysis.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Last 90 days
        }
      },
      include: {
        competitor: true
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    // Calculate win rate by competitor
    const winRates = competitorMetrics.map(cm => {
      const competitorWinLoss = winLossData.filter(wl => wl.competitorId === cm.competitor.id);
      const wins = competitorWinLoss.filter(wl => wl.outcome === 'win').length;
      const total = competitorWinLoss.length;
      const winRate = total > 0 ? wins / total : 0;

      return {
        competitorName: cm.competitor.name,
        winRate,
        totalDeals: total,
        avgDealSize: total > 0 
          ? competitorWinLoss.reduce((sum, wl) => sum + wl.dealSize, 0) / total 
          : 0
      };
    });

    // Generate competitive insights
    const insights = this.generateCompetitiveInsights(competitorMetrics, marketTrends, winRates);

    return {
      competitors: competitorMetrics,
      marketTrends,
      winLossAnalysis: {
        data: winLossData,
        winRates
      },
      insights,
      lastUpdated: new Date()
    };
  }

  private generateCompetitiveInsights(
    competitors: any[],
    trends: MarketTrend[],
    winRates: any[]
  ): string[] {
    const insights: string[] = [];

    // Market position insights
    const directCompetitors = competitors.filter(c => c.competitor.type === 'direct');
    if (directCompetitors.length > 0) {
      const avgMarketShare = directCompetitors.reduce((sum, c) => 
        sum + (c.metrics?.marketShare || 0), 0) / directCompetitors.length;
      
      insights.push(`Average market share among direct competitors: ${(avgMarketShare * 100).toFixed(1)}%`);
    }

    // Pricing insights
    const pricingData = competitors
      .filter(c => c.metrics?.pricing)
      .map(c => c.metrics.pricing.startingPrice);
    
    if (pricingData.length > 0) {
      const avgPrice = pricingData.reduce((a, b) => a + b, 0) / pricingData.length;
      insights.push(`Average competitor starting price: $${avgPrice.toFixed(0)}/month`);
    }

    // Trend insights
    const positiveTrends = trends.filter(t => t.impact === 'positive' && t.confidence > 0.8);
    if (positiveTrends.length > 0) {
      insights.push(`${positiveTrends.length} high-confidence positive market trends identified`);
    }

    // Win rate insights
    const avgWinRate = winRates.reduce((sum, wr) => sum + wr.winRate, 0) / winRates.length;
    if (avgWinRate > 0) {
      insights.push(`Average win rate against competitors: ${(avgWinRate * 100).toFixed(1)}%`);
    }

    // Feature gap insights
    const featureGaps = competitors
      .flatMap(c => c.metrics?.features?.featureGaps || [])
      .reduce((acc, gap) => {
        acc[gap] = (acc[gap] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const commonGaps = Object.entries(featureGaps)
      .filter(([, count]) => count > 2)
      .map(([gap]) => gap);

    if (commonGaps.length > 0) {
      insights.push(`Common feature gaps identified: ${commonGaps.join(', ')}`);
    }

    return insights;
  }

  private async getLatestMetrics(competitorId: string): Promise<CompetitorMetrics | null> {
    const entries = Array.from(this.metrics.entries())
      .filter(([key]) => key.startsWith(competitorId))
      .sort((a, b) => b[1].timestamp.getTime() - a[1].timestamp.getTime());

    return entries.length > 0 ? entries[0][1] : null;
  }

  private async getPreviousMetrics(competitorId: string): Promise<CompetitorMetrics | null> {
    const entries = Array.from(this.metrics.entries())
      .filter(([key]) => key.startsWith(competitorId))
      .sort((a, b) => b[1].timestamp.getTime() - a[1].timestamp.getTime());

    return entries.length > 1 ? entries[1][1] : null;
  }

  private async storeMetrics(metrics: CompetitorMetrics): Promise<void> {
    await prisma.competitorMetrics.create({
      data: {
        competitorId: metrics.competitorId,
        timestamp: metrics.timestamp,
        marketShare: metrics.marketShare,
        pricing: metrics.pricing,
        features: metrics.features,
        marketing: metrics.marketing,
        social: metrics.social,
        financial: metrics.financial,
        technology: metrics.technology,
        customers: metrics.customers,
        hiring: metrics.hiring,
        news: metrics.news
      }
    });
  }

  cleanup(): void {
    this.monitoringJobs.forEach(job => clearInterval(job));
    this.monitoringJobs.clear();
  }
}