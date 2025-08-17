import { NextRequest, NextResponse } from 'next/server';
import { getPrometheusMetrics } from '@/lib/monitoring/PrometheusMetrics';
import { collectSystemMetrics } from '@/lib/monitoring/SystemMetrics';

const metrics = getPrometheusMetrics();

/**
 * Enterprise Prometheus metrics endpoint with comprehensive observability
 */
export async function GET(request: NextRequest) {
  // Enhanced authentication for metrics endpoint
  const authHeader = request.headers.get('authorization');
  const metricsToken = process.env.METRICS_AUTH_TOKEN;
  const userAgent = request.headers.get('user-agent') || '';
  
  // Allow Prometheus scraper and internal monitoring tools
  const allowedUserAgents = ['Prometheus', 'Grafana', 'AlertManager', 'otel-collector'];
  const isAllowedAgent = allowedUserAgents.some(agent => userAgent.includes(agent));
  
  if (metricsToken && authHeader !== `Bearer ${metricsToken}` && !isAllowedAgent) {
    metrics.recordError('metrics_endpoint', 'unauthorized_access', 'warning', 'metrics');
    return new NextResponse('Unauthorized', { status: 401 });
  }
  
  try {
    const startTime = Date.now();
    
    // Collect real-time system metrics before exporting
    await collectSystemMetrics(metrics);
    
    // Update system health score
    const healthScore = await calculateSystemHealthScore();
    metrics.updateSystemHealth('overall', healthScore);
    
    // Get all Prometheus metrics in OpenMetrics format
    const metricsOutput = await metrics.getMetrics();
    
    const duration = Date.now() - startTime;
    
    // Track metrics endpoint usage
    metrics.recordHttpRequest('GET', '/api/metrics', 200, duration, 'prometheus', 'system');
    
    return new NextResponse(metricsOutput, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Metrics-Count': metricsOutput.split('\n').filter(line => !line.startsWith('#') && line.trim()).length.toString(),
        'X-Collection-Duration-Ms': duration.toString()
      }
    });

  } catch (error) {
    console.error('Error generating metrics:', error);
    
    metrics.recordError('metrics_endpoint', 'collection_failed', 'critical', 'metrics');
    
    return NextResponse.json(
      { 
        error: 'Failed to generate metrics',
        timestamp: new Date().toISOString(),
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    );
  }
}

// Health check for metrics endpoint
export async function HEAD(request: NextRequest) {
  try {
    // Quick health check without full metrics collection
    metrics.recordHttpRequest('HEAD', '/api/metrics', 200, 0, 'healthcheck', 'system');
    return new NextResponse(null, { 
      status: 200,
      headers: {
        'X-Metrics-Healthy': 'true',
        'X-Last-Collection': new Date().toISOString()
      }
    });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}

// Calculate overall system health score (0-100)
async function calculateSystemHealthScore(): Promise<number> {
  try {
    let score = 100;
    
    // Check critical services (each worth 20 points)
    const criticalServices = ['database', 'redis', 'websocket', 'auth', 'plugins'];
    for (const service of criticalServices) {
      const isHealthy = await checkServiceHealth(service);
      if (!isHealthy) score -= 20;
    }
    
    // Check error rates (worth 20 points total)
    const errorRate = await getRecentErrorRate();
    if (errorRate > 5) score -= 10; // High error rate
    if (errorRate > 10) score -= 10; // Very high error rate
    
    return Math.max(0, score);
  } catch (error) {
    console.error('Error calculating health score:', error);
    return 50; // Default to degraded state on error
  }
}

async function checkServiceHealth(service: string): Promise<boolean> {
  // Simplified health check - in production, this would check actual service status
  try {
    switch (service) {
      case 'database':
        // Check database connectivity
        return true; // Placeholder
      case 'redis':
        // Check Redis connectivity
        return true; // Placeholder
      case 'websocket':
        // Check WebSocket server status
        return true; // Placeholder
      case 'auth':
        // Check authentication service
        return true; // Placeholder
      case 'plugins':
        // Check plugin system health
        return true; // Placeholder
      default:
        return true;
    }
  } catch (error) {
    return false;
  }
}

async function getRecentErrorRate(): Promise<number> {
  // Calculate error rate from recent metrics
  // This is a simplified implementation
  return 0; // Placeholder
}