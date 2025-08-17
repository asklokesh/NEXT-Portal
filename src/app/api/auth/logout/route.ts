/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { NextResponse } from 'next/server';

import { withCors } from '@/lib/auth/middleware';
import { destroySession, getSession } from '@/lib/auth/session';
import { createAuditLog } from '@/lib/audit/service';

import type { NextRequest } from 'next/server';

async function logoutHandler(req: NextRequest): Promise<NextResponse> {
 const startTime = Date.now();
 const ipAddress = req.ip || req.headers.get('x-forwarded-for') || 'unknown';
 const userAgent = req.headers.get('user-agent') || 'unknown';
 
 try {
   // Support both POST and GET for logout
   if (!['POST', 'GET'].includes(req.method || '')) {
     return NextResponse.json(
       { error: 'Method not allowed' },
       { status: 405 }
     );
   }

   // Get session ID from cookie
   const sessionId = req.cookies.get('session')?.value;
   let userId: string | null = null;
   let userEmail: string | undefined;
   
   if (sessionId) {
     // Get session data for audit logging
     const sessionData = await getSession(sessionId);
     if (sessionData) {
       userId = sessionData.userId;
       userEmail = sessionData.email;
     }
     
     // Destroy session in Redis
     await destroySession(sessionId);
   }

   // Log successful logout
   await createAuditLog({
     action: 'auth.logout',
     resource: 'authentication',
     resourceId: userId,
     userId,
     details: {
       sessionId: sessionId ? 'present' : 'none',
       userEmail,
       ipAddress,
       userAgent,
       duration: Date.now() - startTime,
       method: req.method
     },
     status: 'success'
   });

   // Prepare response with security headers
   const response = NextResponse.json({
     success: true,
     message: 'Logged out successfully',
   });

   // Clear session cookie securely
   response.cookies.set('session', '', {
     httpOnly: true,
     secure: process.env.NODE_ENV === 'production',
     sameSite: 'lax',
     maxAge: 0,
     path: '/',
     domain: process.env.NODE_ENV === 'production' ? 
       new URL(process.env.NEXT_PUBLIC_APP_URL || '').hostname : undefined,
   });

   // Add security headers
   response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
   response.headers.set('Pragma', 'no-cache');
   response.headers.set('Expires', '0');

   return response;
 } catch (error) {
   console.error('Logout error:', error);

   // Log logout error
   await createAuditLog({
     action: 'auth.logout_error',
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

   return NextResponse.json(
     { error: 'Internal server error' },
     { status: 500 }
   );
 }
}

// Apply middleware
export const POST = withCors()(logoutHandler);
export const GET = withCors()(logoutHandler);