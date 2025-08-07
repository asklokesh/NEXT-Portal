import { z } from 'zod';
import winston from 'winston';
import { OptimizationRecommendation } from './optimization-engine';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'ai-recommendations.log' })
  ]
});

// AI-powered recommendation schemas
export const MLModelPredictionSchema = z.object({
  modelType: z.enum(['cost_anomaly', 'usage_prediction', 'optimization_scoring', 'seasonal_adjustment']),
  confidence: z.number().min(0).max(1),
  prediction: z.number(),
  features: z.record(z.number()),
  modelVersion: z.string(),
  timestamp: z.date().default(() => new Date())
});

export const CostAnomalySchema = z.object({
  serviceId: z.string(),
  serviceName: z.string(),
  anomalyType: z.enum(['spike', 'drop', 'trend_change', 'seasonal_deviation']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  detectedAt: z.date(),
  actualValue: z.number(),
  expectedValue: z.number(),
  deviationPercent: z.number(),
  contributingFactors: z.array(z.object({
    factor: z.string(),
    impact: z.number(),
    description: z.string()
  })),
  aiConfidence: z.number().min(0).max(1),
  recommendation: z.string()
});

export const UsagePredictionSchema = z.object({
  serviceId: z.string(),
  resourceType: z.string(),
  predictionPeriod: z.enum(['1_day', '1_week', '1_month', '3_months']),
  currentUsage: z.number(),
  predictedUsage: z.number(),
  trend: z.enum(['increasing', 'decreasing', 'stable', 'seasonal']),
  seasonalityDetected: z.boolean(),
  growthRate: z.number(),
  predictionIntervals: z.object({
    lower95: z.number(),
    upper95: z.number(),
    lower80: z.number(),
    upper80: z.number()
  }),
  modelAccuracy: z.number().min(0).max(1)
});

export type MLModelPrediction = z.infer<typeof MLModelPredictionSchema>;
export type CostAnomaly = z.infer<typeof CostAnomalySchema>;
export type UsagePrediction = z.infer<typeof UsagePredictionSchema>;

// Feature engineering for ML models
class FeatureExtractor {
  static extractCostFeatures(historicalData: any[]): Record<string, number> {
    if (historicalData.length === 0) return {};

    const values = historicalData.map(d => d.cost);
    const timestamps = historicalData.map(d => new Date(d.date).getTime());
    
    return {
      mean: values.reduce((a, b) => a + b, 0) / values.length,
      median: this.calculateMedian(values),
      standardDeviation: this.calculateStandardDeviation(values),
      variance: this.calculateVariance(values),
      skewness: this.calculateSkewness(values),
      kurtosis: this.calculateKurtosis(values),
      trend: this.calculateTrend(values),
      seasonality: this.detectSeasonality(values),
      volatility: this.calculateVolatility(values),
      weekday_avg: this.calculateWeekdayAverage(historicalData),
      weekend_avg: this.calculateWeekendAverage(historicalData),
      month_of_year: new Date().getMonth() + 1,
      day_of_week: new Date().getDay(),
      quarter: Math.floor(new Date().getMonth() / 3) + 1,
      days_since_start: (Date.now() - Math.min(...timestamps)) / (1000 * 60 * 60 * 24),
      growth_rate_7d: this.calculateGrowthRate(values.slice(-7)),
      growth_rate_30d: this.calculateGrowthRate(values.slice(-30)),
      min_value: Math.min(...values),
      max_value: Math.max(...values),
      range: Math.max(...values) - Math.min(...values),
      recent_trend_7d: this.calculateTrend(values.slice(-7)),
      recent_trend_30d: this.calculateTrend(values.slice(-30))
    };
  }

  private static calculateMedian(values: number[]): number {
    const sorted = values.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  private static calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private static calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  }

  private static calculateSkewness(values: number[]): number {
    const n = values.length;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const variance = this.calculateVariance(values);
    const skewSum = values.reduce((sum, val) => sum + Math.pow((val - mean) / Math.sqrt(variance), 3), 0);
    return skewSum / n;
  }

  private static calculateKurtosis(values: number[]): number {
    const n = values.length;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const variance = this.calculateVariance(values);
    const kurtSum = values.reduce((sum, val) => sum + Math.pow((val - mean) / Math.sqrt(variance), 4), 0);
    return (kurtSum / n) - 3; // Excess kurtosis
  }

  private static calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    const n = values.length;
    const xSum = (n * (n - 1)) / 2;
    const ySum = values.reduce((a, b) => a + b, 0);
    const xySum = values.reduce((sum, val, idx) => sum + val * idx, 0);
    const x2Sum = (n * (n - 1) * (2 * n - 1)) / 6;
    
    return (n * xySum - xSum * ySum) / (n * x2Sum - xSum * xSum);
  }

  private static detectSeasonality(values: number[]): number {
    if (values.length < 14) return 0;
    
    // Simple seasonality detection using autocorrelation at lag 7 (weekly)
    const lag = 7;
    if (values.length < lag * 2) return 0;
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < values.length - lag; i++) {
      numerator += (values[i] - mean) * (values[i + lag] - mean);
      denominator += Math.pow(values[i] - mean, 2);
    }
    
    return denominator !== 0 ? numerator / denominator : 0;
  }

  private static calculateVolatility(values: number[]): number {
    if (values.length < 2) return 0;
    const returns = [];
    for (let i = 1; i < values.length; i++) {
      returns.push((values[i] - values[i - 1]) / values[i - 1]);
    }
    return this.calculateStandardDeviation(returns);
  }

  private static calculateWeekdayAverage(data: any[]): number {
    const weekdayData = data.filter(d => {
      const day = new Date(d.date).getDay();
      return day >= 1 && day <= 5; // Monday to Friday
    });
    return weekdayData.length > 0 ? 
      weekdayData.reduce((sum, d) => sum + d.cost, 0) / weekdayData.length : 0;
  }

  private static calculateWeekendAverage(data: any[]): number {
    const weekendData = data.filter(d => {
      const day = new Date(d.date).getDay();
      return day === 0 || day === 6; // Saturday and Sunday
    });
    return weekendData.length > 0 ? 
      weekendData.reduce((sum, d) => sum + d.cost, 0) / weekendData.length : 0;
  }

  private static calculateGrowthRate(values: number[]): number {
    if (values.length < 2) return 0;
    const first = values[0];
    const last = values[values.length - 1];
    return first !== 0 ? (last - first) / first : 0;
  }
}

// Anomaly detection using statistical methods
class AnomalyDetector {
  static detectAnomalies(
    historicalData: any[],
    currentValue: number,
    threshold = 2.5 // Standard deviations
  ): CostAnomaly[] {
    const anomalies: CostAnomaly[] = [];
    
    if (historicalData.length < 7) {
      return anomalies; // Need sufficient historical data
    }

    const values = historicalData.map(d => d.cost);
    const features = FeatureExtractor.extractCostFeatures(historicalData);
    
    // Z-score anomaly detection
    const zScore = Math.abs((currentValue - features.mean) / features.standardDeviation);
    
    if (zScore > threshold) {
      const anomalyType = currentValue > features.mean ? 'spike' : 'drop';
      const severity = this.calculateAnomalySeverity(zScore, threshold);
      const deviationPercent = ((currentValue - features.mean) / features.mean) * 100;
      
      const anomaly: CostAnomaly = {
        serviceId: 'current-service',
        serviceName: 'Current Service',
        anomalyType,
        severity,
        detectedAt: new Date(),
        actualValue: currentValue,
        expectedValue: features.mean,
        deviationPercent: Math.abs(deviationPercent),
        contributingFactors: this.identifyContributingFactors(features, currentValue),
        aiConfidence: Math.min(0.95, 0.5 + (zScore - threshold) * 0.1),
        recommendation: this.generateAnomalyRecommendation(anomalyType, severity, deviationPercent)
      };
      
      anomalies.push(anomaly);
    }
    
    return anomalies;
  }

  private static calculateAnomalySeverity(zScore: number, threshold: number): CostAnomaly['severity'] {
    if (zScore > threshold * 2) return 'critical';
    if (zScore > threshold * 1.5) return 'high';
    if (zScore > threshold * 1.2) return 'medium';
    return 'low';
  }

  private static identifyContributingFactors(
    features: Record<string, number>,
    currentValue: number
  ): CostAnomaly['contributingFactors'] {
    const factors: CostAnomaly['contributingFactors'] = [];
    
    // Analyze trend
    if (Math.abs(features.recent_trend_7d) > 0.1) {
      factors.push({
        factor: 'Recent Trend',
        impact: Math.abs(features.recent_trend_7d) * 100,
        description: `${features.recent_trend_7d > 0 ? 'Increasing' : 'Decreasing'} trend over the last 7 days`
      });
    }
    
    // Analyze volatility
    if (features.volatility > 0.2) {
      factors.push({
        factor: 'High Volatility',
        impact: features.volatility * 100,
        description: 'Service shows high cost volatility patterns'
      });
    }
    
    // Analyze seasonality
    if (Math.abs(features.seasonality) > 0.3) {
      factors.push({
        factor: 'Seasonal Pattern',
        impact: Math.abs(features.seasonality) * 100,
        description: 'Detected seasonal usage patterns affecting costs'
      });
    }
    
    return factors;
  }

  private static generateAnomalyRecommendation(
    type: CostAnomaly['anomalyType'],
    severity: CostAnomaly['severity'],
    deviationPercent: number
  ): string {
    if (type === 'spike') {
      if (severity === 'critical') {
        return `Immediate investigation required. Cost spike of ${deviationPercent.toFixed(1)}% detected. Check for resource scaling events, configuration changes, or potential security issues.`;
      } else {
        return `Monitor closely. Cost increase of ${deviationPercent.toFixed(1)}% may indicate increased usage or efficiency issues.`;
      }
    } else {
      return `Cost drop of ${deviationPercent.toFixed(1)}% detected. Verify if this indicates reduced usage or potential monitoring gaps.`;
    }
  }
}

// Usage prediction using simple time series analysis
class UsagePredictor {
  static predictUsage(
    historicalData: any[],
    predictionPeriod: UsagePrediction['predictionPeriod'] = '1_week'
  ): UsagePrediction | null {
    if (historicalData.length < 14) {
      return null; // Need sufficient data for prediction
    }

    const values = historicalData.map(d => d.cost);
    const features = FeatureExtractor.extractCostFeatures(historicalData);
    const currentUsage = values[values.length - 1];
    
    // Simple linear trend prediction
    const periodMultiplier = this.getPeriodMultiplier(predictionPeriod);
    const predictedUsage = currentUsage + (features.trend * periodMultiplier);
    
    // Calculate prediction intervals using historical volatility
    const stdDev = features.standardDeviation;
    const intervals = {
      lower95: predictedUsage - (1.96 * stdDev),
      upper95: predictedUsage + (1.96 * stdDev),
      lower80: predictedUsage - (1.28 * stdDev),
      upper80: predictedUsage + (1.28 * stdDev)
    };
    
    // Determine trend classification
    const growthRate = features.growth_rate_30d;
    let trend: UsagePrediction['trend'];
    if (Math.abs(features.seasonality) > 0.3) {
      trend = 'seasonal';
    } else if (growthRate > 0.05) {
      trend = 'increasing';
    } else if (growthRate < -0.05) {
      trend = 'decreasing';
    } else {
      trend = 'stable';
    }
    
    return {
      serviceId: 'predicted-service',
      resourceType: 'compute',
      predictionPeriod,
      currentUsage,
      predictedUsage: Math.max(0, predictedUsage), // Ensure non-negative
      trend,
      seasonalityDetected: Math.abs(features.seasonality) > 0.3,
      growthRate: growthRate * 100,
      predictionIntervals: intervals,
      modelAccuracy: this.calculateModelAccuracy(values, features)
    };
  }

  private static getPeriodMultiplier(period: UsagePrediction['predictionPeriod']): number {
    switch (period) {
      case '1_day': return 1;
      case '1_week': return 7;
      case '1_month': return 30;
      case '3_months': return 90;
      default: return 7;
    }
  }

  private static calculateModelAccuracy(values: number[], features: Record<string, number>): number {
    // Simple accuracy estimation based on data characteristics
    let accuracy = 0.7; // Base accuracy
    
    // More data = higher accuracy
    if (values.length > 90) accuracy += 0.1;
    else if (values.length > 30) accuracy += 0.05;
    
    // Lower volatility = higher accuracy
    if (features.volatility < 0.1) accuracy += 0.1;
    else if (features.volatility > 0.3) accuracy -= 0.1;
    
    // Strong trend = higher accuracy for trend prediction
    if (Math.abs(features.trend) > 0.1) accuracy += 0.05;
    
    return Math.max(0.5, Math.min(0.95, accuracy));
  }
}

// Main AI recommendations engine
export class AIRecommendationsEngine {
  private static instance: AIRecommendationsEngine | null = null;
  
  static getInstance(): AIRecommendationsEngine {
    if (!this.instance) {
      this.instance = new AIRecommendationsEngine();
    }
    return this.instance;
  }

  // Enhanced recommendation scoring using AI features
  scoreRecommendations(
    recommendations: OptimizationRecommendation[],
    historicalData: Record<string, any[]>
  ): OptimizationRecommendation[] {
    return recommendations.map(rec => {
      const serviceData = historicalData[rec.serviceId] || [];
      const aiScore = this.calculateAIScore(rec, serviceData);
      
      // Adjust confidence based on AI analysis
      rec.confidence = Math.min(0.95, rec.confidence * aiScore.confidenceMultiplier);
      
      // Add AI insights to metadata
      rec.metadata.aiInsights = {
        score: aiScore.score,
        factors: aiScore.factors,
        riskAdjustment: aiScore.riskAdjustment
      };
      
      return rec;
    }).sort((a, b) => {
      // Sort by AI-enhanced priority score
      const scoreA = (a.metadata.aiInsights?.score || 0.5) * a.potentialSavings;
      const scoreB = (b.metadata.aiInsights?.score || 0.5) * b.potentialSavings;
      return scoreB - scoreA;
    });
  }

  private calculateAIScore(
    recommendation: OptimizationRecommendation,
    historicalData: any[]
  ): {
    score: number;
    confidenceMultiplier: number;
    factors: string[];
    riskAdjustment: number;
  } {
    let score = 0.5; // Base score
    let confidenceMultiplier = 1.0;
    const factors: string[] = [];
    let riskAdjustment = 1.0;
    
    if (historicalData.length > 0) {
      const features = FeatureExtractor.extractCostFeatures(historicalData);
      
      // Factor 1: Data stability (low volatility = higher confidence)
      if (features.volatility < 0.1) {
        score += 0.2;
        confidenceMultiplier *= 1.2;
        factors.push('Stable cost patterns');
      } else if (features.volatility > 0.3) {
        score -= 0.1;
        confidenceMultiplier *= 0.8;
        factors.push('High cost volatility');
        riskAdjustment *= 1.2;
      }
      
      // Factor 2: Trend alignment
      if (recommendation.type === 'rightsizing' && features.trend > 0) {
        score += 0.15;
        factors.push('Increasing usage trend supports rightsizing');
      } else if (recommendation.type === 'idle_resources' && features.recent_trend_7d < -0.1) {
        score += 0.2;
        factors.push('Decreasing usage confirms resource idleness');
      }
      
      // Factor 3: Seasonality consideration
      if (Math.abs(features.seasonality) > 0.3) {
        if (recommendation.type === 'reserved_instances') {
          score += 0.1;
          factors.push('Seasonal patterns favor reserved instances');
        } else {
          riskAdjustment *= 1.1;
          factors.push('Seasonal patterns require careful timing');
        }
      }
      
      // Factor 4: Historical performance
      const consistencyScore = 1 - Math.min(1, features.volatility);
      score += consistencyScore * 0.1;
      
      if (consistencyScore > 0.8) {
        factors.push('High cost consistency');
      }
    }
    
    // Factor 5: Recommendation type specific scoring
    switch (recommendation.type) {
      case 'idle_resources':
        score += 0.2; // High confidence for idle resources
        confidenceMultiplier *= 1.3;
        break;
      case 'rightsizing':
        if (recommendation.implementationEffort === 'low') {
          score += 0.15;
        }
        break;
      case 'reserved_instances':
        if (recommendation.potentialSavings > 200) {
          score += 0.1;
        }
        break;
    }
    
    // Normalize score
    score = Math.max(0.1, Math.min(1.0, score));
    
    return {
      score,
      confidenceMultiplier: Math.max(0.5, Math.min(1.5, confidenceMultiplier)),
      factors,
      riskAdjustment: Math.max(0.8, Math.min(2.0, riskAdjustment))
    };
  }

  // Detect cost anomalies for all services
  detectCostAnomalies(servicesData: Record<string, any[]>): CostAnomaly[] {
    const anomalies: CostAnomaly[] = [];
    
    for (const [serviceId, data] of Object.entries(servicesData)) {
      if (data.length === 0) continue;
      
      const currentCost = data[data.length - 1]?.cost || 0;
      const serviceAnomalies = AnomalyDetector.detectAnomalies(data.slice(0, -1), currentCost);
      
      serviceAnomalies.forEach(anomaly => {
        anomaly.serviceId = serviceId;
        // In a real implementation, you would fetch the service name
        anomaly.serviceName = `Service ${serviceId}`;
      });
      
      anomalies.push(...serviceAnomalies);
    }
    
    return anomalies;
  }

  // Generate usage predictions for services
  generateUsagePredictions(
    servicesData: Record<string, any[]>,
    predictionPeriod: UsagePrediction['predictionPeriod'] = '1_month'
  ): UsagePrediction[] {
    const predictions: UsagePrediction[] = [];
    
    for (const [serviceId, data] of Object.entries(servicesData)) {
      const prediction = UsagePredictor.predictUsage(data, predictionPeriod);
      
      if (prediction) {
        prediction.serviceId = serviceId;
        predictions.push(prediction);
      }
    }
    
    return predictions;
  }

  // Generate ML model prediction
  generateMLPrediction(
    modelType: MLModelPrediction['modelType'],
    inputFeatures: Record<string, number>,
    modelVersion = '1.0.0'
  ): MLModelPrediction {
    // Simplified ML prediction - in a real implementation, this would call actual ML models
    let prediction = 0;
    let confidence = 0.7;
    
    switch (modelType) {
      case 'cost_anomaly':
        // Simple anomaly score based on z-score
        const zScore = Math.abs(inputFeatures.z_score || 0);
        prediction = Math.min(1, zScore / 3); // Normalize to 0-1
        confidence = Math.min(0.95, 0.5 + (zScore * 0.1));
        break;
        
      case 'usage_prediction':
        // Simple linear prediction
        prediction = (inputFeatures.current_usage || 0) * (1 + (inputFeatures.trend || 0));
        confidence = 0.8 - Math.min(0.3, inputFeatures.volatility || 0);
        break;
        
      case 'optimization_scoring':
        // Weighted score based on multiple factors
        prediction = (
          (inputFeatures.potential_savings || 0) * 0.4 +
          (inputFeatures.implementation_ease || 0) * 0.3 +
          (inputFeatures.data_quality || 0) * 0.3
        );
        confidence = inputFeatures.data_quality || 0.7;
        break;
        
      case 'seasonal_adjustment':
        // Seasonal adjustment factor
        const monthFactor = Math.sin((new Date().getMonth() / 12) * 2 * Math.PI);
        prediction = 1 + (monthFactor * (inputFeatures.seasonality_strength || 0.1));
        confidence = 0.6;
        break;
    }
    
    return {
      modelType,
      confidence,
      prediction,
      features: inputFeatures,
      modelVersion,
      timestamp: new Date()
    };
  }
}

// Export singleton instance
export const aiRecommendationsEngine = AIRecommendationsEngine.getInstance();
export default AIRecommendationsEngine;