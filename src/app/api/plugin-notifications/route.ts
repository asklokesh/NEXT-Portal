import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

interface Notification {
  id: string;
  pluginId: string;
  type: 'info' | 'warning' | 'error' | 'success' | 'alert' | 'update';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  acknowledged: boolean;
  source: string;
  category: NotificationCategory;
  metadata?: Record<string, any>;
  actions?: NotificationAction[];
  expiresAt?: string;
  groupId?: string;
  userId?: string;
  channels: NotificationChannel[];
}

interface NotificationAction {
  id: string;
  label: string;
  type: 'primary' | 'secondary' | 'danger';
  action: string;
  url?: string;
  payload?: Record<string, any>;
}

interface NotificationChannel {
  type: 'email' | 'slack' | 'webhook' | 'in-app' | 'sms' | 'teams';
  status: 'pending' | 'sent' | 'failed' | 'delivered';
  sentAt?: string;
  error?: string;
  retries?: number;
}

interface NotificationPreference {
  userId: string;
  channels: {
    email: boolean;
    slack: boolean;
    webhook: boolean;
    inApp: boolean;
    sms: boolean;
    teams: boolean;
  };
  categories: {
    security: boolean;
    updates: boolean;
    billing: boolean;
    performance: boolean;
    compliance: boolean;
    maintenance: boolean;
  };
  frequency: 'realtime' | 'hourly' | 'daily' | 'weekly';
  quietHours?: {
    enabled: boolean;
    start: string;
    end: string;
    timezone: string;
  };
}

interface NotificationTemplate {
  id: string;
  name: string;
  type: string;
  subject: string;
  body: string;
  channels: string[];
  variables: string[];
  category: NotificationCategory;
  enabled: boolean;
}

interface NotificationRule {
  id: string;
  name: string;
  description: string;
  condition: string;
  actions: string[];
  enabled: boolean;
  priority: number;
  cooldown?: number;
  maxNotifications?: number;
  timeWindow?: number;
}

interface NotificationGroup {
  id: string;
  name: string;
  notifications: string[];
  summary: string;
  createdAt: string;
  updatedAt: string;
  status: 'open' | 'resolved' | 'muted';
}

interface DeliveryReport {
  notificationId: string;
  channel: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
  timestamp: string;
  error?: string;
  metadata?: Record<string, any>;
}

interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  byChannel: Record<string, number>;
  deliveryRate: number;
  responseRate: number;
}

type NotificationCategory = 
  | 'security'
  | 'updates'
  | 'billing'
  | 'performance'
  | 'compliance'
  | 'maintenance'
  | 'alerts'
  | 'system';

// Notification storage
const notificationStore = new Map<string, Notification>();
const preferenceStore = new Map<string, NotificationPreference>();
const templateStore = new Map<string, NotificationTemplate>();
const ruleStore = new Map<string, NotificationRule>();
const groupStore = new Map<string, NotificationGroup>();
const deliveryStore = new Map<string, DeliveryReport[]>();

// Initialize with sample templates
const initializeTemplates = () => {
  const templates: NotificationTemplate[] = [
    {
      id: 'security-alert',
      name: 'Security Alert',
      type: 'alert',
      subject: '[SECURITY] {{severity}} - {{title}}',
      body: 'A security issue has been detected in {{pluginName}}.\n\nDetails: {{message}}\n\nPlease take immediate action.',
      channels: ['email', 'slack', 'in-app'],
      variables: ['severity', 'title', 'pluginName', 'message'],
      category: 'security',
      enabled: true
    },
    {
      id: 'update-available',
      name: 'Update Available',
      type: 'update',
      subject: 'New update available for {{pluginName}}',
      body: 'Version {{version}} is now available for {{pluginName}}.\n\nChangelog:\n{{changelog}}\n\nUpdate now to get the latest features and improvements.',
      channels: ['email', 'in-app'],
      variables: ['pluginName', 'version', 'changelog'],
      category: 'updates',
      enabled: true
    },
    {
      id: 'billing-alert',
      name: 'Billing Alert',
      type: 'alert',
      subject: 'Billing notification for {{pluginName}}',
      body: '{{message}}\n\nCurrent usage: {{usage}}\nBilling period: {{period}}',
      channels: ['email'],
      variables: ['pluginName', 'message', 'usage', 'period'],
      category: 'billing',
      enabled: true
    }
  ];

  templates.forEach(template => {
    templateStore.set(template.id, template);
  });
};

// Initialize templates on module load
initializeTemplates();

// Send notification through various channels
const sendNotification = async (
  notification: Notification,
  preferences?: NotificationPreference
): Promise<DeliveryReport[]> => {
  const reports: DeliveryReport[] = [];

  for (const channel of notification.channels) {
    const report: DeliveryReport = {
      notificationId: notification.id,
      channel: channel.type,
      status: 'pending',
      timestamp: new Date().toISOString()
    };

    try {
      // Check user preferences
      if (preferences && !preferences.channels[channel.type as keyof typeof preferences.channels]) {
        report.status = 'failed';
        report.error = 'Channel disabled by user preference';
        reports.push(report);
        continue;
      }

      // Simulate sending through different channels
      switch (channel.type) {
        case 'email':
          // Simulate email sending
          await new Promise(resolve => setTimeout(resolve, 100));
          report.status = Math.random() > 0.1 ? 'delivered' : 'failed';
          if (report.status === 'failed') {
            report.error = 'SMTP connection failed';
          }
          break;

        case 'slack':
          // Simulate Slack webhook
          await new Promise(resolve => setTimeout(resolve, 50));
          report.status = Math.random() > 0.05 ? 'delivered' : 'failed';
          if (report.status === 'failed') {
            report.error = 'Invalid webhook URL';
          }
          break;

        case 'webhook':
          // Simulate webhook call
          await new Promise(resolve => setTimeout(resolve, 200));
          report.status = Math.random() > 0.15 ? 'delivered' : 'failed';
          if (report.status === 'failed') {
            report.error = 'Webhook endpoint returned 500';
          }
          break;

        case 'in-app':
          // In-app notifications are always delivered
          report.status = 'delivered';
          break;

        case 'sms':
          // Simulate SMS sending
          await new Promise(resolve => setTimeout(resolve, 150));
          report.status = Math.random() > 0.1 ? 'delivered' : 'failed';
          if (report.status === 'failed') {
            report.error = 'SMS gateway error';
          }
          break;

        case 'teams':
          // Simulate Teams webhook
          await new Promise(resolve => setTimeout(resolve, 75));
          report.status = Math.random() > 0.08 ? 'delivered' : 'failed';
          if (report.status === 'failed') {
            report.error = 'Teams connector error';
          }
          break;
      }

      // Update channel status
      channel.status = report.status === 'delivered' ? 'delivered' : 'failed';
      channel.sentAt = report.timestamp;
      if (report.error) {
        channel.error = report.error;
      }

    } catch (error) {
      report.status = 'failed';
      report.error = error instanceof Error ? error.message : 'Unknown error';
    }

    reports.push(report);
  }

  // Store delivery reports
  deliveryStore.set(notification.id, reports);

  return reports;
};

// Create notification from template
const createFromTemplate = (
  templateId: string,
  variables: Record<string, string>,
  pluginId: string
): Notification | null => {
  const template = templateStore.get(templateId);
  if (!template) return null;

  let subject = template.subject;
  let body = template.body;

  // Replace variables
  template.variables.forEach(variable => {
    const value = variables[variable] || '';
    subject = subject.replace(new RegExp(`{{${variable}}}`, 'g'), value);
    body = body.replace(new RegExp(`{{${variable}}}`, 'g'), value);
  });

  const notification: Notification = {
    id: crypto.randomBytes(8).toString('hex'),
    pluginId,
    type: template.type as Notification['type'],
    severity: variables.severity as Notification['severity'] || 'medium',
    title: subject,
    message: body,
    timestamp: new Date().toISOString(),
    read: false,
    acknowledged: false,
    source: 'system',
    category: template.category,
    channels: template.channels.map(ch => ({
      type: ch as NotificationChannel['type'],
      status: 'pending'
    })),
    metadata: variables
  };

  return notification;
};

// Group similar notifications
const groupNotifications = (notifications: Notification[]): NotificationGroup[] => {
  const groups = new Map<string, Notification[]>();

  notifications.forEach(notification => {
    const key = `${notification.pluginId}-${notification.type}-${notification.severity}`;
    const group = groups.get(key) || [];
    group.push(notification);
    groups.set(key, group);
  });

  const notificationGroups: NotificationGroup[] = [];

  groups.forEach((notifs, key) => {
    if (notifs.length > 1) {
      const group: NotificationGroup = {
        id: crypto.randomBytes(8).toString('hex'),
        name: `${notifs[0].type} notifications for ${notifs[0].pluginId}`,
        notifications: notifs.map(n => n.id),
        summary: `${notifs.length} similar notifications`,
        createdAt: notifs[0].timestamp,
        updatedAt: notifs[notifs.length - 1].timestamp,
        status: 'open'
      };
      notificationGroups.push(group);
      groupStore.set(group.id, group);
    }
  });

  return notificationGroups;
};

// Check notification rules
const checkRules = async (notification: Notification): Promise<string[]> => {
  const triggeredRules: string[] = [];

  Array.from(ruleStore.values())
    .filter(rule => rule.enabled)
    .sort((a, b) => b.priority - a.priority)
    .forEach(rule => {
      // Simple condition evaluation (in production, use a proper expression evaluator)
      let conditionMet = false;

      if (rule.condition.includes('severity')) {
        conditionMet = notification.severity === 'critical' || notification.severity === 'high';
      }
      if (rule.condition.includes('type')) {
        conditionMet = notification.type === 'error' || notification.type === 'alert';
      }

      if (conditionMet) {
        triggeredRules.push(rule.id);
        // Execute rule actions (simplified)
        rule.actions.forEach(action => {
          console.log(`Executing action: ${action} for rule: ${rule.name}`);
        });
      }
    });

  return triggeredRules;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'create': {
        const { pluginId, type, severity, title, message, category, channels, actions, metadata } = body;

        const notification: Notification = {
          id: crypto.randomBytes(8).toString('hex'),
          pluginId,
          type: type || 'info',
          severity: severity || 'medium',
          title,
          message,
          timestamp: new Date().toISOString(),
          read: false,
          acknowledged: false,
          source: body.source || 'system',
          category: category || 'system',
          channels: channels || [
            { type: 'in-app', status: 'pending' }
          ],
          actions: actions || [],
          metadata: metadata || {}
        };

        // Check rules
        const triggeredRules = await checkRules(notification);

        // Get user preferences
        const preferences = preferenceStore.get(body.userId || 'default');

        // Send notification
        const deliveryReports = await sendNotification(notification, preferences);

        // Store notification
        notificationStore.set(notification.id, notification);

        return NextResponse.json({
          success: true,
          notification,
          deliveryReports,
          triggeredRules
        });
      }

      case 'create_from_template': {
        const { templateId, variables, pluginId } = body;

        const notification = createFromTemplate(templateId, variables, pluginId);
        if (!notification) {
          return NextResponse.json({
            success: false,
            error: 'Template not found'
          }, { status: 404 });
        }

        // Send notification
        const deliveryReports = await sendNotification(notification);

        // Store notification
        notificationStore.set(notification.id, notification);

        return NextResponse.json({
          success: true,
          notification,
          deliveryReports
        });
      }

      case 'mark_read': {
        const { notificationId } = body;
        const notification = notificationStore.get(notificationId);

        if (!notification) {
          return NextResponse.json({
            success: false,
            error: 'Notification not found'
          }, { status: 404 });
        }

        notification.read = true;
        notificationStore.set(notificationId, notification);

        return NextResponse.json({
          success: true,
          notification
        });
      }

      case 'mark_all_read': {
        const { pluginId, userId } = body;

        let count = 0;
        notificationStore.forEach(notification => {
          if ((!pluginId || notification.pluginId === pluginId) &&
              (!userId || notification.userId === userId)) {
            notification.read = true;
            count++;
          }
        });

        return NextResponse.json({
          success: true,
          markedCount: count
        });
      }

      case 'acknowledge': {
        const { notificationId } = body;
        const notification = notificationStore.get(notificationId);

        if (!notification) {
          return NextResponse.json({
            success: false,
            error: 'Notification not found'
          }, { status: 404 });
        }

        notification.acknowledged = true;
        notification.read = true;
        notificationStore.set(notificationId, notification);

        return NextResponse.json({
          success: true,
          notification
        });
      }

      case 'delete': {
        const { notificationId } = body;

        if (!notificationStore.has(notificationId)) {
          return NextResponse.json({
            success: false,
            error: 'Notification not found'
          }, { status: 404 });
        }

        notificationStore.delete(notificationId);

        return NextResponse.json({
          success: true,
          message: 'Notification deleted'
        });
      }

      case 'bulk_delete': {
        const { notificationIds } = body;
        let deletedCount = 0;

        notificationIds.forEach((id: string) => {
          if (notificationStore.delete(id)) {
            deletedCount++;
          }
        });

        return NextResponse.json({
          success: true,
          deletedCount
        });
      }

      case 'update_preferences': {
        const { userId, preferences } = body;

        const userPreferences: NotificationPreference = {
          userId,
          channels: preferences.channels || {
            email: true,
            slack: false,
            webhook: false,
            inApp: true,
            sms: false,
            teams: false
          },
          categories: preferences.categories || {
            security: true,
            updates: true,
            billing: true,
            performance: true,
            compliance: true,
            maintenance: true
          },
          frequency: preferences.frequency || 'realtime',
          quietHours: preferences.quietHours
        };

        preferenceStore.set(userId, userPreferences);

        return NextResponse.json({
          success: true,
          preferences: userPreferences
        });
      }

      case 'create_rule': {
        const { name, description, condition, actions, priority, enabled } = body;

        const rule: NotificationRule = {
          id: crypto.randomBytes(8).toString('hex'),
          name,
          description,
          condition,
          actions: actions || [],
          enabled: enabled !== false,
          priority: priority || 0,
          cooldown: body.cooldown,
          maxNotifications: body.maxNotifications,
          timeWindow: body.timeWindow
        };

        ruleStore.set(rule.id, rule);

        return NextResponse.json({
          success: true,
          rule
        });
      }

      case 'test_channel': {
        const { channel, config } = body;

        const testNotification: Notification = {
          id: 'test-' + crypto.randomBytes(4).toString('hex'),
          pluginId: 'test',
          type: 'info',
          severity: 'low',
          title: 'Test Notification',
          message: `This is a test notification for ${channel} channel`,
          timestamp: new Date().toISOString(),
          read: false,
          acknowledged: false,
          source: 'test',
          category: 'system',
          channels: [{ type: channel, status: 'pending' }]
        };

        const reports = await sendNotification(testNotification);

        return NextResponse.json({
          success: true,
          deliveryReport: reports[0]
        });
      }

      case 'resend': {
        const { notificationId } = body;
        const notification = notificationStore.get(notificationId);

        if (!notification) {
          return NextResponse.json({
            success: false,
            error: 'Notification not found'
          }, { status: 404 });
        }

        // Reset channel statuses
        notification.channels.forEach(channel => {
          channel.status = 'pending';
          channel.retries = (channel.retries || 0) + 1;
        });

        const deliveryReports = await sendNotification(notification);

        return NextResponse.json({
          success: true,
          notification,
          deliveryReports
        });
      }

      case 'batch_send': {
        const { notifications, userId } = body;
        const results = [];

        for (const notif of notifications) {
          const notification: Notification = {
            id: crypto.randomBytes(8).toString('hex'),
            ...notif,
            timestamp: new Date().toISOString(),
            read: false,
            acknowledged: false,
            userId
          };

          const deliveryReports = await sendNotification(notification);
          notificationStore.set(notification.id, notification);
          
          results.push({
            notification,
            deliveryReports
          });
        }

        return NextResponse.json({
          success: true,
          results,
          count: results.length
        });
      }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Notification API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process notification request'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pluginId = searchParams.get('pluginId');
    const userId = searchParams.get('userId');
    const type = searchParams.get('type');
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Filter notifications
    let notifications = Array.from(notificationStore.values());

    if (pluginId) {
      notifications = notifications.filter(n => n.pluginId === pluginId);
    }

    if (userId) {
      notifications = notifications.filter(n => n.userId === userId);
    }

    if (type) {
      switch (type) {
        case 'preferences':
          const preferences = preferenceStore.get(userId || 'default');
          return NextResponse.json({
            success: true,
            preferences: preferences || {
              userId: userId || 'default',
              channels: {
                email: true,
                slack: false,
                webhook: false,
                inApp: true,
                sms: false,
                teams: false
              },
              categories: {
                security: true,
                updates: true,
                billing: true,
                performance: true,
                compliance: true,
                maintenance: true
              },
              frequency: 'realtime'
            }
          });

        case 'templates':
          return NextResponse.json({
            success: true,
            templates: Array.from(templateStore.values())
          });

        case 'rules':
          return NextResponse.json({
            success: true,
            rules: Array.from(ruleStore.values())
          });

        case 'groups':
          const groups = groupNotifications(notifications);
          return NextResponse.json({
            success: true,
            groups
          });

        case 'stats':
          const stats: NotificationStats = {
            total: notifications.length,
            unread: notifications.filter(n => !n.read).length,
            byType: {},
            bySeverity: {},
            byChannel: {},
            deliveryRate: 0,
            responseRate: 0
          };

          notifications.forEach(n => {
            stats.byType[n.type] = (stats.byType[n.type] || 0) + 1;
            stats.bySeverity[n.severity] = (stats.bySeverity[n.severity] || 0) + 1;
            n.channels.forEach(ch => {
              stats.byChannel[ch.type] = (stats.byChannel[ch.type] || 0) + 1;
            });
          });

          // Calculate delivery rate
          let totalDeliveries = 0;
          let successfulDeliveries = 0;
          deliveryStore.forEach(reports => {
            reports.forEach(report => {
              totalDeliveries++;
              if (report.status === 'delivered') {
                successfulDeliveries++;
              }
            });
          });
          stats.deliveryRate = totalDeliveries > 0 ? (successfulDeliveries / totalDeliveries) * 100 : 0;

          // Calculate response rate (acknowledged notifications)
          const acknowledged = notifications.filter(n => n.acknowledged).length;
          stats.responseRate = notifications.length > 0 ? (acknowledged / notifications.length) * 100 : 0;

          return NextResponse.json({
            success: true,
            stats
          });
      }
    }

    if (unreadOnly) {
      notifications = notifications.filter(n => !n.read);
    }

    // Sort by timestamp (newest first)
    notifications.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Pagination
    const paginatedNotifications = notifications.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      notifications: paginatedNotifications,
      total: notifications.length,
      unread: notifications.filter(n => !n.read).length,
      hasMore: offset + limit < notifications.length
    });

  } catch (error) {
    console.error('Notification API GET error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch notifications'
    }, { status: 500 });
  }
}