import { CacheMetricsSnapshot, CacheStats, TierHealth, CacheKeyMetrics } from './types';
import { MetricsCollector } from '../monitoring/metrics-collector';

export class CacheMetrics {
  private collector: MetricsCollector;
  private tierStats = new Map<string, CacheStats>();
  private keyMetrics = new Map<string, CacheKeyMetrics>();
  private operationCounts = new Map<string, number>();
  private latencyHistograms = new Map<string, number[]>();
  private startTime = Date.now();
  
  // Rolling windows for metrics
  private readonly WINDOW_SIZE = 300; // 5 minutes in seconds
  private hitRateWindow = new Array<number>(this.WINDOW_SIZE).fill(0);
  private throughputWindow = new Array<number>(this.WINDOW_SIZE).fill(0);
  private latencyWindow = new Array<number>(this.WINDOW_SIZE).fill(0);
  private currentWindowIndex = 0;
  
  constructor() {
    this.collector = new MetricsCollector();
    this.initializeTierStats();
    this.startMetricsCollection();
  }

  /**
   * Record a cache hit
   */
  recordHit(tier: string, key: string, latency: number = 0): void {
    this.updateTierStats(tier, 'hits');
    this.updateKeyMetrics(key, 'hit', tier);
    this.recordLatency(tier, latency);
    
    this.collector.incrementCounter('cache_hits_total', { tier, key_prefix: this.getKeyPrefix(key) });
    this.collector.recordHistogram('cache_hit_latency', latency, { tier });
  }

  /**
   * Record a cache miss
   */
  recordMiss(tier: string, key: string): void {
    this.updateTierStats(tier, 'misses');
    this.updateKeyMetrics(key, 'miss', tier);
    
    this.collector.incrementCounter('cache_misses_total', { tier, key_prefix: this.getKeyPrefix(key) });
  }

  /**
   * Record a cache write operation
   */
  recordWrite(key: string, latency: number = 0): void {
    this.updateTierStats('all', 'sets');
    this.updateKeyMetrics(key, 'write', 'unknown');
    
    this.collector.incrementCounter('cache_writes_total', { key_prefix: this.getKeyPrefix(key) });
    this.collector.recordHistogram('cache_write_latency', latency, {});
  }

  /**
   * Record a cache delete operation
   */
  recordDelete(key: string): void {
    this.updateTierStats('all', 'deletes');
    this.collector.incrementCounter('cache_deletes_total', { key_prefix: this.getKeyPrefix(key) });
  }

  /**
   * Record cache invalidation
   */
  recordInvalidation(pattern: string): void {
    this.collector.incrementCounter('cache_invalidations_total', { pattern });
  }

  /**
   * Record an error
   */
  recordError(tier: string, key: string, error: any): void {
    this.updateTierStats(tier, 'errors');
    
    this.collector.incrementCounter('cache_errors_total', { 
      tier, 
      key_prefix: this.getKeyPrefix(key),
      error_type: error.name || 'unknown'
    });
  }

  /**
   * Record eviction
   */
  recordEviction(tier: string, key: string, reason: string): void {
    this.updateTierStats(tier, 'evictions');
    
    this.collector.incrementCounter('cache_evictions_total', { 
      tier, 
      key_prefix: this.getKeyPrefix(key),
      reason 
    });
  }

  /**
   * Record latency for a specific operation
   */
  recordLatency(operation: string, latency: number): void {
    if (!this.latencyHistograms.has(operation)) {
      this.latencyHistograms.set(operation, []);
    }
    
    const histogram = this.latencyHistograms.get(operation)!;
    histogram.push(latency);
    
    // Keep only last 1000 measurements
    if (histogram.length > 1000) {
      histogram.shift();
    }
    
    this.collector.recordHistogram('cache_operation_latency', latency, { operation });
  }

  /**
   * Get comprehensive metrics snapshot
   */
  async getSnapshot(): Promise<CacheMetricsSnapshot> {
    const now = Date.now();
    const uptime = now - this.startTime;
    
    // Calculate global stats
    const globalStats = this.calculateGlobalStats();
    
    // Get tier-specific stats and health
    const tiers: Record<string, CacheStats & TierHealth> = {};
    for (const [tierName, stats] of this.tierStats) {
      const health = await this.calculateTierHealth(tierName);
      tiers[tierName] = { ...stats, ...health };
    }
    
    // Get top keys by various metrics
    const topKeys = this.getTopKeys(20);
    const hotKeys = this.getHotKeys(20);
    
    return {
      timestamp: now,
      global: globalStats,
      tiers,
      topKeys,
      hotKeys
    };
  }

  /**
   * Get hit rate for a specific tier or overall
   */
  getHitRate(tier?: string): number {
    if (tier) {
      const stats = this.tierStats.get(tier);
      if (!stats) return 0;
      
      const total = stats.hits + stats.misses;
      return total > 0 ? stats.hits / total : 0;
    }
    
    // Calculate overall hit rate
    let totalHits = 0;
    let totalRequests = 0;
    
    for (const stats of this.tierStats.values()) {
      totalHits += stats.hits;
      totalRequests += stats.hits + stats.misses;
    }
    
    return totalRequests > 0 ? totalHits / totalRequests : 0;
  }

  /**
   * Get eviction count for a tier
   */
  getEvictionCount(tier: string): number {
    const stats = this.tierStats.get(tier);
    return stats?.evictions || 0;
  }

  /**
   * Get popular keys for cache warming
   */
  getPopularKeys(limit: number = 100): string[] {
    return Array.from(this.keyMetrics.values())
      .sort((a, b) => b.hits - a.hits)
      .slice(0, limit)
      .map(metric => metric.key);
  }

  /**
   * Get performance percentiles
   */
  getLatencyPercentiles(operation: string): {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  } {
    const histogram = this.latencyHistograms.get(operation);
    if (!histogram || histogram.length === 0) {
      return { p50: 0, p90: 0, p95: 0, p99: 0 };
    }
    
    const sorted = [...histogram].sort((a, b) => a - b);
    const length = sorted.length;
    
    return {
      p50: sorted[Math.floor(length * 0.5)],
      p90: sorted[Math.floor(length * 0.9)],
      p95: sorted[Math.floor(length * 0.95)],
      p99: sorted[Math.floor(length * 0.99)]
    };
  }

  /**
   * Calculate cache efficiency metrics
   */
  getCacheEfficiency(): {
    hitRatio: number;
    missRatio: number;
    writeRatio: number;
    errorRatio: number;
    averageLatency: number;
    throughput: number; // Operations per second
  } {
    const globalStats = this.calculateGlobalStats();
    const total = globalStats.hits + globalStats.misses + globalStats.sets + globalStats.deletes;
    
    if (total === 0) {
      return {
        hitRatio: 0,
        missRatio: 0,
        writeRatio: 0,
        errorRatio: 0,
        averageLatency: 0,
        throughput: 0
      };
    }
    
    const uptime = Date.now() - this.startTime;
    const uptimeSeconds = uptime / 1000;
    
    return {
      hitRatio: globalStats.hits / total,
      missRatio: globalStats.misses / total,
      writeRatio: globalStats.sets / total,
      errorRatio: globalStats.errors / total,
      averageLatency: this.calculateAverageLatency(),
      throughput: uptimeSeconds > 0 ? total / uptimeSeconds : 0
    };
  }

  /**
   * Get key-specific metrics
   */
  getKeyMetrics(key: string): CacheKeyMetrics | null {
    return this.keyMetrics.get(key) || null;
  }

  /**
   * Get tier comparison metrics
   */
  getTierComparison(): Array<{
    tier: string;
    hitRate: number;
    averageLatency: number;
    throughput: number;
    errorRate: number;
  }> {
    const comparison: Array<{
      tier: string;
      hitRate: number;
      averageLatency: number;
      throughput: number;
      errorRate: number;
    }> = [];
    
    for (const [tierName, stats] of this.tierStats) {
      const total = stats.hits + stats.misses;
      const hitRate = total > 0 ? stats.hits / total : 0;
      const errorRate = total > 0 ? stats.errors / total : 0;
      
      comparison.push({
        tier: tierName,
        hitRate,
        averageLatency: this.calculateTierAverageLatency(tierName),
        throughput: this.calculateTierThroughput(tierName),
        errorRate
      });
    }
    
    return comparison.sort((a, b) => b.hitRate - a.hitRate);
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.tierStats.clear();
    this.keyMetrics.clear();
    this.operationCounts.clear();
    this.latencyHistograms.clear();
    this.initializeTierStats();
    this.startTime = Date.now();
  }

  // Private helper methods

  private initializeTierStats(): void {
    const tiers = ['memory', 'redis', 'cluster', 'all'];
    
    for (const tier of tiers) {
      this.tierStats.set(tier, {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        evictions: 0,
        errors: 0,
        size: 0,
        memoryUsage: 0
      });
    }
  }

  private updateTierStats(tier: string, operation: keyof CacheStats): void {
    const stats = this.tierStats.get(tier);
    if (stats && operation in stats) {
      (stats[operation] as number)++;
    }
  }

  private updateKeyMetrics(key: string, operation: 'hit' | 'miss' | 'write', tier: string): void {
    let metrics = this.keyMetrics.get(key);
    
    if (!metrics) {
      metrics = {
        key,
        hits: 0,
        misses: 0,
        lastAccess: Date.now(),
        averageSize: 0,
        tier: tier as any,
        hotness: 0
      };
      this.keyMetrics.set(key, metrics);
    }
    
    switch (operation) {
      case 'hit':
        metrics.hits++;
        break;
      case 'miss':
        metrics.misses++;
        break;
      case 'write':
        // Update write-related metrics
        break;
    }
    
    metrics.lastAccess = Date.now();
    metrics.tier = tier as any;
    
    // Calculate hotness score based on recent activity
    metrics.hotness = this.calculateKeyHotness(metrics);
  }

  private calculateKeyHotness(metrics: CacheKeyMetrics): number {
    const now = Date.now();
    const age = now - metrics.lastAccess;
    const totalRequests = metrics.hits + metrics.misses;
    
    // Decay factor based on age (fresher = higher score)
    const ageFactor = Math.exp(-age / 3600000); // 1-hour half-life
    
    // Activity factor based on total requests
    const activityFactor = Math.log(totalRequests + 1);
    
    // Hit rate factor
    const hitRateFactor = totalRequests > 0 ? metrics.hits / totalRequests : 0;
    
    return ageFactor * activityFactor * hitRateFactor;
  }

  private calculateGlobalStats(): CacheStats {
    const global: CacheStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      errors: 0,
      size: 0,
      memoryUsage: 0
    };
    
    for (const [tierName, stats] of this.tierStats) {
      if (tierName === 'all') continue; // Skip the 'all' tier to avoid double counting
      
      global.hits += stats.hits;
      global.misses += stats.misses;
      global.sets += stats.sets;
      global.deletes += stats.deletes;
      global.evictions += stats.evictions;
      global.errors += stats.errors;
      global.size += stats.size;
      global.memoryUsage += stats.memoryUsage;
    }
    
    return global;
  }

  private async calculateTierHealth(tierName: string): Promise<TierHealth> {
    const stats = this.tierStats.get(tierName);
    if (!stats) {
      return {
        healthy: false,
        latency: -1,
        errorRate: 1,
        throughput: 0
      };
    }
    
    const total = stats.hits + stats.misses;
    const errorRate = total > 0 ? stats.errors / total : 0;
    const healthy = errorRate < 0.1; // Consider healthy if error rate < 10%
    
    return {
      healthy,
      latency: this.calculateTierAverageLatency(tierName),
      errorRate,
      throughput: this.calculateTierThroughput(tierName)
    };
  }

  private calculateTierAverageLatency(tierName: string): number {
    const histogram = this.latencyHistograms.get(tierName);
    if (!histogram || histogram.length === 0) return 0;
    
    const sum = histogram.reduce((acc, latency) => acc + latency, 0);
    return sum / histogram.length;
  }

  private calculateTierThroughput(tierName: string): number {
    const stats = this.tierStats.get(tierName);
    if (!stats) return 0;
    
    const total = stats.hits + stats.misses + stats.sets + stats.deletes;
    const uptime = Date.now() - this.startTime;
    const uptimeSeconds = uptime / 1000;
    
    return uptimeSeconds > 0 ? total / uptimeSeconds : 0;
  }

  private calculateAverageLatency(): number {
    let totalLatency = 0;
    let totalSamples = 0;
    
    for (const histogram of this.latencyHistograms.values()) {
      for (const latency of histogram) {
        totalLatency += latency;
        totalSamples++;
      }
    }
    
    return totalSamples > 0 ? totalLatency / totalSamples : 0;
  }

  private getTopKeys(limit: number): Array<{ key: string; hits: number; size: number }> {
    return Array.from(this.keyMetrics.values())
      .sort((a, b) => b.hits - a.hits)
      .slice(0, limit)
      .map(metric => ({
        key: metric.key,
        hits: metric.hits,
        size: metric.averageSize
      }));
  }

  private getHotKeys(limit: number): Array<{ key: string; requestsPerSecond: number }> {
    const now = Date.now();
    const oneMinute = 60000;
    
    return Array.from(this.keyMetrics.values())
      .filter(metric => (now - metric.lastAccess) < oneMinute)
      .sort((a, b) => b.hotness - a.hotness)
      .slice(0, limit)
      .map(metric => {
        const recentActivity = metric.hits + metric.misses;
        const timeSinceLastAccess = now - metric.lastAccess;
        const requestsPerSecond = timeSinceLastAccess > 0 ? recentActivity / (timeSinceLastAccess / 1000) : 0;
        
        return {
          key: metric.key,
          requestsPerSecond
        };
      });
  }

  private getKeyPrefix(key: string): string {
    return key.split(':')[0] || 'unknown';
  }

  private startMetricsCollection(): void {
    // Update rolling window metrics every second
    setInterval(() => {
      this.updateRollingWindows();
      this.currentWindowIndex = (this.currentWindowIndex + 1) % this.WINDOW_SIZE;
    }, 1000);
    
    // Cleanup old key metrics every 5 minutes
    setInterval(() => {
      this.cleanupOldKeyMetrics();
    }, 300000);
    
    // Collect system metrics every minute
    setInterval(() => {
      this.collectSystemMetrics();
    }, 60000);
  }

  private updateRollingWindows(): void {
    const efficiency = this.getCacheEfficiency();
    
    this.hitRateWindow[this.currentWindowIndex] = efficiency.hitRatio;
    this.throughputWindow[this.currentWindowIndex] = efficiency.throughput;
    this.latencyWindow[this.currentWindowIndex] = efficiency.averageLatency;
  }

  private cleanupOldKeyMetrics(): void {
    const now = Date.now();
    const maxAge = 3600000; // 1 hour
    
    for (const [key, metrics] of this.keyMetrics) {
      if (now - metrics.lastAccess > maxAge && metrics.hits < 5) {
        this.keyMetrics.delete(key);
      }
    }
  }

  public collectSystemMetrics(): void {
    // This would collect system-level metrics like memory usage, CPU, etc.
    // Implementation depends on the environment
    if (process.memoryUsage) {
      const memUsage = process.memoryUsage();
      this.collector.recordGauge('cache_system_memory_used', memUsage.heapUsed, {});
      this.collector.recordGauge('cache_system_memory_total', memUsage.heapTotal, {});
    }
  }
}