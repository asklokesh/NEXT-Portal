// OpenTelemetry distributed tracing implementation
import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { trace, context, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import type { Span, Tracer } from '@opentelemetry/api';

// Tracing configuration
export interface TracingConfig {
  serviceName: string;
  serviceVersion: string;
  environment: string;
  jaegerEndpoint?: string;
  enableConsoleExporter?: boolean;
  enablePrometheusExporter?: boolean;
  enableAutoInstrumentation?: boolean;
  sampleRate?: number;
}

export class OpenTelemetryTracer {
  private sdk: NodeSDK;
  private tracer: Tracer;
  private serviceName: string;

  constructor(config: TracingConfig) {
    this.serviceName = config.serviceName;
    this.sdk = this.createSDK(config);
    this.tracer = trace.getTracer(config.serviceName, config.serviceVersion);
  }

  private createSDK(config: TracingConfig): NodeSDK {
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: config.serviceVersion,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.environment,
      [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'saas-idp',
      [SemanticResourceAttributes.SERVICE_INSTANCE_ID]: process.env.INSTANCE_ID || require('os').hostname(),
    });

    const traceExporters = [];

    // Jaeger exporter for distributed tracing
    if (config.jaegerEndpoint) {
      traceExporters.push(new JaegerExporter({
        endpoint: config.jaegerEndpoint,
      }));
    }

    // Console exporter for development
    if (config.enableConsoleExporter) {
      const { ConsoleSpanExporter } = require('@opentelemetry/exporter-trace-otlp-http');
      traceExporters.push(new ConsoleSpanExporter());
    }

    const metricExporters = [];

    // Prometheus exporter for metrics
    if (config.enablePrometheusExporter) {
      metricExporters.push(new PrometheusExporter({
        endpoint: '/metrics',
        port: 9464,
      }));
    }

    return new NodeSDK({
      resource,
      traceExporter: traceExporters.length > 0 ? traceExporters[0] : undefined, // Use first exporter
      metricReader: metricExporters.length > 0 ? metricExporters[0] : undefined,
      instrumentations: config.enableAutoInstrumentation !== false 
        ? [getNodeAutoInstrumentations({
            '@opentelemetry/instrumentation-fs': {
              enabled: false, // Too noisy for most applications
            },
          })]
        : [],
    });
  }

  // Initialize tracing
  start(): void {
    try {
      this.sdk.start();
      console.log(`OpenTelemetry tracing started for service: ${this.serviceName}`);
    } catch (error) {
      console.error('Failed to start OpenTelemetry:', error);
    }
  }

  // Shutdown tracing
  async shutdown(): Promise<void> {
    try {
      await this.sdk.shutdown();
      console.log('OpenTelemetry tracing shutdown completed');
    } catch (error) {
      console.error('Failed to shutdown OpenTelemetry:', error);
    }
  }

  // Create a new span
  createSpan(name: string, options?: {
    kind?: SpanKind;
    attributes?: Record<string, string | number | boolean>;
    parent?: Span;
  }): Span {
    const spanOptions: any = {
      kind: options?.kind || SpanKind.INTERNAL,
      attributes: options?.attributes || {},
    };

    if (options?.parent) {
      return this.tracer.startSpan(name, spanOptions, trace.setSpan(context.active(), options.parent));
    }

    return this.tracer.startSpan(name, spanOptions);
  }

  // Execute function within a span
  async withSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T> | T,
    options?: {
      kind?: SpanKind;
      attributes?: Record<string, string | number | boolean>;
    }
  ): Promise<T> {
    const span = this.createSpan(name, options);
    
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      span.end();
    }
  }

  // HTTP request tracing
  async traceHttpRequest<T>(
    method: string,
    url: string,
    fn: (span: Span) => Promise<T> | T,
    options?: {
      headers?: Record<string, string>;
      statusCode?: number;
      userId?: string;
      tenantId?: string;
    }
  ): Promise<T> {
    return this.withSpan(
      `HTTP ${method} ${url}`,
      async (span) => {
        // Set HTTP-specific attributes
        span.setAttributes({
          'http.method': method,
          'http.url': url,
          'http.scheme': new URL(url).protocol.slice(0, -1),
          'http.host': new URL(url).host,
          'http.target': new URL(url).pathname + new URL(url).search,
          'user.id': options?.userId || 'unknown',
          'tenant.id': options?.tenantId || 'unknown',
        });

        if (options?.headers) {
          Object.entries(options.headers).forEach(([key, value]) => {
            span.setAttribute(`http.request.header.${key}`, value);
          });
        }

        const result = await fn(span);

        if (options?.statusCode) {
          span.setAttribute('http.status_code', options.statusCode);
          
          if (options.statusCode >= 400) {
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: `HTTP ${options.statusCode}`,
            });
          }
        }

        return result;
      },
      { kind: SpanKind.SERVER }
    );
  }

  // Database operation tracing
  async traceDatabaseOperation<T>(
    operation: string,
    table: string,
    fn: (span: Span) => Promise<T> | T,
    options?: {
      query?: string;
      database?: string;
      userId?: string;
    }
  ): Promise<T> {
    return this.withSpan(
      `DB ${operation} ${table}`,
      async (span) => {
        span.setAttributes({
          'db.operation': operation,
          'db.sql.table': table,
          'db.name': options?.database || 'unknown',
          'db.system': 'postgresql', // Default, could be parameterized
          'user.id': options?.userId || 'unknown',
        });

        if (options?.query) {
          span.setAttribute('db.statement', options.query);
        }

        return await fn(span);
      },
      { kind: SpanKind.CLIENT }
    );
  }

  // Plugin operation tracing
  async tracePluginOperation<T>(
    pluginId: string,
    operation: string,
    fn: (span: Span) => Promise<T> | T,
    options?: {
      version?: string;
      userId?: string;
      tenantId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<T> {
    return this.withSpan(
      `Plugin ${pluginId} ${operation}`,
      async (span) => {
        span.setAttributes({
          'plugin.id': pluginId,
          'plugin.operation': operation,
          'plugin.version': options?.version || 'unknown',
          'user.id': options?.userId || 'unknown',
          'tenant.id': options?.tenantId || 'unknown',
        });

        if (options?.metadata) {
          Object.entries(options.metadata).forEach(([key, value]) => {
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
              span.setAttribute(`plugin.${key}`, value);
            }
          });
        }

        return await fn(span);
      },
      { kind: SpanKind.INTERNAL }
    );
  }

  // Cache operation tracing
  async traceCacheOperation<T>(
    operation: string,
    cacheName: string,
    key: string,
    fn: (span: Span) => Promise<T> | T,
    options?: {
      hit?: boolean;
      ttl?: number;
    }
  ): Promise<T> {
    return this.withSpan(
      `Cache ${operation} ${cacheName}`,
      async (span) => {
        span.setAttributes({
          'cache.operation': operation,
          'cache.name': cacheName,
          'cache.key': key,
        });

        if (typeof options?.hit === 'boolean') {
          span.setAttribute('cache.hit', options.hit);
        }

        if (options?.ttl) {
          span.setAttribute('cache.ttl', options.ttl);
        }

        return await fn(span);
      },
      { kind: SpanKind.CLIENT }
    );
  }

  // Authentication tracing
  async traceAuthentication<T>(
    provider: string,
    method: string,
    fn: (span: Span) => Promise<T> | T,
    options?: {
      userId?: string;
      success?: boolean;
      failureReason?: string;
    }
  ): Promise<T> {
    return this.withSpan(
      `Auth ${provider} ${method}`,
      async (span) => {
        span.setAttributes({
          'auth.provider': provider,
          'auth.method': method,
          'user.id': options?.userId || 'unknown',
        });

        const result = await fn(span);

        if (typeof options?.success === 'boolean') {
          span.setAttribute('auth.success', options.success);
          
          if (!options.success) {
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: options.failureReason || 'Authentication failed',
            });
            
            if (options.failureReason) {
              span.setAttribute('auth.failure_reason', options.failureReason);
            }
          }
        }

        return result;
      },
      { kind: SpanKind.SERVER }
    );
  }

  // WebSocket operation tracing
  async traceWebSocketOperation<T>(
    operation: string,
    namespace: string,
    fn: (span: Span) => Promise<T> | T,
    options?: {
      room?: string;
      userId?: string;
      messageType?: string;
    }
  ): Promise<T> {
    return this.withSpan(
      `WebSocket ${operation} ${namespace}`,
      async (span) => {
        span.setAttributes({
          'websocket.operation': operation,
          'websocket.namespace': namespace,
          'websocket.room': options?.room || 'default',
          'user.id': options?.userId || 'unknown',
        });

        if (options?.messageType) {
          span.setAttribute('websocket.message_type', options.messageType);
        }

        return await fn(span);
      },
      { kind: SpanKind.SERVER }
    );
  }

  // Get current trace and span IDs
  getCurrentTraceId(): string | undefined {
    const span = trace.getActiveSpan();
    return span?.spanContext().traceId;
  }

  getCurrentSpanId(): string | undefined {
    const span = trace.getActiveSpan();
    return span?.spanContext().spanId;
  }

  // Get current span
  getCurrentSpan(): Span | undefined {
    return trace.getActiveSpan();
  }

  // Add event to current span
  addEvent(name: string, attributes?: Record<string, string | number | boolean>): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.addEvent(name, attributes);
    }
  }

  // Set attributes on current span
  setAttributes(attributes: Record<string, string | number | boolean>): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.setAttributes(attributes);
    }
  }

  // Record exception on current span
  recordException(exception: Error): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.recordException(exception);
    }
  }
}

// Global tracer instance
let globalTracer: OpenTelemetryTracer | null = null;

export function initializeTracing(config: TracingConfig): OpenTelemetryTracer {
  if (globalTracer) {
    console.warn('Tracing already initialized');
    return globalTracer;
  }

  globalTracer = new OpenTelemetryTracer(config);
  globalTracer.start();
  
  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    if (globalTracer) {
      await globalTracer.shutdown();
    }
  });

  return globalTracer;
}

export function getTracer(): OpenTelemetryTracer {
  if (!globalTracer) {
    throw new Error('Tracing not initialized. Call initializeTracing() first.');
  }
  return globalTracer;
}

// Export for convenience
export { Span, SpanKind, SpanStatusCode } from '@opentelemetry/api';