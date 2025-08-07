import { NextRequest, NextResponse } from 'next/server';
import { getRateLimitingEngine } from './rate-limiter';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

// Extract client information from request
function getClientInfo(request: NextRequest): { ip: string; userAgent: string; userId?: string; userType?: string } {
  // Get IP from various headers (considering proxies)
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const remoteAddr = request.headers.get('x-remote-addr');
  
  let ip = '127.0.0.1'; // default fallback
  
  if (forwarded) {
    ip = forwarded.split(',')[0].trim();
  } else if (realIp) {
    ip = realIp;
  } else if (remoteAddr) {
    ip = remoteAddr;
  }
  
  const userAgent = request.headers.get('user-agent') || 'unknown';
  
  // Try to extract user info from Authorization header or custom headers
  const auth = request.headers.get('authorization');
  const userId = request.headers.get('x-user-id');
  const userType = request.headers.get('x-user-type');
  
  return {
    ip,
    userAgent,
    userId: userId || undefined,
    userType: userType || undefined
  };
}

// Rate limiting middleware factory
export function createRateLimitMiddleware(options: {
  skipPaths?: string[];
  skipUserAgents?: string[];
  customKeyGenerator?: (request: NextRequest) => string;
  onLimitExceeded?: (request: NextRequest, info: any) => NextResponse;
} = {}) {
  const rateLimiter = getRateLimitingEngine();
  
  return async function rateLimitMiddleware(request: NextRequest): Promise<NextResponse | null> {
    try {
      const { pathname } = new URL(request.url);
      const method = request.method;
      
      // Skip certain paths if configured
      if (options.skipPaths?.some(path => pathname.startsWith(path))) {
        return null; // Continue to next middleware
      }
      
      const clientInfo = getClientInfo(request);
      
      // Skip certain user agents if configured
      if (options.skipUserAgents?.some(ua => clientInfo.userAgent.includes(ua))) {
        return null;
      }
      
      // Check rate limit
      const result = await rateLimiter.checkRateLimit({
        ip: clientInfo.ip,
        userId: clientInfo.userId,
        userType: clientInfo.userType,
        path: pathname,
        method
      });
      
      // Create response with rate limit headers
      const headers = new Headers();
      headers.set('X-RateLimit-Limit', result.info.limit.toString());
      headers.set('X-RateLimit-Remaining', result.info.remaining.toString());
      headers.set('X-RateLimit-Reset', result.info.reset.toISOString());
      
      if (result.retryAfter) {
        headers.set('Retry-After', result.retryAfter.toString());
      }
      
      if (!result.allowed) {
        logger.warn('Rate limit exceeded', {
          ip: clientInfo.ip,
          userId: clientInfo.userId,
          path: pathname,
          method,
          userAgent: clientInfo.userAgent,
          limit: result.info.limit,
          remaining: result.info.remaining
        });
        
        // Use custom handler if provided
        if (options.onLimitExceeded) {
          return options.onLimitExceeded(request, result);
        }
        
        return new NextResponse(
          JSON.stringify({
            error: 'Rate limit exceeded',
            message: 'Too many requests. Please try again later.',
            retryAfter: result.retryAfter
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              ...Object.fromEntries(headers.entries())
            }
          }
        );
      }
      
      // Add rate limit headers to successful responses
      // This will be handled by the response interceptor
      
      return null; // Continue to next middleware
    } catch (error) {
      logger.error('Rate limit middleware error', {
        error: error.message,
        path: new URL(request.url).pathname
      });
      
      // On error, allow the request to continue
      return null;
    }
  };
}

// Express.js style middleware (for compatibility)
export function expressRateLimitMiddleware(options: {
  windowMs?: number;
  max?: number;
  message?: string;
  keyGenerator?: (req: any) => string;
  skip?: (req: any) => boolean;
} = {}) {
  const rateLimiter = getRateLimitingEngine();
  
  return async function(req: any, res: any, next: any) {
    try {
      // Skip if configured
      if (options.skip && options.skip(req)) {
        return next();
      }
      
      const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
      const userId = req.user?.id || req.headers['x-user-id'];
      const userType = req.user?.type || req.headers['x-user-type'];
      const path = req.path || req.url;
      const method = req.method;
      
      const key = options.keyGenerator ? options.keyGenerator(req) : `${userId || ip}:${path}`;
      
      const result = await rateLimiter.checkRateLimit({
        ip,
        userId,
        userType,
        path,
        method
      });
      
      // Set headers
      res.set({
        'X-RateLimit-Limit': result.info.limit,
        'X-RateLimit-Remaining': result.info.remaining,
        'X-RateLimit-Reset': result.info.reset.toISOString()
      });
      
      if (result.retryAfter) {
        res.set('Retry-After', result.retryAfter);
      }
      
      if (!result.allowed) {
        logger.warn('Express rate limit exceeded', {
          ip,
          userId,
          path,
          method,
          userAgent: req.get('User-Agent')
        });
        
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: options.message || 'Too many requests. Please try again later.',
          retryAfter: result.retryAfter
        });
      }
      
      next();
    } catch (error) {
      logger.error('Express rate limit middleware error', {
        error: error.message,
        path: req.path || req.url
      });
      
      // On error, allow the request to continue
      next();
    }
  };
}

// API route wrapper for rate limiting
export function withRateLimit<T extends (...args: any[]) => any>(
  handler: T,
  options: {
    tier?: string;
    skipForUsers?: string[];
    customLimits?: {
      perMinute?: number;
      perHour?: number;
      perDay?: number;
    };
  } = {}
): T {
  return (async (request: NextRequest, ...args: any[]) => {
    const rateLimiter = getRateLimitingEngine();
    const { pathname } = new URL(request.url);
    const method = request.method;
    const clientInfo = getClientInfo(request);
    
    // Skip rate limiting for certain users if configured
    if (options.skipForUsers && clientInfo.userId && 
        options.skipForUsers.includes(clientInfo.userId)) {
      return handler(request, ...args);
    }
    
    // Check rate limit
    const result = await rateLimiter.checkRateLimit({
      ip: clientInfo.ip,
      userId: clientInfo.userId,
      userType: clientInfo.userType || options.tier,
      path: pathname,
      method
    });
    
    if (!result.allowed) {
      logger.warn('API rate limit exceeded', {
        ip: clientInfo.ip,
        userId: clientInfo.userId,
        path: pathname,
        method
      });
      
      return new NextResponse(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: 'API rate limit exceeded. Please try again later.',
          retryAfter: result.retryAfter,
          limits: {
            limit: result.info.limit,
            remaining: result.info.remaining,
            reset: result.info.reset
          }
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': result.info.limit.toString(),
            'X-RateLimit-Remaining': result.info.remaining.toString(),
            'X-RateLimit-Reset': result.info.reset.toISOString(),
            'Retry-After': result.retryAfter?.toString() || '60'
          }
        }
      );
    }
    
    // Call original handler
    const response = await handler(request, ...args);
    
    // Add rate limit headers to response if it's a NextResponse
    if (response instanceof NextResponse) {
      response.headers.set('X-RateLimit-Limit', result.info.limit.toString());
      response.headers.set('X-RateLimit-Remaining', result.info.remaining.toString());
      response.headers.set('X-RateLimit-Reset', result.info.reset.toISOString());
    }
    
    return response;
  }) as T;
}

// Decorator for class methods
export function RateLimit(options: {
  tier?: string;
  perMinute?: number;
  perHour?: number;
  perDay?: number;
} = {}) {
  return function(target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function(...args: any[]) {
      const request = args[0] as NextRequest;
      
      if (request && request.url) {
        const rateLimiter = getRateLimitingEngine();
        const { pathname } = new URL(request.url);
        const httpMethod = request.method;
        const clientInfo = getClientInfo(request);
        
        const result = await rateLimiter.checkRateLimit({
          ip: clientInfo.ip,
          userId: clientInfo.userId,
          userType: clientInfo.userType || options.tier,
          path: pathname,
          method: httpMethod
        });
        
        if (!result.allowed) {
          return new NextResponse(
            JSON.stringify({
              error: 'Rate limit exceeded',
              retryAfter: result.retryAfter
            }),
            {
              status: 429,
              headers: {
                'Content-Type': 'application/json',
                'Retry-After': result.retryAfter?.toString() || '60'
              }
            }
          );
        }
      }
      
      return method.apply(this, args);
    };
    
    return descriptor;
  };
}

// Utility functions
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIp) {
    return realIp;
  }
  
  return '127.0.0.1';
}

export function isRateLimited(headers: Headers): boolean {
  const remaining = headers.get('X-RateLimit-Remaining');
  return remaining === '0';
}

export function getRateLimitInfo(headers: Headers): {
  limit: number;
  remaining: number;
  reset: Date;
} | null {
  const limit = headers.get('X-RateLimit-Limit');
  const remaining = headers.get('X-RateLimit-Remaining');
  const reset = headers.get('X-RateLimit-Reset');
  
  if (!limit || !remaining || !reset) {
    return null;
  }
  
  return {
    limit: parseInt(limit, 10),
    remaining: parseInt(remaining, 10),
    reset: new Date(reset)
  };
}

export default createRateLimitMiddleware;