/**
 * Real-time Streaming Processor
 * Event-driven data pipeline with Apache Kafka integration
 * Implements Lambda architecture for real-time analytics
 */

import { EventEmitter } from 'events';
import { Kafka, Producer, Consumer, KafkaMessage } from 'kafkajs';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import Redis from 'ioredis';

// Event Schemas
const StreamEventSchema = z.object({
  id: z.string().optional(),
  eventType: z.string(),
  source: z.string(),
  timestamp: z.date(),
  tenantId: z.string(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  payload: z.record(z.any()),
  metadata: z.record(z.any()).optional(),
  correlation: z.object({
    traceId: z.string(),
    spanId: z.string(),
    parentSpanId: z.string().optional()
  }).optional()
});

const StreamConfigSchema = z.object({
  kafka: z.object({
    brokers: z.array(z.string()),
    clientId: z.string(),
    ssl: z.boolean().default(false),
    sasl: z.object({
      mechanism: z.enum(['plain', 'scram-sha-256', 'scram-sha-512']),
      username: z.string(),
      password: z.string()
    }).optional()
  }),
  redis: z.object({
    host: z.string(),
    port: z.number(),
    password: z.string().optional(),
    db: z.number().default(0)
  }),
  topics: z.object({
    rawEvents: z.string().default('analytics-raw-events'),
    processedEvents: z.string().default('analytics-processed-events'),
    aggregations: z.string().default('analytics-aggregations'),
    alerts: z.string().default('analytics-alerts')
  }),
  processing: z.object({
    batchSize: z.number().default(1000),
    flushInterval: z.number().default(5000),
    windowSize: z.number().default(60000), // 1 minute
    retryAttempts: z.number().default(3),
    deadLetterQueue: z.boolean().default(true)
  })
});

export type StreamEvent = z.infer<typeof StreamEventSchema>;
export type StreamConfig = z.infer<typeof StreamConfigSchema>;

export interface ProcessingWindow {
  windowStart: Date;
  windowEnd: Date;
  events: StreamEvent[];
  aggregations: WindowAggregation[];
}

export interface WindowAggregation {
  type: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'DISTINCT_COUNT';
  field?: string;
  groupBy?: string[];
  value: number;
  metadata: Record<string, any>;
}

export interface StreamProcessor {
  name: string;
  eventTypes: string[];
  process(events: StreamEvent[]): Promise<ProcessedEvent[]>;
}

export interface ProcessedEvent {
  originalEvent: StreamEvent;
  enrichedData: Record<string, any>;
  metrics: EventMetric[];
  alerts: EventAlert[];
}

export interface EventMetric {
  name: string;
  value: number;
  unit: string;
  dimensions: Record<string, any>;
  timestamp: Date;
}

export interface EventAlert {
  level: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  threshold?: number;
  actualValue?: number;
  metadata: Record<string, any>;
}

/**
 * Real-time Streaming Analytics Processor
 */
export class RealtimeStreamingProcessor extends EventEmitter {
  private kafka: Kafka;
  private producer: Producer;
  private consumers: Map<string, Consumer> = new Map();
  private redis: Redis;
  private config: StreamConfig;
  private processors: Map<string, StreamProcessor> = new Map();
  private windows: Map<string, ProcessingWindow> = new Map();
  private isRunning = false;

  constructor(config: StreamConfig) {
    super();
    this.config = StreamConfigSchema.parse(config);
    this.initializeInfrastructure();
    this.registerDefaultProcessors();
  }

  /**
   * Initialize Kafka and Redis connections
   */
  private initializeInfrastructure(): void {
    // Initialize Kafka
    this.kafka = new Kafka({
      clientId: this.config.kafka.clientId,
      brokers: this.config.kafka.brokers,
      ssl: this.config.kafka.ssl,
      sasl: this.config.kafka.sasl
    });

    this.producer = this.kafka.producer({
      maxInFlightRequests: 1,
      idempotent: true,
      transactionTimeout: 30000
    });

    // Initialize Redis for caching and state management
    this.redis = new Redis({
      host: this.config.redis.host,
      port: this.config.redis.port,
      password: this.config.redis.password,
      db: this.config.redis.db,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    });
  }

  /**
   * Start the streaming processor
   */
  async start(): Promise<void> {
    try {
      this.emit('starting');

      // Connect to Kafka
      await this.producer.connect();

      // Create consumers for different processing paths
      await this.createConsumers();

      // Start window-based aggregation processing
      this.startWindowProcessing();

      this.isRunning = true;
      this.emit('started');

    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop the streaming processor
   */
  async stop(): Promise<void> {
    try {
      this.emit('stopping');
      this.isRunning = false;

      // Disconnect consumers
      for (const consumer of this.consumers.values()) {
        await consumer.disconnect();
      }

      // Disconnect producer
      await this.producer.disconnect();

      // Close Redis connection
      await this.redis.quit();

      this.emit('stopped');

    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Publish event to stream
   */
  async publishEvent(event: StreamEvent): Promise<void> {
    try {
      // Validate event
      const validatedEvent = StreamEventSchema.parse({
        ...event,
        timestamp: event.timestamp || new Date()
      });

      // Add trace information if not present
      if (!validatedEvent.correlation) {
        validatedEvent.correlation = {
          traceId: this.generateTraceId(),
          spanId: this.generateSpanId()
        };
      }

      // Publish to raw events topic
      await this.producer.send({
        topic: this.config.topics.rawEvents,
        messages: [{
          key: validatedEvent.tenantId,
          value: JSON.stringify(validatedEvent),
          partition: this.getPartition(validatedEvent.tenantId),
          headers: {
            eventType: validatedEvent.eventType,
            source: validatedEvent.source,
            timestamp: validatedEvent.timestamp.toISOString()
          }
        }]
      });

      this.emit('event-published', validatedEvent);

    } catch (error) {
      this.emit('publish-error', { event, error });
      throw error;
    }
  }

  /**
   * Register custom stream processor
   */
  registerProcessor(processor: StreamProcessor): void {
    this.processors.set(processor.name, processor);
    this.emit('processor-registered', processor);
  }

  /**
   * Create Kafka consumers
   */
  private async createConsumers(): Promise<void> {
    // Raw events consumer for real-time processing
    const rawEventsConsumer = this.kafka.consumer({
      groupId: 'analytics-raw-processor',
      sessionTimeout: 30000,
      heartbeatInterval: 3000
    });

    await rawEventsConsumer.connect();
    await rawEventsConsumer.subscribe({ topic: this.config.topics.rawEvents });

    await rawEventsConsumer.run({
      autoCommit: true,
      eachBatch: async ({ batch, resolveOffset, heartbeat }) => {
        await this.processRawEventBatch(batch.messages, resolveOffset, heartbeat);
      }
    });

    this.consumers.set('raw-events', rawEventsConsumer);

    // Processed events consumer for aggregations
    const aggregationConsumer = this.kafka.consumer({
      groupId: 'analytics-aggregation-processor',
      sessionTimeout: 30000,
      heartbeatInterval: 3000
    });

    await aggregationConsumer.connect();
    await aggregationConsumer.subscribe({ topic: this.config.topics.processedEvents });

    await aggregationConsumer.run({
      autoCommit: true,
      eachBatch: async ({ batch, resolveOffset, heartbeat }) => {
        await this.processAggregationBatch(batch.messages, resolveOffset, heartbeat);
      }
    });

    this.consumers.set('aggregations', aggregationConsumer);
  }

  /**
   * Process batch of raw events
   */
  private async processRawEventBatch(
    messages: KafkaMessage[],
    resolveOffset: (offset: string) => void,
    heartbeat: () => Promise<void>
  ): Promise<void> {
    const events: StreamEvent[] = [];

    for (const message of messages) {
      try {
        if (message.value) {
          const event = JSON.parse(message.value.toString()) as StreamEvent;
          events.push(event);
        }
      } catch (error) {
        console.error('Failed to parse event:', error);
        // Send to dead letter queue
        await this.sendToDeadLetterQueue(message, error);
      }
    }

    if (events.length > 0) {
      // Process events through registered processors
      const processedEvents = await this.runProcessors(events);

      // Enrich events with additional data
      const enrichedEvents = await this.enrichEvents(processedEvents);

      // Update real-time aggregations
      await this.updateRealTimeAggregations(enrichedEvents);

      // Check for alerts
      await this.checkRealTimeAlerts(enrichedEvents);

      // Publish processed events
      await this.publishProcessedEvents(enrichedEvents);

      // Store in fast storage for real-time queries
      await this.storeInFastStorage(enrichedEvents);
    }

    // Commit offsets
    for (const message of messages) {
      if (message.offset) {
        resolveOffset(message.offset);
      }
    }

    await heartbeat();
  }

  /**
   * Process aggregation batch
   */
  private async processAggregationBatch(
    messages: KafkaMessage[],
    resolveOffset: (offset: string) => void,
    heartbeat: () => Promise<void>
  ): Promise<void> {
    const processedEvents: ProcessedEvent[] = [];

    for (const message of messages) {
      try {
        if (message.value) {
          const event = JSON.parse(message.value.toString()) as ProcessedEvent;
          processedEvents.push(event);
        }
      } catch (error) {
        console.error('Failed to parse processed event:', error);
      }
    }

    if (processedEvents.length > 0) {
      // Update time-based aggregations
      await this.updateTimeBasedAggregations(processedEvents);

      // Update tenant-specific metrics
      await this.updateTenantMetrics(processedEvents);

      // Update global KPIs
      await this.updateGlobalKPIs(processedEvents);
    }

    // Commit offsets
    for (const message of messages) {
      if (message.offset) {
        resolveOffset(message.offset);
      }
    }

    await heartbeat();
  }

  /**
   * Run events through registered processors
   */
  private async runProcessors(events: StreamEvent[]): Promise<ProcessedEvent[]> {
    const processedEvents: ProcessedEvent[] = [];

    for (const event of events) {
      const applicableProcessors = Array.from(this.processors.values())
        .filter(processor => processor.eventTypes.includes(event.eventType));

      if (applicableProcessors.length > 0) {
        for (const processor of applicableProcessors) {
          try {
            const processed = await processor.process([event]);
            processedEvents.push(...processed);
          } catch (error) {
            console.error(`Processor ${processor.name} failed:`, error);
            this.emit('processor-error', { processor: processor.name, event, error });
          }
        }
      } else {
        // Default processing
        processedEvents.push({
          originalEvent: event,
          enrichedData: {},
          metrics: [],
          alerts: []
        });
      }
    }

    return processedEvents;
  }

  /**
   * Enrich events with additional data
   */
  private async enrichEvents(events: ProcessedEvent[]): Promise<ProcessedEvent[]> {
    for (const event of events) {
      try {
        // Enrich with tenant information
        const tenantInfo = await this.getTenantInfo(event.originalEvent.tenantId);
        event.enrichedData.tenant = tenantInfo;

        // Enrich with user information
        if (event.originalEvent.userId) {
          const userInfo = await this.getUserInfo(event.originalEvent.userId);
          event.enrichedData.user = userInfo;
        }

        // Enrich with session information
        if (event.originalEvent.sessionId) {
          const sessionInfo = await this.getSessionInfo(event.originalEvent.sessionId);
          event.enrichedData.session = sessionInfo;
        }

        // Add geolocation if available
        const geoInfo = await this.getGeoLocation(event.originalEvent.payload);
        if (geoInfo) {
          event.enrichedData.geo = geoInfo;
        }

      } catch (error) {
        console.error('Event enrichment failed:', error);
      }
    }

    return events;
  }

  /**
   * Update real-time aggregations in Redis
   */
  private async updateRealTimeAggregations(events: ProcessedEvent[]): Promise<void> {
    const pipeline = this.redis.pipeline();
    const currentMinute = Math.floor(Date.now() / 60000) * 60000;

    for (const event of events) {
      const tenantId = event.originalEvent.tenantId;
      const eventType = event.originalEvent.eventType;

      // Increment counters
      const countKey = `rt:count:${tenantId}:${eventType}:${currentMinute}`;
      pipeline.incr(countKey);
      pipeline.expire(countKey, 3600); // Expire after 1 hour

      // Update metrics
      for (const metric of event.metrics) {
        const metricKey = `rt:metric:${tenantId}:${metric.name}:${currentMinute}`;
        pipeline.zadd(metricKey, Date.now(), metric.value);
        pipeline.expire(metricKey, 3600);
      }

      // Update user activity
      if (event.originalEvent.userId) {
        const userKey = `rt:users:${tenantId}:${currentMinute}`;
        pipeline.sadd(userKey, event.originalEvent.userId);
        pipeline.expire(userKey, 3600);
      }
    }

    await pipeline.exec();
  }

  /**
   * Check for real-time alerts
   */
  private async checkRealTimeAlerts(events: ProcessedEvent[]): Promise<void> {
    for (const event of events) {
      for (const alert of event.alerts) {
        await this.fireAlert(alert, event);
      }

      // Check for anomalies in real-time metrics
      await this.checkMetricAnomalies(event);
    }
  }

  /**
   * Start window-based processing
   */
  private startWindowProcessing(): void {
    setInterval(async () => {
      if (this.isRunning) {
        await this.processWindows();
      }
    }, this.config.processing.windowSize);
  }

  /**
   * Process time windows for aggregations
   */
  private async processWindows(): Promise<void> {
    const currentTime = new Date();
    const windowStart = new Date(
      Math.floor(currentTime.getTime() / this.config.processing.windowSize) * 
      this.config.processing.windowSize
    );
    const windowEnd = new Date(windowStart.getTime() + this.config.processing.windowSize);

    // Process each tenant's window
    const activeTenants = await this.getActiveTenants();

    for (const tenantId of activeTenants) {
      try {
        await this.processWindowForTenant(tenantId, windowStart, windowEnd);
      } catch (error) {
        console.error(`Window processing failed for tenant ${tenantId}:`, error);
      }
    }
  }

  /**
   * Process window for specific tenant
   */
  private async processWindowForTenant(
    tenantId: string,
    windowStart: Date,
    windowEnd: Date
  ): Promise<void> {
    // Get events from the window
    const windowEvents = await this.getWindowEvents(tenantId, windowStart, windowEnd);

    if (windowEvents.length === 0) return;

    // Calculate aggregations
    const aggregations = this.calculateWindowAggregations(windowEvents);

    // Store aggregations
    await this.storeWindowAggregations(tenantId, windowStart, windowEnd, aggregations);

    // Update real-time dashboards
    this.emit('window-processed', {
      tenantId,
      windowStart,
      windowEnd,
      eventCount: windowEvents.length,
      aggregations
    });
  }

  /**
   * Register default event processors
   */
  private registerDefaultProcessors(): void {
    // User Activity Processor
    this.registerProcessor(new UserActivityProcessor());

    // API Usage Processor
    this.registerProcessor(new APIUsageProcessor());

    // Performance Metrics Processor
    this.registerProcessor(new PerformanceMetricsProcessor());

    // Error Tracking Processor
    this.registerProcessor(new ErrorTrackingProcessor());

    // Feature Usage Processor
    this.registerProcessor(new FeatureUsageProcessor());
  }

  // Utility methods
  private generateTraceId(): string {
    return Math.random().toString(36).substr(2, 16);
  }

  private generateSpanId(): string {
    return Math.random().toString(36).substr(2, 8);
  }

  private getPartition(tenantId: string): number {
    // Simple hash-based partitioning
    let hash = 0;
    for (let i = 0; i < tenantId.length; i++) {
      hash = ((hash << 5) - hash) + tenantId.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash) % 12; // Assuming 12 partitions
  }

  private async sendToDeadLetterQueue(message: KafkaMessage, error: any): Promise<void> {
    if (this.config.processing.deadLetterQueue) {
      await this.producer.send({
        topic: 'analytics-dead-letter',
        messages: [{
          key: 'error',
          value: JSON.stringify({
            originalMessage: message.value?.toString(),
            error: error.message,
            timestamp: new Date().toISOString()
          })
        }]
      });
    }
  }

  private async publishProcessedEvents(events: ProcessedEvent[]): Promise<void> {
    const messages = events.map(event => ({
      key: event.originalEvent.tenantId,
      value: JSON.stringify(event),
      partition: this.getPartition(event.originalEvent.tenantId)
    }));

    await this.producer.send({
      topic: this.config.topics.processedEvents,
      messages
    });
  }

  private async storeInFastStorage(events: ProcessedEvent[]): Promise<void> {
    // Store in Redis for fast access
    const pipeline = this.redis.pipeline();

    for (const event of events) {
      const key = `event:${event.originalEvent.id || Date.now()}`;
      pipeline.setex(key, 3600, JSON.stringify(event)); // Expire after 1 hour
    }

    await pipeline.exec();
  }

  private async getTenantInfo(tenantId: string): Promise<any> {
    const cacheKey = `tenant:${tenantId}`;
    let tenantInfo = await this.redis.get(cacheKey);

    if (!tenantInfo) {
      const tenant = await prisma.organization.findUnique({
        where: { id: tenantId },
        select: { id: true, name: true, tier: true, status: true }
      });
      
      tenantInfo = JSON.stringify(tenant);
      await this.redis.setex(cacheKey, 300, tenantInfo); // Cache for 5 minutes
    }

    return JSON.parse(tenantInfo);
  }

  private async getUserInfo(userId: string): Promise<any> {
    const cacheKey = `user:${userId}`;
    let userInfo = await this.redis.get(cacheKey);

    if (!userInfo) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, role: true }
      });
      
      userInfo = JSON.stringify(user);
      await this.redis.setex(cacheKey, 300, userInfo);
    }

    return JSON.parse(userInfo);
  }

  private async getSessionInfo(sessionId: string): Promise<any> {
    const cacheKey = `session:${sessionId}`;
    return await this.redis.get(cacheKey);
  }

  private async getGeoLocation(payload: any): Promise<any> {
    // Implementation for geo-location enrichment
    return null;
  }

  private async fireAlert(alert: EventAlert, event: ProcessedEvent): Promise<void> {
    await this.producer.send({
      topic: this.config.topics.alerts,
      messages: [{
        key: event.originalEvent.tenantId,
        value: JSON.stringify({
          alert,
          event: event.originalEvent,
          timestamp: new Date()
        })
      }]
    });
  }

  private async checkMetricAnomalies(event: ProcessedEvent): Promise<void> {
    // Implementation for anomaly detection
  }

  private async getActiveTenants(): Promise<string[]> {
    // Get list of active tenants from Redis or database
    const tenants = await this.redis.smembers('active_tenants');
    return tenants;
  }

  private async getWindowEvents(
    tenantId: string,
    windowStart: Date,
    windowEnd: Date
  ): Promise<StreamEvent[]> {
    // Get events from Redis or database for the time window
    return [];
  }

  private calculateWindowAggregations(events: StreamEvent[]): WindowAggregation[] {
    const aggregations: WindowAggregation[] = [];

    // Count by event type
    const eventTypeCounts = new Map<string, number>();
    for (const event of events) {
      const current = eventTypeCounts.get(event.eventType) || 0;
      eventTypeCounts.set(event.eventType, current + 1);
    }

    for (const [eventType, count] of eventTypeCounts) {
      aggregations.push({
        type: 'COUNT',
        groupBy: ['eventType'],
        value: count,
        metadata: { eventType }
      });
    }

    return aggregations;
  }

  private async storeWindowAggregations(
    tenantId: string,
    windowStart: Date,
    windowEnd: Date,
    aggregations: WindowAggregation[]
  ): Promise<void> {
    // Store aggregations in database
    for (const agg of aggregations) {
      await prisma.windowAggregation.create({
        data: {
          tenantId,
          windowStart,
          windowEnd,
          aggregationType: agg.type,
          field: agg.field,
          groupBy: agg.groupBy || [],
          value: agg.value,
          metadata: agg.metadata
        }
      });
    }
  }

  private async updateTimeBasedAggregations(events: ProcessedEvent[]): Promise<void> {
    // Implementation for time-based aggregations
  }

  private async updateTenantMetrics(events: ProcessedEvent[]): Promise<void> {
    // Implementation for tenant-specific metrics
  }

  private async updateGlobalKPIs(events: ProcessedEvent[]): Promise<void> {
    // Implementation for global KPI updates
  }
}

/**
 * Default Stream Processors
 */
class UserActivityProcessor implements StreamProcessor {
  name = 'user-activity';
  eventTypes = ['user_login', 'user_logout', 'page_view', 'feature_usage'];

  async process(events: StreamEvent[]): Promise<ProcessedEvent[]> {
    return events.map(event => ({
      originalEvent: event,
      enrichedData: {
        activityType: this.categorizeActivity(event.eventType),
        sessionDuration: this.calculateSessionDuration(event)
      },
      metrics: [{
        name: 'user_activity_count',
        value: 1,
        unit: 'count',
        dimensions: {
          eventType: event.eventType,
          tenantId: event.tenantId
        },
        timestamp: event.timestamp
      }],
      alerts: []
    }));
  }

  private categorizeActivity(eventType: string): string {
    if (eventType.includes('login')) return 'authentication';
    if (eventType.includes('view')) return 'navigation';
    return 'interaction';
  }

  private calculateSessionDuration(event: StreamEvent): number {
    // Implementation for session duration calculation
    return 0;
  }
}

class APIUsageProcessor implements StreamProcessor {
  name = 'api-usage';
  eventTypes = ['api_request', 'api_response', 'api_error'];

  async process(events: StreamEvent[]): Promise<ProcessedEvent[]> {
    return events.map(event => ({
      originalEvent: event,
      enrichedData: {
        endpoint: event.payload.endpoint,
        method: event.payload.method,
        statusCode: event.payload.statusCode,
        responseTime: event.payload.responseTime
      },
      metrics: [{
        name: 'api_requests_total',
        value: 1,
        unit: 'count',
        dimensions: {
          endpoint: event.payload.endpoint,
          method: event.payload.method,
          statusCode: event.payload.statusCode
        },
        timestamp: event.timestamp
      }],
      alerts: event.payload.statusCode >= 500 ? [{
        level: 'CRITICAL',
        message: `API error detected: ${event.payload.statusCode}`,
        actualValue: event.payload.statusCode,
        metadata: { endpoint: event.payload.endpoint }
      }] : []
    }));
  }
}

class PerformanceMetricsProcessor implements StreamProcessor {
  name = 'performance-metrics';
  eventTypes = ['performance_metric', 'page_load', 'resource_timing'];

  async process(events: StreamEvent[]): Promise<ProcessedEvent[]> {
    return events.map(event => ({
      originalEvent: event,
      enrichedData: {
        metricType: event.payload.metricType,
        value: event.payload.value,
        threshold: event.payload.threshold
      },
      metrics: [{
        name: event.payload.metricType,
        value: event.payload.value,
        unit: event.payload.unit || 'ms',
        dimensions: {
          tenantId: event.tenantId,
          source: event.source
        },
        timestamp: event.timestamp
      }],
      alerts: this.checkPerformanceThreshold(event)
    }));
  }

  private checkPerformanceThreshold(event: StreamEvent): EventAlert[] {
    const alerts: EventAlert[] = [];
    const value = event.payload.value;
    const threshold = event.payload.threshold;

    if (threshold && value > threshold * 1.5) {
      alerts.push({
        level: 'CRITICAL',
        message: `Performance metric ${event.payload.metricType} exceeded threshold`,
        threshold,
        actualValue: value,
        metadata: { metricType: event.payload.metricType }
      });
    }

    return alerts;
  }
}

class ErrorTrackingProcessor implements StreamProcessor {
  name = 'error-tracking';
  eventTypes = ['error', 'exception', 'crash'];

  async process(events: StreamEvent[]): Promise<ProcessedEvent[]> {
    return events.map(event => ({
      originalEvent: event,
      enrichedData: {
        errorType: event.payload.type,
        errorMessage: event.payload.message,
        stackTrace: event.payload.stackTrace,
        severity: this.determineSeverity(event.payload)
      },
      metrics: [{
        name: 'errors_total',
        value: 1,
        unit: 'count',
        dimensions: {
          errorType: event.payload.type,
          severity: this.determineSeverity(event.payload)
        },
        timestamp: event.timestamp
      }],
      alerts: [{
        level: this.determineSeverity(event.payload) as any,
        message: `Error detected: ${event.payload.message}`,
        metadata: {
          errorType: event.payload.type,
          source: event.source
        }
      }]
    }));
  }

  private determineSeverity(payload: any): string {
    if (payload.type === 'crash') return 'CRITICAL';
    if (payload.type === 'exception') return 'WARNING';
    return 'INFO';
  }
}

class FeatureUsageProcessor implements StreamProcessor {
  name = 'feature-usage';
  eventTypes = ['feature_used', 'button_click', 'form_submit'];

  async process(events: StreamEvent[]): Promise<ProcessedEvent[]> {
    return events.map(event => ({
      originalEvent: event,
      enrichedData: {
        feature: event.payload.feature,
        action: event.payload.action,
        context: event.payload.context
      },
      metrics: [{
        name: 'feature_usage_count',
        value: 1,
        unit: 'count',
        dimensions: {
          feature: event.payload.feature,
          action: event.payload.action
        },
        timestamp: event.timestamp
      }],
      alerts: []
    }));
  }
}

export default RealtimeStreamingProcessor;