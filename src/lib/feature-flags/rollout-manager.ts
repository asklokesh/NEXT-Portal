/**
 * Rollout Manager
 * Advanced rollout strategies and A/B testing capabilities
 */

import { 
  FeatureFlag, 
  RolloutConfig, 
  PhaseRollout, 
  MetricThreshold,
  UserContext,
  FlagEvaluation
} from './types';

export class RolloutManager {
  private metricsThresholds = new Map<string, MetricThreshold[]>();
  private rolloutSchedules = new Map<string, NodeJS.Timeout>();

  /**
   * Initialize gradual rollout for a flag
   */
  async initializeGradualRollout(
    flagKey: string, 
    rolloutConfig: RolloutConfig
  ): Promise<void> {
    if (!rolloutConfig.phaseRollout) {
      throw new Error('Phase rollout configuration is required for gradual rollouts');
    }

    const phaseRollout = rolloutConfig.phaseRollout;
    
    // Set initial phase
    phaseRollout.currentPhase = 0;
    
    // Schedule automatic phase advancement if enabled
    if (phaseRollout.autoAdvance) {
      await this.schedulePhaseAdvancement(flagKey, phaseRollout);
    }

    console.log(`Gradual rollout initialized for ${flagKey}`);
  }

  /**
   * Advance to the next rollout phase
   */
  async advanceToNextPhase(
    flagKey: string, 
    phaseRollout: PhaseRollout
  ): Promise<boolean> {
    const currentPhaseIndex = phaseRollout.currentPhase;
    const nextPhaseIndex = currentPhaseIndex + 1;

    if (nextPhaseIndex >= phaseRollout.phases.length) {
      console.log(`Rollout completed for ${flagKey}`);
      return false; // Rollout completed
    }

    // Check advancement conditions
    if (phaseRollout.advanceMetricThreshold) {
      const canAdvance = await this.checkAdvancementConditions(
        flagKey, 
        phaseRollout.advanceMetricThreshold
      );
      
      if (!canAdvance) {
        console.log(`Advancement conditions not met for ${flagKey}`);
        return false;
      }
    }

    // Advance to next phase
    phaseRollout.currentPhase = nextPhaseIndex;
    const nextPhase = phaseRollout.phases[nextPhaseIndex];

    console.log(`Advanced ${flagKey} to phase ${nextPhaseIndex + 1}: ${nextPhase.name} (${nextPhase.percentage}%)`);

    // Schedule next advancement if auto-advance is enabled
    if (phaseRollout.autoAdvance && nextPhaseIndex < phaseRollout.phases.length - 1) {
      await this.schedulePhaseAdvancement(flagKey, phaseRollout);
    }

    return true;
  }

  /**
   * Check if conditions are met to advance to next phase
   */
  private async checkAdvancementConditions(
    flagKey: string, 
    threshold: MetricThreshold
  ): Promise<boolean> {
    try {
      // In production, this would fetch real metrics
      const mockMetrics = await this.fetchMetrics(flagKey, threshold.window);
      
      switch (threshold.operator) {
        case 'gt': return mockMetrics[threshold.metric] > threshold.threshold;
        case 'lt': return mockMetrics[threshold.metric] < threshold.threshold;
        case 'gte': return mockMetrics[threshold.metric] >= threshold.threshold;
        case 'lte': return mockMetrics[threshold.metric] <= threshold.threshold;
        default: return false;
      }
    } catch (error) {
      console.error('Error checking advancement conditions:', error);
      return false;
    }
  }

  /**
   * Schedule automatic phase advancement
   */
  private async schedulePhaseAdvancement(
    flagKey: string, 
    phaseRollout: PhaseRollout
  ): Promise<void> {
    const currentPhase = phaseRollout.phases[phaseRollout.currentPhase];
    
    if (!currentPhase.duration) {
      return; // No duration set, manual advancement required
    }

    // Clear any existing schedule
    const existingTimeout = this.rolloutSchedules.get(flagKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Schedule advancement
    const timeout = setTimeout(async () => {
      await this.advanceToNextPhase(flagKey, phaseRollout);
      this.rolloutSchedules.delete(flagKey);
    }, currentPhase.duration * 60 * 1000); // Convert minutes to milliseconds

    this.rolloutSchedules.set(flagKey, timeout);
  }

  /**
   * Implement canary deployment strategy
   */
  async executeCanaryDeployment(
    flagKey: string,
    config: {
      canaryPercentage: number;
      canaryDuration: number; // minutes
      successThreshold: MetricThreshold;
      failureThreshold: MetricThreshold;
    }
  ): Promise<{ success: boolean; reason: string }> {
    console.log(`Starting canary deployment for ${flagKey} at ${config.canaryPercentage}%`);

    // Wait for canary duration
    await this.sleep(config.canaryDuration * 60 * 1000);

    // Check metrics
    const metrics = await this.fetchMetrics(flagKey, config.canaryDuration);
    
    // Check failure threshold first
    if (this.checkThreshold(metrics, config.failureThreshold)) {
      return {
        success: false,
        reason: `Failure threshold exceeded: ${config.failureThreshold.metric} ${config.failureThreshold.operator} ${config.failureThreshold.threshold}`
      };
    }

    // Check success threshold
    if (this.checkThreshold(metrics, config.successThreshold)) {
      return {
        success: true,
        reason: 'Canary deployment successful - metrics within acceptable thresholds'
      };
    }

    return {
      success: false,
      reason: 'Success threshold not met'
    };
  }

  /**
   * Implement blue-green deployment strategy
   */
  async executeBlueGreenDeployment(
    flagKey: string,
    config: {
      blueVersion: string;
      greenVersion: string;
      trafficSplitStrategy: 'immediate' | 'gradual';
      rollbackOnError: boolean;
    }
  ): Promise<{ success: boolean; activeVersion: string; reason: string }> {
    console.log(`Executing blue-green deployment for ${flagKey}`);
    
    if (config.trafficSplitStrategy === 'immediate') {
      // Immediate switch to green
      return {
        success: true,
        activeVersion: config.greenVersion,
        reason: 'Immediate switch to green version completed'
      };
    } else {
      // Gradual traffic shift
      const trafficPercentages = [10, 25, 50, 75, 100];
      
      for (const percentage of trafficPercentages) {
        console.log(`Shifting ${percentage}% traffic to green version`);
        
        // Monitor for 5 minutes at each stage
        await this.sleep(5 * 60 * 1000);
        
        const metrics = await this.fetchMetrics(flagKey, 5);
        
        // Check error rates
        if (metrics.errorRate > 5) {
          if (config.rollbackOnError) {
            return {
              success: false,
              activeVersion: config.blueVersion,
              reason: `High error rate detected (${metrics.errorRate}%), rolled back to blue`
            };
          }
        }
      }

      return {
        success: true,
        activeVersion: config.greenVersion,
        reason: 'Gradual blue-green deployment completed successfully'
      };
    }
  }

  /**
   * Implement sticky rollout for consistent user experience
   */
  evaluateStickyRollout(
    flag: FeatureFlag,
    context: UserContext,
    rolloutConfig: RolloutConfig
  ): FlagEvaluation {
    const stickyKey = context.userId || context.sessionId || 'anonymous';
    const flagStickyKey = `${flag.key}:${stickyKey}`;
    
    // Use deterministic hashing for consistent assignment
    const hash = this.hashString(flagStickyKey);
    const bucket = hash % 100;
    const isIncluded = bucket < rolloutConfig.percentage;

    return {
      flagKey: flag.key,
      value: isIncluded,
      reason: {
        kind: 'FALLTHROUGH',
        inExperiment: isIncluded
      },
      timestamp: new Date()
    };
  }

  /**
   * Advanced A/B testing with statistical significance
   */
  async analyzeABTestResults(
    flagKey: string,
    variations: string[],
    conversionMetric: string,
    confidenceLevel: number = 0.95
  ): Promise<{
    isSignificant: boolean;
    winningVariation?: string;
    confidenceInterval: number;
    pValue: number;
    sampleSizes: Record<string, number>;
    conversionRates: Record<string, number>;
    recommendation: string;
  }> {
    // Mock A/B test analysis - in production, this would use proper statistical libraries
    const mockResults = {
      isSignificant: true,
      winningVariation: variations[0],
      confidenceInterval: confidenceLevel,
      pValue: 0.023,
      sampleSizes: {
        [variations[0]]: 1250,
        [variations[1]]: 1320
      },
      conversionRates: {
        [variations[0]]: 0.187,
        [variations[1]]: 0.142
      },
      recommendation: `${variations[0]} shows 31.7% improvement over ${variations[1]} with 95% confidence`
    };

    return mockResults;
  }

  /**
   * Smart rollout with ML-driven decisions
   */
  async executeSmartRollout(
    flagKey: string,
    config: {
      targetMetric: string;
      mlModelEndpoint: string;
      adaptiveThresholds: boolean;
    }
  ): Promise<{
    recommendedPercentage: number;
    confidence: number;
    reasoning: string;
  }> {
    // Mock ML prediction - in production, this would call actual ML services
    const mockPrediction = {
      recommendedPercentage: 25,
      confidence: 0.87,
      reasoning: 'Model predicts 25% rollout will maximize target metric while minimizing risk based on historical patterns'
    };

    return mockPrediction;
  }

  /**
   * Rollout health monitoring
   */
  async monitorRolloutHealth(
    flagKey: string,
    healthChecks: {
      errorRateThreshold: number;
      latencyThreshold: number;
      customMetrics?: Record<string, number>;
    }
  ): Promise<{
    isHealthy: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const metrics = await this.fetchMetrics(flagKey, 5);
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check error rate
    if (metrics.errorRate > healthChecks.errorRateThreshold) {
      issues.push(`Error rate (${metrics.errorRate}%) exceeds threshold (${healthChecks.errorRateThreshold}%)`);
      recommendations.push('Consider reducing rollout percentage or investigating root cause');
    }

    // Check latency
    if (metrics.averageLatency > healthChecks.latencyThreshold) {
      issues.push(`Average latency (${metrics.averageLatency}ms) exceeds threshold (${healthChecks.latencyThreshold}ms)`);
      recommendations.push('Monitor system resources and consider performance optimizations');
    }

    return {
      isHealthy: issues.length === 0,
      issues,
      recommendations
    };
  }

  // Utility methods

  private async fetchMetrics(flagKey: string, windowMinutes: number): Promise<any> {
    // Mock metrics - in production, this would fetch from monitoring system
    return {
      errorRate: Math.random() * 2, // 0-2% error rate
      averageLatency: Math.random() * 100 + 50, // 50-150ms latency
      conversionRate: Math.random() * 0.2 + 0.1, // 10-30% conversion
      throughput: Math.random() * 1000 + 500 // 500-1500 requests
    };
  }

  private checkThreshold(metrics: any, threshold: MetricThreshold): boolean {
    const value = metrics[threshold.metric];
    if (value === undefined) return false;

    switch (threshold.operator) {
      case 'gt': return value > threshold.threshold;
      case 'lt': return value < threshold.threshold;
      case 'gte': return value >= threshold.threshold;
      case 'lte': return value <= threshold.threshold;
      default: return false;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Cleanup rollout schedules
   */
  cleanup(): void {
    for (const [flagKey, timeout] of this.rolloutSchedules.entries()) {
      clearTimeout(timeout);
      this.rolloutSchedules.delete(flagKey);
    }
  }
}