/**
 * Type definitions for the Catalog Ingestion System
 */

import { z } from 'zod';

// Core entity types extending Backstage entity model
export const EntitySourceSchema = z.object({
  id: z.string(),
  type: z.enum(['github', 'gitlab', 'bitbucket', 'kubernetes', 'jenkins', 'datadog', 'prometheus', 'custom']),
  name: z.string(),
  url: z.string().url(),
  config: z.record(z.unknown()),
  lastSync: z.date().optional(),
  status: z.enum(['active', 'inactive', 'error']),
});

export const EntityIngestionConfigSchema = z.object({
  sources: z.array(EntitySourceSchema),
  processors: z.array(z.string()),
  enrichers: z.array(z.string()),
  validators: z.array(z.string()),
  batchSize: z.number().min(1).max(1000).default(100),
  parallelism: z.number().min(1).max(10).default(3),
  retryAttempts: z.number().min(0).max(5).default(3),
  retryDelay: z.number().min(100).max(30000).default(1000),
});

export const EntityRelationshipSchema = z.object({
  id: z.string(),
  sourceRef: z.string(),
  targetRef: z.string(),
  type: z.enum(['dependsOn', 'ownedBy', 'partOf', 'consumesApi', 'providesApi', 'deployedOn', 'runsOn']),
  metadata: z.record(z.unknown()).optional(),
  confidence: z.number().min(0).max(1),
  source: z.string(), // Which processor/enricher created this relationship
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const EntityQualityScoreSchema = z.object({
  entityRef: z.string(),
  overallScore: z.number().min(0).max(100),
  scores: z.object({
    completeness: z.number().min(0).max(100),
    accuracy: z.number().min(0).max(100),
    freshness: z.number().min(0).max(100),
    consistency: z.number().min(0).max(100),
    relationships: z.number().min(0).max(100),
  }),
  issues: z.array(z.object({
    severity: z.enum(['info', 'warning', 'error', 'critical']),
    message: z.string(),
    field: z.string().optional(),
    suggestion: z.string().optional(),
  })),
  lastEvaluated: z.date(),
});

export const IngestionJobSchema = z.object({
  id: z.string(),
  type: z.enum(['stream', 'batch', 'reconcile']),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']),
  sourceId: z.string(),
  config: z.record(z.unknown()),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  progress: z.object({
    processed: z.number().min(0),
    total: z.number().min(0),
    errors: z.number().min(0),
  }),
  errors: z.array(z.object({
    message: z.string(),
    code: z.string(),
    details: z.record(z.unknown()).optional(),
    timestamp: z.date(),
  })),
  result: z.object({
    entitiesProcessed: z.number().min(0),
    entitiesCreated: z.number().min(0),
    entitiesUpdated: z.number().min(0),
    entitiesDeleted: z.number().min(0),
    relationshipsCreated: z.number().min(0),
    relationshipsUpdated: z.number().min(0),
  }).optional(),
});

export const EntityEnrichmentResultSchema = z.object({
  entityRef: z.string(),
  enricherId: z.string(),
  status: z.enum(['success', 'failed', 'skipped']),
  data: z.record(z.unknown()),
  confidence: z.number().min(0).max(1),
  timestamp: z.date(),
  processingTime: z.number().min(0), // milliseconds
});

export const CatalogVersionSchema = z.object({
  id: z.string(),
  entityRef: z.string(),
  version: z.number(),
  data: z.record(z.unknown()),
  changeType: z.enum(['created', 'updated', 'deleted', 'merged']),
  changes: z.array(z.object({
    path: z.string(),
    operation: z.enum(['add', 'remove', 'replace']),
    oldValue: z.unknown().optional(),
    newValue: z.unknown().optional(),
  })),
  createdBy: z.string(),
  createdAt: z.date(),
});

// Processing pipeline types
export const ProcessingStageSchema = z.object({
  name: z.string(),
  type: z.enum(['source', 'transformer', 'validator', 'enricher', 'sink']),
  config: z.record(z.unknown()),
  dependencies: z.array(z.string()),
  parallel: z.boolean().default(false),
  retryPolicy: z.object({
    maxAttempts: z.number().min(1).default(3),
    backoffMultiplier: z.number().min(1).default(2),
    maxDelay: z.number().min(100).default(30000),
  }).optional(),
});

export const PipelineConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  stages: z.array(ProcessingStageSchema),
  triggers: z.array(z.object({
    type: z.enum(['schedule', 'webhook', 'manual', 'event']),
    config: z.record(z.unknown()),
  })),
  maxConcurrency: z.number().min(1).default(5),
  timeout: z.number().min(1000).default(300000), // 5 minutes default
});

// Integration types
export const WebhookEventSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  eventType: z.string(),
  payload: z.record(z.unknown()),
  timestamp: z.date(),
  processed: z.boolean().default(false),
});

export const IngestionMetricsSchema = z.object({
  timestamp: z.date(),
  sourceId: z.string(),
  metrics: z.object({
    entitiesDiscovered: z.number().min(0),
    entitiesProcessed: z.number().min(0),
    processingErrors: z.number().min(0),
    processingTime: z.number().min(0),
    qualityScore: z.number().min(0).max(100),
    relationshipsCreated: z.number().min(0),
  }),
});

// Exported types
export type EntitySource = z.infer<typeof EntitySourceSchema>;
export type EntityIngestionConfig = z.infer<typeof EntityIngestionConfigSchema>;
export type EntityRelationship = z.infer<typeof EntityRelationshipSchema>;
export type EntityQualityScore = z.infer<typeof EntityQualityScoreSchema>;
export type IngestionJob = z.infer<typeof IngestionJobSchema>;
export type EntityEnrichmentResult = z.infer<typeof EntityEnrichmentResultSchema>;
export type CatalogVersion = z.infer<typeof CatalogVersionSchema>;
export type ProcessingStage = z.infer<typeof ProcessingStageSchema>;
export type PipelineConfig = z.infer<typeof PipelineConfigSchema>;
export type WebhookEvent = z.infer<typeof WebhookEventSchema>;
export type IngestionMetrics = z.infer<typeof IngestionMetricsSchema>;

// Base interfaces for processors
export interface ISourceProcessor {
  readonly id: string;
  readonly name: string;
  readonly type: EntitySource['type'];
  
  initialize(config: Record<string, unknown>): Promise<void>;
  discover(): Promise<RawEntityData[]>;
  getEntityData(reference: string): Promise<RawEntityData | null>;
  cleanup(): Promise<void>;
}

export interface IEntityTransformer {
  readonly id: string;
  readonly name: string;
  
  transform(entity: RawEntityData): Promise<TransformedEntityData>;
  canTransform(entity: RawEntityData): boolean;
}

export interface IEntityValidator {
  readonly id: string;
  readonly name: string;
  
  validate(entity: TransformedEntityData): Promise<ValidationResult>;
}

export interface IEntityEnricher {
  readonly id: string;
  readonly name: string;
  
  enrich(entity: TransformedEntityData): Promise<EntityEnrichmentResult>;
  canEnrich(entity: TransformedEntityData): boolean;
}

export interface IRelationshipResolver {
  readonly id: string;
  readonly name: string;
  
  resolveRelationships(entities: TransformedEntityData[]): Promise<EntityRelationship[]>;
}

export interface IQualityAssessor {
  readonly id: string;
  readonly name: string;
  
  assess(entity: TransformedEntityData): Promise<EntityQualityScore>;
}

// Data flow types
export interface RawEntityData {
  id: string;
  sourceId: string;
  type: string;
  data: Record<string, unknown>;
  metadata: {
    discoveredAt: Date;
    sourceUrl?: string;
    checksum?: string;
  };
}

export interface TransformedEntityData {
  id: string;
  sourceId: string;
  entityRef: string;
  kind: string;
  metadata: {
    name: string;
    namespace: string;
    title?: string;
    description?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    tags?: string[];
  };
  spec: Record<string, unknown>;
  relations?: Array<{
    type: string;
    targetRef: string;
    metadata?: Record<string, unknown>;
  }>;
  rawData: RawEntityData;
  transformedBy: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: Array<{
    severity: 'error' | 'warning' | 'info';
    message: string;
    path?: string;
  }>;
  warnings: Array<{
    message: string;
    path?: string;
  }>;
}

// Event types
export interface IngestionEvent {
  type: string;
  sourceId?: string;
  entityRef?: string;
  timestamp: Date;
  data: Record<string, unknown>;
}

export interface EntityChangeEvent extends IngestionEvent {
  type: 'entity.created' | 'entity.updated' | 'entity.deleted';
  entityRef: string;
  changeType: CatalogVersion['changeType'];
  entity?: TransformedEntityData;
}

export interface RelationshipChangeEvent extends IngestionEvent {
  type: 'relationship.created' | 'relationship.updated' | 'relationship.deleted';
  relationship: EntityRelationship;
}

export interface QualityScoreEvent extends IngestionEvent {
  type: 'quality.updated';
  entityRef: string;
  score: EntityQualityScore;
}

// Configuration types
export interface CatalogIngestionSystemConfig {
  sources: EntitySource[];
  pipelines: PipelineConfig[];
  storage: {
    engine: 'postgresql' | 'elasticsearch' | 'mongodb';
    connectionString: string;
    indexingEnabled: boolean;
    backupEnabled: boolean;
  };
  processing: {
    defaultBatchSize: number;
    maxConcurrency: number;
    retryPolicy: {
      maxAttempts: number;
      backoffMultiplier: number;
      maxDelay: number;
    };
  };
  notifications: {
    webhooks: Array<{
      url: string;
      events: string[];
      headers?: Record<string, string>;
    }>;
  };
  monitoring: {
    metricsEnabled: boolean;
    tracingEnabled: boolean;
    loggingLevel: 'debug' | 'info' | 'warn' | 'error';
  };
}