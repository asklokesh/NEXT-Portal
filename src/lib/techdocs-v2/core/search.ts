/**
 * TechDocs v2 AI-Powered Search Engine
 * Revolutionary search with vector embeddings and semantic understanding
 */

import { EventEmitter } from 'events';
import {
  SearchQuery,
  SearchResult,
  SearchFilters,
  SearchOptions,
  SearchIndex,
  NamedEntity,
  SearchHighlight,
  SearchExplanation,
  TechDocument,
  DocumentBlock,
} from '../types';

export class AISearchEngine extends EventEmitter {
  private vectorStore: VectorStore;
  private textIndexer: TextIndexer;
  private entityExtractor: EntityExtractor;
  private queryProcessor: QueryProcessor;
  private rankingEngine: RankingEngine;
  private searchCache: Map<string, CachedSearchResult> = new Map();
  private embeddingModel: EmbeddingModel;

  constructor(config: SearchEngineConfig) {
    super();
    this.vectorStore = new VectorStore(config.vectorStore);
    this.textIndexer = new TextIndexer(config.textIndex);
    this.entityExtractor = new EntityExtractor(config.entities);
    this.queryProcessor = new QueryProcessor(config.queryProcessing);
    this.rankingEngine = new RankingEngine(config.ranking);
    this.embeddingModel = new EmbeddingModel(config.embedding);
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Initialize vector store
    await this.vectorStore.initialize();
    
    // Initialize text indexer
    await this.textIndexer.initialize();
    
    // Load embedding models
    await this.embeddingModel.initialize();
    
    // Initialize entity extraction
    await this.entityExtractor.initialize();
    
    // Setup search optimization
    await this.setupSearchOptimization();
    
    this.emit('search:ready');
  }

  /**
   * Search documents with semantic understanding and sub-100ms performance
   */
  async search(query: SearchQuery): Promise<SearchResult[]> {
    const startTime = Date.now();
    
    try {
      // Check cache first for sub-100ms performance
      const cacheKey = this.generateCacheKey(query);
      const cached = this.searchCache.get(cacheKey);
      
      if (cached && !this.isCacheExpired(cached)) {
        const searchTime = Date.now() - startTime;
        this.emit('search:cache-hit', { query, searchTime });
        return this.enhanceResultsWithFreshData(cached.results, query);
      }

      // Process query for semantic understanding
      const processedQuery = await this.queryProcessor.process(query);
      
      // Execute parallel searches for maximum performance
      const [
        semanticResults,
        textResults,
        entityResults,
        codeResults
      ] = await Promise.all([
        this.semanticSearch(processedQuery),
        this.textSearch(processedQuery),
        this.entitySearch(processedQuery),
        this.codeSearch(processedQuery),
      ]);

      // Combine and rank results
      const combinedResults = await this.combineResults(
        semanticResults,
        textResults,
        entityResults,
        codeResults,
        processedQuery
      );

      // Apply filters
      const filteredResults = this.applyFilters(combinedResults, query.filters);
      
      // Final ranking and relevance scoring
      const rankedResults = await this.rankingEngine.rank(
        filteredResults,
        processedQuery
      );

      // Add explanations and highlights
      const enhancedResults = await this.enhanceResults(
        rankedResults,
        processedQuery
      );

      // Limit results
      const finalResults = enhancedResults.slice(0, query.options.limit || 20);

      const searchTime = Date.now() - startTime;
      
      // Cache results for future queries
      this.cacheResults(cacheKey, finalResults, searchTime);
      
      // Ensure sub-100ms performance target
      if (searchTime > 100) {
        this.emit('performance:warning', {
          operation: 'search',
          time: searchTime,
          query,
          target: 100,
        });
        
        // Trigger performance optimization
        this.optimizeSearchPerformance(query, searchTime);
      }

      this.emit('search:completed', {
        query,
        results: finalResults,
        searchTime,
        breakdown: {
          semantic: semanticResults.length,
          text: textResults.length,
          entity: entityResults.length,
          code: codeResults.length,
        },
      });

      return finalResults;
      
    } catch (error) {
      const searchTime = Date.now() - startTime;
      this.emit('search:error', { error, query, searchTime });
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  /**
   * Index a document for search
   */
  async indexDocument(document: TechDocument): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Extract text content from all blocks
      const textContent = this.extractTextContent(document);
      
      // Generate embeddings for semantic search
      const embeddings = await this.embeddingModel.generateEmbeddings(textContent);
      
      // Extract entities for entity-based search
      const entities = await this.entityExtractor.extractEntities(textContent);
      
      // Create search indices
      const searchIndices = await this.createSearchIndices(
        document,
        textContent,
        embeddings,
        entities
      );

      // Store in vector database
      await this.vectorStore.store(document.id, {
        embeddings,
        metadata: {
          title: document.title,
          tags: document.metadata.tags,
          author: document.metadata.author,
          lastModified: document.metadata.lastModified,
        },
      });

      // Index in text search engine
      await this.textIndexer.index(document.id, {
        title: document.title,
        content: textContent,
        metadata: document.metadata,
      });

      // Update entity index
      await this.entityExtractor.indexEntities(document.id, entities);

      const indexingTime = Date.now() - startTime;
      
      this.emit('document:indexed', {
        documentId: document.id,
        indexingTime,
        entities: entities.length,
        embeddings: embeddings.length,
      });
      
    } catch (error) {
      this.emit('indexing:error', { error, documentId: document.id });
      throw new Error(`Document indexing failed: ${error.message}`);
    }
  }

  /**
   * Auto-complete search suggestions
   */
  async autocomplete(
    partialQuery: string,
    options: AutocompleteOptions = {}
  ): Promise<AutocompleteSuggestion[]> {
    const startTime = Date.now();
    
    try {
      if (partialQuery.length < (options.minLength || 2)) {
        return [];
      }

      // Get suggestions from multiple sources
      const [
        textSuggestions,
        entitySuggestions,
        historySuggestions,
        semanticSuggestions
      ] = await Promise.all([
        this.getTextSuggestions(partialQuery, options),
        this.getEntitySuggestions(partialQuery, options),
        this.getHistorySuggestions(partialQuery, options),
        this.getSemanticSuggestions(partialQuery, options),
      ]);

      // Combine and rank suggestions
      const allSuggestions = [
        ...textSuggestions,
        ...entitySuggestions,
        ...historySuggestions,
        ...semanticSuggestions,
      ];

      const rankedSuggestions = this.rankSuggestions(allSuggestions, partialQuery);
      const finalSuggestions = rankedSuggestions.slice(0, options.maxSuggestions || 10);

      const completionTime = Date.now() - startTime;
      
      this.emit('autocomplete:completed', {
        partialQuery,
        suggestions: finalSuggestions,
        completionTime,
      });

      return finalSuggestions;
      
    } catch (error) {
      this.emit('autocomplete:error', { error, partialQuery });
      return [];
    }
  }

  /**
   * Get search analytics and insights
   */
  async getSearchAnalytics(
    timeRange: { start: Date; end: Date }
  ): Promise<SearchAnalytics> {
    const analytics: SearchAnalytics = {
      totalSearches: 0,
      uniqueQueries: 0,
      averageResponseTime: 0,
      popularQueries: [],
      noResultsQueries: [],
      performanceMetrics: {
        sub100msQueries: 0,
        sub50msQueries: 0,
        slowQueries: [],
      },
      cacheMetrics: {
        hitRate: 0,
        totalHits: 0,
        totalMisses: 0,
      },
    };

    // Calculate analytics from search logs
    // This would integrate with actual analytics storage
    
    return analytics;
  }

  /**
   * Optimize search performance based on usage patterns
   */
  async optimizePerformance(): Promise<PerformanceOptimization> {
    const optimization: PerformanceOptimization = {
      actions: [],
      estimatedImprovement: 0,
      implementedAt: new Date(),
    };

    // Analyze query patterns
    const queryPatterns = await this.analyzeQueryPatterns();
    
    // Optimize vector indices
    if (queryPatterns.needsVectorOptimization) {
      await this.vectorStore.optimize();
      optimization.actions.push('vector-index-optimization');
    }

    // Optimize text indices
    if (queryPatterns.needsTextOptimization) {
      await this.textIndexer.optimize();
      optimization.actions.push('text-index-optimization');
    }

    // Update cache strategies
    if (queryPatterns.needsCacheOptimization) {
      this.optimizeCacheStrategy(queryPatterns);
      optimization.actions.push('cache-strategy-optimization');
    }

    // Pre-compute popular queries
    if (queryPatterns.popularQueries.length > 0) {
      await this.precomputePopularQueries(queryPatterns.popularQueries);
      optimization.actions.push('query-precomputation');
    }

    this.emit('performance:optimized', optimization);
    
    return optimization;
  }

  // Private implementation methods
  private async semanticSearch(processedQuery: ProcessedQuery): Promise<SemanticSearchResult[]> {
    // Generate query embeddings
    const queryEmbeddings = await this.embeddingModel.generateEmbeddings(
      processedQuery.semanticQuery
    );

    // Search vector store
    const vectorResults = await this.vectorStore.search(queryEmbeddings, {
      limit: processedQuery.options.limit * 2, // Get more for better ranking
      threshold: 0.7, // Minimum similarity threshold
    });

    return vectorResults.map(result => ({
      documentId: result.id,
      similarity: result.score,
      type: 'semantic',
      embeddings: result.embeddings,
      metadata: result.metadata,
    }));
  }

  private async textSearch(processedQuery: ProcessedQuery): Promise<TextSearchResult[]> {
    // Traditional text search with BM25 scoring
    const textResults = await this.textIndexer.search(processedQuery.textQuery, {
      fuzzy: processedQuery.options.fuzzy,
      boost: {
        title: 2.0,
        headings: 1.5,
        content: 1.0,
      },
    });

    return textResults.map(result => ({
      documentId: result.id,
      score: result.score,
      type: 'text',
      highlights: result.highlights,
      metadata: result.metadata,
    }));
  }

  private async entitySearch(processedQuery: ProcessedQuery): Promise<EntitySearchResult[]> {
    // Search based on extracted entities
    const entityResults = await this.entityExtractor.search(processedQuery.entities, {
      exactMatch: true,
      fuzzyMatch: true,
    });

    return entityResults.map(result => ({
      documentId: result.documentId,
      entities: result.entities,
      type: 'entity',
      confidence: result.confidence,
    }));
  }

  private async codeSearch(processedQuery: ProcessedQuery): Promise<CodeSearchResult[]> {
    // Specialized search for code blocks
    if (!processedQuery.codeQuery) {
      return [];
    }

    const codeResults = await this.textIndexer.searchCode(processedQuery.codeQuery, {
      languages: processedQuery.filters.languages,
      exactMatch: processedQuery.codeQuery.includes('function'),
    });

    return codeResults.map(result => ({
      documentId: result.documentId,
      blockId: result.blockId,
      type: 'code',
      language: result.language,
      score: result.score,
      snippet: result.snippet,
    }));
  }

  private async combineResults(
    semanticResults: SemanticSearchResult[],
    textResults: TextSearchResult[],
    entityResults: EntitySearchResult[],
    codeResults: CodeSearchResult[],
    processedQuery: ProcessedQuery
  ): Promise<CombinedSearchResult[]> {
    const combinedMap = new Map<string, CombinedSearchResult>();

    // Process semantic results
    for (const result of semanticResults) {
      combinedMap.set(result.documentId, {
        documentId: result.documentId,
        scores: {
          semantic: result.similarity,
          text: 0,
          entity: 0,
          code: 0,
        },
        highlights: [],
        entities: [],
        metadata: result.metadata,
      });
    }

    // Add text search scores
    for (const result of textResults) {
      const existing = combinedMap.get(result.documentId);
      if (existing) {
        existing.scores.text = result.score;
        existing.highlights.push(...result.highlights);
      } else {
        combinedMap.set(result.documentId, {
          documentId: result.documentId,
          scores: {
            semantic: 0,
            text: result.score,
            entity: 0,
            code: 0,
          },
          highlights: result.highlights,
          entities: [],
          metadata: result.metadata,
        });
      }
    }

    // Add entity scores
    for (const result of entityResults) {
      const existing = combinedMap.get(result.documentId);
      if (existing) {
        existing.scores.entity = result.confidence;
        existing.entities.push(...result.entities);
      }
    }

    // Add code scores
    for (const result of codeResults) {
      const existing = combinedMap.get(result.documentId);
      if (existing) {
        existing.scores.code = result.score;
      }
    }

    return Array.from(combinedMap.values());
  }

  private applyFilters(
    results: CombinedSearchResult[],
    filters: SearchFilters
  ): CombinedSearchResult[] {
    return results.filter(result => {
      // Apply document type filters
      if (filters.documentTypes && filters.documentTypes.length > 0) {
        const docType = result.metadata.format || 'unknown';
        if (!filters.documentTypes.includes(docType)) {
          return false;
        }
      }

      // Apply tag filters
      if (filters.tags && filters.tags.length > 0) {
        const docTags = result.metadata.tags || [];
        const hasMatchingTag = filters.tags.some(tag => 
          docTags.some(docTag => docTag.toLowerCase().includes(tag.toLowerCase()))
        );
        if (!hasMatchingTag) {
          return false;
        }
      }

      // Apply author filters
      if (filters.authors && filters.authors.length > 0) {
        const docAuthor = result.metadata.author || '';
        if (!filters.authors.includes(docAuthor)) {
          return false;
        }
      }

      // Apply date range filters
      if (filters.dateRange) {
        const docDate = new Date(result.metadata.lastModified);
        if (docDate < filters.dateRange.start || docDate > filters.dateRange.end) {
          return false;
        }
      }

      return true;
    });
  }

  private async enhanceResults(
    results: CombinedSearchResult[],
    processedQuery: ProcessedQuery
  ): Promise<SearchResult[]> {
    return Promise.all(
      results.map(async result => {
        // Get full document for result enhancement
        const document = await this.getDocument(result.documentId);
        
        // Generate search explanations
        const explanation = processedQuery.options.explain ? 
          await this.generateExplanation(result, processedQuery) : undefined;

        // Find related documents
        const relatedDocuments = await this.findRelatedDocuments(result.documentId);

        return {
          document,
          relevance: this.calculateRelevance(result),
          highlights: result.highlights,
          explanation,
          relatedDocuments,
        };
      })
    );
  }

  private generateCacheKey(query: SearchQuery): string {
    const key = {
      query: query.query,
      filters: query.filters,
      options: { ...query.options, explain: false }, // Exclude explain from cache key
    };
    return btoa(JSON.stringify(key));
  }

  private isCacheExpired(cached: CachedSearchResult): boolean {
    const ttl = 5 * 60 * 1000; // 5 minutes
    return Date.now() - cached.timestamp > ttl;
  }

  private cacheResults(
    cacheKey: string,
    results: SearchResult[],
    searchTime: number
  ): void {
    // Only cache fast queries to maintain performance
    if (searchTime < 50) {
      this.searchCache.set(cacheKey, {
        results,
        searchTime,
        timestamp: Date.now(),
      });
    }

    // Cleanup old cache entries
    if (this.searchCache.size > 1000) {
      this.cleanupCache();
    }
  }

  private cleanupCache(): void {
    const entries = Array.from(this.searchCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove oldest 25% of entries
    const toRemove = entries.slice(0, Math.floor(entries.length * 0.25));
    toRemove.forEach(([key]) => this.searchCache.delete(key));
  }

  private extractTextContent(document: TechDocument): string {
    return document.content.blocks
      .map(block => this.extractBlockText(block))
      .filter(text => text.trim().length > 0)
      .join('\n\n');
  }

  private extractBlockText(block: DocumentBlock): string {
    switch (block.type) {
      case 'text':
        return block.content.text || '';
      case 'code':
        return `${block.content.language || 'code'}:\n${block.content.code || ''}`;
      default:
        return JSON.stringify(block.content);
    }
  }

  private async createSearchIndices(
    document: TechDocument,
    textContent: string,
    embeddings: number[],
    entities: NamedEntity[]
  ): Promise<SearchIndex[]> {
    const indices: SearchIndex[] = [];

    // Create index for full document
    indices.push({
      id: `${document.id}_full`,
      documentId: document.id,
      content: textContent,
      embeddings,
      keywords: this.extractKeywords(textContent),
      entities,
      metadata: {
        title: document.title,
        description: document.metadata.description || '',
        tags: document.metadata.tags,
        author: document.metadata.author,
        difficulty: document.metadata.difficulty,
        lastModified: document.metadata.lastModified,
        readTime: document.metadata.estimatedReadTime || 0,
      },
      lastIndexed: new Date(),
    });

    // Create indices for individual blocks
    for (const block of document.content.blocks) {
      const blockText = this.extractBlockText(block);
      if (blockText.trim().length > 0) {
        const blockEmbeddings = await this.embeddingModel.generateEmbeddings(blockText);
        const blockEntities = await this.entityExtractor.extractEntities(blockText);

        indices.push({
          id: `${document.id}_${block.id}`,
          documentId: document.id,
          blockId: block.id,
          content: blockText,
          embeddings: blockEmbeddings,
          keywords: this.extractKeywords(blockText),
          entities: blockEntities,
          metadata: {
            title: block.metadata?.title || '',
            description: block.metadata?.description || '',
            tags: block.metadata?.tags || [],
            author: block.metadata?.author || document.metadata.author,
            difficulty: block.metadata?.difficulty || document.metadata.difficulty,
            lastModified: block.metadata?.lastModified || document.metadata.lastModified,
            readTime: block.metadata?.estimatedReadTime || 0,
          },
          lastIndexed: new Date(),
        });
      }
    }

    return indices;
  }

  private extractKeywords(text: string): string[] {
    // Simple keyword extraction - in production, use more sophisticated NLP
    return text
      .toLowerCase()
      .split(/\W+/)
      .filter(word => word.length > 3)
      .filter((word, index, array) => array.indexOf(word) === index)
      .slice(0, 50); // Limit to 50 keywords
  }

  private calculateRelevance(result: CombinedSearchResult): number {
    // Weighted combination of different search scores
    const weights = {
      semantic: 0.4,
      text: 0.3,
      entity: 0.2,
      code: 0.1,
    };

    return (
      result.scores.semantic * weights.semantic +
      result.scores.text * weights.text +
      result.scores.entity * weights.entity +
      result.scores.code * weights.code
    );
  }

  // Placeholder implementations for complex operations
  private async setupSearchOptimization(): Promise<void> {
    // Setup search performance optimization
  }

  private async enhanceResultsWithFreshData(
    cachedResults: SearchResult[],
    query: SearchQuery
  ): Promise<SearchResult[]> {
    // Enhance cached results with fresh data
    return cachedResults;
  }

  private async optimizeSearchPerformance(query: SearchQuery, searchTime: number): Promise<void> {
    // Trigger performance optimization based on slow queries
  }

  private async getTextSuggestions(partialQuery: string, options: AutocompleteOptions): Promise<AutocompleteSuggestion[]> {
    return [];
  }

  private async getEntitySuggestions(partialQuery: string, options: AutocompleteOptions): Promise<AutocompleteSuggestion[]> {
    return [];
  }

  private async getHistorySuggestions(partialQuery: string, options: AutocompleteOptions): Promise<AutocompleteSuggestion[]> {
    return [];
  }

  private async getSemanticSuggestions(partialQuery: string, options: AutocompleteOptions): Promise<AutocompleteSuggestion[]> {
    return [];
  }

  private rankSuggestions(suggestions: AutocompleteSuggestion[], partialQuery: string): AutocompleteSuggestion[] {
    return suggestions.sort((a, b) => b.score - a.score);
  }

  private async analyzeQueryPatterns(): Promise<QueryPatterns> {
    return {
      needsVectorOptimization: false,
      needsTextOptimization: false,
      needsCacheOptimization: false,
      popularQueries: [],
    };
  }

  private optimizeCacheStrategy(patterns: QueryPatterns): void {
    // Optimize cache based on query patterns
  }

  private async precomputePopularQueries(queries: string[]): Promise<void> {
    // Pre-compute results for popular queries
  }

  private async generateExplanation(result: CombinedSearchResult, query: ProcessedQuery): Promise<SearchExplanation> {
    return {
      score: this.calculateRelevance(result),
      factors: [],
      query: query.originalQuery,
      matched: [],
    };
  }

  private async findRelatedDocuments(documentId: string): Promise<any[]> {
    return [];
  }

  private async getDocument(documentId: string): Promise<TechDocument> {
    // Get document from storage
    return {} as TechDocument;
  }
}

// Supporting classes (simplified implementations)
class VectorStore {
  constructor(private config: any) {}
  async initialize(): Promise<void> {}
  async store(id: string, data: any): Promise<void> {}
  async search(embeddings: number[], options: any): Promise<any[]> { return []; }
  async optimize(): Promise<void> {}
}

class TextIndexer {
  constructor(private config: any) {}
  async initialize(): Promise<void> {}
  async index(id: string, data: any): Promise<void> {}
  async search(query: string, options: any): Promise<any[]> { return []; }
  async searchCode(query: string, options: any): Promise<any[]> { return []; }
  async optimize(): Promise<void> {}
}

class EntityExtractor {
  constructor(private config: any) {}
  async initialize(): Promise<void> {}
  async extractEntities(text: string): Promise<NamedEntity[]> { return []; }
  async indexEntities(docId: string, entities: NamedEntity[]): Promise<void> {}
  async search(entities: string[], options: any): Promise<any[]> { return []; }
}

class QueryProcessor {
  constructor(private config: any) {}
  async process(query: SearchQuery): Promise<ProcessedQuery> {
    return {
      originalQuery: query.query,
      semanticQuery: query.query,
      textQuery: query.query,
      entities: [],
      codeQuery: this.extractCodeQuery(query.query),
      filters: query.filters,
      options: query.options,
    };
  }

  private extractCodeQuery(query: string): string | null {
    // Extract code-specific query patterns
    return null;
  }
}

class RankingEngine {
  constructor(private config: any) {}
  async rank(results: CombinedSearchResult[], query: ProcessedQuery): Promise<CombinedSearchResult[]> {
    return results.sort((a, b) => this.calculateScore(b) - this.calculateScore(a));
  }

  private calculateScore(result: CombinedSearchResult): number {
    return result.scores.semantic + result.scores.text + result.scores.entity + result.scores.code;
  }
}

class EmbeddingModel {
  constructor(private config: any) {}
  async initialize(): Promise<void> {}
  async generateEmbeddings(text: string): Promise<number[]> {
    // Generate embeddings using sentence transformers or similar
    return new Array(768).fill(0).map(() => Math.random());
  }
}

// Types for search system
export interface SearchEngineConfig {
  vectorStore: any;
  textIndex: any;
  entities: any;
  queryProcessing: any;
  ranking: any;
  embedding: any;
}

interface ProcessedQuery {
  originalQuery: string;
  semanticQuery: string;
  textQuery: string;
  entities: string[];
  codeQuery: string | null;
  filters: SearchFilters;
  options: SearchOptions;
}

interface SemanticSearchResult {
  documentId: string;
  similarity: number;
  type: 'semantic';
  embeddings: number[];
  metadata: any;
}

interface TextSearchResult {
  documentId: string;
  score: number;
  type: 'text';
  highlights: SearchHighlight[];
  metadata: any;
}

interface EntitySearchResult {
  documentId: string;
  entities: NamedEntity[];
  type: 'entity';
  confidence: number;
}

interface CodeSearchResult {
  documentId: string;
  blockId: string;
  type: 'code';
  language: string;
  score: number;
  snippet: string;
}

interface CombinedSearchResult {
  documentId: string;
  scores: {
    semantic: number;
    text: number;
    entity: number;
    code: number;
  };
  highlights: SearchHighlight[];
  entities: NamedEntity[];
  metadata: any;
}

interface CachedSearchResult {
  results: SearchResult[];
  searchTime: number;
  timestamp: number;
}

export interface AutocompleteOptions {
  minLength?: number;
  maxSuggestions?: number;
  includeHistory?: boolean;
  includeEntities?: boolean;
}

export interface AutocompleteSuggestion {
  text: string;
  type: 'query' | 'entity' | 'history' | 'semantic';
  score: number;
  category?: string;
}

export interface SearchAnalytics {
  totalSearches: number;
  uniqueQueries: number;
  averageResponseTime: number;
  popularQueries: string[];
  noResultsQueries: string[];
  performanceMetrics: {
    sub100msQueries: number;
    sub50msQueries: number;
    slowQueries: Array<{ query: string; time: number; }>;
  };
  cacheMetrics: {
    hitRate: number;
    totalHits: number;
    totalMisses: number;
  };
}

export interface PerformanceOptimization {
  actions: string[];
  estimatedImprovement: number;
  implementedAt: Date;
}

interface QueryPatterns {
  needsVectorOptimization: boolean;
  needsTextOptimization: boolean;
  needsCacheOptimization: boolean;
  popularQueries: string[];
}