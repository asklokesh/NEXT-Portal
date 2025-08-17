/**
 * Performance Regression Detection System
 * Monitors performance metrics and detects regressions
 */

export interface PerformanceMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  route?: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export interface PerformanceBaseline {
  metricName: string;
  route?: string;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  sampleCount: number;
  lastUpdated: Date;
}

export interface RegressionAlert {
  id: string;
  metricName: string;
  route?: string;
  currentValue: number;
  baselineValue: number;
  degradationPercent: number;
  severity: 'warning' | 'critical';
  timestamp: Date;
  acknowledged: boolean;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private baselines: Map<string, PerformanceBaseline> = new Map();
  private regressionAlerts: RegressionAlert[] = [];
  private maxMetrics = 10000;

  // Thresholds for regression detection
  private regressionThresholds = {
    warning: 20, // 20% degradation
    critical: 50, // 50% degradation
  };

  constructor() {
    this.initializeWebVitalsTracking();
    
    // Set up periodic baseline updates
    setInterval(() => {
      this.updateBaselines();
    }, 5 * 60 * 1000); // Every 5 minutes

    // Clean up old metrics
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 60 * 1000); // Every minute
  }

  /**
   * Track a performance metric
   */
  track(metric: Omit<PerformanceMetric, 'id' | 'timestamp'>): string {
    const performanceMetric: PerformanceMetric = {
      ...metric,
      id: this.generateId(),
      timestamp: new Date(),
    };

    this.metrics.unshift(performanceMetric);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(0, this.maxMetrics);
    }

    // Check for regressions
    this.checkForRegression(performanceMetric);

    return performanceMetric.id;
  }

  /**
   * Track page load time
   */
  trackPageLoad(
    route: string,
    loadTime: number,
    userId?: string,
    sessionId?: string,
    metadata?: Record<string, any>
  ): string {
    return this.track({
      name: 'page_load_time',
      value: loadTime,
      unit: 'ms',
      route,
      userId,
      sessionId,
      metadata: {
        ...metadata,
        type: 'page_load',
      },
    });
  }

  /**
   * Track API response time
   */
  trackApiResponse(
    endpoint: string,
    responseTime: number,
    statusCode: number,
    userId?: string,
    sessionId?: string,
    metadata?: Record<string, any>
  ): string {
    return this.track({
      name: 'api_response_time',
      value: responseTime,
      unit: 'ms',
      route: endpoint,
      userId,
      sessionId,
      metadata: {
        ...metadata,
        statusCode,
        type: 'api_response',
      },
    });
  }

  /**
   * Track Core Web Vitals
   */
  trackWebVital(
    name: 'FCP' | 'LCP' | 'FID' | 'CLS' | 'TTFB',
    value: number,
    route?: string,
    userId?: string,
    sessionId?: string
  ): string {
    const units: Record<string, string> = {
      FCP: 'ms',
      LCP: 'ms',
      FID: 'ms',
      CLS: 'score',
      TTFB: 'ms',
    };

    return this.track({
      name: `web_vital_${name.toLowerCase()}`,
      value,
      unit: units[name] || 'ms',
      route,
      userId,
      sessionId,
      metadata: {
        type: 'web_vital',
        vitalName: name,
      },
    });
  }

  /**
   * Get performance metrics
   */
  getMetrics(
    filters: {
      metricName?: string;
      route?: string;
      timeWindow?: number; // minutes
      limit?: number;
    } = {}
  ): PerformanceMetric[] {
    let filtered = this.metrics;

    if (filters.timeWindow) {
      const cutoff = new Date(Date.now() - filters.timeWindow * 60 * 1000);
      filtered = filtered.filter(m => m.timestamp > cutoff);
    }

    if (filters.metricName) {
      filtered = filtered.filter(m => m.name === filters.metricName);
    }

    if (filters.route) {
      filtered = filtered.filter(m => m.route === filters.route);
    }

    if (filters.limit) {
      filtered = filtered.slice(0, filters.limit);
    }

    return filtered;
  }

  /**
   * Get performance statistics
   */
  getStats(
    metricName: string,
    route?: string,
    timeWindow = 60
  ): {
    count: number;
    min: number;
    max: number;
    avg: number;
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  } | null {
    const metrics = this.getMetrics({ metricName, route, timeWindow });
    
    if (metrics.length === 0) {
      return null;
    }

    const values = metrics.map(m => m.value).sort((a, b) => a - b);
    const count = values.length;

    return {
      count,
      min: values[0],
      max: values[count - 1],
      avg: values.reduce((sum, v) => sum + v, 0) / count,
      p50: this.percentile(values, 50),
      p90: this.percentile(values, 90),
      p95: this.percentile(values, 95),
      p99: this.percentile(values, 99),
    };
  }

  /**
   * Get current baselines
   */
  getBaselines(): PerformanceBaseline[] {
    return Array.from(this.baselines.values());
  }

  /**
   * Get regression alerts
   */
  getRegressionAlerts(acknowledged = false): RegressionAlert[] {
    return this.regressionAlerts.filter(alert => alert.acknowledged === acknowledged);
  }

  /**
   * Acknowledge a regression alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.regressionAlerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  /**
   * Get performance dashboard data
   */
  getDashboardData(timeWindow = 60): {
    metrics: Record<string, any>;
    regressions: RegressionAlert[];
    trends: Record<string, 'improving' | 'stable' | 'degrading'>;
    topSlowRoutes: Array<{ route: string; avgTime: number }>;
  } {
    const recentMetrics = this.getMetrics({ timeWindow });
    const olderMetrics = this.getMetrics({ 
      timeWindow: timeWindow * 2 
    }).filter(m => {
      const cutoff = new Date(Date.now() - timeWindow * 60 * 1000);
      return m.timestamp < cutoff;
    });

    // Group by metric name and route
    const metricGroups: Record<string, PerformanceMetric[]> = {};
    recentMetrics.forEach(metric => {
      const key = `${metric.name}:${metric.route || 'global'}`;
      if (!metricGroups[key]) {
        metricGroups[key] = [];
      }
      metricGroups[key].push(metric);
    });

    const metrics: Record<string, any> = {};
    const trends: Record<string, 'improving' | 'stable' | 'degrading'> = {};

    Object.entries(metricGroups).forEach(([key, metricArray]) => {
      const [metricName, route] = key.split(':');
      const stats = this.calculateStats(metricArray);
      
      metrics[key] = {
        name: metricName,
        route: route === 'global' ? undefined : route,
        ...stats,
      };

      // Calculate trend
      const olderKey = key;
      const olderGroup = olderMetrics.filter(m => 
        `${m.name}:${m.route || 'global'}` === olderKey
      );
      
      if (olderGroup.length > 0) {
        const olderStats = this.calculateStats(olderGroup);
        const change = (stats.avg - olderStats.avg) / olderStats.avg;
        
        if (change > 0.05) {
          trends[key] = 'degrading';
        } else if (change < -0.05) {
          trends[key] = 'improving';
        } else {
          trends[key] = 'stable';
        }
      } else {
        trends[key] = 'stable';
      }
    });

    // Top slow routes
    const routePerformance: Record<string, number[]> = {};
    recentMetrics
      .filter(m => m.route && (m.name === 'page_load_time' || m.name === 'api_response_time'))
      .forEach(metric => {
        if (!routePerformance[metric.route!]) {
          routePerformance[metric.route!] = [];
        }
        routePerformance[metric.route!].push(metric.value);
      });

    const topSlowRoutes = Object.entries(routePerformance)
      .map(([route, times]) => ({
        route,
        avgTime: times.reduce((sum, time) => sum + time, 0) / times.length,
      }))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 10);

    return {
      metrics,
      regressions: this.getRegressionAlerts(false),
      trends,
      topSlowRoutes,
    };
  }

  private initializeWebVitalsTracking(): void {
    if (typeof window === 'undefined') return;

    // Track Web Vitals using the web-vitals library approach
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.processPerformanceEntry(entry);
      }
    });

    // Observe various performance entry types
    const entryTypes = [
      'navigation',
      'paint',
      'largest-contentful-paint',
      'first-input',
      'layout-shift',
    ];

    entryTypes.forEach(type => {
      try {
        observer.observe({ entryTypes: [type] });
      } catch (e) {
        // Ignore if entry type not supported
      }
    });
  }

  private processPerformanceEntry(entry: PerformanceEntry): void {
    const route = window.location.pathname;
    
    switch (entry.entryType) {
      case 'navigation':
        const navEntry = entry as PerformanceNavigationTiming;
        this.trackPageLoad(route, navEntry.loadEventEnd - navEntry.loadEventStart);
        this.trackWebVital('TTFB', navEntry.responseStart - navEntry.requestStart, route);
        break;
        
      case 'paint':
        if (entry.name === 'first-contentful-paint') {
          this.trackWebVital('FCP', entry.startTime, route);
        }
        break;
        
      case 'largest-contentful-paint':
        this.trackWebVital('LCP', entry.startTime, route);
        break;
        
      case 'first-input':
        const fidEntry = entry as any;
        this.trackWebVital('FID', fidEntry.processingStart - fidEntry.startTime, route);
        break;
        
      case 'layout-shift':
        const clsEntry = entry as any;
        if (!clsEntry.hadRecentInput) {
          this.trackWebVital('CLS', clsEntry.value, route);
        }
        break;
    }
  }

  private checkForRegression(metric: PerformanceMetric): void {
    const baselineKey = `${metric.name}:${metric.route || 'global'}`;
    const baseline = this.baselines.get(baselineKey);
    
    if (!baseline) return;

    const degradation = (metric.value - baseline.p90) / baseline.p90;
    
    if (degradation > this.regressionThresholds.critical / 100) {
      this.createRegressionAlert(metric, baseline, degradation, 'critical');
    } else if (degradation > this.regressionThresholds.warning / 100) {
      this.createRegressionAlert(metric, baseline, degradation, 'warning');
    }
  }

  private createRegressionAlert(
    metric: PerformanceMetric,
    baseline: PerformanceBaseline,
    degradation: number,
    severity: 'warning' | 'critical'
  ): void {
    const alert: RegressionAlert = {
      id: this.generateId(),
      metricName: metric.name,
      route: metric.route,
      currentValue: metric.value,
      baselineValue: baseline.p90,
      degradationPercent: degradation * 100,
      severity,
      timestamp: new Date(),
      acknowledged: false,
    };

    this.regressionAlerts.unshift(alert);
    
    // Keep only recent alerts
    if (this.regressionAlerts.length > 100) {
      this.regressionAlerts = this.regressionAlerts.slice(0, 100);
    }

    // Log the regression
    console.warn(`Performance regression detected:`, alert);
  }

  private updateBaselines(): void {
    const timeWindow = 24 * 60; // 24 hours
    const recentMetrics = this.getMetrics({ timeWindow });
    
    // Group by metric name and route
    const groups: Record<string, PerformanceMetric[]> = {};
    recentMetrics.forEach(metric => {
      const key = `${metric.name}:${metric.route || 'global'}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(metric);
    });

    // Update baselines
    Object.entries(groups).forEach(([key, metrics]) => {
      if (metrics.length < 10) return; // Need at least 10 samples
      
      const [metricName, route] = key.split(':');
      const values = metrics.map(m => m.value).sort((a, b) => a - b);
      
      const baseline: PerformanceBaseline = {
        metricName,
        route: route === 'global' ? undefined : route,
        p50: this.percentile(values, 50),
        p90: this.percentile(values, 90),
        p95: this.percentile(values, 95),
        p99: this.percentile(values, 99),
        sampleCount: values.length,
        lastUpdated: new Date(),
      };
      
      this.baselines.set(key, baseline);
    });
  }

  private calculateStats(metrics: PerformanceMetric[]): {
    count: number;
    min: number;
    max: number;
    avg: number;
    p50: number;
    p90: number;
    p95: number;
  } {
    const values = metrics.map(m => m.value).sort((a, b) => a - b);
    const count = values.length;

    return {
      count,
      min: values[0],
      max: values[count - 1],
      avg: values.reduce((sum, v) => sum + v, 0) / count,
      p50: this.percentile(values, 50),
      p90: this.percentile(values, 90),
      p95: this.percentile(values, 95),
    };
  }

  private percentile(values: number[], percentile: number): number {
    const index = Math.ceil((percentile / 100) * values.length) - 1;
    return values[Math.max(0, Math.min(index, values.length - 1))];
  }

  private cleanupOldMetrics(): void {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
    this.metrics = this.metrics.filter(metric => metric.timestamp > cutoff);
    
    // Cleanup old alerts
    const alertCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours
    this.regressionAlerts = this.regressionAlerts.filter(alert => alert.timestamp > alertCutoff);
  }

  private generateId(): string {
    return `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

export default performanceMonitor;