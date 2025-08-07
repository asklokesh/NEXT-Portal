import Redis, { Cluster } from 'ioredis';
import { compress, decompress } from './compression';
import { serialize, deserialize } from './serialization';
import { RedisCacheConfig, CacheSetOptions, CacheEntry, CacheEntryMetadata, ClusterNodeInfo, ReplicationOptions } from './types';
import { logger } from '../monitoring/index';
import { MetricsCollector } from '../monitoring/metrics-collector';

export class RedisClusterCache {
  private cluster: Cluster;
  private config: RedisCacheConfig;
  private metrics: MetricsCollector;
  private connectionHealth = new Map<string, boolean>();
  
  constructor(config: RedisCacheConfig) {
    this.config = config;
    this.metrics = new MetricsCollector();
    this.initializeCluster();
  }

  private initializeCluster(): void {
    const clusterNodes = this.config.cluster.nodes.map(node => ({
      host: node.host,
      port: node.port
    }));

    this.cluster = new Cluster(clusterNodes, {
      ...this.config.cluster.options,
      dnsLookup: (address, callback) => callback(null, address),
      enableReadyCheck: true,
      redisOptions: {
        ...this.config.cluster.options.redisOptions,
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        enableOfflineQueue: false
      },
      scaleReads: this.config.replication.readPreference as 'master' | 'slave' | 'all',
      clusterRetryInterval: 500,
      maxRedirections: 16,
      retryCount: 3
    });

    this.cluster.on('connect', () => {
      logger.info('Redis cluster connected successfully');
    });

    this.cluster.on('ready', () => {
      logger.info('Redis cluster ready for operations');
      this.startHealthMonitoring();
    });

    this.cluster.on('error', (error) => {
      logger.error('Redis cluster error:', error);
      this.metrics.incrementCounter('redis_errors', { error: error.message });
    });

    this.cluster.on('reconnecting', () => {
      logger.warn('Redis cluster reconnecting...');
    });

    this.cluster.on('node error', (error, node) => {
      logger.error(`Redis node error ${node.options.host}:${node.options.port}:`, error);
      this.connectionHealth.set(`${node.options.host}:${node.options.port}`, false);
    });

    this.cluster.on('+node', (node) => {
      logger.info(`Redis node added: ${node.options.host}:${node.options.port}`);
    });

    this.cluster.on('-node', (node) => {
      logger.warn(`Redis node removed: ${node.options.host}:${node.options.port}`);
    });
  }

  /**
   * Get value with metadata and staleness check
   */
  async getWithMetadata<T>(key: string): Promise<{ value: T; isStale: boolean; metadata: CacheEntryMetadata } | null> {
    const startTime = Date.now();
    
    try {
      const rawData = await this.cluster.get(key);
      if (!rawData) {
        this.metrics.recordHistogram('redis_get_latency', Date.now() - startTime, { result: 'miss' });
        return null;
      }

      const entry = await this.deserializeEntry<T>(rawData);
      const now = Date.now();
      const isExpired = entry.metadata.createdAt + entry.metadata.ttl < now;
      const isStale = (now - entry.metadata.lastAccessed) > (entry.metadata.ttl * 0.8);

      if (isExpired) {
        // Remove expired entry
        await this.del(key);
        this.metrics.recordHistogram('redis_get_latency', Date.now() - startTime, { result: 'expired' });
        return null;
      }

      // Update access metadata
      entry.metadata.lastAccessed = now;
      entry.metadata.accessCount++;
      
      // Asynchronously update metadata in Redis (fire and forget)
      this.updateMetadata(key, entry.metadata).catch(() => {});

      this.metrics.recordHistogram('redis_get_latency', Date.now() - startTime, { result: 'hit' });
      return { value: entry.value, isStale, metadata: entry.metadata };
    } catch (error) {
      logger.error(`Redis get error for key ${key}:`, error);
      this.metrics.incrementCounter('redis_get_errors', { key, error: error.message });
      throw error;
    }
  }

  /**
   * Get value (simplified interface)
   */
  async get<T>(key: string): Promise<T | null> {
    const result = await this.getWithMetadata<T>(key);
    return result ? result.value : null;
  }

  /**
   * Set value with advanced options
   */
  async set<T>(key: string, value: T, options: CacheSetOptions & { compression?: boolean } = {}): Promise<void> {
    const startTime = Date.now();
    
    try {
      const now = Date.now();
      const ttl = options.ttl || 3600000; // Default 1 hour
      
      const metadata: CacheEntryMetadata = {
        createdAt: now,
        lastAccessed: now,
        accessCount: 0,
        ttl,
        size: 0, // Will be calculated during serialization
        tags: options.tags || [],
        version: 1,
        compressed: options.compression ?? this.shouldCompress(value),
        tier: 'redis'
      };

      const entry: CacheEntry<T> = { value, metadata };
      const serializedData = await this.serializeEntry(entry);
      
      metadata.size = serializedData.length;

      // Calculate TTL in seconds for Redis
      const ttlSeconds = Math.floor(ttl / 1000);
      
      // Use pipeline for atomic operations
      const pipeline = this.cluster.pipeline();
      
      // Set the main key
      if (ttlSeconds > 0) {
        pipeline.setex(key, ttlSeconds, serializedData);
      } else {
        pipeline.set(key, serializedData);
      }
      
      // Handle tags for invalidation
      if (options.tags && options.tags.length > 0) {
        await this.handleTagAssociation(key, options.tags, ttlSeconds, pipeline);
      }
      
      await pipeline.exec();
      
      this.metrics.recordHistogram('redis_set_latency', Date.now() - startTime, { 
        compressed: metadata.compressed,
        size: metadata.size 
      });
      
      this.metrics.incrementCounter('redis_sets', { 
        key: this.getKeyPrefix(key),
        compressed: metadata.compressed.toString()
      });
      
    } catch (error) {
      logger.error(`Redis set error for key ${key}:`, error);
      this.metrics.incrementCounter('redis_set_errors', { key, error: error.message });
      throw error;
    }
  }

  /**
   * Delete key from cluster
   */
  async del(key: string): Promise<void> {
    try {
      // Get tags before deletion for cleanup
      const tags = await this.getKeyTags(key);
      
      const pipeline = this.cluster.pipeline();
      pipeline.del(key);
      
      // Clean up tag associations
      if (tags.length > 0) {
        for (const tag of tags) {
          pipeline.srem(`tag:${tag}`, key);
        }
      }
      
      await pipeline.exec();
      this.metrics.incrementCounter('redis_deletes', { key: this.getKeyPrefix(key) });
    } catch (error) {
      logger.error(`Redis delete error for key ${key}:`, error);
      this.metrics.incrementCounter('redis_delete_errors', { key, error: error.message });
      throw error;
    }
  }

  /**
   * Multi-get with batching optimization
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) return [];
    
    const startTime = Date.now();
    
    try {
      // Group keys by hash slot for optimal batching
      const keyGroups = this.groupKeysByHashSlot(keys);
      const results = new Array<T | null>(keys.length);
      
      await Promise.all(
        keyGroups.map(async ({ indices, keys: groupKeys }) => {
          const values = await this.cluster.mget(...groupKeys);
          
          for (let i = 0; i < values.length; i++) {
            const rawValue = values[i];
            const originalIndex = indices[i];
            
            if (rawValue) {
              try {
                const entry = await this.deserializeEntry<T>(rawValue);
                const now = Date.now();
                const isExpired = entry.metadata.createdAt + entry.metadata.ttl < now;
                
                if (!isExpired) {
                  results[originalIndex] = entry.value;
                  
                  // Update access metadata asynchronously
                  entry.metadata.lastAccessed = now;
                  entry.metadata.accessCount++;
                  this.updateMetadata(groupKeys[i], entry.metadata).catch(() => {});
                } else {
                  results[originalIndex] = null;
                  // Clean up expired key asynchronously
                  this.del(groupKeys[i]).catch(() => {});
                }
              } catch {
                results[originalIndex] = null;
              }
            } else {
              results[originalIndex] = null;
            }
          }
        })
      );
      
      this.metrics.recordHistogram('redis_mget_latency', Date.now() - startTime, { 
        keyCount: keys.length 
      });
      
      return results;
    } catch (error) {
      logger.error('Redis mget error:', error);
      this.metrics.incrementCounter('redis_mget_errors', { keyCount: keys.length, error: error.message });
      return keys.map(() => null);
    }
  }

  /**
   * Multi-set with batching
   */
  async mset<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    if (entries.length === 0) return;
    
    const startTime = Date.now();
    
    try {
      const pipeline = this.cluster.pipeline();
      
      for (const entry of entries) {
        const now = Date.now();
        const ttl = entry.ttl || 3600000;
        
        const metadata: CacheEntryMetadata = {
          createdAt: now,
          lastAccessed: now,
          accessCount: 0,
          ttl,
          size: 0,
          tags: [],
          version: 1,
          compressed: this.shouldCompress(entry.value),
          tier: 'redis'
        };
        
        const cacheEntry: CacheEntry<T> = { value: entry.value, metadata };
        const serializedData = await this.serializeEntry(cacheEntry);
        
        const ttlSeconds = Math.floor(ttl / 1000);
        if (ttlSeconds > 0) {
          pipeline.setex(entry.key, ttlSeconds, serializedData);
        } else {
          pipeline.set(entry.key, serializedData);
        }
      }
      
      await pipeline.exec();
      
      this.metrics.recordHistogram('redis_mset_latency', Date.now() - startTime, { 
        entryCount: entries.length 
      });
      
    } catch (error) {
      logger.error('Redis mset error:', error);
      this.metrics.incrementCounter('redis_mset_errors', { entryCount: entries.length, error: error.message });
      throw error;
    }
  }

  /**
   * Invalidate keys by pattern using Lua script for atomic operation
   */
  async invalidatePattern(pattern: string): Promise<void> {
    const luaScript = `
      local keys = redis.call('KEYS', ARGV[1])
      local deleted = 0
      for i=1,#keys do
        redis.call('DEL', keys[i])
        deleted = deleted + 1
      end
      return deleted
    `;
    
    try {
      const deleted = await this.cluster.eval(luaScript, 0, pattern);
      this.metrics.incrementCounter('redis_pattern_invalidations', { 
        pattern,
        deletedCount: deleted as number 
      });
    } catch (error) {
      logger.error(`Redis pattern invalidation error for pattern ${pattern}:`, error);
      throw error;
    }
  }

  /**
   * Associate tags with key for bulk invalidation
   */
  async associateTagsWithKey(key: string, tags: string[]): Promise<void> {
    if (tags.length === 0) return;
    
    const pipeline = this.cluster.pipeline();
    
    // Store tags for this key
    pipeline.sadd(`key:tags:${key}`, ...tags);
    
    // Add key to each tag's set
    for (const tag of tags) {
      pipeline.sadd(`tag:${tag}`, key);
    }
    
    // Set expiration for tag associations (same as key TTL)
    const keyTtl = await this.cluster.ttl(key);
    if (keyTtl > 0) {
      pipeline.expire(`key:tags:${key}`, keyTtl);
      for (const tag of tags) {
        pipeline.expire(`tag:${tag}`, keyTtl);
      }
    }
    
    await pipeline.exec();
  }

  /**
   * Get cluster node information
   */
  async getClusterInfo(): Promise<ClusterNodeInfo[]> {
    const nodes = this.cluster.nodes();
    const nodeInfoPromises = nodes.map(async (node) => {
      const nodeKey = `${node.options.host}:${node.options.port}`;
      
      try {
        const info = await node.info();
        const memory = await node.memory('usage');
        
        return {
          id: node.options.host + ':' + node.options.port,
          host: node.options.host!,
          port: node.options.port!,
          role: info.includes('role:master') ? 'master' as const : 'slave' as const,
          slots: [], // Would need to parse cluster slots
          health: {
            healthy: this.connectionHealth.get(nodeKey) !== false,
            latency: 0, // Would measure with ping
            errorRate: 0,
            throughput: 0,
          },
          memory: {
            used: memory.total || 0,
            available: memory.available || 0,
            fragmentation: parseFloat(info.match(/mem_fragmentation_ratio:([\d.]+)/)?.[1] || '1')
          }
        };
      } catch {
        return {
          id: nodeKey,
          host: node.options.host!,
          port: node.options.port!,
          role: 'slave' as const,
          slots: [],
          health: {
            healthy: false,
            latency: -1,
            errorRate: 1,
            throughput: 0,
          },
          memory: { used: 0, available: 0, fragmentation: 0 }
        };
      }
    });
    
    return Promise.all(nodeInfoPromises);
  }

  /**
   * Cleanup expired entries and optimize memory
   */
  async cleanup(): Promise<void> {
    // This is typically handled by Redis automatically, but we can trigger memory optimization
    try {
      await this.cluster.memory('purge');
      logger.info('Redis cluster memory cleanup completed');
    } catch (error) {
      logger.error('Redis cleanup error:', error);
    }
  }

  /**
   * Close cluster connection
   */
  async disconnect(): Promise<void> {
    await this.cluster.quit();
    logger.info('Redis cluster disconnected');
  }

  // Private helper methods

  private shouldCompress<T>(value: T): boolean {
    const serializedSize = JSON.stringify(value).length;
    return this.config.compression.enabled && 
           serializedSize > this.config.compression.threshold;
  }

  private async serializeEntry<T>(entry: CacheEntry<T>): Promise<string> {
    let data = serialize(entry, this.config.serialization);
    
    if (entry.metadata.compressed) {
      data = await compress(Buffer.from(data), this.config.compression.algorithm);
    }
    
    return typeof data === 'string' ? data : data.toString('base64');
  }

  private async deserializeEntry<T>(data: string): Promise<CacheEntry<T>> {
    let buffer = Buffer.from(data, 'base64');
    
    // Try to decompress first (we'll know from the header)
    try {
      buffer = await decompress(buffer);
    } catch {
      // Not compressed, use as is
      buffer = Buffer.from(data, 'utf8');
    }
    
    const entry = deserialize<CacheEntry<T>>(buffer.toString('utf8'), this.config.serialization);
    return entry;
  }

  private getKeyPrefix(key: string): string {
    return key.split(':')[0] || 'unknown';
  }

  private groupKeysByHashSlot(keys: string[]): Array<{ indices: number[]; keys: string[] }> {
    // Simplified grouping - in production, you'd use Redis cluster hash slot calculation
    const groups = new Map<number, { indices: number[]; keys: string[] }>();
    
    keys.forEach((key, index) => {
      const slot = this.calculateHashSlot(key);
      if (!groups.has(slot)) {
        groups.set(slot, { indices: [], keys: [] });
      }
      groups.get(slot)!.indices.push(index);
      groups.get(slot)!.keys.push(key);
    });
    
    return Array.from(groups.values());
  }

  private calculateHashSlot(key: string): number {
    // Simplified hash slot calculation
    // Real implementation would use CRC16
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash + key.charCodeAt(i)) & 0xffffffff;
    }
    return Math.abs(hash) % 16384; // Redis cluster has 16384 slots
  }

  private async handleTagAssociation(
    key: string, 
    tags: string[], 
    ttlSeconds: number, 
    pipeline: any
  ): Promise<void> {
    // Store key-tag associations
    pipeline.sadd(`key:tags:${key}`, ...tags);
    if (ttlSeconds > 0) {
      pipeline.expire(`key:tags:${key}`, ttlSeconds);
    }
    
    // Store tag-key associations
    for (const tag of tags) {
      pipeline.sadd(`tag:${tag}`, key);
      if (ttlSeconds > 0) {
        pipeline.expire(`tag:${tag}`, ttlSeconds);
      }
    }
  }

  private async getKeyTags(key: string): Promise<string[]> {
    try {
      const tags = await this.cluster.smembers(`key:tags:${key}`);
      return tags || [];
    } catch {
      return [];
    }
  }

  private async updateMetadata(key: string, metadata: CacheEntryMetadata): Promise<void> {
    // This could be optimized to only update specific fields
    const metadataKey = `meta:${key}`;
    const ttlSeconds = Math.floor(metadata.ttl / 1000);
    
    try {
      const pipeline = this.cluster.pipeline();
      pipeline.hset(metadataKey, 
        'lastAccessed', metadata.lastAccessed,
        'accessCount', metadata.accessCount
      );
      if (ttlSeconds > 0) {
        pipeline.expire(metadataKey, ttlSeconds);
      }
      await pipeline.exec();
    } catch {
      // Ignore metadata update errors
    }
  }

  private startHealthMonitoring(): void {
    setInterval(async () => {
      const nodes = this.cluster.nodes();
      
      for (const node of nodes) {
        const nodeKey = `${node.options.host}:${node.options.port}`;
        try {
          await node.ping();
          this.connectionHealth.set(nodeKey, true);
        } catch {
          this.connectionHealth.set(nodeKey, false);
        }
      }
    }, 30000); // Check every 30 seconds
  }
}