/**
 * Production Redis Cluster Configuration
 * Supports Redis Cluster, Sentinel, session management, and caching strategies
 */

import { Redis, Cluster, ClusterOptions } from 'ioredis';
import winston from 'winston';
import { EventEmitter } from 'events';

interface RedisClusterConfig {
  mode: 'cluster' | 'sentinel' | 'standalone';
  nodes: Array<{
    host: string;
    port: number;
  }>;
  password?: string;
  sentinels?: Array<{
    host: string;
    port: number;
  }>;
  masterName?: string; // For Sentinel mode
  options: {
    retryDelayOnFailover: number;
    maxRetriesPerRequest: number;
    enableReadyCheck: boolean;
    lazyConnect: boolean;
    keepAlive: number;
    connectTimeout: number;
    commandTimeout: number;
    keyPrefix: string;
  };
  session: {
    keyPrefix: string;
    ttl: number; // seconds
    rolling: boolean;
    cookie: {
      maxAge: number;
      httpOnly: boolean;
      secure: boolean;
      sameSite: 'strict' | 'lax' | 'none';
    };
  };
  cache: {
    defaultTtl: number;
    maxMemoryPolicy: 'allkeys-lru' | 'volatile-lru' | 'allkeys-lfu' | 'volatile-lfu' | 'allkeys-random' | 'volatile-random';
    strategies: {
      writeThrough: boolean;
      writeBack: boolean;
      cacheAside: boolean;
    };
  };
  monitoring: {
    enabled: boolean;
    metricsInterval: number;
    slowCommandThreshold: number;
    memoryWarningThreshold: number;
  };
}

interface RedisMetrics {
  timestamp: Date;
  connections: {
    connected: number;
    blocked: number;
    total: number;
  };
  memory: {
    used: number;
    peak: number;
    fragmentation: number;
    available: number;
  };
  commands: {
    processed: number;
    failed: number;
    slowCommands: number;
    avgLatency: number;
  };
  keyspace: {
    totalKeys: number;
    expiredKeys: number;
    evictedKeys: number;
    hitRatio: number;
  };
  replication: {
    role: 'master' | 'slave';
    connectedSlaves: number;
    replBacklogSize: number;
  };
  cluster?: {
    state: 'ok' | 'fail';
    slotsAssigned: number;
    knownNodes: number;
  };
}

export class RedisClusterManager extends EventEmitter {
  private config: RedisClusterConfig;
  private logger: winston.Logger;
  private client: Redis | Cluster;
  private readOnlyClient?: Redis | Cluster;
  private metrics: RedisMetrics[] = [];
  private monitoringInterval?: NodeJS.Timeout;

  constructor(config: RedisClusterConfig) {
    super();
    this.config = config;
    this.setupLogger();
  }

  private setupLogger() {
    this.logger = winston.createLogger({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'redis-cluster' },
      transports: [
        new winston.transports.File({ filename: 'logs/redis-error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/redis-combined.log' }),
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ],
    });
  }

  public async connect(): Promise<void> {
    this.logger.info('Connecting to Redis cluster', {
      mode: this.config.mode,
      nodes: this.config.nodes.length
    });

    try {
      switch (this.config.mode) {
        case 'cluster':
          this.client = await this.createClusterConnection();
          break;
        case 'sentinel':
          this.client = await this.createSentinelConnection();
          break;
        case 'standalone':
          this.client = await this.createStandaloneConnection();
          break;
        default:
          throw new Error(`Unsupported Redis mode: ${this.config.mode}`);
      }

      this.setupEventHandlers();

      // Create read-only client for read-heavy operations
      if (this.config.mode === 'cluster') {
        this.readOnlyClient = await this.createReadOnlyClusterConnection();
      }

      // Test connection
      await this.client.ping();
      this.logger.info('Redis cluster connected successfully');

      if (this.config.monitoring.enabled) {
        this.startMonitoring();
      }

      this.emit('connected');

    } catch (error) {
      this.logger.error('Failed to connect to Redis cluster', { error: error.message });
      throw error;
    }
  }

  private async createClusterConnection(): Promise<Cluster> {
    const clusterOptions: ClusterOptions = {
      enableOfflineQueue: false,
      redisOptions: {
        password: this.config.password,
        keyPrefix: this.config.options.keyPrefix,
        connectTimeout: this.config.options.connectTimeout,
        commandTimeout: this.config.options.commandTimeout,
        retryDelayOnFailover: this.config.options.retryDelayOnFailover,
        maxRetriesPerRequest: this.config.options.maxRetriesPerRequest,
        lazyConnect: this.config.options.lazyConnect,
        keepAlive: this.config.options.keepAlive,
      },
      scaleReads: 'slave', // Distribute read operations to slave nodes
      maxRedirections: 16,
      retryDelayOnFailover: this.config.options.retryDelayOnFailover,
      enableReadyCheck: this.config.options.enableReadyCheck,
    };

    return new Cluster(this.config.nodes, clusterOptions);
  }

  private async createReadOnlyClusterConnection(): Promise<Cluster> {
    const clusterOptions: ClusterOptions = {
      enableOfflineQueue: false,
      redisOptions: {
        password: this.config.password,
        keyPrefix: this.config.options.keyPrefix,
        readOnly: true,
      },
      scaleReads: 'slave',
      maxRedirections: 16,
    };

    return new Cluster(this.config.nodes, clusterOptions);
  }

  private async createSentinelConnection(): Promise<Redis> {
    if (!this.config.sentinels || !this.config.masterName) {
      throw new Error('Sentinels configuration required for sentinel mode');
    }

    return new Redis({
      sentinels: this.config.sentinels,
      name: this.config.masterName,
      password: this.config.password,
      keyPrefix: this.config.options.keyPrefix,
      connectTimeout: this.config.options.connectTimeout,
      commandTimeout: this.config.options.commandTimeout,
      retryDelayOnFailover: this.config.options.retryDelayOnFailover,
      maxRetriesPerRequest: this.config.options.maxRetriesPerRequest,
      lazyConnect: this.config.options.lazyConnect,
      enableReadyCheck: this.config.options.enableReadyCheck,
    });
  }

  private async createStandaloneConnection(): Promise<Redis> {
    const node = this.config.nodes[0];
    if (!node) {
      throw new Error('At least one node required for standalone mode');
    }

    return new Redis({
      host: node.host,
      port: node.port,
      password: this.config.password,
      keyPrefix: this.config.options.keyPrefix,
      connectTimeout: this.config.options.connectTimeout,
      commandTimeout: this.config.options.commandTimeout,
      retryDelayOnFailover: this.config.options.retryDelayOnFailover,
      maxRetriesPerRequest: this.config.options.maxRetriesPerRequest,
      lazyConnect: this.config.options.lazyConnect,
      enableReadyCheck: this.config.options.enableReadyCheck,
      keepAlive: this.config.options.keepAlive,
    });
  }

  private setupEventHandlers() {
    this.client.on('connect', () => {
      this.logger.info('Redis client connected');
    });

    this.client.on('ready', () => {
      this.logger.info('Redis client ready');
      this.emit('ready');
    });

    this.client.on('error', (error) => {
      this.logger.error('Redis client error', { error: error.message });
      this.emit('error', error);
    });

    this.client.on('close', () => {
      this.logger.warn('Redis client disconnected');
      this.emit('disconnected');
    });

    this.client.on('reconnecting', () => {
      this.logger.info('Redis client reconnecting');
      this.emit('reconnecting');
    });

    if (this.client instanceof Cluster) {
      this.client.on('+node', (node) => {
        this.logger.info('New Redis node added', { node: node.options.host + ':' + node.options.port });
      });

      this.client.on('-node', (node) => {
        this.logger.warn('Redis node removed', { node: node.options.host + ':' + node.options.port });
      });

      this.client.on('node error', (error, node) => {
        this.logger.error('Redis node error', { 
          node: node.options.host + ':' + node.options.port,
          error: error.message 
        });
      });
    }
  }

  private startMonitoring() {
    this.logger.info('Starting Redis monitoring');

    this.monitoringInterval = setInterval(async () => {
      await this.collectMetrics();
    }, this.config.monitoring.metricsInterval);
  }

  private async collectMetrics() {
    try {
      const info = await this.client.call('INFO');
      const parsedInfo = this.parseInfoCommand(info as string);

      const metrics: RedisMetrics = {
        timestamp: new Date(),
        connections: {
          connected: parseInt(parsedInfo.connected_clients || '0'),
          blocked: parseInt(parsedInfo.blocked_clients || '0'),
          total: parseInt(parsedInfo.total_connections_received || '0'),
        },
        memory: {
          used: parseInt(parsedInfo.used_memory || '0'),
          peak: parseInt(parsedInfo.used_memory_peak || '0'),
          fragmentation: parseFloat(parsedInfo.mem_fragmentation_ratio || '1'),
          available: parseInt(parsedInfo.maxmemory || '0'),
        },
        commands: {
          processed: parseInt(parsedInfo.total_commands_processed || '0'),
          failed: parseInt(parsedInfo.rejected_connections || '0'),
          slowCommands: 0, // Would need SLOWLOG command
          avgLatency: 0, // Would need custom tracking
        },
        keyspace: {
          totalKeys: this.getTotalKeysFromInfo(parsedInfo),
          expiredKeys: parseInt(parsedInfo.expired_keys || '0'),
          evictedKeys: parseInt(parsedInfo.evicted_keys || '0'),
          hitRatio: this.calculateHitRatio(parsedInfo),
        },
        replication: {
          role: (parsedInfo.role || 'master') as 'master' | 'slave',
          connectedSlaves: parseInt(parsedInfo.connected_slaves || '0'),
          replBacklogSize: parseInt(parsedInfo.repl_backlog_size || '0'),
        },
      };

      // Add cluster-specific metrics
      if (this.client instanceof Cluster) {
        const clusterInfo = await this.client.call('CLUSTER', 'INFO');
        const parsedClusterInfo = this.parseInfoCommand(clusterInfo as string);
        
        metrics.cluster = {
          state: (parsedClusterInfo.cluster_state || 'fail') as 'ok' | 'fail',
          slotsAssigned: parseInt(parsedClusterInfo.cluster_slots_assigned || '0'),
          knownNodes: parseInt(parsedClusterInfo.cluster_known_nodes || '0'),
        };
      }

      this.metrics.push(metrics);

      // Keep only last 24 hours
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      this.metrics = this.metrics.filter(m => m.timestamp.getTime() > oneDayAgo);

      // Check for issues
      this.checkForIssues(metrics);

      this.emit('metrics', metrics);

      this.logger.debug('Redis metrics collected', {
        connections: metrics.connections.connected,
        memoryUsed: metrics.memory.used,
        totalKeys: metrics.keyspace.totalKeys
      });

    } catch (error) {
      this.logger.error('Error collecting Redis metrics', { error: error.message });
    }
  }

  private parseInfoCommand(info: string): Record<string, string> {
    const parsed: Record<string, string> = {};
    
    info.split('\r\n').forEach(line => {
      if (line.includes(':') && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        parsed[key] = value;
      }
    });

    return parsed;
  }

  private getTotalKeysFromInfo(info: Record<string, string>): number {
    let total = 0;
    
    Object.keys(info).forEach(key => {
      if (key.startsWith('db') && key.includes('keys=')) {
        const match = info[key].match(/keys=(\d+)/);
        if (match) {
          total += parseInt(match[1]);
        }
      }
    });

    return total;
  }

  private calculateHitRatio(info: Record<string, string>): number {
    const hits = parseInt(info.keyspace_hits || '0');
    const misses = parseInt(info.keyspace_misses || '0');
    const total = hits + misses;
    
    return total > 0 ? (hits / total) * 100 : 0;
  }

  private checkForIssues(metrics: RedisMetrics) {
    // Memory usage check
    if (metrics.memory.available > 0) {
      const memoryUsage = (metrics.memory.used / metrics.memory.available) * 100;
      if (memoryUsage > this.config.monitoring.memoryWarningThreshold) {
        this.logger.warn('High Redis memory usage', {
          usage: memoryUsage,
          used: metrics.memory.used,
          available: metrics.memory.available
        });
        this.emit('highMemoryUsage', { usage: memoryUsage, metrics });
      }
    }

    // Memory fragmentation check
    if (metrics.memory.fragmentation > 1.5) {
      this.logger.warn('High Redis memory fragmentation', {
        fragmentation: metrics.memory.fragmentation
      });
      this.emit('highFragmentation', { fragmentation: metrics.memory.fragmentation, metrics });
    }

    // Hit ratio check
    if (metrics.keyspace.hitRatio < 80) { // Less than 80% hit ratio
      this.logger.warn('Low Redis cache hit ratio', {
        hitRatio: metrics.keyspace.hitRatio
      });
      this.emit('lowHitRatio', { hitRatio: metrics.keyspace.hitRatio, metrics });
    }

    // Cluster state check
    if (metrics.cluster && metrics.cluster.state !== 'ok') {
      this.logger.error('Redis cluster is in failed state');
      this.emit('clusterFailure', { cluster: metrics.cluster, metrics });
    }
  }

  // Session Management Methods
  public async createSession(sessionId: string, data: any, options?: { ttl?: number }): Promise<void> {
    const key = `${this.config.session.keyPrefix}${sessionId}`;
    const ttl = options?.ttl || this.config.session.ttl;
    
    await this.client.setex(key, ttl, JSON.stringify({
      ...data,
      createdAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString()
    }));
  }

  public async getSession(sessionId: string, updateAccess: boolean = true): Promise<any | null> {
    const key = `${this.config.session.keyPrefix}${sessionId}`;
    const data = await this.client.get(key);
    
    if (!data) {
      return null;
    }

    const sessionData = JSON.parse(data);
    
    if (updateAccess && this.config.session.rolling) {
      sessionData.lastAccessed = new Date().toISOString();
      await this.client.setex(key, this.config.session.ttl, JSON.stringify(sessionData));
    }

    return sessionData;
  }

  public async updateSession(sessionId: string, data: any): Promise<void> {
    const key = `${this.config.session.keyPrefix}${sessionId}`;
    const existing = await this.getSession(sessionId, false);
    
    if (existing) {
      const updated = {
        ...existing,
        ...data,
        lastAccessed: new Date().toISOString()
      };
      
      await this.client.setex(key, this.config.session.ttl, JSON.stringify(updated));
    }
  }

  public async destroySession(sessionId: string): Promise<void> {
    const key = `${this.config.session.keyPrefix}${sessionId}`;
    await this.client.del(key);
  }

  public async getAllSessions(pattern?: string): Promise<string[]> {
    const searchPattern = pattern || `${this.config.session.keyPrefix}*`;
    return await this.client.keys(searchPattern);
  }

  // Cache Management Methods
  public async set(key: string, value: any, ttl?: number): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    
    if (ttl) {
      await this.client.setex(key, ttl, serialized);
    } else if (this.config.cache.defaultTtl > 0) {
      await this.client.setex(key, this.config.cache.defaultTtl, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  public async get(key: string, useReadReplica: boolean = false): Promise<any | null> {
    const client = useReadReplica && this.readOnlyClient ? this.readOnlyClient : this.client;
    const value = await client.get(key);
    
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value);
    } catch {
      return value; // Return as string if not JSON
    }
  }

  public async del(key: string | string[]): Promise<number> {
    const keys = Array.isArray(key) ? key : [key];
    return await this.client.del(...keys);
  }

  public async exists(key: string | string[]): Promise<number> {
    const keys = Array.isArray(key) ? key : [key];
    return await this.client.exists(...keys);
  }

  public async expire(key: string, seconds: number): Promise<number> {
    return await this.client.expire(key, seconds);
  }

  public async ttl(key: string): Promise<number> {
    return await this.client.ttl(key);
  }

  // Cache strategies
  public async getWithFallback<T>(
    key: string, 
    fallbackFn: () => Promise<T>, 
    ttl?: number
  ): Promise<T> {
    // Cache-aside pattern
    let value = await this.get(key);
    
    if (value === null) {
      value = await fallbackFn();
      await this.set(key, value, ttl);
    }
    
    return value;
  }

  public async writeThrough<T>(
    key: string,
    value: T,
    writeFn: (value: T) => Promise<void>,
    ttl?: number
  ): Promise<void> {
    // Write to cache and database simultaneously
    await Promise.all([
      this.set(key, value, ttl),
      writeFn(value)
    ]);
  }

  // Pub/Sub methods
  public async publish(channel: string, message: any): Promise<number> {
    const serialized = typeof message === 'string' ? message : JSON.stringify(message);
    return await this.client.publish(channel, serialized);
  }

  public async subscribe(channel: string, callback: (message: any) => void): Promise<void> {
    if (this.client instanceof Cluster) {
      // Use a single node for subscription
      const subscriber = this.client.duplicate();
      await subscriber.subscribe(channel);
      subscriber.on('message', (receivedChannel, message) => {
        if (receivedChannel === channel) {
          try {
            const parsed = JSON.parse(message);
            callback(parsed);
          } catch {
            callback(message);
          }
        }
      });
    } else {
      await this.client.subscribe(channel);
      this.client.on('message', (receivedChannel, message) => {
        if (receivedChannel === channel) {
          try {
            const parsed = JSON.parse(message);
            callback(parsed);
          } catch {
            callback(message);
          }
        }
      });
    }
  }

  // Health and status methods
  public async ping(): Promise<string> {
    return await this.client.ping();
  }

  public getLatestMetrics(): RedisMetrics | null {
    return this.metrics[this.metrics.length - 1] || null;
  }

  public getMetricsHistory(hours: number = 1): RedisMetrics[] {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    return this.metrics.filter(m => m.timestamp.getTime() > cutoff);
  }

  public async getHealthStatus() {
    try {
      const latency = Date.now();
      await this.client.ping();
      const pingTime = Date.now() - latency;

      const metrics = this.getLatestMetrics();
      
      return {
        status: 'healthy',
        pingTime,
        connections: metrics?.connections.connected || 0,
        memoryUsage: metrics?.memory.used || 0,
        hitRatio: metrics?.keyspace.hitRatio || 0,
        cluster: metrics?.cluster
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  public async disconnect(): Promise<void> {
    this.logger.info('Disconnecting Redis cluster');

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    if (this.readOnlyClient) {
      await this.readOnlyClient.quit();
    }

    await this.client.quit();
    
    this.emit('disconnected');
  }
}

// Configuration factory
export function createRedisClusterConfig(): RedisClusterConfig {
  const nodes = (process.env.REDIS_CLUSTER_NODES || 'localhost:6379')
    .split(',')
    .map(node => {
      const [host, port] = node.split(':');
      return { host, port: parseInt(port) };
    });

  return {
    mode: (process.env.REDIS_MODE as any) || 'standalone',
    nodes,
    password: process.env.REDIS_PASSWORD,
    sentinels: process.env.REDIS_SENTINELS?.split(',').map(sentinel => {
      const [host, port] = sentinel.split(':');
      return { host, port: parseInt(port) };
    }),
    masterName: process.env.REDIS_MASTER_NAME || 'mymaster',
    options: {
      retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100'),
      maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
      enableReadyCheck: process.env.REDIS_READY_CHECK !== 'false',
      lazyConnect: process.env.REDIS_LAZY_CONNECT === 'true',
      keepAlive: parseInt(process.env.REDIS_KEEP_ALIVE || '30000'),
      connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000'),
      commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '5000'),
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'saas-idp:',
    },
    session: {
      keyPrefix: 'session:',
      ttl: parseInt(process.env.SESSION_TTL || '3600'), // 1 hour
      rolling: process.env.SESSION_ROLLING === 'true',
      cookie: {
        maxAge: parseInt(process.env.SESSION_COOKIE_MAX_AGE || '86400000'), // 24 hours
        httpOnly: process.env.SESSION_COOKIE_HTTP_ONLY !== 'false',
        secure: process.env.SESSION_COOKIE_SECURE === 'true',
        sameSite: (process.env.SESSION_COOKIE_SAME_SITE as any) || 'lax',
      },
    },
    cache: {
      defaultTtl: parseInt(process.env.CACHE_DEFAULT_TTL || '300'), // 5 minutes
      maxMemoryPolicy: (process.env.REDIS_MAX_MEMORY_POLICY as any) || 'allkeys-lru',
      strategies: {
        writeThrough: process.env.CACHE_WRITE_THROUGH === 'true',
        writeBack: process.env.CACHE_WRITE_BACK === 'true',
        cacheAside: process.env.CACHE_ASIDE !== 'false',
      },
    },
    monitoring: {
      enabled: process.env.REDIS_MONITORING_ENABLED !== 'false',
      metricsInterval: parseInt(process.env.REDIS_METRICS_INTERVAL || '30000'),
      slowCommandThreshold: parseInt(process.env.REDIS_SLOW_COMMAND_THRESHOLD || '1000'),
      memoryWarningThreshold: parseInt(process.env.REDIS_MEMORY_WARNING_THRESHOLD || '80'),
    },
  };
}