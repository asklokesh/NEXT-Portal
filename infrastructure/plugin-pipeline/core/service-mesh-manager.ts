/**
 * Service Mesh Manager for Plugin Pipeline
 * 
 * Handles service mesh integration (Istio/Linkerd) for plugin communication,
 * traffic management, security policies, and observability
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import * as k8s from '@kubernetes/client-node';
import { PluginDefinition, DeploymentInfo } from '../types/plugin-types';

export interface ServiceMeshConfig {
  provider: 'istio' | 'linkerd' | 'consul-connect';
  istio?: IstioConfig;
  linkerd?: LinkerdConfig;
  consul?: ConsulConfig;
}

export interface IstioConfig {
  gateway?: string;
  defaultPolicy: 'STRICT' | 'PERMISSIVE';
  enableTracing: boolean;
  enableMetrics: boolean;
  mtlsMode: 'STRICT' | 'PERMISSIVE' | 'DISABLE';
}

export interface LinkerdConfig {
  enableTapAccess: boolean;
  enableDebugSidecar: boolean;
  proxyInitImage?: string;
  proxyImage?: string;
}

export interface ConsulConfig {
  datacenter: string;
  enableConnect: boolean;
  enableACLs: boolean;
}

export interface TrafficPolicy {
  pluginName: string;
  loadBalancer?: {
    simple: 'LEAST_CONN' | 'ROUND_ROBIN' | 'RANDOM' | 'PASSTHROUGH';
  };
  connectionPool?: {
    tcp?: {
      maxConnections: number;
      connectTimeout: string;
    };
    http?: {
      http1MaxPendingRequests: number;
      http2MaxRequests: number;
      maxRequestsPerConnection: number;
      maxRetries: number;
      idleTimeout: string;
    };
  };
  outlierDetection?: {
    consecutiveErrors: number;
    interval: string;
    baseEjectionTime: string;
    maxEjectionPercent: number;
  };
  retryPolicy?: {
    attempts: number;
    perTryTimeout: string;
    retryOn: string;
  };
  faultInjection?: {
    delay?: {
      percentage: number;
      fixedDelay: string;
    };
    abort?: {
      percentage: number;
      httpStatus: number;
    };
  };
}

export interface SecurityPolicy {
  pluginName: string;
  peerAuthentication: 'STRICT' | 'PERMISSIVE' | 'DISABLE';
  authorizationPolicies: AuthorizationRule[];
  requestAuthentication?: {
    jwtRules: JWTRule[];
  };
}

export interface AuthorizationRule {
  action: 'ALLOW' | 'DENY';
  rules: {
    from?: {
      source: {
        principals?: string[];
        namespaces?: string[];
        ipBlocks?: string[];
      };
    }[];
    to?: {
      operation: {
        methods?: string[];
        paths?: string[];
        hosts?: string[];
      };
    }[];
    when?: {
      key: string;
      values: string[];
    }[];
  }[];
}

export interface JWTRule {
  issuer: string;
  audiences?: string[];
  jwksUri?: string;
  jwks?: string;
  fromHeaders?: {
    name: string;
    prefix?: string;
  }[];
  fromParams?: string[];
}

export interface CanaryConfig {
  pluginName: string;
  stableVersion: string;
  canaryVersion: string;
  trafficSplit: {
    stable: number;
    canary: number;
  };
  match?: {
    headers?: { [key: string]: string };
    cookies?: { [key: string]: string };
    queryParams?: { [key: string]: string };
  };
}

export class ServiceMeshManager extends EventEmitter {
  private logger: Logger;
  private config: ServiceMeshConfig;
  private k8sApi: k8s.KubernetesApi;
  private customObjectsApi: k8s.CustomObjectsApi;
  private coreApi: k8s.CoreV1Api;
  
  constructor(logger: Logger, config: ServiceMeshConfig, kubeConfig: k8s.KubeConfig) {
    super();
    this.logger = logger;
    this.config = config;
    
    this.k8sApi = kubeConfig.makeApiClient(k8s.KubernetesApi);
    this.customObjectsApi = kubeConfig.makeApiClient(k8s.CustomObjectsApi);
    this.coreApi = kubeConfig.makeApiClient(k8s.CoreV1Api);
  }

  /**
   * Configure service mesh for a plugin
   */
  async configurePlugin(
    pluginDefinition: PluginDefinition,
    deploymentInfo: DeploymentInfo
  ): Promise<void> {
    this.logger.info(`Configuring service mesh for plugin: ${pluginDefinition.name}`, {
      provider: this.config.provider,
      namespace: deploymentInfo.namespace
    });

    try {
      switch (this.config.provider) {
        case 'istio':
          await this.configureIstioPlugin(pluginDefinition, deploymentInfo);
          break;
        case 'linkerd':
          await this.configureLinkerdPlugin(pluginDefinition, deploymentInfo);
          break;
        case 'consul-connect':
          await this.configureConsulPlugin(pluginDefinition, deploymentInfo);
          break;
      }

      this.emit('plugin-configured', { pluginDefinition, deploymentInfo });
      
    } catch (error) {
      this.logger.error(`Failed to configure service mesh for plugin ${pluginDefinition.name}: ${error.message}`);
      this.emit('plugin-configuration-failed', { pluginDefinition, error });
      throw error;
    }
  }

  /**
   * Configure Istio service mesh for plugin
   */
  private async configureIstioPlugin(
    pluginDefinition: PluginDefinition,
    deploymentInfo: DeploymentInfo
  ): Promise<void> {
    const namespace = deploymentInfo.namespace;
    
    // Enable sidecar injection on namespace if not already enabled
    await this.enableIstioInjection(namespace);
    
    // Create DestinationRule
    await this.createDestinationRule(pluginDefinition, deploymentInfo);
    
    // Create VirtualService
    await this.createVirtualService(pluginDefinition, deploymentInfo);
    
    // Create PeerAuthentication
    if (pluginDefinition.networking.serviceMesh?.mTLS !== false) {
      await this.createPeerAuthentication(pluginDefinition, deploymentInfo);
    }
    
    // Create AuthorizationPolicy
    await this.createAuthorizationPolicy(pluginDefinition, deploymentInfo);
    
    // Create ServiceMonitor for Prometheus (if metrics enabled)
    if (pluginDefinition.observability.metrics?.enabled) {
      await this.createServiceMonitor(pluginDefinition, deploymentInfo);
    }
  }

  /**
   * Configure Linkerd service mesh for plugin
   */
  private async configureLinkerdPlugin(
    pluginDefinition: PluginDefinition,
    deploymentInfo: DeploymentInfo
  ): Promise<void> {
    const namespace = deploymentInfo.namespace;
    
    // Annotate namespace for Linkerd injection
    await this.enableLinkerdInjection(namespace);
    
    // Create TrafficSplit if needed (for canary deployments)
    if (deploymentInfo.strategy === 'canary') {
      await this.createTrafficSplit(pluginDefinition, deploymentInfo);
    }
    
    // Create ServiceProfile for advanced routing
    await this.createServiceProfile(pluginDefinition, deploymentInfo);
  }

  /**
   * Configure Consul Connect service mesh for plugin
   */
  private async configureConsulPlugin(
    pluginDefinition: PluginDefinition,
    deploymentInfo: DeploymentInfo
  ): Promise<void> {
    // Consul Connect configuration would go here
    // This is a placeholder for Consul-specific implementation
    this.logger.info(`Consul Connect configuration for ${pluginDefinition.name} - not implemented yet`);
  }

  /**
   * Enable Istio sidecar injection on namespace
   */
  private async enableIstioInjection(namespace: string): Promise<void> {
    try {
      const namespaceObj = await this.coreApi.readNamespace(namespace);
      const labels = namespaceObj.body.metadata?.labels || {};
      
      if (!labels['istio-injection']) {
        labels['istio-injection'] = 'enabled';
        
        const patch = {
          metadata: {
            labels
          }
        };
        
        await this.coreApi.patchNamespace(
          namespace,
          patch,
          undefined,
          undefined,
          undefined,
          undefined,
          {
            headers: { 'Content-Type': 'application/strategic-merge-patch+json' }
          }
        );
        
        this.logger.info(`Enabled Istio injection for namespace: ${namespace}`);
      }
    } catch (error) {
      this.logger.error(`Failed to enable Istio injection for namespace ${namespace}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create Istio DestinationRule
   */
  private async createDestinationRule(
    pluginDefinition: PluginDefinition,
    deploymentInfo: DeploymentInfo
  ): Promise<void> {
    const destinationRule = {
      apiVersion: 'networking.istio.io/v1beta1',
      kind: 'DestinationRule',
      metadata: {
        name: `${pluginDefinition.name}-destination-rule`,
        namespace: deploymentInfo.namespace,
        labels: {
          app: pluginDefinition.name,
          managed: 'plugin-pipeline'
        }
      },
      spec: {
        host: `${deploymentInfo.serviceName}.${deploymentInfo.namespace}.svc.cluster.local`,
        trafficPolicy: this.createTrafficPolicy(pluginDefinition),
        subsets: this.createSubsets(pluginDefinition, deploymentInfo)
      }
    };

    await this.createOrUpdateCustomResource(
      'networking.istio.io',
      'v1beta1',
      'destinationrules',
      deploymentInfo.namespace,
      destinationRule
    );
  }

  /**
   * Create Istio VirtualService
   */
  private async createVirtualService(
    pluginDefinition: PluginDefinition,
    deploymentInfo: DeploymentInfo
  ): Promise<void> {
    const virtualService = {
      apiVersion: 'networking.istio.io/v1beta1',
      kind: 'VirtualService',
      metadata: {
        name: `${pluginDefinition.name}-virtual-service`,
        namespace: deploymentInfo.namespace,
        labels: {
          app: pluginDefinition.name,
          managed: 'plugin-pipeline'
        }
      },
      spec: {
        hosts: [
          `${deploymentInfo.serviceName}.${deploymentInfo.namespace}.svc.cluster.local`
        ],
        http: [
          {
            match: [
              {
                uri: {
                  prefix: '/'
                }
              }
            ],
            route: [
              {
                destination: {
                  host: `${deploymentInfo.serviceName}.${deploymentInfo.namespace}.svc.cluster.local`,
                  subset: 'stable'
                }
              }
            ],
            timeout: pluginDefinition.networking.serviceMesh?.timeout || '30s',
            retries: {
              attempts: pluginDefinition.networking.serviceMesh?.retries || 3,
              perTryTimeout: '10s',
              retryOn: 'gateway-error,connect-failure,refused-stream'
            }
          }
        ]
      }
    };

    // Add fault injection for testing if configured
    if (process.env.ENABLE_FAULT_INJECTION === 'true') {
      virtualService.spec.http[0].fault = {
        delay: {
          percentage: {
            value: 0.1
          },
          fixedDelay: '1s'
        },
        abort: {
          percentage: {
            value: 0.01
          },
          httpStatus: 500
        }
      };
    }

    await this.createOrUpdateCustomResource(
      'networking.istio.io',
      'v1beta1',
      'virtualservices',
      deploymentInfo.namespace,
      virtualService
    );
  }

  /**
   * Create Istio PeerAuthentication
   */
  private async createPeerAuthentication(
    pluginDefinition: PluginDefinition,
    deploymentInfo: DeploymentInfo
  ): Promise<void> {
    const peerAuthentication = {
      apiVersion: 'security.istio.io/v1beta1',
      kind: 'PeerAuthentication',
      metadata: {
        name: `${pluginDefinition.name}-peer-auth`,
        namespace: deploymentInfo.namespace,
        labels: {
          app: pluginDefinition.name,
          managed: 'plugin-pipeline'
        }
      },
      spec: {
        selector: {
          matchLabels: {
            app: pluginDefinition.name
          }
        },
        mtls: {
          mode: this.config.istio?.mtlsMode || 'STRICT'
        }
      }
    };

    await this.createOrUpdateCustomResource(
      'security.istio.io',
      'v1beta1',
      'peerauthentications',
      deploymentInfo.namespace,
      peerAuthentication
    );
  }

  /**
   * Create Istio AuthorizationPolicy
   */
  private async createAuthorizationPolicy(
    pluginDefinition: PluginDefinition,
    deploymentInfo: DeploymentInfo
  ): Promise<void> {
    const authorizationPolicy = {
      apiVersion: 'security.istio.io/v1beta1',
      kind: 'AuthorizationPolicy',
      metadata: {
        name: `${pluginDefinition.name}-authz`,
        namespace: deploymentInfo.namespace,
        labels: {
          app: pluginDefinition.name,
          managed: 'plugin-pipeline'
        }
      },
      spec: {
        selector: {
          matchLabels: {
            app: pluginDefinition.name
          }
        },
        rules: [
          {
            from: [
              {
                source: {
                  namespaces: ['developer-portal', 'istio-system']
                }
              }
            ],
            to: [
              {
                operation: {
                  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
                }
              }
            ]
          }
        ]
      }
    };

    // Add specific authorization rules based on plugin configuration
    if (pluginDefinition.networking.ports.some(p => p.name === 'metrics')) {
      authorizationPolicy.spec.rules.push({
        from: [
          {
            source: {
              principals: ['cluster.local/ns/istio-system/sa/prometheus']
            }
          }
        ],
        to: [
          {
            operation: {
              methods: ['GET'],
              paths: ['/metrics']
            }
          }
        ]
      });
    }

    await this.createOrUpdateCustomResource(
      'security.istio.io',
      'v1beta1',
      'authorizationpolicies',
      deploymentInfo.namespace,
      authorizationPolicy
    );
  }

  /**
   * Enable Linkerd injection on namespace
   */
  private async enableLinkerdInjection(namespace: string): Promise<void> {
    try {
      const namespaceObj = await this.coreApi.readNamespace(namespace);
      const annotations = namespaceObj.body.metadata?.annotations || {};
      
      if (!annotations['linkerd.io/inject']) {
        annotations['linkerd.io/inject'] = 'enabled';
        
        const patch = {
          metadata: {
            annotations
          }
        };
        
        await this.coreApi.patchNamespace(
          namespace,
          patch,
          undefined,
          undefined,
          undefined,
          undefined,
          {
            headers: { 'Content-Type': 'application/strategic-merge-patch+json' }
          }
        );
        
        this.logger.info(`Enabled Linkerd injection for namespace: ${namespace}`);
      }
    } catch (error) {
      this.logger.error(`Failed to enable Linkerd injection for namespace ${namespace}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create Linkerd TrafficSplit for canary deployments
   */
  private async createTrafficSplit(
    pluginDefinition: PluginDefinition,
    deploymentInfo: DeploymentInfo
  ): Promise<void> {
    const trafficSplit = {
      apiVersion: 'split.smi-spec.io/v1alpha1',
      kind: 'TrafficSplit',
      metadata: {
        name: `${pluginDefinition.name}-traffic-split`,
        namespace: deploymentInfo.namespace,
        labels: {
          app: pluginDefinition.name,
          managed: 'plugin-pipeline'
        }
      },
      spec: {
        service: deploymentInfo.serviceName,
        backends: [
          {
            service: `${deploymentInfo.serviceName}-stable`,
            weight: 90
          },
          {
            service: `${deploymentInfo.serviceName}-canary`,
            weight: 10
          }
        ]
      }
    };

    await this.createOrUpdateCustomResource(
      'split.smi-spec.io',
      'v1alpha1',
      'trafficsplits',
      deploymentInfo.namespace,
      trafficSplit
    );
  }

  /**
   * Create Linkerd ServiceProfile
   */
  private async createServiceProfile(
    pluginDefinition: PluginDefinition,
    deploymentInfo: DeploymentInfo
  ): Promise<void> {
    const serviceProfile = {
      apiVersion: 'linkerd.io/v1alpha2',
      kind: 'ServiceProfile',
      metadata: {
        name: `${deploymentInfo.serviceName}.${deploymentInfo.namespace}`,
        namespace: deploymentInfo.namespace,
        labels: {
          app: pluginDefinition.name,
          managed: 'plugin-pipeline'
        }
      },
      spec: {
        routes: [
          {
            name: 'health',
            condition: {
              method: 'GET',
              pathRegex: '/health.*'
            },
            responseClasses: [
              {
                condition: {
                  status: {
                    min: 200,
                    max: 299
                  }
                },
                isFailure: false
              }
            ]
          },
          {
            name: 'api',
            condition: {
              method: 'GET|POST|PUT|DELETE',
              pathRegex: '/api/.*'
            },
            responseClasses: [
              {
                condition: {
                  status: {
                    min: 200,
                    max: 299
                  }
                },
                isFailure: false
              },
              {
                condition: {
                  status: {
                    min: 500,
                    max: 599
                  }
                },
                isFailure: true
              }
            ],
            timeout: '30s',
            retryBudget: {
              retryRatio: 0.2,
              minRetriesPerSecond: 10,
              ttl: '10s'
            }
          }
        ]
      }
    };

    await this.createOrUpdateCustomResource(
      'linkerd.io',
      'v1alpha2',
      'serviceprofiles',
      deploymentInfo.namespace,
      serviceProfile
    );
  }

  /**
   * Configure canary traffic splitting
   */
  async configureCanaryTraffic(canaryConfig: CanaryConfig): Promise<void> {
    this.logger.info(`Configuring canary traffic for plugin: ${canaryConfig.pluginName}`, {
      stableVersion: canaryConfig.stableVersion,
      canaryVersion: canaryConfig.canaryVersion,
      trafficSplit: canaryConfig.trafficSplit
    });

    switch (this.config.provider) {
      case 'istio':
        await this.configureIstioCanaryTraffic(canaryConfig);
        break;
      case 'linkerd':
        await this.configureLinkerdCanaryTraffic(canaryConfig);
        break;
    }
  }

  /**
   * Configure Istio canary traffic splitting
   */
  private async configureIstioCanaryTraffic(canaryConfig: CanaryConfig): Promise<void> {
    const namespace = `plugin-${canaryConfig.pluginName}`;
    
    // Update VirtualService with canary routing
    const virtualService = {
      apiVersion: 'networking.istio.io/v1beta1',
      kind: 'VirtualService',
      metadata: {
        name: `${canaryConfig.pluginName}-virtual-service`,
        namespace
      },
      spec: {
        hosts: [`${canaryConfig.pluginName}-service.${namespace}.svc.cluster.local`],
        http: [
          {
            match: [
              {
                headers: canaryConfig.match?.headers ? 
                  Object.entries(canaryConfig.match.headers).map(([key, value]) => ({
                    [key]: { exact: value }
                  })).reduce((acc, curr) => ({ ...acc, ...curr }), {}) : undefined,
                uri: { prefix: '/' }
              }
            ],
            route: [
              {
                destination: {
                  host: `${canaryConfig.pluginName}-service.${namespace}.svc.cluster.local`,
                  subset: 'stable'
                },
                weight: canaryConfig.trafficSplit.stable
              },
              {
                destination: {
                  host: `${canaryConfig.pluginName}-service.${namespace}.svc.cluster.local`,
                  subset: 'canary'
                },
                weight: canaryConfig.trafficSplit.canary
              }
            ]
          }
        ]
      }
    };

    await this.createOrUpdateCustomResource(
      'networking.istio.io',
      'v1beta1',
      'virtualservices',
      namespace,
      virtualService
    );
  }

  /**
   * Configure Linkerd canary traffic splitting
   */
  private async configureLinkerdCanaryTraffic(canaryConfig: CanaryConfig): Promise<void> {
    const namespace = `plugin-${canaryConfig.pluginName}`;
    
    // Update TrafficSplit resource
    const trafficSplit = {
      apiVersion: 'split.smi-spec.io/v1alpha1',
      kind: 'TrafficSplit',
      metadata: {
        name: `${canaryConfig.pluginName}-traffic-split`,
        namespace
      },
      spec: {
        service: `${canaryConfig.pluginName}-service`,
        backends: [
          {
            service: `${canaryConfig.pluginName}-service-stable`,
            weight: canaryConfig.trafficSplit.stable
          },
          {
            service: `${canaryConfig.pluginName}-service-canary`,
            weight: canaryConfig.trafficSplit.canary
          }
        ]
      }
    };

    await this.createOrUpdateCustomResource(
      'split.smi-spec.io',
      'v1alpha1',
      'trafficsplits',
      namespace,
      trafficSplit
    );
  }

  /**
   * Remove service mesh configuration for a plugin
   */
  async removeServiceConfiguration(pluginDefinition: PluginDefinition): Promise<void> {
    const namespace = `plugin-${pluginDefinition.name}`;
    
    this.logger.info(`Removing service mesh configuration for plugin: ${pluginDefinition.name}`);

    try {
      switch (this.config.provider) {
        case 'istio':
          await this.removeIstioConfiguration(pluginDefinition, namespace);
          break;
        case 'linkerd':
          await this.removeLinkerdConfiguration(pluginDefinition, namespace);
          break;
      }
    } catch (error) {
      this.logger.error(`Failed to remove service mesh configuration: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove Istio configuration
   */
  private async removeIstioConfiguration(pluginDefinition: PluginDefinition, namespace: string): Promise<void> {
    const resources = [
      { group: 'networking.istio.io', version: 'v1beta1', plural: 'destinationrules', name: `${pluginDefinition.name}-destination-rule` },
      { group: 'networking.istio.io', version: 'v1beta1', plural: 'virtualservices', name: `${pluginDefinition.name}-virtual-service` },
      { group: 'security.istio.io', version: 'v1beta1', plural: 'peerauthentications', name: `${pluginDefinition.name}-peer-auth` },
      { group: 'security.istio.io', version: 'v1beta1', plural: 'authorizationpolicies', name: `${pluginDefinition.name}-authz` }
    ];

    for (const resource of resources) {
      try {
        await this.customObjectsApi.deleteNamespacedCustomObject(
          resource.group,
          resource.version,
          namespace,
          resource.plural,
          resource.name
        );
      } catch (error) {
        if (error.response?.statusCode !== 404) {
          this.logger.warn(`Failed to delete ${resource.plural}/${resource.name}: ${error.message}`);
        }
      }
    }
  }

  /**
   * Remove Linkerd configuration
   */
  private async removeLinkerdConfiguration(pluginDefinition: PluginDefinition, namespace: string): Promise<void> {
    const resources = [
      { group: 'split.smi-spec.io', version: 'v1alpha1', plural: 'trafficsplits', name: `${pluginDefinition.name}-traffic-split` },
      { group: 'linkerd.io', version: 'v1alpha2', plural: 'serviceprofiles', name: `${pluginDefinition.name}-service.${namespace}` }
    ];

    for (const resource of resources) {
      try {
        await this.customObjectsApi.deleteNamespacedCustomObject(
          resource.group,
          resource.version,
          namespace,
          resource.plural,
          resource.name
        );
      } catch (error) {
        if (error.response?.statusCode !== 404) {
          this.logger.warn(`Failed to delete ${resource.plural}/${resource.name}: ${error.message}`);
        }
      }
    }
  }

  /**
   * Create ServiceMonitor for Prometheus metrics collection
   */
  private async createServiceMonitor(
    pluginDefinition: PluginDefinition,
    deploymentInfo: DeploymentInfo
  ): Promise<void> {
    const serviceMonitor = {
      apiVersion: 'monitoring.coreos.com/v1',
      kind: 'ServiceMonitor',
      metadata: {
        name: `${pluginDefinition.name}-monitor`,
        namespace: deploymentInfo.namespace,
        labels: {
          app: pluginDefinition.name,
          managed: 'plugin-pipeline'
        }
      },
      spec: {
        selector: {
          matchLabels: {
            app: pluginDefinition.name
          }
        },
        endpoints: [
          {
            port: 'metrics',
            interval: '30s',
            path: pluginDefinition.observability.metrics?.path || '/metrics'
          }
        ]
      }
    };

    await this.createOrUpdateCustomResource(
      'monitoring.coreos.com',
      'v1',
      'servicemonitors',
      deploymentInfo.namespace,
      serviceMonitor
    );
  }

  /**
   * Helper method to create traffic policy based on plugin definition
   */
  private createTrafficPolicy(pluginDefinition: PluginDefinition): any {
    return {
      loadBalancer: {
        simple: 'LEAST_CONN'
      },
      connectionPool: {
        tcp: {
          maxConnections: 100,
          connectTimeout: '30s'
        },
        http: {
          http1MaxPendingRequests: 10,
          http2MaxRequests: 100,
          maxRequestsPerConnection: 10,
          maxRetries: 3,
          idleTimeout: '90s'
        }
      },
      outlierDetection: {
        consecutiveErrors: 3,
        interval: '30s',
        baseEjectionTime: '30s',
        maxEjectionPercent: 50
      }
    };
  }

  /**
   * Helper method to create subsets for destination rule
   */
  private createSubsets(pluginDefinition: PluginDefinition, deploymentInfo: DeploymentInfo): any[] {
    return [
      {
        name: 'stable',
        labels: {
          version: 'stable'
        }
      },
      {
        name: 'canary',
        labels: {
          version: 'canary'
        }
      }
    ];
  }

  /**
   * Generic method to create or update custom resources
   */
  private async createOrUpdateCustomResource(
    group: string,
    version: string,
    plural: string,
    namespace: string,
    resource: any
  ): Promise<void> {
    try {
      await this.customObjectsApi.replaceNamespacedCustomObject(
        group,
        version,
        namespace,
        plural,
        resource.metadata.name,
        resource
      );
    } catch (error) {
      if (error.response?.statusCode === 404) {
        await this.customObjectsApi.createNamespacedCustomObject(
          group,
          version,
          namespace,
          plural,
          resource
        );
      } else {
        throw error;
      }
    }
  }
}