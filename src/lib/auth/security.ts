/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { NextRequest, NextResponse } from 'next/server';
import { prisma, sessionRedis } from '../db/client';
import { createAuditLog } from '../audit/service';
import type { User } from '@prisma/client';

/**
 * Security configuration for OWASP compliance
 */
export interface SecurityConfig {
  // Password Policy
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSpecialChars: boolean;
  passwordMaxAge: number; // days

  // Account Lockout
  maxFailedAttempts: number;
  lockoutDuration: number; // minutes
  lockoutThreshold: number; // minutes

  // Session Security
  sessionTimeout: number; // minutes
  maxConcurrentSessions: number;
  forceLogoutOnPasswordChange: boolean;

  // Rate Limiting
  rateLimitEnabled: boolean;
  maxRequests: number;
  windowMs: number;

  // Security Headers
  contentSecurityPolicy: string;
  strictTransportSecurity: string;
}

/**
 * Get security configuration from environment variables
 */
export const getSecurityConfig = (): SecurityConfig => ({
  // Password Policy
  passwordMinLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '12'),
  passwordRequireUppercase: process.env.PASSWORD_REQUIRE_UPPERCASE === 'true',
  passwordRequireLowercase: process.env.PASSWORD_REQUIRE_LOWERCASE === 'true',
  passwordRequireNumbers: process.env.PASSWORD_REQUIRE_NUMBERS === 'true',
  passwordRequireSpecialChars: process.env.PASSWORD_REQUIRE_SPECIAL_CHARS === 'true',
  passwordMaxAge: parseInt(process.env.PASSWORD_MAX_AGE_DAYS || '90'),

  // Account Lockout
  maxFailedAttempts: parseInt(process.env.FAILED_LOGIN_ATTEMPTS || '5'),
  lockoutDuration: parseInt(process.env.LOCKOUT_DURATION_MINUTES || '30'),
  lockoutThreshold: parseInt(process.env.LOCKOUT_THRESHOLD_MINUTES || '15'),

  // Session Security
  sessionTimeout: parseInt(process.env.SESSION_TIMEOUT_MINUTES || '480'), // 8 hours
  maxConcurrentSessions: parseInt(process.env.CONCURRENT_SESSIONS_LIMIT || '5'),
  forceLogoutOnPasswordChange: process.env.FORCE_LOGOUT_ON_PASSWORD_CHANGE === 'true',

  // Rate Limiting
  rateLimitEnabled: process.env.RATE_LIMIT_ENABLED === 'true',
  maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes

  // Security Headers
  contentSecurityPolicy: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self' https:; frame-ancestors 'none';",
  strictTransportSecurity: 'max-age=31536000; includeSubDomains; preload',
});

/**
 * Password strength validation
 */
export const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
  const config = getSecurityConfig();
  const errors: string[] = [];

  if (password.length < config.passwordMinLength) {
    errors.push(`Password must be at least ${config.passwordMinLength} characters long`);
  }

  if (config.passwordRequireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (config.passwordRequireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (config.passwordRequireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (config.passwordRequireSpecialChars && !/[!@#$%^&*(),.?\":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Check against common passwords
  if (isCommonPassword(password)) {
    errors.push('Password is too common. Please choose a more unique password');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Check if password is in common passwords list
 */
const isCommonPassword = (password: string): boolean => {
  const commonPasswords = [
    'password', '123456', '123456789', 'qwerty', 'abc123', 'password123',
    'admin', 'letmein', 'welcome', 'monkey', '1234567890', 'password1',
    'qwerty123', 'welcome123', 'admin123', 'root', 'toor', 'pass',
    'test', 'guest', 'user', 'demo', 'sample', 'temp'
  ];

  return commonPasswords.includes(password.toLowerCase());
};

/**
 * Account lockout management
 */
export class AccountLockout {
  private static getKey(identifier: string): string {
    return `lockout:${identifier}`;
  }

  static async recordFailedAttempt(identifier: string, ipAddress: string): Promise<void> {
    const config = getSecurityConfig();
    const key = this.getKey(identifier);
    const now = Date.now();

    // Get current attempts
    const attemptsData = await sessionRedis.get(key);
    let attempts: { timestamp: number; ip: string }[] = [];

    if (attemptsData) {
      attempts = JSON.parse(attemptsData);
    }

    // Add current attempt
    attempts.push({ timestamp: now, ip: ipAddress });

    // Filter attempts within threshold window
    const thresholdTime = now - (config.lockoutThreshold * 60 * 1000);
    attempts = attempts.filter(attempt => attempt.timestamp > thresholdTime);

    // Store updated attempts
    await sessionRedis.setex(
      key,
      config.lockoutThreshold * 60, // Expire after threshold window
      JSON.stringify(attempts)
    );

    // Check if account should be locked
    if (attempts.length >= config.maxFailedAttempts) {
      await this.lockAccount(identifier, ipAddress);
    }
  }

  static async lockAccount(identifier: string, ipAddress: string): Promise<void> {
    const config = getSecurityConfig();
    const lockKey = `locked:${identifier}`;
    const lockUntil = Date.now() + (config.lockoutDuration * 60 * 1000);

    await sessionRedis.setex(
      lockKey,
      config.lockoutDuration * 60,
      JSON.stringify({ lockedUntil: lockUntil, lockedBy: ipAddress })
    );

    await createAuditLog({
      action: 'security.account_locked',
      resource: 'authentication',
      resourceId: null,
      userId: null,
      details: {
        identifier,
        ipAddress,
        lockDuration: config.lockoutDuration,
        reason: 'Too many failed login attempts'
      },
      status: 'warning'
    });
  }

  static async isLocked(identifier: string): Promise<{ locked: boolean; lockUntil?: Date }> {
    const lockKey = `locked:${identifier}`;
    const lockData = await sessionRedis.get(lockKey);

    if (!lockData) {
      return { locked: false };
    }

    const { lockedUntil } = JSON.parse(lockData);
    const now = Date.now();

    if (now >= lockedUntil) {
      // Lock expired, clean up
      await sessionRedis.del(lockKey);
      await sessionRedis.del(this.getKey(identifier));
      return { locked: false };
    }

    return {
      locked: true,
      lockUntil: new Date(lockedUntil)
    };
  }

  static async clearFailedAttempts(identifier: string): Promise<void> {
    await sessionRedis.del(this.getKey(identifier));
    await sessionRedis.del(`locked:${identifier}`);
  }
}

/**
 * Enhanced rate limiting with different tiers
 */
export class EnhancedRateLimit {
  static async checkLimit(
    identifier: string,
    tier: 'login' | 'api' | 'general' = 'general'
  ): Promise<{ allowed: boolean; remainingRequests: number; resetTime: Date }> {
    const config = getSecurityConfig();
    
    if (!config.rateLimitEnabled) {
      return {
        allowed: true,
        remainingRequests: config.maxRequests,
        resetTime: new Date(Date.now() + config.windowMs)
      };
    }

    // Different limits for different tiers
    const limits = {
      login: { max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX || '10'), window: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || '900000') },
      api: { max: config.maxRequests * 2, window: config.windowMs },
      general: { max: config.maxRequests, window: config.windowMs }
    };

    const limit = limits[tier];
    const key = `rate_limit:${tier}:${identifier}`;
    
    const current = await sessionRedis.get(key);
    const currentCount = current ? parseInt(current) : 0;
    const windowSeconds = Math.ceil(limit.window / 1000);

    if (currentCount >= limit.max) {
      return {
        allowed: false,
        remainingRequests: 0,
        resetTime: new Date(Date.now() + limit.window)
      };
    }

    // Increment counter
    if (currentCount === 0) {
      await sessionRedis.setex(key, windowSeconds, '1');
    } else {
      await sessionRedis.incr(key);
    }

    return {
      allowed: true,
      remainingRequests: limit.max - currentCount - 1,
      resetTime: new Date(Date.now() + limit.window)
    };
  }
}

/**
 * Session security management
 */
export class SessionSecurity {
  static async enforceSessionLimits(userId: string): Promise<void> {
    const config = getSecurityConfig();
    
    // Get all user sessions
    const sessionKeys = await sessionRedis.keys(`session:*`);
    const userSessions: string[] = [];

    for (const key of sessionKeys) {
      const data = await sessionRedis.get(key);
      if (data) {
        const sessionData = JSON.parse(data);
        if (sessionData.userId === userId) {
          userSessions.push(key);
        }
      }
    }

    // If user has too many sessions, remove oldest ones
    if (userSessions.length >= config.maxConcurrentSessions) {
      const sessionsToRemove = userSessions.slice(0, userSessions.length - config.maxConcurrentSessions + 1);
      
      for (const sessionKey of sessionsToRemove) {
        await sessionRedis.del(sessionKey);
      }

      await createAuditLog({
        action: 'security.session_limit_enforced',
        resource: 'session',
        resourceId: userId,
        userId,
        details: {
          removedSessions: sessionsToRemove.length,
          maxAllowed: config.maxConcurrentSessions
        },
        status: 'info'
      });
    }
  }

  static async validateSessionSecurity(sessionId: string, request: NextRequest): Promise<boolean> {
    const sessionData = await sessionRedis.get(`session:${sessionId}`);
    if (!sessionData) {
      return false;
    }

    const session = JSON.parse(sessionData);
    const now = Date.now();
    const config = getSecurityConfig();

    // Check session timeout
    const sessionAge = now - session.createdAt;
    const maxAge = config.sessionTimeout * 60 * 1000;

    if (sessionAge > maxAge) {
      await sessionRedis.del(`session:${sessionId}`);
      
      await createAuditLog({
        action: 'security.session_expired',
        resource: 'session',
        resourceId: session.userId,
        userId: session.userId,
        details: {
          sessionId,
          sessionAge: Math.floor(sessionAge / 1000),
          maxAge: Math.floor(maxAge / 1000)
        },
        status: 'info'
      });

      return false;
    }

    // Validate IP address consistency (optional - can be disabled for mobile users)
    const currentIp = request.ip || request.headers.get('x-forwarded-for');
    if (session.ipAddress && currentIp && session.ipAddress !== currentIp) {
      // Log suspicious activity but don't block (IP can change legitimately)
      await createAuditLog({
        action: 'security.ip_change_detected',
        resource: 'session',
        resourceId: session.userId,
        userId: session.userId,
        details: {
          sessionId,
          originalIp: session.ipAddress,
          newIp: currentIp,
          userAgent: request.headers.get('user-agent')
        },
        status: 'warning'
      });
    }

    return true;
  }
}

/**
 * Security headers middleware
 */
export const withSecurityHeaders = () => {
  return (handler: (req: NextRequest) => Promise<NextResponse>) => {
    return async (req: NextRequest): Promise<NextResponse> => {
      const response = await handler(req);
      const config = getSecurityConfig();

      // OWASP recommended security headers
      response.headers.set('X-Frame-Options', 'DENY');
      response.headers.set('X-Content-Type-Options', 'nosniff');
      response.headers.set('X-XSS-Protection', '1; mode=block');
      response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      response.headers.set('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
      
      if (process.env.NODE_ENV === 'production') {
        response.headers.set('Strict-Transport-Security', config.strictTransportSecurity);
      }

      // Content Security Policy
      response.headers.set('Content-Security-Policy', config.contentSecurityPolicy);

      // Remove potentially sensitive headers
      response.headers.delete('Server');
      response.headers.delete('X-Powered-By');

      return response;
    };
  };
};

/**
 * Input validation and sanitization
 */
export class InputValidator {
  static sanitizeString(input: string): string {
    return input
      .trim()
      .replace(/[<>\"'&]/g, (char) => {
        const entities: { [key: string]: string } = {
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#x27;',
          '&': '&amp;'
        };
        return entities[char] || char;
      });
  }

  static validateEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  static validateUsername(username: string): { isValid: boolean; error?: string } {
    if (username.length < 3 || username.length > 30) {
      return { isValid: false, error: 'Username must be between 3 and 30 characters' };
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return { isValid: false, error: 'Username can only contain letters, numbers, underscores, and hyphens' };
    }

    const reservedNames = ['admin', 'root', 'system', 'api', 'www', 'mail', 'support', 'security'];
    if (reservedNames.includes(username.toLowerCase())) {
      return { isValid: false, error: 'Username is reserved' };
    }

    return { isValid: true };
  }

  static detectSQLInjection(input: string): boolean {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|EXEC|EXECUTE)\b)/i,
      /(;|--|\|\||&&)/,
      /('\s*(OR|AND)\s*'[^']*'?\s*=\s*')/i,
      /('.*?(\bOR\b|\bAND\b).*?')/i
    ];

    return sqlPatterns.some(pattern => pattern.test(input));
  }

  static detectXSS(input: string): boolean {
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /<object[^>]*>.*?<\/object>/gi,
      /<embed[^>]*>/gi
    ];

    return xssPatterns.some(pattern => pattern.test(input));
  }
}

/**
 * Audit failed security events
 */
export const auditSecurityEvent = async (
  event: string,
  details: any,
  request: NextRequest,
  userId?: string
): Promise<void> => {
  await createAuditLog({
    action: `security.${event}`,
    resource: 'security',
    resourceId: null,
    userId,
    details: {
      ...details,
      ipAddress: request.ip || request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
      timestamp: Date.now()
    },
    status: 'warning'
  });
};