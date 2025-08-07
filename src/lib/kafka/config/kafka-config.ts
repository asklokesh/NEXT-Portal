/**
 * Kafka Configuration
 * Central configuration for Kafka infrastructure
 */

import { KafkaConfig as KafkaJSConfig, logLevel } from 'kafkajs';

export interface KafkaConfig {
  clientId: string;
  brokers: string[];
  ssl?: boolean;
  sasl?: {
    mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512';
    username: string;
    password: string;
  };
  connectionTimeout?: number;
  requestTimeout?: number;
  retry?: {
    initialRetryTime?: number;
    retries?: number;
    maxRetryTime?: number;
    factor?: number;
    multiplier?: number;
  };
  schemaRegistry?: {
    url: string;
    auth?: {
      username: string;
      password: string;
    };
  };
}

export interface ProducerConfig {
  allowAutoTopicCreation?: boolean;
  transactionTimeout?: number;
  idempotent?: boolean;
  maxInFlightRequests?: number;
  compression?: 'gzip' | 'snappy' | 'lz4' | 'zstd';
  acks?: -1 | 0 | 1;
  timeout?: number;
  retry?: {
    retries?: number;
    initialRetryTime?: number;
    factor?: number;
  };
}

export interface ConsumerConfig {
  groupId: string;
  sessionTimeout?: number;
  heartbeatInterval?: number;
  rebalanceTimeout?: number;
  autoCommit?: boolean;
  autoCommitInterval?: number;
  autoCommitThreshold?: number;
  eachBatchAutoResolve?: boolean;
  partitionsConsumedConcurrently?: number;
  retry?: {
    retries?: number;
    initialRetryTime?: number;
    factor?: number;
  };
  maxBytesPerPartition?: number;
  minBytes?: number;
  maxBytes?: number;
  maxWaitTimeInMs?: number;
}

export interface TopicConfig {
  name: string;
  numPartitions?: number;
  replicationFactor?: number;
  replicaAssignment?: Array<{ partition: number; replicas: number[] }>;
  configEntries?: Array<{ name: string; value: string }>;
}

export class KafkaConfiguration {
  private static instance: KafkaConfiguration;
  private config: KafkaConfig;

  private constructor() {
    this.config = this.loadConfiguration();
  }

  static getInstance(): KafkaConfiguration {
    if (!KafkaConfiguration.instance) {
      KafkaConfiguration.instance = new KafkaConfiguration();
    }
    return KafkaConfiguration.instance;
  }

  private loadConfiguration(): KafkaConfig {
    return {
      clientId: process.env.KAFKA_CLIENT_ID || 'backstage-portal',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      ssl: process.env.KAFKA_SSL === 'true',
      sasl: process.env.KAFKA_SASL_USERNAME ? {
        mechanism: (process.env.KAFKA_SASL_MECHANISM || 'plain') as any,
        username: process.env.KAFKA_SASL_USERNAME,
        password: process.env.KAFKA_SASL_PASSWORD || ''
      } : undefined,
      connectionTimeout: parseInt(process.env.KAFKA_CONNECTION_TIMEOUT || '10000'),
      requestTimeout: parseInt(process.env.KAFKA_REQUEST_TIMEOUT || '30000'),
      retry: {
        initialRetryTime: parseInt(process.env.KAFKA_INITIAL_RETRY_TIME || '100'),
        retries: parseInt(process.env.KAFKA_RETRIES || '10'),
        maxRetryTime: parseInt(process.env.KAFKA_MAX_RETRY_TIME || '30000'),
        factor: parseFloat(process.env.KAFKA_RETRY_FACTOR || '0.2'),
        multiplier: parseFloat(process.env.KAFKA_RETRY_MULTIPLIER || '2')
      },
      schemaRegistry: process.env.SCHEMA_REGISTRY_URL ? {
        url: process.env.SCHEMA_REGISTRY_URL,
        auth: process.env.SCHEMA_REGISTRY_USERNAME ? {
          username: process.env.SCHEMA_REGISTRY_USERNAME,
          password: process.env.SCHEMA_REGISTRY_PASSWORD || ''
        } : undefined
      } : undefined
    };
  }

  getKafkaJSConfig(): KafkaJSConfig {
    return {
      clientId: this.config.clientId,
      brokers: this.config.brokers,
      ssl: this.config.ssl,
      sasl: this.config.sasl,
      connectionTimeout: this.config.connectionTimeout,
      requestTimeout: this.config.requestTimeout,
      retry: this.config.retry,
      logLevel: this.getLogLevel()
    };
  }

  getProducerConfig(): ProducerConfig {
    return {
      allowAutoTopicCreation: process.env.KAFKA_AUTO_CREATE_TOPICS === 'true',
      transactionTimeout: parseInt(process.env.KAFKA_TRANSACTION_TIMEOUT || '60000'),
      idempotent: process.env.KAFKA_IDEMPOTENT !== 'false',
      maxInFlightRequests: parseInt(process.env.KAFKA_MAX_IN_FLIGHT || '5'),
      compression: (process.env.KAFKA_COMPRESSION || 'gzip') as any,
      acks: parseInt(process.env.KAFKA_ACKS || '-1') as any,
      timeout: parseInt(process.env.KAFKA_PRODUCER_TIMEOUT || '30000'),
      retry: {
        retries: parseInt(process.env.KAFKA_PRODUCER_RETRIES || '5'),
        initialRetryTime: parseInt(process.env.KAFKA_PRODUCER_INITIAL_RETRY || '100'),
        factor: parseFloat(process.env.KAFKA_PRODUCER_RETRY_FACTOR || '0.2')
      }
    };
  }

  getConsumerConfig(groupId: string): ConsumerConfig {
    return {
      groupId,
      sessionTimeout: parseInt(process.env.KAFKA_SESSION_TIMEOUT || '30000'),
      heartbeatInterval: parseInt(process.env.KAFKA_HEARTBEAT_INTERVAL || '3000'),
      rebalanceTimeout: parseInt(process.env.KAFKA_REBALANCE_TIMEOUT || '60000'),
      autoCommit: process.env.KAFKA_AUTO_COMMIT !== 'false',
      autoCommitInterval: parseInt(process.env.KAFKA_AUTO_COMMIT_INTERVAL || '5000'),
      autoCommitThreshold: parseInt(process.env.KAFKA_AUTO_COMMIT_THRESHOLD || '100'),
      eachBatchAutoResolve: process.env.KAFKA_BATCH_AUTO_RESOLVE !== 'false',
      partitionsConsumedConcurrently: parseInt(process.env.KAFKA_CONCURRENT_PARTITIONS || '1'),
      retry: {
        retries: parseInt(process.env.KAFKA_CONSUMER_RETRIES || '5'),
        initialRetryTime: parseInt(process.env.KAFKA_CONSUMER_INITIAL_RETRY || '100'),
        factor: parseFloat(process.env.KAFKA_CONSUMER_RETRY_FACTOR || '0.2')
      },
      maxBytesPerPartition: parseInt(process.env.KAFKA_MAX_BYTES_PER_PARTITION || '1048576'),
      minBytes: parseInt(process.env.KAFKA_MIN_BYTES || '1'),
      maxBytes: parseInt(process.env.KAFKA_MAX_BYTES || '10485760'),
      maxWaitTimeInMs: parseInt(process.env.KAFKA_MAX_WAIT_TIME || '5000')
    };
  }

  getSchemaRegistryConfig() {
    return this.config.schemaRegistry;
  }

  private getLogLevel(): logLevel {
    const level = process.env.KAFKA_LOG_LEVEL || 'INFO';
    switch (level.toUpperCase()) {
      case 'ERROR': return logLevel.ERROR;
      case 'WARN': return logLevel.WARN;
      case 'INFO': return logLevel.INFO;
      case 'DEBUG': return logLevel.DEBUG;
      default: return logLevel.INFO;
    }
  }

  // Topic configurations
  getTopicConfigs(): TopicConfig[] {
    return [
      {
        name: 'backstage.events',
        numPartitions: 10,
        replicationFactor: 3,
        configEntries: [
          { name: 'retention.ms', value: '604800000' }, // 7 days
          { name: 'compression.type', value: 'gzip' },
          { name: 'max.message.bytes', value: '1048576' }
        ]
      },
      {
        name: 'backstage.commands',
        numPartitions: 5,
        replicationFactor: 3,
        configEntries: [
          { name: 'retention.ms', value: '86400000' }, // 1 day
          { name: 'compression.type', value: 'gzip' }
        ]
      },
      {
        name: 'backstage.queries',
        numPartitions: 5,
        replicationFactor: 3,
        configEntries: [
          { name: 'retention.ms', value: '86400000' }, // 1 day
          { name: 'compression.type', value: 'gzip' }
        ]
      },
      {
        name: 'backstage.audit',
        numPartitions: 3,
        replicationFactor: 3,
        configEntries: [
          { name: 'retention.ms', value: '2592000000' }, // 30 days
          { name: 'compression.type', value: 'gzip' },
          { name: 'cleanup.policy', value: 'compact' }
        ]
      },
      {
        name: 'backstage.dlq',
        numPartitions: 3,
        replicationFactor: 3,
        configEntries: [
          { name: 'retention.ms', value: '604800000' }, // 7 days
          { name: 'compression.type', value: 'gzip' }
        ]
      },
      {
        name: 'backstage.saga',
        numPartitions: 5,
        replicationFactor: 3,
        configEntries: [
          { name: 'retention.ms', value: '172800000' }, // 2 days
          { name: 'compression.type', value: 'gzip' }
        ]
      }
    ];
  }

  getConfig(): KafkaConfig {
    return this.config;
  }
}