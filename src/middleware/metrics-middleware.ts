// Middleware for automatic metrics collection
import { NextRequest, NextResponse } from 'next/server';
import { getPrometheusMetrics } from '@/lib/monitoring/PrometheusMetrics';

const metrics = getPrometheusMetrics();

export interface MetricsMiddlewareConfig {
  excludePaths?: string[];
  enableDetailedMetrics?: boolean;
  enableUserTracking?: boolean;
  enablePerformanceTracking?: boolean;
}

export function createMetricsMiddleware(config: MetricsMiddlewareConfig = {}) {
  const {
    excludePaths = ['/favicon.ico', '/_next/', '/api/health'],
    enableDetailedMetrics = true,
    enableUserTracking = true,
    enablePerformanceTracking = true
  } = config;

  return function metricsMiddleware(request: NextRequest) {
    const startTime = Date.now();
    const { pathname, searchParams } = request.nextUrl;
    const method = request.method;

    // Skip excluded paths
    if (excludePaths.some(path => pathname.startsWith(path))) {
      return NextResponse.next();
    }

    // Extract user information if available
    const userId = request.headers.get('x-user-id') || extractUserIdFromAuth(request);
    const tenantId = request.headers.get('x-tenant-id') || 'default';
    const userAgent = request.headers.get('user-agent') || '';
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

    // Extract additional context
    const referer = request.headers.get('referer') || '';
    const contentLength = request.headers.get('content-length');
    const acceptEncoding = request.headers.get('accept-encoding') || '';

    // Create response handler
    return new Promise<NextResponse>((resolve) => {
      const response = NextResponse.next();
      
      // Override response methods to collect metrics
      const originalJson = response.json;
      response.json = function(this: NextResponse, body: any) {
        collectResponseMetrics(this, body);
        return originalJson.call(this, body);
      };

      // Collect metrics after response
      const endTime = Date.now();
      const duration = endTime - startTime;
      const statusCode = response.status;

      try {
        // Basic HTTP metrics
        metrics.recordHttpRequest(method, pathname, statusCode, duration, userId, tenantId);

        if (enableDetailedMetrics) {
          // Record request size
          if (contentLength) {
            metrics.httpRequestSize.observe({
              method,
              route: pathname
            }, parseInt(contentLength));
          }

          // Record API-specific metrics
          if (pathname.startsWith('/api/')) {
            const apiVersion = extractApiVersion(pathname);
            metrics.apiCallsTotal.inc({
              endpoint: pathname,
              method,
              status_code: statusCode.toString(),
              api_version: apiVersion
            });

            // Track API performance
            if (enablePerformanceTracking) {
              recordApiPerformanceMetrics(pathname, method, duration, statusCode);
            }
          }

          // Track plugin-specific operations
          if (pathname.includes('/plugins/')) {
            recordPluginMetrics(pathname, method, duration, statusCode, userId);
          }

          // Track authentication operations
          if (pathname.includes('/auth/') || pathname.includes('/login')) {
            recordAuthMetrics(pathname, method, duration, statusCode);
          }
        }

        if (enableUserTracking && userId) {
          // Track user activity
          recordUserActivity(userId, tenantId, pathname, method, statusCode);
        }

        // Record errors
        if (statusCode >= 400) {
          const errorType = getErrorType(statusCode);
          const severity = getErrorSeverity(statusCode);
          metrics.recordError('http', errorType, severity, getComponentFromPath(pathname));
        }

        // Record business metrics
        recordBusinessMetrics(pathname, method, statusCode, userId, tenantId);

      } catch (error) {
        console.error('Error collecting metrics:', error);
        // Don't fail the request if metrics collection fails
      }

      resolve(response);
    });
  };
}

function extractUserIdFromAuth(request: NextRequest): string | undefined {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      // Extract user ID from JWT token (simplified)
      const token = authHeader.slice(7);
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.sub || payload.userId;
    }
  } catch (error) {
    // Ignore errors in token parsing
  }
  return undefined;
}

function extractApiVersion(pathname: string): string {
  const versionMatch = pathname.match(/\/api\/v(\d+)\//);
  return versionMatch ? `v${versionMatch[1]}` : 'v1';
}

function collectResponseMetrics(response: NextResponse, body: any): void {
  try {
    const responseSize = JSON.stringify(body).length;
    // Note: This is a simplified approach. In practice, you'd want to measure actual response size
    metrics.httpResponseSize.observe({
      method: 'unknown', // Would need to pass this through
      route: 'unknown',
      status_code: response.status.toString()
    }, responseSize);
  } catch (error) {
    // Ignore errors in response size calculation
  }
}

function recordApiPerformanceMetrics(pathname: string, method: string, duration: number, statusCode: number): void {
  // Record slow API calls
  if (duration > 1000) {
    metrics.errorRateTotal.inc({
      service: 'api',
      error_type: 'slow_response',
      severity: duration > 5000 ? 'warning' : 'info',
      component: getComponentFromPath(pathname)
    });
  }

  // Record API success rate
  const success = statusCode >= 200 && statusCode < 400;
  if (!success) {
    metrics.errorRateTotal.inc({
      service: 'api',
      error_type: 'api_error',
      severity: statusCode >= 500 ? 'critical' : 'warning',
      component: getComponentFromPath(pathname)
    });
  }
}

function recordPluginMetrics(pathname: string, method: string, duration: number, statusCode: number, userId?: string): void {
  const pluginMatch = pathname.match(/\/plugins\/([^\/]+)/);
  if (pluginMatch) {
    const pluginId = pluginMatch[1];
    const operation = getPluginOperation(pathname, method);
    const status = statusCode >= 200 && statusCode < 400 ? 'success' : 'error';
    
    metrics.recordPluginOperation(pluginId, operation, status, duration, undefined, userId);
  }
}

function recordAuthMetrics(pathname: string, method: string, duration: number, statusCode: number): void {
  const provider = extractAuthProvider(pathname);
  const authMethod = getAuthMethod(pathname);
  const success = statusCode >= 200 && statusCode < 400;
  const failureReason = success ? undefined : getAuthFailureReason(statusCode);
  
  metrics.recordAuthentication(provider, authMethod, success, duration, failureReason);
}

function recordUserActivity(userId: string, tenantId: string, pathname: string, method: string, statusCode: number): void {
  // Track user session activity
  metrics.userSessionsActive.set({
    tenant_id: tenantId,
    user_type: 'human'
  }, 1); // This would be updated from a session tracker

  // Track developer productivity
  if (pathname.includes('/templates/') && method === 'POST') {
    const templateType = extractTemplateType(pathname);
    metrics.templatesCreatedTotal.inc({
      template_type: templateType,
      user_id: userId,
      tenant_id: tenantId
    });
  }

  if (pathname.includes('/deploy/') && method === 'POST') {
    const serviceType = extractServiceType(pathname);
    const environment = extractEnvironment(pathname);
    metrics.servicesDeployedTotal.inc({
      service_type: serviceType,
      environment: environment,
      user_id: userId
    });
  }
}

function recordBusinessMetrics(pathname: string, method: string, statusCode: number, userId?: string, tenantId?: string): void {
  // Track plugin installations
  if (pathname.includes('/plugins/') && pathname.includes('/install') && method === 'POST') {
    const pluginId = extractPluginIdFromPath(pathname);
    metrics.pluginInstallationsTotal.inc({
      plugin_id: pluginId,
      version: 'latest', // Would extract actual version
      user_id: userId || 'unknown',
      tenant_id: tenantId || 'default'
    });
  }

  // Track plugin rollbacks
  if (pathname.includes('/plugins/') && pathname.includes('/rollback') && method === 'POST') {
    const pluginId = extractPluginIdFromPath(pathname);
    metrics.pluginRollbacksTotal.inc({
      plugin_id: pluginId,
      from_version: 'unknown', // Would extract from request body
      to_version: 'unknown',
      reason: 'user_initiated'
    });
  }
}

// Helper functions
function getErrorType(statusCode: number): string {
  if (statusCode >= 400 && statusCode < 500) return 'client_error';
  if (statusCode >= 500) return 'server_error';
  return 'unknown';
}

function getErrorSeverity(statusCode: number): string {
  if (statusCode >= 500) return 'critical';
  if (statusCode >= 400) return 'warning';
  return 'info';
}

function getComponentFromPath(pathname: string): string {
  if (pathname.startsWith('/api/plugins/')) return 'plugins';
  if (pathname.startsWith('/api/auth/')) return 'auth';
  if (pathname.startsWith('/api/catalog/')) return 'catalog';
  if (pathname.startsWith('/api/templates/')) return 'templates';
  if (pathname.startsWith('/api/')) return 'api';
  return 'frontend';
}

function getPluginOperation(pathname: string, method: string): string {
  if (pathname.includes('/install')) return 'install';
  if (pathname.includes('/uninstall')) return 'uninstall';
  if (pathname.includes('/rollback')) return 'rollback';
  if (pathname.includes('/health')) return 'health_check';
  if (pathname.includes('/config')) return 'configure';
  if (method === 'GET') return 'read';
  if (method === 'POST') return 'create';
  if (method === 'PUT') return 'update';
  if (method === 'DELETE') return 'delete';
  return 'unknown';
}

function extractAuthProvider(pathname: string): string {
  if (pathname.includes('/github')) return 'github';
  if (pathname.includes('/oauth')) return 'oauth';
  if (pathname.includes('/saml')) return 'saml';
  if (pathname.includes('/ldap')) return 'ldap';
  return 'local';
}

function getAuthMethod(pathname: string): string {
  if (pathname.includes('/oauth')) return 'oauth';
  if (pathname.includes('/saml')) return 'saml';
  if (pathname.includes('/ldap')) return 'ldap';
  return 'password';
}

function getAuthFailureReason(statusCode: number): string {
  switch (statusCode) {
    case 401: return 'unauthorized';
    case 403: return 'forbidden';
    case 404: return 'not_found';
    case 429: return 'rate_limited';
    default: return 'unknown';
  }
}

function extractTemplateType(pathname: string): string {
  // Extract template type from path or default
  if (pathname.includes('/service')) return 'service';
  if (pathname.includes('/website')) return 'website';
  if (pathname.includes('/library')) return 'library';
  return 'generic';
}

function extractServiceType(pathname: string): string {
  // Extract service type from deployment path
  return 'microservice'; // Default, would be extracted from request
}

function extractEnvironment(pathname: string): string {
  if (pathname.includes('/prod')) return 'production';
  if (pathname.includes('/stage')) return 'staging';
  if (pathname.includes('/dev')) return 'development';
  return 'development';
}

function extractPluginIdFromPath(pathname: string): string {
  const match = pathname.match(/\/plugins\/([^\/]+)/);
  return match ? match[1] : 'unknown';
}

export { createMetricsMiddleware };