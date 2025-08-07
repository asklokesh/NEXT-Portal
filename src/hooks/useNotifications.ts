import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'react-hot-toast';
import type { Notification } from '@/app/api/notifications/route';

interface NotificationFilters {
 types?: string[];
 priorities?: string[];
 environments?: string[];
}

interface UseNotificationsOptions {
 userId?: string;
 autoConnect?: boolean;
 filters?: NotificationFilters;
 onNewNotification?: (notification: Notification) => void;
 onNotificationUpdate?: (update: { id: string; read?: boolean; pinned?: boolean; archived?: boolean }) => void;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
 const {
 userId = 'current-user',
 autoConnect = true,
 filters,
 onNewNotification,
 onNotificationUpdate
 } = options;

 const [socket, setSocket] = useState<Socket | null>(null);
 const [isConnected, setIsConnected] = useState(false);
 const [notifications, setNotifications] = useState<Notification[]>([]);
 const [unreadCount, setUnreadCount] = useState(0);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);

 const connectionAttempts = useRef(0);
 const maxRetries = 5;
 const retryDelay = 1000; // 1 second

 /**
 * Initialize WebSocket connection
 */
 const connect = useCallback(() => {
 if (socket?.connected) return;

 try {
 const newSocket = io({
 path: '/api/socket.io/',
 transports: ['websocket', 'polling'],
 timeout: 10000,
 reconnectionAttempts: maxRetries,
 reconnectionDelay: retryDelay
 });

 // Connection event handlers
 newSocket.on('connect', () => {
 console.log('Connected to notification WebSocket');
 setIsConnected(true);
 setError(null);
 connectionAttempts.current = 0;

 // Authenticate
 newSocket.emit('authenticate', {
 userId,
 token: localStorage.getItem('auth_token') || 'mock-token'
 });
 });

 newSocket.on('authenticated', () => {
 console.log('WebSocket authenticated');
 
 // Subscribe to notifications with filters
 if (filters) {
 newSocket.emit('subscribe_notifications', filters);
 }
 });

 newSocket.on('authentication_error', (data) => {
 console.error('WebSocket authentication failed:', data);
 setError('Authentication failed');
 toast.error('Failed to authenticate real-time notifications');
 });

 newSocket.on('disconnect', (reason) => {
 console.log('Disconnected from notification WebSocket:', reason);
 setIsConnected(false);
 
 if (reason === 'io server disconnect') {
 // Server disconnected, try to reconnect
 setTimeout(() => {
 if (connectionAttempts.current < maxRetries) {
 connectionAttempts.current++;
 connect();
 }
 }, retryDelay * connectionAttempts.current);
 }
 });

 newSocket.on('connect_error', (error) => {
 console.error('WebSocket connection error:', error);
 setError(`Connection failed: ${error.message}`);
 connectionAttempts.current++;
 
 if (connectionAttempts.current >= maxRetries) {
 setError('Failed to connect after multiple attempts');
 }
 });

 // Notification event handlers
 newSocket.on('new_notification', (notification: Notification) => {
 console.log('New notification received:', notification);
 
 setNotifications(prev => [notification, ...prev]);
 setUnreadCount(prev => prev + 1);
 
 // Show toast for high priority notifications
 if (notification.priority === 'urgent' || notification.priority === 'high') {
 toast.error(notification.title, {
 duration: 5000,
 position: 'top-right'
 });
 } else if (notification.type === 'success') {
 toast.success(notification.title);
 } else {
 toast(notification.title, {
 icon: getNotificationIcon(notification.type)
 });
 }
 
 onNewNotification?.(notification);
 });

 newSocket.on('notification_updated', (update: { id: string; read?: boolean; pinned?: boolean; archived?: boolean }) => {
 console.log('Notification updated:', update);
 
 setNotifications(prev => prev.map(n => 
 n.id === update.id ? { ...n, ...update } : n
 ));
 
 if (update.read === true) {
 setUnreadCount(prev => Math.max(0, prev - 1));
 } else if (update.read === false) {
 setUnreadCount(prev => prev + 1);
 }
 
 onNotificationUpdate?.(update);
 });

 newSocket.on('notifications_bulk_updated', (data: { action: string; notificationIds: string[] }) => {
 console.log('Bulk notification update:', data);
 
 setNotifications(prev => prev.map(n => {
 if (!data.notificationIds.includes(n.id)) return n;
 
 switch (data.action) {
 case 'mark_read':
 return { ...n, read: true };
 case 'mark_unread':
 return { ...n, read: false };
 case 'archive':
 return { ...n, archived: true };
 case 'pin':
 return { ...n, pinned: true };
 case 'unpin':
 return { ...n, pinned: false };
 default:
 return n;
 }
 }).filter(n => data.action !== 'delete' || !data.notificationIds.includes(n.id)));
 
 // Update unread count
 if (data.action === 'mark_read') {
 setUnreadCount(prev => Math.max(0, prev - data.notificationIds.length));
 } else if (data.action === 'mark_unread') {
 setUnreadCount(prev => prev + data.notificationIds.length);
 }
 });

 newSocket.on('system_notification', (notification: Notification) => {
 console.log('System notification:', notification);
 toast(notification.title, {
 duration: 4000
 });
 });

 newSocket.on('status_update', (update: { type: string; data: any }) => {
 console.log('Status update:', update);
 
 // Handle different types of status updates
 switch (update.type) {
 case 'deployment':
 if (update.data.status === 'failed') {
 toast.error(`Deployment failed: ${update.data.serviceName}`);
 } else if (update.data.status === 'completed') {
 toast.success(`Deployment completed: ${update.data.serviceName}`);
 }
 break;
 case 'health_check':
 if (update.data.status === 'unhealthy') {
 toast.error(`Health check failed: ${update.data.serviceName}`);
 }
 break;
 case 'cost_alert':
 toast.error(`Cost alert: ${update.data.message}`);
 break;
 }
 });

 setSocket(newSocket);
 } catch (error) {
 console.error('Failed to initialize WebSocket:', error);
 setError('Failed to initialize connection');
 }
 }, [userId, filters, onNewNotification, onNotificationUpdate]);

 /**
 * Disconnect WebSocket
 */
 const disconnect = useCallback(() => {
 if (socket) {
 socket.disconnect();
 setSocket(null);
 setIsConnected(false);
 }
 }, [socket]);

 /**
 * Load notifications from API
 */
 const loadNotifications = useCallback(async (options: {
 page?: number;
 limit?: number;
 filter?: string;
 type?: string;
 priority?: string;
 search?: string;
 } = {}) => {
 try {
 setLoading(true);
 
 const params = new URLSearchParams({
 page: (options.page || 1).toString(),
 limit: (options.limit || 50).toString(),
 ...(options.filter && { filter: options.filter }),
 ...(options.type && { type: options.type }),
 ...(options.priority && { priority: options.priority }),
 ...(options.search && { search: options.search })
 });

 const response = await fetch(`/api/notifications?${params}`);
 if (!response.ok) {
 throw new Error('Failed to fetch notifications');
 }

 const data = await response.json();
 setNotifications(data.notifications || []);
 setUnreadCount(data.summary?.unread || 0);
 setError(null);
 } catch (error) {
 console.error('Failed to load notifications:', error);
 setError('Failed to load notifications');
 toast.error('Failed to load notifications');
 } finally {
 setLoading(false);
 }
 }, []);

 /**
 * Mark notification as read
 */
 const markAsRead = useCallback(async (notificationId: string) => {
 if (socket?.connected) {
 socket.emit('mark_notification_read', notificationId);
 } else {
 // Fallback to HTTP API
 try {
 const response = await fetch(`/api/notifications?id=${notificationId}`, {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ action: 'mark_read' })
 });

 if (response.ok) {
 setNotifications(prev => prev.map(n => 
 n.id === notificationId ? { ...n, read: true } : n
 ));
 setUnreadCount(prev => Math.max(0, prev - 1));
 }
 } catch (error) {
 console.error('Failed to mark as read:', error);
 toast.error('Failed to mark as read');
 }
 }
 }, [socket]);

 /**
 * Bulk action on notifications
 */
 const bulkAction = useCallback(async (action: string, notificationIds: string[]) => {
 if (socket?.connected) {
 socket.emit('bulk_notification_action', { action, notificationIds });
 } else {
 // Fallback to HTTP API
 try {
 const response = await fetch('/api/notifications/bulk', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ action, notificationIds })
 });

 if (response.ok) {
 // Update local state
 setNotifications(prev => prev.map(n => {
 if (!notificationIds.includes(n.id)) return n;
 
 switch (action) {
 case 'mark_read':
 return { ...n, read: true };
 case 'mark_unread':
 return { ...n, read: false };
 case 'archive':
 return { ...n, archived: true };
 default:
 return n;
 }
 }).filter(n => action !== 'delete' || !notificationIds.includes(n.id)));
 }
 } catch (error) {
 console.error('Failed to perform bulk action:', error);
 toast.error('Failed to perform bulk action');
 }
 }
 }, [socket]);

 /**
 * Get notification icon for toast
 */
 const getNotificationIcon = (type: string): string => {
 switch (type) {
 case 'error':
 case 'alert':
 return 'ERROR';
 case 'warning':
 return 'WARNING';
 case 'success':
 return 'SUCCESS';
 case 'info':
 return 'INFO';
 case 'mention':
 return 'MENTION';
 case 'system':
 return 'SYSTEM';
 default:
 return 'NOTIFICATION';
 }
 };

 // Initialize connection on mount
 useEffect(() => {
 if (autoConnect) {
 connect();
 }

 return () => {
 disconnect();
 };
 }, [autoConnect, connect, disconnect]);

 // Load initial notifications
 useEffect(() => {
 void loadNotifications();
 }, [loadNotifications]);

 return {
 // Connection state
 socket,
 isConnected,
 error,
 
 // Data
 notifications,
 unreadCount,
 loading,
 
 // Actions
 connect,
 disconnect,
 loadNotifications,
 markAsRead,
 bulkAction,
 
 // Utilities
 connectionStatus: isConnected ? 'connected' : 'disconnected'
 };
}

export default useNotifications;