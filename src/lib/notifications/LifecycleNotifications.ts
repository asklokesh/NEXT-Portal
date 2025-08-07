import { z } from 'zod';
import { EventEmitter } from 'events';
import { addDays, addHours, isBefore, isAfter, parseISO } from 'date-fns';
import { 
  LifecycleStage, 
  LifecycleEntity, 
  TransitionHistory, 
  DeprecationSchedule,
  ApprovalStatus 
} from '../lifecycle/LifecycleManager';

// Notification types and priorities
export enum NotificationType {
  DEPRECATION_WARNING = 'deprecation_warning',
  RETIREMENT_REMINDER = 'retirement_reminder',
  TRANSITION_APPROVAL = 'transition_approval',
  COMPLIANCE_ALERT = 'compliance_alert',
  HEALTH_DEGRADATION = 'health_degradation',
  USAGE_ANOMALY = 'usage_anomaly',
  SECURITY_VULNERABILITY = 'security_vulnerability',
  POLICY_VIOLATION = 'policy_violation',
  SCHEDULED_MAINTENANCE = 'scheduled_maintenance',
  AUTOMATION_FAILURE = 'automation_failure'
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
  URGENT = 'urgent'
}

export enum NotificationChannel {
  EMAIL = 'email',
  SLACK = 'slack',
  TEAMS = 'teams',
  WEBHOOK = 'webhook',
  IN_APP = 'in_app',
  SMS = 'sms',
  PAGERDUTY = 'pagerduty'
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  ACKNOWLEDGED = 'acknowledged'
}

// Schema definitions
export const NotificationSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(NotificationType),
  priority: z.nativeEnum(NotificationPriority),
  title: z.string(),
  message: z.string(),
  entityId: z.string(),
  entityName: z.string(),
  recipients: z.array(z.string()),
  channels: z.array(z.nativeEnum(NotificationChannel)),
  status: z.nativeEnum(NotificationStatus),
  scheduledAt: z.string().datetime(),
  sentAt: z.string().datetime().optional(),
  acknowledgedAt: z.string().datetime().optional(),
  acknowledgedBy: z.string().optional(),
  retryCount: z.number().min(0).default(0),
  maxRetries: z.number().min(0).default(3),
  metadata: z.record(z.any()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const NotificationTemplateSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(NotificationType),
  name: z.string(),
  description: z.string(),
  subject: z.string(),
  bodyTemplate: z.string(),
  htmlTemplate: z.string().optional(),
  defaultChannels: z.array(z.nativeEnum(NotificationChannel)),
  defaultPriority: z.nativeEnum(NotificationPriority),
  variables: z.array(z.string()),
  conditions: z.record(z.any()).optional(),
  enabled: z.boolean(),
  createdBy: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const NotificationPreferenceSchema = z.object({
  userId: z.string(),
  entityId: z.string().optional(),
  notificationType: z.nativeEnum(NotificationType).optional(),
  channels: z.array(z.nativeEnum(NotificationChannel)),
  enabled: z.boolean(),
  quietHours: z.object({
    enabled: z.boolean(),
    startTime: z.string(),
    endTime: z.string(),
    timezone: z.string()
  }).optional(),
  escalationRules: z.array(z.object({
    delayMinutes: z.number(),
    channels: z.array(z.nativeEnum(NotificationChannel))
  })).optional(),
  filters: z.record(z.any()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const IntegrationConfigSchema = z.object({
  channel: z.nativeEnum(NotificationChannel),
  enabled: z.boolean(),
  config: z.record(z.any()),
  credentials: z.record(z.any()).optional(),
  rateLimit: z.object({
    maxRequests: z.number(),
    windowMinutes: z.number()
  }).optional(),
  retryPolicy: z.object({
    maxRetries: z.number(),
    backoffMultiplier: z.number(),
    maxBackoffMinutes: z.number()
  }).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export type Notification = z.infer<typeof NotificationSchema>;
export type NotificationTemplate = z.infer<typeof NotificationTemplateSchema>;
export type NotificationPreference = z.infer<typeof NotificationPreferenceSchema>;
export type IntegrationConfig = z.infer<typeof IntegrationConfigSchema>;

// Notification Manager Interface
export interface ILifecycleNotificationManager {
  // Notification management
  sendNotification(notification: Omit<Notification, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<Notification>;
  scheduleNotification(notification: Omit<Notification, 'id' | 'status' | 'createdAt' | 'updatedAt'>, delayMinutes: number): Promise<Notification>;
  getNotification(id: string): Promise<Notification | null>;
  getNotifications(filters?: { 
    type?: NotificationType; 
    status?: NotificationStatus; 
    entityId?: string;
    priority?: NotificationPriority;
  }): Promise<Notification[]>;
  acknowledgeNotification(id: string, acknowledgedBy: string): Promise<void>;
  
  // Template management
  createTemplate(template: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<NotificationTemplate>;
  updateTemplate(id: string, updates: Partial<NotificationTemplate>): Promise<NotificationTemplate>;
  getTemplate(type: NotificationType): Promise<NotificationTemplate | null>;
  
  // User preferences
  setPreferences(preferences: Omit<NotificationPreference, 'createdAt' | 'updatedAt'>): Promise<NotificationPreference>;
  getPreferences(userId: string, entityId?: string): Promise<NotificationPreference[]>;
  
  // Integration management
  configureIntegration(config: Omit<IntegrationConfig, 'createdAt' | 'updatedAt'>): Promise<IntegrationConfig>;
  getIntegrationConfig(channel: NotificationChannel): Promise<IntegrationConfig | null>;
  testIntegration(channel: NotificationChannel): Promise<boolean>;
  
  // Lifecycle-specific notifications
  notifyDeprecationWarning(entity: LifecycleEntity, schedule: DeprecationSchedule): Promise<void>;
  notifyRetirementReminder(entity: LifecycleEntity, daysUntilRetirement: number): Promise<void>;
  notifyTransitionApproval(transition: TransitionHistory, entity: LifecycleEntity): Promise<void>;
  notifyComplianceAlert(entity: LifecycleEntity, violations: string[]): Promise<void>;
  notifyHealthDegradation(entity: LifecycleEntity, metrics: any): Promise<void>;
  
  // Bulk operations
  sendBulkNotifications(notifications: Omit<Notification, 'id' | 'status' | 'createdAt' | 'updatedAt'>[]): Promise<Notification[]>;
  processScheduledNotifications(): Promise<void>;
  
  // Analytics and reporting
  getNotificationStats(days?: number): Promise<any>;
  exportNotificationLog(startDate: string, endDate: string): Promise<string>;
}

export class LifecycleNotificationManager extends EventEmitter implements ILifecycleNotificationManager {
  private notifications = new Map<string, Notification>();
  private templates = new Map<NotificationType, NotificationTemplate>();
  private preferences = new Map<string, NotificationPreference[]>();
  private integrations = new Map<NotificationChannel, IntegrationConfig>();
  private rateLimiters = new Map<NotificationChannel, { count: number; resetTime: Date }>();

  constructor() {
    super();
    this.setupDefaultTemplates();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen to lifecycle events
    this.on('notification_sent', this.handleNotificationSent.bind(this));
    this.on('notification_failed', this.handleNotificationFailed.bind(this));
  }

  async sendNotification(notification: Omit<Notification, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<Notification> {
    const id = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const fullNotification: Notification = {
      ...notification,
      id,
      status: NotificationStatus.PENDING,
      createdAt: now,
      updatedAt: now
    };

    const validatedNotification = NotificationSchema.parse(fullNotification);
    this.notifications.set(id, validatedNotification);

    // Check if should be sent immediately or scheduled
    const scheduledTime = parseISO(notification.scheduledAt);
    const now_date = new Date();
    
    if (isBefore(scheduledTime, now_date) || Math.abs(scheduledTime.getTime() - now_date.getTime()) < 60000) {
      // Send immediately
      await this.processNotification(validatedNotification);
    }

    this.emit('notification_created', validatedNotification);
    return validatedNotification;
  }

  async scheduleNotification(
    notification: Omit<Notification, 'id' | 'status' | 'createdAt' | 'updatedAt'>,
    delayMinutes: number
  ): Promise<Notification> {
    const scheduledAt = addHours(new Date(), delayMinutes / 60).toISOString();
    
    return this.sendNotification({
      ...notification,
      scheduledAt
    });
  }

  async getNotification(id: string): Promise<Notification | null> {
    return this.notifications.get(id) || null;
  }

  async getNotifications(filters?: { 
    type?: NotificationType; 
    status?: NotificationStatus; 
    entityId?: string;
    priority?: NotificationPriority;
  }): Promise<Notification[]> {
    let notifications = Array.from(this.notifications.values());
    
    if (filters) {
      if (filters.type) {
        notifications = notifications.filter(n => n.type === filters.type);
      }
      if (filters.status) {
        notifications = notifications.filter(n => n.status === filters.status);
      }
      if (filters.entityId) {
        notifications = notifications.filter(n => n.entityId === filters.entityId);
      }
      if (filters.priority) {
        notifications = notifications.filter(n => n.priority === filters.priority);
      }
    }

    return notifications.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async acknowledgeNotification(id: string, acknowledgedBy: string): Promise<void> {
    const notification = this.notifications.get(id);
    if (!notification) {
      throw new Error(`Notification with id ${id} not found`);
    }

    notification.status = NotificationStatus.ACKNOWLEDGED;
    notification.acknowledgedAt = new Date().toISOString();
    notification.acknowledgedBy = acknowledgedBy;
    notification.updatedAt = new Date().toISOString();

    this.notifications.set(id, notification);
    this.emit('notification_acknowledged', notification);
  }

  async createTemplate(template: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<NotificationTemplate> {
    const id = `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const fullTemplate: NotificationTemplate = {
      ...template,
      id,
      createdAt: now,
      updatedAt: now
    };

    const validatedTemplate = NotificationTemplateSchema.parse(fullTemplate);
    this.templates.set(template.type, validatedTemplate);

    this.emit('template_created', validatedTemplate);
    return validatedTemplate;
  }

  async updateTemplate(id: string, updates: Partial<NotificationTemplate>): Promise<NotificationTemplate> {
    const template = Array.from(this.templates.values()).find(t => t.id === id);
    if (!template) {
      throw new Error(`Template with id ${id} not found`);
    }

    const updatedTemplate: NotificationTemplate = {
      ...template,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    const validatedTemplate = NotificationTemplateSchema.parse(updatedTemplate);
    this.templates.set(template.type, validatedTemplate);

    this.emit('template_updated', validatedTemplate);
    return validatedTemplate;
  }

  async getTemplate(type: NotificationType): Promise<NotificationTemplate | null> {
    return this.templates.get(type) || null;
  }

  async setPreferences(preferences: Omit<NotificationPreference, 'createdAt' | 'updatedAt'>): Promise<NotificationPreference> {
    const now = new Date().toISOString();
    const fullPreferences: NotificationPreference = {
      ...preferences,
      createdAt: now,
      updatedAt: now
    };

    const validatedPreferences = NotificationPreferenceSchema.parse(fullPreferences);
    
    if (!this.preferences.has(preferences.userId)) {
      this.preferences.set(preferences.userId, []);
    }
    
    const userPrefs = this.preferences.get(preferences.userId)!;
    const existingIndex = userPrefs.findIndex(p => 
      p.entityId === preferences.entityId && 
      p.notificationType === preferences.notificationType
    );
    
    if (existingIndex >= 0) {
      userPrefs[existingIndex] = validatedPreferences;
    } else {
      userPrefs.push(validatedPreferences);
    }

    this.emit('preferences_updated', validatedPreferences);
    return validatedPreferences;
  }

  async getPreferences(userId: string, entityId?: string): Promise<NotificationPreference[]> {
    const userPrefs = this.preferences.get(userId) || [];
    
    if (entityId) {
      return userPrefs.filter(p => p.entityId === entityId);
    }
    
    return userPrefs;
  }

  async configureIntegration(config: Omit<IntegrationConfig, 'createdAt' | 'updatedAt'>): Promise<IntegrationConfig> {
    const now = new Date().toISOString();
    const fullConfig: IntegrationConfig = {
      ...config,
      createdAt: now,
      updatedAt: now
    };

    const validatedConfig = IntegrationConfigSchema.parse(fullConfig);
    this.integrations.set(config.channel, validatedConfig);

    this.emit('integration_configured', validatedConfig);
    return validatedConfig;
  }

  async getIntegrationConfig(channel: NotificationChannel): Promise<IntegrationConfig | null> {
    return this.integrations.get(channel) || null;
  }

  async testIntegration(channel: NotificationChannel): Promise<boolean> {
    const config = this.integrations.get(channel);
    if (!config || !config.enabled) {
      return false;
    }

    try {
      // Send test notification
      const testNotification: Notification = {
        id: 'test',
        type: NotificationType.AUTOMATION_FAILURE,
        priority: NotificationPriority.LOW,
        title: 'Integration Test',
        message: 'This is a test notification to verify integration connectivity.',
        entityId: 'test',
        entityName: 'Test Service',
        recipients: ['test@example.com'],
        channels: [channel],
        status: NotificationStatus.PENDING,
        scheduledAt: new Date().toISOString(),
        retryCount: 0,
        maxRetries: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await this.sendViaChannel(testNotification, channel, config);
      return true;
    } catch (error) {
      console.error(`Integration test failed for ${channel}:`, error);
      return false;
    }
  }

  async notifyDeprecationWarning(entity: LifecycleEntity, schedule: DeprecationSchedule): Promise<void> {
    const template = await this.getTemplate(NotificationType.DEPRECATION_WARNING);
    const daysUntilDeprecation = Math.ceil(
      (new Date(schedule.scheduledDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );

    const notification = {
      type: NotificationType.DEPRECATION_WARNING,
      priority: daysUntilDeprecation <= 7 ? NotificationPriority.HIGH : NotificationPriority.MEDIUM,
      title: `Deprecation Warning: ${entity.name}`,
      message: this.renderTemplate(template?.bodyTemplate || 'Service {{entityName}} will be deprecated on {{deprecationDate}}.', {
        entityName: entity.name,
        deprecationDate: new Date(schedule.scheduledDate).toLocaleDateString(),
        daysUntilDeprecation: daysUntilDeprecation.toString(),
        reason: schedule.reason,
        migrationPlan: schedule.migrationPlan || 'Contact service owners for migration details.',
        replacementService: schedule.replacementService || 'None specified'
      }),
      entityId: entity.id,
      entityName: entity.name,
      recipients: [...entity.owners, ...entity.stakeholders],
      channels: template?.defaultChannels || [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
      scheduledAt: new Date().toISOString(),
      metadata: {
        scheduleId: schedule.id,
        deprecationDate: schedule.scheduledDate,
        daysUntilDeprecation
      }
    };

    await this.sendNotification(notification);
  }

  async notifyRetirementReminder(entity: LifecycleEntity, daysUntilRetirement: number): Promise<void> {
    const template = await this.getTemplate(NotificationType.RETIREMENT_REMINDER);
    
    const notification = {
      type: NotificationType.RETIREMENT_REMINDER,
      priority: daysUntilRetirement <= 3 ? NotificationPriority.CRITICAL : NotificationPriority.HIGH,
      title: `Retirement Reminder: ${entity.name}`,
      message: this.renderTemplate(template?.bodyTemplate || 'Service {{entityName}} will be retired in {{daysUntilRetirement}} days.', {
        entityName: entity.name,
        daysUntilRetirement: daysUntilRetirement.toString(),
        currentStage: entity.currentStage
      }),
      entityId: entity.id,
      entityName: entity.name,
      recipients: [...entity.owners, ...entity.stakeholders],
      channels: template?.defaultChannels || [NotificationChannel.EMAIL, NotificationChannel.SLACK, NotificationChannel.IN_APP],
      scheduledAt: new Date().toISOString(),
      metadata: {
        daysUntilRetirement
      }
    };

    await this.sendNotification(notification);
  }

  async notifyTransitionApproval(transition: TransitionHistory, entity: LifecycleEntity): Promise<void> {
    const template = await this.getTemplate(NotificationType.TRANSITION_APPROVAL);
    
    const notification = {
      type: NotificationType.TRANSITION_APPROVAL,
      priority: NotificationPriority.MEDIUM,
      title: `Approval Required: ${entity.name} Transition`,
      message: this.renderTemplate(template?.bodyTemplate || 'Service {{entityName}} requires approval to transition from {{fromStage}} to {{toStage}}.', {
        entityName: entity.name,
        fromStage: transition.fromStage,
        toStage: transition.toStage,
        reason: transition.reason,
        triggeredBy: transition.triggeredBy
      }),
      entityId: entity.id,
      entityName: entity.name,
      recipients: entity.owners,
      channels: template?.defaultChannels || [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
      scheduledAt: new Date().toISOString(),
      metadata: {
        transitionId: transition.id,
        fromStage: transition.fromStage,
        toStage: transition.toStage
      }
    };

    await this.sendNotification(notification);
  }

  async notifyComplianceAlert(entity: LifecycleEntity, violations: string[]): Promise<void> {
    const template = await this.getTemplate(NotificationType.COMPLIANCE_ALERT);
    
    const notification = {
      type: NotificationType.COMPLIANCE_ALERT,
      priority: NotificationPriority.HIGH,
      title: `Compliance Alert: ${entity.name}`,
      message: this.renderTemplate(template?.bodyTemplate || 'Service {{entityName}} has compliance violations: {{violations}}.', {
        entityName: entity.name,
        violations: violations.join(', '),
        violationCount: violations.length.toString()
      }),
      entityId: entity.id,
      entityName: entity.name,
      recipients: [...entity.owners, ...entity.stakeholders],
      channels: template?.defaultChannels || [NotificationChannel.EMAIL, NotificationChannel.SLACK],
      scheduledAt: new Date().toISOString(),
      metadata: {
        violations
      }
    };

    await this.sendNotification(notification);
  }

  async notifyHealthDegradation(entity: LifecycleEntity, metrics: any): Promise<void> {
    const template = await this.getTemplate(NotificationType.HEALTH_DEGRADATION);
    
    const notification = {
      type: NotificationType.HEALTH_DEGRADATION,
      priority: NotificationPriority.HIGH,
      title: `Health Alert: ${entity.name}`,
      message: this.renderTemplate(template?.bodyTemplate || 'Service {{entityName}} is experiencing health issues.', {
        entityName: entity.name,
        uptime: (metrics.health?.uptime * 100 || 0).toFixed(2) + '%',
        errorRate: (metrics.usage?.errorRate * 100 || 0).toFixed(2) + '%',
        responseTime: metrics.usage?.averageResponseTime || 'N/A'
      }),
      entityId: entity.id,
      entityName: entity.name,
      recipients: entity.owners,
      channels: template?.defaultChannels || [NotificationChannel.EMAIL, NotificationChannel.PAGERDUTY],
      scheduledAt: new Date().toISOString(),
      metadata: {
        metrics
      }
    };

    await this.sendNotification(notification);
  }

  async sendBulkNotifications(notifications: Omit<Notification, 'id' | 'status' | 'createdAt' | 'updatedAt'>[]): Promise<Notification[]> {
    const results: Notification[] = [];
    
    for (const notification of notifications) {
      try {
        const sent = await this.sendNotification(notification);
        results.push(sent);
      } catch (error) {
        console.error('Failed to send bulk notification:', error);
      }
    }
    
    return results;
  }

  async processScheduledNotifications(): Promise<void> {
    const now = new Date();
    const pendingNotifications = Array.from(this.notifications.values())
      .filter(n => 
        n.status === NotificationStatus.PENDING && 
        isBefore(parseISO(n.scheduledAt), now)
      );

    for (const notification of pendingNotifications) {
      await this.processNotification(notification);
    }
  }

  async getNotificationStats(days = 30): Promise<any> {
    const cutoffDate = addDays(new Date(), -days);
    const notifications = Array.from(this.notifications.values())
      .filter(n => isAfter(parseISO(n.createdAt), cutoffDate));

    const stats = {
      total: notifications.length,
      byType: {} as Record<NotificationType, number>,
      byStatus: {} as Record<NotificationStatus, number>,
      byPriority: {} as Record<NotificationPriority, number>,
      byChannel: {} as Record<NotificationChannel, number>,
      deliveryRate: 0,
      averageRetries: 0
    };

    notifications.forEach(n => {
      stats.byType[n.type] = (stats.byType[n.type] || 0) + 1;
      stats.byStatus[n.status] = (stats.byStatus[n.status] || 0) + 1;
      stats.byPriority[n.priority] = (stats.byPriority[n.priority] || 0) + 1;
      n.channels.forEach(channel => {
        stats.byChannel[channel] = (stats.byChannel[channel] || 0) + 1;
      });
    });

    const deliveredCount = (stats.byStatus[NotificationStatus.DELIVERED] || 0) + 
                          (stats.byStatus[NotificationStatus.SENT] || 0);
    stats.deliveryRate = notifications.length > 0 ? (deliveredCount / notifications.length) * 100 : 0;
    stats.averageRetries = notifications.reduce((sum, n) => sum + n.retryCount, 0) / notifications.length || 0;

    return stats;
  }

  async exportNotificationLog(startDate: string, endDate: string): Promise<string> {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    
    const notifications = Array.from(this.notifications.values())
      .filter(n => {
        const createdDate = parseISO(n.createdAt);
        return isAfter(createdDate, start) && isBefore(createdDate, end);
      });

    const logData = {
      exportDate: new Date().toISOString(),
      dateRange: { startDate, endDate },
      totalNotifications: notifications.length,
      notifications: notifications.map(n => ({
        ...n,
        // Remove sensitive data
        metadata: n.metadata ? Object.keys(n.metadata) : []
      }))
    };

    return JSON.stringify(logData, null, 2);
  }

  private async processNotification(notification: Notification): Promise<void> {
    try {
      // Apply user preferences
      const filteredChannels = await this.applyUserPreferences(notification);
      
      if (filteredChannels.length === 0) {
        notification.status = NotificationStatus.DELIVERED;
        notification.sentAt = new Date().toISOString();
        this.notifications.set(notification.id, notification);
        return;
      }

      // Check rate limits
      const rateLimitedChannels = filteredChannels.filter(channel => !this.isRateLimited(channel));
      
      if (rateLimitedChannels.length === 0) {
        // Reschedule for later
        notification.scheduledAt = addHours(new Date(), 1).toISOString();
        this.notifications.set(notification.id, notification);
        return;
      }

      // Send via each channel
      const results = await Promise.allSettled(
        rateLimitedChannels.map(channel => this.sendViaChannel(notification, channel))
      );

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;

      if (successCount > 0) {
        notification.status = NotificationStatus.SENT;
        notification.sentAt = new Date().toISOString();
        this.emit('notification_sent', notification);
      }

      if (failureCount > 0 && successCount === 0) {
        notification.retryCount++;
        if (notification.retryCount < notification.maxRetries) {
          // Reschedule with exponential backoff
          const backoffMinutes = Math.pow(2, notification.retryCount) * 5;
          notification.scheduledAt = addHours(new Date(), backoffMinutes / 60).toISOString();
        } else {
          notification.status = NotificationStatus.FAILED;
          this.emit('notification_failed', notification);
        }
      }

      notification.updatedAt = new Date().toISOString();
      this.notifications.set(notification.id, notification);

    } catch (error) {
      console.error('Error processing notification:', error);
      notification.status = NotificationStatus.FAILED;
      notification.updatedAt = new Date().toISOString();
      this.notifications.set(notification.id, notification);
      this.emit('notification_failed', notification, error);
    }
  }

  private async applyUserPreferences(notification: Notification): Promise<NotificationChannel[]> {
    const validChannels = [...notification.channels];
    
    for (const recipient of notification.recipients) {
      const preferences = await this.getPreferences(recipient, notification.entityId);
      
      // Apply global and entity-specific preferences
      preferences.forEach(pref => {
        if (pref.enabled && (!pref.notificationType || pref.notificationType === notification.type)) {
          // User has specific channel preferences
          const allowedChannels = validChannels.filter(channel => pref.channels.includes(channel));
          validChannels.splice(0, validChannels.length, ...allowedChannels);
        }
      });
    }

    return validChannels;
  }

  private isRateLimited(channel: NotificationChannel): boolean {
    const config = this.integrations.get(channel);
    if (!config?.rateLimit) return false;

    const rateLimiter = this.rateLimiters.get(channel);
    const now = new Date();

    if (!rateLimiter || isAfter(now, rateLimiter.resetTime)) {
      // Reset rate limiter
      this.rateLimiters.set(channel, {
        count: 1,
        resetTime: addHours(now, config.rateLimit.windowMinutes / 60)
      });
      return false;
    }

    if (rateLimiter.count >= config.rateLimit.maxRequests) {
      return true;
    }

    rateLimiter.count++;
    return false;
  }

  private async sendViaChannel(
    notification: Notification, 
    channel: NotificationChannel, 
    config?: IntegrationConfig
  ): Promise<void> {
    const integrationConfig = config || this.integrations.get(channel);
    
    if (!integrationConfig || !integrationConfig.enabled) {
      throw new Error(`Integration not configured or disabled for channel: ${channel}`);
    }

    switch (channel) {
      case NotificationChannel.EMAIL:
        await this.sendEmail(notification, integrationConfig);
        break;
      case NotificationChannel.SLACK:
        await this.sendSlack(notification, integrationConfig);
        break;
      case NotificationChannel.TEAMS:
        await this.sendTeams(notification, integrationConfig);
        break;
      case NotificationChannel.WEBHOOK:
        await this.sendWebhook(notification, integrationConfig);
        break;
      case NotificationChannel.IN_APP:
        await this.sendInApp(notification, integrationConfig);
        break;
      case NotificationChannel.SMS:
        await this.sendSMS(notification, integrationConfig);
        break;
      case NotificationChannel.PAGERDUTY:
        await this.sendPagerDuty(notification, integrationConfig);
        break;
      default:
        throw new Error(`Unsupported notification channel: ${channel}`);
    }

    this.updateRateLimit(channel);
  }

  private async sendEmail(notification: Notification, config: IntegrationConfig): Promise<void> {
    // Mock email sending - integrate with actual email service
    console.log(`[EMAIL] Sending to ${notification.recipients.join(', ')}: ${notification.title}`);
    this.emit('email_sent', { notification, config });
  }

  private async sendSlack(notification: Notification, config: IntegrationConfig): Promise<void> {
    // Mock Slack sending - integrate with Slack API
    console.log(`[SLACK] Sending notification: ${notification.title}`);
    this.emit('slack_sent', { notification, config });
  }

  private async sendTeams(notification: Notification, config: IntegrationConfig): Promise<void> {
    // Mock Teams sending - integrate with Microsoft Teams API
    console.log(`[TEAMS] Sending notification: ${notification.title}`);
    this.emit('teams_sent', { notification, config });
  }

  private async sendWebhook(notification: Notification, config: IntegrationConfig): Promise<void> {
    // Mock webhook sending - make HTTP request to configured webhook URL
    console.log(`[WEBHOOK] Sending to ${config.config.url}: ${notification.title}`);
    this.emit('webhook_sent', { notification, config });
  }

  private async sendInApp(notification: Notification, config: IntegrationConfig): Promise<void> {
    // Store in-app notification
    console.log(`[IN-APP] Storing notification: ${notification.title}`);
    this.emit('in_app_sent', { notification, config });
  }

  private async sendSMS(notification: Notification, config: IntegrationConfig): Promise<void> {
    // Mock SMS sending - integrate with SMS service
    console.log(`[SMS] Sending notification: ${notification.title}`);
    this.emit('sms_sent', { notification, config });
  }

  private async sendPagerDuty(notification: Notification, config: IntegrationConfig): Promise<void> {
    // Mock PagerDuty integration
    console.log(`[PAGERDUTY] Creating incident: ${notification.title}`);
    this.emit('pagerduty_sent', { notification, config });
  }

  private updateRateLimit(channel: NotificationChannel): void {
    const rateLimiter = this.rateLimiters.get(channel);
    if (rateLimiter) {
      rateLimiter.count++;
    }
  }

  private renderTemplate(template: string, variables: Record<string, string>): string {
    let rendered = template;
    
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      rendered = rendered.replace(new RegExp(placeholder, 'g'), value);
    });

    return rendered;
  }

  private setupDefaultTemplates(): void {
    // Default notification templates
    const defaultTemplates: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        type: NotificationType.DEPRECATION_WARNING,
        name: 'Deprecation Warning',
        description: 'Notify stakeholders of upcoming service deprecation',
        subject: 'Deprecation Warning: {{entityName}}',
        bodyTemplate: 'Service "{{entityName}}" will be deprecated on {{deprecationDate}} ({{daysUntilDeprecation}} days from now).\n\nReason: {{reason}}\n\nMigration Plan: {{migrationPlan}}\n\nReplacement Service: {{replacementService}}',
        defaultChannels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
        defaultPriority: NotificationPriority.MEDIUM,
        variables: ['entityName', 'deprecationDate', 'daysUntilDeprecation', 'reason', 'migrationPlan', 'replacementService'],
        enabled: true,
        createdBy: 'system'
      },
      {
        type: NotificationType.RETIREMENT_REMINDER,
        name: 'Retirement Reminder',
        description: 'Remind stakeholders of upcoming service retirement',
        subject: 'Retirement Reminder: {{entityName}}',
        bodyTemplate: 'Service "{{entityName}}" will be retired in {{daysUntilRetirement}} days.\n\nCurrent Stage: {{currentStage}}\n\nPlease ensure all dependencies are updated and data is migrated before the retirement date.',
        defaultChannels: [NotificationChannel.EMAIL, NotificationChannel.SLACK, NotificationChannel.IN_APP],
        defaultPriority: NotificationPriority.HIGH,
        variables: ['entityName', 'daysUntilRetirement', 'currentStage'],
        enabled: true,
        createdBy: 'system'
      },
      {
        type: NotificationType.TRANSITION_APPROVAL,
        name: 'Transition Approval Request',
        description: 'Request approval for lifecycle stage transition',
        subject: 'Approval Required: {{entityName}} Transition',
        bodyTemplate: 'Service "{{entityName}}" requires approval to transition from {{fromStage}} to {{toStage}}.\n\nReason: {{reason}}\n\nTriggered by: {{triggeredBy}}\n\nPlease review and approve or reject this transition.',
        defaultChannels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
        defaultPriority: NotificationPriority.MEDIUM,
        variables: ['entityName', 'fromStage', 'toStage', 'reason', 'triggeredBy'],
        enabled: true,
        createdBy: 'system'
      },
      {
        type: NotificationType.HEALTH_DEGRADATION,
        name: 'Health Degradation Alert',
        description: 'Alert when service health metrics degrade',
        subject: 'Health Alert: {{entityName}}',
        bodyTemplate: 'Service "{{entityName}}" is experiencing health issues:\n\nUptime: {{uptime}}\nError Rate: {{errorRate}}\nResponse Time: {{responseTime}}\n\nPlease investigate and take corrective action.',
        defaultChannels: [NotificationChannel.EMAIL, NotificationChannel.PAGERDUTY],
        defaultPriority: NotificationPriority.HIGH,
        variables: ['entityName', 'uptime', 'errorRate', 'responseTime'],
        enabled: true,
        createdBy: 'system'
      }
    ];

    defaultTemplates.forEach(template => {
      this.createTemplate(template).catch(console.error);
    });
  }

  private handleNotificationSent(notification: Notification): void {
    console.log(`Notification sent successfully: ${notification.title}`);
  }

  private handleNotificationFailed(notification: Notification, error?: any): void {
    console.error(`Notification failed: ${notification.title}`, error);
  }
}

// Singleton instance
export const lifecycleNotificationManager = new LifecycleNotificationManager();

export default LifecycleNotificationManager;