/**
 * Notification and Communication Services
 * 
 * This module provides a comprehensive notification and communication system
 * for the developer portal with the following components:
 * 
 * 1. NotificationEngine - Multi-channel notification delivery
 * 2. CommunicationHub - Real-time messaging and collaboration
 * 3. AlertManager - Intelligent alert routing and incident management
 * 4. NotificationService - Existing basic notification service (legacy)
 */

// Core Services
export { NotificationEngine, notificationEngine } from './notification-engine';
export { CommunicationHub, createCommunicationHub } from './communication-hub';
export { AlertManager, alertManager } from './alert-manager';
export { notificationService } from './notification-service';

// Types from NotificationEngine
export type {
  NotificationChannel,
  NotificationTemplate,
  NotificationRequest,
  NotificationPreferences,
  NotificationSubscription,
  NotificationFilter,
  DeliveryStatus,
  NotificationDigest,
  RichMediaContent,
} from './notification-engine';

// Types from CommunicationHub
export type {
  User,
  Channel,
  Message,
  Thread,
  Reaction,
  Attachment,
  Presence,
  CallSession,
  CallParticipant,
  BroadcastMessage,
  UserPreferences,
  ChannelSettings,
} from './communication-hub';

// Types from AlertManager
export type {
  Alert,
  AlertRule,
  AlertGroup,
  EscalationPolicy,
  EscalationRule,
  EscalationTarget,
  OnCallSchedule,
  ScheduleRotation,
  ScheduleOverride,
  AlertCondition,
  Incident,
  IncidentEvent,
  AlertMetrics,
  AlertPrediction,
  PagerDutyConfig,
  OpsGenieConfig,
  SlackConfig,
} from './alert-manager';

// Legacy types from NotificationService
export type {
  Notification,
  NotificationAction,
  NotificationFilter as LegacyNotificationFilter,
} from './notification-service';

/**
 * Unified Notification System Factory
 * 
 * Creates and configures all notification services with proper integration
 */
export class NotificationSystem {
  private static instance?: NotificationSystem;
  
  private notificationEngine: NotificationEngine;
  private alertManager: AlertManager;
  private communicationHub?: CommunicationHub;
  
  private constructor() {
    this.notificationEngine = notificationEngine;
    this.alertManager = alertManager;
    
    this.setupIntegrations();
  }
  
  static getInstance(): NotificationSystem {
    if (!this.instance) {
      this.instance = new NotificationSystem();
    }
    return this.instance;
  }
  
  /**
   * Initialize the communication hub with HTTP server
   */
  initializeCommunicationHub(server: any): void {
    this.communicationHub = createCommunicationHub(server);
    this.setupCommunicationIntegrations();
  }
  
  private setupIntegrations(): void {
    // Connect AlertManager to NotificationEngine
    this.alertManager.on('alert:received', async (alert) => {
      await this.notificationEngine.send({
        userId: 'system',
        priority: this.mapAlertSeverityToPriority(alert.severity),
        subject: `Alert: ${alert.name}`,
        message: `${alert.severity.toUpperCase()} alert fired: ${alert.name}`,
        data: alert,
        metadata: { type: 'alert', alertId: alert.id },
      });
    });
    
    this.alertManager.on('incident:created', async (incident) => {
      await this.notificationEngine.send({
        userId: 'system',
        priority: 'critical',
        subject: `Incident Created: ${incident.title}`,
        message: `A new ${incident.severity} incident has been created: ${incident.title}`,
        data: incident,
        metadata: { type: 'incident', incidentId: incident.id },
      });
    });
    
    // Connect NotificationEngine to legacy service for backwards compatibility
    this.notificationEngine.on('notification:in-app', (data) => {
      notificationService.emit('new_notification', data.notification);
    });
  }
  
  private setupCommunicationIntegrations(): void {
    if (!this.communicationHub) return;
    
    // Forward high-priority alerts to communication channels
    this.alertManager.on('alert:received', async (alert) => {
      if (alert.severity === 'critical' || alert.severity === 'error') {
        // This would be implemented based on your channel structure
        // Example: Send to incident response channel
      }
    });
    
    // Integrate communication with notifications
    this.communicationHub.on('message:new', async ({ message, user }) => {
      // Send notifications for mentions
      if (message.mentions && message.mentions.length > 0) {
        for (const mention of message.mentions) {
          await this.notificationEngine.send({
            userId: mention,
            priority: 'normal',
            subject: `You were mentioned in ${message.channelId}`,
            message: `${user.username}: ${message.content}`,
            data: { messageId: message.id, channelId: message.channelId },
            metadata: { type: 'mention' },
          });
        }
      }
    });
  }
  
  private mapAlertSeverityToPriority(severity: string): 'low' | 'normal' | 'high' | 'critical' {
    const mapping: Record<string, 'low' | 'normal' | 'high' | 'critical'> = {
      info: 'low',
      warning: 'normal',
      error: 'high',
      critical: 'critical',
    };
    return mapping[severity] || 'normal';
  }
  
  /**
   * Get notification engine instance
   */
  getNotificationEngine(): NotificationEngine {
    return this.notificationEngine;
  }
  
  /**
   * Get alert manager instance
   */
  getAlertManager(): AlertManager {
    return this.alertManager;
  }
  
  /**
   * Get communication hub instance
   */
  getCommunicationHub(): CommunicationHub | undefined {
    return this.communicationHub;
  }
  
  /**
   * Get legacy notification service
   */
  getLegacyNotificationService(): any {
    return notificationService;
  }
  
  /**
   * Send a notification through the unified system
   */
  async sendNotification(request: {
    userId: string;
    title: string;
    message: string;
    priority?: 'low' | 'normal' | 'high' | 'critical';
    channel?: string;
    data?: any;
  }): Promise<string> {
    return await this.notificationEngine.send({
      userId: request.userId,
      subject: request.title,
      message: request.message,
      priority: request.priority || 'normal',
      channel: request.channel as any,
      data: request.data,
    });
  }
  
  /**
   * Create an alert
   */
  async createAlert(alert: {
    name: string;
    severity: 'info' | 'warning' | 'error' | 'critical';
    source: string;
    service?: string;
    message: string;
    labels?: Record<string, string>;
  }): Promise<any> {
    return await this.alertManager.receiveAlert({
      name: alert.name,
      severity: alert.severity,
      source: alert.source,
      service: alert.service,
      labels: alert.labels || {},
      annotations: { summary: alert.message },
    });
  }
  
  /**
   * Shutdown all services
   */
  async shutdown(): Promise<void> {
    await this.notificationEngine.shutdown();
    await this.alertManager.shutdown();
    if (this.communicationHub) {
      await this.communicationHub.shutdown();
    }
  }
}

// Export the singleton instance
export const notificationSystem = NotificationSystem.getInstance();

// Configuration helpers
export const configureNotifications = {
  /**
   * Configure email channel
   */
  email: (config: {
    smtp: {
      host: string;
      port: number;
      secure?: boolean;
      auth: { user: string; pass: string };
    };
    from: string;
  }) => {
    process.env.SMTP_HOST = config.smtp.host;
    process.env.SMTP_PORT = config.smtp.port.toString();
    process.env.SMTP_SECURE = config.smtp.secure ? 'true' : 'false';
    process.env.SMTP_USER = config.smtp.auth.user;
    process.env.SMTP_PASS = config.smtp.auth.pass;
    process.env.SMTP_FROM = config.from;
  },
  
  /**
   * Configure Slack integration
   */
  slack: (config: {
    token: string;
    defaultChannel?: string;
    webhookUrl?: string;
  }) => {
    process.env.SLACK_TOKEN = config.token;
    if (config.defaultChannel) {
      process.env.SLACK_DEFAULT_CHANNEL = config.defaultChannel;
    }
  },
  
  /**
   * Configure Teams integration
   */
  teams: (config: {
    webhookUrl: string;
  }) => {
    process.env.TEAMS_WEBHOOK = config.webhookUrl;
  },
  
  /**
   * Configure Discord integration
   */
  discord: (config: {
    token: string;
    defaultChannel: string;
  }) => {
    process.env.DISCORD_TOKEN = config.token;
    process.env.DISCORD_DEFAULT_CHANNEL = config.defaultChannel;
  },
  
  /**
   * Configure PagerDuty integration
   */
  pagerduty: async (config: {
    apiKey: string;
    routingKey: string;
  }) => {
    await alertManager.configureIntegration('pagerduty', config);
  },
  
  /**
   * Configure OpsGenie integration
   */
  opsgenie: async (config: {
    apiKey: string;
    region?: 'us' | 'eu';
  }) => {
    await alertManager.configureIntegration('opsgenie', config);
  },
};

/**
 * Quick start configuration
 */
export const quickStart = {
  /**
   * Initialize with basic configuration
   */
  basic: () => {
    // Basic in-app notifications only
    console.log('Notification system initialized with basic configuration');
    return notificationSystem;
  },
  
  /**
   * Initialize with full configuration
   */
  full: (server: any) => {
    notificationSystem.initializeCommunicationHub(server);
    console.log('Notification system initialized with full configuration');
    return notificationSystem;
  },
};

// Example usage patterns
export const examples = {
  /**
   * Send a simple notification
   */
  sendSimpleNotification: async () => {
    await notificationSystem.sendNotification({
      userId: 'user123',
      title: 'Deployment Complete',
      message: 'Your application has been successfully deployed to production',
      priority: 'normal',
    });
  },
  
  /**
   * Create an alert
   */
  createSimpleAlert: async () => {
    await notificationSystem.createAlert({
      name: 'High CPU Usage',
      severity: 'warning',
      source: 'monitoring',
      service: 'user-service',
      message: 'CPU usage is above 80% for 5 minutes',
      labels: { environment: 'production', team: 'platform' },
    });
  },
  
  /**
   * Set user notification preferences
   */
  setUserPreferences: async () => {
    await notificationSystem.getNotificationEngine().setUserPreferences({
      userId: 'user123',
      channels: {
        email: { enabled: true },
        slack: { enabled: true },
        'in-app': { enabled: true },
      },
      batching: {
        enabled: true,
        interval: 60, // minutes
        maxBatch: 10,
      },
    });
  },
};