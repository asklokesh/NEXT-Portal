/**
 * Advanced Search with Graph Traversal
 * Intelligent search engine that leverages graph relationships
 * Far superior to Backstage's basic text search
 */

import { GraphEntity, EntityType, HealthState, RelationshipType } from './graph-model';
import { CatalogGraphService } from './graph-model';

// Search Configuration
export interface SearchConfig {
  enabledSearchTypes: SearchType[];
  maxResults: number;
  defaultDepth: number;
  rankingWeights: RankingWeights;
  enableSemanticSearch: boolean;
  enableFuzzyMatching: boolean;
  cacheResults: boolean;
  cacheTTL: number; // seconds
}

export enum SearchType {
  ENTITY_NAME = 'ENTITY_NAME',
  ENTITY_DESCRIPTION = 'ENTITY_DESCRIPTION',
  METADATA_SEARCH = 'METADATA_SEARCH',
  TAG_SEARCH = 'TAG_SEARCH',
  OWNER_SEARCH = 'OWNER_SEARCH',
  DEPENDENCY_SEARCH = 'DEPENDENCY_SEARCH',
  GRAPH_TRAVERSAL = 'GRAPH_TRAVERSAL',
  SEMANTIC_SEARCH = 'SEMANTIC_SEARCH',
  HEALTH_STATUS_SEARCH = 'HEALTH_STATUS_SEARCH',
  COMPLIANCE_SEARCH = 'COMPLIANCE_SEARCH'
}

export interface RankingWeights {
  nameMatch: number;
  descriptionMatch: number;
  metadataMatch: number;
  relationshipRelevance: number;
  healthStatus: number;
  recentActivity: number;
  ownershipMatch: number;
  complianceScore: number;
}

// Search Query Interface
export interface SearchQuery {
  text: string;
  filters: SearchFilter[];
  searchTypes: SearchType[];
  graphTraversal: GraphTraversalOptions;
  pagination: PaginationOptions;
  sorting: SortingOptions;
}

export interface SearchFilter {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'regex' | 'in' | 'range';
  value: any;
  values?: any[]; // for 'in' operator
  range?: { min: any; max: any }; // for 'range' operator
}

export interface GraphTraversalOptions {
  enabled: boolean;
  maxDepth: number;
  relationshipTypes?: RelationshipType[];
  includeReverse: boolean; // traverse relationships in both directions
  weightByDistance: boolean; // give higher weight to closer entities
  excludeEntityTypes?: EntityType[];
}

export interface PaginationOptions {
  offset: number;
  limit: number;
}

export interface SortingOptions {
  field: string;
  direction: 'asc' | 'desc';
  secondarySort?: {
    field: string;
    direction: 'asc' | 'desc';
  };
}

// Search Results
export interface SearchResult {
  entity: GraphEntity;
  score: number; // relevance score 0-100
  matchedFields: string[];
  highlights: SearchHighlight[];
  context: SearchContext;
  relationships?: RelatedEntity[];
}

export interface SearchHighlight {
  field: string;
  matches: HighlightMatch[];
}

export interface HighlightMatch {
  text: string;
  start: number;
  end: number;
}

export interface SearchContext {
  matchType: SearchType;
  distance?: number; // graph distance from original query
  relationshipPath?: string[]; // path through graph
  similarityScore?: number; // for semantic search
  reasonForMatch: string;
}

export interface RelatedEntity {
  entity: GraphEntity;
  relationship: RelationshipType;
  distance: number;
  relevanceScore: number;
}

export interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
  searchTime: number; // milliseconds
  query: SearchQuery;
  suggestions?: SearchSuggestion[];
  facets?: SearchFacet[];
  debug?: SearchDebugInfo;
}

export interface SearchSuggestion {
  type: 'correction' | 'alternative' | 'expansion';
  suggestion: string;
  confidence: number;
}

export interface SearchFacet {
  field: string;
  values: FacetValue[];
}

export interface FacetValue {
  value: string;
  count: number;
  selected: boolean;
}

export interface SearchDebugInfo {
  queryAnalysis: string[];
  graphQueries: string[];
  executionSteps: string[];
  performanceMetrics: Record<string, number>;
}

// Advanced Search Engine
export class AdvancedSearchEngine {
  private config: SearchConfig;
  private graphService: CatalogGraphService;
  private semanticEngine?: SemanticSearchEngine;
  private fuzzyMatcher: FuzzyMatcher;
  private searchCache: Map<string, { result: SearchResponse; expiry: number }>;

  constructor(config: SearchConfig, graphService: CatalogGraphService) {
    this.config = config;
    this.graphService = graphService;
    this.fuzzyMatcher = new FuzzyMatcher();
    this.searchCache = new Map();

    if (config.enableSemanticSearch) {
      this.semanticEngine = new SemanticSearchEngine();
    }
  }

  // Main search method
  async search(query: SearchQuery): Promise<SearchResponse> {
    const startTime = Date.now();
    
    // Check cache first
    if (this.config.cacheResults) {
      const cached = this.getCachedResult(query);
      if (cached) {
        return cached;
      }
    }

    console.log('Executing advanced search:', query.text);

    try {
      // Parse and analyze the query
      const analyzedQuery = await this.analyzeQuery(query);
      
      // Execute different search strategies
      const searchResults: SearchResult[] = [];
      
      // 1. Direct entity search
      if (query.searchTypes.includes(SearchType.ENTITY_NAME) || 
          query.searchTypes.includes(SearchType.ENTITY_DESCRIPTION)) {
        const directResults = await this.executeDirectSearch(analyzedQuery);
        searchResults.push(...directResults);
      }

      // 2. Metadata and tag search
      if (query.searchTypes.includes(SearchType.METADATA_SEARCH) ||
          query.searchTypes.includes(SearchType.TAG_SEARCH)) {
        const metadataResults = await this.executeMetadataSearch(analyzedQuery);
        searchResults.push(...metadataResults);
      }

      // 3. Graph traversal search
      if (query.searchTypes.includes(SearchType.GRAPH_TRAVERSAL) && 
          query.graphTraversal.enabled) {
        const graphResults = await this.executeGraphTraversalSearch(analyzedQuery);
        searchResults.push(...graphResults);
      }

      // 4. Semantic search
      if (query.searchTypes.includes(SearchType.SEMANTIC_SEARCH) && 
          this.config.enableSemanticSearch && this.semanticEngine) {
        const semanticResults = await this.semanticEngine.search(analyzedQuery);
        searchResults.push(...semanticResults);
      }

      // 5. Health and compliance search
      const specialResults = await this.executeSpecializedSearch(analyzedQuery);
      searchResults.push(...specialResults);

      // Deduplicate and merge results
      const mergedResults = this.deduplicateResults(searchResults);

      // Rank and score results
      const rankedResults = await this.rankResults(mergedResults, analyzedQuery);

      // Apply filters
      const filteredResults = this.applyFilters(rankedResults, query.filters);

      // Apply sorting and pagination
      const sortedResults = this.applySorting(filteredResults, query.sorting);
      const paginatedResults = this.applyPagination(sortedResults, query.pagination);

      // Generate suggestions and facets
      const suggestions = await this.generateSuggestions(analyzedQuery, filteredResults);
      const facets = this.generateFacets(filteredResults);

      const response: SearchResponse = {
        results: paginatedResults,
        totalCount: filteredResults.length,
        searchTime: Date.now() - startTime,
        query,
        suggestions,
        facets
      };

      // Cache the result
      if (this.config.cacheResults) {
        this.cacheResult(query, response);
      }

      console.log(`Search completed in ${response.searchTime}ms, found ${response.totalCount} results`);
      return response;

    } catch (error) {
      console.error('Search execution failed:', error);
      return {
        results: [],
        totalCount: 0,
        searchTime: Date.now() - startTime,
        query,
        suggestions: [{
          type: 'correction',
          suggestion: 'Try a simpler search term',
          confidence: 0.5
        }]
      };
    }
  }

  // Query Analysis
  private async analyzeQuery(query: SearchQuery): Promise<AnalyzedQuery> {
    const tokens = this.tokenizeQuery(query.text);
    const keywords = this.extractKeywords(tokens);
    const entityTypes = this.detectEntityTypes(tokens);
    const intent = this.detectSearchIntent(tokens);

    return {
      originalQuery: query,
      tokens,
      keywords,
      detectedEntityTypes: entityTypes,
      searchIntent: intent,
      expandedTerms: await this.expandTerms(keywords)
    };
  }

  private tokenizeQuery(text: string): string[] {
    // Smart tokenization that handles technical terms
    return text.toLowerCase()
      .split(/[\s,\-_\.]+/)
      .filter(token => token.length > 1);
  }

  private extractKeywords(tokens: string[]): string[] {
    // Remove stop words and extract meaningful keywords
    const stopWords = new Set(['the', 'is', 'at', 'which', 'on', 'and', 'or', 'but']);
    return tokens.filter(token => !stopWords.has(token));
  }

  private detectEntityTypes(tokens: string[]): EntityType[] {
    const typeKeywords: Record<string, EntityType> = {
      'service': EntityType.SERVICE,
      'api': EntityType.API,
      'database': EntityType.DATABASE,
      'website': EntityType.WEBSITE,
      'system': EntityType.SYSTEM,
      'domain': EntityType.DOMAIN,
      'resource': EntityType.RESOURCE
    };

    const detectedTypes: EntityType[] = [];
    for (const token of tokens) {
      if (typeKeywords[token]) {
        detectedTypes.push(typeKeywords[token]);
      }
    }

    return detectedTypes;
  }

  private detectSearchIntent(tokens: string[]): SearchIntent {
    if (tokens.some(t => ['health', 'status', 'up', 'down', 'error'].includes(t))) {
      return SearchIntent.HEALTH_INQUIRY;
    }
    if (tokens.some(t => ['depends', 'dependency', 'uses', 'calls'].includes(t))) {
      return SearchIntent.DEPENDENCY_INQUIRY;
    }
    if (tokens.some(t => ['owner', 'team', 'maintainer'].includes(t))) {
      return SearchIntent.OWNERSHIP_INQUIRY;
    }
    return SearchIntent.GENERAL_SEARCH;
  }

  private async expandTerms(keywords: string[]): Promise<string[]> {
    // Expand terms with synonyms and related concepts
    const expanded = [...keywords];
    
    const synonyms: Record<string, string[]> = {
      'api': ['endpoint', 'service', 'interface'],
      'database': ['db', 'storage', 'data'],
      'service': ['application', 'app', 'microservice'],
      'system': ['platform', 'infrastructure']
    };

    for (const keyword of keywords) {
      if (synonyms[keyword]) {
        expanded.push(...synonyms[keyword]);
      }
    }

    return expanded;
  }

  // Direct Entity Search
  private async executeDirectSearch(analyzedQuery: AnalyzedQuery): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    
    // Search by name
    for (const keyword of analyzedQuery.keywords) {
      const nameMatches = await this.searchByName(keyword);
      results.push(...nameMatches);
    }

    // Search by description
    for (const keyword of analyzedQuery.keywords) {
      const descMatches = await this.searchByDescription(keyword);
      results.push(...descMatches);
    }

    return results;
  }

  private async searchByName(keyword: string): Promise<SearchResult[]> {
    // Implementation would use graph database query
    // For now, return mock results
    return [];
  }

  private async searchByDescription(keyword: string): Promise<SearchResult[]> {
    // Implementation would search entity descriptions
    return [];
  }

  // Metadata Search
  private async executeMetadataSearch(analyzedQuery: AnalyzedQuery): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    
    // Search in labels, annotations, and custom metadata
    for (const keyword of analyzedQuery.expandedTerms) {
      const metadataMatches = await this.searchMetadata(keyword);
      results.push(...metadataMatches);
    }

    return results;
  }

  private async searchMetadata(keyword: string): Promise<SearchResult[]> {
    // Search through entity metadata fields
    return [];
  }

  // Graph Traversal Search
  private async executeGraphTraversalSearch(analyzedQuery: AnalyzedQuery): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const traversalOptions = analyzedQuery.originalQuery.graphTraversal;

    // First, find initial entities matching the query
    const seedEntities = await this.findSeedEntities(analyzedQuery);

    // Then traverse the graph from these seed entities
    for (const seedEntity of seedEntities) {
      const traversalResults = await this.traverseFromEntity(
        seedEntity,
        analyzedQuery,
        traversalOptions
      );
      results.push(...traversalResults);
    }

    return results;
  }

  private async findSeedEntities(analyzedQuery: AnalyzedQuery): Promise<GraphEntity[]> {
    // Find entities that partially match the query to use as starting points
    return [];
  }

  private async traverseFromEntity(
    seedEntity: GraphEntity,
    analyzedQuery: AnalyzedQuery,
    options: GraphTraversalOptions
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const visited = new Set<string>();
    const queue: { entity: GraphEntity; distance: number; path: string[] }[] = [
      { entity: seedEntity, distance: 0, path: [seedEntity.id] }
    ];

    while (queue.length > 0 && visited.size < 1000) { // Prevent infinite traversal
      const { entity, distance, path } = queue.shift()!;
      
      if (visited.has(entity.id) || distance > options.maxDepth) {
        continue;
      }
      
      visited.add(entity.id);

      // Check if this entity matches the query
      const matchScore = this.calculateEntityMatch(entity, analyzedQuery);
      if (matchScore > 0.3) { // Threshold for relevance
        results.push({
          entity,
          score: matchScore * (options.weightByDistance ? 1 / (distance + 1) : 1),
          matchedFields: this.getMatchedFields(entity, analyzedQuery),
          highlights: this.generateHighlights(entity, analyzedQuery),
          context: {
            matchType: SearchType.GRAPH_TRAVERSAL,
            distance,
            relationshipPath: path,
            reasonForMatch: `Found through graph traversal (distance: ${distance})`
          }
        });
      }

      // Add connected entities to queue
      if (distance < options.maxDepth) {
        const relatedEntities = await this.getRelatedEntities(
          entity.id,
          options.relationshipTypes,
          options.includeReverse
        );
        
        for (const related of relatedEntities) {
          if (!visited.has(related.id)) {
            queue.push({
              entity: related,
              distance: distance + 1,
              path: [...path, related.id]
            });
          }
        }
      }
    }

    return results;
  }

  // Specialized Search (Health, Compliance, etc.)
  private async executeSpecializedSearch(analyzedQuery: AnalyzedQuery): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    // Health status search
    if (analyzedQuery.searchIntent === SearchIntent.HEALTH_INQUIRY) {
      const healthResults = await this.searchByHealthStatus(analyzedQuery);
      results.push(...healthResults);
    }

    // Compliance search
    if (analyzedQuery.originalQuery.searchTypes.includes(SearchType.COMPLIANCE_SEARCH)) {
      const complianceResults = await this.searchByCompliance(analyzedQuery);
      results.push(...complianceResults);
    }

    return results;
  }

  private async searchByHealthStatus(analyzedQuery: AnalyzedQuery): Promise<SearchResult[]> {
    // Search entities by health status
    return [];
  }

  private async searchByCompliance(analyzedQuery: AnalyzedQuery): Promise<SearchResult[]> {
    // Search entities by compliance status
    return [];
  }

  // Result Processing
  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Map<string, SearchResult>();
    
    for (const result of results) {
      const existing = seen.get(result.entity.id);
      if (!existing || result.score > existing.score) {
        seen.set(result.entity.id, result);
      }
    }
    
    return Array.from(seen.values());
  }

  private async rankResults(results: SearchResult[], analyzedQuery: AnalyzedQuery): Promise<SearchResult[]> {
    // Apply ranking algorithm using configured weights
    const weights = this.config.rankingWeights;
    
    for (const result of results) {
      let finalScore = 0;
      
      // Name match weight
      if (result.matchedFields.includes('name')) {
        finalScore += result.score * weights.nameMatch;
      }
      
      // Description match weight
      if (result.matchedFields.includes('description')) {
        finalScore += result.score * weights.descriptionMatch;
      }
      
      // Health status boost
      if (result.entity.status.health === HealthState.HEALTHY) {
        finalScore += weights.healthStatus;
      }
      
      // Recent activity boost
      const daysSinceUpdate = (Date.now() - result.entity.metadata.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate < 7) {
        finalScore += weights.recentActivity;
      }
      
      result.score = Math.min(100, finalScore);
    }
    
    return results.sort((a, b) => b.score - a.score);
  }

  // Helper methods
  private calculateEntityMatch(entity: GraphEntity, analyzedQuery: AnalyzedQuery): number {
    let score = 0;
    const keywords = analyzedQuery.expandedTerms;
    
    // Name matching
    const nameMatch = this.fuzzyMatcher.match(entity.name.toLowerCase(), keywords);
    score += nameMatch * 0.4;
    
    // Description matching
    if (entity.description) {
      const descMatch = this.fuzzyMatcher.match(entity.description.toLowerCase(), keywords);
      score += descMatch * 0.3;
    }
    
    // Type matching
    if (analyzedQuery.detectedEntityTypes.includes(entity.type)) {
      score += 0.2;
    }
    
    // Metadata matching
    const metadataText = JSON.stringify(entity.metadata).toLowerCase();
    const metadataMatch = this.fuzzyMatcher.match(metadataText, keywords);
    score += metadataMatch * 0.1;
    
    return Math.min(1, score);
  }

  private getMatchedFields(entity: GraphEntity, analyzedQuery: AnalyzedQuery): string[] {
    const fields: string[] = [];
    const keywords = analyzedQuery.expandedTerms;
    
    if (this.fuzzyMatcher.match(entity.name.toLowerCase(), keywords) > 0.3) {
      fields.push('name');
    }
    
    if (entity.description && this.fuzzyMatcher.match(entity.description.toLowerCase(), keywords) > 0.3) {
      fields.push('description');
    }
    
    return fields;
  }

  private generateHighlights(entity: GraphEntity, analyzedQuery: AnalyzedQuery): SearchHighlight[] {
    // Generate text highlights for matched fields
    return [];
  }

  private async getRelatedEntities(
    entityId: string,
    relationshipTypes?: RelationshipType[],
    includeReverse: boolean = false
  ): Promise<GraphEntity[]> {
    // Get entities connected to this entity
    return [];
  }

  private applyFilters(results: SearchResult[], filters: SearchFilter[]): SearchResult[] {
    if (filters.length === 0) return results;
    
    return results.filter(result => {
      return filters.every(filter => this.evaluateFilter(result.entity, filter));
    });
  }

  private evaluateFilter(entity: GraphEntity, filter: SearchFilter): boolean {
    const value = this.getEntityFieldValue(entity, filter.field);
    
    switch (filter.operator) {
      case 'equals':
        return value === filter.value;
      case 'contains':
        return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
      case 'startsWith':
        return String(value).toLowerCase().startsWith(String(filter.value).toLowerCase());
      case 'in':
        return filter.values?.includes(value) || false;
      default:
        return true;
    }
  }

  private getEntityFieldValue(entity: GraphEntity, field: string): any {
    const parts = field.split('.');
    let value: any = entity;
    
    for (const part of parts) {
      value = value?.[part];
      if (value === undefined) break;
    }
    
    return value;
  }

  private applySorting(results: SearchResult[], sorting: SortingOptions): SearchResult[] {
    return results.sort((a, b) => {
      const aVal = this.getEntityFieldValue(a.entity, sorting.field);
      const bVal = this.getEntityFieldValue(b.entity, sorting.field);
      
      if (sorting.direction === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });
  }

  private applyPagination(results: SearchResult[], pagination: PaginationOptions): SearchResult[] {
    const start = pagination.offset;
    const end = start + pagination.limit;
    return results.slice(start, end);
  }

  private async generateSuggestions(
    analyzedQuery: AnalyzedQuery,
    results: SearchResult[]
  ): Promise<SearchSuggestion[]> {
    const suggestions: SearchSuggestion[] = [];
    
    // If few results, suggest alternatives
    if (results.length < 5) {
      suggestions.push({
        type: 'alternative',
        suggestion: 'Try broader search terms',
        confidence: 0.7
      });
    }
    
    return suggestions;
  }

  private generateFacets(results: SearchResult[]): SearchFacet[] {
    const facets: SearchFacet[] = [];
    
    // Entity type facet
    const typeCount = new Map<string, number>();
    for (const result of results) {
      const type = result.entity.type;
      typeCount.set(type, (typeCount.get(type) || 0) + 1);
    }
    
    facets.push({
      field: 'entityType',
      values: Array.from(typeCount.entries()).map(([value, count]) => ({
        value,
        count,
        selected: false
      }))
    });
    
    return facets;
  }

  // Cache management
  private getCachedResult(query: SearchQuery): SearchResponse | null {
    const key = this.getCacheKey(query);
    const cached = this.searchCache.get(key);
    
    if (cached && cached.expiry > Date.now()) {
      return cached.result;
    }
    
    if (cached) {
      this.searchCache.delete(key);
    }
    
    return null;
  }

  private cacheResult(query: SearchQuery, response: SearchResponse): void {
    const key = this.getCacheKey(query);
    this.searchCache.set(key, {
      result: response,
      expiry: Date.now() + (this.config.cacheTTL * 1000)
    });
  }

  private getCacheKey(query: SearchQuery): string {
    return JSON.stringify({
      text: query.text,
      filters: query.filters,
      searchTypes: query.searchTypes
    });
  }
}

// Supporting Classes
export class SemanticSearchEngine {
  async search(analyzedQuery: AnalyzedQuery): Promise<SearchResult[]> {
    // Semantic search implementation using embeddings
    return [];
  }
}

export class FuzzyMatcher {
  match(text: string, keywords: string[]): number {
    // Fuzzy matching implementation
    let totalScore = 0;
    let matches = 0;
    
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        totalScore += 1;
        matches++;
      } else {
        // Simple fuzzy matching based on character similarity
        const similarity = this.calculateSimilarity(text, keyword);
        if (similarity > 0.7) {
          totalScore += similarity;
          matches++;
        }
      }
    }
    
    return matches > 0 ? totalScore / keywords.length : 0;
  }
  
  private calculateSimilarity(str1: string, str2: string): number {
    // Levenshtein distance-based similarity
    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 1;
    
    const distance = this.levenshteinDistance(str1, str2);
    return 1 - distance / maxLen;
  }
  
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }
    
    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }
}

// Additional Types
export interface AnalyzedQuery {
  originalQuery: SearchQuery;
  tokens: string[];
  keywords: string[];
  detectedEntityTypes: EntityType[];
  searchIntent: SearchIntent;
  expandedTerms: string[];
}

export enum SearchIntent {
  GENERAL_SEARCH = 'GENERAL_SEARCH',
  HEALTH_INQUIRY = 'HEALTH_INQUIRY',
  DEPENDENCY_INQUIRY = 'DEPENDENCY_INQUIRY',
  OWNERSHIP_INQUIRY = 'OWNERSHIP_INQUIRY',
  COMPLIANCE_INQUIRY = 'COMPLIANCE_INQUIRY'
}