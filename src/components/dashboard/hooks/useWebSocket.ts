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
                if (widget) {
                    // Fetch from API Route
                    const response = await fetch('/api/dashboard/widget', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({
                            widgetType: widget.type,
                            config: widget.config
                        })
                    });

                    if (!response.ok) throw new Error('Failed to fetch widget data');

                    const widgetData = await response.json();

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

        // Set up WebSocket connection for real-time updates
        let cleanupWebSocket: (() => void) | undefined;
        let pollingInterval: NodeJS.Timeout | undefined;

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

            const handleError = (err: Error) => {
                if (mounted) {
                    setError(err);
                }
            };

            service.on(`widget:${widgetId}`, handleWidgetData);

            if (widget?.dataSource?.query) {
                service.on(`metric:${widget.dataSource.query}`, handleMetricData);
            }

            service.on('error', handleError);

            cleanupWebSocket = () => {
                service.off(`widget:${widgetId}`, handleWidgetData);

                if (widget?.dataSource?.query) {
                    service.off(`metric:${widget.dataSource.query}`, handleMetricData);
                }

                service.off('error', handleError);
            };
        } catch (wsError) {
            // No WebSocket available, use polling as fallback
            pollingInterval = setInterval(fetchData, 30000);
        }

        return () => {
            mounted = false;
            if (cleanupWebSocket) {
                cleanupWebSocket();
            }
            if (pollingInterval) {
                clearInterval(pollingInterval);
            }
        };
    }, [widgetId, widget, refreshKey]);

    return { data, loading, error, refresh };
};