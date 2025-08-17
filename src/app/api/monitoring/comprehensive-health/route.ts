import { NextRequest, NextResponse } from 'next/server';
import { healthMonitor } from '@/services/comprehensive-health-monitor';
import { automatedResolver } from '@/services/automated-issue-resolver';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const detailed = searchParams.get('detailed') === 'true';
    const service = searchParams.get('service');

    if (service) {
      // Get health for specific service
      const serviceHealth = healthMonitor.getServiceHealth(service);
      
      if (!serviceHealth) {
        return NextResponse.json(
          { error: 'Service not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        service: serviceHealth.service,
        status: serviceHealth.status.status,
        message: serviceHealth.status.message,
        lastCheck: serviceHealth.lastCheck,
        consecutiveFailures: serviceHealth.consecutiveFailures,
        metrics: serviceHealth.status.metrics || {}
      });
    }

    // Get overall system health
    const systemHealth = healthMonitor.getSystemHealth();
    const resolverStatus = automatedResolver.getStatus();

    const response = {
      status: systemHealth.status,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      version: process.env.npm_package_version || '1.0.0',
      services: systemHealth.services.map(service => ({
        name: service.service,
        status: service.status.status,
        message: service.status.message,
        lastCheck: service.lastCheck,
        consecutiveFailures: service.consecutiveFailures,
        responseTime: service.status.responseTime,
        ...(detailed && { metrics: service.status.metrics })
      })),
      alerts: {
        total: systemHealth.alerts.length,
        critical: systemHealth.alerts.filter(a => a.severity === 'critical').length,
        high: systemHealth.alerts.filter(a => a.severity === 'high').length,
        medium: systemHealth.alerts.filter(a => a.severity === 'medium').length,
        low: systemHealth.alerts.filter(a => a.severity === 'low').length,
        ...(detailed && { 
          alerts: systemHealth.alerts.map(alert => ({
            id: alert.id,
            severity: alert.severity,
            title: alert.title,
            service: alert.service,
            timestamp: alert.timestamp,
            actions: alert.actions?.length || 0
          }))
        })
      },
      automation: {
        enabled: resolverStatus.enabled,
        activeResolutions: resolverStatus.activeResolutions,
        totalPatterns: resolverStatus.totalPatterns,
        resolutionHistory: resolverStatus.resolutionHistory
      },
      ...(detailed && {
        systemMetrics: systemHealth.metrics,
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          memory: process.memoryUsage(),
          loadAverage: require('os').loadavg()
        }
      })
    };

    // Set appropriate cache headers based on system status
    const cacheControl = systemHealth.status === 'critical' ? 'no-cache' : 'max-age=30';
    
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': cacheControl,
        'X-Health-Status': systemHealth.status,
        'X-Service-Count': systemHealth.services.length.toString(),
        'X-Alert-Count': systemHealth.alerts.length.toString()
      }
    });

  } catch (error: any) {
    console.error('[ComprehensiveHealthAPI] Error getting health status:', error);
    
    return NextResponse.json(
      {
        status: 'error',
        message: 'Health check failed',
        error: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, alertId, pattern, service } = body;

    switch (action) {
      case 'resolve_alert':
        if (!alertId) {
          return NextResponse.json(
            { error: 'Alert ID required' },
            { status: 400 }
          );
        }

        const resolvedAlert = await healthMonitor.resolveAlert(alertId);
        
        if (!resolvedAlert) {
          return NextResponse.json(
            { error: 'Alert not found or already resolved' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Alert resolved',
          alert: {
            id: resolvedAlert.id,
            title: resolvedAlert.title,
            resolvedAt: resolvedAlert.resolvedAt
          }
        });

      case 'trigger_resolution':
        if (!pattern) {
          return NextResponse.json(
            { error: 'Pattern required for resolution trigger' },
            { status: 400 }
          );
        }

        const results = await automatedResolver.resolveIssue(pattern, service);
        
        return NextResponse.json({
          success: true,
          message: 'Resolution triggered',
          results: results.map(r => ({
            action: r.action.name,
            success: r.success,
            duration: r.duration,
            output: r.output.substring(0, 500), // Truncate long outputs
            error: r.error
          }))
        });

      case 'enable_automation':
        automatedResolver.enable();
        return NextResponse.json({
          success: true,
          message: 'Automation enabled'
        });

      case 'disable_automation':
        automatedResolver.disable();
        return NextResponse.json({
          success: true,
          message: 'Automation disabled'
        });

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }

  } catch (error: any) {
    console.error('[ComprehensiveHealthAPI] Error processing health action:', error);
    
    return NextResponse.json(
      {
        error: 'Health action failed',
        message: error.message
      },
      { status: 500 }
    );
  }
}