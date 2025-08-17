/**
 * Plugin Configuration API Route
 * Handles plugin configuration management
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getServerSession } from 'next-auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pluginId = searchParams.get('pluginId');
    const environment = searchParams.get('environment') || 'production';

    if (!pluginId) {
      return NextResponse.json(
        { error: 'Plugin ID is required' },
        { status: 400 }
      );
    }

    const configuration = await prisma.pluginConfiguration.findUnique({
      where: {
        pluginId_environment: {
          pluginId,
          environment
        }
      }
    });

    if (!configuration) {
      // Return default configuration
      return NextResponse.json({
        pluginId,
        environment,
        config: {},
        isDefault: true
      });
    }

    return NextResponse.json({
      pluginId,
      environment,
      config: configuration.config,
      isActive: configuration.isActive,
      createdAt: configuration.createdAt,
      updatedAt: configuration.updatedAt,
      isDefault: false
    });

  } catch (error) {
    console.error('Configuration fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch configuration' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { pluginId, configuration, environment = 'production' } = body;

    if (!pluginId || !configuration) {
      return NextResponse.json(
        { error: 'Plugin ID and configuration are required' },
        { status: 400 }
      );
    }

    // Validate plugin exists
    const plugin = await prisma.plugin.findUnique({
      where: { id: pluginId }
    });

    if (!plugin) {
      return NextResponse.json(
        { error: 'Plugin not found' },
        { status: 404 }
      );
    }

    // Upsert configuration
    const config = await prisma.pluginConfiguration.upsert({
      where: {
        pluginId_environment: {
          pluginId,
          environment
        }
      },
      update: {
        config: configuration,
        updatedAt: new Date()
      },
      create: {
        pluginId,
        environment,
        config: configuration,
        isActive: true,
        createdBy: session.user?.email || 'system'
      }
    });

    // Log configuration change
    await prisma.auditLog.create({
      data: {
        userId: session.user?.id,
        action: 'plugin.configure',
        resource: 'plugin_configuration',
        resourceId: config.id,
        metadata: {
          pluginId,
          environment,
          changes: configuration
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Configuration updated successfully',
      configuration: config
    });

  } catch (error) {
    console.error('Configuration update error:', error);
    return NextResponse.json(
      { error: 'Failed to update configuration' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const pluginId = searchParams.get('pluginId');
    const environment = searchParams.get('environment') || 'production';

    if (!pluginId) {
      return NextResponse.json(
        { error: 'Plugin ID is required' },
        { status: 400 }
      );
    }

    await prisma.pluginConfiguration.delete({
      where: {
        pluginId_environment: {
          pluginId,
          environment
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Configuration deleted successfully'
    });

  } catch (error) {
    console.error('Configuration delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete configuration' },
      { status: 500 }
    );
  }
}