/**
 * Edge Runtime Compatible Security Middleware
 * This middleware is designed to work in Next.js Edge Runtime without Node.js dependencies
 */

import { NextRequest, NextResponse } from 'next/server';

// Environment configuration
const isDevelopment = process.env.NODE_ENV === 'development';

// Edge Runtime compatible rate limiting using Map
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100;

// Rate limiting configuration per endpoint
const RATE_LIMITS: Record<string, { windowMs: number; max: number }> = {
  '/api/auth': { windowMs: 15 * 60 * 1000, max: 20 }, // 20 requests per 15 minutes
  '/api/plugins': { windowMs: 60 * 1000, max: 30 }, // 30 requests per minute
  '/api/catalog': { windowMs: 60 * 1000, max: 100 }, // 100 requests per minute
  '/api/admin': { windowMs: 60 * 1000, max: 10 }, // 10 requests per minute for admin
  default: { windowMs: 60 * 1000, max: 60 }, // 60 requests per minute default
};

// CORS Configuration
const CORS_CONFIG = {
  allowedOrigins: [
    'https://localhost:4400',
    'https://127.0.0.1:4400',
    'http://localhost:4400',
    'http://127.0.0.1:4400',
    process.env.CORS_ORIGIN,
    process.env.NEXT_PUBLIC_FRONTEND_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ].filter(Boolean) as string[],
  
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
  
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'X-DNS-Prefetch-Control': 'off',
  'X-Download-Options': 'noopen',
};

function getRateLimitKey(request: NextRequest): string {
  const ip = request.headers.get('x-forwarded-for') || 
    request.headers.get('x-real-ip') || 
    'unknown';
  return `${ip}:${request.nextUrl.pathname}`;
}

function getEndpointRateLimit(pathname: string): { windowMs: number; max: number } {
  // Find the most specific matching rate limit
  for (const [pattern, config] of Object.entries(RATE_LIMITS)) {
    if (pattern !== 'default' && pathname.startsWith(pattern)) {
      return config;
    }
  }
  return RATE_LIMITS.default;
}

function checkRateLimit(request: NextRequest): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
} {
  const key = getRateLimitKey(request);
  const config = getEndpointRateLimit(request.nextUrl.pathname);
  const now = Date.now();
  const windowStart = Math.floor(now / config.windowMs) * config.windowMs;
  const windowKey = `${key}:${windowStart}`;
  
  let limit = requestCounts.get(windowKey);

  if (!limit || limit.resetTime < now) {
    limit = {
      count: 1,
      resetTime: windowStart + config.windowMs
    };
    requestCounts.set(windowKey, limit);
    
    // Clean up expired entries
    for (const [k, v] of requestCounts.entries()) {
      if (v.resetTime < now) {
        requestCounts.delete(k);
      }
    }
    
    return { allowed: true, remaining: config.max - 1, resetTime: limit.resetTime };
  }

  if (limit.count >= config.max) {
    return { allowed: false, remaining: 0, resetTime: limit.resetTime };
  }

  limit.count++;
  return { allowed: true, remaining: config.max - limit.count, resetTime: limit.resetTime };
}

export function createSecurityHeaders(request: NextRequest): Record<string, string> {
  const headers: Record<string, string> = { ...SECURITY_HEADERS };
  
  // Environment-specific adjustments
  if (isDevelopment) {
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
    (isDevelopment && requestOrigin.includes('localhost'));
  
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

export function logSecurityEvent(event: {
  type: 'rate_limit' | 'cors_violation' | 'suspicious_request' | 'auth_failure';
  ip: string | null;
  userAgent?: string | null;
  endpoint?: string;
  details?: any;
}): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: 'SECURITY',
    ...event
  };
  
  // In Edge Runtime, we can only use console logging
  console.warn('SECURITY EVENT:', logEntry);
}

export function detectSuspiciousActivity(request: NextRequest): boolean {
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

export function shouldSkipMiddleware(pathname: string): boolean {
  return (
    pathname.startsWith('/_next/static') ||
    pathname.startsWith('/_next/image') ||
    pathname.startsWith('/static/') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js|woff|woff2|ttf|eot)$/) ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  );
}

export {
  checkRateLimit,
  RATE_LIMITS,
  CORS_CONFIG,
  SECURITY_HEADERS,
  isDevelopment
};