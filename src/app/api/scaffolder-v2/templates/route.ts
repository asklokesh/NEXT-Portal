import { NextRequest, NextResponse } from 'next/server';
import { ScaffolderTemplate } from '@/lib/scaffolder-v2/types';
import { TemplateMarketplaceEngine } from '@/lib/scaffolder-v2/marketplace-engine';
import { TemplateRecommendationEngine } from '@/lib/scaffolder-v2/recommendation-engine';

const marketplaceEngine = TemplateMarketplaceEngine.getInstance();
const recommendationEngine = TemplateRecommendationEngine.getInstance();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const featured = searchParams.get('featured') === 'true';
    const trending = searchParams.get('trending') === 'true';
    const recent = searchParams.get('recent') === 'true';
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get marketplace data
    const marketplace = await marketplaceEngine.getMarketplace(userId || undefined);

    if (search) {
      // Search templates
      const searchResult = await marketplaceEngine.searchTemplates(
        search,
        {
          categories: category ? [category] : undefined,
          sortBy: 'popularity'
        },
        userId || undefined
      );

      return NextResponse.json({
        templates: searchResult.templates.slice(offset, offset + limit),
        totalCount: searchResult.totalCount,
        facets: searchResult.facets,
        suggestions: searchResult.suggestions
      });
    }

    if (featured) {
      const featuredTemplates = marketplace.templates.filter(t => 
        marketplace.featured.includes(t.id)
      );
      return NextResponse.json({ templates: featuredTemplates });
    }

    if (trending) {
      const trendingTemplates = marketplace.templates.filter(t => 
        marketplace.trending.includes(t.id)
      );
      return NextResponse.json({ templates: trendingTemplates });
    }

    if (recent) {
      const recentTemplates = marketplace.templates.filter(t => 
        marketplace.recent.includes(t.id)
      );
      return NextResponse.json({ templates: recentTemplates });
    }

    if (category) {
      const categoryTemplates = await marketplaceEngine.getTemplatesByCategory(
        category,
        limit,
        offset
      );
      return NextResponse.json({ templates: categoryTemplates });
    }

    // Return paginated templates
    const templates = marketplace.templates.slice(offset, offset + limit);
    
    return NextResponse.json({
      templates,
      totalCount: marketplace.templates.length,
      categories: marketplace.categories,
      featured: marketplace.featured,
      trending: marketplace.trending,
      recent: marketplace.recent
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ScaffolderTemplate & { publisherUserId: string; publishOptions?: any } = await request.json();
    
    if (!body.publisherUserId) {
      return NextResponse.json(
        { error: 'Publisher user ID is required' },
        { status: 400 }
      );
    }

    const { publisherUserId, publishOptions, ...template } = body;

    // Publish template
    const result = await marketplaceEngine.publishTemplate(
      template,
      publisherUserId,
      publishOptions || {}
    );

    if (!result.success) {
      return NextResponse.json(
        { 
          error: 'Failed to publish template',
          details: result.errors,
          warnings: result.warnings
        },
        { status: 400 }
      );
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error publishing template:', error);
    return NextResponse.json(
      { error: 'Failed to publish template' },
      { status: 500 }
    );
  }
}