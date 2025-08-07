import { NextRequest, NextResponse } from 'next/server';
import { cache, cacheKeys } from './redis';

export interface CacheOptions {
 ttl?: number; // Time to live in seconds
 key?: string | ((req: NextRequest) => string); // Custom cache key
 revalidate?: boolean; // Force cache refresh
 tags?: string[]; // Cache tags for invalidation
}

/**
 * Cache middleware for API routes
 */
export function withCache(
 handler: (req: NextRequest) => Promise<NextResponse>,
 options: CacheOptions = {}
) {
 return async (req: NextRequest): Promise<NextResponse> => {
 const { ttl = 300, key, revalidate = false, tags = [] } = options;
 
 // Generate cache key
 const cacheKey = typeof key === 'function' 
 ? key(req)
 : key || generateCacheKey(req);
 
 // Check if cache should be bypassed
 const shouldBypassCache = 
 revalidate || 
 req.headers.get('cache-control') === 'no-cache' ||
 req.headers.get('x-no-cache') === 'true';
 
 // Try to get from cache if not bypassing
 if (!shouldBypassCache) {
 try {
 const cached = await cache.get<any>(cacheKey);
 if (cached) {
 // Add cache headers
 const response = NextResponse.json(cached);
 response.headers.set('x-cache', 'HIT');
 response.headers.set('x-cache-key', cacheKey);
 response.headers.set('cache-control', `public, max-age=${ttl}`);
 return response;
 }
 } catch (error) {
 console.error('Cache retrieval error:', error);
 }
 }
 
 // Execute handler
 const response = await handler(req);
 
 // Cache successful responses
 if (response.ok) {
 try {
 const data = await response.json();
 await cache.set(cacheKey, data, ttl);
 
 // Store tags for cache invalidation
 if (tags.length > 0) {
 for (const tag of tags) {
 await cache.hset(`cache:tags:${tag}`, cacheKey, Date.now(), 86400); // 24h TTL
 }
 }
 
 // Return new response with cache headers
 const cachedResponse = NextResponse.json(data);
 cachedResponse.headers.set('x-cache', 'MISS');
 cachedResponse.headers.set('x-cache-key', cacheKey);
 cachedResponse.headers.set('cache-control', `public, max-age=${ttl}`);
 return cachedResponse;
 } catch (error) {
 console.error('Cache storage error:', error);
 return response;
 }
 }
 
 return response;
 };
}

/**
 * Invalidate cache by tags
 */
export async function invalidateCacheTags(tags: string[]): Promise<void> {
 for (const tag of tags) {
 const keys = await cache.hgetall<Record<string, number>>(`cache:tags:${tag}`);
 if (keys) {
 for (const key of Object.keys(keys)) {
 await cache.del(key);
 }
 await cache.del(`cache:tags:${tag}`);
 }
 }
}

/**
 * Generate cache key from request
 */
function generateCacheKey(req: NextRequest): string {
 const url = new URL(req.url);
 const method = req.method;
 const pathname = url.pathname;
 const searchParams = url.searchParams.toString();
 
 // Include important headers in cache key
 const headers = [
 req.headers.get('x-tenant-id'),
 req.headers.get('x-user-id'),
 ].filter(Boolean).join(':');
 
 return `${method}:${pathname}:${searchParams}:${headers}`;
}

/**
 * Cache control for React Query
 */
export function getCacheHeaders(ttl: number = 300) {
 return {
 'Cache-Control': `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}`,
 'CDN-Cache-Control': `public, max-age=${ttl}`,
 };
}

/**
 * React Query cache utilities
 */
export const queryCacheUtils = {
 // Generate consistent query keys
 keys: {
 service: (id: string) => ['service', id],
 services: (filters?: any) => ['services', filters],
 template: (id: string) => ['template', id],
 templates: (filters?: any) => ['templates', filters],
 costs: (provider: string, period: string) => ['costs', provider, period],
 analytics: (metric: string, params?: any) => ['analytics', metric, params],
 },
 
 // Stale times for different data types
 staleTimes: {
 static: 24 * 60 * 60 * 1000, // 24 hours for static data
 dynamic: 5 * 60 * 1000, // 5 minutes for dynamic data
 realtime: 30 * 1000, // 30 seconds for real-time data
 },
};

/**
 * Batch cache operations
 */
export class CacheBatch {
 private operations: Array<() => Promise<void>> = [];
 
 set<T>(key: string, value: T, ttl?: number): this {
 this.operations.push(() => cache.set(key, value, ttl));
 return this;
 }
 
 del(key: string): this {
 this.operations.push(() => cache.del(key));
 return this;
 }
 
 async execute(): Promise<void> {
 await Promise.all(this.operations.map(op => op()));
 this.operations = [];
 }
}

/**
 * Cache warming utilities
 */
export const cacheWarmer = {
 async warmServiceCache(): Promise<void> {
 try {
 // Warm frequently accessed service data
 const response = await fetch('/api/backstage/catalog/entities?kind=Component');
 if (response.ok) {
 const data = await response.json();
 await cache.set(cacheKeys.serviceList(), data, 600); // 10 minutes
 }
 } catch (error) {
 console.error('Cache warming error:', error);
 }
 },
 
 async warmTemplateCache(): Promise<void> {
 try {
 // Warm template data
 const response = await fetch('/api/backstage/scaffolder/templates');
 if (response.ok) {
 const data = await response.json();
 await cache.set(cacheKeys.templateList(), data, 600);
 }
 } catch (error) {
 console.error('Cache warming error:', error);
 }
 },
 
 async warmAll(): Promise<void> {
 await Promise.all([
 this.warmServiceCache(),
 this.warmTemplateCache(),
 ]);
 },
};