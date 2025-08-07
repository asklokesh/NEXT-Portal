/**
 * Advanced Centralized Logging Engine
 * 
 * Production-ready logging system with structured logging, log analysis,
 * intelligent correlation, and multi-destination routing.
 */

import { EventEmitter } from 'events';
import * as winston from 'winston';
import * as fs from 'fs';
import * as path from 'path';
import { ObservabilityConfig } from './observability-config';

export interface LogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  service: string;
  environment: string;
  version: string;
  component?: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  labels: Record<string, string>;
  metadata: Record<string, any>;
  stack?: string;
  duration?: number;
  correlationId?: string;
}

export interface LogAnalysisResult {
  errorPatterns: Array<{
    pattern: string;
    count: number;
    lastSeen: Date;
    examples: LogEntry[];
  }>;
  performanceInsights: {
    slowOperations: Array<{
      operation: string;
      averageDuration: number;
      count: number;
    }>;
    errorRateByComponent: Record<string, number>;
  };
  securityEvents: LogEntry[];
  anomalies: Array<{
    type: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    timestamp: Date;
    relatedLogs: LogEntry[];
  }>;
}

export interface LogFilter {
  level?: string[];
  component?: string[];
  timeRange?: {
    start: Date;
    end: Date;
  };
  searchTerm?: string;
  traceId?: string;
  userId?: string;
  labels?: Record<string, string>;
}

export class LoggingEngine extends EventEmitter {
  private config: ObservabilityConfig;
  private logger: winston.Logger;
  private logBuffer: LogEntry[] = [];
  private logStorage: Map<string, LogEntry[]> = new Map();
  private logAnalyzer: LogAnalyzer;
  private isRunning = false;
  private bufferFlushInterval?: NodeJS.Timeout;
  private readonly maxBufferSize = 1000;
  private readonly maxStorageEntries = 10000;
  
  // Output destinations
  private outputs: Map<string, any> = new Map();
  
  // Log patterns and correlation
  private errorPatterns: Map<string, number> = new Map();
  private correlationTracker: Map<string, LogEntry[]> = new Map();
  
  // Sensitive data patterns (for masking)
  private sensitivePatterns = [
    /password\s*[:=]\s*["']?([^"'\s]+)/gi,
    /token\s*[:=]\s*["']?([^"'\s]+)/gi,
    /apikey\s*[:=]\s*["']?([^"'\s]+)/gi,
    /secret\s*[:=]\s*["']?([^"'\s]+)/gi,
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi, // emails
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // credit card numbers
  ];

  constructor(config: ObservabilityConfig) {
    super();
    this.config = config;
    this.logAnalyzer = new LogAnalyzer();
    
    this.initializeLogger();
    this.setupOutputs();
  }

  /**
   * Start the logging engine
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    // Start buffer flush interval
    this.bufferFlushInterval = setInterval(() => {
      this.flushBuffer();
    }, 5000); // Flush every 5 seconds
    
    // Start log analysis
    await this.logAnalyzer.start();
    
    this.emit('started', { timestamp: new Date() });
    console.log('📝 Logging Engine started');
  }

  /**
   * Stop the logging engine
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    // Clear intervals
    if (this.bufferFlushInterval) {
      clearInterval(this.bufferFlushInterval);
    }
    
    // Flush remaining logs
    await this.flushBuffer();
    
    // Stop analyzer
    await this.logAnalyzer.stop();
    
    // Close output streams
    this.logger.end();
    
    this.emit('stopped', { timestamp: new Date() });
    console.log('📝 Logging Engine stopped');
  }

  /**
   * Log a message
   */
  log(level: LogEntry['level'], message: string, metadata: Record<string, any> = {}): void {
    const logEntry = this.createLogEntry(level, message, metadata);
    this.processLogEntry(logEntry);
  }

  /**
   * Log debug message
   */
  debug(message: string, metadata: Record<string, any> = {}): void {
    this.log('debug', message, metadata);
  }

  /**
   * Log info message
   */
  info(message: string, metadata: Record<string, any> = {}): void {
    this.log('info', message, metadata);
  }

  /**
   * Log warning message
   */
  warn(message: string, metadata: Record<string, any> = {}): void {
    this.log('warn', message, metadata);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, metadata: Record<string, any> = {}): void {
    const errorMetadata = error ? {
      ...metadata,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    } : metadata;
    
    this.log('error', message, errorMetadata);
  }

  /**
   * Log HTTP request
   */
  logHttpRequest(req: any, res: any, duration: number): void {
    const statusCode = res.statusCode || 200;
    const level = statusCode >= 400 ? 'error' : statusCode >= 300 ? 'warn' : 'info';
    
    this.log(level, `HTTP ${req.method} ${req.url}`, {
      component: 'http',
      http: {
        method: req.method,
        url: req.url,
        statusCode,
        userAgent: req.headers?.['user-agent'],
        ip: req.ip || req.connection?.remoteAddress,
        responseTime: duration,
      },
      userId: req.user?.id,
      sessionId: req.session?.id,
      requestId: req.headers?.['x-request-id'],
      duration,
    });
  }

  /**
   * Log database operation
   */
  logDatabaseOperation(operation: string, table: string, duration: number, success: boolean, error?: Error): void {
    const level = success ? 'info' : 'error';
    
    this.log(level, `Database ${operation} on ${table}`, {
      component: 'database',
      database: {
        operation,
        table,
        duration,
        success,
      },
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
      duration,
    });
  }

  /**
   * Log plugin operation
   */
  logPluginOperation(pluginName: string, operation: string, success: boolean, duration?: number, metadata?: Record<string, any>): void {
    const level = success ? 'info' : 'error';
    
    this.log(level, `Plugin ${pluginName}: ${operation}`, {
      component: 'plugin',
      plugin: {
        name: pluginName,
        operation,
        success,
      },
      duration,
      ...metadata,
    });
  }

  /**
   * Log security event
   */
  logSecurityEvent(event: string, severity: 'low' | 'medium' | 'high' | 'critical', metadata: Record<string, any> = {}): void {
    this.log('warn', `Security Event: ${event}`, {
      component: 'security',
      security: {
        event,
        severity,
      },
      ...metadata,
      labels: {
        ...metadata.labels,
        security_event: 'true',
      },
    });
  }

  /**
   * Log business event
   */
  logBusinessEvent(event: string, metadata: Record<string, any> = {}): void {
    this.log('info', `Business Event: ${event}`, {
      component: 'business',
      business: {
        event,
      },
      ...metadata,
      labels: {
        ...metadata.labels,
        business_event: 'true',
      },
    });
  }

  /**
   * Log an observability event
   */
  async logEvent(event: any): Promise<void> {
    this.log('info', `Observability Event: ${event.type}`, {
      component: 'observability',
      observability: {
        eventType: event.type,
        source: event.source,
        severity: event.severity,
      },
      ...event.metadata,
    });
  }

  /**
   * Query logs
   */
  queryLogs(filter: LogFilter, limit: number = 100): LogEntry[] {
    let logs: LogEntry[] = [];
    
    // Collect logs from storage
    for (const logArray of this.logStorage.values()) {
      logs.push(...logArray);
    }
    
    // Add buffer logs
    logs.push(...this.logBuffer);
    
    // Apply filters
    logs = this.applyFilters(logs, filter);
    
    // Sort by timestamp (newest first)
    logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return logs.slice(0, limit);
  }

  /**
   * Analyze logs for patterns and insights
   */
  async analyzeLogs(timeRange?: { start: Date; end: Date }): Promise<LogAnalysisResult> {
    const logs = this.queryLogs(timeRange ? { timeRange } : {}, 10000);
    return this.logAnalyzer.analyze(logs);
  }

  /**
   * Get logs by correlation ID
   */
  getCorrelatedLogs(correlationId: string): LogEntry[] {
    return this.correlationTracker.get(correlationId) || [];
  }

  /**
   * Search logs
   */
  searchLogs(searchTerm: string, limit: number = 100): LogEntry[] {
    const filter: LogFilter = { searchTerm };
    return this.queryLogs(filter, limit);
  }

  /**
   * Export logs
   */
  exportLogs(format: 'json' | 'csv' | 'text', filter?: LogFilter): string {
    const logs = this.queryLogs(filter || {}, 10000);
    
    switch (format) {
      case 'json':
        return JSON.stringify(logs, null, 2);
      case 'csv':
        return this.exportToCsv(logs);
      case 'text':
        return this.exportToText(logs);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Initialize Winston logger
   */
  private initializeLogger(): void {
    const formats: winston.Logform.Format[] = [
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
    ];
    
    if (this.config.logging.structured) {
      formats.push(winston.format.json());
    } else {
      formats.push(winston.format.simple());
    }
    
    this.logger = winston.createLogger({
      level: this.config.logging.level,
      format: winston.format.combine(...formats),
      transports: [],
    });
  }

  /**
   * Setup output destinations
   */
  private setupOutputs(): void {
    const { outputs } = this.config.logging;
    
    // Console output
    if (outputs.console) {
      this.logger.add(new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        ),
      }));
    }
    
    // File output
    if (outputs.file) {
      const logDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      this.logger.add(new winston.transports.File({
        filename: path.join(logDir, 'application.log'),
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
      }));
      
      this.logger.add(new winston.transports.File({
        filename: path.join(logDir, 'error.log'),
        level: 'error',
        maxsize: 10 * 1024 * 1024,
        maxFiles: 5,
      }));
    }
    
    // TODO: Add other output configurations (Elasticsearch, Loki, etc.)
  }

  /**
   * Create log entry
   */
  private createLogEntry(level: LogEntry['level'], message: string, metadata: Record<string, any>): LogEntry {
    // Mask sensitive data
    if (this.config.logging.enhancement.sensitiveDataMasking) {
      message = this.maskSensitiveData(message);
    }
    
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      service: this.config.serviceName,
      environment: this.config.environment,
      version: this.config.version,
      component: metadata.component,
      traceId: metadata.traceId,
      spanId: metadata.spanId,
      userId: metadata.userId,
      sessionId: metadata.sessionId,
      requestId: metadata.requestId,
      correlationId: metadata.correlationId || this.generateCorrelationId(),
      duration: metadata.duration,
      labels: {
        level,
        service: this.config.serviceName,
        environment: this.config.environment,
        ...metadata.labels,
      },
      metadata: this.sanitizeMetadata(metadata),
    };
    
    // Add stack trace for errors
    if (level === 'error' && metadata.error?.stack) {
      entry.stack = metadata.error.stack;
    }
    
    return entry;
  }

  /**
   * Process log entry
   */
  private processLogEntry(logEntry: LogEntry): void {
    // Add to buffer
    this.logBuffer.push(logEntry);
    
    // Track correlation
    if (logEntry.correlationId) {
      if (!this.correlationTracker.has(logEntry.correlationId)) {
        this.correlationTracker.set(logEntry.correlationId, []);
      }
      this.correlationTracker.get(logEntry.correlationId)!.push(logEntry);
    }
    
    // Track error patterns
    if (logEntry.level === 'error') {
      const pattern = this.extractErrorPattern(logEntry.message);
      this.errorPatterns.set(pattern, (this.errorPatterns.get(pattern) || 0) + 1);
    }
    
    // Write to Winston logger
    this.logger.log(logEntry.level, logEntry.message, {
      ...logEntry.metadata,
      labels: logEntry.labels,
    });
    
    // Emit event
    this.emit('log-entry', logEntry);
    
    // Flush buffer if needed
    if (this.logBuffer.length >= this.maxBufferSize) {
      this.flushBuffer();
    }
  }

  /**
   * Flush log buffer
   */
  private async flushBuffer(): Promise<void> {
    if (this.logBuffer.length === 0) return;
    
    const logsToFlush = [...this.logBuffer];
    this.logBuffer = [];
    
    // Store in memory (with rotation)
    const storageKey = new Date().toISOString().substring(0, 10); // Daily storage
    
    if (!this.logStorage.has(storageKey)) {
      this.logStorage.set(storageKey, []);
    }
    
    const dayStorage = this.logStorage.get(storageKey)!;
    dayStorage.push(...logsToFlush);
    
    // Rotate storage if needed
    if (dayStorage.length > this.maxStorageEntries) {
      dayStorage.splice(0, dayStorage.length - this.maxStorageEntries);
    }
    
    // Clean old storage entries (keep 7 days)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);
    
    for (const [key, logs] of this.logStorage) {
      if (new Date(key) < cutoffDate) {
        this.logStorage.delete(key);
      }
    }
    
    this.emit('buffer-flushed', { count: logsToFlush.length, timestamp: new Date() });
  }

  /**
   * Apply filters to logs
   */
  private applyFilters(logs: LogEntry[], filter: LogFilter): LogEntry[] {
    return logs.filter(log => {
      // Level filter
      if (filter.level && !filter.level.includes(log.level)) {
        return false;
      }
      
      // Component filter
      if (filter.component && log.component && !filter.component.includes(log.component)) {
        return false;
      }
      
      // Time range filter
      if (filter.timeRange) {
        const logTime = log.timestamp.getTime();
        if (logTime < filter.timeRange.start.getTime() || logTime > filter.timeRange.end.getTime()) {
          return false;
        }
      }
      
      // Search term filter
      if (filter.searchTerm && !log.message.toLowerCase().includes(filter.searchTerm.toLowerCase())) {
        return false;
      }
      
      // Trace ID filter
      if (filter.traceId && log.traceId !== filter.traceId) {
        return false;
      }
      
      // User ID filter
      if (filter.userId && log.userId !== filter.userId) {
        return false;
      }
      
      // Labels filter
      if (filter.labels) {
        for (const [key, value] of Object.entries(filter.labels)) {
          if (log.labels[key] !== value) {
            return false;
          }
        }
      }
      
      return true;
    });
  }

  /**
   * Mask sensitive data
   */
  private maskSensitiveData(message: string): string {
    let maskedMessage = message;
    
    for (const pattern of this.sensitivePatterns) {
      maskedMessage = maskedMessage.replace(pattern, (match, group1) => {
        return match.replace(group1, '*'.repeat(Math.min(group1.length, 8)));
      });
    }
    
    return maskedMessage;
  }

  /**
   * Sanitize metadata
   */
  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const sanitized = { ...metadata };
    
    // Remove sensitive fields
    delete sanitized.password;
    delete sanitized.token;
    delete sanitized.apiKey;
    delete sanitized.secret;
    
    return sanitized;
  }

  /**
   * Extract error pattern
   */
  private extractErrorPattern(message: string): string {
    // Remove specific details to create generic pattern
    return message
      .replace(/\d+/g, 'N') // Replace numbers
      .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, 'UUID') // Replace UUIDs
      .replace(/\/[^\s]+/g, '/PATH') // Replace paths
      .substring(0, 100); // Limit length
  }

  /**
   * Generate correlation ID
   */
  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Export to CSV
   */
  private exportToCsv(logs: LogEntry[]): string {
    const headers = ['timestamp', 'level', 'message', 'component', 'service', 'traceId'];
    const rows = logs.map(log => [
      log.timestamp.toISOString(),
      log.level,
      `"${log.message.replace(/"/g, '""')}"`,
      log.component || '',
      log.service,
      log.traceId || '',
    ]);
    
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  /**
   * Export to text
   */
  private exportToText(logs: LogEntry[]): string {
    return logs.map(log => 
      `[${log.timestamp.toISOString()}] ${log.level.toUpperCase()}: ${log.message}${log.component ? ` (${log.component})` : ''}`
    ).join('\n');
  }

  /**
   * Get health status
   */
  async getHealth(): Promise<{ status: string; lastCheck: Date; details?: string }> {
    try {
      const bufferHealth = this.logBuffer.length < this.maxBufferSize * 0.9;
      const storageHealth = this.logStorage.size < 10; // Max 10 days of storage
      
      const isHealthy = this.isRunning && bufferHealth && storageHealth;
      
      return {
        status: isHealthy ? 'healthy' : 'degraded',
        lastCheck: new Date(),
        details: isHealthy ? undefined : 'Buffer or storage nearing capacity',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        lastCheck: new Date(),
        details: error.message,
      };
    }
  }

  /**
   * Update configuration
   */
  async updateConfig(config: ObservabilityConfig): Promise<void> {
    this.config = config;
    
    // Reinitialize logger with new settings
    this.initializeLogger();
    this.setupOutputs();
  }
}

/**
 * Log Analyzer for pattern detection and insights
 */
class LogAnalyzer {
  async start(): Promise<void> {
    // Initialize ML models or pattern detection algorithms
  }

  async stop(): Promise<void> {
    // Cleanup resources
  }

  async analyze(logs: LogEntry[]): Promise<LogAnalysisResult> {
    const errorPatterns = this.findErrorPatterns(logs);
    const performanceInsights = this.analyzePerformance(logs);
    const securityEvents = this.findSecurityEvents(logs);
    const anomalies = this.detectAnomalies(logs);

    return {
      errorPatterns,
      performanceInsights,
      securityEvents,
      anomalies,
    };
  }

  private findErrorPatterns(logs: LogEntry[]) {
    const errorLogs = logs.filter(log => log.level === 'error');
    const patterns = new Map<string, { count: number; lastSeen: Date; examples: LogEntry[] }>();

    for (const log of errorLogs) {
      const pattern = this.extractPattern(log.message);
      
      if (!patterns.has(pattern)) {
        patterns.set(pattern, { count: 0, lastSeen: log.timestamp, examples: [] });
      }
      
      const patternData = patterns.get(pattern)!;
      patternData.count++;
      patternData.lastSeen = log.timestamp;
      
      if (patternData.examples.length < 3) {
        patternData.examples.push(log);
      }
    }

    return Array.from(patterns.entries()).map(([pattern, data]) => ({
      pattern,
      ...data,
    }));
  }

  private analyzePerformance(logs: LogEntry[]) {
    const slowOperations: Array<{ operation: string; averageDuration: number; count: number }> = [];
    const errorRateByComponent: Record<string, number> = {};

    // Analyze slow operations
    const operationDurations = new Map<string, number[]>();
    
    for (const log of logs) {
      if (log.duration && log.component) {
        const key = `${log.component}:${log.message.split(' ')[0]}`;
        if (!operationDurations.has(key)) {
          operationDurations.set(key, []);
        }
        operationDurations.get(key)!.push(log.duration);
      }
    }

    for (const [operation, durations] of operationDurations) {
      const average = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      if (average > 1000) { // Slower than 1 second
        slowOperations.push({
          operation,
          averageDuration: average,
          count: durations.length,
        });
      }
    }

    // Calculate error rates by component
    const componentCounts = new Map<string, { total: number; errors: number }>();
    
    for (const log of logs) {
      if (log.component) {
        if (!componentCounts.has(log.component)) {
          componentCounts.set(log.component, { total: 0, errors: 0 });
        }
        
        const counts = componentCounts.get(log.component)!;
        counts.total++;
        
        if (log.level === 'error') {
          counts.errors++;
        }
      }
    }

    for (const [component, counts] of componentCounts) {
      errorRateByComponent[component] = (counts.errors / counts.total) * 100;
    }

    return {
      slowOperations: slowOperations.sort((a, b) => b.averageDuration - a.averageDuration),
      errorRateByComponent,
    };
  }

  private findSecurityEvents(logs: LogEntry[]): LogEntry[] {
    return logs.filter(log => 
      log.labels?.security_event === 'true' ||
      log.component === 'security' ||
      log.message.toLowerCase().includes('security') ||
      log.message.toLowerCase().includes('authentication') ||
      log.message.toLowerCase().includes('authorization')
    );
  }

  private detectAnomalies(logs: LogEntry[]) {
    const anomalies: Array<{
      type: string;
      description: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      timestamp: Date;
      relatedLogs: LogEntry[];
    }> = [];

    // Detect error rate spikes
    const hourlyErrorCounts = this.groupLogsByHour(logs.filter(l => l.level === 'error'));
    const avgErrorRate = Object.values(hourlyErrorCounts).reduce((sum, count) => sum + count, 0) / Object.keys(hourlyErrorCounts).length;
    
    for (const [hour, count] of Object.entries(hourlyErrorCounts)) {
      if (count > avgErrorRate * 3) { // 3x normal rate
        anomalies.push({
          type: 'error_spike',
          description: `Error rate spike detected: ${count} errors in hour ${hour}`,
          severity: count > avgErrorRate * 5 ? 'critical' : 'high',
          timestamp: new Date(hour),
          relatedLogs: logs.filter(l => l.level === 'error' && l.timestamp.getHours().toString() === hour),
        });
      }
    }

    return anomalies;
  }

  private extractPattern(message: string): string {
    return message
      .replace(/\d+/g, 'N')
      .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, 'UUID')
      .replace(/\/[^\s]+/g, '/PATH')
      .substring(0, 100);
  }

  private groupLogsByHour(logs: LogEntry[]): Record<string, number> {
    const groups: Record<string, number> = {};
    
    for (const log of logs) {
      const hour = log.timestamp.getHours().toString();
      groups[hour] = (groups[hour] || 0) + 1;
    }
    
    return groups;
  }
}

export default LoggingEngine;