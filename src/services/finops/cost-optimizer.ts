import { EventEmitter } from 'events';
import * as tf from '@tensorflow/tfjs';
import { prisma } from '@/lib/prisma';

interface CloudCost {
  provider: 'aws' | 'gcp' | 'azure' | 'kubernetes';
  service: string;
  resourceType: string;
  resourceId: string;
  resourceName: string;
  tags: Map<string, string>;
  region: string;
  usage: {
    quantity: number;
    unit: string;
    period: Date;
  };
  cost: {
    amount: number;
    currency: string;
    breakdown: {
      compute?: number;
      storage?: number;
      network?: number;
      other?: number;
    };
  };
  allocation: {
    team?: string;
    project?: string;
    environment?: string;
    application?: string;
    costCenter?: string;
  };
}

interface CostAnomaly {
  id: string;
  resourceId: string;
  type: 'spike' | 'trend' | 'waste' | 'unusual';
  severity: 'critical' | 'high' | 'medium' | 'low';
  detectedAt: Date;
  description: string;
  impact: {
    currentCost: number;
    expectedCost: number;
    difference: number;
    percentageIncrease: number;
  };
  recommendation: string;
  autoRemediation?: {
    available: boolean;
    actions: string[];
    estimatedSavings: number;
  };
}

interface OptimizationRecommendation {
  id: string;
  category: 'rightsizing' | 'reserved' | 'spot' | 'scheduling' | 'architecture' | 'cleanup';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affectedResources: string[];
  currentCost: number;
  optimizedCost: number;
  savings: {
    monthly: number;
    annual: number;
    percentage: number;
  };
  implementation: {
    effort: 'low' | 'medium' | 'high';
    risk: 'low' | 'medium' | 'high';
    steps: string[];
    automationAvailable: boolean;
    script?: string;
  };
  confidence: number;
}

interface Budget {
  id: string;
  name: string;
  scope: {
    teams?: string[];
    projects?: string[];
    services?: string[];
    tags?: Map<string, string>;
  };
  amount: number;
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
  alerts: {
    thresholds: number[];
    recipients: string[];
    channels: ('email' | 'slack' | 'pagerduty')[];
  };
  currentSpend: number;
  forecast: number;
  status: 'under' | 'approaching' | 'over';
}

export class CostOptimizer extends EventEmitter {
  private model: tf.LayersModel | null = null;
  private costs: Map<string, CloudCost[]> = new Map();
  private anomalies: Map<string, CostAnomaly> = new Map();
  private recommendations: Map<string, OptimizationRecommendation> = new Map();
  private budgets: Map<string, Budget> = new Map();
  private savingsTracker: Map<string, number> = new Map();

  constructor() {
    super();
    this.loadModel();
    this.startCostCollection();
  }

  private async loadModel() {
    try {
      this.model = await tf.loadLayersModel('/models/cost-prediction/model.json');
    } catch (error) {
      this.model = this.createModel();
    }
  }

  private createModel(): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        tf.layers.lstm({ units: 128, returnSequences: true, inputShape: [30, 10] }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.lstm({ units: 64, returnSequences: false }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 1 })
      ]
    });

    model.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError',
      metrics: ['mae']
    });

    return model;
  }

  private async startCostCollection() {
    setInterval(() => this.collectCosts(), 3600000);
    setInterval(() => this.detectAnomalies(), 900000);
    setInterval(() => this.generateOptimizations(), 3600000);
    setInterval(() => this.checkBudgets(), 300000);
  }

  private async collectCosts() {
    const providers = ['aws', 'gcp', 'azure', 'kubernetes'];
    
    for (const provider of providers) {
      const costs = await this.fetchProviderCosts(provider as any);
      this.costs.set(provider, costs);
      
      await this.processCosts(costs);
    }

    this.emit('costs-collected', {
      providers: providers.length,
      totalResources: Array.from(this.costs.values()).flat().length
    });
  }

  private async fetchProviderCosts(provider: string): Promise<CloudCost[]> {
    const mockCosts: CloudCost[] = [];
    const services = this.getProviderServices(provider);
    
    for (const service of services) {
      const resourceCount = Math.floor(Math.random() * 10) + 1;
      
      for (let i = 0; i < resourceCount; i++) {
        mockCosts.push({
          provider: provider as any,
          service,
          resourceType: this.getResourceType(service),
          resourceId: `${provider}-${service}-${i}`,
          resourceName: `${service}-resource-${i}`,
          tags: new Map([
            ['team', `team-${Math.floor(Math.random() * 5)}`],
            ['env', ['dev', 'staging', 'prod'][Math.floor(Math.random() * 3)]],
            ['project', `project-${Math.floor(Math.random() * 10)}`]
          ]),
          region: this.getRegion(provider),
          usage: {
            quantity: Math.random() * 1000,
            unit: 'hours',
            period: new Date()
          },
          cost: {
            amount: Math.random() * 1000,
            currency: 'USD',
            breakdown: {
              compute: Math.random() * 400,
              storage: Math.random() * 200,
              network: Math.random() * 200,
              other: Math.random() * 200
            }
          },
          allocation: {
            team: `team-${Math.floor(Math.random() * 5)}`,
            project: `project-${Math.floor(Math.random() * 10)}`,
            environment: ['dev', 'staging', 'prod'][Math.floor(Math.random() * 3)],
            application: `app-${Math.floor(Math.random() * 20)}`,
            costCenter: `cc-${Math.floor(Math.random() * 5)}`
          }
        });
      }
    }
    
    return mockCosts;
  }

  private getProviderServices(provider: string): string[] {
    const services: Record<string, string[]> = {
      aws: ['EC2', 'S3', 'RDS', 'Lambda', 'EKS', 'DynamoDB', 'CloudFront'],
      gcp: ['Compute Engine', 'Cloud Storage', 'Cloud SQL', 'Cloud Functions', 'GKE'],
      azure: ['Virtual Machines', 'Storage', 'SQL Database', 'Functions', 'AKS'],
      kubernetes: ['Nodes', 'Pods', 'PersistentVolumes', 'LoadBalancers']
    };
    
    return services[provider] || [];
  }

  private getResourceType(service: string): string {
    const types: Record<string, string> = {
      'EC2': 'instance',
      'S3': 'bucket',
      'RDS': 'database',
      'Lambda': 'function',
      'Compute Engine': 'instance',
      'Virtual Machines': 'vm'
    };
    
    return types[service] || 'resource';
  }

  private getRegion(provider: string): string {
    const regions: Record<string, string[]> = {
      aws: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'],
      gcp: ['us-central1', 'us-west1', 'europe-west1', 'asia-east1'],
      azure: ['eastus', 'westus', 'northeurope', 'southeastasia'],
      kubernetes: ['default', 'production', 'staging']
    };
    
    const providerRegions = regions[provider] || ['default'];
    return providerRegions[Math.floor(Math.random() * providerRegions.length)];
  }

  private async processCosts(costs: CloudCost[]) {
    for (const cost of costs) {
      await this.analyzeCostTrends(cost);
      await this.identifyWaste(cost);
      await this.checkTagCompliance(cost);
    }
  }

  private async analyzeCostTrends(cost: CloudCost) {
    const history = await this.getCostHistory(cost.resourceId);
    
    if (history.length < 7) return;
    
    const trend = this.calculateTrend(history.map(h => h.amount));
    const forecast = await this.forecastCost(cost, history);
    
    if (trend.slope > 0.2 && trend.confidence > 0.8) {
      this.createAnomaly({
        id: `anomaly-${Date.now()}-${cost.resourceId}`,
        resourceId: cost.resourceId,
        type: 'trend',
        severity: trend.slope > 0.5 ? 'high' : 'medium',
        detectedAt: new Date(),
        description: `Cost increasing at ${(trend.slope * 100).toFixed(1)}% per day`,
        impact: {
          currentCost: cost.cost.amount,
          expectedCost: history[history.length - 1].amount,
          difference: cost.cost.amount - history[history.length - 1].amount,
          percentageIncrease: trend.slope * 100
        },
        recommendation: 'Review resource utilization and consider rightsizing'
      });
    }
  }

  private async getCostHistory(resourceId: string): Promise<any[]> {
    const history = await prisma.costHistory.findMany({
      where: { resourceId },
      orderBy: { date: 'desc' },
      take: 30
    });
    
    return history.length > 0 ? history : this.generateMockHistory(resourceId);
  }

  private generateMockHistory(resourceId: string): any[] {
    const history = [];
    const baseAmount = 100 + Math.random() * 500;
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      history.push({
        resourceId,
        date,
        amount: baseAmount * (1 + (Math.random() - 0.3) * 0.2)
      });
    }
    
    return history;
  }

  private calculateTrend(values: number[]): { slope: number; confidence: number } {
    if (values.length < 2) {
      return { slope: 0, confidence: 0 };
    }

    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    const yMean = sumY / n;
    const ssTotal = values.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
    const ssResidual = values.reduce((sum, y, x) => {
      const yPred = slope * x + (sumY - slope * sumX) / n;
      return sum + Math.pow(y - yPred, 2);
    }, 0);
    
    const r2 = 1 - (ssResidual / ssTotal);

    return {
      slope: slope / (sumY / n),
      confidence: Math.max(0, Math.min(1, r2))
    };
  }

  private async forecastCost(cost: CloudCost, history: any[]): Promise<number> {
    if (!this.model || history.length < 30) {
      return cost.cost.amount;
    }

    const features = this.prepareForecastFeatures(cost, history);
    const prediction = this.model.predict(tf.tensor3d([features])) as tf.Tensor;
    const forecastValue = (await prediction.array())[0][0];
    
    prediction.dispose();
    return forecastValue;
  }

  private prepareForecastFeatures(cost: CloudCost, history: any[]): number[][] {
    const features = history.slice(-30).map(h => [
      h.amount,
      cost.usage.quantity,
      cost.allocation.environment === 'prod' ? 1 : 0,
      new Date(h.date).getDay(),
      new Date(h.date).getDate(),
      new Date(h.date).getMonth(),
      Math.sin(2 * Math.PI * new Date(h.date).getDay() / 7),
      Math.cos(2 * Math.PI * new Date(h.date).getDay() / 7),
      Math.sin(2 * Math.PI * new Date(h.date).getDate() / 30),
      Math.cos(2 * Math.PI * new Date(h.date).getDate() / 30)
    ]);
    
    return features;
  }

  private async identifyWaste(cost: CloudCost) {
    const utilization = await this.getResourceUtilization(cost.resourceId);
    
    if (utilization < 10) {
      this.createAnomaly({
        id: `waste-${Date.now()}-${cost.resourceId}`,
        resourceId: cost.resourceId,
        type: 'waste',
        severity: cost.cost.amount > 500 ? 'high' : 'medium',
        detectedAt: new Date(),
        description: `Resource utilization at ${utilization.toFixed(1)}%`,
        impact: {
          currentCost: cost.cost.amount,
          expectedCost: 0,
          difference: cost.cost.amount,
          percentageIncrease: 0
        },
        recommendation: 'Consider terminating or rightsizing this underutilized resource',
        autoRemediation: {
          available: true,
          actions: ['Terminate resource', 'Downsize instance', 'Convert to serverless'],
          estimatedSavings: cost.cost.amount * 0.8
        }
      });
    }
  }

  private async getResourceUtilization(resourceId: string): Promise<number> {
    const metrics = await prisma.resourceMetrics.findFirst({
      where: { resourceId },
      orderBy: { timestamp: 'desc' }
    });
    
    return metrics?.utilization || Math.random() * 100;
  }

  private async checkTagCompliance(cost: CloudCost) {
    const requiredTags = ['team', 'project', 'environment', 'cost-center'];
    const missingTags = requiredTags.filter(tag => !cost.tags.has(tag));
    
    if (missingTags.length > 0) {
      await prisma.tagCompliance.create({
        data: {
          resourceId: cost.resourceId,
          missingTags,
          cost: cost.cost.amount,
          reportedAt: new Date()
        }
      });
    }
  }

  private createAnomaly(anomaly: CostAnomaly) {
    this.anomalies.set(anomaly.id, anomaly);
    this.emit('anomaly-detected', anomaly);
  }

  private async detectAnomalies() {
    const allCosts = Array.from(this.costs.values()).flat();
    
    for (const cost of allCosts) {
      await this.detectSpikes(cost);
      await this.detectUnusualPatterns(cost);
    }
  }

  private async detectSpikes(cost: CloudCost) {
    const history = await this.getCostHistory(cost.resourceId);
    if (history.length < 3) return;
    
    const recentAvg = history.slice(0, 3).reduce((sum, h) => sum + h.amount, 0) / 3;
    const historicalAvg = history.slice(3, 10).reduce((sum, h) => sum + h.amount, 0) / Math.min(7, history.length - 3);
    
    if (recentAvg > historicalAvg * 1.5) {
      this.createAnomaly({
        id: `spike-${Date.now()}-${cost.resourceId}`,
        resourceId: cost.resourceId,
        type: 'spike',
        severity: recentAvg > historicalAvg * 2 ? 'critical' : 'high',
        detectedAt: new Date(),
        description: `Cost spike detected: ${((recentAvg / historicalAvg - 1) * 100).toFixed(1)}% increase`,
        impact: {
          currentCost: recentAvg,
          expectedCost: historicalAvg,
          difference: recentAvg - historicalAvg,
          percentageIncrease: (recentAvg / historicalAvg - 1) * 100
        },
        recommendation: 'Investigate recent changes and usage patterns'
      });
    }
  }

  private async detectUnusualPatterns(cost: CloudCost) {
    const similar = await this.findSimilarResources(cost);
    if (similar.length < 3) return;
    
    const avgCost = similar.reduce((sum, r) => sum + r.cost.amount, 0) / similar.length;
    const stdDev = Math.sqrt(
      similar.reduce((sum, r) => sum + Math.pow(r.cost.amount - avgCost, 2), 0) / similar.length
    );
    
    if (Math.abs(cost.cost.amount - avgCost) > 2 * stdDev) {
      this.createAnomaly({
        id: `unusual-${Date.now()}-${cost.resourceId}`,
        resourceId: cost.resourceId,
        type: 'unusual',
        severity: 'medium',
        detectedAt: new Date(),
        description: 'Cost significantly different from similar resources',
        impact: {
          currentCost: cost.cost.amount,
          expectedCost: avgCost,
          difference: cost.cost.amount - avgCost,
          percentageIncrease: ((cost.cost.amount - avgCost) / avgCost) * 100
        },
        recommendation: 'Compare configuration with similar resources'
      });
    }
  }

  private async findSimilarResources(cost: CloudCost): Promise<CloudCost[]> {
    const allCosts = Array.from(this.costs.values()).flat();
    
    return allCosts.filter(c =>
      c.resourceId !== cost.resourceId &&
      c.service === cost.service &&
      c.resourceType === cost.resourceType &&
      c.allocation.environment === cost.allocation.environment
    );
  }

  private async generateOptimizations() {
    const allCosts = Array.from(this.costs.values()).flat();
    
    await this.generateRightsizingRecommendations(allCosts);
    await this.generateReservedInstanceRecommendations(allCosts);
    await this.generateSpotInstanceRecommendations(allCosts);
    await this.generateSchedulingRecommendations(allCosts);
    await this.generateArchitectureRecommendations(allCosts);
    await this.generateCleanupRecommendations(allCosts);
    
    this.emit('optimizations-generated', {
      count: this.recommendations.size,
      totalSavings: Array.from(this.recommendations.values())
        .reduce((sum, r) => sum + r.savings.monthly, 0)
    });
  }

  private async generateRightsizingRecommendations(costs: CloudCost[]) {
    const instances = costs.filter(c => 
      c.resourceType === 'instance' || c.resourceType === 'vm'
    );
    
    for (const instance of instances) {
      const utilization = await this.getResourceUtilization(instance.resourceId);
      
      if (utilization < 30) {
        const recommendation: OptimizationRecommendation = {
          id: `rightsize-${instance.resourceId}`,
          category: 'rightsizing',
          priority: instance.cost.amount > 500 ? 'high' : 'medium',
          title: `Rightsize ${instance.resourceName}`,
          description: `Instance is only ${utilization.toFixed(1)}% utilized`,
          affectedResources: [instance.resourceId],
          currentCost: instance.cost.amount,
          optimizedCost: instance.cost.amount * 0.5,
          savings: {
            monthly: instance.cost.amount * 0.5,
            annual: instance.cost.amount * 0.5 * 12,
            percentage: 50
          },
          implementation: {
            effort: 'low',
            risk: 'low',
            steps: [
              'Review instance metrics',
              'Select appropriate smaller instance type',
              'Schedule maintenance window',
              'Resize instance',
              'Monitor performance'
            ],
            automationAvailable: true,
            script: this.generateRightsizingScript(instance)
          },
          confidence: 0.85
        };
        
        this.recommendations.set(recommendation.id, recommendation);
      }
    }
  }

  private generateRightsizingScript(instance: CloudCost): string {
    return `
#!/bin/bash
# Rightsize ${instance.resourceName}

INSTANCE_ID="${instance.resourceId}"
NEW_TYPE="t3.medium"  # Recommended based on utilization

# Stop instance
aws ec2 stop-instances --instance-ids $INSTANCE_ID
aws ec2 wait instance-stopped --instance-ids $INSTANCE_ID

# Modify instance type
aws ec2 modify-instance-attribute --instance-id $INSTANCE_ID --instance-type $NEW_TYPE

# Start instance
aws ec2 start-instances --instance-ids $INSTANCE_ID
aws ec2 wait instance-running --instance-ids $INSTANCE_ID

echo "Instance $INSTANCE_ID resized to $NEW_TYPE"
    `.trim();
  }

  private async generateReservedInstanceRecommendations(costs: CloudCost[]) {
    const instances = costs.filter(c =>
      (c.resourceType === 'instance' || c.resourceType === 'vm') &&
      c.allocation.environment === 'prod'
    );
    
    const instanceFamilies = new Map<string, CloudCost[]>();
    
    for (const instance of instances) {
      const family = instance.service;
      if (!instanceFamilies.has(family)) {
        instanceFamilies.set(family, []);
      }
      instanceFamilies.get(family)!.push(instance);
    }
    
    for (const [family, familyInstances] of instanceFamilies) {
      if (familyInstances.length >= 3) {
        const totalCost = familyInstances.reduce((sum, i) => sum + i.cost.amount, 0);
        const recommendation: OptimizationRecommendation = {
          id: `reserved-${family}`,
          category: 'reserved',
          priority: 'high',
          title: `Purchase Reserved Instances for ${family}`,
          description: `Save on ${familyInstances.length} production instances`,
          affectedResources: familyInstances.map(i => i.resourceId),
          currentCost: totalCost,
          optimizedCost: totalCost * 0.7,
          savings: {
            monthly: totalCost * 0.3,
            annual: totalCost * 0.3 * 12,
            percentage: 30
          },
          implementation: {
            effort: 'low',
            risk: 'low',
            steps: [
              'Analyze usage patterns',
              'Calculate optimal RI coverage',
              'Purchase Reserved Instances',
              'Apply RIs to instances',
              'Monitor utilization'
            ],
            automationAvailable: false
          },
          confidence: 0.9
        };
        
        this.recommendations.set(recommendation.id, recommendation);
      }
    }
  }

  private async generateSpotInstanceRecommendations(costs: CloudCost[]) {
    const instances = costs.filter(c =>
      (c.resourceType === 'instance' || c.resourceType === 'vm') &&
      c.allocation.environment !== 'prod'
    );
    
    for (const instance of instances) {
      if (instance.cost.amount > 100) {
        const recommendation: OptimizationRecommendation = {
          id: `spot-${instance.resourceId}`,
          category: 'spot',
          priority: 'medium',
          title: `Use Spot Instances for ${instance.resourceName}`,
          description: 'Non-production workload suitable for Spot',
          affectedResources: [instance.resourceId],
          currentCost: instance.cost.amount,
          optimizedCost: instance.cost.amount * 0.3,
          savings: {
            monthly: instance.cost.amount * 0.7,
            annual: instance.cost.amount * 0.7 * 12,
            percentage: 70
          },
          implementation: {
            effort: 'medium',
            risk: 'medium',
            steps: [
              'Verify workload is interruption-tolerant',
              'Configure Spot Fleet request',
              'Set up instance recovery',
              'Migrate workload',
              'Monitor interruptions'
            ],
            automationAvailable: true
          },
          confidence: 0.75
        };
        
        this.recommendations.set(recommendation.id, recommendation);
      }
    }
  }

  private async generateSchedulingRecommendations(costs: CloudCost[]) {
    const nonProdInstances = costs.filter(c =>
      (c.resourceType === 'instance' || c.resourceType === 'vm') &&
      c.allocation.environment !== 'prod'
    );
    
    const totalNonProdCost = nonProdInstances.reduce((sum, i) => sum + i.cost.amount, 0);
    
    if (nonProdInstances.length > 0) {
      const recommendation: OptimizationRecommendation = {
        id: 'scheduling-nonprod',
        category: 'scheduling',
        priority: 'medium',
        title: 'Schedule Non-Production Resources',
        description: 'Stop dev/test resources outside business hours',
        affectedResources: nonProdInstances.map(i => i.resourceId),
        currentCost: totalNonProdCost,
        optimizedCost: totalNonProdCost * 0.6,
        savings: {
          monthly: totalNonProdCost * 0.4,
          annual: totalNonProdCost * 0.4 * 12,
          percentage: 40
        },
        implementation: {
          effort: 'low',
          risk: 'low',
          steps: [
            'Define scheduling policy',
            'Tag resources for scheduling',
            'Configure automation',
            'Test schedule',
            'Monitor compliance'
          ],
          automationAvailable: true,
          script: this.generateSchedulingScript()
        },
        confidence: 0.95
      };
      
      this.recommendations.set(recommendation.id, recommendation);
    }
  }

  private generateSchedulingScript(): string {
    return `
#!/bin/bash
# Resource Scheduling Script

# Stop instances at 8 PM
0 20 * * 1-5 aws ec2 stop-instances --instance-ids \\
  $(aws ec2 describe-instances \\
    --filters "Name=tag:Schedule,Values=business-hours" \\
    --query "Reservations[].Instances[].InstanceId" \\
    --output text)

# Start instances at 7 AM
0 7 * * 1-5 aws ec2 start-instances --instance-ids \\
  $(aws ec2 describe-instances \\
    --filters "Name=tag:Schedule,Values=business-hours" \\
    --query "Reservations[].Instances[].InstanceId" \\
    --output text)
    `.trim();
  }

  private async generateArchitectureRecommendations(costs: CloudCost[]) {
    const databases = costs.filter(c => c.resourceType === 'database');
    
    for (const db of databases) {
      if (db.cost.amount > 1000) {
        const recommendation: OptimizationRecommendation = {
          id: `arch-${db.resourceId}`,
          category: 'architecture',
          priority: 'medium',
          title: `Optimize ${db.resourceName} Architecture`,
          description: 'Consider serverless or managed alternatives',
          affectedResources: [db.resourceId],
          currentCost: db.cost.amount,
          optimizedCost: db.cost.amount * 0.6,
          savings: {
            monthly: db.cost.amount * 0.4,
            annual: db.cost.amount * 0.4 * 12,
            percentage: 40
          },
          implementation: {
            effort: 'high',
            risk: 'medium',
            steps: [
              'Analyze database usage patterns',
              'Evaluate serverless options',
              'Plan migration strategy',
              'Test with non-production',
              'Migrate production'
            ],
            automationAvailable: false
          },
          confidence: 0.7
        };
        
        this.recommendations.set(recommendation.id, recommendation);
      }
    }
  }

  private async generateCleanupRecommendations(costs: CloudCost[]) {
    const unusedResources = [];
    
    for (const cost of costs) {
      const utilization = await this.getResourceUtilization(cost.resourceId);
      if (utilization === 0) {
        unusedResources.push(cost);
      }
    }
    
    if (unusedResources.length > 0) {
      const totalCost = unusedResources.reduce((sum, r) => sum + r.cost.amount, 0);
      
      const recommendation: OptimizationRecommendation = {
        id: 'cleanup-unused',
        category: 'cleanup',
        priority: 'high',
        title: 'Remove Unused Resources',
        description: `${unusedResources.length} resources with zero utilization`,
        affectedResources: unusedResources.map(r => r.resourceId),
        currentCost: totalCost,
        optimizedCost: 0,
        savings: {
          monthly: totalCost,
          annual: totalCost * 12,
          percentage: 100
        },
        implementation: {
          effort: 'low',
          risk: 'low',
          steps: [
            'Verify resources are truly unused',
            'Check for dependencies',
            'Create backups if needed',
            'Delete resources',
            'Verify billing reduction'
          ],
          automationAvailable: true
        },
        confidence: 0.9
      };
      
      this.recommendations.set(recommendation.id, recommendation);
    }
  }

  private async checkBudgets() {
    for (const [id, budget] of this.budgets) {
      const currentSpend = await this.calculateBudgetSpend(budget);
      const forecast = await this.forecastBudgetSpend(budget);
      
      budget.currentSpend = currentSpend;
      budget.forecast = forecast;
      
      const percentage = (currentSpend / budget.amount) * 100;
      
      if (percentage >= 100) {
        budget.status = 'over';
        this.sendBudgetAlert(budget, 'exceeded');
      } else if (percentage >= 80) {
        budget.status = 'approaching';
        this.sendBudgetAlert(budget, 'approaching');
      } else {
        budget.status = 'under';
      }
      
      await this.persistBudgetStatus(budget);
    }
  }

  private async calculateBudgetSpend(budget: Budget): Promise<number> {
    const costs = Array.from(this.costs.values()).flat();
    let spend = 0;
    
    for (const cost of costs) {
      if (this.matchesBudgetScope(cost, budget)) {
        spend += cost.cost.amount;
      }
    }
    
    return spend;
  }

  private matchesBudgetScope(cost: CloudCost, budget: Budget): boolean {
    if (budget.scope.teams && !budget.scope.teams.includes(cost.allocation.team || '')) {
      return false;
    }
    if (budget.scope.projects && !budget.scope.projects.includes(cost.allocation.project || '')) {
      return false;
    }
    if (budget.scope.services && !budget.scope.services.includes(cost.service)) {
      return false;
    }
    
    return true;
  }

  private async forecastBudgetSpend(budget: Budget): Promise<number> {
    const history = await this.getBudgetHistory(budget.id);
    
    if (!this.model || history.length < 7) {
      return budget.currentSpend * 1.1;
    }
    
    const features = history.map((h, i) => [
      h.amount,
      i,
      Math.sin(2 * Math.PI * i / 7),
      Math.cos(2 * Math.PI * i / 7),
      Math.sin(2 * Math.PI * i / 30),
      Math.cos(2 * Math.PI * i / 30),
      budget.currentSpend,
      budget.amount,
      0,
      0
    ]);
    
    const paddedFeatures = [...features];
    while (paddedFeatures.length < 30) {
      paddedFeatures.unshift(features[0]);
    }
    
    const prediction = this.model.predict(tf.tensor3d([paddedFeatures.slice(-30)])) as tf.Tensor;
    const forecast = (await prediction.array())[0][0];
    
    prediction.dispose();
    return forecast;
  }

  private async getBudgetHistory(budgetId: string): Promise<any[]> {
    const history = await prisma.budgetHistory.findMany({
      where: { budgetId },
      orderBy: { date: 'desc' },
      take: 30
    });
    
    return history.length > 0 ? history : this.generateMockBudgetHistory(budgetId);
  }

  private generateMockBudgetHistory(budgetId: string): any[] {
    const history = [];
    const baseAmount = 5000 + Math.random() * 10000;
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      history.push({
        budgetId,
        date,
        amount: baseAmount * (1 + (Math.random() - 0.5) * 0.3)
      });
    }
    
    return history;
  }

  private sendBudgetAlert(budget: Budget, type: 'approaching' | 'exceeded') {
    const message = type === 'exceeded'
      ? `Budget ${budget.name} has been exceeded: $${budget.currentSpend.toFixed(2)} / $${budget.amount}`
      : `Budget ${budget.name} is approaching limit: $${budget.currentSpend.toFixed(2)} / $${budget.amount}`;
    
    this.emit('budget-alert', {
      budget,
      type,
      message,
      percentage: (budget.currentSpend / budget.amount) * 100
    });
    
    for (const channel of budget.alerts.channels) {
      this.sendAlert(channel, budget.alerts.recipients, message);
    }
  }

  private sendAlert(channel: string, recipients: string[], message: string) {
    console.log(`Sending ${channel} alert to ${recipients.join(', ')}: ${message}`);
  }

  private async persistBudgetStatus(budget: Budget) {
    await prisma.budgetStatus.upsert({
      where: { budgetId: budget.id },
      update: {
        currentSpend: budget.currentSpend,
        forecast: budget.forecast,
        status: budget.status,
        updatedAt: new Date()
      },
      create: {
        budgetId: budget.id,
        currentSpend: budget.currentSpend,
        forecast: budget.forecast,
        status: budget.status
      }
    });
  }

  async implementOptimization(
    recommendationId: string
  ): Promise<{
    success: boolean;
    actualSavings?: number;
    error?: string;
  }> {
    const recommendation = this.recommendations.get(recommendationId);
    if (!recommendation) {
      return { success: false, error: 'Recommendation not found' };
    }

    try {
      let actualSavings = 0;
      
      switch (recommendation.category) {
        case 'rightsizing':
          actualSavings = await this.implementRightsizing(recommendation);
          break;
        case 'scheduling':
          actualSavings = await this.implementScheduling(recommendation);
          break;
        case 'cleanup':
          actualSavings = await this.implementCleanup(recommendation);
          break;
        default:
          return { success: false, error: 'Manual implementation required' };
      }
      
      this.savingsTracker.set(
        recommendationId,
        (this.savingsTracker.get(recommendationId) || 0) + actualSavings
      );
      
      await this.persistOptimization(recommendation, actualSavings);
      
      this.emit('optimization-implemented', {
        recommendationId,
        category: recommendation.category,
        actualSavings
      });
      
      return { success: true, actualSavings };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async implementRightsizing(recommendation: OptimizationRecommendation): Promise<number> {
    console.log('Implementing rightsizing:', recommendation.affectedResources);
    return recommendation.savings.monthly;
  }

  private async implementScheduling(recommendation: OptimizationRecommendation): Promise<number> {
    console.log('Implementing scheduling:', recommendation.affectedResources);
    return recommendation.savings.monthly;
  }

  private async implementCleanup(recommendation: OptimizationRecommendation): Promise<number> {
    console.log('Cleaning up resources:', recommendation.affectedResources);
    return recommendation.savings.monthly;
  }

  private async persistOptimization(
    recommendation: OptimizationRecommendation,
    actualSavings: number
  ) {
    await prisma.optimization.create({
      data: {
        recommendationId: recommendation.id,
        category: recommendation.category,
        implementedAt: new Date(),
        estimatedSavings: recommendation.savings.monthly,
        actualSavings,
        affectedResources: recommendation.affectedResources
      }
    });
  }

  async createBudget(budget: Omit<Budget, 'currentSpend' | 'forecast' | 'status'>): Promise<Budget> {
    const newBudget: Budget = {
      ...budget,
      currentSpend: 0,
      forecast: 0,
      status: 'under'
    };
    
    this.budgets.set(newBudget.id, newBudget);
    
    await prisma.budget.create({
      data: {
        id: newBudget.id,
        name: newBudget.name,
        amount: newBudget.amount,
        period: newBudget.period,
        scope: newBudget.scope,
        alerts: newBudget.alerts
      }
    });
    
    return newBudget;
  }

  async getOptimizationSummary(): Promise<{
    totalPotentialSavings: number;
    implementedSavings: number;
    recommendations: number;
    anomalies: number;
    topRecommendations: OptimizationRecommendation[];
  }> {
    const allRecommendations = Array.from(this.recommendations.values());
    const totalPotentialSavings = allRecommendations.reduce(
      (sum, r) => sum + r.savings.monthly,
      0
    );
    
    const implementedSavings = Array.from(this.savingsTracker.values()).reduce(
      (sum, s) => sum + s,
      0
    );
    
    const topRecommendations = allRecommendations
      .sort((a, b) => b.savings.monthly - a.savings.monthly)
      .slice(0, 5);
    
    return {
      totalPotentialSavings,
      implementedSavings,
      recommendations: this.recommendations.size,
      anomalies: this.anomalies.size,
      topRecommendations
    };
  }
}