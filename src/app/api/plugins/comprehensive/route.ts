/**
 * Comprehensive Plugin Management API
 * 
 * Unified API endpoint for the complete no-code plugin management system
 * Integrates discovery, installation, deployment, governance, and monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { comprehensivePluginRegistry } from '@/services/plugins/comprehensive-plugin-registry';
import { automatedPluginInstaller } from '@/services/plugins/automated-plugin-installer';
import { saasDeploymentOrchestrator } from '@/services/plugins/saas-deployment-orchestrator';
import { enterpriseGovernanceService } from '@/services/plugins/enterprise-governance';
import { realTimePluginMonitor } from '@/services/plugins/realtime-plugin-monitor';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const tenantId = searchParams.get('tenantId');
    const pluginId = searchParams.get('pluginId');

    switch (action) {
      case 'discover':
        return await handlePluginDiscovery(req);
      
      case 'health':
        if (!pluginId || !tenantId) {
          return NextResponse.json({ error: 'pluginId and tenantId required' }, { status: 400 });
        }
        const deploymentId = searchParams.get('deploymentId') || 'default';
        const health = realTimePluginMonitor.getPluginHealth(pluginId, tenantId, deploymentId);
        return NextResponse.json({ health });
      
      case 'dashboard':
        const dashboard = realTimePluginMonitor.getDashboard();
        return NextResponse.json({ dashboard });
      
      case 'alerts':
        const alerts = realTimePluginMonitor.getActiveAlerts();
        return NextResponse.json({ alerts });
      
      case 'approvals':
        if (!tenantId) {
          return NextResponse.json({ error: 'tenantId required' }, { status: 400 });
        }
        const approverId = searchParams.get('approverId');
        if (approverId) {
          const requests = enterpriseGovernanceService.getPendingRequests(approverId);
          return NextResponse.json({ requests });
        } else {
          return NextResponse.json({ error: 'approverId required for approvals' }, { status: 400 });
        }
      
      case 'metrics':
        if (!tenantId) {
          return NextResponse.json({ error: 'tenantId required' }, { status: 400 });
        }
        const startDate = searchParams.get('start');
        const endDate = searchParams.get('end');
        const timeRange = {
          start: startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          end: endDate ? new Date(endDate) : new Date()
        };
        const metrics = await enterpriseGovernanceService.getGovernanceMetrics(timeRange);
        return NextResponse.json({ metrics });
      
      case 'deployments':
        if (!tenantId) {
          return NextResponse.json({ error: 'tenantId required' }, { status: 400 });
        }
        const deployments = await saasDeploymentOrchestrator.listTenantDeployments(tenantId);
        return NextResponse.json({ deployments });
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Comprehensive plugin API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, tenantId, pluginId } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    switch (action) {
      case 'install':
        return await handlePluginInstallation(body);
      
      case 'deploy':
        return await handlePluginDeployment(body);
      
      case 'configure':
        return await handlePluginConfiguration(body);
      
      case 'monitor':
        return await handlePluginMonitoring(body);
      
      case 'approve':
        return await handleApprovalAction(body);
      
      case 'scale':
        return await handlePluginScaling(body);
      
      case 'update':
        return await handlePluginUpdate(body);
      
      case 'remove':
        return await handlePluginRemoval(body);
      
      case 'security-scan':
        return await handleSecurityScan(body);
      
      case 'recovery':
        return await handleRecoveryAction(body);
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Comprehensive plugin API error:', error);
    return NextResponse.json(
      { error: 'Operation failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function handlePluginDiscovery(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('search') || '';
  const category = searchParams.get('category') || 'all';
  const verified = searchParams.get('verified') === 'true';
  const official = searchParams.get('official') === 'true';
  const enterprise = searchParams.get('enterprise') === 'true';

  const plugins = await comprehensivePluginRegistry.searchPlugins(query, {
    category: category !== 'all' ? category : undefined,
    verified: verified || undefined,
    official: official || undefined,
    enterprise: enterprise || undefined
  });

  const stats = await comprehensivePluginRegistry.getStats();

  return NextResponse.json({
    plugins,
    stats,
    total: plugins.length,
    source: 'comprehensive-registry'
  });
}

async function handlePluginInstallation(body: any): Promise<NextResponse> {
  const { pluginId, version, config, tenantId, environment, governance } = body;

  if (!pluginId || !tenantId) {
    return NextResponse.json({ error: 'pluginId and tenantId are required' }, { status: 400 });
  }

  try {
    let result;

    // Check if governance approval is required
    if (governance?.enabled && environment === 'production') {
      const approvalRequest = {
        requesterId: body.requesterId || 'system',
        requesterName: body.requesterName || 'System',
        requesterEmail: body.requesterEmail || 'system@backstage.io',
        type: 'plugin-install' as const,
        priority: body.priority || 'medium' as const,
        pluginId,
        pluginName: pluginId.split('/').pop() || pluginId,
        version: version || 'latest',
        tenantId,
        environment: environment || 'development',
        reason: body.reason || 'Plugin installation request',
        businessJustification: body.businessJustification || 'Required for platform functionality',
        impactAssessment: body.impactAssessment || 'Low impact, standard plugin installation',
        rollbackPlan: body.rollbackPlan,
        estimatedDowntime: body.estimatedDowntime,
        affectedUsers: body.affectedUsers,
        config,
        workflow: body.workflow || 'standard-approval',
        approvers: body.approvers || []
      };

      const requestId = await enterpriseGovernanceService.submitForApproval(approvalRequest);
      
      return NextResponse.json({
        success: true,
        message: 'Plugin installation submitted for approval',
        requestId,
        status: 'pending-approval'
      });
    } else {
      // Direct installation for non-production or when governance is disabled
      result = await automatedPluginInstaller.installPlugin(pluginId, version, config);
      
      if (result.success) {
        // Set up monitoring if deployment ID is available
        if (result.details?.deploymentId) {
          await setupPluginMonitoring(pluginId, tenantId, result.details.deploymentId, config);
        }
      }
    }

    return NextResponse.json(result);

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Installation failed'
    }, { status: 500 });
  }
}

async function handlePluginDeployment(body: any): Promise<NextResponse> {
  const { pluginId, tenantId, deploymentConfig } = body;

  if (!pluginId || !tenantId || !deploymentConfig) {
    return NextResponse.json({ error: 'pluginId, tenantId, and deploymentConfig are required' }, { status: 400 });
  }

  try {
    const result = await saasDeploymentOrchestrator.deployPlugin({
      tenantId,
      pluginId,
      version: deploymentConfig.version || 'latest',
      environment: deploymentConfig.environment || 'development',
      region: deploymentConfig.region || 'us-east-1',
      replicas: deploymentConfig.replicas || 3,
      resources: deploymentConfig.resources || { cpu: '200m', memory: '512Mi' },
      scaling: deploymentConfig.scaling || { enabled: true, minReplicas: 2, maxReplicas: 10, targetCPU: 70, targetMemory: 80 },
      networking: deploymentConfig.networking || { exposed: false, ingress: false, domains: [] },
      security: deploymentConfig.security || { isolation: 'shared', rbac: true, networkPolicies: true, podSecurityStandards: 'restricted' },
      monitoring: deploymentConfig.monitoring || { enabled: true, metrics: true, logging: true, alerts: true },
      backup: deploymentConfig.backup || { enabled: true, schedule: '0 2 * * *', retention: 30 }
    });

    if (result.success && result.deploymentId) {
      // Set up monitoring for the deployment
      await setupPluginMonitoring(pluginId, tenantId, result.deploymentId, deploymentConfig);
    }

    return NextResponse.json(result);

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Deployment failed'
    }, { status: 500 });
  }
}

async function handlePluginConfiguration(body: any): Promise<NextResponse> {
  const { pluginId, tenantId, config } = body;

  if (!pluginId || !tenantId || !config) {
    return NextResponse.json({ error: 'pluginId, tenantId, and config are required' }, { status: 400 });
  }

  try {
    // This would integrate with the configuration management system
    console.log(`Configuring plugin ${pluginId} for tenant ${tenantId}:`, config);

    return NextResponse.json({
      success: true,
      message: `Plugin ${pluginId} configured successfully`,
      config
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Configuration failed'
    }, { status: 500 });
  }
}

async function handlePluginMonitoring(body: any): Promise<NextResponse> {
  const { pluginId, tenantId, deploymentId, monitoringConfig } = body;

  if (!pluginId || !tenantId || !deploymentId) {
    return NextResponse.json({ error: 'pluginId, tenantId, and deploymentId are required' }, { status: 400 });
  }

  try {
    await setupPluginMonitoring(pluginId, tenantId, deploymentId, monitoringConfig);

    return NextResponse.json({
      success: true,
      message: `Monitoring configured for plugin ${pluginId}`
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Monitoring setup failed'
    }, { status: 500 });
  }
}

async function handleApprovalAction(body: any): Promise<NextResponse> {
  const { requestId, action, approverId, comments, reason } = body;

  if (!requestId || !action || !approverId) {
    return NextResponse.json({ error: 'requestId, action, and approverId are required' }, { status: 400 });
  }

  try {
    switch (action) {
      case 'approve':
        await enterpriseGovernanceService.approveRequest(requestId, approverId, comments);
        break;
      
      case 'reject':
        if (!reason) {
          return NextResponse.json({ error: 'reason is required for rejection' }, { status: 400 });
        }
        await enterpriseGovernanceService.rejectRequest(requestId, approverId, reason);
        break;
      
      default:
        return NextResponse.json({ error: 'Invalid approval action' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Request ${requestId} ${action}d successfully`
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Approval action failed'
    }, { status: 500 });
  }
}

async function handlePluginScaling(body: any): Promise<NextResponse> {
  const { pluginId, tenantId, replicas } = body;

  if (!pluginId || !tenantId || replicas === undefined) {
    return NextResponse.json({ error: 'pluginId, tenantId, and replicas are required' }, { status: 400 });
  }

  try {
    const result = await saasDeploymentOrchestrator.scalePlugin(tenantId, pluginId, replicas);
    return NextResponse.json(result);

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Scaling failed'
    }, { status: 500 });
  }
}

async function handlePluginUpdate(body: any): Promise<NextResponse> {
  const { pluginId, tenantId, newVersion, config } = body;

  if (!pluginId || !tenantId || !newVersion) {
    return NextResponse.json({ error: 'pluginId, tenantId, and newVersion are required' }, { status: 400 });
  }

  try {
    const result = await saasDeploymentOrchestrator.updatePlugin(tenantId, pluginId, newVersion, config);
    return NextResponse.json(result);

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Update failed'
    }, { status: 500 });
  }
}

async function handlePluginRemoval(body: any): Promise<NextResponse> {
  const { pluginId, tenantId, deploymentId } = body;

  if (!pluginId || !tenantId) {
    return NextResponse.json({ error: 'pluginId and tenantId are required' }, { status: 400 });
  }

  try {
    // Remove from monitoring first
    if (deploymentId) {
      await realTimePluginMonitor.unregisterPlugin(pluginId, tenantId, deploymentId);
    }

    // Remove deployment
    const result = await saasDeploymentOrchestrator.removePlugin(tenantId, pluginId);
    return NextResponse.json(result);

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Removal failed'
    }, { status: 500 });
  }
}

async function handleSecurityScan(body: any): Promise<NextResponse> {
  const { pluginId, version } = body;

  if (!pluginId) {
    return NextResponse.json({ error: 'pluginId is required' }, { status: 400 });
  }

  try {
    const scanId = await enterpriseGovernanceService.initiateSecurityScan(pluginId, version || 'latest');
    
    return NextResponse.json({
      success: true,
      scanId,
      message: `Security scan initiated for ${pluginId}`
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Security scan failed'
    }, { status: 500 });
  }
}

async function handleRecoveryAction(body: any): Promise<NextResponse> {
  const { pluginId, tenantId, deploymentId, strategy } = body;

  if (!pluginId || !tenantId || !deploymentId) {
    return NextResponse.json({ error: 'pluginId, tenantId, and deploymentId are required' }, { status: 400 });
  }

  try {
    await realTimePluginMonitor.triggerRecovery(pluginId, tenantId, deploymentId, strategy);
    
    return NextResponse.json({
      success: true,
      message: `Recovery triggered for plugin ${pluginId}`
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Recovery failed'
    }, { status: 500 });
  }
}

async function setupPluginMonitoring(
  pluginId: string, 
  tenantId: string, 
  deploymentId: string, 
  config: any
): Promise<void> {
  const monitoringConfig = {
    pluginId,
    tenantId,
    deploymentId,
    enabled: true,
    healthCheck: {
      enabled: true,
      endpoint: config?.healthEndpoint || `http://${pluginId}-${tenantId}/health`,
      interval: config?.healthCheckInterval || 30000, // 30 seconds
      timeout: 10000, // 10 seconds
      successThreshold: 1,
      failureThreshold: 3,
      expectedStatus: [200]
    },
    metrics: {
      enabled: true,
      endpoint: config?.metricsEndpoint,
      interval: config?.metricsInterval || 60000, // 1 minute
      customMetrics: config?.customMetrics || []
    },
    alerts: [
      {
        name: 'High Response Time',
        condition: 'response_time_high',
        threshold: 5000, // 5 seconds
        severity: 'warning' as const,
        duration: 300000, // 5 minutes
        enabled: true,
        actions: [
          { type: 'auto-recovery', config: {} },
          { type: 'email', config: { to: 'ops@company.com' } }
        ]
      },
      {
        name: 'Plugin Unhealthy',
        condition: 'status_unhealthy',
        threshold: 0,
        severity: 'critical' as const,
        duration: 60000, // 1 minute
        enabled: true,
        actions: [
          { type: 'auto-recovery', config: {} },
          { type: 'slack', config: { channel: '#alerts' } }
        ]
      },
      {
        name: 'High Error Rate',
        condition: 'error_rate_high',
        threshold: 10, // 10%
        severity: 'warning' as const,
        duration: 300000, // 5 minutes
        enabled: true,
        actions: [
          { type: 'auto-recovery', config: {} }
        ]
      }
    ],
    autoRecovery: {
      enabled: config?.autoRecovery?.enabled !== false,
      maxAttempts: config?.autoRecovery?.maxAttempts || 3,
      strategies: [
        {
          name: 'restart',
          conditions: ['status_unhealthy', 'response_time_high'],
          actions: [
            { type: 'restart', config: { gracePeriod: 30 } }
          ]
        },
        {
          name: 'scale-up',
          conditions: ['high_load', 'response_time_high'],
          actions: [
            { type: 'scale', config: { replicas: '+1', max: 10 } }
          ]
        }
      ]
    }
  };

  await realTimePluginMonitor.registerPlugin(monitoringConfig);
}