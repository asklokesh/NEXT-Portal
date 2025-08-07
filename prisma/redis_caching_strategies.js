// ============================================
// REDIS CACHING STRATEGIES FOR PLUGIN MANAGEMENT
// High-Performance Caching and Invalidation Patterns
// ============================================

const Redis = require('ioredis');
const { createHash } = require('crypto');

// ============================================
// CACHE CONFIGURATION AND SETUP
// ============================================

class PluginCacheManager {
  constructor(redisConfig = {}) {
    // Redis cluster configuration for high availability
    this.redis = new Redis.Cluster([
      { host: redisConfig.host || 'localhost', port: redisConfig.port || 6379 }
    ], {
      enableAutoPipelining: true,
      retryDelayOnFailover: 100,
      redisOptions: {
        password: redisConfig.password,
        keyPrefix: redisConfig.keyPrefix || 'plugin:',
        db: redisConfig.db || 0,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        commandTimeout: 5000
      }
    });
    
    // Fallback to single Redis instance if cluster fails
    this.redis.on('error', (err) => {
      if (err.message.includes('CLUSTER')) {
        console.warn('Cluster not available, falling back to single instance');
        this.redis = new Redis(redisConfig);
      }
    });
    
    // Cache TTL configurations (in seconds)
    this.ttl = {
      // Plugin metadata - long lived, infrequently changed
      pluginCatalog: 3600,      // 1 hour
      pluginConfig: 1800,       // 30 minutes
      pluginVersions: 2400,     // 40 minutes
      
      // Usage and analytics - medium lived
      pluginStats: 900,         // 15 minutes
      userPreferences: 1200,    // 20 minutes
      
      // Dynamic data - short lived
      activeUsers: 300,         // 5 minutes
      systemHealth: 180,        // 3 minutes
      searchResults: 600,       // 10 minutes
      
      // Session and temporary data
      rateLimits: 3600,         // 1 hour
      apiResponses: 300,        // 5 minutes
      
      // Long-term stable data
      organizationData: 7200,   // 2 hours
      tenantConfig: 3600,       // 1 hour
      
      // Computed aggregations
      analytics: 1800,          // 30 minutes
      reports: 3600            // 1 hour
    };
    
    // Cache key patterns
    this.keyPatterns = {
      plugin: (id) => `plugin:${id}`,
      pluginVersion: (id, version) => `plugin:${id}:version:${version}`,
      pluginConfig: (id, env) => `plugin:${id}:config:${env}`,
      pluginDeps: (id) => `plugin:${id}:dependencies`,
      pluginStats: (id, period) => `plugin:${id}:stats:${period}`,
      
      tenant: (id) => `tenant:${id}`,
      tenantPlugins: (id) => `tenant:${id}:plugins`,
      tenantConfig: (id) => `tenant:${id}:config`,
      
      user: (id) => `user:${id}`,
      userPrefs: (id) => `user:${id}:preferences`,
      userSessions: (id) => `user:${id}:sessions`,
      
      analytics: (plugin, metric, period) => `analytics:${plugin}:${metric}:${period}`,
      search: (query, filters) => `search:${this.hashKey(query + JSON.stringify(filters))}`,
      
      rateLimit: (identifier, action) => `ratelimit:${identifier}:${action}`,
      
      system: (component) => `system:${component}`,
      health: () => 'health:status',
      
      // Lock patterns for distributed operations
      lock: (resource) => `lock:${resource}`,
      
      // Invalidation patterns
      invalidation: (pattern) => `invalidation:${pattern}`
    };
  }
  
  // ============================================
  // CORE CACHING METHODS
  // ============================================
  
  async get(key, fallback = null) {
    try {
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : fallback;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return fallback;
    }
  }
  
  async set(key, value, ttl = this.ttl.pluginConfig) {
    try {
      const serialized = JSON.stringify(value);
      await this.redis.setex(key, ttl, serialized);
      
      // Track cache writes for analytics
      await this.incrementCounter('cache:writes');
      
      return true;
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }
  
  async del(key) {
    try {
      return await this.redis.del(key);
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }
  
  async exists(key) {
    try {
      return await this.redis.exists(key);
    } catch (error) {
      console.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }
  
  // ============================================
  // PLUGIN-SPECIFIC CACHING METHODS
  // ============================================
  
  // Cache plugin metadata with dependencies
  async cachePlugin(plugin) {
    const key = this.keyPatterns.plugin(plugin.id);
    
    // Cache main plugin data
    await this.set(key, {
      ...plugin,
      cachedAt: new Date().toISOString()
    }, this.ttl.pluginCatalog);
    
    // Cache plugin versions separately for faster access
    if (plugin.versions) {
      for (const version of plugin.versions) {
        await this.set(
          this.keyPatterns.pluginVersion(plugin.id, version.version),
          version,
          this.ttl.pluginVersions
        );
      }
    }
    
    // Cache plugin dependencies graph
    if (plugin.dependencies) {
      await this.set(
        this.keyPatterns.pluginDeps(plugin.id),
        plugin.dependencies,
        this.ttl.pluginCatalog
      );
    }
    
    // Add to tenant's plugin list
    if (plugin.tenantId) {
      await this.addToSet(
        this.keyPatterns.tenantPlugins(plugin.tenantId),
        plugin.id
      );
    }
    
    return true;
  }
  
  // Get plugin with hierarchical caching
  async getPlugin(pluginId, options = {}) {
    const key = this.keyPatterns.plugin(pluginId);
    let plugin = await this.get(key);
    
    if (!plugin && options.fallback) {
      // Fallback to database
      plugin = await options.fallback(pluginId);
      if (plugin) {
        await this.cachePlugin(plugin);
      }
    }
    
    // Attach cached versions if requested
    if (plugin && options.includeVersions) {
      plugin.versions = await this.getPluginVersions(pluginId);
    }
    
    // Attach cached dependencies if requested
    if (plugin && options.includeDependencies) {
      plugin.dependencies = await this.get(this.keyPatterns.pluginDeps(pluginId));
    }
    
    return plugin;
  }
  
  // Cache plugin configuration with environment-specific keys
  async cachePluginConfig(pluginId, environment, config) {
    const key = this.keyPatterns.pluginConfig(pluginId, environment);
    await this.set(key, {
      config,
      environment,
      cachedAt: new Date().toISOString()
    }, this.ttl.pluginConfig);
    
    // Invalidate related caches
    await this.invalidatePattern(`plugin:${pluginId}:*`);
    
    return true;
  }
  
  // Get plugin versions with caching
  async getPluginVersions(pluginId) {
    const pattern = `plugin:${pluginId}:version:*`;
    const keys = await this.redis.keys(pattern);
    
    if (keys.length === 0) return [];
    
    const versions = await this.redis.mget(keys);
    return versions
      .filter(v => v !== null)
      .map(v => JSON.parse(v))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  
  // ============================================
  // ANALYTICS AND METRICS CACHING
  // ============================================
  
  // Cache plugin analytics with time-series structure
  async cachePluginAnalytics(pluginId, metric, period, data) {
    const key = this.keyPatterns.analytics(pluginId, metric, period);
    
    // Use Redis time-series data structure if available
    if (this.redis.TS) {
      await this.redis.ts_add(key, '*', data.value, 'LABELS', 'plugin', pluginId, 'metric', metric);
    } else {
      // Fallback to hash storage
      await this.redis.hset(key, Date.now(), JSON.stringify(data));
      await this.redis.expire(key, this.ttl.analytics);
    }
    
    return true;
  }
  
  // Get aggregated analytics with caching
  async getPluginAnalytics(pluginId, metrics = [], period = '24h') {
    const cacheKey = `analytics:aggregated:${pluginId}:${period}:${metrics.join(',')}`;
    
    let analytics = await this.get(cacheKey);
    if (analytics) {
      return analytics;
    }
    
    // If not cached, compute and cache
    analytics = {};
    
    for (const metric of metrics) {
      const key = this.keyPatterns.analytics(pluginId, metric, period);
      
      if (this.redis.TS) {
        // Use TimeSeries aggregation
        const result = await this.redis.ts_range(key, '-', '+', 'AGGREGATION', 'AVG', 3600);
        analytics[metric] = result;
      } else {
        // Fallback to hash aggregation
        const data = await this.redis.hgetall(key);
        analytics[metric] = Object.values(data).map(v => JSON.parse(v));
      }
    }
    
    // Cache the aggregated result
    await this.set(cacheKey, analytics, this.ttl.analytics);
    
    return analytics;
  }
  
  // ============================================
  // SEARCH RESULT CACHING
  // ============================================
  
  // Cache search results with intelligent key generation
  async cacheSearchResults(query, filters, results, pagination = {}) {
    const searchKey = this.keyPatterns.search(query, filters);
    
    const cachedResult = {
      query,
      filters,
      results,
      pagination,
      totalCount: results.length,
      cachedAt: new Date().toISOString(),
      ttl: this.ttl.searchResults
    };
    
    await this.set(searchKey, cachedResult, this.ttl.searchResults);
    
    // Track popular searches
    await this.incrementCounter(`search:popular:${this.hashKey(query)}`);
    
    return searchKey;
  }
  
  // Get cached search results
  async getCachedSearchResults(query, filters) {
    const searchKey = this.keyPatterns.search(query, filters);
    return await this.get(searchKey);
  }
  
  // ============================================
  // RATE LIMITING
  // ============================================
  
  // Implement sliding window rate limiting
  async checkRateLimit(identifier, action, limit, windowSizeSeconds = 3600) {
    const key = this.keyPatterns.rateLimit(identifier, action);
    const now = Date.now();
    const windowStart = now - (windowSizeSeconds * 1000);
    
    // Use sorted sets for sliding window
    const pipe = this.redis.pipeline();
    
    // Remove old entries
    pipe.zremrangebyscore(key, 0, windowStart);
    
    // Count current entries
    pipe.zcard(key);
    
    // Add current request
    pipe.zadd(key, now, `${now}-${Math.random()}`);
    
    // Set expiration
    pipe.expire(key, windowSizeSeconds);
    
    const results = await pipe.exec();
    const currentCount = results[1][1];
    
    return {
      allowed: currentCount < limit,
      currentCount,
      limit,
      remainingRequests: Math.max(0, limit - currentCount),
      resetTime: new Date(now + (windowSizeSeconds * 1000))
    };
  }
  
  // ============================================
  // DISTRIBUTED LOCKING
  // ============================================
  
  // Acquire distributed lock with TTL
  async acquireLock(resource, ttl = 30000, retryCount = 3) {
    const lockKey = this.keyPatterns.lock(resource);
    const lockValue = `${Date.now()}-${Math.random()}`;
    
    for (let i = 0; i < retryCount; i++) {
      const result = await this.redis.set(lockKey, lockValue, 'PX', ttl, 'NX');
      
      if (result === 'OK') {
        return {
          acquired: true,
          lockKey,
          lockValue,
          release: () => this.releaseLock(lockKey, lockValue)
        };
      }
      
      // Wait before retry
      await this.sleep(100 + (i * 100));
    }
    
    return { acquired: false };
  }
  
  // Release distributed lock
  async releaseLock(lockKey, lockValue) {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    
    return await this.redis.eval(script, 1, lockKey, lockValue);
  }
  
  // ============================================
  // CACHE INVALIDATION PATTERNS
  // ============================================
  
  // Pattern-based cache invalidation
  async invalidatePattern(pattern) {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(keys);
        await this.trackInvalidation(pattern, keys.length);
      }
      return keys.length;
    } catch (error) {
      console.error(`Cache invalidation error for pattern ${pattern}:`, error);
      return 0;
    }
  }
  
  // Event-driven cache invalidation
  async invalidateOnEvent(eventType, eventData) {
    const invalidationRules = {
      'plugin.updated': (data) => [\n        this.keyPatterns.plugin(data.pluginId),\n        `plugin:${data.pluginId}:*`,\n        this.keyPatterns.tenantPlugins(data.tenantId)\n      ],\n      'plugin.version.published': (data) => [\n        this.keyPatterns.pluginVersion(data.pluginId, data.version),\n        this.keyPatterns.plugin(data.pluginId),\n        `analytics:${data.pluginId}:*`\n      ],\n      'plugin.config.changed': (data) => [\n        this.keyPatterns.pluginConfig(data.pluginId, data.environment),\n        `plugin:${data.pluginId}:*`\n      ],\n      'user.preferences.updated': (data) => [\n        this.keyPatterns.userPrefs(data.userId),\n        `search:*` // User preferences might affect search results\n      ],\n      'tenant.config.updated': (data) => [\n        this.keyPatterns.tenantConfig(data.tenantId),\n        this.keyPatterns.tenantPlugins(data.tenantId)\n      ]\n    };\n    \n    const patterns = invalidationRules[eventType];\n    if (patterns && typeof patterns === 'function') {\n      const keysToInvalidate = patterns(eventData);\n      \n      for (const pattern of keysToInvalidate) {\n        if (pattern.includes('*')) {\n          await this.invalidatePattern(pattern);\n        } else {\n          await this.del(pattern);\n        }\n      }\n      \n      await this.trackInvalidation(eventType, keysToInvalidate.length);\n    }\n  }\n  \n  // Hierarchical cache invalidation\n  async invalidateHierarchy(rootKey, maxDepth = 3) {\n    const queue = [{ key: rootKey, depth: 0 }];\n    const invalidated = new Set();\n    \n    while (queue.length > 0) {\n      const { key, depth } = queue.shift();\n      \n      if (depth >= maxDepth || invalidated.has(key)) {\n        continue;\n      }\n      \n      // Invalidate current key\n      await this.del(key);\n      invalidated.add(key);\n      \n      // Find dependent keys\n      const dependentKeys = await this.findDependentKeys(key);\n      for (const depKey of dependentKeys) {\n        queue.push({ key: depKey, depth: depth + 1 });\n      }\n    }\n    \n    return invalidated.size;\n  }\n  \n  // ============================================\n  // CACHE WARMING STRATEGIES\n  // ============================================\n  \n  // Proactive cache warming for popular plugins\n  async warmPopularPlugins(limit = 50) {\n    try {\n      // Get popular plugins from counter\n      const popularPlugins = await this.getTopCounters('plugin:views:*', limit);\n      \n      const warmingTasks = popularPlugins.map(async (pluginData) => {\n        const pluginId = pluginData.key.split(':')[2];\n        \n        // Warm plugin data if not cached\n        const pluginKey = this.keyPatterns.plugin(pluginId);\n        if (!await this.exists(pluginKey)) {\n          // This would typically fetch from database\n          // await this.getPlugin(pluginId, { fallback: fetchFromDatabase });\n        }\n        \n        // Warm analytics data\n        await this.getPluginAnalytics(pluginId, ['views', 'installs', 'errors'], '24h');\n      });\n      \n      await Promise.allSettled(warmingTasks);\n      console.log(`Cache warming completed for ${limit} popular plugins`);\n    } catch (error) {\n      console.error('Cache warming error:', error);\n    }\n  }\n  \n  // ============================================\n  // CACHE ANALYTICS AND MONITORING\n  // ============================================\n  \n  // Track cache performance metrics\n  async trackCacheMetrics(operation, key, hit = null) {\n    const metricsKey = `cache:metrics:${operation}`;\n    const timestampKey = `${metricsKey}:${Math.floor(Date.now() / 60000)}`; // Per minute\n    \n    await this.redis.hincrby(timestampKey, 'total', 1);\n    \n    if (hit !== null) {\n      await this.redis.hincrby(timestampKey, hit ? 'hits' : 'misses', 1);\n    }\n    \n    // Set expiration for metrics\n    await this.redis.expire(timestampKey, 86400); // 24 hours\n  }\n  \n  // Get cache statistics\n  async getCacheStats(operation = null, timeRange = '1h') {\n    const endTime = Math.floor(Date.now() / 60000);\n    const startTime = endTime - (timeRange === '1h' ? 60 : timeRange === '1d' ? 1440 : 60);\n    \n    const pattern = operation ? `cache:metrics:${operation}:*` : 'cache:metrics:*';\n    const keys = await this.redis.keys(pattern);\n    \n    let totalHits = 0, totalMisses = 0, totalRequests = 0;\n    \n    for (const key of keys) {\n      const timestamp = parseInt(key.split(':').pop());\n      if (timestamp >= startTime && timestamp <= endTime) {\n        const metrics = await this.redis.hgetall(key);\n        totalHits += parseInt(metrics.hits || 0);\n        totalMisses += parseInt(metrics.misses || 0);\n        totalRequests += parseInt(metrics.total || 0);\n      }\n    }\n    \n    return {\n      hits: totalHits,\n      misses: totalMisses,\n      requests: totalRequests,\n      hitRate: totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0,\n      timeRange\n    };\n  }\n  \n  // ============================================\n  // UTILITY METHODS\n  // ============================================\n  \n  // Increment counter with expiration\n  async incrementCounter(key, increment = 1, ttl = 86400) {\n    const pipe = this.redis.pipeline();\n    pipe.incrby(key, increment);\n    pipe.expire(key, ttl);\n    return await pipe.exec();\n  }\n  \n  // Add to set with expiration\n  async addToSet(key, value, ttl = this.ttl.pluginCatalog) {\n    await this.redis.sadd(key, value);\n    await this.redis.expire(key, ttl);\n  }\n  \n  // Get top counters\n  async getTopCounters(pattern, limit = 10) {\n    const keys = await this.redis.keys(pattern);\n    const counters = [];\n    \n    for (const key of keys) {\n      const count = await this.redis.get(key);\n      if (count) {\n        counters.push({ key, count: parseInt(count) });\n      }\n    }\n    \n    return counters\n      .sort((a, b) => b.count - a.count)\n      .slice(0, limit);\n  }\n  \n  // Hash key generator for consistent caching\n  hashKey(input) {\n    return createHash('md5').update(input).digest('hex');\n  }\n  \n  // Sleep utility\n  sleep(ms) {\n    return new Promise(resolve => setTimeout(resolve, ms));\n  }\n  \n  // Track invalidation events\n  async trackInvalidation(pattern, count) {\n    await this.incrementCounter(`cache:invalidations:${pattern}`, count);\n    await this.incrementCounter('cache:invalidations:total', count);\n  }\n  \n  // Find dependent cache keys (simplified implementation)\n  async findDependentKeys(key) {\n    // This would contain logic to find keys that depend on the given key\n    // Implementation depends on your specific dependency graph\n    return [];\n  }\n  \n  // Health check\n  async healthCheck() {\n    try {\n      const start = Date.now();\n      await this.redis.ping();\n      const latency = Date.now() - start;\n      \n      const info = await this.redis.info('memory');\n      const usedMemory = info.match(/used_memory:(\\d+)/)?.[1] || 0;\n      \n      return {\n        status: 'healthy',\n        latency,\n        usedMemory: parseInt(usedMemory),\n        connected: this.redis.status === 'ready'\n      };\n    } catch (error) {\n      return {\n        status: 'unhealthy',\n        error: error.message,\n        connected: false\n      };\n    }\n  }\n  \n  // Cleanup and shutdown\n  async disconnect() {\n    await this.redis.quit();\n  }\n}\n\n// ============================================\n// CACHE INVALIDATION EVENT HANDLERS\n// ============================================\n\nclass CacheEventHandler {\n  constructor(cacheManager) {\n    this.cache = cacheManager;\n    this.setupEventListeners();\n  }\n  \n  setupEventListeners() {\n    // Plugin lifecycle events\n    this.on('plugin:created', this.handlePluginCreated.bind(this));\n    this.on('plugin:updated', this.handlePluginUpdated.bind(this));\n    this.on('plugin:deleted', this.handlePluginDeleted.bind(this));\n    this.on('plugin:version:published', this.handleVersionPublished.bind(this));\n    \n    // Configuration events\n    this.on('config:updated', this.handleConfigUpdated.bind(this));\n    \n    // User events\n    this.on('user:preferences:updated', this.handleUserPrefsUpdated.bind(this));\n    \n    // System events\n    this.on('system:maintenance', this.handleSystemMaintenance.bind(this));\n  }\n  \n  async handlePluginCreated(data) {\n    // Cache the new plugin\n    await this.cache.cachePlugin(data.plugin);\n    \n    // Invalidate search results and category listings\n    await this.cache.invalidatePattern('search:*');\n    await this.cache.invalidatePattern(`tenant:${data.plugin.tenantId}:*`);\n  }\n  \n  async handlePluginUpdated(data) {\n    // Invalidate plugin and related caches\n    await this.cache.invalidateOnEvent('plugin.updated', data);\n    \n    // Recache the updated plugin\n    await this.cache.cachePlugin(data.plugin);\n  }\n  \n  async handlePluginDeleted(data) {\n    // Remove all plugin-related caches\n    await this.cache.invalidatePattern(`plugin:${data.pluginId}:*`);\n    await this.cache.invalidatePattern(`analytics:${data.pluginId}:*`);\n  }\n  \n  async handleVersionPublished(data) {\n    await this.cache.invalidateOnEvent('plugin.version.published', data);\n  }\n  \n  async handleConfigUpdated(data) {\n    await this.cache.invalidateOnEvent('plugin.config.changed', data);\n  }\n  \n  async handleUserPrefsUpdated(data) {\n    await this.cache.invalidateOnEvent('user.preferences.updated', data);\n  }\n  \n  async handleSystemMaintenance(data) {\n    // Selective cache clearing during maintenance\n    if (data.type === 'full') {\n      await this.cache.redis.flushall();\n    } else if (data.type === 'analytics') {\n      await this.cache.invalidatePattern('analytics:*');\n      await this.cache.invalidatePattern('cache:metrics:*');\n    }\n  }\n  \n  // Event emitter interface\n  on(event, handler) {\n    // This would integrate with your event system (EventEmitter, Redis pub/sub, etc.)\n    // Simplified implementation\n    if (!this.listeners) this.listeners = {};\n    if (!this.listeners[event]) this.listeners[event] = [];\n    this.listeners[event].push(handler);\n  }\n  \n  async emit(event, data) {\n    if (this.listeners && this.listeners[event]) {\n      await Promise.all(\n        this.listeners[event].map(handler => handler(data))\n      );\n    }\n  }\n}\n\n// ============================================\n// USAGE EXAMPLES AND PATTERNS\n// ============================================\n\n/*\n// Initialize cache manager\nconst cacheManager = new PluginCacheManager({\n  host: 'redis-cluster.example.com',\n  port: 6379,\n  password: 'secure-password',\n  keyPrefix: 'saas-idp:'\n});\n\n// Initialize event handler\nconst eventHandler = new CacheEventHandler(cacheManager);\n\n// Example: Cache a plugin\nawait cacheManager.cachePlugin({\n  id: 'plugin-123',\n  name: '@backstage/plugin-kubernetes',\n  tenantId: 'tenant-456',\n  versions: [...],\n  dependencies: [...]\n});\n\n// Example: Get plugin with fallback\nconst plugin = await cacheManager.getPlugin('plugin-123', {\n  fallback: async (id) => {\n    // Fetch from database\n    return await pluginService.getById(id);\n  },\n  includeVersions: true,\n  includeDependencies: true\n});\n\n// Example: Cache search results\nconst results = await searchService.search('kubernetes', { category: 'MONITORING' });\nawait cacheManager.cacheSearchResults('kubernetes', { category: 'MONITORING' }, results);\n\n// Example: Check rate limit\nconst rateLimit = await cacheManager.checkRateLimit('user-123', 'api-calls', 100, 3600);\nif (!rateLimit.allowed) {\n  throw new Error('Rate limit exceeded');\n}\n\n// Example: Acquire distributed lock\nconst lock = await cacheManager.acquireLock('plugin-installation-456', 30000);\nif (lock.acquired) {\n  try {\n    // Perform critical operation\n    await installPlugin('plugin-456');\n  } finally {\n    await lock.release();\n  }\n}\n\n// Example: Handle events\nawait eventHandler.emit('plugin:updated', {\n  pluginId: 'plugin-123',\n  tenantId: 'tenant-456',\n  plugin: updatedPluginData\n});\n\n// Example: Get cache statistics\nconst stats = await cacheManager.getCacheStats('get', '1h');\nconsole.log(`Cache hit rate: ${stats.hitRate.toFixed(2)}%`);\n\n// Example: Warm cache\nawait cacheManager.warmPopularPlugins(100);\n*/\n\nmodule.exports = {\n  PluginCacheManager,\n  CacheEventHandler\n};