/**
 * Feedback Analytics API Routes
 * 
 * Analytics and metrics for feedback system
 */

import { NextRequest, NextResponse } from 'next/server';
import { feedbackService } from '@/services/feedback/feedback-service';

// GET /api/feedback/analytics - Get feedback analytics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') as '7d' | '30d' | '90d' | '1y' || '30d';

    // Check admin access
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

    const analytics = await feedbackService.getAnalytics(timeframe);

    return NextResponse.json({
      success: true,
      data: analytics
    });
  } catch (error: any) {
    console.error('GET /api/feedback/analytics error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch feedback analytics',
        message: error.message
      },
      { status: 500 }
    );
  }
}