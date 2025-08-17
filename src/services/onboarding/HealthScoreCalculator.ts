/**
 * Customer Health Score Calculator
 * Calculates and tracks customer health metrics
 */

import { PrismaClient } from '@prisma/client';
import { Logger } from 'pino';
import { CustomerHealthScore, HealthFactor } from './types';

export class HealthScoreCalculator {
  private prisma: PrismaClient;
  private logger: Logger;

  constructor(prisma: PrismaClient, logger: Logger) {
    this.prisma = prisma;
    this.logger = logger;
  }

  /**
   * Calculate health score for a customer
   */
  async calculateScore(
    customerId: string,
    organizationId: string
  ): Promise<number> {
    try {
      const factors = await this.calculateFactors(customerId, organizationId);
      
      // Calculate weighted score
      let totalScore = 0;
      let totalWeight = 0;

      for (const factor of factors) {
        totalScore += factor.score * factor.weight;
        totalWeight += factor.weight;
      }

      const finalScore = Math.round(totalScore / totalWeight);

      // Store health score
      await this.storeHealthScore({
        customerId,
        organizationId,
        score: finalScore,
        trend: await this.calculateTrend(customerId, finalScore),
        factors,
        riskLevel: this.calculateRiskLevel(finalScore),
        lastCalculated: new Date()
      });

      return finalScore;
    } catch (error) {
      this.logger.error({ error, customerId }, 'Failed to calculate health score');
      return 50; // Default middle score on error
    }
  }

  /**
   * Get health scores
   */
  async getScores(organizationId?: string): Promise<CustomerHealthScore[]> {
    try {
      const query = organizationId
        ? `SELECT * FROM health_scores WHERE organization_id = $1 ORDER BY last_calculated DESC`
        : `SELECT * FROM health_scores ORDER BY last_calculated DESC LIMIT 100`;

      const scores = await this.prisma.$queryRawUnsafe(
        query,
        ...(organizationId ? [organizationId] : [])
      );

      return (scores as any[]).map(score => ({
        customerId: score.customer_id,
        organizationId: score.organization_id,
        score: score.score,
        trend: score.trend,
        factors: score.factors,
        riskLevel: score.risk_level,
        lastCalculated: score.last_calculated
      }));
    } catch (error) {
      this.logger.error({ error }, 'Failed to get health scores');
      return [];
    }
  }

  /**
   * Calculate individual health factors
   */
  private async calculateFactors(
    customerId: string,
    organizationId: string
  ): Promise<HealthFactor[]> {
    const factors: HealthFactor[] = [];

    // Usage Factor (30% weight)
    const usageScore = await this.calculateUsageFactor(organizationId);
    factors.push({
      name: 'usage',
      weight: 0.3,
      score: usageScore,
      description: 'Platform usage and activity level'
    });

    // Engagement Factor (25% weight)
    const engagementScore = await this.calculateEngagementFactor(customerId, organizationId);
    factors.push({
      name: 'engagement',
      weight: 0.25,
      score: engagementScore,
      description: 'User engagement and feature adoption'
    });

    // Integration Factor (20% weight)
    const integrationScore = await this.calculateIntegrationFactor(organizationId);
    factors.push({
      name: 'integration',
      weight: 0.2,
      score: integrationScore,
      description: 'Integration setup and usage'
    });

    // Team Factor (15% weight)
    const teamScore = await this.calculateTeamFactor(organizationId);
    factors.push({
      name: 'team',
      weight: 0.15,
      score: teamScore,
      description: 'Team size and collaboration'
    });

    // Support Factor (10% weight)
    const supportScore = await this.calculateSupportFactor(customerId);
    factors.push({
      name: 'support',
      weight: 0.1,
      score: supportScore,
      description: 'Support tickets and satisfaction'
    });

    return factors;
  }

  /**
   * Calculate usage factor
   */
  private async calculateUsageFactor(organizationId: string): Promise<number> {
    try {
      // Get usage metrics for last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Count active services
      const servicesResult = await this.prisma.$queryRaw`
        SELECT COUNT(*) as count 
        FROM services 
        WHERE organization_id = ${organizationId}
        AND updated_at > ${thirtyDaysAgo}
      `;
      const activeServices = Number((servicesResult as any)[0].count);

      // Count deployments
      const deploymentsResult = await this.prisma.$queryRaw`
        SELECT COUNT(*) as count 
        FROM deployments 
        WHERE organization_id = ${organizationId}
        AND created_at > ${thirtyDaysAgo}
      `;
      const deployments = Number((deploymentsResult as any)[0].count);

      // Count API calls (simplified)
      const apiCallsResult = await this.prisma.$queryRaw`
        SELECT COUNT(*) as count 
        FROM api_logs 
        WHERE organization_id = ${organizationId}
        AND created_at > ${thirtyDaysAgo}
      `;
      const apiCalls = Number((apiCallsResult as any)[0].count);

      // Calculate score based on thresholds
      let score = 0;
      
      // Services score (0-40)
      if (activeServices >= 10) score += 40;
      else if (activeServices >= 5) score += 30;
      else if (activeServices >= 2) score += 20;
      else if (activeServices >= 1) score += 10;

      // Deployments score (0-30)
      if (deployments >= 50) score += 30;
      else if (deployments >= 20) score += 25;
      else if (deployments >= 10) score += 20;
      else if (deployments >= 5) score += 15;
      else if (deployments >= 1) score += 10;

      // API calls score (0-30)
      if (apiCalls >= 10000) score += 30;
      else if (apiCalls >= 5000) score += 25;
      else if (apiCalls >= 1000) score += 20;
      else if (apiCalls >= 500) score += 15;
      else if (apiCalls >= 100) score += 10;

      return score;
    } catch (error) {
      this.logger.warn({ error }, 'Failed to calculate usage factor');
      return 50;
    }
  }

  /**
   * Calculate engagement factor
   */
  private async calculateEngagementFactor(
    customerId: string,
    organizationId: string
  ): Promise<number> {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Check login frequency
      const loginsResult = await this.prisma.$queryRaw`
        SELECT COUNT(*) as count 
        FROM audit_logs 
        WHERE user_id = ${customerId}
        AND action = 'login'
        AND created_at > ${sevenDaysAgo}
      `;
      const recentLogins = Number((loginsResult as any)[0].count);

      // Check feature usage
      const featuresResult = await this.prisma.$queryRaw`
        SELECT COUNT(DISTINCT feature) as count 
        FROM feature_usage 
        WHERE organization_id = ${organizationId}
        AND created_at > ${sevenDaysAgo}
      `;
      const featuresUsed = Number((featuresResult as any)[0].count);

      // Calculate score
      let score = 0;

      // Login frequency (0-50)
      if (recentLogins >= 7) score += 50;
      else if (recentLogins >= 5) score += 40;
      else if (recentLogins >= 3) score += 30;
      else if (recentLogins >= 1) score += 20;

      // Feature adoption (0-50)
      if (featuresUsed >= 10) score += 50;
      else if (featuresUsed >= 7) score += 40;
      else if (featuresUsed >= 5) score += 30;
      else if (featuresUsed >= 3) score += 20;
      else if (featuresUsed >= 1) score += 10;

      return score;
    } catch (error) {
      this.logger.warn({ error }, 'Failed to calculate engagement factor');
      return 50;
    }
  }

  /**
   * Calculate integration factor
   */
  private async calculateIntegrationFactor(organizationId: string): Promise<number> {
    try {
      // Count active integrations
      const integrationsResult = await this.prisma.$queryRaw`
        SELECT COUNT(*) as count 
        FROM integrations 
        WHERE organization_id = ${organizationId}
        AND status = 'active'
      `;
      const activeIntegrations = Number((integrationsResult as any)[0].count);

      // Check integration usage
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const integrationUsageResult = await this.prisma.$queryRaw`
        SELECT COUNT(*) as count 
        FROM integration_events 
        WHERE organization_id = ${organizationId}
        AND created_at > ${thirtyDaysAgo}
      `;
      const integrationEvents = Number((integrationUsageResult as any)[0].count);

      // Calculate score
      let score = 0;

      // Number of integrations (0-50)
      if (activeIntegrations >= 5) score += 50;
      else if (activeIntegrations >= 3) score += 40;
      else if (activeIntegrations >= 2) score += 30;
      else if (activeIntegrations >= 1) score += 20;

      // Integration usage (0-50)
      if (integrationEvents >= 1000) score += 50;
      else if (integrationEvents >= 500) score += 40;
      else if (integrationEvents >= 100) score += 30;
      else if (integrationEvents >= 50) score += 20;
      else if (integrationEvents >= 10) score += 10;

      return score;
    } catch (error) {
      this.logger.warn({ error }, 'Failed to calculate integration factor');
      return 50;
    }
  }

  /**
   * Calculate team factor
   */
  private async calculateTeamFactor(organizationId: string): Promise<number> {
    try {
      // Count team members
      const membersResult = await this.prisma.$queryRaw`
        SELECT COUNT(DISTINCT user_id) as count 
        FROM team_members tm
        JOIN teams t ON tm.team_id = t.id
        WHERE t.organization_id = ${organizationId}
      `;
      const teamMembers = Number((membersResult as any)[0].count);

      // Count active teams
      const teamsResult = await this.prisma.$queryRaw`
        SELECT COUNT(*) as count 
        FROM teams 
        WHERE organization_id = ${organizationId}
        AND is_active = true
      `;
      const activeTeams = Number((teamsResult as any)[0].count);

      // Calculate score
      let score = 0;

      // Team size (0-50)
      if (teamMembers >= 20) score += 50;
      else if (teamMembers >= 10) score += 40;
      else if (teamMembers >= 5) score += 30;
      else if (teamMembers >= 3) score += 20;
      else if (teamMembers >= 1) score += 10;

      // Number of teams (0-50)
      if (activeTeams >= 5) score += 50;
      else if (activeTeams >= 3) score += 40;
      else if (activeTeams >= 2) score += 30;
      else if (activeTeams >= 1) score += 20;

      return score;
    } catch (error) {
      this.logger.warn({ error }, 'Failed to calculate team factor');
      return 50;
    }
  }

  /**
   * Calculate support factor
   */
  private async calculateSupportFactor(customerId: string): Promise<number> {
    try {
      // In a real implementation, this would query support ticket system
      // For now, return a good default score
      return 80;
    } catch (error) {
      this.logger.warn({ error }, 'Failed to calculate support factor');
      return 50;
    }
  }

  /**
   * Calculate trend
   */
  private async calculateTrend(
    customerId: string,
    currentScore: number
  ): Promise<'IMPROVING' | 'STABLE' | 'DECLINING'> {
    try {
      // Get previous score
      const previousScoreResult = await this.prisma.$queryRaw`
        SELECT score 
        FROM health_scores 
        WHERE customer_id = ${customerId}
        ORDER BY last_calculated DESC
        LIMIT 1 OFFSET 1
      `;

      if ((previousScoreResult as any[]).length === 0) {
        return 'STABLE';
      }

      const previousScore = (previousScoreResult as any)[0].score;
      const difference = currentScore - previousScore;

      if (difference > 5) return 'IMPROVING';
      if (difference < -5) return 'DECLINING';
      return 'STABLE';
    } catch (error) {
      return 'STABLE';
    }
  }

  /**
   * Calculate risk level
   */
  private calculateRiskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (score >= 70) return 'LOW';
    if (score >= 40) return 'MEDIUM';
    return 'HIGH';
  }

  /**
   * Store health score
   */
  private async storeHealthScore(score: CustomerHealthScore): Promise<void> {
    try {
      await this.prisma.$queryRaw`
        INSERT INTO health_scores (
          customer_id, organization_id, score, trend, 
          factors, risk_level, last_calculated
        ) VALUES (
          ${score.customerId},
          ${score.organizationId},
          ${score.score},
          ${score.trend},
          ${JSON.stringify(score.factors)}::jsonb,
          ${score.riskLevel},
          ${score.lastCalculated}
        )
        ON CONFLICT (customer_id) DO UPDATE SET
          score = EXCLUDED.score,
          trend = EXCLUDED.trend,
          factors = EXCLUDED.factors,
          risk_level = EXCLUDED.risk_level,
          last_calculated = EXCLUDED.last_calculated
      `;
    } catch (error) {
      this.logger.error({ error }, 'Failed to store health score');
    }
  }
}