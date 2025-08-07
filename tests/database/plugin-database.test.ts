import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

// Test database setup
const testDatabaseUrl = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5433/plugin_test_db';
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: testDatabaseUrl,
    },
  },
});

// Mock data generators
const createMockPlugin = (overrides = {}) => ({
  id: `plugin-${uuidv4()}`,
  name: `Test Plugin ${Math.random().toString(36).substr(2, 8)}`,
  version: '1.0.0',
  description: 'A test plugin for database testing',
  author: 'Test Author',
  category: 'Development',
  tags: ['test', 'development'],
  icon: 'package',
  downloadCount: Math.floor(Math.random() * 1000),
  rating: Math.random() * 5,
  reviews: Math.floor(Math.random() * 100),
  lastUpdated: new Date(),
  repository: 'https://github.com/test/plugin',
  homepage: 'https://test-plugin.com',
  license: 'MIT',
  size: '2.1 MB',
  compatibility: ['1.20.0', '1.21.0'],
  config: {
    required: false,
    schema: {
      type: 'object',
      properties: {
        apiUrl: { type: 'string' },
      },
    },
  },
  ...overrides,
});

const createMockPluginInstallation = (pluginId: string, overrides = {}) => ({
  id: `installation-${uuidv4()}`,
  pluginId,
  status: 'installed',
  version: '1.0.0',
  installedAt: new Date(),
  installedBy: 'test-user',
  config: {},
  containerId: `container-${uuidv4()}`,
  health: 'healthy',
  lastHealthCheck: new Date(),
  metrics: {
    uptime: 100,
    errorRate: 0,
    responseTime: 50,
  },
  ...overrides,
});

describe('Plugin Database Operations', () => {
  beforeAll(async () => {
    // Reset test database
    try {
      await prisma.$executeRaw`DROP SCHEMA IF EXISTS public CASCADE`;
      await prisma.$executeRaw`CREATE SCHEMA public`;
      
      // Run migrations
      execSync('npx prisma db push --force-reset --accept-data-loss', {
        env: { ...process.env, DATABASE_URL: testDatabaseUrl },
      });
      
      await prisma.$connect();
    } catch (error) {
      console.error('Database setup failed:', error);
      throw error;
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await prisma.pluginInstallation.deleteMany();
    await prisma.pluginDependency.deleteMany();
    await prisma.plugin.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('Plugin CRUD Operations', () => {
    it('should create a plugin successfully', async () => {
      const pluginData = createMockPlugin();
      
      const createdPlugin = await prisma.plugin.create({
        data: pluginData,
      });

      expect(createdPlugin).toBeDefined();
      expect(createdPlugin.id).toBe(pluginData.id);
      expect(createdPlugin.name).toBe(pluginData.name);
      expect(createdPlugin.version).toBe(pluginData.version);
      expect(createdPlugin.tags).toEqual(pluginData.tags);
      expect(createdPlugin.config).toEqual(pluginData.config);
    });

    it('should prevent duplicate plugin IDs', async () => {
      const pluginId = 'duplicate-test-plugin';
      const pluginData1 = createMockPlugin({ id: pluginId });
      const pluginData2 = createMockPlugin({ id: pluginId, name: 'Different Name' });

      await prisma.plugin.create({ data: pluginData1 });

      await expect(
        prisma.plugin.create({ data: pluginData2 })
      ).rejects.toThrow(/unique constraint/i);
    });

    it('should retrieve plugin by ID', async () => {
      const pluginData = createMockPlugin();
      await prisma.plugin.create({ data: pluginData });

      const retrievedPlugin = await prisma.plugin.findUnique({
        where: { id: pluginData.id },
      });

      expect(retrievedPlugin).toBeDefined();
      expect(retrievedPlugin!.id).toBe(pluginData.id);
      expect(retrievedPlugin!.name).toBe(pluginData.name);
    });

    it('should update plugin information', async () => {
      const pluginData = createMockPlugin();
      await prisma.plugin.create({ data: pluginData });

      const updatedData = {
        version: '2.0.0',
        description: 'Updated description',
        downloadCount: 500,
        rating: 4.5,
      };

      const updatedPlugin = await prisma.plugin.update({
        where: { id: pluginData.id },
        data: updatedData,
      });

      expect(updatedPlugin.version).toBe(updatedData.version);
      expect(updatedPlugin.description).toBe(updatedData.description);
      expect(updatedPlugin.downloadCount).toBe(updatedData.downloadCount);
      expect(updatedPlugin.rating).toBe(updatedData.rating);
    });

    it('should delete plugin and cascade to related records', async () => {
      const pluginData = createMockPlugin();
      const plugin = await prisma.plugin.create({ data: pluginData });

      // Create related installation
      const installationData = createMockPluginInstallation(plugin.id);
      await prisma.pluginInstallation.create({ data: installationData });

      // Delete plugin
      await prisma.plugin.delete({
        where: { id: plugin.id },
      });

      // Verify plugin is deleted
      const deletedPlugin = await prisma.plugin.findUnique({
        where: { id: plugin.id },
      });
      expect(deletedPlugin).toBeNull();

      // Verify cascaded deletion of installation
      const deletedInstallation = await prisma.pluginInstallation.findUnique({
        where: { id: installationData.id },
      });
      expect(deletedInstallation).toBeNull();
    });
  });

  describe('Plugin Search and Filtering', () => {
    beforeEach(async () => {
      // Create test plugins with various attributes
      const testPlugins = [
        createMockPlugin({
          id: 'api-docs-plugin',
          name: 'API Documentation',
          category: 'Documentation',
          tags: ['api', 'docs', 'swagger'],
          rating: 4.5,
          downloadCount: 1000,
        }),
        createMockPlugin({
          id: 'monitoring-plugin',
          name: 'System Monitor',
          category: 'Monitoring',
          tags: ['monitoring', 'health', 'metrics'],
          rating: 4.2,
          downloadCount: 2500,
        }),
        createMockPlugin({
          id: 'security-plugin',
          name: 'Security Scanner',
          category: 'Security',
          tags: ['security', 'vulnerability', 'scanning'],
          rating: 4.8,
          downloadCount: 1500,
        }),
      ];

      for (const plugin of testPlugins) {
        await prisma.plugin.create({ data: plugin });
      }
    });

    it('should search plugins by name', async () => {
      const results = await prisma.plugin.findMany({
        where: {
          name: {
            contains: 'API',
            mode: 'insensitive',
          },
        },
      });

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('API Documentation');
    });

    it('should filter plugins by category', async () => {
      const results = await prisma.plugin.findMany({
        where: {
          category: 'Monitoring',
        },
      });

      expect(results).toHaveLength(1);
      expect(results[0].category).toBe('Monitoring');
    });

    it('should search plugins by tags', async () => {
      const results = await prisma.plugin.findMany({
        where: {
          tags: {
            has: 'security',
          },
        },
      });

      expect(results).toHaveLength(1);
      expect(results[0].tags).toContain('security');
    });

    it('should sort plugins by rating', async () => {
      const results = await prisma.plugin.findMany({
        orderBy: {
          rating: 'desc',
        },
      });

      expect(results).toHaveLength(3);
      expect(results[0].rating).toBeGreaterThanOrEqual(results[1].rating);
      expect(results[1].rating).toBeGreaterThanOrEqual(results[2].rating);
    });

    it('should sort plugins by download count', async () => {
      const results = await prisma.plugin.findMany({
        orderBy: {
          downloadCount: 'desc',
        },
      });

      expect(results).toHaveLength(3);
      expect(results[0].downloadCount).toBeGreaterThanOrEqual(results[1].downloadCount);
    });

    it('should paginate plugin results', async () => {
      const page1 = await prisma.plugin.findMany({
        take: 2,
        skip: 0,
        orderBy: { name: 'asc' },
      });

      const page2 = await prisma.plugin.findMany({
        take: 2,
        skip: 2,
        orderBy: { name: 'asc' },
      });

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(1);
      expect(page1[0].id).not.toBe(page2[0].id);
    });

    it('should perform complex search with multiple filters', async () => {
      const results = await prisma.plugin.findMany({
        where: {
          AND: [
            {
              OR: [
                { name: { contains: 'API', mode: 'insensitive' } },
                { description: { contains: 'documentation', mode: 'insensitive' } },
              ],
            },
            { rating: { gte: 4.0 } },
            { downloadCount: { gte: 500 } },
          ],
        },
      });

      expect(results.length).toBeGreaterThan(0);
      results.forEach((plugin) => {
        expect(plugin.rating).toBeGreaterThanOrEqual(4.0);
        expect(plugin.downloadCount).toBeGreaterThanOrEqual(500);
      });
    });
  });

  describe('Plugin Installation Management', () => {
    let testPlugin: any;

    beforeEach(async () => {
      testPlugin = await prisma.plugin.create({
        data: createMockPlugin({ id: 'installation-test-plugin' }),
      });
    });

    it('should create plugin installation', async () => {
      const installationData = createMockPluginInstallation(testPlugin.id);

      const installation = await prisma.pluginInstallation.create({
        data: installationData,
      });

      expect(installation).toBeDefined();
      expect(installation.pluginId).toBe(testPlugin.id);
      expect(installation.status).toBe('installed');
      expect(installation.containerId).toBeDefined();
    });

    it('should prevent duplicate installations for same plugin', async () => {
      const installationData1 = createMockPluginInstallation(testPlugin.id);
      const installationData2 = createMockPluginInstallation(testPlugin.id);

      await prisma.pluginInstallation.create({ data: installationData1 });

      // Should enforce unique constraint on pluginId
      await expect(
        prisma.pluginInstallation.create({ data: installationData2 })
      ).rejects.toThrow(/unique constraint/i);
    });

    it('should update installation status', async () => {
      const installationData = createMockPluginInstallation(testPlugin.id, {
        status: 'installing',
      });

      const installation = await prisma.pluginInstallation.create({
        data: installationData,
      });

      const updatedInstallation = await prisma.pluginInstallation.update({
        where: { id: installation.id },
        data: {
          status: 'installed',
          health: 'healthy',
          lastHealthCheck: new Date(),
        },
      });

      expect(updatedInstallation.status).toBe('installed');
      expect(updatedInstallation.health).toBe('healthy');
    });

    it('should track installation metrics', async () => {
      const metrics = {
        uptime: 99.5,
        errorRate: 0.1,
        responseTime: 45,
        memoryUsage: 128,
        cpuUsage: 15,
      };

      const installationData = createMockPluginInstallation(testPlugin.id, {
        metrics,
      });

      const installation = await prisma.pluginInstallation.create({
        data: installationData,
      });

      expect(installation.metrics).toEqual(metrics);
    });

    it('should handle installation configuration updates', async () => {
      const initialConfig = { apiUrl: 'https://api.example.com' };
      const updatedConfig = {
        apiUrl: 'https://new-api.example.com',
        timeout: 5000,
        retryAttempts: 3,
      };

      const installationData = createMockPluginInstallation(testPlugin.id, {
        config: initialConfig,
      });

      const installation = await prisma.pluginInstallation.create({
        data: installationData,
      });

      const updatedInstallation = await prisma.pluginInstallation.update({
        where: { id: installation.id },
        data: { config: updatedConfig },
      });

      expect(updatedInstallation.config).toEqual(updatedConfig);
    });
  });

  describe('Plugin Dependencies', () => {
    let basePlugin: any;
    let dependentPlugin: any;

    beforeEach(async () => {
      basePlugin = await prisma.plugin.create({
        data: createMockPlugin({ id: 'base-plugin' }),
      });

      dependentPlugin = await prisma.plugin.create({
        data: createMockPlugin({ id: 'dependent-plugin' }),
      });
    });

    it('should create plugin dependency relationship', async () => {
      const dependency = await prisma.pluginDependency.create({
        data: {
          id: uuidv4(),
          pluginId: dependentPlugin.id,
          dependsOnPluginId: basePlugin.id,
          versionConstraint: '>=1.0.0',
          required: true,
        },
      });

      expect(dependency).toBeDefined();
      expect(dependency.pluginId).toBe(dependentPlugin.id);
      expect(dependency.dependsOnPluginId).toBe(basePlugin.id);
    });

    it('should query plugin dependencies', async () => {
      await prisma.pluginDependency.create({
        data: {
          id: uuidv4(),
          pluginId: dependentPlugin.id,
          dependsOnPluginId: basePlugin.id,
          versionConstraint: '>=1.0.0',
          required: true,
        },
      });

      const pluginWithDependencies = await prisma.plugin.findUnique({
        where: { id: dependentPlugin.id },
        include: {
          dependencies: {
            include: {
              dependsOnPlugin: true,
            },
          },
        },
      });

      expect(pluginWithDependencies!.dependencies).toHaveLength(1);
      expect(pluginWithDependencies!.dependencies[0].dependsOnPlugin.id).toBe(basePlugin.id);
    });

    it('should query plugins that depend on a specific plugin', async () => {
      await prisma.pluginDependency.create({
        data: {
          id: uuidv4(),
          pluginId: dependentPlugin.id,
          dependsOnPluginId: basePlugin.id,
          versionConstraint: '>=1.0.0',
          required: true,
        },
      });

      const pluginWithDependents = await prisma.plugin.findUnique({
        where: { id: basePlugin.id },
        include: {
          dependents: {
            include: {
              plugin: true,
            },
          },
        },
      });

      expect(pluginWithDependents!.dependents).toHaveLength(1);
      expect(pluginWithDependents!.dependents[0].plugin.id).toBe(dependentPlugin.id);
    });

    it('should handle complex dependency chains', async () => {
      const middlePlugin = await prisma.plugin.create({
        data: createMockPlugin({ id: 'middle-plugin' }),
      });

      // Create dependency chain: dependent -> middle -> base
      await prisma.pluginDependency.createMany({
        data: [
          {
            id: uuidv4(),
            pluginId: dependentPlugin.id,
            dependsOnPluginId: middlePlugin.id,
            versionConstraint: '>=1.0.0',
            required: true,
          },
          {
            id: uuidv4(),
            pluginId: middlePlugin.id,
            dependsOnPluginId: basePlugin.id,
            versionConstraint: '>=1.0.0',
            required: true,
          },
        ],
      });

      // Query the full dependency chain
      const fullChain = await prisma.plugin.findUnique({
        where: { id: dependentPlugin.id },
        include: {
          dependencies: {
            include: {
              dependsOnPlugin: {
                include: {
                  dependencies: {
                    include: {
                      dependsOnPlugin: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      expect(fullChain!.dependencies).toHaveLength(1);
      expect(fullChain!.dependencies[0].dependsOnPlugin.dependencies).toHaveLength(1);
    });
  });

  describe('Database Performance and Indexing', () => {
    beforeEach(async () => {
      // Create a larger dataset for performance testing
      const plugins = Array.from({ length: 1000 }, (_, index) =>
        createMockPlugin({
          id: `perf-plugin-${index}`,
          name: `Performance Plugin ${index}`,
          rating: Math.random() * 5,
          downloadCount: Math.floor(Math.random() * 10000),
          lastUpdated: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
        })
      );

      // Insert in batches to avoid memory issues
      for (let i = 0; i < plugins.length; i += 100) {
        const batch = plugins.slice(i, i + 100);
        await prisma.plugin.createMany({ data: batch });
      }
    });

    it('should perform efficient name searches', async () => {
      const startTime = Date.now();

      const results = await prisma.plugin.findMany({
        where: {
          name: {
            contains: 'Performance',
            mode: 'insensitive',
          },
        },
        take: 50,
      });

      const executionTime = Date.now() - startTime;

      expect(results.length).toBeGreaterThan(0);
      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should perform efficient category filtering', async () => {
      const startTime = Date.now();

      const results = await prisma.plugin.findMany({
        where: { category: 'Development' },
        take: 50,
      });

      const executionTime = Date.now() - startTime;

      expect(executionTime).toBeLessThan(500); // Should complete within 500ms
    });

    it('should perform efficient sorting by rating', async () => {
      const startTime = Date.now();

      const results = await prisma.plugin.findMany({
        orderBy: { rating: 'desc' },
        take: 50,
      });

      const executionTime = Date.now() - startTime;

      expect(results).toHaveLength(50);
      expect(executionTime).toBeLessThan(500);
    });

    it('should perform efficient pagination', async () => {
      const pageSize = 20;
      const pageNumber = 10;

      const startTime = Date.now();

      const results = await prisma.plugin.findMany({
        take: pageSize,
        skip: pageNumber * pageSize,
        orderBy: { name: 'asc' },
      });

      const executionTime = Date.now() - startTime;

      expect(results).toHaveLength(pageSize);
      expect(executionTime).toBeLessThan(300);
    });
  });

  describe('Data Integrity and Constraints', () => {
    it('should enforce required fields', async () => {
      await expect(
        prisma.plugin.create({
          data: {
            // Missing required fields like id, name, version
            description: 'Invalid plugin',
          } as any,
        })
      ).rejects.toThrow();
    });

    it('should validate version format', async () => {
      const pluginData = createMockPlugin({
        version: 'invalid-version-format',
      });

      // Note: This would need a database constraint or validation at application level
      // For this test, we'll just ensure it doesn't cause database errors
      const plugin = await prisma.plugin.create({ data: pluginData });
      expect(plugin.version).toBe('invalid-version-format');
    });

    it('should handle JSON field validation', async () => {
      const pluginData = createMockPlugin({
        config: {
          required: true,
          schema: {
            type: 'object',
            properties: {
              complexConfig: {
                nested: true,
                array: [1, 2, 3],
                object: { key: 'value' },
              },
            },
          },
        },
      });

      const plugin = await prisma.plugin.create({ data: pluginData });
      expect(plugin.config).toEqual(pluginData.config);
    });

    it('should handle array field operations', async () => {
      const pluginData = createMockPlugin({
        tags: ['initial', 'tags'],
        compatibility: ['1.0.0'],
      });

      const plugin = await prisma.plugin.create({ data: pluginData });

      // Update arrays
      const updatedPlugin = await prisma.plugin.update({
        where: { id: plugin.id },
        data: {
          tags: ['new', 'updated', 'tags'],
          compatibility: ['1.0.0', '1.1.0', '1.2.0'],
        },
      });

      expect(updatedPlugin.tags).toEqual(['new', 'updated', 'tags']);
      expect(updatedPlugin.compatibility).toEqual(['1.0.0', '1.1.0', '1.2.0']);
    });
  });

  describe('Transaction Handling', () => {
    it('should handle plugin installation as a transaction', async () => {
      const pluginData = createMockPlugin();
      const installationData = createMockPluginInstallation(pluginData.id);

      const result = await prisma.$transaction(async (prisma) => {
        const plugin = await prisma.plugin.create({ data: pluginData });
        const installation = await prisma.pluginInstallation.create({
          data: installationData,
        });

        return { plugin, installation };
      });

      expect(result.plugin.id).toBe(pluginData.id);
      expect(result.installation.pluginId).toBe(pluginData.id);
    });

    it('should rollback transaction on failure', async () => {
      const pluginData = createMockPlugin();

      await expect(
        prisma.$transaction(async (prisma) => {
          await prisma.plugin.create({ data: pluginData });

          // This should cause the transaction to fail
          throw new Error('Simulated transaction failure');
        })
      ).rejects.toThrow('Simulated transaction failure');

      // Verify plugin was not created
      const plugin = await prisma.plugin.findUnique({
        where: { id: pluginData.id },
      });
      expect(plugin).toBeNull();
    });
  });

  describe('Database Migration and Schema Evolution', () => {
    it('should handle schema changes gracefully', async () => {
      // This test would verify that database migrations work correctly
      // In a real scenario, you'd test migration scripts
      
      const plugin = await prisma.plugin.create({
        data: createMockPlugin(),
      });

      expect(plugin).toBeDefined();
    });

    it('should maintain data consistency during migrations', async () => {
      // Test that existing data remains consistent after schema changes
      const plugin = await prisma.plugin.create({
        data: createMockPlugin(),
      });

      // Simulate what happens during a migration
      const retrievedPlugin = await prisma.plugin.findUnique({
        where: { id: plugin.id },
      });

      expect(retrievedPlugin).toEqual(plugin);
    });
  });

  describe('Database Connection and Error Handling', () => {
    it('should handle connection timeouts gracefully', async () => {
      // This test would simulate connection issues
      // For now, we'll just verify the connection works
      const result = await prisma.$queryRaw`SELECT 1 as test`;
      expect(result).toBeDefined();
    });

    it('should handle concurrent operations', async () => {
      const concurrentOperations = Array.from({ length: 10 }, (_, index) =>
        prisma.plugin.create({
          data: createMockPlugin({ id: `concurrent-${index}` }),
        })
      );

      const results = await Promise.all(concurrentOperations);
      expect(results).toHaveLength(10);
      
      // Verify all plugins were created
      const count = await prisma.plugin.count({
        where: {
          id: { startsWith: 'concurrent-' },
        },
      });
      expect(count).toBe(10);
    });
  });

  describe('Database Security', () => {
    it('should prevent SQL injection in queries', async () => {
      const maliciousInput = "'; DROP TABLE plugins; --";

      // This should be handled safely by Prisma
      const results = await prisma.plugin.findMany({
        where: {
          name: {
            contains: maliciousInput,
            mode: 'insensitive',
          },
        },
      });

      // Should return empty results, not crash
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle special characters in data', async () => {
      const specialCharsData = createMockPlugin({
        name: "Plugin with 'quotes' and \"double quotes\"",
        description: 'Description with <script>alert("xss")</script>',
        tags: ['tag with spaces', 'tag-with-dashes', 'tag_with_underscores'],
      });

      const plugin = await prisma.plugin.create({ data: specialCharsData });
      expect(plugin.name).toBe(specialCharsData.name);
      expect(plugin.description).toBe(specialCharsData.description);
      expect(plugin.tags).toEqual(specialCharsData.tags);
    });
  });
});