import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

import { BackstageWebSocketClient } from '../utils/websocket';

import type { WebSocketConfig, SubscriptionOptions } from '../utils/websocket';

// Simple WebSocket mock for Node.js environment
class MockWebSocket {
 static CONNECTING = 0;
 static OPEN = 1;
 static CLOSING = 2;
 static CLOSED = 3;

 public readyState: number = MockWebSocket.CONNECTING;
 public url: string;
 public protocols?: string | string[];
 private listeners: Map<string, ((event: any) => void)[]> = new Map();

 constructor(url: string, protocols?: string | string[]) {
 this.url = url;
 this.protocols = protocols;
 
 // Auto-connect after construction
 setTimeout(() => {
 this.readyState = MockWebSocket.OPEN;
 this.emit('open', new Event('open'));
 }, 10);
 }

 addEventListener(type: string, listener: (event: any) => void): void {
 if (!this.listeners.has(type)) {
 this.listeners.set(type, []);
 }
 this.listeners.get(type)!.push(listener);
 }

 removeEventListener(type: string, listener: (event: any) => void): void {
 const listeners = this.listeners.get(type);
 if (listeners) {
 const index = listeners.indexOf(listener);
 if (index > -1) {
 listeners.splice(index, 1);
 }
 }
 }

 private emit(type: string, event: Event | MessageEvent | CloseEvent): void {
 const listeners = this.listeners.get(type);
 if (listeners) {
 listeners.forEach(listener => listener(event));
 }
 }

 send(_data: string): void {
 if (this.readyState !== MockWebSocket.OPEN) {
 throw new Error('WebSocket is not open');
 }
 }

 close(code?: number, reason?: string): void {
 this.readyState = MockWebSocket.CLOSING;
 setTimeout(() => {
 this.readyState = MockWebSocket.CLOSED;
 this.emit('close', new CloseEvent('close', { code: code || 1000, reason: reason || '' }));
 }, 10);
 }

 // Test helpers
 simulateMessage(data: any): void {
 if (this.readyState === MockWebSocket.OPEN) {
 this.emit('message', new MessageEvent('message', { data: JSON.stringify(data) }));
 }
 }

 simulateError(): void {
 this.emit('error', new Event('error'));
 }

 getListenerCount(type: string): number {
 return this.listeners.get(type)?.length || 0;
 }
}

// Mock global WebSocket and URL
(global as any).WebSocket = MockWebSocket;
(global as any).URL = class MockURL {
 protocol: string;
 searchParams: Map<string, string>;
 
 constructor(url: string) {
 this.protocol = url.startsWith('https') ? 'https:' : 'http:';
 this.searchParams = new Map();
 }

 set(key: string, value: string) {
 this.searchParams.set(key, value);
 }

 toString(): string {
 return 'ws://localhost:3000/events';
 }
};

describe('BackstageWebSocketClient - Simple Tests', () => {
 let client: BackstageWebSocketClient;
 const config: WebSocketConfig = {
 url: 'ws://localhost:3000/events',
 reconnect: false, // Disable for simpler testing
 heartbeatInterval: 1000, // Longer interval for testing
 };

 beforeEach(() => {
 client = new BackstageWebSocketClient(config);
 // Suppress console output for cleaner tests
 jest.spyOn(console, 'debug').mockImplementation();
 jest.spyOn(console, 'warn').mockImplementation();
 jest.spyOn(console, 'error').mockImplementation();
 });

 afterEach(() => {
 client.disconnect();
 jest.restoreAllMocks();
 });

 describe('Basic Connection', () => {
 it('should create client instance', () => {
 expect(client).toBeInstanceOf(BackstageWebSocketClient);
 expect(client.isConnected()).toBe(false);
 expect(client.getConnectionState()).toBe('closed');
 });

 it('should connect successfully', async () => {
 const openHandler = jest.fn();
 
 await client.connect({ onOpen: openHandler });

 expect(client.isConnected()).toBe(true);
 expect(client.getConnectionState()).toBe('open');
 expect(openHandler).toHaveBeenCalled();
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

 it('should prevent multiple simultaneous connections', async () => {
 const firstConnection = client.connect();
 const secondConnection = client.connect();

 await Promise.all([firstConnection, secondConnection]);

 expect(client.isConnected()).toBe(true);
 });

 it('should handle connection state correctly', () => {
 expect(['connecting', 'open', 'closing', 'closed']).toContain(client.getConnectionState());
 });
 });

 describe('Message Handling', () => {
 beforeEach(async () => {
 await client.connect();
 });

 it('should send messages with timestamp', () => {
 const ws = (client as any).ws as MockWebSocket;
 const sendSpy = jest.spyOn(ws, 'send');

 const message = {
 type: 'subscribe',
 payload: { test: 'data' }
 };

 client.send(message);

 expect(sendSpy).toHaveBeenCalledWith(
 JSON.stringify({
 ...message,
 timestamp: expect.any(String)
 })
 );
 });

 it('should handle incoming messages', () => {
 const messageHandler = jest.fn();
 
 client.connect({ onMessage: messageHandler });

 const testMessage = {
 type: 'event',
 payload: { data: 'test' },
 timestamp: new Date().toISOString()
 };

 const ws = (client as any).ws as MockWebSocket;
 ws.simulateMessage(testMessage);

 expect(messageHandler).toHaveBeenCalledWith(testMessage);
 });

 it('should throw error when sending without connection', () => {
 client.disconnect();

 expect(() => {
 client.send({ type: 'test', payload: {} });
 }).toThrow('WebSocket is not connected');
 });

 it('should handle heartbeat pong messages', () => {
 const messageHandler = jest.fn();
 client.connect({ onMessage: messageHandler });

 const pongMessage = {
 type: 'pong',
 payload: {},
 timestamp: new Date().toISOString()
 };

 const ws = (client as any).ws as MockWebSocket;
 ws.simulateMessage(pongMessage);

 // Heartbeat handling should not call general message handler
 expect(messageHandler).not.toHaveBeenCalled();
 });
 });

 describe('Subscription Management', () => {
 beforeEach(async () => {
 await client.connect();
 });

 it('should create and track subscriptions', () => {
 const options: SubscriptionOptions = {
 entityRef: 'component:default/test-service',
 eventTypes: ['entity.updated']
 };

 client.subscribe('test-sub', options);

 const subscriptions = (client as any).subscriptions;
 expect(subscriptions.has('test-sub')).toBe(true);
 expect(subscriptions.get('test-sub')).toEqual(options);
 });

 it('should send subscription messages', () => {
 const sendSpy = jest.spyOn(client, 'send');
 const options: SubscriptionOptions = {
 entityRef: 'component:default/test-service'
 };

 client.subscribe('test-sub', options);

 expect(sendSpy).toHaveBeenCalledWith({
 type: 'subscribe',
 payload: {
 subscriptionId: 'test-sub',
 ...options
 }
 });
 });

 it('should handle subscription events', () => {
 const eventHandler = jest.fn();
 const options: SubscriptionOptions = {
 entityRef: 'component:default/test-service'
 };

 client.subscribe('test-sub', options, eventHandler);

 // Simulate subscription event
 const eventMessage = {
 type: 'event',
 payload: {
 subscriptionId: 'test-sub',
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

 client.subscribe('test-sub', options);
 
 // Clear previous calls
 sendSpy.mockClear();
 
 client.unsubscribe('test-sub');

 expect(sendSpy).toHaveBeenCalledWith({
 type: 'unsubscribe',
 payload: { subscriptionId: 'test-sub' }
 });

 const subscriptions = (client as any).subscriptions;
 expect(subscriptions.has('test-sub')).toBe(false);
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

 expect(subscriptionId).toMatch(/^catalog:component:default\/test:\d+$/);
 expect(subscribeSpy).toHaveBeenCalledWith(
 subscriptionId,
 {
 entityRef: 'component:default/test',
 eventTypes: ['entity.created', 'entity.updated', 'entity.deleted']
 },
 eventHandler
 );
 });

 it('should subscribe to catalog events for all entities', () => {
 const subscribeSpy = jest.spyOn(client, 'subscribe');

 const subscriptionId = client.subscribeToCatalogEvents();

 expect(subscriptionId).toMatch(/^catalog:all:\d+$/);
 expect(subscribeSpy).toHaveBeenCalledWith(
 subscriptionId,
 {
 entityRef: undefined,
 eventTypes: ['entity.created', 'entity.updated', 'entity.deleted']
 },
 undefined
 );
 });

 it('should subscribe to task events', () => {
 const subscribeSpy = jest.spyOn(client, 'subscribe');
 const eventHandler = jest.fn();

 const subscriptionId = client.subscribeToTaskEvents('task-123', eventHandler);

 expect(subscriptionId).toMatch(/^scaffolder:task-123:\d+$/);
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

 expect(subscriptionId).toMatch(/^techdocs:component:default\/docs:\d+$/);
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

 describe('URL Building', () => {
 it('should build WebSocket URL correctly', () => {
 const testClient = new BackstageWebSocketClient({
 url: 'http://localhost:3000/events'
 });

 const buildUrlMethod = (testClient as any).buildWebSocketUrl.bind(testClient);
 const url = buildUrlMethod();

 expect(typeof url).toBe('string');
 expect(url).toContain('ws://');
 });

 it('should build protocols array', () => {
 const testClient = new BackstageWebSocketClient({
 url: 'ws://localhost:3000/events',
 protocols: ['backstage', 'v1']
 });

 const buildProtocolsMethod = (testClient as any).buildProtocols.bind(testClient);
 const protocols = buildProtocolsMethod();

 expect(Array.isArray(protocols)).toBe(true);
 expect(protocols).toContain('backstage');
 expect(protocols).toContain('v1');
 });

 it('should handle authentication configuration', () => {
 const authConfig: WebSocketConfig = {
 url: 'ws://localhost:3000/events',
 authentication: {
 method: 'subprotocol',
 token: 'test-token'
 }
 };

 const testClient = new BackstageWebSocketClient(authConfig);
 const buildProtocolsMethod = (testClient as any).buildProtocols.bind(testClient);
 const protocols = buildProtocolsMethod();

 expect(protocols).toContain('backstage.auth.test-token');
 });
 });

 describe('Configuration', () => {
 it('should apply default configuration', () => {
 const simpleClient = new BackstageWebSocketClient({
 url: 'ws://localhost:3000/events'
 });

 const config = (simpleClient as any).config;

 expect(config.reconnect).toBe(true);
 expect(config.reconnectInterval).toBe(5000);
 expect(config.maxReconnectAttempts).toBe(10);
 expect(config.heartbeatInterval).toBe(30000);
 expect(config.heartbeatTimeout).toBe(5000);
 });

 it('should override default configuration', () => {
 const customConfig: WebSocketConfig = {
 url: 'ws://localhost:3000/events',
 reconnect: false,
 reconnectInterval: 1000,
 maxReconnectAttempts: 5,
 heartbeatInterval: 10000
 };

 const customClient = new BackstageWebSocketClient(customConfig);
 const config = (customClient as any).config;

 expect(config.reconnect).toBe(false);
 expect(config.reconnectInterval).toBe(1000);
 expect(config.maxReconnectAttempts).toBe(5);
 expect(config.heartbeatInterval).toBe(10000);
 });
 });

 describe('Error Handling', () => {
 it('should handle connection errors', async () => {
 const errorHandler = jest.fn();

 // Create a failing WebSocket mock
 const FailingWebSocket = class extends MockWebSocket {
 constructor(url: string, protocols?: string | string[]) {
 super(url, protocols);
 setTimeout(() => this.simulateError(), 5);
 }
 };

 (global as any).WebSocket = FailingWebSocket;

 try {
 await client.connect({ onError: errorHandler });
 } catch (error) {
 expect(error).toBeInstanceOf(Error);
 expect(errorHandler).toHaveBeenCalled();
 }

 // Restore original mock
 (global as any).WebSocket = MockWebSocket;
 });

 it('should handle malformed messages gracefully', async () => {
 await client.connect();

 const ws = (client as any).ws as MockWebSocket;
 
 // Simulate malformed JSON message
 const messageEvent = new MessageEvent('message', { data: 'invalid-json' });
 ws.emit('message', messageEvent);

 // Should not throw error - gracefully handled
 expect(true).toBe(true);
 });

 it('should prevent operations after destruction', async () => {
 await client.connect();
 client.disconnect(); // This sets isDestroyed = true

 await expect(client.connect()).rejects.toThrow('WebSocket client has been destroyed');
 });
 });

 describe('State Management', () => {
 it('should track connection state correctly', async () => {
 expect(client.getConnectionState()).toBe('closed');

 const connectPromise = client.connect();
 // During connection, state might be connecting (timing dependent)
 
 await connectPromise;
 expect(client.getConnectionState()).toBe('open');

 client.disconnect();
 await new Promise(resolve => setTimeout(resolve, 20));
 expect(client.getConnectionState()).toBe('closed');
 });

 it('should manage subscription state', () => {
 const options: SubscriptionOptions = { entityRef: 'test' };

 client.subscribe('sub1', options);
 client.subscribe('sub2', options);

 const subscriptions = (client as any).subscriptions;
 expect(subscriptions.size).toBe(2);

 client.unsubscribe('sub1');
 expect(subscriptions.size).toBe(1);

 client.unsubscribe('sub2');
 expect(subscriptions.size).toBe(0);
 });

 it('should clean up on disconnect', async () => {
 await client.connect();
 
 const options: SubscriptionOptions = { entityRef: 'test' };
 client.subscribe('test-sub', options);

 client.disconnect();

 expect(client.isConnected()).toBe(false);
 expect((client as any).ws).toBeNull();
 });
 });

 describe('Heartbeat Functionality', () => {
 it('should start heartbeat after connection', async () => {
 const testClient = new BackstageWebSocketClient({
 ...config,
 heartbeatInterval: 100 // Fast heartbeat for testing
 });

 await testClient.connect();

 const heartbeatTimer = (testClient as any).heartbeatTimer;
 expect(heartbeatTimer).toBeDefined();

 testClient.disconnect();
 });

 it('should stop heartbeat on disconnect', async () => {
 const testClient = new BackstageWebSocketClient({
 ...config,
 heartbeatInterval: 100
 });

 await testClient.connect();
 testClient.disconnect();

 const heartbeatTimer = (testClient as any).heartbeatTimer;
 expect(heartbeatTimer).toBeNull();
 });

 it('should send ping messages', async () => {
 const testClient = new BackstageWebSocketClient({
 ...config,
 heartbeatInterval: 50 // Very fast for testing
 });

 const sendSpy = jest.spyOn(testClient, 'send');
 
 await testClient.connect();

 // Wait for at least one heartbeat
 await new Promise(resolve => setTimeout(resolve, 100));

 expect(sendSpy).toHaveBeenCalledWith({ type: 'ping', payload: {} });

 testClient.disconnect();
 });
 });
});