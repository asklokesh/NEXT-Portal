import { Redis } from 'ioredis';
import { z } from 'zod';

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator: (req: any) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  customMessage?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
}

export interface ThrottleConfig {
  delayAfter: number; // Start throttling after N requests
  delayMs: number; // Delay in milliseconds
  maxDelayMs?: number; // Maximum delay
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures to trigger circuit breaker
  timeout: number; // Time in ms to wait before retrying
  monitoringWindow: number; // Time window to monitor failures
  healthCheckInterval?: number; // Interval for health checks
}

const RateLimitResultSchema = z.object({
  allowed: boolean,
  remaining: number,
  reset: z.date(),
  totalHits: number,
});

export type RateLimitResult = z.infer<typeof RateLimitResultSchema>;

export class RateLimiter {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Check rate limit using sliding window algorithm
   */
  async checkRateLimit(
    key: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - config.windowMs;
    const redisKey = `rate_limit:${key}`;

    // Use Redis pipeline for atomic operations
    const pipeline = this.redis.pipeline();
    
    // Remove expired entries
    pipeline.zremrangebyscore(redisKey, '-inf', windowStart);
    
    // Count current requests in window
    pipeline.zcard(redisKey);
    
    // Add current request
    pipeline.zadd(redisKey, now, `${now}-${Math.random()}`);
    
    // Set expiration
    pipeline.expire(redisKey, Math.ceil(config.windowMs / 1000));

    const results = await pipeline.exec();
    
    if (!results || results.some(([error]) => error)) {
      throw new Error('Redis pipeline execution failed');
    }

    const currentRequests = results[1][1] as number;
    const allowed = currentRequests < config.maxRequests;
    
    if (!allowed) {
      // Remove the request we just added since it's not allowed
      await this.redis.zrem(redisKey, `${now}-${Math.random()}`);
    }

    return {
      allowed,
      remaining: Math.max(0, config.maxRequests - currentRequests - (allowed ? 1 : 0)),
      reset: new Date(now + config.windowMs),
      totalHits: currentRequests + (allowed ? 1 : 0),
    };
  }

  /**
   * Check rate limit using token bucket algorithm
   */
  async checkTokenBucket(
    key: string,
    capacity: number,
    refillRate: number, // tokens per second
    tokensRequested: number = 1
  ): Promise<{ allowed: boolean; tokensRemaining: number }> {
    const redisKey = `token_bucket:${key}`;
    const now = Date.now() / 1000;

    // Lua script for atomic token bucket operations
    const luaScript = `
      local key = KEYS[1]
      local capacity = tonumber(ARGV[1])
      local refill_rate = tonumber(ARGV[2])
      local tokens_requested = tonumber(ARGV[3])
      local now = tonumber(ARGV[4])
      
      local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
      local tokens = tonumber(bucket[1]) or capacity
      local last_refill = tonumber(bucket[2]) or now
      
      -- Calculate tokens to add based on time elapsed
      local elapsed = math.max(0, now - last_refill)
      local tokens_to_add = elapsed * refill_rate
      tokens = math.min(capacity, tokens + tokens_to_add)
      
      -- Check if we have enough tokens
      if tokens >= tokens_requested then
        tokens = tokens - tokens_requested
        redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
        redis.call('EXPIRE', key, 3600) -- Expire after 1 hour of inactivity
        return {1, tokens}
      else
        redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
        redis.call('EXPIRE', key, 3600)
        return {0, tokens}
      end
    `;

    const result = await this.redis.eval(
      luaScript,
      1,
      redisKey,
      capacity.toString(),
      refillRate.toString(),
      tokensRequested.toString(),
      now.toString()
    ) as [number, number];

    return {
      allowed: result[0] === 1,
      tokensRemaining: result[1],
    };
  }

  /**
   * Implement adaptive rate limiting based on system load
   */
  async adaptiveRateLimit(
    key: string,
    baseLimit: number,
    windowMs: number,
    loadFactor: number // 0.0 to 2.0, where 1.0 is normal load
  ): Promise<RateLimitResult> {
    const adjustedLimit = Math.floor(baseLimit / Math.max(0.1, loadFactor));
    
    return this.checkRateLimit(key, {
      windowMs,
      maxRequests: adjustedLimit,
      keyGenerator: () => key,
    });
  }

  /**
   * Implement distributed rate limiting across multiple instances
   */
  async distributedRateLimit(
    key: string,
    globalLimit: number,
    windowMs: number,
    instanceId: string
  ): Promise<RateLimitResult> {
    const globalKey = `global_rate_limit:${key}`;
    const instanceKey = `instance_rate_limit:${instanceId}:${key}`;
    
    // Get current global count
    const globalCount = await this.getGlobalCount(globalKey, windowMs);
    
    // Calculate instance quota (simple fair distribution)
    const instanceQuota = Math.max(1, Math.floor(globalLimit / 4)); // Assume max 4 instances
    
    // Check instance limit first
    const instanceResult = await this.checkRateLimit(instanceKey, {
      windowMs,
      maxRequests: instanceQuota,
      keyGenerator: () => instanceKey,
    });

    if (!instanceResult.allowed) {
      return instanceResult;
    }

    // Check global limit
    if (globalCount >= globalLimit) {
      return {
        allowed: false,
        remaining: 0,
        reset: new Date(Date.now() + windowMs),
        totalHits: globalCount,
      };
    }

    // Increment global counter
    await this.incrementGlobalCount(globalKey, windowMs);

    return {
      allowed: true,
      remaining: Math.max(0, globalLimit - globalCount - 1),
      reset: new Date(Date.now() + windowMs),
      totalHits: globalCount + 1,
    };
  }

  private async getGlobalCount(key: string, windowMs: number): Promise<number> {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    await this.redis.zremrangebyscore(key, '-inf', windowStart);
    return await this.redis.zcard(key);
  }

  private async incrementGlobalCount(key: string, windowMs: number): Promise<void> {
    const now = Date.now();
    await this.redis.zadd(key, now, `${now}-${Math.random()}`);
    await this.redis.expire(key, Math.ceil(windowMs / 1000));
  }
}

export class Throttler {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Implement progressive throttling
   */
  async throttle(
    key: string,
    config: ThrottleConfig
  ): Promise<{ shouldThrottle: boolean; delayMs: number }> {
    const redisKey = `throttle:${key}`;
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute window

    // Get request count in the last minute
    await this.redis.zremrangebyscore(redisKey, '-inf', windowStart);
    const requestCount = await this.redis.zcard(redisKey);

    if (requestCount < config.delayAfter) {
      // No throttling needed
      await this.redis.zadd(redisKey, now, `${now}-${Math.random()}`);
      await this.redis.expire(redisKey, 60);
      return { shouldThrottle: false, delayMs: 0 };
    }

    // Calculate delay based on excess requests
    const excessRequests = requestCount - config.delayAfter;
    const delayMs = Math.min(
      config.delayMs * (excessRequests + 1),
      config.maxDelayMs || config.delayMs * 10
    );

    await this.redis.zadd(redisKey, now, `${now}-${Math.random()}`);
    await this.redis.expire(redisKey, 60);

    return { shouldThrottle: true, delayMs };
  }
}

export class CircuitBreaker {
  private redis: Redis;
  private config: CircuitBreakerConfig;

  constructor(redis: Redis, config: CircuitBreakerConfig) {
    this.redis = redis;
    this.config = config;
  }

  /**
   * Check if circuit breaker is open
   */
  async isOpen(key: string): Promise<boolean> {
    const circuitKey = `circuit:${key}`;
    const state = await this.redis.hget(circuitKey, 'state');
    
    if (state === 'open') {
      const openedAt = await this.redis.hget(circuitKey, 'opened_at');
      if (openedAt) {
        const timeSinceOpen = Date.now() - parseInt(openedAt);
        if (timeSinceOpen > this.config.timeout) {
          // Move to half-open state
          await this.redis.hset(circuitKey, 'state', 'half-open');
          return false;
        }
        return true;
      }
    }

    return false;
  }

  /**
   * Record success
   */
  async recordSuccess(key: string): Promise<void> {
    const circuitKey = `circuit:${key}`;
    const state = await this.redis.hget(circuitKey, 'state');

    if (state === 'half-open') {
      // Success in half-open state, close the circuit
      await this.redis.hmset(circuitKey, {
        state: 'closed',
        failure_count: '0',
        last_failure: '0',
      });
    } else {
      // Reset failure count on success
      await this.redis.hset(circuitKey, 'failure_count', '0');
    }

    await this.redis.expire(circuitKey, 3600);
  }

  /**
   * Record failure
   */
  async recordFailure(key: string): Promise<void> {
    const circuitKey = `circuit:${key}`;
    const now = Date.now();
    const windowStart = now - this.config.monitoringWindow;

    // Remove old failures
    await this.redis.zremrangebyscore(`${circuitKey}:failures`, '-inf', windowStart);
    
    // Add current failure
    await this.redis.zadd(`${circuitKey}:failures`, now, `${now}-${Math.random()}`);
    
    // Count failures in window
    const failureCount = await this.redis.zcard(`${circuitKey}:failures`);

    if (failureCount >= this.config.failureThreshold) {
      // Open the circuit
      await this.redis.hmset(circuitKey, {
        state: 'open',
        opened_at: now.toString(),
        failure_count: failureCount.toString(),
      });
    }

    await this.redis.expire(circuitKey, 3600);
    await this.redis.expire(`${circuitKey}:failures`, Math.ceil(this.config.monitoringWindow / 1000));
  }

  /**
   * Get circuit breaker status
   */
  async getStatus(key: string): Promise<{
    state: 'open' | 'closed' | 'half-open';
    failureCount: number;
    openedAt?: number;
  }> {
    const circuitKey = `circuit:${key}`;
    const data = await this.redis.hmget(
      circuitKey,
      'state',
      'failure_count',
      'opened_at'
    );

    const failureCount = await this.redis.zcard(`${circuitKey}:failures`);

    return {
      state: (data[0] as 'open' | 'closed' | 'half-open') || 'closed',
      failureCount: failureCount || 0,
      openedAt: data[2] ? parseInt(data[2]) : undefined,
    };
  }
}

/**
 * Combined rate limiting and throttling service
 */
export class TrafficManager {
  private rateLimiter: RateLimiter;
  private throttler: Throttler;
  private circuitBreaker: CircuitBreaker;

  constructor(redis: Redis, circuitBreakerConfig: CircuitBreakerConfig) {
    this.rateLimiter = new RateLimiter(redis);
    this.throttler = new Throttler(redis);
    this.circuitBreaker = new CircuitBreaker(redis, circuitBreakerConfig);
  }

  async processRequest(
    key: string,
    rateLimitConfig: RateLimitConfig,
    throttleConfig?: ThrottleConfig
  ): Promise<{
    allowed: boolean;
    rateLimitResult: RateLimitResult;
    throttleResult?: { shouldThrottle: boolean; delayMs: number };
    circuitOpen: boolean;
    error?: string;
  }> {
    try {
      // Check circuit breaker first
      const circuitOpen = await this.circuitBreaker.isOpen(key);
      if (circuitOpen) {
        return {
          allowed: false,
          rateLimitResult: {
            allowed: false,
            remaining: 0,
            reset: new Date(Date.now() + 60000),
            totalHits: 0,
          },
          circuitOpen: true,
          error: 'Circuit breaker is open',
        };
      }

      // Check rate limit
      const rateLimitResult = await this.rateLimiter.checkRateLimit(key, rateLimitConfig);
      
      if (!rateLimitResult.allowed) {
        await this.circuitBreaker.recordFailure(key);
        return {
          allowed: false,
          rateLimitResult,
          circuitOpen: false,
          error: 'Rate limit exceeded',
        };
      }

      // Check throttling if configured
      let throttleResult;
      if (throttleConfig) {
        throttleResult = await this.throttler.throttle(key, throttleConfig);
      }

      await this.circuitBreaker.recordSuccess(key);

      return {
        allowed: true,
        rateLimitResult,
        throttleResult,
        circuitOpen: false,
      };
    } catch (error) {
      await this.circuitBreaker.recordFailure(key);
      return {
        allowed: false,
        rateLimitResult: {
          allowed: false,
          remaining: 0,
          reset: new Date(Date.now() + 60000),
          totalHits: 0,
        },
        circuitOpen: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  getRateLimiter(): RateLimiter {
    return this.rateLimiter;
  }

  getThrottler(): Throttler {
    return this.throttler;
  }

  getCircuitBreaker(): CircuitBreaker {
    return this.circuitBreaker;
  }
}