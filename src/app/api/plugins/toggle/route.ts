/**
 * Plugin Toggle API Route
 * Enables or disables plugins
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getServerSession } from 'next-auth';

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
    const { pluginId, enabled } = body;

    if (!pluginId || enabled === undefined) {
      return NextResponse.json(
        { error: 'Plugin ID and enabled status are required' },
        { status: 400 }
      );
    }

    const plugin = await prisma.plugin.findUnique({
      where: { id: pluginId }
    });

    if (!plugin) {
      return NextResponse.json(
        { error: 'Plugin not found' },
        { status: 404 }
      );
    }

    if (!plugin.isInstalled) {
      return NextResponse.json(
        { error: 'Cannot toggle uninstalled plugin' },
        { status: 400 }
      );
    }

    // Update plugin status
    const updatedPlugin = await prisma.plugin.update({
      where: { id: pluginId },
      data: {
        isEnabled: enabled,
        status: enabled ? 'ACTIVE' : 'INACTIVE'
      }
    });

    // Log the toggle action
    await prisma.auditLog.create({
      data: {
        userId: session.user?.id,
        action: enabled ? 'plugin.enable' : 'plugin.disable',
        resource: 'plugin',
        resourceId: pluginId,
        metadata: {
          previousStatus: plugin.isEnabled,
          newStatus: enabled
        }
      }
    });

    // Track analytics event
    await prisma.pluginAnalytics.create({
      data: {
        pluginId,
        event: enabled ? 'ENABLE' : 'DISABLE',
        userId: session.user?.id
      }
    });

    return NextResponse.json({
      success: true,
      message: `Plugin ${enabled ? 'enabled' : 'disabled'} successfully`,
      plugin: {
        id: updatedPlugin.id,
        name: updatedPlugin.displayName,
        isEnabled: updatedPlugin.isEnabled,
        status: updatedPlugin.status
      }
    });

  } catch (error) {
    console.error('Plugin toggle error:', error);
    return NextResponse.json(
      { error: 'Failed to toggle plugin status' },
      { status: 500 }
    );
  }
}