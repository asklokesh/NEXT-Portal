import { NextRequest, NextResponse } from 'next/server';
import { TemplateRecommendationEngine } from '@/lib/scaffolder-v2/recommendation-engine';

const recommendationEngine = TemplateRecommendationEngine.getInstance();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const type = searchParams.get('type'); // 'personalized', 'trending', 'contextual', 'smart'
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!userId && type === 'personalized') {
      return NextResponse.json(
        { error: 'User ID is required for personalized recommendations' },
        { status: 400 }
      );
    }

    switch (type) {
      case 'personalized':
        if (!userId) {
          return NextResponse.json(
            { error: 'User ID is required for personalized recommendations' },
            { status: 400 }
          );
        }

        // Parse additional context parameters
        const projectType = searchParams.get('projectType');
        const teamSize = searchParams.get('teamSize') ? parseInt(searchParams.get('teamSize')!) : undefined;
        const urgency = searchParams.get('urgency');
        const preferredTechnologies = searchParams.get('technologies')?.split(',');

        const context = {
          projectType: projectType || undefined,
          teamSize,
          urgency: urgency || undefined,
          preferredTechnologies
        };

        const recommendations = await recommendationEngine.getRecommendations(
          userId,
          context,
          limit
        );

        return NextResponse.json({ recommendations });

      case 'trending':
        const timeWindow = (searchParams.get('timeWindow') as 'day' | 'week' | 'month') || 'week';
        const trending = await recommendationEngine.getTrendingTemplates(timeWindow, limit);
        return NextResponse.json({ recommendations: trending });

      case 'contextual':
        const projectContext = {
          existingTechnologies: searchParams.get('existingTechnologies')?.split(','),
          projectType: searchParams.get('projectType') || undefined,
          teamSize: searchParams.get('teamSize') ? parseInt(searchParams.get('teamSize')!) : undefined,
          expectedFeatures: searchParams.get('expectedFeatures') ? parseInt(searchParams.get('expectedFeatures')!) : undefined,
          integrationRequirements: searchParams.get('integrationRequirements')?.split(',')
        };

        const contextual = await recommendationEngine.getContextualRecommendations(
          projectContext,
          limit
        );

        return NextResponse.json({ recommendations: contextual });

      case 'smart':
        const query = searchParams.get('query');
        if (!query) {
          return NextResponse.json(
            { error: 'Query is required for smart recommendations' },
            { status: 400 }
          );
        }

        const smart = await recommendationEngine.getSmartRecommendations(
          query,
          userId || undefined,
          limit
        );

        return NextResponse.json({ recommendations: smart });

      default:
        // Default to personalized if user ID provided, otherwise trending
        if (userId) {
          const defaultRecommendations = await recommendationEngine.getRecommendations(
            userId,
            {},
            limit
          );
          return NextResponse.json({ recommendations: defaultRecommendations });
        } else {
          const defaultTrending = await recommendationEngine.getTrendingTemplates('week', limit);
          return NextResponse.json({ recommendations: defaultTrending });
        }
    }
  } catch (error) {
    console.error('Error getting recommendations:', error);
    return NextResponse.json(
      { error: 'Failed to get recommendations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateId, userId, context, outcome } = body;

    if (!templateId || !userId || !outcome) {
      return NextResponse.json(
        { error: 'Template ID, user ID, and outcome are required' },
        { status: 400 }
      );
    }

    // Record usage for learning
    await recommendationEngine.recordUsage(templateId, userId, context || {}, outcome);

    return NextResponse.json({
      success: true,
      message: 'Usage recorded for recommendation learning'
    });
  } catch (error) {
    console.error('Error recording usage:', error);
    return NextResponse.json(
      { error: 'Failed to record usage' },
      { status: 500 }
    );
  }
}