/**
 * Enterprise Cache Service
 * Provides caching capabilities with Redis or in-memory fallback
 */

import { Redis } from 'ioredis';
import LRU from 'lru-cache';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  namespace?: string;
}

export class CacheService {
  private redis: Redis | null = null;
  private memoryCache: LRU<string, any>;
  private readonly DEFAULT_TTL = 300; // 5 minutes
  private readonly namespace: string;

  constructor(namespace: string = 'app') {
    this.namespace = namespace;
    this.initializeCache();
    
    // Initialize in-memory cache as fallback
    this.memoryCache = new LRU({
      max: 1000,
      ttl: this.DEFAULT_TTL * 1000 // Convert to milliseconds
    });
  }

  /**
   * Initialize cache connection
   */
  private initializeCache(): void {
    try {
      if (process.env.REDIS_URL) {
        this.redis = new Redis(process.env.REDIS_URL, {
          maxRetriesPerRequest: 3,
          retryStrategy: (times) => {
            if (times > 3) {
              console.error('Redis connection failed, falling back to memory cache');
              return null;
            }
            return Math.min(times * 100, 3000);
          }
        });

        this.redis.on('error', (error) => {
          console.error('Redis error:', error);
        });

        this.redis.on('connect', () => {
          console.log('Redis connected successfully');
        });
      }
    } catch (error) {
      console.error('Failed to initialize Redis:', error);
    }
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    const fullKey = this.buildKey(key);

    try {
      if (this.redis) {
        const value = await this.redis.get(fullKey);
        if (value) {
          return JSON.parse(value);
        }
      }
    } catch (error) {
      console.error('Redis get error:', error);
    }

    // Fallback to memory cache
    return this.memoryCache.get(fullKey) || null;
  }

  /**
   * Set value in cache
   */
  async set<T = any>(
    key: string,
    value: T,
    ttl: number = this.DEFAULT_TTL
  ): Promise<void> {
    const fullKey = this.buildKey(key);
    const serialized = JSON.stringify(value);

    try {
      if (this.redis) {
        await this.redis.setex(fullKey, ttl, serialized);
      }
    } catch (error) {
      console.error('Redis set error:', error);
    }

    // Always set in memory cache as backup
    this.memoryCache.set(fullKey, value, { ttl: ttl * 1000 });
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    const fullKey = this.buildKey(key);

    try {
      if (this.redis) {
        await this.redis.del(fullKey);
      }
    } catch (error) {
      console.error('Redis delete error:', error);
    }

    // Also delete from memory cache
    this.memoryCache.delete(fullKey);
  }

  /**
   * Delete all keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<void> {
    const fullPattern = this.buildKey(pattern);

    try {
      if (this.redis) {
        const keys = await this.redis.keys(fullPattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      }
    } catch (error) {
      console.error('Redis deletePattern error:', error);
    }

    // Clear matching keys from memory cache
    const regex = new RegExp('^' + fullPattern.replace(/\*/g, '.*') + '$');
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
      }
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const fullKey = this.buildKey(key);

    try {
      if (this.redis) {
        const exists = await this.redis.exists(fullKey);
        return exists === 1;
      }
    } catch (error) {
      console.error('Redis exists error:', error);
    }

    return this.memoryCache.has(fullKey);
  }

  /**
   * Get multiple values
   */
  async mget<T = any>(keys: string[]): Promise<(T | null)[]> {
    const fullKeys = keys.map(k => this.buildKey(k));
    const results: (T | null)[] = [];

    try {
      if (this.redis) {
        const values = await this.redis.mget(...fullKeys);
        return values.map(v => v ? JSON.parse(v) : null);
      }
    } catch (error) {
      console.error('Redis mget error:', error);
    }

    // Fallback to memory cache
    for (const fullKey of fullKeys) {
      results.push(this.memoryCache.get(fullKey) || null);
    }

    return results;
  }

  /**
   * Set multiple values
   */
  async mset(
    items: Array<{ key: string; value: any; ttl?: number }>
  ): Promise<void> {
    try {
      if (this.redis) {
        const pipeline = this.redis.pipeline();
        
        for (const item of items) {
          const fullKey = this.buildKey(item.key);
          const ttl = item.ttl || this.DEFAULT_TTL;
          pipeline.setex(fullKey, ttl, JSON.stringify(item.value));
        }
        
        await pipeline.exec();
      }
    } catch (error) {
      console.error('Redis mset error:', error);
    }

    // Always set in memory cache
    for (const item of items) {
      const fullKey = this.buildKey(item.key);
      const ttl = item.ttl || this.DEFAULT_TTL;
      this.memoryCache.set(fullKey, item.value, { ttl: ttl * 1000 });
    }
  }

  /**
   * Increment a counter
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    const fullKey = this.buildKey(key);

    try {
      if (this.redis) {
        return await this.redis.incrby(fullKey, amount);
      }
    } catch (error) {
      console.error('Redis increment error:', error);
    }

    // Fallback to memory cache
    const current = this.memoryCache.get(fullKey) || 0;
    const newValue = current + amount;
    this.memoryCache.set(fullKey, newValue);
    return newValue;
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    type: 'redis' | 'memory';
    connected: boolean;
    size: number;
    hits: number;
    misses: number;
  }> {
    if (this.redis) {
      try {
        const info = await this.redis.info('stats');
        const stats = this.parseRedisInfo(info);
        
        return {
          type: 'redis',
          connected: this.redis.status === 'ready',
          size: parseInt(stats.used_memory || '0'),
          hits: parseInt(stats.keyspace_hits || '0'),
          misses: parseInt(stats.keyspace_misses || '0')
        };
      } catch (error) {
        console.error('Failed to get Redis stats:', error);
      }
    }

    return {
      type: 'memory',
      connected: true,
      size: this.memoryCache.size,
      hits: 0, // LRU cache doesn't track this by default
      misses: 0
    };
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    try {
      if (this.redis) {
        const keys = await this.redis.keys(this.buildKey('*'));
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      }
    } catch (error) {
      console.error('Redis clear error:', error);
    }

    this.memoryCache.clear();
  }

  /**
   * Build namespaced key
   */
  private buildKey(key: string): string {
    return `${this.namespace}:${key}`;
  }

  /**
   * Parse Redis INFO command output
   */
  private parseRedisInfo(info: string): Record<string, string> {
    const result: Record<string, string> = {};
    const lines = info.split('\r\n');
    
    for (const line of lines) {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        if (key && value) {
          result[key] = value;
        }
      }
    }
    
    return result;
  }

  /**
   * Close cache connections
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
    this.memoryCache.clear();
  }
}