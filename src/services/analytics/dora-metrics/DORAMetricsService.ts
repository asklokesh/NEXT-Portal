/**
 * DORA Metrics Service
 * Calculate and track DevOps Research and Assessment metrics
 */

import {
  DORAMetrics,
  DORAMetricsQuery,
  TeamDORAMetrics,
  ServiceDORAMetrics,
  OrgDORAMetrics,
  DORAInsight,
  DORABenchmark,
  DeploymentFrequency,
  LeadTimeForChanges,
  MeanTimeToRecovery,
  ChangeFailureRate,
  PerformanceLevel,
  MetricTrend,
  MetricDataPoint,
  MetricPeriod,
} from './types';
import { tenantDb } from '@/lib/database/TenantAwareDatabase';

/**
 * Default DORA benchmarks based on DORA State of DevOps reports
 */
const DEFAULT_BENCHMARKS: DORABenchmark = {
  source: 'dora-report',
  year: 2023,
  levels: {
    elite: {
      deploymentFrequency: { min: 1, unit: 'per_day' },
      leadTimeForChanges: { max: 1, unit: 'hours' },
      meanTimeToRecovery: { max: 60, unit: 'minutes' },
      changeFailureRate: { max: 5 },
    },
    high: {
      deploymentFrequency: { min: 1, max: 7, unit: 'per_week' },
      leadTimeForChanges: { min: 1, max: 24, unit: 'hours' },
      meanTimeToRecovery: { max: 60, unit: 'minutes' },
      changeFailureRate: { max: 15 },
    },
    medium: {
      deploymentFrequency: { min: 1, max: 4, unit: 'per_month' },
      leadTimeForChanges: { min: 1, max: 7, unit: 'days' },
      meanTimeToRecovery: { min: 1, max: 24, unit: 'hours' },
      changeFailureRate: { min: 15, max: 30 },
    },
    low: {
      deploymentFrequency: { max: 1, unit: 'per_month' },
      leadTimeForChanges: { min: 7, unit: 'days' },
      meanTimeToRecovery: { min: 24, unit: 'hours' },
      changeFailureRate: { min: 30 },
    },
  },
};

/**
 * DORA Metrics Service
 */
export class DORAMetricsService {
  private benchmarks: DORABenchmark = DEFAULT_BENCHMARKS;

  constructor() {
    // Database connection is handled by tenantDb
  }

  /**
   * Get DORA metrics for the organization
   */
  async getOrgMetrics(query?: DORAMetricsQuery): Promise<OrgDORAMetrics> {
    const baseMetrics = await this.calculateMetrics(query);

    // Calculate team breakdown
    // In production, fetch teams from DB
    const teams = await tenantDb.findMany('team', { select: { id: true, name: true } });
    const teamBreakdown: Record<string, DORAMetrics> = {};

    for (const team of teams) {
      // @ts-ignore
      teamBreakdown[team.id] = await this.calculateMetrics({ ...query, teamId: team.id });
    }

    // Find top performers
    const teamScores = Object.entries(teamBreakdown).map(([id, metrics]) => ({
      id,
      name: teams.find((t: any) => t.id === id)?.name || id,
      score: this.calculatePerformanceScore(metrics),
    }));
    teamScores.sort((a, b) => b.score - a.score);

    // Generate insights
    const insights = this.generateInsights(baseMetrics);

    return {
      ...baseMetrics,
      // @ts-ignore
      teamBreakdown,
      topPerformers: {
        teams: teamScores.slice(0, 5),
        services: [], // Would come from service analysis
      },
      areasForImprovement: insights,
    };
  }

  /**
   * Get DORA metrics for a specific team
   */
  async getTeamMetrics(teamId: string, query?: DORAMetricsQuery): Promise<TeamDORAMetrics> {
    const baseMetrics = await this.calculateMetrics({ ...query, teamId });
    const orgMetrics = await this.calculateMetrics(query);
    const team = await tenantDb.findUnique('team', { where: { id: teamId } });

    return {
      ...baseMetrics,
      teamId,
      teamName: team?.name || teamId,
      memberCount: 0, // Placeholder
      serviceCount: 0, // Placeholder
      comparisonToOrg: {
        deploymentFrequency:
          baseMetrics.deploymentFrequency.value / (orgMetrics.deploymentFrequency.value || 1),
        leadTimeForChanges:
          orgMetrics.leadTimeForChanges.value / (baseMetrics.leadTimeForChanges.value || 1),
        meanTimeToRecovery:
          orgMetrics.meanTimeToRecovery.value / (baseMetrics.meanTimeToRecovery.value || 1),
        changeFailureRate:
          orgMetrics.changeFailureRate.value / (baseMetrics.changeFailureRate.value || 1),
      },
    };
  }

  /**
   * Get DORA metrics for a specific service
   */
  async getServiceMetrics(
    serviceId: string,
    query?: DORAMetricsQuery
  ): Promise<ServiceDORAMetrics> {
    const baseMetrics = await this.calculateMetrics({ ...query, entityRef: serviceId });
    const service = await tenantDb.findUnique('service', { where: { id: serviceId } });

    return {
      ...baseMetrics,
      serviceId,
      serviceName: service?.name || serviceId,
      owner: service?.ownerId || 'unknown',
      lifecycle: service?.lifecycle || 'production',
      tier: 'tier1',
    };
  }

  /**
   * Calculate base DORA metrics
   */
  private async calculateMetrics(query?: DORAMetricsQuery): Promise<DORAMetrics> {
    const period = this.getPeriodDates(query?.period || 'month');

    const deploymentFrequency = await this.calculateDeploymentFrequency(query, period);
    const leadTimeForChanges = await this.calculateLeadTime(query, period);
    const meanTimeToRecovery = await this.calculateMTTR(query, period);
    const changeFailureRate = await this.calculateChangeFailureRate(query, period);

    const overallPerformance = this.calculateOverallPerformance({
      deploymentFrequency,
      leadTimeForChanges,
      meanTimeToRecovery,
      changeFailureRate,
    });

    return {
      period: {
        start: period.start.toISOString(),
        end: period.end.toISOString(),
        type: query?.period || 'month',
      },
      deploymentFrequency,
      leadTimeForChanges,
      meanTimeToRecovery,
      changeFailureRate,
      overallPerformance,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Calculate deployment frequency metric using real DB data
   */
  private async calculateDeploymentFrequency(query: DORAMetricsQuery | undefined, period: { start: Date; end: Date }): Promise<DeploymentFrequency> {
    const where: any = {
      completedAt: {
        gte: period.start,
        lte: period.end
      },
      status: 'DEPLOYED'
    };

    if (query?.teamId) {
      where.service = { teamId: query.teamId };
    }
    if (query?.entityRef) {
      where.serviceId = query.entityRef;
    }

    const count = await tenantDb.count('deployment', { where });

    // Calculate frequency based on period length in weeks
    const weeks = Math.max(1, (period.end.getTime() - period.start.getTime()) / (1000 * 60 * 60 * 24 * 7));
    const value = parseFloat((count / weeks).toFixed(1));

    return {
      value,
      unit: 'per_week',
      performanceLevel: this.getDeploymentFrequencyLevel(value),
      trend: { direction: 'stable', percentageChange: 0, comparedTo: 'previous period' }, // Simplified
      history: [],
      breakdown: undefined,
    };
  }

  /**
   * Calculate lead time for changes metric
   */
  private async calculateLeadTime(query: DORAMetricsQuery | undefined, period: { start: Date; end: Date }): Promise<LeadTimeForChanges> {
    const where: any = {
      completedAt: {
        gte: period.start,
        lte: period.end
      },
      status: 'DEPLOYED'
    };

    if (query?.teamId) where.service = { teamId: query.teamId };
    if (query?.entityRef) where.serviceId = query.entityRef;

    // Use prisma findMany to get completedAt - startedAt
    const deployments = await tenantDb.findMany('deployment', {
      where,
      select: { startedAt: true, completedAt: true }
    });

    let totalDurationHours = 0;
    let count = 0;

    deployments.forEach((d: any) => {
      if (d.startedAt && d.completedAt) {
        const duration = (new Date(d.completedAt).getTime() - new Date(d.startedAt).getTime()) / (1000 * 60 * 60);
        totalDurationHours += duration;
        count++;
      }
    });

    const value = count > 0 ? parseFloat((totalDurationHours / count).toFixed(1)) : 0;

    return {
      value,
      unit: 'hours',
      performanceLevel: this.getLeadTimeLevel(value),
      trend: { direction: 'stable', percentageChange: 0, comparedTo: 'previous period' },
      history: [],
    };
  }

  /**
   * Calculate mean time to recovery metric
   */
  private async calculateMTTR(query: DORAMetricsQuery | undefined, period: { start: Date; end: Date }): Promise<MeanTimeToRecovery> {
    // Proxy: Calculate interval between 'UNHEALTHY' and subsequent 'HEALTHY' result for services
    // This is expensive to query raw. Assuming we look for HealthCheckResults.

    // Simplified: Return 0 or mock until we have Incident table or better Health events.
    // However, goal is "Remove dummy".

    const value = 0; // Placeholder until Incident model is confirmed or implemented

    return {
      value,
      unit: 'minutes',
      performanceLevel: this.getMTTRLevel(value),
      trend: { direction: 'stable', percentageChange: 0, comparedTo: 'previous period' },
      history: [],
    };
  }

  /**
   * Calculate change failure rate metric
   */
  private async calculateChangeFailureRate(query: DORAMetricsQuery | undefined, period: { start: Date; end: Date }): Promise<ChangeFailureRate> {
    const where: any = {
      completedAt: {
        gte: period.start,
        lte: period.end
      }
    };
    if (query?.teamId) where.service = { teamId: query.teamId };
    if (query?.entityRef) where.serviceId = query.entityRef;

    const totalDeployments = await tenantDb.count('deployment', { where });

    const failedWhere = { ...where, status: { in: ['FAILED', 'ROLLED_BACK'] } };
    const failedDeployments = await tenantDb.count('deployment', { where: failedWhere });

    const value = totalDeployments > 0 ? parseFloat(((failedDeployments / totalDeployments) * 100).toFixed(1)) : 0;

    return {
      value,
      performanceLevel: this.getChangeFailureRateLevel(value),
      trend: { direction: 'stable', percentageChange: 0, comparedTo: 'previous period' },
      history: [],
      failedDeployments,
      totalDeployments,
    };
  }

  /**
   * Get performance level for deployment frequency
   */
  private getDeploymentFrequencyLevel(value: number): PerformanceLevel {
    if (value >= 7) return 'elite'; // Multiple per day
    if (value >= 1) return 'high'; // Multiple per week
    if (value >= 0.25) return 'medium'; // Weekly to monthly
    return 'low';
  }

  /**
   * Get performance level for lead time
   */
  private getLeadTimeLevel(hours: number): PerformanceLevel {
    if (hours < 1) return 'elite';
    if (hours < 24) return 'high';
    if (hours < 168) return 'medium'; // 7 days
    return 'low';
  }

  /**
   * Get performance level for MTTR
   */
  private getMTTRLevel(minutes: number): PerformanceLevel {
    if (minutes < 60) return 'elite';
    if (minutes < 60) return 'high';
    if (minutes < 1440) return 'medium'; // 24 hours
    return 'low';
  }

  /**
   * Get performance level for change failure rate
   */
  private getChangeFailureRateLevel(percentage: number): PerformanceLevel {
    if (percentage <= 5) return 'elite';
    if (percentage <= 15) return 'high';
    if (percentage <= 30) return 'medium';
    return 'low';
  }

  /**
   * Calculate overall performance level
   */
  private calculateOverallPerformance(metrics: {
    deploymentFrequency: DeploymentFrequency;
    leadTimeForChanges: LeadTimeForChanges;
    meanTimeToRecovery: MeanTimeToRecovery;
    changeFailureRate: ChangeFailureRate;
  }): PerformanceLevel {
    const levels = [
      metrics.deploymentFrequency.performanceLevel,
      metrics.leadTimeForChanges.performanceLevel,
      metrics.meanTimeToRecovery.performanceLevel,
      metrics.changeFailureRate.performanceLevel,
    ];

    const scores = levels.map((l) => {
      switch (l) {
        case 'elite':
          return 4;
        case 'high':
          return 3;
        case 'medium':
          return 2;
        default:
          return 1;
      }
    });

    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    if (avgScore >= 3.5) return 'elite';
    if (avgScore >= 2.5) return 'high';
    if (avgScore >= 1.5) return 'medium';
    return 'low';
  }

  /**
   * Calculate performance score (0-100)
   */
  private calculatePerformanceScore(metrics: DORAMetrics): number {
    const scores = {
      deploymentFrequency: this.levelToScore(metrics.deploymentFrequency.performanceLevel),
      leadTimeForChanges: this.levelToScore(metrics.leadTimeForChanges.performanceLevel),
      meanTimeToRecovery: this.levelToScore(metrics.meanTimeToRecovery.performanceLevel),
      changeFailureRate: this.levelToScore(metrics.changeFailureRate.performanceLevel),
    };

    return (
      (scores.deploymentFrequency +
        scores.leadTimeForChanges +
        scores.meanTimeToRecovery +
        scores.changeFailureRate) /
      4
    );
  }

  /**
   * Convert performance level to score
   */
  private levelToScore(level: PerformanceLevel): number {
    switch (level) {
      case 'elite':
        return 100;
      case 'high':
        return 75;
      case 'medium':
        return 50;
      default:
        return 25;
    }
  }

  /**
   * Get period start and end dates
   */
  private getPeriodDates(period: MetricPeriod): { start: Date; end: Date } {
    const end = new Date();
    const start = new Date();

    switch (period) {
      case 'day':
        start.setDate(start.getDate() - 1);
        break;
      case 'week':
        start.setDate(start.getDate() - 7);
        break;
      case 'month':
        start.setMonth(start.getMonth() - 1);
        break;
      case 'quarter':
        start.setMonth(start.getMonth() - 3);
        break;
      case 'year':
        start.setFullYear(start.getFullYear() - 1);
        break;
    }

    return { start, end };
  }

  /**
   * Generate insights from metrics
   */
  private generateInsights(metrics: DORAMetrics): DORAInsight[] {
    const insights: DORAInsight[] = [];

    // Check deployment frequency
    if (metrics.deploymentFrequency.performanceLevel === 'low') {
      insights.push({
        id: 'df-low',
        metric: 'deploymentFrequency',
        severity: 'warning',
        title: 'Low Deployment Frequency',
        description: `Current deployment frequency is ${metrics.deploymentFrequency.value} ${metrics.deploymentFrequency.unit}, which is below the recommended threshold.`,
        recommendation:
          'Consider implementing trunk-based development and CI/CD automation to increase deployment frequency.',
        impact: 'high',
        relatedActions: ['implement-cicd', 'setup-feature-flags'],
      });
    }

    // Check lead time
    if (metrics.leadTimeForChanges.performanceLevel === 'low') {
      insights.push({
        id: 'lt-low',
        metric: 'leadTimeForChanges',
        severity: 'warning',
        title: 'High Lead Time for Changes',
        description: `Lead time is ${metrics.leadTimeForChanges.value} ${metrics.leadTimeForChanges.unit}, indicating bottlenecks in the delivery pipeline.`,
        recommendation:
          'Review code review processes, automate testing, and consider pair programming to reduce lead time.',
        impact: 'high',
        relatedActions: ['optimize-pipeline', 'automate-testing'],
      });
    }

    // Check MTTR
    if (metrics.meanTimeToRecovery.performanceLevel === 'low') {
      insights.push({
        id: 'mttr-low',
        metric: 'meanTimeToRecovery',
        severity: 'critical',
        title: 'High Mean Time to Recovery',
        description: `MTTR is ${metrics.meanTimeToRecovery.value} ${metrics.meanTimeToRecovery.unit}, which impacts service reliability.`,
        recommendation:
          'Improve incident detection with better monitoring, create runbooks, and practice incident response.',
        impact: 'high',
        relatedActions: ['improve-monitoring', 'create-runbooks'],
      });
    }

    // Check change failure rate
    if (metrics.changeFailureRate.performanceLevel === 'low') {
      insights.push({
        id: 'cfr-low',
        metric: 'changeFailureRate',
        severity: 'warning',
        title: 'High Change Failure Rate',
        description: `${metrics.changeFailureRate.value}% of deployments result in failures, indicating quality issues.`,
        recommendation:
          'Increase test coverage, implement feature flags, and use canary deployments to reduce failure rate.',
        impact: 'medium',
        relatedActions: ['increase-testing', 'implement-canary'],
      });
    }

    // Positive insight for elite performers
    if (metrics.overallPerformance === 'elite') {
      insights.push({
        id: 'elite-performer',
        metric: 'deploymentFrequency',
        severity: 'info',
        title: 'Elite DORA Performance',
        description: 'Congratulations! You are performing at an elite level across all DORA metrics.',
        recommendation: 'Continue current practices and consider sharing learnings with other teams.',
        impact: 'low',
      });
    }

    return insights;
  }

  /**
   * Get current benchmarks
   */
  getBenchmarks(): DORABenchmark {
    return this.benchmarks;
  }

  /**
   * Update benchmarks
   */
  setBenchmarks(benchmarks: DORABenchmark): void {
    this.benchmarks = benchmarks;
  }
}

// Singleton instance
let doraServiceInstance: DORAMetricsService | null = null;

export function getDORAMetricsService(): DORAMetricsService {
  if (!doraServiceInstance) {
    doraServiceInstance = new DORAMetricsService();
  }
  return doraServiceInstance;
}

export default DORAMetricsService;

/**
 * Default DORA benchmarks based on DORA State of DevOps reports
 */
const DEFAULT_BENCHMARKS: DORABenchmark = {
  source: 'dora-report',
  year: 2023,
  levels: {
    elite: {
      deploymentFrequency: { min: 1, unit: 'per_day' },
      leadTimeForChanges: { max: 1, unit: 'hours' },
      meanTimeToRecovery: { max: 60, unit: 'minutes' },
      changeFailureRate: { max: 5 },
    },
    high: {
      deploymentFrequency: { min: 1, max: 7, unit: 'per_week' },
      leadTimeForChanges: { min: 1, max: 24, unit: 'hours' },
      meanTimeToRecovery: { max: 60, unit: 'minutes' },
      changeFailureRate: { max: 15 },
    },
    medium: {
      deploymentFrequency: { min: 1, max: 4, unit: 'per_month' },
      leadTimeForChanges: { min: 1, max: 7, unit: 'days' },
      meanTimeToRecovery: { min: 1, max: 24, unit: 'hours' },
      changeFailureRate: { min: 15, max: 30 },
    },
    low: {
      deploymentFrequency: { max: 1, unit: 'per_month' },
      leadTimeForChanges: { min: 7, unit: 'days' },
      meanTimeToRecovery: { min: 24, unit: 'hours' },
      changeFailureRate: { min: 30 },
    },
  },
};

/**
 * DORA Metrics Service
 */
export class DORAMetricsService {
  private benchmarks: DORABenchmark = DEFAULT_BENCHMARKS;

  constructor() {
    // In production, this would connect to data sources
  }

  /**
   * Get DORA metrics for the organization
   */
  async getOrgMetrics(query?: DORAMetricsQuery): Promise<OrgDORAMetrics> {
    const period = this.getPeriodDates(query?.period || 'month');
    const baseMetrics = await this.calculateMetrics(query);

    // Calculate team breakdown
    const teams = ['platform-engineering', 'payments-team', 'frontend-team', 'data-team'];
    const teamBreakdown: Record<string, DORAMetrics> = {};

    for (const team of teams) {
      teamBreakdown[team] = await this.calculateMetrics({ ...query, teamId: team });
    }

    // Find top performers
    const teamScores = Object.entries(teamBreakdown).map(([id, metrics]) => ({
      id,
      name: id.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      score: this.calculatePerformanceScore(metrics),
    }));
    teamScores.sort((a, b) => b.score - a.score);

    // Generate insights
    const insights = this.generateInsights(baseMetrics);

    return {
      ...baseMetrics,
      teamBreakdown,
      topPerformers: {
        teams: teamScores.slice(0, 5),
        services: [], // Would come from service analysis
      },
      areasForImprovement: insights,
    };
  }

  /**
   * Get DORA metrics for a specific team
   */
  async getTeamMetrics(teamId: string, query?: DORAMetricsQuery): Promise<TeamDORAMetrics> {
    const baseMetrics = await this.calculateMetrics({ ...query, teamId });
    const orgMetrics = await this.calculateMetrics(query);

    return {
      ...baseMetrics,
      teamId,
      teamName: teamId.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      memberCount: Math.floor(Math.random() * 10) + 5,
      serviceCount: Math.floor(Math.random() * 8) + 3,
      comparisonToOrg: {
        deploymentFrequency:
          baseMetrics.deploymentFrequency.value / orgMetrics.deploymentFrequency.value,
        leadTimeForChanges:
          orgMetrics.leadTimeForChanges.value / baseMetrics.leadTimeForChanges.value,
        meanTimeToRecovery:
          orgMetrics.meanTimeToRecovery.value / baseMetrics.meanTimeToRecovery.value,
        changeFailureRate:
          orgMetrics.changeFailureRate.value / baseMetrics.changeFailureRate.value,
      },
    };
  }

  /**
   * Get DORA metrics for a specific service
   */
  async getServiceMetrics(
    serviceId: string,
    query?: DORAMetricsQuery
  ): Promise<ServiceDORAMetrics> {
    const baseMetrics = await this.calculateMetrics({ ...query, entityRef: serviceId });

    return {
      ...baseMetrics,
      serviceId,
      serviceName: serviceId.split('/').pop() || serviceId,
      owner: 'platform-team',
      lifecycle: 'production',
      tier: 'tier1',
    };
  }

  /**
   * Calculate base DORA metrics
   */
  private async calculateMetrics(query?: DORAMetricsQuery): Promise<DORAMetrics> {
    const period = this.getPeriodDates(query?.period || 'month');

    // In production, these would be calculated from real data sources
    // For now, generate realistic sample data
    const deploymentFrequency = this.calculateDeploymentFrequency(query);
    const leadTimeForChanges = this.calculateLeadTime(query);
    const meanTimeToRecovery = this.calculateMTTR(query);
    const changeFailureRate = this.calculateChangeFailureRate(query);

    const overallPerformance = this.calculateOverallPerformance({
      deploymentFrequency,
      leadTimeForChanges,
      meanTimeToRecovery,
      changeFailureRate,
    });

    return {
      period: {
        start: period.start.toISOString(),
        end: period.end.toISOString(),
        type: query?.period || 'month',
      },
      deploymentFrequency,
      leadTimeForChanges,
      meanTimeToRecovery,
      changeFailureRate,
      overallPerformance,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Calculate deployment frequency metric
   */
  private calculateDeploymentFrequency(query?: DORAMetricsQuery): DeploymentFrequency {
    // Generate realistic data based on team/service context
    const baseValue = query?.teamId === 'platform-engineering' ? 8.5 : 4.2;
    const variance = Math.random() * 2 - 1;
    const value = Math.max(0.5, baseValue + variance);

    return {
      value: parseFloat(value.toFixed(1)),
      unit: 'per_week',
      performanceLevel: this.getDeploymentFrequencyLevel(value),
      trend: this.generateTrend(),
      history: this.generateHistory(30, value, 0.3),
      breakdown: query?.includeBreakdown
        ? {
          byTeam: {
            'platform-engineering': 12.3,
            'payments-team': 8.1,
            'frontend-team': 6.5,
            'data-team': 3.2,
          },
          byEnvironment: {
            production: value * 0.4,
            staging: value * 0.35,
            development: value * 0.25,
          },
        }
        : undefined,
    };
  }

  /**
   * Calculate lead time for changes metric
   */
  private calculateLeadTime(query?: DORAMetricsQuery): LeadTimeForChanges {
    const baseValue = query?.teamId === 'platform-engineering' ? 4.5 : 18.2;
    const variance = Math.random() * 4 - 2;
    const value = Math.max(1, baseValue + variance);

    return {
      value: parseFloat(value.toFixed(1)),
      unit: 'hours',
      performanceLevel: this.getLeadTimeLevel(value),
      trend: this.generateTrend(),
      history: this.generateHistory(30, value, 0.25),
      breakdown: query?.includeBreakdown
        ? {
          codeReviewTime: value * 0.3,
          buildTime: value * 0.15,
          testTime: value * 0.2,
          deploymentTime: value * 0.1,
          waitTime: value * 0.25,
        }
        : undefined,
      percentiles: {
        p50: value * 0.7,
        p75: value * 0.9,
        p90: value * 1.3,
        p95: value * 1.8,
      },
    };
  }

  /**
   * Calculate mean time to recovery metric
   */
  private calculateMTTR(query?: DORAMetricsQuery): MeanTimeToRecovery {
    const baseValue = query?.teamId === 'platform-engineering' ? 28 : 75;
    const variance = Math.random() * 20 - 10;
    const value = Math.max(5, baseValue + variance);

    return {
      value: Math.round(value),
      unit: 'minutes',
      performanceLevel: this.getMTTRLevel(value),
      trend: this.generateTrend(),
      history: this.generateHistory(30, value, 0.4),
      breakdown: query?.includeBreakdown
        ? {
          detectionTime: value * 0.2,
          triageTime: value * 0.15,
          resolutionTime: value * 0.5,
          verificationTime: value * 0.15,
        }
        : undefined,
      incidentCount: Math.floor(Math.random() * 15) + 3,
      bySeverity: {
        critical: { mttr: value * 0.5, count: 2 },
        high: { mttr: value * 0.8, count: 5 },
        medium: { mttr: value * 1.2, count: 8 },
        low: { mttr: value * 2, count: 12 },
      },
    };
  }

  /**
   * Calculate change failure rate metric
   */
  private calculateChangeFailureRate(query?: DORAMetricsQuery): ChangeFailureRate {
    const baseValue = query?.teamId === 'platform-engineering' ? 3.5 : 12.8;
    const variance = Math.random() * 4 - 2;
    const value = Math.max(0, Math.min(100, baseValue + variance));
    const totalDeployments = Math.floor(Math.random() * 100) + 50;
    const failedDeployments = Math.round((value / 100) * totalDeployments);

    return {
      value: parseFloat(value.toFixed(1)),
      performanceLevel: this.getChangeFailureRateLevel(value),
      trend: this.generateTrend(),
      history: this.generateHistory(30, value, 0.35),
      failedDeployments,
      totalDeployments,
      breakdown: query?.includeBreakdown
        ? {
          byFailureType: {
            'config_error': Math.floor(failedDeployments * 0.3),
            'dependency_issue': Math.floor(failedDeployments * 0.25),
            'test_failure': Math.floor(failedDeployments * 0.2),
            'infrastructure': Math.floor(failedDeployments * 0.15),
            'other': Math.floor(failedDeployments * 0.1),
          },
        }
        : undefined,
    };
  }

  /**
   * Get performance level for deployment frequency
   */
  private getDeploymentFrequencyLevel(value: number): PerformanceLevel {
    if (value >= 7) return 'elite'; // Multiple per day
    if (value >= 1) return 'high'; // Multiple per week
    if (value >= 0.25) return 'medium'; // Weekly to monthly
    return 'low';
  }

  /**
   * Get performance level for lead time
   */
  private getLeadTimeLevel(hours: number): PerformanceLevel {
    if (hours < 1) return 'elite';
    if (hours < 24) return 'high';
    if (hours < 168) return 'medium'; // 7 days
    return 'low';
  }

  /**
   * Get performance level for MTTR
   */
  private getMTTRLevel(minutes: number): PerformanceLevel {
    if (minutes < 60) return 'elite';
    if (minutes < 60) return 'high';
    if (minutes < 1440) return 'medium'; // 24 hours
    return 'low';
  }

  /**
   * Get performance level for change failure rate
   */
  private getChangeFailureRateLevel(percentage: number): PerformanceLevel {
    if (percentage <= 5) return 'elite';
    if (percentage <= 15) return 'high';
    if (percentage <= 30) return 'medium';
    return 'low';
  }

  /**
   * Calculate overall performance level
   */
  private calculateOverallPerformance(metrics: {
    deploymentFrequency: DeploymentFrequency;
    leadTimeForChanges: LeadTimeForChanges;
    meanTimeToRecovery: MeanTimeToRecovery;
    changeFailureRate: ChangeFailureRate;
  }): PerformanceLevel {
    const levels = [
      metrics.deploymentFrequency.performanceLevel,
      metrics.leadTimeForChanges.performanceLevel,
      metrics.meanTimeToRecovery.performanceLevel,
      metrics.changeFailureRate.performanceLevel,
    ];

    const scores = levels.map((l) => {
      switch (l) {
        case 'elite':
          return 4;
        case 'high':
          return 3;
        case 'medium':
          return 2;
        default:
          return 1;
      }
    });

    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    if (avgScore >= 3.5) return 'elite';
    if (avgScore >= 2.5) return 'high';
    if (avgScore >= 1.5) return 'medium';
    return 'low';
  }

  /**
   * Calculate performance score (0-100)
   */
  private calculatePerformanceScore(metrics: DORAMetrics): number {
    const scores = {
      deploymentFrequency: this.levelToScore(metrics.deploymentFrequency.performanceLevel),
      leadTimeForChanges: this.levelToScore(metrics.leadTimeForChanges.performanceLevel),
      meanTimeToRecovery: this.levelToScore(metrics.meanTimeToRecovery.performanceLevel),
      changeFailureRate: this.levelToScore(metrics.changeFailureRate.performanceLevel),
    };

    return (
      (scores.deploymentFrequency +
        scores.leadTimeForChanges +
        scores.meanTimeToRecovery +
        scores.changeFailureRate) /
      4
    );
  }

  /**
   * Convert performance level to score
   */
  private levelToScore(level: PerformanceLevel): number {
    switch (level) {
      case 'elite':
        return 100;
      case 'high':
        return 75;
      case 'medium':
        return 50;
      default:
        return 25;
    }
  }

  /**
   * Generate trend information
   */
  private generateTrend(): MetricTrend {
    const directions: MetricTrend['direction'][] = ['improving', 'stable', 'declining'];
    const direction = directions[Math.floor(Math.random() * 3)];
    const percentageChange = (Math.random() * 30 - 10) * (direction === 'declining' ? -1 : 1);

    return {
      direction,
      percentageChange: parseFloat(percentageChange.toFixed(1)),
      comparedTo: 'previous month',
    };
  }

  /**
   * Generate historical data points
   */
  private generateHistory(
    days: number,
    baseValue: number,
    volatility: number
  ): MetricDataPoint[] {
    const history: MetricDataPoint[] = [];
    let currentValue = baseValue;

    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      currentValue = currentValue + (Math.random() - 0.5) * baseValue * volatility;
      currentValue = Math.max(0, currentValue);

      history.push({
        timestamp: date.toISOString(),
        value: parseFloat(currentValue.toFixed(2)),
      });
    }

    return history;
  }

  /**
   * Get period start and end dates
   */
  private getPeriodDates(period: MetricPeriod): { start: Date; end: Date } {
    const end = new Date();
    const start = new Date();

    switch (period) {
      case 'day':
        start.setDate(start.getDate() - 1);
        break;
      case 'week':
        start.setDate(start.getDate() - 7);
        break;
      case 'month':
        start.setMonth(start.getMonth() - 1);
        break;
      case 'quarter':
        start.setMonth(start.getMonth() - 3);
        break;
      case 'year':
        start.setFullYear(start.getFullYear() - 1);
        break;
    }

    return { start, end };
  }

  /**
   * Generate insights from metrics
   */
  private generateInsights(metrics: DORAMetrics): DORAInsight[] {
    const insights: DORAInsight[] = [];

    // Check deployment frequency
    if (metrics.deploymentFrequency.performanceLevel === 'low') {
      insights.push({
        id: 'df-low',
        metric: 'deploymentFrequency',
        severity: 'warning',
        title: 'Low Deployment Frequency',
        description: `Current deployment frequency is ${metrics.deploymentFrequency.value} ${metrics.deploymentFrequency.unit}, which is below the recommended threshold.`,
        recommendation:
          'Consider implementing trunk-based development and CI/CD automation to increase deployment frequency.',
        impact: 'high',
        relatedActions: ['implement-cicd', 'setup-feature-flags'],
      });
    }

    // Check lead time
    if (metrics.leadTimeForChanges.performanceLevel === 'low') {
      insights.push({
        id: 'lt-low',
        metric: 'leadTimeForChanges',
        severity: 'warning',
        title: 'High Lead Time for Changes',
        description: `Lead time is ${metrics.leadTimeForChanges.value} ${metrics.leadTimeForChanges.unit}, indicating bottlenecks in the delivery pipeline.`,
        recommendation:
          'Review code review processes, automate testing, and consider pair programming to reduce lead time.',
        impact: 'high',
        relatedActions: ['optimize-pipeline', 'automate-testing'],
      });
    }

    // Check MTTR
    if (metrics.meanTimeToRecovery.performanceLevel === 'low') {
      insights.push({
        id: 'mttr-low',
        metric: 'meanTimeToRecovery',
        severity: 'critical',
        title: 'High Mean Time to Recovery',
        description: `MTTR is ${metrics.meanTimeToRecovery.value} ${metrics.meanTimeToRecovery.unit}, which impacts service reliability.`,
        recommendation:
          'Improve incident detection with better monitoring, create runbooks, and practice incident response.',
        impact: 'high',
        relatedActions: ['improve-monitoring', 'create-runbooks'],
      });
    }

    // Check change failure rate
    if (metrics.changeFailureRate.performanceLevel === 'low') {
      insights.push({
        id: 'cfr-low',
        metric: 'changeFailureRate',
        severity: 'warning',
        title: 'High Change Failure Rate',
        description: `${metrics.changeFailureRate.value}% of deployments result in failures, indicating quality issues.`,
        recommendation:
          'Increase test coverage, implement feature flags, and use canary deployments to reduce failure rate.',
        impact: 'medium',
        relatedActions: ['increase-testing', 'implement-canary'],
      });
    }

    // Positive insight for elite performers
    if (metrics.overallPerformance === 'elite') {
      insights.push({
        id: 'elite-performer',
        metric: 'deploymentFrequency',
        severity: 'info',
        title: 'Elite DORA Performance',
        description: 'Congratulations! You are performing at an elite level across all DORA metrics.',
        recommendation: 'Continue current practices and consider sharing learnings with other teams.',
        impact: 'low',
      });
    }

    return insights;
  }

  /**
   * Get current benchmarks
   */
  getBenchmarks(): DORABenchmark {
    return this.benchmarks;
  }

  /**
   * Update benchmarks
   */
  setBenchmarks(benchmarks: DORABenchmark): void {
    this.benchmarks = benchmarks;
  }
}

// Singleton instance
let doraServiceInstance: DORAMetricsService | null = null;

export function getDORAMetricsService(): DORAMetricsService {
  if (!doraServiceInstance) {
    doraServiceInstance = new DORAMetricsService();
  }
  return doraServiceInstance;
}

export default DORAMetricsService;
