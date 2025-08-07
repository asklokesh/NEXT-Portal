/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { z } from 'zod';

import {
 EntitySchema,
 EntityFilters,
 CatalogQuerySchema,
 EntitySearchResult,
 EntitySearchResultSchema,
 CatalogLocationSchema,
 parseEntityRef,
 stringifyEntityRef,
} from '../types/entities';
import { createBackstageClient } from '../utils/api-client';
import { apiAdapter } from '@/lib/backstage-compat';

import type { PaginatedResponse, RequestOptions, CatalogQueryParams } from '../types/common';
import type {
 Entity,
 CatalogQuery,
 CatalogLocation} from '../types/entities';
import type { BackstageApiClient} from '../utils/api-client';

// Catalog API response schemas
const EntitiesResponseSchema = z.object({
 items: z.array(EntitySchema),
 totalItems: z.number().optional(),
 pageInfo: z.object({
 nextCursor: z.string().optional(),
 prevCursor: z.string().optional(),
 }).optional(),
});

const EntityByNameResponseSchema = EntitySchema;

const EntitySearchResponseSchema = z.object({
 results: z.array(EntitySearchResultSchema),
 nextCursor: z.string().optional(),
 prevCursor: z.string().optional(),
 totalItems: z.number().optional(),
});

const LocationsResponseSchema = z.object({
 items: z.array(CatalogLocationSchema),
});

const LocationByIdResponseSchema = CatalogLocationSchema;

const EntityFacetsResponseSchema = z.object({
 facets: z.record(z.array(z.object({
 value: z.string(),
 count: z.number(),
 }))),
});

// Type definitions
export type EntitiesResponse = z.infer<typeof EntitiesResponseSchema>;
export type EntitySearchResponse = z.infer<typeof EntitySearchResponseSchema>;
export type LocationsResponse = z.infer<typeof LocationsResponseSchema>;
export type EntityFacetsResponse = z.infer<typeof EntityFacetsResponseSchema>;

export interface EntitySearchOptions extends CatalogQueryParams {
 term?: string;
 types?: string[];
}

export interface EntityAnalyticsOptions {
 timeRange?: '1h' | '1d' | '7d' | '30d';
 groupBy?: 'kind' | 'owner' | 'lifecycle' | 'system';
}

export class CatalogClient {
 private readonly client: BackstageApiClient;

 constructor() {
 this.client = createBackstageClient('catalog');
 }

 // Get all entities with optional filtering
 async getEntities(
 query: CatalogQuery = {},
 options: RequestOptions = {}
 ): Promise<PaginatedResponse<Entity>> {
 const validatedQuery = CatalogQuerySchema.parse(query);
 
 const response = await this.client.request(
 {
 method: 'GET',
 url: '/entities',
 params: this.buildQueryParams(validatedQuery),
 },
 EntitiesResponseSchema,
 options
 );

 return {
 items: response.items,
 total: response.totalItems || response.items.length,
 page: Math.floor((query.offset || 0) / (query.limit || 20)) + 1,
 pageSize: query.limit || 20,
 hasMore: !!response.pageInfo?.nextCursor,
 pageInfo: response.pageInfo,
 };
 }

 // Get entity by reference (kind:namespace/name)
 async getEntityByRef(
 entityRef: string,
 options: RequestOptions = {}
 ): Promise<Entity> {
 const { kind, namespace = 'default', name } = parseEntityRef(entityRef);
 
 try {
 // Use the version-compatible API adapter
 const response = await apiAdapter.getCatalogEntityByName(kind, namespace, name);
 return EntityByNameResponseSchema.parse(response.data);
 } catch (error) {
 // Fallback to original client for backward compatibility
 return this.client.request(
 {
 method: 'GET',
 url: `/entities/by-name/${kind}/${namespace}/${name}`,
 },
 EntityByNameResponseSchema,
 options
 );
 }
 }

 // Get entity by UID
 async getEntityByUid(
 uid: string,
 options: RequestOptions = {}
 ): Promise<Entity> {
 return this.client.request(
 {
 method: 'GET',
 url: `/entities/by-uid/${uid}`,
 },
 EntityByNameResponseSchema,
 options
 );
 }

 // Search entities with full-text search
 async searchEntities(
 searchOptions: EntitySearchOptions = {},
 options: RequestOptions = {}
 ): Promise<EntitySearchResponse> {
 const params = this.buildSearchParams(searchOptions);
 
 return this.client.request(
 {
 method: 'GET',
 url: '/entities/search',
 params,
 },
 EntitySearchResponseSchema,
 options
 );
 }

 // Get entities by owner
 async getEntitiesByOwner(
 owner: string,
 query: Omit<CatalogQuery, 'filter'> = {},
 options: RequestOptions = {}
 ): Promise<PaginatedResponse<Entity>> {
 const ownerFilter = `spec.owner=${owner}`;
 const existingFilters = Array.isArray(query.filter) ? query.filter : query.filter ? [query.filter] : [];
 
 return this.getEntities(
 {
 ...query,
 filter: [...existingFilters, ownerFilter],
 },
 options
 );
 }

 // Get entities by kind
 async getEntitiesByKind(
 kind: string,
 query: Omit<CatalogQuery, 'filter'> = {},
 options: RequestOptions = {}
 ): Promise<PaginatedResponse<Entity>> {
 const kindFilter = `kind=${kind}`;
 const existingFilters = Array.isArray(query.filter) ? query.filter : query.filter ? [query.filter] : [];
 
 return this.getEntities(
 {
 ...query,
 filter: [...existingFilters, kindFilter],
 },
 options
 );
 }

 // Get entity relationships
 async getEntityRelationships(
 entityRef: string,
 options: RequestOptions = {}
 ): Promise<{ relations: Array<{ type: string; targetRef: string; target?: Entity }> }> {
 const entity = await this.getEntityByRef(entityRef, options);
 
 return {
 relations: entity.relations || [],
 };
 }

 // Get entity ancestors (entities this entity depends on)
 async getEntityAncestors(
 entityRef: string,
 options: RequestOptions = {}
 ): Promise<Entity[]> {
 const { relations } = await this.getEntityRelationships(entityRef, options);
 
 const ancestorRefs = relations
 .filter(rel => ['dependsOn', 'partOf', 'consumesApi'].includes(rel.type))
 .map(rel => rel.targetRef);

 const ancestors: Entity[] = [];
 for (const ref of ancestorRefs) {
 try {
 const ancestor = await this.getEntityByRef(ref, { ...options, cache: true });
 ancestors.push(ancestor);
 } catch (error) {
 console.warn(`Could not fetch ancestor entity ${ref}:`, error);
 }
 }

 return ancestors;
 }

 // Get entity descendants (entities that depend on this entity)
 async getEntityDescendants(
 entityRef: string,
 options: RequestOptions = {}
 ): Promise<Entity[]> {
 const targetFilter = `relations.targetRef=${entityRef}`;
 
 const response = await this.getEntities(
 {
 filter: targetFilter,
 limit: 1000, // Get all descendants
 },
 options
 );

 return response.items;
 }

 // Get catalog locations
 async getLocations(options: RequestOptions = {}): Promise<CatalogLocation[]> {
 const response = await this.client.request(
 {
 method: 'GET',
 url: '/locations',
 },
 LocationsResponseSchema,
 options
 );

 return response.items;
 }

 // Get location by ID
 async getLocationById(
 id: string,
 options: RequestOptions = {}
 ): Promise<CatalogLocation> {
 return this.client.request(
 {
 method: 'GET',
 url: `/locations/${id}`,
 },
 LocationByIdResponseSchema,
 options
 );
 }

 // Add location
 async addLocation(
 location: { type: string; target: string },
 options: RequestOptions = {}
 ): Promise<CatalogLocation> {
 return this.client.request(
 {
 method: 'POST',
 url: '/locations',
 data: location,
 },
 LocationByIdResponseSchema,
 options
 );
 }

 // Delete location
 async deleteLocation(
 id: string,
 options: RequestOptions = {}
 ): Promise<void> {
 await this.client.delete(`/locations/${id}`, options);
 }

 // Get entity facets for filtering
 async getEntityFacets(
 facets: string[] = ['kind', 'spec.type', 'spec.lifecycle', 'spec.owner'],
 filter?: string | string[],
 options: RequestOptions = {}
 ): Promise<EntityFacetsResponse> {
 const params: Record<string, unknown> = {
 facet: facets,
 };

 if (filter) {
 params.filter = filter;
 }

 return this.client.request(
 {
 method: 'GET',
 url: '/entity-facets',
 params,
 },
 EntityFacetsResponseSchema,
 options
 );
 }

 // Refresh entity
 async refreshEntity(
 entityRef: string,
 options: RequestOptions = {}
 ): Promise<void> {
 const { kind, namespace = 'default', name } = parseEntityRef(entityRef);
 
 await this.client.post(
 `/entities/by-name/${kind}/${namespace}/${name}/refresh`,
 {},
 options
 );
 }

 // Get entity analytics
 async getEntityAnalytics(
 analyticsOptions: EntityAnalyticsOptions = {},
 options: RequestOptions = {}
 ): Promise<{
 totalEntities: number;
 entitiesByKind: Record<string, number>;
 entitiesByOwner: Record<string, number>;
 entitiesByLifecycle: Record<string, number>;
 trends: Array<{ date: string; count: number }>;
 }> {
 // This would be a custom endpoint or computed from entities
 const allEntities = await this.getEntities({ limit: 10000 }, options);
 
 const entitiesByKind: Record<string, number> = {};
 const entitiesByOwner: Record<string, number> = {};
 const entitiesByLifecycle: Record<string, number> = {};

 allEntities.items.forEach(entity => {
 // Count by kind
 entitiesByKind[entity.kind] = (entitiesByKind[entity.kind] || 0) + 1;
 
 // Count by owner
 const owner = (entity.spec as any)?.owner;
 if (owner) {
 entitiesByOwner[owner] = (entitiesByOwner[owner] || 0) + 1;
 }
 
 // Count by lifecycle
 const lifecycle = (entity.spec as any)?.lifecycle;
 if (lifecycle) {
 entitiesByLifecycle[lifecycle] = (entitiesByLifecycle[lifecycle] || 0) + 1;
 }
 });

 return {
 totalEntities: allEntities.items.length,
 entitiesByKind,
 entitiesByOwner,
 entitiesByLifecycle,
 trends: [], // Would implement based on historical data
 };
 }

 // Validate entity
 async validateEntity(
 entity: Partial<Entity>,
 options: RequestOptions = {}
 ): Promise<{ valid: boolean; errors: string[] }> {
 try {
 EntitySchema.parse(entity);
 return { valid: true, errors: [] };
 } catch (error) {
 const errors = error instanceof z.ZodError 
 ? error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
 : ['Unknown validation error'];
 
 return { valid: false, errors };
 }
 }

 // Helper method to build query parameters
 private buildQueryParams(query: CatalogQuery): Record<string, unknown> {
 const params: Record<string, unknown> = {};

 if (query.filter) {
 params.filter = query.filter;
 }
 
 if (query.fields) {
 params.fields = query.fields;
 }
 
 if (query.order) {
 params.order = query.order;
 }
 
 if (query.limit) {
 params.limit = query.limit;
 }
 
 if (query.offset) {
 params.offset = query.offset;
 }
 
 if (query.cursor) {
 params.cursor = query.cursor;
 }

 return params;
 }

 // Helper method to build search parameters
 private buildSearchParams(searchOptions: EntitySearchOptions): Record<string, unknown> {
 const params: Record<string, unknown> = {};

 if (searchOptions.term) {
 params.term = searchOptions.term;
 }
 
 if (searchOptions.types) {
 params.types = searchOptions.types;
 }
 
 if (searchOptions.filter) {
 params.filter = searchOptions.filter;
 }
 
 if (searchOptions.limit) {
 params.limit = searchOptions.limit;
 }
 
 if (searchOptions.offset) {
 params.offset = searchOptions.offset;
 }

 return params;
 }

 // Clear all cached data
 clearCache(): void {
 this.client.clearCache();
 }

 // Get cache statistics
 getCacheStats(): { size: number; entries: string[] } {
 return this.client.getCacheStats();
 }
}

// Export singleton instance
export const catalogClient = new CatalogClient();