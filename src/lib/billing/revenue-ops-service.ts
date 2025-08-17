import { PrismaClient } from '@prisma/client';
import { stripe, stripeHelpers } from './stripe-client';
import { subscriptionService } from './subscription-service';
import { usageService } from './usage-service';
import cron from 'node-cron';
import type { Organization, Subscription, BillingAlert, ResourceType } from '@prisma/client';

const prisma = new PrismaClient();

interface ProvisioningRequest {
  organizationId: string;
  planTier: string;
  quantity: number;
  features: string[];
}

interface DeProvisioningRequest {
  organizationId: string;
  reason: string;
  retainData?: boolean;
  gracePeriodDays?: number;
}

interface TrialConversionMetrics {
  totalTrials: number;
  convertedTrials: number;
  conversionRate: number;
  averageTrialDuration: number;
  topConversionReasons: string[];
  commonDropOffPoints: string[];
}

interface RevenueHealthMetrics {
  monthlyRecurringRevenue: number;
  annualRecurringRevenue: number;
  churnRate: number;
  expansionRevenue: number;
  netRevenueRetention: number;
  customerLifetimeValue: number;
  averageRevenuePerUser: number;
  billingIssues: number;
  dunningSuccess: number;
}

export class RevenueOpsService {
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();

  constructor() {
    this.initializeCronJobs();
  }

  /**
   * Initialize automated revenue operations cron jobs
   */
  private initializeCronJobs(): void {
    // Daily revenue health check
    const dailyHealthCheck = cron.schedule('0 8 * * *', async () => {
      await this.performDailyRevenueHealthCheck();
    }, { scheduled: false });
    this.cronJobs.set('dailyHealthCheck', dailyHealthCheck);

    // Trial expiration reminders (daily)
    const trialReminders = cron.schedule('0 9 * * *', async () => {
      await this.sendTrialExpirationReminders();
    }, { scheduled: false });
    this.cronJobs.set('trialReminders', trialReminders);

    // Failed payment retry (every 6 hours)
    const failedPaymentRetry = cron.schedule('0 */6 * * *', async () => {
      await this.retryFailedPayments();
    }, { scheduled: false });
    this.cronJobs.set('failedPaymentRetry', failedPaymentRetry);

    // Usage limit warnings (hourly)
    const usageLimitWarnings = cron.schedule('0 * * * *', async () => {
      await this.checkUsageLimitsAndAlert();
    }, { scheduled: false });
    this.cronJobs.set('usageLimitWarnings', usageLimitWarnings);

    // Monthly revenue reporting (1st of every month)
    const monthlyReporting = cron.schedule('0 6 1 * *', async () => {
      await this.generateMonthlyRevenueReport();
    }, { scheduled: false });
    this.cronJobs.set('monthlyReporting', monthlyReporting);

    // Churn risk analysis (weekly)
    const churnAnalysis = cron.schedule('0 10 * * 1', async () => {
      await this.analyzeChurnRisk();
    }, { scheduled: false });
    this.cronJobs.set('churnAnalysis', churnAnalysis);
  }

  /**
   * Start all automated revenue operations
   */
  startAutomation(): void {
    this.cronJobs.forEach((job, name) => {
      job.start();
      console.log(`Started revenue ops job: ${name}`);
    });
  }

  /**
   * Stop all automated revenue operations
   */
  stopAutomation(): void {
    this.cronJobs.forEach((job, name) => {
      job.stop();
      console.log(`Stopped revenue ops job: ${name}`);
    });
  }

  /**
   * Automated customer provisioning when subscription is created
   */
  async provisionCustomer(request: ProvisioningRequest): Promise<void> {
    try {
      console.log(`Starting provisioning for organization ${request.organizationId}`);

      // Get organization
      const organization = await prisma.organization.findUnique({
        where: { id: request.organizationId },
        include: { subscriptions: true }
      });

      if (!organization) {
        throw new Error('Organization not found');
      }

      // Create service accounts and API keys
      await this.createServiceAccounts(organization, request.quantity);

      // Set up monitoring and alerting
      await this.setupMonitoringForOrganization(organization.id);

      // Configure resource limits based on plan
      await this.configureResourceLimits(organization.id, request.planTier, request.features);

      // Send welcome email with onboarding information
      await this.sendWelcomeEmail(organization);

      // Create audit log
      await prisma.auditLog.create({
        data: {
          action: 'CUSTOMER_PROVISIONED',
          resource: 'organization',
          resourceId: organization.id,
          metadata: {
            planTier: request.planTier,
            quantity: request.quantity,
            features: request.features,
            provisionedAt: new Date().toISOString()
          }
        }
      });

      console.log(`Provisioning completed for organization ${request.organizationId}`);
    } catch (error) {
      console.error('Error in customer provisioning:', error);
      throw error;
    }
  }

  /**
   * Automated customer deprovisioning when subscription is cancelled
   */
  async deprovisionCustomer(request: DeProvisioningRequest): Promise<void> {
    try {
      console.log(`Starting deprovisioning for organization ${request.organizationId}`);

      const gracePeriod = request.gracePeriodDays || 30; // Default 30 days
      const deprovisionDate = new Date();
      deprovisionDate.setDate(deprovisionDate.getDate() + gracePeriod);

      // Schedule deprovisioning
      await prisma.organization.update({
        where: { id: request.organizationId },
        data: {
          status: 'SUSPENDED',
          metadata: {
            deprovisioningScheduled: deprovisionDate.toISOString(),
            reason: request.reason,
            retainData: request.retainData
          }
        }
      });

      // Disable API access immediately
      await this.disableApiAccess(request.organizationId);

      // Send deprovisioning notice
      await this.sendDeprovisioningNotice(request.organizationId, deprovisionDate);

      // If immediate deprovisioning is requested
      if (gracePeriod === 0) {
        await this.executeDeprovisioning(request.organizationId, request.retainData);
      } else {
        // Schedule deprovisioning task
        setTimeout(async () => {
          await this.executeDeprovisioning(request.organizationId, request.retainData);
        }, gracePeriod * 24 * 60 * 60 * 1000);
      }

      console.log(`Deprovisioning scheduled for organization ${request.organizationId}`);
    } catch (error) {
      console.error('Error in customer deprovisioning:', error);
      throw error;
    }
  }

  /**
   * Automated trial-to-paid conversion workflows
   */
  async manageTrialConversions(): Promise<void> {
    try {
      // Find trials expiring in 3 days
      const upcomingExpirations = await prisma.subscription.findMany({
        where: {
          status: 'TRIALING',
          trialEnd: {
            gte: new Date(),
            lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
          }
        },
        include: {
          organization: true,
          plan: true
        }
      });

      for (const subscription of upcomingExpirations) {
        await this.sendTrialConversionReminder(subscription);
        await this.analyzeTrialUsageAndRecommend(subscription);
      }

      // Find expired trials that haven't converted
      const expiredTrials = await prisma.subscription.findMany({
        where: {
          status: 'TRIALING',
          trialEnd: {
            lt: new Date()
          }
        },
        include: {
          organization: true
        }
      });

      for (const subscription of expiredTrials) {
        await this.handleExpiredTrial(subscription);
      }
    } catch (error) {
      console.error('Error managing trial conversions:', error);
    }
  }

  /**
   * Automated dunning management for failed payments
   */
  async manageDunning(): Promise<void> {
    try {
      // Find subscriptions with failed payments
      const pastDueSubscriptions = await prisma.subscription.findMany({
        where: {
          status: 'PAST_DUE'
        },
        include: {
          organization: true,
          plan: true
        }
      });

      for (const subscription of pastDueSubscriptions) {
        await this.executeDunningSequence(subscription);
      }
    } catch (error) {
      console.error('Error in dunning management:', error);
    }
  }

  /**
   * Get trial conversion metrics and analytics
   */
  async getTrialConversionMetrics(
    startDate?: Date,
    endDate?: Date
  ): Promise<TrialConversionMetrics> {
    try {
      const whereClause: any = {
        trialEnd: { not: null }
      };

      if (startDate && endDate) {
        whereClause.createdAt = {
          gte: startDate,
          lte: endDate
        };
      }

      const subscriptions = await prisma.subscription.findMany({
        where: whereClause,
        include: {
          organization: true,
          plan: true
        }
      });

      const totalTrials = subscriptions.length;
      const convertedTrials = subscriptions.filter(sub => sub.status === 'ACTIVE').length;
      const conversionRate = totalTrials > 0 ? (convertedTrials / totalTrials) * 100 : 0;

      // Calculate average trial duration
      const trialDurations = subscriptions
        .filter(sub => sub.trialStart && sub.trialEnd)
        .map(sub => {
          const start = sub.trialStart!.getTime();
          const end = sub.trialEnd!.getTime();
          return Math.ceil((end - start) / (1000 * 60 * 60 * 24)); // days
        });

      const averageTrialDuration = trialDurations.length > 0
        ? trialDurations.reduce((sum, duration) => sum + duration, 0) / trialDurations.length
        : 0;

      return {
        totalTrials,
        convertedTrials,
        conversionRate,
        averageTrialDuration,
        topConversionReasons: [], // Would be populated from user feedback/surveys
        commonDropOffPoints: [] // Would be populated from analytics
      };
    } catch (error) {
      throw new Error(`Failed to get trial conversion metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get comprehensive revenue health metrics
   */
  async getRevenueHealthMetrics(
    startDate?: Date,
    endDate?: Date
  ): Promise<RevenueHealthMetrics> {
    try {
      const metrics = await subscriptionService.getSubscriptionMetrics();
      
      // Get billing issues
      const billingIssues = await prisma.billingAlert.count({
        where: {
          severity: 'CRITICAL',
          acknowledged: false,
          createdAt: startDate && endDate ? {
            gte: startDate,
            lte: endDate
          } : undefined
        }
      });

      // Calculate expansion revenue (upgrades and additional seats)
      const expansionRevenue = await this.calculateExpansionRevenue(startDate, endDate);

      // Calculate Net Revenue Retention
      const netRevenueRetention = await this.calculateNetRevenueRetention(startDate, endDate);

      // Calculate Customer Lifetime Value
      const customerLifetimeValue = await this.calculateCustomerLifetimeValue();

      return {
        monthlyRecurringRevenue: metrics.monthlyRecurringRevenue,
        annualRecurringRevenue: metrics.annualRecurringRevenue,
        churnRate: metrics.churnRate,
        expansionRevenue,
        netRevenueRetention,
        customerLifetimeValue,
        averageRevenuePerUser: metrics.averageRevenuePerUser,
        billingIssues,
        dunningSuccess: 85 // Placeholder - would be calculated from actual dunning data
      };
    } catch (error) {
      throw new Error(`Failed to get revenue health metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Daily revenue health check
   */
  private async performDailyRevenueHealthCheck(): Promise<void> {
    try {
      console.log('Starting daily revenue health check');

      const metrics = await this.getRevenueHealthMetrics();

      // Check for critical issues
      const criticalAlerts = [];

      if (metrics.churnRate > 10) {
        criticalAlerts.push('High churn rate detected');
      }

      if (metrics.billingIssues > 5) {
        criticalAlerts.push('High number of billing issues');
      }

      if (metrics.netRevenueRetention < 90) {
        criticalAlerts.push('Low net revenue retention');
      }

      // Send alerts if any critical issues found
      if (criticalAlerts.length > 0) {
        await this.sendRevenueHealthAlerts(criticalAlerts, metrics);
      }

      console.log('Daily revenue health check completed');
    } catch (error) {
      console.error('Error in daily revenue health check:', error);
    }
  }

  /**
   * Send trial expiration reminders
   */
  private async sendTrialExpirationReminders(): Promise<void> {
    try {
      const upcomingExpirations = await prisma.subscription.findMany({
        where: {
          status: 'TRIALING',
          trialEnd: {
            gte: new Date(),
            lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
          }
        },
        include: {
          organization: true,
          plan: true
        }
      });

      for (const subscription of upcomingExpirations) {
        const daysLeft = Math.ceil(
          (subscription.trialEnd!.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        );

        console.log(`Sending trial expiration reminder to ${subscription.organization.name} (${daysLeft} days left)`);
        
        // TODO: Integrate with your email service
        // await emailService.sendTrialExpirationReminder(subscription, daysLeft);
      }
    } catch (error) {
      console.error('Error sending trial expiration reminders:', error);
    }
  }

  /**
   * Retry failed payments
   */
  private async retryFailedPayments(): Promise<void> {
    try {
      const failedPayments = await prisma.payment.findMany({
        where: {
          status: 'FAILED',
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        },
        include: {
          organization: true,
          invoice: true
        }
      });

      for (const payment of failedPayments) {
        if (payment.organization.stripeCustomerId && payment.stripePaymentId) {
          try {
            // Retry payment in Stripe
            const paymentIntent = await stripe.paymentIntents.retrieve(payment.stripePaymentId);
            
            if (paymentIntent.status === 'requires_payment_method') {
              // Try to charge the default payment method
              await stripe.paymentIntents.confirm(payment.stripePaymentId);
              console.log(`Retried payment for organization ${payment.organization.name}`);
            }
          } catch (stripeError) {
            console.error(`Failed to retry payment for ${payment.organization.name}:`, stripeError);
          }
        }
      }
    } catch (error) {
      console.error('Error retrying failed payments:', error);
    }
  }

  /**
   * Check usage limits and send alerts
   */
  private async checkUsageLimitsAndAlert(): Promise<void> {
    try {
      const organizations = await prisma.organization.findMany({
        where: { status: 'ACTIVE' },
        include: {
          subscriptions: {
            where: { status: 'ACTIVE' },
            include: { plan: true }
          }
        }
      });

      for (const org of organizations) {
        if (org.subscriptions.length === 0) continue;

        const metrics = await usageService.getUsageMetrics(org.id);
        
        // Check for alerts that need to be created
        if (metrics.alerts.length > 0) {
          for (const alert of metrics.alerts) {
            if (alert.type === 'over_limit' || alert.type === 'cost_alert') {
              console.log(`Usage alert for ${org.name}: ${alert.message}`);
              
              // TODO: Send notification to organization admins
              // await notificationService.sendUsageAlert(org, alert);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error checking usage limits:', error);
    }
  }

  /**
   * Generate monthly revenue report
   */
  private async generateMonthlyRevenueReport(): Promise<void> {
    try {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const startOfMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
      const endOfMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);

      const metrics = await this.getRevenueHealthMetrics(startOfMonth, endOfMonth);
      const trialMetrics = await this.getTrialConversionMetrics(startOfMonth, endOfMonth);

      const report = {
        period: {
          start: startOfMonth.toISOString(),
          end: endOfMonth.toISOString()
        },
        revenue: metrics,
        trials: trialMetrics,
        generatedAt: new Date().toISOString()
      };

      console.log('Monthly revenue report generated:', report);
      
      // TODO: Send report to stakeholders
      // await emailService.sendMonthlyRevenueReport(report);
    } catch (error) {
      console.error('Error generating monthly revenue report:', error);
    }
  }

  /**
   * Analyze churn risk for customers
   */
  private async analyzeChurnRisk(): Promise<void> {
    try {
      const activeSubscriptions = await prisma.subscription.findMany({
        where: { status: 'ACTIVE' },
        include: {
          organization: true,
          plan: true
        }
      });

      for (const subscription of activeSubscriptions) {
        const riskScore = await this.calculateChurnRiskScore(subscription);
        
        if (riskScore > 70) {
          console.log(`High churn risk for ${subscription.organization.name}: ${riskScore}%`);
          
          // TODO: Trigger customer success intervention
          // await customerSuccessService.triggerIntervention(subscription, riskScore);
        }
      }
    } catch (error) {
      console.error('Error analyzing churn risk:', error);
    }
  }

  // Helper methods (implementation details)

  private async createServiceAccounts(organization: Organization, quantity: number): Promise<void> {
    // Implementation for creating service accounts and API keys
    console.log(`Creating ${quantity} service accounts for ${organization.name}`);
  }

  private async setupMonitoringForOrganization(organizationId: string): Promise<void> {
    // Implementation for setting up monitoring and alerting
    console.log(`Setting up monitoring for organization ${organizationId}`);
  }

  private async configureResourceLimits(organizationId: string, planTier: string, features: string[]): Promise<void> {
    // Implementation for configuring resource limits based on plan
    console.log(`Configuring resource limits for ${organizationId} with plan ${planTier}`);
  }

  private async sendWelcomeEmail(organization: Organization): Promise<void> {
    // Implementation for sending welcome email
    console.log(`Sending welcome email to ${organization.billingEmail}`);
  }

  private async disableApiAccess(organizationId: string): Promise<void> {
    // Implementation for disabling API access
    console.log(`Disabling API access for organization ${organizationId}`);
  }

  private async sendDeprovisioningNotice(organizationId: string, deprovisionDate: Date): Promise<void> {
    // Implementation for sending deprovisioning notice
    console.log(`Sending deprovisioning notice for ${organizationId}, scheduled for ${deprovisionDate}`);
  }

  private async executeDeprovisioning(organizationId: string, retainData?: boolean): Promise<void> {
    // Implementation for actual deprovisioning
    console.log(`Executing deprovisioning for ${organizationId}, retain data: ${retainData}`);
  }

  private async sendTrialConversionReminder(subscription: any): Promise<void> {
    // Implementation for sending trial conversion reminder
    console.log(`Sending trial conversion reminder for ${subscription.organization.name}`);
  }

  private async analyzeTrialUsageAndRecommend(subscription: any): Promise<void> {
    // Implementation for analyzing trial usage and making recommendations
    console.log(`Analyzing trial usage for ${subscription.organization.name}`);
  }

  private async handleExpiredTrial(subscription: any): Promise<void> {
    // Implementation for handling expired trials
    console.log(`Handling expired trial for ${subscription.organization.name}`);
  }

  private async executeDunningSequence(subscription: any): Promise<void> {
    // Implementation for executing dunning sequence
    console.log(`Executing dunning sequence for ${subscription.organization.name}`);
  }

  private async calculateExpansionRevenue(startDate?: Date, endDate?: Date): Promise<number> {
    // Implementation for calculating expansion revenue
    return 0; // Placeholder
  }

  private async calculateNetRevenueRetention(startDate?: Date, endDate?: Date): Promise<number> {
    // Implementation for calculating net revenue retention
    return 100; // Placeholder
  }

  private async calculateCustomerLifetimeValue(): Promise<number> {
    // Implementation for calculating customer lifetime value
    return 0; // Placeholder
  }

  private async sendRevenueHealthAlerts(alerts: string[], metrics: RevenueHealthMetrics): Promise<void> {
    // Implementation for sending revenue health alerts
    console.log('Revenue health alerts:', alerts, metrics);
  }

  private async calculateChurnRiskScore(subscription: any): Promise<number> {
    // Implementation for calculating churn risk score
    // This would typically involve ML models or heuristics
    return Math.random() * 100; // Placeholder
  }
}

export const revenueOpsService = new RevenueOpsService();
