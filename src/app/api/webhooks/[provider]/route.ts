import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { webhookManager } from '@/lib/sync/WebhookManager';

// Generic webhook event schema
const GenericWebhookEventSchema = z.object({
  event: z.string(),
  data: z.record(z.any()),
  timestamp: z.number().optional(),
  source: z.string().optional(),
  version: z.string().optional(),
});

// Provider-specific configurations
const PROVIDER_CONFIGS = {
  gitlab: {
    signatureHeader: 'x-gitlab-token',
    eventHeader: 'x-gitlab-event',
    userAgent: 'GitLab/',
    signatureMethod: 'token', // Use token comparison instead of HMAC
  },
  bitbucket: {
    signatureHeader: 'x-hub-signature-256',
    eventHeader: 'x-event-key',
    userAgent: 'Bitbucket-Webhooks/',
    signatureMethod: 'hmac-sha256',
  },
  jenkins: {
    signatureHeader: 'x-jenkins-signature',
    eventHeader: 'x-jenkins-event',
    userAgent: 'Jenkins/',
    signatureMethod: 'hmac-sha256',
  },
  jira: {
    signatureHeader: 'x-atlassian-webhook-identifier',
    eventHeader: 'x-atlassian-webhook-type',
    userAgent: 'Atlassian',
    signatureMethod: 'token',
  },
  slack: {
    signatureHeader: 'x-slack-signature',
    eventHeader: 'x-slack-event-type',
    userAgent: 'Slackbot',
    signatureMethod: 'slack', // Special Slack signature format
  },
  docker: {
    signatureHeader: 'authorization',
    eventHeader: 'docker-hub-event',
    userAgent: 'Docker-Hub',
    signatureMethod: 'bearer',
  },
  kubernetes: {
    signatureHeader: 'authorization',
    eventHeader: 'x-kubernetes-event',
    userAgent: 'Kubernetes/',
    signatureMethod: 'bearer',
  },
  custom: {
    signatureHeader: 'x-webhook-signature',
    eventHeader: 'x-webhook-event',
    userAgent: 'Custom-Webhook',
    signatureMethod: 'hmac-sha256',
  },
} as const;

type ProviderName = keyof typeof PROVIDER_CONFIGS;

// Rate limiting per provider
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMITS: Record<string, { maxRequests: number; windowMs: number }> = {
  gitlab: { maxRequests: 100, windowMs: 60000 },
  bitbucket: { maxRequests: 100, windowMs: 60000 },
  jenkins: { maxRequests: 200, windowMs: 60000 },
  jira: { maxRequests: 50, windowMs: 60000 },
  slack: { maxRequests: 300, windowMs: 60000 },
  docker: { maxRequests: 50, windowMs: 60000 },
  kubernetes: { maxRequests: 500, windowMs: 60000 },
  custom: { maxRequests: 100, windowMs: 60000 },
};

function checkRateLimit(provider: string, clientId: string): { allowed: boolean; remaining: number } {
  const rateLimit = RATE_LIMITS[provider] || RATE_LIMITS.custom;
  const key = `${provider}:${clientId}`;
  const now = Date.now();
  const current = rateLimitStore.get(key);

  if (!current || now >= current.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + rateLimit.windowMs,
    });
    return { allowed: true, remaining: rateLimit.maxRequests - 1 };
  }

  const remaining = Math.max(0, rateLimit.maxRequests - current.count);
  if (remaining === 0) {
    return { allowed: false, remaining: 0 };
  }

  current.count++;
  return { allowed: true, remaining: remaining - 1 };
}

function verifySignature(
  payload: string,
  signature: string,
  secret: string,
  method: string,
  provider: string
): boolean {
  if (!signature || !secret) return false;

  try {
    switch (method) {
      case 'hmac-sha256':
        const expectedSignature = crypto
          .createHmac('sha256', secret)
          .update(payload, 'utf8')
          .digest('hex');
        
        const providedSignature = signature.startsWith('sha256=') 
          ? signature.slice(7)
          : signature;

        return crypto.timingSafeEqual(
          Buffer.from(expectedSignature, 'hex'),
          Buffer.from(providedSignature, 'hex')
        );

      case 'token':
        return signature === secret;

      case 'bearer':
        return signature.replace('Bearer ', '') === secret;

      case 'slack':
        // Slack uses timestamp + secret
        const [timestamp, slackSignature] = signature.split(',');
        if (!timestamp || !slackSignature) return false;
        
        const baseString = `v0:${timestamp.split('=')[1]}:${payload}`;
        const expectedSlackSig = 'v0=' + crypto
          .createHmac('sha256', secret)
          .update(baseString, 'utf8')
          .digest('hex');

        return crypto.timingSafeEqual(
          Buffer.from(expectedSlackSig),
          Buffer.from(slackSignature)
        );

      default:
        console.warn(`Unknown signature method: ${method} for provider: ${provider}`);
        return false;
    }
  } catch (error) {
    console.error(`Signature verification failed for ${provider}:`, error);
    return false;
  }
}

async function processGitLabEvent(eventType: string, payload: any): Promise<void> {
  switch (eventType) {
    case 'push':
      await webhookManager.sendEvent('gitlab.push', {
        repository: payload.project?.path_with_namespace,
        branch: payload.ref?.replace('refs/heads/', ''),
        commits: payload.commits?.length || 0,
        user: payload.user_name,
        timestamp: Date.now(),
      });
      break;

    case 'merge_request':
      await webhookManager.sendEvent('gitlab.merge_request', {
        repository: payload.project?.path_with_namespace,
        action: payload.object_attributes?.action,
        mergeRequest: {
          id: payload.object_attributes?.id,
          title: payload.object_attributes?.title,
          state: payload.object_attributes?.state,
          url: payload.object_attributes?.url,
        },
        timestamp: Date.now(),
      });
      break;

    case 'pipeline':
      await webhookManager.sendEvent('gitlab.pipeline', {
        repository: payload.project?.path_with_namespace,
        pipeline: {
          id: payload.object_attributes?.id,
          status: payload.object_attributes?.status,
          ref: payload.object_attributes?.ref,
          duration: payload.object_attributes?.duration,
        },
        timestamp: Date.now(),
      });
      break;

    default:
      await webhookManager.sendEvent(`gitlab.${eventType}`, {
        repository: payload.project?.path_with_namespace,
        eventType,
        timestamp: Date.now(),
      });
  }
}

async function processJenkinsEvent(eventType: string, payload: any): Promise<void> {
  switch (eventType) {
    case 'build_started':
    case 'build_completed':
    case 'build_failed':
      await webhookManager.sendEvent('jenkins.build', {
        job: payload.name,
        buildNumber: payload.build?.number,
        status: payload.build?.status || eventType.replace('build_', ''),
        url: payload.build?.full_url,
        duration: payload.build?.duration,
        timestamp: Date.now(),
      });
      break;

    default:
      await webhookManager.sendEvent(`jenkins.${eventType}`, {
        job: payload.name,
        eventType,
        timestamp: Date.now(),
      });
  }
}

async function processSlackEvent(eventType: string, payload: any): Promise<void> {
  // Handle Slack's challenge verification
  if (payload.challenge) {
    return; // Handled in the main POST handler
  }

  switch (eventType) {
    case 'app_mention':
      await webhookManager.sendEvent('slack.mention', {
        channel: payload.event?.channel,
        user: payload.event?.user,
        text: payload.event?.text,
        timestamp: payload.event?.ts,
      });
      break;

    case 'message':
      if (payload.event?.channel_type === 'im') {
        await webhookManager.sendEvent('slack.direct_message', {
          user: payload.event?.user,
          text: payload.event?.text,
          timestamp: payload.event?.ts,
        });
      }
      break;

    default:
      await webhookManager.sendEvent(`slack.${eventType}`, {
        team: payload.team_id,
        eventType,
        timestamp: Date.now(),
      });
  }
}

async function processDockerHubEvent(eventType: string, payload: any): Promise<void> {
  await webhookManager.sendEvent('docker.repository', {
    repository: payload.repository?.repo_name,
    tag: payload.push_data?.tag,
    pusher: payload.push_data?.pusher,
    action: eventType,
    timestamp: Date.now(),
  });
}

export async function POST(request: NextRequest, context: { params: { provider: string } }): Promise<NextResponse> {
  const { provider } = context.params;
  
  try {
    // Validate provider
    if (!PROVIDER_CONFIGS[provider as ProviderName] && provider !== 'custom') {
      return NextResponse.json(
        { error: `Unsupported provider: ${provider}` },
        { status: 400 }
      );
    }

    const config = PROVIDER_CONFIGS[provider as ProviderName] || PROVIDER_CONFIGS.custom;

    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';
    const rateLimitResult = checkRateLimit(provider, clientIp);
    
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

    // Get headers
    const signature = request.headers.get(config.signatureHeader) || '';
    const eventType = request.headers.get(config.eventHeader) || '';
    const userAgent = request.headers.get('user-agent') || '';
    const deliveryId = request.headers.get('x-delivery-id') || 
                      request.headers.get('x-request-id') || 
                      crypto.randomUUID();

    // Validate user agent for some providers
    if (config.userAgent && !userAgent.includes(config.userAgent)) {
      console.warn(`Suspicious user agent for ${provider}: ${userAgent}`);
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
    const webhookSecret = process.env[`${provider.toUpperCase()}_WEBHOOK_SECRET`] ||
                         process.env.GENERIC_WEBHOOK_SECRET;
    
    if (webhookSecret && signature) {
      if (!verifySignature(payload, signature, webhookSecret, config.signatureMethod, provider)) {
        console.warn(`Invalid webhook signature for ${provider} delivery ${deliveryId}`);
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

    // Handle Slack challenge
    if (provider === 'slack' && parsedPayload.challenge) {
      return new NextResponse(parsedPayload.challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    console.log(`Received ${provider} webhook: ${eventType} (delivery: ${deliveryId})`);

    // Process provider-specific events
    try {
      switch (provider) {
        case 'gitlab':
          await processGitLabEvent(eventType, parsedPayload);
          break;

        case 'jenkins':
          await processJenkinsEvent(eventType, parsedPayload);
          break;

        case 'slack':
          await processSlackEvent(eventType, parsedPayload);
          break;

        case 'docker':
          await processDockerHubEvent(eventType, parsedPayload);
          break;

        default:
          // Generic webhook processing
          const genericEvent = GenericWebhookEventSchema.parse({
            event: eventType || 'webhook_received',
            data: parsedPayload,
            timestamp: Date.now(),
            source: provider,
          });

          await webhookManager.sendEvent(`${provider}.${genericEvent.event}`, {
            provider,
            event: genericEvent.event,
            data: genericEvent.data,
            timestamp: genericEvent.timestamp,
          });
      }

      return NextResponse.json(
        { 
          success: true, 
          provider,
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
      console.error(`Error processing ${provider} webhook ${eventType}:`, processingError);
      
      // Still return success to avoid retries for processing errors
      return NextResponse.json(
        { 
          success: true, 
          provider,
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
    console.error(`${provider} webhook handler error:`, error);
    
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
export async function GET(request: NextRequest, context: { params: { provider: string } }): Promise<NextResponse> {
  const { provider } = context.params;
  
  // Validate provider
  if (!PROVIDER_CONFIGS[provider as ProviderName] && provider !== 'custom') {
    return NextResponse.json(
      { error: `Unsupported provider: ${provider}` },
      { status: 400 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const challenge = searchParams.get('hub.challenge') || searchParams.get('challenge');
  
  if (challenge) {
    // Generic webhook validation
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return NextResponse.json({
    service: `${provider.charAt(0).toUpperCase() + provider.slice(1)} Webhook Handler`,
    provider,
    status: 'active',
    timestamp: new Date().toISOString(),
    configuration: PROVIDER_CONFIGS[provider as ProviderName] || PROVIDER_CONFIGS.custom,
    rateLimit: RATE_LIMITS[provider] || RATE_LIMITS.custom,
  });
}