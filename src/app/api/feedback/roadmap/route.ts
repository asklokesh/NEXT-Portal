/**
 * Feedback Roadmap API Routes
 * 
 * Get roadmap items with feedback integration
 */

import { NextRequest, NextResponse } from 'next/server';
import { feedbackService } from '@/services/feedback/feedback-service';

// GET /api/feedback/roadmap - Get roadmap items
export async function GET(request: NextRequest) {
  try {
    const roadmapItems = await feedbackService.getRoadmap();

    return NextResponse.json({
      success: true,
      data: roadmapItems
    });
  } catch (error: any) {
    console.error('GET /api/feedback/roadmap error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch roadmap',
        message: error.message
      },
      { status: 500 }
    );
  }
}