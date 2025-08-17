/**
 * Edge Runtime Compatible Permission Cache
 * This version is used in Edge Runtime contexts (middleware)
 * Falls back to memory-only caching without Redis
 */

import { PermissionDecision } from './types';

export class PermissionCache {
  private memoryCache: Map<string, { decision: PermissionDecision; expiresAt: Date }>;
  private readonly defaultTTL = 300; // 5 minutes

  constructor() {
    this.memoryCache = new Map();
  }

  /**
   * Get cached permission decision
   */
  async get(key: string): Promise<PermissionDecision | null> {
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
    this.memoryCache.delete(key);
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
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
      redisConnected: false // No Redis in Edge Runtime
    };
  }
}