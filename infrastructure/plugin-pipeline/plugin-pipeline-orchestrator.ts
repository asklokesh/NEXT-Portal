/**
 * Plugin Installation Pipeline Orchestrator
 * 
 * Main orchestration service that coordinates all plugin pipeline components
 * for production-ready plugin management following Spotify's Portal architecture
 */

import { EventEmitter } from 'events';
import { Logger, createLogger, format, transports } from 'winston';
import * as k8s from '@kubernetes/client-node';
import { PluginManager } from './core/plugin-manager';
import { KubernetesOrchestrator } from './core/kubernetes-orchestrator';
import { DockerImageBuilder } from './core/docker-builder';
import { SecurityScanner } from './core/security-scanner';
import { ServiceMeshManager } from './core/service-mesh-manager';
import { MonitoringCollector } from './core/monitoring-collector';
import { PluginRegistry } from './core/plugin-registry';
import { 
  PluginDefinition, 
  DeploymentStrategy, 
  PluginInstallationStatus 
} from './types/plugin-types';

export interface PipelineConfig {
  kubernetes: {
    kubeconfig?: string;
    inCluster?: boolean;
    defaultNamespace?: string;
  };
  docker: {
    registryUrl: string;
    buildTimeout?: number;
    maxConcurrentBuilds?: number;
  };
  serviceMesh: {
    provider: 'istio' | 'linkerd' | 'consul-connect';
    config: any;
  };
  monitoring: {
    prometheus: {
      enabled: boolean;
      scrapeInterval: string;
      retentionTime: string;
    };
    tracing: {
      enabled: boolean;
      provider: 'jaeger' | 'zipkin' | 'opentelemetry';
      endpoint: string;
      samplingRate: number;
    };
    logging: {
      enabled: boolean;
      provider: 'elasticsearch' | 'loki' | 'fluentd';
      endpoint: string;
      retentionDays: number;
    };
    alerting: {
      enabled: boolean;
      provider: 'alertmanager' | 'slack' | 'pagerduty';
      channels: any[];
    };
  };
  security: {
    scanners: {
      trivy?: { enabled: boolean; timeout: string };
      snyk?: { enabled: boolean; token: string };
      clair?: { enabled: boolean; endpoint: string };
    };
    policies: any[];
    thresholds: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    compliance: {
      frameworks: string[];
    };
  };
  registry: {
    registries: any[];
    caching: {
      enabled: boolean;
      ttl: number;
      maxSize: number;
    };
    validation: {
      schemaValidation: boolean;
      securityScanning: boolean;
      compatibilityChecks: boolean;
    };
  };
  pipeline: {
    maxConcurrentInstallations: number;
    defaultStrategy: DeploymentStrategy;
    retryPolicy: {
      maxRetries: number;
      backoffMultiplier: number;
      maxBackoffTime: number;
    };
    timeouts: {
      installation: number;
      healthCheck: number;
      rollback: number;
    };
  };
}

export interface PipelineMetrics {
  totalPlugins: number;
  installedPlugins: number;
  failedPlugins: number;
  pendingInstallations: number;
  averageInstallationTime: number;
  successRate: number;
  securityScanResults: {
    passed: number;
    failed: number;
    warnings: number;
  };
  resourceUtilization: {
    cpu: number;
    memory: number;
    storage: number;
  };
}

export interface PipelineStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    kubernetes: 'healthy' | 'unhealthy';
    docker: 'healthy' | 'unhealthy';
    serviceMesh: 'healthy' | 'unhealthy';
    monitoring: 'healthy' | 'unhealthy';
    security: 'healthy' | 'unhealthy';
    registry: 'healthy' | 'unhealthy';
  };
  metrics: PipelineMetrics;
  lastHealthCheck: Date;
}

export class PluginPipelineOrchestrator extends EventEmitter {
  private logger: Logger;
  private config: PipelineConfig;
  private kubeConfig: k8s.KubeConfig;

  // Core components
  private pluginManager: PluginManager;
  private kubernetesOrchestrator: KubernetesOrchestrator;
  private dockerBuilder: DockerImageBuilder;
  private securityScanner: SecurityScanner;
  private serviceMeshManager: ServiceMeshManager;
  private monitoringCollector: MonitoringCollector;
  private pluginRegistry: PluginRegistry;

  // Pipeline state
  private isInitialized = false;
  private healthCheckInterval?: NodeJS.Timeout;
  private metricsCollectionInterval?: NodeJS.Timeout;
  private currentInstallations = new Map<string, PluginInstallationStatus>();
  private installationQueue: Array<{
    plugin: PluginDefinition;
    strategy: DeploymentStrategy;
    options: any;
    resolve: (status: PluginInstallationStatus) => void;
    reject: (error: Error) => void;
  }> = [];

  constructor(config: PipelineConfig) {
    super();
    this.config = config;
    this.logger = this.createLogger();
    this.kubeConfig = new k8s.KubeConfig();
    
    this.initializeKubeConfig();
    this.setupEventHandlers();
  }

  /**
   * Initialize the plugin pipeline orchestrator
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('Pipeline orchestrator already initialized');
      return;
    }

    this.logger.info('Initializing plugin pipeline orchestrator');

    try {
      // Initialize core components
      await this.initializeComponents();

      // Start background processes
      this.startHealthChecks();
      this.startMetricsCollection();
      this.startInstallationProcessor();

      // Perform initial system health check
      const status = await this.getSystemStatus();
      if (status.status === 'unhealthy') {
        throw new Error('System health check failed during initialization');
      }

      this.isInitialized = true;
      this.logger.info('Plugin pipeline orchestrator initialized successfully');
      this.emit('initialized', { status });

    } catch (error) {
      this.logger.error(`Failed to initialize pipeline orchestrator: ${error.message}`);
      this.emit('initialization-failed', { error });
      throw error;
    }
  }

  /**
   * Install a plugin using the pipeline
   */
  async installPlugin(
    pluginDefinition: PluginDefinition,
    strategy: DeploymentStrategy = this.config.pipeline.defaultStrategy,
    options: {
      skipSecurityScan?: boolean;
      skipDependencyCheck?: boolean;
      priority?: number;
      timeout?: number;
    } = {}
  ): Promise<PluginInstallationStatus> {
    this.validateInitialization();
    
    const installationId = this.generateInstallationId(pluginDefinition);
    this.logger.info(`Queuing plugin installation: ${pluginDefinition.name}@${pluginDefinition.version}`, {
      installationId,
      strategy,
      options
    });

    // Check concurrent installation limit
    if (this.currentInstallations.size >= this.config.pipeline.maxConcurrentInstallations) {
      return new Promise((resolve, reject) => {
        this.installationQueue.push({
          plugin: pluginDefinition,
          strategy,
          options,
          resolve,
          reject
        });
        
        this.logger.info(`Installation queued: ${pluginDefinition.name} (queue length: ${this.installationQueue.length})`);
      });
    }

    return this.executeInstallation(pluginDefinition, strategy, options, installationId);
  }

  /**
   * Execute plugin installation
   */
  private async executeInstallation(
    pluginDefinition: PluginDefinition,
    strategy: DeploymentStrategy,
    options: any,
    installationId: string
  ): Promise<PluginInstallationStatus> {
    const timeout = options.timeout || this.config.pipeline.timeouts.installation;
    
    try {
      // Create initial status
      const initialStatus: PluginInstallationStatus = {
        installationId,
        pluginName: pluginDefinition.name,
        version: pluginDefinition.version,
        status: 'pending',
        timestamp: new Date()
      };
      
      this.currentInstallations.set(installationId, initialStatus);
      this.emit('installation-started', { pluginDefinition, installationId });

      // Execute installation with timeout
      const installationPromise = this.pluginManager.installPlugin(
        pluginDefinition,
        strategy,
        options
      );

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Installation timeout after ${timeout}ms`));
        }, timeout);
      });

      const status = await Promise.race([installationPromise, timeoutPromise]);
      
      // Update status
      this.currentInstallations.set(installationId, status);
      this.emit('installation-completed', { pluginDefinition, status });

      return status;

    } catch (error) {
      const failureStatus: PluginInstallationStatus = {
        installationId,
        pluginName: pluginDefinition.name,
        version: pluginDefinition.version,
        status: 'failed',
        error: error.message,
        timestamp: new Date()
      };

      this.currentInstallations.set(installationId, failureStatus);
      this.emit('installation-failed', { pluginDefinition, error, installationId });

      // Attempt retry if configured
      if (options.retryCount === undefined) {
        options.retryCount = 0;
      }

      if (options.retryCount < this.config.pipeline.retryPolicy.maxRetries) {
        options.retryCount++;
        const backoffTime = Math.min(
          1000 * Math.pow(this.config.pipeline.retryPolicy.backoffMultiplier, options.retryCount - 1),
          this.config.pipeline.retryPolicy.maxBackoffTime
        );

        this.logger.info(`Retrying installation after ${backoffTime}ms (attempt ${options.retryCount})`, {
          installationId,
          plugin: pluginDefinition.name
        });

        await new Promise(resolve => setTimeout(resolve, backoffTime));
        return this.executeInstallation(pluginDefinition, strategy, options, installationId);
      }

      throw error;

    } finally {
      // Process next item in queue
      this.processNextInstallation();
    }
  }

  /**
   * Update an existing plugin
   */
  async updatePlugin(
    pluginName: string,
    newVersion: string,
    strategy: DeploymentStrategy = DeploymentStrategy.CANARY
  ): Promise<PluginInstallationStatus> {
    this.validateInitialization();
    
    this.logger.info(`Updating plugin: ${pluginName} to version ${newVersion}`);
    return this.pluginManager.updatePlugin(pluginName, newVersion, strategy);
  }

  /**
   * Uninstall a plugin
   */
  async uninstallPlugin(pluginName: string): Promise<void> {
    this.validateInitialization();
    
    this.logger.info(`Uninstalling plugin: ${pluginName}`);
    await this.pluginManager.uninstallPlugin(pluginName);
    
    // Remove from current installations if present
    const installationsToRemove = Array.from(this.currentInstallations.entries())
      .filter(([_, status]) => status.pluginName === pluginName)
      .map(([id, _]) => id);
    
    installationsToRemove.forEach(id => this.currentInstallations.delete(id));
    
    this.emit('plugin-uninstalled', { pluginName });
  }

  /**
   * Get installation status
   */
  getInstallationStatus(installationId: string): PluginInstallationStatus | null {
    return this.currentInstallations.get(installationId) || null;
  }

  /**
   * List all installed plugins
   */
  async getInstalledPlugins(): Promise<any[]> {
    this.validateInitialization();
    return this.pluginManager.getInstalledPlugins();
  }

  /**
   * Get system health status
   */
  async getSystemStatus(): Promise<PipelineStatus> {
    const components = {
      kubernetes: await this.checkKubernetesHealth(),
      docker: await this.checkDockerHealth(),
      serviceMesh: await this.checkServiceMeshHealth(),
      monitoring: await this.checkMonitoringHealth(),
      security: await this.checkSecurityHealth(),
      registry: await this.checkRegistryHealth()
    };

    const healthyComponents = Object.values(components).filter(status => status === 'healthy').length;
    const totalComponents = Object.keys(components).length;
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyComponents === totalComponents) {
      overallStatus = 'healthy';
    } else if (healthyComponents >= totalComponents * 0.5) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'unhealthy';
    }

    const metrics = await this.collectPipelineMetrics();

    return {
      status: overallStatus,
      components,
      metrics,
      lastHealthCheck: new Date()
    };
  }

  /**
   * Get pipeline metrics
   */
  async getPipelineMetrics(): Promise<PipelineMetrics> {
    return this.collectPipelineMetrics();
  }

  /**
   * Perform pipeline maintenance
   */
  async performMaintenance(): Promise<void> {
    this.logger.info('Starting pipeline maintenance');
    
    try {
      // Clean up completed installations older than 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const toRemove = Array.from(this.currentInstallations.entries())
        .filter(([_, status]) => 
          status.timestamp < oneDayAgo && 
          (status.status === 'installed' || status.status === 'failed')
        )
        .map(([id, _]) => id);
      
      toRemove.forEach(id => this.currentInstallations.delete(id));
      
      // Trigger registry scan
      await this.pluginRegistry.scanRegistries();
      
      // Clean up unused Docker images
      await this.dockerBuilder.clearCache();
      
      this.logger.info(`Maintenance completed: cleaned up ${toRemove.length} old installations`);
      this.emit('maintenance-completed', { cleanedUpCount: toRemove.length });
      
    } catch (error) {
      this.logger.error(`Maintenance failed: ${error.message}`);
      this.emit('maintenance-failed', { error });
    }
  }

  /**
   * Shutdown the pipeline orchestrator
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down plugin pipeline orchestrator');
    
    try {
      // Stop background processes
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }
      
      if (this.metricsCollectionInterval) {
        clearInterval(this.metricsCollectionInterval);
      }

      // Wait for ongoing installations to complete or timeout
      const shutdownTimeout = 60000; // 1 minute
      const startTime = Date.now();
      
      while (this.currentInstallations.size > 0 && (Date.now() - startTime) < shutdownTimeout) {
        this.logger.info(`Waiting for ${this.currentInstallations.size} installations to complete...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      // Clean up components
      this.pluginRegistry.destroy();
      this.dockerBuilder.clearCache();

      this.isInitialized = false;
      this.logger.info('Plugin pipeline orchestrator shut down successfully');
      this.emit('shutdown');

    } catch (error) {
      this.logger.error(`Shutdown failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Initialize core components
   */
  private async initializeComponents(): Promise<void> {
    this.logger.info('Initializing core components');

    // Initialize security scanner
    this.securityScanner = new SecurityScanner(this.logger, this.config.security);

    // Initialize Docker builder
    this.dockerBuilder = new DockerImageBuilder(this.logger, this.config.docker.registryUrl);

    // Initialize Kubernetes orchestrator
    this.kubernetesOrchestrator = new KubernetesOrchestrator(this.logger, {
      kubeconfig: this.config.kubernetes.kubeconfig,
      inCluster: this.config.kubernetes.inCluster,
      defaultNamespace: this.config.kubernetes.defaultNamespace
    });

    // Initialize service mesh manager
    this.serviceMeshManager = new ServiceMeshManager(
      this.logger,
      this.config.serviceMesh,
      this.kubeConfig
    );

    // Initialize monitoring collector
    this.monitoringCollector = new MonitoringCollector(
      this.logger,
      this.config.monitoring,
      this.kubeConfig
    );

    // Initialize plugin registry
    this.pluginRegistry = new PluginRegistry(
      this.logger,
      this.config.registry,
      this.securityScanner
    );

    // Initialize plugin manager (orchestrates all components)
    this.pluginManager = new PluginManager(
      this.logger,
      this.kubernetesOrchestrator,
      this.dockerBuilder,
      this.securityScanner,
      this.serviceMeshManager,
      this.monitoringCollector
    );

    this.logger.info('Core components initialized successfully');
  }

  /**
   * Initialize Kubernetes configuration
   */
  private initializeKubeConfig(): void {
    if (this.config.kubernetes.inCluster) {
      this.kubeConfig.loadFromCluster();
    } else if (this.config.kubernetes.kubeconfig) {
      this.kubeConfig.loadFromFile(this.config.kubernetes.kubeconfig);
    } else {
      this.kubeConfig.loadFromDefault();
    }
  }

  /**
   * Set up event handlers for component coordination
   */
  private setupEventHandlers(): void {
    // Plugin manager events
    this.pluginManager.on('plugin-installed', (data) => {
      this.emit('plugin-installed', data);
    });

    this.pluginManager.on('plugin-installation-failed', (data) => {
      this.emit('plugin-installation-failed', data);
    });

    // Registry events
    this.pluginRegistry.on('registries-scanned', (data) => {
      this.emit('registries-scanned', data);
    });

    // Monitoring events
    this.monitoringCollector.on('monitoring-setup-complete', (data) => {
      this.emit('monitoring-setup-complete', data);
    });
  }

  /**
   * Start health check monitoring
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const status = await this.getSystemStatus();
        this.emit('health-check-completed', status);
        
        if (status.status === 'unhealthy') {
          this.logger.error('System health check failed', { status });
          this.emit('system-unhealthy', status);
        }
      } catch (error) {
        this.logger.error(`Health check failed: ${error.message}`);
      }
    }, 60000); // Every minute
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsCollectionInterval = setInterval(async () => {
      try {
        const metrics = await this.collectPipelineMetrics();
        this.emit('metrics-collected', metrics);
      } catch (error) {
        this.logger.error(`Metrics collection failed: ${error.message}`);
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Start installation queue processor
   */
  private startInstallationProcessor(): void {
    this.processNextInstallation();
  }

  /**
   * Process next installation from queue
   */
  private async processNextInstallation(): Promise<void> {
    if (this.installationQueue.length === 0) {
      return;
    }

    if (this.currentInstallations.size >= this.config.pipeline.maxConcurrentInstallations) {
      return;
    }

    const nextInstallation = this.installationQueue.shift();
    if (!nextInstallation) {
      return;
    }

    const installationId = this.generateInstallationId(nextInstallation.plugin);
    
    try {
      const status = await this.executeInstallation(
        nextInstallation.plugin,
        nextInstallation.strategy,
        nextInstallation.options,
        installationId
      );
      nextInstallation.resolve(status);
    } catch (error) {
      nextInstallation.reject(error);
    }
  }

  /**
   * Health check methods for each component
   */
  private async checkKubernetesHealth(): Promise<'healthy' | 'unhealthy'> {
    try {
      await this.kubernetesOrchestrator.getPluginHealthStatus();
      return 'healthy';
    } catch {
      return 'unhealthy';
    }
  }

  private async checkDockerHealth(): Promise<'healthy' | 'unhealthy'> {
    // Docker health check implementation
    return 'healthy';
  }

  private async checkServiceMeshHealth(): Promise<'healthy' | 'unhealthy'> {
    // Service mesh health check implementation
    return 'healthy';
  }

  private async checkMonitoringHealth(): Promise<'healthy' | 'unhealthy'> {
    // Monitoring health check implementation
    return 'healthy';
  }

  private async checkSecurityHealth(): Promise<'healthy' | 'unhealthy'> {
    // Security health check implementation
    return 'healthy';
  }

  private async checkRegistryHealth(): Promise<'healthy' | 'unhealthy'> {
    // Registry health check implementation
    return 'healthy';
  }

  /**
   * Collect pipeline metrics
   */
  private async collectPipelineMetrics(): Promise<PipelineMetrics> {
    const installedPlugins = await this.pluginManager.getInstalledPlugins();
    const healthStatuses = await this.pluginManager.getPluginHealthStatus();
    
    const totalPlugins = installedPlugins.length;
    const healthyPlugins = Array.from(healthStatuses.values())
      .filter(status => status.status === 'healthy').length;
    const failedPlugins = totalPlugins - healthyPlugins;
    
    const completedInstallations = Array.from(this.currentInstallations.values())
      .filter(status => status.status === 'installed');
    
    const averageInstallationTime = completedInstallations.length > 0 ?
      completedInstallations.reduce((sum, status) => 
        sum + (status.installationDuration || 0), 0) / completedInstallations.length : 0;

    return {
      totalPlugins,
      installedPlugins: healthyPlugins,
      failedPlugins,
      pendingInstallations: this.currentInstallations.size,
      averageInstallationTime,
      successRate: totalPlugins > 0 ? (healthyPlugins / totalPlugins) * 100 : 100,
      securityScanResults: {
        passed: 0, // Would be calculated from security scan history
        failed: 0,
        warnings: 0
      },
      resourceUtilization: {
        cpu: 0, // Would be fetched from monitoring
        memory: 0,
        storage: 0
      }
    };
  }

  /**
   * Create Winston logger
   */
  private createLogger(): Logger {
    return createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json()
      ),
      defaultMeta: { service: 'plugin-pipeline-orchestrator' },
      transports: [
        new transports.Console({
          format: format.combine(
            format.colorize(),
            format.simple()
          )
        }),
        new transports.File({ 
          filename: 'logs/plugin-pipeline-error.log', 
          level: 'error' 
        }),
        new transports.File({ 
          filename: 'logs/plugin-pipeline.log' 
        })
      ]
    });
  }

  /**
   * Helper methods
   */
  private validateInitialization(): void {
    if (!this.isInitialized) {
      throw new Error('Pipeline orchestrator not initialized. Call initialize() first.');
    }
  }

  private generateInstallationId(pluginDefinition: PluginDefinition): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `install-${pluginDefinition.name}-${timestamp}-${random}`;
  }
}