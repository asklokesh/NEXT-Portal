/**
 * Security-Hardened Edge Runtime Middleware
 * Enterprise-grade security with comprehensive protections
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { permissionCheckMiddleware } from './edge-permission-check';
import { 
  extractTenantContext, 
  tenantContextMiddleware as newTenantContextMiddleware,
  validateTenantAccess,
  handleTenantError 
} from './tenant-context';

// Security configurations
const BYPASS_ROUTES = [
  '/_next/static',
  '/_next/image',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/.well-known'
];

const SENSITIVE_ROUTES = [
  '/api/auth',
  '/api/admin',
  '/api/plugins/install',
  '/api/config/visual/deploy'
];

// Rate limiting store (in-memory for Edge Runtime)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Security functions compatible with Edge Runtime
function getClientIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         request.headers.get('x-real-ip') ||
         request.headers.get('cf-connecting-ip') ||
         'unknown';
}

function checkRateLimit(request: NextRequest): { allowed: boolean; remaining: number; resetTime: number; retryAfter: number } {
  const clientIP = getClientIP(request);
  const pathname = request.nextUrl.pathname;
  const key = `${clientIP}:${pathname}`;
  const now = Date.now();
  
  // Different limits for different endpoints
  let limit = 100; // Default: 100 requests per minute
  let windowMs = 60000; // 1 minute
  
  if (SENSITIVE_ROUTES.some(route => pathname.startsWith(route))) {
    limit = 10; // Sensitive endpoints: 10 requests per minute
    windowMs = 60000;
  } else if (pathname.startsWith('/api/')) {
    limit = 50; // API endpoints: 50 requests per minute
    windowMs = 60000;
  }
  
  const windowStart = now - windowMs;
  let entry = rateLimitStore.get(key);
  
  // Clean up old entries
  if (!entry || entry.resetTime < windowStart) {
    entry = { count: 0, resetTime: now + windowMs };
    rateLimitStore.set(key, entry);
  }
  
  entry.count++;
  
  const allowed = entry.count <= limit;
  const remaining = Math.max(0, limit - entry.count);
  const retryAfter = allowed ? 0 : entry.resetTime - now;
  
  return {
    allowed,
    remaining,
    resetTime: entry.resetTime,
    retryAfter
  };
}

function detectSuspiciousActivity(request: NextRequest): { suspicious: boolean; reasons: string[]; severity: string } {
  const reasons: string[] = [];
  let severity = 'low';
  const userAgent = request.headers.get('user-agent') || '';
  const pathname = request.nextUrl.pathname;
  const query = request.nextUrl.search;
  
  // Check for bot/crawler user agents on sensitive endpoints
  if (SENSITIVE_ROUTES.some(route => pathname.startsWith(route))) {
    const botPatterns = [/bot/i, /crawler/i, /spider/i, /scraper/i, /curl/i, /wget/i];
    if (botPatterns.some(pattern => pattern.test(userAgent))) {
      reasons.push('Bot accessing sensitive endpoint');
      severity = 'medium';
    }
  }
  
  // Check for dangerous query parameters
  const dangerousParams = [
    /<script/i, /javascript:/i, /on\w+=/i, /\.\.\//,
    /\/etc\/passwd/i, /cmd\.exe/i, /<\?php/i,
    /union.*select/i, /drop.*table/i
  ];
  
  if (dangerousParams.some(pattern => pattern.test(query))) {
    reasons.push('Suspicious query parameters');
    severity = 'high';
  }
  
  // Check for path traversal attempts
  if (/\.\.\/|\.\.\\|%2e%2e%2f|%252e%252e%252f/i.test(pathname)) {
    reasons.push('Path traversal attempt');
    severity = 'critical';
  }
  
  // Check for null bytes
  if (request.url.includes('%00') || request.url.includes('\0')) {
    reasons.push('Null byte injection attempt');
    severity = 'critical';
  }
  
  return {
    suspicious: reasons.length > 0,
    reasons,
    severity
  };
}

function generateCSP(): string {
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://api.github.com https://registry.npmjs.org",
    "media-src 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "upgrade-insecure-requests"
  ];

  if (process.env.NODE_ENV === 'development') {
    return csp.map(directive => {
      if (directive.startsWith('connect-src')) {
        return directive + " ws: wss: http://localhost:* https://localhost:*";
      }
      return directive;
    }).join('; ');
  }

  return csp.join('; ');
}

function createSecurityHeaders(request: NextRequest): Record<string, string> {
  const isProduction = process.env.NODE_ENV === 'production';
  const pathname = request.nextUrl.pathname;
  const headers: Record<string, string> = {};

  // Core security headers
  headers['X-Content-Type-Options'] = 'nosniff';
  headers['X-Frame-Options'] = 'DENY';
  headers['X-XSS-Protection'] = '1; mode=block';
  headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';
  headers['X-DNS-Prefetch-Control'] = 'off';
  headers['X-Download-Options'] = 'noopen';
  headers['X-Permitted-Cross-Domain-Policies'] = 'none';

  // Content Security Policy
  headers['Content-Security-Policy'] = generateCSP();

  // Permissions Policy
  headers['Permissions-Policy'] = [
    'accelerometer=()',
    'autoplay=()',
    'camera=()',
    'cross-origin-isolated=()',
    'display-capture=()',
    'encrypted-media=()',
    'fullscreen=(self)',
    'geolocation=()',
    'gyroscope=()',
    'keyboard-map=()',
    'magnetometer=()',
    'microphone=()',
    'midi=()',
    'payment=()',
    'picture-in-picture=()',
    'publickey-credentials-get=()',
    'screen-wake-lock=()',
    'sync-xhr=()',
    'usb=()',
    'web-share=()',
    'xr-spatial-tracking=()'
  ].join(', ');

  // HTTPS-only headers for production
  if (isProduction) {
    headers['Strict-Transport-Security'] = 'max-age=63072000; includeSubDomains; preload';
    headers['Expect-CT'] = 'max-age=86400, enforce';
  }

  // Cache control for sensitive routes
  if (pathname.startsWith('/api/auth') || pathname.startsWith('/api/admin')) {
    headers['Cache-Control'] = 'no-cache, no-store, must-revalidate, private';
    headers['Pragma'] = 'no-cache';
    headers['Expires'] = '0';
  }

  return headers;
}

function logSecurityEvent(type: string, details: any): void {
  const event = {
    type,
    timestamp: new Date().toISOString(),
    details
  };
  console.log(`[SECURITY] ${type}:`, event);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const startTime = Date.now();
  
  // Skip middleware for static assets and bypass routes
  if (BYPASS_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  try {
    // Detect suspicious activity
    const suspiciousCheck = detectSuspiciousActivity(request);
    if (suspiciousCheck.suspicious) {
      logSecurityEvent('suspicious_activity', {
        ip: getClientIP(request),
        userAgent: request.headers.get('user-agent'),
        url: request.url,
        reasons: suspiciousCheck.reasons,
        severity: suspiciousCheck.severity
      });

      // Block critical threats
      if (suspiciousCheck.severity === 'critical') {
        return new NextResponse('Forbidden', { status: 403 });
      }
    }

    // Rate limiting check
    const rateLimitResult = checkRateLimit(request);
    if (!rateLimitResult.allowed) {
      logSecurityEvent('rate_limit_exceeded', {
        ip: getClientIP(request),
        endpoint: pathname,
        retryAfter: rateLimitResult.retryAfter
      });

      return new NextResponse(
        JSON.stringify({
          error: 'Too many requests',
          retryAfter: Math.ceil(rateLimitResult.retryAfter / 1000)
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': Math.ceil(rateLimitResult.retryAfter / 1000).toString(),
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString()
          }
        }
      );
    }

    // HTTPS redirect in production
    if (process.env.NODE_ENV === 'production' && process.env.FORCE_HTTPS === 'true') {
      const proto = request.headers.get('x-forwarded-proto');
      if (proto === 'http') {
        const url = request.nextUrl.clone();
        url.protocol = 'https:';
        return NextResponse.redirect(url);
      }
    }

    // Multi-tenant context extraction and validation
    const tenantContext = extractTenantContext(request);
    
    // Routes that require tenant context
    const requireTenantRoutes = [
      '/api/plugins',
      '/api/catalog',
      '/api/billing',
      '/api/metrics',
      '/api/workflows'
    ];
    
    const requiresTenant = requireTenantRoutes.some(route => pathname.startsWith(route));
    
    if (requiresTenant && !tenantContext) {
      logSecurityEvent('missing_tenant_context', {
        ip: getClientIP(request),
        path: pathname,
        userAgent: request.headers.get('user-agent')
      });
      
      return new NextResponse(
        JSON.stringify({
          error: 'Tenant context required',
          message: 'This endpoint requires tenant identification'
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...createSecurityHeaders(request)
          }
        }
      );
    }

    // Validate tenant access if context is present
    if (tenantContext) {
      try {
        const hasAccess = await validateTenantAccess(tenantContext.tenantId);
        if (!hasAccess) {
          logSecurityEvent('tenant_access_denied', {
            tenantId: tenantContext.tenantId,
            ip: getClientIP(request),
            path: pathname
          });
          
          return new NextResponse(
            JSON.stringify({
              error: 'Tenant access denied',
              tenantId: tenantContext.tenantId
            }),
            {
              status: 403,
              headers: {
                'Content-Type': 'application/json',
                ...createSecurityHeaders(request)
              }
            }
          );
        }
        
        // Apply tenant context middleware
        const tenantResponse = await newTenantContextMiddleware(request, tenantContext);
        if (tenantResponse && tenantResponse.status !== 200) {
          const securityHeaders = createSecurityHeaders(request);
          Object.entries(securityHeaders).forEach(([key, value]) => {
            tenantResponse.headers.set(key, value);
          });
          return tenantResponse;
        }
        
      } catch (error) {
        if (error instanceof Error && tenantContext) {
          return handleTenantError(error, tenantContext);
        }
        throw error;
      }
    }

    // Permission check for API routes
    if (pathname.startsWith('/api/')) {
      const permissionResponse = await permissionCheckMiddleware(request);
      if (permissionResponse) {
        // Add security headers to permission response
        const securityHeaders = createSecurityHeaders(request);
        Object.entries(securityHeaders).forEach(([key, value]) => {
          permissionResponse.headers.set(key, value);
        });
        return permissionResponse;
      }
    }

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      const corsHeaders = {
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400'
      };

      return new NextResponse(null, {
        status: 200,
        headers: corsHeaders
      });
    }

    // Create response with comprehensive security headers
    const response = NextResponse.next();
    
    // Apply security headers
    const securityHeaders = createSecurityHeaders(request);
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    // Add rate limit headers
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    response.headers.set('X-RateLimit-Reset', new Date(rateLimitResult.resetTime).toISOString());

    // Add monitoring headers
    response.headers.set('X-Request-ID', generateRequestId());
    response.headers.set('X-Response-Time', `${Date.now() - startTime}ms`);
    response.headers.set('X-Environment', process.env.NODE_ENV || 'production');
    
    // Add tenant context headers if available
    if (tenantContext) {
      response.headers.set('X-Tenant-ID', tenantContext.tenantId);
      response.headers.set('X-Tenant-Slug', tenantContext.tenantSlug);
    }

    // CORS headers for API routes
    if (pathname.startsWith('/api/')) {
      response.headers.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    }

    return response;

  } catch (error) {
    console.error('Middleware error:', error);
    
    // Fail securely
    const errorResponse = NextResponse.next();
    const basicHeaders = createSecurityHeaders(request);
    Object.entries(basicHeaders).forEach(([key, value]) => {
      errorResponse.headers.set(key, value);
    });
    
    return errorResponse;
  }
}

function generateRequestId(): string {
  // Edge Runtime compatible random ID generation
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// Clean up rate limit store periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now - 300000) { // Remove entries older than 5 minutes
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean up every minute

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - robots.txt and sitemap.xml
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
  runtime: 'edge', // Explicitly use Edge Runtime
};