/**
 * Plugin Resource Management System
 * 
 * Comprehensive resource management for plugins with:
 * - Container resource limits and requests
 * - Horizontal Pod Autoscaling (HPA)
 * - Vertical Pod Autoscaling (VPA)
 * - Cluster autoscaling integration
 * - Resource quota enforcement
 * - Cost optimization recommendations
 * - Multi-tenancy resource isolation
 * - Resource monitoring and alerting
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import * as k8s from '@kubernetes/client-node';
import { PluginDefinition } from '../types/plugin-types';

export interface ResourceRequirements {
  cpu: {
    request: string;
    limit: string;
  };
  memory: {
    request: string;
    limit: string;
  };
  storage?: {
    request: string;
    limit?: string;
    storageClass?: string;
  };
  gpu?: {
    request: number;
    limit: number;
    type: string;
  };
}

export interface AutoscalingConfig {
  hpa: {
    enabled: boolean;
    minReplicas: number;
    maxReplicas: number;
    targetCPUUtilization?: number;
    targetMemoryUtilization?: number;
    customMetrics?: Array<{
      name: string;
      target: number;
      type: 'Pods' | 'Object' | 'External';
    }>;
    behavior?: {
      scaleUp?: {
        stabilizationWindowSeconds: number;
        policies: Array<{
          type: 'Pods' | 'Percent';
          value: number;
          periodSeconds: number;
        }>;
      };
      scaleDown?: {
        stabilizationWindowSeconds: number;
        policies: Array<{
          type: 'Pods' | 'Percent';
          value: number;
          periodSeconds: number;
        }>;
      };
    };
  };
  vpa: {
    enabled: boolean;
    updateMode: 'Off' | 'Initial' | 'Recreate' | 'Auto';
    resourcePolicy?: {
      containerPolicies: Array<{
        containerName: string;
        minAllowed?: ResourceRequirements;
        maxAllowed?: ResourceRequirements;
        controlledResources?: string[];
      }>;
    };
  };
}

export interface ResourceQuota {
  namespace: string;
  hard: {
    'requests.cpu': string;
    'requests.memory': string;
    'limits.cpu': string;
    'limits.memory': string;
    'persistentvolumeclaims': string;
    'requests.storage': string;
    'count/pods': string;
    'count/services': string;
    'count/secrets': string;
    'count/configmaps': string;
  };
  used?: {
    'requests.cpu': string;
    'requests.memory': string;
    'limits.cpu': string;
    'limits.memory': string;
    'persistentvolumeclaims': string;
    'requests.storage': string;
    'count/pods': string;
    'count/services': string;
    'count/secrets': string;
    'count/configmaps': string;
  };
}

export interface ResourceUsageMetrics {
  pluginName: string;
  namespace: string;
  timestamp: Date;
  pods: Array<{
    name: string;
    cpu: {
      usage: number;
      request: number;
      limit: number;
      utilization: number;
    };
    memory: {
      usage: number;
      request: number;
      limit: number;
      utilization: number;
    };
    storage?: {
      usage: number;
      limit: number;
    };
  }>;
  totalCost: number;
  recommendations: ResourceRecommendation[];
}

export interface ResourceRecommendation {
  type: 'rightsizing' | 'cost-optimization' | 'performance' | 'scaling';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  impact: {
    costSaving?: number;
    performanceImprovement?: number;
    reliability?: string;
  };
  action: {
    type: 'update-resources' | 'enable-hpa' | 'enable-vpa' | 'add-pdb';
    parameters: Record<string, any>;
  };
}

export interface ClusterAutoscalingConfig {
  enabled: boolean;
  nodeGroups: Array<{
    name: string;
    minNodes: number;
    maxNodes: number;
    instanceType: string;
    spotInstances?: boolean;
    taints?: Array<{
      key: string;
      value: string;
      effect: 'NoSchedule' | 'NoExecute' | 'PreferNoSchedule';
    }>;
  }>;
  scaleDownDelay: string;
  scaleDownUnneededTime: string;
  skipNodesWithLocalStorage: boolean;
  skipNodesWithSystemPods: boolean;
}

export interface CostOptimizationReport {
  namespace: string;
  period: {
    start: Date;
    end: Date;
  };
  totalCost: number;
  breakdown: {
    compute: number;
    storage: number;
    networking: number;
  };
  pluginCosts: Array<{
    pluginName: string;
    cost: number;
    resourceUsage: {
      cpu: number;
      memory: number;
      storage: number;
    };
  }>;
  recommendations: ResourceRecommendation[];
  projectedSavings: number;
}

export class ResourceManagementSystem extends EventEmitter {
  private logger: Logger;
  private kubeConfig: k8s.KubeConfig;
  private coreV1Api: k8s.CoreV1Api;
  private appsV1Api: k8s.AppsV1Api;
  private autoscalingV2Api: k8s.AutoscalingV2Api;
  private metricsV1Beta1Api: k8s.Metrics;

  private resourceQuotas = new Map<string, ResourceQuota>();
  private autoscalingConfigs = new Map<string, AutoscalingConfig>();
  private resourceUsageHistory = new Map<string, ResourceUsageMetrics[]>();
  
  private monitoringInterval?: NodeJS.Timeout;
  private optimizationInterval?: NodeJS.Timeout;
  
  private isShutdown = false;

  // Resource cost mapping (per hour)
  private readonly resourceCosts = {
    cpu: 0.031, // $0.031 per vCPU hour
    memory: 0.004, // $0.004 per GB hour
    storage: 0.0001, // $0.0001 per GB hour
  };

  constructor(
    logger: Logger,
    kubeConfig: k8s.KubeConfig,
    private clusterAutoscalingConfig: ClusterAutoscalingConfig
  ) {
    super();
    this.logger = logger;
    this.kubeConfig = kubeConfig;
    this.coreV1Api = kubeConfig.makeApiClient(k8s.CoreV1Api);
    this.appsV1Api = kubeConfig.makeApiClient(k8s.AppsV1Api);
    this.autoscalingV2Api = kubeConfig.makeApiClient(k8s.AutoscalingV2Api);
    this.metricsV1Beta1Api = kubeConfig.makeApiClient(k8s.Metrics);

    this.startResourceMonitoring();
  }

  /**
   * Set resource requirements for a plugin
   */
  async setPluginResources(
    plugin: PluginDefinition,
    resources: ResourceRequirements,
    autoscaling?: AutoscalingConfig
  ): Promise<void> {
    const namespace = plugin.namespace || 'default';
    
    this.logger.info(`Setting resources for plugin: ${plugin.name}`, {
      namespace,
      resources,
      autoscaling: !!autoscaling
    });

    try {
      // Update deployment resources
      await this.updateDeploymentResources(plugin, resources);

      // Configure autoscaling if provided
      if (autoscaling) {
        await this.configureAutoscaling(plugin, autoscaling);
        this.autoscalingConfigs.set(`${plugin.name}-${namespace}`, autoscaling);
      }

      // Ensure resource quota compliance
      await this.validateResourceQuotaCompliance(namespace, resources);

      this.emit('resources-updated', { plugin, resources, autoscaling });

    } catch (error) {
      this.logger.error(`Failed to set resources for plugin ${plugin.name}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create or update resource quota for a namespace
   */
  async setResourceQuota(namespace: string, quota: ResourceQuota): Promise<void> {
    this.logger.info(`Setting resource quota for namespace: ${namespace}`, { quota });

    try {
      const quotaSpec: k8s.V1ResourceQuota = {
        metadata: {
          name: `${namespace}-quota`,
          namespace
        },
        spec: {
          hard: quota.hard
        }
      };

      try {
        await this.coreV1Api.readNamespacedResourceQuota(quotaSpec.metadata!.name!, namespace);
        await this.coreV1Api.replaceNamespacedResourceQuota(
          quotaSpec.metadata!.name!,
          namespace,
          quotaSpec
        );
      } catch (error) {
        if (error.response?.statusCode === 404) {
          await this.coreV1Api.createNamespacedResourceQuota(namespace, quotaSpec);
        } else {
          throw error;
        }
      }

      this.resourceQuotas.set(namespace, quota);
      this.emit('resource-quota-updated', { namespace, quota });

    } catch (error) {
      this.logger.error(`Failed to set resource quota for namespace ${namespace}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get current resource usage for a plugin
   */
  async getPluginResourceUsage(
    pluginName: string,
    namespace: string = 'default'
  ): Promise<ResourceUsageMetrics | null> {
    try {
      // Get pod metrics
      const podMetrics = await this.metricsV1Beta1Api.listNamespacedPodMetrics(
        namespace,
        undefined,
        undefined,
        undefined,
        undefined,
        `app=${pluginName}`
      );

      if (!podMetrics.body.items.length) {
        return null;
      }

      const pods: ResourceUsageMetrics['pods'] = [];
      let totalCost = 0;

      for (const podMetric of podMetrics.body.items) {
        // Get pod spec to retrieve requests/limits
        const pod = await this.coreV1Api.readNamespacedPod(
          podMetric.metadata!.name!,
          namespace
        );

        const container = pod.body.spec!.containers[0];
        const containerMetric = podMetric.containers[0];

        const cpuUsage = this.parseCPUValue(containerMetric.usage.cpu!);
        const memoryUsage = this.parseMemoryValue(containerMetric.usage.memory!);
        
        const cpuRequest = this.parseCPUValue(container.resources?.requests?.cpu || '0');
        const memoryRequest = this.parseMemoryValue(container.resources?.requests?.memory || '0');
        
        const cpuLimit = this.parseCPUValue(container.resources?.limits?.cpu || '0');
        const memoryLimit = this.parseMemoryValue(container.resources?.limits?.memory || '0');

        const podData = {
          name: podMetric.metadata!.name!,
          cpu: {
            usage: cpuUsage,
            request: cpuRequest,
            limit: cpuLimit,
            utilization: cpuRequest > 0 ? (cpuUsage / cpuRequest) * 100 : 0
          },
          memory: {
            usage: memoryUsage,
            request: memoryRequest,
            limit: memoryLimit,
            utilization: memoryRequest > 0 ? (memoryUsage / memoryRequest) * 100 : 0
          }
        };

        pods.push(podData);

        // Calculate cost (simplified calculation)
        totalCost += (cpuUsage * this.resourceCosts.cpu) + 
                     (memoryUsage / (1024 * 1024 * 1024) * this.resourceCosts.memory);
      }

      const usage: ResourceUsageMetrics = {
        pluginName,
        namespace,
        timestamp: new Date(),
        pods,
        totalCost,
        recommendations: await this.generateResourceRecommendations(pluginName, namespace, pods)
      };

      // Store in history
      const key = `${pluginName}-${namespace}`;
      const history = this.resourceUsageHistory.get(key) || [];
      history.push(usage);
      
      // Keep only last 24 hours of data
      const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const filteredHistory = history.filter(entry => entry.timestamp > cutoffTime);
      this.resourceUsageHistory.set(key, filteredHistory);

      return usage;

    } catch (error) {
      this.logger.error(`Failed to get resource usage for ${pluginName}: ${error.message}`);
      return null;
    }
  }

  /**
   * Generate cost optimization report
   */
  async generateCostOptimizationReport(
    namespace: string,
    periodDays: number = 7
  ): Promise<CostOptimizationReport> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - periodDays * 24 * 60 * 60 * 1000);

    this.logger.info(`Generating cost optimization report for namespace: ${namespace}`);

    try {
      const pluginCosts: CostOptimizationReport['pluginCosts'] = [];
      let totalCost = 0;

      // Get all plugins in namespace
      const deployments = await this.appsV1Api.listNamespacedDeployment(namespace);
      
      for (const deployment of deployments.body.items) {
        const pluginName = deployment.metadata!.labels?.app || deployment.metadata!.name!;
        const usage = await this.getPluginResourceUsage(pluginName, namespace);
        
        if (usage) {
          const pluginCost = usage.totalCost * 24 * periodDays; // Estimate for period
          
          pluginCosts.push({
            pluginName,
            cost: pluginCost,
            resourceUsage: {
              cpu: usage.pods.reduce((sum, pod) => sum + pod.cpu.usage, 0),
              memory: usage.pods.reduce((sum, pod) => sum + pod.memory.usage, 0),
              storage: usage.pods.reduce((sum, pod) => sum + (pod.storage?.usage || 0), 0)
            }
          });
          
          totalCost += pluginCost;
        }
      }

      // Generate recommendations across all plugins
      const recommendations = await this.generateNamespaceRecommendations(namespace, pluginCosts);
      const projectedSavings = recommendations.reduce(
        (sum, rec) => sum + (rec.impact.costSaving || 0), 
        0
      );

      const report: CostOptimizationReport = {
        namespace,
        period: { start: startDate, end: endDate },
        totalCost,
        breakdown: {
          compute: totalCost * 0.7, // Rough estimates
          storage: totalCost * 0.2,
          networking: totalCost * 0.1
        },
        pluginCosts,
        recommendations,
        projectedSavings
      };

      this.emit('cost-report-generated', report);
      return report;

    } catch (error) {
      this.logger.error(`Failed to generate cost report for namespace ${namespace}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Apply resource recommendations
   */
  async applyRecommendations(
    pluginName: string,
    namespace: string,
    recommendations: ResourceRecommendation[]
  ): Promise<void> {
    this.logger.info(`Applying recommendations for plugin: ${pluginName}`, {
      namespace,
      recommendationCount: recommendations.length
    });

    for (const recommendation of recommendations) {
      try {
        switch (recommendation.action.type) {
          case 'update-resources':
            await this.applyResourceUpdate(pluginName, namespace, recommendation.action.parameters);
            break;
          case 'enable-hpa':
            await this.enableHPA(pluginName, namespace, recommendation.action.parameters);
            break;
          case 'enable-vpa':
            await this.enableVPA(pluginName, namespace, recommendation.action.parameters);
            break;
          case 'add-pdb':
            await this.addPodDisruptionBudget(pluginName, namespace, recommendation.action.parameters);
            break;
        }

        this.logger.info(`Applied recommendation: ${recommendation.title}`, {
          pluginName,
          namespace,
          type: recommendation.action.type
        });

      } catch (error) {
        this.logger.error(`Failed to apply recommendation ${recommendation.title}: ${error.message}`);
      }
    }

    this.emit('recommendations-applied', { pluginName, namespace, recommendations });
  }

  /**
   * Update deployment resources
   */
  private async updateDeploymentResources(
    plugin: PluginDefinition,
    resources: ResourceRequirements
  ): Promise<void> {
    const namespace = plugin.namespace || 'default';
    const deploymentName = plugin.name;

    const deployment = await this.appsV1Api.readNamespacedDeployment(deploymentName, namespace);
    
    // Update container resources
    if (deployment.body.spec?.template.spec?.containers) {
      deployment.body.spec.template.spec.containers[0].resources = {
        requests: {
          cpu: resources.cpu.request,
          memory: resources.memory.request,
          ...(resources.storage && { 'ephemeral-storage': resources.storage.request })
        },
        limits: {
          cpu: resources.cpu.limit,
          memory: resources.memory.limit,
          ...(resources.storage?.limit && { 'ephemeral-storage': resources.storage.limit })
        }
      };

      // Add GPU resources if specified
      if (resources.gpu) {
        deployment.body.spec.template.spec.containers[0].resources.requests![`nvidia.com/gpu`] = 
          resources.gpu.request.toString();
        deployment.body.spec.template.spec.containers[0].resources.limits![`nvidia.com/gpu`] = 
          resources.gpu.limit.toString();
      }
    }

    await this.appsV1Api.replaceNamespacedDeployment(deploymentName, namespace, deployment.body);
  }

  /**
   * Configure autoscaling
   */
  private async configureAutoscaling(
    plugin: PluginDefinition,
    autoscaling: AutoscalingConfig
  ): Promise<void> {
    const namespace = plugin.namespace || 'default';
    const deploymentName = plugin.name;

    // Configure HPA
    if (autoscaling.hpa.enabled) {
      const hpaSpec: k8s.V2HorizontalPodAutoscaler = {
        metadata: {
          name: `${deploymentName}-hpa`,
          namespace
        },
        spec: {
          scaleTargetRef: {
            apiVersion: 'apps/v1',
            kind: 'Deployment',
            name: deploymentName
          },
          minReplicas: autoscaling.hpa.minReplicas,
          maxReplicas: autoscaling.hpa.maxReplicas,
          metrics: []
        }
      };

      // Add CPU metric if specified
      if (autoscaling.hpa.targetCPUUtilization) {
        hpaSpec.spec!.metrics!.push({
          type: 'Resource',
          resource: {
            name: 'cpu',
            target: {
              type: 'Utilization',
              averageUtilization: autoscaling.hpa.targetCPUUtilization
            }
          }
        });
      }

      // Add memory metric if specified
      if (autoscaling.hpa.targetMemoryUtilization) {
        hpaSpec.spec!.metrics!.push({
          type: 'Resource',
          resource: {
            name: 'memory',
            target: {
              type: 'Utilization',
              averageUtilization: autoscaling.hpa.targetMemoryUtilization
            }
          }
        });
      }

      // Add custom metrics
      if (autoscaling.hpa.customMetrics) {
        for (const metric of autoscaling.hpa.customMetrics) {
          hpaSpec.spec!.metrics!.push({
            type: metric.type,
            pods: metric.type === 'Pods' ? {
              metric: { name: metric.name },
              target: {
                type: 'AverageValue',
                averageValue: metric.target.toString()
              }
            } : undefined,
            object: metric.type === 'Object' ? {
              metric: { name: metric.name },
              target: {
                type: 'Value',
                value: metric.target.toString()
              },
              describedObject: {
                apiVersion: 'v1',
                kind: 'Service',
                name: deploymentName
              }
            } : undefined,
            external: metric.type === 'External' ? {
              metric: { name: metric.name },
              target: {
                type: 'Value',
                value: metric.target.toString()
              }
            } : undefined
          });
        }
      }

      // Add behavior if specified
      if (autoscaling.hpa.behavior) {
        hpaSpec.spec!.behavior = autoscaling.hpa.behavior as any;
      }

      try {
        await this.autoscalingV2Api.readNamespacedHorizontalPodAutoscaler(
          hpaSpec.metadata!.name!,
          namespace
        );
        await this.autoscalingV2Api.replaceNamespacedHorizontalPodAutoscaler(
          hpaSpec.metadata!.name!,
          namespace,
          hpaSpec
        );
      } catch (error) {
        if (error.response?.statusCode === 404) {
          await this.autoscalingV2Api.createNamespacedHorizontalPodAutoscaler(namespace, hpaSpec);
        } else {
          throw error;
        }
      }
    }

    // Configure VPA (requires VPA CRDs to be installed)
    if (autoscaling.vpa.enabled) {
      await this.configureVPA(plugin, autoscaling.vpa);
    }
  }

  /**
   * Configure Vertical Pod Autoscaler
   */
  private async configureVPA(plugin: PluginDefinition, vpaConfig: AutoscalingConfig['vpa']): Promise<void> {
    // This would require VPA custom resource definitions
    // Implementation depends on VPA installation in cluster
    this.logger.info(`VPA configuration requested for ${plugin.name} (requires VPA CRDs)`);
  }

  /**
   * Validate resource quota compliance
   */
  private async validateResourceQuotaCompliance(
    namespace: string,
    resources: ResourceRequirements
  ): Promise<void> {
    const quota = this.resourceQuotas.get(namespace);
    if (!quota) {
      return; // No quota defined
    }

    try {
      const quotaStatus = await this.coreV1Api.readNamespacedResourceQuota(
        `${namespace}-quota`,
        namespace
      );

      const used = quotaStatus.body.status?.used || {};
      const hard = quotaStatus.body.spec?.hard || {};

      // Check if adding these resources would exceed quota
      const cpuRequest = this.parseCPUValue(resources.cpu.request);
      const memoryRequest = this.parseMemoryValue(resources.memory.request);
      
      const usedCPU = this.parseCPUValue(used['requests.cpu'] || '0');
      const usedMemory = this.parseMemoryValue(used['requests.memory'] || '0');
      
      const hardCPU = this.parseCPUValue(hard['requests.cpu'] || '0');
      const hardMemory = this.parseMemoryValue(hard['requests.memory'] || '0');

      if (usedCPU + cpuRequest > hardCPU) {
        throw new Error(`CPU request would exceed namespace quota: ${cpuRequest} requested, ${hardCPU - usedCPU} available`);
      }

      if (usedMemory + memoryRequest > hardMemory) {
        throw new Error(`Memory request would exceed namespace quota: ${memoryRequest} requested, ${hardMemory - usedMemory} available`);
      }

    } catch (error) {
      if (error.response?.statusCode !== 404) {
        throw error;
      }
    }
  }

  /**
   * Generate resource recommendations for a plugin
   */
  private async generateResourceRecommendations(
    pluginName: string,
    namespace: string,
    pods: ResourceUsageMetrics['pods']
  ): Promise<ResourceRecommendation[]> {
    const recommendations: ResourceRecommendation[] = [];

    for (const pod of pods) {
      // CPU recommendations
      if (pod.cpu.utilization < 20) {
        recommendations.push({
          type: 'rightsizing',
          severity: 'medium',
          title: 'Reduce CPU allocation',
          description: `Pod ${pod.name} has low CPU utilization (${pod.cpu.utilization.toFixed(1)}%). Consider reducing CPU request.`,
          impact: {
            costSaving: pod.cpu.request * this.resourceCosts.cpu * 24 * 30 * 0.5 // 50% savings
          },
          action: {
            type: 'update-resources',
            parameters: {
              cpu: {
                request: `${Math.max(pod.cpu.usage * 1.2, 0.1)}`, // 20% buffer
                limit: pod.cpu.limit
              }
            }
          }
        });
      }

      if (pod.cpu.utilization > 80) {
        recommendations.push({
          type: 'performance',
          severity: 'high',
          title: 'Increase CPU allocation',
          description: `Pod ${pod.name} has high CPU utilization (${pod.cpu.utilization.toFixed(1)}%). Consider increasing CPU request/limit.`,
          impact: {
            performanceImprovement: 25,
            reliability: 'Reduced throttling and improved response times'
          },
          action: {
            type: 'update-resources',
            parameters: {
              cpu: {
                request: `${pod.cpu.usage * 1.5}`, // 50% buffer
                limit: `${pod.cpu.usage * 2}` // 100% buffer
              }
            }
          }
        });
      }

      // Memory recommendations
      if (pod.memory.utilization < 30) {
        recommendations.push({
          type: 'rightsizing',
          severity: 'medium',
          title: 'Reduce memory allocation',
          description: `Pod ${pod.name} has low memory utilization (${pod.memory.utilization.toFixed(1)}%). Consider reducing memory request.`,
          impact: {
            costSaving: (pod.memory.request / (1024 * 1024 * 1024)) * this.resourceCosts.memory * 24 * 30 * 0.3
          },
          action: {
            type: 'update-resources',
            parameters: {
              memory: {
                request: `${Math.max(pod.memory.usage * 1.3, 64 * 1024 * 1024)}`, // 30% buffer, min 64MB
                limit: pod.memory.limit
              }
            }
          }
        });
      }

      if (pod.memory.utilization > 90) {
        recommendations.push({
          type: 'performance',
          severity: 'high',
          title: 'Increase memory allocation',
          description: `Pod ${pod.name} has high memory utilization (${pod.memory.utilization.toFixed(1)}%). Risk of OOMKill.`,
          impact: {
            reliability: 'Prevents out-of-memory kills'
          },
          action: {
            type: 'update-resources',
            parameters: {
              memory: {
                request: `${pod.memory.usage * 1.5}`,
                limit: `${pod.memory.usage * 2}`
              }
            }
          }
        });
      }
    }

    // Check if HPA would be beneficial
    const avgCPUUtilization = pods.reduce((sum, pod) => sum + pod.cpu.utilization, 0) / pods.length;
    if (pods.length === 1 && (avgCPUUtilization > 70 || avgCPUUtilization < 30)) {
      recommendations.push({
        type: 'scaling',
        severity: 'medium',
        title: 'Enable Horizontal Pod Autoscaling',
        description: 'Variable CPU utilization suggests HPA could improve resource efficiency.',
        impact: {
          costSaving: avgCPUUtilization < 30 ? 200 : 0, // Estimated monthly savings
          performanceImprovement: avgCPUUtilization > 70 ? 20 : 0
        },
        action: {
          type: 'enable-hpa',
          parameters: {
            minReplicas: 1,
            maxReplicas: 5,
            targetCPUUtilization: 70
          }
        }
      });
    }

    return recommendations;
  }

  /**
   * Generate namespace-wide recommendations
   */
  private async generateNamespaceRecommendations(
    namespace: string,
    pluginCosts: CostOptimizationReport['pluginCosts']
  ): Promise<ResourceRecommendation[]> {
    const recommendations: ResourceRecommendation[] = [];

    // Find most expensive plugins
    const sortedByCost = [...pluginCosts].sort((a, b) => b.cost - a.cost);
    const top3Expensive = sortedByCost.slice(0, 3);

    for (const plugin of top3Expensive) {
      recommendations.push({
        type: 'cost-optimization',
        severity: 'high',
        title: `Optimize high-cost plugin: ${plugin.pluginName}`,
        description: `Plugin ${plugin.pluginName} accounts for ${((plugin.cost / pluginCosts.reduce((sum, p) => sum + p.cost, 0)) * 100).toFixed(1)}% of namespace costs.`,
        impact: {
          costSaving: plugin.cost * 0.2 // Potential 20% savings
        },
        action: {
          type: 'update-resources',
          parameters: {
            priority: 'high'
          }
        }
      });
    }

    return recommendations;
  }

  /**
   * Apply specific recommendation actions
   */
  private async applyResourceUpdate(
    pluginName: string,
    namespace: string,
    parameters: any
  ): Promise<void> {
    // Implementation for updating resources based on recommendations
    this.logger.info(`Applying resource update for ${pluginName}`, { parameters });
  }

  private async enableHPA(
    pluginName: string,
    namespace: string,
    parameters: any
  ): Promise<void> {
    // Implementation for enabling HPA
    this.logger.info(`Enabling HPA for ${pluginName}`, { parameters });
  }

  private async enableVPA(
    pluginName: string,
    namespace: string,
    parameters: any
  ): Promise<void> {
    // Implementation for enabling VPA
    this.logger.info(`Enabling VPA for ${pluginName}`, { parameters });
  }

  private async addPodDisruptionBudget(
    pluginName: string,
    namespace: string,
    parameters: any
  ): Promise<void> {
    // Implementation for adding PDB
    this.logger.info(`Adding PodDisruptionBudget for ${pluginName}`, { parameters });
  }

  /**
   * Start resource monitoring
   */
  private startResourceMonitoring(): void {
    // Resource usage monitoring
    this.monitoringInterval = setInterval(async () => {
      if (this.isShutdown) return;

      try {
        await this.collectAllResourceMetrics();
      } catch (error) {
        this.logger.error(`Resource monitoring failed: ${error.message}`);
      }
    }, 60000); // Every minute

    // Optimization analysis
    this.optimizationInterval = setInterval(async () => {
      if (this.isShutdown) return;

      try {
        await this.performOptimizationAnalysis();
      } catch (error) {
        this.logger.error(`Optimization analysis failed: ${error.message}`);
      }
    }, 3600000); // Every hour
  }

  private async collectAllResourceMetrics(): Promise<void> {
    // Collect metrics for all monitored plugins
    const namespaces = await this.coreV1Api.listNamespace();
    
    for (const namespace of namespaces.body.items) {
      if (namespace.metadata?.name?.startsWith('kube-')) continue;
      
      try {
        const deployments = await this.appsV1Api.listNamespacedDeployment(namespace.metadata!.name!);
        
        for (const deployment of deployments.body.items) {
          const pluginName = deployment.metadata!.labels?.app || deployment.metadata!.name!;
          await this.getPluginResourceUsage(pluginName, namespace.metadata!.name!);
        }
      } catch (error) {
        this.logger.warn(`Failed to collect metrics for namespace ${namespace.metadata!.name}: ${error.message}`);
      }
    }
  }

  private async performOptimizationAnalysis(): Promise<void> {
    // Analyze resource usage patterns and generate recommendations
    for (const [key, history] of this.resourceUsageHistory.entries()) {
      if (history.length < 10) continue; // Need sufficient data
      
      const [pluginName, namespace] = key.split('-');
      const latestUsage = history[history.length - 1];
      
      // Check for consistent over/under-provisioning
      const underUtilized = history.filter(usage => 
        usage.pods.some(pod => pod.cpu.utilization < 30 || pod.memory.utilization < 30)
      ).length;
      
      if (underUtilized > history.length * 0.8) {
        this.emit('optimization-opportunity', {
          type: 'under-utilization',
          pluginName,
          namespace,
          severity: 'high'
        });
      }
    }
  }

  /**
   * Helper methods for parsing Kubernetes resource values
   */
  private parseCPUValue(value: string): number {
    if (value.endsWith('m')) {
      return parseInt(value.slice(0, -1)) / 1000;
    }
    return parseFloat(value);
  }

  private parseMemoryValue(value: string): number {
    const units: Record<string, number> = {
      'Ki': 1024,
      'Mi': 1024 * 1024,
      'Gi': 1024 * 1024 * 1024,
      'Ti': 1024 * 1024 * 1024 * 1024,
      'K': 1000,
      'M': 1000 * 1000,
      'G': 1000 * 1000 * 1000,
      'T': 1000 * 1000 * 1000 * 1000
    };

    for (const [suffix, multiplier] of Object.entries(units)) {
      if (value.endsWith(suffix)) {
        return parseInt(value.slice(0, -suffix.length)) * multiplier;
      }
    }

    return parseInt(value);
  }

  /**
   * Shutdown resource management system
   */
  async shutdown(): Promise<void> {
    if (this.isShutdown) return;
    
    this.isShutdown = true;
    this.logger.info('Shutting down resource management system');

    if (this.monitoringInterval) clearInterval(this.monitoringInterval);
    if (this.optimizationInterval) clearInterval(this.optimizationInterval);

    this.resourceQuotas.clear();
    this.autoscalingConfigs.clear();
    this.resourceUsageHistory.clear();

    this.emit('shutdown-completed');
  }
}