/**
 * Tenant Context Middleware
 * Extracts and validates tenant context for all requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { tenantIsolation } from '@/lib/database/tenant-isolation';

export interface TenantRequestContext {
  tenantId: string;
  tenantSlug: string;
  userId?: string;
  userRole?: string;
  clientIP: string;
  userAgent: string;
  requestId: string;
}

/**
 * Extract tenant context from request
 */
export function extractTenantContext(request: NextRequest): TenantRequestContext | null {
  // Try multiple sources for tenant identification
  let tenantId: string | null = null;
  let tenantSlug: string | null = null;

  // 1. Check subdomain (e.g., acme.nextportal.com)
  const host = request.headers.get('host') || '';
  
  // Special handling for localhost development
  if (host.startsWith('localhost:')) {
    tenantSlug = host; // Use full host for localhost
  } else {
    const subdomain = host.split('.')[0];
    if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
      tenantSlug = subdomain;
    }
  }

  // 2. Check X-Tenant-ID header
  tenantId = request.headers.get('x-tenant-id');

  // 3. Check query parameter
  if (!tenantId) {
    tenantId = request.nextUrl.searchParams.get('tenant');
  }

  // 4. Check path prefix (e.g., /tenant/acme/dashboard)
  if (!tenantSlug && !tenantId) {
    const pathSegments = request.nextUrl.pathname.split('/');
    if (pathSegments[1] === 'tenant' && pathSegments[2]) {
      tenantSlug = pathSegments[2];
    }
  }

  // 5. Check JWT token for tenant claim
  if (!tenantId) {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      tenantId = extractTenantFromJWT(authHeader.substring(7));
    }
  }

  if (!tenantId && !tenantSlug) {
    return null;
  }

  // Generate request ID
  const requestId = generateRequestId();

  return {
    tenantId: tenantId || `tenant-${tenantSlug}`,
    tenantSlug: tenantSlug || 'unknown',
    clientIP: getClientIP(request),
    userAgent: request.headers.get('user-agent') || 'unknown',
    requestId
  };
}

/**
 * Tenant isolation middleware
 */
export async function tenantContextMiddleware(
  request: NextRequest,
  context: TenantRequestContext
): Promise<NextResponse | null> {
  try {
    // Set tenant context for the request
    tenantIsolation.setTenantContext(context.tenantId);

    // Add tenant context to request headers for downstream processing
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-tenant-id', context.tenantId);
    requestHeaders.set('x-tenant-slug', context.tenantSlug);
    requestHeaders.set('x-request-id', context.requestId);

    // Create response with tenant context
    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

    // Add tenant context to response headers
    response.headers.set('x-tenant-id', context.tenantId);
    response.headers.set('x-request-id', context.requestId);

    return response;

  } catch (error) {
    console.error('Tenant context middleware error:', error);
    
    // Return 403 Forbidden for tenant access issues
    return new NextResponse(
      JSON.stringify({ 
        error: 'Tenant access denied',
        message: error instanceof Error ? error.message : 'Unknown error',
        requestId: context.requestId
      }),
      { 
        status: 403, 
        headers: { 
          'content-type': 'application/json',
          'x-request-id': context.requestId
        } 
      }
    );
  }
}

/**
 * Validate tenant access for API routes
 */
export async function validateTenantAccess(
  tenantId: string,
  userId?: string,
  requiredPermissions: string[] = []
): Promise<boolean> {
  try {
    // Basic validation - tenant exists and is active
    // In production, this would check tenant status, subscription, etc.
    
    if (!tenantId || tenantId === 'undefined') {
      return false;
    }

    // Check if tenant is suspended or inactive
    if (await isTenantSuspended(tenantId)) {
      return false;
    }

    // Check user permissions if provided
    if (userId && requiredPermissions.length > 0) {
      return await validateUserPermissions(tenantId, userId, requiredPermissions);
    }

    return true;

  } catch (error) {
    console.error('Tenant access validation error:', error);
    return false;
  }
}

/**
 * Check if tenant is suspended
 */
async function isTenantSuspended(tenantId: string): Promise<boolean> {
  // Simulate check against tenant status
  // In production, this would query the database
  return false;
}

/**
 * Validate user permissions within tenant
 */
async function validateUserPermissions(
  tenantId: string,
  userId: string,
  permissions: string[]
): Promise<boolean> {
  // Simulate permission check
  // In production, this would check user roles and permissions
  return true;
}

/**
 * Extract tenant ID from JWT token
 */
function extractTenantFromJWT(token: string): string | null {
  try {
    // Simplified JWT parsing - in production use proper JWT library
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.tenant_id || payload.tenant || null;
  } catch (error) {
    return null;
  }
}

/**
 * Get client IP address
 */
function getClientIP(request: NextRequest): string {
  // Check various headers for real IP
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const clientIP = request.headers.get('x-client-ip');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  if (realIP) {
    return realIP;
  }

  if (clientIP) {
    return clientIP;
  }

  // Fallback to connection IP
  return request.ip || 'unknown';
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Tenant-aware API wrapper
 */
export function withTenantContext<T extends any[], R>(
  handler: (context: TenantRequestContext, ...args: T) => Promise<R>
) {
  return async (request: NextRequest, ...args: T): Promise<R> => {
    const context = extractTenantContext(request);
    
    if (!context) {
      throw new Error('No tenant context found in request');
    }

    // Validate tenant access
    const hasAccess = await validateTenantAccess(context.tenantId);
    if (!hasAccess) {
      throw new Error('Tenant access denied');
    }

    try {
      // Set tenant context
      tenantIsolation.setTenantContext(context.tenantId);
      
      // Execute handler with context
      return await handler(context, ...args);
      
    } finally {
      // Always clear context
      tenantIsolation.clearTenantContext();
    }
  };
}

/**
 * Database query wrapper with tenant context
 */
export async function executeWithTenantContext<T>(
  tenantId: string,
  operation: () => Promise<T>,
  metadata: {
    operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
    resourceType: string;
    resourceId?: string;
    userId?: string;
    clientIP?: string;
    userAgent?: string;
  }
): Promise<T> {
  try {
    tenantIsolation.setTenantContext(tenantId);
    
    // Execute operation through tenant isolation manager
    return await tenantIsolation.executeQuery(
      'CUSTOM_OPERATION', // Would be actual SQL in production
      [],
      metadata
    );
    
  } finally {
    tenantIsolation.clearTenantContext();
  }
}

/**
 * Multi-tenant cache key generator
 */
export function generateTenantCacheKey(
  tenantId: string,
  key: string,
  userId?: string
): string {
  const sanitizedTenantId = tenantId.replace(/[^a-zA-Z0-9-_]/g, '');
  const baseKey = `tenant:${sanitizedTenantId}:${key}`;
  
  if (userId) {
    const sanitizedUserId = userId.replace(/[^a-zA-Z0-9-_]/g, '');
    return `${baseKey}:user:${sanitizedUserId}`;
  }
  
  return baseKey;
}

/**
 * Tenant-aware error handler
 */
export function handleTenantError(
  error: Error,
  context: TenantRequestContext
): NextResponse {
  console.error(`Tenant error for ${context.tenantId}:`, error);

  // Determine error type and status code
  let statusCode = 500;
  let errorType = 'INTERNAL_ERROR';

  if (error.message.includes('Tenant not found')) {
    statusCode = 404;
    errorType = 'TENANT_NOT_FOUND';
  } else if (error.message.includes('access denied')) {
    statusCode = 403;
    errorType = 'ACCESS_DENIED';
  } else if (error.message.includes('data residency')) {
    statusCode = 451; // Unavailable For Legal Reasons
    errorType = 'DATA_RESIDENCY_VIOLATION';
  }

  return new NextResponse(
    JSON.stringify({
      error: errorType,
      message: error.message,
      tenantId: context.tenantId,
      requestId: context.requestId,
      timestamp: new Date().toISOString()
    }),
    {
      status: statusCode,
      headers: {
        'content-type': 'application/json',
        'x-tenant-id': context.tenantId,
        'x-request-id': context.requestId
      }
    }
  );
}