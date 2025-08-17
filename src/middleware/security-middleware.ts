/**
 * Security Middleware
 * Comprehensive security headers and protections
 */

import { NextRequest, NextResponse } from 'next/server';
import { secureAuth } from '@/lib/auth/security-hardened';

// CSRF token verification
async function verifyCSRFToken(request: NextRequest): Promise<boolean> {
  // Skip CSRF for GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return true;
  }

  const csrfTokenFromHeader = request.headers.get('x-csrf-token');
  const csrfTokenFromCookie = request.cookies.get('csrf-token')?.value;

  if (!csrfTokenFromHeader || !csrfTokenFromCookie) {
    return false;
  }

  return csrfTokenFromHeader === csrfTokenFromCookie;
}

// Content Security Policy
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

  // In development, allow more permissive CSP
  if (process.env.NODE_ENV === 'development') {
    return csp.map(directive => {
      if (directive.startsWith('script-src')) {
        return directive + " 'unsafe-eval'";
      }
      if (directive.startsWith('connect-src')) {
        return directive + " ws: wss: http://localhost:* https://localhost:*";
      }
      return directive;
    }).join('; ');
  }

  return csp.join('; ');
}

// Security headers configuration
function getSecurityHeaders(request: NextRequest): Record<string, string> {
  const isProduction = process.env.NODE_ENV === 'production';
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

  // Permissions Policy (formerly Feature Policy)
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
    // HTTP Strict Transport Security
    headers['Strict-Transport-Security'] = 'max-age=63072000; includeSubDomains; preload';
    
    // Expect Certificate Transparency
    headers['Expect-CT'] = 'max-age=86400, enforce';
  }

  // Cache control for sensitive routes
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith('/api/auth') || pathname.startsWith('/api/admin')) {
    headers['Cache-Control'] = 'no-cache, no-store, must-revalidate, private';
    headers['Pragma'] = 'no-cache';
    headers['Expires'] = '0';
  }

  return headers;
}

// Check for suspicious request patterns
function detectSuspiciousActivity(request: NextRequest): {
  suspicious: boolean;
  reasons: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
} {
  const reasons: string[] = [];
  let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

  const userAgent = request.headers.get('user-agent') || '';
  const pathname = request.nextUrl.pathname;
  const query = request.nextUrl.search;

  // Check for bot/crawler user agents on sensitive endpoints
  if (pathname.startsWith('/api/auth') || pathname.startsWith('/api/admin')) {
    const botPatterns = [/bot/i, /crawler/i, /spider/i, /scraper/i];
    if (botPatterns.some(pattern => pattern.test(userAgent))) {
      reasons.push('Bot accessing sensitive endpoint');
      severity = 'medium';
    }
  }

  // Check for suspicious query parameters
  const dangerousParams = [
    /<script/i,
    /javascript:/i,
    /on\w+=/i,
    /\.\.\//,
    /\/etc\/passwd/i,
    /cmd\.exe/i,
    /<\?php/i,
    /union.*select/i,
    /drop.*table/i
  ];

  if (dangerousParams.some(pattern => pattern.test(query))) {
    reasons.push('Suspicious query parameters');
    severity = 'high';
  }

  // Check for path traversal attempts
  if (/\.\.\/|\.\.\\|%2e%2e%2f|%252e%252e%252f/i.test(pathname)) {
    reasons.push('Path traversal attempt');
    severity = 'high';
  }

  // Check for common attack patterns in URL
  const attackPatterns = [
    /wp-admin/i,
    /phpmyadmin/i,
    /admin\.php/i,
    /config\.php/i,
    /\/\.well-known\/security\.txt/i,
    /\/sitemap\.xml/i,
    /\/robots\.txt/i
  ];

  if (attackPatterns.some(pattern => pattern.test(pathname))) {
    reasons.push('Common attack pattern detected');
    severity = 'medium';
  }

  // Check for unusual request methods
  const allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
  if (!allowedMethods.includes(request.method)) {
    reasons.push('Unusual HTTP method');
    severity = 'medium';
  }

  // Check for missing required headers
  if (request.method === 'POST' && !request.headers.get('content-type')) {
    reasons.push('Missing Content-Type header');
    severity = 'low';
  }

  // Check for excessively long URLs (potential buffer overflow)
  if (request.url.length > 2048) {
    reasons.push('Excessively long URL');
    severity = 'medium';
  }

  // Check for null bytes (path truncation attack)
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

// Rate limiting check
async function checkRateLimit(request: NextRequest): Promise<{
  allowed: boolean;
  headers: Record<string, string>;
}> {
  // Import rate limiter (avoiding circular dependency)
  const rateLimit = await import('@/lib/security/rate-limiter').then(m => m.default);
  
  const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                   request.headers.get('x-real-ip') ||
                   'unknown';

  const pathname = request.nextUrl.pathname;
  
  // Apply different rate limits based on endpoint
  let ruleName: string;
  if (pathname.startsWith('/api/auth')) {
    ruleName = 'apiSensitive';
  } else if (pathname.startsWith('/api/admin')) {
    ruleName = 'apiSensitive';
  } else if (pathname.startsWith('/api/plugins/install')) {
    ruleName = 'apiSensitive';
  } else if (pathname.startsWith('/api/')) {
    ruleName = 'apiGeneral';
  } else {
    return { allowed: true, headers: {} };
  }

  const result = await rateLimit.checkLimit(`global:${clientIP}`, ruleName as any);
  
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': new Date(result.resetTime).toISOString()
  };

  if (!result.allowed) {
    headers['Retry-After'] = Math.ceil(result.retryAfter / 1000).toString();
  }

  return { allowed: result.allowed, headers };
}

// Main security middleware
export async function securityMiddleware(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  
  try {
    // Check for suspicious activity first
    const suspiciousCheck = detectSuspiciousActivity(request);
    if (suspiciousCheck.suspicious && suspiciousCheck.severity === 'critical') {
      // Block critical threats immediately
      console.log(`[SECURITY BLOCK] Critical threat detected: ${suspiciousCheck.reasons.join(', ')}`);
      
      return new NextResponse('Forbidden', {
        status: 403,
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
    }

    // Rate limiting check
    const rateLimitResult = await checkRateLimit(request);
    if (!rateLimitResult.allowed) {
      return new NextResponse('Too Many Requests', {
        status: 429,
        headers: {
          ...rateLimitResult.headers,
          'Content-Type': 'text/plain'
        }
      });
    }

    // CSRF token verification for state-changing operations
    if (process.env.NODE_ENV === 'production') {
      const csrfValid = await verifyCSRFToken(request);
      if (!csrfValid && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
        console.log('[SECURITY] CSRF token verification failed');
        
        return new NextResponse('CSRF token required', {
          status: 403,
          headers: {
            'Content-Type': 'text/plain'
          }
        });
      }
    }

    // Proceed with request
    const response = NextResponse.next();

    // Add security headers
    const securityHeaders = getSecurityHeaders(request);
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    // Add rate limit headers
    Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    // Add custom security headers
    response.headers.set('X-Request-ID', generateRequestId());
    response.headers.set('X-Response-Time', `${Date.now() - startTime}ms`);

    // Log suspicious activity (but allow the request)
    if (suspiciousCheck.suspicious) {
      console.log(`[SECURITY WARNING] ${suspiciousCheck.severity.toUpperCase()}: ${suspiciousCheck.reasons.join(', ')}`, {
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent'),
        method: request.method,
        url: request.url,
        timestamp: new Date().toISOString()
      });
    }

    return response;

  } catch (error) {
    console.error('Security middleware error:', error);
    
    // Fail securely - apply security headers even on error
    const response = NextResponse.next();
    const securityHeaders = getSecurityHeaders(request);
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return response;
  }
}

// Helper function to generate request ID
function generateRequestId(): string {
  return require('crypto').randomBytes(16).toString('hex');
}

export default securityMiddleware;