/**
 * Edge Runtime Compatible Permission Check Middleware
 * Next.js middleware for API route protection without Node.js dependencies
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Simplified permission types for Edge Runtime
enum ResourceType {
  CATALOG = 'catalog',
  ENTITY = 'entity',
  TEMPLATE = 'template',
  PLUGIN = 'plugin',
  SETTINGS = 'settings',
  AUDIT = 'audit',
  COST = 'cost',
  DEPLOYMENT = 'deployment',
  MONITORING = 'monitoring',
  INTEGRATION = 'integration'
}

enum PermissionAction {
  READ = 'read',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  EXECUTE = 'execute'
}

// Route to permission mapping
const ROUTE_PERMISSIONS: Record<string, { resource: ResourceType; action: PermissionAction }> = {
  // Catalog routes
  'GET:/api/catalog': { resource: ResourceType.CATALOG, action: PermissionAction.READ },
  'POST:/api/catalog': { resource: ResourceType.CATALOG, action: PermissionAction.CREATE },
  'PUT:/api/catalog': { resource: ResourceType.CATALOG, action: PermissionAction.UPDATE },
  'DELETE:/api/catalog': { resource: ResourceType.CATALOG, action: PermissionAction.DELETE },
  
  // Entity routes (commenting out GET to allow public access for dashboard)
  'POST:/api/catalog/entities': { resource: ResourceType.ENTITY, action: PermissionAction.CREATE },
  'PUT:/api/catalog/entities': { resource: ResourceType.ENTITY, action: PermissionAction.UPDATE },
  'DELETE:/api/catalog/entities': { resource: ResourceType.ENTITY, action: PermissionAction.DELETE },
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
  '/api/system',          // Allow public access to system health and status endpoints
  '/api/public',
  '/api/setup',          // Allow public access to setup endpoints for initial configuration
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
  '/api/plugins/toggle',         // Allow public access to plugin toggle for testing
  '/api/plugin-installer',      // Allow public access to plugin installer for management dashboard
  '/api/soundcheck',            // Allow public access to Soundcheck Premium features for testing
  '/api/aika',                  // Allow public access to AiKA AI Assistant Premium features for testing
  '/api/skill-exchange',        // Allow public access to Skill Exchange Premium features for testing
  '/api/plugin-monitor',         // Allow public access to plugin monitor for management dashboard
  '/api/plugin-actions',         // Allow public access to plugin actions for management dashboard
  '/api/plugin-version-check',   // Allow public access to plugin version checks
  '/api/plugins/compatibility-check', // Allow public access to plugin compatibility checks
  '/api/plugins/canary-deployment',   // Allow public access to canary deployment management
  '/api/monitoring/slo',              // Allow public access to SLO monitoring dashboard
  '/api/config/visual',               // Allow public access to visual configuration management
  '/api/config',                     // Allow public access to all config endpoints
  '/api/onboarding/wizards',         // Allow public access to setup wizards
  '/api/onboarding'                  // Allow public access to onboarding APIs
];

/**
 * Simplified permission check for Edge Runtime
 */
async function checkPermissionSimple(
  userId: string,
  resource: ResourceType,
  action: PermissionAction,
  resourceId?: string,
  context?: any
): Promise<boolean> {
  // In Edge Runtime, we use simplified permission logic
  // For development/demo purposes, allow most operations
  if (process.env.NODE_ENV === 'development') {
    return true;
  }
  
  // In production, you would implement your permission logic here
  // For now, we'll use a simplified approach based on user roles from the token
  const userRoles = context?.roles || [];
  
  // Admin users have all permissions
  if (userRoles.includes('admin') || userRoles.includes('super_admin')) {
    return true;
  }
  
  // Basic role-based permissions
  switch (resource) {
    case ResourceType.SETTINGS:
    case ResourceType.AUDIT:
      return userRoles.includes('admin');
      
    case ResourceType.PLUGIN:
    case ResourceType.DEPLOYMENT:
      return userRoles.includes('admin') || userRoles.includes('developer');
      
    case ResourceType.CATALOG:
    case ResourceType.ENTITY:
    case ResourceType.TEMPLATE:
      if (action === PermissionAction.READ) {
        return true; // Allow read access to everyone
      }
      return userRoles.includes('admin') || userRoles.includes('developer');
      
    default:
      return userRoles.includes('admin') || userRoles.includes('developer');
  }
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

/**
 * Edge Runtime compatible permission check middleware
 */
export async function permissionCheckMiddleware(
  request: NextRequest
): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname;
  
  // Skip public routes
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return null;
  }

  try {
    // Get user token using next-auth (Edge Runtime compatible)
    const token = await getToken({ 
      req: request as any,
      secret: process.env.NEXTAUTH_SECRET 
    });
    
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

    // Check permission using simplified logic
    const context = extractContext(request);
    // Add roles from token to context
    if (token.roles) {
      context.roles = token.roles as string[];
    }
    
    const hasPermission = await checkPermissionSimple(
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

export {
  ResourceType,
  PermissionAction,
  PUBLIC_ROUTES,
  ROUTE_PERMISSIONS
};