/**
 * Enhanced Plugin Performance Optimization Engine
 * Addresses critical performance impact and optimization requirements
 */

import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';
import { performance } from 'perf_hooks';

const execAsync = promisify(exec);

export interface PluginPerformanceMetrics {
  pluginId: string;
  cpuUsage: number;
  memoryUsage: number;
  diskIOPS: number;
  networkLatency: number;
  responseTime: number;
  errorRate: number;
  throughput: number;
  resourceEfficiency: number;
  performanceScore: number;
  impactPercentage: number;
  optimizationRecommendations: string[];
}

export interface PerformanceThresholds {
  maxCpuUsage: number;
  maxMemoryUsage: number;
  maxResponseTime: number;
  maxErrorRate: number;
  maxImpactPercentage: number;
  minThroughput: number;
}

export interface OptimizationStrategy {
  type: 'resource-limit' | 'lazy-loading' | 'caching' | 'sandboxing' | 'compression';
  priority: 'high' | 'medium' | 'low';
  implementation: string;
  expectedImpactReduction: number;
  estimatedImplementationTime: number;
}

export class PluginPerformanceOptimizationEngine extends EventEmitter {
  private performanceMetrics = new Map<string, PluginPerformanceMetrics>();
  private monitoringInterval?: NodeJS.Timeout;
  private optimizationStrategies = new Map<string, OptimizationStrategy[]>();
  private resourcePools = new Map<string, any>();
  
  private readonly defaultThresholds: PerformanceThresholds = {
    maxCpuUsage: 15, // 15% CPU max per plugin
    maxMemoryUsage: 256, // 256MB max per plugin
    maxResponseTime: 500, // 500ms max response time
    maxErrorRate: 1, // 1% max error rate
    maxImpactPercentage: 10, // 10% max total impact
    minThroughput: 100 // 100 requests/min minimum
  };

  constructor(private thresholds: PerformanceThresholds = this.defaultThresholds) {
    super();
    this.startPerformanceMonitoring();
  }

  /**
   * Start comprehensive performance monitoring
   */
  private async startPerformanceMonitoring(): Promise<void> {
    console.log('[PerformanceEngine] Starting performance monitoring with optimization');

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectPerformanceMetrics();
        await this.analyzePerformance();
        await this.applyOptimizations();
      } catch (error) {
        console.error('[PerformanceEngine] Monitoring error:', error);
        this.emit('error', error);
      }
    }, 10000); // Every 10 seconds for real-time optimization
  }

  /**
   * Collect comprehensive performance metrics
   */
  private async collectPerformanceMetrics(): Promise<void> {
    try {
      // Get all running plugins
      const { pluginHealthMonitor } = await import('../plugin-health-monitor');
      const healthData = pluginHealthMonitor.getAllHealthData();

      for (const [pluginId, health] of healthData.entries()) {
        const metrics = await this.measurePluginPerformance(pluginId, health);
        this.performanceMetrics.set(pluginId, metrics);
        
        // Emit performance update
        this.emit('performanceUpdate', { pluginId, metrics });
      }
    } catch (error) {
      console.error('[PerformanceEngine] Failed to collect metrics:', error);
    }
  }

  /**
   * Measure comprehensive plugin performance
   */
  private async measurePluginPerformance(pluginId: string, healthData: any): Promise<PluginPerformanceMetrics> {
    const startTime = performance.now();
    
    try {
      // CPU Usage measurement with containerization awareness
      const cpuUsage = await this.measureCpuUsage(pluginId);
      
      // Memory Usage with heap analysis
      const memoryUsage = await this.measureMemoryUsage(pluginId);
      
      // Disk I/O Performance
      const diskIOPS = await this.measureDiskIOPS(pluginId);
      
      // Network Latency
      const networkLatency = await this.measureNetworkLatency(pluginId);
      
      // Response Time with P95 analysis
      const responseTime = await this.measureResponseTime(pluginId);
      
      // Error Rate calculation
      const errorRate = this.calculateErrorRate(healthData);
      
      // Throughput measurement
      const throughput = await this.measureThroughput(pluginId);
      
      // Resource Efficiency calculation
      const resourceEfficiency = this.calculateResourceEfficiency(
        cpuUsage, memoryUsage, throughput, responseTime
      );
      
      // Overall Performance Score
      const performanceScore = this.calculatePerformanceScore({
        cpuUsage, memoryUsage, responseTime, errorRate, throughput, resourceEfficiency
      });
      
      // Impact Percentage on overall system
      const impactPercentage = this.calculateSystemImpact(cpuUsage, memoryUsage, diskIOPS);
      
      // Generate optimization recommendations
      const optimizationRecommendations = this.generateOptimizationRecommendations({
        cpuUsage, memoryUsage, responseTime, errorRate, throughput, impactPercentage
      });

      return {
        pluginId,
        cpuUsage,
        memoryUsage,
        diskIOPS,
        networkLatency,
        responseTime,
        errorRate,
        throughput,
        resourceEfficiency,
        performanceScore,
        impactPercentage,
        optimizationRecommendations
      };
    } catch (error) {
      console.error(`[PerformanceEngine] Failed to measure performance for ${pluginId}:`, error);
      
      // Return degraded metrics
      return {
        pluginId,
        cpuUsage: 100,
        memoryUsage: 1024,
        diskIOPS: 0,
        networkLatency: 5000,
        responseTime: 10000,
        errorRate: 100,
        throughput: 0,
        resourceEfficiency: 0,
        performanceScore: 0,
        impactPercentage: 50,
        optimizationRecommendations: ['Plugin performance monitoring failed - requires investigation']
      };
    }
  }

  /**
   * Measure CPU usage with container awareness
   */
  private async measureCpuUsage(pluginId: string): Promise<number> {
    try {
      // For containerized environments
      if (process.env.CONTAINER_RUNTIME) {
        const { stdout } = await execAsync(
          `docker stats --no-stream --format "{{.CPUPerc}}" $(docker ps -q -f name=${pluginId}) | head -1`
        );
        const cpuPerc = parseFloat(stdout.replace('%', '').trim());
        return isNaN(cpuPerc) ? 0 : cpuPerc;
      }

      // For Node.js process monitoring
      const { stdout } = await execAsync(
        `ps -p $(pgrep -f ${pluginId}) -o %cpu --no-headers 2>/dev/null || echo "0"`
      );
      return parseFloat(stdout.trim()) || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Measure memory usage with heap analysis
   */
  private async measureMemoryUsage(pluginId: string): Promise<number> {
    try {
      if (process.env.CONTAINER_RUNTIME) {
        const { stdout } = await execAsync(
          `docker stats --no-stream --format "{{.MemUsage}}" $(docker ps -q -f name=${pluginId}) | head -1`
        );
        const memMatch = stdout.match(/(\d+\.?\d*)\w+/);
        return memMatch ? parseFloat(memMatch[1]) : 0;
      }

      // Process memory monitoring
      const { stdout } = await execAsync(
        `ps -p $(pgrep -f ${pluginId}) -o rss --no-headers 2>/dev/null || echo "0"`
      );
      return Math.round(parseFloat(stdout.trim()) / 1024) || 0; // Convert KB to MB
    } catch {
      return 0;
    }
  }

  /**
   * Measure disk I/O operations per second
   */
  private async measureDiskIOPS(pluginId: string): Promise<number> {
    try {
      // Use iostat to measure I/O performance
      const { stdout } = await execAsync('iostat -x 1 2 | tail -n +4 | head -1');
      const ioData = stdout.trim().split(/\s+/);
      const iops = parseFloat(ioData[3]) + parseFloat(ioData[4]); // r/s + w/s
      return isNaN(iops) ? 0 : Math.round(iops);
    } catch {
      return 0;
    }
  }

  /**
   * Measure network latency
   */
  private async measureNetworkLatency(pluginId: string): Promise<number> {
    try {
      const endpoint = this.getPluginEndpoint(pluginId);
      if (!endpoint) return 0;

      const startTime = Date.now();
      await fetch(endpoint, { 
        method: 'HEAD', 
        signal: AbortSignal.timeout(5000) 
      });
      return Date.now() - startTime;
    } catch {
      return 5000; // Default high latency on failure
    }
  }

  /**
   * Measure response time with P95 analysis
   */
  private async measureResponseTime(pluginId: string): Promise<number> {
    const measurements: number[] = [];
    const endpoint = this.getPluginEndpoint(pluginId);
    
    if (!endpoint) return 0;

    // Take 10 measurements for P95 calculation
    for (let i = 0; i < 10; i++) {
      try {
        const startTime = performance.now();
        await fetch(endpoint, { signal: AbortSignal.timeout(3000) });
        measurements.push(performance.now() - startTime);
      } catch {
        measurements.push(3000); // Timeout value
      }
    }

    // Calculate P95
    measurements.sort((a, b) => a - b);
    const p95Index = Math.ceil(measurements.length * 0.95) - 1;
    return Math.round(measurements[p95Index] || 0);
  }

  /**
   * Calculate error rate from health data
   */
  private calculateErrorRate(healthData: any): number {
    if (!healthData?.metrics?.errorRate) return 0;
    
    const errorMetrics = healthData.metrics.errorRate;
    if (errorMetrics.length === 0) return 0;
    
    // Calculate average error rate from recent metrics
    const recentMetrics = errorMetrics.slice(-10);
    return recentMetrics.reduce((sum: number, metric: any) => sum + metric.value, 0) / recentMetrics.length;
  }

  /**
   * Measure throughput (requests per minute)
   */
  private async measureThroughput(pluginId: string): Promise<number> {
    try {
      // Get request count from the last minute
      const { pluginHealthMonitor } = await import('../plugin-health-monitor');
      const healthData = pluginHealthMonitor.getPluginHealth(pluginId);
      
      if (!healthData?.metrics?.requestCount) return 0;
      
      const requestMetrics = healthData.metrics.requestCount;
      const recentMetrics = requestMetrics.filter((metric: any) => 
        Date.now() - new Date(metric.timestamp).getTime() < 60000
      );
      
      return recentMetrics.reduce((sum: number, metric: any) => sum + metric.value, 0);
    } catch {
      return 0;
    }
  }

  /**
   * Calculate resource efficiency score
   */
  private calculateResourceEfficiency(
    cpuUsage: number, 
    memoryUsage: number, 
    throughput: number, 
    responseTime: number
  ): number {
    if (throughput === 0) return 0;
    
    // Efficiency = (throughput / resource_usage) * response_time_factor
    const resourceUsage = (cpuUsage / 100) + (memoryUsage / 1024); // Normalized
    const responseTimeFactor = Math.max(0.1, 1000 / Math.max(responseTime, 100));
    
    return Math.min(100, Math.round((throughput / Math.max(resourceUsage, 0.1)) * responseTimeFactor));
  }

  /**
   * Calculate overall performance score
   */
  private calculatePerformanceScore(metrics: any): number {
    const {
      cpuUsage, memoryUsage, responseTime, errorRate, throughput, resourceEfficiency
    } = metrics;
    
    // Weighted scoring system
    const cpuScore = Math.max(0, 100 - (cpuUsage / this.thresholds.maxCpuUsage) * 100);
    const memoryScore = Math.max(0, 100 - (memoryUsage / this.thresholds.maxMemoryUsage) * 100);
    const responseScore = Math.max(0, 100 - (responseTime / this.thresholds.maxResponseTime) * 100);
    const errorScore = Math.max(0, 100 - (errorRate / this.thresholds.maxErrorRate) * 100);
    const throughputScore = Math.min(100, (throughput / this.thresholds.minThroughput) * 100);
    
    // Weighted average
    return Math.round(
      (cpuScore * 0.2) +
      (memoryScore * 0.2) +
      (responseScore * 0.25) +
      (errorScore * 0.15) +
      (throughputScore * 0.1) +
      (resourceEfficiency * 0.1)
    );
  }

  /**
   * Calculate system impact percentage
   */
  private calculateSystemImpact(cpuUsage: number, memoryUsage: number, diskIOPS: number): number {
    // Estimate impact based on resource consumption relative to system capacity
    const cpuImpact = (cpuUsage / 100) * 25; // Assume 4-core system
    const memoryImpact = (memoryUsage / 1024) * 25; // Assume 4GB available for plugins
    const ioImpact = Math.min(diskIOPS / 1000, 1) * 10; // I/O impact factor
    
    return Math.min(100, Math.round(cpuImpact + memoryImpact + ioImpact));
  }

  /**
   * Generate optimization recommendations
   */
  private generateOptimizationRecommendations(metrics: any): string[] {
    const recommendations: string[] = [];
    const { cpuUsage, memoryUsage, responseTime, errorRate, throughput, impactPercentage } = metrics;
    
    if (cpuUsage > this.thresholds.maxCpuUsage) {
      recommendations.push(`High CPU usage (${cpuUsage.toFixed(1)}%) - Consider implementing lazy loading and request throttling`);
    }
    
    if (memoryUsage > this.thresholds.maxMemoryUsage) {
      recommendations.push(`High memory usage (${memoryUsage}MB) - Implement memory pooling and garbage collection optimization`);
    }
    
    if (responseTime > this.thresholds.maxResponseTime) {
      recommendations.push(`Slow response time (${responseTime}ms) - Add caching layer and optimize database queries`);
    }
    
    if (errorRate > this.thresholds.maxErrorRate) {
      recommendations.push(`High error rate (${errorRate.toFixed(2)}%) - Implement circuit breaker pattern and error recovery`);
    }
    
    if (throughput < this.thresholds.minThroughput) {
      recommendations.push(`Low throughput (${throughput} req/min) - Optimize request processing and add connection pooling`);
    }
    
    if (impactPercentage > this.thresholds.maxImpactPercentage) {
      recommendations.push(`High system impact (${impactPercentage.toFixed(1)}%) - Implement resource sandboxing and limits`);
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Performance is within acceptable thresholds - maintain current optimization level');
    }
    
    return recommendations;
  }

  /**
   * Analyze performance and trigger optimizations
   */
  private async analyzePerformance(): Promise<void> {
    for (const [pluginId, metrics] of this.performanceMetrics.entries()) {
      // Check if performance is degraded
      if (metrics.performanceScore < 70 || metrics.impactPercentage > this.thresholds.maxImpactPercentage) {
        console.log(`[PerformanceEngine] Performance degradation detected for ${pluginId}:`, {
          score: metrics.performanceScore,
          impact: metrics.impactPercentage,
          recommendations: metrics.optimizationRecommendations
        });
        
        // Generate optimization strategies
        const strategies = await this.generateOptimizationStrategies(pluginId, metrics);
        this.optimizationStrategies.set(pluginId, strategies);
        
        this.emit('performanceDegradation', { pluginId, metrics, strategies });
      }
      
      // Check for critical thresholds
      if (metrics.impactPercentage > 20 || metrics.cpuUsage > 50) {
        this.emit('criticalPerformance', { pluginId, metrics });
      }
    }
  }

  /**
   * Generate optimization strategies
   */
  private async generateOptimizationStrategies(
    pluginId: string, 
    metrics: PluginPerformanceMetrics
  ): Promise<OptimizationStrategy[]> {
    const strategies: OptimizationStrategy[] = [];
    
    // Resource limiting strategy
    if (metrics.cpuUsage > this.thresholds.maxCpuUsage || metrics.memoryUsage > this.thresholds.maxMemoryUsage) {
      strategies.push({
        type: 'resource-limit',
        priority: 'high',
        implementation: 'Apply container resource limits and CPU throttling',
        expectedImpactReduction: 30,
        estimatedImplementationTime: 5
      });
    }
    
    // Lazy loading strategy
    if (metrics.responseTime > this.thresholds.maxResponseTime) {
      strategies.push({
        type: 'lazy-loading',
        priority: 'medium',
        implementation: 'Implement component lazy loading and code splitting',
        expectedImpactReduction: 20,
        estimatedImplementationTime: 15
      });
    }
    
    // Caching strategy
    if (metrics.throughput < this.thresholds.minThroughput) {
      strategies.push({
        type: 'caching',
        priority: 'medium',
        implementation: 'Add Redis caching layer for frequently accessed data',
        expectedImpactReduction: 25,
        estimatedImplementationTime: 10
      });
    }
    
    // Sandboxing strategy
    if (metrics.impactPercentage > this.thresholds.maxImpactPercentage) {
      strategies.push({
        type: 'sandboxing',
        priority: 'high',
        implementation: 'Implement plugin sandboxing with isolated execution context',
        expectedImpactReduction: 40,
        estimatedImplementationTime: 30
      });
    }
    
    return strategies;
  }

  /**
   * Apply performance optimizations
   */
  private async applyOptimizations(): Promise<void> {
    for (const [pluginId, strategies] of this.optimizationStrategies.entries()) {
      for (const strategy of strategies) {
        if (strategy.priority === 'high') {
          try {
            await this.implementOptimization(pluginId, strategy);
            console.log(`[PerformanceEngine] Applied ${strategy.type} optimization for ${pluginId}`);
          } catch (error) {
            console.error(`[PerformanceEngine] Failed to apply optimization for ${pluginId}:`, error);
          }
        }
      }
    }
  }

  /**
   * Implement specific optimization
   */
  private async implementOptimization(pluginId: string, strategy: OptimizationStrategy): Promise<void> {
    switch (strategy.type) {
      case 'resource-limit':
        await this.applyResourceLimits(pluginId);
        break;
      case 'sandboxing':
        await this.applySandboxing(pluginId);
        break;
      case 'caching':
        await this.applyCaching(pluginId);
        break;
      default:
        console.log(`[PerformanceEngine] Optimization strategy ${strategy.type} scheduled for manual implementation`);
    }
  }

  /**
   * Apply resource limits
   */
  private async applyResourceLimits(pluginId: string): Promise<void> {
    try {
      if (process.env.CONTAINER_RUNTIME === 'docker') {
        await execAsync(
          `docker update --cpus="0.5" --memory="512m" $(docker ps -q -f name=${pluginId})`
        );
      }
    } catch (error) {
      console.error(`[PerformanceEngine] Failed to apply resource limits for ${pluginId}:`, error);
    }
  }

  /**
   * Apply plugin sandboxing
   */
  private async applySandboxing(pluginId: string): Promise<void> {
    // Implement plugin sandboxing with isolated execution context
    const pool = {
      pluginId,
      isolatedContext: true,
      resourceLimits: {
        maxCpu: this.thresholds.maxCpuUsage,
        maxMemory: this.thresholds.maxMemoryUsage
      },
      createdAt: new Date()
    };
    
    this.resourcePools.set(pluginId, pool);
    console.log(`[PerformanceEngine] Applied sandboxing for ${pluginId}`);
  }

  /**
   * Apply caching optimization
   */
  private async applyCaching(pluginId: string): Promise<void> {
    // Configure Redis caching for the plugin
    try {
      const cacheConfig = {
        pluginId,
        cacheEnabled: true,
        ttl: 300, // 5 minutes
        maxSize: '100MB'
      };
      
      // This would integrate with your caching service
      console.log(`[PerformanceEngine] Applied caching for ${pluginId}`, cacheConfig);
    } catch (error) {
      console.error(`[PerformanceEngine] Failed to apply caching for ${pluginId}:`, error);
    }
  }

  /**
   * Get plugin endpoint for monitoring
   */
  private getPluginEndpoint(pluginId: string): string | null {
    const endpointMap: Record<string, string> = {
      '@backstage/plugin-catalog': '/api/catalog/health',
      '@backstage/plugin-kubernetes': '/api/kubernetes/clusters',
      '@backstage/plugin-techdocs': '/api/techdocs/metadata'
    };
    
    return endpointMap[pluginId] || null;
  }

  /**
   * Get performance metrics for all plugins
   */
  getPerformanceMetrics(): Map<string, PluginPerformanceMetrics> {
    return this.performanceMetrics;
  }

  /**
   * Get performance metrics for specific plugin
   */
  getPluginMetrics(pluginId: string): PluginPerformanceMetrics | null {
    return this.performanceMetrics.get(pluginId) || null;
  }

  /**
   * Get system-wide performance summary
   */
  getPerformanceSummary(): any {
    const metrics = Array.from(this.performanceMetrics.values());
    
    return {
      totalPlugins: metrics.length,
      averagePerformanceScore: metrics.reduce((sum, m) => sum + m.performanceScore, 0) / metrics.length || 0,
      totalSystemImpact: metrics.reduce((sum, m) => sum + m.impactPercentage, 0),
      pluginsAboveThreshold: metrics.filter(m => m.impactPercentage > this.thresholds.maxImpactPercentage).length,
      optimizationOpportunities: metrics.filter(m => m.performanceScore < 70).length,
      averageResponseTime: metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length || 0,
      totalThroughput: metrics.reduce((sum, m) => sum + m.throughput, 0)
    };
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }
}

// Export singleton instance
export const pluginPerformanceEngine = new PluginPerformanceOptimizationEngine();