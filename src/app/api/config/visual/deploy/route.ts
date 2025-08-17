/**
 * Configuration Deployment API
 * Handles deployment of visual configurations to various environments
 */

import { NextRequest, NextResponse } from 'next/server';
import VisualConfigManager from '@/services/config-management/VisualConfigManager';

// Singleton configuration manager
let configManager: VisualConfigManager;

function getConfigManager(): VisualConfigManager {
  if (!configManager) {
    configManager = new VisualConfigManager();
  }
  return configManager;
}

// POST /api/config/visual/deploy - Deploy configuration
export async function POST(request: NextRequest) {
  try {
    const {
      instanceId,
      environment = 'production',
      dryRun = false,
      force = false
    } = await request.json();

    if (!instanceId) {
      return NextResponse.json({
        success: false,
        error: 'Configuration instance ID is required'
      }, { status: 400 });
    }

    const manager = getConfigManager();
    const instance = manager.getConfigInstance(instanceId);

    if (!instance) {
      return NextResponse.json({
        success: false,
        error: 'Configuration instance not found'
      }, { status: 404 });
    }

    // Validate configuration before deployment
    if (!instance.validation.valid && !force) {
      return NextResponse.json({
        success: false,
        error: 'Configuration has validation errors and cannot be deployed',
        validation: {
          errors: instance.validation.errors,
          warnings: instance.validation.warnings
        }
      }, { status: 400 });
    }

    if (dryRun) {
      // Perform dry run - validate deployment without executing
      const schema = manager.getConfigSchema(instance.schemaId);
      
      return NextResponse.json({
        success: true,
        dryRun: true,
        deployment: {
          instanceId,
          environment,
          schemaName: schema?.name,
          configName: instance.name,
          validation: instance.validation,
          estimatedDuration: '2-3 minutes',
          changes: Object.keys(instance.values).length,
          rollbackAvailable: instance.deployment.rollback?.available || false
        }
      });
    }

    // Execute actual deployment
    try {
      const deploymentSuccess = await manager.deployConfiguration(instanceId, environment);

      if (deploymentSuccess) {
        const updatedInstance = manager.getConfigInstance(instanceId);
        
        return NextResponse.json({
          success: true,
          deployment: {
            instanceId,
            environment,
            status: updatedInstance?.status,
            deployedAt: updatedInstance?.deployment.lastDeployed,
            version: updatedInstance?.deployment.version,
            rollbackAvailable: updatedInstance?.deployment.rollback?.available
          }
        });
      }

      return NextResponse.json({
        success: false,
        error: 'Deployment failed for unknown reason'
      }, { status: 500 });

    } catch (deploymentError) {
      return NextResponse.json({
        success: false,
        error: 'Deployment failed',
        details: deploymentError instanceof Error ? deploymentError.message : 'Unknown deployment error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Failed to deploy configuration:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to deploy configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET /api/config/visual/deploy - Get deployment status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const instanceId = searchParams.get('instanceId');
    const environment = searchParams.get('environment');

    if (!instanceId) {
      return NextResponse.json({
        success: false,
        error: 'Configuration instance ID is required'
      }, { status: 400 });
    }

    const manager = getConfigManager();
    const instance = manager.getConfigInstance(instanceId);

    if (!instance) {
      return NextResponse.json({
        success: false,
        error: 'Configuration instance not found'
      }, { status: 404 });
    }

    const schema = manager.getConfigSchema(instance.schemaId);

    return NextResponse.json({
      success: true,
      deployment: {
        instanceId,
        configName: instance.name,
        schemaName: schema?.name,
        status: instance.status,
        environment: instance.deployment.environment,
        version: instance.deployment.version,
        lastDeployed: instance.deployment.lastDeployed,
        deployedBy: instance.deployment.deployedBy,
        rollback: instance.deployment.rollback
      }
    });

  } catch (error) {
    console.error('Failed to get deployment status:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get deployment status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// PUT /api/config/visual/deploy - Rollback configuration
export async function PUT(request: NextRequest) {
  try {
    const {
      instanceId,
      action,
      targetVersion
    } = await request.json();

    if (!instanceId || action !== 'rollback') {
      return NextResponse.json({
        success: false,
        error: 'Invalid rollback request. instanceId and action="rollback" required'
      }, { status: 400 });
    }

    const manager = getConfigManager();
    const instance = manager.getConfigInstance(instanceId);

    if (!instance) {
      return NextResponse.json({
        success: false,
        error: 'Configuration instance not found'
      }, { status: 404 });
    }

    if (!instance.deployment.rollback?.available) {
      return NextResponse.json({
        success: false,
        error: 'Rollback is not available for this configuration'
      }, { status: 400 });
    }

    // Mock rollback implementation
    // In production, this would integrate with actual deployment systems
    console.log(`Rolling back configuration ${instanceId} to version ${targetVersion || 'previous'}`);

    return NextResponse.json({
      success: true,
      rollback: {
        instanceId,
        fromVersion: instance.deployment.version,
        toVersion: targetVersion || instance.deployment.rollback.previousVersion,
        rolledBackAt: new Date().toISOString(),
        status: 'completed'
      }
    });

  } catch (error) {
    console.error('Failed to rollback configuration:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to rollback configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}