// RUM (Real User Monitoring) metrics collection endpoint
import { NextRequest, NextResponse } from 'next/server';
import { getPrometheusMetrics } from '@/lib/monitoring/PrometheusMetrics';
import { getLogger } from '@/lib/logging/StructuredLogger';

const metrics = getPrometheusMetrics();
const logger = getLogger('rum', 'api');

// Rate limiting for RUM endpoints
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 1000; // Max requests per minute per IP

export async function POST(request: NextRequest) {
  try {
    const startTime = Date.now();
    const clientIP = getClientIP(request);
    
    // Rate limiting
    if (!checkRateLimit(clientIP)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const {
      type,
      timestamp,
      url,
      userAgent,
      userId,
      tenantId,
      sessionId,
      ...data
    } = body;

    // Validate required fields
    if (!type || !timestamp || !url) {
      return NextResponse.json(
        { error: 'Missing required fields: type, timestamp, url' },
        { status: 400 }
      );
    }

    // Process different types of RUM metrics
    await processRUMMetric(type, {
      timestamp,
      url,
      userAgent,
      userId,
      tenantId,
      sessionId,
      clientIP,
      ...data
    });

    const duration = Date.now() - startTime;

    // Record API metrics
    metrics.recordHttpRequest('POST', '/api/rum/metrics', 200, duration, userId, tenantId);

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    const duration = Date.now() - Date.now();
    
    logger.error('RUM metrics processing failed', error instanceof Error ? error : new Error(String(error)), {
      url: request.url,
      method: request.method
    });

    metrics.recordHttpRequest('POST', '/api/rum/metrics', 500, duration);
    metrics.recordError('rum_api', 'processing_failed', 'critical', 'api');

    return NextResponse.json(
      { error: 'Failed to process metrics' },
      { status: 500 }
    );
  }
}

async function processRUMMetric(type: string, data: any): Promise<void> {
  const {
    timestamp,
    url,
    userAgent,
    userId = 'anonymous',
    tenantId = 'default',
    sessionId,
    clientIP,
    ...metricData
  } = data;

  // Common labels for all metrics
  const labels = {
    user_id: userId,
    tenant_id: tenantId,
    url_path: getUrlPath(url)
  };

  switch (type) {
    case 'navigation_timing':
      await processNavigationTiming(metricData, labels);
      break;
    
    case 'web_vitals_fcp':
    case 'web_vitals_lcp':
    case 'web_vitals_fid':
    case 'web_vitals_cls':
    case 'web_vitals_ttfb':
      await processWebVital(type, metricData, labels);
      break;
    
    case 'resource_timing':
      await processResourceTiming(metricData, labels);
      break;
    
    case 'frontend_error':
      await processFrontendError(metricData, labels, url, userAgent);
      break;
    
    case 'user_interaction':
      await processUserInteraction(metricData, labels);
      break;
    
    case 'page_visibility':
      await processPageVisibility(metricData, labels);
      break;
    
    case 'custom_metric':
      await processCustomMetric(metricData, labels);
      break;
    
    default:
      logger.warn('Unknown RUM metric type', { type, url });
  }

  // Log the metric for structured logging
  logger.info('RUM metric processed', {
    type,
    url,
    userId,
    tenantId,
    sessionId,
    clientIP,
    ...metricData
  });
}

async function processNavigationTiming(data: any, labels: any): Promise<void> {
  const {
    dns,
    tcp,
    ssl,
    request,
    response,
    dom,
    load,
    total
  } = data;

  // Record navigation timing metrics
  if (dns !== undefined) {
    metrics.httpRequestDuration.observe({ ...labels, phase: 'dns' }, dns / 1000);
  }
  
  if (tcp !== undefined) {
    metrics.httpRequestDuration.observe({ ...labels, phase: 'tcp' }, tcp / 1000);
  }
  
  if (ssl !== undefined && ssl > 0) {
    metrics.httpRequestDuration.observe({ ...labels, phase: 'ssl' }, ssl / 1000);
  }
  
  if (request !== undefined) {
    metrics.httpRequestDuration.observe({ ...labels, phase: 'request' }, request / 1000);
  }
  
  if (response !== undefined) {
    metrics.httpRequestDuration.observe({ ...labels, phase: 'response' }, response / 1000);
  }
  
  if (dom !== undefined) {
    metrics.httpRequestDuration.observe({ ...labels, phase: 'dom' }, dom / 1000);
  }
  
  if (load !== undefined) {
    metrics.httpRequestDuration.observe({ ...labels, phase: 'load' }, load / 1000);
  }
  
  if (total !== undefined) {
    metrics.httpRequestDuration.observe({ ...labels, phase: 'total' }, total / 1000);
  }
}

async function processWebVital(type: string, data: any, labels: any): Promise<void> {
  const { value, rating } = data;
  const vitalName = type.replace('web_vitals_', '').toUpperCase();

  // Create a gauge for the web vital value
  metrics.systemHealthScore.set({
    ...labels,
    vital: vitalName,
    rating: rating || 'unknown'
  }, value);

  // Log poor web vitals
  if (rating === 'poor') {
    metrics.recordError('web_vitals', 'poor_performance', 'warning', 'frontend');
    
    logger.warn(`Poor Web Vital detected: ${vitalName}`, {
      vital: vitalName,
      value,
      rating,
      url: labels.url_path
    });
  }
}

async function processResourceTiming(data: any, labels: any): Promise<void> {
  const { resourceType, duration, size } = data;

  // Record resource loading metrics
  metrics.httpRequestDuration.observe({
    ...labels,
    resource_type: resourceType
  }, duration / 1000);

  if (size > 0) {
    metrics.httpResponseSize.observe({
      ...labels,
      resource_type: resourceType
    }, size);
  }

  // Alert on slow resources
  if (duration > 5000) { // 5 seconds
    metrics.recordError('resource_loading', 'slow_resource', 'warning', 'frontend');
    
    logger.warn('Slow resource loading detected', {
      resourceType,
      duration,
      size,
      url: labels.url_path
    });
  }
}

async function processFrontendError(data: any, labels: any, url: string, userAgent: string): Promise<void> {
  const { message, filename, severity, lineno, colno } = data;

  // Record frontend error
  metrics.recordError('frontend', 'javascript_error', severity, 'client');

  // Log structured error
  logger.error('Frontend JavaScript error', new Error(message), {
    filename,
    lineno,
    colno,
    severity,
    url,
    userAgent,
    ...labels
  });

  // Security-related error analysis
  if (message.includes('CSP') || message.includes('Content Security Policy')) {
    logger.security('Content Security Policy violation', 'medium', {
      actor: labels.user_id,
      resource: url,
      action: 'csp_violation',
      outcome: 'failure',
      userAgent
    });
  }
}

async function processUserInteraction(data: any, labels: any): Promise<void> {
  const { type: interactionType, target } = data;

  // Record user interaction
  metrics.apiCallsTotal.inc({
    ...labels,
    interaction_type: interactionType,
    target_element: target
  });

  // Business metric - track user engagement
  logger.business('User interaction', 'engagement', {
    properties: {
      interactionType,
      target,
      url: labels.url_path
    }
  });
}

async function processPageVisibility(data: any, labels: any): Promise<void> {
  const { event, visibleTime } = data;

  if (event === 'hidden' && visibleTime) {
    // Record page engagement time
    metrics.httpRequestDuration.observe({
      ...labels,
      event_type: 'page_engagement'
    }, visibleTime / 1000);

    // Business metric - track time on page
    logger.business('Page engagement', 'time_on_page', {
      value: visibleTime,
      properties: {
        url: labels.url_path
      }
    });
  }
}

async function processCustomMetric(data: any, labels: any): Promise<void> {
  const { name, value, ...metadata } = data;

  // Record custom metric as a gauge
  metrics.systemHealthScore.set({
    ...labels,
    metric_name: name
  }, value);

  logger.info(`Custom RUM metric: ${name}`, {
    value,
    ...metadata,
    ...labels
  });
}

// Helper functions
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const real = request.headers.get('x-real-ip');
  const connecting = request.headers.get('x-connecting-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (real) {
    return real.trim();
  }
  
  if (connecting) {
    return connecting.trim();
  }
  
  return 'unknown';
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const key = ip;
  
  if (!requestCounts.has(key)) {
    requestCounts.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  const record = requestCounts.get(key)!;
  
  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + RATE_LIMIT_WINDOW;
    return true;
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  record.count++;
  return true;
}

function getUrlPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

// OPTIONS method for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}