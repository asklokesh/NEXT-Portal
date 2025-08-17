/**
 * Distributed Metrics Collection and Aggregation
 * Collects metrics from multiple services and provides unified views
 */

import { getTelemetryManager } from './opentelemetry';

export interface MetricPoint {
  timestamp: Date;
  value: number;
  labels: Record<string, string>;
  source: string;
}

export interface MetricSeries {
  name: string;
  description: string;
  unit: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  points: MetricPoint[];
}

export interface ServiceHealth {
  serviceName: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastSeen: Date;
  version: string;
  metrics: {
    responseTime: number;
    errorRate: number;
    throughput: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  checks: Array<{
    name: string;
    status: 'pass' | 'fail' | 'warn';
    message?: string;
    lastCheck: Date;
  }>;
}

export interface ServiceDependency {
  serviceName: string;
  dependsOn: string[];
  dependents: string[];
  criticality: 'high' | 'medium' | 'low';
  sla: {
    availability: number;
    responseTime: number;
    errorRate: number;
  };
}

/**
 * Distributed Metrics Manager
 */
export class DistributedMetricsManager {
  private metrics: Map<string, MetricSeries> = new Map();
  private services: Map<string, ServiceHealth> = new Map();
  private dependencies: Map<string, ServiceDependency> = new Map();
  private collectors: Map<string, () => Promise<MetricPoint[]>> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.initializeDefaultMetrics();
  }

  /**
   * Register a metric collector
   */
  registerCollector(
    metricName: string,
    collector: () => Promise<MetricPoint[]>,
    intervalMs = 30000
  ): void {
    this.collectors.set(metricName, collector);
    
    // Start collection interval
    const interval = setInterval(async () => {
      try {
        const points = await collector();
        this.addMetricPoints(metricName, points);
      } catch (error) {
        console.error(`Failed to collect metric ${metricName}:`, error);
      }
    }, intervalMs);

    this.intervals.set(metricName, interval);
  }

  /**
   * Add metric points
   */
  addMetricPoints(metricName: string, points: MetricPoint[]): void {
    let series = this.metrics.get(metricName);
    
    if (!series) {
      series = {
        name: metricName,
        description: '',
        unit: '',
        type: 'gauge',
        points: []
      };
      this.metrics.set(metricName, series);
    }

    series.points.push(...points);
    
    // Keep only recent points (last 24 hours)
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    series.points = series.points.filter(point => point.timestamp > cutoff);
  }

  /**
   * Register service
   */
  registerService(serviceName: string, dependency: ServiceDependency): void {
    this.dependencies.set(serviceName, dependency);
    
    // Initialize service health if not exists
    if (!this.services.has(serviceName)) {
      this.services.set(serviceName, {
        serviceName,
        status: 'unknown',
        lastSeen: new Date(),
        version: '0.0.0',
        metrics: {
          responseTime: 0,
          errorRate: 0,
          throughput: 0,
          memoryUsage: 0,
          cpuUsage: 0
        },
        checks: []
      });
    }
  }

  /**
   * Update service health
   */
  updateServiceHealth(
    serviceName: string,
    health: Partial<ServiceHealth>
  ): void {
    const current = this.services.get(serviceName);
    
    if (current) {
      this.services.set(serviceName, {
        ...current,
        ...health,
        lastSeen: new Date()
      });
    } else {
      this.services.set(serviceName, {
        serviceName,
        status: 'unknown',
        lastSeen: new Date(),
        version: '0.0.0',
        metrics: {
          responseTime: 0,
          errorRate: 0,
          throughput: 0,
          memoryUsage: 0,
          cpuUsage: 0
        },
        checks: [],
        ...health
      });
    }
  }

  /**
   * Get metric series
   */
  getMetricSeries(metricName: string, timeRange?: {
    start: Date;
    end: Date;
  }): MetricSeries | null {
    const series = this.metrics.get(metricName);
    
    if (!series) return null;

    if (!timeRange) return series;

    return {
      ...series,
      points: series.points.filter(point => 
        point.timestamp >= timeRange.start && point.timestamp <= timeRange.end
      )
    };
  }

  /**
   * Query metrics with aggregation
   */
  queryMetrics(query: {
    metricName: string;
    labels?: Record<string, string>;
    aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count';
    groupBy?: string[];
    timeRange?: { start: Date; end: Date };
    resolution?: number; // seconds
  }): Array<{
    labels: Record<string, string>;
    value: number;
    timestamp?: Date;
  }> {
    const series = this.getMetricSeries(query.metricName, query.timeRange);
    
    if (!series) return [];

    let points = series.points;

    // Filter by labels
    if (query.labels) {
      points = points.filter(point => {
        for (const [key, value] of Object.entries(query.labels!)) {
          if (point.labels[key] !== value) return false;
        }
        return true;
      });
    }

    // Group by labels
    const groups: Map<string, MetricPoint[]> = new Map();
    
    for (const point of points) {
      const groupKey = query.groupBy
        ? query.groupBy.map(key => `${key}:${point.labels[key] || 'null'}`).join('|')
        : 'all';
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(point);
    }

    // Apply aggregation
    const results: Array<{
      labels: Record<string, string>;
      value: number;
      timestamp?: Date;
    }> = [];

    for (const [groupKey, groupPoints] of groups.entries()) {
      const labels: Record<string, string> = {};
      
      if (query.groupBy && groupKey !== 'all') {
        const labelPairs = groupKey.split('|');
        for (const pair of labelPairs) {
          const [key, value] = pair.split(':');
          labels[key] = value === 'null' ? '' : value;
        }
      }

      let value: number;
      
      switch (query.aggregation) {
        case 'sum':
          value = groupPoints.reduce((sum, p) => sum + p.value, 0);
          break;
        case 'avg':
          value = groupPoints.reduce((sum, p) => sum + p.value, 0) / groupPoints.length;
          break;
        case 'min':
          value = Math.min(...groupPoints.map(p => p.value));
          break;
        case 'max':
          value = Math.max(...groupPoints.map(p => p.value));
          break;
        case 'count':
          value = groupPoints.length;
          break;
        default:
          value = groupPoints.length > 0 ? groupPoints[groupPoints.length - 1].value : 0;
      }

      results.push({
        labels,
        value,
        timestamp: groupPoints.length > 0 ? groupPoints[groupPoints.length - 1].timestamp : undefined
      });
    }

    return results;
  }

  /**
   * Get service health status
   */
  getServiceHealth(serviceName?: string): ServiceHealth[] {
    if (serviceName) {
      const health = this.services.get(serviceName);
      return health ? [health] : [];
    }

    return Array.from(this.services.values());
  }

  /**
   * Get system overview
   */
  getSystemOverview(): {
    totalServices: number;
    healthyServices: number;
    degradedServices: number;
    unhealthyServices: number;
    unknownServices: number;
    totalMetrics: number;
    totalDataPoints: number;
    criticalAlerts: number;
    warningAlerts: number;
  } {
    const services = Array.from(this.services.values());
    const totalMetrics = this.metrics.size;
    let totalDataPoints = 0;
    
    for (const series of this.metrics.values()) {
      totalDataPoints += series.points.length;
    }

    const statusCounts = services.reduce((counts, service) => {
      counts[service.status]++;
      return counts;
    }, {
      healthy: 0,
      degraded: 0,
      unhealthy: 0,
      unknown: 0
    });

    // Count alerts (simplified - would integrate with alerting system)
    let criticalAlerts = 0;
    let warningAlerts = 0;
    
    for (const service of services) {
      if (service.status === 'unhealthy') criticalAlerts++;
      if (service.status === 'degraded') warningAlerts++;
      
      for (const check of service.checks) {
        if (check.status === 'fail') criticalAlerts++;
        if (check.status === 'warn') warningAlerts++;
      }
    }

    return {
      totalServices: services.length,
      healthyServices: statusCounts.healthy,
      degradedServices: statusCounts.degraded,
      unhealthyServices: statusCounts.unhealthy,
      unknownServices: statusCounts.unknown,
      totalMetrics,
      totalDataPoints,
      criticalAlerts,
      warningAlerts
    };
  }

  /**
   * Get service dependency graph
   */
  getServiceDependencyGraph(): {
    nodes: Array<{
      id: string;
      name: string;
      status: string;
      criticality: string;
    }>;
    edges: Array<{
      source: string;
      target: string;
      type: 'depends_on';
    }>;
  } {
    const nodes: Array<{
      id: string;
      name: string;
      status: string;
      criticality: string;
    }> = [];
    
    const edges: Array<{
      source: string;
      target: string;
      type: 'depends_on';
    }> = [];

    for (const [serviceName, dependency] of this.dependencies.entries()) {
      const health = this.services.get(serviceName);
      
      nodes.push({
        id: serviceName,
        name: serviceName,
        status: health?.status || 'unknown',
        criticality: dependency.criticality
      });

      for (const dep of dependency.dependsOn) {
        edges.push({
          source: serviceName,
          target: dep,
          type: 'depends_on'
        });
      }
    }

    return { nodes, edges };
  }

  /**
   * Calculate service impact score
   */
  calculateServiceImpact(serviceName: string): {
    directDependents: number;
    indirectDependents: number;
    criticalityScore: number;
    impactScore: number;
  } {
    const dependency = this.dependencies.get(serviceName);
    
    if (!dependency) {
      return {
        directDependents: 0,
        indirectDependents: 0,
        criticalityScore: 0,
        impactScore: 0
      };
    }

    const directDependents = dependency.dependents.length;
    
    // Calculate indirect dependents (recursive)
    const visited = new Set<string>();
    const calculateIndirect = (service: string): number => {
      if (visited.has(service)) return 0;
      visited.add(service);
      
      const dep = this.dependencies.get(service);
      if (!dep) return 0;
      
      let count = dep.dependents.length;
      for (const dependent of dep.dependents) {
        count += calculateIndirect(dependent);
      }
      return count;
    };

    const indirectDependents = calculateIndirect(serviceName) - directDependents;

    const criticalityScore = dependency.criticality === 'high' ? 3 : 
                            dependency.criticality === 'medium' ? 2 : 1;

    const impactScore = (directDependents * 2 + indirectDependents) * criticalityScore;

    return {
      directDependents,
      indirectDependents,
      criticalityScore,
      impactScore
    };
  }

  /**
   * Initialize default metrics
   */
  private initializeDefaultMetrics(): void {
    // HTTP Requests
    this.registerCollector('http_requests_total', async () => {
      // This would integrate with your HTTP metrics
      return [{
        timestamp: new Date(),
        value: Math.random() * 100,
        labels: { method: 'GET', status: '200' },
        source: 'next-portal'
      }];
    });

    // System metrics
    this.registerCollector('system_memory_usage', async () => {
      const usage = process.memoryUsage();
      return [{
        timestamp: new Date(),
        value: usage.heapUsed / 1024 / 1024, // MB
        labels: { type: 'heap_used' },
        source: 'next-portal'
      }];
    });

    this.registerCollector('system_cpu_usage', async () => {
      const usage = process.cpuUsage();
      return [{
        timestamp: new Date(),
        value: (usage.user + usage.system) / 1000000, // seconds
        labels: { type: 'total' },
        source: 'next-portal'
      }];
    });

    // Register default services
    this.registerService('next-portal', {
      serviceName: 'next-portal',
      dependsOn: ['database', 'redis'],
      dependents: [],
      criticality: 'high',
      sla: {
        availability: 99.9,
        responseTime: 500,
        errorRate: 1
      }
    });

    this.registerService('backstage', {
      serviceName: 'backstage',
      dependsOn: ['database'],
      dependents: ['next-portal'],
      criticality: 'high',
      sla: {
        availability: 99.5,
        responseTime: 1000,
        errorRate: 2
      }
    });
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    for (const interval of this.intervals.values()) {
      clearInterval(interval);
    }
    this.intervals.clear();
  }
}

// Global instance
export const distributedMetrics = new DistributedMetricsManager();

export default distributedMetrics;