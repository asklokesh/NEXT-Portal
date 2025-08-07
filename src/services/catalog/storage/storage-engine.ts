/**
 * Storage Engine
 * 
 * High-performance storage layer with support for multiple backends,
 * indexing, caching, and optimized queries.
 */

import { EventEmitter } from 'events';
import { Pool, PoolClient } from 'pg';
import { Client as ElasticsearchClient } from '@elastic/elasticsearch';
import Redis from 'ioredis';
import {
  TransformedEntityData,
  EntityRelationship,
  EntityQualityScore,
  CatalogVersion,
} from '../types';

interface StorageConfig {
  primary: {
    type: 'postgresql' | 'elasticsearch' | 'mongodb';
    connectionString: string;
    options?: Record<string, unknown>;
  };
  cache: {
    type: 'redis' | 'memory';
    connectionString?: string;
    ttl: number; // seconds
  };
  search: {
    enabled: boolean;
    type: 'elasticsearch' | 'postgresql';
    connectionString?: string;
  };
  backup: {
    enabled: boolean;
    schedule: string; // cron expression
    retention: number; // days
  };
}

interface QueryOptions {
  limit?: number;
  offset?: number;
  sort?: Array<{ field: string; direction: 'asc' | 'desc' }>;
  filters?: Record<string, unknown>;
  includeDeleted?: boolean;
  consistencyLevel?: 'eventual' | 'strong';
}

interface SearchOptions extends QueryOptions {
  query: string;
  fields?: string[];
  fuzzy?: boolean;
  highlight?: boolean;
}

interface StorageMetrics {
  entities: {
    total: number;
    created: number;
    updated: number;
    deleted: number;
  };
  relationships: {
    total: number;
    created: number;
    updated: number;
    deleted: number;
  };
  performance: {
    averageQueryTime: number;
    slowQueries: number;
    cacheHitRate: number;
  };
  storage: {
    sizeBytes: number;
    indexSizeBytes: number;
    compressionRatio: number;
  };
}

export class StorageEngine extends EventEmitter {
  private readonly config: StorageConfig;
  private readonly pgPool?: Pool;
  private readonly elasticsearch?: ElasticsearchClient;
  private readonly cache: Redis | Map<string, any>;
  
  private metrics: StorageMetrics = {
    entities: { total: 0, created: 0, updated: 0, deleted: 0 },
    relationships: { total: 0, created: 0, updated: 0, deleted: 0 },
    performance: { averageQueryTime: 0, slowQueries: 0, cacheHitRate: 0 },
    storage: { sizeBytes: 0, indexSizeBytes: 0, compressionRatio: 1.0 },
  };

  constructor(config: StorageConfig) {
    super();
    this.config = config;

    // Initialize primary storage
    if (config.primary.type === 'postgresql') {
      this.pgPool = new Pool({
        connectionString: config.primary.connectionString,
        ...config.primary.options as any,
      });
    } else if (config.primary.type === 'elasticsearch') {
      this.elasticsearch = new ElasticsearchClient({
        node: config.primary.connectionString,
        ...config.primary.options as any,
      });
    }

    // Initialize cache
    if (config.cache.type === 'redis' && config.cache.connectionString) {
      this.cache = new Redis(config.cache.connectionString);
    } else {
      this.cache = new Map();
    }
  }

  /**
   * Initialize storage system
   */
  async initialize(): Promise<void> {
    this.emit('initializationStarted');

    try {
      if (this.pgPool) {
        await this.initializePostgreSQL();
      }

      if (this.elasticsearch) {
        await this.initializeElasticsearch();
      }

      await this.loadMetrics();
      
      this.emit('initializationCompleted');
    } catch (error) {
      this.emit('initializationFailed', error);
      throw error;
    }
  }

  /**
   * Store entity
   */
  async storeEntity(entity: TransformedEntityData): Promise<void> {
    const startTime = Date.now();
    const cacheKey = `entity:${entity.entityRef}`;

    try {
      // Store in primary storage
      await this.storeEntityInPrimary(entity);
      
      // Update cache
      if (this.cache instanceof Redis) {
        await this.cache.setex(cacheKey, this.config.cache.ttl, JSON.stringify(entity));
      } else {
        this.cache.set(cacheKey, entity);
      }

      // Update search index
      if (this.config.search.enabled) {
        await this.indexEntity(entity);
      }

      // Update metrics
      this.metrics.entities.total++;
      this.metrics.entities.created++;
      this.updatePerformanceMetrics(Date.now() - startTime);

      this.emit('entityStored', { entityRef: entity.entityRef });

    } catch (error) {
      this.emit('entityStoreFailed', { entityRef: entity.entityRef, error });
      throw error;
    }
  }

  /**
   * Get entity by reference
   */
  async getEntity(entityRef: string, options: QueryOptions = {}): Promise<TransformedEntityData | null> {
    const startTime = Date.now();
    const cacheKey = `entity:${entityRef}`;

    try {
      // Check cache first (unless strong consistency required)
      if (options.consistencyLevel !== 'strong') {
        const cached = await this.getCachedEntity(cacheKey);
        if (cached) {
          this.updateCacheMetrics(true);
          return cached;
        }
      }

      this.updateCacheMetrics(false);

      // Get from primary storage
      const entity = await this.getEntityFromPrimary(entityRef, options);
      
      // Cache the result
      if (entity) {
        if (this.cache instanceof Redis) {
          await this.cache.setex(cacheKey, this.config.cache.ttl, JSON.stringify(entity));
        } else {
          this.cache.set(cacheKey, entity);
        }
      }

      this.updatePerformanceMetrics(Date.now() - startTime);
      return entity;

    } catch (error) {
      this.emit('entityRetrievalFailed', { entityRef, error });
      throw error;
    }
  }

  /**
   * Search entities
   */
  async searchEntities(searchOptions: SearchOptions): Promise<{
    entities: TransformedEntityData[];
    total: number;
    facets?: Record<string, Array<{ value: string; count: number }>>;
  }> {
    const startTime = Date.now();

    try {
      let result;
      
      if (this.config.search.enabled && this.elasticsearch) {
        result = await this.searchWithElasticsearch(searchOptions);
      } else if (this.pgPool) {
        result = await this.searchWithPostgreSQL(searchOptions);
      } else {
        throw new Error('No search backend available');
      }

      this.updatePerformanceMetrics(Date.now() - startTime);
      this.emit('searchCompleted', { query: searchOptions.query, results: result.total });

      return result;

    } catch (error) {
      this.emit('searchFailed', { query: searchOptions.query, error });
      throw error;
    }
  }

  /**
   * Store relationship
   */
  async storeRelationship(relationship: EntityRelationship): Promise<void> {
    try {
      await this.storeRelationshipInPrimary(relationship);
      
      // Update metrics
      this.metrics.relationships.total++;
      this.metrics.relationships.created++;

      this.emit('relationshipStored', { relationshipId: relationship.id });

    } catch (error) {
      this.emit('relationshipStoreFailed', { relationshipId: relationship.id, error });
      throw error;
    }
  }

  /**
   * Get entity relationships
   */
  async getEntityRelationships(entityRef: string): Promise<EntityRelationship[]> {
    const cacheKey = `relationships:${entityRef}`;

    try {
      // Check cache
      const cached = await this.getCached(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Get from primary storage
      const relationships = await this.getRelationshipsFromPrimary(entityRef);
      
      // Cache results
      await this.setCached(cacheKey, JSON.stringify(relationships));
      
      return relationships;

    } catch (error) {
      this.emit('relationshipRetrievalFailed', { entityRef, error });
      throw error;
    }
  }

  /**
   * Store quality score
   */
  async storeQualityScore(score: EntityQualityScore): Promise<void> {
    try {
      await this.storeQualityScoreInPrimary(score);
      this.emit('qualityScoreStored', { entityRef: score.entityRef });

    } catch (error) {
      this.emit('qualityScoreStoreFailed', { entityRef: score.entityRef, error });
      throw error;
    }
  }

  /**
   * Get storage metrics
   */
  getMetrics(): StorageMetrics {
    return { ...this.metrics };
  }

  /**
   * Initialize PostgreSQL schema
   */
  private async initializePostgreSQL(): Promise<void> {
    const client = await this.pgPool!.connect();
    
    try {
      // Create entities table
      await client.query(`
        CREATE TABLE IF NOT EXISTS catalog_entities (
          id SERIAL PRIMARY KEY,
          entity_ref VARCHAR(255) UNIQUE NOT NULL,
          kind VARCHAR(50) NOT NULL,
          namespace VARCHAR(100) NOT NULL,
          name VARCHAR(100) NOT NULL,
          data JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          deleted_at TIMESTAMP NULL,
          search_vector TSVECTOR
        );
      `);

      // Create indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_entities_ref ON catalog_entities(entity_ref);
        CREATE INDEX IF NOT EXISTS idx_entities_kind ON catalog_entities(kind);
        CREATE INDEX IF NOT EXISTS idx_entities_namespace ON catalog_entities(namespace);
        CREATE INDEX IF NOT EXISTS idx_entities_search ON catalog_entities USING GIN(search_vector);
        CREATE INDEX IF NOT EXISTS idx_entities_data ON catalog_entities USING GIN(data);
      `);

      // Create relationships table
      await client.query(`
        CREATE TABLE IF NOT EXISTS catalog_relationships (
          id VARCHAR(255) PRIMARY KEY,
          source_ref VARCHAR(255) NOT NULL,
          target_ref VARCHAR(255) NOT NULL,
          type VARCHAR(50) NOT NULL,
          confidence DECIMAL(3,2) NOT NULL,
          metadata JSONB,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // Create relationships indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_relationships_source ON catalog_relationships(source_ref);
        CREATE INDEX IF NOT EXISTS idx_relationships_target ON catalog_relationships(target_ref);
        CREATE INDEX IF NOT EXISTS idx_relationships_type ON catalog_relationships(type);
      `);

      // Create quality scores table
      await client.query(`
        CREATE TABLE IF NOT EXISTS catalog_quality_scores (
          entity_ref VARCHAR(255) PRIMARY KEY,
          overall_score INTEGER NOT NULL,
          scores JSONB NOT NULL,
          issues JSONB NOT NULL,
          last_evaluated TIMESTAMP DEFAULT NOW()
        );
      `);

      // Create versions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS catalog_versions (
          id VARCHAR(255) PRIMARY KEY,
          entity_ref VARCHAR(255) NOT NULL,
          version INTEGER NOT NULL,
          data JSONB NOT NULL,
          change_type VARCHAR(20) NOT NULL,
          changes JSONB NOT NULL,
          created_by VARCHAR(100) NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_versions_entity ON catalog_versions(entity_ref);
        CREATE INDEX IF NOT EXISTS idx_versions_created ON catalog_versions(created_at);
      `);

    } finally {
      client.release();
    }
  }

  /**
   * Initialize Elasticsearch indices
   */
  private async initializeElasticsearch(): Promise<void> {
    // Create entities index
    await this.elasticsearch!.indices.create({
      index: 'catalog_entities',
      ignore: [400], // Ignore if exists
      body: {
        mappings: {
          properties: {
            entityRef: { type: 'keyword' },
            kind: { type: 'keyword' },
            namespace: { type: 'keyword' },
            name: { type: 'text', analyzer: 'standard' },
            metadata: {
              type: 'object',
              properties: {
                title: { type: 'text', analyzer: 'standard' },
                description: { type: 'text', analyzer: 'standard' },
                tags: { type: 'keyword' },
                labels: { type: 'object' },
                annotations: { type: 'object' },
              }
            },
            spec: { type: 'object' },
            createdAt: { type: 'date' },
            updatedAt: { type: 'date' },
          }
        },
        settings: {
          analysis: {
            analyzer: {
              entity_analyzer: {
                type: 'custom',
                tokenizer: 'standard',
                filter: ['lowercase', 'asciifolding'],
              }
            }
          }
        }
      }
    });

    // Create relationships index
    await this.elasticsearch!.indices.create({
      index: 'catalog_relationships',
      ignore: [400],
      body: {
        mappings: {
          properties: {
            id: { type: 'keyword' },
            sourceRef: { type: 'keyword' },
            targetRef: { type: 'keyword' },
            type: { type: 'keyword' },
            confidence: { type: 'float' },
            metadata: { type: 'object' },
            createdAt: { type: 'date' },
          }
        }
      }
    });
  }

  /**
   * Store entity in primary storage
   */
  private async storeEntityInPrimary(entity: TransformedEntityData): Promise<void> {
    if (this.pgPool) {
      await this.storeEntityInPostgreSQL(entity);
    } else if (this.elasticsearch) {
      await this.storeEntityInElasticsearch(entity);
    }
  }

  /**
   * Store entity in PostgreSQL
   */
  private async storeEntityInPostgreSQL(entity: TransformedEntityData): Promise<void> {
    const client = await this.pgPool!.connect();
    
    try {
      // Create search vector
      const searchableText = [
        entity.metadata.name,
        entity.metadata.title,
        entity.metadata.description,
        ...(entity.metadata.tags || []),
        JSON.stringify(entity.spec),
      ].filter(Boolean).join(' ');

      await client.query(`
        INSERT INTO catalog_entities (entity_ref, kind, namespace, name, data, search_vector, updated_at)
        VALUES ($1, $2, $3, $4, $5, to_tsvector('english', $6), NOW())
        ON CONFLICT (entity_ref) 
        DO UPDATE SET
          kind = $2,
          namespace = $3,
          name = $4,
          data = $5,
          search_vector = to_tsvector('english', $6),
          updated_at = NOW()
      `, [
        entity.entityRef,
        entity.kind,
        entity.metadata.namespace,
        entity.metadata.name,
        JSON.stringify(entity),
        searchableText,
      ]);

    } finally {
      client.release();
    }
  }

  /**
   * Store entity in Elasticsearch
   */
  private async storeEntityInElasticsearch(entity: TransformedEntityData): Promise<void> {
    await this.elasticsearch!.index({
      index: 'catalog_entities',
      id: entity.entityRef,
      body: {
        ...entity,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Get entity from primary storage
   */
  private async getEntityFromPrimary(
    entityRef: string, 
    options: QueryOptions
  ): Promise<TransformedEntityData | null> {
    if (this.pgPool) {
      return this.getEntityFromPostgreSQL(entityRef, options);
    } else if (this.elasticsearch) {
      return this.getEntityFromElasticsearch(entityRef);
    }
    return null;
  }

  /**
   * Get entity from PostgreSQL
   */
  private async getEntityFromPostgreSQL(
    entityRef: string,
    options: QueryOptions
  ): Promise<TransformedEntityData | null> {
    const client = await this.pgPool!.connect();
    
    try {
      const query = options.includeDeleted
        ? 'SELECT data FROM catalog_entities WHERE entity_ref = $1'
        : 'SELECT data FROM catalog_entities WHERE entity_ref = $1 AND deleted_at IS NULL';
        
      const result = await client.query(query, [entityRef]);
      
      return result.rows.length > 0 ? result.rows[0].data : null;

    } finally {
      client.release();
    }
  }

  /**
   * Get entity from Elasticsearch
   */
  private async getEntityFromElasticsearch(entityRef: string): Promise<TransformedEntityData | null> {
    try {
      const result = await this.elasticsearch!.get({
        index: 'catalog_entities',
        id: entityRef,
      });

      return result.body._source;
    } catch (error: any) {
      if (error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Search with Elasticsearch
   */
  private async searchWithElasticsearch(options: SearchOptions): Promise<{
    entities: TransformedEntityData[];
    total: number;
    facets?: Record<string, Array<{ value: string; count: number }>>;
  }> {
    const searchBody: any = {
      query: {
        multi_match: {
          query: options.query,
          fields: options.fields || ['name^2', 'metadata.title^2', 'metadata.description', 'metadata.tags'],
          fuzziness: options.fuzzy ? 'AUTO' : undefined,
        }
      },
      from: options.offset || 0,
      size: options.limit || 50,
      sort: options.sort?.map(s => ({ [s.field]: { order: s.direction } })) || [],
    };

    // Add filters
    if (options.filters) {
      const filters = Object.entries(options.filters).map(([field, value]) => ({
        term: { [field]: value }
      }));
      
      searchBody.query = {
        bool: {
          must: [searchBody.query],
          filter: filters,
        }
      };
    }

    // Add facets
    searchBody.aggs = {
      kinds: { terms: { field: 'kind' } },
      namespaces: { terms: { field: 'namespace' } },
      tags: { terms: { field: 'metadata.tags' } },
    };

    const result = await this.elasticsearch!.search({
      index: 'catalog_entities',
      body: searchBody,
    });

    const entities = result.body.hits.hits.map((hit: any) => hit._source);
    const total = result.body.hits.total.value;
    
    const facets = result.body.aggregations ? {
      kinds: result.body.aggregations.kinds.buckets.map((b: any) => ({ value: b.key, count: b.doc_count })),
      namespaces: result.body.aggregations.namespaces.buckets.map((b: any) => ({ value: b.key, count: b.doc_count })),
      tags: result.body.aggregations.tags.buckets.map((b: any) => ({ value: b.key, count: b.doc_count })),
    } : undefined;

    return { entities, total, facets };
  }

  /**
   * Search with PostgreSQL
   */
  private async searchWithPostgreSQL(options: SearchOptions): Promise<{
    entities: TransformedEntityData[];
    total: number;
  }> {
    const client = await this.pgPool!.connect();
    
    try {
      const searchQuery = `
        SELECT data, ts_rank(search_vector, plainto_tsquery('english', $1)) as rank
        FROM catalog_entities 
        WHERE search_vector @@ plainto_tsquery('english', $1)
        AND deleted_at IS NULL
        ORDER BY rank DESC
        LIMIT $2 OFFSET $3
      `;
      
      const countQuery = `
        SELECT COUNT(*) as total
        FROM catalog_entities 
        WHERE search_vector @@ plainto_tsquery('english', $1)
        AND deleted_at IS NULL
      `;

      const [searchResult, countResult] = await Promise.all([
        client.query(searchQuery, [options.query, options.limit || 50, options.offset || 0]),
        client.query(countQuery, [options.query]),
      ]);

      const entities = searchResult.rows.map(row => row.data);
      const total = parseInt(countResult.rows[0].total);

      return { entities, total };

    } finally {
      client.release();
    }
  }

  /**
   * Store relationship in primary storage
   */
  private async storeRelationshipInPrimary(relationship: EntityRelationship): Promise<void> {
    if (this.pgPool) {
      const client = await this.pgPool.connect();
      
      try {
        await client.query(`
          INSERT INTO catalog_relationships (id, source_ref, target_ref, type, confidence, metadata, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
          ON CONFLICT (id)
          DO UPDATE SET
            source_ref = $2,
            target_ref = $3,
            type = $4,
            confidence = $5,
            metadata = $6,
            updated_at = NOW()
        `, [
          relationship.id,
          relationship.sourceRef,
          relationship.targetRef,
          relationship.type,
          relationship.confidence,
          JSON.stringify(relationship.metadata),
        ]);

      } finally {
        client.release();
      }
    }
  }

  /**
   * Get relationships from primary storage
   */
  private async getRelationshipsFromPrimary(entityRef: string): Promise<EntityRelationship[]> {
    if (this.pgPool) {
      const client = await this.pgPool.connect();
      
      try {
        const result = await client.query(
          'SELECT * FROM catalog_relationships WHERE source_ref = $1 OR target_ref = $1',
          [entityRef]
        );

        return result.rows.map(row => ({
          id: row.id,
          sourceRef: row.source_ref,
          targetRef: row.target_ref,
          type: row.type,
          confidence: parseFloat(row.confidence),
          source: 'storage',
          metadata: row.metadata,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }));

      } finally {
        client.release();
      }
    }

    return [];
  }

  /**
   * Store quality score in primary storage
   */
  private async storeQualityScoreInPrimary(score: EntityQualityScore): Promise<void> {
    if (this.pgPool) {
      const client = await this.pgPool.connect();
      
      try {
        await client.query(`
          INSERT INTO catalog_quality_scores (entity_ref, overall_score, scores, issues, last_evaluated)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (entity_ref)
          DO UPDATE SET
            overall_score = $2,
            scores = $3,
            issues = $4,
            last_evaluated = $5
        `, [
          score.entityRef,
          score.overallScore,
          JSON.stringify(score.scores),
          JSON.stringify(score.issues),
          score.lastEvaluated,
        ]);

      } finally {
        client.release();
      }
    }
  }

  /**
   * Index entity for search
   */
  private async indexEntity(entity: TransformedEntityData): Promise<void> {
    if (this.elasticsearch) {
      await this.storeEntityInElasticsearch(entity);
    }
  }

  /**
   * Get cached entity
   */
  private async getCachedEntity(key: string): Promise<TransformedEntityData | null> {
    try {
      if (this.cache instanceof Redis) {
        const cached = await this.cache.get(key);
        return cached ? JSON.parse(cached) : null;
      } else {
        return this.cache.get(key) || null;
      }
    } catch {
      return null;
    }
  }

  /**
   * Get cached value
   */
  private async getCached(key: string): Promise<string | null> {
    if (this.cache instanceof Redis) {
      return this.cache.get(key);
    } else {
      return this.cache.get(key) || null;
    }
  }

  /**
   * Set cached value
   */
  private async setCached(key: string, value: string): Promise<void> {
    if (this.cache instanceof Redis) {
      await this.cache.setex(key, this.config.cache.ttl, value);
    } else {
      this.cache.set(key, value);
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(queryTime: number): void {
    const currentAvg = this.metrics.performance.averageQueryTime;
    const totalQueries = this.metrics.entities.total + this.metrics.relationships.total;
    
    this.metrics.performance.averageQueryTime = 
      (currentAvg * (totalQueries - 1) + queryTime) / totalQueries;

    if (queryTime > 1000) { // Slow query threshold: 1 second
      this.metrics.performance.slowQueries++;
    }
  }

  /**
   * Update cache metrics
   */
  private updateCacheMetrics(hit: boolean): void {
    // Simple cache hit rate calculation
    const totalRequests = this.metrics.entities.total + this.metrics.relationships.total;
    const currentHitRate = this.metrics.performance.cacheHitRate;
    
    this.metrics.performance.cacheHitRate = 
      (currentHitRate * (totalRequests - 1) + (hit ? 1 : 0)) / totalRequests;
  }

  /**
   * Load initial metrics
   */
  private async loadMetrics(): Promise<void> {
    if (this.pgPool) {
      const client = await this.pgPool.connect();
      
      try {
        const entityResult = await client.query('SELECT COUNT(*) as total FROM catalog_entities WHERE deleted_at IS NULL');
        const relationshipResult = await client.query('SELECT COUNT(*) as total FROM catalog_relationships');
        
        this.metrics.entities.total = parseInt(entityResult.rows[0].total);
        this.metrics.relationships.total = parseInt(relationshipResult.rows[0].total);

      } finally {
        client.release();
      }
    }
  }
}

export default StorageEngine;