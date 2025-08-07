/**
 * Schema Registry Integration
 * Manages Avro schemas for type-safe event serialization
 */

import axios, { AxiosInstance } from 'axios';
import avro from 'avsc';
import { KafkaConfiguration } from '../config/kafka-config';
import { Logger } from '../../monitoring/logger';
import { DomainEvent } from '../../event-driven/core/event-types';

export interface SchemaRegistryConfig {
  url: string;
  auth?: {
    username: string;
    password: string;
  };
  cacheSize?: number;
  compatibility?: 'NONE' | 'BACKWARD' | 'FORWARD' | 'FULL' | 'BACKWARD_TRANSITIVE' | 'FORWARD_TRANSITIVE' | 'FULL_TRANSITIVE';
}

export interface Schema {
  id: number;
  version: number;
  subject: string;
  schema: string;
}

export class SchemaRegistry {
  private client: AxiosInstance;
  private config: SchemaRegistryConfig;
  private schemaCache: Map<string, avro.Type>;
  private idCache: Map<number, avro.Type>;
  private logger: Logger;

  constructor() {
    const kafkaConfig = KafkaConfiguration.getInstance();
    const registryConfig = kafkaConfig.getSchemaRegistryConfig();
    
    if (!registryConfig) {
      throw new Error('Schema Registry configuration not provided');
    }

    this.config = {
      ...registryConfig,
      cacheSize: 1000,
      compatibility: 'BACKWARD'
    };

    this.client = axios.create({
      baseURL: this.config.url,
      headers: {
        'Content-Type': 'application/vnd.schemaregistry.v1+json'
      },
      auth: this.config.auth
    });

    this.schemaCache = new Map();
    this.idCache = new Map();
    this.logger = new Logger('SchemaRegistry');
  }

  /**
   * Connect and verify schema registry
   */
  async connect(): Promise<void> {
    try {
      await this.client.get('/subjects');
      await this.registerBaseSchemas();
      this.logger.info('Connected to Schema Registry');
    } catch (error) {
      this.logger.error('Failed to connect to Schema Registry', error as Error);
      throw error;
    }
  }

  /**
   * Register base event schemas
   */
  private async registerBaseSchemas(): Promise<void> {
    // Event metadata schema
    const metadataSchema = {
      type: 'record',
      name: 'EventMetadata',
      namespace: 'com.backstage.events',
      fields: [
        { name: 'eventId', type: 'string' },
        { name: 'eventType', type: 'string' },
        { name: 'aggregateId', type: 'string' },
        { name: 'aggregateType', type: 'string' },
        { name: 'timestamp', type: 'long', logicalType: 'timestamp-millis' },
        { name: 'version', type: 'int' },
        { name: 'correlationId', type: 'string' },
        { name: 'causationId', type: ['null', 'string'], default: null },
        { name: 'userId', type: ['null', 'string'], default: null },
        { name: 'tenantId', type: ['null', 'string'], default: null },
        { name: 'source', type: 'string' },
        { name: 'schemaVersion', type: 'string' }
      ]
    };

    // Domain event wrapper schema
    const domainEventSchema = {
      type: 'record',
      name: 'DomainEvent',
      namespace: 'com.backstage.events',
      fields: [
        { name: 'metadata', type: metadataSchema },
        { name: 'payload', type: 'string' } // JSON string for flexibility
      ]
    };

    // Catalog entity schemas
    const entityCreatedSchema = {
      type: 'record',
      name: 'EntityCreatedEvent',
      namespace: 'com.backstage.catalog',
      fields: [
        { name: 'entityId', type: 'string' },
        { name: 'entityType', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'namespace', type: 'string' },
        { name: 'spec', type: 'string' }, // JSON string
        { name: 'metadata', type: 'string' } // JSON string
      ]
    };

    const entityUpdatedSchema = {
      type: 'record',
      name: 'EntityUpdatedEvent',
      namespace: 'com.backstage.catalog',
      fields: [
        { name: 'entityId', type: 'string' },
        { name: 'entityType', type: 'string' },
        { name: 'changes', type: {
          type: 'array',
          items: {
            type: 'record',
            name: 'Change',
            fields: [
              { name: 'field', type: 'string' },
              { name: 'oldValue', type: ['null', 'string'], default: null },
              { name: 'newValue', type: ['null', 'string'], default: null }
            ]
          }
        }},
        { name: 'updatedBy', type: 'string' },
        { name: 'reason', type: ['null', 'string'], default: null }
      ]
    };

    // Plugin schemas
    const pluginInstalledSchema = {
      type: 'record',
      name: 'PluginInstalledEvent',
      namespace: 'com.backstage.plugins',
      fields: [
        { name: 'pluginId', type: 'string' },
        { name: 'pluginName', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'installedBy', type: 'string' },
        { name: 'configuration', type: ['null', 'string'], default: null },
        { name: 'dependencies', type: ['null', {
          type: 'array',
          items: 'string'
        }], default: null }
      ]
    };

    // Template schemas
    const templateExecutedSchema = {
      type: 'record',
      name: 'TemplateExecutedEvent',
      namespace: 'com.backstage.templates',
      fields: [
        { name: 'templateId', type: 'string' },
        { name: 'templateName', type: 'string' },
        { name: 'executionId', type: 'string' },
        { name: 'parameters', type: 'string' }, // JSON string
        { name: 'executedBy', type: 'string' },
        { name: 'result', type: {
          type: 'record',
          name: 'ExecutionResult',
          fields: [
            { name: 'success', type: 'boolean' },
            { name: 'outputs', type: ['null', 'string'], default: null },
            { name: 'errors', type: ['null', {
              type: 'array',
              items: 'string'
            }], default: null }
          ]
        }}
      ]
    };

    // Register schemas
    await this.registerSchema('backstage.events-value', domainEventSchema);
    await this.registerSchema('catalog.entity.created-value', entityCreatedSchema);
    await this.registerSchema('catalog.entity.updated-value', entityUpdatedSchema);
    await this.registerSchema('plugin.installed-value', pluginInstalledSchema);
    await this.registerSchema('template.executed-value', templateExecutedSchema);
  }

  /**
   * Register a schema
   */
  async registerSchema(subject: string, schema: any): Promise<number> {
    try {
      const response = await this.client.post(`/subjects/${subject}/versions`, {
        schema: JSON.stringify(schema)
      });

      const schemaId = response.data.id;
      
      // Cache the parsed schema
      const avroType = avro.Type.forSchema(schema);
      this.schemaCache.set(subject, avroType);
      this.idCache.set(schemaId, avroType);

      this.logger.debug(`Registered schema for subject: ${subject}, ID: ${schemaId}`);
      return schemaId;
    } catch (error: any) {
      if (error.response?.status === 409) {
        // Schema already exists, get the ID
        return await this.getLatestSchemaId(subject);
      }
      this.logger.error(`Failed to register schema for ${subject}`, error);
      throw error;
    }
  }

  /**
   * Get latest schema ID for a subject
   */
  async getLatestSchemaId(subject: string): Promise<number> {
    try {
      const response = await this.client.get(`/subjects/${subject}/versions/latest`);
      return response.data.id;
    } catch (error) {
      this.logger.error(`Failed to get latest schema for ${subject}`, error as Error);
      throw error;
    }
  }

  /**
   * Get schema by ID
   */
  async getSchemaById(id: number): Promise<avro.Type> {
    // Check cache
    if (this.idCache.has(id)) {
      return this.idCache.get(id)!;
    }

    try {
      const response = await this.client.get(`/schemas/ids/${id}`);
      const avroType = avro.Type.forSchema(JSON.parse(response.data.schema));
      
      // Cache it
      this.idCache.set(id, avroType);
      
      return avroType;
    } catch (error) {
      this.logger.error(`Failed to get schema by ID ${id}`, error as Error);
      throw error;
    }
  }

  /**
   * Get schema by subject
   */
  async getSchemaBySubject(subject: string): Promise<avro.Type> {
    // Check cache
    if (this.schemaCache.has(subject)) {
      return this.schemaCache.get(subject)!;
    }

    try {
      const response = await this.client.get(`/subjects/${subject}/versions/latest`);
      const avroType = avro.Type.forSchema(JSON.parse(response.data.schema));
      
      // Cache it
      this.schemaCache.set(subject, avroType);
      this.idCache.set(response.data.id, avroType);
      
      return avroType;
    } catch (error) {
      this.logger.error(`Failed to get schema for subject ${subject}`, error as Error);
      throw error;
    }
  }

  /**
   * Serialize an event
   */
  async serialize(topic: string, event: DomainEvent): Promise<Buffer> {
    const subject = `${topic}-value`;
    
    try {
      // Get schema
      const avroType = await this.getSchemaBySubject(subject);
      const schemaId = await this.getLatestSchemaId(subject);

      // Convert event to Avro format
      const avroEvent = this.domainEventToAvro(event);

      // Encode with schema ID prefix (Confluent wire format)
      const encoded = avroType.toBuffer(avroEvent);
      const buffer = Buffer.alloc(encoded.length + 5);
      
      // Magic byte
      buffer.writeUInt8(0, 0);
      
      // Schema ID (4 bytes, big-endian)
      buffer.writeUInt32BE(schemaId, 1);
      
      // Encoded data
      encoded.copy(buffer, 5);
      
      return buffer;
    } catch (error) {
      this.logger.error('Failed to serialize event', error as Error);
      throw error;
    }
  }

  /**
   * Deserialize an event
   */
  async deserialize(data: Buffer): Promise<DomainEvent> {
    try {
      // Check magic byte
      if (data[0] !== 0) {
        throw new Error('Invalid magic byte in message');
      }

      // Extract schema ID
      const schemaId = data.readUInt32BE(1);
      
      // Get schema
      const avroType = await this.getSchemaById(schemaId);
      
      // Decode message
      const avroEvent = avroType.fromBuffer(data.slice(5));
      
      // Convert back to DomainEvent
      return this.avroToDomainEvent(avroEvent);
    } catch (error) {
      this.logger.error('Failed to deserialize event', error as Error);
      throw error;
    }
  }

  /**
   * Convert DomainEvent to Avro format
   */
  private domainEventToAvro(event: DomainEvent): any {
    return {
      metadata: {
        eventId: event.metadata.eventId,
        eventType: event.metadata.eventType,
        aggregateId: event.metadata.aggregateId,
        aggregateType: event.metadata.aggregateType,
        timestamp: event.metadata.timestamp.getTime(),
        version: event.metadata.version,
        correlationId: event.metadata.correlationId,
        causationId: event.metadata.causationId || null,
        userId: event.metadata.userId || null,
        tenantId: event.metadata.tenantId || null,
        source: event.metadata.source,
        schemaVersion: event.metadata.schemaVersion
      },
      payload: JSON.stringify(event.payload)
    };
  }

  /**
   * Convert Avro format to DomainEvent
   */
  private avroToDomainEvent(avroEvent: any): DomainEvent {
    return new DomainEvent(
      {
        eventId: avroEvent.metadata.eventId,
        eventType: avroEvent.metadata.eventType,
        aggregateId: avroEvent.metadata.aggregateId,
        aggregateType: avroEvent.metadata.aggregateType,
        timestamp: new Date(avroEvent.metadata.timestamp),
        version: avroEvent.metadata.version,
        correlationId: avroEvent.metadata.correlationId,
        causationId: avroEvent.metadata.causationId,
        userId: avroEvent.metadata.userId,
        tenantId: avroEvent.metadata.tenantId,
        source: avroEvent.metadata.source,
        schemaVersion: avroEvent.metadata.schemaVersion
      },
      JSON.parse(avroEvent.payload)
    );
  }

  /**
   * Set compatibility mode
   */
  async setCompatibility(subject: string, compatibility: string): Promise<void> {
    try {
      await this.client.put(`/config/${subject}`, {
        compatibility
      });
      this.logger.info(`Set compatibility mode for ${subject} to ${compatibility}`);
    } catch (error) {
      this.logger.error('Failed to set compatibility', error as Error);
      throw error;
    }
  }

  /**
   * Delete subject
   */
  async deleteSubject(subject: string): Promise<void> {
    try {
      await this.client.delete(`/subjects/${subject}`);
      this.schemaCache.delete(subject);
      this.logger.info(`Deleted subject: ${subject}`);
    } catch (error) {
      this.logger.error(`Failed to delete subject ${subject}`, error as Error);
      throw error;
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.schemaCache.clear();
    this.idCache.clear();
    this.logger.debug('Schema cache cleared');
  }
}