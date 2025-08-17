import { NextRequest, NextResponse } from 'next/server';
import { compare } from 'bcryptjs';
import { z } from 'zod';
import { jwtSecurity } from '@/lib/auth/jwt-security-enhanced';
import { enhancedSessionManager } from '@/lib/auth/session-security-enhanced';
import { db } from '@/lib/database/simple-client';
import crypto from 'crypto';

// Input validation schema
const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
  rememberMe: z.boolean().optional(),
  mfaToken: z.string().optional()
});

// Login attempt tracking with automatic cleanup
const loginAttempts = new Map<string, { count: number; lastAttempt: Date; lockedUntil?: Date }>();

// Cleanup old attempts every 5 minutes
setInterval(() => {
  const now = new Date();
  for (const [key, attempts] of loginAttempts.entries()) {
    if (attempts.lockedUntil && attempts.lockedUntil < now) {
      loginAttempts.delete(key);
    } else if (now.getTime() - attempts.lastAttempt.getTime() > 30 * 60 * 1000) { // 30 minutes
      loginAttempts.delete(key);
    }
  }
}, 5 * 60 * 1000);

function getClientInfo(request: NextRequest) {
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const acceptLanguage = request.headers.get('accept-language') || '';
  const acceptEncoding = request.headers.get('accept-encoding') || '';
  const ipAddress = 
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown';

  const deviceFingerprint = jwtSecurity.generateDeviceFingerprint(
    userAgent,
    acceptLanguage,
    acceptEncoding
  );

  return {
    ipAddress,
    userAgent,
    deviceFingerprint,
    platform: userAgent.includes('Windows') ? 'Windows' : 
              userAgent.includes('Mac') ? 'macOS' : 
              userAgent.includes('Linux') ? 'Linux' : 'Unknown',
    browser: userAgent.includes('Chrome') ? 'Chrome' :
             userAgent.includes('Firefox') ? 'Firefox' :
             userAgent.includes('Safari') && !userAgent.includes('Chrome') ? 'Safari' : 'Unknown'
  };
}

function checkAccountLockout(email: string): { locked: boolean; remainingTime?: number } {
  const attempts = loginAttempts.get(email);
  
  if (!attempts) {
    return { locked: false };
  }
  
  if (attempts.lockedUntil && attempts.lockedUntil > new Date()) {
    const remainingTime = Math.ceil((attempts.lockedUntil.getTime() - Date.now()) / 1000);
    return { locked: true, remainingTime };
  }
  
  return { locked: false };
}

function recordFailedLogin(email: string): void {
  const attempts = loginAttempts.get(email) || { count: 0, lastAttempt: new Date() };
  attempts.count++;
  attempts.lastAttempt = new Date();
  
  // Progressive lockout: 5 attempts = 5 min, 10 = 15 min, 15+ = 30 min
  if (attempts.count >= 15) {
    attempts.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
  } else if (attempts.count >= 10) {
    attempts.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  } else if (attempts.count >= 5) {
    attempts.lockedUntil = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  }
  
  loginAttempts.set(email, attempts);
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const clientInfo = getClientInfo(request);
  const requestId = crypto.randomUUID();
  
  try {
    // Parse and validate input
    const body = await request.json();
    const validation = loginSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid input format',
          requestId
        },
        { status: 400 }
      );
    }
    
    const { email, password, rememberMe, mfaToken } = validation.data;
    const sanitizedEmail = email.toLowerCase().trim();
    
    // Check account lockout
    const lockoutStatus = checkAccountLockout(sanitizedEmail);
    if (lockoutStatus.locked) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Account temporarily locked. Try again in ${lockoutStatus.remainingTime} seconds.`,
          accountLocked: true,
          retryAfter: lockoutStatus.remainingTime,
          requestId
        },
        { status: 403 }
      );
    }
    
    // Find user by email
    const user = await db.findUnique('user', {
      where: { email: sanitizedEmail }
    });

    if (!user) {
      recordFailedLogin(sanitizedEmail);
      
      // Constant time delay to prevent timing attacks
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 100));
      
      return NextResponse.json(
        { success: false, error: 'Invalid email or password', requestId },
        { status: 401 }
      );
    }

    // Check if user is active
    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: 'Account is deactivated', requestId },
        { status: 401 }
      );
    }

    // Verify password
    if (!user.password) {
      return NextResponse.json(
        { success: false, error: 'Password login not available for this account', requestId },
        { status: 401 }
      );
    }

    const isValidPassword = await compare(password, user.password);
    if (!isValidPassword) {
      recordFailedLogin(sanitizedEmail);
      
      // Log failed attempt
      await db.create('auditLog', {
        data: {
          userId: user.id,
          action: 'LOGIN_FAILED',
          resource: 'auth',
          metadata: {
            email: sanitizedEmail,
            reason: 'INVALID_PASSWORD',
            ipAddress: clientInfo.ipAddress,
            userAgent: clientInfo.userAgent,
            requestId
          }
        }
      }).catch(console.error);
      
      return NextResponse.json(
        { success: false, error: 'Invalid email or password', requestId },
        { status: 401 }
      );
    }
    
    // Clear login attempts on successful authentication
    loginAttempts.delete(sanitizedEmail);
    
    // Initialize JWT security
    await jwtSecurity.initialize();
    
    // Create enhanced session with race condition protection
    const session = await enhancedSessionManager.createSession(
      user.id,
      user.email,
      user.role,
      {
        fingerprint: clientInfo.deviceFingerprint,
        userAgent: clientInfo.userAgent,
        ipAddress: clientInfo.ipAddress,
        platform: clientInfo.platform,
        browser: clientInfo.browser
      },
      {
        loginMethod: 'password',
        mfaVerified: false,
        riskScore: 0,
        anomalyDetected: false
      },
      user.tenantId || undefined
    );
    
    // Generate secure tokens with anti-replay protection
    const accessToken = await jwtSecurity.generateAccessToken(
      user.id,
      user.email,
      user.role,
      session.id,
      {
        includePermissions: true,
        deviceFingerprint: clientInfo.deviceFingerprint,
        clientId: 'web-app',
        scope: 'full',
        authMethods: ['password']
      }
    );
    
    const refreshToken = await jwtSecurity.generateRefreshToken(
      user.id,
      session.id,
      clientInfo.deviceFingerprint
    );

    // Update last login
    await db.update('user', {
      where: { id: user.id },
      data: { 
        lastLogin: new Date(),
        lastLoginIp: clientInfo.ipAddress
      }
    });

    // Set httpOnly cookie with secure tokens
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      session: {
        id: session.id,
        expiresAt: session.expiresAt.toISOString()
      },
      requestId
    });

    // Set secure cookies
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/'
    };
    
    response.cookies.set('access-token', accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 // 15 minutes
    });
    
    response.cookies.set('refresh-token', refreshToken, {
      ...cookieOptions,
      maxAge: rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60, // 30 days or 7 days
      path: '/api/auth/refresh' // Restrict refresh token to refresh endpoint
    });
    
    response.cookies.set('session-id', session.id, {
      ...cookieOptions,
      maxAge: 24 * 60 * 60 // 24 hours
    });

    // Log successful login for audit
    await db.create('auditLog', {
      data: {
        userId: user.id,
        action: 'LOGIN_SUCCESS',
        resource: 'auth',
        metadata: {
          email: user.email,
          provider: 'local',
          sessionId: session.id,
          ipAddress: clientInfo.ipAddress,
          userAgent: clientInfo.userAgent,
          platform: clientInfo.platform,
          browser: clientInfo.browser,
          requestId,
          loginTime: Date.now() - startTime
        }
      }
    }).catch(console.error);
    
    // Add security headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    response.headers.set('X-Request-ID', requestId);

    return response;

  } catch (error) {
    console.error('Login error:', error);
    
    // Log error
    await db.create('auditLog', {
      data: {
        action: 'LOGIN_ERROR',
        resource: 'auth',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          ipAddress: clientInfo.ipAddress,
          userAgent: clientInfo.userAgent,
          requestId
        }
      }
    }).catch(console.error);

    return NextResponse.json(
      { success: false, error: 'An error occurred during login', requestId },
      { status: 500 }
    );
  }
}