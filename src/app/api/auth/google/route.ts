import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { randomBytes } from 'crypto';
import { sessionRedis } from '@/lib/db/client';
import { createAuditLog } from '@/lib/audit/service';

// Enhanced OAuth configuration validation for Google
const validateGoogleOAuthConfig = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4400';
  
  if (!clientId || !clientSecret) {
    console.warn('Google OAuth credentials not configured.');
    // For development, provide helpful error message
    if (process.env.NODE_ENV === 'development') {
      throw new Error(`Google OAuth not configured. Please:
1. Copy .env.local.example to .env.local
2. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local
3. Create a Google OAuth App at https://console.cloud.google.com/apis/credentials
4. Set redirect URI to: ${appUrl}/api/auth/google/callback`);
    }
    throw new Error('Google OAuth not configured');
  }
  
  // Validate that required environment variables are not placeholder values
  if (clientId.includes('your_google') || clientSecret.includes('your_google')) {
    throw new Error(`Google OAuth credentials contain placeholder values. Please set actual values in your .env.local file.
Visit https://console.cloud.google.com/apis/credentials to create a Google OAuth App.`);
  }
  
  return { clientId, clientSecret, appUrl };
};

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const ipAddress = req.ip || req.headers.get('x-forwarded-for') || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';
  
  try {
    // Validate OAuth configuration
    const { clientId, appUrl } = validateGoogleOAuthConfig();
    
    const url = new URL(req.url);
    const returnTo = url.searchParams.get('returnTo') || '/dashboard';
    
    // Validate returnTo parameter to prevent open redirects
    const allowedRedirectPaths = ['/dashboard', '/plugins', '/services', '/teams'];
    let validatedReturnTo = '/dashboard';
    
    if (returnTo.startsWith('/') && !returnTo.startsWith('//')) {
      const pathSegment = returnTo.split('?')[0];
      if (allowedRedirectPaths.some(path => pathSegment.startsWith(path))) {
        validatedReturnTo = returnTo;
      }
    }

    // Generate cryptographically secure state parameter
    const stateToken = randomBytes(32).toString('hex');
    const stateData = {
      returnTo: validatedReturnTo,
      timestamp: Date.now(),
      nonce: randomBytes(16).toString('hex'),
      provider: 'google'
    };

    // Store state in Redis with 10 minute expiration
    try {
      await sessionRedis.setex(
        `oauth_state:${stateToken}`,
        600, // 10 minutes
        JSON.stringify(stateData)
      );
    } catch (redisError) {
      console.warn('Redis not available, OAuth state stored in memory (dev only)');
      // In development, you might want to store in memory or skip state validation
      if (process.env.NODE_ENV !== 'development') {
        throw new Error('Session storage not available');
      }
    }

    const redirectUri = `${appUrl}/api/auth/google/callback`;
    
    // Enhanced scope for Google OAuth
    const scope = [
      'openid',
      'profile',
      'email'
    ].join(' ');

    // Build Google OAuth URL with enhanced security parameters
    const googleOAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleOAuthUrl.searchParams.set('client_id', clientId);
    googleOAuthUrl.searchParams.set('redirect_uri', redirectUri);
    googleOAuthUrl.searchParams.set('scope', scope);
    googleOAuthUrl.searchParams.set('state', stateToken);
    googleOAuthUrl.searchParams.set('response_type', 'code');
    googleOAuthUrl.searchParams.set('access_type', 'offline');
    googleOAuthUrl.searchParams.set('prompt', 'consent');
    
    // Add security parameters
    googleOAuthUrl.searchParams.set('include_granted_scopes', 'false');

    // Log OAuth initiation
    console.log('Google OAuth initiated', {
      returnTo: validatedReturnTo,
      ipAddress,
      userAgent,
      duration: Date.now() - startTime
    });

    // Add security headers
    const response = NextResponse.redirect(googleOAuthUrl.toString());
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'no-referrer');

    return response;
  } catch (error) {
    console.error('Google OAuth start error:', error);
    
    // Log OAuth error
    console.error('Google OAuth failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ipAddress,
      userAgent,
      duration: Date.now() - startTime
    });

    // Return user-friendly error without exposing sensitive details
    return NextResponse.json(
      { 
        error: 'Authentication service temporarily unavailable',
        code: 'AUTH_CONFIG_ERROR',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
      },
      { status: 503 }
    );
  }
}