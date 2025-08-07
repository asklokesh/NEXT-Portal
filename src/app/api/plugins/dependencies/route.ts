/**
 * Plugin Dependencies API Route
 * 
 * Handles plugin dependency analysis, resolution, and conflict detection.
 */

import { NextRequest, NextResponse } from 'next/server';
import { DependencyResolver } from '@/lib/plugins/DependencyResolver';
import { Plugin, ResolutionStrategy, ApiResponse } from '@/lib/plugins/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pluginIds = searchParams.get('plugins')?.split(',') || [];
    const strategy = (searchParams.get('strategy') as ResolutionStrategy) || 'strict';
    const includeOptional = searchParams.get('includeOptional') === 'true';

    // Mock plugin data - in a real implementation, this would come from a database
    const mockPlugins: Plugin[] = [
      {
        id: '@backstage/plugin-catalog',
        name: 'Service Catalog',
        version: '1.15.0',
        type: 'core',
        backstageVersion: '^1.15.0',
        dependencies: [
          { id: '@backstage/core-components', version: '0.14.4', versionConstraint: '^0.14.0' },
          { id: '@backstage/core-plugin-api', version: '1.8.2', versionConstraint: '^1.8.0' }
        ]
      },
      {
        id: '@backstage/plugin-scaffolder',
        name: 'Software Templates',
        version: '1.17.0',
        type: 'core',
        backstageVersion: '^1.15.0',
        dependencies: [
          { id: '@backstage/core-components', version: '0.14.4', versionConstraint: '^0.14.0' },
          { id: '@backstage/plugin-catalog-react', version: '1.9.3', versionConstraint: '^1.9.0' }
        ]
      },
      {
        id: '@backstage/plugin-tech-radar',
        name: 'Tech Radar',
        version: '0.6.13',
        type: 'frontend',
        backstageVersion: '^1.15.0',
        dependencies: [
          { id: '@backstage/core-components', version: '0.14.4', versionConstraint: '^0.14.0' },
          { id: 'd3', version: '7.8.5', versionConstraint: '^7.0.0' }
        ]
      },
      {
        id: '@backstage/core-components',
        name: 'Core Components',
        version: '0.14.4',
        type: 'core',
        backstageVersion: '^1.15.0',
        dependencies: [
          { id: '@backstage/core-plugin-api', version: '1.8.2', versionConstraint: '^1.8.0' }
        ]
      },
      {
        id: '@backstage/core-plugin-api',
        name: 'Core Plugin API',
        version: '1.8.2',
        type: 'core',
        backstageVersion: '^1.15.0',
        dependencies: []
      }
    ];

    // Filter plugins if specific IDs requested
    const targetPlugins = pluginIds.length > 0 
      ? mockPlugins.filter(p => pluginIds.includes(p.id))
      : mockPlugins;

    const resolver = new DependencyResolver(targetPlugins, strategy);
    
    // Get dependency graph
    const graph = resolver.getGraphVisualization();
    
    // Detect circular dependencies
    const circularDependencies = resolver.detectCircularDependencies();
    
    // Resolve dependencies
    const resolutionResult = await resolver.resolveDependencies(
      pluginIds.length > 0 ? pluginIds : undefined,
      {
        strategy,
        skipOptional: !includeOptional
      }
    );

    const response: ApiResponse = {
      success: true,
      data: {
        graph,
        circularDependencies,
        resolution: resolutionResult,
        metadata: {
          totalPlugins: targetPlugins.length,
          strategy,
          includeOptional,
          generatedAt: new Date().toISOString()
        }
      },
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Dependencies API error:', error);
    
    const errorResponse: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { plugins, options = {} } = body;

    if (!Array.isArray(plugins)) {
      const errorResponse: ApiResponse = {
        success: false,
        error: 'Invalid plugins data - expected array',
        timestamp: new Date().toISOString()
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const {
      strategy = 'strict',
      autoInstall = false,
      skipOptional = false,
      targetPlugins = []
    } = options;

    const resolver = new DependencyResolver(plugins, strategy);
    
    const resolutionResult = await resolver.resolveDependencies(
      targetPlugins.length > 0 ? targetPlugins : undefined,
      {
        strategy,
        autoInstall,
        skipOptional
      }
    );

    const response: ApiResponse = {
      success: true,
      data: {
        resolution: resolutionResult,
        graph: resolver.getGraphVisualization(),
        availableStrategies: resolver.getAvailableStrategies()
      },
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Dependencies resolution error:', error);
    
    const errorResponse: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { pluginId, action, options = {} } = body;

    if (!pluginId || !action) {
      const errorResponse: ApiResponse = {
        success: false,
        error: 'Missing required parameters: pluginId and action',
        timestamp: new Date().toISOString()
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Mock plugin data for the example
    const mockPlugins: Plugin[] = [
      {
        id: '@backstage/plugin-catalog',
        name: 'Service Catalog',
        version: '1.15.0',
        type: 'core',
        backstageVersion: '^1.15.0',
        dependencies: [
          { id: '@backstage/core-components', version: '0.14.4', versionConstraint: '^0.14.0' }
        ]
      }
    ];

    const resolver = new DependencyResolver(mockPlugins);

    let result;
    switch (action) {
      case 'add':
        const newPlugin = options.plugin;
        if (!newPlugin) {
          throw new Error('Plugin data required for add action');
        }
        resolver.addPlugin(newPlugin);
        result = { message: `Plugin ${pluginId} added successfully` };
        break;

      case 'remove':
        resolver.removePlugin(pluginId);
        result = { message: `Plugin ${pluginId} removed successfully` };
        break;

      case 'clear-cache':
        resolver.clearCache();
        result = { message: 'Dependency cache cleared' };
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Dependencies update error:', error);
    
    const errorResponse: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}