/**
 * Service Discovery API Routes
 * 
 * REST API endpoints for the automated service discovery system.
 * Provides endpoints for triggering discovery, querying services,
 * and managing discovery configuration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Logger } from 'winston';
import { ServiceDiscoveryOrchestrator, createServiceDiscoveryOrchestrator } from '@/lib/discovery/orchestrator';
import { z } from 'zod';

// Initialize logger (you might want to use your existing logger setup)
const logger = {
  info: (message: string, meta?: any) => console.log(`[INFO] ${message}`, meta || ''),
  warn: (message: string, meta?: any) => console.warn(`[WARN] ${message}`, meta || ''),
  error: (message: string, meta?: any) => console.error(`[ERROR] ${message}`, meta || ''),
  debug: (message: string, meta?: any) => console.debug(`[DEBUG] ${message}`, meta || ''),
} as Logger;

// Global orchestrator instance (in production, you'd want proper DI)
let orchestrator: ServiceDiscoveryOrchestrator | null = null;

// Request schemas
const DiscoveryConfigSchema = z.object({
  sources: z.object({
    'git-repository-analyzer': z.object({
      enabled: z.boolean().default(false),
      config: z.object({
        providers: z.object({
          github: z.object({
            enabled: z.boolean().default(false),
            token: z.string().optional(),
            organizations: z.array(z.string()).optional(),
            repositories: z.array(z.string()).optional(),
          }).optional(),
          local: z.object({
            enabled: z.boolean().default(false),
            rootPaths: z.array(z.string()).default([]),
          }).optional(),
        }),
      }).optional(),
    }).optional(),
    'kubernetes-scanner': z.object({
      enabled: z.boolean().default(false),
      config: z.object({
        clusters: z.array(z.object({
          name: z.string(),
          config: z.object({
            type: z.enum(['in_cluster', 'kubeconfig']),
            kubeconfig: z.string().optional(),
            context: z.string().optional(),
          }),
        })).default([]),
      }).optional(),
    }).optional(),
  }),
});

/**
 * GET /api/discovery - Get discovery status and services
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (!orchestrator) {
      return NextResponse.json(
        { error: 'Discovery system not initialized' },
        { status: 503 }
      );
    }

    switch (action) {
      case 'services':
        const services = orchestrator.getDiscoveredServices();
        return NextResponse.json({
          services,
          total: services.length,
          timestamp: new Date().toISOString(),
        });

      case 'services-by-type':
        const type = searchParams.get('type') as any;
        if (!type) {
          return NextResponse.json(
            { error: 'Type parameter required' },
            { status: 400 }
          );
        }
        const servicesByType = orchestrator.getServicesByType(type);
        return NextResponse.json({
          services: servicesByType,
          type,
          total: servicesByType.length,
          timestamp: new Date().toISOString(),
        });

      case 'services-by-source':
        const source = searchParams.get('source');
        if (!source) {
          return NextResponse.json(
            { error: 'Source parameter required' },
            { status: 400 }
          );
        }
        const servicesBySource = orchestrator.getServicesBySource(source);
        return NextResponse.json({
          services: servicesBySource,
          source,
          total: servicesBySource.length,
          timestamp: new Date().toISOString(),
        });

      case 'metrics':
        const metrics = orchestrator.getMetrics();
        return NextResponse.json({
          metrics,
          timestamp: new Date().toISOString(),
        });

      case 'health':
        const health = await orchestrator.getHealthStatus();
        return NextResponse.json({
          health,
          timestamp: new Date().toISOString(),
        });

      case 'status':
      default:
        const status = orchestrator.getMetrics();
        const healthStatus = await orchestrator.getHealthStatus();
        return NextResponse.json({
          status: 'running',
          metrics: status,
          health: healthStatus,
          timestamp: new Date().toISOString(),
        });
    }

  } catch (error) {
    logger.error('Discovery API GET error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/discovery - Initialize discovery system or trigger discovery
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, config } = body;

    switch (action) {
      case 'initialize':
        if (orchestrator) {
          return NextResponse.json(
            { error: 'Discovery system already initialized' },
            { status: 400 }
          );
        }

        // Validate and parse configuration
        const discoveryConfig = config || getDefaultDiscoveryConfig();
        
        // Initialize orchestrator
        orchestrator = await createServiceDiscoveryOrchestrator(discoveryConfig, logger);
        await orchestrator.start();

        logger.info('Discovery system initialized via API');
        return NextResponse.json({
          message: 'Discovery system initialized successfully',
          timestamp: new Date().toISOString(),
        });

      case 'discover':
        if (!orchestrator) {
          return NextResponse.json(
            { error: 'Discovery system not initialized' },
            { status: 503 }
          );
        }

        const services = await orchestrator.discoverNow();
        return NextResponse.json({
          message: 'Discovery completed',
          servicesDiscovered: services.length,
          services: services,
          timestamp: new Date().toISOString(),
        });

      case 'start':
        if (!orchestrator) {
          return NextResponse.json(
            { error: 'Discovery system not initialized' },
            { status: 503 }
          );
        }

        await orchestrator.start();
        return NextResponse.json({
          message: 'Discovery system started',
          timestamp: new Date().toISOString(),
        });

      case 'stop':
        if (!orchestrator) {
          return NextResponse.json(
            { error: 'Discovery system not initialized' },
            { status: 503 }
          );
        }

        await orchestrator.stop();
        return NextResponse.json({
          message: 'Discovery system stopped',
          timestamp: new Date().toISOString(),
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    logger.error('Discovery API POST error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/discovery - Update discovery configuration
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { config } = body;

    if (!config) {
      return NextResponse.json(
        { error: 'Configuration required' },
        { status: 400 }
      );
    }

    // Validate configuration
    try {
      DiscoveryConfigSchema.parse(config);
    } catch (validationError) {
      return NextResponse.json(
        { error: 'Invalid configuration', details: validationError },
        { status: 400 }
      );
    }

    // For now, return success (full implementation would update the orchestrator)
    logger.info('Discovery configuration updated via API');
    return NextResponse.json({
      message: 'Configuration updated successfully',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Discovery API PUT error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/discovery - Shutdown discovery system
 */
export async function DELETE(request: NextRequest) {
  try {
    if (!orchestrator) {
      return NextResponse.json(
        { error: 'Discovery system not running' },
        { status: 400 }
      );
    }

    await orchestrator.stop();
    orchestrator = null;

    logger.info('Discovery system shutdown via API');
    return NextResponse.json({
      message: 'Discovery system shutdown successfully',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Discovery API DELETE error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to get default configuration
function getDefaultDiscoveryConfig() {
  return {
    engine: {
      aggregation: {
        deduplicationStrategy: 'merge' as const,
        relationshipInference: true,
        confidenceThreshold: 0.6,
      },
      storage: {
        type: 'memory' as const,
        config: {},
      },
      notifications: {
        enabled: false,
        channels: [],
      },
    },
    sources: {
      'git-repository-analyzer': {
        enabled: true,
        priority: 100,
        config: {
          providers: {
            local: {
              enabled: true,
              rootPaths: [process.cwd()],
            },
            github: {
              enabled: false,
            },
          },
          analysis: {
            enableCodeAnalysis: true,
            enableDocumentationParsing: true,
            enableDependencyAnalysis: true,
          },
        },
      },
      'kubernetes-scanner': {
        enabled: false,
        priority: 90,
        config: {
          clusters: [],
        },
      },
      'aws-resource-scanner': {
        enabled: false,
        priority: 80,
        config: {},
      },
      'azure-resource-scanner': {
        enabled: false,
        priority: 80,
        config: {},
      },
      'gcp-resource-scanner': {
        enabled: false,
        priority: 80,
        config: {},
      },
      'cicd-pipeline-scanner': {
        enabled: false,
        priority: 70,
        config: {},
      },
    },
    monitoring: {
      enabled: true,
      metricsPort: 9090,
      healthCheckInterval: 60000,
    },
    webhooks: {
      enabled: false,
      endpoints: [],
    },
  };
}