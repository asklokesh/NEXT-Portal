import { prisma } from '@/lib/db/client';
import { webhookManager } from './webhook-manager';
import type { Notification } from '@/app/api/notifications/route';

export interface NotificationChannelConfig {
 email?: {
 enabled: boolean;
 smtp: {
 host: string;
 port: number;
 secure: boolean;
 auth: {
 user: string;
 pass: string;
 };
 };
 from: string;
 templates: Record<string, string>;
 };
 slack?: {
 enabled: boolean;
 botToken: string;
 defaultChannel: string;
 };
 teams?: {
 enabled: boolean;
 webhookUrl: string;
 };
 push?: {
 enabled: boolean;
 firebase: {
 serviceAccountKey: any;
 databaseURL: string;
 };
 };
 webhook?: {
 enabled: boolean;
 endpoints: Array<{
 url: string;
 secret: string;
 events: string[];
 }>;
 };
}

export class NotificationService {
 private channels: NotificationChannelConfig;
 private wsConnections: Map<string, WebSocket> = new Map();

 constructor(config: NotificationChannelConfig) {
 this.channels = config;
 }

 /**
 * Send notification through all configured channels
 */
 async sendNotification(notification: Omit<Notification, 'id' | 'createdAt' | 'updatedAt'>) {
 try {
 // Store in database first
 const savedNotification = await this.storeNotification(notification);

 // Get user preferences
 const userSettings = await this.getUserSettings(notification.userId || 'current-user');

 // Send through configured channels
 const sendPromises = [];

 if (userSettings.preferences.email.enabled && 
 userSettings.preferences.email.types.includes(notification.type)) {
 sendPromises.push(this.sendEmailNotification(savedNotification, userSettings));
 }

 if (userSettings.preferences.slack.enabled && 
 userSettings.preferences.slack.types.includes(notification.type)) {
 sendPromises.push(this.sendSlackNotification(savedNotification, userSettings));
 }

 if (userSettings.preferences.teams.enabled && 
 userSettings.preferences.teams.types.includes(notification.type)) {
 sendPromises.push(this.sendTeamsNotification(savedNotification, userSettings));
 }

 if (userSettings.preferences.push.enabled && 
 userSettings.preferences.push.types.includes(notification.type)) {
 sendPromises.push(this.sendPushNotification(savedNotification, userSettings));
 }

 // Real-time WebSocket notification
 if (userSettings.preferences.inApp.enabled && 
 userSettings.preferences.inApp.types.includes(notification.type)) {
 this.broadcastToUser(notification.userId || 'current-user', savedNotification);
 }

 // Send webhook notifications
 if (this.channels.webhook?.enabled) {
   sendPromises.push(this.sendWebhookNotification(savedNotification));
 }

 // Wait for all channels to complete
 await Promise.allSettled(sendPromises);

 return savedNotification;
 } catch (error) {
 console.error('Failed to send notification:', error);
 throw error;
 }
 }

 /**
 * Store notification in database
 */
 private async storeNotification(notification: Omit<Notification, 'id' | 'createdAt' | 'updatedAt'>) {
 return await prisma.notification.create({
 data: {
 type: notification.type,
 title: notification.title,
 message: notification.message,
 priority: notification.priority,
 sourceName: notification.source.name,
 sourceType: notification.source.type,
 actions: notification.actions ? JSON.stringify(notification.actions) : null,
 metadata: notification.metadata ? JSON.stringify(notification.metadata) : null,
 userId: notification.userId || 'current-user',
 read: false,
 pinned: false,
 archived: false
 }
 });
 }

 /**
 * Get user notification settings
 */
 private async getUserSettings(userId: string) {
 let settings = await prisma.notificationSettings.findUnique({
 where: { userId }
 });

 // Return default settings if none exist
 if (!settings) {
 return {
 preferences: {
 email: { enabled: true, types: ['error', 'warning', 'mention'], frequency: 'immediate' },
 push: { enabled: true, types: ['error', 'warning', 'mention'] },
 inApp: { enabled: true, types: ['error', 'warning', 'success', 'info', 'mention', 'system', 'alert'] },
 slack: { enabled: false, types: ['error', 'warning'] },
 teams: { enabled: false, types: ['error', 'warning'] }
 },
 filters: {
 priorities: ['urgent', 'high', 'medium', 'low'],
 environments: ['production', 'staging', 'development'],
 entityTypes: ['component', 'api', 'website', 'service'],
 keywords: []
 },
 quietHours: { enabled: false, start: '22:00', end: '08:00', timezone: 'UTC' }
 };
 }

 return {
 preferences: JSON.parse(settings.preferences),
 filters: JSON.parse(settings.filters),
 quietHours: JSON.parse(settings.quietHours)
 };
 }

 /**
 * Send email notification
 */
 private async sendEmailNotification(notification: any, userSettings: any) {
 if (!this.channels.email?.enabled) return;

 try {
 // Check quiet hours
 if (this.isQuietHours(userSettings.quietHours)) {
 console.log('Skipping email notification due to quiet hours');
 return;
 }

 // In production, implement actual email sending
 console.log('Sending email notification:', {
 to: `user-${notification.userId}@company.com`,
 subject: notification.title,
 body: notification.message,
 priority: notification.priority
 });

 // Example with nodemailer:
 // const transporter = nodemailer.createTransporter(this.channels.email.smtp);
 // await transporter.sendMail({
 // from: this.channels.email.from,
 // to: await this.getUserEmail(notification.userId),
 // subject: notification.title,
 // html: this.renderEmailTemplate(notification)
 // });
 } catch (error) {
 console.error('Failed to send email notification:', error);
 }
 }

 /**
 * Send Slack notification
 */
 private async sendSlackNotification(notification: any, userSettings: any) {
 if (!this.channels.slack?.enabled) return;

 try {
 const slackMessage = {
 channel: userSettings.preferences.slack.channel || this.channels.slack.defaultChannel,
 text: notification.title,
 attachments: [
 {
 color: this.getSlackColor(notification.type),
 fields: [
 {
 title: 'Message',
 value: notification.message,
 short: false
 },
 {
 title: 'Priority',
 value: notification.priority,
 short: true
 },
 {
 title: 'Source',
 value: notification.sourceName,
 short: true
 }
 ],
 ts: Math.floor(new Date(notification.createdAt).getTime() / 1000)
 }
 ]
 };

 console.log('Sending Slack notification:', slackMessage);

 // In production, implement actual Slack API call
 // const response = await fetch('https://slack.com/api/chat.postMessage', {
 // method: 'POST',
 // headers: {
 // 'Authorization': `Bearer ${this.channels.slack.botToken}`,
 // 'Content-Type': 'application/json'
 // },
 // body: JSON.stringify(slackMessage)
 // });
 } catch (error) {
 console.error('Failed to send Slack notification:', error);
 }
 }

 /**
 * Send Microsoft Teams notification
 */
 private async sendTeamsNotification(notification: any, userSettings: any) {
 if (!this.channels.teams?.enabled) return;

 try {
 const teamsMessage = {
 '@type': 'MessageCard',
 '@context': 'http://schema.org/extensions',
 themeColor: this.getTeamsColor(notification.type),
 summary: notification.title,
 sections: [
 {
 activityTitle: notification.title,
 activitySubtitle: notification.message,
 activityImage: `https://example.com/icons/${notification.type}.png`,
 facts: [
 { name: 'Priority', value: notification.priority },
 { name: 'Source', value: notification.sourceName },
 { name: 'Time', value: new Date(notification.createdAt).toLocaleString() }
 ]
 }
 ]
 };

 console.log('Sending Teams notification:', teamsMessage);

 // In production, implement actual Teams webhook call
 // await fetch(userSettings.preferences.teams.webhookUrl || this.channels.teams.webhookUrl, {
 // method: 'POST',
 // headers: { 'Content-Type': 'application/json' },
 // body: JSON.stringify(teamsMessage)
 // });
 } catch (error) {
 console.error('Failed to send Teams notification:', error);
 }
 }

 /**
 * Send push notification
 */
 private async sendPushNotification(notification: any, userSettings: any) {
 if (!this.channels.push?.enabled) return;

 try {
 const pushMessage = {
 title: notification.title,
 body: notification.message,
 data: {
 notificationId: notification.id,
 type: notification.type,
 priority: notification.priority
 }
 };

 console.log('Sending push notification:', pushMessage);

 // In production, implement Firebase Cloud Messaging
 // const admin = require('firebase-admin');
 // await admin.messaging().sendToTopic(`user-${notification.userId}`, pushMessage);
 } catch (error) {
 console.error('Failed to send push notification:', error);
 }
 }

 /**
 * Send webhook notification
 */
 private async sendWebhookNotification(notification: any) {
 if (!this.channels.webhook?.enabled) return;

 try {
 await webhookManager.sendNotificationWebhook(notification);
 } catch (error) {
 console.error('Failed to send webhook notification:', error);
 }
 }

 /**
 * Broadcast notification to user via WebSocket
 */
 private broadcastToUser(userId: string, notification: any) {
 const connection = this.wsConnections.get(userId);
 if (connection && connection.readyState === WebSocket.OPEN) {
 connection.send(JSON.stringify({
 type: 'notification',
 data: notification
 }));
 }
 }

 /**
 * Register WebSocket connection for user
 */
 registerConnection(userId: string, ws: WebSocket) {
 this.wsConnections.set(userId, ws);
 
 ws.on('close', () => {
 this.wsConnections.delete(userId);
 });
 }

 /**
 * Check if current time is within quiet hours
 */
 private isQuietHours(quietHours: any): boolean {
 if (!quietHours.enabled) return false;

 const now = new Date();
 const timezone = quietHours.timezone || 'UTC';
 const currentTime = now.toLocaleTimeString('en-US', { 
 timeZone: timezone, 
 hour12: false,
 hour: '2-digit',
 minute: '2-digit'
 });

 const [startHour, startMin] = quietHours.start.split(':').map(Number);
 const [endHour, endMin] = quietHours.end.split(':').map(Number);
 const [currentHour, currentMin] = currentTime.split(':').map(Number);

 const startMinutes = startHour * 60 + startMin;
 const endMinutes = endHour * 60 + endMin;
 const currentMinutes = currentHour * 60 + currentMin;

 if (startMinutes <= endMinutes) {
 return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
 } else {
 // Quiet hours span midnight
 return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
 }
 }

 /**
 * Get Slack color for notification type
 */
 private getSlackColor(type: string): string {
 switch (type) {
 case 'error':
 case 'alert':
 return '#dc2626';
 case 'warning':
 return '#d97706';
 case 'success':
 return '#059669';
 case 'info':
 return '#2563eb';
 default:
 return '#6b7280';
 }
 }

 /**
 * Get Teams color for notification type
 */
 private getTeamsColor(type: string): string {
 switch (type) {
 case 'error':
 case 'alert':
 return 'DC2626';
 case 'warning':
 return 'D97706';
 case 'success':
 return '059669';
 case 'info':
 return '2563EB';
 default:
 return '6B7280';
 }
 }

 /**
 * Create notification from deployment event
 */
 async notifyDeployment(data: {
 serviceId: string;
 serviceName: string;
 version: string;
 environment: string;
 status: 'started' | 'succeeded' | 'failed';
 error?: string;
 userId?: string;
 }) {
 const { serviceId, serviceName, version, environment, status, error, userId } = data;

 let type: Notification['type'];
 let title: string;
 let message: string;
 let priority: Notification['priority'];

 switch (status) {
 case 'started':
 type = 'info';
 title = 'Deployment Started';
 message = `Deployment of ${serviceName} v${version} to ${environment} has started`;
 priority = 'low';
 break;
 case 'succeeded':
 type = 'success';
 title = 'Deployment Completed';
 message = `${serviceName} v${version} successfully deployed to ${environment}`;
 priority = 'low';
 break;
 case 'failed':
 type = 'error';
 title = 'Deployment Failed';
 message = `${serviceName} v${version} deployment to ${environment} failed${error ? `: ${error}` : ''}`;
 priority = environment === 'production' ? 'high' : 'medium';
 break;
 }

 await this.sendNotification({
 type,
 title,
 message,
 priority,
 source: { name: 'CI/CD Pipeline', type: 'automation' },
 userId,
 timestamp: new Date().toISOString(),
 read: false,
 pinned: false,
 archived: false,
 actions: [
 {
 id: 'view-service',
 label: 'View Service',
 type: 'primary',
 url: `/catalog/default/component/${serviceId}`
 }
 ],
 metadata: {
 entityRef: `component:default/${serviceId}`,
 environment,
 version
 }
 });
 }

 /**
 * Create notification from monitoring alert
 */
 async notifyAlert(data: {
 serviceId: string;
 serviceName: string;
 alertType: string;
 severity: 'low' | 'medium' | 'high' | 'critical';
 message: string;
 environment: string;
 userId?: string;
 }) {
 const { serviceId, serviceName, alertType, severity, message, environment, userId } = data;

 const priorityMap = {
 low: 'low' as const,
 medium: 'medium' as const,
 high: 'high' as const,
 critical: 'urgent' as const
 };

 await this.sendNotification({
 type: severity === 'critical' ? 'alert' : 'warning',
 title: `${alertType} Alert - ${serviceName}`,
 message,
 priority: priorityMap[severity],
 source: { name: 'Monitoring System', type: 'system' },
 userId,
 timestamp: new Date().toISOString(),
 read: false,
 pinned: severity === 'critical',
 archived: false,
 actions: [
 {
 id: 'view-metrics',
 label: 'View Metrics',
 type: 'primary',
 url: `/monitoring/${serviceId}`
 }
 ],
 metadata: {
 entityRef: `component:default/${serviceId}`,
 environment,
 alertType
 }
 });
 }
}

// Create singleton instance
const notificationConfig: NotificationChannelConfig = {
 email: {
 enabled: process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true',
 smtp: {
 host: process.env.SMTP_HOST || 'localhost',
 port: parseInt(process.env.SMTP_PORT || '587', 10),
 secure: process.env.SMTP_SECURE === 'true',
 auth: {
 user: process.env.SMTP_USER || '',
 pass: process.env.SMTP_PASS || ''
 }
 },
 from: process.env.EMAIL_FROM || 'noreply@company.com',
 templates: {}
 },
 slack: {
 enabled: process.env.SLACK_NOTIFICATIONS_ENABLED === 'true',
 botToken: process.env.SLACK_BOT_TOKEN || '',
 defaultChannel: process.env.SLACK_DEFAULT_CHANNEL || '#general'
 },
 teams: {
 enabled: process.env.TEAMS_NOTIFICATIONS_ENABLED === 'true',
 webhookUrl: process.env.TEAMS_WEBHOOK_URL || ''
 },
 push: {
 enabled: process.env.PUSH_NOTIFICATIONS_ENABLED === 'true',
 firebase: {
 serviceAccountKey: process.env.FIREBASE_SERVICE_ACCOUNT_KEY ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY) : null,
 databaseURL: process.env.FIREBASE_DATABASE_URL || ''
 }
 },
 webhook: {
 enabled: process.env.WEBHOOK_NOTIFICATIONS_ENABLED === 'true',
 endpoints: []
 }
};

export const notificationService = new NotificationService(notificationConfig);