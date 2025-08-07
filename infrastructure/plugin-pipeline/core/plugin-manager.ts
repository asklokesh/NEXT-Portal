/**
 * Plugin Installation Pipeline Manager
 * 
 * Core service for orchestrating plugin installations, updates, and lifecycle management
 * Following Spotify's Portal architecture patterns for enterprise-grade plugin orchestration
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { 
  PluginDefinition, 
  PluginInstallationStatus, 
  DeploymentStrategy,
  HealthStatus,
  PluginRegistry,
  SecurityScanResult
} from '../types/plugin-types';
import { KubernetesOrchestrator } from './kubernetes-orchestrator';
import { DockerImageBuilder } from './docker-builder';
import { SecurityScanner } from './security-scanner';
import { ServiceMeshManager } from './service-mesh-manager';
import { MonitoringCollector } from './monitoring-collector';

export class PluginManager extends EventEmitter {
  private logger: Logger;
  private kubernetesOrchestrator: KubernetesOrchestrator;
  private dockerBuilder: DockerImageBuilder;
  private securityScanner: SecurityScanner;
  private serviceMesh: ServiceMeshManager;
  private monitoring: MonitoringCollector;
  private pluginRegistry: Map<string, PluginDefinition> = new Map();
  private installationQueue: Array<{
    plugin: PluginDefinition;
    strategy: DeploymentStrategy;
    priority: number;
  }> = [];

  constructor(
    logger: Logger,
    kubernetesOrchestrator: KubernetesOrchestrator,
    dockerBuilder: DockerImageBuilder,
    securityScanner: SecurityScanner,
    serviceMesh: ServiceMeshManager,
    monitoring: MonitoringCollector
  ) {
    super();
    this.logger = logger;
    this.kubernetesOrchestrator = kubernetesOrchestrator;
    this.dockerBuilder = dockerBuilder;
    this.securityScanner = securityScanner;
    this.serviceMesh = serviceMesh;
    this.monitoring = monitoring;

    this.setupEventHandlers();
  }

  /**
   * Install a plugin with the specified deployment strategy
   */
  async installPlugin(
    pluginDefinition: PluginDefinition, 
    strategy: DeploymentStrategy = DeploymentStrategy.ROLLING_UPDATE,
    options: {
      skipSecurityScan?: boolean;
      skipDependencyCheck?: boolean;
      priority?: number;
    } = {}
  ): Promise<PluginInstallationStatus> {
    const installationId = this.generateInstallationId(pluginDefinition);
    this.logger.info(`Starting plugin installation: ${pluginDefinition.name}@${pluginDefinition.version}`, {
      installationId,
      strategy,
      options
    });

    try {
      // Step 1: Security and compatibility validation
      if (!options.skipSecurityScan) {
        await this.performSecurityValidation(pluginDefinition);
      }

      if (!options.skipDependencyCheck) {
        await this.validateDependencies(pluginDefinition);
      }

      // Step 2: Queue installation with priority
      const queueItem = {
        plugin: pluginDefinition,
        strategy,
        priority: options.priority || 0
      };
      
      this.installationQueue.push(queueItem);
      this.installationQueue.sort((a, b) => b.priority - a.priority);

      // Step 3: Process installation
      const status = await this.processInstallation(pluginDefinition, strategy, installationId);
      
      this.emit('plugin-installed', { pluginDefinition, status, installationId });
      return status;

    } catch (error) {
      this.logger.error(`Plugin installation failed: ${error.message}`, {
        installationId,
        plugin: pluginDefinition.name,
        error: error.stack
      });
      
      const failureStatus: PluginInstallationStatus = {
        installationId,
        pluginName: pluginDefinition.name,
        version: pluginDefinition.version,
        status: 'failed',
        error: error.message,
        timestamp: new Date(),
        deploymentInfo: null
      };

      this.emit('plugin-installation-failed', { pluginDefinition, error, installationId });
      return failureStatus;
    }
  }

  /**
   * Update an existing plugin to a new version
   */
  async updatePlugin(
    pluginName: string,
    newVersion: string,
    strategy: DeploymentStrategy = DeploymentStrategy.CANARY
  ): Promise<PluginInstallationStatus> {
    const existingPlugin = this.pluginRegistry.get(pluginName);
    if (!existingPlugin) {
      throw new Error(`Plugin ${pluginName} not found in registry`);
    }

    const updatedDefinition: PluginDefinition = {
      ...existingPlugin,
      version: newVersion
    };

    this.logger.info(`Updating plugin ${pluginName} from ${existingPlugin.version} to ${newVersion}`, {
      strategy
    });

    return this.installPlugin(updatedDefinition, strategy);
  }

  /**
   * Remove a plugin and all its resources
   */
  async uninstallPlugin(pluginName: string): Promise<void> {
    const plugin = this.pluginRegistry.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin ${pluginName} not found`);
    }

    this.logger.info(`Uninstalling plugin: ${pluginName}`);

    try {
      // Remove from Kubernetes
      await this.kubernetesOrchestrator.removePluginDeployment(plugin);
      
      // Remove from service mesh
      await this.serviceMesh.removeServiceConfiguration(plugin);
      
      // Clean up monitoring
      await this.monitoring.removePluginMetrics(plugin);
      
      // Remove from registry
      this.pluginRegistry.delete(pluginName);
      
      this.emit('plugin-uninstalled', { plugin });
      this.logger.info(`Plugin ${pluginName} successfully uninstalled`);
      
    } catch (error) {
      this.logger.error(`Failed to uninstall plugin ${pluginName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get the health status of all plugins
   */
  async getPluginHealthStatus(): Promise<Map<string, HealthStatus>> {
    const healthStatuses = new Map<string, HealthStatus>();
    
    for (const [name, plugin] of this.pluginRegistry) {
      try {
        const health = await this.kubernetesOrchestrator.getPluginHealth(plugin);
        healthStatuses.set(name, health);
      } catch (error) {
        healthStatuses.set(name, {
          status: 'unhealthy',
          message: error.message,
          timestamp: new Date()
        });
      }
    }
    
    return healthStatuses;
  }

  /**
   * List all installed plugins with their status
   */
  getInstalledPlugins(): PluginRegistry[] {
    return Array.from(this.pluginRegistry.values()).map(plugin => ({
      ...plugin,
      installationStatus: 'installed', // This would be fetched from actual state
      healthStatus: 'healthy' // This would be fetched from monitoring
    }));
  }

  /**
   * Process the installation queue
   */
  private async processInstallation(
    pluginDefinition: PluginDefinition,
    strategy: DeploymentStrategy,
    installationId: string
  ): Promise<PluginInstallationStatus> {
    const startTime = Date.now();
    
    try {
      // Step 1: Build Docker image
      this.logger.info(`Building Docker image for ${pluginDefinition.name}`);
      const imageInfo = await this.dockerBuilder.buildPluginImage(pluginDefinition);
      
      // Step 2: Deploy to Kubernetes
      this.logger.info(`Deploying ${pluginDefinition.name} using strategy: ${strategy}`);
      const deploymentInfo = await this.kubernetesOrchestrator.deployPlugin(
        pluginDefinition, 
        imageInfo, 
        strategy
      );
      
      // Step 3: Configure service mesh
      await this.serviceMesh.configurePlugin(pluginDefinition, deploymentInfo);
      
      // Step 4: Set up monitoring
      await this.monitoring.setupPluginMetrics(pluginDefinition, deploymentInfo);
      
      // Step 5: Verify deployment
      await this.verifyDeployment(pluginDefinition, deploymentInfo);
      
      // Step 6: Register plugin
      this.pluginRegistry.set(pluginDefinition.name, pluginDefinition);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      const status: PluginInstallationStatus = {
        installationId,
        pluginName: pluginDefinition.name,
        version: pluginDefinition.version,
        status: 'installed',
        deploymentInfo,
        timestamp: new Date(),
        installationDuration: duration
      };
      
      this.logger.info(`Plugin ${pluginDefinition.name} successfully installed`, {
        duration: `${duration}ms`,
        deploymentInfo
      });
      
      return status;
      
    } catch (error) {
      // Rollback on failure
      await this.performRollback(pluginDefinition, installationId);
      throw error;
    }
  }

  /**
   * Perform security validation on plugin
   */
  private async performSecurityValidation(pluginDefinition: PluginDefinition): Promise<void> {
    this.logger.info(`Performing security scan for ${pluginDefinition.name}`);
    
    const scanResult: SecurityScanResult = await this.securityScanner.scanPlugin(pluginDefinition);
    
    if (scanResult.hasVulnerabilities && scanResult.severity === 'high') {
      throw new Error(`Security scan failed: High severity vulnerabilities found in ${pluginDefinition.name}`);
    }
    
    if (scanResult.hasVulnerabilities && scanResult.severity === 'medium') {
      this.logger.warn(`Medium severity vulnerabilities found in ${pluginDefinition.name}`, scanResult);
    }
  }

  /**
   * Validate plugin dependencies
   */
  private async validateDependencies(pluginDefinition: PluginDefinition): Promise<void> {
    this.logger.info(`Validating dependencies for ${pluginDefinition.name}`);
    
    for (const dependency of pluginDefinition.dependencies || []) {
      const dependencyPlugin = this.pluginRegistry.get(dependency.name);
      
      if (!dependencyPlugin) {
        throw new Error(`Missing dependency: ${dependency.name} required by ${pluginDefinition.name}`);
      }
      
      if (!this.isVersionCompatible(dependencyPlugin.version, dependency.version)) {
        throw new Error(
          `Version conflict: ${pluginDefinition.name} requires ${dependency.name}@${dependency.version}, ` +
          `but ${dependencyPlugin.version} is installed`
        );
      }
    }
  }

  /**
   * Verify deployment health and readiness
   */
  private async verifyDeployment(
    pluginDefinition: PluginDefinition,
    deploymentInfo: any
  ): Promise<void> {
    this.logger.info(`Verifying deployment for ${pluginDefinition.name}`);
    
    const maxAttempts = 30;
    const interval = 10000; // 10 seconds
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const health = await this.kubernetesOrchestrator.getPluginHealth(pluginDefinition);
        
        if (health.status === 'healthy') {
          this.logger.info(`Plugin ${pluginDefinition.name} is healthy and ready`);
          return;
        }
        
        if (attempt === maxAttempts) {
          throw new Error(`Plugin ${pluginDefinition.name} failed to become healthy after ${maxAttempts} attempts`);
        }
        
        this.logger.info(`Waiting for plugin ${pluginDefinition.name} to become healthy (attempt ${attempt}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, interval));
        
      } catch (error) {
        if (attempt === maxAttempts) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
  }

  /**
   * Perform rollback on installation failure
   */
  private async performRollback(pluginDefinition: PluginDefinition, installationId: string): Promise<void> {
    this.logger.warn(`Performing rollback for ${pluginDefinition.name}`, { installationId });
    
    try {
      // Remove any partial Kubernetes resources
      await this.kubernetesOrchestrator.cleanupFailedDeployment(pluginDefinition);
      
      // Remove service mesh configuration
      await this.serviceMesh.removeServiceConfiguration(pluginDefinition);
      
      // Clean up monitoring
      await this.monitoring.removePluginMetrics(pluginDefinition);
      
    } catch (rollbackError) {
      this.logger.error(`Rollback failed for ${pluginDefinition.name}: ${rollbackError.message}`);
    }
  }

  /**
   * Set up event handlers for internal coordination
   */
  private setupEventHandlers(): void {
    this.on('plugin-health-check-failed', async ({ plugin, error }) => {
      this.logger.error(`Health check failed for plugin ${plugin.name}: ${error.message}`);
      // Implement auto-recovery logic here
    });

    this.on('plugin-resource-limit-exceeded', async ({ plugin, resourceType, usage }) => {
      this.logger.warn(`Resource limit exceeded for plugin ${plugin.name}`, { resourceType, usage });
      // Implement auto-scaling logic here
    });
  }

  /**
   * Generate unique installation ID
   */
  private generateInstallationId(pluginDefinition: PluginDefinition): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${pluginDefinition.name}-${pluginDefinition.version}-${timestamp}-${random}`;
  }

  /**
   * Check if version is compatible
   */
  private isVersionCompatible(installed: string, required: string): boolean {
    // Implement semver compatibility check
    return installed === required; // Simplified for now
  }
}