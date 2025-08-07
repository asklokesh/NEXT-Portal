import { z } from 'zod';
import winston from 'winston';
import Redis from 'ioredis';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'rate-limiting.log' })
  ]
});

// Rate limiting configuration schemas
export const RateLimitConfigSchema = z.object({
  windowMs: z.number().min(1000), // Minimum 1 second
  max: z.number().min(1), // Maximum requests
  message: z.string().default('Rate limit exceeded. Please try again later.'),
  standardHeaders: z.boolean().default(true),
  legacyHeaders: z.boolean().default(false),
  skipSuccessfulRequests: z.boolean().default(false),
  skipFailedRequests: z.boolean().default(false),
  keyGenerator: z.function().optional(),
  skip: z.function().optional(),
  onLimitReached: z.function().optional()
});

export const RateLimitTierSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  limits: z.object({
    perSecond: z.number().optional(),
    perMinute: z.number().optional(),
    perHour: z.number().optional(),
    perDay: z.number().optional()
  }),
  burstLimit: z.number().optional(), // Allow burst above normal rate
  priority: z.number().default(0), // Higher priority = more lenient limits
  enabled: z.boolean().default(true)
});

export const RateLimitRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  pattern: z.string(), // URL pattern or regex
  method: z.array(z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])).default(['*']),
  tierId: z.string(),
  userTypes: z.array(z.string()).default([]), // Empty means all users
  ipWhitelist: z.array(z.string()).default([]),
  ipBlacklist: z.array(z.string()).default([]),
  enabled: z.boolean().default(true),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date())
});

export type RateLimitConfig = z.infer<typeof RateLimitConfigSchema>;
export type RateLimitTier = z.infer<typeof RateLimitTierSchema>;
export type RateLimitRule = z.infer<typeof RateLimitRuleSchema>;

interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  total: number;
}

interface RateLimitResult {
  allowed: boolean;
  info: RateLimitInfo;
  retryAfter?: number; // seconds
}

// Redis-based rate limiter using sliding window log algorithm
export class RedisRateLimiter {
  private redis: Redis;
  private keyPrefix: string = 'rate_limit';

  constructor(redis: Redis, keyPrefix = 'rate_limit') {
    this.redis = redis;
    this.keyPrefix = keyPrefix;
  }

  async checkLimit(
    identifier: string,
    windowMs: number,
    maxRequests: number
  ): Promise<RateLimitResult> {
    const key = `${this.keyPrefix}:${identifier}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Use Redis pipeline for atomic operations
    const pipeline = this.redis.pipeline();
    
    // Remove expired entries
    pipeline.zremrangebyscore(key, '-inf', windowStart);
    
    // Count current requests in window
    pipeline.zcard(key);
    
    // Add current request
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    
    // Set expiration
    pipeline.expire(key, Math.ceil(windowMs / 1000));
    
    const results = await pipeline.exec();
    
    if (!results) {
      throw new Error('Redis pipeline execution failed');
    }

    const currentCount = (results[1][1] as number) + 1; // +1 for the request we just added
    const allowed = currentCount <= maxRequests;
    const remaining = Math.max(0, maxRequests - currentCount);
    const reset = new Date(now + windowMs);

    if (!allowed) {
      // Remove the request we just added since it's not allowed
      await this.redis.zrem(key, `${now}-${Math.random()}`);
    }

    logger.debug('Rate limit check', {
      identifier,
      windowMs,
      maxRequests,
      currentCount,
      allowed,
      remaining
    });

    return {
      allowed,
      info: {
        limit: maxRequests,
        remaining,
        reset,
        total: currentCount
      },
      retryAfter: allowed ? undefined : Math.ceil(windowMs / 1000)
    };
  }

  async resetLimit(identifier: string): Promise<void> {
    const key = `${this.keyPrefix}:${identifier}`;
    await this.redis.del(key);
    
    logger.info('Rate limit reset', { identifier });
  }

  async getLimitInfo(identifier: string, windowMs: number): Promise<{ count: number; oldestRequest: Date | null }> {
    const key = `${this.keyPrefix}:${identifier}`;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Get count and oldest request in current window
    const pipeline = this.redis.pipeline();
    pipeline.zremrangebyscore(key, '-inf', windowStart);
    pipeline.zcard(key);
    pipeline.zrange(key, 0, 0, 'WITHSCORES');
    
    const results = await pipeline.exec();
    
    if (!results) {
      return { count: 0, oldestRequest: null };
    }
    
    const count = results[1][1] as number;
    const oldestData = results[2][1] as string[];
    const oldestRequest = oldestData.length > 0 ? new Date(parseFloat(oldestData[1])) : null;
    
    return { count, oldestRequest };
  }
}

// Token bucket rate limiter for burst handling
export class TokenBucketLimiter {
  private redis: Redis;
  private keyPrefix: string = 'token_bucket';

  constructor(redis: Redis, keyPrefix = 'token_bucket') {
    this.redis = redis;
    this.keyPrefix = keyPrefix;
  }

  async checkLimit(
    identifier: string,
    capacity: number,
    refillRate: number, // tokens per second
    tokensRequested = 1
  ): Promise<RateLimitResult> {
    const key = `${this.keyPrefix}:${identifier}`;
    const now = Date.now() / 1000; // Convert to seconds
    
    const script = `
      local key = KEYS[1]
      local capacity = tonumber(ARGV[1])
      local refill_rate = tonumber(ARGV[2])
      local tokens_requested = tonumber(ARGV[3])
      local now = tonumber(ARGV[4])
      
      local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
      local tokens = tonumber(bucket[1]) or capacity
      local last_refill = tonumber(bucket[2]) or now
      
      -- Calculate tokens to add based on time passed
      local time_passed = math.max(0, now - last_refill)
      local new_tokens = math.min(capacity, tokens + (time_passed * refill_rate))
      
      local allowed = new_tokens >= tokens_requested
      
      if allowed then
        new_tokens = new_tokens - tokens_requested
      end
      
      -- Update bucket
      redis.call('HMSET', key, 'tokens', new_tokens, 'last_refill', now)
      redis.call('EXPIRE', key, 3600) -- 1 hour expiry
      
      return {allowed and 1 or 0, new_tokens, capacity}
    `;
    
    const result = await this.redis.eval(
      script,
      1,
      key,
      capacity,
      refillRate,
      tokensRequested,
      now
    ) as [number, number, number];
    
    const [allowed, remainingTokens, totalCapacity] = result;
    const isAllowed = allowed === 1;
    
    logger.debug('Token bucket check', {
      identifier,
      capacity,
      refillRate,
      tokensRequested,
      remainingTokens,
      allowed: isAllowed
    });
    
    return {
      allowed: isAllowed,
      info: {
        limit: totalCapacity,
        remaining: Math.floor(remainingTokens),
        reset: new Date(Date.now() + (totalCapacity - remainingTokens) / refillRate * 1000),
        total: totalCapacity - Math.floor(remainingTokens)
      },
      retryAfter: isAllowed ? undefined : Math.ceil((tokensRequested - remainingTokens) / refillRate)
    };
  }
}

// Main rate limiting engine
export class RateLimitingEngine {
  private redis: Redis;
  private slidingWindowLimiter: RedisRateLimiter;
  private tokenBucketLimiter: TokenBucketLimiter;
  private tiers: Map<string, RateLimitTier> = new Map();
  private rules: Map<string, RateLimitRule> = new Map();
  
  constructor(redisUrl?: string) {
    this.redis = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
    this.slidingWindowLimiter = new RedisRateLimiter(this.redis);
    this.tokenBucketLimiter = new TokenBucketLimiter(this.redis);
    
    this.initializeDefaultTiers();
    
    logger.info('Rate limiting engine initialized', { redisUrl: redisUrl || 'default' });
  }

  private initializeDefaultTiers() {
    const defaultTiers: RateLimitTier[] = [
      {
        id: 'free',
        name: 'Free Tier',
        description: 'Basic rate limits for free users',
        limits: {
          perMinute: 60,
          perHour: 1000,
          perDay: 10000
        },
        priority: 0,
        enabled: true
      },
      {
        id: 'premium',
        name: 'Premium Tier',
        description: 'Higher limits for premium users',
        limits: {
          perMinute: 300,
          perHour: 10000,
          perDay: 100000
        },
        burstLimit: 500,
        priority: 10,
        enabled: true
      },
      {
        id: 'enterprise',
        name: 'Enterprise Tier',
        description: 'Very high limits for enterprise customers',
        limits: {
          perMinute: 1000,
          perHour: 50000,
          perDay: 1000000
        },
        burstLimit: 2000,
        priority: 20,
        enabled: true
      },
      {
        id: 'internal',
        name: 'Internal Services',
        description: 'High limits for internal service-to-service communication',
        limits: {
          perSecond: 100,
          perMinute: 5000,
          perHour: 100000
        },
        priority: 30,
        enabled: true
      }
    ];

    defaultTiers.forEach(tier => {
      this.tiers.set(tier.id, tier);
    });
  }

  // Tier management
  addTier(tier: RateLimitTier): void {
    try {
      const validatedTier = RateLimitTierSchema.parse(tier);
      this.tiers.set(validatedTier.id, validatedTier);
      
      logger.info('Rate limit tier added', {
        tierId: validatedTier.id,
        name: validatedTier.name
      });
    } catch (error) {
      logger.error('Failed to add rate limit tier', { error: error.message });
      throw error;
    }
  }

  updateTier(tierId: string, updates: Partial<RateLimitTier>): void {
    const existingTier = this.tiers.get(tierId);
    if (!existingTier) {
      throw new Error(`Rate limit tier ${tierId} not found`);
    }

    const updatedTier = { ...existingTier, ...updates };
    const validatedTier = RateLimitTierSchema.parse(updatedTier);
    this.tiers.set(tierId, validatedTier);
    
    logger.info('Rate limit tier updated', { tierId, updates: Object.keys(updates) });
  }

  removeTier(tierId: string): void {
    if (!this.tiers.has(tierId)) {
      throw new Error(`Rate limit tier ${tierId} not found`);
    }

    this.tiers.delete(tierId);
    logger.info('Rate limit tier removed', { tierId });
  }

  getTier(tierId: string): RateLimitTier | undefined {
    return this.tiers.get(tierId);
  }

  getAllTiers(): RateLimitTier[] {
    return Array.from(this.tiers.values());
  }

  // Rule management
  addRule(rule: RateLimitRule): void {
    try {
      const validatedRule = RateLimitRuleSchema.parse(rule);
      this.rules.set(validatedRule.id, validatedRule);
      
      logger.info('Rate limit rule added', {
        ruleId: validatedRule.id,
        pattern: validatedRule.pattern,
        tierId: validatedRule.tierId
      });
    } catch (error) {
      logger.error('Failed to add rate limit rule', { error: error.message });
      throw error;
    }
  }

  removeRule(ruleId: string): void {
    if (!this.rules.has(ruleId)) {
      throw new Error(`Rate limit rule ${ruleId} not found`);
    }

    this.rules.delete(ruleId);
    logger.info('Rate limit rule removed', { ruleId });
  }

  getAllRules(): RateLimitRule[] {
    return Array.from(this.rules.values());
  }

  // Main rate limiting logic
  async checkRateLimit({
    ip,
    userId,
    userType,
    path,
    method
  }: {
    ip: string;
    userId?: string;
    userType?: string;
    path: string;
    method: string;
  }): Promise<RateLimitResult> {
    try {
      // Find matching rule
      const rule = this.findMatchingRule(path, method, userType);
      if (!rule || !rule.enabled) {
        // No rule found, allow request
        return {
          allowed: true,
          info: {
            limit: Infinity,
            remaining: Infinity,
            reset: new Date(Date.now() + 60000),
            total: 0
          }
        };
      }

      // Check IP blacklist
      if (rule.ipBlacklist.some(blockedIp => this.matchesIpPattern(ip, blockedIp))) {
        logger.warn('Request blocked by IP blacklist', { ip, rule: rule.id });
        return {
          allowed: false,
          info: {
            limit: 0,
            remaining: 0,
            reset: new Date(Date.now() + 3600000), // 1 hour
            total: 1
          },
          retryAfter: 3600
        };
      }

      // Check IP whitelist (if exists, bypass rate limiting)
      if (rule.ipWhitelist.length > 0 && 
          rule.ipWhitelist.some(allowedIp => this.matchesIpPattern(ip, allowedIp))) {
        logger.debug('Request allowed by IP whitelist', { ip, rule: rule.id });
        return {
          allowed: true,
          info: {
            limit: Infinity,
            remaining: Infinity,
            reset: new Date(Date.now() + 60000),
            total: 0
          }
        };
      }

      const tier = this.tiers.get(rule.tierId);
      if (!tier || !tier.enabled) {
        logger.warn('Rate limit tier not found or disabled', { tierId: rule.tierId });
        return {
          allowed: true,
          info: {
            limit: Infinity,
            remaining: Infinity,
            reset: new Date(Date.now() + 60000),
            total: 0
          }
        };
      }

      // Create identifier (prefer userId over IP)
      const identifier = userId ? `user:${userId}` : `ip:${ip}`;
      
      // Check different time windows in order of precedence
      const checks = [];
      
      if (tier.limits.perSecond) {
        checks.push({
          window: 1000,
          limit: tier.limits.perSecond,
          name: 'per_second'
        });
      }
      
      if (tier.limits.perMinute) {
        checks.push({
          window: 60000,
          limit: tier.limits.perMinute,
          name: 'per_minute'
        });
      }
      
      if (tier.limits.perHour) {
        checks.push({
          window: 3600000,
          limit: tier.limits.perHour,
          name: 'per_hour'
        });
      }
      
      if (tier.limits.perDay) {
        checks.push({
          window: 86400000,
          limit: tier.limits.perDay,
          name: 'per_day'
        });
      }

      // Check each time window
      for (const check of checks) {
        const result = await this.slidingWindowLimiter.checkLimit(
          `${identifier}:${rule.id}:${check.name}`,
          check.window,
          check.limit
        );
        
        if (!result.allowed) {
          logger.info('Rate limit exceeded', {
            identifier,
            rule: rule.id,
            tier: tier.id,
            window: check.name,
            limit: check.limit,
            current: result.info.total
          });
          
          return result;
        }
      }

      // Check burst limit using token bucket
      if (tier.burstLimit) {
        const burstResult = await this.tokenBucketLimiter.checkLimit(
          `${identifier}:${rule.id}:burst`,
          tier.burstLimit,
          tier.limits.perMinute ? tier.limits.perMinute / 60 : 1 // Convert per minute to per second
        );
        
        if (!burstResult.allowed) {
          logger.info('Burst limit exceeded', {
            identifier,
            rule: rule.id,
            tier: tier.id,
            burstLimit: tier.burstLimit
          });
          
          return burstResult;
        }
      }

      // All checks passed
      return {
        allowed: true,
        info: {
          limit: Math.min(...checks.map(c => c.limit)),
          remaining: Math.max(0, Math.min(...checks.map(c => c.limit)) - 1),
          reset: new Date(Date.now() + Math.min(...checks.map(c => c.window))),
          total: 1
        }
      };
    } catch (error) {
      logger.error('Rate limit check failed', {
        error: error.message,
        ip,
        userId,
        path,
        method
      });
      
      // On error, allow request but log for monitoring
      return {
        allowed: true,
        info: {
          limit: Infinity,
          remaining: Infinity,
          reset: new Date(Date.now() + 60000),
          total: 0
        }
      };
    }
  }

  private findMatchingRule(path: string, method: string, userType?: string): RateLimitRule | undefined {
    const enabledRules = Array.from(this.rules.values()).filter(rule => rule.enabled);
    
    // Sort by priority (higher tier priority = higher rule priority)
    const sortedRules = enabledRules.sort((a, b) => {
      const tierA = this.tiers.get(a.tierId);
      const tierB = this.tiers.get(b.tierId);
      return (tierB?.priority || 0) - (tierA?.priority || 0);
    });
    
    for (const rule of sortedRules) {
      // Check method match
      if (rule.method.length > 0 && !rule.method.includes('*') && !rule.method.includes(method)) {
        continue;
      }
      
      // Check user type match
      if (rule.userTypes.length > 0 && userType && !rule.userTypes.includes(userType)) {
        continue;
      }
      
      // Check path pattern match
      if (this.matchesPathPattern(path, rule.pattern)) {
        return rule;
      }
    }
    
    return undefined;
  }

  private matchesPathPattern(path: string, pattern: string): boolean {
    // Convert glob pattern to regex
    if (pattern.includes('*') || pattern.includes('?')) {
      const regexPattern = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
      return new RegExp(`^${regexPattern}$`).test(path);
    }
    
    // Exact match
    return path === pattern;
  }

  private matchesIpPattern(ip: string, pattern: string): boolean {
    // Support CIDR notation and exact IP matches
    if (pattern.includes('/')) {
      // CIDR notation - simplified check
      const [network, prefixLength] = pattern.split('/');
      const prefix = parseInt(prefixLength, 10);
      
      // Convert to binary and compare
      const ipParts = ip.split('.').map(part => parseInt(part, 10));
      const networkParts = network.split('.').map(part => parseInt(part, 10));
      
      const ipBinary = (ipParts[0] << 24) + (ipParts[1] << 16) + (ipParts[2] << 8) + ipParts[3];
      const networkBinary = (networkParts[0] << 24) + (networkParts[1] << 16) + (networkParts[2] << 8) + networkParts[3];
      
      const mask = (-1 << (32 - prefix)) >>> 0;
      
      return (ipBinary & mask) === (networkBinary & mask);
    }
    
    return ip === pattern;
  }

  // Reset rate limits
  async resetUserLimits(userId: string): Promise<void> {
    const identifier = `user:${userId}`;
    const pattern = `rate_limit:${identifier}:*`;
    
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
    
    logger.info('User rate limits reset', { userId, keysDeleted: keys.length });
  }

  async resetIpLimits(ip: string): Promise<void> {
    const identifier = `ip:${ip}`;
    const pattern = `rate_limit:${identifier}:*`;
    
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
    
    logger.info('IP rate limits reset', { ip, keysDeleted: keys.length });
  }

  // Get current usage stats
  async getUsageStats(identifier: string): Promise<{
    rules: Array<{
      ruleId: string;
      windows: Array<{
        name: string;
        count: number;
        limit: number;
        oldestRequest: Date | null;
      }>;
    }>;
  }> {
    const stats: any = { rules: [] };
    
    for (const [ruleId, rule] of this.rules) {
      if (!rule.enabled) continue;
      
      const tier = this.tiers.get(rule.tierId);
      if (!tier || !tier.enabled) continue;
      
      const windows = [];
      
      const checks = [
        { name: 'per_second', window: 1000, limit: tier.limits.perSecond },
        { name: 'per_minute', window: 60000, limit: tier.limits.perMinute },
        { name: 'per_hour', window: 3600000, limit: tier.limits.perHour },
        { name: 'per_day', window: 86400000, limit: tier.limits.perDay }
      ].filter(check => check.limit !== undefined);
      
      for (const check of checks) {
        const info = await this.slidingWindowLimiter.getLimitInfo(
          `${identifier}:${ruleId}:${check.name}`,
          check.window!
        );
        
        windows.push({
          name: check.name,
          count: info.count,
          limit: check.limit!,
          oldestRequest: info.oldestRequest
        });
      }
      
      stats.rules.push({ ruleId, windows });
    }
    
    return stats;
  }

  // Health check
  async healthCheck(): Promise<{ status: string; redis: string; tiers: number; rules: number }> {
    try {
      await this.redis.ping();
      return {
        status: 'healthy',
        redis: 'connected',
        tiers: this.tiers.size,
        rules: this.rules.size
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        redis: 'disconnected',
        tiers: this.tiers.size,
        rules: this.rules.size
      };
    }
  }

  // Close Redis connection
  async close(): Promise<void> {
    await this.redis.quit();
    logger.info('Rate limiting engine closed');
  }
}

// Singleton instance
let rateLimitingEngine: RateLimitingEngine | null = null;

export function getRateLimitingEngine(redisUrl?: string): RateLimitingEngine {
  if (!rateLimitingEngine) {
    rateLimitingEngine = new RateLimitingEngine(redisUrl);
  }
  return rateLimitingEngine;
}

export default RateLimitingEngine;