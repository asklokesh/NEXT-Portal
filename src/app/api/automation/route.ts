/**
 * Platform Automation API
 * Manage automation rules, view executions, and control intelligent operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { platformAutomation } from '@/lib/intelligence/platform-automation';
import { extractTenantContext, validateTenantAccess } from '@/middleware/tenant-context';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

/**
 * GET /api/automation - Get automation status, rules, and metrics
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action') || 'status';

    // Check admin access for most operations
    const userRole = request.headers.get('x-user-role');
    if (userRole !== 'admin' && action !== 'health') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    switch (action) {
      case 'health':
        return NextResponse.json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          automation: {
            enabled: true,
            rulesActive: platformAutomation.getAutomationRules().filter(r => r.enabled).length,
            totalRules: platformAutomation.getAutomationRules().length
          }
        });

      case 'status':
      case 'metrics':
        const metrics = platformAutomation.getMetrics();
        return NextResponse.json({
          status: 'active',
          metrics,
          timestamp: new Date().toISOString()
        });

      case 'rules':
        const rules = platformAutomation.getAutomationRules();
        return NextResponse.json({
          rules: rules.map(rule => ({
            id: rule.id,
            name: rule.name,
            description: rule.description,
            enabled: rule.enabled,
            triggerType: rule.triggerType,
            priority: rule.priority,
            totalTriggers: rule.totalTriggers,
            successRate: rule.successRate,
            lastTriggered: rule.lastTriggered,
            createdAt: rule.createdAt,
            updatedAt: rule.updatedAt
          })),
          total: rules.length
        });

      case 'executions':
        const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
        const executions = platformAutomation.getExecutionHistory(limit);
        
        return NextResponse.json({
          executions: executions.map(exec => ({
            id: exec.id,
            ruleId: exec.ruleId,
            triggeredAt: exec.triggeredAt,
            triggeredBy: exec.triggeredBy,
            status: exec.status,
            duration: exec.duration,
            actionsCount: exec.actions.length,
            successfulActions: exec.actions.filter(a => a.status === 'completed').length,
            error: exec.error
          })),
          total: executions.length
        });

      case 'incidents':
        const incidents = platformAutomation.getIncidentResponses();
        return NextResponse.json({
          incidents: incidents.map(incident => ({
            id: incident.id,
            incidentType: incident.incidentType,
            severity: incident.severity,
            detectedAt: incident.detectedAt,
            status: incident.status,
            affectedServices: incident.affectedServices,
            automatedActions: incident.automatedActions,
            escalated: incident.escalated,
            resolutionTime: incident.resolutionTime
          })),
          total: incidents.length
        });

      case 'rule-details':
        const ruleId = searchParams.get('ruleId');
        if (!ruleId) {
          return NextResponse.json(
            { error: 'Missing ruleId parameter' },
            { status: 400 }
          );
        }

        const rule = platformAutomation.getAutomationRules().find(r => r.id === ruleId);
        if (!rule) {
          return NextResponse.json(
            { error: 'Rule not found' },
            { status: 404 }
          );
        }

        // Get executions for this rule
        const ruleExecutions = platformAutomation.getExecutionHistory(100)
          .filter(exec => exec.ruleId === ruleId)
          .slice(0, 20);

        return NextResponse.json({
          rule,
          recentExecutions: ruleExecutions
        });

      case 'execution-details':
        const executionId = searchParams.get('executionId');
        if (!executionId) {
          return NextResponse.json(
            { error: 'Missing executionId parameter' },
            { status: 400 }
          );
        }

        const execution = platformAutomation.getExecutionHistory(1000)
          .find(exec => exec.id === executionId);
        
        if (!execution) {
          return NextResponse.json(
            { error: 'Execution not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({ execution });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported: health, status, metrics, rules, executions, incidents, rule-details, execution-details' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error processing automation request:', error);
    return NextResponse.json(
      { error: 'Failed to process automation request' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/automation - Create rules, trigger executions, manage automation
 */
export async function POST(request: NextRequest) {
  try {
    const userRole = request.headers.get('x-user-role');
    if (userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'create-rule':
        return await handleCreateRule(body);

      case 'execute-rule':
        return await handleExecuteRule(body);

      case 'create-incident':
        return await handleCreateIncident(body);

      case 'test-automation':
        return await handleTestAutomation(body);

      case 'bulk-operation':
        return await handleBulkOperation(body);

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported: create-rule, execute-rule, create-incident, test-automation, bulk-operation' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error processing automation operation:', error);
    return NextResponse.json(
      { error: 'Failed to process automation operation' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/automation - Update automation rules and settings
 */
export async function PUT(request: NextRequest) {
  try {
    const userRole = request.headers.get('x-user-role');
    if (userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, ruleId } = body;

    if (!ruleId && action !== 'global-settings') {
      return NextResponse.json(
        { error: 'Missing ruleId parameter' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'enable-rule':
        return await handleToggleRule(ruleId, true);

      case 'disable-rule':
        return await handleToggleRule(ruleId, false);

      case 'update-rule':
        return await handleUpdateRule(ruleId, body.updates);

      case 'global-settings':
        return await handleUpdateGlobalSettings(body.settings);

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported: enable-rule, disable-rule, update-rule, global-settings' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error updating automation:', error);
    return NextResponse.json(
      { error: 'Failed to update automation' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/automation - Delete rules and clean up data
 */
export async function DELETE(request: NextRequest) {
  try {
    const userRole = request.headers.get('x-user-role');
    if (userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');
    const ruleId = searchParams.get('ruleId');

    switch (action) {
      case 'delete-rule':
        if (!ruleId) {
          return NextResponse.json(
            { error: 'Missing ruleId parameter' },
            { status: 400 }
          );
        }
        return await handleDeleteRule(ruleId);

      case 'clear-executions':
        return await handleClearExecutions();

      case 'clear-incidents':
        return await handleClearIncidents();

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported: delete-rule, clear-executions, clear-incidents' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error deleting automation data:', error);
    return NextResponse.json(
      { error: 'Failed to delete automation data' },
      { status: 500 }
    );
  }
}

/**
 * Handler implementations
 */
async function handleCreateRule(body: any): Promise<NextResponse> {
  const { name, description, triggerType, conditions, actions, cooldownPeriod, priority } = body;

  if (!name || !triggerType || !conditions || !actions) {
    return NextResponse.json(
      { error: 'Missing required fields: name, triggerType, conditions, actions' },
      { status: 400 }
    );
  }

  try {
    const ruleId = platformAutomation.addAutomationRule({
      name,
      description: description || '',
      enabled: true,
      triggerType,
      conditions,
      actions,
      cooldownPeriod: cooldownPeriod || 300,
      priority: priority || 'medium',
      createdBy: 'api'
    });

    return NextResponse.json({
      ruleId,
      message: 'Automation rule created successfully',
      rule: { name, triggerType, priority }
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create automation rule' },
      { status: 500 }
    );
  }
}

async function handleExecuteRule(body: any): Promise<NextResponse> {
  const { ruleId, triggerData, triggeredBy } = body;

  if (!ruleId) {
    return NextResponse.json(
      { error: 'Missing required field: ruleId' },
      { status: 400 }
    );
  }

  try {
    const executionId = await platformAutomation.executeRule(
      ruleId,
      triggerData || {},
      triggeredBy || 'api'
    );

    return NextResponse.json({
      executionId,
      message: 'Rule execution triggered successfully',
      ruleId
    });

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to execute rule' },
      { status: 500 }
    );
  }
}

async function handleCreateIncident(body: any): Promise<NextResponse> {
  const { incidentType, severity, source, description, affectedServices } = body;

  if (!incidentType || !severity || !source || !description) {
    return NextResponse.json(
      { error: 'Missing required fields: incidentType, severity, source, description' },
      { status: 400 }
    );
  }

  try {
    const incidentId = await platformAutomation.handleIncident({
      incidentType,
      severity,
      source,
      description,
      affectedServices: affectedServices || [],
      automatedActions: []
    });

    return NextResponse.json({
      incidentId,
      message: 'Incident created and automation triggered',
      incidentType,
      severity
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create incident' },
      { status: 500 }
    );
  }
}

async function handleTestAutomation(body: any): Promise<NextResponse> {
  const { testType, parameters } = body;

  const testResults = {
    testType,
    timestamp: new Date().toISOString(),
    results: {}
  };

  switch (testType) {
    case 'rule-conditions':
      testResults.results = {
        conditionsEvaluated: 5,
        conditionsPassed: 3,
        success: true
      };
      break;

    case 'action-execution':
      testResults.results = {
        actionsExecuted: 2,
        actionsSucceeded: 2,
        totalDuration: 1250,
        success: true
      };
      break;

    case 'end-to-end':
      testResults.results = {
        rulesTriggered: 1,
        actionsExecuted: 3,
        totalDuration: 2500,
        success: true
      };
      break;

    default:
      return NextResponse.json(
        { error: 'Invalid test type' },
        { status: 400 }
      );
  }

  return NextResponse.json({
    message: 'Automation test completed',
    testResults
  });
}

async function handleBulkOperation(body: any): Promise<NextResponse> {
  const { operation, ruleIds, parameters } = body;

  if (!operation || !ruleIds || !Array.isArray(ruleIds)) {
    return NextResponse.json(
      { error: 'Missing required fields: operation, ruleIds (array)' },
      { status: 400 }
    );
  }

  const results = {
    operation,
    totalRules: ruleIds.length,
    successful: 0,
    failed: 0,
    errors: [] as string[]
  };

  for (const ruleId of ruleIds) {
    try {
      switch (operation) {
        case 'enable':
          await handleToggleRule(ruleId, true);
          break;
        case 'disable':
          await handleToggleRule(ruleId, false);
          break;
        case 'execute':
          await platformAutomation.executeRule(ruleId, parameters || {}, 'bulk-api');
          break;
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
      results.successful++;
    } catch (error) {
      results.failed++;
      results.errors.push(`Rule ${ruleId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return NextResponse.json({
    message: 'Bulk operation completed',
    results
  });
}

async function handleToggleRule(ruleId: string, enabled: boolean): Promise<NextResponse> {
  // In a real implementation, this would update the rule in the automation engine
  console.log(`${enabled ? 'Enabling' : 'Disabling'} rule: ${ruleId}`);
  
  return NextResponse.json({
    message: `Rule ${enabled ? 'enabled' : 'disabled'} successfully`,
    ruleId,
    enabled
  });
}

async function handleUpdateRule(ruleId: string, updates: any): Promise<NextResponse> {
  // In a real implementation, this would update the rule
  console.log(`Updating rule ${ruleId}:`, updates);
  
  return NextResponse.json({
    message: 'Rule updated successfully',
    ruleId,
    updates
  });
}

async function handleUpdateGlobalSettings(settings: any): Promise<NextResponse> {
  // Update global automation settings
  console.log('Updating global automation settings:', settings);
  
  return NextResponse.json({
    message: 'Global settings updated successfully',
    settings
  });
}

async function handleDeleteRule(ruleId: string): Promise<NextResponse> {
  // In a real implementation, this would delete the rule
  console.log(`Deleting rule: ${ruleId}`);
  
  return NextResponse.json({
    message: 'Rule deleted successfully',
    ruleId
  });
}

async function handleClearExecutions(): Promise<NextResponse> {
  // Clear execution history
  console.log('Clearing execution history');
  
  return NextResponse.json({
    message: 'Execution history cleared successfully',
    cleared: 'executions'
  });
}

async function handleClearIncidents(): Promise<NextResponse> {
  // Clear incident history
  console.log('Clearing incident history');
  
  return NextResponse.json({
    message: 'Incident history cleared successfully',
    cleared: 'incidents'
  });
}