import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generateTokens } from '@/lib/auth/jwt';
import { withCors, withRateLimit } from '@/lib/auth/middleware';
import { createSession } from '@/lib/auth/session';
import { UserRepository } from '@/lib/db/repositories/UserRepository';
import type { NextRequest } from 'next/server';

const userRepository = new UserRepository();

const registerSchema = z.object({
 email: z.string().email('Invalid email address'),
 password: z.string().min(8, 'Password must be at least 8 characters'),
 name: z.string().min(2, 'Name must be at least 2 characters'),
 username: z.string().min(3, 'Username must be at least 3 characters').optional(),
});

async function registerHandler(req: NextRequest): Promise<NextResponse> {
 try {
 if (req.method !== 'POST') {
 return NextResponse.json(
 { error: 'Method not allowed' },
 { status: 405 }
 );
 }

 const body = await req.json();
 const { email, password, name, username } = registerSchema.parse(body);

 // Check if user already exists
 const existingUser = await userRepository.findByEmail(email);
 if (existingUser) {
 return NextResponse.json(
 { error: 'Email already registered' },
 { status: 409 }
 );
 }

 // Check username availability if provided
 if (username) {
 const existingUsername = await userRepository.findByUsername(username);
 if (existingUsername) {
 return NextResponse.json(
 { error: 'Username already taken' },
 { status: 409 }
 );
 }
 }

 // Hash password
 const bcrypt = await import('bcryptjs');
 const saltRounds = parseInt(process.env.HASH_SALT_ROUNDS || '12');
 const hashedPassword = await bcrypt.hash(password, saltRounds);

 // Create user
 const user = await userRepository.create({
 email,
 name,
 username,
 password: hashedPassword,
 provider: 'local',
 providerId: email, // For local users, use email as provider ID
 role: 'DEVELOPER',
 });

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
 response.cookies.set('session', sessionId, {
 httpOnly: true,
 secure: process.env.NODE_ENV === 'production',
 sameSite: 'lax',
 maxAge: 30 * 24 * 60 * 60, // 30 days
 path: '/',
 });

 return response;
 } catch (error) {
 console.error('Registration error:', error);

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
export const POST = withCors()(withRateLimit(5, 60 * 60 * 1000)(registerHandler)); // 5 requests per hour