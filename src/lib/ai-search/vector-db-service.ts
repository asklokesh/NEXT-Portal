import { Pinecone } from '@pinecone-database/pinecone';
import weaviate, { WeaviateClient, ApiKey } from 'weaviate-ts-client';
import { Redis } from 'ioredis';
import { logger } from '../monitoring/logger';

export interface VectorDocument {
  id: string;
  content: string;
  metadata: {
    type: 'service' | 'api' | 'component' | 'template' | 'documentation' | 'team' | 'plugin';
    title: string;
    description?: string;
    tags?: string[];
    owner?: string;
    lastModified?: Date;
    relationships?: string[];
    score?: number;
    context?: Record<string, any>;
  };
  embedding?: number[];
}

export interface SearchOptions {
  limit?: number;
  filter?: Record<string, any>;
  includeMetadata?: boolean;
  minScore?: number;
  userContext?: {
    userId: string;
    team?: string;
    recentSearches?: string[];
    preferences?: Record<string, any>;
  };
}

export interface VectorDBProvider {
  index(documents: VectorDocument[]): Promise<void>;
  search(query: string, options?: SearchOptions): Promise<VectorDocument[]>;
  delete(ids: string[]): Promise<void>;
  update(document: VectorDocument): Promise<void>;
  similarity(id: string, limit?: number): Promise<VectorDocument[]>;
}

// Pinecone Implementation
export class PineconeProvider implements VectorDBProvider {
  private client: Pinecone;
  private indexName: string;
  private dimension: number = 1536; // OpenAI embedding dimension

  constructor(apiKey: string, environment: string, indexName: string) {
    this.client = new Pinecone({
      apiKey,
      environment
    });
    this.indexName = indexName;
  }

  async initialize() {
    try {
      const indexList = await this.client.listIndexes();
      const indexExists = indexList.indexes?.some(index => index.name === this.indexName);

      if (!indexExists) {
        await this.client.createIndex({
          name: this.indexName,
          dimension: this.dimension,
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: 'us-west-2'
            }
          }
        });
        logger.info(`Created Pinecone index: ${this.indexName}`);
      }
    } catch (error) {
      logger.error('Failed to initialize Pinecone', error);
      throw error;
    }
  }

  async index(documents: VectorDocument[]): Promise<void> {
    const index = this.client.index(this.indexName);
    
    const vectors = documents.map(doc => ({
      id: doc.id,
      values: doc.embedding || [],
      metadata: {
        content: doc.content,
        ...doc.metadata
      }
    }));

    await index.upsert(vectors);
    logger.info(`Indexed ${documents.length} documents in Pinecone`);
  }

  async search(query: string, options?: SearchOptions): Promise<VectorDocument[]> {
    const index = this.client.index(this.indexName);
    const queryEmbedding = await this.getEmbedding(query);

    const response = await index.query({
      vector: queryEmbedding,
      topK: options?.limit || 10,
      includeMetadata: options?.includeMetadata !== false,
      filter: options?.filter
    });

    return response.matches?.map(match => ({
      id: match.id,
      content: match.metadata?.content as string || '',
      metadata: {
        ...match.metadata,
        score: match.score
      } as any,
      embedding: match.values
    })) || [];
  }

  async delete(ids: string[]): Promise<void> {
    const index = this.client.index(this.indexName);
    await index.deleteMany(ids);
  }

  async update(document: VectorDocument): Promise<void> {
    await this.index([document]);
  }

  async similarity(id: string, limit?: number): Promise<VectorDocument[]> {
    const index = this.client.index(this.indexName);
    
    const fetchResponse = await index.fetch([id]);
    const vector = fetchResponse.records[id]?.values;

    if (!vector) {
      return [];
    }

    const response = await index.query({
      vector,
      topK: limit || 10,
      includeMetadata: true
    });

    return response.matches?.filter(m => m.id !== id).map(match => ({
      id: match.id,
      content: match.metadata?.content as string || '',
      metadata: {
        ...match.metadata,
        score: match.score
      } as any
    })) || [];
  }

  private async getEmbedding(text: string): Promise<number[]> {
    // This would call OpenAI or another embedding service
    // For now, returning a mock embedding
    return Array(this.dimension).fill(0).map(() => Math.random());
  }
}

// Weaviate Implementation
export class WeaviateProvider implements VectorDBProvider {
  private client: WeaviateClient;
  private className: string = 'SearchableEntity';

  constructor(host: string, apiKey?: string) {
    this.client = weaviate.client({
      scheme: 'https',
      host,
      apiKey: apiKey ? new ApiKey(apiKey) : undefined,
      headers: { 'X-OpenAI-Api-Key': process.env.OPENAI_API_KEY || '' }
    });
  }

  async initialize() {
    try {
      const schemaExists = await this.client.schema
        .exists(this.className);

      if (!schemaExists) {
        await this.client.schema
          .classCreator()
          .withClass({
            class: this.className,
            vectorizer: 'text2vec-openai',
            moduleConfig: {
              'text2vec-openai': {
                model: 'text-embedding-3-small',
                type: 'text'
              }
            },
            properties: [
              { name: 'content', dataType: ['text'] },
              { name: 'type', dataType: ['string'] },
              { name: 'title', dataType: ['string'] },
              { name: 'description', dataType: ['text'] },
              { name: 'tags', dataType: ['string[]'] },
              { name: 'owner', dataType: ['string'] },
              { name: 'lastModified', dataType: ['date'] },
              { name: 'relationships', dataType: ['string[]'] }
            ]
          })
          .do();
        logger.info(`Created Weaviate class: ${this.className}`);
      }
    } catch (error) {
      logger.error('Failed to initialize Weaviate', error);
      throw error;
    }
  }

  async index(documents: VectorDocument[]): Promise<void> {
    const batchSize = 100;
    
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      const batcher = this.client.batch.objectsBatcher();

      for (const doc of batch) {
        batcher.withObject({
          class: this.className,
          id: doc.id,
          properties: {
            content: doc.content,
            type: doc.metadata.type,
            title: doc.metadata.title,
            description: doc.metadata.description,
            tags: doc.metadata.tags,
            owner: doc.metadata.owner,
            lastModified: doc.metadata.lastModified,
            relationships: doc.metadata.relationships
          }
        });
      }

      await batcher.do();
    }
    logger.info(`Indexed ${documents.length} documents in Weaviate`);
  }

  async search(query: string, options?: SearchOptions): Promise<VectorDocument[]> {
    let searchQuery = this.client.graphql
      .get()
      .withClassName(this.className)
      .withNearText({ concepts: [query] })
      .withLimit(options?.limit || 10)
      .withFields('content type title description tags owner lastModified relationships _additional { id certainty distance }');

    if (options?.filter) {
      searchQuery = searchQuery.withWhere(this.buildWhereFilter(options.filter));
    }

    const result = await searchQuery.do();
    const data = result.data?.Get?.[this.className] || [];

    return data.map((item: any) => ({
      id: item._additional.id,
      content: item.content,
      metadata: {
        type: item.type,
        title: item.title,
        description: item.description,
        tags: item.tags,
        owner: item.owner,
        lastModified: item.lastModified,
        relationships: item.relationships,
        score: item._additional.certainty
      }
    }));
  }

  async delete(ids: string[]): Promise<void> {
    const batcher = this.client.batch.objectsBatcher();
    
    for (const id of ids) {
      batcher.withDelete({
        class: this.className,
        id
      });
    }

    await batcher.do();
  }

  async update(document: VectorDocument): Promise<void> {
    await this.client.data
      .updater()
      .withClassName(this.className)
      .withId(document.id)
      .withProperties({
        content: document.content,
        type: document.metadata.type,
        title: document.metadata.title,
        description: document.metadata.description,
        tags: document.metadata.tags,
        owner: document.metadata.owner,
        lastModified: document.metadata.lastModified,
        relationships: document.metadata.relationships
      })
      .do();
  }

  async similarity(id: string, limit?: number): Promise<VectorDocument[]> {
    const result = await this.client.graphql
      .get()
      .withClassName(this.className)
      .withNearObject({ id })
      .withLimit(limit || 10)
      .withFields('content type title description tags owner lastModified relationships _additional { id certainty }')
      .do();

    const data = result.data?.Get?.[this.className] || [];

    return data.filter((item: any) => item._additional.id !== id).map((item: any) => ({
      id: item._additional.id,
      content: item.content,
      metadata: {
        type: item.type,
        title: item.title,
        description: item.description,
        tags: item.tags,
        owner: item.owner,
        lastModified: item.lastModified,
        relationships: item.relationships,
        score: item._additional.certainty
      }
    }));
  }

  private buildWhereFilter(filter: Record<string, any>) {
    const conditions: any[] = [];

    for (const [key, value] of Object.entries(filter)) {
      if (Array.isArray(value)) {
        conditions.push({
          path: [key],
          operator: 'ContainsAny',
          valueStringArray: value
        });
      } else {
        conditions.push({
          path: [key],
          operator: 'Equal',
          valueString: value
        });
      }
    }

    return conditions.length === 1 ? conditions[0] : {
      operator: 'And',
      operands: conditions
    };
  }
}

// Hybrid Vector DB Manager
export class VectorDBManager {
  private provider: VectorDBProvider;
  private redis: Redis;
  private cacheEnabled: boolean = true;
  private cacheTTL: number = 300; // 5 minutes

  constructor(provider: VectorDBProvider, redisUrl?: string) {
    this.provider = provider;
    this.redis = new Redis(redisUrl || 'redis://localhost:6379');
  }

  async initialize() {
    if (this.provider instanceof PineconeProvider || this.provider instanceof WeaviateProvider) {
      await (this.provider as any).initialize();
    }
  }

  async index(documents: VectorDocument[]): Promise<void> {
    await this.provider.index(documents);
    
    // Invalidate cache for indexed documents
    const pipeline = this.redis.pipeline();
    for (const doc of documents) {
      pipeline.del(`search:doc:${doc.id}`);
    }
    await pipeline.exec();
  }

  async search(query: string, options?: SearchOptions): Promise<VectorDocument[]> {
    const cacheKey = `search:query:${JSON.stringify({ query, options })}`;

    if (this.cacheEnabled) {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    const results = await this.provider.search(query, options);

    if (this.cacheEnabled && results.length > 0) {
      await this.redis.setex(cacheKey, this.cacheTTL, JSON.stringify(results));
    }

    return results;
  }

  async delete(ids: string[]): Promise<void> {
    await this.provider.delete(ids);

    // Invalidate cache
    const pipeline = this.redis.pipeline();
    for (const id of ids) {
      pipeline.del(`search:doc:${id}`);
    }
    await pipeline.exec();
  }

  async update(document: VectorDocument): Promise<void> {
    await this.provider.update(document);
    await this.redis.del(`search:doc:${document.id}`);
  }

  async similarity(id: string, limit?: number): Promise<VectorDocument[]> {
    const cacheKey = `search:similarity:${id}:${limit}`;

    if (this.cacheEnabled) {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    const results = await this.provider.similarity(id, limit);

    if (this.cacheEnabled && results.length > 0) {
      await this.redis.setex(cacheKey, this.cacheTTL, JSON.stringify(results));
    }

    return results;
  }

  async invalidateCache(pattern?: string) {
    const keys = await this.redis.keys(pattern || 'search:*');
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  setCacheEnabled(enabled: boolean) {
    this.cacheEnabled = enabled;
  }

  setCacheTTL(ttl: number) {
    this.cacheTTL = ttl;
  }
}

// Factory function to create the appropriate provider
export function createVectorDBProvider(config: {
  provider: 'pinecone' | 'weaviate';
  pinecone?: {
    apiKey: string;
    environment: string;
    indexName: string;
  };
  weaviate?: {
    host: string;
    apiKey?: string;
  };
}): VectorDBProvider {
  if (config.provider === 'pinecone' && config.pinecone) {
    return new PineconeProvider(
      config.pinecone.apiKey,
      config.pinecone.environment,
      config.pinecone.indexName
    );
  } else if (config.provider === 'weaviate' && config.weaviate) {
    return new WeaviateProvider(config.weaviate.host, config.weaviate.apiKey);
  }

  throw new Error(`Unsupported vector DB provider: ${config.provider}`);
}