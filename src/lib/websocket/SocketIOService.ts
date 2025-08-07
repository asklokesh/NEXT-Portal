import { io, Socket } from 'socket.io-client';
import { toast } from 'react-hot-toast';

export interface WebSocketMessage {
 type: string;
 entityRef?: string;
 data: any;
 timestamp: string;
}

export interface EntityUpdate {
 kind: string;
 namespace: string;
 name: string;
 data: any;
 changeType: 'created' | 'updated' | 'deleted';
}

export interface MetricsUpdate {
 entityRef: string;
 metrics: {
 cpu: number;
 memory: number;
 requests: number;
 errors: number;
 responseTime: number;
 errorRate: number;
 };
}

export interface DeploymentUpdate {
 entityRef: string;
 deployment: {
 id: string;
 version: string;
 environment: string;
 status: 'success' | 'failed' | 'in_progress' | 'rolled_back';
 startTime: string;
 endTime?: string;
 };
}

export interface HealthUpdate {
 entityRef: string;
 health: {
 status: 'healthy' | 'degraded' | 'unhealthy';
 level: 'info' | 'warning' | 'error';
 message: string;
 timestamp: string;
 checks?: Record<string, boolean>;
 };
}

type MessageHandler = (message: WebSocketMessage) => void;

class SocketIOService {
 private socket: Socket | null = null;
 private messageHandlers: Map<string, Set<MessageHandler>> = new Map();
 private connectionUrl: string;
 private reconnectAttempts = 0;
 private maxReconnectAttempts = 5;

 constructor() {
 this.connectionUrl = this.getWebSocketUrl();
 }

 private getWebSocketUrl(): string {
 if (typeof window === 'undefined') return '';
 
 // Use environment variable if set, otherwise construct from current location
 const wsHost = process.env.NEXT_PUBLIC_WS_URL || `http://localhost:${process.env.NEXT_PUBLIC_WS_PORT || '4403'}`;
 return wsHost;
 }

 async connect(): Promise<void> {
 return new Promise((resolve, reject) => {
 if (this.socket?.connected) {
 resolve();
 return;
 }

 try {
 // Get auth token
 const token = this.getAuthToken();

 // Create Socket.IO connection
 this.socket = io(this.connectionUrl, {
 auth: {
 token,
 },
 reconnection: true,
 reconnectionAttempts: this.maxReconnectAttempts,
 reconnectionDelay: 1000,
 reconnectionDelayMax: 5000,
 timeout: 20000,
 transports: ['websocket', 'polling'], // Try WebSocket first, fallback to polling
 });

 // Connection event handlers
 this.socket.on('connect', () => {
 console.log('Socket.IO connected:', this.socket?.id);
 this.reconnectAttempts = 0;
 resolve();
 });

 this.socket.on('authenticated', (data) => {
 console.log('Socket.IO authenticated:', data);
 toast.success('Real-time updates connected');
 });

 this.socket.on('connect_error', (error) => {
 console.error('Socket.IO connection error:', error.message);
 if (this.reconnectAttempts === 0) {
 reject(error);
 }
 this.reconnectAttempts++;
 });

 this.socket.on('disconnect', (reason) => {
 console.log('Socket.IO disconnected:', reason);
 if (reason === 'io server disconnect') {
 // Server initiated disconnect, attempt to reconnect
 this.socket?.connect();
 }
 });

 // Message handlers
 this.socket.on('error', (error) => {
 console.error('Socket.IO error:', error);
 toast.error(error.message || 'WebSocket error');
 });

 // Set up message handlers for different event types
 const eventTypes = [
 'entity_update',
 'metrics_update',
 'deployment_update',
 'health_update',
 'catalog_update',
 'notification',
 'team_notification',
 ];

 eventTypes.forEach(eventType => {
 this.socket!.on(eventType, (message) => {
 this.handleMessage({
 type: eventType,
 ...message,
 });
 });
 });

 // Handle pong responses
 this.socket.on('pong', (data) => {
 this.handleMessage({
 type: 'pong',
 data,
 timestamp: new Date().toISOString(),
 });
 });

 } catch (error) {
 console.error('Failed to create Socket.IO connection:', error);
 reject(error);
 }
 });
 }

 disconnect(): void {
 if (this.socket) {
 this.socket.disconnect();
 this.socket = null;
 }
 }

 getConnectionState(): 'connecting' | 'connected' | 'disconnected' | 'error' {
 if (!this.socket) return 'disconnected';
 if (this.socket.connected) return 'connected';
 if (this.socket.disconnected) return 'disconnected';
 return 'connecting';
 }

 private getAuthToken(): string | null {
 // Get from session storage or auth context
 return localStorage.getItem('backstage_token') || null;
 }

 send(message: Omit<WebSocketMessage, 'timestamp'> & { timestamp?: string }): void {
 if (!this.socket?.connected) {
 console.warn('Socket.IO not connected, message not sent:', message);
 return;
 }

 const { type, data, entityRef } = message;
 
 // Emit as specific event type
 this.socket.emit(type, {
 data,
 entityRef,
 timestamp: message.timestamp || new Date().toISOString(),
 });
 }

 private handleMessage(message: WebSocketMessage): void {
 const handlers = this.messageHandlers.get(message.type) || new Set();
 
 handlers.forEach(handler => {
 try {
 handler(message);
 } catch (error) {
 console.error(`Error in message handler for ${message.type}:`, error);
 }
 });
 }

 // Subscription methods
 subscribe(messageType: string, handler: MessageHandler): () => void {
 if (!this.messageHandlers.has(messageType)) {
 this.messageHandlers.set(messageType, new Set());
 }
 
 const handlers = this.messageHandlers.get(messageType)!;
 handlers.add(handler);

 // Return unsubscribe function
 return () => {
 handlers.delete(handler);
 if (handlers.size === 0) {
 this.messageHandlers.delete(messageType);
 }
 };
 }

 // Entity-specific subscription methods
 subscribeToEntityUpdates(handler: (update: EntityUpdate) => void): () => void {
 return this.subscribe('entity_update', (message) => {
 handler(message.data as EntityUpdate);
 });
 }

 subscribeToMetricsUpdates(entityRef: string, handler: (update: MetricsUpdate) => void): () => void {
 // Send subscription request
 this.socket?.emit('subscribe_metrics', { entityRef });

 const unsubscribe = this.subscribe('metrics_update', (message) => {
 const update = message.data as MetricsUpdate;
 if (update.entityRef === entityRef) {
 handler(update);
 }
 });

 // Return function that unsubscribes and notifies server
 return () => {
 this.socket?.emit('unsubscribe_metrics', { entityRef });
 unsubscribe();
 };
 }

 subscribeToDeploymentUpdates(entityRef: string, handler: (update: DeploymentUpdate) => void): () => void {
 this.socket?.emit('subscribe_deployments', { entityRef });

 const unsubscribe = this.subscribe('deployment_update', (message) => {
 const update = message.data as DeploymentUpdate;
 if (update.entityRef === entityRef) {
 handler(update);
 }
 });

 return () => {
 this.socket?.emit('unsubscribe_deployments', { entityRef });
 unsubscribe();
 };
 }

 subscribeToHealthUpdates(entityRef: string, handler: (update: HealthUpdate) => void): () => void {
 this.socket?.emit('subscribe_health', { entityRef });

 const unsubscribe = this.subscribe('health_update', (message) => {
 const update = message.data as HealthUpdate;
 if (update.entityRef === entityRef) {
 handler(update);
 }
 });

 return () => {
 this.socket?.emit('unsubscribe_health', { entityRef });
 unsubscribe();
 };
 }

 subscribeToCatalogUpdates(handler: (update: EntityUpdate) => void): () => void {
 this.socket?.emit('subscribe_catalog');

 const unsubscribe = this.subscribe('catalog_update', (message) => {
 handler(message.data as EntityUpdate);
 });

 return () => {
 this.socket?.emit('unsubscribe_catalog');
 unsubscribe();
 };
 }

 // Send ping to keep connection alive
 ping(): void {
 this.socket?.emit('ping');
 }
}

// Create singleton instance
export const socketIOService = new SocketIOService();

// For backward compatibility with existing code
export const webSocketService = {
 connect: () => socketIOService.connect(),
 disconnect: () => socketIOService.disconnect(),
 getConnectionState: () => socketIOService.getConnectionState(),
 send: (message: any) => socketIOService.send(message),
 subscribe: (type: string, handler: any) => socketIOService.subscribe(type, handler),
 subscribeToEntityUpdates: (handler: any) => socketIOService.subscribeToEntityUpdates(handler),
 subscribeToMetricsUpdates: (entityRef: string, handler: any) => socketIOService.subscribeToMetricsUpdates(entityRef, handler),
 subscribeToDeploymentUpdates: (entityRef: string, handler: any) => socketIOService.subscribeToDeploymentUpdates(entityRef, handler),
 subscribeToHealthUpdates: (entityRef: string, handler: any) => socketIOService.subscribeToHealthUpdates(entityRef, handler),
 subscribeToCatalogUpdates: (handler: any) => socketIOService.subscribeToCatalogUpdates(handler),
};