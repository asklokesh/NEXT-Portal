/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from '@tanstack/react-query';
import { useCallback } from 'react';

import { QUERY_KEYS } from '@/config/constants';

import { catalogClient } from '../clients/catalog.client';

import type { RequestOptions } from '../types/common';
import type { 
 Entity, 
 CatalogQuery, 
 EntitySearchOptions,
 EntityAnalyticsOptions,
 PaginatedResponse,
 EntitySearchResponse,
 EntityFacetsResponse,
 CatalogLocation 
} from '../types/entities';

// Hook options with common configurations
interface UseCatalogOptions extends Omit<UseQueryOptions<any, Error>, 'queryKey' | 'queryFn'> {
 requestOptions?: RequestOptions;
}

interface UseCatalogMutationOptions<TData, TVariables> extends UseMutationOptions<TData, Error, TVariables> {
 requestOptions?: RequestOptions;
}

// Get entities hook
export function useEntities(
 query: CatalogQuery = {},
 options: UseCatalogOptions = {}
) {
 const { requestOptions, ...queryOptions } = options;
 
 return useQuery({
 queryKey: [QUERY_KEYS.services, 'entities', query],
 queryFn: () => catalogClient.getEntities(query, requestOptions),
 staleTime: 5 * 60 * 1000, // 5 minutes
 ...queryOptions,
 });
}

// Get entity by reference hook
export function useEntity(
 entityRef: string,
 options: UseCatalogOptions = {}
) {
 const { requestOptions, ...queryOptions } = options;
 
 return useQuery({
 queryKey: [QUERY_KEYS.service(entityRef)],
 queryFn: () => catalogClient.getEntityByRef(entityRef, requestOptions),
 enabled: !!entityRef,
 staleTime: 5 * 60 * 1000, // 5 minutes
 ...queryOptions,
 });
}

// Get entity by UID hook
export function useEntityByUid(
 uid: string,
 options: UseCatalogOptions = {}
) {
 const { requestOptions, ...queryOptions } = options;
 
 return useQuery({
 queryKey: ['entity', 'uid', uid],
 queryFn: () => catalogClient.getEntityByUid(uid, requestOptions),
 enabled: !!uid,
 staleTime: 5 * 60 * 1000, // 5 minutes
 ...queryOptions,
 });
}

// Search entities hook
export function useEntitySearch(
 searchOptions: EntitySearchOptions,
 options: UseCatalogOptions = {}
) {
 const { requestOptions, ...queryOptions } = options;
 
 return useQuery({
 queryKey: ['entities', 'search', searchOptions],
 queryFn: () => catalogClient.searchEntities(searchOptions, requestOptions),
 enabled: !!searchOptions.term,
 staleTime: 2 * 60 * 1000, // 2 minutes for search results
 ...queryOptions,
 });
}

// Get entities by owner hook
export function useEntitiesByOwner(
 owner: string,
 query: Omit<CatalogQuery, 'filter'> = {},
 options: UseCatalogOptions = {}
) {
 const { requestOptions, ...queryOptions } = options;
 
 return useQuery({
 queryKey: ['entities', 'owner', owner, query],
 queryFn: () => catalogClient.getEntitiesByOwner(owner, query, requestOptions),
 enabled: !!owner,
 staleTime: 5 * 60 * 1000, // 5 minutes
 ...queryOptions,
 });
}

// Get entities by kind hook
export function useEntitiesByKind(
 kind: string,
 query: Omit<CatalogQuery, 'filter'> = {},
 options: UseCatalogOptions = {}
) {
 const { requestOptions, ...queryOptions } = options;
 
 return useQuery({
 queryKey: ['entities', 'kind', kind, query],
 queryFn: () => catalogClient.getEntitiesByKind(kind, query, requestOptions),
 enabled: !!kind,
 staleTime: 5 * 60 * 1000, // 5 minutes
 ...queryOptions,
 });
}

// Get entity relationships hook
export function useEntityRelationships(
 entityRef: string,
 options: UseCatalogOptions = {}
) {
 const { requestOptions, ...queryOptions } = options;
 
 return useQuery({
 queryKey: ['entity', 'relationships', entityRef],
 queryFn: () => catalogClient.getEntityRelationships(entityRef, requestOptions),
 enabled: !!entityRef,
 staleTime: 10 * 60 * 1000, // 10 minutes (relationships change less frequently)
 ...queryOptions,
 });
}

// Get entity ancestors hook
export function useEntityAncestors(
 entityRef: string,
 options: UseCatalogOptions = {}
) {
 const { requestOptions, ...queryOptions } = options;
 
 return useQuery({
 queryKey: ['entity', 'ancestors', entityRef],
 queryFn: () => catalogClient.getEntityAncestors(entityRef, requestOptions),
 enabled: !!entityRef,
 staleTime: 10 * 60 * 1000, // 10 minutes
 ...queryOptions,
 });
}

// Get entity descendants hook
export function useEntityDescendants(
 entityRef: string,
 options: UseCatalogOptions = {}
) {
 const { requestOptions, ...queryOptions } = options;
 
 return useQuery({
 queryKey: ['entity', 'descendants', entityRef],
 queryFn: () => catalogClient.getEntityDescendants(entityRef, requestOptions),
 enabled: !!entityRef,
 staleTime: 10 * 60 * 1000, // 10 minutes
 ...queryOptions,
 });
}

// Get locations hook
export function useLocations(options: UseCatalogOptions = {}) {
 const { requestOptions, ...queryOptions } = options;
 
 return useQuery({
 queryKey: ['catalog', 'locations'],
 queryFn: () => catalogClient.getLocations(requestOptions),
 staleTime: 10 * 60 * 1000, // 10 minutes
 ...queryOptions,
 });
}

// Get location by ID hook
export function useLocation(
 id: string,
 options: UseCatalogOptions = {}
) {
 const { requestOptions, ...queryOptions } = options;
 
 return useQuery({
 queryKey: ['catalog', 'location', id],
 queryFn: () => catalogClient.getLocationById(id, requestOptions),
 enabled: !!id,
 staleTime: 10 * 60 * 1000, // 10 minutes
 ...queryOptions,
 });
}

// Get entity facets hook
export function useEntityFacets(
 facets: string[] = ['kind', 'spec.type', 'spec.lifecycle', 'spec.owner'],
 filter?: string | string[],
 options: UseCatalogOptions = {}
) {
 const { requestOptions, ...queryOptions } = options;
 
 return useQuery({
 queryKey: ['catalog', 'facets', facets, filter],
 queryFn: () => catalogClient.getEntityFacets(facets, filter, requestOptions),
 staleTime: 5 * 60 * 1000, // 5 minutes
 ...queryOptions,
 });
}

// Get entity analytics hook
export function useEntityAnalytics(
 analyticsOptions: EntityAnalyticsOptions = {},
 options: UseCatalogOptions = {}
) {
 const { requestOptions, ...queryOptions } = options;
 
 return useQuery({
 queryKey: ['catalog', 'analytics', analyticsOptions],
 queryFn: () => catalogClient.getEntityAnalytics(analyticsOptions, requestOptions),
 staleTime: 15 * 60 * 1000, // 15 minutes
 ...queryOptions,
 });
}

// Mutation hooks
export function useAddLocation(
 options: UseCatalogMutationOptions<CatalogLocation, { type: string; target: string }> = {}
) {
 const queryClient = useQueryClient();
 const { requestOptions, ...mutationOptions } = options;
 
 return useMutation({
 mutationFn: (location) => catalogClient.addLocation(location, requestOptions),
 onSuccess: (data, variables, context) => {
 // Invalidate locations queries
 queryClient.invalidateQueries({ queryKey: ['catalog', 'locations'] });
 options.onSuccess?.(data, variables, context);
 },
 ...mutationOptions,
 });
}

export function useDeleteLocation(
 options: UseCatalogMutationOptions<void, string> = {}
) {
 const queryClient = useQueryClient();
 const { requestOptions, ...mutationOptions } = options;
 
 return useMutation({
 mutationFn: (id) => catalogClient.deleteLocation(id, requestOptions),
 onSuccess: (data, variables, context) => {
 // Invalidate locations queries
 queryClient.invalidateQueries({ queryKey: ['catalog', 'locations'] });
 queryClient.removeQueries({ queryKey: ['catalog', 'location', variables] });
 options.onSuccess?.(data, variables, context);
 },
 ...mutationOptions,
 });
}

export function useRefreshEntity(
 options: UseCatalogMutationOptions<void, string> = {}
) {
 const queryClient = useQueryClient();
 const { requestOptions, ...mutationOptions } = options;
 
 return useMutation({
 mutationFn: (entityRef) => catalogClient.refreshEntity(entityRef, requestOptions),
 onSuccess: (data, variables, context) => {
 // Invalidate entity-related queries
 queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.service(variables)] });
 queryClient.invalidateQueries({ queryKey: ['entity', 'relationships', variables] });
 queryClient.invalidateQueries({ queryKey: ['entity', 'ancestors', variables] });
 queryClient.invalidateQueries({ queryKey: ['entity', 'descendants', variables] });
 options.onSuccess?.(data, variables, context);
 },
 ...mutationOptions,
 });
}

// Custom hooks for common patterns
export function useComponentEntities(
 query: Omit<CatalogQuery, 'filter'> = {},
 options: UseCatalogOptions = {}
) {
 return useEntitiesByKind('Component', query, options);
}

export function useApiEntities(
 query: Omit<CatalogQuery, 'filter'> = {},
 options: UseCatalogOptions = {}
) {
 return useEntitiesByKind('API', query, options);
}

export function useSystemEntities(
 query: Omit<CatalogQuery, 'filter'> = {},
 options: UseCatalogOptions = {}
) {
 return useEntitiesByKind('System', query, options);
}

export function useUserEntities(
 query: Omit<CatalogQuery, 'filter'> = {},
 options: UseCatalogOptions = {}
) {
 return useEntitiesByKind('User', query, options);
}

export function useGroupEntities(
 query: Omit<CatalogQuery, 'filter'> = {},
 options: UseCatalogOptions = {}
) {
 return useEntitiesByKind('Group', query, options);
}

// Hook for entity validation
export function useEntityValidation() {
 return useCallback((entity: Partial<Entity>) => {
 return catalogClient.validateEntity(entity);
 }, []);
}

// Hook for clearing catalog cache
export function useClearCatalogCache() {
 const queryClient = useQueryClient();
 
 return useCallback(() => {
 catalogClient.clearCache();
 queryClient.invalidateQueries({ queryKey: ['catalog'] });
 queryClient.invalidateQueries({ queryKey: ['entities'] });
 queryClient.invalidateQueries({ queryKey: ['entity'] });
 }, [queryClient]);
}

// Hook for catalog cache stats
export function useCatalogCacheStats() {
 return useQuery({
 queryKey: ['catalog', 'cache', 'stats'],
 queryFn: () => catalogClient.getCacheStats(),
 refetchInterval: 30000, // Refresh every 30 seconds
 });
}