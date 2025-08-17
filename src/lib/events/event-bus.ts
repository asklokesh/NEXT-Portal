/**
 * Event-Driven Architecture with Kafka/Redpanda Integration
 * High-throughput event streaming and processing for distributed systems
 */

export interface EventMessage {
  id: string;
  type: string;
  source: string;
  tenantId?: string;
  userId?: string;
  data: any;
  metadata: EventMetadata;
  timestamp: Date;
  version: string;
  correlationId?: string;
  causationId?: string;
}

export interface EventMetadata {
  contentType: string;
  encoding: string;
  schemaVersion: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  ttl?: number; // Time to live in milliseconds
  retryCount?: number;
  maxRetries?: number;
  delay?: number; // Delay before processing
  tags?: string[];
}

export interface EventHandler {
  eventType: string;
  handler: (event: EventMessage) => Promise<void>;
  options?: {
    concurrent?: boolean;
    retries?: number;
    timeout?: number;
    dlq?: boolean; // Dead letter queue
  };
}

export interface EventSubscription {
  id: string;
  topic: string;
  consumer: string;
  eventTypes: string[];
  filter?: (event: EventMessage) => boolean;
  handler: EventHandler;
  status: 'active' | 'paused' | 'error';
  createdAt: Date;
  lastProcessed?: Date;
  totalProcessed: number;
  totalErrors: number;
}

export interface EventTopic {
  name: string;
  partitions: number;
  replicationFactor: number;
  retentionMs: number;
  compacted: boolean;
  config: Record<string, string>;
}

export interface ProducerConfig {
  clientId: string;
  brokers: string[];
  acks: 'none' | 'leader' | 'all';
  timeout: number;
  retries: number;
  batchSize: number;
  compression: 'none' | 'gzip' | 'snappy' | 'lz4' | 'zstd';
}

export interface ConsumerConfig {
  clientId: string;
  groupId: string;
  brokers: string[];
  autoCommit: boolean;
  commitInterval: number;
  sessionTimeout: number;
  heartbeatInterval: number;
  maxPollRecords: number;
  fetchMinBytes: number;
  fetchMaxWaitMs: number;
}

export interface DeadLetterQueueConfig {
  enabled: boolean;
  topic: string;
  maxRetries: number;
  retryDelayMs: number;
  alertThreshold: number;
}

/**
 * Event Bus Manager
 * Manages event publishing, subscription, and processing
 */
export class EventBusManager {
  private producers: Map<string, any> = new Map(); // Would be KafkaJS producers
  private consumers: Map<string, any> = new Map(); // Would be KafkaJS consumers
  private subscriptions: Map<string, EventSubscription> = new Map();
  private handlers: Map<string, EventHandler[]> = new Map();
  private topics: Map<string, EventTopic> = new Map();
  private dlqConfig: DeadLetterQueueConfig;
  private metrics: EventBusMetrics = {
    published: 0,
    consumed: 0,
    errors: 0,
    dlqMessages: 0,
    avgProcessingTime: 0,
    lastReset: new Date()
  };

  constructor(
    private producerConfig: ProducerConfig,
    private consumerConfig: ConsumerConfig,
    dlqConfig?: DeadLetterQueueConfig
  ) {
    this.dlqConfig = dlqConfig || {
      enabled: true,
      topic: 'dead-letter-queue',
      maxRetries: 3,
      retryDelayMs: 5000,
      alertThreshold: 10
    };

    this.initializeEventBus();
  }

  /**
   * Publish event to topic
   */
  async publishEvent(
    topic: string,
    event: Omit<EventMessage, 'id' | 'timestamp'>
  ): Promise<string> {
    const eventMessage: EventMessage = {
      ...event,
      id: this.generateEventId(),
      timestamp: new Date()
    };

    try {
      // Validate event
      this.validateEvent(eventMessage);

      // Get or create producer
      const producer = await this.getProducer(topic);

      // Publish to Kafka/Redpanda
      await this.publishToKafka(producer, topic, eventMessage);

      // Update metrics
      this.metrics.published++;

      console.log(`Published event ${eventMessage.id} to topic ${topic}`);
      return eventMessage.id;

    } catch (error) {
      this.metrics.errors++;
      console.error(`Failed to publish event to topic ${topic}:`, error);
      throw error;
    }
  }

  /**
   * Subscribe to events with handler
   */
  async subscribe(
    topic: string,
    eventTypes: string[],
    handler: EventHandler,
    options?: {
      filter?: (event: EventMessage) => boolean;
      consumerGroup?: string;
    }
  ): Promise<string> {
    const subscriptionId = this.generateSubscriptionId();

    const subscription: EventSubscription = {
      id: subscriptionId,
      topic,
      consumer: options?.consumerGroup || this.consumerConfig.groupId,
      eventTypes,
      filter: options?.filter,
      handler,
      status: 'active',
      createdAt: new Date(),
      totalProcessed: 0,
      totalErrors: 0
    };

    this.subscriptions.set(subscriptionId, subscription);

    // Register handler
    if (!this.handlers.has(topic)) {
      this.handlers.set(topic, []);
    }
    this.handlers.get(topic)!.push(handler);

    // Start consuming if not already started
    await this.startConsumer(topic, subscription);

    console.log(`Created subscription ${subscriptionId} for topic ${topic}`);
    return subscriptionId;
  }

  /**
   * Unsubscribe from events
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    subscription.status = 'paused';
    
    // Remove handler
    const handlers = this.handlers.get(subscription.topic) || [];
    const handlerIndex = handlers.findIndex(h => h.eventType === subscription.handler.eventType);
    if (handlerIndex >= 0) {
      handlers.splice(handlerIndex, 1);
    }

    this.subscriptions.delete(subscriptionId);
    console.log(`Unsubscribed ${subscriptionId}`);
  }

  /**
   * Create or update topic
   */
  async createTopic(topicConfig: EventTopic): Promise<void> {
    try {
      // In production, this would create actual Kafka topic
      await this.createKafkaTopic(topicConfig);
      
      this.topics.set(topicConfig.name, topicConfig);
      console.log(`Created topic: ${topicConfig.name}`);

    } catch (error) {
      console.error(`Failed to create topic ${topicConfig.name}:`, error);
      throw error;
    }
  }

  /**
   * Process incoming event
   */
  private async processEvent(topic: string, event: EventMessage): Promise<void> {
    const startTime = Date.now();
    const handlers = this.handlers.get(topic) || [];

    // Find matching handlers
    const matchingHandlers = handlers.filter(handler =>
      handler.eventType === event.type || handler.eventType === '*'
    );

    if (matchingHandlers.length === 0) {
      console.warn(`No handlers found for event type ${event.type} on topic ${topic}`);
      return;
    }

    // Process with each handler
    for (const handlerDef of matchingHandlers) {
      const subscription = this.findSubscriptionByHandler(handlerDef);
      if (!subscription || subscription.status !== 'active') {
        continue;
      }

      // Apply filter if present
      if (subscription.filter && !subscription.filter(event)) {
        continue;
      }

      try {
        // Execute handler with timeout
        const timeout = handlerDef.options?.timeout || 30000;
        await this.executeWithTimeout(
          handlerDef.handler(event),
          timeout
        );

        // Update subscription metrics
        subscription.totalProcessed++;
        subscription.lastProcessed = new Date();

      } catch (error) {
        subscription.totalErrors++;
        
        console.error(`Handler error for event ${event.id}:`, error);

        // Handle retry logic
        await this.handleEventError(event, handlerDef, error);
      }
    }

    // Update processing time metrics
    const processingTime = Date.now() - startTime;
    this.metrics.avgProcessingTime = 
      (this.metrics.avgProcessingTime * 0.9) + (processingTime * 0.1);
    
    this.metrics.consumed++;
  }

  /**
   * Handle event processing errors with retry and DLQ
   */
  private async handleEventError(
    event: EventMessage,
    handler: EventHandler,
    error: any
  ): Promise<void> {
    const retryCount = event.metadata.retryCount || 0;
    const maxRetries = handler.options?.retries || event.metadata.maxRetries || 3;

    if (retryCount < maxRetries) {
      // Retry with exponential backoff
      const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
      
      const retryEvent: EventMessage = {
        ...event,
        metadata: {
          ...event.metadata,
          retryCount: retryCount + 1,
          delay
        }
      };

      // Schedule retry (simplified - would use proper delay queue)
      setTimeout(async () => {
        await this.processEvent(handler.eventType, retryEvent);
      }, delay);

      console.log(`Retrying event ${event.id} (attempt ${retryCount + 1}/${maxRetries})`);

    } else {
      // Send to dead letter queue
      if (this.dlqConfig.enabled && handler.options?.dlq !== false) {
        await this.sendToDeadLetterQueue(event, error);
      }

      this.metrics.dlqMessages++;
      console.error(`Event ${event.id} sent to DLQ after ${maxRetries} retries`);
    }
  }

  /**
   * Send event to dead letter queue
   */
  private async sendToDeadLetterQueue(event: EventMessage, error: any): Promise<void> {
    const dlqEvent: EventMessage = {
      ...event,
      type: 'dlq.message',
      data: {
        originalEvent: event,
        error: error.message,
        errorStack: error.stack,
        failedAt: new Date()
      },
      metadata: {
        ...event.metadata,
        priority: 'critical'
      }
    };

    try {
      await this.publishEvent(this.dlqConfig.topic, dlqEvent);
    } catch (dlqError) {
      console.error('Failed to send event to DLQ:', dlqError);
    }
  }

  /**
   * Get producer for topic
   */
  private async getProducer(topic: string): Promise<any> {
    if (!this.producers.has(topic)) {
      const producer = await this.createKafkaProducer(topic);
      this.producers.set(topic, producer);
    }
    return this.producers.get(topic);
  }

  /**
   * Start consumer for topic
   */
  private async startConsumer(topic: string, subscription: EventSubscription): Promise<void> {
    if (!this.consumers.has(topic)) {
      const consumer = await this.createKafkaConsumer(topic);
      
      // Start message processing loop
      this.startMessageProcessing(topic, consumer);
      
      this.consumers.set(topic, consumer);
    }
  }

  /**
   * Simulate Kafka producer creation
   */
  private async createKafkaProducer(topic: string): Promise<any> {
    // In production, this would create actual KafkaJS producer
    console.log(`Creating Kafka producer for topic: ${topic}`);
    return {
      topic,
      connected: true,
      send: async (message: any) => {
        // Simulate sending to Kafka
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    };
  }

  /**
   * Simulate Kafka consumer creation
   */
  private async createKafkaConsumer(topic: string): Promise<any> {
    // In production, this would create actual KafkaJS consumer
    console.log(`Creating Kafka consumer for topic: ${topic}`);
    return {
      topic,
      connected: true,
      subscribe: async () => {
        console.log(`Subscribed to topic: ${topic}`);
      }
    };
  }

  /**
   * Simulate Kafka topic creation
   */
  private async createKafkaTopic(config: EventTopic): Promise<void> {
    // In production, this would create actual Kafka topic
    console.log(`Creating Kafka topic: ${config.name} with ${config.partitions} partitions`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Simulate publishing to Kafka
   */
  private async publishToKafka(producer: any, topic: string, event: EventMessage): Promise<void> {
    // In production, this would use actual KafkaJS producer
    const message = {
      key: event.tenantId || event.id,
      value: JSON.stringify(event),
      headers: {
        eventType: event.type,
        tenantId: event.tenantId || '',
        correlationId: event.correlationId || '',
        timestamp: event.timestamp.toISOString()
      }
    };

    await producer.send(message);
  }

  /**
   * Start message processing loop
   */
  private startMessageProcessing(topic: string, consumer: any): void {
    // Simulate message consumption
    setInterval(async () => {
      // In production, this would consume actual Kafka messages
      if (Math.random() < 0.1) { // 10% chance of receiving a message
        const mockEvent: EventMessage = {
          id: this.generateEventId(),
          type: 'test.event',
          source: 'test-service',
          tenantId: 'tenant-demo',
          data: { message: 'Test event data' },
          metadata: {
            contentType: 'application/json',
            encoding: 'utf-8',
            schemaVersion: '1.0',
            priority: 'normal'
          },
          timestamp: new Date(),
          version: '1.0'
        };

        await this.processEvent(topic, mockEvent);
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Validate event message
   */
  private validateEvent(event: EventMessage): void {
    if (!event.type) {
      throw new Error('Event type is required');
    }
    
    if (!event.source) {
      throw new Error('Event source is required');
    }
    
    if (!event.data) {
      throw new Error('Event data is required');
    }
    
    if (!event.metadata) {
      throw new Error('Event metadata is required');
    }

    if (!event.version) {
      throw new Error('Event version is required');
    }
  }

  /**
   * Find subscription by handler
   */
  private findSubscriptionByHandler(handler: EventHandler): EventSubscription | undefined {
    return Array.from(this.subscriptions.values())
      .find(sub => sub.handler.eventType === handler.eventType);
  }

  /**
   * Execute handler with timeout
   */
  private async executeWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Handler timeout')), timeoutMs)
      )
    ]);
  }

  /**
   * Initialize event bus
   */
  private async initializeEventBus(): Promise<void> {
    // Create default topics
    const defaultTopics: EventTopic[] = [
      {
        name: 'plugin.events',
        partitions: 3,
        replicationFactor: 1,
        retentionMs: 7 * 24 * 60 * 60 * 1000, // 7 days
        compacted: false,
        config: {}
      },
      {
        name: 'user.events',
        partitions: 2,
        replicationFactor: 1,
        retentionMs: 30 * 24 * 60 * 60 * 1000, // 30 days
        compacted: false,
        config: {}
      },
      {
        name: 'system.events',
        partitions: 1,
        replicationFactor: 1,
        retentionMs: 90 * 24 * 60 * 60 * 1000, // 90 days
        compacted: false,
        config: {}
      },
      {
        name: this.dlqConfig.topic,
        partitions: 1,
        replicationFactor: 1,
        retentionMs: 365 * 24 * 60 * 60 * 1000, // 1 year
        compacted: false,
        config: {}
      }
    ];

    for (const topic of defaultTopics) {
      await this.createTopic(topic);
    }

    console.log('Event bus initialized with default topics');
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get event bus metrics
   */
  getMetrics(): EventBusMetrics {
    return { ...this.metrics };
  }

  /**
   * Get subscriptions
   */
  getSubscriptions(): EventSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Get topics
   */
  getTopics(): EventTopic[] {
    return Array.from(this.topics.values());
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      published: 0,
      consumed: 0,
      errors: 0,
      dlqMessages: 0,
      avgProcessingTime: 0,
      lastReset: new Date()
    };
  }

  /**
   * Shutdown event bus
   */
  async shutdown(): Promise<void> {
    // Close all producers
    for (const producer of this.producers.values()) {
      if (producer.disconnect) {
        await producer.disconnect();
      }
    }

    // Close all consumers
    for (const consumer of this.consumers.values()) {
      if (consumer.disconnect) {
        await consumer.disconnect();
      }
    }

    this.producers.clear();
    this.consumers.clear();
    this.subscriptions.clear();
    this.handlers.clear();

    console.log('Event bus shut down');
  }
}

interface EventBusMetrics {
  published: number;
  consumed: number;
  errors: number;
  dlqMessages: number;
  avgProcessingTime: number;
  lastReset: Date;
}

// Default configuration
const defaultProducerConfig: ProducerConfig = {
  clientId: 'nextportal-producer',
  brokers: [process.env.KAFKA_BROKERS || 'localhost:9092'],
  acks: 'all',
  timeout: 30000,
  retries: 3,
  batchSize: 16384,
  compression: 'snappy'
};

const defaultConsumerConfig: ConsumerConfig = {
  clientId: 'nextportal-consumer',
  groupId: process.env.KAFKA_CONSUMER_GROUP || 'nextportal-group',
  brokers: [process.env.KAFKA_BROKERS || 'localhost:9092'],
  autoCommit: true,
  commitInterval: 5000,
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
  maxPollRecords: 500,
  fetchMinBytes: 1,
  fetchMaxWaitMs: 500
};

// Global event bus instance
export const eventBus = new EventBusManager(
  defaultProducerConfig,
  defaultConsumerConfig
);

export default eventBus;