import { PrismaClient, PluginCategory } from '@prisma/client';
import { execSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

const testDatabaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';

const describeIfDb = testDatabaseUrl ? describe : describe.skip;

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: testDatabaseUrl || 'postgresql://localhost:5432/placeholder',
    },
  },
});

const createMockPlugin = (overrides: Record<string, unknown> = {}) => {
  const suffix = Math.random().toString(36).slice(2, 8);
  return {
    name: `test-plugin-${suffix}`,
    displayName: `Test Plugin ${suffix}`,
    description: 'A test plugin for database testing',
    category: PluginCategory.OTHER,
    tags: ['test', 'development'],
    author: 'Test Author',
    repository: 'https://github.com/test/plugin',
    homepage: 'https://test-plugin.com',
    license: 'MIT',
    keywords: ['test'],
    ...overrides,
  };
};

const createMockPluginVersion = (pluginId: string, version = '1.0.0', overrides = {}) => {
  const [major = '1', minor = '0', patch = '0'] = version.split('.');
  return {
    pluginId,
    version,
    semverMajor: Number.parseInt(major, 10),
    semverMinor: Number.parseInt(minor, 10),
    semverPatch: Number.parseInt(patch, 10),
    isCurrent: true,
    ...overrides,
  };
};

const createMockPluginOperation = (pluginId: string, overrides = {}) => ({
  pluginId,
  operationType: 'INSTALL' as const,
  status: 'COMPLETED' as const,
  performedBy: 'test-user',
  environment: 'production',
  ...overrides,
});

describeIfDb('Plugin Database Operations', () => {
  beforeAll(async () => {
    await prisma.$executeRaw`DROP SCHEMA IF EXISTS public CASCADE`;
    await prisma.$executeRaw`CREATE SCHEMA public`;

    execSync('npx prisma db push --force-reset --accept-data-loss --skip-generate', {
      env: { ...process.env, DATABASE_URL: testDatabaseUrl },
      stdio: 'pipe',
    });

    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.pluginOperation.deleteMany();
    await prisma.pluginDependency.deleteMany();
    await prisma.pluginVersion.deleteMany();
    await prisma.plugin.deleteMany();
  });

  describe('Plugin CRUD Operations', () => {
    it('should create a plugin successfully', async () => {
      const pluginData = createMockPlugin();
      const createdPlugin = await prisma.plugin.create({ data: pluginData });

      expect(createdPlugin.id).toBeDefined();
      expect(createdPlugin.name).toBe(pluginData.name);
      expect(createdPlugin.displayName).toBe(pluginData.displayName);
      expect(createdPlugin.tags).toEqual(pluginData.tags);
    });

    it('should prevent duplicate plugin names within the same tenant', async () => {
      const tenantId = `tenant-${uuidv4()}`;
      const sharedName = `shared-plugin-${uuidv4()}`;
      const pluginData1 = createMockPlugin({ tenantId, name: sharedName });
      const pluginData2 = createMockPlugin({ tenantId, name: sharedName, displayName: 'Different Name' });

      await prisma.plugin.create({ data: pluginData1 });

      await expect(prisma.plugin.create({ data: pluginData2 })).rejects.toThrow(
        /unique constraint/i,
      );
    });

    it('should retrieve plugin by ID', async () => {
      const pluginData = createMockPlugin();
      const created = await prisma.plugin.create({ data: pluginData });

      const retrieved = await prisma.plugin.findUnique({ where: { id: created.id } });

      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe(pluginData.name);
    });

    it('should update plugin information', async () => {
      const created = await prisma.plugin.create({ data: createMockPlugin() });

      const updatedPlugin = await prisma.plugin.update({
        where: { id: created.id },
        data: {
          description: 'Updated description',
          downloadCount: 500,
          starCount: 12,
        },
      });

      expect(updatedPlugin.description).toBe('Updated description');
      expect(updatedPlugin.downloadCount).toBe(500n);
      expect(updatedPlugin.starCount).toBe(12);
    });

    it('should delete plugin and cascade to related records', async () => {
      const plugin = await prisma.plugin.create({ data: createMockPlugin() });
      const version = await prisma.pluginVersion.create({
        data: createMockPluginVersion(plugin.id),
      });
      const operation = await prisma.pluginOperation.create({
        data: createMockPluginOperation(plugin.id),
      });

      await prisma.plugin.delete({ where: { id: plugin.id } });

      expect(await prisma.plugin.findUnique({ where: { id: plugin.id } })).toBeNull();
      expect(await prisma.pluginVersion.findUnique({ where: { id: version.id } })).toBeNull();
      expect(await prisma.pluginOperation.findUnique({ where: { id: operation.id } })).toBeNull();
    });
  });

  describe('Plugin Search and Filtering', () => {
    beforeEach(async () => {
      const testPlugins = [
        createMockPlugin({
          name: 'api-docs-plugin',
          displayName: 'API Documentation',
          category: PluginCategory.DOCUMENTATION,
          tags: ['api', 'docs', 'swagger'],
          starCount: 45,
        }),
        createMockPlugin({
          name: 'monitoring-plugin',
          displayName: 'System Monitor',
          category: PluginCategory.MONITORING_OBSERVABILITY,
          tags: ['monitoring', 'health', 'metrics'],
          starCount: 42,
        }),
        createMockPlugin({
          name: 'security-plugin',
          displayName: 'Security Scanner',
          category: PluginCategory.SECURITY_COMPLIANCE,
          tags: ['security', 'vulnerability', 'scanning'],
          starCount: 48,
        }),
      ];

      for (const plugin of testPlugins) {
        await prisma.plugin.create({ data: plugin });
      }
    });

    it('should search plugins by display name', async () => {
      const results = await prisma.plugin.findMany({
        where: {
          displayName: { contains: 'API', mode: 'insensitive' },
        },
      });

      expect(results).toHaveLength(1);
      expect(results[0].displayName).toBe('API Documentation');
    });

    it('should filter plugins by category', async () => {
      const results = await prisma.plugin.findMany({
        where: { category: PluginCategory.MONITORING_OBSERVABILITY },
      });

      expect(results).toHaveLength(1);
      expect(results[0].category).toBe(PluginCategory.MONITORING_OBSERVABILITY);
    });

    it('should search plugins by tags', async () => {
      const results = await prisma.plugin.findMany({
        where: { tags: { has: 'security' } },
      });

      expect(results).toHaveLength(1);
      expect(results[0].tags).toContain('security');
    });
  });

  describe('Plugin Operations', () => {
    let testPlugin: { id: string };

    beforeEach(async () => {
      testPlugin = await prisma.plugin.create({ data: createMockPlugin() });
    });

    it('should create plugin operation records', async () => {
      const operation = await prisma.pluginOperation.create({
        data: createMockPluginOperation(testPlugin.id),
      });

      expect(operation.pluginId).toBe(testPlugin.id);
      expect(operation.operationType).toBe('INSTALL');
      expect(operation.status).toBe('COMPLETED');
    });
  });

  describe('Plugin Dependencies', () => {
    let basePlugin: { id: string };
    let dependentPlugin: { id: string };

    beforeEach(async () => {
      basePlugin = await prisma.plugin.create({ data: createMockPlugin({ name: 'base-plugin' }) });
      dependentPlugin = await prisma.plugin.create({
        data: createMockPlugin({ name: 'dependent-plugin' }),
      });
    });

    it('should create plugin dependency relationship', async () => {
      const dependency = await prisma.pluginDependency.create({
        data: {
          pluginId: dependentPlugin.id,
          dependsOnId: basePlugin.id,
          versionRange: '>=1.0.0',
        },
      });

      expect(dependency.pluginId).toBe(dependentPlugin.id);
      expect(dependency.dependsOnId).toBe(basePlugin.id);
    });

    it('should query plugin dependencies', async () => {
      await prisma.pluginDependency.create({
        data: {
          pluginId: dependentPlugin.id,
          dependsOnId: basePlugin.id,
          versionRange: '>=1.0.0',
        },
      });

      const pluginWithDependencies = await prisma.plugin.findUnique({
        where: { id: dependentPlugin.id },
        include: {
          pluginDependencies: {
            include: { dependsOn: true },
          },
        },
      });

      expect(pluginWithDependencies?.pluginDependencies).toHaveLength(1);
      expect(pluginWithDependencies?.pluginDependencies[0].dependsOn.id).toBe(basePlugin.id);
    });
  });

  describe('Database Security', () => {
    it('should prevent SQL injection in parameterized raw queries', async () => {
      const maliciousInput = "'; DROP TABLE plugins; --";

      const results = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint as count
        FROM plugins
        WHERE name = ${maliciousInput}
      `;

      expect(Array.isArray(results)).toBe(true);
      expect(await prisma.plugin.count()).toBeGreaterThanOrEqual(0);
    });

    it('should handle special characters in data', async () => {
      const specialCharsData = createMockPlugin({
        displayName: 'Plugin with \'quotes\' and "double quotes"',
        description: 'Description with <script>alert("xss")</script>',
        tags: ['tag with spaces', 'tag-with-dashes', 'tag_with_underscores'],
      });

      const plugin = await prisma.plugin.create({ data: specialCharsData });
      expect(plugin.displayName).toBe(specialCharsData.displayName);
      expect(plugin.description).toBe(specialCharsData.description);
      expect(plugin.tags).toEqual(specialCharsData.tags);
    });
  });
});
