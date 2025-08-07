/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { generateTokens } from '@/lib/auth/jwt';
import { withCors, withRateLimit } from '@/lib/auth/middleware';
import { createSession } from '@/lib/auth/session';
import { UserRepository } from '@/lib/db/repositories/UserRepository';

import type { NextRequest } from 'next/server';

const userRepository = new UserRepository();

const loginSchema = z.object({
 email: z.string().email('Invalid email address'),
 password: z.string().min(1, 'Password is required'),
 rememberMe: z.boolean().optional().default(false),
});

async function loginHandler(req: NextRequest): Promise<NextResponse> {
 try {
 if (req.method !== 'POST') {
 return NextResponse.json(
 { error: 'Method not allowed' },
 { status: 405 }
 );
 }

 const body = await req.json();
 const { email, password, rememberMe } = loginSchema.parse(body);

 // Find user by email
 const user = await userRepository.findByEmail(email);
 if (!user || !user.isActive) {
 return NextResponse.json(
 { error: 'Invalid credentials' },
 { status: 401 }
 );
 }

 // For OAuth users, password authentication is not allowed
 if (user.provider !== 'local') {
 return NextResponse.json(
 { error: 'Please use OAuth login for this account' },
 { status: 400 }
 );
 }

 // Verify password for local users
 if (!user.password) {
 return NextResponse.json(
 { error: 'Invalid account configuration' },
 { status: 500 }
 );
 }

 const bcrypt = await import('bcryptjs');
 const isPasswordValid = await bcrypt.compare(password, user.password);
 if (!isPasswordValid) {
 return NextResponse.json(
 { error: 'Invalid credentials' },
 { status: 401 }
 );
 }

 // Update last login
 await userRepository.updateLastLogin(user.id);

 // Generate tokens
 const tokens = generateTokens(user);

 // Create session
 const sessionId = await createSession(user, {
 ipAddress: req.ip || req.headers.get('x-forwarded-for') || undefined,
 userAgent: req.headers.get('user-agent') || undefined,
 });

 // Prepare response
 const response = NextResponse.json({
 success: true,
 user: {
 id: user.id,
 email: user.email,
 name: user.name,
 username: user.username,
 avatar: user.avatar,
 role: user.role,
 },
 tokens,
 });

 // Set session cookie
 const maxAge = rememberMe ? 30 * 24 * 60 * 60 : undefined; // 30 days or session
 response.cookies.set('session', sessionId, {
 httpOnly: true,
 secure: process.env.NODE_ENV === 'production',
 sameSite: 'lax',
 maxAge,
 path: '/',
 });

 return response;
 } catch (error) {
 console.error('Login error:', error);

 if (error instanceof z.ZodError) {
 return NextResponse.json(
 { 
 error: 'Validation failed',
 details: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
 },
 { status: 400 }
 );
 }

 return NextResponse.json(
 { error: 'Internal server error' },
 { status: 500 }
 );
 }
}

// Apply middleware
export const POST = withCors()(withRateLimit(10, 15 * 60 * 1000)(loginHandler));