import crypto from 'crypto';
import { z } from 'zod';

// Webhook configuration schema
const WebhookConfigSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  secret: z.string().min(16),
  events: z.array(z.string()),
  headers: z.record(z.string()).optional(),
  timeout: z.number().min(1000).max(30000).default(10000),
  retryAttempts: z.number().min(0).max(10).default(3),
  active: z.boolean().default(true),
  rateLimit: z.object({
    maxRequests: z.number().min(1).default(100),
    windowMs: z.number().min(1000).default(60000), // 1 minute
  }).optional(),
});

const WebhookEventSchema = z.object({
  id: z.string(),
  webhookId: z.string(),
  event: z.string(),
  payload: z.record(z.any()),
  timestamp: z.number(),
  signature: z.string().optional(),
  retryCount: z.number().default(0),
  status: z.enum(['pending', 'delivered', 'failed', 'expired']).default('pending'),
});

export type WebhookConfig = z.infer<typeof WebhookConfigSchema>;
export type WebhookEvent = z.infer<typeof WebhookEventSchema>;

export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  error?: string;
  retryAfter?: number;
  duration: number;
}

export interface RateLimitInfo {
  remaining: number;
  resetTime: number;
  limited: boolean;
}

export class WebhookManager {
  private webhooks = new Map<string, WebhookConfig>();
  private eventQueue: WebhookEvent[] = [];
  private processingQueue = false;
  private rateLimitStore = new Map<string, { count: number; resetTime: number }>();
  private deliveryHistory = new Map<string, WebhookDeliveryResult[]>();

  constructor(private options: {
    maxQueueSize?: number;
    processInterval?: number;
    maxRetries?: number;
    retryDelay?: number;
    cleanupInterval?: number;
  } = {}) {
    this.options = {
      maxQueueSize: 10000,
      processInterval: 1000,
      maxRetries: 5,
      retryDelay: 1000,
      cleanupInterval: 300000, // 5 minutes
      ...options,
    };

    // Start processing queue
    this.startProcessing();
    
    // Start cleanup task
    this.startCleanup();
  }

  /**
   * Register a new webhook
   */
  async registerWebhook(config: Omit<WebhookConfig, 'id'>): Promise<string> {
    const validatedConfig = WebhookConfigSchema.parse({
      ...config,
      id: crypto.randomUUID(),
    });

    // Validate webhook URL is reachable
    await this.validateWebhookUrl(validatedConfig.url);

    this.webhooks.set(validatedConfig.id, validatedConfig);
    
    console.log(`Webhook registered: ${validatedConfig.id} -> ${validatedConfig.url}`);
    return validatedConfig.id;
  }

  /**
   * Update webhook configuration
   */
  async updateWebhook(id: string, updates: Partial<WebhookConfig>): Promise<void> {
    const existingConfig = this.webhooks.get(id);
    if (!existingConfig) {
      throw new Error(`Webhook ${id} not found`);
    }

    const updatedConfig = WebhookConfigSchema.parse({
      ...existingConfig,
      ...updates,
      id, // Ensure ID doesn't change
    });

    if (updates.url && updates.url !== existingConfig.url) {
      await this.validateWebhookUrl(updates.url);
    }

    this.webhooks.set(id, updatedConfig);
    console.log(`Webhook updated: ${id}`);
  }

  /**
   * Remove webhook
   */
  removeWebhook(id: string): boolean {
    const removed = this.webhooks.delete(id);
    if (removed) {
      this.deliveryHistory.delete(id);
      console.log(`Webhook removed: ${id}`);
    }
    return removed;
  }

  /**
   * Get webhook configuration
   */
  getWebhook(id: string): WebhookConfig | undefined {
    return this.webhooks.get(id);
  }

  /**
   * List all webhooks
   */
  listWebhooks(): WebhookConfig[] {
    return Array.from(this.webhooks.values());
  }

  /**
   * Send event to registered webhooks
   */
  async sendEvent(eventType: string, payload: Record<string, any>): Promise<void> {
    const relevantWebhooks = Array.from(this.webhooks.values())
      .filter(webhook => 
        webhook.active && 
        (webhook.events.includes(eventType) || webhook.events.includes('*'))
      );

    if (relevantWebhooks.length === 0) {
      console.log(`No webhooks registered for event: ${eventType}`);
      return;
    }

    const timestamp = Date.now();
    
    for (const webhook of relevantWebhooks) {
      // Check rate limiting
      const rateLimitInfo = this.checkRateLimit(webhook.id, webhook.rateLimit);
      if (rateLimitInfo.limited) {
        console.warn(`Rate limit exceeded for webhook ${webhook.id}, skipping event`);
        continue;
      }

      const event: WebhookEvent = {
        id: crypto.randomUUID(),
        webhookId: webhook.id,
        event: eventType,
        payload,
        timestamp,
        retryCount: 0,
        status: 'pending',
      };

      // Add signature if secret is provided
      if (webhook.secret) {
        event.signature = this.generateSignature(payload, webhook.secret);
      }

      await this.queueEvent(event);
    }
  }

  /**
   * Get webhook delivery statistics
   */
  getWebhookStats(webhookId: string): {
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    averageResponseTime: number;
    lastDelivery?: Date;
  } {
    const history = this.deliveryHistory.get(webhookId) || [];
    const successful = history.filter(r => r.success);
    const failed = history.filter(r => !r.success);
    
    return {
      totalDeliveries: history.length,
      successfulDeliveries: successful.length,
      failedDeliveries: failed.length,
      averageResponseTime: history.length > 0 
        ? history.reduce((sum, r) => sum + r.duration, 0) / history.length 
        : 0,
      lastDelivery: history.length > 0 
        ? new Date(Math.max(...history.map(r => r.duration))) 
        : undefined,
    };
  }

  /**
   * Validate webhook signature
   */
  validateSignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    const providedSignature = signature.replace('sha256=', '');
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    );
  }

  /**
   * Get rate limit information for a webhook
   */
  getRateLimitInfo(webhookId: string): RateLimitInfo {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook?.rateLimit) {
      return { remaining: Infinity, resetTime: 0, limited: false };
    }

    return this.checkRateLimit(webhookId, webhook.rateLimit);
  }

  private async validateWebhookUrl(url: string): Promise<void> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok && response.status !== 405) { // 405 Method Not Allowed is OK
        throw new Error(`Webhook URL returned status ${response.status}`);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Webhook URL validation timeout');
      }
      throw new Error(`Failed to validate webhook URL: ${error}`);
    }
  }

  private generateSignature(payload: Record<string, any>, secret: string): string {
    const payloadString = JSON.stringify(payload);
    return 'sha256=' + crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');
  }

  private checkRateLimit(webhookId: string, rateLimit?: WebhookConfig['rateLimit']): RateLimitInfo {
    if (!rateLimit) {
      return { remaining: Infinity, resetTime: 0, limited: false };
    }

    const now = Date.now();
    const current = this.rateLimitStore.get(webhookId);

    if (!current || now >= current.resetTime) {
      // Reset or initialize rate limit
      this.rateLimitStore.set(webhookId, {
        count: 1,
        resetTime: now + rateLimit.windowMs,
      });
      return {
        remaining: rateLimit.maxRequests - 1,
        resetTime: now + rateLimit.windowMs,
        limited: false,
      };
    }

    const remaining = Math.max(0, rateLimit.maxRequests - current.count);
    const limited = remaining === 0;

    if (!limited) {
      current.count++;
    }

    return {
      remaining,
      resetTime: current.resetTime,
      limited,
    };
  }

  private async queueEvent(event: WebhookEvent): Promise<void> {
    if (this.eventQueue.length >= this.options.maxQueueSize!) {
      console.warn('Webhook event queue is full, dropping oldest event');
      this.eventQueue.shift();
    }

    this.eventQueue.push(event);
  }

  private startProcessing(): void {
    const processQueue = async () => {
      if (this.processingQueue || this.eventQueue.length === 0) {
        return;
      }

      this.processingQueue = true;

      try {
        while (this.eventQueue.length > 0) {
          const event = this.eventQueue.shift()!;
          await this.processEvent(event);
        }
      } catch (error) {
        console.error('Error processing webhook queue:', error);
      } finally {
        this.processingQueue = false;
      }
    };

    setInterval(processQueue, this.options.processInterval!);
  }

  private async processEvent(event: WebhookEvent): Promise<void> {
    const webhook = this.webhooks.get(event.webhookId);
    if (!webhook || !webhook.active) {
      console.warn(`Webhook ${event.webhookId} not found or inactive, dropping event`);
      return;
    }

    const startTime = Date.now();
    let result: WebhookDeliveryResult;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), webhook.timeout);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Backstage-IDP-Webhook/1.0',
        'X-Event-Type': event.event,
        'X-Event-ID': event.id,
        'X-Timestamp': event.timestamp.toString(),
        ...webhook.headers,
      };

      if (event.signature) {
        headers['X-Signature-256'] = event.signature;
      }

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(event.payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      result = {
        success: response.ok,
        statusCode: response.status,
        duration: Date.now() - startTime,
      };

      if (!response.ok) {
        const responseText = await response.text().catch(() => 'Unknown error');
        result.error = `HTTP ${response.status}: ${responseText}`;
        
        // Check for Retry-After header
        const retryAfter = response.headers.get('Retry-After');
        if (retryAfter) {
          result.retryAfter = parseInt(retryAfter) * 1000; // Convert to milliseconds
        }
      }

    } catch (error) {
      result = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      };
    }

    // Store delivery result
    this.storeDeliveryResult(event.webhookId, result);

    if (!result.success && event.retryCount < this.options.maxRetries!) {
      await this.scheduleRetry(event, result.retryAfter);
    } else {
      event.status = result.success ? 'delivered' : 'failed';
      if (event.retryCount >= this.options.maxRetries!) {
        event.status = 'expired';
        console.warn(`Webhook event ${event.id} expired after ${event.retryCount} retries`);
      }
    }
  }

  private async scheduleRetry(event: WebhookEvent, retryAfter?: number): Promise<void> {
    event.retryCount++;
    
    // Exponential backoff with jitter
    const baseDelay = retryAfter || this.options.retryDelay!;
    const exponentialDelay = baseDelay * Math.pow(2, event.retryCount - 1);
    const jitter = Math.random() * 1000; // Add up to 1 second of jitter
    const delay = Math.min(exponentialDelay + jitter, 300000); // Max 5 minutes

    console.log(`Scheduling retry ${event.retryCount} for event ${event.id} in ${delay}ms`);

    setTimeout(() => {
      this.eventQueue.unshift(event); // Add to front of queue for priority
    }, delay);
  }

  private storeDeliveryResult(webhookId: string, result: WebhookDeliveryResult): void {
    if (!this.deliveryHistory.has(webhookId)) {
      this.deliveryHistory.set(webhookId, []);
    }

    const history = this.deliveryHistory.get(webhookId)!;
    history.push(result);

    // Keep only last 100 results per webhook
    if (history.length > 100) {
      history.shift();
    }
  }

  private startCleanup(): void {
    const cleanup = () => {
      const now = Date.now();
      const oneHourAgo = now - 3600000; // 1 hour

      // Clean up expired events from queue
      this.eventQueue = this.eventQueue.filter(event => 
        event.timestamp > oneHourAgo && event.status !== 'expired'
      );

      // Clean up old rate limit entries
      for (const [webhookId, rateLimitInfo] of this.rateLimitStore.entries()) {
        if (now >= rateLimitInfo.resetTime) {
          this.rateLimitStore.delete(webhookId);
        }
      }

      console.log(`Webhook cleanup completed: ${this.eventQueue.length} events in queue`);
    };

    setInterval(cleanup, this.options.cleanupInterval!);
  }
}

// Singleton instance
export const webhookManager = new WebhookManager();