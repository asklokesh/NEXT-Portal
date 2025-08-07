/**
 * Event Bus Implementation
 * Central hub for event distribution and handling
 */

import { EventEmitter } from 'events';
import { DomainEvent, EventHandler, EventFilter, EventPriority, DeliveryGuarantee } from './event-types';
import { EventStore } from './event-store';
import { Logger } from '../../monitoring/logger';
import { MetricsCollector } from '../../monitoring/metrics';

export interface EventBusConfig {
  maxListeners?: number;
  enablePersistence?: boolean;
  enableMetrics?: boolean;
  retryPolicy?: RetryPolicy;
  deadLetterQueue?: boolean;
}

export interface RetryPolicy {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export interface EventSubscription {
  id: string;
  eventType: string | string[];
  handler: EventHandler;
  priority: EventPriority;
  filter?: EventFilter;
  deliveryGuarantee: DeliveryGuarantee;
}

interface QueuedEvent {
  event: DomainEvent;
  priority: EventPriority;
  retryCount: number;
  timestamp: Date;
}

export class EventBus {
  private emitter: EventEmitter;
  private subscriptions: Map<string, EventSubscription>;
  private eventStore?: EventStore;
  private logger: Logger;
  private metrics?: MetricsCollector;
  private processingQueue: QueuedEvent[];
  private deadLetterQueue: QueuedEvent[];
  private isProcessing: boolean;
  private config: Required<EventBusConfig>;

  constructor(config: EventBusConfig = {}) {
    this.config = {
      maxListeners: config.maxListeners || 100,
      enablePersistence: config.enablePersistence ?? true,
      enableMetrics: config.enableMetrics ?? true,
      retryPolicy: config.retryPolicy || {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2
      },
      deadLetterQueue: config.deadLetterQueue ?? true
    };

    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(this.config.maxListeners);
    this.subscriptions = new Map();
    this.processingQueue = [];
    this.deadLetterQueue = [];
    this.isProcessing = false;
    this.logger = new Logger('EventBus');

    if (this.config.enableMetrics) {
      this.metrics = new MetricsCollector('event_bus');
    }

    this.startProcessing();
  }

  /**
   * Attach an event store for persistence
   */
  attachEventStore(eventStore: EventStore): void {
    this.eventStore = eventStore;
    this.logger.info('Event store attached');
  }

  /**
   * Publish an event to the bus
   */
  async publish<T = any>(
    event: DomainEvent<T>,
    priority: EventPriority = EventPriority.NORMAL
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Persist event if store is available
      if (this.config.enablePersistence && this.eventStore) {
        await this.eventStore.append(event);
      }

      // Add to processing queue
      this.processingQueue.push({
        event,
        priority,
        retryCount: 0,
        timestamp: new Date()
      });

      // Sort queue by priority
      this.processingQueue.sort((a, b) => b.priority - a.priority);

      // Track metrics
      if (this.metrics) {
        this.metrics.incrementCounter('events_published', {
          eventType: event.eventType,
          priority: EventPriority[priority]
        });
        this.metrics.recordHistogram('event_publish_duration', Date.now() - startTime);
      }

      this.logger.debug(`Event published: ${event.eventType}`, {
        eventId: event.metadata.eventId,
        aggregateId: event.aggregateId
      });
    } catch (error) {
      this.logger.error('Failed to publish event', error as Error, {
        eventType: event.eventType
      });
      throw error;
    }
  }

  /**
   * Publish multiple events as a batch
   */
  async publishBatch(events: DomainEvent[], priority: EventPriority = EventPriority.NORMAL): Promise<void> {
    const startTime = Date.now();

    try {
      // Persist batch if store is available
      if (this.config.enablePersistence && this.eventStore) {
        await this.eventStore.appendBatch(events);
      }

      // Add all events to queue
      const queuedEvents = events.map(event => ({
        event,
        priority,
        retryCount: 0,
        timestamp: new Date()
      }));

      this.processingQueue.push(...queuedEvents);
      this.processingQueue.sort((a, b) => b.priority - a.priority);

      if (this.metrics) {
        this.metrics.incrementCounter('events_batch_published', {
          count: events.length.toString()
        });
        this.metrics.recordHistogram('event_batch_publish_duration', Date.now() - startTime);
      }

      this.logger.info(`Batch of ${events.length} events published`);
    } catch (error) {
      this.logger.error('Failed to publish event batch', error as Error);
      throw error;
    }
  }

  /**
   * Subscribe to events
   */
  subscribe(
    eventType: string | string[],
    handler: EventHandler,
    options: {
      priority?: EventPriority;
      filter?: EventFilter;
      deliveryGuarantee?: DeliveryGuarantee;
    } = {}
  ): string {
    const subscriptionId = this.generateSubscriptionId();
    
    const subscription: EventSubscription = {
      id: subscriptionId,
      eventType,
      handler,
      priority: options.priority || EventPriority.NORMAL,
      filter: options.filter,
      deliveryGuarantee: options.deliveryGuarantee || DeliveryGuarantee.AT_LEAST_ONCE
    };

    this.subscriptions.set(subscriptionId, subscription);

    // Register event handlers
    const eventTypes = Array.isArray(eventType) ? eventType : [eventType];
    eventTypes.forEach(type => {
      this.emitter.on(type, async (event: DomainEvent) => {
        await this.handleEvent(event, subscription);
      });
    });

    this.logger.info(`Subscription created: ${subscriptionId}`, {
      eventTypes,
      priority: EventPriority[subscription.priority]
    });

    return subscriptionId;
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return;
    }

    const eventTypes = Array.isArray(subscription.eventType) 
      ? subscription.eventType 
      : [subscription.eventType];

    eventTypes.forEach(type => {
      this.emitter.removeAllListeners(type);
    });

    this.subscriptions.delete(subscriptionId);
    this.logger.info(`Subscription removed: ${subscriptionId}`);
  }

  /**
   * Process events from the queue
   */
  private async startProcessing(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    while (this.isProcessing) {
      if (this.processingQueue.length === 0) {
        await this.sleep(100);
        continue;
      }

      const queuedEvent = this.processingQueue.shift();
      if (!queuedEvent) {
        continue;
      }

      try {
        await this.processEvent(queuedEvent);
      } catch (error) {
        await this.handleProcessingError(queuedEvent, error as Error);
      }
    }
  }

  /**
   * Process a single event
   */
  private async processEvent(queuedEvent: QueuedEvent): Promise<void> {
    const { event } = queuedEvent;
    const startTime = Date.now();

    try {
      // Emit event to all listeners
      this.emitter.emit(event.eventType, event);

      // Track metrics
      if (this.metrics) {
        this.metrics.recordHistogram('event_processing_duration', Date.now() - startTime);
        this.metrics.incrementCounter('events_processed', {
          eventType: event.eventType
        });
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Handle event processing for a subscription
   */
  private async handleEvent(event: DomainEvent, subscription: EventSubscription): Promise<void> {
    try {
      // Apply filters
      if (subscription.filter && !this.matchesFilter(event, subscription.filter)) {
        return;
      }

      // Handle based on delivery guarantee
      switch (subscription.deliveryGuarantee) {
        case DeliveryGuarantee.AT_MOST_ONCE:
          // Fire and forget
          subscription.handler.handle(event).catch(error => {
            this.logger.error('Handler error (at-most-once)', error);
          });
          break;

        case DeliveryGuarantee.AT_LEAST_ONCE:
          // Retry on failure
          await this.handleWithRetry(event, subscription);
          break;

        case DeliveryGuarantee.EXACTLY_ONCE:
          // Idempotent handling with deduplication
          await this.handleExactlyOnce(event, subscription);
          break;
      }
    } catch (error) {
      if (subscription.handler.onError) {
        await subscription.handler.onError(error as Error, event);
      } else {
        this.logger.error('Unhandled error in event handler', error as Error);
      }
    }
  }

  /**
   * Handle event with retry logic
   */
  private async handleWithRetry(
    event: DomainEvent,
    subscription: EventSubscription,
    retryCount: number = 0
  ): Promise<void> {
    try {
      await subscription.handler.handle(event);
    } catch (error) {
      if (retryCount < this.config.retryPolicy.maxRetries) {
        const delay = this.calculateRetryDelay(retryCount);
        await this.sleep(delay);
        await this.handleWithRetry(event, subscription, retryCount + 1);
      } else {
        throw error;
      }
    }
  }

  /**
   * Handle event with exactly-once semantics
   */
  private async handleExactlyOnce(event: DomainEvent, subscription: EventSubscription): Promise<void> {
    const processingKey = `${subscription.id}:${event.metadata.eventId}`;
    
    // Check if already processed (would use Redis or similar in production)
    if (this.hasBeenProcessed(processingKey)) {
      return;
    }

    try {
      await subscription.handler.handle(event);
      this.markAsProcessed(processingKey);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Handle processing errors
   */
  private async handleProcessingError(queuedEvent: QueuedEvent, error: Error): Promise<void> {
    queuedEvent.retryCount++;

    if (queuedEvent.retryCount <= this.config.retryPolicy.maxRetries) {
      // Retry with backoff
      const delay = this.calculateRetryDelay(queuedEvent.retryCount);
      setTimeout(() => {
        this.processingQueue.push(queuedEvent);
      }, delay);

      this.logger.warn(`Event processing failed, retrying (${queuedEvent.retryCount}/${this.config.retryPolicy.maxRetries})`, {
        eventType: queuedEvent.event.eventType,
        error: error.message
      });
    } else {
      // Move to dead letter queue
      if (this.config.deadLetterQueue) {
        this.deadLetterQueue.push(queuedEvent);
        this.logger.error('Event moved to dead letter queue', error, {
          eventType: queuedEvent.event.eventType
        });

        if (this.metrics) {
          this.metrics.incrementCounter('events_dead_lettered', {
            eventType: queuedEvent.event.eventType
          });
        }
      }
    }
  }

  /**
   * Check if event matches filter
   */
  private matchesFilter(event: DomainEvent, filter: EventFilter): boolean {
    if (filter.eventTypes && !filter.eventTypes.includes(event.eventType)) {
      return false;
    }

    if (filter.aggregateTypes && !filter.aggregateTypes.includes(event.metadata.aggregateType)) {
      return false;
    }

    if (filter.aggregateIds && !filter.aggregateIds.includes(event.aggregateId)) {
      return false;
    }

    if (filter.userId && event.metadata.userId !== filter.userId) {
      return false;
    }

    if (filter.tenantId && event.metadata.tenantId !== filter.tenantId) {
      return false;
    }

    if (filter.fromTimestamp && event.metadata.timestamp < filter.fromTimestamp) {
      return false;
    }

    if (filter.toTimestamp && event.metadata.timestamp > filter.toTimestamp) {
      return false;
    }

    return true;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number): number {
    const delay = Math.min(
      this.config.retryPolicy.initialDelay * Math.pow(this.config.retryPolicy.backoffMultiplier, retryCount),
      this.config.retryPolicy.maxDelay
    );
    return delay;
  }

  /**
   * Check if event has been processed (simplified - use Redis in production)
   */
  private processedEvents = new Set<string>();
  
  private hasBeenProcessed(key: string): boolean {
    return this.processedEvents.has(key);
  }

  private markAsProcessed(key: string): void {
    this.processedEvents.add(key);
  }

  /**
   * Generate unique subscription ID
   */
  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get dead letter queue events
   */
  getDeadLetterQueue(): QueuedEvent[] {
    return [...this.deadLetterQueue];
  }

  /**
   * Replay dead letter queue events
   */
  async replayDeadLetterQueue(): Promise<void> {
    const events = [...this.deadLetterQueue];
    this.deadLetterQueue = [];

    for (const queuedEvent of events) {
      queuedEvent.retryCount = 0;
      this.processingQueue.push(queuedEvent);
    }

    this.logger.info(`Replaying ${events.length} events from dead letter queue`);
  }

  /**
   * Stop processing
   */
  async stop(): Promise<void> {
    this.isProcessing = false;
    this.emitter.removeAllListeners();
    this.subscriptions.clear();
    this.logger.info('Event bus stopped');
  }

  /**
   * Get metrics
   */
  getMetrics(): any {
    if (!this.metrics) {
      return null;
    }

    return {
      queueSize: this.processingQueue.length,
      deadLetterQueueSize: this.deadLetterQueue.length,
      subscriptions: this.subscriptions.size,
      ...this.metrics.getMetrics()
    };
  }
}