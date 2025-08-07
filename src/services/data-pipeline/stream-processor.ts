import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { Transform, Readable, Writable } from 'stream';
import { v4 as uuidv4 } from 'uuid';

/**
 * Stream processing modes
 */
export enum StreamMode {
  REAL_TIME = 'real_time',
  MICRO_BATCH = 'micro_batch',
  SLIDING_WINDOW = 'sliding_window',
  TUMBLING_WINDOW = 'tumbling_window',
  SESSION_WINDOW = 'session_window',
  CUSTOM = 'custom'
}

/**
 * Stream aggregation types
 */
export enum AggregationType {
  COUNT = 'count',
  SUM = 'sum',
  AVG = 'avg',
  MIN = 'min',
  MAX = 'max',
  MEDIAN = 'median',
  PERCENTILE = 'percentile',
  DISTINCT_COUNT = 'distinct_count',
  FIRST = 'first',
  LAST = 'last',
  COLLECT_LIST = 'collect_list',
  COLLECT_SET = 'collect_set',
  STDDEV = 'stddev',
  VARIANCE = 'variance'
}

/**
 * Stream join types
 */
export enum JoinType {
  INNER = 'inner',
  LEFT_OUTER = 'left_outer',
  RIGHT_OUTER = 'right_outer',
  FULL_OUTER = 'full_outer',
  CROSS = 'cross',
  SEMI = 'semi',
  ANTI = 'anti'
}

/**
 * Event time handling strategies
 */
export enum EventTimeStrategy {
  PROCESSING_TIME = 'processing_time',
  EVENT_TIME = 'event_time',
  INGESTION_TIME = 'ingestion_time'
}

/**
 * Stream configuration
 */
export interface StreamConfig {
  id: string;
  name: string;
  description?: string;
  mode: StreamMode;
  sources: StreamSource[];
  operations: StreamOperation[];
  sinks: StreamSink[];
  windowConfig?: WindowConfig;
  checkpointConfig?: CheckpointConfig;
  errorHandling?: StreamErrorHandling;
  scaling?: ScalingConfig;
  monitoring?: StreamMonitoringConfig;
  metadata?: Record<string, any>;
}

/**
 * Stream source configuration
 */
export interface StreamSource {
  id: string;
  type: string;
  config: Record<string, any>;
  schema?: StreamSchema;
  deserializer?: DeserializerConfig;
  offset?: OffsetConfig;
  partitioning?: PartitioningConfig;
  watermark?: WatermarkConfig;
}

/**
 * Stream sink configuration
 */
export interface StreamSink {
  id: string;
  type: string;
  config: Record<string, any>;
  serializer?: SerializerConfig;
  partitioning?: PartitioningConfig;
  consistency?: ConsistencyConfig;
  idempotency?: IdempotencyConfig;
}

/**
 * Stream operation configuration
 */
export interface StreamOperation {
  id: string;
  type: string;
  name: string;
  config: Record<string, any>;
  dependencies?: string[];
  parallelism?: number;
  timeout?: number;
  retryPolicy?: StreamRetryPolicy;
}

/**
 * Window configuration
 */
export interface WindowConfig {
  type: 'time' | 'count' | 'session';
  size?: number;
  slide?: number;
  gap?: number;
  trigger?: TriggerConfig;
  allowedLateness?: number;
  eventTimeStrategy: EventTimeStrategy;
}

/**
 * Trigger configuration
 */
export interface TriggerConfig {
  type: 'processing_time' | 'event_time' | 'count' | 'custom';
  interval?: number;
  condition?: string;
}

/**
 * Checkpoint configuration
 */
export interface CheckpointConfig {
  enabled: boolean;
  interval: number;
  mode: 'exactly_once' | 'at_least_once';
  storage: string;
  compression?: boolean;
  cleanup?: boolean;
}

/**
 * Stream error handling
 */
export interface StreamErrorHandling {
  strategy: 'fail' | 'skip' | 'retry' | 'dead_letter';
  deadLetterQueue?: string;
  maxRetries?: number;
  retryDelay?: number;
  skipPolicy?: string;
}

/**
 * Stream retry policy
 */
export interface StreamRetryPolicy {
  maxRetries: number;
  backoffStrategy: 'fixed' | 'linear' | 'exponential';
  initialDelay: number;
  maxDelay: number;
  multiplier?: number;
}

/**
 * Scaling configuration
 */
export interface ScalingConfig {
  enabled: boolean;
  minParallelism: number;
  maxParallelism: number;
  targetThroughput: number;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  cooldownPeriod: number;
}

/**
 * Stream monitoring configuration
 */
export interface StreamMonitoringConfig {
  enabled: boolean;
  metrics: string[];
  alerting: StreamAlertConfig[];
  sampling?: SamplingConfig;
}

/**
 * Stream alert configuration
 */
export interface StreamAlertConfig {
  name: string;
  condition: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  actions: AlertAction[];
}

/**
 * Alert action
 */
export interface AlertAction {
  type: 'email' | 'slack' | 'webhook' | 'pager';
  config: Record<string, any>;
}

/**
 * Sampling configuration
 */
export interface SamplingConfig {
  enabled: boolean;
  rate: number;
  strategy: 'uniform' | 'reservoir' | 'stratified';
}

/**
 * Stream schema
 */
export interface StreamSchema {
  version: string;
  fields: StreamField[];
  primaryKey?: string[];
  eventTimeField?: string;
  watermarkField?: string;
}

/**
 * Stream field
 */
export interface StreamField {
  name: string;
  type: string;
  nullable: boolean;
  metadata?: Record<string, any>;
}

/**
 * Deserializer configuration
 */
export interface DeserializerConfig {
  type: 'json' | 'avro' | 'protobuf' | 'csv' | 'xml';
  config: Record<string, any>;
  errorHandling?: 'fail' | 'skip' | 'default';
}

/**
 * Serializer configuration
 */
export interface SerializerConfig {
  type: 'json' | 'avro' | 'protobuf' | 'csv' | 'xml';
  config: Record<string, any>;
}

/**
 * Offset configuration
 */
export interface OffsetConfig {
  strategy: 'earliest' | 'latest' | 'timestamp' | 'specific';
  value?: string | number;
  autoCommit?: boolean;
  commitInterval?: number;
}

/**
 * Partitioning configuration
 */
export interface PartitioningConfig {
  strategy: 'round_robin' | 'hash' | 'range' | 'custom';
  key?: string;
  partitions?: number;
  customPartitioner?: string;
}

/**
 * Consistency configuration
 */
export interface ConsistencyConfig {
  level: 'eventual' | 'strong' | 'session';
  timeout?: number;
}

/**
 * Idempotency configuration
 */
export interface IdempotencyConfig {
  enabled: boolean;
  keyExtractor?: string;
  storage?: string;
  ttl?: number;
}

/**
 * Watermark configuration
 */
export interface WatermarkConfig {
  strategy: 'bounded' | 'punctuated' | 'heuristic';
  maxOutOfOrderness?: number;
  idleTimeout?: number;
}

/**
 * Stream event
 */
export interface StreamEvent {
  id: string;
  timestamp: Date;
  eventTime?: Date;
  key?: string;
  data: any;
  headers?: Record<string, string>;
  partition?: number;
  offset?: number;
  metadata?: Record<string, any>;
}

/**
 * Stream window
 */
export interface StreamWindow {
  id: string;
  start: Date;
  end: Date;
  type: 'time' | 'count' | 'session';
  events: StreamEvent[];
  metadata?: Record<string, any>;
}

/**
 * Stream processing context
 */
export interface StreamContext {
  streamId: string;
  operationId?: string;
  partition?: number;
  timestamp: Date;
  watermark?: Date;
  checkpoint?: CheckpointInfo;
  metrics: StreamMetrics;
  metadata: Record<string, any>;
}

/**
 * Stream metrics
 */
export interface StreamMetrics {
  throughput: number;
  latency: number;
  backpressure: number;
  errorRate: number;
  recordsProcessed: number;
  recordsFiltered: number;
  watermarkDelay: number;
  checkpointDuration: number;
  cpuUsage: number;
  memoryUsage: number;
}

/**
 * Checkpoint information
 */
export interface CheckpointInfo {
  id: string;
  timestamp: Date;
  offsets: Record<string, number>;
  metadata: Record<string, any>;
}

/**
 * Stream processing state
 */
export interface StreamState {
  streamId: string;
  status: 'running' | 'paused' | 'stopped' | 'failed';
  startTime: Date;
  lastCheckpoint?: Date;
  totalProcessed: number;
  currentThroughput: number;
  parallelism: number;
  errors: StreamError[];
}

/**
 * Stream error
 */
export interface StreamError {
  id: string;
  timestamp: Date;
  operationId?: string;
  message: string;
  data?: any;
  stackTrace?: string;
  retry?: number;
}

/**
 * Advanced Stream Processor with real-time capabilities
 */
export class StreamProcessor extends EventEmitter {
  private streams: Map<string, StreamConfig> = new Map();
  private states: Map<string, StreamState> = new Map();
  private sources: Map<string, StreamSourceAdapter> = new Map();
  private sinks: Map<string, StreamSinkAdapter> = new Map();
  private operators: Map<string, StreamOperator> = new Map();
  private windows: Map<string, WindowManager> = new Map();
  private checkpoints: Map<string, CheckpointManager> = new Map();
  private logger: Logger;
  private metricsCollector: StreamMetricsCollector;

  constructor(logger: Logger) {
    super();
    this.logger = logger;
    this.metricsCollector = new StreamMetricsCollector();
    this.initializeBuiltInComponents();
  }

  /**
   * Register a stream processing job
   */
  async registerStream(config: StreamConfig): Promise<void> {
    try {
      this.validateStreamConfig(config);
      this.streams.set(config.id, config);

      // Initialize state
      const state: StreamState = {
        streamId: config.id,
        status: 'stopped',
        startTime: new Date(),
        totalProcessed: 0,
        currentThroughput: 0,
        parallelism: this.calculateParallelism(config),
        errors: []
      };
      this.states.set(config.id, state);

      // Initialize window managers if needed
      if (config.windowConfig) {
        this.windows.set(config.id, new WindowManager(config.windowConfig));
      }

      // Initialize checkpoint manager if enabled
      if (config.checkpointConfig?.enabled) {
        this.checkpoints.set(config.id, new CheckpointManager(config.checkpointConfig));
      }

      this.logger.info(`Stream registered successfully`, {
        streamId: config.id,
        name: config.name,
        mode: config.mode
      });

      this.emit('stream:registered', config);

    } catch (error) {
      this.logger.error(`Failed to register stream: ${error.message}`, {
        streamId: config.id,
        error: error.stack
      });
      throw error;
    }
  }

  /**
   * Start stream processing
   */
  async startStream(streamId: string): Promise<void> {
    try {
      const config = this.streams.get(streamId);
      if (!config) {
        throw new Error(`Stream not found: ${streamId}`);
      }

      const state = this.states.get(streamId);
      if (!state) {
        throw new Error(`Stream state not found: ${streamId}`);
      }

      if (state.status === 'running') {
        this.logger.warn(`Stream already running`, { streamId });
        return;
      }

      state.status = 'running';
      state.startTime = new Date();

      this.logger.info(`Starting stream processing`, {
        streamId,
        name: config.name,
        mode: config.mode
      });

      // Create processing pipeline based on mode
      switch (config.mode) {
        case StreamMode.REAL_TIME:
          await this.startRealTimeProcessing(config, state);
          break;
        case StreamMode.MICRO_BATCH:
          await this.startMicroBatchProcessing(config, state);
          break;
        case StreamMode.SLIDING_WINDOW:
          await this.startWindowProcessing(config, state, 'sliding');
          break;
        case StreamMode.TUMBLING_WINDOW:
          await this.startWindowProcessing(config, state, 'tumbling');
          break;
        case StreamMode.SESSION_WINDOW:
          await this.startSessionWindowProcessing(config, state);
          break;
        default:
          await this.startCustomProcessing(config, state);
      }

      this.emit('stream:started', { streamId, state });

    } catch (error) {
      const state = this.states.get(streamId);
      if (state) {
        state.status = 'failed';
        state.errors.push({
          id: uuidv4(),
          timestamp: new Date(),
          message: error.message,
          stackTrace: error.stack
        });
      }

      this.logger.error(`Failed to start stream: ${error.message}`, {
        streamId,
        error: error.stack
      });

      this.emit('stream:failed', { streamId, error });
      throw error;
    }
  }

  /**
   * Stop stream processing
   */
  async stopStream(streamId: string): Promise<void> {
    try {
      const state = this.states.get(streamId);
      if (!state) {
        throw new Error(`Stream state not found: ${streamId}`);
      }

      if (state.status === 'stopped') {
        this.logger.warn(`Stream already stopped`, { streamId });
        return;
      }

      state.status = 'stopped';

      // Perform final checkpoint if enabled
      const checkpointManager = this.checkpoints.get(streamId);
      if (checkpointManager) {
        await checkpointManager.finalCheckpoint();
      }

      this.logger.info(`Stream stopped`, { streamId });
      this.emit('stream:stopped', { streamId, state });

    } catch (error) {
      this.logger.error(`Failed to stop stream: ${error.message}`, {
        streamId,
        error: error.stack
      });
      throw error;
    }
  }

  /**
   * Pause stream processing
   */
  async pauseStream(streamId: string): Promise<void> {
    const state = this.states.get(streamId);
    if (state && state.status === 'running') {
      state.status = 'paused';
      this.emit('stream:paused', { streamId, state });
    }
  }

  /**
   * Resume stream processing
   */
  async resumeStream(streamId: string): Promise<void> {
    const state = this.states.get(streamId);
    if (state && state.status === 'paused') {
      state.status = 'running';
      this.emit('stream:resumed', { streamId, state });
    }
  }

  /**
   * Start real-time processing
   */
  private async startRealTimeProcessing(
    config: StreamConfig,
    state: StreamState
  ): Promise<void> {
    const context: StreamContext = {
      streamId: config.id,
      timestamp: new Date(),
      metrics: this.initializeMetrics(),
      metadata: {}
    };

    // Create source streams
    const sourceStreams = await Promise.all(
      config.sources.map(async source => {
        const adapter = this.sources.get(source.type);
        if (!adapter) {
          throw new Error(`Source adapter not found: ${source.type}`);
        }
        return adapter.createStream(source);
      })
    );

    // Create processing pipeline
    const transformStream = this.createProcessingPipeline(config.operations, context);

    // Create sink streams
    const sinkStreams = await Promise.all(
      config.sinks.map(async sink => {
        const adapter = this.sinks.get(sink.type);
        if (!adapter) {
          throw new Error(`Sink adapter not found: ${sink.type}`);
        }
        return adapter.createStream(sink);
      })
    );

    // Connect streams
    const mergedSource = this.mergeStreams(sourceStreams);
    const monitoringStream = this.createMonitoringStream(context);
    const errorHandlingStream = this.createErrorHandlingStream(config.errorHandling, context);

    // Set up pipeline
    mergedSource
      .pipe(transformStream)
      .pipe(monitoringStream)
      .pipe(errorHandlingStream);

    // Connect to sinks
    for (const sinkStream of sinkStreams) {
      errorHandlingStream.pipe(sinkStream);
    }

    // Set up checkpointing if enabled
    if (config.checkpointConfig?.enabled) {
      this.setupCheckpointing(config, context);
    }
  }

  /**
   * Start micro-batch processing
   */
  private async startMicroBatchProcessing(
    config: StreamConfig,
    state: StreamState
  ): Promise<void> {
    const batchSize = config.metadata?.batchSize || 1000;
    const batchInterval = config.metadata?.batchInterval || 5000; // 5 seconds

    const processBatch = async () => {
      if (state.status !== 'running') return;

      try {
        const context: StreamContext = {
          streamId: config.id,
          timestamp: new Date(),
          metrics: this.initializeMetrics(),
          metadata: { batchSize }
        };

        // Collect batch from sources
        const batch = await this.collectBatch(config.sources, batchSize);
        
        if (batch.length > 0) {
          // Process batch
          const processedBatch = await this.processBatch(batch, config.operations, context);
          
          // Send to sinks
          await this.sendBatchToSinks(processedBatch, config.sinks);
          
          // Update state
          state.totalProcessed += batch.length;
          state.currentThroughput = batch.length / (batchInterval / 1000);
        }

        // Schedule next batch
        setTimeout(processBatch, batchInterval);

      } catch (error) {
        state.errors.push({
          id: uuidv4(),
          timestamp: new Date(),
          message: error.message,
          stackTrace: error.stack
        });
        
        // Continue with next batch after error
        setTimeout(processBatch, batchInterval);
      }
    };

    // Start batch processing
    processBatch();
  }

  /**
   * Start window processing
   */
  private async startWindowProcessing(
    config: StreamConfig,
    state: StreamState,
    windowType: 'sliding' | 'tumbling'
  ): Promise<void> {
    const windowManager = this.windows.get(config.id);
    if (!windowManager) {
      throw new Error(`Window manager not found for stream: ${config.id}`);
    }

    const context: StreamContext = {
      streamId: config.id,
      timestamp: new Date(),
      metrics: this.initializeMetrics(),
      metadata: { windowType }
    };

    // Set up window processing
    windowManager.on('window:ready', async (window: StreamWindow) => {
      try {
        // Process window
        const processedWindow = await this.processWindow(window, config.operations, context);
        
        // Send to sinks
        await this.sendWindowToSinks(processedWindow, config.sinks);
        
        // Update state
        state.totalProcessed += window.events.length;

      } catch (error) {
        state.errors.push({
          id: uuidv4(),
          timestamp: new Date(),
          message: error.message,
          data: { windowId: window.id },
          stackTrace: error.stack
        });
      }
    });

    // Start feeding data to window manager
    this.feedDataToWindow(config.sources, windowManager, context);
  }

  /**
   * Start session window processing
   */
  private async startSessionWindowProcessing(
    config: StreamConfig,
    state: StreamState
  ): Promise<void> {
    // Implementation for session window processing
    await this.startWindowProcessing(config, state, 'tumbling');
  }

  /**
   * Start custom processing
   */
  private async startCustomProcessing(
    config: StreamConfig,
    state: StreamState
  ): Promise<void> {
    // Implementation for custom processing modes
    await this.startRealTimeProcessing(config, state);
  }

  /**
   * Create processing pipeline
   */
  private createProcessingPipeline(
    operations: StreamOperation[],
    context: StreamContext
  ): Transform {
    const sortedOperations = this.topologicalSort(operations);
    
    return new Transform({
      objectMode: true,
      transform: async (event: StreamEvent, encoding, callback) => {
        try {
          let processedEvent = event;
          
          for (const operation of sortedOperations) {
            const operator = this.operators.get(operation.type);
            if (operator) {
              processedEvent = await operator.process(processedEvent, operation.config, context);
            }
          }

          context.metrics.recordsProcessed++;
          callback(null, processedEvent);

        } catch (error) {
          context.metrics.errorRate++;
          this.handleStreamError(error, event, context);
          callback(); // Skip this event
        }
      }
    });
  }

  /**
   * Create monitoring stream
   */
  private createMonitoringStream(context: StreamContext): Transform {
    let eventCount = 0;
    const startTime = Date.now();

    return new Transform({
      objectMode: true,
      transform: (event: StreamEvent, encoding, callback) => {
        eventCount++;
        const currentTime = Date.now();
        const duration = currentTime - startTime;

        // Update metrics
        context.metrics.throughput = eventCount / (duration / 1000);
        context.metrics.latency = currentTime - event.timestamp.getTime();

        // Emit metrics periodically
        if (eventCount % 1000 === 0) {
          this.emit('metrics:updated', { streamId: context.streamId, metrics: context.metrics });
        }

        callback(null, event);
      }
    });
  }

  /**
   * Create error handling stream
   */
  private createErrorHandlingStream(
    errorConfig: StreamErrorHandling | undefined,
    context: StreamContext
  ): Transform {
    return new Transform({
      objectMode: true,
      transform: async (event: StreamEvent, encoding, callback) => {
        try {
          callback(null, event);
        } catch (error) {
          await this.handleStreamError(error, event, context, errorConfig);
          
          if (errorConfig?.strategy === 'fail') {
            callback(error);
          } else {
            callback(); // Skip or continue based on strategy
          }
        }
      }
    });
  }

  /**
   * Merge multiple streams
   */
  private mergeStreams(streams: Readable[]): Readable {
    // Simple implementation - in production, use proper stream merging library
    return streams[0]; // Placeholder
  }

  /**
   * Collect batch from sources
   */
  private async collectBatch(sources: StreamSource[], batchSize: number): Promise<StreamEvent[]> {
    const batch: StreamEvent[] = [];
    
    for (const source of sources) {
      const adapter = this.sources.get(source.type);
      if (adapter) {
        const sourceBatch = await adapter.readBatch(source, batchSize);
        batch.push(...sourceBatch);
      }
    }

    return batch;
  }

  /**
   * Process batch of events
   */
  private async processBatch(
    batch: StreamEvent[],
    operations: StreamOperation[],
    context: StreamContext
  ): Promise<StreamEvent[]> {
    const sortedOperations = this.topologicalSort(operations);
    let processedBatch = batch;

    for (const operation of sortedOperations) {
      const operator = this.operators.get(operation.type);
      if (operator) {
        processedBatch = await operator.processBatch(processedBatch, operation.config, context);
      }
    }

    return processedBatch;
  }

  /**
   * Send batch to sinks
   */
  private async sendBatchToSinks(batch: StreamEvent[], sinks: StreamSink[]): Promise<void> {
    const promises = sinks.map(async sink => {
      const adapter = this.sinks.get(sink.type);
      if (adapter) {
        await adapter.writeBatch(sink, batch);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Process window of events
   */
  private async processWindow(
    window: StreamWindow,
    operations: StreamOperation[],
    context: StreamContext
  ): Promise<StreamWindow> {
    // Process window events as a batch
    const processedEvents = await this.processBatch(window.events, operations, context);
    
    return {
      ...window,
      events: processedEvents
    };
  }

  /**
   * Send window to sinks
   */
  private async sendWindowToSinks(window: StreamWindow, sinks: StreamSink[]): Promise<void> {
    await this.sendBatchToSinks(window.events, sinks);
  }

  /**
   * Feed data to window manager
   */
  private async feedDataToWindow(
    sources: StreamSource[],
    windowManager: WindowManager,
    context: StreamContext
  ): Promise<void> {
    // Implementation for feeding data to window manager
    for (const source of sources) {
      const adapter = this.sources.get(source.type);
      if (adapter) {
        const stream = await adapter.createStream(source);
        stream.on('data', (event: StreamEvent) => {
          windowManager.addEvent(event);
        });
      }
    }
  }

  /**
   * Handle stream processing error
   */
  private async handleStreamError(
    error: Error,
    event: StreamEvent,
    context: StreamContext,
    errorConfig?: StreamErrorHandling
  ): Promise<void> {
    const streamError: StreamError = {
      id: uuidv4(),
      timestamp: new Date(),
      operationId: context.operationId,
      message: error.message,
      data: event,
      stackTrace: error.stack
    };

    const state = this.states.get(context.streamId);
    if (state) {
      state.errors.push(streamError);
    }

    this.logger.error(`Stream processing error`, {
      streamId: context.streamId,
      error: error.message,
      event: event.id
    });

    this.emit('stream:error', { streamId: context.streamId, error: streamError });

    // Handle based on strategy
    if (errorConfig) {
      switch (errorConfig.strategy) {
        case 'dead_letter':
          await this.sendToDeadLetterQueue(event, streamError, errorConfig.deadLetterQueue);
          break;
        case 'retry':
          await this.retryEvent(event, context, errorConfig);
          break;
        // Other strategies handled by caller
      }
    }
  }

  /**
   * Send event to dead letter queue
   */
  private async sendToDeadLetterQueue(
    event: StreamEvent,
    error: StreamError,
    deadLetterQueue?: string
  ): Promise<void> {
    if (deadLetterQueue) {
      // Implementation for sending to dead letter queue
      this.logger.info(`Event sent to dead letter queue`, {
        eventId: event.id,
        errorId: error.id,
        queue: deadLetterQueue
      });
    }
  }

  /**
   * Retry event processing
   */
  private async retryEvent(
    event: StreamEvent,
    context: StreamContext,
    errorConfig: StreamErrorHandling
  ): Promise<void> {
    const maxRetries = errorConfig.maxRetries || 3;
    const retryDelay = errorConfig.retryDelay || 1000;
    
    // Implementation for event retry logic
    setTimeout(() => {
      // Retry processing
    }, retryDelay);
  }

  /**
   * Setup checkpointing
   */
  private setupCheckpointing(config: StreamConfig, context: StreamContext): void {
    const checkpointManager = this.checkpoints.get(config.id);
    if (!checkpointManager) return;

    const interval = config.checkpointConfig!.interval;
    
    setInterval(async () => {
      try {
        await checkpointManager.createCheckpoint(context);
      } catch (error) {
        this.logger.error(`Checkpoint creation failed`, {
          streamId: config.id,
          error: error.message
        });
      }
    }, interval);
  }

  /**
   * Topological sort of operations
   */
  private topologicalSort(operations: StreamOperation[]): StreamOperation[] {
    const sorted: StreamOperation[] = [];
    const visited = new Set<string>();
    const operationMap = new Map(operations.map(op => [op.id, op]));

    const visit = (operationId: string) => {
      if (visited.has(operationId)) return;
      
      visited.add(operationId);
      const operation = operationMap.get(operationId);
      
      if (operation?.dependencies) {
        for (const dep of operation.dependencies) {
          visit(dep);
        }
      }
      
      if (operation) {
        sorted.push(operation);
      }
    };

    for (const operation of operations) {
      visit(operation.id);
    }

    return sorted;
  }

  /**
   * Calculate optimal parallelism
   */
  private calculateParallelism(config: StreamConfig): number {
    // Simple calculation - in production, consider resource availability
    return config.scaling?.minParallelism || 1;
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): StreamMetrics {
    return {
      throughput: 0,
      latency: 0,
      backpressure: 0,
      errorRate: 0,
      recordsProcessed: 0,
      recordsFiltered: 0,
      watermarkDelay: 0,
      checkpointDuration: 0,
      cpuUsage: 0,
      memoryUsage: 0
    };
  }

  /**
   * Validate stream configuration
   */
  private validateStreamConfig(config: StreamConfig): void {
    if (!config.id || !config.name) {
      throw new Error('Stream must have id and name');
    }

    if (!config.sources || config.sources.length === 0) {
      throw new Error('Stream must have at least one source');
    }

    if (!config.sinks || config.sinks.length === 0) {
      throw new Error('Stream must have at least one sink');
    }

    // Validate operation dependencies
    const operationIds = new Set(config.operations.map(op => op.id));
    for (const operation of config.operations) {
      if (operation.dependencies) {
        for (const dep of operation.dependencies) {
          if (!operationIds.has(dep)) {
            throw new Error(`Operation ${operation.id} has invalid dependency: ${dep}`);
          }
        }
      }
    }
  }

  /**
   * Initialize built-in components
   */
  private initializeBuiltInComponents(): void {
    // Initialize source adapters
    this.sources.set('kafka', new KafkaSourceAdapter());
    this.sources.set('file', new FileSourceAdapter());
    this.sources.set('http', new HttpSourceAdapter());
    this.sources.set('database', new DatabaseSourceAdapter());
    this.sources.set('redis', new RedisSourceAdapter());

    // Initialize sink adapters
    this.sinks.set('kafka', new KafkaSinkAdapter());
    this.sinks.set('file', new FileSinkAdapter());
    this.sinks.set('database', new DatabaseSinkAdapter());
    this.sinks.set('elasticsearch', new ElasticsearchSinkAdapter());
    this.sinks.set('redis', new RedisSinkAdapter());

    // Initialize stream operators
    this.operators.set('filter', new FilterOperator());
    this.operators.set('map', new MapOperator());
    this.operators.set('flatMap', new FlatMapOperator());
    this.operators.set('aggregate', new AggregateOperator());
    this.operators.set('join', new JoinOperator());
    this.operators.set('window', new WindowOperator());
    this.operators.set('sort', new SortOperator());
  }

  /**
   * Get stream status
   */
  public getStreamStatus(streamId: string): StreamState | undefined {
    return this.states.get(streamId);
  }

  /**
   * Get stream configuration
   */
  public getStreamConfig(streamId: string): StreamConfig | undefined {
    return this.streams.get(streamId);
  }

  /**
   * List all streams
   */
  public listStreams(): StreamConfig[] {
    return Array.from(this.streams.values());
  }

  /**
   * Get stream metrics
   */
  public getStreamMetrics(streamId: string): StreamMetrics | undefined {
    // Return current metrics for the stream
    return this.initializeMetrics(); // Placeholder
  }

  /**
   * Register custom source adapter
   */
  public registerSourceAdapter(type: string, adapter: StreamSourceAdapter): void {
    this.sources.set(type, adapter);
  }

  /**
   * Register custom sink adapter
   */
  public registerSinkAdapter(type: string, adapter: StreamSinkAdapter): void {
    this.sinks.set(type, adapter);
  }

  /**
   * Register custom stream operator
   */
  public registerOperator(type: string, operator: StreamOperator): void {
    this.operators.set(type, operator);
  }
}

/**
 * Base stream source adapter interface
 */
export abstract class StreamSourceAdapter {
  abstract createStream(config: StreamSource): Promise<Readable>;
  abstract readBatch(config: StreamSource, batchSize: number): Promise<StreamEvent[]>;
}

/**
 * Base stream sink adapter interface
 */
export abstract class StreamSinkAdapter {
  abstract createStream(config: StreamSink): Promise<Writable>;
  abstract writeBatch(config: StreamSink, events: StreamEvent[]): Promise<void>;
}

/**
 * Base stream operator interface
 */
export abstract class StreamOperator {
  abstract process(event: StreamEvent, config: Record<string, any>, context: StreamContext): Promise<StreamEvent>;
  abstract processBatch(events: StreamEvent[], config: Record<string, any>, context: StreamContext): Promise<StreamEvent[]>;
}

/**
 * Window manager for time-based processing
 */
export class WindowManager extends EventEmitter {
  private config: WindowConfig;
  private windows: Map<string, StreamWindow> = new Map();

  constructor(config: WindowConfig) {
    super();
    this.config = config;
  }

  addEvent(event: StreamEvent): void {
    // Implementation for adding events to appropriate windows
    const windowId = this.getWindowId(event);
    let window = this.windows.get(windowId);
    
    if (!window) {
      window = this.createWindow(windowId, event);
      this.windows.set(windowId, window);
    }
    
    window.events.push(event);
    
    // Check if window is ready
    if (this.isWindowReady(window)) {
      this.emit('window:ready', window);
      this.windows.delete(windowId);
    }
  }

  private getWindowId(event: StreamEvent): string {
    // Generate window ID based on event time and window configuration
    return `window-${Date.now()}`;
  }

  private createWindow(id: string, event: StreamEvent): StreamWindow {
    return {
      id,
      start: new Date(event.timestamp.getTime()),
      end: new Date(event.timestamp.getTime() + (this.config.size || 60000)),
      type: 'time',
      events: [],
      metadata: {}
    };
  }

  private isWindowReady(window: StreamWindow): boolean {
    // Check if window is ready based on trigger conditions
    return Date.now() >= window.end.getTime();
  }
}

/**
 * Checkpoint manager for fault tolerance
 */
export class CheckpointManager {
  private config: CheckpointConfig;
  private lastCheckpoint?: CheckpointInfo;

  constructor(config: CheckpointConfig) {
    this.config = config;
  }

  async createCheckpoint(context: StreamContext): Promise<CheckpointInfo> {
    const checkpoint: CheckpointInfo = {
      id: uuidv4(),
      timestamp: new Date(),
      offsets: {}, // Implementation specific
      metadata: {
        streamId: context.streamId,
        recordsProcessed: context.metrics.recordsProcessed
      }
    };

    // Save checkpoint to storage
    await this.saveCheckpoint(checkpoint);
    
    this.lastCheckpoint = checkpoint;
    return checkpoint;
  }

  async finalCheckpoint(): Promise<void> {
    // Perform final checkpoint before stopping
    if (this.lastCheckpoint) {
      await this.saveCheckpoint(this.lastCheckpoint);
    }
  }

  private async saveCheckpoint(checkpoint: CheckpointInfo): Promise<void> {
    // Implementation for saving checkpoint to configured storage
  }
}

/**
 * Stream metrics collector
 */
export class StreamMetricsCollector {
  private metrics: Map<string, any> = new Map();

  collectMetric(name: string, value: any, tags?: Record<string, string>): void {
    this.metrics.set(name, { value, tags, timestamp: new Date() });
  }

  getMetrics(): Map<string, any> {
    return this.metrics;
  }
}

// Concrete source adapter implementations
export class KafkaSourceAdapter extends StreamSourceAdapter {
  async createStream(config: StreamSource): Promise<Readable> {
    // Implementation for Kafka source
    return new Readable({ objectMode: true, read() {} });
  }

  async readBatch(config: StreamSource, batchSize: number): Promise<StreamEvent[]> {
    // Implementation for Kafka batch reading
    return [];
  }
}

export class FileSourceAdapter extends StreamSourceAdapter {
  async createStream(config: StreamSource): Promise<Readable> {
    // Implementation for file source
    return new Readable({ objectMode: true, read() {} });
  }

  async readBatch(config: StreamSource, batchSize: number): Promise<StreamEvent[]> {
    // Implementation for file batch reading
    return [];
  }
}

export class HttpSourceAdapter extends StreamSourceAdapter {
  async createStream(config: StreamSource): Promise<Readable> {
    // Implementation for HTTP source
    return new Readable({ objectMode: true, read() {} });
  }

  async readBatch(config: StreamSource, batchSize: number): Promise<StreamEvent[]> {
    // Implementation for HTTP batch reading
    return [];
  }
}

export class DatabaseSourceAdapter extends StreamSourceAdapter {
  async createStream(config: StreamSource): Promise<Readable> {
    // Implementation for database source
    return new Readable({ objectMode: true, read() {} });
  }

  async readBatch(config: StreamSource, batchSize: number): Promise<StreamEvent[]> {
    // Implementation for database batch reading
    return [];
  }
}

export class RedisSourceAdapter extends StreamSourceAdapter {
  async createStream(config: StreamSource): Promise<Readable> {
    // Implementation for Redis source
    return new Readable({ objectMode: true, read() {} });
  }

  async readBatch(config: StreamSource, batchSize: number): Promise<StreamEvent[]> {
    // Implementation for Redis batch reading
    return [];
  }
}

// Concrete sink adapter implementations
export class KafkaSinkAdapter extends StreamSinkAdapter {
  async createStream(config: StreamSink): Promise<Writable> {
    // Implementation for Kafka sink
    return new Writable({ objectMode: true, write(chunk, encoding, callback) { callback(); } });
  }

  async writeBatch(config: StreamSink, events: StreamEvent[]): Promise<void> {
    // Implementation for Kafka batch writing
  }
}

export class FileSinkAdapter extends StreamSinkAdapter {
  async createStream(config: StreamSink): Promise<Writable> {
    // Implementation for file sink
    return new Writable({ objectMode: true, write(chunk, encoding, callback) { callback(); } });
  }

  async writeBatch(config: StreamSink, events: StreamEvent[]): Promise<void> {
    // Implementation for file batch writing
  }
}

export class DatabaseSinkAdapter extends StreamSinkAdapter {
  async createStream(config: StreamSink): Promise<Writable> {
    // Implementation for database sink
    return new Writable({ objectMode: true, write(chunk, encoding, callback) { callback(); } });
  }

  async writeBatch(config: StreamSink, events: StreamEvent[]): Promise<void> {
    // Implementation for database batch writing
  }
}

export class ElasticsearchSinkAdapter extends StreamSinkAdapter {
  async createStream(config: StreamSink): Promise<Writable> {
    // Implementation for Elasticsearch sink
    return new Writable({ objectMode: true, write(chunk, encoding, callback) { callback(); } });
  }

  async writeBatch(config: StreamSink, events: StreamEvent[]): Promise<void> {
    // Implementation for Elasticsearch batch writing
  }
}

export class RedisSinkAdapter extends StreamSinkAdapter {
  async createStream(config: StreamSink): Promise<Writable> {
    // Implementation for Redis sink
    return new Writable({ objectMode: true, write(chunk, encoding, callback) { callback(); } });
  }

  async writeBatch(config: StreamSink, events: StreamEvent[]): Promise<void> {
    // Implementation for Redis batch writing
  }
}

// Concrete operator implementations
export class FilterOperator extends StreamOperator {
  async process(event: StreamEvent, config: Record<string, any>, context: StreamContext): Promise<StreamEvent> {
    // Implementation for filter operation
    return event;
  }

  async processBatch(events: StreamEvent[], config: Record<string, any>, context: StreamContext): Promise<StreamEvent[]> {
    // Implementation for batch filter operation
    return events;
  }
}

export class MapOperator extends StreamOperator {
  async process(event: StreamEvent, config: Record<string, any>, context: StreamContext): Promise<StreamEvent> {
    // Implementation for map operation
    return event;
  }

  async processBatch(events: StreamEvent[], config: Record<string, any>, context: StreamContext): Promise<StreamEvent[]> {
    // Implementation for batch map operation
    return events;
  }
}

export class FlatMapOperator extends StreamOperator {
  async process(event: StreamEvent, config: Record<string, any>, context: StreamContext): Promise<StreamEvent> {
    // Implementation for flatMap operation
    return event;
  }

  async processBatch(events: StreamEvent[], config: Record<string, any>, context: StreamContext): Promise<StreamEvent[]> {
    // Implementation for batch flatMap operation
    return events;
  }
}

export class AggregateOperator extends StreamOperator {
  async process(event: StreamEvent, config: Record<string, any>, context: StreamContext): Promise<StreamEvent> {
    // Implementation for aggregate operation
    return event;
  }

  async processBatch(events: StreamEvent[], config: Record<string, any>, context: StreamContext): Promise<StreamEvent[]> {
    // Implementation for batch aggregate operation
    return events;
  }
}

export class JoinOperator extends StreamOperator {
  async process(event: StreamEvent, config: Record<string, any>, context: StreamContext): Promise<StreamEvent> {
    // Implementation for join operation
    return event;
  }

  async processBatch(events: StreamEvent[], config: Record<string, any>, context: StreamContext): Promise<StreamEvent[]> {
    // Implementation for batch join operation
    return events;
  }
}

export class WindowOperator extends StreamOperator {
  async process(event: StreamEvent, config: Record<string, any>, context: StreamContext): Promise<StreamEvent> {
    // Implementation for window operation
    return event;
  }

  async processBatch(events: StreamEvent[], config: Record<string, any>, context: StreamContext): Promise<StreamEvent[]> {
    // Implementation for batch window operation
    return events;
  }
}

export class SortOperator extends StreamOperator {
  async process(event: StreamEvent, config: Record<string, any>, context: StreamContext): Promise<StreamEvent> {
    // Implementation for sort operation
    return event;
  }

  async processBatch(events: StreamEvent[], config: Record<string, any>, context: StreamContext): Promise<StreamEvent[]> {
    // Implementation for batch sort operation
    return events;
  }
}

export default StreamProcessor;