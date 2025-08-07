import { Verifier } from '@pact-foundation/pact';
import { describe, beforeAll, afterAll, beforeEach, it } from '@jest/globals';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';

// Provider verification tests
describe('Plugin Management API Provider Contract', () => {
  let serverProcess: ChildProcess;
  const serverPort = 3001;
  const serverUrl = `http://localhost:${serverPort}`;

  beforeAll(async () => {
    // Start the API server for provider verification
    await startApiServer();
  }, 60000);

  afterAll(async () => {
    // Stop the API server
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  describe('Provider Verification', () => {
    it('should satisfy the pact with plugin-management-frontend', async () => {
      const opts = {
        provider: 'plugin-api-service',
        providerBaseUrl: serverUrl,
        pactUrls: [
          path.resolve(
            process.cwd(),
            'tests/contracts/pacts/plugin-management-frontend-plugin-api-service.json'
          ),
        ],
        pactBrokerUrl: process.env.PACT_BROKER_BASE_URL,
        pactBrokerToken: process.env.PACT_BROKER_TOKEN,
        publishVerificationResult: process.env.CI === 'true',
        providerVersion: process.env.GIT_COMMIT || '1.0.0',
        providerVersionTags: process.env.PACT_PROVIDER_TAG ? [process.env.PACT_PROVIDER_TAG] : ['dev'],
        logLevel: 'INFO',
        stateHandlers: {
          // State handlers for setting up test data
          'plugins exist': async () => {
            await setupTestPlugins();
          },
          'plugins with search term exist': async () => {
            await setupSearchablePlugins();
          },
          'plugins in Documentation category exist': async () => {
            await setupCategoryPlugins('Documentation');
          },
          'plugin api-docs-plugin exists': async () => {
            await setupSpecificPlugin('api-docs-plugin');
          },
          'plugin does not exist': async () => {
            await cleanupNonExistentPlugin();
          },
          'plugin api-docs-plugin is available for installation': async () => {
            await setupAvailablePlugin('api-docs-plugin');
          },
          'plugin already-installed-plugin is already installed': async () => {
            await setupInstalledPlugin('already-installed-plugin');
          },
          'plugin config-validation-plugin requires valid configuration': async () => {
            await setupPluginWithValidation('config-validation-plugin');
          },
          'plugin installed-plugin is installed': async () => {
            await setupInstalledPlugin('installed-plugin');
          },
          'plugin base-plugin-with-dependents has dependent plugins': async () => {
            await setupPluginWithDependents('base-plugin-with-dependents');
          },
          'plugin configured-plugin is installed with configuration': async () => {
            await setupConfiguredPlugin('configured-plugin');
          },
          'plugin configurable-plugin is installed': async () => {
            await setupConfigurablePlugin('configurable-plugin');
          },
          'plugin running-plugin is running': async () => {
            await setupRunningPlugin('running-plugin');
          },
          'plugin unhealthy-plugin is unhealthy': async () => {
            await setupUnhealthyPlugin('unhealthy-plugin');
          },
          'categories exist': async () => {
            await setupPluginCategories();
          },
          'user is not authenticated': async () => {
            // No setup needed - just ensure no auth tokens are valid
            await invalidateAllTokens();
          },
          'user does not have admin permissions': async () => {
            await setupUserWithoutAdminPermissions();
          },
          'server error occurs': async () => {
            await setupServerErrorCondition();
          },
        },
        beforeEach: async () => {
          // Reset database state before each interaction
          await resetTestDatabase();
        },
      };

      await new Verifier(opts).verifyProvider();
    });
  });

  // Helper functions for state management
  async function startApiServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Start the Next.js API server in test mode
      serverProcess = spawn('npm', ['run', 'start'], {
        env: {
          ...process.env,
          NODE_ENV: 'test',
          PORT: serverPort.toString(),
          DATABASE_URL: process.env.TEST_DATABASE_URL,
        },
      });

      serverProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        console.log(`Server stdout: ${output}`);
        
        // Look for server ready indicators
        if (output.includes('Ready on') || output.includes('server started on')) {
          resolve();
        }
      });

      serverProcess.stderr?.on('data', (data) => {
        console.error(`Server stderr: ${data}`);
      });

      serverProcess.on('error', (error) => {
        reject(error);
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        reject(new Error('Server failed to start within 30 seconds'));
      }, 30000);
    });
  }

  async function resetTestDatabase(): Promise<void> {
    // Reset database to clean state before each test
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL,
        },
      },
    });

    try {
      // Clean up existing data
      await prisma.pluginInstallation.deleteMany();
      await prisma.pluginDependency.deleteMany();
      await prisma.plugin.deleteMany();
      await prisma.user.deleteMany();

      // Reset any other state as needed
      await prisma.$disconnect();
    } catch (error) {
      console.error('Error resetting test database:', error);
      throw error;
    }
  }

  async function setupTestPlugins(): Promise<void> {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL,
        },
      },
    });

    try {
      await prisma.plugin.createMany({
        data: [
          {
            id: 'api-docs-plugin',
            name: 'API Documentation',
            version: '1.2.0',
            description: 'Generate and view API documentation',
            author: 'Backstage Team',
            category: 'Documentation',
            tags: ['api', 'docs', 'swagger'],
            icon: 'file-text',
            downloadCount: 1500,
            rating: 4.5,
            reviews: 25,
            compatibility: ['1.20.0', '1.21.0'],
            lastUpdated: new Date('2024-01-15T10:00:00Z'),
            size: '2.1 MB',
            license: 'Apache-2.0',
            homepage: 'https://example.com/plugin',
            repository: 'https://github.com/example/plugin',
            config: {
              required: false,
              schema: {
                type: 'object',
                properties: {
                  apiUrl: {
                    type: 'string',
                    format: 'uri',
                  },
                  timeout: {
                    type: 'number',
                    minimum: 1000,
                  },
                },
              },
            },
          },
          {
            id: 'monitoring-plugin',
            name: 'System Monitor',
            version: '2.0.1',
            description: 'Monitor service health and performance',
            author: 'Monitoring Team',
            category: 'Monitoring',
            tags: ['monitoring', 'health', 'performance'],
            icon: 'activity',
            downloadCount: 3200,
            rating: 4.8,
            reviews: 50,
            compatibility: ['1.21.0', '1.22.0'],
            lastUpdated: new Date('2024-01-10T15:30:00Z'),
            size: '5.7 MB',
            license: 'MIT',
            homepage: 'https://example.com/monitoring',
            repository: 'https://github.com/example/monitoring',
          },
        ],
        skipDuplicates: true,
      });

      await prisma.$disconnect();
    } catch (error) {
      console.error('Error setting up test plugins:', error);
      throw error;
    }
  }

  async function setupSearchablePlugins(): Promise<void> {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL,
        },
      },
    });

    try {
      await prisma.plugin.create({
        data: {
          id: 'api-docs-plugin',
          name: 'API Documentation',
          version: '1.2.0',
          description: 'Generate and view API documentation',
          author: 'Backstage Team',
          category: 'Documentation',
          tags: ['api', 'docs'],
          icon: 'file-text',
          downloadCount: 1500,
          rating: 4.5,
          reviews: 25,
          compatibility: ['1.20.0'],
          lastUpdated: new Date(),
          size: '2.1 MB',
          license: 'Apache-2.0',
          homepage: 'https://example.com',
          repository: 'https://github.com/example',
        },
      });

      await prisma.$disconnect();
    } catch (error) {
      console.error('Error setting up searchable plugins:', error);
      throw error;
    }
  }

  async function setupCategoryPlugins(category: string): Promise<void> {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL,
        },
      },
    });

    try {
      await prisma.plugin.create({
        data: {
          id: 'category-plugin',
          name: 'Category Plugin',
          version: '1.0.0',
          description: 'Plugin in specific category',
          author: 'Test Author',
          category: category,
          tags: ['test'],
          icon: 'package',
          downloadCount: 100,
          rating: 4.0,
          reviews: 10,
          compatibility: ['1.20.0'],
          lastUpdated: new Date(),
          size: '1.0 MB',
          license: 'MIT',
          homepage: 'https://example.com',
          repository: 'https://github.com/example',
        },
      });

      await prisma.$disconnect();
    } catch (error) {
      console.error(`Error setting up ${category} plugins:`, error);
      throw error;
    }
  }

  async function setupSpecificPlugin(pluginId: string): Promise<void> {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL,
        },
      },
    });

    try {
      await prisma.plugin.create({
        data: {
          id: pluginId,
          name: 'API Documentation',
          version: '1.2.0',
          description: 'Comprehensive API documentation plugin',
          author: 'Backstage Team',
          category: 'Documentation',
          tags: ['api', 'docs'],
          icon: 'file-text',
          downloadCount: 1500,
          rating: 4.5,
          reviews: 25,
          compatibility: ['1.20.0'],
          lastUpdated: new Date(),
          size: '2.1 MB',
          license: 'Apache-2.0',
          homepage: 'https://docs.example.com/plugin',
          repository: 'https://github.com/example',
          config: {
            required: false,
            schema: {
              type: 'object',
              properties: {
                apiUrl: {
                  type: 'string',
                  format: 'uri',
                },
                timeout: {
                  type: 'number',
                  minimum: 1000,
                },
              },
            },
          },
        },
      });

      // Create dependencies if needed
      await prisma.plugin.create({
        data: {
          id: 'base-plugin',
          name: 'Base Plugin',
          version: '1.0.0',
          description: 'Base plugin dependency',
          author: 'Test Author',
          category: 'Development',
          tags: ['base'],
          icon: 'package',
          downloadCount: 500,
          rating: 4.0,
          reviews: 15,
          compatibility: ['1.20.0'],
          lastUpdated: new Date(),
          size: '1.0 MB',
          license: 'MIT',
          homepage: 'https://example.com',
          repository: 'https://github.com/example',
        },
      });

      await prisma.pluginDependency.create({
        data: {
          id: 'dep-1',
          pluginId: pluginId,
          dependsOnPluginId: 'base-plugin',
          versionConstraint: '>=1.0.0',
          required: true,
        },
      });

      await prisma.$disconnect();
    } catch (error) {
      console.error(`Error setting up plugin ${pluginId}:`, error);
      throw error;
    }
  }

  async function cleanupNonExistentPlugin(): Promise<void> {
    // Ensure non-existent plugin doesn't exist
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL,
        },
      },
    });

    try {
      await prisma.plugin.deleteMany({
        where: {
          id: 'non-existent-plugin',
        },
      });

      await prisma.$disconnect();
    } catch (error) {
      // Ignore errors - plugin might not exist
      await prisma.$disconnect();
    }
  }

  async function setupAvailablePlugin(pluginId: string): Promise<void> {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL,
        },
      },
    });

    try {
      await prisma.plugin.create({
        data: {
          id: pluginId,
          name: 'API Documentation',
          version: '1.2.0',
          description: 'Available plugin for installation',
          author: 'Backstage Team',
          category: 'Documentation',
          tags: ['api'],
          icon: 'file-text',
          downloadCount: 1500,
          rating: 4.5,
          reviews: 25,
          compatibility: ['1.20.0'],
          lastUpdated: new Date(),
          size: '2.1 MB',
          license: 'Apache-2.0',
          homepage: 'https://example.com',
          repository: 'https://github.com/example',
          config: {
            required: false,
            schema: {
              type: 'object',
              properties: {
                apiUrl: { type: 'string' },
                timeout: { type: 'number' },
                enableLogging: { type: 'boolean' },
              },
            },
          },
        },
      });

      // Ensure no installation exists
      await prisma.pluginInstallation.deleteMany({
        where: { pluginId },
      });

      await prisma.$disconnect();
    } catch (error) {
      console.error(`Error setting up available plugin ${pluginId}:`, error);
      throw error;
    }
  }

  async function setupInstalledPlugin(pluginId: string): Promise<void> {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL,
        },
      },
    });

    try {
      await prisma.plugin.create({
        data: {
          id: pluginId,
          name: 'Installed Plugin',
          version: '1.0.0',
          description: 'Already installed plugin',
          author: 'Test Author',
          category: 'Test',
          tags: ['test'],
          icon: 'package',
          downloadCount: 100,
          rating: 4.0,
          reviews: 5,
          compatibility: ['1.20.0'],
          lastUpdated: new Date(),
          size: '1.0 MB',
          license: 'MIT',
          homepage: 'https://example.com',
          repository: 'https://github.com/example',
        },
      });

      await prisma.pluginInstallation.create({
        data: {
          id: `installation-${pluginId}`,
          pluginId,
          status: 'installed',
          version: '1.0.0',
          installedAt: new Date(),
          installedBy: 'test-user',
          config: {},
          containerId: 'container-123',
          health: 'healthy',
          lastHealthCheck: new Date(),
        },
      });

      await prisma.$disconnect();
    } catch (error) {
      console.error(`Error setting up installed plugin ${pluginId}:`, error);
      throw error;
    }
  }

  async function setupPluginWithValidation(pluginId: string): Promise<void> {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL,
        },
      },
    });

    try {
      await prisma.plugin.create({
        data: {
          id: pluginId,
          name: 'Config Validation Plugin',
          version: '1.0.0',
          description: 'Plugin that requires valid configuration',
          author: 'Test Author',
          category: 'Test',
          tags: ['validation'],
          icon: 'shield',
          downloadCount: 50,
          rating: 4.2,
          reviews: 8,
          compatibility: ['1.20.0'],
          lastUpdated: new Date(),
          size: '1.5 MB',
          license: 'MIT',
          homepage: 'https://example.com',
          repository: 'https://github.com/example',
          config: {
            required: true,
            schema: {
              type: 'object',
              properties: {
                apiUrl: {
                  type: 'string',
                  format: 'uri',
                },
                timeout: {
                  type: 'number',
                  minimum: 1000,
                },
              },
              required: ['apiUrl'],
            },
          },
        },
      });

      await prisma.$disconnect();
    } catch (error) {
      console.error(`Error setting up validation plugin ${pluginId}:`, error);
      throw error;
    }
  }

  async function setupPluginWithDependents(pluginId: string): Promise<void> {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL,
        },
      },
    });

    try {
      // Create the base plugin
      await prisma.plugin.create({
        data: {
          id: pluginId,
          name: 'Base Plugin with Dependents',
          version: '1.0.0',
          description: 'Plugin that other plugins depend on',
          author: 'Test Author',
          category: 'Base',
          tags: ['base'],
          icon: 'package',
          downloadCount: 500,
          rating: 4.5,
          reviews: 20,
          compatibility: ['1.20.0'],
          lastUpdated: new Date(),
          size: '2.0 MB',
          license: 'Apache-2.0',
          homepage: 'https://example.com',
          repository: 'https://github.com/example',
        },
      });

      // Create a dependent plugin
      await prisma.plugin.create({
        data: {
          id: 'dependent-plugin',
          name: 'Dependent Plugin',
          version: '1.0.0',
          description: 'Plugin that depends on base plugin',
          author: 'Test Author',
          category: 'Extension',
          tags: ['dependent'],
          icon: 'link',
          downloadCount: 100,
          rating: 4.0,
          reviews: 10,
          compatibility: ['1.20.0'],
          lastUpdated: new Date(),
          size: '1.0 MB',
          license: 'MIT',
          homepage: 'https://example.com',
          repository: 'https://github.com/example',
        },
      });

      // Create dependency relationship
      await prisma.pluginDependency.create({
        data: {
          id: 'dep-relation-1',
          pluginId: 'dependent-plugin',
          dependsOnPluginId: pluginId,
          versionConstraint: '>=1.0.0',
          required: true,
        },
      });

      // Install both plugins
      await prisma.pluginInstallation.createMany({
        data: [
          {
            id: `installation-${pluginId}`,
            pluginId,
            status: 'installed',
            version: '1.0.0',
            installedAt: new Date(),
            installedBy: 'test-user',
            config: {},
            containerId: 'container-base',
            health: 'healthy',
            lastHealthCheck: new Date(),
          },
          {
            id: 'installation-dependent-plugin',
            pluginId: 'dependent-plugin',
            status: 'installed',
            version: '1.0.0',
            installedAt: new Date(),
            installedBy: 'test-user',
            config: {},
            containerId: 'container-dependent',
            health: 'healthy',
            lastHealthCheck: new Date(),
          },
        ],
      });

      await prisma.$disconnect();
    } catch (error) {
      console.error(`Error setting up plugin with dependents ${pluginId}:`, error);
      throw error;
    }
  }

  async function setupConfiguredPlugin(pluginId: string): Promise<void> {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL,
        },
      },
    });

    try {
      await prisma.plugin.create({
        data: {
          id: pluginId,
          name: 'Configured Plugin',
          version: '1.0.0',
          description: 'Plugin with configuration',
          author: 'Test Author',
          category: 'Test',
          tags: ['configured'],
          icon: 'settings',
          downloadCount: 200,
          rating: 4.3,
          reviews: 12,
          compatibility: ['1.20.0'],
          lastUpdated: new Date(),
          size: '1.8 MB',
          license: 'MIT',
          homepage: 'https://example.com',
          repository: 'https://github.com/example',
          config: {
            required: false,
            schema: {
              type: 'object',
              properties: {
                apiUrl: {
                  type: 'string',
                  format: 'uri',
                },
                timeout: {
                  type: 'number',
                  minimum: 1000,
                },
                enableLogging: {
                  type: 'boolean',
                },
              },
              required: ['apiUrl'],
            },
          },
        },
      });

      await prisma.pluginInstallation.create({
        data: {
          id: `installation-${pluginId}`,
          pluginId,
          status: 'installed',
          version: '1.0.0',
          installedAt: new Date(),
          installedBy: 'test-user',
          config: {
            apiUrl: 'https://api.example.com',
            timeout: 5000,
            enableLogging: true,
          },
          containerId: 'container-configured',
          health: 'healthy',
          lastHealthCheck: new Date(),
          updatedAt: new Date('2024-01-15T10:00:00Z'),
        },
      });

      await prisma.$disconnect();
    } catch (error) {
      console.error(`Error setting up configured plugin ${pluginId}:`, error);
      throw error;
    }
  }

  async function setupConfigurablePlugin(pluginId: string): Promise<void> {
    await setupInstalledPlugin(pluginId);
  }

  async function setupRunningPlugin(pluginId: string): Promise<void> {
    await setupInstalledPlugin(pluginId);
    // Additional setup for running state would go here
  }

  async function setupUnhealthyPlugin(pluginId: string): Promise<void> {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL,
        },
      },
    });

    try {
      await prisma.plugin.create({
        data: {
          id: pluginId,
          name: 'Unhealthy Plugin',
          version: '1.0.0',
          description: 'Plugin in unhealthy state',
          author: 'Test Author',
          category: 'Test',
          tags: ['unhealthy'],
          icon: 'alert-triangle',
          downloadCount: 50,
          rating: 3.5,
          reviews: 8,
          compatibility: ['1.20.0'],
          lastUpdated: new Date(),
          size: '1.2 MB',
          license: 'MIT',
          homepage: 'https://example.com',
          repository: 'https://github.com/example',
        },
      });

      await prisma.pluginInstallation.create({
        data: {
          id: `installation-${pluginId}`,
          pluginId,
          status: 'installed',
          version: '1.0.0',
          installedAt: new Date(),
          installedBy: 'test-user',
          config: {},
          containerId: 'container-unhealthy',
          health: 'unhealthy',
          lastHealthCheck: new Date(),
          metrics: {
            memoryUsage: 512,
            cpuUsage: 85.2,
            responseTime: 2500,
            errorRate: 25.5,
          },
        },
      });

      await prisma.$disconnect();
    } catch (error) {
      console.error(`Error setting up unhealthy plugin ${pluginId}:`, error);
      throw error;
    }
  }

  async function setupPluginCategories(): Promise<void> {
    // Categories are typically computed from existing plugins
    // Ensure we have plugins in various categories
    await setupTestPlugins();
  }

  async function invalidateAllTokens(): Promise<void> {
    // Mock invalidation - in real implementation you'd invalidate JWT tokens
    // For testing purposes, the middleware will reject any tokens
  }

  async function setupUserWithoutAdminPermissions(): Promise<void> {
    // Setup user tokens that don't have admin permissions
    // This would typically involve setting up user records and permissions
  }

  async function setupServerErrorCondition(): Promise<void> {
    // Setup conditions that would cause a server error
    // This could involve database corruption, network issues, etc.
  }
});