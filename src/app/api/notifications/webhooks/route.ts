import { NextRequest, NextResponse } from 'next/server';
import { webhookManager, WebhookConfig } from '@/lib/notifications/webhook-manager';
import { auth } from '@/lib/auth';

// GET /api/notifications/webhooks - List webhooks for current tenant
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    // In production, verify user has access to this tenant
    const webhooks = await webhookManager.listWebhooks(tenantId || undefined);
    
    return NextResponse.json({ webhooks });
  } catch (error) {
    console.error('Failed to list webhooks:', error);
    return NextResponse.json({ error: 'Failed to list webhooks' }, { status: 500 });
  }
}

// POST /api/notifications/webhooks - Create new webhook
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    
    // Validate required fields
    if (!data.name || !data.url || !data.events) {
      return NextResponse.json({ 
        error: 'Missing required fields: name, url, events' 
      }, { status: 400 });
    }

    // Generate secret if not provided
    if (!data.secret) {
      data.secret = crypto.randomUUID();
    }

    // Set default retry configuration
    if (!data.retryConfig) {
      data.retryConfig = {
        maxRetries: 3,
        retryDelay: 5, // seconds
        backoffMultiplier: 2
      };
    }

    const webhookConfig: Omit<WebhookConfig, 'id' | 'createdAt' | 'updatedAt'> = {
      name: data.name,
      url: data.url,
      secret: data.secret,
      enabled: data.enabled !== false, // Default to true
      events: Array.isArray(data.events) ? data.events : [],
      headers: data.headers || {},
      timeout: data.timeout || 30000,
      retryConfig: data.retryConfig,
      filters: data.filters,
      tenantId: data.tenantId,
      createdBy: session.user.id || session.user.email || 'unknown'
    };

    const webhook = await webhookManager.registerWebhook(webhookConfig);
    
    return NextResponse.json({ webhook }, { status: 201 });
  } catch (error) {
    console.error('Failed to create webhook:', error);
    return NextResponse.json({ error: 'Failed to create webhook' }, { status: 500 });
  }
}

// PUT /api/notifications/webhooks - Update webhook
export async function PUT(request: NextRequest) {
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

    const data = await request.json();
    
    const webhook = await webhookManager.updateWebhook(webhookId, data);
    
    if (!webhook) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }
    
    return NextResponse.json({ webhook });
  } catch (error) {
    console.error('Failed to update webhook:', error);
    return NextResponse.json({ error: 'Failed to update webhook' }, { status: 500 });
  }
}

// DELETE /api/notifications/webhooks - Delete webhook
export async function DELETE(request: NextRequest) {
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

    const success = await webhookManager.deleteWebhook(webhookId);
    
    if (!success) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete webhook:', error);
    return NextResponse.json({ error: 'Failed to delete webhook' }, { status: 500 });
  }
}