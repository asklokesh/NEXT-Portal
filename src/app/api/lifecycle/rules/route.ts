import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { 
  lifecycleRulesEngine,
  LifecycleRuleSchema,
  RulePriority,
  RuleStatus,
  RuleConditionType,
  RuleOperator,
  RuleAction
} from '@/lib/lifecycle/LifecycleRules';
import { LifecycleStage } from '@/lib/lifecycle/LifecycleManager';

// Request schemas
const CreateRuleSchema = LifecycleRuleSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  executionCount: true,
  lastExecuted: true
});

const UpdateRuleSchema = LifecycleRuleSchema.partial().omit({
  id: true,
  createdAt: true,
  createdBy: true
});

const RuleToggleSchema = z.object({
  ruleId: z.string(),
  enabled: z.boolean()
});

const ManualOverrideSchema = z.object({
  ruleId: z.string(),
  entityId: z.string(),
  action: z.enum(['enable', 'disable']),
  reason: z.string(),
  overriddenBy: z.string()
});

const RuleTestSchema = z.object({
  ruleId: z.string(),
  entityId: z.string()
});

// GET /api/lifecycle/rules - Get all rules or filtered rules
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as RuleStatus | undefined;
    const priority = searchParams.get('priority') as RulePriority | undefined;
    const stage = searchParams.get('stage') as LifecycleStage | undefined;
    const includeStats = searchParams.get('includeStats') === 'true';
    const ruleId = searchParams.get('ruleId');

    // Get single rule if ruleId provided
    if (ruleId) {
      const rule = await lifecycleRulesEngine.getRule(ruleId);
      if (!rule) {
        return NextResponse.json(
          { success: false, error: 'Rule not found' },
          { status: 404 }
        );
      }

      let ruleWithStats = rule;
      if (includeStats) {
        const stats = await lifecycleRulesEngine.getRulePerformanceMetrics(ruleId);
        ruleWithStats = { ...rule, stats };
      }

      return NextResponse.json({
        success: true,
        data: { rule: ruleWithStats }
      });
    }

    // Get filtered rules
    const rules = await lifecycleRulesEngine.getRules({ status, priority, stage });

    // Add performance stats if requested
    let enrichedRules = rules;
    if (includeStats) {
      enrichedRules = await Promise.all(
        rules.map(async (rule) => {
          const stats = await lifecycleRulesEngine.getRulePerformanceMetrics(rule.id);
          return { ...rule, stats };
        })
      );
    }

    // Get execution history if requested
    const includeHistory = searchParams.get('includeHistory') === 'true';
    let executionHistory = undefined;
    if (includeHistory) {
      const days = parseInt(searchParams.get('historyDays') || '7');
      executionHistory = await lifecycleRulesEngine.getRuleExecutionHistory(undefined, days);
    }

    return NextResponse.json({
      success: true,
      data: {
        rules: enrichedRules,
        total: enrichedRules.length,
        executionHistory
      }
    });

  } catch (error) {
    console.error('Error fetching rules:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch rules',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/lifecycle/rules - Create a new rule
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = CreateRuleSchema.parse(body);

    const rule = await lifecycleRulesEngine.createRule(validatedData);

    return NextResponse.json({
      success: true,
      data: { rule }
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating rule:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid rule data',
          details: error.errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create rule',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// PUT /api/lifecycle/rules - Update an existing rule
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { ruleId, ...updates } = body;

    if (!ruleId) {
      return NextResponse.json(
        { success: false, error: 'ruleId is required' },
        { status: 400 }
      );
    }

    const validatedUpdates = UpdateRuleSchema.parse(updates);
    const rule = await lifecycleRulesEngine.updateRule(ruleId, validatedUpdates);

    return NextResponse.json({
      success: true,
      data: { rule }
    });

  } catch (error) {
    console.error('Error updating rule:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid rule update data',
          details: error.errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update rule',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// DELETE /api/lifecycle/rules - Delete a rule
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ruleId = searchParams.get('ruleId');

    if (!ruleId) {
      return NextResponse.json(
        { success: false, error: 'ruleId is required' },
        { status: 400 }
      );
    }

    await lifecycleRulesEngine.deleteRule(ruleId);

    return NextResponse.json({
      success: true,
      data: { message: 'Rule deleted successfully', ruleId }
    });

  } catch (error) {
    console.error('Error deleting rule:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete rule',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/lifecycle/rules/toggle - Toggle rule enabled/disabled
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action;

    switch (action) {
      case 'toggle':
        return handleRuleToggle(body);
      case 'test':
        return handleRuleTest(body);
      case 'override':
        return handleManualOverride(body);
      case 'export':
        return handleRuleExport();
      case 'import':
        return handleRuleImport(body);
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error processing rule action:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process rule action',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Handle rule toggle
async function handleRuleToggle(body: any) {
  const validatedData = RuleToggleSchema.parse(body);
  
  const rule = await lifecycleRulesEngine.updateRule(validatedData.ruleId, {
    enabled: validatedData.enabled
  });

  return NextResponse.json({
    success: true,
    data: { 
      rule,
      message: `Rule ${validatedData.enabled ? 'enabled' : 'disabled'} successfully`
    }
  });
}

// Handle rule test
async function handleRuleTest(body: any) {
  const validatedData = RuleTestSchema.parse(body);
  
  // This would require access to lifecycle manager to get the entity
  // For now, return a mock response
  return NextResponse.json({
    success: true,
    data: {
      message: 'Rule test functionality would be implemented here',
      ruleId: validatedData.ruleId,
      entityId: validatedData.entityId
    }
  });
}

// Handle manual override
async function handleManualOverride(body: any) {
  const validatedData = ManualOverrideSchema.parse(body);
  
  if (validatedData.action === 'enable') {
    await lifecycleRulesEngine.enableManualOverride(
      validatedData.ruleId,
      validatedData.entityId,
      validatedData.reason,
      validatedData.overriddenBy
    );
  } else {
    await lifecycleRulesEngine.disableManualOverride(
      validatedData.ruleId,
      validatedData.entityId
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      message: `Manual override ${validatedData.action}d successfully`,
      ruleId: validatedData.ruleId,
      entityId: validatedData.entityId
    }
  });
}

// Handle rule export
async function handleRuleExport() {
  const config = await lifecycleRulesEngine.exportRuleConfiguration();
  
  return NextResponse.json({
    success: true,
    data: {
      config,
      exportDate: new Date().toISOString()
    }
  });
}

// Handle rule import
async function handleRuleImport(body: any) {
  if (!body.config) {
    return NextResponse.json(
      { success: false, error: 'config is required for import' },
      { status: 400 }
    );
  }

  await lifecycleRulesEngine.importRuleConfiguration(body.config);
  
  return NextResponse.json({
    success: true,
    data: {
      message: 'Rules imported successfully'
    }
  });
}

// Additional endpoints for rule management

// GET /api/lifecycle/rules/execution-history
export async function getExecutionHistory(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ruleId = searchParams.get('ruleId') || undefined;
    const days = parseInt(searchParams.get('days') || '30');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    let executionHistory = await lifecycleRulesEngine.getRuleExecutionHistory(ruleId, days);
    
    // Apply pagination
    const total = executionHistory.length;
    const paginatedHistory = executionHistory.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      data: {
        executions: paginatedHistory,
        pagination: {
          total,
          offset,
          limit,
          hasMore: offset + limit < total
        }
      }
    });

  } catch (error) {
    console.error('Error fetching execution history:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch execution history',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET /api/lifecycle/rules/overrides
export async function getManualOverrides(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ruleId = searchParams.get('ruleId') || undefined;

    const overrides = await lifecycleRulesEngine.getManualOverrides(ruleId);

    return NextResponse.json({
      success: true,
      data: {
        overrides,
        total: overrides.length
      }
    });

  } catch (error) {
    console.error('Error fetching manual overrides:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch manual overrides',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET /api/lifecycle/rules/schema - Get rule schema for UI builders
export async function getRuleSchema() {
  const schema = {
    conditionTypes: Object.values(RuleConditionType),
    operators: Object.values(RuleOperator),
    actions: Object.values(RuleAction),
    priorities: Object.values(RulePriority),
    statuses: Object.values(RuleStatus),
    stages: Object.values(LifecycleStage),
    
    examples: {
      metricThresholdCondition: {
        type: RuleConditionType.METRIC_THRESHOLD,
        field: 'metrics.usage.dailyActiveUsers',
        operator: RuleOperator.LESS_THAN,
        value: 10
      },
      timeBasedCondition: {
        type: RuleConditionType.TIME_BASED,
        field: 'updatedAt',
        operator: RuleOperator.LESS_THAN,
        value: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
      },
      transitionAction: {
        type: RuleAction.TRANSITION_TO_STAGE,
        parameters: {
          targetStage: LifecycleStage.DEPRECATED,
          reason: 'Automated transition due to low usage'
        }
      },
      notificationAction: {
        type: RuleAction.SEND_NOTIFICATION,
        parameters: {
          subject: 'Service requires attention',
          message: 'Your service {{entityName}} needs review'
        }
      }
    }
  };

  return NextResponse.json({
    success: true,
    data: schema
  });
}