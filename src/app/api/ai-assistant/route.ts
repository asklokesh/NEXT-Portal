
import { NextResponse } from 'next/server';
import { AIAssistant } from '@/services/ai-assistant/ai-assistant';
import { getRootLogger } from '@backstage/backend-common';

const logger = getRootLogger();
const assistant = new AIAssistant(logger);
assistant.initialize();

export async function POST(request: Request) {
  const { query } = await request.json();
  const response = await assistant.processQuery(query);
  return NextResponse.json({ response });
}
