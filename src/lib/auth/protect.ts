import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from './jwt';
import { getSession } from './session';
import { UserRepository } from '@/lib/db/repositories/UserRepository';

const userRepository = new UserRepository();

export interface AuthenticatedRequest extends NextRequest {
 user?: {
 id: string;
 email: string;
 name: string;
 role: string;
 username?: string | null;
 avatar?: string | null;
 };
}

/**
 * Middleware to protect routes requiring authentication
 */
export async function withAuth(
 handler: (req: AuthenticatedRequest) => Promise<NextResponse>
) {
 return async (req: NextRequest): Promise<NextResponse> => {
 try {
 // Check session cookie first
 const sessionId = req.cookies.get('session')?.value;
 if (sessionId) {
 const sessionData = await getSession(sessionId);
 if (sessionData) {
 // Fetch fresh user data
 const user = await userRepository.findById(sessionData.userId);
 if (user && user.isActive) {
 (req as AuthenticatedRequest).user = {
 id: user.id,
 email: user.email,
 name: user.name,
 role: user.role,
 username: user.username,
 avatar: user.avatar,
 };
 return handler(req as AuthenticatedRequest);
 }
 }
 }

 // Check JWT token in Authorization header
 const authHeader = req.headers.get('authorization');
 const token = extractTokenFromHeader(authHeader);
 
 if (token) {
 const payload = verifyToken(token);
 if (payload) {
 // Fetch fresh user data
 const user = await userRepository.findById(payload.userId);
 if (user && user.isActive) {
 (req as AuthenticatedRequest).user = {
 id: user.id,
 email: user.email,
 name: user.name,
 role: user.role,
 username: user.username,
 avatar: user.avatar,
 };
 return handler(req as AuthenticatedRequest);
 }
 }
 }

 // No valid authentication found
 return NextResponse.json(
 { error: 'Authentication required' },
 { status: 401 }
 );
 } catch (error) {
 console.error('Authentication error:', error);
 return NextResponse.json(
 { error: 'Authentication failed' },
 { status: 401 }
 );
 }
 };
}

/**
 * Middleware to check if user has required role
 */
export function withRole(requiredRole: string | string[]) {
 return (handler: (req: AuthenticatedRequest) => Promise<NextResponse>) => {
 return withAuth(async (req: AuthenticatedRequest) => {
 const userRole = req.user?.role;
 if (!userRole) {
 return NextResponse.json(
 { error: 'Role not found' },
 { status: 403 }
 );
 }

 const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
 
 // Check role hierarchy
 const roleHierarchy: Record<string, number> = {
 ADMIN: 4,
 PLATFORM_ENGINEER: 3,
 DEVELOPER: 2,
 VIEWER: 1,
 };

 const userRoleLevel = roleHierarchy[userRole] || 0;
 const hasPermission = allowedRoles.some(role => {
 const requiredLevel = roleHierarchy[role] || 0;
 return userRoleLevel >= requiredLevel;
 });

 if (!hasPermission) {
 return NextResponse.json(
 { error: 'Insufficient permissions' },
 { status: 403 }
 );
 }

 return handler(req);
 });
 };
}

/**
 * Get current user from request (for API routes)
 */
export async function getCurrentUser(req: NextRequest): Promise<{
 id: string;
 email: string;
 name: string;
 role: string;
 username?: string | null;
 avatar?: string | null;
} | null> {
 try {
 // Check session cookie first
 const sessionId = req.cookies.get('session')?.value;
 if (sessionId) {
 const sessionData = await getSession(sessionId);
 if (sessionData) {
 const user = await userRepository.findById(sessionData.userId);
 if (user && user.isActive) {
 return {
 id: user.id,
 email: user.email,
 name: user.name,
 role: user.role,
 username: user.username,
 avatar: user.avatar,
 };
 }
 }
 }

 // Check JWT token
 const authHeader = req.headers.get('authorization');
 const token = extractTokenFromHeader(authHeader);
 
 if (token) {
 const payload = verifyToken(token);
 if (payload) {
 const user = await userRepository.findById(payload.userId);
 if (user && user.isActive) {
 return {
 id: user.id,
 email: user.email,
 name: user.name,
 role: user.role,
 username: user.username,
 avatar: user.avatar,
 };
 }
 }
 }

 return null;
 } catch (error) {
 console.error('Failed to get current user:', error);
 return null;
 }
}