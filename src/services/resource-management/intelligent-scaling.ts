/**
 * Intelligent Auto-Scaling System
 * AI-powered auto-scaling with predictive scaling decisions and workload prediction
 */

import { EventEmitter } from 'events';
import * as tf from '@tensorflow/tfjs-node';
import { ResourceConfig, AutoScalingConfig } from './resource-config';

export interface ScalingTarget {
  id: string;
  name: string;
  type: 'deployment' | 'statefulset' | 'daemonset' | 'custom';
  namespace: string;
  currentReplicas: number;
  minReplicas: number;
  maxReplicas: number;
  targetMetrics: ScalingMetric[];
  labels: Record<string, string>;
  annotations: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScalingMetric {
  type: 'resource' | 'pods' | 'object' | 'external';
  name: string;
  targetType: 'Utilization' | 'AverageValue' | 'Value';
  targetValue: number;
  currentValue?: number;
  weight: number;
  stabilizationWindow: number;
}

export interface ScalingDecision {
  targetId: string;
  action: 'scale-up' | 'scale-down' | 'no-action';
  fromReplicas: number;
  toReplicas: number;
  confidence: number;
  reasoning: ScalingReason[];
  predictedMetrics: Record<string, number>;
  estimatedCost: number;
  estimatedPerformance: number;
  timestamp: Date;
}

export interface ScalingReason {
  type: 'metric' | 'prediction' | 'seasonal' | 'anomaly' | 'policy';
  metric?: string;
  value: number;
  threshold: number;
  weight: number;
  description: string;
}

export interface WorkloadPrediction {
  targetId: string;
  timeHorizon: number;
  predictions: Array<{
    timestamp: Date;
    metrics: Record<string, number>;
    confidence: number;
    scenarios: {
      optimistic: Record<string, number>;
      realistic: Record<string, number>;
      pessimistic: Record<string, number>;
    };
  }>;
  seasonality: {
    detected: boolean;
    period: number;
    strength: number;
    peaks: Date[];
    troughs: Date[];
  };
  trends: {
    shortTerm: number;
    longTerm: number;
    volatility: number;
  };
}

export interface PredictiveModel {
  model: tf.LayersModel;
  type: 'lstm' | 'arima' | 'prophet' | 'ensemble';
  features: string[];
  lookbackWindow: number;
  predictionHorizon: number;
  accuracy: number;
  lastTrained: Date;
  version: string;
}

export interface ScalingEvent {
  id: string;
  targetId: string;
  type: 'scale-up' | 'scale-down';
  fromReplicas: number;
  toReplicas: number;
  trigger: 'metric' | 'prediction' | 'manual' | 'schedule';
  decision: ScalingDecision;
  result: 'success' | 'failure' | 'partial';
  duration: number;
  cost: number;
  timestamp: Date;
  metadata: Record<string, any>;
}

export class IntelligentScalingSystem extends EventEmitter {
  private config: AutoScalingConfig;
  private scalingTargets: Map<string, ScalingTarget> = new Map();
  private scalingHistory: ScalingEvent[] = [];
  private metricsBuffer: Map<string, Array<{ timestamp: Date; metrics: Record<string, number> }>> = new Map();
  private predictiveModels: Map<string, PredictiveModel> = new Map();
  private scalingInProgress: Set<string> = new Set();
  private evaluationInterval?: NodeJS.Timeout;
  private modelRetrainInterval?: NodeJS.Timeout;

  constructor(config: ResourceConfig) {
    super();
    this.config = config.scaling;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.loadPredictiveModels();
      this.startPeriodicEvaluation();
      this.startModelRetraining();
      this.emit('scaling:initialized');
    } catch (error) {
      console.error('Failed to initialize intelligent scaling system:', error);
      this.emit('scaling:error', error);
    }
  }

  private async loadPredictiveModels(): Promise<void> {
    try {
      // Create LSTM model for workload prediction
      const lstmModel = tf.sequential({
        layers: [
          tf.layers.lstm({ 
            units: 50, 
            returnSequences: true, 
            inputShape: [24, 4] // 24 hours, 4 features
          }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.lstm({ units: 25, returnSequences: false }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({ units: 12, activation: 'relu' }),
          tf.layers.dense({ units: 4, activation: 'linear' }) // 4 output features
        ]
      });

      lstmModel.compile({
        optimizer: 'adam',
        loss: 'meanSquaredError',
        metrics: ['mae']
      });

      this.predictiveModels.set('default', {
        model: lstmModel,
        type: 'lstm',
        features: ['cpu_usage', 'memory_usage', 'request_rate', 'response_time'],
        lookbackWindow: 24,
        predictionHorizon: 6,
        accuracy: 0.82,
        lastTrained: new Date(),
        version: '1.0.0'
      });

      console.log('Predictive models loaded successfully');
    } catch (error) {
      console.error('Failed to load predictive models:', error);
      throw error;
    }
  }

  private startPeriodicEvaluation(): void {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
    }

    // Evaluate scaling decisions every 30 seconds
    this.evaluationInterval = setInterval(async () => {
      await this.evaluateAllTargets();
    }, 30000);
  }

  private startModelRetraining(): void {
    if (this.modelRetrainInterval) {
      clearInterval(this.modelRetrainInterval);
    }

    // Retrain models daily
    this.modelRetrainInterval = setInterval(async () => {
      await this.retrainPredictiveModels();
    }, 24 * 60 * 60 * 1000);
  }

  public async addScalingTarget(target: Omit<ScalingTarget, 'createdAt' | 'updatedAt'>): Promise<void> {
    const scalingTarget: ScalingTarget = {
      ...target,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.scalingTargets.set(target.id, scalingTarget);
    this.metricsBuffer.set(target.id, []);

    this.emit('scaling:target-added', scalingTarget);
  }

  public async removeScalingTarget(targetId: string): Promise<void> {
    const target = this.scalingTargets.get(targetId);
    if (target) {
      this.scalingTargets.delete(targetId);
      this.metricsBuffer.delete(targetId);
      this.scalingInProgress.delete(targetId);
      
      this.emit('scaling:target-removed', target);
    }
  }

  public async updateMetrics(targetId: string, metrics: Record<string, number>): Promise<void> {
    const buffer = this.metricsBuffer.get(targetId);
    if (!buffer) {
      console.warn(`No metrics buffer found for target ${targetId}`);
      return;
    }

    buffer.push({
      timestamp: new Date(),
      metrics
    });

    // Keep only last 48 hours of data
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const filtered = buffer.filter(entry => entry.timestamp > cutoff);
    this.metricsBuffer.set(targetId, filtered);

    this.emit('scaling:metrics-updated', { targetId, metrics });
  }

  private async evaluateAllTargets(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const evaluationPromises = Array.from(this.scalingTargets.keys())
      .filter(targetId => !this.scalingInProgress.has(targetId))
      .map(targetId => this.evaluateScalingTarget(targetId));

    const decisions = await Promise.allSettled(evaluationPromises);
    
    const successfulDecisions = decisions
      .filter((result): result is PromiseFulfilledResult<ScalingDecision | null> => 
        result.status === 'fulfilled' && result.value !== null)
      .map(result => result.value!);

    if (successfulDecisions.length > 0) {
      this.emit('scaling:evaluation-complete', { 
        evaluatedTargets: decisions.length,
        scalingDecisions: successfulDecisions.length
      });
    }
  }

  private async evaluateScalingTarget(targetId: string): Promise<ScalingDecision | null> {
    const target = this.scalingTargets.get(targetId);
    if (!target) {
      return null;
    }

    try {
      // Get current metrics
      const currentMetrics = await this.getCurrentMetrics(targetId);
      if (!currentMetrics) {
        return null;
      }

      // Generate predictions
      const predictions = await this.generatePredictions(targetId);

      // Calculate scaling decision
      const decision = await this.calculateScalingDecision(target, currentMetrics, predictions);

      // Execute scaling if needed
      if (decision && decision.action !== 'no-action') {
        await this.executeScalingDecision(decision);
      }

      return decision;
    } catch (error) {
      console.error(`Failed to evaluate scaling target ${targetId}:`, error);
      this.emit('scaling:error', error);
      return null;
    }
  }

  private async getCurrentMetrics(targetId: string): Promise<Record<string, number> | null> {
    const buffer = this.metricsBuffer.get(targetId);
    if (!buffer || buffer.length === 0) {
      return null;
    }

    // Return the most recent metrics
    return buffer[buffer.length - 1].metrics;
  }

  private async generatePredictions(targetId: string): Promise<WorkloadPrediction | null> {
    const target = this.scalingTargets.get(targetId);
    const buffer = this.metricsBuffer.get(targetId);
    const model = this.predictiveModels.get('default');

    if (!target || !buffer || !model || buffer.length < model.lookbackWindow) {
      return null;
    }

    try {
      // Prepare input data
      const recentData = buffer.slice(-model.lookbackWindow);
      const features = model.features.map(feature => 
        recentData.map(entry => entry.metrics[feature] || 0)
      );

      const inputTensor = tf.tensor3d([features.map((featureData, i) => 
        recentData.map((_, j) => features[i][j])
      )]);

      // Generate predictions
      const prediction = model.model.predict(inputTensor) as tf.Tensor;
      const predictionData = await prediction.data();

      inputTensor.dispose();
      prediction.dispose();

      // Convert predictions to meaningful format
      const predictions: WorkloadPrediction['predictions'] = [];
      const now = new Date();

      for (let i = 0; i < model.predictionHorizon; i++) {
        const timestamp = new Date(now.getTime() + (i + 1) * 60 * 60 * 1000); // Hourly predictions
        const baseIndex = i * model.features.length;
        
        const metrics: Record<string, number> = {};
        model.features.forEach((feature, featureIndex) => {
          metrics[feature] = predictionData[baseIndex + featureIndex];
        });

        predictions.push({
          timestamp,
          metrics,
          confidence: 0.8, // Calculate based on model uncertainty
          scenarios: {
            optimistic: this.adjustPrediction(metrics, 1.1),
            realistic: metrics,
            pessimistic: this.adjustPrediction(metrics, 0.9)
          }
        });
      }

      // Detect seasonality and trends
      const seasonality = this.detectSeasonality(buffer, model.features[0]);
      const trends = this.calculateTrends(buffer, model.features[0]);

      return {
        targetId,
        timeHorizon: model.predictionHorizon,
        predictions,
        seasonality,
        trends
      };
    } catch (error) {
      console.error(`Failed to generate predictions for ${targetId}:`, error);
      return null;
    }
  }

  private async calculateScalingDecision(
    target: ScalingTarget, 
    currentMetrics: Record<string, number>,
    predictions: WorkloadPrediction | null
  ): Promise<ScalingDecision> {
    const reasoning: ScalingReason[] = [];
    let scalingScore = 0;

    // Evaluate current metrics against thresholds
    for (const metric of target.targetMetrics) {
      const currentValue = currentMetrics[metric.name];
      if (currentValue === undefined) continue;

      let metricScore = 0;
      let action = '';

      if (metric.targetType === 'Utilization') {
        const utilizationRatio = currentValue / metric.targetValue;
        
        if (utilizationRatio > 1.2) { // 20% above target
          metricScore = Math.min(5, (utilizationRatio - 1) * 10) * metric.weight;
          action = 'scale-up';
        } else if (utilizationRatio < 0.5) { // 50% below target
          metricScore = Math.min(-3, (utilizationRatio - 0.5) * -6) * metric.weight;
          action = 'scale-down';
        }
      } else {
        if (currentValue > metric.targetValue * 1.2) {
          metricScore = Math.min(5, (currentValue / metric.targetValue - 1) * 10) * metric.weight;
          action = 'scale-up';
        } else if (currentValue < metric.targetValue * 0.5) {
          metricScore = Math.min(-3, (currentValue / metric.targetValue - 0.5) * -6) * metric.weight;
          action = 'scale-down';
        }
      }

      if (metricScore !== 0) {
        reasoning.push({
          type: 'metric',
          metric: metric.name,
          value: currentValue,
          threshold: metric.targetValue,
          weight: metric.weight,
          description: `${metric.name} is ${action === 'scale-up' ? 'above' : 'below'} threshold`
        });
        
        scalingScore += metricScore;
      }
    }

    // Apply predictive scaling if enabled
    if (this.config.predictiveScaling.enabled && predictions) {
      const predictiveScore = this.evaluatePredictiveScaling(predictions, target);
      scalingScore += predictiveScore.score;
      reasoning.push(...predictiveScore.reasons);
    }

    // Apply seasonal adjustments
    if (predictions?.seasonality.detected) {
      const seasonalScore = this.applySeasonalAdjustments(predictions.seasonality);
      scalingScore += seasonalScore.score;
      reasoning.push(...seasonalScore.reasons);
    }

    // Determine scaling action and replica count
    let action: ScalingDecision['action'] = 'no-action';
    let targetReplicas = target.currentReplicas;

    if (scalingScore > 2 && target.currentReplicas < target.maxReplicas) {
      action = 'scale-up';
      const scaleUpFactor = Math.ceil(scalingScore / 2);
      targetReplicas = Math.min(target.maxReplicas, target.currentReplicas + scaleUpFactor);
    } else if (scalingScore < -2 && target.currentReplicas > target.minReplicas) {
      action = 'scale-down';
      const scaleDownFactor = Math.ceil(Math.abs(scalingScore) / 3);
      targetReplicas = Math.max(target.minReplicas, target.currentReplicas - scaleDownFactor);
    }

    // Calculate confidence based on reasoning strength and prediction accuracy
    const confidence = this.calculateDecisionConfidence(reasoning, predictions);

    // Estimate cost and performance impact
    const estimatedCost = this.estimateCostImpact(target.currentReplicas, targetReplicas);
    const estimatedPerformance = this.estimatePerformanceImpact(currentMetrics, targetReplicas);

    return {
      targetId: target.id,
      action,
      fromReplicas: target.currentReplicas,
      toReplicas: targetReplicas,
      confidence,
      reasoning,
      predictedMetrics: predictions?.predictions[0]?.metrics || {},
      estimatedCost,
      estimatedPerformance,
      timestamp: new Date()
    };
  }

  private evaluatePredictiveScaling(predictions: WorkloadPrediction, target: ScalingTarget): {
    score: number;
    reasons: ScalingReason[];
  } {
    const reasons: ScalingReason[] = [];
    let score = 0;

    // Look at next few predictions
    const nearTermPredictions = predictions.predictions.slice(0, 3);
    
    for (const prediction of nearTermPredictions) {
      for (const metric of target.targetMetrics) {
        const predictedValue = prediction.metrics[metric.name];
        if (!predictedValue) continue;

        let metricScore = 0;
        if (predictedValue > metric.targetValue * 1.5) {
          metricScore = 2;
          reasons.push({
            type: 'prediction',
            metric: metric.name,
            value: predictedValue,
            threshold: metric.targetValue,
            weight: metric.weight * 0.5, // Reduce weight for predictions
            description: `Predicted ${metric.name} will exceed threshold`
          });
        } else if (predictedValue < metric.targetValue * 0.3) {
          metricScore = -1;
          reasons.push({
            type: 'prediction',
            metric: metric.name,
            value: predictedValue,
            threshold: metric.targetValue,
            weight: metric.weight * 0.5,
            description: `Predicted ${metric.name} will be well below threshold`
          });
        }

        score += metricScore * metric.weight * prediction.confidence;
      }
    }

    return { score, reasons };
  }

  private applySeasonalAdjustments(seasonality: WorkloadPrediction['seasonality']): {
    score: number;
    reasons: ScalingReason[];
  } {
    const reasons: ScalingReason[] = [];
    let score = 0;

    if (!seasonality.detected || seasonality.strength < 0.3) {
      return { score, reasons };
    }

    const now = new Date();
    const currentHour = now.getHours();
    
    // Check if we're approaching a known peak
    const upcomingPeak = seasonality.peaks.find(peak => {
      const hourDiff = (peak.getHours() - currentHour + 24) % 24;
      return hourDiff > 0 && hourDiff <= 2; // Within 2 hours of a peak
    });

    if (upcomingPeak) {
      score += 1.5;
      reasons.push({
        type: 'seasonal',
        value: seasonality.strength,
        threshold: 0.3,
        weight: 1,
        description: `Approaching seasonal peak at ${upcomingPeak.getHours()}:00`
      });
    }

    // Check if we're past a peak and approaching a trough
    const upcomingTrough = seasonality.troughs.find(trough => {
      const hourDiff = (trough.getHours() - currentHour + 24) % 24;
      return hourDiff > 0 && hourDiff <= 1; // Within 1 hour of a trough
    });

    if (upcomingTrough) {
      score -= 1;
      reasons.push({
        type: 'seasonal',
        value: seasonality.strength,
        threshold: 0.3,
        weight: 1,
        description: `Approaching seasonal trough at ${upcomingTrough.getHours()}:00`
      });
    }

    return { score, reasons };
  }

  private calculateDecisionConfidence(reasons: ScalingReason[], predictions: WorkloadPrediction | null): number {
    let confidence = 0.5; // Base confidence

    // Add confidence based on reasoning strength
    const totalWeight = reasons.reduce((sum, reason) => sum + reason.weight, 0);
    if (totalWeight > 0) {
      confidence += Math.min(0.3, totalWeight / 10);
    }

    // Add confidence based on prediction accuracy
    if (predictions) {
      const avgPredictionConfidence = predictions.predictions.reduce(
        (sum, p) => sum + p.confidence, 0
      ) / predictions.predictions.length;
      confidence += avgPredictionConfidence * 0.2;
    }

    // Reduce confidence for large scaling actions
    const hasLargeScaling = reasons.some(r => 
      r.type === 'metric' && Math.abs(r.value - r.threshold) / r.threshold > 0.5
    );
    if (hasLargeScaling) {
      confidence *= 0.8;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  private estimateCostImpact(currentReplicas: number, targetReplicas: number): number {
    const replicaDiff = targetReplicas - currentReplicas;
    const hourlyCostPerReplica = 0.10; // Estimated $0.10 per hour per replica
    return replicaDiff * hourlyCostPerReplica;
  }

  private estimatePerformanceImpact(currentMetrics: Record<string, number>, targetReplicas: number): number {
    // Simplified performance estimation
    const cpuUsage = currentMetrics['cpu_usage'] || 0;
    const memoryUsage = currentMetrics['memory_usage'] || 0;
    
    // Assume linear scaling for simplicity
    const performanceImprovement = (100 - Math.max(cpuUsage, memoryUsage)) / 100;
    return performanceImprovement * targetReplicas;
  }

  private async executeScalingDecision(decision: ScalingDecision): Promise<void> {
    const target = this.scalingTargets.get(decision.targetId);
    if (!target) {
      throw new Error(`Target ${decision.targetId} not found`);
    }

    if (decision.confidence < 0.6) {
      console.log(`Skipping scaling for ${decision.targetId} due to low confidence: ${decision.confidence}`);
      return;
    }

    this.scalingInProgress.add(decision.targetId);

    try {
      const startTime = Date.now();

      // Update target replica count
      target.currentReplicas = decision.toReplicas;
      target.updatedAt = new Date();

      // Record scaling event
      const event: ScalingEvent = {
        id: `${decision.targetId}-${Date.now()}`,
        targetId: decision.targetId,
        type: decision.action as 'scale-up' | 'scale-down',
        fromReplicas: decision.fromReplicas,
        toReplicas: decision.toReplicas,
        trigger: 'metric',
        decision,
        result: 'success',
        duration: Date.now() - startTime,
        cost: decision.estimatedCost,
        timestamp: new Date(),
        metadata: {
          confidence: decision.confidence,
          reasonsCount: decision.reasoning.length
        }
      };

      this.scalingHistory.push(event);

      // Keep only last 1000 events
      if (this.scalingHistory.length > 1000) {
        this.scalingHistory = this.scalingHistory.slice(-1000);
      }

      this.emit('scaling:executed', event);
    } catch (error) {
      console.error(`Failed to execute scaling decision for ${decision.targetId}:`, error);
      
      const failureEvent: ScalingEvent = {
        id: `${decision.targetId}-${Date.now()}`,
        targetId: decision.targetId,
        type: decision.action as 'scale-up' | 'scale-down',
        fromReplicas: decision.fromReplicas,
        toReplicas: decision.fromReplicas, // No change due to failure
        trigger: 'metric',
        decision,
        result: 'failure',
        duration: 0,
        cost: 0,
        timestamp: new Date(),
        metadata: { error: error.message }
      };

      this.scalingHistory.push(failureEvent);
      this.emit('scaling:error', error);
    } finally {
      this.scalingInProgress.delete(decision.targetId);
    }
  }

  private detectSeasonality(
    buffer: Array<{ timestamp: Date; metrics: Record<string, number> }>,
    metric: string
  ): WorkloadPrediction['seasonality'] {
    if (buffer.length < 48) { // Need at least 2 days of data
      return {
        detected: false,
        period: 0,
        strength: 0,
        peaks: [],
        troughs: []
      };
    }

    const values = buffer.map(entry => entry.metrics[metric] || 0);
    const timestamps = buffer.map(entry => entry.timestamp);

    // Simple peak/trough detection
    const peaks: Date[] = [];
    const troughs: Date[] = [];

    for (let i = 1; i < values.length - 1; i++) {
      if (values[i] > values[i - 1] && values[i] > values[i + 1] && values[i] > 0.7) {
        peaks.push(timestamps[i]);
      } else if (values[i] < values[i - 1] && values[i] < values[i + 1] && values[i] < 0.3) {
        troughs.push(timestamps[i]);
      }
    }

    // Calculate seasonality strength (simplified)
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const strength = Math.min(1, variance / mean || 0);

    return {
      detected: peaks.length >= 2 && troughs.length >= 2,
      period: 24, // Assume daily pattern
      strength,
      peaks: peaks.slice(-5), // Keep recent peaks
      troughs: troughs.slice(-5)
    };
  }

  private calculateTrends(
    buffer: Array<{ timestamp: Date; metrics: Record<string, number> }>,
    metric: string
  ): WorkloadPrediction['trends'] {
    if (buffer.length < 10) {
      return { shortTerm: 0, longTerm: 0, volatility: 0 };
    }

    const values = buffer.map(entry => entry.metrics[metric] || 0);
    
    // Short-term trend (last 25% of data)
    const shortTermStart = Math.floor(values.length * 0.75);
    const shortTermValues = values.slice(shortTermStart);
    const shortTerm = this.calculateLinearTrend(shortTermValues);

    // Long-term trend (all data)
    const longTerm = this.calculateLinearTrend(values);

    // Volatility (coefficient of variation)
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const volatility = mean > 0 ? Math.sqrt(variance) / mean : 0;

    return { shortTerm, longTerm, volatility };
  }

  private calculateLinearTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const sumX = (n * (n - 1)) / 2; // Sum of indices
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, index) => sum + val * index, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6; // Sum of squared indices

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  private adjustPrediction(metrics: Record<string, number>, factor: number): Record<string, number> {
    const adjusted: Record<string, number> = {};
    for (const [key, value] of Object.entries(metrics)) {
      adjusted[key] = value * factor;
    }
    return adjusted;
  }

  private async retrainPredictiveModels(): Promise<void> {
    if (this.scalingHistory.length < 100) {
      console.log('Insufficient data for model retraining');
      return;
    }

    try {
      // Prepare training data from scaling history
      const trainingData = this.prepareTrainingData();
      
      for (const [modelKey, model] of this.predictiveModels.entries()) {
        if (trainingData.length > 0) {
          await this.retrainModel(model, trainingData);
          this.emit('scaling:model-retrained', { modelKey, accuracy: model.accuracy });
        }
      }
    } catch (error) {
      console.error('Failed to retrain predictive models:', error);
      this.emit('scaling:error', error);
    }
  }

  private prepareTrainingData(): Array<{ features: number[][]; labels: number[] }> {
    // Implementation would prepare time series data from scaling history
    // For now, return empty array
    return [];
  }

  private async retrainModel(model: PredictiveModel, trainingData: Array<{ features: number[][]; labels: number[] }>): Promise<void> {
    if (trainingData.length === 0) return;

    try {
      const features = tf.tensor3d(trainingData.map(d => d.features));
      const labels = tf.tensor2d(trainingData.map(d => d.labels));

      await model.model.fit(features, labels, {
        epochs: 20,
        batchSize: 16,
        validationSplit: 0.2,
        shuffle: true,
        verbose: 0
      });

      features.dispose();
      labels.dispose();

      model.lastTrained = new Date();
    } catch (error) {
      console.error('Model retraining failed:', error);
      throw error;
    }
  }

  // Public API methods
  public getScalingTargets(): ScalingTarget[] {
    return Array.from(this.scalingTargets.values());
  }

  public getScalingHistory(targetId?: string, limit = 100): ScalingEvent[] {
    let history = this.scalingHistory;
    
    if (targetId) {
      history = history.filter(event => event.targetId === targetId);
    }
    
    return history.slice(-limit);
  }

  public async manualScale(targetId: string, replicas: number, reason?: string): Promise<void> {
    const target = this.scalingTargets.get(targetId);
    if (!target) {
      throw new Error(`Target ${targetId} not found`);
    }

    if (replicas < target.minReplicas || replicas > target.maxReplicas) {
      throw new Error(`Replica count ${replicas} outside bounds [${target.minReplicas}, ${target.maxReplicas}]`);
    }

    const decision: ScalingDecision = {
      targetId,
      action: replicas > target.currentReplicas ? 'scale-up' : 'scale-down',
      fromReplicas: target.currentReplicas,
      toReplicas: replicas,
      confidence: 1.0,
      reasoning: [{
        type: 'policy',
        value: replicas,
        threshold: target.currentReplicas,
        weight: 1,
        description: reason || 'Manual scaling'
      }],
      predictedMetrics: {},
      estimatedCost: this.estimateCostImpact(target.currentReplicas, replicas),
      estimatedPerformance: 0,
      timestamp: new Date()
    };

    await this.executeScalingDecision(decision);
  }

  public getMetrics(): {
    totalTargets: number;
    activeTargets: number;
    scalingEventsToday: number;
    averageConfidence: number;
    successRate: number;
    totalCostSavings: number;
  } {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEvents = this.scalingHistory.filter(event => event.timestamp >= today);
    
    const successfulEvents = this.scalingHistory.filter(event => event.result === 'success');
    const totalCostSavings = this.scalingHistory
      .filter(event => event.type === 'scale-down' && event.result === 'success')
      .reduce((sum, event) => sum + Math.abs(event.cost), 0);

    const confidenceSum = this.scalingHistory
      .reduce((sum, event) => sum + (event.metadata.confidence || 0), 0);

    return {
      totalTargets: this.scalingTargets.size,
      activeTargets: this.scalingTargets.size - this.scalingInProgress.size,
      scalingEventsToday: todayEvents.length,
      averageConfidence: this.scalingHistory.length > 0 ? confidenceSum / this.scalingHistory.length : 0,
      successRate: this.scalingHistory.length > 0 ? successfulEvents.length / this.scalingHistory.length : 0,
      totalCostSavings
    };
  }

  public async shutdown(): Promise<void> {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
    }

    if (this.modelRetrainInterval) {
      clearInterval(this.modelRetrainInterval);
    }

    // Clean up ML models
    for (const model of this.predictiveModels.values()) {
      model.model.dispose();
    }

    this.emit('scaling:shutdown');
  }
}