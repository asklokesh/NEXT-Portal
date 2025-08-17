/**
 * Multi-Tenant Redis Caching Strategy
 * Enterprise-grade caching with tenant isolation and smart invalidation
 */

import Redis from 'ioredis';
import { createHash } from 'crypto';

// Cache configuration for different data types
const CACHE_CONFIGS = {
  // User and authentication data
  user: { ttl: 300, prefix: 'user' }, // 5 minutes
  session: { ttl: 3600, prefix: 'session' }, // 1 hour
  permissions: { ttl: 600, prefix: 'perms' }, // 10 minutes
  
  // Plugin and catalog data
  plugins: { ttl: 300, prefix: 'plugins' }, // 5 minutes
  pluginMetadata: { ttl: 3600, prefix: 'plugin-meta' }, // 1 hour
  catalogEntities: { ttl: 600, prefix: 'catalog' }, // 10 minutes
  
  // Health and monitoring data
  healthChecks: { ttl: 60, prefix: 'health' }, // 1 minute
  metrics: { ttl: 300, prefix: 'metrics' }, // 5 minutes
  alerts: { ttl: 120, prefix: 'alerts' }, // 2 minutes
  
  // API responses
  apiResponses: { ttl: 180, prefix: 'api' }, // 3 minutes
  searchResults: { ttl: 300, prefix: 'search' }, // 5 minutes
  
  // Static and configuration data
  configuration: { ttl: 3600, prefix: 'config' }, // 1 hour
  templates: { ttl: 1800, prefix: 'templates' }, // 30 minutes
  
  // Real-time data
  events: { ttl: 30, prefix: 'events' }, // 30 seconds
  notifications: { ttl: 300, prefix: 'notifications' }, // 5 minutes
  
  // Billing and cost data
  costs: { ttl: 3600, prefix: 'costs' }, // 1 hour
  billing: { ttl: 1800, prefix: 'billing' }, // 30 minutes
} as const;

type CacheType = keyof typeof CACHE_CONFIGS;

interface CacheOptions {
  ttl?: number;
  tags?: string[];
  tenantId?: string;
  userId?: string;
  compress?: boolean;
  serialize?: boolean;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  totalKeys: number;
}

class MultiTenantCacheManager {
  private static instance: MultiTenantCacheManager;
  private redis: Redis;
  private metrics: Map<string, CacheMetrics> = new Map();
  private keyPrefix: string;

  private constructor(redis: Redis) {
    this.redis = redis;
    this.keyPrefix = process.env.REDIS_KEY_PREFIX || 'saas-idp:';
    this.initializeMetrics();
  }

  static getInstance(redis: Redis): MultiTenantCacheManager {
    if (!MultiTenantCacheManager.instance) {
      MultiTenantCacheManager.instance = new MultiTenantCacheManager(redis);
    }
    return MultiTenantCacheManager.instance;
  }

  /**
   * Generate tenant-isolated cache key
   */
  private generateKey(
    type: CacheType,
    key: string,
    tenantId?: string,
    userId?: string
  ): string {
    const config = CACHE_CONFIGS[type];
    const parts = [this.keyPrefix, config.prefix];
    
    // Add tenant isolation
    if (tenantId) {
      parts.push(`tenant:${tenantId}`);
    }
    
    // Add user isolation if needed
    if (userId) {
      parts.push(`user:${userId}`);
    }
    
    // Add the actual key
    parts.push(key);
    
    return parts.join(':');
  }

  /**
   * Generate cache key hash for complex objects
   */
  private generateKeyHash(data: any): string {
    return createHash('md5').update(JSON.stringify(data)).digest('hex');
  }

  /**
   * Set cache value with tenant isolation
   */
  async set<T>(
    type: CacheType,
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<boolean> {
    try {
      const config = CACHE_CONFIGS[type];
      const cacheKey = this.generateKey(type, key, options.tenantId, options.userId);
      const ttl = options.ttl || config.ttl;
      
      let serializedValue: string;
      
      if (options.serialize !== false) {
        serializedValue = JSON.stringify(value);
      } else {
        serializedValue = value as string;
      }
      
      // Compress large values
      if (options.compress && serializedValue.length > 1024) {
        // Simple compression simulation - in production use zlib
        serializedValue = `COMPRESSED:${serializedValue}`;
      }
      
      // Set with expiration
      await this.redis.setex(cacheKey, ttl, serializedValue);
      
      // Set tags for invalidation if provided
      if (options.tags && options.tags.length > 0) {
        await this.setTags(cacheKey, options.tags, ttl);
      }
      
      this.updateMetrics(type, 'sets');
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      this.updateMetrics(type, 'errors');
      return false;
    }
  }

  /**
   * Get cache value with tenant isolation
   */
  async get<T>(
    type: CacheType,
    key: string,
    options: CacheOptions = {}
  ): Promise<T | null> {
    try {
      const cacheKey = this.generateKey(type, key, options.tenantId, options.userId);
      const value = await this.redis.get(cacheKey);
      
      if (value === null) {
        this.updateMetrics(type, 'misses');
        return null;
      }
      
      this.updateMetrics(type, 'hits');
      
      let deserializedValue: string = value;
      
      // Handle compressed values
      if (value.startsWith('COMPRESSED:')) {
        deserializedValue = value.substring(11);
      }
      
      if (options.serialize !== false) {
        return JSON.parse(deserializedValue);
      } else {
        return deserializedValue as T;
      }
    } catch (error) {
      console.error('Cache get error:', error);
      this.updateMetrics(type, 'errors');
      return null;
    }
  }

  /**
   * Delete cache value
   */
  async delete(
    type: CacheType,
    key: string,
    options: CacheOptions = {}
  ): Promise<boolean> {
    try {
      const cacheKey = this.generateKey(type, key, options.tenantId, options.userId);
      const result = await this.redis.del(cacheKey);
      
      this.updateMetrics(type, 'deletes');
      return result > 0;
    } catch (error) {
      console.error('Cache delete error:', error);
      this.updateMetrics(type, 'errors');
      return false;
    }
  }

  /**
   * Get or set cache value (cache-aside pattern)
   */
  async getOrSet<T>(
    type: CacheType,
    key: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(type, key, options);
    if (cached !== null) {
      return cached;
    }
    
    // Fetch fresh data
    const freshData = await fetchFn();
    
    // Store in cache
    await this.set(type, key, freshData, options);
    
    return freshData;
  }

  /**
   * Multi-get operation for batch retrieval
   */
  async mget<T>(
    type: CacheType,
    keys: string[],
    options: CacheOptions = {}
  ): Promise<Map<string, T>> {
    try {
      const cacheKeys = keys.map(key => 
        this.generateKey(type, key, options.tenantId, options.userId)
      );
      
      const values = await this.redis.mget(...cacheKeys);
      const result = new Map<string, T>();
      
      values.forEach((value, index) => {
        if (value !== null) {
          try {
            const deserializedValue = options.serialize !== false 
              ? JSON.parse(value) 
              : value as T;
            result.set(keys[index], deserializedValue);
            this.updateMetrics(type, 'hits');
          } catch (error) {
            console.warn('Failed to deserialize cached value:', error);
            this.updateMetrics(type, 'errors');
          }
        } else {
          this.updateMetrics(type, 'misses');
        }
      });
      
      return result;
    } catch (error) {
      console.error('Cache mget error:', error);
      this.updateMetrics(type, 'errors');
      return new Map();
    }
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidatePattern(pattern: string): Promise<number> {
    try {
      const fullPattern = `${this.keyPrefix}${pattern}`;
      const keys = await this.redis.keys(fullPattern);
      
      if (keys.length === 0) {
        return 0;
      }
      
      const deletedCount = await this.redis.del(...keys);
      
      // Update metrics for all affected cache types
      Object.keys(CACHE_CONFIGS).forEach(type => {
        this.updateMetrics(type as CacheType, 'deletes', deletedCount);
      });
      
      return deletedCount;
    } catch (error) {
      console.error('Cache invalidation error:', error);
      return 0;
    }
  }

  /**
   * Invalidate all cache entries for a tenant
   */
  async invalidateTenant(tenantId: string): Promise<number> {
    return this.invalidatePattern(`*:tenant:${tenantId}:*`);
  }

  /**
   * Invalidate all cache entries for a user
   */
  async invalidateUser(userId: string, tenantId?: string): Promise<number> {
    const pattern = tenantId 
      ? `*:tenant:${tenantId}:user:${userId}:*`
      : `*:user:${userId}:*`;
    return this.invalidatePattern(pattern);
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    let totalDeleted = 0;
    
    for (const tag of tags) {
      try {
        const tagKey = `${this.keyPrefix}tag:${tag}`;
        const keys = await this.redis.smembers(tagKey);
        
        if (keys.length > 0) {
          const deleted = await this.redis.del(...keys);
          totalDeleted += deleted;
          
          // Clean up the tag set
          await this.redis.del(tagKey);
        }
      } catch (error) {
        console.error(`Error invalidating tag ${tag}:`, error);
      }
    }
    
    return totalDeleted;
  }

  /**
   * Set tags for cache invalidation
   */
  private async setTags(cacheKey: string, tags: string[], ttl: number): Promise<void> {
    try {
      const pipeline = this.redis.pipeline();
      
      for (const tag of tags) {
        const tagKey = `${this.keyPrefix}tag:${tag}`;
        pipeline.sadd(tagKey, cacheKey);
        pipeline.expire(tagKey, ttl + 60); // Tag TTL slightly longer than cache TTL
      }
      
      await pipeline.exec();
    } catch (error) {
      console.error('Error setting cache tags:', error);
    }
  }

  /**
   * Cache warming for frequently accessed data
   */
  async warmCache(
    type: CacheType,
    data: Array<{ key: string; value: any; options?: CacheOptions }>
  ): Promise<void> {
    try {
      const pipeline = this.redis.pipeline();
      const config = CACHE_CONFIGS[type];
      
      for (const item of data) {
        const cacheKey = this.generateKey(
          type, 
          item.key, 
          item.options?.tenantId, 
          item.options?.userId
        );
        const ttl = item.options?.ttl || config.ttl;
        const serializedValue = JSON.stringify(item.value);
        
        pipeline.setex(cacheKey, ttl, serializedValue);
      }
      
      await pipeline.exec();
      console.log(`Warmed ${data.length} cache entries for type: ${type}`);
    } catch (error) {
      console.error('Cache warming error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheInfo(): Promise<{
    memory: any;
    keys: number;
    metrics: Map<string, CacheMetrics>;
  }> {
    try {
      const info = await this.redis.info('memory');
      const keyCount = await this.redis.dbsize();
      
      return {
        memory: this.parseRedisInfo(info),
        keys: keyCount,
        metrics: this.metrics
      };
    } catch (error) {
      console.error('Error getting cache info:', error);
      return {
        memory: {},
        keys: 0,
        metrics: this.metrics
      };
    }
  }

  /**
   * Health check for cache system
   */
  async healthCheck(): Promise<boolean> {
    try {
      const ping = await this.redis.ping();
      return ping === 'PONG';
    } catch (error) {
      console.error('Cache health check failed:', error);
      return false;
    }
  }

  /**
   * Initialize metrics tracking
   */
  private initializeMetrics(): void {
    Object.keys(CACHE_CONFIGS).forEach(type => {
      this.metrics.set(type, {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        errors: 0,
        totalKeys: 0
      });
    });
  }

  /**
   * Update metrics for monitoring
   */
  private updateMetrics(type: CacheType, operation: keyof CacheMetrics, count: number = 1): void {
    const metrics = this.metrics.get(type);
    if (metrics) {
      metrics[operation] += count;
    }
  }

  /**
   * Parse Redis INFO output
   */
  private parseRedisInfo(info: string): any {
    const result: any = {};
    const lines = info.split('\r\n');
    
    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        result[key] = isNaN(Number(value)) ? value : Number(value);
      }
    }
    
    return result;
  }

  /**
   * Reset metrics (useful for periodic reporting)
   */
  resetMetrics(): void {
    this.initializeMetrics();
  }

  /**
   * Get hit rate for performance monitoring
   */
  getHitRate(type?: CacheType): number {
    if (type) {
      const metrics = this.metrics.get(type);
      if (!metrics) return 0;
      
      const total = metrics.hits + metrics.misses;
      return total > 0 ? (metrics.hits / total) * 100 : 0;
    }
    
    // Calculate overall hit rate
    let totalHits = 0;
    let totalRequests = 0;
    
    this.metrics.forEach(metrics => {
      totalHits += metrics.hits;
      totalRequests += metrics.hits + metrics.misses;
    });
    
    return totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;
  }
}

// Cache decorators for automatic caching
export function Cacheable(
  type: CacheType,
  options: CacheOptions = {}
) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const cacheManager = MultiTenantCacheManager.getInstance(this.redis || global.redis);
      const keyData = { method: propertyName, args };
      const cacheKey = createHash('md5').update(JSON.stringify(keyData)).digest('hex');
      
      return cacheManager.getOrSet(
        type,
        cacheKey,
        () => method.apply(this, args),
        options
      );
    };
    
    return descriptor;
  };
}

export default MultiTenantCacheManager;
export { CacheType, CacheOptions, CACHE_CONFIGS };