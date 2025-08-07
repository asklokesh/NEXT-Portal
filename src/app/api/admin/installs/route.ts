import { NextRequest, NextResponse } from 'next/server';

interface InstallMetrics {
  overview: {
    total_installations: number;
    active_installations: number;
    failed_installations: number;
    success_rate: number;
    avg_install_time: number; // in seconds
    total_uninstalls: number;
    retention_rate: number;
  };
  installation_trends: {
    date: string;
    successful_installs: number;
    failed_installs: number;
    uninstalls: number;
    avg_duration: number;
  }[];
  plugin_popularity: {
    plugin_id: string;
    plugin_name: string;
    install_count: number;
    success_rate: number;
    avg_install_time: number;
    user_rating: number;
    category: string;
  }[];
  failure_analysis: {
    error_type: string;
    count: number;
    percentage: number;
    avg_resolution_time: number;
    common_causes: string[];
  }[];
  geographic_distribution: {
    region: string;
    installations: number;
    success_rate: number;
    avg_bandwidth: number;
    percentage: number;
  }[];
  installation_sources: {
    source: string;
    installations: number;
    success_rate: number;
    percentage: number;
  }[];
  performance_metrics: {
    fastest_install: number;
    slowest_install: number;
    median_install_time: number;
    p95_install_time: number;
    bandwidth_usage: {
      avg_mb: number;
      peak_mb: number;
      total_gb: number;
    };
  };
  user_behavior: {
    first_time_installers: number;
    repeat_installers: number;
    power_users: number; // Users with 10+ plugin installs
    avg_plugins_per_user: number;
    install_abandon_rate: number;
  };
}

interface InstallationLog {
  id: string;
  timestamp: string;
  plugin_id: string;
  plugin_name: string;
  user_id: string;
  status: 'success' | 'failed' | 'in_progress' | 'cancelled';
  duration: number;
  error_message?: string;
  install_source: string;
  user_agent: string;
  region: string;
}

// Mock data generators
function generateInstallationTrends(): InstallMetrics['installation_trends'] {
  const trends = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    trends.push({
      date: date.toISOString().split('T')[0],
      successful_installs: Math.floor(Math.random() * 50) + 20,
      failed_installs: Math.floor(Math.random() * 10) + 2,
      uninstalls: Math.floor(Math.random() * 8) + 1,
      avg_duration: Math.floor(Math.random() * 60) + 45 // 45-105 seconds
    });
  }
  return trends;
}

function generatePluginPopularity(): InstallMetrics['plugin_popularity'] {
  return [
    {
      plugin_id: '@backstage/plugin-catalog',
      plugin_name: 'Software Catalog',
      install_count: 1247,
      success_rate: 98.5,
      avg_install_time: 42,
      user_rating: 4.8,
      category: 'core'
    },
    {
      plugin_id: '@backstage/plugin-kubernetes',
      plugin_name: 'Kubernetes',
      install_count: 892,
      success_rate: 94.2,
      avg_install_time: 67,
      user_rating: 4.6,
      category: 'infrastructure'
    },
    {
      plugin_id: '@backstage/plugin-techdocs',
      plugin_name: 'TechDocs',
      install_count: 743,
      success_rate: 96.1,
      avg_install_time: 55,
      user_rating: 4.7,
      category: 'documentation'
    },
    {
      plugin_id: '@backstage/plugin-github-actions',
      plugin_name: 'GitHub Actions',
      install_count: 634,
      success_rate: 91.8,
      avg_install_time: 38,
      user_rating: 4.4,
      category: 'ci-cd'
    },
    {
      plugin_id: '@backstage/plugin-scaffolder',
      plugin_name: 'Scaffolder',
      install_count: 567,
      success_rate: 97.3,
      avg_install_time: 71,
      user_rating: 4.9,
      category: 'core'
    }
  ];
}

function generateFailureAnalysis(): InstallMetrics['failure_analysis'] {
  return [
    {
      error_type: 'Network Timeout',
      count: 23,
      percentage: 34.8,
      avg_resolution_time: 120, // seconds
      common_causes: ['Slow network connection', 'Server overload', 'Proxy configuration']
    },
    {
      error_type: 'Dependency Conflict',
      count: 18,
      percentage: 27.3,
      avg_resolution_time: 300,
      common_causes: ['Version mismatch', 'Missing dependencies', 'Circular dependencies']
    },
    {
      error_type: 'Permission Denied',
      count: 12,
      percentage: 18.2,
      avg_resolution_time: 60,
      common_causes: ['Insufficient user permissions', 'File system restrictions', 'Security policies']
    },
    {
      error_type: 'Configuration Error',
      count: 8,
      percentage: 12.1,
      avg_resolution_time: 180,
      common_causes: ['Invalid configuration', 'Missing environment variables', 'Malformed config files']
    },
    {
      error_type: 'Resource Exhaustion',
      count: 5,
      percentage: 7.6,
      avg_resolution_time: 240,
      common_causes: ['Insufficient disk space', 'Memory limits', 'CPU constraints']
    }
  ];
}

function generateInstallationLogs(): InstallationLog[] {
  const statuses: InstallationLog['status'][] = ['success', 'failed', 'in_progress'];
  const plugins = [
    { id: '@backstage/plugin-catalog', name: 'Software Catalog' },
    { id: '@backstage/plugin-kubernetes', name: 'Kubernetes' },
    { id: '@backstage/plugin-techdocs', name: 'TechDocs' }
  ];
  const sources = ['marketplace', 'npm', 'github', 'manual'];
  const regions = ['us-east-1', 'eu-west-1', 'ap-southeast-1', 'us-west-2'];

  const logs: InstallationLog[] = [];
  
  for (let i = 0; i < 20; i++) {
    const plugin = plugins[Math.floor(Math.random() * plugins.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const timestamp = new Date(Date.now() - Math.random() * 86400000 * 7); // Last 7 days
    
    logs.push({
      id: `install-${Date.now()}-${i}`,
      timestamp: timestamp.toISOString(),
      plugin_id: plugin.id,
      plugin_name: plugin.name,
      user_id: `user-${Math.floor(Math.random() * 1000)}`,
      status,
      duration: status === 'success' ? Math.floor(Math.random() * 120) + 30 : 0,
      error_message: status === 'failed' ? 'Network timeout during download' : undefined,
      install_source: sources[Math.floor(Math.random() * sources.length)],
      user_agent: 'Backstage-CLI/1.29.0',
      region: regions[Math.floor(Math.random() * regions.length)]
    });
  }

  return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

function generateMockInstallMetrics(): InstallMetrics {
  const installationTrends = generateInstallationTrends();
  const totalSuccessful = installationTrends.reduce((sum, day) => sum + day.successful_installs, 0);
  const totalFailed = installationTrends.reduce((sum, day) => sum + day.failed_installs, 0);
  const totalUninstalls = installationTrends.reduce((sum, day) => sum + day.uninstalls, 0);

  return {
    overview: {
      total_installations: totalSuccessful + totalFailed,
      active_installations: totalSuccessful - totalUninstalls,
      failed_installations: totalFailed,
      success_rate: (totalSuccessful / (totalSuccessful + totalFailed)) * 100,
      avg_install_time: 58, // seconds
      total_uninstalls: totalUninstalls,
      retention_rate: ((totalSuccessful - totalUninstalls) / totalSuccessful) * 100
    },
    installation_trends: installationTrends,
    plugin_popularity: generatePluginPopularity(),
    failure_analysis: generateFailureAnalysis(),
    geographic_distribution: [
      {
        region: 'North America',
        installations: 456,
        success_rate: 96.8,
        avg_bandwidth: 125.5,
        percentage: 42.3
      },
      {
        region: 'Europe',
        installations: 334,
        success_rate: 94.2,
        avg_bandwidth: 89.3,
        percentage: 31.0
      },
      {
        region: 'Asia Pacific',
        installations: 198,
        success_rate: 91.5,
        avg_bandwidth: 67.8,
        percentage: 18.4
      },
      {
        region: 'Latin America',
        installations: 67,
        success_rate: 89.6,
        avg_bandwidth: 45.2,
        percentage: 6.2
      },
      {
        region: 'Other',
        installations: 23,
        success_rate: 87.0,
        avg_bandwidth: 38.9,
        percentage: 2.1
      }
    ],
    installation_sources: [
      {
        source: 'Plugin Marketplace',
        installations: 678,
        success_rate: 97.2,
        percentage: 62.9
      },
      {
        source: 'NPM Registry',
        installations: 234,
        success_rate: 93.6,
        percentage: 21.7
      },
      {
        source: 'GitHub Releases',
        installations: 123,
        success_rate: 89.4,
        percentage: 11.4
      },
      {
        source: 'Manual Installation',
        installations: 43,
        success_rate: 81.4,
        percentage: 4.0
      }
    ],
    performance_metrics: {
      fastest_install: 18, // seconds
      slowest_install: 347, // seconds
      median_install_time: 52, // seconds
      p95_install_time: 156, // seconds
      bandwidth_usage: {
        avg_mb: 15.7,
        peak_mb: 89.3,
        total_gb: 17.2
      }
    },
    user_behavior: {
      first_time_installers: 89,
      repeat_installers: 245,
      power_users: 23,
      avg_plugins_per_user: 3.4,
      install_abandon_rate: 8.7 // percentage
    }
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('time_range') || '30d';
    const includeDetails = searchParams.get('include_details') === 'true';
    const pluginFilter = searchParams.get('plugin');

    const metrics = generateMockInstallMetrics();
    
    // Filter by time range
    if (timeRange === '7d') {
      metrics.installation_trends = metrics.installation_trends.slice(-7);
    } else if (timeRange === '14d') {
      metrics.installation_trends = metrics.installation_trends.slice(-14);
    }

    // Filter by plugin if specified
    if (pluginFilter) {
      metrics.plugin_popularity = metrics.plugin_popularity.filter(
        plugin => plugin.plugin_id.includes(pluginFilter) || 
                  plugin.plugin_name.toLowerCase().includes(pluginFilter.toLowerCase())
      );
    }

    const response: any = {
      success: true,
      data: metrics,
      generated_at: new Date().toISOString(),
      time_range: timeRange
    };

    if (includeDetails) {
      response.recent_installations = generateInstallationLogs();
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching install metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch installation metrics' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, params } = body;

    switch (action) {
      case 'trigger_installation':
        const { plugin_id, user_id } = params || {};
        
        if (!plugin_id) {
          return NextResponse.json(
            { error: 'plugin_id is required' },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          message: `Installation triggered for ${plugin_id}`,
          installation_id: `install-${Date.now()}`,
          estimated_duration: Math.floor(Math.random() * 120) + 30
        });

      case 'retry_failed_installation':
        const { installation_id } = params || {};
        
        return NextResponse.json({
          success: true,
          message: `Retrying installation ${installation_id}`,
          new_installation_id: `retry-${Date.now()}`,
          estimated_duration: 45
        });

      case 'bulk_install':
        const { plugin_ids } = params || {};
        
        if (!Array.isArray(plugin_ids) || plugin_ids.length === 0) {
          return NextResponse.json(
            { error: 'plugin_ids array is required' },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          message: `Bulk installation started for ${plugin_ids.length} plugins`,
          bulk_installation_id: `bulk-${Date.now()}`,
          estimated_duration: plugin_ids.length * 60,
          plugin_ids
        });

      case 'cancel_installation':
        const { cancel_installation_id } = params || {};
        
        return NextResponse.json({
          success: true,
          message: `Installation ${cancel_installation_id} cancelled successfully`
        });

      case 'export_metrics':
        const format = params?.format || 'csv';
        
        return NextResponse.json({
          success: true,
          message: `Installation metrics export prepared in ${format} format`,
          download_url: `/api/admin/installs/export?format=${format}`,
          expires_at: new Date(Date.now() + 3600000).toISOString()
        });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error handling install action:', error);
    return NextResponse.json(
      { error: 'Failed to process installation action' },
      { status: 500 }
    );
  }
}