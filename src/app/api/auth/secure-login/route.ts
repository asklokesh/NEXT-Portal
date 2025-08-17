/**
 * Security-Hardened Login API
 * Enterprise-grade authentication with comprehensive security measures
 */

import { NextRequest, NextResponse } from 'next/server';
import { secureAuth } from '@/lib/auth/security-hardened';
import { validateRequestBody } from '@/lib/security/input-validation';
import rateLimit from '@/lib/security/rate-limiter';

// Request validation schema
const LOGIN_SCHEMA = {
  email: {
    type: 'email',
    required: true,
    maxLength: 254
  },
  password: {
    type: 'password',
    required: true,
    minLength: 8,
    maxLength: 128
  },
  rememberMe: {
    type: 'text',
    required: false,
    customValidator: (value: string) => value === 'true' || value === 'false' || value === undefined
  },
  mfaToken: {
    type: 'text',
    required: false,
    minLength: 6,
    maxLength: 8,
    customPattern: /^\d{6,8}$/
  },
  deviceTrust: {
    type: 'text',
    required: false,
    customValidator: (value: string) => value === 'true' || value === 'false' || value === undefined
  }
};

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const clientIP = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || 'unknown';

  try {
    // Rate limiting check - multiple layers
    const rateLimitChecks = await Promise.all([
      rateLimit.checkLimit(`login:ip:${clientIP}`, 'login'),
      rateLimit.checkBurstProtection(`login:ip:${clientIP}`, 10, 5000) // Max 10 requests per 5 seconds
    ]);

    const blocked = rateLimitChecks.find(check => !check.allowed);
    if (blocked) {
      await logSecurityEvent('rate_limit_exceeded', {
        ip: clientIP,
        userAgent,
        retryAfter: blocked.retryAfter
      }, 'medium');

      return NextResponse.json({
        success: false,
        error: 'Too many login attempts. Please try again later.',
        retryAfter: Math.ceil(blocked.retryAfter / 1000)
      }, { 
        status: 429,
        headers: {
          'Retry-After': Math.ceil(blocked.retryAfter / 1000).toString(),
          'X-RateLimit-Limit': blocked.limit.toString(),
          'X-RateLimit-Remaining': blocked.remaining.toString(),
          'X-RateLimit-Reset': new Date(blocked.resetTime).toISOString()
        }
      });
    }

    // Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      await logSecurityEvent('invalid_json', {
        ip: clientIP,
        userAgent,
        error: 'Invalid JSON in request body'
      }, 'low');

      return NextResponse.json({
        success: false,
        error: 'Invalid request format'
      }, { status: 400 });
    }

    // Validate and sanitize inputs
    const validation = validateRequestBody(body, LOGIN_SCHEMA);
    if (!validation.valid) {
      await logSecurityEvent('validation_failed', {
        ip: clientIP,
        userAgent,
        errors: validation.errors
      }, 'low');

      return NextResponse.json({
        success: false,
        error: 'Invalid input data',
        details: validation.errors
      }, { status: 400 });
    }

    const { email, password, rememberMe, mfaToken, deviceTrust } = validation.sanitized;

    // Additional security checks
    const securityWarnings: string[] = [];
    
    // Check for suspicious user agent
    if (isSuspiciousUserAgent(userAgent)) {
      securityWarnings.push('Suspicious user agent detected');
    }

    // Check for known malicious IPs (in production, use threat intelligence)
    if (await isKnownMaliciousIP(clientIP)) {
      await logSecurityEvent('malicious_ip_detected', {
        ip: clientIP,
        userAgent,
        email
      }, 'high');

      return NextResponse.json({
        success: false,
        error: 'Access denied'
      }, { status: 403 });
    }

    // Attempt authentication using hardened auth manager
    const authResult = await secureAuth.authenticateUser(
      email,
      password,
      request,
      {
        rememberMe: rememberMe === 'true',
        mfaToken,
        deviceTrust: deviceTrust === 'true'
      }
    );

    // Handle authentication result
    if (!authResult.success) {
      const responseTime = Date.now() - startTime;
      
      // Log failed attempt with timing to detect brute force patterns
      await logSecurityEvent('login_failed', {
        ip: clientIP,
        userAgent,
        email,
        error: authResult.error,
        responseTime,
        requiresMFA: authResult.requiresMFA,
        accountLocked: authResult.accountLocked
      }, authResult.accountLocked ? 'high' : 'medium');

      // Standardize response time to prevent timing attacks
      const minResponseTime = 1000; // 1 second minimum
      if (responseTime < minResponseTime) {
        await new Promise(resolve => setTimeout(resolve, minResponseTime - responseTime));
      }

      const response: any = {
        success: false,
        error: authResult.error
      };

      if (authResult.requiresMFA) {
        response.requiresMFA = true;
      }

      return NextResponse.json(response, { 
        status: authResult.accountLocked ? 423 : 401 
      });
    }

    // Successful authentication - create secure response
    const response = NextResponse.json({
      success: true,
      user: {
        id: authResult.user!.id,
        email: authResult.user!.email,
        name: authResult.user!.name,
        role: authResult.user!.role,
        permissions: authResult.user!.permissions,
        organizationId: authResult.user!.organizationId,
        tenantId: authResult.user!.tenantId,
        emailVerified: authResult.user!.emailVerified,
        mfaEnabled: authResult.user!.mfaEnabled
      },
      sessionId: authResult.sessionId,
      warnings: securityWarnings
    });

    // Set secure HTTP-only cookies
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: '/',
      domain: process.env.COOKIE_DOMAIN || undefined
    };

    // Access token (short-lived)
    response.cookies.set('access-token', authResult.accessToken!, {
      ...cookieOptions,
      maxAge: 15 * 60, // 15 minutes
    });

    // Refresh token (longer-lived)
    response.cookies.set('refresh-token', authResult.refreshToken!, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    // Session cookie
    response.cookies.set('session-id', authResult.sessionId!, {
      ...cookieOptions,
      maxAge: rememberMe === 'true' ? 30 * 24 * 60 * 60 : 24 * 60 * 60, // 30 days or 24 hours
    });

    // CSRF token
    const csrfToken = generateCSRFToken();
    response.cookies.set('csrf-token', csrfToken, {
      ...cookieOptions,
      httpOnly: false, // CSRF token needs to be accessible to JavaScript
      maxAge: 24 * 60 * 60 // 24 hours
    });

    response.headers.set('X-CSRF-Token', csrfToken);

    // Security headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    if (process.env.NODE_ENV === 'production') {
      response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    // Log successful login
    await logSecurityEvent('login_success', {
      ip: clientIP,
      userAgent,
      userId: authResult.user!.id,
      email: authResult.user!.email,
      sessionId: authResult.sessionId,
      responseTime: Date.now() - startTime,
      mfaUsed: authResult.user!.mfaEnabled,
      rememberMe: rememberMe === 'true'
    }, 'low');

    return response;

  } catch (error) {
    console.error('Secure login error:', error);

    // Log system error
    await logSecurityEvent('login_system_error', {
      ip: clientIP,
      userAgent,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, 'critical');

    // Standardize error response time
    const responseTime = Date.now() - startTime;
    const minResponseTime = 1000;
    if (responseTime < minResponseTime) {
      await new Promise(resolve => setTimeout(resolve, minResponseTime - responseTime));
    }

    return NextResponse.json({
      success: false,
      error: 'An error occurred during authentication'
    }, { status: 500 });
  }
}

/**
 * Helper functions
 */
function getClientIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         request.headers.get('x-real-ip') ||
         request.headers.get('x-client-ip') ||
         request.headers.get('cf-connecting-ip') || // Cloudflare
         request.headers.get('x-forwarded') ||
         request.headers.get('forwarded') ||
         'unknown';
}

function isSuspiciousUserAgent(userAgent: string): boolean {
  const suspiciousPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /curl/i,
    /wget/i,
    /python/i,
    /requests/i,
    /postman/i,
    /insomnia/i
  ];

  return suspiciousPatterns.some(pattern => pattern.test(userAgent));
}

async function isKnownMaliciousIP(ip: string): Promise<boolean> {
  // In production, integrate with threat intelligence services
  // For now, return false (no malicious IPs detected)
  return false;
}

function generateCSRFToken(): string {
  return require('crypto').randomBytes(32).toString('hex');
}

async function logSecurityEvent(
  eventType: string,
  details: Record<string, any>,
  severity: 'low' | 'medium' | 'high' | 'critical'
): Promise<void> {
  const event = {
    type: eventType,
    severity,
    timestamp: new Date().toISOString(),
    details
  };

  // Log to console (in production, use proper logging service)
  console.log(`[SECURITY] ${severity.toUpperCase()}: ${eventType}`, event);

  // In production:
  // 1. Send to SIEM (Security Information and Event Management)
  // 2. Store in security audit database
  // 3. Send alerts for high/critical events
  // 4. Update threat intelligence feeds
}

// OPTIONS handler for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || 'https://localhost:3000',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400' // 24 hours
    }
  });
}