import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryCacheUtils } from '@/lib/cache/middleware';

interface UseCachedQueryOptions<T> {
 queryKey: any[];
 queryFn: () => Promise<T>;
 staleTime?: number;
 cacheTime?: number;
 refetchInterval?: number | false;
 enabled?: boolean;
}

/**
 * Hook for cached queries with automatic cache invalidation
 */
export function useCachedQuery<T>({
 queryKey,
 queryFn,
 staleTime = queryCacheUtils.staleTimes.dynamic,
 cacheTime = staleTime * 2,
 refetchInterval = false,
 enabled = true,
}: UseCachedQueryOptions<T>) {
 return useQuery({
 queryKey,
 queryFn,
 staleTime,
 gcTime: cacheTime,
 refetchInterval,
 enabled,
 refetchOnWindowFocus: false,
 refetchOnReconnect: true,
 });
}

/**
 * Hook for cached service catalog data
 */
export function useCachedServices(filters?: any) {
 return useCachedQuery({
 queryKey: queryCacheUtils.keys.services(filters),
 queryFn: async () => {
 const params = new URLSearchParams(filters);
 const response = await fetch(`/api/cached/backstage/catalog?${params}`);
 if (!response.ok) throw new Error('Failed to fetch services');
 return response.json();
 },
 staleTime: queryCacheUtils.staleTimes.dynamic,
 });
}

/**
 * Hook for cached templates
 */
export function useCachedTemplates() {
 return useCachedQuery({
 queryKey: queryCacheUtils.keys.templates(),
 queryFn: async () => {
 const response = await fetch('/api/cached/backstage/templates');
 if (!response.ok) throw new Error('Failed to fetch templates');
 return response.json();
 },
 staleTime: queryCacheUtils.staleTimes.static, // Templates change less frequently
 });
}

/**
 * Hook for cached cost data
 */
export function useCachedCosts(provider: string, period: string) {
 return useCachedQuery({
 queryKey: queryCacheUtils.keys.costs(provider, period),
 queryFn: async () => {
 const response = await fetch(`/api/costs/${provider}?period=${period}`);
 if (!response.ok) throw new Error('Failed to fetch costs');
 return response.json();
 },
 staleTime: queryCacheUtils.staleTimes.dynamic,
 refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
 });
}

/**
 * Hook for cache invalidation
 */
export function useCacheInvalidation() {
 const queryClient = useQueryClient();
 
 const invalidateCache = useMutation({
 mutationFn: async ({ tags, pattern }: { tags?: string[]; pattern?: string }) => {
 const response = await fetch('/api/cached/backstage/catalog/invalidate', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ tags, pattern }),
 });
 if (!response.ok) throw new Error('Failed to invalidate cache');
 return response.json();
 },
 onSuccess: () => {
 // Also invalidate React Query cache
 queryClient.invalidateQueries();
 },
 });
 
 return {
 invalidateByTags: (tags: string[]) => invalidateCache.mutate({ tags }),
 invalidateByPattern: (pattern: string) => invalidateCache.mutate({ pattern }),
 invalidateAll: () => {
 queryClient.clear();
 invalidateCache.mutate({ pattern: '*' });
 },
 };
}

/**
 * Prefetch data for better performance
 */
export function usePrefetch() {
 const queryClient = useQueryClient();
 
 return {
 prefetchServices: (filters?: any) => {
 return queryClient.prefetchQuery({
 queryKey: queryCacheUtils.keys.services(filters),
 queryFn: async () => {
 const params = new URLSearchParams(filters);
 const response = await fetch(`/api/cached/backstage/catalog?${params}`);
 return response.json();
 },
 staleTime: queryCacheUtils.staleTimes.dynamic,
 });
 },
 
 prefetchTemplates: () => {
 return queryClient.prefetchQuery({
 queryKey: queryCacheUtils.keys.templates(),
 queryFn: async () => {
 const response = await fetch('/api/cached/backstage/templates');
 return response.json();
 },
 staleTime: queryCacheUtils.staleTimes.static,
 });
 },
 };
}

/**
 * Hook for optimistic updates
 */
export function useOptimisticUpdate<T>() {
 const queryClient = useQueryClient();
 
 return {
 optimisticUpdate: (
 queryKey: any[],
 updater: (oldData: T) => T
 ) => {
 queryClient.setQueryData(queryKey, updater);
 },
 
 rollback: (queryKey: any[]) => {
 queryClient.invalidateQueries({ queryKey });
 },
 };
}