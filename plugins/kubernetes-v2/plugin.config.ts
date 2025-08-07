/**
 * Kubernetes V2 Plugin - Plugin Configuration
 * Advanced configuration for the next-generation Kubernetes management plugin
 */

import { PluginConfig, PluginCapability } from '@/types/plugins';

export const kubernetesV2PluginConfig: PluginConfig = {
  // Basic plugin information
  id: 'kubernetes-v2',
  name: 'Kubernetes V2 Management',
  version: '2.0.0',
  description: 'Advanced multi-cloud Kubernetes management with AI-powered insights, cost optimization, and security monitoring',
  
  // Plugin metadata
  metadata: {
    author: 'Next Portal Team',
    category: 'Infrastructure',
    tags: ['kubernetes', 'container', 'orchestration', 'ai', 'multi-cloud', 'cost-optimization', 'security'],
    license: 'MIT',
    homepage: 'https://docs.nextportal.io/plugins/kubernetes-v2',
    repository: 'https://github.com/nextportal/plugins/kubernetes-v2',
    documentation: 'https://docs.nextportal.io/plugins/kubernetes-v2/getting-started',
    changelog: 'https://github.com/nextportal/plugins/kubernetes-v2/CHANGELOG.md',
    
    // Feature flags
    beta: false,
    experimental: false,
    deprecated: false,
    
    // Compatibility
    minPortalVersion: '2.0.0',
    maxPortalVersion: null,
    supportedEnvironments: ['development', 'staging', 'production'],
    
    // Requirements
    requirements: {
      memory: '512MB',
      cpu: '0.5 cores',
      disk: '100MB',
      network: 'required'
    }
  },

  // Plugin capabilities
  capabilities: [
    PluginCapability.DASHBOARD,
    PluginCapability.API_ROUTES,
    PluginCapability.BACKGROUND_TASKS,
    PluginCapability.REAL_TIME_UPDATES,
    PluginCapability.NOTIFICATIONS,
    PluginCapability.ANALYTICS,
    PluginCapability.AI_INSIGHTS,
    PluginCapability.COST_TRACKING,
    PluginCapability.SECURITY_SCANNING,
    PluginCapability.MULTI_CLOUD,
    PluginCapability.AUTO_SCALING,
    PluginCapability.DISASTER_RECOVERY,
    PluginCapability.GITOPS_INTEGRATION
  ],

  // Configuration schema
  configSchema: {
    type: 'object',
    properties: {
      // Core settings
      core: {
        type: 'object',
        properties: {
          enabled: {
            type: 'boolean',
            default: true,
            description: 'Enable the Kubernetes V2 plugin'
          },
          refreshInterval: {
            type: 'number',
            default: 30,
            minimum: 10,
            maximum: 300,
            description: 'Data refresh interval in seconds'
          },
          maxClusters: {
            type: 'number',
            default: 50,
            minimum: 1,
            maximum: 1000,
            description: 'Maximum number of clusters to manage'
          }
        }
      },

      // Multi-cloud provider configurations
      providers: {
        type: 'object',
        properties: {
          aws: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean', default: true },
              regions: {
                type: 'array',
                items: { type: 'string' },
                default: ['us-east-1', 'us-west-2', 'eu-west-1']
              },
              credentials: {
                type: 'object',
                properties: {
                  accessKeyId: { type: 'string', sensitive: true },
                  secretAccessKey: { type: 'string', sensitive: true },
                  roleArn: { type: 'string' }
                }
              }
            }
          },
          gcp: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean', default: true },
              projectId: { type: 'string' },
              regions: {
                type: 'array',
                items: { type: 'string' },
                default: ['us-central1', 'us-west1', 'europe-west1']
              },
              credentials: {
                type: 'object',
                properties: {
                  serviceAccountKey: { type: 'string', sensitive: true }
                }
              }
            }
          },
          azure: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean', default: true },
              subscriptionId: { type: 'string' },
              tenantId: { type: 'string' },
              regions: {
                type: 'array',
                items: { type: 'string' },
                default: ['eastus', 'westus2', 'westeurope']
              },
              credentials: {
                type: 'object',
                properties: {
                  clientId: { type: 'string' },
                  clientSecret: { type: 'string', sensitive: true }
                }
              }
            }
          }
        }
      },

      // AI and ML features
      ai: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', default: true },
          insightsEnabled: { type: 'boolean', default: true },
          anomalyDetection: { type: 'boolean', default: true },
          predictiveAnalytics: { type: 'boolean', default: true },
          autoOptimization: { type: 'boolean', default: false },
          confidenceThreshold: {
            type: 'number',
            default: 0.8,
            minimum: 0.5,
            maximum: 1.0,
            description: 'Minimum confidence score for AI recommendations'
          }
        }
      },

      // Cost optimization settings
      costOptimization: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', default: true },
          currency: { type: 'string', default: 'USD' },
          budgetAlerts: { type: 'boolean', default: true },
          rightsizingEnabled: { type: 'boolean', default: true },
          spotInstanceRecommendations: { type: 'boolean', default: true },
          savingsThreshold: {
            type: 'number',
            default: 100,
            description: 'Minimum monthly savings to show recommendations'
          }
        }
      },

      // Security configuration
      security: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', default: true },
          continuousScanning: { type: 'boolean', default: true },
          complianceFrameworks: {
            type: 'array',
            items: { 
              type: 'string',
              enum: ['cis', 'nist', 'pci-dss', 'sox', 'hipaa', 'gdpr']
            },
            default: ['cis', 'nist']
          },
          vulnerabilityThreshold: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            default: 'medium'
          },
          alertOnNewVulnerabilities: { type: 'boolean', default: true }
        }
      },

      // Auto-scaling configuration
      autoScaling: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', default: true },
          hpaEnabled: { type: 'boolean', default: true },
          vpaEnabled: { type: 'boolean', default: false },
          caEnabled: { type: 'boolean', default: false },
          defaultTargetCPU: {
            type: 'number',
            default: 70,
            minimum: 10,
            maximum: 95
          },
          defaultTargetMemory: {
            type: 'number',
            default: 80,
            minimum: 10,
            maximum: 95
          }
        }
      },

      // GitOps integration
      gitops: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', default: false },
          argocdEnabled: { type: 'boolean', default: false },
          fluxEnabled: { type: 'boolean', default: false },
          argocdUrl: { type: 'string' },
          fluxNamespace: { type: 'string', default: 'flux-system' }
        }
      },

      // Disaster recovery
      disasterRecovery: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', default: false },
          backupEnabled: { type: 'boolean', default: false },
          backupStorage: {
            type: 'string',
            enum: ['aws-s3', 'gcs', 'azure-blob', 'nfs'],
            default: 'aws-s3'
          },
          backupSchedule: { type: 'string', default: '0 2 * * *' },
          retentionDays: {
            type: 'number',
            default: 30,
            minimum: 1,
            maximum: 365
          }
        }
      },

      // Network policy visualization
      networkPolicies: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', default: true },
          visualizationEnabled: { type: 'boolean', default: true },
          recommendationsEnabled: { type: 'boolean', default: true },
          autoGenerateBaseline: { type: 'boolean', default: false }
        }
      },

      // Monitoring and observability
      observability: {
        type: 'object',
        properties: {
          prometheusUrl: { type: 'string' },
          grafanaUrl: { type: 'string' },
          jaegerUrl: { type: 'string' },
          metricsRetentionDays: {
            type: 'number',
            default: 30,
            minimum: 1,
            maximum: 365
          }
        }
      }
    },
    required: ['core']
  },

  // Default configuration
  defaultConfig: {
    core: {
      enabled: true,
      refreshInterval: 30,
      maxClusters: 50
    },
    providers: {
      aws: { enabled: true },
      gcp: { enabled: true },
      azure: { enabled: true }
    },
    ai: {
      enabled: true,
      insightsEnabled: true,
      anomalyDetection: true,
      predictiveAnalytics: true,
      autoOptimization: false,
      confidenceThreshold: 0.8
    },
    costOptimization: {
      enabled: true,
      currency: 'USD',
      budgetAlerts: true,
      rightsizingEnabled: true,
      spotInstanceRecommendations: true,
      savingsThreshold: 100
    },
    security: {
      enabled: true,
      continuousScanning: true,
      complianceFrameworks: ['cis', 'nist'],
      vulnerabilityThreshold: 'medium',
      alertOnNewVulnerabilities: true
    },
    autoScaling: {
      enabled: true,
      hpaEnabled: true,
      vpaEnabled: false,
      caEnabled: false,
      defaultTargetCPU: 70,
      defaultTargetMemory: 80
    }
  },

  // Plugin routes
  routes: [
    {
      path: '/kubernetes-v2',
      component: 'KubernetesV2Overview',
      title: 'Kubernetes V2',
      description: 'Advanced Kubernetes management dashboard',
      icon: 'kubernetes',
      permissions: ['kubernetes.read']
    },
    {
      path: '/kubernetes-v2/clusters',
      component: 'ClusterGrid',
      title: 'Clusters',
      description: 'Multi-cloud cluster management',
      permissions: ['kubernetes.clusters.read']
    },
    {
      path: '/kubernetes-v2/cost-analytics',
      component: 'CostAnalyticsDashboard',
      title: 'Cost Analytics',
      description: 'Cost optimization and analysis',
      permissions: ['kubernetes.cost.read']
    },
    {
      path: '/kubernetes-v2/security',
      component: 'SecurityDashboard',
      title: 'Security',
      description: 'Security monitoring and compliance',
      permissions: ['kubernetes.security.read']
    },
    {
      path: '/kubernetes-v2/ai-insights',
      component: 'AIInsightsDashboard',
      title: 'AI Insights',
      description: 'AI-powered analytics and recommendations',
      permissions: ['kubernetes.ai.read']
    },
    {
      path: '/kubernetes-v2/optimization',
      component: 'ResourceOptimizationDashboard',
      title: 'Resource Optimization',
      description: 'Intelligent resource optimization',
      permissions: ['kubernetes.optimization.read']
    }
  ],

  // API endpoints
  api: {
    prefix: '/api/kubernetes-v2',
    routes: [
      {
        method: 'GET',
        path: '/',
        description: 'Main Kubernetes V2 API endpoint'
      },
      {
        method: 'GET',
        path: '/clusters',
        description: 'Cluster management endpoints'
      },
      {
        method: 'POST',
        path: '/clusters',
        description: 'Create or import clusters'
      },
      {
        method: 'DELETE',
        path: '/clusters/:id',
        description: 'Remove cluster from management'
      }
    ]
  },

  // Navigation integration
  navigation: {
    primary: {
      title: 'Kubernetes V2',
      icon: 'kubernetes',
      path: '/kubernetes-v2',
      order: 100,
      permissions: ['kubernetes.read']
    },
    secondary: [
      {
        title: 'Clusters',
        path: '/kubernetes-v2/clusters',
        icon: 'cloud',
        permissions: ['kubernetes.clusters.read']
      },
      {
        title: 'Cost Analytics',
        path: '/kubernetes-v2/cost-analytics',
        icon: 'dollar-sign',
        permissions: ['kubernetes.cost.read']
      },
      {
        title: 'Security',
        path: '/kubernetes-v2/security',
        icon: 'shield',
        permissions: ['kubernetes.security.read']
      },
      {
        title: 'AI Insights',
        path: '/kubernetes-v2/ai-insights',
        icon: 'brain',
        permissions: ['kubernetes.ai.read']
      },
      {
        title: 'Optimization',
        path: '/kubernetes-v2/optimization',
        icon: 'zap',
        permissions: ['kubernetes.optimization.read']
      }
    ]
  },

  // Permissions required by the plugin
  permissions: [
    'kubernetes.read',
    'kubernetes.write',
    'kubernetes.clusters.read',
    'kubernetes.clusters.write',
    'kubernetes.clusters.delete',
    'kubernetes.workloads.read',
    'kubernetes.workloads.write',
    'kubernetes.cost.read',
    'kubernetes.security.read',
    'kubernetes.security.scan',
    'kubernetes.ai.read',
    'kubernetes.optimization.read',
    'kubernetes.optimization.apply'
  ],

  // Health check configuration
  healthCheck: {
    enabled: true,
    interval: 60, // seconds
    timeout: 10,  // seconds
    endpoint: '/api/kubernetes-v2/health'
  },

  // Monitoring and metrics
  monitoring: {
    metricsEnabled: true,
    tracingEnabled: true,
    loggingEnabled: true,
    customMetrics: [
      'kubernetes_clusters_total',
      'kubernetes_nodes_total',
      'kubernetes_workloads_total',
      'kubernetes_cost_monthly',
      'kubernetes_security_score',
      'kubernetes_optimization_opportunities'
    ]
  },

  // Background tasks
  backgroundTasks: [
    {
      name: 'cluster-health-monitor',
      schedule: '*/30 * * * * *', // Every 30 seconds
      description: 'Monitor cluster health and update status'
    },
    {
      name: 'cost-data-collector',
      schedule: '0 */6 * * *', // Every 6 hours
      description: 'Collect cost data from cloud providers'
    },
    {
      name: 'security-scanner',
      schedule: '0 2 * * *', // Daily at 2 AM
      description: 'Run security scans on all clusters'
    },
    {
      name: 'ai-insights-generator',
      schedule: '0 4 * * *', // Daily at 4 AM
      description: 'Generate AI insights and recommendations'
    },
    {
      name: 'metrics-aggregator',
      schedule: '*/5 * * * *', // Every 5 minutes
      description: 'Aggregate and process metrics data'
    }
  ],

  // Dependencies
  dependencies: {
    required: [
      '@kubernetes/client-node',
      '@tensorflow/tfjs-node',
      'recharts',
      'react-flow-renderer'
    ],
    optional: [
      '@aws-sdk/client-cost-explorer',
      '@google-cloud/billing',
      '@azure/arm-costmanagement'
    ]
  },

  // Webhook endpoints
  webhooks: [
    {
      name: 'cluster-events',
      path: '/webhooks/kubernetes-v2/cluster-events',
      description: 'Receive cluster state change events'
    },
    {
      name: 'security-alerts',
      path: '/webhooks/kubernetes-v2/security-alerts',
      description: 'Receive security vulnerability alerts'
    }
  ],

  // Integration points
  integrations: {
    backstage: {
      enabled: true,
      entityTypes: ['Component', 'System', 'Resource'],
      annotations: [
        'kubernetes.io/cluster-name',
        'kubernetes.io/namespace',
        'kubernetes.io/deployment-name'
      ]
    },
    prometheus: {
      enabled: true,
      scrapeConfigs: [
        {
          job_name: 'kubernetes-v2-plugin',
          static_configs: [{ targets: ['localhost:3000'] }]
        }
      ]
    },
    grafana: {
      enabled: true,
      dashboards: [
        'kubernetes-v2-overview',
        'kubernetes-v2-cost-analysis',
        'kubernetes-v2-security'
      ]
    }
  }
};

export default kubernetesV2PluginConfig;