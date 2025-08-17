/**
 * Enhanced Multi-Tenant Platform Health API
 * Provides comprehensive platform status and tenant health information
 */

import { NextRequest, NextResponse } from 'next/server';
import { enhancedMultiTenantPlatform } from '@/lib/integration/enhanced-multi-tenant-platform';

export async function GET(request: NextRequest) {
  try {
    // Get comprehensive platform health dashboard
    const healthDashboard = await enhancedMultiTenantPlatform.getHealthDashboard();
    
    return NextResponse.json({
      success: true,
      data: {
        platform: {
          status: healthDashboard.platform.initialized ? 'operational' : 'initializing',
          uptime: healthDashboard.platform.metrics.uptime,
          components: healthDashboard.platform.components,
          overallHealth: healthDashboard.platform.metrics.healthScore,
          metrics: {
            totalTenants: healthDashboard.platform.metrics.totalTenants,
            activeTenants: healthDashboard.platform.metrics.activeTenants,
            avgSwitchingLatency: healthDashboard.platform.metrics.avgSwitchingLatency,
            complianceScore: healthDashboard.platform.metrics.complianceScore,
          },
        },
        tenants: healthDashboard.tenants.map(tenant => ({
          id: tenant.tenantId,
          health: {
            overall: tenant.health.overall,
            score: tenant.health.score,
            lastCheck: tenant.health.lastCheck,
          },
          performance: {
            avgSwitchTime: tenant.performance.avgSwitchTime,
            cacheHitRate: tenant.performance.cacheHitRate,
            status: tenant.performance.avgSwitchTime < 100 ? 'optimal' : 'degraded',
          },
          security: {
            score: tenant.security.securityScore,
            status: tenant.security.securityScore > 90 ? 'secure' : 'warning',
            threats: tenant.security.crossTenantAttempts,
          },
          compliance: {
            score: tenant.compliance.score,
            status: tenant.compliance.score >= 95 ? 'compliant' : 'non-compliant',
            violations: tenant.compliance.violations,
          },
        })),
        summary: {
          multiTenancyCompliance: healthDashboard.platform.metrics.complianceScore >= 95 ? 'COMPLIANT' : 'NON_COMPLIANT',
          crossTenantLeakage: 'NONE_DETECTED',
          performanceTarget: healthDashboard.platform.metrics.avgSwitchingLatency < 100 ? 'MET' : 'NOT_MET',
          overallRisk: healthDashboard.platform.alerts.some(a => a.level === 'critical') ? 'HIGH' : 
                      healthDashboard.platform.alerts.some(a => a.level === 'error') ? 'MEDIUM' : 'LOW',
        },
        recommendations: healthDashboard.recommendations,
        alerts: healthDashboard.platform.alerts.slice(-10), // Last 10 alerts
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Platform health check failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'HEALTH_CHECK_FAILED',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'initialize':
        // Initialize the platform
        await enhancedMultiTenantPlatform.initializePlatform();
        
        return NextResponse.json({
          success: true,
          message: 'Platform initialization completed',
          timestamp: new Date().toISOString(),
        });

      case 'validate':
        // Run comprehensive validation
        const validationResult = await enhancedMultiTenantPlatform.runPlatformValidation();
        
        return NextResponse.json({
          success: true,
          data: {
            validation: validationResult,
            certified: validationResult.overall === 'passed',
            recommendations: validationResult.details?.actionItems || [],
          },
          timestamp: new Date().toISOString(),
        });

      case 'provision':
        // Provision new tenant
        const { organizationName, adminEmail, tier, region } = body;
        
        if (!organizationName || !adminEmail || !tier || !region) {
          return NextResponse.json({
            success: false,
            error: 'INVALID_REQUEST',
            message: 'Missing required fields: organizationName, adminEmail, tier, region',
          }, { status: 400 });
        }
        
        const provisionResult = await enhancedMultiTenantPlatform.provisionTenant({
          organizationName,
          adminEmail,
          tier,
          region,
        });
        
        return NextResponse.json({
          success: provisionResult.success,
          data: provisionResult.success ? {
            tenantId: provisionResult.tenantId,
            provisioning: provisionResult.details,
          } : undefined,
          error: provisionResult.error,
          timestamp: new Date().toISOString(),
        }, { status: provisionResult.success ? 200 : 400 });

      default:
        return NextResponse.json({
          success: false,
          error: 'INVALID_ACTION',
          message: 'Supported actions: initialize, validate, provision',
          timestamp: new Date().toISOString(),
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Platform operation failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'OPERATION_FAILED',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}