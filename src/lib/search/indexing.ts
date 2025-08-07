/**
 * Elasticsearch Indexing Pipeline
 * 
 * Handles indexing of all entity types with:
 * - Bulk indexing operations
 * - Real-time index updates
 * - Entity transformation for search
 * - Index lifecycle management
 * - Performance monitoring
 */

import { getElasticsearchClient, ElasticsearchClient } from './elasticsearch';
import type { Entity } from '@/services/backstage/types/entities';
import type { SearchFilters } from './SemanticSearch';

// Indexing types
export interface IndexingConfig {
  batchSize: number;
  maxRetries: number;
  retryDelay: number;
  enableRealTimeIndexing: boolean;
  indexingConcurrency: number;
  transformationRules: TransformationRule[];
  indexingSchedule?: {
    fullReindex: string; // cron expression
    incrementalUpdate: string; // cron expression
  };
}

export interface TransformationRule {
  entityKind: string;
  transform: (entity: Entity) => IndexableDocument;
  validate?: (document: IndexableDocument) => boolean;
  enrich?: (document: IndexableDocument) => Promise<IndexableDocument>;
}

export interface IndexableDocument {
  id: string;
  kind: string;
  namespace: string;
  name: string;
  title?: string;
  description?: string;
  tags: string[];
  labels: Record<string, string>;
  annotations: Record<string, string>;
  owner?: string;
  type?: string;
  lifecycle?: string;
  system?: string;
  domain?: string;
  dependsOn: string[];
  dependencyOf: string[];
  childOf: string[];
  parentOf: string[];
  technologies: string[];
  languages: string[];
  frameworks: string[];
  healthScore?: number;
  lastUpdated: Date;
  createdAt: Date;
  searchableText: string;
  source?: {
    type: string;
    url: string;
    target: string;
  };
  // Index-specific fields
  _index: string;
  _routing?: string;
}

export interface IndexingResult {
  success: boolean;
  totalProcessed: number;
  successCount: number;
  errorCount: number;
  errors: IndexingError[];
  timeTaken: number;
  indexingStats: {
    documentsPerSecond: number;
    bytesPerSecond: number;
    averageDocumentSize: number;
  };
}

export interface IndexingError {
  entityId: string;
  entityKind: string;
  error: string;
  retryable: boolean;
  attempts: number;
}

export interface IndexingJob {
  id: string;
  type: 'full' | 'incremental' | 'entity' | 'bulk';
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  entityCount: number;
  processedCount: number;
  errorCount: number;
  progress: number; // 0-100
  errors: IndexingError[];
  metadata: Record<string, any>;
}

// Default configuration
const DEFAULT_CONFIG: IndexingConfig = {
  batchSize: 100,
  maxRetries: 3,
  retryDelay: 1000,
  enableRealTimeIndexing: true,
  indexingConcurrency: 4,
  transformationRules: [],
  indexingSchedule: {
    fullReindex: '0 2 * * 0', // Weekly at 2 AM on Sunday
    incrementalUpdate: '*/15 * * * *' // Every 15 minutes
  }
};

export class SearchIndexingPipeline {
  private client: ElasticsearchClient;
  private config: IndexingConfig;
  private activeJobs = new Map<string, IndexingJob>();
  private transformationRules = new Map<string, TransformationRule>();

  constructor(config?: Partial<IndexingConfig>) {
    this.client = getElasticsearchClient();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeTransformationRules();
  }

  /**
   * Index catalog entities
   */
  async indexCatalogEntities(entities: Entity[]): Promise<IndexingResult> {
    const job = this.createJob('bulk', entities.length, {
      indexType: 'catalog'
    });

    try {
      const documents = await this.transformEntities(entities, 'catalog');
      const result = await this.bulkIndex(documents, job);
      
      this.completeJob(job, result);
      return result;
    } catch (error) {
      this.failJob(job, error as Error);
      throw error;
    }
  }

  /**
   * Index documentation
   */
  async indexDocuments(documents: Array<{
    title: string;
    content: string;
    path: string;
    url: string;
    type: string;
    entityRef?: string;
    owner?: string;
    tags?: string[];
    lastModified?: Date;
  }>): Promise<IndexingResult> {
    const job = this.createJob('bulk', documents.length, {
      indexType: 'docs'
    });

    try {
      const indexableDocuments = documents.map(doc => this.transformDocument(doc));
      const result = await this.bulkIndex(indexableDocuments, job);
      
      this.completeJob(job, result);
      return result;
    } catch (error) {
      this.failJob(job, error as Error);
      throw error;
    }
  }

  /**
   * Index templates
   */
  async indexTemplates(templates: Array<{
    name: string;
    title: string;
    description: string;
    type: string;
    category?: string;
    tags?: string[];
    owner?: string;
    technologies?: string[];
    languages?: string[];
    parameters?: Array<{
      name: string;
      type: string;
      description: string;
      required: boolean;
    }>;
    lastModified?: Date;
    usage?: {
      count: number;
      lastUsed: Date;
    };
  }>): Promise<IndexingResult> {
    const job = this.createJob('bulk', templates.length, {
      indexType: 'templates'
    });

    try {
      const indexableDocuments = templates.map(template => this.transformTemplate(template));
      const result = await this.bulkIndex(indexableDocuments, job);
      
      this.completeJob(job, result);
      return result;
    } catch (error) {
      this.failJob(job, error as Error);
      throw error;
    }
  }

  /**
   * Update single entity in real-time
   */
  async updateEntity(entity: Entity): Promise<boolean> {
    if (!this.config.enableRealTimeIndexing) {
      return false;
    }

    try {
      const document = await this.transformEntity(entity, 'catalog');
      return await this.client.indexDocument(
        'idp-catalog', 
        document.id, 
        document
      );
    } catch (error) {
      console.error('Failed to update entity in search index:', error);
      return false;
    }
  }

  /**
   * Delete entity from index
   */
  async deleteEntity(entityId: string): Promise<boolean> {
    try {
      return await this.client.deleteDocument('idp-catalog', entityId);
    } catch (error) {
      console.error('Failed to delete entity from search index:', error);
      return false;
    }
  }

  /**
   * Perform full reindexing
   */
  async fullReindex(
    entities: Entity[],
    onProgress?: (progress: number) => void
  ): Promise<IndexingResult> {
    const job = this.createJob('full', entities.length, {
      description: 'Full catalog reindex'
    });

    try {
      // Clear existing index
      await this.client.deleteIndex('idp-catalog');
      await this.client.initialize();

      // Process in batches
      const batchSize = this.config.batchSize;
      const batches = this.chunkArray(entities, batchSize);
      let totalProcessed = 0;
      let totalErrors = 0;
      const allErrors: IndexingError[] = [];

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const documents = await this.transformEntities(batch, 'catalog');
        
        const batchResult = await this.bulkIndex(documents, job);
        totalProcessed += batchResult.successCount;
        totalErrors += batchResult.errorCount;
        allErrors.push(...batchResult.errors);

        // Update progress
        const progress = Math.round(((i + 1) / batches.length) * 100);
        job.progress = progress;
        job.processedCount = totalProcessed;
        job.errorCount = totalErrors;
        
        onProgress?.(progress);

        // Small delay between batches to prevent overwhelming ES
        if (i < batches.length - 1) {
          await this.delay(100);
        }
      }

      const result: IndexingResult = {
        success: totalErrors === 0,
        totalProcessed: entities.length,
        successCount: totalProcessed,
        errorCount: totalErrors,
        errors: allErrors,
        timeTaken: Date.now() - (job.startTime?.getTime() || 0),
        indexingStats: {
          documentsPerSecond: totalProcessed / ((Date.now() - (job.startTime?.getTime() || 0)) / 1000),
          bytesPerSecond: 0, // TODO: Calculate
          averageDocumentSize: 0 // TODO: Calculate
        }
      };

      this.completeJob(job, result);
      return result;
    } catch (error) {
      this.failJob(job, error as Error);
      throw error;
    }
  }

  /**
   * Get indexing job status
   */
  getJobStatus(jobId: string): IndexingJob | null {
    return this.activeJobs.get(jobId) || null;
  }

  /**
   * Get all active jobs
   */
  getActiveJobs(): IndexingJob[] {
    return Array.from(this.activeJobs.values());
  }

  /**
   * Transform entities for indexing
   */
  private async transformEntities(entities: Entity[], indexType: string): Promise<IndexableDocument[]> {
    const documents: IndexableDocument[] = [];
    
    for (const entity of entities) {
      try {
        const document = await this.transformEntity(entity, indexType);
        if (document) {
          documents.push(document);
        }
      } catch (error) {
        console.error(`Failed to transform entity ${entity.metadata.name}:`, error);
      }
    }

    return documents;
  }

  /**
   * Transform single entity
   */
  private async transformEntity(entity: Entity, indexType: string): Promise<IndexableDocument> {
    const rule = this.transformationRules.get(entity.kind);
    
    if (rule) {
      const document = rule.transform(entity);
      
      // Validate if rule has validation
      if (rule.validate && !rule.validate(document)) {
        throw new Error(`Document validation failed for entity ${entity.metadata.name}`);
      }

      // Enrich if rule has enrichment
      if (rule.enrich) {
        return await rule.enrich(document);
      }

      return document;
    }

    // Default transformation
    return this.defaultTransform(entity, indexType);
  }

  /**
   * Default entity transformation
   */
  private defaultTransform(entity: Entity, indexType: string): IndexableDocument {
    const now = new Date();
    
    return {
      id: `${entity.kind}:${entity.metadata.namespace || 'default'}/${entity.metadata.name}`,
      kind: entity.kind,
      namespace: entity.metadata.namespace || 'default',
      name: entity.metadata.name,
      title: entity.metadata.title,
      description: entity.metadata.description,
      tags: entity.metadata.tags || [],
      labels: entity.metadata.labels || {},
      annotations: entity.metadata.annotations || {},
      owner: entity.spec?.owner,
      type: entity.spec?.type,
      lifecycle: entity.spec?.lifecycle,
      system: entity.spec?.system,
      domain: entity.spec?.domain,
      dependsOn: this.extractRelations(entity, 'dependsOn'),
      dependencyOf: this.extractRelations(entity, 'dependencyOf'),
      childOf: this.extractRelations(entity, 'childOf'),
      parentOf: this.extractRelations(entity, 'parentOf'),
      technologies: this.extractTechnologies(entity),
      languages: this.extractLanguages(entity),
      frameworks: this.extractFrameworks(entity),
      healthScore: this.calculateHealthScore(entity),
      lastUpdated: now,
      createdAt: entity.metadata.annotations?.['backstage.io/created-at'] 
        ? new Date(entity.metadata.annotations['backstage.io/created-at'])
        : now,
      searchableText: this.buildSearchableText(entity),
      source: entity.metadata.annotations?.['backstage.io/managed-by-location']
        ? {
            type: 'backstage',
            url: entity.metadata.annotations['backstage.io/managed-by-location'],
            target: entity.metadata.annotations['backstage.io/view-url'] || ''
          }
        : undefined,
      _index: this.getIndexName(indexType),
      _routing: entity.metadata.namespace || 'default'
    };
  }

  /**
   * Transform document for docs index
   */
  private transformDocument(doc: any): IndexableDocument {
    const now = new Date();
    
    return {
      id: `doc:${doc.path}`,
      kind: 'Document',
      namespace: 'default',
      name: doc.path,
      title: doc.title,
      description: doc.content.substring(0, 500),
      tags: doc.tags || [],
      labels: {},
      annotations: {},
      owner: doc.owner,
      type: doc.type,
      lifecycle: 'production',
      system: undefined,
      domain: undefined,
      dependsOn: [],
      dependencyOf: [],
      childOf: [],
      parentOf: [],
      technologies: [],
      languages: [],
      frameworks: [],
      healthScore: undefined,
      lastUpdated: doc.lastModified || now,
      createdAt: doc.lastModified || now,
      searchableText: `${doc.title} ${doc.content}`,
      source: {
        type: 'techdocs',
        url: doc.url,
        target: doc.url
      },
      _index: 'idp-docs'
    };
  }

  /**
   * Transform template for templates index
   */
  private transformTemplate(template: any): IndexableDocument {
    const now = new Date();
    
    return {
      id: `template:${template.name}`,
      kind: 'Template',
      namespace: 'default',
      name: template.name,
      title: template.title,
      description: template.description,
      tags: template.tags || [],
      labels: {},
      annotations: {},
      owner: template.owner,
      type: template.type,
      lifecycle: 'production',
      system: undefined,
      domain: undefined,
      dependsOn: [],
      dependencyOf: [],
      childOf: [],
      parentOf: [],
      technologies: template.technologies || [],
      languages: template.languages || [],
      frameworks: [],
      healthScore: undefined,
      lastUpdated: template.lastModified || now,
      createdAt: template.lastModified || now,
      searchableText: `${template.title} ${template.description} ${(template.tags || []).join(' ')}`,
      _index: 'idp-templates'
    };
  }

  /**
   * Bulk index documents
   */
  private async bulkIndex(
    documents: IndexableDocument[], 
    job: IndexingJob
  ): Promise<IndexingResult> {
    const startTime = Date.now();
    const operations = documents.map(doc => ({
      index: doc._index,
      id: doc.id,
      document: doc
    }));

    const success = await this.client.bulkIndex(operations);
    const timeTaken = Date.now() - startTime;

    if (success) {
      return {
        success: true,
        totalProcessed: documents.length,
        successCount: documents.length,
        errorCount: 0,
        errors: [],
        timeTaken,
        indexingStats: {
          documentsPerSecond: documents.length / (timeTaken / 1000),
          bytesPerSecond: 0,
          averageDocumentSize: 0
        }
      };
    } else {
      return {
        success: false,
        totalProcessed: documents.length,
        successCount: 0,
        errorCount: documents.length,
        errors: documents.map(doc => ({
          entityId: doc.id,
          entityKind: doc.kind,
          error: 'Bulk indexing failed',
          retryable: true,
          attempts: 1
        })),
        timeTaken,
        indexingStats: {
          documentsPerSecond: 0,
          bytesPerSecond: 0,
          averageDocumentSize: 0
        }
      };
    }
  }

  /**
   * Initialize transformation rules
   */
  private initializeTransformationRules(): void {
    // Service transformation
    this.transformationRules.set('Component', {
      entityKind: 'Component',
      transform: (entity: Entity) => {
        const base = this.defaultTransform(entity, 'catalog');
        return {
          ...base,
          technologies: this.extractTechnologies(entity),
          languages: this.extractLanguages(entity),
          frameworks: this.extractFrameworks(entity)
        };
      }
    });

    // API transformation
    this.transformationRules.set('API', {
      entityKind: 'API',
      transform: (entity: Entity) => {
        const base = this.defaultTransform(entity, 'catalog');
        return {
          ...base,
          searchableText: this.buildAPISearchableText(entity)
        };
      }
    });

    // Group transformation
    this.transformationRules.set('Group', {
      entityKind: 'Group',
      transform: (entity: Entity) => {
        const base = this.defaultTransform(entity, 'catalog');
        return {
          ...base,
          searchableText: this.buildGroupSearchableText(entity)
        };
      }
    });
  }

  /**
   * Helper methods for entity transformation
   */
  private extractRelations(entity: Entity, relationType: string): string[] {
    const relations = entity.relations?.filter(r => r.type === relationType) || [];
    return relations.map(r => `${r.targetRef}`);
  }

  private extractTechnologies(entity: Entity): string[] {
    const technologies = new Set<string>();
    
    // From annotations
    const techAnnotation = entity.metadata.annotations?.['backstage.io/techdocs-ref'];
    if (techAnnotation) {
      technologies.add(techAnnotation);
    }

    // From tags
    entity.metadata.tags?.forEach(tag => {
      if (this.isTechnologyTag(tag)) {
        technologies.add(tag);
      }
    });

    return Array.from(technologies);
  }

  private extractLanguages(entity: Entity): string[] {
    const languages = new Set<string>();
    
    // Common language patterns in tags
    const languagePatterns = [
      /^(javascript|js|typescript|ts|python|java|go|rust|php|ruby|csharp|cpp|c\+\+)$/i
    ];

    entity.metadata.tags?.forEach(tag => {
      if (languagePatterns.some(pattern => pattern.test(tag))) {
        languages.add(tag.toLowerCase());
      }
    });

    return Array.from(languages);
  }

  private extractFrameworks(entity: Entity): string[] {
    const frameworks = new Set<string>();
    
    // Common framework patterns in tags
    const frameworkPatterns = [
      /^(react|angular|vue|spring|django|flask|rails|laravel|express)$/i
    ];

    entity.metadata.tags?.forEach(tag => {
      if (frameworkPatterns.some(pattern => pattern.test(tag))) {
        frameworks.add(tag.toLowerCase());
      }
    });

    return Array.from(frameworks);
  }

  private calculateHealthScore(entity: Entity): number | undefined {
    // Simple health score based on completeness
    let score = 0;
    let maxScore = 0;

    // Has description
    maxScore += 20;
    if (entity.metadata.description) score += 20;

    // Has owner
    maxScore += 20;
    if (entity.spec?.owner) score += 20;

    // Has tags
    maxScore += 15;
    if (entity.metadata.tags?.length) score += 15;

    // Has links
    maxScore += 15;
    if (entity.metadata.links?.length) score += 15;

    // Recent activity
    maxScore += 30;
    const lastModified = entity.metadata.annotations?.['backstage.io/managed-by-location'];
    if (lastModified) {
      const daysSince = (Date.now() - new Date(lastModified).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) score += 30;
      else if (daysSince < 30) score += 20;
      else if (daysSince < 90) score += 10;
    }

    return maxScore > 0 ? Math.round((score / maxScore) * 100) : undefined;
  }

  private buildSearchableText(entity: Entity): string {
    const parts = [
      entity.metadata.name,
      entity.metadata.title,
      entity.metadata.description,
      entity.kind,
      entity.spec?.type,
      entity.spec?.owner,
      entity.spec?.lifecycle,
      ...(entity.metadata.tags || []),
      ...Object.values(entity.metadata.annotations || {}),
      ...Object.values(entity.metadata.labels || {})
    ];

    return parts
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private buildAPISearchableText(entity: Entity): string {
    const base = this.buildSearchableText(entity);
    const apiSpecific = [
      entity.spec?.definition,
      entity.spec?.path
    ].filter(Boolean).join(' ');

    return `${base} ${apiSpecific}`.trim();
  }

  private buildGroupSearchableText(entity: Entity): string {
    const base = this.buildSearchableText(entity);
    const groupSpecific = [
      entity.spec?.profile?.displayName,
      entity.spec?.profile?.email,
      ...(entity.spec?.members || [])
    ].filter(Boolean).join(' ');

    return `${base} ${groupSpecific}`.trim();
  }

  private isTechnologyTag(tag: string): boolean {
    const techPatterns = [
      /^tech-/i,
      /^stack-/i,
      /^framework-/i,
      /^language-/i,
      /^platform-/i
    ];

    return techPatterns.some(pattern => pattern.test(tag));
  }

  private getIndexName(indexType: string): string {
    const indexMap: Record<string, string> = {
      'catalog': 'idp-catalog',
      'docs': 'idp-docs',
      'templates': 'idp-templates'
    };

    return indexMap[indexType] || 'idp-catalog';
  }

  private createJob(type: IndexingJob['type'], entityCount: number, metadata: Record<string, any>): IndexingJob {
    const job: IndexingJob = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      status: 'running',
      startTime: new Date(),
      entityCount,
      processedCount: 0,
      errorCount: 0,
      progress: 0,
      errors: [],
      metadata
    };

    this.activeJobs.set(job.id, job);
    return job;
  }

  private completeJob(job: IndexingJob, result: IndexingResult): void {
    job.status = result.success ? 'completed' : 'failed';
    job.endTime = new Date();
    job.progress = 100;
    job.processedCount = result.successCount;
    job.errorCount = result.errorCount;
    job.errors = result.errors;
  }

  private failJob(job: IndexingJob, error: Error): void {
    job.status = 'failed';
    job.endTime = new Date();
    job.errors.push({
      entityId: 'system',
      entityKind: 'system',
      error: error.message,
      retryable: false,
      attempts: 1
    });
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
let indexingPipeline: SearchIndexingPipeline | null = null;

export function getSearchIndexingPipeline(config?: Partial<IndexingConfig>): SearchIndexingPipeline {
  if (!indexingPipeline) {
    indexingPipeline = new SearchIndexingPipeline(config);
  }
  return indexingPipeline;
}

// Utility functions
export function createIndexingJob(
  type: IndexingJob['type'],
  entityCount: number,
  metadata?: Record<string, any>
): Omit<IndexingJob, 'id'> {
  return {
    type,
    status: 'pending',
    entityCount,
    processedCount: 0,
    errorCount: 0,
    progress: 0,
    errors: [],
    metadata: metadata || {}
  };
}