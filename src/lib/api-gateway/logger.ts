import winston from 'winston';
import { Redis } from 'ioredis';
import { z } from 'zod';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'error' | 'warn' | 'info' | 'debug';
  service: string;
  component: string;
  message: string;
  metadata: Record<string, any>;
  requestId?: string;
  userId?: string;
  consumerId?: string;
  traceId?: string;
  spanId?: string;
  duration?: number;
  statusCode?: number;
  method?: string;
  path?: string;
  userAgent?: string;
  ipAddress?: string;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  requestBody?: any;
  responseBody?: any;
  errorStack?: string;
  tags: string[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  action: string;
  resource: string;
  resourceId?: string;
  userId: string;
  userEmail?: string;
  consumerId?: string;
  ipAddress: string;
  userAgent: string;
  requestId: string;
  details: Record<string, any>;
  outcome: 'success' | 'failure' | 'partial';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  complianceFlags: string[];
}

const LogEntrySchema = z.object({
  id: z.string(),
  timestamp: z.date(),
  level: z.enum(['error', 'warn', 'info', 'debug']),
  service: z.string(),
  component: z.string(),
  message: z.string(),
  metadata: z.record(z.any()),
  requestId: z.string().optional(),
  userId: z.string().optional(),
  consumerId: z.string().optional(),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  duration: z.number().optional(),
  statusCode: z.number().optional(),
  method: z.string().optional(),
  path: z.string().optional(),
  userAgent: z.string().optional(),
  ipAddress: z.string().optional(),
  headers: z.record(z.string()).optional(),
  queryParams: z.record(z.string()).optional(),
  requestBody: z.any().optional(),
  responseBody: z.any().optional(),
  errorStack: z.string().optional(),
  tags: z.array(z.string()),
});

export class GatewayLogger {
  private winston: winston.Logger;
  private redis: Redis;
  private serviceName: string;

  constructor(redis: Redis, serviceName: string = 'kong-gateway') {
    this.redis = redis;
    this.serviceName = serviceName;
    this.winston = this.createWinstonLogger();
  }

  private createWinstonLogger(): winston.Logger {
    return winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return JSON.stringify({
            timestamp,
            level,
            service: this.serviceName,
            message,
            ...meta,
          });
        })
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
        new winston.transports.File({
          filename: 'logs/gateway-error.log',
          level: 'error',
          maxsize: 10485760, // 10MB
          maxFiles: 5,
        }),
        new winston.transports.File({
          filename: 'logs/gateway-combined.log',
          maxsize: 10485760, // 10MB
          maxFiles: 10,
        }),
      ],
      exceptionHandlers: [
        new winston.transports.File({ filename: 'logs/gateway-exceptions.log' }),
      ],
      rejectionHandlers: [
        new winston.transports.File({ filename: 'logs/gateway-rejections.log' }),
      ],
    });
  }

  /**
   * Log API request/response
   */
  async logRequest(entry: Partial<LogEntry> & {
    message: string;
    component: string;
  }): Promise<void> {
    const logEntry: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      level: entry.level || 'info',
      service: this.serviceName,
      component: entry.component,
      message: entry.message,
      metadata: entry.metadata || {},
      requestId: entry.requestId,
      userId: entry.userId,
      consumerId: entry.consumerId,
      traceId: entry.traceId,
      spanId: entry.spanId,
      duration: entry.duration,
      statusCode: entry.statusCode,
      method: entry.method,
      path: entry.path,
      userAgent: entry.userAgent,
      ipAddress: entry.ipAddress,
      headers: this.sanitizeHeaders(entry.headers || {}),
      queryParams: entry.queryParams,
      requestBody: this.sanitizeBody(entry.requestBody),
      responseBody: this.sanitizeBody(entry.responseBody),
      errorStack: entry.errorStack,
      tags: entry.tags || [],
    };

    // Log with Winston
    this.winston.log(logEntry.level, logEntry.message, {
      ...logEntry,
      timestamp: logEntry.timestamp.toISOString(),
    });

    // Store in Redis for real-time monitoring
    await this.storeInRedis(logEntry);

    // Store in time-series for analytics
    await this.storeTimeSeries(logEntry);
  }

  /**
   * Log audit event
   */
  async logAudit(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
    const auditEntry: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...entry,
    };

    // Log with Winston
    this.winston.info('AUDIT_EVENT', {
      audit: true,
      ...auditEntry,
      timestamp: auditEntry.timestamp.toISOString(),
    });

    // Store audit log in Redis with longer retention
    await this.redis.zadd(
      'audit_logs',
      auditEntry.timestamp.getTime(),
      JSON.stringify(auditEntry)
    );

    // Set expiration for audit logs (7 years for compliance)
    const auditRetentionDays = 365 * 7;
    await this.redis.expire('audit_logs', auditRetentionDays * 24 * 60 * 60);

    // Index by user for quick lookups
    if (auditEntry.userId) {
      await this.redis.zadd(
        `audit_logs:user:${auditEntry.userId}`,
        auditEntry.timestamp.getTime(),
        auditEntry.id
      );
      await this.redis.expire(
        `audit_logs:user:${auditEntry.userId}`,
        auditRetentionDays * 24 * 60 * 60
      );
    }

    // Index by resource for compliance queries
    await this.redis.zadd(
      `audit_logs:resource:${auditEntry.resource}`,
      auditEntry.timestamp.getTime(),
      auditEntry.id
    );
    await this.redis.expire(
      `audit_logs:resource:${auditEntry.resource}`,
      auditRetentionDays * 24 * 60 * 60
    );

    // Alert on high-risk activities
    if (auditEntry.riskLevel === 'critical' || auditEntry.riskLevel === 'high') {
      await this.alertHighRiskActivity(auditEntry);
    }
  }

  /**
   * Log performance metrics
   */
  async logMetrics(metrics: {
    endpoint: string;
    method: string;
    statusCode: number;
    responseTime: number;
    requestSize: number;
    responseSize: number;
    timestamp?: Date;
    userId?: string;
    consumerId?: string;
    tags?: string[];
  }): Promise<void> {
    const timestamp = metrics.timestamp || new Date();
    const metricEntry = {
      ...metrics,
      timestamp: timestamp.toISOString(),
      service: this.serviceName,
    };

    // Log metrics
    this.winston.info('METRICS', metricEntry);

    // Store metrics in Redis for real-time dashboards
    const metricsKey = `metrics:${timestamp.toISOString().split('T')[0]}`;
    await this.redis.lpush(metricsKey, JSON.stringify(metricEntry));
    await this.redis.expire(metricsKey, 30 * 24 * 60 * 60); // 30 days

    // Update counters
    await this.updateMetricCounters(metrics);
  }

  /**
   * Log security event
   */
  async logSecurity(event: {
    type: 'authentication_failed' | 'authorization_failed' | 'rate_limit_exceeded' | 'suspicious_activity' | 'attack_detected';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    details: Record<string, any>;
    ipAddress: string;
    userAgent?: string;
    userId?: string;
    consumerId?: string;
    requestId?: string;
    endpoint?: string;
    method?: string;
  }): Promise<void> {
    const securityEntry = {
      id: `security_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      service: this.serviceName,
      component: 'security',
      ...event,
    };

    // Log security event
    this.winston.warn('SECURITY_EVENT', securityEntry);

    // Store in Redis for security monitoring
    await this.redis.zadd(
      'security_events',
      Date.now(),
      JSON.stringify(securityEntry)
    );
    await this.redis.expire('security_events', 90 * 24 * 60 * 60); // 90 days

    // Track by IP for threat detection
    await this.redis.zadd(
      `security_events:ip:${event.ipAddress}`,
      Date.now(),
      securityEntry.id
    );
    await this.redis.expire(
      `security_events:ip:${event.ipAddress}`,
      30 * 24 * 60 * 60
    ); // 30 days

    // Alert on high severity events
    if (event.severity === 'high' || event.severity === 'critical') {
      await this.alertSecurityEvent(securityEntry);
    }
  }

  /**
   * Search logs with filters
   */
  async searchLogs(filters: {
    startTime?: Date;
    endTime?: Date;
    level?: string;
    component?: string;
    userId?: string;
    consumerId?: string;
    requestId?: string;
    path?: string;
    method?: string;
    statusCode?: number;
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<{
    logs: LogEntry[];
    total: number;
    hasMore: boolean;
  }> {
    const { startTime, endTime, limit = 100, offset = 0 } = filters;
    const start = startTime ? startTime.getTime() : 0;
    const end = endTime ? endTime.getTime() : Date.now();

    // Get logs from Redis time-series
    const logIds = await this.redis.zrangebyscore(
      'logs_timeseries',
      start,
      end,
      'LIMIT',
      offset,
      limit + 1
    );

    const logs: LogEntry[] = [];
    const hasMore = logIds.length > limit;
    const idsToProcess = hasMore ? logIds.slice(0, -1) : logIds;

    for (const logId of idsToProcess) {
      const logData = await this.redis.hget('logs', logId);
      if (logData) {
        const log = JSON.parse(logData);
        
        // Apply filters
        if (this.matchesFilters(log, filters)) {
          logs.push({
            ...log,
            timestamp: new Date(log.timestamp),
          });
        }
      }
    }

    return {
      logs,
      total: await this.redis.zcard('logs_timeseries'),
      hasMore,
    };
  }

  /**
   * Get audit logs for compliance
   */
  async getAuditLogs(filters: {
    userId?: string;
    resource?: string;
    action?: string;
    startTime?: Date;
    endTime?: Date;
    riskLevel?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    logs: AuditLogEntry[];
    total: number;
    hasMore: boolean;
  }> {
    const { startTime, endTime, limit = 100, offset = 0 } = filters;
    const start = startTime ? startTime.getTime() : 0;
    const end = endTime ? endTime.getTime() : Date.now();

    let key = 'audit_logs';
    
    // Use specific index if filtering by user or resource
    if (filters.userId) {
      key = `audit_logs:user:${filters.userId}`;
    } else if (filters.resource) {
      key = `audit_logs:resource:${filters.resource}`;
    }

    const logData = await this.redis.zrangebyscore(
      key,
      start,
      end,
      'LIMIT',
      offset,
      limit + 1
    );

    const logs: AuditLogEntry[] = [];
    const hasMore = logData.length > limit;
    const dataToProcess = hasMore ? logData.slice(0, -1) : logData;

    for (const data of dataToProcess) {
      try {
        const log = JSON.parse(data);
        
        // Apply additional filters
        if (this.matchesAuditFilters(log, filters)) {
          logs.push({
            ...log,
            timestamp: new Date(log.timestamp),
          });
        }
      } catch (error) {
        console.error('Error parsing audit log:', error);
      }
    }

    return {
      logs,
      total: await this.redis.zcard(key),
      hasMore,
    };
  }

  /**
   * Get real-time metrics
   */
  async getMetrics(timeframe: '1h' | '24h' | '7d' | '30d' = '1h'): Promise<{
    requestRate: number;
    errorRate: number;
    avgResponseTime: number;
    p95ResponseTime: number;
    statusCodeDistribution: Record<string, number>;
    topEndpoints: Array<{ endpoint: string; count: number }>;
    topConsumers: Array<{ consumer: string; count: number }>;
  }> {
    const now = Date.now();
    const timeframes = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };

    const startTime = now - timeframes[timeframe];
    
    // Get metrics from Redis
    const metricsKeys = await this.redis.keys('metrics:*');
    const relevantKeys = metricsKeys.filter(key => {
      const date = key.split(':')[1];
      const keyTime = new Date(date).getTime();
      return keyTime >= startTime;
    });

    let totalRequests = 0;
    let totalErrors = 0;
    let totalResponseTime = 0;
    const responseTimes: number[] = [];
    const statusCodes: Record<string, number> = {};
    const endpoints: Record<string, number> = {};
    const consumers: Record<string, number> = {};

    for (const key of relevantKeys) {
      const metrics = await this.redis.lrange(key, 0, -1);
      
      for (const metricData of metrics) {
        try {
          const metric = JSON.parse(metricData);
          const metricTime = new Date(metric.timestamp).getTime();
          
          if (metricTime >= startTime) {
            totalRequests++;
            totalResponseTime += metric.responseTime;
            responseTimes.push(metric.responseTime);
            
            if (metric.statusCode >= 400) {
              totalErrors++;
            }
            
            statusCodes[metric.statusCode.toString()] = 
              (statusCodes[metric.statusCode.toString()] || 0) + 1;
            
            const endpointKey = `${metric.method} ${metric.endpoint}`;
            endpoints[endpointKey] = (endpoints[endpointKey] || 0) + 1;
            
            if (metric.consumerId) {
              consumers[metric.consumerId] = (consumers[metric.consumerId] || 0) + 1;
            }
          }
        } catch (error) {
          console.error('Error parsing metric:', error);
        }
      }
    }

    // Calculate percentiles
    responseTimes.sort((a, b) => a - b);
    const p95Index = Math.floor(responseTimes.length * 0.95);

    return {
      requestRate: totalRequests / (timeframes[timeframe] / (60 * 1000)), // requests per minute
      errorRate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0,
      avgResponseTime: totalRequests > 0 ? totalResponseTime / totalRequests : 0,
      p95ResponseTime: responseTimes[p95Index] || 0,
      statusCodeDistribution: statusCodes,
      topEndpoints: Object.entries(endpoints)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([endpoint, count]) => ({ endpoint, count })),
      topConsumers: Object.entries(consumers)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([consumer, count]) => ({ consumer, count })),
    };
  }

  /**
   * Store log in Redis for real-time access
   */
  private async storeInRedis(entry: LogEntry): Promise<void> {
    // Store full log entry
    await this.redis.hset('logs', entry.id, JSON.stringify({
      ...entry,
      timestamp: entry.timestamp.toISOString(),
    }));
    
    // Set expiration (30 days)
    await this.redis.expire('logs', 30 * 24 * 60 * 60);
  }

  /**
   * Store in time-series for analytics
   */
  private async storeTimeSeries(entry: LogEntry): Promise<void> {
    await this.redis.zadd(
      'logs_timeseries',
      entry.timestamp.getTime(),
      entry.id
    );
    
    // Clean up old entries (keep only last 30 days)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    await this.redis.zremrangebyscore('logs_timeseries', '-inf', thirtyDaysAgo);
  }

  /**
   * Update metric counters
   */
  private async updateMetricCounters(metrics: any): Promise<void> {
    const day = new Date().toISOString().split('T')[0];
    
    // Increment counters
    await this.redis.hincrby(`counters:${day}`, 'total_requests', 1);
    
    if (metrics.statusCode >= 400) {
      await this.redis.hincrby(`counters:${day}`, 'total_errors', 1);
    }
    
    // Track response times
    await this.redis.lpush(
      `response_times:${day}`,
      metrics.responseTime
    );
    await this.redis.expire(`response_times:${day}`, 24 * 60 * 60);
    
    // Set expiration for counters
    await this.redis.expire(`counters:${day}`, 30 * 24 * 60 * 60);
  }

  /**
   * Sanitize headers to remove sensitive information
   */
  private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
    const sanitized: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(headers)) {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  /**
   * Sanitize request/response body to remove sensitive data
   */
  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') return body;
    
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
    const sanitized = Array.isArray(body) ? [] : {};
    
    for (const [key, value] of Object.entries(body)) {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        (sanitized as any)[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        (sanitized as any)[key] = this.sanitizeBody(value);
      } else {
        (sanitized as any)[key] = value;
      }
    }
    
    return sanitized;
  }

  /**
   * Check if log matches filters
   */
  private matchesFilters(log: any, filters: any): boolean {
    if (filters.level && log.level !== filters.level) return false;
    if (filters.component && log.component !== filters.component) return false;
    if (filters.userId && log.userId !== filters.userId) return false;
    if (filters.consumerId && log.consumerId !== filters.consumerId) return false;
    if (filters.requestId && log.requestId !== filters.requestId) return false;
    if (filters.path && log.path !== filters.path) return false;
    if (filters.method && log.method !== filters.method) return false;
    if (filters.statusCode && log.statusCode !== filters.statusCode) return false;
    
    if (filters.tags && filters.tags.length > 0) {
      const logTags = log.tags || [];
      if (!filters.tags.every((tag: string) => logTags.includes(tag))) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Check if audit log matches filters
   */
  private matchesAuditFilters(log: any, filters: any): boolean {
    if (filters.action && log.action !== filters.action) return false;
    if (filters.riskLevel && log.riskLevel !== filters.riskLevel) return false;
    return true;
  }

  /**
   * Alert on high-risk audit activity
   */
  private async alertHighRiskActivity(auditEntry: AuditLogEntry): Promise<void> {
    const alert = {
      type: 'high_risk_audit',
      severity: auditEntry.riskLevel,
      message: `High risk activity detected: ${auditEntry.action}`,
      details: auditEntry,
      timestamp: new Date().toISOString(),
    };

    // Store alert for processing
    await this.redis.lpush('security_alerts', JSON.stringify(alert));
    
    // Log the alert
    this.winston.error('HIGH_RISK_AUDIT_ACTIVITY', alert);
  }

  /**
   * Alert on security events
   */
  private async alertSecurityEvent(securityEntry: any): Promise<void> {
    const alert = {
      type: 'security_event',
      severity: securityEntry.severity,
      message: securityEntry.message,
      details: securityEntry,
      timestamp: new Date().toISOString(),
    };

    // Store alert for processing
    await this.redis.lpush('security_alerts', JSON.stringify(alert));
    
    // Log the alert
    this.winston.error('SECURITY_ALERT', alert);
  }
}