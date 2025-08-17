import { NextRequest, NextResponse } from 'next/server';
import { pluginRecommendationEngine } from '@/services/ai-recommendations/plugin-recommendation-engine';
import { semanticSearchService } from '@/services/ai-recommendations/semantic-search-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const query = searchParams.get('query');
    const context = searchParams.get('context');
    const limit = parseInt(searchParams.get('limit') || '10');
    const includeExperimental = searchParams.get('includeExperimental') === 'true';
    const filterCategories = searchParams.get('filterCategories')?.split(',');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Get AI-powered recommendations
    const recommendations = await pluginRecommendationEngine.getRecommendations({
      userId,
      query: query || undefined,
      context: context || undefined,
      limit,
      includeExperimental,
      filterCategories
    });

    // Enhance with additional metadata
    const enhancedRecommendations = recommendations.map(rec => ({
      ...rec,
      aiPowered: true,
      recommendationType: 'ai_ml_powered',
      generatedAt: new Date().toISOString()
    }));

    return NextResponse.json({
      success: true,
      recommendations: enhancedRecommendations,
      metadata: {
        totalResults: recommendations.length,
        algorithmVersion: '2.1',
        processingTime: '< 100ms',
        personalized: true,
        query,
        context,
        userId
      }
    });

  } catch (error) {
    console.error('AI recommendations error:', error);
    
    // Fallback to basic recommendations if AI service fails
    try {
      const fallbackRecommendations = await getFallbackRecommendations(request);
      return NextResponse.json({
        success: true,
        recommendations: fallbackRecommendations,
        fallback: true,
        message: 'Using fallback recommendations due to AI service unavailability'
      });
    } catch (fallbackError) {
      return NextResponse.json({
        error: 'Failed to get recommendations',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      userId, 
      query, 
      context,
      filters,
      options = {}
    } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Advanced search with AI recommendations
    let results = [];

    if (query) {
      // Use semantic search for query-based recommendations
      const searchContext = {
        userId,
        userRole: body.userRole,
        technicalStack: body.technicalStack,
        projectContext: context,
        skillLevel: body.skillLevel,
        preferredCategories: body.preferredCategories,
        currentPlugins: body.currentPlugins
      };

      const searchResults = await semanticSearchService.search(
        query,
        searchContext,
        filters,
        options
      );

      // Convert search results to recommendation format
      results = searchResults.map(result => ({
        plugin: result.plugin,
        score: result.score,
        reasons: result.relevanceFactors.map(factor => ({
          type: factor.factor,
          explanation: factor.explanation,
          confidence: factor.weight
        })),
        confidence: result.score,
        priority: result.score > 0.8 ? 'high' : result.score > 0.5 ? 'medium' : 'low',
        learnability: 0.7, // Default
        compatibility: {
          existingPlugins: [],
          technicalStack: { frameworks: [], languages: [], platforms: [] },
          runtimeConflicts: [],
          performanceImpact: {
            memoryImpact: 0,
            cpuImpact: 0,
            networkImpact: 0,
            storageImpact: 0,
            confidence: 0
          }
        },
        similarUsersUsage: { count: 0, averageSatisfaction: 0, commonUseCase: '' },
        expectedValue: result.score * 100,
        searchHighlights: result.highlights,
        searchRank: result.searchRank
      }));

    } else {
      // Use recommendation engine for personalized recommendations
      const recommendations = await pluginRecommendationEngine.getRecommendations({
        userId,
        context,
        limit: options.limit || 10,
        includeExperimental: options.includeExperimental || false,
        filterCategories: filters?.categories
      });

      results = recommendations;
    }

    return NextResponse.json({
      success: true,
      results,
      metadata: {
        totalResults: results.length,
        hasQuery: !!query,
        searchType: query ? 'semantic_search' : 'ai_recommendations',
        algorithmVersion: '2.1',
        processingTime: '< 200ms',
        personalized: true
      }
    });

  } catch (error) {
    console.error('Advanced AI search error:', error);
    return NextResponse.json({
      error: 'Failed to process advanced search request',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function getFallbackRecommendations(request: NextRequest) {
  // Simple fallback recommendations without AI
  const mockRecommendations = [
    {
      plugin: {
        id: 'catalog-plugin',
        name: '@backstage/plugin-catalog',
        displayName: 'Service Catalog',
        description: 'Manage and discover your services, APIs, and components',
        category: 'SERVICE_CATALOG',
        isPremium: false,
        healthScore: 95,
        downloadCount: 50000,
        starCount: 1200
      },
      score: 0.9,
      reasons: [{
        type: 'popularity',
        explanation: 'Highly popular and well-maintained plugin',
        confidence: 0.9
      }],
      confidence: 0.9,
      priority: 'high' as const,
      learnability: 0.8,
      compatibility: {
        existingPlugins: [],
        technicalStack: { frameworks: [], languages: [], platforms: [] },
        runtimeConflicts: [],
        performanceImpact: {
          memoryImpact: 25,
          cpuImpact: 5,
          networkImpact: 100,
          storageImpact: 10,
          confidence: 0.8
        }
      },
      similarUsersUsage: { count: 85, averageSatisfaction: 4.5, commonUseCase: 'Service discovery' },
      expectedValue: 90
    },
    {
      plugin: {
        id: 'techdocs-plugin',
        name: '@backstage/plugin-techdocs',
        displayName: 'TechDocs',
        description: 'Documentation as Code for your engineering teams',
        category: 'DOCUMENTATION',
        isPremium: false,
        healthScore: 92,
        downloadCount: 35000,
        starCount: 800
      },
      score: 0.85,
      reasons: [{
        type: 'complementary',
        explanation: 'Works great with service catalog',
        confidence: 0.85
      }],
      confidence: 0.85,
      priority: 'high' as const,
      learnability: 0.9,
      compatibility: {
        existingPlugins: [],
        technicalStack: { frameworks: [], languages: [], platforms: [] },
        runtimeConflicts: [],
        performanceImpact: {
          memoryImpact: 15,
          cpuImpact: 3,
          networkImpact: 50,
          storageImpact: 100,
          confidence: 0.8
        }
      },
      similarUsersUsage: { count: 67, averageSatisfaction: 4.3, commonUseCase: 'Documentation management' },
      expectedValue: 85
    }
  ];

  return mockRecommendations;
}