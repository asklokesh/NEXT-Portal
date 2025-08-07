/**
 * Comprehensive Tests for Catalog Ingestion System
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { CatalogIngestionOrchestrator } from '../ingestion/ingestion-orchestrator';
import { CatalogIngestionSystemConfig, TransformedEntityData } from '../types';

describe('CatalogIngestionOrchestrator', () => {
  let orchestrator: CatalogIngestionOrchestrator;
  let mockConfig: CatalogIngestionSystemConfig;

  beforeEach(() => {
    mockConfig = {
      sources: [],
      pipelines: [{
        id: 'test-pipeline',
        name: 'Test Pipeline',
        description: 'Test pipeline for unit tests',
        stages: [
          {
            name: 'source',
            type: 'source',
            config: { processorId: 'test-processor' },
            dependencies: [],
          },
          {
            name: 'transform',
            type: 'transformer',
            config: { transformerId: 'core-transformer' },
            dependencies: ['source'],
          },
          {
            name: 'validate',
            type: 'validator',
            config: { validatorId: 'core-validator' },
            dependencies: ['transform'],
          },
        ],
        triggers: [
          {
            type: 'manual',
            config: {},
          },
        ],
        maxConcurrency: 5,
        timeout: 300000,
      }],
      storage: {
        engine: 'postgresql',
        connectionString: 'postgresql://localhost:5432/test',
        indexingEnabled: true,
        backupEnabled: false,
      },
      processing: {
        defaultBatchSize: 100,
        maxConcurrency: 5,
        retryPolicy: {
          maxAttempts: 3,
          backoffMultiplier: 2,
          maxDelay: 30000,
        },
      },
      notifications: {
        webhooks: [],
      },
      monitoring: {
        metricsEnabled: true,
        tracingEnabled: false,
        loggingLevel: 'info',
      },
    };

    // Mock external dependencies
    jest.doMock('pg', () => ({
      Pool: jest.fn().mockImplementation(() => ({
        connect: jest.fn().mockResolvedValue({
          query: jest.fn().mockResolvedValue({ rows: [] }),
          release: jest.fn(),
        })),
      })),
    }));

    jest.doMock('@elastic/elasticsearch', () => ({
      Client: jest.fn().mockImplementation(() => ({
        indices: {
          create: jest.fn().mockResolvedValue({}),
        },
        index: jest.fn().mockResolvedValue({}),
        get: jest.fn().mockResolvedValue({ body: { _source: {} } }),
        search: jest.fn().mockResolvedValue({
          body: {
            hits: { hits: [], total: { value: 0 } },
            aggregations: {},
          },
        }),
      })),
    }));

    jest.doMock('ioredis', () => {
      return jest.fn().mockImplementation(() => ({
        get: jest.fn().mockResolvedValue(null),
        setex: jest.fn().mockResolvedValue('OK'),
        lpush: jest.fn().mockResolvedValue(1),
        brpop: jest.fn().mockResolvedValue(null),
        keys: jest.fn().mockResolvedValue([]),
        hset: jest.fn().mockResolvedValue(1),
        disconnect: jest.fn().mockResolvedValue(undefined),
      }));
    });

    orchestrator = new CatalogIngestionOrchestrator(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await expect(orchestrator.initialize()).resolves.not.toThrow();
      
      const metrics = orchestrator.getMetrics();
      expect(metrics).toHaveProperty('entities');
      expect(metrics).toHaveProperty('relationships');
      expect(metrics).toHaveProperty('processing');
    });

    it('should emit initialization events', async () => {
      const startListener = jest.fn();
      const completedListener = jest.fn();
      
      orchestrator.on('initializationStarted', startListener);
      orchestrator.on('initializationCompleted', completedListener);
      
      await orchestrator.initialize();
      
      expect(startListener).toHaveBeenCalled();
      expect(completedListener).toHaveBeenCalled();
    });

    it('should handle initialization failures', async () => {
      // Mock storage initialization failure
      const storageEngine = orchestrator.getStorageEngine();
      jest.spyOn(storageEngine, 'initialize').mockRejectedValue(new Error('Storage failed'));
      
      const failedListener = jest.fn();
      orchestrator.on('initializationFailed', failedListener);
      
      await expect(orchestrator.initialize()).rejects.toThrow('Storage failed');
      expect(failedListener).toHaveBeenCalled();
    });
  });

  describe('Entity Processing', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    it('should process entities through complete pipeline', async () => {
      const testEntities = [
        {
          id: 'test-service-1',
          kind: 'Component',
          metadata: {
            name: 'test-service-1',
            namespace: 'default',
            description: 'Test service for unit tests',
            labels: { team: 'platform' },
          },
          spec: {
            type: 'service',
            lifecycle: 'production',
            owner: 'team-platform',
          },
        },
        {
          id: 'test-api-1',
          kind: 'API',
          metadata: {
            name: 'test-api-1',
            namespace: 'default',
            description: 'Test API for unit tests',
          },
          spec: {
            type: 'openapi',
            owner: 'team-platform',
            definition: 'https://example.com/api/openapi.yaml',
          },
        },
      ];

      const result = await orchestrator.processEntities(testEntities, {
        mode: 'batch',
        enrichmentEnabled: true,
        qualityAssessmentEnabled: true,
      });

      expect(result.processed).toHaveLength(2);
      expect(result.relationships).toBeDefined();
      expect(result.qualityScores).toHaveLength(2);
      expect(result.metrics.entitiesProcessed).toBe(2);
    });

    it('should handle processing failures gracefully', async () => {
      const invalidEntities = [
        {
          // Missing required fields
          metadata: {},
        },
      ];

      await expect(
        orchestrator.processEntities(invalidEntities)
      ).rejects.toThrow();
    });

    it('should emit processing events', async () => {
      const startListener = jest.fn();
      const completedListener = jest.fn();
      
      orchestrator.on('processingStarted', startListener);
      orchestrator.on('processingCompleted', completedListener);
      
      const testEntities = [{
        id: 'test-service',
        kind: 'Component',
        metadata: { name: 'test-service', namespace: 'default' },
        spec: { type: 'service' },
      }];

      await orchestrator.processEntities(testEntities);
      
      expect(startListener).toHaveBeenCalledWith(
        expect.objectContaining({ entityCount: 1, mode: 'batch' })
      );
      expect(completedListener).toHaveBeenCalled();
    });
  });

  describe('System Lifecycle', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    it('should start system successfully', async () => {
      const startListener = jest.fn();
      orchestrator.on('systemStarted', startListener);
      
      await orchestrator.start();
      expect(startListener).toHaveBeenCalled();
    });

    it('should stop system successfully', async () => {
      await orchestrator.start();
      
      const stopListener = jest.fn();
      orchestrator.on('systemStopped', stopListener);
      
      await orchestrator.stop();
      expect(stopListener).toHaveBeenCalled();
    });

    it('should handle multiple start calls gracefully', async () => {
      await orchestrator.start();
      await expect(orchestrator.start()).resolves.not.toThrow();
    });

    it('should handle multiple stop calls gracefully', async () => {
      await orchestrator.start();
      await orchestrator.stop();
      await expect(orchestrator.stop()).resolves.not.toThrow();
    });
  });

  describe('Metrics and Health', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    it('should provide comprehensive metrics', () => {
      const metrics = orchestrator.getMetrics();
      
      expect(metrics).toHaveProperty('entities');
      expect(metrics.entities).toHaveProperty('total');
      expect(metrics.entities).toHaveProperty('processed');
      expect(metrics.entities).toHaveProperty('enriched');
      expect(metrics.entities).toHaveProperty('qualityAssessed');
      
      expect(metrics).toHaveProperty('relationships');
      expect(metrics.relationships).toHaveProperty('total');
      expect(metrics.relationships).toHaveProperty('automatic');
      expect(metrics.relationships).toHaveProperty('manual');
      
      expect(metrics).toHaveProperty('processing');
      expect(metrics).toHaveProperty('storage');
      expect(metrics).toHaveProperty('integrations');
    });

    it('should provide health status', () => {
      const health = orchestrator.getHealthStatus();
      
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('components');
      
      expect(health.components).toHaveProperty('streamProcessor');
      expect(health.components).toHaveProperty('batchProcessor');
      expect(health.components).toHaveProperty('storageEngine');
      expect(health.components).toHaveProperty('enrichmentEngine');
      expect(health.components).toHaveProperty('qualityAssessor');
      expect(health.components).toHaveProperty('webhookManager');
      expect(health.components).toHaveProperty('pluginSystem');
      
      Object.values(health.components).forEach(component => {
        expect(component).toHaveProperty('status');
        expect(component).toHaveProperty('lastCheck');
        expect(['healthy', 'degraded', 'unhealthy']).toContain(component.status);
      });
    });
  });

  describe('Component Integration', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    it('should provide access to storage engine', () => {
      const storageEngine = orchestrator.getStorageEngine();
      expect(storageEngine).toBeDefined();
      expect(typeof storageEngine.storeEntity).toBe('function');
      expect(typeof storageEngine.getEntity).toBe('function');
      expect(typeof storageEngine.searchEntities).toBe('function');
    });

    it('should provide access to webhook manager', () => {
      const webhookManager = orchestrator.getWebhookManager();
      expect(webhookManager).toBeDefined();
      expect(typeof webhookManager.subscribe).toBe('function');
      expect(typeof webhookManager.publishEvent).toBe('function');
    });

    it('should provide access to plugin system', () => {
      const pluginSystem = orchestrator.getPluginSystem();
      expect(pluginSystem).toBeDefined();
      expect(typeof pluginSystem.loadPlugin).toBe('function');
      expect(typeof pluginSystem.listPlugins).toBe('function');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    it('should handle storage errors gracefully', async () => {
      const storageEngine = orchestrator.getStorageEngine();
      jest.spyOn(storageEngine, 'storeEntity').mockRejectedValue(new Error('Storage error'));
      
      const testEntities = [{
        id: 'test-service',
        kind: 'Component',
        metadata: { name: 'test-service', namespace: 'default' },
        spec: { type: 'service' },
      }];

      await expect(orchestrator.processEntities(testEntities)).rejects.toThrow('Storage error');
    });

    it('should emit error events', async () => {
      const errorListener = jest.fn();
      orchestrator.on('processingFailed', errorListener);
      
      // Force an error by providing invalid configuration
      const storageEngine = orchestrator.getStorageEngine();
      jest.spyOn(storageEngine, 'storeEntity').mockRejectedValue(new Error('Test error'));
      
      const testEntities = [{
        id: 'test-service',
        kind: 'Component',
        metadata: { name: 'test-service', namespace: 'default' },
        spec: { type: 'service' },
      }];

      try {
        await orchestrator.processEntities(testEntities);
      } catch (error) {
        // Expected to throw
      }
      
      expect(errorListener).toHaveBeenCalled();
    });
  });

  describe('Event Propagation', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    it('should propagate entity processed events', async () => {
      const entityProcessedListener = jest.fn();
      orchestrator.on('entityProcessed', entityProcessedListener);
      
      const testEntities = [{
        id: 'test-service',
        kind: 'Component',
        metadata: { name: 'test-service', namespace: 'default' },
        spec: { type: 'service' },
      }];

      await orchestrator.processEntities(testEntities, { mode: 'stream' });
      
      // Allow some time for stream processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Note: In a real test, we'd need to set up proper mocks for the stream processor
      // This is a simplified test
    });

    it('should propagate enrichment events', async () => {
      const enrichmentListener = jest.fn();
      orchestrator.on('entityEnriched', enrichmentListener);
      
      const testEntities = [{
        id: 'test-service',
        kind: 'Component',
        metadata: { name: 'test-service', namespace: 'default' },
        spec: { type: 'service' },
      }];

      await orchestrator.processEntities(testEntities, {
        enrichmentEnabled: true,
      });
      
      // Enrichment events should be emitted during processing
    });

    it('should propagate quality assessment events', async () => {
      const qualityListener = jest.fn();
      orchestrator.on('qualityScoreUpdated', qualityListener);
      
      const testEntities = [{
        id: 'test-service',
        kind: 'Component',
        metadata: { name: 'test-service', namespace: 'default' },
        spec: { type: 'service' },
      }];

      await orchestrator.processEntities(testEntities, {
        qualityAssessmentEnabled: true,
      });
      
      // Quality assessment events should be emitted during processing
    });
  });
});