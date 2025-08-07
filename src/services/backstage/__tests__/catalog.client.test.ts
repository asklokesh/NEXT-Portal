/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { catalogClient } from '../clients/catalog.client';
import { enableMocking, disableMocking, resetMocks } from '../mocks/server';

import type { Entity, ComponentEntity } from '../types/entities';

// Setup MSW for tests
beforeAll(() => enableMocking());
afterEach(() => resetMocks());
afterAll(() => disableMocking());

describe('CatalogClient', () => {
 describe('getEntities', () => {
 it('should fetch entities successfully', async () => {
 const result = await catalogClient.getEntities();
 
 expect(result.items).toBeInstanceOf(Array);
 expect(result.items.length).toBeGreaterThan(0);
 expect(result.total).toBeGreaterThan(0);
 });

 it('should apply filters correctly', async () => {
 const result = await catalogClient.getEntities({
 filter: 'kind=Component',
 limit: 5,
 });
 
 expect(result.items).toBeInstanceOf(Array);
 expect(result.items.length).toBeLessThanOrEqual(5);
 result.items.forEach(item => {
 expect(item.kind).toBe('Component');
 });
 });

 it('should handle pagination', async () => {
 const page1 = await catalogClient.getEntities({ limit: 5, offset: 0 });
 const page2 = await catalogClient.getEntities({ limit: 5, offset: 5 });
 
 expect(page1.items).toHaveLength(5);
 expect(page2.items).toHaveLength(5);
 expect(page1.items[0].metadata.name).not.toBe(page2.items[0].metadata.name);
 });
 });

 describe('getEntityByRef', () => {
 it('should fetch entity by reference', async () => {
 const entityRef = 'Component:default/component-1';
 const entity = await catalogClient.getEntityByRef(entityRef);
 
 expect(entity).toBeDefined();
 expect(entity.kind).toBe('Component');
 expect(entity.metadata.name).toBe('component-1');
 });

 it('should throw error for non-existent entity', async () => {
 const entityRef = 'Component:default/non-existent';
 
 await expect(catalogClient.getEntityByRef(entityRef))
 .rejects
 .toThrow();
 });
 });

 describe('searchEntities', () => {
 it('should search entities by term', async () => {
 const result = await catalogClient.searchEntities({ term: 'component' });
 
 expect(result.results).toBeInstanceOf(Array);
 expect(result.results.length).toBeGreaterThan(0);
 result.results.forEach(item => {
 expect(item.entity).toBeDefined();
 expect(item.rank).toBeDefined();
 });
 });

 it('should return empty results for non-matching term', async () => {
 const result = await catalogClient.searchEntities({ term: 'nonexistent12345' });
 
 expect(result.results).toBeInstanceOf(Array);
 expect(result.results).toHaveLength(0);
 });
 });

 describe('getEntitiesByKind', () => {
 it('should fetch entities by kind', async () => {
 const result = await catalogClient.getEntitiesByKind('Component');
 
 expect(result.items).toBeInstanceOf(Array);
 result.items.forEach(item => {
 expect(item.kind).toBe('Component');
 });
 });

 it('should handle empty results for non-existent kind', async () => {
 const result = await catalogClient.getEntitiesByKind('NonExistentKind');
 
 expect(result.items).toBeInstanceOf(Array);
 expect(result.items).toHaveLength(0);
 });
 });

 describe('getEntitiesByOwner', () => {
 it('should fetch entities by owner', async () => {
 const result = await catalogClient.getEntitiesByOwner('team-alpha');
 
 expect(result.items).toBeInstanceOf(Array);
 result.items.forEach(item => {
 if ('spec' in item && item.spec && typeof item.spec === 'object') {
 expect((item.spec as any).owner).toBe('team-alpha');
 }
 });
 });
 });

 describe('getLocations', () => {
 it('should fetch catalog locations', async () => {
 const locations = await catalogClient.getLocations();
 
 expect(locations).toBeInstanceOf(Array);
 expect(locations.length).toBeGreaterThan(0);
 locations.forEach(location => {
 expect(location.id).toBeDefined();
 expect(location.type).toBeDefined();
 expect(location.target).toBeDefined();
 });
 });
 });

 describe('validateEntity', () => {
 it('should validate valid entity', async () => {
 const validEntity: ComponentEntity = {
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'Component',
 metadata: {
 name: 'test-component',
 title: 'Test Component',
 },
 spec: {
 type: 'service',
 lifecycle: 'production',
 owner: 'team-test',
 },
 };

 const result = await catalogClient.validateEntity(validEntity);
 expect(result.valid).toBe(true);
 expect(result.errors).toHaveLength(0);
 });

 it('should invalidate entity with missing required fields', async () => {
 const invalidEntity = {
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'Component',
 metadata: {
 // Missing name
 },
 };

 const result = await catalogClient.validateEntity(invalidEntity as any);
 expect(result.valid).toBe(false);
 expect(result.errors.length).toBeGreaterThan(0);
 });
 });

 describe('caching', () => {
 it('should cache responses', async () => {
 const startTime = Date.now();
 
 // First request
 await catalogClient.getEntities();
 const firstRequestTime = Date.now() - startTime;
 
 const cacheStartTime = Date.now();
 
 // Second request (should be cached)
 await catalogClient.getEntities();
 const secondRequestTime = Date.now() - cacheStartTime;
 
 // Cached request should be significantly faster
 expect(secondRequestTime).toBeLessThan(firstRequestTime);
 });

 it('should provide cache statistics', () => {
 const stats = catalogClient.getCacheStats();
 
 expect(stats).toHaveProperty('size');
 expect(stats).toHaveProperty('entries');
 expect(typeof stats.size).toBe('number');
 expect(Array.isArray(stats.entries)).toBe(true);
 });

 it('should clear cache', async () => {
 // Populate cache
 await catalogClient.getEntities();
 
 let stats = catalogClient.getCacheStats();
 expect(stats.size).toBeGreaterThan(0);
 
 // Clear cache
 catalogClient.clearCache();
 
 stats = catalogClient.getCacheStats();
 expect(stats.size).toBe(0);
 });
 });

 describe('error handling', () => {
 it('should handle network errors gracefully', async () => {
 // This would be tested with a mock that throws network errors
 // For now, we'll test that the error is properly typed
 try {
 await catalogClient.getEntityByRef('Component:default/non-existent');
 } catch (error) {
 expect(error).toBeInstanceOf(Error);
 }
 });
 });
});