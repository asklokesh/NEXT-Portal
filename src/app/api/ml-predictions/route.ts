import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

interface MLPredictionModel {
  id: string;
  name: string;
  type: ModelType;
  status: ModelStatus;
  config: ModelConfig;
  training: TrainingConfig;
  performance: ModelPerformance;
  features: FeatureDefinition[];
  predictions: PredictionHistory[];
  metadata: ModelMetadata;
  created: string;
  updated: string;
}

type ModelType = 
  | 'usage-prediction'
  | 'demand-forecasting'
  | 'anomaly-detection'
  | 'recommendation'
  | 'classification'
  | 'regression'
  | 'clustering'
  | 'time-series'
  | 'deep-learning'
  | 'ensemble';

interface ModelStatus {
  state: 'training' | 'trained' | 'deployed' | 'failed' | 'deprecated';
  accuracy: number;
  lastTrained: string;
  nextRetraining?: string;
  deployedVersion: string;
  healthScore: number;
}

interface ModelConfig {
  algorithm: MLAlgorithm;
  hyperparameters: Record<string, any>;
  preprocessing: PreprocessingConfig;
  validation: ValidationConfig;
  deployment: DeploymentConfig;
  monitoring: MonitoringConfig;
}

type MLAlgorithm = 
  | 'linear-regression'
  | 'random-forest'
  | 'gradient-boosting'
  | 'neural-network'
  | 'svm'
  | 'k-means'
  | 'arima'
  | 'prophet'
  | 'transformer'
  | 'lstm'
  | 'xgboost'
  | 'lightgbm'
  | 'catboost';

interface PreprocessingConfig {
  normalization: 'min-max' | 'z-score' | 'robust' | 'none';
  encoding: 'one-hot' | 'label' | 'target' | 'binary';
  featureSelection: boolean;
  dimensionalityReduction?: 'pca' | 'lda' | 'tsne' | 'umap';
  outlierDetection: boolean;
  imbalanceHandling?: 'smote' | 'undersampling' | 'oversampling';
}

interface ValidationConfig {
  method: 'train-test-split' | 'cross-validation' | 'time-series-split';
  testSize: number;
  folds?: number;
  stratified: boolean;
  randomState: number;
  metrics: string[];
}

interface DeploymentConfig {
  environment: 'staging' | 'production';
  scalingPolicy: 'auto' | 'manual';
  minInstances: number;
  maxInstances: number;
  cpuThreshold: number;
  memoryLimit: string;
  timeout: number;
  canaryDeployment: boolean;
}

interface MonitoringConfig {
  datariftDetection: boolean;
  performanceMonitoring: boolean;
  alertThresholds: AlertThreshold[];
  retrainingTriggers: RetrainingTrigger[];
  explainability: boolean;
}

interface AlertThreshold {
  metric: string;
  threshold: number;
  operator: 'gt' | 'lt' | 'eq';
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface RetrainingTrigger {
  type: 'schedule' | 'performance' | 'data-drift' | 'manual';
  condition: string;
  frequency?: string;
}

interface TrainingConfig {
  dataset: DatasetConfig;
  splitStrategy: SplitStrategy;
  optimization: OptimizationConfig;
  earlystopping: EarlyStoppingConfig;
  checkpointing: CheckpointConfig;
}

interface DatasetConfig {
  source: 'database' | 'api' | 'file' | 'stream';
  query?: string;
  url?: string;
  path?: string;
  format: 'csv' | 'json' | 'parquet' | 'avro';
  schema: DataSchema;
  refresh: RefreshConfig;
}

interface DataSchema {
  features: ColumnDefinition[];
  target: ColumnDefinition;
  index?: string;
  timestamp?: string;
}

interface ColumnDefinition {
  name: string;
  type: 'numeric' | 'categorical' | 'text' | 'datetime' | 'boolean';
  nullable: boolean;
  encoding?: string;
  description?: string;
}

interface RefreshConfig {
  enabled: boolean;
  frequency: string;
  incremental: boolean;
  watermark?: string;
}

interface SplitStrategy {
  method: 'random' | 'temporal' | 'stratified';
  trainRatio: number;
  validationRatio: number;
  testRatio: number;
  seed: number;
}

interface OptimizationConfig {
  objective: 'accuracy' | 'precision' | 'recall' | 'f1' | 'auc' | 'mae' | 'mse' | 'rmse';
  maximization: boolean;
  trials: number;
  timeout: number;
  pruning: boolean;
}

interface EarlyStoppingConfig {
  enabled: boolean;
  patience: number;
  minDelta: number;
  metric: string;
  mode: 'min' | 'max';
}

interface CheckpointConfig {
  enabled: boolean;
  frequency: number;
  saveTopK: number;
  monitorMetric: string;
}

interface ModelPerformance {
  trainingMetrics: MetricValue[];
  validationMetrics: MetricValue[];
  testMetrics: MetricValue[];
  crossValidation?: CrossValidationResults;
  featureImportance: FeatureImportance[];
  confusionMatrix?: number[][];
  rocCurve?: ROCPoint[];
  prCurve?: PRPoint[];
}

interface MetricValue {
  name: string;
  value: number;
  timestamp: string;
}

interface CrossValidationResults {
  meanScore: number;
  stdScore: number;
  scores: number[];
  folds: number;
}

interface FeatureImportance {
  feature: string;
  importance: number;
  rank: number;
  pValue?: number;
}

interface ROCPoint {
  fpr: number;
  tpr: number;
  threshold: number;
}

interface PRPoint {
  precision: number;
  recall: number;
  threshold: number;
}

interface FeatureDefinition {
  name: string;
  type: FeatureType;
  source: string;
  aggregation?: AggregationFunction;
  window?: TimeWindow;
  transformation?: Transformation;
  encoding?: EncodingStrategy;
}

type FeatureType = 
  | 'usage_count'
  | 'installation_rate'
  | 'user_engagement'
  | 'performance_metric'
  | 'temporal_pattern'
  | 'categorical_feature'
  | 'text_feature'
  | 'derived_feature';

type AggregationFunction = 
  | 'sum'
  | 'avg'
  | 'count'
  | 'min'
  | 'max'
  | 'std'
  | 'median'
  | 'percentile';

interface TimeWindow {
  size: number;
  unit: 'minute' | 'hour' | 'day' | 'week' | 'month';
  offset?: number;
}

interface Transformation {
  type: 'log' | 'sqrt' | 'polynomial' | 'interaction' | 'custom';
  parameters?: Record<string, any>;
}

interface EncodingStrategy {
  method: 'one-hot' | 'label' | 'target' | 'frequency' | 'embedding';
  dimensions?: number;
}

interface PredictionHistory {
  id: string;
  modelId: string;
  input: Record<string, any>;
  output: PredictionOutput;
  confidence: number;
  explanation?: PredictionExplanation;
  feedback?: PredictionFeedback;
  timestamp: string;
}

interface PredictionOutput {
  prediction: any;
  probability?: number[];
  interval?: ConfidenceInterval;
  alternatives?: AlternativePrediction[];
}

interface ConfidenceInterval {
  lower: number;
  upper: number;
  confidence: number;
}

interface AlternativePrediction {
  value: any;
  probability: number;
  rank: number;
}

interface PredictionExplanation {
  method: 'shap' | 'lime' | 'attention' | 'feature-importance';
  globalExplanation?: GlobalExplanation;
  localExplanation?: LocalExplanation;
  counterfactual?: CounterfactualExplanation;
}

interface GlobalExplanation {
  featureImportance: FeatureImportance[];
  interactions?: FeatureInteraction[];
  summary: string;
}

interface LocalExplanation {
  featureContributions: FeatureContribution[];
  baseValue: number;
  prediction: number;
  visualization?: string;
}

interface FeatureContribution {
  feature: string;
  value: number;
  contribution: number;
  rank: number;
}

interface FeatureInteraction {
  features: string[];
  interaction: number;
  significance: number;
}

interface CounterfactualExplanation {
  changes: FeatureChange[];
  originalPrediction: number;
  counterfactualPrediction: number;
  distance: number;
}

interface FeatureChange {
  feature: string;
  originalValue: any;
  suggestedValue: any;
  impact: number;
}

interface PredictionFeedback {
  actualValue?: any;
  accuracy: boolean;
  userRating?: number;
  comments?: string;
  timestamp: string;
}

interface ModelMetadata {
  author: string;
  description: string;
  tags: string[];
  version: string;
  framework: string;
  dependencies: string[];
  documentation?: string;
  changelog: ChangelogEntry[];
}

interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
  metrics?: Record<string, number>;
}

interface UsagePrediction {
  pluginId: string;
  timeHorizon: string;
  predictions: TimeSeries[];
  seasonality: SeasonalityPattern;
  trends: TrendAnalysis;
  anomalies: AnomalyDetection[];
  recommendations: UsageRecommendation[];
}

interface TimeSeries {
  timestamp: string;
  predicted: number;
  confidence: ConfidenceInterval;
  actual?: number;
}

interface SeasonalityPattern {
  detected: boolean;
  patterns: SeasonalPattern[];
  strength: number;
}

interface SeasonalPattern {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  period: number;
  amplitude: number;
  phase: number;
}

interface TrendAnalysis {
  direction: 'increasing' | 'decreasing' | 'stable';
  magnitude: number;
  changePoints: ChangePoint[];
  forecast: TrendForecast;
}

interface ChangePoint {
  timestamp: string;
  confidence: number;
  description: string;
}

interface TrendForecast {
  shortTerm: TrendDirection;
  mediumTerm: TrendDirection;
  longTerm: TrendDirection;
}

interface TrendDirection {
  direction: 'up' | 'down' | 'stable';
  confidence: number;
  magnitude: number;
}

interface AnomalyDetection {
  timestamp: string;
  value: number;
  expected: number;
  severity: 'low' | 'medium' | 'high';
  type: 'point' | 'contextual' | 'collective';
  explanation: string;
}

interface UsageRecommendation {
  type: 'optimization' | 'scaling' | 'maintenance' | 'feature';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  expectedImpact: string;
  effort: 'low' | 'medium' | 'high';
  deadline?: string;
}

// Storage
const models = new Map<string, MLPredictionModel>();
const predictions = new Map<string, PredictionHistory>();
const usagePredictions = new Map<string, UsagePrediction>();

// Initialize sample models
const initializeSampleModels = () => {
  const sampleModels: MLPredictionModel[] = [
    {
      id: 'usage-predictor-v1',
      name: 'Plugin Usage Predictor',
      type: 'usage-prediction',
      status: {
        state: 'deployed',
        accuracy: 0.87,
        lastTrained: new Date(Date.now() - 86400000).toISOString(),
        nextRetraining: new Date(Date.now() + 7 * 86400000).toISOString(),
        deployedVersion: '1.2.0',
        healthScore: 0.92
      },
      config: {
        algorithm: 'xgboost',
        hyperparameters: {
          n_estimators: 100,
          max_depth: 6,
          learning_rate: 0.1,
          subsample: 0.8,
          colsample_bytree: 0.8
        },
        preprocessing: {
          normalization: 'z-score',
          encoding: 'one-hot',
          featureSelection: true,
          outlierDetection: true
        },
        validation: {
          method: 'time-series-split',
          testSize: 0.2,
          folds: 5,
          stratified: false,
          randomState: 42,
          metrics: ['mae', 'mape', 'rmse', 'r2']
        },
        deployment: {
          environment: 'production',
          scalingPolicy: 'auto',
          minInstances: 2,
          maxInstances: 10,
          cpuThreshold: 70,
          memoryLimit: '2Gi',
          timeout: 30000,
          canaryDeployment: true
        },
        monitoring: {
          datariftDetection: true,
          performanceMonitoring: true,
          alertThresholds: [
            {
              metric: 'accuracy',
              threshold: 0.8,
              operator: 'lt',
              severity: 'high'
            },
            {
              metric: 'prediction_latency',
              threshold: 1000,
              operator: 'gt',
              severity: 'medium'
            }
          ],
          retrainingTriggers: [
            {
              type: 'performance',
              condition: 'accuracy < 0.85'
            },
            {
              type: 'schedule',
              frequency: 'weekly'
            }
          ],
          explainability: true
        }
      },
      training: {
        dataset: {
          source: 'database',
          query: 'SELECT * FROM plugin_usage_metrics WHERE timestamp >= NOW() - INTERVAL 90 DAY',
          format: 'json',
          schema: {
            features: [
              { name: 'hour_of_day', type: 'numeric', nullable: false },
              { name: 'day_of_week', type: 'numeric', nullable: false },
              { name: 'plugin_category', type: 'categorical', nullable: false },
              { name: 'user_count', type: 'numeric', nullable: false },
              { name: 'installation_count', type: 'numeric', nullable: false }
            ],
            target: { name: 'usage_count', type: 'numeric', nullable: false },
            timestamp: 'timestamp'
          },
          refresh: {
            enabled: true,
            frequency: 'daily',
            incremental: true,
            watermark: 'timestamp'
          }
        },
        splitStrategy: {
          method: 'temporal',
          trainRatio: 0.7,
          validationRatio: 0.15,
          testRatio: 0.15,
          seed: 42
        },
        optimization: {
          objective: 'mae',
          maximization: false,
          trials: 100,
          timeout: 3600,
          pruning: true
        },
        earlystopping: {
          enabled: true,
          patience: 10,
          minDelta: 0.001,
          metric: 'val_loss',
          mode: 'min'
        },
        checkpointing: {
          enabled: true,
          frequency: 5,
          saveTopK: 3,
          monitorMetric: 'val_mae'
        }
      },
      performance: {
        trainingMetrics: [
          { name: 'mae', value: 12.5, timestamp: new Date().toISOString() },
          { name: 'rmse', value: 18.3, timestamp: new Date().toISOString() },
          { name: 'mape', value: 8.7, timestamp: new Date().toISOString() },
          { name: 'r2', value: 0.89, timestamp: new Date().toISOString() }
        ],
        validationMetrics: [
          { name: 'mae', value: 15.2, timestamp: new Date().toISOString() },
          { name: 'rmse', value: 21.1, timestamp: new Date().toISOString() },
          { name: 'mape', value: 10.3, timestamp: new Date().toISOString() },
          { name: 'r2', value: 0.87, timestamp: new Date().toISOString() }
        ],
        testMetrics: [
          { name: 'mae', value: 14.8, timestamp: new Date().toISOString() },
          { name: 'rmse', value: 20.5, timestamp: new Date().toISOString() },
          { name: 'mape', value: 9.8, timestamp: new Date().toISOString() },
          { name: 'r2', value: 0.88, timestamp: new Date().toISOString() }
        ],
        featureImportance: [
          { feature: 'hour_of_day', importance: 0.35, rank: 1 },
          { feature: 'user_count', importance: 0.28, rank: 2 },
          { feature: 'day_of_week', importance: 0.22, rank: 3 },
          { feature: 'plugin_category', importance: 0.10, rank: 4 },
          { feature: 'installation_count', importance: 0.05, rank: 5 }
        ]
      },
      features: [
        {
          name: 'hour_of_day',
          type: 'temporal_pattern',
          source: 'timestamp',
          transformation: { type: 'custom', parameters: { extract: 'hour' } }
        },
        {
          name: 'day_of_week',
          type: 'temporal_pattern',
          source: 'timestamp',
          transformation: { type: 'custom', parameters: { extract: 'dayofweek' } }
        },
        {
          name: 'user_count',
          type: 'usage_count',
          source: 'users',
          aggregation: 'count',
          window: { size: 1, unit: 'hour' }
        },
        {
          name: 'installation_count',
          type: 'installation_rate',
          source: 'installations',
          aggregation: 'count',
          window: { size: 1, unit: 'hour' }
        }
      ],
      predictions: [],
      metadata: {
        author: 'ML Team',
        description: 'Predictive model for plugin usage patterns',
        tags: ['usage', 'prediction', 'time-series'],
        version: '1.2.0',
        framework: 'scikit-learn',
        dependencies: ['xgboost', 'pandas', 'numpy'],
        changelog: [
          {
            version: '1.2.0',
            date: new Date().toISOString(),
            changes: ['Improved feature engineering', 'Better handling of seasonality'],
            metrics: { accuracy: 0.87, mae: 14.8 }
          }
        ]
      },
      created: new Date(Date.now() - 30 * 86400000).toISOString(),
      updated: new Date().toISOString()
    }
  ];

  sampleModels.forEach(model => {
    models.set(model.id, model);
  });
};

// Initialize sample models
initializeSampleModels();

// Generate usage prediction
const generateUsagePrediction = async (
  pluginId: string,
  timeHorizon: '1d' | '7d' | '30d' | '90d'
): Promise<UsagePrediction> => {
  const model = models.get('usage-predictor-v1');
  if (!model) {
    throw new Error('Prediction model not available');
  }

  const horizonHours = {
    '1d': 24,
    '7d': 168,
    '30d': 720,
    '90d': 2160
  }[timeHorizon];

  // Generate time series predictions
  const predictions: TimeSeries[] = [];
  const baseUsage = 100 + Math.random() * 500;
  
  for (let i = 0; i < horizonHours; i++) {
    const timestamp = new Date(Date.now() + i * 3600000).toISOString();
    
    // Simulate usage pattern with seasonality and trend
    const hourOfDay = new Date(timestamp).getHours();
    const dayOfWeek = new Date(timestamp).getDay();
    
    // Daily pattern (higher during business hours)
    const dailyPattern = 1 + 0.5 * Math.sin((hourOfDay - 6) * Math.PI / 12);
    
    // Weekly pattern (lower on weekends)
    const weeklyPattern = dayOfWeek === 0 || dayOfWeek === 6 ? 0.7 : 1.0;
    
    // Random noise
    const noise = 1 + (Math.random() - 0.5) * 0.2;
    
    // Growth trend
    const trend = 1 + (i / horizonHours) * 0.1;
    
    const predicted = Math.round(baseUsage * dailyPattern * weeklyPattern * trend * noise);
    
    predictions.push({
      timestamp,
      predicted,
      confidence: {
        lower: Math.round(predicted * 0.85),
        upper: Math.round(predicted * 1.15),
        confidence: 0.95
      }
    });
  }

  // Detect seasonality
  const seasonality: SeasonalityPattern = {
    detected: true,
    patterns: [
      {
        type: 'daily',
        period: 24,
        amplitude: 0.5,
        phase: 6
      },
      {
        type: 'weekly',
        period: 168,
        amplitude: 0.3,
        phase: 0
      }
    ],
    strength: 0.7
  };

  // Analyze trends
  const trends: TrendAnalysis = {
    direction: 'increasing',
    magnitude: 0.1,
    changePoints: [
      {
        timestamp: new Date(Date.now() + horizonHours * 3600000 / 2).toISOString(),
        confidence: 0.8,
        description: 'Expected growth acceleration'
      }
    ],
    forecast: {
      shortTerm: { direction: 'up', confidence: 0.9, magnitude: 0.05 },
      mediumTerm: { direction: 'up', confidence: 0.8, magnitude: 0.1 },
      longTerm: { direction: 'stable', confidence: 0.6, magnitude: 0.02 }
    }
  };

  // Detect anomalies
  const anomalies: AnomalyDetection[] = [];
  if (Math.random() > 0.7) {
    anomalies.push({
      timestamp: new Date(Date.now() + Math.random() * horizonHours * 3600000).toISOString(),
      value: baseUsage * 2,
      expected: baseUsage,
      severity: 'medium',
      type: 'point',
      explanation: 'Unusual spike in plugin usage detected'
    });
  }

  // Generate recommendations
  const recommendations: UsageRecommendation[] = [
    {
      type: 'scaling',
      priority: 'high',
      title: 'Scale infrastructure for peak hours',
      description: 'Usage peaks between 9 AM - 5 PM. Consider auto-scaling configuration.',
      expectedImpact: '20% reduction in response time',
      effort: 'medium'
    },
    {
      type: 'optimization',
      priority: 'medium',
      title: 'Optimize for weekend usage patterns',
      description: 'Weekend usage is 30% lower. Consider maintenance windows.',
      expectedImpact: 'Improved maintenance efficiency',
      effort: 'low'
    }
  ];

  const usagePrediction: UsagePrediction = {
    pluginId,
    timeHorizon,
    predictions,
    seasonality,
    trends,
    anomalies,
    recommendations
  };

  usagePredictions.set(`${pluginId}-${timeHorizon}`, usagePrediction);
  return usagePrediction;
};

// Make prediction
const makePrediction = async (
  modelId: string,
  input: Record<string, any>
): Promise<PredictionHistory> => {
  const model = models.get(modelId);
  if (!model) {
    throw new Error('Model not found');
  }

  // Simulate prediction
  const predicted = Math.round(100 + Math.random() * 500);
  const confidence = 0.7 + Math.random() * 0.3;

  const prediction: PredictionHistory = {
    id: crypto.randomBytes(8).toString('hex'),
    modelId,
    input,
    output: {
      prediction: predicted,
      probability: [1 - confidence, confidence],
      interval: {
        lower: Math.round(predicted * 0.9),
        upper: Math.round(predicted * 1.1),
        confidence: 0.95
      },
      alternatives: [
        { value: predicted - 20, probability: 0.2, rank: 2 },
        { value: predicted + 15, probability: 0.15, rank: 3 }
      ]
    },
    confidence,
    explanation: {
      method: 'shap',
      localExplanation: {
        featureContributions: [
          { feature: 'hour_of_day', value: input.hour_of_day || 12, contribution: 25, rank: 1 },
          { feature: 'user_count', value: input.user_count || 50, contribution: 18, rank: 2 },
          { feature: 'day_of_week', value: input.day_of_week || 3, contribution: 12, rank: 3 }
        ],
        baseValue: 100,
        prediction: predicted
      }
    },
    timestamp: new Date().toISOString()
  };

  predictions.set(prediction.id, prediction);
  model.predictions.push(prediction);

  return prediction;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'predict_usage': {
        const { pluginId, timeHorizon } = body;
        
        const prediction = await generateUsagePrediction(
          pluginId,
          timeHorizon || '7d'
        );

        return NextResponse.json({
          success: true,
          prediction
        });
      }

      case 'make_prediction': {
        const { modelId, input } = body;
        
        const prediction = await makePrediction(modelId, input);

        return NextResponse.json({
          success: true,
          prediction
        });
      }

      case 'train_model': {
        const model: MLPredictionModel = {
          id: crypto.randomBytes(8).toString('hex'),
          name: body.name,
          type: body.type,
          status: {
            state: 'training',
            accuracy: 0,
            lastTrained: new Date().toISOString(),
            deployedVersion: '1.0.0',
            healthScore: 0
          },
          config: body.config,
          training: body.training,
          performance: {
            trainingMetrics: [],
            validationMetrics: [],
            testMetrics: [],
            featureImportance: []
          },
          features: body.features || [],
          predictions: [],
          metadata: body.metadata || {
            author: 'system',
            description: '',
            tags: [],
            version: '1.0.0',
            framework: 'scikit-learn',
            dependencies: [],
            changelog: []
          },
          created: new Date().toISOString(),
          updated: new Date().toISOString()
        };

        // Simulate training process
        setTimeout(() => {
          model.status.state = 'trained';
          model.status.accuracy = 0.8 + Math.random() * 0.15;
          model.status.healthScore = 0.85 + Math.random() * 0.1;
          
          // Add mock performance metrics
          model.performance.trainingMetrics = [
            { name: 'accuracy', value: model.status.accuracy, timestamp: new Date().toISOString() }
          ];
        }, 5000);

        models.set(model.id, model);

        return NextResponse.json({
          success: true,
          model
        });
      }

      case 'deploy_model': {
        const { modelId } = body;
        const model = models.get(modelId);

        if (!model) {
          return NextResponse.json({
            success: false,
            error: 'Model not found'
          }, { status: 404 });
        }

        model.status.state = 'deployed';
        model.updated = new Date().toISOString();

        return NextResponse.json({
          success: true,
          model
        });
      }

      case 'retrain_model': {
        const { modelId } = body;
        const model = models.get(modelId);

        if (!model) {
          return NextResponse.json({
            success: false,
            error: 'Model not found'
          }, { status: 404 });
        }

        model.status.state = 'training';
        model.status.lastTrained = new Date().toISOString();
        model.updated = new Date().toISOString();

        // Simulate retraining
        setTimeout(() => {
          model.status.state = 'deployed';
          model.status.accuracy = Math.min(0.95, model.status.accuracy + 0.02);
          model.status.healthScore = Math.min(0.98, model.status.healthScore + 0.01);
        }, 3000);

        return NextResponse.json({
          success: true,
          message: 'Model retraining started'
        });
      }

      case 'provide_feedback': {
        const { predictionId, feedback } = body;
        const prediction = predictions.get(predictionId);

        if (!prediction) {
          return NextResponse.json({
            success: false,
            error: 'Prediction not found'
          }, { status: 404 });
        }

        prediction.feedback = {
          ...feedback,
          timestamp: new Date().toISOString()
        };

        return NextResponse.json({
          success: true,
          message: 'Feedback recorded'
        });
      }

      case 'explain_prediction': {
        const { predictionId } = body;
        const prediction = predictions.get(predictionId);

        if (!prediction) {
          return NextResponse.json({
            success: false,
            error: 'Prediction not found'
          }, { status: 404 });
        }

        return NextResponse.json({
          success: true,
          explanation: prediction.explanation
        });
      }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('ML predictions error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process ML request'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');

    if (type === 'models') {
      return NextResponse.json({
        success: true,
        models: Array.from(models.values())
      });
    }

    if (type === 'predictions') {
      const modelId = searchParams.get('modelId');
      let predictionList = Array.from(predictions.values());
      
      if (modelId) {
        predictionList = predictionList.filter(p => p.modelId === modelId);
      }

      return NextResponse.json({
        success: true,
        predictions: predictionList
      });
    }

    if (type === 'usage_predictions') {
      return NextResponse.json({
        success: true,
        usagePredictions: Array.from(usagePredictions.values())
      });
    }

    if (id) {
      const model = models.get(id);
      if (!model) {
        return NextResponse.json({
          success: false,
          error: 'Model not found'
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        model
      });
    }

    // Return summary
    return NextResponse.json({
      success: true,
      summary: {
        models: models.size,
        predictions: predictions.size,
        usagePredictions: usagePredictions.size,
        deployed: Array.from(models.values()).filter(m => m.status.state === 'deployed').length
      }
    });

  } catch (error) {
    console.error('ML predictions GET error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch ML data'
    }, { status: 500 });
  }
}