/**
 * Core Event Type Definitions
 * Defines the base event structures and contracts
 */

import { z } from 'zod';

// Base event metadata
export interface EventMetadata {
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  timestamp: Date;
  version: number;
  correlationId: string;
  causationId?: string;
  userId?: string;
  tenantId?: string;
  source: string;
  schemaVersion: string;
}

// Base domain event
export abstract class DomainEvent<T = any> {
  constructor(
    public readonly metadata: EventMetadata,
    public readonly payload: T
  ) {}

  get eventType(): string {
    return this.metadata.eventType;
  }

  get aggregateId(): string {
    return this.metadata.aggregateId;
  }

  toJSON(): any {
    return {
      metadata: this.metadata,
      payload: this.payload
    };
  }
}

// Event categories
export enum EventCategory {
  CATALOG = 'catalog',
  PLUGIN = 'plugin',
  TEMPLATE = 'template',
  USER = 'user',
  SYSTEM = 'system',
  AUDIT = 'audit',
  WORKFLOW = 'workflow',
  DEPLOYMENT = 'deployment',
  MONITORING = 'monitoring',
  SECURITY = 'security'
}

// Common event types
export enum SystemEventType {
  // Catalog events
  ENTITY_CREATED = 'catalog.entity.created',
  ENTITY_UPDATED = 'catalog.entity.updated',
  ENTITY_DELETED = 'catalog.entity.deleted',
  ENTITY_VALIDATED = 'catalog.entity.validated',
  ENTITY_PUBLISHED = 'catalog.entity.published',
  
  // Plugin events
  PLUGIN_INSTALLED = 'plugin.installed',
  PLUGIN_UPDATED = 'plugin.updated',
  PLUGIN_REMOVED = 'plugin.removed',
  PLUGIN_ACTIVATED = 'plugin.activated',
  PLUGIN_DEACTIVATED = 'plugin.deactivated',
  PLUGIN_FAILED = 'plugin.failed',
  
  // Template events
  TEMPLATE_CREATED = 'template.created',
  TEMPLATE_EXECUTED = 'template.executed',
  TEMPLATE_VALIDATED = 'template.validated',
  TEMPLATE_FAILED = 'template.failed',
  
  // User events
  USER_LOGGED_IN = 'user.logged_in',
  USER_LOGGED_OUT = 'user.logged_out',
  USER_REGISTERED = 'user.registered',
  USER_UPDATED = 'user.updated',
  USER_DELETED = 'user.deleted',
  
  // System events
  SYSTEM_STARTED = 'system.started',
  SYSTEM_STOPPED = 'system.stopped',
  SYSTEM_ERROR = 'system.error',
  SYSTEM_WARNING = 'system.warning',
  
  // Workflow events
  WORKFLOW_STARTED = 'workflow.started',
  WORKFLOW_COMPLETED = 'workflow.completed',
  WORKFLOW_FAILED = 'workflow.failed',
  WORKFLOW_CANCELLED = 'workflow.cancelled'
}

// Event priority levels
export enum EventPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

// Event delivery guarantees
export enum DeliveryGuarantee {
  AT_MOST_ONCE = 'at_most_once',
  AT_LEAST_ONCE = 'at_least_once',
  EXACTLY_ONCE = 'exactly_once'
}

// Event schemas using Zod for runtime validation
export const EventMetadataSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.string(),
  aggregateId: z.string(),
  aggregateType: z.string(),
  timestamp: z.date(),
  version: z.number().int().positive(),
  correlationId: z.string().uuid(),
  causationId: z.string().uuid().optional(),
  userId: z.string().optional(),
  tenantId: z.string().optional(),
  source: z.string(),
  schemaVersion: z.string()
});

// Catalog event schemas
export const EntityCreatedEventSchema = z.object({
  entityId: z.string(),
  entityType: z.string(),
  name: z.string(),
  namespace: z.string(),
  spec: z.record(z.any()),
  metadata: z.record(z.any())
});

export const EntityUpdatedEventSchema = z.object({
  entityId: z.string(),
  entityType: z.string(),
  changes: z.array(z.object({
    field: z.string(),
    oldValue: z.any(),
    newValue: z.any()
  })),
  updatedBy: z.string(),
  reason: z.string().optional()
});

// Plugin event schemas
export const PluginInstalledEventSchema = z.object({
  pluginId: z.string(),
  pluginName: z.string(),
  version: z.string(),
  installedBy: z.string(),
  configuration: z.record(z.any()).optional(),
  dependencies: z.array(z.string()).optional()
});

// Template event schemas
export const TemplateExecutedEventSchema = z.object({
  templateId: z.string(),
  templateName: z.string(),
  executionId: z.string(),
  parameters: z.record(z.any()),
  executedBy: z.string(),
  result: z.object({
    success: z.boolean(),
    outputs: z.record(z.any()).optional(),
    errors: z.array(z.string()).optional()
  })
});

// Event envelope for transport
export interface EventEnvelope<T = any> {
  id: string;
  type: string;
  source: string;
  specversion: string;
  time: string;
  datacontenttype: string;
  dataschema?: string;
  subject?: string;
  data: T;
  extensions?: Record<string, any>;
}

// Event handler interface
export interface EventHandler<T = any> {
  eventType: string | string[];
  handle(event: DomainEvent<T>): Promise<void>;
  onError?(error: Error, event: DomainEvent<T>): Promise<void>;
}

// Event filter interface
export interface EventFilter {
  eventTypes?: string[];
  aggregateTypes?: string[];
  aggregateIds?: string[];
  fromTimestamp?: Date;
  toTimestamp?: Date;
  userId?: string;
  tenantId?: string;
}

// Event replay options
export interface EventReplayOptions {
  fromEventId?: string;
  fromTimestamp?: Date;
  toTimestamp?: Date;
  filter?: EventFilter;
  speed?: number; // Replay speed multiplier
  batchSize?: number;
}

// Type guards
export function isDomainEvent(obj: any): obj is DomainEvent {
  return (
    obj &&
    typeof obj === 'object' &&
    'metadata' in obj &&
    'payload' in obj &&
    typeof obj.metadata === 'object' &&
    'eventId' in obj.metadata &&
    'eventType' in obj.metadata
  );
}

export function isEventEnvelope(obj: any): obj is EventEnvelope {
  return (
    obj &&
    typeof obj === 'object' &&
    'id' in obj &&
    'type' in obj &&
    'source' in obj &&
    'specversion' in obj &&
    'data' in obj
  );
}