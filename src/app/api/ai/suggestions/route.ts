/**
 * AI Suggestions API Route
 * Provides suggested questions based on context
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAIAssistant } from '@/services/ai-knowledge-assistant';
import { AIConversationContext } from '@/services/ai-knowledge-assistant/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body: Partial<AIConversationContext> = await request.json();

    const context: AIConversationContext = {
      userRole: body.userRole || 'developer',
      sessionId: body.sessionId || 'default',
      currentPage: body.currentPage,
      currentEntity: body.currentEntity,
      team: body.team,
      recentEntities: body.recentEntities,
    };

    const assistant = await getAIAssistant();
    const suggestions = await assistant.getSuggestedQuestions(context);

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('Failed to get suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to get suggestions' },
      { status: 500 }
    );
  }
}
