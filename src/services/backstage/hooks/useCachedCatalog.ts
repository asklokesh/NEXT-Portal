import { useCachedQuery } from '@/hooks/useCache';
import { queryCacheUtils } from '@/lib/cache/middleware';
import type { ServiceEntity } from '@/lib/backstage/types';

interface CatalogFilters {
 kind?: string;
 lifecycle?: string;
 owner?: string;
 namespace?: string;
 tags?: string[];
}

/**
 * Hook for fetching cached catalog entities
 */
export function useCachedCatalogEntities(filters?: CatalogFilters) {
 return useCachedQuery<ServiceEntity[]>({
 queryKey: ['catalog', 'entities', filters],
 queryFn: async () => {
 const params = new URLSearchParams();
 
 if (filters?.kind) params.set('kind', filters.kind);
 if (filters?.lifecycle) params.set('lifecycle', filters.lifecycle);
 if (filters?.owner) params.set('owner', filters.owner);
 if (filters?.namespace) params.set('namespace', filters.namespace);
 if (filters?.tags?.length) params.set('tags', filters.tags.join(','));
 
 const response = await fetch(`/api/cached/backstage/catalog?${params}`);
 
 if (!response.ok) {
 throw new Error('Failed to fetch catalog entities');
 }
 
 return response.json();
 },
 staleTime: 5 * 60 * 1000, // 5 minutes
 refetchInterval: 30 * 1000, // Refetch every 30 seconds
 });
}

/**
 * Hook for fetching a specific catalog entity with caching
 */
export function useCachedCatalogEntity(
 kind: string,
 namespace: string,
 name: string,
 enabled = true
) {
 return useCachedQuery<ServiceEntity>({
 queryKey: ['catalog', 'entity', kind, namespace, name],
 queryFn: async () => {
 const response = await fetch(
 `/api/backstage/catalog/entities/by-name/${kind}/${namespace}/${name}`
 );
 
 if (!response.ok) {
 throw new Error('Failed to fetch entity');
 }
 
 return response.json();
 },
 staleTime: 10 * 60 * 1000, // 10 minutes
 enabled,
 });
}

/**
 * Hook for searching catalog with caching
 */
export function useCachedCatalogSearch(query: string, filters?: CatalogFilters) {
 return useCachedQuery<ServiceEntity[]>({
 queryKey: ['catalog', 'search', query, filters],
 queryFn: async () => {
 const params = new URLSearchParams();
 params.set('q', query);
 
 if (filters?.kind) params.set('kind', filters.kind);
 if (filters?.lifecycle) params.set('lifecycle', filters.lifecycle);
 if (filters?.owner) params.set('owner', filters.owner);
 
 const response = await fetch(`/api/backstage/catalog/search?${params}`);
 
 if (!response.ok) {
 throw new Error('Failed to search catalog');
 }
 
 return response.json();
 },
 staleTime: 2 * 60 * 1000, // 2 minutes for search results
 enabled: query.length > 0,
 });
}

/**
 * Hook for fetching entity relations with caching
 */
export function useCachedEntityRelations(entityRef: string) {
 return useCachedQuery<any>({
 queryKey: ['catalog', 'relations', entityRef],
 queryFn: async () => {
 const response = await fetch(
 `/api/backstage/catalog/entities/${encodeURIComponent(entityRef)}/relations`
 );
 
 if (!response.ok) {
 throw new Error('Failed to fetch entity relations');
 }
 
 return response.json();
 },
 staleTime: 15 * 60 * 1000, // 15 minutes
 });
}

/**
 * Hook for batch fetching entities with caching
 */
export function useCachedBatchEntities(entityRefs: string[]) {
 return useCachedQuery<ServiceEntity[]>({
 queryKey: ['catalog', 'batch', entityRefs],
 queryFn: async () => {
 const response = await fetch('/api/backstage/catalog/entities/batch', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ entityRefs }),
 });
 
 if (!response.ok) {
 throw new Error('Failed to fetch entities');
 }
 
 return response.json();
 },
 staleTime: 10 * 60 * 1000, // 10 minutes
 enabled: entityRefs.length > 0,
 });
}