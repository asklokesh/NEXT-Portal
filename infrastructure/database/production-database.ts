/**
 * Production Database Configuration with Connection Pooling and Monitoring
 * Supports PostgreSQL with read replicas, connection pooling, and health monitoring
 */

import { Pool, PoolConfig } from 'pg';
import { PrismaClient } from '@prisma/client';
import winston from 'winston';
import { EventEmitter } from 'events';

interface DatabaseConfig {
  primary: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
  replicas?: Array<{
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    weight?: number; // Load balancing weight
  }>;
  pool: {
    min: number;
    max: number;
    acquireTimeoutMillis: number;
    createTimeoutMillis: number;
    destroyTimeoutMillis: number;
    idleTimeoutMillis: number;
    reapIntervalMillis: number;
    createRetryIntervalMillis: number;
  };
  ssl?: {
    rejectUnauthorized: boolean;
    ca?: string;
    cert?: string;
    key?: string;
  };
  monitoring: {
    enabled: boolean;
    metricsInterval: number;
    slowQueryThreshold: number;
    connectionCheckInterval: number;
  };
}

interface DatabaseMetrics {
  timestamp: Date;
  primary: ConnectionMetrics;
  replicas: Record<string, ConnectionMetrics>;
  queries: QueryMetrics;
  performance: PerformanceMetrics;
}

interface ConnectionMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingConnections: number;
  maxConnections: number;
  connectionErrors: number;
  lastError?: string;
}

interface QueryMetrics {
  totalQueries: number;
  slowQueries: number;
  errorQueries: number;
  avgQueryTime: number;
  maxQueryTime: number;
  recentQueries: Array<{
    query: string;
    duration: number;
    timestamp: Date;
  }>;
}

interface PerformanceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  lockWaits: number;
  bufferHitRatio: number;
  activeTransactions: number;
}

export class ProductionDatabaseManager extends EventEmitter {
  private config: DatabaseConfig;
  private logger: winston.Logger;
  private primaryPool: Pool;
  private replicaPools: Pool[] = [];
  private prismaClient: PrismaClient;
  private metrics: DatabaseMetrics[] = [];
  private monitoringInterval?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(config: DatabaseConfig) {
    super();
    this.config = config;
    this.setupLogger();
    this.setupConnections();
    this.setupPrisma();
  }

  private setupLogger() {
    this.logger = winston.createLogger({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'database-manager' },
      transports: [
        new winston.transports.File({ filename: 'logs/database-error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/database-combined.log' }),
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ],
    });
  }

  private setupConnections() {
    // Primary database connection pool
    const primaryPoolConfig: PoolConfig = {
      host: this.config.primary.host,
      port: this.config.primary.port,
      database: this.config.primary.database,
      user: this.config.primary.user,
      password: this.config.primary.password,
      ssl: this.config.ssl,
      ...this.config.pool,
      application_name: 'saas-idp-primary',
    };

    this.primaryPool = new Pool(primaryPoolConfig);
    this.setupPoolEventHandlers(this.primaryPool, 'primary');

    // Read replica connection pools
    if (this.config.replicas) {
      this.config.replicas.forEach((replica, index) => {
        const replicaPoolConfig: PoolConfig = {
          host: replica.host,
          port: replica.port,
          database: replica.database,
          user: replica.user,
          password: replica.password,
          ssl: this.config.ssl,
          ...this.config.pool,
          application_name: `saas-idp-replica-${index}`,
        };

        const replicaPool = new Pool(replicaPoolConfig);
        this.setupPoolEventHandlers(replicaPool, `replica-${index}`);
        this.replicaPools.push(replicaPool);
      });
    }

    this.logger.info('Database connections configured', {
      primary: `${this.config.primary.host}:${this.config.primary.port}`,
      replicas: this.config.replicas?.length || 0
    });
  }

  private setupPoolEventHandlers(pool: Pool, poolName: string) {
    pool.on('connect', (client) => {
      this.logger.debug('Database connection established', { pool: poolName });
    });

    pool.on('acquire', (client) => {
      this.logger.debug('Database connection acquired', { pool: poolName });
    });

    pool.on('remove', (client) => {
      this.logger.debug('Database connection removed', { pool: poolName });
    });

    pool.on('error', (err, client) => {
      this.logger.error('Database pool error', { 
        pool: poolName, 
        error: err.message,
        stack: err.stack 
      });
      this.emit('error', { pool: poolName, error: err });
    });
  }

  private setupPrisma() {
    this.prismaClient = new PrismaClient({
      datasources: {
        db: {
          url: this.buildPrismaConnectionString(this.config.primary)
        }
      },
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'event' },
        { level: 'info', emit: 'event' },
        { level: 'warn', emit: 'event' },
      ],
    });

    // Log slow queries
    this.prismaClient.$on('query', (e) => {
      if (e.duration > this.config.monitoring.slowQueryThreshold) {
        this.logger.warn('Slow query detected', {
          query: e.query,
          duration: e.duration,
          params: e.params
        });
      }
    });

    this.prismaClient.$on('error', (e) => {
      this.logger.error('Prisma error', { error: e });
    });
  }

  private buildPrismaConnectionString(dbConfig: any): string {
    const { host, port, database, user, password } = dbConfig;
    const sslParam = this.config.ssl ? '?sslmode=require' : '';
    return `postgresql://${user}:${password}@${host}:${port}/${database}${sslParam}`;
  }

  async initialize() {
    this.logger.info('Initializing database manager');

    try {
      // Test primary connection
      await this.testConnection(this.primaryPool, 'primary');

      // Test replica connections
      for (let i = 0; i < this.replicaPools.length; i++) {
        await this.testConnection(this.replicaPools[i], `replica-${i}`);
      }

      // Test Prisma connection
      await this.prismaClient.$connect();
      this.logger.info('Prisma client connected successfully');

      if (this.config.monitoring.enabled) {
        this.startMonitoring();
      }

      this.logger.info('Database manager initialized successfully');
      this.emit('ready');

    } catch (error) {
      this.logger.error('Failed to initialize database manager', { error: error.message });
      throw error;
    }
  }

  private async testConnection(pool: Pool, poolName: string) {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT NOW()');
      this.logger.info('Database connection test successful', {
        pool: poolName,
        timestamp: result.rows[0].now
      });
    } finally {
      client.release();
    }
  }

  private startMonitoring() {
    this.logger.info('Starting database monitoring');

    // Metrics collection
    this.monitoringInterval = setInterval(async () => {
      await this.collectMetrics();
    }, this.config.monitoring.metricsInterval);

    // Health checks
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.monitoring.connectionCheckInterval);
  }

  private async collectMetrics() {
    try {
      const metrics: DatabaseMetrics = {
        timestamp: new Date(),
        primary: await this.getConnectionMetrics(this.primaryPool),
        replicas: {},
        queries: await this.getQueryMetrics(),
        performance: await this.getPerformanceMetrics()
      };

      // Collect replica metrics
      for (let i = 0; i < this.replicaPools.length; i++) {
        const replicaName = `replica-${i}`;
        metrics.replicas[replicaName] = await this.getConnectionMetrics(this.replicaPools[i]);
      }

      this.metrics.push(metrics);
      
      // Keep only last 24 hours of metrics
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      this.metrics = this.metrics.filter(m => m.timestamp.getTime() > oneDayAgo);

      this.emit('metrics', metrics);

      this.logger.debug('Database metrics collected', {
        primaryConnections: metrics.primary.activeConnections,
        totalQueries: metrics.queries.totalQueries,
        slowQueries: metrics.queries.slowQueries
      });

    } catch (error) {
      this.logger.error('Error collecting database metrics', { error: error.message });
    }
  }

  private async getConnectionMetrics(pool: Pool): Promise<ConnectionMetrics> {
    return {
      totalConnections: pool.totalCount,
      activeConnections: pool.totalCount - pool.idleCount,
      idleConnections: pool.idleCount,
      waitingConnections: pool.waitingCount,
      maxConnections: this.config.pool.max,
      connectionErrors: 0, // Would need to track this separately
    };
  }

  private async getQueryMetrics(): Promise<QueryMetrics> {
    // This would typically come from PostgreSQL stats or application-level tracking
    return {
      totalQueries: 0,
      slowQueries: 0,
      errorQueries: 0,
      avgQueryTime: 0,
      maxQueryTime: 0,
      recentQueries: []
    };
  }

  private async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    try {
      const client = await this.primaryPool.connect();
      try {
        // Get database performance statistics
        const statsQuery = `
          SELECT 
            (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections,
            (SELECT count(*) FROM pg_stat_activity) as active_connections,
            (SELECT count(*) FROM pg_locks WHERE granted = false) as lock_waits,
            (SELECT round(blks_hit*100.0/(blks_hit+blks_read), 2) FROM pg_stat_database WHERE datname = current_database()) as buffer_hit_ratio,
            (SELECT count(*) FROM pg_stat_activity WHERE state = 'active' AND query NOT LIKE '%pg_stat_activity%') as active_queries
        `;

        const result = await client.query(statsQuery);
        const stats = result.rows[0];

        return {
          cpuUsage: 0, // Would need system-level monitoring
          memoryUsage: 0, // Would need system-level monitoring
          diskUsage: 0, // Would need system-level monitoring
          lockWaits: parseInt(stats.lock_waits),
          bufferHitRatio: parseFloat(stats.buffer_hit_ratio),
          activeTransactions: parseInt(stats.active_queries)
        };
      } finally {
        client.release();
      }
    } catch (error) {
      this.logger.error('Error getting performance metrics', { error: error.message });
      return {
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        lockWaits: 0,
        bufferHitRatio: 0,
        activeTransactions: 0
      };
    }
  }

  private async performHealthChecks() {
    try {
      // Check primary database
      await this.checkDatabaseHealth(this.primaryPool, 'primary');

      // Check replica databases
      for (let i = 0; i < this.replicaPools.length; i++) {
        await this.checkDatabaseHealth(this.replicaPools[i], `replica-${i}`);
      }

    } catch (error) {
      this.logger.error('Health check failed', { error: error.message });
      this.emit('healthCheckFailed', error);
    }
  }

  private async checkDatabaseHealth(pool: Pool, poolName: string) {
    const client = await pool.connect();
    try {
      const start = Date.now();
      await client.query('SELECT 1');
      const responseTime = Date.now() - start;

      if (responseTime > 5000) { // 5 seconds threshold
        this.logger.warn('Database response time high', {
          pool: poolName,
          responseTime
        });
        this.emit('slowResponse', { pool: poolName, responseTime });
      }

    } catch (error) {
      this.logger.error('Database health check failed', {
        pool: poolName,
        error: error.message
      });
      this.emit('healthCheckFailed', { pool: poolName, error });
    } finally {
      client.release();
    }
  }

  // Public methods for database operations
  public async executeQuery(query: string, params?: any[], useReplica: boolean = false) {
    const pool = useReplica && this.replicaPools.length > 0 
      ? this.getRandomReplica() 
      : this.primaryPool;

    const client = await pool.connect();
    try {
      const start = Date.now();
      const result = await client.query(query, params);
      const duration = Date.now() - start;

      if (duration > this.config.monitoring.slowQueryThreshold) {
        this.logger.warn('Slow query executed', { query, duration, params });
      }

      return result;
    } finally {
      client.release();
    }
  }

  public async executeTransaction(queries: Array<{ query: string; params?: any[] }>) {
    const client = await this.primaryPool.connect();
    try {
      await client.query('BEGIN');
      
      const results = [];
      for (const { query, params } of queries) {
        const result = await client.query(query, params);
        results.push(result);
      }
      
      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private getRandomReplica(): Pool {
    if (this.replicaPools.length === 0) {
      return this.primaryPool;
    }

    // Simple random selection - could be enhanced with weighted load balancing
    const randomIndex = Math.floor(Math.random() * this.replicaPools.length);
    return this.replicaPools[randomIndex];
  }

  public getPrismaClient(): PrismaClient {
    return this.prismaClient;
  }

  public getLatestMetrics(): DatabaseMetrics | null {
    return this.metrics[this.metrics.length - 1] || null;
  }

  public getMetricsHistory(hours: number = 1): DatabaseMetrics[] {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    return this.metrics.filter(m => m.timestamp.getTime() > cutoff);
  }

  public async getHealthStatus() {
    try {
      await this.testConnection(this.primaryPool, 'primary');
      
      const metrics = this.getLatestMetrics();
      const activeConnections = metrics?.primary.activeConnections || 0;
      const maxConnections = this.config.pool.max;
      
      const connectionUtilization = activeConnections / maxConnections;
      
      if (connectionUtilization > 0.9) {
        return {
          status: 'degraded',
          reason: 'High connection utilization',
          utilization: connectionUtilization
        };
      }

      return {
        status: 'healthy',
        activeConnections,
        replicas: this.replicaPools.length,
        utilization: connectionUtilization
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        reason: error.message
      };
    }
  }

  public async shutdown() {
    this.logger.info('Shutting down database manager');

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Close Prisma connection
    await this.prismaClient.$disconnect();

    // Close all pool connections
    await this.primaryPool.end();
    
    for (const replicaPool of this.replicaPools) {
      await replicaPool.end();
    }

    this.logger.info('Database manager shut down successfully');
  }
}

// Default configuration factory
export function createProductionDatabaseConfig(): DatabaseConfig {
  return {
    primary: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'saas_idp',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
    },
    replicas: process.env.DB_REPLICA_HOSTS ? 
      process.env.DB_REPLICA_HOSTS.split(',').map(host => ({
        host,
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'saas_idp',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
      })) : undefined,
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || '5'),
      max: parseInt(process.env.DB_POOL_MAX || '20'),
      acquireTimeoutMillis: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '60000'),
      createTimeoutMillis: parseInt(process.env.DB_CREATE_TIMEOUT || '30000'),
      destroyTimeoutMillis: parseInt(process.env.DB_DESTROY_TIMEOUT || '5000'),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '300000'),
      reapIntervalMillis: parseInt(process.env.DB_REAP_INTERVAL || '1000'),
      createRetryIntervalMillis: parseInt(process.env.DB_RETRY_INTERVAL || '2000'),
    },
    ssl: process.env.DB_SSL_ENABLED === 'true' ? {
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
      ca: process.env.DB_SSL_CA,
      cert: process.env.DB_SSL_CERT,
      key: process.env.DB_SSL_KEY,
    } : undefined,
    monitoring: {
      enabled: process.env.DB_MONITORING_ENABLED !== 'false',
      metricsInterval: parseInt(process.env.DB_METRICS_INTERVAL || '30000'),
      slowQueryThreshold: parseInt(process.env.DB_SLOW_QUERY_THRESHOLD || '1000'),
      connectionCheckInterval: parseInt(process.env.DB_HEALTH_CHECK_INTERVAL || '60000'),
    },
  };
}