/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { API_ENDPOINTS } from '@/config/constants';
import { getErrorMessage } from '@/lib/utils';

export interface WebSocketMessage {
 type: string;
 payload: unknown;
 timestamp: string;
 id?: string;
}

export interface WebSocketEventHandlers {
 onOpen?: (event: Event) => void;
 onClose?: (event: CloseEvent) => void;
 onError?: (event: Event) => void;
 onMessage?: (message: WebSocketMessage) => void;
 onReconnect?: (attempt: number) => void;
}

export interface WebSocketConfig {
 url: string;
 protocols?: string | string[];
 reconnect?: boolean;
 reconnectInterval?: number;
 maxReconnectAttempts?: number;
 heartbeatInterval?: number;
 heartbeatTimeout?: number;
 authentication?: {
 token?: string;
 method?: 'header' | 'query' | 'subprotocol';
 };
}

export interface SubscriptionOptions {
 entityRef?: string;
 eventTypes?: string[];
 filters?: Record<string, unknown>;
}

export class BackstageWebSocketClient {
 private ws: WebSocket | null = null;
 private config: Required<WebSocketConfig>;
 private handlers: WebSocketEventHandlers = {};
 private subscriptions = new Map<string, SubscriptionOptions>();
 private reconnectAttempts = 0;
 private reconnectTimer: NodeJS.Timeout | null = null;
 private heartbeatTimer: NodeJS.Timeout | null = null;
 private heartbeatTimeoutTimer: NodeJS.Timeout | null = null;
 private isReconnecting = false;
 private isDestroyed = false;
 private connectionPromise: Promise<void> | null = null;

 constructor(config: WebSocketConfig) {
 this.config = {
 protocols: [],
 reconnect: true,
 reconnectInterval: 5000,
 maxReconnectAttempts: 10,
 heartbeatInterval: 30000,
 heartbeatTimeout: 5000,
 authentication: {},
 ...config,
 };
 }

 // Connect to WebSocket
 async connect(handlers: WebSocketEventHandlers = {}): Promise<void> {
 if (this.isDestroyed) {
 throw new Error('WebSocket client has been destroyed');
 }

 if (this.ws?.readyState === WebSocket.OPEN) {
 return Promise.resolve();
 }

 if (this.connectionPromise) {
 return this.connectionPromise;
 }

 this.handlers = { ...this.handlers, ...handlers };

 this.connectionPromise = new Promise((resolve, reject) => {
 try {
 const url = this.buildWebSocketUrl();
 const protocols = this.buildProtocols();

 console.debug('Connecting to WebSocket:', url);
 
 this.ws = new WebSocket(url, protocols);
 
 const handleOpen = (event: Event) => {
 console.debug('WebSocket connected');
 this.reconnectAttempts = 0;
 this.isReconnecting = false;
 this.startHeartbeat();
 this.resubscribeAll();
 this.handlers.onOpen?.(event);
 resolve();
 };

 const handleClose = (event: CloseEvent) => {
 console.debug('WebSocket closed:', event.code, event.reason);
 this.stopHeartbeat();
 this.handlers.onClose?.(event);
 
 if (this.config.reconnect && !this.isDestroyed && !this.isReconnecting) {
 this.scheduleReconnect();
 }
 };

 const handleError = (event: Event) => {
 console.error('WebSocket error:', event);
 this.handlers.onError?.(event);
 reject(new Error('WebSocket connection failed'));
 };

 const handleMessage = (event: MessageEvent) => {
 try {
 const message: WebSocketMessage = JSON.parse(event.data);
 this.handleMessage(message);
 } catch (error) {
 console.warn('Failed to parse WebSocket message:', error, event.data);
 }
 };

 this.ws.addEventListener('open', handleOpen);
 this.ws.addEventListener('close', handleClose);
 this.ws.addEventListener('error', handleError);
 this.ws.addEventListener('message', handleMessage);

 } catch (error) {
 this.connectionPromise = null;
 reject(error);
 }
 });

 try {
 await this.connectionPromise;
 } finally {
 this.connectionPromise = null;
 }
 }

 // Disconnect WebSocket
 disconnect(): void {
 this.isDestroyed = true;
 this.clearReconnectTimer();
 this.stopHeartbeat();
 
 if (this.ws) {
 this.ws.close(1000, 'Client disconnect');
 this.ws = null;
 }
 }

 // Send message
 send(message: Omit<WebSocketMessage, 'timestamp'>): void {
 if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
 throw new Error('WebSocket is not connected');
 }

 const fullMessage: WebSocketMessage = {
 ...message,
 timestamp: new Date().toISOString(),
 };

 this.ws.send(JSON.stringify(fullMessage));
 }

 // Subscribe to entity events
 subscribe(
 subscriptionId: string,
 options: SubscriptionOptions,
 onEvent?: (event: WebSocketMessage) => void
 ): void {
 this.subscriptions.set(subscriptionId, options);

 if (onEvent) {
 this.handlers[subscriptionId] = onEvent;
 }

 if (this.isConnected()) {
 this.sendSubscription(subscriptionId, options);
 }
 }

 // Unsubscribe from events
 unsubscribe(subscriptionId: string): void {
 this.subscriptions.delete(subscriptionId);
 delete this.handlers[subscriptionId];

 if (this.isConnected()) {
 this.send({
 type: 'unsubscribe',
 payload: { subscriptionId },
 });
 }
 }

 // Subscribe to catalog entity changes
 subscribeToCatalogEvents(
 entityRef?: string,
 onEvent?: (event: WebSocketMessage) => void
 ): string {
 const subscriptionId = `catalog:${entityRef || 'all'}:${Date.now()}`;
 
 this.subscribe(
 subscriptionId,
 {
 entityRef,
 eventTypes: ['entity.created', 'entity.updated', 'entity.deleted'],
 },
 onEvent
 );

 return subscriptionId;
 }

 // Subscribe to scaffolder task events
 subscribeToTaskEvents(
 taskId?: string,
 onEvent?: (event: WebSocketMessage) => void
 ): string {
 const subscriptionId = `scaffolder:${taskId || 'all'}:${Date.now()}`;
 
 this.subscribe(
 subscriptionId,
 {
 entityRef: taskId,
 eventTypes: ['task.created', 'task.started', 'task.completed', 'task.failed', 'task.log'],
 },
 onEvent
 );

 return subscriptionId;
 }

 // Subscribe to TechDocs events
 subscribeToDocsEvents(
 entityRef?: string,
 onEvent?: (event: WebSocketMessage) => void
 ): string {
 const subscriptionId = `techdocs:${entityRef || 'all'}:${Date.now()}`;
 
 this.subscribe(
 subscriptionId,
 {
 entityRef,
 eventTypes: ['docs.built', 'docs.synced', 'docs.published'],
 },
 onEvent
 );

 return subscriptionId;
 }

 // Check if connected
 isConnected(): boolean {
 return this.ws?.readyState === WebSocket.OPEN;
 }

 // Get connection state
 getConnectionState(): 'connecting' | 'open' | 'closing' | 'closed' {
 if (!this.ws) return 'closed';
 
 switch (this.ws.readyState) {
 case WebSocket.CONNECTING:
 return 'connecting';
 case WebSocket.OPEN:
 return 'open';
 case WebSocket.CLOSING:
 return 'closing';
 case WebSocket.CLOSED:
 default:
 return 'closed';
 }
 }

 // Private methods
 private buildWebSocketUrl(): string {
 const baseUrl = this.config.url;
 const url = new URL(baseUrl);
 
 // Convert HTTP(S) to WS(S)
 url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
 
 // Add authentication as query parameter if specified
 if (this.config.authentication.method === 'query' && this.config.authentication.token) {
 url.searchParams.set('token', this.config.authentication.token);
 }
 
 return url.toString();
 }

 private buildProtocols(): string[] {
 const protocols = Array.isArray(this.config.protocols) 
 ? [...this.config.protocols]
 : this.config.protocols ? [this.config.protocols] : [];

 // Add authentication as subprotocol if specified
 if (this.config.authentication.method === 'subprotocol' && this.config.authentication.token) {
 protocols.push(`backstage.auth.${this.config.authentication.token}`);
 }

 return protocols;
 }

 private handleMessage(message: WebSocketMessage): void {
 // Handle heartbeat pong
 if (message.type === 'pong') {
 this.clearHeartbeatTimeout();
 return;
 }

 // Handle subscription events
 if (message.type === 'event' && typeof message.payload === 'object' && message.payload) {
 const payload = message.payload as any;
 const subscriptionId = payload.subscriptionId;
 
 if (subscriptionId && this.handlers[subscriptionId]) {
 this.handlers[subscriptionId](message);
 }
 }

 // Call general message handler
 this.handlers.onMessage?.(message);
 }

 private sendSubscription(subscriptionId: string, options: SubscriptionOptions): void {
 this.send({
 type: 'subscribe',
 payload: {
 subscriptionId,
 ...options,
 },
 });
 }

 private resubscribeAll(): void {
 for (const [subscriptionId, options] of this.subscriptions) {
 this.sendSubscription(subscriptionId, options);
 }
 }

 private scheduleReconnect(): void {
 if (this.isReconnecting || this.isDestroyed) return;
 
 if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
 console.error('Max reconnect attempts reached');
 return;
 }

 this.isReconnecting = true;
 this.reconnectAttempts++;
 
 const delay = Math.min(
 this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
 30000 // Max 30 seconds
 );

 console.debug(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
 
 this.reconnectTimer = setTimeout(async () => {
 try {
 this.handlers.onReconnect?.(this.reconnectAttempts);
 await this.connect();
 } catch (error) {
 console.error('Reconnect failed:', error);
 this.scheduleReconnect();
 }
 }, delay);
 }

 private clearReconnectTimer(): void {
 if (this.reconnectTimer) {
 clearTimeout(this.reconnectTimer);
 this.reconnectTimer = null;
 }
 }

 private startHeartbeat(): void {
 this.stopHeartbeat();
 
 this.heartbeatTimer = setInterval(() => {
 if (this.isConnected()) {
 this.send({ type: 'ping', payload: {} });
 this.scheduleHeartbeatTimeout();
 }
 }, this.config.heartbeatInterval);
 }

 private stopHeartbeat(): void {
 if (this.heartbeatTimer) {
 clearInterval(this.heartbeatTimer);
 this.heartbeatTimer = null;
 }
 this.clearHeartbeatTimeout();
 }

 private scheduleHeartbeatTimeout(): void {
 this.clearHeartbeatTimeout();
 
 this.heartbeatTimeoutTimer = setTimeout(() => {
 console.warn('Heartbeat timeout - closing connection');
 this.ws?.close(1000, 'Heartbeat timeout');
 }, this.config.heartbeatTimeout);
 }

 private clearHeartbeatTimeout(): void {
 if (this.heartbeatTimeoutTimer) {
 clearTimeout(this.heartbeatTimeoutTimer);
 this.heartbeatTimeoutTimer = null;
 }
 }
}

// Create singleton WebSocket client
let backstageWebSocketClient: BackstageWebSocketClient | null = null;

export function createBackstageWebSocket(): BackstageWebSocketClient {
 if (!backstageWebSocketClient) {
 const wsUrl = `${API_ENDPOINTS.backstage.base.replace(/^http/, 'ws')}/events`;
 
 backstageWebSocketClient = new BackstageWebSocketClient({
 url: wsUrl,
 reconnect: true,
 reconnectInterval: 5000,
 maxReconnectAttempts: 10,
 heartbeatInterval: 30000,
 authentication: {
 method: 'header', // Will be handled by the base client
 },
 });

 // Handle page unload
 if (typeof window !== 'undefined') {
 window.addEventListener('beforeunload', () => {
 backstageWebSocketClient?.disconnect();
 });
 }
 }

 return backstageWebSocketClient;
}

export function getBackstageWebSocket(): BackstageWebSocketClient | null {
 return backstageWebSocketClient;
}

// Utility hook for easier WebSocket usage in React
export function useWebSocketConnection() {
 const ws = createBackstageWebSocket();
 
 return {
 ws,
 isConnected: ws.isConnected(),
 connectionState: ws.getConnectionState(),
 connect: (handlers?: WebSocketEventHandlers) => ws.connect(handlers),
 disconnect: () => ws.disconnect(),
 subscribe: (id: string, options: SubscriptionOptions, onEvent?: (event: WebSocketMessage) => void) => 
 ws.subscribe(id, options, onEvent),
 unsubscribe: (id: string) => ws.unsubscribe(id),
 subscribeToCatalogEvents: (entityRef?: string, onEvent?: (event: WebSocketMessage) => void) =>
 ws.subscribeToCatalogEvents(entityRef, onEvent),
 subscribeToTaskEvents: (taskId?: string, onEvent?: (event: WebSocketMessage) => void) =>
 ws.subscribeToTaskEvents(taskId, onEvent),
 subscribeToDocsEvents: (entityRef?: string, onEvent?: (event: WebSocketMessage) => void) =>
 ws.subscribeToDocsEvents(entityRef, onEvent),
 };
}