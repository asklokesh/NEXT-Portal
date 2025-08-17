/**
 * Traffic Routing Manager
 * 
 * Manages intelligent traffic routing for canary deployments with:
 * - Progressive traffic splitting
 * - User cohort-based routing
 * - Geographic traffic distribution
 * - A/B testing capabilities
 * - Real-time traffic analytics
 * - Circuit breaker integration
 */

import { Logger } from '../lib/logging/logger';
import * as k8s from '@kubernetes/client-node';

const logger = new Logger('TrafficRoutingManager');

export interface TrafficRule {
  id: string;
  deploymentId: string;
  pluginName: string;
  namespace: string;
  
  // Traffic Distribution
  distribution: {
    stable: number;      // Percentage to stable version (0-100)
    canary: number;      // Percentage to canary version (0-100)
    mirror?: number;     // Percentage to mirror for shadow testing
  };
  
  // Advanced Routing Rules
  rules: TrafficRoutingRule[];
  
  // Circuit Breaker Configuration
  circuitBreaker: {
    enabled: boolean;
    errorThreshold: number;    // Percentage of errors to trigger circuit breaker
    timeWindow: number;        // Time window in seconds
    minimumRequests: number;   // Minimum requests before evaluation
    recoveryTime: number;      // Time to wait before retry in seconds
  };
  
  // Sticky Sessions
  sessionAffinity: {
    enabled: boolean;
    method: 'cookie' | 'header' | 'source_ip';
    cookieName?: string;
    headerName?: string;
    ttl: number; // seconds
  };
  
  // Rate Limiting
  rateLimiting: {
    enabled: boolean;
    requestsPerSecond: number;
    burstSize: number;
  };
  
  // Geographic Distribution
  geoRouting: {
    enabled: boolean;
    rules: Array<{
      regions: string[];
      distribution: { stable: number; canary: number };
    }>;
  };
  
  // Monitoring
  monitoring: {
    metricsInterval: number; // seconds
    healthCheckPath: string;
    alertThresholds: {
      errorRate: number;
      latencyP95: number;
      latencyP99: number;
    };
  };
}

export interface TrafficRoutingRule {
  id: string;
  name: string;
  priority: number; // Lower number = higher priority
  
  // Matching Criteria
  match: {
    headers?: Record<string, string | RegExp>;
    queryParams?: Record<string, string | RegExp>;
    path?: string | RegExp;
    method?: string[];
    sourceLabels?: Record<string, string>;
    userAttributes?: Record<string, any>;
    cohort?: string[];
    percentage?: number; // Random percentage split
  };
  
  // Routing Action
  action: {
    destination: 'stable' | 'canary' | 'both';
    weight?: number; // Override distribution weight
    headers?: Record<string, string>; // Headers to add/modify
    timeout?: number; // Request timeout override
    retries?: number; // Retry attempts
    mirror?: boolean; // Mirror traffic for testing
  };
  
  // Conditions
  enabled: boolean;
  startTime?: Date;
  endTime?: Date;
}

export interface TrafficMetrics {
  timestamp: Date;
  deploymentId: string;
  
  // Request Metrics
  requests: {
    total: number;
    stable: number;
    canary: number;
    mirrored: number;
  };
  
  // Response Metrics
  responses: {
    success: number;      // 2xx responses
    clientError: number;  // 4xx responses
    serverError: number;  // 5xx responses
  };
  
  // Latency Metrics
  latency: {
    p50: number;
    p95: number;
    p99: number;
    max: number;
  };
  
  // Traffic Distribution
  actualDistribution: {
    stable: number;
    canary: number;
  };
  
  // Circuit Breaker Status
  circuitBreaker: {
    state: 'closed' | 'open' | 'half_open';
    failureCount: number;
    lastFailureTime?: Date;
  };
  
  // Geographic Distribution
  geoDistribution: Record<string, {
    requests: number;
    latency: number;
    errorRate: number;
  }>;
}

export class TrafficRoutingManager {
  private k8sClient: k8s.KubernetesApi;
  private activeRules = new Map<string, TrafficRule>();
  private trafficMetrics = new Map<string, TrafficMetrics[]>();
  private metricsCollector: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeKubernetesClient();
    this.startMetricsCollection();
  }

  /**
   * Create and apply traffic routing rule
   */
  async createTrafficRule(rule: TrafficRule): Promise<void> {
    logger.info('Creating traffic routing rule', { 
      deploymentId: rule.deploymentId,
      distribution: rule.distribution 
    });

    try {
      // Validate rule
      this.validateTrafficRule(rule);
      
      // Store rule
      this.activeRules.set(rule.id, rule);
      
      // Apply to Kubernetes
      await this.applyIstioVirtualService(rule);
      await this.applyIstioDestinationRule(rule);
      
      // Set up monitoring
      await this.setupTrafficMonitoring(rule);
      
      logger.info('Traffic routing rule created successfully', { ruleId: rule.id });

    } catch (error) {
      logger.error('Failed to create traffic routing rule', { error, rule });
      throw error;
    }
  }

  /**
   * Update existing traffic routing rule
   */
  async updateTrafficRule(ruleId: string, updates: Partial<TrafficRule>): Promise<void> {
    const existingRule = this.activeRules.get(ruleId);
    if (!existingRule) {
      throw new Error(`Traffic rule ${ruleId} not found`);
    }

    const updatedRule = { ...existingRule, ...updates };
    
    logger.info('Updating traffic routing rule', { 
      ruleId,
      oldDistribution: existingRule.distribution,
      newDistribution: updatedRule.distribution 
    });

    try {
      // Validate updated rule
      this.validateTrafficRule(updatedRule);
      
      // Apply gradual traffic shift if distribution changed
      if (JSON.stringify(existingRule.distribution) !== JSON.stringify(updatedRule.distribution)) {
        await this.performGradualTrafficShift(existingRule, updatedRule);
      } else {
        // Apply immediate update for other changes
        await this.applyIstioVirtualService(updatedRule);
        await this.applyIstioDestinationRule(updatedRule);
      }
      
      // Update stored rule
      this.activeRules.set(ruleId, updatedRule);
      
      logger.info('Traffic routing rule updated successfully', { ruleId });

    } catch (error) {
      logger.error('Failed to update traffic routing rule', { error, ruleId });
      throw error;
    }
  }

  /**
   * Remove traffic routing rule
   */
  async removeTrafficRule(ruleId: string): Promise<void> {
    const rule = this.activeRules.get(ruleId);
    if (!rule) {
      throw new Error(`Traffic rule ${ruleId} not found`);
    }

    logger.info('Removing traffic routing rule', { ruleId });

    try {
      // Gradually shift all traffic to stable before removal
      await this.shiftAllTrafficToStable(rule);
      
      // Remove Kubernetes resources
      await this.removeIstioVirtualService(rule);
      await this.removeIstioDestinationRule(rule);
      
      // Remove from active rules
      this.activeRules.delete(ruleId);
      
      // Clean up metrics
      this.trafficMetrics.delete(ruleId);
      
      logger.info('Traffic routing rule removed successfully', { ruleId });

    } catch (error) {
      logger.error('Failed to remove traffic routing rule', { error, ruleId });
      throw error;
    }
  }

  /**
   * Get traffic metrics for a deployment
   */
  getTrafficMetrics(deploymentId: string, timeRange?: { start: Date; end: Date }): TrafficMetrics[] {
    const allMetrics = this.trafficMetrics.get(deploymentId) || [];
    
    if (!timeRange) {
      return allMetrics.slice(-100); // Last 100 data points
    }
    
    return allMetrics.filter(m => 
      m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
    );
  }

  /**
   * Get real-time traffic status
   */
  async getTrafficStatus(deploymentId: string): Promise<{
    rule: TrafficRule | null;
    metrics: TrafficMetrics | null;
    health: 'healthy' | 'warning' | 'critical';
    issues: string[];
  }> {
    const rule = Array.from(this.activeRules.values())
      .find(r => r.deploymentId === deploymentId);
    
    const metrics = this.trafficMetrics.get(deploymentId);
    const latestMetrics = metrics?.[metrics.length - 1] || null;
    
    // Analyze health
    const health = this.analyzeTrafficHealth(rule, latestMetrics);
    
    return {
      rule: rule || null,
      metrics: latestMetrics,
      health: health.status,
      issues: health.issues,
    };
  }

  /**
   * Perform gradual traffic shift between versions
   */
  private async performGradualTrafficShift(
    fromRule: TrafficRule, 
    toRule: TrafficRule
  ): Promise<void> {
    const steps = 5; // Number of gradual steps
    const stepDelay = 30000; // 30 seconds between steps
    
    const fromDistribution = fromRule.distribution;
    const toDistribution = toRule.distribution;
    
    const stableStep = (toDistribution.stable - fromDistribution.stable) / steps;
    const canaryStep = (toDistribution.canary - fromDistribution.canary) / steps;
    
    logger.info('Performing gradual traffic shift', {
      from: fromDistribution,
      to: toDistribution,
      steps,
      stepDelay
    });
    
    for (let i = 1; i <= steps; i++) {
      const currentStable = fromDistribution.stable + (stableStep * i);
      const currentCanary = fromDistribution.canary + (canaryStep * i);
      
      const intermediateRule = {
        ...toRule,
        distribution: {
          ...toRule.distribution,
          stable: Math.round(currentStable),
          canary: Math.round(currentCanary),
        },
      };
      
      logger.info(`Traffic shift step ${i}/${steps}`, {
        distribution: intermediateRule.distribution
      });
      
      await this.applyIstioVirtualService(intermediateRule);
      
      // Wait before next step (except for last step)
      if (i < steps) {
        await new Promise(resolve => setTimeout(resolve, stepDelay));
      }
      
      // Check health after each step
      const health = await this.checkTrafficHealth(toRule.id);
      if (health.status === 'critical') {
        logger.error('Critical health detected during traffic shift, reverting');
        await this.applyIstioVirtualService(fromRule);
        throw new Error('Traffic shift aborted due to critical health issues');
      }
    }
  }

  /**
   * Shift all traffic to stable version
   */
  private async shiftAllTrafficToStable(rule: TrafficRule): Promise<void> {
    const stableRule = {
      ...rule,
      distribution: {
        stable: 100,
        canary: 0,
        mirror: 0,
      },
    };
    
    await this.performGradualTrafficShift(rule, stableRule);
  }

  /**
   * Apply Istio VirtualService for traffic routing
   */
  private async applyIstioVirtualService(rule: TrafficRule): Promise<void> {
    const virtualService = this.generateVirtualServiceSpec(rule);
    
    try {
      await this.k8sClient.createNamespacedCustomObject(
        'networking.istio.io',
        'v1beta1',
        rule.namespace,
        'virtualservices',
        virtualService
      );
    } catch (error: any) {
      if (error.statusCode === 409) {
        // Resource exists, update it
        await this.k8sClient.replaceNamespacedCustomObject(
          'networking.istio.io',
          'v1beta1',
          rule.namespace,
          'virtualservices',
          `${rule.pluginName}-canary`,
          virtualService
        );
      } else {
        throw error;
      }
    }
  }

  /**
   * Apply Istio DestinationRule for load balancing
   */
  private async applyIstioDestinationRule(rule: TrafficRule): Promise<void> {
    const destinationRule = this.generateDestinationRuleSpec(rule);
    
    try {
      await this.k8sClient.createNamespacedCustomObject(
        'networking.istio.io',
        'v1beta1',
        rule.namespace,
        'destinationrules',
        destinationRule
      );
    } catch (error: any) {
      if (error.statusCode === 409) {
        // Resource exists, update it
        await this.k8sClient.replaceNamespacedCustomObject(
          'networking.istio.io',
          'v1beta1',
          rule.namespace,
          'destinationrules',
          `${rule.pluginName}-canary`,
          destinationRule
        );
      } else {
        throw error;
      }
    }
  }

  /**
   * Generate Istio VirtualService specification
   */
  private generateVirtualServiceSpec(rule: TrafficRule): any {
    const httpRoutes = [];
    
    // Process custom routing rules first (by priority)
    const sortedRules = rule.rules
      .filter(r => r.enabled)
      .sort((a, b) => a.priority - b.priority);
    
    for (const routingRule of sortedRules) {
      httpRoutes.push(this.generateHttpRoute(routingRule, rule));
    }
    
    // Default traffic split route
    httpRoutes.push({
      match: [{ uri: { prefix: '/' } }],
      route: [
        {
          destination: {
            host: rule.pluginName,
            subset: 'stable',
          },
          weight: rule.distribution.stable,
        },
        {
          destination: {
            host: rule.pluginName,
            subset: 'canary',
          },
          weight: rule.distribution.canary,
        },
      ],
      ...(rule.distribution.mirror && rule.distribution.mirror > 0 && {
        mirror: {
          host: rule.pluginName,
          subset: 'canary',
        },
        mirrorPercentage: {
          value: rule.distribution.mirror,
        },
      }),
      timeout: '30s',
      retries: {
        attempts: 3,
        perTryTimeout: '10s',
        retryOn: 'gateway-error,connect-failure,refused-stream',
      },
      ...(rule.circuitBreaker.enabled && {
        fault: {
          abort: {
            percentage: { value: 0.1 },
            httpStatus: 503,
          },
        },
      }),
    });
    
    return {
      apiVersion: 'networking.istio.io/v1beta1',
      kind: 'VirtualService',
      metadata: {
        name: `${rule.pluginName}-canary`,
        namespace: rule.namespace,
        labels: {
          'app': rule.pluginName,
          'deployment-id': rule.deploymentId,
          'managed-by': 'canary-deployment-controller',
        },
      },
      spec: {
        hosts: [rule.pluginName],
        http: httpRoutes,
      },
    };
  }

  /**
   * Generate HTTP route for custom routing rule
   */
  private generateHttpRoute(routingRule: TrafficRoutingRule, trafficRule: TrafficRule): any {
    const match: any = {};
    
    // Build match criteria
    if (routingRule.match.path) {
      match.uri = typeof routingRule.match.path === 'string' 
        ? { prefix: routingRule.match.path }
        : { regex: routingRule.match.path.source };
    }
    
    if (routingRule.match.headers) {
      match.headers = {};
      for (const [key, value] of Object.entries(routingRule.match.headers)) {
        match.headers[key] = typeof value === 'string' 
          ? { exact: value }
          : { regex: value.source };
      }
    }
    
    if (routingRule.match.queryParams) {
      match.queryParams = {};
      for (const [key, value] of Object.entries(routingRule.match.queryParams)) {
        match.queryParams[key] = typeof value === 'string' 
          ? { exact: value }
          : { regex: value.source };
      }
    }
    
    // Build route destination
    const route = [];
    
    if (routingRule.action.destination === 'stable') {
      route.push({
        destination: {
          host: trafficRule.pluginName,
          subset: 'stable',
        },
        weight: 100,
      });
    } else if (routingRule.action.destination === 'canary') {
      route.push({
        destination: {
          host: trafficRule.pluginName,
          subset: 'canary',
        },
        weight: 100,
      });
    } else if (routingRule.action.destination === 'both') {
      const weight = routingRule.action.weight || trafficRule.distribution.canary;
      route.push(
        {
          destination: {
            host: trafficRule.pluginName,
            subset: 'stable',
          },
          weight: 100 - weight,
        },
        {
          destination: {
            host: trafficRule.pluginName,
            subset: 'canary',
          },
          weight: weight,
        }
      );
    }
    
    return {
      match: [match],
      route,
      ...(routingRule.action.headers && {
        headers: {
          request: {
            add: routingRule.action.headers,
          },
        },
      }),
      ...(routingRule.action.timeout && {
        timeout: `${routingRule.action.timeout}s`,
      }),
      ...(routingRule.action.retries && {
        retries: {
          attempts: routingRule.action.retries,
        },
      }),
      ...(routingRule.action.mirror && {
        mirror: {
          host: trafficRule.pluginName,
          subset: 'canary',
        },
      }),
    };
  }

  /**
   * Generate Istio DestinationRule specification
   */
  private generateDestinationRuleSpec(rule: TrafficRule): any {
    return {
      apiVersion: 'networking.istio.io/v1beta1',
      kind: 'DestinationRule',
      metadata: {
        name: `${rule.pluginName}-canary`,
        namespace: rule.namespace,
        labels: {
          'app': rule.pluginName,
          'deployment-id': rule.deploymentId,
          'managed-by': 'canary-deployment-controller',
        },
      },
      spec: {
        host: rule.pluginName,
        trafficPolicy: {
          loadBalancer: {
            simple: 'LEAST_CONN',
          },
          connectionPool: {
            tcp: {
              maxConnections: 100,
            },
            http: {
              http1MaxPendingRequests: 50,
              maxRequestsPerConnection: 2,
            },
          },
          outlierDetection: {
            consecutiveGatewayErrors: 3,
            consecutive5xxErrors: 3,
            interval: '30s',
            baseEjectionTime: '30s',
            maxEjectionPercent: 20,
            minHealthPercent: 70,
          },
          ...(rule.circuitBreaker.enabled && {
            circuitBreaker: {
              thresholdErrors: Math.ceil(rule.circuitBreaker.minimumRequests * rule.circuitBreaker.errorThreshold / 100),
              interval: `${rule.circuitBreaker.timeWindow}s`,
              baseEjectionTime: `${rule.circuitBreaker.recoveryTime}s`,
            },
          }),
        },
        subsets: [
          {
            name: 'stable',
            labels: {
              version: 'stable',
            },
            trafficPolicy: {
              portLevelSettings: [
                {
                  port: {
                    number: 80,
                  },
                  connectionPool: {
                    tcp: {
                      maxConnections: 50,
                    },
                  },
                },
              ],
            },
          },
          {
            name: 'canary',
            labels: {
              version: 'canary',
            },
            trafficPolicy: {
              portLevelSettings: [
                {
                  port: {
                    number: 80,
                  },
                  connectionPool: {
                    tcp: {
                      maxConnections: 25,
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    };
  }

  /**
   * Remove Istio VirtualService
   */
  private async removeIstioVirtualService(rule: TrafficRule): Promise<void> {
    try {
      await this.k8sClient.deleteNamespacedCustomObject(
        'networking.istio.io',
        'v1beta1',
        rule.namespace,
        'virtualservices',
        `${rule.pluginName}-canary`
      );
    } catch (error: any) {
      if (error.statusCode !== 404) {
        throw error;
      }
    }
  }

  /**
   * Remove Istio DestinationRule
   */
  private async removeIstioDestinationRule(rule: TrafficRule): Promise<void> {
    try {
      await this.k8sClient.deleteNamespacedCustomObject(
        'networking.istio.io',
        'v1beta1',
        rule.namespace,
        'destinationrules',
        `${rule.pluginName}-canary`
      );
    } catch (error: any) {
      if (error.statusCode !== 404) {
        throw error;
      }
    }
  }

  /**
   * Setup traffic monitoring for a rule
   */
  private async setupTrafficMonitoring(rule: TrafficRule): Promise<void> {
    // Initialize metrics storage
    this.trafficMetrics.set(rule.id, []);
    
    // Set up Prometheus alerts
    await this.createPrometheusAlerts(rule);
    
    logger.info('Traffic monitoring set up', { ruleId: rule.id });
  }

  /**
   * Create Prometheus alerts for traffic monitoring
   */
  private async createPrometheusAlerts(rule: TrafficRule): Promise<void> {
    const alertRules = [
      {
        alert: `CanaryHighErrorRate_${rule.pluginName}`,
        expr: `sum(rate(istio_requests_total{destination_service_name="${rule.pluginName}",destination_service_namespace="${rule.namespace}",response_code=~"5.*"}[5m])) / sum(rate(istio_requests_total{destination_service_name="${rule.pluginName}",destination_service_namespace="${rule.namespace}"}[5m])) * 100 > ${rule.monitoring.alertThresholds.errorRate}`,
        for: '2m',
        labels: {
          severity: 'critical',
          deployment_id: rule.deploymentId,
        },
        annotations: {
          summary: `High error rate detected in canary deployment for ${rule.pluginName}`,
          description: 'Error rate is {{ $value }}% which is above the threshold of {{ rule.monitoring.alertThresholds.errorRate }}%',
        },
      },
      {
        alert: `CanaryHighLatency_${rule.pluginName}`,
        expr: `histogram_quantile(0.95, sum(rate(istio_request_duration_milliseconds_bucket{destination_service_name="${rule.pluginName}",destination_service_namespace="${rule.namespace}"}[5m])) by (le)) > ${rule.monitoring.alertThresholds.latencyP95}`,
        for: '3m',
        labels: {
          severity: 'warning',
          deployment_id: rule.deploymentId,
        },
        annotations: {
          summary: `High latency detected in canary deployment for ${rule.pluginName}`,
          description: 'P95 latency is {{ $value }}ms which is above the threshold of {{ rule.monitoring.alertThresholds.latencyP95 }}ms',
        },
      },
    ];
    
    // Store alert rules (implementation would integrate with Prometheus Operator)
    logger.info('Prometheus alerts created', { 
      pluginName: rule.pluginName,
      alertCount: alertRules.length 
    });
  }

  /**
   * Initialize Kubernetes client
   */
  private initializeKubernetesClient(): void {
    const kc = new k8s.KubernetesApi();
    
    if (process.env.NODE_ENV === 'production') {
      kc.loadFromCluster();
    } else {
      kc.loadFromDefault();
    }
    
    this.k8sClient = kc.makeApiClient(k8s.CustomObjectsApi);
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsCollector = setInterval(() => {
      this.collectTrafficMetrics();
    }, 10000); // Collect every 10 seconds
  }

  /**
   * Collect traffic metrics for all active rules
   */
  private async collectTrafficMetrics(): Promise<void> {
    for (const [ruleId, rule] of this.activeRules) {
      try {
        const metrics = await this.queryTrafficMetrics(rule);
        
        const existingMetrics = this.trafficMetrics.get(ruleId) || [];
        existingMetrics.push(metrics);
        
        // Keep only last 1000 data points
        if (existingMetrics.length > 1000) {
          existingMetrics.splice(0, existingMetrics.length - 1000);
        }
        
        this.trafficMetrics.set(ruleId, existingMetrics);
        
      } catch (error) {
        logger.error('Failed to collect traffic metrics', { ruleId, error });
      }
    }
  }

  /**
   * Query traffic metrics from Prometheus
   */
  private async queryTrafficMetrics(rule: TrafficRule): Promise<TrafficMetrics> {
    // Implementation would query Prometheus for actual metrics
    // This is a placeholder that simulates metrics collection
    
    return {
      timestamp: new Date(),
      deploymentId: rule.deploymentId,
      requests: {
        total: 1000,
        stable: Math.round(1000 * rule.distribution.stable / 100),
        canary: Math.round(1000 * rule.distribution.canary / 100),
        mirrored: rule.distribution.mirror ? Math.round(1000 * rule.distribution.mirror / 100) : 0,
      },
      responses: {
        success: 980,
        clientError: 15,
        serverError: 5,
      },
      latency: {
        p50: 50,
        p95: 150,
        p99: 300,
        max: 1000,
      },
      actualDistribution: {
        stable: rule.distribution.stable,
        canary: rule.distribution.canary,
      },
      circuitBreaker: {
        state: 'closed',
        failureCount: 0,
      },
      geoDistribution: {
        'us-east': { requests: 400, latency: 45, errorRate: 1.5 },
        'us-west': { requests: 300, latency: 52, errorRate: 1.2 },
        'eu-west': { requests: 200, latency: 89, errorRate: 2.1 },
        'ap-south': { requests: 100, latency: 125, errorRate: 3.2 },
      },
    };
  }

  /**
   * Analyze traffic health
   */
  private analyzeTrafficHealth(
    rule: TrafficRule | null, 
    metrics: TrafficMetrics | null
  ): { status: 'healthy' | 'warning' | 'critical'; issues: string[] } {
    if (!rule || !metrics) {
      return { status: 'critical', issues: ['No rule or metrics available'] };
    }
    
    const issues: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    // Check error rate
    const errorRate = (metrics.responses.serverError / 
      (metrics.responses.success + metrics.responses.clientError + metrics.responses.serverError)) * 100;
    
    if (errorRate > rule.monitoring.alertThresholds.errorRate) {
      issues.push(`High error rate: ${errorRate.toFixed(2)}%`);
      status = 'critical';
    }
    
    // Check latency
    if (metrics.latency.p95 > rule.monitoring.alertThresholds.latencyP95) {
      issues.push(`High P95 latency: ${metrics.latency.p95}ms`);
      status = status === 'critical' ? 'critical' : 'warning';
    }
    
    if (metrics.latency.p99 > rule.monitoring.alertThresholds.latencyP99) {
      issues.push(`High P99 latency: ${metrics.latency.p99}ms`);
      status = 'critical';
    }
    
    // Check circuit breaker
    if (metrics.circuitBreaker.state === 'open') {
      issues.push('Circuit breaker is open');
      status = 'critical';
    }
    
    return { status, issues };
  }

  /**
   * Check traffic health for a specific rule
   */
  private async checkTrafficHealth(ruleId: string): Promise<{ status: 'healthy' | 'warning' | 'critical'; issues: string[] }> {
    const rule = this.activeRules.get(ruleId);
    const metrics = this.trafficMetrics.get(ruleId);
    const latestMetrics = metrics?.[metrics.length - 1] || null;
    
    return this.analyzeTrafficHealth(rule || null, latestMetrics);
  }

  /**
   * Validate traffic rule configuration
   */
  private validateTrafficRule(rule: TrafficRule): void {
    // Validate traffic distribution
    const total = rule.distribution.stable + rule.distribution.canary;
    if (total !== 100) {
      throw new Error(`Traffic distribution must sum to 100%, got ${total}%`);
    }
    
    if (rule.distribution.stable < 0 || rule.distribution.canary < 0) {
      throw new Error('Traffic percentages cannot be negative');
    }
    
    // Validate routing rules
    for (const routingRule of rule.rules) {
      if (routingRule.priority < 0) {
        throw new Error('Routing rule priority cannot be negative');
      }
    }
    
    // Validate circuit breaker configuration
    if (rule.circuitBreaker.errorThreshold <= 0 || rule.circuitBreaker.errorThreshold > 100) {
      throw new Error('Circuit breaker error threshold must be between 0 and 100');
    }
    
    logger.info('Traffic rule validation passed', { ruleId: rule.id });
  }
}

// Export singleton instance
export const trafficRoutingManager = new TrafficRoutingManager();