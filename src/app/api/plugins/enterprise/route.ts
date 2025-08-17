/**
 * Enterprise Plugin Management API
 * Unified API for all enterprise plugin management features
 */

import { NextRequest, NextResponse } from 'next/server';
import { backstagePluginRegistry } from '../../../../services/backstage-plugin-registry';
import { eksPluginDeployer } from '../../../../services/eks-plugin-deployer';
import { pluginDependencyResolver } from '../../../../services/plugin-dependency-resolver';
import { pluginRollbackSystem } from '../../../../services/plugin-rollback-system';
import { pluginHealthMonitor } from '../../../../services/plugin-health-monitor';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const pluginId = searchParams.get('pluginId');

    switch (action) {
      case 'registry:discover':
        return await handleRegistryDiscover(request);
      
      case 'registry:search':
        return await handleRegistrySearch(request);
      
      case 'dependencies:analyze':
        if (!pluginId) {
          return NextResponse.json(
            { error: 'pluginId required for dependency analysis' },
            { status: 400 }
          );
        }
        return await handleDependencyAnalysis(request, pluginId);
      
      case 'dependencies:graph':
        return await handleDependencyGraph();
      
      case 'rollback:history':
        if (!pluginId) {
          return NextResponse.json(
            { error: 'pluginId required for rollback history' },
            { status: 400 }
          );
        }
        return await handleRollbackHistory(pluginId);
      
      case 'health:dashboard':
        return await handleHealthDashboard();
      
      case 'health:score':
        if (!pluginId) {
          return NextResponse.json(
            { error: 'pluginId required for health score' },
            { status: 400 }
          );
        }
        return await handleHealthScore(pluginId);
      
      case 'deployment:status':
        if (!pluginId) {
          return NextResponse.json(
            { error: 'pluginId required for deployment status' },
            { status: 400 }
          );
        }
        return await handleDeploymentStatus(pluginId);
      
      default:
        return NextResponse.json(
          { error: 'Invalid action parameter' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('[Enterprise API] GET request failed:', error);
    return NextResponse.json(
      {
        error: 'Enterprise plugin API request failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const body = await request.json();

    switch (action) {
      case 'registry:sync':
        return await handleRegistrySync(body);
      
      case 'deploy':
        return await handlePluginDeploy(body);
      
      case 'dependencies:resolve':
        return await handleDependencyResolve(body);
      
      case 'rollback:plan':
        return await handleCreateRollbackPlan(body);
      
      case 'rollback:execute':
        return await handleExecuteRollback(body);
      
      case 'health:configure':
        return await handleHealthConfigure(body);
      
      case 'health:start-monitoring':
        return await handleStartMonitoring(body);
      
      default:
        return NextResponse.json(
          { error: 'Invalid action parameter' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('[Enterprise API] POST request failed:', error);
    return NextResponse.json(
      {
        error: 'Enterprise plugin API request failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Registry handlers

async function handleRegistryDiscover(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('forceRefresh') === 'true';

    const plugins = await backstagePluginRegistry.discoverPlugins(forceRefresh);
    
    return NextResponse.json({
      success: true,
      data: {
        plugins,
        count: plugins.length,
        cached: !forceRefresh,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to discover plugins', details: error },
      { status: 500 }
    );
  }
}

async function handleRegistrySearch(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const query = {
      term: searchParams.get('term') || undefined,
      category: searchParams.get('category') || undefined,
      tags: searchParams.get('tags')?.split(',') || undefined,
      author: searchParams.get('author') || undefined,
      minDownloads: searchParams.get('minDownloads') ? parseInt(searchParams.get('minDownloads')!) : undefined,
      minQualityScore: searchParams.get('minQualityScore') ? parseFloat(searchParams.get('minQualityScore')!) : undefined,
      compatibleOnly: searchParams.get('compatibleOnly') === 'true',
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    };

    const results = await backstagePluginRegistry.searchPlugins(query);
    
    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Plugin search failed', details: error },
      { status: 500 }
    );
  }
}

async function handleRegistrySync(body: any) {
  try {
    const { tenantId, forceRefresh = false } = body;
    
    const result = await backstagePluginRegistry.syncToDatabase(tenantId);
    
    return NextResponse.json({
      success: true,
      message: 'Registry synchronized successfully',
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Registry sync failed', details: error },
      { status: 500 }
    );
  }
}

// Deployment handlers

async function handlePluginDeploy(body: any) {
  try {
    const {
      pluginName,
      version,
      replicas = 1,
      strategy = 'ROLLING',
      environment = 'production',
      configuration = {},
      resources,
      healthCheck,
      rollback,
    } = body;

    if (!pluginName || !version) {
      return NextResponse.json(
        { error: 'pluginName and version are required' },
        { status: 400 }
      );
    }

    const deploymentSpec = {
      pluginName,
      version,
      replicas,
      strategy,
      environment,
      configuration,
      resources,
      healthCheck,
      rollback: rollback || {
        enabled: true,
        autoTrigger: true,
        healthThreshold: 80,
        timeoutSeconds: 600,
      },
    };

    const result = await eksPluginDeployer.deployPlugin(deploymentSpec);
    
    return NextResponse.json({
      success: true,
      message: 'Plugin deployment initiated',
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Plugin deployment failed', details: error },
      { status: 500 }
    );
  }
}

async function handleDeploymentStatus(pluginId: string) {
  try {
    // Get plugin name from ID
    const { prisma } = await import('../../../../lib/db/client');
    const plugin = await prisma.plugin.findUnique({
      where: { id: pluginId },
    });

    if (!plugin) {
      return NextResponse.json(
        { error: 'Plugin not found' },
        { status: 404 }
      );
    }

    const status = await eksPluginDeployer.getDeploymentStatus(plugin.name);
    
    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get deployment status', details: error },
      { status: 500 }
    );
  }
}

// Dependency handlers

async function handleDependencyAnalysis(request: NextRequest, pluginId: string) {
  try {
    const { searchParams } = new URL(request.url);
    const targetVersion = searchParams.get('version');
    const environment = searchParams.get('environment') || 'production';

    if (!targetVersion) {
      return NextResponse.json(
        { error: 'version parameter required' },
        { status: 400 }
      );
    }

    // Get plugin name from ID
    const { prisma } = await import('../../../../lib/db/client');
    const plugin = await prisma.plugin.findUnique({
      where: { id: pluginId },
    });

    if (!plugin) {
      return NextResponse.json(
        { error: 'Plugin not found' },
        { status: 404 }
      );
    }

    const analysis = await pluginDependencyResolver.analyzePluginDependencies(
      plugin.name,
      targetVersion,
      environment
    );
    
    return NextResponse.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Dependency analysis failed', details: error },
      { status: 500 }
    );
  }
}

async function handleDependencyGraph() {
  try {
    const graph = await pluginDependencyResolver.analyzeAllDependencies();
    
    return NextResponse.json({
      success: true,
      data: graph,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate dependency graph', details: error },
      { status: 500 }
    );
  }
}

async function handleDependencyResolve(body: any) {
  try {
    const { conflicts, dryRun = true } = body;

    if (!conflicts || !Array.isArray(conflicts)) {
      return NextResponse.json(
        { error: 'conflicts array is required' },
        { status: 400 }
      );
    }

    const resolutionPlan = await pluginDependencyResolver.generateResolutionPlan(conflicts);
    const executionResult = await pluginDependencyResolver.executeResolutionPlan(resolutionPlan, dryRun);
    
    return NextResponse.json({
      success: true,
      data: {
        plan: resolutionPlan,
        execution: executionResult,
        dryRun,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Dependency resolution failed', details: error },
      { status: 500 }
    );
  }
}

// Rollback handlers

async function handleCreateRollbackPlan(body: any) {
  try {
    const {
      pluginId,
      fromVersionId,
      toVersionId,
      strategy,
      reason,
      urgency = 'medium',
    } = body;

    if (!pluginId || !fromVersionId || !toVersionId) {
      return NextResponse.json(
        { error: 'pluginId, fromVersionId, and toVersionId are required' },
        { status: 400 }
      );
    }

    const rollbackPlan = await pluginRollbackSystem.createRollbackPlan(
      pluginId,
      fromVersionId,
      toVersionId,
      { strategy, reason, urgency }
    );
    
    return NextResponse.json({
      success: true,
      message: 'Rollback plan created successfully',
      data: rollbackPlan,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create rollback plan', details: error },
      { status: 500 }
    );
  }
}

async function handleExecuteRollback(body: any) {
  try {
    const {
      planId,
      triggeredBy = 'manual',
      triggerReason = 'Manual rollback',
      dryRun = false,
      pauseOnError = true,
      skipValidation = false,
    } = body;

    if (!planId) {
      return NextResponse.json(
        { error: 'planId is required' },
        { status: 400 }
      );
    }

    const execution = await pluginRollbackSystem.executeRollback(
      planId,
      triggeredBy,
      triggerReason,
      { dryRun, pauseOnError, skipValidation }
    );
    
    return NextResponse.json({
      success: true,
      message: `Rollback ${dryRun ? 'simulation' : 'execution'} completed`,
      data: execution,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Rollback execution failed', details: error },
      { status: 500 }
    );
  }
}

async function handleRollbackHistory(pluginId: string) {
  try {
    const history = await pluginRollbackSystem.getVersionHistory(pluginId);
    
    return NextResponse.json({
      success: true,
      data: history,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get rollback history', details: error },
      { status: 500 }
    );
  }
}

// Health monitoring handlers

async function handleHealthDashboard() {
  try {
    const dashboard = await pluginHealthMonitor.getMonitoringDashboard();
    
    return NextResponse.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get health dashboard', details: error },
      { status: 500 }
    );
  }
}

async function handleHealthScore(pluginId: string) {
  try {
    const healthScore = await pluginHealthMonitor.getPluginHealthScore(pluginId);
    
    return NextResponse.json({
      success: true,
      data: healthScore,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get health score', details: error },
      { status: 500 }
    );
  }
}

async function handleHealthConfigure(body: any) {
  try {
    const { pluginId, healthChecks, alertRules } = body;

    if (!pluginId) {
      return NextResponse.json(
        { error: 'pluginId is required' },
        { status: 400 }
      );
    }

    const results = [];

    if (healthChecks && Array.isArray(healthChecks)) {
      await pluginHealthMonitor.registerHealthChecks(pluginId, healthChecks);
      results.push(`Registered ${healthChecks.length} health checks`);
    }

    if (alertRules && Array.isArray(alertRules)) {
      await pluginRollbackSystem.configureRollbackTriggers(pluginId, alertRules);
      results.push(`Configured ${alertRules.length} alert rules`);
    }
    
    return NextResponse.json({
      success: true,
      message: 'Health monitoring configured successfully',
      data: { results },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to configure health monitoring', details: error },
      { status: 500 }
    );
  }
}

async function handleStartMonitoring(body: any) {
  try {
    const { interval = 30, enable = true } = body;

    if (enable) {
      await pluginHealthMonitor.startMonitoring(interval);
      
      return NextResponse.json({
        success: true,
        message: `Health monitoring started with ${interval}s interval`,
      });
    } else {
      pluginHealthMonitor.stopMonitoring();
      
      return NextResponse.json({
        success: true,
        message: 'Health monitoring stopped',
      });
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to control monitoring', details: error },
      { status: 500 }
    );
  }
}