/**
 * Analytics Tracker for Onboarding
 * Tracks and analyzes onboarding metrics
 */

import { Redis } from 'ioredis';
import { Logger } from 'pino';
import { OnboardingAnalytics } from './types';

export class AnalyticsTracker {
  private redis: Redis;
  private logger: Logger;

  constructor(redis: Redis, logger: Logger) {
    this.redis = redis;
    this.logger = logger;
  }

  /**
   * Track signup
   */
  async trackSignup(source: string): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Increment total signups
      await this.redis.hincrby('onboarding:signups:total', today, 1);
      
      // Track by source
      await this.redis.hincrby(`onboarding:signups:source:${source}`, today, 1);
      
      // Track hourly for real-time dashboard
      const hour = new Date().getHours();
      await this.redis.hincrby(`onboarding:signups:hourly:${today}`, hour.toString(), 1);
    } catch (error) {
      this.logger.error({ error }, 'Failed to track signup');
    }
  }

  /**
   * Track step completion
   */
  async trackStepCompletion(step: string, sessionId: string): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Track step completion rate
      await this.redis.hincrby(`onboarding:steps:${step}:completed`, today, 1);
      
      // Track time spent on step
      const startTime = await this.redis.get(`onboarding:session:${sessionId}:step:${step}:start`);
      if (startTime) {
        const duration = Date.now() - parseInt(startTime);
        await this.redis.lpush(`onboarding:steps:${step}:duration`, duration);
        await this.redis.ltrim(`onboarding:steps:${step}:duration`, 0, 999); // Keep last 1000
      }
    } catch (error) {
      this.logger.error({ error }, 'Failed to track step completion');
    }
  }

  /**
   * Track onboarding completion
   */
  async trackCompletion(sessionId: string, timeSpentMinutes: number): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Increment completions
      await this.redis.hincrby('onboarding:completions:total', today, 1);
      
      // Track completion time
      await this.redis.lpush('onboarding:completion:times', timeSpentMinutes);
      await this.redis.ltrim('onboarding:completion:times', 0, 999);
      
      // Mark session as completed
      await this.redis.hset(`onboarding:session:${sessionId}:status`, 'completed', 'true');
    } catch (error) {
      this.logger.error({ error }, 'Failed to track completion');
    }
  }

  /**
   * Track abandonment
   */
  async trackAbandonment(sessionId: string, lastStep: string): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Increment abandonments
      await this.redis.hincrby('onboarding:abandonments:total', today, 1);
      
      // Track drop-off point
      await this.redis.hincrby(`onboarding:dropoff:${lastStep}`, today, 1);
      
      // Mark session as abandoned
      await this.redis.hset(`onboarding:session:${sessionId}:status`, 'abandoned', 'true');
    } catch (error) {
      this.logger.error({ error }, 'Failed to track abandonment');
    }
  }

  /**
   * Track conversion
   */
  async trackConversion(customerId: string, fromPlan: string, toPlan: string): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Track conversion
      await this.redis.hincrby('onboarding:conversions:total', today, 1);
      await this.redis.hincrby(`onboarding:conversions:${fromPlan}:${toPlan}`, today, 1);
      
      // Track conversion value
      const value = this.getConversionValue(toPlan);
      await this.redis.hincrbyfloat('onboarding:conversions:value', today, value);
    } catch (error) {
      this.logger.error({ error }, 'Failed to track conversion');
    }
  }

  /**
   * Get analytics for date range
   */
  async getAnalytics(startDate: Date, endDate: Date): Promise<OnboardingAnalytics> {
    try {
      const days = this.getDaysBetween(startDate, endDate);
      
      let totalSignups = 0;
      let completedOnboardings = 0;
      let abandonments = 0;
      const stepCompletions: Record<string, number> = {};
      const dropOffPoints: Record<string, number> = {};

      // Aggregate data for date range
      for (const day of days) {
        // Signups
        const signups = await this.redis.hget('onboarding:signups:total', day);
        totalSignups += parseInt(signups || '0');

        // Completions
        const completions = await this.redis.hget('onboarding:completions:total', day);
        completedOnboardings += parseInt(completions || '0');

        // Abandonments
        const abandoned = await this.redis.hget('onboarding:abandonments:total', day);
        abandonments += parseInt(abandoned || '0');
      }

      // Get step completion rates
      const steps = ['email_verification', 'organization_setup', 'integration_setup', 'product_tour'];
      for (const step of steps) {
        let completed = 0;
        for (const day of days) {
          const count = await this.redis.hget(`onboarding:steps:${step}:completed`, day);
          completed += parseInt(count || '0');
        }
        stepCompletions[step] = totalSignups > 0 ? (completed / totalSignups) * 100 : 0;
      }

      // Get top drop-off points
      for (const step of steps) {
        let dropoffs = 0;
        for (const day of days) {
          const count = await this.redis.hget(`onboarding:dropoff:${step}`, day);
          dropoffs += parseInt(count || '0');
        }
        if (dropoffs > 0) {
          dropOffPoints[step] = dropoffs;
        }
      }

      // Calculate average completion time
      const completionTimes = await this.redis.lrange('onboarding:completion:times', 0, -1);
      const avgTime = completionTimes.length > 0
        ? completionTimes.reduce((sum, time) => sum + parseInt(time), 0) / completionTimes.length
        : 0;

      // Calculate rates
      const abandonmentRate = totalSignups > 0 
        ? (abandonments / totalSignups) * 100 
        : 0;

      const conversionRate = totalSignups > 0
        ? (completedOnboardings / totalSignups) * 100
        : 0;

      // Get health scores
      const healthScores = await this.redis.lrange('health:scores:recent', 0, 99);
      const avgHealthScore = healthScores.length > 0
        ? healthScores.reduce((sum, score) => sum + parseInt(score), 0) / healthScores.length
        : 75;

      // Sort drop-off points
      const topDropOffPoints = Object.entries(dropOffPoints)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([step]) => step);

      return {
        totalSignups,
        completedOnboardings,
        abandonmentRate,
        averageTimeToComplete: Math.round(avgTime),
        conversionRate,
        stepCompletionRates: stepCompletions,
        topDropOffPoints,
        averageHealthScore: Math.round(avgHealthScore)
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to get analytics');
      return {
        totalSignups: 0,
        completedOnboardings: 0,
        abandonmentRate: 0,
        averageTimeToComplete: 0,
        conversionRate: 0,
        stepCompletionRates: {},
        topDropOffPoints: [],
        averageHealthScore: 0
      };
    }
  }

  /**
   * Get funnel analytics
   */
  async getFunnelAnalytics(period: 'day' | 'week' | 'month'): Promise<any> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      
      switch (period) {
        case 'day':
          startDate.setDate(startDate.getDate() - 1);
          break;
        case 'week':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
      }

      const analytics = await this.getAnalytics(startDate, endDate);
      
      // Build funnel data
      const funnel = [
        {
          stage: 'Signup Started',
          count: analytics.totalSignups,
          percentage: 100
        },
        {
          stage: 'Email Verified',
          count: Math.round(analytics.totalSignups * (analytics.stepCompletionRates['email_verification'] / 100)),
          percentage: analytics.stepCompletionRates['email_verification']
        },
        {
          stage: 'Organization Setup',
          count: Math.round(analytics.totalSignups * (analytics.stepCompletionRates['organization_setup'] / 100)),
          percentage: analytics.stepCompletionRates['organization_setup']
        },
        {
          stage: 'Integrations Connected',
          count: Math.round(analytics.totalSignups * (analytics.stepCompletionRates['integration_setup'] / 100)),
          percentage: analytics.stepCompletionRates['integration_setup']
        },
        {
          stage: 'Onboarding Complete',
          count: analytics.completedOnboardings,
          percentage: analytics.conversionRate
        }
      ];

      return {
        period,
        startDate,
        endDate,
        funnel,
        metrics: {
          conversionRate: analytics.conversionRate,
          averageTimeMinutes: analytics.averageTimeToComplete,
          abandonmentRate: analytics.abandonmentRate
        }
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to get funnel analytics');
      throw error;
    }
  }

  /**
   * Get source attribution
   */
  async getSourceAttribution(days: number = 30): Promise<any> {
    try {
      const sources = ['organic', 'paid', 'referral', 'partner', 'direct'];
      const attribution: Record<string, any> = {};

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const daysList = this.getDaysBetween(startDate, endDate);

      for (const source of sources) {
        let signups = 0;
        let conversions = 0;

        for (const day of daysList) {
          const dailySignups = await this.redis.hget(`onboarding:signups:source:${source}`, day);
          signups += parseInt(dailySignups || '0');

          const dailyConversions = await this.redis.hget(`onboarding:conversions:source:${source}`, day);
          conversions += parseInt(dailyConversions || '0');
        }

        attribution[source] = {
          signups,
          conversions,
          conversionRate: signups > 0 ? (conversions / signups) * 100 : 0
        };
      }

      return attribution;
    } catch (error) {
      this.logger.error({ error }, 'Failed to get source attribution');
      return {};
    }
  }

  // Helper methods

  private getDaysBetween(startDate: Date, endDate: Date): string[] {
    const days: string[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      days.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    return days;
  }

  private getConversionValue(plan: string): number {
    const values: Record<string, number> = {
      'STARTER': 49,
      'PROFESSIONAL': 199,
      'ENTERPRISE': 999
    };
    return values[plan] || 0;
  }
}