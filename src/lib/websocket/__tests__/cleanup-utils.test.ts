/**
 * Test suite for WebSocket cleanup utilities
 * Critical for preventing WebSocket listener cleanup issues
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  createWebSocketCleanupManager,
  safeRemoveListener,
  safeUnsubscribe,
  validateWebSocketClient,
  createWebSocketHookCleanup,
  withWebSocketErrorBoundary,
} from '../cleanup-utils';
import { EventEmitter } from 'events';

describe('WebSocket Cleanup Utilities', () => {
  let mockClient: EventEmitter;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    mockClient = new EventEmitter();
    consoleSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    mockClient.removeAllListeners();
  });

  describe('createWebSocketCleanupManager', () => {
    it('should create a cleanup manager with all required methods', () => {
      const manager = createWebSocketCleanupManager();

      expect(manager.addListener).toBeInstanceOf(Function);
      expect(manager.removeListener).toBeInstanceOf(Function);
      expect(manager.removeAllListeners).toBeInstanceOf(Function);
      expect(manager.getListenerCount).toBeInstanceOf(Function);
      expect(manager.clear).toBeInstanceOf(Function);
    });

    it('should add and track listeners correctly', () => {
      const manager = createWebSocketCleanupManager();
      const testListener = jest.fn();

      manager.addListener(mockClient, 'test-event', testListener);

      expect(manager.getListenerCount()).toBe(1);
      expect(mockClient.listenerCount('test-event')).toBe(1);
    });

    it('should remove individual listeners safely', () => {
      const manager = createWebSocketCleanupManager();
      const testListener = jest.fn();

      manager.addListener(mockClient, 'test-event', testListener);
      expect(manager.getListenerCount()).toBe(1);

      const removed = manager.removeListener(mockClient, 'test-event');

      expect(removed).toBe(true);
      expect(manager.getListenerCount()).toBe(0);
      expect(mockClient.listenerCount('test-event')).toBe(0);
    });

    it('should remove all listeners safely', () => {
      const manager = createWebSocketCleanupManager();
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      manager.addListener(mockClient, 'event1', listener1);
      manager.addListener(mockClient, 'event2', listener2);

      expect(manager.getListenerCount()).toBe(2);

      const allRemoved = manager.removeAllListeners(mockClient);

      expect(allRemoved).toBe(true);
      expect(manager.getListenerCount()).toBe(0);
      expect(mockClient.listenerCount('event1')).toBe(0);
      expect(mockClient.listenerCount('event2')).toBe(0);
    });

    it('should handle errors in listener execution gracefully', () => {
      const manager = createWebSocketCleanupManager();
      const errorListener = jest.fn(() => {
        throw new Error('Listener error');
      });

      manager.addListener(mockClient, 'test-event', errorListener);

      // Emit event that will cause listener to throw
      mockClient.emit('test-event', 'test-data');

      // Should have logged the error but not crashed
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error in WebSocket listener for test-event:'),
        expect.any(Error)
      );
    });

    it('should handle invalid client gracefully', () => {
      const manager = createWebSocketCleanupManager();
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Try to add listener with null client
      manager.addListener(null as any, 'test-event', jest.fn());

      expect(warnSpy).toHaveBeenCalledWith('Invalid WebSocket client provided to cleanup manager');
      expect(manager.getListenerCount()).toBe(0);

      warnSpy.mockRestore();
    });

    it('should handle invalid event types gracefully', () => {
      const manager = createWebSocketCleanupManager();
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      manager.addListener(mockClient, '', jest.fn());
      manager.addListener(mockClient, null as any, jest.fn());

      expect(warnSpy).toHaveBeenCalledWith('Invalid event type provided to cleanup manager');
      expect(manager.getListenerCount()).toBe(0);

      warnSpy.mockRestore();
    });

    it('should handle invalid listeners gracefully', () => {
      const manager = createWebSocketCleanupManager();
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      manager.addListener(mockClient, 'test-event', null as any);
      manager.addListener(mockClient, 'test-event', undefined as any);

      expect(warnSpy).toHaveBeenCalledWith('Invalid listener function provided to cleanup manager');
      expect(manager.getListenerCount()).toBe(0);

      warnSpy.mockRestore();
    });

    it('should support once listeners', () => {
      const manager = createWebSocketCleanupManager();
      const testListener = jest.fn();

      manager.addListener(mockClient, 'test-event', testListener, { once: true });

      // Emit twice, listener should only be called once
      mockClient.emit('test-event', 'data1');
      mockClient.emit('test-event', 'data2');

      expect(testListener).toHaveBeenCalledTimes(1);
      expect(testListener).toHaveBeenCalledWith('data1');
    });
  });

  describe('safeRemoveListener', () => {
    it('should safely remove valid listeners', () => {
      const testListener = jest.fn();
      mockClient.on('test-event', testListener);

      const result = safeRemoveListener(mockClient, 'test-event', testListener);

      expect(result).toBe(true);
      expect(mockClient.listenerCount('test-event')).toBe(0);
    });

    it('should handle null client safely', () => {
      const result = safeRemoveListener(null, 'test-event', jest.fn());
      expect(result).toBe(false);
    });

    it('should handle invalid event type safely', () => {
      const result = safeRemoveListener(mockClient, '', jest.fn());
      expect(result).toBe(false);
    });

    it('should handle null listener safely', () => {
      const result = safeRemoveListener(mockClient, 'test-event', null);
      expect(result).toBe(false);
    });

    it('should handle removal errors gracefully', () => {
      const mockClientWithError = {
        off: jest.fn(() => {
          throw new Error('Removal failed');
        })
      };

      const result = safeRemoveListener(mockClientWithError as any, 'test-event', jest.fn());

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Safe remove listener failed for test-event:',
        expect.any(Error)
      );
    });
  });

  describe('safeUnsubscribe', () => {
    it('should safely unsubscribe from valid topics', () => {
      const mockClientWithUnsubscribe = {
        unsubscribe: jest.fn()
      };

      const result = safeUnsubscribe(mockClientWithUnsubscribe, 'test-topic');

      expect(result).toBe(true);
      expect(mockClientWithUnsubscribe.unsubscribe).toHaveBeenCalledWith('test-topic');
    });

    it('should handle null client safely', () => {
      const result = safeUnsubscribe(null, 'test-topic');
      expect(result).toBe(false);
    });

    it('should handle missing unsubscribe method safely', () => {
      const result = safeUnsubscribe({}, 'test-topic');
      expect(result).toBe(false);
    });

    it('should handle invalid topic safely', () => {
      const mockClientWithUnsubscribe = {
        unsubscribe: jest.fn()
      };

      const result = safeUnsubscribe(mockClientWithUnsubscribe, '');
      expect(result).toBe(false);
    });

    it('should handle unsubscribe errors gracefully', () => {
      const mockClientWithError = {
        unsubscribe: jest.fn(() => {
          throw new Error('Unsubscribe failed');
        })
      };

      const result = safeUnsubscribe(mockClientWithError, 'test-topic');

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Safe unsubscribe failed for test-topic:',
        expect.any(Error)
      );
    });
  });

  describe('validateWebSocketClient', () => {
    it('should validate proper EventEmitter instances', () => {
      expect(validateWebSocketClient(mockClient)).toBe(true);
    });

    it('should reject null/undefined clients', () => {
      // Note: validateWebSocketClient returns falsy values for invalid clients
      expect(validateWebSocketClient(null)).toBeFalsy();
      expect(validateWebSocketClient(undefined)).toBeFalsy();
    });

    it('should reject objects missing required methods', () => {
      expect(validateWebSocketClient({})).toBe(false);
      expect(validateWebSocketClient({ on: jest.fn() })).toBe(false);
      expect(validateWebSocketClient({ on: jest.fn(), off: jest.fn() })).toBe(false);
    });

    it('should validate objects with all required methods', () => {
      const validClient = {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      };

      expect(validateWebSocketClient(validClient)).toBe(true);
    });
  });

  describe('createWebSocketHookCleanup', () => {
    it('should create a hook cleanup utility', () => {
      const hookCleanup = createWebSocketHookCleanup();

      expect(hookCleanup.getManager).toBeInstanceOf(Function);
      expect(hookCleanup.createCleanupFunction).toBeInstanceOf(Function);
    });

    it('should provide consistent manager instance', () => {
      const hookCleanup = createWebSocketHookCleanup();

      const manager1 = hookCleanup.getManager();
      const manager2 = hookCleanup.getManager();

      expect(manager1).toBe(manager2);
    });

    it('should create cleanup function that removes all listeners', () => {
      const hookCleanup = createWebSocketHookCleanup();
      const manager = hookCleanup.getManager();

      // Add some listeners
      manager.addListener(mockClient, 'event1', jest.fn());
      manager.addListener(mockClient, 'event2', jest.fn());

      expect(manager.getListenerCount()).toBe(2);

      // Create and execute cleanup function
      const cleanup = hookCleanup.createCleanupFunction(mockClient);
      cleanup();

      // Manager should be reset
      const newManager = hookCleanup.getManager();
      expect(newManager.getListenerCount()).toBe(0);
    });

    it('should handle null client in cleanup function', () => {
      const hookCleanup = createWebSocketHookCleanup();
      const cleanup = hookCleanup.createCleanupFunction(null);

      // Should not throw
      expect(() => cleanup()).not.toThrow();
    });
  });

  describe('withWebSocketErrorBoundary', () => {
    it('should execute operation normally when no error occurs', () => {
      const operation = jest.fn((a: number, b: number) => a + b);
      const wrappedOperation = withWebSocketErrorBoundary(operation);

      const result = wrappedOperation(2, 3);

      expect(result).toBe(5);
      expect(operation).toHaveBeenCalledWith(2, 3);
    });

    it('should catch errors and return fallback', () => {
      const operation = jest.fn(() => {
        throw new Error('Operation failed');
      });
      const wrappedOperation = withWebSocketErrorBoundary(operation, 'fallback');

      const result = wrappedOperation();

      expect(result).toBe('fallback');
      expect(consoleSpy).toHaveBeenCalledWith('WebSocket operation error:', expect.any(Error));
    });

    it('should return undefined when no fallback provided', () => {
      const operation = jest.fn(() => {
        throw new Error('Operation failed');
      });
      const wrappedOperation = withWebSocketErrorBoundary(operation);

      const result = wrappedOperation();

      expect(result).toBeUndefined();
    });

    it('should preserve function signature', () => {
      const operation = (a: string, b: number): string => `${a}-${b}`;
      const wrappedOperation = withWebSocketErrorBoundary(operation, 'error');

      const result = wrappedOperation('test', 123);

      expect(result).toBe('test-123');
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete WebSocket lifecycle without errors', () => {
      const hookCleanup = createWebSocketHookCleanup();
      const manager = hookCleanup.getManager();

      // Add multiple listeners
      const listeners = [
        jest.fn(),
        jest.fn(),
        jest.fn(),
      ];

      listeners.forEach((listener, index) => {
        manager.addListener(mockClient, `event-${index}`, listener);
      });

      expect(manager.getListenerCount()).toBe(3);

      // Emit events
      mockClient.emit('event-0', 'data0');
      mockClient.emit('event-1', 'data1');
      mockClient.emit('event-2', 'data2');

      expect(listeners[0]).toHaveBeenCalledWith('data0');
      expect(listeners[1]).toHaveBeenCalledWith('data1');
      expect(listeners[2]).toHaveBeenCalledWith('data2');

      // Clean up
      const cleanup = hookCleanup.createCleanupFunction(mockClient);
      expect(() => cleanup()).not.toThrow();

      // Verify no listeners remain
      expect(mockClient.listenerCount('event-0')).toBe(0);
      expect(mockClient.listenerCount('event-1')).toBe(0);
      expect(mockClient.listenerCount('event-2')).toBe(0);
    });
  });
});
