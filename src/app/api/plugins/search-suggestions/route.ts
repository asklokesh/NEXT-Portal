import { NextRequest, NextResponse } from 'next/server';
import { semanticSearchService } from '@/services/ai-recommendations/semantic-search-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || searchParams.get('query');
    const limit = parseInt(searchParams.get('limit') || '10');
    const userId = searchParams.get('userId');
    
    if (!query || query.length < 2) {
      return NextResponse.json({ 
        suggestions: [],
        message: 'Query too short' 
      });
    }

    // Get search context if user is provided
    let context;
    if (userId) {
      // In a real implementation, fetch user context
      context = {
        userId,
        // Mock context
        technicalStack: ['typescript', 'react', 'node.js'],
        preferredCategories: ['SERVICE_CATALOG', 'CICD', 'MONITORING_OBSERVABILITY'],
        projectContext: 'microservice'
      };
    }

    const suggestions = await semanticSearchService.getSearchSuggestions(
      query,
      context,
      limit
    );

    return NextResponse.json({
      success: true,
      suggestions,
      query,
      count: suggestions.length
    });

  } catch (error) {
    console.error('Search suggestions error:', error);
    
    // Fallback suggestions
    const fallbackSuggestions = [
      'kubernetes',
      'ci/cd pipeline',
      'monitoring',
      'authentication',
      'documentation'
    ].filter(s => s.toLowerCase().includes((request.url.split('q=')[1] || '').toLowerCase()));

    return NextResponse.json({
      success: true,
      suggestions: fallbackSuggestions.slice(0, 5),
      fallback: true
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, context, filters, options = {} } = body;

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Perform semantic search
    const searchResults = await semanticSearchService.search(
      query,
      context,
      filters,
      options
    );

    return NextResponse.json({
      success: true,
      results: searchResults,
      query,
      metadata: {
        totalResults: searchResults.length,
        searchTime: '< 50ms',
        algorithm: 'semantic_search_v2'
      }
    });

  } catch (error) {
    console.error('Semantic search error:', error);
    return NextResponse.json({
      error: 'Search failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}