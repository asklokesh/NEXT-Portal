'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

export interface PerformanceConfig {
  throttleInterval?: number; // Minimum time between updates (ms)
  maxUpdatesPerSecond?: number; // Maximum updates per second
  batchSize?: number; // Number of updates to batch together
  enableMetrics?: boolean; // Track performance metrics
  autoAdjust?: boolean; // Automatically adjust performance based on load
}

export interface PerformanceMetrics {
  updatesPerSecond: number;
  averageUpdateTime: number;
  droppedUpdates: number;
  lastUpdateTime: number;
  totalUpdates: number;
  memoryUsage: number;
}

const DEFAULT_CONFIG: Required<PerformanceConfig> = {
  throttleInterval: 100,
  maxUpdatesPerSecond: 30,
  batchSize: 5,
  enableMetrics: true,
  autoAdjust: true
};

export function useRealtimePerformance(config: PerformanceConfig = {}) {
  const settings = { ...DEFAULT_CONFIG, ...config };
  
  const lastUpdateTime = useRef<number>(0);
  const updateQueue = useRef<(() => void)[]>([]);
  const batchTimeout = useRef<NodeJS.Timeout | null>(null);
  const metrics = useRef<PerformanceMetrics>({
    updatesPerSecond: 0,
    averageUpdateTime: 0,
    droppedUpdates: 0,
    lastUpdateTime: 0,
    totalUpdates: 0,
    memoryUsage: 0
  });
  
  const frameRef = useRef<number>();
  const lastSecondUpdates = useRef<number[]>([]);
  const updateTimes = useRef<number[]>([]);

  // Calculate current performance metrics
  const updateMetrics = useCallback(() => {
    if (!settings.enableMetrics) return;
    
    const now = Date.now();
    
    // Calculate updates per second
    lastSecondUpdates.current = lastSecondUpdates.current.filter(time => now - time < 1000);
    metrics.current.updatesPerSecond = lastSecondUpdates.current.length;
    
    // Calculate average update time
    if (updateTimes.current.length > 0) {
      const avgTime = updateTimes.current.reduce((a, b) => a + b, 0) / updateTimes.current.length;
      metrics.current.averageUpdateTime = avgTime;
      
      // Keep only recent update times
      if (updateTimes.current.length > 100) {
        updateTimes.current = updateTimes.current.slice(-50);
      }
    }
    
    // Calculate memory usage if available
    if (typeof window !== 'undefined' && 'memory' in performance) {
      const memInfo = (performance as any).memory;
      metrics.current.memoryUsage = memInfo.usedJSHeapSize / 1024 / 1024; // MB
    }
    
    metrics.current.lastUpdateTime = now;
  }, [settings.enableMetrics]);

  // Auto-adjust performance settings based on current load
  const autoAdjustSettings = useCallback(() => {
    if (!settings.autoAdjust) return;
    
    const { updatesPerSecond, averageUpdateTime, memoryUsage } = metrics.current;
    
    // If too many updates per second, increase throttle interval
    if (updatesPerSecond > settings.maxUpdatesPerSecond) {
      settings.throttleInterval = Math.min(settings.throttleInterval + 50, 500);
    }
    
    // If average update time is high, reduce batch size
    if (averageUpdateTime > 16) { // 60fps = 16ms per frame
      settings.batchSize = Math.max(settings.batchSize - 1, 1);
    } else if (averageUpdateTime < 8 && settings.batchSize < 10) {
      settings.batchSize += 1;
    }
    
    // If memory usage is high, be more aggressive with throttling
    if (memoryUsage > 100) { // 100MB
      settings.throttleInterval = Math.min(settings.throttleInterval + 25, 300);
      settings.maxUpdatesPerSecond = Math.max(settings.maxUpdatesPerSecond - 5, 10);
    }
  }, [settings]);

  // Process the update queue in batches
  const processBatch = useCallback(() => {
    if (updateQueue.current.length === 0) return;
    
    const startTime = performance.now();
    const batch = updateQueue.current.splice(0, settings.batchSize);
    
    // Use requestAnimationFrame for smooth updates
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
    }
    
    frameRef.current = requestAnimationFrame(() => {
      try {
        batch.forEach(update => update());
        
        if (settings.enableMetrics) {
          const updateTime = performance.now() - startTime;
          updateTimes.current.push(updateTime);
          lastSecondUpdates.current.push(Date.now());
          metrics.current.totalUpdates += batch.length;
          updateMetrics();
          autoAdjustSettings();
        }
        
        // Process remaining updates if any
        if (updateQueue.current.length > 0) {
          batchTimeout.current = setTimeout(processBatch, settings.throttleInterval);
        }
      } catch (error) {
        console.error('Error processing batch updates:', error);
      }
    });
  }, [settings.batchSize, settings.throttleInterval, settings.enableMetrics, updateMetrics, autoAdjustSettings]);

  // Throttled update function
  const throttledUpdate = useCallback((updateFn: () => void, priority: 'low' | 'normal' | 'high' = 'normal') => {
    const now = Date.now();
    
    // Check if we should throttle this update
    const timeSinceLastUpdate = now - lastUpdateTime.current;
    if (timeSinceLastUpdate < settings.throttleInterval && priority !== 'high') {
      if (priority === 'low' && Math.random() > 0.5) {
        // Drop 50% of low priority updates when throttling
        if (settings.enableMetrics) {
          metrics.current.droppedUpdates++;
        }
        return;
      }
    }
    
    // Add to queue based on priority
    if (priority === 'high') {
      updateQueue.current.unshift(updateFn); // High priority goes to front
    } else {
      updateQueue.current.push(updateFn);
    }
    
    // Limit queue size to prevent memory issues
    if (updateQueue.current.length > 100) {
      const droppedCount = updateQueue.current.length - 100;
      updateQueue.current = updateQueue.current.slice(-100);
      
      if (settings.enableMetrics) {
        metrics.current.droppedUpdates += droppedCount;
      }
    }
    
    lastUpdateTime.current = now;
    
    // Start processing if not already running
    if (!batchTimeout.current && updateQueue.current.length > 0) {
      // Process immediately for high priority, or batch for others
      if (priority === 'high' && updateQueue.current.length === 1) {
        processBatch();
      } else {
        batchTimeout.current = setTimeout(processBatch, Math.min(settings.throttleInterval, 50));
      }
    }
  }, [settings.throttleInterval, settings.enableMetrics, processBatch]);

  // Debounced update function
  const debouncedUpdate = useCallback((updateFn: () => void, delay: number = 300) => {
    if (batchTimeout.current) {
      clearTimeout(batchTimeout.current);
    }
    
    batchTimeout.current = setTimeout(() => {
      throttledUpdate(updateFn, 'normal');
    }, delay);
  }, [throttledUpdate]);

  // Bulk update function for processing multiple updates efficiently
  const bulkUpdate = useCallback((updateFns: (() => void)[]) => {
    // Split into high priority (first 5) and normal priority (rest)
    const highPriorityUpdates = updateFns.slice(0, 5);
    const normalPriorityUpdates = updateFns.slice(5);
    
    highPriorityUpdates.forEach(fn => throttledUpdate(fn, 'high'));
    normalPriorityUpdates.forEach(fn => throttledUpdate(fn, 'normal'));
  }, [throttledUpdate]);

  // Clear all pending updates
  const clearPendingUpdates = useCallback(() => {
    updateQueue.current = [];
    if (batchTimeout.current) {
      clearTimeout(batchTimeout.current);
      batchTimeout.current = null;
    }
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = undefined;
    }
  }, []);

  // Get current performance metrics
  const getMetrics = useCallback((): PerformanceMetrics => {
    updateMetrics();
    return { ...metrics.current };
  }, [updateMetrics]);

  // Reset performance metrics
  const resetMetrics = useCallback(() => {
    metrics.current = {
      updatesPerSecond: 0,
      averageUpdateTime: 0,
      droppedUpdates: 0,
      lastUpdateTime: 0,
      totalUpdates: 0,
      memoryUsage: 0
    };
    lastSecondUpdates.current = [];
    updateTimes.current = [];
  }, []);

  // Check if the system is under high load
  const isHighLoad = useCallback(() => {
    const current = metrics.current;
    return current.updatesPerSecond > settings.maxUpdatesPerSecond * 0.8 ||
           current.averageUpdateTime > 20 ||
           current.memoryUsage > 150;
  }, [settings.maxUpdatesPerSecond]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearPendingUpdates();
    };
  }, [clearPendingUpdates]);

  // Periodic metrics update
  useEffect(() => {
    if (!settings.enableMetrics) return;
    
    const interval = setInterval(() => {
      updateMetrics();
      autoAdjustSettings();
    }, 1000);
    
    return () => clearInterval(interval);
  }, [settings.enableMetrics, updateMetrics, autoAdjustSettings]);

  return {
    throttledUpdate,
    debouncedUpdate,
    bulkUpdate,
    clearPendingUpdates,
    getMetrics,
    resetMetrics,
    isHighLoad,
    queueSize: updateQueue.current.length,
    settings: { ...settings }
  };
}

// React component for displaying performance metrics
export function PerformanceMonitor({ 
  hook, 
  className = "" 
}: { 
  hook: ReturnType<typeof useRealtimePerformance>;
  className?: string;
}) {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(hook.getMetrics());
    }, 1000);
    
    return () => clearInterval(interval);
  }, [hook]);
  
  return { metrics, hook };
}