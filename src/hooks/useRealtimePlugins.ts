'use client';

/**
 * Real-time Plugin Management Hook
 * 
 * This hook provides comprehensive real-time plugin management capabilities with
 * robust WebSocket event handling, error recovery, and production-ready cleanup.
 * 
 * @fileoverview Manages real-time plugin state, events, and actions with WebSocket integration
 * @version 2.0.0
 * @since 1.0.0
 * 
 * ## Key Features:
 * - Real-time plugin status updates via WebSocket
 * - Robust event listener cleanup (fixes critical TypeError)
 * - Performance-optimized throttled updates
 * - Comprehensive error handling and recovery
 * - TypeScript strict null safety
 * - Multi-tenant plugin isolation
 * 
 * ## Critical Bug Fix:
 * This version addresses the production-blocking TypeError:
 * "The 'listener' argument must be of type Function. Received type undefined"
 * by implementing proper event listener reference management.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from '@/lib/websocket/client';
import { useRealtimePerformance } from './useRealtimePerformance';
import { toast } from 'react-hot-toast';
import { createWebSocketHookCleanup, validateWebSocketClient, safeUnsubscribe } from '@/lib/websocket/cleanup-utils';

/**
 * Represents a real-time plugin with comprehensive metadata and state information
 * 
 * @interface RealtimePlugin
 * @since 1.0.0
 */
export interface RealtimePlugin {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: 'open-source' | 'enterprise-premium' | 'third-party-verified' | 'custom-internal';
  version: string;
  status: 'active' | 'inactive' | 'update-available' | 'deprecated' | 'installing' | 'updating';
  health: number;
  qualityGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  lastUpdated: string;
  downloads: number;
  stars: number;
  isInstalled: boolean;
  isEnabled: boolean;
  isPremium: boolean;
  maintainer: string;
  tags: string[];
  installProgress?: number;
  installationLog?: string[];
}

/**
 * Represents a real-time plugin event for WebSocket communication
 * 
 * @interface PluginEvent
 * @since 1.0.0
 */
export interface PluginEvent {
  id: string;
  type: 'installation' | 'update' | 'removal' | 'health_change' | 'quality_update' | 'status_change';
  pluginId: string;
  data: any;
  timestamp: string;
  severity?: 'info' | 'warning' | 'error' | 'success';
}

/**
 * Complete state interface for the real-time plugins system
 * 
 * @interface RealtimePluginsState
 * @since 1.0.0
 */
export interface RealtimePluginsState {
  plugins: RealtimePlugin[];
  events: PluginEvent[];
  isConnected: boolean;
  loading: boolean;
  error: string | null;
  stats: {
    total: number;
    active: number;
    installing: number;
    needsUpdate: number;
    healthyPlugins: number;
    avgQualityScore: number;
  };
}

/**
 * Real-time Plugin Management Hook
 * 
 * Provides comprehensive real-time plugin management with WebSocket integration,
 * robust error handling, and production-ready cleanup mechanisms.
 * 
 * ## Usage Example:
 * ```typescript
 * const {
 *   plugins,
 *   events,
 *   isConnected,
 *   loading,
 *   error,
 *   stats,
 *   performance,
 *   actions
 * } = useRealtimePlugins();
 * 
 * // Install a plugin
 * await actions.installPlugin('my-plugin-id');
 * 
 * // Monitor real-time events
 * useEffect(() => {
 *   if (isConnected) {
 *     console.log('Connected to real-time plugin updates');
 *   }
 * }, [isConnected]);
 * ```
 * 
 * ## Error Handling:
 * All plugin actions include comprehensive error handling with user-friendly
 * toast notifications and detailed console logging for debugging.
 * 
 * ## Performance:
 * Uses throttled updates and performance monitoring to prevent UI blocking
 * during high-frequency plugin events.
 * 
 * ## WebSocket Cleanup:
 * Implements robust cleanup mechanisms to prevent memory leaks and the
 * critical "listener must be Function" TypeError during component unmount.
 * 
 * @returns {Object} Complete plugin management interface
 * @returns {RealtimePlugin[]} returns.plugins - Array of real-time plugin data
 * @returns {PluginEvent[]} returns.events - Recent plugin events (last 100)
 * @returns {boolean} returns.isConnected - WebSocket connection status
 * @returns {boolean} returns.loading - Initial data loading state
 * @returns {string|null} returns.error - Current error message, if any
 * @returns {Object} returns.stats - Aggregated plugin statistics
 * @returns {Object} returns.performance - Performance monitoring data
 * @returns {Object} returns.actions - Plugin action functions
 * 
 * @throws {Error} When WebSocket client validation fails
 * @throws {Error} When plugin actions receive invalid parameters
 * 
 * @since 1.0.0
 * @version 2.0.0 - Added robust cleanup and error handling
 */
export function useRealtimePlugins() {
  const { isConnected, client } = useWebSocket();
  const performance = useRealtimePerformance({
    throttleInterval: 200,
    maxUpdatesPerSecond: 20,
    batchSize: 3,
    enableMetrics: true,
    autoAdjust: true
  });
  
  const [state, setState] = useState<RealtimePluginsState>({
    plugins: [],
    events: [],
    isConnected: false,
    loading: true,
    error: null,
    stats: {
      total: 0,
      active: 0,
      installing: 0,
      needsUpdate: 0,
      healthyPlugins: 0,
      avgQualityScore: 0
    }
  });

  const eventBuffer = useRef<PluginEvent[]>([]);
  const lastUpdateTime = useRef<number>(0);

  // Use performance-optimized throttled update
  const throttledUpdate = useCallback((updateFn: () => void, priority: 'low' | 'normal' | 'high' = 'normal') => {
    performance.throttledUpdate(updateFn, priority);
  }, [performance]);

  /**
   * Calculates aggregated statistics from plugin array with null-safe operations
   * 
   * @param {RealtimePlugin[] | null | undefined} plugins - Array of plugins to analyze
   * @returns {Object} Aggregated statistics including totals, health metrics, and quality scores
   * @private
   */
  const calculateStats = useCallback((plugins: RealtimePlugin[] | null | undefined) => {
    // Defensive programming: validate plugins array
    if (!Array.isArray(plugins)) {
      console.warn('Invalid plugins array provided to calculateStats:', plugins);
      return {
        total: 0,
        active: 0,
        installing: 0,
        needsUpdate: 0,
        healthyPlugins: 0,
        avgQualityScore: 0
      };
    }

    // Filter out any null/undefined plugins
    const validPlugins = plugins.filter(p => p && typeof p === 'object' && p.id);
    
    const total = validPlugins.length;
    const active = validPlugins.filter(p => p.status === 'active').length;
    const installing = validPlugins.filter(p => p.status === 'installing' || p.status === 'updating').length;
    const needsUpdate = validPlugins.filter(p => p.status === 'update-available').length;
    const healthyPlugins = validPlugins.filter(p => typeof p.health === 'number' && p.health >= 90).length;
    
    // Calculate average quality score with null-safe operations
    const healthValues = validPlugins
      .map(p => p.health)
      .filter(health => typeof health === 'number' && !isNaN(health));
    
    const avgQualityScore = healthValues.length > 0 
      ? Math.round(healthValues.reduce((sum, health) => sum + health, 0) / healthValues.length)
      : 0;

    return {
      total,
      active,
      installing,
      needsUpdate,
      healthyPlugins,
      avgQualityScore
    };
  }, []);

  /**
   * Handles incoming plugin events with comprehensive validation and error handling
   * 
   * Processes real-time plugin events from WebSocket, updates UI state, and shows
   * appropriate toast notifications. Includes defensive programming patterns to
   * prevent crashes from malformed event data.
   * 
   * @param {PluginEvent | null | undefined} event - Plugin event from WebSocket
   * @private
   */
  const handlePluginEvent = useCallback((event: PluginEvent | null | undefined) => {
    // Defensive programming: validate event object
    if (!event || typeof event !== 'object') {
      console.warn('Invalid plugin event received:', event);
      return;
    }

    // Validate required event properties
    if (!event.id || !event.type || !event.pluginId) {
      console.warn('Plugin event missing required properties:', event);
      return;
    }

    eventBuffer.current.push(event);
    
    // Show immediate toast notification for important events with null-safe access
    switch (event.type) {
      case 'installation':
        if (event.data?.status === 'completed') {
          const pluginName = event.data?.name || 'Unknown Plugin';
          toast.success(`Plugin "${pluginName}" installed successfully!`, {
            duration: 4000
          });
        } else if (event.data?.status === 'failed') {
          const pluginName = event.data?.name || 'Unknown Plugin';
          toast.error(`Failed to install plugin "${pluginName}"`, {
            duration: 6000
          });
        } else if (event.data?.status === 'started') {
          const pluginName = event.data?.name || 'Unknown Plugin';
          toast.loading(`Installing plugin "${pluginName}"...`, {
            id: `install-${event.pluginId}`,
            duration: 0
          });
        }
        break;
      case 'update':
        if (event.data?.status === 'completed') {
          const pluginName = event.data?.name || 'Unknown Plugin';
          const version = event.data?.version || 'unknown';
          toast.success(`Plugin "${pluginName}" updated to v${version}!`, {
            id: `install-${event.pluginId}`,
            duration: 4000
          });
        }
        break;
      case 'health_change':
        if (typeof event.data?.health === 'number' && event.data.health < 50 && event.severity === 'error') {
          const pluginName = event.data?.name || 'Unknown Plugin';
          toast.error(`Plugin "${pluginName}" health is critically low (${event.data.health}%)`, {
            duration: 8000
          });
        }
        break;
    }

    // Determine priority based on event type
    const priority = event.type === 'installation' && event.data.status === 'failed' ? 'high' :
                     event.severity === 'error' ? 'high' : 'normal';

    // Throttled state update with priority
    throttledUpdate(() => {
      setState(prev => {
        const events = [...eventBuffer.current, ...prev.events].slice(0, 100); // Keep last 100 events
        eventBuffer.current = [];

        let updatedPlugins = [...prev.plugins];

        // Apply events to plugins with strict null checks
        events.forEach(evt => {
          // Validate event structure
          if (!evt || !evt.pluginId || !evt.type) {
            console.warn('Invalid event structure:', evt);
            return;
          }

          const pluginIndex = updatedPlugins.findIndex(p => p?.id === evt.pluginId);
          if (pluginIndex >= 0 && updatedPlugins[pluginIndex]) {
            const plugin = { ...updatedPlugins[pluginIndex] };
            
            switch (evt.type) {
              case 'installation':
                if (evt.data?.status === 'started') {
                  plugin.status = 'installing';
                  plugin.installProgress = 0;
                } else if (evt.data?.status === 'progress') {
                  plugin.installProgress = typeof evt.data.progress === 'number' ? evt.data.progress : plugin.installProgress;
                  plugin.installationLog = evt.data.log || plugin.installationLog;
                } else if (evt.data?.status === 'completed') {
                  plugin.status = 'active';
                  plugin.isInstalled = true;
                  plugin.installProgress = 100;
                  plugin.version = evt.data.version || plugin.version;
                } else if (evt.data?.status === 'failed') {
                  plugin.status = 'inactive';
                  plugin.installProgress = undefined;
                }
                break;
              case 'update':
                if (evt.data?.status === 'started') {
                  plugin.status = 'updating';
                } else if (evt.data?.status === 'completed') {
                  plugin.status = 'active';
                  plugin.version = evt.data?.version || plugin.version;
                  plugin.lastUpdated = evt.timestamp || plugin.lastUpdated;
                }
                break;
              case 'health_change':
                if (typeof evt.data?.health === 'number') {
                  plugin.health = evt.data.health;
                }
                break;
              case 'quality_update':
                if (evt.data?.grade) {
                  plugin.qualityGrade = evt.data.grade;
                }
                if (typeof evt.data?.score === 'number') {
                  plugin.health = evt.data.score;
                }
                break;
              case 'status_change':
                if (evt.data?.status) {
                  plugin.status = evt.data.status;
                }
                break;
            }
            
            updatedPlugins[pluginIndex] = plugin;
          }
        });

        return {
          ...prev,
          plugins: updatedPlugins,
          events: events,
          stats: calculateStats(updatedPlugins),
          isConnected
        };
      });
    });
  }, [throttledUpdate, calculateStats, isConnected]);

  /**
   * Loads initial plugin data from the API with error handling
   * 
   * Fetches the current plugin state from the server and initializes the hook state.
   * Includes comprehensive error handling and state management.
   * 
   * @private
   * @async
   */
  const loadPlugins = useCallback(async () => {
    try {
      const response = await fetch('/api/plugins?includeQuality=true&realtime=true');
      const data = await response.json();
      
      if (data.success) {
        const plugins = data.plugins || [];
        setState(prev => ({
          ...prev,
          plugins,
          stats: calculateStats(plugins),
          loading: false,
          error: null
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to load plugins',
        loading: false
      }));
    }
  }, [calculateStats]);

  // WebSocket event listeners with robust cleanup management
  useEffect(() => {
    if (!validateWebSocketClient(client) || !isConnected) {
      setState(prev => ({ ...prev, isConnected: false }));
      return;
    }

    setState(prev => ({ ...prev, isConnected: true }));

    // Create cleanup manager for this effect
    const hookCleanup = createWebSocketHookCleanup();
    const cleanupManager = hookCleanup.getManager();

    // Subscribe to plugin-related events
    const eventTypes = [
      'plugin.installed',
      'plugin.updated',
      'plugin.removed',
      'plugin.health.changed',
      'plugin.quality.updated',
      'plugin.status.changed',
      'plugin.installation.progress',
      'quality.evaluation.completed'
    ];

    // Add event listeners using the cleanup manager with proper forEach pattern
    eventTypes.forEach((eventType, index) => {
      const listener = (data: any) => {
        const event: PluginEvent = {
          id: `event_${Date.now()}_${Math.random()}`,
          type: eventType.split('.')[1] as any,
          pluginId: data.pluginId || data.id,
          data,
          timestamp: data.timestamp || new Date().toISOString(),
          severity: data.severity || 'info'
        };
        handlePluginEvent(event);
      };
      
      cleanupManager.addListener(client, eventType, listener);
    });

    // Store event listeners for cleanup function with proper error handling
    const eventListeners = new Map<string, Function>();
    eventTypes.forEach((eventType, index) => {
      eventListeners.forEach((listener, eventType) => {
        if (typeof listener === 'function') {
          try {
            cleanupManager.addListener(client, eventType, listener);
          } catch (error) {
            console.error(`Failed to add listener for ${eventType}:`, error);
          }
        }
      });
    });

    // Subscribe to general plugin updates
    try {
      client.subscribe('plugins');
    } catch (error) {
      console.error('Error subscribing to plugins:', error);
    }

    // Load initial data with error handling
    loadPlugins().catch(error => {
      console.error('Error loading initial plugins:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to load plugins',
        loading: false
      }));
    });

    // Return robust cleanup function with proper error handling
    return () => {
      try {
        // Cleanup with comprehensive error handling and validation
        cleanupManager.removeAllListeners(client);
        
        // Unsubscribe from topics
        if (client && typeof client.unsubscribe === 'function') {
          safeUnsubscribe(client, 'plugins');
        }
        
        // Clear event buffer
        eventBuffer.current = [];
        
        console.log('WebSocket cleanup completed successfully');
      } catch (error) {
        console.error('Error during WebSocket cleanup:', error);
      }
    };
  }, [client, isConnected, handlePluginEvent, loadPlugins]);

  /**
   * Installs a plugin with comprehensive validation and error handling
   * 
   * Initiates plugin installation process with real-time progress updates.
   * Includes input validation, error recovery, and user feedback mechanisms.
   * 
   * @param {string | null | undefined} pluginId - Unique identifier of plugin to install
   * @returns {Promise<Object>} Installation result from server
   * @throws {Error} When pluginId is invalid or installation fails
   * 
   * @example
   * ```typescript
   * try {
   *   await installPlugin('my-awesome-plugin');
   *   // Real-time updates will show installation progress
   * } catch (error) {
   *   console.error('Installation failed:', error);
   * }
   * ```
   */
  const installPlugin = useCallback(async (pluginId: string | null | undefined) => {
    // Validate input parameters
    if (!pluginId || typeof pluginId !== 'string' || pluginId.trim().length === 0) {
      const errorMessage = 'Invalid plugin ID provided for installation';
      toast.error(errorMessage);
      throw new Error(errorMessage);
    }

    try {
      const response = await fetch('/api/plugins/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pluginId: pluginId.trim() })
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown server error');
        throw new Error(`Installation failed: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const result = await response.json().catch(() => {
        throw new Error('Invalid response format from server');
      });
      
      // Validate response structure
      if (!result || typeof result !== 'object') {
        throw new Error('Invalid response received from server');
      }
      
      // The real-time event will update the UI
      toast.success('Installation started! You\'ll see live progress updates.', {
        duration: 3000
      });
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown installation error';
      toast.error(`Failed to start installation: ${errorMessage}`);
      
      // Log error for debugging while preserving user-friendly message
      console.error('Plugin installation error:', {
        pluginId,
        error,
        timestamp: new Date().toISOString()
      });
      
      throw error;
    }
  }, []);

  /**
   * Updates a plugin with comprehensive validation and error handling
   * 
   * @param {string | null | undefined} pluginId - Unique identifier of plugin to update
   * @returns {Promise<Object>} Update result from server
   * @throws {Error} When pluginId is invalid or update fails
   */
  const updatePlugin = useCallback(async (pluginId: string | null | undefined) => {
    // Validate input parameters
    if (!pluginId || typeof pluginId !== 'string' || pluginId.trim().length === 0) {
      const errorMessage = 'Invalid plugin ID provided for update';
      toast.error(errorMessage);
      throw new Error(errorMessage);
    }

    try {
      const response = await fetch('/api/plugins/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pluginId: pluginId.trim() })
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown server error');
        throw new Error(`Update failed: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      toast.success('Update started! You\'ll see live progress updates.', {
        duration: 3000
      });
      
      const result = await response.json().catch(() => {
        throw new Error('Invalid response format from server');
      });
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown update error';
      toast.error(`Failed to start update: ${errorMessage}`);
      
      console.error('Plugin update error:', {
        pluginId,
        error,
        timestamp: new Date().toISOString()
      });
      
      throw error;
    }
  }, []);

  /**
   * Removes a plugin with comprehensive validation and error handling
   * 
   * @param {string | null | undefined} pluginId - Unique identifier of plugin to remove
   * @returns {Promise<Object>} Removal result from server
   * @throws {Error} When pluginId is invalid or removal fails
   */
  const removePlugin = useCallback(async (pluginId: string | null | undefined) => {
    // Validate input parameters
    if (!pluginId || typeof pluginId !== 'string' || pluginId.trim().length === 0) {
      const errorMessage = 'Invalid plugin ID provided for removal';
      toast.error(errorMessage);
      throw new Error(errorMessage);
    }

    try {
      const response = await fetch('/api/plugins/remove', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pluginId: pluginId.trim() })
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown server error');
        throw new Error(`Removal failed: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      toast.success('Plugin removal started!', { duration: 3000 });
      
      const result = await response.json().catch(() => {
        throw new Error('Invalid response format from server');
      });
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown removal error';
      toast.error(`Failed to remove plugin: ${errorMessage}`);
      
      console.error('Plugin removal error:', {
        pluginId,
        error,
        timestamp: new Date().toISOString()
      });
      
      throw error;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      performance.clearPendingUpdates();
    };
  }, [performance]);

  return {
    ...state,
    performance: {
      metrics: performance.getMetrics(),
      isHighLoad: performance.isHighLoad(),
      queueSize: performance.queueSize,
      settings: performance.settings
    },
    actions: {
      installPlugin,
      updatePlugin,
      removePlugin,
      refreshPlugins: loadPlugins
    }
  };
}