/**
 * Advanced Notification Engine
 * Multi-channel notification system with intelligent routing and delivery
 */

import { EventEmitter } from 'events';
import nodemailer from 'nodemailer';
import { WebClient as SlackClient } from '@slack/web-api';
import { Client as DiscordClient, TextChannel } from 'discord.js';
import axios from 'axios';
import Handlebars from 'handlebars';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import pQueue from 'p-queue';
import crypto from 'crypto';

// Types and Interfaces
export interface NotificationChannel {
  id: string;
  type: 'email' | 'slack' | 'teams' | 'discord' | 'webhook' | 'in-app' | 'sms' | 'push';
  enabled: boolean;
  config: Record<string, any>;
  priority: number;
  filters?: NotificationFilter[];
}

export interface NotificationTemplate {
  id: string;
  name: string;
  channel: NotificationChannel['type'];
  subject?: string;
  body: string;
  variables: string[];
  metadata?: Record<string, any>;
  richMedia?: RichMediaContent[];
}

export interface RichMediaContent {
  type: 'image' | 'chart' | 'code' | 'table' | 'video';
  url?: string;
  data?: any;
  alt?: string;
  language?: string; // For code snippets
}

export interface NotificationRequest {
  id?: string;
  userId: string;
  teamId?: string;
  templateId?: string;
  channel?: NotificationChannel['type'] | 'auto';
  priority: 'low' | 'normal' | 'high' | 'critical';
  subject?: string;
  message: string;
  data?: Record<string, any>;
  richMedia?: RichMediaContent[];
  scheduledAt?: Date;
  expiresAt?: Date;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface NotificationPreferences {
  userId: string;
  channels: {
    [key in NotificationChannel['type']]?: {
      enabled: boolean;
      quietHours?: { start: string; end: string };
      doNotDisturb?: boolean;
      categories?: string[];
      priorities?: NotificationRequest['priority'][];
    };
  };
  batching?: {
    enabled: boolean;
    interval: number; // minutes
    maxBatch: number;
  };
  subscriptions?: NotificationSubscription[];
}

export interface NotificationSubscription {
  id: string;
  type: 'entity' | 'team' | 'service' | 'deployment' | 'incident' | 'cost';
  entityId: string;
  channels: NotificationChannel['type'][];
  filters?: NotificationFilter[];
}

export interface NotificationFilter {
  field: string;
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'in' | 'regex';
  value: any;
}

export interface DeliveryStatus {
  notificationId: string;
  channel: NotificationChannel['type'];
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
  attempts: number;
  lastAttempt?: Date;
  error?: string;
  deliveredAt?: Date;
  readAt?: Date;
  clickedLinks?: { url: string; clickedAt: Date }[];
}

export interface NotificationDigest {
  userId: string;
  period: 'daily' | 'weekly' | 'monthly';
  notifications: NotificationRequest[];
  generatedAt: Date;
}

// Main Notification Engine Class
export class NotificationEngine extends EventEmitter {
  private channels: Map<string, NotificationChannel> = new Map();
  private templates: Map<string, NotificationTemplate> = new Map();
  private preferences: Map<string, NotificationPreferences> = new Map();
  private deliveryStatus: Map<string, DeliveryStatus> = new Map();
  private rateLimiters: Map<string, RateLimiterMemory> = new Map();
  private queue: pQueue;
  private batchQueue: Map<string, NotificationRequest[]> = new Map();
  private retryQueue: pQueue;
  
  // Channel clients
  private emailTransporter?: nodemailer.Transporter;
  private slackClient?: SlackClient;
  private discordClient?: DiscordClient;
  private teamsWebhooks: Map<string, string> = new Map();

  constructor() {
    super();
    
    // Initialize queues
    this.queue = new pQueue({ 
      concurrency: 10,
      interval: 1000,
      intervalCap: 50 
    });
    
    this.retryQueue = new pQueue({ 
      concurrency: 5,
      interval: 5000,
      intervalCap: 10 
    });
    
    this.initializeChannels();
    this.initializeTemplates();
    this.startBatchProcessor();
  }

  // Initialization Methods
  private async initializeChannels() {
    // Email channel
    if (process.env.SMTP_HOST) {
      this.emailTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      
      this.channels.set('email', {
        id: 'email',
        type: 'email',
        enabled: true,
        config: { from: process.env.SMTP_FROM },
        priority: 1,
      });
    }

    // Slack channel
    if (process.env.SLACK_TOKEN) {
      this.slackClient = new SlackClient(process.env.SLACK_TOKEN);
      this.channels.set('slack', {
        id: 'slack',
        type: 'slack',
        enabled: true,
        config: { defaultChannel: process.env.SLACK_DEFAULT_CHANNEL },
        priority: 2,
      });
    }

    // Discord channel
    if (process.env.DISCORD_TOKEN) {
      this.discordClient = new DiscordClient({ intents: ['Guilds', 'GuildMessages'] });
      await this.discordClient.login(process.env.DISCORD_TOKEN);
      this.channels.set('discord', {
        id: 'discord',
        type: 'discord',
        enabled: true,
        config: { defaultChannel: process.env.DISCORD_DEFAULT_CHANNEL },
        priority: 3,
      });
    }

    // Teams channel
    if (process.env.TEAMS_WEBHOOK) {
      this.teamsWebhooks.set('default', process.env.TEAMS_WEBHOOK);
      this.channels.set('teams', {
        id: 'teams',
        type: 'teams',
        enabled: true,
        config: {},
        priority: 4,
      });
    }

    // In-app channel (always available)
    this.channels.set('in-app', {
      id: 'in-app',
      type: 'in-app',
      enabled: true,
      config: {},
      priority: 5,
    });

    // Initialize rate limiters for each channel
    this.channels.forEach((channel) => {
      this.rateLimiters.set(channel.id, new RateLimiterMemory({
        points: this.getRateLimitForChannel(channel.type),
        duration: 60, // Per minute
      }));
    });
  }

  private getRateLimitForChannel(type: NotificationChannel['type']): number {
    const limits: Record<NotificationChannel['type'], number> = {
      email: 100,
      slack: 200,
      teams: 200,
      discord: 200,
      webhook: 500,
      'in-app': 1000,
      sms: 50,
      push: 500,
    };
    return limits[type] || 100;
  }

  private initializeTemplates() {
    // Register default templates
    this.registerTemplate({
      id: 'entity-update',
      name: 'Entity Update',
      channel: 'email',
      subject: '{{entityType}} {{entityName}} Updated',
      body: `
        <h2>{{entityType}} Update</h2>
        <p>The {{entityType}} <strong>{{entityName}}</strong> has been updated.</p>
        {{#if changes}}
        <h3>Changes:</h3>
        <ul>
          {{#each changes}}
          <li>{{field}}: {{oldValue}} → {{newValue}}</li>
          {{/each}}
        </ul>
        {{/if}}
        <p><a href="{{link}}">View Details</a></p>
      `,
      variables: ['entityType', 'entityName', 'changes', 'link'],
    });

    this.registerTemplate({
      id: 'deployment-status',
      name: 'Deployment Status',
      channel: 'slack',
      body: `
:rocket: *Deployment Update*
Service: \`{{serviceName}}\`
Environment: \`{{environment}}\`
Status: {{#if success}}:white_check_mark: Success{{else}}:x: Failed{{/if}}
Version: \`{{version}}\`
{{#if error}}
Error: \`\`\`{{error}}\`\`\`
{{/if}}
<{{link}}|View Deployment>
      `,
      variables: ['serviceName', 'environment', 'success', 'version', 'error', 'link'],
    });

    this.registerTemplate({
      id: 'incident-alert',
      name: 'Incident Alert',
      channel: 'teams',
      body: JSON.stringify({
        '@type': 'MessageCard',
        '@context': 'http://schema.org/extensions',
        'themeColor': '{{#if critical}}FF0000{{else}}FFA500{{/if}}',
        'summary': 'Incident Alert: {{title}}',
        'sections': [{
          'activityTitle': '{{title}}',
          'activitySubtitle': 'Severity: {{severity}}',
          'facts': [
            { 'name': 'Service', 'value': '{{service}}' },
            { 'name': 'Time', 'value': '{{time}}' },
            { 'name': 'Impact', 'value': '{{impact}}' }
          ],
          'text': '{{description}}'
        }],
        'potentialAction': [{
          '@type': 'OpenUri',
          'name': 'View Incident',
          'targets': [{ 'os': 'default', 'uri': '{{link}}' }]
        }]
      }),
      variables: ['title', 'severity', 'service', 'time', 'impact', 'description', 'link', 'critical'],
    });
  }

  // Core Notification Methods
  async send(request: NotificationRequest): Promise<string> {
    const notificationId = request.id || this.generateNotificationId();
    request.id = notificationId;

    // Check user preferences
    const preferences = await this.getUserPreferences(request.userId);
    
    // Apply quiet hours and DND
    if (this.shouldDelay(request, preferences)) {
      await this.scheduleNotification(request);
      return notificationId;
    }

    // Check if should batch
    if (this.shouldBatch(request, preferences)) {
      this.addToBatch(request, preferences);
      return notificationId;
    }

    // Determine channel
    const channel = await this.selectChannel(request, preferences);
    if (!channel) {
      throw new Error('No available channel for notification');
    }

    // Apply rate limiting
    await this.applyRateLimit(request.userId, channel);

    // Queue for delivery
    await this.queue.add(async () => {
      await this.deliverNotification(request, channel);
    });

    return notificationId;
  }

  private async deliverNotification(
    request: NotificationRequest,
    channel: NotificationChannel
  ): Promise<void> {
    const deliveryStatus: DeliveryStatus = {
      notificationId: request.id!,
      channel: channel.type,
      status: 'pending',
      attempts: 0,
    };

    this.deliveryStatus.set(request.id!, deliveryStatus);

    try {
      deliveryStatus.attempts++;
      deliveryStatus.lastAttempt = new Date();

      // Render template if provided
      let content = request.message;
      let subject = request.subject;
      
      if (request.templateId) {
        const template = this.templates.get(request.templateId);
        if (template) {
          const compiled = Handlebars.compile(template.body);
          content = compiled(request.data || {});
          
          if (template.subject) {
            const subjectCompiled = Handlebars.compile(template.subject);
            subject = subjectCompiled(request.data || {});
          }
        }
      }

      // Deliver based on channel type
      switch (channel.type) {
        case 'email':
          await this.sendEmail(request.userId, subject || 'Notification', content, request.richMedia);
          break;
        case 'slack':
          await this.sendSlack(request.userId, content, request.richMedia);
          break;
        case 'teams':
          await this.sendTeams(request.userId, content, request.richMedia);
          break;
        case 'discord':
          await this.sendDiscord(request.userId, content, request.richMedia);
          break;
        case 'webhook':
          await this.sendWebhook(request.userId, request);
          break;
        case 'in-app':
          await this.sendInApp(request);
          break;
        case 'sms':
          await this.sendSMS(request.userId, content);
          break;
        case 'push':
          await this.sendPush(request.userId, subject || 'Notification', content);
          break;
      }

      deliveryStatus.status = 'sent';
      deliveryStatus.deliveredAt = new Date();
      
      this.emit('notification:sent', {
        notificationId: request.id,
        channel: channel.type,
        userId: request.userId,
      });

    } catch (error) {
      deliveryStatus.status = 'failed';
      deliveryStatus.error = error instanceof Error ? error.message : 'Unknown error';
      
      // Retry with exponential backoff
      if (deliveryStatus.attempts < 3) {
        const delay = Math.pow(2, deliveryStatus.attempts) * 1000;
        setTimeout(() => {
          this.retryQueue.add(async () => {
            await this.deliverNotification(request, channel);
          });
        }, delay);
      } else {
        this.emit('notification:failed', {
          notificationId: request.id,
          channel: channel.type,
          userId: request.userId,
          error: deliveryStatus.error,
        });
      }
    }
  }

  // Channel-specific delivery methods
  private async sendEmail(
    userId: string,
    subject: string,
    body: string,
    richMedia?: RichMediaContent[]
  ): Promise<void> {
    if (!this.emailTransporter) {
      throw new Error('Email channel not configured');
    }

    const userEmail = await this.getUserEmail(userId);
    
    // Process rich media for email
    const attachments = richMedia?.filter(m => m.type === 'image').map(m => ({
      filename: `image-${Date.now()}.png`,
      path: m.url,
      cid: `image-${crypto.randomBytes(8).toString('hex')}`,
    }));

    await this.emailTransporter.sendMail({
      from: this.channels.get('email')?.config.from,
      to: userEmail,
      subject,
      html: body,
      attachments,
    });
  }

  private async sendSlack(
    userId: string,
    message: string,
    richMedia?: RichMediaContent[]
  ): Promise<void> {
    if (!this.slackClient) {
      throw new Error('Slack channel not configured');
    }

    const slackUserId = await this.getUserSlackId(userId);
    
    // Build Slack blocks for rich media
    const blocks: any[] = [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: message },
      },
    ];

    // Add code snippets
    richMedia?.filter(m => m.type === 'code').forEach(m => {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `\`\`\`${m.language || ''}\n${m.data}\n\`\`\``,
        },
      });
    });

    // Add images
    richMedia?.filter(m => m.type === 'image').forEach(m => {
      blocks.push({
        type: 'image',
        image_url: m.url,
        alt_text: m.alt || 'Image',
      });
    });

    await this.slackClient.chat.postMessage({
      channel: slackUserId,
      blocks,
    });
  }

  private async sendTeams(
    userId: string,
    message: string,
    richMedia?: RichMediaContent[]
  ): Promise<void> {
    const webhook = this.teamsWebhooks.get('default');
    if (!webhook) {
      throw new Error('Teams channel not configured');
    }

    // Parse message if it's JSON (for MessageCard format)
    let payload: any;
    try {
      payload = JSON.parse(message);
    } catch {
      // Create simple adaptive card
      payload = {
        type: 'message',
        attachments: [{
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: {
            type: 'AdaptiveCard',
            version: '1.2',
            body: [
              {
                type: 'TextBlock',
                text: message,
                wrap: true,
              },
            ],
          },
        }],
      };

      // Add rich media
      if (richMedia) {
        richMedia.forEach(m => {
          if (m.type === 'image' && m.url) {
            payload.attachments[0].content.body.push({
              type: 'Image',
              url: m.url,
              altText: m.alt || 'Image',
            });
          }
        });
      }
    }

    await axios.post(webhook, payload);
  }

  private async sendDiscord(
    userId: string,
    message: string,
    richMedia?: RichMediaContent[]
  ): Promise<void> {
    if (!this.discordClient || !this.discordClient.isReady()) {
      throw new Error('Discord channel not configured');
    }

    const channelId = this.channels.get('discord')?.config.defaultChannel;
    if (!channelId) {
      throw new Error('Discord channel ID not configured');
    }

    const channel = await this.discordClient.channels.fetch(channelId) as TextChannel;
    
    // Create embed for rich formatting
    const embed: any = {
      description: message,
      color: 0x0099ff,
      timestamp: new Date(),
    };

    // Add rich media
    if (richMedia) {
      const image = richMedia.find(m => m.type === 'image');
      if (image?.url) {
        embed.image = { url: image.url };
      }

      const codeSnippets = richMedia.filter(m => m.type === 'code');
      if (codeSnippets.length > 0) {
        embed.fields = codeSnippets.map(snippet => ({
          name: `Code (${snippet.language || 'plain'})`,
          value: `\`\`\`${snippet.language || ''}\n${snippet.data}\n\`\`\``,
          inline: false,
        }));
      }
    }

    await channel.send({ embeds: [embed] });
  }

  private async sendWebhook(userId: string, request: NotificationRequest): Promise<void> {
    const webhookUrl = await this.getUserWebhook(userId);
    
    await axios.post(webhookUrl, {
      id: request.id,
      userId: request.userId,
      priority: request.priority,
      subject: request.subject,
      message: request.message,
      data: request.data,
      richMedia: request.richMedia,
      timestamp: new Date().toISOString(),
    });
  }

  private async sendInApp(request: NotificationRequest): Promise<void> {
    // Emit event for in-app notification system
    this.emit('notification:in-app', {
      userId: request.userId,
      notification: {
        id: request.id,
        title: request.subject || 'Notification',
        message: request.message,
        priority: request.priority,
        data: request.data,
        richMedia: request.richMedia,
        timestamp: new Date(),
      },
    });
  }

  private async sendSMS(userId: string, message: string): Promise<void> {
    // Integrate with SMS provider (Twilio, etc.)
    // Placeholder implementation
    throw new Error('SMS channel not implemented');
  }

  private async sendPush(userId: string, title: string, body: string): Promise<void> {
    // Integrate with push notification service (Firebase, OneSignal, etc.)
    // Placeholder implementation
    throw new Error('Push notification channel not implemented');
  }

  // Preference and Subscription Management
  async setUserPreferences(preferences: NotificationPreferences): Promise<void> {
    this.preferences.set(preferences.userId, preferences);
    this.emit('preferences:updated', preferences);
  }

  async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    return this.preferences.get(userId) || {
      userId,
      channels: {
        'in-app': { enabled: true },
      },
    };
  }

  async subscribe(subscription: NotificationSubscription): Promise<void> {
    const preferences = await this.getUserPreferences(subscription.id);
    if (!preferences.subscriptions) {
      preferences.subscriptions = [];
    }
    preferences.subscriptions.push(subscription);
    await this.setUserPreferences(preferences);
  }

  async unsubscribe(userId: string, subscriptionId: string): Promise<void> {
    const preferences = await this.getUserPreferences(userId);
    if (preferences.subscriptions) {
      preferences.subscriptions = preferences.subscriptions.filter(
        s => s.id !== subscriptionId
      );
      await this.setUserPreferences(preferences);
    }
  }

  // Batching and Digest
  private shouldBatch(
    request: NotificationRequest,
    preferences: NotificationPreferences
  ): boolean {
    return !!(
      preferences.batching?.enabled &&
      request.priority !== 'critical' &&
      request.priority !== 'high'
    );
  }

  private addToBatch(request: NotificationRequest, preferences: NotificationPreferences): void {
    const batchKey = `${request.userId}-${preferences.batching?.interval || 60}`;
    
    if (!this.batchQueue.has(batchKey)) {
      this.batchQueue.set(batchKey, []);
      
      // Schedule batch processing
      setTimeout(() => {
        this.processBatch(batchKey);
      }, (preferences.batching?.interval || 60) * 60 * 1000);
    }
    
    const batch = this.batchQueue.get(batchKey)!;
    batch.push(request);
    
    // Process immediately if batch is full
    if (batch.length >= (preferences.batching?.maxBatch || 10)) {
      this.processBatch(batchKey);
    }
  }

  private async processBatch(batchKey: string): Promise<void> {
    const batch = this.batchQueue.get(batchKey);
    if (!batch || batch.length === 0) return;
    
    this.batchQueue.delete(batchKey);
    
    const [userId] = batchKey.split('-');
    const digest = await this.generateDigest(userId, batch);
    
    // Send digest as a single notification
    await this.send({
      userId,
      priority: 'normal',
      subject: `Your notification digest (${batch.length} notifications)`,
      message: digest,
      metadata: { type: 'digest', count: batch.length },
    });
  }

  private async generateDigest(
    userId: string,
    notifications: NotificationRequest[]
  ): Promise<string> {
    const grouped = this.groupNotificationsByCategory(notifications);
    
    let digest = '<h2>Notification Digest</h2>';
    
    for (const [category, items] of Object.entries(grouped)) {
      digest += `<h3>${category} (${items.length})</h3><ul>`;
      items.forEach(item => {
        digest += `<li>${item.subject || item.message}</li>`;
      });
      digest += '</ul>';
    }
    
    return digest;
  }

  private groupNotificationsByCategory(
    notifications: NotificationRequest[]
  ): Record<string, NotificationRequest[]> {
    const grouped: Record<string, NotificationRequest[]> = {};
    
    notifications.forEach(notif => {
      const category = notif.metadata?.category || 'Other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(notif);
    });
    
    return grouped;
  }

  // Quiet Hours and DND
  private shouldDelay(
    request: NotificationRequest,
    preferences: NotificationPreferences
  ): boolean {
    if (request.priority === 'critical') return false;
    
    const now = new Date();
    const currentTime = `${now.getHours()}:${now.getMinutes()}`;
    
    for (const channel of Object.values(preferences.channels)) {
      if (channel?.doNotDisturb) return true;
      
      if (channel?.quietHours) {
        const { start, end } = channel.quietHours;
        if (this.isTimeInRange(currentTime, start, end)) {
          return true;
        }
      }
    }
    
    return false;
  }

  private isTimeInRange(current: string, start: string, end: string): boolean {
    const [currentHour, currentMin] = current.split(':').map(Number);
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);
    
    const currentMinutes = currentHour * 60 + currentMin;
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } else {
      // Handles ranges that cross midnight
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
  }

  private async scheduleNotification(request: NotificationRequest): Promise<void> {
    const preferences = await this.getUserPreferences(request.userId);
    const delayUntil = this.calculateDelayUntil(preferences);
    
    request.scheduledAt = delayUntil;
    
    setTimeout(() => {
      this.send(request);
    }, delayUntil.getTime() - Date.now());
    
    this.emit('notification:scheduled', {
      notificationId: request.id,
      userId: request.userId,
      scheduledAt: delayUntil,
    });
  }

  private calculateDelayUntil(preferences: NotificationPreferences): Date {
    const now = new Date();
    
    for (const channel of Object.values(preferences.channels)) {
      if (channel?.quietHours) {
        const { end } = channel.quietHours;
        const [endHour, endMin] = end.split(':').map(Number);
        
        const delayUntil = new Date(now);
        delayUntil.setHours(endHour, endMin, 0, 0);
        
        if (delayUntil <= now) {
          delayUntil.setDate(delayUntil.getDate() + 1);
        }
        
        return delayUntil;
      }
    }
    
    // Default to 1 hour from now
    return new Date(now.getTime() + 60 * 60 * 1000);
  }

  // Channel Selection
  private async selectChannel(
    request: NotificationRequest,
    preferences: NotificationPreferences
  ): Promise<NotificationChannel | null> {
    if (request.channel && request.channel !== 'auto') {
      const channel = Array.from(this.channels.values()).find(
        c => c.type === request.channel
      );
      
      if (channel && this.isChannelEnabled(channel, preferences)) {
        return channel;
      }
    }
    
    // Auto-select based on priority and preferences
    const availableChannels = Array.from(this.channels.values())
      .filter(c => this.isChannelEnabled(c, preferences))
      .sort((a, b) => a.priority - b.priority);
    
    // For critical notifications, use multiple channels
    if (request.priority === 'critical' && availableChannels.length > 1) {
      // Send to all high-priority channels
      const highPriorityChannels = availableChannels.slice(0, 3);
      for (const channel of highPriorityChannels.slice(1)) {
        this.queue.add(async () => {
          await this.deliverNotification(request, channel);
        });
      }
      return highPriorityChannels[0];
    }
    
    return availableChannels[0] || null;
  }

  private isChannelEnabled(
    channel: NotificationChannel,
    preferences: NotificationPreferences
  ): boolean {
    const channelPrefs = preferences.channels[channel.type];
    return channel.enabled && (!channelPrefs || channelPrefs.enabled !== false);
  }

  // Rate Limiting
  private async applyRateLimit(userId: string, channel: NotificationChannel): Promise<void> {
    const limiter = this.rateLimiters.get(channel.id);
    if (!limiter) return;
    
    const key = `${userId}-${channel.id}`;
    await limiter.consume(key, 1);
  }

  // Template Management
  registerTemplate(template: NotificationTemplate): void {
    // Compile template to check for errors
    Handlebars.compile(template.body);
    if (template.subject) {
      Handlebars.compile(template.subject);
    }
    
    this.templates.set(template.id, template);
    this.emit('template:registered', template);
  }

  unregisterTemplate(templateId: string): void {
    this.templates.delete(templateId);
    this.emit('template:unregistered', templateId);
  }

  getTemplate(templateId: string): NotificationTemplate | undefined {
    return this.templates.get(templateId);
  }

  listTemplates(): NotificationTemplate[] {
    return Array.from(this.templates.values());
  }

  // Delivery Tracking
  getDeliveryStatus(notificationId: string): DeliveryStatus | undefined {
    return this.deliveryStatus.get(notificationId);
  }

  async markAsRead(notificationId: string): Promise<void> {
    const status = this.deliveryStatus.get(notificationId);
    if (status) {
      status.readAt = new Date();
      this.emit('notification:read', { notificationId });
    }
  }

  async trackLinkClick(notificationId: string, url: string): Promise<void> {
    const status = this.deliveryStatus.get(notificationId);
    if (status) {
      if (!status.clickedLinks) {
        status.clickedLinks = [];
      }
      status.clickedLinks.push({ url, clickedAt: new Date() });
      this.emit('notification:link-clicked', { notificationId, url });
    }
  }

  // Batch Processing
  private startBatchProcessor(): void {
    // Process batches every minute
    setInterval(() => {
      const now = Date.now();
      
      this.batchQueue.forEach((batch, key) => {
        const [userId, interval] = key.split('-');
        const intervalMs = parseInt(interval) * 60 * 1000;
        
        // Check if any notification in batch is old enough
        const oldestNotification = batch.find(n => 
          n.metadata?.batchStartTime && 
          (now - n.metadata.batchStartTime) >= intervalMs
        );
        
        if (oldestNotification) {
          this.processBatch(key);
        }
      });
    }, 60 * 1000);
  }

  // Helper Methods
  private generateNotificationId(): string {
    return `notif-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  }

  private async getUserEmail(userId: string): Promise<string> {
    // Fetch from user service/database
    // Placeholder implementation
    return `user-${userId}@example.com`;
  }

  private async getUserSlackId(userId: string): Promise<string> {
    // Fetch from user service/database
    // Placeholder implementation
    return `U${userId}`;
  }

  private async getUserWebhook(userId: string): Promise<string> {
    // Fetch from user service/database
    // Placeholder implementation
    return `https://example.com/webhook/${userId}`;
  }

  // Cleanup
  async shutdown(): Promise<void> {
    await this.queue.onIdle();
    await this.retryQueue.onIdle();
    
    if (this.discordClient) {
      this.discordClient.destroy();
    }
    
    this.removeAllListeners();
  }
}

// Export singleton instance
export const notificationEngine = new NotificationEngine();