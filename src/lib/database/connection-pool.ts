/**
 * Enterprise Database Connection Pool Configuration
 * Optimized for high-performance multi-tenant SaaS operations
 */

import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import Redis from 'ioredis';

// Connection pool configuration for different environments
const CONNECTION_CONFIGS = {
  development: {
    maxConnections: 20,
    minConnections: 5,
    connectionTimeout: 30000,
    idleTimeout: 600000,
    maxLifetime: 1800000,
    queryTimeout: 30000,
  },
  production: {
    maxConnections: 100,
    minConnections: 20,
    connectionTimeout: 15000,
    idleTimeout: 300000,
    maxLifetime: 3600000,
    queryTimeout: 60000,
  },
  test: {
    maxConnections: 5,
    minConnections: 1,
    connectionTimeout: 10000,
    idleTimeout: 30000,
    maxLifetime: 60000,
    queryTimeout: 10000,
  }
};

class DatabaseConnectionManager {
  private static instance: DatabaseConnectionManager;
  private prismaClient: PrismaClient | null = null;
  private readReplicaClient: PrismaClient | null = null;
  private pgPool: Pool | null = null;
  private redis: Redis | null = null;
  private connectionMetrics = {
    activeConnections: 0,
    totalQueries: 0,
    slowQueries: 0,
    errors: 0,
    cacheHits: 0,
    cacheMisses: 0
  };

  private constructor() {}

  static getInstance(): DatabaseConnectionManager {
    if (!DatabaseConnectionManager.instance) {
      DatabaseConnectionManager.instance = new DatabaseConnectionManager();
    }
    return DatabaseConnectionManager.instance;
  }

  /**
   * Initialize optimized Prisma client with connection pooling
   */
  async initializePrisma(): Promise<PrismaClient> {
    if (this.prismaClient) {
      return this.prismaClient;
    }

    const env = process.env.NODE_ENV || 'development';
    const config = CONNECTION_CONFIGS[env as keyof typeof CONNECTION_CONFIGS];

    // Enhanced Prisma configuration with connection pooling
    this.prismaClient = new PrismaClient({
      datasources: {
        db: {
          url: this.buildConnectionString('write', config)
        }
      },
      log: env === 'production' ? ['error', 'warn'] : ['query', 'info', 'warn', 'error'],
      errorFormat: 'minimal',
    });

    // Add query performance monitoring
    this.prismaClient.$use(async (params, next) => {
      const startTime = Date.now();
      this.connectionMetrics.totalQueries++;
      this.connectionMetrics.activeConnections++;

      try {
        const result = await next(params);
        const duration = Date.now() - startTime;
        
        // Track slow queries (>1s)
        if (duration > 1000) {
          this.connectionMetrics.slowQueries++;
          console.warn(`Slow query detected: ${params.model}.${params.action} took ${duration}ms`);
        }

        return result;
      } catch (error) {
        this.connectionMetrics.errors++;
        throw error;
      } finally {
        this.connectionMetrics.activeConnections--;
      }
    });

    // Initialize read replica if configured
    if (process.env.DATABASE_READ_URL) {
      this.readReplicaClient = new PrismaClient({
        datasources: {
          db: {
            url: this.buildConnectionString('read', config)
          }
        },
        log: ['error', 'warn'],
        errorFormat: 'minimal',
      });
    }

    return this.prismaClient;
  }

  /**
   * Initialize native PostgreSQL connection pool for complex queries
   */
  async initializeNativePool(): Promise<Pool> {
    if (this.pgPool) {
      return this.pgPool;
    }

    const env = process.env.NODE_ENV || 'development';
    const config = CONNECTION_CONFIGS[env as keyof typeof CONNECTION_CONFIGS];

    this.pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      min: config.minConnections,
      max: config.maxConnections,
      idleTimeoutMillis: config.idleTimeout,
      connectionTimeoutMillis: config.connectionTimeout,
      maxLifetimeSeconds: config.maxLifetime / 1000,
      statement_timeout: config.queryTimeout,
      query_timeout: config.queryTimeout,
      application_name: 'saas-idp-platform',
      
      // Advanced pool configuration
      allowExitOnIdle: true,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

    // Pool event monitoring
    this.pgPool.on('connect', () => {
      this.connectionMetrics.activeConnections++;
    });

    this.pgPool.on('remove', () => {
      this.connectionMetrics.activeConnections--;
    });

    this.pgPool.on('error', (err) => {
      this.connectionMetrics.errors++;
      console.error('Database pool error:', err);
    });

    return this.pgPool;
  }

  /**
   * Initialize Redis for caching and session management
   */
  async initializeRedis(): Promise<Redis> {
    if (this.redis) {
      return this.redis;
    }

    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      
      // Performance optimizations
      lazyConnect: true,
      keepAlive: 30000,
      connectTimeout: 10000,
      commandTimeout: 5000,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      maxLoadingTimeout: 5000,
      enableAutoPipelining: true,
      
      // Connection pooling
      family: 4,
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'saas-idp:',
      
      // Cluster configuration if needed
      enableReadyCheck: true,
      maxCommandsInBuffer: 10000,
    };

    this.redis = new Redis(redisConfig);

    // Redis event monitoring
    this.redis.on('connect', () => {
      console.log('Redis connected');
    });

    this.redis.on('ready', () => {
      console.log('Redis ready');
    });

    this.redis.on('error', (err) => {
      console.error('Redis error:', err);
    });

    this.redis.on('close', () => {
      console.log('Redis connection closed');
    });

    return this.redis;
  }

  /**
   * Get read-optimized client for queries
   */
  getReadClient(): PrismaClient {
    return this.readReplicaClient || this.prismaClient!;
  }

  /**
   * Get write-optimized client for mutations
   */
  getWriteClient(): PrismaClient {
    return this.prismaClient!;
  }

  /**
   * Get native PostgreSQL pool for complex queries
   */
  getNativePool(): Pool {
    return this.pgPool!;
  }

  /**
   * Get Redis client for caching
   */
  getRedisClient(): Redis {
    return this.redis!;
  }

  /**
   * Execute cached query with automatic invalidation
   */
  async executeCachedQuery<T>(
    cacheKey: string,
    queryFn: () => Promise<T>,
    ttl: number = 300,
    useReadReplica: boolean = true
  ): Promise<T> {
    const redis = this.getRedisClient();
    
    try {
      // Try to get from cache first
      const cached = await redis.get(cacheKey);
      if (cached) {
        this.connectionMetrics.cacheHits++;
        return JSON.parse(cached);
      }
    } catch (error) {
      console.warn('Cache read error:', error);
    }

    this.connectionMetrics.cacheMisses++;

    // Execute query
    const result = await queryFn();

    // Cache the result
    try {
      await redis.setex(cacheKey, ttl, JSON.stringify(result));
    } catch (error) {
      console.warn('Cache write error:', error);
    }

    return result;
  }

  /**
   * Invalidate cache patterns
   */
  async invalidateCachePattern(pattern: string): Promise<void> {
    const redis = this.getRedisClient();
    
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      console.warn('Cache invalidation error:', error);
    }
  }

  /**
   * Health check for all connections
   */
  async healthCheck(): Promise<{
    prisma: boolean;
    postgres: boolean;
    redis: boolean;
    metrics: typeof this.connectionMetrics;
  }> {
    const health = {
      prisma: false,
      postgres: false,
      redis: false,
      metrics: { ...this.connectionMetrics }
    };

    // Check Prisma connection
    try {
      await this.prismaClient?.$queryRaw`SELECT 1`;
      health.prisma = true;
    } catch (error) {
      console.error('Prisma health check failed:', error);
    }

    // Check native PostgreSQL pool
    try {
      const client = await this.pgPool?.connect();
      await client?.query('SELECT 1');
      client?.release();
      health.postgres = true;
    } catch (error) {
      console.error('PostgreSQL health check failed:', error);
    }

    // Check Redis connection
    try {
      await this.redis?.ping();
      health.redis = true;
    } catch (error) {
      console.error('Redis health check failed:', error);
    }

    return health;
  }

  /**
   * Graceful shutdown of all connections
   */
  async shutdown(): Promise<void> {
    const promises: Promise<void>[] = [];

    if (this.prismaClient) {
      promises.push(this.prismaClient.$disconnect());
    }

    if (this.readReplicaClient) {
      promises.push(this.readReplicaClient.$disconnect());
    }

    if (this.pgPool) {
      promises.push(this.pgPool.end());
    }

    if (this.redis) {
      promises.push(this.redis.quit());
    }

    await Promise.all(promises);
    console.log('All database connections closed');
  }

  /**
   * Build optimized connection string
   */
  private buildConnectionString(type: 'read' | 'write', config: any): string {
    const baseUrl = type === 'read' && process.env.DATABASE_READ_URL 
      ? process.env.DATABASE_READ_URL 
      : process.env.DATABASE_URL;

    if (!baseUrl) {
      throw new Error('Database URL not configured');
    }

    // Add connection pooling parameters
    const url = new URL(baseUrl);
    url.searchParams.set('connection_limit', config.maxConnections.toString());
    url.searchParams.set('pool_timeout', (config.connectionTimeout / 1000).toString());
    url.searchParams.set('statement_cache_size', '100');
    url.searchParams.set('prepared_statement_cache_size', '100');
    
    // Performance optimizations
    url.searchParams.set('pgbouncer', 'true');
    url.searchParams.set('connect_timeout', '10');
    url.searchParams.set('socket_timeout', '30');
    
    return url.toString();
  }

  /**
   * Get connection metrics for monitoring
   */
  getMetrics(): typeof this.connectionMetrics {
    return { ...this.connectionMetrics };
  }

  /**
   * Reset metrics (useful for periodic reporting)
   */
  resetMetrics(): void {
    this.connectionMetrics = {
      activeConnections: this.connectionMetrics.activeConnections, // Keep current count
      totalQueries: 0,
      slowQueries: 0,
      errors: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }
}

// Export singleton instance
export const dbManager = DatabaseConnectionManager.getInstance();

// Convenience exports
export const getPrismaClient = () => dbManager.getWriteClient();
export const getReadClient = () => dbManager.getReadClient();
export const getNativePool = () => dbManager.getNativePool();
export const getRedisClient = () => dbManager.getRedisClient();

// Initialize connections on module load
export async function initializeDatabaseConnections() {
  try {
    await dbManager.initializePrisma();
    await dbManager.initializeNativePool();
    await dbManager.initializeRedis();
    console.log('Database connections initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database connections:', error);
    throw error;
  }
}

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  console.log('Shutting down database connections...');
  await dbManager.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Shutting down database connections...');
  await dbManager.shutdown();
  process.exit(0);
});

export default dbManager;