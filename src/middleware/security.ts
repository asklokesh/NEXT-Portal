/**
 * Production Security Middleware
 * Comprehensive security headers and CORS configuration for enterprise deployment
 */

import { NextRequest, NextResponse } from 'next/server';

// Production CORS Configuration
const CORS_CONFIG = {
  // Production domains - update these for your actual domains
  allowedOrigins: [
    'https://localhost:4400',
    'https://127.0.0.1:4400',
    'http://localhost:4400',
    'http://127.0.0.1:4400',
    // Add your production domains here
    process.env.CORS_ORIGIN,
    process.env.NEXT_PUBLIC_FRONTEND_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ].filter(Boolean),
  
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'X-Requested-With',
    'Access-Control-Allow-Origin',
    'X-HTTP-Method-Override',
    'Content-Type',
    'Authorization',
    'Accept',
    'X-API-Key',
    'X-Organization-ID',
    'X-Team-ID',
    'X-Project-ID',
    'X-Trace-ID',
    'X-Request-ID',
    'Cache-Control',
    'Pragma',
  ],
  exposedHeaders: [
    'X-Total-Count',
    'X-Page-Count',
    'X-Per-Page',
    'X-Rate-Limit-Remaining',
    'X-Rate-Limit-Reset',
    'X-Cache',
    'X-Response-Time',
  ],
  credentials: true,
  maxAge: 86400, // 24 hours
};

// Security Headers Configuration
const SECURITY_HEADERS = {
  // Content Security Policy (CSP)
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob:",
    "connect-src 'self' https: wss: ws:",
    "frame-src 'self' https:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "upgrade-insecure-requests"
  ].join('; '),
  
  // Security headers
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': [
    'accelerometer=()',
    'autoplay=()',
    'camera=()',
    'clipboard-read=()',
    'clipboard-write=(self)',
    'fullscreen=()',
    'geolocation=()',
    'gyroscope=()',
    'magnetometer=()',
    'microphone=()',
    'payment=()',
    'picture-in-picture=()',
    'screen-wake-lock=()',
    'usb=()',
    'web-share=()'
  ].join(', '),
  
  // HSTS (HTTP Strict Transport Security)
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  
  // Additional security headers
  'X-Permitted-Cross-Domain-Policies': 'none',
  'X-DNS-Prefetch-Control': 'off',
  'X-Download-Options': 'noopen',
  'Cache-Control': 'private, no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};

// Rate limiting configuration per endpoint
const RATE_LIMITS = {
  '/api/auth': { windowMs: 15 * 60 * 1000, max: 20 }, // 20 requests per 15 minutes
  '/api/plugins': { windowMs: 60 * 1000, max: 30 }, // 30 requests per minute
  '/api/catalog': { windowMs: 60 * 1000, max: 100 }, // 100 requests per minute
  '/api/admin': { windowMs: 60 * 1000, max: 10 }, // 10 requests per minute for admin
  default: { windowMs: 60 * 1000, max: 60 }, // 60 requests per minute default
};

export function createSecurityHeaders(request: NextRequest): Record<string, string> {
  const headers: Record<string, string> = { ...SECURITY_HEADERS };
  
  // Environment-specific adjustments
  if (process.env.NODE_ENV === 'development') {
    // Relax CSP for development
    headers['Content-Security-Policy'] = headers['Content-Security-Policy']
      .replace("'unsafe-inline'", "'unsafe-inline' 'unsafe-eval'")
      .replace('https:', 'https: http:');
    
    // Remove HSTS in development
    delete headers['Strict-Transport-Security'];
  }
  
  // Add request-specific headers
  headers['X-Request-ID'] = request.headers.get('x-request-id') || 
    Math.random().toString(36).substring(2, 15);
  headers['X-Timestamp'] = new Date().toISOString();
  
  return headers;
}

export function createCORSHeaders(request: NextRequest, origin?: string): Record<string, string> {
  const headers: Record<string, string> = {};
  
  // Check if origin is allowed
  const requestOrigin = origin || request.headers.get('Origin');
  const isOriginAllowed = !requestOrigin || 
    CORS_CONFIG.allowedOrigins.includes(requestOrigin) ||
    (process.env.NODE_ENV === 'development' && requestOrigin.includes('localhost'));
  
  if (isOriginAllowed) {
    headers['Access-Control-Allow-Origin'] = requestOrigin || '*';
    headers['Access-Control-Allow-Credentials'] = CORS_CONFIG.credentials.toString();
    headers['Access-Control-Allow-Methods'] = CORS_CONFIG.allowedMethods.join(', ');
    headers['Access-Control-Allow-Headers'] = CORS_CONFIG.allowedHeaders.join(', ');
    headers['Access-Control-Expose-Headers'] = CORS_CONFIG.exposedHeaders.join(', ');
    headers['Access-Control-Max-Age'] = CORS_CONFIG.maxAge.toString();
  }
  
  return headers;
}

export function securityMiddleware(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  
  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    const corsHeaders = createCORSHeaders(request);
    return new NextResponse(null, {
      status: 200,
      headers: corsHeaders
    });
  }
  
  // Skip security headers for static assets
  if (pathname.startsWith('/_next') || 
      pathname.startsWith('/api/_next') ||
      pathname.includes('.')) {
    return null;
  }
  
  // Apply security headers to all responses
  const securityHeaders = createSecurityHeaders(request);
  const corsHeaders = createCORSHeaders(request);
  
  const response = NextResponse.next();
  
  // Set security headers
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  return response;
}

/**
 * Comprehensive rate limiting using Redis
 */
export async function createRateLimiter() {
  let redis: any = null;
  
  try {
    const Redis = (await import('ioredis')).default;
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableAutoPipelining: true,
      db: 1 // Use different DB for rate limiting
    });
  } catch (error) {
    console.warn('Redis not available for rate limiting:', error);
  }
  
  return {
    async checkRateLimit(
      identifier: string, 
      endpoint: string = 'default'
    ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
      if (!redis) {
        return { allowed: true, remaining: Infinity, resetTime: 0 };
      }
      
      const config = RATE_LIMITS[endpoint] || RATE_LIMITS.default;
      const key = `rate_limit:${identifier}:${endpoint}`;
      const windowStart = Math.floor(Date.now() / config.windowMs) * config.windowMs;
      const windowKey = `${key}:${windowStart}`;
      
      try {
        const requests = await redis.incr(windowKey);
        
        if (requests === 1) {
          await redis.expire(windowKey, Math.ceil(config.windowMs / 1000));
        }
        
        const remaining = Math.max(0, config.max - requests);
        const resetTime = windowStart + config.windowMs;
        
        return {
          allowed: requests <= config.max,
          remaining,
          resetTime
        };
      } catch (error) {
        console.warn('Rate limiting error:', error);
        return { allowed: true, remaining: Infinity, resetTime: 0 };
      }
    },
    
    async cleanup(): Promise<void> {
      if (redis) {
        await redis.quit();
      }
    }
  };
}

/**
 * Security scanning and monitoring
 */
export function createSecurityMonitor() {
  return {
    logSecurityEvent(event: {
      type: 'rate_limit' | 'cors_violation' | 'suspicious_request' | 'auth_failure';
      ip: string;
      userAgent?: string;
      endpoint?: string;
      details?: any;
    }): void {
      const logEntry = {
        timestamp: new Date().toISOString(),
        level: 'SECURITY',
        ...event
      };
      
      // Log to console in development, send to monitoring service in production
      if (process.env.NODE_ENV === 'development') {
        console.warn('SECURITY EVENT:', logEntry);
      } else {
        // Send to your monitoring service (Grafana, DataDog, etc.)
        this.sendToMonitoring(logEntry);
      }
    },
    
    sendToMonitoring(logEntry: any): void {
      // Implement your monitoring service integration here
      // Example: send to Grafana Loki, Elasticsearch, etc.
      console.log('SECURITY:', JSON.stringify(logEntry));
    },
    
    detectSuspiciousActivity(request: NextRequest): boolean {
      const userAgent = request.headers.get('user-agent') || '';
      const ip = request.headers.get('x-forwarded-for') || 
        request.headers.get('x-real-ip') || 
        'unknown';
      
      // Basic suspicious activity detection
      const suspiciousPatterns = [
        /bot|crawler|spider|scraper/i,
        /sqlmap|nmap|nikto|burp/i,
        /hack|exploit|injection/i,
      ];
      
      const hasSuspiciousUserAgent = suspiciousPatterns.some(pattern => 
        pattern.test(userAgent)
      );
      
      const hasSuspiciousHeaders = request.headers.has('x-forwarded-host') ||
        request.headers.has('x-originating-ip') ||
        request.headers.has('x-remote-ip');
      
      return hasSuspiciousUserAgent || hasSuspiciousHeaders;
    }
  };
}

/**
 * Request validation and sanitization
 */
export function validateRequest(request: NextRequest): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Validate content length
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) { // 10MB limit
    errors.push('Request payload too large');
  }
  
  // Validate content type for POST/PUT requests
  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    const contentType = request.headers.get('content-type');
    if (!contentType || (!contentType.includes('application/json') && 
        !contentType.includes('application/x-www-form-urlencoded') &&
        !contentType.includes('multipart/form-data'))) {
      errors.push('Invalid content type');
    }
  }
  
  // Validate request URL
  const { pathname } = request.nextUrl;
  if (pathname.includes('..') || pathname.includes('//')) {
    errors.push('Invalid request path');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export default {
  securityMiddleware,
  createSecurityHeaders,
  createCORSHeaders,
  createRateLimiter,
  createSecurityMonitor,
  validateRequest,
};