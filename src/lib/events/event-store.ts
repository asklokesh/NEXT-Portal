/**
 * Event Sourcing Implementation with CQRS
 * Manages event streams for critical business entities
 */

export interface DomainEvent {
  id: string;
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  eventVersion: number;
  timestamp: Date;
  data: any;
  metadata?: {
    userId?: string;
    sessionId?: string;
    correlationId?: string;
    causationId?: string;
    sagaExecutionId?: string;
    [key: string]: any;
  };
}

export interface EventStreamMetadata {
  aggregateId: string;
  aggregateType: string;
  version: number;
  lastEventId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Snapshot {
  id: string;
  aggregateId: string;
  aggregateType: string;
  version: number;
  timestamp: Date;
  data: any;
}

export interface EventQuery {
  aggregateId?: string;
  aggregateType?: string;
  eventType?: string;
  fromVersion?: number;
  toVersion?: number;
  fromTimestamp?: Date;
  toTimestamp?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Event Store for persisting and retrieving domain events
 */
export class EventStore {
  private events: Map<string, DomainEvent[]> = new Map();
  private snapshots: Map<string, Snapshot> = new Map();
  private metadata: Map<string, EventStreamMetadata> = new Map();
  private subscribers: Map<string, Array<(event: DomainEvent) => void>> = new Map();

  /**
   * Append events to an aggregate stream
   */
  async appendEvents(
    aggregateId: string,
    aggregateType: string,
    events: Omit<DomainEvent, 'id' | 'aggregateId' | 'aggregateType' | 'timestamp'>[],
    expectedVersion?: number
  ): Promise<void> {
    const streamKey = `${aggregateType}:${aggregateId}`;
    const currentMetadata = this.metadata.get(streamKey);

    // Check optimistic concurrency
    if (expectedVersion !== undefined && currentMetadata && currentMetadata.version !== expectedVersion) {
      throw new Error(`Concurrency conflict: expected version ${expectedVersion}, current version ${currentMetadata.version}`);
    }

    const currentEvents = this.events.get(streamKey) || [];
    const newVersion = currentMetadata ? currentMetadata.version + events.length : events.length;

    // Create domain events
    const domainEvents: DomainEvent[] = events.map((event, index) => ({
      ...event,
      id: this.generateEventId(),
      aggregateId,
      aggregateType,
      timestamp: new Date(),
      eventVersion: (currentMetadata?.version || 0) + index + 1
    }));

    // Store events
    this.events.set(streamKey, [...currentEvents, ...domainEvents]);

    // Update metadata
    const lastEvent = domainEvents[domainEvents.length - 1];
    this.metadata.set(streamKey, {
      aggregateId,
      aggregateType,
      version: newVersion,
      lastEventId: lastEvent.id,
      createdAt: currentMetadata?.createdAt || new Date(),
      updatedAt: new Date()
    });

    // Publish events to subscribers
    for (const event of domainEvents) {
      await this.publishEvent(event);
    }
  }

  /**
   * Get events for an aggregate
   */
  async getEvents(aggregateId: string, aggregateType: string, fromVersion = 0): Promise<DomainEvent[]> {
    const streamKey = `${aggregateType}:${aggregateId}`;
    const events = this.events.get(streamKey) || [];
    
    return events.filter(event => event.eventVersion > fromVersion);
  }

  /**
   * Query events with filters
   */
  async queryEvents(query: EventQuery): Promise<DomainEvent[]> {
    let allEvents: DomainEvent[] = [];

    // Collect events from relevant streams
    for (const [streamKey, events] of this.events.entries()) {
      const [aggregateType, aggregateId] = streamKey.split(':');
      
      // Filter by aggregate type
      if (query.aggregateType && aggregateType !== query.aggregateType) {
        continue;
      }

      // Filter by aggregate ID
      if (query.aggregateId && aggregateId !== query.aggregateId) {
        continue;
      }

      allEvents.push(...events);
    }

    // Apply filters
    let filteredEvents = allEvents;

    if (query.eventType) {
      filteredEvents = filteredEvents.filter(event => event.eventType === query.eventType);
    }

    if (query.fromVersion !== undefined) {
      filteredEvents = filteredEvents.filter(event => event.eventVersion >= query.fromVersion!);
    }

    if (query.toVersion !== undefined) {
      filteredEvents = filteredEvents.filter(event => event.eventVersion <= query.toVersion!);
    }

    if (query.fromTimestamp) {
      filteredEvents = filteredEvents.filter(event => event.timestamp >= query.fromTimestamp!);
    }

    if (query.toTimestamp) {
      filteredEvents = filteredEvents.filter(event => event.timestamp <= query.toTimestamp!);
    }

    // Sort by timestamp
    filteredEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Apply pagination
    if (query.offset) {
      filteredEvents = filteredEvents.slice(query.offset);
    }

    if (query.limit) {
      filteredEvents = filteredEvents.slice(0, query.limit);
    }

    return filteredEvents;
  }

  /**
   * Save aggregate snapshot
   */
  async saveSnapshot(snapshot: Omit<Snapshot, 'id' | 'timestamp'>): Promise<void> {
    const snapshotKey = `${snapshot.aggregateType}:${snapshot.aggregateId}`;
    
    const domainSnapshot: Snapshot = {
      ...snapshot,
      id: this.generateSnapshotId(),
      timestamp: new Date()
    };

    this.snapshots.set(snapshotKey, domainSnapshot);
  }

  /**
   * Get aggregate snapshot
   */
  async getSnapshot(aggregateId: string, aggregateType: string): Promise<Snapshot | null> {
    const snapshotKey = `${aggregateType}:${aggregateId}`;
    return this.snapshots.get(snapshotKey) || null;
  }

  /**
   * Subscribe to events
   */
  subscribe(eventType: string, handler: (event: DomainEvent) => void): () => void {
    const handlers = this.subscribers.get(eventType) || [];
    handlers.push(handler);
    this.subscribers.set(eventType, handlers);

    // Return unsubscribe function
    return () => {
      const currentHandlers = this.subscribers.get(eventType) || [];
      const index = currentHandlers.indexOf(handler);
      if (index > -1) {
        currentHandlers.splice(index, 1);
        this.subscribers.set(eventType, currentHandlers);
      }
    };
  }

  /**
   * Subscribe to all events for an aggregate type
   */
  subscribeToAggregate(aggregateType: string, handler: (event: DomainEvent) => void): () => void {
    const eventType = `${aggregateType}:*`;
    return this.subscribe(eventType, handler);
  }

  /**
   * Get stream metadata
   */
  async getStreamMetadata(aggregateId: string, aggregateType: string): Promise<EventStreamMetadata | null> {
    const streamKey = `${aggregateType}:${aggregateId}`;
    return this.metadata.get(streamKey) || null;
  }

  /**
   * Get all streams for an aggregate type
   */
  async getStreamsByType(aggregateType: string): Promise<EventStreamMetadata[]> {
    const streams: EventStreamMetadata[] = [];
    
    for (const [streamKey, metadata] of this.metadata.entries()) {
      if (streamKey.startsWith(`${aggregateType}:`)) {
        streams.push(metadata);
      }
    }

    return streams;
  }

  /**
   * Publish event to subscribers
   */
  private async publishEvent(event: DomainEvent): Promise<void> {
    // Notify specific event type subscribers
    const specificHandlers = this.subscribers.get(event.eventType) || [];
    for (const handler of specificHandlers) {
      try {
        await handler(event);
      } catch (error) {
        console.error(`Error in event handler for ${event.eventType}:`, error);
      }
    }

    // Notify aggregate type subscribers
    const aggregateHandlers = this.subscribers.get(`${event.aggregateType}:*`) || [];
    for (const handler of aggregateHandlers) {
      try {
        await handler(event);
      } catch (error) {
        console.error(`Error in aggregate handler for ${event.aggregateType}:`, error);
      }
    }

    // Notify global subscribers
    const globalHandlers = this.subscribers.get('*') || [];
    for (const handler of globalHandlers) {
      try {
        await handler(event);
      } catch (error) {
        console.error('Error in global event handler:', error);
      }
    }
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique snapshot ID
   */
  private generateSnapshotId(): string {
    return `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalEvents: number;
    totalStreams: number;
    totalSnapshots: number;
    eventsByType: Record<string, number>;
    streamsByType: Record<string, number>;
  } {
    let totalEvents = 0;
    const eventsByType: Record<string, number> = {};
    const streamsByType: Record<string, number> = {};

    // Count events
    for (const events of this.events.values()) {
      totalEvents += events.length;
      
      for (const event of events) {
        eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;
      }
    }

    // Count streams by type
    for (const metadata of this.metadata.values()) {
      streamsByType[metadata.aggregateType] = (streamsByType[metadata.aggregateType] || 0) + 1;
    }

    return {
      totalEvents,
      totalStreams: this.metadata.size,
      totalSnapshots: this.snapshots.size,
      eventsByType,
      streamsByType
    };
  }
}

/**
 * Base Aggregate Root with event sourcing capabilities
 */
export abstract class AggregateRoot {
  protected id: string;
  protected version: number = 0;
  protected uncommittedEvents: DomainEvent[] = [];

  constructor(id: string) {
    this.id = id;
  }

  /**
   * Get aggregate ID
   */
  getId(): string {
    return this.id;
  }

  /**
   * Get current version
   */
  getVersion(): number {
    return this.version;
  }

  /**
   * Get uncommitted events
   */
  getUncommittedEvents(): DomainEvent[] {
    return [...this.uncommittedEvents];
  }

  /**
   * Mark events as committed
   */
  markEventsAsCommitted(): void {
    this.uncommittedEvents = [];
  }

  /**
   * Load from history
   */
  loadFromHistory(events: DomainEvent[]): void {
    for (const event of events) {
      this.applyEvent(event, false);
      this.version = Math.max(this.version, event.eventVersion);
    }
  }

  /**
   * Apply event (with option to add to uncommitted events)
   */
  protected applyEvent(event: DomainEvent, isNew = true): void {
    this.apply(event);
    
    if (isNew) {
      this.uncommittedEvents.push(event);
    }
  }

  /**
   * Abstract method for applying events to aggregate state
   */
  protected abstract apply(event: DomainEvent): void;

  /**
   * Create and apply a new event
   */
  protected raiseEvent(eventType: string, data: any, metadata?: any): void {
    const event: DomainEvent = {
      id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      aggregateId: this.id,
      aggregateType: this.constructor.name,
      eventType,
      eventVersion: this.version + this.uncommittedEvents.length + 1,
      timestamp: new Date(),
      data,
      metadata
    };

    this.applyEvent(event);
  }
}

/**
 * Repository for event-sourced aggregates
 */
export abstract class EventSourcedRepository<T extends AggregateRoot> {
  constructor(
    protected eventStore: EventStore,
    protected aggregateType: string
  ) {}

  /**
   * Save aggregate
   */
  async save(aggregate: T): Promise<void> {
    const uncommittedEvents = aggregate.getUncommittedEvents();
    
    if (uncommittedEvents.length === 0) {
      return;
    }

    const eventsToStore = uncommittedEvents.map(event => ({
      eventType: event.eventType,
      eventVersion: event.eventVersion,
      data: event.data,
      metadata: event.metadata
    }));

    await this.eventStore.appendEvents(
      aggregate.getId(),
      this.aggregateType,
      eventsToStore,
      aggregate.getVersion() - uncommittedEvents.length
    );

    aggregate.markEventsAsCommitted();
  }

  /**
   * Get aggregate by ID
   */
  async getById(id: string): Promise<T | null> {
    // Try to load from snapshot first
    const snapshot = await this.eventStore.getSnapshot(id, this.aggregateType);
    let aggregate: T;
    let fromVersion = 0;

    if (snapshot) {
      aggregate = this.createFromSnapshot(snapshot);
      fromVersion = snapshot.version;
    } else {
      aggregate = this.createEmpty(id);
    }

    // Load events since snapshot
    const events = await this.eventStore.getEvents(id, this.aggregateType, fromVersion);
    
    if (events.length === 0 && !snapshot) {
      return null;
    }

    aggregate.loadFromHistory(events);
    return aggregate;
  }

  /**
   * Create empty aggregate
   */
  protected abstract createEmpty(id: string): T;

  /**
   * Create aggregate from snapshot
   */
  protected abstract createFromSnapshot(snapshot: Snapshot): T;
}

// Global event store instance
export const eventStore = new EventStore();

export default eventStore;