/**
 * Tenant Health Monitoring API
 * Provides access to real-time tenant health metrics and alerts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenancy/TenantContext';
import { checkSystemAdminRights } from '@/lib/permissions/SystemPermissions';
import { TenantHealthMonitor } from '@/services/monitoring/TenantHealthMonitor';

// Global health monitor instance
let healthMonitor: TenantHealthMonitor | null = null;

function getHealthMonitor(): TenantHealthMonitor {
  if (!healthMonitor) {
    healthMonitor = new TenantHealthMonitor();
    
    // Set up event listeners for logging
    healthMonitor.on('alert', (alert) => {
      console.log('🚨 New tenant alert:', {
        tenant: alert.tenantId,
        type: alert.type,
        severity: alert.severity,
        title: alert.title
      });
    });
    
    healthMonitor.on('autoRemediation', (event) => {
      console.log('🔧 Auto-remediation:', event);
    });
    
    healthMonitor.on('monitoringError', (error) => {
      console.error('❌ Monitoring error:', error);
    });
  }
  
  return healthMonitor;
}

/**
 * GET - Retrieve tenant health metrics and alerts
 */
export async function GET(request: NextRequest) {
  try {
    const tenantContext = getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const type = searchParams.get('type') || 'health';

    const monitor = getHealthMonitor();

    switch (type) {
      case 'health':
        if (tenantId) {
          // Get health for specific tenant
          const health = monitor.getTenantHealth(tenantId);
          if (!health) {
            return NextResponse.json({
              success: false,
              error: 'Tenant not found or no health data available'
            }, { status: 404 });
          }
          
          return NextResponse.json({
            success: true,
            data: health
          });
        } else {
          // Get health for all tenants (requires system admin)
          if (!checkSystemAdminRights(tenantContext)) {
            return NextResponse.json({
              success: false,
              error: 'System admin rights required to view all tenant health'
            }, { status: 403 });
          }
          
          const allHealth = monitor.getAllTenantHealth();
          return NextResponse.json({
            success: true,
            data: allHealth,
            metadata: {
              totalTenants: allHealth.length,
              healthy: allHealth.filter(h => h.healthScore >= 80).length,
              warning: allHealth.filter(h => h.healthScore >= 60 && h.healthScore < 80).length,
              critical: allHealth.filter(h => h.healthScore < 60).length
            }
          });
        }

      case 'alerts':
        if (tenantId) {
          const alerts = monitor.getTenantAlerts(tenantId);
          return NextResponse.json({
            success: true,
            data: alerts,
            metadata: {
              total: alerts.length,
              critical: alerts.filter(a => a.severity === 'critical').length,
              high: alerts.filter(a => a.severity === 'high').length,
              medium: alerts.filter(a => a.severity === 'medium').length,
              low: alerts.filter(a => a.severity === 'low').length
            }
          });
        } else {
          // Get all alerts (requires system admin)
          if (!checkSystemAdminRights(tenantContext)) {
            return NextResponse.json({
              success: false,
              error: 'System admin rights required to view all alerts'
            }, { status: 403 });
          }
          
          const allAlerts = monitor.getActiveAlerts();
          return NextResponse.json({
            success: true,
            data: allAlerts,
            metadata: {
              total: allAlerts.length,
              byType: {
                performance: allAlerts.filter(a => a.type === 'performance').length,
                resource: allAlerts.filter(a => a.type === 'resource').length,
                security: allAlerts.filter(a => a.type === 'security').length,
                billing: allAlerts.filter(a => a.type === 'billing').length,
                availability: allAlerts.filter(a => a.type === 'availability').length
              },
              bySeverity: {
                critical: allAlerts.filter(a => a.severity === 'critical').length,
                high: allAlerts.filter(a => a.severity === 'high').length,
                medium: allAlerts.filter(a => a.severity === 'medium').length,
                low: allAlerts.filter(a => a.severity === 'low').length
              }
            }
          });
        }

      case 'thresholds':
        if (!checkSystemAdminRights(tenantContext)) {
          return NextResponse.json({
            success: false,
            error: 'System admin rights required to view monitoring thresholds'
          }, { status: 403 });
        }
        
        const thresholds = monitor.getThresholds();
        return NextResponse.json({
          success: true,
          data: thresholds
        });

      case 'summary':
        if (!checkSystemAdminRights(tenantContext)) {
          return NextResponse.json({
            success: false,
            error: 'System admin rights required to view monitoring summary'
          }, { status: 403 });
        }
        
        const allHealth = monitor.getAllTenantHealth();
        const allAlerts = monitor.getActiveAlerts();
        
        return NextResponse.json({
          success: true,
          data: {
            overview: {
              totalTenants: allHealth.length,
              avgHealthScore: allHealth.reduce((sum, h) => sum + h.healthScore, 0) / allHealth.length,
              healthyTenants: allHealth.filter(h => h.healthScore >= 80).length,
              warningTenants: allHealth.filter(h => h.healthScore >= 60 && h.healthScore < 80).length,
              criticalTenants: allHealth.filter(h => h.healthScore < 60).length
            },
            alerts: {
              total: allAlerts.length,
              critical: allAlerts.filter(a => a.severity === 'critical').length,
              unacknowledged: allAlerts.filter(a => !a.acknowledged).length,
              autoRemediationAttempts: allAlerts.filter(a => a.autoRemediationAttempted).length
            },
            trends: {
              improving: allHealth.filter(h => h.healthTrend === 'improving').length,
              stable: allHealth.filter(h => h.healthTrend === 'stable').length,
              declining: allHealth.filter(h => h.healthTrend === 'declining').length
            }
          }
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid request type'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Tenant health monitoring API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve health monitoring data'
    }, { status: 500 });
  }
}

/**
 * POST - Acknowledge or resolve alerts, update thresholds
 */
export async function POST(request: NextRequest) {
  try {
    const tenantContext = getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const body = await request.json();
    const { action, alertId, tenantId, thresholds } = body;
    
    const monitor = getHealthMonitor();

    switch (action) {
      case 'acknowledge':
        if (!alertId) {
          return NextResponse.json({
            success: false,
            error: 'Alert ID is required'
          }, { status: 400 });
        }
        
        const acknowledged = monitor.acknowledgeAlert(alertId, tenantContext.user.id);
        if (!acknowledged) {
          return NextResponse.json({
            success: false,
            error: 'Alert not found'
          }, { status: 404 });
        }
        
        return NextResponse.json({
          success: true,
          data: { acknowledged: true, timestamp: new Date() }
        });

      case 'resolve':
        if (!alertId) {
          return NextResponse.json({
            success: false,
            error: 'Alert ID is required'
          }, { status: 400 });
        }
        
        const resolved = monitor.resolveAlert(
          alertId, 
          tenantContext.user.id,
          body.resolution || 'Manually resolved'
        );
        
        if (!resolved) {
          return NextResponse.json({
            success: false,
            error: 'Alert not found'
          }, { status: 404 });
        }
        
        return NextResponse.json({
          success: true,
          data: { resolved: true, timestamp: new Date() }
        });

      case 'update_thresholds':
        if (!checkSystemAdminRights(tenantContext)) {
          return NextResponse.json({
            success: false,
            error: 'System admin rights required to update thresholds'
          }, { status: 403 });
        }
        
        if (!thresholds) {
          return NextResponse.json({
            success: false,
            error: 'Thresholds data is required'
          }, { status: 400 });
        }
        
        monitor.updateThresholds(thresholds);
        
        return NextResponse.json({
          success: true,
          data: { updated: true, timestamp: new Date() }
        });

      case 'trigger_check':
        if (!checkSystemAdminRights(tenantContext)) {
          return NextResponse.json({
            success: false,
            error: 'System admin rights required to trigger manual health check'
          }, { status: 403 });
        }
        
        // Trigger immediate health check for specific tenant or all tenants
        if (tenantId) {
          // In a real implementation, this would trigger a check for specific tenant
          console.log(`Manual health check triggered for tenant: ${tenantId}`);
        } else {
          // Trigger for all tenants
          console.log('Manual health check triggered for all tenants');
        }
        
        return NextResponse.json({
          success: true,
          data: { triggered: true, timestamp: new Date() }
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Tenant health monitoring POST error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process health monitoring request'
    }, { status: 500 });
  }
}

/**
 * DELETE - Stop monitoring (admin only)
 */
export async function DELETE(request: NextRequest) {
  try {
    const tenantContext = getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    if (!checkSystemAdminRights(tenantContext)) {
      return NextResponse.json({
        success: false,
        error: 'System admin rights required to stop monitoring'
      }, { status: 403 });
    }

    if (healthMonitor) {
      healthMonitor.stopMonitoring();
      healthMonitor = null;
    }

    return NextResponse.json({
      success: true,
      data: { stopped: true, timestamp: new Date() }
    });

  } catch (error) {
    console.error('Stop monitoring error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to stop monitoring'
    }, { status: 500 });
  }
}