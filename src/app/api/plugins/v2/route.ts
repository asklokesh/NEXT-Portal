/**
 * Universal Plugin Management API v2
 * Handles all plugin operations including search, install, update, configure, and remove
 */

import { NextRequest, NextResponse } from 'next/server';
import { universalPluginManager } from '@/lib/plugins/universal-plugin-manager';

// GET /api/plugins/v2 - Search and list plugins
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const query = searchParams.get('query');
    const source = searchParams.get('source') as 'all' | 'npm' | 'github' | undefined;
    const installed = searchParams.get('installed') === 'true';

    if (action === 'search' && query) {
      // Search for plugins
      const plugins = await universalPluginManager.searchPlugins(query, source || 'all');
      return NextResponse.json({
        success: true,
        plugins,
        total: plugins.length
      });
    }

    if (installed || !action) {
      // Get installed plugins
      const installedPlugins = await universalPluginManager.getInstalledPlugins();
      
      // If no installed plugins, return marketplace plugins for demo
      if (installedPlugins.length === 0 && process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
        try {
          const response = await fetch(`${process.env.BACKSTAGE_API_URL || 'http://localhost:4402/api'}/plugins/v2`);
          const data = await response.json();
          return NextResponse.json(data);
        } catch (error) {
          console.error('Failed to fetch marketplace plugins:', error);
        }
      }
      
      return NextResponse.json({
        success: true,
        plugins: installedPlugins,
        total: installedPlugins.length
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action'
    }, { status: 400 });
  } catch (error) {
    console.error('Plugin API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST /api/plugins/v2 - Install, update, configure, or remove plugins
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, pluginId, options = {} } = body;

    if (!action || !pluginId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters: action and pluginId'
      }, { status: 400 });
    }

    let result;

    switch (action) {
      case 'install':
        result = await universalPluginManager.installPlugin(pluginId, options);
        break;

      case 'update':
        result = await universalPluginManager.updatePlugin(pluginId, options.version);
        break;

      case 'configure':
        if (!options.configuration) {
          return NextResponse.json({
            success: false,
            error: 'Missing configuration data'
          }, { status: 400 });
        }
        result = await universalPluginManager.configurePlugin(pluginId, options.configuration);
        break;

      case 'remove':
      case 'uninstall':
        result = await universalPluginManager.removePlugin(pluginId);
        break;

      default:
        return NextResponse.json({
          success: false,
          error: `Invalid action: ${action}`
        }, { status: 400 });
    }

    return NextResponse.json(result, {
      status: result.success ? 200 : 400
    });
  } catch (error) {
    console.error('Plugin API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET /api/plugins/v2/[pluginId] - Get plugin details
export async function GET_PLUGIN(request: NextRequest, { params }: { params: { pluginId: string } }) {
  try {
    const pluginId = params.pluginId;
    const metadata = await universalPluginManager.getPluginMetadata(pluginId);
    
    if (!metadata) {
      return NextResponse.json({
        success: false,
        error: 'Plugin not found'
      }, { status: 404 });
    }

    const configuration = await universalPluginManager.getPluginConfiguration(pluginId);

    return NextResponse.json({
      success: true,
      plugin: metadata,
      configuration
    });
  } catch (error) {
    console.error('Plugin API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}