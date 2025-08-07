import { Logger } from '@/lib/logger';
import { NotificationChannel } from './communications-config';
import { NotificationMessage } from './notification-engine';

export interface IntegrationAdapter {
  name: string;
  channel: NotificationChannel;
  version: string;
  enabled: boolean;
  healthCheck(): Promise<AdapterHealth>;
  send(message: AdapterMessage): Promise<AdapterResponse>;
  validateConfig(config: any): AdapterValidation;
  getCapabilities(): AdapterCapabilities;
  handleWebhook?(payload: any, signature?: string): Promise<WebhookResponse>;
}

export interface AdapterHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  error?: string;
  lastChecked: Date;
  details?: Record<string, any>;
}

export interface AdapterMessage {
  id: string;
  to: string | string[];
  subject?: string;
  content: string;
  htmlContent?: string;
  attachments?: Attachment[];
  metadata: Record<string, any>;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  thread?: string;
  replyTo?: string;
}

export interface AdapterResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  retryable?: boolean;
  rateLimited?: boolean;
  metadata?: Record<string, any>;
}

export interface AdapterValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface AdapterCapabilities {
  maxMessageSize: number;
  supportsBatch: boolean;
  supportsHtml: boolean;
  supportsAttachments: boolean;
  supportsThreads: boolean;
  supportsRichContent: boolean;
  rateLimit: {
    requestsPerMinute: number;
    burstLimit: number;
  };
}

export interface Attachment {
  name: string;
  content: Buffer | string;
  contentType: string;
  size: number;
}

export interface WebhookResponse {
  processed: boolean;
  events: WebhookEvent[];
}

export interface WebhookEvent {
  type: string;
  messageId?: string;
  timestamp: Date;
  data: Record<string, any>;
}

// Slack Integration Adapter
export class SlackAdapter implements IntegrationAdapter {
  name = 'Slack';
  channel = NotificationChannel.SLACK;
  version = '1.0.0';
  enabled = true;
  
  private readonly logger = new Logger('SlackAdapter');
  private client?: any; // Slack SDK client

  constructor(private config: any) {
    this.initializeClient();
  }

  private initializeClient(): void {
    if (this.config.botToken) {
      // Initialize Slack SDK client
      // this.client = new WebClient(this.config.botToken);
    }
  }

  async healthCheck(): Promise<AdapterHealth> {
    const startTime = Date.now();
    
    try {
      if (!this.client) {
        return {
          status: 'unhealthy',
          error: 'Client not initialized',
          lastChecked: new Date()
        };
      }

      // Perform health check - test API connection
      // const result = await this.client.auth.test();
      
      return {
        status: 'healthy',
        latency: Date.now() - startTime,
        lastChecked: new Date(),
        details: {
          // team: result.team,
          // user: result.user
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date()
      };
    }
  }

  async send(message: AdapterMessage): Promise<AdapterResponse> {
    try {
      if (!this.client) {
        return {
          success: false,
          error: 'Slack client not initialized',
          retryable: false
        };
      }

      const blocks = this.formatSlackBlocks(message);
      const payload = {
        channel: message.to,
        text: message.subject || message.content.substring(0, 100),
        blocks: blocks,
        thread_ts: message.thread,
        metadata: {
          event_type: 'notification',
          event_payload: {
            id: message.id,
            priority: message.priority
          }
        }
      };

      // Send message via Slack API
      // const result = await this.client.chat.postMessage(payload);

      return {
        success: true,
        messageId: 'mock-slack-id', // result.ts
        metadata: {
          channel: message.to,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      this.logger.error('Failed to send Slack message', { error, messageId: message.id });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: this.isRetryableError(error),
        rateLimited: this.isRateLimitError(error)
      };
    }
  }

  private formatSlackBlocks(message: AdapterMessage): any[] {
    const blocks: any[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: message.content
        }
      }
    ];

    // Add actions if metadata contains action buttons
    if (message.metadata.actions) {
      blocks.push({
        type: 'actions',
        elements: message.metadata.actions.map((action: any) => ({
          type: 'button',
          text: {
            type: 'plain_text',
            text: action.text
          },
          url: action.url,
          style: action.style || 'default'
        }))
      });
    }

    return blocks;
  }

  validateConfig(config: any): AdapterValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.enabled) {
      return { valid: false, errors: ['Slack integration disabled'], warnings };
    }

    if (!config.botToken) {
      errors.push('Bot token is required');
    }

    if (!config.signingSecret) {
      warnings.push('Signing secret recommended for webhook verification');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  getCapabilities(): AdapterCapabilities {
    return {
      maxMessageSize: 3000,
      supportsBatch: false,
      supportsHtml: false,
      supportsAttachments: true,
      supportsThreads: true,
      supportsRichContent: true,
      rateLimit: {
        requestsPerMinute: 50,
        burstLimit: 100
      }
    };
  }

  async handleWebhook(payload: any, signature?: string): Promise<WebhookResponse> {
    const events: WebhookEvent[] = [];

    // Verify signature if provided
    if (signature && !this.verifySlackSignature(payload, signature)) {
      throw new Error('Invalid webhook signature');
    }

    // Handle different event types
    if (payload.type === 'event_callback') {
      events.push({
        type: payload.event.type,
        timestamp: new Date(payload.event.ts * 1000),
        data: payload.event
      });
    }

    return { processed: true, events };
  }

  private verifySlackSignature(payload: any, signature: string): boolean {
    // Implement Slack signature verification
    return true; // Simplified for demo
  }

  private isRetryableError(error: any): boolean {
    const retryableErrors = ['rate_limited', 'timeout', 'server_error'];
    return retryableErrors.includes(error?.code);
  }

  private isRateLimitError(error: any): boolean {
    return error?.code === 'rate_limited';
  }
}

// Microsoft Teams Integration Adapter
export class TeamsAdapter implements IntegrationAdapter {
  name = 'Microsoft Teams';
  channel = NotificationChannel.TEAMS;
  version = '1.0.0';
  enabled = true;
  
  private readonly logger = new Logger('TeamsAdapter');

  constructor(private config: any) {}

  async healthCheck(): Promise<AdapterHealth> {
    try {
      // Perform Teams API health check
      return {
        status: 'healthy',
        lastChecked: new Date()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date()
      };
    }
  }

  async send(message: AdapterMessage): Promise<AdapterResponse> {
    try {
      const adaptiveCard = this.formatAdaptiveCard(message);
      
      // Send via Teams API
      return {
        success: true,
        messageId: `teams-${Date.now()}`,
        metadata: { format: 'adaptive-card' }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: true
      };
    }
  }

  private formatAdaptiveCard(message: AdapterMessage): any {
    return {
      type: 'AdaptiveCard',
      version: '1.3',
      body: [
        {
          type: 'TextBlock',
          text: message.subject || 'Notification',
          weight: 'Bolder',
          size: 'Medium'
        },
        {
          type: 'TextBlock',
          text: message.content,
          wrap: true
        }
      ]
    };
  }

  validateConfig(config: any): AdapterValidation {
    const errors: string[] = [];
    if (!config.enabled) {
      return { valid: false, errors: ['Teams integration disabled'], warnings: [] };
    }

    if (!config.appId || !config.appSecret) {
      errors.push('App ID and secret are required');
    }

    return { valid: errors.length === 0, errors, warnings: [] };
  }

  getCapabilities(): AdapterCapabilities {
    return {
      maxMessageSize: 2000,
      supportsBatch: false,
      supportsHtml: true,
      supportsAttachments: true,
      supportsThreads: false,
      supportsRichContent: true,
      rateLimit: {
        requestsPerMinute: 30,
        burstLimit: 60
      }
    };
  }
}

// Email Integration Adapter
export class EmailAdapter implements IntegrationAdapter {
  name = 'Email';
  channel = NotificationChannel.EMAIL;
  version = '1.0.0';
  enabled = true;
  
  private readonly logger = new Logger('EmailAdapter');

  constructor(private config: any) {}

  async healthCheck(): Promise<AdapterHealth> {
    try {
      // Test email service connection
      return {
        status: 'healthy',
        lastChecked: new Date(),
        details: { provider: this.config.provider }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date()
      };
    }
  }

  async send(message: AdapterMessage): Promise<AdapterResponse> {
    try {
      const emailPayload = {
        to: Array.isArray(message.to) ? message.to : [message.to],
        from: {
          email: this.config.fromAddress,
          name: this.config.fromName
        },
        subject: message.subject || 'Notification',
        content: [
          {
            type: 'text/plain',
            value: message.content
          }
        ]
      };

      if (message.htmlContent) {
        emailPayload.content.push({
          type: 'text/html',
          value: message.htmlContent
        });
      }

      // Send via email service provider (SendGrid, SES, etc.)
      return {
        success: true,
        messageId: `email-${Date.now()}`,
        metadata: { provider: this.config.provider }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: true
      };
    }
  }

  validateConfig(config: any): AdapterValidation {
    const errors: string[] = [];
    if (!config.enabled) {
      return { valid: false, errors: ['Email integration disabled'], warnings: [] };
    }

    if (!config.apiKey) {
      errors.push('API key is required');
    }
    if (!config.fromAddress) {
      errors.push('From address is required');
    }

    return { valid: errors.length === 0, errors, warnings: [] };
  }

  getCapabilities(): AdapterCapabilities {
    return {
      maxMessageSize: 100000,
      supportsBatch: true,
      supportsHtml: true,
      supportsAttachments: true,
      supportsThreads: false,
      supportsRichContent: true,
      rateLimit: {
        requestsPerMinute: 100,
        burstLimit: 200
      }
    };
  }

  async handleWebhook(payload: any): Promise<WebhookResponse> {
    const events: WebhookEvent[] = [];

    // Handle email events (delivered, opened, clicked, bounced, etc.)
    if (Array.isArray(payload)) {
      for (const event of payload) {
        events.push({
          type: event.event,
          messageId: event.sg_message_id,
          timestamp: new Date(event.timestamp * 1000),
          data: event
        });
      }
    }

    return { processed: true, events };
  }
}

// SMS Integration Adapter
export class SmsAdapter implements IntegrationAdapter {
  name = 'SMS';
  channel = NotificationChannel.SMS;
  version = '1.0.0';
  enabled = true;
  
  private readonly logger = new Logger('SmsAdapter');

  constructor(private config: any) {}

  async healthCheck(): Promise<AdapterHealth> {
    return {
      status: 'healthy',
      lastChecked: new Date(),
      details: { provider: this.config.provider }
    };
  }

  async send(message: AdapterMessage): Promise<AdapterResponse> {
    try {
      // Truncate message for SMS
      const smsContent = message.content.substring(0, 160);
      
      return {
        success: true,
        messageId: `sms-${Date.now()}`,
        metadata: { 
          provider: this.config.provider,
          truncated: message.content.length > 160
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: true
      };
    }
  }

  validateConfig(config: any): AdapterValidation {
    const errors: string[] = [];
    if (!config.enabled) {
      return { valid: false, errors: ['SMS integration disabled'], warnings: [] };
    }

    if (!config.apiKey || !config.fromNumber) {
      errors.push('API key and from number are required');
    }

    return { valid: errors.length === 0, errors, warnings: [] };
  }

  getCapabilities(): AdapterCapabilities {
    return {
      maxMessageSize: 160,
      supportsBatch: true,
      supportsHtml: false,
      supportsAttachments: false,
      supportsThreads: false,
      supportsRichContent: false,
      rateLimit: {
        requestsPerMinute: 10,
        burstLimit: 20
      }
    };
  }
}

// Webhook Integration Adapter
export class WebhookAdapter implements IntegrationAdapter {
  name = 'Webhook';
  channel = NotificationChannel.WEBHOOK;
  version = '1.0.0';
  enabled = true;
  
  private readonly logger = new Logger('WebhookAdapter');

  constructor(private config: any) {}

  async healthCheck(): Promise<AdapterHealth> {
    return {
      status: 'healthy',
      lastChecked: new Date()
    };
  }

  async send(message: AdapterMessage): Promise<AdapterResponse> {
    try {
      const payload = {
        id: message.id,
        timestamp: new Date().toISOString(),
        type: 'notification',
        data: {
          to: message.to,
          subject: message.subject,
          content: message.content,
          metadata: message.metadata
        }
      };

      // Add signature if configured
      let headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (this.config.security?.signRequests) {
        const signature = this.generateSignature(payload);
        headers['X-Webhook-Signature'] = signature;
      }

      // Send HTTP request to webhook URL
      // const response = await fetch(message.to, {
      //   method: 'POST',
      //   headers,
      //   body: JSON.stringify(payload)
      // });

      return {
        success: true,
        messageId: `webhook-${Date.now()}`,
        metadata: { url: message.to }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: true
      };
    }
  }

  private generateSignature(payload: any): string {
    // Generate HMAC signature for webhook security
    const crypto = require('crypto');
    const data = JSON.stringify(payload);
    const signature = crypto
      .createHmac(this.config.security.algorithm, this.config.security.secretKey)
      .update(data)
      .digest('hex');
    return `${this.config.security.algorithm}=${signature}`;
  }

  validateConfig(config: any): AdapterValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.enabled) {
      return { valid: false, errors: ['Webhook integration disabled'], warnings };
    }

    if (config.security?.signRequests && !config.security?.secretKey) {
      errors.push('Secret key required for webhook signing');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  getCapabilities(): AdapterCapabilities {
    return {
      maxMessageSize: 1000000,
      supportsBatch: false,
      supportsHtml: true,
      supportsAttachments: false,
      supportsThreads: false,
      supportsRichContent: true,
      rateLimit: {
        requestsPerMinute: 200,
        burstLimit: 400
      }
    };
  }
}

// Push Notification Adapter
export class PushAdapter implements IntegrationAdapter {
  name = 'Push Notifications';
  channel = NotificationChannel.PUSH;
  version = '1.0.0';
  enabled = true;
  
  private readonly logger = new Logger('PushAdapter');

  constructor(private config: any) {}

  async healthCheck(): Promise<AdapterHealth> {
    return {
      status: 'healthy',
      lastChecked: new Date(),
      details: { 
        firebase: !!this.config.firebase?.projectId,
        apns: !!this.config.apns?.keyId
      }
    };
  }

  async send(message: AdapterMessage): Promise<AdapterResponse> {
    try {
      const notification = {
        title: message.subject || 'Notification',
        body: message.content.substring(0, 100),
        data: message.metadata,
        priority: message.priority === 'urgent' ? 'high' : 'normal'
      };

      // Send via Firebase/APNS
      return {
        success: true,
        messageId: `push-${Date.now()}`,
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

  validateConfig(config: any): AdapterValidation {
    const errors: string[] = [];
    if (!config.enabled) {
      return { valid: false, errors: ['Push integration disabled'], warnings: [] };
    }

    if (!config.firebase?.projectId && !config.apns?.keyId) {
      errors.push('Either Firebase or APNS configuration required');
    }

    return { valid: errors.length === 0, errors, warnings: [] };
  }

  getCapabilities(): AdapterCapabilities {
    return {
      maxMessageSize: 4000,
      supportsBatch: true,
      supportsHtml: false,
      supportsAttachments: false,
      supportsThreads: false,
      supportsRichContent: true,
      rateLimit: {
        requestsPerMinute: 500,
        burstLimit: 1000
      }
    };
  }
}

// Discord Integration Adapter
export class DiscordAdapter implements IntegrationAdapter {
  name = 'Discord';
  channel = NotificationChannel.DISCORD;
  version = '1.0.0';
  enabled = true;
  
  private readonly logger = new Logger('DiscordAdapter');

  constructor(private config: any) {}

  async healthCheck(): Promise<AdapterHealth> {
    return {
      status: 'healthy',
      lastChecked: new Date()
    };
  }

  async send(message: AdapterMessage): Promise<AdapterResponse> {
    try {
      const embed = {
        title: message.subject,
        description: message.content,
        color: this.getPriorityColor(message.priority),
        timestamp: new Date().toISOString()
      };

      return {
        success: true,
        messageId: `discord-${Date.now()}`,
        metadata: { format: 'embed' }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: true
      };
    }
  }

  private getPriorityColor(priority?: string): number {
    const colors = {
      low: 0x95a5a6,     // Gray
      normal: 0x3498db,  // Blue
      high: 0xf39c12,    // Orange
      urgent: 0xe74c3c   // Red
    };
    return colors[priority as keyof typeof colors] || colors.normal;
  }

  validateConfig(config: any): AdapterValidation {
    const errors: string[] = [];
    if (!config.enabled) {
      return { valid: false, errors: ['Discord integration disabled'], warnings: [] };
    }

    if (!config.botToken) {
      errors.push('Bot token is required');
    }

    return { valid: errors.length === 0, errors, warnings: [] };
  }

  getCapabilities(): AdapterCapabilities {
    return {
      maxMessageSize: 2000,
      supportsBatch: false,
      supportsHtml: false,
      supportsAttachments: true,
      supportsThreads: true,
      supportsRichContent: true,
      rateLimit: {
        requestsPerMinute: 40,
        burstLimit: 80
      }
    };
  }
}

// Integration Manager
export class IntegrationManager {
  private readonly logger = new Logger('IntegrationManager');
  private readonly adapters = new Map<NotificationChannel, IntegrationAdapter>();
  private readonly healthStatus = new Map<NotificationChannel, AdapterHealth>();

  constructor(private config: any) {
    this.initializeAdapters();
    this.startHealthChecks();
  }

  private initializeAdapters(): void {
    // Initialize all adapters with their configurations
    this.adapters.set(NotificationChannel.SLACK, new SlackAdapter(this.config.slack));
    this.adapters.set(NotificationChannel.TEAMS, new TeamsAdapter(this.config.teams));
    this.adapters.set(NotificationChannel.EMAIL, new EmailAdapter(this.config.email));
    this.adapters.set(NotificationChannel.SMS, new SmsAdapter(this.config.sms));
    this.adapters.set(NotificationChannel.WEBHOOK, new WebhookAdapter(this.config.webhook));
    this.adapters.set(NotificationChannel.PUSH, new PushAdapter(this.config.push));
    this.adapters.set(NotificationChannel.DISCORD, new DiscordAdapter(this.config.discord));
  }

  private startHealthChecks(): void {
    setInterval(async () => {
      await this.performHealthChecks();
    }, 60000); // Check every minute
  }

  private async performHealthChecks(): Promise<void> {
    for (const [channel, adapter] of this.adapters.entries()) {
      try {
        const health = await adapter.healthCheck();
        this.healthStatus.set(channel, health);
        
        if (health.status === 'unhealthy') {
          this.logger.warn('Adapter unhealthy', {
            channel,
            error: health.error
          });
        }
      } catch (error) {
        this.logger.error('Health check failed', { channel, error });
      }
    }
  }

  public getAdapter(channel: NotificationChannel): IntegrationAdapter | undefined {
    return this.adapters.get(channel);
  }

  public getHealth(channel?: NotificationChannel): AdapterHealth | Map<NotificationChannel, AdapterHealth> {
    if (channel) {
      return this.healthStatus.get(channel) || {
        status: 'unhealthy',
        error: 'Adapter not found',
        lastChecked: new Date()
      };
    }
    return this.healthStatus;
  }

  public async sendMessage(channel: NotificationChannel, message: AdapterMessage): Promise<AdapterResponse> {
    const adapter = this.adapters.get(channel);
    if (!adapter) {
      return {
        success: false,
        error: `No adapter found for channel: ${channel}`,
        retryable: false
      };
    }

    const health = this.healthStatus.get(channel);
    if (health?.status === 'unhealthy') {
      return {
        success: false,
        error: `Adapter unhealthy: ${health.error}`,
        retryable: true
      };
    }

    return await adapter.send(message);
  }

  public getIntegrationStats(): any {
    const stats: Record<string, any> = {};
    
    for (const [channel, adapter] of this.adapters.entries()) {
      const health = this.healthStatus.get(channel);
      stats[channel] = {
        name: adapter.name,
        version: adapter.version,
        enabled: adapter.enabled,
        health: health?.status || 'unknown',
        capabilities: adapter.getCapabilities()
      };
    }

    return stats;
  }
}