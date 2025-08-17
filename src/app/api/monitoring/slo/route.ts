/**
 * SLO Monitoring API
 * Provides endpoints for managing Service Level Objectives and monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import SLOMonitoringService from '@/services/monitoring/SLOMonitoringService';

// Singleton SLO monitoring service
let sloService: SLOMonitoringService;

function getSLOService(): SLOMonitoringService {
  if (!sloService) {
    sloService = new SLOMonitoringService();
  }
  return sloService;
}

// GET /api/monitoring/slo - Get SLO status and health dashboard
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sloId = searchParams.get('sloId');
    const dashboard = searchParams.get('dashboard');

    const service = getSLOService();

    if (dashboard === 'true') {
      // Return complete health dashboard
      const dashboardData = await service.getHealthDashboard();
      
      return NextResponse.json({
        success: true,
        dashboard: dashboardData,
        timestamp: new Date().toISOString()
      });
    }

    if (sloId) {
      // Return specific SLO status
      const sloStatus = service.getSLOStatus(sloId);
      
      if (!sloStatus) {
        return NextResponse.json({
          success: false,
          error: 'SLO not found'
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        slo: {
          id: sloStatus.slo.id,
          name: sloStatus.slo.name,
          description: sloStatus.slo.description,
          target: sloStatus.target,
          current: sloStatus.currentValue,
          status: sloStatus.status,
          errorBudget: sloStatus.errorBudgetRemaining,
          burnRate: sloStatus.burnRate,
          violations: sloStatus.violations.map(v => ({
            id: v.id,
            severity: v.severity,
            value: v.value,
            threshold: v.threshold,
            startTime: v.startTime,
            duration: v.duration,
            resolved: v.resolved,
            actionsTaken: v.actionsTaken
          })),
          lastUpdated: sloStatus.lastUpdated
        }
      });
    }

    // Return all SLO statuses
    const allStatuses = service.getAllSLOStatuses();
    
    return NextResponse.json({
      success: true,
      slos: allStatuses.map(status => ({
        id: status.slo.id,
        name: status.slo.name,
        target: status.target,
        current: status.currentValue,
        status: status.status,
        errorBudget: status.errorBudgetRemaining,
        violations: status.violations.filter(v => !v.resolved).length,
        lastUpdated: status.lastUpdated
      })),
      summary: {
        total: allStatuses.length,
        healthy: allStatuses.filter(s => s.status === 'healthy').length,
        warning: allStatuses.filter(s => s.status === 'warning').length,
        critical: allStatuses.filter(s => s.status === 'critical').length
      }
    });

  } catch (error) {
    console.error('Failed to get SLO data:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get SLO data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST /api/monitoring/slo - Create new SLO
export async function POST(request: NextRequest) {
  try {
    const sloData = await request.json();

    const {
      name,
      description,
      target,
      metric,
      window,
      severity = 'warning',
      enabled = true,
      tags = {}
    } = sloData;

    if (!name || !description || target === undefined || !metric) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: name, description, target, metric'
      }, { status: 400 });
    }

    // Validate target is between 0 and 100
    if (target < 0 || target > 100) {
      return NextResponse.json({
        success: false,
        error: 'Target must be between 0 and 100'
      }, { status: 400 });
    }

    // Validate metric configuration
    if (!metric.type || !metric.query || !metric.threshold) {
      return NextResponse.json({
        success: false,
        error: 'Metric must include type, query, and threshold'
      }, { status: 400 });
    }

    const service = getSLOService();
    const newSLO = await service.createSLO({
      name,
      description,
      target,
      metric: {
        type: metric.type,
        query: metric.query,
        aggregation: metric.aggregation || 'avg',
        threshold: {
          warning: metric.threshold.warning,
          critical: metric.threshold.critical
        },
        unit: metric.unit || ''
      },
      window: {
        duration: window?.duration || 60,
        type: window?.type || 'rolling',
        burnRate: window?.burnRate || 1.0
      },
      severity,
      enabled,
      tags
    });

    return NextResponse.json({
      success: true,
      slo: {
        id: newSLO.id,
        name: newSLO.name,
        description: newSLO.description,
        target: newSLO.target,
        metric: newSLO.metric,
        window: newSLO.window,
        severity: newSLO.severity,
        enabled: newSLO.enabled,
        tags: newSLO.tags
      }
    });

  } catch (error) {
    console.error('Failed to create SLO:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create SLO',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// PUT /api/monitoring/slo - Update SLO
export async function PUT(request: NextRequest) {
  try {
    const updateData = await request.json();
    const { id, ...updates } = updateData;

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'SLO ID is required'
      }, { status: 400 });
    }

    const service = getSLOService();
    const updatedSLO = await service.updateSLO(id, updates);

    if (!updatedSLO) {
      return NextResponse.json({
        success: false,
        error: 'SLO not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      slo: {
        id: updatedSLO.id,
        name: updatedSLO.name,
        description: updatedSLO.description,
        target: updatedSLO.target,
        metric: updatedSLO.metric,
        window: updatedSLO.window,
        severity: updatedSLO.severity,
        enabled: updatedSLO.enabled,
        tags: updatedSLO.tags
      }
    });

  } catch (error) {
    console.error('Failed to update SLO:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update SLO',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// DELETE /api/monitoring/slo - Delete SLO
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sloId = searchParams.get('sloId');

    if (!sloId) {
      return NextResponse.json({
        success: false,
        error: 'SLO ID is required'
      }, { status: 400 });
    }

    const service = getSLOService();
    const deleted = await service.deleteSLO(sloId);

    if (!deleted) {
      return NextResponse.json({
        success: false,
        error: 'SLO not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'SLO deleted successfully'
    });

  } catch (error) {
    console.error('Failed to delete SLO:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to delete SLO',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}