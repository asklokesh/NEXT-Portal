// Main Service Recommendations Engine

import { EventEmitter } from 'events';
import { MLAnalysisEngine } from './analysis-engine';
import { RecommendationGenerator } from './recommendation-generator';
import { ScoringEngine } from './scoring-engine';
import { ContinuousLearningSystem } from './continuous-learning';
import {
  ServiceMetrics,
  Recommendation,
  FeedbackData,
  ABTestConfig,
  RecommendationType,
  RecommendationCategory,
  RecommendationStatus
} from './types';

interface RecommendationEngineConfig {
  enableML: boolean;
  enableABTesting: boolean;
  enableAutoLearning: boolean;
  batchSize: number;
  refreshInterval: number;
  confidenceThreshold: number;
}

interface ServiceAnalysisResult {
  serviceId: string;
  recommendations: Recommendation[];
  patterns: any[];
  anomalies: any[];
  score: number;
  timestamp: Date;
}

export class ServiceRecommendationsEngine extends EventEmitter {
  private analysisEngine: MLAnalysisEngine;
  private generator: RecommendationGenerator;
  private scoringEngine: ScoringEngine;
  private learningSystem: ContinuousLearningSystem;
  private config: RecommendationEngineConfig;
  private recommendations: Map<string, Recommendation[]>;
  private analysisResults: Map<string, ServiceAnalysisResult>;
  private isInitialized: boolean;
  private analysisInterval: NodeJS.Timeout | null;

  constructor(config?: Partial<RecommendationEngineConfig>) {
    super();
    
    this.config = {
      enableML: true,
      enableABTesting: true,
      enableAutoLearning: true,
      batchSize: 10,
      refreshInterval: 3600000, // 1 hour
      confidenceThreshold: 0.7,
      ...config
    };

    this.analysisEngine = new MLAnalysisEngine();
    this.generator = new RecommendationGenerator();
    this.scoringEngine = new ScoringEngine();
    this.learningSystem = new ContinuousLearningSystem();
    
    this.recommendations = new Map();
    this.analysisResults = new Map();
    this.isInitialized = false;
    this.analysisInterval = null;

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Analysis Engine events
    this.analysisEngine.on('analysis-complete', (result) => {
      this.handleAnalysisComplete(result);
    });

    this.analysisEngine.on('initialized', () => {
      console.log('ML Analysis Engine initialized');
    });

    // Generator events
    this.generator.on('recommendation-generated', (rec) => {
      this.emit('recommendation-generated', rec);
    });

    // Scoring Engine events
    this.scoringEngine.on('recommendation-scored', (data) => {
      this.emit('recommendation-scored', data);
    });

    // Learning System events
    this.learningSystem.on('model-updated', (data) => {
      this.emit('model-updated', data);
    });

    this.learningSystem.on('ab-test-completed', (result) => {
      this.handleABTestComplete(result);
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize all components
      if (this.config.enableML) {
        await this.analysisEngine.initialize();
      }
      
      if (this.config.enableAutoLearning) {
        await this.learningSystem.initialize();
      }

      // Start periodic analysis
      if (this.config.refreshInterval > 0) {
        this.startPeriodicAnalysis();
      }

      this.isInitialized = true;
      this.emit('initialized');
      
      console.log('Service Recommendations Engine initialized successfully');
    } catch (error) {
      console.error('Failed to initialize recommendations engine:', error);
      throw error;
    }
  }

  private startPeriodicAnalysis(): void {
    this.analysisInterval = setInterval(() => {
      this.runScheduledAnalysis();
    }, this.config.refreshInterval);
  }

  private async runScheduledAnalysis(): Promise<void> {
    try {
      // Get all services that need analysis
      const services = await this.getServicesForAnalysis();
      
      for (const serviceId of services) {
        const metrics = await this.fetchServiceMetrics(serviceId);
        await this.analyzeService(serviceId, metrics);
      }
      
      this.emit('scheduled-analysis-complete', {
        servicesAnalyzed: services.length,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Scheduled analysis failed:', error);
      this.emit('scheduled-analysis-failed', error);
    }
  }

  private async getServicesForAnalysis(): Promise<string[]> {
    // In production, fetch from service registry
    return ['service-1', 'service-2', 'service-3'];
  }

  private async fetchServiceMetrics(serviceId: string): Promise<ServiceMetrics> {
    // In production, fetch actual metrics from monitoring systems
    return {
      performance: {
        responseTime: Math.random() * 1000,
        throughput: Math.random() * 10000,
        errorRate: Math.random() * 0.1,
        availability: 95 + Math.random() * 5,
        latency: [100, 200, 300, 400, 500],
        p50: 250,
        p95: 450,
        p99: 490
      },
      resource: {
        cpuUsage: Math.random() * 100,
        memoryUsage: Math.random() * 100,
        diskUsage: Math.random() * 100,
        networkBandwidth: Math.random() * 1000,
        containerCount: Math.floor(Math.random() * 10) + 1
      },
      cost: {
        monthlySpend: Math.random() * 10000,
        perRequestCost: Math.random() * 0.01,
        infrastructureCost: Math.random() * 5000,
        operationalCost: Math.random() * 5000
      },
      quality: {
        codeComplexity: Math.random() * 100,
        testCoverage: Math.random() * 100,
        technicalDebt: Math.random() * 100,
        securityScore: Math.random() * 100,
        documentationScore: Math.random() * 100
      }
    };
  }

  // Main analysis method
  async analyzeService(
    serviceId: string,
    metrics: ServiceMetrics,
    options?: {
      categories?: RecommendationCategory[];
      maxRecommendations?: number;
      includePatterns?: boolean;
    }
  ): Promise<ServiceAnalysisResult> {
    try {
      // Run ML analysis if enabled
      let recommendations: Recommendation[] = [];
      let patterns: any[] = [];
      let anomalies: any[] = [];

      if (this.config.enableML) {
        recommendations = await this.analysisEngine.analyzeService(serviceId, metrics);
        patterns = await this.analysisEngine.detectPatterns(metrics);
      } else {
        // Fallback to rule-based analysis
        recommendations = await this.performRuleBasedAnalysis(serviceId, metrics);
      }

      // Filter by categories if specified
      if (options?.categories) {
        recommendations = recommendations.filter(
          rec => options.categories!.includes(rec.category)
        );
      }

      // Score and prioritize recommendations
      const scoredRecommendations = await this.scoringEngine.prioritizeRecommendations(
        recommendations,
        new Map([[serviceId, metrics]])
      );

      // Limit number of recommendations if specified
      if (options?.maxRecommendations) {
        recommendations = scoredRecommendations.slice(0, options.maxRecommendations);
      } else {
        recommendations = scoredRecommendations;
      }

      // Store recommendations
      this.recommendations.set(serviceId, recommendations);

      // Create analysis result
      const result: ServiceAnalysisResult = {
        serviceId,
        recommendations,
        patterns: options?.includePatterns ? patterns : [],
        anomalies,
        score: this.calculateServiceScore(metrics, recommendations),
        timestamp: new Date()
      };

      this.analysisResults.set(serviceId, result);
      
      this.emit('service-analyzed', result);
      
      return result;
    } catch (error) {
      console.error(`Failed to analyze service ${serviceId}:`, error);
      throw error;
    }
  }

  private async performRuleBasedAnalysis(
    serviceId: string,
    metrics: ServiceMetrics
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    const context = { serviceId, metrics };

    // Performance rules
    if (metrics.performance.responseTime > 1000) {
      const rec = await this.generator.generateRecommendation(
        RecommendationType.CACHING_OPTIMIZATION,
        serviceId,
        context,
        []
      );
      recommendations.push(rec);
    }

    if (metrics.performance.errorRate > 0.05) {
      const rec = await this.generator.generateRecommendation(
        RecommendationType.CIRCUIT_BREAKER,
        serviceId,
        context,
        []
      );
      recommendations.push(rec);
    }

    // Cost rules
    if (metrics.resource.cpuUsage < 30 && metrics.cost.monthlySpend > 5000) {
      const rec = await this.generator.generateRecommendation(
        RecommendationType.RESOURCE_RIGHTSIZING,
        serviceId,
        context,
        []
      );
      recommendations.push(rec);
    }

    // Quality rules
    if (metrics.quality.testCoverage < 60) {
      const rec = await this.generator.generateRecommendation(
        RecommendationType.TEST_COVERAGE_INCREASE,
        serviceId,
        context,
        []
      );
      recommendations.push(rec);
    }

    if (metrics.quality.securityScore < 70) {
      const rec = await this.generator.generateRecommendation(
        RecommendationType.VULNERABILITY_PATCH,
        serviceId,
        context,
        []
      );
      recommendations.push(rec);
    }

    return recommendations;
  }

  private calculateServiceScore(
    metrics: ServiceMetrics,
    recommendations: Recommendation[]
  ): number {
    // Calculate overall service health score
    const performanceScore = (100 - metrics.performance.errorRate * 100) * 0.3;
    const costScore = Math.max(0, 100 - (metrics.cost.monthlySpend / 100)) * 0.2;
    const qualityScore = (
      metrics.quality.testCoverage * 0.3 +
      metrics.quality.securityScore * 0.4 +
      metrics.quality.documentationScore * 0.3
    ) * 0.3;
    const reliabilityScore = metrics.performance.availability * 0.2;

    const baseScore = performanceScore + costScore + qualityScore + reliabilityScore;
    
    // Adjust based on recommendations
    const recommendationPenalty = Math.min(recommendations.length * 2, 20);
    
    return Math.max(0, Math.min(100, baseScore - recommendationPenalty));
  }

  // Batch analysis for multiple services
  async analyzeServices(
    serviceMetrics: Map<string, ServiceMetrics>,
    options?: any
  ): Promise<Map<string, ServiceAnalysisResult>> {
    const results = new Map<string, ServiceAnalysisResult>();
    
    // Process in batches
    const services = Array.from(serviceMetrics.entries());
    for (let i = 0; i < services.length; i += this.config.batchSize) {
      const batch = services.slice(i, i + this.config.batchSize);
      
      const batchResults = await Promise.all(
        batch.map(([serviceId, metrics]) => 
          this.analyzeService(serviceId, metrics, options)
        )
      );
      
      batchResults.forEach(result => {
        results.set(result.serviceId, result);
      });
      
      this.emit('batch-processed', {
        batchNumber: Math.floor(i / this.config.batchSize) + 1,
        totalBatches: Math.ceil(services.length / this.config.batchSize)
      });
    }
    
    return results;
  }

  // Get recommendations for a service
  async getRecommendations(
    serviceId: string,
    options?: {
      status?: RecommendationStatus;
      category?: RecommendationCategory;
      minScore?: number;
    }
  ): Promise<Recommendation[]> {
    let recommendations = this.recommendations.get(serviceId) || [];
    
    if (options?.status) {
      recommendations = recommendations.filter(r => r.status === options.status);
    }
    
    if (options?.category) {
      recommendations = recommendations.filter(r => r.category === options.category);
    }
    
    if (options?.minScore) {
      recommendations = recommendations.filter(r => r.score >= options.minScore!);
    }
    
    return recommendations;
  }

  // Update recommendation status
  async updateRecommendationStatus(
    recommendationId: string,
    status: RecommendationStatus
  ): Promise<void> {
    for (const [serviceId, recs] of this.recommendations) {
      const rec = recs.find(r => r.id === recommendationId);
      if (rec) {
        rec.status = status;
        rec.updatedAt = new Date();
        
        this.emit('recommendation-status-updated', {
          recommendationId,
          status,
          serviceId
        });
        
        break;
      }
    }
  }

  // Feedback integration
  async provideFeedback(feedback: FeedbackData): Promise<void> {
    if (this.config.enableAutoLearning) {
      await this.learningSystem.recordFeedback(feedback);
    }
    
    this.emit('feedback-received', feedback);
  }

  // A/B Testing
  async createABTest(config: ABTestConfig): Promise<void> {
    if (!this.config.enableABTesting) {
      throw new Error('A/B testing is not enabled');
    }
    
    await this.learningSystem.createABTest(config);
  }

  async getABTestVariant(testId: string, entityId: string): Promise<any> {
    if (!this.config.enableABTesting) {
      return null;
    }
    
    return this.learningSystem.assignToVariant(testId, entityId);
  }

  // Insights and reporting
  async getInsights(): Promise<any> {
    const insights = {
      totalServices: this.recommendations.size,
      totalRecommendations: Array.from(this.recommendations.values())
        .reduce((sum, recs) => sum + recs.length, 0),
      categoryCounts: this.getCategoryCounts(),
      averageScore: this.getAverageScore(),
      topRecommendations: this.getTopRecommendations(10),
      recentAnalyses: Array.from(this.analysisResults.values())
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 5)
    };

    if (this.config.enableAutoLearning) {
      insights.learningMetrics = await this.learningSystem.getModelInsights();
    }

    return insights;
  }

  private getCategoryCounts(): Record<RecommendationCategory, number> {
    const counts: any = {};
    
    for (const category of Object.values(RecommendationCategory)) {
      counts[category] = 0;
    }
    
    for (const recs of this.recommendations.values()) {
      recs.forEach(rec => {
        counts[rec.category]++;
      });
    }
    
    return counts;
  }

  private getAverageScore(): number {
    const allScores: number[] = [];
    
    for (const result of this.analysisResults.values()) {
      allScores.push(result.score);
    }
    
    if (allScores.length === 0) return 0;
    
    return allScores.reduce((sum, score) => sum + score, 0) / allScores.length;
  }

  private getTopRecommendations(limit: number): Recommendation[] {
    const allRecommendations: Recommendation[] = [];
    
    for (const recs of this.recommendations.values()) {
      allRecommendations.push(...recs);
    }
    
    return allRecommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private handleAnalysisComplete(result: any): void {
    console.log('Analysis complete for service:', result.serviceId);
  }

  private handleABTestComplete(result: any): void {
    console.log('A/B test completed:', result.testId);
    this.emit('ab-test-completed', result);
  }

  // Cleanup
  async shutdown(): Promise<void> {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }
    
    this.emit('shutdown');
    console.log('Service Recommendations Engine shut down');
  }
}

// Export all types and classes
export * from './types';
export { MLAnalysisEngine } from './analysis-engine';
export { RecommendationGenerator } from './recommendation-generator';
export { ScoringEngine } from './scoring-engine';
export { ContinuousLearningSystem } from './continuous-learning';