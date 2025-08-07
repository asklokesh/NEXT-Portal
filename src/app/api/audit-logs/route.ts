import { NextRequest, NextResponse } from 'next/server';
import { auditService } from '@/lib/audit/service';
import { complianceEngine } from '@/lib/audit/compliance-engine';
import { auth } from '@/lib/auth';

// GET /api/audit-logs - Query audit logs with advanced filtering
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const resource = searchParams.get('resource');
    const action = searchParams.get('action');
    const userId = searchParams.get('userId');
    const resourceId = searchParams.get('resourceId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const includeMetadata = searchParams.get('includeMetadata') === 'true';
    const export_format = searchParams.get('export');

    // Build query options
    const queryOptions: any = {
      limit,
      offset
    };

    if (resource) queryOptions.resource = resource;
    if (action) queryOptions.action = action;
    if (userId) queryOptions.userId = userId;
    if (resourceId) queryOptions.resourceId = resourceId;
    if (startDate) queryOptions.startDate = new Date(startDate);
    if (endDate) queryOptions.endDate = new Date(endDate);

    // Execute query
    const logs = await auditService.query(queryOptions);

    // Get total count for pagination
    const totalQuery = { ...queryOptions };
    delete totalQuery.limit;
    delete totalQuery.offset;
    const allLogs = await auditService.query(totalQuery);
    const total = allLogs.length;

    // Format logs
    const formattedLogs = logs.map(log => ({
      id: log.id,
      timestamp: log.timestamp,
      userId: log.userId,
      userName: log.user?.name || log.user?.email || 'Unknown',
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      metadata: includeMetadata ? log.metadata : undefined
    }));

    // Handle export requests
    if (export_format) {
      const exportData = await generateAuditExport(formattedLogs, export_format);
      
      // Log the export activity
      await auditService.log('export', 'audit_log', null, {
        exportFormat: export_format,
        recordCount: formattedLogs.length,
        filters: queryOptions,
        reason: 'Audit log export requested'
      });

      const headers: Record<string, string> = {};
      let contentType = 'application/json';
      let filename = `audit_logs_${new Date().toISOString().split('T')[0]}.json`;

      if (export_format === 'csv') {
        contentType = 'text/csv';
        filename = filename.replace('.json', '.csv');
      } else if (export_format === 'xml') {
        contentType = 'application/xml';
        filename = filename.replace('.json', '.xml');
      }

      headers['Content-Type'] = contentType;
      headers['Content-Disposition'] = `attachment; filename="${filename}"`;

      return new Response(exportData, { headers });
    }

    // Generate analytics if requested
    const analytics = searchParams.get('analytics') === 'true' ? 
      generateAuditAnalytics(logs) : undefined;

    return NextResponse.json({
      logs: formattedLogs,
      pagination: {
        total,
        offset,
        limit,
        hasMore: offset + limit < total
      },
      analytics
    });

  } catch (error) {
    console.error('Failed to query audit logs:', error);
    return NextResponse.json({ error: 'Failed to query audit logs' }, { status: 500 });
  }
}

// POST /api/audit-logs - Create audit log entry
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, resource, resourceId, metadata, context } = await request.json();

    if (!action || !resource) {
      return NextResponse.json({ 
        error: 'Missing required fields: action, resource' 
      }, { status: 400 });
    }

    // Set context if provided
    if (context) {
      auditService.setContext({
        userId: context.userId || session.user.id || session.user.email,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        sessionId: context.sessionId
      });
    }

    // Log the event
    await auditService.log(action, resource, resourceId, metadata);

    return NextResponse.json({ 
      message: 'Audit log created successfully',
      timestamp: new Date().toISOString()
    }, { status: 201 });

  } catch (error) {
    console.error('Failed to create audit log:', error);
    return NextResponse.json({ error: 'Failed to create audit log' }, { status: 500 });
  }
}

// Helper functions
async function generateAuditExport(logs: any[], format: string): Promise<string> {
  const exportData = {
    metadata: {
      exportedAt: new Date().toISOString(),
      recordCount: logs.length,
      format
    },
    logs
  };

  switch (format) {
    case 'csv':
      return convertToCSV(logs);
    case 'xml':
      return convertToXML(exportData);
    default:
      return JSON.stringify(exportData, null, 2);
  }
}

function convertToCSV(logs: any[]): string {
  if (logs.length === 0) return 'No data';

  const headers = Object.keys(logs[0]).join(',');
  const rows = logs.map(log => 
    Object.values(log).map(value => 
      typeof value === 'string' && value.includes(',') 
        ? `"${value.replace(/"/g, '""')}"` 
        : String(value || '')
    ).join(',')
  );

  return [headers, ...rows].join('\n');
}

function convertToXML(data: any): string {
  const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>';
  const xmlData = `<auditExport>
    <metadata>
      <exportedAt>${data.metadata.exportedAt}</exportedAt>
      <recordCount>${data.metadata.recordCount}</recordCount>
      <format>${data.metadata.format}</format>
    </metadata>
    <logs>
      ${data.logs.map((log: any) => `
        <log>
          <id>${log.id}</id>
          <timestamp>${log.timestamp}</timestamp>
          <userId>${log.userId || ''}</userId>
          <userName>${log.userName || ''}</userName>
          <action>${log.action}</action>
          <resource>${log.resource}</resource>
          <resourceId>${log.resourceId || ''}</resourceId>
          <ipAddress>${log.ipAddress || ''}</ipAddress>
          <userAgent>${encodeXML(log.userAgent || '')}</userAgent>
        </log>
      `).join('')}
    </logs>
  </auditExport>`;

  return xmlHeader + xmlData;
}

function encodeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function generateAuditAnalytics(logs: any[]) {
  const analytics = {
    summary: {
      totalEvents: logs.length,
      uniqueUsers: new Set(logs.map(l => l.userId).filter(Boolean)).size,
      uniqueResources: new Set(logs.map(l => l.resource)).size,
      dateRange: {
        start: logs.length > 0 ? logs[logs.length - 1].timestamp : null,
        end: logs.length > 0 ? logs[0].timestamp : null
      }
    },
    breakdown: {
      byAction: {} as Record<string, number>,
      byResource: {} as Record<string, number>,
      byUser: {} as Record<string, number>,
      byHour: {} as Record<string, number>
    },
    trends: {
      activityByDay: {} as Record<string, number>,
      topUsers: [] as Array<{ userId: string; userName: string; count: number }>,
      topResources: [] as Array<{ resource: string; count: number }>,
      topActions: [] as Array<{ action: string; count: number }>
    }
  };

  // Calculate breakdowns
  logs.forEach(log => {
    // By action
    analytics.breakdown.byAction[log.action] = 
      (analytics.breakdown.byAction[log.action] || 0) + 1;

    // By resource
    analytics.breakdown.byResource[log.resource] = 
      (analytics.breakdown.byResource[log.resource] || 0) + 1;

    // By user
    const userKey = log.userName || log.userId || 'Unknown';
    analytics.breakdown.byUser[userKey] = 
      (analytics.breakdown.byUser[userKey] || 0) + 1;

    // By hour
    const hour = new Date(log.timestamp).getHours();
    analytics.breakdown.byHour[hour] = 
      (analytics.breakdown.byHour[hour] || 0) + 1;

    // By day
    const day = new Date(log.timestamp).toISOString().split('T')[0];
    analytics.trends.activityByDay[day] = 
      (analytics.trends.activityByDay[day] || 0) + 1;
  });

  // Calculate top items
  analytics.trends.topActions = Object.entries(analytics.breakdown.byAction)
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  analytics.trends.topResources = Object.entries(analytics.breakdown.byResource)
    .map(([resource, count]) => ({ resource, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  analytics.trends.topUsers = Object.entries(analytics.breakdown.byUser)
    .map(([userName, count]) => ({ 
      userId: userName, 
      userName, 
      count 
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return analytics;
}