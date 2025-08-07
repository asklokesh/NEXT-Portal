/**
 * Advanced Search Service with Elasticsearch
 * 
 * Provides comprehensive search functionality with:
 * - Complex query building with filters and facets
 * - Search suggestions and autocomplete
 * - Search result ranking and relevance tuning
 * - Search analytics and tracking
 * - Real-time search as you type
 */

import { getElasticsearchClient, ElasticsearchClient, SearchHit, SearchAggregation } from './elasticsearch';
import type { SearchFilters } from './SemanticSearch';

// Search types
export interface AdvancedSearchQuery {
  query: string;
  filters?: SearchFilters;
  facets?: string[];
  sortBy?: SortOption[];
  from?: number;
  size?: number;
  highlight?: boolean;
  includeAggregations?: boolean;
  typoTolerance?: TypoToleranceConfig;
  boosts?: SearchBoosts;
  searchMode?: 'simple' | 'advanced' | 'fuzzy' | 'semantic';
}

export interface SortOption {
  field: string;
  direction: 'asc' | 'desc';
  mode?: 'min' | 'max' | 'avg' | 'sum';
}

export interface TypoToleranceConfig {
  enabled: boolean;
  fuzziness: 'AUTO' | '0' | '1' | '2';
  prefixLength: number;
  maxExpansions: number;
}

export interface SearchBoosts {
  nameBoost: number;
  titleBoost: number;
  descriptionBoost: number;
  tagBoost: number;
  ownerBoost: number;
  recentnessBoost: number;
  popularityBoost: number;
}

export interface AdvancedSearchResult {
  hits: SearchResultItem[];
  total: number;
  took: number;
  maxScore: number;
  aggregations: SearchFacets;
  suggestions?: SearchSuggestion[];
  relatedQueries?: string[];
}

export interface SearchResultItem {
  id: string;
  title: string;
  description?: string;
  kind: string;
  owner?: string;
  tags: string[];
  url?: string;
  score: number;
  highlights: Record<string, string[]>;
  metadata: Record<string, any>;
  source: any;
}

export interface SearchFacets {
  kinds: FacetBucket[];
  owners: FacetBucket[];
  tags: FacetBucket[];
  technologies: FacetBucket[];
  lifecycles: FacetBucket[];
  healthScores: NumericFacet;
  lastUpdated: DateFacet;
}

export interface FacetBucket {
  key: string;
  count: number;
  selected?: boolean;
}

export interface NumericFacet {
  min: number;
  max: number;
  avg: number;
  buckets: Array<{
    from: number;
    to: number;
    count: number;
  }>;
}

export interface DateFacet {
  buckets: Array<{
    key: string;
    from: Date;
    to: Date;
    count: number;
  }>;
}

export interface SearchSuggestion {
  text: string;
  type: 'completion' | 'correction' | 'filter' | 'related';
  score: number;
  metadata?: Record<string, any>;
}

export interface SearchAnalytics {
  query: string;
  timestamp: Date;
  resultCount: number;
  clickedResults: string[];
  filters: SearchFilters;
  userId?: string;
  sessionId: string;
  searchTime: number;
}

// Default configurations
const DEFAULT_SEARCH_CONFIG = {
  defaultSize: 20,
  maxSize: 100,
  typoTolerance: {
    enabled: true,
    fuzziness: 'AUTO',
    prefixLength: 2,
    maxExpansions: 50
  } as TypoToleranceConfig,
  boosts: {
    nameBoost: 3.0,
    titleBoost: 2.5,
    descriptionBoost: 1.0,
    tagBoost: 1.5,
    ownerBoost: 1.2,
    recentnessBoost: 1.1,
    popularityBoost: 1.3
  } as SearchBoosts,
  facetSize: 20,
  suggestionSize: 10
};

export class AdvancedSearchService {
  private client: ElasticsearchClient;
  private searchAnalytics: SearchAnalytics[] = [];

  constructor() {
    this.client = getElasticsearchClient();
  }

  /**
   * Perform advanced search across all indices
   */
  async search(searchQuery: AdvancedSearchQuery): Promise<AdvancedSearchResult> {
    const startTime = Date.now();

    try {
      // Build Elasticsearch query
      const esQuery = this.buildElasticsearchQuery(searchQuery);
      
      // Execute multi-index search
      const indices = this.getSearchIndices(searchQuery);
      const response = await this.client.search(indices, esQuery, {
        from: searchQuery.from || 0,
        size: Math.min(searchQuery.size || DEFAULT_SEARCH_CONFIG.defaultSize, DEFAULT_SEARCH_CONFIG.maxSize),
        highlight: this.buildHighlightConfig(searchQuery.highlight),
        aggs: searchQuery.includeAggregations ? this.buildAggregations(searchQuery) : undefined
      });

      // Process results
      const result: AdvancedSearchResult = {
        hits: this.processSearchHits(response.hits),
        total: response.total,
        took: response.took,
        maxScore: response.maxScore,
        aggregations: this.processAggregations(response.aggregations || {}),
        suggestions: searchQuery.query ? await this.getSuggestions(searchQuery.query) : [],
        relatedQueries: await this.getRelatedQueries(searchQuery.query)
      };

      // Track analytics
      this.trackSearch({
        query: searchQuery.query,
        timestamp: new Date(),
        resultCount: result.total,
        clickedResults: [],
        filters: searchQuery.filters || {},
        sessionId: this.generateSessionId(),
        searchTime: Date.now() - startTime
      });

      return result;
    } catch (error) {
      console.error('Advanced search failed:', error);
      throw error;
    }
  }

  /**
   * Get search suggestions for autocomplete
   */
  async getSuggestions(query: string, maxSuggestions = 10): Promise<SearchSuggestion[]> {
    if (query.length < 2) return [];

    const suggestions: SearchSuggestion[] = [];

    try {
      // Get completion suggestions from all indices
      const indices = ['idp-catalog', 'idp-docs', 'idp-templates'];
      
      for (const index of indices) {
        const completions = await this.client.suggest(index, 'name.suggest', query, maxSuggestions);
        
        completions.forEach((completion: any) => {
          suggestions.push({
            text: completion._source?.name || completion.text,
            type: 'completion',
            score: completion._score || 1,
            metadata: {
              index,
              kind: completion._source?.kind
            }
          });
        });
      }

      // Get spell check suggestions
      const spellSuggestions = await this.getSpellingSuggestions(query);
      suggestions.push(...spellSuggestions);

      // Get filter suggestions
      const filterSuggestions = await this.getFilterSuggestions(query);
      suggestions.push(...filterSuggestions);

      // Sort by relevance and deduplicate
      return this.deduplicateSuggestions(suggestions)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxSuggestions);

    } catch (error) {
      console.error('Failed to get search suggestions:', error);
      return [];
    }
  }

  /**
   * Search within specific facet
   */
  async searchFacet(facetName: string, query: string): Promise<FacetBucket[]> {
    try {
      const esQuery = {
        bool: {
          must: [
            {
              match: {
                [facetName]: {
                  query,
                  fuzziness: 'AUTO'
                }
              }
            }
          ]
        }
      };

      const response = await this.client.search(['idp-catalog'], esQuery, {
        size: 0,
        aggs: {
          facet_values: {
            terms: {
              field: `${facetName}.keyword`,
              size: 20,
              include: `.*${query.toLowerCase()}.*`
            }
          }
        }
      });

      const buckets = response.aggregations?.facet_values?.buckets || [];
      return buckets.map((bucket: any) => ({
        key: bucket.key,
        count: bucket.doc_count
      }));

    } catch (error) {
      console.error('Facet search failed:', error);
      return [];
    }
  }

  /**
   * Get popular search queries
   */
  getPopularQueries(limit = 10): string[] {
    const queryCounts = this.searchAnalytics.reduce((counts, search) => {
      counts[search.query] = (counts[search.query] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    return Object.entries(queryCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([query]) => query);
  }

  /**
   * Get search analytics
   */
  getSearchAnalytics(timeRange?: { from: Date; to: Date }): SearchAnalytics[] {
    let analytics = this.searchAnalytics;

    if (timeRange) {
      analytics = analytics.filter(search => 
        search.timestamp >= timeRange.from && search.timestamp <= timeRange.to
      );
    }

    return analytics.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Build Elasticsearch query from search parameters
   */
  private buildElasticsearchQuery(searchQuery: AdvancedSearchQuery): any {
    const { query, filters, searchMode = 'advanced', typoTolerance, boosts } = searchQuery;

    // Base query structure
    const esQuery: any = {
      bool: {
        must: [],
        filter: [],
        should: [],
        must_not: []
      }
    };

    // Add main search query
    if (query && query.trim()) {
      const mainQuery = this.buildMainQuery(query, searchMode, typoTolerance, boosts);
      esQuery.bool.must.push(mainQuery);
    } else {
      esQuery.bool.must.push({ match_all: {} });
    }

    // Add filters
    if (filters) {
      this.addFiltersToQuery(esQuery, filters);
    }

    return esQuery;
  }

  /**
   * Build main search query based on search mode
   */
  private buildMainQuery(query: string, mode: string, typoTolerance?: TypoToleranceConfig, boosts?: SearchBoosts): any {
    const actualBoosts = { ...DEFAULT_SEARCH_CONFIG.boosts, ...boosts };
    const actualTypoTolerance = { ...DEFAULT_SEARCH_CONFIG.typoTolerance, ...typoTolerance };

    switch (mode) {
      case 'simple':
        return {
          simple_query_string: {
            query,
            fields: [
              `name^${actualBoosts.nameBoost}`,
              `title^${actualBoosts.titleBoost}`,
              `description^${actualBoosts.descriptionBoost}`,
              `tags^${actualBoosts.tagBoost}`,
              `searchableText`
            ],
            default_operator: 'and'
          }
        };

      case 'fuzzy':
        return {
          multi_match: {
            query,
            fields: [
              `name^${actualBoosts.nameBoost}`,
              `title^${actualBoosts.titleBoost}`,
              `description^${actualBoosts.descriptionBoost}`,
              `tags^${actualBoosts.tagBoost}`,
              `searchableText`
            ],
            type: 'best_fields',
            fuzziness: actualTypoTolerance.fuzziness,
            prefix_length: actualTypoTolerance.prefixLength,
            max_expansions: actualTypoTolerance.maxExpansions
          }
        };

      case 'semantic':
        return {
          bool: {
            should: [
              {
                multi_match: {
                  query,
                  fields: [
                    `name^${actualBoosts.nameBoost}`,
                    `title^${actualBoosts.titleBoost}`,
                    `description^${actualBoosts.descriptionBoost}`
                  ],
                  type: 'phrase_prefix'
                }
              },
              {
                multi_match: {
                  query,
                  fields: [
                    `tags^${actualBoosts.tagBoost}`,
                    `technologies`,
                    `languages`,
                    `frameworks`
                  ],
                  type: 'cross_fields'
                }
              }
            ]
          }
        };

      case 'advanced':
      default:
        return {
          bool: {
            should: [
              // Exact phrase matches (highest priority)
              {
                multi_match: {
                  query,
                  fields: [
                    `name^${actualBoosts.nameBoost * 2}`,
                    `title^${actualBoosts.titleBoost * 2}`
                  ],
                  type: 'phrase',
                  boost: 3
                }
              },
              // Prefix matches
              {
                multi_match: {
                  query,
                  fields: [
                    `name^${actualBoosts.nameBoost}`,
                    `title^${actualBoosts.titleBoost}`,
                    `description^${actualBoosts.descriptionBoost}`
                  ],
                  type: 'phrase_prefix',
                  boost: 2
                }
              },
              // Cross-field matches
              {
                multi_match: {
                  query,
                  fields: [
                    `name^${actualBoosts.nameBoost}`,
                    `title^${actualBoosts.titleBoost}`,
                    `description^${actualBoosts.descriptionBoosts}`,
                    `tags^${actualBoosts.tagBoost}`,
                    `owner^${actualBoosts.ownerBoost}`,
                    `searchableText`
                  ],
                  type: 'cross_fields',
                  operator: 'and'
                }
              },
              // Fuzzy matching (fallback)
              actualTypoTolerance.enabled ? {
                multi_match: {
                  query,
                  fields: [
                    `name^${actualBoosts.nameBoost * 0.5}`,
                    `title^${actualBoosts.titleBoost * 0.5}`,
                    `searchableText^0.1`
                  ],
                  fuzziness: actualTypoTolerance.fuzziness,
                  prefix_length: actualTypoTolerance.prefixLength,
                  max_expansions: actualTypoTolerance.maxExpansions
                }
              } : null
            ].filter(Boolean)
          }
        };
    }
  }

  /**
   * Add filters to Elasticsearch query
   */
  private addFiltersToQuery(esQuery: any, filters: SearchFilters): void {
    if (filters.kind?.length) {
      esQuery.bool.filter.push({
        terms: { 'kind.keyword': filters.kind }
      });
    }

    if (filters.owner?.length) {
      esQuery.bool.filter.push({
        terms: { 'owner.keyword': filters.owner }
      });
    }

    if (filters.tags?.length) {
      esQuery.bool.filter.push({
        terms: { 'tags.keyword': filters.tags }
      });
    }

    if (filters.lifecycle?.length) {
      esQuery.bool.filter.push({
        terms: { 'lifecycle.keyword': filters.lifecycle }
      });
    }

    if (filters.namespace?.length) {
      esQuery.bool.filter.push({
        terms: { 'namespace.keyword': filters.namespace }
      });
    }

    if (filters.technology?.length) {
      esQuery.bool.filter.push({
        terms: { 'technologies.keyword': filters.technology }
      });
    }

    if (filters.healthScore) {
      const healthRange: any = {};
      if (filters.healthScore.min !== undefined) healthRange.gte = filters.healthScore.min;
      if (filters.healthScore.max !== undefined) healthRange.lte = filters.healthScore.max;
      
      if (Object.keys(healthRange).length > 0) {
        esQuery.bool.filter.push({
          range: { healthScore: healthRange }
        });
      }
    }

    if (filters.dateRange) {
      const dateRange: any = {};
      if (filters.dateRange.start) dateRange.gte = filters.dateRange.start.toISOString();
      if (filters.dateRange.end) dateRange.lte = filters.dateRange.end.toISOString();
      
      if (Object.keys(dateRange).length > 0) {
        esQuery.bool.filter.push({
          range: { lastUpdated: dateRange }
        });
      }
    }
  }

  /**
   * Build aggregations for faceted search
   */
  private buildAggregations(searchQuery: AdvancedSearchQuery): Record<string, any> {
    const aggs: Record<string, any> = {
      kinds: {
        terms: {
          field: 'kind.keyword',
          size: DEFAULT_SEARCH_CONFIG.facetSize
        }
      },
      owners: {
        terms: {
          field: 'owner.keyword',
          size: DEFAULT_SEARCH_CONFIG.facetSize,
          missing: 'No Owner'
        }
      },
      tags: {
        terms: {
          field: 'tags.keyword',
          size: DEFAULT_SEARCH_CONFIG.facetSize
        }
      },
      technologies: {
        terms: {
          field: 'technologies.keyword',
          size: DEFAULT_SEARCH_CONFIG.facetSize
        }
      },
      lifecycles: {
        terms: {
          field: 'lifecycle.keyword',
          size: DEFAULT_SEARCH_CONFIG.facetSize
        }
      },
      health_stats: {
        stats: {
          field: 'healthScore'
        }
      },
      health_ranges: {
        range: {
          field: 'healthScore',
          ranges: [
            { from: 0, to: 30, key: 'Poor' },
            { from: 30, to: 60, key: 'Fair' },
            { from: 60, to: 80, key: 'Good' },
            { from: 80, to: 100, key: 'Excellent' }
          ]
        }
      },
      last_updated: {
        date_range: {
          field: 'lastUpdated',
          ranges: [
            { from: 'now-1d/d', key: 'Today' },
            { from: 'now-7d/d', key: 'This Week' },
            { from: 'now-30d/d', key: 'This Month' },
            { from: 'now-90d/d', key: 'This Quarter' }
          ]
        }
      }
    };

    // Add specific facets if requested
    if (searchQuery.facets?.length) {
      const filteredAggs: Record<string, any> = {};
      searchQuery.facets.forEach(facet => {
        if (aggs[facet]) {
          filteredAggs[facet] = aggs[facet];
        }
      });
      return filteredAggs;
    }

    return aggs;
  }

  /**
   * Build highlight configuration
   */
  private buildHighlightConfig(enabled?: boolean): Record<string, any> | undefined {
    if (!enabled) return undefined;

    return {
      fields: {
        name: {
          fragment_size: 150,
          number_of_fragments: 1
        },
        title: {
          fragment_size: 150,
          number_of_fragments: 1
        },
        description: {
          fragment_size: 200,
          number_of_fragments: 2
        },
        searchableText: {
          fragment_size: 100,
          number_of_fragments: 3
        }
      },
      pre_tags: ['<mark>'],
      post_tags: ['</mark>']
    };
  }

  /**
   * Process search hits from Elasticsearch response
   */
  private processSearchHits(hits: SearchHit[]): SearchResultItem[] {
    return hits.map(hit => {
      const source = hit._source;
      
      return {
        id: hit._id,
        title: source?.title || source?.name || 'Untitled',
        description: source?.description,
        kind: source?.kind || 'Unknown',
        owner: source?.owner,
        tags: source?.tags || [],
        url: source?.source?.url,
        score: hit._score,
        highlights: hit.highlight || {},
        metadata: {
          namespace: source?.namespace,
          lifecycle: source?.lifecycle,
          healthScore: source?.healthScore,
          lastUpdated: source?.lastUpdated,
          technologies: source?.technologies,
          languages: source?.languages
        },
        source
      };
    });
  }

  /**
   * Process aggregations from Elasticsearch response
   */
  private processAggregations(aggregations: Record<string, SearchAggregation>): SearchFacets {
    const facets: SearchFacets = {
      kinds: [],
      owners: [],
      tags: [],
      technologies: [],
      lifecycles: [],
      healthScores: { min: 0, max: 100, avg: 0, buckets: [] },
      lastUpdated: { buckets: [] }
    };

    // Process term aggregations
    ['kinds', 'owners', 'tags', 'technologies', 'lifecycles'].forEach(facetName => {
      const agg = aggregations[facetName];
      if (agg?.buckets) {
        (facets as any)[facetName] = agg.buckets.map((bucket: any) => ({
          key: bucket.key,
          count: bucket.doc_count
        }));
      }
    });

    // Process health score stats
    const healthStats = aggregations.health_stats;
    if (healthStats) {
      facets.healthScores = {
        min: (healthStats as any).min || 0,
        max: (healthStats as any).max || 100,
        avg: Math.round((healthStats as any).avg || 0),
        buckets: []
      };
    }

    // Process health score ranges
    const healthRanges = aggregations.health_ranges;
    if (healthRanges?.buckets) {
      facets.healthScores.buckets = healthRanges.buckets.map((bucket: any) => ({
        from: bucket.from || 0,
        to: bucket.to || 100,
        count: bucket.doc_count
      }));
    }

    // Process date ranges
    const dateRanges = aggregations.last_updated;
    if (dateRanges?.buckets) {
      facets.lastUpdated.buckets = dateRanges.buckets.map((bucket: any) => ({
        key: bucket.key,
        from: new Date(bucket.from_as_string),
        to: new Date(bucket.to_as_string || Date.now()),
        count: bucket.doc_count
      }));
    }

    return facets;
  }

  /**
   * Get spelling suggestions for query
   */
  private async getSpellingSuggestions(query: string): Promise<SearchSuggestion[]> {
    // This is a simplified implementation
    // In production, you might use Elasticsearch's suggestion API or a dedicated spell-check service
    const suggestions: SearchSuggestion[] = [];
    
    // Add basic typo corrections (you would expand this with a proper spell check library)
    const commonTypos: Record<string, string> = {
      'servce': 'service',
      'compnent': 'component',
      'applicaton': 'application',
      'databse': 'database',
      'kuberentes': 'kubernetes'
    };

    if (commonTypos[query.toLowerCase()]) {
      suggestions.push({
        text: commonTypos[query.toLowerCase()],
        type: 'correction',
        score: 0.9
      });
    }

    return suggestions;
  }

  /**
   * Get filter suggestions based on query
   */
  private async getFilterSuggestions(query: string): Promise<SearchSuggestion[]> {
    const suggestions: SearchSuggestion[] = [];

    // Suggest filters based on query patterns
    if (/owner|by|belongs/.test(query.toLowerCase())) {
      suggestions.push({
        text: `owner:${query}`,
        type: 'filter',
        score: 0.8,
        metadata: { filterType: 'owner' }
      });
    }

    if (/tag|tagged|category/.test(query.toLowerCase())) {
      suggestions.push({
        text: `tag:${query}`,
        type: 'filter',
        score: 0.8,
        metadata: { filterType: 'tag' }
      });
    }

    if (/kind|type/.test(query.toLowerCase())) {
      suggestions.push({
        text: `kind:${query}`,
        type: 'filter',
        score: 0.8,
        metadata: { filterType: 'kind' }
      });
    }

    return suggestions;
  }

  /**
   * Get related queries based on search history
   */
  private async getRelatedQueries(query: string): Promise<string[]> {
    const related = new Set<string>();
    
    // Find queries with similar terms
    const queryTerms = query.toLowerCase().split(/\s+/);
    
    this.searchAnalytics.forEach(search => {
      const searchTerms = search.query.toLowerCase().split(/\s+/);
      const commonTerms = queryTerms.filter(term => searchTerms.includes(term));
      
      if (commonTerms.length > 0 && search.query !== query) {
        related.add(search.query);
      }
    });

    return Array.from(related).slice(0, 5);
  }

  /**
   * Deduplicate search suggestions
   */
  private deduplicateSuggestions(suggestions: SearchSuggestion[]): SearchSuggestion[] {
    const seen = new Set<string>();
    return suggestions.filter(suggestion => {
      const key = `${suggestion.text}:${suggestion.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Get appropriate indices for search
   */
  private getSearchIndices(searchQuery: AdvancedSearchQuery): string[] {
    // Default to all indices
    return ['idp-catalog', 'idp-docs', 'idp-templates'];
  }

  /**
   * Track search analytics
   */
  private trackSearch(analytics: SearchAnalytics): void {
    this.searchAnalytics.push(analytics);
    
    // Keep only recent searches (last 1000)
    if (this.searchAnalytics.length > 1000) {
      this.searchAnalytics = this.searchAnalytics.slice(-1000);
    }
  }

  /**
   * Generate session ID for analytics
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
let advancedSearchService: AdvancedSearchService | null = null;

export function getAdvancedSearchService(): AdvancedSearchService {
  if (!advancedSearchService) {
    advancedSearchService = new AdvancedSearchService();
  }
  return advancedSearchService;
}

// Utility functions for search query building
export function buildSearchFilters(params: URLSearchParams): SearchFilters {
  const filters: SearchFilters = {};

  const kind = params.getAll('kind');
  if (kind.length > 0) filters.kind = kind;

  const owner = params.getAll('owner');
  if (owner.length > 0) filters.owner = owner;

  const tags = params.getAll('tags');
  if (tags.length > 0) filters.tags = tags;

  const lifecycle = params.getAll('lifecycle');
  if (lifecycle.length > 0) filters.lifecycle = lifecycle;

  const namespace = params.getAll('namespace');
  if (namespace.length > 0) filters.namespace = namespace;

  const technology = params.getAll('technology');
  if (technology.length > 0) filters.technology = technology;

  // Parse health score range
  const healthMin = params.get('healthMin');
  const healthMax = params.get('healthMax');
  if (healthMin || healthMax) {
    filters.healthScore = {
      min: healthMin ? parseInt(healthMin, 10) : undefined,
      max: healthMax ? parseInt(healthMax, 10) : undefined
    };
  }

  // Parse date range
  const dateStart = params.get('dateStart');
  const dateEnd = params.get('dateEnd');
  if (dateStart || dateEnd) {
    filters.dateRange = {
      start: dateStart ? new Date(dateStart) : undefined,
      end: dateEnd ? new Date(dateEnd) : undefined
    };
  }

  return filters;
}

export function serializeSearchFilters(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams();

  filters.kind?.forEach(k => params.append('kind', k));
  filters.owner?.forEach(o => params.append('owner', o));
  filters.tags?.forEach(t => params.append('tags', t));
  filters.lifecycle?.forEach(l => params.append('lifecycle', l));
  filters.namespace?.forEach(n => params.append('namespace', n));
  filters.technology?.forEach(t => params.append('technology', t));

  if (filters.healthScore?.min !== undefined) {
    params.set('healthMin', filters.healthScore.min.toString());
  }
  if (filters.healthScore?.max !== undefined) {
    params.set('healthMax', filters.healthScore.max.toString());
  }

  if (filters.dateRange?.start) {
    params.set('dateStart', filters.dateRange.start.toISOString());
  }
  if (filters.dateRange?.end) {
    params.set('dateEnd', filters.dateRange.end.toISOString());
  }

  return params;
}