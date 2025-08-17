/**
 * Knowledge Base API Routes
 * 
 * RESTful API endpoints for knowledge base system:
 * - CRUD operations for articles
 * - Search functionality
 * - Categories and tags
 */

import { NextRequest, NextResponse } from 'next/server';
import { knowledgeBaseService } from '@/services/knowledge-base/kb-service';

// GET /api/knowledge-base - Search/list knowledge base articles
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const query = searchParams.get('query');
    
    if (query) {
      // Search articles
      const params = {
        query,
        category: searchParams.get('category') || undefined,
        tags: searchParams.getAll('tags'),
        page: parseInt(searchParams.get('page') || '1'),
        limit: parseInt(searchParams.get('limit') || '20'),
        sortBy: searchParams.get('sortBy') as 'relevance' | 'views' | 'date' | 'helpful' || 'relevance'
      };

      const result = await knowledgeBaseService.searchArticles(params);
      
      return NextResponse.json({
        success: true,
        data: result
      });
    } else {
      // Get recent articles
      const limit = parseInt(searchParams.get('limit') || '10');
      const articles = await knowledgeBaseService.getRecentArticles(limit);
      
      return NextResponse.json({
        success: true,
        data: { articles }
      });
    }
  } catch (error: any) {
    console.error('GET /api/knowledge-base error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch articles',
        message: error.message
      },
      { status: 500 }
    );
  }
}

// POST /api/knowledge-base - Create new article
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Extract user ID from session/auth (mock for now)
    const authorId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role') || '';

    if (!authorId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          message: 'User must be authenticated to create articles'
        },
        { status: 401 }
      );
    }

    // Check if user has permission to create articles
    if (userRole !== 'ADMIN' && userRole !== 'PLATFORM_ENGINEER') {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          message: 'Only admins can create articles'
        },
        { status: 403 }
      );
    }

    const article = await knowledgeBaseService.createArticle(authorId, body);

    return NextResponse.json({
      success: true,
      data: article,
      message: 'Article created successfully'
    }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/knowledge-base error:', error);
    
    if (error.message.includes('validation') || error.message.includes('already exists')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          message: error.message
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create article',
        message: error.message
      },
      { status: 500 }
    );
  }
}