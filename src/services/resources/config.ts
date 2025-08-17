/**
 * Configuration for Resource Management System
 */

import { CloudProvider, ResourceType } from './resource-manager';

/**
 * Default configuration for resource management
 */
export const defaultResourceConfig = {
  // Multi-cloud provider configuration
  providers: [
    {
      provider: CloudProvider.AWS,
      region: 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        sessionToken: process.env.AWS_SESSION_TOKEN
      },
      quotas: {
        cpu: 1000,
        memory: 4000,
        storage: 10000,
        networkBandwidth: 10000,
        iops: 100000,
        connections: 10000
      },
      tags: {
        environment: 'production',
        team: 'platform',
        costCenter: 'engineering'
      },
      pooling: {
        enabled: true,
        minInstances: 2,
        maxInstances: 20,
        warmupInstances: 3,
        cooldownPeriod: 300000,
        shareAcrossTeams: true
      }
    },
    {
      provider: CloudProvider.GCP,
      region: 'us-central1',
      zone: 'us-central1-a',
      credentials: {
        projectId: process.env.GCP_PROJECT_ID,
        keyFilename: process.env.GCP_KEY_FILE
      },
      quotas: {
        cpu: 500,
        memory: 2000,
        storage: 5000,
        networkBandwidth: 5000
      },
      tags: {
        environment: 'production',
        team: 'platform'
      },
      pooling: {
        enabled: true,
        minInstances: 1,
        maxInstances: 10,
        warmupInstances: 2,
        cooldownPeriod: 300000,
        shareAcrossTeams: false
      }
    },
    {
      provider: CloudProvider.AZURE,
      region: 'eastus',
      credentials: {
        subscriptionId: process.env.AZURE_SUBSCRIPTION_ID,
        credentials: {
          clientId: process.env.AZURE_CLIENT_ID,
          clientSecret: process.env.AZURE_CLIENT_SECRET,
          tenantId: process.env.AZURE_TENANT_ID
        }
      },
      quotas: {
        cpu: 300,
        memory: 1200,
        storage: 3000,
        networkBandwidth: 3000
      },
      tags: {
        environment: 'production'
      }
    },
    {
      provider: CloudProvider.KUBERNETES,
      region: 'default',
      quotas: {
        cpu: 200,
        memory: 800,
        storage: 2000,
        networkBandwidth: 2000
      },
      tags: {
        environment: 'production',
        orchestrator: 'k8s'
      },
      pooling: {
        enabled: true,
        minInstances: 3,
        maxInstances: 30,
        warmupInstances: 5,
        cooldownPeriod: 180000,
        shareAcrossTeams: true
      }
    }
  ],
  
  // Auto-scaling configuration
  autoScaling: {
    enabled: true,
    metricsInterval: 60000, // 1 minute
    predictionHorizon: 15, // 15 minutes
    cooldownPeriod: 300000, // 5 minutes
    policies: [
      {
        id: 'cpu-scaling',
        name: 'CPU-based Auto-scaling',
        resourceType: ResourceType.COMPUTE,
        triggers: [
          {
            metric: 'cpu',
            threshold: 80,
            duration: 300000,
            action: 'scale_out'
          },
          {
            metric: 'cpu',
            threshold: 20,
            duration: 600000,
            action: 'scale_in'
          }
        ],
        cooldownPeriod: 300000,
        minInstances: 2,
        maxInstances: 20,
        targetUtilization: 60,
        predictiveScaling: true,
        costOptimization: true
      },
      {
        id: 'memory-scaling',
        name: 'Memory-based Auto-scaling',
        resourceType: ResourceType.COMPUTE,
        triggers: [
          {
            metric: 'memory',
            threshold: 85,
            duration: 300000,
            action: 'scale_out'
          },
          {
            metric: 'memory',
            threshold: 30,
            duration: 600000,
            action: 'scale_in'
          }
        ],
        cooldownPeriod: 300000,
        minInstances: 2,
        maxInstances: 20,
        targetUtilization: 65,
        predictiveScaling: true,
        costOptimization: true
      },
      {
        id: 'request-scaling',
        name: 'Request Rate Auto-scaling',
        resourceType: ResourceType.COMPUTE,
        triggers: [
          {
            metric: 'requestRate',
            threshold: 1000,
            duration: 180000,
            action: 'scale_out'
          },
          {
            metric: 'requestRate',
            threshold: 100,
            duration: 600000,
            action: 'scale_in'
          }
        ],
        cooldownPeriod: 180000,
        minInstances: 2,
        maxInstances: 30,
        targetUtilization: 70,
        predictiveScaling: true,
        costOptimization: false
      },
      {
        id: 'latency-scaling',
        name: 'Latency-based Auto-scaling',
        resourceType: ResourceType.COMPUTE,
        triggers: [
          {
            metric: 'responseTime',
            threshold: 500,
            duration: 120000,
            action: 'scale_out'
          },
          {
            metric: 'errorRate',
            threshold: 5,
            duration: 60000,
            action: 'burst'
          }
        ],
        cooldownPeriod: 120000,
        minInstances: 3,
        maxInstances: 50,
        targetUtilization: 50,
        predictiveScaling: true,
        costOptimization: false
      }
    ],
    
    // Scheduled scaling rules
    scheduledRules: [
      {
        id: 'business-hours',
        name: 'Business Hours Scale-up',
        cron: '0 8 * * 1-5', // 8 AM Mon-Fri
        targetInstances: 10,
        resourceType: ResourceType.COMPUTE,
        provider: CloudProvider.AWS,
        enabled: true
      },
      {
        id: 'after-hours',
        name: 'After Hours Scale-down',
        cron: '0 20 * * 1-5', // 8 PM Mon-Fri
        targetInstances: 3,
        resourceType: ResourceType.COMPUTE,
        provider: CloudProvider.AWS,
        enabled: true
      },
      {
        id: 'weekend',
        name: 'Weekend Scale-down',
        cron: '0 0 * * 0', // Sunday midnight
        targetInstances: 2,
        resourceType: ResourceType.COMPUTE,
        provider: CloudProvider.AWS,
        enabled: true
      },
      {
        id: 'month-end',
        name: 'Month-end Processing',
        cron: '0 0 28 * *', // 28th of each month
        targetInstances: 20,
        resourceType: ResourceType.COMPUTE,
        enabled: true
      }
    ],
    
    // Burst handling configuration
    burst: {
      threshold: 90,
      duration: 60000,
      scaleMultiplier: 2,
      maxBurstInstances: 50,
      cooldownPeriod: 600000
    }
  },
  
  // Capacity planning configuration
  capacityPlanning: {
    enabled: true,
    forecastHorizon: 30, // 30 days
    seasonalityPeriods: [24, 168, 720, 8760], // hourly, weekly, monthly, yearly
    confidenceLevel: 0.95,
    
    // Buffer configuration
    buffers: {
      peak: {
        type: 'percentage',
        value: 20,
        justification: 'Handle unexpected traffic spikes',
        cost: 500
      },
      growth: {
        type: 'percentage',
        value: 15,
        justification: 'Account for business growth',
        cost: 300
      },
      failover: {
        type: 'fixed',
        value: 5,
        justification: 'Minimum failover capacity',
        cost: 200
      }
    },
    
    // Budget constraints
    budget: {
      monthly: 50000,
      quarterly: 140000,
      yearly: 500000,
      alertThresholds: [0.7, 0.9, 0.95],
      optimizationTargets: {
        compute: 0.4,
        storage: 0.2,
        database: 0.25,
        network: 0.15
      }
    },
    
    // Performance targets
    performanceTargets: {
      availability: 99.99,
      latency: 100,
      throughput: 10000,
      errorRate: 0.01
    },
    
    // Risk thresholds
    riskThresholds: {
      capacityUtilization: 85,
      costOverrun: 10,
      performanceDegradation: 20
    }
  },
  
  // ML model configuration
  mlModels: {
    path: process.env.ML_MODEL_PATH || './models',
    autoTrain: true,
    trainingSchedule: '0 2 * * *', // 2 AM daily
    minTrainingData: 1000,
    maxTrainingData: 100000,
    validationSplit: 0.2,
    epochs: 100,
    batchSize: 32
  },
  
  // Monitoring and alerting
  monitoring: {
    metricsInterval: 60000,
    alertChannels: ['email', 'slack', 'pagerduty'],
    alertRules: [
      {
        name: 'High CPU Usage',
        condition: 'cpu > 90',
        duration: 300000,
        severity: 'critical'
      },
      {
        name: 'Low Memory',
        condition: 'memory > 95',
        duration: 180000,
        severity: 'critical'
      },
      {
        name: 'High Error Rate',
        condition: 'errorRate > 5',
        duration: 60000,
        severity: 'high'
      },
      {
        name: 'Cost Overrun',
        condition: 'cost > budget * 1.1',
        duration: 3600000,
        severity: 'medium'
      }
    ]
  },
  
  // Redis configuration
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    retryStrategy: (times: number) => Math.min(times * 50, 2000),
    maxRetries: 10
  }
};

/**
 * Validate configuration
 */
export function validateConfig(config: any): boolean {
  // Check required fields
  if (!config.providers || config.providers.length === 0) {
    throw new Error('At least one provider must be configured');
  }
  
  // Validate provider configs
  for (const provider of config.providers) {
    if (!provider.provider || !provider.region) {
      throw new Error('Provider and region are required');
    }
    
    if (provider.quotas) {
      if (provider.quotas.cpu <= 0 || provider.quotas.memory <= 0) {
        throw new Error('CPU and memory quotas must be positive');
      }
    }
  }
  
  // Validate auto-scaling policies
  if (config.autoScaling?.enabled) {
    for (const policy of config.autoScaling.policies || []) {
      if (policy.minInstances >= policy.maxInstances) {
        throw new Error('Min instances must be less than max instances');
      }
      
      if (policy.targetUtilization < 0 || policy.targetUtilization > 100) {
        throw new Error('Target utilization must be between 0 and 100');
      }
    }
  }
  
  return true;
}

/**
 * Get environment-specific configuration
 */
export function getEnvironmentConfig(environment: string = 'production') {
  const config = { ...defaultResourceConfig };
  
  switch (environment) {
    case 'development':
      // Reduce resources for development
      config.providers = config.providers.map(p => ({
        ...p,
        quotas: p.quotas ? {
          ...p.quotas,
          cpu: Math.floor(p.quotas.cpu / 10),
          memory: Math.floor(p.quotas.memory / 10),
          storage: Math.floor(p.quotas.storage / 10)
        } : undefined
      }));
      
      // Disable some features
      config.capacityPlanning.enabled = false;
      config.autoScaling.policies = config.autoScaling.policies.slice(0, 1);
      break;
      
    case 'staging':
      // Use staging-specific settings
      config.providers = config.providers.map(p => ({
        ...p,
        tags: { ...p.tags, environment: 'staging' }
      }));
      
      // Reduce quotas
      config.providers = config.providers.map(p => ({
        ...p,
        quotas: p.quotas ? {
          ...p.quotas,
          cpu: Math.floor(p.quotas.cpu / 2),
          memory: Math.floor(p.quotas.memory / 2)
        } : undefined
      }));
      break;
      
    case 'production':
      // Use full production settings
      break;
      
    default:
      throw new Error(`Unknown environment: ${environment}`);
  }
  
  return config;
}