/**
 * Main Search API Endpoint
 * 
 * Provides comprehensive search functionality including:
 * - Multi-index search across catalog, docs, and templates
 * - Advanced filtering and faceting
 * - Search suggestions and autocomplete
 * - Search analytics tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdvancedSearchService, buildSearchFilters } from '@/lib/search/advanced-search';
import type { AdvancedSearchQuery } from '@/lib/search/advanced-search';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    
    // Build search query from URL parameters
    const searchQuery: AdvancedSearchQuery = {
      query,
      filters: buildSearchFilters(searchParams),
      facets: searchParams.get('facets')?.split(',').filter(Boolean),
      sortBy: parseSortOptions(searchParams.get('sort')),
      from: parseInt(searchParams.get('from') || '0', 10),
      size: Math.min(parseInt(searchParams.get('size') || '20', 10), 100),
      highlight: searchParams.get('highlight') === 'true',
      includeAggregations: searchParams.get('aggregations') !== 'false',
      searchMode: (searchParams.get('mode') as any) || 'advanced',
      typoTolerance: {
        enabled: searchParams.get('typoTolerance') !== 'false',
        fuzziness: (searchParams.get('fuzziness') as any) || 'AUTO',
        prefixLength: parseInt(searchParams.get('prefixLength') || '2', 10),
        maxExpansions: parseInt(searchParams.get('maxExpansions') || '50', 10)
      },
      boosts: parseBoostOptions(searchParams)
    };

    const searchService = getAdvancedSearchService();
    const results = await searchService.search(searchQuery);

    return NextResponse.json({
      success: true,
      data: results,
      meta: {
        query: searchQuery.query,
        from: searchQuery.from,
        size: searchQuery.size,
        total: results.total,
        took: results.took
      }
    });

  } catch (error) {
    console.error('Search API error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Search failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const searchQuery: AdvancedSearchQuery = {
      query: body.query || '',
      filters: body.filters || {},
      facets: body.facets,
      sortBy: body.sortBy,
      from: body.from || 0,
      size: Math.min(body.size || 20, 100),
      highlight: body.highlight !== false,
      includeAggregations: body.includeAggregations !== false,
      searchMode: body.searchMode || 'advanced',
      typoTolerance: body.typoTolerance || {
        enabled: true,
        fuzziness: 'AUTO',
        prefixLength: 2,
        maxExpansions: 50
      },
      boosts: body.boosts || {}
    };

    const searchService = getAdvancedSearchService();
    const results = await searchService.search(searchQuery);

    return NextResponse.json({
      success: true,
      data: results,
      meta: {
        query: searchQuery.query,
        from: searchQuery.from,
        size: searchQuery.size,
        total: results.total,
        took: results.took
      }
    });

  } catch (error) {
    console.error('Search API error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Search failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Utility functions
function parseSortOptions(sortParam: string | null): any[] | undefined {
  if (!sortParam) return undefined;

  try {
    // Format: "field:direction,field2:direction2"
    return sortParam.split(',').map(sort => {
      const [field, direction = 'asc'] = sort.split(':');
      return { field, direction };
    });
  } catch {
    return undefined;
  }
}

function parseBoostOptions(searchParams: URLSearchParams): any {
  const boosts: any = {};
  
  const nameBoost = searchParams.get('nameBoost');
  if (nameBoost) boosts.nameBoost = parseFloat(nameBoost);
  
  const titleBoost = searchParams.get('titleBoost');
  if (titleBoost) boosts.titleBoost = parseFloat(titleBoost);
  
  const descriptionBoost = searchParams.get('descriptionBoost');
  if (descriptionBoost) boosts.descriptionBoost = parseFloat(descriptionBoost);
  
  const tagBoost = searchParams.get('tagBoost');
  if (tagBoost) boosts.tagBoost = parseFloat(tagBoost);
  
  const ownerBoost = searchParams.get('ownerBoost');
  if (ownerBoost) boosts.ownerBoost = parseFloat(ownerBoost);
  
  const recentnessBoost = searchParams.get('recentnessBoost');
  if (recentnessBoost) boosts.recentnessBoost = parseFloat(recentnessBoost);
  
  const popularityBoost = searchParams.get('popularityBoost');
  if (popularityBoost) boosts.popularityBoost = parseFloat(popularityBoost);

  return Object.keys(boosts).length > 0 ? boosts : undefined;
}