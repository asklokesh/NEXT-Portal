'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export interface RealtimeEvent {
  type: string;
  data: Record<string, any>;
  timestamp: number;
  source: string;
  entityId?: string;
  namespace?: string;
  team?: string;
  userId?: string;
}

export interface Subscription {
  room: string;
  filters?: {
    entityTypes?: string[];
    namespaces?: string[];
    teams?: string[];
    eventTypes?: string[];
  };
}

export interface ConnectionStats {
  totalConnections: number;
  activeConnections: number;
  messagesProcessed: number;
  roomsActive: number;
}

export interface UseRealtimeSyncOptions {
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  heartbeatInterval?: number;
  enableEventBuffer?: boolean;
  maxBufferSize?: number;
  enablePersistence?: boolean;
  debug?: boolean;
}

export interface UseRealtimeSyncReturn {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error' | null;
  connectionId: string | null;
  lastError: string | null;
  
  // Events
  events: RealtimeEvent[];
  latestEvent: RealtimeEvent | null;
  eventBuffer: RealtimeEvent[];
  
  // Statistics
  stats: ConnectionStats | null;
  latency: number | null;
  
  // Subscriptions
  subscriptions: Set<string>;
  
  // Actions
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;
  subscribe: (subscription: Subscription) => Promise<void>;
  unsubscribe: (room: string) => void;
  sendEvent: (event: Omit<RealtimeEvent, 'timestamp'>) => void;
  clearEvents: () => void;
  clearError: () => void;
}

const DEFAULT_OPTIONS: Required<UseRealtimeSyncOptions> = {
  autoConnect: true,
  reconnectAttempts: 5,
  reconnectDelay: 1000,
  heartbeatInterval: 30000, // 30 seconds
  enableEventBuffer: true,
  maxBufferSize: 1000,
  enablePersistence: true,
  debug: false,
};

export function useRealtimeSync(
  options: UseRealtimeSyncOptions = {}
): UseRealtimeSyncReturn {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<UseRealtimeSyncReturn['connectionStatus']>(null);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const [eventBuffer, setEventBuffer] = useState<RealtimeEvent[]>([]);
  const [stats, setStats] = useState<ConnectionStats | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [subscriptions, setSubscriptions] = useState<Set<string>>(new Set());
  
  // Refs
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const lastPingRef = useRef<number>(0);
  const eventListenersRef = useRef<Map<string, (data: any) => void>>(new Map());

  // Computed values
  const latestEvent = events.length > 0 ? events[events.length - 1] : null;

  // Debug logging
  const debug = useCallback((message: string, ...args: any[]) => {
    if (opts.debug) {
      console.log(`[useRealtimeSync] ${message}`, ...args);
    }
  }, [opts.debug]);

  // Event persistence
  const saveEventsToStorage = useCallback((events: RealtimeEvent[]) => {
    if (!opts.enablePersistence) return;
    
    try {
      const key = 'realtime-sync-events';
      const data = {
        events: events.slice(-100), // Keep last 100 events
        timestamp: Date.now(),
      };
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      debug('Failed to save events to storage:', error);
    }
  }, [opts.enablePersistence, debug]);

  const loadEventsFromStorage = useCallback((): RealtimeEvent[] => {
    if (!opts.enablePersistence) return [];
    
    try {
      const key = 'realtime-sync-events';
      const stored = localStorage.getItem(key);
      if (!stored) return [];
      
      const data = JSON.parse(stored);
      const ageMs = Date.now() - data.timestamp;
      
      // Only load events from the last hour
      if (ageMs > 3600000) return [];
      
      return data.events || [];
    } catch (error) {
      debug('Failed to load events from storage:', error);
      return [];
    }
  }, [opts.enablePersistence, debug]);

  // Socket connection management
  const createSocket = useCallback(() => {
    const socketUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 
                     `${window.location.protocol}//${window.location.host}`;
    
    debug('Creating socket connection to:', socketUrl);
    
    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: false, // Handle reconnection manually
      forceNew: true,
    });

    return socket;
  }, [debug]);

  const setupSocketListeners = useCallback((socket: Socket) => {
    // Connection events
    socket.on('connect', () => {
      debug('Socket connected:', socket.id);
      setIsConnected(true);
      setIsConnecting(false);
      setConnectionStatus('connected');
      setConnectionId(socket.id);
      setLastError(null);
      reconnectAttemptsRef.current = 0;
    });

    socket.on('disconnect', (reason) => {
      debug('Socket disconnected:', reason);
      setIsConnected(false);
      setIsConnecting(false);
      setConnectionStatus('disconnected');
      setConnectionId(null);
      
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, don't reconnect
        setLastError('Server disconnected the connection');
      } else {
        // Client side disconnect, attempt reconnection
        attemptReconnect();
      }
    });

    socket.on('connect_error', (error) => {
      debug('Socket connection error:', error);
      setIsConnected(false);
      setIsConnecting(false);
      setConnectionStatus('error');
      setLastError(error.message);
      attemptReconnect();
    });

    // Realtime events
    socket.on('event', (event: RealtimeEvent) => {
      debug('Received event:', event.type, event);
      
      const enhancedEvent = {
        ...event,
        timestamp: event.timestamp || Date.now(),
      };
      
      setEvents(prev => {
        const updated = [...prev, enhancedEvent];
        
        // Buffer management
        if (opts.enableEventBuffer) {
          setEventBuffer(prevBuffer => {
            const buffered = [...prevBuffer, enhancedEvent];
            return buffered.slice(-opts.maxBufferSize);
          });
        }
        
        // Persistence
        saveEventsToStorage(updated);
        
        return updated.slice(-opts.maxBufferSize);
      });
    });

    // Connection status
    socket.on('connected', (data) => {
      debug('Connected with capabilities:', data.capabilities);
      setConnectionId(data.connectionId);
    });

    // Subscription confirmations
    socket.on('subscribed', (data) => {
      debug('Subscribed to room:', data.room);
      setSubscriptions(prev => new Set([...prev, data.room]));
    });

    socket.on('unsubscribed', (data) => {
      debug('Unsubscribed from room:', data.room);
      setSubscriptions(prev => {
        const updated = new Set(prev);
        updated.delete(data.room);
        return updated;
      });
    });

    // Error handling
    socket.on('error', (error) => {
      debug('Socket error:', error);
      setLastError(error.message || 'Unknown socket error');
    });

    socket.on('subscription_error', (error) => {
      debug('Subscription error:', error);
      setLastError(`Subscription error: ${error.message}`);
    });

    // Heartbeat/ping handling
    socket.on('pong', (data) => {
      if (lastPingRef.current) {
        const currentLatency = Date.now() - lastPingRef.current;
        setLatency(currentLatency);
        debug('Latency:', currentLatency + 'ms');
      }
    });

    // Server shutdown
    socket.on('server_shutdown', (data) => {
      debug('Server shutdown:', data.message);
      setLastError('Server is shutting down');
      setConnectionStatus('disconnected');
    });

    // Force disconnect
    socket.on('force_disconnect', (data) => {
      debug('Force disconnect:', data.reason);
      setLastError(`Force disconnect: ${data.reason}`);
      disconnect();
    });
  }, [debug, opts.enableEventBuffer, opts.maxBufferSize, saveEventsToStorage]);

  const attemptReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= opts.reconnectAttempts) {
      debug('Maximum reconnection attempts reached');
      setConnectionStatus('error');
      setLastError('Maximum reconnection attempts reached');
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const delay = opts.reconnectDelay * Math.pow(2, reconnectAttemptsRef.current);
    debug(`Attempting reconnection in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1})`);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectAttemptsRef.current++;
      connect();
    }, delay);
  }, [opts.reconnectAttempts, opts.reconnectDelay, debug]);

  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    heartbeatIntervalRef.current = setInterval(() => {
      if (socketRef.current && isConnected) {
        lastPingRef.current = Date.now();
        socketRef.current.emit('ping');
      }
    }, opts.heartbeatInterval);
  }, [isConnected, opts.heartbeatInterval]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // Public methods
  const connect = useCallback(() => {
    if (isConnected || isConnecting) return;
    
    debug('Connecting to WebSocket...');
    setIsConnecting(true);
    setConnectionStatus('connecting');
    setLastError(null);

    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socket = createSocket();
    setupSocketListeners(socket);
    socketRef.current = socket;
    
    socket.connect();
  }, [isConnected, isConnecting, debug, createSocket, setupSocketListeners]);

  const disconnect = useCallback(() => {
    debug('Disconnecting from WebSocket...');
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    stopHeartbeat();
    
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    setIsConnected(false);
    setIsConnecting(false);
    setConnectionStatus('disconnected');
    setConnectionId(null);
    setSubscriptions(new Set());
    reconnectAttemptsRef.current = 0;
  }, [debug, stopHeartbeat]);

  const reconnect = useCallback(() => {
    debug('Manual reconnection requested');
    disconnect();
    setTimeout(connect, 100);
  }, [debug, disconnect, connect]);

  const subscribe = useCallback(async (subscription: Subscription) => {
    if (!socketRef.current || !isConnected) {
      throw new Error('Not connected to WebSocket');
    }
    
    debug('Subscribing to room:', subscription.room);
    socketRef.current.emit('subscribe', subscription);
  }, [isConnected, debug]);

  const unsubscribe = useCallback((room: string) => {
    if (!socketRef.current || !isConnected) return;
    
    debug('Unsubscribing from room:', room);
    socketRef.current.emit('unsubscribe', room);
  }, [isConnected, debug]);

  const sendEvent = useCallback((event: Omit<RealtimeEvent, 'timestamp'>) => {
    if (!socketRef.current || !isConnected) {
      throw new Error('Not connected to WebSocket');
    }
    
    const fullEvent = {
      ...event,
      timestamp: Date.now(),
    };
    
    debug('Sending event:', fullEvent.type);
    socketRef.current.emit('client_event', fullEvent);
  }, [isConnected, debug]);

  const clearEvents = useCallback(() => {
    setEvents([]);
    setEventBuffer([]);
    
    if (opts.enablePersistence) {
      try {
        localStorage.removeItem('realtime-sync-events');
      } catch (error) {
        debug('Failed to clear events from storage:', error);
      }
    }
  }, [opts.enablePersistence, debug]);

  const clearError = useCallback(() => {
    setLastError(null);
  }, []);

  // Effects
  useEffect(() => {
    if (opts.autoConnect) {
      connect();
    }

    // Load persisted events
    const persistedEvents = loadEventsFromStorage();
    if (persistedEvents.length > 0) {
      setEvents(persistedEvents);
      if (opts.enableEventBuffer) {
        setEventBuffer(persistedEvents);
      }
    }

    return () => {
      disconnect();
    };
  }, []); // Only run on mount

  useEffect(() => {
    if (isConnected) {
      startHeartbeat();
    } else {
      stopHeartbeat();
    }

    return stopHeartbeat;
  }, [isConnected, startHeartbeat, stopHeartbeat]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      stopHeartbeat();
    };
  }, [stopHeartbeat]);

  return {
    // Connection state
    isConnected,
    isConnecting,
    connectionStatus,
    connectionId,
    lastError,
    
    // Events
    events,
    latestEvent,
    eventBuffer,
    
    // Statistics
    stats,
    latency,
    
    // Subscriptions
    subscriptions,
    
    // Actions
    connect,
    disconnect,
    reconnect,
    subscribe,
    unsubscribe,
    sendEvent,
    clearEvents,
    clearError,
  };
}