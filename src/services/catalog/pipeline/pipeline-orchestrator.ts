/**
 * Pipeline Orchestrator
 * 
 * Manages the execution of data processing pipelines with support for
 * complex workflows, dependencies, and error handling.
 */

import { EventEmitter } from 'events';
import cron from 'node-cron';
import {
  PipelineConfig,
  ProcessingStage,
  IngestionJob,
  RawEntityData,
  TransformedEntityData,
  ISourceProcessor,
  IEntityTransformer,
  IEntityValidator,
  IEntityEnricher,
} from '../types';
import { StreamProcessor } from './stream-processor';
import { BatchProcessor } from './batch-processor';

interface PipelineExecution {
  id: string;
  pipelineId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt?: Date;
  completedAt?: Date;
  stages: Array<{
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    startedAt?: Date;
    completedAt?: Date;
    error?: string;
    metrics?: Record<string, unknown>;
  }>;
  error?: string;
  result?: {
    entitiesProcessed: number;
    entitiesCreated: number;
    entitiesUpdated: number;
    entitiesDeleted: number;
    relationshipsCreated: number;
    processingTime: number;
  };
}

interface PipelineContext {
  execution: PipelineExecution;
  data: Map<string, unknown>;
  entities: TransformedEntityData[];
  errors: Array<{ stage: string; error: string; timestamp: Date }>;
}

export class PipelineOrchestrator extends EventEmitter {
  private readonly pipelines = new Map<string, PipelineConfig>();
  private readonly executions = new Map<string, PipelineExecution>();
  private readonly scheduledTasks = new Map<string, cron.ScheduledTask>();
  
  // Processors registry
  private readonly sourceProcessors = new Map<string, ISourceProcessor>();
  private readonly transformers = new Map<string, IEntityTransformer>();
  private readonly validators = new Map<string, IEntityValidator>();
  private readonly enrichers = new Map<string, IEntityEnricher>();
  
  // Processing engines
  private streamProcessor?: StreamProcessor;
  private batchProcessor?: BatchProcessor;

  constructor() {
    super();
  }

  /**
   * Initialize orchestrator with processing engines
   */
  async initialize(
    streamProcessor: StreamProcessor,
    batchProcessor: BatchProcessor
  ): Promise<void> {
    this.streamProcessor = streamProcessor;
    this.batchProcessor = batchProcessor;
    
    // Set up event forwarding
    this.setupEventForwarding();
  }

  /**
   * Register a pipeline configuration
   */
  registerPipeline(config: PipelineConfig): void {
    this.pipelines.set(config.id, config);
    this.setupPipelineTriggers(config);
    
    this.emit('pipelineRegistered', config);
  }

  /**
   * Register processing components
   */
  registerSourceProcessor(processor: ISourceProcessor): void {
    this.sourceProcessors.set(processor.id, processor);
  }

  registerTransformer(transformer: IEntityTransformer): void {
    this.transformers.set(transformer.id, transformer);
    this.streamProcessor?.registerTransformer(transformer);
    this.batchProcessor?.registerTransformer(transformer);
  }

  registerValidator(validator: IEntityValidator): void {
    this.validators.set(validator.id, validator);
    this.streamProcessor?.registerValidator(validator);
    this.batchProcessor?.registerValidator(validator);
  }

  registerEnricher(enricher: IEntityEnricher): void {
    this.enrichers.set(enricher.id, enricher);
    this.streamProcessor?.registerEnricher(enricher);
    this.batchProcessor?.registerEnricher(enricher);
  }

  /**
   * Execute a pipeline
   */
  async executePipeline(
    pipelineId: string,
    context: Partial<PipelineContext> = {}
  ): Promise<PipelineExecution> {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }

    const executionId = `${pipelineId}-${Date.now()}`;
    const execution: PipelineExecution = {
      id: executionId,
      pipelineId,
      status: 'pending',
      stages: pipeline.stages.map(stage => ({
        name: stage.name,
        status: 'pending',
      })),
    };

    this.executions.set(executionId, execution);
    
    const pipelineContext: PipelineContext = {
      execution,
      data: new Map(Object.entries(context.data || {})),
      entities: context.entities || [],
      errors: context.errors || [],
    };

    try {
      execution.status = 'running';
      execution.startedAt = new Date();
      
      this.emit('pipelineStarted', execution);
      
      // Execute stages in dependency order
      const stageExecutionOrder = this.resolveStageDependencies(pipeline.stages);
      
      for (const stageName of stageExecutionOrder) {
        const stage = pipeline.stages.find(s => s.name === stageName)!;
        await this.executeStage(stage, pipelineContext);
        
        if (pipelineContext.execution.stages.find(s => s.name === stageName)?.status === 'failed') {
          throw new Error(`Stage ${stageName} failed`);
        }
      }
      
      execution.status = 'completed';
      execution.completedAt = new Date();
      execution.result = {
        entitiesProcessed: pipelineContext.entities.length,
        entitiesCreated: 0, // Would be tracked by individual stages
        entitiesUpdated: pipelineContext.entities.length,
        entitiesDeleted: 0,
        relationshipsCreated: 0,
        processingTime: execution.completedAt.getTime() - execution.startedAt!.getTime(),
      };
      
      this.emit('pipelineCompleted', execution);
      
    } catch (error) {
      execution.status = 'failed';
      execution.completedAt = new Date();
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      
      this.emit('pipelineFailed', execution);
    }

    return execution;
  }

  /**
   * Execute a single stage
   */
  private async executeStage(
    stage: ProcessingStage,
    context: PipelineContext
  ): Promise<void> {
    const stageState = context.execution.stages.find(s => s.name === stage.name)!;
    
    try {
      stageState.status = 'running';
      stageState.startedAt = new Date();
      
      this.emit('stageStarted', { execution: context.execution, stage });
      
      switch (stage.type) {
        case 'source':
          await this.executeSourceStage(stage, context);
          break;
          
        case 'transformer':
          await this.executeTransformerStage(stage, context);
          break;
          
        case 'validator':
          await this.executeValidatorStage(stage, context);
          break;
          
        case 'enricher':
          await this.executeEnricherStage(stage, context);
          break;
          
        case 'sink':
          await this.executeSinkStage(stage, context);
          break;
          
        default:
          throw new Error(`Unknown stage type: ${stage.type}`);
      }
      
      stageState.status = 'completed';
      stageState.completedAt = new Date();
      
      this.emit('stageCompleted', { execution: context.execution, stage });
      
    } catch (error) {
      stageState.status = 'failed';
      stageState.completedAt = new Date();
      stageState.error = error instanceof Error ? error.message : 'Unknown error';
      
      context.errors.push({
        stage: stage.name,
        error: stageState.error,
        timestamp: new Date(),
      });
      
      this.emit('stageFailed', { execution: context.execution, stage, error });
      
      // Apply retry policy if configured
      if (stage.retryPolicy) {
        const retryResult = await this.retryStage(stage, context);
        if (retryResult) {
          stageState.status = 'completed';
          stageState.error = undefined;
          return;
        }
      }
      
      throw error;
    }
  }

  /**
   * Execute source stage
   */
  private async executeSourceStage(
    stage: ProcessingStage,
    context: PipelineContext
  ): Promise<void> {
    const processorId = stage.config.processorId as string;
    const processor = this.sourceProcessors.get(processorId);
    
    if (!processor) {
      throw new Error(`Source processor ${processorId} not found`);
    }
    
    await processor.initialize(stage.config);
    
    const rawEntities = await processor.discover();
    
    // Convert raw entities to transformed entities (basic transformation)
    context.entities = rawEntities.map(raw => ({
      id: raw.id,
      sourceId: raw.sourceId,
      entityRef: `${raw.type}:default/${raw.id}`,
      kind: raw.type,
      metadata: {
        name: raw.id,
        namespace: 'default',
      },
      spec: raw.data,
      rawData: raw,
      transformedBy: ['source'],
    }));
    
    await processor.cleanup();
  }

  /**
   * Execute transformer stage
   */
  private async executeTransformerStage(
    stage: ProcessingStage,
    context: PipelineContext
  ): Promise<void> {
    const transformerId = stage.config.transformerId as string;
    const transformer = this.transformers.get(transformerId);
    
    if (!transformer) {
      throw new Error(`Transformer ${transformerId} not found`);
    }
    
    const transformedEntities: TransformedEntityData[] = [];
    
    for (const entity of context.entities) {
      if (transformer.canTransform(entity.rawData)) {
        const transformed = await transformer.transform(entity.rawData);
        transformedEntities.push(transformed);
      } else {
        // Pass through unchanged
        transformedEntities.push(entity);
      }
    }
    
    context.entities = transformedEntities;
  }

  /**
   * Execute validator stage
   */
  private async executeValidatorStage(
    stage: ProcessingStage,
    context: PipelineContext
  ): Promise<void> {
    const validatorId = stage.config.validatorId as string;
    const validator = this.validators.get(validatorId);
    
    if (!validator) {
      throw new Error(`Validator ${validatorId} not found`);
    }
    
    const validEntities: TransformedEntityData[] = [];
    const errors: string[] = [];
    
    for (const entity of context.entities) {
      const result = await validator.validate(entity);
      
      if (result.valid) {
        validEntities.push(entity);
      } else {
        errors.push(`Entity ${entity.entityRef}: ${result.errors.map(e => e.message).join(', ')}`);
      }
    }
    
    if (errors.length > 0 && stage.config.failOnValidationError !== false) {
      throw new Error(`Validation failed: ${errors.join('; ')}`);
    }
    
    context.entities = validEntities;
  }

  /**
   * Execute enricher stage
   */
  private async executeEnricherStage(
    stage: ProcessingStage,
    context: PipelineContext
  ): Promise<void> {
    const enricherId = stage.config.enricherId as string;
    const enricher = this.enrichers.get(enricherId);
    
    if (!enricher) {
      throw new Error(`Enricher ${enricherId} not found`);
    }
    
    for (const entity of context.entities) {
      if (enricher.canEnrich(entity)) {
        try {
          const result = await enricher.enrich(entity);
          
          // Apply enrichment data
          if (result.data.metadata) {
            entity.metadata = { ...entity.metadata, ...result.data.metadata };
          }
          
          if (result.data.spec) {
            entity.spec = { ...entity.spec, ...result.data.spec };
          }
          
          if (result.data.relations) {
            entity.relations = [...(entity.relations || []), ...result.data.relations];
          }
          
        } catch (error) {
          // Log enrichment errors but don't fail the stage
          this.emit('enrichmentError', {
            entityRef: entity.entityRef,
            enricherId: enricher.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }
  }

  /**
   * Execute sink stage
   */
  private async executeSinkStage(
    stage: ProcessingStage,
    context: PipelineContext
  ): Promise<void> {
    const sinkType = stage.config.sinkType as string;
    
    switch (sinkType) {
      case 'catalog':
        // Persist entities to catalog storage
        for (const entity of context.entities) {
          this.emit('entityPersisted', entity);
        }
        break;
        
      case 'stream':
        // Send entities to stream processor
        if (this.streamProcessor) {
          for (const entity of context.entities) {
            await this.streamProcessor.enqueueEntity(entity.rawData);
          }
        }
        break;
        
      default:
        throw new Error(`Unknown sink type: ${sinkType}`);
    }
  }

  /**
   * Retry a failed stage
   */
  private async retryStage(
    stage: ProcessingStage,
    context: PipelineContext
  ): Promise<boolean> {
    const retryPolicy = stage.retryPolicy!;
    
    for (let attempt = 1; attempt <= retryPolicy.maxAttempts; attempt++) {
      try {
        const delay = Math.min(
          1000 * Math.pow(retryPolicy.backoffMultiplier, attempt - 1),
          retryPolicy.maxDelay
        );
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        await this.executeStage(stage, context);
        return true;
        
      } catch (error) {
        if (attempt === retryPolicy.maxAttempts) {
          return false;
        }
      }
    }
    
    return false;
  }

  /**
   * Resolve stage execution order based on dependencies
   */
  private resolveStageDependencies(stages: ProcessingStage[]): string[] {
    const resolved: string[] = [];
    const resolving = new Set<string>();
    
    const resolve = (stageName: string) => {
      if (resolved.includes(stageName)) {
        return;
      }
      
      if (resolving.has(stageName)) {
        throw new Error(`Circular dependency detected involving stage: ${stageName}`);
      }
      
      resolving.add(stageName);
      
      const stage = stages.find(s => s.name === stageName);
      if (!stage) {
        throw new Error(`Stage not found: ${stageName}`);
      }
      
      // Resolve dependencies first
      for (const dependency of stage.dependencies) {
        resolve(dependency);
      }
      
      resolving.delete(stageName);
      resolved.push(stageName);
    };
    
    // Resolve all stages
    for (const stage of stages) {
      resolve(stage.name);
    }
    
    return resolved;
  }

  /**
   * Set up pipeline triggers
   */
  private setupPipelineTriggers(config: PipelineConfig): void {
    for (const trigger of config.triggers) {
      switch (trigger.type) {
        case 'schedule':
          this.setupScheduleTrigger(config.id, trigger.config as { cron: string });
          break;
          
        case 'webhook':
          this.setupWebhookTrigger(config.id, trigger.config);
          break;
          
        // Other trigger types would be implemented here
      }
    }
  }

  /**
   * Set up schedule trigger
   */
  private setupScheduleTrigger(pipelineId: string, config: { cron: string }): void {
    const task = cron.schedule(config.cron, async () => {
      try {
        await this.executePipeline(pipelineId);
      } catch (error) {
        this.emit('scheduledExecutionFailed', { pipelineId, error });
      }
    }, { scheduled: true });
    
    this.scheduledTasks.set(pipelineId, task);
  }

  /**
   * Set up webhook trigger
   */
  private setupWebhookTrigger(pipelineId: string, config: Record<string, unknown>): void {
    // This would integrate with a webhook server
    this.emit('webhookTriggerSetup', { pipelineId, config });
  }

  /**
   * Set up event forwarding from processing engines
   */
  private setupEventForwarding(): void {
    if (this.streamProcessor) {
      this.streamProcessor.on('entityProcessed', (event) => {
        this.emit('entityProcessed', event);
      });
    }
    
    if (this.batchProcessor) {
      this.batchProcessor.on('jobCompleted', (job) => {
        this.emit('batchJobCompleted', job);
      });
    }
  }

  /**
   * Get pipeline execution status
   */
  getExecution(executionId: string): PipelineExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Cancel pipeline execution
   */
  async cancelExecution(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    
    if (execution && execution.status === 'running') {
      execution.status = 'cancelled';
      execution.completedAt = new Date();
      
      this.emit('pipelineCancelled', execution);
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    // Stop all scheduled tasks
    for (const task of this.scheduledTasks.values()) {
      task.stop();
    }
    this.scheduledTasks.clear();
    
    // Clean up source processors
    for (const processor of this.sourceProcessors.values()) {
      await processor.cleanup();
    }
  }
}

export default PipelineOrchestrator;