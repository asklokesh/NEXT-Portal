import { NextRequest, NextResponse } from 'next/server';
import { complianceEngine } from '@/lib/audit/compliance-engine';
import { auth } from '@/lib/auth';

// GET /api/audit-logs/compliance - Get compliance dashboard and metrics
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const days = parseInt(searchParams.get('days') || '30', 10);

    switch (action) {
      case 'dashboard':
        const metrics = await complianceEngine.getDashboardMetrics(days);
        return NextResponse.json({ metrics });

      case 'rules':
        const standard = searchParams.get('standard');
        const rules = complianceEngine.getRules(standard || undefined);
        return NextResponse.json({ rules });

      case 'violations':
        const violationFilters = {
          standard: searchParams.get('standard') || undefined,
          severity: searchParams.get('severity') || undefined,
          status: searchParams.get('status') || undefined,
          startDate: searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined,
          endDate: searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined
        };
        
        // Remove undefined values
        Object.keys(violationFilters).forEach(key => 
          violationFilters[key as keyof typeof violationFilters] === undefined && 
          delete violationFilters[key as keyof typeof violationFilters]
        );

        const violations = await complianceEngine.getViolations(violationFilters);
        return NextResponse.json({ violations });

      case 'check':
        const lookbackHours = parseInt(searchParams.get('lookbackHours') || '1', 10);
        const recentViolations = await complianceEngine.runComplianceChecks(lookbackHours);
        return NextResponse.json({ violations: recentViolations });

      default:
        return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 });
    }

  } catch (error) {
    console.error('Failed to process compliance request:', error);
    return NextResponse.json({ error: 'Failed to process compliance request' }, { status: 500 });
  }
}

// POST /api/audit-logs/compliance - Create compliance rule or generate report
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    const action = data.action;

    switch (action) {
      case 'create_rule':
        const { name, description, category, severity, standard, conditions, violation, enabled } = data;
        
        if (!name || !description || !category || !severity || !standard) {
          return NextResponse.json({ 
            error: 'Missing required fields: name, description, category, severity, standard' 
          }, { status: 400 });
        }

        const newRule = await complianceEngine.addRule({
          name,
          description,
          category,
          severity,
          standard,
          conditions: conditions || {},
          violation: violation || {
            message: 'Compliance rule violation detected',
            remediation: 'Review and address the violation',
            escalation: []
          },
          enabled: enabled !== false
        });

        return NextResponse.json({ 
          message: 'Compliance rule created successfully',
          rule: newRule 
        }, { status: 201 });

      case 'generate_report':
        const { reportStandard, startDate, endDate, reportType } = data;
        
        if (!reportStandard || !startDate || !endDate) {
          return NextResponse.json({ 
            error: 'Missing required fields: reportStandard, startDate, endDate' 
          }, { status: 400 });
        }

        const report = await complianceEngine.generateComplianceReport(
          reportStandard,
          new Date(startDate),
          new Date(endDate),
          reportType || 'periodic'
        );

        return NextResponse.json({ 
          message: 'Compliance report generated successfully',
          report 
        }, { status: 201 });

      case 'export_data':
        const { exportStandard, exportStartDate, exportEndDate, format } = data;
        
        if (!exportStandard || !exportStartDate || !exportEndDate) {
          return NextResponse.json({ 
            error: 'Missing required fields: exportStandard, exportStartDate, exportEndDate' 
          }, { status: 400 });
        }

        const exportData = await complianceEngine.exportComplianceData(
          exportStandard,
          new Date(exportStartDate),
          new Date(exportEndDate),
          format || 'json'
        );

        const headers: Record<string, string> = {};
        let contentType = 'application/json';
        let filename = `compliance_${exportStandard}_${new Date().toISOString().split('T')[0]}.json`;

        if (format === 'csv') {
          contentType = 'text/csv';
          filename = filename.replace('.json', '.csv');
        } else if (format === 'xml') {
          contentType = 'application/xml';
          filename = filename.replace('.json', '.xml');
        }

        headers['Content-Type'] = contentType;
        headers['Content-Disposition'] = `attachment; filename="${filename}"`;

        return new Response(exportData, { headers });

      default:
        return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 });
    }

  } catch (error) {
    console.error('Failed to process compliance action:', error);
    return NextResponse.json({ error: 'Failed to process compliance action' }, { status: 500 });
  }
}

// PUT /api/audit-logs/compliance - Update compliance rule or resolve violation
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    const action = data.action;

    switch (action) {
      case 'update_rule':
        const { ruleId, updates } = data;
        
        if (!ruleId) {
          return NextResponse.json({ error: 'Missing ruleId' }, { status: 400 });
        }

        const updatedRule = await complianceEngine.updateRule(ruleId, updates);
        
        if (!updatedRule) {
          return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
        }

        return NextResponse.json({ 
          message: 'Compliance rule updated successfully',
          rule: updatedRule 
        });

      case 'resolve_violation':
        const { violationId, resolution } = data;
        
        if (!violationId || !resolution) {
          return NextResponse.json({ 
            error: 'Missing required fields: violationId, resolution' 
          }, { status: 400 });
        }

        const success = await complianceEngine.resolveViolation(violationId, {
          ...resolution,
          resolvedBy: session.user.id || session.user.email || 'unknown'
        });

        if (!success) {
          return NextResponse.json({ error: 'Failed to resolve violation' }, { status: 500 });
        }

        return NextResponse.json({ 
          message: 'Violation resolved successfully' 
        });

      default:
        return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 });
    }

  } catch (error) {
    console.error('Failed to process compliance update:', error);
    return NextResponse.json({ error: 'Failed to process compliance update' }, { status: 500 });
  }
}