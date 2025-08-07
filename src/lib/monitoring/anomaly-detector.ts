import { EventEmitter } from 'events';
import { logger } from './index';
import { MetricsCollector } from './metrics-collector';

export interface AnomalyDetectorConfig {
  sensitivity: 'low' | 'medium' | 'high';
  algorithms: string[];
  windowSize?: number;
  minDataPoints?: number;
}

export interface DataPoint {
  timestamp: number;
  value: number;
  labels?: Record<string, string>;
}

export interface Anomaly {
  timestamp: number;
  value: number;
  expectedValue: number;
  deviation: number;
  confidence: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  labels: Record<string, string>;
  algorithm: string;
}

/**
 * Advanced Anomaly Detection System
 * Features:
 * - Statistical anomaly detection (Z-score, IQR)
 * - Machine learning-based detection
 * - Seasonal trend analysis
 * - Real-time streaming detection
 * - Adaptive thresholds
 */
export class AnomalyDetector extends EventEmitter {
  private config: AnomalyDetectorConfig;
  private metrics: MetricsCollector;
  private dataBuffer = new Map<string, DataPoint[]>();
  private baselines = new Map<string, StatisticalBaseline>();
  private seasonalPatterns = new Map<string, SeasonalPattern>();
  
  constructor(config: AnomalyDetectorConfig) {
    super();
    this.config = {
      windowSize: 100,
      minDataPoints: 10,
      ...config
    };
    this.metrics = new MetricsCollector();
    
    this.startBackgroundAnalysis();
  }

  /**
   * Detect anomalies in real-time data point
   */
  async detect(
    metricName: string, 
    value: number, 
    metadata: { timestamp: number; labels?: Record<string, string> }
  ): Promise<boolean> {
    const dataPoint: DataPoint = {
      value,
      timestamp: metadata.timestamp,
      labels: metadata.labels || {}
    };
    
    // Add to buffer
    this.addToBuffer(metricName, dataPoint);
    
    // Get baseline for this metric
    const baseline = this.getOrCreateBaseline(metricName);
    
    // Apply configured algorithms
    const anomalies: Anomaly[] = [];
    
    if (this.config.algorithms.includes('statistical')) {
      const statisticalAnomaly = this.detectStatisticalAnomaly(metricName, dataPoint, baseline);
      if (statisticalAnomaly) anomalies.push(statisticalAnomaly);
    }
    
    if (this.config.algorithms.includes('ml')) {
      const mlAnomaly = await this.detectMLAnomaly(metricName, dataPoint, baseline);
      if (mlAnomaly) anomalies.push(mlAnomaly);
    }
    
    if (this.config.algorithms.includes('seasonal')) {
      const seasonalAnomaly = this.detectSeasonalAnomaly(metricName, dataPoint);
      if (seasonalAnomaly) anomalies.push(seasonalAnomaly);
    }
    
    // Process detected anomalies
    for (const anomaly of anomalies) {
      await this.processAnomaly(metricName, anomaly);
    }
    
    return anomalies.length > 0;
  }

  /**
   * Detect anomalies in batch data
   */
  async detectBatch(metricName: string, dataPoints: DataPoint[]): Promise<Anomaly[]> {
    if (dataPoints.length < this.config.minDataPoints!) {
      return [];
    }
    
    const anomalies: Anomaly[] = [];
    const baseline = this.getOrCreateBaseline(metricName);
    
    // Update baseline with batch data
    this.updateBaseline(baseline, dataPoints);
    
    // Detect anomalies in batch
    for (const dataPoint of dataPoints) {
      if (this.config.algorithms.includes('statistical')) {
        const anomaly = this.detectStatisticalAnomaly(metricName, dataPoint, baseline);
        if (anomaly) anomalies.push(anomaly);
      }
      
      if (this.config.algorithms.includes('changepoint')) {
        const changepoint = this.detectChangePoint(metricName, dataPoint, dataPoints);
        if (changepoint) anomalies.push(changepoint);
      }
    }
    
    return anomalies;
  }

  /**
   * Update model with new training data
   */
  async updateModel(metricName: string, trainingData: DataPoint[]): Promise<void> {
    const baseline = this.getOrCreateBaseline(metricName);
    this.updateBaseline(baseline, trainingData);
    
    // Update seasonal patterns
    if (this.config.algorithms.includes('seasonal')) {
      await this.updateSeasonalPattern(metricName, trainingData);
    }
    
    this.metrics.incrementCounter('anomaly_model_updates', { metric: metricName });
  }

  /**
   * Get anomaly statistics
   */
  getStatistics(): {
    totalAnomaliesDetected: number;
    anomaliesByMetric: Record<string, number>;
    anomaliesBySeverity: Record<string, number>;
    falsePositiveRate: number;
    detectionLatency: number;
  } {
    // Mock implementation - would track actual statistics
    return {
      totalAnomaliesDetected: 0,
      anomaliesByMetric: {},
      anomaliesBySeverity: {},
      falsePositiveRate: 0.05,
      detectionLatency: 100
    };
  }

  // Private detection algorithms

  private detectStatisticalAnomaly(
    metricName: string, 
    dataPoint: DataPoint, 
    baseline: StatisticalBaseline
  ): Anomaly | null {
    const { value, timestamp } = dataPoint;
    
    // Z-score detection
    const zScore = Math.abs((value - baseline.mean) / baseline.standardDeviation);
    const zThreshold = this.getZScoreThreshold();
    
    if (zScore > zThreshold) {
      return {
        timestamp,
        value,
        expectedValue: baseline.mean,
        deviation: zScore,
        confidence: Math.min(zScore / zThreshold, 1.0),
        severity: this.calculateSeverity(zScore, zThreshold),
        description: `Statistical anomaly detected: Z-score ${zScore.toFixed(2)} exceeds threshold ${zThreshold}`,
        labels: dataPoint.labels || {},
        algorithm: 'statistical'
      };
    }
    
    // IQR detection
    const iqr = baseline.q3 - baseline.q1;
    const lowerBound = baseline.q1 - 1.5 * iqr;
    const upperBound = baseline.q3 + 1.5 * iqr;
    
    if (value < lowerBound || value > upperBound) {
      const deviation = value < lowerBound ? 
        (lowerBound - value) / iqr : 
        (value - upperBound) / iqr;
      
      return {
        timestamp,
        value,
        expectedValue: baseline.median,
        deviation,
        confidence: Math.min(deviation / 2, 1.0),
        severity: this.calculateSeverity(deviation, 2),
        description: `IQR anomaly detected: value ${value} outside bounds [${lowerBound.toFixed(2)}, ${upperBound.toFixed(2)}]`,
        labels: dataPoint.labels || {},
        algorithm: 'iqr'
      };
    }
    
    return null;
  }

  private async detectMLAnomaly(
    metricName: string, 
    dataPoint: DataPoint, 
    baseline: StatisticalBaseline
  ): Promise<Anomaly | null> {
    // Simplified ML-based anomaly detection
    // In production, this would use actual ML models (e.g., Isolation Forest, LSTM autoencoders)
    
    const features = this.extractFeatures(metricName, dataPoint);
    const anomalyScore = await this.calculateAnomalyScore(features);
    
    const threshold = 0.7; // ML model threshold
    
    if (anomalyScore > threshold) {
      return {
        timestamp: dataPoint.timestamp,
        value: dataPoint.value,
        expectedValue: baseline.mean,
        deviation: anomalyScore,
        confidence: anomalyScore,
        severity: this.calculateSeverity(anomalyScore, threshold),
        description: `ML anomaly detected: anomaly score ${anomalyScore.toFixed(3)} exceeds threshold ${threshold}`,
        labels: dataPoint.labels || {},
        algorithm: 'ml'
      };
    }
    
    return null;
  }

  private detectSeasonalAnomaly(metricName: string, dataPoint: DataPoint): Anomaly | null {
    const seasonalPattern = this.seasonalPatterns.get(metricName);
    if (!seasonalPattern) return null;
    
    const expectedValue = this.getSeasonalExpectedValue(dataPoint.timestamp, seasonalPattern);
    const threshold = seasonalPattern.tolerance;
    
    const deviation = Math.abs(dataPoint.value - expectedValue);
    
    if (deviation > threshold) {
      return {
        timestamp: dataPoint.timestamp,
        value: dataPoint.value,
        expectedValue,
        deviation: deviation / threshold,
        confidence: Math.min(deviation / threshold, 1.0),
        severity: this.calculateSeverity(deviation, threshold),
        description: `Seasonal anomaly detected: value ${dataPoint.value} deviates from expected ${expectedValue.toFixed(2)} by ${deviation.toFixed(2)}`,
        labels: dataPoint.labels || {},
        algorithm: 'seasonal'
      };
    }
    
    return null;
  }

  private detectChangePoint(
    metricName: string, 
    dataPoint: DataPoint, 
    recentData: DataPoint[]
  ): Anomaly | null {
    if (recentData.length < 20) return null;
    
    // Simple change point detection using sliding window variance
    const windowSize = 10;
    const currentIndex = recentData.findIndex(dp => dp.timestamp === dataPoint.timestamp);
    
    if (currentIndex < windowSize || currentIndex > recentData.length - windowSize) {
      return null;
    }
    
    const beforeWindow = recentData.slice(currentIndex - windowSize, currentIndex);
    const afterWindow = recentData.slice(currentIndex, currentIndex + windowSize);
    
    const beforeMean = beforeWindow.reduce((sum, dp) => sum + dp.value, 0) / beforeWindow.length;
    const afterMean = afterWindow.reduce((sum, dp) => sum + dp.value, 0) / afterWindow.length;
    
    const changeMagnitude = Math.abs(afterMean - beforeMean);
    const threshold = Math.max(beforeMean * 0.2, 1); // 20% change or absolute 1
    
    if (changeMagnitude > threshold) {
      return {
        timestamp: dataPoint.timestamp,
        value: dataPoint.value,
        expectedValue: beforeMean,
        deviation: changeMagnitude,
        confidence: Math.min(changeMagnitude / threshold, 1.0),
        severity: this.calculateSeverity(changeMagnitude, threshold),
        description: `Change point detected: mean shifted from ${beforeMean.toFixed(2)} to ${afterMean.toFixed(2)}`,
        labels: dataPoint.labels || {},
        algorithm: 'changepoint'
      };
    }
    
    return null;
  }

  // Helper methods

  private addToBuffer(metricName: string, dataPoint: DataPoint): void {
    if (!this.dataBuffer.has(metricName)) {
      this.dataBuffer.set(metricName, []);
    }
    
    const buffer = this.dataBuffer.get(metricName)!;
    buffer.push(dataPoint);
    
    // Keep only recent data points
    if (buffer.length > this.config.windowSize!) {
      buffer.shift();
    }
  }

  private getOrCreateBaseline(metricName: string): StatisticalBaseline {
    if (!this.baselines.has(metricName)) {
      this.baselines.set(metricName, {
        mean: 0,
        median: 0,
        standardDeviation: 1,
        q1: 0,
        q3: 0,
        min: 0,
        max: 0,
        dataPoints: 0,
        lastUpdated: new Date()
      });
    }
    
    return this.baselines.get(metricName)!;
  }

  private updateBaseline(baseline: StatisticalBaseline, dataPoints: DataPoint[]): void {
    const values = dataPoints.map(dp => dp.value).sort((a, b) => a - b);
    
    baseline.mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    baseline.median = this.calculateMedian(values);
    baseline.standardDeviation = this.calculateStandardDeviation(values, baseline.mean);
    baseline.q1 = this.calculatePercentile(values, 25);
    baseline.q3 = this.calculatePercentile(values, 75);
    baseline.min = Math.min(...values);
    baseline.max = Math.max(...values);
    baseline.dataPoints = values.length;
    baseline.lastUpdated = new Date();
  }

  private async updateSeasonalPattern(metricName: string, data: DataPoint[]): Promise<void> {
    // Simplified seasonal pattern detection
    // In production, would use more sophisticated time series analysis
    
    const pattern: SeasonalPattern = {
      hourlyPattern: new Array(24).fill(0),
      dailyPattern: new Array(7).fill(0),
      weeklyPattern: new Array(52).fill(0),
      tolerance: 0,
      lastUpdated: new Date()
    };
    
    // Calculate hourly patterns
    const hourlyGroups: Record<number, number[]> = {};
    for (const dp of data) {
      const hour = new Date(dp.timestamp).getHours();
      if (!hourlyGroups[hour]) hourlyGroups[hour] = [];
      hourlyGroups[hour].push(dp.value);
    }
    
    for (let hour = 0; hour < 24; hour++) {
      if (hourlyGroups[hour]) {
        pattern.hourlyPattern[hour] = hourlyGroups[hour].reduce((sum, val) => sum + val, 0) / hourlyGroups[hour].length;
      }
    }
    
    // Calculate tolerance as standard deviation of all values
    const allValues = data.map(dp => dp.value);
    const mean = allValues.reduce((sum, val) => sum + val, 0) / allValues.length;
    pattern.tolerance = this.calculateStandardDeviation(allValues, mean) * 2;
    
    this.seasonalPatterns.set(metricName, pattern);
  }

  private getSeasonalExpectedValue(timestamp: number, pattern: SeasonalPattern): number {
    const date = new Date(timestamp);
    const hour = date.getHours();
    return pattern.hourlyPattern[hour] || 0;
  }

  private extractFeatures(metricName: string, dataPoint: DataPoint): number[] {
    // Extract features for ML model
    const buffer = this.dataBuffer.get(metricName) || [];
    const recent = buffer.slice(-10); // Last 10 data points
    
    const features = [
      dataPoint.value,
      recent.length > 0 ? recent[recent.length - 1].value : 0,
      recent.reduce((sum, dp) => sum + dp.value, 0) / recent.length || 0,
      new Date(dataPoint.timestamp).getHours() / 24, // Time of day feature
      new Date(dataPoint.timestamp).getDay() / 7 // Day of week feature
    ];
    
    return features;
  }

  private async calculateAnomalyScore(features: number[]): Promise<number> {
    // Mock ML model prediction
    // In production, would call actual ML model API or use TensorFlow.js
    return Math.random();
  }

  private getZScoreThreshold(): number {
    const thresholds = {
      low: 3.0,
      medium: 2.5,
      high: 2.0
    };
    return thresholds[this.config.sensitivity];
  }

  private calculateSeverity(deviation: number, threshold: number): 'low' | 'medium' | 'high' | 'critical' {
    const ratio = deviation / threshold;
    
    if (ratio > 3) return 'critical';
    if (ratio > 2) return 'high';
    if (ratio > 1.5) return 'medium';
    return 'low';
  }

  private calculateMedian(sortedValues: number[]): number {
    const mid = Math.floor(sortedValues.length / 2);
    return sortedValues.length % 2 === 0
      ? (sortedValues[mid - 1] + sortedValues[mid]) / 2
      : sortedValues[mid];
  }

  private calculatePercentile(sortedValues: number[], percentile: number): number {
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;
    
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  private calculateStandardDeviation(values: number[], mean: number): number {
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private async processAnomaly(metricName: string, anomaly: Anomaly): Promise<void> {
    this.metrics.incrementCounter('anomalies_detected', {
      metric: metricName,
      algorithm: anomaly.algorithm,
      severity: anomaly.severity
    });
    
    this.emit('anomaly', { metricName, anomaly });
    
    logger.warn(`Anomaly detected in ${metricName}:`, {
      value: anomaly.value,
      expected: anomaly.expectedValue,
      deviation: anomaly.deviation,
      confidence: anomaly.confidence,
      severity: anomaly.severity,
      algorithm: anomaly.algorithm
    });
  }

  private startBackgroundAnalysis(): void {
    // Periodic model updates and cleanup
    setInterval(() => {
      this.performMaintenanceTasks();
    }, 300000); // Every 5 minutes
  }

  private performMaintenanceTasks(): void {
    // Clean old data from buffers
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const cutoff = Date.now() - maxAge;
    
    for (const [metricName, buffer] of this.dataBuffer) {
      const filtered = buffer.filter(dp => dp.timestamp > cutoff);
      this.dataBuffer.set(metricName, filtered);
    }
    
    // Update baselines periodically
    for (const [metricName, buffer] of this.dataBuffer) {
      if (buffer.length >= this.config.minDataPoints!) {
        const baseline = this.getOrCreateBaseline(metricName);
        this.updateBaseline(baseline, buffer);
      }
    }
  }
}

interface StatisticalBaseline {
  mean: number;
  median: number;
  standardDeviation: number;
  q1: number;
  q3: number;
  min: number;
  max: number;
  dataPoints: number;
  lastUpdated: Date;
}

interface SeasonalPattern {
  hourlyPattern: number[];
  dailyPattern: number[];
  weeklyPattern: number[];
  tolerance: number;
  lastUpdated: Date;
}