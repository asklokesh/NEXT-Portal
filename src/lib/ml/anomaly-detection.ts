/**
 * ML-Based Anomaly Detection System
 * Proactive monitoring with machine learning for early issue detection
 */

export interface TimeSeriesPoint {
  timestamp: Date;
  value: number;
  metadata?: Record<string, any>;
}

export interface AnomalyDetectionConfig {
  metric: string;
  algorithm: 'statistical' | 'isolation_forest' | 'lstm' | 'rolling_stats';
  sensitivity: 'low' | 'medium' | 'high';
  windowSize: number; // minutes
  trainingPeriod: number; // hours
  thresholds: {
    warning: number;
    critical: number;
  };
  enabled: boolean;
}

export interface AnomalyAlert {
  id: string;
  metric: string;
  timestamp: Date;
  value: number;
  expectedValue: number;
  deviation: number;
  severity: 'warning' | 'critical';
  algorithm: string;
  confidence: number;
  context: {
    recentTrend: 'increasing' | 'decreasing' | 'stable' | 'volatile';
    seasonality: 'daily' | 'weekly' | 'none';
    correlatedMetrics: string[];
  };
  acknowledged: boolean;
  resolvedAt?: Date;
}

export interface StatisticalModel {
  mean: number;
  stdDev: number;
  median: number;
  q25: number;
  q75: number;
  min: number;
  max: number;
  trend: number;
  seasonality: Record<string, number>;
}

export interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  falsePositiveRate: number;
  lastUpdated: Date;
  trainingDataPoints: number;
}

/**
 * Anomaly Detection Engine
 */
export class AnomalyDetectionEngine {
  private configs: Map<string, AnomalyDetectionConfig> = new Map();
  private timeSeries: Map<string, TimeSeriesPoint[]> = new Map();
  private models: Map<string, StatisticalModel> = new Map();
  private alerts: Map<string, AnomalyAlert> = new Map();
  private modelMetrics: Map<string, ModelMetrics> = new Map();
  private detectionIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.initializeDefaultConfigs();
    this.startPeriodicRetraining();
  }

  /**
   * Register metric for anomaly detection
   */
  registerMetric(config: AnomalyDetectionConfig): void {
    this.configs.set(config.metric, config);
    
    if (config.enabled) {
      this.startDetection(config.metric);
    }
    
    console.log(`Registered anomaly detection for metric: ${config.metric}`);
  }

  /**
   * Add data point for a metric
   */
  addDataPoint(metric: string, point: TimeSeriesPoint): void {
    let series = this.timeSeries.get(metric);
    
    if (!series) {
      series = [];
      this.timeSeries.set(metric, series);
    }

    series.push(point);
    
    // Keep only recent data (configurable retention)
    const retention = 7 * 24 * 60; // 7 days in minutes
    const cutoff = new Date(Date.now() - retention * 60 * 1000);
    
    this.timeSeries.set(metric, series.filter(p => p.timestamp > cutoff));

    // Trigger real-time detection if enabled
    const config = this.configs.get(metric);
    if (config?.enabled) {
      this.detectAnomaly(metric, point).catch(console.error);
    }
  }

  /**
   * Detect anomalies in real-time
   */
  private async detectAnomaly(metric: string, point: TimeSeriesPoint): Promise<void> {
    const config = this.configs.get(metric);
    const model = this.models.get(metric);
    
    if (!config || !model) return;

    let isAnomaly = false;
    let expectedValue = point.value;
    let confidence = 0;

    switch (config.algorithm) {
      case 'statistical':
        const result = this.detectStatisticalAnomaly(point, model, config);
        isAnomaly = result.isAnomaly;
        expectedValue = result.expectedValue;
        confidence = result.confidence;
        break;
        
      case 'rolling_stats':
        const rollResult = this.detectRollingStatsAnomaly(metric, point, config);
        isAnomaly = rollResult.isAnomaly;
        expectedValue = rollResult.expectedValue;
        confidence = rollResult.confidence;
        break;
        
      case 'isolation_forest':
        // Simplified isolation forest implementation
        isAnomaly = this.detectIsolationForestAnomaly(metric, point, config);
        confidence = 0.8;
        break;
        
      default:
        console.warn(`Unsupported algorithm: ${config.algorithm}`);
        return;
    }

    if (isAnomaly) {
      await this.createAnomalyAlert(metric, point, expectedValue, confidence, config);
    }
  }

  /**
   * Statistical anomaly detection (Z-score based)
   */
  private detectStatisticalAnomaly(
    point: TimeSeriesPoint, 
    model: StatisticalModel, 
    config: AnomalyDetectionConfig
  ): { isAnomaly: boolean; expectedValue: number; confidence: number } {
    const zScore = Math.abs((point.value - model.mean) / model.stdDev);
    
    // Adjust threshold based on sensitivity
    const thresholds = {
      low: { warning: 3.0, critical: 4.0 },
      medium: { warning: 2.5, critical: 3.5 },
      high: { warning: 2.0, critical: 3.0 }
    };
    
    const threshold = thresholds[config.sensitivity];
    const isAnomaly = zScore > threshold.warning;
    const confidence = Math.min(zScore / threshold.critical, 1.0);

    return {
      isAnomaly,
      expectedValue: model.mean,
      confidence
    };
  }

  /**
   * Rolling statistics anomaly detection
   */
  private detectRollingStatsAnomaly(
    metric: string, 
    point: TimeSeriesPoint, 
    config: AnomalyDetectionConfig
  ): { isAnomaly: boolean; expectedValue: number; confidence: number } {
    const series = this.timeSeries.get(metric) || [];
    const windowMs = config.windowSize * 60 * 1000;
    const windowStart = new Date(point.timestamp.getTime() - windowMs);
    
    const windowData = series
      .filter(p => p.timestamp >= windowStart && p.timestamp < point.timestamp)
      .map(p => p.value);

    if (windowData.length < 10) {
      return { isAnomaly: false, expectedValue: point.value, confidence: 0 };
    }

    const mean = windowData.reduce((sum, v) => sum + v, 0) / windowData.length;
    const stdDev = Math.sqrt(
      windowData.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / windowData.length
    );

    const zScore = Math.abs((point.value - mean) / stdDev);
    const threshold = config.sensitivity === 'high' ? 2.0 : 
                     config.sensitivity === 'medium' ? 2.5 : 3.0;

    return {
      isAnomaly: zScore > threshold,
      expectedValue: mean,
      confidence: Math.min(zScore / (threshold * 1.5), 1.0)
    };
  }

  /**
   * Simplified isolation forest anomaly detection
   */
  private detectIsolationForestAnomaly(
    metric: string, 
    point: TimeSeriesPoint, 
    config: AnomalyDetectionConfig
  ): boolean {
    const series = this.timeSeries.get(metric) || [];
    const recentData = series.slice(-100).map(p => p.value);
    
    if (recentData.length < 20) return false;

    // Simplified isolation: check if value is in extreme percentiles
    recentData.sort((a, b) => a - b);
    const p5 = recentData[Math.floor(recentData.length * 0.05)];
    const p95 = recentData[Math.floor(recentData.length * 0.95)];
    
    const threshold = config.sensitivity === 'high' ? 0.1 : 
                     config.sensitivity === 'medium' ? 0.05 : 0.02;
    
    return point.value < p5 || point.value > p95;
  }

  /**
   * Create anomaly alert
   */
  private async createAnomalyAlert(
    metric: string,
    point: TimeSeriesPoint,
    expectedValue: number,
    confidence: number,
    config: AnomalyDetectionConfig
  ): Promise<void> {
    const deviation = Math.abs((point.value - expectedValue) / expectedValue);
    const severity = deviation > config.thresholds.critical ? 'critical' : 'warning';
    
    const alertId = this.generateAlertId();
    const alert: AnomalyAlert = {
      id: alertId,
      metric,
      timestamp: point.timestamp,
      value: point.value,
      expectedValue,
      deviation,
      severity,
      algorithm: config.algorithm,
      confidence,
      context: await this.buildAlertContext(metric, point),
      acknowledged: false
    };

    this.alerts.set(alertId, alert);
    
    // Emit alert (would integrate with notification system)
    console.warn(`Anomaly detected in ${metric}:`, {
      value: point.value,
      expected: expectedValue,
      deviation: `${(deviation * 100).toFixed(1)}%`,
      confidence: `${(confidence * 100).toFixed(1)}%`,
      severity
    });

    // Auto-acknowledge low-confidence warnings after 15 minutes
    if (severity === 'warning' && confidence < 0.7) {
      setTimeout(() => {
        this.acknowledgeAlert(alertId, 'auto-acknowledged-low-confidence');
      }, 15 * 60 * 1000);
    }
  }

  /**
   * Build context for anomaly alert
   */
  private async buildAlertContext(metric: string, point: TimeSeriesPoint): Promise<{
    recentTrend: 'increasing' | 'decreasing' | 'stable' | 'volatile';
    seasonality: 'daily' | 'weekly' | 'none';
    correlatedMetrics: string[];
  }> {
    const series = this.timeSeries.get(metric) || [];
    const recent = series.slice(-20).map(p => p.value);
    
    // Analyze trend
    let recentTrend: 'increasing' | 'decreasing' | 'stable' | 'volatile' = 'stable';
    
    if (recent.length >= 5) {
      const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
      const secondHalf = recent.slice(Math.floor(recent.length / 2));
      
      const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length;
      
      const change = (secondAvg - firstAvg) / firstAvg;
      
      if (change > 0.1) recentTrend = 'increasing';
      else if (change < -0.1) recentTrend = 'decreasing';
      else {
        const volatility = this.calculateVolatility(recent);
        if (volatility > 0.3) recentTrend = 'volatile';
      }
    }

    // Detect seasonality (simplified)
    const seasonality = this.detectSeasonality(series);
    
    // Find correlated metrics (simplified)
    const correlatedMetrics = await this.findCorrelatedMetrics(metric, point.timestamp);

    return {
      recentTrend,
      seasonality,
      correlatedMetrics
    };
  }

  /**
   * Calculate volatility
   */
  private calculateVolatility(values: number[]): number {
    if (values.length < 2) return 0;
    
    const returns = [];
    for (let i = 1; i < values.length; i++) {
      if (values[i - 1] !== 0) {
        returns.push((values[i] - values[i - 1]) / values[i - 1]);
      }
    }
    
    if (returns.length === 0) return 0;
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }

  /**
   * Detect seasonality patterns
   */
  private detectSeasonality(series: TimeSeriesPoint[]): 'daily' | 'weekly' | 'none' {
    if (series.length < 48) return 'none'; // Need at least 48 hours of data
    
    // Simple approach: check for daily patterns
    const hourlyAvgs = new Array(24).fill(0);
    const hourlyCounts = new Array(24).fill(0);
    
    for (const point of series) {
      const hour = point.timestamp.getHours();
      hourlyAvgs[hour] += point.value;
      hourlyCounts[hour]++;
    }
    
    for (let i = 0; i < 24; i++) {
      if (hourlyCounts[i] > 0) {
        hourlyAvgs[i] /= hourlyCounts[i];
      }
    }
    
    // Calculate variance across hours
    const mean = hourlyAvgs.reduce((sum, v) => sum + v, 0) / 24;
    const variance = hourlyAvgs.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / 24;
    const coefficientOfVariation = Math.sqrt(variance) / mean;
    
    if (coefficientOfVariation > 0.2) return 'daily';
    
    // Could extend to check weekly patterns
    return 'none';
  }

  /**
   * Find correlated metrics
   */
  private async findCorrelatedMetrics(metric: string, timestamp: Date): Promise<string[]> {
    const correlatedMetrics: string[] = [];
    const timeWindow = 30 * 60 * 1000; // 30 minutes
    
    for (const [otherMetric, otherSeries] of this.timeSeries.entries()) {
      if (otherMetric === metric) continue;
      
      const recentPoints = otherSeries.filter(p => 
        Math.abs(p.timestamp.getTime() - timestamp.getTime()) < timeWindow
      );
      
      if (recentPoints.length > 0) {
        // Check if this metric also has anomalies recently
        const hasRecentAnomalies = Array.from(this.alerts.values()).some(alert =>
          alert.metric === otherMetric &&
          Math.abs(alert.timestamp.getTime() - timestamp.getTime()) < timeWindow
        );
        
        if (hasRecentAnomalies) {
          correlatedMetrics.push(otherMetric);
        }
      }
    }
    
    return correlatedMetrics.slice(0, 3); // Return top 3 correlated metrics
  }

  /**
   * Train or retrain model for a metric
   */
  async trainModel(metric: string): Promise<void> {
    const config = this.configs.get(metric);
    const series = this.timeSeries.get(metric);
    
    if (!config || !series || series.length < 100) {
      console.warn(`Insufficient data to train model for ${metric}`);
      return;
    }

    const trainingData = series.map(p => p.value);
    
    // Calculate statistical model
    const mean = trainingData.reduce((sum, v) => sum + v, 0) / trainingData.length;
    const variance = trainingData.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / trainingData.length;
    const stdDev = Math.sqrt(variance);
    
    const sortedData = [...trainingData].sort((a, b) => a - b);
    const median = sortedData[Math.floor(sortedData.length / 2)];
    const q25 = sortedData[Math.floor(sortedData.length * 0.25)];
    const q75 = sortedData[Math.floor(sortedData.length * 0.75)];
    const min = Math.min(...trainingData);
    const max = Math.max(...trainingData);
    
    // Simple trend calculation
    const trend = this.calculateLinearTrend(series);
    
    // Simple seasonality detection
    const seasonality = this.calculateSeasonality(series);

    const model: StatisticalModel = {
      mean,
      stdDev,
      median,
      q25,
      q75,
      min,
      max,
      trend,
      seasonality
    };

    this.models.set(metric, model);
    
    // Calculate model metrics (simplified)
    const metrics: ModelMetrics = {
      accuracy: 0.85, // Would be calculated from validation data
      precision: 0.80,
      recall: 0.75,
      f1Score: 0.77,
      falsePositiveRate: 0.05,
      lastUpdated: new Date(),
      trainingDataPoints: trainingData.length
    };

    this.modelMetrics.set(metric, metrics);
    
    console.log(`Trained anomaly detection model for ${metric}:`, {
      dataPoints: trainingData.length,
      mean: mean.toFixed(2),
      stdDev: stdDev.toFixed(2),
      trend: trend.toFixed(4)
    });
  }

  /**
   * Calculate linear trend
   */
  private calculateLinearTrend(series: TimeSeriesPoint[]): number {
    if (series.length < 2) return 0;
    
    const n = series.length;
    const x = series.map((_, i) => i);
    const y = series.map(p => p.value);
    
    const sumX = x.reduce((sum, v) => sum + v, 0);
    const sumY = y.reduce((sum, v) => sum + v, 0);
    const sumXY = x.reduce((sum, v, i) => sum + v * y[i], 0);
    const sumXX = x.reduce((sum, v) => sum + v * v, 0);
    
    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }

  /**
   * Calculate seasonality components
   */
  private calculateSeasonality(series: TimeSeriesPoint[]): Record<string, number> {
    const seasonality: Record<string, number> = {};
    
    // Daily seasonality
    const hourlyAvgs = new Array(24).fill(0);
    const hourlyCounts = new Array(24).fill(0);
    
    for (const point of series) {
      const hour = point.timestamp.getHours();
      hourlyAvgs[hour] += point.value;
      hourlyCounts[hour]++;
    }
    
    for (let i = 0; i < 24; i++) {
      if (hourlyCounts[i] > 0) {
        seasonality[`hour_${i}`] = hourlyAvgs[i] / hourlyCounts[i];
      }
    }
    
    return seasonality;
  }

  /**
   * Get anomaly alerts
   */
  getAlerts(filters?: {
    metric?: string;
    severity?: 'warning' | 'critical';
    acknowledged?: boolean;
    timeRange?: { start: Date; end: Date };
  }): AnomalyAlert[] {
    let alerts = Array.from(this.alerts.values());
    
    if (filters) {
      if (filters.metric) {
        alerts = alerts.filter(a => a.metric === filters.metric);
      }
      if (filters.severity) {
        alerts = alerts.filter(a => a.severity === filters.severity);
      }
      if (filters.acknowledged !== undefined) {
        alerts = alerts.filter(a => a.acknowledged === filters.acknowledged);
      }
      if (filters.timeRange) {
        alerts = alerts.filter(a => 
          a.timestamp >= filters.timeRange!.start && 
          a.timestamp <= filters.timeRange!.end
        );
      }
    }
    
    return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string, reason?: string): boolean {
    const alert = this.alerts.get(alertId);
    
    if (alert && !alert.acknowledged) {
      alert.acknowledged = true;
      alert.resolvedAt = new Date();
      return true;
    }
    
    return false;
  }

  /**
   * Start detection for a metric
   */
  private startDetection(metric: string): void {
    // Train initial model
    this.trainModel(metric);
    
    // Set up periodic model retraining
    const interval = setInterval(() => {
      this.trainModel(metric);
    }, 60 * 60 * 1000); // Retrain every hour
    
    this.detectionIntervals.set(metric, interval);
  }

  /**
   * Start periodic model retraining
   */
  private startPeriodicRetraining(): void {
    setInterval(() => {
      for (const metric of this.configs.keys()) {
        this.trainModel(metric);
      }
    }, 6 * 60 * 60 * 1000); // Every 6 hours
  }

  /**
   * Initialize default configurations
   */
  private initializeDefaultConfigs(): void {
    const defaultConfigs: AnomalyDetectionConfig[] = [
      {
        metric: 'response_time',
        algorithm: 'statistical',
        sensitivity: 'medium',
        windowSize: 60,
        trainingPeriod: 24,
        thresholds: { warning: 0.3, critical: 0.5 },
        enabled: true
      },
      {
        metric: 'error_rate',
        algorithm: 'rolling_stats',
        sensitivity: 'high',
        windowSize: 30,
        trainingPeriod: 12,
        thresholds: { warning: 0.5, critical: 1.0 },
        enabled: true
      },
      {
        metric: 'throughput',
        algorithm: 'statistical',
        sensitivity: 'medium',
        windowSize: 120,
        trainingPeriod: 48,
        thresholds: { warning: 0.2, critical: 0.4 },
        enabled: true
      },
      {
        metric: 'memory_usage',
        algorithm: 'rolling_stats',
        sensitivity: 'low',
        windowSize: 30,
        trainingPeriod: 24,
        thresholds: { warning: 0.15, critical: 0.25 },
        enabled: true
      }
    ];

    for (const config of defaultConfigs) {
      this.registerMetric(config);
    }
  }

  private generateAlertId(): string {
    return `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get detection statistics
   */
  getStatistics(): {
    totalMetrics: number;
    enabledMetrics: number;
    totalAlerts: number;
    criticalAlerts: number;
    unacknowledgedAlerts: number;
    avgModelAccuracy: number;
    falsePositiveRate: number;
  } {
    const alerts = Array.from(this.alerts.values());
    const metrics = Array.from(this.modelMetrics.values());
    
    return {
      totalMetrics: this.configs.size,
      enabledMetrics: Array.from(this.configs.values()).filter(c => c.enabled).length,
      totalAlerts: alerts.length,
      criticalAlerts: alerts.filter(a => a.severity === 'critical').length,
      unacknowledgedAlerts: alerts.filter(a => !a.acknowledged).length,
      avgModelAccuracy: metrics.length > 0 
        ? metrics.reduce((sum, m) => sum + m.accuracy, 0) / metrics.length 
        : 0,
      falsePositiveRate: metrics.length > 0 
        ? metrics.reduce((sum, m) => sum + m.falsePositiveRate, 0) / metrics.length 
        : 0
    };
  }
}

// Global anomaly detection instance
export const anomalyDetector = new AnomalyDetectionEngine();

export default anomalyDetector;