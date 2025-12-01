/**
 * AI Chat API Route
 * Handles chat requests to the AI Knowledge Assistant
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAIAssistant } from '@/services/ai-knowledge-assistant';
import { AIQueryRequest } from '@/services/ai-knowledge-assistant/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body: AIQueryRequest = await request.json();

    if (!body.query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    const assistant = await getAIAssistant();
    const response = await assistant.query(body);

    return NextResponse.json(response);
  } catch (error) {
    console.error('AI chat error:', error);
    return NextResponse.json(
      { error: 'Failed to process AI query' },
      { status: 500 }
    );
  }
}

// Streaming endpoint
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('query');
  const conversationId = request.nextUrl.searchParams.get('conversationId');

  if (!query) {
    return NextResponse.json(
      { error: 'Query is required' },
      { status: 400 }
    );
  }

  try {
    const assistant = await getAIAssistant();

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of assistant.queryStream({
            query,
            conversationId: conversationId || undefined,
          })) {
            const data = JSON.stringify(chunk);
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('AI streaming error:', error);
    return NextResponse.json(
      { error: 'Failed to stream AI response' },
      { status: 500 }
    );
  }
}
