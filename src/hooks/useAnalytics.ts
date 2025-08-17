/**
 * Analytics Hook
 * React hook for analytics data management and metric recording
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from '@/components/ui/use-toast';

export interface MetricRecording {
  metricType: string;
  value: number;
  unit?: string;
  metadata?: Record<string, any>;
  aggregationPeriod?: 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
}

export interface AnalyticsData {
  tenantId: string;
  tenantName: string;
  tier: string;
  status: string;
  metrics: {
    usage: any;
    performance: any;
    business: any;
    user: any;
    plugin: any;
    integration: any;
  };
  trends: any;
  insights: any[];
  recommendations: any[];
}

export interface AnalyticsState {
  data: AnalyticsData | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  isRealTime: boolean;
}

export interface AnalyticsActions {
  loadAnalytics: (timeRange?: string) => Promise<void>;
  recordMetric: (metric: MetricRecording) => Promise<boolean>;
  recordBulkMetrics: (metrics: MetricRecording[]) => Promise<boolean>;
  refreshAnalytics: () => Promise<void>;
  exportAnalytics: () => Promise<void>;
  startRealTimeUpdates: () => void;
  stopRealTimeUpdates: () => void;
  getMetricSummary: (metricType: string) => any;
  trackEvent: (eventName: string, properties?: Record<string, any>) => Promise<void>;
  trackPageView: (path: string, properties?: Record<string, any>) => Promise<void>;
  trackUserAction: (action: string, properties?: Record<string, any>) => Promise<void>;
  trackFeatureUsage: (feature: string, properties?: Record<string, any>) => Promise<void>;
}

export interface UseAnalyticsOptions {
  autoLoad?: boolean;
  realTimeUpdates?: boolean;
  updateInterval?: number; // milliseconds
  enablePageTracking?: boolean;
  enableErrorTracking?: boolean;
}

export function useAnalytics(options: UseAnalyticsOptions = {}): AnalyticsState & AnalyticsActions {
  const {
    autoLoad = true,
    realTimeUpdates = false,
    updateInterval = 30000, // 30 seconds
    enablePageTracking = true,
    enableErrorTracking = true
  } = options;

  const [state, setState] = useState<AnalyticsState>({
    data: null,
    loading: true,
    error: null,
    lastUpdated: null,
    isRealTime: false
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmountedRef = useRef(false);

  const updateState = useCallback((updates: Partial<AnalyticsState>) => {
    if (!isUnmountedRef.current) {
      setState(prev => ({ ...prev, ...updates }));
    }
  }, []);

  const loadAnalytics = useCallback(async (timeRange?: string) => {
    try {
      updateState({ loading: true, error: null });

      const params = new URLSearchParams();
      if (timeRange) {
        const endDate = new Date();
        const startDate = new Date();
        
        switch (timeRange) {
          case '7d':
            startDate.setDate(startDate.getDate() - 7);
            break;
          case '30d':
            startDate.setDate(startDate.getDate() - 30);
            break;
          case '90d':
            startDate.setDate(startDate.getDate() - 90);
            break;
          case '1y':
            startDate.setFullYear(startDate.getFullYear() - 1);
            break;
        }

        params.append('startDate', startDate.toISOString());
        params.append('endDate', endDate.toISOString());
      }

      const response = await fetch(`/api/tenant/analytics?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        updateState({
          data: result.data,
          loading: false,
          lastUpdated: new Date()
        });
      } else {
        updateState({
          loading: false,
          error: result.error || 'Failed to load analytics'
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Network error';
      updateState({
        loading: false,
        error: errorMessage
      });
    }
  }, [updateState]);

  const recordMetric = useCallback(async (metric: MetricRecording): Promise<boolean> => {
    try {
      const response = await fetch('/api/tenant/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          operation: 'record_metric',
          data: metric
        })
      });

      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error('Failed to record metric:', error);
      return false;
    }
  }, []);

  const recordBulkMetrics = useCallback(async (metrics: MetricRecording[]): Promise<boolean> => {
    try {
      const response = await fetch('/api/tenant/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          operation: 'bulk_record',
          data: { metrics }
        })
      });

      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error('Failed to record bulk metrics:', error);
      return false;
    }
  }, []);

  const refreshAnalytics = useCallback(async () => {
    await loadAnalytics();
    toast({
      title: 'Analytics Refreshed',
      description: 'Analytics data has been updated with the latest information'
    });
  }, [loadAnalytics]);

  const exportAnalytics = useCallback(async () => {
    try {
      const response = await fetch('/api/tenant/analytics?format=export');
      const result = await response.json();

      if (result.success) {
        const blob = new Blob([JSON.stringify(result.data, null, 2)], {
          type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-${state.data?.tenantName || 'data'}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
          title: 'Export Successful',
          description: 'Analytics data has been exported to your downloads'
        });
      } else {
        toast({
          title: 'Export Failed',
          description: result.error || 'Failed to export analytics data',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Export Error',
        description: 'Network error while exporting analytics data',
        variant: 'destructive'
      });
    }
  }, [state.data]);

  const startRealTimeUpdates = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      loadAnalytics();
    }, updateInterval);

    updateState({ isRealTime: true });
  }, [loadAnalytics, updateInterval, updateState]);

  const stopRealTimeUpdates = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    updateState({ isRealTime: false });
  }, [updateState]);

  const getMetricSummary = useCallback((metricType: string) => {
    if (!state.data) return null;

    // Extract metric summary from analytics data
    const { metrics } = state.data;
    
    switch (metricType) {
      case 'storage':
        return metrics.usage?.storage;
      case 'api_calls':
        return metrics.usage?.apiCalls;
      case 'users':
        return metrics.user;
      case 'performance':
        return metrics.performance;
      case 'plugins':
        return metrics.plugin;
      default:
        return null;
    }
  }, [state.data]);

  const trackEvent = useCallback(async (eventName: string, properties?: Record<string, any>) => {
    const success = await recordMetric({
      metricType: 'FEATURE_USAGE',
      value: 1,
      metadata: {
        eventName,
        properties: properties || {},
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      }
    });

    if (!success && enableErrorTracking) {
      console.warn('Failed to track event:', eventName);
    }
  }, [recordMetric, enableErrorTracking]);

  const trackPageView = useCallback(async (path: string, properties?: Record<string, any>) => {
    if (!enablePageTracking) return;

    await trackEvent('page_view', {
      path,
      referrer: document.referrer,
      ...properties
    });
  }, [trackEvent, enablePageTracking]);

  const trackUserAction = useCallback(async (action: string, properties?: Record<string, any>) => {
    await trackEvent('user_action', {
      action,
      ...properties
    });
  }, [trackEvent]);

  const trackFeatureUsage = useCallback(async (feature: string, properties?: Record<string, any>) => {
    await trackEvent('feature_usage', {
      feature,
      ...properties
    });
  }, [trackEvent]);

  // Auto-load analytics on mount
  useEffect(() => {
    if (autoLoad) {
      loadAnalytics();
    }

    return () => {
      isUnmountedRef.current = true;
    };
  }, [autoLoad, loadAnalytics]);

  // Start real-time updates if enabled
  useEffect(() => {
    if (realTimeUpdates && state.data) {
      startRealTimeUpdates();
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [realTimeUpdates, state.data, startRealTimeUpdates]);

  // Track page views automatically
  useEffect(() => {
    if (enablePageTracking && state.data) {
      trackPageView(window.location.pathname);
    }
  }, [enablePageTracking, state.data, trackPageView]);

  // Track errors automatically
  useEffect(() => {
    if (!enableErrorTracking) return;

    const handleError = (event: ErrorEvent) => {
      recordMetric({
        metricType: 'ERROR_COUNT',
        value: 1,
        metadata: {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack,
          timestamp: new Date().toISOString()
        }
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      recordMetric({
        metricType: 'ERROR_COUNT',
        value: 1,
        metadata: {
          type: 'unhandled_promise_rejection',
          reason: event.reason?.toString(),
          timestamp: new Date().toISOString()
        }
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [enableErrorTracking, recordMetric]);

  return {
    // State
    ...state,
    
    // Actions
    loadAnalytics,
    recordMetric,
    recordBulkMetrics,
    refreshAnalytics,
    exportAnalytics,
    startRealTimeUpdates,
    stopRealTimeUpdates,
    getMetricSummary,
    trackEvent,
    trackPageView,
    trackUserAction,
    trackFeatureUsage
  };
}

/**
 * Hook for real-time metrics tracking
 */
export function useMetricsTracker() {
  const { recordMetric, trackEvent } = useAnalytics({ autoLoad: false });

  const trackMetric = useCallback(async (
    metricType: string,
    value: number,
    metadata?: Record<string, any>
  ) => {
    return await recordMetric({
      metricType,
      value,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString()
      }
    });
  }, [recordMetric]);

  const trackDuration = useCallback((metricType: string) => {
    const startTime = Date.now();
    
    return {
      end: async (metadata?: Record<string, any>) => {
        const duration = Date.now() - startTime;
        return await trackMetric(metricType, duration, {
          ...metadata,
          unit: 'milliseconds'
        });
      }
    };
  }, [trackMetric]);

  const trackAPICall = useCallback(async (
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number
  ) => {
    await Promise.all([
      trackMetric('API_CALLS', 1, { endpoint, method, statusCode }),
      trackMetric('RESPONSE_TIME', duration, { endpoint, method, statusCode })
    ]);

    if (statusCode >= 400) {
      await trackMetric('ERROR_COUNT', 1, { 
        endpoint, 
        method, 
        statusCode,
        type: 'api_error'
      });
    }
  }, [trackMetric]);

  const trackFeatureInteraction = useCallback(async (
    feature: string,
    action: string,
    metadata?: Record<string, any>
  ) => {
    await trackEvent('feature_interaction', {
      feature,
      action,
      ...metadata
    });
  }, [trackEvent]);

  return {
    trackMetric,
    trackDuration,
    trackAPICall,
    trackFeatureInteraction,
    recordMetric
  };
}

export default useAnalytics;