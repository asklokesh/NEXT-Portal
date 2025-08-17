/**
 * Permission Check Middleware
 * Next.js middleware for API route protection
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
// Use Edge Runtime compatible version in middleware
import { checkPermission } from '@/lib/permissions/helpers-edge';
import { ResourceType, PermissionAction } from '@/lib/permissions/types';

// Route to permission mapping
const ROUTE_PERMISSIONS: Record<string, { resource: ResourceType; action: PermissionAction }> = {
  // Catalog routes
  'GET:/api/catalog': { resource: ResourceType.CATALOG, action: PermissionAction.READ },
  'POST:/api/catalog': { resource: ResourceType.CATALOG, action: PermissionAction.CREATE },
  'PUT:/api/catalog': { resource: ResourceType.CATALOG, action: PermissionAction.UPDATE },
  'DELETE:/api/catalog': { resource: ResourceType.CATALOG, action: PermissionAction.DELETE },
  
  // Entity routes (commenting out GET to allow public access for dashboard)
  // 'GET:/api/catalog/entities': { resource: ResourceType.ENTITY, action: PermissionAction.READ },
  'POST:/api/catalog/entities': { resource: ResourceType.ENTITY, action: PermissionAction.CREATE },
  'PUT:/api/catalog/entities': { resource: ResourceType.ENTITY, action: PermissionAction.UPDATE },
  'DELETE:/api/catalog/entities': { resource: ResourceType.ENTITY, action: PermissionAction.DELETE },
  // Backstage entities endpoint needs public access for dashboard
  // 'GET:/api/backstage/entities': { resource: ResourceType.ENTITY, action: PermissionAction.READ },
  'POST:/api/backstage/entities': { resource: ResourceType.ENTITY, action: PermissionAction.CREATE },
  'PUT:/api/backstage/entities': { resource: ResourceType.ENTITY, action: PermissionAction.UPDATE },
  'DELETE:/api/backstage/entities': { resource: ResourceType.ENTITY, action: PermissionAction.DELETE },
  
  // Template routes
  'GET:/api/templates': { resource: ResourceType.TEMPLATE, action: PermissionAction.READ },
  'POST:/api/templates': { resource: ResourceType.TEMPLATE, action: PermissionAction.CREATE },
  'POST:/api/templates/execute': { resource: ResourceType.TEMPLATE, action: PermissionAction.EXECUTE },
  
  // Plugin routes
  'GET:/api/plugins': { resource: ResourceType.PLUGIN, action: PermissionAction.READ },
  'POST:/api/plugins/install': { resource: ResourceType.PLUGIN, action: PermissionAction.CREATE },
  'DELETE:/api/plugins': { resource: ResourceType.PLUGIN, action: PermissionAction.DELETE },
  
  // Admin routes
  'GET:/api/admin': { resource: ResourceType.SETTINGS, action: PermissionAction.READ },
  'PUT:/api/admin': { resource: ResourceType.SETTINGS, action: PermissionAction.UPDATE },
  
  // Audit routes
  'GET:/api/audit-logs': { resource: ResourceType.AUDIT, action: PermissionAction.READ },
  'DELETE:/api/audit-logs': { resource: ResourceType.AUDIT, action: PermissionAction.DELETE },
  
  // Cost routes
  'GET:/api/costs': { resource: ResourceType.COST, action: PermissionAction.READ },
  'PUT:/api/costs/budgets': { resource: ResourceType.COST, action: PermissionAction.UPDATE },
  
  // Deployment routes
  'GET:/api/deployments': { resource: ResourceType.DEPLOYMENT, action: PermissionAction.READ },
  'POST:/api/deployments': { resource: ResourceType.DEPLOYMENT, action: PermissionAction.CREATE },
  
  // Monitoring routes
  'GET:/api/monitoring': { resource: ResourceType.MONITORING, action: PermissionAction.READ },
  
  // Integration routes
  'GET:/api/integrations': { resource: ResourceType.INTEGRATION, action: PermissionAction.READ },
  'POST:/api/integrations': { resource: ResourceType.INTEGRATION, action: PermissionAction.CREATE },
  'PUT:/api/integrations': { resource: ResourceType.INTEGRATION, action: PermissionAction.UPDATE },
  'DELETE:/api/integrations': { resource: ResourceType.INTEGRATION, action: PermissionAction.DELETE },
};

// Public routes that don't require permission checks
const PUBLIC_ROUTES = [
  '/api/auth',
  '/api/health',
  '/api/public',
  '/api/catalog/stats',
  '/api/catalog/entities',  // Allow public access to catalog entities for dashboard
  '/api/catalog/services',  // Allow public access to catalog services
  '/api/notifications',
  '/api/backstage/entities',
  '/api/backstage/version',  // Allow public access to version endpoint for plugin marketplace
  '/api/backstage/scaffolder',  // Allow public access to scaffolder templates for plugin marketplace
  '/api/backstage-plugins-real',  // Allow public access to real plugins endpoint for plugin marketplace
  '/api/plugins/marketplace',  // Allow public access to marketplace API that combines NPM + DB data
  '/api/plugins/install',        // Allow public access to plugin installation for testing
  '/api/plugins/install-simple', // Allow public access to simple plugin installation
  '/api/plugins/config',         // Allow public access to plugin configuration for testing
  '/api/plugins/toggle'          // Allow public access to plugin toggle for testing
];

/**
 * Permission check middleware
 */
export async function permissionCheckMiddleware(
  request: NextRequest
): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname;
  
  // Skip public routes
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return null;
  }

  // Get user token
  const token = await getToken({ req: request as any });
  
  if (!token || !token.sub) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Build permission key
  const method = request.method;
  const routeKey = `${method}:${pathname.split('?')[0]}`;
  
  // Find matching permission requirement
  let permissionReq = ROUTE_PERMISSIONS[routeKey];
  
  // Try to find wildcard match
  if (!permissionReq) {
    for (const [key, value] of Object.entries(ROUTE_PERMISSIONS)) {
      const [keyMethod, keyPath] = key.split(':');
      if (keyMethod === method && pathMatches(pathname, keyPath)) {
        permissionReq = value;
        break;
      }
    }
  }

  // If no permission requirement found, default to allowing (for now)
  if (!permissionReq) {
    console.warn(`No permission mapping for route: ${routeKey}`);
    return null;
  }

  // Check permission
  try {
    // Extract context with roles from token for Edge Runtime
    const context = extractContext(request);
    // Add roles from token to context for Edge Runtime permission checks
    if (token.roles) {
      context.roles = token.roles as string[];
    }
    
    const hasPermission = await checkPermission(
      token.sub,
      permissionReq.resource,
      permissionReq.action,
      extractResourceId(request),
      context
    );

    if (!hasPermission) {
      return NextResponse.json(
        { 
          error: 'Forbidden',
          details: `Permission denied: ${permissionReq.action} on ${permissionReq.resource}`
        },
        { status: 403 }
      );
    }
  } catch (error) {
    console.error('Permission check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }

  return null;
}

/**
 * Check if path matches pattern
 */
function pathMatches(path: string, pattern: string): boolean {
  // Simple pattern matching (can be enhanced)
  if (pattern.includes('[')) {
    // Dynamic route pattern
    const regex = pattern
      .replace(/\[([^\]]+)\]/g, '([^/]+)')
      .replace(/\//g, '\\/');
    return new RegExp(`^${regex}$`).test(path);
  }
  return path === pattern;
}

/**
 * Extract resource ID from request
 */
function extractResourceId(request: NextRequest): string | undefined {
  // Extract from path params or query
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  
  // Check for ID in path (e.g., /api/entities/123)
  if (pathParts.length > 3) {
    return pathParts[pathParts.length - 1];
  }
  
  // Check query params
  return url.searchParams.get('id') || undefined;
}

/**
 * Extract permission context from request
 */
function extractContext(request: NextRequest): any {
  const url = new URL(request.url);
  const headers = request.headers;
  
  return {
    organizationId: headers.get('x-organization-id'),
    teamId: headers.get('x-team-id'),
    projectId: headers.get('x-project-id'),
    requestMetadata: {
      ipAddress: headers.get('x-forwarded-for') || headers.get('x-real-ip'),
      userAgent: headers.get('user-agent'),
      hour: new Date().getHours(),
      timestamp: new Date().toISOString()
    }
  };
}