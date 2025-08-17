/**
 * Edge Caching Strategies for Tenant-Specific Data
 * Multi-layer caching with tenant isolation and intelligent invalidation
 */

export interface CacheLayer {
  id: string;
  name: string;
  type: 'memory' | 'redis' | 'cdn' | 'database';
  region: string;
  ttl: number; // seconds
  maxSize: number; // bytes
  currentSize: number;
  hitRate: number;
  missRate: number;
  evictionPolicy: 'lru' | 'lfu' | 'ttl' | 'random';
  status: 'active' | 'degraded' | 'offline';
  metrics: {
    hits: number;
    misses: number;
    evictions: number;
    writes: number;
    reads: number;
    errors: number;
    avgLatency: number;
    lastUpdated: Date;
  };
}

export interface CacheEntry {
  key: string;
  value: any;
  tenantId: string;
  size: number;
  ttl: number;
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  tags: string[];
  metadata: {
    source: string;
    version: string;
    compression?: 'gzip' | 'brotli';
    checksum?: string;
  };
}

export interface CachePolicy {
  id: string;
  name: string;
  pattern: string; // Key pattern
  layers: string[]; // Cache layer IDs in order
  ttl: Record<string, number>; // TTL per layer
  invalidationStrategy: 'immediate' | 'lazy' | 'scheduled';
  warmupStrategy: 'preload' | 'on_demand' | 'background';
  tenantIsolation: boolean;
  compressionEnabled: boolean;
  tags: string[];
}

export interface CacheOperation {
  id: string;
  type: 'get' | 'set' | 'delete' | 'invalidate' | 'warmup';
  key: string;
  tenantId?: string;
  layerId: string;
  status: 'pending' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  latency?: number;
  size?: number;
  hit: boolean;
  error?: string;
}

export interface InvalidationEvent {
  id: string;
  timestamp: Date;
  tenantId?: string;
  pattern?: string;
  keys: string[];
  reason: string;
  triggeredBy: 'manual' | 'auto' | 'policy' | 'event';
  layersAffected: string[];
  entriesInvalidated: number;
}

/**
 * Edge Caching Manager
 */
export class EdgeCachingManager {
  private cacheLayers: Map<string, CacheLayer> = new Map();
  private cacheEntries: Map<string, Map<string, CacheEntry>> = new Map(); // layerId -> entries
  private cachePolicies: Map<string, CachePolicy> = new Map();
  private operations: CacheOperation[] = [];
  private invalidationEvents: InvalidationEvent[] = [];
  private tenantKeyspaces: Map<string, Set<string>> = new Map(); // tenantId -> keys

  constructor() {
    this.initializeCacheLayers();
    this.initializeCachePolicies();
    this.startMaintenanceTasks();
    this.startMetricsCollection();
  }

  /**
   * Get cached value with multi-layer lookup
   */
  async get(
    key: string, 
    tenantId?: string, 
    options?: {
      preferredLayers?: string[];
      maxStaleness?: number;
      bypassCache?: boolean;
    }
  ): Promise<{
    value: any;
    hit: boolean;
    layer?: string;
    age: number;
    operation: CacheOperation;
  }> {
    const operationId = this.generateOperationId();
    const startTime = new Date();

    const operation: CacheOperation = {
      id: operationId,
      type: 'get',
      key,
      tenantId,
      layerId: '',
      status: 'pending',
      startTime,
      hit: false
    };

    try {
      if (options?.bypassCache) {
        operation.status = 'completed';
        operation.layerId = 'bypass';
        operation.hit = false;
        operation.endTime = new Date();
        operation.latency = Date.now() - startTime.getTime();
        
        this.operations.push(operation);
        return {
          value: null,
          hit: false,
          age: 0,
          operation
        };
      }

      // Determine cache layers to check
      const layersToCheck = this.determineCacheLayers(key, options?.preferredLayers);

      // Check each layer in order
      for (const layerId of layersToCheck) {
        const layer = this.cacheLayers.get(layerId);
        const layerEntries = this.cacheEntries.get(layerId);
        
        if (!layer || !layerEntries || layer.status !== 'active') {
          continue;
        }

        const cacheKey = this.buildCacheKey(key, tenantId);
        const entry = layerEntries.get(cacheKey);

        if (entry) {
          // Check TTL
          const age = Date.now() - entry.createdAt.getTime();
          const isExpired = age > entry.ttl * 1000;
          
          if (isExpired) {
            // Remove expired entry
            layerEntries.delete(cacheKey);
            this.updateTenantKeyspace(tenantId, cacheKey, 'remove');
            continue;
          }

          // Check staleness if specified
          if (options?.maxStaleness && age > options.maxStaleness) {
            continue;
          }

          // Cache hit!
          entry.lastAccessed = new Date();
          entry.accessCount++;
          
          // Update layer metrics
          layer.metrics.hits++;
          layer.metrics.reads++;
          layer.hitRate = layer.metrics.hits / (layer.metrics.hits + layer.metrics.misses);

          operation.status = 'completed';
          operation.layerId = layerId;
          operation.hit = true;
          operation.size = entry.size;
          operation.endTime = new Date();
          operation.latency = Date.now() - startTime.getTime();

          this.operations.push(operation);

          // Promote to higher layers if beneficial
          await this.promoteToHigherLayers(entry, layerId, layersToCheck);

          return {
            value: this.decompressValue(entry.value, entry.metadata.compression),
            hit: true,
            layer: layerId,
            age,
            operation
          };
        }

        // Cache miss for this layer
        layer.metrics.misses++;
        layer.metrics.reads++;
        layer.missRate = layer.metrics.misses / (layer.metrics.hits + layer.metrics.misses);
      }

      // Complete miss across all layers
      operation.status = 'completed';
      operation.layerId = 'none';
      operation.hit = false;
      operation.endTime = new Date();
      operation.latency = Date.now() - startTime.getTime();

      this.operations.push(operation);

      return {
        value: null,
        hit: false,
        age: 0,
        operation
      };

    } catch (error) {
      operation.status = 'failed';
      operation.error = error instanceof Error ? error.message : String(error);
      operation.endTime = new Date();
      operation.latency = Date.now() - startTime.getTime();

      this.operations.push(operation);
      throw error;
    }
  }

  /**
   * Set cached value across appropriate layers
   */
  async set(
    key: string,
    value: any,
    tenantId?: string,
    options?: {
      ttl?: number;
      tags?: string[];
      source?: string;
      version?: string;
      targetLayers?: string[];
      compression?: boolean;
    }
  ): Promise<{
    success: boolean;
    layersWritten: string[];
    operation: CacheOperation;
  }> {
    const operationId = this.generateOperationId();
    const startTime = new Date();

    const operation: CacheOperation = {
      id: operationId,
      type: 'set',
      key,
      tenantId,
      layerId: '',
      status: 'pending',
      startTime,
      hit: false
    };

    try {
      // Determine target layers
      const targetLayers = options?.targetLayers || this.determineCacheLayers(key);
      const layersWritten: string[] = [];

      // Compress value if enabled
      const shouldCompress = options?.compression ?? this.shouldCompress(value);
      const compressedValue = shouldCompress ? this.compressValue(value) : value;
      const compressionType = shouldCompress ? 'gzip' : undefined;

      // Create cache entry
      const cacheKey = this.buildCacheKey(key, tenantId);
      const size = this.calculateSize(compressedValue);
      
      const entry: CacheEntry = {
        key: cacheKey,
        value: compressedValue,
        tenantId: tenantId || 'global',
        size,
        ttl: options?.ttl || this.getDefaultTTL(key),
        createdAt: new Date(),
        lastAccessed: new Date(),
        accessCount: 1,
        tags: options?.tags || [],
        metadata: {
          source: options?.source || 'unknown',
          version: options?.version || '1.0',
          compression: compressionType,
          checksum: this.calculateChecksum(compressedValue)
        }
      };

      // Write to target layers
      for (const layerId of targetLayers) {
        const layer = this.cacheLayers.get(layerId);
        
        if (!layer || layer.status !== 'active') {
          continue;
        }

        // Check capacity
        if (layer.currentSize + size > layer.maxSize) {
          await this.evictEntries(layerId, size);
        }

        // Get or create layer entries map
        let layerEntries = this.cacheEntries.get(layerId);
        if (!layerEntries) {
          layerEntries = new Map();
          this.cacheEntries.set(layerId, layerEntries);
        }

        // Store entry
        layerEntries.set(cacheKey, { ...entry });
        layer.currentSize += size;
        layer.metrics.writes++;

        // Update tenant keyspace
        this.updateTenantKeyspace(tenantId, cacheKey, 'add');

        layersWritten.push(layerId);
      }

      operation.status = 'completed';
      operation.layerId = layersWritten.join(',');
      operation.size = size;
      operation.endTime = new Date();
      operation.latency = Date.now() - startTime.getTime();

      this.operations.push(operation);

      return {
        success: layersWritten.length > 0,
        layersWritten,
        operation
      };

    } catch (error) {
      operation.status = 'failed';
      operation.error = error instanceof Error ? error.message : String(error);
      operation.endTime = new Date();
      operation.latency = Date.now() - startTime.getTime();

      this.operations.push(operation);
      throw error;
    }
  }

  /**
   * Invalidate cache entries by pattern or tenant
   */
  async invalidate(options: {
    pattern?: string;
    tenantId?: string;
    keys?: string[];
    tags?: string[];
    reason?: string;
    layers?: string[];
  }): Promise<InvalidationEvent> {
    const eventId = this.generateEventId();
    const timestamp = new Date();
    let entriesInvalidated = 0;
    const keysInvalidated: string[] = [];
    const layersAffected: string[] = [];

    const targetLayers = options.layers || Array.from(this.cacheLayers.keys());

    try {
      for (const layerId of targetLayers) {
        const layerEntries = this.cacheEntries.get(layerId);
        if (!layerEntries) continue;

        const keysToDelete: string[] = [];

        // Collect keys to invalidate
        if (options.keys) {
          // Specific keys
          for (const key of options.keys) {
            const cacheKey = this.buildCacheKey(key, options.tenantId);
            if (layerEntries.has(cacheKey)) {
              keysToDelete.push(cacheKey);
            }
          }
        } else if (options.tenantId) {
          // All keys for tenant
          const tenantKeys = this.tenantKeyspaces.get(options.tenantId);
          if (tenantKeys) {
            for (const cacheKey of tenantKeys) {
              if (layerEntries.has(cacheKey)) {
                keysToDelete.push(cacheKey);
              }
            }
          }
        } else if (options.pattern) {
          // Pattern-based invalidation
          const regex = new RegExp(options.pattern);
          for (const [cacheKey, entry] of layerEntries.entries()) {
            if (regex.test(cacheKey) || regex.test(entry.key)) {
              keysToDelete.push(cacheKey);
            }
          }
        } else if (options.tags) {
          // Tag-based invalidation
          for (const [cacheKey, entry] of layerEntries.entries()) {
            if (entry.tags.some(tag => options.tags!.includes(tag))) {
              keysToDelete.push(cacheKey);
            }
          }
        }

        // Delete entries
        if (keysToDelete.length > 0) {
          const layer = this.cacheLayers.get(layerId);
          let sizeFreed = 0;

          for (const cacheKey of keysToDelete) {
            const entry = layerEntries.get(cacheKey);
            if (entry) {
              sizeFreed += entry.size;
              layerEntries.delete(cacheKey);
              keysInvalidated.push(cacheKey);
              
              // Update tenant keyspace
              this.updateTenantKeyspace(entry.tenantId, cacheKey, 'remove');
            }
          }

          if (layer) {
            layer.currentSize -= sizeFreed;
            layersAffected.push(layerId);
          }

          entriesInvalidated += keysToDelete.length;
        }
      }

      const invalidationEvent: InvalidationEvent = {
        id: eventId,
        timestamp,
        tenantId: options.tenantId,
        pattern: options.pattern,
        keys: keysInvalidated,
        reason: options.reason || 'Manual invalidation',
        triggeredBy: 'manual',
        layersAffected,
        entriesInvalidated
      };

      this.invalidationEvents.push(invalidationEvent);

      // Keep history bounded
      if (this.invalidationEvents.length > 1000) {
        this.invalidationEvents = this.invalidationEvents.slice(-500);
      }

      console.log(`Invalidated ${entriesInvalidated} cache entries across ${layersAffected.length} layers`);
      return invalidationEvent;

    } catch (error) {
      console.error('Cache invalidation failed:', error);
      throw error;
    }
  }

  /**
   * Warm up cache with preloaded data
   */
  async warmup(
    keys: Array<{
      key: string;
      value: any;
      tenantId?: string;
      ttl?: number;
      tags?: string[];
    }>,
    options?: {
      concurrency?: number;
      targetLayers?: string[];
    }
  ): Promise<{
    success: number;
    failed: number;
    operations: CacheOperation[];
  }> {
    const concurrency = options?.concurrency || 10;
    const operations: CacheOperation[] = [];
    let success = 0;
    let failed = 0;

    // Process in batches to control concurrency
    for (let i = 0; i < keys.length; i += concurrency) {
      const batch = keys.slice(i, i + concurrency);
      
      const promises = batch.map(async (item) => {
        try {
          const result = await this.set(
            item.key,
            item.value,
            item.tenantId,
            {
              ttl: item.ttl,
              tags: item.tags,
              targetLayers: options?.targetLayers,
              source: 'warmup'
            }
          );
          
          operations.push(result.operation);
          
          if (result.success) {
            success++;
          } else {
            failed++;
          }
        } catch (error) {
          failed++;
          console.error(`Warmup failed for key ${item.key}:`, error);
        }
      });

      await Promise.all(promises);
    }

    console.log(`Cache warmup completed: ${success} success, ${failed} failed`);
    
    return {
      success,
      failed,
      operations
    };
  }

  /**
   * Get cache analytics
   */
  getCacheAnalytics(timeRange?: { start: Date; end: Date }): {
    layerStats: Array<{
      layerId: string;
      hitRate: number;
      missRate: number;
      utilization: number;
      operations: number;
      avgLatency: number;
    }>;
    operationStats: {
      total: number;
      hits: number;
      misses: number;
      sets: number;
      deletes: number;
      avgLatency: number;
    };
    tenantStats: Array<{
      tenantId: string;
      keys: number;
      hitRate: number;
    }>;
    invalidationStats: {
      total: number;
      byReason: Record<string, number>;
      avgEntriesInvalidated: number;
    };
    hotKeys: Array<{
      key: string;
      accessCount: number;
      hitRate: number;
    }>;
  } {
    let operations = this.operations;
    
    if (timeRange) {
      operations = operations.filter(op =>
        op.startTime >= timeRange.start && op.startTime <= timeRange.end
      );
    }

    // Layer stats
    const layerStats = Array.from(this.cacheLayers.values()).map(layer => ({
      layerId: layer.id,
      hitRate: layer.hitRate,
      missRate: layer.missRate,
      utilization: layer.currentSize / layer.maxSize,
      operations: layer.metrics.hits + layer.metrics.misses,
      avgLatency: layer.metrics.avgLatency
    }));

    // Operation stats
    const hits = operations.filter(op => op.hit).length;
    const misses = operations.filter(op => !op.hit && op.type === 'get').length;
    const sets = operations.filter(op => op.type === 'set').length;
    const deletes = operations.filter(op => op.type === 'delete').length;
    const avgLatency = operations.length > 0 ?
      operations.reduce((sum, op) => sum + (op.latency || 0), 0) / operations.length : 0;

    // Tenant stats
    const tenantOperations = new Map<string, { total: number; hits: number }>();
    for (const op of operations) {
      if (op.tenantId) {
        const stats = tenantOperations.get(op.tenantId) || { total: 0, hits: 0 };
        stats.total++;
        if (op.hit) stats.hits++;
        tenantOperations.set(op.tenantId, stats);
      }
    }

    const tenantStats = Array.from(tenantOperations.entries()).map(([tenantId, stats]) => ({
      tenantId,
      keys: this.tenantKeyspaces.get(tenantId)?.size || 0,
      hitRate: stats.total > 0 ? stats.hits / stats.total : 0
    }));

    // Invalidation stats
    const invalidationsByReason = new Map<string, number>();
    for (const event of this.invalidationEvents) {
      const count = invalidationsByReason.get(event.reason) || 0;
      invalidationsByReason.set(event.reason, count + 1);
    }

    const avgEntriesInvalidated = this.invalidationEvents.length > 0 ?
      this.invalidationEvents.reduce((sum, e) => sum + e.entriesInvalidated, 0) / this.invalidationEvents.length : 0;

    // Hot keys (most accessed)
    const keyAccessCounts = new Map<string, { count: number; hits: number }>();
    
    // Collect access data from all layers
    for (const layerEntries of this.cacheEntries.values()) {
      for (const entry of layerEntries.values()) {
        const stats = keyAccessCounts.get(entry.key) || { count: 0, hits: 0 };
        stats.count += entry.accessCount;
        stats.hits += entry.accessCount; // All accesses are hits for existing entries
        keyAccessCounts.set(entry.key, stats);
      }
    }

    const hotKeys = Array.from(keyAccessCounts.entries())
      .map(([key, stats]) => ({
        key,
        accessCount: stats.count,
        hitRate: 1.0 // Simplified - existing entries have 100% hit rate
      }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 20);

    return {
      layerStats,
      operationStats: {
        total: operations.length,
        hits,
        misses,
        sets,
        deletes,
        avgLatency
      },
      tenantStats,
      invalidationStats: {
        total: this.invalidationEvents.length,
        byReason: Object.fromEntries(invalidationsByReason),
        avgEntriesInvalidated
      },
      hotKeys
    };
  }

  /**
   * Determine which cache layers to use for a key
   */
  private determineCacheLayers(key: string, preferredLayers?: string[]): string[] {
    if (preferredLayers) {
      return preferredLayers.filter(layerId => this.cacheLayers.has(layerId));
    }

    // Apply cache policies
    for (const policy of this.cachePolicies.values()) {
      if (this.keyMatchesPattern(key, policy.pattern)) {
        return policy.layers.filter(layerId => this.cacheLayers.has(layerId));
      }
    }

    // Default layer order: memory -> redis -> cdn
    return ['memory-l1', 'redis-l2', 'cdn-l3'].filter(layerId => this.cacheLayers.has(layerId));
  }

  /**
   * Build cache key with tenant isolation
   */
  private buildCacheKey(key: string, tenantId?: string): string {
    return tenantId ? `tenant:${tenantId}:${key}` : `global:${key}`;
  }

  /**
   * Update tenant keyspace tracking
   */
  private updateTenantKeyspace(tenantId: string | undefined, cacheKey: string, action: 'add' | 'remove'): void {
    if (!tenantId) tenantId = 'global';
    
    let keyspace = this.tenantKeyspaces.get(tenantId);
    if (!keyspace) {
      keyspace = new Set();
      this.tenantKeyspaces.set(tenantId, keyspace);
    }

    if (action === 'add') {
      keyspace.add(cacheKey);
    } else {
      keyspace.delete(cacheKey);
    }
  }

  /**
   * Promote cache entry to higher (faster) layers
   */
  private async promoteToHigherLayers(
    entry: CacheEntry,
    currentLayerId: string,
    allLayers: string[]
  ): Promise<void> {
    const currentIndex = allLayers.indexOf(currentLayerId);
    if (currentIndex <= 0) return; // Already in highest layer

    const higherLayers = allLayers.slice(0, currentIndex);
    
    for (const layerId of higherLayers) {
      const layer = this.cacheLayers.get(layerId);
      if (!layer || layer.status !== 'active') continue;

      // Check if promotion is beneficial (based on access count)
      if (entry.accessCount < 3) continue; // Only promote frequently accessed items

      // Check capacity
      if (layer.currentSize + entry.size > layer.maxSize) {
        await this.evictEntries(layerId, entry.size);
      }

      // Get or create layer entries
      let layerEntries = this.cacheEntries.get(layerId);
      if (!layerEntries) {
        layerEntries = new Map();
        this.cacheEntries.set(layerId, layerEntries);
      }

      // Copy to higher layer
      layerEntries.set(entry.key, { ...entry });
      layer.currentSize += entry.size;
    }
  }

  /**
   * Evict entries to make space
   */
  private async evictEntries(layerId: string, requiredSpace: number): Promise<number> {
    const layer = this.cacheLayers.get(layerId);
    const layerEntries = this.cacheEntries.get(layerId);
    
    if (!layer || !layerEntries) return 0;

    let spaceFreed = 0;
    const entriesToEvict: string[] = [];

    // Get entries sorted by eviction policy
    const entries = Array.from(layerEntries.entries());
    
    switch (layer.evictionPolicy) {
      case 'lru':
        entries.sort(([, a], [, b]) => a.lastAccessed.getTime() - b.lastAccessed.getTime());
        break;
      case 'lfu':
        entries.sort(([, a], [, b]) => a.accessCount - b.accessCount);
        break;
      case 'ttl':
        entries.sort(([, a], [, b]) => {
          const aAge = Date.now() - a.createdAt.getTime();
          const bAge = Date.now() - b.createdAt.getTime();
          return (a.ttl - aAge) - (b.ttl - bAge);
        });
        break;
      case 'random':
        entries.sort(() => Math.random() - 0.5);
        break;
    }

    // Evict entries until we have enough space
    for (const [cacheKey, entry] of entries) {
      if (spaceFreed >= requiredSpace) break;
      
      entriesToEvict.push(cacheKey);
      spaceFreed += entry.size;
      
      // Update tenant keyspace
      this.updateTenantKeyspace(entry.tenantId, cacheKey, 'remove');
    }

    // Remove evicted entries
    for (const cacheKey of entriesToEvict) {
      layerEntries.delete(cacheKey);
    }

    layer.currentSize -= spaceFreed;
    layer.metrics.evictions += entriesToEvict.length;

    console.log(`Evicted ${entriesToEvict.length} entries from layer ${layerId}, freed ${spaceFreed} bytes`);
    return spaceFreed;
  }

  /**
   * Check if key matches pattern
   */
  private keyMatchesPattern(key: string, pattern: string): boolean {
    // Simple pattern matching - in production, use more sophisticated matching
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return regex.test(key);
  }

  /**
   * Get default TTL for key
   */
  private getDefaultTTL(key: string): number {
    // Default TTL rules based on key patterns
    if (key.includes('user:')) return 300; // 5 minutes
    if (key.includes('plugin:')) return 3600; // 1 hour
    if (key.includes('config:')) return 1800; // 30 minutes
    if (key.includes('catalog:')) return 600; // 10 minutes
    return 900; // 15 minutes default
  }

  /**
   * Check if value should be compressed
   */
  private shouldCompress(value: any): boolean {
    const serialized = JSON.stringify(value);
    return serialized.length > 1024; // Compress if larger than 1KB
  }

  /**
   * Compress value (simplified)
   */
  private compressValue(value: any): string {
    // In production, use actual compression library
    return JSON.stringify(value);
  }

  /**
   * Decompress value (simplified)
   */
  private decompressValue(value: any, compression?: string): any {
    // In production, use actual decompression
    return typeof value === 'string' ? JSON.parse(value) : value;
  }

  /**
   * Calculate value size
   */
  private calculateSize(value: any): number {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  }

  /**
   * Calculate checksum
   */
  private calculateChecksum(value: any): string {
    // Simple checksum - in production, use crypto hash
    const str = JSON.stringify(value);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  /**
   * Initialize cache layers
   */
  private initializeCacheLayers(): void {
    const layers: CacheLayer[] = [
      {
        id: 'memory-l1',
        name: 'In-Memory L1 Cache',
        type: 'memory',
        region: 'local',
        ttl: 300,
        maxSize: 100 * 1024 * 1024, // 100MB
        currentSize: 0,
        hitRate: 0,
        missRate: 0,
        evictionPolicy: 'lru',
        status: 'active',
        metrics: {
          hits: 0,
          misses: 0,
          evictions: 0,
          writes: 0,
          reads: 0,
          errors: 0,
          avgLatency: 5,
          lastUpdated: new Date()
        }
      },
      {
        id: 'redis-l2',
        name: 'Redis L2 Cache',
        type: 'redis',
        region: 'us-east-1',
        ttl: 3600,
        maxSize: 1024 * 1024 * 1024, // 1GB
        currentSize: 0,
        hitRate: 0,
        missRate: 0,
        evictionPolicy: 'lru',
        status: 'active',
        metrics: {
          hits: 0,
          misses: 0,
          evictions: 0,
          writes: 0,
          reads: 0,
          errors: 0,
          avgLatency: 25,
          lastUpdated: new Date()
        }
      },
      {
        id: 'cdn-l3',
        name: 'CDN L3 Cache',
        type: 'cdn',
        region: 'global',
        ttl: 86400,
        maxSize: 10 * 1024 * 1024 * 1024, // 10GB
        currentSize: 0,
        hitRate: 0,
        missRate: 0,
        evictionPolicy: 'ttl',
        status: 'active',
        metrics: {
          hits: 0,
          misses: 0,
          evictions: 0,
          writes: 0,
          reads: 0,
          errors: 0,
          avgLatency: 100,
          lastUpdated: new Date()
        }
      }
    ];

    for (const layer of layers) {
      this.cacheLayers.set(layer.id, layer);
      this.cacheEntries.set(layer.id, new Map());
    }

    console.log(`Initialized ${layers.length} cache layers`);
  }

  /**
   * Initialize cache policies
   */
  private initializeCachePolicies(): void {
    const policies: CachePolicy[] = [
      {
        id: 'plugin-assets',
        name: 'Plugin Assets Policy',
        pattern: 'plugin:*:asset:*',
        layers: ['memory-l1', 'redis-l2', 'cdn-l3'],
        ttl: {
          'memory-l1': 300,
          'redis-l2': 3600,
          'cdn-l3': 86400
        },
        invalidationStrategy: 'immediate',
        warmupStrategy: 'preload',
        tenantIsolation: true,
        compressionEnabled: true,
        tags: ['plugin', 'asset']
      },
      {
        id: 'user-data',
        name: 'User Data Policy',
        pattern: 'user:*',
        layers: ['memory-l1', 'redis-l2'],
        ttl: {
          'memory-l1': 300,
          'redis-l2': 1800
        },
        invalidationStrategy: 'immediate',
        warmupStrategy: 'on_demand',
        tenantIsolation: true,
        compressionEnabled: false,
        tags: ['user']
      },
      {
        id: 'catalog-data',
        name: 'Catalog Data Policy',
        pattern: 'catalog:*',
        layers: ['memory-l1', 'redis-l2'],
        ttl: {
          'memory-l1': 600,
          'redis-l2': 3600
        },
        invalidationStrategy: 'lazy',
        warmupStrategy: 'background',
        tenantIsolation: true,
        compressionEnabled: true,
        tags: ['catalog']
      }
    ];

    for (const policy of policies) {
      this.cachePolicies.set(policy.id, policy);
    }

    console.log(`Initialized ${policies.length} cache policies`);
  }

  /**
   * Start maintenance tasks
   */
  private startMaintenanceTasks(): void {
    // TTL cleanup every 5 minutes
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, 5 * 60 * 1000);

    // Metrics update every minute
    setInterval(() => {
      this.updateLayerMetrics();
    }, 60 * 1000);
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpiredEntries(): void {
    let totalCleaned = 0;

    for (const [layerId, layerEntries] of this.cacheEntries.entries()) {
      const layer = this.cacheLayers.get(layerId);
      if (!layer) continue;

      const expiredKeys: string[] = [];
      let spaceFreed = 0;

      for (const [cacheKey, entry] of layerEntries.entries()) {
        const age = Date.now() - entry.createdAt.getTime();
        if (age > entry.ttl * 1000) {
          expiredKeys.push(cacheKey);
          spaceFreed += entry.size;
          
          // Update tenant keyspace
          this.updateTenantKeyspace(entry.tenantId, cacheKey, 'remove');
        }
      }

      // Remove expired entries
      for (const cacheKey of expiredKeys) {
        layerEntries.delete(cacheKey);
      }

      layer.currentSize -= spaceFreed;
      totalCleaned += expiredKeys.length;
    }

    if (totalCleaned > 0) {
      console.log(`Cleaned up ${totalCleaned} expired cache entries`);
    }
  }

  /**
   * Update layer metrics
   */
  private updateLayerMetrics(): void {
    for (const layer of this.cacheLayers.values()) {
      // Simulate metric updates
      layer.metrics.avgLatency += (Math.random() - 0.5) * 2;
      layer.metrics.lastUpdated = new Date();
      
      // Recalculate rates
      const total = layer.metrics.hits + layer.metrics.misses;
      if (total > 0) {
        layer.hitRate = layer.metrics.hits / total;
        layer.missRate = layer.metrics.misses / total;
      }
    }
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    setInterval(() => {
      // Keep operations log bounded
      if (this.operations.length > 10000) {
        this.operations = this.operations.slice(-5000);
      }
    }, 60 * 1000);
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get system statistics
   */
  getStatistics(): {
    totalLayers: number;
    activeLayers: number;
    totalSize: number;
    maxSize: number;
    utilization: number;
    totalOperations: number;
    globalHitRate: number;
    avgLatency: number;
    entriesInvalidated: number;
  } {
    const layers = Array.from(this.cacheLayers.values());
    const activeLayers = layers.filter(l => l.status === 'active');
    
    const totalSize = layers.reduce((sum, l) => sum + l.currentSize, 0);
    const maxSize = layers.reduce((sum, l) => sum + l.maxSize, 0);
    const utilization = maxSize > 0 ? totalSize / maxSize : 0;

    const analytics = this.getCacheAnalytics();
    
    return {
      totalLayers: layers.length,
      activeLayers: activeLayers.length,
      totalSize,
      maxSize,
      utilization,
      totalOperations: analytics.operationStats.total,
      globalHitRate: analytics.operationStats.total > 0 ? 
        analytics.operationStats.hits / analytics.operationStats.total : 0,
      avgLatency: analytics.operationStats.avgLatency,
      entriesInvalidated: analytics.invalidationStats.total
    };
  }
}

// Global edge caching manager instance
export const edgeCache = new EdgeCachingManager();

export default edgeCache;