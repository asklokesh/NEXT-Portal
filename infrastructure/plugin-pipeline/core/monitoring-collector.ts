/**
 * Monitoring and Observability Collector for Plugin Pipeline
 * 
 * Comprehensive monitoring system with Prometheus metrics, distributed tracing,
 * structured logging, and SLA monitoring for plugin lifecycle management
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import * as k8s from '@kubernetes/client-node';
import * as prometheus from 'prom-client';
import { PluginDefinition, DeploymentInfo, HealthStatus } from '../types/plugin-types';

export interface MonitoringConfig {
  prometheus: PrometheusConfig;
  tracing: TracingConfig;
  logging: LoggingConfig;
  alerting: AlertingConfig;
}

export interface PrometheusConfig {
  enabled: boolean;
  scrapeInterval: string;
  retentionTime: string;
  externalUrl?: string;
  remoteWrite?: {
    url: string;
    headers?: { [key: string]: string };
  }[];
}

export interface TracingConfig {
  enabled: boolean;
  provider: 'jaeger' | 'zipkin' | 'opentelemetry';
  endpoint: string;
  samplingRate: number;
  serviceName: string;
}

export interface LoggingConfig {
  enabled: boolean;
  provider: 'elasticsearch' | 'loki' | 'fluentd';
  endpoint: string;
  indexPattern?: string;
  retentionDays: number;
}

export interface AlertingConfig {
  enabled: boolean;
  provider: 'alertmanager' | 'slack' | 'pagerduty';
  webhook?: string;
  channels: AlertChannel[];
}

export interface AlertChannel {
  name: string;
  type: 'slack' | 'email' | 'pagerduty' | 'webhook';
  config: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface PluginMetrics {
  pluginName: string;
  namespace: string;
  timestamp: Date;
  metrics: {
    cpu: {
      usage: number;
      limit: number;
      utilization: number;
    };
    memory: {
      usage: number;
      limit: number;
      utilization: number;
    };
    network: {
      bytesIn: number;
      bytesOut: number;
      requestsPerSecond: number;
    };
    application: {
      requests: number;
      errors: number;
      latency: {
        p50: number;
        p90: number;
        p95: number;
        p99: number;
      };
    };
  };
}

export interface PluginSLA {
  pluginName: string;
  availability: number; // percentage
  errorRate: number; // percentage
  responseTime: {
    average: number;
    p95: number;
    p99: number;
  };
  throughput: number; // requests per second
  period: string; // time period for SLA calculation
}

export class MonitoringCollector extends EventEmitter {
  private logger: Logger;
  private config: MonitoringConfig;
  private k8sApi: k8s.KubernetesApi;
  private metricsApi: k8s.MetricsV1beta1Api;
  private customObjectsApi: k8s.CustomObjectsApi;
  private coreApi: k8s.CoreV1Api;
  
  // Prometheus metrics
  private prometheusRegistry: prometheus.Registry;
  private pluginInstallationDuration: prometheus.Histogram;
  private pluginHealthStatus: prometheus.Gauge;
  private pluginResourceUsage: prometheus.Gauge;
  private pluginRequestsTotal: prometheus.Counter;
  private pluginErrorsTotal: prometheus.Counter;
  private pluginRequestDuration: prometheus.Histogram;
  
  // Monitoring state
  private monitoredPlugins: Map<string, PluginDefinition> = new Map();
  private metricsCache: Map<string, PluginMetrics> = new Map();
  private alertRules: Map<string, any[]> = new Map();

  constructor(logger: Logger, config: MonitoringConfig, kubeConfig: k8s.KubeConfig) {
    super();
    this.logger = logger;
    this.config = config;
    
    this.k8sApi = kubeConfig.makeApiClient(k8s.KubernetesApi);
    this.metricsApi = kubeConfig.makeApiClient(k8s.MetricsV1beta1Api);
    this.customObjectsApi = kubeConfig.makeApiClient(k8s.CustomObjectsApi);
    this.coreApi = kubeConfig.makeApiClient(k8s.CoreV1Api);
    
    this.initializePrometheusMetrics();
    this.startMetricsCollection();
  }

  /**
   * Initialize Prometheus metrics
   */
  private initializePrometheusMetrics(): void {
    this.prometheusRegistry = new prometheus.Registry();
    prometheus.collectDefaultMetrics({ register: this.prometheusRegistry });

    // Plugin installation metrics
    this.pluginInstallationDuration = new prometheus.Histogram({
      name: 'plugin_installation_duration_seconds',
      help: 'Duration of plugin installation in seconds',
      labelNames: ['plugin_name', 'version', 'strategy', 'status'],
      buckets: [1, 5, 10, 30, 60, 120, 300, 600, 1200]
    });

    // Plugin health metrics
    this.pluginHealthStatus = new prometheus.Gauge({
      name: 'plugin_health_status',
      help: 'Health status of plugins (1 = healthy, 0 = unhealthy)',
      labelNames: ['plugin_name', 'namespace', 'version']
    });

    // Resource usage metrics
    this.pluginResourceUsage = new prometheus.Gauge({
      name: 'plugin_resource_usage',
      help: 'Resource usage by plugins',
      labelNames: ['plugin_name', 'namespace', 'resource_type']
    });

    // Request metrics
    this.pluginRequestsTotal = new prometheus.Counter({
      name: 'plugin_requests_total',
      help: 'Total number of requests to plugins',
      labelNames: ['plugin_name', 'namespace', 'method', 'status_code']
    });

    // Error metrics
    this.pluginErrorsTotal = new prometheus.Counter({
      name: 'plugin_errors_total',
      help: 'Total number of errors in plugins',
      labelNames: ['plugin_name', 'namespace', 'error_type']
    });

    // Request duration metrics
    this.pluginRequestDuration = new prometheus.Histogram({
      name: 'plugin_request_duration_seconds',
      help: 'Duration of plugin requests in seconds',
      labelNames: ['plugin_name', 'namespace', 'method'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
    });

    // Register all metrics
    this.prometheusRegistry.registerMetric(this.pluginInstallationDuration);
    this.prometheusRegistry.registerMetric(this.pluginHealthStatus);
    this.prometheusRegistry.registerMetric(this.pluginResourceUsage);
    this.prometheusRegistry.registerMetric(this.pluginRequestsTotal);
    this.prometheusRegistry.registerMetric(this.pluginErrorsTotal);
    this.prometheusRegistry.registerMetric(this.pluginRequestDuration);
  }

  /**
   * Set up monitoring for a plugin
   */
  async setupPluginMetrics(
    pluginDefinition: PluginDefinition,
    deploymentInfo: DeploymentInfo
  ): Promise<void> {
    this.logger.info(`Setting up monitoring for plugin: ${pluginDefinition.name}`, {
      namespace: deploymentInfo.namespace,
      observabilityConfig: pluginDefinition.observability
    });

    try {
      // Store plugin for monitoring
      this.monitoredPlugins.set(pluginDefinition.name, pluginDefinition);

      // Create ServiceMonitor for Prometheus scraping
      if (this.config.prometheus.enabled && pluginDefinition.observability.metrics?.enabled) {
        await this.createServiceMonitor(pluginDefinition, deploymentInfo);
      }

      // Set up distributed tracing
      if (this.config.tracing.enabled && pluginDefinition.observability.tracing?.enabled) {
        await this.setupDistributedTracing(pluginDefinition, deploymentInfo);
      }

      // Configure logging
      if (this.config.logging.enabled) {
        await this.setupLogging(pluginDefinition, deploymentInfo);
      }

      // Create alerting rules
      if (this.config.alerting.enabled) {
        await this.createAlertingRules(pluginDefinition, deploymentInfo);
      }

      // Set up dashboards
      await this.createGrafanaDashboard(pluginDefinition, deploymentInfo);

      this.emit('monitoring-setup-complete', { pluginDefinition, deploymentInfo });
      
    } catch (error) {
      this.logger.error(`Failed to set up monitoring for plugin ${pluginDefinition.name}: ${error.message}`);
      this.emit('monitoring-setup-failed', { pluginDefinition, error });
      throw error;
    }
  }

  /**
   * Create ServiceMonitor for Prometheus scraping
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
          managed: 'plugin-pipeline',
          'prometheus-scrape': 'true'
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
            interval: this.config.prometheus.scrapeInterval || '30s',
            path: pluginDefinition.observability.metrics?.path || '/metrics',
            honorLabels: true,
            relabelings: [
              {
                sourceLabels: ['__meta_kubernetes_pod_name'],
                targetLabel: 'pod_name'
              },
              {
                sourceLabels: ['__meta_kubernetes_namespace'],
                targetLabel: 'kubernetes_namespace'
              }
            ]
          }
        ],
        namespaceSelector: {
          matchNames: [deploymentInfo.namespace]
        }
      }
    };

    await this.createCustomResource(
      'monitoring.coreos.com',
      'v1',
      'servicemonitors',
      deploymentInfo.namespace,
      serviceMonitor
    );

    this.logger.info(`Created ServiceMonitor for plugin: ${pluginDefinition.name}`);
  }

  /**
   * Set up distributed tracing
   */
  private async setupDistributedTracing(
    pluginDefinition: PluginDefinition,
    deploymentInfo: DeploymentInfo
  ): Promise<void> {
    // Add tracing annotations to deployment
    const tracingAnnotations = this.getTracingAnnotations(pluginDefinition);
    
    // Update deployment with tracing configuration
    try {
      const deployment = await this.k8sApi.readNamespacedDeployment(
        deploymentInfo.deploymentName,
        deploymentInfo.namespace
      );
      
      const annotations = deployment.body.metadata?.annotations || {};
      Object.assign(annotations, tracingAnnotations);
      
      const patch = {
        metadata: { annotations },
        spec: {
          template: {
            metadata: { annotations: tracingAnnotations }
          }
        }
      };
      
      await this.k8sApi.patchNamespacedDeployment(
        deploymentInfo.deploymentName,
        deploymentInfo.namespace,
        patch,
        undefined,
        undefined,
        undefined,
        undefined,
        { headers: { 'Content-Type': 'application/strategic-merge-patch+json' } }
      );
      
      this.logger.info(`Configured distributed tracing for plugin: ${pluginDefinition.name}`);
      
    } catch (error) {
      this.logger.error(`Failed to configure tracing: ${error.message}`);
    }
  }

  /**
   * Get tracing annotations based on provider
   */
  private getTracingAnnotations(pluginDefinition: PluginDefinition): { [key: string]: string } {
    const config = this.config.tracing;
    
    switch (config.provider) {
      case 'jaeger':
        return {
          'sidecar.jaegertracing.io/inject': 'true',
          'jaeger.io/service-name': pluginDefinition.name,
          'jaeger.io/sampling-rate': (pluginDefinition.observability.tracing?.samplingRate || config.samplingRate).toString()
        };
      
      case 'zipkin':
        return {
          'zipkin.io/inject': 'true',
          'zipkin.io/service-name': pluginDefinition.name
        };
      
      case 'opentelemetry':
        return {
          'instrumentation.opentelemetry.io/inject': 'true',
          'instrumentation.opentelemetry.io/service-name': pluginDefinition.name
        };
      
      default:
        return {};
    }
  }

  /**
   * Set up logging configuration
   */
  private async setupLogging(
    pluginDefinition: PluginDefinition,
    deploymentInfo: DeploymentInfo
  ): Promise<void> {
    const loggingAnnotations = this.getLoggingAnnotations(pluginDefinition);
    
    try {
      const deployment = await this.k8sApi.readNamespacedDeployment(
        deploymentInfo.deploymentName,
        deploymentInfo.namespace
      );
      
      const annotations = deployment.body.spec?.template?.metadata?.annotations || {};
      Object.assign(annotations, loggingAnnotations);
      
      const patch = {
        spec: {
          template: {
            metadata: { annotations }
          }
        }
      };
      
      await this.k8sApi.patchNamespacedDeployment(
        deploymentInfo.deploymentName,
        deploymentInfo.namespace,
        patch,
        undefined,
        undefined,
        undefined,
        undefined,
        { headers: { 'Content-Type': 'application/strategic-merge-patch+json' } }
      );
      
      this.logger.info(`Configured logging for plugin: ${pluginDefinition.name}`);
      
    } catch (error) {
      this.logger.error(`Failed to configure logging: ${error.message}`);
    }
  }

  /**
   * Get logging annotations based on provider
   */
  private getLoggingAnnotations(pluginDefinition: PluginDefinition): { [key: string]: string } {
    const config = this.config.logging;
    
    switch (config.provider) {
      case 'elasticsearch':
        return {
          'fluentd.io/include': 'true',
          'fluentd.io/parser': 'json',
          'fluentd.io/index': config.indexPattern || `plugin-${pluginDefinition.name}`
        };
      
      case 'loki':
        return {
          'promtail.io/include': 'true',
          'promtail.io/labels': `plugin=${pluginDefinition.name},namespace=${deploymentInfo.namespace}`
        };
      
      case 'fluentd':
        return {
          'fluentd.io/include': 'true',
          'fluentd.io/tag': `plugin.${pluginDefinition.name}`
        };
      
      default:
        return {};
    }
  }

  /**
   * Create alerting rules for plugin
   */
  private async createAlertingRules(
    pluginDefinition: PluginDefinition,
    deploymentInfo: DeploymentInfo
  ): Promise<void> {
    const alertingRules = this.generateAlertingRules(pluginDefinition, deploymentInfo);
    
    const prometheusRule = {
      apiVersion: 'monitoring.coreos.com/v1',
      kind: 'PrometheusRule',
      metadata: {
        name: `${pluginDefinition.name}-alerts`,
        namespace: deploymentInfo.namespace,
        labels: {
          app: pluginDefinition.name,
          managed: 'plugin-pipeline',
          prometheus: 'kube-prometheus'
        }
      },
      spec: {
        groups: [
          {
            name: `${pluginDefinition.name}.rules`,
            rules: alertingRules
          }
        ]
      }
    };

    await this.createCustomResource(
      'monitoring.coreos.com',
      'v1',
      'prometheusrules',
      deploymentInfo.namespace,
      prometheusRule
    );

    this.alertRules.set(pluginDefinition.name, alertingRules);
    this.logger.info(`Created alerting rules for plugin: ${pluginDefinition.name}`);
  }

  /**
   * Generate alerting rules based on plugin configuration
   */
  private generateAlertingRules(
    pluginDefinition: PluginDefinition,
    deploymentInfo: DeploymentInfo
  ): any[] {
    const rules = [];
    
    // High error rate alert
    rules.push({
      alert: `${pluginDefinition.name}HighErrorRate`,
      expr: `(
        rate(plugin_errors_total{plugin_name="${pluginDefinition.name}",namespace="${deploymentInfo.namespace}"}[5m]) /
        rate(plugin_requests_total{plugin_name="${pluginDefinition.name}",namespace="${deploymentInfo.namespace}"}[5m])
      ) > 0.05`,
      for: '2m',
      labels: {
        severity: 'warning',
        plugin: pluginDefinition.name
      },
      annotations: {
        summary: `High error rate for plugin ${pluginDefinition.name}`,
        description: `Plugin ${pluginDefinition.name} has an error rate above 5% for more than 2 minutes.`
      }
    });

    // High latency alert
    rules.push({
      alert: `${pluginDefinition.name}HighLatency`,
      expr: `histogram_quantile(0.95, rate(plugin_request_duration_seconds_bucket{plugin_name="${pluginDefinition.name}",namespace="${deploymentInfo.namespace}"}[5m])) > 1`,
      for: '5m',
      labels: {
        severity: 'warning',
        plugin: pluginDefinition.name
      },
      annotations: {
        summary: `High latency for plugin ${pluginDefinition.name}`,
        description: `Plugin ${pluginDefinition.name} 95th percentile latency is above 1 second for more than 5 minutes.`
      }
    });

    // Pod down alert
    rules.push({
      alert: `${pluginDefinition.name}PodDown`,
      expr: `up{job="${pluginDefinition.name}"} == 0`,
      for: '1m',
      labels: {
        severity: 'critical',
        plugin: pluginDefinition.name
      },
      annotations: {
        summary: `Plugin ${pluginDefinition.name} pod is down`,
        description: `Plugin ${pluginDefinition.name} has been down for more than 1 minute.`
      }
    });

    // High memory usage alert
    rules.push({
      alert: `${pluginDefinition.name}HighMemoryUsage`,
      expr: `plugin_resource_usage{plugin_name="${pluginDefinition.name}",namespace="${deploymentInfo.namespace}",resource_type="memory"} > 0.8`,
      for: '10m',
      labels: {
        severity: 'warning',
        plugin: pluginDefinition.name
      },
      annotations: {
        summary: `High memory usage for plugin ${pluginDefinition.name}`,
        description: `Plugin ${pluginDefinition.name} memory usage is above 80% for more than 10 minutes.`
      }
    });

    return rules;
  }

  /**
   * Create Grafana dashboard for plugin
   */
  private async createGrafanaDashboard(
    pluginDefinition: PluginDefinition,
    deploymentInfo: DeploymentInfo
  ): Promise<void> {
    const dashboard = this.generateGrafanaDashboard(pluginDefinition, deploymentInfo);
    
    const configMap = {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: `${pluginDefinition.name}-dashboard`,
        namespace: 'monitoring',
        labels: {
          grafana_dashboard: '1',
          app: pluginDefinition.name,
          managed: 'plugin-pipeline'
        }
      },
      data: {
        [`${pluginDefinition.name}-dashboard.json`]: JSON.stringify(dashboard, null, 2)
      }
    };

    await this.coreApi.createNamespacedConfigMap('monitoring', configMap);
    this.logger.info(`Created Grafana dashboard for plugin: ${pluginDefinition.name}`);
  }

  /**
   * Generate Grafana dashboard configuration
   */
  private generateGrafanaDashboard(
    pluginDefinition: PluginDefinition,
    deploymentInfo: DeploymentInfo
  ): any {
    return {
      dashboard: {
        id: null,
        title: `Plugin: ${pluginDefinition.name}`,
        tags: ['plugin-pipeline', pluginDefinition.name],
        style: 'dark',
        timezone: 'browser',
        refresh: '30s',
        time: {
          from: 'now-1h',
          to: 'now'
        },
        panels: [
          {
            id: 1,
            title: 'Request Rate',
            type: 'graph',
            targets: [
              {
                expr: `rate(plugin_requests_total{plugin_name="${pluginDefinition.name}"}[5m])`,
                legendFormat: '{{method}} {{status_code}}'
              }
            ],
            yAxes: [
              {
                label: 'Requests/sec',
                min: 0
              }
            ],
            gridPos: { h: 8, w: 12, x: 0, y: 0 }
          },
          {
            id: 2,
            title: 'Error Rate',
            type: 'graph',
            targets: [
              {
                expr: `rate(plugin_errors_total{plugin_name="${pluginDefinition.name}"}[5m])`,
                legendFormat: '{{error_type}}'
              }
            ],
            yAxes: [
              {
                label: 'Errors/sec',
                min: 0
              }
            ],
            gridPos: { h: 8, w: 12, x: 12, y: 0 }
          },
          {
            id: 3,
            title: 'Response Time',
            type: 'graph',
            targets: [
              {
                expr: `histogram_quantile(0.50, rate(plugin_request_duration_seconds_bucket{plugin_name="${pluginDefinition.name}"}[5m]))`,
                legendFormat: 'p50'
              },
              {
                expr: `histogram_quantile(0.95, rate(plugin_request_duration_seconds_bucket{plugin_name="${pluginDefinition.name}"}[5m]))`,
                legendFormat: 'p95'
              },
              {
                expr: `histogram_quantile(0.99, rate(plugin_request_duration_seconds_bucket{plugin_name="${pluginDefinition.name}"}[5m]))`,
                legendFormat: 'p99'
              }
            ],
            yAxes: [
              {
                label: 'Seconds',
                min: 0
              }
            ],
            gridPos: { h: 8, w: 12, x: 0, y: 8 }
          },
          {
            id: 4,
            title: 'Resource Usage',
            type: 'graph',
            targets: [
              {
                expr: `plugin_resource_usage{plugin_name="${pluginDefinition.name}",resource_type="cpu"}`,
                legendFormat: 'CPU'
              },
              {
                expr: `plugin_resource_usage{plugin_name="${pluginDefinition.name}",resource_type="memory"}`,
                legendFormat: 'Memory'
              }
            ],
            yAxes: [
              {
                label: 'Usage %',
                min: 0,
                max: 1
              }
            ],
            gridPos: { h: 8, w: 12, x: 12, y: 8 }
          }
        ]
      }
    };
  }

  /**
   * Collect plugin metrics
   */
  async collectPluginMetrics(pluginName: string): Promise<PluginMetrics | null> {
    const pluginDefinition = this.monitoredPlugins.get(pluginName);
    if (!pluginDefinition) {
      return null;
    }

    const namespace = `plugin-${pluginName}`;
    
    try {
      // Get pod metrics from metrics-server
      const podsMetrics = await this.metricsApi.listNamespacedPodMetrics(
        namespace,
        undefined,
        undefined,
        undefined,
        undefined,
        `app=${pluginName}`
      );
      
      // Aggregate metrics
      const metrics = this.aggregateMetrics(podsMetrics.body.items);
      
      const pluginMetrics: PluginMetrics = {
        pluginName,
        namespace,
        timestamp: new Date(),
        metrics
      };
      
      // Cache metrics
      this.metricsCache.set(pluginName, pluginMetrics);
      
      // Update Prometheus metrics
      this.updatePrometheusMetrics(pluginDefinition, pluginMetrics);
      
      return pluginMetrics;
      
    } catch (error) {
      this.logger.error(`Failed to collect metrics for plugin ${pluginName}: ${error.message}`);
      return null;
    }
  }

  /**
   * Calculate SLA metrics for plugin
   */
  async calculatePluginSLA(pluginName: string, period: string = '24h'): Promise<PluginSLA | null> {
    try {
      // This would query Prometheus for SLA calculations
      // For now, return mock data
      return {
        pluginName,
        availability: 99.9,
        errorRate: 0.1,
        responseTime: {
          average: 0.2,
          p95: 0.5,
          p99: 1.0
        },
        throughput: 100,
        period
      };
    } catch (error) {
      this.logger.error(`Failed to calculate SLA for plugin ${pluginName}: ${error.message}`);
      return null;
    }
  }

  /**
   * Remove monitoring for plugin
   */
  async removePluginMetrics(pluginDefinition: PluginDefinition): Promise<void> {
    const namespace = `plugin-${pluginDefinition.name}`;
    
    try {
      // Remove ServiceMonitor
      await this.deleteCustomResource(
        'monitoring.coreos.com',
        'v1',
        'servicemonitors',
        namespace,
        `${pluginDefinition.name}-monitor`
      );
      
      // Remove PrometheusRule
      await this.deleteCustomResource(
        'monitoring.coreos.com',
        'v1',
        'prometheusrules',
        namespace,
        `${pluginDefinition.name}-alerts`
      );
      
      // Remove dashboard ConfigMap
      await this.coreApi.deleteNamespacedConfigMap(
        `${pluginDefinition.name}-dashboard`,
        'monitoring'
      );
      
      // Clean up internal state
      this.monitoredPlugins.delete(pluginDefinition.name);
      this.metricsCache.delete(pluginDefinition.name);
      this.alertRules.delete(pluginDefinition.name);
      
      this.logger.info(`Removed monitoring for plugin: ${pluginDefinition.name}`);
      
    } catch (error) {
      this.logger.error(`Failed to remove monitoring for plugin ${pluginDefinition.name}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Start metrics collection loop
   */
  private startMetricsCollection(): void {
    setInterval(async () => {
      for (const pluginName of this.monitoredPlugins.keys()) {
        await this.collectPluginMetrics(pluginName);
      }
    }, 30000); // Collect every 30 seconds
  }

  /**
   * Aggregate pod metrics
   */
  private aggregateMetrics(podMetrics: any[]): any {
    let totalCpuUsage = 0;
    let totalMemoryUsage = 0;
    
    for (const pod of podMetrics) {
      for (const container of pod.containers) {
        totalCpuUsage += this.parseCpuUsage(container.usage.cpu);
        totalMemoryUsage += this.parseMemoryUsage(container.usage.memory);
      }
    }
    
    return {
      cpu: {
        usage: totalCpuUsage,
        limit: 1000, // millicores
        utilization: totalCpuUsage / 1000
      },
      memory: {
        usage: totalMemoryUsage,
        limit: 1024 * 1024 * 1024, // 1GB in bytes
        utilization: totalMemoryUsage / (1024 * 1024 * 1024)
      },
      network: {
        bytesIn: 0,
        bytesOut: 0,
        requestsPerSecond: 0
      },
      application: {
        requests: 0,
        errors: 0,
        latency: {
          p50: 0,
          p90: 0,
          p95: 0,
          p99: 0
        }
      }
    };
  }

  /**
   * Update Prometheus metrics
   */
  private updatePrometheusMetrics(pluginDefinition: PluginDefinition, metrics: PluginMetrics): void {
    const labels = {
      plugin_name: pluginDefinition.name,
      namespace: metrics.namespace,
      version: pluginDefinition.version
    };
    
    this.pluginHealthStatus.set(labels, 1); // Assume healthy if we got metrics
    
    this.pluginResourceUsage.set(
      { ...labels, resource_type: 'cpu' },
      metrics.metrics.cpu.utilization
    );
    
    this.pluginResourceUsage.set(
      { ...labels, resource_type: 'memory' },
      metrics.metrics.memory.utilization
    );
  }

  /**
   * Helper methods for parsing Kubernetes metrics
   */
  private parseCpuUsage(cpuString: string): number {
    if (cpuString.endsWith('n')) {
      return parseInt(cpuString.slice(0, -1)) / 1000000; // nanocores to millicores
    } else if (cpuString.endsWith('m')) {
      return parseInt(cpuString.slice(0, -1)); // millicores
    } else {
      return parseFloat(cpuString) * 1000; // cores to millicores
    }
  }
  
  private parseMemoryUsage(memoryString: string): number {
    const units = { 'Ki': 1024, 'Mi': 1024 * 1024, 'Gi': 1024 * 1024 * 1024 };
    for (const [suffix, multiplier] of Object.entries(units)) {
      if (memoryString.endsWith(suffix)) {
        return parseInt(memoryString.slice(0, -suffix.length)) * multiplier;
      }
    }
    return parseInt(memoryString); // bytes
  }

  /**
   * Generic helper methods for custom resources
   */
  private async createCustomResource(
    group: string,
    version: string,
    plural: string,
    namespace: string,
    resource: any
  ): Promise<void> {
    try {
      await this.customObjectsApi.createNamespacedCustomObject(
        group,
        version,
        namespace,
        plural,
        resource
      );
    } catch (error) {
      if (error.response?.statusCode !== 409) { // Ignore conflicts
        throw error;
      }
    }
  }

  private async deleteCustomResource(
    group: string,
    version: string,
    plural: string,
    namespace: string,
    name: string
  ): Promise<void> {
    try {
      await this.customObjectsApi.deleteNamespacedCustomObject(
        group,
        version,
        namespace,
        plural,
        name
      );
    } catch (error) {
      if (error.response?.statusCode !== 404) { // Ignore not found
        throw error;
      }
    }
  }

  /**
   * Get Prometheus metrics for external consumption
   */
  getPrometheusMetrics(): Promise<string> {
    return this.prometheusRegistry.metrics();
  }
}