/**
 * Example: Catalog Service with Event-Driven Architecture
 * Demonstrates CQRS, Event Sourcing, and Saga patterns
 */

import { EventBus } from '../core/event-bus';
import { EventStore } from '../core/event-store';
import { DomainEvent, SystemEventType, EventMetadata } from '../core/event-types';
import { CommandBus, BaseCommandHandler, Command, CommandResult } from '../../cqrs/commands/command-bus';
import { SagaOrchestrator, SagaDefinition } from '../patterns/saga';
import { KafkaProducer } from '../../kafka/producer/kafka-producer';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

// Command schemas
const CreateEntitySchema = z.object({
  name: z.string(),
  kind: z.enum(['Component', 'API', 'System', 'Resource', 'Domain', 'Group', 'User']),
  namespace: z.string().default('default'),
  spec: z.record(z.any()),
  metadata: z.record(z.any()).optional()
});

const UpdateEntitySchema = z.object({
  entityId: z.string(),
  changes: z.record(z.any()),
  reason: z.string().optional()
});

// Command handlers
class CreateEntityHandler extends BaseCommandHandler {
  commandType = 'catalog.entity.create';
  schema = CreateEntitySchema;

  constructor(private eventStore: EventStore) {
    super();
  }

  async handle(command: Command): Promise<CommandResult> {
    try {
      const { name, kind, namespace, spec, metadata } = command.payload;
      const entityId = `${kind}:${namespace}/${name}`;

      // Check if entity already exists
      const existingEvents = await this.eventStore.loadEvents(entityId);
      if (existingEvents.length > 0) {
        return this.createErrorResult(new Error('Entity already exists'));
      }

      // Create entity created event
      const eventMetadata: EventMetadata = {
        eventId: uuidv4(),
        eventType: SystemEventType.ENTITY_CREATED,
        aggregateId: entityId,
        aggregateType: 'CatalogEntity',
        timestamp: new Date(),
        version: 1,
        correlationId: command.metadata.correlationId,
        causationId: command.commandId,
        userId: command.metadata.userId,
        tenantId: command.metadata.tenantId,
        source: 'CatalogService',
        schemaVersion: '1.0'
      };

      const event = new DomainEvent(eventMetadata, {
        entityId,
        entityType: kind,
        name,
        namespace,
        spec,
        metadata: metadata || {}
      });

      // Store event
      await this.eventStore.append(event);

      return this.createSuccessResult(entityId, 1, [event]);
    } catch (error) {
      return this.createErrorResult(error as Error);
    }
  }
}

class UpdateEntityHandler extends BaseCommandHandler {
  commandType = 'catalog.entity.update';
  schema = UpdateEntitySchema;

  constructor(private eventStore: EventStore) {
    super();
  }

  async handle(command: Command): Promise<CommandResult> {
    try {
      const { entityId, changes, reason } = command.payload;

      // Load current state
      const events = await this.eventStore.loadEvents(entityId);
      if (events.length === 0) {
        return this.createErrorResult(new Error('Entity not found'));
      }

      const currentVersion = events[events.length - 1].metadata.version;
      const newVersion = currentVersion + 1;

      // Create update event
      const eventMetadata: EventMetadata = {
        eventId: uuidv4(),
        eventType: SystemEventType.ENTITY_UPDATED,
        aggregateId: entityId,
        aggregateType: 'CatalogEntity',
        timestamp: new Date(),
        version: newVersion,
        correlationId: command.metadata.correlationId,
        causationId: command.commandId,
        userId: command.metadata.userId,
        tenantId: command.metadata.tenantId,
        source: 'CatalogService',
        schemaVersion: '1.0'
      };

      const event = new DomainEvent(eventMetadata, {
        entityId,
        changes: Object.entries(changes).map(([field, value]) => ({
          field,
          oldValue: null, // Would need to track from projection
          newValue: value
        })),
        updatedBy: command.metadata.userId || 'system',
        reason
      });

      // Store event
      await this.eventStore.append(event);

      return this.createSuccessResult(entityId, newVersion, [event]);
    } catch (error) {
      return this.createErrorResult(error as Error);
    }
  }
}

// Saga definition for entity provisioning
const EntityProvisioningSaga: SagaDefinition = {
  name: 'entity-provisioning',
  steps: [
    {
      name: 'validate-entity',
      command: {
        commandId: '',
        commandType: 'catalog.entity.validate',
        aggregateId: '${entityId}',
        aggregateType: 'CatalogEntity',
        payload: { entityId: '${entityId}' },
        metadata: {} as any
      },
      compensationCommand: {
        commandId: '',
        commandType: 'catalog.entity.rollback-validation',
        aggregateId: '${entityId}',
        aggregateType: 'CatalogEntity',
        payload: { entityId: '${entityId}' },
        metadata: {} as any
      },
      timeout: 5000,
      retryPolicy: { maxRetries: 3, backoffMs: 1000 }
    },
    {
      name: 'create-github-repo',
      command: {
        commandId: '',
        commandType: 'github.repo.create',
        aggregateId: '${entityId}',
        aggregateType: 'GitHubRepo',
        payload: {
          name: '${repoName}',
          description: '${description}',
          private: '${isPrivate}'
        },
        metadata: {} as any
      },
      compensationCommand: {
        commandId: '',
        commandType: 'github.repo.delete',
        aggregateId: '${create-github-repo.aggregateId}',
        aggregateType: 'GitHubRepo',
        payload: { repoId: '${create-github-repo.aggregateId}' },
        metadata: {} as any
      },
      timeout: 30000,
      retryPolicy: { maxRetries: 2, backoffMs: 2000 }
    },
    {
      name: 'setup-ci-pipeline',
      command: {
        commandId: '',
        commandType: 'ci.pipeline.create',
        aggregateId: '${entityId}',
        aggregateType: 'Pipeline',
        payload: {
          repoUrl: '${create-github-repo.aggregateId}',
          template: '${pipelineTemplate}'
        },
        metadata: {} as any
      },
      compensationCommand: {
        commandId: '',
        commandType: 'ci.pipeline.delete',
        aggregateId: '${setup-ci-pipeline.aggregateId}',
        aggregateType: 'Pipeline',
        payload: { pipelineId: '${setup-ci-pipeline.aggregateId}' },
        metadata: {} as any
      },
      timeout: 20000
    },
    {
      name: 'register-in-catalog',
      command: {
        commandId: '',
        commandType: 'catalog.entity.register',
        aggregateId: '${entityId}',
        aggregateType: 'CatalogEntity',
        payload: {
          entityId: '${entityId}',
          repoUrl: '${create-github-repo.aggregateId}',
          pipelineUrl: '${setup-ci-pipeline.aggregateId}'
        },
        metadata: {} as any
      },
      timeout: 10000
    }
  ],
  timeout: 120000,
  compensationStrategy: 'sequential'
};

// Example service class using all patterns
export class CatalogServiceExample {
  private eventBus: EventBus;
  private eventStore: EventStore;
  private commandBus: CommandBus;
  private sagaOrchestrator: SagaOrchestrator;
  private kafkaProducer: KafkaProducer;

  constructor() {
    // Initialize event store
    this.eventStore = new EventStore({
      enableSnapshots: true,
      snapshotFrequency: 100
    });

    // Initialize event bus
    this.eventBus = new EventBus({
      enablePersistence: true,
      enableMetrics: true
    });
    this.eventBus.attachEventStore(this.eventStore);

    // Initialize command bus
    this.commandBus = new CommandBus(this.eventBus, {
      enableAsync: true,
      enableValidation: true
    });

    // Register command handlers
    this.commandBus.registerHandler(new CreateEntityHandler(this.eventStore));
    this.commandBus.registerHandler(new UpdateEntityHandler(this.eventStore));

    // Initialize saga orchestrator
    this.sagaOrchestrator = new SagaOrchestrator(this.eventBus, this.commandBus);
    this.sagaOrchestrator.registerSaga(EntityProvisioningSaga);

    // Initialize Kafka producer
    this.kafkaProducer = new KafkaProducer({
      idempotent: true,
      compression: 'gzip'
    });

    this.setupEventHandlers();
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    await this.kafkaProducer.connect();
    console.log('Catalog service initialized with event-driven architecture');
  }

  /**
   * Create a new catalog entity
   */
  async createEntity(data: {
    name: string;
    kind: string;
    namespace?: string;
    spec: any;
    metadata?: any;
  }): Promise<{ entityId: string; version: number }> {
    const command: Command = {
      commandId: uuidv4(),
      commandType: 'catalog.entity.create',
      aggregateId: `${data.kind}:${data.namespace || 'default'}/${data.name}`,
      aggregateType: 'CatalogEntity',
      payload: data,
      metadata: {
        correlationId: uuidv4(),
        timestamp: new Date(),
        version: '1.0'
      }
    };

    const result = await this.commandBus.execute(command);
    
    if (!result.success) {
      throw result.error;
    }

    return {
      entityId: result.aggregateId!,
      version: result.version!
    };
  }

  /**
   * Update a catalog entity
   */
  async updateEntity(
    entityId: string,
    changes: Record<string, any>,
    reason?: string
  ): Promise<{ version: number }> {
    const command: Command = {
      commandId: uuidv4(),
      commandType: 'catalog.entity.update',
      aggregateId: entityId,
      aggregateType: 'CatalogEntity',
      payload: { entityId, changes, reason },
      metadata: {
        correlationId: uuidv4(),
        timestamp: new Date(),
        version: '1.0'
      }
    };

    const result = await this.commandBus.execute(command);
    
    if (!result.success) {
      throw result.error;
    }

    return {
      version: result.version!
    };
  }

  /**
   * Provision a new service with saga
   */
  async provisionService(data: {
    entityId: string;
    repoName: string;
    description: string;
    isPrivate: boolean;
    pipelineTemplate: string;
  }): Promise<string> {
    const sagaId = await this.sagaOrchestrator.startSaga('entity-provisioning', data);
    return sagaId;
  }

  /**
   * Get entity event history
   */
  async getEntityHistory(entityId: string): Promise<DomainEvent[]> {
    return await this.eventStore.loadEvents(entityId);
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Subscribe to entity created events
    this.eventBus.subscribe(
      SystemEventType.ENTITY_CREATED,
      {
        eventType: SystemEventType.ENTITY_CREATED,
        handle: async (event) => {
          // Send to Kafka for other services
          await this.kafkaProducer.send('catalog.entities', event);
          
          // Update read model (projection)
          console.log('Entity created:', event.payload);
        }
      },
      { priority: 2 }
    );

    // Subscribe to entity updated events
    this.eventBus.subscribe(
      SystemEventType.ENTITY_UPDATED,
      {
        eventType: SystemEventType.ENTITY_UPDATED,
        handle: async (event) => {
          // Send to Kafka
          await this.kafkaProducer.send('catalog.entities', event);
          
          // Update read model
          console.log('Entity updated:', event.payload);
        }
      },
      { priority: 2 }
    );

    // Subscribe to saga events for monitoring
    this.eventBus.subscribe(
      ['saga.started', 'saga.completed', 'saga.failed'],
      {
        eventType: ['saga.started', 'saga.completed', 'saga.failed'],
        handle: async (event) => {
          console.log('Saga event:', event.eventType, event.payload);
          
          // Send to monitoring system
          await this.kafkaProducer.send('monitoring.metrics', event);
        }
      }
    );
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    await this.eventBus.stop();
    await this.commandBus.stop();
    await this.kafkaProducer.disconnect();
    await this.eventStore.close();
    console.log('Catalog service shut down');
  }
}

// Example usage
export async function runExample() {
  const catalogService = new CatalogServiceExample();
  
  try {
    await catalogService.initialize();

    // Create an entity
    const { entityId, version } = await catalogService.createEntity({
      name: 'user-service',
      kind: 'Component',
      namespace: 'backend',
      spec: {
        type: 'service',
        lifecycle: 'production',
        owner: 'platform-team'
      },
      metadata: {
        annotations: {
          'backstage.io/techdocs-ref': 'dir:.'
        }
      }
    });

    console.log(`Created entity: ${entityId} (version ${version})`);

    // Update the entity
    const { version: newVersion } = await catalogService.updateEntity(
      entityId,
      {
        'spec.lifecycle': 'experimental',
        'metadata.annotations.updated': new Date().toISOString()
      },
      'Testing update functionality'
    );

    console.log(`Updated entity to version ${newVersion}`);

    // Provision a complete service
    const sagaId = await catalogService.provisionService({
      entityId,
      repoName: 'user-service',
      description: 'User management service',
      isPrivate: false,
      pipelineTemplate: 'node-service'
    });

    console.log(`Started provisioning saga: ${sagaId}`);

    // Get entity history
    const history = await catalogService.getEntityHistory(entityId);
    console.log(`Entity has ${history.length} events in history`);

    // Wait a bit for async processing
    await new Promise(resolve => setTimeout(resolve, 5000));

    await catalogService.shutdown();
  } catch (error) {
    console.error('Example failed:', error);
    await catalogService.shutdown();
  }
}