import { NextRequest, NextResponse } from 'next/server';
import { createSemanticSearch } from '@/lib/search/SemanticSearch';
import type { Entity } from '@/services/backstage/types/entities';

interface SuggestionsRequest {
  partialQuery: string;
  maxSuggestions?: number;
  includeHistory?: boolean;
}

// In-memory search history (in production, this would be stored in Redis or database)
const searchHistoryMap = new Map<string, Array<{
  query: string;
  timestamp: Date;
  resultCount: number;
  filters: any;
}>>();

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
      return NextResponse.json({ 
        suggestions: [],
        metadata: {
          partialQuery,
          entityCount: 0,
          timestamp: new Date().toISOString(),
        },
      });
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
 * Get entities from Backstage catalog
 */
async function getEntities(): Promise<Entity[]> {
  try {
    // Fetch entities from catalog API
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4400'}/api/catalog/entities`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch entities:', response.statusText);
      return [];
    }

    const data = await response.json();
    return data.items || [];

  } catch (error) {
    console.error('Error fetching entities:', error);
    return [];
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
 */
function getUserId(request: NextRequest): string {
  // For demo purposes, use IP address
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'anonymous';
  return `user-${ip}`;
}