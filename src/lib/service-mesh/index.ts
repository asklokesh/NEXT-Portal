/**
 * Service Mesh Integration Library
 * Provides integration with Istio service mesh for Backstage portal
 */

import { Logger } from '@backstage/backend-common';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import * as k8s from '@kubernetes/client-node';
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

export interface ServiceMeshConfig {
  kubernetesConfig?: k8s.KubeConfig;
  namespace: string;
  istioNamespace?: string;
  metricsUrl?: string;
  jaegerUrl?: string;
  kialiUrl?: string;
  enableMetrics?: boolean;
  enableTracing?: boolean;
  circuitBreakerEnabled?: boolean;
  faultInjectionEnabled?: boolean;
}

export interface CircuitBreakerConfig {
  consecutiveErrors: number;
  timeout: number;
  intervalMs: number;
  fallbackEnabled: boolean;
}

export interface TrafficPolicy {
  loadBalancer: 'ROUND_ROBIN' | 'LEAST_CONN' | 'RANDOM' | 'PASSTHROUGH';
  connectionPool: {
    tcp: {
      maxConnections: number;
      connectTimeout: string;
    };
    http: {
      http1MaxPendingRequests: number;
      http2MaxRequests: number;
      maxRequestsPerConnection: number;
      maxRetries: number;
      idleTimeout: string;
    };
  };
  outlierDetection: {
    consecutive5xxErrors: number;
    interval: string;
    baseEjectionTime: string;
    maxEjectionPercent: number;
    minHealthPercent: number;
  };
}

export interface ServiceMeshMetrics {
  requestRate: number;
  errorRate: number;
  latency: {
    p50: number;
    p95: number;
    p99: number;
  };
  circuitBreakerState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  upstreamConnections: number;
  activeRequests: number;
}

export interface FaultInjectionRule {
  delay?: {
    percentage: number;
    fixedDelay: string;
  };
  abort?: {
    percentage: number;
    httpStatus: number;
  };
}

export class ServiceMeshIntegration extends EventEmitter {
  private logger: Logger;
  private config: ServiceMeshConfig;
  private kubeClient: k8s.CoreV1Api;
  private customObjectsApi: k8s.CustomObjectsApi;
  private metricsClient: AxiosInstance;
  private tracingClient: AxiosInstance;
  private kialiClient: AxiosInstance;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  constructor(config: ServiceMeshConfig, logger: Logger) {
    super();
    this.config = config;
    this.logger = logger;

    // Initialize Kubernetes clients
    const kc = config.kubernetesConfig || new k8s.KubeConfig();
    if (!config.kubernetesConfig) {
      kc.loadFromDefault();
    }

    this.kubeClient = kc.makeApiClient(k8s.CoreV1Api);
    this.customObjectsApi = kc.makeApiClient(k8s.CustomObjectsApi);

    // Initialize HTTP clients
    this.metricsClient = axios.create({
      baseURL: config.metricsUrl || 'http://prometheus.istio-system:9090',
      timeout: 10000,
    });

    this.tracingClient = axios.create({
      baseURL: config.jaegerUrl || 'http://jaeger-query.istio-system:16686',
      timeout: 10000,
    });

    this.kialiClient = axios.create({
      baseURL: config.kialiUrl || 'http://kiali.istio-system:20001',
      timeout: 10000,
    });

    this.logger.info('Service mesh integration initialized');
  }

  /**
   * Get service mesh metrics for a service
   */
  async getServiceMetrics(serviceName: string, timeRange: string = '5m'): Promise<ServiceMeshMetrics> {
    try {
      const queries = {
        requestRate: `sum(rate(istio_requests_total{destination_service_name="${serviceName}"}[${timeRange}]))`,
        errorRate: `sum(rate(istio_requests_total{destination_service_name="${serviceName}",response_code!~"2.."}[${timeRange}])) / sum(rate(istio_requests_total{destination_service_name="${serviceName}"}[${timeRange}])) * 100`,
        latencyP50: `histogram_quantile(0.50, sum(rate(istio_request_duration_milliseconds_bucket{destination_service_name="${serviceName}"}[${timeRange}])) by (le))`,
        latencyP95: `histogram_quantile(0.95, sum(rate(istio_request_duration_milliseconds_bucket{destination_service_name="${serviceName}"}[${timeRange}])) by (le))`,
        latencyP99: `histogram_quantile(0.99, sum(rate(istio_request_duration_milliseconds_bucket{destination_service_name="${serviceName}"}[${timeRange}])) by (le))`,
        upstreamConnections: `sum(envoy_cluster_upstream_cx_active{cluster_name=~".*${serviceName}.*"})`,
        activeRequests: `sum(envoy_http_downstream_rq_active{cluster_name=~".*${serviceName}.*"})`,
        circuitBreakerOpen: `sum(envoy_cluster_outlier_detection_ejections_total{cluster_name=~".*${serviceName}.*"})`,
      };

      const metricResults = await Promise.allSettled(
        Object.entries(queries).map(async ([key, query]) => {
          const response = await this.metricsClient.get('/api/v1/query', {
            params: { query },
          });
          const result = response.data.data.result;
          const value = result.length > 0 ? parseFloat(result[0].value[1]) : 0;
          return { key, value };
        })
      );

      const metrics: any = {};
      metricResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          metrics[result.value.key] = result.value.value;
        }
      });

      return {
        requestRate: metrics.requestRate || 0,
        errorRate: metrics.errorRate || 0,
        latency: {
          p50: metrics.latencyP50 || 0,
          p95: metrics.latencyP95 || 0,
          p99: metrics.latencyP99 || 0,
        },
        circuitBreakerState: metrics.circuitBreakerOpen > 0 ? 'OPEN' : 'CLOSED',
        upstreamConnections: metrics.upstreamConnections || 0,
        activeRequests: metrics.activeRequests || 0,
      };
    } catch (error) {
      this.logger.error('Failed to get service metrics', error);
      throw error;
    }
  }

  /**
   * Create or update destination rule with traffic policy
   */
  async createDestinationRule(
    serviceName: string,
    trafficPolicy: TrafficPolicy,
    subsets?: Record<string, any>
  ): Promise<void> {
    try {
      const destinationRule = {
        apiVersion: 'networking.istio.io/v1beta1',
        kind: 'DestinationRule',
        metadata: {
          name: `${serviceName}-destination-rule`,
          namespace: this.config.namespace,
        },
        spec: {
          host: `${serviceName}.${this.config.namespace}.svc.cluster.local`,
          trafficPolicy,
          subsets: subsets || [],
        },
      };

      await this.customObjectsApi.createNamespacedCustomObject(
        'networking.istio.io',
        'v1beta1',
        this.config.namespace,
        'destinationrules',
        destinationRule
      );

      this.logger.info(`Created destination rule for service: ${serviceName}`);
    } catch (error: any) {
      if (error.response?.status === 409) {
        // Update existing rule
        await this.customObjectsApi.patchNamespacedCustomObject(
          'networking.istio.io',
          'v1beta1',
          this.config.namespace,
          'destinationrules',
          `${serviceName}-destination-rule`,
          destinationRule
        );
        this.logger.info(`Updated destination rule for service: ${serviceName}`);
      } else {
        this.logger.error('Failed to create destination rule', error);
        throw error;
      }
    }
  }

  /**
   * Create or update virtual service with fault injection
   */
  async createVirtualService(
    serviceName: string,
    routes: any[],
    faultInjection?: FaultInjectionRule
  ): Promise<void> {
    try {
      const virtualService = {
        apiVersion: 'networking.istio.io/v1beta1',
        kind: 'VirtualService',
        metadata: {
          name: `${serviceName}-virtual-service`,
          namespace: this.config.namespace,
        },
        spec: {
          hosts: [`${serviceName}.${this.config.namespace}.svc.cluster.local`],
          http: routes.map(route => ({
            ...route,
            fault: faultInjection,
          })),
        },
      };

      await this.customObjectsApi.createNamespacedCustomObject(
        'networking.istio.io',
        'v1beta1',
        this.config.namespace,
        'virtualservices',
        virtualService
      );

      this.logger.info(`Created virtual service for: ${serviceName}`);
    } catch (error: any) {
      if (error.response?.status === 409) {
        // Update existing service
        await this.customObjectsApi.patchNamespacedCustomObject(
          'networking.istio.io',
          'v1beta1',
          this.config.namespace,
          'virtualservices',
          `${serviceName}-virtual-service`,
          virtualService
        );
        this.logger.info(`Updated virtual service for: ${serviceName}`);
      } else {
        this.logger.error('Failed to create virtual service', error);
        throw error;
      }
    }
  }

  /**
   * Enable circuit breaker for a service
   */
  async enableCircuitBreaker(
    serviceName: string,
    config: CircuitBreakerConfig
  ): Promise<void> {
    const circuitBreaker = new CircuitBreaker(serviceName, config, this.logger);
    this.circuitBreakers.set(serviceName, circuitBreaker);

    const trafficPolicy: TrafficPolicy = {
      loadBalancer: 'LEAST_CONN',
      connectionPool: {
        tcp: {
          maxConnections: 50,
          connectTimeout: '10s',
        },
        http: {
          http1MaxPendingRequests: 50,
          http2MaxRequests: 500,
          maxRequestsPerConnection: 10,
          maxRetries: 3,
          idleTimeout: '60s',
        },
      },
      outlierDetection: {
        consecutive5xxErrors: config.consecutiveErrors,
        interval: `${config.intervalMs}ms`,
        baseEjectionTime: `${config.timeout}ms`,
        maxEjectionPercent: 50,
        minHealthPercent: 50,
      },
    };

    await this.createDestinationRule(serviceName, trafficPolicy);
    this.logger.info(`Circuit breaker enabled for service: ${serviceName}`);
  }

  /**
   * Inject fault into service traffic
   */
  async injectFault(serviceName: string, faultConfig: FaultInjectionRule): Promise<void> {
    try {
      const routes = [{
        route: [{
          destination: {
            host: `${serviceName}.${this.config.namespace}.svc.cluster.local`,
          },
        }],
      }];

      await this.createVirtualService(serviceName, routes, faultConfig);
      this.logger.info(`Fault injection configured for service: ${serviceName}`);
    } catch (error) {
      this.logger.error('Failed to inject fault', error);
      throw error;
    }
  }

  /**
   * Get service topology from Kiali
   */
  async getServiceTopology(namespace?: string): Promise<any> {
    try {
      const targetNamespace = namespace || this.config.namespace;
      const response = await this.kialiClient.get(`/api/namespaces/${targetNamespace}/graph`, {
        params: {
          graphType: 'service',
          duration: '10m',
          includeIdle: false,
        },
      });

      return response.data;
    } catch (error) {
      this.logger.error('Failed to get service topology', error);
      throw error;
    }
  }

  /**
   * Get distributed traces for a service
   */
  async getTraces(serviceName: string, limit: number = 20): Promise<any> {
    try {
      const response = await this.tracingClient.get('/api/traces', {
        params: {
          service: serviceName,
          limit,
          lookback: '1h',
        },
      });

      return response.data.data;
    } catch (error) {
      this.logger.error('Failed to get traces', error);
      throw error;
    }
  }

  /**
   * Health check for service mesh components
   */
  async healthCheck(): Promise<{
    istiod: boolean;
    prometheus: boolean;
    jaeger: boolean;
    kiali: boolean;
  }> {
    const results = {
      istiod: false,
      prometheus: false,
      jaeger: false,
      kiali: false,
    };

    try {
      // Check istiod
      const istiodPods = await this.kubeClient.listNamespacedPod(
        this.config.istioNamespace || 'istio-system',
        undefined,
        undefined,
        undefined,
        undefined,
        'app=istiod'
      );
      results.istiod = istiodPods.body.items.some(
        pod => pod.status?.phase === 'Running'
      );

      // Check Prometheus
      try {
        await this.metricsClient.get('/-/healthy');
        results.prometheus = true;
      } catch {
        results.prometheus = false;
      }

      // Check Jaeger
      try {
        await this.tracingClient.get('/api/services');
        results.jaeger = true;
      } catch {
        results.jaeger = false;
      }

      // Check Kiali
      try {
        await this.kialiClient.get('/api/status');
        results.kiali = true;
      } catch {
        results.kiali = false;
      }

    } catch (error) {
      this.logger.error('Health check failed', error);
    }

    return results;
  }

  /**
   * Monitor service mesh and emit events
   */
  startMonitoring(intervalMs: number = 30000): void {
    setInterval(async () => {
      try {
        const healthStatus = await this.healthCheck();
        this.emit('health-check', healthStatus);

        // Check circuit breaker states
        for (const [serviceName, circuitBreaker] of this.circuitBreakers) {
          const state = circuitBreaker.getState();
          this.emit('circuit-breaker-state', { serviceName, state });
        }

      } catch (error) {
        this.logger.error('Monitoring error', error);
        this.emit('monitoring-error', error);
      }
    }, intervalMs);
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.circuitBreakers.clear();
    this.removeAllListeners();
    this.logger.info('Service mesh integration cleaned up');
  }
}

/**
 * Circuit Breaker implementation
 */
class CircuitBreaker {
  private serviceName: string;
  private config: CircuitBreakerConfig;
  private logger: Logger;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private successCount: number = 0;

  constructor(serviceName: string, config: CircuitBreakerConfig, logger: Logger) {
    this.serviceName = serviceName;
    this.config = config;
    this.logger = logger;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime < this.config.timeout) {
        throw new Error('Circuit breaker is OPEN');
      } else {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      }
    }

    try {
      const startTime = performance.now();
      const result = await operation();
      const duration = performance.now() - startTime;

      this.onSuccess();
      this.logger.debug(`Circuit breaker success for ${this.serviceName}, duration: ${duration}ms`);
      return result;

    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.config.consecutiveErrors) {
        this.state = 'CLOSED';
        this.logger.info(`Circuit breaker CLOSED for ${this.serviceName}`);
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.config.consecutiveErrors) {
      this.state = 'OPEN';
      this.logger.warn(`Circuit breaker OPENED for ${this.serviceName}`);
    }
  }

  getState(): string {
    return this.state;
  }
}

/**
 * Service Mesh Disaster Recovery integration
 */
export class ServiceMeshDR {
  private serviceMesh: ServiceMeshIntegration;
  private logger: Logger;

  constructor(serviceMesh: ServiceMeshIntegration, logger: Logger) {
    this.serviceMesh = serviceMesh;
    this.logger = logger;
  }

  /**
   * Configure traffic splitting for blue-green deployment
   */
  async configureBlueGreenDeployment(
    serviceName: string,
    blueWeight: number,
    greenWeight: number
  ): Promise<void> {
    const routes = [{
      route: [
        {
          destination: {
            host: `${serviceName}.${this.serviceMesh['config'].namespace}.svc.cluster.local`,
            subset: 'blue',
          },
          weight: blueWeight,
        },
        {
          destination: {
            host: `${serviceName}.${this.serviceMesh['config'].namespace}.svc.cluster.local`,
            subset: 'green',
          },
          weight: greenWeight,
        },
      ],
    }];

    await this.serviceMesh.createVirtualService(serviceName, routes);
    this.logger.info(`Blue-green deployment configured for ${serviceName}: Blue ${blueWeight}%, Green ${greenWeight}%`);
  }

  /**
   * Failover traffic to DR region
   */
  async failoverToDR(serviceName: string, drEndpoint: string): Promise<void> {
    const routes = [{
      route: [{
        destination: {
          host: drEndpoint,
        },
      }],
    }];

    await this.serviceMesh.createVirtualService(serviceName, routes);
    this.logger.info(`Traffic failed over to DR endpoint for ${serviceName}: ${drEndpoint}`);
  }

  /**
   * Test DR failover with canary traffic
   */
  async testDRFailover(
    serviceName: string,
    drEndpoint: string,
    canaryPercentage: number
  ): Promise<void> {
    const routes = [{
      match: [{
        headers: {
          'x-canary': {
            exact: 'true',
          },
        },
      }],
      route: [{
        destination: {
          host: drEndpoint,
        },
      }],
    }, {
      route: [{
        destination: {
          host: `${serviceName}.${this.serviceMesh['config'].namespace}.svc.cluster.local`,
        },
        weight: 100 - canaryPercentage,
      }, {
        destination: {
          host: drEndpoint,
        },
        weight: canaryPercentage,
      }],
    }];

    await this.serviceMesh.createVirtualService(serviceName, routes);
    this.logger.info(`DR failover test configured for ${serviceName}: ${canaryPercentage}% to DR`);
  }
}

export default ServiceMeshIntegration;