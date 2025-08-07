/**
 * Deployment Service Exports
 * Main entry point for the comprehensive deployment pipeline automation system
 */

// Core Configuration and Types
export * from './deployment-config';

// Main Orchestrator
export { default as DeploymentOrchestrator } from './deployment-orchestrator';
export type {
  DeploymentOrchestration,
  OrchestrationConfig,
  DeploymentRequest,
  DeploymentOptions,
  DeploymentValidation,
  OrchestrationMetrics
} from './deployment-orchestrator';

// GitOps Engine
export { default as GitOpsEngine } from './gitops-engine';
export type {
  GitOpsState,
  DriftResult,
  DriftedResource,
  GitOpsMetrics
} from './gitops-engine';

// Progressive Delivery System
export { default as ProgressiveDeliveryEngine } from './progressive-delivery';
export type {
  ProgressiveDeliveryState,
  TrafficSplitState,
  AnalysisState,
  RolloutStatus,
  ProgressiveDeliveryMetrics
} from './progressive-delivery';

// Pipeline Manager
export { default as PipelineManager } from './pipeline-manager';
export type {
  PipelineExecution,
  StageExecution,
  TaskExecution,
  ApprovalExecution,
  QualityGate,
  QualityGateResult,
  PipelineMetrics
} from './pipeline-manager';

// Environment Manager
export { default as EnvironmentManager } from './environment-manager';
export type {
  Environment,
  EnvironmentResource,
  EnvironmentEndpoint,
  EnvironmentHealth,
  EnvironmentMetrics,
  EnvironmentTemplate,
  ProvisioningPlan
} from './environment-manager';

// Rollback Manager
export { default as RollbackManager } from './rollback-manager';
export type {
  RollbackExecution,
  RollbackAnalysis,
  RecoveryPlan,
  RollbackDecision,
  HistoricalData
} from './rollback-manager';

// Integration Adapters
export {
  IntegrationManager,
  KubernetesAdapter,
  DockerAdapter,
  AWSAdapter,
  GitHubActionsAdapter
} from './integration-adapters';
export type {
  IntegrationAdapter,
  AdapterHealthStatus,
  AdapterCapabilities,
  KubernetesResource,
  DockerImage,
  CloudCluster
} from './integration-adapters';

// Utility Functions and Helpers
export const DeploymentUtils = {
  /**
   * Create a default deployment configuration
   */
  createDefaultConfig: (
    id: string,
    name: string,
    version: string,
    environment: string
  ) => ({
    id,
    name,
    version,
    environment,
    strategy: 'rolling' as const,
    healthCheck: {
      enabled: true,
      initialDelaySeconds: 30,
      periodSeconds: 10,
      timeoutSeconds: 5,
      successThreshold: 1,
      failureThreshold: 3
    },
    resources: {
      requests: {
        cpu: '100m',
        memory: '128Mi'
      },
      limits: {
        cpu: '500m',
        memory: '512Mi'
      }
    },
    rollback: {
      enabled: true,
      automatic: true,
      triggers: [{
        type: 'health-check' as const,
        config: { enabled: true },
        threshold: 3
      }],
      timeout: 300
    },
    monitoring: {
      enabled: true,
      metrics: {
        enabled: true,
        port: 9090,
        path: '/metrics'
      },
      logging: {
        enabled: true,
        level: 'info'
      }
    },
    createdAt: new Date(),
    updatedAt: new Date()
  }),

  /**
   * Create a canary deployment configuration
   */
  createCanaryConfig: (steps: Array<{ weight: number; duration: string }>) => ({
    steps,
    trafficSplitting: {
      type: 'weighted' as const,
      rules: []
    },
    autoPromotion: false,
    autoRollback: true
  }),

  /**
   * Create a blue-green deployment configuration
   */
  createBlueGreenConfig: (autoPromotion = false) => ({
    activeService: 'blue',
    previewService: 'green',
    autoPromotion,
    scaleDownDelay: '10m'
  }),

  /**
   * Create a basic pipeline configuration
   */
  createBasicPipeline: (id: string, name: string) => ({
    id,
    name,
    stages: [
      {
        id: 'build',
        name: 'Build',
        type: 'build' as const,
        tasks: [{
          id: 'docker-build',
          name: 'Docker Build',
          type: 'docker-build' as const,
          config: {
            dockerfile: 'Dockerfile',
            context: '.',
            tags: ['latest']
          }
        }]
      },
      {
        id: 'test',
        name: 'Test',
        type: 'test' as const,
        dependsOn: ['build'],
        tasks: [{
          id: 'unit-tests',
          name: 'Unit Tests',
          type: 'script' as const,
          config: {
            script: 'npm test'
          }
        }]
      },
      {
        id: 'deploy',
        name: 'Deploy',
        type: 'deploy' as const,
        dependsOn: ['test'],
        tasks: [{
          id: 'k8s-deploy',
          name: 'Kubernetes Deploy',
          type: 'kubernetes-deploy' as const,
          config: {
            namespace: 'default',
            manifests: ['k8s/']
          }
        }]
      }
    ],
    triggers: [{
      type: 'git' as const,
      config: {
        repository: '',
        branch: 'main'
      },
      enabled: true
    }]
  }),

  /**
   * Create a Kubernetes integration configuration
   */
  createKubernetesIntegration: (
    name: string,
    kubeconfig: string,
    namespace = 'default'
  ) => ({
    type: 'kubernetes' as const,
    name,
    enabled: true,
    config: {
      namespace,
      context: 'default'
    },
    credentials: {
      type: 'service-account' as const,
      data: {
        kubeconfig
      }
    }
  }),

  /**
   * Create a GitOps configuration
   */
  createGitOpsConfig: (repositoryUrl: string, branch = 'main', path = '.') => ({
    repository: {
      url: repositoryUrl,
      type: 'git' as const,
      revision: branch
    },
    branch,
    path,
    syncPolicy: {
      automated: true,
      syncOptions: ['CreateNamespace=true'],
      retry: {
        limit: 5,
        backoff: {
          duration: '5s',
          factor: 2,
          maxDuration: '3m'
        }
      }
    },
    autoSync: true,
    selfHeal: true,
    prune: true,
    allowEmpty: false
  }),

  /**
   * Validate deployment configuration
   */
  validateConfig: (config: any): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!config.id) errors.push('Deployment ID is required');
    if (!config.name) errors.push('Deployment name is required');
    if (!config.version) errors.push('Version is required');
    if (!config.environment) errors.push('Environment is required');

    const validStrategies = ['rolling', 'blue-green', 'canary', 'a-b-testing', 'recreate', 'immutable'];
    if (!validStrategies.includes(config.strategy)) {
      errors.push(`Invalid strategy: ${config.strategy}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Generate deployment ID
   */
  generateId: (): string => {
    return `dep-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Parse duration string to milliseconds
   */
  parseDuration: (duration: string): number => {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 0;

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 0;
    }
  },

  /**
   * Format duration from milliseconds to human readable
   */
  formatDuration: (milliseconds: number): string => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  },

  /**
   * Calculate deployment health score
   */
  calculateHealthScore: (metrics: {
    errorRate: number;
    responseTime: number;
    availability: number;
  }): number => {
    const errorScore = Math.max(0, 100 - (metrics.errorRate * 10));
    const performanceScore = Math.max(0, 100 - Math.max(0, (metrics.responseTime - 200) / 10));
    const availabilityScore = metrics.availability;

    return Math.round((errorScore + performanceScore + availabilityScore) / 3);
  }
};

// Factory Functions
export const DeploymentFactory = {
  /**
   * Create a complete deployment orchestrator instance
   */
  createOrchestrator: (config?: Partial<any>) => {
    const defaultConfig = {
      maxConcurrentDeployments: 10,
      defaultTimeout: 1800000, // 30 minutes
      eventRetention: 1000,
      metricsInterval: 300000, // 5 minutes
      healthCheckInterval: 60000, // 1 minute
      autoCleanup: true,
      notifications: {
        enabled: false,
        channels: [],
        events: []
      }
    };

    const orchestratorConfig = { ...defaultConfig, ...config };
    return new DeploymentOrchestrator(orchestratorConfig);
  },

  /**
   * Create a GitOps engine instance
   */
  createGitOpsEngine: (config: any, eventEmitter: any, logger?: any) => {
    return new GitOpsEngine(config, eventEmitter, logger);
  },

  /**
   * Create a progressive delivery engine instance
   */
  createProgressiveDeliveryEngine: (eventEmitter: any, logger?: any) => {
    return new ProgressiveDeliveryEngine(eventEmitter, logger);
  },

  /**
   * Create a pipeline manager instance
   */
  createPipelineManager: (eventEmitter: any, maxConcurrent = 5, logger?: any) => {
    return new PipelineManager(eventEmitter, maxConcurrent, logger);
  },

  /**
   * Create an environment manager instance
   */
  createEnvironmentManager: (eventEmitter: any, logger?: any) => {
    return new EnvironmentManager(eventEmitter, logger);
  },

  /**
   * Create a rollback manager instance
   */
  createRollbackManager: (eventEmitter: any, logger?: any) => {
    return new RollbackManager(eventEmitter, logger);
  },

  /**
   * Create an integration manager instance
   */
  createIntegrationManager: (eventEmitter: any, logger?: any) => {
    return new IntegrationManager(eventEmitter, logger);
  }
};

// Constants
export const DEPLOYMENT_CONSTANTS = {
  STRATEGIES: {
    ROLLING: 'rolling',
    BLUE_GREEN: 'blue-green',
    CANARY: 'canary',
    AB_TESTING: 'a-b-testing',
    RECREATE: 'recreate',
    IMMUTABLE: 'immutable'
  } as const,

  PHASES: {
    PENDING: 'pending',
    RUNNING: 'running',
    SUCCEEDED: 'succeeded',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
    ROLLBACK: 'rollback',
    SUSPENDED: 'suspended'
  } as const,

  ENVIRONMENTS: {
    DEVELOPMENT: 'development',
    STAGING: 'staging',
    PRODUCTION: 'production',
    TESTING: 'testing',
    PREVIEW: 'preview'
  } as const,

  CLOUD_PROVIDERS: {
    AWS: 'aws',
    GCP: 'gcp',
    AZURE: 'azure',
    KUBERNETES: 'kubernetes',
    LOCAL: 'local'
  } as const,

  INTEGRATION_TYPES: {
    KUBERNETES: 'kubernetes',
    DOCKER: 'docker',
    HELM: 'helm',
    TERRAFORM: 'terraform',
    GITHUB_ACTIONS: 'github-actions',
    GITLAB_CI: 'gitlab-ci',
    JENKINS: 'jenkins',
    ARGOCD: 'argocd',
    FLUX: 'flux',
    TEKTON: 'tekton',
    SPINNAKER: 'spinnaker'
  } as const,

  DEFAULT_TIMEOUTS: {
    DEPLOYMENT: 1800000, // 30 minutes
    ROLLBACK: 300000,    // 5 minutes
    HEALTH_CHECK: 30000, // 30 seconds
    PIPELINE_STAGE: 600000 // 10 minutes
  } as const,

  HEALTH_CHECK_DEFAULTS: {
    INITIAL_DELAY: 30,
    PERIOD: 10,
    TIMEOUT: 5,
    SUCCESS_THRESHOLD: 1,
    FAILURE_THRESHOLD: 3
  } as const
};

// Version information
export const VERSION = '1.0.0';
export const BUILD_DATE = new Date().toISOString();

// Re-export event emitter for external use
export { DeploymentEventEmitter } from './deployment-config';

// Main deployment service class that combines all components
export class DeploymentService {
  private orchestrator: DeploymentOrchestrator;
  private initialized = false;

  constructor(config?: Partial<any>) {
    this.orchestrator = DeploymentFactory.createOrchestrator(config);
  }

  /**
   * Initialize the deployment service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('Deployment service is already initialized');
    }

    // Any initialization logic would go here
    this.initialized = true;
  }

  /**
   * Start a deployment
   */
  async deploy(request: any): Promise<string> {
    if (!this.initialized) {
      throw new Error('Deployment service not initialized');
    }

    return await this.orchestrator.startDeployment(request);
  }

  /**
   * Get deployment status
   */
  getStatus(deploymentId: string): any {
    return this.orchestrator.getDeploymentStatus(deploymentId);
  }

  /**
   * Cancel a deployment
   */
  async cancel(deploymentId: string): Promise<void> {
    await this.orchestrator.cancelDeployment(deploymentId);
  }

  /**
   * Trigger rollback
   */
  async rollback(deploymentId: string, reason: string): Promise<void> {
    await this.orchestrator.rollbackDeployment(deploymentId, reason);
  }

  /**
   * Get metrics
   */
  getMetrics(): any {
    return this.orchestrator.getMetrics();
  }

  /**
   * List deployments
   */
  listDeployments(filter?: any): any[] {
    return this.orchestrator.listDeployments(filter);
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    await this.orchestrator.cleanup();
    this.initialized = false;
  }
}

// Default export
export default DeploymentService;

/**
 * Usage Examples:
 * 
 * // Basic usage
 * const deploymentService = new DeploymentService({
 *   maxConcurrentDeployments: 5,
 *   notifications: {
 *     enabled: true,
 *     channels: [{ type: 'slack', config: { webhook: 'url' }, enabled: true }]
 *   }
 * });
 * 
 * await deploymentService.initialize();
 * 
 * const deploymentId = await deploymentService.deploy({
 *   config: DeploymentUtils.createDefaultConfig('app-1', 'My App', '1.0.0', 'production'),
 *   gitops: DeploymentUtils.createGitOpsConfig('https://github.com/example/repo.git'),
 *   progressiveDelivery: {
 *     strategy: 'canary',
 *     config: DeploymentUtils.createCanaryConfig([
 *       { weight: 10, duration: '5m' },
 *       { weight: 50, duration: '10m' },
 *       { weight: 100, duration: '0s' }
 *     ])
 *   }
 * });
 * 
 * // Monitor deployment
 * const status = deploymentService.getStatus(deploymentId);
 * console.log('Deployment status:', status);
 * 
 * // Advanced usage with orchestrator directly
 * const orchestrator = DeploymentFactory.createOrchestrator();
 * const gitopsEngine = DeploymentFactory.createGitOpsEngine(gitopsConfig, orchestrator.eventEmitter);
 * 
 * // Cleanup
 * await deploymentService.shutdown();
 */