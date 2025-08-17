import Redis from 'ioredis';
import { RealtimeEventService } from '@/lib/events/realtime-event-service';

export interface RealTimeNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: any;
  channels: NotificationChannel[];
  targetUsers: string | string[];
  priority?: 'low' | 'normal' | 'high' | 'critical';
  metadata?: Record<string, any>;
  createdAt: string;
  expiresAt?: string;
  read: boolean;
  acknowledged: boolean;
}

export type NotificationChannel = 'websocket' | 'database' | 'email' | 'sms' | 'alert' | 'push';

export interface NotificationTemplate {
  id: string;
  name: string;
  type: string;
  title: string;
  message: string;
  channels: NotificationChannel[];
  priority: 'low' | 'normal' | 'high' | 'critical';
  variables: string[];
  enabled: boolean;
}

export interface NotificationPreference {
  userId: string;
  type: string;
  channels: NotificationChannel[];
  enabled: boolean;
  frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
  quietHours?: {
    start: string; // HH:mm
    end: string;   // HH:mm
    timezone: string;
  };
}

export interface NotificationStats {
  totalSent: number;
  sentByChannel: Record<NotificationChannel, number>;
  sentByPriority: Record<string, number>;
  sentByType: Record<string, number>;
  deliveryRate: number;
  averageDeliveryTime: number;
}

export class NotificationService {
  private redis: Redis;
  private realtimeEvents: RealtimeEventService;
  private templates: Map<string, NotificationTemplate> = new Map();

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableAutoPipelining: true,
      db: 3 // Use different DB for notifications
    });
    
    this.realtimeEvents = RealtimeEventService.getInstance();
    this.initializeTemplates();
    this.initializeWorker();
  }

  private initializeTemplates() {
    // Define default notification templates
    const defaultTemplates: NotificationTemplate[] = [
      {
        id: 'plugin_update',
        name: 'Plugin Update',
        type: 'plugin_update',
        title: 'Plugin Updated: {{plugin_name}}',
        message: '{{repository}} has been updated with {{commits}} new commit(s)',
        channels: ['websocket', 'database'],
        priority: 'normal',
        variables: ['plugin_name', 'repository', 'commits'],
        enabled: true
      },
      {
        id: 'plugin_release',
        name: 'Plugin Release',
        type: 'plugin_release',
        title: 'New Plugin Release: {{plugin_name}} {{version}}',
        message: '{{repository}} has published a new release',
        channels: ['websocket', 'database', 'email'],
        priority: 'high',
        variables: ['plugin_name', 'version', 'repository'],
        enabled: true
      },
      {
        id: 'security_issue',
        name: 'Security Issue',
        type: 'security_issue',
        title: 'Security Issue: {{repository}}',
        message: 'Security issue opened in {{repository}}: {{issue_title}}',
        channels: ['websocket', 'database', 'alert', 'email'],
        priority: 'critical',
        variables: ['repository', 'issue_title'],
        enabled: true
      },
      {
        id: 'quality_degradation',
        name: 'Quality Degradation',
        type: 'quality_degradation',
        title: 'Quality Alert: {{plugin_name}}',
        message: 'Quality score for {{plugin_name}} has decreased to {{score}}',
        channels: ['websocket', 'database'],
        priority: 'high',
        variables: ['plugin_name', 'score'],
        enabled: true
      },
      {
        id: 'build_failure',
        name: 'Build Failure',
        type: 'build_failure',
        title: 'Build Failed: {{repository}}',
        message: 'Build {{build_number}} failed in {{repository}}',
        channels: ['websocket', 'database', 'email'],
        priority: 'high',
        variables: ['repository', 'build_number'],
        enabled: true
      },
      {
        id: 'pipeline_failure',
        name: 'Pipeline Failure',
        type: 'pipeline_failure',
        title: 'Pipeline Failed: {{repository}}',
        message: 'Pipeline "{{pipeline_name}}" failed in {{repository}}',
        channels: ['websocket', 'database'],
        priority: 'high',
        variables: ['repository', 'pipeline_name'],
        enabled: true
      },
      {
        id: 'workflow_failure',
        name: 'Workflow Failure',
        type: 'workflow_failure',
        title: 'Workflow Failed: {{repository}}',
        message: 'Workflow "{{workflow_name}}" failed in {{repository}}',
        channels: ['websocket', 'database'],
        priority: 'high',
        variables: ['repository', 'workflow_name'],
        enabled: true
      }
    ];

    defaultTemplates.forEach(template => {
      this.templates.set(template.type, template);
    });
  }

  private initializeWorker() {
    // Process notification queue
    setInterval(async () => {
      try {
        const notificationData = await this.redis.brpop('notification_queue', 1);
        if (notificationData) {
          const [, notificationJson] = notificationData;
          const notification: RealTimeNotification = JSON.parse(notificationJson);
          await this.processNotification(notification);
        }
      } catch (error) {
        console.error('Error processing notification queue:', error);
      }
    }, 100); // Check every 100ms for real-time processing
  }

  public async sendRealTimeNotification(options: {
    type: string;
    title: string;
    message: string;
    data: any;
    channels: NotificationChannel[];
    targetUsers: string | string[];
    priority?: 'low' | 'normal' | 'high' | 'critical';
    metadata?: Record<string, any>;
    expiresIn?: number; // seconds
  }): Promise<string> {
    const notificationId = this.generateNotificationId();
    
    const notification: RealTimeNotification = {
      id: notificationId,
      type: options.type,
      title: options.title,
      message: options.message,
      data: options.data,
      channels: options.channels,
      targetUsers: options.targetUsers,
      priority: options.priority || 'normal',
      metadata: options.metadata,
      createdAt: new Date().toISOString(),
      expiresAt: options.expiresIn ? 
        new Date(Date.now() + options.expiresIn * 1000).toISOString() : 
        undefined,
      read: false,
      acknowledged: false
    };

    // Queue notification for processing
    await this.redis.lpush('notification_queue', JSON.stringify(notification));

    return notificationId;
  }

  private async processNotification(notification: RealTimeNotification): Promise<void> {
    try {
      console.log(`Processing notification ${notification.id} of type ${notification.type}`);

      // Store notification in database
      if (notification.channels.includes('database')) {
        await this.storeNotification(notification);
      }

      // Send via WebSocket
      if (notification.channels.includes('websocket')) {
        await this.sendWebSocketNotification(notification);
      }

      // Send email notification
      if (notification.channels.includes('email')) {
        await this.sendEmailNotification(notification);
      }

      // Send SMS notification
      if (notification.channels.includes('sms')) {
        await this.sendSMSNotification(notification);
      }

      // Send push notification
      if (notification.channels.includes('push')) {
        await this.sendPushNotification(notification);
      }

      // Send alert notification
      if (notification.channels.includes('alert')) {
        await this.sendAlertNotification(notification);
      }

      // Update metrics
      await this.updateNotificationMetrics(notification);

      console.log(`Notification ${notification.id} processed successfully`);

    } catch (error) {
      console.error(`Error processing notification ${notification.id}:`, error);
      
      // Store failed notification for retry
      await this.redis.lpush('failed_notifications', JSON.stringify({
        notification,
        error: error instanceof Error ? error.message : 'Unknown error',
        failedAt: new Date().toISOString()
      }));
    }
  }

  private async storeNotification(notification: RealTimeNotification): Promise<void> {
    try {
      // Store individual notification
      const key = `notification:${notification.id}`;
      await this.redis.setex(
        key, 
        86400 * 30, // 30 days TTL
        JSON.stringify(notification)
      );

      // Add to user notification lists
      const userIds = Array.isArray(notification.targetUsers) 
        ? notification.targetUsers 
        : [notification.targetUsers];

      for (const userId of userIds) {
        if (userId !== 'plugin_subscribers' && userId !== 'all_users' && userId !== 'security_team' && userId !== 'plugin_maintainers') {
          await this.redis.zadd(
            `user_notifications:${userId}`,
            Date.now(),
            notification.id
          );
          
          // Limit to 1000 notifications per user
          await this.redis.zremrangebyrank(`user_notifications:${userId}`, 0, -1001);
        }
      }

      // Add to global notification list
      await this.redis.zadd(
        'all_notifications',
        Date.now(),
        notification.id
      );

      // Add to type-specific lists
      await this.redis.zadd(
        `notifications_by_type:${notification.type}`,
        Date.now(),
        notification.id
      );

      // Add to priority-specific lists
      await this.redis.zadd(
        `notifications_by_priority:${notification.priority}`,
        Date.now(),
        notification.id
      );

    } catch (error) {
      console.error('Error storing notification:', error);
    }
  }

  private async sendWebSocketNotification(notification: RealTimeNotification): Promise<void> {
    try {
      // Broadcast via WebSocket to all connected clients
      await this.realtimeEvents.broadcast('notification', {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        priority: notification.priority,
        createdAt: notification.createdAt,
        metadata: notification.metadata
      }, {
        source: 'notification-service',
        metadata: {
          targetUsers: notification.targetUsers,
          channels: notification.channels
        }
      });

      // Send to specific users if targetUsers is an array of user IDs
      const userIds = Array.isArray(notification.targetUsers) 
        ? notification.targetUsers 
        : [notification.targetUsers];

      for (const userId of userIds) {
        if (userId !== 'plugin_subscribers' && userId !== 'all_users' && userId !== 'security_team' && userId !== 'plugin_maintainers') {
          await this.realtimeEvents.broadcast('user_notification', {
            id: notification.id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            data: notification.data,
            priority: notification.priority,
            createdAt: notification.createdAt
          }, {
            userId,
            source: 'notification-service'
          });
        }
      }

    } catch (error) {
      console.error('Error sending WebSocket notification:', error);
    }
  }

  private async sendEmailNotification(notification: RealTimeNotification): Promise<void> {
    try {
      // Email sending logic would go here
      // This could integrate with services like:
      // - SendGrid
      // - AWS SES
      // - Mailgun
      // - Nodemailer with SMTP

      console.log(`Email notification would be sent: ${notification.title}`);
      
      // Simulate email sending delay
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error('Error sending email notification:', error);
    }
  }

  private async sendSMSNotification(notification: RealTimeNotification): Promise<void> {
    try {
      // SMS sending logic would go here
      // This could integrate with services like:
      // - Twilio
      // - AWS SNS
      // - Vonage (Nexmo)

      console.log(`SMS notification would be sent: ${notification.title}`);

    } catch (error) {
      console.error('Error sending SMS notification:', error);
    }
  }

  private async sendPushNotification(notification: RealTimeNotification): Promise<void> {
    try {
      // Push notification logic would go here
      // This could integrate with services like:
      // - Firebase Cloud Messaging
      // - Apple Push Notification Service
      // - OneSignal

      console.log(`Push notification would be sent: ${notification.title}`);

    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  }

  private async sendAlertNotification(notification: RealTimeNotification): Promise<void> {
    try {
      // Alert notification logic would go here
      // This could integrate with services like:
      // - PagerDuty
      // - Opsgenie
      // - VictorOps
      // - Custom alerting systems

      console.log(`Alert notification would be sent: ${notification.title}`);

      // Broadcast high-priority alert via WebSocket
      await this.realtimeEvents.broadcast('system_alert', {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        priority: notification.priority,
        data: notification.data,
        createdAt: notification.createdAt
      }, {
        source: 'notification-service',
        metadata: {
          alertLevel: notification.priority,
          requiresAcknowledgment: true
        }
      });

    } catch (error) {
      console.error('Error sending alert notification:', error);
    }
  }

  private async updateNotificationMetrics(notification: RealTimeNotification): Promise<void> {
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const hour = now.getHours();

      // Update counters
      await Promise.all([
        this.redis.incr('notification_metrics:total'),
        this.redis.incr(`notification_metrics:daily:${today}`),
        this.redis.incr(`notification_metrics:hourly:${today}:${hour}`),
        this.redis.incr(`notification_metrics:type:${notification.type}`),
        this.redis.incr(`notification_metrics:priority:${notification.priority}`)
      ]);

      // Update channel metrics
      for (const channel of notification.channels) {
        await this.redis.incr(`notification_metrics:channel:${channel}`);
      }

      // Set TTL for time-based metrics
      await Promise.all([
        this.redis.expire(`notification_metrics:daily:${today}`, 86400 * 30), // 30 days
        this.redis.expire(`notification_metrics:hourly:${today}:${hour}`, 86400 * 7) // 7 days
      ]);

    } catch (error) {
      console.error('Error updating notification metrics:', error);
    }
  }

  // Public API methods
  public async getNotification(notificationId: string): Promise<RealTimeNotification | null> {
    try {
      const result = await this.redis.get(`notification:${notificationId}`);
      return result ? JSON.parse(result) : null;
    } catch (error) {
      console.error('Error getting notification:', error);
      return null;
    }
  }

  public async getUserNotifications(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<RealTimeNotification[]> {
    try {
      const notificationIds = await this.redis.zrevrange(
        `user_notifications:${userId}`,
        offset,
        offset + limit - 1
      );

      const notifications = await Promise.all(
        notificationIds.map(async (id) => {
          const result = await this.redis.get(`notification:${id}`);
          return result ? JSON.parse(result) : null;
        })
      );

      return notifications.filter(n => n !== null);
    } catch (error) {
      console.error('Error getting user notifications:', error);
      return [];
    }
  }

  public async markAsRead(notificationId: string, userId?: string): Promise<boolean> {
    try {
      const notification = await this.getNotification(notificationId);
      if (!notification) return false;

      notification.read = true;
      
      await this.redis.setex(
        `notification:${notificationId}`,
        86400 * 30,
        JSON.stringify(notification)
      );

      // Broadcast read status update
      await this.realtimeEvents.broadcast('notification_read', {
        notificationId,
        userId,
        timestamp: new Date().toISOString()
      });

      return true;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  }

  public async markAsAcknowledged(notificationId: string, userId?: string): Promise<boolean> {
    try {
      const notification = await this.getNotification(notificationId);
      if (!notification) return false;

      notification.acknowledged = true;
      
      await this.redis.setex(
        `notification:${notificationId}`,
        86400 * 30,
        JSON.stringify(notification)
      );

      // Broadcast acknowledgment
      await this.realtimeEvents.broadcast('notification_acknowledged', {
        notificationId,
        userId,
        timestamp: new Date().toISOString()
      });

      return true;
    } catch (error) {
      console.error('Error marking notification as acknowledged:', error);
      return false;
    }
  }

  public async getNotificationStats(timeRange: 'hour' | 'day' | 'week' = 'day'): Promise<NotificationStats> {
    try {
      const now = new Date();
      let keys: string[] = [];

      if (timeRange === 'hour') {
        const today = now.toISOString().split('T')[0];
        const hour = now.getHours();
        keys = [`notification_metrics:hourly:${today}:${hour}`];
      } else if (timeRange === 'day') {
        const today = now.toISOString().split('T')[0];
        keys = [`notification_metrics:daily:${today}`];
      } else {
        // Week - last 7 days
        for (let i = 0; i < 7; i++) {
          const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          const dateStr = date.toISOString().split('T')[0];
          keys.push(`notification_metrics:daily:${dateStr}`);
        }
      }

      // Get total sent
      const totalSentValues = await Promise.all(
        keys.map(key => this.redis.get(key))
      );
      const totalSent = totalSentValues
        .map(val => parseInt(val || '0', 10))
        .reduce((sum, val) => sum + val, 0);

      // Get channel metrics
      const channels: NotificationChannel[] = ['websocket', 'database', 'email', 'sms', 'alert', 'push'];
      const channelMetrics = await Promise.all(
        channels.map(async (channel) => {
          const value = await this.redis.get(`notification_metrics:channel:${channel}`);
          return [channel, parseInt(value || '0', 10)] as [NotificationChannel, number];
        })
      );
      const sentByChannel = Object.fromEntries(channelMetrics) as Record<NotificationChannel, number>;

      // Get priority metrics
      const priorities = ['low', 'normal', 'high', 'critical'];
      const priorityMetrics = await Promise.all(
        priorities.map(async (priority) => {
          const value = await this.redis.get(`notification_metrics:priority:${priority}`);
          return [priority, parseInt(value || '0', 10)];
        })
      );
      const sentByPriority = Object.fromEntries(priorityMetrics);

      // Get type metrics (top 10)
      const typeKeys = await this.redis.keys('notification_metrics:type:*');
      const typeMetrics = await Promise.all(
        typeKeys.slice(0, 10).map(async (key) => {
          const type = key.replace('notification_metrics:type:', '');
          const value = await this.redis.get(key);
          return [type, parseInt(value || '0', 10)];
        })
      );
      const sentByType = Object.fromEntries(typeMetrics);

      return {
        totalSent,
        sentByChannel,
        sentByPriority,
        sentByType,
        deliveryRate: 0.98, // Mock delivery rate
        averageDeliveryTime: 150 // Mock average delivery time in ms
      };

    } catch (error) {
      console.error('Error getting notification stats:', error);
      return {
        totalSent: 0,
        sentByChannel: {} as Record<NotificationChannel, number>,
        sentByPriority: {},
        sentByType: {},
        deliveryRate: 0,
        averageDeliveryTime: 0
      };
    }
  }

  public async createTemplate(template: Omit<NotificationTemplate, 'id'>): Promise<string> {
    const templateId = `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullTemplate: NotificationTemplate = {
      id: templateId,
      ...template
    };

    this.templates.set(template.type, fullTemplate);
    
    // Store in Redis
    await this.redis.setex(
      `notification_template:${templateId}`,
      86400 * 30,
      JSON.stringify(fullTemplate)
    );

    return templateId;
  }

  public getTemplate(type: string): NotificationTemplate | undefined {
    return this.templates.get(type);
  }

  private generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Cleanup method
  public async cleanup(): Promise<void> {
    try {
      // Clean up expired notifications
      const now = Date.now();
      const expiredNotifications = await this.redis.zrangebyscore(
        'all_notifications',
        0,
        now - 86400 * 30 * 1000 // 30 days ago
      );

      for (const notificationId of expiredNotifications) {
        await this.redis.del(`notification:${notificationId}`);
      }

      await this.redis.zremrangebyscore('all_notifications', 0, now - 86400 * 30 * 1000);

      console.log(`Cleaned up ${expiredNotifications.length} expired notifications`);
    } catch (error) {
      console.error('Error during notification cleanup:', error);
    }
  }
}