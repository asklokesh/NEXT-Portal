/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { NextResponse } from 'next/server';

import { withCors } from '@/lib/auth/middleware';
import { destroySession } from '@/lib/auth/session';

import type { NextRequest } from 'next/server';

async function logoutHandler(req: NextRequest): Promise<NextResponse> {
 try {
 if (req.method !== 'POST') {
 return NextResponse.json(
 { error: 'Method not allowed' },
 { status: 405 }
 );
 }

 // Get session ID from cookie
 const sessionId = req.cookies.get('session')?.value;
 
 if (sessionId) {
 // Destroy session in Redis
 await destroySession(sessionId);
 }

 // Prepare response
 const response = NextResponse.json({
 success: true,
 message: 'Logged out successfully',
 });

 // Clear session cookie
 response.cookies.set('session', '', {
 httpOnly: true,
 secure: process.env.NODE_ENV === 'production',
 sameSite: 'lax',
 maxAge: 0,
 path: '/',
 });

 return response;
 } catch (error) {
 console.error('Logout error:', error);

 return NextResponse.json(
 { error: 'Internal server error' },
 { status: 500 }
 );
 }
}

// Apply middleware
export const POST = withCors()(logoutHandler);