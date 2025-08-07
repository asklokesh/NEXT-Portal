/**
 * Event Store Implementation
 * Persistent storage for domain events with snapshots
 */

import { Pool } from 'pg';
import { DomainEvent, EventFilter, EventReplayOptions } from './event-types';
import { Logger } from '../../monitoring/logger';
import { MetricsCollector } from '../../monitoring/metrics';

export interface EventStoreConfig {
  connectionString?: string;
  maxConnections?: number;
  enableSnapshots?: boolean;
  snapshotFrequency?: number;
  compactionThreshold?: number;
  retentionDays?: number;
}

export interface EventSnapshot {
  aggregateId: string;
  aggregateType: string;
  version: number;
  data: any;
  timestamp: Date;
}

export interface EventStream {
  aggregateId: string;
  aggregateType: string;
  events: DomainEvent[];
  version: number;
  snapshot?: EventSnapshot;
}

export class EventStore {
  private pool: Pool;
  private logger: Logger;
  private metrics: MetricsCollector;
  private config: Required<EventStoreConfig>;
  private snapshotCache: Map<string, EventSnapshot>;

  constructor(config: EventStoreConfig = {}) {
    this.config = {
      connectionString: config.connectionString || process.env.DATABASE_URL || 'postgresql://localhost/eventstore',
      maxConnections: config.maxConnections || 20,
      enableSnapshots: config.enableSnapshots ?? true,
      snapshotFrequency: config.snapshotFrequency || 100,
      compactionThreshold: config.compactionThreshold || 1000,
      retentionDays: config.retentionDays || 365
    };

    this.pool = new Pool({
      connectionString: this.config.connectionString,
      max: this.config.maxConnections
    });

    this.logger = new Logger('EventStore');
    this.metrics = new MetricsCollector('event_store');
    this.snapshotCache = new Map();

    this.initialize();
  }

  /**
   * Initialize event store tables
   */
  private async initialize(): Promise<void> {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS events (
          event_id UUID PRIMARY KEY,
          aggregate_id VARCHAR(255) NOT NULL,
          aggregate_type VARCHAR(100) NOT NULL,
          event_type VARCHAR(100) NOT NULL,
          event_version INTEGER NOT NULL,
          event_data JSONB NOT NULL,
          metadata JSONB NOT NULL,
          timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          correlation_id UUID,
          causation_id UUID,
          user_id VARCHAR(255),
          tenant_id VARCHAR(255),
          UNIQUE(aggregate_id, event_version)
        );

        CREATE INDEX IF NOT EXISTS idx_events_aggregate ON events(aggregate_id, event_version);
        CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
        CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
        CREATE INDEX IF NOT EXISTS idx_events_correlation ON events(correlation_id);
        CREATE INDEX IF NOT EXISTS idx_events_tenant ON events(tenant_id);
      `);

      if (this.config.enableSnapshots) {
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS snapshots (
            snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            aggregate_id VARCHAR(255) NOT NULL,
            aggregate_type VARCHAR(100) NOT NULL,
            version INTEGER NOT NULL,
            data JSONB NOT NULL,
            timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(aggregate_id, version)
          );

          CREATE INDEX IF NOT EXISTS idx_snapshots_aggregate ON snapshots(aggregate_id, version DESC);
        `);
      }

      // Create compaction tracking table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS event_compaction (
          aggregate_id VARCHAR(255) PRIMARY KEY,
          last_compacted_version INTEGER NOT NULL,
          last_compaction_time TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      this.logger.info('Event store initialized');
    } catch (error) {
      this.logger.error('Failed to initialize event store', error as Error);
      throw error;
    }
  }

  /**
   * Append event to store
   */
  async append(event: DomainEvent): Promise<void> {
    const startTime = Date.now();

    try {
      await this.pool.query(
        `INSERT INTO events (
          event_id, aggregate_id, aggregate_type, event_type,
          event_version, event_data, metadata, timestamp,
          correlation_id, causation_id, user_id, tenant_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          event.metadata.eventId,
          event.metadata.aggregateId,
          event.metadata.aggregateType,
          event.metadata.eventType,
          event.metadata.version,
          JSON.stringify(event.payload),
          JSON.stringify(event.metadata),
          event.metadata.timestamp,
          event.metadata.correlationId,
          event.metadata.causationId,
          event.metadata.userId,
          event.metadata.tenantId
        ]
      );

      // Check if snapshot is needed
      if (this.config.enableSnapshots && event.metadata.version % this.config.snapshotFrequency === 0) {
        await this.createSnapshot(event.metadata.aggregateId, event.metadata.aggregateType);
      }

      // Check if compaction is needed
      if (event.metadata.version % this.config.compactionThreshold === 0) {
        this.scheduleCompaction(event.metadata.aggregateId);
      }

      this.metrics.recordHistogram('event_append_duration', Date.now() - startTime);
      this.metrics.incrementCounter('events_appended', {
        eventType: event.metadata.eventType
      });
    } catch (error) {
      this.logger.error('Failed to append event', error as Error);
      throw error;
    }
  }

  /**
   * Append batch of events
   */
  async appendBatch(events: DomainEvent[]): Promise<void> {
    const startTime = Date.now();
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      for (const event of events) {
        await client.query(
          `INSERT INTO events (
            event_id, aggregate_id, aggregate_type, event_type,
            event_version, event_data, metadata, timestamp,
            correlation_id, causation_id, user_id, tenant_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            event.metadata.eventId,
            event.metadata.aggregateId,
            event.metadata.aggregateType,
            event.metadata.eventType,
            event.metadata.version,
            JSON.stringify(event.payload),
            JSON.stringify(event.metadata),
            event.metadata.timestamp,
            event.metadata.correlationId,
            event.metadata.causationId,
            event.metadata.userId,
            event.metadata.tenantId
          ]
        );
      }

      await client.query('COMMIT');

      this.metrics.recordHistogram('event_batch_append_duration', Date.now() - startTime);
      this.metrics.incrementCounter('events_batch_appended', {
        count: events.length.toString()
      });
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Failed to append event batch', error as Error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Load events for an aggregate
   */
  async loadEvents(
    aggregateId: string,
    fromVersion?: number,
    toVersion?: number
  ): Promise<DomainEvent[]> {
    const startTime = Date.now();

    try {
      let query = `
        SELECT event_data, metadata 
        FROM events 
        WHERE aggregate_id = $1
      `;
      const params: any[] = [aggregateId];

      if (fromVersion !== undefined) {
        query += ` AND event_version >= $${params.length + 1}`;
        params.push(fromVersion);
      }

      if (toVersion !== undefined) {
        query += ` AND event_version <= $${params.length + 1}`;
        params.push(toVersion);
      }

      query += ' ORDER BY event_version ASC';

      const result = await this.pool.query(query, params);

      const events = result.rows.map(row => 
        new DomainEvent(row.metadata, row.event_data)
      );

      this.metrics.recordHistogram('event_load_duration', Date.now() - startTime);
      this.metrics.incrementCounter('events_loaded', {
        count: events.length.toString()
      });

      return events;
    } catch (error) {
      this.logger.error('Failed to load events', error as Error);
      throw error;
    }
  }

  /**
   * Load event stream with snapshot
   */
  async loadEventStream(aggregateId: string): Promise<EventStream> {
    const startTime = Date.now();

    try {
      // Load latest snapshot if available
      let snapshot: EventSnapshot | undefined;
      let fromVersion = 1;

      if (this.config.enableSnapshots) {
        snapshot = await this.loadLatestSnapshot(aggregateId);
        if (snapshot) {
          fromVersion = snapshot.version + 1;
        }
      }

      // Load events after snapshot
      const events = await this.loadEvents(aggregateId, fromVersion);

      // Calculate current version
      const lastEvent = events[events.length - 1];
      const version = lastEvent ? lastEvent.metadata.version : (snapshot?.version || 0);

      const stream: EventStream = {
        aggregateId,
        aggregateType: lastEvent?.metadata.aggregateType || snapshot?.aggregateType || '',
        events,
        version,
        snapshot
      };

      this.metrics.recordHistogram('event_stream_load_duration', Date.now() - startTime);

      return stream;
    } catch (error) {
      this.logger.error('Failed to load event stream', error as Error);
      throw error;
    }
  }

  /**
   * Query events with filters
   */
  async queryEvents(filter: EventFilter): Promise<DomainEvent[]> {
    const startTime = Date.now();

    try {
      let query = 'SELECT event_data, metadata FROM events WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (filter.eventTypes && filter.eventTypes.length > 0) {
        query += ` AND event_type = ANY($${paramIndex})`;
        params.push(filter.eventTypes);
        paramIndex++;
      }

      if (filter.aggregateTypes && filter.aggregateTypes.length > 0) {
        query += ` AND aggregate_type = ANY($${paramIndex})`;
        params.push(filter.aggregateTypes);
        paramIndex++;
      }

      if (filter.aggregateIds && filter.aggregateIds.length > 0) {
        query += ` AND aggregate_id = ANY($${paramIndex})`;
        params.push(filter.aggregateIds);
        paramIndex++;
      }

      if (filter.userId) {
        query += ` AND user_id = $${paramIndex}`;
        params.push(filter.userId);
        paramIndex++;
      }

      if (filter.tenantId) {
        query += ` AND tenant_id = $${paramIndex}`;
        params.push(filter.tenantId);
        paramIndex++;
      }

      if (filter.fromTimestamp) {
        query += ` AND timestamp >= $${paramIndex}`;
        params.push(filter.fromTimestamp);
        paramIndex++;
      }

      if (filter.toTimestamp) {
        query += ` AND timestamp <= $${paramIndex}`;
        params.push(filter.toTimestamp);
        paramIndex++;
      }

      query += ' ORDER BY timestamp ASC';

      const result = await this.pool.query(query, params);

      const events = result.rows.map(row => 
        new DomainEvent(row.metadata, row.event_data)
      );

      this.metrics.recordHistogram('event_query_duration', Date.now() - startTime);
      this.metrics.incrementCounter('events_queried', {
        count: events.length.toString()
      });

      return events;
    } catch (error) {
      this.logger.error('Failed to query events', error as Error);
      throw error;
    }
  }

  /**
   * Create snapshot
   */
  private async createSnapshot(aggregateId: string, aggregateType: string): Promise<void> {
    try {
      // Load all events for aggregate
      const events = await this.loadEvents(aggregateId);
      if (events.length === 0) {
        return;
      }

      // Build aggregate state (simplified - would use aggregate-specific logic)
      const aggregateState = this.buildAggregateState(events);
      const version = events[events.length - 1].metadata.version;

      // Save snapshot
      await this.pool.query(
        `INSERT INTO snapshots (aggregate_id, aggregate_type, version, data)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (aggregate_id, version) DO NOTHING`,
        [aggregateId, aggregateType, version, JSON.stringify(aggregateState)]
      );

      // Update cache
      const snapshot: EventSnapshot = {
        aggregateId,
        aggregateType,
        version,
        data: aggregateState,
        timestamp: new Date()
      };
      this.snapshotCache.set(aggregateId, snapshot);

      this.logger.debug(`Snapshot created for aggregate ${aggregateId} at version ${version}`);
    } catch (error) {
      this.logger.error('Failed to create snapshot', error as Error);
      // Don't throw - snapshots are optimization, not critical
    }
  }

  /**
   * Load latest snapshot
   */
  private async loadLatestSnapshot(aggregateId: string): Promise<EventSnapshot | undefined> {
    // Check cache first
    if (this.snapshotCache.has(aggregateId)) {
      return this.snapshotCache.get(aggregateId);
    }

    try {
      const result = await this.pool.query(
        `SELECT aggregate_id, aggregate_type, version, data, timestamp
         FROM snapshots
         WHERE aggregate_id = $1
         ORDER BY version DESC
         LIMIT 1`,
        [aggregateId]
      );

      if (result.rows.length === 0) {
        return undefined;
      }

      const row = result.rows[0];
      const snapshot: EventSnapshot = {
        aggregateId: row.aggregate_id,
        aggregateType: row.aggregate_type,
        version: row.version,
        data: row.data,
        timestamp: row.timestamp
      };

      // Update cache
      this.snapshotCache.set(aggregateId, snapshot);

      return snapshot;
    } catch (error) {
      this.logger.error('Failed to load snapshot', error as Error);
      return undefined;
    }
  }

  /**
   * Build aggregate state from events (simplified)
   */
  private buildAggregateState(events: DomainEvent[]): any {
    const state: any = {};
    
    for (const event of events) {
      // Apply event to state (would be aggregate-specific in real implementation)
      Object.assign(state, event.payload);
      state.version = event.metadata.version;
      state.lastModified = event.metadata.timestamp;
    }

    return state;
  }

  /**
   * Schedule compaction for an aggregate
   */
  private scheduleCompaction(aggregateId: string): void {
    // Run compaction asynchronously
    setTimeout(async () => {
      try {
        await this.compactEvents(aggregateId);
      } catch (error) {
        this.logger.error('Compaction failed', error as Error);
      }
    }, 5000);
  }

  /**
   * Compact old events
   */
  private async compactEvents(aggregateId: string): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Get latest snapshot
      const snapshot = await this.loadLatestSnapshot(aggregateId);
      if (!snapshot) {
        await client.query('COMMIT');
        return;
      }

      // Delete events before snapshot
      await client.query(
        'DELETE FROM events WHERE aggregate_id = $1 AND event_version < $2',
        [aggregateId, snapshot.version]
      );

      // Record compaction
      await client.query(
        `INSERT INTO event_compaction (aggregate_id, last_compacted_version)
         VALUES ($1, $2)
         ON CONFLICT (aggregate_id) DO UPDATE
         SET last_compacted_version = $2, last_compaction_time = NOW()`,
        [aggregateId, snapshot.version]
      );

      await client.query('COMMIT');

      this.logger.info(`Compacted events for aggregate ${aggregateId} up to version ${snapshot.version}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Replay events
   */
  async replayEvents(
    handler: (event: DomainEvent) => Promise<void>,
    options: EventReplayOptions = {}
  ): Promise<void> {
    const startTime = Date.now();
    const batchSize = options.batchSize || 100;
    const speed = options.speed || 1;

    try {
      // Build query based on options
      let query = 'SELECT event_data, metadata FROM events WHERE 1=1';
      const params: any[] = [];

      if (options.fromEventId) {
        query += ' AND event_id > $1';
        params.push(options.fromEventId);
      }

      if (options.fromTimestamp) {
        query += ` AND timestamp >= $${params.length + 1}`;
        params.push(options.fromTimestamp);
      }

      if (options.toTimestamp) {
        query += ` AND timestamp <= $${params.length + 1}`;
        params.push(options.toTimestamp);
      }

      query += ' ORDER BY timestamp ASC';

      // Use cursor for efficient streaming
      const client = await this.pool.connect();
      await client.query('BEGIN');
      await client.query(`DECLARE replay_cursor CURSOR FOR ${query}`, params);

      let totalEvents = 0;
      let hasMore = true;

      while (hasMore) {
        const result = await client.query(`FETCH ${batchSize} FROM replay_cursor`);
        
        if (result.rows.length === 0) {
          hasMore = false;
          break;
        }

        for (const row of result.rows) {
          const event = new DomainEvent(row.metadata, row.event_data);
          
          // Apply speed multiplier
          if (speed !== 1) {
            await this.sleep(100 / speed);
          }

          await handler(event);
          totalEvents++;
        }
      }

      await client.query('CLOSE replay_cursor');
      await client.query('COMMIT');
      client.release();

      this.metrics.recordHistogram('event_replay_duration', Date.now() - startTime);
      this.logger.info(`Replayed ${totalEvents} events`);
    } catch (error) {
      this.logger.error('Failed to replay events', error as Error);
      throw error;
    }
  }

  /**
   * Clean up old events based on retention policy
   */
  async cleanupOldEvents(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

      const result = await this.pool.query(
        'DELETE FROM events WHERE timestamp < $1',
        [cutoffDate]
      );

      this.logger.info(`Cleaned up ${result.rowCount} old events`);
    } catch (error) {
      this.logger.error('Failed to cleanup old events', error as Error);
    }
  }

  /**
   * Get event store statistics
   */
  async getStatistics(): Promise<any> {
    try {
      const stats = await this.pool.query(`
        SELECT 
          COUNT(*) as total_events,
          COUNT(DISTINCT aggregate_id) as total_aggregates,
          COUNT(DISTINCT event_type) as total_event_types,
          MIN(timestamp) as oldest_event,
          MAX(timestamp) as newest_event
        FROM events
      `);

      const snapshotStats = this.config.enableSnapshots ? await this.pool.query(`
        SELECT COUNT(*) as total_snapshots
        FROM snapshots
      `) : { rows: [{ total_snapshots: 0 }] };

      return {
        ...stats.rows[0],
        ...snapshotStats.rows[0],
        snapshot_cache_size: this.snapshotCache.size
      };
    } catch (error) {
      this.logger.error('Failed to get statistics', error as Error);
      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async close(): Promise<void> {
    await this.pool.end();
    this.logger.info('Event store closed');
  }
}