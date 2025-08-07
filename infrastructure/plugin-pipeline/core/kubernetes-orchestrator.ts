/**
 * Kubernetes Orchestrator for Plugin Pipeline
 * 
 * Handles Kubernetes deployment automation, namespace management, resource quotas,
 * and advanced deployment strategies for plugin lifecycle management
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import * as k8s from '@kubernetes/client-node';
import { 
  PluginDefinition, 
  DeploymentStrategy, 
  DeploymentInfo, 
  HealthStatus,
  ResourceQuota,
  PluginScalingPolicy 
} from '../types/plugin-types';
import { ImageInfo } from './docker-builder';

export interface KubernetesConfig {
  kubeconfig?: string;
  inCluster?: boolean;
  defaultNamespace?: string;
  resourceQuotaEnabled?: boolean;
  networkPoliciesEnabled?: boolean;
  podSecurityStandardsEnabled?: boolean;
}

export class KubernetesOrchestrator extends EventEmitter {
  private logger: Logger;
  private k8sApi: k8s.KubernetesApi;
  private coreApi: k8s.CoreV1Api;
  private appsApi: k8s.AppsV1Api;
  private networkingApi: k8s.NetworkingV1Api;
  private autoscalingApi: k8s.AutoscalingV2Api;
  private customObjectsApi: k8s.CustomObjectsApi;
  private metricsApi: k8s.MetricsV1beta1Api;
  
  private config: KubernetesConfig;
  private pluginNamespaces: Set<string> = new Set();
  private deploymentStrategies: Map<DeploymentStrategy, any> = new Map();

  constructor(logger: Logger, config: KubernetesConfig = {}) {
    super();
    this.logger = logger;
    this.config = {
      defaultNamespace: 'plugins',
      resourceQuotaEnabled: true,
      networkPoliciesEnabled: true,
      podSecurityStandardsEnabled: true,
      ...config
    };
    
    this.initializeKubernetesClient();
    this.initializeDeploymentStrategies();
  }

  /**
   * Initialize Kubernetes client
   */
  private initializeKubernetesClient(): void {
    const kc = new k8s.KubeConfig();
    
    if (this.config.inCluster) {
      kc.loadFromCluster();
    } else if (this.config.kubeconfig) {
      kc.loadFromFile(this.config.kubeconfig);
    } else {
      kc.loadFromDefault();
    }
    
    this.k8sApi = kc.makeApiClient(k8s.KubernetesApi);
    this.coreApi = kc.makeApiClient(k8s.CoreV1Api);
    this.appsApi = kc.makeApiClient(k8s.AppsV1Api);
    this.networkingApi = kc.makeApiClient(k8s.NetworkingV1Api);
    this.autoscalingApi = kc.makeApiClient(k8s.AutoscalingV2Api);
    this.customObjectsApi = kc.makeApiClient(k8s.CustomObjectsApi);
    this.metricsApi = kc.makeApiClient(k8s.MetricsV1beta1Api);
  }

  /**
   * Initialize deployment strategies
   */
  private initializeDeploymentStrategies(): void {
    this.deploymentStrategies.set(DeploymentStrategy.ROLLING_UPDATE, this.deployRollingUpdate.bind(this));
    this.deploymentStrategies.set(DeploymentStrategy.BLUE_GREEN, this.deployBlueGreen.bind(this));
    this.deploymentStrategies.set(DeploymentStrategy.CANARY, this.deployCanary.bind(this));
    this.deploymentStrategies.set(DeploymentStrategy.A_B_TEST, this.deployABTest.bind(this));
    this.deploymentStrategies.set(DeploymentStrategy.RECREATE, this.deployRecreate.bind(this));
  }

  /**
   * Deploy plugin using specified strategy
   */
  async deployPlugin(
    pluginDefinition: PluginDefinition,
    imageInfo: ImageInfo,
    strategy: DeploymentStrategy
  ): Promise<DeploymentInfo> {
    const namespace = this.getPluginNamespace(pluginDefinition);
    
    this.logger.info(`Deploying plugin ${pluginDefinition.name} to namespace ${namespace}`, {
      strategy,
      imageTag: imageInfo.imageTag
    });

    try {
      // Step 1: Ensure namespace exists with proper configuration
      await this.ensureNamespace(namespace, pluginDefinition);
      
      // Step 2: Create or update ConfigMaps and Secrets
      await this.createPluginConfiguration(pluginDefinition, namespace);
      
      // Step 3: Execute deployment strategy
      const strategyHandler = this.deploymentStrategies.get(strategy);
      if (!strategyHandler) {
        throw new Error(`Unsupported deployment strategy: ${strategy}`);
      }
      
      const deploymentInfo = await strategyHandler(pluginDefinition, imageInfo, namespace);
      
      // Step 4: Set up auto-scaling if configured
      if (pluginDefinition.resources) {
        await this.setupAutoScaling(pluginDefinition, namespace);
      }
      
      // Step 5: Configure network policies
      if (this.config.networkPoliciesEnabled) {
        await this.createNetworkPolicies(pluginDefinition, namespace);
      }
      
      this.emit('plugin-deployed', { pluginDefinition, deploymentInfo });
      return deploymentInfo;
      
    } catch (error) {
      this.logger.error(`Failed to deploy plugin ${pluginDefinition.name}: ${error.message}`);
      this.emit('plugin-deployment-failed', { pluginDefinition, error });
      throw error;
    }
  }

  /**
   * Rolling update deployment strategy
   */
  private async deployRollingUpdate(
    pluginDefinition: PluginDefinition,
    imageInfo: ImageInfo,
    namespace: string
  ): Promise<DeploymentInfo> {
    const deploymentName = `${pluginDefinition.name}-deployment`;
    const serviceName = `${pluginDefinition.name}-service`;
    
    // Create or update deployment
    const deployment = this.createDeploymentSpec(pluginDefinition, imageInfo, namespace);
    deployment.spec!.strategy = {
      type: 'RollingUpdate',
      rollingUpdate: {
        maxSurge: 1,
        maxUnavailable: 0
      }
    };
    
    await this.applyDeployment(deployment, namespace);
    
    // Create or update service
    const service = this.createServiceSpec(pluginDefinition, namespace);
    await this.applyService(service, namespace);
    
    // Create ingress if configured
    let ingressName: string | undefined;
    if (pluginDefinition.networking.ingress?.enabled) {
      const ingress = this.createIngressSpec(pluginDefinition, serviceName, namespace);
      await this.applyIngress(ingress, namespace);
      ingressName = `${pluginDefinition.name}-ingress`;
    }
    
    // Wait for deployment to be ready
    await this.waitForDeploymentReady(deploymentName, namespace);
    
    return {
      namespace,
      deploymentName,
      serviceName,
      ingressName,
      replicas: pluginDefinition.resources?.cpu ? 3 : 1, // Default based on resource requirements
      strategy: DeploymentStrategy.ROLLING_UPDATE,
      imageTag: imageInfo.imageTag,
      resourceAllocation: {
        cpu: pluginDefinition.resources.cpu.limit,
        memory: pluginDefinition.resources.memory.limit,
        storage: pluginDefinition.resources.storage?.size
      },
      endpoints: {
        internal: `http://${serviceName}.${namespace}.svc.cluster.local:${pluginDefinition.networking.ports[0]?.port}`,
        external: pluginDefinition.networking.ingress?.host ? 
          `https://${pluginDefinition.networking.ingress.host}` : undefined
      },
      createdAt: new Date()
    };
  }

  /**
   * Blue-Green deployment strategy
   */
  private async deployBlueGreen(
    pluginDefinition: PluginDefinition,
    imageInfo: ImageInfo,
    namespace: string
  ): Promise<DeploymentInfo> {
    const baseDeploymentName = `${pluginDefinition.name}-deployment`;
    const serviceName = `${pluginDefinition.name}-service`;
    
    // Determine current and new colors
    const currentColor = await this.getCurrentDeploymentColor(baseDeploymentName, namespace);
    const newColor = currentColor === 'blue' ? 'green' : 'blue';
    const newDeploymentName = `${baseDeploymentName}-${newColor}`;
    
    this.logger.info(`Blue-Green deployment: deploying ${newColor} version`, {
      plugin: pluginDefinition.name,
      currentColor,
      newColor
    });
    
    // Deploy new version
    const deployment = this.createDeploymentSpec(pluginDefinition, imageInfo, namespace);
    deployment.metadata!.name = newDeploymentName;
    deployment.metadata!.labels!['color'] = newColor;
    deployment.spec!.selector.matchLabels!['color'] = newColor;
    deployment.spec!.template.metadata!.labels!['color'] = newColor;
    
    await this.applyDeployment(deployment, namespace);
    await this.waitForDeploymentReady(newDeploymentName, namespace);
    
    // Perform health checks
    const healthStatus = await this.performHealthChecks(pluginDefinition, newDeploymentName, namespace);
    if (healthStatus.status !== 'healthy') {
      throw new Error(`Health checks failed for new deployment: ${healthStatus.message}`);
    }
    
    // Switch traffic to new version
    await this.switchBlueGreenTraffic(serviceName, newColor, namespace);
    
    // Clean up old deployment after successful switch
    if (currentColor) {
      const oldDeploymentName = `${baseDeploymentName}-${currentColor}`;
      await this.deleteDeployment(oldDeploymentName, namespace);
    }
    
    return {
      namespace,
      deploymentName: newDeploymentName,
      serviceName,
      replicas: deployment.spec!.replicas || 1,
      strategy: DeploymentStrategy.BLUE_GREEN,
      imageTag: imageInfo.imageTag,
      resourceAllocation: {
        cpu: pluginDefinition.resources.cpu.limit,
        memory: pluginDefinition.resources.memory.limit
      },
      endpoints: {
        internal: `http://${serviceName}.${namespace}.svc.cluster.local:${pluginDefinition.networking.ports[0]?.port}`
      },
      createdAt: new Date()
    };
  }

  /**
   * Canary deployment strategy
   */
  private async deployCanary(
    pluginDefinition: PluginDefinition,
    imageInfo: ImageInfo,
    namespace: string
  ): Promise<DeploymentInfo> {
    const baseDeploymentName = `${pluginDefinition.name}-deployment`;
    const canaryDeploymentName = `${baseDeploymentName}-canary`;
    const serviceName = `${pluginDefinition.name}-service`;
    
    // Deploy canary version with minimal traffic (10%)
    const canaryDeployment = this.createDeploymentSpec(pluginDefinition, imageInfo, namespace);
    canaryDeployment.metadata!.name = canaryDeploymentName;
    canaryDeployment.metadata!.labels!['version'] = 'canary';
    canaryDeployment.spec!.selector.matchLabels!['version'] = 'canary';
    canaryDeployment.spec!.template.metadata!.labels!['version'] = 'canary';
    canaryDeployment.spec!.replicas = 1; // Start with single replica
    
    await this.applyDeployment(canaryDeployment, namespace);
    await this.waitForDeploymentReady(canaryDeploymentName, namespace);
    
    // Create canary service for traffic splitting
    const canaryService = this.createServiceSpec(pluginDefinition, namespace);
    canaryService.metadata!.name = `${serviceName}-canary`;
    canaryService.spec!.selector!['version'] = 'canary';
    
    await this.applyService(canaryService, namespace);
    
    // Configure traffic splitting using Istio VirtualService (if available)
    await this.configureCanaryTrafficSplitting(pluginDefinition, namespace, 10);
    
    return {
      namespace,
      deploymentName: canaryDeploymentName,
      serviceName: `${serviceName}-canary`,
      replicas: 1,
      strategy: DeploymentStrategy.CANARY,
      imageTag: imageInfo.imageTag,
      resourceAllocation: {
        cpu: pluginDefinition.resources.cpu.limit,
        memory: pluginDefinition.resources.memory.limit
      },
      endpoints: {
        internal: `http://${serviceName}-canary.${namespace}.svc.cluster.local:${pluginDefinition.networking.ports[0]?.port}`
      },
      createdAt: new Date()
    };
  }

  /**
   * A/B test deployment strategy
   */
  private async deployABTest(
    pluginDefinition: PluginDefinition,
    imageInfo: ImageInfo,
    namespace: string
  ): Promise<DeploymentInfo> {
    // Similar to canary but with feature flags and user segmentation
    return this.deployCanary(pluginDefinition, imageInfo, namespace);
  }

  /**
   * Recreate deployment strategy
   */
  private async deployRecreate(
    pluginDefinition: PluginDefinition,
    imageInfo: ImageInfo,
    namespace: string
  ): Promise<DeploymentInfo> {
    const deployment = this.createDeploymentSpec(pluginDefinition, imageInfo, namespace);
    deployment.spec!.strategy = { type: 'Recreate' };
    
    await this.applyDeployment(deployment, namespace);
    await this.waitForDeploymentReady(deployment.metadata!.name!, namespace);
    
    return {
      namespace,
      deploymentName: deployment.metadata!.name!,
      serviceName: `${pluginDefinition.name}-service`,
      replicas: deployment.spec!.replicas || 1,
      strategy: DeploymentStrategy.RECREATE,
      imageTag: imageInfo.imageTag,
      resourceAllocation: {
        cpu: pluginDefinition.resources.cpu.limit,
        memory: pluginDefinition.resources.memory.limit
      },
      endpoints: {
        internal: `http://${pluginDefinition.name}-service.${namespace}.svc.cluster.local:${pluginDefinition.networking.ports[0]?.port}`
      },
      createdAt: new Date()
    };
  }

  /**
   * Create Kubernetes deployment specification
   */
  private createDeploymentSpec(
    pluginDefinition: PluginDefinition,
    imageInfo: ImageInfo,
    namespace: string
  ): k8s.V1Deployment {
    const deploymentName = `${pluginDefinition.name}-deployment`;
    const labels = {
      app: pluginDefinition.name,
      version: pluginDefinition.version,
      managed: 'plugin-pipeline'
    };
    
    return {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: deploymentName,
        namespace,
        labels,
        annotations: {
          'plugin-pipeline/plugin-name': pluginDefinition.name,
          'plugin-pipeline/plugin-version': pluginDefinition.version,
          'plugin-pipeline/image-tag': imageInfo.imageTag
        }
      },
      spec: {
        replicas: this.calculateReplicas(pluginDefinition),
        selector: {
          matchLabels: {
            app: pluginDefinition.name
          }
        },
        template: {
          metadata: {
            labels,
            annotations: {
              'prometheus.io/scrape': pluginDefinition.observability.metrics?.enabled ? 'true' : 'false',
              'prometheus.io/port': pluginDefinition.observability.metrics?.port?.toString() || '9090',
              'prometheus.io/path': pluginDefinition.observability.metrics?.path || '/metrics'
            }
          },
          spec: {
            serviceAccountName: `${pluginDefinition.name}-sa`,
            securityContext: {
              runAsNonRoot: pluginDefinition.security.runAsNonRoot,
              runAsUser: pluginDefinition.security.runAsUser || 1000,
              fsGroup: 1000
            },
            containers: [
              {
                name: pluginDefinition.name,
                image: `${imageInfo.imageName}:${imageInfo.imageTag}`,
                imagePullPolicy: 'Always',
                ports: pluginDefinition.networking.ports.map(port => ({
                  name: port.name,
                  containerPort: port.targetPort || port.port,
                  protocol: port.protocol
                })),
                env: this.createEnvironmentVariables(pluginDefinition),
                envFrom: [
                  ...(pluginDefinition.configuration?.configMaps?.map(name => ({ configMapRef: { name } })) || []),
                  ...(pluginDefinition.configuration?.secrets?.map(name => ({ secretRef: { name } })) || [])
                ],
                resources: {
                  requests: {
                    cpu: pluginDefinition.resources.cpu.request,
                    memory: pluginDefinition.resources.memory.request
                  },
                  limits: {
                    cpu: pluginDefinition.resources.cpu.limit,
                    memory: pluginDefinition.resources.memory.limit
                  }
                },
                livenessProbe: this.createProbe(pluginDefinition.healthChecks.liveness),
                readinessProbe: this.createProbe(pluginDefinition.healthChecks.readiness),
                startupProbe: pluginDefinition.healthChecks.startup ? 
                  this.createProbe(pluginDefinition.healthChecks.startup) : undefined,
                securityContext: {
                  allowPrivilegeEscalation: pluginDefinition.security.allowPrivilegeEscalation,
                  capabilities: {
                    drop: pluginDefinition.security.capabilities?.drop || ['ALL'],
                    add: pluginDefinition.security.capabilities?.add
                  },
                  readOnlyRootFilesystem: true
                },
                volumeMounts: [
                  ...this.createVolumeMounts(pluginDefinition),
                  { name: 'tmp', mountPath: '/tmp' },
                  { name: 'var-tmp', mountPath: '/var/tmp' }
                ]
              }
            ],
            volumes: [
              ...this.createVolumes(pluginDefinition),
              { name: 'tmp', emptyDir: { sizeLimit: '100Mi' } },
              { name: 'var-tmp', emptyDir: { sizeLimit: '100Mi' } }
            ],
            affinity: {
              podAntiAffinity: {
                preferredDuringSchedulingIgnoredDuringExecution: [
                  {
                    weight: 100,
                    podAffinityTerm: {
                      labelSelector: {
                        matchExpressions: [
                          {
                            key: 'app',
                            operator: 'In',
                            values: [pluginDefinition.name]
                          }
                        ]
                      },
                      topologyKey: 'kubernetes.io/hostname'
                    }
                  }
                ]
              }
            }
          }
        }
      }
    };
  }

  /**
   * Create Kubernetes service specification
   */
  private createServiceSpec(pluginDefinition: PluginDefinition, namespace: string): k8s.V1Service {
    return {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: `${pluginDefinition.name}-service`,
        namespace,
        labels: {
          app: pluginDefinition.name,
          managed: 'plugin-pipeline'
        }
      },
      spec: {
        selector: {
          app: pluginDefinition.name
        },
        ports: pluginDefinition.networking.ports.map(port => ({
          name: port.name,
          port: port.port,
          targetPort: port.targetPort || port.port,
          protocol: port.protocol
        })),
        type: 'ClusterIP'
      }
    };
  }

  /**
   * Create Kubernetes ingress specification
   */
  private createIngressSpec(
    pluginDefinition: PluginDefinition,
    serviceName: string,
    namespace: string
  ): k8s.V1Ingress {
    const ingress = pluginDefinition.networking.ingress!;
    
    return {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata: {
        name: `${pluginDefinition.name}-ingress`,
        namespace,
        labels: {
          app: pluginDefinition.name,
          managed: 'plugin-pipeline'
        },
        annotations: {
          'nginx.ingress.kubernetes.io/rewrite-target': '/',
          'nginx.ingress.kubernetes.io/ssl-redirect': 'true',
          ...ingress.annotations
        }
      },
      spec: {
        tls: ingress.tls?.enabled ? [
          {
            hosts: [ingress.host!],
            secretName: ingress.tls.secretName || `${pluginDefinition.name}-tls`
          }
        ] : undefined,
        rules: [
          {
            host: ingress.host,
            http: {
              paths: [
                {
                  path: ingress.path || '/',
                  pathType: ingress.pathType || 'Prefix',
                  backend: {
                    service: {
                      name: serviceName,
                      port: {
                        number: pluginDefinition.networking.ports[0]?.port
                      }
                    }
                  }
                }
              ]
            }
          }
        ]
      }
    };
  }

  /**
   * Ensure namespace exists with proper configuration
   */
  private async ensureNamespace(namespace: string, pluginDefinition: PluginDefinition): Promise<void> {
    try {
      await this.coreApi.readNamespace(namespace);
      this.logger.debug(`Namespace ${namespace} already exists`);
    } catch (error) {
      if (error.response?.statusCode === 404) {
        await this.createNamespace(namespace, pluginDefinition);
      } else {
        throw error;
      }
    }
  }

  /**
   * Create namespace with proper labels and annotations
   */
  private async createNamespace(namespace: string, pluginDefinition: PluginDefinition): Promise<void> {
    const namespaceSpec: k8s.V1Namespace = {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: {
        name: namespace,
        labels: {
          'plugin-pipeline/managed': 'true',
          'plugin-pipeline/plugin': pluginDefinition.name,
          'pod-security.kubernetes.io/enforce': 'restricted',
          'pod-security.kubernetes.io/audit': 'restricted',
          'pod-security.kubernetes.io/warn': 'restricted'
        },
        annotations: {
          'plugin-pipeline/created-at': new Date().toISOString(),
          'plugin-pipeline/plugin-version': pluginDefinition.version
        }
      }
    };
    
    await this.coreApi.createNamespace(namespaceSpec);
    this.pluginNamespaces.add(namespace);
    
    // Create service account
    await this.createServiceAccount(pluginDefinition, namespace);
    
    // Create resource quota if enabled
    if (this.config.resourceQuotaEnabled) {
      await this.createResourceQuota(pluginDefinition, namespace);
    }
    
    this.logger.info(`Created namespace ${namespace} for plugin ${pluginDefinition.name}`);
  }

  /**
   * Create service account for plugin
   */
  private async createServiceAccount(pluginDefinition: PluginDefinition, namespace: string): Promise<void> {
    const serviceAccount: k8s.V1ServiceAccount = {
      apiVersion: 'v1',
      kind: 'ServiceAccount',
      metadata: {
        name: `${pluginDefinition.name}-sa`,
        namespace,
        labels: {
          app: pluginDefinition.name,
          managed: 'plugin-pipeline'
        }
      },
      automountServiceAccountToken: false
    };
    
    await this.coreApi.createNamespacedServiceAccount(namespace, serviceAccount);
  }

  /**
   * Create resource quota for namespace
   */
  private async createResourceQuota(pluginDefinition: PluginDefinition, namespace: string): Promise<void> {
    const quota: ResourceQuota = {
      namespace,
      hard: {
        'requests.cpu': this.multiplyResource(pluginDefinition.resources.cpu.request, 10),
        'requests.memory': this.multiplyResource(pluginDefinition.resources.memory.request, 10),
        'limits.cpu': this.multiplyResource(pluginDefinition.resources.cpu.limit, 10),
        'limits.memory': this.multiplyResource(pluginDefinition.resources.memory.limit, 10),
        'requests.storage': pluginDefinition.resources.storage?.size ? 
          this.multiplyResource(pluginDefinition.resources.storage.size, 5) : '10Gi',
        'pods': '50',
        'services': '10',
        'persistentvolumeclaims': '5'
      }
    };
    
    const resourceQuotaSpec: k8s.V1ResourceQuota = {
      apiVersion: 'v1',
      kind: 'ResourceQuota',
      metadata: {
        name: `${pluginDefinition.name}-quota`,
        namespace
      },
      spec: {
        hard: quota.hard as any
      }
    };
    
    await this.coreApi.createNamespacedResourceQuota(namespace, resourceQuotaSpec);
  }

  /**
   * Get plugin health status
   */
  async getPluginHealth(pluginDefinition: PluginDefinition): Promise<HealthStatus> {
    const namespace = this.getPluginNamespace(pluginDefinition);
    const deploymentName = `${pluginDefinition.name}-deployment`;
    
    try {
      // Get deployment status
      const deployment = await this.appsApi.readNamespacedDeployment(deploymentName, namespace);
      const status = deployment.body.status!;
      
      // Get pods
      const podsResponse = await this.coreApi.listNamespacedPod(
        namespace,
        undefined,
        undefined,
        undefined,
        undefined,
        `app=${pluginDefinition.name}`
      );
      const pods = podsResponse.body.items;
      
      // Calculate health status
      const readyReplicas = status.readyReplicas || 0;
      const desiredReplicas = status.replicas || 0;
      const unhealthyPods = pods.filter(pod => 
        pod.status?.phase !== 'Running' || 
        pod.status?.containerStatuses?.some(c => !c.ready)
      );
      
      const isHealthy = readyReplicas === desiredReplicas && unhealthyPods.length === 0;
      
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        message: isHealthy ? 'All replicas are ready' : 
          `${readyReplicas}/${desiredReplicas} replicas ready, ${unhealthyPods.length} unhealthy pods`,
        timestamp: new Date(),
        checks: {
          liveness: pods.every(pod => pod.status?.containerStatuses?.every(c => c.ready) || false),
          readiness: readyReplicas === desiredReplicas
        },
        metrics: await this.getPluginMetrics(pluginDefinition, namespace)
      };
      
    } catch (error) {
      return {
        status: 'unknown',
        message: `Failed to get health status: ${error.message}`,
        timestamp: new Date()
      };
    }
  }

  /**
   * Get plugin metrics from Kubernetes metrics API
   */
  private async getPluginMetrics(
    pluginDefinition: PluginDefinition, 
    namespace: string
  ): Promise<{ cpu: number; memory: number; requests: number; errors: number }> {
    try {
      // This would integrate with metrics-server or Prometheus
      // For now, return mock data
      return {
        cpu: 0.5,
        memory: 0.7,
        requests: 100,
        errors: 0
      };
    } catch (error) {
      this.logger.warn(`Failed to get metrics for ${pluginDefinition.name}: ${error.message}`);
      return { cpu: 0, memory: 0, requests: 0, errors: 0 };
    }
  }

  /**
   * Remove plugin deployment and all resources
   */
  async removePluginDeployment(pluginDefinition: PluginDefinition): Promise<void> {
    const namespace = this.getPluginNamespace(pluginDefinition);
    
    try {
      // Delete deployment
      await this.deleteDeployment(`${pluginDefinition.name}-deployment`, namespace);
      
      // Delete service
      await this.coreApi.deleteNamespacedService(`${pluginDefinition.name}-service`, namespace);
      
      // Delete ingress if it exists
      if (pluginDefinition.networking.ingress?.enabled) {
        await this.networkingApi.deleteNamespacedIngress(`${pluginDefinition.name}-ingress`, namespace);
      }
      
      // Delete HPA if it exists
      try {
        await this.autoscalingApi.deleteNamespacedHorizontalPodAutoscaler(
          `${pluginDefinition.name}-hpa`, 
          namespace
        );
      } catch (error) {
        // HPA might not exist
      }
      
      this.logger.info(`Removed all resources for plugin ${pluginDefinition.name} from namespace ${namespace}`);
      
    } catch (error) {
      this.logger.error(`Failed to remove plugin resources: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clean up failed deployment
   */
  async cleanupFailedDeployment(pluginDefinition: PluginDefinition): Promise<void> {
    const namespace = this.getPluginNamespace(pluginDefinition);
    
    // Remove any partial resources
    try {
      await this.removePluginDeployment(pluginDefinition);
    } catch (error) {
      this.logger.warn(`Cleanup warning: ${error.message}`);
    }
  }

  // Helper methods continue...
  
  private getPluginNamespace(pluginDefinition: PluginDefinition): string {
    return `plugin-${pluginDefinition.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
  }
  
  private calculateReplicas(pluginDefinition: PluginDefinition): number {
    // Calculate based on resource requirements and expected load
    return 3; // Default for high availability
  }
  
  private createEnvironmentVariables(pluginDefinition: PluginDefinition): k8s.V1EnvVar[] {
    const env: k8s.V1EnvVar[] = [];
    
    if (pluginDefinition.configuration?.environment) {
      for (const [key, value] of Object.entries(pluginDefinition.configuration.environment)) {
        env.push({ name: key, value });
      }
    }
    
    return env;
  }
  
  private createProbe(healthCheck: any): k8s.V1Probe {
    const probe: k8s.V1Probe = {
      initialDelaySeconds: healthCheck.initialDelaySeconds,
      periodSeconds: healthCheck.periodSeconds,
      timeoutSeconds: healthCheck.timeoutSeconds,
      successThreshold: healthCheck.successThreshold,
      failureThreshold: healthCheck.failureThreshold
    };
    
    if (healthCheck.type === 'http') {
      probe.httpGet = {
        path: healthCheck.path,
        port: healthCheck.port || 'http',
        scheme: 'HTTP'
      };
    } else if (healthCheck.type === 'tcp') {
      probe.tcpSocket = {
        port: healthCheck.port || 'http'
      };
    } else if (healthCheck.type === 'exec') {
      probe.exec = {
        command: healthCheck.command
      };
    }
    
    return probe;
  }
  
  private createVolumeMounts(pluginDefinition: PluginDefinition): k8s.V1VolumeMount[] {
    return pluginDefinition.persistence?.volumes?.map(vol => ({
      name: vol.name,
      mountPath: vol.mountPath,
      readOnly: vol.readOnly
    })) || [];
  }
  
  private createVolumes(pluginDefinition: PluginDefinition): k8s.V1Volume[] {
    return pluginDefinition.persistence?.volumes?.map(vol => ({
      name: vol.name,
      persistentVolumeClaim: vol.size ? {
        claimName: `${pluginDefinition.name}-${vol.name}-pvc`
      } : undefined,
      emptyDir: !vol.size ? {} : undefined
    })) || [];
  }
  
  private multiplyResource(resource: string, multiplier: number): string {
    const match = resource.match(/^(\d+)(.*)$/);
    if (match) {
      const [, value, unit] = match;
      return `${parseInt(value) * multiplier}${unit}`;
    }
    return resource;
  }
  
  private async applyDeployment(deployment: k8s.V1Deployment, namespace: string): Promise<void> {
    try {
      await this.appsApi.replaceNamespacedDeployment(deployment.metadata!.name!, namespace, deployment);
    } catch (error) {
      if (error.response?.statusCode === 404) {
        await this.appsApi.createNamespacedDeployment(namespace, deployment);
      } else {
        throw error;
      }
    }
  }
  
  private async applyService(service: k8s.V1Service, namespace: string): Promise<void> {
    try {
      await this.coreApi.replaceNamespacedService(service.metadata!.name!, namespace, service);
    } catch (error) {
      if (error.response?.statusCode === 404) {
        await this.coreApi.createNamespacedService(namespace, service);
      } else {
        throw error;
      }
    }
  }
  
  private async applyIngress(ingress: k8s.V1Ingress, namespace: string): Promise<void> {
    try {
      await this.networkingApi.replaceNamespacedIngress(ingress.metadata!.name!, namespace, ingress);
    } catch (error) {
      if (error.response?.statusCode === 404) {
        await this.networkingApi.createNamespacedIngress(namespace, ingress);
      } else {
        throw error;
      }
    }
  }
  
  private async waitForDeploymentReady(deploymentName: string, namespace: string): Promise<void> {
    const maxAttempts = 60;
    const interval = 5000;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const deployment = await this.appsApi.readNamespacedDeployment(deploymentName, namespace);
        const status = deployment.body.status!;
        
        if (status.readyReplicas === status.replicas && status.replicas! > 0) {
          return;
        }
        
        if (attempt === maxAttempts) {
          throw new Error(`Deployment ${deploymentName} failed to become ready after ${maxAttempts} attempts`);
        }
        
        await new Promise(resolve => setTimeout(resolve, interval));
        
      } catch (error) {
        if (attempt === maxAttempts) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
  }
  
  private async deleteDeployment(deploymentName: string, namespace: string): Promise<void> {
    try {
      await this.appsApi.deleteNamespacedDeployment(deploymentName, namespace);
    } catch (error) {
      if (error.response?.statusCode !== 404) {
        throw error;
      }
    }
  }
  
  // Additional helper methods would be implemented here for:
  // - getCurrentDeploymentColor
  // - switchBlueGreenTraffic  
  // - performHealthChecks
  // - configureCanaryTrafficSplitting
  // - setupAutoScaling
  // - createNetworkPolicies
  // - createPluginConfiguration
}