/**
 * Stream Processor for Real-time Entity Ingestion
 */

import { EventEmitter } from 'events';
import { Readable, Transform, Writable, pipeline } from 'stream';
import { promisify } from 'util';
import Redis from 'ioredis';
import {
  RawEntityData,
  TransformedEntityData,
  IEntityTransformer,
  IEntityValidator,
  IEntityEnricher,
  IngestionEvent,
  EntityChangeEvent,
} from '../types';

const pipelineAsync = promisify(pipeline);

interface StreamProcessorConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    keyPrefix: string;
  };
  processing: {
    batchSize: number;
    bufferTimeout: number;
    maxConcurrency: number;
    retryAttempts: number;
  };
  monitoring: {
    metricsInterval: number;
    enableProfiling: boolean;
  };
}

interface ProcessingMetrics {
  itemsProcessed: number;
  itemsPerSecond: number;
  errorRate: number;
  averageProcessingTime: number;
  queueDepth: number;
  lastProcessedAt?: Date;
}

export class StreamProcessor extends EventEmitter {
  private readonly redis: Redis;
  private readonly config: StreamProcessorConfig;
  private readonly transformers = new Map<string, IEntityTransformer>();
  private readonly validators = new Map<string, IEntityValidator>();
  private readonly enrichers = new Map<string, IEntityEnricher>();
  
  private isRunning = false;
  private metrics: ProcessingMetrics = {
    itemsProcessed: 0,
    itemsPerSecond: 0,
    errorRate: 0,
    averageProcessingTime: 0,
    queueDepth: 0,
  };

  private processingTimeBuffer: number[] = [];
  private metricsInterval?: NodeJS.Timeout;

  constructor(config: StreamProcessorConfig) {
    super();
    this.config = config;
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      keyPrefix: config.redis.keyPrefix,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    });
  }

  /**
   * Register processing components
   */
  registerTransformer(transformer: IEntityTransformer): void {
    this.transformers.set(transformer.id, transformer);
  }

  registerValidator(validator: IEntityValidator): void {
    this.validators.set(validator.id, validator);
  }

  registerEnricher(enricher: IEntityEnricher): void {
    this.enrichers.set(enricher.id, enricher);
  }

  /**
   * Start stream processing
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Stream processor is already running');
    }

    this.isRunning = true;
    this.startMetricsCollection();

    try {
      // Create processing streams
      const sourceStream = this.createSourceStream();
      const transformStream = this.createTransformStream();
      const validationStream = this.createValidationStream();
      const enrichmentStream = this.createEnrichmentStream();
      const sinkStream = this.createSinkStream();

      // Set up pipeline
      await pipelineAsync(
        sourceStream,
        transformStream,
        validationStream,
        enrichmentStream,
        sinkStream
      );

      this.emit('started');
    } catch (error) {
      this.isRunning = false;
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop stream processing
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    await this.redis.disconnect();
    this.emit('stopped');
  }

  /**
   * Add entity to processing queue
   */
  async enqueueEntity(entity: RawEntityData): Promise<void> {
    const queueKey = `processing:queue:${entity.sourceId}`;
    await this.redis.lpush(queueKey, JSON.stringify(entity));
    
    this.emit('entityEnqueued', {
      type: 'entity.enqueued',
      sourceId: entity.sourceId,
      timestamp: new Date(),
      data: { entityId: entity.id },
    });
  }

  /**
   * Get current processing metrics
   */
  getMetrics(): ProcessingMetrics {
    return { ...this.metrics };
  }

  /**
   * Create source stream that reads from Redis queues
   */
  private createSourceStream(): Readable {
    return new Readable({
      objectMode: true,
      highWaterMark: this.config.processing.batchSize,
      
      async read() {
        if (!this.isRunning) {
          this.push(null);
          return;
        }

        try {
          // Get queue keys for all sources
          const queueKeys = await this.redis.keys('processing:queue:*');
          
          if (queueKeys.length === 0) {
            // No work available, wait and try again
            setTimeout(() => this._read(), 1000);
            return;
          }

          // Process items from queues in round-robin fashion
          for (const queueKey of queueKeys) {
            const entityData = await this.redis.brpop(queueKey, 1);
            
            if (entityData) {
              const [, jsonData] = entityData;
              const entity = JSON.parse(jsonData) as RawEntityData;
              this.push(entity);
            }
          }
        } catch (error) {
          this.emit('error', error);
        }
      }.bind(this),
    });
  }

  /**
   * Create transformation stream
   */
  private createTransformStream(): Transform {
    return new Transform({
      objectMode: true,
      highWaterMark: this.config.processing.batchSize,
      
      async transform(entity: RawEntityData, encoding, callback) {
        const startTime = Date.now();
        
        try {
          // Find appropriate transformer
          const transformer = Array.from(this.transformers.values())
            .find(t => t.canTransform(entity));

          if (!transformer) {
            callback(new Error(`No transformer found for entity ${entity.id}`));
            return;
          }

          const transformedEntity = await transformer.transform(entity);
          
          // Track processing time
          const processingTime = Date.now() - startTime;
          this.updateProcessingMetrics(processingTime);
          
          this.emit('entityTransformed', {
            type: 'entity.transformed',
            sourceId: entity.sourceId,
            entityRef: transformedEntity.entityRef,
            timestamp: new Date(),
            data: { 
              transformerId: transformer.id,
              processingTime,
            },
          });

          callback(null, transformedEntity);
        } catch (error) {
          this.updateErrorMetrics();
          callback(error);
        }
      }.bind(this),
    });
  }

  /**
   * Create validation stream
   */
  private createValidationStream(): Transform {
    return new Transform({
      objectMode: true,
      highWaterMark: this.config.processing.batchSize,
      
      async transform(entity: TransformedEntityData, encoding, callback) {
        try {
          let hasErrors = false;
          const allErrors: string[] = [];
          const allWarnings: string[] = [];

          // Run all validators
          for (const validator of this.validators.values()) {
            const result = await validator.validate(entity);
            
            if (!result.valid) {
              hasErrors = true;
              allErrors.push(...result.errors.map(e => e.message));
            }
            
            allWarnings.push(...result.warnings.map(w => w.message));
          }

          if (hasErrors) {
            this.emit('validationFailed', {
              type: 'entity.validationFailed',
              sourceId: entity.sourceId,
              entityRef: entity.entityRef,
              timestamp: new Date(),
              data: { errors: allErrors, warnings: allWarnings },
            });
            
            callback(new Error(`Validation failed for entity ${entity.entityRef}: ${allErrors.join(', ')}`));
            return;
          }

          if (allWarnings.length > 0) {
            this.emit('validationWarnings', {
              type: 'entity.validationWarnings',
              sourceId: entity.sourceId,
              entityRef: entity.entityRef,
              timestamp: new Date(),
              data: { warnings: allWarnings },
            });
          }

          callback(null, entity);
        } catch (error) {
          this.updateErrorMetrics();
          callback(error);
        }
      }.bind(this),
    });
  }

  /**
   * Create enrichment stream
   */
  private createEnrichmentStream(): Transform {
    return new Transform({
      objectMode: true,
      highWaterMark: this.config.processing.batchSize,
      
      async transform(entity: TransformedEntityData, encoding, callback) {
        try {
          // Run applicable enrichers in parallel
          const enrichmentPromises = Array.from(this.enrichers.values())
            .filter(enricher => enricher.canEnrich(entity))
            .map(enricher => enricher.enrich(entity));

          const enrichmentResults = await Promise.allSettled(enrichmentPromises);
          
          // Apply successful enrichments
          for (const result of enrichmentResults) {
            if (result.status === 'fulfilled') {
              const enrichmentData = result.value.data;
              
              // Merge enrichment data into entity
              if (enrichmentData.metadata) {
                entity.metadata = { ...entity.metadata, ...enrichmentData.metadata };
              }
              
              if (enrichmentData.spec) {
                entity.spec = { ...entity.spec, ...enrichmentData.spec };
              }
              
              if (enrichmentData.relations) {
                entity.relations = [...(entity.relations || []), ...enrichmentData.relations];
              }
            } else {
              this.emit('enrichmentError', {
                type: 'entity.enrichmentError',
                sourceId: entity.sourceId,
                entityRef: entity.entityRef,
                timestamp: new Date(),
                data: { error: result.reason?.message },
              });
            }
          }

          this.emit('entityEnriched', {
            type: 'entity.enriched',
            sourceId: entity.sourceId,
            entityRef: entity.entityRef,
            timestamp: new Date(),
            data: { 
              enrichmentsApplied: enrichmentResults.filter(r => r.status === 'fulfilled').length,
            },
          });

          callback(null, entity);
        } catch (error) {
          this.updateErrorMetrics();
          callback(error);
        }
      }.bind(this),
    });
  }

  /**
   * Create sink stream that persists entities
   */
  private createSinkStream(): Writable {
    return new Writable({
      objectMode: true,
      highWaterMark: this.config.processing.batchSize,
      
      async write(entity: TransformedEntityData, encoding, callback) {
        try {
          // Persist to catalog storage
          await this.persistEntity(entity);
          
          // Emit change event
          const changeEvent: EntityChangeEvent = {
            type: 'entity.updated',
            sourceId: entity.sourceId,
            entityRef: entity.entityRef,
            timestamp: new Date(),
            changeType: 'updated',
            entity,
            data: {},
          };
          
          this.emit('entityProcessed', changeEvent);
          this.metrics.itemsProcessed++;
          
          callback();
        } catch (error) {
          this.updateErrorMetrics();
          callback(error);
        }
      }.bind(this),
    });
  }

  /**
   * Persist entity to storage
   */
  private async persistEntity(entity: TransformedEntityData): Promise<void> {
    // This would integrate with the catalog storage layer
    // For now, store in Redis as a placeholder
    const key = `entity:${entity.entityRef}`;
    await this.redis.hset(key, {
      data: JSON.stringify(entity),
      lastUpdated: new Date().toISOString(),
    });
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      this.calculateMetrics();
      this.emit('metricsUpdated', this.metrics);
    }, this.config.monitoring.metricsInterval);
  }

  /**
   * Calculate processing metrics
   */
  private calculateMetrics(): void {
    const now = Date.now();
    const timeWindow = this.config.monitoring.metricsInterval;
    
    // Calculate items per second
    if (this.metrics.lastProcessedAt) {
      const timeDiff = now - this.metrics.lastProcessedAt.getTime();
      this.metrics.itemsPerSecond = this.metrics.itemsProcessed / (timeDiff / 1000);
    }
    
    // Calculate average processing time
    if (this.processingTimeBuffer.length > 0) {
      const avgTime = this.processingTimeBuffer.reduce((a, b) => a + b, 0) / this.processingTimeBuffer.length;
      this.metrics.averageProcessingTime = Math.round(avgTime);
      
      // Keep buffer size manageable
      if (this.processingTimeBuffer.length > 1000) {
        this.processingTimeBuffer = this.processingTimeBuffer.slice(-500);
      }
    }
    
    this.metrics.lastProcessedAt = new Date();
  }

  /**
   * Update processing time metrics
   */
  private updateProcessingMetrics(processingTime: number): void {
    this.processingTimeBuffer.push(processingTime);
  }

  /**
   * Update error metrics
   */
  private updateErrorMetrics(): void {
    const totalOperations = this.metrics.itemsProcessed + 1;
    this.metrics.errorRate = (this.metrics.errorRate * this.metrics.itemsProcessed + 1) / totalOperations;
  }
}

export default StreamProcessor;