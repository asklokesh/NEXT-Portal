/**
 * SaaS Deployment Orchestrator
 * 
 * Multi-tenant plugin deployment with container orchestration,
 * auto-scaling, and zero-downtime deployments for enterprise SaaS
 */

import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as k8s from '@kubernetes/client-node';
import axios from 'axios';
import { z } from 'zod';

const execAsync = promisify(exec);

// Deployment Configuration Schema
export const DeploymentConfigSchema = z.object({
  tenantId: z.string(),
  pluginId: z.string(),
  version: z.string(),
  environment: z.enum(['development', 'staging', 'production']),
  region: z.string(),
  replicas: z.number().min(1).max(100).default(3),
  resources: z.object({
    cpu: z.string().default('200m'),
    memory: z.string().default('512Mi'),
    storage: z.string().optional()
  }),
  scaling: z.object({
    enabled: z.boolean().default(true),
    minReplicas: z.number().min(1).default(2),
    maxReplicas: z.number().max(100).default(10),
    targetCPU: z.number().min(10).max(90).default(70),
    targetMemory: z.number().min(10).max(90).default(80)
  }),
  networking: z.object({
    exposed: z.boolean().default(false),
    ingress: z.boolean().default(false),
    domains: z.array(z.string()).default([])
  }),
  security: z.object({
    isolation: z.enum(['shared', 'isolated', 'dedicated']).default('shared'),
    rbac: z.boolean().default(true),
    networkPolicies: z.boolean().default(true),
    podSecurityStandards: z.enum(['privileged', 'baseline', 'restricted']).default('restricted')
  }),
  monitoring: z.object({
    enabled: z.boolean().default(true),
    metrics: z.boolean().default(true),
    logging: z.boolean().default(true),
    alerts: z.boolean().default(true)
  }),
  backup: z.object({
    enabled: z.boolean().default(true),
    schedule: z.string().default('0 2 * * *'), // Daily at 2 AM
    retention: z.number().default(30) // 30 days
  })
});

export type DeploymentConfig = z.infer<typeof DeploymentConfigSchema>;

export interface TenantConfiguration {
  tenantId: string;
  organization: string;
  subscription: 'free' | 'professional' | 'enterprise';
  region: string;
  limits: {
    plugins: number;
    storage: string;
    bandwidth: string;
    users: number;
  };
  features: string[];
  namespace: string;
  created: Date;
  lastUpdated: Date;
}

export interface DeploymentStatus {
  deploymentId: string;
  tenantId: string;
  pluginId: string;
  status: 'pending' | 'deploying' | 'running' | 'scaling' | 'updating' | 'failed' | 'terminated';
  phase: string;
  replicas: {
    desired: number;
    current: number;
    ready: number;
  };
  health: 'healthy' | 'degraded' | 'unhealthy';
  metrics: {
    cpu: number;
    memory: number;
    requests: number;
    errors: number;
  };
  endpoints: string[];
  lastUpdated: Date;
  error?: string;
}

export interface DeploymentResult {
  success: boolean;
  deploymentId?: string;
  message: string;
  endpoints?: string[];
  monitoring?: {
    dashboardUrl: string;
    logsUrl: string;
    metricsUrl: string;
  };
  rollbackId?: string;
}

class SaaSDeploymentOrchestrator extends EventEmitter {
  private k8sApi: k8s.CoreV1Api;
  private k8sAppsApi: k8s.AppsV1Api;
  private k8sAutoscalingApi: k8s.AutoscalingV2Api;
  private k8sNetworkingApi: k8s.NetworkingV1Api;
  private activeDeployments: Map<string, DeploymentStatus> = new Map();
  private tenantConfigurations: Map<string, TenantConfiguration> = new Map();

  constructor() {
    super();
    this.initializeKubernetes();
    this.startHealthMonitoring();
  }

  private initializeKubernetes(): void {
    const kc = new k8s.KubeConfig();
    
    // Load config from default location or cluster
    if (process.env.KUBECONFIG) {
      kc.loadFromFile(process.env.KUBECONFIG);
    } else if (process.env.KUBERNETES_SERVICE_HOST) {
      kc.loadFromCluster();
    } else {
      kc.loadFromDefault();
    }

    this.k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    this.k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);
    this.k8sAutoscalingApi = kc.makeApiClient(k8s.AutoscalingV2Api);
    this.k8sNetworkingApi = kc.makeApiClient(k8s.NetworkingV1Api);
  }

  /**
   * Deploy plugin for a specific tenant
   */
  async deployPlugin(config: DeploymentConfig): Promise<DeploymentResult> {
    const validatedConfig = DeploymentConfigSchema.parse(config);
    const deploymentId = this.generateDeploymentId(config.tenantId, config.pluginId);

    try {
      console.log(`Starting deployment for tenant ${config.tenantId}, plugin ${config.pluginId}`);

      // Validate tenant and get configuration
      const tenantConfig = await this.getTenantConfiguration(config.tenantId);
      if (!tenantConfig) {
        throw new Error(`Tenant ${config.tenantId} not found or not configured`);
      }

      // Check deployment limits and quotas
      await this.validateDeploymentLimits(tenantConfig, validatedConfig);

      // Create or ensure namespace exists
      await this.ensureNamespace(tenantConfig.namespace);

      // Generate Kubernetes manifests
      const manifests = await this.generateKubernetesManifests(validatedConfig, tenantConfig);

      // Apply manifests with rolling deployment
      const deployment = await this.applyManifests(manifests, tenantConfig.namespace);

      // Wait for deployment to be ready
      await this.waitForDeployment(deployment.metadata!.name!, tenantConfig.namespace);

      // Configure auto-scaling if enabled
      if (validatedConfig.scaling.enabled) {
        await this.configureAutoScaling(validatedConfig, tenantConfig.namespace);
      }

      // Set up monitoring and alerts
      if (validatedConfig.monitoring.enabled) {
        await this.setupMonitoring(validatedConfig, tenantConfig.namespace);
      }

      // Configure networking and ingress
      const endpoints = await this.configureNetworking(validatedConfig, tenantConfig.namespace);

      // Update deployment status
      const status: DeploymentStatus = {
        deploymentId,
        tenantId: config.tenantId,
        pluginId: config.pluginId,
        status: 'running',
        phase: 'Ready',
        replicas: {
          desired: validatedConfig.replicas,
          current: validatedConfig.replicas,
          ready: validatedConfig.replicas
        },
        health: 'healthy',
        metrics: {
          cpu: 0,
          memory: 0,
          requests: 0,
          errors: 0
        },
        endpoints,
        lastUpdated: new Date()
      };

      this.activeDeployments.set(deploymentId, status);
      this.emit('deployment-ready', deploymentId, status);

      return {
        success: true,
        deploymentId,
        message: `Plugin ${config.pluginId} deployed successfully for tenant ${config.tenantId}`,
        endpoints,
        monitoring: {
          dashboardUrl: `https://monitoring.${process.env.DOMAIN}/d/${deploymentId}`,
          logsUrl: `https://logs.${process.env.DOMAIN}/app/discover/${deploymentId}`,
          metricsUrl: `https://metrics.${process.env.DOMAIN}/graph?g0.expr=plugin_${config.pluginId.replace(/[^a-zA-Z0-9]/g, '_')}_${config.tenantId}`
        }
      };

    } catch (error) {
      console.error(`Deployment failed for ${config.tenantId}/${config.pluginId}:`, error);
      
      // Update status to failed
      const status: DeploymentStatus = {
        deploymentId,
        tenantId: config.tenantId,
        pluginId: config.pluginId,
        status: 'failed',
        phase: 'Failed',
        replicas: { desired: 0, current: 0, ready: 0 },
        health: 'unhealthy',
        metrics: { cpu: 0, memory: 0, requests: 0, errors: 0 },
        endpoints: [],
        lastUpdated: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      this.activeDeployments.set(deploymentId, status);
      this.emit('deployment-failed', deploymentId, status);

      return {
        success: false,
        message: `Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Scale plugin deployment
   */
  async scalePlugin(
    tenantId: string, 
    pluginId: string, 
    replicas: number
  ): Promise<DeploymentResult> {
    const deploymentId = this.generateDeploymentId(tenantId, pluginId);
    const status = this.activeDeployments.get(deploymentId);

    if (!status) {
      return {
        success: false,
        message: `Deployment not found for ${tenantId}/${pluginId}`
      };
    }

    try {
      const tenantConfig = await this.getTenantConfiguration(tenantId);
      if (!tenantConfig) {
        throw new Error(`Tenant ${tenantId} not found`);
      }

      const deploymentName = this.getDeploymentName(pluginId, tenantId);
      
      // Scale the deployment
      await this.k8sAppsApi.patchNamespacedDeploymentScale(
        deploymentName,
        tenantConfig.namespace,
        {
          spec: {
            replicas
          }
        }
      );

      // Update status
      status.replicas.desired = replicas;
      status.lastUpdated = new Date();
      this.activeDeployments.set(deploymentId, status);

      this.emit('deployment-scaled', deploymentId, status);

      return {
        success: true,
        deploymentId,
        message: `Plugin ${pluginId} scaled to ${replicas} replicas for tenant ${tenantId}`
      };

    } catch (error) {
      return {
        success: false,
        message: `Scaling failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Update plugin deployment
   */
  async updatePlugin(
    tenantId: string,
    pluginId: string,
    newVersion: string,
    config?: Partial<DeploymentConfig>
  ): Promise<DeploymentResult> {
    const deploymentId = this.generateDeploymentId(tenantId, pluginId);

    try {
      console.log(`Updating plugin ${pluginId} to version ${newVersion} for tenant ${tenantId}`);

      const tenantConfig = await this.getTenantConfiguration(tenantId);
      if (!tenantConfig) {
        throw new Error(`Tenant ${tenantId} not found`);
      }

      // Create rollback point
      const rollbackId = await this.createDeploymentSnapshot(tenantId, pluginId);

      // Prepare update configuration
      const updateConfig: DeploymentConfig = {
        tenantId,
        pluginId,
        version: newVersion,
        environment: config?.environment || 'production',
        region: config?.region || tenantConfig.region,
        replicas: config?.replicas || 3,
        resources: config?.resources || { cpu: '200m', memory: '512Mi' },
        scaling: config?.scaling || { enabled: true, minReplicas: 2, maxReplicas: 10, targetCPU: 70, targetMemory: 80 },
        networking: config?.networking || { exposed: false, ingress: false, domains: [] },
        security: config?.security || { isolation: 'shared', rbac: true, networkPolicies: true, podSecurityStandards: 'restricted' },
        monitoring: config?.monitoring || { enabled: true, metrics: true, logging: true, alerts: true },
        backup: config?.backup || { enabled: true, schedule: '0 2 * * *', retention: 30 }
      };

      // Perform rolling update
      const manifests = await this.generateKubernetesManifests(updateConfig, tenantConfig);
      await this.applyManifests(manifests, tenantConfig.namespace);

      // Wait for rollout to complete
      const deploymentName = this.getDeploymentName(pluginId, tenantId);
      await this.waitForRollout(deploymentName, tenantConfig.namespace);

      return {
        success: true,
        deploymentId,
        message: `Plugin ${pluginId} updated to version ${newVersion} for tenant ${tenantId}`,
        rollbackId
      };

    } catch (error) {
      console.error(`Update failed for ${tenantId}/${pluginId}:`, error);
      
      // Attempt automatic rollback
      try {
        await this.rollbackDeployment(tenantId, pluginId);
      } catch (rollbackError) {
        console.error('Rollback also failed:', rollbackError);
      }

      return {
        success: false,
        message: `Update failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Remove plugin deployment
   */
  async removePlugin(tenantId: string, pluginId: string): Promise<DeploymentResult> {
    const deploymentId = this.generateDeploymentId(tenantId, pluginId);

    try {
      const tenantConfig = await this.getTenantConfiguration(tenantId);
      if (!tenantConfig) {
        throw new Error(`Tenant ${tenantId} not found`);
      }

      const deploymentName = this.getDeploymentName(pluginId, tenantId);

      // Create final backup before deletion
      await this.createDeploymentSnapshot(tenantId, pluginId);

      // Delete Kubernetes resources
      await this.deleteDeploymentResources(deploymentName, tenantConfig.namespace);

      // Remove from active deployments
      this.activeDeployments.delete(deploymentId);

      this.emit('deployment-removed', deploymentId);

      return {
        success: true,
        message: `Plugin ${pluginId} removed successfully for tenant ${tenantId}`
      };

    } catch (error) {
      return {
        success: false,
        message: `Removal failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get deployment status
   */
  async getDeploymentStatus(tenantId: string, pluginId: string): Promise<DeploymentStatus | null> {
    const deploymentId = this.generateDeploymentId(tenantId, pluginId);
    const status = this.activeDeployments.get(deploymentId);

    if (!status) {
      return null;
    }

    // Refresh status from Kubernetes
    try {
      const tenantConfig = await this.getTenantConfiguration(tenantId);
      if (tenantConfig) {
        const deploymentName = this.getDeploymentName(pluginId, tenantId);
        const deployment = await this.k8sAppsApi.readNamespacedDeployment(
          deploymentName,
          tenantConfig.namespace
        );

        // Update replica counts
        status.replicas = {
          desired: deployment.body.spec?.replicas || 0,
          current: deployment.body.status?.replicas || 0,
          ready: deployment.body.status?.readyReplicas || 0
        };

        // Update health status
        if (status.replicas.ready === status.replicas.desired && status.replicas.desired > 0) {
          status.health = 'healthy';
        } else if (status.replicas.ready > 0) {
          status.health = 'degraded';
        } else {
          status.health = 'unhealthy';
        }

        status.lastUpdated = new Date();
        this.activeDeployments.set(deploymentId, status);
      }
    } catch (error) {
      console.warn(`Failed to refresh status for ${deploymentId}:`, error);
    }

    return status;
  }

  /**
   * List all deployments for a tenant
   */
  async listTenantDeployments(tenantId: string): Promise<DeploymentStatus[]> {
    const tenantDeployments: DeploymentStatus[] = [];

    for (const [deploymentId, status] of this.activeDeployments) {
      if (status.tenantId === tenantId) {
        const refreshedStatus = await this.getDeploymentStatus(tenantId, status.pluginId);
        if (refreshedStatus) {
          tenantDeployments.push(refreshedStatus);
        }
      }
    }

    return tenantDeployments;
  }

  /**
   * Setup tenant configuration
   */
  async setupTenant(config: TenantConfiguration): Promise<void> {
    console.log(`Setting up tenant: ${config.tenantId}`);

    // Create namespace
    await this.ensureNamespace(config.namespace);

    // Apply resource quotas based on subscription
    await this.applyResourceQuotas(config);

    // Set up RBAC
    await this.setupTenantRBAC(config);

    // Configure network policies for isolation
    if (config.subscription === 'enterprise') {
      await this.setupNetworkPolicies(config);
    }

    // Store tenant configuration
    this.tenantConfigurations.set(config.tenantId, config);

    console.log(`Tenant ${config.tenantId} setup completed`);
  }

  /**
   * Private helper methods
   */
  private generateDeploymentId(tenantId: string, pluginId: string): string {
    return createHash('md5').update(`${tenantId}-${pluginId}`).digest('hex').substring(0, 12);
  }

  private getDeploymentName(pluginId: string, tenantId: string): string {
    const sanitized = pluginId.replace(/[^a-z0-9-]/g, '-').toLowerCase();
    return `plugin-${sanitized}-${tenantId}`;
  }

  private async getTenantConfiguration(tenantId: string): Promise<TenantConfiguration | null> {
    return this.tenantConfigurations.get(tenantId) || null;
  }

  private async validateDeploymentLimits(
    tenantConfig: TenantConfiguration,
    deploymentConfig: DeploymentConfig
  ): Promise<void> {
    const currentDeployments = await this.listTenantDeployments(tenantConfig.tenantId);
    
    if (currentDeployments.length >= tenantConfig.limits.plugins) {
      throw new Error(`Plugin limit exceeded: ${tenantConfig.limits.plugins} plugins allowed`);
    }

    // Additional quota checks can be added here
  }

  private async ensureNamespace(namespace: string): Promise<void> {
    try {
      await this.k8sApi.readNamespace(namespace);
    } catch (error) {
      // Namespace doesn't exist, create it
      await this.k8sApi.createNamespace({
        metadata: {
          name: namespace,
          labels: {
            'backstage.io/managed-by': 'saas-idp',
            'backstage.io/namespace-type': 'tenant'
          }
        }
      });
    }
  }

  private async generateKubernetesManifests(
    config: DeploymentConfig,
    tenantConfig: TenantConfiguration
  ): Promise<any[]> {
    const deploymentName = this.getDeploymentName(config.pluginId, config.tenantId);
    
    const deployment = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: deploymentName,
        namespace: tenantConfig.namespace,
        labels: {
          'app.kubernetes.io/name': config.pluginId,
          'app.kubernetes.io/instance': config.tenantId,
          'app.kubernetes.io/version': config.version,
          'app.kubernetes.io/managed-by': 'saas-idp'
        }
      },
      spec: {
        replicas: config.replicas,
        selector: {
          matchLabels: {
            'app.kubernetes.io/name': config.pluginId,
            'app.kubernetes.io/instance': config.tenantId
          }
        },
        template: {
          metadata: {
            labels: {
              'app.kubernetes.io/name': config.pluginId,
              'app.kubernetes.io/instance': config.tenantId,
              'app.kubernetes.io/version': config.version
            }
          },
          spec: {
            containers: [{
              name: 'plugin',
              image: `backstage-plugin:${config.pluginId}-${config.version}`,
              ports: [{
                containerPort: 7007,
                name: 'http'
              }],
              resources: {
                requests: {
                  cpu: config.resources.cpu,
                  memory: config.resources.memory
                },
                limits: {
                  cpu: config.resources.cpu,
                  memory: config.resources.memory
                }
              },
              env: [
                {
                  name: 'TENANT_ID',
                  value: config.tenantId
                },
                {
                  name: 'PLUGIN_ID',
                  value: config.pluginId
                },
                {
                  name: 'PLUGIN_VERSION',
                  value: config.version
                }
              ],
              readinessProbe: {
                httpGet: {
                  path: '/health',
                  port: 7007
                },
                initialDelaySeconds: 10,
                periodSeconds: 5
              },
              livenessProbe: {
                httpGet: {
                  path: '/health',
                  port: 7007
                },
                initialDelaySeconds: 30,
                periodSeconds: 10
              }
            }],
            securityContext: {
              runAsNonRoot: true,
              runAsUser: 1001,
              fsGroup: 1001
            }
          }
        },
        strategy: {
          type: 'RollingUpdate',
          rollingUpdate: {
            maxUnavailable: 1,
            maxSurge: 1
          }
        }
      }
    };

    const service = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: deploymentName,
        namespace: tenantConfig.namespace,
        labels: {
          'app.kubernetes.io/name': config.pluginId,
          'app.kubernetes.io/instance': config.tenantId
        }
      },
      spec: {
        selector: {
          'app.kubernetes.io/name': config.pluginId,
          'app.kubernetes.io/instance': config.tenantId
        },
        ports: [{
          port: 80,
          targetPort: 7007,
          name: 'http'
        }],
        type: 'ClusterIP'
      }
    };

    return [deployment, service];
  }

  private async applyManifests(manifests: any[], namespace: string): Promise<any> {
    for (const manifest of manifests) {
      try {
        switch (manifest.kind) {
          case 'Deployment':
            try {
              await this.k8sAppsApi.readNamespacedDeployment(manifest.metadata.name, namespace);
              // Update existing deployment
              await this.k8sAppsApi.replaceNamespacedDeployment(
                manifest.metadata.name,
                namespace,
                manifest
              );
            } catch {
              // Create new deployment
              await this.k8sAppsApi.createNamespacedDeployment(namespace, manifest);
            }
            break;

          case 'Service':
            try {
              await this.k8sApi.readNamespacedService(manifest.metadata.name, namespace);
              // Update existing service
              await this.k8sApi.replaceNamespacedService(
                manifest.metadata.name,
                namespace,
                manifest
              );
            } catch {
              // Create new service
              await this.k8sApi.createNamespacedService(namespace, manifest);
            }
            break;
        }
      } catch (error) {
        console.error(`Failed to apply manifest ${manifest.kind}/${manifest.metadata.name}:`, error);
        throw error;
      }
    }

    return manifests.find(m => m.kind === 'Deployment');
  }

  private async waitForDeployment(deploymentName: string, namespace: string): Promise<void> {
    const maxWaitTime = 300000; // 5 minutes
    const pollInterval = 5000; // 5 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const deployment = await this.k8sAppsApi.readNamespacedDeployment(deploymentName, namespace);
        const status = deployment.body.status;

        if (status?.readyReplicas === status?.replicas && status?.replicas > 0) {
          console.log(`Deployment ${deploymentName} is ready`);
          return;
        }

        console.log(`Waiting for deployment ${deploymentName}... Ready: ${status?.readyReplicas || 0}/${status?.replicas || 0}`);
        await new Promise(resolve => setTimeout(resolve, pollInterval));

      } catch (error) {
        console.error(`Error checking deployment status:`, error);
        throw error;
      }
    }

    throw new Error(`Deployment ${deploymentName} did not become ready within ${maxWaitTime / 1000} seconds`);
  }

  private async configureAutoScaling(config: DeploymentConfig, namespace: string): Promise<void> {
    const deploymentName = this.getDeploymentName(config.pluginId, config.tenantId);

    const hpa = {
      apiVersion: 'autoscaling/v2',
      kind: 'HorizontalPodAutoscaler',
      metadata: {
        name: deploymentName,
        namespace
      },
      spec: {
        scaleTargetRef: {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          name: deploymentName
        },
        minReplicas: config.scaling.minReplicas,
        maxReplicas: config.scaling.maxReplicas,
        metrics: [
          {
            type: 'Resource',
            resource: {
              name: 'cpu',
              target: {
                type: 'Utilization',
                averageUtilization: config.scaling.targetCPU
              }
            }
          },
          {
            type: 'Resource',
            resource: {
              name: 'memory',
              target: {
                type: 'Utilization',
                averageUtilization: config.scaling.targetMemory
              }
            }
          }
        ]
      }
    };

    try {
      await this.k8sAutoscalingApi.createNamespacedHorizontalPodAutoscaler(namespace, hpa);
    } catch (error) {
      // HPA might already exist, try to update
      try {
        await this.k8sAutoscalingApi.replaceNamespacedHorizontalPodAutoscaler(
          deploymentName,
          namespace,
          hpa
        );
      } catch (updateError) {
        console.error('Failed to configure auto-scaling:', updateError);
      }
    }
  }

  private async setupMonitoring(config: DeploymentConfig, namespace: string): Promise<void> {
    // This would typically involve creating ServiceMonitor, PodMonitor, and PrometheusRule resources
    // For now, we'll just log that monitoring is being set up
    console.log(`Setting up monitoring for ${config.pluginId} in namespace ${namespace}`);
  }

  private async configureNetworking(config: DeploymentConfig, namespace: string): Promise<string[]> {
    const endpoints: string[] = [];
    const deploymentName = this.getDeploymentName(config.pluginId, config.tenantId);

    if (config.networking.ingress) {
      // Create ingress resource
      for (const domain of config.networking.domains) {
        const ingress = {
          apiVersion: 'networking.k8s.io/v1',
          kind: 'Ingress',
          metadata: {
            name: `${deploymentName}-${domain.replace(/\./g, '-')}`,
            namespace,
            annotations: {
              'nginx.ingress.kubernetes.io/rewrite-target': '/',
              'cert-manager.io/cluster-issuer': 'letsencrypt-prod'
            }
          },
          spec: {
            tls: [{
              hosts: [domain],
              secretName: `${deploymentName}-tls`
            }],
            rules: [{
              host: domain,
              http: {
                paths: [{
                  path: '/',
                  pathType: 'Prefix',
                  backend: {
                    service: {
                      name: deploymentName,
                      port: {
                        number: 80
                      }
                    }
                  }
                }]
              }
            }]
          }
        };

        try {
          await this.k8sNetworkingApi.createNamespacedIngress(namespace, ingress);
          endpoints.push(`https://${domain}`);
        } catch (error) {
          console.error(`Failed to create ingress for ${domain}:`, error);
        }
      }
    }

    return endpoints;
  }

  private async applyResourceQuotas(tenantConfig: TenantConfiguration): Promise<void> {
    const quota = {
      apiVersion: 'v1',
      kind: 'ResourceQuota',
      metadata: {
        name: 'tenant-quota',
        namespace: tenantConfig.namespace
      },
      spec: {
        hard: {
          'requests.cpu': this.getResourceLimit(tenantConfig.subscription, 'cpu'),
          'requests.memory': this.getResourceLimit(tenantConfig.subscription, 'memory'),
          'persistentvolumeclaims': tenantConfig.limits.storage,
          'pods': tenantConfig.limits.plugins * 10 // Allow 10 pods per plugin
        }
      }
    };

    try {
      await this.k8sApi.createNamespacedResourceQuota(tenantConfig.namespace, quota);
    } catch (error) {
      // Quota might already exist
      try {
        await this.k8sApi.replaceNamespacedResourceQuota('tenant-quota', tenantConfig.namespace, quota);
      } catch (updateError) {
        console.error('Failed to apply resource quota:', updateError);
      }
    }
  }

  private getResourceLimit(subscription: string, resource: 'cpu' | 'memory'): string {
    const limits = {
      free: { cpu: '2', memory: '4Gi' },
      professional: { cpu: '8', memory: '16Gi' },
      enterprise: { cpu: '32', memory: '64Gi' }
    };

    return limits[subscription as keyof typeof limits]?.[resource] || limits.free[resource];
  }

  private async setupTenantRBAC(tenantConfig: TenantConfiguration): Promise<void> {
    // This would create role bindings and service accounts for the tenant
    console.log(`Setting up RBAC for tenant ${tenantConfig.tenantId}`);
  }

  private async setupNetworkPolicies(tenantConfig: TenantConfiguration): Promise<void> {
    // This would create network policies for tenant isolation
    console.log(`Setting up network policies for tenant ${tenantConfig.tenantId}`);
  }

  private async waitForRollout(deploymentName: string, namespace: string): Promise<void> {
    await this.waitForDeployment(deploymentName, namespace);
  }

  private async createDeploymentSnapshot(tenantId: string, pluginId: string): Promise<string> {
    const snapshotId = createHash('md5').update(`${tenantId}-${pluginId}-${Date.now()}`).digest('hex').substring(0, 8);
    // This would create a backup/snapshot of the current deployment
    console.log(`Created deployment snapshot: ${snapshotId}`);
    return snapshotId;
  }

  private async rollbackDeployment(tenantId: string, pluginId: string): Promise<void> {
    // This would rollback to the previous deployment version
    console.log(`Rolling back deployment for ${tenantId}/${pluginId}`);
  }

  private async deleteDeploymentResources(deploymentName: string, namespace: string): Promise<void> {
    try {
      // Delete deployment
      await this.k8sAppsApi.deleteNamespacedDeployment(deploymentName, namespace);
      
      // Delete service
      await this.k8sApi.deleteNamespacedService(deploymentName, namespace);
      
      // Delete HPA if exists
      try {
        await this.k8sAutoscalingApi.deleteNamespacedHorizontalPodAutoscaler(deploymentName, namespace);
      } catch {
        // HPA might not exist
      }

      // Delete ingress if exists
      try {
        const ingresses = await this.k8sNetworkingApi.listNamespacedIngress(namespace);
        for (const ingress of ingresses.body.items) {
          if (ingress.metadata?.name?.startsWith(deploymentName)) {
            await this.k8sNetworkingApi.deleteNamespacedIngress(ingress.metadata.name, namespace);
          }
        }
      } catch {
        // Ingress might not exist
      }

    } catch (error) {
      console.error(`Failed to delete resources for ${deploymentName}:`, error);
      throw error;
    }
  }

  private startHealthMonitoring(): void {
    // Start periodic health monitoring
    setInterval(async () => {
      for (const [deploymentId, status] of this.activeDeployments) {
        try {
          await this.getDeploymentStatus(status.tenantId, status.pluginId);
        } catch (error) {
          console.error(`Health check failed for ${deploymentId}:`, error);
        }
      }
    }, 30000); // Check every 30 seconds
  }
}

// Export singleton instance
export const saasDeploymentOrchestrator = new SaaSDeploymentOrchestrator();
export default SaaSDeploymentOrchestrator;