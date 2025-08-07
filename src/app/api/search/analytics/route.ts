/**
 * Search Analytics API Endpoint
 * 
 * Provides search analytics and tracking functionality:
 * - Search query analytics and trends
 * - Popular queries and click tracking
 * - Search performance metrics
 * - User behavior analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdvancedSearchService } from '@/lib/search/advanced-search';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'overview';
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const searchService = getAdvancedSearchService();

    // Build time range if provided
    const timeRange = from && to ? {
      from: new Date(from),
      to: new Date(to)
    } : undefined;

    switch (action) {
      case 'overview':
        const analytics = searchService.getSearchAnalytics(timeRange);
        const popularQueries = searchService.getPopularQueries(10);
        
        // Calculate basic metrics
        const totalSearches = analytics.length;
        const avgResultCount = analytics.reduce((sum, a) => sum + a.resultCount, 0) / totalSearches || 0;
        const avgSearchTime = analytics.reduce((sum, a) => sum + a.searchTime, 0) / totalSearches || 0;
        const uniqueQueries = new Set(analytics.map(a => a.query)).size;
        
        // Get query distribution by result count
        const queryDistribution = {
          noResults: analytics.filter(a => a.resultCount === 0).length,
          fewResults: analytics.filter(a => a.resultCount > 0 && a.resultCount <= 5).length,
          someResults: analytics.filter(a => a.resultCount > 5 && a.resultCount <= 20).length,
          manyResults: analytics.filter(a => a.resultCount > 20).length
        };

        return NextResponse.json({
          success: true,
          data: {
            metrics: {
              totalSearches,
              uniqueQueries,
              avgResultCount: Math.round(avgResultCount),
              avgSearchTime: Math.round(avgSearchTime),
              queryDistribution
            },
            popularQueries,
            timeRange
          }
        });

      case 'queries':
        const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
        const queries = searchService.getSearchAnalytics(timeRange)
          .slice(0, limit)
          .map(search => ({
            query: search.query,
            timestamp: search.timestamp,
            resultCount: search.resultCount,
            searchTime: search.searchTime,
            hasFilters: Object.keys(search.filters).length > 0,
            clickedResults: search.clickedResults.length
          }));

        return NextResponse.json({
          success: true,
          data: {
            queries,
            total: queries.length
          }
        });

      case 'trends':
        const allAnalytics = searchService.getSearchAnalytics(timeRange);
        
        // Group searches by day
        const dailyTrends = allAnalytics.reduce((trends, search) => {
          const date = search.timestamp.toISOString().split('T')[0];
          if (!trends[date]) {
            trends[date] = { date, searches: 0, uniqueQueries: new Set(), totalTime: 0 };
          }
          trends[date].searches++;
          trends[date].uniqueQueries.add(search.query);
          trends[date].totalTime += search.searchTime;
          return trends;
        }, {} as Record<string, any>);

        const trendsData = Object.values(dailyTrends).map((trend: any) => ({
          date: trend.date,
          searches: trend.searches,
          uniqueQueries: trend.uniqueQueries.size,
          avgSearchTime: Math.round(trend.totalTime / trend.searches)
        }));

        return NextResponse.json({
          success: true,
          data: {
            trends: trendsData,
            timeRange
          }
        });

      case 'popular':
        const popularLimit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50);
        const popular = searchService.getPopularQueries(popularLimit);
        
        // Get detailed stats for popular queries
        const popularWithStats = popular.map(query => {
          const queryAnalytics = searchService.getSearchAnalytics().filter(a => a.query === query);
          const totalSearches = queryAnalytics.length;
          const avgResults = queryAnalytics.reduce((sum, a) => sum + a.resultCount, 0) / totalSearches || 0;
          const totalClicks = queryAnalytics.reduce((sum, a) => sum + a.clickedResults.length, 0);
          
          return {
            query,
            searches: totalSearches,
            avgResults: Math.round(avgResults),
            totalClicks,
            clickRate: totalClicks / totalSearches || 0
          };
        });

        return NextResponse.json({
          success: true,
          data: {
            popular: popularWithStats
          }
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Search analytics API error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Analytics request failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    // This endpoint can be used to track search events
    // For now, we'll just acknowledge the tracking request
    
    switch (action) {
      case 'track-click':
        const { query, entityId, position } = data;
        
        // In a real implementation, you would:
        // 1. Update search analytics with click data
        // 2. Store click-through rates
        // 3. Update result ranking based on clicks
        
        console.log('Search click tracked:', { query, entityId, position });
        
        return NextResponse.json({
          success: true,
          data: {
            message: 'Click tracked successfully'
          }
        });

      case 'track-conversion':
        const { searchQuery, convertedEntityId, conversionType } = data;
        
        console.log('Search conversion tracked:', { 
          query: searchQuery, 
          entityId: convertedEntityId, 
          type: conversionType 
        });
        
        return NextResponse.json({
          success: true,
          data: {
            message: 'Conversion tracked successfully'
          }
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Search analytics tracking error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Analytics tracking failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}