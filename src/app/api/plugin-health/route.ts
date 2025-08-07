import { NextRequest, NextResponse } from 'next/server';

interface PluginHealthMetric {
  timestamp: string;
  value: number;
  status: 'healthy' | 'warning' | 'critical';
}

interface PluginHealthData {
  pluginId: string;
  pluginName: string;
  status: 'running' | 'stopped' | 'error' | 'starting' | 'updating';
  health: 'healthy' | 'warning' | 'critical' | 'unknown';
  uptime: number;
  lastCheck: string;
  version: string;
  metrics: {
    responseTime: PluginHealthMetric[];
    memoryUsage: PluginHealthMetric[];
    errorRate: PluginHealthMetric[];
    requestCount: PluginHealthMetric[];
    cpuUsage: PluginHealthMetric[];
  };
  dependencies: {
    id: string;
    name: string;
    status: 'healthy' | 'warning' | 'critical';
    lastChecked: string;
  }[];
  errors: {
    timestamp: string;
    level: 'error' | 'warning' | 'info';
    message: string;
    stack?: string;
  }[];
  configuration: {
    enabled: boolean;
    autoRestart: boolean;
    healthCheckInterval: number;
    maxMemoryUsage: number;
    maxResponseTime: number;
  };
}

interface PluginHealthSummary {
  totalPlugins: number;
  healthyPlugins: number;
  warningPlugins: number;
  criticalPlugins: number;
  averageUptime: number;
  totalRequests: number;
  averageResponseTime: number;
  errorRate: number;
}

// Mock plugin health data
const generateMockHealthData = (): PluginHealthData[] => {
  const plugins = [
    { id: '@backstage/plugin-catalog', name: 'Software Catalog' },
    { id: '@backstage/plugin-kubernetes', name: 'Kubernetes' },
    { id: '@backstage/plugin-techdocs', name: 'TechDocs' },
    { id: '@roadiehq/backstage-plugin-github-actions', name: 'GitHub Actions' },
    { id: '@backstage/plugin-jenkins', name: 'Jenkins' },
    { id: '@backstage/plugin-cost-insights', name: 'Cost Insights' },
    { id: '@spotify/backstage-plugin-lighthouse', name: 'Lighthouse' }
  ];

  return plugins.map((plugin, index) => {
    const isHealthy = Math.random() > 0.2; // 80% chance of being healthy
    const hasWarning = !isHealthy && Math.random() > 0.5;
    const health = isHealthy ? 'healthy' : hasWarning ? 'warning' : 'critical';
    const status = health === 'critical' ? 'error' : 'running';

    // Generate time series data for last 24 hours
    const generateTimeSeries = (baseValue: number, variance: number, statusMultiplier = 1) => {
      const data: PluginHealthMetric[] = [];
      const now = new Date();
      
      for (let i = 23; i >= 0; i--) {
        const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000).toISOString();
        const value = Math.max(0, baseValue + (Math.random() - 0.5) * variance * statusMultiplier);
        const metricStatus = value > baseValue * 1.5 ? 'critical' : 
                           value > baseValue * 1.2 ? 'warning' : 'healthy';
        
        data.push({
          timestamp,
          value: Math.round(value * 100) / 100,
          status: metricStatus
        });
      }
      return data;
    };

    const healthMultiplier = health === 'critical' ? 3 : health === 'warning' ? 1.5 : 1;

    return {
      pluginId: plugin.id,
      pluginName: plugin.name,
      status,
      health,
      uptime: Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000), // Up to 30 days in ms
      lastCheck: new Date().toISOString(),
      version: `1.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`,
      metrics: {
        responseTime: generateTimeSeries(150, 100, healthMultiplier),
        memoryUsage: generateTimeSeries(256, 128, healthMultiplier),
        errorRate: generateTimeSeries(0.5, 2, healthMultiplier),
        requestCount: generateTimeSeries(1000, 500, 1 / healthMultiplier),
        cpuUsage: generateTimeSeries(25, 20, healthMultiplier)
      },
      dependencies: [
        {
          id: '@backstage/core-plugin-api',
          name: 'Core Plugin API',
          status: Math.random() > 0.1 ? 'healthy' : 'warning',
          lastChecked: new Date().toISOString()
        },
        {
          id: 'react',
          name: 'React',
          status: 'healthy',
          lastChecked: new Date().toISOString()
        }
      ],
      errors: health !== 'healthy' ? [
        {
          timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
          level: health === 'critical' ? 'error' : 'warning',
          message: health === 'critical' 
            ? 'Plugin crashed due to unhandled exception'
            : 'High memory usage detected',
          stack: health === 'critical' ? `Error: Unhandled exception
    at PluginComponent.render (/app/plugins/${plugin.id}/index.js:142:15)
    at ReactDOM.render (/node_modules/react-dom/index.js:1847:12)` : undefined
        }
      ] : [],
      configuration: {
        enabled: true,
        autoRestart: true,
        healthCheckInterval: 30000, // 30 seconds
        maxMemoryUsage: 512, // MB
        maxResponseTime: 5000 // ms
      }
    };
  });
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pluginId = searchParams.get('pluginId');
    const action = searchParams.get('action') || 'list';
    const timeRange = searchParams.get('timeRange') || '24h';

    const healthData = generateMockHealthData();

    if (action === 'summary') {
      const summary: PluginHealthSummary = {
        totalPlugins: healthData.length,
        healthyPlugins: healthData.filter(p => p.health === 'healthy').length,
        warningPlugins: healthData.filter(p => p.health === 'warning').length,
        criticalPlugins: healthData.filter(p => p.health === 'critical').length,
        averageUptime: healthData.reduce((sum, p) => sum + p.uptime, 0) / healthData.length,
        totalRequests: healthData.reduce((sum, p) => 
          sum + p.metrics.requestCount.reduce((s, m) => s + m.value, 0), 0
        ),
        averageResponseTime: healthData.reduce((sum, p) => 
          sum + p.metrics.responseTime.reduce((s, m) => s + m.value, 0) / p.metrics.responseTime.length, 0
        ) / healthData.length,
        errorRate: healthData.reduce((sum, p) => 
          sum + p.metrics.errorRate.reduce((s, m) => s + m.value, 0) / p.metrics.errorRate.length, 0
        ) / healthData.length
      };

      return NextResponse.json({
        success: true,
        summary
      });
    }

    if (pluginId) {
      const plugin = healthData.find(p => p.pluginId === pluginId);
      if (!plugin) {
        return NextResponse.json({
          success: false,
          error: 'Plugin not found'
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        plugin
      });
    }

    // Return all plugins with optional filtering
    const status = searchParams.get('status');
    const health = searchParams.get('health');

    let filteredData = healthData;

    if (status) {
      filteredData = filteredData.filter(p => p.status === status);
    }

    if (health) {
      filteredData = filteredData.filter(p => p.health === health);
    }

    return NextResponse.json({
      success: true,
      plugins: filteredData,
      total: filteredData.length
    });

  } catch (error) {
    console.error('Error fetching plugin health:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { pluginId, action, configuration } = await request.json();

    if (!pluginId || !action) {
      return NextResponse.json({
        success: false,
        error: 'Plugin ID and action are required'
      }, { status: 400 });
    }

    // Simulate plugin management actions
    switch (action) {
      case 'restart':
        // Simulate plugin restart
        await new Promise(resolve => setTimeout(resolve, 2000));
        return NextResponse.json({
          success: true,
          message: `Plugin ${pluginId} restarted successfully`
        });

      case 'stop':
        // Simulate plugin stop
        return NextResponse.json({
          success: true,
          message: `Plugin ${pluginId} stopped successfully`
        });

      case 'start':
        // Simulate plugin start
        await new Promise(resolve => setTimeout(resolve, 1500));
        return NextResponse.json({
          success: true,
          message: `Plugin ${pluginId} started successfully`
        });

      case 'configure':
        // Simulate plugin configuration update
        if (!configuration) {
          return NextResponse.json({
            success: false,
            error: 'Configuration is required'
          }, { status: 400 });
        }
        
        return NextResponse.json({
          success: true,
          message: `Plugin ${pluginId} configuration updated successfully`,
          configuration
        });

      case 'health-check':
        // Simulate manual health check
        const healthStatus = Math.random() > 0.8 ? 'warning' : 'healthy';
        return NextResponse.json({
          success: true,
          health: {
            status: healthStatus,
            timestamp: new Date().toISOString(),
            message: healthStatus === 'healthy' 
              ? 'Plugin is running normally'
              : 'Plugin showing high resource usage'
          }
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Error managing plugin health:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { pluginId, alerts } = await request.json();

    if (!pluginId) {
      return NextResponse.json({
        success: false,
        error: 'Plugin ID is required'
      }, { status: 400 });
    }

    // Simulate updating alert configuration
    return NextResponse.json({
      success: true,
      message: `Alert configuration updated for plugin ${pluginId}`,
      alerts
    });

  } catch (error) {
    console.error('Error updating plugin alerts:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}