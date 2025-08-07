/**
 * Search Suggestions API Endpoint
 * 
 * Provides autocomplete suggestions for search queries including:
 * - Query completions
 * - Spelling corrections
 * - Filter suggestions
 * - Related queries
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdvancedSearchService } from '@/lib/search/advanced-search';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const maxSuggestions = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50);

    if (query.length < 2) {
      return NextResponse.json({
        success: true,
        data: {
          suggestions: [],
          popular: []
        }
      });
    }

    const searchService = getAdvancedSearchService();
    
    // Get search suggestions
    const suggestions = await searchService.getSuggestions(query, maxSuggestions);
    
    // Get popular queries
    const popularQueries = searchService.getPopularQueries(5);

    return NextResponse.json({
      success: true,
      data: {
        suggestions,
        popular: popularQueries,
        query
      }
    });

  } catch (error) {
    console.error('Search suggestions API error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get suggestions',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, maxSuggestions = 10 } = body;

    if (!query || query.length < 2) {
      return NextResponse.json({
        success: true,
        data: {
          suggestions: [],
          popular: []
        }
      });
    }

    const searchService = getAdvancedSearchService();
    const suggestions = await searchService.getSuggestions(query, Math.min(maxSuggestions, 50));
    const popularQueries = searchService.getPopularQueries(5);

    return NextResponse.json({
      success: true,
      data: {
        suggestions,
        popular: popularQueries,
        query
      }
    });

  } catch (error) {
    console.error('Search suggestions API error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get suggestions',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}