/**
 * useFeatureFlag Hook
 * React hook for feature flag evaluation with real-time updates and caching
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { FlagEvaluation, UserContext } from '@/lib/feature-flags/types';

interface UseFeatureFlagOptions {
  context?: Partial<UserContext>;
  defaultValue?: any;
  refreshInterval?: number;
  realTimeUpdates?: boolean;
  onEvaluation?: (evaluation: FlagEvaluation) => void;
  onError?: (error: Error) => void;
}

interface UseFeatureFlagResult<T = any> {
  value: T;
  loading: boolean;
  error: Error | null;
  evaluation: FlagEvaluation | null;
  refresh: () => Promise<void>;
  isEnabled: boolean;
  variation: string | undefined;
  reason: string;
}

/**
 * Hook for evaluating a single feature flag
 */
export function useFeatureFlag<T = any>(
  flagKey: string,
  options: UseFeatureFlagOptions = {}
): UseFeatureFlagResult<T> {
  const {
    context = {},
    defaultValue = false,
    refreshInterval = 0, // No auto-refresh by default
    realTimeUpdates = false,
    onEvaluation,
    onError
  } = options;

  const [state, setState] = useState<{
    value: T;
    loading: boolean;
    error: Error | null;
    evaluation: FlagEvaluation | null;
  }>({
    value: defaultValue,
    loading: true,
    error: null,
    evaluation: null
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const webSocketRef = useRef<WebSocket | null>(null);

  // Build user context
  const buildUserContext = useCallback((): UserContext => {
    return {
      userId: context.userId || localStorage.getItem('userId') || undefined,
      sessionId: context.sessionId || localStorage.getItem('sessionId') || undefined,
      email: context.email || localStorage.getItem('userEmail') || undefined,
      groups: context.groups || [],
      attributes: {
        ...context.attributes,
        timestamp: new Date().toISOString(),
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        referrer: typeof document !== 'undefined' ? document.referrer : undefined,
        ...context.custom
      },
      location: context.location,
      device: context.device,
      custom: context.custom
    };
  }, [context]);

  // Evaluate flag
  const evaluateFlag = useCallback(async (): Promise<void> => {
    if (!flagKey) return;

    try {
      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      setState(prev => ({ ...prev, loading: true, error: null }));

      const userContext = buildUserContext();
      
      const response = await fetch(`/api/feature-flags/${encodeURIComponent(flagKey)}/evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userContext),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`Failed to evaluate flag: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Flag evaluation failed');
      }

      const evaluation: FlagEvaluation = result.data;

      setState({
        value: evaluation.value,
        loading: false,
        error: null,
        evaluation
      });

      onEvaluation?.(evaluation);

    } catch (error: any) {
      if (error.name === 'AbortError') {
        return; // Request was cancelled, ignore
      }

      const errorObj = error instanceof Error ? error : new Error(String(error));
      
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorObj,
        value: defaultValue
      }));

      onError?.(errorObj);
    }
  }, [flagKey, buildUserContext, defaultValue, onEvaluation, onError]);

  // Setup real-time updates via WebSocket
  useEffect(() => {
    if (!realTimeUpdates || !flagKey) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws?subscribe=feature-flags&flagKey=${encodeURIComponent(flagKey)}`;
    
    try {
      const ws = new WebSocket(wsUrl);
      webSocketRef.current = ws;

      ws.onopen = () => {
        console.log(`WebSocket connected for flag: ${flagKey}`);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'flag_updated' && message.flagKey === flagKey) {
            // Re-evaluate flag when it's updated
            evaluateFlag();
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log(`WebSocket closed for flag: ${flagKey}`);
      };

    } catch (error) {
      console.error('Failed to establish WebSocket connection:', error);
    }

    return () => {
      if (webSocketRef.current) {
        webSocketRef.current.close();
        webSocketRef.current = null;
      }
    };
  }, [flagKey, realTimeUpdates, evaluateFlag]);

  // Setup refresh interval
  useEffect(() => {
    if (refreshInterval > 0 && flagKey) {
      refreshIntervalRef.current = setInterval(evaluateFlag, refreshInterval);
      
      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [refreshInterval, flagKey, evaluateFlag]);

  // Initial evaluation
  useEffect(() => {
    if (flagKey) {
      evaluateFlag();
    }
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [flagKey, evaluateFlag]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      if (webSocketRef.current) {
        webSocketRef.current.close();
      }
    };
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    await evaluateFlag();
  }, [evaluateFlag]);

  return {
    value: state.value,
    loading: state.loading,
    error: state.error,
    evaluation: state.evaluation,
    refresh,
    isEnabled: Boolean(state.value),
    variation: state.evaluation?.variation,
    reason: state.evaluation?.reason.kind || 'unknown'
  };
}

/**
 * Hook for evaluating multiple feature flags
 */
interface UseFeatureFlagsOptions {
  context?: Partial<UserContext>;
  defaultValues?: Record<string, any>;
  refreshInterval?: number;
  realTimeUpdates?: boolean;
  onEvaluations?: (evaluations: Record<string, FlagEvaluation>) => void;
  onError?: (error: Error) => void;
}

interface UseFeatureFlagsResult {
  flags: Record<string, any>;
  loading: boolean;
  error: Error | null;
  evaluations: Record<string, FlagEvaluation>;
  refresh: () => Promise<void>;
  getFlag: <T = any>(flagKey: string, defaultValue?: T) => T;
  isEnabled: (flagKey: string) => boolean;
}

export function useFeatureFlags(
  flagKeys: string[],
  options: UseFeatureFlagsOptions = {}
): UseFeatureFlagsResult {
  const {
    context = {},
    defaultValues = {},
    refreshInterval = 0,
    realTimeUpdates = false,
    onEvaluations,
    onError
  } = options;

  const [state, setState] = useState<{
    flags: Record<string, any>;
    loading: boolean;
    error: Error | null;
    evaluations: Record<string, FlagEvaluation>;
  }>({
    flags: {},
    loading: true,
    error: null,
    evaluations: {}
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const webSocketRef = useRef<WebSocket | null>(null);

  // Build user context
  const buildUserContext = useCallback((): UserContext => {
    return {
      userId: context.userId || localStorage.getItem('userId') || undefined,
      sessionId: context.sessionId || localStorage.getItem('sessionId') || undefined,
      email: context.email || localStorage.getItem('userEmail') || undefined,
      groups: context.groups || [],
      attributes: {
        ...context.attributes,
        timestamp: new Date().toISOString(),
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        referrer: typeof document !== 'undefined' ? document.referrer : undefined,
        ...context.custom
      },
      location: context.location,
      device: context.device,
      custom: context.custom
    };
  }, [context]);

  // Evaluate all flags
  const evaluateFlags = useCallback(async (): Promise<void> => {
    if (!flagKeys.length) return;

    try {
      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      setState(prev => ({ ...prev, loading: true, error: null }));

      const userContext = buildUserContext();
      
      const response = await fetch('/api/feature-flags/evaluate/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          flagKeys,
          ...userContext
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`Failed to evaluate flags: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Flags evaluation failed');
      }

      const evaluations: Record<string, FlagEvaluation> = result.data.evaluations;
      const flags: Record<string, any> = {};

      // Extract flag values
      Object.entries(evaluations).forEach(([flagKey, evaluation]) => {
        flags[flagKey] = evaluation.value;
      });

      // Add default values for missing flags
      flagKeys.forEach(flagKey => {
        if (!(flagKey in flags) && flagKey in defaultValues) {
          flags[flagKey] = defaultValues[flagKey];
        }
      });

      setState({
        flags,
        loading: false,
        error: null,
        evaluations
      });

      onEvaluations?.(evaluations);

    } catch (error: any) {
      if (error.name === 'AbortError') {
        return; // Request was cancelled, ignore
      }

      const errorObj = error instanceof Error ? error : new Error(String(error));
      
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorObj,
        flags: defaultValues
      }));

      onError?.(errorObj);
    }
  }, [flagKeys, buildUserContext, defaultValues, onEvaluations, onError]);

  // Setup real-time updates
  useEffect(() => {
    if (!realTimeUpdates || !flagKeys.length) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws?subscribe=feature-flags`;
    
    try {
      const ws = new WebSocket(wsUrl);
      webSocketRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'flag_updated' && flagKeys.includes(message.flagKey)) {
            // Re-evaluate flags when any subscribed flag is updated
            evaluateFlags();
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

    } catch (error) {
      console.error('Failed to establish WebSocket connection:', error);
    }

    return () => {
      if (webSocketRef.current) {
        webSocketRef.current.close();
        webSocketRef.current = null;
      }
    };
  }, [flagKeys, realTimeUpdates, evaluateFlags]);

  // Setup refresh interval
  useEffect(() => {
    if (refreshInterval > 0 && flagKeys.length) {
      refreshIntervalRef.current = setInterval(evaluateFlags, refreshInterval);
      
      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [refreshInterval, flagKeys, evaluateFlags]);

  // Initial evaluation
  useEffect(() => {
    if (flagKeys.length) {
      evaluateFlags();
    }
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [flagKeys, evaluateFlags]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      if (webSocketRef.current) {
        webSocketRef.current.close();
      }
    };
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    await evaluateFlags();
  }, [evaluateFlags]);

  const getFlag = useCallback(<T = any>(flagKey: string, defaultValue?: T): T => {
    return state.flags[flagKey] ?? defaultValue ?? false;
  }, [state.flags]);

  const isEnabled = useCallback((flagKey: string): boolean => {
    return Boolean(state.flags[flagKey]);
  }, [state.flags]);

  return {
    flags: state.flags,
    loading: state.loading,
    error: state.error,
    evaluations: state.evaluations,
    refresh,
    getFlag,
    isEnabled
  };
}