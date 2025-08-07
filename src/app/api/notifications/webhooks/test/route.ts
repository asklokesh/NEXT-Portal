import { NextRequest, NextResponse } from 'next/server';
import { webhookManager } from '@/lib/notifications/webhook-manager';
import { auth } from '@/lib/auth';

// POST /api/notifications/webhooks/test - Test webhook delivery
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const webhookId = searchParams.get('id');
    
    if (!webhookId) {
      return NextResponse.json({ error: 'Webhook ID required' }, { status: 400 });
    }

    const result = await webhookManager.testWebhook(webhookId);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to test webhook:', error);
    return NextResponse.json({ 
      error: 'Failed to test webhook',
      success: false 
    }, { status: 500 });
  }
}