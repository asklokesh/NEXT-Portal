import { KubernetesApi } from '@kubernetes/client-node';
import { EventEmitter } from 'events';
import { ProgressiveDeployment, TrafficSplit } from './types';

export class TrafficSplitManager extends EventEmitter {
  private k8sApi: KubernetesApi;
  private activeRules = new Map<string, TrafficRule>();

  constructor(k8sApi: KubernetesApi) {
    super();
    this.k8sApi = k8sApi;
  }

  async initialize(deployment: ProgressiveDeployment): Promise<void> {
    await this.createTrafficRule(deployment);
    this.emit('trafficSplitInitialized', { deployment });
  }

  async updateTrafficSplit(deployment: ProgressiveDeployment, trafficSplit: TrafficSplit): Promise<void> {
    const { service } = deployment.config;
    
    // Validate traffic split
    this.validateTrafficSplit(trafficSplit);
    
    // Update Istio VirtualService
    await this.updateVirtualService(deployment, trafficSplit);
    
    // Update load balancer configuration if needed
    await this.updateLoadBalancerConfig(deployment, trafficSplit);
    
    // Update service mesh destination rules
    await this.updateDestinationRules(deployment, trafficSplit);
    
    // Store current traffic split
    const rule = this.activeRules.get(deployment.id);
    if (rule) {
      rule.currentSplit = trafficSplit;
      rule.lastUpdated = new Date();
    }
    
    this.emit('trafficSplitUpdated', { deployment, trafficSplit });
  }

  async gradualTrafficShift(
    deployment: ProgressiveDeployment,
    targetSplit: TrafficSplit,
    stepSize: number = 10,
    intervalSeconds: number = 30
  ): Promise<void> {
    const currentSplit = await this.getCurrentTrafficSplit(deployment);
    const steps = this.calculateTrafficSteps(currentSplit, targetSplit, stepSize);
    
    for (const step of steps) {
      await this.updateTrafficSplit(deployment, step.split);
      
      this.emit('trafficStepCompleted', {
        deployment,
        step: step.step,
        totalSteps: steps.length,
        split: step.split
      });
      
      if (step.step < steps.length) {
        await this.sleep(intervalSeconds * 1000);
      }
    }
    
    this.emit('gradualTrafficShiftCompleted', { deployment, targetSplit });
  }

  async implementCanaryTrafficPattern(deployment: ProgressiveDeployment): Promise<void> {
    const { traffic } = deployment.config;
    
    // Start with small percentage to canary
    await this.updateTrafficSplit(deployment, {
      stable: 100 - traffic.stepWeight,
      canary: traffic.stepWeight
    });
    
    this.emit('canaryTrafficPatternStarted', { deployment });
  }

  async implementBlueGreenTrafficPattern(deployment: ProgressiveDeployment): Promise<void> {
    // Initially route all traffic to blue (stable)
    await this.updateTrafficSplit(deployment, {
      stable: 100,
      canary: 0
    });
    
    // Create preview route for green testing
    await this.createPreviewRoute(deployment);
    
    this.emit('blueGreenTrafficPatternStarted', { deployment });
  }

  async implementABTestTrafficPattern(deployment: ProgressiveDeployment, splitPercentage: number = 50): Promise<void> {
    // Equal split between control and variant
    await this.updateTrafficSplit(deployment, {
      stable: splitPercentage,
      canary: 100 - splitPercentage
    });
    
    // Add user-based routing rules for consistent experience
    await this.addUserBasedRouting(deployment);
    
    this.emit('abTestTrafficPatternStarted', { deployment, splitPercentage });
  }

  async enableStickySessionsTrafficRouting(deployment: ProgressiveDeployment): Promise<void> {
    const { service } = deployment.config;
    
    const sessionAffinityConfig = {
      sessionAffinity: {
        cookieName: `${service.name}-session`,
        maxAge: 3600, // 1 hour
        path: '/',
        httpOnly: true
      }
    };
    
    await this.updateVirtualServiceWithSessionAffinity(deployment, sessionAffinityConfig);
    
    this.emit('stickySessionsEnabled', { deployment });
  }

  async implementGeographicTrafficRouting(deployment: ProgressiveDeployment, rules: GeographicRule[]): Promise<void> {
    const geoRoutes = rules.map(rule => ({
      match: [{
        headers: {
          'x-user-country': {
            exact: rule.country
          }
        }
      }],
      route: [{
        destination: {
          host: `${deployment.config.service.name}.${deployment.config.service.namespace}.svc.cluster.local`,
          subset: rule.version
        }
      }]
    }));
    
    await this.addCustomRoutes(deployment, geoRoutes);
    
    this.emit('geographicTrafficRoutingEnabled', { deployment, rules });
  }

  async implementHeaderBasedRouting(deployment: ProgressiveDeployment, headerRules: HeaderRule[]): Promise<void> {
    const headerRoutes = headerRules.map(rule => ({
      match: [{
        headers: {
          [rule.header]: rule.matcher
        }
      }],
      route: [{
        destination: {
          host: `${deployment.config.service.name}.${deployment.config.service.namespace}.svc.cluster.local`,
          subset: rule.targetVersion
        },
        weight: rule.weight || 100
      }]
    }));
    
    await this.addCustomRoutes(deployment, headerRoutes);
    
    this.emit('headerBasedRoutingEnabled', { deployment, headerRules });
  }

  async implementCircuitBreakerPattern(deployment: ProgressiveDeployment, config: CircuitBreakerConfig): Promise<void> {
    const { service } = deployment.config;
    
    const circuitBreakerRule = {
      connectionPool: {
        tcp: {
          maxConnections: config.maxConnections,
          connectTimeout: config.connectTimeout,
          tcpKeepalive: {
            time: 7200,
            interval: 75,
            probes: 9
          }
        },
        http: {
          http1MaxPendingRequests: config.maxPendingRequests,
          http2MaxRequests: config.maxRequests,
          maxRequestsPerConnection: config.maxRequestsPerConnection,
          maxRetries: config.maxRetries,
          idleTimeout: config.idleTimeout
        }
      },
      outlierDetection: {
        consecutiveErrors: config.consecutiveErrors,
        interval: config.detectionInterval,
        baseEjectionTime: config.baseEjectionTime,
        maxEjectionPercent: config.maxEjectionPercent,
        minHealthPercent: config.minHealthPercent
      }
    };
    
    await this.updateDestinationRuleWithCircuitBreaker(deployment, circuitBreakerRule);
    
    this.emit('circuitBreakerEnabled', { deployment, config });
  }

  async implementRetryPolicy(deployment: ProgressiveDeployment, retryPolicy: RetryPolicy): Promise<void> {
    const retryConfig = {
      attempts: retryPolicy.attempts,
      perTryTimeout: retryPolicy.perTryTimeout,
      retryOn: retryPolicy.retryOn,
      retryRemoteLocalities: retryPolicy.retryRemoteLocalities
    };
    
    await this.updateVirtualServiceWithRetry(deployment, retryConfig);
    
    this.emit('retryPolicyEnabled', { deployment, retryPolicy });
  }

  async enableRequestTimeouts(deployment: ProgressiveDeployment, timeout: string): Promise<void> {
    await this.updateVirtualServiceWithTimeout(deployment, timeout);
    this.emit('timeoutsEnabled', { deployment, timeout });
  }

  async enableFaultInjection(deployment: ProgressiveDeployment, faultConfig: FaultInjectionConfig): Promise<void> {
    const faultRules = {
      delay: faultConfig.delay ? {
        percentage: faultConfig.delay.percentage,
        fixedDelay: faultConfig.delay.fixedDelay
      } : undefined,
      abort: faultConfig.abort ? {
        percentage: faultConfig.abort.percentage,
        httpStatus: faultConfig.abort.httpStatus
      } : undefined
    };
    
    await this.updateVirtualServiceWithFaults(deployment, faultRules);
    
    this.emit('faultInjectionEnabled', { deployment, faultConfig });
  }

  async getCurrentTrafficSplit(deployment: ProgressiveDeployment): Promise<TrafficSplit> {
    const rule = this.activeRules.get(deployment.id);
    if (rule) {
      return rule.currentSplit;
    }
    
    // Fetch from Kubernetes if not cached
    return this.fetchCurrentTrafficSplitFromK8s(deployment);
  }

  async getTrafficMetrics(deployment: ProgressiveDeployment): Promise<TrafficMetrics> {
    const { service } = deployment.config;
    
    // This would integrate with Prometheus or other metrics systems
    return {
      totalRequests: 1000,
      stableRequests: 800,
      canaryRequests: 200,
      errorRate: 0.005,
      averageLatency: 150,
      p99Latency: 500,
      throughput: 100
    };
  }

  private async createTrafficRule(deployment: ProgressiveDeployment): Promise<void> {
    const { service } = deployment.config;
    
    // Create Istio DestinationRule for traffic management
    const destinationRule = {
      apiVersion: 'networking.istio.io/v1beta1',
      kind: 'DestinationRule',
      metadata: {
        name: `${service.name}-traffic-dr`,
        namespace: service.namespace,
        labels: {
          'progressive-delivery/deployment': deployment.id
        }
      },
      spec: {
        host: `${service.name}.${service.namespace}.svc.cluster.local`,
        trafficPolicy: {
          loadBalancer: {
            simple: 'LEAST_CONN' // Default load balancing algorithm
          }
        },
        subsets: [
          {
            name: 'stable',
            labels: {
              version: 'stable'
            },
            trafficPolicy: {
              connectionPool: {
                tcp: {
                  maxConnections: 100
                },
                http: {
                  http1MaxPendingRequests: 10,
                  maxRequestsPerConnection: 2
                }
              }
            }
          },
          {
            name: 'canary',
            labels: {
              version: 'canary'
            },
            trafficPolicy: {
              connectionPool: {
                tcp: {
                  maxConnections: 50
                },
                http: {
                  http1MaxPendingRequests: 5,
                  maxRequestsPerConnection: 1
                }
              }
            }
          }
        ]
      }
    };
    
    // Create VirtualService for traffic routing
    const virtualService = {
      apiVersion: 'networking.istio.io/v1beta1',
      kind: 'VirtualService',
      metadata: {
        name: `${service.name}-traffic-vs`,
        namespace: service.namespace,
        labels: {
          'progressive-delivery/deployment': deployment.id
        }
      },
      spec: {
        hosts: [
          `${service.name}.${service.namespace}.svc.cluster.local`,
          service.name
        ],
        gateways: [`${service.name}-gateway`],
        http: [{
          name: 'primary-route',
          match: [{
            uri: {
              prefix: '/'
            }
          }],
          route: [
            {
              destination: {
                host: `${service.name}.${service.namespace}.svc.cluster.local`,
                subset: 'stable'
              },
              weight: 100
            }
          ],
          timeout: '30s',
          retries: {
            attempts: 3,
            perTryTimeout: '10s',
            retryOn: 'gateway-error,connect-failure,refused-stream'
          }
        }]
      }
    };
    
    await Promise.all([
      this.k8sApi.createCustomResource(destinationRule),
      this.k8sApi.createCustomResource(virtualService)
    ]);
    
    // Store traffic rule
    this.activeRules.set(deployment.id, {
      deploymentId: deployment.id,
      currentSplit: { stable: 100, canary: 0 },
      destinationRuleName: `${service.name}-traffic-dr`,
      virtualServiceName: `${service.name}-traffic-vs`,
      lastUpdated: new Date()
    });
  }

  private validateTrafficSplit(trafficSplit: TrafficSplit): void {
    const totalWeight = trafficSplit.stable + trafficSplit.canary + (trafficSplit.preview || 0);
    
    if (totalWeight !== 100) {
      throw new Error(`Traffic split weights must sum to 100, got ${totalWeight}`);
    }
    
    if (trafficSplit.stable < 0 || trafficSplit.canary < 0 || (trafficSplit.preview && trafficSplit.preview < 0)) {
      throw new Error('Traffic split weights must be non-negative');
    }
  }

  private async updateVirtualService(deployment: ProgressiveDeployment, trafficSplit: TrafficSplit): Promise<void> {
    const { service } = deployment.config;
    const rule = this.activeRules.get(deployment.id);
    
    if (!rule) {
      throw new Error('Traffic rule not found for deployment');
    }
    
    const routes = [];
    
    if (trafficSplit.stable > 0) {
      routes.push({
        destination: {
          host: `${service.name}.${service.namespace}.svc.cluster.local`,
          subset: 'stable'
        },
        weight: trafficSplit.stable
      });
    }
    
    if (trafficSplit.canary > 0) {
      routes.push({
        destination: {
          host: `${service.name}.${service.namespace}.svc.cluster.local`,
          subset: 'canary'
        },
        weight: trafficSplit.canary
      });
    }
    
    const virtualServiceUpdate = {
      spec: {
        http: [{
          name: 'primary-route',
          match: [{
            uri: {
              prefix: '/'
            }
          }],
          route: routes,
          timeout: '30s',
          retries: {
            attempts: 3,
            perTryTimeout: '10s',
            retryOn: 'gateway-error,connect-failure,refused-stream'
          }
        }]
      }
    };
    
    await this.k8sApi.patchCustomResource(
      'networking.istio.io/v1beta1',
      'virtualservices',
      service.namespace,
      rule.virtualServiceName,
      virtualServiceUpdate
    );
  }

  private async updateLoadBalancerConfig(deployment: ProgressiveDeployment, trafficSplit: TrafficSplit): Promise<void> {
    // Update external load balancer configuration if needed
    // This would integrate with cloud provider load balancers (ALB, NLB, etc.)
  }

  private async updateDestinationRules(deployment: ProgressiveDeployment, trafficSplit: TrafficSplit): Promise<void> {
    // Update destination rule policies based on traffic split
    const { service } = deployment.config;
    const rule = this.activeRules.get(deployment.id);
    
    if (!rule) return;
    
    // Adjust connection pool settings based on expected traffic
    const stableConnections = Math.max(10, Math.floor(trafficSplit.stable * 2));
    const canaryConnections = Math.max(5, Math.floor(trafficSplit.canary * 2));
    
    const destinationRuleUpdate = {
      spec: {
        subsets: [
          {
            name: 'stable',
            labels: {
              version: 'stable'
            },
            trafficPolicy: {
              connectionPool: {
                tcp: {
                  maxConnections: stableConnections
                },
                http: {
                  http1MaxPendingRequests: Math.floor(stableConnections / 10),
                  maxRequestsPerConnection: 2
                }
              }
            }
          },
          {
            name: 'canary',
            labels: {
              version: 'canary'
            },
            trafficPolicy: {
              connectionPool: {
                tcp: {
                  maxConnections: canaryConnections
                },
                http: {
                  http1MaxPendingRequests: Math.floor(canaryConnections / 10),
                  maxRequestsPerConnection: 1
                }
              }
            }
          }
        ]
      }
    };
    
    await this.k8sApi.patchCustomResource(
      'networking.istio.io/v1beta1',
      'destinationrules',
      service.namespace,
      rule.destinationRuleName,
      destinationRuleUpdate
    );
  }

  private calculateTrafficSteps(current: TrafficSplit, target: TrafficSplit, stepSize: number): TrafficStep[] {
    const steps: TrafficStep[] = [];
    const stableDiff = target.stable - current.stable;
    const canaryDiff = target.canary - current.canary;
    
    const totalSteps = Math.ceil(Math.abs(Math.max(Math.abs(stableDiff), Math.abs(canaryDiff))) / stepSize);
    
    for (let i = 1; i <= totalSteps; i++) {
      const progress = i / totalSteps;
      
      steps.push({
        step: i,
        split: {
          stable: Math.round(current.stable + stableDiff * progress),
          canary: Math.round(current.canary + canaryDiff * progress)
        }
      });
    }
    
    return steps;
  }

  private async createPreviewRoute(deployment: ProgressiveDeployment): Promise<void> {
    const { service } = deployment.config;
    const rule = this.activeRules.get(deployment.id);
    
    if (!rule) return;
    
    // Add preview route to existing VirtualService
    const previewRoute = {
      name: 'preview-route',
      match: [{
        headers: {
          'x-preview': {
            exact: 'true'
          }
        }
      }],
      route: [{
        destination: {
          host: `${service.name}.${service.namespace}.svc.cluster.local`,
          subset: 'canary'
        }
      }]
    };
    
    // Update VirtualService with preview route
    await this.addCustomRoutes(deployment, [previewRoute]);
  }

  private async addUserBasedRouting(deployment: ProgressiveDeployment): Promise<void> {
    const userRoutes = [
      {
        name: 'user-hash-routing',
        match: [{
          headers: {
            'user-id': {
              regex: '.*[02468]$' // Route even user IDs to canary
            }
          }
        }],
        route: [{
          destination: {
            host: `${deployment.config.service.name}.${deployment.config.service.namespace}.svc.cluster.local`,
            subset: 'canary'
          }
        }]
      }
    ];
    
    await this.addCustomRoutes(deployment, userRoutes);
  }

  private async addCustomRoutes(deployment: ProgressiveDeployment, routes: any[]): Promise<void> {
    const { service } = deployment.config;
    const rule = this.activeRules.get(deployment.id);
    
    if (!rule) return;
    
    // Get current VirtualService
    const currentVS = await this.k8sApi.getCustomResource(
      'networking.istio.io/v1beta1',
      'virtualservices',
      service.namespace,
      rule.virtualServiceName
    );
    
    // Add new routes
    const updatedHttp = [...currentVS.spec.http, ...routes];
    
    const virtualServiceUpdate = {
      spec: {
        http: updatedHttp
      }
    };
    
    await this.k8sApi.patchCustomResource(
      'networking.istio.io/v1beta1',
      'virtualservices',
      service.namespace,
      rule.virtualServiceName,
      virtualServiceUpdate
    );
  }

  private async updateVirtualServiceWithSessionAffinity(deployment: ProgressiveDeployment, config: any): Promise<void> {
    // Implementation for session affinity
  }

  private async updateDestinationRuleWithCircuitBreaker(deployment: ProgressiveDeployment, config: any): Promise<void> {
    const { service } = deployment.config;
    const rule = this.activeRules.get(deployment.id);
    
    if (!rule) return;
    
    const destinationRuleUpdate = {
      spec: {
        trafficPolicy: config
      }
    };
    
    await this.k8sApi.patchCustomResource(
      'networking.istio.io/v1beta1',
      'destinationrules',
      service.namespace,
      rule.destinationRuleName,
      destinationRuleUpdate
    );
  }

  private async updateVirtualServiceWithRetry(deployment: ProgressiveDeployment, retryConfig: any): Promise<void> {
    const { service } = deployment.config;
    const rule = this.activeRules.get(deployment.id);
    
    if (!rule) return;
    
    const virtualServiceUpdate = {
      spec: {
        http: [{
          retries: retryConfig
        }]
      }
    };
    
    await this.k8sApi.patchCustomResource(
      'networking.istio.io/v1beta1',
      'virtualservices',
      service.namespace,
      rule.virtualServiceName,
      virtualServiceUpdate
    );
  }

  private async updateVirtualServiceWithTimeout(deployment: ProgressiveDeployment, timeout: string): Promise<void> {
    const { service } = deployment.config;
    const rule = this.activeRules.get(deployment.id);
    
    if (!rule) return;
    
    const virtualServiceUpdate = {
      spec: {
        http: [{
          timeout: timeout
        }]
      }
    };
    
    await this.k8sApi.patchCustomResource(
      'networking.istio.io/v1beta1',
      'virtualservices',
      service.namespace,
      rule.virtualServiceName,
      virtualServiceUpdate
    );
  }

  private async updateVirtualServiceWithFaults(deployment: ProgressiveDeployment, faultConfig: any): Promise<void> {
    const { service } = deployment.config;
    const rule = this.activeRules.get(deployment.id);
    
    if (!rule) return;
    
    const virtualServiceUpdate = {
      spec: {
        http: [{
          fault: faultConfig
        }]
      }
    };
    
    await this.k8sApi.patchCustomResource(
      'networking.istio.io/v1beta1',
      'virtualservices',
      service.namespace,
      rule.virtualServiceName,
      virtualServiceUpdate
    );
  }

  private async fetchCurrentTrafficSplitFromK8s(deployment: ProgressiveDeployment): Promise<TrafficSplit> {
    const { service } = deployment.config;
    const rule = this.activeRules.get(deployment.id);
    
    if (!rule) {
      return { stable: 100, canary: 0 };
    }
    
    try {
      const vs = await this.k8sApi.getCustomResource(
        'networking.istio.io/v1beta1',
        'virtualservices',
        service.namespace,
        rule.virtualServiceName
      );
      
      const routes = vs.spec.http[0].route;
      const stableRoute = routes.find((r: any) => r.destination.subset === 'stable');
      const canaryRoute = routes.find((r: any) => r.destination.subset === 'canary');
      
      return {
        stable: stableRoute?.weight || 0,
        canary: canaryRoute?.weight || 0
      };
    } catch (error) {
      return { stable: 100, canary: 0 };
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async cleanup(deploymentId: string): Promise<void> {
    const rule = this.activeRules.get(deploymentId);
    if (rule) {
      const deployment = { config: { service: { namespace: rule.deploymentId.split('-')[0] } } } as any;
      
      // Clean up Kubernetes resources
      await Promise.all([
        this.k8sApi.deleteCustomResource(
          'networking.istio.io/v1beta1',
          'destinationrules',
          deployment.config.service.namespace,
          rule.destinationRuleName
        ),
        this.k8sApi.deleteCustomResource(
          'networking.istio.io/v1beta1',
          'virtualservices',
          deployment.config.service.namespace,
          rule.virtualServiceName
        )
      ]);
      
      this.activeRules.delete(deploymentId);
    }
    
    this.emit('trafficRuleCleanedUp', { deploymentId });
  }
}

interface TrafficRule {
  deploymentId: string;
  currentSplit: TrafficSplit;
  destinationRuleName: string;
  virtualServiceName: string;
  lastUpdated: Date;
}

interface TrafficStep {
  step: number;
  split: TrafficSplit;
}

interface GeographicRule {
  country: string;
  version: 'stable' | 'canary';
}

interface HeaderRule {
  header: string;
  matcher: {
    exact?: string;
    regex?: string;
    prefix?: string;
  };
  targetVersion: 'stable' | 'canary';
  weight?: number;
}

interface CircuitBreakerConfig {
  maxConnections: number;
  connectTimeout: string;
  maxPendingRequests: number;
  maxRequests: number;
  maxRequestsPerConnection: number;
  maxRetries: number;
  idleTimeout: string;
  consecutiveErrors: number;
  detectionInterval: string;
  baseEjectionTime: string;
  maxEjectionPercent: number;
  minHealthPercent: number;
}

interface RetryPolicy {
  attempts: number;
  perTryTimeout: string;
  retryOn: string;
  retryRemoteLocalities?: boolean;
}

interface FaultInjectionConfig {
  delay?: {
    percentage: number;
    fixedDelay: string;
  };
  abort?: {
    percentage: number;
    httpStatus: number;
  };
}

interface TrafficMetrics {
  totalRequests: number;
  stableRequests: number;
  canaryRequests: number;
  errorRate: number;
  averageLatency: number;
  p99Latency: number;
  throughput: number;
}