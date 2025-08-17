/**
 * Advanced Rate Limiting System
 * Implements sliding window and token bucket algorithms for different scenarios
 */

import crypto from 'crypto';

interface RateLimitRule {
  maxRequests: number;
  windowMs: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  blockDuration?: number; // Additional block time after limit exceeded
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter: number;
  limit: number;
}

interface RateLimitWindow {
  requests: number[];
  blocked: boolean;
  blockUntil?: number;
  firstRequest: number;
}

class AdvancedRateLimiter {
  private windows = new Map<string, RateLimitWindow>();
  private readonly cleanupInterval: NodeJS.Timeout;

  // Predefined rules for different endpoints/scenarios
  private readonly rules = {
    // Authentication endpoints
    login: {
      maxRequests: 5,
      windowMs: 15 * 60 * 1000, // 15 minutes
      blockDuration: 30 * 60 * 1000, // 30 minutes block after limit
      skipSuccessfulRequests: true
    },
    
    registration: {
      maxRequests: 3,
      windowMs: 60 * 60 * 1000, // 1 hour
      blockDuration: 2 * 60 * 60 * 1000, // 2 hours block
    },

    passwordReset: {
      maxRequests: 3,
      windowMs: 60 * 60 * 1000, // 1 hour
      blockDuration: 60 * 60 * 1000, // 1 hour block
    },

    mfaVerification: {
      maxRequests: 10,
      windowMs: 15 * 60 * 1000, // 15 minutes
      blockDuration: 15 * 60 * 1000, // 15 minutes block
    },

    // API endpoints
    apiGeneral: {
      maxRequests: 100,
      windowMs: 60 * 1000, // 1 minute
      blockDuration: 5 * 60 * 1000, // 5 minutes block
    },

    apiSensitive: {
      maxRequests: 10,
      windowMs: 60 * 1000, // 1 minute
      blockDuration: 15 * 60 * 1000, // 15 minutes block
    },

    // File uploads
    fileUpload: {
      maxRequests: 20,
      windowMs: 60 * 60 * 1000, // 1 hour
      blockDuration: 30 * 60 * 1000, // 30 minutes block
    },

    // Search and query endpoints
    search: {
      maxRequests: 50,
      windowMs: 60 * 1000, // 1 minute
      blockDuration: 2 * 60 * 1000, // 2 minutes block
    }
  };

  constructor() {
    // Cleanup expired windows every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Check rate limit for a specific key and rule
   */
  async checkLimit(
    key: string,
    rule: keyof typeof this.rules | RateLimitRule,
    isSuccess?: boolean
  ): Promise<RateLimitResult> {
    
    const ruleConfig = typeof rule === 'string' ? this.rules[rule] : rule;
    if (!ruleConfig) {
      throw new Error(`Unknown rate limit rule: ${rule}`);
    }

    const now = Date.now();
    const windowKey = this.generateWindowKey(key, rule);
    let window = this.windows.get(windowKey);

    // Initialize window if not exists
    if (!window) {
      window = {
        requests: [],
        blocked: false,
        firstRequest: now
      };
      this.windows.set(windowKey, window);
    }

    // Check if currently blocked
    if (window.blocked && window.blockUntil && now < window.blockUntil) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: window.blockUntil,
        retryAfter: window.blockUntil - now,
        limit: ruleConfig.maxRequests
      };
    }

    // Clear block if expired
    if (window.blocked && window.blockUntil && now >= window.blockUntil) {
      window.blocked = false;
      window.blockUntil = undefined;
      window.requests = [];
      window.firstRequest = now;
    }

    // Clean old requests outside the window
    const windowStart = now - ruleConfig.windowMs;
    window.requests = window.requests.filter(timestamp => timestamp > windowStart);

    // Skip counting based on rule configuration
    const shouldSkip = (
      (isSuccess === true && ruleConfig.skipSuccessfulRequests) ||
      (isSuccess === false && ruleConfig.skipFailedRequests)
    );

    if (!shouldSkip) {
      // Check if limit exceeded
      if (window.requests.length >= ruleConfig.maxRequests) {
        // Block if blockDuration is specified
        if (ruleConfig.blockDuration) {
          window.blocked = true;
          window.blockUntil = now + ruleConfig.blockDuration;
        }

        const resetTime = Math.min(
          window.requests[0] + ruleConfig.windowMs,
          window.blockUntil || now + ruleConfig.windowMs
        );

        return {
          allowed: false,
          remaining: 0,
          resetTime,
          retryAfter: resetTime - now,
          limit: ruleConfig.maxRequests
        };
      }

      // Add current request
      window.requests.push(now);
    }

    // Calculate reset time
    const resetTime = window.requests.length > 0
      ? window.requests[0] + ruleConfig.windowMs
      : now + ruleConfig.windowMs;

    return {
      allowed: true,
      remaining: Math.max(0, ruleConfig.maxRequests - window.requests.length),
      resetTime,
      retryAfter: 0,
      limit: ruleConfig.maxRequests
    };
  }

  /**
   * Specialized login attempt rate limiting with progressive penalties
   */
  async checkLoginAttempts(ipAddress: string, email?: string): Promise<RateLimitResult> {
    const results: RateLimitResult[] = [];

    // IP-based limiting (broader protection)
    const ipResult = await this.checkLimit(`login:ip:${ipAddress}`, 'login');
    results.push(ipResult);

    // Email-based limiting (account-specific protection)
    if (email) {
      const emailResult = await this.checkLimit(`login:email:${email}`, {
        maxRequests: 3,
        windowMs: 15 * 60 * 1000, // 15 minutes
        blockDuration: 60 * 60 * 1000, // 1 hour block for account-specific attempts
        skipSuccessfulRequests: true
      });
      results.push(emailResult);
    }

    // Return the most restrictive result
    const blocked = results.find(r => !r.allowed);
    if (blocked) {
      return blocked;
    }

    // Return the result with the least remaining requests
    return results.reduce((prev, current) => 
      current.remaining < prev.remaining ? current : prev
    );
  }

  /**
   * API endpoint rate limiting with different tiers
   */
  async checkApiLimit(
    apiKey: string,
    endpoint: string,
    userTier: 'basic' | 'premium' | 'enterprise' = 'basic'
  ): Promise<RateLimitResult> {
    
    const tierLimits = {
      basic: { maxRequests: 100, windowMs: 60 * 1000 },
      premium: { maxRequests: 500, windowMs: 60 * 1000 },
      enterprise: { maxRequests: 2000, windowMs: 60 * 1000 }
    };

    const rule: RateLimitRule = {
      ...tierLimits[userTier],
      blockDuration: 5 * 60 * 1000 // 5 minutes block
    };

    return this.checkLimit(`api:${apiKey}:${endpoint}`, rule);
  }

  /**
   * Progressive rate limiting for suspicious behavior
   */
  async checkProgressiveLimit(
    identifier: string,
    baseRule: keyof typeof this.rules,
    violationHistory: number
  ): Promise<RateLimitResult> {
    
    const base = this.rules[baseRule];
    if (!base) {
      throw new Error(`Unknown base rule: ${baseRule}`);
    }

    // Apply progressive penalties based on violation history
    const progressiveRule: RateLimitRule = {
      maxRequests: Math.max(1, base.maxRequests - violationHistory),
      windowMs: base.windowMs * (1 + violationHistory * 0.5), // Increase window
      blockDuration: base.blockDuration ? base.blockDuration * (1 + violationHistory) : undefined,
      skipSuccessfulRequests: base.skipSuccessfulRequests,
      skipFailedRequests: base.skipFailedRequests
    };

    return this.checkLimit(identifier, progressiveRule);
  }

  /**
   * Burst protection for high-frequency requests
   */
  async checkBurstProtection(
    identifier: string,
    burstSize: number = 10,
    burstWindow: number = 1000 // 1 second
  ): Promise<RateLimitResult> {
    
    const rule: RateLimitRule = {
      maxRequests: burstSize,
      windowMs: burstWindow,
      blockDuration: 30 * 1000 // 30 seconds block
    };

    return this.checkLimit(`burst:${identifier}`, rule);
  }

  /**
   * Reset rate limit for a specific key (admin function)
   */
  async resetLimit(key: string, rule: keyof typeof this.rules | string): Promise<void> {
    const windowKey = this.generateWindowKey(key, rule);
    this.windows.delete(windowKey);
  }

  /**
   * Get current status for a key and rule
   */
  async getStatus(key: string, rule: keyof typeof this.rules): Promise<{
    requests: number;
    remaining: number;
    resetTime: number;
    blocked: boolean;
    blockUntil?: number;
  } | null> {
    
    const ruleConfig = this.rules[rule];
    if (!ruleConfig) {
      return null;
    }

    const windowKey = this.generateWindowKey(key, rule);
    const window = this.windows.get(windowKey);

    if (!window) {
      return {
        requests: 0,
        remaining: ruleConfig.maxRequests,
        resetTime: Date.now() + ruleConfig.windowMs,
        blocked: false
      };
    }

    const now = Date.now();
    const windowStart = now - ruleConfig.windowMs;
    const activeRequests = window.requests.filter(timestamp => timestamp > windowStart);

    return {
      requests: activeRequests.length,
      remaining: Math.max(0, ruleConfig.maxRequests - activeRequests.length),
      resetTime: activeRequests.length > 0 
        ? activeRequests[0] + ruleConfig.windowMs 
        : now + ruleConfig.windowMs,
      blocked: window.blocked,
      blockUntil: window.blockUntil
    };
  }

  /**
   * Get analytics for rate limiting
   */
  async getAnalytics(): Promise<{
    totalWindows: number;
    blockedWindows: number;
    topViolators: Array<{ key: string; violations: number; lastViolation: number }>;
    ruleStats: Record<string, { windows: number; blocked: number }>;
  }> {
    
    const analytics = {
      totalWindows: this.windows.size,
      blockedWindows: 0,
      topViolators: [] as Array<{ key: string; violations: number; lastViolation: number }>,
      ruleStats: {} as Record<string, { windows: number; blocked: number }>
    };

    const violatorMap = new Map<string, { violations: number; lastViolation: number }>();

    for (const [windowKey, window] of this.windows.entries()) {
      if (window.blocked) {
        analytics.blockedWindows++;
      }

      // Extract rule from window key
      const rulePart = windowKey.split(':')[0];
      if (!analytics.ruleStats[rulePart]) {
        analytics.ruleStats[rulePart] = { windows: 0, blocked: 0 };
      }
      analytics.ruleStats[rulePart].windows++;
      if (window.blocked) {
        analytics.ruleStats[rulePart].blocked++;
      }

      // Track violations
      if (window.requests.length > 0) {
        const baseKey = windowKey.split(':').slice(0, 2).join(':');
        const existing = violatorMap.get(baseKey) || { violations: 0, lastViolation: 0 };
        existing.violations += window.requests.length;
        existing.lastViolation = Math.max(existing.lastViolation, Math.max(...window.requests));
        violatorMap.set(baseKey, existing);
      }
    }

    // Get top violators
    analytics.topViolators = Array.from(violatorMap.entries())
      .map(([key, data]) => ({ key, ...data }))
      .sort((a, b) => b.violations - a.violations)
      .slice(0, 10);

    return analytics;
  }

  /**
   * Cleanup expired windows
   */
  private cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [windowKey, window] of this.windows.entries()) {
      // Extract rule information to determine window duration
      const isBlocked = window.blocked && window.blockUntil && now < window.blockUntil;
      const hasRecentRequests = window.requests.some(timestamp => now - timestamp < 24 * 60 * 60 * 1000); // 24 hours

      if (!isBlocked && !hasRecentRequests) {
        toDelete.push(windowKey);
      }
    }

    toDelete.forEach(key => this.windows.delete(key));

    if (toDelete.length > 0) {
      console.log(`Cleaned up ${toDelete.length} expired rate limit windows`);
    }
  }

  /**
   * Generate unique window key
   */
  private generateWindowKey(key: string, rule: keyof typeof this.rules | RateLimitRule | string): string {
    const ruleId = typeof rule === 'string' ? rule : 
                  typeof rule === 'object' ? crypto.createHash('md5').update(JSON.stringify(rule)).digest('hex').substring(0, 8) :
                  rule;
    return `${ruleId}:${key}`;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.windows.clear();
  }
}

// Export singleton instance
export const rateLimit = new AdvancedRateLimiter();
export default rateLimit;