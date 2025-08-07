// Continuous Learning and Feedback System

import { EventEmitter } from 'events';
import * as tf from '@tensorflow/tfjs-node';
import {
  Recommendation,
  FeedbackData,
  LearningMetrics,
  ModelConfig,
  ABTestConfig,
  ABTestVariant,
  ABTestResults,
  Impact,
  RecommendationType
} from './types';

interface TrainingData {
  features: number[][];
  labels: number[][];
  metadata: {
    recommendationType: string;
    timestamp: Date;
    source: string;
  };
}

interface ModelPerformance {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  confusionMatrix: number[][];
  timestamp: Date;
}

export class ContinuousLearningSystem extends EventEmitter {
  private feedbackStore: Map<string, FeedbackData[]>;
  private learningMetrics: Map<string, LearningMetrics>;
  private models: Map<string, tf.LayersModel>;
  private trainingQueue: TrainingData[];
  private abTests: Map<string, ABTestConfig>;
  private modelConfigs: Map<string, ModelConfig>;
  private performanceHistory: ModelPerformance[];
  private retrainingThreshold: number;
  private isTraining: boolean;

  constructor() {
    super();
    this.feedbackStore = new Map();
    this.learningMetrics = new Map();
    this.models = new Map();
    this.trainingQueue = [];
    this.abTests = new Map();
    this.modelConfigs = new Map();
    this.performanceHistory = [];
    this.retrainingThreshold = 0.1; // 10% performance degradation triggers retraining
    this.isTraining = false;
  }

  async initialize(): Promise<void> {
    await this.loadModels();
    await this.loadHistoricalData();
    this.startContinuousLearningLoop();
    this.emit('initialized');
  }

  private async loadModels(): Promise<void> {
    // Load existing models or create new ones
    const modelTypes = [
      'recommendation_scorer',
      'impact_predictor',
      'effort_estimator',
      'success_predictor'
    ];

    for (const modelType of modelTypes) {
      const model = await this.createOrLoadModel(modelType);
      this.models.set(modelType, model);
      
      const config: ModelConfig = {
        version: '1.0.0',
        features: this.getModelFeatures(modelType),
        hyperparameters: this.getDefaultHyperparameters(modelType),
        thresholds: this.getDefaultThresholds(modelType),
        weights: {},
        lastTraining: new Date(),
        accuracy: 0.85
      };
      
      this.modelConfigs.set(modelType, config);
    }
  }

  private async createOrLoadModel(modelType: string): Promise<tf.LayersModel> {
    try {
      // Try to load existing model
      const model = await tf.loadLayersModel(`file://./models/${modelType}/model.json`);
      return model;
    } catch (error) {
      // Create new model if not found
      return this.createNewModel(modelType);
    }
  }

  private createNewModel(modelType: string): tf.LayersModel {
    const inputDim = this.getInputDimension(modelType);
    const outputDim = this.getOutputDimension(modelType);

    const model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [inputDim],
          units: 128,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({
          units: 64,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 32,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: outputDim,
          activation: modelType === 'recommendation_scorer' ? 'sigmoid' : 'linear'
        })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: modelType === 'recommendation_scorer' ? 'binaryCrossentropy' : 'meanSquaredError',
      metrics: ['accuracy', 'precision', 'recall']
    });

    return model;
  }

  private getInputDimension(modelType: string): number {
    const dimensions: Record<string, number> = {
      'recommendation_scorer': 15,
      'impact_predictor': 12,
      'effort_estimator': 10,
      'success_predictor': 20
    };
    return dimensions[modelType] || 10;
  }

  private getOutputDimension(modelType: string): number {
    const dimensions: Record<string, number> = {
      'recommendation_scorer': 1,
      'impact_predictor': 7, // 7 impact dimensions
      'effort_estimator': 1,
      'success_predictor': 1
    };
    return dimensions[modelType] || 1;
  }

  private getModelFeatures(modelType: string): string[] {
    const features: Record<string, string[]> = {
      'recommendation_scorer': [
        'category', 'type', 'impact_score', 'effort_hours', 'risk_level',
        'evidence_count', 'dependency_count', 'service_criticality',
        'team_experience', 'historical_success', 'urgency', 'alignment',
        'roi_estimate', 'confidence', 'complexity'
      ],
      'impact_predictor': [
        'category', 'type', 'current_performance', 'current_cost',
        'current_security', 'service_size', 'user_count', 'change_scope',
        'implementation_quality', 'team_skill', 'time_invested', 'resources_used'
      ],
      'effort_estimator': [
        'category', 'type', 'code_complexity', 'service_size',
        'dependency_count', 'test_coverage', 'technical_debt',
        'team_size', 'team_experience', 'tool_availability'
      ],
      'success_predictor': [
        'category', 'type', 'impact_score', 'effort_hours', 'team_experience',
        'test_coverage', 'documentation_quality', 'stakeholder_buy_in',
        'resource_availability', 'dependency_stability', 'risk_mitigation',
        'historical_success', 'service_maturity', 'change_frequency',
        'rollback_capability', 'monitoring_coverage', 'automation_level',
        'communication_quality', 'planning_quality', 'execution_quality'
      ]
    };
    return features[modelType] || [];
  }

  private getDefaultHyperparameters(modelType: string): Record<string, any> {
    return {
      learningRate: 0.001,
      batchSize: 32,
      epochs: 100,
      validationSplit: 0.2,
      earlyStopping: true,
      patience: 10,
      minDelta: 0.001
    };
  }

  private getDefaultThresholds(modelType: string): Record<string, number> {
    return {
      minConfidence: 0.7,
      minAccuracy: 0.8,
      maxError: 0.2,
      retrainingThreshold: 0.1
    };
  }

  private async loadHistoricalData(): Promise<void> {
    // Load historical feedback and metrics
    // In production, this would load from a database
    try {
      // Simulated historical data loading
      const historicalFeedback = await this.fetchHistoricalFeedback();
      historicalFeedback.forEach(feedback => {
        const recommendationId = feedback.recommendationId;
        if (!this.feedbackStore.has(recommendationId)) {
          this.feedbackStore.set(recommendationId, []);
        }
        this.feedbackStore.get(recommendationId)!.push(feedback);
      });
    } catch (error) {
      console.error('Failed to load historical data:', error);
    }
  }

  private async fetchHistoricalFeedback(): Promise<FeedbackData[]> {
    // Simulate fetching from database
    return [];
  }

  private startContinuousLearningLoop(): void {
    // Start periodic retraining
    setInterval(() => {
      this.checkAndRetrain();
    }, 24 * 60 * 60 * 1000); // Daily check

    // Start feedback processing
    setInterval(() => {
      this.processFeedbackQueue();
    }, 60 * 60 * 1000); // Hourly processing
  }

  async recordFeedback(feedback: FeedbackData): Promise<void> {
    const { recommendationId } = feedback;
    
    if (!this.feedbackStore.has(recommendationId)) {
      this.feedbackStore.set(recommendationId, []);
    }
    
    this.feedbackStore.get(recommendationId)!.push(feedback);
    
    // Update learning metrics
    await this.updateLearningMetrics(recommendationId);
    
    // Add to training queue if sufficient feedback
    if (this.shouldAddToTrainingQueue(recommendationId)) {
      await this.prepareTrainingData(recommendationId);
    }

    this.emit('feedback-recorded', feedback);
  }

  private async updateLearningMetrics(recommendationId: string): Promise<void> {
    const feedbackList = this.feedbackStore.get(recommendationId) || [];
    if (feedbackList.length === 0) return;

    const metrics: LearningMetrics = {
      recommendationId,
      acceptanceRate: this.calculateAcceptanceRate(feedbackList),
      implementationRate: this.calculateImplementationRate(feedbackList),
      successRate: this.calculateSuccessRate(feedbackList),
      averageImpact: this.calculateAverageImpact(feedbackList),
      feedbackScore: this.calculateFeedbackScore(feedbackList),
      confidenceAdjustment: this.calculateConfidenceAdjustment(feedbackList)
    };

    this.learningMetrics.set(recommendationId, metrics);
  }

  private calculateAcceptanceRate(feedback: FeedbackData[]): number {
    const accepted = feedback.filter(f => f.helpful).length;
    return feedback.length > 0 ? accepted / feedback.length : 0;
  }

  private calculateImplementationRate(feedback: FeedbackData[]): number {
    const implemented = feedback.filter(f => f.implemented).length;
    return feedback.length > 0 ? implemented / feedback.length : 0;
  }

  private calculateSuccessRate(feedback: FeedbackData[]): number {
    const successful = feedback.filter(f => 
      f.implemented && f.actualImpact && this.isSuccessful(f.actualImpact)
    ).length;
    const implemented = feedback.filter(f => f.implemented).length;
    return implemented > 0 ? successful / implemented : 0;
  }

  private isSuccessful(impact: Impact): boolean {
    // Define success criteria
    const successScore = (
      impact.performance * 0.2 +
      impact.security * 0.2 +
      impact.cost * 0.15 +
      impact.reliability * 0.2 +
      impact.maintainability * 0.1 +
      impact.userExperience * 0.1 +
      impact.businessValue * 0.05
    ) / 100;
    
    return successScore > 0.6; // 60% threshold for success
  }

  private calculateAverageImpact(feedback: FeedbackData[]): Impact {
    const impacts = feedback
      .filter(f => f.actualImpact)
      .map(f => f.actualImpact!);

    if (impacts.length === 0) {
      return {
        performance: 0,
        security: 0,
        cost: 0,
        reliability: 0,
        maintainability: 0,
        userExperience: 0,
        businessValue: 0,
        description: 'No impact data available'
      };
    }

    return {
      performance: this.average(impacts.map(i => i.performance)),
      security: this.average(impacts.map(i => i.security)),
      cost: this.average(impacts.map(i => i.cost)),
      reliability: this.average(impacts.map(i => i.reliability)),
      maintainability: this.average(impacts.map(i => i.maintainability)),
      userExperience: this.average(impacts.map(i => i.userExperience)),
      businessValue: this.average(impacts.map(i => i.businessValue)),
      description: 'Average actual impact from feedback'
    };
  }

  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }

  private calculateFeedbackScore(feedback: FeedbackData[]): number {
    const weights = {
      helpful: 0.3,
      implemented: 0.4,
      successful: 0.3
    };

    const helpfulRate = this.calculateAcceptanceRate(feedback);
    const implementationRate = this.calculateImplementationRate(feedback);
    const successRate = this.calculateSuccessRate(feedback);

    return (
      helpfulRate * weights.helpful +
      implementationRate * weights.implemented +
      successRate * weights.successful
    ) * 100;
  }

  private calculateConfidenceAdjustment(feedback: FeedbackData[]): number {
    const score = this.calculateFeedbackScore(feedback);
    
    // Adjust confidence based on feedback score
    if (score > 80) return 1.2;
    if (score > 60) return 1.0;
    if (score > 40) return 0.8;
    return 0.6;
  }

  private shouldAddToTrainingQueue(recommendationId: string): boolean {
    const feedback = this.feedbackStore.get(recommendationId) || [];
    return feedback.length >= 5; // Minimum feedback threshold
  }

  private async prepareTrainingData(recommendationId: string): Promise<void> {
    const feedback = this.feedbackStore.get(recommendationId) || [];
    const metrics = this.learningMetrics.get(recommendationId);
    
    if (!metrics) return;

    // Extract features and labels
    const features = this.extractFeatures(recommendationId, feedback);
    const labels = this.extractLabels(metrics);

    const trainingData: TrainingData = {
      features: [features],
      labels: [labels],
      metadata: {
        recommendationType: this.getRecommendationType(recommendationId),
        timestamp: new Date(),
        source: 'user_feedback'
      }
    };

    this.trainingQueue.push(trainingData);
  }

  private extractFeatures(
    recommendationId: string,
    feedback: FeedbackData[]
  ): number[] {
    // Extract relevant features from feedback
    return [
      feedback.length,
      this.calculateAcceptanceRate(feedback),
      this.calculateImplementationRate(feedback),
      this.calculateSuccessRate(feedback),
      // Add more features as needed
    ];
  }

  private extractLabels(metrics: LearningMetrics): number[] {
    return [
      metrics.acceptanceRate,
      metrics.implementationRate,
      metrics.successRate,
      metrics.feedbackScore / 100
    ];
  }

  private getRecommendationType(recommendationId: string): string {
    // In production, retrieve from recommendation storage
    return 'unknown';
  }

  private async processFeedbackQueue(): Promise<void> {
    if (this.trainingQueue.length < 10) return; // Minimum batch size

    const batch = this.trainingQueue.splice(0, 100); // Process up to 100 items
    
    // Group by model type
    const modelBatches = new Map<string, TrainingData[]>();
    
    batch.forEach(data => {
      const modelType = this.determineModelType(data.metadata.recommendationType);
      if (!modelBatches.has(modelType)) {
        modelBatches.set(modelType, []);
      }
      modelBatches.get(modelType)!.push(data);
    });

    // Update each model
    for (const [modelType, trainingData] of modelBatches) {
      await this.updateModel(modelType, trainingData);
    }
  }

  private determineModelType(recommendationType: string): string {
    // Map recommendation types to model types
    return 'recommendation_scorer'; // Simplified
  }

  private async updateModel(
    modelType: string,
    trainingData: TrainingData[]
  ): Promise<void> {
    const model = this.models.get(modelType);
    if (!model) return;

    // Prepare training data
    const features = trainingData.flatMap(d => d.features);
    const labels = trainingData.flatMap(d => d.labels);

    const xs = tf.tensor2d(features);
    const ys = tf.tensor2d(labels);

    // Fine-tune the model
    const history = await model.fit(xs, ys, {
      epochs: 10, // Fewer epochs for fine-tuning
      batchSize: 16,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          this.emit('training-progress', { modelType, epoch, logs });
        }
      }
    });

    // Update model config
    const config = this.modelConfigs.get(modelType);
    if (config) {
      config.lastTraining = new Date();
      config.version = this.incrementVersion(config.version);
    }

    // Clean up tensors
    xs.dispose();
    ys.dispose();

    this.emit('model-updated', { modelType, version: config?.version });
  }

  private incrementVersion(version: string): string {
    const parts = version.split('.');
    parts[2] = (parseInt(parts[2]) + 1).toString();
    return parts.join('.');
  }

  private async checkAndRetrain(): Promise<void> {
    if (this.isTraining) return;

    for (const [modelType, model] of this.models) {
      const shouldRetrain = await this.shouldRetrainModel(modelType);
      
      if (shouldRetrain) {
        this.isTraining = true;
        await this.retrainModel(modelType);
        this.isTraining = false;
      }
    }
  }

  private async shouldRetrainModel(modelType: string): Promise<boolean> {
    const config = this.modelConfigs.get(modelType);
    if (!config) return false;

    // Check time since last training
    const daysSinceTraining = 
      (Date.now() - config.lastTraining.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceTraining > 7) return true; // Weekly retraining

    // Check performance degradation
    const currentPerformance = await this.evaluateModelPerformance(modelType);
    const degradation = config.accuracy - currentPerformance.accuracy;
    
    if (degradation > this.retrainingThreshold) return true;

    // Check if sufficient new data
    if (this.trainingQueue.length > 100) return true;

    return false;
  }

  private async evaluateModelPerformance(modelType: string): Promise<ModelPerformance> {
    const model = this.models.get(modelType);
    if (!model) {
      return {
        accuracy: 0,
        precision: 0,
        recall: 0,
        f1Score: 0,
        confusionMatrix: [[0]],
        timestamp: new Date()
      };
    }

    // Evaluate on validation set
    // This is simplified - in production, use proper validation data
    const performance: ModelPerformance = {
      accuracy: 0.85, // Placeholder
      precision: 0.87,
      recall: 0.83,
      f1Score: 0.85,
      confusionMatrix: [
        [85, 15],
        [17, 83]
      ],
      timestamp: new Date()
    };

    this.performanceHistory.push(performance);
    return performance;
  }

  private async retrainModel(modelType: string): Promise<void> {
    this.emit('retraining-started', { modelType });

    const model = this.models.get(modelType);
    if (!model) return;

    // Prepare full training dataset
    const trainingData = await this.prepareFullTrainingDataset(modelType);
    
    // Create new model architecture if needed
    const newModel = this.createNewModel(modelType);

    // Train from scratch
    const xs = tf.tensor2d(trainingData.features);
    const ys = tf.tensor2d(trainingData.labels);

    await newModel.fit(xs, ys, {
      epochs: 100,
      batchSize: 32,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          this.emit('retraining-progress', { modelType, epoch, logs });
        },
        onTrainEnd: async () => {
          // Save the new model
          await newModel.save(`file://./models/${modelType}/model.json`);
          
          // Replace old model
          this.models.set(modelType, newModel);
          
          // Update config
          const config = this.modelConfigs.get(modelType);
          if (config) {
            config.lastTraining = new Date();
            config.version = this.incrementMajorVersion(config.version);
            const performance = await this.evaluateModelPerformance(modelType);
            config.accuracy = performance.accuracy;
          }
          
          this.emit('retraining-completed', { modelType, config });
        }
      }
    });

    xs.dispose();
    ys.dispose();
  }

  private async prepareFullTrainingDataset(modelType: string): Promise<TrainingData> {
    // Combine historical data with recent feedback
    // This is simplified - in production, load from database
    return {
      features: [[1, 2, 3, 4, 5]], // Placeholder
      labels: [[0.8]],
      metadata: {
        recommendationType: modelType,
        timestamp: new Date(),
        source: 'full_dataset'
      }
    };
  }

  private incrementMajorVersion(version: string): string {
    const parts = version.split('.');
    parts[0] = (parseInt(parts[0]) + 1).toString();
    parts[1] = '0';
    parts[2] = '0';
    return parts.join('.');
  }

  // A/B Testing
  async createABTest(config: ABTestConfig): Promise<void> {
    this.abTests.set(config.id, config);
    
    this.emit('ab-test-created', config);
  }

  async assignToVariant(
    testId: string,
    entityId: string
  ): Promise<ABTestVariant | null> {
    const test = this.abTests.get(testId);
    if (!test || test.status !== 'active') return null;

    // Simple random assignment based on allocation
    const random = Math.random() * 100;
    let cumulative = 0;

    for (const variant of test.variants) {
      cumulative += variant.allocation;
      if (random <= cumulative) {
        return variant;
      }
    }

    return test.variants[0]; // Fallback to control
  }

  async recordABTestResult(
    testId: string,
    variantId: string,
    result: any
  ): Promise<void> {
    const test = this.abTests.get(testId);
    if (!test) return;

    const variant = test.variants.find(v => v.id === variantId);
    if (!variant) return;

    // Update variant results
    if (!variant.results) {
      variant.results = {
        sampleSize: 0,
        conversionRate: 0,
        averageImpact: 0,
        confidence: 0,
        pValue: 1
      };
    }

    variant.results.sampleSize++;
    // Update other metrics based on result
    
    // Check for statistical significance
    if (variant.results.sampleSize >= 100) {
      await this.calculateStatisticalSignificance(test);
    }
  }

  private async calculateStatisticalSignificance(test: ABTestConfig): Promise<void> {
    // Simplified statistical analysis
    const control = test.variants[0];
    const treatment = test.variants[1];

    if (!control.results || !treatment.results) return;

    // Calculate p-value (simplified)
    const pValue = this.calculatePValue(
      control.results,
      treatment.results
    );

    treatment.results.pValue = pValue;
    treatment.results.confidence = 1 - pValue;

    // Check if test should be concluded
    if (pValue < 0.05 && treatment.results.sampleSize >= 1000) {
      test.status = 'completed';
      this.emit('ab-test-completed', {
        testId: test.id,
        winner: pValue < 0.05 ? treatment.id : control.id,
        results: test.variants.map(v => ({ ...v }))
      });
    }
  }

  private calculatePValue(
    control: ABTestResults,
    treatment: ABTestResults
  ): number {
    // Simplified p-value calculation
    // In production, use proper statistical library
    const diff = Math.abs(treatment.conversionRate - control.conversionRate);
    const se = Math.sqrt(
      (control.conversionRate * (1 - control.conversionRate) / control.sampleSize) +
      (treatment.conversionRate * (1 - treatment.conversionRate) / treatment.sampleSize)
    );
    
    const z = diff / se;
    // Approximate p-value from z-score
    return 2 * (1 - this.normalCDF(Math.abs(z)));
  }

  private normalCDF(z: number): number {
    // Approximation of normal CDF
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp(-z * z / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z > 0 ? 1 - p : p;
  }

  // Success monitoring
  async trackRecommendationSuccess(
    recommendationId: string,
    metrics: any
  ): Promise<void> {
    const learningMetrics = this.learningMetrics.get(recommendationId);
    if (!learningMetrics) return;

    // Update success metrics
    this.emit('success-tracked', {
      recommendationId,
      metrics,
      learningMetrics
    });
  }

  async getModelInsights(): Promise<any> {
    const insights = {
      models: {} as any,
      performance: this.performanceHistory.slice(-10), // Last 10 evaluations
      feedbackSummary: this.summarizeFeedback(),
      activeABTests: Array.from(this.abTests.values()).filter(t => t.status === 'active'),
      trainingQueueSize: this.trainingQueue.length
    };

    for (const [modelType, config] of this.modelConfigs) {
      insights.models[modelType] = {
        version: config.version,
        accuracy: config.accuracy,
        lastTraining: config.lastTraining,
        features: config.features.length
      };
    }

    return insights;
  }

  private summarizeFeedback(): any {
    const totalFeedback = Array.from(this.feedbackStore.values()).flat();
    
    return {
      total: totalFeedback.length,
      helpful: totalFeedback.filter(f => f.helpful).length,
      implemented: totalFeedback.filter(f => f.implemented).length,
      averageScore: this.average(
        Array.from(this.learningMetrics.values()).map(m => m.feedbackScore)
      )
    };
  }
}