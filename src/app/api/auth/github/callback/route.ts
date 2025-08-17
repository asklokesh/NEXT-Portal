/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { generateTokens } from '@/lib/auth/jwt';
import { withCors } from '@/lib/auth/middleware';
import { createSession } from '@/lib/auth/session';
import { UserRepository } from '@/lib/db/repositories/UserRepository';
import { sessionRedis } from '@/lib/db/client';
import { createAuditLog } from '@/lib/audit/service';

import type { NextRequest } from 'next/server';

const userRepository = new UserRepository();

interface GitHubUser {
 id: number;
 login: string;
 name: string;
 email: string;
 avatar_url: string;
}

const callbackSchema = z.object({
 code: z.string().min(1, 'Authorization code is required'),
 state: z.string().min(1, 'State parameter is required'),
 error: z.string().optional(),
 error_description: z.string().optional(),
});

// Enhanced state validation
const validateOAuthState = async (stateToken: string): Promise<{ returnTo: string; timestamp: number } | null> => {
  try {
    const stateData = await sessionRedis.get(`oauth_state:${stateToken}`);
    if (!stateData) {
      return null;
    }

    const parsed = JSON.parse(stateData);
    
    // Validate timestamp (state should not be older than 10 minutes)
    const now = Date.now();
    if (now - parsed.timestamp > 600000) { // 10 minutes
      await sessionRedis.del(`oauth_state:${stateToken}`);
      return null;
    }

    // Clean up used state
    await sessionRedis.del(`oauth_state:${stateToken}`);
    
    return parsed;
  } catch (error) {
    console.error('State validation error:', error);
    return null;
  }
};

async function githubCallbackHandler(req: NextRequest): Promise<NextResponse> {
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

 // Handle OAuth errors from GitHub
 if (error) {
   await createAuditLog({
     action: 'oauth.github.error',
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
   errorUrl.searchParams.set('message', errorDescription || 'OAuth authentication failed');
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

 // Validate OAuth configuration before token exchange
 const githubClientId = process.env.GITHUB_CLIENT_ID;
 const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;

 if (!githubClientId || !githubClientSecret) {
   throw new Error('GitHub OAuth credentials not configured');
 }

 // Exchange code for access token
 const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
 method: 'POST',
 headers: {
 'Accept': 'application/json',
 'Content-Type': 'application/json',
 },
 body: JSON.stringify({
 client_id: githubClientId,
 client_secret: githubClientSecret,
 code: validatedCode,
 }),
 });

 if (!tokenResponse.ok) {
 throw new Error('Failed to exchange code for token');
 }

 const tokenData = await tokenResponse.json();
 
 if (tokenData.error) {
 throw new Error(tokenData.error_description || tokenData.error);
 }

 const accessToken = tokenData.access_token;

 // Fetch user info from GitHub with enhanced data
 const [userResponse, emailResponse, orgsResponse] = await Promise.all([
   fetch('https://api.github.com/user', {
     headers: {
       'Authorization': `Bearer ${accessToken}`,
       'Accept': 'application/vnd.github.v3+json',
       'User-Agent': 'IDP-Platform/1.0'
     },
   }),
   fetch('https://api.github.com/user/emails', {
     headers: {
       'Authorization': `Bearer ${accessToken}`,
       'Accept': 'application/vnd.github.v3+json',
       'User-Agent': 'IDP-Platform/1.0'
     },
   }),
   fetch('https://api.github.com/user/orgs', {
     headers: {
       'Authorization': `Bearer ${accessToken}`,
       'Accept': 'application/vnd.github.v3+json',
       'User-Agent': 'IDP-Platform/1.0'
     },
   })
 ]);

 if (!userResponse.ok) {
   const errorText = await userResponse.text();
   throw new Error(`Failed to fetch user info from GitHub: ${userResponse.status} ${errorText}`);
 }

 const githubUser: GitHubUser = await userResponse.json();

 // Get verified email address
 let email = githubUser.email;
 if (!email && emailResponse.ok) {
   const emails = await emailResponse.json();
   const primaryEmail = emails.find((e: any) => e.primary && e.verified);
   email = primaryEmail?.email || emails.find((e: any) => e.verified)?.email;
 }

 if (!email) {
   await createAuditLog({
     action: 'oauth.github.no_email',
     resource: 'authentication',
     resourceId: null,
     userId: null,
     details: {
       githubLogin: githubUser.login,
       githubId: githubUser.id.toString(),
       ipAddress,
       userAgent
     },
     status: 'failed'
   });
   
   return NextResponse.json(
     { error: 'Unable to retrieve verified email from GitHub. Please ensure your GitHub email is verified.' },
     { status: 400 }
   );
 }

 // Get organization memberships for role determination
 let organizationMemberships: string[] = [];
 if (orgsResponse.ok) {
   const orgs = await orgsResponse.json();
   organizationMemberships = orgs.map((org: any) => org.login);
 }

 // Enhanced admin user checking with organization support
 const adminUsers = (process.env.GITHUB_ADMIN_USERS || '').split(',').map(u => u.trim()).filter(Boolean);
 const adminOrgs = (process.env.GITHUB_ADMIN_ORGS || '').split(',').map(o => o.trim()).filter(Boolean);
 
 const isAdmin = adminUsers.includes(githubUser.login) || 
   adminOrgs.some(org => organizationMemberships.includes(org));

 // Determine user role based on organization membership
 let userRole: 'ADMIN' | 'PLATFORM_ENGINEER' | 'DEVELOPER' = 'DEVELOPER';
 if (isAdmin) {
   userRole = 'ADMIN';
 } else if (organizationMemberships.length > 0) {
   // Users in organizations get platform engineer role by default
   userRole = 'PLATFORM_ENGINEER';
 }

 // Find or create user with enhanced security checks
 let user = await userRepository.findByProvider('github', githubUser.id.toString());
 const now = new Date();
 let isNewUser = false;
 
 if (!user) {
   // Check if user exists with the same email
   user = await userRepository.findByEmail(email);
   
   if (user) {
     // Link GitHub account to existing user - requires account linking approval
     if (user.provider !== 'local') {
       await createAuditLog({
         action: 'oauth.github.account_conflict',
         resource: 'authentication',
         resourceId: user.id,
         userId: user.id,
         details: {
           existingProvider: user.provider,
           githubLogin: githubUser.login,
           githubId: githubUser.id.toString(),
           email,
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
     
     // Link GitHub to local account
     user = await userRepository.update(user.id, {
       provider: 'github',
       providerId: githubUser.id.toString(),
       avatar: githubUser.avatar_url,
       lastLogin: now,
       role: userRole, // Update role based on GitHub org membership
     });
     
     await createAuditLog({
       action: 'oauth.github.account_linked',
       resource: 'user',
       resourceId: user.id,
       userId: user.id,
       details: {
         githubLogin: githubUser.login,
         githubId: githubUser.id.toString(),
         email,
         ipAddress,
         userAgent
       },
       status: 'success'
     });
   } else {
     // Create new user
     isNewUser = true;
     user = await userRepository.create({
       email,
       name: githubUser.name || githubUser.login,
       username: githubUser.login,
       avatar: githubUser.avatar_url,
       provider: 'github',
       providerId: githubUser.id.toString(),
       role: userRole,
       isActive: true,
       lastLogin: now,
     });
     
     await createAuditLog({
       action: 'oauth.github.user_created',
       resource: 'user',
       resourceId: user.id,
       userId: user.id,
       details: {
         githubLogin: githubUser.login,
         githubId: githubUser.id.toString(),
         email,
         role: userRole,
         organizationMemberships,
         ipAddress,
         userAgent
       },
       status: 'success'
     });
   }
 } else {
   // Update existing user info and role
   user = await userRepository.update(user.id, {
     name: githubUser.name || githubUser.login,
     username: githubUser.login,
     avatar: githubUser.avatar_url,
     role: userRole, // Update role in case org membership changed
     lastLogin: now,
   });
 }

 // Security check: Verify user account is active
 if (!user.isActive) {
   await createAuditLog({
     action: 'oauth.github.inactive_account',
     resource: 'user',
     resourceId: user.id,
     userId: user.id,
     details: {
       githubLogin: githubUser.login,
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
   action: 'oauth.github.success',
   resource: 'authentication',
   resourceId: user.id,
   userId: user.id,
   details: {
     githubLogin: githubUser.login,
     email: user.email,
     role: user.role,
     isNewUser,
     organizationMemberships,
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
 }
 
 const response = NextResponse.redirect(redirectUrl);

 // Set secure session cookie with enhanced security
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
 console.error('GitHub OAuth callback error:', error);

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
 errorUrl.searchParams.set('error', error instanceof Error ? error.message : 'Authentication failed');
 
 return NextResponse.redirect(errorUrl);
 }
}

// Apply middleware
export const GET = withCors()(githubCallbackHandler);
export const POST = withCors()(githubCallbackHandler);