/**
 * Enterprise Database Performance Monitoring Service
 * Provides comprehensive database monitoring, alerting, and analytics
 */

import { PrismaClient } from '@prisma/client';
import { dbManager, DatabaseOptimizer } from '../../../prisma/database.config';

interface DatabaseMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  labels?: Record<string, string>;
}

interface SlowQuery {
  query: string;
  duration: number;
  timestamp: Date;
  params?: any;
  executionPlan?: any;
}

interface DatabaseHealth {
  status: 'healthy' | 'degraded' | 'critical';
  score: number; // 0-100
  metrics: {
    connectionUtilization: number;
    queryLatency: number;
    errorRate: number;
    cacheHitRatio: number;
    replicationLag?: number;
  };
  issues: Array<{
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    timestamp: Date;
  }>;
}

export class DatabaseMonitoringService {
  private prisma: PrismaClient;
  private slowQueries: SlowQuery[] = [];
  private metrics: DatabaseMetric[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private alertingEnabled: boolean = true;

  constructor() {
    this.prisma = dbManager.getPrimaryClient();
    this.startMonitoring();
  }

  // ===========================================
  // REAL-TIME MONITORING
  // ===========================================

  private startMonitoring() {
    // Collect metrics every 30 seconds
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
        await this.checkHealth();
        await this.cleanupOldData();
      } catch (error) {
        console.error('Database monitoring error:', error);
      }
    }, 30000);
  }

  async collectMetrics(): Promise<void> {
    const timestamp = new Date();

    try {
      // Connection pool metrics
      const poolStats = DatabaseOptimizer.getPoolStats();
      this.addMetric('db_connections_active', poolStats.activeConnections, 'count', timestamp);
      this.addMetric('db_connections_idle', poolStats.idleConnections, 'count', timestamp);
      this.addMetric('db_connections_total', poolStats.totalConnections, 'count', timestamp);
      this.addMetric('db_connections_waiting', poolStats.waitingClients, 'count', timestamp);

      // Performance metrics from pg_stat_database
      const dbStats = await this.prisma.$queryRaw<Array<{
        numbackends: number;
        xact_commit: bigint;
        xact_rollback: bigint;
        blks_read: bigint;
        blks_hit: bigint;
        tup_returned: bigint;
        tup_fetched: bigint;
        tup_inserted: bigint;
        tup_updated: bigint;
        tup_deleted: bigint;
        conflicts: bigint;
        temp_files: bigint;
        temp_bytes: bigint;
        deadlocks: bigint;
      }>>`
        SELECT 
          numbackends,
          xact_commit,
          xact_rollback,
          blks_read,
          blks_hit,
          tup_returned,
          tup_fetched,
          tup_inserted,
          tup_updated,
          tup_deleted,
          conflicts,
          temp_files,
          temp_bytes,
          deadlocks
        FROM pg_stat_database 
        WHERE datname = current_database();
      `;

      if (dbStats.length > 0) {
        const stats = dbStats[0];
        
        // Connection metrics
        this.addMetric('db_active_backends', stats.numbackends, 'count', timestamp);
        
        // Transaction metrics
        this.addMetric('db_transactions_committed', Number(stats.xact_commit), 'count', timestamp);
        this.addMetric('db_transactions_rolled_back', Number(stats.xact_rollback), 'count', timestamp);
        
        // I/O metrics
        const totalBlocks = Number(stats.blks_read) + Number(stats.blks_hit);
        const cacheHitRatio = totalBlocks > 0 ? (Number(stats.blks_hit) / totalBlocks) * 100 : 0;
        this.addMetric('db_cache_hit_ratio', cacheHitRatio, 'percentage', timestamp);
        this.addMetric('db_blocks_read', Number(stats.blks_read), 'count', timestamp);
        this.addMetric('db_blocks_hit', Number(stats.blks_hit), 'count', timestamp);
        
        // Data modification metrics
        this.addMetric('db_tuples_inserted', Number(stats.tup_inserted), 'count', timestamp);
        this.addMetric('db_tuples_updated', Number(stats.tup_updated), 'count', timestamp);
        this.addMetric('db_tuples_deleted', Number(stats.tup_deleted), 'count', timestamp);
        
        // Error metrics
        this.addMetric('db_conflicts', Number(stats.conflicts), 'count', timestamp);
        this.addMetric('db_deadlocks', Number(stats.deadlocks), 'count', timestamp);
        this.addMetric('db_temp_files', Number(stats.temp_files), 'count', timestamp);
        this.addMetric('db_temp_bytes', Number(stats.temp_bytes), 'bytes', timestamp);
      }

      // Query performance metrics from pg_stat_statements (if available)
      try {
        const slowQueries = await this.prisma.$queryRaw<Array<{
          query: string;
          calls: bigint;
          total_time: number;
          mean_time: number;
          max_time: number;
          rows: bigint;
        }>>`
          SELECT 
            query,
            calls,
            total_time,
            mean_time,
            max_time,
            rows
          FROM pg_stat_statements
          WHERE mean_time > 1000 -- queries slower than 1 second
          ORDER BY mean_time DESC
          LIMIT 10;
        `;

        this.addMetric('db_slow_queries_count', slowQueries.length, 'count', timestamp);
        
        if (slowQueries.length > 0) {
          const avgSlowQueryTime = slowQueries.reduce((sum, q) => sum + q.mean_time, 0) / slowQueries.length;
          this.addMetric('db_avg_slow_query_time', avgSlowQueryTime, 'milliseconds', timestamp);
        }
      } catch (error) {
        // pg_stat_statements extension might not be available
        console.log('pg_stat_statements not available, skipping slow query metrics');
      }

      // Replication lag (if read replica is configured)
      if (process.env.READ_REPLICA_URL) {
        try {
          const replicationLag = await this.getReplicationLag();
          if (replicationLag !== null) {
            this.addMetric('db_replication_lag', replicationLag, 'milliseconds', timestamp);
          }
        } catch (error) {
          console.warn('Failed to get replication lag:', error);
        }
      }

    } catch (error) {
      console.error('Failed to collect database metrics:', error);
    }
  }

  private async getReplicationLag(): Promise<number | null> {
    try {
      // This would need to be implemented based on your specific replication setup
      // For PostgreSQL streaming replication:
      const result = await this.prisma.$queryRaw<Array<{ lag_milliseconds: number }>>`
        SELECT EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp())) * 1000 as lag_milliseconds;
      `;

      return result.length > 0 ? result[0].lag_milliseconds : null;
    } catch (error) {
      return null;
    }
  }

  // ===========================================
  // HEALTH CHECKS
  // ===========================================

  async checkHealth(): Promise<DatabaseHealth> {
    const health: DatabaseHealth = {
      status: 'healthy',
      score: 100,
      metrics: {
        connectionUtilization: 0,
        queryLatency: 0,
        errorRate: 0,
        cacheHitRatio: 0,
      },
      issues: []
    };

    try {
      // Check connection utilization
      const poolStats = DatabaseOptimizer.getPoolStats();
      const connectionUtilization = (poolStats.activeConnections / poolStats.totalConnections) * 100;
      health.metrics.connectionUtilization = connectionUtilization;

      if (connectionUtilization > 90) {
        health.issues.push({
          severity: 'critical',
          message: `High connection utilization: ${connectionUtilization.toFixed(1)}%`,
          timestamp: new Date()
        });
        health.score -= 30;
      } else if (connectionUtilization > 75) {
        health.issues.push({
          severity: 'medium',
          message: `Moderate connection utilization: ${connectionUtilization.toFixed(1)}%`,
          timestamp: new Date()
        });
        health.score -= 15;
      }

      // Check query performance
      const recentMetrics = this.getRecentMetrics(5); // Last 5 minutes
      const avgQueryTime = this.getAverageMetric(recentMetrics, 'db_avg_slow_query_time');
      if (avgQueryTime !== null) {
        health.metrics.queryLatency = avgQueryTime;
        
        if (avgQueryTime > 10000) { // 10 seconds
          health.issues.push({
            severity: 'critical',
            message: `Very slow average query time: ${avgQueryTime.toFixed(0)}ms`,
            timestamp: new Date()
          });
          health.score -= 25;
        } else if (avgQueryTime > 5000) { // 5 seconds
          health.issues.push({
            severity: 'high',
            message: `Slow average query time: ${avgQueryTime.toFixed(0)}ms`,
            timestamp: new Date()
          });
          health.score -= 15;
        }
      }

      // Check cache hit ratio
      const cacheHitRatio = this.getAverageMetric(recentMetrics, 'db_cache_hit_ratio');
      if (cacheHitRatio !== null) {
        health.metrics.cacheHitRatio = cacheHitRatio;
        
        if (cacheHitRatio < 90) {
          health.issues.push({
            severity: 'medium',
            message: `Low cache hit ratio: ${cacheHitRatio.toFixed(1)}%`,
            timestamp: new Date()
          });
          health.score -= 10;
        }
      }

      // Check for deadlocks
      const deadlocks = this.getAverageMetric(recentMetrics, 'db_deadlocks');
      if (deadlocks !== null && deadlocks > 0) {
        health.issues.push({
          severity: 'high',
          message: `Deadlocks detected: ${deadlocks}`,
          timestamp: new Date()
        });
        health.score -= 20;
      }

      // Check replication lag
      const replicationLag = this.getAverageMetric(recentMetrics, 'db_replication_lag');
      if (replicationLag !== null) {
        health.metrics.replicationLag = replicationLag;
        
        if (replicationLag > 10000) { // 10 seconds
          health.issues.push({
            severity: 'critical',
            message: `High replication lag: ${replicationLag.toFixed(0)}ms`,
            timestamp: new Date()
          });
          health.score -= 20;
        } else if (replicationLag > 5000) { // 5 seconds
          health.issues.push({
            severity: 'medium',
            message: `Moderate replication lag: ${replicationLag.toFixed(0)}ms`,
            timestamp: new Date()
          });
          health.score -= 10;
        }
      }

      // Determine overall health status
      if (health.score >= 90) {
        health.status = 'healthy';
      } else if (health.score >= 70) {
        health.status = 'degraded';
      } else {
        health.status = 'critical';
      }

      // Trigger alerts if necessary
      if (this.alertingEnabled && (health.status === 'critical' || health.status === 'degraded')) {
        await this.triggerHealthAlert(health);
      }

    } catch (error) {
      health.status = 'critical';
      health.score = 0;
      health.issues.push({
        severity: 'critical',
        message: `Health check failed: ${error.message}`,
        timestamp: new Date()
      });
    }

    return health;
  }

  // ===========================================
  // SLOW QUERY ANALYSIS
  // ===========================================

  async captureSlowQuery(query: string, duration: number, params?: any): Promise<void> {
    const slowQuery: SlowQuery = {
      query,
      duration,
      timestamp: new Date(),
      params,
    };

    // Get execution plan for analysis
    try {
      slowQuery.executionPlan = await DatabaseOptimizer.analyzeQueryPerformance(query);
    } catch (error) {
      console.warn('Failed to get execution plan for slow query:', error);
    }

    this.slowQueries.push(slowQuery);

    // Keep only last 1000 slow queries
    if (this.slowQueries.length > 1000) {
      this.slowQueries = this.slowQueries.slice(-1000);
    }

    // Log slow query
    console.warn(`Slow query detected (${duration}ms):`, {
      query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
      duration,
      params: params ? JSON.stringify(params).substring(0, 100) : null,
    });

    // Trigger alert for very slow queries
    if (duration > 30000 && this.alertingEnabled) { // 30 seconds
      await this.triggerSlowQueryAlert(slowQuery);
    }
  }

  getSlowQueries(limit: number = 100): SlowQuery[] {
    return this.slowQueries
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  // ===========================================
  // ALERTING
  // ===========================================

  private async triggerHealthAlert(health: DatabaseHealth): Promise<void> {
    const alert = {
      type: 'database_health',
      severity: health.status === 'critical' ? 'critical' : 'warning',
      message: `Database health is ${health.status} (score: ${health.score}/100)`,
      details: {
        health,
        timestamp: new Date(),
      }
    };

    // Store alert in database
    try {
      await this.prisma.alert.create({
        data: {
          name: 'Database Health Alert',
          severity: alert.severity,
          source: 'database-monitoring',
          message: alert.message,
          fingerprint: `db-health-${health.status}`,
          status: 'open',
          metadata: alert.details,
        }
      });
    } catch (error) {
      console.error('Failed to store database health alert:', error);
    }

    // You would integrate with your notification system here
    console.error('DATABASE HEALTH ALERT:', alert);
  }

  private async triggerSlowQueryAlert(slowQuery: SlowQuery): Promise<void> {
    const alert = {
      type: 'slow_query',
      severity: 'warning',
      message: `Very slow query detected: ${slowQuery.duration}ms`,
      details: {
        query: slowQuery.query.substring(0, 500),
        duration: slowQuery.duration,
        timestamp: slowQuery.timestamp,
      }
    };

    try {
      await this.prisma.alert.create({
        data: {
          name: 'Slow Query Alert',
          severity: 'WARNING',
          source: 'database-monitoring',
          message: alert.message,
          fingerprint: `slow-query-${Date.now()}`,
          status: 'open',
          metadata: alert.details,
        }
      });
    } catch (error) {
      console.error('Failed to store slow query alert:', error);
    }

    console.warn('SLOW QUERY ALERT:', alert);
  }

  // ===========================================
  // METRICS HELPERS
  // ===========================================

  private addMetric(name: string, value: number, unit: string, timestamp: Date, labels?: Record<string, string>): void {
    this.metrics.push({
      name,
      value,
      unit,
      timestamp,
      labels,
    });

    // Keep only last 10000 metrics (about 5 hours at 30s intervals)
    if (this.metrics.length > 10000) {
      this.metrics = this.metrics.slice(-10000);
    }
  }

  private getRecentMetrics(minutesAgo: number): DatabaseMetric[] {
    const cutoff = new Date(Date.now() - minutesAgo * 60 * 1000);
    return this.metrics.filter(m => m.timestamp > cutoff);
  }

  private getAverageMetric(metrics: DatabaseMetric[], metricName: string): number | null {
    const relevantMetrics = metrics.filter(m => m.name === metricName);
    if (relevantMetrics.length === 0) return null;
    
    const sum = relevantMetrics.reduce((acc, m) => acc + m.value, 0);
    return sum / relevantMetrics.length;
  }

  // ===========================================
  // PUBLIC API
  // ===========================================

  async getPerformanceMetrics(timeRange: 'hour' | 'day' | 'week' = 'hour'): Promise<DatabaseMetric[]> {
    const minutes = timeRange === 'hour' ? 60 : timeRange === 'day' ? 1440 : 10080;
    return this.getRecentMetrics(minutes);
  }

  async getDashboardData() {
    const health = await this.checkHealth();
    const recentMetrics = this.getRecentMetrics(60); // Last hour
    const slowQueries = this.getSlowQueries(10);

    return {
      health,
      metrics: {
        connectionUtilization: this.getAverageMetric(recentMetrics, 'db_connections_active'),
        cacheHitRatio: this.getAverageMetric(recentMetrics, 'db_cache_hit_ratio'),
        avgQueryTime: this.getAverageMetric(recentMetrics, 'db_avg_slow_query_time'),
        replicationLag: this.getAverageMetric(recentMetrics, 'db_replication_lag'),
        transactionsPerSecond: this.getAverageMetric(recentMetrics, 'db_transactions_committed'),
      },
      slowQueries,
      indexUsage: await DatabaseOptimizer.getIndexUsageStats(),
    };
  }

  private async cleanupOldData(): Promise<void> {
    // Clean up old metrics (keep last 24 hours in memory)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.metrics = this.metrics.filter(m => m.timestamp > oneDayAgo);

    // Clean up old slow queries (keep last 24 hours)
    this.slowQueries = this.slowQueries.filter(q => q.timestamp > oneDayAgo);
  }

  async stop(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }
}

// Singleton instance
export const databaseMonitoring = new DatabaseMonitoringService();