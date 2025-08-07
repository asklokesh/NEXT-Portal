// Observability data generators for demonstration and testing

export interface TraceSpan {
  id: string;
  parentId?: string;
  operationName: string;
  startTime: string;
  duration: number;
  status: 'ok' | 'error' | 'timeout';
  tags: Record<string, any>;
  logs: SpanLog[];
}

export interface SpanLog {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  fields: Record<string, any>;
}

export interface TraceData {
  id: string;
  timestamp: string;
  duration: number;
  status: 'success' | 'error' | 'timeout';
  spans: TraceSpan[];
  tags: Record<string, any>;
}

export interface MetricData {
  timestamp: string;
  value: number;
  labels: Record<string, string>;
}

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  traceId?: string;
  spanId?: string;
  pluginId: string;
  labels: Record<string, string>;
  fields: Record<string, any>;
}

export interface Alert {
  id: string;
  type: 'slo_breach' | 'error_rate' | 'latency' | 'availability' | 'resource_usage';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  timestamp: string;
  pluginId: string;
  threshold?: number;
  currentValue?: number;
  status: 'firing' | 'resolved';
  labels: Record<string, string>;
}

export interface SLOMetrics {
  availability: {
    target: number;
    current: number;
    errorBudget: number;
    errorBudgetRemaining: number;
    status: 'healthy' | 'warning' | 'critical';
  };
  latency: {
    target: number;
    p50: number;
    p95: number;
    p99: number;
    status: 'healthy' | 'warning' | 'critical';
  };
  errorRate: {
    target: number;
    current: number;
    status: 'healthy' | 'warning' | 'critical';
  };
}

export interface ServiceDependency {
  name: string;
  type: 'http' | 'grpc' | 'database' | 'cache' | 'queue';
  endpoint: string;
  health: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  errorRate: number;
  lastChecked: string;
}

// Operation names for different plugin types
const OPERATION_NAMES = {
  'catalog-plugin': [
    'catalog.entity.get',
    'catalog.entity.list',
    'catalog.entity.create',
    'catalog.entity.update',
    'catalog.entity.delete',
    'catalog.relations.get',
    'catalog.metadata.validate',
  ],
  'auth-plugin': [
    'auth.login',
    'auth.logout',
    'auth.token.validate',
    'auth.user.profile',
    'auth.permissions.check',
    'auth.session.create',
    'auth.session.refresh',
  ],
  'ci-cd-plugin': [
    'cicd.pipeline.trigger',
    'cicd.pipeline.status',
    'cicd.build.create',
    'cicd.build.logs',
    'cicd.deployment.start',
    'cicd.deployment.status',
    'cicd.artifacts.upload',
  ],
  'monitoring-plugin': [
    'monitoring.metrics.collect',
    'monitoring.alerts.create',
    'monitoring.dashboards.render',
    'monitoring.health.check',
    'monitoring.logs.query',
  ],
};

// Generate realistic span logs
export const generateSpanLogs = (operationName: string, spanStatus: string): SpanLog[] => {
  const logs: SpanLog[] = [
    {
      timestamp: new Date(Date.now() - Math.random() * 1000).toISOString(),
      level: 'info',
      message: `Starting ${operationName}`,
      fields: { phase: 'start' },
    },
  ];

  // Add processing logs
  if (Math.random() > 0.7) {
    logs.push({
      timestamp: new Date(Date.now() - Math.random() * 500).toISOString(),
      level: 'debug',
      message: `Processing ${operationName}`,
      fields: { phase: 'processing', step: 1 },
    });
  }

  // Add error logs if span failed
  if (spanStatus === 'error') {
    logs.push({
      timestamp: new Date(Date.now() - Math.random() * 100).toISOString(),
      level: 'error',
      message: `Error in ${operationName}: Database connection timeout`,
      fields: { error_code: 'DB_TIMEOUT', phase: 'error' },
    });
  }

  // Add completion log
  logs.push({
    timestamp: new Date().toISOString(),
    level: spanStatus === 'error' ? 'error' : 'info',
    message: `Completed ${operationName}`,
    fields: { phase: 'complete', status: spanStatus },
  });

  return logs;
};

// Generate realistic trace spans
export const generateTraceSpans = (pluginId: string, count: number = 5): TraceSpan[] => {
  const operationNames = OPERATION_NAMES[pluginId as keyof typeof OPERATION_NAMES] || [
    'plugin.operation.execute',
    'plugin.data.fetch',
    'plugin.data.process',
    'plugin.response.format',
  ];

  const spans: TraceSpan[] = [];
  let currentTime = Date.now();

  for (let i = 0; i < count; i++) {
    const operationName = operationNames[Math.floor(Math.random() * operationNames.length)];
    const status = Math.random() > 0.1 ? 'ok' : 'error';
    const duration = Math.floor(Math.random() * 200) + 10;
    const startTime = new Date(currentTime - duration).toISOString();

    const span: TraceSpan = {
      id: `span-${pluginId}-${i}`,
      parentId: i > 0 ? `span-${pluginId}-${i - 1}` : undefined,
      operationName,
      startTime,
      duration,
      status,
      tags: {
        component: pluginId,
        'span.kind': i === 0 ? 'server' : 'internal',
        'plugin.version': '1.0.0',
        'service.name': pluginId,
        ...(status === 'error' && { 'error': true, 'error.kind': 'database_timeout' }),
      },
      logs: generateSpanLogs(operationName, status),
    };

    spans.push(span);
    currentTime += duration;
  }

  return spans;
};

// Generate distributed traces
export const generateDistributedTraces = (pluginId: string, count: number = 10): TraceData[] => {
  return Array.from({ length: count }, (_, i) => {
    const spans = generateTraceSpans(pluginId, 3 + Math.floor(Math.random() * 5));
    const totalDuration = spans.reduce((sum, span) => sum + span.duration, 0);
    const hasError = spans.some(span => span.status === 'error');

    return {
      id: `trace-${pluginId}-${Date.now()}-${i}`,
      timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString(),
      duration: totalDuration,
      status: hasError ? 'error' : Math.random() > 0.05 ? 'success' : 'timeout',
      spans,
      tags: {
        plugin_id: pluginId,
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0',
        user_id: `user-${Math.floor(Math.random() * 1000)}`,
        request_id: `req-${Date.now()}-${i}`,
      },
    };
  });
};

// Generate time series metrics with realistic patterns
export const generateTimeSeriesMetrics = (
  pluginId: string,
  metricType: string,
  duration: number = 3600, // 1 hour in seconds
  interval: number = 60 // 1 minute
): MetricData[] => {
  const points = Math.floor(duration / interval);
  const now = Date.now();
  
  // Base values and patterns for different metrics
  const metricPatterns = {
    requests: { base: 100, variance: 30, trend: 0.1 },
    responseTime: { base: 50, variance: 20, trend: 0.05 },
    errorRate: { base: 1, variance: 2, trend: 0.02 },
    memory: { base: 128 * 1024 * 1024, variance: 32 * 1024 * 1024, trend: 0.001 },
    cpu: { base: 25, variance: 15, trend: 0.05 },
    diskIO: { base: 1024 * 1024, variance: 512 * 1024, trend: 0.02 },
    networkIO: { base: 2 * 1024 * 1024, variance: 1024 * 1024, trend: 0.01 },
  };

  const pattern = metricPatterns[metricType as keyof typeof metricPatterns] || metricPatterns.requests;

  return Array.from({ length: points }, (_, i) => {
    const timestamp = new Date(now - (points - i) * interval * 1000).toISOString();
    
    // Add realistic patterns: daily cycle, random spikes, gradual trends
    const timeOfDay = (i * interval) % (24 * 3600); // seconds in day
    const dailyCycle = Math.sin((timeOfDay / (24 * 3600)) * 2 * Math.PI) * 0.3;
    const randomSpike = Math.random() > 0.95 ? Math.random() * 2 : 0;
    const trend = pattern.trend * i;
    const noise = (Math.random() - 0.5) * pattern.variance;

    let value = pattern.base + 
                (pattern.base * dailyCycle) + 
                (pattern.base * randomSpike) + 
                (pattern.base * trend) + 
                noise;

    // Ensure non-negative values and apply metric-specific constraints
    value = Math.max(0, value);
    if (metricType === 'errorRate') {
      value = Math.min(100, value); // Cap error rate at 100%
    } else if (metricType === 'cpu') {
      value = Math.min(100, value); // Cap CPU at 100%
    }

    return {
      timestamp,
      value,
      labels: {
        plugin_id: pluginId,
        metric_type: metricType,
        environment: process.env.NODE_ENV || 'development',
      },
    };
  });
};

// Generate comprehensive plugin metrics
export const generatePluginMetrics = (pluginId: string) => {
  return {
    requests: generateTimeSeriesMetrics(pluginId, 'requests'),
    responseTime: generateTimeSeriesMetrics(pluginId, 'responseTime'),
    errorRate: generateTimeSeriesMetrics(pluginId, 'errorRate'),
    memory: generateTimeSeriesMetrics(pluginId, 'memory'),
    cpu: generateTimeSeriesMetrics(pluginId, 'cpu'),
    diskIO: generateTimeSeriesMetrics(pluginId, 'diskIO'),
    networkIO: generateTimeSeriesMetrics(pluginId, 'networkIO'),
  };
};

// Generate log entries with correlation to traces
export const generateCorrelatedLogs = (
  pluginId: string,
  traces: TraceData[],
  additionalCount: number = 50
): LogEntry[] => {
  const logs: LogEntry[] = [];
  const levels: Array<'debug' | 'info' | 'warn' | 'error'> = ['debug', 'info', 'warn', 'error'];
  const levelWeights = [0.3, 0.5, 0.15, 0.05]; // Distribution of log levels

  // Generate logs correlated with traces
  traces.forEach(trace => {
    trace.spans.forEach(span => {
      // Add logs for each span
      if (Math.random() > 0.6) {
        const level = span.status === 'error' ? 'error' : 
                     Math.random() > 0.8 ? 'warn' : 'info';
        
        logs.push({
          timestamp: span.startTime,
          level,
          message: `${span.operationName} ${span.status === 'error' ? 'failed' : 'completed'} in ${span.duration}ms`,
          traceId: trace.id,
          spanId: span.id,
          pluginId,
          labels: {
            environment: process.env.NODE_ENV || 'development',
            service: pluginId,
            operation: span.operationName,
          },
          fields: {
            duration_ms: span.duration,
            status: span.status,
            ...span.tags,
          },
        });
      }
    });
  });

  // Generate additional standalone logs
  for (let i = 0; i < additionalCount; i++) {
    const level = levels[
      levelWeights.findIndex((weight, index) => 
        Math.random() < levelWeights.slice(0, index + 1).reduce((a, b) => a + b)
      )
    ] || 'info';

    logs.push({
      timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString(),
      level,
      message: generateLogMessage(pluginId, level),
      pluginId,
      labels: {
        environment: process.env.NODE_ENV || 'development',
        service: pluginId,
      },
      fields: {
        userId: `user-${Math.floor(Math.random() * 100)}`,
        requestId: `req-${i}`,
        sessionId: `session-${Math.floor(Math.random() * 50)}`,
      },
    });
  }

  return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

// Generate contextual log messages
const generateLogMessage = (pluginId: string, level: string): string => {
  const messageTemplates = {
    debug: [
      `[${pluginId}] Processing request with parameters`,
      `[${pluginId}] Cache lookup performed`,
      `[${pluginId}] Database query executed`,
      `[${pluginId}] Validation completed successfully`,
    ],
    info: [
      `[${pluginId}] Request processed successfully`,
      `[${pluginId}] Configuration loaded`,
      `[${pluginId}] Service started`,
      `[${pluginId}] Health check passed`,
    ],
    warn: [
      `[${pluginId}] High response time detected`,
      `[${pluginId}] Cache miss rate elevated`,
      `[${pluginId}] Retry attempt initiated`,
      `[${pluginId}] Deprecated API usage detected`,
    ],
    error: [
      `[${pluginId}] Database connection failed`,
      `[${pluginId}] Request validation failed`,
      `[${pluginId}] External service unavailable`,
      `[${pluginId}] Authentication failed`,
    ],
  };

  const templates = messageTemplates[level as keyof typeof messageTemplates] || messageTemplates.info;
  return templates[Math.floor(Math.random() * templates.length)];
};

// Generate alerts based on metrics and traces
export const generateContextualAlerts = (
  pluginId: string,
  metrics: any,
  traces: TraceData[]
): Alert[] => {
  const alerts: Alert[] = [];

  // Analyze metrics for threshold breaches
  const latestMetrics = {
    responseTime: metrics.responseTime[metrics.responseTime.length - 1]?.value || 0,
    errorRate: metrics.errorRate[metrics.errorRate.length - 1]?.value || 0,
    cpu: metrics.cpu[metrics.cpu.length - 1]?.value || 0,
    memory: metrics.memory[metrics.memory.length - 1]?.value || 0,
  };

  // Response time alert
  if (latestMetrics.responseTime > 100) {
    alerts.push({
      id: `alert-${pluginId}-latency-${Date.now()}`,
      type: 'latency',
      severity: latestMetrics.responseTime > 500 ? 'critical' : 'warning',
      title: 'High Response Time Detected',
      description: `Plugin ${pluginId} response time (${Math.round(latestMetrics.responseTime)}ms) exceeded threshold`,
      timestamp: new Date(Date.now() - Math.random() * 300000).toISOString(),
      pluginId,
      threshold: 100,
      currentValue: latestMetrics.responseTime,
      status: Math.random() > 0.3 ? 'firing' : 'resolved',
      labels: { severity: 'warning', type: 'latency', plugin: pluginId },
    });
  }

  // Error rate alert
  if (latestMetrics.errorRate > 5) {
    alerts.push({
      id: `alert-${pluginId}-errors-${Date.now()}`,
      type: 'error_rate',
      severity: latestMetrics.errorRate > 10 ? 'critical' : 'warning',
      title: 'High Error Rate Detected',
      description: `Plugin ${pluginId} error rate (${latestMetrics.errorRate.toFixed(1)}%) exceeded threshold`,
      timestamp: new Date(Date.now() - Math.random() * 600000).toISOString(),
      pluginId,
      threshold: 5,
      currentValue: latestMetrics.errorRate,
      status: Math.random() > 0.4 ? 'firing' : 'resolved',
      labels: { severity: 'critical', type: 'error_rate', plugin: pluginId },
    });
  }

  // Resource usage alerts
  if (latestMetrics.cpu > 80) {
    alerts.push({
      id: `alert-${pluginId}-cpu-${Date.now()}`,
      type: 'resource_usage',
      severity: 'warning',
      title: 'High CPU Usage',
      description: `Plugin ${pluginId} CPU usage (${Math.round(latestMetrics.cpu)}%) is high`,
      timestamp: new Date(Date.now() - Math.random() * 900000).toISOString(),
      pluginId,
      threshold: 80,
      currentValue: latestMetrics.cpu,
      status: 'firing',
      labels: { severity: 'warning', type: 'resource_usage', resource: 'cpu', plugin: pluginId },
    });
  }

  return alerts;
};

// Calculate SLO metrics based on actual data
export const calculateSLOMetrics = (
  pluginId: string,
  metrics: any,
  traces: TraceData[]
): SLOMetrics => {
  const errorTraces = traces.filter(t => t.status === 'error').length;
  const totalTraces = traces.length;
  const errorRate = totalTraces > 0 ? (errorTraces / totalTraces) * 100 : 0;

  // Calculate percentiles from response times
  const responseTimes = traces.map(t => t.duration).sort((a, b) => a - b);
  const p50 = responseTimes[Math.floor(responseTimes.length * 0.5)] || 0;
  const p95 = responseTimes[Math.floor(responseTimes.length * 0.95)] || 0;
  const p99 = responseTimes[Math.floor(responseTimes.length * 0.99)] || 0;

  return {
    availability: {
      target: 99.9,
      current: Math.max(95, 100 - errorRate),
      errorBudget: 0.1,
      errorBudgetRemaining: Math.max(0, 0.1 - errorRate / 100),
      status: errorRate < 0.1 ? 'healthy' : errorRate < 1 ? 'warning' : 'critical',
    },
    latency: {
      target: 95,
      p50,
      p95,
      p99,
      status: p95 < 100 ? 'healthy' : p95 < 200 ? 'warning' : 'critical',
    },
    errorRate: {
      target: 99.9,
      current: Math.max(95, 100 - errorRate),
      status: errorRate < 0.1 ? 'healthy' : errorRate < 1 ? 'warning' : 'critical',
    },
  };
};

// Generate service dependencies
export const generateServiceDependencies = (pluginId: string): ServiceDependency[] => {
  const commonDependencies = [
    {
      name: 'postgres-db',
      type: 'database' as const,
      endpoint: 'postgres://localhost:5432/plugin_db',
      health: 'healthy' as const,
      latency: 5 + Math.random() * 20,
      errorRate: Math.random() * 0.5,
    },
    {
      name: 'redis-cache',
      type: 'cache' as const,
      endpoint: 'redis://localhost:6379',
      health: 'healthy' as const,
      latency: 1 + Math.random() * 5,
      errorRate: Math.random() * 0.1,
    },
  ];

  // Plugin-specific dependencies
  const pluginSpecificDeps = {
    'catalog-plugin': [
      {
        name: 'github-api',
        type: 'http' as const,
        endpoint: 'https://api.github.com/v3',
        health: 'healthy' as const,
        latency: 50 + Math.random() * 100,
        errorRate: Math.random() * 1,
      },
    ],
    'auth-plugin': [
      {
        name: 'oauth-provider',
        type: 'http' as const,
        endpoint: 'https://oauth.provider.com/v2',
        health: 'degraded' as const,
        latency: 100 + Math.random() * 200,
        errorRate: 1 + Math.random() * 3,
      },
    ],
    'ci-cd-plugin': [
      {
        name: 'jenkins-api',
        type: 'http' as const,
        endpoint: 'https://jenkins.company.com/api',
        health: 'healthy' as const,
        latency: 75 + Math.random() * 150,
        errorRate: Math.random() * 2,
      },
      {
        name: 'artifact-storage',
        type: 'http' as const,
        endpoint: 'https://artifacts.company.com/v1',
        health: 'healthy' as const,
        latency: 25 + Math.random() * 50,
        errorRate: Math.random() * 0.5,
      },
    ],
  };

  const specificDeps = pluginSpecificDeps[pluginId as keyof typeof pluginSpecificDeps] || [];

  return [...commonDependencies, ...specificDeps].map(dep => ({
    ...dep,
    lastChecked: new Date(Date.now() - Math.random() * 60000).toISOString(),
  }));
};