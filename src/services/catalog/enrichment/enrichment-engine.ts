/**
 * Metadata Enrichment Engine
 * 
 * Orchestrates multiple enrichers to augment entity data with additional
 * context, metrics, and insights from various sources.
 */

import { EventEmitter } from 'events';
import {
  TransformedEntityData,
  IEntityEnricher,
  EntityEnrichmentResult,
} from '../types';

interface EnrichmentPipeline {
  id: string;
  name: string;
  enrichers: string[];
  parallel: boolean;
  condition?: (entity: TransformedEntityData) => boolean;
  priority: number;
}

interface EnrichmentResult {
  entityRef: string;
  enrichments: Map<string, EntityEnrichmentResult>;
  totalProcessingTime: number;
  successCount: number;
  errorCount: number;
  errors: Array<{
    enricherId: string;
    error: string;
    timestamp: Date;
  }>;
}

interface EnrichmentMetrics {
  totalEntitiesProcessed: number;
  totalEnrichmentsApplied: number;
  averageProcessingTime: number;
  successRate: number;
  enricherPerformance: Map<string, {
    totalRuns: number;
    successfulRuns: number;
    averageTime: number;
    errorRate: number;
  }>;
}

export class EnrichmentEngine extends EventEmitter {
  private readonly enrichers = new Map<string, IEntityEnricher>();
  private readonly pipelines = new Map<string, EnrichmentPipeline>();
  private readonly metrics: EnrichmentMetrics = {
    totalEntitiesProcessed: 0,
    totalEnrichmentsApplied: 0,
    averageProcessingTime: 0,
    successRate: 0,
    enricherPerformance: new Map(),
  };

  constructor() {
    super();
  }

  /**
   * Register an enricher
   */
  registerEnricher(enricher: IEntityEnricher): void {
    this.enrichers.set(enricher.id, enricher);
    
    // Initialize metrics for this enricher
    this.metrics.enricherPerformance.set(enricher.id, {
      totalRuns: 0,
      successfulRuns: 0,
      averageTime: 0,
      errorRate: 0,
    });

    this.emit('enricherRegistered', enricher);
  }

  /**
   * Register an enrichment pipeline
   */
  registerPipeline(pipeline: EnrichmentPipeline): void {
    // Validate that all enrichers exist
    for (const enricherId of pipeline.enrichers) {
      if (!this.enrichers.has(enricherId)) {
        throw new Error(`Enricher ${enricherId} not found for pipeline ${pipeline.id}`);
      }
    }

    this.pipelines.set(pipeline.id, pipeline);
    this.emit('pipelineRegistered', pipeline);
  }

  /**
   * Enrich a single entity
   */
  async enrichEntity(entity: TransformedEntityData): Promise<EnrichmentResult> {
    const startTime = Date.now();
    const result: EnrichmentResult = {
      entityRef: entity.entityRef,
      enrichments: new Map(),
      totalProcessingTime: 0,
      successCount: 0,
      errorCount: 0,
      errors: [],
    };

    this.emit('enrichmentStarted', { entityRef: entity.entityRef });

    try {
      // Find applicable pipelines
      const applicablePipelines = Array.from(this.pipelines.values())
        .filter(pipeline => !pipeline.condition || pipeline.condition(entity))
        .sort((a, b) => b.priority - a.priority);

      // Execute pipelines
      for (const pipeline of applicablePipelines) {
        await this.executePipeline(pipeline, entity, result);
      }

      // Execute remaining enrichers not in any pipeline
      const pipelineEnrichers = new Set(
        applicablePipelines.flatMap(p => p.enrichers)
      );

      const remainingEnrichers = Array.from(this.enrichers.values())
        .filter(enricher => 
          !pipelineEnrichers.has(enricher.id) && 
          enricher.canEnrich(entity)
        );

      for (const enricher of remainingEnrichers) {
        await this.executeEnricher(enricher, entity, result);
      }

      result.totalProcessingTime = Date.now() - startTime;
      
      // Update metrics
      this.updateMetrics(result);

      this.emit('enrichmentCompleted', result);

    } catch (error) {
      result.totalProcessingTime = Date.now() - startTime;
      result.errors.push({
        enricherId: 'engine',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      });
      
      this.emit('enrichmentFailed', { entityRef: entity.entityRef, error });
    }

    return result;
  }

  /**
   * Enrich multiple entities
   */
  async enrichEntities(
    entities: TransformedEntityData[], 
    options: { 
      parallel?: boolean; 
      maxConcurrency?: number; 
      batchSize?: number;
    } = {}
  ): Promise<EnrichmentResult[]> {
    const { parallel = true, maxConcurrency = 5, batchSize = 10 } = options;
    
    this.emit('bulkEnrichmentStarted', { entityCount: entities.length });

    if (parallel) {
      return this.enrichEntitiesInParallel(entities, maxConcurrency);
    } else {
      return this.enrichEntitiesInBatches(entities, batchSize);
    }
  }

  /**
   * Execute enrichment pipeline
   */
  private async executePipeline(
    pipeline: EnrichmentPipeline,
    entity: TransformedEntityData,
    result: EnrichmentResult
  ): Promise<void> {
    this.emit('pipelineStarted', { pipelineId: pipeline.id, entityRef: entity.entityRef });

    const enrichers = pipeline.enrichers
      .map(id => this.enrichers.get(id))
      .filter((enricher): enricher is IEntityEnricher => 
        enricher !== undefined && enricher.canEnrich(entity)
      );

    if (pipeline.parallel) {
      // Execute enrichers in parallel
      const promises = enrichers.map(enricher => 
        this.executeEnricher(enricher, entity, result)
          .catch(error => {
            // Log error but don't fail the entire pipeline
            result.errors.push({
              enricherId: enricher.id,
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date(),
            });
          })
      );

      await Promise.all(promises);
    } else {
      // Execute enrichers sequentially
      for (const enricher of enrichers) {
        try {
          await this.executeEnricher(enricher, entity, result);
        } catch (error) {
          result.errors.push({
            enricherId: enricher.id,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date(),
          });
          
          // Continue with next enricher
        }
      }
    }

    this.emit('pipelineCompleted', { pipelineId: pipeline.id, entityRef: entity.entityRef });
  }

  /**
   * Execute a single enricher
   */
  private async executeEnricher(
    enricher: IEntityEnricher,
    entity: TransformedEntityData,
    result: EnrichmentResult
  ): Promise<void> {
    const startTime = Date.now();
    const enricherMetrics = this.metrics.enricherPerformance.get(enricher.id)!;
    
    try {
      this.emit('enricherStarted', { enricherId: enricher.id, entityRef: entity.entityRef });

      const enrichmentResult = await enricher.enrich(entity);
      const processingTime = Date.now() - startTime;

      result.enrichments.set(enricher.id, enrichmentResult);
      result.successCount++;

      // Update enricher metrics
      enricherMetrics.totalRuns++;
      enricherMetrics.successfulRuns++;
      enricherMetrics.averageTime = (
        (enricherMetrics.averageTime * (enricherMetrics.successfulRuns - 1)) + processingTime
      ) / enricherMetrics.successfulRuns;

      this.emit('enricherCompleted', { 
        enricherId: enricher.id, 
        entityRef: entity.entityRef, 
        processingTime 
      });

      // Apply enrichment to entity
      this.applyEnrichment(entity, enrichmentResult);

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      result.errorCount++;
      result.errors.push({
        enricherId: enricher.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      });

      // Update enricher metrics
      enricherMetrics.totalRuns++;
      enricherMetrics.errorRate = (enricherMetrics.totalRuns - enricherMetrics.successfulRuns) / enricherMetrics.totalRuns;

      this.emit('enricherFailed', { 
        enricherId: enricher.id, 
        entityRef: entity.entityRef, 
        error, 
        processingTime 
      });

      throw error;
    }
  }

  /**
   * Apply enrichment result to entity
   */
  private applyEnrichment(
    entity: TransformedEntityData,
    enrichmentResult: EntityEnrichmentResult
  ): void {
    const { data } = enrichmentResult;

    // Merge metadata
    if (data.metadata) {
      entity.metadata = {
        ...entity.metadata,
        ...data.metadata as any,
      };
    }

    // Merge spec
    if (data.spec) {
      entity.spec = {
        ...entity.spec,
        ...data.spec as Record<string, unknown>,
      };
    }

    // Merge relations
    if (data.relations && Array.isArray(data.relations)) {
      entity.relations = [
        ...(entity.relations || []),
        ...data.relations,
      ];
    }

    // Add enrichment annotations
    if (!entity.metadata.annotations) {
      entity.metadata.annotations = {};
    }

    const enrichmentKey = `backstage.io/enriched-by`;
    const existingEnrichments = entity.metadata.annotations[enrichmentKey] || '';
    const enrichments = existingEnrichments ? 
      `${existingEnrichments},${enrichmentResult.enricherId}` :
      enrichmentResult.enricherId;

    entity.metadata.annotations[enrichmentKey] = enrichments;
    entity.metadata.annotations[`backstage.io/enrichment-${enrichmentResult.enricherId}-timestamp`] = 
      enrichmentResult.timestamp.toISOString();
    entity.metadata.annotations[`backstage.io/enrichment-${enrichmentResult.enricherId}-confidence`] = 
      enrichmentResult.confidence.toString();
  }

  /**
   * Enrich entities in parallel
   */
  private async enrichEntitiesInParallel(
    entities: TransformedEntityData[],
    maxConcurrency: number
  ): Promise<EnrichmentResult[]> {
    const results: EnrichmentResult[] = [];
    const semaphore = new Array(maxConcurrency).fill(null);
    
    const processEntity = async (entity: TransformedEntityData): Promise<void> => {
      const result = await this.enrichEntity(entity);
      results.push(result);
    };

    await Promise.all(
      entities.map(async (entity, index) => {
        const semaphoreIndex = index % maxConcurrency;
        await semaphore[semaphoreIndex]; // Wait for slot
        semaphore[semaphoreIndex] = processEntity(entity);
        return semaphore[semaphoreIndex];
      })
    );

    return results;
  }

  /**
   * Enrich entities in batches
   */
  private async enrichEntitiesInBatches(
    entities: TransformedEntityData[],
    batchSize: number
  ): Promise<EnrichmentResult[]> {
    const results: EnrichmentResult[] = [];
    
    for (let i = 0; i < entities.length; i += batchSize) {
      const batch = entities.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(entity => this.enrichEntity(entity))
      );
      
      results.push(...batchResults);
      
      this.emit('batchCompleted', { 
        batchIndex: Math.floor(i / batchSize) + 1,
        totalBatches: Math.ceil(entities.length / batchSize),
        processed: Math.min(i + batchSize, entities.length),
        total: entities.length,
      });
    }

    return results;
  }

  /**
   * Update engine metrics
   */
  private updateMetrics(result: EnrichmentResult): void {
    this.metrics.totalEntitiesProcessed++;
    this.metrics.totalEnrichmentsApplied += result.successCount;
    
    // Update average processing time
    const totalTime = this.metrics.averageProcessingTime * (this.metrics.totalEntitiesProcessed - 1);
    this.metrics.averageProcessingTime = (totalTime + result.totalProcessingTime) / this.metrics.totalEntitiesProcessed;
    
    // Update success rate
    const totalOperations = this.metrics.totalEnrichmentsApplied + 
      Array.from(this.metrics.enricherPerformance.values())
        .reduce((sum, metrics) => sum + (metrics.totalRuns - metrics.successfulRuns), 0);
    
    this.metrics.successRate = totalOperations > 0 ? this.metrics.totalEnrichmentsApplied / totalOperations : 0;
  }

  /**
   * Get enrichment metrics
   */
  getMetrics(): EnrichmentMetrics {
    return {
      ...this.metrics,
      enricherPerformance: new Map(this.metrics.enricherPerformance),
    };
  }

  /**
   * Get enricher by ID
   */
  getEnricher(enricherId: string): IEntityEnricher | undefined {
    return this.enrichers.get(enricherId);
  }

  /**
   * Get all registered enrichers
   */
  getEnrichers(): IEntityEnricher[] {
    return Array.from(this.enrichers.values());
  }

  /**
   * Get pipeline by ID
   */
  getPipeline(pipelineId: string): EnrichmentPipeline | undefined {
    return this.pipelines.get(pipelineId);
  }

  /**
   * Get all registered pipelines
   */
  getPipelines(): EnrichmentPipeline[] {
    return Array.from(this.pipelines.values());
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics.totalEntitiesProcessed = 0;
    this.metrics.totalEnrichmentsApplied = 0;
    this.metrics.averageProcessingTime = 0;
    this.metrics.successRate = 0;
    this.metrics.enricherPerformance.clear();
    
    // Reinitialize enricher metrics
    for (const enricherId of this.enrichers.keys()) {
      this.metrics.enricherPerformance.set(enricherId, {
        totalRuns: 0,
        successfulRuns: 0,
        averageTime: 0,
        errorRate: 0,
      });
    }

    this.emit('metricsReset');
  }
}

export default EnrichmentEngine;