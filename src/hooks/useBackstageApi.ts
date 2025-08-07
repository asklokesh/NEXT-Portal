import { useState, useCallback } from 'react';

export interface UseBackstageApiOptions {
  baseUrl?: string;
  token?: string;
}

export interface BackstageApiResponse<T = any> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useBackstageApi(options: UseBackstageApiOptions = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const makeRequest = useCallback(async <T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<BackstageApiResponse<T>> => {
    setLoading(true);
    setError(null);

    try {
      const baseUrl = options.baseUrl || process.env.NEXT_PUBLIC_BACKSTAGE_API_URL || 'http://localhost:4400/api/backstage';
      const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.token && { Authorization: `Bearer ${options.token}` }),
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        data,
        loading: false,
        error: null,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      
      return {
        data: null,
        loading: false,
        error: errorMessage,
      };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    makeRequest,
    loading,
    error,
  };
}