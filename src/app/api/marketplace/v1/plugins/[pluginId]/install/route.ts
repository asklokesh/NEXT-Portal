import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { createAuditLog } from '@/lib/audit/service';
import { PluginManager } from '@/infrastructure/plugin-pipeline/core/plugin-manager';
import { KubernetesOrchestrator } from '@/infrastructure/plugin-pipeline/core/kubernetes-orchestrator';

const API_VERSION = 'v1';

// Installation request schema
const InstallRequestSchema = z.object({
  version: z.string().optional(),
  configuration: z.record(z.any()).optional(),
  environment: z.enum(['development', 'staging', 'production']).default('development'),
  namespace: z.string().optional(),
  deploymentStrategy: z.enum(['rolling', 'blue-green', 'canary']).default('rolling'),
  autoStart: z.boolean().default(true),
});

// Installation response schema
const InstallResponseSchema = z.object({
  installationId: z.string(),
  pluginId: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed']),
  message: z.string(),
  details: z.object({
    version: z.string(),
    environment: z.string(),
    namespace: z.string(),
    deploymentStrategy: z.string(),
  }),
  progress: z.object({
    current: z.number(),
    total: z.number(),
    percentage: z.number(),
    currentStep: z.string(),
  }),
  estimatedTime: z.number().optional(),
  links: z.object({
    status: z.string(),
    logs: z.string(),
    cancel: z.string(),
  }),
});

/**
 * POST /api/marketplace/v1/plugins/:pluginId/install
 * Install a plugin from the marketplace
 */
export const POST = withAuth(async (request: AuthenticatedRequest, { params }: { params: { pluginId: string } }) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  const user = request.user;

  if (!user) {
    return NextResponse.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required to install plugins',
        },
        timestamp: new Date().toISOString(),
        requestId,
      },
      {
        status: 401,
        headers: {
          'X-Request-Id': requestId,
          'X-API-Version': API_VERSION,
        },
      }
    );
  }

  try {
    const { pluginId } = params;
    const body = await request.json();
    const installRequest = InstallRequestSchema.parse(body);

    // Check if plugin exists
    const plugin = await prisma.plugin.findUnique({
      where: { id: pluginId },
    });

    if (!plugin) {
      return NextResponse.json(
        {
          error: {
            code: 'PLUGIN_NOT_FOUND',
            message: `Plugin with ID '${pluginId}' not found`,
          },
          timestamp: new Date().toISOString(),
          requestId,
        },
        {
          status: 404,
          headers: {
            'X-Request-Id': requestId,
            'X-API-Version': API_VERSION,
          },
        }
      );
    }

    // Check if plugin is already installed
    const existingInstallation = await prisma.pluginInstallation.findFirst({
      where: {
        pluginId,
        userId: user.id,
        status: { in: ['active', 'installing'] },
      },
    });

    if (existingInstallation) {
      return NextResponse.json(
        {
          error: {
            code: 'PLUGIN_ALREADY_INSTALLED',
            message: `Plugin '${plugin.name}' is already installed or being installed`,
            details: {
              installationId: existingInstallation.id,
              status: existingInstallation.status,
            },
          },
          timestamp: new Date().toISOString(),
          requestId,
        },
        {
          status: 409,
          headers: {
            'X-Request-Id': requestId,
            'X-API-Version': API_VERSION,
          },
        }
      );
    }

    // Create installation record
    const installation = await prisma.pluginInstallation.create({
      data: {
        pluginId,
        userId: user.id,
        version: installRequest.version || plugin.version,
        environment: installRequest.environment,
        configuration: installRequest.configuration || {},
        status: 'installing',
        progress: 0,
        startedAt: new Date(),
      },
    });

    // Initialize plugin manager and orchestrator
    const pluginManager = new PluginManager();
    const k8sOrchestrator = new KubernetesOrchestrator();

    // Start asynchronous installation
    const installationPromise = (async () => {
      try {
        // Step 1: Validate dependencies
        await updateInstallationProgress(installation.id, 10, 'Validating dependencies');
        await pluginManager.validateDependencies({
          id: plugin.id,
          name: plugin.name,
          version: installRequest.version || plugin.version,
          dependencies: plugin.dependencies || {},
        });

        // Step 2: Download plugin
        await updateInstallationProgress(installation.id, 30, 'Downloading plugin');
        const pluginPackage = await pluginManager.downloadPlugin(plugin);

        // Step 3: Build Docker image
        await updateInstallationProgress(installation.id, 50, 'Building Docker image');
        const imageName = await pluginManager.buildDockerImage(pluginPackage);

        // Step 4: Deploy to Kubernetes
        await updateInstallationProgress(installation.id, 70, 'Deploying to Kubernetes');
        const namespace = installRequest.namespace || `plugin-${plugin.name}`;
        await k8sOrchestrator.deployPlugin({
          plugin: {
            id: plugin.id,
            name: plugin.name,
            version: installRequest.version || plugin.version,
            image: imageName,
            config: installRequest.configuration || {},
          },
          strategy: installRequest.deploymentStrategy,
          namespace,
        });

        // Step 5: Verify installation
        await updateInstallationProgress(installation.id, 90, 'Verifying installation');
        const isHealthy = await k8sOrchestrator.checkPluginHealth(namespace, plugin.name);

        if (!isHealthy) {
          throw new Error('Plugin health check failed');
        }

        // Step 6: Complete installation
        await updateInstallationProgress(installation.id, 100, 'Installation completed');
        await prisma.pluginInstallation.update({
          where: { id: installation.id },
          data: {
            status: 'active',
            progress: 100,
            completedAt: new Date(),
          },
        });

        // Update plugin download count
        await prisma.plugin.update({
          where: { id: pluginId },
          data: {
            downloads: { increment: 1 },
            monthlyDownloads: { increment: 1 },
            weeklyDownloads: { increment: 1 },
            dailyDownloads: { increment: 1 },
          },
        });

        // Log successful installation
        await createAuditLog({
          action: 'marketplace.plugin.install',
          resource: 'plugin',
          resourceId: pluginId,
          userId: user.id,
          details: {
            pluginName: plugin.name,
            version: installRequest.version || plugin.version,
            environment: installRequest.environment,
            installationTime: Date.now() - startTime,
          },
          status: 'success',
        });
      } catch (error) {
        // Update installation status to failed
        await prisma.pluginInstallation.update({
          where: { id: installation.id },
          data: {
            status: 'failed',
            error: error instanceof Error ? error.message : 'Installation failed',
            completedAt: new Date(),
          },
        });

        // Log failed installation
        await createAuditLog({
          action: 'marketplace.plugin.install',
          resource: 'plugin',
          resourceId: pluginId,
          userId: user.id,
          details: {
            pluginName: plugin.name,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          status: 'error',
        });

        throw error;
      }
    })();

    // Don't wait for installation to complete
    installationPromise.catch(console.error);

    // Return immediate response
    const response: InstallResponseSchema = {
      installationId: installation.id,
      pluginId: plugin.id,
      status: 'in_progress',
      message: `Installation of plugin '${plugin.name}' has been initiated`,
      details: {
        version: installRequest.version || plugin.version,
        environment: installRequest.environment,
        namespace: installRequest.namespace || `plugin-${plugin.name}`,
        deploymentStrategy: installRequest.deploymentStrategy,
      },
      progress: {
        current: 0,
        total: 100,
        percentage: 0,
        currentStep: 'Initializing installation',
      },
      estimatedTime: 180, // 3 minutes estimated
      links: {
        status: `/api/marketplace/v1/installations/${installation.id}`,
        logs: `/api/marketplace/v1/installations/${installation.id}/logs`,
        cancel: `/api/marketplace/v1/installations/${installation.id}/cancel`,
      },
    };

    return NextResponse.json(
      {
        data: response,
        metadata: {
          version: API_VERSION,
          timestamp: new Date().toISOString(),
          requestId,
          responseTime: Date.now() - startTime,
        },
      },
      {
        status: 202, // Accepted
        headers: {
          'X-Request-Id': requestId,
          'X-API-Version': API_VERSION,
          'Location': `/api/marketplace/v1/installations/${installation.id}`,
        },
      }
    );
  } catch (error) {
    console.error('Plugin installation error:', error);

    const errorResponse = {
      error: {
        code: 'INSTALLATION_ERROR',
        message: error instanceof Error ? error.message : 'Failed to install plugin',
        details: process.env.NODE_ENV === 'development' ? error : undefined,
      },
      timestamp: new Date().toISOString(),
      requestId,
    };

    return NextResponse.json(errorResponse, {
      status: 500,
      headers: {
        'X-Request-Id': requestId,
        'X-API-Version': API_VERSION,
      },
    });
  }
});

// Helper function to update installation progress
async function updateInstallationProgress(
  installationId: string,
  progress: number,
  currentStep: string
) {
  await prisma.pluginInstallation.update({
    where: { id: installationId },
    data: {
      progress,
      currentStep,
      updatedAt: new Date(),
    },
  });
}