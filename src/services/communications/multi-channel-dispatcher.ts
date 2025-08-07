import { EventEmitter } from 'events';
import { Logger } from '@/lib/logger';
import { NotificationChannel, CommunicationConfig, ChannelConfigs } from './communications-config';
import { NotificationDelivery, DeliveryStatus } from './notification-engine';

export interface ChannelAdapter {
  send(delivery: NotificationDelivery, config: any): Promise<ChannelDeliveryResult>;
  validateConfig(config: any): boolean;
  getMaxMessageLength(): number;
  supportsRichContent(): boolean;
}

export interface ChannelDeliveryResult {
  success: boolean;
  messageId?: string;
  error?: string;
  metadata?: Record<string, any>;
  retryable?: boolean;
}

export interface DeliveryMetrics {
  channel: NotificationChannel;
  total: number;
  successful: number;
  failed: number;
  avgDeliveryTime: number;
  lastDeliveryAt?: Date;
}

export class MultiChannelDispatcher extends EventEmitter {
  private readonly logger = new Logger('MultiChannelDispatcher');
  private readonly adapters = new Map<NotificationChannel, ChannelAdapter>();
  private readonly rateLimiters = new Map<NotificationChannel, RateLimiter>();
  private readonly metrics = new Map<NotificationChannel, DeliveryMetrics>();
  private readonly deliveryQueue = new Map<string, NotificationDelivery>();

  constructor(private config: CommunicationConfig) {
    super();
    this.initializeAdapters();
    this.initializeRateLimiters();
    this.initializeMetrics();
  }

  private initializeAdapters(): void {
    // Initialize all channel adapters
    this.adapters.set(NotificationChannel.EMAIL, new EmailAdapter());
    this.adapters.set(NotificationChannel.SLACK, new SlackAdapter());
    this.adapters.set(NotificationChannel.TEAMS, new TeamsAdapter());
    this.adapters.set(NotificationChannel.SMS, new SmsAdapter());
    this.adapters.set(NotificationChannel.WEBHOOK, new WebhookAdapter());
    this.adapters.set(NotificationChannel.PUSH, new PushAdapter());
    this.adapters.set(NotificationChannel.DISCORD, new DiscordAdapter());
  }

  private initializeRateLimiters(): void {
    Object.entries(this.config.rateLimits).forEach(([channel, limits]) => {
      this.rateLimiters.set(
        channel as NotificationChannel,
        new RateLimiter(limits.requestsPerMinute, limits.burstLimit)
      );
    });
  }

  private initializeMetrics(): void {
    Object.values(NotificationChannel).forEach(channel => {
      this.metrics.set(channel, {
        channel,
        total: 0,
        successful: 0,
        failed: 0,
        avgDeliveryTime: 0
      });
    });
  }

  public async dispatch(delivery: NotificationDelivery): Promise<void> {
    const startTime = Date.now();
    
    try {
      delivery.status = DeliveryStatus.PROCESSING;
      this.deliveryQueue.set(delivery.id, delivery);

      // Check rate limits
      const rateLimiter = this.rateLimiters.get(delivery.channel);
      if (rateLimiter && !rateLimiter.canExecute()) {
        throw new Error(`Rate limit exceeded for channel: ${delivery.channel}`);
      }

      // Get adapter for channel
      const adapter = this.adapters.get(delivery.channel);
      if (!adapter) {
        throw new Error(`No adapter found for channel: ${delivery.channel}`);
      }

      // Get channel configuration
      const channelConfig = this.getChannelConfig(delivery.channel);
      if (!channelConfig || !adapter.validateConfig(channelConfig)) {
        throw new Error(`Invalid configuration for channel: ${delivery.channel}`);
      }

      // Attempt delivery
      delivery.attempt++;
      const result = await adapter.send(delivery, channelConfig);

      if (result.success) {
        delivery.status = DeliveryStatus.DELIVERED;
        delivery.deliveredAt = new Date();
        delivery.metadata = { ...delivery.metadata, ...result.metadata };

        this.updateMetrics(delivery.channel, true, Date.now() - startTime);
        this.emit('deliverySuccess', delivery, result);
        
        this.logger.info('Delivery successful', {
          deliveryId: delivery.id,
          channel: delivery.channel,
          messageId: result.messageId
        });
      } else {
        delivery.status = DeliveryStatus.FAILED;
        delivery.failedAt = new Date();
        delivery.error = result.error;

        this.updateMetrics(delivery.channel, false, Date.now() - startTime);
        this.emit('deliveryFailed', delivery, result);

        this.logger.error('Delivery failed', {
          deliveryId: delivery.id,
          channel: delivery.channel,
          error: result.error,
          retryable: result.retryable
        });

        // Schedule retry if retryable
        if (result.retryable && delivery.attempt < this.config.retryAttempts) {
          await this.scheduleRetry(delivery);
        }
      }
    } catch (error) {
      delivery.status = DeliveryStatus.FAILED;
      delivery.failedAt = new Date();
      delivery.error = error instanceof Error ? error.message : 'Unknown error';

      this.updateMetrics(delivery.channel, false, Date.now() - startTime);
      this.emit('deliveryError', delivery, error);

      this.logger.error('Delivery error', {
        deliveryId: delivery.id,
        channel: delivery.channel,
        error
      });
    } finally {
      this.deliveryQueue.set(delivery.id, delivery);
    }
  }

  private async scheduleRetry(delivery: NotificationDelivery): Promise<void> {
    const delay = this.calculateRetryDelay(delivery.attempt);
    
    setTimeout(async () => {
      await this.dispatch(delivery);
    }, delay);

    this.logger.info('Retry scheduled', {
      deliveryId: delivery.id,
      attempt: delivery.attempt,
      delay
    });
  }

  private calculateRetryDelay(attempt: number): number {
    const baseDelay = this.config.retryDelay;
    const backoffMultiplier = 2;
    const jitter = Math.random() * 1000;
    
    return Math.min(baseDelay * Math.pow(backoffMultiplier, attempt - 1) + jitter, 300000);
  }

  private getChannelConfig(channel: NotificationChannel): any {
    const configs: Record<NotificationChannel, any> = {
      [NotificationChannel.EMAIL]: this.config.channels.email,
      [NotificationChannel.SLACK]: this.config.channels.slack,
      [NotificationChannel.TEAMS]: this.config.channels.teams,
      [NotificationChannel.SMS]: this.config.channels.sms,
      [NotificationChannel.WEBHOOK]: this.config.channels.webhook,
      [NotificationChannel.PUSH]: this.config.channels.push,
      [NotificationChannel.DISCORD]: this.config.channels.discord
    };

    return configs[channel];
  }

  private updateMetrics(channel: NotificationChannel, success: boolean, deliveryTime: number): void {
    const metrics = this.metrics.get(channel);
    if (!metrics) return;

    metrics.total++;
    if (success) {
      metrics.successful++;
    } else {
      metrics.failed++;
    }

    // Update average delivery time
    metrics.avgDeliveryTime = (metrics.avgDeliveryTime * (metrics.total - 1) + deliveryTime) / metrics.total;
    metrics.lastDeliveryAt = new Date();

    this.metrics.set(channel, metrics);
  }

  public getMetrics(): DeliveryMetrics[] {
    return Array.from(this.metrics.values());
  }

  public getChannelHealth(channel: NotificationChannel): any {
    const metrics = this.metrics.get(channel);
    if (!metrics) return null;

    const successRate = metrics.total > 0 ? (metrics.successful / metrics.total) * 100 : 0;
    const rateLimiter = this.rateLimiters.get(channel);

    return {
      channel,
      successRate,
      avgDeliveryTime: metrics.avgDeliveryTime,
      totalDeliveries: metrics.total,
      rateLimitRemaining: rateLimiter?.getRemainingRequests() || 0,
      lastDeliveryAt: metrics.lastDeliveryAt,
      isHealthy: successRate > 95 && metrics.avgDeliveryTime < 10000
    };
  }
}

// Rate Limiter Implementation
class RateLimiter {
  private requests: number[] = [];

  constructor(
    private requestsPerMinute: number,
    private burstLimit: number
  ) {}

  canExecute(): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Remove old requests
    this.requests = this.requests.filter(time => time > oneMinuteAgo);

    // Check limits
    return this.requests.length < this.requestsPerMinute && 
           this.requests.length < this.burstLimit;
  }

  recordRequest(): void {
    this.requests.push(Date.now());
  }

  getRemainingRequests(): number {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    this.requests = this.requests.filter(time => time > oneMinuteAgo);
    
    return Math.max(0, this.requestsPerMinute - this.requests.length);
  }
}

// Channel Adapter Implementations
class EmailAdapter implements ChannelAdapter {
  async send(delivery: NotificationDelivery, config: any): Promise<ChannelDeliveryResult> {
    try {
      // Implementation for email sending
      // This would integrate with SendGrid, SES, etc.
      const messageId = `email_${Date.now()}`;
      
      return {
        success: true,
        messageId,
        metadata: { provider: config.provider }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: true
      };
    }
  }

  validateConfig(config: any): boolean {
    return !!(config?.enabled && config?.apiKey && config?.fromAddress);
  }

  getMaxMessageLength(): number {
    return 100000; // 100KB for email
  }

  supportsRichContent(): boolean {
    return true;
  }
}

class SlackAdapter implements ChannelAdapter {
  async send(delivery: NotificationDelivery, config: any): Promise<ChannelDeliveryResult> {
    try {
      // Implementation for Slack integration
      const messageId = `slack_${Date.now()}`;
      
      return {
        success: true,
        messageId,
        metadata: { channel: config.defaultChannel }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: true
      };
    }
  }

  validateConfig(config: any): boolean {
    return !!(config?.enabled && config?.botToken);
  }

  getMaxMessageLength(): number {
    return 3000;
  }

  supportsRichContent(): boolean {
    return true;
  }
}

class TeamsAdapter implements ChannelAdapter {
  async send(delivery: NotificationDelivery, config: any): Promise<ChannelDeliveryResult> {
    try {
      // Implementation for Microsoft Teams integration
      const messageId = `teams_${Date.now()}`;
      
      return {
        success: true,
        messageId,
        metadata: { team: config.defaultTeam }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: true
      };
    }
  }

  validateConfig(config: any): boolean {
    return !!(config?.enabled && config?.appId && config?.appSecret);
  }

  getMaxMessageLength(): number {
    return 2000;
  }

  supportsRichContent(): boolean {
    return true;
  }
}

class SmsAdapter implements ChannelAdapter {
  async send(delivery: NotificationDelivery, config: any): Promise<ChannelDeliveryResult> {
    try {
      // Implementation for SMS sending
      const messageId = `sms_${Date.now()}`;
      
      return {
        success: true,
        messageId,
        metadata: { provider: config.provider }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: true
      };
    }
  }

  validateConfig(config: any): boolean {
    return !!(config?.enabled && config?.apiKey && config?.fromNumber);
  }

  getMaxMessageLength(): number {
    return 160;
  }

  supportsRichContent(): boolean {
    return false;
  }
}

class WebhookAdapter implements ChannelAdapter {
  async send(delivery: NotificationDelivery, config: any): Promise<ChannelDeliveryResult> {
    try {
      // Implementation for webhook delivery
      const messageId = `webhook_${Date.now()}`;
      
      return {
        success: true,
        messageId,
        metadata: { timeout: config.timeout }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: true
      };
    }
  }

  validateConfig(config: any): boolean {
    return !!(config?.enabled);
  }

  getMaxMessageLength(): number {
    return 1000000; // 1MB for webhooks
  }

  supportsRichContent(): boolean {
    return true;
  }
}

class PushAdapter implements ChannelAdapter {
  async send(delivery: NotificationDelivery, config: any): Promise<ChannelDeliveryResult> {
    try {
      // Implementation for push notifications
      const messageId = `push_${Date.now()}`;
      
      return {
        success: true,
        messageId,
        metadata: { platform: 'firebase' }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: true
      };
    }
  }

  validateConfig(config: any): boolean {
    return !!(config?.enabled && config?.firebase?.projectId);
  }

  getMaxMessageLength(): number {
    return 4000;
  }

  supportsRichContent(): boolean {
    return true;
  }
}

class DiscordAdapter implements ChannelAdapter {
  async send(delivery: NotificationDelivery, config: any): Promise<ChannelDeliveryResult> {
    try {
      // Implementation for Discord integration
      const messageId = `discord_${Date.now()}`;
      
      return {
        success: true,
        messageId,
        metadata: { guild: config.defaultGuild }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: true
      };
    }
  }

  validateConfig(config: any): boolean {
    return !!(config?.enabled && config?.botToken);
  }

  getMaxMessageLength(): number {
    return 2000;
  }

  supportsRichContent(): boolean {
    return true;
  }
}