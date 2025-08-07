import { NextRequest, NextResponse } from 'next/server';

// Simulated plugin storage
const installedPlugins = new Map<string, any>();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pluginId = params.id;
    
    // Fetch plugin details from registry (simulated)
    const pluginData = {
      id: pluginId,
      name: `@backstage/plugin-${pluginId}`,
      installed: installedPlugins.has(pluginId),
      installedVersion: installedPlugins.get(pluginId)?.version,
      // Add more plugin details as needed
    };

    return NextResponse.json(pluginData);
  } catch (error) {
    console.error('Failed to fetch plugin:', error);
    return NextResponse.json(
      { error: 'Failed to fetch plugin details' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pluginId = params.id;
    const { action, version } = await request.json();

    switch (action) {
      case 'install':
        // Simulate plugin installation
        installedPlugins.set(pluginId, {
          id: pluginId,
          version: version || 'latest',
          installedAt: new Date().toISOString()
        });
        
        return NextResponse.json({
          message: `Plugin ${pluginId} installed successfully`,
          plugin: installedPlugins.get(pluginId)
        });

      case 'uninstall':
        // Simulate plugin uninstallation
        if (!installedPlugins.has(pluginId)) {
          return NextResponse.json(
            { error: 'Plugin not installed' },
            { status: 400 }
          );
        }
        
        installedPlugins.delete(pluginId);
        
        return NextResponse.json({
          message: `Plugin ${pluginId} uninstalled successfully`
        });

      case 'update':
        // Simulate plugin update
        if (!installedPlugins.has(pluginId)) {
          return NextResponse.json(
            { error: 'Plugin not installed' },
            { status: 400 }
          );
        }
        
        const plugin = installedPlugins.get(pluginId);
        plugin.version = version || 'latest';
        plugin.updatedAt = new Date().toISOString();
        
        return NextResponse.json({
          message: `Plugin ${pluginId} updated successfully`,
          plugin
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Plugin operation failed:', error);
    return NextResponse.json(
      { error: 'Plugin operation failed' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pluginId = params.id;
    
    if (!installedPlugins.has(pluginId)) {
      return NextResponse.json(
        { error: 'Plugin not installed' },
        { status: 404 }
      );
    }
    
    installedPlugins.delete(pluginId);
    
    return NextResponse.json({
      message: `Plugin ${pluginId} removed successfully`
    });
  } catch (error) {
    console.error('Failed to remove plugin:', error);
    return NextResponse.json(
      { error: 'Failed to remove plugin' },
      { status: 500 }
    );
  }
}