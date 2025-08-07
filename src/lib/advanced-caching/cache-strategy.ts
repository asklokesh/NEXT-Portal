import { CacheStrategyConfig, CacheTierPreference, CacheSetOptions, CacheGetOptions } from './types';

export type CacheTier = 'memory' | 'redis' | 'cluster';

/**
 * Intelligent cache strategy manager
 * Determines optimal tier placement and access patterns
 */
export class CacheStrategy {
  private config: CacheStrategyConfig;
  private hotKeyTracker = new Map<string, { count: number; lastAccess: number; windowStart: number }>();
  private keyPatterns = new Map<string, CacheTier[]>();
  
  constructor(config: CacheStrategyConfig) {
    this.config = config;
    this.startHotKeyCleanup();
  }

  /**
   * Get optimal tier order for reading
   */
  getTierOrder(key: string, options: CacheGetOptions): CacheTier[] {
    const baseOrder = this.config.tierPreference.read
      .sort((a, b) => b.weight - a.weight)
      .filter(tier => this.matchesConditions(key, tier, options))
      .map(tier => tier.tier);
    
    // Apply hot key optimization
    if (this.isHotKey(key)) {
      // Hot keys should prioritize memory cache
      const memoryFirst = ['memory' as CacheTier, ...baseOrder.filter(t => t !== 'memory')];
      return memoryFirst;
    }
    
    return baseOrder.length > 0 ? baseOrder : ['memory', 'redis', 'cluster'];
  }

  /**
   * Get optimal tiers for writing
   */
  getWriteTiers<T>(key: string, value: T, options: CacheSetOptions): CacheTier[] {
    const valueSize = this.estimateValueSize(value);
    const isLargeValue = valueSize > 10000; // 10KB threshold
    
    let writeTiers: CacheTier[] = [];
    
    // Apply consistency requirements
    switch (this.config.consistency) {
      case 'strong':
        // Write to all tiers synchronously
        writeTiers = ['memory', 'redis', 'cluster'];
        break;
        
      case 'eventual':
        // Write to primary tier, async replication
        if (isLargeValue) {
          writeTiers = ['redis']; // Large values go to Redis
        } else if (this.isHotKey(key)) {
          writeTiers = ['memory', 'redis']; // Hot keys in memory + Redis
        } else {
          writeTiers = ['redis']; // Default to Redis
        }
        break;
        
      case 'weak':
        // Write to fastest tier only
        writeTiers = isLargeValue ? ['redis'] : ['memory'];
        break;
    }
    
    // Apply tier-specific options
    if (options.tier) {
      writeTiers = [options.tier];
    }
    
    // Filter by tier preferences
    const filteredTiers = this.config.tierPreference.write
      .filter(tier => {
        if (!writeTiers.includes(tier.tier)) return false;
        return this.matchesConditions(key, tier, { value, valueSize });
      })
      .sort((a, b) => b.weight - a.weight)
      .map(tier => tier.tier);
    
    return filteredTiers.length > 0 ? filteredTiers : writeTiers;
  }

  /**
   * Record key access for hot key detection
   */
  recordAccess(key: string): void {
    if (!this.config.hotKeyDetection.enabled) return;
    
    const now = Date.now();
    const windowSize = this.config.hotKeyDetection.windowSize * 1000; // Convert to ms
    
    let stats = this.hotKeyTracker.get(key);
    
    if (!stats || (now - stats.windowStart) > windowSize) {
      // Start new window
      stats = {
        count: 1,
        lastAccess: now,
        windowStart: now
      };
    } else {
      stats.count++;
      stats.lastAccess = now;
    }
    
    this.hotKeyTracker.set(key, stats);
  }

  /**
   * Check if key is considered hot
   */
  isHotKey(key: string): boolean {
    if (!this.config.hotKeyDetection.enabled) return false;
    
    const stats = this.hotKeyTracker.get(key);
    if (!stats) return false;
    
    const now = Date.now();
    const windowSize = this.config.hotKeyDetection.windowSize * 1000;
    const windowDuration = now - stats.windowStart;
    
    if (windowDuration < windowSize && windowDuration > 0) {
      const requestsPerSecond = (stats.count / windowDuration) * 1000;
      return requestsPerSecond >= this.config.hotKeyDetection.threshold;
    }
    
    return false;
  }

  /**
   * Get hot keys for cache warming
   */
  getHotKeys(limit: number = 100): Array<{ key: string; rps: number }> {
    const hotKeys: Array<{ key: string; rps: number }> = [];
    const now = Date.now();
    const windowSize = this.config.hotKeyDetection.windowSize * 1000;
    
    for (const [key, stats] of this.hotKeyTracker) {
      const windowDuration = now - stats.windowStart;
      
      if (windowDuration < windowSize && windowDuration > 0) {
        const rps = (stats.count / windowDuration) * 1000;
        if (rps >= this.config.hotKeyDetection.threshold) {
          hotKeys.push({ key, rps });
        }
      }
    }
    
    return hotKeys
      .sort((a, b) => b.rps - a.rps)
      .slice(0, limit);
  }

  /**
   * Determine invalidation strategy
   */
  getInvalidationStrategy(key: string, options: { tags?: string[]; pattern?: string } = {}): {
    strategy: 'immediate' | 'delayed' | 'lazy';
    delay?: number;
    targets: CacheTier[];
  } {
    const isHot = this.isHotKey(key);
    const hasMultipleTags = (options.tags?.length || 0) > 1;
    
    let strategy: 'immediate' | 'delayed' | 'lazy';
    let delay: number | undefined;
    let targets: CacheTier[] = ['memory', 'redis', 'cluster'];
    
    switch (this.config.invalidation.strategy) {
      case 'write-through':
        strategy = 'immediate';
        break;
        
      case 'write-behind':
        strategy = 'delayed';
        delay = this.config.invalidation.flushInterval;
        break;
        
      case 'write-around':
        strategy = 'lazy';
        targets = ['memory']; // Only invalidate memory, let Redis entries expire
        break;
        
      default:
        strategy = 'immediate';
    }
    
    // Override for hot keys - invalidate immediately to maintain consistency
    if (isHot) {
      strategy = 'immediate';
      delay = undefined;
    }
    
    // Override for complex invalidations - use delayed to batch operations
    if (hasMultipleTags || options.pattern) {
      strategy = 'delayed';
      delay = delay || 1000; // 1 second default delay for batching
    }
    
    return { strategy, delay, targets };
  }

  /**
   * Optimize cache placement based on access patterns
   */
  optimizePlacement(key: string, accessPattern: {
    readFrequency: number;
    writeFrequency: number;
    valueSize: number;
    lastAccess: number;
  }): {
    recommendedTiers: CacheTier[];
    ttl: number;
    compression: boolean;
  } {
    const { readFrequency, writeFrequency, valueSize, lastAccess } = accessPattern;
    const age = Date.now() - lastAccess;
    
    let recommendedTiers: CacheTier[] = [];
    let ttl = 3600000; // 1 hour default
    let compression = valueSize > 10000;
    
    // High read frequency items should be in memory
    if (readFrequency > 10) {
      recommendedTiers.push('memory');
      ttl = 7200000; // 2 hours for frequently accessed items
    }
    
    // Medium frequency items go to Redis
    if (readFrequency > 1 || writeFrequency > 0.1) {
      recommendedTiers.push('redis');
    }
    
    // Cold storage for infrequently accessed items
    if (readFrequency < 0.1 && age > 86400000) { // 1 day
      recommendedTiers = ['cluster'];
      ttl = 86400000; // 1 day for cold items
      compression = true; // Always compress cold storage
    }
    
    // Large items should avoid memory cache
    if (valueSize > 50000) { // 50KB
      recommendedTiers = recommendedTiers.filter(tier => tier !== 'memory');
      compression = true;
    }
    
    // Fallback
    if (recommendedTiers.length === 0) {
      recommendedTiers = ['redis'];
    }
    
    return { recommendedTiers, ttl, compression };
  }

  /**
   * Get cache warming recommendations
   */
  getWarmingRecommendations(): Array<{
    key: string;
    priority: 'high' | 'medium' | 'low';
    targetTiers: CacheTier[];
    reason: string;
  }> {
    const recommendations: Array<{
      key: string;
      priority: 'high' | 'medium' | 'low';
      targetTiers: CacheTier[];
      reason: string;
    }> = [];
    
    // Hot keys should be warmed in memory
    const hotKeys = this.getHotKeys(50);
    for (const { key, rps } of hotKeys) {
      recommendations.push({
        key,
        priority: rps > 100 ? 'high' : rps > 50 ? 'medium' : 'low',
        targetTiers: ['memory'],
        reason: `High access rate: ${rps.toFixed(1)} RPS`
      });
    }
    
    return recommendations.sort((a, b) => {
      const priorityWeight = { high: 3, medium: 2, low: 1 };
      return priorityWeight[b.priority] - priorityWeight[a.priority];
    });
  }

  // Private helper methods

  private matchesConditions<T>(
    key: string, 
    tier: CacheTierPreference,
    options: { value?: T; valueSize?: number } | CacheGetOptions | CacheSetOptions
  ): boolean {
    if (!tier.conditions) return true;
    
    const { conditions } = tier;
    
    // Check key pattern
    if (conditions.keyPattern) {
      const regex = new RegExp(conditions.keyPattern);
      if (!regex.test(key)) return false;
    }
    
    // Check value size
    if (conditions.valueSize && 'valueSize' in options && options.valueSize !== undefined) {
      const { min, max } = conditions.valueSize;
      if (min !== undefined && options.valueSize < min) return false;
      if (max !== undefined && options.valueSize > max) return false;
    }
    
    // Check TTL conditions
    if (conditions.ttl && 'ttl' in options && options.ttl !== undefined) {
      const { min, max } = conditions.ttl;
      if (min !== undefined && options.ttl < min) return false;
      if (max !== undefined && options.ttl > max) return false;
    }
    
    // Check access frequency
    if (conditions.accessFrequency) {
      const stats = this.hotKeyTracker.get(key);
      if (stats) {
        const now = Date.now();
        const windowDuration = now - stats.windowStart;
        const frequency = windowDuration > 0 ? (stats.count / windowDuration) * 1000 : 0;
        
        const { min, max } = conditions.accessFrequency;
        if (min !== undefined && frequency < min) return false;
        if (max !== undefined && frequency > max) return false;
      }
    }
    
    return true;
  }

  private estimateValueSize<T>(value: T): number {
    if (typeof value === 'string') {
      return value.length * 2; // UTF-16 encoding
    } else if (typeof value === 'number') {
      return 8; // 64-bit number
    } else if (typeof value === 'boolean') {
      return 1;
    } else if (value === null || value === undefined) {
      return 0;
    } else {
      // Estimate object size through JSON serialization
      try {
        return JSON.stringify(value).length * 2;
      } catch {
        return 1000; // Default estimate for non-serializable objects
      }
    }
  }

  private startHotKeyCleanup(): void {
    // Clean up old hot key tracking data every 5 minutes
    setInterval(() => {
      const now = Date.now();
      const windowSize = this.config.hotKeyDetection.windowSize * 1000;
      const cutoff = now - (windowSize * 2); // Keep data for 2 windows
      
      for (const [key, stats] of this.hotKeyTracker) {
        if (stats.windowStart < cutoff) {
          this.hotKeyTracker.delete(key);
        }
      }
    }, 300000); // 5 minutes
  }
}

/**
 * Advanced cache strategy with machine learning predictions
 */
export class MLCacheStrategy extends CacheStrategy {
  private accessPatterns = new Map<string, number[]>();
  private predictions = new Map<string, { nextAccess: number; confidence: number }>();
  
  /**
   * Predict next access time for a key
   */
  predictNextAccess(key: string): { nextAccess: number; confidence: number } | null {
    const patterns = this.accessPatterns.get(key);
    if (!patterns || patterns.length < 3) {
      return null;
    }
    
    // Simple linear regression prediction
    const intervals = [];
    for (let i = 1; i < patterns.length; i++) {
      intervals.push(patterns[i] - patterns[i - 1]);
    }
    
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
    const confidence = Math.max(0, Math.min(1, 1 - (variance / avgInterval)));
    
    const lastAccess = patterns[patterns.length - 1];
    const nextAccess = lastAccess + avgInterval;
    
    this.predictions.set(key, { nextAccess, confidence });
    return { nextAccess, confidence };
  }

  /**
   * Record access pattern for ML
   */
  recordAccessPattern(key: string, timestamp: number): void {
    super.recordAccess(key);
    
    let patterns = this.accessPatterns.get(key);
    if (!patterns) {
      patterns = [];
      this.accessPatterns.set(key, patterns);
    }
    
    patterns.push(timestamp);
    
    // Keep only last 10 access times
    if (patterns.length > 10) {
      patterns.shift();
    }
  }

  /**
   * Get predictive warming recommendations
   */
  getPredictiveWarmingRecommendations(): Array<{
    key: string;
    predictedAccess: number;
    confidence: number;
    targetTiers: CacheTier[];
  }> {
    const recommendations: Array<{
      key: string;
      predictedAccess: number;
      confidence: number;
      targetTiers: CacheTier[];
    }> = [];
    
    const now = Date.now();
    const warmingWindow = 300000; // 5 minutes ahead
    
    for (const [key, patterns] of this.accessPatterns) {
      const prediction = this.predictNextAccess(key);
      if (!prediction) continue;
      
      const { nextAccess, confidence } = prediction;
      
      // If predicted access is within warming window and confidence is high
      if (nextAccess - now < warmingWindow && confidence > 0.7) {
        recommendations.push({
          key,
          predictedAccess: nextAccess,
          confidence,
          targetTiers: this.isHotKey(key) ? ['memory'] : ['redis']
        });
      }
    }
    
    return recommendations.sort((a, b) => b.confidence - a.confidence);
  }
}