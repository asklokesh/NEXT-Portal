/**
 * Search Facets API Endpoint
 * 
 * Provides faceted search functionality for filtering results:
 * - Dynamic facet value searching
 * - Facet statistics and counts
 * - Filter validation and suggestions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdvancedSearchService } from '@/lib/search/advanced-search';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const facetName = searchParams.get('facet');
    const query = searchParams.get('q') || '';

    if (!facetName) {
      return NextResponse.json(
        {
          success: false,
          error: 'Facet name is required'
        },
        { status: 400 }
      );
    }

    const searchService = getAdvancedSearchService();
    const facetValues = await searchService.searchFacet(facetName, query);

    return NextResponse.json({
      success: true,
      data: {
        facet: facetName,
        values: facetValues,
        query
      }
    });

  } catch (error) {
    console.error('Search facets API error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to search facets',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { facet: facetName, query = '' } = body;

    if (!facetName) {
      return NextResponse.json(
        {
          success: false,
          error: 'Facet name is required'
        },
        { status: 400 }
      );
    }

    const searchService = getAdvancedSearchService();
    const facetValues = await searchService.searchFacet(facetName, query);

    return NextResponse.json({
      success: true,
      data: {
        facet: facetName,
        values: facetValues,
        query
      }
    });

  } catch (error) {
    console.error('Search facets API error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to search facets',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}