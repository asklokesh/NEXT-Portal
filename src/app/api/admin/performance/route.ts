import { NextRequest, NextResponse } from 'next/server';

interface PerformanceMetrics {
  overview: {
    overall_health: 'excellent' | 'good' | 'fair' | 'poor';
    performance_score: number; // 0-100
    uptime_percentage: number;
    last_incident: string | null;
    mean_time_to_recovery: number; // minutes
  };
  system_metrics: {
    timestamp: string;
    cpu_usage: number; // percentage
    memory_usage: number; // percentage
    disk_usage: number; // percentage
    network_io: {
      bytes_in: number;
      bytes_out: number;
    };
    active_connections: number;
    queue_depth: number;
  }[];
  response_times: {
    endpoint: string;
    method: string;
    avg_response_time: number; // ms
    p95_response_time: number; // ms
    p99_response_time: number; // ms
    requests_per_minute: number;
    error_rate: number; // percentage
  }[];
  database_performance: {
    connection_pool: {
      active_connections: number;
      idle_connections: number;
      max_connections: number;
      wait_count: number;
    };
    query_performance: {
      avg_query_time: number; // ms
      slow_queries: number;
      deadlocks: number;
      cache_hit_ratio: number; // percentage
    };
    disk_io: {
      reads_per_second: number;
      writes_per_second: number;
      read_latency: number; // ms
      write_latency: number; // ms
    };
  };
  application_metrics: {
    plugin_performance: {
      plugin_id: string;
      plugin_name: string;
      load_time: number; // ms
      memory_usage: number; // MB
      error_count: number;
      active_users: number;
      performance_score: number; // 0-100
    }[];
    catalog_performance: {
      entity_count: number;
      sync_duration: number; // seconds
      last_sync: string;
      sync_errors: number;
      search_latency: number; // ms
    };
    template_performance: {
      template_renders: number;
      avg_render_time: number; // ms
      cache_hit_ratio: number; // percentage
      failed_renders: number;
    };
  };
  error_tracking: {
    total_errors: number;
    error_rate: number; // percentage
    top_errors: {
      error_type: string;
      count: number;
      percentage: number;
      last_occurrence: string;
      affected_users: number;
    }[];
    error_trends: {
      date: string;
      error_count: number;
      unique_errors: number;
    }[];
  };
  alerts: {
    active_alerts: {
      id: string;
      severity: 'critical' | 'warning' | 'info';
      title: string;
      description: string;
      triggered_at: string;
      affected_services: string[];
    }[];
    alert_history: {
      date: string;
      critical_count: number;
      warning_count: number;
      info_count: number;
      resolved_count: number;
    }[];
  };
  recommendations: {
    type: 'performance' | 'capacity' | 'optimization';
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    potential_impact: string;
    estimated_effort: string;
  }[];
}

// Mock data generators
function generateSystemMetrics(): PerformanceMetrics['system_metrics'] {
  const metrics = [];
  const now = new Date();
  
  for (let i = 59; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 60000); // Every minute for last hour
    
    metrics.push({
      timestamp: timestamp.toISOString(),
      cpu_usage: Math.floor(Math.random() * 40) + 20, // 20-60%
      memory_usage: Math.floor(Math.random() * 30) + 50, // 50-80%
      disk_usage: Math.floor(Math.random() * 20) + 40, // 40-60%
      network_io: {
        bytes_in: Math.floor(Math.random() * 1000000) + 500000,
        bytes_out: Math.floor(Math.random() * 800000) + 400000
      },
      active_connections: Math.floor(Math.random() * 200) + 100,
      queue_depth: Math.floor(Math.random() * 20) + 5
    });
  }
  
  return metrics;
}

function generateResponseTimes(): PerformanceMetrics['response_times'] {
  return [
    {
      endpoint: '/api/catalog/entities',
      method: 'GET',
      avg_response_time: 145,
      p95_response_time: 320,
      p99_response_time: 750,
      requests_per_minute: 1250,
      error_rate: 0.8
    },
    {
      endpoint: '/api/scaffolder/templates',
      method: 'GET',
      avg_response_time: 89,
      p95_response_time: 180,
      p99_response_time: 450,
      requests_per_minute: 340,
      error_rate: 0.3
    },
    {
      endpoint: '/api/techdocs/*',
      method: 'GET',
      avg_response_time: 234,
      p95_response_time: 580,
      p99_response_time: 1200,
      requests_per_minute: 890,
      error_rate: 1.2
    },
    {
      endpoint: '/api/auth/me',
      method: 'GET',
      avg_response_time: 42,
      p95_response_time: 95,
      p99_response_time: 180,
      requests_per_minute: 2340,
      error_rate: 0.1
    },
    {
      endpoint: '/api/search/query',
      method: 'POST',
      avg_response_time: 187,
      p95_response_time: 420,
      p99_response_time: 890,
      requests_per_minute: 567,
      error_rate: 2.1
    }
  ];
}

function generatePluginPerformance(): PerformanceMetrics['application_metrics']['plugin_performance'] {
  return [
    {
      plugin_id: '@backstage/plugin-catalog',
      plugin_name: 'Software Catalog',
      load_time: 156,
      memory_usage: 45.2,
      error_count: 3,
      active_users: 234,
      performance_score: 92
    },
    {
      plugin_id: '@backstage/plugin-kubernetes',
      plugin_name: 'Kubernetes',
      load_time: 287,
      memory_usage: 67.8,
      error_count: 8,
      active_users: 89,
      performance_score: 78
    },
    {
      plugin_id: '@backstage/plugin-techdocs',
      plugin_name: 'TechDocs',
      load_time: 234,
      memory_usage: 52.1,
      error_count: 5,
      active_users: 156,
      performance_score: 85
    },
    {
      plugin_id: '@backstage/plugin-scaffolder',
      plugin_name: 'Scaffolder',
      load_time: 198,
      memory_usage: 38.9,
      error_count: 2,
      active_users: 78,
      performance_score: 94
    },
    {
      plugin_id: '@backstage/plugin-search',
      plugin_name: 'Search',
      load_time: 123,
      memory_usage: 29.4,
      error_count: 1,
      active_users: 298,
      performance_score: 96
    }
  ];
}

function generateErrorTrends(): PerformanceMetrics['error_tracking']['error_trends'] {
  const trends = [];
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    trends.push({
      date: date.toISOString().split('T')[0],
      error_count: Math.floor(Math.random() * 50) + 10,
      unique_errors: Math.floor(Math.random() * 15) + 3
    });
  }
  
  return trends;
}

function generateActiveAlerts(): PerformanceMetrics['alerts']['active_alerts'] {
  return [
    {
      id: 'alert-001',
      severity: 'warning' as const,
      title: 'High Memory Usage',
      description: 'Memory usage has exceeded 75% for the past 10 minutes',
      triggered_at: new Date(Date.now() - 600000).toISOString(), // 10 minutes ago
      affected_services: ['backstage-backend', 'catalog-service']
    },
    {
      id: 'alert-002',
      severity: 'info' as const,
      title: 'Slow Database Queries',
      description: 'Average query time has increased by 20% compared to baseline',
      triggered_at: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
      affected_services: ['database', 'catalog-service']
    }
  ];
}

function generateAlertHistory(): PerformanceMetrics['alerts']['alert_history'] {
  const history = [];
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    history.push({
      date: date.toISOString().split('T')[0],
      critical_count: Math.floor(Math.random() * 3),
      warning_count: Math.floor(Math.random() * 8) + 2,
      info_count: Math.floor(Math.random() * 15) + 5,
      resolved_count: Math.floor(Math.random() * 20) + 8
    });
  }
  
  return history;
}

function generateMockPerformanceMetrics(): PerformanceMetrics {
  return {
    overview: {
      overall_health: 'good',
      performance_score: 87,
      uptime_percentage: 99.94,
      last_incident: new Date(Date.now() - 86400000 * 3).toISOString(), // 3 days ago
      mean_time_to_recovery: 23 // minutes
    },
    system_metrics: generateSystemMetrics(),
    response_times: generateResponseTimes(),
    database_performance: {
      connection_pool: {
        active_connections: 45,
        idle_connections: 15,
        max_connections: 100,
        wait_count: 3
      },
      query_performance: {
        avg_query_time: 12.4,
        slow_queries: 5,
        deadlocks: 0,
        cache_hit_ratio: 94.2
      },
      disk_io: {
        reads_per_second: 234,
        writes_per_second: 89,
        read_latency: 4.2,
        write_latency: 6.8
      }
    },
    application_metrics: {
      plugin_performance: generatePluginPerformance(),
      catalog_performance: {
        entity_count: 1247,
        sync_duration: 145,
        last_sync: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        sync_errors: 2,
        search_latency: 87
      },
      template_performance: {
        template_renders: 342,
        avg_render_time: 234,
        cache_hit_ratio: 78.5,
        failed_renders: 8
      }
    },
    error_tracking: {
      total_errors: 156,
      error_rate: 1.2,
      top_errors: [
        {
          error_type: 'NetworkTimeoutError',
          count: 34,
          percentage: 21.8,
          last_occurrence: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
          affected_users: 12
        },
        {
          error_type: 'ValidationError',
          count: 28,
          percentage: 17.9,
          last_occurrence: new Date(Date.now() - 600000).toISOString(), // 10 minutes ago
          affected_users: 8
        },
        {
          error_type: 'DatabaseConnectionError',
          count: 19,
          percentage: 12.2,
          last_occurrence: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
          affected_users: 23
        }
      ],
      error_trends: generateErrorTrends()
    },
    alerts: {
      active_alerts: generateActiveAlerts(),
      alert_history: generateAlertHistory()
    },
    recommendations: [
      {
        type: 'performance',
        priority: 'high',
        title: 'Optimize Database Queries',
        description: 'Several slow queries detected that could benefit from indexing',
        potential_impact: 'Reduce query time by 40-60%',
        estimated_effort: '2-3 hours'
      },
      {
        type: 'capacity',
        priority: 'medium',
        title: 'Increase Memory Allocation',
        description: 'Memory usage consistently above 70% during peak hours',
        potential_impact: 'Improve response times by 15-20%',
        estimated_effort: 'Infrastructure change required'
      },
      {
        type: 'optimization',
        priority: 'low',
        title: 'Enable Response Compression',
        description: 'Large API responses could benefit from gzip compression',
        potential_impact: 'Reduce bandwidth usage by 30-40%',
        estimated_effort: '1 hour'
      }
    ]
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('time_range') || '1h';
    const includeRecommendations = searchParams.get('include_recommendations') === 'true';
    const metrics = searchParams.get('metrics'); // specific metrics to include

    const performanceData = generateMockPerformanceMetrics();

    // Filter system metrics by time range
    if (timeRange === '30m') {
      performanceData.system_metrics = performanceData.system_metrics.slice(-30);
    } else if (timeRange === '6h') {
      // Simulate 6-hour data by sampling every 6 minutes
      performanceData.system_metrics = performanceData.system_metrics.filter((_, index) => index % 6 === 0);
    }

    // Filter specific metrics if requested
    const response: any = {
      success: true,
      data: performanceData,
      generated_at: new Date().toISOString(),
      time_range: timeRange
    };

    if (metrics) {
      const requestedMetrics = metrics.split(',');
      const filteredData: any = { overview: performanceData.overview };
      
      if (requestedMetrics.includes('system')) {
        filteredData.system_metrics = performanceData.system_metrics;
      }
      if (requestedMetrics.includes('database')) {
        filteredData.database_performance = performanceData.database_performance;
      }
      if (requestedMetrics.includes('errors')) {
        filteredData.error_tracking = performanceData.error_tracking;
      }
      
      response.data = filteredData;
    }

    if (!includeRecommendations) {
      delete response.data.recommendations;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching performance metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch performance metrics' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, params } = body;

    switch (action) {
      case 'run_health_check':
        // Simulate health check
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        return NextResponse.json({
          success: true,
          message: 'Health check completed',
          health_score: Math.floor(Math.random() * 20) + 80, // 80-100
          timestamp: new Date().toISOString(),
          issues_found: Math.floor(Math.random() * 3),
          recommendations_count: Math.floor(Math.random() * 5) + 1
        });

      case 'clear_cache':
        const cacheType = params?.cache_type || 'all';
        
        return NextResponse.json({
          success: true,
          message: `${cacheType} cache cleared successfully`,
          cache_type: cacheType,
          performance_impact: 'Temporary increase in response times expected',
          cleared_at: new Date().toISOString()
        });

      case 'restart_service':
        const serviceName = params?.service_name;
        
        if (!serviceName) {
          return NextResponse.json(
            { error: 'service_name is required' },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          message: `${serviceName} restart initiated`,
          service_name: serviceName,
          estimated_downtime: '2-3 minutes',
          restart_id: `restart-${Date.now()}`
        });

      case 'optimize_database':
        return NextResponse.json({
          success: true,
          message: 'Database optimization started',
          optimization_id: `opt-${Date.now()}`,
          estimated_duration: '10-15 minutes',
          expected_improvements: [
            'Rebuild indexes',
            'Update table statistics',
            'Analyze query plans'
          ]
        });

      case 'export_performance_report':
        const format = params?.format || 'pdf';
        const period = params?.period || '7d';
        
        return NextResponse.json({
          success: true,
          message: `Performance report generation started`,
          report_id: `perf-report-${Date.now()}`,
          format,
          period,
          download_url: `/api/admin/performance/reports/${Date.now()}`,
          estimated_completion: new Date(Date.now() + 300000).toISOString() // 5 minutes
        });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error handling performance action:', error);
    return NextResponse.json(
      { error: 'Failed to process performance action' },
      { status: 500 }
    );
  }
}