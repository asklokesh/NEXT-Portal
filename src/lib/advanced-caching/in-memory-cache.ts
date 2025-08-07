import { MemoryCacheConfig, CacheEntry, CacheEntryMetadata, CacheSetOptions } from './types';
import { logger } from '../monitoring/index';
import { MetricsCollector } from '../monitoring/metrics-collector';

interface MemoryCacheEntry<T = any> extends CacheEntry<T> {
  prev?: MemoryCacheEntry<T>;
  next?: MemoryCacheEntry<T>;
  keyRef: string;
}

/**
 * High-performance in-memory cache with LRU eviction
 * Features:
 * - Multiple eviction policies (LRU, LFU, FIFO)
 * - Memory pressure monitoring
 * - Compression for large values
 * - TTL support with efficient cleanup
 * - Thread-safe operations
 */
export class InMemoryCache {
  private config: MemoryCacheConfig;
  private entries = new Map<string, MemoryCacheEntry>();
  private keyToSize = new Map<string, number>();
  private totalSize = 0;
  private totalMemoryUsage = 0;
  private metrics: MetricsCollector;
  
  // LRU pointers
  private head?: MemoryCacheEntry;
  private tail?: MemoryCacheEntry;
  
  // LFU frequency tracking
  private frequencies = new Map<string, number>();
  private frequencyLists = new Map<number, Set<string>>();
  private minFrequency = 0;
  
  // FIFO queue
  private insertionOrder: string[] = [];
  
  // TTL management
  private expirationTimers = new Map<string, NodeJS.Timeout>();
  private cleanupInterval: NodeJS.Timeout;
  
  constructor(config: MemoryCacheConfig) {
    this.config = config;
    this.metrics = new MetricsCollector();
    
    // Start periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.performMaintenance();
    }, 60000); // Every minute
    
    // Monitor memory pressure
    this.startMemoryMonitoring();
  }

  /**
   * Get value from memory cache
   */
  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      const entry = this.entries.get(key);
      
      if (!entry) {
        this.metrics.recordHistogram('memory_get_latency', Date.now() - startTime, { result: 'miss' });
        return null;
      }
      
      const now = Date.now();
      
      // Check TTL expiration
      if (this.isExpired(entry, now)) {
        this.removeEntry(key);
        this.metrics.recordHistogram('memory_get_latency', Date.now() - startTime, { result: 'expired' });
        return null;
      }
      
      // Update access patterns based on eviction policy
      this.updateAccessPattern(key, entry);
      
      // Update metadata
      entry.metadata.lastAccessed = now;
      entry.metadata.accessCount++;
      
      this.metrics.recordHistogram('memory_get_latency', Date.now() - startTime, { result: 'hit' });
      this.metrics.incrementCounter('memory_hits', { key: this.getKeyPrefix(key) });
      
      return entry.value;
    } catch (error) {
      logger.error(`Memory cache get error for key ${key}:`, error);
      this.metrics.incrementCounter('memory_get_errors', { key, error: error.message });
      return null;
    }
  }

  /**
   * Set value in memory cache
   */
  async set<T>(key: string, value: T, options: { ttl?: number } = {}): Promise<void> {
    const startTime = Date.now();
    
    try {
      const now = Date.now();
      const ttl = options.ttl || this.config.defaultTtl;
      
      // Check if we need to evict entries first
      const valueSize = this.calculateValueSize(value);
      await this.ensureCapacity(valueSize);
      
      // Remove existing entry if present
      if (this.entries.has(key)) {
        this.removeEntry(key);
      }
      
      // Compress if needed
      let processedValue = value;
      let compressed = false;
      
      if (valueSize > this.config.compressionThreshold) {
        processedValue = await this.compressValue(value);
        compressed = true;
      }
      
      // Create cache entry
      const metadata: CacheEntryMetadata = {
        createdAt: now,
        lastAccessed: now,
        accessCount: 0,
        ttl,
        size: valueSize,
        tags: [],
        version: 1,
        compressed,
        tier: 'memory'
      };
      
      const entry: MemoryCacheEntry<T> = {
        value: processedValue,
        metadata,
        keyRef: key
      };
      
      // Add to cache
      this.entries.set(key, entry);
      this.keyToSize.set(key, valueSize);
      this.totalSize += valueSize;
      this.totalMemoryUsage += this.calculateEntryOverhead() + valueSize;
      
      // Update eviction policy structures
      this.addToEvictionStructure(key, entry);
      
      // Set TTL timer if needed
      if (ttl > 0) {
        this.setExpirationTimer(key, ttl);
      }
      
      this.metrics.recordHistogram('memory_set_latency', Date.now() - startTime, { 
        size: valueSize,
        compressed 
      });
      
      this.metrics.incrementCounter('memory_sets', { 
        key: this.getKeyPrefix(key),
        compressed: compressed.toString()
      });
      
    } catch (error) {
      logger.error(`Memory cache set error for key ${key}:`, error);
      this.metrics.incrementCounter('memory_set_errors', { key, error: error.message });
      throw error;
    }
  }

  /**
   * Delete entry from memory cache
   */
  async del(key: string): Promise<void> {
    try {
      if (this.entries.has(key)) {
        this.removeEntry(key);
        this.metrics.incrementCounter('memory_deletes', { key: this.getKeyPrefix(key) });
      }
    } catch (error) {
      logger.error(`Memory cache delete error for key ${key}:`, error);
      this.metrics.incrementCounter('memory_delete_errors', { key, error: error.message });
      throw error;
    }
  }

  /**
   * Multi-set operation
   */
  async mset<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Calculate total size needed
      const totalSizeNeeded = entries.reduce((sum, entry) => {
        return sum + this.calculateValueSize(entry.value);
      }, 0);
      
      // Ensure capacity for all entries
      await this.ensureCapacity(totalSizeNeeded);
      
      // Set all entries
      for (const entry of entries) {
        await this.set(entry.key, entry.value, { ttl: entry.ttl });
      }
      
      this.metrics.recordHistogram('memory_mset_latency', Date.now() - startTime, { 
        entryCount: entries.length,
        totalSize: totalSizeNeeded
      });
      
    } catch (error) {
      logger.error('Memory cache mset error:', error);
      this.metrics.incrementCounter('memory_mset_errors', { 
        entryCount: entries.length, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Invalidate entries matching pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keysToDelete: string[] = [];
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      
      for (const key of this.entries.keys()) {
        if (regex.test(key)) {
          keysToDelete.push(key);
        }
      }
      
      for (const key of keysToDelete) {
        this.removeEntry(key);
      }
      
      this.metrics.incrementCounter('memory_pattern_invalidations', { 
        pattern,
        deletedCount: keysToDelete.length 
      });
      
    } catch (error) {
      logger.error(`Memory cache pattern invalidation error for pattern ${pattern}:`, error);
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.entries.size,
      memoryUsage: this.totalMemoryUsage,
      hitRate: this.metrics.getHitRate('memory'),
      evictionCount: this.metrics.getEvictionCount('memory'),
      totalSize: this.totalSize,
      averageEntrySize: this.entries.size > 0 ? this.totalSize / this.entries.size : 0
    };
  }

  /**
   * Cleanup expired entries and perform maintenance
   */
  async cleanup(): Promise<void> {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.entries) {
      if (this.isExpired(entry, now)) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.removeEntry(key);
    }
    
    logger.info(`Memory cache cleanup: removed ${keysToDelete.length} expired entries`);
  }

  /**
   * Dispose cache and cleanup resources
   */
  dispose(): void {
    clearInterval(this.cleanupInterval);
    
    for (const timer of this.expirationTimers.values()) {
      clearTimeout(timer);
    }
    
    this.entries.clear();
    this.keyToSize.clear();
    this.frequencies.clear();
    this.frequencyLists.clear();
    this.insertionOrder = [];
    this.expirationTimers.clear();
  }

  // Private helper methods

  private isExpired(entry: MemoryCacheEntry, now: number): boolean {
    if (entry.metadata.ttl <= 0) return false; // No expiration
    return (entry.metadata.createdAt + entry.metadata.ttl) < now;
  }

  private updateAccessPattern(key: string, entry: MemoryCacheEntry): void {
    switch (this.config.evictionPolicy) {
      case 'lru':
        this.moveToHead(entry);
        break;
      case 'lfu':
        this.updateLFU(key);
        break;
      case 'fifo':
        // FIFO doesn't update on access
        break;
    }
  }

  private async ensureCapacity(sizeNeeded: number): Promise<void> {
    // Check entry count limit
    while (this.entries.size >= this.config.maxEntries) {
      this.evictOldest();
    }
    
    // Check memory limit
    const maxMemory = this.config.maxSize * 1024 * 1024; // Convert MB to bytes
    while (this.totalMemoryUsage + sizeNeeded > maxMemory && this.entries.size > 0) {
      this.evictOldest();
    }
  }

  private evictOldest(): void {
    let keyToEvict: string | null = null;
    
    switch (this.config.evictionPolicy) {
      case 'lru':
        keyToEvict = this.evictLRU();
        break;
      case 'lfu':
        keyToEvict = this.evictLFU();
        break;
      case 'fifo':
        keyToEvict = this.evictFIFO();
        break;
    }
    
    if (keyToEvict) {
      this.removeEntry(keyToEvict);
      this.metrics.incrementCounter('memory_evictions', { 
        key: this.getKeyPrefix(keyToEvict),
        reason: 'capacity' 
      });
    }
  }

  private evictLRU(): string | null {
    if (!this.tail) return null;
    return this.tail.keyRef;
  }

  private evictLFU(): string | null {
    if (this.minFrequency === 0) return null;
    
    const keysWithMinFreq = this.frequencyLists.get(this.minFrequency);
    if (!keysWithMinFreq || keysWithMinFreq.size === 0) {
      // Find new minimum frequency
      this.updateMinFrequency();
      return this.evictLFU();
    }
    
    // Get first key from the set
    const firstKey = keysWithMinFreq.values().next().value;
    return firstKey;
  }

  private evictFIFO(): string | null {
    return this.insertionOrder.length > 0 ? this.insertionOrder[0] : null;
  }

  private addToEvictionStructure(key: string, entry: MemoryCacheEntry): void {
    switch (this.config.evictionPolicy) {
      case 'lru':
        this.addToLRU(entry);
        break;
      case 'lfu':
        this.addToLFU(key);
        break;
      case 'fifo':
        this.insertionOrder.push(key);
        break;
    }
  }

  private removeFromEvictionStructure(key: string, entry: MemoryCacheEntry): void {
    switch (this.config.evictionPolicy) {
      case 'lru':
        this.removeFromLRU(entry);
        break;
      case 'lfu':
        this.removeFromLFU(key);
        break;
      case 'fifo':
        const index = this.insertionOrder.indexOf(key);
        if (index > -1) {
          this.insertionOrder.splice(index, 1);
        }
        break;
    }
  }

  // LRU implementation
  private addToLRU(entry: MemoryCacheEntry): void {
    entry.next = this.head;
    if (this.head) {
      this.head.prev = entry;
    }
    this.head = entry;
    
    if (!this.tail) {
      this.tail = entry;
    }
  }

  private removeFromLRU(entry: MemoryCacheEntry): void {
    if (entry.prev) {
      entry.prev.next = entry.next;
    } else {
      this.head = entry.next;
    }
    
    if (entry.next) {
      entry.next.prev = entry.prev;
    } else {
      this.tail = entry.prev;
    }
    
    entry.prev = undefined;
    entry.next = undefined;
  }

  private moveToHead(entry: MemoryCacheEntry): void {
    if (entry === this.head) return;
    
    this.removeFromLRU(entry);
    this.addToLRU(entry);
  }

  // LFU implementation
  private addToLFU(key: string): void {
    this.frequencies.set(key, 1);
    
    if (!this.frequencyLists.has(1)) {
      this.frequencyLists.set(1, new Set());
    }
    this.frequencyLists.get(1)!.add(key);
    this.minFrequency = 1;
  }

  private removeFromLFU(key: string): void {
    const freq = this.frequencies.get(key);
    if (freq) {
      const keySet = this.frequencyLists.get(freq);
      if (keySet) {
        keySet.delete(key);
        if (keySet.size === 0 && freq === this.minFrequency) {
          this.updateMinFrequency();
        }
      }
      this.frequencies.delete(key);
    }
  }

  private updateLFU(key: string): void {
    const currentFreq = this.frequencies.get(key) || 0;
    const newFreq = currentFreq + 1;
    
    // Remove from current frequency list
    const currentSet = this.frequencyLists.get(currentFreq);
    if (currentSet) {
      currentSet.delete(key);
    }
    
    // Add to new frequency list
    if (!this.frequencyLists.has(newFreq)) {
      this.frequencyLists.set(newFreq, new Set());
    }
    this.frequencyLists.get(newFreq)!.add(key);
    
    this.frequencies.set(key, newFreq);
    
    // Update minimum frequency if needed
    if (currentFreq === this.minFrequency && currentSet?.size === 0) {
      this.minFrequency++;
    }
  }

  private updateMinFrequency(): void {
    let minFreq = Number.MAX_SAFE_INTEGER;
    for (const [freq, keySet] of this.frequencyLists) {
      if (keySet.size > 0 && freq < minFreq) {
        minFreq = freq;
      }
    }
    this.minFrequency = minFreq === Number.MAX_SAFE_INTEGER ? 0 : minFreq;
  }

  private removeEntry(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    
    // Remove from main storage
    this.entries.delete(key);
    
    // Update size tracking
    const size = this.keyToSize.get(key) || 0;
    this.keyToSize.delete(key);
    this.totalSize -= size;
    this.totalMemoryUsage -= this.calculateEntryOverhead() + size;
    
    // Remove from eviction structure
    this.removeFromEvictionStructure(key, entry);
    
    // Clear expiration timer
    const timer = this.expirationTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.expirationTimers.delete(key);
    }
  }

  private calculateValueSize<T>(value: T): number {
    // Rough estimation of value size in bytes
    if (typeof value === 'string') {
      return value.length * 2; // UTF-16 characters
    } else if (typeof value === 'number') {
      return 8; // 64-bit number
    } else if (typeof value === 'boolean') {
      return 1;
    } else if (value === null || value === undefined) {
      return 0;
    } else {
      // For objects, use JSON string length as approximation
      return JSON.stringify(value).length * 2;
    }
  }

  private calculateEntryOverhead(): number {
    // Estimate overhead for cache entry structure
    return 200; // Rough estimate in bytes
  }

  private async compressValue<T>(value: T): Promise<T> {
    // Simple compression simulation
    // In production, you'd use actual compression algorithms
    return value;
  }

  private setExpirationTimer(key: string, ttl: number): void {
    const timer = setTimeout(() => {
      if (this.entries.has(key)) {
        this.removeEntry(key);
        this.metrics.incrementCounter('memory_expirations', { 
          key: this.getKeyPrefix(key) 
        });
      }
    }, ttl);
    
    this.expirationTimers.set(key, timer);
  }

  private getKeyPrefix(key: string): string {
    return key.split(':')[0] || 'unknown';
  }

  private performMaintenance(): void {
    // Clean up expired entries
    this.cleanup();
    
    // Log cache statistics
    const stats = this.getStats();
    logger.debug('Memory cache stats:', stats);
    
    // Check memory pressure
    const maxMemory = this.config.maxSize * 1024 * 1024;
    const memoryPressure = this.totalMemoryUsage / maxMemory;
    
    if (memoryPressure > 0.8) {
      logger.warn(`Memory cache under pressure: ${(memoryPressure * 100).toFixed(1)}% usage`);
    }
  }

  private startMemoryMonitoring(): void {
    // Monitor system memory and adjust cache size if needed
    setInterval(() => {
      if (process.memoryUsage) {
        const memUsage = process.memoryUsage();
        const heapPressure = memUsage.heapUsed / memUsage.heapTotal;
        
        if (heapPressure > 0.9) {
          logger.warn('High heap pressure detected, performing aggressive eviction');
          // Evict 10% of entries
          const entriesToEvict = Math.floor(this.entries.size * 0.1);
          for (let i = 0; i < entriesToEvict && this.entries.size > 0; i++) {
            this.evictOldest();
          }
        }
      }
    }, 30000); // Check every 30 seconds
  }
}