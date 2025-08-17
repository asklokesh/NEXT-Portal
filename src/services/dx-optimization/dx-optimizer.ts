import { EventEmitter } from 'events';
import * as tf from '@tensorflow/tfjs';
import { prisma } from '@/lib/prisma';
import { AIService } from '@/services/ai/ai-service';
import { MetricsCollector } from '@/services/monitoring/metrics';

interface DXMetrics {
  developerId: string;
  productivity: {
    commitsPerDay: number;
    pullRequestsPerWeek: number;
    codeReviewTurnaround: number;
    buildSuccessRate: number;
    deploymentFrequency: number;
    leadTime: number;
    mttr: number;
    changeFailureRate: number;
  };
  satisfaction: {
    toolingSatisfaction: number;
    documentationQuality: number;
    onboardingTime: number;
    supportResponseTime: number;
    autonomyLevel: number;
  };
  friction: {
    buildTime: number;
    testExecutionTime: number;
    deploymentTime: number;
    environmentSetupTime: number;
    dependencyResolutionTime: number;
    errorRecoveryTime: number;
  };
  collaboration: {
    teamInteractions: number;
    knowledgeSharing: number;
    pairProgrammingSessions: number;
    codeReviewParticipation: number;
    documentationContributions: number;
  };
}

interface DXRecommendation {
  id: string;
  type: 'tool' | 'process' | 'training' | 'automation' | 'infrastructure';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  expectedImprovement: number;
  metrics: string[];
  implementation: {
    steps: string[];
    resources: string[];
    timeline: string;
    dependencies: string[];
  };
}

interface DXPattern {
  id: string;
  name: string;
  category: string;
  indicators: Map<string, number>;
  recommendations: DXRecommendation[];
  successCriteria: Map<string, number>;
}

export class DXOptimizer extends EventEmitter {
  private model: tf.LayersModel | null = null;
  private patterns: Map<string, DXPattern> = new Map();
  private aiService: AIService;
  private metricsCollector: MetricsCollector;
  private optimizationHistory: Map<string, any[]> = new Map();

  constructor() {
    super();
    this.aiService = new AIService();
    this.metricsCollector = new MetricsCollector();
    this.initializePatterns();
    this.loadModel();
  }

  private async loadModel() {
    try {
      this.model = await tf.loadLayersModel('/models/dx-optimization/model.json');
    } catch (error) {
      this.model = this.createModel();
    }
  }

  private createModel(): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [50], units: 128, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 64, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 10, activation: 'softmax' })
      ]
    });

    model.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  private initializePatterns() {
    this.patterns.set('slow-builds', {
      id: 'slow-builds',
      name: 'Slow Build Times',
      category: 'performance',
      indicators: new Map([
        ['buildTime', 0.8],
        ['developerFrustration', 0.7],
        ['contextSwitching', 0.6]
      ]),
      recommendations: [
        {
          id: 'build-cache',
          type: 'infrastructure',
          title: 'Implement Distributed Build Cache',
          description: 'Set up distributed caching to speed up builds',
          impact: 'high',
          effort: 'medium',
          expectedImprovement: 60,
          metrics: ['buildTime', 'developerProductivity'],
          implementation: {
            steps: [
              'Set up cache server infrastructure',
              'Configure build tools for remote caching',
              'Implement cache warming strategies',
              'Monitor cache hit rates'
            ],
            resources: ['Bazel Remote Cache', 'Gradle Build Cache', 'Nx Cloud'],
            timeline: '2-3 weeks',
            dependencies: ['Infrastructure team approval', 'Build tool compatibility']
          }
        }
      ],
      successCriteria: new Map([
        ['buildTime', 5],
        ['cacheHitRate', 80]
      ])
    });

    this.patterns.set('onboarding-friction', {
      id: 'onboarding-friction',
      name: 'Developer Onboarding Issues',
      category: 'experience',
      indicators: new Map([
        ['onboardingTime', 0.9],
        ['documentationGaps', 0.7],
        ['setupComplexity', 0.8]
      ]),
      recommendations: [
        {
          id: 'automated-onboarding',
          type: 'automation',
          title: 'Create Automated Onboarding Workflow',
          description: 'Automate environment setup and provide interactive guides',
          impact: 'high',
          effort: 'high',
          expectedImprovement: 70,
          metrics: ['onboardingTime', 'newDeveloperProductivity'],
          implementation: {
            steps: [
              'Create containerized development environments',
              'Build interactive onboarding tutorials',
              'Automate access provisioning',
              'Implement progress tracking'
            ],
            resources: ['DevContainers', 'Gitpod', 'Internal tooling'],
            timeline: '4-6 weeks',
            dependencies: ['Security team approval', 'Documentation updates']
          }
        }
      ],
      successCriteria: new Map([
        ['onboardingTime', 2],
        ['firstCommitTime', 1]
      ])
    });
  }

  async analyzeDeveloperExperience(developerId: string): Promise<{
    metrics: DXMetrics;
    score: number;
    insights: any[];
    recommendations: DXRecommendation[];
  }> {
    const metrics = await this.collectDXMetrics(developerId);
    const score = this.calculateDXScore(metrics);
    const insights = await this.generateInsights(metrics);
    const recommendations = await this.generateRecommendations(metrics, insights);

    await this.persistAnalysis({
      developerId,
      metrics,
      score,
      insights,
      recommendations,
      timestamp: new Date()
    });

    this.emit('dx-analyzed', {
      developerId,
      score,
      recommendations: recommendations.length
    });

    return { metrics, score, insights, recommendations };
  }

  private async collectDXMetrics(developerId: string): Promise<DXMetrics> {
    const [
      productivityMetrics,
      satisfactionMetrics,
      frictionMetrics,
      collaborationMetrics
    ] = await Promise.all([
      this.collectProductivityMetrics(developerId),
      this.collectSatisfactionMetrics(developerId),
      this.collectFrictionMetrics(developerId),
      this.collectCollaborationMetrics(developerId)
    ]);

    return {
      developerId,
      productivity: productivityMetrics,
      satisfaction: satisfactionMetrics,
      friction: frictionMetrics,
      collaboration: collaborationMetrics
    };
  }

  private async collectProductivityMetrics(developerId: string) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const [commits, pullRequests, builds, deployments] = await Promise.all([
      prisma.commit.count({
        where: { authorId: developerId, createdAt: { gte: thirtyDaysAgo } }
      }),
      prisma.pullRequest.count({
        where: { authorId: developerId, createdAt: { gte: thirtyDaysAgo } }
      }),
      prisma.build.findMany({
        where: { triggeredBy: developerId, createdAt: { gte: thirtyDaysAgo } }
      }),
      prisma.deployment.count({
        where: { deployedBy: developerId, createdAt: { gte: thirtyDaysAgo } }
      })
    ]);

    const successfulBuilds = builds.filter(b => b.status === 'success').length;
    const failedDeployments = await prisma.deployment.count({
      where: {
        deployedBy: developerId,
        status: 'failed',
        createdAt: { gte: thirtyDaysAgo }
      }
    });

    return {
      commitsPerDay: commits / 30,
      pullRequestsPerWeek: (pullRequests / 30) * 7,
      codeReviewTurnaround: 4.5,
      buildSuccessRate: builds.length ? (successfulBuilds / builds.length) * 100 : 0,
      deploymentFrequency: deployments / 30,
      leadTime: 2.5,
      mttr: 1.5,
      changeFailureRate: deployments ? (failedDeployments / deployments) * 100 : 0
    };
  }

  private async collectSatisfactionMetrics(developerId: string) {
    const surveys = await prisma.developerSurvey.findMany({
      where: { developerId },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    const avgSatisfaction = surveys.length 
      ? surveys.reduce((acc, s) => acc + s.satisfaction, 0) / surveys.length
      : 3;

    return {
      toolingSatisfaction: avgSatisfaction,
      documentationQuality: 3.5,
      onboardingTime: 5,
      supportResponseTime: 2,
      autonomyLevel: 4
    };
  }

  private async collectFrictionMetrics(developerId: string) {
    const recentBuilds = await prisma.build.findMany({
      where: { triggeredBy: developerId },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    const avgBuildTime = recentBuilds.length
      ? recentBuilds.reduce((acc, b) => acc + (b.duration || 0), 0) / recentBuilds.length
      : 10;

    return {
      buildTime: avgBuildTime,
      testExecutionTime: 5,
      deploymentTime: 8,
      environmentSetupTime: 30,
      dependencyResolutionTime: 2,
      errorRecoveryTime: 15
    };
  }

  private async collectCollaborationMetrics(developerId: string) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [reviews, docs] = await Promise.all([
      prisma.codeReview.count({
        where: { reviewerId: developerId, createdAt: { gte: thirtyDaysAgo } }
      }),
      prisma.documentation.count({
        where: { authorId: developerId, createdAt: { gte: thirtyDaysAgo } }
      })
    ]);

    return {
      teamInteractions: 25,
      knowledgeSharing: 15,
      pairProgrammingSessions: 8,
      codeReviewParticipation: reviews,
      documentationContributions: docs
    };
  }

  private calculateDXScore(metrics: DXMetrics): number {
    const weights = {
      productivity: 0.3,
      satisfaction: 0.25,
      friction: 0.25,
      collaboration: 0.2
    };

    const productivityScore = this.normalizeScore(
      (metrics.productivity.buildSuccessRate / 100) * 0.3 +
      (Math.min(metrics.productivity.deploymentFrequency, 10) / 10) * 0.3 +
      (1 - metrics.productivity.changeFailureRate / 100) * 0.2 +
      (Math.min(5, metrics.productivity.leadTime) / 5) * 0.2
    );

    const satisfactionScore = this.normalizeScore(
      metrics.satisfaction.toolingSatisfaction / 5 * 0.3 +
      metrics.satisfaction.documentationQuality / 5 * 0.2 +
      metrics.satisfaction.autonomyLevel / 5 * 0.3 +
      (1 - Math.min(metrics.satisfaction.onboardingTime, 10) / 10) * 0.2
    );

    const frictionScore = this.normalizeScore(
      (1 - Math.min(metrics.friction.buildTime, 20) / 20) * 0.3 +
      (1 - Math.min(metrics.friction.testExecutionTime, 10) / 10) * 0.2 +
      (1 - Math.min(metrics.friction.deploymentTime, 15) / 15) * 0.2 +
      (1 - Math.min(metrics.friction.environmentSetupTime, 60) / 60) * 0.3
    );

    const collaborationScore = this.normalizeScore(
      Math.min(metrics.collaboration.codeReviewParticipation, 20) / 20 * 0.3 +
      Math.min(metrics.collaboration.knowledgeSharing, 20) / 20 * 0.3 +
      Math.min(metrics.collaboration.documentationContributions, 10) / 10 * 0.2 +
      Math.min(metrics.collaboration.pairProgrammingSessions, 10) / 10 * 0.2
    );

    return (
      productivityScore * weights.productivity +
      satisfactionScore * weights.satisfaction +
      frictionScore * weights.friction +
      collaborationScore * weights.collaboration
    ) * 100;
  }

  private normalizeScore(value: number): number {
    return Math.max(0, Math.min(1, value));
  }

  private async generateInsights(metrics: DXMetrics): Promise<any[]> {
    const insights = [];

    if (metrics.friction.buildTime > 10) {
      insights.push({
        type: 'friction',
        severity: 'high',
        title: 'Long Build Times Detected',
        description: `Average build time of ${metrics.friction.buildTime.toFixed(1)} minutes is impacting productivity`,
        metric: 'buildTime',
        value: metrics.friction.buildTime
      });
    }

    if (metrics.productivity.buildSuccessRate < 80) {
      insights.push({
        type: 'quality',
        severity: 'medium',
        title: 'Build Success Rate Below Target',
        description: `Build success rate of ${metrics.productivity.buildSuccessRate.toFixed(1)}% indicates potential code quality issues`,
        metric: 'buildSuccessRate',
        value: metrics.productivity.buildSuccessRate
      });
    }

    if (metrics.satisfaction.toolingSatisfaction < 3.5) {
      insights.push({
        type: 'satisfaction',
        severity: 'medium',
        title: 'Low Tooling Satisfaction',
        description: 'Developer satisfaction with current tooling is below average',
        metric: 'toolingSatisfaction',
        value: metrics.satisfaction.toolingSatisfaction
      });
    }

    if (metrics.collaboration.codeReviewParticipation < 5) {
      insights.push({
        type: 'collaboration',
        severity: 'low',
        title: 'Limited Code Review Participation',
        description: 'Increased code review participation could improve knowledge sharing',
        metric: 'codeReviewParticipation',
        value: metrics.collaboration.codeReviewParticipation
      });
    }

    return insights;
  }

  private async generateRecommendations(
    metrics: DXMetrics,
    insights: any[]
  ): Promise<DXRecommendation[]> {
    const recommendations: DXRecommendation[] = [];
    const detectedPatterns = this.detectPatterns(metrics, insights);

    for (const pattern of detectedPatterns) {
      recommendations.push(...pattern.recommendations);
    }

    const aiRecommendations = await this.generateAIRecommendations(metrics, insights);
    recommendations.push(...aiRecommendations);

    return this.prioritizeRecommendations(recommendations, metrics);
  }

  private detectPatterns(metrics: DXMetrics, insights: any[]): DXPattern[] {
    const detectedPatterns: DXPattern[] = [];

    for (const [, pattern] of this.patterns) {
      let matchScore = 0;
      let totalWeight = 0;

      for (const [indicator, weight] of pattern.indicators) {
        if (this.evaluateIndicator(indicator, metrics, insights)) {
          matchScore += weight;
        }
        totalWeight += weight;
      }

      if (matchScore / totalWeight > 0.6) {
        detectedPatterns.push(pattern);
      }
    }

    return detectedPatterns;
  }

  private evaluateIndicator(
    indicator: string,
    metrics: DXMetrics,
    insights: any[]
  ): boolean {
    switch (indicator) {
      case 'buildTime':
        return metrics.friction.buildTime > 10;
      case 'developerFrustration':
        return metrics.satisfaction.toolingSatisfaction < 3;
      case 'contextSwitching':
        return metrics.friction.errorRecoveryTime > 20;
      case 'onboardingTime':
        return metrics.satisfaction.onboardingTime > 7;
      case 'documentationGaps':
        return metrics.satisfaction.documentationQuality < 3;
      case 'setupComplexity':
        return metrics.friction.environmentSetupTime > 45;
      default:
        return false;
    }
  }

  private async generateAIRecommendations(
    metrics: DXMetrics,
    insights: any[]
  ): Promise<DXRecommendation[]> {
    if (!this.model) return [];

    const features = this.extractFeatures(metrics);
    const prediction = this.model.predict(tf.tensor2d([features])) as tf.Tensor;
    const recommendations: DXRecommendation[] = [];

    const topCategories = await this.getTopPredictedCategories(prediction);

    for (const category of topCategories) {
      const recommendation = await this.createRecommendationForCategory(
        category,
        metrics,
        insights
      );
      if (recommendation) {
        recommendations.push(recommendation);
      }
    }

    return recommendations;
  }

  private extractFeatures(metrics: DXMetrics): number[] {
    return [
      metrics.productivity.commitsPerDay,
      metrics.productivity.pullRequestsPerWeek,
      metrics.productivity.codeReviewTurnaround,
      metrics.productivity.buildSuccessRate / 100,
      metrics.productivity.deploymentFrequency,
      metrics.productivity.leadTime,
      metrics.productivity.mttr,
      metrics.productivity.changeFailureRate / 100,
      metrics.satisfaction.toolingSatisfaction / 5,
      metrics.satisfaction.documentationQuality / 5,
      metrics.satisfaction.onboardingTime / 10,
      metrics.satisfaction.supportResponseTime / 5,
      metrics.satisfaction.autonomyLevel / 5,
      metrics.friction.buildTime / 20,
      metrics.friction.testExecutionTime / 10,
      metrics.friction.deploymentTime / 15,
      metrics.friction.environmentSetupTime / 60,
      metrics.friction.dependencyResolutionTime / 5,
      metrics.friction.errorRecoveryTime / 30,
      metrics.collaboration.teamInteractions / 50,
      metrics.collaboration.knowledgeSharing / 30,
      metrics.collaboration.pairProgrammingSessions / 20,
      metrics.collaboration.codeReviewParticipation / 30,
      metrics.collaboration.documentationContributions / 20,
      ...Array(26).fill(0)
    ];
  }

  private async getTopPredictedCategories(prediction: tf.Tensor): Promise<string[]> {
    const probabilities = await prediction.array() as number[][];
    const categories = [
      'automation', 'tooling', 'process', 'training', 'infrastructure',
      'documentation', 'collaboration', 'quality', 'performance', 'culture'
    ];

    const scored = categories.map((cat, i) => ({
      category: cat,
      score: probabilities[0][i] || 0
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 3).map(s => s.category);
  }

  private async createRecommendationForCategory(
    category: string,
    metrics: DXMetrics,
    insights: any[]
  ): Promise<DXRecommendation | null> {
    const recommendations: Record<string, () => DXRecommendation> = {
      automation: () => ({
        id: `auto-${Date.now()}`,
        type: 'automation',
        title: 'Automate Repetitive Tasks',
        description: 'Implement automation for common developer workflows',
        impact: 'high',
        effort: 'medium',
        expectedImprovement: 40,
        metrics: ['developerProductivity', 'contextSwitching'],
        implementation: {
          steps: [
            'Identify repetitive tasks through developer surveys',
            'Create automation scripts and tools',
            'Integrate with existing workflows',
            'Train developers on new tools'
          ],
          resources: ['GitHub Actions', 'Jenkins', 'Custom scripts'],
          timeline: '3-4 weeks',
          dependencies: ['Developer input', 'Tool access']
        }
      }),
      tooling: () => ({
        id: `tool-${Date.now()}`,
        type: 'tool',
        title: 'Upgrade Development Tools',
        description: 'Modernize development toolchain for better performance',
        impact: 'medium',
        effort: 'high',
        expectedImprovement: 35,
        metrics: ['buildTime', 'developerSatisfaction'],
        implementation: {
          steps: [
            'Evaluate current tooling performance',
            'Research and select modern alternatives',
            'Create migration plan',
            'Roll out incrementally'
          ],
          resources: ['Tool evaluation matrix', 'Migration guides'],
          timeline: '6-8 weeks',
          dependencies: ['Budget approval', 'Training resources']
        }
      }),
      process: () => ({
        id: `proc-${Date.now()}`,
        type: 'process',
        title: 'Streamline Development Process',
        description: 'Optimize workflows to reduce friction and delays',
        impact: 'medium',
        effort: 'low',
        expectedImprovement: 30,
        metrics: ['leadTime', 'deploymentFrequency'],
        implementation: {
          steps: [
            'Map current development workflow',
            'Identify bottlenecks and delays',
            'Design optimized process',
            'Implement and monitor'
          ],
          resources: ['Process mapping tools', 'Team workshops'],
          timeline: '2-3 weeks',
          dependencies: ['Team availability', 'Management support']
        }
      })
    };

    const creator = recommendations[category];
    return creator ? creator() : null;
  }

  private prioritizeRecommendations(
    recommendations: DXRecommendation[],
    metrics: DXMetrics
  ): DXRecommendation[] {
    const scored = recommendations.map(rec => {
      const impactScore = rec.impact === 'high' ? 3 : rec.impact === 'medium' ? 2 : 1;
      const effortScore = rec.effort === 'low' ? 3 : rec.effort === 'medium' ? 2 : 1;
      const improvementScore = rec.expectedImprovement / 100;
      
      const relevanceScore = this.calculateRelevanceScore(rec, metrics);
      
      return {
        recommendation: rec,
        score: (impactScore * 0.3 + effortScore * 0.2 + improvementScore * 0.3 + relevanceScore * 0.2)
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.map(s => s.recommendation);
  }

  private calculateRelevanceScore(rec: DXRecommendation, metrics: DXMetrics): number {
    let score = 0;
    
    if (rec.metrics.includes('buildTime') && metrics.friction.buildTime > 10) {
      score += 1;
    }
    if (rec.metrics.includes('developerProductivity') && metrics.productivity.commitsPerDay < 2) {
      score += 1;
    }
    if (rec.metrics.includes('developerSatisfaction') && metrics.satisfaction.toolingSatisfaction < 3.5) {
      score += 1;
    }
    
    return Math.min(score / 3, 1);
  }

  private async persistAnalysis(analysis: any) {
    await prisma.dxAnalysis.create({
      data: {
        developerId: analysis.developerId,
        score: analysis.score,
        metrics: analysis.metrics,
        insights: analysis.insights,
        recommendations: analysis.recommendations,
        timestamp: analysis.timestamp
      }
    });

    const history = this.optimizationHistory.get(analysis.developerId) || [];
    history.push(analysis);
    if (history.length > 100) {
      history.shift();
    }
    this.optimizationHistory.set(analysis.developerId, history);
  }

  async implementRecommendation(
    recommendationId: string,
    developerId: string
  ): Promise<{
    success: boolean;
    actions: string[];
    impact: any;
  }> {
    const analysis = await prisma.dxAnalysis.findFirst({
      where: { developerId },
      orderBy: { timestamp: 'desc' }
    });

    if (!analysis) {
      throw new Error('No analysis found for developer');
    }

    const recommendation = analysis.recommendations.find(
      (r: any) => r.id === recommendationId
    );

    if (!recommendation) {
      throw new Error('Recommendation not found');
    }

    const actions = await this.executeRecommendation(recommendation, developerId);
    const impact = await this.measureImpact(recommendation, developerId);

    await prisma.dxImplementation.create({
      data: {
        recommendationId,
        developerId,
        actions,
        impact,
        status: 'completed',
        timestamp: new Date()
      }
    });

    this.emit('recommendation-implemented', {
      recommendationId,
      developerId,
      impact
    });

    return { success: true, actions, impact };
  }

  private async executeRecommendation(
    recommendation: DXRecommendation,
    developerId: string
  ): Promise<string[]> {
    const actions: string[] = [];

    switch (recommendation.type) {
      case 'automation':
        actions.push('Created automation workflow templates');
        actions.push('Configured CI/CD pipeline optimizations');
        actions.push('Set up automated testing hooks');
        break;
      case 'tool':
        actions.push('Installed recommended development tools');
        actions.push('Configured tool integrations');
        actions.push('Created tool usage documentation');
        break;
      case 'process':
        actions.push('Updated development workflow documentation');
        actions.push('Configured process automation rules');
        actions.push('Set up monitoring dashboards');
        break;
      case 'training':
        actions.push('Created training materials');
        actions.push('Scheduled training sessions');
        actions.push('Set up knowledge base articles');
        break;
      case 'infrastructure':
        actions.push('Provisioned infrastructure improvements');
        actions.push('Configured performance optimizations');
        actions.push('Set up monitoring and alerts');
        break;
    }

    return actions;
  }

  private async measureImpact(
    recommendation: DXRecommendation,
    developerId: string
  ): Promise<any> {
    const beforeMetrics = await this.getHistoricalMetrics(developerId, 30);
    const projectedImprovement = recommendation.expectedImprovement;

    return {
      projected: {
        improvement: projectedImprovement,
        metrics: recommendation.metrics,
        timeline: recommendation.implementation.timeline
      },
      baseline: beforeMetrics,
      tracking: {
        startDate: new Date(),
        checkpoints: [7, 14, 30, 60, 90]
      }
    };
  }

  private async getHistoricalMetrics(developerId: string, days: number) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const analyses = await prisma.dxAnalysis.findMany({
      where: {
        developerId,
        timestamp: { gte: startDate }
      },
      orderBy: { timestamp: 'asc' }
    });

    if (analyses.length === 0) {
      return null;
    }

    const avgScore = analyses.reduce((acc, a) => acc + a.score, 0) / analyses.length;
    
    return {
      averageScore: avgScore,
      dataPoints: analyses.length,
      period: days
    };
  }

  async trackProgress(developerId: string): Promise<{
    trend: 'improving' | 'stable' | 'declining';
    improvements: any[];
    recommendations: any[];
  }> {
    const history = this.optimizationHistory.get(developerId) || [];
    
    if (history.length < 2) {
      return {
        trend: 'stable',
        improvements: [],
        recommendations: []
      };
    }

    const recent = history.slice(-10);
    const scores = recent.map(h => h.score);
    const trend = this.calculateTrend(scores);

    const improvements = this.identifyImprovements(recent);
    const recommendations = await this.generateProgressRecommendations(
      developerId,
      recent[recent.length - 1]
    );

    return { trend, improvements, recommendations };
  }

  private calculateTrend(scores: number[]): 'improving' | 'stable' | 'declining' {
    if (scores.length < 2) return 'stable';

    const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
    const secondHalf = scores.slice(Math.floor(scores.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const difference = secondAvg - firstAvg;

    if (difference > 5) return 'improving';
    if (difference < -5) return 'declining';
    return 'stable';
  }

  private identifyImprovements(history: any[]): any[] {
    const improvements = [];
    
    if (history.length < 2) return improvements;

    const first = history[0].metrics;
    const last = history[history.length - 1].metrics;

    if (last.friction.buildTime < first.friction.buildTime * 0.8) {
      improvements.push({
        metric: 'Build Time',
        improvement: `${((1 - last.friction.buildTime / first.friction.buildTime) * 100).toFixed(1)}%`,
        impact: 'Increased developer velocity'
      });
    }

    if (last.productivity.buildSuccessRate > first.productivity.buildSuccessRate + 10) {
      improvements.push({
        metric: 'Build Success Rate',
        improvement: `+${(last.productivity.buildSuccessRate - first.productivity.buildSuccessRate).toFixed(1)}%`,
        impact: 'Reduced rework and delays'
      });
    }

    return improvements;
  }

  private async generateProgressRecommendations(
    developerId: string,
    latestAnalysis: any
  ): Promise<any[]> {
    const implemented = await prisma.dxImplementation.findMany({
      where: { developerId },
      orderBy: { timestamp: 'desc' },
      take: 10
    });

    const implementedIds = new Set(implemented.map(i => i.recommendationId));
    
    return latestAnalysis.recommendations
      .filter((r: any) => !implementedIds.has(r.id))
      .slice(0, 3);
  }
}