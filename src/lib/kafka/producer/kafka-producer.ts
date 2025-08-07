/**
 * Kafka Producer with Exactly-Once Semantics
 * High-performance producer with schema registry integration
 */

import { Kafka, Producer, ProducerRecord, RecordMetadata, Transaction } from 'kafkajs';
import { SchemaRegistry } from '../schema/schema-registry';
import { KafkaConfiguration } from '../config/kafka-config';
import { Logger } from '../../monitoring/logger';
import { MetricsCollector } from '../../monitoring/metrics';
import { DomainEvent } from '../../event-driven/core/event-types';

export interface ProducerOptions {
  transactional?: boolean;
  idempotent?: boolean;
  maxInFlightRequests?: number;
  compression?: 'gzip' | 'snappy' | 'lz4' | 'zstd';
  batchSize?: number;
  lingerMs?: number;
}

export interface SendResult {
  topic: string;
  partition: number;
  offset: string;
  timestamp?: string;
}

export class KafkaProducer {
  private kafka: Kafka;
  private producer: Producer;
  private schemaRegistry: SchemaRegistry;
  private logger: Logger;
  private metrics: MetricsCollector;
  private config: KafkaConfiguration;
  private isConnected: boolean = false;
  private transaction?: Transaction;
  private options: ProducerOptions;
  private sendBuffer: ProducerRecord[] = [];
  private batchTimer?: NodeJS.Timeout;

  constructor(options: ProducerOptions = {}) {
    this.config = KafkaConfiguration.getInstance();
    this.kafka = new Kafka(this.config.getKafkaJSConfig());
    this.schemaRegistry = new SchemaRegistry();
    this.logger = new Logger('KafkaProducer');
    this.metrics = new MetricsCollector('kafka_producer');
    this.options = {
      transactional: options.transactional ?? false,
      idempotent: options.idempotent ?? true,
      maxInFlightRequests: options.maxInFlightRequests ?? 5,
      compression: options.compression ?? 'gzip',
      batchSize: options.batchSize ?? 100,
      lingerMs: options.lingerMs ?? 100
    };

    const producerConfig = this.config.getProducerConfig();
    this.producer = this.kafka.producer({
      ...producerConfig,
      idempotent: this.options.idempotent,
      transactionalId: this.options.transactional ? `${this.config.getConfig().clientId}-${Date.now()}` : undefined,
      maxInFlightRequests: this.options.maxInFlightRequests,
      compression: this.options.compression as any
    });
  }

  /**
   * Connect to Kafka
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      await this.producer.connect();
      await this.schemaRegistry.connect();
      this.isConnected = true;

      // Start batch processing
      this.startBatchProcessor();

      this.logger.info('Producer connected to Kafka');
    } catch (error) {
      this.logger.error('Failed to connect producer', error as Error);
      throw error;
    }
  }

  /**
   * Send a single event
   */
  async send(topic: string, event: DomainEvent, key?: string): Promise<SendResult> {
    const startTime = Date.now();

    try {
      // Serialize event with schema
      const value = await this.schemaRegistry.serialize(topic, event);

      const record: ProducerRecord = {
        topic,
        messages: [{
          key: key || event.metadata.aggregateId,
          value,
          headers: {
            'event-id': event.metadata.eventId,
            'event-type': event.metadata.eventType,
            'correlation-id': event.metadata.correlationId,
            'timestamp': event.metadata.timestamp.toISOString()
          },
          timestamp: event.metadata.timestamp.getTime().toString()
        }]
      };

      const metadata = await this.producer.send(record);
      const result = metadata[0];

      // Track metrics
      this.metrics.recordHistogram('send_latency', Date.now() - startTime);
      this.metrics.incrementCounter('events_sent', {
        topic,
        eventType: event.metadata.eventType
      });

      return {
        topic: result.topicName || topic,
        partition: result.partition,
        offset: result.offset,
        timestamp: result.timestamp
      };
    } catch (error) {
      this.metrics.incrementCounter('send_errors', { topic });
      this.logger.error('Failed to send event', error as Error);
      throw error;
    }
  }

  /**
   * Send batch of events
   */
  async sendBatch(topic: string, events: DomainEvent[]): Promise<SendResult[]> {
    const startTime = Date.now();

    try {
      // Serialize all events
      const messages = await Promise.all(
        events.map(async event => {
          const value = await this.schemaRegistry.serialize(topic, event);
          return {
            key: event.metadata.aggregateId,
            value,
            headers: {
              'event-id': event.metadata.eventId,
              'event-type': event.metadata.eventType,
              'correlation-id': event.metadata.correlationId,
              'timestamp': event.metadata.timestamp.toISOString()
            },
            timestamp: event.metadata.timestamp.getTime().toString()
          };
        })
      );

      const record: ProducerRecord = {
        topic,
        messages,
        compression: this.options.compression as any
      };

      const metadata = await this.producer.send(record);

      // Track metrics
      this.metrics.recordHistogram('batch_send_latency', Date.now() - startTime);
      this.metrics.incrementCounter('batch_events_sent', {
        topic,
        count: events.length.toString()
      });

      return metadata.map(result => ({
        topic: result.topicName || topic,
        partition: result.partition,
        offset: result.offset,
        timestamp: result.timestamp
      }));
    } catch (error) {
      this.metrics.incrementCounter('batch_send_errors', { topic });
      this.logger.error('Failed to send batch', error as Error);
      throw error;
    }
  }

  /**
   * Send with transaction (exactly-once semantics)
   */
  async sendTransactional(operations: () => Promise<void>): Promise<void> {
    if (!this.options.transactional) {
      throw new Error('Producer not configured for transactions');
    }

    const startTime = Date.now();

    try {
      this.transaction = await this.producer.transaction();

      // Execute operations within transaction
      await operations();

      // Commit transaction
      await this.transaction.commit();

      this.metrics.recordHistogram('transaction_duration', Date.now() - startTime);
      this.metrics.incrementCounter('transactions_committed');
    } catch (error) {
      if (this.transaction) {
        await this.transaction.abort();
        this.metrics.incrementCounter('transactions_aborted');
      }
      this.logger.error('Transaction failed', error as Error);
      throw error;
    } finally {
      this.transaction = undefined;
    }
  }

  /**
   * Add event to buffer for batch sending
   */
  async buffer(topic: string, event: DomainEvent, key?: string): Promise<void> {
    const value = await this.schemaRegistry.serialize(topic, event);

    const record: ProducerRecord = {
      topic,
      messages: [{
        key: key || event.metadata.aggregateId,
        value,
        headers: {
          'event-id': event.metadata.eventId,
          'event-type': event.metadata.eventType,
          'correlation-id': event.metadata.correlationId,
          'timestamp': event.metadata.timestamp.toISOString()
        },
        timestamp: event.metadata.timestamp.getTime().toString()
      }]
    };

    this.sendBuffer.push(record);

    // Check if batch size reached
    if (this.sendBuffer.length >= this.options.batchSize!) {
      await this.flushBuffer();
    }
  }

  /**
   * Flush buffered events
   */
  async flushBuffer(): Promise<void> {
    if (this.sendBuffer.length === 0) {
      return;
    }

    const startTime = Date.now();
    const bufferCopy = [...this.sendBuffer];
    this.sendBuffer = [];

    try {
      // Group by topic
      const topicGroups = new Map<string, any[]>();
      
      for (const record of bufferCopy) {
        const topic = record.topic;
        if (!topicGroups.has(topic)) {
          topicGroups.set(topic, []);
        }
        topicGroups.get(topic)!.push(...record.messages);
      }

      // Send each topic group
      const sendPromises = Array.from(topicGroups.entries()).map(([topic, messages]) => 
        this.producer.send({
          topic,
          messages,
          compression: this.options.compression as any
        })
      );

      await Promise.all(sendPromises);

      this.metrics.recordHistogram('buffer_flush_latency', Date.now() - startTime);
      this.metrics.incrementCounter('buffer_flushes', {
        count: bufferCopy.length.toString()
      });
    } catch (error) {
      // Re-add failed messages to buffer
      this.sendBuffer.unshift(...bufferCopy);
      this.logger.error('Failed to flush buffer', error as Error);
      throw error;
    }
  }

  /**
   * Start batch processor
   */
  private startBatchProcessor(): void {
    if (this.batchTimer) {
      return;
    }

    this.batchTimer = setInterval(async () => {
      try {
        await this.flushBuffer();
      } catch (error) {
        this.logger.error('Batch processor error', error as Error);
      }
    }, this.options.lingerMs!);
  }

  /**
   * Stop batch processor
   */
  private stopBatchProcessor(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = undefined;
    }
  }

  /**
   * Send to dead letter queue
   */
  async sendToDeadLetterQueue(event: DomainEvent, error: Error): Promise<void> {
    try {
      const dlqEvent = {
        ...event,
        metadata: {
          ...event.metadata,
          eventType: `dlq.${event.metadata.eventType}`,
          originalEventType: event.metadata.eventType,
          error: {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
          }
        }
      };

      await this.send('backstage.dlq', dlqEvent as any);
      
      this.metrics.incrementCounter('dlq_events_sent', {
        originalEventType: event.metadata.eventType
      });
    } catch (dlqError) {
      this.logger.error('Failed to send to DLQ', dlqError as Error);
    }
  }

  /**
   * Get producer metrics
   */
  async getMetrics(): Promise<any> {
    const metrics = await this.producer.describeGroups();
    
    return {
      connected: this.isConnected,
      bufferSize: this.sendBuffer.length,
      ...this.metrics.getMetrics(),
      kafkaMetrics: metrics
    };
  }

  /**
   * Disconnect from Kafka
   */
  async disconnect(): Promise<void> {
    try {
      // Flush any remaining buffered events
      await this.flushBuffer();
      
      // Stop batch processor
      this.stopBatchProcessor();

      // Disconnect producer
      await this.producer.disconnect();
      this.isConnected = false;

      this.logger.info('Producer disconnected from Kafka');
    } catch (error) {
      this.logger.error('Error disconnecting producer', error as Error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.isConnected) {
        return false;
      }

      // Try to get metadata
      const admin = this.kafka.admin();
      await admin.connect();
      await admin.listTopics();
      await admin.disconnect();

      return true;
    } catch (error) {
      this.logger.error('Health check failed', error as Error);
      return false;
    }
  }
}