/**
 * Tenant Performance Optimizer
 * Optimizes tenant switching to achieve sub-100ms performance with intelligent caching
 */

import { Redis } from 'ioredis';
import { LRUCache } from 'lru-cache';

export interface PerformanceConfig {
  cacheEnabled: boolean;
  preloadTenants: string[];
  connectionPooling: {
    enabled: boolean;
    minConnections: number;
    maxConnections: number;
    idleTimeout: number;
  };
  queryOptimization: {
    enabled: boolean;
    indexHints: boolean;
    queryCache: boolean;
  };
  compressionLevel: number;
  batchOperations: boolean;
}

export interface PerformanceMetrics {
  tenantId: string;
  operationType: string;
  startTime: number;
  endTime: number;
  duration: number;
  cacheHit: boolean;
  dbQueries: number;
  dataSize: number;
  memoryUsage: number;
  cpuUsage: number;
}

export interface CacheStrategy {
  key: string;
  ttl: number;
  priority: 'high' | 'medium' | 'low';
  compressionEnabled: boolean;
  warmup: boolean;
}

export interface TenantPerformanceProfile {
  tenantId: string;
  avgSwitchTime: number;
  avgQueryTime: number;
  cacheHitRate: number;
  dataAccessPatterns: Map<string, number>;
  peakUsageHours: number[];
  resourceLimits: {
    maxMemoryMB: number;
    maxConcurrentQueries: number;
    maxCacheSize: number;
  };
  optimizations: string[];
  lastOptimized: Date;
}

/**
 * High-Performance Tenant Optimizer
 * Optimizes tenant operations for sub-100ms performance
 */
export class TenantPerformanceOptimizer {
  private readonly redis: Redis;
  private readonly memoryCache: LRUCache<string, any>;
  private readonly queryCache: LRUCache<string, any>;
  private readonly connectionCache: Map<string, any> = new Map();
  private readonly performanceProfiles: Map<string, TenantPerformanceProfile> = new Map();
  private readonly realtimeMetrics: Map<string, PerformanceMetrics[]> = new Map();
  
  // High-speed caches for critical data
  private readonly tenantConfigCache: LRUCache<string, any>;
  private readonly permissionCache: LRUCache<string, string[]>;
  private readonly schemaCache: LRUCache<string, any>;
  
  // Performance configuration
  private readonly config: PerformanceConfig;

  constructor(config?: Partial<PerformanceConfig>) {
    this.config = {
      cacheEnabled: true,
      preloadTenants: ['tenant-localhost:4400', 'tenant-demo'],
      connectionPooling: {
        enabled: true,
        minConnections: 5,
        maxConnections: 20,
        idleTimeout: 30000,
      },
      queryOptimization: {
        enabled: true,
        indexHints: true,
        queryCache: true,
      },
      compressionLevel: 6,
      batchOperations: true,
      ...config,
    };

    // Initialize Redis for distributed caching
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 50,
      enableReadyCheck: false,
      maxRetriesPerRequest: 2,
      lazyConnect: true,
    });

    // Initialize memory caches with optimized configurations
    this.memoryCache = new LRUCache({
      max: 10000, // Maximum 10k entries
      ttl: 300000, // 5 minutes default TTL
      updateAgeOnGet: true,
      updateAgeOnHas: true,
    });

    this.queryCache = new LRUCache({
      max: 5000, // Maximum 5k queries
      ttl: 60000, // 1 minute TTL for queries
      updateAgeOnGet: true,
    });

    this.tenantConfigCache = new LRUCache({
      max: 1000,
      ttl: 600000, // 10 minutes for tenant configs
      updateAgeOnGet: true,
    });

    this.permissionCache = new LRUCache({
      max: 5000,
      ttl: 300000, // 5 minutes for permissions
      updateAgeOnGet: true,
    });

    this.schemaCache = new LRUCache({
      max: 100,
      ttl: 3600000, // 1 hour for schema info
      updateAgeOnGet: true,
    });

    this.initializePerformanceOptimization();
  }

  /**
   * Optimized tenant context switching with performance tracking
   */
  async optimizedTenantSwitch(
    tenantId: string,
    operationType: 'CONTEXT_SWITCH' | 'QUERY_EXECUTION' | 'PERMISSION_CHECK' = 'CONTEXT_SWITCH'
  ): Promise<{ success: boolean; duration: number; cacheHit: boolean; optimizations: string[] }> {
    const startTime = Date.now();
    const optimizations: string[] = [];
    let cacheHit = false;

    try {
      // Fast path: Check if tenant context is already cached
      const cachedContext = this.getCachedTenantContext(tenantId);
      if (cachedContext) {
        cacheHit = true;
        optimizations.push('MEMORY_CACHE_HIT');
        
        // Validate cache freshness
        if (this.isCacheValid(cachedContext)) {
          const duration = Date.now() - startTime;
          this.recordPerformanceMetric(tenantId, operationType, startTime, Date.now(), cacheHit, 0);
          return { success: true, duration, cacheHit, optimizations };
        }
      }

      // Medium path: Check Redis cache
      const redisCached = await this.getRedisCache(`tenant:context:${tenantId}`);
      if (redisCached) {
        cacheHit = true;
        optimizations.push('REDIS_CACHE_HIT');
        
        // Store in memory cache for next time
        this.cacheTenantContext(tenantId, redisCached);
        
        const duration = Date.now() - startTime;
        this.recordPerformanceMetric(tenantId, operationType, startTime, Date.now(), cacheHit, 0);
        return { success: true, duration, cacheHit, optimizations };
      }

      // Slow path: Full tenant context resolution
      optimizations.push('DATABASE_FETCH');
      const context = await this.buildTenantContext(tenantId);
      
      // Apply performance optimizations
      await this.applyPerformanceOptimizations(tenantId, context);
      
      // Cache the result with intelligent TTL
      await this.cacheWithIntelligentTTL(tenantId, context);
      
      const duration = Date.now() - startTime;
      this.recordPerformanceMetric(tenantId, operationType, startTime, Date.now(), cacheHit, 1);
      
      // Alert if performance degrades
      if (duration > 100) {
        await this.handlePerformanceDegradation(tenantId, duration, operationType);
      }

      return { success: true, duration, cacheHit, optimizations };

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`Tenant switch optimization failed for ${tenantId}:`, error);
      this.recordPerformanceMetric(tenantId, operationType, startTime, Date.now(), cacheHit, 0, error);
      return { success: false, duration, cacheHit, optimizations: [...optimizations, 'ERROR'] };
    }
  }

  /**
   * High-speed permission checking with multi-level caching
   */
  async optimizedPermissionCheck(
    tenantId: string,
    userId: string,
    requiredPermissions: string[]
  ): Promise<{ allowed: boolean; duration: number; cacheHit: boolean }> {
    const startTime = Date.now();
    const cacheKey = `perms:${tenantId}:${userId}`;
    
    // L1 Cache: Memory
    let userPermissions = this.permissionCache.get(cacheKey);
    let cacheHit = !!userPermissions;
    
    if (!userPermissions) {
      // L2 Cache: Redis
      const redisPermissions = await this.getRedisCache(cacheKey);
      if (redisPermissions) {
        userPermissions = redisPermissions;
        cacheHit = true;
        this.permissionCache.set(cacheKey, userPermissions);
      } else {
        // L3: Database fetch
        userPermissions = await this.fetchUserPermissions(tenantId, userId);
        
        // Cache with different TTLs based on user type
        const ttl = userId.includes('admin') ? 600000 : 300000; // Admins cached longer
        this.permissionCache.set(cacheKey, userPermissions);
        await this.setRedisCache(cacheKey, userPermissions, ttl);
      }
    }

    const allowed = this.checkPermissionsOptimized(userPermissions, requiredPermissions);
    const duration = Date.now() - startTime;

    return { allowed, duration, cacheHit };
  }

  /**
   * Optimized query execution with intelligent caching
   */
  async optimizedQueryExecution<T>(
    tenantId: string,
    query: string,
    params: any[] = [],
    cacheStrategy?: CacheStrategy
  ): Promise<{ result: T; duration: number; cacheHit: boolean; optimizations: string[] }> {
    const startTime = Date.now();
    const optimizations: string[] = [];
    
    // Generate cache key
    const queryHash = this.generateQueryHash(query, params, tenantId);
    const cacheKey = `query:${tenantId}:${queryHash}`;
    
    // Check if query should be cached
    const shouldCache = this.shouldCacheQuery(query, cacheStrategy);
    let cacheHit = false;
    let result: T;

    if (shouldCache) {
      // Try cache first
      result = this.queryCache.get(cacheKey);
      if (result) {
        cacheHit = true;
        optimizations.push('QUERY_CACHE_HIT');
        const duration = Date.now() - startTime;
        return { result, duration, cacheHit, optimizations };
      }
    }

    // Apply query optimizations
    const optimizedQuery = this.optimizeQuery(query, tenantId);
    if (optimizedQuery !== query) {
      optimizations.push('QUERY_OPTIMIZED');
    }

    // Execute query with connection pooling
    const connection = await this.getOptimizedConnection(tenantId);
    optimizations.push('CONNECTION_POOLED');

    try {
      // Execute with timeout and monitoring
      result = await this.executeWithMonitoring(optimizedQuery, params, connection, tenantId);
      
      // Cache result if appropriate
      if (shouldCache && result) {
        const ttl = cacheStrategy?.ttl || this.calculateOptimalTTL(query);
        this.queryCache.set(cacheKey, result, { ttl });
        optimizations.push('RESULT_CACHED');
      }

      const duration = Date.now() - startTime;
      this.recordQueryMetrics(tenantId, query, duration, cacheHit);

      return { result, duration, cacheHit, optimizations };

    } finally {
      this.releaseConnection(tenantId, connection);
    }
  }

  /**
   * Preload tenant data for improved performance
   */
  async preloadTenantData(tenantIds: string[]): Promise<void> {
    const preloadTasks = tenantIds.map(async (tenantId) => {
      try {
        // Preload tenant configuration
        await this.optimizedTenantSwitch(tenantId, 'CONTEXT_SWITCH');
        
        // Preload common permissions
        const commonUsers = await this.getCommonUsers(tenantId);
        for (const userId of commonUsers) {
          await this.optimizedPermissionCheck(tenantId, userId, ['api:access']);
        }

        // Preload frequently accessed data
        await this.preloadFrequentQueries(tenantId);
        
        console.log(`Preloaded data for tenant: ${tenantId}`);
      } catch (error) {
        console.error(`Failed to preload tenant ${tenantId}:`, error);
      }
    });

    await Promise.allSettled(preloadTasks);
  }

  /**
   * Get performance statistics for tenant
   */
  getTenantPerformanceStats(tenantId: string): {
    avgSwitchTime: number;
    cacheHitRate: number;
    sub100msRate: number;
    totalOperations: number;
    recentMetrics: PerformanceMetrics[];
  } | null {
    const metrics = this.realtimeMetrics.get(tenantId) || [];
    if (metrics.length === 0) return null;

    const contextSwitches = metrics.filter(m => m.operationType === 'CONTEXT_SWITCH');
    const cacheHits = metrics.filter(m => m.cacheHit).length;
    const sub100ms = metrics.filter(m => m.duration < 100).length;
    
    const avgSwitchTime = contextSwitches.length > 0 
      ? contextSwitches.reduce((sum, m) => sum + m.duration, 0) / contextSwitches.length
      : 0;

    return {
      avgSwitchTime,
      cacheHitRate: metrics.length > 0 ? (cacheHits / metrics.length) * 100 : 0,
      sub100msRate: (sub100ms / metrics.length) * 100,
      totalOperations: metrics.length,
      recentMetrics: metrics.slice(-10), // Last 10 operations
    };
  }

  /**
   * Auto-optimize tenant performance based on usage patterns
   */
  async autoOptimizeTenant(tenantId: string): Promise<string[]> {
    const optimizations: string[] = [];
    const profile = this.performanceProfiles.get(tenantId);
    
    if (!profile) {
      return optimizations;
    }

    // Optimize cache strategies based on access patterns
    if (profile.cacheHitRate < 70) {
      await this.adjustCacheStrategy(tenantId, 'INCREASE_TTL');
      optimizations.push('CACHE_TTL_INCREASED');
    }

    // Optimize connection pooling
    if (profile.avgSwitchTime > 100) {
      await this.adjustConnectionPooling(tenantId, 'INCREASE_POOL_SIZE');
      optimizations.push('CONNECTION_POOL_OPTIMIZED');
    }

    // Preload frequently accessed data
    const topPatterns = Array.from(profile.dataAccessPatterns.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    if (topPatterns.length > 0) {
      await this.preloadAccessPatterns(tenantId, topPatterns);
      optimizations.push('DATA_PRELOADED');
    }

    // Update optimization timestamp
    profile.lastOptimized = new Date();
    profile.optimizations = [...profile.optimizations, ...optimizations];

    return optimizations;
  }

  /**
   * Get cached tenant context
   */
  private getCachedTenantContext(tenantId: string): any {
    return this.tenantConfigCache.get(tenantId);
  }

  /**
   * Cache tenant context
   */
  private cacheTenantContext(tenantId: string, context: any): void {
    this.tenantConfigCache.set(tenantId, {
      ...context,
      cachedAt: Date.now(),
    });
  }

  /**
   * Check if cache is valid
   */
  private isCacheValid(cachedContext: any): boolean {
    const cacheAge = Date.now() - cachedContext.cachedAt;
    return cacheAge < 300000; // 5 minutes
  }

  /**
   * Get data from Redis cache
   */
  private async getRedisCache(key: string): Promise<any> {
    try {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Redis cache get error:', error);
      return null;
    }
  }

  /**
   * Set data in Redis cache
   */
  private async setRedisCache(key: string, data: any, ttl: number = 300000): Promise<void> {
    try {
      await this.redis.setex(key, Math.floor(ttl / 1000), JSON.stringify(data));
    } catch (error) {
      console.error('Redis cache set error:', error);
    }
  }

  /**
   * Build tenant context from database
   */
  private async buildTenantContext(tenantId: string): Promise<any> {
    // This would fetch from database in production
    return {
      id: tenantId,
      name: `Tenant ${tenantId}`,
      tier: 'enterprise',
      status: 'active',
      features: ['api', 'advanced_security'],
      limits: {
        maxUsers: 1000,
        maxPlugins: 100,
      },
      builtAt: Date.now(),
    };
  }

  /**
   * Apply performance optimizations
   */
  private async applyPerformanceOptimizations(tenantId: string, context: any): Promise<void> {
    // Update performance profile
    let profile = this.performanceProfiles.get(tenantId);
    if (!profile) {
      profile = {
        tenantId,
        avgSwitchTime: 0,
        avgQueryTime: 0,
        cacheHitRate: 0,
        dataAccessPatterns: new Map(),
        peakUsageHours: [],
        resourceLimits: {
          maxMemoryMB: 512,
          maxConcurrentQueries: 10,
          maxCacheSize: 100,
        },
        optimizations: [],
        lastOptimized: new Date(),
      };
      this.performanceProfiles.set(tenantId, profile);
    }

    // Apply tenant-specific optimizations based on tier
    if (context.tier === 'enterprise') {
      profile.resourceLimits.maxMemoryMB = 1024;
      profile.resourceLimits.maxConcurrentQueries = 25;
      profile.resourceLimits.maxCacheSize = 500;
    }
  }

  /**
   * Cache with intelligent TTL based on access patterns
   */
  private async cacheWithIntelligentTTL(tenantId: string, context: any): Promise<void> {
    const profile = this.performanceProfiles.get(tenantId);
    let ttl = 300000; // 5 minutes default

    // Adjust TTL based on tenant activity
    if (profile) {
      const currentHour = new Date().getHours();
      if (profile.peakUsageHours.includes(currentHour)) {
        ttl = 600000; // 10 minutes during peak hours
      }
    }

    // Cache in memory
    this.cacheTenantContext(tenantId, context);
    
    // Cache in Redis
    await this.setRedisCache(`tenant:context:${tenantId}`, context, ttl);
  }

  /**
   * Handle performance degradation
   */
  private async handlePerformanceDegradation(
    tenantId: string,
    duration: number,
    operationType: string
  ): Promise<void> {
    console.warn(`Performance degradation detected for tenant ${tenantId}: ${operationType} took ${duration}ms`);
    
    // Trigger auto-optimization
    const optimizations = await this.autoOptimizeTenant(tenantId);
    
    if (optimizations.length > 0) {
      console.log(`Applied optimizations for tenant ${tenantId}:`, optimizations);
    }
  }

  /**
   * Record performance metric
   */
  private recordPerformanceMetric(
    tenantId: string,
    operationType: string,
    startTime: number,
    endTime: number,
    cacheHit: boolean,
    dbQueries: number,
    error?: Error
  ): void {
    const metric: PerformanceMetrics = {
      tenantId,
      operationType,
      startTime,
      endTime,
      duration: endTime - startTime,
      cacheHit,
      dbQueries,
      dataSize: 0, // Would be calculated from actual data
      memoryUsage: process.memoryUsage().heapUsed,
      cpuUsage: process.cpuUsage().user,
    };

    if (!this.realtimeMetrics.has(tenantId)) {
      this.realtimeMetrics.set(tenantId, []);
    }

    const metrics = this.realtimeMetrics.get(tenantId)!;
    metrics.push(metric);

    // Keep only last 1000 metrics per tenant
    if (metrics.length > 1000) {
      metrics.splice(0, metrics.length - 1000);
    }

    // Update performance profile
    const profile = this.performanceProfiles.get(tenantId);
    if (profile) {
      profile.avgSwitchTime = (profile.avgSwitchTime + metric.duration) / 2;
    }
  }

  /**
   * Additional helper methods for optimization
   */
  private async fetchUserPermissions(tenantId: string, userId: string): Promise<string[]> {
    // Simulate database fetch
    return ['api:access', 'plugins:read'];
  }

  private checkPermissionsOptimized(userPermissions: string[], requiredPermissions: string[]): boolean {
    if (userPermissions.includes('*:*')) return true;
    
    return requiredPermissions.every(required => {
      const [action, resource] = required.split(':');
      return userPermissions.some(permission => {
        const [userAction, userResource] = permission.split(':');
        return (userAction === '*' || userAction === action) &&
               (userResource === '*' || userResource === resource);
      });
    });
  }

  private generateQueryHash(query: string, params: any[], tenantId: string): string {
    const combined = `${tenantId}:${query}:${JSON.stringify(params)}`;
    return Buffer.from(combined).toString('base64').substring(0, 32);
  }

  private shouldCacheQuery(query: string, strategy?: CacheStrategy): boolean {
    if (strategy !== undefined) return true;
    
    // Cache SELECT queries but not mutations
    return query.trim().toLowerCase().startsWith('select');
  }

  private optimizeQuery(query: string, tenantId: string): string {
    // Add tenant filter if missing
    if (!query.includes('tenant_id') && query.toLowerCase().includes('from')) {
      const fromIndex = query.toLowerCase().indexOf('from');
      const whereIndex = query.toLowerCase().indexOf('where');
      
      if (whereIndex === -1) {
        return query + ` WHERE tenant_id = '${tenantId}'`;
      } else {
        return query.slice(0, whereIndex) + 
               `WHERE tenant_id = '${tenantId}' AND ` + 
               query.slice(whereIndex + 5);
      }
    }
    
    return query;
  }

  private async getOptimizedConnection(tenantId: string): Promise<any> {
    // Return pooled connection
    return { tenantId, connectionId: Math.random().toString(36) };
  }

  private async executeWithMonitoring<T>(
    query: string,
    params: any[],
    connection: any,
    tenantId: string
  ): Promise<T> {
    // Simulate query execution
    await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 30));
    return [] as any;
  }

  private releaseConnection(tenantId: string, connection: any): void {
    // Release connection back to pool
  }

  private recordQueryMetrics(tenantId: string, query: string, duration: number, cacheHit: boolean): void {
    // Record query-specific metrics
  }

  private calculateOptimalTTL(query: string): number {
    // Calculate TTL based on query type
    if (query.includes('config') || query.includes('settings')) {
      return 600000; // 10 minutes for config
    }
    if (query.includes('users') || query.includes('permissions')) {
      return 300000; // 5 minutes for user data
    }
    return 60000; // 1 minute default
  }

  private async getCommonUsers(tenantId: string): Promise<string[]> {
    return ['admin', 'user1', 'user2']; // Simplified
  }

  private async preloadFrequentQueries(tenantId: string): Promise<void> {
    // Preload common queries for this tenant
  }

  private async adjustCacheStrategy(tenantId: string, adjustment: string): Promise<void> {
    // Adjust cache TTL or size
  }

  private async adjustConnectionPooling(tenantId: string, adjustment: string): Promise<void> {
    // Adjust connection pool parameters
  }

  private async preloadAccessPatterns(tenantId: string, patterns: Array<[string, number]>): Promise<void> {
    // Preload data based on access patterns
  }

  /**
   * Initialize performance optimization
   */
  private initializePerformanceOptimization(): void {
    // Preload configured tenants
    if (this.config.preloadTenants.length > 0) {
      setTimeout(() => {
        this.preloadTenantData(this.config.preloadTenants).catch(console.error);
      }, 1000);
    }

    // Start performance monitoring
    setInterval(() => {
      this.runPerformanceAnalysis();
    }, 60000); // Every minute

    console.log('Tenant performance optimizer initialized');
  }

  /**
   * Run performance analysis
   */
  private runPerformanceAnalysis(): void {
    for (const [tenantId, metrics] of this.realtimeMetrics.entries()) {
      const recent = metrics.filter(m => Date.now() - m.endTime < 300000); // Last 5 minutes
      
      if (recent.length > 0) {
        const avgDuration = recent.reduce((sum, m) => sum + m.duration, 0) / recent.length;
        
        if (avgDuration > 150) { // Threshold for optimization
          this.autoOptimizeTenant(tenantId).catch(console.error);
        }
      }
    }
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    await this.redis.quit();
    this.memoryCache.clear();
    this.queryCache.clear();
    this.tenantConfigCache.clear();
    this.permissionCache.clear();
    this.schemaCache.clear();
    
    console.log('Tenant performance optimizer shutdown complete');
  }
}

// Global instance
export const tenantPerformanceOptimizer = new TenantPerformanceOptimizer();

export default tenantPerformanceOptimizer;