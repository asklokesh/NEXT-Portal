import { EventEmitter } from 'events';
import { logger } from '../monitoring/index';
import { MetricsCollector } from '../monitoring/metrics-collector';
import { AdvancedCacheSystem } from '../advanced-caching';
import { PerformanceMonitor } from '../monitoring/index';

export interface PerformanceTuningConfig {
  enableAutoTuning: boolean;
  tuningInterval: number;
  aggressiveness: 'conservative' | 'moderate' | 'aggressive';
  targetMetrics: {
    responseTime: number;
    throughput: number;
    cpuUtilization: number;
    memoryUtilization: number;
    errorRate: number;
  };
  constraints: {
    maxCpuIncrease: number;
    maxMemoryIncrease: number;
    maxInstanceCount: number;
    budgetLimit: number;
  };
}

export interface TuningRecommendation {
  id: string;
  category: 'infrastructure' | 'application' | 'database' | 'cache' | 'network';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  expectedImpact: {
    performanceGain: number;
    costImpact: number;
    riskLevel: 'low' | 'medium' | 'high';
    implementationEffort: 'low' | 'medium' | 'high';
  };
  implementation: {
    steps: string[];
    rollbackPlan: string[];
    testingRequirements: string[];
    monitoringChanges: string[];
  };
  aiConfidence: number;
  validUntil: Date;
}

export interface OptimizationResult {
  optimizationId: string;
  startTime: Date;
  endTime: Date;
  status: 'running' | 'completed' | 'failed' | 'rolled_back';
  appliedChanges: OptimizationChange[];
  performanceImpact: {
    before: PerformanceSnapshot;
    after: PerformanceSnapshot;
    improvement: Record<string, number>;
  };
  costs: {
    implementation: number;
    ongoing: number;
    savings: number;
  };
}

export interface OptimizationChange {
  type: 'config' | 'infrastructure' | 'code' | 'cache';
  component: string;
  parameter: string;
  oldValue: any;
  newValue: any;
  rollbackValue: any;
}

export interface PerformanceSnapshot {
  timestamp: Date;
  metrics: {
    responseTime: { p50: number; p95: number; p99: number };
    throughput: number;
    errorRate: number;
    cpuUtilization: number;
    memoryUtilization: number;
    networkLatency: number;
    diskIo: number;
  };
  resourceUsage: {
    instances: number;
    totalCpu: number;
    totalMemory: number;
    storageUsed: number;
  };
}

/**
 * Automated Performance Tuning System with ML
 * Features:
 * - Continuous performance monitoring and analysis
 * - ML-based optimization recommendations
 * - Automated parameter tuning with safety constraints
 * - Resource scaling optimization
 * - Database query optimization
 * - Cache configuration tuning
 * - Network optimization
 * - Automated rollback on performance degradation
 */
export class PerformanceTuningEngine extends EventEmitter {
  private config: PerformanceTuningConfig;
  private metricsCollector: MetricsCollector;
  private performanceMonitor: PerformanceMonitor;
  private cacheSystem: AdvancedCacheSystem;
  private activeOptimizations = new Map<string, OptimizationResult>();
  private optimizationHistory: OptimizationResult[] = [];
  private mlOptimizer: MLOptimizer;
  private safetyGuards: SafetyGuards;

  constructor(
    config: PerformanceTuningConfig,
    dependencies: {
      performanceMonitor: PerformanceMonitor;
      cacheSystem: AdvancedCacheSystem;
    }
  ) {
    super();
    this.config = config;
    this.metricsCollector = new MetricsCollector();
    this.performanceMonitor = dependencies.performanceMonitor;
    this.cacheSystem = dependencies.cacheSystem;
    this.mlOptimizer = new MLOptimizer();
    this.safetyGuards = new SafetyGuards(config.constraints);
    
    this.startPerformanceTuning();
  }

  /**
   * Get performance tuning recommendations
   */
  async getRecommendations(): Promise<TuningRecommendation[]> {
    const currentMetrics = await this.collectCurrentMetrics();
    const historicalData = await this.getHistoricalPerformanceData();
    const systemProfile = await this.generateSystemProfile();
    
    const recommendations = await this.mlOptimizer.generateRecommendations({
      currentMetrics,
      historicalData,
      systemProfile,
      targetMetrics: this.config.targetMetrics,
      constraints: this.config.constraints
    });
    
    // Filter and prioritize recommendations
    const filtered = recommendations
      .filter(rec => this.safetyGuards.validateRecommendation(rec))
      .sort((a, b) => this.calculateRecommendationScore(b) - this.calculateRecommendationScore(a));
    
    return filtered.slice(0, 10); // Top 10 recommendations
  }

  /**
   * Apply optimization automatically
   */
  async applyOptimization(recommendationId: string): Promise<string> {
    const recommendation = await this.getRecommendationById(recommendationId);
    if (!recommendation) {
      throw new Error(`Recommendation ${recommendationId} not found`);
    }
    
    const optimizationId = this.generateOptimizationId();
    const startTime = new Date();
    
    // Create optimization record
    const optimization: OptimizationResult = {
      optimizationId,
      startTime,
      endTime: new Date(0),
      status: 'running',
      appliedChanges: [],
      performanceImpact: {
        before: await this.takePerformanceSnapshot(),
        after: null as any,
        improvement: {}
      },
      costs: {
        implementation: 0,
        ongoing: 0,
        savings: 0
      }
    };
    
    this.activeOptimizations.set(optimizationId, optimization);
    
    try {
      // Apply optimization changes
      const changes = await this.implementOptimization(recommendation);
      optimization.appliedChanges = changes;
      
      // Wait for stabilization
      await this.waitForStabilization();
      
      // Measure impact
      const afterSnapshot = await this.takePerformanceSnapshot();
      optimization.performanceImpact.after = afterSnapshot;
      optimization.performanceImpact.improvement = this.calculateImprovement(
        optimization.performanceImpact.before,
        afterSnapshot
      );
      
      // Validate improvement
      const isImproved = this.validateImprovement(optimization.performanceImpact.improvement);
      
      if (!isImproved) {
        logger.warn(`Optimization ${optimizationId} did not show expected improvement, rolling back`);
        await this.rollbackOptimization(optimizationId);
        optimization.status = 'rolled_back';
      } else {
        optimization.status = 'completed';
        logger.info(`Optimization ${optimizationId} successfully applied`, {
          improvement: optimization.performanceImpact.improvement
        });
      }
      
      optimization.endTime = new Date();
      this.optimizationHistory.push(optimization);
      this.activeOptimizations.delete(optimizationId);
      
      this.emit('optimizationCompleted', optimization);
      
      return optimizationId;
      
    } catch (error) {
      logger.error(`Optimization ${optimizationId} failed:`, error);
      optimization.status = 'failed';
      optimization.endTime = new Date();
      
      await this.rollbackOptimization(optimizationId);
      this.emit('optimizationFailed', { optimizationId, error: error.message });
      
      throw error;
    }
  }

  /**
   * Get optimization status
   */
  async getOptimizationStatus(optimizationId: string): Promise<OptimizationResult | null> {
    return this.activeOptimizations.get(optimizationId) || 
           this.optimizationHistory.find(opt => opt.optimizationId === optimizationId) || 
           null;
  }

  /**
   * Get system performance profile
   */
  async getPerformanceProfile(): Promise<{
    currentSnapshot: PerformanceSnapshot;
    trends: {
      responseTime: { trend: 'improving' | 'degrading' | 'stable'; rate: number };
      throughput: { trend: 'improving' | 'degrading' | 'stable'; rate: number };
      errorRate: { trend: 'improving' | 'degrading' | 'stable'; rate: number };
      resourceUtilization: { trend: 'improving' | 'degrading' | 'stable'; rate: number };
    };
    bottlenecks: Array<{
      component: string;
      severity: 'critical' | 'high' | 'medium' | 'low';
      description: string;
      impact: number;
    }>;
    optimizationOpportunities: number;
  }> {
    const currentSnapshot = await this.takePerformanceSnapshot();
    const trends = await this.analyzePerformanceTrends();
    const bottlenecks = await this.identifyBottlenecks();
    const opportunities = await this.countOptimizationOpportunities();
    
    return {
      currentSnapshot,
      trends,
      bottlenecks,
      optimizationOpportunities: opportunities
    };
  }

  /**
   * Start continuous performance optimization
   */
  private startPerformanceTuning(): void {
    if (!this.config.enableAutoTuning) {
      logger.info('Automatic performance tuning is disabled');
      return;
    }
    
    logger.info('Starting automated performance tuning', {
      interval: this.config.tuningInterval,
      aggressiveness: this.config.aggressiveness
    });
    
    // Main optimization loop
    setInterval(async () => {
      try {
        await this.runOptimizationCycle();
      } catch (error) {
        logger.error('Optimization cycle failed:', error);
      }
    }, this.config.tuningInterval);
    
    // Safety monitoring
    setInterval(async () => {
      await this.monitorSafetyMetrics();
    }, 30000); // Every 30 seconds
    
    // Performance regression detection
    setInterval(async () => {
      await this.detectPerformanceRegressions();
    }, 60000); // Every minute
  }

  private async runOptimizationCycle(): Promise<void> {
    logger.debug('Running optimization cycle');
    
    // Skip if there are active optimizations
    if (this.activeOptimizations.size > 0) {
      logger.debug('Skipping optimization cycle - active optimizations in progress');
      return;
    }
    
    // Get recommendations
    const recommendations = await this.getRecommendations();
    
    if (recommendations.length === 0) {
      logger.debug('No optimization recommendations available');
      return;
    }
    
    // Apply top recommendation based on aggressiveness setting
    const topRecommendation = recommendations[0];
    const shouldApply = this.shouldApplyRecommendation(topRecommendation);
    
    if (shouldApply) {
      logger.info(`Applying automatic optimization: ${topRecommendation.title}`);
      await this.applyOptimization(topRecommendation.id);
    }
  }

  private shouldApplyRecommendation(recommendation: TuningRecommendation): boolean {
    const aggressivenessThresholds = {
      conservative: { minConfidence: 0.9, maxRisk: 'low', minImpact: 0.2 },
      moderate: { minConfidence: 0.7, maxRisk: 'medium', minImpact: 0.1 },
      aggressive: { minConfidence: 0.5, maxRisk: 'high', minImpact: 0.05 }
    };
    
    const threshold = aggressivenessThresholds[this.config.aggressiveness];
    
    return (
      recommendation.aiConfidence >= threshold.minConfidence &&
      this.getRiskLevel(recommendation.expectedImpact.riskLevel) <= this.getRiskLevel(threshold.maxRisk) &&
      recommendation.expectedImpact.performanceGain >= threshold.minImpact
    );
  }

  private getRiskLevel(risk: string): number {
    const levels = { low: 1, medium: 2, high: 3 };
    return levels[risk] || 0;
  }

  private async implementOptimization(recommendation: TuningRecommendation): Promise<OptimizationChange[]> {
    const changes: OptimizationChange[] = [];
    
    switch (recommendation.category) {
      case 'infrastructure':
        changes.push(...await this.applyInfrastructureOptimizations(recommendation));
        break;
      case 'application':
        changes.push(...await this.applyApplicationOptimizations(recommendation));
        break;
      case 'database':
        changes.push(...await this.applyDatabaseOptimizations(recommendation));
        break;
      case 'cache':
        changes.push(...await this.applyCacheOptimizations(recommendation));
        break;
      case 'network':
        changes.push(...await this.applyNetworkOptimizations(recommendation));
        break;
    }
    
    return changes;
  }

  private async applyInfrastructureOptimizations(recommendation: TuningRecommendation): Promise<OptimizationChange[]> {
    // Mock infrastructure optimizations
    const changes: OptimizationChange[] = [
      {
        type: 'infrastructure',
        component: 'compute',
        parameter: 'instance_count',
        oldValue: 3,
        newValue: 4,
        rollbackValue: 3
      }
    ];
    
    // Would integrate with actual infrastructure APIs (AWS, GCP, Azure)
    logger.info('Applied infrastructure optimization:', changes);
    
    return changes;
  }

  private async applyApplicationOptimizations(recommendation: TuningRecommendation): Promise<OptimizationChange[]> {
    // Mock application optimizations
    const changes: OptimizationChange[] = [
      {
        type: 'config',
        component: 'app',
        parameter: 'max_connections',
        oldValue: 100,
        newValue: 150,
        rollbackValue: 100
      }
    ];
    
    logger.info('Applied application optimization:', changes);
    
    return changes;
  }

  private async applyDatabaseOptimizations(recommendation: TuningRecommendation): Promise<OptimizationChange[]> {
    // Mock database optimizations
    const changes: OptimizationChange[] = [
      {
        type: 'config',
        component: 'database',
        parameter: 'connection_pool_size',
        oldValue: 20,
        newValue: 30,
        rollbackValue: 20
      }
    ];
    
    logger.info('Applied database optimization:', changes);
    
    return changes;
  }

  private async applyCacheOptimizations(recommendation: TuningRecommendation): Promise<OptimizationChange[]> {
    // Use the advanced cache system
    const changes: OptimizationChange[] = [];
    
    // Example: Optimize cache configuration
    if (recommendation.title.includes('cache')) {
      // Would use this.cacheSystem to apply optimizations
      changes.push({
        type: 'cache',
        component: 'redis',
        parameter: 'max_memory_policy',
        oldValue: 'allkeys-lru',
        newValue: 'allkeys-lfu',
        rollbackValue: 'allkeys-lru'
      });
    }
    
    logger.info('Applied cache optimization:', changes);
    
    return changes;
  }

  private async applyNetworkOptimizations(recommendation: TuningRecommendation): Promise<OptimizationChange[]> {
    // Mock network optimizations
    const changes: OptimizationChange[] = [
      {
        type: 'config',
        component: 'network',
        parameter: 'keep_alive_timeout',
        oldValue: 30,
        newValue: 60,
        rollbackValue: 30
      }
    ];
    
    logger.info('Applied network optimization:', changes);
    
    return changes;
  }

  private async rollbackOptimization(optimizationId: string): Promise<void> {
    const optimization = this.activeOptimizations.get(optimizationId) ||
                        this.optimizationHistory.find(opt => opt.optimizationId === optimizationId);
    
    if (!optimization) {
      logger.warn(`Cannot rollback optimization ${optimizationId} - not found`);
      return;
    }
    
    logger.info(`Rolling back optimization ${optimizationId}`);
    
    // Rollback changes in reverse order
    for (const change of optimization.appliedChanges.reverse()) {
      await this.rollbackChange(change);
    }
    
    logger.info(`Successfully rolled back optimization ${optimizationId}`);
  }

  private async rollbackChange(change: OptimizationChange): Promise<void> {
    // Mock rollback implementation
    logger.debug('Rolling back change:', {
      component: change.component,
      parameter: change.parameter,
      from: change.newValue,
      to: change.rollbackValue
    });
    
    // Would implement actual rollback logic here
  }

  private async waitForStabilization(): Promise<void> {
    // Wait for system to stabilize after changes
    await new Promise(resolve => setTimeout(resolve, 60000)); // 1 minute
  }

  private async takePerformanceSnapshot(): Promise<PerformanceSnapshot> {
    // Mock performance snapshot
    return {
      timestamp: new Date(),
      metrics: {
        responseTime: { p50: 100, p95: 300, p99: 500 },
        throughput: 1000,
        errorRate: 0.01,
        cpuUtilization: 60,
        memoryUtilization: 70,
        networkLatency: 50,
        diskIo: 100
      },
      resourceUsage: {
        instances: 3,
        totalCpu: 12,
        totalMemory: 48,
        storageUsed: 500
      }
    };
  }

  private calculateImprovement(before: PerformanceSnapshot, after: PerformanceSnapshot): Record<string, number> {
    return {
      responseTimeP95: ((before.metrics.responseTime.p95 - after.metrics.responseTime.p95) / before.metrics.responseTime.p95) * 100,
      throughput: ((after.metrics.throughput - before.metrics.throughput) / before.metrics.throughput) * 100,
      errorRate: ((before.metrics.errorRate - after.metrics.errorRate) / before.metrics.errorRate) * 100,
      cpuUtilization: ((before.metrics.cpuUtilization - after.metrics.cpuUtilization) / before.metrics.cpuUtilization) * 100
    };
  }

  private validateImprovement(improvement: Record<string, number>): boolean {
    // Check if key metrics improved
    const responseTimeImproved = improvement.responseTimeP95 > 5; // 5% improvement
    const throughputImproved = improvement.throughput > 2; // 2% improvement
    const errorRateImproved = improvement.errorRate > 0; // Any improvement
    
    return responseTimeImproved || throughputImproved || errorRateImproved;
  }

  private calculateRecommendationScore(recommendation: TuningRecommendation): number {
    const priorityWeight = { critical: 10, high: 8, medium: 5, low: 2 };
    const impactWeight = recommendation.expectedImpact.performanceGain * 10;
    const confidenceWeight = recommendation.aiConfidence * 5;
    const riskPenalty = this.getRiskLevel(recommendation.expectedImpact.riskLevel) * -2;
    
    return priorityWeight[recommendation.priority] + impactWeight + confidenceWeight + riskPenalty;
  }

  private async collectCurrentMetrics(): Promise<any> {
    // Collect current performance metrics
    return await this.takePerformanceSnapshot();
  }

  private async getHistoricalPerformanceData(): Promise<any> {
    // Get historical data for trend analysis
    return this.optimizationHistory.slice(-100); // Last 100 optimizations
  }

  private async generateSystemProfile(): Promise<any> {
    // Generate system profile for ML models
    return {
      architecture: 'microservices',
      technology: 'nodejs',
      scale: 'medium',
      traffic_pattern: 'steady'
    };
  }

  private async getRecommendationById(id: string): Promise<TuningRecommendation | null> {
    const recommendations = await this.getRecommendations();
    return recommendations.find(rec => rec.id === id) || null;
  }

  private generateOptimizationId(): string {
    return `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async analyzePerformanceTrends(): Promise<any> {
    // Mock trend analysis
    return {
      responseTime: { trend: 'improving', rate: 0.05 },
      throughput: { trend: 'stable', rate: 0.01 },
      errorRate: { trend: 'improving', rate: -0.02 },
      resourceUtilization: { trend: 'degrading', rate: 0.03 }
    };
  }

  private async identifyBottlenecks(): Promise<any[]> {
    // Mock bottleneck identification
    return [
      {
        component: 'database',
        severity: 'high',
        description: 'Database connection pool exhaustion',
        impact: 0.3
      }
    ];
  }

  private async countOptimizationOpportunities(): Promise<number> {
    const recommendations = await this.getRecommendations();
    return recommendations.length;
  }

  private async monitorSafetyMetrics(): Promise<void> {
    // Monitor system safety metrics
    const snapshot = await this.takePerformanceSnapshot();
    
    if (snapshot.metrics.errorRate > this.config.targetMetrics.errorRate * 2) {
      logger.warn('High error rate detected, triggering safety measures');
      await this.triggerSafetyMeasures('high_error_rate');
    }
    
    if (snapshot.metrics.cpuUtilization > 95) {
      logger.warn('Critical CPU utilization detected');
      await this.triggerSafetyMeasures('high_cpu');
    }
  }

  private async triggerSafetyMeasures(reason: string): Promise<void> {
    // Trigger safety measures (e.g., rollback recent optimizations)
    logger.warn(`Triggering safety measures due to: ${reason}`);
    
    // Rollback recent optimizations if any
    const recentOptimizations = Array.from(this.activeOptimizations.values());
    for (const optimization of recentOptimizations) {
      await this.rollbackOptimization(optimization.optimizationId);
    }
  }

  private async detectPerformanceRegressions(): Promise<void> {
    // Detect performance regressions
    const current = await this.takePerformanceSnapshot();
    const baseline = this.getPerformanceBaseline();
    
    if (baseline && this.isSignificantRegression(current, baseline)) {
      logger.warn('Performance regression detected');
      await this.handlePerformanceRegression(current, baseline);
    }
  }

  private getPerformanceBaseline(): PerformanceSnapshot | null {
    // Get performance baseline from history
    return this.optimizationHistory.length > 0 ? 
           this.optimizationHistory[this.optimizationHistory.length - 1].performanceImpact.before : 
           null;
  }

  private isSignificantRegression(current: PerformanceSnapshot, baseline: PerformanceSnapshot): boolean {
    const responseTimeRegression = (current.metrics.responseTime.p95 / baseline.metrics.responseTime.p95) > 1.2;
    const throughputRegression = (baseline.metrics.throughput / current.metrics.throughput) > 1.1;
    const errorRateRegression = (current.metrics.errorRate / baseline.metrics.errorRate) > 2;
    
    return responseTimeRegression || throughputRegression || errorRateRegression;
  }

  private async handlePerformanceRegression(current: PerformanceSnapshot, baseline: PerformanceSnapshot): Promise<void> {
    // Handle performance regression
    this.emit('performanceRegression', { current, baseline });
    
    // Auto-rollback recent optimizations
    await this.triggerSafetyMeasures('performance_regression');
  }
}

// Supporting classes
class MLOptimizer {
  async generateRecommendations(context: any): Promise<TuningRecommendation[]> {
    // Mock ML-based recommendations
    return [
      {
        id: `rec_${Date.now()}`,
        category: 'infrastructure',
        priority: 'high',
        title: 'Increase instance count',
        description: 'Scale up compute instances to handle increased load',
        expectedImpact: {
          performanceGain: 0.25,
          costImpact: 100,
          riskLevel: 'low',
          implementationEffort: 'low'
        },
        implementation: {
          steps: ['Update instance count in configuration', 'Deploy changes'],
          rollbackPlan: ['Revert instance count', 'Verify system stability'],
          testingRequirements: ['Load test', 'Monitor for 1 hour'],
          monitoringChanges: ['Add instance count alerts']
        },
        aiConfidence: 0.85,
        validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      }
    ];
  }
}

class SafetyGuards {
  constructor(private constraints: any) {}
  
  validateRecommendation(recommendation: TuningRecommendation): boolean {
    // Validate recommendation against safety constraints
    if (recommendation.expectedImpact.costImpact > this.constraints.budgetLimit) {
      return false;
    }
    
    if (recommendation.expectedImpact.riskLevel === 'high' && recommendation.aiConfidence < 0.8) {
      return false;
    }
    
    return true;
  }
}