/**
 * Analytics Data Structure Optimizer
 * Optimized data models and queries for high-volume analytics workloads
 */

import { PrismaClient } from '@prisma/client';
import { dbManager } from '../../../prisma/database.config';

interface TimeSeriesQuery {
  metric: string;
  aggregation: 'avg' | 'sum' | 'min' | 'max' | 'count';
  interval: '1m' | '5m' | '15m' | '1h' | '6h' | '24h';
  timeRange: {
    start: Date;
    end: Date;
  };
  filters?: Record<string, any>;
  groupBy?: string[];
}

interface AnalyticsAggregation {
  timestamp: Date;
  value: number;
  labels?: Record<string, string>;
}

interface MetricDataPoint {
  id: string;
  source: string;
  timestamp: Date;
  value: number;
  labels: Record<string, any>;
}

interface AnalyticsReport {
  metric: string;
  period: string;
  data: AnalyticsAggregation[];
  metadata: {
    totalDataPoints: number;
    aggregationMethod: string;
    queryTime: number;
  };
}

export class AnalyticsOptimizerService {
  private prisma: PrismaClient;
  private readOnlyPrisma: PrismaClient;
  private aggregationCache: Map<string, { data: any; expiry: Date }> = new Map();

  constructor() {
    this.prisma = dbManager.getPrimaryClient();
    this.readOnlyPrisma = dbManager.getReadOnlyClient();
    
    // Clean up cache every hour
    setInterval(() => this.cleanupCache(), 60 * 60 * 1000);
  }

  // ===========================================
  // TIME-SERIES DATA OPTIMIZATION
  // ===========================================

  /**
   * Optimized time-series metric query with automatic aggregation
   */
  async queryTimeSeriesMetrics(query: TimeSeriesQuery): Promise<AnalyticsReport> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(query);
    
    // Check cache first for expensive aggregations
    if (this.shouldUseCache(query)) {
      const cached = this.aggregationCache.get(cacheKey);
      if (cached && cached.expiry > new Date()) {
        return cached.data;
      }
    }

    try {
      const intervalSeconds = this.getIntervalSeconds(query.interval);
      const data = await this.executeTimeSeriesQuery(query, intervalSeconds);
      
      const report: AnalyticsReport = {
        metric: query.metric,
        period: `${query.timeRange.start.toISOString()}_${query.timeRange.end.toISOString()}`,
        data,
        metadata: {
          totalDataPoints: data.length,
          aggregationMethod: query.aggregation,
          queryTime: Date.now() - startTime,
        }
      };

      // Cache expensive queries
      if (this.shouldUseCache(query)) {
        const cacheExpiry = new Date(Date.now() + this.getCacheDuration(query.interval));
        this.aggregationCache.set(cacheKey, { data: report, expiry: cacheExpiry });
      }

      return report;
    } catch (error) {
      console.error('Time series query failed:', error);
      throw new Error(`Failed to query time series data: ${error.message}`);
    }
  }

  private async executeTimeSeriesQuery(
    query: TimeSeriesQuery, 
    intervalSeconds: number
  ): Promise<AnalyticsAggregation[]> {
    const { metric, aggregation, timeRange, filters, groupBy } = query;

    // Build the SQL query with time bucketing and aggregation
    const timeGrouping = `
      date_trunc('hour', timestamp) + 
      (INTERVAL '${intervalSeconds} seconds') * 
      FLOOR(EXTRACT(EPOCH FROM timestamp - date_trunc('hour', timestamp)) / ${intervalSeconds})
    `;

    let selectClause = `
      ${timeGrouping} as bucket_timestamp,
      ${this.getAggregationFunction(aggregation)}(value) as aggregated_value
    `;

    let groupByClause = `GROUP BY bucket_timestamp`;

    // Add group by labels if specified
    if (groupBy && groupBy.length > 0) {
      const labelGroupBy = groupBy.map(field => `labels->>'${field}'`).join(', ');
      selectClause += `, ${labelGroupBy}`;
      groupByClause += `, ${labelGroupBy}`;
    }

    // Build WHERE clause
    let whereClause = `
      timestamp >= $1 AND timestamp <= $2
      AND source = $3
    `;
    const params = [timeRange.start, timeRange.end, metric];

    // Add filters
    if (filters) {
      let paramIndex = 4;
      for (const [key, value] of Object.entries(filters)) {
        whereClause += ` AND labels->>'${key}' = $${paramIndex}`;
        params.push(value);
        paramIndex++;
      }
    }

    const sql = `
      SELECT ${selectClause}
      FROM metric_data_points
      WHERE ${whereClause}
      ${groupByClause}
      ORDER BY bucket_timestamp ASC
    `;

    const result = await this.readOnlyPrisma.$queryRawUnsafe(sql, ...params);

    return (result as any[]).map(row => ({
      timestamp: row.bucket_timestamp,
      value: parseFloat(row.aggregated_value),
      labels: groupBy ? this.extractLabels(row, groupBy) : undefined
    }));
  }

  // ===========================================
  // PLUGIN ANALYTICS OPTIMIZATION
  // ===========================================

  /**
   * High-performance plugin analytics aggregation
   */
  async getPluginAnalyticsSummary(
    tenantId?: string,
    timeRange: 'hour' | 'day' | 'week' | 'month' = 'day'
  ) {
    const endTime = new Date();
    const startTime = new Date();
    
    switch (timeRange) {
      case 'hour':
        startTime.setHours(endTime.getHours() - 1);
        break;
      case 'day':
        startTime.setDate(endTime.getDate() - 1);
        break;
      case 'week':
        startTime.setDate(endTime.getDate() - 7);
        break;
      case 'month':
        startTime.setMonth(endTime.getMonth() - 1);
        break;
    }

    // Use optimized aggregation queries
    const [
      eventCounts,
      performanceMetrics,
      errorAnalysis,
      usagePatterns
    ] = await Promise.all([
      this.getEventCounts(startTime, endTime, tenantId),
      this.getPerformanceMetrics(startTime, endTime, tenantId),
      this.getErrorAnalysis(startTime, endTime, tenantId),
      this.getUsagePatterns(startTime, endTime, tenantId)
    ]);

    return {
      timeRange: { start: startTime, end: endTime },
      eventCounts,
      performanceMetrics,
      errorAnalysis,
      usagePatterns,
      generatedAt: new Date()
    };
  }

  private async getEventCounts(startTime: Date, endTime: Date, tenantId?: string) {
    const whereClause = tenantId ? 
      { tenantId, timestamp: { gte: startTime, lte: endTime } } :
      { timestamp: { gte: startTime, lte: endTime } };

    const eventCounts = await this.readOnlyPrisma.pluginAnalytics.groupBy({
      by: ['event', 'pluginId'],
      where: whereClause,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } }
    });

    // Process into structured format
    const summary: Record<string, number> = {};
    const pluginBreakdown: Record<string, Record<string, number>> = {};

    eventCounts.forEach(item => {
      // Event summary
      summary[item.event] = (summary[item.event] || 0) + item._count.id;
      
      // Plugin breakdown
      if (!pluginBreakdown[item.pluginId]) {
        pluginBreakdown[item.pluginId] = {};
      }
      pluginBreakdown[item.pluginId][item.event] = item._count.id;
    });

    return {
      summary,
      pluginBreakdown,
      totalEvents: Object.values(summary).reduce((sum, count) => sum + count, 0)
    };
  }

  private async getPerformanceMetrics(startTime: Date, endTime: Date, tenantId?: string) {
    // Get performance metrics with statistical aggregations
    const performanceData = await this.readOnlyPrisma.pluginPerformance.groupBy({
      by: ['pluginId', 'metricType'],
      where: {
        timestamp: { gte: startTime, lte: endTime },
        ...(tenantId && { plugin: { tenantId } })
      },
      _avg: { value: true },
      _min: { value: true },
      _max: { value: true },
      _count: { value: true }
    });

    const metrics: Record<string, any> = {};
    
    performanceData.forEach(item => {
      const key = `${item.pluginId}_${item.metricType}`;
      metrics[key] = {
        pluginId: item.pluginId,
        metricType: item.metricType,
        avg: item._avg.value,
        min: item._min.value,
        max: item._max.value,
        count: item._count.value
      };
    });

    return metrics;
  }

  private async getErrorAnalysis(startTime: Date, endTime: Date, tenantId?: string) {
    // Analyze error patterns and trends
    const errorData = await this.readOnlyPrisma.pluginAnalytics.groupBy({
      by: ['pluginId', 'errorCode'],
      where: {
        timestamp: { gte: startTime, lte: endTime },
        event: 'ERROR',
        errorCode: { not: null },
        ...(tenantId && { tenantId })
      },
      _count: { id: true }
    });

    const errorSummary: Record<string, { count: number; plugins: Set<string> }> = {};
    const pluginErrors: Record<string, number> = {};

    errorData.forEach(item => {
      const errorCode = item.errorCode!;
      
      // Error code summary
      if (!errorSummary[errorCode]) {
        errorSummary[errorCode] = { count: 0, plugins: new Set() };
      }
      errorSummary[errorCode].count += item._count.id;
      errorSummary[errorCode].plugins.add(item.pluginId);
      
      // Plugin error count
      pluginErrors[item.pluginId] = (pluginErrors[item.pluginId] || 0) + item._count.id;
    });

    return {
      errorSummary: Object.entries(errorSummary).map(([code, data]) => ({
        errorCode: code,
        count: data.count,
        affectedPlugins: data.plugins.size
      })),
      pluginErrors,
      totalErrors: Object.values(pluginErrors).reduce((sum, count) => sum + count, 0)
    };
  }

  private async getUsagePatterns(startTime: Date, endTime: Date, tenantId?: string) {
    // Analyze usage patterns by time of day and geography
    const usageData = await this.readOnlyPrisma.pluginAnalytics.findMany({
      where: {
        timestamp: { gte: startTime, lte: endTime },
        event: { in: ['VIEW', 'USER_INTERACTION', 'API_CALL'] },
        ...(tenantId && { tenantId })
      },
      select: {
        timestamp: true,
        country: true,
        pluginId: true,
        event: true,
        userId: true
      }
    });

    // Process usage patterns
    const hourlyUsage: Record<number, number> = {};
    const geographicUsage: Record<string, number> = {};
    const uniqueUsers = new Set<string>();

    usageData.forEach(item => {
      // Hourly pattern
      const hour = item.timestamp.getHours();
      hourlyUsage[hour] = (hourlyUsage[hour] || 0) + 1;
      
      // Geographic pattern
      if (item.country) {
        geographicUsage[item.country] = (geographicUsage[item.country] || 0) + 1;
      }
      
      // Unique users
      if (item.userId) {
        uniqueUsers.add(item.userId);
      }
    });

    return {
      hourlyUsage,
      geographicUsage,
      uniqueUsers: uniqueUsers.size,
      totalInteractions: usageData.length
    };
  }

  // ===========================================
  // DATA ARCHIVING OPTIMIZATION
  // ===========================================

  /**
   * Efficient data archiving with compression and indexing
   */
  async archiveOldAnalytics(retentionDays: number = 90) {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    
    console.log(`Starting analytics data archival for data older than ${cutoffDate.toISOString()}`);

    try {
      // Archive plugin analytics data
      const analyticsCount = await this.prisma.pluginAnalytics.count({
        where: { timestamp: { lt: cutoffDate } }
      });

      if (analyticsCount > 0) {
        // Move to archive table (you would create an archive table structure)
        await this.archiveTable('plugin_analytics', cutoffDate);
        console.log(`Archived ${analyticsCount} plugin analytics records`);
      }

      // Archive metrics data
      const metricsCount = await this.prisma.pluginMetrics.count({
        where: { timestamp: { lt: cutoffDate } }
      });

      if (metricsCount > 0) {
        await this.archiveTable('plugin_metrics', cutoffDate);
        console.log(`Archived ${metricsCount} plugin metrics records`);
      }

      // Archive performance data
      const performanceCount = await this.prisma.pluginPerformance.count({
        where: { timestamp: { lt: cutoffDate } }
      });

      if (performanceCount > 0) {
        await this.archiveTable('plugin_performance', cutoffDate);
        console.log(`Archived ${performanceCount} plugin performance records`);
      }

      // Archive audit logs
      const auditLogCount = await this.prisma.auditLog.count({
        where: { timestamp: { lt: cutoffDate } }
      });

      if (auditLogCount > 0) {
        await this.archiveTable('audit_logs', cutoffDate);
        console.log(`Archived ${auditLogCount} audit log records`);
      }

      return {
        archivedRecords: {
          analytics: analyticsCount,
          metrics: metricsCount,
          performance: performanceCount,
          auditLogs: auditLogCount
        },
        cutoffDate,
        completedAt: new Date()
      };

    } catch (error) {
      console.error('Data archiving failed:', error);
      throw new Error(`Data archiving failed: ${error.message}`);
    }
  }

  private async archiveTable(tableName: string, cutoffDate: Date) {
    const archiveTableName = `${tableName}_archive`;
    
    // Create archive table if it doesn't exist (simplified - you'd want proper schema)
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS ${archiveTableName} 
      (LIKE ${tableName} INCLUDING ALL);
    `);

    // Move data to archive table
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO ${archiveTableName} 
      SELECT * FROM ${tableName} 
      WHERE timestamp < $1;
    `, cutoffDate);

    // Delete archived data from main table
    await this.prisma.$executeRawUnsafe(`
      DELETE FROM ${tableName} 
      WHERE timestamp < $1;
    `, cutoffDate);

    // Update statistics
    await this.prisma.$executeRawUnsafe(`ANALYZE ${tableName};`);
    await this.prisma.$executeRawUnsafe(`ANALYZE ${archiveTableName};`);
  }

  // ===========================================
  // UTILITY METHODS
  // ===========================================

  private getIntervalSeconds(interval: string): number {
    switch (interval) {
      case '1m': return 60;
      case '5m': return 300;
      case '15m': return 900;
      case '1h': return 3600;
      case '6h': return 21600;
      case '24h': return 86400;
      default: return 300; // 5 minutes default
    }
  }

  private getAggregationFunction(aggregation: string): string {
    switch (aggregation) {
      case 'avg': return 'AVG';
      case 'sum': return 'SUM';
      case 'min': return 'MIN';
      case 'max': return 'MAX';
      case 'count': return 'COUNT';
      default: return 'AVG';
    }
  }

  private generateCacheKey(query: TimeSeriesQuery): string {
    return JSON.stringify({
      metric: query.metric,
      aggregation: query.aggregation,
      interval: query.interval,
      start: query.timeRange.start.toISOString(),
      end: query.timeRange.end.toISOString(),
      filters: query.filters,
      groupBy: query.groupBy
    });
  }

  private shouldUseCache(query: TimeSeriesQuery): boolean {
    // Cache long time ranges and expensive aggregations
    const timeRangeHours = (query.timeRange.end.getTime() - query.timeRange.start.getTime()) / (1000 * 60 * 60);
    return timeRangeHours >= 1 && query.groupBy && query.groupBy.length > 0;
  }

  private getCacheDuration(interval: string): number {
    // Cache duration based on aggregation interval
    switch (interval) {
      case '1m': return 5 * 60 * 1000; // 5 minutes
      case '5m': return 15 * 60 * 1000; // 15 minutes
      case '15m': return 30 * 60 * 1000; // 30 minutes
      case '1h': return 60 * 60 * 1000; // 1 hour
      case '6h': return 6 * 60 * 60 * 1000; // 6 hours
      case '24h': return 24 * 60 * 60 * 1000; // 24 hours
      default: return 15 * 60 * 1000;
    }
  }

  private extractLabels(row: any, groupBy: string[]): Record<string, string> {
    const labels: Record<string, string> = {};
    groupBy.forEach((field, index) => {
      labels[field] = row[`labels->>'${field}'`] || '';
    });
    return labels;
  }

  private cleanupCache(): void {
    const now = new Date();
    for (const [key, value] of this.aggregationCache.entries()) {
      if (value.expiry < now) {
        this.aggregationCache.delete(key);
      }
    }
  }
}

export const analyticsOptimizer = new AnalyticsOptimizerService();