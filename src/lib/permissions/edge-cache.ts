/**
 * Edge-Compatible Permission Cache
 * Memory-based caching for permission decisions in Edge Runtime
 * This replaces Redis-based caching when running in Edge Runtime context
 */

import { PermissionDecision } from './types';

export class EdgePermissionCache {
  private static instance: EdgePermissionCache;
  private memoryCache: Map<string, { decision: PermissionDecision; expiresAt: number }>;
  private readonly defaultTTL = 300; // 5 minutes in seconds
  private readonly maxCacheSize = 10000;
  private cleanupInterval: any;

  constructor() {
    this.memoryCache = new Map();
    // Clean up expired entries every minute
    if (typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanupExpired(), 60000);
    }
  }

  static getInstance(): EdgePermissionCache {
    if (!EdgePermissionCache.instance) {
      EdgePermissionCache.instance = new EdgePermissionCache();
    }
    return EdgePermissionCache.instance;
  }

  /**
   * Get cached permission decision
   */
  async get(key: string): Promise<PermissionDecision | null> {
    const cached = this.memoryCache.get(key);
    
    if (cached) {
      const now = Date.now();
      if (cached.expiresAt > now) {
        return cached.decision;
      } else {
        // Clean up expired entry
        this.memoryCache.delete(key);
      }
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
    const expiresAt = Date.now() + (ttlSeconds * 1000);
    
    this.memoryCache.set(key, { decision, expiresAt });

    // Implement LRU eviction if cache is too large
    if (this.memoryCache.size > this.maxCacheSize) {
      this.evictOldest();
    }
  }

  /**
   * Delete cached entry
   */
  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpired(): void {
    const now = Date.now();
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
   * Evict oldest entries (simple LRU)
   */
  private evictOldest(): void {
    const entriesToRemove = Math.floor(this.maxCacheSize * 0.1); // Remove 10% of entries
    const iterator = this.memoryCache.keys();
    
    for (let i = 0; i < entriesToRemove; i++) {
      const { value, done } = iterator.next();
      if (!done) {
        this.memoryCache.delete(value);
      } else {
        break;
      }
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
      redisConnected: false // Always false in Edge Runtime
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.memoryCache.clear();
  }
}