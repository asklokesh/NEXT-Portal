// Enterprise-Grade Prometheus Metrics Implementation
import { Counter, Gauge, Histogram, Summary, register, collectDefaultMetrics } from 'prom-client';

// Define metric types for type safety
interface PrometheusMetricsConfig {
  enableDefaultMetrics?: boolean;
  metricPrefix?: string;
  labels?: Record<string, string>;
}

// Core application metrics
class PrometheusMetrics {
  // HTTP Request metrics
  public httpRequestsTotal: Counter<string>;
  public httpRequestDuration: Histogram<string>;
  public httpRequestSize: Histogram<string>;
  public httpResponseSize: Histogram<string>;

  // Application performance metrics
  public pluginOperationDuration: Histogram<string>;
  public pluginOperationTotal: Counter<string>;
  public pluginHealthStatus: Gauge<string>;
  public pluginInstallationsTotal: Counter<string>;
  public pluginRollbacksTotal: Counter<string>;

  // Database metrics
  public databaseConnectionsActive: Gauge<string>;
  public databaseQueryDuration: Histogram<string>;
  public databaseQueryTotal: Counter<string>;
  public databaseConnectionsTotal: Counter<string>;

  // Cache metrics
  public cacheOperationsTotal: Counter<string>;
  public cacheHitsTotal: Counter<string>;
  public cacheMissesTotal: Counter<string>;
  public cacheSize: Gauge<string>;

  // WebSocket metrics
  public websocketConnectionsActive: Gauge<string>;
  public websocketMessagesTotal: Counter<string>;
  public websocketConnectionDuration: Histogram<string>;

  // Authentication metrics
  public authenticationAttemptsTotal: Counter<string>;
  public authenticationSuccessTotal: Counter<string>;
  public authenticationFailuresTotal: Counter<string>;
  public authenticationDuration: Histogram<string>;

  // Business metrics
  public userSessionsActive: Gauge<string>;
  public apiCallsTotal: Counter<string>;
  public errorRateTotal: Counter<string>;
  public systemHealthScore: Gauge<string>;

  // Resource utilization
  public cpuUsage: Gauge<string>;
  public memoryUsage: Gauge<string>;
  public diskUsage: Gauge<string>;
  public networkBytesTotal: Counter<string>;

  // Developer productivity metrics
  public developersActiveDaily: Gauge<string>;
  public templatesCreatedTotal: Counter<string>;
  public servicesDeployedTotal: Counter<string>;
  public codeQualityScore: Gauge<string>;

  constructor(config: PrometheusMetricsConfig = {}) {
    const { enableDefaultMetrics = true, metricPrefix = 'saas_idp_', labels = {} } = config;

    // Enable default Node.js metrics
    if (enableDefaultMetrics) {
      collectDefaultMetrics({ prefix: metricPrefix });
    }

    // HTTP Request metrics
    this.httpRequestsTotal = new Counter({
      name: `${metricPrefix}http_requests_total`,
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'user_id', 'tenant_id'],
      ...labels
    });

    this.httpRequestDuration = new Histogram({
      name: `${metricPrefix}http_request_duration_seconds`,
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
    });

    this.httpRequestSize = new Histogram({
      name: `${metricPrefix}http_request_size_bytes`,
      help: 'HTTP request size in bytes',
      labelNames: ['method', 'route'],
      buckets: [100, 1000, 10000, 100000, 1000000]
    });

    this.httpResponseSize = new Histogram({
      name: `${metricPrefix}http_response_size_bytes`,
      help: 'HTTP response size in bytes',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [100, 1000, 10000, 100000, 1000000, 10000000]
    });

    // Plugin metrics
    this.pluginOperationDuration = new Histogram({
      name: `${metricPrefix}plugin_operation_duration_seconds`,
      help: 'Plugin operation duration in seconds',
      labelNames: ['plugin_id', 'operation', 'status', 'version'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60]
    });

    this.pluginOperationTotal = new Counter({
      name: `${metricPrefix}plugin_operations_total`,
      help: 'Total number of plugin operations',
      labelNames: ['plugin_id', 'operation', 'status', 'user_id']
    });

    this.pluginHealthStatus = new Gauge({
      name: `${metricPrefix}plugin_health_status`,
      help: 'Plugin health status (1 = healthy, 0 = unhealthy)',
      labelNames: ['plugin_id', 'version', 'environment']
    });

    this.pluginInstallationsTotal = new Counter({
      name: `${metricPrefix}plugin_installations_total`,
      help: 'Total number of plugin installations',
      labelNames: ['plugin_id', 'version', 'user_id', 'tenant_id']
    });

    this.pluginRollbacksTotal = new Counter({
      name: `${metricPrefix}plugin_rollbacks_total`,
      help: 'Total number of plugin rollbacks',
      labelNames: ['plugin_id', 'from_version', 'to_version', 'reason']
    });

    // Database metrics
    this.databaseConnectionsActive = new Gauge({
      name: `${metricPrefix}database_connections_active`,
      help: 'Number of active database connections',
      labelNames: ['database', 'pool']
    });

    this.databaseQueryDuration = new Histogram({
      name: `${metricPrefix}database_query_duration_seconds`,
      help: 'Database query duration in seconds',
      labelNames: ['database', 'operation', 'table'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5]
    });

    this.databaseQueryTotal = new Counter({
      name: `${metricPrefix}database_queries_total`,
      help: 'Total number of database queries',
      labelNames: ['database', 'operation', 'table', 'status']
    });

    this.databaseConnectionsTotal = new Counter({
      name: `${metricPrefix}database_connections_total`,
      help: 'Total number of database connections',
      labelNames: ['database', 'status']
    });

    // Cache metrics
    this.cacheOperationsTotal = new Counter({
      name: `${metricPrefix}cache_operations_total`,
      help: 'Total number of cache operations',
      labelNames: ['operation', 'cache_name', 'status']
    });

    this.cacheHitsTotal = new Counter({
      name: `${metricPrefix}cache_hits_total`,
      help: 'Total number of cache hits',
      labelNames: ['cache_name']
    });

    this.cacheMissesTotal = new Counter({
      name: `${metricPrefix}cache_misses_total`,
      help: 'Total number of cache misses',
      labelNames: ['cache_name']
    });

    this.cacheSize = new Gauge({
      name: `${metricPrefix}cache_size_bytes`,
      help: 'Cache size in bytes',
      labelNames: ['cache_name']
    });

    // WebSocket metrics
    this.websocketConnectionsActive = new Gauge({
      name: `${metricPrefix}websocket_connections_active`,
      help: 'Number of active WebSocket connections',
      labelNames: ['namespace', 'room']
    });

    this.websocketMessagesTotal = new Counter({
      name: `${metricPrefix}websocket_messages_total`,
      help: 'Total number of WebSocket messages',
      labelNames: ['type', 'namespace', 'status']
    });

    this.websocketConnectionDuration = new Histogram({
      name: `${metricPrefix}websocket_connection_duration_seconds`,
      help: 'WebSocket connection duration in seconds',
      labelNames: ['namespace'],
      buckets: [1, 10, 60, 300, 1800, 3600, 21600, 86400]
    });

    // Authentication metrics
    this.authenticationAttemptsTotal = new Counter({
      name: `${metricPrefix}authentication_attempts_total`,
      help: 'Total number of authentication attempts',
      labelNames: ['provider', 'method', 'client_type']
    });

    this.authenticationSuccessTotal = new Counter({
      name: `${metricPrefix}authentication_success_total`,
      help: 'Total number of successful authentications',
      labelNames: ['provider', 'method', 'user_type']
    });

    this.authenticationFailuresTotal = new Counter({
      name: `${metricPrefix}authentication_failures_total`,
      help: 'Total number of authentication failures',
      labelNames: ['provider', 'method', 'failure_reason']
    });

    this.authenticationDuration = new Histogram({
      name: `${metricPrefix}authentication_duration_seconds`,
      help: 'Authentication duration in seconds',
      labelNames: ['provider', 'method'],
      buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10, 30]
    });

    // Business metrics
    this.userSessionsActive = new Gauge({
      name: `${metricPrefix}user_sessions_active`,
      help: 'Number of active user sessions',
      labelNames: ['tenant_id', 'user_type']
    });

    this.apiCallsTotal = new Counter({
      name: `${metricPrefix}api_calls_total`,
      help: 'Total number of API calls',
      labelNames: ['endpoint', 'method', 'status_code', 'api_version']
    });

    this.errorRateTotal = new Counter({
      name: `${metricPrefix}errors_total`,
      help: 'Total number of errors',
      labelNames: ['service', 'error_type', 'severity', 'component']
    });

    this.systemHealthScore = new Gauge({
      name: `${metricPrefix}system_health_score`,
      help: 'Overall system health score (0-100)',
      labelNames: ['component', 'environment']
    });

    // Resource utilization
    this.cpuUsage = new Gauge({
      name: `${metricPrefix}cpu_usage_percent`,
      help: 'CPU usage percentage',
      labelNames: ['instance', 'component']
    });

    this.memoryUsage = new Gauge({
      name: `${metricPrefix}memory_usage_bytes`,
      help: 'Memory usage in bytes',
      labelNames: ['instance', 'component', 'type']
    });

    this.diskUsage = new Gauge({
      name: `${metricPrefix}disk_usage_bytes`,
      help: 'Disk usage in bytes',
      labelNames: ['instance', 'mount_point', 'device']
    });

    this.networkBytesTotal = new Counter({
      name: `${metricPrefix}network_bytes_total`,
      help: 'Total network bytes transferred',
      labelNames: ['instance', 'interface', 'direction']
    });

    // Developer productivity metrics
    this.developersActiveDaily = new Gauge({
      name: `${metricPrefix}developers_active_daily`,
      help: 'Number of daily active developers',
      labelNames: ['tenant_id', 'team_id']
    });

    this.templatesCreatedTotal = new Counter({
      name: `${metricPrefix}templates_created_total`,
      help: 'Total number of templates created',
      labelNames: ['template_type', 'user_id', 'tenant_id']
    });

    this.servicesDeployedTotal = new Counter({
      name: `${metricPrefix}services_deployed_total`,
      help: 'Total number of services deployed',
      labelNames: ['service_type', 'environment', 'user_id']
    });

    this.codeQualityScore = new Gauge({
      name: `${metricPrefix}code_quality_score`,
      help: 'Code quality score (0-100)',
      labelNames: ['project', 'branch', 'user_id']
    });

    // Register all metrics
    this.registerMetrics();
  }

  private registerMetrics(): void {
    const metrics = [
      this.httpRequestsTotal,
      this.httpRequestDuration,
      this.httpRequestSize,
      this.httpResponseSize,
      this.pluginOperationDuration,
      this.pluginOperationTotal,
      this.pluginHealthStatus,
      this.pluginInstallationsTotal,
      this.pluginRollbacksTotal,
      this.databaseConnectionsActive,
      this.databaseQueryDuration,
      this.databaseQueryTotal,
      this.databaseConnectionsTotal,
      this.cacheOperationsTotal,
      this.cacheHitsTotal,
      this.cacheMissesTotal,
      this.cacheSize,
      this.websocketConnectionsActive,
      this.websocketMessagesTotal,
      this.websocketConnectionDuration,
      this.authenticationAttemptsTotal,
      this.authenticationSuccessTotal,
      this.authenticationFailuresTotal,
      this.authenticationDuration,
      this.userSessionsActive,
      this.apiCallsTotal,
      this.errorRateTotal,
      this.systemHealthScore,
      this.cpuUsage,
      this.memoryUsage,
      this.diskUsage,
      this.networkBytesTotal,
      this.developersActiveDaily,
      this.templatesCreatedTotal,
      this.servicesDeployedTotal,
      this.codeQualityScore
    ];

    // Register each metric with Prometheus
    metrics.forEach(metric => {
      try {
        register.registerMetric(metric);
      } catch (error) {
        // Metric might already be registered, ignore the error
        console.warn(`Metric ${metric.name} already registered`);
      }
    });
  }

  // Helper methods for common metric operations
  recordHttpRequest(method: string, route: string, statusCode: number, duration: number, userId?: string, tenantId?: string): void {
    this.httpRequestsTotal.inc({
      method,
      route,
      status_code: statusCode.toString(),
      user_id: userId || 'unknown',
      tenant_id: tenantId || 'default'
    });

    this.httpRequestDuration.observe({
      method,
      route,
      status_code: statusCode.toString()
    }, duration / 1000); // Convert to seconds
  }

  recordPluginOperation(pluginId: string, operation: string, status: string, duration: number, version?: string, userId?: string): void {
    this.pluginOperationTotal.inc({
      plugin_id: pluginId,
      operation,
      status,
      user_id: userId || 'system'
    });

    this.pluginOperationDuration.observe({
      plugin_id: pluginId,
      operation,
      status,
      version: version || 'unknown'
    }, duration / 1000);
  }

  recordDatabaseQuery(database: string, operation: string, table: string, duration: number, status: string): void {
    this.databaseQueryTotal.inc({
      database,
      operation,
      table,
      status
    });

    this.databaseQueryDuration.observe({
      database,
      operation,
      table
    }, duration / 1000);
  }

  recordCacheOperation(operation: string, cacheName: string, hit: boolean, status: string = 'success'): void {
    this.cacheOperationsTotal.inc({
      operation,
      cache_name: cacheName,
      status
    });

    if (hit) {
      this.cacheHitsTotal.inc({ cache_name: cacheName });
    } else {
      this.cacheMissesTotal.inc({ cache_name: cacheName });
    }
  }

  recordAuthentication(provider: string, method: string, success: boolean, duration: number, failureReason?: string): void {
    this.authenticationAttemptsTotal.inc({
      provider,
      method,
      client_type: 'web' // Default to web, can be parameterized
    });

    if (success) {
      this.authenticationSuccessTotal.inc({
        provider,
        method,
        user_type: 'human' // Default to human, can be parameterized
      });
    } else {
      this.authenticationFailuresTotal.inc({
        provider,
        method,
        failure_reason: failureReason || 'unknown'
      });
    }

    this.authenticationDuration.observe({
      provider,
      method
    }, duration / 1000);
  }

  recordError(service: string, errorType: string, severity: string, component: string): void {
    this.errorRateTotal.inc({
      service,
      error_type: errorType,
      severity,
      component
    });
  }

  updateSystemHealth(component: string, score: number, environment: string = 'production'): void {
    this.systemHealthScore.set({
      component,
      environment
    }, score);
  }

  updateResourceUsage(instance: string, component: string, cpuPercent: number, memoryBytes: number): void {
    this.cpuUsage.set({
      instance,
      component
    }, cpuPercent);

    this.memoryUsage.set({
      instance,
      component,
      type: 'used'
    }, memoryBytes);
  }

  // Get metrics for export
  async getMetrics(): Promise<string> {
    return await register.metrics();
  }

  // Clear all metrics (for testing)
  clear(): void {
    register.clear();
  }

  // Get metric registry for advanced usage
  getRegistry() {
    return register;
  }
}

// Singleton instance
let metricsInstance: PrometheusMetrics | null = null;

export function getPrometheusMetrics(config?: PrometheusMetricsConfig): PrometheusMetrics {
  if (!metricsInstance) {
    metricsInstance = new PrometheusMetrics(config);
  }
  return metricsInstance;
}

export { PrometheusMetrics };
export type { PrometheusMetricsConfig };