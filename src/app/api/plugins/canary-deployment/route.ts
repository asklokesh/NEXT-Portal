/**
 * Canary Deployment Management API
 * Provides endpoints for managing plugin canary deployments
 */

import { NextRequest, NextResponse } from 'next/server';
import CanaryDeploymentController, { 
  DeploymentStrategy, 
  CanaryConfig, 
  DeploymentPhaseConfig,
  SLOThresholds,
  RollbackTrigger,
  HealthCheckConfig
} from '@/services/plugin-deployment/CanaryDeploymentController';

// Singleton deployment controller
let deploymentController: CanaryDeploymentController;

function getDeploymentController(): CanaryDeploymentController {
  if (!deploymentController) {
    deploymentController = new CanaryDeploymentController();
  }
  return deploymentController;
}

// Default canary configuration
const defaultCanaryConfig: CanaryConfig = {
  strategy: DeploymentStrategy.CANARY,
  phases: [
    {
      name: 'canary',
      trafficPercentage: 10,
      duration: 10, // 10 minutes
      healthCheckInterval: 30, // 30 seconds
      successCriteria: {
        minHealthyInstances: 1,
        maxErrorRate: 1, // 1%
        maxResponseTime: 1000, // 1 second
        minUptime: 99 // 99%
      },
      autoPromote: false
    },
    {
      name: 'progressive-25',
      trafficPercentage: 25,
      duration: 15,
      healthCheckInterval: 30,
      successCriteria: {
        minHealthyInstances: 1,
        maxErrorRate: 0.5,
        maxResponseTime: 800,
        minUptime: 99.5
      },
      autoPromote: false
    },
    {
      name: 'progressive-50',
      trafficPercentage: 50,
      duration: 20,
      healthCheckInterval: 30,
      successCriteria: {
        minHealthyInstances: 2,
        maxErrorRate: 0.3,
        maxResponseTime: 600,
        minUptime: 99.5
      },
      autoPromote: false
    },
    {
      name: 'progressive-100',
      trafficPercentage: 100,
      duration: 5,
      healthCheckInterval: 60,
      successCriteria: {
        minHealthyInstances: 2,
        maxErrorRate: 0.1,
        maxResponseTime: 500,
        minUptime: 99.9
      },
      autoPromote: true
    }
  ],
  healthChecks: {
    endpoints: ['/health', '/metrics', '/ready'],
    timeout: 5000,
    interval: 30,
    retries: 3,
    expectedStatusCodes: [200, 201],
    customMetrics: [
      {
        name: 'plugin_errors',
        query: 'sum(rate(plugin_errors_total[5m]))',
        threshold: { warning: 10, critical: 50 },
        aggregation: 'sum'
      },
      {
        name: 'plugin_response_time',
        query: 'histogram_quantile(0.95, plugin_response_time_seconds)',
        threshold: { warning: 0.5, critical: 1.0 },
        aggregation: 'p95'
      }
    ]
  },
  sloThresholds: {
    errorRate: { warning: 1, critical: 5 }, // percentage
    responseTime: { warning: 500, critical: 1000 }, // ms
    cpuUsage: { warning: 70, critical: 85 }, // percentage
    memoryUsage: { warning: 80, critical: 90 }, // percentage
    throughput: { minimum: 10 } // requests/minute
  },
  rollbackTriggers: [
    {
      type: 'slo_violation',
      condition: 'error_rate > 5%',
      severity: 'critical',
      autoRollback: true
    },
    {
      type: 'slo_violation',
      condition: 'response_time > 1000ms',
      severity: 'critical',
      autoRollback: true
    },
    {
      type: 'health_check_failure',
      condition: 'consecutive_failures > 3',
      severity: 'critical',
      autoRollback: true
    }
  ],
  tenantIsolation: true,
  maxRolloutDuration: 120 // 2 hours
};

// POST /api/plugins/canary-deployment - Start new canary deployment
export async function POST(request: NextRequest) {
  try {
    const {
      pluginId,
      fromVersion,
      toVersion,
      tenantId,
      config = defaultCanaryConfig,
      approvalRequired = false
    } = await request.json();

    if (!pluginId || !fromVersion || !toVersion) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters: pluginId, fromVersion, toVersion'
      }, { status: 400 });
    }

    const controller = getDeploymentController();
    
    // Merge custom config with defaults
    const deploymentConfig: CanaryConfig = {
      ...defaultCanaryConfig,
      ...config,
      approvalWorkflow: approvalRequired ? {
        required: true,
        approvers: ['admin@company.com', 'platform-team@company.com'],
        timeout: 60, // 1 hour
        stages: [
          {
            name: 'initial-approval',
            requiredApprovals: 1,
            approvers: ['platform-team@company.com'],
            condition: 'pre_deployment'
          }
        ]
      } : undefined
    };

    const deployment = await controller.startDeployment(
      pluginId,
      fromVersion,
      toVersion,
      deploymentConfig,
      tenantId
    );

    return NextResponse.json({
      success: true,
      deployment: {
        id: deployment.id,
        pluginId: deployment.pluginId,
        pluginVersion: deployment.pluginVersion,
        phase: deployment.phase,
        strategy: deployment.strategy,
        currentTrafficPercentage: deployment.currentTrafficPercentage,
        startTime: deployment.startTime,
        estimatedCompletion: deployment.estimatedCompletion,
        approvalRequired: !!deployment.approvalStatus
      }
    });

  } catch (error) {
    console.error('Failed to start canary deployment:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to start canary deployment',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET /api/plugins/canary-deployment - List active deployments
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deploymentId = searchParams.get('deploymentId');
    const pluginId = searchParams.get('pluginId');
    const tenantId = searchParams.get('tenantId');

    const controller = getDeploymentController();

    if (deploymentId) {
      const deployment = await controller.getDeploymentStatus(deploymentId);
      if (!deployment) {
        return NextResponse.json({
          success: false,
          error: 'Deployment not found'
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        deployment: {
          id: deployment.id,
          pluginId: deployment.pluginId,
          pluginVersion: deployment.pluginVersion,
          tenantId: deployment.tenantId,
          phase: deployment.phase,
          strategy: deployment.strategy,
          currentTrafficPercentage: deployment.currentTrafficPercentage,
          startTime: deployment.startTime,
          estimatedCompletion: deployment.estimatedCompletion,
          healthMetrics: deployment.healthMetrics,
          instances: deployment.instances,
          events: deployment.events.slice(-20), // Last 20 events
          approvalStatus: deployment.approvalStatus
        }
      });
    }

    // List all active deployments
    const deployments = await controller.listActiveDeployments();
    
    let filteredDeployments = deployments;
    
    if (pluginId) {
      filteredDeployments = filteredDeployments.filter(d => d.pluginId === pluginId);
    }
    
    if (tenantId) {
      filteredDeployments = filteredDeployments.filter(d => d.tenantId === tenantId);
    }

    return NextResponse.json({
      success: true,
      deployments: filteredDeployments.map(d => ({
        id: d.id,
        pluginId: d.pluginId,
        pluginVersion: d.pluginVersion,
        tenantId: d.tenantId,
        phase: d.phase,
        strategy: d.strategy,
        currentTrafficPercentage: d.currentTrafficPercentage,
        startTime: d.startTime,
        estimatedCompletion: d.estimatedCompletion,
        healthMetrics: {
          overall: d.healthMetrics.overall,
          errorRate: d.healthMetrics.errorRate,
          responseTime: d.healthMetrics.responseTime
        }
      }))
    });

  } catch (error) {
    console.error('Failed to get canary deployments:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get canary deployments',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// PUT /api/plugins/canary-deployment - Update deployment (approve, rollback, etc.)
export async function PUT(request: NextRequest) {
  try {
    const {
      deploymentId,
      action,
      reason,
      approver,
      approved
    } = await request.json();

    if (!deploymentId || !action) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters: deploymentId, action'
      }, { status: 400 });
    }

    const controller = getDeploymentController();
    
    switch (action) {
      case 'rollback':
        if (!reason) {
          return NextResponse.json({
            success: false,
            error: 'Reason is required for rollback'
          }, { status: 400 });
        }
        
        await controller.rollback(deploymentId, reason, true);
        
        return NextResponse.json({
          success: true,
          message: 'Rollback initiated successfully'
        });

      case 'approve':
        if (!approver) {
          return NextResponse.json({
            success: false,
            error: 'Approver is required for approval action'
          }, { status: 400 });
        }
        
        await controller.approveDeployment(deploymentId, approver, approved ?? true, reason);
        
        return NextResponse.json({
          success: true,
          message: `Deployment ${approved ? 'approved' : 'rejected'} successfully`
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Supported actions: rollback, approve'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Failed to update canary deployment:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update canary deployment',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// DELETE /api/plugins/canary-deployment - Cancel deployment
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deploymentId = searchParams.get('deploymentId');
    const reason = searchParams.get('reason') || 'Manual cancellation';

    if (!deploymentId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameter: deploymentId'
      }, { status: 400 });
    }

    const controller = getDeploymentController();
    await controller.rollback(deploymentId, reason, true);

    return NextResponse.json({
      success: true,
      message: 'Deployment cancelled and rolled back successfully'
    });

  } catch (error) {
    console.error('Failed to cancel canary deployment:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to cancel canary deployment',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}