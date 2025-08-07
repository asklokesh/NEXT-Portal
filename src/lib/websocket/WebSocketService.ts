import { toast } from 'react-hot-toast';
import { mockWebSocketServer } from './mockServer';

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
 level: 'info' | 'warning' | 'error';
 message: string;
 timestamp: string;
 };
}

type MessageHandler = (message: WebSocketMessage) => void;

class WebSocketService {
 private ws: WebSocket | null = null;
 private reconnectAttempts = 0;
 private maxReconnectAttempts = 5;
 private reconnectDelay = 1000;
 private messageHandlers: Map<string, Set<MessageHandler>> = new Map();
 private isConnected = false;
 private connectionUrl: string;
 private heartbeatInterval: NodeJS.Timeout | null = null;

 constructor() {
 this.connectionUrl = this.getWebSocketUrl();
 }

 private getWebSocketUrl(): string {
 if (typeof window === 'undefined') return '';
 
 // In development mode, we'll simulate WebSocket connection
 if (process.env.NODE_ENV === 'development') {
 return 'mock://websocket';
 }
 
 const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
 const host = window.location.host;
 
 // In production, use the actual WebSocket server
 const wsPort = process.env.WEBSOCKET_PORT || '';
 const wsHost = wsPort ? `${window.location.hostname}:${wsPort}` : host;
 
 return `${protocol}//${wsHost}/ws`;
 }

 connect(): Promise<void> {
 return new Promise((resolve, reject) => {
 if (this.ws?.readyState === WebSocket.OPEN) {
 resolve();
 return;
 }

 try {
 // In development mode, simulate WebSocket connection
 if (this.connectionUrl === 'mock://websocket') {
 this.simulateMockConnection(resolve, reject);
 return;
 }

 this.ws = new WebSocket(this.connectionUrl);

 this.ws.onopen = () => {
 console.log('WebSocket connected');
 this.isConnected = true;
 this.reconnectAttempts = 0;
 this.startHeartbeat();
 
 // Send authentication if needed
 this.send({
 type: 'auth',
 data: {
 token: this.getAuthToken()
 },
 timestamp: new Date().toISOString()
 });

 resolve();
 };

 this.ws.onmessage = (event) => {
 try {
 const message: WebSocketMessage = JSON.parse(event.data);
 this.handleMessage(message);
 } catch (error) {
 console.error('Failed to parse WebSocket message:', error);
 }
 };

 this.ws.onclose = (event) => {
 console.log('WebSocket disconnected:', event.code, event.reason);
 this.isConnected = false;
 this.stopHeartbeat();
 
 if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
 this.scheduleReconnect();
 }
 };

 this.ws.onerror = (error) => {
 console.error('WebSocket error:', error);
 reject(error);
 };

 } catch (error) {
 console.error('Failed to create WebSocket connection:', error);
 reject(error);
 }
 });
 }

 private simulateMockConnection(resolve: () => void, reject: (error: any) => void): void {
 // Create a mock WebSocket-like object
 const mockWs = {
 readyState: 1, // OPEN
 send: (data: string) => {
 try {
 const message = JSON.parse(data);
 console.log('Mock WebSocket sending:', message);
 
 // Simulate responses
 setTimeout(() => {
 if (message.type === 'ping') {
 this.handleMessage({
 type: 'pong',
 data: {},
 timestamp: new Date().toISOString()
 });
 }
 }, 100);
 } catch (error) {
 console.error('Error handling mock WebSocket message:', error);
 }
 },
 close: () => {
 this.isConnected = false;
 console.log('Mock WebSocket closed');
 }
 };

 // Store the mock WebSocket
 this.ws = mockWs as any;
 this.isConnected = true;

 console.log('Mock WebSocket connected');
 this.startHeartbeat();

 // Start the mock server if not already started
 if (!mockWebSocketServer.clients.size) {
 mockWebSocketServer.start();
 }

 // Simulate periodic updates
 this.startMockUpdates();

 resolve();
 }

 private startMockUpdates(): void {
 // Simulate receiving messages from the mock server
 const updateInterval = setInterval(() => {
 if (!this.isConnected) {
 clearInterval(updateInterval);
 return;
 }

 // Simulate different types of updates
 const updateTypes = ['metrics_update', 'entity_update', 'health_update', 'deployment_update'];
 const randomType = updateTypes[Math.floor(Math.random() * updateTypes.length)];

 switch (randomType) {
 case 'metrics_update':
 this.handleMessage({
 type: 'metrics_update',
 data: {
 entityRef: 'Component:default/user-service',
 metrics: {
 cpu: Math.random() * 100,
 memory: Math.random() * 100,
 requests: Math.floor(Math.random() * 1000) + 100,
 errors: Math.floor(Math.random() * 10),
 responseTime: Math.random() * 300 + 50
 }
 },
 timestamp: new Date().toISOString()
 });
 break;

 case 'entity_update':
 if (Math.random() > 0.8) { // Less frequent
 this.handleMessage({
 type: 'catalog_update',
 data: {
 kind: 'Component',
 namespace: 'default',
 name: 'test-service',
 changeType: 'updated',
 data: {
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'Component',
 metadata: {
 name: 'test-service',
 namespace: 'default',
 title: 'Test Service',
 description: `Updated at ${new Date().toLocaleTimeString()}`
 },
 spec: {
 type: 'service',
 lifecycle: 'production',
 owner: 'platform-team'
 }
 }
 },
 timestamp: new Date().toISOString()
 });
 }
 break;
 }
 }, 3000); // Every 3 seconds
 }

 disconnect(): void {
 this.stopHeartbeat();
 if (this.ws) {
 this.ws.close(1000, 'Client disconnect');
 this.ws = null;
 }
 this.isConnected = false;
 }

 private scheduleReconnect(): void {
 this.reconnectAttempts++;
 const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
 
 console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
 
 setTimeout(() => {
 if (!this.isConnected) {
 this.connect().catch(error => {
 console.error('Reconnection failed:', error);
 });
 }
 }, delay);
 }

 private startHeartbeat(): void {
 this.heartbeatInterval = setInterval(() => {
 if (this.isConnected) {
 this.send({
 type: 'ping',
 data: {},
 timestamp: new Date().toISOString()
 });
 }
 }, 30000); // Send ping every 30 seconds
 }

 private stopHeartbeat(): void {
 if (this.heartbeatInterval) {
 clearInterval(this.heartbeatInterval);
 this.heartbeatInterval = null;
 }
 }

 private getAuthToken(): string | null {
 // In a real implementation, get from auth context or localStorage
 return localStorage.getItem('backstage_token') || null;
 }

 send(message: Omit<WebSocketMessage, 'timestamp'> & { timestamp?: string }): void {
 if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
 console.warn('WebSocket not connected, message not sent:', message);
 return;
 }

 const fullMessage: WebSocketMessage = {
 ...message,
 timestamp: message.timestamp || new Date().toISOString()
 };

 this.ws.send(JSON.stringify(fullMessage));
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

 // Handle system messages
 switch (message.type) {
 case 'error':
 console.error('WebSocket server error:', message.data);
 toast.error(`Server error: ${message.data.message || 'Unknown error'}`);
 break;
 case 'pong':
 // Heartbeat response - connection is alive
 break;
 case 'connected':
 toast.success('Real-time updates connected');
 break;
 case 'disconnected':
 toast.error('Real-time updates disconnected');
 break;
 }
 }

 // Entity-specific subscription methods
 subscribeToEntityUpdates(handler: (update: EntityUpdate) => void): () => void {
 return this.subscribe('entity_update', (message) => {
 handler(message.data as EntityUpdate);
 });
 }

 subscribeToMetricsUpdates(entityRef: string, handler: (update: MetricsUpdate) => void): () => void {
 // Send subscription request
 this.send({
 type: 'subscribe_metrics',
 entityRef,
 data: { entityRef }
 });

 return this.subscribe('metrics_update', (message) => {
 const update = message.data as MetricsUpdate;
 if (update.entityRef === entityRef) {
 handler(update);
 }
 });
 }

 subscribeToDeploymentUpdates(entityRef: string, handler: (update: DeploymentUpdate) => void): () => void {
 this.send({
 type: 'subscribe_deployments',
 entityRef,
 data: { entityRef }
 });

 return this.subscribe('deployment_update', (message) => {
 const update = message.data as DeploymentUpdate;
 if (update.entityRef === entityRef) {
 handler(update);
 }
 });
 }

 subscribeToHealthUpdates(entityRef: string, handler: (update: HealthUpdate) => void): () => void {
 this.send({
 type: 'subscribe_health',
 entityRef,
 data: { entityRef }
 });

 return this.subscribe('health_update', (message) => {
 const update = message.data as HealthUpdate;
 if (update.entityRef === entityRef) {
 handler(update);
 }
 });
 }

 subscribeToCatalogUpdates(handler: (update: EntityUpdate) => void): () => void {
 this.send({
 type: 'subscribe_catalog',
 data: {}
 });

 return this.subscribe('catalog_update', (message) => {
 handler(message.data as EntityUpdate);
 });
 }

 // Generic subscription method
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

 // Connection status
 isWebSocketConnected(): boolean {
 return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
 }

 getConnectionState(): 'connecting' | 'connected' | 'disconnected' | 'error' {
 if (!this.ws) return 'disconnected';
 
 switch (this.ws.readyState) {
 case WebSocket.CONNECTING:
 return 'connecting';
 case WebSocket.OPEN:
 return 'connected';
 case WebSocket.CLOSING:
 case WebSocket.CLOSED:
 return 'disconnected';
 default:
 return 'error';
 }
 }
}

// Export singleton instance
export const webSocketService = new WebSocketService();

// Also export Socket.IO service for better WebSocket support
export { socketIOService } from './SocketIOService';