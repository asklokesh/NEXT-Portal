import { EventEmitter } from 'events';
import * as tf from '@tensorflow/tfjs';
import { prisma } from '@/lib/prisma';

interface DORAMetrics {
  deploymentFrequency: number;
  leadTimeForChanges: number;
  meanTimeToRestore: number;
  changeFailureRate: number;
  timestamp: Date;
}

interface SPACEMetrics {
  satisfaction: {
    tooling: number;
    workEnvironment: number;
    culture: number;
    autonomy: number;
  };
  performance: {
    velocity: number;
    quality: number;
    impact: number;
  };
  activity: {
    commits: number;
    pullRequests: number;
    codeReviews: number;
    documentation: number;
  };
  communication: {
    meetings: number;
    messages: number;
    collaboration: number;
  };
  efficiency: {
    focusTime: number;
    contextSwitching: number;
    waitTime: number;
  };
}

interface ProductivityMetrics {
  developerId: string;
  teamId: string;
  period: Date;
  dora: DORAMetrics;
  space: SPACEMetrics;
  codeQuality: {
    complexity: number;
    coverage: number;
    techDebt: number;
    duplication: number;
  };
  collaboration: {
    prReviews: number;
    pairProgramming: number;
    knowledgeSharing: number;
    mentoring: number;
  };
  flowState: {
    deepWorkHours: number;
    interruptions: number;
    focusScore: number;
  };
  score: number;
  percentile: number;
}

interface ProductivityInsight {
  id: string;
  type: 'improvement' | 'risk' | 'achievement' | 'recommendation';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  metrics: string[];
  impact: number;
  actions: string[];
}

export class AnalyticsEngine extends EventEmitter {
  private model: tf.LayersModel | null = null;
  private metricsCache: Map<string, ProductivityMetrics> = new Map();
  private benchmarks: Map<string, any> = new Map();
  private customKPIs: Map<string, any> = new Map();

  constructor() {
    super();
    this.loadModel();
    this.loadBenchmarks();
  }

  private async loadModel() {
    try {
      this.model = await tf.loadLayersModel('/models/productivity/model.json');
    } catch (error) {
      this.model = this.createModel();
    }
  }

  private createModel(): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [50], units: 128, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 64, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' })
      ]
    });

    model.compile({
      optimizer: 'adam',
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  private async loadBenchmarks() {
    this.benchmarks.set('dora', {
      elite: {
        deploymentFrequency: 1000,
        leadTimeForChanges: 1,
        meanTimeToRestore: 1,
        changeFailureRate: 5
      },
      high: {
        deploymentFrequency: 30,
        leadTimeForChanges: 7,
        meanTimeToRestore: 24,
        changeFailureRate: 10
      },
      medium: {
        deploymentFrequency: 4,
        leadTimeForChanges: 30,
        meanTimeToRestore: 168,
        changeFailureRate: 15
      },
      low: {
        deploymentFrequency: 0.5,
        leadTimeForChanges: 180,
        meanTimeToRestore: 720,
        changeFailureRate: 30
      }
    });
  }

  async calculateProductivity(
    developerId: string,
    teamId: string,
    period: Date = new Date()
  ): Promise<ProductivityMetrics> {
    const [dora, space, codeQuality, collaboration, flowState] = await Promise.all([
      this.calculateDORAMetrics(developerId, teamId, period),
      this.calculateSPACEMetrics(developerId, teamId, period),
      this.calculateCodeQualityMetrics(developerId, teamId, period),
      this.calculateCollaborationMetrics(developerId, teamId, period),
      this.calculateFlowStateMetrics(developerId, teamId, period)
    ]);

    const score = this.calculateProductivityScore({
      dora,
      space,
      codeQuality,
      collaboration,
      flowState
    });

    const percentile = await this.calculatePercentile(score, teamId);

    const metrics: ProductivityMetrics = {
      developerId,
      teamId,
      period,
      dora,
      space,
      codeQuality,
      collaboration,
      flowState,
      score,
      percentile
    };

    this.metricsCache.set(`${developerId}-${period.toISOString()}`, metrics);
    await this.persistMetrics(metrics);

    this.emit('metrics-calculated', metrics);
    return metrics;
  }

  private async calculateDORAMetrics(
    developerId: string,
    teamId: string,
    period: Date
  ): Promise<DORAMetrics> {
    const thirtyDaysAgo = new Date(period.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [deployments, commits, incidents] = await Promise.all([
      prisma.deployment.findMany({
        where: {
          OR: [{ deployedBy: developerId }, { teamId }],
          createdAt: { gte: thirtyDaysAgo, lte: period }
        }
      }),
      prisma.commit.findMany({
        where: {
          OR: [{ authorId: developerId }, { teamId }],
          createdAt: { gte: thirtyDaysAgo, lte: period }
        }
      }),
      prisma.incident.findMany({
        where: {
          teamId,
          createdAt: { gte: thirtyDaysAgo, lte: period }
        }
      })
    ]);

    const deploymentFrequency = deployments.length / 30;
    
    const leadTimes = commits
      .filter(c => c.deployedAt)
      .map(c => (c.deployedAt!.getTime() - c.createdAt.getTime()) / (1000 * 60 * 60));
    const leadTimeForChanges = leadTimes.length > 0
      ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length
      : 0;

    const restoreTimes = incidents
      .filter(i => i.resolvedAt)
      .map(i => (i.resolvedAt!.getTime() - i.createdAt.getTime()) / (1000 * 60 * 60));
    const meanTimeToRestore = restoreTimes.length > 0
      ? restoreTimes.reduce((a, b) => a + b, 0) / restoreTimes.length
      : 0;

    const failedDeployments = deployments.filter(d => d.status === 'failed').length;
    const changeFailureRate = deployments.length > 0
      ? (failedDeployments / deployments.length) * 100
      : 0;

    return {
      deploymentFrequency,
      leadTimeForChanges,
      meanTimeToRestore,
      changeFailureRate,
      timestamp: period
    };
  }

  private async calculateSPACEMetrics(
    developerId: string,
    teamId: string,
    period: Date
  ): Promise<SPACEMetrics> {
    const thirtyDaysAgo = new Date(period.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [surveys, activities, communications] = await Promise.all([
      prisma.developerSurvey.findMany({
        where: {
          developerId,
          createdAt: { gte: thirtyDaysAgo, lte: period }
        }
      }),
      prisma.developerActivity.findMany({
        where: {
          developerId,
          timestamp: { gte: thirtyDaysAgo, lte: period }
        }
      }),
      prisma.communication.findMany({
        where: {
          participantIds: { has: developerId },
          timestamp: { gte: thirtyDaysAgo, lte: period }
        }
      })
    ]);

    const latestSurvey = surveys[0] || {};
    
    return {
      satisfaction: {
        tooling: latestSurvey.toolingSatisfaction || 3,
        workEnvironment: latestSurvey.environmentSatisfaction || 3,
        culture: latestSurvey.cultureSatisfaction || 3,
        autonomy: latestSurvey.autonomySatisfaction || 3
      },
      performance: {
        velocity: this.calculateVelocity(activities),
        quality: this.calculateQuality(activities),
        impact: this.calculateImpact(activities)
      },
      activity: {
        commits: activities.filter(a => a.type === 'commit').length,
        pullRequests: activities.filter(a => a.type === 'pr').length,
        codeReviews: activities.filter(a => a.type === 'review').length,
        documentation: activities.filter(a => a.type === 'doc').length
      },
      communication: {
        meetings: communications.filter(c => c.type === 'meeting').length,
        messages: communications.filter(c => c.type === 'message').length,
        collaboration: this.calculateCollaborationScore(communications)
      },
      efficiency: {
        focusTime: this.calculateFocusTime(activities),
        contextSwitching: this.calculateContextSwitching(activities),
        waitTime: this.calculateWaitTime(activities)
      }
    };
  }

  private calculateVelocity(activities: any[]): number {
    const storyPoints = activities
      .filter(a => a.type === 'story' && a.completed)
      .reduce((sum, a) => sum + (a.points || 0), 0);
    return storyPoints / 30;
  }

  private calculateQuality(activities: any[]): number {
    const bugs = activities.filter(a => a.type === 'bug').length;
    const features = activities.filter(a => a.type === 'feature').length;
    return features > 0 ? 1 - (bugs / (bugs + features)) : 1;
  }

  private calculateImpact(activities: any[]): number {
    return activities
      .filter(a => a.impact)
      .reduce((sum, a) => sum + a.impact, 0) / activities.length || 0;
  }

  private calculateCollaborationScore(communications: any[]): number {
    const uniqueCollaborators = new Set(
      communications.flatMap(c => c.participantIds)
    ).size;
    return Math.min(uniqueCollaborators / 10, 1);
  }

  private calculateFocusTime(activities: any[]): number {
    const focusSessions = activities.filter(a => 
      a.type === 'focus' && a.duration > 30
    );
    return focusSessions.reduce((sum, s) => sum + s.duration, 0) / 60;
  }

  private calculateContextSwitching(activities: any[]): number {
    let switches = 0;
    for (let i = 1; i < activities.length; i++) {
      if (activities[i].projectId !== activities[i - 1].projectId) {
        switches++;
      }
    }
    return switches;
  }

  private calculateWaitTime(activities: any[]): number {
    const blockingActivities = activities.filter(a => a.blocked);
    return blockingActivities.reduce((sum, a) => sum + (a.waitTime || 0), 0) / 60;
  }

  private async calculateCodeQualityMetrics(
    developerId: string,
    teamId: string,
    period: Date
  ): Promise<any> {
    const thirtyDaysAgo = new Date(period.getTime() - 30 * 24 * 60 * 60 * 1000);

    const codeMetrics = await prisma.codeMetrics.findMany({
      where: {
        OR: [{ authorId: developerId }, { teamId }],
        timestamp: { gte: thirtyDaysAgo, lte: period }
      }
    });

    if (codeMetrics.length === 0) {
      return {
        complexity: 10,
        coverage: 80,
        techDebt: 5,
        duplication: 3
      };
    }

    return {
      complexity: codeMetrics.reduce((sum, m) => sum + m.complexity, 0) / codeMetrics.length,
      coverage: codeMetrics.reduce((sum, m) => sum + m.coverage, 0) / codeMetrics.length,
      techDebt: codeMetrics.reduce((sum, m) => sum + m.techDebt, 0) / codeMetrics.length,
      duplication: codeMetrics.reduce((sum, m) => sum + m.duplication, 0) / codeMetrics.length
    };
  }

  private async calculateCollaborationMetrics(
    developerId: string,
    teamId: string,
    period: Date
  ): Promise<any> {
    const thirtyDaysAgo = new Date(period.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [reviews, pairSessions, knowledge, mentoring] = await Promise.all([
      prisma.codeReview.count({
        where: {
          reviewerId: developerId,
          createdAt: { gte: thirtyDaysAgo, lte: period }
        }
      }),
      prisma.pairProgramming.count({
        where: {
          participantIds: { has: developerId },
          timestamp: { gte: thirtyDaysAgo, lte: period }
        }
      }),
      prisma.knowledgeSharing.count({
        where: {
          authorId: developerId,
          createdAt: { gte: thirtyDaysAgo, lte: period }
        }
      }),
      prisma.mentoring.count({
        where: {
          OR: [{ mentorId: developerId }, { menteeId: developerId }],
          startDate: { gte: thirtyDaysAgo, lte: period }
        }
      })
    ]);

    return {
      prReviews: reviews,
      pairProgramming: pairSessions,
      knowledgeSharing: knowledge,
      mentoring
    };
  }

  private async calculateFlowStateMetrics(
    developerId: string,
    teamId: string,
    period: Date
  ): Promise<any> {
    const thirtyDaysAgo = new Date(period.getTime() - 30 * 24 * 60 * 60 * 1000);

    const flowSessions = await prisma.flowState.findMany({
      where: {
        developerId,
        timestamp: { gte: thirtyDaysAgo, lte: period }
      }
    });

    if (flowSessions.length === 0) {
      return {
        deepWorkHours: 0,
        interruptions: 0,
        focusScore: 0
      };
    }

    const deepWorkHours = flowSessions
      .filter(s => s.quality === 'deep')
      .reduce((sum, s) => sum + s.duration, 0) / 60;

    const interruptions = flowSessions
      .reduce((sum, s) => sum + s.interruptions, 0);

    const focusScore = flowSessions
      .reduce((sum, s) => sum + s.score, 0) / flowSessions.length;

    return {
      deepWorkHours,
      interruptions,
      focusScore
    };
  }

  private calculateProductivityScore(metrics: any): number {
    const weights = {
      dora: 0.25,
      space: 0.25,
      codeQuality: 0.2,
      collaboration: 0.15,
      flowState: 0.15
    };

    const doraScore = this.scoreDORA(metrics.dora);
    const spaceScore = this.scoreSPACE(metrics.space);
    const qualityScore = this.scoreCodeQuality(metrics.codeQuality);
    const collaborationScore = this.scoreCollaboration(metrics.collaboration);
    const flowScore = this.scoreFlowState(metrics.flowState);

    return (
      doraScore * weights.dora +
      spaceScore * weights.space +
      qualityScore * weights.codeQuality +
      collaborationScore * weights.collaboration +
      flowScore * weights.flowState
    ) * 100;
  }

  private scoreDORA(dora: DORAMetrics): number {
    const benchmarks = this.benchmarks.get('dora');
    let score = 0;

    if (dora.deploymentFrequency >= benchmarks.elite.deploymentFrequency) score += 0.25;
    else if (dora.deploymentFrequency >= benchmarks.high.deploymentFrequency) score += 0.2;
    else if (dora.deploymentFrequency >= benchmarks.medium.deploymentFrequency) score += 0.15;
    else score += 0.1;

    if (dora.leadTimeForChanges <= benchmarks.elite.leadTimeForChanges) score += 0.25;
    else if (dora.leadTimeForChanges <= benchmarks.high.leadTimeForChanges) score += 0.2;
    else if (dora.leadTimeForChanges <= benchmarks.medium.leadTimeForChanges) score += 0.15;
    else score += 0.1;

    if (dora.meanTimeToRestore <= benchmarks.elite.meanTimeToRestore) score += 0.25;
    else if (dora.meanTimeToRestore <= benchmarks.high.meanTimeToRestore) score += 0.2;
    else if (dora.meanTimeToRestore <= benchmarks.medium.meanTimeToRestore) score += 0.15;
    else score += 0.1;

    if (dora.changeFailureRate <= benchmarks.elite.changeFailureRate) score += 0.25;
    else if (dora.changeFailureRate <= benchmarks.high.changeFailureRate) score += 0.2;
    else if (dora.changeFailureRate <= benchmarks.medium.changeFailureRate) score += 0.15;
    else score += 0.1;

    return score;
  }

  private scoreSPACE(space: SPACEMetrics): number {
    const satisfactionScore = Object.values(space.satisfaction).reduce((a, b) => a + b, 0) / 20;
    const performanceScore = (space.performance.velocity / 10 + space.performance.quality + space.performance.impact) / 3;
    const activityScore = Math.min((space.activity.commits + space.activity.pullRequests + space.activity.codeReviews) / 90, 1);
    const communicationScore = Math.min(space.communication.collaboration, 1);
    const efficiencyScore = Math.max(0, 1 - (space.efficiency.contextSwitching / 20) - (space.efficiency.waitTime / 100));

    return (satisfactionScore + performanceScore + activityScore + communicationScore + efficiencyScore) / 5;
  }

  private scoreCodeQuality(quality: any): number {
    const complexityScore = Math.max(0, 1 - quality.complexity / 50);
    const coverageScore = quality.coverage / 100;
    const techDebtScore = Math.max(0, 1 - quality.techDebt / 20);
    const duplicationScore = Math.max(0, 1 - quality.duplication / 10);

    return (complexityScore + coverageScore + techDebtScore + duplicationScore) / 4;
  }

  private scoreCollaboration(collaboration: any): number {
    const reviewScore = Math.min(collaboration.prReviews / 20, 1);
    const pairScore = Math.min(collaboration.pairProgramming / 10, 1);
    const knowledgeScore = Math.min(collaboration.knowledgeSharing / 5, 1);
    const mentoringScore = Math.min(collaboration.mentoring / 3, 1);

    return (reviewScore + pairScore + knowledgeScore + mentoringScore) / 4;
  }

  private scoreFlowState(flow: any): number {
    const deepWorkScore = Math.min(flow.deepWorkHours / 20, 1);
    const interruptionScore = Math.max(0, 1 - flow.interruptions / 20);
    const focusScore = flow.focusScore / 100;

    return (deepWorkScore + interruptionScore + focusScore) / 3;
  }

  private async calculatePercentile(score: number, teamId: string): Promise<number> {
    const teamScores = await prisma.productivityMetrics.findMany({
      where: { teamId },
      select: { score: true },
      orderBy: { score: 'asc' }
    });

    if (teamScores.length === 0) return 50;

    const position = teamScores.filter(s => s.score < score).length;
    return (position / teamScores.length) * 100;
  }

  private async persistMetrics(metrics: ProductivityMetrics) {
    await prisma.productivityMetrics.create({
      data: {
        developerId: metrics.developerId,
        teamId: metrics.teamId,
        period: metrics.period,
        dora: metrics.dora,
        space: metrics.space,
        codeQuality: metrics.codeQuality,
        collaboration: metrics.collaboration,
        flowState: metrics.flowState,
        score: metrics.score,
        percentile: metrics.percentile
      }
    });
  }

  async analyzeProductivityTrends(
    developerId: string,
    periods: number = 12
  ): Promise<{
    trend: 'improving' | 'stable' | 'declining';
    insights: ProductivityInsight[];
    predictions: any[];
  }> {
    const historicalMetrics = await this.getHistoricalMetrics(developerId, periods);
    
    if (historicalMetrics.length < 3) {
      return {
        trend: 'stable',
        insights: [],
        predictions: []
      };
    }

    const trend = this.analyzeTrend(historicalMetrics);
    const insights = await this.generateInsights(historicalMetrics);
    const predictions = await this.predictFutureTrends(historicalMetrics);

    return { trend, insights, predictions };
  }

  private async getHistoricalMetrics(
    developerId: string,
    periods: number
  ): Promise<ProductivityMetrics[]> {
    const metrics = await prisma.productivityMetrics.findMany({
      where: { developerId },
      orderBy: { period: 'desc' },
      take: periods
    });

    return metrics.map(m => ({
      ...m,
      dora: m.dora as DORAMetrics,
      space: m.space as SPACEMetrics,
      codeQuality: m.codeQuality as any,
      collaboration: m.collaboration as any,
      flowState: m.flowState as any
    }));
  }

  private analyzeTrend(metrics: ProductivityMetrics[]): 'improving' | 'stable' | 'declining' {
    const scores = metrics.map(m => m.score);
    const recentAvg = scores.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    const historicalAvg = scores.slice(3).reduce((a, b) => a + b, 0) / (scores.length - 3);

    const difference = ((recentAvg - historicalAvg) / historicalAvg) * 100;

    if (difference > 5) return 'improving';
    if (difference < -5) return 'declining';
    return 'stable';
  }

  private async generateInsights(metrics: ProductivityMetrics[]): Promise<ProductivityInsight[]> {
    const insights: ProductivityInsight[] = [];
    const latest = metrics[0];
    const previous = metrics[1];

    if (latest.dora.deploymentFrequency < previous.dora.deploymentFrequency * 0.5) {
      insights.push({
        id: `insight-${Date.now()}-1`,
        type: 'risk',
        severity: 'warning',
        title: 'Deployment Frequency Dropped',
        description: 'Your deployment frequency has decreased by more than 50%',
        metrics: ['deploymentFrequency'],
        impact: 0.7,
        actions: [
          'Review CI/CD pipeline for bottlenecks',
          'Check for blocking issues in deployment process',
          'Consider smaller, more frequent deployments'
        ]
      });
    }

    if (latest.flowState.deepWorkHours > previous.flowState.deepWorkHours * 1.5) {
      insights.push({
        id: `insight-${Date.now()}-2`,
        type: 'achievement',
        severity: 'info',
        title: 'Improved Focus Time',
        description: 'Your deep work hours have increased by 50%',
        metrics: ['deepWorkHours'],
        impact: 0.8,
        actions: [
          'Continue protecting focus time',
          'Share your strategies with the team'
        ]
      });
    }

    if (latest.codeQuality.coverage < 70) {
      insights.push({
        id: `insight-${Date.now()}-3`,
        type: 'risk',
        severity: 'warning',
        title: 'Low Test Coverage',
        description: 'Code coverage is below recommended threshold',
        metrics: ['coverage'],
        impact: 0.6,
        actions: [
          'Add unit tests for uncovered code',
          'Set up coverage gates in CI/CD',
          'Schedule testing debt reduction'
        ]
      });
    }

    return insights;
  }

  private async predictFutureTrends(metrics: ProductivityMetrics[]): Promise<any[]> {
    if (!this.model || metrics.length < 7) {
      return [];
    }

    const features = metrics.map(m => this.extractFeatures(m));
    const predictions = [];

    for (let i = 0; i < 3; i++) {
      const input = tf.tensor2d([features[0]]);
      const prediction = this.model.predict(input) as tf.Tensor;
      const value = (await prediction.array())[0][0];
      
      predictions.push({
        period: i + 1,
        predictedScore: value * 100,
        confidence: 0.75 - (i * 0.1)
      });

      input.dispose();
      prediction.dispose();
    }

    return predictions;
  }

  private extractFeatures(metrics: ProductivityMetrics): number[] {
    return [
      metrics.dora.deploymentFrequency,
      metrics.dora.leadTimeForChanges,
      metrics.dora.meanTimeToRestore,
      metrics.dora.changeFailureRate,
      ...Object.values(metrics.space.satisfaction),
      ...Object.values(metrics.space.performance),
      ...Object.values(metrics.space.activity),
      metrics.space.communication.collaboration,
      ...Object.values(metrics.space.efficiency),
      ...Object.values(metrics.codeQuality),
      ...Object.values(metrics.collaboration),
      ...Object.values(metrics.flowState),
      metrics.score,
      metrics.percentile,
      ...Array(10).fill(0)
    ];
  }

  async compareTeamProductivity(teamIds: string[]): Promise<any> {
    const teamMetrics = await Promise.all(
      teamIds.map(teamId => this.getTeamAverageMetrics(teamId))
    );

    return {
      teams: teamMetrics,
      rankings: this.rankTeams(teamMetrics),
      insights: this.generateTeamInsights(teamMetrics)
    };
  }

  private async getTeamAverageMetrics(teamId: string): Promise<any> {
    const metrics = await prisma.productivityMetrics.findMany({
      where: { teamId },
      orderBy: { period: 'desc' },
      take: 30
    });

    if (metrics.length === 0) {
      return { teamId, score: 0, metrics: {} };
    }

    const avgScore = metrics.reduce((sum, m) => sum + m.score, 0) / metrics.length;
    
    return {
      teamId,
      score: avgScore,
      metrics: {
        dora: this.averageDORA(metrics.map(m => m.dora as DORAMetrics)),
        teamSize: await prisma.user.count({ where: { teamId } })
      }
    };
  }

  private averageDORA(doraMetrics: DORAMetrics[]): DORAMetrics {
    const count = doraMetrics.length;
    return {
      deploymentFrequency: doraMetrics.reduce((sum, d) => sum + d.deploymentFrequency, 0) / count,
      leadTimeForChanges: doraMetrics.reduce((sum, d) => sum + d.leadTimeForChanges, 0) / count,
      meanTimeToRestore: doraMetrics.reduce((sum, d) => sum + d.meanTimeToRestore, 0) / count,
      changeFailureRate: doraMetrics.reduce((sum, d) => sum + d.changeFailureRate, 0) / count,
      timestamp: new Date()
    };
  }

  private rankTeams(teamMetrics: any[]): any[] {
    return teamMetrics
      .sort((a, b) => b.score - a.score)
      .map((team, index) => ({
        ...team,
        rank: index + 1
      }));
  }

  private generateTeamInsights(teamMetrics: any[]): any[] {
    const insights = [];
    const avgScore = teamMetrics.reduce((sum, t) => sum + t.score, 0) / teamMetrics.length;

    for (const team of teamMetrics) {
      if (team.score > avgScore * 1.2) {
        insights.push({
          teamId: team.teamId,
          type: 'high-performer',
          message: 'Team is performing above average'
        });
      } else if (team.score < avgScore * 0.8) {
        insights.push({
          teamId: team.teamId,
          type: 'needs-support',
          message: 'Team may benefit from additional support'
        });
      }
    }

    return insights;
  }

  async createCustomKPI(kpi: {
    name: string;
    formula: string;
    target: number;
    unit: string;
  }): Promise<void> {
    this.customKPIs.set(kpi.name, kpi);
    await prisma.customKPI.create({ data: kpi });
  }

  async trackCustomKPI(name: string, value: number): Promise<void> {
    const kpi = this.customKPIs.get(name);
    if (!kpi) throw new Error(`KPI ${name} not found`);

    await prisma.kpiTracking.create({
      data: {
        name,
        value,
        target: kpi.target,
        timestamp: new Date()
      }
    });

    this.emit('kpi-tracked', { name, value, target: kpi.target });
  }
}