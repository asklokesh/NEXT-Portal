// Enterprise-grade structured JSON logging system
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

// Log levels and their numeric values
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  HTTP = 'http',
  VERBOSE = 'verbose',
  DEBUG = 'debug',
  SILLY = 'silly'
}

// Structured log entry interface
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  component: string;
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  tenantId?: string;
  sessionId?: string;
  requestId?: string;
  environment: string;
  version: string;
  hostname: string;
  pid: number;
  metadata?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  performance?: {
    duration: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage?: NodeJS.CpuUsage;
  };
  security?: {
    event: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    actor?: string;
    resource?: string;
    action?: string;
    outcome: 'success' | 'failure' | 'unknown';
    risk_score?: number;
  };
  business?: {
    event: string;
    category: string;
    value?: number;
    currency?: string;
    properties?: Record<string, any>;
  };
}

// Logger configuration
export interface LoggerConfig {
  service: string;
  component?: string;
  level?: LogLevel;
  enableConsole?: boolean;
  enableFile?: boolean;
  enableElasticsearch?: boolean;
  enableStructuredOutput?: boolean;
  filePath?: string;
  elasticsearchUrl?: string;
  elasticsearchIndex?: string;
  correlationId?: string;
  traceId?: string;
  metadata?: Record<string, any>;
}

export class StructuredLogger {
  private logger: winston.Logger;
  private service: string;
  private component: string;
  private correlationId?: string;
  private traceId?: string;
  private defaultMetadata: Record<string, any>;

  constructor(config: LoggerConfig) {
    this.service = config.service;
    this.component = config.component || 'default';
    this.correlationId = config.correlationId;
    this.traceId = config.traceId;
    this.defaultMetadata = config.metadata || {};

    this.logger = this.createLogger(config);
  }

  private createLogger(config: LoggerConfig): winston.Logger {
    const transports: winston.transport[] = [];

    // Console transport
    if (config.enableConsole !== false) {
      transports.push(new winston.transports.Console({
        format: config.enableStructuredOutput !== false 
          ? winston.format.json()
          : winston.format.combine(
              winston.format.colorize(),
              winston.format.timestamp(),
              winston.format.printf(({ timestamp, level, message, ...meta }) => {
                return `${timestamp} [${level}] ${this.service}/${this.component}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
              })
            )
      }));
    }

    // File transport
    if (config.enableFile) {
      transports.push(new winston.transports.File({
        filename: config.filePath || `logs/${this.service}-${this.component}.log`,
        format: winston.format.json()
      }));

      // Separate error log file
      transports.push(new winston.transports.File({
        filename: config.filePath?.replace('.log', '-error.log') || `logs/${this.service}-${this.component}-error.log`,
        level: 'error',
        format: winston.format.json()
      }));
    }

    // Elasticsearch transport (if configured)
    if (config.enableElasticsearch && config.elasticsearchUrl) {
      // Note: In production, you'd use @elastic/ecs-winston-format
      // and winston-elasticsearch packages
      console.warn('Elasticsearch transport not implemented in this example');
    }

    return winston.createLogger({
      level: config.level || LogLevel.INFO,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: {
        service: this.service,
        component: this.component,
        environment: process.env.NODE_ENV || 'development',
        version: process.env.APP_VERSION || '1.0.0',
        hostname: process.env.HOSTNAME || require('os').hostname(),
        pid: process.pid,
        ...this.defaultMetadata
      },
      transports
    });
  }

  // Core logging methods
  error(message: string, error?: Error | any, metadata?: Record<string, any>): void {
    const logEntry = this.createLogEntry(LogLevel.ERROR, message, metadata);
    
    if (error) {
      if (error instanceof Error) {
        logEntry.error = {
          name: error.name,
          message: error.message,
          stack: error.stack,
          code: (error as any).code
        };
      } else {
        logEntry.error = {
          name: 'UnknownError',
          message: String(error)
        };
      }
    }

    this.logger.error(logEntry);
  }

  warn(message: string, metadata?: Record<string, any>): void {
    const logEntry = this.createLogEntry(LogLevel.WARN, message, metadata);
    this.logger.warn(logEntry);
  }

  info(message: string, metadata?: Record<string, any>): void {
    const logEntry = this.createLogEntry(LogLevel.INFO, message, metadata);
    this.logger.info(logEntry);
  }

  debug(message: string, metadata?: Record<string, any>): void {
    const logEntry = this.createLogEntry(LogLevel.DEBUG, message, metadata);
    this.logger.debug(logEntry);
  }

  http(message: string, metadata?: Record<string, any>): void {
    const logEntry = this.createLogEntry(LogLevel.HTTP, message, metadata);
    this.logger.http(logEntry);
  }

  // Specialized logging methods
  security(event: string, severity: LogEntry['security']['severity'], metadata?: {
    actor?: string;
    resource?: string;
    action?: string;
    outcome: LogEntry['security']['outcome'];
    risk_score?: number;
    [key: string]: any;
  }): void {
    const { actor, resource, action, outcome, risk_score, ...otherMetadata } = metadata || {};
    
    const logEntry = this.createLogEntry(LogLevel.INFO, `Security event: ${event}`, otherMetadata);
    logEntry.security = {
      event,
      severity,
      actor,
      resource,
      action,
      outcome: outcome || 'unknown',
      risk_score
    };

    this.logger.info(logEntry);
  }

  business(event: string, category: string, metadata?: {
    value?: number;
    currency?: string;
    properties?: Record<string, any>;
    [key: string]: any;
  }): void {
    const { value, currency, properties, ...otherMetadata } = metadata || {};
    
    const logEntry = this.createLogEntry(LogLevel.INFO, `Business event: ${event}`, otherMetadata);
    logEntry.business = {
      event,
      category,
      value,
      currency,
      properties
    };

    this.logger.info(logEntry);
  }

  performance(message: string, duration: number, metadata?: Record<string, any>): void {
    const logEntry = this.createLogEntry(LogLevel.INFO, message, metadata);
    logEntry.performance = {
      duration,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage?.()
    };

    this.logger.info(logEntry);
  }

  // Request/Response logging
  request(method: string, url: string, metadata?: {
    userId?: string;
    userAgent?: string;
    ip?: string;
    headers?: Record<string, string>;
    body?: any;
    [key: string]: any;
  }): void {
    const logEntry = this.createLogEntry(LogLevel.HTTP, `${method} ${url}`, metadata);
    this.logger.http(logEntry);
  }

  response(method: string, url: string, statusCode: number, duration: number, metadata?: {
    responseSize?: number;
    [key: string]: any;
  }): void {
    const logEntry = this.createLogEntry(
      LogLevel.HTTP, 
      `${method} ${url} - ${statusCode} (${duration}ms)`,
      {
        statusCode,
        duration,
        ...metadata
      }
    );
    
    logEntry.performance = {
      duration,
      memoryUsage: process.memoryUsage()
    };

    this.logger.http(logEntry);
  }

  // Utility methods
  child(additionalMetadata: Record<string, any>): StructuredLogger {
    return new StructuredLogger({
      service: this.service,
      component: this.component,
      enableConsole: true,
      enableFile: false,
      correlationId: this.correlationId,
      traceId: this.traceId,
      metadata: {
        ...this.defaultMetadata,
        ...additionalMetadata
      }
    });
  }

  withCorrelationId(correlationId: string): StructuredLogger {
    this.correlationId = correlationId;
    return this;
  }

  withTraceId(traceId: string): StructuredLogger {
    this.traceId = traceId;
    return this;
  }

  withUser(userId: string, tenantId?: string): StructuredLogger {
    return this.child({
      userId,
      tenantId
    });
  }

  withRequest(requestId: string, sessionId?: string): StructuredLogger {
    return this.child({
      requestId,
      sessionId
    });
  }

  // Helper method to create structured log entry
  private createLogEntry(level: LogLevel, message: string, metadata?: Record<string, any>): any {
    return {
      level,
      message,
      correlationId: this.correlationId,
      traceId: this.traceId,
      ...metadata
    };
  }

  // Flush and close logger
  async close(): Promise<void> {
    return new Promise((resolve) => {
      this.logger.on('finish', resolve);
      this.logger.end();
    });
  }
}

// Global logger factory
const loggers = new Map<string, StructuredLogger>();

export function getLogger(service: string, component?: string, config?: Partial<LoggerConfig>): StructuredLogger {
  const key = `${service}:${component || 'default'}`;
  
  if (!loggers.has(key)) {
    loggers.set(key, new StructuredLogger({
      service,
      component,
      enableConsole: true,
      enableFile: process.env.NODE_ENV === 'production',
      enableStructuredOutput: process.env.NODE_ENV === 'production',
      level: (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO,
      ...config
    }));
  }
  
  return loggers.get(key)!;
}

// Request correlation middleware helper
export function generateCorrelationId(): string {
  return uuidv4();
}

// Export types and enums
export { LogEntry, LoggerConfig };