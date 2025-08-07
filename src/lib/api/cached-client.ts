import { cache, cacheKeys } from '@/lib/cache/redis';

interface CacheOptions {
 ttl?: number; // Time to live in seconds
 force?: boolean; // Force refresh cache
 key?: string; // Custom cache key
}

/**
 * Cached API client wrapper
 * Automatically caches API responses with configurable TTL
 */
export class CachedAPIClient {
 private baseURL: string;
 private defaultTTL: number;
 private headers: Record<string, string>;

 constructor(baseURL: string, defaultTTL: number = 300) {
 this.baseURL = baseURL;
 this.defaultTTL = defaultTTL;
 this.headers = {
 'Content-Type': 'application/json',
 };
 }

 /**
 * Set authorization header
 */
 setAuth(token: string) {
 this.headers['Authorization'] = `Bearer ${token}`;
 }

 /**
 * Generate cache key from URL and params
 */
 private getCacheKey(url: string, params?: any): string {
 const paramStr = params ? JSON.stringify(params) : '';
 return cacheKeys.apiResponse(url, paramStr);
 }

 /**
 * Make a cached GET request
 */
 async get<T>(
 path: string, 
 params?: Record<string, any>,
 options: CacheOptions = {}
 ): Promise<T> {
 const url = new URL(path, this.baseURL);
 
 if (params) {
 Object.entries(params).forEach(([key, value]) => {
 if (value !== undefined && value !== null) {
 url.searchParams.set(key, String(value));
 }
 });
 }

 const cacheKey = options.key || this.getCacheKey(url.toString(), params);
 const ttl = options.ttl || this.defaultTTL;

 // Check cache first
 if (!options.force) {
 const cached = await cache.get<T>(cacheKey);
 if (cached !== null) {
 console.log(`Cache hit: ${cacheKey}`);
 return cached;
 }
 }

 console.log(`Cache miss: ${cacheKey}`);

 try {
 // Make the actual request
 const response = await fetch(url.toString(), {
 method: 'GET',
 headers: this.headers,
 });

 if (!response.ok) {
 throw new Error(`API error: ${response.status} ${response.statusText}`);
 }

 const data = await response.json();

 // Cache the successful response
 await cache.set(cacheKey, data, ttl);

 return data;
 } catch (error) {
 // Try to return stale cache on error
 const staleData = await cache.get<T>(cacheKey);
 if (staleData !== null) {
 console.log(`Returning stale cache due to error: ${cacheKey}`);
 return staleData;
 }
 
 throw error;
 }
 }

 /**
 * Make a POST request (not cached)
 */
 async post<T>(path: string, body?: any): Promise<T> {
 const url = new URL(path, this.baseURL);
 
 const response = await fetch(url.toString(), {
 method: 'POST',
 headers: this.headers,
 body: body ? JSON.stringify(body) : undefined,
 });

 if (!response.ok) {
 throw new Error(`API error: ${response.status} ${response.statusText}`);
 }

 const data = await response.json();

 // Invalidate related caches
 await this.invalidateRelatedCaches(path, 'POST');

 return data;
 }

 /**
 * Make a PUT request (not cached)
 */
 async put<T>(path: string, body?: any): Promise<T> {
 const url = new URL(path, this.baseURL);
 
 const response = await fetch(url.toString(), {
 method: 'PUT',
 headers: this.headers,
 body: body ? JSON.stringify(body) : undefined,
 });

 if (!response.ok) {
 throw new Error(`API error: ${response.status} ${response.statusText}`);
 }

 const data = await response.json();

 // Invalidate related caches
 await this.invalidateRelatedCaches(path, 'PUT');

 return data;
 }

 /**
 * Make a DELETE request (not cached)
 */
 async delete<T>(path: string): Promise<T> {
 const url = new URL(path, this.baseURL);
 
 const response = await fetch(url.toString(), {
 method: 'DELETE',
 headers: this.headers,
 });

 if (!response.ok) {
 throw new Error(`API error: ${response.status} ${response.statusText}`);
 }

 const data = response.headers.get('content-length') !== '0' 
 ? await response.json() 
 : null;

 // Invalidate related caches
 await this.invalidateRelatedCaches(path, 'DELETE');

 return data;
 }

 /**
 * Invalidate caches related to a mutation
 */
 private async invalidateRelatedCaches(path: string, method: string) {
 // Extract entity type from path
 const pathParts = path.split('/').filter(Boolean);
 
 // Invalidate based on common patterns
 if (path.includes('/services')) {
 await cache.delPattern('services:*');
 await cache.delPattern('service:*');
 }
 
 if (path.includes('/templates')) {
 await cache.delPattern('templates:*');
 await cache.delPattern('template:*');
 }
 
 if (path.includes('/costs')) {
 await cache.delPattern('costs:*');
 }
 
 if (path.includes('/users')) {
 await cache.delPattern('user:*');
 }

 // Invalidate generic API response caches
 await cache.delPattern(`api:${this.baseURL}*`);
 }

 /**
 * Prefetch and cache data
 */
 async prefetch<T>(
 path: string, 
 params?: Record<string, any>,
 ttl?: number
 ): Promise<void> {
 try {
 await this.get<T>(path, params, { ttl });
 } catch (error) {
 console.error('Prefetch error:', error);
 }
 }

 /**
 * Batch prefetch multiple endpoints
 */
 async batchPrefetch(
 requests: Array<{
 path: string;
 params?: Record<string, any>;
 ttl?: number;
 }>
 ): Promise<void> {
 await Promise.all(
 requests.map(req => 
 this.prefetch(req.path, req.params, req.ttl)
 )
 );
 }

 /**
 * Clear all caches for this client
 */
 async clearCache(): Promise<void> {
 await cache.delPattern(`api:${this.baseURL}*`);
 }
}

// Create cached Backstage client
export const cachedBackstageClient = new CachedAPIClient(
 process.env.BACKSTAGE_API_URL || 'http://localhost:7007',
 300 // 5 minutes default TTL
);

// Set auth token if available
if (process.env.BACKSTAGE_AUTH_TOKEN) {
 cachedBackstageClient.setAuth(process.env.BACKSTAGE_AUTH_TOKEN);
}

// Prefetch common data on startup
if (process.env.NODE_ENV === 'production') {
 cachedBackstageClient.batchPrefetch([
 { path: '/api/catalog/entities', ttl: 600 },
 { path: '/api/scaffolder/templates', ttl: 1800 },
 { path: '/api/techdocs/metadata', ttl: 3600 },
 ]).catch(console.error);
}