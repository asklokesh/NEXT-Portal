import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { renderHook, act } from '@testing-library/react';
import { useWebSocket, useWidgetData } from '../hooks/useWebSocket';
import { EventEmitter } from 'events';

// Mock WebSocket service
class MockWebSocketService extends EventEmitter {
 private connected = false;
 private subscriptions = new Map<string, any>();

 connect() {
 this.connected = true;
 this.emit('connected');
 }

 disconnect() {
 this.connected = false;
 this.emit('disconnected');
 }

 isConnected() {
 return this.connected;
 }

 subscribe(subscription: any): string {
 const id = `sub-${Date.now()}-${Math.random()}`;
 this.subscriptions.set(id, subscription);
 return id;
 }

 unsubscribe(subscriptionId: string) {
 this.subscriptions.delete(subscriptionId);
 }

 send(message: any) {
 // Mock send functionality
 }

 // Test helper methods
 simulateMessage(type: string, payload: any) {
 this.emit(type, payload);
 }

 getSubscriptions() {
 return this.subscriptions;
 }
}

// Mock the WebSocket service functions
const mockService = new MockWebSocketService();

jest.mock('../services/websocket', () => ({
 getWebSocketService: jest.fn(() => mockService),
 initializeWebSocketService: jest.fn(() => mockService),
}));

// Mock metrics and realtime services
const mockMetricsService = {
 getWidgetData: jest.fn(),
};

const mockRealtimeService = new EventEmitter();
mockRealtimeService.isConnected = jest.fn(() => false);
mockRealtimeService.start = jest.fn();

jest.mock('@/services/dashboard/metrics', () => ({
 metricsService: mockMetricsService,
}));

jest.mock('@/services/dashboard/realtime', () => ({
 realtimeService: mockRealtimeService,
}));

describe('useWebSocket Hook', () => {
 beforeEach(() => {
 jest.clearAllMocks();
 mockService.removeAllListeners();
 mockService.disconnect();
 });

 afterEach(() => {
 mockService.disconnect();
 });

 describe('Connection Management', () => {
 it('should initialize connected state as false', () => {
 const { result } = renderHook(() => useWebSocket());

 expect(result.current.connected).toBe(false);
 });

 it('should connect on mount and update connected state', () => {
 const { result } = renderHook(() => useWebSocket());

 expect(result.current.connected).toBe(false);

 // Simulate connection
 act(() => {
 mockService.connect();
 });

 expect(result.current.connected).toBe(true);
 });

 it('should handle disconnection', () => {
 const { result } = renderHook(() => useWebSocket());

 // Connect first
 act(() => {
 mockService.connect();
 });
 expect(result.current.connected).toBe(true);

 // Then disconnect
 act(() => {
 mockService.disconnect();
 });
 expect(result.current.connected).toBe(false);
 });

 it('should initialize with custom URL', () => {
 const customUrl = 'ws://custom-url:8080/ws';
 const { result } = renderHook(() => useWebSocket(customUrl));

 // The hook should work with custom URL
 expect(result.current).toHaveProperty('connected');
 expect(result.current).toHaveProperty('subscribe');
 expect(result.current).toHaveProperty('unsubscribe');
 expect(result.current).toHaveProperty('send');
 });

 it('should handle WebSocket service initialization error', () => {
 const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

 // Mock getWebSocketService to throw error
 const originalGetService = require('../services/websocket').getWebSocketService;
 require('../services/websocket').getWebSocketService.mockImplementation(() => {
 throw new Error('Service not initialized');
 });

 const { result } = renderHook(() => useWebSocket());

 expect(consoleSpy).toHaveBeenCalledWith('WebSocket service not initialized');
 expect(result.current.connected).toBe(false);

 // Restore mocks
 require('../services/websocket').getWebSocketService.mockImplementation(originalGetService);
 consoleSpy.mockRestore();
 });
 });

 describe('Subscription Management', () => {
 it('should provide subscribe function', () => {
 const { result } = renderHook(() => useWebSocket());

 expect(typeof result.current.subscribe).toBe('function');
 });

 it('should create subscription correctly', () => {
 const { result } = renderHook(() => useWebSocket());

 const subscription = {
 dashboardId: 'dashboard-1',
 widgetIds: ['widget-1', 'widget-2'],
 metrics: ['cpu_usage']
 };

 act(() => {
 result.current.subscribe(subscription);
 });

 const subscriptions = mockService.getSubscriptions();
 expect(subscriptions.size).toBe(1);
 expect(Array.from(subscriptions.values())[0]).toEqual(subscription);
 });

 it('should provide unsubscribe function', () => {
 const { result } = renderHook(() => useWebSocket());

 expect(typeof result.current.unsubscribe).toBe('function');
 });

 it('should unsubscribe correctly', () => {
 const { result } = renderHook(() => useWebSocket());

 const subscription = {
 dashboardId: 'dashboard-1',
 widgetIds: ['widget-1']
 };

 let subscriptionId: string;
 act(() => {
 result.current.subscribe(subscription);
 });

 // Get the subscription ID
 const subscriptions = mockService.getSubscriptions();
 subscriptionId = Array.from(subscriptions.keys())[0];

 act(() => {
 result.current.unsubscribe(subscriptionId);
 });

 expect(mockService.getSubscriptions().size).toBe(0);
 });

 it('should handle subscribe when service is not available', () => {
 // Mock service to be null
 require('../services/websocket').getWebSocketService.mockImplementation(() => null);

 const { result } = renderHook(() => useWebSocket());

 const subscription = {
 dashboardId: 'dashboard-1',
 widgetIds: ['widget-1']
 };

 // Should not throw error
 act(() => {
 result.current.subscribe(subscription);
 });

 // Restore mock
 require('../services/websocket').getWebSocketService.mockImplementation(() => mockService);
 });

 it('should handle unsubscribe when service is not available', () => {
 // Mock service to be null
 require('../services/websocket').getWebSocketService.mockImplementation(() => null);

 const { result } = renderHook(() => useWebSocket());

 // Should not throw error
 act(() => {
 result.current.unsubscribe('some-id');
 });

 // Restore mock
 require('../services/websocket').getWebSocketService.mockImplementation(() => mockService);
 });
 });

 describe('Message Sending', () => {
 it('should provide send function', () => {
 const { result } = renderHook(() => useWebSocket());

 expect(typeof result.current.send).toBe('function');
 });

 it('should send messages correctly', () => {
 const { result } = renderHook(() => useWebSocket());
 const sendSpy = jest.spyOn(mockService, 'send');

 const message = { type: 'test', payload: { data: 'test-data' } };

 act(() => {
 result.current.send(message);
 });

 expect(sendSpy).toHaveBeenCalledWith(message);
 });

 it('should handle send when service is not available', () => {
 // Mock service to be null
 require('../services/websocket').getWebSocketService.mockImplementation(() => null);

 const { result } = renderHook(() => useWebSocket());

 const message = { type: 'test', payload: { data: 'test-data' } };

 // Should not throw error
 act(() => {
 result.current.send(message);
 });

 // Restore mock
 require('../services/websocket').getWebSocketService.mockImplementation(() => mockService);
 });
 });

 describe('Cleanup', () => {
 it('should clean up subscriptions on unmount', () => {
 const { result, unmount } = renderHook(() => useWebSocket());

 const subscription = {
 dashboardId: 'dashboard-1',
 widgetIds: ['widget-1']
 };

 act(() => {
 result.current.subscribe(subscription);
 });

 expect(mockService.getSubscriptions().size).toBe(1);

 unmount();

 expect(mockService.getSubscriptions().size).toBe(0);
 });

 it('should remove event listeners on unmount', () => {
 const { unmount } = renderHook(() => useWebSocket());

 const initialListenerCount = mockService.listenerCount('connected');

 unmount();

 expect(mockService.listenerCount('connected')).toBeLessThanOrEqual(initialListenerCount);
 });
 });
});

describe('useWidgetData Hook', () => {
 const mockWidget = {
 id: 'widget-1',
 type: 'metric' as const,
 title: 'Test Widget',
 config: {},
 dataSource: {
 type: 'prometheus' as const,
 query: 'cpu_usage'
 }
 };

 beforeEach(() => {
 jest.clearAllMocks();
 mockMetricsService.getWidgetData.mockResolvedValue({ value: 75 });
 mockRealtimeService.removeAllListeners();
 });

 describe('Data Fetching', () => {
 it('should start with loading state', () => {
 const { result } = renderHook(() => useWidgetData('widget-1', mockWidget));

 expect(result.current.loading).toBe(true);
 expect(result.current.data).toBeNull();
 expect(result.current.error).toBeNull();
 });

 it('should fetch widget data successfully', async () => {
 const { result, waitForNextUpdate } = renderHook(() => 
 useWidgetData('widget-1', mockWidget)
 );

 await waitForNextUpdate();

 expect(result.current.loading).toBe(false);
 expect(result.current.data).toEqual({ value: 75 });
 expect(result.current.error).toBeNull();
 expect(mockMetricsService.getWidgetData).toHaveBeenCalledWith(
 mockWidget.type,
 mockWidget.config
 );
 });

 it('should handle fetch errors', async () => {
 const error = new Error('Fetch failed');
 mockMetricsService.getWidgetData.mockRejectedValue(error);

 const { result, waitForNextUpdate } = renderHook(() => 
 useWidgetData('widget-1', mockWidget)
 );

 await waitForNextUpdate();

 expect(result.current.loading).toBe(false);
 expect(result.current.data).toBeNull();
 expect(result.current.error).toEqual(error);
 });

 it('should use fallback data when no widget provided', async () => {
 const { result, waitForNextUpdate } = renderHook(() => 
 useWidgetData('widget-1')
 );

 await waitForNextUpdate();

 expect(result.current.loading).toBe(false);
 expect(result.current.data).toEqual(expect.objectContaining({
 value: expect.any(Number)
 }));
 expect(result.current.error).toBeNull();
 });
 });

 describe('Real-time Updates', () => {
 it('should set up real-time updates for metrics', async () => {
 const { waitForNextUpdate } = renderHook(() => 
 useWidgetData('widget-1', mockWidget)
 );

 await waitForNextUpdate();

 expect(mockRealtimeService.listenerCount('metrics')).toBeGreaterThan(0);
 expect(mockRealtimeService.listenerCount('entity-update')).toBeGreaterThan(0);
 });

 it('should start real-time service if not connected', async () => {
 mockRealtimeService.isConnected.mockReturnValue(false);

 const { waitForNextUpdate } = renderHook(() => 
 useWidgetData('widget-1', mockWidget)
 );

 await waitForNextUpdate();

 expect(mockRealtimeService.start).toHaveBeenCalled();
 });

 it('should not start real-time service if already connected', async () => {
 mockRealtimeService.isConnected.mockReturnValue(true);

 const { waitForNextUpdate } = renderHook(() => 
 useWidgetData('widget-1', mockWidget)
 );

 await waitForNextUpdate();

 expect(mockRealtimeService.start).not.toHaveBeenCalled();
 });

 it('should handle real-time service initialization failure', async () => {
 // Mock dynamic import to fail
 const originalImport = jest.requireActual('@/services/dashboard/realtime');
 jest.doMock('@/services/dashboard/realtime', () => {
 throw new Error('Service unavailable');
 });

 const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

 const { waitForNextUpdate } = renderHook(() => 
 useWidgetData('widget-1', mockWidget)
 );

 await waitForNextUpdate();

 expect(consoleSpy).toHaveBeenCalledWith(
 'Failed to setup real-time updates:',
 expect.any(Error)
 );

 consoleSpy.mockRestore();
 });

 it('should refresh data on real-time updates', async () => {
 mockMetricsService.getWidgetData
 .mockResolvedValueOnce({ value: 75 })
 .mockResolvedValueOnce({ value: 85 });

 const { result, waitForNextUpdate } = renderHook(() => 
 useWidgetData('widget-1', mockWidget)
 );

 await waitForNextUpdate();
 expect(result.current.data).toEqual({ value: 75 });

 // Simulate metrics update
 act(() => {
 mockRealtimeService.emit('metrics', { type: 'cpu_usage' });
 });

 await waitForNextUpdate();
 expect(result.current.data).toEqual({ value: 85 });
 });

 it('should handle entity updates for relevant widgets', async () => {
 const widgetWithQuery = {
 ...mockWidget,
 dataSource: {
 type: 'prometheus' as const,
 query: 'component:default/test-service'
 }
 };

 mockMetricsService.getWidgetData
 .mockResolvedValueOnce({ value: 75 })
 .mockResolvedValueOnce({ value: 85 });

 const { result, waitForNextUpdate } = renderHook(() => 
 useWidgetData('widget-1', widgetWithQuery)
 );

 await waitForNextUpdate();
 expect(result.current.data).toEqual({ value: 75 });

 // Simulate entity update for the same entity
 act(() => {
 mockRealtimeService.emit('entity-update', {
 entityRef: 'component:default/test-service'
 });
 });

 await waitForNextUpdate();
 expect(result.current.data).toEqual({ value: 85 });
 });
 });

 describe('WebSocket Fallback', () => {
 it('should set up WebSocket listeners when available', async () => {
 const { waitForNextUpdate } = renderHook(() => 
 useWidgetData('widget-1', mockWidget)
 );

 await waitForNextUpdate();

 expect(mockService.listenerCount(`widget:widget-1`)).toBeGreaterThan(0);
 expect(mockService.listenerCount(`metric:cpu_usage`)).toBeGreaterThan(0);
 });

 it('should handle WebSocket messages', async () => {
 const { result, waitForNextUpdate } = renderHook(() => 
 useWidgetData('widget-1', mockWidget)
 );

 await waitForNextUpdate();

 // Simulate WebSocket message
 act(() => {
 mockService.simulateMessage(`widget:widget-1`, {
 type: 'metric',
 payload: { widgetId: 'widget-1', data: { value: 95 } }
 });
 });

 expect(result.current.data).toEqual({ value: 95 });
 expect(result.current.error).toBeNull();
 });

 it('should handle metric data messages', async () => {
 const { result, waitForNextUpdate } = renderHook(() => 
 useWidgetData('widget-1', mockWidget)
 );

 await waitForNextUpdate();

 // Simulate metric data message
 act(() => {
 mockService.simulateMessage(`metric:cpu_usage`, {
 data: { value: 88 }
 });
 });

 expect(result.current.data).toEqual({ value: 88 });
 expect(result.current.error).toBeNull();
 });

 it('should handle WebSocket errors', async () => {
 const { result, waitForNextUpdate } = renderHook(() => 
 useWidgetData('widget-1', mockWidget)
 );

 await waitForNextUpdate();

 const error = new Error('WebSocket error');

 // Simulate WebSocket error
 act(() => {
 mockService.simulateMessage('error', error);
 });

 expect(result.current.error).toEqual(error);
 });
 });

 describe('Refresh Functionality', () => {
 it('should provide refresh function', () => {
 const { result } = renderHook(() => useWidgetData('widget-1', mockWidget));

 expect(typeof result.current.refresh).toBe('function');
 });

 it('should refresh data when called', async () => {
 mockMetricsService.getWidgetData
 .mockResolvedValueOnce({ value: 75 })
 .mockResolvedValueOnce({ value: 85 });

 const { result, waitForNextUpdate } = renderHook(() => 
 useWidgetData('widget-1', mockWidget)
 );

 await waitForNextUpdate();
 expect(result.current.data).toEqual({ value: 75 });

 act(() => {
 result.current.refresh();
 });

 expect(result.current.loading).toBe(true);

 await waitForNextUpdate();
 expect(result.current.data).toEqual({ value: 85 });
 expect(result.current.loading).toBe(false);
 });
 });

 describe('Cleanup', () => {
 it('should clean up real-time listeners on unmount', async () => {
 const { unmount, waitForNextUpdate } = renderHook(() => 
 useWidgetData('widget-1', mockWidget)
 );

 await waitForNextUpdate();

 const initialMetricsListeners = mockRealtimeService.listenerCount('metrics');
 const initialEntityListeners = mockRealtimeService.listenerCount('entity-update');

 unmount();

 expect(mockRealtimeService.listenerCount('metrics')).toBeLessThan(initialMetricsListeners);
 expect(mockRealtimeService.listenerCount('entity-update')).toBeLessThan(initialEntityListeners);
 });

 it('should clean up WebSocket listeners on unmount', async () => {
 const { unmount, waitForNextUpdate } = renderHook(() => 
 useWidgetData('widget-1', mockWidget)
 );

 await waitForNextUpdate();

 const initialWidgetListeners = mockService.listenerCount('widget:widget-1');
 const initialMetricListeners = mockService.listenerCount('metric:cpu_usage');

 unmount();

 expect(mockService.listenerCount('widget:widget-1')).toBeLessThan(initialWidgetListeners);
 expect(mockService.listenerCount('metric:cpu_usage')).toBeLessThan(initialMetricListeners);
 });

 it('should handle component unmount during async operations', async () => {
 let resolvePromise: (value: any) => void;
 const delayedPromise = new Promise(resolve => {
 resolvePromise = resolve;
 });

 mockMetricsService.getWidgetData.mockReturnValue(delayedPromise);

 const { result, unmount } = renderHook(() => 
 useWidgetData('widget-1', mockWidget)
 );

 expect(result.current.loading).toBe(true);

 // Unmount before promise resolves
 unmount();

 // Resolve promise after unmount
 act(() => {
 resolvePromise!({ value: 99 });
 });

 // Should not update state after unmount
 // (This test mainly ensures no memory leaks or warnings)
 });
 });
});