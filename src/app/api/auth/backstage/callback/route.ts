import { NextRequest, NextResponse } from 'next/server';
import { handleBackstageOAuthCallback } from '@/lib/auth/backstage-auth';
import { createSession } from '@/lib/auth/session';
import { generateTokens } from '@/lib/auth/jwt';
import { UserRepository } from '@/lib/db/repositories/UserRepository';
import { createAuditLog } from '@/lib/audit/service';

const userRepository = new UserRepository();

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const ipAddress = req.ip || req.headers.get('x-forwarded-for') || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';

  try {
    // Check for OAuth errors
    if (error) {
      await createAuditLog({
        action: 'oauth.callback.error',
        resource: 'authentication',
        resourceId: null,
        userId: null,
        details: {
          provider: 'backstage',
          error,
          errorDescription,
          ipAddress,
          userAgent,
        },
        status: 'failed',
      });

      const errorUrl = new URL('/login', req.nextUrl.origin);
      errorUrl.searchParams.set('error', error);
      errorUrl.searchParams.set('message', errorDescription || 'OAuth authentication failed');
      
      return NextResponse.redirect(errorUrl);
    }

    if (!code || !state) {
      await createAuditLog({
        action: 'oauth.callback.missing_params',
        resource: 'authentication',
        resourceId: null,
        userId: null,
        details: {
          provider: 'backstage',
          hasCode: !!code,
          hasState: !!state,
          ipAddress,
          userAgent,
        },
        status: 'failed',
      });

      const errorUrl = new URL('/login', req.nextUrl.origin);
      errorUrl.searchParams.set('error', 'invalid_request');
      errorUrl.searchParams.set('message', 'Missing required parameters');
      
      return NextResponse.redirect(errorUrl);
    }

    // Handle the OAuth callback
    const result = await handleBackstageOAuthCallback(code, state);

    if (!result.success || !result.user) {
      await createAuditLog({
        action: 'oauth.callback.failed',
        resource: 'authentication',
        resourceId: null,
        userId: null,
        details: {
          provider: 'backstage',
          error: result.error,
          ipAddress,
          userAgent,
        },
        status: 'failed',
      });

      const errorUrl = new URL('/login', req.nextUrl.origin);
      errorUrl.searchParams.set('error', 'oauth_failed');
      errorUrl.searchParams.set('message', result.error || 'OAuth authentication failed');
      
      return NextResponse.redirect(errorUrl);
    }

    // Find or create user in local database
    let user = await userRepository.findByEmail(result.user.email);
    
    if (!user) {
      user = await userRepository.create({
        email: result.user.email,
        name: result.user.name,
        role: result.user.role as any,
        provider: 'backstage',
        providerId: result.user.id,
        isActive: true,
      });
    } else {
      // Update user information
      await userRepository.update(user.id, {
        name: result.user.name,
        lastLogin: new Date(),
      });
    }

    // Create session
    const sessionId = await createSession(user, {
      ipAddress,
      userAgent,
    });

    // Generate JWT tokens
    const tokens = generateTokens(user);

    // Log successful authentication
    await createAuditLog({
      action: 'oauth.callback.success',
      resource: 'authentication',
      resourceId: user.id,
      userId: user.id,
      details: {
        provider: 'backstage',
        backstageUserId: result.user.id,
        ipAddress,
        userAgent,
      },
      status: 'success',
    });

    // Set session cookie
    const response = NextResponse.redirect(new URL(result.redirectTo || '/dashboard', req.nextUrl.origin));
    
    response.cookies.set('session', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    // Optionally set auth token cookie for client-side usage
    response.cookies.set('auth-token', tokens.accessToken, {
      httpOnly: false, // Allow client-side access
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokens.expiresIn,
      path: '/',
    });

    return response;

  } catch (error) {
    console.error('OAuth callback error:', error);

    await createAuditLog({
      action: 'oauth.callback.error',
      resource: 'authentication',
      resourceId: null,
      userId: null,
      details: {
        provider: 'backstage',
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress,
        userAgent,
      },
      status: 'error',
    });

    const errorUrl = new URL('/login', req.nextUrl.origin);
    errorUrl.searchParams.set('error', 'server_error');
    errorUrl.searchParams.set('message', 'Authentication server error');
    
    return NextResponse.redirect(errorUrl);
  }
}