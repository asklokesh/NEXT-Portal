/**
 * Feedback Voting API Routes
 * 
 * Handle voting on feedback items
 */

import { NextRequest, NextResponse } from 'next/server';
import { feedbackService } from '@/services/feedback/feedback-service';

interface RouteParams {
  params: {
    id: string;
  };
}

// POST /api/feedback/[id]/vote - Vote on feedback
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: feedbackId } = params;
    const body = await request.json();
    const { voteType } = body;

    // Extract user ID from session/auth (mock for now)
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          message: 'User must be authenticated to vote'
        },
        { status: 401 }
      );
    }

    if (!['UPVOTE', 'DOWNVOTE'].includes(voteType)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid vote type',
          message: 'Vote type must be UPVOTE or DOWNVOTE'
        },
        { status: 400 }
      );
    }

    const result = await feedbackService.voteFeedback(feedbackId, userId, voteType);

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Vote recorded successfully'
    });
  } catch (error: any) {
    console.error('POST /api/feedback/[id]/vote error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to record vote',
        message: error.message
      },
      { status: 500 }
    );
  }
}