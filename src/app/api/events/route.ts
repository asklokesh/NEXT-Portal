/**
 * Event Management API
 * Publish events, manage subscriptions, and monitor event processing
 */

import { NextRequest, NextResponse } from 'next/server';
import { eventBus } from '@/lib/events/event-bus';
import { EventTypes } from '@/lib/events/domain-events';
import { extractTenantContext, validateTenantAccess } from '@/middleware/tenant-context';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

interface PublishEventRequest {
  topic: string;
  eventType: string;
  source: string;
  data: any;
  metadata?: {
    priority?: 'low' | 'normal' | 'high' | 'critical';
    ttl?: number;
    tags?: string[];
  };
  correlationId?: string;
  causationId?: string;
}

/**
 * GET /api/events - Get event bus status and metrics
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action') || 'metrics';

    // Check admin access for most operations
    const userRole = request.headers.get('x-user-role');
    if (userRole !== 'admin' && action !== 'health') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    switch (action) {
      case 'health':
        return NextResponse.json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          eventBus: {
            connected: true,
            topics: eventBus.getTopics().length,
            subscriptions: eventBus.getSubscriptions().length
          }
        });

      case 'metrics':
        const metrics = eventBus.getMetrics();
        return NextResponse.json({
          metrics,
          topics: eventBus.getTopics(),
          subscriptions: eventBus.getSubscriptions().map(sub => ({
            id: sub.id,
            topic: sub.topic,
            eventTypes: sub.eventTypes,
            status: sub.status,
            totalProcessed: sub.totalProcessed,
            totalErrors: sub.totalErrors,
            lastProcessed: sub.lastProcessed
          }))
        });

      case 'topics':
        return NextResponse.json({
          topics: eventBus.getTopics()
        });

      case 'subscriptions':
        const tenantContext = extractTenantContext(request);
        let subscriptions = eventBus.getSubscriptions();

        // Filter by tenant if not admin
        if (userRole !== 'admin' && tenantContext) {
          subscriptions = subscriptions.filter(sub => 
            sub.consumer.includes(tenantContext.tenantId)
          );
        }

        return NextResponse.json({
          subscriptions: subscriptions.map(sub => ({
            id: sub.id,
            topic: sub.topic,
            eventTypes: sub.eventTypes,
            status: sub.status,
            createdAt: sub.createdAt,
            totalProcessed: sub.totalProcessed,
            totalErrors: sub.totalErrors,
            lastProcessed: sub.lastProcessed
          }))
        });

      case 'event-types':
        return NextResponse.json({
          eventTypes: Object.values(EventTypes),
          categories: {
            plugin: Object.values(EventTypes).filter(t => t.startsWith('plugin.')),
            user: Object.values(EventTypes).filter(t => t.startsWith('user.')),
            tenant: Object.values(EventTypes).filter(t => t.startsWith('tenant.')),
            billing: Object.values(EventTypes).filter(t => t.startsWith('billing.')),
            security: Object.values(EventTypes).filter(t => t.startsWith('security.')),
            system: Object.values(EventTypes).filter(t => t.startsWith('system.')),
            analytics: Object.values(EventTypes).filter(t => t.startsWith('analytics.')),
            workflow: Object.values(EventTypes).filter(t => t.startsWith('workflow.')),
            integration: Object.values(EventTypes).filter(t => t.startsWith('integration.'))
          }
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported: health, metrics, topics, subscriptions, event-types' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error processing events request:', error);
    return NextResponse.json(
      { error: 'Failed to process events request' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/events - Publish event or manage subscriptions
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    const tenantContext = extractTenantContext(request);
    const userRole = request.headers.get('x-user-role');

    // Validate access
    if (userRole !== 'admin' && action !== 'publish') {
      return NextResponse.json(
        { error: 'Admin access required for this action' },
        { status: 403 }
      );
    }

    switch (action) {
      case 'publish':
        return await handlePublishEvent(body, tenantContext);

      case 'subscribe':
        return await handleSubscribe(body, tenantContext);

      case 'unsubscribe':
        return await handleUnsubscribe(body);

      case 'create-topic':
        return await handleCreateTopic(body);

      case 'reset-metrics':
        eventBus.resetMetrics();
        return NextResponse.json({
          message: 'Metrics reset successfully'
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported: publish, subscribe, unsubscribe, create-topic, reset-metrics' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error processing events operation:', error);
    return NextResponse.json(
      { error: 'Failed to process events operation' },
      { status: 500 }
    );
  }
}

/**
 * Handle event publishing
 */
async function handlePublishEvent(
  body: { data: PublishEventRequest },
  tenantContext: any
): Promise<NextResponse> {
  const { topic, eventType, source, data, metadata, correlationId, causationId } = body.data;

  if (!topic || !eventType || !source || !data) {
    return NextResponse.json(
      { error: 'Missing required fields: topic, eventType, source, data' },
      { status: 400 }
    );
  }

  // Validate tenant access for the topic
  if (tenantContext) {
    const hasAccess = await validateTenantAccess(tenantContext.tenantId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Tenant access denied' },
        { status: 403 }
      );
    }
  }

  try {
    const eventId = await eventBus.publishEvent(topic, {
      type: eventType,
      source,
      tenantId: tenantContext?.tenantId,
      userId: tenantContext?.userId,
      data,
      metadata: {
        contentType: 'application/json',
        encoding: 'utf-8',
        schemaVersion: '1.0',
        priority: metadata?.priority || 'normal',
        ttl: metadata?.ttl,
        tags: metadata?.tags
      },
      version: '1.0',
      correlationId,
      causationId
    });

    return NextResponse.json({
      eventId,
      message: 'Event published successfully',
      topic,
      eventType
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to publish event' },
      { status: 500 }
    );
  }
}

/**
 * Handle subscription creation
 */
async function handleSubscribe(
  body: { data: { topic: string; eventTypes: string[]; consumerGroup?: string } },
  tenantContext: any
): Promise<NextResponse> {
  const { topic, eventTypes, consumerGroup } = body.data;

  if (!topic || !eventTypes || eventTypes.length === 0) {
    return NextResponse.json(
      { error: 'Missing required fields: topic, eventTypes' },
      { status: 400 }
    );
  }

  try {
    const subscriptionId = await eventBus.subscribe(
      topic,
      eventTypes,
      {
        eventType: eventTypes[0], // Primary event type
        handler: async (event) => {
          // Default handler - logs event
          console.log(`Received event: ${event.type}`, event.data);
        },
        options: {
          retries: 3,
          timeout: 30000
        }
      },
      {
        consumerGroup: consumerGroup || (tenantContext?.tenantId ? `tenant-${tenantContext.tenantId}` : 'default')
      }
    );

    return NextResponse.json({
      subscriptionId,
      message: 'Subscription created successfully',
      topic,
      eventTypes
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 }
    );
  }
}

/**
 * Handle subscription removal
 */
async function handleUnsubscribe(
  body: { data: { subscriptionId: string } }
): Promise<NextResponse> {
  const { subscriptionId } = body.data;

  if (!subscriptionId) {
    return NextResponse.json(
      { error: 'Missing required field: subscriptionId' },
      { status: 400 }
    );
  }

  try {
    await eventBus.unsubscribe(subscriptionId);

    return NextResponse.json({
      message: 'Subscription removed successfully',
      subscriptionId
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to remove subscription' },
      { status: 500 }
    );
  }
}

/**
 * Handle topic creation
 */
async function handleCreateTopic(
  body: { data: { name: string; partitions?: number; retentionMs?: number; compacted?: boolean } }
): Promise<NextResponse> {
  const { name, partitions = 3, retentionMs = 7 * 24 * 60 * 60 * 1000, compacted = false } = body.data;

  if (!name) {
    return NextResponse.json(
      { error: 'Missing required field: name' },
      { status: 400 }
    );
  }

  try {
    await eventBus.createTopic({
      name,
      partitions,
      replicationFactor: 1,
      retentionMs,
      compacted,
      config: {}
    });

    return NextResponse.json({
      message: 'Topic created successfully',
      topic: {
        name,
        partitions,
        retentionMs,
        compacted
      }
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create topic' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/events - Reset event bus or remove subscriptions
 */
export async function DELETE(request: NextRequest) {
  try {
    const userRole = request.headers.get('x-user-role');
    if (userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');
    const subscriptionId = searchParams.get('subscriptionId');

    if (action === 'reset-metrics') {
      eventBus.resetMetrics();
      return NextResponse.json({
        message: 'Event bus metrics reset successfully'
      });
    }

    if (action === 'remove-subscription' && subscriptionId) {
      await eventBus.unsubscribe(subscriptionId);
      return NextResponse.json({
        message: 'Subscription removed successfully',
        subscriptionId
      });
    }

    return NextResponse.json(
      { error: 'Invalid action or missing parameters' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error processing events delete request:', error);
    return NextResponse.json(
      { error: 'Failed to process delete request' },
      { status: 500 }
    );
  }
}