import { EventEmitter } from 'events';
import { prisma } from '@/lib/prisma';

interface CustomerProfile {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role: string;
  department: string;
  seniority: 'junior' | 'mid' | 'senior' | 'executive';
  segment: 'enterprise' | 'mid-market' | 'smb';
  accountValue: number;
  onboardingDate: Date;
  lastActivity: Date;
  isActive: boolean;
  tags: string[];
}

interface CustomerHealthMetrics {
  customerId: string;
  timestamp: Date;
  overallScore: number;
  engagement: EngagementMetrics;
  adoption: AdoptionMetrics;
  satisfaction: SatisfactionMetrics;
  business: BusinessMetrics;
  support: SupportMetrics;
  risk: RiskMetrics;
}

interface EngagementMetrics {
  loginFrequency: number; // logins per week
  sessionDuration: number; // average minutes
  featureUsage: number; // percentage of features used
  timeSpentPerWeek: number; // total minutes
  lastLoginDays: number; // days since last login
  engagementTrend: 'increasing' | 'stable' | 'decreasing';
}

interface AdoptionMetrics {
  timeToFirstValue: number; // days
  featuresAdopted: string[];
  adoptionRate: number; // percentage of available features
  advancedFeaturesUsed: number;
  integrationCount: number;
  automationUsage: number;
  adoptionStage: 'onboarding' | 'basic' | 'advanced' | 'power-user';
}

interface SatisfactionMetrics {
  npsScore: number;
  csatScore: number;
  cesScore: number; // Customer Effort Score
  feedbackSentiment: number; // -1 to 1
  surveyResponses: number;
  lastSurveyDate: Date;
  testimonialProvided: boolean;
  referralsMade: number;
}

interface BusinessMetrics {
  revenueGenerated: number;
  costSavings: number;
  timeToValue: number; // days
  roi: number;
  businessOutcomes: string[];
  growthPotential: number; // 0-1 score
  renewalProbability: number; // 0-1 score
}

interface SupportMetrics {
  ticketsCreated: number;
  ticketsResolved: number;
  avgResolutionTime: number; // hours
  escalationRate: number;
  selfServiceUsage: number;
  supportSatisfaction: number;
  criticalIssues: number;
}

interface RiskMetrics {
  churnRisk: number; // 0-1 score
  riskFactors: string[];
  renewalRisk: number; // 0-1 score
  contractEndDate: Date;
  paymentIssues: number;
  competitorMentions: number;
  negativeSignals: number;
  mitigationActions: string[];
}

interface CustomerJourney {
  customerId: string;
  stage: 'prospect' | 'trial' | 'onboarding' | 'adopted' | 'expanding' | 'at-risk' | 'churning';
  milestones: Milestone[];
  touchpoints: Touchpoint[];
  health: CustomerHealthMetrics;
  nextActions: NextAction[];
}

interface Milestone {
  id: string;
  name: string;
  description: string;
  achievedAt?: Date;
  daysToAchieve?: number;
  importance: 'low' | 'medium' | 'high' | 'critical';
  category: 'onboarding' | 'adoption' | 'expansion' | 'renewal';
}

interface Touchpoint {
  id: string;
  type: 'email' | 'call' | 'meeting' | 'support' | 'training' | 'webinar';
  timestamp: Date;
  outcome: 'positive' | 'neutral' | 'negative';
  notes: string;
  followUpRequired: boolean;
  csmId?: string;
}

interface NextAction {
  id: string;
  type: 'outreach' | 'training' | 'feature-demo' | 'business-review' | 'expansion-call';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate: Date;
  assignedTo: string;
  description: string;
  automated: boolean;
}

interface SuccessMetrics {
  totalCustomers: number;
  activeCustomers: number;
  healthyCustomers: number;
  atRiskCustomers: number;
  averageHealthScore: number;
  npsScore: number;
  churnRate: number;
  expansionRevenue: number;
  timeToValue: number;
  adoptionRate: number;
  supportSatisfaction: number;
}

interface ExpansionOpportunity {
  customerId: string;
  type: 'upsell' | 'cross-sell' | 'seat-expansion' | 'premium-features';
  potential: number; // revenue potential
  probability: number; // 0-1 score
  timeline: number; // days
  requirements: string[];
  champion?: string;
  decisionMakers: string[];
  competition?: string;
  status: 'identified' | 'qualified' | 'proposed' | 'negotiating' | 'closed-won' | 'closed-lost';
}

export class CustomerSuccess extends EventEmitter {
  private customers: Map<string, CustomerProfile> = new Map();
  private healthMetrics: Map<string, CustomerHealthMetrics> = new Map();
  private journeys: Map<string, CustomerJourney> = new Map();
  private opportunities: Map<string, ExpansionOpportunity> = new Map();
  private monitoringJobs: Map<string, NodeJS.Timeout> = new Map();
  
  constructor() {
    super();
    this.startMonitoring();
    this.initializeHealthScoring();
  }

  private startMonitoring() {
    // Calculate health scores every hour
    this.monitoringJobs.set('health-scoring', setInterval(
      () => this.calculateHealthScores(),
      60 * 60 * 1000
    ));

    // Identify at-risk customers every 6 hours
    this.monitoringJobs.set('risk-identification', setInterval(
      () => this.identifyAtRiskCustomers(),
      6 * 60 * 60 * 1000
    ));

    // Update customer journeys every 4 hours
    this.monitoringJobs.set('journey-updates', setInterval(
      () => this.updateCustomerJourneys(),
      4 * 60 * 60 * 1000
    ));

    // Identify expansion opportunities daily
    this.monitoringJobs.set('expansion-opportunities', setInterval(
      () => this.identifyExpansionOpportunities(),
      24 * 60 * 60 * 1000
    ));

    // Generate success insights every 12 hours
    this.monitoringJobs.set('success-insights', setInterval(
      () => this.generateSuccessInsights(),
      12 * 60 * 60 * 1000
    ));
  }

  private initializeHealthScoring() {
    // Define health scoring weights
    this.healthScoringWeights = {
      engagement: 0.25,
      adoption: 0.30,
      satisfaction: 0.20,
      business: 0.15,
      support: 0.10
    };
  }

  private healthScoringWeights: Record<string, number> = {};

  async addCustomer(customer: Omit<CustomerProfile, 'id'>): Promise<CustomerProfile> {
    const newCustomer: CustomerProfile = {
      ...customer,
      id: `customer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    this.customers.set(newCustomer.id, newCustomer);

    // Initialize customer journey
    await this.initializeCustomerJourney(newCustomer);

    // Store in database
    await prisma.customerProfile.create({
      data: {
        id: newCustomer.id,
        organizationId: newCustomer.organizationId,
        name: newCustomer.name,
        email: newCustomer.email,
        role: newCustomer.role,
        department: newCustomer.department,
        seniority: newCustomer.seniority,
        segment: newCustomer.segment,
        accountValue: newCustomer.accountValue,
        onboardingDate: newCustomer.onboardingDate,
        lastActivity: newCustomer.lastActivity,
        isActive: newCustomer.isActive,
        tags: newCustomer.tags
      }
    });

    this.emit('customer-added', newCustomer);
    return newCustomer;
  }

  private async initializeCustomerJourney(customer: CustomerProfile): Promise<void> {
    const journey: CustomerJourney = {
      customerId: customer.id,
      stage: 'onboarding',
      milestones: this.getDefaultMilestones(),
      touchpoints: [],
      health: await this.calculateCustomerHealth(customer.id),
      nextActions: this.generateInitialActions(customer)
    };

    this.journeys.set(customer.id, journey);

    await prisma.customerJourney.create({
      data: {
        customerId: customer.id,
        stage: journey.stage,
        milestones: journey.milestones,
        touchpoints: journey.touchpoints,
        nextActions: journey.nextActions
      }
    });
  }

  private getDefaultMilestones(): Milestone[] {
    return [
      {
        id: 'first-login',
        name: 'First Login',
        description: 'Customer successfully logs in for the first time',
        importance: 'critical',
        category: 'onboarding'
      },
      {
        id: 'profile-setup',
        name: 'Profile Setup Complete',
        description: 'Customer completes their profile and team setup',
        importance: 'high',
        category: 'onboarding'
      },
      {
        id: 'first-service',
        name: 'First Service Registered',
        description: 'Customer registers their first service in the catalog',
        importance: 'critical',
        category: 'adoption'
      },
      {
        id: 'first-template',
        name: 'First Template Used',
        description: 'Customer uses a template to create a new service',
        importance: 'high',
        category: 'adoption'
      },
      {
        id: 'team-collaboration',
        name: 'Team Collaboration',
        description: 'Multiple team members are actively using the platform',
        importance: 'high',
        category: 'adoption'
      },
      {
        id: 'advanced-features',
        name: 'Advanced Features Adoption',
        description: 'Customer adopts advanced features like monitoring, cost tracking',
        importance: 'medium',
        category: 'expansion'
      },
      {
        id: 'business-review',
        name: 'First Business Review',
        description: 'Successful business review meeting conducted',
        importance: 'high',
        category: 'expansion'
      },
      {
        id: 'contract-renewal',
        name: 'Contract Renewal',
        description: 'Customer successfully renews their contract',
        importance: 'critical',
        category: 'renewal'
      }
    ];
  }

  private generateInitialActions(customer: CustomerProfile): NextAction[] {
    return [
      {
        id: `welcome-call-${customer.id}`,
        type: 'outreach',
        priority: 'high',
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days
        assignedTo: 'csm-team',
        description: `Welcome call with ${customer.name} to introduce platform features`,
        automated: false
      },
      {
        id: `onboarding-email-${customer.id}`,
        type: 'outreach',
        priority: 'medium',
        dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day
        assignedTo: 'automated-system',
        description: 'Send onboarding email sequence',
        automated: true
      }
    ];
  }

  async calculateHealthScores(): Promise<void> {
    for (const customer of this.customers.values()) {
      if (!customer.isActive) continue;

      try {
        const healthMetrics = await this.calculateCustomerHealth(customer.id);
        this.healthMetrics.set(customer.id, healthMetrics);
        
        await this.storeHealthMetrics(healthMetrics);
        
        // Check for health score changes
        await this.checkHealthAlerts(customer, healthMetrics);
        
      } catch (error) {
        console.error(`Error calculating health for customer ${customer.id}:`, error);
      }
    }

    this.emit('health-scores-updated');
  }

  private async calculateCustomerHealth(customerId: string): Promise<CustomerHealthMetrics> {
    const customer = this.customers.get(customerId);
    if (!customer) {
      throw new Error(`Customer ${customerId} not found`);
    }

    const [engagement, adoption, satisfaction, business, support, risk] = await Promise.all([
      this.calculateEngagementMetrics(customerId),
      this.calculateAdoptionMetrics(customerId),
      this.calculateSatisfactionMetrics(customerId),
      this.calculateBusinessMetrics(customerId),
      this.calculateSupportMetrics(customerId),
      this.calculateRiskMetrics(customerId)
    ]);

    // Calculate overall health score
    const overallScore = (
      engagement.score * this.healthScoringWeights.engagement +
      adoption.score * this.healthScoringWeights.adoption +
      satisfaction.score * this.healthScoringWeights.satisfaction +
      business.score * this.healthScoringWeights.business +
      support.score * this.healthScoringWeights.support
    );

    return {
      customerId,
      timestamp: new Date(),
      overallScore,
      engagement: engagement.metrics,
      adoption: adoption.metrics,
      satisfaction: satisfaction.metrics,
      business: business.metrics,
      support: support.metrics,
      risk
    };
  }

  private async calculateEngagementMetrics(customerId: string): Promise<{ score: number; metrics: EngagementMetrics }> {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get user activity data
    const activities = await prisma.auditLog.findMany({
      where: {
        userId: customerId,
        timestamp: { gte: weekAgo }
      }
    });

    const sessions = await prisma.session.findMany({
      where: {
        userId: customerId,
        createdAt: { gte: weekAgo }
      }
    });

    // Calculate metrics
    const loginFrequency = sessions.length;
    const sessionDuration = sessions.length > 0
      ? sessions.reduce((sum, s) => sum + this.getSessionDuration(s), 0) / sessions.length
      : 0;

    const uniqueActions = new Set(activities.map(a => a.action)).size;
    const totalFeatures = 20; // Assume 20 total features
    const featureUsage = uniqueActions / totalFeatures;

    const totalTime = sessions.reduce((sum, s) => sum + this.getSessionDuration(s), 0);
    const timeSpentPerWeek = totalTime;

    const lastSession = sessions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    const lastLoginDays = lastSession 
      ? (now.getTime() - lastSession.createdAt.getTime()) / (24 * 60 * 60 * 1000)
      : 30;

    // Calculate trend
    const thisWeekActivity = activities.filter(a => a.timestamp >= weekAgo).length;
    const lastWeekActivity = await prisma.auditLog.count({
      where: {
        userId: customerId,
        timestamp: {
          gte: new Date(weekAgo.getTime() - 7 * 24 * 60 * 60 * 1000),
          lt: weekAgo
        }
      }
    });

    let engagementTrend: 'increasing' | 'stable' | 'decreasing';
    if (thisWeekActivity > lastWeekActivity * 1.1) engagementTrend = 'increasing';
    else if (thisWeekActivity < lastWeekActivity * 0.9) engagementTrend = 'decreasing';
    else engagementTrend = 'stable';

    const metrics: EngagementMetrics = {
      loginFrequency,
      sessionDuration,
      featureUsage: featureUsage * 100,
      timeSpentPerWeek,
      lastLoginDays,
      engagementTrend
    };

    // Calculate engagement score (0-100)
    let score = 0;
    score += Math.min(loginFrequency / 5 * 25, 25); // Max 25 points for 5+ logins/week
    score += Math.min(sessionDuration / 30 * 25, 25); // Max 25 points for 30+ min sessions
    score += featureUsage * 25; // Max 25 points for 100% feature usage
    score += Math.max(0, 25 - lastLoginDays * 5); // Lose 5 points per day since last login

    return {
      score: Math.max(0, Math.min(100, score)),
      metrics
    };
  }

  private getSessionDuration(session: any): number {
    // Mock session duration calculation
    return Math.random() * 60 + 10; // 10-70 minutes
  }

  private async calculateAdoptionMetrics(customerId: string): Promise<{ score: number; metrics: AdoptionMetrics }> {
    const customer = this.customers.get(customerId);
    if (!customer) throw new Error('Customer not found');

    // Mock adoption data - in reality, track actual feature usage
    const timeToFirstValue = Math.floor(
      (new Date().getTime() - customer.onboardingDate.getTime()) / (24 * 60 * 60 * 1000)
    );

    const allFeatures = [
      'service-catalog', 'api-docs', 'templates', 'monitoring',
      'cost-tracking', 'ci-cd-integration', 'team-management',
      'rbac', 'notifications', 'search', 'analytics', 'plugins'
    ];

    const adoptedFeatures = allFeatures.slice(0, Math.floor(Math.random() * allFeatures.length));
    const adoptionRate = (adoptedFeatures.length / allFeatures.length) * 100;

    const advancedFeatures = ['monitoring', 'cost-tracking', 'analytics', 'plugins'];
    const advancedFeaturesUsed = adoptedFeatures.filter(f => advancedFeatures.includes(f)).length;

    const integrationCount = Math.floor(Math.random() * 8) + 1; // 1-8 integrations
    const automationUsage = Math.floor(Math.random() * 50) + 10; // 10-60% automation usage

    let adoptionStage: 'onboarding' | 'basic' | 'advanced' | 'power-user';
    if (adoptionRate < 25) adoptionStage = 'onboarding';
    else if (adoptionRate < 50) adoptionStage = 'basic';
    else if (adoptionRate < 75) adoptionStage = 'advanced';
    else adoptionStage = 'power-user';

    const metrics: AdoptionMetrics = {
      timeToFirstValue,
      featuresAdopted: adoptedFeatures,
      adoptionRate,
      advancedFeaturesUsed,
      integrationCount,
      automationUsage,
      adoptionStage
    };

    // Calculate adoption score
    let score = 0;
    score += adoptionRate * 0.4; // 40 points max for feature adoption
    score += Math.min(advancedFeaturesUsed / 4 * 20, 20); // 20 points max for advanced features
    score += Math.min(integrationCount / 5 * 20, 20); // 20 points max for integrations
    score += automationUsage * 0.2; // 20 points max for automation

    return {
      score: Math.max(0, Math.min(100, score)),
      metrics
    };
  }

  private async calculateSatisfactionMetrics(customerId: string): Promise<{ score: number; metrics: SatisfactionMetrics }> {
    // Mock satisfaction data
    const npsScore = Math.floor(Math.random() * 100) - 10; // -10 to 90
    const csatScore = Math.random() * 2 + 3; // 3-5 scale
    const cesScore = Math.random() * 2 + 3; // 3-5 scale
    const feedbackSentiment = Math.random() * 2 - 1; // -1 to 1
    const surveyResponses = Math.floor(Math.random() * 10);
    const testimonialProvided = Math.random() > 0.8;
    const referralsMade = Math.floor(Math.random() * 3);

    const metrics: SatisfactionMetrics = {
      npsScore,
      csatScore,
      cesScore,
      feedbackSentiment,
      surveyResponses,
      lastSurveyDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      testimonialProvided,
      referralsMade
    };

    // Calculate satisfaction score
    let score = 0;
    score += Math.max(0, (npsScore + 10) / 100 * 30); // 30 points max for NPS
    score += (csatScore - 3) / 2 * 30; // 30 points max for CSAT
    score += (cesScore - 3) / 2 * 20; // 20 points max for CES
    score += (feedbackSentiment + 1) / 2 * 10; // 10 points max for sentiment
    score += testimonialProvided ? 5 : 0; // 5 points for testimonial
    score += referralsMade * 5; // 5 points per referral

    return {
      score: Math.max(0, Math.min(100, score)),
      metrics
    };
  }

  private async calculateBusinessMetrics(customerId: string): Promise<{ score: number; metrics: BusinessMetrics }> {
    const customer = this.customers.get(customerId);
    if (!customer) throw new Error('Customer not found');

    // Mock business metrics
    const revenueGenerated = customer.accountValue * (0.5 + Math.random() * 2); // 0.5x to 2.5x account value
    const costSavings = customer.accountValue * (0.2 + Math.random() * 0.8); // 0.2x to 1x account value
    const timeToValue = Math.floor(Math.random() * 60) + 7; // 7-67 days
    const roi = ((revenueGenerated + costSavings) / customer.accountValue - 1) * 100;

    const businessOutcomes = [
      'Reduced deployment time by 40%',
      'Improved developer productivity',
      'Better service reliability',
      'Faster onboarding of new services'
    ];

    const growthPotential = Math.random(); // 0-1 score
    const renewalProbability = Math.random() * 0.4 + 0.6; // 0.6-1.0 (biased positive)

    const metrics: BusinessMetrics = {
      revenueGenerated,
      costSavings,
      timeToValue,
      roi,
      businessOutcomes,
      growthPotential,
      renewalProbability
    };

    // Calculate business score
    let score = 0;
    score += Math.min(roi / 200 * 40, 40); // 40 points max for ROI (200% = max)
    score += Math.min(timeToValue > 30 ? 0 : (30 - timeToValue) / 30 * 20, 20); // 20 points for quick time to value
    score += growthPotential * 20; // 20 points max for growth potential
    score += renewalProbability * 20; // 20 points max for renewal probability

    return {
      score: Math.max(0, Math.min(100, score)),
      metrics
    };
  }

  private async calculateSupportMetrics(customerId: string): Promise<{ score: number; metrics: SupportMetrics }> {
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Get support tickets (using notifications as proxy)
    const tickets = await prisma.notification.findMany({
      where: {
        userId: customerId,
        type: 'error',
        createdAt: { gte: monthAgo }
      }
    });

    const ticketsCreated = tickets.length;
    const ticketsResolved = Math.floor(ticketsCreated * 0.9); // 90% resolution rate
    const avgResolutionTime = 4 + Math.random() * 8; // 4-12 hours
    const escalationRate = Math.random() * 0.2; // 0-20%
    const selfServiceUsage = Math.random() * 0.8 + 0.2; // 20-100%
    const supportSatisfaction = Math.random() * 2 + 3; // 3-5 scale
    const criticalIssues = Math.floor(ticketsCreated * 0.1); // 10% critical

    const metrics: SupportMetrics = {
      ticketsCreated,
      ticketsResolved,
      avgResolutionTime,
      escalationRate,
      selfServiceUsage,
      supportSatisfaction,
      criticalIssues
    };

    // Calculate support score (higher is better, fewer tickets = better)
    let score = 100;
    score -= Math.min(ticketsCreated * 5, 30); // Lose points for tickets
    score -= criticalIssues * 10; // Lose more for critical issues
    score -= escalationRate * 20; // Lose points for escalations
    score += (supportSatisfaction - 3) / 2 * 20; // Gain points for satisfaction
    score += selfServiceUsage * 10; // Gain points for self-service

    return {
      score: Math.max(0, Math.min(100, score)),
      metrics
    };
  }

  private async calculateRiskMetrics(customerId: string): Promise<RiskMetrics> {
    const customer = this.customers.get(customerId);
    if (!customer) throw new Error('Customer not found');

    const healthMetrics = this.healthMetrics.get(customerId);
    
    // Calculate churn risk based on various factors
    let churnRisk = 0;
    const riskFactors: string[] = [];

    // Health score impact
    if (healthMetrics && healthMetrics.overallScore < 60) {
      churnRisk += 0.3;
      riskFactors.push('Low health score');
    }

    // Low engagement
    if (healthMetrics && healthMetrics.engagement.lastLoginDays > 14) {
      churnRisk += 0.2;
      riskFactors.push('Low engagement');
    }

    // Support issues
    if (healthMetrics && healthMetrics.support.criticalIssues > 2) {
      churnRisk += 0.15;
      riskFactors.push('Multiple critical issues');
    }

    // Contract timing
    const contractEndDate = new Date(customer.onboardingDate.getTime() + 365 * 24 * 60 * 60 * 1000);
    const daysToRenewal = (contractEndDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    if (daysToRenewal < 90) {
      churnRisk += 0.1;
      riskFactors.push('Contract renewal approaching');
    }

    // Payment issues (mock)
    const paymentIssues = Math.random() > 0.9 ? 1 : 0;
    if (paymentIssues > 0) {
      churnRisk += 0.2;
      riskFactors.push('Payment issues');
    }

    // Competitor mentions (mock)
    const competitorMentions = Math.floor(Math.random() * 3);
    if (competitorMentions > 0) {
      churnRisk += competitorMentions * 0.1;
      riskFactors.push('Competitor mentions');
    }

    const renewalRisk = Math.min(churnRisk * 1.2, 1); // Renewal risk slightly higher
    const negativeSignals = riskFactors.length;

    // Mitigation actions
    const mitigationActions: string[] = [];
    if (churnRisk > 0.5) {
      mitigationActions.push('Schedule immediate health check call');
      mitigationActions.push('Review account success plan');
    }
    if (churnRisk > 0.3) {
      mitigationActions.push('Increase touchpoint frequency');
      mitigationActions.push('Provide additional training');
    }

    return {
      churnRisk: Math.min(churnRisk, 1),
      riskFactors,
      renewalRisk,
      contractEndDate,
      paymentIssues,
      competitorMentions,
      negativeSignals,
      mitigationActions
    };
  }

  private async checkHealthAlerts(customer: CustomerProfile, health: CustomerHealthMetrics): Promise<void> {
    // Health score alerts
    if (health.overallScore < 60 && health.overallScore >= 40) {
      await this.createAlert(customer, 'MEDIUM', 'Customer health score is declining', {
        score: health.overallScore,
        type: 'health-warning'
      });
    } else if (health.overallScore < 40) {
      await this.createAlert(customer, 'HIGH', 'Customer health score is critically low', {
        score: health.overallScore,
        type: 'health-critical'
      });
    }

    // Engagement alerts
    if (health.engagement.lastLoginDays > 7) {
      await this.createAlert(customer, 'MEDIUM', 'Customer has not logged in recently', {
        lastLoginDays: health.engagement.lastLoginDays,
        type: 'engagement-low'
      });
    }

    // Risk alerts
    if (health.risk.churnRisk > 0.7) {
      await this.createAlert(customer, 'HIGH', 'Customer has high churn risk', {
        churnRisk: health.risk.churnRisk,
        riskFactors: health.risk.riskFactors,
        type: 'churn-risk'
      });
    }

    // Contract renewal alerts
    const daysToRenewal = (health.risk.contractEndDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    if (daysToRenewal < 90 && daysToRenewal > 0) {
      await this.createAlert(customer, 'INFO', 'Contract renewal approaching', {
        daysToRenewal: Math.floor(daysToRenewal),
        type: 'renewal-reminder'
      });
    }
  }

  private async createAlert(
    customer: CustomerProfile,
    severity: string,
    message: string,
    metadata: any
  ): Promise<void> {
    await prisma.alert.create({
      data: {
        name: `Customer Success Alert: ${customer.name}`,
        severity,
        source: 'customer-success',
        message,
        fingerprint: `cs-${customer.id}-${metadata.type}`,
        status: 'ACTIVE',
        metadata: {
          customerId: customer.id,
          customerName: customer.name,
          ...metadata
        }
      }
    });

    this.emit('customer-alert', { customer, severity, message, metadata });
  }

  async identifyAtRiskCustomers(): Promise<void> {
    const atRiskCustomers = [];

    for (const [customerId, health] of this.healthMetrics.entries()) {
      if (health.risk.churnRisk > 0.5 || health.overallScore < 50) {
        const customer = this.customers.get(customerId);
        if (customer) {
          atRiskCustomers.push({
            customer,
            health,
            riskScore: Math.max(health.risk.churnRisk, (100 - health.overallScore) / 100)
          });
        }
      }
    }

    // Sort by risk score
    atRiskCustomers.sort((a, b) => b.riskScore - a.riskScore);

    // Generate next actions for top at-risk customers
    for (const atRisk of atRiskCustomers.slice(0, 10)) {
      await this.generateRiskMitigationActions(atRisk.customer, atRisk.health);
    }

    this.emit('at-risk-customers-identified', atRiskCustomers);
  }

  private async generateRiskMitigationActions(
    customer: CustomerProfile,
    health: CustomerHealthMetrics
  ): Promise<void> {
    const journey = this.journeys.get(customer.id);
    if (!journey) return;

    const actions: NextAction[] = [];

    // Health-based actions
    if (health.overallScore < 50) {
      actions.push({
        id: `health-check-${customer.id}-${Date.now()}`,
        type: 'outreach',
        priority: 'high',
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        assignedTo: 'csm-team',
        description: 'Conduct health check call to understand issues',
        automated: false
      });
    }

    // Engagement-based actions
    if (health.engagement.lastLoginDays > 14) {
      actions.push({
        id: `re-engagement-${customer.id}-${Date.now()}`,
        type: 'training',
        priority: 'medium',
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        assignedTo: 'training-team',
        description: 'Provide refresher training on key features',
        automated: false
      });
    }

    // Adoption-based actions
    if (health.adoption.adoptionRate < 50) {
      actions.push({
        id: `feature-demo-${customer.id}-${Date.now()}`,
        type: 'feature-demo',
        priority: 'medium',
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        assignedTo: 'solutions-engineer',
        description: 'Demo advanced features to increase adoption',
        automated: false
      });
    }

    // Add actions to journey
    journey.nextActions.push(...actions);
    await this.updateCustomerJourney(journey);
  }

  async updateCustomerJourneys(): Promise<void> {
    for (const journey of this.journeys.values()) {
      await this.updateJourneyStage(journey);
      await this.checkMilestoneProgress(journey);
    }

    this.emit('customer-journeys-updated');
  }

  private async updateJourneyStage(journey: CustomerJourney): Promise<void> {
    const health = this.healthMetrics.get(journey.customerId);
    if (!health) return;

    let newStage = journey.stage;

    // Stage progression logic
    if (journey.stage === 'onboarding' && health.adoption.adoptionRate > 25) {
      newStage = 'adopted';
    } else if (journey.stage === 'adopted' && health.business.renewalProbability > 0.8) {
      newStage = 'expanding';
    } else if (health.risk.churnRisk > 0.6) {
      newStage = 'at-risk';
    } else if (health.risk.churnRisk > 0.8) {
      newStage = 'churning';
    }

    if (newStage !== journey.stage) {
      journey.stage = newStage;
      await this.updateCustomerJourney(journey);
      this.emit('customer-stage-changed', { customerId: journey.customerId, stage: newStage });
    }
  }

  private async checkMilestoneProgress(journey: CustomerJourney): Promise<void> {
    const customer = this.customers.get(journey.customerId);
    if (!customer) return;

    for (const milestone of journey.milestones) {
      if (milestone.achievedAt) continue; // Already achieved

      const achieved = await this.checkMilestoneAchievement(customer, milestone);
      if (achieved) {
        milestone.achievedAt = new Date();
        milestone.daysToAchieve = Math.floor(
          (Date.now() - customer.onboardingDate.getTime()) / (24 * 60 * 60 * 1000)
        );

        await this.updateCustomerJourney(journey);
        this.emit('milestone-achieved', { customer, milestone });
      }
    }
  }

  private async checkMilestoneAchievement(customer: CustomerProfile, milestone: Milestone): Promise<boolean> {
    // Mock milestone achievement logic
    switch (milestone.id) {
      case 'first-login':
        return customer.lastActivity > customer.onboardingDate;
      case 'profile-setup':
        return true; // Assume completed after onboarding
      case 'first-service':
        // Check if customer has registered a service
        const serviceCount = await prisma.service.count({
          where: { ownerId: customer.id }
        });
        return serviceCount > 0;
      case 'first-template':
        // Check if customer has used a template
        const templateUsage = await prisma.templateExecution.count({
          where: { userId: customer.id }
        });
        return templateUsage > 0;
      default:
        return Math.random() > 0.7; // 30% chance of achievement
    }
  }

  async identifyExpansionOpportunities(): Promise<void> {
    for (const [customerId, health] of this.healthMetrics.entries()) {
      if (health.overallScore > 70 && health.business.growthPotential > 0.6) {
        const opportunities = await this.generateExpansionOpportunities(customerId, health);
        
        for (const opportunity of opportunities) {
          this.opportunities.set(opportunity.customerId, opportunity);
          await this.storeExpansionOpportunity(opportunity);
        }
      }
    }

    this.emit('expansion-opportunities-identified');
  }

  private async generateExpansionOpportunities(
    customerId: string,
    health: CustomerHealthMetrics
  ): Promise<ExpansionOpportunity[]> {
    const customer = this.customers.get(customerId);
    if (!customer) return [];

    const opportunities: ExpansionOpportunity[] = [];

    // Seat expansion opportunity
    if (health.adoption.adoptionStage === 'power-user') {
      opportunities.push({
        customerId,
        type: 'seat-expansion',
        potential: customer.accountValue * 0.5,
        probability: 0.7,
        timeline: 60,
        requirements: ['Demonstrate team growth', 'Show usage metrics'],
        decisionMakers: ['Engineering Manager', 'CTO'],
        status: 'identified'
      });
    }

    // Premium features upsell
    if (health.adoption.advancedFeaturesUsed < 2) {
      opportunities.push({
        customerId,
        type: 'premium-features',
        potential: customer.accountValue * 0.3,
        probability: 0.6,
        timeline: 45,
        requirements: ['Feature demo', 'ROI analysis'],
        decisionMakers: ['Platform Lead', 'Engineering Manager'],
        status: 'identified'
      });
    }

    return opportunities;
  }

  async getSuccessMetrics(): Promise<SuccessMetrics> {
    const totalCustomers = this.customers.size;
    const activeCustomers = Array.from(this.customers.values())
      .filter(c => c.isActive).length;

    const healthScores = Array.from(this.healthMetrics.values())
      .map(h => h.overallScore);
    
    const healthyCustomers = healthScores.filter(score => score > 70).length;
    const atRiskCustomers = healthScores.filter(score => score < 50).length;
    const averageHealthScore = healthScores.length > 0 
      ? healthScores.reduce((sum, score) => sum + score, 0) / healthScores.length 
      : 0;

    // Calculate other metrics
    const satisfactionScores = Array.from(this.healthMetrics.values())
      .map(h => h.satisfaction.npsScore);
    const npsScore = satisfactionScores.length > 0
      ? satisfactionScores.reduce((sum, score) => sum + score, 0) / satisfactionScores.length
      : 0;

    const supportScores = Array.from(this.healthMetrics.values())
      .map(h => h.support.supportSatisfaction);
    const supportSatisfaction = supportScores.length > 0
      ? supportScores.reduce((sum, score) => sum + score, 0) / supportScores.length
      : 0;

    // Mock some metrics
    const churnRate = 0.05; // 5% monthly churn
    const expansionRevenue = Array.from(this.opportunities.values())
      .reduce((sum, opp) => sum + opp.potential * opp.probability, 0);
    const timeToValue = 14; // 14 days average
    const adoptionRate = 0.65; // 65% average adoption

    return {
      totalCustomers,
      activeCustomers,
      healthyCustomers,
      atRiskCustomers,
      averageHealthScore,
      npsScore,
      churnRate,
      expansionRevenue,
      timeToValue,
      adoptionRate,
      supportSatisfaction
    };
  }

  async generateSuccessInsights(): Promise<string[]> {
    const metrics = await this.getSuccessMetrics();
    const insights: string[] = [];

    // Health insights
    if (metrics.averageHealthScore > 75) {
      insights.push('Customer health is excellent - consider expansion opportunities');
    } else if (metrics.averageHealthScore < 60) {
      insights.push('Customer health needs attention - focus on retention strategies');
    }

    // At-risk insights
    if (metrics.atRiskCustomers > metrics.totalCustomers * 0.2) {
      insights.push('High number of at-risk customers detected - immediate action required');
    }

    // NPS insights
    if (metrics.npsScore > 50) {
      insights.push('Strong NPS score - leverage for referrals and testimonials');
    } else if (metrics.npsScore < 30) {
      insights.push('Low NPS score - investigate satisfaction issues');
    }

    // Expansion insights
    if (metrics.expansionRevenue > 100000) {
      insights.push(`Significant expansion opportunity identified: $${metrics.expansionRevenue.toLocaleString()}`);
    }

    // Adoption insights
    if (metrics.adoptionRate < 0.5) {
      insights.push('Low adoption rate - focus on onboarding and training');
    }

    this.emit('success-insights-generated', insights);
    return insights;
  }

  private async storeHealthMetrics(metrics: CustomerHealthMetrics): Promise<void> {
    await prisma.customerHealthMetrics.create({
      data: {
        customerId: metrics.customerId,
        timestamp: metrics.timestamp,
        overallScore: metrics.overallScore,
        engagement: metrics.engagement,
        adoption: metrics.adoption,
        satisfaction: metrics.satisfaction,
        business: metrics.business,
        support: metrics.support,
        risk: metrics.risk
      }
    });
  }

  private async updateCustomerJourney(journey: CustomerJourney): Promise<void> {
    await prisma.customerJourney.upsert({
      where: { customerId: journey.customerId },
      update: {
        stage: journey.stage,
        milestones: journey.milestones,
        touchpoints: journey.touchpoints,
        nextActions: journey.nextActions
      },
      create: {
        customerId: journey.customerId,
        stage: journey.stage,
        milestones: journey.milestones,
        touchpoints: journey.touchpoints,
        nextActions: journey.nextActions
      }
    });
  }

  private async storeExpansionOpportunity(opportunity: ExpansionOpportunity): Promise<void> {
    await prisma.expansionOpportunity.create({
      data: {
        customerId: opportunity.customerId,
        type: opportunity.type,
        potential: opportunity.potential,
        probability: opportunity.probability,
        timeline: opportunity.timeline,
        requirements: opportunity.requirements,
        champion: opportunity.champion,
        decisionMakers: opportunity.decisionMakers,
        competition: opportunity.competition,
        status: opportunity.status
      }
    });
  }

  cleanup(): void {
    this.monitoringJobs.forEach(job => clearInterval(job));
    this.monitoringJobs.clear();
  }
}