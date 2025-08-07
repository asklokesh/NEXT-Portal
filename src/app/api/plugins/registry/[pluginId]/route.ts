// Plugin-specific API routes
// Detailed plugin information, compatibility checking, and installation management

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getEnhancedPluginRegistry } from '@/services/backstage/enhanced-plugin-registry';

const CompatibilityCheckSchema = z.object({
  backstageVersion: z.string().optional(),
  nodeVersion: z.string().optional(),
  npmVersion: z.string().optional(),
  platform: z.string().optional()
});

// GET /api/plugins/registry/[pluginId] - Get detailed plugin information
export async function GET(
  request: NextRequest,
  { params }: { params: { pluginId: string } }
) {
  try {
    const { pluginId } = params;
    const { searchParams } = new URL(request.url);
    const includeReadme = searchParams.get('includeReadme') === 'true';
    const includeCompatibility = searchParams.get('includeCompatibility') === 'true';

    const registry = getEnhancedPluginRegistry();
    
    // Search for the specific plugin
    const plugins = await registry.discoverPlugins({ search: pluginId });
    const plugin = plugins.find(p => 
      p.id === pluginId || 
      p.name === pluginId ||
      p.name.includes(pluginId)
    );
    
    if (!plugin) {
      return NextResponse.json({
        success: false,
        error: `Plugin '${pluginId}' not found`
      }, { status: 404 });
    }

    // Enhanced plugin data
    const responseData: any = {
      plugin,
      metadata: {
        retrievedAt: new Date().toISOString(),
        source: plugin.registryMetadata?.source || 'unknown'
      }
    };

    // Include compatibility check if requested
    if (includeCompatibility) {
      try {
        const compatibilityCheck = await registry.validateCompatibility(plugin, {
          backstageVersion: process.env.BACKSTAGE_VERSION || '1.0.0',
          nodeVersion: process.version,
          npmVersion: process.env.NPM_VERSION || '9.0.0'
        });
        responseData.compatibility = compatibilityCheck;
      } catch (error) {
        responseData.compatibility = {
          error: 'Failed to check compatibility',
          details: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    // Add installation status if available
    if (typeof window === 'undefined') {
      // Server-side: check from database or file system
      // For now, we'll simulate this
      responseData.installationStatus = {
        installed: false,
        version: null,
        installedAt: null,
        enabled: false
      };
    }

    return NextResponse.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error(`Plugin detail error for ${params.pluginId}:`, error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch plugin details'
    }, { status: 500 });
  }
}

// POST /api/plugins/registry/[pluginId] - Install specific plugin
export async function POST(
  request: NextRequest,
  { params }: { params: { pluginId: string } }
) {
  try {
    const { pluginId } = params;
    const body = await request.json();
    const { version, configuration, forceInstall } = body;

    const registry = getEnhancedPluginRegistry();
    
    // Find the plugin
    const plugins = await registry.discoverPlugins({ search: pluginId });
    const plugin = plugins.find(p => 
      p.id === pluginId || 
      p.name === pluginId ||
      p.name.includes(pluginId)
    );
    
    if (!plugin) {
      return NextResponse.json({
        success: false,
        error: `Plugin '${pluginId}' not found`
      }, { status: 404 });
    }

    // Check if plugin is already installed
    // In a real implementation, this would check the actual installation status
    const isAlreadyInstalled = false; // Simulate check

    if (isAlreadyInstalled && !forceInstall) {
      return NextResponse.json({
        success: false,
        error: 'Plugin is already installed. Use forceInstall=true to reinstall.'
      }, { status: 409 });
    }

    // Perform compatibility check
    const compatibilityCheck = await registry.validateCompatibility(plugin);
    
    if (!compatibilityCheck.compatible && !forceInstall) {
      return NextResponse.json({
        success: false,
        error: 'Plugin is not compatible with current environment',
        compatibility: compatibilityCheck
      }, { status: 400 });
    }

    // Start installation process
    const installationId = `install-${pluginId}-${Date.now()}`;
    const progressUpdates: any[] = [];
    
    try {
      await registry.installPlugin(plugin, (progress) => {
        progressUpdates.push({
          timestamp: new Date().toISOString(),
          installationId,
          ...progress
        });
        
        // In a real implementation, you'd broadcast this via WebSocket
        console.log(`Installation progress for ${pluginId}:`, progress);
      });

      return NextResponse.json({
        success: true,
        data: {
          installationId,
          plugin: {
            id: plugin.id,
            name: plugin.name,
            version: plugin.version
          },
          status: 'completed',
          progress: progressUpdates,
          installedAt: new Date().toISOString()
        }
      });

    } catch (installError) {
      return NextResponse.json({
        success: false,
        error: 'Installation failed',
        details: installError instanceof Error ? installError.message : 'Unknown installation error',
        installationId,
        progress: progressUpdates
      }, { status: 500 });
    }

  } catch (error) {
    console.error(`Plugin installation error for ${params.pluginId}:`, error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to install plugin'
    }, { status: 500 });
  }
}

// DELETE /api/plugins/registry/[pluginId] - Uninstall plugin
export async function DELETE(
  request: NextRequest,
  { params }: { params: { pluginId: string } }
) {
  try {
    const { pluginId } = params;
    const { searchParams } = new URL(request.url);
    const forceUninstall = searchParams.get('force') === 'true';

    // In a real implementation, this would:
    // 1. Check if plugin is installed
    // 2. Check for dependent plugins
    // 3. Stop plugin services
    // 4. Remove plugin files
    // 5. Clean up configuration
    
    // Simulate uninstallation process
    const uninstallationSteps = [
      'Stopping plugin services',
      'Checking dependencies',
      'Removing plugin files',
      'Cleaning configuration',
      'Updating registry'
    ];

    const progress: any[] = [];
    
    for (let i = 0; i < uninstallationSteps.length; i++) {
      const step = uninstallationSteps[i];
      progress.push({
        timestamp: new Date().toISOString(),
        step,
        progress: ((i + 1) / uninstallationSteps.length) * 100,
        completed: true
      });
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    return NextResponse.json({
      success: true,
      data: {
        pluginId,
        status: 'uninstalled',
        uninstalledAt: new Date().toISOString(),
        progress
      }
    });

  } catch (error) {
    console.error(`Plugin uninstallation error for ${params.pluginId}:`, error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to uninstall plugin'
    }, { status: 500 });
  }
}