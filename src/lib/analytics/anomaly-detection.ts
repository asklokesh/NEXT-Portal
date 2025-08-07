/**
 * ML-based Anomaly Detection Service
 * 
 * Implements machine learning algorithms for detecting anomalies in plugin metrics
 * Uses statistical methods and pattern recognition for real-time anomaly detection
 */

export interface AnomalyDetectorConfig {
  sensitivity: number; // 0-1, higher = more sensitive
  windowSize: number; // Number of data points to consider
  minDataPoints: number; // Minimum data points before detection starts
  algorithms: ('zscore' | 'isolation' | 'lstm' | 'prophet')[];
}

export interface AnomalyScore {
  pluginId: string;
  metric: string;
  timestamp: Date;
  value: number;
  score: number; // 0-1, higher = more anomalous
  isAnomaly: boolean;
  algorithm: string;
  expectedRange: [number, number];
  confidence: number;
}

export interface PatternAnomaly {
  pluginId: string;
  pattern: string;
  description: string;
  startTime: Date;
  endTime: Date;
  affectedMetrics: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
}

export interface SeasonalPattern {
  metric: string;
  period: 'hourly' | 'daily' | 'weekly' | 'monthly';
  pattern: number[];
  strength: number; // 0-1, strength of seasonality
}

class AnomalyDetectionService {
  private config: AnomalyDetectorConfig;
  private dataBuffer: Map<string, Map<string, number[]>> = new Map();
  private baselineStats: Map<string, Map<string, { mean: number; std: number }>> = new Map();
  private seasonalPatterns: Map<string, SeasonalPattern[]> = new Map();
  private anomalyHistory: AnomalyScore[] = [];
  private patternAnomalies: PatternAnomaly[] = [];
  
  constructor(config?: Partial<AnomalyDetectorConfig>) {
    this.config = {
      sensitivity: 0.95,
      windowSize: 100,
      minDataPoints: 20,
      algorithms: ['zscore', 'isolation'],
      ...config,
    };
  }
  
  /**
   * Process a new metric value and check for anomalies
   */
  public processMetric(
    pluginId: string,
    metric: string,
    value: number,
    timestamp: Date = new Date()
  ): AnomalyScore | null {
    // Initialize buffers if needed
    if (!this.dataBuffer.has(pluginId)) {
      this.dataBuffer.set(pluginId, new Map());
    }
    if (!this.dataBuffer.get(pluginId)!.has(metric)) {
      this.dataBuffer.get(pluginId)!.set(metric, []);
    }
    
    const buffer = this.dataBuffer.get(pluginId)!.get(metric)!;
    buffer.push(value);
    
    // Maintain window size
    if (buffer.length > this.config.windowSize) {
      buffer.shift();
    }
    
    // Need minimum data points for detection
    if (buffer.length < this.config.minDataPoints) {
      return null;
    }
    
    // Update baseline statistics
    this.updateBaseline(pluginId, metric, buffer);
    
    // Run anomaly detection algorithms
    const anomalyScores: AnomalyScore[] = [];
    
    if (this.config.algorithms.includes('zscore')) {
      const zscore = this.detectZScoreAnomaly(pluginId, metric, value, timestamp);
      if (zscore) anomalyScores.push(zscore);
    }
    
    if (this.config.algorithms.includes('isolation')) {
      const isolation = this.detectIsolationForestAnomaly(pluginId, metric, value, timestamp, buffer);
      if (isolation) anomalyScores.push(isolation);
    }
    
    // Combine scores from multiple algorithms
    const combinedScore = this.combineAnomalyScores(anomalyScores);
    
    if (combinedScore && combinedScore.isAnomaly) {
      this.anomalyHistory.push(combinedScore);
      this.detectPatternAnomalies(pluginId);
      return combinedScore;
    }
    
    return null;
  }
  
  /**
   * Z-Score based anomaly detection
   */
  private detectZScoreAnomaly(
    pluginId: string,
    metric: string,
    value: number,
    timestamp: Date
  ): AnomalyScore | null {
    const stats = this.baselineStats.get(pluginId)?.get(metric);
    if (!stats) return null;
    
    const zScore = Math.abs((value - stats.mean) / stats.std);
    const threshold = this.getZScoreThreshold();
    const isAnomaly = zScore > threshold;
    
    // Calculate expected range
    const expectedRange: [number, number] = [
      stats.mean - threshold * stats.std,
      stats.mean + threshold * stats.std,
    ];
    
    return {
      pluginId,
      metric,
      timestamp,
      value,
      score: Math.min(zScore / 5, 1), // Normalize to 0-1
      isAnomaly,
      algorithm: 'zscore',
      expectedRange,
      confidence: this.calculateConfidence(zScore, threshold),
    };
  }
  
  /**
   * Isolation Forest anomaly detection
   */
  private detectIsolationForestAnomaly(
    pluginId: string,
    metric: string,
    value: number,
    timestamp: Date,
    buffer: number[]
  ): AnomalyScore | null {
    // Simplified isolation forest implementation
    const trees = 100;
    const sampleSize = Math.min(256, buffer.length);
    let anomalyScore = 0;
    
    for (let t = 0; t < trees; t++) {
      const sample = this.randomSample(buffer, sampleSize);
      const pathLength = this.isolationTreePathLength(value, sample);
      const expectedPathLength = this.expectedPathLength(sampleSize);
      anomalyScore += Math.pow(2, -pathLength / expectedPathLength);
    }
    
    anomalyScore /= trees;
    const threshold = 0.5 + (1 - this.config.sensitivity) * 0.3;
    const isAnomaly = anomalyScore > threshold;
    
    // Calculate expected range based on percentiles
    const sorted = [...buffer].sort((a, b) => a - b);
    const p5 = sorted[Math.floor(sorted.length * 0.05)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    
    return {
      pluginId,
      metric,
      timestamp,
      value,
      score: anomalyScore,
      isAnomaly,
      algorithm: 'isolation',
      expectedRange: [p5, p95],
      confidence: anomalyScore > threshold ? anomalyScore : 1 - anomalyScore,
    };
  }
  
  /**
   * Calculate isolation tree path length
   */
  private isolationTreePathLength(value: number, sample: number[]): number {
    if (sample.length <= 1) return 0;
    
    const min = Math.min(...sample);
    const max = Math.max(...sample);
    
    if (min === max) return 0;
    
    const splitPoint = min + Math.random() * (max - min);
    
    if (value < splitPoint) {
      return 1 + this.isolationTreePathLength(
        value,
        sample.filter(v => v < splitPoint)
      );
    } else {
      return 1 + this.isolationTreePathLength(
        value,
        sample.filter(v => v >= splitPoint)
      );
    }
  }
  
  /**
   * Expected path length in isolation forest
   */
  private expectedPathLength(n: number): number {
    if (n <= 1) return 0;
    if (n === 2) return 1;
    
    const euler = 0.5772156649;
    return 2 * (Math.log(n - 1) + euler) - (2 * (n - 1) / n);
  }
  
  /**
   * Random sample from array
   */
  private randomSample<T>(array: T[], size: number): T[] {
    const sample: T[] = [];
    const indices = new Set<number>();
    
    while (indices.size < Math.min(size, array.length)) {
      indices.add(Math.floor(Math.random() * array.length));
    }
    
    indices.forEach(i => sample.push(array[i]));
    return sample;
  }
  
  /**
   * Combine anomaly scores from multiple algorithms
   */
  private combineAnomalyScores(scores: AnomalyScore[]): AnomalyScore | null {
    if (scores.length === 0) return null;
    
    // Use weighted average based on confidence
    let totalWeight = 0;
    let weightedScore = 0;
    let maxScore = 0;
    let bestAlgorithm = '';
    
    scores.forEach(score => {
      const weight = score.confidence;
      totalWeight += weight;
      weightedScore += score.score * weight;
      
      if (score.score > maxScore) {
        maxScore = score.score;
        bestAlgorithm = score.algorithm;
      }
    });
    
    const combinedScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
    const threshold = 1 - this.config.sensitivity;
    
    // Use the first score as template and update with combined values
    return {
      ...scores[0],
      score: combinedScore,
      isAnomaly: combinedScore > threshold,
      algorithm: `combined(${scores.map(s => s.algorithm).join(',')})`,
      confidence: totalWeight / scores.length,
    };
  }
  
  /**
   * Detect pattern anomalies across multiple metrics
   */
  private detectPatternAnomalies(pluginId: string): void {
    const recentAnomalies = this.anomalyHistory
      .filter(a => a.pluginId === pluginId)
      .filter(a => a.timestamp.getTime() > Date.now() - 3600000); // Last hour
    
    if (recentAnomalies.length < 3) return;
    
    // Group anomalies by time windows
    const timeWindows = new Map<number, AnomalyScore[]>();
    const windowSize = 5 * 60 * 1000; // 5 minutes
    
    recentAnomalies.forEach(anomaly => {
      const window = Math.floor(anomaly.timestamp.getTime() / windowSize);
      if (!timeWindows.has(window)) {
        timeWindows.set(window, []);
      }
      timeWindows.get(window)!.push(anomaly);
    });
    
    // Look for patterns
    timeWindows.forEach((anomalies, window) => {
      if (anomalies.length >= 2) {
        const affectedMetrics = [...new Set(anomalies.map(a => a.metric))];
        const avgScore = anomalies.reduce((sum, a) => sum + a.score, 0) / anomalies.length;
        
        const pattern: PatternAnomaly = {
          pluginId,
          pattern: this.identifyPattern(affectedMetrics),
          description: this.describePattern(affectedMetrics, anomalies),
          startTime: new Date(window * windowSize),
          endTime: new Date((window + 1) * windowSize),
          affectedMetrics,
          severity: this.calculateSeverity(avgScore, anomalies.length),
          confidence: avgScore,
        };
        
        this.patternAnomalies.push(pattern);
      }
    });
  }
  
  /**
   * Identify pattern type based on affected metrics
   */
  private identifyPattern(metrics: string[]): string {
    const patterns: Record<string, string[]> = {
      'performance-degradation': ['responseTime', 'throughput', 'errorRate'],
      'resource-exhaustion': ['cpuUsage', 'memoryUsage', 'diskUsage'],
      'traffic-spike': ['activeConnections', 'apiCalls', 'throughput'],
      'system-failure': ['availability', 'errorRate', 'crashRate'],
    };
    
    for (const [pattern, indicators] of Object.entries(patterns)) {
      const matches = metrics.filter(m => indicators.includes(m));
      if (matches.length >= 2) {
        return pattern;
      }
    }
    
    return 'unknown-pattern';
  }
  
  /**
   * Generate human-readable pattern description
   */
  private describePattern(metrics: string[], anomalies: AnomalyScore[]): string {
    const metricStr = metrics.join(', ');
    const avgScore = anomalies.reduce((sum, a) => sum + a.score, 0) / anomalies.length;
    
    if (metrics.includes('responseTime') && metrics.includes('errorRate')) {
      return `Performance degradation detected with elevated response times and error rates`;
    }
    
    if (metrics.includes('cpuUsage') && metrics.includes('memoryUsage')) {
      return `Resource exhaustion detected with high CPU and memory usage`;
    }
    
    if (metrics.includes('activeConnections') && metrics.includes('throughput')) {
      return `Traffic spike detected with increased connections and throughput`;
    }
    
    return `Multiple anomalies detected across ${metricStr} with severity score ${avgScore.toFixed(2)}`;
  }
  
  /**
   * Calculate pattern severity
   */
  private calculateSeverity(avgScore: number, count: number): 'low' | 'medium' | 'high' | 'critical' {
    const severityScore = avgScore * Math.log(count + 1);
    
    if (severityScore > 0.8) return 'critical';
    if (severityScore > 0.6) return 'high';
    if (severityScore > 0.4) return 'medium';
    return 'low';
  }
  
  /**
   * Update baseline statistics
   */
  private updateBaseline(pluginId: string, metric: string, buffer: number[]): void {
    if (!this.baselineStats.has(pluginId)) {
      this.baselineStats.set(pluginId, new Map());
    }
    
    const mean = buffer.reduce((sum, v) => sum + v, 0) / buffer.length;
    const variance = buffer.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / buffer.length;
    const std = Math.sqrt(variance);
    
    this.baselineStats.get(pluginId)!.set(metric, { mean, std });
  }
  
  /**
   * Get Z-score threshold based on sensitivity
   */
  private getZScoreThreshold(): number {
    // Map sensitivity to z-score threshold
    // sensitivity 0.99 = z-score 3.0 (very sensitive)
    // sensitivity 0.95 = z-score 2.0 (normal)
    // sensitivity 0.90 = z-score 1.5 (less sensitive)
    return 1.5 + (this.config.sensitivity - 0.9) * 15;
  }
  
  /**
   * Calculate confidence score
   */
  private calculateConfidence(score: number, threshold: number): number {
    if (score <= threshold) {
      return 1 - (score / threshold) * 0.5;
    }
    return 0.5 + Math.min((score - threshold) / threshold, 1) * 0.5;
  }
  
  /**
   * Detect seasonal patterns in metrics
   */
  public detectSeasonality(pluginId: string, metric: string): SeasonalPattern | null {
    const buffer = this.dataBuffer.get(pluginId)?.get(metric);
    if (!buffer || buffer.length < 168) return null; // Need at least a week of hourly data
    
    // Simple FFT-based seasonality detection
    const periods = [
      { name: 'hourly', length: 24 },
      { name: 'daily', length: 168 },
      { name: 'weekly', length: 168 * 4 },
    ];
    
    let bestPattern: SeasonalPattern | null = null;
    let bestStrength = 0;
    
    periods.forEach(period => {
      if (buffer.length < period.length) return;
      
      const pattern = this.extractPattern(buffer, period.length);
      const strength = this.calculatePatternStrength(buffer, pattern);
      
      if (strength > bestStrength && strength > 0.5) {
        bestStrength = strength;
        bestPattern = {
          metric,
          period: period.name as any,
          pattern,
          strength,
        };
      }
    });
    
    if (bestPattern) {
      if (!this.seasonalPatterns.has(pluginId)) {
        this.seasonalPatterns.set(pluginId, []);
      }
      this.seasonalPatterns.get(pluginId)!.push(bestPattern);
    }
    
    return bestPattern;
  }
  
  /**
   * Extract repeating pattern from data
   */
  private extractPattern(data: number[], periodLength: number): number[] {
    const pattern: number[] = new Array(periodLength).fill(0);
    const counts: number[] = new Array(periodLength).fill(0);
    
    for (let i = 0; i < data.length; i++) {
      const index = i % periodLength;
      pattern[index] += data[i];
      counts[index]++;
    }
    
    return pattern.map((sum, i) => counts[i] > 0 ? sum / counts[i] : 0);
  }
  
  /**
   * Calculate how strong a pattern is in the data
   */
  private calculatePatternStrength(data: number[], pattern: number[]): number {
    let totalVariance = 0;
    let patternVariance = 0;
    const mean = data.reduce((sum, v) => sum + v, 0) / data.length;
    
    for (let i = 0; i < data.length; i++) {
      const expected = pattern[i % pattern.length];
      totalVariance += Math.pow(data[i] - mean, 2);
      patternVariance += Math.pow(data[i] - expected, 2);
    }
    
    if (totalVariance === 0) return 0;
    return 1 - (patternVariance / totalVariance);
  }
  
  /**
   * Predict future values based on patterns
   */
  public predictValue(
    pluginId: string,
    metric: string,
    futureTimestamp: Date
  ): { value: number; confidence: number } | null {
    const buffer = this.dataBuffer.get(pluginId)?.get(metric);
    if (!buffer || buffer.length < this.config.minDataPoints) return null;
    
    const stats = this.baselineStats.get(pluginId)?.get(metric);
    if (!stats) return null;
    
    // Simple prediction based on recent trend and seasonality
    const recentValues = buffer.slice(-10);
    const trend = this.calculateTrend(recentValues);
    
    const seasonalPattern = this.seasonalPatterns.get(pluginId)?.find(p => p.metric === metric);
    let predictedValue = stats.mean + trend * 10;
    
    if (seasonalPattern) {
      const hourOfDay = futureTimestamp.getHours();
      const patternIndex = hourOfDay % seasonalPattern.pattern.length;
      predictedValue = seasonalPattern.pattern[patternIndex] + trend * 10;
    }
    
    // Calculate confidence based on data stability
    const recentStd = Math.sqrt(
      recentValues.reduce((sum, v) => sum + Math.pow(v - stats.mean, 2), 0) / recentValues.length
    );
    const confidence = Math.max(0, 1 - (recentStd / stats.mean));
    
    return { value: predictedValue, confidence };
  }
  
  /**
   * Calculate trend in recent values
   */
  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const n = values.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }
    
    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }
  
  /**
   * Get anomaly history
   */
  public getAnomalyHistory(pluginId?: string, limit: number = 100): AnomalyScore[] {
    let history = pluginId 
      ? this.anomalyHistory.filter(a => a.pluginId === pluginId)
      : this.anomalyHistory;
    
    return history.slice(-limit);
  }
  
  /**
   * Get pattern anomalies
   */
  public getPatternAnomalies(pluginId?: string): PatternAnomaly[] {
    return pluginId
      ? this.patternAnomalies.filter(p => p.pluginId === pluginId)
      : this.patternAnomalies;
  }
  
  /**
   * Clear history and reset detection
   */
  public reset(): void {
    this.dataBuffer.clear();
    this.baselineStats.clear();
    this.seasonalPatterns.clear();
    this.anomalyHistory = [];
    this.patternAnomalies = [];
  }
  
  /**
   * Update configuration
   */
  public updateConfig(config: Partial<AnomalyDetectorConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Singleton instance
let instance: AnomalyDetectionService | null = null;

export function getAnomalyDetectionService(): AnomalyDetectionService {
  if (!instance) {
    instance = new AnomalyDetectionService();
  }
  return instance;
}

export default AnomalyDetectionService;