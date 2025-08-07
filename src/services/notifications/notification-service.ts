import { io, Socket } from 'socket.io-client';
import { EventEmitter } from 'events';

export interface Notification {
 id: string;
 title: string;
 message: string;
 type: 'info' | 'success' | 'warning' | 'error';
 timestamp: Date;
 read: boolean;
 priority: 'low' | 'medium' | 'high' | 'urgent';
 category: 'system' | 'entity' | 'deployment' | 'approval' | 'alert' | 'other';
 link?: string;
 actions?: NotificationAction[];
 metadata?: Record<string, any>;
}

export interface NotificationAction {
 id: string;
 label: string;
 action: string;
 style?: 'primary' | 'secondary' | 'danger';
}

export interface NotificationFilter {
 types?: Notification['type'][];
 categories?: Notification['category'][];
 priorities?: Notification['priority'][];
 read?: boolean;
 dateFrom?: Date;
 dateTo?: Date;
}

class NotificationService extends EventEmitter {
 private socket: Socket | null = null;
 private notifications: Map<string, Notification> = new Map();
 private connected = false;
 private reconnectAttempts = 0;
 private maxReconnectAttempts = 5;
 private reconnectDelay = 1000;
 private subscriptions = new Set<string>();

 constructor() {
 super();
 this.loadStoredNotifications();
 }

 connect(token?: string) {
 if (this.socket?.connected) {
 console.log('NotificationService: Already connected');
 return;
 }

 const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4403';
 
 this.socket = io(wsUrl, {
 auth: token ? { token } : undefined,
 reconnection: true,
 reconnectionAttempts: this.maxReconnectAttempts,
 reconnectionDelay: this.reconnectDelay,
 transports: ['websocket', 'polling'],
 });

 this.setupEventHandlers();
 }

 private setupEventHandlers() {
 if (!this.socket) return;

 this.socket.on('connect', () => {
 console.log('NotificationService: Connected to WebSocket server');
 this.connected = true;
 this.reconnectAttempts = 0;
 this.emit('connected');
 
 // Resubscribe to previous subscriptions
 this.subscriptions.forEach(sub => {
 if (sub.startsWith('entity:')) {
 this.subscribeToEntity(sub.replace('entity:', ''));
 } else if (sub === 'catalog') {
 this.subscribeToCatalog();
 }
 });
 });

 this.socket.on('disconnect', (reason) => {
 console.log('NotificationService: Disconnected:', reason);
 this.connected = false;
 this.emit('disconnected', reason);
 });

 this.socket.on('error', (error) => {
 console.error('NotificationService: Socket error:', error);
 this.emit('error', error);
 });

 this.socket.on('authenticated', (data) => {
 console.log('NotificationService: Authenticated:', data.user);
 this.emit('authenticated', data.user);
 });

 // Handle different notification types
 this.socket.on('notification', (data) => {
 this.handleNotification(data.data);
 });

 this.socket.on('team_notification', (data) => {
 this.handleNotification(data.data);
 });

 this.socket.on('entity_update', (data) => {
 this.handleEntityUpdate(data);
 });

 this.socket.on('catalog_update', (data) => {
 this.handleCatalogUpdate(data);
 });

 this.socket.on('deployment_update', (data) => {
 this.handleDeploymentUpdate(data);
 });

 this.socket.on('metrics_update', (data) => {
 this.emit('metrics_update', data.data);
 });

 this.socket.on('health_update', (data) => {
 this.emit('health_update', data.data);
 });
 }

 private handleNotification(notification: Partial<Notification>) {
 const fullNotification: Notification = {
 id: notification.id || `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
 title: notification.title || 'New Notification',
 message: notification.message || '',
 type: notification.type || 'info',
 timestamp: notification.timestamp ? new Date(notification.timestamp) : new Date(),
 read: notification.read || false,
 priority: notification.priority || 'medium',
 category: notification.category || 'other',
 link: notification.link,
 actions: notification.actions,
 metadata: notification.metadata,
 };

 this.notifications.set(fullNotification.id, fullNotification);
 this.saveNotifications();
 this.emit('new_notification', fullNotification);

 // Show browser notification if enabled and high priority
 if (fullNotification.priority === 'high' || fullNotification.priority === 'urgent') {
 this.showBrowserNotification(fullNotification);
 }
 }

 private handleEntityUpdate(data: any) {
 const notification: Partial<Notification> = {
 title: 'Entity Updated',
 message: `Entity ${data.data.entityRef} has been updated`,
 type: 'info',
 category: 'entity',
 priority: 'low',
 link: `/catalog/${data.data.entityRef}`,
 metadata: data.data,
 };
 this.handleNotification(notification);
 }

 private handleCatalogUpdate(data: any) {
 const { changeType, kind, namespace, name } = data.data;
 const notification: Partial<Notification> = {
 title: `Catalog ${changeType}`,
 message: `${kind} ${namespace}/${name} has been ${changeType}`,
 type: changeType === 'deleted' ? 'warning' : 'info',
 category: 'entity',
 priority: 'medium',
 link: `/catalog/${kind}:${namespace}/${name}`,
 metadata: data.data,
 };
 this.handleNotification(notification);
 }

 private handleDeploymentUpdate(data: any) {
 const { entityRef, deployment } = data.data;
 const notification: Partial<Notification> = {
 title: 'Deployment Update',
 message: `Deployment ${deployment.status} for ${entityRef}`,
 type: deployment.status === 'failed' ? 'error' : 
 deployment.status === 'succeeded' ? 'success' : 'info',
 category: 'deployment',
 priority: deployment.status === 'failed' ? 'high' : 'medium',
 link: `/catalog/${entityRef}/deployments`,
 metadata: data.data,
 };
 this.handleNotification(notification);
 }

 disconnect() {
 if (this.socket) {
 this.socket.disconnect();
 this.socket = null;
 this.connected = false;
 }
 }

 isConnected(): boolean {
 return this.connected;
 }

 // Subscription methods
 subscribeToEntity(entityRef: string) {
 if (!this.socket) return;
 this.socket.emit('subscribe_entity', { entityRef });
 this.subscriptions.add(`entity:${entityRef}`);
 }

 unsubscribeFromEntity(entityRef: string) {
 if (!this.socket) return;
 this.socket.emit('unsubscribe_entity', { entityRef });
 this.subscriptions.delete(`entity:${entityRef}`);
 }

 subscribeToCatalog() {
 if (!this.socket) return;
 this.socket.emit('subscribe_catalog');
 this.subscriptions.add('catalog');
 }

 unsubscribeFromCatalog() {
 if (!this.socket) return;
 this.socket.emit('unsubscribe_catalog');
 this.subscriptions.delete('catalog');
 }

 subscribeToMetrics(entityRef: string) {
 if (!this.socket) return;
 this.socket.emit('subscribe_metrics', { entityRef });
 }

 unsubscribeFromMetrics(entityRef: string) {
 if (!this.socket) return;
 this.socket.emit('unsubscribe_metrics', { entityRef });
 }

 // Notification management
 getNotifications(filter?: NotificationFilter): Notification[] {
 let notifications = Array.from(this.notifications.values());

 if (filter) {
 if (filter.types?.length) {
 notifications = notifications.filter(n => filter.types!.includes(n.type));
 }
 if (filter.categories?.length) {
 notifications = notifications.filter(n => filter.categories!.includes(n.category));
 }
 if (filter.priorities?.length) {
 notifications = notifications.filter(n => filter.priorities!.includes(n.priority));
 }
 if (filter.read !== undefined) {
 notifications = notifications.filter(n => n.read === filter.read);
 }
 if (filter.dateFrom) {
 notifications = notifications.filter(n => n.timestamp >= filter.dateFrom!);
 }
 if (filter.dateTo) {
 notifications = notifications.filter(n => n.timestamp <= filter.dateTo!);
 }
 }

 return notifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
 }

 getUnreadCount(): number {
 return Array.from(this.notifications.values()).filter(n => !n.read).length;
 }

 markAsRead(notificationId: string) {
 const notification = this.notifications.get(notificationId);
 if (notification) {
 notification.read = true;
 this.saveNotifications();
 this.emit('notification_read', notificationId);
 }
 }

 markAllAsRead() {
 this.notifications.forEach(notification => {
 notification.read = true;
 });
 this.saveNotifications();
 this.emit('all_notifications_read');
 }

 clearNotification(notificationId: string) {
 this.notifications.delete(notificationId);
 this.saveNotifications();
 this.emit('notification_cleared', notificationId);
 }

 clearAllNotifications() {
 this.notifications.clear();
 this.saveNotifications();
 this.emit('all_notifications_cleared');
 }

 // Browser notifications
 async requestBrowserNotificationPermission(): Promise<NotificationPermission> {
 if ('Notification' in window) {
 return await Notification.requestPermission();
 }
 return 'denied';
 }

 private showBrowserNotification(notification: Notification) {
 if ('Notification' in window && Notification.permission === 'granted') {
 const browserNotif = new Notification(notification.title, {
 body: notification.message,
 icon: '/icon-192x192.png',
 badge: '/icon-72x72.png',
 tag: notification.id,
 requireInteraction: notification.priority === 'urgent',
 });

 browserNotif.onclick = () => {
 window.focus();
 if (notification.link) {
 window.location.href = notification.link;
 }
 this.markAsRead(notification.id);
 };
 }
 }

 // Persistence
 private loadStoredNotifications() {
 if (typeof window !== 'undefined') {
 const stored = localStorage.getItem('idp_notifications');
 if (stored) {
 try {
 const parsed = JSON.parse(stored);
 parsed.forEach((notif: any) => {
 notif.timestamp = new Date(notif.timestamp);
 this.notifications.set(notif.id, notif);
 });
 } catch (error) {
 console.error('Failed to load stored notifications:', error);
 }
 }
 }
 }

 private saveNotifications() {
 if (typeof window !== 'undefined') {
 const toSave = Array.from(this.notifications.values()).slice(-100); // Keep last 100
 localStorage.setItem('idp_notifications', JSON.stringify(toSave));
 }
 }

 // Test notification
 createTestNotification(type: Notification['type'] = 'info') {
 this.handleNotification({
 title: 'Test Notification',
 message: `This is a test ${type} notification at ${new Date().toLocaleTimeString()}`,
 type,
 priority: type === 'error' ? 'high' : 'medium',
 category: 'system',
 actions: [
 {
 id: 'dismiss',
 label: 'Dismiss',
 action: 'dismiss',
 },
 ],
 });
 }
}

// Singleton instance
export const notificationService = new NotificationService();