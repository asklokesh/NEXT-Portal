/**
 * Zero-Downtime Plugin Deployment Strategies
 * Enterprise-grade deployment orchestration with blue-green, canary, and rolling update strategies
 * Includes traffic management, health validation, and automatic rollback capabilities
 */

import { EventEmitter } from 'events';
import { z } from 'zod';
import { 
  getPluginServiceDiscovery, 
  ServiceInstance, 
  ServiceRegistration, 
  LoadBalancingStrategy 
} from './plugin-service-discovery';
import { 
  getPluginHealthMonitor, 
  ProbeType, 
  HealthCheckResult 
} from './plugin-health-monitor';
import { 
  pluginStateMachineRegistry, 
  PluginLifecycleEvent, 
  PluginLifecycleState 
} from './plugin-lifecycle-state-machine';

// Deployment strategy types
export enum DeploymentStrategy {
  BLUE_GREEN = 'blue_green',
  CANARY = 'canary',
  ROLLING_UPDATE = 'rolling_update',
  RECREATE = 'recreate',
  A_B_TEST = 'a_b_test'
}

// Deployment configuration schema
export const DeploymentConfigSchema = z.object({
  strategy: z.nativeEnum(DeploymentStrategy),
  pluginId: z.string(),
  version: z.string(),
  environment: z.enum(['development', 'staging', 'production']),
  tenantId: z.string().optional(),
  
  // Blue-Green deployment configuration
  blueGreen: z.object({
    switchTrafficPercentage: z.number().default(100),
    warmupDuration: z.number().default(30000), // 30 seconds
    verificationDuration: z.number().default(300000), // 5 minutes
    automaticSwitch: z.boolean().default(false)
  }).optional(),
  
  // Canary deployment configuration
  canary: z.object({
    trafficIncrement: z.number().default(10), // percentage
    incrementInterval: z.number().default(300000), // 5 minutes
    maxTrafficPercentage: z.number().default(100),
    successThreshold: z.number().default(95), // success rate percentage
    errorThreshold: z.number().default(5), // error rate percentage
    minObservationPeriod: z.number().default(600000), // 10 minutes
    autoPromote: z.boolean().default(false)
  }).optional(),
  
  // Rolling update configuration
  rollingUpdate: z.object({
    maxUnavailable: z.union([z.number(), z.string()]).default('25%'),
    maxSurge: z.union([z.number(), z.string()]).default('25%'),
    batchSize: z.number().default(1),
    updateInterval: z.number().default(30000), // 30 seconds
    progressDeadline: z.number().default(600000) // 10 minutes
  }).optional(),
  
  // A/B test configuration
  abTest: z.object({
    trafficSplit: z.record(z.number()),
    testDuration: z.number().default(3600000), // 1 hour
    significanceThreshold: z.number().default(0.05),
    minimumSampleSize: z.number().default(1000)
  }).optional(),
  
  // Health validation configuration
  healthValidation: z.object({
    enabled: z.boolean().default(true),
    healthCheckTimeout: z.number().default(300000), // 5 minutes
    requiredHealthChecks: z.array(z.nativeEnum(ProbeType)).default([ProbeType.READINESS, ProbeType.LIVENESS]),
    maxUnhealthyInstances: z.number().default(0)
  }),
  
  // Traffic management
  trafficManagement: z.object({
    loadBalancingStrategy: z.nativeEnum(LoadBalancingStrategy).default(LoadBalancingStrategy.ROUND_ROBIN),
    sessionAffinity: z.boolean().default(false),
    drainTimeout: z.number().default(30000) // 30 seconds
  }),
  
  // Rollback configuration
  rollback: z.object({
    enabled: z.boolean().default(true),
    automaticRollback: z.boolean().default(true),
    rollbackTriggers: z.object({
      healthCheckFailure: z.boolean().default(true),
      errorRateThreshold: z.number().default(10), // percentage
      responseTimeThreshold: z.number().default(5000), // milliseconds
      customMetricThresholds: z.record(z.number()).optional()
    }),
    rollbackTimeout: z.number().default(300000) // 5 minutes
  }),
  
  // Deployment metadata
  metadata: z.record(z.any()).optional(),
  approvals: z.object({
    required: z.boolean().default(false),
    approvers: z.array(z.string()).default([]),
    timeout: z.number().default(3600000) // 1 hour
  }).optional()
});

export type DeploymentConfig = z.infer<typeof DeploymentConfigSchema>;

// Deployment status
export enum DeploymentStatus {
  PENDING = 'pending',
  PENDING_APPROVAL = 'pending_approval',
  IN_PROGRESS = 'in_progress',
  HEALTH_VALIDATION = 'health_validation',
  TRAFFIC_SHIFTING = 'traffic_shifting',
  MONITORING = 'monitoring',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ROLLING_BACK = 'rolling_back',
  ROLLED_BACK = 'rolled_back',
  CANCELLED = 'cancelled'
}

// Deployment instance
export interface DeploymentInstance {
  deploymentId: string;
  config: DeploymentConfig;
  status: DeploymentStatus;
  currentPhase: string;
  progress: number;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  
  // Version tracking
  oldVersion: string;
  newVersion: string;
  
  // Service instances
  oldInstances: ServiceInstance[];
  newInstances: ServiceInstance[];
  
  // Traffic distribution
  trafficDistribution: {
    oldVersion: number;
    newVersion: number;
  };
  
  // Health metrics
  healthMetrics: {
    oldVersion: HealthMetrics;
    newVersion: HealthMetrics;
  };
  
  // Deployment history
  phases: DeploymentPhase[];
  logs: string[];
  warnings: string[];
  errors: string[];
  
  // Rollback information
  rollbackTrigger?: string;
  rollbackExecuted?: boolean;
}

interface HealthMetrics {
  successRate: number;
  errorRate: number;
  averageResponseTime: number;
  throughput: number;
  instancesHealthy: number;
  instancesTotal: number;
}

interface DeploymentPhase {
  phase: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  logs: string[];
  metrics?: Record<string, number>;
}

/**
 * Plugin Deployment Strategy Manager
 * Orchestrates zero-downtime deployments with multiple strategies
 */
export class PluginDeploymentStrategyManager extends EventEmitter {
  private activeDeployments: Map<string, DeploymentInstance> = new Map();
  private deploymentHistory: Map<string, DeploymentInstance[]> = new Map();
  private trafficRouting: Map<string, TrafficRoute> = new Map();
  private approvalQueue: Map<string, PendingApproval> = new Map();
  private deploymentInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.initializeManager();
  }

  // Initialize deployment manager
  private initializeManager(): void {
    // Start deployment monitoring
    this.startDeploymentMonitoring();

    // Listen to health monitor events
    const healthMonitor = getPluginHealthMonitor();
    healthMonitor.on('healthCheckFailed', (result: HealthCheckResult) => {
      this.handleHealthCheckFailure(result);
    });

    // Listen to service discovery events
    const serviceDiscovery = getPluginServiceDiscovery();
    serviceDiscovery.on('serviceDeregistered', (service: ServiceInstance) => {
      this.handleServiceDeregistration(service);
    });
  }

  // Execute deployment with specified strategy
  async executeDeployment(config: DeploymentConfig): Promise<string> {
    // Validate deployment configuration
    try {
      DeploymentConfigSchema.parse(config);
    } catch (error) {
      throw new Error(`Invalid deployment configuration: ${error}`);
    }

    // Check for existing active deployment
    const existingDeployment = this.getActiveDeployment(config.pluginId, config.environment, config.tenantId);
    if (existingDeployment) {
      throw new Error(`Active deployment already in progress for ${config.pluginId}`);
    }

    // Generate deployment ID
    const deploymentId = this.generateDeploymentId();

    // Get current service instances
    const serviceDiscovery = getPluginServiceDiscovery();
    const currentInstances = await serviceDiscovery.getPluginServices(config.pluginId);

    // Create deployment instance
    const deployment: DeploymentInstance = {
      deploymentId,
      config,
      status: config.approvals?.required ? DeploymentStatus.PENDING_APPROVAL : DeploymentStatus.PENDING,
      currentPhase: 'initialization',
      progress: 0,
      startTime: new Date(),
      oldVersion: this.getCurrentVersion(currentInstances),
      newVersion: config.version,
      oldInstances: currentInstances.filter(s => s.status === 'healthy'),
      newInstances: [],
      trafficDistribution: {
        oldVersion: 100,
        newVersion: 0
      },
      healthMetrics: {
        oldVersion: await this.calculateHealthMetrics(currentInstances),
        newVersion: { successRate: 0, errorRate: 0, averageResponseTime: 0, throughput: 0, instancesHealthy: 0, instancesTotal: 0 }
      },
      phases: [],
      logs: [`Deployment ${deploymentId} created for ${config.pluginId} v${config.version}`],
      warnings: [],
      errors: []
    };

    // Store deployment
    this.activeDeployments.set(deploymentId, deployment);

    // Handle approval process
    if (config.approvals?.required) {
      await this.handleApprovalProcess(deployment);
    } else {
      // Start deployment immediately
      this.startDeploymentExecution(deployment);
    }

    this.emit('deploymentCreated', deployment);
    return deploymentId;
  }

  // Get deployment status
  getDeployment(deploymentId: string): DeploymentInstance | null {
    return this.activeDeployments.get(deploymentId) || null;
  }

  // Get active deployment for plugin
  getActiveDeployment(pluginId: string, environment: string, tenantId?: string): DeploymentInstance | null {
    for (const deployment of this.activeDeployments.values()) {
      if (deployment.config.pluginId === pluginId && 
          deployment.config.environment === environment &&
          deployment.config.tenantId === tenantId &&
          deployment.status !== DeploymentStatus.COMPLETED &&
          deployment.status !== DeploymentStatus.FAILED &&
          deployment.status !== DeploymentStatus.CANCELLED) {
        return deployment;
      }
    }
    return null;
  }

  // Cancel deployment
  async cancelDeployment(deploymentId: string, reason: string): Promise<boolean> {
    const deployment = this.activeDeployments.get(deploymentId);
    if (!deployment) {
      return false;
    }

    // Can only cancel if not completed or failed
    if ([DeploymentStatus.COMPLETED, DeploymentStatus.FAILED, DeploymentStatus.ROLLED_BACK].includes(deployment.status)) {
      return false;
    }

    deployment.status = DeploymentStatus.CANCELLED;
    deployment.logs.push(`Deployment cancelled: ${reason}`);
    deployment.endTime = new Date();
    deployment.duration = deployment.endTime.getTime() - deployment.startTime.getTime();

    // Rollback if necessary
    if (deployment.newInstances.length > 0) {
      await this.executeRollback(deployment, 'cancellation');
    }

    this.emit('deploymentCancelled', { deployment, reason });
    return true;
  }

  // Approve pending deployment
  async approveDeployment(deploymentId: string, approver: string): Promise<boolean> {
    const deployment = this.activeDeployments.get(deploymentId);
    if (!deployment || deployment.status !== DeploymentStatus.PENDING_APPROVAL) {
      return false;
    }

    const pendingApproval = this.approvalQueue.get(deploymentId);
    if (!pendingApproval) {
      return false;
    }

    pendingApproval.approvals.add(approver);
    deployment.logs.push(`Deployment approved by ${approver}`);

    // Check if all required approvals are received
    const requiredApprovers = new Set(deployment.config.approvals?.approvers || []);
    const hasAllApprovals = [...requiredApprovers].every(approver => pendingApproval.approvals.has(approver));

    if (hasAllApprovals) {
      this.approvalQueue.delete(deploymentId);
      deployment.status = DeploymentStatus.PENDING;
      this.startDeploymentExecution(deployment);
      this.emit('deploymentApproved', deployment);
    }

    return true;
  }

  // Start deployment execution based on strategy
  private async startDeploymentExecution(deployment: DeploymentInstance): Promise<void> {
    try {
      deployment.status = DeploymentStatus.IN_PROGRESS;
      deployment.logs.push(`Starting ${deployment.config.strategy} deployment`);

      switch (deployment.config.strategy) {
        case DeploymentStrategy.BLUE_GREEN:
          await this.executeBlueGreenDeployment(deployment);
          break;
        case DeploymentStrategy.CANARY:
          await this.executeCanaryDeployment(deployment);
          break;
        case DeploymentStrategy.ROLLING_UPDATE:
          await this.executeRollingUpdateDeployment(deployment);
          break;
        case DeploymentStrategy.RECREATE:
          await this.executeRecreateDeployment(deployment);
          break;
        case DeploymentStrategy.A_B_TEST:
          await this.executeABTestDeployment(deployment);
          break;
        default:
          throw new Error(`Unsupported deployment strategy: ${deployment.config.strategy}`);
      }

    } catch (error) {
      await this.handleDeploymentFailure(deployment, error as Error);
    }
  }

  // Execute Blue-Green deployment
  private async executeBlueGreenDeployment(deployment: DeploymentInstance): Promise<void> {
    const { blueGreen } = deployment.config;
    if (!blueGreen) {
      throw new Error('Blue-Green configuration is required');
    }

    // Phase 1: Deploy new version (Green)
    await this.executePhase(deployment, 'green_deployment', async () => {
      deployment.logs.push('Deploying new version (Green environment)');
      await this.deployNewInstances(deployment);
    });

    // Phase 2: Warmup period
    await this.executePhase(deployment, 'warmup', async () => {
      deployment.logs.push(`Warming up Green environment for ${blueGreen.warmupDuration}ms`);
      await this.waitWithProgress(deployment, blueGreen.warmupDuration, 'Warming up...');
    });

    // Phase 3: Health validation
    await this.executePhase(deployment, 'health_validation', async () => {
      deployment.status = DeploymentStatus.HEALTH_VALIDATION;
      await this.validateDeploymentHealth(deployment);
    });

    // Phase 4: Traffic switch (if automatic) or wait for manual switch
    if (blueGreen.automaticSwitch) {
      await this.executePhase(deployment, 'traffic_switch', async () => {
        deployment.status = DeploymentStatus.TRAFFIC_SHIFTING;
        await this.switchTraffic(deployment, 0, 100);
      });

      // Phase 5: Verification period
      await this.executePhase(deployment, 'verification', async () => {
        deployment.status = DeploymentStatus.MONITORING;
        await this.monitorDeployment(deployment, blueGreen.verificationDuration);
      });

      // Phase 6: Cleanup old instances
      await this.executePhase(deployment, 'cleanup', async () => {
        await this.cleanupOldInstances(deployment);
      });
    } else {
      // Wait for manual promotion
      deployment.status = DeploymentStatus.MONITORING;
      deployment.logs.push('Deployment ready for manual traffic switch');
    }

    await this.completeDeployment(deployment);
  }

  // Execute Canary deployment
  private async executeCanaryDeployment(deployment: DeploymentInstance): Promise<void> {
    const { canary } = deployment.config;
    if (!canary) {
      throw new Error('Canary configuration is required');
    }

    // Phase 1: Deploy initial canary instances
    await this.executePhase(deployment, 'canary_deployment', async () => {
      deployment.logs.push('Deploying canary instances');
      await this.deployNewInstances(deployment, 1); // Start with 1 instance
    });

    // Phase 2: Health validation
    await this.executePhase(deployment, 'health_validation', async () => {
      deployment.status = DeploymentStatus.HEALTH_VALIDATION;
      await this.validateDeploymentHealth(deployment);
    });

    // Phase 3: Gradual traffic shifting
    let currentTraffic = 0;
    while (currentTraffic < canary.maxTrafficPercentage) {
      const nextTraffic = Math.min(currentTraffic + canary.trafficIncrement, canary.maxTrafficPercentage);
      
      await this.executePhase(deployment, `traffic_shift_${nextTraffic}`, async () => {
        deployment.status = DeploymentStatus.TRAFFIC_SHIFTING;
        await this.switchTraffic(deployment, 100 - nextTraffic, nextTraffic);
        currentTraffic = nextTraffic;
      });

      // Monitor the canary
      await this.executePhase(deployment, `monitor_${nextTraffic}`, async () => {
        deployment.status = DeploymentStatus.MONITORING;
        await this.monitorCanaryMetrics(deployment, canary);
      });

      // Check if we should auto-promote or continue
      if (canary.autoPromote && currentTraffic === canary.maxTrafficPercentage) {
        const metrics = deployment.healthMetrics.newVersion;
        if (metrics.successRate >= canary.successThreshold && metrics.errorRate <= canary.errorThreshold) {
          await this.executePhase(deployment, 'auto_promote', async () => {
            await this.promoteCanaryDeployment(deployment);
          });
          break;
        }
      }

      // Wait before next increment
      if (currentTraffic < canary.maxTrafficPercentage) {
        await this.waitWithProgress(deployment, canary.incrementInterval, `Waiting before next increment...`);
      }
    }

    if (!canary.autoPromote) {
      deployment.status = DeploymentStatus.MONITORING;
      deployment.logs.push('Canary deployment ready for manual promotion');
    } else {
      await this.completeDeployment(deployment);
    }
  }

  // Execute Rolling Update deployment
  private async executeRollingUpdateDeployment(deployment: DeploymentInstance): Promise<void> {
    const { rollingUpdate } = deployment.config;
    if (!rollingUpdate) {
      throw new Error('Rolling update configuration is required');
    }

    const totalInstances = deployment.oldInstances.length;
    const maxUnavailable = this.parseQuantity(rollingUpdate.maxUnavailable, totalInstances);
    const maxSurge = this.parseQuantity(rollingUpdate.maxSurge, totalInstances);
    const batchSize = rollingUpdate.batchSize;

    let processedInstances = 0;
    let newInstancesCreated = 0;

    while (processedInstances < totalInstances) {
      const remainingInstances = totalInstances - processedInstances;
      const currentBatchSize = Math.min(batchSize, remainingInstances);

      await this.executePhase(deployment, `rolling_batch_${Math.ceil(processedInstances / batchSize) + 1}`, async () => {
        // Create new instances if surge allows
        if (newInstancesCreated < maxSurge) {
          const surgeInstances = Math.min(currentBatchSize, maxSurge - newInstancesCreated);
          await this.deployNewInstances(deployment, surgeInstances);
          newInstancesCreated += surgeInstances;
        }

        // Wait for new instances to be healthy
        await this.waitForInstancesHealthy(deployment.newInstances.slice(-currentBatchSize));

        // Remove old instances
        const instancesToRemove = deployment.oldInstances.slice(processedInstances, processedInstances + currentBatchSize);
        await this.drainAndRemoveInstances(instancesToRemove);

        processedInstances += currentBatchSize;
        deployment.progress = (processedInstances / totalInstances) * 100;
      });

      // Wait between batches
      if (processedInstances < totalInstances) {
        await this.waitWithProgress(deployment, rollingUpdate.updateInterval, 'Waiting before next batch...');
      }
    }

    await this.completeDeployment(deployment);
  }

  // Execute Recreate deployment
  private async executeRecreateDeployment(deployment: DeploymentInstance): Promise<void> {
    // Phase 1: Stop all old instances
    await this.executePhase(deployment, 'stop_old_instances', async () => {
      deployment.logs.push('Stopping all old instances');
      await this.stopInstances(deployment.oldInstances);
    });

    // Phase 2: Deploy new instances
    await this.executePhase(deployment, 'deploy_new_instances', async () => {
      deployment.logs.push('Deploying new instances');
      await this.deployNewInstances(deployment);
    });

    // Phase 3: Health validation
    await this.executePhase(deployment, 'health_validation', async () => {
      deployment.status = DeploymentStatus.HEALTH_VALIDATION;
      await this.validateDeploymentHealth(deployment);
    });

    await this.completeDeployment(deployment);
  }

  // Execute A/B Test deployment
  private async executeABTestDeployment(deployment: DeploymentInstance): Promise<void> {
    const { abTest } = deployment.config;
    if (!abTest) {
      throw new Error('A/B test configuration is required');
    }

    // Phase 1: Deploy variant instances
    await this.executePhase(deployment, 'variant_deployment', async () => {
      deployment.logs.push('Deploying A/B test variants');
      await this.deployNewInstances(deployment);
    });

    // Phase 2: Configure traffic split
    await this.executePhase(deployment, 'traffic_split', async () => {
      deployment.status = DeploymentStatus.TRAFFIC_SHIFTING;
      const newVersionTraffic = abTest.trafficSplit['new'] || 50;
      await this.switchTraffic(deployment, 100 - newVersionTraffic, newVersionTraffic);
    });

    // Phase 3: Run test and collect data
    await this.executePhase(deployment, 'ab_test_monitoring', async () => {
      deployment.status = DeploymentStatus.MONITORING;
      await this.monitorABTest(deployment, abTest);
    });

    deployment.logs.push('A/B test completed, ready for manual decision');
    deployment.status = DeploymentStatus.MONITORING;
  }

  // Deploy new instances
  private async deployNewInstances(deployment: DeploymentInstance, instanceCount?: number): Promise<void> {
    const serviceDiscovery = getPluginServiceDiscovery();
    const { pluginId, version, environment, tenantId } = deployment.config;

    // Determine number of instances to deploy
    const targetInstances = instanceCount || deployment.oldInstances.length || 1;

    for (let i = 0; i < targetInstances; i++) {
      // Create new service registration
      const newRegistration: ServiceRegistration = {
        serviceId: `${pluginId}-${version}-${Date.now()}-${i}`,
        pluginId,
        serviceName: deployment.oldInstances[0]?.registration.serviceName || pluginId,
        serviceType: deployment.oldInstances[0]?.registration.serviceType || 'backend',
        version,
        host: deployment.oldInstances[0]?.registration.host || 'localhost',
        port: deployment.oldInstances[0]?.registration.port + 1000 + i, // Offset port for new instances
        environment: environment as any,
        tenantId,
        metadata: {
          deployment: deployment.deploymentId,
          deploymentStrategy: deployment.config.strategy,
          isNewVersion: true
        }
      };

      // Register new service instance
      await serviceDiscovery.registerService(newRegistration);

      // Get the registered instance
      const newInstance = serviceDiscovery.getService(newRegistration.serviceId);
      if (newInstance) {
        deployment.newInstances.push(newInstance);
        deployment.logs.push(`Deployed new instance: ${newRegistration.serviceId}`);
      }
    }

    // Trigger state machine transition
    const stateMachine = pluginStateMachineRegistry.getStateMachine(pluginId);
    await stateMachine.transition(PluginLifecycleEvent.UPDATE, {
      pluginId,
      version,
      userId: 'deployment-manager',
      timestamp: new Date(),
      metadata: {
        deploymentId: deployment.deploymentId,
        strategy: deployment.config.strategy
      }
    });
  }

  // Validate deployment health
  private async validateDeploymentHealth(deployment: DeploymentInstance): Promise<void> {
    const healthMonitor = getPluginHealthMonitor();
    const { healthValidation } = deployment.config;
    const timeout = healthValidation.healthCheckTimeout;
    const startTime = Date.now();

    deployment.logs.push('Starting health validation...');

    while (Date.now() - startTime < timeout) {
      let allHealthy = true;
      let unhealthyCount = 0;

      for (const instance of deployment.newInstances) {
        const healthStatus = healthMonitor.getPluginHealthStatus(instance.registration.pluginId);
        if (!healthStatus || healthStatus.overallStatus !== 'healthy') {
          allHealthy = false;
          unhealthyCount++;
        }
      }

      if (allHealthy || unhealthyCount <= healthValidation.maxUnhealthyInstances) {
        deployment.logs.push('Health validation passed');
        return;
      }

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    throw new Error(`Health validation failed after ${timeout}ms`);
  }

  // Switch traffic between versions
  private async switchTraffic(deployment: DeploymentInstance, oldVersionPercent: number, newVersionPercent: number): Promise<void> {
    const serviceDiscovery = getPluginServiceDiscovery();
    const { pluginId } = deployment.config;

    // Update traffic distribution
    deployment.trafficDistribution = {
      oldVersion: oldVersionPercent,
      newVersion: newVersionPercent
    };

    // Configure load balancer weights
    for (const instance of deployment.oldInstances) {
      await serviceDiscovery.updateService(instance.registration.serviceId, {
        loadBalancing: {
          weight: oldVersionPercent,
          maxConnections: instance.registration.loadBalancing?.maxConnections,
          priority: instance.registration.loadBalancing?.priority || 1
        }
      });
    }

    for (const instance of deployment.newInstances) {
      await serviceDiscovery.updateService(instance.registration.serviceId, {
        loadBalancing: {
          weight: newVersionPercent,
          maxConnections: instance.registration.loadBalancing?.maxConnections,
          priority: instance.registration.loadBalancing?.priority || 1
        }
      });
    }

    // Store traffic route
    const trafficRoute: TrafficRoute = {
      pluginId,
      deploymentId: deployment.deploymentId,
      oldVersion: {
        instances: deployment.oldInstances.map(i => i.registration.serviceId),
        weight: oldVersionPercent
      },
      newVersion: {
        instances: deployment.newInstances.map(i => i.registration.serviceId),
        weight: newVersionPercent
      },
      updatedAt: new Date()
    };

    this.trafficRouting.set(`${pluginId}:${deployment.config.environment}`, trafficRoute);

    deployment.logs.push(`Traffic switched: ${oldVersionPercent}% old, ${newVersionPercent}% new`);
    this.emit('trafficSwitched', { deployment, oldVersionPercent, newVersionPercent });
  }

  // Monitor canary metrics
  private async monitorCanaryMetrics(deployment: DeploymentInstance, canaryConfig: NonNullable<DeploymentConfig['canary']>): Promise<void> {
    const monitoringDuration = Math.max(canaryConfig.minObservationPeriod, canaryConfig.incrementInterval);
    const startTime = Date.now();

    while (Date.now() - startTime < monitoringDuration) {
      // Update health metrics
      deployment.healthMetrics.newVersion = await this.calculateHealthMetrics(deployment.newInstances);
      deployment.healthMetrics.oldVersion = await this.calculateHealthMetrics(deployment.oldInstances);

      const newMetrics = deployment.healthMetrics.newVersion;

      // Check rollback conditions
      if (deployment.config.rollback.automaticRollback) {
        const triggers = deployment.config.rollback.rollbackTriggers;
        
        if (newMetrics.errorRate > triggers.errorRateThreshold) {
          throw new Error(`Error rate too high: ${newMetrics.errorRate}% > ${triggers.errorRateThreshold}%`);
        }
        
        if (newMetrics.averageResponseTime > triggers.responseTimeThreshold) {
          throw new Error(`Response time too high: ${newMetrics.averageResponseTime}ms > ${triggers.responseTimeThreshold}ms`);
        }
      }

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, 10000)); // Check every 10 seconds
    }
  }

  // Calculate health metrics for instances
  private async calculateHealthMetrics(instances: ServiceInstance[]): Promise<HealthMetrics> {
    if (instances.length === 0) {
      return {
        successRate: 0,
        errorRate: 0,
        averageResponseTime: 0,
        throughput: 0,
        instancesHealthy: 0,
        instancesTotal: 0
      };
    }

    let totalSuccessRate = 0;
    let totalErrorRate = 0;
    let totalResponseTime = 0;
    let totalThroughput = 0;
    let healthyInstances = 0;

    for (const instance of instances) {
      if (instance.status === 'healthy') {
        healthyInstances++;
      }

      // Get metrics from service instance
      const metrics = instance.metrics;
      totalSuccessRate += (100 - metrics.errorRate);
      totalErrorRate += metrics.errorRate;
      totalResponseTime += metrics.avgResponseTime;
      totalThroughput += metrics.requestCount;
    }

    return {
      successRate: totalSuccessRate / instances.length,
      errorRate: totalErrorRate / instances.length,
      averageResponseTime: totalResponseTime / instances.length,
      throughput: totalThroughput,
      instancesHealthy: healthyInstances,
      instancesTotal: instances.length
    };
  }

  // Execute deployment phase
  private async executePhase(deployment: DeploymentInstance, phaseName: string, phaseFunction: () => Promise<void>): Promise<void> {
    const phase: DeploymentPhase = {
      phase: phaseName,
      status: 'in_progress',
      startTime: new Date(),
      logs: []
    };

    deployment.phases.push(phase);
    deployment.currentPhase = phaseName;

    try {
      await phaseFunction();
      phase.status = 'completed';
      phase.endTime = new Date();
      phase.duration = phase.endTime.getTime() - phase.startTime.getTime();
      deployment.logs.push(`Phase '${phaseName}' completed in ${phase.duration}ms`);
    } catch (error) {
      phase.status = 'failed';
      phase.endTime = new Date();
      phase.duration = phase.endTime.getTime() - phase.startTime.getTime();
      deployment.errors.push(`Phase '${phaseName}' failed: ${error}`);
      throw error;
    }
  }

  // Handle deployment failure
  private async handleDeploymentFailure(deployment: DeploymentInstance, error: Error): Promise<void> {
    deployment.status = DeploymentStatus.FAILED;
    deployment.errors.push(`Deployment failed: ${error.message}`);
    deployment.endTime = new Date();
    deployment.duration = deployment.endTime.getTime() - deployment.startTime.getTime();

    // Execute rollback if enabled
    if (deployment.config.rollback.enabled && deployment.config.rollback.automaticRollback) {
      await this.executeRollback(deployment, error.message);
    }

    this.emit('deploymentFailed', { deployment, error });
  }

  // Execute rollback
  private async executeRollback(deployment: DeploymentInstance, trigger: string): Promise<void> {
    deployment.status = DeploymentStatus.ROLLING_BACK;
    deployment.rollbackTrigger = trigger;
    deployment.logs.push(`Starting rollback due to: ${trigger}`);

    try {
      // Switch traffic back to old version
      if (deployment.trafficDistribution.newVersion > 0) {
        await this.switchTraffic(deployment, 100, 0);
      }

      // Remove new instances
      if (deployment.newInstances.length > 0) {
        await this.cleanupInstances(deployment.newInstances);
        deployment.newInstances = [];
      }

      // Ensure old instances are healthy
      await this.ensureInstancesHealthy(deployment.oldInstances);

      deployment.status = DeploymentStatus.ROLLED_BACK;
      deployment.rollbackExecuted = true;
      deployment.logs.push('Rollback completed successfully');

      this.emit('deploymentRolledBack', deployment);

    } catch (rollbackError) {
      deployment.errors.push(`Rollback failed: ${rollbackError}`);
      this.emit('rollbackFailed', { deployment, error: rollbackError });
    }
  }

  // Complete deployment
  private async completeDeployment(deployment: DeploymentInstance): Promise<void> {
    deployment.status = DeploymentStatus.COMPLETED;
    deployment.progress = 100;
    deployment.endTime = new Date();
    deployment.duration = deployment.endTime.getTime() - deployment.startTime.getTime();
    deployment.logs.push(`Deployment completed successfully in ${deployment.duration}ms`);

    // Move to history
    this.moveToHistory(deployment);

    this.emit('deploymentCompleted', deployment);
  }

  // Utility methods
  private generateDeploymentId(): string {
    return `dep-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getCurrentVersion(instances: ServiceInstance[]): string {
    return instances.length > 0 ? instances[0].registration.version : '0.0.0';
  }

  private parseQuantity(value: number | string, total: number): number {
    if (typeof value === 'number') {
      return value;
    }
    if (value.endsWith('%')) {
      const percentage = parseInt(value.slice(0, -1));
      return Math.ceil((percentage / 100) * total);
    }
    return parseInt(value);
  }

  private async waitWithProgress(deployment: DeploymentInstance, duration: number, message: string): Promise<void> {
    const startTime = Date.now();
    const interval = Math.min(duration / 10, 5000); // Update every 10% or 5 seconds

    while (Date.now() - startTime < duration) {
      const elapsed = Date.now() - startTime;
      const progress = (elapsed / duration) * 100;
      deployment.logs[deployment.logs.length - 1] = `${message} (${Math.round(progress)}%)`;
      
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }

  private async waitForInstancesHealthy(instances: ServiceInstance[]): Promise<void> {
    // Implementation would wait for instances to become healthy
    await new Promise(resolve => setTimeout(resolve, 10000)); // Simplified
  }

  private async drainAndRemoveInstances(instances: ServiceInstance[]): Promise<void> {
    // Implementation would drain traffic and remove instances
    const serviceDiscovery = getPluginServiceDiscovery();
    
    for (const instance of instances) {
      await serviceDiscovery.deregisterService(instance.registration.serviceId);
    }
  }

  private async stopInstances(instances: ServiceInstance[]): Promise<void> {
    // Implementation would stop instances
    const serviceDiscovery = getPluginServiceDiscovery();
    
    for (const instance of instances) {
      await serviceDiscovery.deregisterService(instance.registration.serviceId);
    }
  }

  private async cleanupInstances(instances: ServiceInstance[]): Promise<void> {
    return this.stopInstances(instances);
  }

  private async cleanupOldInstances(deployment: DeploymentInstance): Promise<void> {
    await this.cleanupInstances(deployment.oldInstances);
    deployment.oldInstances = [];
  }

  private async ensureInstancesHealthy(instances: ServiceInstance[]): Promise<void> {
    // Implementation would ensure instances are healthy
  }

  private async promoteCanaryDeployment(deployment: DeploymentInstance): Promise<void> {
    // Switch all traffic to new version
    await this.switchTraffic(deployment, 0, 100);
    
    // Scale new instances to match old instance count
    const targetCount = deployment.oldInstances.length;
    const currentCount = deployment.newInstances.length;
    
    if (currentCount < targetCount) {
      await this.deployNewInstances(deployment, targetCount - currentCount);
    }
    
    // Remove old instances
    await this.cleanupOldInstances(deployment);
  }

  private async monitorABTest(deployment: DeploymentInstance, abTestConfig: NonNullable<DeploymentConfig['abTest']>): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < abTestConfig.testDuration) {
      // Update metrics
      deployment.healthMetrics.oldVersion = await this.calculateHealthMetrics(deployment.oldInstances);
      deployment.healthMetrics.newVersion = await this.calculateHealthMetrics(deployment.newInstances);
      
      // Check if we have significant results
      // This would integrate with statistical analysis
      
      await new Promise(resolve => setTimeout(resolve, 60000)); // Check every minute
    }
  }

  private async handleApprovalProcess(deployment: DeploymentInstance): Promise<void> {
    const approvalConfig = deployment.config.approvals!;
    
    const pendingApproval: PendingApproval = {
      deploymentId: deployment.deploymentId,
      requiredApprovers: new Set(approvalConfig.approvers),
      approvals: new Set(),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + approvalConfig.timeout)
    };
    
    this.approvalQueue.set(deployment.deploymentId, pendingApproval);
    
    this.emit('approvalRequired', {
      deployment,
      requiredApprovers: approvalConfig.approvers,
      timeout: approvalConfig.timeout
    });
  }

  private moveToHistory(deployment: DeploymentInstance): void {
    const { pluginId } = deployment.config;
    let history = this.deploymentHistory.get(pluginId) || [];
    
    history.push(deployment);
    
    // Keep only last 50 deployments
    if (history.length > 50) {
      history = history.slice(-50);
    }
    
    this.deploymentHistory.set(pluginId, history);
    this.activeDeployments.delete(deployment.deploymentId);
  }

  private handleHealthCheckFailure(result: HealthCheckResult): void {
    // Find deployments affected by this health check failure
    for (const deployment of this.activeDeployments.values()) {
      if (deployment.config.pluginId === result.pluginId && 
          deployment.config.rollback.automaticRollback &&
          deployment.config.rollback.rollbackTriggers.healthCheckFailure) {
        
        this.executeRollback(deployment, `Health check failed: ${result.details.error}`);
      }
    }
  }

  private handleServiceDeregistration(service: ServiceInstance): void {
    // Update active deployments
    for (const deployment of this.activeDeployments.values()) {
      const oldIndex = deployment.oldInstances.findIndex(i => i.registration.serviceId === service.registration.serviceId);
      const newIndex = deployment.newInstances.findIndex(i => i.registration.serviceId === service.registration.serviceId);
      
      if (oldIndex >= 0) {
        deployment.oldInstances.splice(oldIndex, 1);
      }
      
      if (newIndex >= 0) {
        deployment.newInstances.splice(newIndex, 1);
      }
    }
  }

  private startDeploymentMonitoring(): void {
    this.deploymentInterval = setInterval(() => {
      this.monitorActiveDeployments();
    }, 30000); // Monitor every 30 seconds
  }

  private async monitorActiveDeployments(): Promise<void> {
    for (const deployment of this.activeDeployments.values()) {
      if (deployment.status === DeploymentStatus.MONITORING) {
        // Update health metrics
        deployment.healthMetrics.oldVersion = await this.calculateHealthMetrics(deployment.oldInstances);
        deployment.healthMetrics.newVersion = await this.calculateHealthMetrics(deployment.newInstances);
        
        // Check for automatic rollback conditions
        if (deployment.config.rollback.automaticRollback) {
          await this.checkRollbackConditions(deployment);
        }
      }
    }
    
    // Check for expired approvals
    for (const [deploymentId, approval] of this.approvalQueue.entries()) {
      if (new Date() > approval.expiresAt) {
        const deployment = this.activeDeployments.get(deploymentId);
        if (deployment) {
          await this.cancelDeployment(deploymentId, 'Approval timeout');
        }
        this.approvalQueue.delete(deploymentId);
      }
    }
  }

  private async checkRollbackConditions(deployment: DeploymentInstance): Promise<void> {
    const triggers = deployment.config.rollback.rollbackTriggers;
    const newMetrics = deployment.healthMetrics.newVersion;
    
    if (newMetrics.errorRate > triggers.errorRateThreshold) {
      await this.executeRollback(deployment, `Error rate exceeded threshold: ${newMetrics.errorRate}%`);
    } else if (newMetrics.averageResponseTime > triggers.responseTimeThreshold) {
      await this.executeRollback(deployment, `Response time exceeded threshold: ${newMetrics.averageResponseTime}ms`);
    }
  }

  // Get deployment statistics
  getStatistics(): {
    activeDeployments: number;
    deploymentsToday: number;
    successRate: number;
    averageDeploymentTime: number;
    deploymentsByStrategy: Record<string, number>;
    rollbackRate: number;
  } {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let totalDeployments = 0;
    let successfulDeployments = 0;
    let totalDeploymentTime = 0;
    let deploymentsToday = 0;
    let rollbacks = 0;
    const strategyCount: Record<string, number> = {};
    
    for (const history of this.deploymentHistory.values()) {
      for (const deployment of history) {
        totalDeployments++;
        
        if (deployment.startTime >= todayStart) {
          deploymentsToday++;
        }
        
        if (deployment.status === DeploymentStatus.COMPLETED) {
          successfulDeployments++;
        }
        
        if (deployment.rollbackExecuted) {
          rollbacks++;
        }
        
        if (deployment.duration) {
          totalDeploymentTime += deployment.duration;
        }
        
        strategyCount[deployment.config.strategy] = (strategyCount[deployment.config.strategy] || 0) + 1;
      }
    }
    
    return {
      activeDeployments: this.activeDeployments.size,
      deploymentsToday,
      successRate: totalDeployments > 0 ? (successfulDeployments / totalDeployments) * 100 : 0,
      averageDeploymentTime: totalDeployments > 0 ? totalDeploymentTime / totalDeployments : 0,
      deploymentsByStrategy: strategyCount,
      rollbackRate: totalDeployments > 0 ? (rollbacks / totalDeployments) * 100 : 0
    };
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    if (this.deploymentInterval) {
      clearInterval(this.deploymentInterval);
      this.deploymentInterval = null;
    }
    
    // Cancel all active deployments
    for (const [deploymentId] of this.activeDeployments) {
      await this.cancelDeployment(deploymentId, 'System shutdown');
    }
    
    // Clear data structures
    this.activeDeployments.clear();
    this.trafficRouting.clear();
    this.approvalQueue.clear();
    
    this.removeAllListeners();
    this.emit('shutdown');
  }
}

// Supporting interfaces
interface TrafficRoute {
  pluginId: string;
  deploymentId: string;
  oldVersion: {
    instances: string[];
    weight: number;
  };
  newVersion: {
    instances: string[];
    weight: number;
  };
  updatedAt: Date;
}

interface PendingApproval {
  deploymentId: string;
  requiredApprovers: Set<string>;
  approvals: Set<string>;
  createdAt: Date;
  expiresAt: Date;
}

// Export singleton instance
let deploymentStrategyInstance: PluginDeploymentStrategyManager | null = null;

export function getPluginDeploymentStrategyManager(): PluginDeploymentStrategyManager {
  if (!deploymentStrategyInstance) {
    deploymentStrategyInstance = new PluginDeploymentStrategyManager();
  }
  return deploymentStrategyInstance;
}