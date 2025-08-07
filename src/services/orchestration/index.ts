/**
 * Plugin Lifecycle Orchestration System - Main Module
 * Comprehensive plugin lifecycle management following Spotify's Portal architecture patterns
 * Provides unified interface for complete plugin operation control
 */

export * from './plugin-lifecycle-state-machine';
export * from './plugin-lifecycle-orchestrator';
export * from './plugin-service-discovery';
export * from './plugin-health-monitor';
export * from './plugin-configuration-manager';
export * from './plugin-deployment-strategies';

import { EventEmitter } from 'events';
import { z } from 'zod';
import {
  getPluginLifecycleOrchestrator,
  PluginLifecycleOrchestrator,
  OrchestrationConfig,
  PluginOperationRequest,
  PluginOperationResult
} from './plugin-lifecycle-orchestrator';
import {
  getPluginServiceDiscovery,
  PluginServiceDiscovery,
  ServiceDiscoveryConfig,
  ServiceRegistration,
  ServiceInstance
} from './plugin-service-discovery';
import {
  getPluginHealthMonitor,
  PluginHealthMonitor,
  HealthMonitorConfig,
  HealthProbeConfig,
  PluginHealthStatus
} from './plugin-health-monitor';
import {
  getPluginConfigurationManager,
  PluginConfigurationManager,
  ConfigManagerConfig,
  ConfigurationItem,
  ConfigurationVersion
} from './plugin-configuration-manager';
import {
  getPluginDeploymentStrategyManager,
  PluginDeploymentStrategyManager,
  DeploymentConfig,
  DeploymentInstance,
  DeploymentStrategy
} from './plugin-deployment-strategies';
import {
  pluginStateMachineRegistry,
  PluginStateMachineRegistry,
  PluginLifecycleState,
  PluginLifecycleEvent,
  LifecycleContext
} from './plugin-lifecycle-state-machine';

// Orchestration system configuration
export const OrchestrationSystemConfigSchema = z.object({
  orchestrator: z.any().optional(),
  serviceDiscovery: z.any().optional(),
  healthMonitor: z.any().optional(),
  configurationManager: z.any().optional(),
  deploymentStrategies: z.object({}).optional(),
  globalSettings: z.object({
    enableMetrics: z.boolean().default(true),
    enableAuditLogging: z.boolean().default(true),
    enableEventSourcing: z.boolean().default(true),
    defaultEnvironment: z.enum(['development', 'staging', 'production']).default('development'),
    defaultTenant: z.string().optional()
  }).optional()
});

export type OrchestrationSystemConfig = z.infer<typeof OrchestrationSystemConfigSchema>;

// Plugin operation status
export interface PluginStatus {
  pluginId: string;
  lifecycleState: PluginLifecycleState;
  deploymentStatus?: string;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  configurationVersion: string;
  services: ServiceInstance[];
  lastUpdated: Date;
  metadata: Record<string, any>;
}

// System-wide metrics
export interface SystemMetrics {
  orchestration: {
    totalOperations: number;
    activeOperations: number;
    successfulOperations: number;
    failedOperations: number;
    averageOperationDuration: number;
  };
  serviceDiscovery: {
    totalServices: number;
    healthyServices: number;
    unhealthyServices: number;
    averageResponseTime: number;
    errorRate: number;
  };
  healthMonitoring: {
    totalPlugins: number;
    healthyPlugins: number;
    unhealthyPlugins: number;
    activeChecks: number;
    circuitBreakersOpen: number;
  };
  configuration: {
    totalConfigurations: number;
    totalVersions: number;
    totalSecrets: number;
    totalWatchers: number;
  };
  deployment: {
    activeDeployments: number;
    deploymentsToday: number;
    successRate: number;
    rollbackRate: number;
  };
}

/**
 * Plugin Lifecycle Orchestration System
 * Main facade providing unified access to all orchestration components
 */
export class PluginLifecycleOrchestrationSystem extends EventEmitter {
  private orchestrator: PluginLifecycleOrchestrator;
  private serviceDiscovery: PluginServiceDiscovery;
  private healthMonitor: PluginHealthMonitor;
  private configurationManager: PluginConfigurationManager;
  private deploymentStrategyManager: PluginDeploymentStrategyManager;
  private stateMachineRegistry: PluginStateMachineRegistry;
  private config: OrchestrationSystemConfig;

  constructor(config?: OrchestrationSystemConfig) {
    super();
    this.config = OrchestrationSystemConfigSchema.parse(config || {});
    this.initializeSystem();
  }

  // Initialize the orchestration system
  private initializeSystem(): void {
    // Initialize all components with configurations
    this.orchestrator = getPluginLifecycleOrchestrator(this.config.orchestrator);
    this.serviceDiscovery = getPluginServiceDiscovery(this.config.serviceDiscovery);
    this.healthMonitor = getPluginHealthMonitor(this.config.healthMonitor);
    this.configurationManager = getPluginConfigurationManager(this.config.configurationManager);
    this.deploymentStrategyManager = getPluginDeploymentStrategyManager();
    this.stateMachineRegistry = pluginStateMachineRegistry;

    // Set up event forwarding and cross-component integration
    this.setupEventIntegration();

    // Setup global event listeners
    this.setupGlobalEventListeners();
  }

  // Setup event integration between components
  private setupEventIntegration(): void {
    // Forward all component events to the main system emitter
    const components = [
      { name: 'orchestrator', instance: this.orchestrator },
      { name: 'serviceDiscovery', instance: this.serviceDiscovery },
      { name: 'healthMonitor', instance: this.healthMonitor },
      { name: 'configurationManager', instance: this.configurationManager },
      { name: 'deploymentManager', instance: this.deploymentStrategyManager }
    ];

    components.forEach(({ name, instance }) => {
      // Forward all events with component prefix
      const originalEmit = instance.emit.bind(instance);
      instance.emit = (event: string, ...args: any[]) => {
        this.emit(`${name}:${event}`, ...args);
        this.emit('systemEvent', { component: name, event, args });
        return originalEmit(event, ...args);
      };
    });

    // Cross-component event handling
    this.setupCrossComponentEvents();
  }

  // Setup cross-component event handling
  private setupCrossComponentEvents(): void {
    // When a service is registered, automatically set up health monitoring
    this.serviceDiscovery.on('serviceRegistered', async (service: ServiceInstance) => {
      try {
        const defaultProbes = this.createDefaultHealthProbes(service);
        await this.healthMonitor.registerPluginProbes(service.registration.pluginId, defaultProbes);
      } catch (error) {
        this.emit('integrationError', {
          source: 'serviceDiscovery->healthMonitor',
          error,
          context: { serviceId: service.registration.serviceId }
        });
      }
    });

    // When a service is deregistered, clean up health monitoring
    this.serviceDiscovery.on('serviceDeregistered', async (service: ServiceInstance) => {
      try {
        await this.healthMonitor.unregisterPluginProbes(service.registration.pluginId);
      } catch (error) {
        this.emit('integrationError', {
          source: 'serviceDiscovery->healthMonitor',
          error,
          context: { serviceId: service.registration.serviceId }
        });
      }
    });

    // When configuration changes, notify relevant services
    this.configurationManager.on('configurationUpdated', (event) => {
      this.emit('configurationChanged', event);
      
      // Trigger configuration reload in affected services
      this.orchestrator.executeOperation({
        operationId: `config-reload-${Date.now()}`,
        pluginId: event.pluginId,
        operation: 'configure',
        userId: 'system',
        environment: event.environment,
        tenantId: event.tenantId,
        metadata: { configurationReload: true, versionId: event.versionId }
      }).catch(error => {
        this.emit('integrationError', {
          source: 'configurationManager->orchestrator',
          error,
          context: event
        });
      });
    });

    // When deployments complete, update service discovery
    this.deploymentStrategyManager.on('deploymentCompleted', async (deployment: DeploymentInstance) => {
      try {
        // Clean up old service registrations
        for (const oldInstance of deployment.oldInstances) {
          await this.serviceDiscovery.deregisterService(oldInstance.registration.serviceId);
        }
        
        // Ensure new services are properly registered
        for (const newInstance of deployment.newInstances) {
          if (!this.serviceDiscovery.getService(newInstance.registration.serviceId)) {
            await this.serviceDiscovery.registerService(newInstance.registration);
          }
        }
      } catch (error) {
        this.emit('integrationError', {
          source: 'deploymentManager->serviceDiscovery',
          error,
          context: { deploymentId: deployment.deploymentId }
        });
      }
    });

    // When health checks fail, trigger appropriate orchestration actions
    this.healthMonitor.on('healthCheckFailed', async (result) => {
      if (result.consecutiveFailures >= 3) {
        try {
          await this.orchestrator.executeOperation({
            operationId: `health-recovery-${Date.now()}`,
            pluginId: result.pluginId,
            operation: 'restart',
            userId: 'health-monitor',
            metadata: { 
              autoRecovery: true, 
              reason: 'consecutive_health_failures',
              failureCount: result.consecutiveFailures 
            }
          });
        } catch (error) {
          this.emit('integrationError', {
            source: 'healthMonitor->orchestrator',
            error,
            context: result
          });
        }
      }
    });
  }

  // Setup global event listeners
  private setupGlobalEventListeners(): void {
    // Log all system events if audit logging is enabled
    if (this.config.globalSettings?.enableAuditLogging) {
      this.on('systemEvent', (event) => {
        this.logAuditEvent(event);
      });
    }

    // Collect metrics if metrics are enabled
    if (this.config.globalSettings?.enableMetrics) {
      setInterval(() => {
        this.collectSystemMetrics();
      }, 60000); // Collect metrics every minute
    }
  }

  // PLUGIN LIFECYCLE OPERATIONS

  /**
   * Install a plugin with full orchestration
   */
  async installPlugin(
    pluginId: string,
    version: string,
    options: {
      environment?: string;
      tenantId?: string;
      userId: string;
      configuration?: ConfigurationItem[];
      healthProbes?: HealthProbeConfig[];
      deploymentStrategy?: DeploymentStrategy;
      dryRun?: boolean;
    }
  ): Promise<PluginOperationResult> {
    const {
      environment = this.config.globalSettings?.defaultEnvironment || 'development',
      tenantId = this.config.globalSettings?.defaultTenant,
      userId,
      configuration = [],
      healthProbes = [],
      deploymentStrategy = DeploymentStrategy.ROLLING_UPDATE,
      dryRun = false
    } = options;

    // Create operation request
    const operationRequest: PluginOperationRequest = {
      operationId: `install-${pluginId}-${Date.now()}`,
      pluginId,
      operation: 'install',
      version,
      environment: environment as any,
      tenantId,
      userId,
      dryRun,
      metadata: {
        deploymentStrategy,
        hasConfiguration: configuration.length > 0,
        hasHealthProbes: healthProbes.length > 0
      }
    };

    try {
      // Set up configuration if provided
      if (configuration.length > 0) {
        await this.configurationManager.setPluginConfiguration(pluginId, configuration, {
          environment,
          tenantId,
          userId,
          description: `Initial configuration for ${pluginId} v${version}`
        });
      }

      // Execute installation
      const result = await this.orchestrator.executeOperation(operationRequest);

      // Set up health monitoring if probes are provided
      if (healthProbes.length > 0 && result.success) {
        await this.healthMonitor.registerPluginProbes(pluginId, healthProbes);
      }

      return result;

    } catch (error) {
      throw new Error(`Plugin installation failed: ${error}`);
    }
  }

  /**
   * Update a plugin with zero-downtime deployment
   */
  async updatePlugin(
    pluginId: string,
    newVersion: string,
    options: {
      environment?: string;
      tenantId?: string;
      userId: string;
      deploymentStrategy?: DeploymentStrategy;
      deploymentConfig?: Partial<DeploymentConfig>;
      configurationUpdates?: ConfigurationItem[];
    }
  ): Promise<DeploymentInstance> {
    const {
      environment = this.config.globalSettings?.defaultEnvironment || 'development',
      tenantId = this.config.globalSettings?.defaultTenant,
      userId,
      deploymentStrategy = DeploymentStrategy.CANARY,
      deploymentConfig = {},
      configurationUpdates = []
    } = options;

    try {
      // Update configuration if provided
      if (configurationUpdates.length > 0) {
        await this.configurationManager.setPluginConfiguration(pluginId, configurationUpdates, {
          environment,
          tenantId,
          userId,
          description: `Configuration update for ${pluginId} v${newVersion}`
        });
      }

      // Create deployment configuration
      const fullDeploymentConfig: DeploymentConfig = {
        strategy: deploymentStrategy,
        pluginId,
        version: newVersion,
        environment: environment as any,
        tenantId,
        ...deploymentConfig,
        healthValidation: {
          enabled: true,
          healthCheckTimeout: 300000,
          requiredHealthChecks: [/* ProbeType values would be imported */],
          maxUnhealthyInstances: 0,
          ...deploymentConfig.healthValidation
        },
        trafficManagement: {
          loadBalancingStrategy: 'round_robin' as any,
          sessionAffinity: false,
          drainTimeout: 30000,
          ...deploymentConfig.trafficManagement
        },
        rollback: {
          enabled: true,
          automaticRollback: true,
          rollbackTriggers: {
            healthCheckFailure: true,
            errorRateThreshold: 10,
            responseTimeThreshold: 5000
          },
          rollbackTimeout: 300000,
          ...deploymentConfig.rollback
        }
      };

      // Execute deployment
      const deploymentId = await this.deploymentStrategyManager.executeDeployment(fullDeploymentConfig);
      const deployment = this.deploymentStrategyManager.getDeployment(deploymentId);

      if (!deployment) {
        throw new Error('Failed to retrieve deployment instance');
      }

      return deployment;

    } catch (error) {
      throw new Error(`Plugin update failed: ${error}`);
    }
  }

  /**
   * Uninstall a plugin
   */
  async uninstallPlugin(
    pluginId: string,
    options: {
      environment?: string;
      tenantId?: string;
      userId: string;
      gracefulShutdown?: boolean;
      drainTimeout?: number;
    }
  ): Promise<PluginOperationResult> {
    const {
      environment = this.config.globalSettings?.defaultEnvironment || 'development',
      tenantId = this.config.globalSettings?.defaultTenant,
      userId,
      gracefulShutdown = true,
      drainTimeout = 30000
    } = options;

    const operationRequest: PluginOperationRequest = {
      operationId: `uninstall-${pluginId}-${Date.now()}`,
      pluginId,
      operation: 'uninstall',
      environment: environment as any,
      tenantId,
      userId,
      metadata: {
        gracefulShutdown,
        drainTimeout
      }
    };

    try {
      // Execute uninstallation
      const result = await this.orchestrator.executeOperation(operationRequest);

      // Clean up health monitoring
      await this.healthMonitor.unregisterPluginProbes(pluginId);

      // Clean up service discovery
      const services = await this.serviceDiscovery.getPluginServices(pluginId);
      for (const service of services) {
        await this.serviceDiscovery.deregisterService(service.registration.serviceId);
      }

      return result;

    } catch (error) {
      throw new Error(`Plugin uninstallation failed: ${error}`);
    }
  }

  // PLUGIN STATUS AND MONITORING

  /**
   * Get comprehensive plugin status
   */
  async getPluginStatus(
    pluginId: string,
    environment?: string,
    tenantId?: string
  ): Promise<PluginStatus> {
    const env = environment || this.config.globalSettings?.defaultEnvironment || 'development';
    const tenant = tenantId || this.config.globalSettings?.defaultTenant;

    try {
      // Get lifecycle state
      const stateMachine = this.stateMachineRegistry.getStateMachine(pluginId);
      const lifecycleState = stateMachine.getCurrentState();

      // Get health status
      const healthStatus = this.healthMonitor.getPluginHealthStatus(pluginId);
      const overallHealthStatus = healthStatus?.overallStatus || 'unknown';

      // Get configuration version
      const configHistory = this.configurationManager.getConfigurationHistory(pluginId, env, tenant, 1);
      const configVersion = configHistory[0]?.versionId || 'unknown';

      // Get services
      const services = await this.serviceDiscovery.getPluginServices(pluginId);

      // Get active deployment
      const activeDeployment = this.deploymentStrategyManager.getActiveDeployment(pluginId, env, tenant);

      return {
        pluginId,
        lifecycleState,
        deploymentStatus: activeDeployment?.status,
        healthStatus: overallHealthStatus,
        configurationVersion: configVersion,
        services,
        lastUpdated: new Date(),
        metadata: {
          environment: env,
          tenantId: tenant,
          activeDeployment: activeDeployment?.deploymentId,
          serviceCount: services.length,
          healthyServiceCount: services.filter(s => s.status === 'healthy').length
        }
      };

    } catch (error) {
      throw new Error(`Failed to get plugin status: ${error}`);
    }
  }

  /**
   * Get all plugin statuses
   */
  async getAllPluginStatuses(environment?: string, tenantId?: string): Promise<PluginStatus[]> {
    const allPluginStates = this.stateMachineRegistry.getStateSummary();
    const statuses: PluginStatus[] = [];

    for (const pluginId of Object.keys(allPluginStates)) {
      try {
        const status = await this.getPluginStatus(pluginId, environment, tenantId);
        statuses.push(status);
      } catch (error) {
        // Log error but continue with other plugins
        this.emit('statusRetrievalError', { pluginId, error });
      }
    }

    return statuses;
  }

  /**
   * Get system-wide metrics
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    const orchestrationStats = this.orchestrator.getStatistics();
    const serviceDiscoveryStats = this.serviceDiscovery.getStatistics();
    const healthMonitorStats = this.healthMonitor.getStatistics();
    const configurationStats = this.configurationManager.getStatistics();
    const deploymentStats = this.deploymentStrategyManager.getStatistics();

    return {
      orchestration: {
        totalOperations: orchestrationStats.totalOperations,
        activeOperations: orchestrationStats.activeOperations,
        successfulOperations: orchestrationStats.successfulOperations,
        failedOperations: orchestrationStats.failedOperations,
        averageOperationDuration: orchestrationStats.averageOperationDuration
      },
      serviceDiscovery: {
        totalServices: serviceDiscoveryStats.totalServices,
        healthyServices: serviceDiscoveryStats.healthyServices,
        unhealthyServices: serviceDiscoveryStats.unhealthyServices,
        averageResponseTime: serviceDiscoveryStats.averageResponseTime,
        errorRate: serviceDiscoveryStats.errorRate
      },
      healthMonitoring: {
        totalPlugins: healthMonitorStats.totalPlugins,
        healthyPlugins: healthMonitorStats.healthyPlugins,
        unhealthyPlugins: healthMonitorStats.unhealthyPlugins,
        activeChecks: healthMonitorStats.activeChecks,
        circuitBreakersOpen: healthMonitorStats.circuitBreakersOpen
      },
      configuration: {
        totalConfigurations: configurationStats.totalConfigurations,
        totalVersions: configurationStats.totalVersions,
        totalSecrets: configurationStats.totalSecrets,
        totalWatchers: configurationStats.totalWatchers
      },
      deployment: {
        activeDeployments: deploymentStats.activeDeployments,
        deploymentsToday: deploymentStats.deploymentsToday,
        successRate: deploymentStats.successRate,
        rollbackRate: deploymentStats.rollbackRate
      }
    };
  }

  // UTILITY METHODS

  /**
   * Create default health probes for a service
   */
  private createDefaultHealthProbes(service: ServiceInstance): HealthProbeConfig[] {
    // Implementation would create appropriate health probes based on service type
    return [];
  }

  /**
   * Log audit event
   */
  private logAuditEvent(event: any): void {
    // Implementation would log to audit system
    console.log(`[AUDIT] ${new Date().toISOString()}:`, event);
  }

  /**
   * Collect system metrics
   */
  private collectSystemMetrics(): void {
    this.getSystemMetrics()
      .then(metrics => {
        this.emit('systemMetricsCollected', metrics);
      })
      .catch(error => {
        this.emit('metricsCollectionError', error);
      });
  }

  /**
   * Graceful shutdown of the entire orchestration system
   */
  async shutdown(): Promise<void> {
    this.emit('systemShuttingDown');

    try {
      // Shutdown all components in reverse order of dependency
      await this.deploymentStrategyManager.shutdown();
      await this.healthMonitor.shutdown();
      await this.configurationManager.shutdown();
      await this.serviceDiscovery.shutdown();
      await this.orchestrator.shutdown();

      this.stateMachineRegistry.destroy();

      this.emit('systemShutdown');
    } catch (error) {
      this.emit('shutdownError', error);
      throw error;
    }
  }

  // Getters for direct component access (if needed)
  get components() {
    return {
      orchestrator: this.orchestrator,
      serviceDiscovery: this.serviceDiscovery,
      healthMonitor: this.healthMonitor,
      configurationManager: this.configurationManager,
      deploymentStrategyManager: this.deploymentStrategyManager,
      stateMachineRegistry: this.stateMachineRegistry
    };
  }
}

// Export singleton instance
let orchestrationSystemInstance: PluginLifecycleOrchestrationSystem | null = null;

export function getPluginLifecycleOrchestrationSystem(
  config?: OrchestrationSystemConfig
): PluginLifecycleOrchestrationSystem {
  if (!orchestrationSystemInstance) {
    orchestrationSystemInstance = new PluginLifecycleOrchestrationSystem(config);
  }
  return orchestrationSystemInstance;
}

// Export commonly used types and enums for convenience
export {
  DeploymentStrategy,
  PluginLifecycleState,
  PluginLifecycleEvent,
  type PluginStatus,
  type SystemMetrics,
  type OrchestrationSystemConfig
};