/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unused-vars, @typescript-eslint/no-floating-promises, @typescript-eslint/no-misused-promises, react-hooks/exhaustive-deps */

import { useEffect, useState, useCallback, useRef } from 'react';

import { getWebSocketService, initializeWebSocketService } from '../services/websocket';

import type { WebSocketSubscription, UseWebSocketReturn, WebSocketMessage } from '../types';

export const useWebSocket = (url?: string): UseWebSocketReturn => {
 const [connected, setConnected] = useState(false);
 const wsService = useRef<ReturnType<typeof getWebSocketService> | null>(null);
 const subscriptions = useRef<Map<string, string>>(new Map());

 useEffect(() => {
 if (url) {
 wsService.current = initializeWebSocketService(url);
 } else {
 try {
 wsService.current = getWebSocketService();
 } catch (error) {
 console.error('WebSocket service not initialized');
 return;
 }
 }

 const service = wsService.current;

 const handleConnected = () => setConnected(true);
 const handleDisconnected = () => setConnected(false);

 service.on('connected', handleConnected);
 service.on('disconnected', handleDisconnected);

 service.connect();
 setConnected(service.isConnected());

 return () => {
 service.off('connected', handleConnected);
 service.off('disconnected', handleDisconnected);
 
 // Unsubscribe all subscriptions on unmount
 subscriptions.current.forEach((subId) => {
 service.unsubscribe(subId);
 });
 subscriptions.current.clear();
 };
 }, [url]);

 const subscribe = useCallback((subscription: WebSocketSubscription) => {
 if (!wsService.current) return;

 const subscriptionId = wsService.current.subscribe(subscription);
 subscriptions.current.set(subscription.dashboardId, subscriptionId);
 }, []);

 const unsubscribe = useCallback((subscriptionId: string) => {
 if (!wsService.current) return;

 wsService.current.unsubscribe(subscriptionId);
 
 // Remove from local tracking
 subscriptions.current.forEach((value, key) => {
 if (value === subscriptionId) {
 subscriptions.current.delete(key);
 }
 });
 }, []);

 const send = useCallback((message: any) => {
 if (!wsService.current) return;
 wsService.current.send(message);
 }, []);

 return {
 connected,
 subscribe,
 unsubscribe,
 send
 };
};

// Hook for subscribing to specific widget data
export const useWidgetData = (widgetId: string, widget?: any) => {
 const [data, setData] = useState<any>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<Error | null>(null);
 const [refreshKey, setRefreshKey] = useState(0);
 const wsService = useRef<ReturnType<typeof getWebSocketService> | null>(null);

 // Refresh function
 const refresh = useCallback(() => {
 setRefreshKey(prev => prev + 1);
 setLoading(true);
 }, []);

 useEffect(() => {
 let mounted = true;
 
 const fetchData = async () => {
 try {
 // Import services dynamically to avoid circular dependencies
 const { metricsService } = await import('@/services/dashboard/metrics');
 const { realtimeService } = await import('@/services/dashboard/realtime');
 
 if (widget) {
 const widgetData = await metricsService.getWidgetData(widget.type, widget.config);
 if (mounted) {
 setData(widgetData);
 setLoading(false);
 setError(null);
 }
 } else {
 // Fallback to mock data
 if (mounted) {
 setData({ value: Math.random() * 100 });
 setLoading(false);
 }
 }
 } catch (err) {
 if (mounted) {
 setError(err as Error);
 setLoading(false);
 }
 }
 };

 // Initial fetch
 fetchData();

 // Set up real-time data service
 const setupRealtimeUpdates = async () => {
 try {
 const { realtimeService } = await import('@/services/dashboard/realtime');
 
 const handleMetricsUpdate = (update: any) => {
 if (mounted) {
 // Update data based on widget type
 switch (widget?.type) {
 case 'metric':
 case 'chart':
 case 'serviceHealth':
 case 'deployment':
 case 'table':
 fetchData(); // Refresh widget data
 break;
 }
 }
 };

 const handleEntityUpdate = (update: any) => {
 if (mounted && widget?.dataSource?.query?.includes(update.entityRef)) {
 fetchData();
 }
 };

 // Subscribe to real-time updates
 realtimeService.on('metrics', handleMetricsUpdate);
 realtimeService.on('entity-update', handleEntityUpdate);
 realtimeService.on('deployment', handleMetricsUpdate);
 realtimeService.on('alert', handleMetricsUpdate);
 realtimeService.on('health', handleMetricsUpdate);

 // Start the real-time service if not already started
 if (!realtimeService.isConnected()) {
 realtimeService.start();
 }

 return () => {
 if (mounted) {
 realtimeService.off('metrics', handleMetricsUpdate);
 realtimeService.off('entity-update', handleEntityUpdate);
 realtimeService.off('deployment', handleMetricsUpdate);
 realtimeService.off('alert', handleMetricsUpdate);
 realtimeService.off('health', handleMetricsUpdate);
 }
 };
 } catch (error) {
 console.error('Failed to setup real-time updates:', error);
 // Fallback to polling
 const interval = setInterval(fetchData, 30000);
 return () => {
 mounted = false;
 clearInterval(interval);
 };
 }
 };

 // Set up WebSocket connection as fallback
 const setupWebSocketFallback = () => {
 try {
 wsService.current = getWebSocketService();
 const service = wsService.current;

 const handleWidgetData = (message: WebSocketMessage) => {
 if (message.payload.widgetId === widgetId && mounted) {
 setData(message.payload.data);
 setError(null);
 }
 };

 const handleMetricData = (payload: any) => {
 if (mounted) {
 setData(payload.data);
 setError(null);
 }
 };

 const handleError = (error: Error) => {
 if (mounted) {
 setError(error);
 }
 };

 service.on(`widget:${widgetId}`, handleWidgetData);
 
 if (widget?.dataSource?.query) {
 service.on(`metric:${widget.dataSource.query}`, handleMetricData);
 }
 
 service.on('error', handleError);

 return () => {
 service.off(`widget:${widgetId}`, handleWidgetData);
 
 if (widget?.dataSource?.query) {
 service.off(`metric:${widget.dataSource.query}`, handleMetricData);
 }
 
 service.off('error', handleError);
 };
 } catch (error) {
 // No WebSocket available, use polling
 const interval = setInterval(fetchData, 30000);
 return () => clearInterval(interval);
 }
 };

 // Try real-time service first, fallback to WebSocket, then polling
 const cleanup = setupRealtimeUpdates();
 
 return () => {
 mounted = false;
 if (cleanup) {
 cleanup.then(cleanupFn => cleanupFn && cleanupFn());
 }
 };
 }, [widgetId, widget, refreshKey]);

 return { data, loading, error, refresh };
};