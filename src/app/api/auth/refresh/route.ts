/**
 * Secure Token Refresh API
 * Handles access token refresh using secure refresh tokens
 */

import { NextRequest, NextResponse } from 'next/server';
import { secureAuth } from '@/lib/auth/security-hardened';
import rateLimit from '@/lib/security/rate-limiter';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const clientIP = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || 'unknown';

  try {
    // Rate limiting for token refresh (more lenient than login)
    const rateLimitResult = await rateLimit.checkLimit(`token_refresh:ip:${clientIP}`, {
      maxRequests: 30,
      windowMs: 60 * 1000, // 1 minute window
      blockDuration: 5 * 60 * 1000 // 5 minute block
    });

    if (!rateLimitResult.allowed) {
      await logSecurityEvent('token_refresh_rate_limited', {
        ip: clientIP,
        userAgent,
        retryAfter: rateLimitResult.retryAfter
      }, 'medium');

      return NextResponse.json({
        success: false,
        error: 'Too many refresh attempts'
      }, { 
        status: 429,
        headers: {
          'Retry-After': Math.ceil(rateLimitResult.retryAfter / 1000).toString()
        }
      });
    }

    // Get refresh token from cookies or Authorization header
    let refreshToken = request.cookies.get('refresh-token')?.value;
    
    if (!refreshToken) {
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        refreshToken = authHeader.substring(7);
      }
    }

    if (!refreshToken) {
      await logSecurityEvent('token_refresh_missing_token', {
        ip: clientIP,
        userAgent
      }, 'low');

      return NextResponse.json({
        success: false,
        error: 'Refresh token not provided'
      }, { status: 401 });
    }

    // Validate CSRF token if present (defense in depth)
    const csrfToken = request.headers.get('x-csrf-token') || request.cookies.get('csrf-token')?.value;
    if (process.env.NODE_ENV === 'production' && !csrfToken) {
      await logSecurityEvent('token_refresh_missing_csrf', {
        ip: clientIP,
        userAgent
      }, 'medium');

      return NextResponse.json({
        success: false,
        error: 'CSRF token required'
      }, { status: 403 });
    }

    // Attempt token refresh using secure auth manager
    const refreshResult = await secureAuth.refreshAccessToken(refreshToken, request);

    if (!refreshResult.success) {
      const responseTime = Date.now() - startTime;

      await logSecurityEvent('token_refresh_failed', {
        ip: clientIP,
        userAgent,
        error: refreshResult.error,
        responseTime
      }, 'medium');

      // Clear invalid refresh token
      const response = NextResponse.json({
        success: false,
        error: refreshResult.error
      }, { status: 401 });

      response.cookies.set('refresh-token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 0,
        path: '/'
      });

      response.cookies.set('access-token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 0,
        path: '/'
      });

      return response;
    }

    // Create successful response
    const response = NextResponse.json({
      success: true,
      message: 'Token refreshed successfully'
    });

    // Set new secure cookies
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: '/',
      domain: process.env.COOKIE_DOMAIN || undefined
    };

    // New access token (short-lived)
    response.cookies.set('access-token', refreshResult.accessToken!, {
      ...cookieOptions,
      maxAge: 15 * 60, // 15 minutes
    });

    // New refresh token (if rotation is enabled)
    if (refreshResult.newRefreshToken) {
      response.cookies.set('refresh-token', refreshResult.newRefreshToken, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60, // 7 days
      });
    }

    // Update CSRF token
    const newCSRFToken = generateCSRFToken();
    response.cookies.set('csrf-token', newCSRFToken, {
      ...cookieOptions,
      httpOnly: false, // CSRF token needs to be accessible to JavaScript
      maxAge: 24 * 60 * 60 // 24 hours
    });

    response.headers.set('X-CSRF-Token', newCSRFToken);

    // Security headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');

    // Log successful refresh
    await logSecurityEvent('token_refresh_success', {
      ip: clientIP,
      userAgent,
      responseTime: Date.now() - startTime,
      tokenRotated: !!refreshResult.newRefreshToken
    }, 'low');

    return response;

  } catch (error) {
    console.error('Token refresh error:', error);

    await logSecurityEvent('token_refresh_system_error', {
      ip: clientIP,
      userAgent,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, 'critical');

    return NextResponse.json({
      success: false,
      error: 'An error occurred during token refresh'
    }, { status: 500 });
  }
}

/**
 * Secure logout endpoint
 */
export async function DELETE(request: NextRequest) {
  const clientIP = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || 'unknown';

  try {
    // Get session information from cookies
    const sessionId = request.cookies.get('session-id')?.value;
    const accessToken = request.cookies.get('access-token')?.value;

    let userId = 'unknown';
    
    // Try to get user ID from access token if available
    if (accessToken) {
      const tokenPayload = await secureAuth.verifyAccessToken(accessToken);
      if (tokenPayload) {
        userId = tokenPayload.userId;
      }
    }

    // Logout user session
    if (sessionId && userId !== 'unknown') {
      await secureAuth.logout(sessionId, userId, request);
    }

    // Create logout response
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    });

    // Clear all auth-related cookies
    const clearCookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      maxAge: 0,
      path: '/'
    };

    response.cookies.set('access-token', '', clearCookieOptions);
    response.cookies.set('refresh-token', '', clearCookieOptions);
    response.cookies.set('session-id', '', clearCookieOptions);
    response.cookies.set('csrf-token', '', {
      ...clearCookieOptions,
      httpOnly: false
    });

    // Log successful logout
    await logSecurityEvent('logout_success', {
      ip: clientIP,
      userAgent,
      userId,
      sessionId
    }, 'low');

    return response;

  } catch (error) {
    console.error('Logout error:', error);

    await logSecurityEvent('logout_system_error', {
      ip: clientIP,
      userAgent,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'medium');

    // Still return success for logout attempts, but log the error
    const response = NextResponse.json({
      success: true,
      message: 'Logout completed'
    });

    // Clear cookies regardless of errors
    const clearCookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      maxAge: 0,
      path: '/'
    };

    response.cookies.set('access-token', '', clearCookieOptions);
    response.cookies.set('refresh-token', '', clearCookieOptions);
    response.cookies.set('session-id', '', clearCookieOptions);
    response.cookies.set('csrf-token', '', {
      ...clearCookieOptions,
      httpOnly: false
    });

    return response;
  }
}

/**
 * Helper functions
 */
function getClientIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         request.headers.get('x-real-ip') ||
         request.headers.get('x-client-ip') ||
         request.headers.get('cf-connecting-ip') ||
         'unknown';
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

  console.log(`[SECURITY] ${severity.toUpperCase()}: ${eventType}`, event);
}

// OPTIONS handler for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || 'https://localhost:3000',
      'Access-Control-Allow-Methods': 'POST, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400'
    }
  });
}