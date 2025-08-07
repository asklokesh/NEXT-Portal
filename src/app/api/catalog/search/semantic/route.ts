import { NextRequest, NextResponse } from 'next/server';
import { createSemanticSearch, type SearchFilters } from '@/lib/search/SemanticSearch';
import type { Entity } from '@/services/backstage/types/entities';

/**
 * Semantic Search API Route
 * 
 * Provides comprehensive semantic search capabilities for the catalog
 * including natural language processing, fuzzy matching, and intelligent ranking.
 * 
 * Endpoints:
 * - GET /api/catalog/search/semantic?q=query&filters=... - Execute semantic search
 * - POST /api/catalog/search/semantic/suggestions - Get search suggestions
 * - GET /api/catalog/search/semantic/history - Get search history
 * - DELETE /api/catalog/search/semantic/history - Clear search history
 */

interface SearchRequest {
  query: string;
  filters?: SearchFilters;
  maxResults?: number;
  includeHighlights?: boolean;
  includeRelevanceFactors?: boolean;
}

interface SuggestionsRequest {
  partialQuery: string;
  maxSuggestions?: number;
  includeHistory?: boolean;
}

// Cache for entities and search instance
let entitiesCache: Entity[] = [];
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// In-memory search history (in production, this would be stored in Redis or database)
const searchHistoryMap = new Map<string, Array<{
  query: string;
  timestamp: Date;
  resultCount: number;
  filters: SearchFilters;
}>>();

/**
 * GET /api/catalog/search/semantic
 * Execute semantic search query
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const filtersParam = searchParams.get('filters');
    const maxResults = parseInt(searchParams.get('maxResults') || '50', 10);
    const includeHighlights = searchParams.get('includeHighlights') === 'true';
    const includeRelevanceFactors = searchParams.get('includeRelevanceFactors') === 'true';

    // Validate query
    if (!query.trim()) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      );
    }

    // Parse filters
    let filters: SearchFilters = {};
    if (filtersParam) {
      try {
        filters = JSON.parse(filtersParam);
      } catch (error) {
        console.warn('Invalid filters parameter:', error);
      }
    }

    // Get fresh entities
    const entities = await getEntities();
    if (entities.length === 0) {
      return NextResponse.json({
        results: [],
        totalCount: 0,
        query,
        filters,
        processingTime: 0,
        suggestions: [],
      });
    }

    // Create semantic search instance
    const startTime = Date.now();
    const semanticSearch = createSemanticSearch(entities, { maxResults });

    // Execute search
    const results = semanticSearch.search(query, filters);
    const processingTime = Date.now() - startTime;

    // Get suggestions for query refinement
    const suggestions = semanticSearch.getSuggestions(query, entities);

    // Record search in history
    recordSearch(request, query, filters, results.length);

    // Format response based on requested detail level
    const formattedResults = results.map(result => ({
      item: result.item,
      score: result.score,
      ...(includeHighlights && { highlights: result.highlights }),
      ...(includeRelevanceFactors && { relevanceFactors: result.relevanceFactors }),
      matches: result.matches.map(match => ({
        field: match.field,
        value: match.value,
        score: match.score,
        // Only include indices if highlights are requested
        ...(includeHighlights && { indices: match.indices }),
      })),
    }));

    return NextResponse.json({
      results: formattedResults,
      totalCount: results.length,
      query,
      filters,
      processingTime,
      suggestions: suggestions.slice(0, 5), // Limit suggestions
      metadata: {
        searchType: 'semantic',
        timestamp: new Date().toISOString(),
        entityCount: entities.length,
      },
    });

  } catch (error) {
    console.error('Semantic search error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/catalog/search/semantic/suggestions
 * Get intelligent search suggestions
 */
export async function POST(request: NextRequest) {
  try {
    const body: SuggestionsRequest = await request.json();
    const { partialQuery, maxSuggestions = 10, includeHistory = true } = body;

    if (!partialQuery.trim()) {
      return NextResponse.json({ suggestions: [] });
    }

    // Get entities
    const entities = await getEntities();
    if (entities.length === 0) {
      return NextResponse.json({ suggestions: [] });
    }

    // Create semantic search instance
    const semanticSearch = createSemanticSearch(entities);

    // Get suggestions
    const suggestions = semanticSearch.getSuggestions(partialQuery, entities);

    // Add search history suggestions if requested
    let historySuggestions: any[] = [];
    if (includeHistory) {
      const userHistory = getUserSearchHistory(request);
      historySuggestions = userHistory
        .filter(entry => entry.query.toLowerCase().includes(partialQuery.toLowerCase()))
        .map(entry => ({
          query: entry.query,
          type: 'history',
          score: 0.5,
          metadata: {
            lastUsed: entry.timestamp,
            resultCount: entry.resultCount,
          },
        }))
        .slice(0, 3);
    }

    // Combine and sort suggestions
    const allSuggestions = [...suggestions, ...historySuggestions]
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSuggestions);

    return NextResponse.json({
      suggestions: allSuggestions,
      metadata: {
        partialQuery,
        entityCount: entities.length,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Suggestions error:', error);
    return NextResponse.json(
      { error: 'Failed to get suggestions' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/catalog/search/semantic/history
 * Get user's search history
 */
export async function GET_HISTORY(request: NextRequest) {
  try {
    const userHistory = getUserSearchHistory(request);
    
    return NextResponse.json({
      history: userHistory.slice(0, 20), // Last 20 searches
      totalCount: userHistory.length,
    });

  } catch (error) {
    console.error('Search history error:', error);
    return NextResponse.json(
      { error: 'Failed to get search history' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/catalog/search/semantic/history
 * Clear user's search history
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = getUserId(request);
    searchHistoryMap.delete(userId);
    
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Clear history error:', error);
    return NextResponse.json(
      { error: 'Failed to clear search history' },
      { status: 500 }
    );
  }
}

/**
 * Get entities from Backstage catalog with caching
 */
async function getEntities(): Promise<Entity[]> {
  const now = Date.now();
  
  // Return cached entities if still fresh
  if (entitiesCache.length > 0 && (now - cacheTimestamp) < CACHE_TTL) {
    return entitiesCache;
  }

  try {
    // Fetch entities from catalog API
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4400'}/api/catalog/entities`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch entities:', response.statusText);
      return entitiesCache; // Return stale cache on error
    }

    const data = await response.json();
    const entities = data.items || [];

    // Update cache
    entitiesCache = entities;
    cacheTimestamp = now;

    return entities;

  } catch (error) {
    console.error('Error fetching entities:', error);
    return entitiesCache; // Return stale cache on error
  }
}

/**
 * Record search in user's history
 */
function recordSearch(
  request: NextRequest,
  query: string,
  filters: SearchFilters,
  resultCount: number
) {
  try {
    const userId = getUserId(request);
    
    if (!searchHistoryMap.has(userId)) {
      searchHistoryMap.set(userId, []);
    }

    const userHistory = searchHistoryMap.get(userId)!;
    
    // Add new search to history
    userHistory.unshift({
      query,
      timestamp: new Date(),
      resultCount,
      filters,
    });

    // Keep only last 50 searches per user
    if (userHistory.length > 50) {
      userHistory.splice(50);
    }

  } catch (error) {
    console.error('Error recording search:', error);
  }
}

/**
 * Get user's search history
 */
function getUserSearchHistory(request: NextRequest) {
  const userId = getUserId(request);
  return searchHistoryMap.get(userId) || [];
}

/**
 * Get user identifier from request
 * In production, this would extract from authentication token
 */
function getUserId(request: NextRequest): string {
  // For demo purposes, use IP address
  // In production, extract from JWT token or session
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'anonymous';
  return `user-${ip}`;
}

/**
 * Enhanced error handling middleware
 */
function handleError(error: unknown, context: string) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const stackTrace = error instanceof Error ? error.stack : undefined;
  
  console.error(`[SemanticSearch] ${context}:`, {
    message: errorMessage,
    stack: stackTrace,
    timestamp: new Date().toISOString(),
  });

  return {
    error: 'Internal server error',
    context,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Request validation utilities
 */
function validateSearchRequest(params: any): SearchRequest | { error: string } {
  if (!params.query || typeof params.query !== 'string') {
    return { error: 'Query parameter is required and must be a string' };
  }

  if (params.query.trim().length === 0) {
    return { error: 'Query cannot be empty' };
  }

  if (params.query.length > 1000) {
    return { error: 'Query is too long (max 1000 characters)' };
  }

  return {
    query: params.query.trim(),
    filters: params.filters || {},
    maxResults: Math.min(Math.max(parseInt(params.maxResults) || 50, 1), 100),
    includeHighlights: params.includeHighlights === 'true',
    includeRelevanceFactors: params.includeRelevanceFactors === 'true',
  };
}

/**
 * Health check endpoint for monitoring
 */
export async function HEAD(request: NextRequest) {
  try {
    const entities = await getEntities();
    const isHealthy = entities.length > 0;
    
    return new NextResponse(null, {
      status: isHealthy ? 200 : 503,
      headers: {
        'X-Entity-Count': entities.length.toString(),
        'X-Cache-Age': ((Date.now() - cacheTimestamp) / 1000).toString(),
        'X-Service-Status': isHealthy ? 'healthy' : 'degraded',
      },
    });
    
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}