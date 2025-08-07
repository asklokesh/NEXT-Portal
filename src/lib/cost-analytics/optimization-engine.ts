import { z } from 'zod';
import winston from 'winston';
import { EventEmitter } from 'events';
import { costMonitor } from '../cost/monitor';
import { costAggregator } from '../cost/aggregator';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'cost-optimization.log' })
  ]
});

// Optimization recommendation schemas
export const OptimizationRecommendationSchema = z.object({
  id: z.string(),
  serviceId: z.string(),
  serviceName: z.string(),
  type: z.enum([
    'rightsizing',
    'reserved_instances',
    'spot_instances',
    'idle_resources',
    'storage_optimization',
    'data_transfer',
    'auto_scaling',
    'resource_consolidation',
    'scheduled_scaling',
    'cost_anomaly'
  ]),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  title: z.string(),
  description: z.string(),
  currentCost: z.number(),
  potentialSavings: z.number(),
  implementationEffort: z.enum(['low', 'medium', 'high']),
  confidence: z.number().min(0).max(1), // 0-1 scale
  provider: z.string(),
  region: z.string().optional(),
  resourceType: z.string().optional(),
  actionItems: z.array(z.string()),
  riskLevel: z.enum(['low', 'medium', 'high']),
  estimatedTimeToSave: z.string(), // e.g., "immediate", "1 week", "1 month"
  metadata: z.record(z.any()).default({}),
  createdAt: z.date().default(() => new Date()),
  status: z.enum(['active', 'implemented', 'dismissed', 'in_progress']).default('active')
});

export const CostForecastSchema = z.object({
  serviceId: z.string(),
  serviceName: z.string(),
  provider: z.string(),
  forecastPeriod: z.enum(['1_month', '3_months', '6_months', '1_year']),
  currentMonthlyCost: z.number(),
  forecastedCost: z.number(),
  trend: z.enum(['increasing', 'decreasing', 'stable']),
  growthRate: z.number(), // percentage
  seasonalityFactor: z.number().default(1),
  confidence: z.number().min(0).max(1),
  factors: z.array(z.object({
    name: z.string(),
    impact: z.number(), // percentage impact
    description: z.string()
  })).default([]),
  createdAt: z.date().default(() => new Date())
});

export const BudgetOptimizationSchema = z.object({
  serviceId: z.string().optional(),
  teamId: z.string().optional(),
  currentBudget: z.number(),
  recommendedBudget: z.number(),
  reasoning: z.string(),
  basedOnData: z.object({
    historicalSpend: z.number(),
    growthProjection: z.number(),
    seasonalAdjustment: z.number()
  }),
  riskAssessment: z.object({
    overBudgetRisk: z.number().min(0).max(1),
    underUtilizationRisk: z.number().min(0).max(1)
  }),
  createdAt: z.date().default(() => new Date())
});

export type OptimizationRecommendation = z.infer<typeof OptimizationRecommendationSchema>;
export type CostForecast = z.infer<typeof CostForecastSchema>;
export type BudgetOptimization = z.infer<typeof BudgetOptimizationSchema>;

interface OptimizationEngineConfig {
  analysisInterval?: number; // milliseconds
  minSavingsThreshold?: number; // minimum savings to recommend
  confidenceThreshold?: number; // minimum confidence to show recommendation
  enableMLPredictions?: boolean;
  historicalDataDays?: number;
}

export class CostOptimizationEngine extends EventEmitter {
  private config: Required<OptimizationEngineConfig>;
  private analysisTimer?: NodeJS.Timeout;
  private isAnalyzing: boolean = false;
  private recommendations: Map<string, OptimizationRecommendation> = new Map();
  private forecasts: Map<string, CostForecast> = new Map();

  constructor(config: OptimizationEngineConfig = {}) {
    super();
    this.config = {
      analysisInterval: config.analysisInterval || 6 * 60 * 60 * 1000, // 6 hours
      minSavingsThreshold: config.minSavingsThreshold || 10, // $10 minimum savings
      confidenceThreshold: config.confidenceThreshold || 0.7, // 70% confidence
      enableMLPredictions: config.enableMLPredictions ?? true,
      historicalDataDays: config.historicalDataDays || 90
    };

    logger.info('Cost Optimization Engine initialized', { config: this.config });
  }

  // Start optimization analysis
  start(): void {
    if (this.isAnalyzing) {
      logger.warn('Optimization analysis already running');
      return;
    }

    this.isAnalyzing = true;
    this.analysisTimer = setInterval(() => {
      this.runOptimizationAnalysis().catch(error => {
        logger.error('Error during optimization analysis', { error: error.message });
      });
    }, this.config.analysisInterval);

    logger.info('Cost optimization analysis started', {
      interval: this.config.analysisInterval
    });

    // Run initial analysis
    this.runOptimizationAnalysis().catch(error => {
      logger.error('Initial optimization analysis failed', { error: error.message });
    });
  }

  // Stop optimization analysis
  stop(): void {
    if (this.analysisTimer) {
      clearInterval(this.analysisTimer);
      this.analysisTimer = undefined;
    }
    this.isAnalyzing = false;
    logger.info('Cost optimization analysis stopped');
  }

  // Run comprehensive optimization analysis
  private async runOptimizationAnalysis(): Promise<void> {
    logger.info('Starting cost optimization analysis');
    
    try {
      const [rightsizingRecs, idleResourceRecs, reservedInstanceRecs, storageRecs] = await Promise.allSettled([
        this.analyzeRightsizing(),
        this.analyzeIdleResources(),
        this.analyzeReservedInstances(),
        this.analyzeStorageOptimization()
      ]);

      let totalRecommendations = 0;
      let totalPotentialSavings = 0;

      // Process results
      [rightsizingRecs, idleResourceRecs, reservedInstanceRecs, storageRecs].forEach(result => {
        if (result.status === 'fulfilled') {
          result.value.forEach(rec => {
            this.recommendations.set(rec.id, rec);
            totalRecommendations++;
            totalPotentialSavings += rec.potentialSavings;
          });
        }
      });

      // Generate forecasts
      await this.generateCostForecasts();

      logger.info('Cost optimization analysis completed', {
        totalRecommendations,
        totalPotentialSavings: totalPotentialSavings.toFixed(2)
      });

      this.emit('analysis:completed', {
        recommendations: totalRecommendations,
        potentialSavings: totalPotentialSavings,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Cost optimization analysis failed', { error: error.message });
      this.emit('analysis:failed', { error: error.message });
    }
  }

  // Analyze rightsizing opportunities
  private async analyzeRightsizing(): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];
    
    try {
      // This would integrate with actual cloud provider APIs
      // For now, simulate with historical data analysis
      const services = await this.getServicesWithHistoricalData();
      
      for (const service of services) {
        const utilization = await this.analyzeResourceUtilization(service.id);
        
        if (utilization.avgCpuUtilization < 30 && utilization.avgMemoryUtilization < 40) {
          // Over-provisioned instance
          const currentCost = utilization.monthlyCost;
          const recommendedInstanceSize = this.getRecommendedInstanceSize(utilization);
          const potentialSavings = currentCost * 0.3; // Estimate 30% savings
          
          if (potentialSavings > this.config.minSavingsThreshold) {
            const recommendation: OptimizationRecommendation = {
              id: `rightsizing-${service.id}-${Date.now()}`,
              serviceId: service.id,
              serviceName: service.name,
              type: 'rightsizing',
              priority: potentialSavings > 100 ? 'high' : 'medium',
              title: `Right-size over-provisioned instances for ${service.name}`,
              description: `CPU utilization is ${utilization.avgCpuUtilization.toFixed(1)}% and memory utilization is ${utilization.avgMemoryUtilization.toFixed(1)}%. Consider downsizing to ${recommendedInstanceSize}.`,
              currentCost,
              potentialSavings,
              implementationEffort: 'medium',
              confidence: 0.8,
              provider: utilization.provider,
              region: utilization.region,
              resourceType: 'compute',
              actionItems: [
                'Review application resource requirements',
                `Downsize instances to ${recommendedInstanceSize}`,
                'Monitor performance after changes',
                'Set up auto-scaling if needed'
              ],
              riskLevel: 'low',
              estimatedTimeToSave: '1 week',
              metadata: {
                currentInstanceType: utilization.instanceType,
                recommendedInstanceType: recommendedInstanceSize,
                utilizationData: utilization
              },
              createdAt: new Date(),
              status: 'active'
            };
            
            recommendations.push(recommendation);
          }
        }
      }
    } catch (error) {
      logger.error('Rightsizing analysis failed', { error: error.message });
    }

    return recommendations;
  }

  // Analyze idle resources
  private async analyzeIdleResources(): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];
    
    try {
      const services = await this.getServicesWithHistoricalData();
      
      for (const service of services) {
        const idleResources = await this.detectIdleResources(service.id);
        
        for (const resource of idleResources) {
          if (resource.idleDays >= 7 && resource.monthlyCost > this.config.minSavingsThreshold) {
            const recommendation: OptimizationRecommendation = {
              id: `idle-${service.id}-${resource.resourceId}-${Date.now()}`,
              serviceId: service.id,
              serviceName: service.name,
              type: 'idle_resources',
              priority: resource.monthlyCost > 100 ? 'high' : 'medium',
              title: `Remove idle ${resource.resourceType} in ${service.name}`,
              description: `${resource.resourceType} ${resource.resourceId} has been idle for ${resource.idleDays} days with minimal usage.`,
              currentCost: resource.monthlyCost,
              potentialSavings: resource.monthlyCost,
              implementationEffort: 'low',
              confidence: 0.9,
              provider: resource.provider,
              region: resource.region,
              resourceType: resource.resourceType,
              actionItems: [
                'Verify resource is truly idle',
                'Check for dependencies',
                'Create backup if necessary',
                'Terminate or stop the resource'
              ],
              riskLevel: resource.hasSnapshots ? 'low' : 'medium',
              estimatedTimeToSave: 'immediate',
              metadata: {
                resourceId: resource.resourceId,
                lastActivity: resource.lastActivity,
                idleDays: resource.idleDays
              },
              createdAt: new Date(),
              status: 'active'
            };
            
            recommendations.push(recommendation);
          }
        }
      }
    } catch (error) {
      logger.error('Idle resources analysis failed', { error: error.message });
    }

    return recommendations;
  }

  // Analyze Reserved Instance opportunities
  private async analyzeReservedInstances(): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];
    
    try {
      const services = await this.getServicesWithHistoricalData();
      
      for (const service of services) {
        const usage = await this.analyzeOnDemandUsage(service.id);
        
        if (usage.consistentUsage && usage.monthlyCost > 100) {
          const riSavings = usage.monthlyCost * 0.4; // 40% typical RI savings
          
          if (riSavings > this.config.minSavingsThreshold) {
            const recommendation: OptimizationRecommendation = {
              id: `ri-${service.id}-${Date.now()}`,
              serviceId: service.id,
              serviceName: service.name,
              type: 'reserved_instances',
              priority: riSavings > 200 ? 'high' : 'medium',
              title: `Purchase Reserved Instances for ${service.name}`,
              description: `Service shows consistent usage patterns. Reserved Instances could save $${riSavings.toFixed(2)} monthly.`,
              currentCost: usage.monthlyCost,
              potentialSavings: riSavings,
              implementationEffort: 'low',
              confidence: 0.85,
              provider: usage.provider,
              region: usage.region,
              resourceType: 'compute',
              actionItems: [
                'Review usage patterns over 12 months',
                'Calculate exact RI savings',
                'Purchase appropriate RI type and term',
                'Monitor RI utilization'
              ],
              riskLevel: 'low',
              estimatedTimeToSave: '1 month',
              metadata: {
                instanceTypes: usage.instanceTypes,
                usageHours: usage.averageHoursPerMonth,
                riRecommendation: usage.riRecommendation
              },
              createdAt: new Date(),
              status: 'active'
            };
            
            recommendations.push(recommendation);
          }
        }
      }
    } catch (error) {
      logger.error('Reserved Instances analysis failed', { error: error.message });
    }

    return recommendations;
  }

  // Analyze storage optimization opportunities
  private async analyzeStorageOptimization(): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];
    
    try {
      const services = await this.getServicesWithHistoricalData();
      
      for (const service of services) {
        const storage = await this.analyzeStorageUsage(service.id);
        
        for (const volume of storage.volumes) {
          if (volume.utilizationPercent < 50 && volume.monthlyCost > this.config.minSavingsThreshold) {
            const potentialSavings = volume.monthlyCost * 0.5; // Estimate 50% savings
            
            const recommendation: OptimizationRecommendation = {
              id: `storage-${service.id}-${volume.volumeId}-${Date.now()}`,
              serviceId: service.id,
              serviceName: service.name,
              type: 'storage_optimization',
              priority: potentialSavings > 50 ? 'medium' : 'low',
              title: `Optimize under-utilized storage for ${service.name}`,
              description: `Storage volume ${volume.volumeId} is only ${volume.utilizationPercent.toFixed(1)}% utilized. Consider resizing or changing storage tier.`,
              currentCost: volume.monthlyCost,
              potentialSavings,
              implementationEffort: 'medium',
              confidence: 0.7,
              provider: volume.provider,
              region: volume.region,
              resourceType: 'storage',
              actionItems: [
                'Backup data before changes',
                'Resize volume to appropriate size',
                'Consider lower-tier storage options',
                'Implement storage monitoring'
              ],
              riskLevel: 'medium',
              estimatedTimeToSave: '1 week',
              metadata: {
                volumeId: volume.volumeId,
                currentSize: volume.sizeGB,
                utilizationPercent: volume.utilizationPercent,
                storageType: volume.storageType
              },
              createdAt: new Date(),
              status: 'active'
            };
            
            recommendations.push(recommendation);
          }
        }
      }
    } catch (error) {
      logger.error('Storage optimization analysis failed', { error: error.message });
    }

    return recommendations;
  }

  // Generate cost forecasts
  private async generateCostForecasts(): Promise<void> {
    try {
      const services = await this.getServicesWithHistoricalData();
      
      for (const service of services) {
        const historicalCosts = await this.getHistoricalCosts(service.id, 90);
        if (historicalCosts.length < 30) continue; // Need at least 30 days
        
        const forecast = this.calculateForecast(service, historicalCosts);
        this.forecasts.set(service.id, forecast);
      }
    } catch (error) {
      logger.error('Cost forecast generation failed', { error: error.message });
    }
  }

  // Calculate forecast using simple trend analysis
  private calculateForecast(service: any, historicalCosts: number[]): CostForecast {
    const currentMonthlyCost = historicalCosts[historicalCosts.length - 1];
    const pastMonthlyCost = historicalCosts[historicalCosts.length - 30] || currentMonthlyCost;
    
    const growthRate = pastMonthlyCost > 0 ? 
      ((currentMonthlyCost - pastMonthlyCost) / pastMonthlyCost) * 100 : 0;
    
    const trend = growthRate > 5 ? 'increasing' : 
                 growthRate < -5 ? 'decreasing' : 'stable';
    
    const forecastedCost = currentMonthlyCost * (1 + (growthRate / 100) * 3); // 3 month projection
    
    return {
      serviceId: service.id,
      serviceName: service.name,
      provider: 'multi',
      forecastPeriod: '3_months',
      currentMonthlyCost,
      forecastedCost,
      trend,
      growthRate,
      confidence: 0.75,
      factors: [
        {
          name: 'Historical Trend',
          impact: Math.abs(growthRate),
          description: `Cost has been ${trend} at ${growthRate.toFixed(1)}% rate`
        }
      ],
      createdAt: new Date()
    };
  }

  // Public methods for accessing recommendations
  getRecommendations(serviceId?: string): OptimizationRecommendation[] {
    const recommendations = Array.from(this.recommendations.values());
    return serviceId ? 
      recommendations.filter(r => r.serviceId === serviceId) : 
      recommendations;
  }

  getRecommendationById(id: string): OptimizationRecommendation | undefined {
    return this.recommendations.get(id);
  }

  updateRecommendationStatus(id: string, status: OptimizationRecommendation['status']): void {
    const recommendation = this.recommendations.get(id);
    if (recommendation) {
      recommendation.status = status;
      this.recommendations.set(id, recommendation);
      
      logger.info('Recommendation status updated', {
        id,
        status,
        title: recommendation.title
      });
      
      this.emit('recommendation:updated', { id, status, recommendation });
    }
  }

  getForecasts(serviceId?: string): CostForecast[] {
    const forecasts = Array.from(this.forecasts.values());
    return serviceId ? 
      forecasts.filter(f => f.serviceId === serviceId) : 
      forecasts;
  }

  getTotalPotentialSavings(): number {
    return Array.from(this.recommendations.values())
      .filter(r => r.status === 'active')
      .reduce((total, r) => total + r.potentialSavings, 0);
  }

  // Helper methods (would integrate with actual cloud provider APIs)
  private async getServicesWithHistoricalData(): Promise<any[]> {
    // Mock data - in real implementation, this would query the database
    return [
      { id: 'service-1', name: 'API Service' },
      { id: 'service-2', name: 'Database Service' },
      { id: 'service-3', name: 'Frontend Service' }
    ];
  }

  private async analyzeResourceUtilization(serviceId: string): Promise<any> {
    // Mock implementation - would use actual monitoring data
    return {
      avgCpuUtilization: 25 + Math.random() * 20, // 25-45%
      avgMemoryUtilization: 30 + Math.random() * 20, // 30-50%
      monthlyCost: 100 + Math.random() * 200, // $100-300
      instanceType: 'm5.large',
      provider: 'aws',
      region: 'us-east-1'
    };
  }

  private getRecommendedInstanceSize(utilization: any): string {
    if (utilization.avgCpuUtilization < 20) return 'm5.medium';
    if (utilization.avgCpuUtilization < 30) return 'm5.large';
    return 'm5.xlarge';
  }

  private async detectIdleResources(serviceId: string): Promise<any[]> {
    // Mock implementation
    return [
      {
        resourceId: 'i-1234567890abcdef0',
        resourceType: 'EC2 Instance',
        idleDays: 14,
        monthlyCost: 75,
        provider: 'aws',
        region: 'us-east-1',
        hasSnapshots: true,
        lastActivity: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
      }
    ];
  }

  private async analyzeOnDemandUsage(serviceId: string): Promise<any> {
    return {
      consistentUsage: true,
      monthlyCost: 250,
      provider: 'aws',
      region: 'us-east-1',
      instanceTypes: ['m5.large'],
      averageHoursPerMonth: 720,
      riRecommendation: '1 year term, partial upfront'
    };
  }

  private async analyzeStorageUsage(serviceId: string): Promise<any> {
    return {
      volumes: [
        {
          volumeId: 'vol-1234567890abcdef0',
          sizeGB: 100,
          utilizationPercent: 35,
          monthlyCost: 40,
          provider: 'aws',
          region: 'us-east-1',
          storageType: 'gp2'
        }
      ]
    };
  }

  private async getHistoricalCosts(serviceId: string, days: number): Promise<number[]> {
    // Mock implementation - would query actual cost data
    const costs: number[] = [];
    const baseCost = 100;
    
    for (let i = 0; i < days; i++) {
      const dailyCost = baseCost + (Math.random() - 0.5) * 20 + (i / days) * 10;
      costs.push(Math.max(0, dailyCost));
    }
    
    return costs;
  }

  // Generate budget optimization recommendations
  generateBudgetOptimization(serviceId?: string): BudgetOptimization[] {
    const optimizations: BudgetOptimization[] = [];
    const forecasts = this.getForecasts(serviceId);
    
    for (const forecast of forecasts) {
      const historicalSpend = forecast.currentMonthlyCost;
      const projectedSpend = forecast.forecastedCost;
      const recommendedBudget = projectedSpend * 1.15; // 15% buffer
      
      const optimization: BudgetOptimization = {
        serviceId: forecast.serviceId,
        currentBudget: historicalSpend * 1.2, // Assume 20% buffer currently
        recommendedBudget,
        reasoning: `Based on ${forecast.trend} trend with ${forecast.growthRate.toFixed(1)}% growth rate`,
        basedOnData: {
          historicalSpend,
          growthProjection: forecast.growthRate,
          seasonalAdjustment: 1.0
        },
        riskAssessment: {
          overBudgetRisk: forecast.trend === 'increasing' ? 0.7 : 0.3,
          underUtilizationRisk: forecast.trend === 'decreasing' ? 0.6 : 0.2
        },
        createdAt: new Date()
      };
      
      optimizations.push(optimization);
    }
    
    return optimizations;
  }

  getStatus(): {
    isAnalyzing: boolean;
    totalRecommendations: number;
    activeRecommendations: number;
    totalPotentialSavings: number;
    lastAnalysis: Date | null;
  } {
    const recommendations = Array.from(this.recommendations.values());
    const activeRecommendations = recommendations.filter(r => r.status === 'active');
    
    return {
      isAnalyzing: this.isAnalyzing,
      totalRecommendations: recommendations.length,
      activeRecommendations: activeRecommendations.length,
      totalPotentialSavings: activeRecommendations.reduce((total, r) => total + r.potentialSavings, 0),
      lastAnalysis: recommendations.length > 0 ? 
        new Date(Math.max(...recommendations.map(r => r.createdAt.getTime()))) : null
    };
  }
}

// Singleton instance
let costOptimizationEngine: CostOptimizationEngine | null = null;

export function getCostOptimizationEngine(config?: OptimizationEngineConfig): CostOptimizationEngine {
  if (!costOptimizationEngine) {
    costOptimizationEngine = new CostOptimizationEngine(config);
  }
  return costOptimizationEngine;
}

export default CostOptimizationEngine;