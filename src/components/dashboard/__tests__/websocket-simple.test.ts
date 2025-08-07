import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { DashboardWebSocketService } from '../services/websocket';

// Simple WebSocket mock
class MockWebSocket {
 static CONNECTING = 0;
 static OPEN = 1;
 static CLOSING = 2;
 static CLOSED = 3;

 public readyState: number = MockWebSocket.CONNECTING;
 public url: string;
 public onopen: ((event: Event) => void) | null = null;
 public onclose: ((event: CloseEvent) => void) | null = null;
 public onerror: ((event: Event) => void) | null = null;
 public onmessage: ((event: MessageEvent) => void) | null = null;

 constructor(url: string) {
 this.url = url;
 // Auto-connect after construction
 setTimeout(() => {
 this.readyState = MockWebSocket.OPEN;
 if (this.onopen) {
 this.onopen(new Event('open'));
 }
 }, 10);
 }

 send(data: string): void {
 if (this.readyState !== MockWebSocket.OPEN) {
 throw new Error('WebSocket is not open');
 }
 }

 close(code?: number, reason?: string): void {
 this.readyState = MockWebSocket.CLOSING;
 setTimeout(() => {
 this.readyState = MockWebSocket.CLOSED;
 if (this.onclose) {
 this.onclose(new CloseEvent('close', { code: code || 1000, reason: reason || '' }));
 }
 }, 10);
 }

 // Test helpers
 simulateMessage(data: any): void {
 if (this.readyState === MockWebSocket.OPEN && this.onmessage) {
 this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
 }
 }

 simulateError(): void {
 if (this.onerror) {
 this.onerror(new Event('error'));
 }
 }
}

// Mock global WebSocket
(global as any).WebSocket = MockWebSocket;

describe('WebSocket Service - Simple Tests', () => {
 let service: DashboardWebSocketService;
 const wsUrl = 'ws://localhost:3000/ws';

 beforeEach(() => {
 service = new DashboardWebSocketService(wsUrl);
 });

 afterEach(() => {
 service.disconnect();
 });

 describe('Basic Functionality', () => {
 it('should create service instance', () => {
 expect(service).toBeInstanceOf(DashboardWebSocketService);
 expect(service.isConnected()).toBe(false);
 });

 it('should connect to WebSocket', async () => {
 const connectedSpy = jest.fn();
 service.on('connected', connectedSpy);

 service.connect();

 // Wait for connection
 await new Promise(resolve => setTimeout(resolve, 20));

 expect(connectedSpy).toHaveBeenCalled();
 expect(service.isConnected()).toBe(true);
 });

 it('should disconnect from WebSocket', async () => {
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

 it('should not create duplicate connections', async () => {
 service.connect();
 await new Promise(resolve => setTimeout(resolve, 20));

 const firstWs = (service as any).ws;
 service.connect(); // Try to connect again

 expect((service as any).ws).toBe(firstWs);
 });
 });

 describe('Message Handling', () => {
 beforeEach(async () => {
 service.connect();
 await new Promise(resolve => setTimeout(resolve, 20));
 });

 it('should parse incoming messages', () => {
 const messageSpy = jest.fn();
 service.on('metric:update', messageSpy);

 const testMessage = {
 type: 'metric',
 action: 'update',
 payload: { value: 100 }
 };

 const ws = (service as any).ws as MockWebSocket;
 ws.simulateMessage(testMessage);

 expect(messageSpy).toHaveBeenCalledWith(testMessage.payload);
 });

 it('should emit widget-specific events', () => {
 const widgetSpy = jest.fn();
 service.on('widget:test-widget', widgetSpy);

 const testMessage = {
 type: 'metric',
 action: 'update',
 payload: { widgetId: 'test-widget', value: 100 }
 };

 const ws = (service as any).ws as MockWebSocket;
 ws.simulateMessage(testMessage);

 expect(widgetSpy).toHaveBeenCalledWith(testMessage);
 });

 it('should handle malformed JSON gracefully', () => {
 const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

 const ws = (service as any).ws as MockWebSocket;
 if (ws.onmessage) {
 ws.onmessage(new MessageEvent('message', { data: 'invalid-json' }));
 }

 expect(consoleSpy).toHaveBeenCalledWith('Failed to parse WebSocket message:', expect.any(Error));
 consoleSpy.mockRestore();
 });
 });

 describe('Subscription Management', () => {
 beforeEach(async () => {
 service.connect();
 await new Promise(resolve => setTimeout(resolve, 20));
 });

 it('should create subscriptions', () => {
 const subscription = {
 dashboardId: 'dashboard-1',
 widgetIds: ['widget-1'],
 metrics: ['cpu_usage']
 };

 const subscriptionId = service.subscribe(subscription);

 expect(subscriptionId).toContain('dashboard-1');
 expect((service as any).subscriptions.has(subscriptionId)).toBe(true);
 });

 it('should send subscription messages', () => {
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
 
 // Clear previous calls
 sendSpy.mockClear();
 
 service.unsubscribe(subscriptionId);

 expect(sendSpy).toHaveBeenCalledWith({
 type: 'unsubscribe',
 payload: { subscriptionId }
 });
 expect((service as any).subscriptions.has(subscriptionId)).toBe(false);
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

 it('should warn when sending without connection', () => {
 const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

 const testData = { type: 'test', payload: { message: 'hello' } };
 service.send(testData);

 expect(consoleSpy).toHaveBeenCalledWith('WebSocket is not connected');
 consoleSpy.mockRestore();
 });
 });

 describe('Heartbeat System', () => {
 it('should have heartbeat interval after connection', async () => {
 service.connect();
 await new Promise(resolve => setTimeout(resolve, 20));

 const heartbeatInterval = (service as any).heartbeatInterval;
 expect(heartbeatInterval).toBeDefined();
 });

 it('should clear heartbeat on disconnect', async () => {
 service.connect();
 await new Promise(resolve => setTimeout(resolve, 20));

 service.disconnect();

 const heartbeatInterval = (service as any).heartbeatInterval;
 expect(heartbeatInterval).toBeNull();
 });
 });

 describe('Reconnection Logic', () => {
 it('should have reconnection properties', () => {
 expect((service as any).reconnectTimeout).toBe(5000);
 expect((service as any).maxReconnectAttempts).toBe(10);
 expect((service as any).reconnectAttempts).toBe(0);
 });

 it('should track reconnection attempts', async () => {
 service.connect();
 await new Promise(resolve => setTimeout(resolve, 20));

 // Simulate unexpected disconnection
 const ws = (service as any).ws as MockWebSocket;
 ws.close(1006, 'Connection lost');
 await new Promise(resolve => setTimeout(resolve, 20));

 // Should have scheduled a reconnection
 expect((service as any).reconnectAttempts).toBeGreaterThan(0);
 });

 it('should emit max attempts reached event', async () => {
 const maxAttemptsSpy = jest.fn();
 service.on('maxReconnectAttemptsReached', maxAttemptsSpy);

 // Set low max attempts for testing
 (service as any).maxReconnectAttempts = 1;
 (service as any).reconnectAttempts = 1;

 // Call scheduleReconnect directly to test the limit
 (service as any).scheduleReconnect();

 expect(maxAttemptsSpy).toHaveBeenCalled();
 });
 });

 describe('State Management', () => {
 it('should properly track connection state', async () => {
 expect(service.isConnected()).toBe(false);

 service.connect();
 await new Promise(resolve => setTimeout(resolve, 20));

 expect(service.isConnected()).toBe(true);

 service.disconnect();
 await new Promise(resolve => setTimeout(resolve, 20));

 expect(service.isConnected()).toBe(false);
 });

 it('should manage subscriptions map', () => {
 const subscription1 = { dashboardId: 'dash-1', widgetIds: ['w1'] };
 const subscription2 = { dashboardId: 'dash-2', widgetIds: ['w2'] };

 const id1 = service.subscribe(subscription1);
 const id2 = service.subscribe(subscription2);

 expect((service as any).subscriptions.size).toBe(2);

 service.unsubscribe(id1);
 expect((service as any).subscriptions.size).toBe(1);

 service.unsubscribe(id2);
 expect((service as any).subscriptions.size).toBe(0);
 });

 it('should handle intentional vs unintentional disconnection', async () => {
 service.connect();
 await new Promise(resolve => setTimeout(resolve, 20));

 // Intentional disconnection
 expect((service as any).isIntentionallyClosed).toBe(false);
 service.disconnect();
 expect((service as any).isIntentionallyClosed).toBe(true);

 // Reset for unintentional test
 (service as any).isIntentionallyClosed = false;
 service.connect();
 await new Promise(resolve => setTimeout(resolve, 20));

 // Unintentional disconnection
 const ws = (service as any).ws as MockWebSocket;
 ws.close();
 await new Promise(resolve => setTimeout(resolve, 20));

 expect((service as any).reconnectAttempts).toBeGreaterThan(0);
 });
 });

 describe('Event Emission', () => {
 it('should emit connected event', async () => {
 const connectedSpy = jest.fn();
 service.on('connected', connectedSpy);

 service.connect();
 await new Promise(resolve => setTimeout(resolve, 20));

 expect(connectedSpy).toHaveBeenCalledTimes(1);
 });

 it('should emit disconnected event', async () => {
 const disconnectedSpy = jest.fn();
 service.on('disconnected', disconnectedSpy);

 service.connect();
 await new Promise(resolve => setTimeout(resolve, 20));

 service.disconnect();
 await new Promise(resolve => setTimeout(resolve, 20));

 expect(disconnectedSpy).toHaveBeenCalledTimes(1);
 });

 it('should emit typed events for different message types', () => {
 const metricSpy = jest.fn();
 const alertSpy = jest.fn();
 const deploymentSpy = jest.fn();

 service.on('metric:update', metricSpy);
 service.on('alert:create', alertSpy);
 service.on('deployment:status', deploymentSpy);

 // Need to connect first
 service.connect();

 setTimeout(() => {
 const ws = (service as any).ws as MockWebSocket;

 ws.simulateMessage({ type: 'metric', action: 'update', payload: { value: 50 } });
 ws.simulateMessage({ type: 'alert', action: 'create', payload: { severity: 'high' } });
 ws.simulateMessage({ type: 'deployment', action: 'status', payload: { status: 'complete' } });

 expect(metricSpy).toHaveBeenCalledWith({ value: 50 });
 expect(alertSpy).toHaveBeenCalledWith({ severity: 'high' });
 expect(deploymentSpy).toHaveBeenCalledWith({ status: 'complete' });
 }, 20);
 });
 });
});