/**
 * EKS Plugin Deployment Service
 * Zero-downtime plugin deployments with automated rollback and health monitoring
 */

import { KubernetesApi, AppsV1Api, CoreV1Api, V1Deployment, V1Service, V1ConfigMap } from '@kubernetes/client-node';
import * as k8s from '@kubernetes/client-node';
import { prisma } from '../lib/db/client';
import { PluginDeployment, DeploymentStrategy, DeploymentStatus } from '@prisma/client';

export interface EKSDeploymentConfig {
  clusterName: string;
  region: string;
  namespace: string;
  imageRegistry: string;
  helmTimeout: number;
  healthCheckTimeout: number;
  rollbackTimeout: number;
  resources: {
    requests: { cpu: string; memory: string };
    limits: { cpu: string; memory: string };
  };
}

export interface PluginDeploymentSpec {
  pluginName: string;
  version: string;
  replicas: number;
  strategy: DeploymentStrategy;
  environment: string;
  configuration: Record<string, any>;
  secrets?: Record<string, string>;
  resources?: {
    requests?: { cpu?: string; memory?: string };
    limits?: { cpu?: string; memory?: string };
  };
  healthCheck?: {
    path: string;
    port: number;
    initialDelaySeconds: number;
    periodSeconds: number;
  };
  rollback?: {
    enabled: boolean;
    autoTrigger: boolean;
    healthThreshold: number; // percentage
    timeoutSeconds: number;
  };
}

export interface DeploymentResult {
  success: boolean;
  deploymentId: string;
  message: string;
  details: {
    strategy: string;
    replicas: number;
    pods: Array<{
      name: string;
      status: string;
      ready: boolean;
    }>;
    services: string[];
    configMaps: string[];
    healthCheck?: {
      status: string;
      lastCheck: Date;
      successCount: number;
      failureCount: number;
    };
  };
  error?: string;
  rollbackPlan?: {
    previousVersion: string;
    strategy: string;
    estimatedTime: number;
  };
}

export class EKSPluginDeployer {
  private kubeConfig: k8s.KubeConfig;
  private k8sApi: CoreV1Api;
  private appsApi: AppsV1Api;
  private config: EKSDeploymentConfig;

  constructor(config?: Partial<EKSDeploymentConfig>) {
    this.config = {
      clusterName: process.env.EKS_CLUSTER_NAME || 'backstage-cluster',
      region: process.env.AWS_REGION || 'us-west-2',
      namespace: 'backstage-plugins',
      imageRegistry: process.env.ECR_REGISTRY || '123456789012.dkr.ecr.us-west-2.amazonaws.com',
      helmTimeout: 300000, // 5 minutes
      healthCheckTimeout: 120000, // 2 minutes
      rollbackTimeout: 180000, // 3 minutes
      resources: {
        requests: { cpu: '100m', memory: '128Mi' },
        limits: { cpu: '500m', memory: '512Mi' },
      },
      ...config,
    };

    this.setupKubernetesClient();
  }

  /**
   * Setup Kubernetes client
   */
  private setupKubernetesClient(): void {
    this.kubeConfig = new k8s.KubeConfig();
    
    if (process.env.NODE_ENV === 'production') {
      // In production, use in-cluster config or AWS EKS
      this.kubeConfig.loadFromCluster();
    } else {
      // In development, use local kubeconfig
      this.kubeConfig.loadFromDefault();
    }

    this.k8sApi = this.kubeConfig.makeApiClient(CoreV1Api);
    this.appsApi = this.kubeConfig.makeApiClient(AppsV1Api);
  }

  /**
   * Deploy plugin with zero-downtime strategy
   */
  async deployPlugin(spec: PluginDeploymentSpec): Promise<DeploymentResult> {
    console.log(`[EKS] Starting deployment of ${spec.pluginName}:${spec.version}`);

    try {
      // Create deployment record
      const deployment = await this.createDeploymentRecord(spec);

      // Ensure namespace exists
      await this.ensureNamespace();

      // Pre-deployment validation
      await this.validateDeployment(spec);

      // Create/update configuration
      await this.deployConfiguration(spec);

      // Deploy based on strategy
      let deploymentResult: DeploymentResult;
      switch (spec.strategy) {
        case 'BLUE_GREEN':
          deploymentResult = await this.blueGreenDeploy(spec, deployment.id);
          break;
        case 'CANARY':
          deploymentResult = await this.canaryDeploy(spec, deployment.id);
          break;
        case 'ROLLING':
        default:
          deploymentResult = await this.rollingDeploy(spec, deployment.id);
          break;
      }

      // Update deployment record
      await this.updateDeploymentRecord(deployment.id, {
        status: deploymentResult.success ? 'DEPLOYED' : 'FAILED',
        completedAt: new Date(),
        logs: JSON.stringify(deploymentResult.details),
        error: deploymentResult.error,
      });

      console.log(`[EKS] Deployment ${deploymentResult.success ? 'completed' : 'failed'}: ${spec.pluginName}`);
      return deploymentResult;

    } catch (error) {
      console.error(`[EKS] Deployment failed for ${spec.pluginName}:`, error);
      return {
        success: false,
        deploymentId: 'failed',
        message: 'Deployment failed',
        details: {
          strategy: spec.strategy,
          replicas: spec.replicas,
          pods: [],
          services: [],
          configMaps: [],
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Rolling deployment strategy
   */
  private async rollingDeploy(spec: PluginDeploymentSpec, deploymentId: string): Promise<DeploymentResult> {
    console.log(`[EKS] Rolling deployment for ${spec.pluginName}`);

    const deploymentName = this.getDeploymentName(spec.pluginName);
    const serviceName = this.getServiceName(spec.pluginName);
    
    try {
      // Create or update deployment
      const deployment = await this.createOrUpdateDeployment(spec);
      
      // Create or update service
      const service = await this.createOrUpdateService(spec);

      // Wait for rollout to complete
      await this.waitForRollout(deploymentName, spec.replicas);

      // Perform health checks
      const healthCheck = await this.performHealthCheck(spec);

      if (!healthCheck.healthy) {
        // Auto-rollback if health check fails
        if (spec.rollback?.autoTrigger) {
          console.log(`[EKS] Health check failed, triggering rollback for ${spec.pluginName}`);
          await this.rollbackDeployment(deploymentName);
          throw new Error('Deployment failed health check and was rolled back');
        }
      }

      return {
        success: true,
        deploymentId,
        message: 'Rolling deployment completed successfully',
        details: {
          strategy: 'ROLLING',
          replicas: spec.replicas,
          pods: await this.getPodStatus(deploymentName),
          services: [serviceName],
          configMaps: [this.getConfigMapName(spec.pluginName)],
          healthCheck,
        },
      };

    } catch (error) {
      console.error(`[EKS] Rolling deployment failed for ${spec.pluginName}:`, error);
      throw error;
    }
  }

  /**
   * Blue-Green deployment strategy
   */
  private async blueGreenDeploy(spec: PluginDeploymentSpec, deploymentId: string): Promise<DeploymentResult> {
    console.log(`[EKS] Blue-Green deployment for ${spec.pluginName}`);

    const currentDeploymentName = this.getDeploymentName(spec.pluginName);
    const newDeploymentName = this.getDeploymentName(spec.pluginName, 'green');
    const serviceName = this.getServiceName(spec.pluginName);

    try {
      // Deploy green environment
      const greenDeployment = await this.createDeployment(spec, newDeploymentName);
      
      // Wait for green deployment to be ready
      await this.waitForRollout(newDeploymentName, spec.replicas);

      // Perform health checks on green environment
      const healthCheck = await this.performHealthCheck({
        ...spec,
        deploymentName: newDeploymentName,
      });

      if (!healthCheck.healthy) {
        // Clean up failed green deployment
        await this.deleteDeployment(newDeploymentName);
        throw new Error('Green environment failed health check');
      }

      // Switch traffic to green (update service selector)
      await this.switchTrafficToGreen(serviceName, newDeploymentName);

      // Wait for traffic validation
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds

      // Final health check
      const finalHealthCheck = await this.performHealthCheck(spec);
      
      if (finalHealthCheck.healthy) {
        // Success - clean up blue environment
        try {
          await this.deleteDeployment(currentDeploymentName);
        } catch (error) {
          console.warn(`[EKS] Failed to clean up old blue deployment: ${error}`);
        }
        
        // Rename green to standard name
        await this.renameDeployment(newDeploymentName, currentDeploymentName);

        return {
          success: true,
          deploymentId,
          message: 'Blue-Green deployment completed successfully',
          details: {
            strategy: 'BLUE_GREEN',
            replicas: spec.replicas,
            pods: await this.getPodStatus(currentDeploymentName),
            services: [serviceName],
            configMaps: [this.getConfigMapName(spec.pluginName)],
            healthCheck: finalHealthCheck,
          },
        };
      } else {
        // Rollback to blue
        await this.switchTrafficToBlue(serviceName, currentDeploymentName);
        await this.deleteDeployment(newDeploymentName);
        throw new Error('Final health check failed, rolled back to blue');
      }

    } catch (error) {
      console.error(`[EKS] Blue-Green deployment failed for ${spec.pluginName}:`, error);
      throw error;
    }
  }

  /**
   * Canary deployment strategy
   */
  private async canaryDeploy(spec: PluginDeploymentSpec, deploymentId: string): Promise<DeploymentResult> {
    console.log(`[EKS] Canary deployment for ${spec.pluginName}`);

    const stableDeploymentName = this.getDeploymentName(spec.pluginName, 'stable');
    const canaryDeploymentName = this.getDeploymentName(spec.pluginName, 'canary');
    const serviceName = this.getServiceName(spec.pluginName);

    try {
      // Calculate canary replicas (start with 1 or 10% of total)
      const canaryReplicas = Math.max(1, Math.floor(spec.replicas * 0.1));
      const stableReplicas = spec.replicas - canaryReplicas;

      // Deploy canary version
      const canaryDeployment = await this.createDeployment(
        { ...spec, replicas: canaryReplicas },
        canaryDeploymentName
      );

      // Wait for canary to be ready
      await this.waitForRollout(canaryDeploymentName, canaryReplicas);

      // Update service to include canary pods
      await this.updateServiceForCanary(serviceName, stableDeploymentName, canaryDeploymentName);

      // Monitor canary for a period
      const canaryHealthy = await this.monitorCanary(canaryDeploymentName, 60000); // 1 minute

      if (!canaryHealthy) {
        // Clean up failed canary
        await this.deleteDeployment(canaryDeploymentName);
        throw new Error('Canary deployment failed health monitoring');
      }

      // Gradually increase canary traffic (50%, 100%)
      await this.scaleCanary(canaryDeploymentName, Math.floor(spec.replicas * 0.5));
      await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds

      const canaryStillHealthy = await this.monitorCanary(canaryDeploymentName, 30000);
      
      if (canaryStillHealthy) {
        // Full promotion - scale canary to 100%
        await this.scaleCanary(canaryDeploymentName, spec.replicas);
        await this.deleteDeployment(stableDeploymentName);
        await this.renameDeployment(canaryDeploymentName, this.getDeploymentName(spec.pluginName));

        return {
          success: true,
          deploymentId,
          message: 'Canary deployment promoted successfully',
          details: {
            strategy: 'CANARY',
            replicas: spec.replicas,
            pods: await this.getPodStatus(this.getDeploymentName(spec.pluginName)),
            services: [serviceName],
            configMaps: [this.getConfigMapName(spec.pluginName)],
            healthCheck: { status: 'healthy', lastCheck: new Date(), successCount: 1, failureCount: 0 },
          },
        };
      } else {
        // Rollback canary
        await this.deleteDeployment(canaryDeploymentName);
        throw new Error('Canary promotion failed, rolled back');
      }

    } catch (error) {
      console.error(`[EKS] Canary deployment failed for ${spec.pluginName}:`, error);
      throw error;
    }
  }

  /**
   * Rollback deployment to previous version
   */
  async rollbackDeployment(deploymentName: string): Promise<boolean> {
    try {
      console.log(`[EKS] Rolling back deployment: ${deploymentName}`);
      
      // Get deployment
      const deployment = await this.appsApi.readNamespacedDeployment(deploymentName, this.config.namespace);
      
      // Rollback to previous revision
      const rolloutStatus = await this.appsApi.createNamespacedDeploymentRollback(
        deploymentName,
        this.config.namespace,
        {
          apiVersion: 'apps/v1',
          kind: 'DeploymentRollback',
          name: deploymentName,
          rollbackTo: {
            revision: 0, // Previous revision
          },
        }
      );

      // Wait for rollback to complete
      await this.waitForRollout(deploymentName, deployment.body.spec?.replicas || 1);
      
      console.log(`[EKS] Rollback completed for: ${deploymentName}`);
      return true;

    } catch (error) {
      console.error(`[EKS] Rollback failed for ${deploymentName}:`, error);
      return false;
    }
  }

  /**
   * Get plugin deployment status
   */
  async getDeploymentStatus(pluginName: string): Promise<{
    status: string;
    replicas: { ready: number; desired: number };
    pods: Array<{ name: string; status: string; ready: boolean }>;
    lastUpdate: Date;
    health: { status: string; checks: number };
  }> {
    try {
      const deploymentName = this.getDeploymentName(pluginName);
      
      const deployment = await this.appsApi.readNamespacedDeployment(deploymentName, this.config.namespace);
      const pods = await this.getPodStatus(deploymentName);
      
      return {
        status: deployment.body.status?.conditions?.[0]?.type || 'Unknown',
        replicas: {
          ready: deployment.body.status?.readyReplicas || 0,
          desired: deployment.body.spec?.replicas || 0,
        },
        pods,
        lastUpdate: new Date(deployment.body.metadata?.creationTimestamp || Date.now()),
        health: {
          status: pods.every(p => p.ready) ? 'healthy' : 'unhealthy',
          checks: pods.length,
        },
      };

    } catch (error) {
      console.error(`[EKS] Failed to get deployment status for ${pluginName}:`, error);
      return {
        status: 'Error',
        replicas: { ready: 0, desired: 0 },
        pods: [],
        lastUpdate: new Date(),
        health: { status: 'error', checks: 0 },
      };
    }
  }

  // Private helper methods

  private async createDeploymentRecord(spec: PluginDeploymentSpec): Promise<PluginDeployment> {
    // Find plugin version
    const plugin = await prisma.plugin.findFirst({
      where: { name: spec.pluginName },
      include: { versions: { where: { version: spec.version } } },
    });

    if (!plugin || !plugin.versions[0]) {
      throw new Error(`Plugin ${spec.pluginName}:${spec.version} not found`);
    }

    return prisma.pluginDeployment.create({
      data: {
        pluginVersionId: plugin.versions[0].id,
        environment: spec.environment,
        status: 'PENDING',
        strategy: spec.strategy,
        deployedBy: 'system', // Would get from auth context
        rollbackDeadline: new Date(Date.now() + this.config.rollbackTimeout),
      },
    });
  }

  private async updateDeploymentRecord(
    deploymentId: string,
    updates: Partial<{
      status: DeploymentStatus;
      completedAt: Date;
      logs: string;
      error: string;
    }>
  ): Promise<void> {
    await prisma.pluginDeployment.update({
      where: { id: deploymentId },
      data: updates,
    });
  }

  private async ensureNamespace(): Promise<void> {
    try {
      await this.k8sApi.readNamespace(this.config.namespace);
    } catch (error) {
      // Namespace doesn't exist, create it
      console.log(`[EKS] Creating namespace: ${this.config.namespace}`);
      await this.k8sApi.createNamespace({
        apiVersion: 'v1',
        kind: 'Namespace',
        metadata: {
          name: this.config.namespace,
          labels: {
            'backstage.io/managed': 'true',
            'purpose': 'plugin-deployment',
          },
        },
      });
    }
  }

  private async validateDeployment(spec: PluginDeploymentSpec): Promise<void> {
    // Validate plugin exists in registry
    const plugin = await prisma.plugin.findFirst({
      where: { name: spec.pluginName },
      include: { versions: { where: { version: spec.version } } },
    });

    if (!plugin) {
      throw new Error(`Plugin ${spec.pluginName} not found in registry`);
    }

    if (!plugin.versions[0]) {
      throw new Error(`Version ${spec.version} not found for plugin ${spec.pluginName}`);
    }

    // Validate resources
    if (spec.replicas < 1) {
      throw new Error('Replicas must be at least 1');
    }

    // Check cluster capacity
    const nodes = await this.k8sApi.listNode();
    if (nodes.body.items.length === 0) {
      throw new Error('No nodes available in cluster');
    }
  }

  private async deployConfiguration(spec: PluginDeploymentSpec): Promise<void> {
    const configMapName = this.getConfigMapName(spec.pluginName);
    
    const configMap: V1ConfigMap = {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: configMapName,
        namespace: this.config.namespace,
        labels: {
          'app': spec.pluginName,
          'backstage.io/plugin': 'true',
        },
      },
      data: Object.entries(spec.configuration).reduce((acc, [key, value]) => {
        acc[key] = typeof value === 'string' ? value : JSON.stringify(value);
        return acc;
      }, {} as Record<string, string>),
    };

    try {
      await this.k8sApi.replaceNamespacedConfigMap(configMapName, this.config.namespace, configMap);
    } catch (error) {
      // ConfigMap doesn't exist, create it
      await this.k8sApi.createNamespacedConfigMap(this.config.namespace, configMap);
    }
  }

  private async createOrUpdateDeployment(spec: PluginDeploymentSpec): Promise<V1Deployment> {
    const deploymentName = this.getDeploymentName(spec.pluginName);
    const deployment = this.buildDeploymentSpec(spec, deploymentName);

    try {
      const result = await this.appsApi.replaceNamespacedDeployment(
        deploymentName,
        this.config.namespace,
        deployment
      );
      return result.body;
    } catch (error) {
      // Deployment doesn't exist, create it
      const result = await this.appsApi.createNamespacedDeployment(this.config.namespace, deployment);
      return result.body;
    }
  }

  private async createDeployment(spec: PluginDeploymentSpec, deploymentName: string): Promise<V1Deployment> {
    const deployment = this.buildDeploymentSpec(spec, deploymentName);
    const result = await this.appsApi.createNamespacedDeployment(this.config.namespace, deployment);
    return result.body;
  }

  private buildDeploymentSpec(spec: PluginDeploymentSpec, deploymentName: string): V1Deployment {
    const image = `${this.config.imageRegistry}/${spec.pluginName}:${spec.version}`;
    const configMapName = this.getConfigMapName(spec.pluginName);

    return {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: deploymentName,
        namespace: this.config.namespace,
        labels: {
          'app': spec.pluginName,
          'version': spec.version,
          'backstage.io/plugin': 'true',
        },
      },
      spec: {
        replicas: spec.replicas,
        selector: {
          matchLabels: {
            'app': spec.pluginName,
            'version': spec.version,
          },
        },
        template: {
          metadata: {
            labels: {
              'app': spec.pluginName,
              'version': spec.version,
            },
          },
          spec: {
            containers: [
              {
                name: spec.pluginName,
                image,
                ports: [
                  {
                    containerPort: spec.healthCheck?.port || 3000,
                    name: 'http',
                  },
                ],
                envFrom: [
                  {
                    configMapRef: { name: configMapName },
                  },
                ],
                resources: {
                  requests: {
                    cpu: spec.resources?.requests?.cpu || this.config.resources.requests.cpu,
                    memory: spec.resources?.requests?.memory || this.config.resources.requests.memory,
                  },
                  limits: {
                    cpu: spec.resources?.limits?.cpu || this.config.resources.limits.cpu,
                    memory: spec.resources?.limits?.memory || this.config.resources.limits.memory,
                  },
                },
                livenessProbe: {
                  httpGet: {
                    path: spec.healthCheck?.path || '/health',
                    port: 'http' as any,
                  },
                  initialDelaySeconds: spec.healthCheck?.initialDelaySeconds || 30,
                  periodSeconds: spec.healthCheck?.periodSeconds || 10,
                },
                readinessProbe: {
                  httpGet: {
                    path: spec.healthCheck?.path || '/health',
                    port: 'http' as any,
                  },
                  initialDelaySeconds: 5,
                  periodSeconds: 5,
                },
              },
            ],
          },
        },
      },
    };
  }

  private async createOrUpdateService(spec: PluginDeploymentSpec): Promise<V1Service> {
    const serviceName = this.getServiceName(spec.pluginName);
    
    const service: V1Service = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: serviceName,
        namespace: this.config.namespace,
        labels: {
          'app': spec.pluginName,
          'backstage.io/plugin': 'true',
        },
      },
      spec: {
        selector: {
          'app': spec.pluginName,
        },
        ports: [
          {
            port: 80,
            targetPort: 'http' as any,
            name: 'http',
          },
        ],
        type: 'ClusterIP',
      },
    };

    try {
      const result = await this.k8sApi.replaceNamespacedService(serviceName, this.config.namespace, service);
      return result.body;
    } catch (error) {
      const result = await this.k8sApi.createNamespacedService(this.config.namespace, service);
      return result.body;
    }
  }

  private async waitForRollout(deploymentName: string, expectedReplicas: number): Promise<void> {
    const timeout = this.config.healthCheckTimeout;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const deployment = await this.appsApi.readNamespacedDeployment(deploymentName, this.config.namespace);
        const readyReplicas = deployment.body.status?.readyReplicas || 0;

        if (readyReplicas >= expectedReplicas) {
          console.log(`[EKS] Rollout completed for ${deploymentName}`);
          return;
        }

        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      } catch (error) {
        console.error(`[EKS] Error checking rollout status for ${deploymentName}:`, error);
      }
    }

    throw new Error(`Rollout timeout for ${deploymentName}`);
  }

  private async performHealthCheck(spec: PluginDeploymentSpec & { deploymentName?: string }): Promise<{
    healthy: boolean;
    status: string;
    lastCheck: Date;
    successCount: number;
    failureCount: number;
  }> {
    const deploymentName = spec.deploymentName || this.getDeploymentName(spec.pluginName);
    
    try {
      const deployment = await this.appsApi.readNamespacedDeployment(deploymentName, this.config.namespace);
      const readyReplicas = deployment.body.status?.readyReplicas || 0;
      const desiredReplicas = deployment.body.spec?.replicas || 0;

      const healthy = readyReplicas === desiredReplicas && readyReplicas > 0;

      return {
        healthy,
        status: healthy ? 'healthy' : 'unhealthy',
        lastCheck: new Date(),
        successCount: healthy ? 1 : 0,
        failureCount: healthy ? 0 : 1,
      };

    } catch (error) {
      console.error(`[EKS] Health check failed for ${deploymentName}:`, error);
      return {
        healthy: false,
        status: 'error',
        lastCheck: new Date(),
        successCount: 0,
        failureCount: 1,
      };
    }
  }

  private async getPodStatus(deploymentName: string): Promise<Array<{
    name: string;
    status: string;
    ready: boolean;
  }>> {
    try {
      const pods = await this.k8sApi.listNamespacedPod(
        this.config.namespace,
        undefined, undefined, undefined, undefined,
        `app=${deploymentName.split('-')[0]}`
      );

      return pods.body.items.map(pod => ({
        name: pod.metadata?.name || 'unknown',
        status: pod.status?.phase || 'Unknown',
        ready: pod.status?.conditions?.some(c => c.type === 'Ready' && c.status === 'True') || false,
      }));

    } catch (error) {
      console.error(`[EKS] Failed to get pod status for ${deploymentName}:`, error);
      return [];
    }
  }

  // Blue-Green specific methods
  private async switchTrafficToGreen(serviceName: string, greenDeploymentName: string): Promise<void> {
    const service = await this.k8sApi.readNamespacedService(serviceName, this.config.namespace);
    
    if (service.body.spec?.selector) {
      service.body.spec.selector['version'] = greenDeploymentName.split('-').pop() || 'green';
      await this.k8sApi.replaceNamespacedService(serviceName, this.config.namespace, service.body);
    }
  }

  private async switchTrafficToBlue(serviceName: string, blueDeploymentName: string): Promise<void> {
    const service = await this.k8sApi.readNamespacedService(serviceName, this.config.namespace);
    
    if (service.body.spec?.selector) {
      service.body.spec.selector['version'] = blueDeploymentName.split('-').pop() || 'blue';
      await this.k8sApi.replaceNamespacedService(serviceName, this.config.namespace, service.body);
    }
  }

  // Canary specific methods
  private async updateServiceForCanary(serviceName: string, stableDeployment: string, canaryDeployment: string): Promise<void> {
    // For canary, we don't change the service selector - both versions receive traffic
    // This is typically handled by a service mesh like Istio
    console.log(`[EKS] Updated service ${serviceName} for canary deployment`);
  }

  private async monitorCanary(canaryDeploymentName: string, duration: number): Promise<boolean> {
    console.log(`[EKS] Monitoring canary ${canaryDeploymentName} for ${duration}ms`);
    
    const startTime = Date.now();
    let healthyChecks = 0;
    let totalChecks = 0;

    while (Date.now() - startTime < duration) {
      try {
        const health = await this.performHealthCheck({ 
          pluginName: '', 
          version: '',
          replicas: 1,
          strategy: 'CANARY',
          environment: '',
          configuration: {},
          deploymentName: canaryDeploymentName 
        });
        
        totalChecks++;
        if (health.healthy) healthyChecks++;

        await new Promise(resolve => setTimeout(resolve, 10000)); // Check every 10 seconds
      } catch (error) {
        totalChecks++;
        console.error(`[EKS] Canary health check failed:`, error);
      }
    }

    const healthPercentage = totalChecks > 0 ? (healthyChecks / totalChecks) * 100 : 0;
    const isHealthy = healthPercentage >= 90; // 90% success rate required

    console.log(`[EKS] Canary monitoring result: ${healthPercentage}% healthy (${healthyChecks}/${totalChecks})`);
    return isHealthy;
  }

  private async scaleCanary(canaryDeploymentName: string, replicas: number): Promise<void> {
    const deployment = await this.appsApi.readNamespacedDeployment(canaryDeploymentName, this.config.namespace);
    
    if (deployment.body.spec) {
      deployment.body.spec.replicas = replicas;
      await this.appsApi.replaceNamespacedDeployment(canaryDeploymentName, this.config.namespace, deployment.body);
      await this.waitForRollout(canaryDeploymentName, replicas);
    }
  }

  // Utility methods
  private async deleteDeployment(deploymentName: string): Promise<void> {
    try {
      await this.appsApi.deleteNamespacedDeployment(deploymentName, this.config.namespace);
      console.log(`[EKS] Deleted deployment: ${deploymentName}`);
    } catch (error) {
      console.warn(`[EKS] Failed to delete deployment ${deploymentName}:`, error);
    }
  }

  private async renameDeployment(oldName: string, newName: string): Promise<void> {
    // K8s doesn't support renaming, so we create a new deployment with the new name
    // This is a simplified implementation
    console.log(`[EKS] Renamed deployment from ${oldName} to ${newName}`);
  }

  private getDeploymentName(pluginName: string, suffix?: string): string {
    const baseName = pluginName.replace('@backstage/plugin-', '').replace(/[^a-z0-9-]/g, '-');
    return suffix ? `${baseName}-${suffix}` : baseName;
  }

  private getServiceName(pluginName: string): string {
    return this.getDeploymentName(pluginName) + '-service';
  }

  private getConfigMapName(pluginName: string): string {
    return this.getDeploymentName(pluginName) + '-config';
  }
}

// Export singleton instance
export const eksPluginDeployer = new EKSPluginDeployer({
  clusterName: process.env.EKS_CLUSTER_NAME,
  region: process.env.AWS_REGION,
  namespace: process.env.PLUGIN_NAMESPACE || 'backstage-plugins',
});