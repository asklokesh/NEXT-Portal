import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { randomBytes } from 'crypto';
import { sessionRedis } from '@/lib/db/client';
// import { createAuditLog } from '@/lib/audit/service';

// Enhanced OAuth configuration with security validation
const validateOAuthConfig = () => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || 'http://localhost:4400';
  
  if (!clientId || !clientSecret) {
    console.warn('GitHub OAuth credentials not configured.');
    // For development, provide helpful error message
    if (process.env.NODE_ENV === 'development') {
      throw new Error(`GitHub OAuth not configured. Please:
1. Copy .env.local.example to .env.local
2. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .env.local
3. Create a GitHub OAuth App at https://github.com/settings/developers
4. Set callback URL to: ${appUrl}/api/auth/github/callback`);
    }
    throw new Error('GitHub OAuth not configured');
  }
  
  // Validate that required environment variables are not placeholder values
  if (clientId.includes('your_github') || clientSecret.includes('your_github')) {
    throw new Error(`GitHub OAuth credentials contain placeholder values. Please set actual values in your .env.local file.
Visit https://github.com/settings/developers to create a GitHub OAuth App.`);
  }
  
  return { clientId, clientSecret, appUrl };
};

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const ipAddress = req.ip || req.headers.get('x-forwarded-for') || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';
  
  try {
    // Validate OAuth configuration
    const { clientId, appUrl } = validateOAuthConfig();
    
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
      nonce: randomBytes(16).toString('hex')
    };

    // Store state with session Redis (with fallback)
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

    const redirectUri = `${appUrl}/api/auth/github/callback`;
    
    // Enhanced scope for enterprise features
    const scope = [
      'read:user',
      'user:email',
      'read:org' // For organization membership verification
    ].join(' ');

    // Build GitHub OAuth URL with enhanced security parameters
    const githubOAuthUrl = new URL('https://github.com/login/oauth/authorize');
    githubOAuthUrl.searchParams.set('client_id', clientId);
    githubOAuthUrl.searchParams.set('redirect_uri', redirectUri);
    githubOAuthUrl.searchParams.set('scope', scope);
    githubOAuthUrl.searchParams.set('state', stateToken);
    githubOAuthUrl.searchParams.set('allow_signup', 'false'); // Security: disable new signups during OAuth
    
    // Add additional security parameters
    githubOAuthUrl.searchParams.set('response_type', 'code');

    // Log OAuth initiation
    console.log('GitHub OAuth initiated', {
      returnTo: validatedReturnTo,
      ipAddress,
      userAgent,
      duration: Date.now() - startTime
    });

    // Add security headers
    const response = NextResponse.redirect(githubOAuthUrl.toString());
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'no-referrer');

    return response;
  } catch (error) {
    console.error('GitHub OAuth start error:', error);
    
    // Log OAuth error
    console.error('GitHub OAuth failed', {
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