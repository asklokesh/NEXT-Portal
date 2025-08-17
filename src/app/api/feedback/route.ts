/**
 * Feedback API Routes
 * 
 * RESTful API endpoints for customer feedback system:
 * - Submit feedback with screenshots
 * - Vote on feedback items  
 * - Comment on feedback
 * - View feedback status and roadmap
 */

import { NextRequest, NextResponse } from 'next/server';
import { feedbackService } from '@/services/feedback/feedback-service';
import { z } from 'zod';

// GET /api/feedback - Get feedback items with filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const params = {
      userId: searchParams.get('userId') || undefined,
      type: searchParams.getAll('type'),
      category: searchParams.getAll('category'),
      status: searchParams.getAll('status'),
      priority: searchParams.getAll('priority'),
      tags: searchParams.getAll('tags'),
      sortBy: searchParams.get('sortBy') as 'votes' | 'created' | 'updated' || 'votes',
      sortOrder: searchParams.get('sortOrder') as 'asc' | 'desc' || 'desc',
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
      search: searchParams.get('search') || undefined
    };

    const result = await feedbackService.getFeedback(params);

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('GET /api/feedback error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch feedback',
        message: error.message
      },
      { status: 500 }
    );
  }
}

// POST /api/feedback - Submit new feedback
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Extract user ID from session/auth (mock for now)
    const userId = request.headers.get('x-user-id') || 'anonymous';

    const feedback = await feedbackService.submitFeedback(userId, body);

    return NextResponse.json({
      success: true,
      data: feedback,
      message: 'Feedback submitted successfully'
    }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/feedback error:', error);
    
    if (error.message.includes('validation')) {
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
        error: 'Failed to submit feedback',
        message: error.message
      },
      { status: 500 }
    );
  }
}

// PUT /api/feedback/[id] - Update feedback status (admin only)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { feedbackId, status, notes } = body;
    
    // Extract admin user ID from session/auth (mock for now)
    const adminUserId = request.headers.get('x-user-id') || '';
    const userRole = request.headers.get('x-user-role') || '';

    if (userRole !== 'ADMIN' && userRole !== 'PLATFORM_ENGINEER') {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          message: 'Admin access required'
        },
        { status: 403 }
      );
    }

    const updatedFeedback = await feedbackService.updateFeedbackStatus(
      feedbackId,
      status,
      adminUserId,
      notes
    );

    return NextResponse.json({
      success: true,
      data: updatedFeedback,
      message: 'Feedback status updated successfully'
    });
  } catch (error: any) {
    console.error('PUT /api/feedback error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update feedback',
        message: error.message
      },
      { status: 500 }
    );
  }
}