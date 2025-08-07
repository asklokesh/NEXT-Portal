import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { notificationService } from './service';

export class NotificationWebSocketServer {
 private io: SocketIOServer;
 private userConnections: Map<string, string[]> = new Map(); // userId -> socket IDs

 constructor(httpServer: HTTPServer) {
 this.io = new SocketIOServer(httpServer, {
 cors: {
 origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
 methods: ['GET', 'POST']
 },
 path: '/api/socket.io/'
 });

 this.setupEventHandlers();
 }

 private setupEventHandlers() {
 this.io.on('connection', (socket) => {
 console.log('New WebSocket connection:', socket.id);

 // Handle user authentication
 socket.on('authenticate', (data: { userId: string; token: string }) => {
 try {
 // In production, verify the token
 const { userId } = data;
 
 // Store user connection
 if (!this.userConnections.has(userId)) {
 this.userConnections.set(userId, []);
 }
 this.userConnections.get(userId)!.push(socket.id);

 // Join user-specific room
 socket.join(`user:${userId}`);
 
 // Store userId in socket data
 socket.data.userId = userId;

 socket.emit('authenticated', { success: true });
 console.log(`User ${userId} authenticated with socket ${socket.id}`);
 } catch (error) {
 console.error('Authentication failed:', error);
 socket.emit('authentication_error', { error: 'Invalid token' });
 socket.disconnect();
 }
 });

 // Handle notification subscription
 socket.on('subscribe_notifications', (filters: {
 types?: string[];
 priorities?: string[];
 environments?: string[];
 }) => {
 console.log('Client subscribed to notifications with filters:', filters);
 socket.data.notificationFilters = filters;
 });

 // Handle marking notifications as read
 socket.on('mark_notification_read', async (notificationId: string) => {
 try {
 const userId = socket.data.userId;
 if (!userId) return;

 // Update notification in database
 await fetch(`${process.env.BASE_URL}/api/notifications?id=${notificationId}`, {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ action: 'mark_read' })
 });

 // Broadcast to all user's connections
 this.io.to(`user:${userId}`).emit('notification_updated', {
 id: notificationId,
 read: true
 });
 } catch (error) {
 console.error('Failed to mark notification as read:', error);
 }
 });

 // Handle bulk actions
 socket.on('bulk_notification_action', async (data: {
 action: string;
 notificationIds: string[];
 }) => {
 try {
 const userId = socket.data.userId;
 if (!userId) return;

 const response = await fetch(`${process.env.BASE_URL}/api/notifications/bulk`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 action: data.action,
 notificationIds: data.notificationIds
 })
 });

 if (response.ok) {
 // Broadcast update to all user's connections
 this.io.to(`user:${userId}`).emit('notifications_bulk_updated', {
 action: data.action,
 notificationIds: data.notificationIds
 });
 }
 } catch (error) {
 console.error('Failed to process bulk action:', error);
 }
 });

 // Handle disconnection
 socket.on('disconnect', () => {
 console.log('Socket disconnected:', socket.id);
 
 // Remove from user connections
 const userId = socket.data.userId;
 if (userId && this.userConnections.has(userId)) {
 const connections = this.userConnections.get(userId)!;
 const index = connections.indexOf(socket.id);
 if (index > -1) {
 connections.splice(index, 1);
 }
 
 // Remove empty connection arrays
 if (connections.length === 0) {
 this.userConnections.delete(userId);
 }
 }
 });

 // Handle error
 socket.on('error', (error) => {
 console.error('Socket error:', error);
 });
 });
 }

 /**
 * Broadcast notification to specific user
 */
 broadcastToUser(userId: string, notification: any) {
 this.io.to(`user:${userId}`).emit('new_notification', notification);
 }

 /**
 * Broadcast notification to multiple users
 */
 broadcastToUsers(userIds: string[], notification: any) {
 userIds.forEach(userId => {
 this.broadcastToUser(userId, notification);
 });
 }

 /**
 * Broadcast system-wide notification to all connected users
 */
 broadcastSystem(notification: any) {
 this.io.emit('system_notification', notification);
 }

 /**
 * Broadcast to users based on filters
 */
 broadcastFiltered(notification: any, filter: {
 teams?: string[];
 environments?: string[];
 serviceIds?: string[];
 }) {
 // In production, query database for users matching the filter
 // For now, broadcast to all connected users
 this.io.emit('filtered_notification', { notification, filter });
 }

 /**
 * Get connected users count
 */
 getConnectedUsersCount(): number {
 return this.userConnections.size;
 }

 /**
 * Get user connection status
 */
 isUserConnected(userId: string): boolean {
 return this.userConnections.has(userId) && this.userConnections.get(userId)!.length > 0;
 }

 /**
 * Send notification status update
 */
 notifyStatusUpdate(userId: string, update: {
 type: 'deployment' | 'health_check' | 'cost_alert' | 'system';
 data: any;
 }) {
 this.io.to(`user:${userId}`).emit('status_update', update);
 }

 /**
 * Send real-time metrics update
 */
 notifyMetricsUpdate(data: {
 serviceId: string;
 metrics: any[];
 environment: string;
 }) {
 // Broadcast to all users monitoring this service
 this.io.emit('metrics_update', data);
 }

 /**
 * Send deployment status update
 */
 notifyDeploymentUpdate(data: {
 serviceId: string;
 deploymentId: string;
 status: string;
 environment: string;
 userId?: string;
 }) {
 if (data.userId) {
 this.io.to(`user:${data.userId}`).emit('deployment_update', data);
 } else {
 // Broadcast to service watchers
 this.io.emit('deployment_update', data);
 }
 }

 /**
 * Send cost alert
 */
 notifyCostAlert(data: {
 type: 'budget_exceeded' | 'spend_spike' | 'forecast_alert';
 serviceId?: string;
 budgetId?: string;
 amount: number;
 threshold: number;
 userIds: string[];
 }) {
 data.userIds.forEach(userId => {
 this.io.to(`user:${userId}`).emit('cost_alert', data);
 });
 }

 /**
 * Get server statistics
 */
 getStats() {
 return {
 connectedUsers: this.getConnectedUsersCount(),
 totalConnections: this.io.engine.clientsCount,
 rooms: Array.from(this.io.sockets.adapter.rooms.keys()).filter(room => room.startsWith('user:')),
 uptime: process.uptime()
 };
 }
}

// Global instance
let wsServer: NotificationWebSocketServer | null = null;

export function initializeWebSocketServer(httpServer: HTTPServer): NotificationWebSocketServer {
 if (!wsServer) {
 wsServer = new NotificationWebSocketServer(httpServer);
 console.log('WebSocket server initialized');
 }
 return wsServer;
}

export function getWebSocketServer(): NotificationWebSocketServer | null {
 return wsServer;
}

// Integration with notification service
export function setupNotificationWebSocketIntegration() {
 if (wsServer) {
 // Override the notification service's broadcast method
 const originalBroadcastToUser = notificationService.broadcastToUser;
 
 // eslint-disable-next-line @typescript-eslint/unbound-method
 notificationService.broadcastToUser = function(userId: string, notification: any) {
 wsServer?.broadcastToUser(userId, notification);
 };
 }
}