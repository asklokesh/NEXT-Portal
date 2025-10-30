import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';

const prisma = new PrismaClient();

// Environment configuration schema
const EnvironmentConfigSchema = z.object({
  pluginId: z.string().min(1),
  environment: z.enum(['development', 'staging', 'production']),
  configuration: z.record(z.any()).optional(),
  secrets: z.record(z.string()).optional(),
  variables: z.record(z.string()).optional(),
  resources: z.object({
    cpu: z.string().optional(),
    memory: z.string().optional(),
    replicas: z.number().min(1).optional()
  }).optional(),
  scaling: z.object({
    enabled: z.boolean().default(false),
    minReplicas: z.number().min(1).default(1),
    maxReplicas: z.number().min(1).default(10),
    targetCPU: z.number().min(1).max(100).default(80)
  }).optional(),
  health: z.object({
    enabled: z.boolean().default(true),
    path: z.string().default('/health'),
    interval: z.number().min(10).default(30),
    timeout: z.number().min(1).default(10),
    retries: z.number().min(1).default(3)
  }).optional()
});

const PromotionRequestSchema = z.object({
  pluginId: z.string().min(1),
  fromEnvironment: z.enum(['development', 'staging']),
  toEnvironment: z.enum(['staging', 'production']),
  version: z.string().min(1),
  notes: z.string().optional(),
  skipApproval: z.boolean().default(false),
  rollbackPlan: z.object({
    enabled: z.boolean().default(true),
    autoRollbackOnFailure: z.boolean().default(false),
    healthCheckGracePeriod: z.number().min(60).default(300) // 5 minutes
  }).optional()
});

const EnvironmentFiltersSchema = z.object({
  pluginId: z.string().optional(),
  environment: z.enum(['development', 'staging', 'production']).optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20)
});

// GET /api/marketplace/environments - Get environment configurations
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ 
        success: false, 
        error: 'Authentication required' 
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const rawFilters = Object.fromEntries(searchParams.entries());
    const filters = EnvironmentFiltersSchema.parse(rawFilters);

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true }
    });

    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 });
    }

    // Build where clause based on filters and permissions
    let where: any = {};
    
    if (filters.pluginId) {
      where.pluginId = filters.pluginId;
    }
    
    if (filters.environment) {
      where.environment = filters.environment;
    }
    
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    // If not admin, only show environments for user's plugins
    if (user.role !== 'ADMIN') {
      const userPlugins = await prisma.plugin.findMany({
        where: { author: user.id },
        select: { id: true }
      });
      const userPluginIds = userPlugins.map(p => p.id);
      where.pluginId = { in: userPluginIds };
    }

    const [environments, totalCount] = await Promise.all([
      prisma.pluginEnvironment.findMany({
        where,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        include: {
          plugin: {
            select: {
              id: true,
              name: true,
              displayName: true,
              author: true
            }
          }
        },
        orderBy: [{ environment: 'asc' }, { createdAt: 'desc' }]
      }),
      prisma.pluginEnvironment.count({ where })
    ]);

    // Get deployment status for each environment
    const environmentsWithStatus = await Promise.all(
      environments.map(async (env) => {
        // Get latest deployment for this environment
        const latestDeployment = await prisma.pluginDeployment.findFirst({
          where: {
            pluginVersion: {
              pluginId: env.pluginId
            },
            environment: env.environment
          },
          orderBy: { startedAt: 'desc' },
          include: {
            pluginVersion: {
              select: {
                version: true,
                status: true
              }
            }
          }
        });

        // Get environment health metrics
        const healthMetrics = await prisma.pluginMetrics.findMany({
          where: {
            pluginId: env.pluginId,
            environment: env.environment,
            metricName: { in: ['cpu_usage', 'memory_usage', 'error_rate', 'response_time'] },
            timestamp: {
              gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
            }
          },
          orderBy: { timestamp: 'desc' },
          take: 20
        });

        return {
          id: env.id,
          pluginId: env.pluginId,
          environment: env.environment,
          isActive: env.isActive,
          configuration: env.configuration,
          resources: env.resources,
          scaling: env.scaling,
          health: env.health,
          createdBy: env.createdBy,
          createdAt: env.createdAt.toISOString(),
          updatedAt: env.updatedAt.toISOString(),
          plugin: env.plugin,
          deployment: latestDeployment ? {
            id: latestDeployment.id,
            version: latestDeployment.pluginVersion.version,
            status: latestDeployment.status,
            progress: latestDeployment.progress,
            startedAt: latestDeployment.startedAt.toISOString(),
            completedAt: latestDeployment.completedAt?.toISOString()
          } : null,
          metrics: {
            cpu: healthMetrics.filter(m => m.metricName === 'cpu_usage').slice(0, 5),
            memory: healthMetrics.filter(m => m.metricName === 'memory_usage').slice(0, 5),
            errorRate: healthMetrics.filter(m => m.metricName === 'error_rate').slice(0, 5),
            responseTime: healthMetrics.filter(m => m.metricName === 'response_time').slice(0, 5)
          }
        };
      })
    );

    // Get environment summary statistics
    const environmentStats = await prisma.pluginEnvironment.groupBy({
      by: ['environment'],
      where: user.role === 'ADMIN' ? {} : {
        plugin: { author: user.id }
      },
      _count: { environment: true }
    });

    const summary = {
      total: totalCount,
      byEnvironment: environmentStats.reduce((acc, stat) => {
        acc[stat.environment] = stat._count.environment;
        return acc;
      }, {} as Record<string, number>),
      active: environments.filter(env => env.isActive).length
    };

    return NextResponse.json({
      success: true,
      data: {
        environments: environmentsWithStatus,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / filters.limit),
          hasNext: filters.page * filters.limit < totalCount,
          hasPrev: filters.page > 1
        },
        summary
      }
    });

  } catch (error) {
    console.error('Environments API Error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request parameters',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch environment configurations',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// POST /api/marketplace/environments - Create or update environment configuration
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ 
        success: false, 
        error: 'Authentication required' 
      }, { status: 401 });
    }

    const body = await request.json();
    const action = body.action || 'configure';

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true }
    });

    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 });
    }

    if (action === 'configure') {
      const envConfig = EnvironmentConfigSchema.parse(body);

      // Verify user owns the plugin or has admin rights
      const plugin = await prisma.plugin.findFirst({
        where: {
          id: envConfig.pluginId,
          ...(user.role !== 'ADMIN' ? { author: user.id } : {})
        }
      });

      if (!plugin) {
        return NextResponse.json({
          success: false,
          error: 'Plugin not found or access denied'
        }, { status: 404 });
      }

      // Create or update environment configuration
      const environment = await prisma.pluginEnvironment.upsert({
        where: {
          pluginId_environment: {
            pluginId: envConfig.pluginId,
            environment: envConfig.environment
          }
        },
        create: {
          pluginId: envConfig.pluginId,
          environment: envConfig.environment,
          isActive: true,
          configuration: envConfig.configuration || {},
          secrets: envConfig.secrets ? JSON.stringify(envConfig.secrets) : null,
          variables: envConfig.variables || {},
          resources: envConfig.resources || {},
          scaling: envConfig.scaling || {},
          health: envConfig.health || {},
          deployment: 'ROLLING', // Default deployment strategy
          createdBy: user.id
        },
        update: {
          configuration: envConfig.configuration || {},
          secrets: envConfig.secrets ? JSON.stringify(envConfig.secrets) : undefined,
          variables: envConfig.variables || {},
          resources: envConfig.resources || {},
          scaling: envConfig.scaling || {},
          health: envConfig.health || {},
          updatedAt: new Date()
        },
        include: {
          plugin: {
            select: {
              name: true,
              displayName: true
            }
          }
        }
      });

      return NextResponse.json({
        success: true,
        data: {
          environmentId: environment.id,
          pluginId: environment.pluginId,
          environment: environment.environment,
          isActive: environment.isActive,
          message: 'Environment configuration updated successfully'
        }
      });

    } else if (action === 'promote') {
      const promotionRequest = PromotionRequestSchema.parse(body);

      // Verify user owns the plugin or has admin rights
      const plugin = await prisma.plugin.findFirst({
        where: {
          id: promotionRequest.pluginId,
          ...(user.role !== 'ADMIN' ? { author: user.id } : {})
        },
        include: {
          versions: {
            where: { version: promotionRequest.version },
            take: 1
          }
        }
      });

      if (!plugin || plugin.versions.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Plugin or version not found, or access denied'
        }, { status: 404 });
      }

      const pluginVersion = plugin.versions[0];

      // Check if source environment deployment exists and is successful
      const sourceDeployment = await prisma.pluginDeployment.findFirst({
        where: {
          pluginVersionId: pluginVersion.id,
          environment: promotionRequest.fromEnvironment,
          status: 'DEPLOYED'
        },
        orderBy: { startedAt: 'desc' }
      });

      if (!sourceDeployment) {
        return NextResponse.json({
          success: false,
          error: `No successful deployment found in ${promotionRequest.fromEnvironment} environment`
        }, { status: 400 });
      }

      // Check if approval is required for production promotions
      const requiresApproval = promotionRequest.toEnvironment === 'production' && !promotionRequest.skipApproval;
      
      if (requiresApproval && user.role !== 'ADMIN') {
        // Create approval request
        const governance = await prisma.pluginGovernance.findFirst({
          where: {
            pluginId: promotionRequest.pluginId,
            isActive: true
          }
        });

        if (governance) {
          const approval = await prisma.pluginApproval.create({
            data: {
              governanceId: governance.id,
              pluginId: promotionRequest.pluginId,
              pluginVersionId: pluginVersion.id,
              requestType: 'CONFIGURATION_CHANGE',
              requestedBy: user.id,
              priority: 'MEDIUM',
              reason: `Promote plugin from ${promotionRequest.fromEnvironment} to ${promotionRequest.toEnvironment}`,
              comments: promotionRequest.notes ? JSON.stringify([{
                text: promotionRequest.notes,
                author: user.id,
                timestamp: new Date()
              }]) : null,
              requirements: JSON.stringify({
                fromEnvironment: promotionRequest.fromEnvironment,
                toEnvironment: promotionRequest.toEnvironment,
                version: promotionRequest.version,
                rollbackPlan: promotionRequest.rollbackPlan
              })
            }
          });

          return NextResponse.json({
            success: true,
            data: {
              approvalId: approval.id,
              status: 'pending_approval',
              message: 'Promotion request submitted for approval'
            }
          });
        }
      }

      // Create promotion deployment
      const deployment = await prisma.pluginDeployment.create({
        data: {
          pluginVersionId: pluginVersion.id,
          environment: promotionRequest.toEnvironment,
          status: 'PENDING',
          strategy: 'ROLLING',
          progress: 0,
          deployedBy: user.id,
          rollbackPlan: promotionRequest.rollbackPlan ? JSON.stringify(promotionRequest.rollbackPlan) : null
        }
      });

      // Start the deployment process (this would integrate with your deployment system)
      // For now, we'll simulate it
      setTimeout(async () => {
        try {
          await simulateDeployment(deployment.id);
        } catch (error) {
          console.error('Deployment simulation error:', error);
        }
      }, 1000);

      return NextResponse.json({
        success: true,
        data: {
          deploymentId: deployment.id,
          status: 'deploying',
          environment: promotionRequest.toEnvironment,
          version: promotionRequest.version,
          message: 'Plugin promotion started'
        }
      });

    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid action. Use \"configure\" or \"promote\"'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Environment action error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to process environment action',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE /api/marketplace/environments - Delete environment configuration
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ 
        success: false, 
        error: 'Authentication required' 
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const environmentId = searchParams.get('environmentId');
    const pluginId = searchParams.get('pluginId');
    const environment = searchParams.get('environment');

    if (!environmentId && !(pluginId && environment)) {
      return NextResponse.json({
        success: false,
        error: 'Either environmentId or (pluginId + environment) is required'
      }, { status: 400 });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true }
    });

    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 });
    }

    // Find environment configuration
    const where: any = environmentId ? { id: environmentId } : {
      pluginId,
      environment
    };

    const envConfig = await prisma.pluginEnvironment.findFirst({
      where,
      include: {
        plugin: {
          select: { author: true }
        }
      }
    });

    if (!envConfig) {
      return NextResponse.json({
        success: false,
        error: 'Environment configuration not found'
      }, { status: 404 });
    }

    // Check permissions
    if (user.role !== 'ADMIN' && envConfig.plugin.author !== user.id) {
      return NextResponse.json({
        success: false,
        error: 'Access denied'
      }, { status: 403 });
    }

    // Don't allow deletion of production environments without special permission
    if (envConfig.environment === 'production' && user.role !== 'ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'Production environment configurations cannot be deleted without admin privileges'
      }, { status: 403 });
    }

    // Delete the environment configuration
    await prisma.pluginEnvironment.delete({
      where: { id: envConfig.id }
    });

    return NextResponse.json({
      success: true,
      message: 'Environment configuration deleted successfully'
    });

  } catch (error) {
    console.error('Environment deletion error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to delete environment configuration',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// Helper function to simulate deployment process
async function simulateDeployment(deploymentId: string) {
  const stages = ['PENDING', 'DEPLOYING', 'DEPLOYED'];
  
  for (let i = 0; i < stages.length; i++) {
    const status = stages[i] as any;
    const progress = ((i + 1) / stages.length) * 100;
    
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay between stages
    
    await prisma.pluginDeployment.update({
      where: { id: deploymentId },
      data: {
        status,
        progress,
        ...(status === 'DEPLOYED' ? { completedAt: new Date() } : {})
      }
    });
  }
}