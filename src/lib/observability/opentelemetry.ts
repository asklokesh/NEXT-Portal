/**
 * OpenTelemetry Distributed Tracing Implementation
 * Advanced observability with metrics, traces, and logs
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

// Tracer and Meter imports
import { trace, metrics, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import type { Span, Tracer } from '@opentelemetry/api';
import type { Meter, Counter, Histogram, UpDownCounter } from '@opentelemetry/api';

// Configuration interface
interface TelemetryConfig {
  serviceName: string;
  serviceVersion: string;
  environment: string;
  jaegerEndpoint?: string;
  prometheusEndpoint?: string;
  samplingRatio?: number;
  enableAutoInstrumentation?: boolean;
  enableConsoleExport?: boolean;
  customTags?: Record<string, string>;
}

/**
 * OpenTelemetry Configuration and Setup
 */
export class TelemetryManager {
  private sdk?: NodeSDK;
  private tracer?: Tracer;
  private meter?: Meter;
  private initialized = false;
  private config: TelemetryConfig;

  // Metrics
  private requestCounter?: Counter;
  private requestDuration?: Histogram;
  private activeConnections?: UpDownCounter;
  private errorCounter?: Counter;
  private sagaExecutions?: Counter;
  private eventStoreOperations?: Counter;

  constructor(config: TelemetryConfig) {
    this.config = {
      samplingRatio: 0.1,
      enableAutoInstrumentation: true,
      enableConsoleExport: false,
      ...config
    };
  }

  /**
   * Initialize OpenTelemetry
   */
  initialize(): void {
    if (this.initialized) {
      console.warn('Telemetry already initialized');
      return;
    }

    try {
      // Create resource with service information
      const resource = new Resource({
        [SEMRESATTRS_SERVICE_NAME]: this.config.serviceName,
        [SEMRESATTRS_SERVICE_VERSION]: this.config.serviceVersion,
        'environment': this.config.environment,
        ...this.config.customTags
      });

      // Configure SDK
      this.sdk = new NodeSDK({
        resource,
        instrumentations: this.config.enableAutoInstrumentation 
          ? [getNodeAutoInstrumentations({
              '@opentelemetry/instrumentation-http': {
                ignorePaths: ['/health', '/metrics', '/favicon.ico']
              },
              '@opentelemetry/instrumentation-express': {},
              '@opentelemetry/instrumentation-graphql': {},
              '@opentelemetry/instrumentation-redis': {},
              '@opentelemetry/instrumentation-pg': {}
            })]
          : [],
        
        // Metrics configuration
        metricReader: new PeriodicExportingMetricReader({
          exporter: this.createMetricExporter(),
          exportIntervalMillis: 30000 // Export every 30 seconds
        }),

        // Trace configuration would go here
        // traceProcessor: this.createTraceProcessor(),
      });

      // Start the SDK
      this.sdk.start();

      // Initialize tracer and meter
      this.tracer = trace.getTracer(this.config.serviceName, this.config.serviceVersion);
      this.meter = metrics.getMeter(this.config.serviceName, this.config.serviceVersion);

      // Initialize custom metrics
      this.initializeMetrics();

      this.initialized = true;
      console.log(`OpenTelemetry initialized for ${this.config.serviceName}`);

    } catch (error) {
      console.error('Failed to initialize OpenTelemetry:', error);
      throw error;
    }
  }

  /**
   * Shutdown telemetry
   */
  async shutdown(): Promise<void> {
    if (this.sdk) {
      await this.sdk.shutdown();
      this.initialized = false;
      console.log('OpenTelemetry shutdown completed');
    }
  }

  /**
   * Initialize custom metrics
   */
  private initializeMetrics(): void {
    if (!this.meter) return;

    this.requestCounter = this.meter.createCounter('http_requests_total', {
      description: 'Total number of HTTP requests'
    });

    this.requestDuration = this.meter.createHistogram('http_request_duration_ms', {
      description: 'HTTP request duration in milliseconds'
    });

    this.activeConnections = this.meter.createUpDownCounter('active_connections', {
      description: 'Number of active connections'
    });

    this.errorCounter = this.meter.createCounter('errors_total', {
      description: 'Total number of errors'
    });

    this.sagaExecutions = this.meter.createCounter('saga_executions_total', {
      description: 'Total number of saga executions'
    });

    this.eventStoreOperations = this.meter.createCounter('event_store_operations_total', {
      description: 'Total number of event store operations'
    });
  }

  /**
   * Create metric exporter based on configuration
   */
  private createMetricExporter(): any {
    if (this.config.enableConsoleExport) {
      // For development - console export
      const { ConsoleMetricExporter } = require('@opentelemetry/sdk-metrics');
      return new ConsoleMetricExporter();
    }

    if (this.config.prometheusEndpoint) {
      // Prometheus export
      const { PrometheusExporter } = require('@opentelemetry/exporter-prometheus');
      return new PrometheusExporter({
        endpoint: this.config.prometheusEndpoint
      });
    }

    // Default console exporter
    const { ConsoleMetricExporter } = require('@opentelemetry/sdk-metrics');
    return new ConsoleMetricExporter();
  }

  /**
   * Create a new span
   */
  createSpan(name: string, options?: {
    kind?: SpanKind;
    attributes?: Record<string, string | number | boolean>;
    parent?: Span;
  }): Span | null {
    if (!this.tracer) return null;

    const span = this.tracer.startSpan(name, {
      kind: options?.kind || SpanKind.INTERNAL,
      attributes: options?.attributes
    }, options?.parent ? trace.setSpan(context.active(), options.parent) : undefined);

    return span;
  }

  /**
   * Execute function with tracing
   */
  async traced<T>(
    spanName: string,
    fn: (span: Span) => Promise<T> | T,
    options?: {
      kind?: SpanKind;
      attributes?: Record<string, string | number | boolean>;
    }
  ): Promise<T> {
    const span = this.createSpan(spanName, options);
    
    if (!span) {
      return await fn({} as Span); // Fallback if tracing not available
    }

    try {
      const result = await context.with(trace.setSpan(context.active(), span), () => fn(span));
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error)
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Record HTTP request metrics
   */
  recordHttpRequest(method: string, route: string, statusCode: number, duration: number): void {
    const labels = { method, route, status_code: statusCode.toString() };
    
    this.requestCounter?.add(1, labels);
    this.requestDuration?.record(duration, labels);
    
    if (statusCode >= 400) {
      this.errorCounter?.add(1, { type: 'http_error', ...labels });
    }
  }

  /**
   * Record saga execution metrics
   */
  recordSagaExecution(sagaType: string, status: string, duration?: number): void {
    const labels = { saga_type: sagaType, status };
    
    this.sagaExecutions?.add(1, labels);
    
    if (status === 'failed' || status === 'compensated') {
      this.errorCounter?.add(1, { type: 'saga_error', ...labels });
    }
  }

  /**
   * Record event store operation metrics
   */
  recordEventStoreOperation(operation: string, aggregateType: string, success: boolean): void {
    const labels = { 
      operation, 
      aggregate_type: aggregateType, 
      success: success.toString() 
    };
    
    this.eventStoreOperations?.add(1, labels);
    
    if (!success) {
      this.errorCounter?.add(1, { type: 'event_store_error', ...labels });
    }
  }

  /**
   * Record active connection change
   */
  recordConnectionChange(change: number, connectionType = 'http'): void {
    this.activeConnections?.add(change, { type: connectionType });
  }

  /**
   * Record custom metric
   */
  recordCustomMetric(
    metricName: string, 
    value: number, 
    labels: Record<string, string> = {}
  ): void {
    // Create or get custom metric
    const metric = this.meter?.createCounter(metricName);
    metric?.add(value, labels);
  }

  /**
   * Add attributes to current span
   */
  addSpanAttributes(attributes: Record<string, string | number | boolean>): void {
    const currentSpan = trace.getActiveSpan();
    if (currentSpan) {
      currentSpan.setAttributes(attributes);
    }
  }

  /**
   * Add event to current span
   */
  addSpanEvent(name: string, attributes?: Record<string, string | number | boolean>): void {
    const currentSpan = trace.getActiveSpan();
    if (currentSpan) {
      currentSpan.addEvent(name, attributes);
    }
  }

  /**
   * Set span status
   */
  setSpanStatus(code: SpanStatusCode, message?: string): void {
    const currentSpan = trace.getActiveSpan();
    if (currentSpan) {
      currentSpan.setStatus({ code, message });
    }
  }

  /**
   * Record exception in current span
   */
  recordException(error: Error): void {
    const currentSpan = trace.getActiveSpan();
    if (currentSpan) {
      currentSpan.recordException(error);
      currentSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message
      });
    }
  }

  /**
   * Get current trace ID
   */
  getCurrentTraceId(): string | undefined {
    const currentSpan = trace.getActiveSpan();
    return currentSpan?.spanContext().traceId;
  }

  /**
   * Get current span ID
   */
  getCurrentSpanId(): string | undefined {
    const currentSpan = trace.getActiveSpan();
    return currentSpan?.spanContext().spanId;
  }

  /**
   * Create child span from current context
   */
  createChildSpan(name: string, attributes?: Record<string, string | number | boolean>): Span | null {
    return this.createSpan(name, { attributes });
  }
}

/**
 * Middleware for automatic HTTP request tracing
 */
export function createTracingMiddleware(telemetry: TelemetryManager) {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();
    
    // Record connection
    telemetry.recordConnectionChange(1);
    
    // Create span for request
    const span = telemetry.createSpan(`${req.method} ${req.route?.path || req.path}`, {
      kind: SpanKind.SERVER,
      attributes: {
        'http.method': req.method,
        'http.url': req.url,
        'http.route': req.route?.path || req.path,
        'http.user_agent': req.get('User-Agent') || '',
        'tenant.id': req.headers['x-tenant-id'] || 'unknown'
      }
    });

    // Wrap response end to capture metrics
    const originalEnd = res.end;
    res.end = function(...args: any[]) {
      const duration = Date.now() - startTime;
      
      // Record metrics
      telemetry.recordHttpRequest(
        req.method,
        req.route?.path || req.path,
        res.statusCode,
        duration
      );
      
      // Update span
      if (span) {
        span.setAttributes({
          'http.status_code': res.statusCode,
          'http.response_size': res.get('content-length') || 0
        });
        
        if (res.statusCode >= 400) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: `HTTP ${res.statusCode}`
          });
        }
        
        span.end();
      }
      
      // Record connection close
      telemetry.recordConnectionChange(-1);
      
      originalEnd.apply(res, args);
    };

    next();
  };
}

/**
 * Decorator for automatic method tracing
 */
export function Traced(spanName?: string) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const name = spanName || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function(...args: any[]) {
      const telemetry = getTelemetryManager();
      
      if (!telemetry) {
        return originalMethod.apply(this, args);
      }

      return telemetry.traced(name, async (span) => {
        span.setAttributes({
          'method.class': target.constructor.name,
          'method.name': propertyKey,
          'method.args_count': args.length
        });

        return originalMethod.apply(this, args);
      });
    };

    return descriptor;
  };
}

// Global telemetry manager instance
let globalTelemetryManager: TelemetryManager | null = null;

/**
 * Initialize global telemetry
 */
export function initializeTelemetry(config: TelemetryConfig): TelemetryManager {
  if (globalTelemetryManager) {
    console.warn('Telemetry already initialized globally');
    return globalTelemetryManager;
  }

  globalTelemetryManager = new TelemetryManager(config);
  globalTelemetryManager.initialize();
  
  return globalTelemetryManager;
}

/**
 * Get global telemetry manager
 */
export function getTelemetryManager(): TelemetryManager | null {
  return globalTelemetryManager;
}

/**
 * Shutdown global telemetry
 */
export async function shutdownTelemetry(): Promise<void> {
  if (globalTelemetryManager) {
    await globalTelemetryManager.shutdown();
    globalTelemetryManager = null;
  }
}

// Export configuration for default setup
export const defaultTelemetryConfig: TelemetryConfig = {
  serviceName: 'next-portal',
  serviceVersion: '1.0.0',
  environment: process.env.NODE_ENV || 'development',
  jaegerEndpoint: process.env.JAEGER_ENDPOINT,
  prometheusEndpoint: process.env.PROMETHEUS_ENDPOINT,
  samplingRatio: parseFloat(process.env.TELEMETRY_SAMPLING_RATIO || '0.1'),
  enableAutoInstrumentation: process.env.TELEMETRY_AUTO_INSTRUMENT !== 'false',
  enableConsoleExport: process.env.NODE_ENV === 'development',
  customTags: {
    'service.namespace': 'next-portal',
    'service.instance.id': process.env.HOSTNAME || 'unknown'
  }
};

export default TelemetryManager;