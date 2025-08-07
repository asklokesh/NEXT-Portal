export interface CacheConfig {
  memory: MemoryCacheConfig;
  redis: RedisCacheConfig;
  strategy: CacheStrategyConfig;
  warmingInterval?: number;
  cleanupInterval?: number;
}

export interface MemoryCacheConfig {
  maxSize: number; // Maximum memory usage in MB
  maxEntries: number; // Maximum number of entries
  defaultTtl: number; // Default TTL in milliseconds
  evictionPolicy: 'lru' | 'lfu' | 'fifo';
  compressionThreshold: number; // Compress values larger than this size
}

export interface RedisCacheConfig {
  cluster: {
    nodes: Array<{ host: string; port: number }>;
    options: {
      enableReadyCheck: boolean;
      redisOptions: {
        password?: string;
        db?: number;
        connectTimeout?: number;
        commandTimeout?: number;
        retryDelayOnFailover?: number;
        maxRetriesPerRequest?: number;
      };
    };
  };
  compression: {
    enabled: boolean;
    threshold: number; // Bytes
    algorithm: 'gzip' | 'lz4' | 'snappy';
  };
  serialization: {
    format: 'json' | 'msgpack' | 'protobuf';
    useTypedArrays: boolean;
  };
  replication: {
    readPreference: 'primary' | 'secondary' | 'nearest';
    readTimeout: number;
  };
  persistence: {
    snapshotInterval: number; // seconds
    appendOnlyFile: boolean;
  };
}

export interface CacheStrategyConfig {
  tierPreference: {
    read: CacheTierPreference[];
    write: CacheTierPreference[];
  };
  consistency: 'eventual' | 'strong' | 'weak';
  invalidation: {
    strategy: 'write-through' | 'write-behind' | 'write-around';
    batchSize: number;
    flushInterval: number;
  };
  hotKeyDetection: {
    enabled: boolean;
    threshold: number; // Requests per second
    windowSize: number; // seconds
  };
}

export interface CacheTierPreference {
  tier: 'memory' | 'redis' | 'cluster';
  weight: number;
  conditions?: {
    keyPattern?: string;
    valueSize?: { min?: number; max?: number };
    ttl?: { min?: number; max?: number };
    accessFrequency?: { min?: number; max?: number };
  };
}

export interface CacheEntry<T = any> {
  value: T;
  metadata: CacheEntryMetadata;
}

export interface CacheEntryMetadata {
  createdAt: number;
  lastAccessed: number;
  accessCount: number;
  ttl: number;
  size: number;
  tags: string[];
  version: number;
  compressed: boolean;
  tier: 'memory' | 'redis' | 'cluster';
}

export interface CacheSetOptions {
  ttl?: number;
  tags?: string[];
  tier?: 'memory' | 'redis' | 'cluster';
  compression?: boolean;
  priority?: 'low' | 'normal' | 'high';
  consistency?: 'eventual' | 'strong';
}

export interface CacheGetOptions {
  staleWhileRevalidate?: boolean;
  maxStaleSeconds?: number;
  skipTiers?: Array<'memory' | 'redis' | 'cluster'>;
  refreshOnAccess?: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  errors: number;
  size: number;
  memoryUsage: number;
}

export interface TierHealth {
  healthy: boolean;
  latency: number;
  errorRate: number;
  throughput: number;
  lastError?: string;
}

export interface CacheMetricsSnapshot {
  timestamp: number;
  global: CacheStats;
  tiers: Record<string, CacheStats & TierHealth>;
  topKeys: Array<{ key: string; hits: number; size: number }>;
  hotKeys: Array<{ key: string; requestsPerSecond: number }>;
}

export interface InvalidationEvent {
  type: 'key' | 'tag' | 'pattern' | 'time';
  target: string;
  timestamp: number;
  source: 'manual' | 'ttl' | 'eviction' | 'update';
}

export interface ReplicationOptions {
  mode: 'async' | 'sync';
  consistencyLevel: 'one' | 'quorum' | 'all';
  timeout: number;
  retryCount: number;
}

export interface CompressionResult {
  data: Buffer;
  algorithm: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

export interface SerializationOptions {
  format: 'json' | 'msgpack' | 'protobuf';
  schema?: any; // For protobuf
  compression?: boolean;
  encryption?: {
    enabled: boolean;
    algorithm: 'aes-256-gcm' | 'chacha20-poly1305';
    key: Buffer;
  };
}

export interface CacheKeyMetrics {
  key: string;
  hits: number;
  misses: number;
  lastAccess: number;
  averageSize: number;
  tier: 'memory' | 'redis' | 'cluster';
  hotness: number; // Calculated hotness score
}

export interface ClusterNodeInfo {
  id: string;
  host: string;
  port: number;
  role: 'master' | 'slave';
  slots: number[];
  health: TierHealth;
  memory: {
    used: number;
    available: number;
    fragmentation: number;
  };
}

// Event types for cache monitoring
export interface CacheEvent {
  type: 'hit' | 'miss' | 'set' | 'delete' | 'evict' | 'expire' | 'error';
  key: string;
  tier: 'memory' | 'redis' | 'cluster';
  timestamp: number;
  metadata?: any;
}

export type CacheEventListener = (event: CacheEvent) => void;

// Batch operation types
export interface BatchOperation<T = any> {
  type: 'get' | 'set' | 'delete';
  key: string;
  value?: T;
  options?: CacheSetOptions | CacheGetOptions;
}

export interface BatchResult<T = any> {
  key: string;
  success: boolean;
  value?: T;
  error?: string;
}

// Advanced query types
export interface CacheQuery {
  pattern?: string;
  tags?: string[];
  minAge?: number;
  maxAge?: number;
  tier?: 'memory' | 'redis' | 'cluster';
  sortBy?: 'lastAccessed' | 'createdAt' | 'size' | 'hits';
  limit?: number;
  offset?: number;
}

export interface CacheQueryResult<T = any> {
  entries: Array<{ key: string; value: T; metadata: CacheEntryMetadata }>;
  totalCount: number;
  hasMore: boolean;
}

// Configuration validation schemas
export interface CacheConfigValidation {
  memory: {
    maxSize: { min: number; max: number };
    maxEntries: { min: number; max: number };
    defaultTtl: { min: number; max: number };
  };
  redis: {
    nodeCount: { min: number; max: number };
    connectionTimeout: { min: number; max: number };
    commandTimeout: { min: number; max: number };
  };
}

// Performance monitoring types
export interface PerformanceMetrics {
  latency: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    average: number;
  };
  throughput: {
    requestsPerSecond: number;
    bytesPerSecond: number;
  };
  resources: {
    cpuUsage: number;
    memoryUsage: number;
    networkIO: number;
  };
}

// Cache warming strategies
export interface WarmingStrategy {
  type: 'popular' | 'predicted' | 'scheduled' | 'manual';
  schedule?: string; // Cron expression
  keySource: 'analytics' | 'logs' | 'manual';
  batchSize: number;
  priority: 'low' | 'normal' | 'high';
}

export interface WarmingJob {
  id: string;
  strategy: WarmingStrategy;
  keys: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  startTime?: number;
  endTime?: number;
  error?: string;
}