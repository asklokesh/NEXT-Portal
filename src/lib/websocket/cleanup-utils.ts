/**
 * WebSocket Cleanup Utilities
 * 
 * Provides robust utilities for managing WebSocket event listeners and cleanup
 * to prevent memory leaks and TypeError issues during component unmount.
 */

import { EventEmitter } from 'events';

export interface WebSocketEventListener<T = any> {
  eventType: string;
  listener: (data: T) => void;
  options?: {
    once?: boolean;
    priority?: 'low' | 'normal' | 'high';
  };
}

export interface WebSocketCleanupManager {
  addListener<T = any>(client: EventEmitter, eventType: string, listener: (data: T) => void, options?: WebSocketEventListener<T>['options']): void;
  removeListener(client: EventEmitter, eventType: string): boolean;
  removeAllListeners(client: EventEmitter): boolean;
  getListenerCount(): number;
  clear(): void;
}

/**
 * Creates a WebSocket cleanup manager that safely handles event listener lifecycle
 */
export function createWebSocketCleanupManager(): WebSocketCleanupManager {
  const listeners = new Map<string, WebSocketEventListener>();

  return {
    /**
     * Adds an event listener with automatic cleanup tracking
     */
    addListener<T = any>(
      client: EventEmitter, 
      eventType: string, 
      listener: (data: T) => void, 
      options?: WebSocketEventListener<T>['options']
    ): void {
      if (!client || typeof client.on !== 'function') {
        console.warn('Invalid WebSocket client provided to cleanup manager');
        return;
      }

      if (!eventType || typeof eventType !== 'string') {
        console.warn('Invalid event type provided to cleanup manager');
        return;
      }

      if (!listener || typeof listener !== 'function') {
        console.warn('Invalid listener function provided to cleanup manager');
        return;
      }

      try {
        // Wrap the listener with error handling
        const wrappedListener = (data: T) => {
          try {
            listener(data);
          } catch (error) {
            console.error(`Error in WebSocket listener for ${eventType}:`, error);
          }
        };

        // Store the wrapped listener for cleanup
        listeners.set(eventType, {
          eventType,
          listener: wrappedListener,
          options
        });

        // Add the listener to the client
        if (options?.once) {
          client.once(eventType, wrappedListener);
        } else {
          client.on(eventType, wrappedListener);
        }
      } catch (error) {
        console.error(`Failed to add WebSocket listener for ${eventType}:`, error);
      }
    },

    /**
     * Removes a specific event listener safely
     */
    removeListener(client: EventEmitter, eventType: string): boolean {
      if (!client || typeof client.off !== 'function') {
        console.warn('Invalid WebSocket client provided for listener removal');
        return false;
      }

      const listenerData = listeners.get(eventType);
      if (!listenerData) {
        console.warn(`No listener found for event type: ${eventType}`);
        return false;
      }

      try {
        client.off(eventType, listenerData.listener);
        listeners.delete(eventType);
        return true;
      } catch (error) {
        console.error(`Failed to remove WebSocket listener for ${eventType}:`, error);
        return false;
      }
    },

    /**
     * Removes all tracked listeners from the client safely
     */
    removeAllListeners(client: EventEmitter): boolean {
      if (!client || typeof client.off !== 'function') {
        console.warn('Invalid WebSocket client provided for cleanup');
        return false;
      }

      let allRemoved = true;
      const eventTypes = Array.from(listeners.keys());

      for (const eventType of eventTypes) {
        const listenerData = listeners.get(eventType);
        if (listenerData) {
          try {
            client.off(eventType, listenerData.listener);
            listeners.delete(eventType);
          } catch (error) {
            console.error(`Failed to remove WebSocket listener for ${eventType}:`, error);
            allRemoved = false;
          }
        }
      }

      return allRemoved;
    },

    /**
     * Returns the number of tracked listeners
     */
    getListenerCount(): number {
      return listeners.size;
    },

    /**
     * Clears all tracked listeners without removing them from client
     * (useful when client is already disconnected)
     */
    clear(): void {
      listeners.clear();
    }
  };
}

/**
 * Safe WebSocket event listener removal utility
 */
export function safeRemoveListener(
  client: EventEmitter | null | undefined,
  eventType: string,
  listener: Function | null | undefined
): boolean {
  if (!client || typeof client.off !== 'function') {
    return false;
  }

  if (!eventType || typeof eventType !== 'string') {
    return false;
  }

  if (!listener || typeof listener !== 'function') {
    return false;
  }

  try {
    client.off(eventType, listener);
    return true;
  } catch (error) {
    console.error(`Safe remove listener failed for ${eventType}:`, error);
    return false;
  }
}

/**
 * Safe WebSocket subscription cleanup utility
 */
export function safeUnsubscribe(
  client: { unsubscribe?: (topic: string) => void } | null | undefined,
  topic: string
): boolean {
  if (!client || typeof client.unsubscribe !== 'function') {
    return false;
  }

  if (!topic || typeof topic !== 'string') {
    return false;
  }

  try {
    client.unsubscribe(topic);
    return true;
  } catch (error) {
    console.error(`Safe unsubscribe failed for ${topic}:`, error);
    return false;
  }
}

/**
 * Validates WebSocket client for safe operations
 */
export function validateWebSocketClient(client: any): client is EventEmitter {
  return (
    client &&
    typeof client === 'object' &&
    typeof client.on === 'function' &&
    typeof client.off === 'function' &&
    typeof client.emit === 'function'
  );
}

/**
 * React hook cleanup utility for WebSocket managers
 */
export function createWebSocketHookCleanup() {
  let cleanupManager: WebSocketCleanupManager | null = null;
  
  return {
    /**
     * Gets or creates the cleanup manager
     */
    getManager(): WebSocketCleanupManager {
      if (!cleanupManager) {
        cleanupManager = createWebSocketCleanupManager();
      }
      return cleanupManager;
    },

    /**
     * Creates a cleanup function for React useEffect
     */
    createCleanupFunction(client: EventEmitter | null | undefined): (() => void) {
      return () => {
        if (cleanupManager && client) {
          cleanupManager.removeAllListeners(client);
          cleanupManager.clear();
        }
        cleanupManager = null;
      };
    }
  };
}

/**
 * Error boundary for WebSocket operations
 */
export function withWebSocketErrorBoundary<T extends any[], R>(
  operation: (...args: T) => R,
  fallback?: R
): (...args: T) => R {
  return (...args: T): R => {
    try {
      return operation(...args);
    } catch (error) {
      console.error('WebSocket operation error:', error);
      return fallback as R;
    }
  };
}