import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { NextRequest } from 'next/server';

import { generateTokens } from '@/lib/auth/jwt';
import { withCors } from '@/lib/auth/middleware';
import { createSession } from '@/lib/auth/session';
import { UserRepository } from '@/lib/db/repositories/UserRepository';
import { sessionRedis } from '@/lib/db/client';
import { createAuditLog } from '@/lib/audit/service';

const userRepository = new UserRepository();

interface GoogleUser {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale: string;
  hd?: string; // Hosted domain for G Suite users
}

const callbackSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().min(1, 'State parameter is required'),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

// Enhanced state validation
const validateOAuthState = async (stateToken: string): Promise<{ returnTo: string; timestamp: number; provider: string } | null> => {
  try {
    const stateData = await sessionRedis.get(`oauth_state:${stateToken}`);
    if (!stateData) {
      return null;
    }

    const parsed = JSON.parse(stateData);
    
    // Validate timestamp and provider
    const now = Date.now();
    if (now - parsed.timestamp > 600000 || parsed.provider !== 'google') { // 10 minutes
      await sessionRedis.del(`oauth_state:${stateToken}`);
      return null;
    }

    // Clean up used state
    await sessionRedis.del(`oauth_state:${stateToken}`);
    
    return parsed;
  } catch (error) {
    console.error('Google OAuth state validation error:', error);
    return null;
  }
};

async function googleCallbackHandler(req: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const ipAddress = req.ip || req.headers.get('x-forwarded-for') || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';
  
  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return NextResponse.json(
        { error: 'Method not allowed' },
        { status: 405 }
      );
    }

    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');

    // Handle OAuth errors from Google
    if (error) {
      await createAuditLog({
        action: 'oauth.google.error',
        resource: 'authentication',
        resourceId: null,
        userId: null,
        details: {
          error,
          errorDescription,
          ipAddress,
          userAgent
        },
        status: 'failed'
      });
      
      const errorUrl = new URL('/auth/error', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4400');
      errorUrl.searchParams.set('error', 'oauth_error');
      errorUrl.searchParams.set('message', errorDescription || 'Google OAuth authentication failed');
      return NextResponse.redirect(errorUrl);
    }

    // Validate required parameters
    const validationResult = callbackSchema.safeParse({ code, state, error, error_description: errorDescription });
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid callback parameters',
          details: validationResult.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
        },
        { status: 400 }
      );
    }

    const { code: validatedCode, state: validatedState } = validationResult.data;

    // Validate OAuth state to prevent CSRF attacks
    const stateData = await validateOAuthState(validatedState);
    if (!stateData) {
      return NextResponse.json(
        { error: 'Invalid or expired OAuth state' },
        { status: 400 }
      );
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code: validatedCode,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Failed to exchange code for token: ${tokenResponse.status} ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    
    if (tokenData.error) {
      throw new Error(tokenData.error_description || tokenData.error);
    }

    const accessToken = tokenData.access_token;

    // Fetch user info from Google
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      throw new Error(`Failed to fetch user info from Google: ${userResponse.status} ${errorText}`);
    }

    const googleUser: GoogleUser = await userResponse.json();

    // Validate email is verified
    if (!googleUser.verified_email) {
      await createAuditLog({
        action: 'oauth.google.unverified_email',
        resource: 'authentication',
        resourceId: null,
        userId: null,
        details: {
          email: googleUser.email,
          ipAddress,
          userAgent
        },
        status: 'failed'
      });
      
      return NextResponse.json(
        { error: 'Email address must be verified to sign in with Google' },
        { status: 400 }
      );
    }

    // Determine user role - G Suite users get higher privileges
    let userRole: 'ADMIN' | 'PLATFORM_ENGINEER' | 'DEVELOPER' = 'DEVELOPER';
    const adminDomains = (process.env.GOOGLE_ADMIN_DOMAINS || '').split(',').map(d => d.trim()).filter(Boolean);
    const adminEmails = (process.env.GOOGLE_ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
    
    if (adminEmails.includes(googleUser.email)) {
      userRole = 'ADMIN';
    } else if (googleUser.hd && adminDomains.includes(googleUser.hd)) {
      userRole = 'PLATFORM_ENGINEER';
    }

    // Find or create user with enhanced security checks
    let user = await userRepository.findByProvider('google', googleUser.id);
    const now = new Date();
    let isNewUser = false;
    
    if (!user) {
      // Check if user exists with the same email
      user = await userRepository.findByEmail(googleUser.email);
      
      if (user) {
        // Account linking logic
        if (user.provider !== 'local') {
          await createAuditLog({
            action: 'oauth.google.account_conflict',
            resource: 'authentication',
            resourceId: user.id,
            userId: user.id,
            details: {
              existingProvider: user.provider,
              googleEmail: googleUser.email,
              googleId: googleUser.id,
              ipAddress,
              userAgent
            },
            status: 'failed'
          });
          
          return NextResponse.json(
            { error: 'Account already exists with a different provider. Please contact support for account linking.' },
            { status: 409 }
          );
        }
        
        // Link Google to local account
        user = await userRepository.update(user.id, {
          provider: 'google',
          providerId: googleUser.id,
          avatar: googleUser.picture,
          lastLogin: now,
          role: userRole,
        });
        
        await createAuditLog({
          action: 'oauth.google.account_linked',
          resource: 'user',
          resourceId: user.id,
          userId: user.id,
          details: {
            googleEmail: googleUser.email,
            googleId: googleUser.id,
            ipAddress,
            userAgent
          },
          status: 'success'
        });
      } else {
        // Create new user
        isNewUser = true;
        user = await userRepository.create({
          email: googleUser.email,
          name: googleUser.name,
          username: googleUser.email.split('@')[0], // Use email prefix as username
          avatar: googleUser.picture,
          provider: 'google',
          providerId: googleUser.id,
          role: userRole,
          isActive: true,
          lastLogin: now,
        });
        
        await createAuditLog({
          action: 'oauth.google.user_created',
          resource: 'user',
          resourceId: user.id,
          userId: user.id,
          details: {
            email: googleUser.email,
            googleId: googleUser.id,
            role: userRole,
            hostedDomain: googleUser.hd,
            ipAddress,
            userAgent
          },
          status: 'success'
        });
      }
    } else {
      // Update existing user info
      user = await userRepository.update(user.id, {
        name: googleUser.name,
        avatar: googleUser.picture,
        role: userRole, // Update role in case domain membership changed
        lastLogin: now,
      });
    }

    // Security check: Verify user account is active
    if (!user.isActive) {
      await createAuditLog({
        action: 'oauth.google.inactive_account',
        resource: 'user',
        resourceId: user.id,
        userId: user.id,
        details: {
          email: user.email,
          ipAddress,
          userAgent
        },
        status: 'failed'
      });
      
      return NextResponse.json(
        { error: 'Account is deactivated. Please contact support.' },
        { status: 403 }
      );
    }

    // Generate JWT tokens
    const tokens = generateTokens(user);

    // Create secure session
    const sessionId = await createSession(user, {
      ipAddress,
      userAgent,
    });

    // Log successful authentication
    await createAuditLog({
      action: 'oauth.google.success',
      resource: 'authentication',
      resourceId: user.id,
      userId: user.id,
      details: {
        email: user.email,
        role: user.role,
        isNewUser,
        hostedDomain: googleUser.hd,
        ipAddress,
        userAgent,
        duration: Date.now() - startTime
      },
      status: 'success'
    });

    // Determine redirect URL with proper validation
    const redirectUrl = new URL(stateData.returnTo || '/dashboard', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4400');
    
    // For new users, redirect to onboarding flow
    if (isNewUser) {
      redirectUrl.pathname = '/onboarding';
      redirectUrl.searchParams.set('welcome', 'true');
      redirectUrl.searchParams.set('provider', 'google');
    }
    
    const response = NextResponse.redirect(redirectUrl);

    // Set secure session cookie
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
      domain: process.env.NODE_ENV === 'production' ? 
        new URL(process.env.NEXT_PUBLIC_APP_URL || '').hostname : undefined,
    };

    response.cookies.set('session', sessionId, cookieOptions);

    // Add security headers
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('X-XSS-Protection', '1; mode=block');

    return response;
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    
    // Log OAuth error
    await createAuditLog({
      action: 'oauth.google.callback_error',
      resource: 'authentication',
      resourceId: null,
      userId: null,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress,
        userAgent,
        duration: Date.now() - startTime
      },
      status: 'error'
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
        },
        { status: 400 }
      );
    }

    // Redirect to error page
    const errorUrl = new URL('/auth/error', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4400');
    errorUrl.searchParams.set('error', error instanceof Error ? error.message : 'Google authentication failed');
    
    return NextResponse.redirect(errorUrl);
  }
}

// Apply middleware
export const GET = withCors()(googleCallbackHandler);
export const POST = withCors()(googleCallbackHandler);