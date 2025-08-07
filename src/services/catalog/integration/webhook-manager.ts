/**
 * Webhook Manager
 * 
 * Manages webhooks for real-time event notifications, handles subscriptions,
 * delivery guarantees, and failure handling.
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import { z } from 'zod';
import {
  IngestionEvent,
  EntityChangeEvent,
  RelationshipChangeEvent,
  QualityScoreEvent,
  WebhookEvent,
} from '../types';

const WebhookSubscriptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().url(),
  events: z.array(z.string()),
  secret: z.string().optional(),
  active: z.boolean().default(true),
  retryPolicy: z.object({
    maxAttempts: z.number().min(1).max(10).default(3),
    backoffMultiplier: z.number().min(1).default(2),
    maxDelay: z.number().min(1000).default(300000), // 5 minutes
  }).optional(),
  headers: z.record(z.string()).optional(),
  filters: z.object({
    entityKinds: z.array(z.string()).optional(),
    namespaces: z.array(z.string()).optional(),
    sources: z.array(z.string()).optional(),
  }).optional(),
});

export type WebhookSubscription = z.infer<typeof WebhookSubscriptionSchema>;

interface WebhookDelivery {
  id: string;
  subscriptionId: string;
  event: IngestionEvent;
  url: string;
  attempt: number;
  status: 'pending' | 'success' | 'failed' | 'cancelled';
  statusCode?: number;
  responseTime?: number;
  error?: string;
  scheduledAt: Date;
  deliveredAt?: Date;
  nextRetryAt?: Date;
}

interface WebhookMetrics {
  subscriptions: {
    total: number;
    active: number;
    inactive: number;
  };
  deliveries: {
    total: number;
    successful: number;
    failed: number;
    pending: number;
  };
  performance: {
    averageResponseTime: number;
    successRate: number;
  };
  events: {
    total: number;
    byType: Record<string, number>;
  };
}

export class WebhookManager extends EventEmitter {
  private readonly subscriptions = new Map<string, WebhookSubscription>();
  private readonly deliveryQueue = new Map<string, WebhookDelivery>();
  private readonly deliveryHistory = new Map<string, WebhookDelivery[]>();
  
  private isProcessing = false;
  private processingInterval?: NodeJS.Timeout;
  
  private metrics: WebhookMetrics = {
    subscriptions: { total: 0, active: 0, inactive: 0 },
    deliveries: { total: 0, successful: 0, failed: 0, pending: 0 },
    performance: { averageResponseTime: 0, successRate: 0 },
    events: { total: 0, byType: {} },
  };

  constructor() {
    super();
  }

  /**
   * Start webhook processing
   */
  async start(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    this.processingInterval = setInterval(
      () => this.processDeliveryQueue(),
      1000 // Process every second
    );

    this.emit('started');
  }

  /**
   * Stop webhook processing
   */
  async stop(): Promise<void> {
    this.isProcessing = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }

    this.emit('stopped');
  }

  /**
   * Subscribe to webhook events
   */
  async subscribe(subscriptionData: Omit<WebhookSubscription, 'id'>): Promise<string> {
    const subscription = WebhookSubscriptionSchema.parse({
      ...subscriptionData,
      id: this.generateSubscriptionId(),
    });

    this.subscriptions.set(subscription.id, subscription);
    this.updateSubscriptionMetrics();

    this.emit('subscriptionCreated', subscription);
    
    return subscription.id;
  }

  /**
   * Unsubscribe from webhook events
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription ${subscriptionId} not found`);
    }

    this.subscriptions.delete(subscriptionId);
    
    // Cancel pending deliveries for this subscription
    for (const [deliveryId, delivery] of this.deliveryQueue.entries()) {
      if (delivery.subscriptionId === subscriptionId) {
        delivery.status = 'cancelled';
        this.deliveryQueue.delete(deliveryId);
      }
    }

    this.updateSubscriptionMetrics();
    this.emit('subscriptionDeleted', { subscriptionId });
  }

  /**
   * Update subscription
   */
  async updateSubscription(
    subscriptionId: string, 
    updates: Partial<Omit<WebhookSubscription, 'id'>>
  ): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription ${subscriptionId} not found`);
    }

    const updated = WebhookSubscriptionSchema.parse({
      ...subscription,
      ...updates,
    });

    this.subscriptions.set(subscriptionId, updated);
    this.updateSubscriptionMetrics();

    this.emit('subscriptionUpdated', updated);
  }

  /**
   * Get subscription
   */
  getSubscription(subscriptionId: string): WebhookSubscription | undefined {
    return this.subscriptions.get(subscriptionId);
  }

  /**
   * List all subscriptions
   */
  listSubscriptions(): WebhookSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Publish event to subscribers
   */
  async publishEvent(event: IngestionEvent): Promise<void> {
    this.metrics.events.total++;
    this.metrics.events.byType[event.type] = (this.metrics.events.byType[event.type] || 0) + 1;

    const matchingSubscriptions = this.findMatchingSubscriptions(event);
    
    for (const subscription of matchingSubscriptions) {
      await this.scheduleDelivery(subscription, event);
    }

    this.emit('eventPublished', { 
      eventType: event.type, 
      subscriptions: matchingSubscriptions.length 
    });
  }

  /**
   * Get delivery history for subscription
   */
  getDeliveryHistory(subscriptionId: string, limit = 100): WebhookDelivery[] {
    const history = this.deliveryHistory.get(subscriptionId) || [];
    return history
      .sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get webhook metrics
   */
  getMetrics(): WebhookMetrics {
    return { ...this.metrics };
  }

  /**
   * Test webhook endpoint
   */
  async testWebhook(url: string, secret?: string): Promise<{
    success: boolean;
    statusCode?: number;
    responseTime: number;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      const testEvent: IngestionEvent = {
        type: 'webhook.test',
        timestamp: new Date(),
        data: { message: 'This is a test webhook delivery' },
      };

      const payload = JSON.stringify(testEvent);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Backstage-Catalog-Webhook/1.0',
        'X-Webhook-Event': testEvent.type,
        'X-Webhook-Delivery': crypto.randomUUID(),
      };

      if (secret) {
        headers['X-Webhook-Signature'] = this.generateSignature(payload, secret);
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: payload,
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      return {
        success: response.ok,
        statusCode: response.status,
        responseTime: Date.now() - startTime,
      };

    } catch (error) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Find subscriptions matching event
   */
  private findMatchingSubscriptions(event: IngestionEvent): WebhookSubscription[] {
    return Array.from(this.subscriptions.values()).filter(subscription => {
      // Check if subscription is active
      if (!subscription.active) {
        return false;
      }

      // Check event type
      if (!subscription.events.includes(event.type) && !subscription.events.includes('*')) {
        return false;
      }

      // Apply filters
      if (subscription.filters) {
        if (event.entityRef) {
          const [kind, namespaceAndName] = event.entityRef.split(':');
          const [namespace] = namespaceAndName.split('/');

          if (subscription.filters.entityKinds && 
              !subscription.filters.entityKinds.includes(kind)) {
            return false;
          }

          if (subscription.filters.namespaces && 
              !subscription.filters.namespaces.includes(namespace)) {
            return false;
          }
        }

        if (subscription.filters.sources && event.sourceId &&
            !subscription.filters.sources.includes(event.sourceId)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Schedule webhook delivery
   */
  private async scheduleDelivery(subscription: WebhookSubscription, event: IngestionEvent): Promise<void> {
    const delivery: WebhookDelivery = {
      id: crypto.randomUUID(),
      subscriptionId: subscription.id,
      event,
      url: subscription.url,
      attempt: 1,
      status: 'pending',
      scheduledAt: new Date(),
    };

    this.deliveryQueue.set(delivery.id, delivery);
    this.metrics.deliveries.total++;
    this.metrics.deliveries.pending++;

    this.emit('deliveryScheduled', delivery);
  }

  /**
   * Process delivery queue
   */
  private async processDeliveryQueue(): Promise<void> {
    const now = new Date();
    const pendingDeliveries = Array.from(this.deliveryQueue.values())
      .filter(delivery => 
        delivery.status === 'pending' && 
        (!delivery.nextRetryAt || delivery.nextRetryAt <= now)
      )
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
      .slice(0, 10); // Process up to 10 deliveries at once

    for (const delivery of pendingDeliveries) {
      await this.processDelivery(delivery);
    }
  }

  /**
   * Process single delivery
   */
  private async processDelivery(delivery: WebhookDelivery): Promise<void> {
    const subscription = this.subscriptions.get(delivery.subscriptionId);
    if (!subscription) {
      // Subscription was deleted
      delivery.status = 'cancelled';
      this.deliveryQueue.delete(delivery.id);
      return;
    }

    const startTime = Date.now();
    
    try {
      this.emit('deliveryAttempt', { deliveryId: delivery.id, attempt: delivery.attempt });

      const payload = JSON.stringify(delivery.event);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Backstage-Catalog-Webhook/1.0',
        'X-Webhook-Event': delivery.event.type,
        'X-Webhook-Delivery': delivery.id,
        'X-Webhook-Attempt': delivery.attempt.toString(),
        ...subscription.headers,
      };

      if (subscription.secret) {
        headers['X-Webhook-Signature'] = this.generateSignature(payload, subscription.secret);
      }

      const response = await fetch(subscription.url, {
        method: 'POST',
        headers,
        body: payload,
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      delivery.statusCode = response.status;
      delivery.responseTime = Date.now() - startTime;
      delivery.deliveredAt = new Date();

      if (response.ok) {
        // Success
        delivery.status = 'success';
        this.metrics.deliveries.successful++;
        this.metrics.deliveries.pending--;
        
        this.deliveryQueue.delete(delivery.id);
        this.addToHistory(delivery);
        
        this.emit('deliverySuccess', delivery);
        
      } else {
        // HTTP error - retry if configured
        delivery.error = `HTTP ${response.status}: ${response.statusText}`;
        await this.handleDeliveryFailure(delivery, subscription);
      }

    } catch (error) {
      // Network or other error
      delivery.error = error instanceof Error ? error.message : 'Unknown error';
      delivery.responseTime = Date.now() - startTime;
      
      await this.handleDeliveryFailure(delivery, subscription);
    }

    this.updatePerformanceMetrics();
  }

  /**
   * Handle delivery failure with retry logic
   */
  private async handleDeliveryFailure(
    delivery: WebhookDelivery,
    subscription: WebhookSubscription
  ): Promise<void> {
    const retryPolicy = subscription.retryPolicy || {
      maxAttempts: 3,
      backoffMultiplier: 2,
      maxDelay: 300000,
    };

    if (delivery.attempt >= retryPolicy.maxAttempts) {
      // Max retries exceeded
      delivery.status = 'failed';
      this.metrics.deliveries.failed++;
      this.metrics.deliveries.pending--;
      
      this.deliveryQueue.delete(delivery.id);
      this.addToHistory(delivery);
      
      this.emit('deliveryFailed', delivery);
      
    } else {
      // Schedule retry
      delivery.attempt++;
      
      const baseDelay = 1000; // 1 second
      const delay = Math.min(
        baseDelay * Math.pow(retryPolicy.backoffMultiplier, delivery.attempt - 1),
        retryPolicy.maxDelay
      );
      
      delivery.nextRetryAt = new Date(Date.now() + delay);
      
      this.emit('deliveryRetryScheduled', {
        deliveryId: delivery.id,
        attempt: delivery.attempt,
        retryAt: delivery.nextRetryAt,
      });
    }
  }

  /**
   * Add delivery to history
   */
  private addToHistory(delivery: WebhookDelivery): void {
    const history = this.deliveryHistory.get(delivery.subscriptionId) || [];
    history.push({ ...delivery });
    
    // Keep only last 1000 deliveries per subscription
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
    
    this.deliveryHistory.set(delivery.subscriptionId, history);
  }

  /**
   * Generate webhook signature
   */
  private generateSignature(payload: string, secret: string): string {
    return `sha256=${crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')}`;
  }

  /**
   * Generate subscription ID
   */
  private generateSubscriptionId(): string {
    return `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update subscription metrics
   */
  private updateSubscriptionMetrics(): void {
    const subscriptions = Array.from(this.subscriptions.values());
    
    this.metrics.subscriptions.total = subscriptions.length;
    this.metrics.subscriptions.active = subscriptions.filter(s => s.active).length;
    this.metrics.subscriptions.inactive = subscriptions.filter(s => !s.active).length;
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(): void {
    const allHistory = Array.from(this.deliveryHistory.values()).flat();
    
    if (allHistory.length === 0) {
      return;
    }

    // Calculate average response time
    const responseTimes = allHistory
      .filter(d => d.responseTime)
      .map(d => d.responseTime!);
    
    this.metrics.performance.averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0;

    // Calculate success rate
    const successful = allHistory.filter(d => d.status === 'success').length;
    const total = allHistory.filter(d => d.status !== 'pending').length;
    
    this.metrics.performance.successRate = total > 0 ? successful / total : 0;
  }
}

export default WebhookManager;