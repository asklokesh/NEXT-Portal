/**
 * Permission Cache
 * High-performance caching for permission decisions
 */

import Redis from 'ioredis';
import { PermissionDecision } from './types';

export class PermissionCache {
  private redis: Redis | null;
  private memoryCache: Map<string, { decision: PermissionDecision; expiresAt: Date }>;
  private readonly defaultTTL = 300; // 5 minutes

  constructor() {
    this.memoryCache = new Map();
    this.initRedis();
  }

  private initRedis(): void {
    try {
      if (process.env.REDIS_URL) {
        this.redis = new Redis(process.env.REDIS_URL);
        this.redis.on('error', (err) => {
          console.error('Redis error:', err);
          this.redis = null; // Fall back to memory cache
        });
      }
    } catch (error) {
      console.warn('Redis initialization failed, using memory cache:', error);
      this.redis = null;
    }
  }

  /**
   * Get cached permission decision
   */
  async get(key: string): Promise<PermissionDecision | null> {
    // Try Redis first
    if (this.redis) {
      try {
        const cached = await this.redis.get(key);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (error) {
        console.error('Redis get error:', error);
      }
    }

    // Fall back to memory cache
    const memoryCached = this.memoryCache.get(key);
    if (memoryCached && memoryCached.expiresAt > new Date()) {
      return memoryCached.decision;
    }

    // Clean up expired entry
    if (memoryCached) {
      this.memoryCache.delete(key);
    }

    return null;
  }

  /**
   * Set cached permission decision
   */
  async set(
    key: string,
    decision: PermissionDecision,
    ttl?: number
  ): Promise<void> {
    const ttlSeconds = ttl || this.defaultTTL;
    
    // Store in Redis
    if (this.redis) {
      try {
        await this.redis.setex(key, ttlSeconds, JSON.stringify(decision));
      } catch (error) {
        console.error('Redis set error:', error);
      }
    }

    // Also store in memory cache
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    this.memoryCache.set(key, { decision, expiresAt });

    // Clean up old entries periodically
    if (this.memoryCache.size > 10000) {
      this.cleanupMemoryCache();
    }
  }

  /**
   * Delete cached entry
   */
  async delete(key: string): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.del(key);
      } catch (error) {
        console.error('Redis delete error:', error);
      }
    }
    this.memoryCache.delete(key);
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    if (this.redis) {
      try {
        const keys = await this.redis.keys('perm:*');
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } catch (error) {
        console.error('Redis clear error:', error);
      }
    }
    this.memoryCache.clear();
  }

  /**
   * Clean up expired entries from memory cache
   */
  private cleanupMemoryCache(): void {
    const now = new Date();
    const keysToDelete: string[] = [];

    for (const [key, value] of this.memoryCache.entries()) {
      if (value.expiresAt <= now) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.memoryCache.delete(key);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    memoryCacheSize: number;
    redisConnected: boolean;
  } {
    return {
      memoryCacheSize: this.memoryCache.size,
      redisConnected: this.redis?.status === 'ready'
    };
  }
}