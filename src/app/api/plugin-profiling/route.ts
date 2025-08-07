import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { performance } from 'perf_hooks';

// Prometheus-style metrics registry
interface MetricPoint {
  timestamp: number;
  value: number;
  labels?: Record<string, string>;
}

interface MetricSeries {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  help: string;
  points: MetricPoint[];
}

class MetricsRegistry {
  private metrics: Map<string, MetricSeries> = new Map();
  private static instance: MetricsRegistry;

  static getInstance(): MetricsRegistry {
    if (!MetricsRegistry.instance) {
      MetricsRegistry.instance = new MetricsRegistry();
    }
    return MetricsRegistry.instance;
  }

  register(name: string, type: MetricSeries['type'], help: string): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, {
        name,
        type,
        help,
        points: []
      });
    }
  }

  increment(name: string, value: number = 1, labels?: Record<string, string>): void {
    const metric = this.metrics.get(name);
    if (metric) {
      metric.points.push({
        timestamp: Date.now(),
        value,
        labels
      });
    }
  }

  gauge(name: string, value: number, labels?: Record<string, string>): void {
    const metric = this.metrics.get(name);
    if (metric) {
      metric.points.push({
        timestamp: Date.now(),
        value,
        labels
      });
    }
  }

  getMetrics(): MetricSeries[] {
    return Array.from(this.metrics.values());
  }

  getMetric(name: string): MetricSeries | undefined {
    return this.metrics.get(name);
  }

  clear(): void {
    this.metrics.clear();
  }
}

// CPU Profiling with V8 CPU profiler simulation
class CPUProfiler {
  private samples: Array<{
    timestamp: number;
    stack: string[];
    duration: number;
  }> = [];
  
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;

  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.samples = [];
    
    // Sample CPU every 1ms for high resolution profiling
    this.intervalId = setInterval(() => {
      this.captureStack();
    }, 1);
  }

  stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private captureStack(): void {
    const error = new Error();
    const stack = error.stack?.split('\n').slice(1) || [];
    
    this.samples.push({
      timestamp: performance.now(),
      stack: stack.map(line => line.trim()),
      duration: 1 // 1ms per sample
    });
  }

  getProfile(): any {
    if (this.samples.length === 0) {
      return null;
    }

    // Generate flame graph data structure
    const flameGraph = this.generateFlameGraph();
    const topFunctions = this.getTopFunctions();
    
    return {
      samples: this.samples.length,
      duration: this.samples.length > 0 ? 
        this.samples[this.samples.length - 1].timestamp - this.samples[0].timestamp : 0,
      flameGraph,
      topFunctions,
      rawSamples: this.samples.slice(-1000) // Return last 1000 samples
    };
  }

  private generateFlameGraph(): any {
    const stackCounts = new Map<string, number>();
    
    // Count stack occurrences
    this.samples.forEach(sample => {
      const stackKey = sample.stack.join(' -> ');
      stackCounts.set(stackKey, (stackCounts.get(stackKey) || 0) + 1);
    });

    // Convert to flame graph format
    const root = {
      name: 'root',
      value: this.samples.length,
      children: [] as any[]
    };

    stackCounts.forEach((count, stack) => {
      const functions = stack.split(' -> ');
      let current = root;
      
      functions.forEach((func, index) => {
        let child = current.children.find((c: any) => c.name === func);
        if (!child) {
          child = {
            name: func,
            value: 0,
            children: []
          };
          current.children.push(child);
        }
        child.value += count;
        current = child;
      });
    });

    return root;
  }

  private getTopFunctions(): Array<{name: string, count: number, percentage: number}> {
    const functionCounts = new Map<string, number>();
    
    this.samples.forEach(sample => {
      sample.stack.forEach(func => {
        functionCounts.set(func, (functionCounts.get(func) || 0) + 1);
      });
    });

    const total = this.samples.length;
    return Array.from(functionCounts.entries())
      .map(([name, count]) => ({
        name,
        count,
        percentage: (count / total) * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }
}

// Memory Profiler with heap snapshots
class MemoryProfiler {
  private snapshots: Array<{
    timestamp: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    heapSpaceUsed: Record<string, number>;
  }> = [];

  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;

  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.snapshots = [];
    
    // Capture memory every 100ms
    this.intervalId = setInterval(() => {
      this.captureSnapshot();
    }, 100);
  }

  stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private captureSnapshot(): void {
    const memUsage = process.memoryUsage();
    const heapSpaceUsed: Record<string, number> = {};
    
    // Simulate heap space statistics
    try {
      // In a real implementation, you'd use v8.getHeapSpaceStatistics()
      heapSpaceUsed['new_space'] = Math.random() * 1024 * 1024;
      heapSpaceUsed['old_space'] = Math.random() * 10 * 1024 * 1024;
      heapSpaceUsed['code_space'] = Math.random() * 1024 * 1024;
      heapSpaceUsed['map_space'] = Math.random() * 512 * 1024;
    } catch (error) {
      // Fallback values
      heapSpaceUsed['heap'] = memUsage.heapUsed;
    }

    this.snapshots.push({
      timestamp: Date.now(),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      heapSpaceUsed
    });
  }

  getProfile(): any {
    if (this.snapshots.length === 0) {
      return null;
    }

    const leaks = this.detectMemoryLeaks();
    const trends = this.calculateTrends();
    
    return {
      snapshots: this.snapshots.slice(-100), // Last 100 snapshots
      leaks,
      trends,
      current: this.snapshots[this.snapshots.length - 1],
      peak: this.snapshots.reduce((max, snap) => 
        snap.heapUsed > max.heapUsed ? snap : max
      )
    };
  }

  private detectMemoryLeaks(): Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    trend: number;
  }> {
    if (this.snapshots.length < 10) return [];

    const recent = this.snapshots.slice(-10);
    const heapGrowth = (recent[recent.length - 1].heapUsed - recent[0].heapUsed) / recent[0].heapUsed;
    const rssGrowth = (recent[recent.length - 1].rss - recent[0].rss) / recent[0].rss;

    const leaks = [];

    if (heapGrowth > 0.1) { // 10% growth
      leaks.push({
        type: 'heap_growth',
        severity: heapGrowth > 0.3 ? 'high' : 'medium' as 'high' | 'medium',
        description: `Heap memory increased by ${(heapGrowth * 100).toFixed(1)}% in recent samples`,
        trend: heapGrowth
      });
    }

    if (rssGrowth > 0.15) { // 15% RSS growth
      leaks.push({
        type: 'rss_growth',
        severity: rssGrowth > 0.4 ? 'high' : 'medium' as 'high' | 'medium',
        description: `RSS memory increased by ${(rssGrowth * 100).toFixed(1)}% in recent samples`,
        trend: rssGrowth
      });
    }

    return leaks;
  }

  private calculateTrends(): any {
    if (this.snapshots.length < 5) return null;

    const recent = this.snapshots.slice(-20);
    const timestamps = recent.map(s => s.timestamp);
    const heapValues = recent.map(s => s.heapUsed);
    
    // Simple linear regression for trend
    const n = recent.length;
    const sumX = timestamps.reduce((a, b) => a + b, 0);
    const sumY = heapValues.reduce((a, b) => a + b, 0);
    const sumXY = timestamps.reduce((sum, x, i) => sum + x * heapValues[i], 0);
    const sumXX = timestamps.reduce((sum, x) => sum + x * x, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    return {
      slope,
      intercept,
      trend: slope > 0 ? 'increasing' : 'decreasing',
      rate: Math.abs(slope)
    };
  }
}

// Network Latency Analyzer
class NetworkAnalyzer {
  private requests: Array<{
    timestamp: number;
    url: string;
    method: string;
    duration: number;
    status: number;
    size: number;
  }> = [];

  record(url: string, method: string, duration: number, status: number, size: number): void {
    this.requests.push({
      timestamp: Date.now(),
      url,
      method,
      duration,
      status,
      size
    });

    // Keep only last 1000 requests
    if (this.requests.length > 1000) {
      this.requests.shift();
    }
  }

  getAnalysis(): any {
    if (this.requests.length === 0) {
      return {
        totalRequests: 0,
        averageLatency: 0,
        slowRequests: [],
        errorRate: 0
      };
    }

    const totalRequests = this.requests.length;
    const averageLatency = this.requests.reduce((sum, req) => sum + req.duration, 0) / totalRequests;
    const slowRequests = this.requests
      .filter(req => req.duration > 1000) // > 1 second
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);
    
    const errorRequests = this.requests.filter(req => req.status >= 400);
    const errorRate = (errorRequests.length / totalRequests) * 100;

    const latencyPercentiles = this.calculatePercentiles(
      this.requests.map(req => req.duration).sort((a, b) => a - b)
    );

    return {
      totalRequests,
      averageLatency,
      slowRequests,
      errorRate,
      latencyPercentiles,
      requestsPerSecond: this.calculateRPS(),
      topEndpoints: this.getTopEndpoints()
    };
  }

  private calculatePercentiles(sortedValues: number[]): any {
    if (sortedValues.length === 0) return {};

    const percentiles = [50, 75, 90, 95, 99];
    const result: Record<string, number> = {};

    percentiles.forEach(p => {
      const index = Math.ceil((p / 100) * sortedValues.length) - 1;
      result[`p${p}`] = sortedValues[Math.max(0, index)];
    });

    return result;
  }

  private calculateRPS(): number {
    if (this.requests.length < 2) return 0;

    const timespan = this.requests[this.requests.length - 1].timestamp - this.requests[0].timestamp;
    return (this.requests.length / timespan) * 1000; // requests per second
  }

  private getTopEndpoints(): Array<{url: string, count: number, averageLatency: number}> {
    const endpointStats = new Map<string, {count: number, totalLatency: number}>();

    this.requests.forEach(req => {
      const stats = endpointStats.get(req.url) || {count: 0, totalLatency: 0};
      stats.count++;
      stats.totalLatency += req.duration;
      endpointStats.set(req.url, stats);
    });

    return Array.from(endpointStats.entries())
      .map(([url, stats]) => ({
        url,
        count: stats.count,
        averageLatency: stats.totalLatency / stats.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }
}

// Database Performance Monitor
class DatabaseMonitor {
  private queries: Array<{
    timestamp: number;
    query: string;
    duration: number;
    database: string;
    success: boolean;
  }> = [];

  recordQuery(query: string, duration: number, database: string, success: boolean): void {
    this.queries.push({
      timestamp: Date.now(),
      query: query.substring(0, 200), // Truncate long queries
      duration,
      database,
      success
    });

    // Keep only last 500 queries
    if (this.queries.length > 500) {
      this.queries.shift();
    }
  }

  getAnalysis(): any {
    if (this.queries.length === 0) {
      return {
        totalQueries: 0,
        averageDuration: 0,
        slowQueries: [],
        errorRate: 0
      };
    }

    const totalQueries = this.queries.length;
    const averageDuration = this.queries.reduce((sum, q) => sum + q.duration, 0) / totalQueries;
    const slowQueries = this.queries
      .filter(q => q.duration > 100) // > 100ms
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    const failedQueries = this.queries.filter(q => !q.success);
    const errorRate = (failedQueries.length / totalQueries) * 100;

    return {
      totalQueries,
      averageDuration,
      slowQueries,
      errorRate,
      queriesPerSecond: this.calculateQPS(),
      databaseBreakdown: this.getDatabaseBreakdown()
    };
  }

  private calculateQPS(): number {
    if (this.queries.length < 2) return 0;

    const timespan = this.queries[this.queries.length - 1].timestamp - this.queries[0].timestamp;
    return (this.queries.length / timespan) * 1000;
  }

  private getDatabaseBreakdown(): Array<{database: string, count: number, averageDuration: number}> {
    const dbStats = new Map<string, {count: number, totalDuration: number}>();

    this.queries.forEach(q => {
      const stats = dbStats.get(q.database) || {count: 0, totalDuration: 0};
      stats.count++;
      stats.totalDuration += q.duration;
      dbStats.set(q.database, stats);
    });

    return Array.from(dbStats.entries())
      .map(([database, stats]) => ({
        database,
        count: stats.count,
        averageDuration: stats.totalDuration / stats.count
      }));
  }
}

// Global instances
const metricsRegistry = MetricsRegistry.getInstance();
const cpuProfiler = new CPUProfiler();
const memoryProfiler = new MemoryProfiler();
const networkAnalyzer = new NetworkAnalyzer();
const databaseMonitor = new DatabaseMonitor();

// Initialize metrics
metricsRegistry.register('plugin_cpu_usage', 'gauge', 'CPU usage percentage by plugin');
metricsRegistry.register('plugin_memory_usage', 'gauge', 'Memory usage in bytes by plugin');
metricsRegistry.register('plugin_request_duration', 'histogram', 'Request duration in milliseconds');
metricsRegistry.register('plugin_requests_total', 'counter', 'Total number of requests');
metricsRegistry.register('plugin_errors_total', 'counter', 'Total number of errors');
metricsRegistry.register('plugin_db_queries_total', 'counter', 'Total number of database queries');
metricsRegistry.register('plugin_db_query_duration', 'histogram', 'Database query duration in milliseconds');

export async function GET(req: NextRequest) {
  try {
    const searchParams = new URL(req.url).searchParams;
    const action = searchParams.get('action') || 'metrics';
    const pluginId = searchParams.get('plugin');
    const duration = parseInt(searchParams.get('duration') || '30');

    const startTime = performance.now();

    switch (action) {
      case 'start-profiling':
        cpuProfiler.start();
        memoryProfiler.start();
        
        // Record metrics
        metricsRegistry.increment('plugin_requests_total', 1, { 
          plugin: pluginId || 'unknown',
          action: 'start-profiling'
        });

        return NextResponse.json({
          success: true,
          message: 'Profiling started',
          timestamp: Date.now()
        });

      case 'stop-profiling':
        cpuProfiler.stop();
        memoryProfiler.stop();

        const cpuProfile = cpuProfiler.getProfile();
        const memoryProfile = memoryProfiler.getProfile();

        metricsRegistry.increment('plugin_requests_total', 1, { 
          plugin: pluginId || 'unknown',
          action: 'stop-profiling'
        });

        return NextResponse.json({
          success: true,
          message: 'Profiling stopped',
          data: {
            cpu: cpuProfile,
            memory: memoryProfile,
            timestamp: Date.now()
          }
        });

      case 'network-analysis':
        // Simulate some network requests for demo
        if (Math.random() > 0.8) {
          networkAnalyzer.record(
            '/api/plugins/test',
            'GET',
            Math.random() * 2000,
            Math.random() > 0.95 ? 500 : 200,
            Math.random() * 10000
          );
        }

        const networkData = networkAnalyzer.getAnalysis();
        
        metricsRegistry.gauge('plugin_request_duration', networkData.averageLatency, {
          plugin: pluginId || 'unknown'
        });

        return NextResponse.json({
          success: true,
          data: networkData
        });

      case 'database-analysis':
        // Simulate database queries for demo
        if (Math.random() > 0.7) {
          databaseMonitor.recordQuery(
            'SELECT * FROM plugins WHERE enabled = true',
            Math.random() * 500,
            'postgresql',
            Math.random() > 0.95 ? false : true
          );
        }

        const dbData = databaseMonitor.getAnalysis();
        
        metricsRegistry.gauge('plugin_db_query_duration', dbData.averageDuration, {
          plugin: pluginId || 'unknown'
        });

        return NextResponse.json({
          success: true,
          data: dbData
        });

      case 'metrics':
      default:
        // Collect current system metrics
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        // Record current metrics
        metricsRegistry.gauge('plugin_memory_usage', memUsage.heapUsed, {
          plugin: pluginId || 'system'
        });

        metricsRegistry.gauge('plugin_cpu_usage', 
          (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
          { plugin: pluginId || 'system' }
        );

        const requestDuration = performance.now() - startTime;
        metricsRegistry.gauge('plugin_request_duration', requestDuration, {
          plugin: pluginId || 'unknown',
          endpoint: '/api/plugin-profiling'
        });

        metricsRegistry.increment('plugin_requests_total', 1, {
          plugin: pluginId || 'unknown',
          method: 'GET',
          status: '200'
        });

        const allMetrics = metricsRegistry.getMetrics();
        
        return NextResponse.json({
          success: true,
          data: {
            metrics: allMetrics,
            system: {
              memory: memUsage,
              cpu: cpuUsage,
              uptime: process.uptime(),
              platform: os.platform(),
              arch: os.arch(),
              loadAverage: os.loadavg(),
              freeMemory: os.freemem(),
              totalMemory: os.totalmem()
            },
            network: networkAnalyzer.getAnalysis(),
            database: databaseMonitor.getAnalysis(),
            timestamp: Date.now()
          }
        });
    }
  } catch (error) {
    console.error('Plugin profiling error:', error);
    
    metricsRegistry.increment('plugin_errors_total', 1, {
      error: error instanceof Error ? error.name : 'unknown',
      endpoint: '/api/plugin-profiling'
    });

    return NextResponse.json(
      { 
        success: false, 
        error: 'Profiling failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, pluginId, data } = body;

    const startTime = performance.now();

    switch (action) {
      case 'record-metric':
        const { name, value, type, labels } = data;
        
        if (type === 'counter') {
          metricsRegistry.increment(name, value, labels);
        } else if (type === 'gauge') {
          metricsRegistry.gauge(name, value, labels);
        }

        return NextResponse.json({
          success: true,
          message: 'Metric recorded'
        });

      case 'record-network':
        const { url, method, duration, status, size } = data;
        networkAnalyzer.record(url, method, duration, status, size);
        
        return NextResponse.json({
          success: true,
          message: 'Network data recorded'
        });

      case 'record-database':
        const { query, duration: dbDuration, database, success } = data;
        databaseMonitor.recordQuery(query, dbDuration, database, success);
        
        return NextResponse.json({
          success: true,
          message: 'Database query recorded'
        });

      case 'benchmark':
        // Run a performance benchmark
        const benchmarkResult = await runBenchmark(data.testType || 'cpu');
        
        return NextResponse.json({
          success: true,
          data: benchmarkResult
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Plugin profiling POST error:', error);
    
    metricsRegistry.increment('plugin_errors_total', 1, {
      error: error instanceof Error ? error.name : 'unknown',
      endpoint: '/api/plugin-profiling',
      method: 'POST'
    });

    return NextResponse.json(
      { 
        success: false, 
        error: 'Operation failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// Benchmark runner
async function runBenchmark(testType: string): Promise<any> {
  const startTime = performance.now();
  
  switch (testType) {
    case 'cpu':
      // CPU intensive task
      let result = 0;
      for (let i = 0; i < 1000000; i++) {
        result += Math.sqrt(i);
      }
      
      const cpuTime = performance.now() - startTime;
      return {
        type: 'cpu',
        duration: cpuTime,
        operations: 1000000,
        opsPerSecond: 1000000 / (cpuTime / 1000)
      };

    case 'memory':
      // Memory allocation test
      const arrays = [];
      const memStart = process.memoryUsage();
      
      for (let i = 0; i < 1000; i++) {
        arrays.push(new Array(1000).fill(Math.random()));
      }
      
      const memEnd = process.memoryUsage();
      const memTime = performance.now() - startTime;
      
      return {
        type: 'memory',
        duration: memTime,
        memoryAllocated: memEnd.heapUsed - memStart.heapUsed,
        allocationsPerSecond: 1000 / (memTime / 1000)
      };

    case 'io':
      // I/O test (simulated)
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(new Promise(resolve => setTimeout(resolve, Math.random() * 10)));
      }
      
      await Promise.all(promises);
      const ioTime = performance.now() - startTime;
      
      return {
        type: 'io',
        duration: ioTime,
        operations: 100,
        opsPerSecond: 100 / (ioTime / 1000)
      };

    default:
      throw new Error(`Unknown benchmark type: ${testType}`);
  }
}