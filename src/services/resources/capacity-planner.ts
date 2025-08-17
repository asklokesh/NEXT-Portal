/**
 * Intelligent Capacity Planning System
 * ML-based demand forecasting with sophisticated scenario modeling
 */

import * as tf from '@tensorflow/tfjs-node';
import { EventEmitter } from 'events';
import { Redis } from 'ioredis';
import ResourceManager, { 
  CloudProvider, 
  ResourceType, 
  ResourceQuotas,
  ResourceMetrics,
  ResourceAllocation
} from './resource-manager';
import { AutoScaler, ScalingMetrics } from './auto-scaler';

// Types and Interfaces
export interface CapacityPlannerConfig {
  resourceManager: ResourceManager;
  autoScaler?: AutoScaler;
  redisUrl?: string;
  mlModelPath?: string;
  forecastHorizon?: number; // Days to forecast
  seasonalityPeriods?: number[]; // e.g., [7, 30, 365] for weekly, monthly, yearly
  enableWhatIfAnalysis?: boolean;
  enableBudgetPlanning?: boolean;
  enableRiskAssessment?: boolean;
}

export interface DemandForecast {
  timestamp: Date;
  horizon: number;
  predictions: ResourcePrediction[];
  confidence: number;
  pattern: DemandPattern;
  seasonality: SeasonalityAnalysis;
  trend: TrendAnalysis;
  recommendations: CapacityRecommendation[];
}

export interface ResourcePrediction {
  timestamp: Date;
  resourceType: ResourceType;
  provider: CloudProvider;
  region: string;
  predicted: ResourceQuotas;
  lowerBound: ResourceQuotas;
  upperBound: ResourceQuotas;
  confidence: number;
}

export interface SeasonalityAnalysis {
  daily: SeasonalPattern;
  weekly: SeasonalPattern;
  monthly: SeasonalPattern;
  yearly: SeasonalPattern;
  customPeriods: SeasonalPattern[];
}

export interface SeasonalPattern {
  period: number;
  strength: number;
  phase: number;
  peaks: Date[];
  troughs: Date[];
}

export interface TrendAnalysis {
  direction: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  growthRate: number;
  acceleration: number;
  changePoints: ChangePoint[];
  projectedGrowth: number;
}

export interface ChangePoint {
  timestamp: Date;
  type: 'growth' | 'decline' | 'plateau';
  magnitude: number;
  confidence: number;
}

export interface CapacityRecommendation {
  type: RecommendationType;
  priority: 'critical' | 'high' | 'medium' | 'low';
  action: string;
  impact: ResourceImpact;
  cost: CostImpact;
  risk: RiskAssessment;
  timeline: string;
}

export interface ResourceImpact {
  cpu: number;
  memory: number;
  storage: number;
  network: number;
  provider?: CloudProvider;
  region?: string;
}

export interface CostImpact {
  current: number;
  projected: number;
  savings: number;
  roi: number;
  paybackPeriod: number;
}

export interface RiskAssessment {
  level: 'low' | 'medium' | 'high' | 'critical';
  probability: number;
  impact: number;
  mitigations: string[];
  contingencies: string[];
}

export interface WhatIfScenario {
  id: string;
  name: string;
  description: string;
  parameters: ScenarioParameters;
  results: ScenarioResults;
  comparison: ScenarioComparison;
}

export interface ScenarioParameters {
  growthRate?: number;
  seasonalityMultiplier?: number;
  peakLoadIncrease?: number;
  costConstraints?: number;
  performanceTargets?: PerformanceTargets;
  externalFactors?: ExternalFactors;
}

export interface PerformanceTargets {
  availability: number;
  latency: number;
  throughput: number;
  errorRate: number;
}

export interface ExternalFactors {
  marketGrowth?: number;
  competitorActivity?: number;
  regulatoryChanges?: boolean;
  economicConditions?: 'boom' | 'normal' | 'recession';
}

export interface ScenarioResults {
  forecast: DemandForecast;
  capacityRequired: ResourceQuotas;
  estimatedCost: number;
  performanceMetrics: PerformanceTargets;
  risks: RiskAssessment[];
}

export interface ScenarioComparison {
  baseline: ScenarioResults;
  scenarios: Map<string, ScenarioResults>;
  optimalScenario: string;
  tradeoffs: TradeoffAnalysis[];
}

export interface TradeoffAnalysis {
  dimension: 'cost' | 'performance' | 'risk' | 'scalability';
  scenarios: string[];
  analysis: string;
  recommendation: string;
}

export interface BudgetPlan {
  period: string;
  totalBudget: number;
  allocations: BudgetAllocation[];
  forecast: BudgetForecast;
  optimization: BudgetOptimization;
}

export interface BudgetAllocation {
  category: string;
  provider: CloudProvider;
  resourceType: ResourceType;
  amount: number;
  percentage: number;
  justification: string;
}

export interface BudgetForecast {
  projected: number;
  confidence: number;
  variance: number;
  risks: string[];
  opportunities: string[];
}

export interface BudgetOptimization {
  currentSpend: number;
  optimizedSpend: number;
  savings: number;
  recommendations: string[];
  implementation: string[];
}

export interface CapacityBuffer {
  type: 'fixed' | 'percentage' | 'dynamic';
  value: number;
  justification: string;
  cost: number;
}

export enum DemandPattern {
  LINEAR = 'linear',
  EXPONENTIAL = 'exponential',
  LOGARITHMIC = 'logarithmic',
  SEASONAL = 'seasonal',
  CYCLICAL = 'cyclical',
  IRREGULAR = 'irregular'
}

export enum RecommendationType {
  SCALE_UP = 'scale_up',
  SCALE_OUT = 'scale_out',
  OPTIMIZE = 'optimize',
  MIGRATE = 'migrate',
  RESERVE = 'reserve',
  CONSOLIDATE = 'consolidate',
  DIVERSIFY = 'diversify'
}

/**
 * Main Capacity Planner Class
 */
export class CapacityPlanner extends EventEmitter {
  private redis: Redis;
  private resourceManager: ResourceManager;
  private autoScaler?: AutoScaler;
  private forecastModel: tf.LayersModel | null = null;
  private trendModel: tf.LayersModel | null = null;
  private anomalyModel: tf.LayersModel | null = null;
  private historicalData: Map<string, TimeSeries> = new Map();
  private forecasts: Map<string, DemandForecast> = new Map();
  private scenarios: Map<string, WhatIfScenario> = new Map();
  private budgetPlans: Map<string, BudgetPlan> = new Map();
  
  constructor(private config: CapacityPlannerConfig) {
    super();
    this.resourceManager = config.resourceManager;
    this.autoScaler = config.autoScaler;
    this.redis = new Redis(config.redisUrl || 'redis://localhost:6379');
    
    this.initialize();
  }

  /**
   * Initialize capacity planner
   */
  private async initialize(): Promise<void> {
    await this.loadMLModels();
    await this.loadHistoricalData();
    this.startForecastingCycle();
  }

  /**
   * Load ML models for forecasting
   */
  private async loadMLModels(): Promise<void> {
    try {
      const modelPath = this.config.mlModelPath || './models/capacity-planning';
      this.forecastModel = await tf.loadLayersModel(`file://${modelPath}/forecast-model.json`);
      this.trendModel = await tf.loadLayersModel(`file://${modelPath}/trend-model.json`);
      this.anomalyModel = await tf.loadLayersModel(`file://${modelPath}/anomaly-model.json`);
    } catch (error) {
      console.warn('ML models not found, creating new models...');
      await this.createAndTrainModels();
    }
  }

  /**
   * Create and train ML models
   */
  private async createAndTrainModels(): Promise<void> {
    this.forecastModel = await this.createForecastModel();
    this.trendModel = await this.createTrendModel();
    this.anomalyModel = await this.createAnomalyModel();
    
    await this.trainModels();
  }

  /**
   * Create LSTM forecast model
   */
  private async createForecastModel(): Promise<tf.LayersModel> {
    const model = tf.sequential({
      layers: [
        // Multi-layer LSTM for complex pattern recognition
        tf.layers.lstm({
          units: 256,
          returnSequences: true,
          inputShape: [168, 15] // 1 week of hourly data, 15 features
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
        
        // Dense layers for forecasting
        tf.layers.dense({
          units: 128,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 64,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 32,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 24 * 3 // Forecast 3 days ahead (hourly)
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
   * Create trend detection model
   */
  private async createTrendModel(): Promise<tf.LayersModel> {
    const model = tf.sequential({
      layers: [
        tf.layers.gru({
          units: 128,
          returnSequences: true,
          inputShape: [30, 10] // 30 days of daily data
        }),
        tf.layers.gru({
          units: 64,
          returnSequences: false
        }),
        tf.layers.dense({
          units: 32,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 16,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 4 // Trend components: direction, strength, acceleration, volatility
        })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['accuracy']
    });

    return model;
  }

  /**
   * Create anomaly detection model (Autoencoder)
   */
  private async createAnomalyModel(): Promise<tf.LayersModel> {
    const encoder = tf.sequential({
      layers: [
        tf.layers.dense({
          units: 64,
          activation: 'relu',
          inputShape: [10]
        }),
        tf.layers.dense({
          units: 32,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 16,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 8 // Latent space
        })
      ]
    });

    const decoder = tf.sequential({
      layers: [
        tf.layers.dense({
          units: 16,
          activation: 'relu',
          inputShape: [8]
        }),
        tf.layers.dense({
          units: 32,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 64,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 10 // Reconstruct original features
        })
      ]
    });

    const input = tf.input({ shape: [10] });
    const encoded = encoder.apply(input) as tf.SymbolicTensor;
    const decoded = decoder.apply(encoded) as tf.SymbolicTensor;
    
    const autoencoder = tf.model({ inputs: input, outputs: decoded });
    
    autoencoder.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError'
    });

    return autoencoder;
  }

  /**
   * Train models with historical data
   */
  private async trainModels(): Promise<void> {
    const trainingData = await this.prepareTrainingData();
    
    if (trainingData.length < 1000) {
      console.warn('Insufficient training data, generating synthetic data...');
      await this.generateSyntheticTrainingData();
      return;
    }

    // Train forecast model
    if (this.forecastModel) {
      const { inputs, outputs } = this.prepareForecastData(trainingData);
      await this.forecastModel.fit(inputs, outputs, {
        epochs: 100,
        batchSize: 32,
        validationSplit: 0.2,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            if (epoch % 10 === 0) {
              console.log(`Forecast model - Epoch ${epoch}: loss = ${logs?.loss}`);
            }
          }
        }
      });
    }

    // Save models
    await this.saveModels();
  }

  /**
   * Generate synthetic training data
   */
  private async generateSyntheticTrainingData(): Promise<void> {
    const patterns = [
      this.generateEnterprisePattern,
      this.generateStartupPattern,
      this.generateEcommercePattern,
      this.generateSaaSPattern
    ];

    for (const pattern of patterns) {
      const data = pattern.call(this);
      await this.storeTrainingData(data);
    }
  }

  /**
   * Generate enterprise usage pattern
   */
  private generateEnterprisePattern(): TimeSeries[] {
    const data: TimeSeries[] = [];
    const days = 365;
    
    for (let d = 0; d < days; d++) {
      const dayOfWeek = d % 7;
      const weekOfMonth = Math.floor((d % 30) / 7);
      const monthOfYear = Math.floor(d / 30) % 12;
      
      for (let h = 0; h < 24; h++) {
        // Business hours pattern
        let baseLoad = 20;
        
        // Weekday business hours
        if (dayOfWeek < 5 && h >= 8 && h <= 18) {
          baseLoad = 70 + Math.sin(h * Math.PI / 12) * 20;
        }
        
        // Month-end processing
        if (d % 30 >= 27) {
          baseLoad *= 1.3;
        }
        
        // Quarter-end spike
        if ((monthOfYear + 1) % 3 === 0 && d % 30 >= 25) {
          baseLoad *= 1.5;
        }
        
        // Year-end peak
        if (monthOfYear === 11) {
          baseLoad *= 1.2;
        }
        
        // Add noise and trends
        const trend = d * 0.05; // 5% growth per day
        const noise = (Math.random() - 0.5) * 10;
        
        data.push({
          timestamp: new Date(2024, 0, 1 + d, h),
          cpu: Math.min(95, baseLoad + trend + noise),
          memory: Math.min(95, baseLoad * 0.9 + trend + noise),
          storage: Math.min(95, 30 + d * 0.1),
          network: baseLoad * 100,
          requests: baseLoad * 50,
          latency: 50 + (baseLoad / 10),
          errorRate: Math.max(0, (baseLoad > 80 ? 2 : 0.5) + Math.random()),
          cost: baseLoad * 0.5
        });
      }
    }
    
    return data;
  }

  /**
   * Generate startup growth pattern
   */
  private generateStartupPattern(): TimeSeries[] {
    const data: TimeSeries[] = [];
    const days = 365;
    
    for (let d = 0; d < days; d++) {
      const growthPhase = Math.floor(d / 90); // Quarterly phases
      
      for (let h = 0; h < 24; h++) {
        // Exponential growth with plateaus
        let baseLoad = 10 * Math.pow(1.01, d); // 1% daily growth
        
        // Growth spurts
        if (d % 30 === 15) {
          baseLoad *= 1.5; // Mid-month feature release
        }
        
        // Plateau periods
        if (growthPhase === 1 && d % 90 > 60) {
          baseLoad = baseLoad * 0.7; // Stabilization phase
        }
        
        // Daily pattern
        const hourlyMultiplier = 1 + Math.sin((h - 6) * Math.PI / 12) * 0.3;
        baseLoad *= hourlyMultiplier;
        
        // Add volatility (startups are unpredictable)
        const volatility = (Math.random() - 0.5) * baseLoad * 0.3;
        
        data.push({
          timestamp: new Date(2024, 0, 1 + d, h),
          cpu: Math.min(95, baseLoad + volatility),
          memory: Math.min(95, baseLoad * 0.85 + volatility),
          storage: Math.min(95, 20 + d * 0.2),
          network: baseLoad * 80,
          requests: baseLoad * 30,
          latency: 60 + (baseLoad / 8),
          errorRate: Math.max(0, (baseLoad > 70 ? 3 : 1) + Math.random()),
          cost: baseLoad * 0.4
        });
      }
    }
    
    return data;
  }

  /**
   * Generate e-commerce pattern
   */
  private generateEcommercePattern(): TimeSeries[] {
    const data: TimeSeries[] = [];
    const days = 365;
    
    for (let d = 0; d < days; d++) {
      const dayOfYear = d;
      const isHolidaySeason = (dayOfYear > 320 || dayOfYear < 10); // Nov-Dec, Jan
      const isBlackFriday = dayOfYear === 329;
      const isCyberMonday = dayOfYear === 332;
      const isPrimeDay = dayOfYear === 195;
      
      for (let h = 0; h < 24; h++) {
        // Base load with daily pattern
        let baseLoad = 30 + Math.sin((h - 6) * Math.PI / 12) * 20;
        
        // Weekend boost
        const dayOfWeek = d % 7;
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          baseLoad *= 1.3;
        }
        
        // Holiday season
        if (isHolidaySeason) {
          baseLoad *= 2.5;
        }
        
        // Special events
        if (isBlackFriday || isCyberMonday) {
          baseLoad *= 5;
        }
        if (isPrimeDay) {
          baseLoad *= 3;
        }
        
        // Flash sales (random)
        if (Math.random() < 0.02) { // 2% chance
          baseLoad *= 2;
        }
        
        // Add realistic noise
        const noise = (Math.random() - 0.5) * 15;
        
        data.push({
          timestamp: new Date(2024, 0, 1 + d, h),
          cpu: Math.min(95, baseLoad + noise),
          memory: Math.min(95, baseLoad * 0.8 + noise),
          storage: Math.min(95, 40 + d * 0.05),
          network: baseLoad * 150,
          requests: baseLoad * 100,
          latency: 40 + (baseLoad / 15),
          errorRate: Math.max(0, (baseLoad > 85 ? 5 : 0.3) + Math.random()),
          cost: baseLoad * 0.6
        });
      }
    }
    
    return data;
  }

  /**
   * Generate SaaS platform pattern
   */
  private generateSaaSPattern(): TimeSeries[] {
    const data: TimeSeries[] = [];
    const days = 365;
    let customerCount = 100;
    
    for (let d = 0; d < days; d++) {
      // Customer growth
      customerCount *= 1.002; // 0.2% daily growth
      
      // Churn events
      if (Math.random() < 0.05) {
        customerCount *= 0.95;
      }
      
      // New customer onboarding spikes
      const isOnboardingDay = d % 7 === 1; // Mondays
      
      for (let h = 0; h < 24; h++) {
        // Multi-timezone usage
        const timezone1 = 30 + Math.sin((h - 8) * Math.PI / 12) * 20; // US
        const timezone2 = 30 + Math.sin((h - 0) * Math.PI / 12) * 20; // EU
        const timezone3 = 30 + Math.sin((h + 8) * Math.PI / 12) * 20; // APAC
        
        let baseLoad = (timezone1 + timezone2 + timezone3) / 3;
        baseLoad *= (customerCount / 100); // Scale with customers
        
        // Onboarding spike
        if (isOnboardingDay && h >= 9 && h <= 17) {
          baseLoad *= 1.4;
        }
        
        // API usage patterns
        const apiSpikes = Math.sin(h * Math.PI / 3) * 10; // Every 3 hours
        
        data.push({
          timestamp: new Date(2024, 0, 1 + d, h),
          cpu: Math.min(95, baseLoad + apiSpikes),
          memory: Math.min(95, baseLoad * 0.75),
          storage: Math.min(95, 35 + (customerCount / 10)),
          network: baseLoad * 90,
          requests: baseLoad * 60 + apiSpikes * 10,
          latency: 45 + (baseLoad / 12),
          errorRate: Math.max(0, 0.1 + Math.random() * 0.5),
          cost: baseLoad * 0.45
        });
      }
    }
    
    return data;
  }

  /**
   * Forecast demand
   */
  public async forecastDemand(
    horizon: number = 7,
    options: {
      includeSeasonality?: boolean;
      includeTrend?: boolean;
      includeAnomalies?: boolean;
      confidenceLevel?: number;
    } = {}
  ): Promise<DemandForecast> {
    // Get historical data
    const historical = await this.getHistoricalData();
    
    // Detect seasonality
    const seasonality = await this.analyzeSeasonality(historical);
    
    // Analyze trend
    const trend = await this.analyzeTrend(historical);
    
    // Make predictions
    const predictions = await this.makePredictions(
      historical,
      horizon,
      seasonality,
      trend,
      options
    );
    
    // Generate recommendations
    const recommendations = await this.generateRecommendations(
      predictions,
      trend,
      seasonality
    );
    
    // Determine pattern
    const pattern = this.determinePattern(trend, seasonality);
    
    const forecast: DemandForecast = {
      timestamp: new Date(),
      horizon,
      predictions,
      confidence: this.calculateConfidence(historical, predictions),
      pattern,
      seasonality,
      trend,
      recommendations
    };
    
    // Store forecast
    this.forecasts.set(`forecast-${Date.now()}`, forecast);
    await this.storeForecast(forecast);
    
    // Emit event
    this.emit('forecast:generated', forecast);
    
    return forecast;
  }

  /**
   * Analyze seasonality
   */
  private async analyzeSeasonality(data: TimeSeries[]): Promise<SeasonalityAnalysis> {
    const periods = this.config.seasonalityPeriods || [24, 168, 720]; // Hourly, weekly, monthly
    
    const analysis: SeasonalityAnalysis = {
      daily: await this.detectSeasonalPattern(data, 24),
      weekly: await this.detectSeasonalPattern(data, 168),
      monthly: await this.detectSeasonalPattern(data, 720),
      yearly: await this.detectSeasonalPattern(data, 8760),
      customPeriods: []
    };
    
    // Analyze custom periods
    for (const period of periods) {
      if (![24, 168, 720, 8760].includes(period)) {
        analysis.customPeriods.push(await this.detectSeasonalPattern(data, period));
      }
    }
    
    return analysis;
  }

  /**
   * Detect seasonal pattern using FFT
   */
  private async detectSeasonalPattern(
    data: TimeSeries[],
    period: number
  ): Promise<SeasonalPattern> {
    if (data.length < period * 2) {
      return {
        period,
        strength: 0,
        phase: 0,
        peaks: [],
        troughs: []
      };
    }

    // Extract CPU usage as example metric
    const values = data.map(d => d.cpu);
    
    // Apply FFT (simplified - real implementation would use proper FFT)
    const fft = this.computeFFT(values, period);
    
    // Find peaks and troughs
    const { peaks, troughs } = this.findPeaksAndTroughs(data, period);
    
    return {
      period,
      strength: fft.strength,
      phase: fft.phase,
      peaks,
      troughs
    };
  }

  /**
   * Compute FFT (simplified)
   */
  private computeFFT(values: number[], period: number): { strength: number; phase: number } {
    let sumCos = 0;
    let sumSin = 0;
    
    for (let i = 0; i < values.length; i++) {
      const angle = (2 * Math.PI * i) / period;
      sumCos += values[i] * Math.cos(angle);
      sumSin += values[i] * Math.sin(angle);
    }
    
    const strength = Math.sqrt(sumCos * sumCos + sumSin * sumSin) / values.length;
    const phase = Math.atan2(sumSin, sumCos);
    
    return { strength: Math.min(1, strength / 50), phase };
  }

  /**
   * Find peaks and troughs
   */
  private findPeaksAndTroughs(
    data: TimeSeries[],
    period: number
  ): { peaks: Date[]; troughs: Date[] } {
    const peaks: Date[] = [];
    const troughs: Date[] = [];
    
    for (let i = 1; i < data.length - 1; i++) {
      if (data[i].cpu > data[i - 1].cpu && data[i].cpu > data[i + 1].cpu) {
        peaks.push(data[i].timestamp);
      }
      if (data[i].cpu < data[i - 1].cpu && data[i].cpu < data[i + 1].cpu) {
        troughs.push(data[i].timestamp);
      }
    }
    
    return { peaks: peaks.slice(0, 10), troughs: troughs.slice(0, 10) };
  }

  /**
   * Analyze trend
   */
  private async analyzeTrend(data: TimeSeries[]): Promise<TrendAnalysis> {
    if (data.length < 30) {
      return {
        direction: 'stable',
        growthRate: 0,
        acceleration: 0,
        changePoints: [],
        projectedGrowth: 0
      };
    }

    // Calculate trend using linear regression
    const trend = this.calculateLinearTrend(data);
    
    // Detect change points
    const changePoints = await this.detectChangePoints(data);
    
    // Determine direction
    let direction: 'increasing' | 'decreasing' | 'stable' | 'volatile';
    if (Math.abs(trend.slope) < 0.01) {
      direction = 'stable';
    } else if (trend.slope > 0) {
      direction = 'increasing';
    } else {
      direction = 'decreasing';
    }
    
    // Check for volatility
    const volatility = this.calculateVolatility(data);
    if (volatility > 0.3) {
      direction = 'volatile';
    }
    
    return {
      direction,
      growthRate: trend.slope,
      acceleration: trend.acceleration,
      changePoints,
      projectedGrowth: trend.slope * 30 // 30-day projection
    };
  }

  /**
   * Calculate linear trend
   */
  private calculateLinearTrend(
    data: TimeSeries[]
  ): { slope: number; intercept: number; acceleration: number } {
    const n = data.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += data[i].cpu;
      sumXY += i * data[i].cpu;
      sumX2 += i * i;
    }
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate acceleration (second derivative)
    const midPoint = Math.floor(n / 2);
    const firstHalfSlope = this.calculateLinearTrend(data.slice(0, midPoint)).slope;
    const secondHalfSlope = this.calculateLinearTrend(data.slice(midPoint)).slope;
    const acceleration = (secondHalfSlope - firstHalfSlope) / midPoint;
    
    return { slope, intercept, acceleration };
  }

  /**
   * Calculate volatility
   */
  private calculateVolatility(data: TimeSeries[]): number {
    const values = data.map(d => d.cpu);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance) / mean;
  }

  /**
   * Detect change points
   */
  private async detectChangePoints(data: TimeSeries[]): Promise<ChangePoint[]> {
    const changePoints: ChangePoint[] = [];
    const windowSize = Math.min(24, Math.floor(data.length / 10));
    
    for (let i = windowSize; i < data.length - windowSize; i++) {
      const before = data.slice(i - windowSize, i);
      const after = data.slice(i, i + windowSize);
      
      const meanBefore = this.calculateMean(before.map(d => d.cpu));
      const meanAfter = this.calculateMean(after.map(d => d.cpu));
      
      const change = Math.abs(meanAfter - meanBefore);
      const threshold = 10; // 10% change
      
      if (change > threshold) {
        changePoints.push({
          timestamp: data[i].timestamp,
          type: meanAfter > meanBefore ? 'growth' : 'decline',
          magnitude: change,
          confidence: Math.min(0.95, change / 50)
        });
      }
    }
    
    return changePoints.slice(0, 5); // Return top 5 change points
  }

  /**
   * Calculate mean
   */
  private calculateMean(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Make predictions
   */
  private async makePredictions(
    historical: TimeSeries[],
    horizon: number,
    seasonality: SeasonalityAnalysis,
    trend: TrendAnalysis,
    options: any
  ): Promise<ResourcePrediction[]> {
    const predictions: ResourcePrediction[] = [];
    
    // Use ML model if available
    if (this.forecastModel && historical.length >= 168) {
      const mlPredictions = await this.makeMlPredictions(historical, horizon);
      predictions.push(...mlPredictions);
    } else {
      // Fallback to statistical methods
      const statPredictions = await this.makeStatisticalPredictions(
        historical,
        horizon,
        seasonality,
        trend
      );
      predictions.push(...statPredictions);
    }
    
    return predictions;
  }

  /**
   * Make ML-based predictions
   */
  private async makeMlPredictions(
    historical: TimeSeries[],
    horizon: number
  ): Promise<ResourcePrediction[]> {
    if (!this.forecastModel) return [];
    
    // Prepare input data
    const input = this.prepareModelInput(historical);
    
    // Make prediction
    const prediction = this.forecastModel.predict(input) as tf.Tensor;
    const values = await prediction.data();
    
    // Convert to resource predictions
    const predictions: ResourcePrediction[] = [];
    const hoursToPredict = Math.min(horizon * 24, values.length);
    
    for (let h = 0; h < hoursToPredict; h++) {
      const timestamp = new Date(Date.now() + h * 3600000);
      
      predictions.push({
        timestamp,
        resourceType: ResourceType.COMPUTE,
        provider: CloudProvider.AWS,
        region: 'us-east-1',
        predicted: {
          cpu: values[h] || 50,
          memory: (values[h] || 50) * 0.8,
          storage: 100,
          networkBandwidth: 1000
        },
        lowerBound: {
          cpu: Math.max(0, (values[h] || 50) - 10),
          memory: Math.max(0, ((values[h] || 50) * 0.8) - 10),
          storage: 100,
          networkBandwidth: 1000
        },
        upperBound: {
          cpu: Math.min(100, (values[h] || 50) + 10),
          memory: Math.min(100, ((values[h] || 50) * 0.8) + 10),
          storage: 100,
          networkBandwidth: 1000
        },
        confidence: 0.85
      });
    }
    
    input.dispose();
    prediction.dispose();
    
    return predictions;
  }

  /**
   * Make statistical predictions
   */
  private async makeStatisticalPredictions(
    historical: TimeSeries[],
    horizon: number,
    seasonality: SeasonalityAnalysis,
    trend: TrendAnalysis
  ): Promise<ResourcePrediction[]> {
    const predictions: ResourcePrediction[] = [];
    const lastValue = historical[historical.length - 1];
    
    for (let d = 0; d < horizon; d++) {
      for (let h = 0; h < 24; h++) {
        const timestamp = new Date(Date.now() + (d * 24 + h) * 3600000);
        
        // Apply trend
        let predictedCpu = lastValue.cpu + trend.growthRate * (d * 24 + h);
        
        // Apply seasonality
        if (seasonality.daily.strength > 0.3) {
          predictedCpu *= (1 + Math.sin((h - 12) * Math.PI / 12) * seasonality.daily.strength);
        }
        
        // Add confidence bounds
        const confidence = 0.7 - (d * 0.05); // Confidence decreases with horizon
        const uncertainty = (1 - confidence) * 20;
        
        predictions.push({
          timestamp,
          resourceType: ResourceType.COMPUTE,
          provider: CloudProvider.AWS,
          region: 'us-east-1',
          predicted: {
            cpu: Math.min(95, Math.max(5, predictedCpu)),
            memory: Math.min(95, Math.max(5, predictedCpu * 0.8)),
            storage: 100 + d * 2,
            networkBandwidth: 1000
          },
          lowerBound: {
            cpu: Math.max(5, predictedCpu - uncertainty),
            memory: Math.max(5, (predictedCpu - uncertainty) * 0.8),
            storage: 100 + d * 2,
            networkBandwidth: 1000
          },
          upperBound: {
            cpu: Math.min(95, predictedCpu + uncertainty),
            memory: Math.min(95, (predictedCpu + uncertainty) * 0.8),
            storage: 100 + d * 2,
            networkBandwidth: 1000
          },
          confidence
        });
      }
    }
    
    return predictions;
  }

  /**
   * Generate capacity recommendations
   */
  private async generateRecommendations(
    predictions: ResourcePrediction[],
    trend: TrendAnalysis,
    seasonality: SeasonalityAnalysis
  ): Promise<CapacityRecommendation[]> {
    const recommendations: CapacityRecommendation[] = [];
    
    // Analyze predictions
    const maxPredicted = Math.max(...predictions.map(p => p.predicted.cpu));
    const avgPredicted = predictions.reduce((sum, p) => sum + p.predicted.cpu, 0) / predictions.length;
    
    // Growth-based recommendations
    if (trend.direction === 'increasing' && trend.growthRate > 0.05) {
      recommendations.push({
        type: RecommendationType.RESERVE,
        priority: 'high',
        action: 'Reserve additional capacity for projected growth',
        impact: {
          cpu: Math.ceil(maxPredicted * 1.2),
          memory: Math.ceil(maxPredicted * 0.8 * 1.2),
          storage: 200,
          network: 2000
        },
        cost: {
          current: 1000,
          projected: 1500,
          savings: 0,
          roi: 0,
          paybackPeriod: 0
        },
        risk: {
          level: 'medium',
          probability: 0.7,
          impact: 0.6,
          mitigations: ['Implement auto-scaling', 'Monitor usage patterns'],
          contingencies: ['Burst capacity available', 'Multi-region failover']
        },
        timeline: '1-2 weeks'
      });
    }
    
    // Seasonality-based recommendations
    if (seasonality.weekly.strength > 0.5) {
      recommendations.push({
        type: RecommendationType.OPTIMIZE,
        priority: 'medium',
        action: 'Implement scheduled scaling for weekly patterns',
        impact: {
          cpu: avgPredicted,
          memory: avgPredicted * 0.8,
          storage: 100,
          network: 1000
        },
        cost: {
          current: 1000,
          projected: 800,
          savings: 200,
          roi: 0.25,
          paybackPeriod: 3
        },
        risk: {
          level: 'low',
          probability: 0.2,
          impact: 0.3,
          mitigations: ['Buffer capacity maintained'],
          contingencies: ['Quick scale-up capability']
        },
        timeline: 'Immediate'
      });
    }
    
    // Cost optimization
    if (avgPredicted < 40) {
      recommendations.push({
        type: RecommendationType.CONSOLIDATE,
        priority: 'low',
        action: 'Consolidate underutilized resources',
        impact: {
          cpu: avgPredicted,
          memory: avgPredicted * 0.8,
          storage: 50,
          network: 500
        },
        cost: {
          current: 1000,
          projected: 600,
          savings: 400,
          roi: 0.67,
          paybackPeriod: 2
        },
        risk: {
          level: 'low',
          probability: 0.3,
          impact: 0.4,
          mitigations: ['Maintain minimum capacity'],
          contingencies: ['Auto-scaling enabled']
        },
        timeline: '1 month'
      });
    }
    
    return recommendations;
  }

  /**
   * Create what-if scenario
   */
  public async createWhatIfScenario(
    name: string,
    description: string,
    parameters: ScenarioParameters
  ): Promise<WhatIfScenario> {
    // Get baseline forecast
    const baseline = await this.forecastDemand(30);
    
    // Apply scenario parameters
    const scenarioForecast = await this.applyScenarioParameters(baseline, parameters);
    
    // Calculate results
    const results: ScenarioResults = {
      forecast: scenarioForecast,
      capacityRequired: this.calculateRequiredCapacity(scenarioForecast),
      estimatedCost: await this.estimateScenarioCost(scenarioForecast),
      performanceMetrics: await this.estimatePerformance(scenarioForecast, parameters),
      risks: await this.assessScenarioRisks(scenarioForecast, parameters)
    };
    
    // Create comparison
    const comparison = await this.compareScenarios(baseline, results);
    
    const scenario: WhatIfScenario = {
      id: `scenario-${Date.now()}`,
      name,
      description,
      parameters,
      results,
      comparison
    };
    
    // Store scenario
    this.scenarios.set(scenario.id, scenario);
    await this.storeScenario(scenario);
    
    // Emit event
    this.emit('scenario:created', scenario);
    
    return scenario;
  }

  /**
   * Apply scenario parameters
   */
  private async applyScenarioParameters(
    baseline: DemandForecast,
    parameters: ScenarioParameters
  ): Promise<DemandForecast> {
    const modifiedForecast = { ...baseline };
    
    // Apply growth rate
    if (parameters.growthRate !== undefined) {
      modifiedForecast.predictions = modifiedForecast.predictions.map(p => ({
        ...p,
        predicted: {
          ...p.predicted,
          cpu: p.predicted.cpu * (1 + parameters.growthRate),
          memory: p.predicted.memory * (1 + parameters.growthRate)
        }
      }));
    }
    
    // Apply seasonality multiplier
    if (parameters.seasonalityMultiplier !== undefined) {
      modifiedForecast.seasonality.daily.strength *= parameters.seasonalityMultiplier;
      modifiedForecast.seasonality.weekly.strength *= parameters.seasonalityMultiplier;
    }
    
    // Apply peak load increase
    if (parameters.peakLoadIncrease !== undefined) {
      const maxIdx = modifiedForecast.predictions.reduce(
        (maxIdx, p, idx, arr) => p.predicted.cpu > arr[maxIdx].predicted.cpu ? idx : maxIdx,
        0
      );
      
      modifiedForecast.predictions[maxIdx].predicted.cpu *= (1 + parameters.peakLoadIncrease);
      modifiedForecast.predictions[maxIdx].predicted.memory *= (1 + parameters.peakLoadIncrease);
    }
    
    return modifiedForecast;
  }

  /**
   * Calculate required capacity
   */
  private calculateRequiredCapacity(forecast: DemandForecast): ResourceQuotas {
    const maxCpu = Math.max(...forecast.predictions.map(p => p.upperBound.cpu));
    const maxMemory = Math.max(...forecast.predictions.map(p => p.upperBound.memory));
    const maxStorage = Math.max(...forecast.predictions.map(p => p.upperBound.storage));
    
    // Add buffer
    const buffer = 1.2;
    
    return {
      cpu: Math.ceil(maxCpu * buffer),
      memory: Math.ceil(maxMemory * buffer),
      storage: Math.ceil(maxStorage * buffer),
      networkBandwidth: 2000
    };
  }

  /**
   * Estimate scenario cost
   */
  private async estimateScenarioCost(forecast: DemandForecast): Promise<number> {
    const avgCpu = forecast.predictions.reduce((sum, p) => sum + p.predicted.cpu, 0) / forecast.predictions.length;
    const avgMemory = forecast.predictions.reduce((sum, p) => sum + p.predicted.memory, 0) / forecast.predictions.length;
    
    // Simple cost model
    const cpuCost = avgCpu * 0.05 * 24 * 30; // $0.05 per CPU hour
    const memoryCost = avgMemory * 0.01 * 24 * 30; // $0.01 per GB hour
    const storageCost = 100 * 0.001 * 24 * 30; // $0.001 per GB hour
    
    return cpuCost + memoryCost + storageCost;
  }

  /**
   * Estimate performance
   */
  private async estimatePerformance(
    forecast: DemandForecast,
    parameters: ScenarioParameters
  ): Promise<PerformanceTargets> {
    const targets = parameters.performanceTargets || {
      availability: 99.9,
      latency: 100,
      throughput: 1000,
      errorRate: 0.1
    };
    
    // Adjust based on forecast
    const avgLoad = forecast.predictions.reduce((sum, p) => sum + p.predicted.cpu, 0) / forecast.predictions.length;
    
    if (avgLoad > 80) {
      targets.availability = Math.max(99, targets.availability - 0.5);
      targets.latency = targets.latency * 1.2;
      targets.errorRate = Math.min(1, targets.errorRate * 1.5);
    }
    
    return targets;
  }

  /**
   * Assess scenario risks
   */
  private async assessScenarioRisks(
    forecast: DemandForecast,
    parameters: ScenarioParameters
  ): Promise<RiskAssessment[]> {
    const risks: RiskAssessment[] = [];
    
    // Check for capacity risks
    const maxCpu = Math.max(...forecast.predictions.map(p => p.predicted.cpu));
    if (maxCpu > 85) {
      risks.push({
        level: 'high',
        probability: 0.7,
        impact: 0.8,
        mitigations: [
          'Implement auto-scaling',
          'Reserve burst capacity',
          'Optimize resource usage'
        ],
        contingencies: [
          'Emergency capacity provision',
          'Load shedding protocols',
          'Multi-region failover'
        ]
      });
    }
    
    // Check for cost risks
    if (parameters.costConstraints) {
      const estimatedCost = await this.estimateScenarioCost(forecast);
      if (estimatedCost > parameters.costConstraints) {
        risks.push({
          level: 'medium',
          probability: 0.9,
          impact: 0.6,
          mitigations: [
            'Implement cost optimization',
            'Use spot instances',
            'Negotiate volume discounts'
          ],
          contingencies: [
            'Budget reallocation',
            'Service tier adjustment'
          ]
        });
      }
    }
    
    return risks;
  }

  /**
   * Compare scenarios
   */
  private async compareScenarios(
    baseline: DemandForecast,
    scenarioResults: ScenarioResults
  ): Promise<ScenarioComparison> {
    const baselineResults: ScenarioResults = {
      forecast: baseline,
      capacityRequired: this.calculateRequiredCapacity(baseline),
      estimatedCost: await this.estimateScenarioCost(baseline),
      performanceMetrics: {
        availability: 99.9,
        latency: 100,
        throughput: 1000,
        errorRate: 0.1
      },
      risks: []
    };
    
    const comparison: ScenarioComparison = {
      baseline: baselineResults,
      scenarios: new Map([['scenario', scenarioResults]]),
      optimalScenario: 'baseline',
      tradeoffs: [
        {
          dimension: 'cost',
          scenarios: ['baseline', 'scenario'],
          analysis: `Cost difference: $${Math.abs(baselineResults.estimatedCost - scenarioResults.estimatedCost).toFixed(2)}`,
          recommendation: scenarioResults.estimatedCost < baselineResults.estimatedCost ? 'scenario' : 'baseline'
        }
      ]
    };
    
    return comparison;
  }

  /**
   * Create budget plan
   */
  public async createBudgetPlan(
    period: string,
    totalBudget: number
  ): Promise<BudgetPlan> {
    const forecast = await this.forecastDemand(30);
    
    // Calculate allocations
    const allocations = await this.calculateBudgetAllocations(totalBudget, forecast);
    
    // Create forecast
    const budgetForecast = await this.createBudgetForecast(allocations, forecast);
    
    // Optimize budget
    const optimization = await this.optimizeBudget(allocations, forecast);
    
    const plan: BudgetPlan = {
      period,
      totalBudget,
      allocations,
      forecast: budgetForecast,
      optimization
    };
    
    // Store plan
    this.budgetPlans.set(`budget-${Date.now()}`, plan);
    await this.storeBudgetPlan(plan);
    
    // Emit event
    this.emit('budget:created', plan);
    
    return plan;
  }

  /**
   * Calculate budget allocations
   */
  private async calculateBudgetAllocations(
    totalBudget: number,
    forecast: DemandForecast
  ): Promise<BudgetAllocation[]> {
    const allocations: BudgetAllocation[] = [
      {
        category: 'Compute',
        provider: CloudProvider.AWS,
        resourceType: ResourceType.COMPUTE,
        amount: totalBudget * 0.4,
        percentage: 40,
        justification: 'Primary compute workloads'
      },
      {
        category: 'Storage',
        provider: CloudProvider.AWS,
        resourceType: ResourceType.STORAGE,
        amount: totalBudget * 0.2,
        percentage: 20,
        justification: 'Data storage and backups'
      },
      {
        category: 'Database',
        provider: CloudProvider.AWS,
        resourceType: ResourceType.DATABASE,
        amount: totalBudget * 0.25,
        percentage: 25,
        justification: 'Database services'
      },
      {
        category: 'Network',
        provider: CloudProvider.AWS,
        resourceType: ResourceType.NETWORK,
        amount: totalBudget * 0.15,
        percentage: 15,
        justification: 'Network and CDN'
      }
    ];
    
    return allocations;
  }

  /**
   * Create budget forecast
   */
  private async createBudgetForecast(
    allocations: BudgetAllocation[],
    forecast: DemandForecast
  ): Promise<BudgetForecast> {
    const totalAllocated = allocations.reduce((sum, a) => sum + a.amount, 0);
    const projectedCost = await this.estimateScenarioCost(forecast);
    
    return {
      projected: projectedCost,
      confidence: 0.8,
      variance: Math.abs(projectedCost - totalAllocated) / totalAllocated,
      risks: projectedCost > totalAllocated ? ['Budget overrun risk'] : [],
      opportunities: ['Volume discounts', 'Reserved instances', 'Spot usage']
    };
  }

  /**
   * Optimize budget
   */
  private async optimizeBudget(
    allocations: BudgetAllocation[],
    forecast: DemandForecast
  ): Promise<BudgetOptimization> {
    const currentSpend = allocations.reduce((sum, a) => sum + a.amount, 0);
    const optimizedSpend = currentSpend * 0.8; // 20% savings target
    
    return {
      currentSpend,
      optimizedSpend,
      savings: currentSpend - optimizedSpend,
      recommendations: [
        'Use reserved instances for predictable workloads',
        'Implement auto-scaling to reduce idle capacity',
        'Consolidate underutilized resources',
        'Use spot instances for batch workloads'
      ],
      implementation: [
        'Analyze usage patterns',
        'Purchase 1-year reserved instances',
        'Configure auto-scaling policies',
        'Implement cost monitoring'
      ]
    };
  }

  /**
   * Assess capacity risk
   */
  public async assessCapacityRisk(
    forecast: DemandForecast,
    currentCapacity: ResourceQuotas
  ): Promise<RiskAssessment> {
    const requiredCapacity = this.calculateRequiredCapacity(forecast);
    
    // Check for shortfall
    const cpuShortfall = Math.max(0, requiredCapacity.cpu - currentCapacity.cpu);
    const memoryShortfall = Math.max(0, requiredCapacity.memory - currentCapacity.memory);
    
    let level: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let probability = 0.1;
    let impact = 0.1;
    
    if (cpuShortfall > 20 || memoryShortfall > 20) {
      level = 'critical';
      probability = 0.9;
      impact = 0.9;
    } else if (cpuShortfall > 10 || memoryShortfall > 10) {
      level = 'high';
      probability = 0.7;
      impact = 0.7;
    } else if (cpuShortfall > 5 || memoryShortfall > 5) {
      level = 'medium';
      probability = 0.5;
      impact = 0.5;
    }
    
    return {
      level,
      probability,
      impact,
      mitigations: [
        'Reserve additional capacity',
        'Implement auto-scaling',
        'Optimize resource usage',
        'Enable burst capacity'
      ],
      contingencies: [
        'Emergency capacity provision',
        'Load balancing across regions',
        'Service degradation protocols',
        'Traffic shaping'
      ]
    };
  }

  /**
   * Helper methods
   */
  
  private determinePattern(trend: TrendAnalysis, seasonality: SeasonalityAnalysis): DemandPattern {
    if (trend.direction === 'volatile') return DemandPattern.IRREGULAR;
    if (seasonality.weekly.strength > 0.5 || seasonality.daily.strength > 0.5) return DemandPattern.SEASONAL;
    if (trend.growthRate > 0.1) return DemandPattern.EXPONENTIAL;
    if (trend.growthRate > 0) return DemandPattern.LINEAR;
    return DemandPattern.CYCLICAL;
  }

  private calculateConfidence(historical: TimeSeries[], predictions: ResourcePrediction[]): number {
    let confidence = 0.5;
    
    // More historical data = higher confidence
    if (historical.length > 8760) confidence += 0.2; // 1 year
    else if (historical.length > 2160) confidence += 0.15; // 3 months
    else if (historical.length > 720) confidence += 0.1; // 1 month
    
    // Check prediction consistency
    const avgConfidence = predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length;
    confidence += avgConfidence * 0.3;
    
    return Math.min(0.95, confidence);
  }

  private prepareModelInput(historical: TimeSeries[]): tf.Tensor {
    const features = historical.slice(-168).map(h => [
      h.cpu / 100,
      h.memory / 100,
      h.storage / 1000,
      h.network / 10000,
      h.requests / 10000,
      h.latency / 1000,
      h.errorRate / 100,
      h.cost / 1000,
      h.timestamp.getHours() / 24,
      h.timestamp.getDay() / 7,
      h.timestamp.getDate() / 31,
      h.timestamp.getMonth() / 12,
      Math.sin(2 * Math.PI * h.timestamp.getHours() / 24),
      Math.cos(2 * Math.PI * h.timestamp.getHours() / 24),
      Math.sin(2 * Math.PI * h.timestamp.getDay() / 7)
    ]);
    
    return tf.tensor3d([features]);
  }

  private async getHistoricalData(): Promise<TimeSeries[]> {
    const data = await this.redis.lrange('capacity:historical', 0, -1);
    return data.map(d => JSON.parse(d));
  }

  private async loadHistoricalData(): Promise<void> {
    const data = await this.getHistoricalData();
    
    // Group by resource
    for (const entry of data) {
      const key = `${entry.provider || 'aws'}-${entry.region || 'us-east-1'}`;
      let series = this.historicalData.get(key) || [];
      series.push(entry);
      this.historicalData.set(key, series);
    }
  }

  private async prepareTrainingData(): Promise<any[]> {
    const allData: any[] = [];
    
    for (const [key, series] of this.historicalData) {
      allData.push(...series);
    }
    
    return allData;
  }

  private prepareForecastData(data: any[]): { inputs: tf.Tensor; outputs: tf.Tensor } {
    // Simplified - real implementation would properly prepare tensors
    const inputs = tf.zeros([data.length, 168, 15]);
    const outputs = tf.zeros([data.length, 72]);
    
    return { inputs, outputs };
  }

  private async storeTrainingData(data: TimeSeries[]): Promise<void> {
    const pipeline = this.redis.pipeline();
    
    for (const entry of data) {
      pipeline.rpush('capacity:historical', JSON.stringify(entry));
    }
    
    // Keep only last 100000 entries
    pipeline.ltrim('capacity:historical', -100000, -1);
    
    await pipeline.exec();
  }

  private async saveModels(): Promise<void> {
    const modelPath = this.config.mlModelPath || './models/capacity-planning';
    
    if (this.forecastModel) {
      await this.forecastModel.save(`file://${modelPath}/forecast-model`);
    }
    if (this.trendModel) {
      await this.trendModel.save(`file://${modelPath}/trend-model`);
    }
    if (this.anomalyModel) {
      await this.anomalyModel.save(`file://${modelPath}/anomaly-model`);
    }
  }

  private async storeForecast(forecast: DemandForecast): Promise<void> {
    await this.redis.setex(
      `forecast:${Date.now()}`,
      86400, // 24 hours
      JSON.stringify(forecast)
    );
  }

  private async storeScenario(scenario: WhatIfScenario): Promise<void> {
    await this.redis.setex(
      `scenario:${scenario.id}`,
      604800, // 7 days
      JSON.stringify(scenario)
    );
  }

  private async storeBudgetPlan(plan: BudgetPlan): Promise<void> {
    await this.redis.setex(
      `budget:${Date.now()}`,
      2592000, // 30 days
      JSON.stringify(plan)
    );
  }

  private startForecastingCycle(): void {
    // Run forecasting every hour
    setInterval(async () => {
      try {
        await this.forecastDemand(7);
      } catch (error) {
        console.error('Forecasting error:', error);
      }
    }, 3600000);
  }

  /**
   * Cleanup and disconnect
   */
  public async cleanup(): Promise<void> {
    await this.redis.quit();
    this.removeAllListeners();
  }
}

/**
 * Helper Types
 */
interface TimeSeries {
  timestamp: Date;
  cpu: number;
  memory: number;
  storage: number;
  network: number;
  requests: number;
  latency: number;
  errorRate: number;
  cost: number;
  provider?: CloudProvider;
  region?: string;
}

export default CapacityPlanner;