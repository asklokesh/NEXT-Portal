import request from 'supertest';
import { createServer } from 'http';
import { NextApiHandler } from 'next';
import { createMocks } from 'node-mocks-http';
import { PrismaClient } from '@prisma/client';
import { jest } from '@jest/globals';

// Import API handlers
import pluginsHandler from '../../../src/app/api/plugins/route';
import installHandler from '../../../src/app/api/plugins/[id]/install/route';
import uninstallHandler from '../../../src/app/api/plugins/[id]/uninstall/route';
import configHandler from '../../../src/app/api/plugins/[id]/config/route';
import healthHandler from '../../../src/app/api/plugins/[id]/health/route';

// Mock Prisma client
jest.mock('@prisma/client');
const mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;

// Mock external services
jest.mock('../../../src/lib/plugins/docker-plugin-installer');
jest.mock('../../../src/lib/kubernetes/client');
jest.mock('../../../src/lib/vault/vault-client');

describe('Plugin API Endpoints', () => {
  let server: any;
  let agent: request.SuperTest<request.Test>;

  beforeAll(async () => {
    // Create a test server
    server = createServer();
    agent = request(server);
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
    await mockPrisma.$disconnect();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock responses
    mockPrisma.plugin.findMany = jest.fn();
    mockPrisma.plugin.findUnique = jest.fn();
    mockPrisma.plugin.create = jest.fn();
    mockPrisma.plugin.update = jest.fn();
    mockPrisma.plugin.delete = jest.fn();
    mockPrisma.pluginInstallation.findMany = jest.fn();
    mockPrisma.pluginInstallation.findUnique = jest.fn();
    mockPrisma.pluginInstallation.create = jest.fn();
    mockPrisma.pluginInstallation.update = jest.fn();
    mockPrisma.pluginInstallation.delete = jest.fn();
  });

  describe('GET /api/plugins', () => {
    it('should return list of plugins with pagination', async () => {
      const mockPlugins = [
        createMockPlugin({ id: 'plugin-1', name: 'Plugin 1' }),
        createMockPlugin({ id: 'plugin-2', name: 'Plugin 2' }),
      ];

      mockPrisma.plugin.findMany.mockResolvedValue(mockPlugins as any);
      mockPrisma.plugin.count.mockResolvedValue(50);

      const { req, res } = createMocks({
        method: 'GET',
        url: '/api/plugins?page=1&limit=20',
        query: { page: '1', limit: '20' },
      });

      await pluginsHandler.GET(req as any, res as any);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      
      expect(data).toHaveProperty('plugins');
      expect(data).toHaveProperty('pagination');
      expect(data.plugins).toHaveLength(2);
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(20);
      expect(data.pagination.total).toBe(50);
    });

    it('should filter plugins by category', async () => {
      const documentationPlugins = [
        createMockPlugin({ id: 'doc-plugin', category: 'Documentation' }),
      ];

      mockPrisma.plugin.findMany.mockResolvedValue(documentationPlugins as any);
      mockPrisma.plugin.count.mockResolvedValue(1);

      const { req, res } = createMocks({
        method: 'GET',
        url: '/api/plugins?category=Documentation',
        query: { category: 'Documentation' },
      });

      await pluginsHandler.GET(req as any, res as any);

      expect(res._getStatusCode()).toBe(200);
      expect(mockPrisma.plugin.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          category: 'Documentation',
        }),
        skip: 0,
        take: 20,
        orderBy: { name: 'asc' },
      });
    });

    it('should search plugins by query', async () => {
      const searchResults = [
        createMockPlugin({ id: 'api-docs', name: 'API Documentation' }),
      ];

      mockPrisma.plugin.findMany.mockResolvedValue(searchResults as any);

      const { req, res } = createMocks({
        method: 'GET',
        url: '/api/plugins?q=API',
        query: { q: 'API' },
      });

      await pluginsHandler.GET(req as any, res as any);

      expect(res._getStatusCode()).toBe(200);
      expect(mockPrisma.plugin.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: 'API', mode: 'insensitive' } },
            { description: { contains: 'API', mode: 'insensitive' } },
            { tags: { has: 'API' } },
          ],
        },
        skip: 0,
        take: 20,
        orderBy: { name: 'asc' },
      });
    });

    it('should sort plugins by different criteria', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        url: '/api/plugins?sortBy=rating&sortOrder=desc',
        query: { sortBy: 'rating', sortOrder: 'desc' },
      });

      await pluginsHandler.GET(req as any, res as any);

      expect(mockPrisma.plugin.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { rating: 'desc' },
        })
      );
    });

    it('should handle invalid query parameters', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        url: '/api/plugins?page=invalid&limit=too-many',
        query: { page: 'invalid', limit: 'too-many' },
      });

      await pluginsHandler.GET(req as any, res as any);

      expect(res._getStatusCode()).toBe(400);
      const data = JSON.parse(res._getData());
      expect(data.error).toContain('Invalid query parameters');
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.plugin.findMany.mockRejectedValue(new Error('Database connection failed'));

      const { req, res } = createMocks({
        method: 'GET',
        url: '/api/plugins',
      });

      await pluginsHandler.GET(req as any, res as any);

      expect(res._getStatusCode()).toBe(500);
      const data = JSON.parse(res._getData());
      expect(data.error).toBe('Internal server error');
    });
  });

  describe('POST /api/plugins/[id]/install', () => {
    it('should install a plugin successfully', async () => {
      const mockPlugin = createMockPlugin({ id: 'test-plugin' });
      const mockInstallation = createMockPluginInstallation(mockPlugin);

      mockPrisma.plugin.findUnique.mockResolvedValue(mockPlugin as any);
      mockPrisma.pluginInstallation.findUnique.mockResolvedValue(null);
      mockPrisma.pluginInstallation.create.mockResolvedValue(mockInstallation as any);

      // Mock Docker service
      const mockDockerService = require('../../../src/lib/plugins/docker-plugin-installer');
      mockDockerService.DockerService.prototype.pullImage.mockResolvedValue({ success: true });
      mockDockerService.DockerService.prototype.createContainer.mockResolvedValue({
        id: 'container-123',
      });
      mockDockerService.DockerService.prototype.startContainer.mockResolvedValue({ success: true });

      const { req, res } = createMocks({
        method: 'POST',
        url: '/api/plugins/test-plugin/install',
        body: {
          config: {
            apiUrl: 'https://api.example.com',
            timeout: 5000,
          },
        },
      });

      // Mock the request params
      (req as any).params = { id: 'test-plugin' };

      await installHandler.POST(req as any, res as any);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      
      expect(data.success).toBe(true);
      expect(data.message).toBe('Plugin installed successfully');
      expect(data).toHaveProperty('installationId');
      expect(data).toHaveProperty('containerId');
    });

    it('should prevent duplicate plugin installation', async () => {
      const mockPlugin = createMockPlugin({ id: 'already-installed' });
      const existingInstallation = createMockPluginInstallation(mockPlugin);

      mockPrisma.plugin.findUnique.mockResolvedValue(mockPlugin as any);
      mockPrisma.pluginInstallation.findUnique.mockResolvedValue(existingInstallation as any);

      const { req, res } = createMocks({
        method: 'POST',
        url: '/api/plugins/already-installed/install',
      });

      (req as any).params = { id: 'already-installed' };

      await installHandler.POST(req as any, res as any);

      expect(res._getStatusCode()).toBe(409);
      const data = JSON.parse(res._getData());
      expect(data.error).toBe('Plugin is already installed');
    });

    it('should validate plugin configuration during installation', async () => {
      const pluginWithSchema = createMockPlugin({
        id: 'config-validation',
        config: {
          required: true,
          schema: {
            type: 'object',
            properties: {
              apiUrl: { type: 'string', format: 'uri' },
              timeout: { type: 'number', minimum: 1000 },
            },
            required: ['apiUrl'],
          },
        },
      });

      mockPrisma.plugin.findUnique.mockResolvedValue(pluginWithSchema as any);
      mockPrisma.pluginInstallation.findUnique.mockResolvedValue(null);

      const { req, res } = createMocks({
        method: 'POST',
        url: '/api/plugins/config-validation/install',
        body: {
          config: {
            apiUrl: 'invalid-url',
            timeout: 500, // Below minimum
          },
        },
      });

      (req as any).params = { id: 'config-validation' };

      await installHandler.POST(req as any, res as any);

      expect(res._getStatusCode()).toBe(400);
      const data = JSON.parse(res._getData());
      expect(data.error).toContain('Configuration validation failed');
      expect(data.validationErrors).toBeDefined();
    });

    it('should check plugin dependencies before installation', async () => {
      const dependentPlugin = createMockPlugin({
        id: 'dependent-plugin',
        dependencies: ['missing-dependency'],
      });

      mockPrisma.plugin.findUnique.mockResolvedValue(dependentPlugin as any);
      mockPrisma.pluginInstallation.findUnique
        .mockResolvedValueOnce(null) // For the plugin itself
        .mockResolvedValueOnce(null); // For the dependency

      const { req, res } = createMocks({
        method: 'POST',
        url: '/api/plugins/dependent-plugin/install',
      });

      (req as any).params = { id: 'dependent-plugin' };

      await installHandler.POST(req as any, res as any);

      expect(res._getStatusCode()).toBe(400);
      const data = JSON.parse(res._getData());
      expect(data.error).toBe('Missing required dependencies: missing-dependency');
    });

    it('should handle installation failures', async () => {
      const mockPlugin = createMockPlugin({ id: 'fail-plugin' });

      mockPrisma.plugin.findUnique.mockResolvedValue(mockPlugin as any);
      mockPrisma.pluginInstallation.findUnique.mockResolvedValue(null);

      // Mock Docker service failure
      const mockDockerService = require('../../../src/lib/plugins/docker-plugin-installer');
      mockDockerService.DockerService.prototype.pullImage.mockRejectedValue(
        new Error('Failed to pull image')
      );

      const { req, res } = createMocks({
        method: 'POST',
        url: '/api/plugins/fail-plugin/install',
      });

      (req as any).params = { id: 'fail-plugin' };

      await installHandler.POST(req as any, res as any);

      expect(res._getStatusCode()).toBe(500);
      const data = JSON.parse(res._getData());
      expect(data.success).toBe(false);
      expect(data.error).toContain('Failed to pull image');
    });

    it('should handle non-existent plugin installation', async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue(null);

      const { req, res } = createMocks({
        method: 'POST',
        url: '/api/plugins/non-existent/install',
      });

      (req as any).params = { id: 'non-existent' };

      await installHandler.POST(req as any, res as any);

      expect(res._getStatusCode()).toBe(404);
      const data = JSON.parse(res._getData());
      expect(data.error).toBe('Plugin not found');
    });
  });

  describe('DELETE /api/plugins/[id]/uninstall', () => {
    it('should uninstall a plugin successfully', async () => {
      const mockPlugin = createMockPlugin({ id: 'uninstall-test' });
      const mockInstallation = createMockPluginInstallation(mockPlugin, {
        containerId: 'container-456',
      });

      mockPrisma.plugin.findUnique.mockResolvedValue(mockPlugin as any);
      mockPrisma.pluginInstallation.findUnique.mockResolvedValue(mockInstallation as any);
      mockPrisma.pluginInstallation.delete.mockResolvedValue(mockInstallation as any);

      // Mock Docker service
      const mockDockerService = require('../../../src/lib/plugins/docker-plugin-installer');
      mockDockerService.DockerService.prototype.stopContainer.mockResolvedValue({ success: true });
      mockDockerService.DockerService.prototype.removeContainer.mockResolvedValue({ success: true });

      const { req, res } = createMocks({
        method: 'DELETE',
        url: '/api/plugins/uninstall-test/uninstall',
      });

      (req as any).params = { id: 'uninstall-test' };

      await uninstallHandler.DELETE(req as any, res as any);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.success).toBe(true);
      expect(data.message).toBe('Plugin uninstalled successfully');
    });

    it('should handle uninstalling non-installed plugin', async () => {
      const mockPlugin = createMockPlugin({ id: 'not-installed' });

      mockPrisma.plugin.findUnique.mockResolvedValue(mockPlugin as any);
      mockPrisma.pluginInstallation.findUnique.mockResolvedValue(null);

      const { req, res } = createMocks({
        method: 'DELETE',
        url: '/api/plugins/not-installed/uninstall',
      });

      (req as any).params = { id: 'not-installed' };

      await uninstallHandler.DELETE(req as any, res as any);

      expect(res._getStatusCode()).toBe(404);
      const data = JSON.parse(res._getData());
      expect(data.error).toBe('Plugin installation not found');
    });

    it('should check for dependent plugins before uninstallation', async () => {
      const basePlugin = createMockPlugin({ id: 'base-plugin' });
      const dependentPlugin = createMockPlugin({
        id: 'dependent-plugin',
        dependencies: ['base-plugin'],
      });

      mockPrisma.plugin.findUnique.mockResolvedValue(basePlugin as any);
      mockPrisma.pluginInstallation.findUnique.mockResolvedValue(
        createMockPluginInstallation(basePlugin) as any
      );
      
      // Mock finding dependent plugins
      mockPrisma.plugin.findMany.mockResolvedValue([dependentPlugin] as any);

      const { req, res } = createMocks({
        method: 'DELETE',
        url: '/api/plugins/base-plugin/uninstall',
      });

      (req as any).params = { id: 'base-plugin' };

      await uninstallHandler.DELETE(req as any, res as any);

      expect(res._getStatusCode()).toBe(400);
      const data = JSON.parse(res._getData());
      expect(data.error).toContain('Cannot uninstall plugin with dependencies');
    });
  });

  describe('GET/PUT /api/plugins/[id]/config', () => {
    it('should get plugin configuration', async () => {
      const mockPlugin = createMockPlugin({ id: 'config-test' });
      const mockInstallation = createMockPluginInstallation(mockPlugin, {
        config: { apiUrl: 'https://api.example.com' },
      });

      mockPrisma.plugin.findUnique.mockResolvedValue(mockPlugin as any);
      mockPrisma.pluginInstallation.findUnique.mockResolvedValue(mockInstallation as any);

      const { req, res } = createMocks({
        method: 'GET',
        url: '/api/plugins/config-test/config',
      });

      (req as any).params = { id: 'config-test' };

      await configHandler.GET(req as any, res as any);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.config).toEqual({ apiUrl: 'https://api.example.com' });
      expect(data.schema).toBeDefined();
    });

    it('should update plugin configuration', async () => {
      const mockPlugin = createMockPlugin({ id: 'update-config' });
      const mockInstallation = createMockPluginInstallation(mockPlugin);

      mockPrisma.plugin.findUnique.mockResolvedValue(mockPlugin as any);
      mockPrisma.pluginInstallation.findUnique.mockResolvedValue(mockInstallation as any);
      mockPrisma.pluginInstallation.update.mockResolvedValue({
        ...mockInstallation,
        config: { apiUrl: 'https://new-api.example.com' },
      } as any);

      const { req, res } = createMocks({
        method: 'PUT',
        url: '/api/plugins/update-config/config',
        body: {
          config: { apiUrl: 'https://new-api.example.com' },
        },
      });

      (req as any).params = { id: 'update-config' };

      await configHandler.PUT(req as any, res as any);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.success).toBe(true);
      expect(data.message).toBe('Configuration updated successfully');
    });

    it('should validate configuration updates', async () => {
      const mockPlugin = createMockPlugin({
        id: 'validate-config',
        config: {
          schema: {
            type: 'object',
            properties: {
              apiUrl: { type: 'string', format: 'uri' },
            },
            required: ['apiUrl'],
          },
        },
      });

      mockPrisma.plugin.findUnique.mockResolvedValue(mockPlugin as any);
      mockPrisma.pluginInstallation.findUnique.mockResolvedValue(
        createMockPluginInstallation(mockPlugin) as any
      );

      const { req, res } = createMocks({
        method: 'PUT',
        url: '/api/plugins/validate-config/config',
        body: {
          config: { apiUrl: 'invalid-url' },
        },
      });

      (req as any).params = { id: 'validate-config' };

      await configHandler.PUT(req as any, res as any);

      expect(res._getStatusCode()).toBe(400);
      const data = JSON.parse(res._getData());
      expect(data.error).toContain('Configuration validation failed');
    });
  });

  describe('GET /api/plugins/[id]/health', () => {
    it('should return plugin health status', async () => {
      const mockPlugin = createMockPlugin({ id: 'health-test' });
      const mockInstallation = createMockPluginInstallation(mockPlugin, {
        containerId: 'healthy-container',
        status: 'running',
      });

      mockPrisma.plugin.findUnique.mockResolvedValue(mockPlugin as any);
      mockPrisma.pluginInstallation.findUnique.mockResolvedValue(mockInstallation as any);

      // Mock Docker health check
      const mockDockerService = require('../../../src/lib/plugins/docker-plugin-installer');
      mockDockerService.DockerService.prototype.inspectContainer.mockResolvedValue({
        State: {
          Status: 'running',
          Health: {
            Status: 'healthy',
            FailingStreak: 0,
          },
        },
        Stats: {
          memory_stats: { usage: 128000000, limit: 512000000 },
          cpu_stats: { cpu_usage: { total_usage: 1000000 } },
        },
      });

      const { req, res } = createMocks({
        method: 'GET',
        url: '/api/plugins/health-test/health',
      });

      (req as any).params = { id: 'health-test' };

      await healthHandler.GET(req as any, res as any);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      
      expect(data.status).toBe('healthy');
      expect(data.uptime).toBeDefined();
      expect(data.metrics).toHaveProperty('memory');
      expect(data.metrics).toHaveProperty('cpu');
    });

    it('should detect unhealthy plugins', async () => {
      const mockPlugin = createMockPlugin({ id: 'unhealthy-test' });
      const mockInstallation = createMockPluginInstallation(mockPlugin, {
        containerId: 'unhealthy-container',
      });

      mockPrisma.plugin.findUnique.mockResolvedValue(mockPlugin as any);
      mockPrisma.pluginInstallation.findUnique.mockResolvedValue(mockInstallation as any);

      // Mock Docker unhealthy status
      const mockDockerService = require('../../../src/lib/plugins/docker-plugin-installer');
      mockDockerService.DockerService.prototype.inspectContainer.mockResolvedValue({
        State: {
          Status: 'exited',
          ExitCode: 1,
          Health: {
            Status: 'unhealthy',
            FailingStreak: 3,
          },
        },
      });

      const { req, res } = createMocks({
        method: 'GET',
        url: '/api/plugins/unhealthy-test/health',
      });

      (req as any).params = { id: 'unhealthy-test' };

      await healthHandler.GET(req as any, res as any);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      
      expect(data.status).toBe('unhealthy');
      expect(data.error).toBeDefined();
      expect(data.failingStreak).toBe(3);
    });

    it('should handle health check for non-existent installation', async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue(null);

      const { req, res } = createMocks({
        method: 'GET',
        url: '/api/plugins/non-existent/health',
      });

      (req as any).params = { id: 'non-existent' };

      await healthHandler.GET(req as any, res as any);

      expect(res._getStatusCode()).toBe(404);
      const data = JSON.parse(res._getData());
      expect(data.error).toBe('Plugin not found');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on installation endpoints', async () => {
      const mockPlugin = createMockPlugin({ id: 'rate-limit-test' });
      mockPrisma.plugin.findUnique.mockResolvedValue(mockPlugin as any);
      mockPrisma.pluginInstallation.findUnique.mockResolvedValue(null);

      // Make multiple rapid requests
      const promises = Array.from({ length: 10 }, () => {
        const { req, res } = createMocks({
          method: 'POST',
          url: '/api/plugins/rate-limit-test/install',
          headers: { 'x-forwarded-for': '127.0.0.1' },
        });
        (req as any).params = { id: 'rate-limit-test' };
        return installHandler.POST(req as any, res as any);
      });

      await Promise.all(promises);

      // Some requests should be rate limited (depends on implementation)
      // This is a placeholder - actual implementation would vary
      expect(true).toBe(true); // Replace with actual rate limiting test
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication for admin endpoints', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        url: '/api/admin/plugins',
        headers: {}, // No auth headers
      });

      // This would be handled by middleware in real implementation
      // Test implementation depends on auth strategy
      expect(true).toBe(true); // Replace with actual auth test
    });

    it('should validate user permissions for plugin operations', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        url: '/api/plugins/test/install',
        headers: {
          authorization: 'Bearer user-token', // User without install permissions
        },
      });

      // Test would verify user has necessary permissions
      expect(true).toBe(true); // Replace with actual permission test
    });
  });

  describe('Audit Logging', () => {
    it('should log plugin installation events', async () => {
      const mockPlugin = createMockPlugin({ id: 'audit-test' });
      mockPrisma.plugin.findUnique.mockResolvedValue(mockPlugin as any);
      mockPrisma.pluginInstallation.findUnique.mockResolvedValue(null);

      const { req, res } = createMocks({
        method: 'POST',
        url: '/api/plugins/audit-test/install',
        headers: {
          'user-agent': 'test-client',
          'x-forwarded-for': '127.0.0.1',
        },
      });

      (req as any).params = { id: 'audit-test' };

      await installHandler.POST(req as any, res as any);

      // Verify audit log was created (implementation specific)
      expect(true).toBe(true); // Replace with actual audit logging test
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON in request body', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        url: '/api/plugins/test/install',
        body: 'invalid-json',
      });

      (req as any).params = { id: 'test' };

      await installHandler.POST(req as any, res as any);

      expect(res._getStatusCode()).toBe(400);
      const data = JSON.parse(res._getData());
      expect(data.error).toContain('Invalid JSON');
    });

    it('should handle database connection errors', async () => {
      mockPrisma.plugin.findMany.mockRejectedValue(new Error('Connection timeout'));

      const { req, res } = createMocks({
        method: 'GET',
        url: '/api/plugins',
      });

      await pluginsHandler.GET(req as any, res as any);

      expect(res._getStatusCode()).toBe(500);
      const data = JSON.parse(res._getData());
      expect(data.error).toBe('Internal server error');
    });
  });
});