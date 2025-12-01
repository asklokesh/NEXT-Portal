/**
 * AI Conversations API Route
 * Manages conversation history for the AI assistant
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAIAssistant } from '@/services/ai-knowledge-assistant';

export const dynamic = 'force-dynamic';

// List conversations
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20', 10);
  const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0', 10);

  if (!userId) {
    return NextResponse.json(
      { error: 'User ID is required' },
      { status: 400 }
    );
  }

  try {
    const assistant = await getAIAssistant();
    const conversations = await assistant.listConversations(userId, limit, offset);

    return NextResponse.json({
      conversations,
      total: conversations.length,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Failed to list conversations:', error);
    return NextResponse.json(
      { error: 'Failed to list conversations' },
      { status: 500 }
    );
  }
}

// Delete a conversation
export async function DELETE(request: NextRequest) {
  const { conversationId, userId } = await request.json();

  if (!conversationId || !userId) {
    return NextResponse.json(
      { error: 'Conversation ID and User ID are required' },
      { status: 400 }
    );
  }

  try {
    const assistant = await getAIAssistant();
    const success = await assistant.deleteConversation(conversationId, userId);

    if (!success) {
      return NextResponse.json(
        { error: 'Conversation not found or unauthorized' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete conversation:', error);
    return NextResponse.json(
      { error: 'Failed to delete conversation' },
      { status: 500 }
    );
  }
}
