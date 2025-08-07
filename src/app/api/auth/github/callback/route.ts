/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { generateTokens } from '@/lib/auth/jwt';
import { withCors } from '@/lib/auth/middleware';
import { createSession } from '@/lib/auth/session';
import { UserRepository } from '@/lib/db/repositories/UserRepository';

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
 code: z.string(),
 state: z.string().optional(),
});

async function githubCallbackHandler(req: NextRequest): Promise<NextResponse> {
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

 if (!code) {
 return NextResponse.json(
 { error: 'Authorization code is required' },
 { status: 400 }
 );
 }

 const { code: validatedCode } = callbackSchema.parse({ code, state });

 // Exchange code for access token
 const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
 method: 'POST',
 headers: {
 'Accept': 'application/json',
 'Content-Type': 'application/json',
 },
 body: JSON.stringify({
 client_id: process.env.GITHUB_CLIENT_ID,
 client_secret: process.env.GITHUB_CLIENT_SECRET,
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

 // Get user info from GitHub
 const userResponse = await fetch('https://api.github.com/user', {
 headers: {
 'Authorization': `Bearer ${accessToken}`,
 'Accept': 'application/json',
 },
 });

 if (!userResponse.ok) {
 throw new Error('Failed to fetch user info from GitHub');
 }

 const githubUser: GitHubUser = await userResponse.json();

 // Get user's primary email if not public
 let email = githubUser.email;
 if (!email) {
 const emailResponse = await fetch('https://api.github.com/user/emails', {
 headers: {
 'Authorization': `Bearer ${accessToken}`,
 'Accept': 'application/json',
 },
 });

 if (emailResponse.ok) {
 const emails = await emailResponse.json();
 const primaryEmail = emails.find((e: any) => e.primary && e.verified);
 email = primaryEmail?.email || emails[0]?.email;
 }
 }

 if (!email) {
 return NextResponse.json(
 { error: 'Unable to retrieve email from GitHub' },
 { status: 400 }
 );
 }

 // Find or create user
 let user = await userRepository.findByProvider('github', githubUser.id.toString());
 
 if (!user) {
 // Check if user exists with the same email
 user = await userRepository.findByEmail(email);
 
 if (user) {
 // Link GitHub account to existing user
 user = await userRepository.update(user.id, {
 provider: 'github',
 providerId: githubUser.id.toString(),
 avatar: githubUser.avatar_url,
 });
 } else {
 // Create new user
 user = await userRepository.create({
 email,
 name: githubUser.name || githubUser.login,
 username: githubUser.login,
 avatar: githubUser.avatar_url,
 provider: 'github',
 providerId: githubUser.id.toString(),
 role: 'DEVELOPER',
 });
 }
 } else {
 // Update existing user info
 user = await userRepository.update(user.id, {
 name: githubUser.name || githubUser.login,
 username: githubUser.login,
 avatar: githubUser.avatar_url,
 lastLogin: new Date(),
 });
 }

 if (!user.isActive) {
 return NextResponse.json(
 { error: 'Account is deactivated' },
 { status: 403 }
 );
 }

 // Generate tokens
 const tokens = generateTokens(user);

 // Create session
 const sessionId = await createSession(user, {
 ipAddress: req.ip || req.headers.get('x-forwarded-for') || undefined,
 userAgent: req.headers.get('user-agent') || undefined,
 });

 // Redirect to success page with tokens
 const redirectUrl = new URL('/auth/success', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4400');
 redirectUrl.searchParams.set('token', tokens.accessToken);
 
 const response = NextResponse.redirect(redirectUrl);

 // Set session cookie
 response.cookies.set('session', sessionId, {
 httpOnly: true,
 secure: process.env.NODE_ENV === 'production',
 sameSite: 'lax',
 maxAge: 7 * 24 * 60 * 60, // 7 days
 path: '/',
 });

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