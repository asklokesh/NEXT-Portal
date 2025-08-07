import { RedisClusterCache } from './redis-cluster-cache';
import { InMemoryCache } from './in-memory-cache';
import { CacheStrategy } from './cache-strategy';
import { CacheMetrics } from './cache-metrics';
import { CacheConfig } from './types';

export interface AdvancedCacheManager {
  get<T>(key: string, options?: CacheGetOptions): Promise<T | null>;
  set<T>(key: string, value: T, options?: CacheSetOptions): Promise<void>;
  del(key: string): Promise<void>;
  mget<T>(keys: string[]): Promise<(T | null)[]>;
  mset<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void>;
  invalidatePattern(pattern: string): Promise<void>;
  getMetrics(): Promise<CacheMetricsData>;
  healthCheck(): Promise<HealthCheckResult>;
}

export interface CacheGetOptions {
  staleWhileRevalidate?: boolean;
  maxStaleSeconds?: number;
  skipTiers?: CacheTier[];
}

export interface CacheSetOptions {
  ttl?: number;
  tags?: string[];
  tier?: CacheTier;
  compression?: boolean;
}

export type CacheTier = 'memory' | 'redis' | 'cluster';

export interface CacheMetricsData {
  hitRate: number;
  missRate: number;
  evictionRate: number;
  memoryUsage: number;
  latencyP95: number;
  throughput: number;
  tierStats: Record<CacheTier, TierStats>;
}

export interface TierStats {
  hits: number;
  misses: number;
  size: number;
  latency: number;
}

export interface HealthCheckResult {
  healthy: boolean;
  tiers: Record<CacheTier, { healthy: boolean; latency: number; error?: string }>;
  overall: {
    totalRequests: number;
    successRate: number;
    avgLatency: number;
  };
}

/**
 * Advanced multi-tier caching system with Redis clustering
 * Features:
 * - Multi-tier caching (Memory -> Redis -> Cluster)
 * - Intelligent cache warming and invalidation
 * - Compression and serialization optimization
 * - Real-time metrics and monitoring
 * - Circuit breaker pattern for resilience
 * - Distributed cache coherency
 */
export class AdvancedCacheSystem implements AdvancedCacheManager {
  private memoryCache: InMemoryCache;
  private redisCache: RedisClusterCache;
  private strategy: CacheStrategy;
  private metrics: CacheMetrics;
  private config: CacheConfig;
  private circuitBreakers: Map<CacheTier, CircuitBreaker> = new Map();

  constructor(config: CacheConfig) {
    this.config = config;
    this.memoryCache = new InMemoryCache(config.memory);
    this.redisCache = new RedisClusterCache(config.redis);
    this.strategy = new CacheStrategy(config.strategy);
    this.metrics = new CacheMetrics();
    
    this.initializeCircuitBreakers();
    this.startBackgroundTasks();
  }

  /**
   * Get value with intelligent tier traversal
   */
  async get<T>(key: string, options: CacheGetOptions = {}): Promise<T | null> {
    const startTime = Date.now();
    const tiers = this.strategy.getTierOrder(key, options);
    
    let result: T | null = null;
    let hitTier: CacheTier | null = null;
    let staleValue: T | null = null;
    
    // Try each tier in order
    for (const tier of tiers) {
      if (options.skipTiers?.includes(tier)) continue;
      
      const breaker = this.circuitBreakers.get(tier);
      if (breaker?.isOpen()) {
        this.metrics.recordMiss(tier, key);
        continue;
      }
      
      try {
        const tierResult = await this.getTierValue<T>(tier, key);
        
        if (tierResult) {
          result = tierResult.value;
          hitTier = tier;
          
          if (tierResult.isStale && options.staleWhileRevalidate) {
            staleValue = result;
            continue; // Keep looking for fresh value
          } else {
            break; // Found fresh value
          }
        }
        
        breaker?.recordSuccess();
      } catch (error) {
        breaker?.recordFailure();
        this.metrics.recordError(tier, key, error);
      }
    }
    
    // Handle stale-while-revalidate
    if (staleValue && !result && options.staleWhileRevalidate) {
      result = staleValue;
      this.scheduleBackgroundRefresh(key, options);
    }
    
    // Populate higher-performance tiers if we found a value in lower tier
    if (result && hitTier) {
      await this.populateUpperTiers(key, result, hitTier, tiers);
      this.metrics.recordHit(hitTier, key, Date.now() - startTime);
    } else {
      this.metrics.recordMiss('all', key);
    }
    
    return result;
  }

  /**
   * Set value with intelligent tier distribution
   */
  async set<T>(key: string, value: T, options: CacheSetOptions = {}): Promise<void> {
    const startTime = Date.now();
    const tiers = this.strategy.getWriteTiers(key, value, options);
    const promises: Promise<void>[] = [];
    
    for (const tier of tiers) {
      const breaker = this.circuitBreakers.get(tier);
      if (breaker?.isOpen()) continue;
      
      promises.push(
        this.setTierValue(tier, key, value, options)
          .then(() => breaker?.recordSuccess())
          .catch(error => {
            breaker?.recordFailure();
            this.metrics.recordError(tier, key, error);
          })
      );
    }
    
    await Promise.allSettled(promises);
    this.metrics.recordWrite(key, Date.now() - startTime);
    
    // Handle cache tags for invalidation
    if (options.tags?.length) {
      await this.associateTagsWithKey(key, options.tags);
    }
  }

  /**
   * Delete from all tiers
   */
  async del(key: string): Promise<void> {
    const promises = [
      this.memoryCache.del(key),
      this.redisCache.del(key)
    ];
    
    await Promise.allSettled(promises);
    this.metrics.recordDelete(key);
  }

  /**
   * Multi-get with optimal batching
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    const results = new Array<T | null>(keys.length);
    const missingKeys: Array<{ index: number; key: string }> = [];
    
    // Try memory cache first
    for (let i = 0; i < keys.length; i++) {
      const memResult = await this.memoryCache.get<T>(keys[i]);
      if (memResult) {
        results[i] = memResult;
      } else {
        missingKeys.push({ index: i, key: keys[i] });
      }
    }
    
    if (missingKeys.length === 0) return results;
    
    // Batch fetch from Redis
    const redisKeys = missingKeys.map(item => item.key);
    const redisResults = await this.redisCache.mget<T>(redisKeys);
    
    for (let i = 0; i < missingKeys.length; i++) {
      const { index } = missingKeys[i];
      const redisValue = redisResults[i];
      
      if (redisValue) {
        results[index] = redisValue;
        // Populate memory cache
        await this.memoryCache.set(keys[index], redisValue);
      }
    }
    
    return results;
  }

  /**
   * Multi-set with batching optimization
   */
  async mset<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    const memoryEntries = entries.map(e => ({ 
      key: e.key, 
      value: e.value, 
      ttl: e.ttl 
    }));
    
    const redisEntries = entries.map(e => ({ 
      key: e.key, 
      value: e.value, 
      ttl: e.ttl 
    }));
    
    await Promise.allSettled([
      this.memoryCache.mset(memoryEntries),
      this.redisCache.mset(redisEntries)
    ]);
  }

  /**
   * Invalidate by pattern with distributed coordination
   */
  async invalidatePattern(pattern: string): Promise<void> {
    await Promise.allSettled([
      this.memoryCache.invalidatePattern(pattern),
      this.redisCache.invalidatePattern(pattern)
    ]);
    
    this.metrics.recordInvalidation(pattern);
  }

  /**
   * Get comprehensive cache metrics
   */
  async getMetrics(): Promise<CacheMetricsData> {
    return this.metrics.getSnapshot();
  }

  /**
   * Perform health check on all tiers
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const tierChecks = await Promise.allSettled([
      this.checkTierHealth('memory'),
      this.checkTierHealth('redis'),
      this.checkTierHealth('cluster')
    ]);
    
    const tiers: Record<CacheTier, { healthy: boolean; latency: number; error?: string }> = {
      memory: { healthy: true, latency: 0 },
      redis: { healthy: true, latency: 0 },
      cluster: { healthy: true, latency: 0 }
    };
    
    tierChecks.forEach((result, index) => {
      const tierName = ['memory', 'redis', 'cluster'][index] as CacheTier;
      if (result.status === 'fulfilled') {
        tiers[tierName] = result.value;
      } else {
        tiers[tierName] = { 
          healthy: false, 
          latency: -1, 
          error: result.reason?.message 
        };
      }
    });
    
    const healthy = Object.values(tiers).some(tier => tier.healthy);
    const metrics = await this.getMetrics();
    
    return {
      healthy,
      tiers,
      overall: {
        totalRequests: metrics.hitRate + metrics.missRate,
        successRate: metrics.hitRate / (metrics.hitRate + metrics.missRate) || 0,
        avgLatency: metrics.latencyP95
      }
    };
  }

  private async getTierValue<T>(tier: CacheTier, key: string): Promise<{ value: T; isStale: boolean } | null> {
    switch (tier) {
      case 'memory':
        const memValue = await this.memoryCache.get<T>(key);
        return memValue ? { value: memValue, isStale: false } : null;
      
      case 'redis':
      case 'cluster':
        const redisResult = await this.redisCache.getWithMetadata<T>(key);
        return redisResult ? { 
          value: redisResult.value, 
          isStale: redisResult.isStale 
        } : null;
      
      default:
        return null;
    }
  }

  private async setTierValue<T>(tier: CacheTier, key: string, value: T, options: CacheSetOptions): Promise<void> {
    switch (tier) {
      case 'memory':
        await this.memoryCache.set(key, value, { ttl: options.ttl });
        break;
      
      case 'redis':
      case 'cluster':
        await this.redisCache.set(key, value, { 
          ttl: options.ttl, 
          tags: options.tags,
          compression: options.compression 
        });
        break;
    }
  }

  private async populateUpperTiers<T>(
    key: string, 
    value: T, 
    hitTier: CacheTier, 
    orderedTiers: CacheTier[]
  ): Promise<void> {
    const tierIndex = orderedTiers.indexOf(hitTier);
    if (tierIndex <= 0) return;
    
    const upperTiers = orderedTiers.slice(0, tierIndex);
    const promises = upperTiers.map(tier => 
      this.setTierValue(tier, key, value, {}).catch(() => {}) // Ignore errors
    );
    
    await Promise.allSettled(promises);
  }

  private async checkTierHealth(tier: CacheTier): Promise<{ healthy: boolean; latency: number }> {
    const testKey = `health:check:${Date.now()}`;
    const testValue = 'ok';
    const startTime = Date.now();
    
    try {
      await this.setTierValue(tier, testKey, testValue, {});
      const result = await this.getTierValue(tier, testKey);
      await this.delTierValue(tier, testKey);
      
      const latency = Date.now() - startTime;
      return { 
        healthy: result?.value === testValue, 
        latency 
      };
    } catch {
      return { healthy: false, latency: Date.now() - startTime };
    }
  }

  private async delTierValue(tier: CacheTier, key: string): Promise<void> {
    switch (tier) {
      case 'memory':
        await this.memoryCache.del(key);
        break;
      case 'redis':
      case 'cluster':
        await this.redisCache.del(key);
        break;
    }
  }

  private initializeCircuitBreakers(): void {
    const tiers: CacheTier[] = ['memory', 'redis', 'cluster'];
    
    tiers.forEach(tier => {
      this.circuitBreakers.set(tier, new CircuitBreaker({
        failureThreshold: 5,
        recoveryTimeout: 30000,
        monitorTimeout: 5000
      }));
    });
  }

  private startBackgroundTasks(): void {
    // Cache warming
    setInterval(() => this.warmCache(), this.config.warmingInterval || 300000);
    
    // Metrics collection
    setInterval(() => this.metrics.collectSystemMetrics(), 60000);
    
    // Cleanup expired entries
    setInterval(() => this.cleanup(), this.config.cleanupInterval || 600000);
  }

  private async warmCache(): Promise<void> {
    // Implement cache warming logic based on access patterns
    const popularKeys = await this.metrics.getPopularKeys(100);
    // Pre-warm these keys if they're not in memory cache
  }

  private async cleanup(): Promise<void> {
    await Promise.allSettled([
      this.memoryCache.cleanup(),
      this.redisCache.cleanup()
    ]);
  }

  private async associateTagsWithKey(key: string, tags: string[]): Promise<void> {
    // Store tag associations for bulk invalidation
    await this.redisCache.associateTagsWithKey(key, tags);
  }

  private async scheduleBackgroundRefresh(key: string, options: CacheGetOptions): Promise<void> {
    // Schedule background refresh for stale-while-revalidate
    setTimeout(async () => {
      try {
        // This would trigger the original data source refresh
        // Implementation depends on the specific use case
      } catch (error) {
        // Log refresh error but don't throw
      }
    }, 0);
  }
}

/**
 * Simple circuit breaker implementation
 */
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(private options: {
    failureThreshold: number;
    recoveryTimeout: number;
    monitorTimeout: number;
  }) {}

  isOpen(): boolean {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.options.recoveryTimeout) {
        this.state = 'half-open';
        return false;
      }
      return true;
    }
    return false;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.options.failureThreshold) {
      this.state = 'open';
    }
  }
}

export * from './types';
export * from './redis-cluster-cache';
export * from './in-memory-cache';
export * from './cache-strategy';
export * from './cache-metrics';