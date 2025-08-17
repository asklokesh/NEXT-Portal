/**
 * Feedback Comments API Routes
 * 
 * Handle comments on feedback items
 */

import { NextRequest, NextResponse } from 'next/server';
import { feedbackService } from '@/services/feedback/feedback-service';

interface RouteParams {
  params: {
    id: string;
  };
}

// POST /api/feedback/[id]/comments - Add comment to feedback
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: feedbackId } = params;
    const body = await request.json();
    const { content, isInternal } = body;

    // Extract user ID from session/auth (mock for now)
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role') || '';
    
    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          message: 'User must be authenticated to comment'
        },
        { status: 401 }
      );
    }

    if (!content || content.trim().length < 1) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid content',
          message: 'Comment content is required'
        },
        { status: 400 }
      );
    }

    // Only admins can create internal comments
    const isInternalComment = isInternal && (userRole === 'ADMIN' || userRole === 'PLATFORM_ENGINEER');

    const comment = await feedbackService.addComment(
      feedbackId,
      userId,
      content.trim(),
      isInternalComment
    );

    return NextResponse.json({
      success: true,
      data: comment,
      message: 'Comment added successfully'
    }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/feedback/[id]/comments error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to add comment',
        message: error.message
      },
      { status: 500 }
    );
  }
}