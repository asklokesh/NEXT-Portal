import { NextRequest, NextResponse } from 'next/server';

interface AdminStats {
  platform: {
    health: 'healthy' | 'warning' | 'critical';
    uptime: string;
    version: string;
    last_updated: string;
  };
  users: {
    total: number;
    active_today: number;
    active_this_week: number;
    active_this_month: number;
    new_this_month: number;
  };
  entities: {
    total: number;
    services: number;
    components: number;
    apis: number;
    orphaned: number;
    updated_today: number;
  };
  templates: {
    total: number;
    active: number;
    pending_review: number;
    used_this_month: number;
    most_popular: string;
  };
  plugins: {
    installed: number;
    enabled: number;
    disabled: number;
    updates_available: number;
    core: number;
    community: number;
  };
  activity: {
    api_requests_today: number;
    deployments_today: number;
    templates_created_today: number;
    catalog_updates_today: number;
  };
  performance: {
    avg_response_time: number;
    error_rate: number;
    cpu_usage: number;
    memory_usage: number;
    disk_usage: number;
  };
  security: {
    failed_logins_today: number;
    active_sessions: number;
    privileged_users: number;
    last_security_scan: string;
  };
  growth: {
    user_growth_monthly: number;
    entity_growth_monthly: number;
    template_usage_growth: number;
    api_usage_growth: number;
  };
}

interface ActivityLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
  severity: 'info' | 'warning' | 'error';
}

// Mock data for development
function generateMockStats(): AdminStats {
  const now = new Date();
  
  return {
    platform: {
      health: 'healthy',
      uptime: '99.9%',
      version: '1.29.0',
      last_updated: '2024-01-15T10:30:00Z'
    },
    users: {
      total: 156,
      active_today: 89,
      active_this_week: 134,
      active_this_month: 152,
      new_this_month: 12
    },
    entities: {
      total: 234,
      services: 89,
      components: 112,
      apis: 33,
      orphaned: 5,
      updated_today: 23
    },
    templates: {
      total: 45,
      active: 38,
      pending_review: 2,
      used_this_month: 127,
      most_popular: 'React Microservice'
    },
    plugins: {
      installed: 12,
      enabled: 8,
      disabled: 4,
      updates_available: 3,
      core: 5,
      community: 7
    },
    activity: {
      api_requests_today: 15432,
      deployments_today: 42,
      templates_created_today: 8,
      catalog_updates_today: 67
    },
    performance: {
      avg_response_time: 45, // ms
      error_rate: 0.2, // percentage
      cpu_usage: 34, // percentage
      memory_usage: 67, // percentage
      disk_usage: 45 // percentage
    },
    security: {
      failed_logins_today: 3,
      active_sessions: 89,
      privileged_users: 12,
      last_security_scan: '2024-01-14T20:00:00Z'
    },
    growth: {
      user_growth_monthly: 8.5, // percentage
      entity_growth_monthly: 12.3, // percentage
      template_usage_growth: 15.2, // percentage
      api_usage_growth: 22.7 // percentage
    }
  };
}

function generateMockActivityLogs(): ActivityLog[] {
  const activities = [
    {
      id: '1',
      timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
      user: 'admin@company.com',
      action: 'Plugin Enabled',
      details: 'Enabled @backstage/plugin-kubernetes',
      severity: 'info' as const
    },
    {
      id: '2',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
      user: 'system',
      action: 'System Update',
      details: 'Updated Backstage to version 1.29.0',
      severity: 'info' as const
    },
    {
      id: '3',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), // 4 hours ago
      user: 'admin@company.com',
      action: 'Template Approved',
      details: 'Approved template: React Native Mobile App',
      severity: 'info' as const
    },
    {
      id: '4',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), // 6 hours ago
      user: 'security-scanner',
      action: 'Security Scan',
      details: 'Completed security vulnerability scan - 0 critical issues found',
      severity: 'info' as const
    },
    {
      id: '5',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(), // 8 hours ago
      user: 'admin@company.com',
      action: 'User Access Modified',
      details: 'Added 5 new users to Engineering team',
      severity: 'warning' as const
    },
    {
      id: '6',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(), // 12 hours ago
      user: 'system',
      action: 'Backup Completed',
      details: 'Daily database backup completed successfully',
      severity: 'info' as const
    }
  ];

  return activities;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeActivity = searchParams.get('include_activity') === 'true';
    const timeRange = searchParams.get('time_range') || '24h';

    const stats = generateMockStats();
    const response: any = { stats };

    if (includeActivity) {
      response.recent_activity = generateMockActivityLogs();
    }

    // Add time-based filtering if needed
    if (timeRange === '7d') {
      // Simulate weekly data adjustments
      stats.users.active_this_week = stats.users.active_today * 7;
      stats.activity.api_requests_today = stats.activity.api_requests_today * 7;
    } else if (timeRange === '30d') {
      // Simulate monthly data adjustments
      stats.users.active_this_month = stats.users.active_today * 30;
      stats.activity.api_requests_today = stats.activity.api_requests_today * 30;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch admin statistics' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, params } = body;

    switch (action) {
      case 'refresh_stats':
        // Simulate stats refresh
        await new Promise(resolve => setTimeout(resolve, 1000));
        return NextResponse.json({
          success: true,
          message: 'Statistics refreshed successfully',
          timestamp: new Date().toISOString()
        });

      case 'export_stats':
        const format = params?.format || 'json';
        return NextResponse.json({
          success: true,
          message: `Statistics export prepared in ${format} format`,
          download_url: `/api/admin/stats/export?format=${format}`,
          expires_at: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
        });

      case 'generate_report':
        const reportType = params?.type || 'summary';
        return NextResponse.json({
          success: true,
          message: `${reportType} report generation started`,
          report_id: `report-${Date.now()}`,
          estimated_completion: new Date(Date.now() + 300000).toISOString() // 5 minutes from now
        });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error handling stats action:', error);
    return NextResponse.json(
      { error: 'Failed to process stats action' },
      { status: 500 }
    );
  }
}