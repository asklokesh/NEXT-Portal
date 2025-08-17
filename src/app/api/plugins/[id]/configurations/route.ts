import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseConnection } from '@/lib/database/connection';
import { getCurrentUser } from '@/lib/auth/session';
import { checkPermission } from '@/lib/permissions/check';
import { createTenantContext } from '@/lib/tenant-context';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: pluginId } = params;
    
    // Validate pluginId parameter
    if (!pluginId || pluginId === 'undefined' || pluginId === 'null') {
      return NextResponse.json({ error: 'Invalid plugin ID' }, { status: 400 });
    }

    const tenantContext = createTenantContext(request);
    
    // Check permissions
    const hasPermission = await checkPermission(user.id, 'plugin:config:read', tenantContext.tenantId);
    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const environment = searchParams.get('environment') || 'development';

    const db = await getDatabaseConnection();
    
    // Get plugin configurations
    const configurations = await db.pluginConfiguration.findMany({
      where: {
        pluginId,
        environment: environment as any,
        ...(tenantContext.tenantId && { tenantId: tenantContext.tenantId })
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Get plugin info for schema
    const plugin = await db.plugin.findFirst({
      where: {
        id: pluginId,
        ...(tenantContext.tenantId && { tenantId: tenantContext.tenantId })
      }
    });

    if (!plugin) {
      return NextResponse.json({ error: 'Plugin not found' }, { status: 404 });
    }

    const configurationData = configurations.map(config => ({
      id: config.id,
      pluginId: config.pluginId,
      name: config.name || `${plugin.displayName || plugin.name} Configuration`,
      description: config.description || `Configuration for ${plugin.displayName || plugin.name}`,
      schema: config.schema || { type: 'object', properties: {} },
      values: config.config || {},
      environment: config.environment,
      version: config.version || '1.0.0',
      lastModified: config.updatedAt,
      isActive: config.isActive,
      validationErrors: []
    }));

    return NextResponse.json({
      success: true,
      configurations: configurationData,
      plugin: {
        id: plugin.id,
        name: plugin.name,
        displayName: plugin.displayName
      }
    });

  } catch (error) {
    console.error('Error fetching plugin configurations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch plugin configurations' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: pluginId } = params;
    
    // Validate pluginId parameter
    if (!pluginId || pluginId === 'undefined' || pluginId === 'null') {
      return NextResponse.json({ error: 'Invalid plugin ID' }, { status: 400 });
    }

    const tenantContext = createTenantContext(request);
    
    // Check permissions
    const hasPermission = await checkPermission(user.id, 'plugin:config:write', tenantContext.tenantId);
    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { configuration, environment } = body;

    if (!configuration) {
      return NextResponse.json({ error: 'Configuration data required' }, { status: 400 });
    }

    const db = await getDatabaseConnection();

    // Verify plugin exists
    const plugin = await db.plugin.findFirst({
      where: {
        id: pluginId,
        ...(tenantContext.tenantId && { tenantId: tenantContext.tenantId })
      }
    });

    if (!plugin) {
      return NextResponse.json({ error: 'Plugin not found' }, { status: 404 });
    }

    // Create or update configuration
    const configData = {
      pluginId,
      name: configuration.name,
      description: configuration.description,
      config: configuration.values,
      schema: configuration.schema,
      environment: environment || configuration.environment,
      version: configuration.version || '1.0.0',
      isActive: true,
      ...(tenantContext.tenantId && { tenantId: tenantContext.tenantId })
    };

    const savedConfig = await db.pluginConfiguration.upsert({
      where: {
        pluginId_environment_tenantId: {
          pluginId,
          environment: configData.environment,
          tenantId: tenantContext.tenantId || 'global'
        }
      },
      create: configData,
      update: {
        ...configData,
        updatedAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      configuration: {
        id: savedConfig.id,
        pluginId: savedConfig.pluginId,
        name: savedConfig.name,
        description: savedConfig.description,
        schema: savedConfig.schema,
        values: savedConfig.config,
        environment: savedConfig.environment,
        version: savedConfig.version,
        lastModified: savedConfig.updatedAt,
        isActive: savedConfig.isActive
      }
    });

  } catch (error) {
    console.error('Error saving plugin configuration:', error);
    return NextResponse.json(
      { error: 'Failed to save plugin configuration' },
      { status: 500 }
    );
  }
}