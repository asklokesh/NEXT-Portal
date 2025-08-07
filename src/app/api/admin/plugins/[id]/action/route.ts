import { NextRequest, NextResponse } from 'next/server';

interface PluginActionResponse {
  success: boolean;
  message: string;
  plugin_id: string;
  action: string;
  timestamp: string;
  details?: any;
  task_id?: string;
  estimated_completion?: string;
}

interface PluginConfig {
  [key: string]: any;
}

interface PluginInfo {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  installed: boolean;
  category: string;
  author: string;
  description: string;
  status: 'active' | 'inactive' | 'error' | 'updating';
  configurable: boolean;
  dependencies?: string[];
  permissions?: string[];
}

// Mock plugin data
const mockPlugins: { [key: string]: PluginInfo } = {
  '@backstage/plugin-catalog': {
    id: '@backstage/plugin-catalog',
    name: 'Software Catalog',
    version: '1.22.0',
    enabled: true,
    installed: true,
    category: 'core',
    author: 'Backstage',
    description: 'Core catalog functionality for managing software components, services, and APIs',
    status: 'active',
    configurable: true,
    permissions: ['catalog.read', 'catalog.write']
  },
  '@backstage/plugin-kubernetes': {
    id: '@backstage/plugin-kubernetes',
    name: 'Kubernetes',
    version: '0.18.0',
    enabled: true,
    installed: true,
    category: 'infrastructure',
    author: 'Backstage',
    description: 'Kubernetes resource management and monitoring integration',
    status: 'active',
    configurable: true,
    dependencies: ['@backstage/plugin-catalog'],
    permissions: ['kubernetes.read']
  },
  '@backstage/plugin-github-actions': {
    id: '@backstage/plugin-github-actions',
    name: 'GitHub Actions',
    version: '0.8.0',
    enabled: false,
    installed: true,
    category: 'ci-cd',
    author: 'Backstage',
    description: 'GitHub Actions integration for CI/CD pipeline monitoring',
    status: 'inactive',
    configurable: true,
    permissions: ['github.read']
  },
  '@backstage/plugin-techdocs': {
    id: '@backstage/plugin-techdocs',
    name: 'TechDocs',
    version: '1.10.0',
    enabled: true,
    installed: true,
    category: 'documentation',
    author: 'Backstage',
    description: 'Documentation platform with docs-as-code philosophy',
    status: 'active',
    configurable: true,
    permissions: ['techdocs.read', 'techdocs.write']
  }
};

// Simulate plugin action processing
async function processPluginAction(
  pluginId: string,
  action: string,
  params?: any
): Promise<PluginActionResponse> {
  const plugin = mockPlugins[pluginId];
  
  if (!plugin) {
    throw new Error(`Plugin ${pluginId} not found`);
  }

  // Simulate processing time
  const processingTime = Math.floor(Math.random() * 2000) + 500; // 0.5-2.5 seconds
  await new Promise(resolve => setTimeout(resolve, processingTime));

  const timestamp = new Date().toISOString();
  const baseResponse = {
    success: true,
    message: '',
    plugin_id: pluginId,
    action,
    timestamp
  };

  switch (action) {
    case 'enable':
      if (plugin.enabled) {
        return {
          ...baseResponse,
          success: false,
          message: `Plugin ${plugin.name} is already enabled`
        };
      }
      
      // Check dependencies if any
      if (plugin.dependencies) {
        for (const dep of plugin.dependencies) {
          const depPlugin = mockPlugins[dep];
          if (!depPlugin || !depPlugin.enabled) {
            return {
              ...baseResponse,
              success: false,
              message: `Cannot enable ${plugin.name}: dependency ${dep} is not enabled`
            };
          }
        }
      }

      return {
        ...baseResponse,
        message: `Plugin ${plugin.name} enabled successfully`,
        details: {
          previous_status: plugin.status,
          new_status: 'active',
          restart_required: plugin.category === 'core'
        }
      };

    case 'disable':
      if (!plugin.enabled) {
        return {
          ...baseResponse,
          success: false,
          message: `Plugin ${plugin.name} is already disabled`
        };
      }

      // Check if other plugins depend on this one
      const dependentPlugins = Object.values(mockPlugins).filter(p => 
        p.dependencies?.includes(pluginId) && p.enabled
      );
      
      if (dependentPlugins.length > 0) {
        return {
          ...baseResponse,
          success: false,
          message: `Cannot disable ${plugin.name}: ${dependentPlugins.length} plugin(s) depend on it`,
          details: {
            dependent_plugins: dependentPlugins.map(p => ({ id: p.id, name: p.name }))
          }
        };
      }

      return {
        ...baseResponse,
        message: `Plugin ${plugin.name} disabled successfully`,
        details: {
          previous_status: plugin.status,
          new_status: 'inactive',
          restart_required: plugin.category === 'core'
        }
      };

    case 'configure':
      if (!plugin.configurable) {
        return {
          ...baseResponse,
          success: false,
          message: `Plugin ${plugin.name} is not configurable`
        };
      }

      const config = params?.config || {};
      
      return {
        ...baseResponse,
        message: `Plugin ${plugin.name} configured successfully`,
        details: {
          config_updated: Object.keys(config),
          restart_required: true,
          config_backup_id: `backup-${Date.now()}`
        }
      };

    case 'restart':
      if (!plugin.enabled) {
        return {
          ...baseResponse,
          success: false,
          message: `Cannot restart disabled plugin ${plugin.name}`
        };
      }

      return {
        ...baseResponse,
        message: `Plugin ${plugin.name} restart initiated`,
        task_id: `restart-${pluginId}-${Date.now()}`,
        estimated_completion: new Date(Date.now() + 30000).toISOString(), // 30 seconds
        details: {
          expected_downtime: '10-15 seconds',
          affected_features: ['API endpoints', 'Frontend components']
        }
      };

    case 'update':
      const availableVersion = `${plugin.version.split('.').slice(0, 2).join('.')}.${parseInt(plugin.version.split('.')[2]) + 1}`;
      
      return {
        ...baseResponse,
        message: `Plugin ${plugin.name} update started`,
        task_id: `update-${pluginId}-${Date.now()}`,
        estimated_completion: new Date(Date.now() + 300000).toISOString(), // 5 minutes
        details: {
          current_version: plugin.version,
          target_version: availableVersion,
          changelog_url: `https://github.com/backstage/backstage/releases/tag/v${availableVersion}`,
          breaking_changes: false,
          backup_created: true
        }
      };

    case 'uninstall':
      if (plugin.category === 'core') {
        return {
          ...baseResponse,
          success: false,
          message: `Cannot uninstall core plugin ${plugin.name}`
        };
      }

      // Check dependencies again
      const dependents = Object.values(mockPlugins).filter(p => 
        p.dependencies?.includes(pluginId) && p.installed
      );
      
      if (dependents.length > 0) {
        return {
          ...baseResponse,
          success: false,
          message: `Cannot uninstall ${plugin.name}: other plugins depend on it`,
          details: {
            dependent_plugins: dependents.map(p => ({ id: p.id, name: p.name }))
          }
        };
      }

      return {
        ...baseResponse,
        message: `Plugin ${plugin.name} uninstall initiated`,
        task_id: `uninstall-${pluginId}-${Date.now()}`,
        estimated_completion: new Date(Date.now() + 60000).toISOString(), // 1 minute
        details: {
          data_cleanup: true,
          config_backup: `backup-${Date.now()}`,
          rollback_available: true
        }
      };

    case 'health_check':
      const healthScore = Math.floor(Math.random() * 40) + 60; // 60-100
      const issues = healthScore < 80 ? ['High memory usage', 'Slow response times'] : [];
      
      return {
        ...baseResponse,
        message: `Health check completed for ${plugin.name}`,
        details: {
          health_score: healthScore,
          status: healthScore >= 90 ? 'excellent' : healthScore >= 80 ? 'good' : 'needs attention',
          issues,
          last_error: issues.length > 0 ? new Date(Date.now() - 3600000).toISOString() : null,
          performance_metrics: {
            response_time: Math.floor(Math.random() * 200) + 50,
            memory_usage: Math.floor(Math.random() * 100) + 20,
            error_rate: Math.random() * 5
          }
        }
      };

    case 'reset_config':
      if (!plugin.configurable) {
        return {
          ...baseResponse,
          success: false,
          message: `Plugin ${plugin.name} is not configurable`
        };
      }

      return {
        ...baseResponse,
        message: `Configuration reset to defaults for ${plugin.name}`,
        details: {
          config_backup_id: `backup-${Date.now()}`,
          reset_items: ['authentication', 'api_endpoints', 'display_settings'],
          restart_required: true
        }
      };

    case 'export_config':
      if (!plugin.configurable) {
        return {
          ...baseResponse,
          success: false,
          message: `Plugin ${plugin.name} has no configuration to export`
        };
      }

      return {
        ...baseResponse,
        message: `Configuration exported for ${plugin.name}`,
        details: {
          export_id: `export-${Date.now()}`,
          download_url: `/api/admin/plugins/${pluginId}/config/export`,
          expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour
          format: params?.format || 'json'
        }
      };

    case 'import_config':
      if (!plugin.configurable) {
        return {
          ...baseResponse,
          success: false,
          message: `Plugin ${plugin.name} is not configurable`
        };
      }

      const configData = params?.config_data;
      if (!configData) {
        return {
          ...baseResponse,
          success: false,
          message: 'Configuration data is required for import'
        };
      }

      return {
        ...baseResponse,
        message: `Configuration imported for ${plugin.name}`,
        details: {
          config_backup_id: `backup-${Date.now()}`,
          imported_settings: Object.keys(configData),
          validation_passed: true,
          restart_required: true
        }
      };

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pluginId = decodeURIComponent(params.id);
    const body = await request.json();
    const { action, ...actionParams } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      );
    }

    // Validate plugin exists
    if (!mockPlugins[pluginId]) {
      return NextResponse.json(
        { error: `Plugin ${pluginId} not found` },
        { status: 404 }
      );
    }

    const result = await processPluginAction(pluginId, action, actionParams);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error processing plugin action:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      plugin_id: params.id,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pluginId = decodeURIComponent(params.id);
    const { searchParams } = new URL(request.url);
    const includeConfig = searchParams.get('include_config') === 'true';
    const includeMetrics = searchParams.get('include_metrics') === 'true';

    const plugin = mockPlugins[pluginId];
    if (!plugin) {
      return NextResponse.json(
        { error: `Plugin ${pluginId} not found` },
        { status: 404 }
      );
    }

    const response: any = {
      success: true,
      plugin: { ...plugin }
    };

    if (includeConfig && plugin.configurable) {
      response.config = {
        api_endpoints: ['https://api.example.com'],
        authentication_enabled: true,
        cache_ttl: 300,
        max_retries: 3
      };
    }

    if (includeMetrics) {
      response.metrics = {
        uptime_percentage: 99.5,
        avg_response_time: Math.floor(Math.random() * 200) + 50,
        requests_per_hour: Math.floor(Math.random() * 1000) + 100,
        error_rate: Math.random() * 2,
        last_restart: new Date(Date.now() - 86400000).toISOString(),
        memory_usage: Math.floor(Math.random() * 100) + 20,
        cpu_usage: Math.floor(Math.random() * 50) + 10
      };
    }

    // Available actions for this plugin
    response.available_actions = [
      plugin.enabled ? 'disable' : 'enable',
      'restart',
      'health_check',
      'update'
    ];

    if (plugin.configurable) {
      response.available_actions.push('configure', 'reset_config', 'export_config', 'import_config');
    }

    if (plugin.category !== 'core') {
      response.available_actions.push('uninstall');
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching plugin details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch plugin details' },
      { status: 500 }
    );
  }
}