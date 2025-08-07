import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getGitHubScheduler } from '@/lib/discovery/GitHubScheduler';

// Action validation schema
const ActionSchema = z.object({
  action: z.enum(['execute', 'toggle', 'test']),
  configId: z.string().min(1, 'Configuration ID is required'),
  enabled: z.boolean().optional(), // For toggle action
});

/**
 * POST /api/catalog/discovery/github/scheduler/actions
 * 
 * Execute actions on scheduled scan configurations
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, configId, enabled } = ActionSchema.parse(body);
    
    const scheduler = getGitHubScheduler();
    
    // Check if configuration exists
    const config = scheduler.getScheduledScan(configId);
    if (!config) {
      return NextResponse.json(
        {
          success: false,
          error: `Scheduled scan configuration not found: ${configId}`,
          timestamp: new Date(),
        },
        { status: 404 }
      );
    }

    switch (action) {
      case 'execute':
        return await handleExecuteAction(scheduler, configId, config.name);
      
      case 'toggle':
        return await handleToggleAction(scheduler, configId, config.name, enabled);
      
      case 'test':
        return await handleTestAction(scheduler, configId, config);
      
      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unknown action: ${action}`,
            timestamp: new Date(),
          },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('[GitHub Scheduler Actions API] Error:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request format',
          details: error.errors,
          timestamp: new Date(),
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date(),
      },
      { status: 500 }
    );
  }
}

/**
 * Handle execute action - run a scheduled scan immediately
 */
async function handleExecuteAction(scheduler: any, configId: string, configName: string) {
  try {
    console.log(`[GitHub Scheduler Actions] Executing scheduled scan: ${configName} (${configId})`);
    
    const execution = await scheduler.executeNow(configId);
    
    return NextResponse.json({
      success: true,
      data: execution,
      message: `Scheduled scan "${configName}" execution started`,
      timestamp: new Date(),
    });

  } catch (error) {
    console.error(`[GitHub Scheduler Actions] Failed to execute ${configName}:`, error);
    
    return NextResponse.json(
      {
        success: false,
        error: `Failed to execute scheduled scan: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      },
      { status: 500 }
    );
  }
}

/**
 * Handle toggle action - enable/disable a scheduled scan
 */
async function handleToggleAction(scheduler: any, configId: string, configName: string, enabled?: boolean) {
  try {
    // If enabled is not provided, get current state and toggle it
    if (enabled === undefined) {
      const config = scheduler.getScheduledScan(configId);
      enabled = !config.enabled;
    }

    await scheduler.toggleScheduledScan(configId, enabled);
    
    console.log(`[GitHub Scheduler Actions] ${enabled ? 'Enabled' : 'Disabled'} scheduled scan: ${configName} (${configId})`);
    
    return NextResponse.json({
      success: true,
      data: { enabled },
      message: `Scheduled scan "${configName}" ${enabled ? 'enabled' : 'disabled'}`,
      timestamp: new Date(),
    });

  } catch (error) {
    console.error(`[GitHub Scheduler Actions] Failed to toggle ${configName}:`, error);
    
    return NextResponse.json(
      {
        success: false,
        error: `Failed to toggle scheduled scan: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      },
      { status: 500 }
    );
  }
}

/**
 * Handle test action - validate configuration without executing
 */
async function handleTestAction(scheduler: any, configId: string, config: any) {
  try {
    console.log(`[GitHub Scheduler Actions] Testing scheduled scan configuration: ${config.name} (${configId})`);
    
    const testResults = {
      configurationValid: true,
      githubConnectionValid: false,
      cronExpressionValid: false,
      scanTargetsValid: false,
      errors: [] as string[],
      warnings: [] as string[],
      info: [] as string[],
    };

    // Test cron expression
    try {
      const cron = require('node-cron');
      testResults.cronExpressionValid = cron.validate(config.schedule);
      if (!testResults.cronExpressionValid) {
        testResults.errors.push(`Invalid cron expression: ${config.schedule}`);
      } else {
        testResults.info.push(`Cron expression "${config.schedule}" is valid`);
      }
    } catch (error) {
      testResults.errors.push(`Failed to validate cron expression: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Test GitHub connection
    try {
      const { GitHubScanner } = await import('@/lib/discovery/GitHubScanner');
      const scanner = new GitHubScanner(config.githubConfig);
      
      // Try to get rate limit info to test connection
      const response = await fetch('https://api.github.com/rate_limit', {
        headers: {
          'Authorization': config.githubConfig.token ? `token ${config.githubConfig.token}` : '',
          'User-Agent': 'Backstage-IDP-Discovery',
        },
      });

      if (response.ok) {
        testResults.githubConnectionValid = true;
        const rateLimitData = await response.json();
        testResults.info.push(`GitHub connection successful. Rate limit: ${rateLimitData.rate.remaining}/${rateLimitData.rate.limit}`);
      } else {
        testResults.errors.push(`GitHub connection failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      testResults.errors.push(`GitHub connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Test scan targets
    const hasTargets = (config.scanOptions.organizations && config.scanOptions.organizations.length > 0) ||
                      (config.scanOptions.users && config.scanOptions.users.length > 0) ||
                      (config.scanOptions.repositories && config.scanOptions.repositories.length > 0);
    
    if (hasTargets) {
      testResults.scanTargetsValid = true;
      
      const targetCount = (config.scanOptions.organizations?.length || 0) +
                         (config.scanOptions.users?.length || 0) +
                         (config.scanOptions.repositories?.length || 0);
      
      testResults.info.push(`Scan targets configured: ${targetCount} total`);
      
      if (config.scanOptions.organizations?.length) {
        testResults.info.push(`Organizations: ${config.scanOptions.organizations.join(', ')}`);
      }
      if (config.scanOptions.users?.length) {
        testResults.info.push(`Users: ${config.scanOptions.users.join(', ')}`);
      }
      if (config.scanOptions.repositories?.length) {
        testResults.info.push(`Repositories: ${config.scanOptions.repositories.join(', ')}`);
      }
    } else {
      testResults.errors.push('No scan targets configured. At least one organization, user, or repository is required.');
    }

    // Add warnings for potentially problematic configurations
    if (config.scanOptions.includePrivate && !config.githubConfig.token) {
      testResults.warnings.push('Including private repositories requires authentication');
    }

    if (config.scanOptions.batchSize > 50) {
      testResults.warnings.push('Large batch sizes may increase rate limit pressure');
    }

    if (config.scanOptions.maxConcurrent > 5) {
      testResults.warnings.push('High concurrency may increase rate limit pressure');
    }

    if (!config.importOptions || !config.importOptions.generateMissing) {
      testResults.warnings.push('Auto-generation of catalog entries is disabled');
    }

    // Overall configuration validity
    testResults.configurationValid = testResults.errors.length === 0;

    console.log(`[GitHub Scheduler Actions] Test completed for ${config.name}:`, {
      valid: testResults.configurationValid,
      errors: testResults.errors.length,
      warnings: testResults.warnings.length,
    });

    return NextResponse.json({
      success: true,
      data: testResults,
      message: `Configuration test ${testResults.configurationValid ? 'passed' : 'failed'}`,
      timestamp: new Date(),
    });

  } catch (error) {
    console.error(`[GitHub Scheduler Actions] Failed to test ${config.name}:`, error);
    
    return NextResponse.json(
      {
        success: false,
        error: `Failed to test configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/catalog/discovery/github/scheduler/actions
 * 
 * Returns available actions and their documentation
 */
export async function GET() {
  return NextResponse.json({
    service: 'GitHub Scheduler Actions',
    version: '1.0.0',
    description: 'Execute actions on GitHub scheduled scan configurations',
    actions: {
      execute: {
        description: 'Execute a scheduled scan immediately',
        parameters: {
          configId: {
            type: 'string',
            required: true,
            description: 'ID of the scheduled scan configuration',
          },
        },
        example: {
          action: 'execute',
          configId: 'github-scan-1234567890-abc123def',
        },
      },
      toggle: {
        description: 'Enable or disable a scheduled scan',
        parameters: {
          configId: {
            type: 'string',
            required: true,
            description: 'ID of the scheduled scan configuration',
          },
          enabled: {
            type: 'boolean',
            required: false,
            description: 'Whether to enable or disable. If not provided, toggles current state.',
          },
        },
        example: {
          action: 'toggle',
          configId: 'github-scan-1234567890-abc123def',
          enabled: true,
        },
      },
      test: {
        description: 'Test a scheduled scan configuration without executing',
        parameters: {
          configId: {
            type: 'string',
            required: true,
            description: 'ID of the scheduled scan configuration',
          },
        },
        example: {
          action: 'test',
          configId: 'github-scan-1234567890-abc123def',
        },
      },
    },
    timestamp: new Date(),
  });
}

/**
 * OPTIONS /api/catalog/discovery/github/scheduler/actions
 * 
 * Handles CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}