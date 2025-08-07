import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { webhookManager } from '@/lib/sync/WebhookManager';

// Backstage webhook event schemas
const BackstageEntityEventSchema = z.object({
  type: z.enum([
    'entity.added',
    'entity.updated',
    'entity.removed',
    'entity.refresh',
    'entity.error',
  ]),
  entity: z.object({
    apiVersion: z.string(),
    kind: z.string(),
    metadata: z.object({
      name: z.string(),
      namespace: z.string().optional(),
      uid: z.string().optional(),
      labels: z.record(z.string()).optional(),
      annotations: z.record(z.string()).optional(),
      tags: z.array(z.string()).optional(),
    }),
    spec: z.record(z.any()).optional(),
    status: z.record(z.any()).optional(),
  }),
  timestamp: z.number(),
  source: z.string().optional(),
  processingResult: z.object({
    ok: z.boolean(),
    errors: z.array(z.object({
      message: z.string(),
      name: z.string().optional(),
    })).optional(),
  }).optional(),
});

const BackstageTemplateEventSchema = z.object({
  type: z.enum([
    'template.registered',
    'template.updated',
    'template.removed',
    'template.executed',
    'template.execution.started',
    'template.execution.completed',
    'template.execution.failed',
  ]),
  template: z.object({
    name: z.string(),
    namespace: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    spec: z.object({
      type: z.string().optional(),
      parameters: z.array(z.any()).optional(),
      steps: z.array(z.any()).optional(),
    }).optional(),
  }),
  execution: z.object({
    id: z.string(),
    status: z.enum(['started', 'running', 'completed', 'failed', 'cancelled']),
    user: z.string().optional(),
    parameters: z.record(z.any()).optional(),
    output: z.record(z.any()).optional(),
    errors: z.array(z.string()).optional(),
    duration: z.number().optional(),
  }).optional(),
  timestamp: z.number(),
  source: z.string().optional(),
});

const BackstagePluginEventSchema = z.object({
  type: z.enum([
    'plugin.installed',
    'plugin.updated',
    'plugin.removed',
    'plugin.enabled',
    'plugin.disabled',
    'plugin.configured',
    'plugin.error',
  ]),
  plugin: z.object({
    id: z.string(),
    name: z.string(),
    version: z.string(),
    enabled: z.boolean(),
    configuration: z.record(z.any()).optional(),
  }),
  timestamp: z.number(),
  source: z.string().optional(),
  error: z.object({
    message: z.string(),
    stack: z.string().optional(),
  }).optional(),
});

const BackstageHealthEventSchema = z.object({
  type: z.enum([
    'health.check.started',
    'health.check.completed',
    'health.check.failed',
    'health.service.degraded',
    'health.service.recovered',
  ]),
  service: z.string(),
  status: z.enum(['healthy', 'degraded', 'unhealthy', 'unknown']),
  checks: z.array(z.object({
    name: z.string(),
    status: z.enum(['ok', 'warning', 'error']),
    message: z.string().optional(),
    timestamp: z.number(),
  })).optional(),
  timestamp: z.number(),
  source: z.string().optional(),
});

// Rate limiting (same as GitHub webhook)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = {
  maxRequests: 200, // Higher limit for Backstage internal events
  windowMs: 60000, // 1 minute
};

function checkRateLimit(clientId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const current = rateLimitStore.get(clientId);

  if (!current || now >= current.resetTime) {
    rateLimitStore.set(clientId, {
      count: 1,
      resetTime: now + RATE_LIMIT.windowMs,
    });
    return { allowed: true, remaining: RATE_LIMIT.maxRequests - 1 };
  }

  const remaining = Math.max(0, RATE_LIMIT.maxRequests - current.count);
  if (remaining === 0) {
    return { allowed: false, remaining: 0 };
  }

  current.count++;
  return { allowed: true, remaining: remaining - 1 };
}

function verifyBackstageSignature(payload: string, signature: string, secret: string): boolean {
  if (!signature || !signature.startsWith('sha256=')) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');

  const providedSignature = signature.slice(7); // Remove 'sha256=' prefix

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    );
  } catch {
    return false;
  }
}

async function processEntityEvent(payload: z.infer<typeof BackstageEntityEventSchema>): Promise<void> {
  const { type, entity, processingResult } = payload;

  // Send generic entity event
  await webhookManager.sendEvent(`backstage.${type}`, {
    entity: {
      kind: entity.kind,
      name: entity.metadata.name,
      namespace: entity.metadata.namespace || 'default',
      uid: entity.metadata.uid,
      labels: entity.metadata.labels,
      annotations: entity.metadata.annotations,
      tags: entity.metadata.tags,
    },
    processingResult,
    timestamp: payload.timestamp,
  });

  // Send entity-specific events based on kind
  const entityKind = entity.kind.toLowerCase();
  await webhookManager.sendEvent(`catalog.${entityKind}.${type.split('.')[1]}`, {
    entity: entity.metadata.name,
    namespace: entity.metadata.namespace || 'default',
    kind: entity.kind,
    uid: entity.metadata.uid,
    timestamp: payload.timestamp,
  });

  // Send team-specific events if entity has team ownership
  const teamAnnotation = entity.metadata.annotations?.['backstage.io/managed-by-origin'] ||
                         entity.metadata.annotations?.['team'] ||
                         entity.metadata.labels?.['team'];
  
  if (teamAnnotation) {
    await webhookManager.sendEvent('team.entity.updated', {
      team: teamAnnotation,
      entity: entity.metadata.name,
      kind: entity.kind,
      action: type.split('.')[1],
      timestamp: payload.timestamp,
    });
  }
}

async function processTemplateEvent(payload: z.infer<typeof BackstageTemplateEventSchema>): Promise<void> {
  const { type, template, execution } = payload;

  // Send generic template event
  await webhookManager.sendEvent(`backstage.${type}`, {
    template: {
      name: template.name,
      namespace: template.namespace || 'default',
      title: template.title,
      description: template.description,
      tags: template.tags,
      type: template.spec?.type,
    },
    execution: execution ? {
      id: execution.id,
      status: execution.status,
      user: execution.user,
      duration: execution.duration,
    } : undefined,
    timestamp: payload.timestamp,
  });

  // Send specific template execution events
  if (execution) {
    await webhookManager.sendEvent('scaffolder.task.updated', {
      taskId: execution.id,
      status: execution.status,
      template: template.name,
      user: execution.user,
      parameters: execution.parameters,
      output: execution.output,
      errors: execution.errors,
      timestamp: payload.timestamp,
    });

    // Send completion notifications
    if (execution.status === 'completed' || execution.status === 'failed') {
      await webhookManager.sendEvent('notification.template.execution', {
        type: execution.status === 'completed' ? 'success' : 'error',
        title: `Template ${execution.status}`,
        message: execution.status === 'completed' 
          ? `Template "${template.title || template.name}" executed successfully`
          : `Template "${template.title || template.name}" execution failed`,
        template: template.name,
        taskId: execution.id,
        user: execution.user,
        timestamp: payload.timestamp,
      });
    }
  }
}

async function processPluginEvent(payload: z.infer<typeof BackstagePluginEventSchema>): Promise<void> {
  const { type, plugin, error } = payload;

  // Send generic plugin event
  await webhookManager.sendEvent(`backstage.${type}`, {
    plugin: {
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      enabled: plugin.enabled,
    },
    error: error ? {
      message: error.message,
    } : undefined,
    timestamp: payload.timestamp,
  });

  // Send plugin status updates
  await webhookManager.sendEvent('plugin.status.updated', {
    pluginId: plugin.id,
    name: plugin.name,
    version: plugin.version,
    status: plugin.enabled ? 'enabled' : 'disabled',
    action: type.split('.')[1],
    timestamp: payload.timestamp,
  });

  // Send error notifications for plugin issues
  if (error) {
    await webhookManager.sendEvent('notification.plugin.error', {
      type: 'error',
      title: 'Plugin Error',
      message: `Plugin "${plugin.name}" encountered an error: ${error.message}`,
      pluginId: plugin.id,
      pluginName: plugin.name,
      timestamp: payload.timestamp,
    });
  }
}

async function processHealthEvent(payload: z.infer<typeof BackstageHealthEventSchema>): Promise<void> {
  const { type, service, status, checks } = payload;

  // Send generic health event
  await webhookManager.sendEvent(`backstage.${type}`, {
    service,
    status,
    checks: checks?.map(check => ({
      name: check.name,
      status: check.status,
      message: check.message,
    })),
    timestamp: payload.timestamp,
  });

  // Send service-specific health updates
  await webhookManager.sendEvent('health.service.updated', {
    service,
    status,
    previousStatus: status, // In a real implementation, track previous status
    checksCount: checks?.length || 0,
    failedChecks: checks?.filter(c => c.status === 'error').length || 0,
    timestamp: payload.timestamp,
  });

  // Send alerts for degraded or unhealthy services
  if (status === 'degraded' || status === 'unhealthy') {
    await webhookManager.sendEvent('alert.service.health', {
      severity: status === 'unhealthy' ? 'critical' : 'warning',
      service,
      status,
      message: `Service ${service} is ${status}`,
      checks: checks?.filter(c => c.status !== 'ok'),
      timestamp: payload.timestamp,
    });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';
    const rateLimitResult = checkRateLimit(clientIp);
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + 60),
          },
        }
      );
    }

    // Get webhook headers
    const signature = request.headers.get('x-backstage-signature') || '';
    const eventType = request.headers.get('x-backstage-event') || '';
    const deliveryId = request.headers.get('x-backstage-delivery') || 
                      request.headers.get('x-request-id') || 
                      crypto.randomUUID();

    if (!eventType) {
      return NextResponse.json(
        { error: 'Missing X-Backstage-Event header' },
        { status: 400 }
      );
    }

    // Get payload
    const payload = await request.text();
    if (!payload) {
      return NextResponse.json(
        { error: 'Empty payload' },
        { status: 400 }
      );
    }

    // Verify signature if secret is configured
    const webhookSecret = process.env.BACKSTAGE_WEBHOOK_SECRET;
    if (webhookSecret && signature) {
      if (!verifyBackstageSignature(payload, signature, webhookSecret)) {
        console.warn(`Invalid Backstage webhook signature for delivery ${deliveryId}`);
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    }

    // Parse JSON payload
    let parsedPayload;
    try {
      parsedPayload = JSON.parse(payload);
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    console.log(`Received Backstage webhook: ${eventType} (delivery: ${deliveryId})`);

    // Process different event types
    try {
      if (eventType.startsWith('entity.')) {
        const entityPayload = BackstageEntityEventSchema.parse(parsedPayload);
        await processEntityEvent(entityPayload);
      } else if (eventType.startsWith('template.')) {
        const templatePayload = BackstageTemplateEventSchema.parse(parsedPayload);
        await processTemplateEvent(templatePayload);
      } else if (eventType.startsWith('plugin.')) {
        const pluginPayload = BackstagePluginEventSchema.parse(parsedPayload);
        await processPluginEvent(pluginPayload);
      } else if (eventType.startsWith('health.')) {
        const healthPayload = BackstageHealthEventSchema.parse(parsedPayload);
        await processHealthEvent(healthPayload);
      } else {
        // Handle unknown event types
        console.log(`Unhandled Backstage event type: ${eventType}`);
        await webhookManager.sendEvent(`backstage.${eventType}`, {
          eventType,
          data: parsedPayload,
          timestamp: Date.now(),
        });
      }

      return NextResponse.json(
        { 
          success: true, 
          eventType,
          deliveryId,
          processed: true,
        },
        {
          headers: {
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          },
        }
      );

    } catch (processingError) {
      console.error(`Error processing Backstage webhook ${eventType}:`, processingError);
      
      // Still return success to avoid retries for processing errors
      return NextResponse.json(
        { 
          success: true, 
          eventType,
          deliveryId,
          processed: false,
          error: 'Processing error - logged for investigation',
        },
        {
          headers: {
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          },
        }
      );
    }

  } catch (error) {
    console.error('Backstage webhook handler error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Handle GET requests for webhook validation and status
export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const challenge = searchParams.get('challenge');
  
  if (challenge) {
    // Backstage webhook validation
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return NextResponse.json({
    service: 'Backstage Webhook Handler',
    status: 'active',
    timestamp: new Date().toISOString(),
    supportedEvents: [
      'entity.added',
      'entity.updated', 
      'entity.removed',
      'entity.refresh',
      'entity.error',
      'template.registered',
      'template.updated',
      'template.removed',
      'template.executed',
      'template.execution.started',
      'template.execution.completed',
      'template.execution.failed',
      'plugin.installed',
      'plugin.updated',
      'plugin.removed',
      'plugin.enabled',
      'plugin.disabled',
      'plugin.configured',
      'plugin.error',
      'health.check.started',
      'health.check.completed',
      'health.check.failed',
      'health.service.degraded',
      'health.service.recovered',
    ],
  });
}