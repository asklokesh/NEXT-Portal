import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getGitHubScheduler, type ScheduledScanConfig } from '@/lib/discovery/GitHubScheduler';

// Validation schemas
const CreateScheduledScanSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
  schedule: z.string().min(1, 'Schedule (cron expression) is required'),
  githubConfig: z.object({
    token: z.string().optional(),
    appId: z.number().optional(),
    privateKey: z.string().optional(),
    installationId: z.number().optional(),
    baseUrl: z.string().optional(),
  }),
  scanOptions: z.object({
    organizations: z.array(z.string()).optional(),
    users: z.array(z.string()).optional(),
    repositories: z.array(z.string()).optional(),
    includePrivate: z.boolean().default(false),
    includeArchived: z.boolean().default(false),
    includeForks: z.boolean().default(true),
    batchSize: z.number().min(1).max(100).default(50),
    rateLimitDelay: z.number().min(0).max(10000).default(1000),
    maxConcurrent: z.number().min(1).max(10).default(5),
    dryRun: z.boolean().default(false),
  }),
  importOptions: z.object({
    overwriteExisting: z.boolean().default(false),
    skipValidation: z.boolean().default(false),
    generateMissing: z.boolean().default(true),
    defaultOwner: z.string().default('unknown'),
    defaultLifecycle: z.string().default('experimental'),
    addTags: z.array(z.string()).default(['github-scheduled']),
  }).optional(),
  notifications: z.object({
    onSuccess: z.array(z.string()).optional(),
    onFailure: z.array(z.string()).optional(),
    onPartialSuccess: z.array(z.string()).optional(),
  }).optional(),
  retention: z.object({
    keepLogs: z.number().min(1).default(100),
    keepResults: z.number().min(1).default(50),
  }).optional(),
  metadata: z.record(z.any()).optional(),
});

const UpdateScheduledScanSchema = CreateScheduledScanSchema.partial().extend({
  id: z.string().optional(),
});

/**
 * GET /api/catalog/discovery/github/scheduler
 * 
 * Returns all scheduled scan configurations and scheduler statistics
 */
export async function GET(request: NextRequest) {
  try {
    const scheduler = getGitHubScheduler();
    const { searchParams } = new URL(request.url);
    const configId = searchParams.get('id');
    const includeHistory = searchParams.get('includeHistory') === 'true';
    const historyLimit = parseInt(searchParams.get('historyLimit') || '50');

    if (configId) {
      // Get specific configuration
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

      const response: any = {
        success: true,
        data: config,
        timestamp: new Date(),
      };

      if (includeHistory) {
        response.data.executionHistory = scheduler.getConfigExecutionHistory(configId, historyLimit);
      }

      return NextResponse.json(response);
    }

    // Get all configurations and stats
    const configs = scheduler.getScheduledScans();
    const stats = scheduler.getStats();
    const history = includeHistory ? scheduler.getExecutionHistory(historyLimit) : undefined;

    return NextResponse.json({
      success: true,
      data: {
        configurations: configs,
        statistics: stats,
        executionHistory: history,
      },
      timestamp: new Date(),
    });

  } catch (error) {
    console.error('[GitHub Scheduler API] Error getting configurations:', error);
    
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
 * POST /api/catalog/discovery/github/scheduler
 * 
 * Creates a new scheduled scan configuration
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedConfig = CreateScheduledScanSchema.parse(body);
    
    const scheduler = getGitHubScheduler();
    
    // Generate unique ID
    const id = `github-scan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const config: ScheduledScanConfig = {
      id,
      ...validatedConfig,
    };

    // Validate GitHub authentication
    if (!config.githubConfig.token && 
        !(config.githubConfig.appId && config.githubConfig.privateKey && config.githubConfig.installationId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'GitHub authentication is required. Provide either a token or GitHub App credentials.',
          timestamp: new Date(),
        },
        { status: 400 }
      );
    }

    // Validate scan targets
    const hasTargets = (config.scanOptions.organizations && config.scanOptions.organizations.length > 0) ||
                      (config.scanOptions.users && config.scanOptions.users.length > 0) ||
                      (config.scanOptions.repositories && config.scanOptions.repositories.length > 0);
    
    if (!hasTargets) {
      return NextResponse.json(
        {
          success: false,
          error: 'At least one scan target is required (organizations, users, or repositories).',
          timestamp: new Date(),
        },
        { status: 400 }
      );
    }

    // Add the scheduled scan
    await scheduler.addScheduledScan(config);

    console.log(`[GitHub Scheduler API] Created scheduled scan: ${config.name} (${id})`);

    return NextResponse.json({
      success: true,
      data: config,
      message: `Scheduled scan "${config.name}" created successfully`,
      timestamp: new Date(),
    });

  } catch (error) {
    console.error('[GitHub Scheduler API] Error creating scheduled scan:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid configuration format',
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
 * PUT /api/catalog/discovery/github/scheduler
 * 
 * Updates an existing scheduled scan configuration
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const updates = UpdateScheduledScanSchema.parse(body);
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') || updates.id;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Configuration ID is required',
          timestamp: new Date(),
        },
        { status: 400 }
      );
    }

    const scheduler = getGitHubScheduler();
    
    // Check if configuration exists
    const existing = scheduler.getScheduledScan(id);
    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: `Scheduled scan configuration not found: ${id}`,
          timestamp: new Date(),
        },
        { status: 404 }
      );
    }

    // Update the configuration
    await scheduler.updateScheduledScan(id, updates);
    
    const updatedConfig = scheduler.getScheduledScan(id);

    console.log(`[GitHub Scheduler API] Updated scheduled scan: ${updatedConfig?.name} (${id})`);

    return NextResponse.json({
      success: true,
      data: updatedConfig,
      message: `Scheduled scan "${updatedConfig?.name}" updated successfully`,
      timestamp: new Date(),
    });

  } catch (error) {
    console.error('[GitHub Scheduler API] Error updating scheduled scan:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid configuration format',
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
 * DELETE /api/catalog/discovery/github/scheduler
 * 
 * Removes a scheduled scan configuration
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Configuration ID is required',
          timestamp: new Date(),
        },
        { status: 400 }
      );
    }

    const scheduler = getGitHubScheduler();
    
    // Check if configuration exists
    const existing = scheduler.getScheduledScan(id);
    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: `Scheduled scan configuration not found: ${id}`,
          timestamp: new Date(),
        },
        { status: 404 }
      );
    }

    // Remove the configuration
    await scheduler.removeScheduledScan(id);

    console.log(`[GitHub Scheduler API] Removed scheduled scan: ${existing.name} (${id})`);

    return NextResponse.json({
      success: true,
      message: `Scheduled scan "${existing.name}" removed successfully`,
      timestamp: new Date(),
    });

  } catch (error) {
    console.error('[GitHub Scheduler API] Error removing scheduled scan:', error);

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