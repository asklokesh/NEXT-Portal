/**
 * Knowledge Base Article API Routes
 * 
 * Individual article operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { knowledgeBaseService } from '@/services/knowledge-base/kb-service';

interface RouteParams {
  params: {
    slug: string;
  };
}

// GET /api/knowledge-base/[slug] - Get article by slug
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = params;
    const { searchParams } = new URL(request.url);
    const noIncrement = searchParams.get('no_increment') === 'true';

    const article = await knowledgeBaseService.getArticle(slug, !noIncrement);

    if (!article) {
      return NextResponse.json(
        {
          success: false,
          error: 'Article not found',
          message: 'The requested article could not be found'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: article
    });
  } catch (error: any) {
    console.error('GET /api/knowledge-base/[slug] error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch article',
        message: error.message
      },
      { status: 500 }
    );
  }
}

// PUT /api/knowledge-base/[slug] - Update article
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = params;
    const body = await request.json();
    
    // Extract user ID from session/auth (mock for now)
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role') || '';

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          message: 'User must be authenticated to update articles'
        },
        { status: 401 }
      );
    }

    // Check if user has permission to update articles
    if (userRole !== 'ADMIN' && userRole !== 'PLATFORM_ENGINEER') {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          message: 'Only admins can update articles'
        },
        { status: 403 }
      );
    }

    // Get current article to get ID
    const currentArticle = await knowledgeBaseService.getArticle(slug, false);
    
    if (!currentArticle) {
      return NextResponse.json(
        {
          success: false,
          error: 'Article not found',
          message: 'The requested article could not be found'
        },
        { status: 404 }
      );
    }

    const updatedArticle = await knowledgeBaseService.updateArticle(currentArticle.id, body);

    return NextResponse.json({
      success: true,
      data: updatedArticle,
      message: 'Article updated successfully'
    });
  } catch (error: any) {
    console.error('PUT /api/knowledge-base/[slug] error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update article',
        message: error.message
      },
      { status: 500 }
    );
  }
}