/**
 * Productivity Analytics Orchestrator
 * 
 * Main orchestration service that coordinates all productivity analytics operations
 * including data collection, analysis, insights generation, and reporting.
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { MetricsCollector } from './metrics-collector';
import { InsightsEngine } from './insights-engine';
import { BottleneckDetector } from './bottleneck-detector';
import { CollaborationAnalyzer } from './collaboration-analyzer';
import { CodeQualityAnalyzer } from './code-quality-analyzer';
import { BenchmarkingEngine } from './benchmarking-engine';
import { RecommendationEngine } from './recommendation-engine';
import { IntegrationAdapters } from './integration-adapters';
import { AnalyticsConfig } from './analytics-config';

export interface AnalyticsJob {
  id: string;
  type: 'full-analysis' | 'metrics-collection' | 'bottleneck-detection' | 'insights-generation' | 'benchmarking';
  status: 'pending' | 'running' | 'completed' | 'failed';
  scheduledAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  progress: number;
  metadata: {
    teamId?: string;
    projectId?: string;
    timeRange: {
      start: Date;
      end: Date;
    };
    analysisTypes: string[];
    priority: 'low' | 'medium' | 'high' | 'critical';
  };
}

export interface ProductivityMetrics {
  overview: {
    totalDevelopers: number;
    activeProjects: number;
    avgProductivityScore: number;
    productivityTrend: 'increasing' | 'decreasing' | 'stable';
    lastUpdated: Date;
  };
  developerMetrics: Array<{
    developerId: string;
    name: string;
    team: string;
    productivityScore: number;
    metrics: {
      codeCommits: number;
      linesOfCode: number;
      pullRequests: number;
      codeReviews: number;
      bugsFixed: number;
      featuresDelivered: number;
      testCoverage: number;
      codeQuality: number;
    };
    trends: {
      velocity: number;
      quality: number;
      collaboration: number;
    };
    workPatterns: {
      workingHours: Array<{ hour: number; activity: number }>;
      peakProductivityHours: number[];
      breakPatterns: Array<{ start: number; duration: number }>;
    };
  }>;
  teamMetrics: Array<{
    teamId: string;
    name: string;
    memberCount: number;
    productivityScore: number;
    collaborationScore: number;
    deliveryVelocity: number;
    qualityScore: number;
    burnoutRisk: number;
  }>;
  projectMetrics: Array<{
    projectId: string;
    name: string;
    teamSize: number;
    completionRate: number;
    velocityTrend: number;
    qualityMetrics: {
      bugDensity: number;
      testCoverage: number;
      codeQuality: number;
      technicalDebt: number;
    };
  }>;
}

export interface AnalyticsInsights {
  summary: {
    overallHealth: 'excellent' | 'good' | 'fair' | 'poor';
    keyFindings: string[];
    criticalIssues: string[];
    improvements: string[];
    generatedAt: Date;
  };
  productivityInsights: {
    topPerformers: Array<{ developerId: string; score: number; highlights: string[] }>;
    improvementOpportunities: Array<{ area: string; impact: 'high' | 'medium' | 'low'; description: string }>;
    trendAnalysis: {
      velocity: { direction: 'up' | 'down' | 'stable'; percentage: number };
      quality: { direction: 'up' | 'down' | 'stable'; percentage: number };
      collaboration: { direction: 'up' | 'down' | 'stable'; percentage: number };
    };
  };
  bottlenecks: Array<{
    type: 'code-review' | 'deployment' | 'testing' | 'planning' | 'communication';
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    affectedTeams: string[];
    estimatedImpact: string;
    suggestedActions: string[];
  }>;
  benchmarking: {
    industryComparison: {
      velocity: { percentile: number; industry: string };
      quality: { percentile: number; industry: string };
      satisfaction: { percentile: number; industry: string };
    };
    internalComparison: {
      topTeams: string[];
      improvingTeams: string[];
      concerningTeams: string[];
    };
  };
  recommendations: Array<{
    category: 'process' | 'tools' | 'training' | 'culture';
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    expectedImpact: string;
    implementationEffort: 'low' | 'medium' | 'high';
    timeline: string;
    successMetrics: string[];
  }>;
}

export class AnalyticsOrchestrator extends EventEmitter {
  private metricsCollector: MetricsCollector;
  private insightsEngine: InsightsEngine;
  private bottleneckDetector: BottleneckDetector;
  private collaborationAnalyzer: CollaborationAnalyzer;
  private codeQualityAnalyzer: CodeQualityAnalyzer;
  private benchmarkingEngine: BenchmarkingEngine;
  private recommendationEngine: RecommendationEngine;
  private integrationAdapters: IntegrationAdapters;
  private config: AnalyticsConfig;
  private logger: Logger;
  private jobs: Map<string, AnalyticsJob> = new Map();
  private isRunning: boolean = false;
  private schedulerInterval?: NodeJS.Timeout;
  private cache: Map<string, any> = new Map();

  constructor(
    logger: Logger,
    config?: Partial<AnalyticsConfig>
  ) {
    super();
    this.logger = logger;
    this.config = new AnalyticsConfig(config);
    
    // Initialize components
    this.metricsCollector = new MetricsCollector(logger, this.config);
    this.insightsEngine = new InsightsEngine(logger, this.config);
    this.bottleneckDetector = new BottleneckDetector(logger, this.config);
    this.collaborationAnalyzer = new CollaborationAnalyzer(logger, this.config);
    this.codeQualityAnalyzer = new CodeQualityAnalyzer(logger, this.config);
    this.benchmarkingEngine = new BenchmarkingEngine(logger, this.config);
    this.recommendationEngine = new RecommendationEngine(logger, this.config);
    this.integrationAdapters = new IntegrationAdapters(logger, this.config);

    this.setupEventListeners();
  }

  /**
   * Start the analytics orchestrator
   */
  async start(): Promise<void> {
    try {
      this.logger.info('Starting Productivity Analytics Orchestrator');
      
      this.isRunning = true;
      
      // Initialize all components
      await this.initializeComponents();
      
      // Start the job scheduler
      this.startScheduler();
      
      // Schedule initial full analysis
      await this.scheduleFullAnalysis();
      
      this.emit('started');
      this.logger.info('Productivity Analytics Orchestrator started successfully');
      
    } catch (error) {
      this.logger.error('Failed to start Analytics Orchestrator:', error);
      throw error;
    }
  }

  /**
   * Stop the analytics orchestrator
   */
  async stop(): Promise<void> {
    try {
      this.logger.info('Stopping Productivity Analytics Orchestrator');
      
      this.isRunning = false;
      
      if (this.schedulerInterval) {
        clearInterval(this.schedulerInterval);
        this.schedulerInterval = undefined;
      }
      
      // Wait for running jobs to complete
      await this.waitForJobsToComplete();
      
      // Stop all components
      await this.stopComponents();
      
      this.emit('stopped');
      this.logger.info('Productivity Analytics Orchestrator stopped successfully');
      
    } catch (error) {
      this.logger.error('Failed to stop Analytics Orchestrator:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive productivity metrics
   */
  async getProductivityMetrics(filters?: {
    teamId?: string;
    projectId?: string;
    timeRange?: { start: Date; end: Date };
  }): Promise<ProductivityMetrics> {
    try {
      const cacheKey = `metrics:${JSON.stringify(filters)}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.config.getCacheTimeout()) {
        return cached.data;
      }

      this.logger.info('Collecting comprehensive productivity metrics', { filters });

      // Collect metrics from all sources
      const [
        developerMetrics,
        teamMetrics,
        projectMetrics
      ] = await Promise.all([
        this.metricsCollector.collectDeveloperMetrics(filters),
        this.metricsCollector.collectTeamMetrics(filters),
        this.metricsCollector.collectProjectMetrics(filters)
      ]);

      const overview = {
        totalDevelopers: developerMetrics.length,
        activeProjects: projectMetrics.length,
        avgProductivityScore: this.calculateAverageProductivityScore(developerMetrics),
        productivityTrend: this.calculateProductivityTrend(developerMetrics),
        lastUpdated: new Date()
      };

      const metrics: ProductivityMetrics = {
        overview,
        developerMetrics,
        teamMetrics,
        projectMetrics
      };

      // Cache the results
      this.cache.set(cacheKey, {
        data: metrics,
        timestamp: Date.now()
      });

      return metrics;

    } catch (error) {
      this.logger.error('Failed to get productivity metrics:', error);
      throw error;
    }
  }

  /**
   * Generate comprehensive analytics insights
   */
  async generateInsights(filters?: {
    teamId?: string;
    projectId?: string;
    timeRange?: { start: Date; end: Date };
  }): Promise<AnalyticsInsights> {
    try {
      this.logger.info('Generating analytics insights', { filters });

      // Get current metrics
      const metrics = await this.getProductivityMetrics(filters);

      // Generate insights from all analyzers
      const [
        productivityInsights,
        bottlenecks,
        collaborationInsights,
        qualityInsights,
        benchmarkData,
        recommendations
      ] = await Promise.all([
        this.insightsEngine.generateProductivityInsights(metrics),
        this.bottleneckDetector.detectBottlenecks(metrics),
        this.collaborationAnalyzer.analyzeCollaboration(metrics),
        this.codeQualityAnalyzer.analyzeCodeQuality(metrics),
        this.benchmarkingEngine.generateBenchmarks(metrics),
        this.recommendationEngine.generateRecommendations(metrics)
      ]);

      // Compile comprehensive insights
      const insights: AnalyticsInsights = {
        summary: {
          overallHealth: this.calculateOverallHealth(metrics),
          keyFindings: this.extractKeyFindings(productivityInsights, bottlenecks, recommendations),
          criticalIssues: this.identifyCriticalIssues(bottlenecks),
          improvements: this.identifyImprovementAreas(recommendations),
          generatedAt: new Date()
        },
        productivityInsights,
        bottlenecks,
        benchmarking: benchmarkData,
        recommendations
      };

      this.emit('insights-generated', insights);
      return insights;

    } catch (error) {
      this.logger.error('Failed to generate insights:', error);
      throw error;
    }
  }

  /**
   * Schedule a full analytics analysis
   */
  async scheduleFullAnalysis(options?: {
    teamId?: string;
    projectId?: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    timeRange?: { start: Date; end: Date };
  }): Promise<string> {
    const jobId = `full-analysis-${Date.now()}`;
    const job: AnalyticsJob = {
      id: jobId,
      type: 'full-analysis',
      status: 'pending',
      scheduledAt: new Date(),
      progress: 0,
      metadata: {
        teamId: options?.teamId,
        projectId: options?.projectId,
        timeRange: options?.timeRange || {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          end: new Date()
        },
        analysisTypes: ['metrics', 'insights', 'bottlenecks', 'collaboration', 'quality', 'benchmarking'],
        priority: options?.priority || 'medium'
      }
    };

    this.jobs.set(jobId, job);
    this.logger.info(`Scheduled full analysis job: ${jobId}`, { options });
    
    return jobId;
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): AnalyticsJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs with optional filtering
   */
  getJobs(status?: string): AnalyticsJob[] {
    const jobs = Array.from(this.jobs.values());
    return status ? jobs.filter(job => job.status === status) : jobs;
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    if (job.status === 'running') {
      this.logger.warn(`Cannot cancel running job: ${jobId}`);
      return false;
    }

    job.status = 'failed';
    job.error = 'Cancelled by user';
    job.completedAt = new Date();

    this.logger.info(`Cancelled job: ${jobId}`);
    return true;
  }

  /**
   * Get real-time analytics data
   */
  async getRealTimeAnalytics(): Promise<{
    activeJobs: number;
    completedToday: number;
    avgProcessingTime: number;
    systemHealth: 'healthy' | 'degraded' | 'critical';
    lastUpdate: Date;
  }> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const jobs = Array.from(this.jobs.values());
    const activeJobs = jobs.filter(job => job.status === 'running').length;
    const completedToday = jobs.filter(job => 
      job.status === 'completed' && 
      job.completedAt && 
      job.completedAt >= todayStart
    ).length;

    const completedJobs = jobs.filter(job => 
      job.status === 'completed' && 
      job.startedAt && 
      job.completedAt
    );
    
    const avgProcessingTime = completedJobs.length > 0 
      ? completedJobs.reduce((sum, job) => 
          sum + (job.completedAt!.getTime() - job.startedAt!.getTime()), 0
        ) / completedJobs.length
      : 0;

    const systemHealth = this.assessSystemHealth(jobs);

    return {
      activeJobs,
      completedToday,
      avgProcessingTime,
      systemHealth,
      lastUpdate: now
    };
  }

  // Private methods

  private async initializeComponents(): Promise<void> {
    await Promise.all([
      this.integrationAdapters.initialize(),
      this.metricsCollector.initialize(),
      this.insightsEngine.initialize(),
      this.bottleneckDetector.initialize(),
      this.collaborationAnalyzer.initialize(),
      this.codeQualityAnalyzer.initialize(),
      this.benchmarkingEngine.initialize(),
      this.recommendationEngine.initialize()
    ]);
  }

  private async stopComponents(): Promise<void> {
    await Promise.all([
      this.integrationAdapters.shutdown?.(),
      this.metricsCollector.shutdown?.(),
      this.insightsEngine.shutdown?.(),
      this.bottleneckDetector.shutdown?.(),
      this.collaborationAnalyzer.shutdown?.(),
      this.codeQualityAnalyzer.shutdown?.(),
      this.benchmarkingEngine.shutdown?.(),
      this.recommendationEngine.shutdown?.()
    ]);
  }

  private startScheduler(): void {
    this.schedulerInterval = setInterval(async () => {
      await this.processJobQueue();
    }, this.config.getSchedulerInterval());
  }

  private async processJobQueue(): Promise<void> {
    if (!this.isRunning) return;

    const pendingJobs = Array.from(this.jobs.values())
      .filter(job => job.status === 'pending')
      .sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.metadata.priority] - priorityOrder[b.metadata.priority];
      });

    const runningJobs = Array.from(this.jobs.values())
      .filter(job => job.status === 'running').length;

    const maxConcurrentJobs = this.config.getMaxConcurrentJobs();
    const availableSlots = maxConcurrentJobs - runningJobs;

    for (let i = 0; i < Math.min(availableSlots, pendingJobs.length); i++) {
      const job = pendingJobs[i];
      this.executeJob(job).catch(error => {
        this.logger.error(`Job execution failed: ${job.id}`, error);
      });
    }
  }

  private async executeJob(job: AnalyticsJob): Promise<void> {
    try {
      job.status = 'running';
      job.startedAt = new Date();
      job.progress = 0;

      this.logger.info(`Starting job execution: ${job.id}`);
      this.emit('job-started', job);

      switch (job.type) {
        case 'full-analysis':
          await this.executeFullAnalysis(job);
          break;
        case 'metrics-collection':
          await this.executeMetricsCollection(job);
          break;
        case 'bottleneck-detection':
          await this.executeBottleneckDetection(job);
          break;
        case 'insights-generation':
          await this.executeInsightsGeneration(job);
          break;
        case 'benchmarking':
          await this.executeBenchmarking(job);
          break;
        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }

      job.status = 'completed';
      job.progress = 100;
      job.completedAt = new Date();

      this.logger.info(`Completed job: ${job.id}`);
      this.emit('job-completed', job);

    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : String(error);
      job.completedAt = new Date();

      this.logger.error(`Job failed: ${job.id}`, error);
      this.emit('job-failed', job);
    }
  }

  private async executeFullAnalysis(job: AnalyticsJob): Promise<void> {
    const steps = [
      { name: 'Metrics Collection', weight: 20 },
      { name: 'Insights Generation', weight: 20 },
      { name: 'Bottleneck Detection', weight: 20 },
      { name: 'Collaboration Analysis', weight: 15 },
      { name: 'Code Quality Analysis', weight: 15 },
      { name: 'Benchmarking', weight: 10 }
    ];

    let currentProgress = 0;

    for (const step of steps) {
      this.logger.info(`Executing step: ${step.name} for job: ${job.id}`);
      
      switch (step.name) {
        case 'Metrics Collection':
          await this.metricsCollector.collectAllMetrics(job.metadata);
          break;
        case 'Insights Generation':
          await this.insightsEngine.generateAllInsights(job.metadata);
          break;
        case 'Bottleneck Detection':
          await this.bottleneckDetector.detectAllBottlenecks(job.metadata);
          break;
        case 'Collaboration Analysis':
          await this.collaborationAnalyzer.analyzeAllCollaboration(job.metadata);
          break;
        case 'Code Quality Analysis':
          await this.codeQualityAnalyzer.analyzeAllCodeQuality(job.metadata);
          break;
        case 'Benchmarking':
          await this.benchmarkingEngine.generateAllBenchmarks(job.metadata);
          break;
      }

      currentProgress += step.weight;
      job.progress = currentProgress;
      this.emit('job-progress', job);
    }
  }

  private async executeMetricsCollection(job: AnalyticsJob): Promise<void> {
    await this.metricsCollector.collectAllMetrics(job.metadata);
  }

  private async executeBottleneckDetection(job: AnalyticsJob): Promise<void> {
    await this.bottleneckDetector.detectAllBottlenecks(job.metadata);
  }

  private async executeInsightsGeneration(job: AnalyticsJob): Promise<void> {
    await this.insightsEngine.generateAllInsights(job.metadata);
  }

  private async executeBenchmarking(job: AnalyticsJob): Promise<void> {
    await this.benchmarkingEngine.generateAllBenchmarks(job.metadata);
  }

  private async waitForJobsToComplete(): Promise<void> {
    const runningJobs = Array.from(this.jobs.values())
      .filter(job => job.status === 'running');

    if (runningJobs.length === 0) return;

    this.logger.info(`Waiting for ${runningJobs.length} jobs to complete`);
    
    const timeout = 30000; // 30 seconds timeout
    const checkInterval = 1000; // Check every second
    const maxChecks = timeout / checkInterval;
    let checks = 0;

    while (checks < maxChecks) {
      const stillRunning = Array.from(this.jobs.values())
        .filter(job => job.status === 'running');
      
      if (stillRunning.length === 0) break;
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      checks++;
    }
  }

  private setupEventListeners(): void {
    this.metricsCollector.on('metrics-collected', (data) => {
      this.emit('metrics-updated', data);
    });

    this.bottleneckDetector.on('bottleneck-detected', (bottleneck) => {
      this.emit('bottleneck-detected', bottleneck);
    });

    this.insightsEngine.on('insights-generated', (insights) => {
      this.emit('insights-updated', insights);
    });

    this.recommendationEngine.on('recommendations-generated', (recommendations) => {
      this.emit('recommendations-updated', recommendations);
    });
  }

  private calculateAverageProductivityScore(developerMetrics: any[]): number {
    if (developerMetrics.length === 0) return 0;
    const total = developerMetrics.reduce((sum, dev) => sum + dev.productivityScore, 0);
    return Math.round(total / developerMetrics.length);
  }

  private calculateProductivityTrend(developerMetrics: any[]): 'increasing' | 'decreasing' | 'stable' {
    // Simplified trend calculation - in reality, would compare with historical data
    const avgScore = this.calculateAverageProductivityScore(developerMetrics);
    if (avgScore > 75) return 'increasing';
    if (avgScore < 60) return 'decreasing';
    return 'stable';
  }

  private calculateOverallHealth(metrics: ProductivityMetrics): 'excellent' | 'good' | 'fair' | 'poor' {
    const avgScore = metrics.overview.avgProductivityScore;
    if (avgScore >= 85) return 'excellent';
    if (avgScore >= 70) return 'good';
    if (avgScore >= 55) return 'fair';
    return 'poor';
  }

  private extractKeyFindings(productivityInsights: any, bottlenecks: any[], recommendations: any[]): string[] {
    const findings: string[] = [];
    
    if (productivityInsights.topPerformers?.length > 0) {
      findings.push(`Top ${productivityInsights.topPerformers.length} performers identified`);
    }
    
    if (bottlenecks.length > 0) {
      const criticalBottlenecks = bottlenecks.filter(b => b.severity === 'critical').length;
      if (criticalBottlenecks > 0) {
        findings.push(`${criticalBottlenecks} critical productivity bottlenecks detected`);
      }
    }
    
    const highPriorityRecommendations = recommendations.filter(r => r.priority === 'high').length;
    if (highPriorityRecommendations > 0) {
      findings.push(`${highPriorityRecommendations} high-priority improvement opportunities`);
    }
    
    return findings;
  }

  private identifyCriticalIssues(bottlenecks: any[]): string[] {
    return bottlenecks
      .filter(b => b.severity === 'critical')
      .map(b => b.description);
  }

  private identifyImprovementAreas(recommendations: any[]): string[] {
    return recommendations
      .filter(r => r.priority === 'high' && r.expectedImpact)
      .map(r => r.expectedImpact);
  }

  private assessSystemHealth(jobs: AnalyticsJob[]): 'healthy' | 'degraded' | 'critical' {
    const recentJobs = jobs.filter(job => 
      job.scheduledAt > new Date(Date.now() - 24 * 60 * 60 * 1000)
    );
    
    if (recentJobs.length === 0) return 'healthy';
    
    const failedJobs = recentJobs.filter(job => job.status === 'failed').length;
    const failureRate = failedJobs / recentJobs.length;
    
    if (failureRate > 0.3) return 'critical';
    if (failureRate > 0.1) return 'degraded';
    return 'healthy';
  }
}