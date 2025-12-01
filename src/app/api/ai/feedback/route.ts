/**
 * AI Feedback API Route
 * Handles user feedback for AI responses
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAIAssistant } from '@/services/ai-knowledge-assistant';
import { AIFeedback } from '@/services/ai-knowledge-assistant/types';

export const dynamic = 'force-dynamic';

// Submit feedback
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { messageId, conversationId, userId, rating, category, comment } = body;

    if (!messageId || !conversationId || !userId || !rating) {
      return NextResponse.json(
        { error: 'messageId, conversationId, userId, and rating are required' },
        { status: 400 }
      );
    }

    if (!['positive', 'negative'].includes(rating)) {
      return NextResponse.json(
        { error: 'Rating must be "positive" or "negative"' },
        { status: 400 }
      );
    }

    const assistant = await getAIAssistant();
    await assistant.submitFeedback({
      messageId,
      conversationId,
      userId,
      rating,
      category,
      comment,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to submit feedback:', error);
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    );
  }
}
