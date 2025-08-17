/**
 * Plugin Actions API
 * Handles plugin lifecycle operations: stop, start, restart, update
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSafePrismaClient } from '@/lib/db/safe-client';

interface PluginActionRequest {
  installId: string;
  action: 'stop' | 'start' | 'restart' | 'update' | 'enable' | 'disable';
  version?: string; // For update action
}

export async function POST(request: NextRequest) {
  try {
    const { installId, action, version }: PluginActionRequest = await request.json();
    
    if (!installId) {
      return NextResponse.json({
        success: false,
        error: 'Installation ID is required'
      }, { status: 400 });
    }
    
    if (!action) {
      return NextResponse.json({
        success: false,
        error: 'Action is required'
      }, { status: 400 });
    }
    
    const prisma = getSafePrismaClient();
    
    // Find the plugin in the database
    const plugin = await prisma.plugin.findFirst({
      where: { id: installId }
    });
    
    if (!plugin) {
      return NextResponse.json({
        success: false,
        error: 'Plugin not found'
      }, { status: 404 });
    }
    
    let updateData: any = {
      updatedAt: new Date()
    };
    
    let message = '';
    
    switch (action) {
      case 'stop':
      case 'disable':
        updateData.isEnabled = false;
        updateData.status = 'INACTIVE';
        message = `Plugin ${plugin.displayName || plugin.name} stopped successfully`;
        break;
        
      case 'start':
      case 'enable':
        updateData.isEnabled = true;
        updateData.status = 'ACTIVE';
        message = `Plugin ${plugin.displayName || plugin.name} started successfully`;
        break;
        
      case 'restart':
        updateData.isEnabled = true;
        updateData.status = 'ACTIVE';
        updateData.updatedAt = new Date();
        message = `Plugin ${plugin.displayName || plugin.name} restarted successfully`;
        break;
        
      case 'update':
        if (!version) {
          return NextResponse.json({
            success: false,
            error: 'Version is required for update action'
          }, { status: 400 });
        }
        
        updateData.status = 'ACTIVE';
        updateData.isEnabled = true;
        // Note: Version would be stored in a versions table in a real system
        message = `Plugin ${plugin.displayName || plugin.name} updated to version ${version} successfully`;
        break;
        
      default:
        return NextResponse.json({
          success: false,
          error: `Invalid action: ${action}`
        }, { status: 400 });
    }
    
    // Update the plugin in the database
    const updatedPlugin = await prisma.plugin.update({
      where: { id: installId },
      data: updateData
    });
    
    return NextResponse.json({
      success: true,
      message,
      plugin: {
        id: updatedPlugin.id,
        name: updatedPlugin.name,
        displayName: updatedPlugin.displayName,
        status: updatedPlugin.status,
        isEnabled: updatedPlugin.isEnabled,
        updatedAt: updatedPlugin.updatedAt
      }
    });
    
  } catch (error) {
    console.error('Plugin action error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to execute plugin action'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const installId = searchParams.get('installId');
    
    if (!installId) {
      return NextResponse.json({
        success: false,
        error: 'Installation ID is required'
      }, { status: 400 });
    }
    
    const prisma = getSafePrismaClient();
    
    const plugin = await prisma.plugin.findFirst({
      where: { id: installId },
      select: {
        id: true,
        name: true,
        displayName: true,
        status: true,
        isEnabled: true,
        isInstalled: true,
        updatedAt: true
      }
    });
    
    if (!plugin) {
      return NextResponse.json({
        success: false,
        error: 'Plugin not found'
      }, { status: 404 });
    }
    
    // Available actions based on current state
    const availableActions = [];
    
    if (plugin.isEnabled) {
      availableActions.push('stop', 'disable', 'restart', 'update');
    } else {
      availableActions.push('start', 'enable', 'update');
    }
    
    return NextResponse.json({
      success: true,
      plugin,
      availableActions
    });
    
  } catch (error) {
    console.error('Get plugin actions error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get plugin actions'
    }, { status: 500 });
  }
}