import { EventEmitter } from 'events';
import * as tf from '@tensorflow/tfjs';
import { prisma } from '@/lib/prisma';

interface Pattern {
  id: string;
  type: 'productivity' | 'quality' | 'collaboration' | 'performance' | 'burnout';
  name: string;
  indicators: Map<string, number>;
  confidence: number;
  timeframe: { start: Date; end: Date };
}

interface Insight {
  id: string;
  type: 'bottleneck' | 'achievement' | 'risk' | 'opportunity' | 'trend';
  category: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  impact: {
    scope: 'individual' | 'team' | 'organization';
    magnitude: number;
    affectedMetrics: string[];
  };
  evidence: {
    metrics: Map<string, number>;
    patterns: Pattern[];
    confidence: number;
  };
  recommendations: Recommendation[];
  createdAt: Date;
}

interface Recommendation {
  id: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  expectedImpact: number;
  effort: 'low' | 'medium' | 'high';
  timeToValue: number;
  actions: string[];
  resources: string[];
}

interface TeamDynamics {
  teamId: string;
  cohesion: number;
  collaboration: number;
  communication: number;
  alignment: number;
  morale: number;
  velocity: number;
  quality: number;
}

interface BurnoutIndicators {
  developerId: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  indicators: {
    workingHours: number;
    weekendWork: number;
    vacationDays: number;
    contextSwitching: number;
    meetingLoad: number;
    focusTime: number;
    stressSignals: number;
  };
  trend: 'improving' | 'stable' | 'worsening';
  recommendations: string[];
}

export class InsightsGenerator extends EventEmitter {
  private patternModel: tf.LayersModel | null = null;
  private predictionModel: tf.LayersModel | null = null;
  private insights: Map<string, Insight> = new Map();
  private patterns: Map<string, Pattern> = new Map();
  private historicalData: Map<string, any[]> = new Map();

  constructor() {
    super();
    this.loadModels();
  }

  private async loadModels() {
    try {
      this.patternModel = await tf.loadLayersModel('/models/pattern-recognition/model.json');
      this.predictionModel = await tf.loadLayersModel('/models/performance-prediction/model.json');
    } catch (error) {
      this.patternModel = this.createPatternModel();
      this.predictionModel = this.createPredictionModel();
    }
  }

  private createPatternModel(): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        tf.layers.conv1d({ 
          inputShape: [30, 10], 
          filters: 64, 
          kernelSize: 3, 
          activation: 'relu' 
        }),
        tf.layers.maxPooling1d({ poolSize: 2 }),
        tf.layers.conv1d({ filters: 32, kernelSize: 3, activation: 'relu' }),
        tf.layers.globalMaxPooling1d(),
        tf.layers.dense({ units: 128, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 5, activation: 'softmax' })
      ]
    });

    model.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  private createPredictionModel(): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        tf.layers.lstm({ 
          units: 128, 
          returnSequences: true, 
          inputShape: [14, 20] 
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.lstm({ units: 64, returnSequences: false }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 1 })
      ]
    });

    model.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError',
      metrics: ['mae']
    });

    return model;
  }

  async detectPatterns(
    data: any[],
    timeframe: { start: Date; end: Date }
  ): Promise<Pattern[]> {
    const detectedPatterns: Pattern[] = [];

    const productivityPattern = await this.detectProductivityPattern(data, timeframe);
    if (productivityPattern) detectedPatterns.push(productivityPattern);

    const qualityPattern = await this.detectQualityPattern(data, timeframe);
    if (qualityPattern) detectedPatterns.push(qualityPattern);

    const collaborationPattern = await this.detectCollaborationPattern(data, timeframe);
    if (collaborationPattern) detectedPatterns.push(collaborationPattern);

    const performancePattern = await this.detectPerformancePattern(data, timeframe);
    if (performancePattern) detectedPatterns.push(performancePattern);

    const burnoutPattern = await this.detectBurnoutPattern(data, timeframe);
    if (burnoutPattern) detectedPatterns.push(burnoutPattern);

    detectedPatterns.forEach(pattern => {
      this.patterns.set(pattern.id, pattern);
    });

    this.emit('patterns-detected', detectedPatterns);
    return detectedPatterns;
  }

  private async detectProductivityPattern(
    data: any[],
    timeframe: { start: Date; end: Date }
  ): Promise<Pattern | null> {
    const indicators = new Map<string, number>();
    
    const commits = data.filter(d => d.type === 'commit').length;
    const prs = data.filter(d => d.type === 'pr').length;
    const deployments = data.filter(d => d.type === 'deployment').length;
    
    indicators.set('commit_frequency', commits / 30);
    indicators.set('pr_frequency', prs / 30);
    indicators.set('deployment_frequency', deployments / 30);

    const confidence = this.calculatePatternConfidence(indicators);

    if (confidence > 0.7) {
      return {
        id: `pattern-productivity-${Date.now()}`,
        type: 'productivity',
        name: 'High Productivity Period',
        indicators,
        confidence,
        timeframe
      };
    }

    return null;
  }

  private async detectQualityPattern(
    data: any[],
    timeframe: { start: Date; end: Date }
  ): Promise<Pattern | null> {
    const indicators = new Map<string, number>();
    
    const bugs = data.filter(d => d.type === 'bug').length;
    const tests = data.filter(d => d.type === 'test').length;
    const coverage = data.find(d => d.type === 'coverage')?.value || 0;
    
    indicators.set('bug_rate', bugs / 30);
    indicators.set('test_coverage', coverage);
    indicators.set('test_frequency', tests / 30);

    const confidence = this.calculatePatternConfidence(indicators);

    if (confidence > 0.6) {
      return {
        id: `pattern-quality-${Date.now()}`,
        type: 'quality',
        name: coverage > 80 ? 'High Quality Standards' : 'Quality Concerns',
        indicators,
        confidence,
        timeframe
      };
    }

    return null;
  }

  private async detectCollaborationPattern(
    data: any[],
    timeframe: { start: Date; end: Date }
  ): Promise<Pattern | null> {
    const indicators = new Map<string, number>();
    
    const reviews = data.filter(d => d.type === 'review').length;
    const comments = data.filter(d => d.type === 'comment').length;
    const meetings = data.filter(d => d.type === 'meeting').length;
    
    indicators.set('review_participation', reviews / 30);
    indicators.set('comment_frequency', comments / 30);
    indicators.set('meeting_load', meetings / 30);

    const confidence = this.calculatePatternConfidence(indicators);

    if (confidence > 0.65) {
      return {
        id: `pattern-collaboration-${Date.now()}`,
        type: 'collaboration',
        name: 'Active Collaboration',
        indicators,
        confidence,
        timeframe
      };
    }

    return null;
  }

  private async detectPerformancePattern(
    data: any[],
    timeframe: { start: Date; end: Date }
  ): Promise<Pattern | null> {
    const indicators = new Map<string, number>();
    
    const buildTimes = data.filter(d => d.type === 'build').map(d => d.duration);
    const deploymentTimes = data.filter(d => d.type === 'deployment').map(d => d.duration);
    const incidents = data.filter(d => d.type === 'incident').length;
    
    const avgBuildTime = buildTimes.length > 0 
      ? buildTimes.reduce((a, b) => a + b, 0) / buildTimes.length 
      : 0;
    
    indicators.set('avg_build_time', avgBuildTime);
    indicators.set('incident_rate', incidents / 30);
    indicators.set('deployment_success_rate', 0.95);

    const confidence = this.calculatePatternConfidence(indicators);

    if (confidence > 0.7) {
      return {
        id: `pattern-performance-${Date.now()}`,
        type: 'performance',
        name: avgBuildTime < 300 ? 'Optimal Performance' : 'Performance Degradation',
        indicators,
        confidence,
        timeframe
      };
    }

    return null;
  }

  private async detectBurnoutPattern(
    data: any[],
    timeframe: { start: Date; end: Date }
  ): Promise<Pattern | null> {
    const indicators = new Map<string, number>();
    
    const weekendWork = data.filter(d => {
      const date = new Date(d.timestamp);
      return date.getDay() === 0 || date.getDay() === 6;
    }).length;
    
    const lateNightWork = data.filter(d => {
      const hour = new Date(d.timestamp).getHours();
      return hour < 6 || hour > 22;
    }).length;
    
    indicators.set('weekend_work', weekendWork);
    indicators.set('late_night_work', lateNightWork);
    indicators.set('context_switches', data.filter(d => d.type === 'context_switch').length);

    const confidence = this.calculatePatternConfidence(indicators);

    if (weekendWork > 5 || lateNightWork > 10) {
      return {
        id: `pattern-burnout-${Date.now()}`,
        type: 'burnout',
        name: 'Burnout Risk Indicators',
        indicators,
        confidence: Math.min(confidence * 1.5, 1),
        timeframe
      };
    }

    return null;
  }

  private calculatePatternConfidence(indicators: Map<string, number>): number {
    const values = Array.from(indicators.values());
    const nonZeroValues = values.filter(v => v > 0);
    
    if (nonZeroValues.length === 0) return 0;
    
    const coverage = nonZeroValues.length / values.length;
    const strength = Math.min(...nonZeroValues) / Math.max(...nonZeroValues);
    
    return coverage * 0.6 + strength * 0.4;
  }

  async identifyBottlenecks(
    metrics: any[],
    threshold: number = 0.7
  ): Promise<Insight[]> {
    const bottlenecks: Insight[] = [];

    const deploymentBottleneck = this.analyzeDeploymentBottleneck(metrics);
    if (deploymentBottleneck) bottlenecks.push(deploymentBottleneck);

    const reviewBottleneck = this.analyzeReviewBottleneck(metrics);
    if (reviewBottleneck) bottlenecks.push(reviewBottleneck);

    const testingBottleneck = this.analyzeTestingBottleneck(metrics);
    if (testingBottleneck) bottlenecks.push(testingBottleneck);

    const buildBottleneck = this.analyzeBuildBottleneck(metrics);
    if (buildBottleneck) bottlenecks.push(buildBottleneck);

    bottlenecks.forEach(bottleneck => {
      this.insights.set(bottleneck.id, bottleneck);
    });

    await this.persistInsights(bottlenecks);
    this.emit('bottlenecks-identified', bottlenecks);

    return bottlenecks;
  }

  private analyzeDeploymentBottleneck(metrics: any[]): Insight | null {
    const deploymentMetrics = metrics.filter(m => m.category === 'deployment');
    const avgLeadTime = this.calculateAverage(deploymentMetrics.map(m => m.leadTime));

    if (avgLeadTime > 168) {
      return {
        id: `insight-bottleneck-deployment-${Date.now()}`,
        type: 'bottleneck',
        category: 'deployment',
        title: 'Deployment Pipeline Bottleneck',
        description: `Average lead time of ${avgLeadTime.toFixed(1)} hours exceeds target`,
        severity: avgLeadTime > 336 ? 'critical' : 'warning',
        impact: {
          scope: 'team',
          magnitude: 0.8,
          affectedMetrics: ['lead_time', 'deployment_frequency', 'velocity']
        },
        evidence: {
          metrics: new Map([['avg_lead_time', avgLeadTime]]),
          patterns: [],
          confidence: 0.85
        },
        recommendations: [
          {
            id: 'rec-1',
            priority: 'high',
            title: 'Optimize CI/CD Pipeline',
            description: 'Parallelize build and test stages',
            expectedImpact: 0.4,
            effort: 'medium',
            timeToValue: 14,
            actions: [
              'Analyze pipeline stages for optimization',
              'Implement parallel test execution',
              'Cache dependencies and build artifacts'
            ],
            resources: ['CI/CD documentation', 'DevOps team']
          }
        ],
        createdAt: new Date()
      };
    }

    return null;
  }

  private analyzeReviewBottleneck(metrics: any[]): Insight | null {
    const reviewMetrics = metrics.filter(m => m.category === 'review');
    const avgReviewTime = this.calculateAverage(reviewMetrics.map(m => m.reviewTime));

    if (avgReviewTime > 24) {
      return {
        id: `insight-bottleneck-review-${Date.now()}`,
        type: 'bottleneck',
        category: 'collaboration',
        title: 'Code Review Delays',
        description: `Reviews taking ${avgReviewTime.toFixed(1)} hours on average`,
        severity: avgReviewTime > 48 ? 'warning' : 'info',
        impact: {
          scope: 'team',
          magnitude: 0.6,
          affectedMetrics: ['lead_time', 'collaboration', 'velocity']
        },
        evidence: {
          metrics: new Map([['avg_review_time', avgReviewTime]]),
          patterns: [],
          confidence: 0.75
        },
        recommendations: [
          {
            id: 'rec-2',
            priority: 'medium',
            title: 'Improve Review Process',
            description: 'Establish review SLAs and automate checks',
            expectedImpact: 0.3,
            effort: 'low',
            timeToValue: 7,
            actions: [
              'Set up automated review reminders',
              'Implement review time SLAs',
              'Add more automated checks'
            ],
            resources: ['Review guidelines', 'Automation tools']
          }
        ],
        createdAt: new Date()
      };
    }

    return null;
  }

  private analyzeTestingBottleneck(metrics: any[]): Insight | null {
    const testMetrics = metrics.filter(m => m.category === 'testing');
    const avgTestTime = this.calculateAverage(testMetrics.map(m => m.duration));
    const testFailureRate = this.calculateAverage(testMetrics.map(m => m.failureRate));

    if (avgTestTime > 30 || testFailureRate > 0.1) {
      return {
        id: `insight-bottleneck-testing-${Date.now()}`,
        type: 'bottleneck',
        category: 'quality',
        title: 'Testing Inefficiencies',
        description: `Tests taking ${avgTestTime.toFixed(1)} minutes with ${(testFailureRate * 100).toFixed(1)}% failure rate`,
        severity: testFailureRate > 0.2 ? 'critical' : 'warning',
        impact: {
          scope: 'team',
          magnitude: 0.7,
          affectedMetrics: ['quality', 'velocity', 'confidence']
        },
        evidence: {
          metrics: new Map([
            ['avg_test_time', avgTestTime],
            ['test_failure_rate', testFailureRate]
          ]),
          patterns: [],
          confidence: 0.8
        },
        recommendations: [
          {
            id: 'rec-3',
            priority: 'high',
            title: 'Optimize Test Suite',
            description: 'Improve test performance and reliability',
            expectedImpact: 0.5,
            effort: 'medium',
            timeToValue: 21,
            actions: [
              'Identify and fix flaky tests',
              'Parallelize test execution',
              'Implement test categorization'
            ],
            resources: ['Testing framework docs', 'QA team']
          }
        ],
        createdAt: new Date()
      };
    }

    return null;
  }

  private analyzeBuildBottleneck(metrics: any[]): Insight | null {
    const buildMetrics = metrics.filter(m => m.category === 'build');
    const avgBuildTime = this.calculateAverage(buildMetrics.map(m => m.duration));

    if (avgBuildTime > 15) {
      return {
        id: `insight-bottleneck-build-${Date.now()}`,
        type: 'bottleneck',
        category: 'performance',
        title: 'Slow Build Times',
        description: `Average build time of ${avgBuildTime.toFixed(1)} minutes impacting productivity`,
        severity: avgBuildTime > 30 ? 'critical' : 'warning',
        impact: {
          scope: 'individual',
          magnitude: 0.6,
          affectedMetrics: ['productivity', 'focus_time', 'context_switching']
        },
        evidence: {
          metrics: new Map([['avg_build_time', avgBuildTime]]),
          patterns: [],
          confidence: 0.9
        },
        recommendations: [
          {
            id: 'rec-4',
            priority: 'high',
            title: 'Implement Build Caching',
            description: 'Set up distributed build cache',
            expectedImpact: 0.6,
            effort: 'medium',
            timeToValue: 14,
            actions: [
              'Set up build cache infrastructure',
              'Configure incremental builds',
              'Optimize dependency management'
            ],
            resources: ['Build tool documentation', 'Infrastructure team']
          }
        ],
        createdAt: new Date()
      };
    }

    return null;
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  async analyzeTeamDynamics(teamId: string): Promise<TeamDynamics> {
    const teamMetrics = await this.getTeamMetrics(teamId);
    
    const dynamics: TeamDynamics = {
      teamId,
      cohesion: this.calculateCohesion(teamMetrics),
      collaboration: this.calculateCollaboration(teamMetrics),
      communication: this.calculateCommunication(teamMetrics),
      alignment: this.calculateAlignment(teamMetrics),
      morale: this.calculateMorale(teamMetrics),
      velocity: this.calculateVelocity(teamMetrics),
      quality: this.calculateQuality(teamMetrics)
    };

    await this.persistTeamDynamics(dynamics);
    this.emit('team-dynamics-analyzed', dynamics);

    return dynamics;
  }

  private async getTeamMetrics(teamId: string): Promise<any> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [activities, communications, surveys] = await Promise.all([
      prisma.teamActivity.findMany({
        where: {
          teamId,
          timestamp: { gte: thirtyDaysAgo }
        }
      }),
      prisma.teamCommunication.findMany({
        where: {
          teamId,
          timestamp: { gte: thirtyDaysAgo }
        }
      }),
      prisma.teamSurvey.findMany({
        where: {
          teamId,
          createdAt: { gte: thirtyDaysAgo }
        }
      })
    ]);

    return { activities, communications, surveys };
  }

  private calculateCohesion(metrics: any): number {
    const interactions = metrics.communications.length;
    const teamSize = new Set(metrics.activities.map((a: any) => a.memberId)).size;
    
    if (teamSize < 2) return 0;
    
    const possibleInteractions = (teamSize * (teamSize - 1)) / 2;
    return Math.min(interactions / (possibleInteractions * 30), 1);
  }

  private calculateCollaboration(metrics: any): number {
    const collaborativeActivities = metrics.activities.filter(
      (a: any) => a.type === 'pair_programming' || a.type === 'mob_programming'
    ).length;
    
    return Math.min(collaborativeActivities / 20, 1);
  }

  private calculateCommunication(metrics: any): number {
    const messages = metrics.communications.filter((c: any) => c.type === 'message').length;
    const meetings = metrics.communications.filter((c: any) => c.type === 'meeting').length;
    
    const messageScore = Math.min(messages / 500, 1);
    const meetingScore = Math.min(meetings / 20, 1);
    
    return (messageScore + meetingScore) / 2;
  }

  private calculateAlignment(metrics: any): number {
    if (metrics.surveys.length === 0) return 0.5;
    
    const alignmentScores = metrics.surveys.map((s: any) => s.alignmentScore || 3);
    return this.calculateAverage(alignmentScores) / 5;
  }

  private calculateMorale(metrics: any): number {
    if (metrics.surveys.length === 0) return 0.5;
    
    const moraleScores = metrics.surveys.map((s: any) => s.moraleScore || 3);
    return this.calculateAverage(moraleScores) / 5;
  }

  private calculateVelocity(metrics: any): number {
    const completedStories = metrics.activities.filter(
      (a: any) => a.type === 'story_completed'
    ).length;
    
    return Math.min(completedStories / 40, 1);
  }

  private calculateQuality(metrics: any): number {
    const bugs = metrics.activities.filter((a: any) => a.type === 'bug').length;
    const features = metrics.activities.filter((a: any) => a.type === 'feature').length;
    
    if (features === 0) return 1;
    
    return Math.max(0, 1 - (bugs / features));
  }

  async detectBurnoutRisk(developerId: string): Promise<BurnoutIndicators> {
    const indicators = await this.calculateBurnoutIndicators(developerId);
    const riskLevel = this.assessBurnoutRisk(indicators);
    const trend = await this.analyzeBurnoutTrend(developerId);
    const recommendations = this.generateBurnoutRecommendations(riskLevel, indicators);

    const burnoutIndicators: BurnoutIndicators = {
      developerId,
      riskLevel,
      indicators,
      trend,
      recommendations
    };

    await this.persistBurnoutIndicators(burnoutIndicators);
    
    if (riskLevel === 'high' || riskLevel === 'critical') {
      this.emit('burnout-risk-detected', burnoutIndicators);
    }

    return burnoutIndicators;
  }

  private async calculateBurnoutIndicators(developerId: string): Promise<any> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const activities = await prisma.developerActivity.findMany({
      where: {
        developerId,
        timestamp: { gte: thirtyDaysAgo }
      }
    });

    const workingHours = this.calculateWorkingHours(activities);
    const weekendWork = this.calculateWeekendWork(activities);
    const vacationDays = await this.getVacationDays(developerId);
    const contextSwitching = this.calculateContextSwitching(activities);
    const meetingLoad = this.calculateMeetingLoad(activities);
    const focusTime = this.calculateFocusTime(activities);
    const stressSignals = this.detectStressSignals(activities);

    return {
      workingHours,
      weekendWork,
      vacationDays,
      contextSwitching,
      meetingLoad,
      focusTime,
      stressSignals
    };
  }

  private calculateWorkingHours(activities: any[]): number {
    const dailyHours = new Map<string, number>();
    
    activities.forEach(activity => {
      const date = new Date(activity.timestamp).toDateString();
      const hours = dailyHours.get(date) || 0;
      dailyHours.set(date, hours + (activity.duration || 0) / 60);
    });

    const totalHours = Array.from(dailyHours.values()).reduce((a, b) => a + b, 0);
    return totalHours / dailyHours.size;
  }

  private calculateWeekendWork(activities: any[]): number {
    return activities.filter(a => {
      const day = new Date(a.timestamp).getDay();
      return day === 0 || day === 6;
    }).length;
  }

  private async getVacationDays(developerId: string): Promise<number> {
    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    
    const vacations = await prisma.timeOff.count({
      where: {
        developerId,
        type: 'vacation',
        startDate: { gte: yearStart }
      }
    });

    return vacations;
  }

  private calculateContextSwitching(activities: any[]): number {
    let switches = 0;
    let lastContext = '';
    
    activities.forEach(activity => {
      const context = activity.projectId || activity.context;
      if (context && context !== lastContext) {
        switches++;
        lastContext = context;
      }
    });

    return switches / 30;
  }

  private calculateMeetingLoad(activities: any[]): number {
    const meetings = activities.filter(a => a.type === 'meeting');
    return meetings.reduce((sum, m) => sum + (m.duration || 0), 0) / 60;
  }

  private calculateFocusTime(activities: any[]): number {
    const focusSessions = activities.filter(a => 
      a.type === 'focus' && a.duration > 30
    );
    return focusSessions.reduce((sum, s) => sum + s.duration, 0) / 60;
  }

  private detectStressSignals(activities: any[]): number {
    let signals = 0;
    
    const lateNightWork = activities.filter(a => {
      const hour = new Date(a.timestamp).getHours();
      return hour < 6 || hour > 22;
    }).length;
    
    if (lateNightWork > 5) signals++;
    
    const rapidCommits = this.detectRapidCommits(activities);
    if (rapidCommits > 10) signals++;
    
    const errorRate = this.calculateErrorRate(activities);
    if (errorRate > 0.15) signals++;
    
    return signals;
  }

  private detectRapidCommits(activities: any[]): number {
    const commits = activities.filter(a => a.type === 'commit');
    let rapid = 0;
    
    for (let i = 1; i < commits.length; i++) {
      const timeDiff = new Date(commits[i].timestamp).getTime() - 
                       new Date(commits[i-1].timestamp).getTime();
      if (timeDiff < 5 * 60 * 1000) rapid++;
    }
    
    return rapid;
  }

  private calculateErrorRate(activities: any[]): number {
    const builds = activities.filter(a => a.type === 'build');
    const failures = builds.filter(b => b.status === 'failed').length;
    
    return builds.length > 0 ? failures / builds.length : 0;
  }

  private assessBurnoutRisk(indicators: any): 'low' | 'medium' | 'high' | 'critical' {
    let riskScore = 0;
    
    if (indicators.workingHours > 50) riskScore += 2;
    else if (indicators.workingHours > 45) riskScore += 1;
    
    if (indicators.weekendWork > 8) riskScore += 2;
    else if (indicators.weekendWork > 4) riskScore += 1;
    
    if (indicators.vacationDays < 5) riskScore += 2;
    else if (indicators.vacationDays < 10) riskScore += 1;
    
    if (indicators.contextSwitching > 15) riskScore += 1;
    if (indicators.meetingLoad > 20) riskScore += 1;
    if (indicators.focusTime < 10) riskScore += 1;
    if (indicators.stressSignals > 2) riskScore += 2;
    
    if (riskScore >= 8) return 'critical';
    if (riskScore >= 5) return 'high';
    if (riskScore >= 3) return 'medium';
    return 'low';
  }

  private async analyzeBurnoutTrend(developerId: string): Promise<'improving' | 'stable' | 'worsening'> {
    const history = await prisma.burnoutIndicator.findMany({
      where: { developerId },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    if (history.length < 2) return 'stable';

    const recentRisk = this.riskLevelToNumber(history[0].riskLevel as any);
    const previousRisk = this.riskLevelToNumber(history[1].riskLevel as any);

    if (recentRisk > previousRisk) return 'worsening';
    if (recentRisk < previousRisk) return 'improving';
    return 'stable';
  }

  private riskLevelToNumber(level: string): number {
    switch (level) {
      case 'critical': return 4;
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 0;
    }
  }

  private generateBurnoutRecommendations(riskLevel: string, indicators: any): string[] {
    const recommendations: string[] = [];

    if (indicators.workingHours > 45) {
      recommendations.push('Set clear work hour boundaries');
      recommendations.push('Delegate or defer non-critical tasks');
    }

    if (indicators.weekendWork > 4) {
      recommendations.push('Limit weekend work to critical issues only');
      recommendations.push('Schedule recovery time after weekend work');
    }

    if (indicators.vacationDays < 10) {
      recommendations.push('Schedule regular time off');
      recommendations.push('Take at least one full week vacation');
    }

    if (indicators.focusTime < 10) {
      recommendations.push('Block calendar for focused work');
      recommendations.push('Reduce meeting attendance where possible');
    }

    if (indicators.contextSwitching > 15) {
      recommendations.push('Batch similar tasks together');
      recommendations.push('Limit work in progress');
    }

    if (riskLevel === 'critical') {
      recommendations.unshift('Consider immediate time off');
      recommendations.unshift('Discuss workload with manager urgently');
    }

    return recommendations;
  }

  async predictPerformance(
    entityId: string,
    entityType: 'individual' | 'team',
    horizon: number = 30
  ): Promise<{
    predictions: any[];
    confidence: number;
    factors: Map<string, number>;
  }> {
    if (!this.predictionModel) {
      return {
        predictions: [],
        confidence: 0,
        factors: new Map()
      };
    }

    const historicalData = await this.getHistoricalData(entityId, entityType);
    const features = this.prepareFeatures(historicalData);
    
    const input = tf.tensor3d([features]);
    const prediction = this.predictionModel.predict(input) as tf.Tensor;
    const predictedValues = await prediction.array();
    
    input.dispose();
    prediction.dispose();

    const predictions = this.formatPredictions(predictedValues[0], horizon);
    const confidence = this.calculatePredictionConfidence(historicalData);
    const factors = this.identifyInfluencingFactors(historicalData);

    return { predictions, confidence, factors };
  }

  private async getHistoricalData(
    entityId: string,
    entityType: string
  ): Promise<any[]> {
    const key = `${entityType}-${entityId}`;
    
    if (this.historicalData.has(key)) {
      return this.historicalData.get(key)!;
    }

    const data = await prisma.historicalMetrics.findMany({
      where: {
        entityId,
        entityType
      },
      orderBy: { timestamp: 'desc' },
      take: 90
    });

    this.historicalData.set(key, data);
    return data;
  }

  private prepareFeatures(data: any[]): number[][] {
    const features: number[][] = [];
    
    for (let i = 0; i < Math.min(14, data.length); i++) {
      const dayData = data[i];
      features.push([
        dayData.productivity || 0,
        dayData.quality || 0,
        dayData.velocity || 0,
        dayData.collaboration || 0,
        dayData.commits || 0,
        dayData.pullRequests || 0,
        dayData.reviews || 0,
        dayData.bugs || 0,
        dayData.features || 0,
        dayData.tests || 0,
        dayData.deployments || 0,
        dayData.incidents || 0,
        dayData.meetings || 0,
        dayData.focusTime || 0,
        dayData.satisfaction || 0,
        new Date(dayData.timestamp).getDay(),
        new Date(dayData.timestamp).getDate(),
        Math.sin(2 * Math.PI * i / 7),
        Math.cos(2 * Math.PI * i / 7),
        i
      ]);
    }
    
    while (features.length < 14) {
      features.push(Array(20).fill(0));
    }
    
    return features;
  }

  private formatPredictions(values: any, horizon: number): any[] {
    const predictions = [];
    const baseDate = new Date();
    
    for (let i = 0; i < horizon; i++) {
      const date = new Date(baseDate);
      date.setDate(date.getDate() + i);
      
      predictions.push({
        date,
        predictedScore: values[0] || 75,
        confidence: Math.max(0.5, 1 - (i * 0.02))
      });
    }
    
    return predictions;
  }

  private calculatePredictionConfidence(data: any[]): number {
    if (data.length < 7) return 0.3;
    if (data.length < 14) return 0.5;
    if (data.length < 30) return 0.7;
    return 0.85;
  }

  private identifyInfluencingFactors(data: any[]): Map<string, number> {
    const factors = new Map<string, number>();
    
    const metrics = ['productivity', 'quality', 'velocity', 'collaboration'];
    
    metrics.forEach(metric => {
      const values = data.map(d => d[metric] || 0);
      const trend = this.calculateTrend(values);
      factors.set(metric, trend);
    });
    
    return factors;
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = this.calculateAverage(firstHalf);
    const secondAvg = this.calculateAverage(secondHalf);
    
    return (secondAvg - firstAvg) / firstAvg;
  }

  async generateActionableRecommendations(
    insights: Insight[]
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    const priorityMap = new Map<string, number>();

    for (const insight of insights) {
      const insightRecommendations = insight.recommendations;
      
      insightRecommendations.forEach(rec => {
        const priority = this.calculateRecommendationPriority(rec, insight);
        priorityMap.set(rec.id, priority);
        recommendations.push(rec);
      });
    }

    recommendations.sort((a, b) => 
      (priorityMap.get(b.id) || 0) - (priorityMap.get(a.id) || 0)
    );

    return recommendations.slice(0, 10);
  }

  private calculateRecommendationPriority(
    recommendation: Recommendation,
    insight: Insight
  ): number {
    const impactScore = recommendation.expectedImpact;
    const effortScore = recommendation.effort === 'low' ? 1 : 
                       recommendation.effort === 'medium' ? 0.5 : 0.25;
    const severityScore = insight.severity === 'critical' ? 1 :
                         insight.severity === 'warning' ? 0.5 : 0.25;
    const timeScore = 1 / (recommendation.timeToValue + 1);
    
    return impactScore * 0.4 + effortScore * 0.3 + severityScore * 0.2 + timeScore * 0.1;
  }

  private async persistInsights(insights: Insight[]) {
    for (const insight of insights) {
      await prisma.insight.create({
        data: {
          id: insight.id,
          type: insight.type,
          category: insight.category,
          title: insight.title,
          description: insight.description,
          severity: insight.severity,
          impact: insight.impact,
          evidence: insight.evidence,
          recommendations: insight.recommendations,
          createdAt: insight.createdAt
        }
      });
    }
  }

  private async persistTeamDynamics(dynamics: TeamDynamics) {
    await prisma.teamDynamics.create({
      data: {
        teamId: dynamics.teamId,
        cohesion: dynamics.cohesion,
        collaboration: dynamics.collaboration,
        communication: dynamics.communication,
        alignment: dynamics.alignment,
        morale: dynamics.morale,
        velocity: dynamics.velocity,
        quality: dynamics.quality,
        timestamp: new Date()
      }
    });
  }

  private async persistBurnoutIndicators(indicators: BurnoutIndicators) {
    await prisma.burnoutIndicator.create({
      data: {
        developerId: indicators.developerId,
        riskLevel: indicators.riskLevel,
        indicators: indicators.indicators,
        trend: indicators.trend,
        recommendations: indicators.recommendations,
        createdAt: new Date()
      }
    });
  }

  async comparePerformance(
    entityIds: string[],
    metrics: string[],
    period: { start: Date; end: Date }
  ): Promise<any> {
    const comparisons = await Promise.all(
      entityIds.map(id => this.getEntityMetrics(id, metrics, period))
    );

    const analysis = {
      entities: comparisons,
      rankings: this.rankEntities(comparisons),
      insights: this.generateComparativeInsights(comparisons),
      recommendations: this.generateComparativeRecommendations(comparisons)
    };

    return analysis;
  }

  private async getEntityMetrics(
    entityId: string,
    metrics: string[],
    period: { start: Date; end: Date }
  ): Promise<any> {
    const data = await prisma.entityMetrics.findMany({
      where: {
        entityId,
        timestamp: {
          gte: period.start,
          lte: period.end
        }
      }
    });

    const aggregated: any = { entityId };
    
    metrics.forEach(metric => {
      const values = data.map(d => (d as any)[metric] || 0);
      aggregated[metric] = this.calculateAverage(values);
    });

    return aggregated;
  }

  private rankEntities(entities: any[]): any[] {
    const scored = entities.map(entity => {
      const score = Object.keys(entity)
        .filter(k => k !== 'entityId')
        .reduce((sum, key) => sum + (entity[key] || 0), 0);
      
      return { ...entity, score };
    });

    return scored.sort((a, b) => b.score - a.score);
  }

  private generateComparativeInsights(comparisons: any[]): string[] {
    const insights: string[] = [];
    const metrics = Object.keys(comparisons[0]).filter(k => k !== 'entityId');
    
    metrics.forEach(metric => {
      const values = comparisons.map(c => c[metric]);
      const avg = this.calculateAverage(values);
      const stdDev = this.calculateStandardDeviation(values);
      
      comparisons.forEach(entity => {
        if (entity[metric] > avg + 2 * stdDev) {
          insights.push(`${entity.entityId} excels in ${metric}`);
        } else if (entity[metric] < avg - 2 * stdDev) {
          insights.push(`${entity.entityId} needs improvement in ${metric}`);
        }
      });
    });

    return insights;
  }

  private calculateStandardDeviation(values: number[]): number {
    const avg = this.calculateAverage(values);
    const squaredDiffs = values.map(v => Math.pow(v - avg, 2));
    return Math.sqrt(this.calculateAverage(squaredDiffs));
  }

  private generateComparativeRecommendations(comparisons: any[]): any[] {
    const recommendations: any[] = [];
    const bestPractices = this.identifyBestPractices(comparisons);
    
    comparisons.forEach(entity => {
      const gaps = this.identifyGaps(entity, bestPractices);
      
      if (gaps.length > 0) {
        recommendations.push({
          entityId: entity.entityId,
          gaps,
          suggestedActions: this.suggestActions(gaps)
        });
      }
    });

    return recommendations;
  }

  private identifyBestPractices(comparisons: any[]): any {
    const bestPractices: any = {};
    const metrics = Object.keys(comparisons[0]).filter(k => k !== 'entityId');
    
    metrics.forEach(metric => {
      const values = comparisons.map(c => c[metric]);
      bestPractices[metric] = Math.max(...values);
    });

    return bestPractices;
  }

  private identifyGaps(entity: any, bestPractices: any): string[] {
    const gaps: string[] = [];
    
    Object.keys(bestPractices).forEach(metric => {
      if (entity[metric] < bestPractices[metric] * 0.7) {
        gaps.push(metric);
      }
    });

    return gaps;
  }

  private suggestActions(gaps: string[]): string[] {
    const actions: string[] = [];
    
    gaps.forEach(gap => {
      switch (gap) {
        case 'productivity':
          actions.push('Implement automation for repetitive tasks');
          break;
        case 'quality':
          actions.push('Enhance testing practices and code reviews');
          break;
        case 'collaboration':
          actions.push('Increase pair programming and knowledge sharing');
          break;
        default:
          actions.push(`Improve ${gap} through targeted initiatives`);
      }
    });

    return actions;
  }
}