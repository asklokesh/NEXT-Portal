import crypto from 'crypto';
import axios from 'axios';
import { prisma } from '@/lib/db/client';

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  secret: string;
  enabled: boolean;
  events: string[];
  headers?: Record<string, string>;
  timeout?: number;
  retryConfig: {
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier: number;
  };
  filters?: {
    priorities?: string[];
    environments?: string[];
    serviceIds?: string[];
    types?: string[];
  };
  tenantId?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventType: string;
  payload: any;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  attempts: number;
  maxAttempts: number;
  responseStatus?: number;
  responseBody?: string;
  errorMessage?: string;
  scheduledAt: Date;
  deliveredAt?: Date;
  nextRetryAt?: Date;
  tenantId?: string;
}

export class WebhookManager {
  private static instance: WebhookManager;
  private deliveryQueue: WebhookDelivery[] = [];
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;

  static getInstance(): WebhookManager {
    if (!WebhookManager.instance) {
      WebhookManager.instance = new WebhookManager();
    }
    return WebhookManager.instance;
  }

  constructor() {
    this.startProcessing();
  }

  /**
   * Register a new webhook
   */
  async registerWebhook(config: Omit<WebhookConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<WebhookConfig> {
    const webhook: WebhookConfig = {
      ...config,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Store in database (implement based on your schema)
    await this.storeWebhook(webhook);

    return webhook;
  }

  /**
   * Update webhook configuration
   */
  async updateWebhook(id: string, updates: Partial<WebhookConfig>): Promise<WebhookConfig | null> {
    const existing = await this.getWebhook(id);
    if (!existing) return null;

    const updated: WebhookConfig = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };

    await this.storeWebhook(updated);
    return updated;
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(id: string): Promise<boolean> {
    try {
      // Remove from database
      await prisma.webhook?.delete({ where: { id } });
      return true;
    } catch (error) {
      console.error('Failed to delete webhook:', error);
      return false;
    }
  }

  /**
   * Get webhook by ID
   */
  async getWebhook(id: string): Promise<WebhookConfig | null> {
    try {
      const webhook = await prisma.webhook?.findUnique({ where: { id } });
      return webhook as WebhookConfig | null;
    } catch (error) {
      console.error('Failed to get webhook:', error);
      return null;
    }
  }

  /**
   * List webhooks for tenant
   */
  async listWebhooks(tenantId?: string): Promise<WebhookConfig[]> {
    try {
      const where = tenantId ? { tenantId } : {};
      const webhooks = await prisma.webhook?.findMany({ where });
      return (webhooks as WebhookConfig[]) || [];
    } catch (error) {
      console.error('Failed to list webhooks:', error);
      return [];
    }
  }

  /**
   * Send webhook notification
   */
  async sendWebhook(eventType: string, payload: any, tenantId?: string): Promise<void> {
    const webhooks = await this.getActiveWebhooks(eventType, tenantId);
    
    for (const webhook of webhooks) {
      if (this.matchesFilters(webhook, payload)) {
        await this.scheduleDelivery(webhook, eventType, payload);
      }
    }
  }

  /**
   * Send notification events via webhooks
   */
  async sendNotificationWebhook(notification: any): Promise<void> {
    const eventType = `notification.${notification.type}`;
    
    const webhookPayload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data: {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        priority: notification.priority,
        source: notification.source,
        userId: notification.userId,
        metadata: notification.metadata,
        createdAt: notification.createdAt
      },
      metadata: {
        deliveryId: crypto.randomUUID(),
        version: '1.0'
      }
    };

    await this.sendWebhook(eventType, webhookPayload, notification.tenantId);
  }

  /**
   * Send deployment event webhook
   */
  async sendDeploymentWebhook(data: {
    serviceId: string;
    serviceName: string;
    version: string;
    environment: string;
    status: string;
    deploymentId: string;
    tenantId?: string;
  }): Promise<void> {
    const eventType = `deployment.${data.status}`;
    
    const webhookPayload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data: {
        serviceId: data.serviceId,
        serviceName: data.serviceName,
        version: data.version,
        environment: data.environment,
        status: data.status,
        deploymentId: data.deploymentId,
        deploymentUrl: `${process.env.BASE_URL}/deployments/${data.deploymentId}`
      },
      metadata: {
        deliveryId: crypto.randomUUID(),
        version: '1.0'
      }
    };

    await this.sendWebhook(eventType, webhookPayload, data.tenantId);
  }

  /**
   * Send monitoring alert webhook
   */
  async sendAlertWebhook(data: {
    serviceId: string;
    serviceName: string;
    alertType: string;
    severity: string;
    message: string;
    environment: string;
    tenantId?: string;
  }): Promise<void> {
    const eventType = `alert.${data.severity}`;
    
    const webhookPayload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data: {
        serviceId: data.serviceId,
        serviceName: data.serviceName,
        alertType: data.alertType,
        severity: data.severity,
        message: data.message,
        environment: data.environment,
        alertUrl: `${process.env.BASE_URL}/monitoring/${data.serviceId}`
      },
      metadata: {
        deliveryId: crypto.randomUUID(),
        version: '1.0'
      }
    };

    await this.sendWebhook(eventType, webhookPayload, data.tenantId);
  }

  /**
   * Test webhook delivery
   */
  async testWebhook(webhookId: string): Promise<{ success: boolean; response?: any; error?: string }> {
    const webhook = await this.getWebhook(webhookId);
    if (!webhook) {
      return { success: false, error: 'Webhook not found' };
    }

    const testPayload = {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook delivery',
        webhookId: webhook.id,
        webhookName: webhook.name
      },
      metadata: {
        deliveryId: crypto.randomUUID(),
        version: '1.0',
        test: true
      }
    };

    try {
      const response = await this.deliverWebhook(webhook, testPayload);
      return { success: true, response };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get webhook delivery history
   */
  async getDeliveryHistory(webhookId: string, limit = 100): Promise<WebhookDelivery[]> {
    try {
      const deliveries = await prisma.webhookDelivery?.findMany({
        where: { webhookId },
        orderBy: { scheduledAt: 'desc' },
        take: limit
      });
      return (deliveries as WebhookDelivery[]) || [];
    } catch (error) {
      console.error('Failed to get delivery history:', error);
      return [];
    }
  }

  /**
   * Get webhook statistics
   */
  async getWebhookStats(webhookId: string, days = 30): Promise<{
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    averageResponseTime: number;
    successRate: number;
  }> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const deliveries = await prisma.webhookDelivery?.findMany({
        where: {
          webhookId,
          scheduledAt: { gte: since }
        }
      });

      if (!deliveries || deliveries.length === 0) {
        return {
          totalDeliveries: 0,
          successfulDeliveries: 0,
          failedDeliveries: 0,
          averageResponseTime: 0,
          successRate: 0
        };
      }

      const successful = deliveries.filter(d => d.status === 'delivered').length;
      const failed = deliveries.filter(d => d.status === 'failed').length;

      return {
        totalDeliveries: deliveries.length,
        successfulDeliveries: successful,
        failedDeliveries: failed,
        averageResponseTime: 0, // Calculate from response times if tracked
        successRate: successful / deliveries.length * 100
      };
    } catch (error) {
      console.error('Failed to get webhook stats:', error);
      return {
        totalDeliveries: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        averageResponseTime: 0,
        successRate: 0
      };
    }
  }

  /**
   * Private methods
   */
  
  private async getActiveWebhooks(eventType: string, tenantId?: string): Promise<WebhookConfig[]> {
    const webhooks = await this.listWebhooks(tenantId);
    return webhooks.filter(w => w.enabled && w.events.includes(eventType));
  }

  private matchesFilters(webhook: WebhookConfig, payload: any): boolean {
    if (!webhook.filters) return true;

    const data = payload.data;
    if (!data) return true;

    const filters = webhook.filters;

    // Check priority filter
    if (filters.priorities && data.priority && !filters.priorities.includes(data.priority)) {
      return false;
    }

    // Check environment filter
    if (filters.environments && data.environment && !filters.environments.includes(data.environment)) {
      return false;
    }

    // Check service ID filter
    if (filters.serviceIds && data.serviceId && !filters.serviceIds.includes(data.serviceId)) {
      return false;
    }

    // Check type filter
    if (filters.types && data.type && !filters.types.includes(data.type)) {
      return false;
    }

    return true;
  }

  private async scheduleDelivery(webhook: WebhookConfig, eventType: string, payload: any): Promise<void> {
    const delivery: WebhookDelivery = {
      id: crypto.randomUUID(),
      webhookId: webhook.id,
      eventType,
      payload,
      status: 'pending',
      attempts: 0,
      maxAttempts: webhook.retryConfig.maxRetries + 1,
      scheduledAt: new Date(),
      tenantId: webhook.tenantId
    };

    // Store delivery record
    await this.storeDelivery(delivery);

    // Add to processing queue
    this.deliveryQueue.push(delivery);
  }

  private async deliverWebhook(webhook: WebhookConfig, payload: any): Promise<any> {
    const signature = this.generateSignature(webhook.secret, payload);
    
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'NextPortal-Webhooks/1.0',
      'X-Webhook-Signature': signature,
      'X-Webhook-ID': webhook.id,
      'X-Webhook-Event': payload.event,
      ...webhook.headers
    };

    const timeout = webhook.timeout || 30000; // 30 second default

    const response = await axios.post(webhook.url, payload, {
      headers,
      timeout,
      validateStatus: (status) => status < 500 // Only retry on 5xx errors
    });

    return response;
  }

  private generateSignature(secret: string, payload: any): string {
    const payloadString = JSON.stringify(payload);
    return crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
  }

  private startProcessing(): void {
    if (this.processingInterval) return;

    this.processingInterval = setInterval(async () => {
      if (!this.isProcessing && this.deliveryQueue.length > 0) {
        await this.processDeliveryQueue();
      }
    }, 5000); // Process every 5 seconds
  }

  private async processDeliveryQueue(): Promise<void> {
    this.isProcessing = true;

    try {
      const batch = this.deliveryQueue.splice(0, 10); // Process 10 at a time
      
      await Promise.allSettled(
        batch.map(delivery => this.processDelivery(delivery))
      );
    } catch (error) {
      console.error('Error processing webhook delivery queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processDelivery(delivery: WebhookDelivery): Promise<void> {
    const webhook = await this.getWebhook(delivery.webhookId);
    if (!webhook || !webhook.enabled) {
      // Mark as failed - webhook disabled or deleted
      delivery.status = 'failed';
      delivery.errorMessage = 'Webhook disabled or deleted';
      await this.updateDelivery(delivery);
      return;
    }

    try {
      delivery.attempts++;
      const response = await this.deliverWebhook(webhook, delivery.payload);
      
      delivery.status = 'delivered';
      delivery.responseStatus = response.status;
      delivery.responseBody = JSON.stringify(response.data).substring(0, 1000); // Limit size
      delivery.deliveredAt = new Date();
      
      await this.updateDelivery(delivery);
      
    } catch (error: any) {
      delivery.errorMessage = error.message;
      delivery.responseStatus = error.response?.status;
      
      if (delivery.attempts < delivery.maxAttempts) {
        // Schedule retry
        delivery.status = 'retrying';
        const retryDelay = webhook.retryConfig.retryDelay * 
          Math.pow(webhook.retryConfig.backoffMultiplier, delivery.attempts - 1);
        delivery.nextRetryAt = new Date(Date.now() + retryDelay * 1000);
        
        // Re-queue for retry
        setTimeout(() => {
          this.deliveryQueue.push(delivery);
        }, retryDelay * 1000);
        
      } else {
        // Max retries reached
        delivery.status = 'failed';
      }
      
      await this.updateDelivery(delivery);
    }
  }

  private async storeWebhook(webhook: WebhookConfig): Promise<void> {
    // Implementation depends on your database schema
    // This is a placeholder for the actual database operation
    console.log('Storing webhook:', webhook.id);
  }

  private async storeDelivery(delivery: WebhookDelivery): Promise<void> {
    // Implementation depends on your database schema
    console.log('Storing delivery:', delivery.id);
  }

  private async updateDelivery(delivery: WebhookDelivery): Promise<void> {
    // Implementation depends on your database schema
    console.log('Updating delivery:', delivery.id, delivery.status);
  }

  /**
   * Cleanup old webhook deliveries
   */
  async cleanupOldDeliveries(daysToKeep = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      await prisma.webhookDelivery?.deleteMany({
        where: {
          scheduledAt: { lt: cutoffDate }
        }
      });

      console.log(`Cleaned up webhook deliveries older than ${daysToKeep} days`);
    } catch (error) {
      console.error('Failed to cleanup old deliveries:', error);
    }
  }

  /**
   * Get system-wide webhook statistics
   */
  async getSystemStats(): Promise<{
    totalWebhooks: number;
    activeWebhooks: number;
    totalDeliveries: number;
    pendingDeliveries: number;
    failedDeliveries: number;
  }> {
    try {
      const [webhooks, deliveries] = await Promise.all([
        this.listWebhooks(),
        prisma.webhookDelivery?.findMany({
          where: {
            scheduledAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
          }
        })
      ]);

      const activeWebhooks = webhooks.filter(w => w.enabled).length;
      const pendingDeliveries = deliveries?.filter(d => d.status === 'pending' || d.status === 'retrying').length || 0;
      const failedDeliveries = deliveries?.filter(d => d.status === 'failed').length || 0;

      return {
        totalWebhooks: webhooks.length,
        activeWebhooks,
        totalDeliveries: deliveries?.length || 0,
        pendingDeliveries,
        failedDeliveries
      };
    } catch (error) {
      console.error('Failed to get system stats:', error);
      return {
        totalWebhooks: 0,
        activeWebhooks: 0,
        totalDeliveries: 0,
        pendingDeliveries: 0,
        failedDeliveries: 0
      };
    }
  }
}

// Export singleton instance
export const webhookManager = WebhookManager.getInstance();