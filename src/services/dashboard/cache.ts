/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
/**
 * Dashboard Data Caching Service
 * Provides intelligent caching for widget data to reduce API calls
 */

interface CacheEntry<T> {
 data: T;
 timestamp: number;
 ttl: number; // Time to live in milliseconds
}

interface CacheConfig {
 defaultTTL: number;
 maxSize: number;
 cleanupInterval: number;
}

export class DashboardCache {
 private cache = new Map<string, CacheEntry<any>>();
 private config: CacheConfig;
 private cleanupTimer?: NodeJS.Timeout;

 constructor(config: Partial<CacheConfig> = {}) {
 this.config = {
 defaultTTL: 30000, // 30 seconds default
 maxSize: 1000, // Max 1000 entries
 cleanupInterval: 60000, // Cleanup every minute
 ...config
 };

 this.startCleanup();
 }

 /**
 * Get cached data if available and not expired
 */
 get<T>(key: string): T | null {
 const entry = this.cache.get(key);
 
 if (!entry) {
 return null;
 }

 const now = Date.now();
 if (now - entry.timestamp > entry.ttl) {
 this.cache.delete(key);
 return null;
 }

 return entry.data;
 }

 /**
 * Set data in cache with optional TTL
 */
 set<T>(key: string, data: T, ttl?: number): void {
 // Enforce max size limit
 if (this.cache.size >= this.config.maxSize) {
 this.evictOldest();
 }

 const entry: CacheEntry<T> = {
 data,
 timestamp: Date.now(),
 ttl: ttl || this.config.defaultTTL
 };

 this.cache.set(key, entry);
 }

 /**
 * Check if key exists and is not expired
 */
 has(key: string): boolean {
 return this.get(key) !== null;
 }

 /**
 * Remove specific key from cache
 */
 delete(key: string): boolean {
 return this.cache.delete(key);
 }

 /**
 * Clear all cache entries
 */
 clear(): void {
 this.cache.clear();
 }

 /**
 * Get cache statistics
 */
 getStats(): {
 size: number;
 maxSize: number;
 hitRate: number;
 entries: Array<{ key: string; age: number; ttl: number }>;
 } {
 const now = Date.now();
 const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
 key,
 age: now - entry.timestamp,
 ttl: entry.ttl
 }));

 return {
 size: this.cache.size,
 maxSize: this.config.maxSize,
 hitRate: this.calculateHitRate(),
 entries
 };
 }

 /**
 * Get or fetch data with caching
 */
 async getOrFetch<T>(
 key: string,
 fetchFn: () => Promise<T>,
 ttl?: number
 ): Promise<T> {
 // Try to get from cache first
 const cached = this.get<T>(key);
 if (cached !== null) {
 return cached;
 }

 // Fetch new data
 const data = await fetchFn();
 this.set(key, data, ttl);
 return data;
 }

 /**
 * Invalidate cache entries by pattern
 */
 invalidatePattern(pattern: string): number {
 const regex = new RegExp(pattern);
 let deleted = 0;

 for (const key of this.cache.keys()) {
 if (regex.test(key)) {
 this.cache.delete(key);
 deleted++;
 }
 }

 return deleted;
 }

 /**
 * Preload data into cache
 */
 async preload<T>(
 key: string,
 fetchFn: () => Promise<T>,
 ttl?: number
 ): Promise<void> {
 try {
 const data = await fetchFn();
 this.set(key, data, ttl);
 } catch (error) {
 console.warn(`Failed to preload cache key ${key}:`, error);
 }
 }

 private evictOldest(): void {
 let oldestKey: string | null = null;
 let oldestTime = Date.now();

 for (const [key, entry] of this.cache.entries()) {
 if (entry.timestamp < oldestTime) {
 oldestTime = entry.timestamp;
 oldestKey = key;
 }
 }

 if (oldestKey) {
 this.cache.delete(oldestKey);
 }
 }

 private startCleanup(): void {
 this.cleanupTimer = setInterval(() => {
 this.cleanup();
 }, this.config.cleanupInterval);
 }

 private cleanup(): void {
 const now = Date.now();
 const toDelete: string[] = [];

 for (const [key, entry] of this.cache.entries()) {
 if (now - entry.timestamp > entry.ttl) {
 toDelete.push(key);
 }
 }

 toDelete.forEach(key => this.cache.delete(key));
 }

 private calculateHitRate(): number {
 // This would need to be tracked over time for accurate hit rate
 // For now, return a placeholder
 return 0;
 }

 /**
 * Destroy cache and cleanup timers
 */
 destroy(): void {
 if (this.cleanupTimer) {
 clearInterval(this.cleanupTimer);
 }
 this.clear();
 }
}

// Create singleton instance
export const dashboardCache = new DashboardCache({
 defaultTTL: 30000, // 30 seconds for dashboard data
 maxSize: 500,
 cleanupInterval: 60000
});

// Cache key builders
export const CacheKeys = {
 widgetData: (widgetId: string, dataSource: string) => 
 `widget:${widgetId}:${dataSource}`,
 
 serviceMetrics: (entityRef: string) => 
 `service-metrics:${entityRef}`,
 
 userServices: (userId?: string) => 
 `user-services:${userId || 'anonymous'}`,
 
 dashboardConfig: (dashboardId: string) => 
 `dashboard-config:${dashboardId}`,
 
 aggregatedMetrics: (type: string, timeRange: string) => 
 `aggregated:${type}:${timeRange}`,
};