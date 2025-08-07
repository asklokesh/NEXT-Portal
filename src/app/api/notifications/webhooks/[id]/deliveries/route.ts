import { NextRequest, NextResponse } from 'next/server';
import { webhookManager } from '@/lib/notifications/webhook-manager';
import { auth } from '@/lib/auth';

// GET /api/notifications/webhooks/[id]/deliveries - Get delivery history for webhook
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
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    
    const deliveries = await webhookManager.getDeliveryHistory(params.id, limit);
    
    return NextResponse.json({ deliveries });
  } catch (error) {
    console.error('Failed to get delivery history:', error);
    return NextResponse.json({ error: 'Failed to get delivery history' }, { status: 500 });
  }
}