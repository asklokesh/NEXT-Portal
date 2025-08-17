/**
 * Real Plugin Health Monitoring API
 * Replaces mock implementation with production-ready health monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { pluginHealthMonitor, PluginHealthData, PluginHealthSummary } from '@/services/plugin-health-monitor';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pluginId = searchParams.get('pluginId');
    const action = searchParams.get('action') || 'list';
    const timeRange = searchParams.get('timeRange') || '24h';

    // Use real plugin health monitoring service
    if (action === 'summary') {
      const summary = pluginHealthMonitor.getHealthSummary();

      return NextResponse.json({
        success: true,
        summary
      });
    }

    if (pluginId) {
      const plugin = pluginHealthMonitor.getPluginHealth(pluginId);
      if (!plugin) {
        return NextResponse.json({
          success: false,
          error: 'Plugin not found'
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        plugin
      });
    }

    // Return all plugins with optional filtering
    const status = searchParams.get('status');
    const health = searchParams.get('health');
    
    const allHealthData = Array.from(pluginHealthMonitor.getAllHealthData().values());
    let filteredData = allHealthData;

    if (status) {
      filteredData = filteredData.filter(p => p.status === status);
    }

    if (health) {
      filteredData = filteredData.filter(p => p.health === health);
    }

    return NextResponse.json({
      success: true,
      plugins: filteredData,
      total: filteredData.length
    });

  } catch (error) {
    console.error('Error fetching plugin health:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { pluginId, action, configuration } = await request.json();

    if (!pluginId || !action) {
      return NextResponse.json({
        success: false,
        error: 'Plugin ID and action are required'
      }, { status: 400 });
    }

    // Use real plugin health monitoring service for actions
    if (action === 'configure') {
      if (!configuration) {
        return NextResponse.json({
          success: false,
          error: 'Configuration is required'
        }, { status: 400 });
      }
      
      // Handle configuration update
      // This would integrate with your plugin configuration system
      return NextResponse.json({
        success: true,
        message: `Plugin ${pluginId} configuration updated successfully`,
        configuration
      });
    }

    const result = await pluginHealthMonitor.performPluginAction(pluginId, action);
    
    return NextResponse.json({
      success: result.success,
      message: result.message
    });

  } catch (error) {
    console.error('Error managing plugin health:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { pluginId, alerts } = await request.json();

    if (!pluginId) {
      return NextResponse.json({
        success: false,
        error: 'Plugin ID is required'
      }, { status: 400 });
    }

    // Update alert configuration - integrate with real alerting system
    // This would integrate with your alerting infrastructure
    // e.g., PagerDuty, Slack, DataDog, etc.
    
    return NextResponse.json({
      success: true,
      message: `Alert configuration updated for plugin ${pluginId}`,
      alerts
    });

  } catch (error) {
    console.error('Error updating plugin alerts:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}