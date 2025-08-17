/**
 * Comprehensive Performance Monitoring and Analytics
 * Enterprise-grade monitoring for database, API, memory, and system performance
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import Redis from 'ioredis';
import { createHash } from 'crypto';

// Monitoring configuration
const MONITORING_CONFIG = {
  // Metrics collection intervals
  intervals: {
    realTime: 5000,    // 5 seconds
    detailed: 30000,   // 30 seconds
    summary: 300000,   // 5 minutes
    retention: 86400000, // 24 hours
  },
  
  // Performance thresholds
  thresholds: {
    api: {
      responseTime: {
        warning: 1000,   // 1 second
        critical: 5000,  // 5 seconds
      },
      errorRate: {
        warning: 0.05,   // 5%
        critical: 0.10,  // 10%
      }
    },
    database: {
      queryTime: {
        warning: 500,    // 500ms
        critical: 2000,  // 2 seconds
      },
      connectionPool: {
        warning: 0.8,    // 80% utilization
        critical: 0.95,  // 95% utilization
      }
    },
    memory: {
      usage: {
        warning: 0.8,    // 80%
        critical: 0.9,   // 90%
      },
      leak: {
        warning: 100,    // 100MB growth
        critical: 500,   // 500MB growth
      }
    },
    websocket: {
      connections: {
        warning: 8000,   // 8k connections
        critical: 9500,  // 9.5k connections
      },
      messageRate: {
        warning: 10000,  // 10k messages/minute
        critical: 50000, // 50k messages/minute
      }
    }
  },
  
  // Alerting configuration
  alerting: {
    cooldown: 300000,  // 5 minutes between similar alerts
    escalation: {
      warning: 1,      // Immediate
      critical: 0,     // Immediate
    }
  },
  
  // Data retention
  retention: {
    realTime: 3600,    // 1 hour
    detailed: 86400,   // 24 hours
    summary: 2592000,  // 30 days
    alerts: 7776000,   // 90 days
  }
};

interface PerformanceMetric {
  timestamp: number;
  type: string;
  category: string;
  value: number;
  metadata?: any;
  tenantId?: string;
  userId?: string;
}

interface AlertRule {
  id: string;
  name: string;
  category: string;
  condition: string;
  threshold: number;
  severity: 'warning' | 'critical';
  enabled: boolean;
  cooldown: number;
  lastTriggered?: number;
}

interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical';
  components: {
    database: ComponentHealth;
    redis: ComponentHealth;
    api: ComponentHealth;
    websocket: ComponentHealth;
    memory: ComponentHealth;
  };
  timestamp: number;
}

interface ComponentHealth {
  status: 'healthy' | 'warning' | 'critical';
  responseTime?: number;
  errorRate?: number;
  utilization?: number;
  lastCheck: number;
  details?: string;
}

interface PerformanceReport {
  period: string;
  metrics: {
    api: ApiMetrics;
    database: DatabaseMetrics;
    memory: MemoryMetrics;
    websocket: WebSocketMetrics;
  };
  alerts: AlertSummary[];
  recommendations: string[];
}

interface ApiMetrics {
  totalRequests: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  throughput: number;
  cacheHitRate: number;
}

interface DatabaseMetrics {
  totalQueries: number;
  averageQueryTime: number;
  slowQueries: number;
  connectionPoolUtilization: number;
  cacheHitRate: number;
  deadlocks: number;
}

interface MemoryMetrics {
  usage: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  gcTime: number;
  leaks: number;
}

interface WebSocketMetrics {
  activeConnections: number;
  messagesPerSecond: number;
  averageQueueSize: number;
  connectionErrors: number;
  latency: number;
}

interface AlertSummary {
  rule: string;
  count: number;
  severity: string;
  lastTriggered: number;
}

class PerformanceAnalytics extends EventEmitter {
  private static instance: PerformanceAnalytics;
  private redis: Redis;
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private alertHistory: Map<string, number> = new Map();
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private baselineMetrics: Map<string, number> = new Map();
  
  private constructor(redis: Redis) {
    super();
    this.redis = redis;
    this.setMaxListeners(0);
    this.initializeAlertRules();
    this.startMonitoring();
  }

  static getInstance(redis: Redis): PerformanceAnalytics {
    if (!PerformanceAnalytics.instance) {
      PerformanceAnalytics.instance = new PerformanceAnalytics(redis);
    }
    return PerformanceAnalytics.instance;
  }

  /**
   * Record performance metric
   */
  async recordMetric(metric: Omit<PerformanceMetric, 'timestamp'>): Promise<void> {
    const fullMetric: PerformanceMetric = {
      ...metric,
      timestamp: Date.now()
    };

    // Store in memory for real-time access
    const key = `${metric.category}:${metric.type}`;
    const metrics = this.metrics.get(key) || [];
    metrics.push(fullMetric);
    
    // Keep only recent metrics in memory
    const cutoff = Date.now() - MONITORING_CONFIG.intervals.retention;
    const filteredMetrics = metrics.filter(m => m.timestamp > cutoff);
    this.metrics.set(key, filteredMetrics);

    // Store in Redis for persistence
    await this.storeMetricInRedis(fullMetric);

    // Check alert rules
    await this.checkAlertRules(fullMetric);

    this.emit('metricRecorded', fullMetric);
  }

  /**
   * Store metric in Redis with TTL
   */
  private async storeMetricInRedis(metric: PerformanceMetric): Promise<void> {
    try {
      const key = `metrics:${metric.category}:${metric.type}:${metric.timestamp}`;
      await this.redis.setex(
        key,
        MONITORING_CONFIG.retention.detailed,
        JSON.stringify(metric)
      );

      // Also add to time series for aggregation
      const tsKey = `ts:${metric.category}:${metric.type}`;
      await this.redis.zadd(tsKey, metric.timestamp, JSON.stringify(metric));
      await this.redis.expire(tsKey, MONITORING_CONFIG.retention.detailed);
    } catch (error) {
      console.error('Error storing metric in Redis:', error);
    }
  }

  /**
   * API Performance Monitoring
   */
  async recordApiMetric(
    endpoint: string,
    method: string,
    responseTime: number,
    statusCode: number,
    tenantId?: string
  ): Promise<void> {
    await this.recordMetric({
      type: 'response_time',
      category: 'api',
      value: responseTime,
      metadata: { endpoint, method, statusCode },
      tenantId
    });

    // Record error if status >= 400
    if (statusCode >= 400) {
      await this.recordMetric({
        type: 'error',
        category: 'api',
        value: 1,
        metadata: { endpoint, method, statusCode },
        tenantId
      });
    }
  }

  /**
   * Database Performance Monitoring
   */
  async recordDatabaseMetric(
    operation: string,
    queryTime: number,
    model?: string,
    tenantId?: string
  ): Promise<void> {
    await this.recordMetric({
      type: 'query_time',
      category: 'database',
      value: queryTime,
      metadata: { operation, model },
      tenantId
    });

    // Record slow query if above threshold
    if (queryTime > MONITORING_CONFIG.thresholds.database.queryTime.warning) {
      await this.recordMetric({
        type: 'slow_query',
        category: 'database',
        value: 1,
        metadata: { operation, model, queryTime },
        tenantId
      });
    }
  }

  /**
   * Memory Performance Monitoring
   */
  async recordMemoryMetric(): Promise<void> {
    const memUsage = process.memoryUsage();
    
    await Promise.all([
      this.recordMetric({
        type: 'heap_used',
        category: 'memory',
        value: memUsage.heapUsed
      }),
      this.recordMetric({
        type: 'heap_total',
        category: 'memory',
        value: memUsage.heapTotal
      }),
      this.recordMetric({
        type: 'external',
        category: 'memory',
        value: memUsage.external
      }),
      this.recordMetric({
        type: 'rss',
        category: 'memory',
        value: memUsage.rss
      })
    ]);
  }

  /**
   * WebSocket Performance Monitoring
   */
  async recordWebSocketMetric(
    type: string,
    value: number,
    metadata?: any,
    tenantId?: string
  ): Promise<void> {
    await this.recordMetric({
      type,
      category: 'websocket',
      value,
      metadata,
      tenantId
    });
  }

  /**
   * System Health Check
   */
  async getSystemHealth(): Promise<SystemHealth> {
    const health: SystemHealth = {
      overall: 'healthy',
      components: {
        database: await this.checkDatabaseHealth(),
        redis: await this.checkRedisHealth(),
        api: await this.checkApiHealth(),
        websocket: await this.checkWebSocketHealth(),
        memory: await this.checkMemoryHealth()
      },
      timestamp: Date.now()
    };

    // Determine overall health
    const componentStatuses = Object.values(health.components).map(c => c.status);
    if (componentStatuses.includes('critical')) {
      health.overall = 'critical';
    } else if (componentStatuses.includes('warning')) {
      health.overall = 'warning';
    }

    return health;
  }

  /**
   * Component health checks
   */
  private async checkDatabaseHealth(): Promise<ComponentHealth> {
    try {
      const start = performance.now();
      // Simple ping to database
      await this.redis.ping(); // Placeholder - should use actual DB ping
      const responseTime = performance.now() - start;

      const recentMetrics = await this.getRecentMetrics('database', 'query_time', 60000);
      const averageQueryTime = this.calculateAverage(recentMetrics);
      const errorRate = await this.calculateErrorRate('database', 60000);

      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (averageQueryTime > MONITORING_CONFIG.thresholds.database.queryTime.critical || errorRate > 0.1) {
        status = 'critical';
      } else if (averageQueryTime > MONITORING_CONFIG.thresholds.database.queryTime.warning || errorRate > 0.05) {
        status = 'warning';
      }

      return {
        status,
        responseTime,
        errorRate,
        lastCheck: Date.now()
      };
    } catch (error) {
      return {
        status: 'critical',
        lastCheck: Date.now(),
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async checkRedisHealth(): Promise<ComponentHealth> {
    try {
      const start = performance.now();
      await this.redis.ping();
      const responseTime = performance.now() - start;

      return {
        status: responseTime > 100 ? 'warning' : 'healthy',
        responseTime,
        lastCheck: Date.now()
      };
    } catch (error) {
      return {
        status: 'critical',
        lastCheck: Date.now(),
        details: error instanceof Error ? error.message : 'Redis connection failed'
      };
    }
  }

  private async checkApiHealth(): Promise<ComponentHealth> {
    const recentMetrics = await this.getRecentMetrics('api', 'response_time', 300000); // 5 minutes
    const averageResponseTime = this.calculateAverage(recentMetrics);
    const errorRate = await this.calculateErrorRate('api', 300000);

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (averageResponseTime > MONITORING_CONFIG.thresholds.api.responseTime.critical || 
        errorRate > MONITORING_CONFIG.thresholds.api.errorRate.critical) {
      status = 'critical';
    } else if (averageResponseTime > MONITORING_CONFIG.thresholds.api.responseTime.warning || 
               errorRate > MONITORING_CONFIG.thresholds.api.errorRate.warning) {
      status = 'warning';
    }

    return {
      status,
      responseTime: averageResponseTime,
      errorRate,
      lastCheck: Date.now()
    };
  }

  private async checkWebSocketHealth(): Promise<ComponentHealth> {
    const connections = await this.getRecentMetrics('websocket', 'connections', 60000);
    const currentConnections = connections.length > 0 ? connections[connections.length - 1].value : 0;

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (currentConnections > MONITORING_CONFIG.thresholds.websocket.connections.critical) {
      status = 'critical';
    } else if (currentConnections > MONITORING_CONFIG.thresholds.websocket.connections.warning) {
      status = 'warning';
    }

    return {
      status,
      utilization: currentConnections / 10000, // Assuming max 10k connections
      lastCheck: Date.now()
    };
  }

  private async checkMemoryHealth(): Promise<ComponentHealth> {
    const memUsage = process.memoryUsage();
    const usage = memUsage.heapUsed / memUsage.heapTotal;

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (usage > MONITORING_CONFIG.thresholds.memory.usage.critical) {
      status = 'critical';
    } else if (usage > MONITORING_CONFIG.thresholds.memory.usage.warning) {
      status = 'warning';
    }

    return {
      status,
      utilization: usage,
      lastCheck: Date.now()
    };
  }

  /**
   * Generate performance report
   */
  async generatePerformanceReport(
    period: 'hour' | 'day' | 'week' = 'hour'
  ): Promise<PerformanceReport> {
    const periodMs = {
      hour: 3600000,
      day: 86400000,
      week: 604800000
    }[period];

    const [apiMetrics, dbMetrics, memMetrics, wsMetrics, alerts] = await Promise.all([
      this.generateApiMetrics(periodMs),
      this.generateDatabaseMetrics(periodMs),
      this.generateMemoryMetrics(periodMs),
      this.generateWebSocketMetrics(periodMs),
      this.getAlertSummary(periodMs)
    ]);

    const recommendations = this.generateRecommendations({
      api: apiMetrics,
      database: dbMetrics,
      memory: memMetrics,
      websocket: wsMetrics
    });

    return {
      period,
      metrics: {
        api: apiMetrics,
        database: dbMetrics,
        memory: memMetrics,
        websocket: wsMetrics
      },
      alerts,
      recommendations
    };
  }

  /**
   * Alert management
   */
  private initializeAlertRules(): void {
    const rules: AlertRule[] = [
      {
        id: 'api_response_time_warning',
        name: 'API Response Time Warning',
        category: 'api',
        condition: 'response_time > 1000',
        threshold: 1000,
        severity: 'warning',
        enabled: true,
        cooldown: 300000
      },
      {
        id: 'api_response_time_critical',
        name: 'API Response Time Critical',
        category: 'api',
        condition: 'response_time > 5000',
        threshold: 5000,
        severity: 'critical',
        enabled: true,
        cooldown: 300000
      },
      {
        id: 'memory_usage_warning',
        name: 'Memory Usage Warning',
        category: 'memory',
        condition: 'usage > 0.8',
        threshold: 0.8,
        severity: 'warning',
        enabled: true,
        cooldown: 300000
      },
      // Add more rules as needed
    ];

    rules.forEach(rule => {
      this.alertRules.set(rule.id, rule);
    });
  }

  private async checkAlertRules(metric: PerformanceMetric): Promise<void> {
    for (const [ruleId, rule] of this.alertRules.entries()) {
      if (!rule.enabled || rule.category !== metric.category) continue;

      const shouldTrigger = this.evaluateAlertRule(rule, metric);
      if (shouldTrigger) {
        const now = Date.now();
        const lastTriggered = this.alertHistory.get(ruleId) || 0;
        
        if (now - lastTriggered > rule.cooldown) {
          await this.triggerAlert(rule, metric);
          this.alertHistory.set(ruleId, now);
        }
      }
    }
  }

  private evaluateAlertRule(rule: AlertRule, metric: PerformanceMetric): boolean {
    // Simple threshold evaluation - could be extended for complex conditions
    return metric.value > rule.threshold;
  }

  private async triggerAlert(rule: AlertRule, metric: PerformanceMetric): Promise<void> {
    const alert = {
      rule: rule.id,
      name: rule.name,
      severity: rule.severity,
      value: metric.value,
      threshold: rule.threshold,
      timestamp: metric.timestamp,
      metadata: metric.metadata
    };

    // Store alert
    await this.redis.setex(
      `alert:${rule.id}:${metric.timestamp}`,
      MONITORING_CONFIG.retention.alerts,
      JSON.stringify(alert)
    );

    this.emit('alert', alert);
    console.log(`Alert triggered: ${rule.name} (${rule.severity}) - Value: ${metric.value}`);
  }

  /**
   * Utility methods
   */
  private async getRecentMetrics(
    category: string,
    type: string,
    timeWindow: number
  ): Promise<PerformanceMetric[]> {
    const key = `${category}:${type}`;
    const metrics = this.metrics.get(key) || [];
    const cutoff = Date.now() - timeWindow;
    
    return metrics.filter(m => m.timestamp > cutoff);
  }

  private calculateAverage(metrics: PerformanceMetric[]): number {
    if (metrics.length === 0) return 0;
    return metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;
  }

  private calculatePercentile(metrics: PerformanceMetric[], percentile: number): number {
    if (metrics.length === 0) return 0;
    
    const sorted = metrics.map(m => m.value).sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  private async calculateErrorRate(category: string, timeWindow: number): Promise<number> {
    const totalMetrics = await this.getRecentMetrics(category, 'response_time', timeWindow);
    const errorMetrics = await this.getRecentMetrics(category, 'error', timeWindow);
    
    if (totalMetrics.length === 0) return 0;
    return errorMetrics.length / totalMetrics.length;
  }

  private async generateApiMetrics(periodMs: number): Promise<ApiMetrics> {
    const responseTimeMetrics = await this.getRecentMetrics('api', 'response_time', periodMs);
    const errorMetrics = await this.getRecentMetrics('api', 'error', periodMs);
    
    return {
      totalRequests: responseTimeMetrics.length,
      averageResponseTime: this.calculateAverage(responseTimeMetrics),
      p95ResponseTime: this.calculatePercentile(responseTimeMetrics, 95),
      p99ResponseTime: this.calculatePercentile(responseTimeMetrics, 99),
      errorRate: responseTimeMetrics.length > 0 ? errorMetrics.length / responseTimeMetrics.length : 0,
      throughput: responseTimeMetrics.length / (periodMs / 1000 / 60), // requests per minute
      cacheHitRate: 0.85 // Placeholder - should be calculated from actual cache metrics
    };
  }

  private async generateDatabaseMetrics(periodMs: number): Promise<DatabaseMetrics> {
    const queryTimeMetrics = await this.getRecentMetrics('database', 'query_time', periodMs);
    const slowQueryMetrics = await this.getRecentMetrics('database', 'slow_query', periodMs);
    
    return {
      totalQueries: queryTimeMetrics.length,
      averageQueryTime: this.calculateAverage(queryTimeMetrics),
      slowQueries: slowQueryMetrics.length,
      connectionPoolUtilization: 0.65, // Placeholder
      cacheHitRate: 0.75, // Placeholder
      deadlocks: 0
    };
  }

  private async generateMemoryMetrics(periodMs: number): Promise<MemoryMetrics> {
    const heapUsedMetrics = await this.getRecentMetrics('memory', 'heap_used', periodMs);
    const heapTotalMetrics = await this.getRecentMetrics('memory', 'heap_total', periodMs);
    
    const currentHeapUsed = heapUsedMetrics.length > 0 ? heapUsedMetrics[heapUsedMetrics.length - 1].value : 0;
    const currentHeapTotal = heapTotalMetrics.length > 0 ? heapTotalMetrics[heapTotalMetrics.length - 1].value : 0;
    
    return {
      usage: currentHeapTotal > 0 ? currentHeapUsed / currentHeapTotal : 0,
      heapUsed: currentHeapUsed,
      heapTotal: currentHeapTotal,
      external: 0, // Placeholder
      gcTime: 0, // Placeholder
      leaks: 0
    };
  }

  private async generateWebSocketMetrics(periodMs: number): Promise<WebSocketMetrics> {
    const connectionMetrics = await this.getRecentMetrics('websocket', 'connections', periodMs);
    const messageMetrics = await this.getRecentMetrics('websocket', 'messages', periodMs);
    
    return {
      activeConnections: connectionMetrics.length > 0 ? connectionMetrics[connectionMetrics.length - 1].value : 0,
      messagesPerSecond: this.calculateAverage(messageMetrics),
      averageQueueSize: 0, // Placeholder
      connectionErrors: 0, // Placeholder
      latency: 0 // Placeholder
    };
  }

  private async getAlertSummary(periodMs: number): Promise<AlertSummary[]> {
    // Placeholder - should aggregate alerts from Redis
    return [];
  }

  private generateRecommendations(metrics: PerformanceReport['metrics']): string[] {
    const recommendations: string[] = [];
    
    if (metrics.api.averageResponseTime > 1000) {
      recommendations.push('Consider implementing API response caching for frequently accessed endpoints');
    }
    
    if (metrics.api.errorRate > 0.05) {
      recommendations.push('Investigate API error patterns and implement better error handling');
    }
    
    if (metrics.database.averageQueryTime > 500) {
      recommendations.push('Review and optimize slow database queries, consider adding indexes');
    }
    
    if (metrics.memory.usage > 0.8) {
      recommendations.push('Monitor memory usage closely, consider implementing garbage collection tuning');
    }
    
    if (metrics.websocket.activeConnections > 8000) {
      recommendations.push('Consider implementing WebSocket connection pooling or load balancing');
    }
    
    return recommendations;
  }

  /**
   * Monitoring lifecycle
   */
  private startMonitoring(): void {
    // Real-time monitoring
    this.monitoringIntervals.set('realTime', setInterval(() => {
      this.recordMemoryMetric();
    }, MONITORING_CONFIG.intervals.realTime));

    // Detailed monitoring
    this.monitoringIntervals.set('detailed', setInterval(() => {
      this.performDetailedMonitoring();
    }, MONITORING_CONFIG.intervals.detailed));

    // Summary monitoring
    this.monitoringIntervals.set('summary', setInterval(() => {
      this.performSummaryMonitoring();
    }, MONITORING_CONFIG.intervals.summary));
  }

  private async performDetailedMonitoring(): Promise<void> {
    // Perform health checks
    const health = await this.getSystemHealth();
    this.emit('healthCheck', health);
  }

  private async performSummaryMonitoring(): Promise<void> {
    // Generate and store performance summary
    const report = await this.generatePerformanceReport('hour');
    await this.redis.setex(
      `performance:summary:${Date.now()}`,
      MONITORING_CONFIG.retention.summary,
      JSON.stringify(report)
    );
    
    this.emit('performanceReport', report);
  }

  /**
   * Public API
   */
  async getMetrics(
    category: string,
    type: string,
    timeWindow: number = 3600000
  ): Promise<PerformanceMetric[]> {
    return this.getRecentMetrics(category, type, timeWindow);
  }

  async getPerformanceReport(period: 'hour' | 'day' | 'week' = 'hour'): Promise<PerformanceReport> {
    return this.generatePerformanceReport(period);
  }

  /**
   * Cleanup
   */
  shutdown(): void {
    this.monitoringIntervals.forEach(interval => clearInterval(interval));
    this.monitoringIntervals.clear();
    this.removeAllListeners();
    console.log('Performance analytics shut down');
  }
}

export default PerformanceAnalytics;
export { 
  PerformanceMetric, 
  SystemHealth, 
  PerformanceReport, 
  MONITORING_CONFIG 
};