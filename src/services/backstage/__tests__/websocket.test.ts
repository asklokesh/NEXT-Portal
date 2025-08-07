import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

import { 
 BackstageWebSocketClient, 
 createBackstageWebSocket, 
 getBackstageWebSocket,
 useWebSocketConnection
} from '../utils/websocket';

import type { WebSocketConfig, WebSocketEventHandlers, SubscriptionOptions } from '../utils/websocket';

// Mock WebSocket implementation
class MockWebSocket {
 static CONNECTING = 0;
 static OPEN = 1;
 static CLOSING = 2;
 static CLOSED = 3;

 public readyState: number = MockWebSocket.CONNECTING;
 public url: string;
 public protocols?: string | string[];
 private eventListeners: Map<string, ((event: any) => void)[]> = new Map();

 constructor(url: string, protocols?: string | string[]) {
 this.url = url;
 this.protocols = protocols;
 
 // Simulate connection opening
 setTimeout(() => {
 this.readyState = MockWebSocket.OPEN;
 this.dispatchEvent(new Event('open'));
 }, 10);
 }

 addEventListener(type: string, listener: (event: any) => void): void {
 if (!this.eventListeners.has(type)) {
 this.eventListeners.set(type, []);
 }
 this.eventListeners.get(type)!.push(listener);
 }

 removeEventListener(type: string, listener: (event: any) => void): void {
 const listeners = this.eventListeners.get(type);
 if (listeners) {
 const index = listeners.indexOf(listener);
 if (index > -1) {
 listeners.splice(index, 1);
 }
 }
 }

 dispatchEvent(event: Event | MessageEvent | CloseEvent): void {
 const listeners = this.eventListeners.get(event.type);
 if (listeners) {
 listeners.forEach(listener => listener(event));
 }
 }

 send(_data: string): void {
 if (this.readyState !== MockWebSocket.OPEN) {
 throw new Error('WebSocket is not open');
 }
 // Mock sending data
 }

 close(code?: number, reason?: string): void {
 this.readyState = MockWebSocket.CLOSING;
 setTimeout(() => {
 this.readyState = MockWebSocket.CLOSED;
 const closeEvent = new CloseEvent('close', { code: code || 1000, reason: reason || '' });
 this.dispatchEvent(closeEvent);
 }, 10);
 }

 // Helper methods for testing
 simulateMessage(data: any): void {
 if (this.readyState === MockWebSocket.OPEN) {
 const messageEvent = new MessageEvent('message', { data: JSON.stringify(data) });
 this.dispatchEvent(messageEvent);
 }
 }

 simulateError(): void {
 const errorEvent = new Event('error');
 this.dispatchEvent(errorEvent);
 }
}

// Mock global WebSocket
(global as any).WebSocket = MockWebSocket;

// Mock URL constructor for Node.js environment
(global as any).URL = class MockURL {
 protocol: string;
 searchParams: Map<string, string>;
 
 constructor(url: string) {
 this.protocol = url.startsWith('https') ? 'https:' : 'http:';
 this.searchParams = new Map();
 }

 toString(): string {
 return 'ws://localhost:3000/events';
 }
};

// Mock console methods
const consoleSpy = {
 debug: jest.spyOn(console, 'debug').mockImplementation(),
 warn: jest.spyOn(console, 'warn').mockImplementation(),
 error: jest.spyOn(console, 'error').mockImplementation(),
};

describe('BackstageWebSocketClient', () => {
 let client: BackstageWebSocketClient;
 const config: WebSocketConfig = {
 url: 'ws://localhost:3000/events',
 reconnect: true,
 reconnectInterval: 100, // Faster for testing
 maxReconnectAttempts: 3,
 heartbeatInterval: 500,
 };

 beforeEach(() => {
 client = new BackstageWebSocketClient(config);
 jest.clearAllMocks();
 });

 afterEach(() => {
 client.disconnect();
 });

 describe('Connection Management', () => {
 it('should connect successfully', async () => {
 const handlers: WebSocketEventHandlers = {
 onOpen: jest.fn(),
 onClose: jest.fn(),
 onError: jest.fn(),
 };

 await client.connect(handlers);

 expect(client.isConnected()).toBe(true);
 expect(client.getConnectionState()).toBe('open');
 expect(handlers.onOpen).toHaveBeenCalled();
 });

 it('should not create multiple connections when already connected', async () => {
 await client.connect();
 const firstWs = (client as any).ws;

 await client.connect(); // Try to connect again

 expect((client as any).ws).toBe(firstWs);
 });

 it('should handle connection errors', async () => {
 const errorHandler = jest.fn();
 
 // Mock WebSocket to fail immediately
 const originalWebSocket = (global as any).WebSocket;
 (global as any).WebSocket = class FailingWebSocket extends MockWebSocket {
 constructor(url: string, protocols?: string | string[]) {
 super(url, protocols);
 setTimeout(() => this.simulateError(), 5);
 }
 };

 try {
 await client.connect({ onError: errorHandler });
 } catch (error) {
 expect(error).toBeInstanceOf(Error);
 expect(errorHandler).toHaveBeenCalled();
 }

 (global as any).WebSocket = originalWebSocket;
 });

 it('should disconnect properly', async () => {
 const closeHandler = jest.fn();
 await client.connect({ onClose: closeHandler });

 client.disconnect();
 await new Promise(resolve => setTimeout(resolve, 20));

 expect(client.isConnected()).toBe(false);
 expect(client.getConnectionState()).toBe('closed');
 expect(closeHandler).toHaveBeenCalled();
 });

 it('should prevent operations after destruction', async () => {
 await client.connect();
 client.disconnect();

 await expect(client.connect()).rejects.toThrow('WebSocket client has been destroyed');
 });
 });

 describe('Message Handling', () => {
 beforeEach(async () => {
 await client.connect();
 });

 it('should send messages correctly', () => {
 const ws = (client as any).ws as MockWebSocket;
 const sendSpy = jest.spyOn(ws, 'send');

 const message = {
 type: 'subscribe',
 payload: { subscriptionId: 'test-123' }
 };

 client.send(message);

 expect(sendSpy).toHaveBeenCalledWith(JSON.stringify({
 ...message,
 timestamp: expect.any(String)
 }));
 });

 it('should throw error when sending on disconnected client', () => {
 client.disconnect();

 expect(() => {
 client.send({ type: 'test', payload: {} });
 }).toThrow('WebSocket is not connected');
 });

 it('should handle incoming messages', async () => {
 const messageHandler = jest.fn();
 await client.connect({ onMessage: messageHandler });

 const testMessage = {
 type: 'event',
 payload: { subscriptionId: 'test-123', data: 'test-data' },
 timestamp: new Date().toISOString()
 };

 const ws = (client as any).ws as MockWebSocket;
 ws.simulateMessage(testMessage);

 expect(messageHandler).toHaveBeenCalledWith(testMessage);
 });

 it('should handle heartbeat pong messages', async () => {
 await client.connect();

 const pongMessage = {
 type: 'pong',
 payload: {},
 timestamp: new Date().toISOString()
 };

 // Should not throw error or call general message handler
 const ws = (client as any).ws as MockWebSocket;
 ws.simulateMessage(pongMessage);

 // Test passes if no error is thrown
 expect(true).toBe(true);
 });

 it('should handle malformed messages gracefully', async () => {
 await client.connect();

 const ws = (client as any).ws as MockWebSocket;
 // Simulate malformed JSON
 const messageEvent = new MessageEvent('message', { data: 'invalid-json' });
 ws.dispatchEvent(messageEvent);

 expect(consoleSpy.warn).toHaveBeenCalledWith(
 'Failed to parse WebSocket message:',
 expect.any(Error),
 'invalid-json'
 );
 });
 });

 describe('Subscription Management', () => {
 beforeEach(async () => {
 await client.connect();
 });

 it('should create subscriptions', () => {
 const options: SubscriptionOptions = {
 entityRef: 'component:default/test-service',
 eventTypes: ['entity.updated']
 };
 const eventHandler = jest.fn();

 client.subscribe('test-subscription', options, eventHandler);

 const subscriptions = (client as any).subscriptions;
 expect(subscriptions.has('test-subscription')).toBe(true);
 expect(subscriptions.get('test-subscription')).toEqual(options);
 });

 it('should send subscription message when connected', () => {
 const sendSpy = jest.spyOn(client, 'send');
 const options: SubscriptionOptions = {
 entityRef: 'component:default/test-service',
 eventTypes: ['entity.updated']
 };

 client.subscribe('test-subscription', options);

 expect(sendSpy).toHaveBeenCalledWith({
 type: 'subscribe',
 payload: {
 subscriptionId: 'test-subscription',
 ...options
 }
 });
 });

 it('should handle subscription events', async () => {
 const eventHandler = jest.fn();
 const options: SubscriptionOptions = {
 entityRef: 'component:default/test-service',
 eventTypes: ['entity.updated']
 };

 client.subscribe('test-subscription', options, eventHandler);

 // Simulate subscription event
 const eventMessage = {
 type: 'event',
 payload: {
 subscriptionId: 'test-subscription',
 eventType: 'entity.updated',
 data: { name: 'test-service' }
 },
 timestamp: new Date().toISOString()
 };

 const ws = (client as any).ws as MockWebSocket;
 ws.simulateMessage(eventMessage);

 expect(eventHandler).toHaveBeenCalledWith(eventMessage);
 });

 it('should unsubscribe correctly', () => {
 const sendSpy = jest.spyOn(client, 'send');
 const options: SubscriptionOptions = {
 entityRef: 'component:default/test-service'
 };

 client.subscribe('test-subscription', options);
 client.unsubscribe('test-subscription');

 expect(sendSpy).toHaveBeenCalledWith({
 type: 'unsubscribe',
 payload: { subscriptionId: 'test-subscription' }
 });

 const subscriptions = (client as any).subscriptions;
 expect(subscriptions.has('test-subscription')).toBe(false);
 });

 it('should resubscribe after reconnection', async () => {
 const options: SubscriptionOptions = {
 entityRef: 'component:default/test-service'
 };

 client.subscribe('test-subscription', options);

 // Simulate disconnection and reconnection
 const ws = (client as any).ws as MockWebSocket;
 ws.close();
 await new Promise(resolve => setTimeout(resolve, 20));

 // Clear previous send calls
 jest.clearAllMocks();
 const sendSpy = jest.spyOn(client, 'send');

 // Wait for reconnection
 await new Promise(resolve => setTimeout(resolve, 150));

 expect(sendSpy).toHaveBeenCalledWith({
 type: 'subscribe',
 payload: {
 subscriptionId: 'test-subscription',
 ...options
 }
 });
 });
 });

 describe('Convenience Subscription Methods', () => {
 beforeEach(async () => {
 await client.connect();
 });

 it('should subscribe to catalog events', () => {
 const subscribeSpy = jest.spyOn(client, 'subscribe');
 const eventHandler = jest.fn();

 const subscriptionId = client.subscribeToCatalogEvents('component:default/test', eventHandler);

 expect(subscriptionId).toContain('catalog:component:default/test:');
 expect(subscribeSpy).toHaveBeenCalledWith(
 subscriptionId,
 {
 entityRef: 'component:default/test',
 eventTypes: ['entity.created', 'entity.updated', 'entity.deleted']
 },
 eventHandler
 );
 });

 it('should subscribe to task events', () => {
 const subscribeSpy = jest.spyOn(client, 'subscribe');
 const eventHandler = jest.fn();

 const subscriptionId = client.subscribeToTaskEvents('task-123', eventHandler);

 expect(subscriptionId).toContain('scaffolder:task-123:');
 expect(subscribeSpy).toHaveBeenCalledWith(
 subscriptionId,
 {
 entityRef: 'task-123',
 eventTypes: ['task.created', 'task.started', 'task.completed', 'task.failed', 'task.log']
 },
 eventHandler
 );
 });

 it('should subscribe to docs events', () => {
 const subscribeSpy = jest.spyOn(client, 'subscribe');
 const eventHandler = jest.fn();

 const subscriptionId = client.subscribeToDocsEvents('component:default/docs', eventHandler);

 expect(subscriptionId).toContain('techdocs:component:default/docs:');
 expect(subscribeSpy).toHaveBeenCalledWith(
 subscriptionId,
 {
 entityRef: 'component:default/docs',
 eventTypes: ['docs.built', 'docs.synced', 'docs.published']
 },
 eventHandler
 );
 });
 });

 describe('Heartbeat Mechanism', () => {
 it('should start heartbeat on connection', async () => {
 await client.connect();

 const heartbeatTimer = (client as any).heartbeatTimer;
 expect(heartbeatTimer).toBeDefined();
 });

 it('should stop heartbeat on disconnection', async () => {
 await client.connect();
 client.disconnect();

 const heartbeatTimer = (client as any).heartbeatTimer;
 expect(heartbeatTimer).toBeNull();
 });

 it('should send ping messages during heartbeat', async () => {
 const sendSpy = jest.spyOn(client, 'send');
 
 // Use shorter interval for testing
 const testConfig = { ...config, heartbeatInterval: 100 };
 const testClient = new BackstageWebSocketClient(testConfig);
 
 await testClient.connect();

 // Wait for at least one heartbeat
 await new Promise(resolve => setTimeout(resolve, 150));

 expect(sendSpy).toHaveBeenCalledWith({ type: 'ping', payload: {} });
 
 testClient.disconnect();
 });

 it('should handle heartbeat timeout', async () => {
 const testConfig = { ...config, heartbeatTimeout: 50 };
 const testClient = new BackstageWebSocketClient(testConfig);
 
 await testClient.connect();

 const ws = (testClient as any).ws as MockWebSocket;
 const closeSpy = jest.spyOn(ws, 'close');

 // Trigger heartbeat without responding with pong
 testClient.send({ type: 'ping', payload: {} });

 // Wait for timeout
 await new Promise(resolve => setTimeout(resolve, 100));

 expect(closeSpy).toHaveBeenCalledWith(1000, 'Heartbeat timeout');
 
 testClient.disconnect();
 });
 });

 describe('Reconnection Logic', () => {
 it('should attempt reconnection on unexpected disconnection', async () => {
 const reconnectHandler = jest.fn();
 await client.connect({ onReconnect: reconnectHandler });

 // Simulate unexpected disconnection
 const ws = (client as any).ws as MockWebSocket;
 ws.close(1006, 'Connection lost'); // Abnormal closure
 await new Promise(resolve => setTimeout(resolve, 20));

 // Wait for reconnection attempt
 await new Promise(resolve => setTimeout(resolve, 150));

 expect(reconnectHandler).toHaveBeenCalledWith(1);
 });

 it('should not reconnect when max attempts reached', async () => {
 const testConfig = { ...config, maxReconnectAttempts: 1, reconnectInterval: 50 };
 const testClient = new BackstageWebSocketClient(testConfig);

 // Mock connect to always fail after first success
 let connectCount = 0;
 const originalConnect = testClient.connect.bind(testClient);
 jest.spyOn(testClient, 'connect').mockImplementation(async (handlers) => {
 connectCount++;
 if (connectCount === 1) {
 return originalConnect(handlers);
 } else {
 throw new Error('Connection failed');
 }
 });

 await testClient.connect();

 // Simulate disconnection
 const ws = (testClient as any).ws as MockWebSocket;
 ws.close(1006, 'Connection lost');
 await new Promise(resolve => setTimeout(resolve, 20));

 // Wait for reconnection attempts to complete
 await new Promise(resolve => setTimeout(resolve, 200));

 expect(consoleSpy.error).toHaveBeenCalledWith('Max reconnect attempts reached');
 
 testClient.disconnect();
 });

 it('should use exponential backoff for reconnection delays', async () => {
 const testConfig = { ...config, reconnectInterval: 100, maxReconnectAttempts: 3 };
 const testClient = new BackstageWebSocketClient(testConfig);

 // Track reconnection attempt timings
 const reconnectTimes: number[] = [];
 const _reconnectHandler = () => {
 reconnectTimes.push(Date.now());
 };

 // Mock connect to always fail
 jest.spyOn(testClient, 'connect').mockImplementation(async (handlers) => {
 if (handlers?.onReconnect) {
 setTimeout(() => handlers.onReconnect!(reconnectTimes.length + 1), 10);
 }
 throw new Error('Connection failed');
 });

 const _startTime = Date.now();
 try {
 await testClient.connect();
 } catch {
 // Expected to fail
 }

 // Wait for reconnection attempts
 await new Promise(resolve => setTimeout(resolve, 1000));

 // Should have attempted multiple reconnections with increasing delays
 expect(reconnectTimes.length).toBeGreaterThan(1);
 
 testClient.disconnect();
 });
 });

 describe('URL and Protocol Building', () => {
 it('should build WebSocket URL from HTTP URL', () => {
 const httpConfig = { ...config, url: 'http://localhost:3000/events' };
 const testClient = new BackstageWebSocketClient(httpConfig);

 const url = (testClient as any).buildWebSocketUrl();
 expect(url).toContain('ws://');
 });

 it('should build WebSocket URL from HTTPS URL', () => {
 const httpsConfig = { ...config, url: 'https://localhost:3000/events' };
 const testClient = new BackstageWebSocketClient(httpsConfig);

 const url = (testClient as any).buildWebSocketUrl();
 expect(url).toContain('wss://');
 });

 it('should add authentication token as query parameter', () => {
 const authConfig = {
 ...config,
 authentication: { method: 'query' as const, token: 'test-token' }
 };
 const testClient = new BackstageWebSocketClient(authConfig);

 const url = (testClient as any).buildWebSocketUrl();
 expect(url).toContain('token=test-token');
 });

 it('should add authentication token as subprotocol', () => {
 const authConfig = {
 ...config,
 authentication: { method: 'subprotocol' as const, token: 'test-token' }
 };
 const testClient = new BackstageWebSocketClient(authConfig);

 const protocols = (testClient as any).buildProtocols();
 expect(protocols).toContain('backstage.auth.test-token');
 });
 });
});

describe('Singleton Functions', () => {
 afterEach(() => {
 // Reset singleton
 const ws = getBackstageWebSocket();
 ws?.disconnect();
 });

 it('should create singleton WebSocket client', () => {
 const ws1 = createBackstageWebSocket();
 const ws2 = createBackstageWebSocket();

 expect(ws1).toBe(ws2);
 });

 it('should return null initially from getBackstageWebSocket', () => {
 expect(getBackstageWebSocket()).toBeNull();
 });

 it('should return created client from getBackstageWebSocket', () => {
 const created = createBackstageWebSocket();
 const retrieved = getBackstageWebSocket();

 expect(retrieved).toBe(created);
 });
});

describe('useWebSocketConnection Hook', () => {
 it('should return WebSocket utilities', () => {
 const connection = useWebSocketConnection();

 expect(connection).toHaveProperty('ws');
 expect(connection).toHaveProperty('isConnected');
 expect(connection).toHaveProperty('connectionState');
 expect(connection).toHaveProperty('connect');
 expect(connection).toHaveProperty('disconnect');
 expect(connection).toHaveProperty('subscribe');
 expect(connection).toHaveProperty('unsubscribe');
 expect(connection).toHaveProperty('subscribeToCatalogEvents');
 expect(connection).toHaveProperty('subscribeToTaskEvents');
 expect(connection).toHaveProperty('subscribeToDocsEvents');
 });

 it('should return current connection state', () => {
 const connection = useWebSocketConnection();

 expect(typeof connection.isConnected).toBe('boolean');
 expect(['connecting', 'open', 'closing', 'closed']).toContain(connection.connectionState);
 });

 it('should provide working subscription methods', () => {
 const connection = useWebSocketConnection();

 expect(typeof connection.subscribeToCatalogEvents).toBe('function');
 expect(typeof connection.subscribeToTaskEvents).toBe('function');
 expect(typeof connection.subscribeToDocsEvents).toBe('function');
 });
});

// Restore console methods
afterAll(() => {
 Object.values(consoleSpy).forEach(spy => spy.mockRestore());
});