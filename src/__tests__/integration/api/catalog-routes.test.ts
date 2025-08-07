/**
 * Catalog API Routes Integration Tests
 * Tests all catalog-related API endpoints
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { createMocks } from 'node-mocks-http';
import type { NextApiRequest, NextApiResponse } from 'next';

// Mock Next.js runtime
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('Catalog API Routes', () => {
  let authToken: string;

  beforeAll(async () => {
    // Setup test database connection
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_SECRET = 'test-secret';
    
    // Get auth token for tests
    authToken = 'Bearer test-jwt-token';
  });

  afterAll(async () => {
    // Cleanup
    jest.clearAllMocks();
  });

  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('GET /api/catalog/entities', () => {
    it('should return all catalog entities', async () => {
      const response = await fetch('/api/catalog/entities', {
        headers: { Authorization: authToken },
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('entities');
      expect(Array.isArray(data.entities)).toBe(true);
      expect(data).toHaveProperty('totalCount');
      expect(data).toHaveProperty('pageInfo');
    });

    it('should filter entities by kind', async () => {
      const response = await fetch('/api/catalog/entities?kind=Component', {
        headers: { Authorization: authToken },
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.entities.every((e: any) => e.kind === 'Component')).toBe(true);
    });

    it('should filter entities by namespace', async () => {
      const response = await fetch('/api/catalog/entities?namespace=default', {
        headers: { Authorization: authToken },
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.entities.every((e: any) => e.metadata.namespace === 'default')).toBe(true);
    });

    it('should paginate results', async () => {
      const response = await fetch('/api/catalog/entities?limit=10&offset=20', {
        headers: { Authorization: authToken },
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.entities.length).toBeLessThanOrEqual(10);
      expect(data.pageInfo.offset).toBe(20);
      expect(data.pageInfo.limit).toBe(10);
    });

    it('should search entities by text', async () => {
      const response = await fetch('/api/catalog/entities?search=backend', {
        headers: { Authorization: authToken },
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.entities.length).toBeGreaterThan(0);
    });

    it('should require authentication', async () => {
      const response = await fetch('/api/catalog/entities');
      
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/catalog/entities/[uid]', () => {
    it('should return a specific entity by UID', async () => {
      const uid = 'component:default/example-service';
      const response = await fetch(`/api/catalog/entities/${uid}`, {
        headers: { Authorization: authToken },
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.metadata.uid).toBe(uid);
      expect(data).toHaveProperty('apiVersion');
      expect(data).toHaveProperty('kind');
      expect(data).toHaveProperty('metadata');
      expect(data).toHaveProperty('spec');
    });

    it('should return 404 for non-existent entity', async () => {
      const response = await fetch('/api/catalog/entities/non-existent', {
        headers: { Authorization: authToken },
      });

      expect(response.status).toBe(404);
    });

    it('should include relations if requested', async () => {
      const uid = 'component:default/example-service';
      const response = await fetch(`/api/catalog/entities/${uid}?includeRelations=true`, {
        headers: { Authorization: authToken },
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('relations');
      expect(Array.isArray(data.relations)).toBe(true);
    });
  });

  describe('POST /api/catalog/entities', () => {
    it('should create a new entity', async () => {
      const newEntity = {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'test-service',
          namespace: 'default',
          description: 'Test service for integration tests',
        },
        spec: {
          type: 'service',
          lifecycle: 'production',
          owner: 'team-a',
        },
      };

      const response = await fetch('/api/catalog/entities', {
        method: 'POST',
        headers: {
          Authorization: authToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newEntity),
      });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.metadata.name).toBe('test-service');
      expect(data.metadata.uid).toBeDefined();
    });

    it('should validate entity schema', async () => {
      const invalidEntity = {
        kind: 'Component',
        // Missing required fields
      };

      const response = await fetch('/api/catalog/entities', {
        method: 'POST',
        headers: {
          Authorization: authToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidEntity),
      });

      expect(response.status).toBe(400);
      const error = await response.json();
      expect(error.message).toContain('validation');
    });

    it('should prevent duplicate entities', async () => {
      const entity = {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'duplicate-service',
          namespace: 'default',
        },
        spec: {
          type: 'service',
          lifecycle: 'production',
          owner: 'team-a',
        },
      };

      // First creation should succeed
      await fetch('/api/catalog/entities', {
        method: 'POST',
        headers: {
          Authorization: authToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entity),
      });

      // Second creation should fail
      const response = await fetch('/api/catalog/entities', {
        method: 'POST',
        headers: {
          Authorization: authToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entity),
      });

      expect(response.status).toBe(409);
    });

    it('should check write permissions', async () => {
      const readOnlyToken = 'Bearer read-only-token';
      const entity = {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: { name: 'test', namespace: 'default' },
        spec: { type: 'service', lifecycle: 'production', owner: 'team-a' },
      };

      const response = await fetch('/api/catalog/entities', {
        method: 'POST',
        headers: {
          Authorization: readOnlyToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entity),
      });

      expect(response.status).toBe(403);
    });
  });

  describe('PUT /api/catalog/entities/[uid]', () => {
    it('should update an existing entity', async () => {
      const uid = 'component:default/example-service';
      const updates = {
        metadata: {
          description: 'Updated description',
          labels: {
            'updated': 'true',
          },
        },
      };

      const response = await fetch(`/api/catalog/entities/${uid}`, {
        method: 'PUT',
        headers: {
          Authorization: authToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.metadata.description).toBe('Updated description');
      expect(data.metadata.labels.updated).toBe('true');
    });

    it('should validate updated entity', async () => {
      const uid = 'component:default/example-service';
      const invalidUpdates = {
        spec: {
          type: 'invalid-type', // Invalid type
        },
      };

      const response = await fetch(`/api/catalog/entities/${uid}`, {
        method: 'PUT',
        headers: {
          Authorization: authToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidUpdates),
      });

      expect(response.status).toBe(400);
    });

    it('should track entity history', async () => {
      const uid = 'component:default/example-service';
      
      // Get history before update
      const historyBefore = await fetch(`/api/catalog/entities/${uid}/history`, {
        headers: { Authorization: authToken },
      });
      const beforeData = await historyBefore.json();
      const beforeCount = beforeData.history.length;

      // Update entity
      await fetch(`/api/catalog/entities/${uid}`, {
        method: 'PUT',
        headers: {
          Authorization: authToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ metadata: { description: 'New description' } }),
      });

      // Get history after update
      const historyAfter = await fetch(`/api/catalog/entities/${uid}/history`, {
        headers: { Authorization: authToken },
      });
      const afterData = await historyAfter.json();

      expect(afterData.history.length).toBe(beforeCount + 1);
      expect(afterData.history[0].action).toBe('update');
    });
  });

  describe('DELETE /api/catalog/entities/[uid]', () => {
    it('should delete an entity', async () => {
      const uid = 'component:default/to-delete';
      
      // Create entity first
      await fetch('/api/catalog/entities', {
        method: 'POST',
        headers: {
          Authorization: authToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiVersion: 'backstage.io/v1alpha1',
          kind: 'Component',
          metadata: { name: 'to-delete', namespace: 'default' },
          spec: { type: 'service', lifecycle: 'production', owner: 'team-a' },
        }),
      });

      // Delete entity
      const response = await fetch(`/api/catalog/entities/${uid}`, {
        method: 'DELETE',
        headers: { Authorization: authToken },
      });

      expect(response.status).toBe(204);

      // Verify deletion
      const getResponse = await fetch(`/api/catalog/entities/${uid}`, {
        headers: { Authorization: authToken },
      });
      expect(getResponse.status).toBe(404);
    });

    it('should handle cascading deletes', async () => {
      const uid = 'component:default/parent-service';
      
      const response = await fetch(`/api/catalog/entities/${uid}?cascade=true`, {
        method: 'DELETE',
        headers: { Authorization: authToken },
      });

      expect(response.status).toBe(204);
    });

    it('should check delete permissions', async () => {
      const readOnlyToken = 'Bearer read-only-token';
      const uid = 'component:default/example-service';

      const response = await fetch(`/api/catalog/entities/${uid}`, {
        method: 'DELETE',
        headers: { Authorization: readOnlyToken },
      });

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/catalog/import', () => {
    it('should import entities from URL', async () => {
      const importRequest = {
        url: 'https://github.com/example/repo/catalog-info.yaml',
      };

      const response = await fetch('/api/catalog/import', {
        method: 'POST',
        headers: {
          Authorization: authToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(importRequest),
      });
      const data = await response.json();

      expect(response.status).toBe(202);
      expect(data).toHaveProperty('taskId');
      expect(data).toHaveProperty('status', 'processing');
    });

    it('should validate import URL', async () => {
      const importRequest = {
        url: 'not-a-valid-url',
      };

      const response = await fetch('/api/catalog/import', {
        method: 'POST',
        headers: {
          Authorization: authToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(importRequest),
      });

      expect(response.status).toBe(400);
    });

    it('should support dry-run imports', async () => {
      const importRequest = {
        url: 'https://github.com/example/repo/catalog-info.yaml',
        dryRun: true,
      };

      const response = await fetch('/api/catalog/import', {
        method: 'POST',
        headers: {
          Authorization: authToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(importRequest),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('entities');
      expect(data).toHaveProperty('wouldCreate');
      expect(data).toHaveProperty('wouldUpdate');
      expect(data).toHaveProperty('conflicts');
    });
  });

  describe('GET /api/catalog/relationships', () => {
    it('should discover entity relationships', async () => {
      const response = await fetch('/api/catalog/relationships/discover', {
        headers: { Authorization: authToken },
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('relationships');
      expect(Array.isArray(data.relationships)).toBe(true);
      
      if (data.relationships.length > 0) {
        const relationship = data.relationships[0];
        expect(relationship).toHaveProperty('source');
        expect(relationship).toHaveProperty('target');
        expect(relationship).toHaveProperty('type');
      }
    });

    it('should get relationships for specific entity', async () => {
      const uid = 'component:default/example-service';
      const response = await fetch(`/api/catalog/relationships?entity=${uid}`, {
        headers: { Authorization: authToken },
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.relationships.every((r: any) => 
        r.source === uid || r.target === uid
      )).toBe(true);
    });

    it('should filter relationships by type', async () => {
      const response = await fetch('/api/catalog/relationships?type=dependsOn', {
        headers: { Authorization: authToken },
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.relationships.every((r: any) => r.type === 'dependsOn')).toBe(true);
    });
  });

  describe('POST /api/catalog/validate-url', () => {
    it('should validate catalog file URL', async () => {
      const response = await fetch('/api/catalog/validate-url', {
        method: 'POST',
        headers: {
          Authorization: authToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: 'https://github.com/example/repo/catalog-info.yaml',
        }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('valid');
      expect(data).toHaveProperty('entities');
      
      if (data.valid) {
        expect(data.entities.length).toBeGreaterThan(0);
      } else {
        expect(data).toHaveProperty('errors');
      }
    });

    it('should detect invalid YAML', async () => {
      const response = await fetch('/api/catalog/validate-url', {
        method: 'POST',
        headers: {
          Authorization: authToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: 'https://example.com/invalid.yaml',
        }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.valid).toBe(false);
      expect(data.errors).toBeDefined();
    });
  });
});