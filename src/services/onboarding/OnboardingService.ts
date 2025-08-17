/**
 * Customer Onboarding Service
 * Handles end-to-end customer onboarding automation
 */

import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';
import { randomBytes } from 'crypto';
import {
  AccountType,
  OnboardingStatus,
  OnboardingSession,
  CustomerProfile,
  Organization,
  TrialAccount,
  TrialStatus,
  OnboardingStep,
  OnboardingAnalytics,
  CustomerHealthScore,
  OnboardingWebhookEvent,
  OnboardingEventType,
  OrganizationSize
} from './types';
import { EmailService } from './EmailService';
import { DemoDataGenerator } from './DemoDataGenerator';
import { IntegrationSetupService } from './IntegrationSetupService';
import { ProductTourService } from './ProductTourService';
import { HealthScoreCalculator } from './HealthScoreCalculator';
import { AnalyticsTracker } from './AnalyticsTracker';

export class OnboardingService {
  private prisma: PrismaClient;
  private redis: Redis;
  private logger: Logger;
  private emailService: EmailService;
  private demoDataGenerator: DemoDataGenerator;
  private integrationService: IntegrationSetupService;
  private tourService: ProductTourService;
  private healthCalculator: HealthScoreCalculator;
  private analytics: AnalyticsTracker;

  constructor(
    prisma: PrismaClient,
    redis: Redis,
    logger: Logger
  ) {
    this.prisma = prisma;
    this.redis = redis;
    this.logger = logger;
    this.emailService = new EmailService(logger);
    this.demoDataGenerator = new DemoDataGenerator(prisma, logger);
    this.integrationService = new IntegrationSetupService(prisma, logger);
    this.tourService = new ProductTourService(logger);
    this.healthCalculator = new HealthScoreCalculator(prisma, logger);
    this.analytics = new AnalyticsTracker(redis, logger);
  }

  /**
   * Start trial signup process
   */
  async startTrialSignup(data: {
    email: string;
    firstName: string;
    lastName: string;
    company: string;
    role: string;
    source?: string;
    referrer?: string;
  }): Promise<{ sessionId: string; verificationToken: string }> {
    this.logger.info({ email: data.email }, 'Starting trial signup');

    try {
      // Check for existing account
      const existingUser = await this.prisma.user.findUnique({
        where: { email: data.email }
      });

      if (existingUser) {
        throw new Error('Account already exists with this email');
      }

      // Generate verification token
      const verificationToken = randomBytes(32).toString('hex');
      const sessionId = randomBytes(16).toString('hex');

      // Create onboarding session
      const session: OnboardingSession = {
        id: sessionId,
        customerId: '', // Will be set after email verification
        organizationId: '', // Will be set after org setup
        accountType: AccountType.TRIAL,
        status: OnboardingStatus.EMAIL_VERIFICATION_PENDING,
        currentStep: 0,
        steps: this.getTrialOnboardingSteps(),
        startedAt: new Date(),
        timeSpentMinutes: 0,
        completionPercentage: 0,
        metadata: {
          source: data.source || 'organic',
          referrer: data.referrer || '',
          deviceType: 'web',
          browser: '',
          ipAddress: '',
          country: ''
        }
      };

      // Store session in Redis (24 hour expiry)
      await this.redis.setex(
        `onboarding:session:${sessionId}`,
        86400,
        JSON.stringify(session)
      );

      // Store verification data
      await this.redis.setex(
        `onboarding:verify:${verificationToken}`,
        3600, // 1 hour expiry
        JSON.stringify({
          sessionId,
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          company: data.company,
          role: data.role
        })
      );

      // Send verification email
      await this.emailService.sendVerificationEmail({
        email: data.email,
        firstName: data.firstName,
        verificationToken
      });

      // Track event
      await this.trackEvent({
        type: OnboardingEventType.SIGNUP_STARTED,
        customerId: '',
        organizationId: '',
        data: { email: data.email, company: data.company }
      });

      // Update analytics
      await this.analytics.trackSignup(data.source || 'organic');

      return { sessionId, verificationToken };
    } catch (error) {
      this.logger.error({ error, email: data.email }, 'Trial signup failed');
      throw error;
    }
  }

  /**
   * Verify email and create account
   */
  async verifyEmailAndCreateAccount(
    verificationToken: string
  ): Promise<{ customerId: string; sessionId: string }> {
    this.logger.info('Verifying email and creating account');

    try {
      // Get verification data
      const verifyData = await this.redis.get(`onboarding:verify:${verificationToken}`);
      if (!verifyData) {
        throw new Error('Invalid or expired verification token');
      }

      const data = JSON.parse(verifyData);
      const session = await this.getOnboardingSession(data.sessionId);

      // Create user account
      const user = await this.prisma.user.create({
        data: {
          email: data.email,
          name: `${data.firstName} ${data.lastName}`,
          provider: 'local',
          providerId: data.email,
          role: 'DEVELOPER',
          isActive: true
        }
      });

      // Create organization
      const org = await this.prisma.$queryRaw`
        INSERT INTO organizations (
          id, name, domain, owner_id, subscription_type, 
          trial_ends_at, created_at, updated_at
        ) VALUES (
          gen_random_uuid(),
          ${data.company},
          ${data.email.split('@')[1]},
          ${user.id},
          'TRIAL',
          NOW() + INTERVAL '14 days',
          NOW(),
          NOW()
        )
        RETURNING id, name
      `;

      const organizationId = (org as any)[0].id;

      // Create trial account
      const trial = await this.createTrialAccount(user.id, organizationId);

      // Update session
      session.customerId = user.id;
      session.organizationId = organizationId;
      session.status = OnboardingStatus.EMAIL_VERIFIED;
      session.currentStep = 1;
      session.steps[0].completed = true;
      session.steps[0].completedAt = new Date();
      session.completionPercentage = 20;

      await this.redis.setex(
        `onboarding:session:${session.id}`,
        86400,
        JSON.stringify(session)
      );

      // Send welcome email
      await this.emailService.sendWelcomeEmail({
        email: data.email,
        firstName: data.firstName,
        trialDays: 14
      });

      // Track event
      await this.trackEvent({
        type: OnboardingEventType.EMAIL_VERIFIED,
        customerId: user.id,
        organizationId,
        data: { email: data.email }
      });

      // Generate demo data for trial
      await this.demoDataGenerator.generateForTrial(organizationId);

      // Delete verification token
      await this.redis.del(`onboarding:verify:${verificationToken}`);

      return { customerId: user.id, sessionId: session.id };
    } catch (error) {
      this.logger.error({ error }, 'Email verification failed');
      throw error;
    }
  }

  /**
   * Setup organization profile
   */
  async setupOrganization(
    sessionId: string,
    data: {
      size: OrganizationSize;
      industry: string;
      website?: string;
      timezone: string;
    }
  ): Promise<void> {
    this.logger.info({ sessionId }, 'Setting up organization');

    try {
      const session = await this.getOnboardingSession(sessionId);

      // Update organization
      await this.prisma.$queryRaw`
        UPDATE organizations 
        SET 
          size = ${data.size},
          industry = ${data.industry},
          website = ${data.website},
          timezone = ${data.timezone},
          updated_at = NOW()
        WHERE id = ${session.organizationId}
      `;

      // Update session
      session.status = OnboardingStatus.ORGANIZATION_SETUP;
      session.currentStep = 2;
      session.steps[1].completed = true;
      session.steps[1].completedAt = new Date();
      session.completionPercentage = 40;

      await this.redis.setex(
        `onboarding:session:${sessionId}`,
        86400,
        JSON.stringify(session)
      );

      // Track progress
      await this.analytics.trackStepCompletion('organization_setup', sessionId);
    } catch (error) {
      this.logger.error({ error, sessionId }, 'Organization setup failed');
      throw error;
    }
  }

  /**
   * Setup integrations
   */
  async setupIntegrations(
    sessionId: string,
    integrations: {
      github?: { token: string; org: string };
      gitlab?: { token: string; url: string };
      jenkins?: { url: string; username: string; token: string };
      aws?: { accountId: string; region: string; roleArn: string };
      slack?: { token: string; channel: string };
    }
  ): Promise<void> {
    this.logger.info({ sessionId }, 'Setting up integrations');

    try {
      const session = await this.getOnboardingSession(sessionId);

      // Setup each integration
      const results = await this.integrationService.setupIntegrations(
        session.organizationId,
        integrations
      );

      // Update session
      session.status = OnboardingStatus.INTEGRATION_SETUP;
      session.currentStep = 3;
      session.steps[2].completed = true;
      session.steps[2].completedAt = new Date();
      session.completionPercentage = 60;
      session.steps[2].metadata = { integrations: Object.keys(integrations) };

      await this.redis.setex(
        `onboarding:session:${sessionId}`,
        86400,
        JSON.stringify(session)
      );

      // Track event
      await this.trackEvent({
        type: OnboardingEventType.INTEGRATION_CONNECTED,
        customerId: session.customerId,
        organizationId: session.organizationId,
        data: { integrations: Object.keys(integrations) }
      });

      // Track progress
      await this.analytics.trackStepCompletion('integration_setup', sessionId);
    } catch (error) {
      this.logger.error({ error, sessionId }, 'Integration setup failed');
      throw error;
    }
  }

  /**
   * Start product tour
   */
  async startProductTour(
    sessionId: string,
    tourId: string
  ): Promise<{ tour: any; nextStep: any }> {
    this.logger.info({ sessionId, tourId }, 'Starting product tour');

    try {
      const session = await this.getOnboardingSession(sessionId);
      const tour = await this.tourService.getTour(tourId);
      
      // Initialize tour progress
      await this.redis.setex(
        `tour:progress:${session.customerId}:${tourId}`,
        86400,
        JSON.stringify({
          tourId,
          currentStep: 0,
          completedSteps: [],
          startedAt: new Date()
        })
      );

      // Update session
      session.status = OnboardingStatus.PRODUCT_TOUR;
      session.currentStep = 4;
      
      await this.redis.setex(
        `onboarding:session:${sessionId}`,
        86400,
        JSON.stringify(session)
      );

      return {
        tour,
        nextStep: tour.steps[0]
      };
    } catch (error) {
      this.logger.error({ error, sessionId }, 'Failed to start product tour');
      throw error;
    }
  }

  /**
   * Complete onboarding
   */
  async completeOnboarding(sessionId: string): Promise<{
    customerId: string;
    organizationId: string;
    healthScore: number;
  }> {
    this.logger.info({ sessionId }, 'Completing onboarding');

    try {
      const session = await this.getOnboardingSession(sessionId);

      // Mark all steps as complete
      session.steps[3].completed = true;
      session.steps[3].completedAt = new Date();
      session.status = OnboardingStatus.COMPLETED;
      session.completedAt = new Date();
      session.completionPercentage = 100;

      // Calculate time spent
      const timeSpent = Math.round(
        (session.completedAt.getTime() - session.startedAt.getTime()) / 60000
      );
      session.timeSpentMinutes = timeSpent;

      // Save final session state
      await this.redis.setex(
        `onboarding:session:${sessionId}`,
        2592000, // 30 days
        JSON.stringify(session)
      );

      // Calculate initial health score
      const healthScore = await this.healthCalculator.calculateScore(
        session.customerId,
        session.organizationId
      );

      // Track completion
      await this.trackEvent({
        type: OnboardingEventType.ONBOARDING_COMPLETED,
        customerId: session.customerId,
        organizationId: session.organizationId,
        data: {
          timeSpentMinutes: timeSpent,
          healthScore
        }
      });

      // Update analytics
      await this.analytics.trackCompletion(sessionId, timeSpent);

      // Send completion email with next steps
      const user = await this.prisma.user.findUnique({
        where: { id: session.customerId }
      });

      if (user) {
        await this.emailService.sendOnboardingCompleteEmail({
          email: user.email,
          firstName: user.name.split(' ')[0],
          nextSteps: this.getNextSteps(session.accountType)
        });
      }

      // Schedule follow-up check-ins
      await this.scheduleCheckIns(session.customerId, session.organizationId);

      return {
        customerId: session.customerId,
        organizationId: session.organizationId,
        healthScore
      };
    } catch (error) {
      this.logger.error({ error, sessionId }, 'Failed to complete onboarding');
      throw error;
    }
  }

  /**
   * Setup enterprise onboarding
   */
  async setupEnterpriseOnboarding(data: {
    company: string;
    contactEmail: string;
    contactName: string;
    requirements: {
      users: number;
      ssoProvider?: string;
      compliance: string[];
      integrations: string[];
    };
  }): Promise<{ sessionId: string; dedicatedInstanceUrl?: string }> {
    this.logger.info({ company: data.company }, 'Setting up enterprise onboarding');

    try {
      const sessionId = randomBytes(16).toString('hex');

      // Create enterprise onboarding workflow
      const session: OnboardingSession = {
        id: sessionId,
        customerId: '',
        organizationId: '',
        accountType: AccountType.ENTERPRISE,
        status: OnboardingStatus.SIGNUP_STARTED,
        currentStep: 0,
        steps: this.getEnterpriseOnboardingSteps(),
        startedAt: new Date(),
        timeSpentMinutes: 0,
        completionPercentage: 0,
        metadata: {
          source: 'enterprise',
          company: data.company,
          requirements: data.requirements,
          deviceType: 'web',
          browser: '',
          ipAddress: '',
          country: '',
          referrer: ''
        }
      };

      // Store session
      await this.redis.setex(
        `onboarding:enterprise:${sessionId}`,
        604800, // 7 days
        JSON.stringify(session)
      );

      // Provision dedicated instance if needed
      let dedicatedInstanceUrl;
      if (data.requirements.users > 100) {
        dedicatedInstanceUrl = await this.provisionDedicatedInstance(data.company);
      }

      // Send enterprise welcome email
      await this.emailService.sendEnterpriseWelcomeEmail({
        email: data.contactEmail,
        name: data.contactName,
        company: data.company,
        dedicatedInstanceUrl
      });

      // Notify sales team
      await this.notifySalesTeam(data);

      return { sessionId, dedicatedInstanceUrl };
    } catch (error) {
      this.logger.error({ error, company: data.company }, 'Enterprise onboarding setup failed');
      throw error;
    }
  }

  /**
   * Get onboarding analytics
   */
  async getOnboardingAnalytics(
    startDate: Date,
    endDate: Date
  ): Promise<OnboardingAnalytics> {
    return this.analytics.getAnalytics(startDate, endDate);
  }

  /**
   * Get customer health scores
   */
  async getCustomerHealthScores(
    organizationId?: string
  ): Promise<CustomerHealthScore[]> {
    return this.healthCalculator.getScores(organizationId);
  }

  /**
   * Identify churn risk
   */
  async identifyChurnRisk(): Promise<{
    highRisk: string[];
    mediumRisk: string[];
    interventions: Record<string, string[]>;
  }> {
    this.logger.info('Identifying churn risk customers');

    try {
      const scores = await this.healthCalculator.getScores();
      
      const highRisk: string[] = [];
      const mediumRisk: string[] = [];
      const interventions: Record<string, string[]> = {};

      for (const score of scores) {
        if (score.score < 40) {
          highRisk.push(score.customerId);
          interventions[score.customerId] = this.getInterventions(score);
        } else if (score.score < 60) {
          mediumRisk.push(score.customerId);
          interventions[score.customerId] = this.getInterventions(score);
        }
      }

      // Track churn risk events
      for (const customerId of highRisk) {
        await this.trackEvent({
          type: OnboardingEventType.CHURN_RISK_DETECTED,
          customerId,
          organizationId: '',
          data: { riskLevel: 'HIGH' }
        });
      }

      return { highRisk, mediumRisk, interventions };
    } catch (error) {
      this.logger.error({ error }, 'Failed to identify churn risk');
      throw error;
    }
  }

  // Private helper methods

  private getTrialOnboardingSteps(): OnboardingStep[] {
    return [
      {
        id: 'email_verification',
        name: 'Verify Email',
        description: 'Confirm your email address',
        order: 1,
        required: true,
        completed: false
      },
      {
        id: 'organization_setup',
        name: 'Setup Organization',
        description: 'Tell us about your company',
        order: 2,
        required: true,
        completed: false
      },
      {
        id: 'integration_setup',
        name: 'Connect Integrations',
        description: 'Connect your development tools',
        order: 3,
        required: false,
        completed: false
      },
      {
        id: 'product_tour',
        name: 'Product Tour',
        description: 'Learn the platform basics',
        order: 4,
        required: false,
        completed: false
      }
    ];
  }

  private getEnterpriseOnboardingSteps(): OnboardingStep[] {
    return [
      {
        id: 'technical_validation',
        name: 'Technical Validation',
        description: 'Validate technical requirements',
        order: 1,
        required: true,
        completed: false
      },
      {
        id: 'security_review',
        name: 'Security Review',
        description: 'Complete security assessment',
        order: 2,
        required: true,
        completed: false
      },
      {
        id: 'sso_configuration',
        name: 'SSO Configuration',
        description: 'Setup single sign-on',
        order: 3,
        required: true,
        completed: false
      },
      {
        id: 'data_migration',
        name: 'Data Migration',
        description: 'Migrate existing data',
        order: 4,
        required: false,
        completed: false
      },
      {
        id: 'user_provisioning',
        name: 'User Provisioning',
        description: 'Setup user accounts',
        order: 5,
        required: true,
        completed: false
      },
      {
        id: 'training',
        name: 'Training',
        description: 'Train administrators and users',
        order: 6,
        required: true,
        completed: false
      }
    ];
  }

  private async getOnboardingSession(sessionId: string): Promise<OnboardingSession> {
    const sessionData = await this.redis.get(`onboarding:session:${sessionId}`);
    if (!sessionData) {
      throw new Error('Onboarding session not found');
    }
    return JSON.parse(sessionData);
  }

  private async createTrialAccount(
    customerId: string,
    organizationId: string
  ): Promise<TrialAccount> {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 14);

    const trial: TrialAccount = {
      id: randomBytes(16).toString('hex'),
      customerId,
      organizationId,
      startDate,
      endDate,
      daysRemaining: 14,
      features: [
        'unlimited_users',
        'all_integrations',
        'premium_support',
        'advanced_analytics'
      ],
      usageLimits: {
        maxUsers: 1000,
        maxProjects: 100,
        maxIntegrations: 50,
        maxApiCalls: 1000000,
        maxStorageGB: 100
      },
      demoDataGenerated: false,
      conversionProbability: 50,
      status: TrialStatus.ACTIVE
    };

    await this.redis.setex(
      `trial:${organizationId}`,
      1209600, // 14 days
      JSON.stringify(trial)
    );

    // Track trial start
    await this.trackEvent({
      type: OnboardingEventType.TRIAL_STARTED,
      customerId,
      organizationId,
      data: { trialDays: 14 }
    });

    return trial;
  }

  private async provisionDedicatedInstance(company: string): Promise<string> {
    // Simulate dedicated instance provisioning
    const instanceId = randomBytes(8).toString('hex');
    const instanceUrl = `https://${company.toLowerCase().replace(/\s+/g, '-')}-${instanceId}.saas-idp.cloud`;
    
    this.logger.info({ company, instanceUrl }, 'Provisioned dedicated instance');
    
    return instanceUrl;
  }

  private async notifySalesTeam(data: any): Promise<void> {
    // Implement sales team notification
    this.logger.info({ company: data.company }, 'Notified sales team of enterprise signup');
  }

  private async scheduleCheckIns(customerId: string, organizationId: string): Promise<void> {
    // Schedule automated check-ins at 3, 7, 14, and 30 days
    const checkInDays = [3, 7, 14, 30];
    
    for (const days of checkInDays) {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + days);
      
      await this.redis.zadd(
        'scheduled_checkins',
        checkInDate.getTime(),
        JSON.stringify({ customerId, organizationId, type: `day_${days}` })
      );
    }
  }

  private getNextSteps(accountType: AccountType): string[] {
    const commonSteps = [
      'Explore the service catalog',
      'Create your first template',
      'Invite team members',
      'Setup monitoring dashboards'
    ];

    if (accountType === AccountType.TRIAL) {
      return [
        ...commonSteps,
        'Schedule a demo with our team',
        'Explore premium features'
      ];
    } else if (accountType === AccountType.ENTERPRISE) {
      return [
        ...commonSteps,
        'Configure advanced permissions',
        'Setup cost allocation',
        'Enable compliance reporting'
      ];
    }

    return commonSteps;
  }

  private getInterventions(score: CustomerHealthScore): string[] {
    const interventions: string[] = [];

    if (score.score < 40) {
      interventions.push('Schedule immediate customer success call');
      interventions.push('Offer personalized training session');
      interventions.push('Provide migration assistance');
    }

    // Check specific factors
    for (const factor of score.factors) {
      if (factor.name === 'usage' && factor.score < 30) {
        interventions.push('Send feature discovery email series');
        interventions.push('Offer hands-on workshop');
      }
      if (factor.name === 'integration' && factor.score < 50) {
        interventions.push('Provide integration setup assistance');
      }
      if (factor.name === 'engagement' && factor.score < 40) {
        interventions.push('Schedule product roadmap review');
      }
    }

    return interventions;
  }

  private async trackEvent(event: Omit<OnboardingWebhookEvent, 'id' | 'timestamp'>): Promise<void> {
    const webhookEvent: OnboardingWebhookEvent = {
      id: randomBytes(16).toString('hex'),
      ...event,
      timestamp: new Date()
    };

    // Store event
    await this.redis.lpush(
      'onboarding_events',
      JSON.stringify(webhookEvent)
    );

    // Trigger webhooks if configured
    // await this.webhookService.trigger(webhookEvent);

    this.logger.info({ type: event.type, customerId: event.customerId }, 'Tracked onboarding event');
  }
}