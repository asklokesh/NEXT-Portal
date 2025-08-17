/**
 * Production API Endpoint Test Suite
 * Comprehensive testing for real database connections and enterprise SaaS features
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/testing-library/jest';
import { NextRequest } from 'next/server';
import { getDatabaseManager } from '@/lib/database/connection';
import { createTestUser, createTestTenant, cleanupTestData } from '../helpers/test-setup';

// Import the API routes
import { GET as getCatalogEntities } from '@/app/api/backstage/entities/route';
import { GET as getScaffolderTemplates } from '@/app/api/backstage/scaffolder/templates/route';
import { GET as getPluginHealth, POST as postPluginHealth } from '@/app/api/plugin-health/route';
import { GET as getPluginConfigs, POST as postPluginConfigs } from '@/app/api/plugins/[id]/configurations/route';

// Test context interface
interface TestContext {
  userId: string;
  tenantId: string;
  authToken: string;
  testData: {
    entities: any[];
    plugins: any[];
    configurations: any[];
  };
}

describe('Production API Endpoint Testing', () => {
  let testContext: TestContext;
  let dbManager: any;

  beforeAll(async () => {
    // Initialize database manager
    dbManager = getDatabaseManager();
    
    // Wait for database to be ready
    await waitForDatabase(dbManager, 30000);
    
    // Create test tenant and user
    const tenant = await createTestTenant('test-corp');
    const user = await createTestUser('test@testcorp.com', tenant.id);
    
    testContext = {
      userId: user.id,
      tenantId: tenant.id,
      authToken: `Bearer ${generateTestToken(user)}`,
      testData: {
        entities: [],
        plugins: [],
        configurations: []
      }
    };

    // Seed test data
    await seedTestData(testContext);
  });

  afterAll(async () => {
    await cleanupTestData(testContext.tenantId);
    await dbManager.close();
  });

  beforeEach(async () => {
    // Verify database connection before each test
    const isHealthy = await dbManager.performHealthCheck();
    if (!isHealthy) {
      throw new Error('Database is not healthy, aborting tests');
    }
  });

  describe('/api/backstage/entities', () => {
    test('should fetch catalog entities with valid authentication', async () => {
      const request = createTestRequest('/api/backstage/entities', {
        headers: {
          Authorization: testContext.authToken,
          'X-Tenant-ID': testContext.tenantId
        }
      });

      const startTime = Date.now();
      const response = await getCatalogEntities(request);
      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data).toHaveProperty('entities');
      expect(data).toHaveProperty('pagination');
      expect(data).toHaveProperty('meta');
      expect(Array.isArray(data.entities)).toBe(true);
      expect(data.meta.tenantId).toBe(testContext.tenantId);
      expect(duration).toBeLessThan(5000); // Performance threshold
    });

    test('should filter entities by kind parameter', async () => {
      const request = createTestRequest('/api/backstage/entities?kind=Component', {
        headers: {
          Authorization: testContext.authToken,
          'X-Tenant-ID': testContext.tenantId
        }
      });

      const response = await getCatalogEntities(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      data.entities.forEach((entity: any) => {
        expect(entity.kind).toBe('Component');
      });
    });

    test('should return 401 for unauthorized requests', async () => {
      const request = createTestRequest('/api/backstage/entities');

      const response = await getCatalogEntities(request);
      expect(response.status).toBe(401);
    });

    test('should handle database connection errors gracefully', async () => {
      // Simulate database connection failure
      jest.spyOn(dbManager, 'executeQuery').mockRejectedValueOnce(
        new Error('P1001: Can\'t reach database server')
      );

      const request = createTestRequest('/api/backstage/entities', {
        headers: {
          Authorization: testContext.authToken,
          'X-Tenant-ID': testContext.tenantId
        }
      });

      const response = await getCatalogEntities(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.code).toBe('DATABASE_CONNECTION_ERROR');
      expect(data.entities).toEqual([]);
    });

    test('should enforce tenant isolation', async () => {
      // Create a different tenant
      const otherTenant = await createTestTenant('other-corp');
      
      const request = createTestRequest('/api/backstage/entities', {
        headers: {
          Authorization: testContext.authToken,
          'X-Tenant-ID': otherTenant.id
        }
      });

      const response = await getCatalogEntities(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Should return empty results for other tenant
      expect(data.entities.length).toBe(0);
      
      await cleanupTestData(otherTenant.id);
    });

    test('should handle pagination correctly', async () => {
      const request = createTestRequest('/api/backstage/entities?limit=5&offset=0', {
        headers: {
          Authorization: testContext.authToken,
          'X-Tenant-ID': testContext.tenantId
        }
      });

      const response = await getCatalogEntities(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination.limit).toBe(5);
      expect(data.pagination.offset).toBe(0);
      expect(data.entities.length).toBeLessThanOrEqual(5);
    });
  });

  describe('/api/backstage/scaffolder/templates', () => {
    test('should fetch templates from real Backstage API', async () => {
      const request = createTestRequest('/api/backstage/scaffolder/templates');

      const startTime = Date.now();
      const response = await getScaffolderTemplates(request);
      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data).toHaveProperty('items');
      expect(Array.isArray(data.items)).toBe(true);
      expect(duration).toBeLessThan(10000); // API call threshold
    });

    test('should fallback to curated templates when Backstage API is unavailable', async () => {
      // Mock fetch to simulate API failure
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const request = createTestRequest('/api/backstage/scaffolder/templates');
      const response = await getScaffolderTemplates(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.items.length).toBeGreaterThan(0);
      expect(data.items[0]).toHaveProperty('kind', 'Template');

      global.fetch = originalFetch;
    });

    test('should validate template structure', async () => {
      const request = createTestRequest('/api/backstage/scaffolder/templates');
      const response = await getScaffolderTemplates(request);
      const data = await response.json();

      data.items.forEach((template: any) => {
        expect(template).toHaveProperty('apiVersion');
        expect(template).toHaveProperty('kind', 'Template');
        expect(template).toHaveProperty('metadata');
        expect(template).toHaveProperty('spec');
        expect(template.metadata).toHaveProperty('name');
        expect(template.spec).toHaveProperty('type');
      });
    });
  });

  describe('/api/plugin-health', () => {
    test('should return plugin health summary', async () => {
      const request = createTestRequest('/api/plugin-health?action=summary');

      const response = await getPluginHealth(request);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data).toHaveProperty('summary');
    });

    test('should return specific plugin health data', async () => {
      const pluginId = 'test-plugin-1';
      const request = createTestRequest(`/api/plugin-health?pluginId=${pluginId}`);

      const response = await getPluginHealth(request);
      
      if (response.status === 404) {
        const data = await response.json();
        expect(data.error).toBe('Plugin not found');
      } else {
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data).toHaveProperty('plugin');
      }
    });

    test('should filter plugins by status and health', async () => {
      const request = createTestRequest('/api/plugin-health?status=running&health=healthy');

      const response = await getPluginHealth(request);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data).toHaveProperty('plugins');
      expect(data).toHaveProperty('total');
    });

    test('should handle plugin actions via POST', async () => {
      const requestBody = {
        pluginId: 'test-plugin',
        action: 'restart',
        configuration: {}
      };

      const request = createTestRequest('/api/plugin-health', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await postPluginHealth(request);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('message');
    });
  });

  describe('/api/plugins/[id]/configurations', () => {
    const testPluginId = 'test-plugin-config';

    test('should fetch plugin configurations with authentication', async () => {
      const request = createTestRequest(`/api/plugins/${testPluginId}/configurations`, {
        headers: {
          Authorization: testContext.authToken,
          'X-Tenant-ID': testContext.tenantId
        }
      });

      const response = await getPluginConfigs(request, { params: { id: testPluginId } });
      
      if (response.status === 404) {
        const data = await response.json();
        expect(data.error).toBe('Plugin not found');
      } else {
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data).toHaveProperty('configurations');
        expect(data).toHaveProperty('plugin');
      }
    });

    test('should create plugin configuration', async () => {
      const configData = {
        configuration: {
          name: 'Test Configuration',
          description: 'Test configuration for plugin',
          schema: {
            type: 'object',
            properties: {
              apiKey: { type: 'string' },
              timeout: { type: 'number' }
            }
          },
          values: {
            apiKey: 'test-key',
            timeout: 5000
          },
          version: '1.0.0'
        },
        environment: 'development'
      };

      const request = createTestRequest(`/api/plugins/${testPluginId}/configurations`, {
        method: 'POST',
        headers: {
          Authorization: testContext.authToken,
          'X-Tenant-ID': testContext.tenantId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(configData)
      });

      const response = await postPluginConfigs(request, { params: { id: testPluginId } });
      
      // Should either succeed or fail with plugin not found
      expect([200, 404]).toContain(response.status);
    });

    test('should validate required fields for configuration creation', async () => {
      const invalidConfigData = {
        configuration: {},
        environment: 'development'
      };

      const request = createTestRequest(`/api/plugins/${testPluginId}/configurations`, {
        method: 'POST',
        headers: {
          Authorization: testContext.authToken,
          'X-Tenant-ID': testContext.tenantId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(invalidConfigData)
      });

      const response = await postPluginConfigs(request, { params: { id: testPluginId } });
      expect(response.status).toBe(400);
    });

    test('should enforce permission checks', async () => {
      const request = createTestRequest(`/api/plugins/${testPluginId}/configurations`);

      const response = await getPluginConfigs(request, { params: { id: testPluginId } });
      expect(response.status).toBe(401);
    });

    test('should handle invalid plugin IDs', async () => {
      const invalidIds = ['undefined', 'null', ''];
      
      for (const invalidId of invalidIds) {
        const request = createTestRequest(`/api/plugins/${invalidId}/configurations`, {
          headers: {
            Authorization: testContext.authToken,
            'X-Tenant-ID': testContext.tenantId
          }
        });

        const response = await getPluginConfigs(request, { params: { id: invalidId } });
        expect(response.status).toBe(400);
      }
    });
  });

  describe('Performance and Load Testing', () => {
    test('should handle concurrent requests to catalog entities', async () => {
      const concurrentRequests = 10;
      const promises = Array.from({ length: concurrentRequests }, () => {
        const request = createTestRequest('/api/backstage/entities', {
          headers: {
            Authorization: testContext.authToken,
            'X-Tenant-ID': testContext.tenantId
          }
        });
        return getCatalogEntities(request);
      });

      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const duration = Date.now() - startTime;

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      // Should handle 10 concurrent requests within reasonable time
      expect(duration).toBeLessThan(10000);
    });

    test('should maintain database connection pool under load', async () => {
      const metrics = dbManager.getMetrics();
      const initialMetrics = { ...metrics };

      // Generate load
      const requests = Array.from({ length: 20 }, () => {
        const request = createTestRequest('/api/backstage/entities', {
          headers: {
            Authorization: testContext.authToken,
            'X-Tenant-ID': testContext.tenantId
          }
        });
        return getCatalogEntities(request);
      });

      await Promise.all(requests);

      const finalMetrics = dbManager.getMetrics();
      expect(finalMetrics.isHealthy).toBe(true);
      expect(finalMetrics.totalQueries).toBeGreaterThan(initialMetrics.totalQueries);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle database timeout scenarios', async () => {
      // Mock slow database query
      jest.spyOn(dbManager, 'executeQuery').mockImplementationOnce(
        () => new Promise(resolve => setTimeout(resolve, 35000)) // Exceed timeout
      );

      const request = createTestRequest('/api/backstage/entities', {
        headers: {
          Authorization: testContext.authToken,
          'X-Tenant-ID': testContext.tenantId
        }
      });

      const response = await getCatalogEntities(request);
      expect([500, 503]).toContain(response.status);
    });

    test('should recover from temporary database failures', async () => {
      // First call fails
      jest.spyOn(dbManager, 'executeQuery').mockRejectedValueOnce(
        new Error('Connection lost')
      );

      const request1 = createTestRequest('/api/backstage/entities', {
        headers: {
          Authorization: testContext.authToken,
          'X-Tenant-ID': testContext.tenantId
        }
      });

      const response1 = await getCatalogEntities(request1);
      expect(response1.status).toBe(500);

      // Second call should succeed (mock restored)
      const request2 = createTestRequest('/api/backstage/entities', {
        headers: {
          Authorization: testContext.authToken,
          'X-Tenant-ID': testContext.tenantId
        }
      });

      const response2 = await getCatalogEntities(request2);
      expect(response2.status).toBe(200);
    });
  });
});

// Helper functions
async function waitForDatabase(dbManager: any, timeout: number): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      const isHealthy = await dbManager.performHealthCheck();
      if (isHealthy) return;
    } catch (error) {
      // Continue waiting
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Database failed to become ready within timeout');
}

function createTestRequest(url: string, options: any = {}): NextRequest {
  const { method = 'GET', headers = {}, body } = options;
  
  return new NextRequest(new Request(`http://localhost:3000${url}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body
  }));
}

async function seedTestData(context: TestContext): Promise<void> {
  const db = await getDatabaseManager().getConnection();
  
  try {
    // Create test catalog entities
    const entities = [
      {
        id: 'test-entity-1',
        name: 'test-service-1',
        kind: 'Component',
        namespace: 'default',
        type: 'service',
        lifecycle: 'production',
        owner: 'platform-team',
        tenantId: context.tenantId,
        spec: { type: 'service', lifecycle: 'production', owner: 'platform-team' },
        status: { health: 'healthy' },
        metadata: { name: 'test-service-1', namespace: 'default' }
      },
      {
        id: 'test-entity-2',
        name: 'test-website-1',
        kind: 'Component',
        namespace: 'default',
        type: 'website',
        lifecycle: 'production',
        owner: 'frontend-team',
        tenantId: context.tenantId,
        spec: { type: 'website', lifecycle: 'production', owner: 'frontend-team' },
        status: { health: 'healthy' },
        metadata: { name: 'test-website-1', namespace: 'default' }
      }
    ];

    for (const entity of entities) {
      await db.catalogEntity.upsert({
        where: { id: entity.id },
        create: entity,
        update: entity
      });
    }

    // Create test plugins
    const plugins = [
      {
        id: 'test-plugin-1',
        name: 'test-plugin-1',
        displayName: 'Test Plugin 1',
        version: '1.0.0',
        tenantId: context.tenantId,
        status: 'ACTIVE',
        category: 'monitoring'
      }
    ];

    for (const plugin of plugins) {
      await db.plugin.upsert({
        where: { id: plugin.id },
        create: plugin,
        update: plugin
      });
    }

    context.testData.entities = entities;
    context.testData.plugins = plugins;
  } finally {
    await getDatabaseManager().releaseConnection(db);
  }
}

function generateTestToken(user: any): string {
  // In a real implementation, this would generate a proper JWT token
  return `test-token-${user.id}`;
}