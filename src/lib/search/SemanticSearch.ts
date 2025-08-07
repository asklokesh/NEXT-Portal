/**
 * Comprehensive Semantic Search Engine
 * 
 * Provides advanced search capabilities with:
 * - Natural Language Processing (NLP) tokenization
 * - Synonym mapping for technical terminology
 * - Fuzzy matching algorithms
 * - Query intent recognition
 * - Search result ranking and scoring
 * - Complex query parsing and execution
 */

import Fuse from 'fuse.js';
import type { Entity } from '@/services/backstage/types/entities';

// Types
export interface SearchQuery {
  text: string;
  filters: SearchFilters;
  intent: QueryIntent;
  tokens: ParsedToken[];
}

export interface SearchFilters {
  kind?: string[];
  owner?: string[];
  tags?: string[];
  lifecycle?: string[];
  namespace?: string[];
  technology?: string[];
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  healthScore?: {
    min?: number;
    max?: number;
  };
}

export interface QueryIntent {
  type: 'search' | 'filter' | 'list' | 'find' | 'show' | 'get';
  category: 'service' | 'component' | 'api' | 'resource' | 'template' | 'user' | 'team' | 'general';
  modifiers: string[];
  negations: string[];
}

export interface ParsedToken {
  text: string;
  type: 'keyword' | 'filter' | 'value' | 'operator' | 'quoted' | 'technical_term';
  category?: string;
  synonyms?: string[];
  weight: number;
}

export interface SearchResult<T = Entity> {
  item: T;
  score: number;
  matches: SearchMatch[];
  highlights: SearchHighlight[];
  relevanceFactors: RelevanceFactor[];
}

export interface SearchMatch {
  field: string;
  value: string;
  indices: [number, number][];
  score: number;
}

export interface SearchHighlight {
  field: string;
  value: string;
  highlights: string[];
}

export interface RelevanceFactor {
  factor: string;
  weight: number;
  contribution: number;
  description: string;
}

export interface SearchSuggestion {
  query: string;
  type: 'completion' | 'correction' | 'related' | 'filter';
  score: number;
  category?: string;
}

export interface SearchHistory {
  query: string;
  timestamp: Date;
  resultCount: number;
  filters: SearchFilters;
}

// Configuration
export interface SemanticSearchConfig {
  fuzzyThreshold: number;
  maxResults: number;
  minQueryLength: number;
  enableSynonyms: boolean;
  enableIntentRecognition: boolean;
  boostFactors: {
    exactMatch: number;
    partialMatch: number;
    fuzzyMatch: number;
    synonymMatch: number;
    ownerMatch: number;
    tagMatch: number;
    recentlyModified: number;
    highHealth: number;
  };
}

// Synonym mappings for technical terms
const TECHNICAL_SYNONYMS: Record<string, string[]> = {
  // Languages & Frameworks
  'javascript': ['js', 'node', 'nodejs', 'react', 'vue', 'angular'],
  'typescript': ['ts', 'tsx'],
  'python': ['py', 'django', 'flask', 'fastapi'],
  'java': ['jvm', 'spring', 'spring boot', 'maven', 'gradle'],
  'go': ['golang'],
  'c#': ['csharp', 'dotnet', '.net'],
  'php': ['laravel', 'symfony'],
  'ruby': ['rails', 'ruby on rails'],
  
  // Databases
  'database': ['db', 'data store', 'storage'],
  'postgresql': ['postgres', 'psql'],
  'mysql': ['mariadb'],
  'mongodb': ['mongo', 'nosql'],
  'redis': ['cache', 'caching'],
  'elasticsearch': ['elastic', 'search engine'],
  
  // Infrastructure
  'kubernetes': ['k8s', 'container orchestration'],
  'docker': ['container', 'containerization'],
  'aws': ['amazon web services', 'cloud'],
  'gcp': ['google cloud platform', 'google cloud'],
  'azure': ['microsoft azure'],
  'terraform': ['infrastructure as code', 'iac'],
  'ansible': ['configuration management'],
  
  // Architectures & Patterns
  'microservice': ['microservices', 'service', 'api'],
  'rest': ['restful', 'api', 'http api'],
  'graphql': ['gql', 'graph api'],
  'grpc': ['rpc', 'protocol buffers'],
  'event driven': ['events', 'messaging', 'pubsub'],
  
  // Development & DevOps
  'ci/cd': ['continuous integration', 'continuous deployment', 'pipeline'],
  'monitoring': ['observability', 'metrics', 'alerting'],
  'logging': ['logs', 'audit trail'],
  'testing': ['tests', 'qa', 'quality assurance'],
  'deployment': ['deploy', 'release'],
  
  // Business Terms
  'frontend': ['front-end', 'ui', 'user interface', 'client'],
  'backend': ['back-end', 'server', 'api'],
  'fullstack': ['full-stack', 'full stack'],
  'mobile': ['ios', 'android', 'app'],
  'web': ['website', 'webapp', 'web application'],
};

// Query intent patterns
const INTENT_PATTERNS = {
  search: [
    /^(search|find|look for|get|show me)/i,
    /\b(contains?|includes?|has|with)\b/i,
  ],
  filter: [
    /^(filter|show only|list|display)/i,
    /\b(where|that|which)\b/i,
  ],
  list: [
    /^(list all|show all|get all)/i,
    /\ball\b.*\b(services?|components?|apis?)/i,
  ],
  show: [
    /^(show|display)/i,
  ],
};

const CATEGORY_PATTERNS = {
  service: [
    /\b(services?|microservices?)\b/i,
    /\bowned by\b/i,
  ],
  component: [
    /\b(components?|libraries?|packages?)\b/i,
  ],
  api: [
    /\b(apis?|endpoints?|rest|graphql|grpc)\b/i,
  ],
  resource: [
    /\b(resources?|infrastructure|databases?)\b/i,
  ],
  team: [
    /\b(teams?|groups?|owned by|belongs to)\b/i,
  ],
};

// Filter patterns for natural language queries
const FILTER_PATTERNS = {
  owner: [
    /\bowned by\s+([^\s]+)/i,
    /\bowner[:\s]+([^\s]+)/i,
    /\bby\s+([^\s]+)(\s+team)?/i,
  ],
  kind: [
    /\bkind[:\s]+([^\s]+)/i,
    /\btype[:\s]+([^\s]+)/i,
  ],
  tag: [
    /\btagged?\s+([^\s]+)/i,
    /\btags?[:\s]+([^\s,]+)/i,
    /\bwith\s+tag\s+([^\s]+)/i,
  ],
  lifecycle: [
    /\blifecycle[:\s]+([^\s]+)/i,
    /\bstage[:\s]+([^\s]+)/i,
    /\bin\s+(production|staging|development|experimental)/i,
  ],
  technology: [
    /\busing\s+([^\s]+)/i,
    /\btechnology[:\s]+([^\s]+)/i,
    /\bbuilt with\s+([^\s]+)/i,
    /\b(nodejs?|python|java|go|rust|typescript)\b/i,
  ],
};

export class SemanticSearch {
  private fuse: Fuse<Entity>;
  private config: SemanticSearchConfig;
  private searchHistory: SearchHistory[] = [];
  private synonymCache: Map<string, string[]> = new Map();

  constructor(entities: Entity[], config?: Partial<SemanticSearchConfig>) {
    this.config = {
      fuzzyThreshold: 0.4,
      maxResults: 50,
      minQueryLength: 1,
      enableSynonyms: true,
      enableIntentRecognition: true,
      boostFactors: {
        exactMatch: 2.0,
        partialMatch: 1.5,
        fuzzyMatch: 1.0,
        synonymMatch: 1.3,
        ownerMatch: 1.2,
        tagMatch: 1.1,
        recentlyModified: 1.1,
        highHealth: 1.05,
      },
      ...config,
    };

    this.fuse = new Fuse(entities, {
      includeScore: true,
      includeMatches: true,
      threshold: this.config.fuzzyThreshold,
      ignoreLocation: true,
      keys: [
        { name: 'metadata.name', weight: 3.0 },
        { name: 'metadata.title', weight: 2.5 },
        { name: 'metadata.description', weight: 2.0 },
        { name: 'metadata.tags', weight: 1.5 },
        { name: 'spec.owner', weight: 1.3 },
        { name: 'spec.type', weight: 1.2 },
        { name: 'spec.lifecycle', weight: 1.1 },
        { name: 'kind', weight: 1.4 },
        { name: 'metadata.annotations', weight: 0.8 },
        { name: 'spec.definition', weight: 0.7 },
      ],
    });

    this.initializeSynonymCache();
  }

  /**
   * Update the search index with new entities
   */
  updateIndex(entities: Entity[]): void {
    this.fuse.setCollection(entities);
  }

  /**
   * Perform comprehensive semantic search
   */
  search(queryText: string, additionalFilters?: SearchFilters): SearchResult[] {
    if (queryText.length < this.config.minQueryLength) {
      return [];
    }

    // Parse and analyze the query
    const parsedQuery = this.parseQuery(queryText, additionalFilters);
    
    // Record search history
    this.recordSearch(queryText, additionalFilters || {});

    // Execute the search
    const results = this.executeSearch(parsedQuery);

    // Apply post-processing and ranking
    return this.rankResults(results, parsedQuery);
  }

  /**
   * Get intelligent search suggestions
   */
  getSuggestions(partialQuery: string, entities: Entity[]): SearchSuggestion[] {
    const suggestions: SearchSuggestion[] = [];

    // Query completion suggestions
    const completions = this.generateCompletions(partialQuery, entities);
    suggestions.push(...completions);

    // Filter suggestions based on available data
    const filterSuggestions = this.generateFilterSuggestions(partialQuery, entities);
    suggestions.push(...filterSuggestions);

    // Related query suggestions from history
    const relatedSuggestions = this.generateRelatedSuggestions(partialQuery);
    suggestions.push(...relatedSuggestions);

    // Sort by relevance score
    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  /**
   * Get search history
   */
  getSearchHistory(): SearchHistory[] {
    return [...this.searchHistory].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Clear search history
   */
  clearHistory(): void {
    this.searchHistory = [];
  }

  /**
   * Parse natural language query into structured format
   */
  private parseQuery(queryText: string, additionalFilters?: SearchFilters): SearchQuery {
    const tokens = this.tokenizeQuery(queryText);
    const intent = this.recognizeIntent(queryText);
    const filters = this.extractFilters(queryText, additionalFilters);

    return {
      text: queryText,
      tokens,
      intent,
      filters,
    };
  }

  /**
   * Tokenize query text with NLP processing
   */
  private tokenizeQuery(text: string): ParsedToken[] {
    const tokens: ParsedToken[] = [];
    
    // Handle quoted phrases
    const quotedPhrases = text.match(/"[^"]+"/g) || [];
    let processedText = text;
    
    quotedPhrases.forEach((phrase, index) => {
      const cleanPhrase = phrase.slice(1, -1); // Remove quotes
      tokens.push({
        text: cleanPhrase,
        type: 'quoted',
        weight: 2.0, // Higher weight for exact phrases
      });
      processedText = processedText.replace(phrase, `__QUOTED_${index}__`);
    });

    // Split remaining text into words
    const words = processedText
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 0 && !word.startsWith('__QUOTED_'));

    words.forEach(word => {
      // Remove common punctuation
      const cleanWord = word.replace(/[^\w\-_.]/g, '');
      if (cleanWord.length === 0) return;

      const token: ParsedToken = {
        text: cleanWord,
        type: 'keyword',
        weight: 1.0,
      };

      // Check if it's a technical term with synonyms
      const synonyms = this.getSynonyms(cleanWord);
      if (synonyms.length > 0) {
        token.type = 'technical_term';
        token.synonyms = synonyms;
        token.weight = 1.3; // Boost technical terms
      }

      // Check for filter patterns
      if (this.isFilterKeyword(cleanWord)) {
        token.type = 'filter';
        token.weight = 1.5;
      }

      tokens.push(token);
    });

    return tokens;
  }

  /**
   * Recognize query intent using pattern matching
   */
  private recognizeIntent(text: string): QueryIntent {
    const intent: QueryIntent = {
      type: 'search',
      category: 'general',
      modifiers: [],
      negations: [],
    };

    // Detect intent type
    for (const [intentType, patterns] of Object.entries(INTENT_PATTERNS)) {
      if (patterns.some(pattern => pattern.test(text))) {
        intent.type = intentType as QueryIntent['type'];
        break;
      }
    }

    // Detect category
    for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
      if (patterns.some(pattern => pattern.test(text))) {
        intent.category = category as QueryIntent['category'];
        break;
      }
    }

    // Extract modifiers and negations
    const negationMatches = text.match(/\b(not|without|exclude|except)\s+(\w+)/gi);
    if (negationMatches) {
      intent.negations = negationMatches.map(match => 
        match.replace(/^(not|without|exclude|except)\s+/i, '').toLowerCase()
      );
    }

    return intent;
  }

  /**
   * Extract filters from natural language query
   */
  private extractFilters(text: string, additionalFilters?: SearchFilters): SearchFilters {
    const filters: SearchFilters = { ...additionalFilters };

    // Extract owner filters
    for (const pattern of FILTER_PATTERNS.owner) {
      const match = text.match(pattern);
      if (match) {
        filters.owner = [...(filters.owner || []), match[1]];
      }
    }

    // Extract kind filters
    for (const pattern of FILTER_PATTERNS.kind) {
      const match = text.match(pattern);
      if (match) {
        filters.kind = [...(filters.kind || []), match[1]];
      }
    }

    // Extract tag filters
    for (const pattern of FILTER_PATTERNS.tag) {
      const match = text.match(pattern);
      if (match) {
        filters.tags = [...(filters.tags || []), match[1]];
      }
    }

    // Extract lifecycle filters
    for (const pattern of FILTER_PATTERNS.lifecycle) {
      const match = text.match(pattern);
      if (match) {
        filters.lifecycle = [...(filters.lifecycle || []), match[1]];
      }
    }

    // Extract technology filters
    for (const pattern of FILTER_PATTERNS.technology) {
      const match = text.match(pattern);
      if (match) {
        filters.technology = [...(filters.technology || []), match[1]];
      }
    }

    return filters;
  }

  /**
   * Execute search with parsed query
   */
  private executeSearch(query: SearchQuery): SearchResult[] {
    const fuseResults = this.fuse.search(query.text);
    
    return fuseResults.map(result => {
      const searchResult: SearchResult = {
        item: result.item,
        score: 1 - (result.score || 0), // Invert Fuse.js score (lower is better)
        matches: result.matches?.map(match => ({
          field: match.key || '',
          value: match.value || '',
          indices: match.indices || [],
          score: 1 - (match.score || 0),
        })) || [],
        highlights: [],
        relevanceFactors: [],
      };

      // Generate highlights
      searchResult.highlights = this.generateHighlights(searchResult, query);
      
      // Calculate relevance factors
      searchResult.relevanceFactors = this.calculateRelevanceFactors(searchResult, query);

      return searchResult;
    });
  }

  /**
   * Rank and score search results
   */
  private rankResults(results: SearchResult[], query: SearchQuery): SearchResult[] {
    return results
      .map(result => {
        // Apply filters
        if (!this.passesFilters(result.item, query.filters)) {
          return null;
        }

        // Calculate enhanced score
        result.score = this.calculateEnhancedScore(result, query);
        
        return result;
      })
      .filter((result): result is SearchResult => result !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.maxResults);
  }

  /**
   * Calculate enhanced scoring with multiple factors
   */
  private calculateEnhancedScore(result: SearchResult, query: SearchQuery): number {
    let score = result.score;
    const factors = this.config.boostFactors;

    // Exact match boost
    const hasExactMatch = result.matches.some(match => 
      match.value.toLowerCase() === query.text.toLowerCase()
    );
    if (hasExactMatch) {
      score *= factors.exactMatch;
    }

    // Partial match boost
    const hasPartialMatch = result.matches.some(match =>
      match.value.toLowerCase().includes(query.text.toLowerCase())
    );
    if (hasPartialMatch && !hasExactMatch) {
      score *= factors.partialMatch;
    }

    // Synonym match boost
    if (this.config.enableSynonyms) {
      const hasSynonymMatch = query.tokens.some(token => 
        token.synonyms?.some(synonym => 
          result.matches.some(match => 
            match.value.toLowerCase().includes(synonym.toLowerCase())
          )
        )
      );
      if (hasSynonymMatch) {
        score *= factors.synonymMatch;
      }
    }

    // Owner match boost
    if (query.filters.owner?.some(owner => 
      result.item.spec?.owner === owner
    )) {
      score *= factors.ownerMatch;
    }

    // Tag match boost
    if (query.filters.tags?.some(tag =>
      result.item.metadata.tags?.includes(tag)
    )) {
      score *= factors.tagMatch;
    }

    // Recently modified boost
    const lastModified = result.item.metadata.annotations?.['backstage.io/managed-by-location'];
    if (lastModified) {
      const daysSinceModified = (Date.now() - new Date(lastModified).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceModified < 30) {
        score *= factors.recentlyModified;
      }
    }

    // Health score boost (if available in extended entity)
    const extendedEntity = result.item as any;
    if (extendedEntity.metrics?.health > 80) {
      score *= factors.highHealth;
    }

    return score;
  }

  /**
   * Generate search result highlights
   */
  private generateHighlights(result: SearchResult, query: SearchQuery): SearchHighlight[] {
    const highlights: SearchHighlight[] = [];

    result.matches.forEach(match => {
      if (!match.value || match.indices.length === 0) return;

      const highlightedValue = this.highlightMatches(match.value, match.indices);
      
      highlights.push({
        field: match.field,
        value: match.value,
        highlights: [highlightedValue],
      });
    });

    return highlights;
  }

  /**
   * Apply highlighting to matched text
   */
  private highlightMatches(text: string, indices: [number, number][]): string {
    let highlighted = text;
    let offset = 0;

    // Sort indices by start position
    const sortedIndices = [...indices].sort((a, b) => a[0] - b[0]);

    sortedIndices.forEach(([start, end]) => {
      const adjustedStart = start + offset;
      const adjustedEnd = end + 1 + offset; // Fuse.js uses inclusive end indices
      
      const before = highlighted.slice(0, adjustedStart);
      const match = highlighted.slice(adjustedStart, adjustedEnd);
      const after = highlighted.slice(adjustedEnd);
      
      highlighted = `${before}<mark>${match}</mark>${after}`;
      offset += 13; // Length of '<mark></mark>'
    });

    return highlighted;
  }

  /**
   * Calculate relevance factors for transparency
   */
  private calculateRelevanceFactors(result: SearchResult, query: SearchQuery): RelevanceFactor[] {
    const factors: RelevanceFactor[] = [];

    // Base score factor
    factors.push({
      factor: 'base_match',
      weight: 1.0,
      contribution: result.score,
      description: 'Base fuzzy matching score',
    });

    // Exact match factor
    const hasExactMatch = result.matches.some(match =>
      match.value.toLowerCase() === query.text.toLowerCase()
    );
    if (hasExactMatch) {
      factors.push({
        factor: 'exact_match',
        weight: this.config.boostFactors.exactMatch,
        contribution: result.score * (this.config.boostFactors.exactMatch - 1),
        description: 'Exact text match found',
      });
    }

    // Field-specific factors
    const nameMatch = result.matches.find(m => m.field.includes('name'));
    if (nameMatch) {
      factors.push({
        factor: 'name_match',
        weight: 1.5,
        contribution: nameMatch.score * 0.5,
        description: 'Match found in entity name',
      });
    }

    return factors;
  }

  /**
   * Check if entity passes all filters
   */
  private passesFilters(entity: Entity, filters: SearchFilters): boolean {
    // Kind filter
    if (filters.kind?.length && !filters.kind.includes(entity.kind)) {
      return false;
    }

    // Owner filter
    if (filters.owner?.length && !filters.owner.includes(entity.spec?.owner || '')) {
      return false;
    }

    // Tags filter
    if (filters.tags?.length) {
      const entityTags = entity.metadata.tags || [];
      if (!filters.tags.some(tag => entityTags.includes(tag))) {
        return false;
      }
    }

    // Lifecycle filter
    if (filters.lifecycle?.length && !filters.lifecycle.includes(entity.spec?.lifecycle || '')) {
      return false;
    }

    // Namespace filter
    if (filters.namespace?.length && !filters.namespace.includes(entity.metadata.namespace || 'default')) {
      return false;
    }

    // Technology filter (check in annotations and tags)
    if (filters.technology?.length) {
      const entityTech = [
        ...(entity.metadata.tags || []),
        ...Object.values(entity.metadata.annotations || {}),
      ];
      if (!filters.technology.some(tech => 
        entityTech.some(item => item.toLowerCase().includes(tech.toLowerCase()))
      )) {
        return false;
      }
    }

    return true;
  }

  /**
   * Generate query completions
   */
  private generateCompletions(partialQuery: string, entities: Entity[]): SearchSuggestion[] {
    const suggestions: SearchSuggestion[] = [];
    const words = partialQuery.toLowerCase().split(/\s+/);
    const lastWord = words[words.length - 1] || '';

    // Entity name completions
    entities.forEach(entity => {
      const name = entity.metadata.name.toLowerCase();
      if (name.startsWith(lastWord) && name !== lastWord) {
        const completion = words.slice(0, -1).concat([entity.metadata.name]).join(' ');
        suggestions.push({
          query: completion,
          type: 'completion',
          score: 0.9,
          category: entity.kind,
        });
      }
    });

    // Technical term completions
    Object.keys(TECHNICAL_SYNONYMS).forEach(term => {
      if (term.startsWith(lastWord) && term !== lastWord) {
        const completion = words.slice(0, -1).concat([term]).join(' ');
        suggestions.push({
          query: completion,
          type: 'completion',
          score: 0.8,
          category: 'technology',
        });
      }
    });

    return suggestions;
  }

  /**
   * Generate filter suggestions
   */
  private generateFilterSuggestions(partialQuery: string, entities: Entity[]): SearchSuggestion[] {
    const suggestions: SearchSuggestion[] = [];

    // Owner suggestions
    const owners = new Set(entities.map(e => e.spec?.owner).filter(Boolean));
    owners.forEach(owner => {
      if (owner && owner.toLowerCase().includes(partialQuery.toLowerCase())) {
        suggestions.push({
          query: `owned by ${owner}`,
          type: 'filter',
          score: 0.7,
          category: 'owner',
        });
      }
    });

    // Kind suggestions
    const kinds = new Set(entities.map(e => e.kind));
    kinds.forEach(kind => {
      if (kind.toLowerCase().includes(partialQuery.toLowerCase())) {
        suggestions.push({
          query: `kind:${kind}`,
          type: 'filter',
          score: 0.7,
          category: 'kind',
        });
      }
    });

    return suggestions;
  }

  /**
   * Generate related suggestions from search history
   */
  private generateRelatedSuggestions(partialQuery: string): SearchSuggestion[] {
    const suggestions: SearchSuggestion[] = [];
    
    this.searchHistory.forEach(entry => {
      if (entry.query.toLowerCase().includes(partialQuery.toLowerCase()) &&
          entry.query !== partialQuery) {
        suggestions.push({
          query: entry.query,
          type: 'related',
          score: 0.6,
        });
      }
    });

    return suggestions;
  }

  /**
   * Initialize synonym cache
   */
  private initializeSynonymCache(): void {
    Object.entries(TECHNICAL_SYNONYMS).forEach(([term, synonyms]) => {
      this.synonymCache.set(term, synonyms);
      // Also map synonyms back to the main term
      synonyms.forEach(synonym => {
        const existing = this.synonymCache.get(synonym) || [];
        this.synonymCache.set(synonym, [...existing, term]);
      });
    });
  }

  /**
   * Get synonyms for a term
   */
  private getSynonyms(term: string): string[] {
    return this.synonymCache.get(term.toLowerCase()) || [];
  }

  /**
   * Check if word is a filter keyword
   */
  private isFilterKeyword(word: string): boolean {
    const filterKeywords = ['owner', 'kind', 'type', 'tag', 'lifecycle', 'namespace'];
    return filterKeywords.includes(word.toLowerCase());
  }

  /**
   * Record search in history
   */
  private recordSearch(query: string, filters: SearchFilters): void {
    this.searchHistory.push({
      query,
      timestamp: new Date(),
      resultCount: 0, // Will be updated after search
      filters,
    });

    // Keep only last 100 searches
    if (this.searchHistory.length > 100) {
      this.searchHistory = this.searchHistory.slice(-100);
    }
  }
}

/**
 * Factory function to create SemanticSearch instance
 */
export function createSemanticSearch(
  entities: Entity[], 
  config?: Partial<SemanticSearchConfig>
): SemanticSearch {
  return new SemanticSearch(entities, config);
}

/**
 * Utility function to extract searchable text from entity
 */
export function extractSearchableText(entity: Entity): string {
  const searchableFields = [
    entity.metadata.name,
    entity.metadata.title,
    entity.metadata.description,
    entity.kind,
    entity.spec?.type,
    entity.spec?.owner,
    entity.spec?.lifecycle,
    ...(entity.metadata.tags || []),
    ...Object.values(entity.metadata.annotations || {}),
  ];

  return searchableFields
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/**
 * Utility function to highlight text matches
 */
export function highlightText(text: string, query: string): string {
  if (!query || !text) return text;
  
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}