import { Counter, Histogram, Gauge, register, collectDefaultMetrics } from 'prom-client';
import winston from 'winston';
import { EventEmitter } from 'events';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'metrics.log' })
  ]
});

// Initialize default Node.js metrics collection
collectDefaultMetrics({ register });

// Custom metrics for Backstage portal
const httpRequestsTotal = new Counter({
  name: 'backstage_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'service']
});

const httpRequestDuration = new Histogram({
  name: 'backstage_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code', 'service'],
  buckets: [0.001, 0.005, 0.015, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 1.0, 5.0, 10.0]
});

const activeConnections = new Gauge({
  name: 'backstage_active_connections',
  help: 'Number of active connections',
  labelNames: ['type', 'service']
});

const catalogEntities = new Gauge({
  name: 'backstage_catalog_entities_total',
  help: 'Total number of catalog entities',
  labelNames: ['kind', 'namespace']
});

const pluginUsage = new Counter({
  name: 'backstage_plugin_usage_total',
  help: 'Total plugin usage count',
  labelNames: ['plugin_name', 'version', 'user_id']
});

const templateExecutions = new Counter({
  name: 'backstage_template_executions_total',
  help: 'Total template execution count',
  labelNames: ['template_name', 'status', 'user_id']
});

const searchQueries = new Counter({
  name: 'backstage_search_queries_total',
  help: 'Total search queries count',
  labelNames: ['query_type', 'user_id', 'results_count']
});

const userActivity = new Counter({
  name: 'backstage_user_activity_total',
  help: 'User activity events',
  labelNames: ['user_id', 'action', 'resource_type']
});

const deploymentEvents = new Counter({
  name: 'backstage_deployment_events_total',
  help: 'Deployment events',
  labelNames: ['service_name', 'environment', 'status', 'deployment_type']
});

const apiCallsTotal = new Counter({
  name: 'backstage_api_calls_total',
  help: 'Total API calls made',
  labelNames: ['api_name', 'endpoint', 'status', 'user_id']
});

const cacheOperations = new Counter({
  name: 'backstage_cache_operations_total',
  help: 'Cache operations count',
  labelNames: ['operation', 'cache_name', 'result']
});

const databaseConnections = new Gauge({
  name: 'backstage_database_connections',
  help: 'Database connection pool status',
  labelNames: ['pool_name', 'status']
});

const alertsTriggered = new Counter({
  name: 'backstage_alerts_triggered_total',
  help: 'Total alerts triggered',
  labelNames: ['alert_name', 'severity', 'service']
});

// Business metrics
const deploymentFrequency = new Histogram({
  name: 'backstage_deployment_frequency',
  help: 'Deployment frequency in days',
  buckets: [0.25, 0.5, 1, 2, 7, 14, 30]
});

const leadTimeForChanges = new Histogram({
  name: 'backstage_lead_time_for_changes',
  help: 'Lead time for changes in hours',
  buckets: [1, 4, 8, 24, 48, 168, 720] // 1h to 30 days
});

const meanTimeToRecovery = new Histogram({
  name: 'backstage_mean_time_to_recovery',
  help: 'Mean time to recovery in minutes',
  buckets: [5, 15, 30, 60, 240, 480, 1440] // 5 minutes to 24 hours
});

const changeFailureRate = new Gauge({
  name: 'backstage_change_failure_rate',
  help: 'Change failure rate percentage',
  labelNames: ['service', 'environment']
});

// Register all custom metrics
register.registerMetric(httpRequestsTotal);
register.registerMetric(httpRequestDuration);
register.registerMetric(activeConnections);
register.registerMetric(catalogEntities);
register.registerMetric(pluginUsage);
register.registerMetric(templateExecutions);
register.registerMetric(searchQueries);
register.registerMetric(userActivity);
register.registerMetric(deploymentEvents);
register.registerMetric(apiCallsTotal);
register.registerMetric(cacheOperations);
register.registerMetric(databaseConnections);
register.registerMetric(alertsTriggered);
register.registerMetric(deploymentFrequency);
register.registerMetric(leadTimeForChanges);
register.registerMetric(meanTimeToRecovery);
register.registerMetric(changeFailureRate);

export interface MetricsCollectorConfig {
  collectInterval?: number; // milliseconds
  enableDetailedMetrics?: boolean;
  serviceName?: string;
  version?: string;
}

export class EnhancedMetricsCollector extends EventEmitter {
  private config: Required<MetricsCollectorConfig>;
  private collectTimer?: NodeJS.Timeout;
  private startTime: Date;
  private isCollecting: boolean = false;

  constructor(config: MetricsCollectorConfig = {}) {
    super();
    this.config = {
      collectInterval: config.collectInterval || 15000, // 15 seconds
      enableDetailedMetrics: config.enableDetailedMetrics ?? true,
      serviceName: config.serviceName || 'backstage-portal',
      version: config.version || process.env.npm_package_version || '1.0.0'
    };
    this.startTime = new Date();
    
    logger.info('Metrics collector initialized', {
      config: this.config,
      startTime: this.startTime.toISOString()
    });
  }

  // Start metrics collection
  start(): void {
    if (this.isCollecting) {
      logger.warn('Metrics collection already running');
      return;
    }

    this.isCollecting = true;
    this.collectTimer = setInterval(() => {
      this.collectSystemMetrics();
      this.emit('metrics:collected', { timestamp: new Date() });
    }, this.config.collectInterval);

    logger.info('Metrics collection started', {
      interval: this.config.collectInterval
    });
  }

  // Stop metrics collection
  stop(): void {
    if (this.collectTimer) {
      clearInterval(this.collectTimer);
      this.collectTimer = undefined;
    }
    this.isCollecting = false;
    logger.info('Metrics collection stopped');
  }

  // HTTP Request metrics
  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number,
    service = this.config.serviceName
  ): void {
    const labels = { method, route, status_code: statusCode.toString(), service };
    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, duration / 1000); // Convert ms to seconds
  }

  // Catalog metrics
  updateCatalogEntityCount(kind: string, namespace: string, count: number): void {
    catalogEntities.set({ kind, namespace }, count);
  }

  // Plugin usage tracking
  recordPluginUsage(pluginName: string, version: string, userId: string): void {
    pluginUsage.inc({ plugin_name: pluginName, version, user_id: userId });
  }

  // Template execution tracking
  recordTemplateExecution(templateName: string, status: 'success' | 'failure', userId: string): void {
    templateExecutions.inc({ template_name: templateName, status, user_id: userId });
  }

  // Search query tracking
  recordSearchQuery(queryType: string, userId: string, resultsCount: number): void {
    searchQueries.inc({
      query_type: queryType,
      user_id: userId,
      results_count: resultsCount.toString()
    });
  }

  // User activity tracking
  recordUserActivity(userId: string, action: string, resourceType: string): void {
    userActivity.inc({ user_id: userId, action, resource_type: resourceType });
  }

  // Deployment event tracking
  recordDeploymentEvent(
    serviceName: string,
    environment: string,
    status: 'success' | 'failure',
    deploymentType: 'manual' | 'automated'
  ): void {
    deploymentEvents.inc({
      service_name: serviceName,
      environment,
      status,
      deployment_type: deploymentType
    });
  }

  // API call tracking
  recordApiCall(apiName: string, endpoint: string, status: string, userId: string): void {
    apiCallsTotal.inc({ api_name: apiName, endpoint, status, user_id: userId });
  }

  // Cache operation tracking
  recordCacheOperation(operation: 'hit' | 'miss' | 'set' | 'delete', cacheName: string): void {
    const result = operation === 'hit' ? 'success' : operation === 'miss' ? 'miss' : 'operation';
    cacheOperations.inc({ operation, cache_name: cacheName, result });
  }

  // Database connection tracking
  updateDatabaseConnections(poolName: string, activeCount: number, idleCount: number): void {
    databaseConnections.set({ pool_name: poolName, status: 'active' }, activeCount);
    databaseConnections.set({ pool_name: poolName, status: 'idle' }, idleCount);
  }

  // Alert tracking
  recordAlert(alertName: string, severity: 'low' | 'medium' | 'high' | 'critical', service: string): void {
    alertsTriggered.inc({ alert_name: alertName, severity, service });
  }

  // DORA metrics
  recordDeploymentFrequency(days: number): void {
    deploymentFrequency.observe(days);
  }

  recordLeadTimeForChanges(hours: number): void {
    leadTimeForChanges.observe(hours);
  }

  recordMeanTimeToRecovery(minutes: number): void {
    meanTimeToRecovery.observe(minutes);
  }

  updateChangeFailureRate(service: string, environment: string, rate: number): void {
    changeFailureRate.set({ service, environment }, rate);
  }

  // Connection tracking
  incrementActiveConnections(type: 'websocket' | 'http' | 'grpc', service = this.config.serviceName): void {
    activeConnections.inc({ type, service });
  }

  decrementActiveConnections(type: 'websocket' | 'http' | 'grpc', service = this.config.serviceName): void {
    activeConnections.dec({ type, service });
  }

  // System metrics collection (called periodically)
  private async collectSystemMetrics(): Promise<void> {
    try {
      if (this.config.enableDetailedMetrics) {
        // Collect additional system information
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        // Update system metrics
        const systemInfo = {
          memory: {
            rss: memUsage.rss,
            heapTotal: memUsage.heapTotal,
            heapUsed: memUsage.heapUsed,
            external: memUsage.external
          },
          cpu: {
            user: cpuUsage.user,
            system: cpuUsage.system
          },
          uptime: Date.now() - this.startTime.getTime()
        };

        this.emit('system:metrics', systemInfo);
      }
    } catch (error) {
      logger.error('Error collecting system metrics', { error: error.message });
    }
  }

  // Get all metrics as Prometheus format
  async getMetrics(): Promise<string> {
    try {
      return await register.metrics();
    } catch (error) {
      logger.error('Error getting metrics', { error: error.message });
      throw error;
    }
  }

  // Get metrics as JSON
  async getMetricsAsJSON(): Promise<any[]> {
    try {
      return await register.getMetricsAsJSON();
    } catch (error) {
      logger.error('Error getting metrics as JSON', { error: error.message });
      throw error;
    }
  }

  // Clear all metrics
  clearMetrics(): void {
    register.clear();
    logger.info('All metrics cleared');
  }

  // Get collector status
  getStatus(): {
    isCollecting: boolean;
    startTime: Date;
    uptime: number;
    config: MetricsCollectorConfig;
  } {
    return {
      isCollecting: this.isCollecting,
      startTime: this.startTime,
      uptime: Date.now() - this.startTime.getTime(),
      config: this.config
    };
  }

  // Utility method to create Express middleware
  createExpressMiddleware() {
    return (req: any, res: any, next: any) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        this.recordHttpRequest(
          req.method,
          req.route?.path || req.path,
          res.statusCode,
          duration
        );
      });
      
      next();
    };
  }

  // Utility method to create custom business metric
  createBusinessMetric(name: string, help: string, type: 'counter' | 'gauge' | 'histogram', labels: string[] = []) {
    const metricName = `backstage_business_${name}`;
    
    let metric;
    switch (type) {
      case 'counter':
        metric = new Counter({ name: metricName, help, labelNames: labels });
        break;
      case 'gauge':
        metric = new Gauge({ name: metricName, help, labelNames: labels });
        break;
      case 'histogram':
        metric = new Histogram({ name: metricName, help, labelNames: labels });
        break;
    }
    
    register.registerMetric(metric);
    return metric;
  }
}

// Singleton instance
let metricsCollector: EnhancedMetricsCollector | null = null;

export function getMetricsCollector(config?: MetricsCollectorConfig): EnhancedMetricsCollector {
  if (!metricsCollector) {
    metricsCollector = new EnhancedMetricsCollector(config);
  }
  return metricsCollector;
}

export { register as prometheusRegister };
export default EnhancedMetricsCollector;