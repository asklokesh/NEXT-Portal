/**
 * Simple Plugin Installation API - State Only
 * Just tracks installation state in database without actually installing plugins
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      pluginId, 
      version, 
      configuration = {},
      environment = 'production'
    } = body;

    if (!pluginId) {
      return NextResponse.json(
        { error: 'Plugin ID is required' },
        { status: 400 }
      );
    }

    // Check if plugin already exists (using compound key with null tenant)
    // Use simplified select to avoid schema issues
    const existingPlugin = await prisma.plugin.findFirst({
      where: { 
        name: pluginId,
        tenantId: null  // Default tenant
      },
      select: {
        id: true,
        name: true,
        isInstalled: true,
        isEnabled: true,
        status: true
      }
    });

    if (existingPlugin) {
      // Update existing plugin
      const updatedPlugin = await prisma.plugin.update({
        where: { id: existingPlugin.id },
        data: {
          isInstalled: true,
          isEnabled: true,
          status: 'ACTIVE',
          updatedAt: new Date()
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Plugin installation state updated',
        plugin: {
          id: updatedPlugin.id,
          name: updatedPlugin.name,
          installed: true,
          enabled: true
        }
      });
    } else {
      // Create new plugin record using raw SQL to avoid schema issues
      const pluginId_clean = pluginId.replace(/[^a-zA-Z0-9@/_-]/g, '');
      const displayName = pluginId.replace(/@[^/]+\//, '').replace(/plugin-/, '');
      const description = `Plugin ${pluginId}`;
      
      const newPlugin = await prisma.$queryRaw`
        INSERT INTO plugins (
          id, name, "displayName", description, category, 
          "isInstalled", "isEnabled", status, lifecycle, 
          "installedAt", "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid()::text, 
          ${pluginId}, 
          ${displayName}, 
          ${description}, 
          'OTHER'::"PluginCategory",
          true, 
          true, 
          'ACTIVE'::"PluginStatus", 
          'STABLE'::"PluginLifecycle",
          NOW(), 
          NOW(), 
          NOW()
        ) RETURNING id, name
      `;
      
      const newPluginResult = Array.isArray(newPlugin) ? newPlugin[0] : newPlugin;

      // Create configuration if provided
      if (Object.keys(configuration).length > 0) {
        await prisma.pluginConfiguration.create({
          data: {
            pluginId: newPluginResult.id,
            environment,
            config: configuration,
            isActive: true
          }
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Plugin installed successfully',
        plugin: {
          id: newPluginResult.id,
          name: newPluginResult.name,
          installed: true,
          enabled: true
        }
      });
    }

  } catch (error) {
    console.error('Plugin installation error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Installation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}