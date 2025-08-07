/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader, verifyApiKey } from './jwt';
import { getSession, updateSessionActivity } from './session';
import { authenticateWithBackstage, extractBackstageToken } from './backstage-auth';
import { prisma, sessionRedis } from '../db/client';
import { UserRepository } from '../db/repositories/UserRepository';
import { createAuditLog } from '../audit/service';

const userRepository = new UserRepository();

export interface AuthenticatedRequest extends NextRequest {
 user?: {
 id: string;
 email: string;
 name: string;
 role: string;
 avatar?: string;
 teams?: Array<{
 id: string;
 name: string;
 role: string;
 }>;
 permissions?: string[];
 };
}

/**
 * Authentication middleware for API routes
 */
export const withAuth = (handler: (req: AuthenticatedRequest) => Promise<NextResponse>) => {
 return async (req: NextRequest): Promise<NextResponse> => {
 const startTime = Date.now();
 const ipAddress = req.ip || req.headers.get('x-forwarded-for') || 'unknown';
 const userAgent = req.headers.get('user-agent') || 'unknown';
 const requestPath = req.nextUrl.pathname;
 const method = req.method;
 
 try {
 const authHeader = req.headers.get('authorization');
 const sessionCookie = req.cookies.get('session')?.value;
 const apiKeyHeader = req.headers.get('x-api-key');
 const backstageToken = extractBackstageToken(req);

 let user = null;
 let authMethod = 'none';

 // Try Backstage authentication first (highest priority)
 if (backstageToken) {
 const backstageAuth = await authenticateWithBackstage(req);
 if (backstageAuth.authenticated && backstageAuth.user) {
 // Sync or create user in local database
 user = await userRepository.findByEmail(backstageAuth.user.email) ||
 await userRepository.create({
 email: backstageAuth.user.email,
 name: backstageAuth.user.name,
 role: backstageAuth.user.role as any,
 provider: 'backstage',
 providerId: backstageAuth.user.id,
 isActive: true,
 });
 authMethod = 'backstage';
 }
 }

 // Try JWT token authentication
 if (!user && authHeader) {
 const token = extractTokenFromHeader(authHeader);
 if (token) {
 const payload = verifyToken(token);
 if (payload) {
 user = await userRepository.findById(payload.userId);
 authMethod = 'jwt';
 }
 }
 }

 // Try session-based authentication
 if (!user && sessionCookie) {
 const sessionData = await getSession(sessionCookie);
 if (sessionData) {
 user = await userRepository.findById(sessionData.userId);
 if (user) {
 // Update session activity
 await updateSessionActivity(sessionCookie);
 authMethod = 'session';
 }
 }
 }

 // Try API key authentication
 if (!user && apiKeyHeader) {
 // Find API key in database and verify (properly hashed)
 const apiKeyRecords = await prisma.apiKey.findMany({
 where: { isActive: true },
 include: { user: true },
 });

 for (const apiKeyRecord of apiKeyRecords) {
 if (apiKeyRecord.isActive) {
 if (!apiKeyRecord.expiresAt || apiKeyRecord.expiresAt > new Date()) {
 const isValid = await verifyApiKey(apiKeyHeader, apiKeyRecord.keyHash);
 if (isValid) {
 user = apiKeyRecord.user;
 authMethod = 'api_key';
 // Update last used timestamp
 await prisma.apiKey.update({
 where: { id: apiKeyRecord.id },
 data: { lastUsedAt: new Date() },
 });
 break;
 }
 }
 }
 }
 }

 // Check if user exists and is active
 if (!user || !user.isActive) {
 // Log failed authentication attempt
 await createAuditLog({
 action: 'auth.failed',
 resource: 'authentication',
 resourceId: null,
 userId: null,
 details: {
 method: authMethod,
 path: requestPath,
 reason: !user ? 'user_not_found' : 'user_inactive',
 ipAddress,
 userAgent,
 },
 status: 'failed',
 });

 return NextResponse.json(
 { error: 'Unauthorized', message: 'Authentication required' },
 { status: 401 }
 );
 }

 // Update last login timestamp
 await userRepository.updateLastLogin(user.id);

 // Log successful authentication
 await createAuditLog({
 action: 'auth.success',
 resource: 'authentication',
 resourceId: user.id,
 userId: user.id,
 details: {
 method: authMethod,
 path: requestPath,
 ipAddress,
 userAgent,
 duration: Date.now() - startTime,
 },
 status: 'success',
 });

 // Add user to request
 (req as AuthenticatedRequest).user = {
 id: user.id,
 email: user.email,
 name: user.name,
 role: user.role,
 avatar: user.avatar || undefined,
 teams: user.teamMemberships?.map(tm => ({
 id: tm.team.id,
 name: tm.team.name,
 role: tm.role,
 })) || [],
 };

 return handler(req as AuthenticatedRequest);
 } catch (error) {
 console.error('Authentication middleware error:', error);
 
 // Log authentication error
 await createAuditLog({
 action: 'auth.error',
 resource: 'authentication',
 resourceId: null,
 userId: null,
 details: {
 error: error instanceof Error ? error.message : 'Unknown error',
 path: requestPath,
 method,
 ipAddress,
 userAgent,
 duration: Date.now() - startTime,
 },
 status: 'error',
 });

 return NextResponse.json(
 { error: 'Internal Server Error', message: 'Authentication failed' },
 { status: 500 }
 );
 }
 };
};

/**
 * Role-based authorization middleware
 */
export const withRole = (roles: string[]) => {
 return (handler: (req: AuthenticatedRequest) => Promise<NextResponse>) => {
 return withAuth(async (req: AuthenticatedRequest) => {
 const user = req.user;
 
 if (!user || !roles.includes(user.role)) {
 return NextResponse.json(
 { error: 'Forbidden', message: 'Insufficient permissions' },
 { status: 403 }
 );
 }

 return handler(req);
 });
 };
};

/**
 * Permission-based authorization middleware
 */
export const withPermission = (resource: string, action: string) => {
 return (handler: (req: AuthenticatedRequest) => Promise<NextResponse>) => {
 return withAuth(async (req: AuthenticatedRequest) => {
 const user = req.user;
 
 if (!user) {
 return NextResponse.json(
 { error: 'Unauthorized', message: 'Authentication required' },
 { status: 401 }
 );
 }

 // Check if user has permission
 const hasPermission = await checkUserPermission(user.id, resource, action);
 
 if (!hasPermission) {
 return NextResponse.json(
 { error: 'Forbidden', message: `No permission to ${action} ${resource}` },
 { status: 403 }
 );
 }

 return handler(req);
 });
 };
};

/**
 * Check if user has specific permission
 */
const checkUserPermission = async (
 userId: string,
 resource: string,
 action: string
): Promise<boolean> => {
 try {
 // Get user with team memberships
 const user = await userRepository.findById(userId);
 if (!user) return false;

 // Admin users have all permissions
 if (user.role === 'ADMIN') return true;

 // Check team permissions
 for (const membership of user.teamMemberships) {
 const permission = await prisma.permission.findUnique({
 where: {
 teamId_resource_action: {
 teamId: membership.teamId,
 resource,
 action,
 },
 },
 });

 if (permission) {
 // Additional scope checks could go here
 return true;
 }
 }

 return false;
 } catch (error) {
 console.error('Permission check failed:', error);
 return false;
 }
};

/**
 * Rate limiting middleware
 */
export const withRateLimit = (
 maxRequests: number = 100,
 windowMs: number = 15 * 60 * 1000 // 15 minutes
) => {
 return (handler: (req: NextRequest) => Promise<NextResponse>) => {
 return async (req: NextRequest): Promise<NextResponse> => {
 try {
 const ip = req.ip || req.headers.get('x-forwarded-for') || 'unknown';
 const key = `rate_limit:${ip}`;
 
 const current = await sessionRedis.get(key);
 const currentCount = current ? parseInt(current) : 0;

 if (currentCount >= maxRequests) {
 return NextResponse.json(
 { 
 error: 'Too Many Requests', 
 message: 'Rate limit exceeded. Please try again later.',
 retryAfter: Math.ceil(windowMs / 1000)
 },
 { 
 status: 429,
 headers: {
 'Retry-After': Math.ceil(windowMs / 1000).toString(),
 'X-RateLimit-Limit': maxRequests.toString(),
 'X-RateLimit-Remaining': '0',
 'X-RateLimit-Reset': new Date(Date.now() + windowMs).toISOString(),
 }
 }
 );
 }

 // Increment counter
 if (currentCount === 0) {
 await sessionRedis.setex(key, Math.ceil(windowMs / 1000), '1');
 } else {
 await sessionRedis.incr(key);
 }

 const response = await handler(req);

 // Add rate limit headers
 response.headers.set('X-RateLimit-Limit', maxRequests.toString());
 response.headers.set('X-RateLimit-Remaining', (maxRequests - currentCount - 1).toString());
 response.headers.set('X-RateLimit-Reset', new Date(Date.now() + windowMs).toISOString());

 return response;
 } catch (error) {
 console.error('Rate limiting error:', error);
 return handler(req);
 }
 };
 };
};

/**
 * Legacy alias for withAuth - for backward compatibility
 * @deprecated Use withAuth instead
 */
export const requireAuth = withAuth;

/**
 * CORS middleware
 */
export const withCors = (
 origins: string[] = ['http://localhost:4400', 'http://localhost:4401']
) => {
 return (handler: (req: NextRequest) => Promise<NextResponse>) => {
 return async (req: NextRequest): Promise<NextResponse> => {
 const origin = req.headers.get('origin');
 
 // Handle preflight requests
 if (req.method === 'OPTIONS') {
 return new NextResponse(null, {
 status: 200,
 headers: {
 'Access-Control-Allow-Origin': origin && origins.includes(origin) ? origin : origins[0],
 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
 'Access-Control-Allow-Credentials': 'true',
 'Access-Control-Max-Age': '86400',
 },
 });
 }

 const response = await handler(req);

 // Add CORS headers
 if (origin && origins.includes(origin)) {
 response.headers.set('Access-Control-Allow-Origin', origin);
 } else {
 response.headers.set('Access-Control-Allow-Origin', origins[0]);
 }
 
 response.headers.set('Access-Control-Allow-Credentials', 'true');
 response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
 response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');

 return response;
 };
 };
};