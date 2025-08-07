import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

interface Webhook {
  id: string;
  name: string;
  description: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  events: WebhookEvent[];
  config: WebhookConfig;
  security: WebhookSecurity;
  status: WebhookStatus;
  metadata: WebhookMetadata;
  stats: WebhookStats;
  created: string;
  updated: string;
}

interface WebhookEvent {
  type: EventType;
  filters?: EventFilter[];
  transform?: EventTransform;
  enabled: boolean;
}

type EventType = 
  | 'plugin.installed'
  | 'plugin.uninstalled'
  | 'plugin.updated'
  | 'plugin.enabled'
  | 'plugin.disabled'
  | 'plugin.configured'
  | 'plugin.error'
  | 'plugin.health_check'
  | 'plugin.backup'
  | 'plugin.restored'
  | 'plugin.migrated'
  | 'plugin.certified'
  | 'plugin.security_scan'
  | 'plugin.performance_alert'
  | 'billing.invoice'
  | 'billing.payment'
  | 'billing.subscription'
  | 'user.signup'
  | 'user.login'
  | 'user.permission_change'
  | 'system.maintenance'
  | 'system.error'
  | 'system.recovery';

interface EventFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'nin' | 'regex';
  value: any;
}

interface EventTransform {
  type: 'jmespath' | 'jsonpath' | 'template' | 'custom';
  expression: string;
  fallback?: any;
}

interface WebhookConfig {
  active: boolean;
  retryPolicy: RetryPolicy;
  timeout: number;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  payload?: PayloadConfig;
  rateLimit?: RateLimitConfig;
  circuit?: CircuitBreakerConfig;
}

interface RetryPolicy {
  enabled: boolean;
  maxAttempts: number;
  backoff: 'linear' | 'exponential' | 'fibonacci';
  initialDelay: number;
  maxDelay: number;
  retryOn: number[];
}

interface PayloadConfig {
  format: 'json' | 'xml' | 'form' | 'custom';
  template?: string;
  includeHeaders: boolean;
  includeMetadata: boolean;
  compression?: 'gzip' | 'deflate' | 'br';
  maxSize: number;
}

interface RateLimitConfig {
  enabled: boolean;
  requests: number;
  window: number;
  burst?: number;
}

interface CircuitBreakerConfig {
  enabled: boolean;
  threshold: number;
  timeout: number;
  halfOpenRequests: number;
}

interface WebhookSecurity {
  authentication?: AuthConfig;
  signature?: SignatureConfig;
  encryption?: EncryptionConfig;
  ipWhitelist?: string[];
  validateSSL: boolean;
}

interface AuthConfig {
  type: 'none' | 'basic' | 'bearer' | 'api_key' | 'oauth2' | 'custom';
  credentials?: {
    username?: string;
    password?: string;
    token?: string;
    apiKey?: string;
    clientId?: string;
    clientSecret?: string;
  };
  headerName?: string;
}

interface SignatureConfig {
  enabled: boolean;
  algorithm: 'hmac-sha256' | 'hmac-sha512' | 'rsa-sha256' | 'ed25519';
  secret?: string;
  header: string;
  includeTimestamp: boolean;
  tolerance?: number;
}

interface EncryptionConfig {
  enabled: boolean;
  algorithm: 'aes-256-gcm' | 'chacha20-poly1305';
  key?: string;
  rotateKeys: boolean;
}

interface WebhookStatus {
  state: 'active' | 'inactive' | 'suspended' | 'error' | 'circuit_open';
  lastDelivery?: DeliveryAttempt;
  consecutiveFailures: number;
  circuitState?: 'closed' | 'open' | 'half_open';
  nextRetry?: string;
  suspendedUntil?: string;
}

interface WebhookMetadata {
  tags: string[];
  owner: string;
  team?: string;
  project?: string;
  environment: 'development' | 'staging' | 'production';
  version: string;
  documentation?: string;
}

interface WebhookStats {
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  avgResponseTime: number;
  lastHour: HourlyStats;
  lastDay: DailyStats;
  reliability: number;
}

interface HourlyStats {
  deliveries: number;
  successes: number;
  failures: number;
  avgLatency: number;
}

interface DailyStats {
  deliveries: number;
  successes: number;
  failures: number;
  avgLatency: number;
  peakHour: number;
}

interface DeliveryAttempt {
  id: string;
  webhookId: string;
  event: WebhookEventPayload;
  request: DeliveryRequest;
  response?: DeliveryResponse;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  attempts: number;
  timestamp: string;
  duration?: number;
  error?: string;
}

interface WebhookEventPayload {
  id: string;
  type: EventType;
  timestamp: string;
  source: string;
  data: any;
  metadata?: Record<string, any>;
}

interface DeliveryRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: any;
  timeout: number;
}

interface DeliveryResponse {
  statusCode: number;
  headers: Record<string, string>;
  body?: any;
  duration: number;
}

interface WebhookSubscription {
  id: string;
  webhookId: string;
  events: EventType[];
  filters: SubscriptionFilter[];
  active: boolean;
  created: string;
}

interface SubscriptionFilter {
  type: 'plugin' | 'user' | 'team' | 'environment';
  value: string;
}

interface WebhookTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  config: Partial<Webhook>;
  examples: WebhookExample[];
  tags: string[];
}

interface WebhookExample {
  name: string;
  event: EventType;
  payload: any;
  response?: any;
}

interface WebhookTest {
  id: string;
  webhookId: string;
  event: WebhookEventPayload;
  result?: TestResult;
  timestamp: string;
}

interface TestResult {
  success: boolean;
  statusCode?: number;
  response?: any;
  duration: number;
  error?: string;
}

interface WebhookLog {
  id: string;
  webhookId: string;
  level: 'debug' | 'info' | 'warning' | 'error';
  message: string;
  data?: any;
  timestamp: string;
}

// Storage
const webhooks = new Map<string, Webhook>();
const deliveryQueue = new Map<string, DeliveryAttempt>();
const subscriptions = new Map<string, WebhookSubscription>();
const webhookLogs = new Map<string, WebhookLog[]>();
const templates = new Map<string, WebhookTemplate>();

// Initialize sample templates
const initializeTemplates = () => {
  const sampleTemplates: WebhookTemplate[] = [
    {
      id: 't1',
      name: 'Slack Notification',
      description: 'Send plugin events to Slack channel',
      category: 'notifications',
      config: {
        method: 'POST',
        config: {
          active: true,
          retryPolicy: {
            enabled: true,
            maxAttempts: 3,
            backoff: 'exponential',
            initialDelay: 1000,
            maxDelay: 30000,
            retryOn: [500, 502, 503, 504]
          },
          timeout: 10000,
          payload: {
            format: 'json',
            includeHeaders: false,
            includeMetadata: true,
            maxSize: 1024 * 1024
          }
        }
      },
      examples: [
        {
          name: 'Plugin Installed',
          event: 'plugin.installed',
          payload: {
            text: 'New plugin installed',
            attachments: [{
              color: 'good',
              fields: [
                { title: 'Plugin', value: 'Example Plugin', short: true },
                { title: 'Version', value: '1.0.0', short: true }
              ]
            }]
          }
        }
      ],
      tags: ['slack', 'notifications', 'chat']
    },
    {
      id: 't2',
      name: 'GitHub Actions Trigger',
      description: 'Trigger GitHub Actions workflow on plugin events',
      category: 'ci-cd',
      config: {
        method: 'POST',
        config: {
          active: true,
          retryPolicy: {
            enabled: true,
            maxAttempts: 5,
            backoff: 'exponential',
            initialDelay: 2000,
            maxDelay: 60000,
            retryOn: [500, 502, 503, 504]
          },
          timeout: 30000,
          headers: {
            'Accept': 'application/vnd.github.v3+json'
          }
        },
        security: {
          authentication: {
            type: 'bearer',
            credentials: {
              token: '${GITHUB_TOKEN}'
            }
          },
          validateSSL: true
        }
      },
      examples: [
        {
          name: 'Deploy Plugin',
          event: 'plugin.updated',
          payload: {
            event_type: 'deploy-plugin',
            client_payload: {
              plugin: 'example-plugin',
              version: '2.0.0',
              environment: 'production'
            }
          }
        }
      ],
      tags: ['github', 'ci-cd', 'automation']
    },
    {
      id: 't3',
      name: 'PagerDuty Alert',
      description: 'Create PagerDuty incidents for critical plugin events',
      category: 'monitoring',
      config: {
        method: 'POST',
        config: {
          active: true,
          retryPolicy: {
            enabled: true,
            maxAttempts: 3,
            backoff: 'linear',
            initialDelay: 1000,
            maxDelay: 5000,
            retryOn: [500, 502, 503, 504]
          },
          timeout: 5000
        },
        security: {
          authentication: {
            type: 'api_key',
            credentials: {
              apiKey: '${PAGERDUTY_KEY}'
            },
            headerName: 'Authorization'
          }
        }
      },
      examples: [
        {
          name: 'Plugin Error',
          event: 'plugin.error',
          payload: {
            routing_key: 'YOUR_ROUTING_KEY',
            event_action: 'trigger',
            payload: {
              summary: 'Plugin error detected',
              severity: 'error',
              source: 'backstage-plugins',
              custom_details: {
                plugin: 'example-plugin',
                error: 'Connection timeout'
              }
            }
          }
        }
      ],
      tags: ['pagerduty', 'incidents', 'monitoring']
    }
  ];

  sampleTemplates.forEach(template => {
    templates.set(template.id, template);
  });
};

// Initialize templates
initializeTemplates();

// Deliver webhook
const deliverWebhook = async (
  webhook: Webhook,
  event: WebhookEventPayload
): Promise<DeliveryAttempt> => {
  const attempt: DeliveryAttempt = {
    id: crypto.randomBytes(8).toString('hex'),
    webhookId: webhook.id,
    event,
    request: {
      url: webhook.url,
      method: webhook.method,
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-ID': webhook.id,
        'X-Event-Type': event.type,
        'X-Event-ID': event.id,
        'X-Timestamp': event.timestamp,
        ...(webhook.config.headers || {})
      },
      body: event,
      timeout: webhook.config.timeout
    },
    status: 'pending',
    attempts: 1,
    timestamp: new Date().toISOString()
  };

  // Add signature if configured
  if (webhook.security.signature?.enabled) {
    const signature = generateSignature(
      JSON.stringify(event),
      webhook.security.signature.secret || '',
      webhook.security.signature.algorithm
    );
    attempt.request.headers[webhook.security.signature.header] = signature;
  }

  // Simulate delivery
  const startTime = Date.now();
  
  try {
    // Simulate HTTP request
    await new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.1) {
          resolve({
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: { received: true }
          });
        } else {
          reject(new Error('Connection timeout'));
        }
      }, Math.random() * 2000);
    });

    attempt.status = 'success';
    attempt.response = {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { received: true },
      duration: Date.now() - startTime
    };
    attempt.duration = Date.now() - startTime;

    // Update webhook stats
    webhook.stats.totalDeliveries++;
    webhook.stats.successfulDeliveries++;
    webhook.stats.avgResponseTime = 
      (webhook.stats.avgResponseTime * (webhook.stats.totalDeliveries - 1) + attempt.duration) / 
      webhook.stats.totalDeliveries;
    webhook.status.consecutiveFailures = 0;

  } catch (error) {
    attempt.status = 'failed';
    attempt.error = error instanceof Error ? error.message : 'Delivery failed';
    attempt.duration = Date.now() - startTime;

    // Update webhook stats
    webhook.stats.totalDeliveries++;
    webhook.stats.failedDeliveries++;
    webhook.status.consecutiveFailures++;

    // Handle retry
    if (webhook.config.retryPolicy.enabled && 
        attempt.attempts < webhook.config.retryPolicy.maxAttempts) {
      attempt.status = 'retrying';
      const delay = calculateRetryDelay(
        attempt.attempts,
        webhook.config.retryPolicy
      );
      attempt.response = {
        statusCode: 0,
        headers: {},
        duration: attempt.duration
      };
      
      // Schedule retry
      setTimeout(() => {
        attempt.attempts++;
        deliverWebhook(webhook, event);
      }, delay);
    }

    // Check circuit breaker
    if (webhook.config.circuit?.enabled &&
        webhook.status.consecutiveFailures >= webhook.config.circuit.threshold) {
      webhook.status.state = 'circuit_open';
      webhook.status.circuitState = 'open';
      webhook.status.suspendedUntil = new Date(
        Date.now() + webhook.config.circuit.timeout
      ).toISOString();
    }
  }

  // Store delivery attempt
  deliveryQueue.set(attempt.id, attempt);
  webhook.status.lastDelivery = attempt;

  // Log delivery
  const log: WebhookLog = {
    id: crypto.randomBytes(8).toString('hex'),
    webhookId: webhook.id,
    level: attempt.status === 'success' ? 'info' : 'error',
    message: `Webhook delivery ${attempt.status}: ${event.type}`,
    data: {
      eventId: event.id,
      attemptId: attempt.id,
      duration: attempt.duration,
      statusCode: attempt.response?.statusCode
    },
    timestamp: new Date().toISOString()
  };

  const logs = webhookLogs.get(webhook.id) || [];
  logs.push(log);
  webhookLogs.set(webhook.id, logs);

  return attempt;
};

// Generate signature
const generateSignature = (
  payload: string,
  secret: string,
  algorithm: string
): string => {
  switch (algorithm) {
    case 'hmac-sha256':
      return crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
    case 'hmac-sha512':
      return crypto
        .createHmac('sha512', secret)
        .update(payload)
        .digest('hex');
    default:
      return '';
  }
};

// Calculate retry delay
const calculateRetryDelay = (
  attempt: number,
  policy: RetryPolicy
): number => {
  let delay = policy.initialDelay;

  switch (policy.backoff) {
    case 'exponential':
      delay = Math.min(
        policy.initialDelay * Math.pow(2, attempt - 1),
        policy.maxDelay
      );
      break;
    case 'fibonacci':
      const fib = (n: number): number => 
        n <= 1 ? n : fib(n - 1) + fib(n - 2);
      delay = Math.min(
        policy.initialDelay * fib(attempt),
        policy.maxDelay
      );
      break;
    case 'linear':
    default:
      delay = Math.min(
        policy.initialDelay * attempt,
        policy.maxDelay
      );
  }

  return delay;
};

// Process event
const processEvent = async (
  eventType: EventType,
  data: any
): Promise<{ delivered: number; failed: number }> => {
  const results = { delivered: 0, failed: 0 };

  // Find matching webhooks
  const matchingWebhooks = Array.from(webhooks.values()).filter(webhook => {
    if (!webhook.config.active) return false;
    if (webhook.status.state === 'suspended' || webhook.status.state === 'circuit_open') {
      return false;
    }
    return webhook.events.some(e => e.type === eventType && e.enabled);
  });

  // Create event payload
  const event: WebhookEventPayload = {
    id: crypto.randomBytes(8).toString('hex'),
    type: eventType,
    timestamp: new Date().toISOString(),
    source: 'backstage-plugins',
    data
  };

  // Deliver to each webhook
  for (const webhook of matchingWebhooks) {
    const attempt = await deliverWebhook(webhook, event);
    if (attempt.status === 'success') {
      results.delivered++;
    } else {
      results.failed++;
    }
  }

  return results;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'create': {
        const webhook: Webhook = {
          id: crypto.randomBytes(8).toString('hex'),
          name: body.name,
          description: body.description || '',
          url: body.url,
          method: body.method || 'POST',
          events: body.events || [],
          config: {
            active: body.config?.active !== false,
            retryPolicy: body.config?.retryPolicy || {
              enabled: true,
              maxAttempts: 3,
              backoff: 'exponential',
              initialDelay: 1000,
              maxDelay: 30000,
              retryOn: [500, 502, 503, 504]
            },
            timeout: body.config?.timeout || 10000,
            headers: body.config?.headers,
            queryParams: body.config?.queryParams,
            payload: body.config?.payload || {
              format: 'json',
              includeHeaders: false,
              includeMetadata: true,
              maxSize: 1024 * 1024
            },
            rateLimit: body.config?.rateLimit,
            circuit: body.config?.circuit
          },
          security: {
            authentication: body.security?.authentication || { type: 'none' },
            signature: body.security?.signature,
            encryption: body.security?.encryption,
            ipWhitelist: body.security?.ipWhitelist,
            validateSSL: body.security?.validateSSL !== false
          },
          status: {
            state: 'active',
            consecutiveFailures: 0
          },
          metadata: {
            tags: body.metadata?.tags || [],
            owner: body.metadata?.owner || 'system',
            team: body.metadata?.team,
            project: body.metadata?.project,
            environment: body.metadata?.environment || 'production',
            version: '1.0.0',
            documentation: body.metadata?.documentation
          },
          stats: {
            totalDeliveries: 0,
            successfulDeliveries: 0,
            failedDeliveries: 0,
            avgResponseTime: 0,
            lastHour: {
              deliveries: 0,
              successes: 0,
              failures: 0,
              avgLatency: 0
            },
            lastDay: {
              deliveries: 0,
              successes: 0,
              failures: 0,
              avgLatency: 0,
              peakHour: 0
            },
            reliability: 100
          },
          created: new Date().toISOString(),
          updated: new Date().toISOString()
        };

        webhooks.set(webhook.id, webhook);

        return NextResponse.json({
          success: true,
          webhook
        });
      }

      case 'update': {
        const { id, ...updates } = body;
        const webhook = webhooks.get(id);

        if (!webhook) {
          return NextResponse.json({
            success: false,
            error: 'Webhook not found'
          }, { status: 404 });
        }

        Object.assign(webhook, updates, {
          updated: new Date().toISOString()
        });

        return NextResponse.json({
          success: true,
          webhook
        });
      }

      case 'delete': {
        const { id } = body;

        if (!webhooks.delete(id)) {
          return NextResponse.json({
            success: false,
            error: 'Webhook not found'
          }, { status: 404 });
        }

        return NextResponse.json({
          success: true,
          message: 'Webhook deleted'
        });
      }

      case 'test': {
        const { id, event } = body;
        const webhook = webhooks.get(id);

        if (!webhook) {
          return NextResponse.json({
            success: false,
            error: 'Webhook not found'
          }, { status: 404 });
        }

        const testEvent: WebhookEventPayload = event || {
          id: 'test-' + crypto.randomBytes(4).toString('hex'),
          type: 'plugin.installed',
          timestamp: new Date().toISOString(),
          source: 'test',
          data: {
            plugin: 'test-plugin',
            version: '1.0.0',
            test: true
          }
        };

        const attempt = await deliverWebhook(webhook, testEvent);

        const test: WebhookTest = {
          id: crypto.randomBytes(8).toString('hex'),
          webhookId: webhook.id,
          event: testEvent,
          result: {
            success: attempt.status === 'success',
            statusCode: attempt.response?.statusCode,
            response: attempt.response?.body,
            duration: attempt.duration || 0,
            error: attempt.error
          },
          timestamp: new Date().toISOString()
        };

        return NextResponse.json({
          success: true,
          test
        });
      }

      case 'trigger': {
        const { eventType, data } = body;
        const results = await processEvent(eventType, data);

        return NextResponse.json({
          success: true,
          results
        });
      }

      case 'toggle': {
        const { id, active } = body;
        const webhook = webhooks.get(id);

        if (!webhook) {
          return NextResponse.json({
            success: false,
            error: 'Webhook not found'
          }, { status: 404 });
        }

        webhook.config.active = active;
        webhook.status.state = active ? 'active' : 'inactive';

        return NextResponse.json({
          success: true,
          webhook
        });
      }

      case 'reset_circuit': {
        const { id } = body;
        const webhook = webhooks.get(id);

        if (!webhook) {
          return NextResponse.json({
            success: false,
            error: 'Webhook not found'
          }, { status: 404 });
        }

        webhook.status.state = 'active';
        webhook.status.circuitState = 'closed';
        webhook.status.consecutiveFailures = 0;
        webhook.status.suspendedUntil = undefined;

        return NextResponse.json({
          success: true,
          webhook
        });
      }

      case 'subscribe': {
        const subscription: WebhookSubscription = {
          id: crypto.randomBytes(8).toString('hex'),
          webhookId: body.webhookId,
          events: body.events || [],
          filters: body.filters || [],
          active: true,
          created: new Date().toISOString()
        };

        subscriptions.set(subscription.id, subscription);

        return NextResponse.json({
          success: true,
          subscription
        });
      }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Webhook API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process webhook request'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type');

    if (id) {
      const webhook = webhooks.get(id);
      if (!webhook) {
        return NextResponse.json({
          success: false,
          error: 'Webhook not found'
        }, { status: 404 });
      }

      const logs = webhookLogs.get(id) || [];

      return NextResponse.json({
        success: true,
        webhook,
        logs: logs.slice(-100) // Last 100 logs
      });
    }

    if (type === 'templates') {
      return NextResponse.json({
        success: true,
        templates: Array.from(templates.values())
      });
    }

    if (type === 'deliveries') {
      return NextResponse.json({
        success: true,
        deliveries: Array.from(deliveryQueue.values()).slice(-100)
      });
    }

    if (type === 'subscriptions') {
      return NextResponse.json({
        success: true,
        subscriptions: Array.from(subscriptions.values())
      });
    }

    // Return all webhooks
    return NextResponse.json({
      success: true,
      webhooks: Array.from(webhooks.values()),
      total: webhooks.size
    });

  } catch (error) {
    console.error('Webhook API GET error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch webhooks'
    }, { status: 500 });
  }
}