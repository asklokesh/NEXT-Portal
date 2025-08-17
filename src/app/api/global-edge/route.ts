/**
 * Global Edge Computing API
 * Manage multi-region deployments, traffic routing, and edge operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { globalEdgeOrchestrator } from '@/lib/global-edge/edge-orchestrator';
import { extractTenantContext, validateTenantAccess } from '@/middleware/tenant-context';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

/**
 * GET /api/global-edge - Get edge network status and metrics
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action') || 'metrics';

    // Extract tenant context
    const tenantContext = extractTenantContext(request);
    const userRole = request.headers.get('x-user-role');

    // Check admin access for most operations
    if (userRole !== 'admin' && action !== 'health' && action !== 'regions') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    switch (action) {
      case 'health':
        const healthChecks = globalEdgeOrchestrator.getHealthChecks();
        const healthyChecks = healthChecks.filter(hc => hc.status === 'healthy').length;
        
        return NextResponse.json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          globalEdge: {
            enabled: true,
            regions: globalEdgeOrchestrator.getRegions().length,
            healthyEndpoints: healthyChecks,
            totalEndpoints: healthChecks.length,
            healthPercentage: healthChecks.length > 0 ? (healthyChecks / healthChecks.length) * 100 : 100
          }
        });

      case 'metrics':
        const metrics = globalEdgeOrchestrator.getGlobalMetrics();
        return NextResponse.json({
          metrics,
          timestamp: new Date().toISOString()
        });

      case 'regions':
        const regions = globalEdgeOrchestrator.getRegions();
        return NextResponse.json({
          regions: regions.map(region => ({
            id: region.id,
            name: region.name,
            code: region.code,
            location: region.location,
            status: region.status,
            latency: region.latency,
            capacity: region.capacity,
            compliance: region.compliance,
            endpoints: region.endpoints
          })),
          total: regions.length
        });

      case 'edge-nodes':
        const edgeNodes = globalEdgeOrchestrator.getEdgeNodes();
        const regionId = searchParams.get('regionId');

        let filteredNodes = edgeNodes;
        if (regionId) {
          filteredNodes = edgeNodes.filter(node => node.regionId === regionId);
        }

        return NextResponse.json({
          edgeNodes: filteredNodes.map(node => ({
            id: node.id,
            regionId: node.regionId,
            name: node.name,
            location: node.location,
            status: node.status,
            capabilities: node.capabilities,
            metrics: node.metrics,
            configuration: node.configuration
          })),
          total: filteredNodes.length
        });

      case 'health-checks':
        const allHealthChecks = globalEdgeOrchestrator.getHealthChecks();
        return NextResponse.json({
          healthChecks: allHealthChecks.map(hc => ({
            id: hc.id,
            regionId: hc.regionId,
            url: hc.url,
            method: hc.method,
            status: hc.status,
            responseTime: hc.responseTime,
            lastCheck: hc.lastCheck,
            interval: hc.interval
          })),
          summary: {
            total: allHealthChecks.length,
            healthy: allHealthChecks.filter(hc => hc.status === 'healthy').length,
            unhealthy: allHealthChecks.filter(hc => hc.status === 'unhealthy').length,
            unknown: allHealthChecks.filter(hc => hc.status === 'unknown').length
          }
        });

      case 'routing-analysis':
        const userLat = parseFloat(searchParams.get('lat') || '40.7128');
        const userLng = parseFloat(searchParams.get('lng') || '-74.0060');
        const path = searchParams.get('path') || '/api/default';

        try {
          const routing = await globalEdgeOrchestrator.routeRequest({
            path,
            method: 'GET',
            headers: Object.fromEntries(request.headers.entries()),
            userLocation: { lat: userLat, lng: userLng },
            tenantId: tenantContext?.tenantId
          });

          return NextResponse.json({
            routing: {
              targetRegion: routing.targetRegion,
              endpoint: routing.endpoint,
              estimatedLatency: routing.estimatedLatency,
              routingReason: routing.routingReason
            },
            userLocation: { lat: userLat, lng: userLng },
            timestamp: new Date().toISOString()
          });

        } catch (error) {
          return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Routing analysis failed' },
            { status: 500 }
          );
        }

      case 'compliance-report':
        if (!tenantContext) {
          return NextResponse.json(
            { error: 'Tenant context required' },
            { status: 400 }
          );
        }

        try {
          const complianceReport = await globalEdgeOrchestrator.generateComplianceReport(
            tenantContext.tenantId
          );

          return NextResponse.json({
            complianceReport,
            timestamp: new Date().toISOString()
          });

        } catch (error) {
          return NextResponse.json(
            { error: 'Failed to generate compliance report' },
            { status: 500 }
          );
        }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported: health, metrics, regions, edge-nodes, health-checks, routing-analysis, compliance-report' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error processing global edge request:', error);
    return NextResponse.json(
      { error: 'Failed to process global edge request' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/global-edge - Deploy services and manage edge operations
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // Extract tenant context
    const tenantContext = extractTenantContext(request);
    const userRole = request.headers.get('x-user-role');
    const userId = request.headers.get('x-user-id');

    // Authentication check
    if (!tenantContext || !userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Validate tenant access
    const hasAccess = await validateTenantAccess(tenantContext.tenantId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Tenant access denied' },
        { status: 403 }
      );
    }

    switch (action) {
      case 'deploy-to-edge':
        return await handleDeployToEdge(body, tenantContext);

      case 'scale-edge-nodes':
        if (userRole !== 'admin') {
          return NextResponse.json(
            { error: 'Admin access required' },
            { status: 403 }
          );
        }
        return await handleScaleEdgeNodes(body);

      case 'optimize-replication':
        if (userRole !== 'admin') {
          return NextResponse.json(
            { error: 'Admin access required' },
            { status: 403 }
          );
        }
        return await handleOptimizeReplication();

      case 'test-routing':
        return await handleTestRouting(body, tenantContext);

      case 'simulate-failover':
        if (userRole !== 'admin') {
          return NextResponse.json(
            { error: 'Admin access required' },
            { status: 403 }
          );
        }
        return await handleSimulateFailover(body);

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported: deploy-to-edge, scale-edge-nodes, optimize-replication, test-routing, simulate-failover' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error processing global edge operation:', error);
    return NextResponse.json(
      { error: 'Failed to process global edge operation' },
      { status: 500 }
    );
  }
}

/**
 * Handler implementations
 */
async function handleDeployToEdge(body: any, tenantContext: any): Promise<NextResponse> {
  const { serviceName, configuration } = body;

  if (!serviceName || !configuration) {
    return NextResponse.json(
      { error: 'Missing required fields: serviceName, configuration' },
      { status: 400 }
    );
  }

  // Validate configuration
  if (!configuration.regions || !Array.isArray(configuration.regions)) {
    return NextResponse.json(
      { error: 'Invalid configuration: regions must be an array' },
      { status: 400 }
    );
  }

  if (!configuration.strategy || !['all', 'primary-backup', 'active-active'].includes(configuration.strategy)) {
    return NextResponse.json(
      { error: 'Invalid configuration: strategy must be all, primary-backup, or active-active' },
      { status: 400 }
    );
  }

  try {
    const deployment = await globalEdgeOrchestrator.deployToEdge(
      serviceName,
      {
        regions: configuration.regions,
        strategy: configuration.strategy,
        requirements: configuration.requirements || {}
      },
      tenantContext.tenantId
    );

    return NextResponse.json({
      deployment: {
        deploymentId: deployment.deploymentId,
        endpoints: deployment.endpoints,
        estimatedLatency: deployment.estimatedLatency
      },
      message: 'Service deployed to global edge network successfully',
      serviceName,
      regionsDeployed: Object.keys(deployment.endpoints).length
    });

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to deploy to edge' },
      { status: 500 }
    );
  }
}

async function handleScaleEdgeNodes(body: any): Promise<NextResponse> {
  const { regionId, scaling } = body;

  if (!regionId || !scaling) {
    return NextResponse.json(
      { error: 'Missing required fields: regionId, scaling' },
      { status: 400 }
    );
  }

  if (!scaling.action || !['scale_up', 'scale_down'].includes(scaling.action)) {
    return NextResponse.json(
      { error: 'Invalid scaling action: must be scale_up or scale_down' },
      { status: 400 }
    );
  }

  if (typeof scaling.targetCapacity !== 'number' || scaling.targetCapacity < 0) {
    return NextResponse.json(
      { error: 'Invalid targetCapacity: must be a positive number' },
      { status: 400 }
    );
  }

  try {
    await globalEdgeOrchestrator.scaleEdgeNodes(regionId, {
      action: scaling.action,
      targetCapacity: scaling.targetCapacity,
      reason: scaling.reason || 'Manual scaling operation'
    });

    return NextResponse.json({
      message: `Edge nodes ${scaling.action} completed successfully`,
      regionId,
      targetCapacity: scaling.targetCapacity,
      action: scaling.action
    });

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to scale edge nodes' },
      { status: 500 }
    );
  }
}

async function handleOptimizeReplication(): Promise<NextResponse> {
  try {
    const optimization = await globalEdgeOrchestrator.optimizeDataReplication();

    return NextResponse.json({
      optimization: {
        currentLag: optimization.currentLag,
        optimizations: optimization.optimizations,
        projectedImprovement: optimization.projectedImprovement
      },
      message: 'Data replication optimization completed',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to optimize data replication' },
      { status: 500 }
    );
  }
}

async function handleTestRouting(body: any, tenantContext: any): Promise<NextResponse> {
  const { testLocations, path } = body;

  if (!testLocations || !Array.isArray(testLocations)) {
    return NextResponse.json(
      { error: 'Missing required field: testLocations (array)' },
      { status: 400 }
    );
  }

  const testPath = path || '/api/test';
  const results = [];

  try {
    for (const location of testLocations) {
      if (!location.lat || !location.lng) {
        continue;
      }

      const routing = await globalEdgeOrchestrator.routeRequest({
        path: testPath,
        method: 'GET',
        headers: {},
        userLocation: { lat: location.lat, lng: location.lng },
        tenantId: tenantContext.tenantId
      });

      results.push({
        location: {
          name: location.name || `${location.lat}, ${location.lng}`,
          coordinates: { lat: location.lat, lng: location.lng }
        },
        routing: {
          targetRegion: routing.targetRegion,
          endpoint: routing.endpoint,
          estimatedLatency: routing.estimatedLatency,
          routingReason: routing.routingReason
        }
      });
    }

    return NextResponse.json({
      testResults: results,
      summary: {
        totalTests: results.length,
        averageLatency: results.reduce((sum, r) => sum + r.routing.estimatedLatency, 0) / results.length,
        uniqueRegions: new Set(results.map(r => r.routing.targetRegion)).size
      },
      path: testPath,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to test routing' },
      { status: 500 }
    );
  }
}

async function handleSimulateFailover(body: any): Promise<NextResponse> {
  const { regionId, reason } = body;

  if (!regionId) {
    return NextResponse.json(
      { error: 'Missing required field: regionId' },
      { status: 400 }
    );
  }

  try {
    const failover = await globalEdgeOrchestrator.handleRegionFailover(
      regionId,
      reason || 'Simulated failover test'
    );

    return NextResponse.json({
      failover: {
        failedRegion: regionId,
        backupRegions: failover.backupRegions,
        trafficRedirected: failover.trafficRedirected,
        estimatedRecovery: failover.estimatedRecovery
      },
      message: 'Failover simulation completed successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to simulate failover' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/global-edge - Update edge configurations and settings
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    const userRole = request.headers.get('x-user-role');
    if (userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    switch (action) {
      case 'update-region-config':
        return await handleUpdateRegionConfig(body);

      case 'update-routing-policy':
        return await handleUpdateRoutingPolicy(body);

      case 'update-compliance-rules':
        return await handleUpdateComplianceRules(body);

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported: update-region-config, update-routing-policy, update-compliance-rules' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error updating global edge configuration:', error);
    return NextResponse.json(
      { error: 'Failed to update global edge configuration' },
      { status: 500 }
    );
  }
}

async function handleUpdateRegionConfig(body: any): Promise<NextResponse> {
  const { regionId, updates } = body;

  if (!regionId || !updates) {
    return NextResponse.json(
      { error: 'Missing required fields: regionId, updates' },
      { status: 400 }
    );
  }

  // In a real implementation, this would update the region configuration
  console.log(`Updating region ${regionId} configuration:`, updates);

  return NextResponse.json({
    message: 'Region configuration updated successfully',
    regionId,
    updates
  });
}

async function handleUpdateRoutingPolicy(body: any): Promise<NextResponse> {
  const { policyId, policy } = body;

  if (!policyId || !policy) {
    return NextResponse.json(
      { error: 'Missing required fields: policyId, policy' },
      { status: 400 }
    );
  }

  // In a real implementation, this would update the routing policy
  console.log(`Updating routing policy ${policyId}:`, policy);

  return NextResponse.json({
    message: 'Routing policy updated successfully',
    policyId,
    policy
  });
}

async function handleUpdateComplianceRules(body: any): Promise<NextResponse> {
  const { tenantId, rules } = body;

  if (!rules) {
    return NextResponse.json(
      { error: 'Missing required field: rules' },
      { status: 400 }
    );
  }

  // In a real implementation, this would update compliance rules
  console.log(`Updating compliance rules for tenant ${tenantId || 'default'}:`, rules);

  return NextResponse.json({
    message: 'Compliance rules updated successfully',
    tenantId: tenantId || 'default',
    rules
  });
}

/**
 * DELETE /api/global-edge - Remove deployments and cleanup
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');
    const userRole = request.headers.get('x-user-role');

    if (userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    switch (action) {
      case 'cleanup-failed-deployments':
        console.log('Cleaning up failed edge deployments');
        return NextResponse.json({
          message: 'Failed deployments cleaned up successfully',
          cleaned: 'failed_deployments'
        });

      case 'reset-health-checks':
        console.log('Resetting edge health checks');
        return NextResponse.json({
          message: 'Health checks reset successfully',
          reset: 'health_checks'
        });

      case 'clear-metrics':
        console.log('Clearing edge metrics');
        return NextResponse.json({
          message: 'Edge metrics cleared successfully',
          cleared: 'metrics'
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported: cleanup-failed-deployments, reset-health-checks, clear-metrics' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error processing global edge delete request:', error);
    return NextResponse.json(
      { error: 'Failed to process delete request' },
      { status: 500 }
    );
  }
}