/**
 * Elasticsearch Client Configuration and Management
 * 
 * Provides centralized Elasticsearch client with:
 * - Connection management with retry logic
 * - Index management and mapping definitions
 * - Query builders and search utilities
 * - Monitoring and health checks
 */

import { Client } from '@elastic/elasticsearch';
import type { 
  IndicesCreateRequest, 
  SearchRequest, 
  SearchResponse,
  BulkRequest,
  BulkResponse,
  IndicesExistsRequest,
  IndicesDeleteRequest
} from '@elastic/elasticsearch/lib/api/types';

// Configuration interfaces
export interface ElasticsearchConfig {
  node: string;
  auth?: {
    username: string;
    password: string;
  };
  ssl?: {
    rejectUnauthorized: boolean;
  };
  requestTimeout: number;
  pingTimeout: number;
  maxRetries: number;
  resurrectStrategy: 'ping' | 'optimistic' | 'none';
}

export interface IndexConfig {
  name: string;
  mappings: Record<string, any>;
  settings: Record<string, any>;
  aliases?: string[];
}

// Search types
export interface SearchOptions {
  from?: number;
  size?: number;
  sort?: Array<Record<string, any>>;
  highlight?: Record<string, any>;
  aggs?: Record<string, any>;
  source?: string[] | boolean;
  timeout?: string;
}

export interface SearchHit {
  _index: string;
  _type: string;
  _id: string;
  _score: number;
  _source: any;
  highlight?: Record<string, string[]>;
}

export interface SearchAggregation {
  doc_count_error_upper_bound: number;
  sum_other_doc_count: number;
  buckets: Array<{
    key: string;
    doc_count: number;
    [key: string]: any;
  }>;
}

// Default configuration
const DEFAULT_CONFIG: ElasticsearchConfig = {
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
  requestTimeout: 30000,
  pingTimeout: 3000,
  maxRetries: 3,
  resurrectStrategy: 'ping',
  ssl: {
    rejectUnauthorized: false
  }
};

// Index configurations for different entity types
export const INDEX_CONFIGS: Record<string, IndexConfig> = {
  // Catalog entities index
  catalog: {
    name: 'idp-catalog',
    mappings: {
      properties: {
        // Core entity fields
        kind: { type: 'keyword' },
        namespace: { type: 'keyword' },
        name: { 
          type: 'text',
          analyzer: 'entity_analyzer',
          fields: {
            keyword: { type: 'keyword' },
            suggest: { type: 'completion' }
          }
        },
        title: { 
          type: 'text',
          analyzer: 'entity_analyzer',
          fields: {
            keyword: { type: 'keyword' }
          }
        },
        description: { 
          type: 'text',
          analyzer: 'content_analyzer'
        },
        
        // Metadata
        tags: { type: 'keyword' },
        labels: { type: 'object' },
        annotations: { type: 'object' },
        
        // Spec fields
        owner: { type: 'keyword' },
        type: { type: 'keyword' },
        lifecycle: { type: 'keyword' },
        system: { type: 'keyword' },
        domain: { type: 'keyword' },
        
        // Relations
        dependsOn: { type: 'keyword' },
        dependencyOf: { type: 'keyword' },
        childOf: { type: 'keyword' },
        parentOf: { type: 'keyword' },
        
        // Technical metadata
        technologies: { type: 'keyword' },
        languages: { type: 'keyword' },
        frameworks: { type: 'keyword' },
        
        // Health and metrics
        healthScore: { type: 'float' },
        lastUpdated: { type: 'date' },
        createdAt: { type: 'date' },
        
        // Full text search
        searchableText: { 
          type: 'text',
          analyzer: 'content_analyzer'
        },
        
        // Location
        source: {
          properties: {
            type: { type: 'keyword' },
            url: { type: 'text' },
            target: { type: 'text' }
          }
        }
      }
    },
    settings: {
      number_of_shards: 1,
      number_of_replicas: 0,
      max_result_window: 50000,
      analysis: {
        filter: {
          synonym_filter: {
            type: 'synonym',
            synonyms_path: 'synonyms.txt'
          },
          stop_filter: {
            type: 'stop',
            stopwords_path: 'stopwords.txt'
          },
          edge_ngram_filter: {
            type: 'edge_ngram',
            min_gram: 2,
            max_gram: 20
          }
        },
        analyzer: {
          entity_analyzer: {
            tokenizer: 'standard',
            filter: [
              'lowercase',
              'stop_filter',
              'synonym_filter',
              'edge_ngram_filter'
            ]
          },
          content_analyzer: {
            tokenizer: 'standard',
            filter: [
              'lowercase',
              'stop_filter',
              'synonym_filter'
            ]
          },
          search_analyzer: {
            tokenizer: 'standard',
            filter: [
              'lowercase',
              'stop_filter',
              'synonym_filter'
            ]
          }
        }
      }
    },
    aliases: ['catalog-current']
  },
  
  // Documentation index
  docs: {
    name: 'idp-docs',
    mappings: {
      properties: {
        title: { 
          type: 'text',
          analyzer: 'content_analyzer',
          fields: {
            keyword: { type: 'keyword' },
            suggest: { type: 'completion' }
          }
        },
        content: { 
          type: 'text',
          analyzer: 'content_analyzer'
        },
        summary: { 
          type: 'text',
          analyzer: 'content_analyzer'
        },
        path: { type: 'keyword' },
        url: { type: 'text' },
        type: { type: 'keyword' }, // techdocs, markdown, api-docs
        entityRef: { type: 'keyword' },
        owner: { type: 'keyword' },
        tags: { type: 'keyword' },
        lastModified: { type: 'date' },
        lastIndexed: { type: 'date' },
        wordCount: { type: 'integer' },
        readingTime: { type: 'integer' }, // in minutes
        headers: {
          type: 'nested',
          properties: {
            level: { type: 'integer' },
            text: { type: 'text', analyzer: 'content_analyzer' },
            id: { type: 'keyword' }
          }
        }
      }
    },
    settings: {
      number_of_shards: 1,
      number_of_replicas: 0,
      analysis: {
        filter: {
          synonym_filter: {
            type: 'synonym',
            synonyms_path: 'synonyms.txt'
          },
          stop_filter: {
            type: 'stop',
            stopwords_path: 'stopwords.txt'
          }
        },
        analyzer: {
          content_analyzer: {
            tokenizer: 'standard',
            filter: [
              'lowercase',
              'stop_filter',
              'synonym_filter'
            ]
          }
        }
      }
    },
    aliases: ['docs-current']
  },
  
  // Templates index
  templates: {
    name: 'idp-templates',
    mappings: {
      properties: {
        name: { 
          type: 'text',
          analyzer: 'entity_analyzer',
          fields: {
            keyword: { type: 'keyword' },
            suggest: { type: 'completion' }
          }
        },
        title: { 
          type: 'text',
          analyzer: 'content_analyzer'
        },
        description: { 
          type: 'text',
          analyzer: 'content_analyzer'
        },
        type: { type: 'keyword' }, // service, component, resource, etc.
        category: { type: 'keyword' },
        tags: { type: 'keyword' },
        owner: { type: 'keyword' },
        technologies: { type: 'keyword' },
        languages: { type: 'keyword' },
        frameworks: { type: 'keyword' },
        parameters: {
          type: 'nested',
          properties: {
            name: { type: 'keyword' },
            type: { type: 'keyword' },
            description: { type: 'text' },
            required: { type: 'boolean' }
          }
        },
        steps: {
          type: 'nested',
          properties: {
            id: { type: 'keyword' },
            name: { type: 'text' },
            action: { type: 'keyword' }
          }
        },
        lastModified: { type: 'date' },
        usage: {
          properties: {
            count: { type: 'integer' },
            lastUsed: { type: 'date' }
          }
        },
        ratings: {
          properties: {
            average: { type: 'float' },
            count: { type: 'integer' }
          }
        }
      }
    },
    settings: {
      number_of_shards: 1,
      number_of_replicas: 0,
      analysis: {
        filter: {
          synonym_filter: {
            type: 'synonym',
            synonyms_path: 'synonyms.txt'
          },
          stop_filter: {
            type: 'stop',
            stopwords_path: 'stopwords.txt'
          },
          edge_ngram_filter: {
            type: 'edge_ngram',
            min_gram: 2,
            max_gram: 20
          }
        },
        analyzer: {
          entity_analyzer: {
            tokenizer: 'standard',
            filter: [
              'lowercase',
              'stop_filter',
              'synonym_filter',
              'edge_ngram_filter'
            ]
          },
          content_analyzer: {
            tokenizer: 'standard',
            filter: [
              'lowercase',
              'stop_filter',
              'synonym_filter'
            ]
          }
        }
      }
    },
    aliases: ['templates-current']
  }
};

export class ElasticsearchClient {
  private client: Client;
  private config: ElasticsearchConfig;
  private isConnected = false;
  private connectionPromise: Promise<boolean> | null = null;

  constructor(config?: Partial<ElasticsearchConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.client = new Client(this.config);
  }

  /**
   * Initialize connection and ensure indices exist
   */
  async initialize(): Promise<boolean> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this.performInitialization();
    return this.connectionPromise;
  }

  private async performInitialization(): Promise<boolean> {
    try {
      // Test connection
      await this.client.ping();
      this.isConnected = true;

      // Initialize indices
      for (const [indexType, indexConfig] of Object.entries(INDEX_CONFIGS)) {
        await this.ensureIndex(indexConfig);
      }

      console.log('Elasticsearch client initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Elasticsearch client:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Ensure index exists with proper configuration
   */
  private async ensureIndex(indexConfig: IndexConfig): Promise<void> {
    try {
      const exists = await this.client.indices.exists({ 
        index: indexConfig.name 
      } as IndicesExistsRequest);

      if (!exists) {
        await this.client.indices.create({
          index: indexConfig.name,
          mappings: indexConfig.mappings,
          settings: indexConfig.settings,
          aliases: indexConfig.aliases?.reduce((acc, alias) => {
            acc[alias] = {};
            return acc;
          }, {} as Record<string, any>)
        } as IndicesCreateRequest);

        console.log(`Created index: ${indexConfig.name}`);
      } else {
        // Update mappings for existing index
        await this.client.indices.putMapping({
          index: indexConfig.name,
          ...indexConfig.mappings
        });
      }
    } catch (error) {
      console.error(`Failed to ensure index ${indexConfig.name}:`, error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async isHealthy(): Promise<boolean> {
    try {
      const response = await this.client.cluster.health({
        wait_for_status: 'yellow',
        timeout: '5s'
      });
      return response.status === 'green' || response.status === 'yellow';
    } catch (error) {
      console.error('Elasticsearch health check failed:', error);
      return false;
    }
  }

  /**
   * Get cluster info
   */
  async getClusterInfo() {
    try {
      const [health, stats] = await Promise.all([
        this.client.cluster.health(),
        this.client.cluster.stats()
      ]);
      return { health, stats };
    } catch (error) {
      console.error('Failed to get cluster info:', error);
      return null;
    }
  }

  /**
   * Index a single document
   */
  async indexDocument(index: string, id: string, document: any): Promise<boolean> {
    try {
      await this.client.index({
        index,
        id,
        document,
        refresh: 'wait_for'
      });
      return true;
    } catch (error) {
      console.error(`Failed to index document ${id} in ${index}:`, error);
      return false;
    }
  }

  /**
   * Bulk index documents
   */
  async bulkIndex(operations: Array<{ index: string; id: string; document: any }>): Promise<boolean> {
    if (operations.length === 0) return true;

    try {
      const bulkBody = operations.flatMap(({ index, id, document }) => [
        { index: { _index: index, _id: id } },
        document
      ]);

      const response = await this.client.bulk({
        body: bulkBody,
        refresh: 'wait_for'
      } as BulkRequest);

      if (response.errors) {
        const errorItems = response.items?.filter(item => 
          item.index?.error || item.create?.error || item.update?.error
        );
        console.error('Bulk indexing errors:', errorItems);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Bulk indexing failed:', error);
      return false;
    }
  }

  /**
   * Delete document
   */
  async deleteDocument(index: string, id: string): Promise<boolean> {
    try {
      await this.client.delete({
        index,
        id,
        refresh: 'wait_for'
      });
      return true;
    } catch (error) {
      console.error(`Failed to delete document ${id} from ${index}:`, error);
      return false;
    }
  }

  /**
   * Delete index
   */
  async deleteIndex(index: string): Promise<boolean> {
    try {
      await this.client.indices.delete({ 
        index 
      } as IndicesDeleteRequest);
      return true;
    } catch (error) {
      console.error(`Failed to delete index ${index}:`, error);
      return false;
    }
  }

  /**
   * Search documents
   */
  async search<T = any>(
    index: string | string[], 
    query: any, 
    options: SearchOptions = {}
  ): Promise<{
    hits: SearchHit[];
    total: number;
    maxScore: number;
    aggregations?: Record<string, SearchAggregation>;
    took: number;
  }> {
    try {
      const searchRequest: SearchRequest = {
        index: Array.isArray(index) ? index : [index],
        query,
        from: options.from || 0,
        size: options.size || 20,
        sort: options.sort,
        highlight: options.highlight,
        aggs: options.aggs,
        _source: options.source,
        timeout: options.timeout || '30s'
      };

      const response = await this.client.search(searchRequest);

      return {
        hits: response.hits.hits as SearchHit[],
        total: typeof response.hits.total === 'number' 
          ? response.hits.total 
          : response.hits.total?.value || 0,
        maxScore: response.hits.max_score || 0,
        aggregations: response.aggregations as Record<string, SearchAggregation>,
        took: response.took
      };
    } catch (error) {
      console.error('Search failed:', error);
      throw error;
    }
  }

  /**
   * Multi-search
   */
  async multiSearch(searches: Array<{
    index: string | string[];
    query: any;
    options?: SearchOptions;
  }>) {
    try {
      const body = searches.flatMap(({ index, query, options = {} }) => [
        { index: Array.isArray(index) ? index : [index] },
        {
          query,
          from: options.from || 0,
          size: options.size || 20,
          sort: options.sort,
          highlight: options.highlight,
          aggs: options.aggs,
          _source: options.source
        }
      ]);

      const response = await this.client.msearch({ body });
      return response.responses;
    } catch (error) {
      console.error('Multi-search failed:', error);
      throw error;
    }
  }

  /**
   * Get suggestions
   */
  async suggest(index: string, field: string, text: string, size = 5) {
    try {
      const response = await this.client.search({
        index,
        suggest: {
          suggestion: {
            completion: {
              field,
              prefix: text,
              size
            }
          }
        }
      });

      return response.suggest?.suggestion?.[0]?.options || [];
    } catch (error) {
      console.error('Suggestion failed:', error);
      return [];
    }
  }

  /**
   * Count documents
   */
  async count(index: string, query?: any): Promise<number> {
    try {
      const response = await this.client.count({
        index,
        query
      });
      return response.count;
    } catch (error) {
      console.error('Count failed:', error);
      return 0;
    }
  }

  /**
   * Refresh index
   */
  async refresh(index: string): Promise<boolean> {
    try {
      await this.client.indices.refresh({ index });
      return true;
    } catch (error) {
      console.error(`Failed to refresh index ${index}:`, error);
      return false;
    }
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    await this.client.close();
    this.isConnected = false;
  }

  /**
   * Get the underlying Elasticsearch client
   */
  getClient(): Client {
    return this.client;
  }

  /**
   * Check if client is connected
   */
  isClientConnected(): boolean {
    return this.isConnected;
  }
}

// Singleton instance
let elasticsearchClient: ElasticsearchClient | null = null;

/**
 * Get or create Elasticsearch client singleton
 */
export function getElasticsearchClient(config?: Partial<ElasticsearchConfig>): ElasticsearchClient {
  if (!elasticsearchClient) {
    elasticsearchClient = new ElasticsearchClient(config);
  }
  return elasticsearchClient;
}

/**
 * Initialize Elasticsearch client
 */
export async function initializeElasticsearch(config?: Partial<ElasticsearchConfig>): Promise<boolean> {
  const client = getElasticsearchClient(config);
  return await client.initialize();
}