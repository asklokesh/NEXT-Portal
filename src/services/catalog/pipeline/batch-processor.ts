/**
 * Batch Processor for Bulk Entity Operations
 */

import { EventEmitter } from 'events';
import pLimit from 'p-limit';
import {
  RawEntityData,
  TransformedEntityData,
  IEntityTransformer,
  IEntityValidator,
  IEntityEnricher,
  IngestionJob,
  EntityChangeEvent,
} from '../types';

interface BatchProcessorConfig {
  batchSize: number;
  maxConcurrency: number;
  retryAttempts: number;
  retryDelay: number;
  memoryThreshold: number; // MB
  checkpointInterval: number; // number of batches
}

interface BatchJob {
  id: string;
  entities: RawEntityData[];
  config: BatchProcessorConfig;
  createdAt: Date;
}

interface BatchResult {
  processed: number;
  successful: number;
  failed: number;
  errors: Array<{
    entityId: string;
    error: string;
    stage: string;
  }>;
  processingTime: number;
}

interface BatchCheckpoint {
  jobId: string;
  processedBatches: number;
  totalBatches: number;
  processedEntities: number;
  errors: number;
  timestamp: Date;
}

export class BatchProcessor extends EventEmitter {
  private readonly config: BatchProcessorConfig;
  private readonly transformers = new Map<string, IEntityTransformer>();
  private readonly validators = new Map<string, IEntityValidator>();
  private readonly enrichers = new Map<string, IEntityEnricher>();
  
  private activeJobs = new Map<string, IngestionJob>();
  private checkpoints = new Map<string, BatchCheckpoint>();
  private limit: ReturnType<typeof pLimit>;

  constructor(config: BatchProcessorConfig) {
    super();
    this.config = config;
    this.limit = pLimit(config.maxConcurrency);
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
   * Process entities in batches
   */
  async processBatch(
    jobId: string,
    entities: RawEntityData[],
    options: Partial<BatchProcessorConfig> = {}
  ): Promise<BatchResult> {
    const config = { ...this.config, ...options };
    const startTime = Date.now();
    
    // Create job
    const job: IngestionJob = {
      id: jobId,
      type: 'batch',
      status: 'running',
      sourceId: entities[0]?.sourceId || 'unknown',
      config: config as unknown as Record<string, unknown>,
      startedAt: new Date(),
      progress: {
        processed: 0,
        total: entities.length,
        errors: 0,
      },
      errors: [],
    };

    this.activeJobs.set(jobId, job);
    this.emit('jobStarted', job);

    try {
      // Check for existing checkpoint
      const checkpoint = this.checkpoints.get(jobId);
      const startIndex = checkpoint ? checkpoint.processedEntities : 0;
      
      if (startIndex > 0) {
        this.emit('jobResumed', { jobId, startIndex });
      }

      // Split entities into batches
      const batches = this.createBatches(entities.slice(startIndex), config.batchSize);
      const totalBatches = batches.length;
      
      const result: BatchResult = {
        processed: startIndex,
        successful: 0,
        failed: 0,
        errors: [],
        processingTime: 0,
      };

      // Process batches with concurrency control
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        
        try {
          await this.checkMemoryUsage();
          
          const batchResults = await Promise.allSettled(
            batch.map(entity => 
              this.limit(() => this.processEntity(entity, job))
            )
          );

          // Aggregate results
          for (const batchResult of batchResults) {
            if (batchResult.status === 'fulfilled') {
              result.successful++;
            } else {
              result.failed++;
              result.errors.push({
                entityId: 'unknown',
                error: batchResult.reason?.message || 'Unknown error',
                stage: 'processing',
              });
              job.errors.push({
                message: batchResult.reason?.message || 'Unknown error',
                code: 'PROCESSING_ERROR',
                timestamp: new Date(),
              });
              job.progress.errors++;
            }
          }

          result.processed += batch.length;
          job.progress.processed = result.processed;

          // Create checkpoint
          if ((batchIndex + 1) % config.checkpointInterval === 0) {
            await this.createCheckpoint(jobId, batchIndex + 1, totalBatches, result);
          }

          this.emit('batchCompleted', {
            jobId,
            batchIndex: batchIndex + 1,
            totalBatches,
            processed: result.processed,
            total: entities.length,
          });

        } catch (error) {
          result.failed += batch.length;
          result.errors.push({
            entityId: 'batch',
            error: error instanceof Error ? error.message : 'Unknown batch error',
            stage: 'batch',
          });
          
          this.emit('batchError', { jobId, batchIndex, error });
        }
      }

      result.processingTime = Date.now() - startTime;
      
      // Update job status
      job.status = result.failed === 0 ? 'completed' : 'failed';
      job.completedAt = new Date();
      job.result = {
        entitiesProcessed: result.processed,
        entitiesCreated: 0, // Would be tracked by storage layer
        entitiesUpdated: result.successful,
        entitiesDeleted: 0,
        relationshipsCreated: 0,
        relationshipsUpdated: 0,
      };

      this.emit('jobCompleted', job);
      
      // Clean up
      this.activeJobs.delete(jobId);
      this.checkpoints.delete(jobId);

      return result;

    } catch (error) {
      job.status = 'failed';
      job.completedAt = new Date();
      job.errors.push({
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'JOB_ERROR',
        timestamp: new Date(),
      });

      this.emit('jobFailed', job);
      this.activeJobs.delete(jobId);
      throw error;
    }
  }

  /**
   * Process a single entity through the pipeline
   */
  private async processEntity(
    entity: RawEntityData,
    job: IngestionJob
  ): Promise<TransformedEntityData> {
    // Transform
    const transformer = Array.from(this.transformers.values())
      .find(t => t.canTransform(entity));
    
    if (!transformer) {
      throw new Error(`No transformer found for entity ${entity.id}`);
    }

    const transformedEntity = await this.retryOperation(
      () => transformer.transform(entity),
      this.config.retryAttempts
    );

    // Validate
    for (const validator of this.validators.values()) {
      const validationResult = await this.retryOperation(
        () => validator.validate(transformedEntity),
        this.config.retryAttempts
      );
      
      if (!validationResult.valid) {
        throw new Error(`Validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`);
      }
    }

    // Enrich
    const enrichmentPromises = Array.from(this.enrichers.values())
      .filter(enricher => enricher.canEnrich(transformedEntity))
      .map(enricher => 
        this.retryOperation(
          () => enricher.enrich(transformedEntity),
          this.config.retryAttempts
        ).catch(error => {
          // Log enrichment errors but don't fail the entire entity
          this.emit('enrichmentError', {
            jobId: job.id,
            entityRef: transformedEntity.entityRef,
            enricherId: enricher.id,
            error: error.message,
          });
          return null;
        })
      );

    const enrichmentResults = await Promise.all(enrichmentPromises);
    
    // Apply successful enrichments
    for (const result of enrichmentResults) {
      if (result && result.data) {
        if (result.data.metadata) {
          transformedEntity.metadata = { ...transformedEntity.metadata, ...result.data.metadata };
        }
        
        if (result.data.spec) {
          transformedEntity.spec = { ...transformedEntity.spec, ...result.data.spec };
        }
        
        if (result.data.relations) {
          transformedEntity.relations = [...(transformedEntity.relations || []), ...result.data.relations];
        }
      }
    }

    // Emit change event
    const changeEvent: EntityChangeEvent = {
      type: 'entity.updated',
      sourceId: entity.sourceId,
      entityRef: transformedEntity.entityRef,
      timestamp: new Date(),
      changeType: 'updated',
      entity: transformedEntity,
      data: { jobId: job.id },
    };
    
    this.emit('entityProcessed', changeEvent);

    return transformedEntity;
  }

  /**
   * Split entities into batches
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    
    return batches;
  }

  /**
   * Create checkpoint for job recovery
   */
  private async createCheckpoint(
    jobId: string,
    processedBatches: number,
    totalBatches: number,
    result: BatchResult
  ): Promise<void> {
    const checkpoint: BatchCheckpoint = {
      jobId,
      processedBatches,
      totalBatches,
      processedEntities: result.processed,
      errors: result.failed,
      timestamp: new Date(),
    };

    this.checkpoints.set(jobId, checkpoint);
    this.emit('checkpointCreated', checkpoint);
  }

  /**
   * Retry operation with exponential backoff
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxAttempts: number
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxAttempts) {
          break;
        }
        
        const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }

  /**
   * Check memory usage and pause if necessary
   */
  private async checkMemoryUsage(): Promise<void> {
    const memoryUsage = process.memoryUsage();
    const memoryUsageMB = memoryUsage.heapUsed / 1024 / 1024;
    
    if (memoryUsageMB > this.config.memoryThreshold) {
      this.emit('highMemoryUsage', { usage: memoryUsageMB, threshold: this.config.memoryThreshold });
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      // Wait a bit to let memory pressure subside
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  /**
   * Get active job information
   */
  getActiveJob(jobId: string): IngestionJob | undefined {
    return this.activeJobs.get(jobId);
  }

  /**
   * Get all active jobs
   */
  getActiveJobs(): IngestionJob[] {
    return Array.from(this.activeJobs.values());
  }

  /**
   * Cancel a running job
   */
  async cancelJob(jobId: string): Promise<void> {
    const job = this.activeJobs.get(jobId);
    
    if (job) {
      job.status = 'cancelled';
      job.completedAt = new Date();
      
      this.emit('jobCancelled', job);
      this.activeJobs.delete(jobId);
    }
  }

  /**
   * Get processing statistics
   */
  getStatistics(): {
    activeJobs: number;
    totalProcessed: number;
    averageProcessingTime: number;
    errorRate: number;
  } {
    const jobs = Array.from(this.activeJobs.values());
    const totalProcessed = jobs.reduce((sum, job) => sum + job.progress.processed, 0);
    const totalErrors = jobs.reduce((sum, job) => sum + job.progress.errors, 0);
    
    return {
      activeJobs: jobs.length,
      totalProcessed,
      averageProcessingTime: 0, // Would calculate from historical data
      errorRate: totalProcessed > 0 ? totalErrors / totalProcessed : 0,
    };
  }
}

export default BatchProcessor;