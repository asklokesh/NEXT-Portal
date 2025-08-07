/**
 * Feature Flag Metrics Collector
 * Comprehensive metrics collection and analysis for feature flags
 */

import { FlagMetrics, FlagEvaluation, LatencyMetrics, BusinessMetrics } from './types';

export class MetricsCollector {
  private metricsStore = new Map<string, FlagMetrics[]>();
  private evaluationCounts = new Map<string, number>();
  private errorCounts = new Map<string, number>();
  private latencyHistory = new Map<string, number[]>();

  /**
   * Record a flag evaluation
   */
  async recordEvaluation(
    flagKey: string, 
    evaluation: FlagEvaluation, 
    duration: number
  ): Promise<void> {
    const timestamp = new Date();
    
    // Update evaluation count
    const currentCount = this.evaluationCounts.get(flagKey) || 0;
    this.evaluationCounts.set(flagKey, currentCount + 1);

    // Record latency
    const latencies = this.latencyHistory.get(flagKey) || [];
    latencies.push(duration);
    
    // Keep only last 1000 latency measurements per flag
    if (latencies.length > 1000) {
      latencies.shift();
    }
    
    this.latencyHistory.set(flagKey, latencies);

    // Get or create metrics entry
    const flagMetrics = this.getOrCreateMetrics(flagKey, timestamp);
    
    // Update variation counts
    if (evaluation.variation) {
      flagMetrics.variations[evaluation.variation] = 
        (flagMetrics.variations[evaluation.variation] || 0) + 1;
    } else {
      const variationKey = evaluation.value ? 'true' : 'false';
      flagMetrics.variations[variationKey] = 
        (flagMetrics.variations[variationKey] || 0) + 1;
    }

    flagMetrics.evaluations++;
    flagMetrics.latency = this.calculateLatencyMetrics(latencies);
  }

  /**
   * Record an evaluation error
   */
  async recordError(flagKey: string, error: Error, duration?: number): Promise<void> {
    const currentErrors = this.errorCounts.get(flagKey) || 0;
    this.errorCounts.set(flagKey, currentErrors + 1);

    if (duration) {
      const latencies = this.latencyHistory.get(flagKey) || [];
      latencies.push(duration);
      this.latencyHistory.set(flagKey, latencies);
    }

    // Update error rate in metrics
    const flagMetrics = this.getOrCreateMetrics(flagKey, new Date());
    const totalEvaluations = this.evaluationCounts.get(flagKey) || 0;
    const totalErrors = this.errorCounts.get(flagKey) || 0;
    
    flagMetrics.errorRate = totalEvaluations > 0 ? (totalErrors / totalEvaluations) * 100 : 0;

    console.error(`Flag evaluation error for ${flagKey}:`, error);
  }

  /**
   * Record business metrics
   */
  async recordBusinessMetric(
    flagKey: string, 
    metricName: string, 
    value: number
  ): Promise<void> {
    const flagMetrics = this.getOrCreateMetrics(flagKey, new Date());
    
    if (!flagMetrics.businessMetrics) {
      flagMetrics.businessMetrics = {};
    }

    // Common business metrics
    switch (metricName) {
      case 'conversion':
        flagMetrics.businessMetrics.conversionRate = value;
        break;
      case 'revenue':
        flagMetrics.businessMetrics.revenue = value;
        break;
      case 'ctr':
        flagMetrics.businessMetrics.clickThroughRate = value;
        break;
      case 'bounce':
        flagMetrics.businessMetrics.bounceRate = value;
        break;
      default:
        if (!flagMetrics.businessMetrics.customMetrics) {
          flagMetrics.businessMetrics.customMetrics = {};
        }
        flagMetrics.businessMetrics.customMetrics[metricName] = value;
    }
  }

  /**
   * Get metrics for a specific flag
   */
  async getFlagMetrics(
    flagKey: string, 
    timeRange: { start: Date; end: Date }
  ): Promise<FlagMetrics[]> {
    const flagMetrics = this.metricsStore.get(flagKey) || [];
    
    return flagMetrics.filter(metric =>
      metric.timestamp >= timeRange.start && 
      metric.timestamp <= timeRange.end
    );
  }

  /**
   * Get aggregated metrics for multiple flags
   */
  async getAggregatedMetrics(
    flagKeys: string[],
    timeRange: { start: Date; end: Date }
  ): Promise<{
    totalEvaluations: number;
    averageLatency: number;
    errorRate: number;
    flagBreakdown: Record<string, {
      evaluations: number;
      errorRate: number;
      averageLatency: number;
    }>;
  }> {
    let totalEvaluations = 0;
    let totalErrors = 0;
    const allLatencies: number[] = [];
    const flagBreakdown: Record<string, any> = {};

    for (const flagKey of flagKeys) {
      const metrics = await this.getFlagMetrics(flagKey, timeRange);
      const evaluations = metrics.reduce((sum, m) => sum + m.evaluations, 0);
      const errors = metrics.reduce((sum, m) => sum + (m.errorRate * m.evaluations / 100), 0);
      const latencies = this.latencyHistory.get(flagKey) || [];

      totalEvaluations += evaluations;
      totalErrors += errors;
      allLatencies.push(...latencies);

      flagBreakdown[flagKey] = {
        evaluations,
        errorRate: evaluations > 0 ? (errors / evaluations) * 100 : 0,
        averageLatency: this.calculateAverageLatency(latencies)
      };
    }

    return {
      totalEvaluations,
      averageLatency: this.calculateAverageLatency(allLatencies),
      errorRate: totalEvaluations > 0 ? (totalErrors / totalEvaluations) * 100 : 0,
      flagBreakdown
    };
  }

  /**
   * Get performance trends over time
   */
  async getPerformanceTrends(
    flagKey: string,
    intervalMinutes: number = 60
  ): Promise<{
    timestamps: Date[];
    evaluations: number[];
    errorRates: number[];
    latencies: number[];
  }> {
    const metrics = this.metricsStore.get(flagKey) || [];
    
    // Group metrics by time intervals
    const intervals = new Map<string, FlagMetrics[]>();
    
    metrics.forEach(metric => {
      const intervalKey = this.getIntervalKey(metric.timestamp, intervalMinutes);
      const intervalMetrics = intervals.get(intervalKey) || [];
      intervalMetrics.push(metric);
      intervals.set(intervalKey, intervalMetrics);
    });

    const timestamps: Date[] = [];
    const evaluations: number[] = [];
    const errorRates: number[] = [];
    const latencies: number[] = [];

    Array.from(intervals.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([intervalKey, intervalMetrics]) => {
        timestamps.push(new Date(intervalKey));
        evaluations.push(intervalMetrics.reduce((sum, m) => sum + m.evaluations, 0));
        
        const totalEvaluations = intervalMetrics.reduce((sum, m) => sum + m.evaluations, 0);
        const weightedErrorRate = intervalMetrics.reduce(
          (sum, m) => sum + (m.errorRate * m.evaluations), 0
        );
        errorRates.push(totalEvaluations > 0 ? weightedErrorRate / totalEvaluations : 0);
        
        const allLatencies = intervalMetrics.map(m => m.latency.avg);
        latencies.push(allLatencies.reduce((sum, l) => sum + l, 0) / allLatencies.length);
      });

    return { timestamps, evaluations, errorRates, latencies };
  }

  /**
   * Detect anomalies in flag behavior
   */
  async detectAnomalies(flagKey: string): Promise<{
    hasAnomalies: boolean;
    anomalies: {
      type: 'high_error_rate' | 'high_latency' | 'evaluation_spike' | 'evaluation_drop';
      severity: 'low' | 'medium' | 'high';
      description: string;
      timestamp: Date;
      value: number;
      threshold: number;
    }[];
  }> {
    const anomalies: any[] = [];
    const metrics = this.metricsStore.get(flagKey) || [];
    
    if (metrics.length < 10) {
      return { hasAnomalies: false, anomalies: [] };
    }

    // Get recent metrics (last hour)
    const recentMetrics = metrics
      .filter(m => m.timestamp.getTime() > Date.now() - 3600000)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    if (recentMetrics.length < 5) {
      return { hasAnomalies: false, anomalies: [] };
    }

    // Calculate baselines from historical data
    const historicalMetrics = metrics
      .filter(m => m.timestamp.getTime() <= Date.now() - 3600000)
      .slice(-100); // Last 100 historical points

    if (historicalMetrics.length < 10) {
      return { hasAnomalies: false, anomalies: [] };
    }

    const baselineErrorRate = this.calculateAverage(
      historicalMetrics.map(m => m.errorRate)
    );
    const baselineLatency = this.calculateAverage(
      historicalMetrics.map(m => m.latency.avg)
    );
    const baselineEvaluations = this.calculateAverage(
      historicalMetrics.map(m => m.evaluations)
    );

    // Check for anomalies
    recentMetrics.forEach(metric => {
      // High error rate anomaly
      if (metric.errorRate > baselineErrorRate * 3 && metric.errorRate > 5) {
        anomalies.push({
          type: 'high_error_rate',
          severity: metric.errorRate > 25 ? 'high' : 'medium',
          description: `Error rate (${metric.errorRate.toFixed(2)}%) is ${(metric.errorRate / baselineErrorRate).toFixed(1)}x higher than baseline`,
          timestamp: metric.timestamp,
          value: metric.errorRate,
          threshold: baselineErrorRate * 3
        });
      }

      // High latency anomaly
      if (metric.latency.avg > baselineLatency * 2 && metric.latency.avg > 100) {
        anomalies.push({
          type: 'high_latency',
          severity: metric.latency.avg > 1000 ? 'high' : 'medium',
          description: `Average latency (${metric.latency.avg.toFixed(0)}ms) is ${(metric.latency.avg / baselineLatency).toFixed(1)}x higher than baseline`,
          timestamp: metric.timestamp,
          value: metric.latency.avg,
          threshold: baselineLatency * 2
        });
      }

      // Evaluation spike anomaly
      if (metric.evaluations > baselineEvaluations * 5) {
        anomalies.push({
          type: 'evaluation_spike',
          severity: metric.evaluations > baselineEvaluations * 10 ? 'high' : 'medium',
          description: `Evaluation count (${metric.evaluations}) is ${(metric.evaluations / baselineEvaluations).toFixed(1)}x higher than baseline`,
          timestamp: metric.timestamp,
          value: metric.evaluations,
          threshold: baselineEvaluations * 5
        });
      }

      // Evaluation drop anomaly
      if (metric.evaluations < baselineEvaluations * 0.1 && baselineEvaluations > 100) {
        anomalies.push({
          type: 'evaluation_drop',
          severity: metric.evaluations < baselineEvaluations * 0.05 ? 'high' : 'medium',
          description: `Evaluation count (${metric.evaluations}) dropped to ${((metric.evaluations / baselineEvaluations) * 100).toFixed(1)}% of baseline`,
          timestamp: metric.timestamp,
          value: metric.evaluations,
          threshold: baselineEvaluations * 0.1
        });
      }
    });

    return {
      hasAnomalies: anomalies.length > 0,
      anomalies: anomalies.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    };
  }

  /**
   * Generate performance report
   */
  async generatePerformanceReport(
    flagKeys: string[],
    timeRange: { start: Date; end: Date }
  ): Promise<{
    summary: {
      totalFlags: number;
      totalEvaluations: number;
      averageErrorRate: number;
      averageLatency: number;
    };
    flagDetails: {
      flagKey: string;
      evaluations: number;
      errorRate: number;
      latency: LatencyMetrics;
      variationDistribution: Record<string, number>;
      businessMetrics?: BusinessMetrics;
    }[];
    recommendations: string[];
  }> {
    const flagDetails: any[] = [];
    let totalEvaluations = 0;
    let totalErrors = 0;
    const allLatencies: number[] = [];

    for (const flagKey of flagKeys) {
      const metrics = await this.getFlagMetrics(flagKey, timeRange);
      const evaluations = metrics.reduce((sum, m) => sum + m.evaluations, 0);
      const errors = metrics.reduce((sum, m) => sum + (m.errorRate * m.evaluations / 100), 0);
      const errorRate = evaluations > 0 ? (errors / evaluations) * 100 : 0;
      
      const latencies = this.latencyHistory.get(flagKey) || [];
      allLatencies.push(...latencies);
      
      const latencyMetrics = this.calculateLatencyMetrics(latencies);
      
      // Calculate variation distribution
      const variationDistribution: Record<string, number> = {};
      metrics.forEach(metric => {
        Object.entries(metric.variations).forEach(([variation, count]) => {
          variationDistribution[variation] = (variationDistribution[variation] || 0) + count;
        });
      });

      // Get latest business metrics
      const latestMetric = metrics[metrics.length - 1];
      const businessMetrics = latestMetric?.businessMetrics;

      flagDetails.push({
        flagKey,
        evaluations,
        errorRate,
        latency: latencyMetrics,
        variationDistribution,
        businessMetrics
      });

      totalEvaluations += evaluations;
      totalErrors += errors;
    }

    const averageErrorRate = totalEvaluations > 0 ? (totalErrors / totalEvaluations) * 100 : 0;
    const averageLatency = this.calculateAverageLatency(allLatencies);

    // Generate recommendations
    const recommendations: string[] = [];
    
    flagDetails.forEach(detail => {
      if (detail.errorRate > 5) {
        recommendations.push(
          `Flag "${detail.flagKey}" has high error rate (${detail.errorRate.toFixed(2)}%). Consider reviewing targeting rules.`
        );
      }
      
      if (detail.latency.avg > 200) {
        recommendations.push(
          `Flag "${detail.flagKey}" has high latency (${detail.latency.avg.toFixed(0)}ms). Consider caching or simplifying evaluation logic.`
        );
      }
      
      if (detail.evaluations === 0) {
        recommendations.push(
          `Flag "${detail.flagKey}" has no evaluations. Consider archiving if no longer needed.`
        );
      }
    });

    if (averageErrorRate > 2) {
      recommendations.push(
        'Overall error rate is elevated. Review flag configurations and monitoring setup.'
      );
    }

    return {
      summary: {
        totalFlags: flagKeys.length,
        totalEvaluations,
        averageErrorRate,
        averageLatency
      },
      flagDetails: flagDetails.sort((a, b) => b.evaluations - a.evaluations),
      recommendations
    };
  }

  // Private helper methods

  private getOrCreateMetrics(flagKey: string, timestamp: Date): FlagMetrics {
    const flagMetrics = this.metricsStore.get(flagKey) || [];
    
    // Find existing metrics entry for the current minute
    const currentMinute = new Date(timestamp);
    currentMinute.setSeconds(0, 0);
    
    let existingMetric = flagMetrics.find(m => 
      m.timestamp.getTime() === currentMinute.getTime()
    );

    if (!existingMetric) {
      existingMetric = {
        flagKey,
        timestamp: currentMinute,
        evaluations: 0,
        variations: {},
        errorRate: 0,
        latency: { p50: 0, p90: 0, p95: 0, p99: 0, avg: 0 }
      };
      flagMetrics.push(existingMetric);
      this.metricsStore.set(flagKey, flagMetrics);
    }

    return existingMetric;
  }

  private calculateLatencyMetrics(latencies: number[]): LatencyMetrics {
    if (latencies.length === 0) {
      return { p50: 0, p90: 0, p95: 0, p99: 0, avg: 0 };
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const length = sorted.length;

    return {
      p50: sorted[Math.floor(length * 0.5)],
      p90: sorted[Math.floor(length * 0.9)],
      p95: sorted[Math.floor(length * 0.95)],
      p99: sorted[Math.floor(length * 0.99)],
      avg: sorted.reduce((sum, l) => sum + l, 0) / length
    };
  }

  private calculateAverageLatency(latencies: number[]): number {
    if (latencies.length === 0) return 0;
    return latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private getIntervalKey(timestamp: Date, intervalMinutes: number): string {
    const interval = Math.floor(timestamp.getTime() / (intervalMinutes * 60000)) * (intervalMinutes * 60000);
    return new Date(interval).toISOString();
  }
}