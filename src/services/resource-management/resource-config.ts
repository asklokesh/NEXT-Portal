/**
 * Resource Management Configuration
 * Centralized configuration for intelligent resource management and auto-scaling
 */

export interface ResourceConfig {
  orchestration: OrchestrationConfig;
  scaling: AutoScalingConfig;
  workload: WorkloadConfig;
  optimizer: OptimizerConfig;
  multiCloud: MultiCloudConfig;
  capacity: CapacityConfig;
  policies: PolicyConfig;
  monitoring: MonitoringConfig;
  ml: MLConfig;
}

export interface OrchestrationConfig {
  enabled: boolean;
  maxConcurrentDeployments: number;
  healthCheckInterval: number;
  resourceAllocationStrategy: 'cost-optimized' | 'performance-optimized' | 'balanced';
  defaultResourceLimits: {
    cpu: string;
    memory: string;
    storage: string;
    network: string;
  };
  nodeSelectors: Record<string, string>;
  tolerations: Array<{
    key: string;
    operator: string;
    value?: string;
    effect: string;
  }>;
}

export interface AutoScalingConfig {
  enabled: boolean;
  horizontalPodAutoscaler: {
    enabled: boolean;
    minReplicas: number;
    maxReplicas: number;
    targetCPUUtilization: number;
    targetMemoryUtilization: number;
    scaleUpStabilization: number;
    scaleDownStabilization: number;
  };
  verticalPodAutoscaler: {
    enabled: boolean;
    updateMode: 'Off' | 'Initial' | 'Auto';
    resourcePolicy: {
      minAllowed: Record<string, string>;
      maxAllowed: Record<string, string>;
    };
  };
  clusterAutoscaler: {
    enabled: boolean;
    scaleDownDelay: number;
    scaleDownUnneededTime: number;
    skipNodesWithLocalStorage: boolean;
    skipNodesWithSystemPods: boolean;
  };
  predictiveScaling: {
    enabled: boolean;
    lookAheadHours: number;
    confidenceThreshold: number;
    seasonalityDetection: boolean;
  };
  customMetrics: Array<{
    name: string;
    query: string;
    targetValue: number;
    scaleDirection: 'up' | 'down' | 'both';
  }>;
}

export interface WorkloadConfig {
  intelligentPlacement: {
    enabled: boolean;
    strategy: 'spread' | 'pack' | 'balanced';
    affinityRules: {
      preferredDuringSchedulingIgnoredDuringExecution: Array<{
        weight: number;
        podAffinityTerm: {
          labelSelector: Record<string, string>;
          topologyKey: string;
        };
      }>;
    };
  };
  resourceMatching: {
    enabled: boolean;
    cpuWeight: number;
    memoryWeight: number;
    networkWeight: number;
    storageWeight: number;
    costWeight: number;
    performanceWeight: number;
  };
  workloadTypes: {
    [key: string]: {
      resourceRequirements: {
        requests: Record<string, string>;
        limits: Record<string, string>;
      };
      priorityClass: string;
      nodeAffinity?: Record<string, any>;
    };
  };
}

export interface OptimizerConfig {
  performanceTuning: {
    enabled: boolean;
    autoTuning: boolean;
    optimizationInterval: number;
    metrics: string[];
    thresholds: Record<string, number>;
  };
  resourceRightSizing: {
    enabled: boolean;
    analysisWindow: number;
    utilizationThreshold: number;
    recommendationConfidence: number;
  };
  costOptimization: {
    enabled: boolean;
    spotInstancesPreference: number;
    reservedInstancesUtilization: number;
    unusedResourcesCleanup: boolean;
  };
}

export interface MultiCloudConfig {
  providers: {
    aws: {
      enabled: boolean;
      regions: string[];
      credentials: {
        accessKeyId?: string;
        secretAccessKey?: string;
        role?: string;
      };
      services: {
        eks: boolean;
        fargate: boolean;
        lambda: boolean;
        ec2: boolean;
      };
    };
    gcp: {
      enabled: boolean;
      regions: string[];
      projectId?: string;
      credentials?: string;
      services: {
        gke: boolean;
        cloudRun: boolean;
        cloudFunctions: boolean;
        computeEngine: boolean;
      };
    };
    azure: {
      enabled: boolean;
      regions: string[];
      credentials: {
        clientId?: string;
        clientSecret?: string;
        tenantId?: string;
      };
      services: {
        aks: boolean;
        containerInstances: boolean;
        functions: boolean;
        virtualMachines: boolean;
      };
    };
  };
  arbitrage: {
    enabled: boolean;
    costThreshold: number;
    latencyThreshold: number;
    availabilityThreshold: number;
  };
  failover: {
    enabled: boolean;
    autoFailover: boolean;
    healthCheckInterval: number;
    failoverThreshold: number;
  };
}

export interface CapacityConfig {
  planning: {
    enabled: boolean;
    forecastHorizon: number;
    seasonalAdjustment: boolean;
    growthRate: number;
    bufferPercentage: number;
  };
  thresholds: {
    cpu: {
      warning: number;
      critical: number;
    };
    memory: {
      warning: number;
      critical: number;
    };
    storage: {
      warning: number;
      critical: number;
    };
    network: {
      warning: number;
      critical: number;
    };
  };
  provisioning: {
    autoProvisioning: boolean;
    leadTime: number;
    approvalRequired: boolean;
  };
}

export interface PolicyConfig {
  governance: {
    resourceQuotas: {
      enabled: boolean;
      quotas: Record<string, Record<string, string>>;
    };
    limitRanges: {
      enabled: boolean;
      ranges: Array<{
        type: string;
        min: Record<string, string>;
        max: Record<string, string>;
        default: Record<string, string>;
        defaultRequest: Record<string, string>;
      }>;
    };
    networkPolicies: {
      enabled: boolean;
      defaultDeny: boolean;
      allowedNamespaces: string[];
    };
    podSecurityPolicies: {
      enabled: boolean;
      runAsNonRoot: boolean;
      allowedCapabilities: string[];
      forbiddenSysctls: string[];
    };
  };
  compliance: {
    enabled: boolean;
    frameworks: string[];
    auditLogging: boolean;
    dataResidency: {
      enabled: boolean;
      allowedRegions: string[];
    };
  };
}

export interface MonitoringConfig {
  metrics: {
    collection: {
      interval: number;
      retention: number;
      aggregation: 'avg' | 'sum' | 'max' | 'min';
    };
    exporters: Array<{
      type: 'prometheus' | 'grafana' | 'datadog' | 'newrelic';
      endpoint: string;
      credentials?: Record<string, string>;
    }>;
    customMetrics: Array<{
      name: string;
      description: string;
      query: string;
      labels: string[];
    }>;
  };
  alerting: {
    enabled: boolean;
    channels: Array<{
      type: 'slack' | 'email' | 'webhook' | 'pagerduty';
      config: Record<string, any>;
    }>;
    rules: Array<{
      name: string;
      condition: string;
      threshold: number;
      duration: number;
      severity: 'info' | 'warning' | 'critical';
    }>;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    structured: boolean;
    retention: number;
    sampling: boolean;
  };
}

export interface MLConfig {
  models: {
    workloadPrediction: {
      enabled: boolean;
      algorithm: 'arima' | 'lstm' | 'prophet' | 'linear_regression';
      retrainInterval: number;
      features: string[];
      hyperparameters: Record<string, any>;
    };
    resourceOptimization: {
      enabled: boolean;
      algorithm: 'reinforcement_learning' | 'genetic_algorithm' | 'gradient_descent';
      retrainInterval: number;
      features: string[];
      hyperparameters: Record<string, any>;
    };
    anomalyDetection: {
      enabled: boolean;
      algorithm: 'isolation_forest' | 'one_class_svm' | 'autoencoder';
      sensitivityLevel: number;
      features: string[];
      hyperparameters: Record<string, any>;
    };
  };
  training: {
    dataRetention: number;
    batchSize: number;
    validationSplit: number;
    earlyStoppingPatience: number;
  };
  inference: {
    batchPrediction: boolean;
    predictionCache: boolean;
    confidenceThreshold: number;
  };
}

// Default configuration
export const defaultResourceConfig: ResourceConfig = {
  orchestration: {
    enabled: true,
    maxConcurrentDeployments: 10,
    healthCheckInterval: 30000,
    resourceAllocationStrategy: 'balanced',
    defaultResourceLimits: {
      cpu: '1000m',
      memory: '2Gi',
      storage: '10Gi',
      network: '100Mbps'
    },
    nodeSelectors: {},
    tolerations: []
  },
  scaling: {
    enabled: true,
    horizontalPodAutoscaler: {
      enabled: true,
      minReplicas: 1,
      maxReplicas: 10,
      targetCPUUtilization: 70,
      targetMemoryUtilization: 80,
      scaleUpStabilization: 60,
      scaleDownStabilization: 300
    },
    verticalPodAutoscaler: {
      enabled: true,
      updateMode: 'Auto',
      resourcePolicy: {
        minAllowed: { cpu: '100m', memory: '128Mi' },
        maxAllowed: { cpu: '4000m', memory: '8Gi' }
      }
    },
    clusterAutoscaler: {
      enabled: true,
      scaleDownDelay: 600,
      scaleDownUnneededTime: 600,
      skipNodesWithLocalStorage: true,
      skipNodesWithSystemPods: true
    },
    predictiveScaling: {
      enabled: true,
      lookAheadHours: 24,
      confidenceThreshold: 0.8,
      seasonalityDetection: true
    },
    customMetrics: []
  },
  workload: {
    intelligentPlacement: {
      enabled: true,
      strategy: 'balanced',
      affinityRules: {
        preferredDuringSchedulingIgnoredDuringExecution: []
      }
    },
    resourceMatching: {
      enabled: true,
      cpuWeight: 0.3,
      memoryWeight: 0.3,
      networkWeight: 0.1,
      storageWeight: 0.1,
      costWeight: 0.1,
      performanceWeight: 0.1
    },
    workloadTypes: {
      'web': {
        resourceRequirements: {
          requests: { cpu: '250m', memory: '512Mi' },
          limits: { cpu: '1000m', memory: '2Gi' }
        },
        priorityClass: 'high'
      },
      'worker': {
        resourceRequirements: {
          requests: { cpu: '500m', memory: '1Gi' },
          limits: { cpu: '2000m', memory: '4Gi' }
        },
        priorityClass: 'medium'
      },
      'batch': {
        resourceRequirements: {
          requests: { cpu: '1000m', memory: '2Gi' },
          limits: { cpu: '4000m', memory: '8Gi' }
        },
        priorityClass: 'low'
      }
    }
  },
  optimizer: {
    performanceTuning: {
      enabled: true,
      autoTuning: false,
      optimizationInterval: 3600000,
      metrics: ['cpu', 'memory', 'latency', 'throughput'],
      thresholds: {
        cpu: 80,
        memory: 85,
        latency: 500,
        throughput: 1000
      }
    },
    resourceRightSizing: {
      enabled: true,
      analysisWindow: 86400000,
      utilizationThreshold: 20,
      recommendationConfidence: 0.8
    },
    costOptimization: {
      enabled: true,
      spotInstancesPreference: 50,
      reservedInstancesUtilization: 80,
      unusedResourcesCleanup: true
    }
  },
  multiCloud: {
    providers: {
      aws: {
        enabled: false,
        regions: ['us-east-1', 'us-west-2'],
        credentials: {},
        services: {
          eks: true,
          fargate: true,
          lambda: true,
          ec2: true
        }
      },
      gcp: {
        enabled: false,
        regions: ['us-central1', 'us-east1'],
        credentials: {},
        services: {
          gke: true,
          cloudRun: true,
          cloudFunctions: true,
          computeEngine: true
        }
      },
      azure: {
        enabled: false,
        regions: ['eastus', 'westus2'],
        credentials: {},
        services: {
          aks: true,
          containerInstances: true,
          functions: true,
          virtualMachines: true
        }
      }
    },
    arbitrage: {
      enabled: false,
      costThreshold: 20,
      latencyThreshold: 100,
      availabilityThreshold: 99.9
    },
    failover: {
      enabled: false,
      autoFailover: false,
      healthCheckInterval: 60000,
      failoverThreshold: 3
    }
  },
  capacity: {
    planning: {
      enabled: true,
      forecastHorizon: 2160,
      seasonalAdjustment: true,
      growthRate: 20,
      bufferPercentage: 15
    },
    thresholds: {
      cpu: { warning: 70, critical: 85 },
      memory: { warning: 75, critical: 90 },
      storage: { warning: 80, critical: 95 },
      network: { warning: 70, critical: 85 }
    },
    provisioning: {
      autoProvisioning: false,
      leadTime: 1800,
      approvalRequired: true
    }
  },
  policies: {
    governance: {
      resourceQuotas: {
        enabled: true,
        quotas: {
          'default': {
            'requests.cpu': '4',
            'requests.memory': '8Gi',
            'limits.cpu': '8',
            'limits.memory': '16Gi',
            'persistentvolumeclaims': '10'
          }
        }
      },
      limitRanges: {
        enabled: true,
        ranges: [
          {
            type: 'Container',
            min: { cpu: '100m', memory: '128Mi' },
            max: { cpu: '2000m', memory: '4Gi' },
            default: { cpu: '500m', memory: '1Gi' },
            defaultRequest: { cpu: '250m', memory: '512Mi' }
          }
        ]
      },
      networkPolicies: {
        enabled: false,
        defaultDeny: false,
        allowedNamespaces: []
      },
      podSecurityPolicies: {
        enabled: false,
        runAsNonRoot: true,
        allowedCapabilities: [],
        forbiddenSysctls: ['kernel.*', 'vm.*']
      }
    },
    compliance: {
      enabled: false,
      frameworks: [],
      auditLogging: false,
      dataResidency: {
        enabled: false,
        allowedRegions: []
      }
    }
  },
  monitoring: {
    metrics: {
      collection: {
        interval: 15000,
        retention: 604800000,
        aggregation: 'avg'
      },
      exporters: [],
      customMetrics: []
    },
    alerting: {
      enabled: true,
      channels: [],
      rules: []
    },
    logging: {
      level: 'info',
      structured: true,
      retention: 2592000000,
      sampling: false
    }
  },
  ml: {
    models: {
      workloadPrediction: {
        enabled: true,
        algorithm: 'lstm',
        retrainInterval: 86400000,
        features: ['cpu_usage', 'memory_usage', 'request_rate', 'response_time'],
        hyperparameters: {
          epochs: 100,
          batchSize: 32,
          learningRate: 0.001,
          hiddenUnits: 50
        }
      },
      resourceOptimization: {
        enabled: true,
        algorithm: 'reinforcement_learning',
        retrainInterval: 86400000,
        features: ['resource_usage', 'cost', 'performance', 'availability'],
        hyperparameters: {
          learningRate: 0.01,
          discountFactor: 0.95,
          explorationRate: 0.1
        }
      },
      anomalyDetection: {
        enabled: true,
        algorithm: 'isolation_forest',
        sensitivityLevel: 0.1,
        features: ['cpu_usage', 'memory_usage', 'network_io', 'disk_io'],
        hyperparameters: {
          nEstimators: 100,
          contamination: 0.1
        }
      }
    },
    training: {
      dataRetention: 2592000000,
      batchSize: 128,
      validationSplit: 0.2,
      earlyStoppingPatience: 10
    },
    inference: {
      batchPrediction: true,
      predictionCache: true,
      confidenceThreshold: 0.8
    }
  }
};

export function createResourceConfig(override?: Partial<ResourceConfig>): ResourceConfig {
  return {
    ...defaultResourceConfig,
    ...override
  };
}

export function validateResourceConfig(config: ResourceConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate orchestration config
  if (config.orchestration.maxConcurrentDeployments <= 0) {
    errors.push('Orchestration max concurrent deployments must be greater than 0');
  }

  // Validate auto-scaling config
  if (config.scaling.horizontalPodAutoscaler.minReplicas <= 0) {
    errors.push('HPA min replicas must be greater than 0');
  }
  if (config.scaling.horizontalPodAutoscaler.maxReplicas < config.scaling.horizontalPodAutoscaler.minReplicas) {
    errors.push('HPA max replicas must be greater than or equal to min replicas');
  }

  // Validate capacity thresholds
  Object.entries(config.capacity.thresholds).forEach(([resource, thresholds]) => {
    if (thresholds.warning >= thresholds.critical) {
      errors.push(`${resource} warning threshold must be less than critical threshold`);
    }
  });

  // Validate ML config
  if (config.ml.models.workloadPrediction.enabled && !config.ml.models.workloadPrediction.features.length) {
    errors.push('Workload prediction model requires features to be specified');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}