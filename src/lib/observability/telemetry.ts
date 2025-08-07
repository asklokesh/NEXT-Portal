import { trace, context, SpanStatusCode, SpanKind, metrics } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

// Global SDK instance
let sdk: NodeSDK | null = null;

// Initialize OpenTelemetry SDK
export const initializeObservability = () => {
  if (sdk) {
    return sdk;
  }

  try {
    sdk = new NodeSDK({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'plugin-observability-service',
        [SemanticResourceAttributes.SERVICE_VERSION]: process.env.OTEL_SERVICE_VERSION || '1.0.0',
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
        [SemanticResourceAttributes.SERVICE_NAMESPACE]: process.env.OTEL_SERVICE_NAMESPACE || 'saas-idp',
      }),
      traceExporter: new JaegerExporter({
        endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
      }),
      metricReader: new PeriodicExportingMetricReader({
        exporter: new PrometheusExporter({
          port: parseInt(process.env.PROMETHEUS_PORT || '9090'),
          endpoint: process.env.PROMETHEUS_ENDPOINT || '/metrics',
        }),
        exportIntervalMillis: parseInt(process.env.METRICS_EXPORT_INTERVAL || '5000'),
      }),
      instrumentations: [
        getNodeAutoInstrumentations({
          // Disable some instrumentations that might be noisy
          '@opentelemetry/instrumentation-fs': {
            enabled: false,
          },
        }),
      ],
    });

    sdk.start();
    console.log('✅ OpenTelemetry initialized successfully');
    
    return sdk;
  } catch (error) {
    console.error('❌ Error initializing OpenTelemetry:', error);
    return null;
  }
};

// Get tracer instance
export const getTracer = (name: string = 'plugin-observability', version: string = '1.0.0') => {
  return trace.getTracer(name, version);
};

// Get meter instance
export const getMeter = (name: string = 'plugin-observability', version: string = '1.0.0') => {
  return metrics.getMeter(name, version);
};

// Create span with context
export const createSpan = (tracer: any, name: string, options: any = {}) => {
  return tracer.startSpan(name, {
    kind: SpanKind.SERVER,
    attributes: {
      'service.name': 'plugin-observability',
      'service.version': '1.0.0',
      ...options.attributes,
    },
  });
};

// Propagate trace context from headers
export const propagateTraceContext = (headers: Record<string, string>) => {
  const traceId = headers['x-trace-id'] || headers['traceparent'];
  const spanId = headers['x-span-id'];
  
  if (traceId) {
    // In a real implementation, you would use proper context propagation
    // This is a simplified version for demonstration
    return { traceId, spanId };
  }
  
  return null;
};

// Detect service mesh presence
export const detectServiceMesh = () => {
  return {
    istioEnabled: !!(
      process.env.ISTIO_PROXY_VERSION || 
      process.env.PILOT_ENABLE_WORKLOAD_ENTRY_AUTOREGISTRATION
    ),
    linkerdEnabled: !!(
      process.env.LINKERD2_PROXY_VERSION || 
      process.env.LINKERD_AWAIT_ENABLED
    ),
    consulConnectEnabled: !!(
      process.env.CONSUL_CONNECT_ENABLED || 
      process.env.CONSUL_HTTP_ADDR
    ),
  };
};

// Standard metric definitions
export const createStandardMetrics = (meter: any) => {
  return {
    requestCounter: meter.createCounter('plugin_requests_total', {
      description: 'Total number of plugin requests',
    }),
    responseTimeHistogram: meter.createHistogram('plugin_response_time_ms', {
      description: 'Plugin response time in milliseconds',
      boundaries: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
    }),
    errorCounter: meter.createCounter('plugin_errors_total', {
      description: 'Total number of plugin errors',
    }),
    healthGauge: meter.createGauge('plugin_health_status', {
      description: 'Plugin health status (0=unhealthy, 1=healthy)',
    }),
    memoryGauge: meter.createGauge('plugin_memory_usage_bytes', {
      description: 'Plugin memory usage in bytes',
    }),
    cpuGauge: meter.createGauge('plugin_cpu_usage_percent', {
      description: 'Plugin CPU usage percentage',
    }),
  };
};

// SLO/SLA definitions
export const SLO_DEFINITIONS = {
  availability: {
    target: 99.9,
    window: '30d',
    description: 'Plugin availability over 30 days',
  },
  latency: {
    target: 95,
    threshold: 100,
    window: '24h',
    description: '95% of requests complete within 100ms in 24h',
  },
  errorRate: {
    target: 99.9,
    window: '1h',
    description: '99.9% success rate over 1 hour',
  },
};

// Cleanup function
export const shutdownObservability = async () => {
  if (sdk) {
    try {
      await sdk.shutdown();
      console.log('✅ OpenTelemetry shut down successfully');
    } catch (error) {
      console.error('❌ Error shutting down OpenTelemetry:', error);
    }
  }
};

// Auto-initialize if not in test environment
if (process.env.NODE_ENV !== 'test') {
  initializeObservability();
}