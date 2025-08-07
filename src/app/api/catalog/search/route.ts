import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

interface SearchQuery {
  q: string;
  filters?: SearchFilter[];
  facets?: string[];
  sort?: SortOption[];
  pagination?: SearchPagination;
  options?: SearchOptions;
}

interface SearchFilter {
  field: string;
  operator: FilterOperator;
  value: any;
  boost?: number;
}

type FilterOperator = 
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'in'
  | 'not_in'
  | 'exists'
  | 'not_exists'
  | 'greater_than'
  | 'less_than'
  | 'between'
  | 'regex';

interface SortOption {
  field: string;
  order: 'asc' | 'desc';
}

interface SearchPagination {
  page: number;
  size: number;
}

interface SearchOptions {
  fuzzy?: boolean;
  typoTolerance?: number;
  synonyms?: boolean;
  stemming?: boolean;
  highlightFields?: string[];
  searchableFields?: string[];
  returnFields?: string[];
  groupBy?: string;
  distinct?: string;
  minScore?: number;
  explain?: boolean;
}

interface SearchResult {
  items: SearchResultItem[];
  total: number;
  page: number;
  size: number;
  took: number;
  facets?: SearchFacets;
  suggestions?: SearchSuggestion[];
  aggregations?: SearchAggregations;
  debug?: SearchDebugInfo;
}

interface SearchResultItem {
  entity: any;
  score: number;
  highlights?: Record<string, string[]>;
  explanation?: ScoreExplanation;
  related?: RelatedEntity[];
}

interface ScoreExplanation {
  value: number;
  description: string;
  details: ExplanationDetail[];
}

interface ExplanationDetail {
  value: number;
  description: string;
  field?: string;
  boost?: number;
}

interface RelatedEntity {
  ref: string;
  type: string;
  relationship: string;
  score: number;
}

interface SearchFacets {
  [key: string]: FacetBucket[];
}

interface FacetBucket {
  value: string;
  count: number;
  selected?: boolean;
  children?: FacetBucket[];
}

interface SearchSuggestion {
  text: string;
  score: number;
  type: 'term' | 'phrase' | 'entity' | 'completion';
  payload?: any;
}

interface SearchAggregations {
  [key: string]: AggregationResult;
}

interface AggregationResult {
  type: 'terms' | 'range' | 'histogram' | 'date_histogram' | 'stats' | 'cardinality';
  buckets?: AggregationBucket[];
  value?: number;
  stats?: StatsAggregation;
}

interface AggregationBucket {
  key: string | number;
  doc_count: number;
  from?: number;
  to?: number;
  sub_aggregations?: SearchAggregations;
}

interface StatsAggregation {
  count: number;
  min: number;
  max: number;
  avg: number;
  sum: number;
  std_deviation?: number;
  variance?: number;
}

interface SearchDebugInfo {
  query: any;
  parsedQuery: string;
  executionTime: number;
  indexesUsed: string[];
  cacheHit: boolean;
  errors?: string[];
  warnings?: string[];
}

interface SearchIndex {
  id: string;
  entity: any;
  searchableText: string;
  keywords: string[];
  metadata: Record<string, any>;
  vector?: number[];
  lastIndexed: string;
}

interface SearchHistory {
  id: string;
  userId: string;
  query: string;
  filters: SearchFilter[];
  timestamp: string;
  resultCount: number;
  clickedResults: string[];
}

interface SavedSearch {
  id: string;
  name: string;
  description?: string;
  query: SearchQuery;
  userId: string;
  shared: boolean;
  tags: string[];
  created: string;
  updated: string;
  lastUsed?: string;
  useCount: number;
}

interface SearchAnalytics {
  popularQueries: QueryAnalytics[];
  searchVolume: VolumeAnalytics;
  performanceMetrics: PerformanceMetrics;
  userBehavior: BehaviorAnalytics;
  recommendations: SearchRecommendation[];
}

interface QueryAnalytics {
  query: string;
  count: number;
  avgResultCount: number;
  avgClickPosition: number;
  noResultsRate: number;
  refinementRate: number;
}

interface VolumeAnalytics {
  total: number;
  daily: number[];
  hourly: number[];
  growth: number;
  peakTime: string;
}

interface PerformanceMetrics {
  avgLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  errorRate: number;
  cacheHitRate: number;
}

interface BehaviorAnalytics {
  avgSessionLength: number;
  avgQueriesPerSession: number;
  bounceRate: number;
  refinementPatterns: RefinementPattern[];
  clickPatterns: ClickPattern[];
}

interface RefinementPattern {
  fromQuery: string;
  toQuery: string;
  count: number;
  improvement: number;
}

interface ClickPattern {
  query: string;
  position: number;
  entityType: string;
  clickRate: number;
}

interface SearchRecommendation {
  type: 'synonym' | 'spelling' | 'filter' | 'boost' | 'index';
  description: string;
  impact: 'low' | 'medium' | 'high';
  implementation: string;
  examples: string[];
}

// Storage
const searchIndex = new Map<string, SearchIndex>();
const searchHistory = new Map<string, SearchHistory>();
const savedSearches = new Map<string, SavedSearch>();

// Sample entities for searching
const sampleEntities = [
  {
    kind: 'Component',
    metadata: {
      name: 'backstage-portal',
      title: 'Backstage Portal',
      description: 'Main portal application for Backstage platform',
      tags: ['frontend', 'react', 'typescript', 'portal']
    },
    spec: {
      type: 'website',
      lifecycle: 'production',
      owner: 'platform-team'
    }
  },
  {
    kind: 'Component',
    metadata: {
      name: 'backstage-backend',
      title: 'Backstage Backend',
      description: 'Backend services for Backstage platform',
      tags: ['backend', 'nodejs', 'typescript', 'api']
    },
    spec: {
      type: 'service',
      lifecycle: 'production',
      owner: 'platform-team'
    }
  },
  {
    kind: 'API',
    metadata: {
      name: 'catalog-api',
      title: 'Catalog API',
      description: 'API for managing software catalog entities',
      tags: ['rest', 'catalog', 'api']
    },
    spec: {
      type: 'openapi',
      lifecycle: 'production',
      owner: 'platform-team'
    }
  },
  {
    kind: 'System',
    metadata: {
      name: 'backstage',
      title: 'Backstage Platform',
      description: 'Internal developer platform built on Backstage',
      tags: ['platform', 'infrastructure']
    },
    spec: {
      owner: 'platform-team',
      domain: 'platform'
    }
  },
  {
    kind: 'Template',
    metadata: {
      name: 'nodejs-template',
      title: 'Node.js Service Template',
      description: 'Create a new Node.js microservice with TypeScript',
      tags: ['nodejs', 'typescript', 'template', 'microservice']
    },
    spec: {
      type: 'service',
      owner: 'platform-team'
    }
  }
];

// Build search index
const buildSearchIndex = () => {
  sampleEntities.forEach(entity => {
    const id = `${entity.kind.toLowerCase()}:${entity.metadata.name}`;
    
    // Create searchable text
    const searchableText = [
      entity.metadata.name,
      entity.metadata.title,
      entity.metadata.description,
      ...(entity.metadata.tags || []),
      entity.kind,
      entity.spec.type,
      entity.spec.owner
    ].join(' ').toLowerCase();
    
    // Extract keywords
    const keywords = extractKeywords(searchableText);
    
    searchIndex.set(id, {
      id,
      entity,
      searchableText,
      keywords,
      metadata: {
        kind: entity.kind,
        type: entity.spec.type,
        owner: entity.spec.owner,
        lifecycle: entity.spec.lifecycle,
        tags: entity.metadata.tags
      },
      lastIndexed: new Date().toISOString()
    });
  });
};

// Extract keywords from text
const extractKeywords = (text: string): string[] => {
  // Simple keyword extraction (in production, use NLP library)
  const words = text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2);
  
  // Remove common stop words
  const stopWords = new Set(['the', 'and', 'for', 'with', 'this', 'that', 'from']);
  
  return Array.from(new Set(
    words.filter(word => !stopWords.has(word))
  ));
};

// Calculate search score
const calculateScore = (query: string, index: SearchIndex, options?: SearchOptions): number => {
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/);
  let score = 0;
  
  // Exact match in name
  if (index.entity.metadata.name.toLowerCase() === queryLower) {
    score += 100;
  }
  
  // Partial match in name
  if (index.entity.metadata.name.toLowerCase().includes(queryLower)) {
    score += 50;
  }
  
  // Match in title
  if (index.entity.metadata.title?.toLowerCase().includes(queryLower)) {
    score += 30;
  }
  
  // Match in description
  if (index.entity.metadata.description?.toLowerCase().includes(queryLower)) {
    score += 20;
  }
  
  // Term frequency
  queryTerms.forEach(term => {
    const frequency = (index.searchableText.match(new RegExp(term, 'g')) || []).length;
    score += frequency * 5;
  });
  
  // Keyword matches
  const keywordMatches = queryTerms.filter(term => 
    index.keywords.includes(term)
  ).length;
  score += keywordMatches * 10;
  
  // Tag matches
  if (index.entity.metadata.tags) {
    const tagMatches = index.entity.metadata.tags.filter((tag: string) =>
      queryTerms.some(term => tag.toLowerCase().includes(term))
    ).length;
    score += tagMatches * 15;
  }
  
  // Fuzzy matching
  if (options?.fuzzy) {
    queryTerms.forEach(term => {
      index.keywords.forEach(keyword => {
        const distance = levenshteinDistance(term, keyword);
        if (distance <= (options.typoTolerance || 2)) {
          score += (10 - distance * 2);
        }
      });
    });
  }
  
  return score;
};

// Levenshtein distance for fuzzy matching
const levenshteinDistance = (a: string, b: string): number => {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
};

// Apply filters to search results
const applyFilters = (items: SearchIndex[], filters?: SearchFilter[]): SearchIndex[] => {
  if (!filters || filters.length === 0) {
    return items;
  }
  
  return items.filter(item => {
    return filters.every(filter => {
      const value = getNestedValue(item, filter.field);
      
      switch (filter.operator) {
        case 'equals':
          return value === filter.value;
        case 'not_equals':
          return value !== filter.value;
        case 'contains':
          return String(value).includes(filter.value);
        case 'not_contains':
          return !String(value).includes(filter.value);
        case 'starts_with':
          return String(value).startsWith(filter.value);
        case 'ends_with':
          return String(value).endsWith(filter.value);
        case 'in':
          return Array.isArray(filter.value) && filter.value.includes(value);
        case 'not_in':
          return Array.isArray(filter.value) && !filter.value.includes(value);
        case 'exists':
          return value !== undefined && value !== null;
        case 'not_exists':
          return value === undefined || value === null;
        case 'greater_than':
          return value > filter.value;
        case 'less_than':
          return value < filter.value;
        case 'between':
          return Array.isArray(filter.value) && 
                 value >= filter.value[0] && 
                 value <= filter.value[1];
        case 'regex':
          return new RegExp(filter.value).test(String(value));
        default:
          return true;
      }
    });
  });
};

// Get nested object value
const getNestedValue = (obj: any, path: string): any => {
  return path.split('.').reduce((current, key) => current?.[key], obj);
};

// Generate facets from search results
const generateFacets = (items: SearchIndex[], facetFields?: string[]): SearchFacets => {
  const facets: SearchFacets = {};
  
  const defaultFacets = facetFields || ['metadata.kind', 'metadata.type', 'metadata.owner', 'metadata.lifecycle'];
  
  defaultFacets.forEach(field => {
    const buckets = new Map<string, number>();
    
    items.forEach(item => {
      const value = getNestedValue(item, field);
      if (value !== undefined && value !== null) {
        const key = String(value);
        buckets.set(key, (buckets.get(key) || 0) + 1);
      }
    });
    
    facets[field] = Array.from(buckets.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
  });
  
  return facets;
};

// Generate search suggestions
const generateSuggestions = (query: string, items: SearchIndex[]): SearchSuggestion[] => {
  const suggestions: SearchSuggestion[] = [];
  const queryLower = query.toLowerCase();
  
  // Term suggestions from index
  const termFrequency = new Map<string, number>();
  
  items.forEach(item => {
    item.keywords.forEach(keyword => {
      if (keyword.startsWith(queryLower) && keyword !== queryLower) {
        termFrequency.set(keyword, (termFrequency.get(keyword) || 0) + 1);
      }
    });
  });
  
  // Add term suggestions
  Array.from(termFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([term, freq]) => {
      suggestions.push({
        text: term,
        score: freq / items.length,
        type: 'term'
      });
    });
  
  // Entity suggestions
  items
    .filter(item => item.entity.metadata.name.toLowerCase().includes(queryLower))
    .slice(0, 3)
    .forEach(item => {
      suggestions.push({
        text: item.entity.metadata.name,
        score: 0.8,
        type: 'entity',
        payload: {
          kind: item.entity.kind,
          title: item.entity.metadata.title
        }
      });
    });
  
  return suggestions;
};

// Highlight matching terms
const highlightMatches = (text: string, query: string): string[] => {
  const queryTerms = query.toLowerCase().split(/\s+/);
  const highlights: string[] = [];
  
  queryTerms.forEach(term => {
    const regex = new RegExp(`(${term})`, 'gi');
    const matches = text.match(regex);
    if (matches) {
      highlights.push(...matches.map(match => 
        text.replace(regex, `<mark>${match}</mark>`)
      ));
    }
  });
  
  return highlights;
};

// Initialize search index
buildSearchIndex();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const size = parseInt(searchParams.get('size') || '20');
    const fuzzy = searchParams.get('fuzzy') === 'true';
    const explain = searchParams.get('explain') === 'true';
    
    const startTime = Date.now();
    
    // Parse filters
    const filterParam = searchParams.get('filters');
    const filters: SearchFilter[] = filterParam ? JSON.parse(filterParam) : [];
    
    // Search options
    const options: SearchOptions = {
      fuzzy,
      typoTolerance: 2,
      synonyms: true,
      stemming: true,
      explain
    };
    
    // Get all indexed items
    let results = Array.from(searchIndex.values());
    
    // Apply filters first
    results = applyFilters(results, filters);
    
    // Score and rank results if query provided
    let scoredResults: SearchResultItem[] = [];
    
    if (q) {
      scoredResults = results
        .map(item => ({
          entity: item.entity,
          score: calculateScore(q, item, options),
          highlights: {
            name: highlightMatches(item.entity.metadata.name, q),
            title: highlightMatches(item.entity.metadata.title || '', q),
            description: highlightMatches(item.entity.metadata.description || '', q)
          }
        }))
        .filter(item => item.score > (options.minScore || 0))
        .sort((a, b) => b.score - a.score);
    } else {
      // No query, return all filtered results
      scoredResults = results.map(item => ({
        entity: item.entity,
        score: 1,
        highlights: {}
      }));
    }
    
    // Pagination
    const total = scoredResults.length;
    const startIndex = (page - 1) * size;
    const endIndex = startIndex + size;
    const paginatedResults = scoredResults.slice(startIndex, endIndex);
    
    // Generate facets
    const facets = generateFacets(results);
    
    // Generate suggestions
    const suggestions = q ? generateSuggestions(q, results) : [];
    
    // Track search history
    if (q) {
      const historyEntry: SearchHistory = {
        id: crypto.randomBytes(8).toString('hex'),
        userId: 'anonymous',
        query: q,
        filters,
        timestamp: new Date().toISOString(),
        resultCount: total,
        clickedResults: []
      };
      searchHistory.set(historyEntry.id, historyEntry);
    }
    
    const response: SearchResult = {
      items: paginatedResults,
      total,
      page,
      size,
      took: Date.now() - startTime,
      facets,
      suggestions
    };
    
    if (explain) {
      response.debug = {
        query: q,
        parsedQuery: q.toLowerCase(),
        executionTime: Date.now() - startTime,
        indexesUsed: ['in-memory'],
        cacheHit: false
      };
    }
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({
      error: 'Search failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    
    switch (action) {
      case 'save': {
        const savedSearch: SavedSearch = {
          id: crypto.randomBytes(8).toString('hex'),
          name: body.name,
          description: body.description,
          query: body.query,
          userId: body.userId || 'anonymous',
          shared: body.shared || false,
          tags: body.tags || [],
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          useCount: 0
        };
        
        savedSearches.set(savedSearch.id, savedSearch);
        
        return NextResponse.json({
          success: true,
          savedSearch
        });
      }
      
      case 'getSaved': {
        const userId = body.userId || 'anonymous';
        const userSavedSearches = Array.from(savedSearches.values())
          .filter(search => search.userId === userId || search.shared);
        
        return NextResponse.json({
          success: true,
          savedSearches: userSavedSearches
        });
      }
      
      case 'deleteSaved': {
        const { id } = body;
        
        if (!savedSearches.has(id)) {
          return NextResponse.json({
            success: false,
            error: 'Saved search not found'
          }, { status: 404 });
        }
        
        savedSearches.delete(id);
        
        return NextResponse.json({
          success: true
        });
      }
      
      case 'analytics': {
        // Generate search analytics
        const historyArray = Array.from(searchHistory.values());
        
        // Popular queries
        const queryCount = new Map<string, number>();
        historyArray.forEach(h => {
          queryCount.set(h.query, (queryCount.get(h.query) || 0) + 1);
        });
        
        const popularQueries: QueryAnalytics[] = Array.from(queryCount.entries())
          .map(([query, count]) => ({
            query,
            count,
            avgResultCount: historyArray
              .filter(h => h.query === query)
              .reduce((sum, h) => sum + h.resultCount, 0) / count,
            avgClickPosition: 0,
            noResultsRate: historyArray
              .filter(h => h.query === query && h.resultCount === 0).length / count,
            refinementRate: 0
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);
        
        const analytics: SearchAnalytics = {
          popularQueries,
          searchVolume: {
            total: historyArray.length,
            daily: [],
            hourly: [],
            growth: 0,
            peakTime: '12:00'
          },
          performanceMetrics: {
            avgLatency: 25,
            p50Latency: 20,
            p95Latency: 50,
            p99Latency: 100,
            errorRate: 0.001,
            cacheHitRate: 0.75
          },
          userBehavior: {
            avgSessionLength: 5,
            avgQueriesPerSession: 3,
            bounceRate: 0.2,
            refinementPatterns: [],
            clickPatterns: []
          },
          recommendations: [
            {
              type: 'synonym',
              description: 'Add synonyms for common terms',
              impact: 'medium',
              implementation: 'Configure synonym dictionary',
              examples: ['svc -> service', 'k8s -> kubernetes']
            }
          ]
        };
        
        return NextResponse.json({
          success: true,
          analytics
        });
      }
      
      case 'reindex': {
        // Rebuild search index
        buildSearchIndex();
        
        return NextResponse.json({
          success: true,
          message: 'Search index rebuilt',
          indexed: searchIndex.size
        });
      }
      
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }
    
  } catch (error) {
    console.error('Search POST error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process search request'
    }, { status: 500 });
  }
}