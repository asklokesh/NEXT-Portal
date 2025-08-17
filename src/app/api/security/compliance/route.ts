/**
 * Security Compliance API
 * Provides access to compliance auditing, reporting, and security metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenancy/TenantContext';
import { checkSystemAdminRights } from '@/lib/permissions/SystemPermissions';
import { ComplianceAuditor } from '@/services/security/ComplianceAuditor';

// Global compliance auditor instance
let complianceAuditor: ComplianceAuditor | null = null;

function getComplianceAuditor(): ComplianceAuditor {
  if (!complianceAuditor) {
    complianceAuditor = new ComplianceAuditor();
    
    // Set up event listeners for logging
    complianceAuditor.on('complianceViolation', (event) => {
      console.log('🚨 Compliance violation detected:', {
        tenant: event.tenantId,
        framework: event.framework,
        control: event.control,
        findings: event.findings.length
      });
    });
    
    complianceAuditor.on('reportGenerated', (report) => {
      console.log('📊 Compliance report generated:', {
        id: report.id,
        framework: report.framework,
        score: report.overallScore,
        status: report.status
      });
    });
    
    complianceAuditor.on('auditError', (error) => {
      console.error('❌ Compliance audit error:', error);
    });
  }
  
  return complianceAuditor;
}

/**
 * GET - Retrieve compliance data, reports, and metrics
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
    const type = searchParams.get('type') || 'status';
    const frameworkId = searchParams.get('framework') || 'soc2_type2';
    const tenantId = searchParams.get('tenantId');

    const auditor = getComplianceAuditor();

    switch (type) {
      case 'frameworks':
        // Get available compliance frameworks
        const frameworks = auditor.getAvailableFrameworks();
        return NextResponse.json({
          success: true,
          data: frameworks
        });

      case 'status':
        // Get compliance status for a specific framework and tenant
        const targetTenantId = tenantId || tenantContext.tenant.id;
        
        if (tenantId && tenantId !== tenantContext.tenant.id && !checkSystemAdminRights(tenantContext)) {
          return NextResponse.json({
            success: false,
            error: 'Admin rights required to view other tenant compliance status'
          }, { status: 403 });
        }

        const complianceStatus = auditor.getComplianceStatus(targetTenantId, frameworkId);
        
        return NextResponse.json({
          success: true,
          data: {
            tenantId: targetTenantId,
            framework: frameworkId,
            checks: complianceStatus,
            summary: {
              totalChecks: complianceStatus.length,
              passed: complianceStatus.filter(c => c.status === 'passed').length,
              failed: complianceStatus.filter(c => c.status === 'failed').length,
              warnings: complianceStatus.filter(c => c.status === 'warning').length,
              averageScore: complianceStatus.length > 0 
                ? complianceStatus.reduce((sum, c) => sum + c.score, 0) / complianceStatus.length
                : 0
            }
          }
        });

      case 'metrics':
        // Get security metrics for tenant
        const metricsTargetTenantId = tenantId || tenantContext.tenant.id;
        
        if (tenantId && tenantId !== tenantContext.tenant.id && !checkSystemAdminRights(tenantContext)) {
          return NextResponse.json({
            success: false,
            error: 'Admin rights required to view other tenant security metrics'
          }, { status: 403 });
        }

        const securityMetrics = auditor.getSecurityMetrics(metricsTargetTenantId);
        
        if (!securityMetrics) {
          return NextResponse.json({
            success: false,
            error: 'Security metrics not available for this tenant'
          }, { status: 404 });
        }

        return NextResponse.json({
          success: true,
          data: {
            tenantId: metricsTargetTenantId,
            metrics: securityMetrics,
            lastUpdated: new Date()
          }
        });

      case 'reports':
        // Get compliance reports (admin only for cross-tenant access)
        if (tenantId && tenantId !== tenantContext.tenant.id && !checkSystemAdminRights(tenantContext)) {
          return NextResponse.json({
            success: false,
            error: 'Admin rights required to view other tenant reports'
          }, { status: 403 });
        }

        const reports = auditor.getRecentReports(20);
        const filteredReports = tenantId 
          ? reports.filter(r => r.tenantId === tenantId)
          : checkSystemAdminRights(tenantContext) 
            ? reports 
            : reports.filter(r => r.tenantId === tenantContext.tenant.id);

        return NextResponse.json({
          success: true,
          data: filteredReports
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid request type'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Compliance API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve compliance data'
    }, { status: 500 });
  }
}

/**
 * POST - Trigger compliance checks, generate reports
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
    const { action, frameworkId, tenantId, period } = body;

    const auditor = getComplianceAuditor();

    switch (action) {
      case 'run_checks':
        // Run compliance checks for specific tenant and framework
        const targetTenantId = tenantId || tenantContext.tenant.id;
        
        if (tenantId && tenantId !== tenantContext.tenant.id && !checkSystemAdminRights(tenantContext)) {
          return NextResponse.json({
            success: false,
            error: 'Admin rights required to run checks for other tenants'
          }, { status: 403 });
        }

        if (!frameworkId) {
          return NextResponse.json({
            success: false,
            error: 'Framework ID is required'
          }, { status: 400 });
        }

        const checks = await auditor.runComplianceChecks(targetTenantId, frameworkId);
        
        return NextResponse.json({
          success: true,
          data: {
            tenantId: targetTenantId,
            framework: frameworkId,
            checksRun: checks.length,
            results: {
              passed: checks.filter(c => c.status === 'passed').length,
              failed: checks.filter(c => c.status === 'failed').length,
              warnings: checks.filter(c => c.status === 'warning').length
            },
            timestamp: new Date()
          }
        });

      case 'generate_report':
        // Generate compliance report
        const reportTenantId = tenantId || tenantContext.tenant.id;
        
        if (tenantId && tenantId !== tenantContext.tenant.id && !checkSystemAdminRights(tenantContext)) {
          return NextResponse.json({
            success: false,
            error: 'Admin rights required to generate reports for other tenants'
          }, { status: 403 });
        }

        if (!frameworkId) {
          return NextResponse.json({
            success: false,
            error: 'Framework ID is required for report generation'
          }, { status: 400 });
        }

        const reportPeriod = period ? {
          start: new Date(period.start),
          end: new Date(period.end)
        } : undefined;

        const report = await auditor.generateComplianceReport(
          frameworkId, 
          reportTenantId, 
          reportPeriod
        );

        return NextResponse.json({
          success: true,
          data: report
        });

      case 'start_auditing':
        // Start continuous compliance auditing (admin only)
        if (!checkSystemAdminRights(tenantContext)) {
          return NextResponse.json({
            success: false,
            error: 'Admin rights required to control compliance auditing'
          }, { status: 403 });
        }

        auditor.startContinuousAuditing();
        
        return NextResponse.json({
          success: true,
          data: {
            message: 'Continuous compliance auditing started',
            timestamp: new Date()
          }
        });

      case 'stop_auditing':
        // Stop continuous compliance auditing (admin only)
        if (!checkSystemAdminRights(tenantContext)) {
          return NextResponse.json({
            success: false,
            error: 'Admin rights required to control compliance auditing'
          }, { status: 403 });
        }

        auditor.stopAuditing();
        
        return NextResponse.json({
          success: true,
          data: {
            message: 'Compliance auditing stopped',
            timestamp: new Date()
          }
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Compliance API POST error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process compliance request'
    }, { status: 500 });
  }
}

/**
 * GET specific compliance report by ID
 */
export async function getComplianceReport(reportId: string, tenantContext: any): Promise<NextResponse> {
  try {
    const auditor = getComplianceAuditor();
    const reports = auditor.getRecentReports(100); // Get more reports for search
    
    const report = reports.find(r => r.id === reportId);
    if (!report) {
      return NextResponse.json({
        success: false,
        error: 'Report not found'
      }, { status: 404 });
    }

    // Check access permissions
    if (report.tenantId && report.tenantId !== tenantContext.tenant.id && !checkSystemAdminRights(tenantContext)) {
      return NextResponse.json({
        success: false,
        error: 'Insufficient permissions to access this report'
      }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      data: report
    });

  } catch (error) {
    console.error('Get compliance report error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve compliance report'
    }, { status: 500 });
  }
}