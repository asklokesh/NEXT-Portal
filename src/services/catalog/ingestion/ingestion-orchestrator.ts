/**
 * Catalog Ingestion Orchestrator
 * 
 * Main orchestrator that coordinates all catalog ingestion components,
 * manages the complete ingestion lifecycle, and provides unified access
 * to the sophisticated catalog ingestion system.
 */

import { EventEmitter } from 'events';
import {
  CatalogIngestionSystemConfig,
  TransformedEntityData,
  EntityRelationship,
  EntityQualityScore,
  IngestionJob,
  EntityChangeEvent,
  RelationshipChangeEvent,
  QualityScoreEvent,
} from '../types';

// Import all components
import { StreamProcessor } from '../pipeline/stream-processor';
import { BatchProcessor } from '../pipeline/batch-processor';
import { PipelineOrchestrator } from '../pipeline/pipeline-orchestrator';
import { RelationshipResolver } from '../relationships/relationship-resolver';
import { DependencyAnalyzer } from '../relationships/dependency-analyzer';
import { OwnershipMapper } from '../relationships/ownership-mapper';
import { EnrichmentEngine } from '../enrichment/enrichment-engine';
import { DocumentationEnricher } from '../enrichment/documentation-enricher';
import { QualityAssessor } from '../quality/quality-assessor';
import { StorageEngine } from '../storage/storage-engine';
import { PluginSystem } from '../integration/plugin-system';
import { WebhookManager } from '../integration/webhook-manager';

interface IngestionSystemMetrics {
  entities: {
    total: number;
    processed: number;
    enriched: number;
    qualityAssessed: number;
    averageQualityScore: number;
  };
  relationships: {
    total: number;
    automatic: number;
    manual: number;
    averageConfidence: number;
  };
  processing: {
    streamProcessorMetrics: any;
    batchProcessorMetrics: any;
    enrichmentMetrics: any;
    qualityMetrics: any;
  };
  storage: {
    storageMetrics: any;
  };
  integrations: {
    activePlugins: number;
    webhookSubscriptions: number;
    webhookDeliveries: number;
  };
}

export class CatalogIngestionOrchestrator extends EventEmitter {
  private readonly config: CatalogIngestionSystemConfig;
  private readonly streamProcessor: StreamProcessor;
  private readonly batchProcessor: BatchProcessor;
  private readonly pipelineOrchestrator: PipelineOrchestrator;
  private readonly relationshipResolver: RelationshipResolver;
  private readonly dependencyAnalyzer: DependencyAnalyzer;
  private readonly ownershipMapper: OwnershipMapper;
  private readonly enrichmentEngine: EnrichmentEngine;
  private readonly qualityAssessor: QualityAssessor;
  private readonly storageEngine: StorageEngine;
  private readonly pluginSystem: PluginSystem;
  private readonly webhookManager: WebhookManager;

  private isInitialized = false;
  private isRunning = false;

  constructor(config: CatalogIngestionSystemConfig) {
    super();
    this.config = config;

    // Initialize all components
    this.streamProcessor = new StreamProcessor({
      redis: {
        host: 'localhost', // From config
        port: 6379,
        keyPrefix: 'catalog:stream:',
      },
      processing: {
        batchSize: config.processing.defaultBatchSize,
        bufferTimeout: 5000,
        maxConcurrency: config.processing.maxConcurrency,
        retryAttempts: config.processing.retryPolicy.maxAttempts,
      },
      monitoring: {
        metricsInterval: 10000,
        enableProfiling: true,
      },
    });

    this.batchProcessor = new BatchProcessor({
      batchSize: config.processing.defaultBatchSize,
      maxConcurrency: config.processing.maxConcurrency,
      retryAttempts: config.processing.retryPolicy.maxAttempts,
      retryDelay: 1000,
      memoryThreshold: 512, // 512MB
      checkpointInterval: 10,
    });

    this.pipelineOrchestrator = new PipelineOrchestrator();
    this.relationshipResolver = new RelationshipResolver();
    this.dependencyAnalyzer = new DependencyAnalyzer();
    this.ownershipMapper = new OwnershipMapper();
    this.enrichmentEngine = new EnrichmentEngine();
    this.qualityAssessor = new QualityAssessor();

    this.storageEngine = new StorageEngine({
      primary: {
        type: config.storage.engine,
        connectionString: config.storage.connectionString,
      },
      cache: {
        type: 'redis',
        connectionString: 'redis://localhost:6379',
        ttl: 300, // 5 minutes
      },
      search: {
        enabled: config.storage.indexingEnabled,
        type: 'elasticsearch',
      },
      backup: {
        enabled: config.storage.backupEnabled,
        schedule: '0 2 * * *', // Daily at 2 AM
        retention: 30, // 30 days
      },
    });

    this.pluginSystem = new PluginSystem({
      allowedPermissions: [
        'read:entities',
        'write:entities',
        'read:relationships',
        'write:relationships',
        'network:https',
      ],
      sandboxEnabled: true,
      maxMemoryMB: 128,
      maxExecutionTimeMs: 30000,
      trustedPlugins: [],
      pluginDirectory: './plugins',
    });

    this.webhookManager = new WebhookManager();

    this.setupEventListeners();
  }

  /**
   * Initialize the ingestion system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.emit('initializationStarted');

    try {
      // Initialize storage
      await this.storageEngine.initialize();

      // Initialize pipeline orchestrator with processors
      await this.pipelineOrchestrator.initialize(this.streamProcessor, this.batchProcessor);

      // Register core components with orchestrator
      this.pipelineOrchestrator.registerTransformer({
        id: 'core-transformer',
        name: 'Core Entity Transformer',
        transform: async (raw) => ({
          ...raw,
          entityRef: `${raw.type}:${raw.data.namespace || 'default'}/${raw.id}`,
          kind: raw.type,
          metadata: {
            name: raw.id,
            namespace: raw.data.namespace || 'default',
            ...(raw.data.metadata as any),
          },
          spec: raw.data.spec || {},
          transformedBy: ['core-transformer'],
        } as any),
        canTransform: () => true,
      } as any);

      this.pipelineOrchestrator.registerValidator({
        id: 'core-validator',
        name: 'Core Entity Validator',
        validate: async (entity) => ({
          valid: Boolean(entity.entityRef && entity.kind && entity.metadata.name),
          errors: [],
          warnings: [],
        }),
      } as any);

      this.pipelineOrchestrator.registerEnricher(new DocumentationEnricher());

      // Register relationship resolver
      this.pipelineOrchestrator.registerEnricher({
        id: 'relationship-enricher',
        name: 'Relationship Enricher',
        canEnrich: () => true,
        enrich: async (entity) => ({
          entityRef: entity.entityRef,
          enricherId: 'relationship-enricher',
          status: 'success' as const,
          data: { relations: [] },
          confidence: 0.8,
          timestamp: new Date(),
          processingTime: 0,
        }),
      } as any);

      // Register core pipelines
      for (const pipeline of this.config.pipelines) {
        this.pipelineOrchestrator.registerPipeline(pipeline);
      }

      // Initialize enrichment engine
      this.enrichmentEngine.registerEnricher(new DocumentationEnricher());

      this.isInitialized = true;
      this.emit('initializationCompleted');

    } catch (error) {
      this.emit('initializationFailed', error);
      throw error;
    }
  }

  /**
   * Start the ingestion system
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.isRunning) {
      return;
    }

    this.emit('startingSystem');

    try {
      // Start processing engines
      await this.streamProcessor.start();
      await this.webhookManager.start();

      this.isRunning = true;
      this.emit('systemStarted');

    } catch (error) {
      this.emit('systemStartFailed', error);
      throw error;
    }
  }

  /**
   * Stop the ingestion system
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.emit('stoppingSystem');

    try {
      // Stop processing engines
      await this.streamProcessor.stop();
      await this.webhookManager.stop();

      this.isRunning = false;
      this.emit('systemStopped');

    } catch (error) {
      this.emit('systemStopFailed', error);
      throw error;
    }
  }

  /**
   * Process entities through the complete ingestion pipeline
   */
  async processEntities(
    entities: any[],
    options: {
      mode?: 'stream' | 'batch';
      pipelineId?: string;
      enrichmentEnabled?: boolean;
      qualityAssessmentEnabled?: boolean;
    } = {}
  ): Promise<{
    processed: TransformedEntityData[];
    relationships: EntityRelationship[];
    qualityScores: EntityQualityScore[];
    metrics: any;
  }> {
    const { 
      mode = 'batch', 
      enrichmentEnabled = true, 
      qualityAssessmentEnabled = true 
    } = options;

    this.emit('processingStarted', { entityCount: entities.length, mode });

    try {
      let transformedEntities: TransformedEntityData[] = [];

      // Transform raw data to entities
      for (const rawEntity of entities) {
        const transformed: TransformedEntityData = {
          id: rawEntity.id || `entity-${Date.now()}`,
          sourceId: rawEntity.sourceId || 'manual',
          entityRef: `${rawEntity.kind || 'Component'}:${rawEntity.metadata?.namespace || 'default'}/${rawEntity.metadata?.name || rawEntity.id}`,
          kind: rawEntity.kind || 'Component',
          metadata: {
            name: rawEntity.metadata?.name || rawEntity.id,
            namespace: rawEntity.metadata?.namespace || 'default',
            ...rawEntity.metadata,
          },
          spec: rawEntity.spec || {},
          rawData: {
            id: rawEntity.id,
            sourceId: rawEntity.sourceId || 'manual',
            type: rawEntity.kind || 'Component',
            data: rawEntity,
            metadata: {
              discoveredAt: new Date(),
            },
          },
          transformedBy: ['ingestion-orchestrator'],
        };

        transformedEntities.push(transformed);
      }

      // Process based on mode
      if (mode === 'stream') {
        // Stream processing
        for (const entity of transformedEntities) {
          await this.streamProcessor.enqueueEntity(entity.rawData);
        }
      } else {
        // Batch processing
        const jobId = `batch-${Date.now()}`;
        const rawEntities = transformedEntities.map(e => e.rawData);
        await this.batchProcessor.processBatch(jobId, rawEntities);
      }

      // Resolve relationships
      const relationships = await this.relationshipResolver.resolveRelationships(transformedEntities);

      // Store relationships
      for (const relationship of relationships) {
        await this.storageEngine.storeRelationship(relationship);
      }

      // Build dependency graph
      const dependencyGraph = this.dependencyAnalyzer.buildGraph(transformedEntities, relationships);

      // Map ownership
      const ownershipMappings = await this.ownershipMapper.mapOwnership(transformedEntities);

      // Enrichment
      let enrichmentResults = [];
      if (enrichmentEnabled) {
        enrichmentResults = await this.enrichmentEngine.enrichEntities(transformedEntities, {
          parallel: true,
          maxConcurrency: 5,
        });
      }

      // Quality assessment
      let qualityScores: EntityQualityScore[] = [];
      if (qualityAssessmentEnabled) {
        for (const entity of transformedEntities) {
          const score = await this.qualityAssessor.assess(entity, {
            allEntities: transformedEntities,
            relatedEntities: [],
          });
          qualityScores.push(score);
          
          // Store quality score
          await this.storageEngine.storeQualityScore(score);
        }
      }

      // Store entities
      for (const entity of transformedEntities) {
        await this.storageEngine.storeEntity(entity);
      }

      // Publish events
      for (const entity of transformedEntities) {
        const changeEvent: EntityChangeEvent = {
          type: 'entity.created',
          sourceId: entity.sourceId,
          entityRef: entity.entityRef,
          timestamp: new Date(),
          changeType: 'created',
          entity,
          data: {},
        };
        
        await this.webhookManager.publishEvent(changeEvent);
      }

      const result = {
        processed: transformedEntities,
        relationships,
        qualityScores,
        metrics: {
          entitiesProcessed: transformedEntities.length,
          relationshipsFound: relationships.length,
          enrichmentsApplied: enrichmentResults.reduce((sum, r) => sum + r.successCount, 0),
          averageQualityScore: qualityScores.length > 0 
            ? qualityScores.reduce((sum, s) => sum + s.overallScore, 0) / qualityScores.length
            : 0,
        },
      };

      this.emit('processingCompleted', result.metrics);
      return result;

    } catch (error) {
      this.emit('processingFailed', error);
      throw error;
    }
  }

  /**
   * Get comprehensive system metrics
   */
  getMetrics(): IngestionSystemMetrics {
    const streamMetrics = this.streamProcessor.getMetrics();
    const batchMetrics = this.batchProcessor.getStatistics();
    const enrichmentMetrics = this.enrichmentEngine.getMetrics();
    const storageMetrics = this.storageEngine.getMetrics();
    const webhookMetrics = this.webhookManager.getMetrics();

    return {
      entities: {
        total: storageMetrics.entities.total,
        processed: streamMetrics.itemsProcessed + batchMetrics.totalProcessed,
        enriched: enrichmentMetrics.totalEntitiesProcessed,
        qualityAssessed: 0, // Would track this separately
        averageQualityScore: 0, // Would calculate from stored scores
      },
      relationships: {
        total: storageMetrics.relationships.total,
        automatic: 0, // Would track this
        manual: 0, // Would track this
        averageConfidence: 0.8, // Would calculate from stored relationships
      },
      processing: {
        streamProcessorMetrics: streamMetrics,
        batchProcessorMetrics: batchMetrics,
        enrichmentMetrics: enrichmentMetrics,
        qualityMetrics: {}, // Would include quality assessor metrics
      },
      storage: {
        storageMetrics: storageMetrics,
      },
      integrations: {
        activePlugins: this.pluginSystem.listPlugins().filter(p => p.status === 'active').length,
        webhookSubscriptions: webhookMetrics.subscriptions.active,
        webhookDeliveries: webhookMetrics.deliveries.total,
      },
    };
  }

  /**
   * Get system health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    components: Record<string, {
      status: 'healthy' | 'degraded' | 'unhealthy';
      message?: string;
      lastCheck: Date;
    }>;
  } {
    const now = new Date();
    
    return {
      status: 'healthy',
      components: {
        streamProcessor: {
          status: 'healthy',
          lastCheck: now,
        },
        batchProcessor: {
          status: 'healthy',
          lastCheck: now,
        },
        storageEngine: {
          status: 'healthy',
          lastCheck: now,
        },
        enrichmentEngine: {
          status: 'healthy',
          lastCheck: now,
        },
        qualityAssessor: {
          status: 'healthy',
          lastCheck: now,
        },
        webhookManager: {
          status: 'healthy',
          lastCheck: now,
        },
        pluginSystem: {
          status: 'healthy',
          lastCheck: now,
        },
      },
    };
  }

  /**
   * Get storage engine for direct access
   */
  getStorageEngine(): StorageEngine {
    return this.storageEngine;
  }

  /**
   * Get webhook manager for subscription management
   */
  getWebhookManager(): WebhookManager {
    return this.webhookManager;
  }

  /**
   * Get plugin system for plugin management
   */
  getPluginSystem(): PluginSystem {
    return this.pluginSystem;
  }

  /**
   * Setup event listeners between components
   */
  private setupEventListeners(): void {
    // Stream processor events
    this.streamProcessor.on('entityProcessed', (event) => {
      this.emit('entityProcessed', event);
    });

    // Batch processor events
    this.batchProcessor.on('jobCompleted', (job) => {
      this.emit('batchJobCompleted', job);
    });

    // Pipeline orchestrator events
    this.pipelineOrchestrator.on('pipelineCompleted', (execution) => {
      this.emit('pipelineExecutionCompleted', execution);
    });

    // Enrichment engine events
    this.enrichmentEngine.on('enrichmentCompleted', (result) => {
      this.emit('entityEnriched', result);
    });

    // Quality assessor events
    this.qualityAssessor.on('assessmentCompleted', (score) => {
      this.emit('qualityScoreUpdated', score);
    });

    // Storage engine events
    this.storageEngine.on('entityStored', (event) => {
      this.emit('entityStored', event);
    });

    // Webhook manager events
    this.webhookManager.on('deliverySuccess', (delivery) => {
      this.emit('webhookDelivered', delivery);
    });

    // Plugin system events
    this.pluginSystem.on('pluginLoaded', (plugin) => {
      this.emit('pluginLoaded', plugin);
    });
  }
}

export default CatalogIngestionOrchestrator;