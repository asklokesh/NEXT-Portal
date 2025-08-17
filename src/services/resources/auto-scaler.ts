/**
 * Intelligent Auto-Scaling System
 * ML-based predictive scaling with multi-metric decision making
 */

import * as tf from '@tensorflow/tfjs-node';
import { EventEmitter } from 'events';
import { Redis } from 'ioredis';
import * as cron from 'node-cron';
import ResourceManager, { 
  CloudProvider, 
  ResourceType, 
  ResourceMetrics,
  ResourceAllocation,
  ScalingAction,
  ScalingPolicy,
  ScalingTrigger
} from './resource-manager';

// Types and Interfaces
export interface AutoScalerConfig {
  resourceManager: ResourceManager;
  redisUrl?: string;
  mlModelPath?: string;
  enablePredictiveScaling?: boolean;
  enableScheduledScaling?: boolean;
  enableCostOptimization?: boolean;
  enableBurstHandling?: boolean;
  metricsInterval?: number;
  predictionHorizon?: number;
  cooldownPeriod?: number;
}

export interface ScalingDecision {
  timestamp: Date;
  action: ScalingAction;
  targetInstances: number;
  currentInstances: number;
  reason: string;
  confidence: number;
  estimatedCost: number;
  estimatedPerformance: number;
  metrics: ScalingMetrics;
}

export interface ScalingMetrics {
  cpu: number;
  memory: number;
  requestRate: number;
  responseTime: number;
  errorRate: number;
  networkIO: number;
  diskIO: number;
  customMetrics?: Record<string, number>;
}

export interface PredictedLoad {
  timestamp: Date;
  cpu: number;
  memory: number;
  requests: number;
  confidence: number;
  pattern: LoadPattern;
}

export interface ScheduledScalingRule {
  id: string;
  name: string;
  cron: string;
  targetInstances: number;
  resourceType: ResourceType;
  provider?: CloudProvider;
  enabled: boolean;
}

export interface BurstConfig {
  threshold: number;
  duration: number;
  scaleMultiplier: number;
  maxBurstInstances: number;
  cooldownPeriod: number;
}

export enum LoadPattern {
  STEADY = 'steady',
  INCREASING = 'increasing',
  DECREASING = 'decreasing',
  PERIODIC = 'periodic',
  BURST = 'burst',
  IRREGULAR = 'irregular'
}

/**
 * Main Auto-Scaler Class
 */
export class AutoScaler extends EventEmitter {
  private redis: Redis;
  private resourceManager: ResourceManager;
  private mlModel: tf.LayersModel | null = null;
  private patternModel: tf.LayersModel | null = null;
  private metricsHistory: Map<string, ScalingMetrics[]> = new Map();
  private scalingHistory: ScalingDecision[] = [];
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();
  private cooldowns: Map<string, Date> = new Map();
  private burstDetector: BurstDetector;
  private costAnalyzer: CostAnalyzer;
  private performanceOptimizer: PerformanceOptimizer;
  private crossRegionCoordinator: CrossRegionCoordinator;
  
  constructor(private config: AutoScalerConfig) {
    super();
    this.resourceManager = config.resourceManager;
    this.redis = new Redis(config.redisUrl || 'redis://localhost:6379');
    
    this.burstDetector = new BurstDetector(this);
    this.costAnalyzer = new CostAnalyzer(this);
    this.performanceOptimizer = new PerformanceOptimizer(this);
    this.crossRegionCoordinator = new CrossRegionCoordinator(this);
    
    this.initialize();
  }

  /**
   * Initialize auto-scaler
   */
  private async initialize(): Promise<void> {
    await this.loadMLModels();
    await this.loadScheduledRules();
    this.startMetricsCollection();
    this.startPredictiveAnalysis();
  }

  /**
   * Load ML models for scaling predictions
   */
  private async loadMLModels(): Promise<void> {
    if (this.config.enablePredictiveScaling) {
      try {
        // Load existing models
        const modelPath = this.config.mlModelPath || './models/auto-scaling';
        this.mlModel = await tf.loadLayersModel(`file://${modelPath}/prediction-model.json`);
        this.patternModel = await tf.loadLayersModel(`file://${modelPath}/pattern-model.json`);
      } catch (error) {
        console.warn('ML models not found, creating new models...');
        this.mlModel = await this.createPredictionModel();
        this.patternModel = await this.createPatternModel();
        await this.trainModels();
      }
    }
  }

  /**
   * Create prediction model
   */
  private async createPredictionModel(): Promise<tf.LayersModel> {
    const model = tf.sequential({
      layers: [
        // LSTM for time series prediction
        tf.layers.lstm({
          units: 256,
          returnSequences: true,
          inputShape: [48, 10] // 48 time steps, 10 features
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.lstm({
          units: 128,
          returnSequences: true
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.lstm({
          units: 64,
          returnSequences: false
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 32,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 16,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 4 // CPU, Memory, Requests, Instances
        })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mae', 'mse']
    });

    return model;
  }

  /**
   * Create pattern recognition model
   */
  private async createPatternModel(): Promise<tf.LayersModel> {
    const model = tf.sequential({
      layers: [
        tf.layers.conv1d({
          filters: 64,
          kernelSize: 3,
          activation: 'relu',
          inputShape: [24, 7] // 24 hours, 7 metrics
        }),
        tf.layers.maxPooling1d({ poolSize: 2 }),
        tf.layers.conv1d({
          filters: 128,
          kernelSize: 3,
          activation: 'relu'
        }),
        tf.layers.globalMaxPooling1d(),
        tf.layers.dense({
          units: 128,
          activation: 'relu'
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({
          units: 64,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: Object.keys(LoadPattern).length,
          activation: 'softmax'
        })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  /**
   * Train ML models with historical data
   */
  private async trainModels(): Promise<void> {
    // Load historical data from Redis
    const trainingData = await this.loadTrainingData();
    
    if (trainingData.length < 100) {
      console.warn('Insufficient training data, using synthetic data...');
      await this.generateSyntheticData();
      return;
    }

    // Prepare data for training
    const { inputs, outputs } = this.prepareTrainingData(trainingData);
    
    // Train prediction model
    if (this.mlModel) {
      await this.mlModel.fit(inputs, outputs, {
        epochs: 50,
        batchSize: 32,
        validationSplit: 0.2,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            console.log(`Epoch ${epoch}: loss = ${logs?.loss}`);
          }
        }
      });
      
      // Save model
      await this.mlModel.save('file://./models/auto-scaling/prediction-model');
    }
  }

  /**
   * Generate synthetic training data
   */
  private async generateSyntheticData(): Promise<void> {
    const patterns = [
      this.generateDailyPattern,
      this.generateWeeklyPattern,
      this.generateBurstPattern,
      this.generateGrowthPattern
    ];

    for (const pattern of patterns) {
      const data = pattern();
      await this.storeTrainingData(data);
    }
  }

  /**
   * Generate daily traffic pattern
   */
  private generateDailyPattern(): ScalingMetrics[] {
    const data: ScalingMetrics[] = [];
    const hours = 24 * 7; // One week
    
    for (let h = 0; h < hours; h++) {
      const hourOfDay = h % 24;
      const dayOfWeek = Math.floor(h / 24);
      
      // Simulate business hours peak
      let baseLoad = 30;
      if (hourOfDay >= 9 && hourOfDay <= 17 && dayOfWeek < 5) {
        baseLoad = 70 + Math.random() * 20;
      } else if (hourOfDay >= 6 && hourOfDay <= 22) {
        baseLoad = 40 + Math.random() * 15;
      }
      
      data.push({
        cpu: baseLoad + Math.random() * 10 - 5,
        memory: baseLoad * 0.8 + Math.random() * 10,
        requestRate: baseLoad * 10 + Math.random() * 50,
        responseTime: 100 + (baseLoad / 10) + Math.random() * 20,
        errorRate: Math.max(0, Math.random() * 2),
        networkIO: baseLoad * 100,
        diskIO: baseLoad * 50
      });
    }
    
    return data;
  }

  /**
   * Generate weekly pattern
   */
  private generateWeeklyPattern(): ScalingMetrics[] {
    const data: ScalingMetrics[] = [];
    const hours = 24 * 7 * 4; // Four weeks
    
    for (let h = 0; h < hours; h++) {
      const dayOfWeek = Math.floor((h / 24) % 7);
      const weekNumber = Math.floor(h / (24 * 7));
      
      // Weekend dips, weekday peaks
      let baseLoad = dayOfWeek < 5 ? 60 : 30;
      baseLoad += weekNumber * 5; // Growth over weeks
      
      data.push({
        cpu: baseLoad + Math.random() * 15,
        memory: baseLoad * 0.9 + Math.random() * 10,
        requestRate: baseLoad * 15 + Math.random() * 100,
        responseTime: 80 + (baseLoad / 8) + Math.random() * 30,
        errorRate: Math.max(0, Math.random() * 3),
        networkIO: baseLoad * 120,
        diskIO: baseLoad * 60
      });
    }
    
    return data;
  }

  /**
   * Generate burst pattern
   */
  private generateBurstPattern(): ScalingMetrics[] {
    const data: ScalingMetrics[] = [];
    const hours = 24 * 3; // Three days
    
    for (let h = 0; h < hours; h++) {
      let baseLoad = 40 + Math.random() * 10;
      
      // Simulate random bursts
      if (Math.random() < 0.05) { // 5% chance of burst
        baseLoad = 90 + Math.random() * 10;
      }
      
      data.push({
        cpu: baseLoad,
        memory: baseLoad * 0.85,
        requestRate: baseLoad * 20,
        responseTime: 70 + (baseLoad / 5),
        errorRate: baseLoad > 80 ? Math.random() * 5 : Math.random(),
        networkIO: baseLoad * 150,
        diskIO: baseLoad * 70
      });
    }
    
    return data;
  }

  /**
   * Generate growth pattern
   */
  private generateGrowthPattern(): ScalingMetrics[] {
    const data: ScalingMetrics[] = [];
    const hours = 24 * 30; // One month
    
    for (let h = 0; h < hours; h++) {
      const day = Math.floor(h / 24);
      const growthFactor = 1 + (day * 0.02); // 2% daily growth
      
      const baseLoad = 30 * growthFactor + Math.random() * 10;
      
      data.push({
        cpu: Math.min(95, baseLoad),
        memory: Math.min(95, baseLoad * 0.9),
        requestRate: baseLoad * 12,
        responseTime: 90 + (baseLoad / 10),
        errorRate: Math.max(0, Math.random() * 2),
        networkIO: baseLoad * 100,
        diskIO: baseLoad * 50
      });
    }
    
    return data;
  }

  /**
   * Make scaling decision
   */
  public async makeScalingDecision(
    resourceId: string,
    policy: ScalingPolicy
  ): Promise<ScalingDecision> {
    // Check cooldown
    if (this.isInCooldown(resourceId)) {
      return this.createNoOpDecision('In cooldown period');
    }

    // Collect current metrics
    const metrics = await this.collectMetrics(resourceId);
    
    // Store metrics history
    this.updateMetricsHistory(resourceId, metrics);
    
    // Detect patterns
    const pattern = await this.detectLoadPattern(resourceId);
    
    // Check for burst conditions
    if (this.config.enableBurstHandling) {
      const burstDecision = await this.burstDetector.checkBurst(metrics, pattern);
      if (burstDecision) {
        return burstDecision;
      }
    }
    
    // Make prediction if enabled
    let prediction: PredictedLoad | null = null;
    if (this.config.enablePredictiveScaling && this.mlModel) {
      prediction = await this.predictLoad(resourceId);
    }
    
    // Evaluate scaling triggers
    const triggeredActions = this.evaluateTriggers(metrics, policy.triggers);
    
    // Combine decisions
    const decision = await this.combineDecisions(
      metrics,
      pattern,
      prediction,
      triggeredActions,
      policy
    );
    
    // Apply cost optimization if enabled
    if (this.config.enableCostOptimization) {
      await this.costAnalyzer.optimizeDecision(decision);
    }
    
    // Record decision
    this.scalingHistory.push(decision);
    await this.storeScalingDecision(decision);
    
    // Apply cooldown
    this.applyCooldown(resourceId);
    
    // Emit decision event
    this.emit('scaling:decision', decision);
    
    return decision;
  }

  /**
   * Collect current metrics
   */
  private async collectMetrics(resourceId: string): Promise<ScalingMetrics> {
    const resourceMetrics = await this.resourceManager.getResourceMetrics(resourceId);
    
    // Get additional application metrics from Redis
    const appMetrics = await this.redis.hgetall(`app_metrics:${resourceId}`);
    
    return {
      cpu: resourceMetrics.cpuUtilization,
      memory: resourceMetrics.memoryUtilization,
      requestRate: resourceMetrics.requestRate,
      responseTime: resourceMetrics.latency,
      errorRate: resourceMetrics.errorRate,
      networkIO: resourceMetrics.networkThroughput,
      diskIO: parseFloat(appMetrics.diskIO || '0'),
      customMetrics: this.parseCustomMetrics(appMetrics)
    };
  }

  /**
   * Parse custom metrics
   */
  private parseCustomMetrics(appMetrics: Record<string, string>): Record<string, number> {
    const custom: Record<string, number> = {};
    
    for (const [key, value] of Object.entries(appMetrics)) {
      if (key.startsWith('custom_')) {
        custom[key.replace('custom_', '')] = parseFloat(value);
      }
    }
    
    return custom;
  }

  /**
   * Update metrics history
   */
  private updateMetricsHistory(resourceId: string, metrics: ScalingMetrics): void {
    let history = this.metricsHistory.get(resourceId) || [];
    history.push(metrics);
    
    // Keep only last 48 hours of data
    const maxEntries = 48 * (60 / (this.config.metricsInterval || 5));
    if (history.length > maxEntries) {
      history = history.slice(-maxEntries);
    }
    
    this.metricsHistory.set(resourceId, history);
  }

  /**
   * Detect load pattern
   */
  private async detectLoadPattern(resourceId: string): Promise<LoadPattern> {
    if (!this.patternModel) {
      return LoadPattern.STEADY;
    }

    const history = this.metricsHistory.get(resourceId);
    if (!history || history.length < 24) {
      return LoadPattern.STEADY;
    }

    // Prepare data for pattern detection
    const input = tf.tensor3d([
      history.slice(-24).map(m => [
        m.cpu / 100,
        m.memory / 100,
        m.requestRate / 1000,
        m.responseTime / 1000,
        m.errorRate / 100,
        m.networkIO / 10000,
        m.diskIO / 10000
      ])
    ]);

    // Predict pattern
    const prediction = this.patternModel.predict(input) as tf.Tensor;
    const patternIndex = (await prediction.argMax(-1).data())[0];
    
    input.dispose();
    prediction.dispose();

    const patterns = Object.values(LoadPattern);
    return patterns[patternIndex] || LoadPattern.STEADY;
  }

  /**
   * Predict future load
   */
  private async predictLoad(resourceId: string): Promise<PredictedLoad | null> {
    if (!this.mlModel) {
      return null;
    }

    const history = this.metricsHistory.get(resourceId);
    if (!history || history.length < 48) {
      return null;
    }

    // Prepare input data
    const input = tf.tensor3d([
      history.slice(-48).map(m => [
        m.cpu / 100,
        m.memory / 100,
        m.requestRate / 1000,
        m.responseTime / 1000,
        m.errorRate / 100,
        m.networkIO / 10000,
        m.diskIO / 10000,
        new Date().getHours() / 24, // Time of day
        new Date().getDay() / 7, // Day of week
        new Date().getDate() / 31 // Day of month
      ])
    ]);

    // Make prediction
    const prediction = this.mlModel.predict(input) as tf.Tensor;
    const [cpu, memory, requests] = await prediction.data();
    
    input.dispose();
    prediction.dispose();

    // Calculate confidence based on model accuracy and data quality
    const confidence = this.calculatePredictionConfidence(history);

    return {
      timestamp: new Date(Date.now() + (this.config.predictionHorizon || 15) * 60 * 1000),
      cpu: cpu * 100,
      memory: memory * 100,
      requests: requests * 1000,
      confidence,
      pattern: await this.detectLoadPattern(resourceId)
    };
  }

  /**
   * Calculate prediction confidence
   */
  private calculatePredictionConfidence(history: ScalingMetrics[]): number {
    // Base confidence on data quality and variance
    let confidence = 0.7;
    
    // More data = higher confidence
    if (history.length >= 48) confidence += 0.1;
    if (history.length >= 168) confidence += 0.1; // One week
    
    // Lower variance = higher confidence
    const cpuVariance = this.calculateVariance(history.map(h => h.cpu));
    if (cpuVariance < 10) confidence += 0.1;
    
    return Math.min(0.95, confidence);
  }

  /**
   * Calculate variance
   */
  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
  }

  /**
   * Evaluate scaling triggers
   */
  private evaluateTriggers(
    metrics: ScalingMetrics,
    triggers: ScalingTrigger[]
  ): ScalingAction[] {
    const triggeredActions: ScalingAction[] = [];
    
    for (const trigger of triggers) {
      const metricValue = this.getMetricValue(metrics, trigger.metric);
      
      if (this.isTriggered(metricValue, trigger)) {
        triggeredActions.push(trigger.action);
      }
    }
    
    return triggeredActions;
  }

  /**
   * Get metric value by name
   */
  private getMetricValue(metrics: ScalingMetrics, metricName: string): number {
    if (metricName in metrics) {
      return (metrics as any)[metricName];
    }
    
    if (metrics.customMetrics && metricName in metrics.customMetrics) {
      return metrics.customMetrics[metricName];
    }
    
    return 0;
  }

  /**
   * Check if trigger condition is met
   */
  private isTriggered(value: number, trigger: ScalingTrigger): boolean {
    // Check if value exceeds threshold for required duration
    // This is simplified; real implementation would track duration
    return value > trigger.threshold;
  }

  /**
   * Combine multiple decision factors
   */
  private async combineDecisions(
    metrics: ScalingMetrics,
    pattern: LoadPattern,
    prediction: PredictedLoad | null,
    triggeredActions: ScalingAction[],
    policy: ScalingPolicy
  ): Promise<ScalingDecision> {
    let action = ScalingAction.SCALE_UP;
    let targetInstances = 1;
    let confidence = 0.5;
    let reason = 'No action needed';
    
    // Priority 1: Triggered actions
    if (triggeredActions.length > 0) {
      action = this.selectPrimaryAction(triggeredActions);
      targetInstances = await this.calculateTargetInstances(action, metrics, policy);
      confidence = 0.8;
      reason = `Triggered by metrics: ${this.getTriggeredMetrics(metrics, policy.triggers).join(', ')}`;
    }
    // Priority 2: Predictive scaling
    else if (prediction && prediction.confidence > 0.7) {
      const predictedAction = this.determinePredictiveAction(prediction, metrics);
      if (predictedAction !== ScalingAction.SCALE_UP) {
        action = predictedAction;
        targetInstances = await this.calculatePredictiveTarget(prediction, policy);
        confidence = prediction.confidence;
        reason = `Predictive scaling: ${pattern} pattern detected`;
      }
    }
    // Priority 3: Pattern-based scaling
    else if (pattern !== LoadPattern.STEADY) {
      action = this.determinePatternAction(pattern);
      targetInstances = await this.calculatePatternTarget(pattern, metrics, policy);
      confidence = 0.6;
      reason = `Pattern-based: ${pattern} pattern`;
    }
    
    // Get current instances
    const currentInstances = await this.getCurrentInstances();
    
    // Calculate estimated cost and performance
    const estimatedCost = await this.costAnalyzer.estimateCost(targetInstances);
    const estimatedPerformance = await this.performanceOptimizer.estimatePerformance(
      targetInstances,
      metrics
    );
    
    return {
      timestamp: new Date(),
      action,
      targetInstances,
      currentInstances,
      reason,
      confidence,
      estimatedCost,
      estimatedPerformance,
      metrics
    };
  }

  /**
   * Select primary action from multiple triggers
   */
  private selectPrimaryAction(actions: ScalingAction[]): ScalingAction {
    // Priority order
    const priority = [
      ScalingAction.BURST,
      ScalingAction.SCALE_OUT,
      ScalingAction.SCALE_UP,
      ScalingAction.SCALE_DOWN,
      ScalingAction.SCALE_IN,
      ScalingAction.HIBERNATE
    ];
    
    for (const p of priority) {
      if (actions.includes(p)) {
        return p;
      }
    }
    
    return actions[0];
  }

  /**
   * Calculate target instances
   */
  private async calculateTargetInstances(
    action: ScalingAction,
    metrics: ScalingMetrics,
    policy: ScalingPolicy
  ): Promise<number> {
    const current = await this.getCurrentInstances();
    
    switch (action) {
      case ScalingAction.SCALE_UP:
      case ScalingAction.SCALE_OUT:
        return Math.min(
          policy.maxInstances,
          Math.ceil(current * (1 + (metrics.cpu - policy.targetUtilization) / 100))
        );
        
      case ScalingAction.SCALE_DOWN:
      case ScalingAction.SCALE_IN:
        return Math.max(
          policy.minInstances,
          Math.floor(current * (policy.targetUtilization / metrics.cpu))
        );
        
      case ScalingAction.BURST:
        return Math.min(policy.maxInstances, current * 2);
        
      case ScalingAction.HIBERNATE:
        return policy.minInstances;
        
      default:
        return current;
    }
  }

  /**
   * Get triggered metrics names
   */
  private getTriggeredMetrics(metrics: ScalingMetrics, triggers: ScalingTrigger[]): string[] {
    const triggered: string[] = [];
    
    for (const trigger of triggers) {
      const value = this.getMetricValue(metrics, trigger.metric);
      if (this.isTriggered(value, trigger)) {
        triggered.push(`${trigger.metric}=${value.toFixed(2)}`);
      }
    }
    
    return triggered;
  }

  /**
   * Determine action based on prediction
   */
  private determinePredictiveAction(prediction: PredictedLoad, current: ScalingMetrics): ScalingAction {
    if (prediction.cpu > current.cpu * 1.2 || prediction.requests > current.requestRate * 1.2) {
      return ScalingAction.SCALE_OUT;
    }
    
    if (prediction.cpu < current.cpu * 0.8 && prediction.requests < current.requestRate * 0.8) {
      return ScalingAction.SCALE_IN;
    }
    
    return ScalingAction.SCALE_UP;
  }

  /**
   * Calculate predictive target
   */
  private async calculatePredictiveTarget(
    prediction: PredictedLoad,
    policy: ScalingPolicy
  ): Promise<number> {
    const current = await this.getCurrentInstances();
    const scaleFactor = Math.max(
      prediction.cpu / policy.targetUtilization,
      prediction.memory / policy.targetUtilization
    );
    
    return Math.min(
      policy.maxInstances,
      Math.max(
        policy.minInstances,
        Math.ceil(current * scaleFactor)
      )
    );
  }

  /**
   * Determine action based on pattern
   */
  private determinePatternAction(pattern: LoadPattern): ScalingAction {
    switch (pattern) {
      case LoadPattern.INCREASING:
        return ScalingAction.SCALE_OUT;
      case LoadPattern.DECREASING:
        return ScalingAction.SCALE_IN;
      case LoadPattern.BURST:
        return ScalingAction.BURST;
      case LoadPattern.PERIODIC:
        return ScalingAction.SCALE_UP;
      default:
        return ScalingAction.SCALE_UP;
    }
  }

  /**
   * Calculate pattern-based target
   */
  private async calculatePatternTarget(
    pattern: LoadPattern,
    metrics: ScalingMetrics,
    policy: ScalingPolicy
  ): Promise<number> {
    const current = await this.getCurrentInstances();
    
    switch (pattern) {
      case LoadPattern.INCREASING:
        return Math.min(policy.maxInstances, current + 2);
      case LoadPattern.DECREASING:
        return Math.max(policy.minInstances, current - 1);
      case LoadPattern.BURST:
        return Math.min(policy.maxInstances, current * 2);
      default:
        return current;
    }
  }

  /**
   * Get current instance count
   */
  private async getCurrentInstances(): Promise<number> {
    const instances = await this.redis.get('current_instances');
    return parseInt(instances || '1');
  }

  /**
   * Check if resource is in cooldown
   */
  private isInCooldown(resourceId: string): boolean {
    const cooldownEnd = this.cooldowns.get(resourceId);
    if (!cooldownEnd) return false;
    
    return new Date() < cooldownEnd;
  }

  /**
   * Apply cooldown period
   */
  private applyCooldown(resourceId: string): void {
    const cooldownPeriod = this.config.cooldownPeriod || 300000; // 5 minutes default
    this.cooldowns.set(resourceId, new Date(Date.now() + cooldownPeriod));
  }

  /**
   * Create no-op decision
   */
  private createNoOpDecision(reason: string): ScalingDecision {
    return {
      timestamp: new Date(),
      action: ScalingAction.SCALE_UP,
      targetInstances: 1,
      currentInstances: 1,
      reason,
      confidence: 1,
      estimatedCost: 0,
      estimatedPerformance: 0,
      metrics: {
        cpu: 0,
        memory: 0,
        requestRate: 0,
        responseTime: 0,
        errorRate: 0,
        networkIO: 0,
        diskIO: 0
      }
    };
  }

  /**
   * Load scheduled scaling rules
   */
  private async loadScheduledRules(): Promise<void> {
    if (!this.config.enableScheduledScaling) return;
    
    const rules = await this.redis.smembers('scheduled_scaling_rules');
    
    for (const ruleId of rules) {
      const rule = await this.redis.hgetall(`scheduled_rule:${ruleId}`);
      if (rule.enabled === 'true') {
        this.scheduleRule({
          id: ruleId,
          name: rule.name,
          cron: rule.cron,
          targetInstances: parseInt(rule.targetInstances),
          resourceType: rule.resourceType as ResourceType,
          provider: rule.provider as CloudProvider,
          enabled: true
        });
      }
    }
  }

  /**
   * Schedule a scaling rule
   */
  public scheduleRule(rule: ScheduledScalingRule): void {
    // Cancel existing job if any
    const existing = this.scheduledJobs.get(rule.id);
    if (existing) {
      existing.stop();
    }
    
    // Create new scheduled job
    const job = cron.schedule(rule.cron, async () => {
      await this.executeScheduledScaling(rule);
    });
    
    this.scheduledJobs.set(rule.id, job);
    job.start();
  }

  /**
   * Execute scheduled scaling
   */
  private async executeScheduledScaling(rule: ScheduledScalingRule): Promise<void> {
    const decision: ScalingDecision = {
      timestamp: new Date(),
      action: ScalingAction.SCALE_OUT,
      targetInstances: rule.targetInstances,
      currentInstances: await this.getCurrentInstances(),
      reason: `Scheduled scaling: ${rule.name}`,
      confidence: 1,
      estimatedCost: await this.costAnalyzer.estimateCost(rule.targetInstances),
      estimatedPerformance: 0,
      metrics: await this.collectMetrics('scheduled')
    };
    
    await this.applyScalingDecision(decision);
    this.emit('scaling:scheduled', decision);
  }

  /**
   * Apply scaling decision
   */
  public async applyScalingDecision(decision: ScalingDecision): Promise<void> {
    // Update target instances in Redis
    await this.redis.set('target_instances', decision.targetInstances.toString());
    
    // Trigger actual scaling through resource manager
    // This would involve allocating/deallocating resources
    
    // Store decision history
    await this.storeScalingDecision(decision);
    
    // Emit event
    this.emit('scaling:applied', decision);
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    const interval = this.config.metricsInterval || 60000; // 1 minute default
    
    setInterval(async () => {
      try {
        // Collect metrics for all resources
        const resources = await this.redis.smembers('monitored_resources');
        
        for (const resourceId of resources) {
          const metrics = await this.collectMetrics(resourceId);
          this.updateMetricsHistory(resourceId, metrics);
          
          // Store in Redis for other components
          await this.redis.hset(
            `metrics:${resourceId}`,
            'timestamp', Date.now().toString(),
            'data', JSON.stringify(metrics)
          );
        }
      } catch (error) {
        console.error('Error collecting metrics:', error);
      }
    }, interval);
  }

  /**
   * Start predictive analysis
   */
  private startPredictiveAnalysis(): void {
    if (!this.config.enablePredictiveScaling) return;
    
    const interval = 5 * 60000; // 5 minutes
    
    setInterval(async () => {
      try {
        const resources = await this.redis.smembers('monitored_resources');
        
        for (const resourceId of resources) {
          const prediction = await this.predictLoad(resourceId);
          if (prediction && prediction.confidence > 0.7) {
            await this.redis.setex(
              `prediction:${resourceId}`,
              300,
              JSON.stringify(prediction)
            );
            
            this.emit('scaling:prediction', { resourceId, prediction });
          }
        }
      } catch (error) {
        console.error('Error in predictive analysis:', error);
      }
    }, interval);
  }

  /**
   * Load training data
   */
  private async loadTrainingData(): Promise<any[]> {
    const data = await this.redis.lrange('training_data', 0, -1);
    return data.map(d => JSON.parse(d));
  }

  /**
   * Store training data
   */
  private async storeTrainingData(data: ScalingMetrics[]): Promise<void> {
    const pipeline = this.redis.pipeline();
    
    for (const metrics of data) {
      pipeline.rpush('training_data', JSON.stringify(metrics));
    }
    
    // Keep only last 10000 entries
    pipeline.ltrim('training_data', -10000, -1);
    
    await pipeline.exec();
  }

  /**
   * Prepare training data
   */
  private prepareTrainingData(data: any[]): { inputs: tf.Tensor; outputs: tf.Tensor } {
    // Implementation would prepare tensors for training
    const inputs = tf.zeros([data.length, 48, 10]);
    const outputs = tf.zeros([data.length, 4]);
    
    return { inputs, outputs };
  }

  /**
   * Store scaling decision
   */
  private async storeScalingDecision(decision: ScalingDecision): Promise<void> {
    await this.redis.zadd(
      'scaling_decisions',
      Date.now(),
      JSON.stringify(decision)
    );
    
    // Keep only last 1000 decisions
    await this.redis.zremrangebyrank('scaling_decisions', 0, -1001);
  }

  /**
   * Cleanup and disconnect
   */
  public async cleanup(): Promise<void> {
    // Stop scheduled jobs
    for (const job of this.scheduledJobs.values()) {
      job.stop();
    }
    
    await this.redis.quit();
    this.removeAllListeners();
  }
}

/**
 * Burst Detector
 */
class BurstDetector {
  constructor(private scaler: AutoScaler) {}
  
  public async checkBurst(
    metrics: ScalingMetrics,
    pattern: LoadPattern
  ): Promise<ScalingDecision | null> {
    if (pattern === LoadPattern.BURST || metrics.requestRate > 1000) {
      return {
        timestamp: new Date(),
        action: ScalingAction.BURST,
        targetInstances: 10,
        currentInstances: 1,
        reason: 'Burst detected',
        confidence: 0.9,
        estimatedCost: 100,
        estimatedPerformance: 95,
        metrics
      };
    }
    return null;
  }
}

/**
 * Cost Analyzer
 */
class CostAnalyzer {
  constructor(private scaler: AutoScaler) {}
  
  public async estimateCost(instances: number): Promise<number> {
    // Simple cost estimation
    return instances * 0.05 * 24; // $0.05 per hour per instance
  }
  
  public async optimizeDecision(decision: ScalingDecision): Promise<void> {
    // Optimize decision for cost
    if (decision.estimatedCost > 1000) {
      decision.targetInstances = Math.ceil(decision.targetInstances * 0.8);
      decision.reason += ' (cost optimized)';
    }
  }
}

/**
 * Performance Optimizer
 */
class PerformanceOptimizer {
  constructor(private scaler: AutoScaler) {}
  
  public async estimatePerformance(
    instances: number,
    metrics: ScalingMetrics
  ): Promise<number> {
    // Estimate performance improvement
    const currentPerformance = 100 - metrics.errorRate;
    const scaleFactor = instances / 1; // Assuming 1 current instance
    return Math.min(99.9, currentPerformance * Math.sqrt(scaleFactor));
  }
}

/**
 * Cross-Region Coordinator
 */
class CrossRegionCoordinator {
  constructor(private scaler: AutoScaler) {}
  
  public async coordinateScaling(regions: string[]): Promise<void> {
    // Coordinate scaling across regions
  }
}

export default AutoScaler;