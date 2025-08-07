import { NextRequest, NextResponse } from 'next/server';
import { GraphHealthMonitor } from '@/lib/catalog-graph/health';
import type { DependencyGraph } from '@/lib/catalog-graph/types';

// Global health monitor instance
const healthMonitor = new GraphHealthMonitor({
  checkInterval: 30000, // 30 seconds
  healthThresholds: {
    healthy: 90,
    degraded: 70,
    unhealthy: 50,
  },
  alerting: {
    enabled: true,
    channels: ['dashboard'],
    cooldownPeriod: 300000, // 5 minutes
  },
  metrics: {
    responseTimeThreshold: 1000,
    errorRateThreshold: 5,
    uptimeThreshold: 99.5,
  },
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'summary';
    const nodeId = searchParams.get('nodeId');
    const timeRange = searchParams.get('timeRange') || '24h';
    const format = searchParams.get('format') || 'json';

    switch (action) {
      case 'summary':
        const summary = healthMonitor.getHealthSummary();
        return NextResponse.json({
          action: 'summary',
          data: summary,
          timestamp: new Date().toISOString(),
        });

      case 'alerts':
        const activeAlerts = healthMonitor.getActiveAlerts();
        const severityFilter = searchParams.get('severity');
        const filteredAlerts = severityFilter 
          ? activeAlerts.filter(alert => alert.severity === severityFilter)
          : activeAlerts;

        return NextResponse.json({
          action: 'alerts',
          data: {
            alerts: filteredAlerts,
            count: filteredAlerts.length,
            severityCounts: {
              critical: activeAlerts.filter(a => a.severity === 'critical').length,
              error: activeAlerts.filter(a => a.severity === 'error').length,
              warning: activeAlerts.filter(a => a.severity === 'warning').length,
              info: activeAlerts.filter(a => a.severity === 'info').length,
            },
          },
          timestamp: new Date().toISOString(),
        });

      case 'node-health':
        if (!nodeId) {
          return NextResponse.json(
            { error: 'nodeId parameter is required for node health' },
            { status: 400 }
          );
        }

        const nodeHealth = healthMonitor.getNodeHealth(nodeId);
        if (!nodeHealth) {
          return NextResponse.json(
            { error: `No health data found for node: ${nodeId}` },
            { status: 404 }
          );
        }

        return NextResponse.json({
          action: 'node-health',
          nodeId,
          data: nodeHealth,
          timestamp: new Date().toISOString(),
        });

      case 'trends':
        if (!nodeId) {
          return NextResponse.json(
            { error: 'nodeId parameter is required for trends' },
            { status: 400 }
          );
        }

        const trends = healthMonitor.getHealthTrends(nodeId, timeRange);
        if (!trends) {
          return NextResponse.json(
            { error: `No trend data found for node: ${nodeId}` },
            { status: 404 }
          );
        }

        return NextResponse.json({
          action: 'trends',
          nodeId,
          timeRange,
          data: trends,
          timestamp: new Date().toISOString(),
        });

      case 'export':
        const exportData = healthMonitor.exportHealthData(format as 'json' | 'csv');
        
        if (format === 'csv') {
          const headers = new Headers();
          headers.set('Content-Type', 'text/csv');
          headers.set('Content-Disposition', `attachment; filename="health-data-${new Date().toISOString().split('T')[0]}.csv"`);
          return new Response(exportData, { headers });
        }

        return NextResponse.json({
          action: 'export',
          format,
          data: JSON.parse(exportData),
          timestamp: new Date().toISOString(),
        });

      case 'monitoring-status':
        return NextResponse.json({
          action: 'monitoring-status',
          data: {
            isMonitoring: healthMonitor['monitoringInterval'] !== undefined,
            config: healthMonitor['config'],
            lastCheck: new Date().toISOString(), // In real implementation, track this
          },
          timestamp: new Date().toISOString(),
        });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error handling health request:', error);
    return NextResponse.json(
      { error: 'Failed to handle health request' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'check';
    
    const body = await request.json();

    switch (action) {
      case 'check':
        const { graph } = body;
        if (!graph) {
          return NextResponse.json(
            { error: 'Graph data is required for health check' },
            { status: 400 }
          );
        }

        const dependencyGraph = graph as DependencyGraph;
        
        // Perform health check
        await healthMonitor.performHealthCheck(dependencyGraph);

        return NextResponse.json({
          action: 'check',
          data: {
            summary: healthMonitor.getHealthSummary(),
            nodeHealth: Object.fromEntries(
              dependencyGraph.nodes.map(node => [
                node.id, 
                healthMonitor.getNodeHealth(node.id)
              ])
            ),
            alerts: healthMonitor.getActiveAlerts(),
          },
          timestamp: new Date().toISOString(),
        });

      case 'start-monitoring':
        const { graph: monitorGraph } = body;
        if (!monitorGraph) {
          return NextResponse.json(
            { error: 'Graph data is required to start monitoring' },
            { status: 400 }
          );
        }

        healthMonitor.startMonitoring(monitorGraph as DependencyGraph);

        return NextResponse.json({
          action: 'start-monitoring',
          data: {
            message: 'Health monitoring started',
            config: healthMonitor['config'],
          },
          timestamp: new Date().toISOString(),
        });

      case 'stop-monitoring':
        healthMonitor.stopMonitoring();

        return NextResponse.json({
          action: 'stop-monitoring',
          data: {
            message: 'Health monitoring stopped',
          },
          timestamp: new Date().toISOString(),
        });

      case 'acknowledge-alert':
        const { alertId } = body;
        if (!alertId) {
          return NextResponse.json(
            { error: 'alertId is required' },
            { status: 400 }
          );
        }

        const acknowledged = healthMonitor.acknowledgeAlert(alertId);
        if (!acknowledged) {
          return NextResponse.json(
            { error: `Alert ${alertId} not found or already acknowledged` },
            { status: 404 }
          );
        }

        return NextResponse.json({
          action: 'acknowledge-alert',
          data: {
            alertId,
            acknowledged: true,
            message: 'Alert acknowledged successfully',
          },
          timestamp: new Date().toISOString(),
        });

      case 'resolve-alert':
        const { alertId: resolveAlertId } = body;
        if (!resolveAlertId) {
          return NextResponse.json(
            { error: 'alertId is required' },
            { status: 400 }
          );
        }

        const resolved = healthMonitor.resolveAlert(resolveAlertId);
        if (!resolved) {
          return NextResponse.json(
            { error: `Alert ${resolveAlertId} not found or already resolved` },
            { status: 404 }
          );
        }

        return NextResponse.json({
          action: 'resolve-alert',
          data: {
            alertId: resolveAlertId,
            resolved: true,
            message: 'Alert resolved successfully',
          },
          timestamp: new Date().toISOString(),
        });

      case 'configure':
        const { config } = body;
        if (!config) {
          return NextResponse.json(
            { error: 'Configuration is required' },
            { status: 400 }
          );
        }

        // Update configuration (in real implementation, validate config first)
        Object.assign(healthMonitor['config'], config);

        return NextResponse.json({
          action: 'configure',
          data: {
            message: 'Configuration updated successfully',
            config: healthMonitor['config'],
          },
          timestamp: new Date().toISOString(),
        });

      case 'simulate-issue':
        // Development endpoint to simulate health issues for testing
        const { nodeId, issueType, severity, duration } = body;
        if (!nodeId || !issueType) {
          return NextResponse.json(
            { error: 'nodeId and issueType are required for simulation' },
            { status: 400 }
          );
        }

        // In real implementation, this would inject simulated issues
        console.log(`Simulating ${issueType} issue for node ${nodeId} with severity ${severity} for ${duration}ms`);

        return NextResponse.json({
          action: 'simulate-issue',
          data: {
            message: `Simulated ${issueType} issue for node ${nodeId}`,
            nodeId,
            issueType,
            severity: severity || 'warning',
            duration: duration || 60000,
          },
          timestamp: new Date().toISOString(),
        });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error(`Error handling health ${searchParams.get('action')} request:`, error);
    return NextResponse.json(
      { error: 'Failed to handle health request' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { alertId, status } = body;

    if (!alertId) {
      return NextResponse.json(
        { error: 'alertId is required' },
        { status: 400 }
      );
    }

    let result = false;
    let message = '';

    switch (status) {
      case 'acknowledged':
        result = healthMonitor.acknowledgeAlert(alertId);
        message = result ? 'Alert acknowledged' : 'Failed to acknowledge alert';
        break;
      case 'resolved':
        result = healthMonitor.resolveAlert(alertId);
        message = result ? 'Alert resolved' : 'Failed to resolve alert';
        break;
      default:
        return NextResponse.json(
          { error: `Invalid status: ${status}. Use 'acknowledged' or 'resolved'` },
          { status: 400 }
        );
    }

    if (!result) {
      return NextResponse.json(
        { error: message },
        { status: 404 }
      );
    }

    return NextResponse.json({
      alertId,
      status,
      message,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error updating alert:', error);
    return NextResponse.json(
      { error: 'Failed to update alert' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const alertId = searchParams.get('alertId');

    if (!alertId) {
      return NextResponse.json(
        { error: 'alertId parameter is required' },
        { status: 400 }
      );
    }

    // In real implementation, this would delete the alert
    const alerts = healthMonitor['activeAlerts'];
    const deleted = alerts.delete(alertId);

    if (!deleted) {
      return NextResponse.json(
        { error: `Alert ${alertId} not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      alertId,
      deleted: true,
      message: 'Alert deleted successfully',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error deleting alert:', error);
    return NextResponse.json(
      { error: 'Failed to delete alert' },
      { status: 500 }
    );
  }
}