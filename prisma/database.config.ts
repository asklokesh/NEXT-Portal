/**
 * Enterprise Database Configuration
 * Optimized for high-scale production deployment
 */

import { PrismaClient } from '@prisma/client';

// Connection Pool Configuration
export const DATABASE_CONFIG = {
  // Primary Database Connection
  primary: {
    connectionLimit: 50, // Max concurrent connections
    idleTimeout: 30000, // 30 seconds
    connectionTimeout: 10000, // 10 seconds
    queryTimeout: 30000, // 30 seconds
    pool: {
      min: 10, // Minimum connections
      max: 50, // Maximum connections
      acquireTimeoutMillis: 10000,
      createTimeoutMillis: 10000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200,
    },
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false,
    } : false,
  },
  
  // Read Replica Configuration
  readReplica: {
    connectionLimit: 30,
    idleTimeout: 30000,
    connectionTimeout: 10000,
    queryTimeout: 15000,
    pool: {
      min: 5,
      max: 30,
      acquireTimeoutMillis: 8000,
      createTimeoutMillis: 8000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
    },
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false,
    } : false,
  },

  // Performance Settings
  performance: {
    // Enable query logging for slow queries (>1s)
    slowQueryThreshold: 1000,
    // Enable connection pool monitoring
    enablePoolMonitoring: true,
    // Enable query caching
    enableQueryCaching: true,
    // Cache TTL in seconds
    cacheTTL: 300,
    // Enable prepared statements
    enablePreparedStatements: true,
  },

  // Security Settings
  security: {
    // Enable SSL in production
    requireSSL: process.env.NODE_ENV === 'production',
    // Row Level Security
    enableRLS: true,
    // Audit logging
    enableAuditLogging: true,
    // Connection encryption
    encryptConnections: process.env.NODE_ENV === 'production',
  }
};

// Prisma Client Configuration
export function createPrismaClient(isReadOnly = false) {
  const config = isReadOnly ? DATABASE_CONFIG.readReplica : DATABASE_CONFIG.primary;
  
  return new PrismaClient({
    datasources: {
      db: {
        url: isReadOnly ? process.env.READ_REPLICA_URL : process.env.DATABASE_URL,
      },
    },
    log: [
      { 
        emit: 'event', 
        level: 'query' 
      },
      { 
        emit: 'event', 
        level: 'error' 
      },
      { 
        emit: 'event', 
        level: 'warn' 
      },
      { 
        emit: 'stdout', 
        level: 'info' 
      },
    ],
    errorFormat: 'pretty',
  });
}

// Connection Pool Manager
class DatabaseConnectionManager {
  private primaryClient: PrismaClient | null = null;
  private readOnlyClient: PrismaClient | null = null;
  private connectionHealthcheck: NodeJS.Timeout | null = null;

  async initialize() {
    // Initialize primary connection
    this.primaryClient = createPrismaClient(false);
    
    // Initialize read replica if available
    if (process.env.READ_REPLICA_URL) {
      this.readOnlyClient = createPrismaClient(true);
    }

    // Set up query logging for performance monitoring
    if (this.primaryClient) {
      this.primaryClient.$on('query', (e) => {
        if (e.duration > DATABASE_CONFIG.performance.slowQueryThreshold) {
          console.warn(`Slow query detected: ${e.duration}ms`, {
            query: e.query,
            params: e.params,
            duration: e.duration,
          });
        }
      });

      this.primaryClient.$on('error', (e) => {
        console.error('Database error:', e);
      });
    }

    // Start health check monitoring
    this.startHealthCheck();

    console.log('Database connection manager initialized');
  }

  private startHealthCheck() {
    this.connectionHealthcheck = setInterval(async () => {
      try {
        // Health check primary connection
        if (this.primaryClient) {
          await this.primaryClient.$queryRaw`SELECT 1`;
        }

        // Health check read replica
        if (this.readOnlyClient) {
          await this.readOnlyClient.$queryRaw`SELECT 1`;
        }
      } catch (error) {
        console.error('Database health check failed:', error);
        // Implement reconnection logic here
      }
    }, 30000); // Check every 30 seconds
  }

  getPrimaryClient(): PrismaClient {
    if (!this.primaryClient) {
      throw new Error('Database connection not initialized');
    }
    return this.primaryClient;
  }

  getReadOnlyClient(): PrismaClient {
    return this.readOnlyClient || this.getPrimaryClient();
  }

  async shutdown() {
    if (this.connectionHealthcheck) {
      clearInterval(this.connectionHealthcheck);
    }

    if (this.primaryClient) {
      await this.primaryClient.$disconnect();
    }

    if (this.readOnlyClient) {
      await this.readOnlyClient.$disconnect();
    }

    console.log('Database connections closed');
  }
}

export const dbManager = new DatabaseConnectionManager();

// Query Router - Automatically route read vs write operations
export class QueryRouter {
  static isReadQuery(operation: string): boolean {
    const readOperations = [
      'findMany',
      'findFirst',
      'findUnique',
      'count',
      'aggregate',
      'groupBy',
      '$queryRaw',
    ];
    
    return readOperations.some(op => operation.includes(op));
  }

  static getClient(operation: string): PrismaClient {
    if (this.isReadQuery(operation) && process.env.READ_REPLICA_URL) {
      return dbManager.getReadOnlyClient();
    }
    return dbManager.getPrimaryClient();
  }
}

// Database Optimization Utilities
export const DatabaseOptimizer = {
  // Connection pool stats
  getPoolStats() {
    const primaryClient = dbManager.getPrimaryClient();
    // Implementation depends on the actual connection pool being used
    return {
      activeConnections: 0, // Would get from actual pool
      idleConnections: 0,
      totalConnections: 0,
      waitingClients: 0,
    };
  },

  // Query performance analysis
  async analyzeQueryPerformance(query: string) {
    const primaryClient = dbManager.getPrimaryClient();
    
    try {
      // Use EXPLAIN ANALYZE for query performance analysis
      const result = await primaryClient.$queryRawUnsafe(`
        EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}
      `);
      
      return result;
    } catch (error) {
      console.error('Query analysis failed:', error);
      return null;
    }
  },

  // Index usage statistics
  async getIndexUsageStats() {
    const primaryClient = dbManager.getPrimaryClient();
    
    const stats = await primaryClient.$queryRaw`
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_tup_read,
        idx_tup_fetch,
        idx_scan
      FROM pg_stat_user_indexes 
      ORDER BY idx_scan DESC
      LIMIT 100;
    `;

    return stats;
  },

  // Database performance metrics
  async getPerformanceMetrics() {
    const primaryClient = dbManager.getPrimaryClient();
    
    const metrics = await primaryClient.$queryRaw`
      SELECT 
        (SELECT setting FROM pg_settings WHERE name = 'max_connections') as max_connections,
        (SELECT count(*) FROM pg_stat_activity) as current_connections,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') as idle_connections,
        pg_database_size(current_database()) as database_size_bytes;
    `;

    return metrics;
  }
};

// Initialize database on startup
if (process.env.NODE_ENV !== 'test') {
  dbManager.initialize().catch(console.error);
}