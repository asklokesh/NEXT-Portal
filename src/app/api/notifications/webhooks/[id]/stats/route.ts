import { NextRequest, NextResponse } from 'next/server';
import { webhookManager } from '@/lib/notifications/webhook-manager';
import { auth } from '@/lib/auth';

// GET /api/notifications/webhooks/[id]/stats - Get webhook statistics
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);
    
    const stats = await webhookManager.getWebhookStats(params.id, days);
    
    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Failed to get webhook stats:', error);
    return NextResponse.json({ error: 'Failed to get webhook stats' }, { status: 500 });
  }
}