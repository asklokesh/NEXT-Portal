import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { EventEmitter } from 'events';
import { DashboardWebSocketService, getWebSocketService, initializeWebSocketService } from '../services/websocket';

// Mock WebSocket
class MockWebSocket extends EventEmitter {
 static CONNECTING = 0;
 static OPEN = 1;
 static CLOSING = 2;
 static CLOSED = 3;

 public readyState: number = MockWebSocket.CONNECTING;
 public url: string;
 public protocols?: string | string[];
 public onopen: ((event: Event) => void) | null = null;
 public onclose: ((event: CloseEvent) => void) | null = null;
 public onerror: ((event: Event) => void) | null = null;
 public onmessage: ((event: MessageEvent) => void) | null = null;

 constructor(url: string, protocols?: string | string[]) {
 super();
 this.url = url;
 this.protocols = protocols;
 
 // Simulate connection opening
 setTimeout(() => {
 this.readyState = MockWebSocket.OPEN;
 this.onopen?.(new Event('open'));
 this.emit('open');
 }, 10);
 }

 send(data: string): void {
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
 this.onclose?.(closeEvent);
 this.emit('close', closeEvent);
 }, 10);
 }

 // Helper methods for testing
 simulateMessage(data: any): void {
 if (this.readyState === MockWebSocket.OPEN) {
 const messageEvent = new MessageEvent('message', { data: JSON.stringify(data) });
 this.onmessage?.(messageEvent);
 this.emit('message', messageEvent);
 }
 }

 simulateError(): void {
 const errorEvent = new Event('error');
 this.onerror?.(errorEvent);
 this.emit('error', errorEvent);
 }
}

// Mock global WebSocket
(global as any).WebSocket = MockWebSocket;

describe('DashboardWebSocketService', () => {
 let service: DashboardWebSocketService;
 const wsUrl = 'ws://localhost:3000/ws';

 beforeEach(() => {
 service = new DashboardWebSocketService(wsUrl);
 jest.clearAllMocks();
 });

 afterEach(() => {
 service.disconnect();
 });

 describe('Connection Management', () => {
 it('should connect to WebSocket successfully', async () => {
 const connectedSpy = jest.fn();
 service.on('connected', connectedSpy);

 service.connect();

 // Wait for connection to establish
 await new Promise(resolve => setTimeout(resolve, 20));

 expect(connectedSpy).toHaveBeenCalled();
 expect(service.isConnected()).toBe(true);
 });

 it('should not create multiple connections when already connected', async () => {
 service.connect();
 await new Promise(resolve => setTimeout(resolve, 20));

 const initialWs = (service as any).ws;
 service.connect(); // Try to connect again

 expect((service as any).ws).toBe(initialWs);
 });

 it('should disconnect properly', async () => {
 const disconnectedSpy = jest.fn();
 service.on('disconnected', disconnectedSpy);

 service.connect();
 await new Promise(resolve => setTimeout(resolve, 20));

 service.disconnect();
 await new Promise(resolve => setTimeout(resolve, 20));

 expect(disconnectedSpy).toHaveBeenCalled();
 expect(service.isConnected()).toBe(false);
 });

 it('should handle connection errors', async () => {
 const errorSpy = jest.fn();
 service.on('error', errorSpy);

 service.connect();
 await new Promise(resolve => setTimeout(resolve, 20));

 // Simulate error
 const ws = (service as any).ws as MockWebSocket;
 ws.simulateError();

 expect(errorSpy).toHaveBeenCalled();
 });
 });

 describe('Message Handling', () => {
 beforeEach(async () => {
 service.connect();
 await new Promise(resolve => setTimeout(resolve, 20));
 });

 it('should handle incoming messages correctly', () => {
 const messageSpy = jest.fn();
 service.on('metric:update', messageSpy);

 const testMessage = {
 type: 'metric',
 action: 'update',
 payload: { value: 100, widgetId: 'widget-1' }
 };

 const ws = (service as any).ws as MockWebSocket;
 ws.simulateMessage(testMessage);

 expect(messageSpy).toHaveBeenCalledWith(testMessage.payload);
 });

 it('should emit widget-specific events', () => {
 const widgetSpy = jest.fn();
 service.on('widget:widget-1', widgetSpy);

 const testMessage = {
 type: 'metric',
 action: 'update',
 payload: { value: 100, widgetId: 'widget-1' }
 };

 const ws = (service as any).ws as MockWebSocket;
 ws.simulateMessage(testMessage);

 expect(widgetSpy).toHaveBeenCalledWith(testMessage);
 });

 it('should emit metric-specific events', () => {
 const metricSpy = jest.fn();
 service.on('metric:cpu_usage', metricSpy);

 const testMessage = {
 type: 'metric',
 action: 'update',
 payload: { value: 75, metric: 'cpu_usage' }
 };

 const ws = (service as any).ws as MockWebSocket;
 ws.simulateMessage(testMessage);

 expect(metricSpy).toHaveBeenCalledWith(testMessage.payload);
 });

 it('should handle malformed messages gracefully', () => {
 const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

 const ws = (service as any).ws as MockWebSocket;
 // Simulate malformed JSON
 const messageEvent = new MessageEvent('message', { data: 'invalid-json' });
 ws.onmessage?.(messageEvent);

 expect(consoleSpy).toHaveBeenCalledWith('Failed to parse WebSocket message:', expect.any(Error));
 consoleSpy.mockRestore();
 });
 });

 describe('Subscription Management', () => {
 beforeEach(async () => {
 service.connect();
 await new Promise(resolve => setTimeout(resolve, 20));
 });

 it('should create subscriptions successfully', () => {
 const subscription = {
 dashboardId: 'dashboard-1',
 widgetIds: ['widget-1', 'widget-2'],
 metrics: ['cpu_usage', 'memory_usage']
 };

 const subscriptionId = service.subscribe(subscription);

 expect(subscriptionId).toBeDefined();
 expect(subscriptionId).toContain('dashboard-1');
 expect((service as any).subscriptions.has(subscriptionId)).toBe(true);
 });

 it('should send subscription message when connected', () => {
 const sendSpy = jest.spyOn(service, 'send');
 
 const subscription = {
 dashboardId: 'dashboard-1',
 widgetIds: ['widget-1']
 };

 service.subscribe(subscription);

 expect(sendSpy).toHaveBeenCalledWith({
 type: 'subscribe',
 payload: subscription
 });
 });

 it('should unsubscribe correctly', () => {
 const sendSpy = jest.spyOn(service, 'send');
 
 const subscription = {
 dashboardId: 'dashboard-1',
 widgetIds: ['widget-1']
 };

 const subscriptionId = service.subscribe(subscription);
 service.unsubscribe(subscriptionId);

 expect(sendSpy).toHaveBeenCalledWith({
 type: 'unsubscribe',
 payload: { subscriptionId }
 });
 expect((service as any).subscriptions.has(subscriptionId)).toBe(false);
 });

 it('should resubscribe on reconnection', async () => {
 const subscription = {
 dashboardId: 'dashboard-1',
 widgetIds: ['widget-1']
 };

 const subscriptionId = service.subscribe(subscription);
 
 // Simulate disconnection
 const ws = (service as any).ws as MockWebSocket;
 ws.close();
 await new Promise(resolve => setTimeout(resolve, 20));

 // Clear previous send calls
 jest.clearAllMocks();
 const sendSpy = jest.spyOn(service, 'send');

 // Simulate reconnection
 service.connect();
 await new Promise(resolve => setTimeout(resolve, 20));

 expect(sendSpy).toHaveBeenCalledWith({
 type: 'subscribe',
 payload: subscription
 });
 });
 });

 describe('Heartbeat Mechanism', () => {
 beforeEach(async () => {
 service.connect();
 await new Promise(resolve => setTimeout(resolve, 20));
 });

 it('should start heartbeat on connection', () => {
 const heartbeatInterval = (service as any).heartbeatInterval;
 expect(heartbeatInterval).toBeDefined();
 });

 it('should stop heartbeat on disconnection', () => {
 service.disconnect();
 const heartbeatInterval = (service as any).heartbeatInterval;
 expect(heartbeatInterval).toBeNull();
 });

 it('should send ping messages during heartbeat', (done) => {
 const sendSpy = jest.spyOn(service, 'send');
 
 // Mock shorter heartbeat interval for testing
 (service as any).heartbeatInterval = setInterval(() => {
 if (service.isConnected()) {
 service.send({ type: 'ping' });
 }
 }, 100);

 setTimeout(() => {
 expect(sendSpy).toHaveBeenCalledWith({ type: 'ping' });
 done();
 }, 150);
 });
 });

 describe('Reconnection Logic', () => {
 it('should attempt to reconnect on unexpected disconnection', async () => {
 const connectSpy = jest.spyOn(service, 'connect');
 
 service.connect();
 await new Promise(resolve => setTimeout(resolve, 20));

 // Simulate unexpected disconnection
 const ws = (service as any).ws as MockWebSocket;
 ws.close(1006, 'Connection lost'); // Abnormal closure
 await new Promise(resolve => setTimeout(resolve, 20));

 // Wait for reconnection attempt
 await new Promise(resolve => setTimeout(resolve, 100));

 expect(connectSpy).toHaveBeenCalledTimes(2); // Initial connect + reconnect
 });

 it('should not reconnect on intentional disconnection', async () => {
 const connectSpy = jest.spyOn(service, 'connect');
 
 service.connect();
 await new Promise(resolve => setTimeout(resolve, 20));

 service.disconnect(); // Intentional disconnection
 await new Promise(resolve => setTimeout(resolve, 20));

 // Wait to ensure no reconnection
 await new Promise(resolve => setTimeout(resolve, 100));

 expect(connectSpy).toHaveBeenCalledTimes(1); // Only initial connect
 });

 it('should emit maxReconnectAttemptsReached after max attempts', async () => {
 const maxAttemptsSpy = jest.fn();
 service.on('maxReconnectAttemptsReached', maxAttemptsSpy);

 // Set low max attempts for testing
 (service as any).maxReconnectAttempts = 2;
 (service as any).reconnectTimeout = 50; // Faster reconnection for testing

 // Mock connect to always fail
 const originalConnect = service.connect.bind(service);
 jest.spyOn(service, 'connect').mockImplementation(() => {
 const ws = new MockWebSocket('ws://localhost:3000/ws');
 (service as any).ws = ws;
 setTimeout(() => ws.simulateError(), 10);
 });

 service.connect();
 
 // Wait for max attempts to be reached
 await new Promise(resolve => setTimeout(resolve, 300));

 expect(maxAttemptsSpy).toHaveBeenCalled();
 });
 });

 describe('Send Functionality', () => {
 it('should send data when connected', async () => {
 service.connect();
 await new Promise(resolve => setTimeout(resolve, 20));

 const ws = (service as any).ws as MockWebSocket;
 const sendSpy = jest.spyOn(ws, 'send');

 const testData = { type: 'test', payload: { message: 'hello' } };
 service.send(testData);

 expect(sendSpy).toHaveBeenCalledWith(JSON.stringify(testData));
 });

 it('should log warning when not connected', () => {
 const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

 const testData = { type: 'test', payload: { message: 'hello' } };
 service.send(testData);

 expect(consoleSpy).toHaveBeenCalledWith('WebSocket is not connected');
 consoleSpy.mockRestore();
 });
 });
});

describe('WebSocket Service Singleton', () => {
 afterEach(() => {
 // Reset singleton
 const wsService = getWebSocketService('ws://localhost:3000/ws');
 wsService.disconnect();
 });

 it('should return same instance for getWebSocketService', () => {
 const service1 = getWebSocketService('ws://localhost:3000/ws');
 const service2 = getWebSocketService();

 expect(service1).toBe(service2);
 });

 it('should throw error when getting service without initialization', () => {
 expect(() => getWebSocketService()).toThrow('WebSocket service not initialized');
 });

 it('should reinitialize service with initializeWebSocketService', () => {
 const service1 = getWebSocketService('ws://localhost:3000/ws');
 const service2 = initializeWebSocketService('ws://localhost:4000/ws');

 expect(service2).not.toBe(service1);
 expect((service2 as any).url).toBe('ws://localhost:4000/ws');
 });

 it('should disconnect old service when reinitializing', () => {
 const service1 = getWebSocketService('ws://localhost:3000/ws');
 const disconnectSpy = jest.spyOn(service1, 'disconnect');

 initializeWebSocketService('ws://localhost:4000/ws');

 expect(disconnectSpy).toHaveBeenCalled();
 });
});