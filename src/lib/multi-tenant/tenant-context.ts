import { NextRequest } from 'next/server';
import { tenantManager, Tenant } from './tenant-manager';

export interface TenantContext {
  tenant: Tenant | null;
  user: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
  } | null;
  isOwner: boolean;
  hasPermission: (permission: string) => boolean;
  checkResourceLimit: (resource: string) => Promise<{ allowed: boolean; current: number; limit: number }>;
}

class TenantContextManager {
  private static instance: TenantContextManager;
  private contexts = new Map<string, TenantContext>();

  static getInstance(): TenantContextManager {
    if (!TenantContextManager.instance) {
      TenantContextManager.instance = new TenantContextManager();
    }
    return TenantContextManager.instance;
  }

  /**
   * Extract tenant information from request
   */
  async extractTenantFromRequest(request: NextRequest): Promise<{ tenant: Tenant | null; method: 'domain' | 'subdomain' | 'header' | 'none' }> {
    // Method 1: Check custom tenant header
    const tenantHeader = request.headers.get('x-tenant-id');
    if (tenantHeader) {
      const tenant = await tenantManager.getTenant(tenantHeader);
      return { tenant, method: 'header' };
    }

    // Method 2: Extract from domain/subdomain
    const host = request.headers.get('host');
    if (host) {
      const tenant = await tenantManager.getTenantByDomain(host);
      if (tenant) {
        const method = host.includes(tenant.subdomain) ? 'subdomain' : 'domain';
        return { tenant, method };
      }
    }

    // Method 3: Check URL path (for API routes)
    const url = new URL(request.url);
    const pathMatch = url.pathname.match(/^\/t\/([^\/]+)/);
    if (pathMatch) {
      const tenantSlug = pathMatch[1];
      // Find tenant by slug (you'd need to implement this in TenantManager)
      const tenant = null; // await tenantManager.getTenantBySlug(tenantSlug);
      return { tenant, method: 'none' };
    }

    return { tenant: null, method: 'none' };
  }

  /**
   * Create tenant context for request
   */
  async createContext(
    request: NextRequest,
    user?: { id: string; email: string }
  ): Promise<TenantContext> {
    const { tenant } = await this.extractTenantFromRequest(request);
    
    let userRole = null;
    let userPermissions: string[] = [];
    let isOwner = false;

    if (tenant && user) {
      userRole = await tenantManager.getUserRole(user.id, tenant.id);
      if (userRole) {
        // Get user permissions from tenant membership
        const tenantUsers = await tenantManager.getTenantUsers(tenant.id);
        const tenantUser = tenantUsers.find(tu => tu.userId === user.id);
        userPermissions = tenantUser?.permissions || [];
        isOwner = tenant.ownerId === user.id;
      }
    }

    const context: TenantContext = {
      tenant,
      user: user && userRole ? {
        ...user,
        role: userRole,
        permissions: userPermissions
      } : null,
      isOwner,
      hasPermission: (permission: string) => {
        if (!context.user) return false;
        if (context.isOwner) return true;
        return context.user.permissions.includes('*') || 
               context.user.permissions.includes(permission);
      },
      checkResourceLimit: async (resource: string) => {
        if (!tenant) return { allowed: false, current: 0, limit: 0 };
        return tenantManager.checkResourceLimit(tenant.id, resource as any);
      }
    };

    // Cache context for this request
    const contextId = this.generateContextId(request);
    this.contexts.set(contextId, context);
    
    // Auto-cleanup after 5 minutes
    setTimeout(() => {
      this.contexts.delete(contextId);
    }, 5 * 60 * 1000);

    return context;
  }

  /**
   * Get cached context for request
   */
  getContext(request: NextRequest): TenantContext | null {
    const contextId = this.generateContextId(request);
    return this.contexts.get(contextId) || null;
  }

  /**
   * Clear context for request
   */
  clearContext(request: NextRequest): void {
    const contextId = this.generateContextId(request);
    this.contexts.delete(contextId);
  }

  private generateContextId(request: NextRequest): string {
    // Generate unique ID for this request context
    const host = request.headers.get('host') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const timestamp = Date.now();
    return `${host}-${userAgent.substring(0, 10)}-${timestamp}`;
  }
}

export { TenantContextManager };
export const tenantContextManager = TenantContextManager.getInstance();

/**
 * Middleware helper to extract and validate tenant context
 */
export async function withTenantContext<T extends any[], R>(
  handler: (context: TenantContext, ...args: T) => Promise<R>
) {
  return async (request: NextRequest, ...args: T): Promise<R> => {
    // Extract user from session/token (implement based on your auth system)
    const user = await extractUserFromRequest(request);
    
    // Create tenant context
    const context = await tenantContextManager.createContext(request, user);
    
    try {
      return await handler(context, ...args);
    } finally {
      // Cleanup context
      tenantContextManager.clearContext(request);
    }
  };
}

/**
 * Require tenant context - throws error if no tenant
 */
export function requireTenant<T extends any[], R>(
  handler: (context: TenantContext & { tenant: Tenant }, ...args: T) => Promise<R>
) {
  return withTenantContext(async (context: TenantContext, ...args: T) => {
    if (!context.tenant) {
      throw new Error('Tenant context required');
    }
    
    return handler(context as TenantContext & { tenant: Tenant }, ...args);
  });
}

/**
 * Require authentication in tenant context
 */
export function requireAuth<T extends any[], R>(
  handler: (context: TenantContext & { user: NonNullable<TenantContext['user']> }, ...args: T) => Promise<R>
) {
  return withTenantContext(async (context: TenantContext, ...args: T) => {
    if (!context.user) {
      throw new Error('Authentication required');
    }
    
    return handler(context as TenantContext & { user: NonNullable<TenantContext['user']> }, ...args);
  });
}

/**
 * Require specific permission
 */
export function requirePermission<T extends any[], R>(
  permission: string,
  handler: (context: TenantContext & { user: NonNullable<TenantContext['user']> }, ...args: T) => Promise<R>
) {
  return requireAuth(async (context, ...args: T) => {
    if (!context.hasPermission(permission)) {
      throw new Error(`Permission required: ${permission}`);
    }
    
    return handler(context, ...args);
  });
}

/**
 * Check resource limits
 */
export function checkResourceLimit<T extends any[], R>(
  resource: string,
  handler: (context: TenantContext & { tenant: Tenant }, ...args: T) => Promise<R>
) {
  return requireTenant(async (context, ...args: T) => {
    const limit = await context.checkResourceLimit(resource);
    if (!limit.allowed) {
      throw new Error(`Resource limit exceeded: ${resource} (${limit.current}/${limit.limit})`);
    }
    
    return handler(context, ...args);
  });
}

/**
 * Database query helpers with tenant isolation
 */
export class TenantIsolatedQuery {
  constructor(private context: TenantContext) {}

  /**
   * Add tenant filter to query
   */
  private addTenantFilter(where: any = {}): any {
    if (!this.context.tenant) {
      throw new Error('Tenant context required for isolated queries');
    }

    return {
      ...where,
      tenantId: this.context.tenant.id
    };
  }

  /**
   * Create record with tenant ID
   */
  async create(model: string, data: any): Promise<any> {
    if (!this.context.tenant) {
      throw new Error('Tenant context required');
    }

    const tenantData = {
      ...data,
      tenantId: this.context.tenant.id,
      createdBy: this.context.user?.id
    };

    // In production, use actual Prisma client
    console.log(`Creating ${model} for tenant ${this.context.tenant.id}:`, tenantData);
    return { id: 'mock-id', ...tenantData };
  }

  /**
   * Find records with tenant isolation
   */
  async findMany(model: string, options: any = {}): Promise<any[]> {
    const where = this.addTenantFilter(options.where);
    
    console.log(`Finding ${model} records for tenant ${this.context.tenant?.id}:`, { ...options, where });
    return [];
  }

  /**
   * Find unique record with tenant isolation
   */
  async findUnique(model: string, options: any): Promise<any | null> {
    const where = this.addTenantFilter(options.where);
    
    console.log(`Finding unique ${model} for tenant ${this.context.tenant?.id}:`, { ...options, where });
    return null;
  }

  /**
   * Update records with tenant isolation
   */
  async update(model: string, options: any): Promise<any> {
    const where = this.addTenantFilter(options.where);
    const data = {
      ...options.data,
      updatedBy: this.context.user?.id,
      updatedAt: new Date()
    };
    
    console.log(`Updating ${model} for tenant ${this.context.tenant?.id}:`, { where, data });
    return { id: 'mock-id', ...data };
  }

  /**
   * Delete records with tenant isolation
   */
  async delete(model: string, options: any): Promise<any> {
    const where = this.addTenantFilter(options.where);
    
    console.log(`Deleting ${model} for tenant ${this.context.tenant?.id}:`, where);
    return { id: 'mock-id' };
  }

  /**
   * Count records with tenant isolation
   */
  async count(model: string, options: any = {}): Promise<number> {
    const where = this.addTenantFilter(options.where);
    
    console.log(`Counting ${model} for tenant ${this.context.tenant?.id}:`, where);
    return 0;
  }
}

/**
 * Create tenant-isolated database client
 */
export function createTenantDB(context: TenantContext): TenantIsolatedQuery {
  return new TenantIsolatedQuery(context);
}

/**
 * Extract user information from request
 * This should be implemented based on your authentication system
 */
async function extractUserFromRequest(request: NextRequest): Promise<{ id: string; email: string } | null> {
  // Implementation depends on your auth system
  // This could check JWT tokens, session cookies, etc.
  
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    // Mock user extraction - implement actual JWT/token validation
    return {
      id: 'user-123',
      email: 'user@example.com'
    };
  }

  // Check session cookie
  const sessionCookie = request.cookies.get('session');
  if (sessionCookie) {
    // Mock session validation
    return {
      id: 'user-456',
      email: 'session-user@example.com'
    };
  }

  return null;
}

/**
 * Tenant-aware audit logging
 */
export async function logTenantActivity(
  context: TenantContext,
  action: string,
  resource: string,
  resourceId?: string,
  metadata?: any
) {
  const auditData = {
    tenantId: context.tenant?.id,
    userId: context.user?.id,
    action,
    resource,
    resourceId,
    metadata: {
      ...metadata,
      userRole: context.user?.role,
      tenantName: context.tenant?.name
    },
    timestamp: new Date().toISOString()
  };

  // Log to audit system
  console.log('Tenant activity:', auditData);
  
  // In production, use actual audit service
  // await auditService.log(action, resource, resourceId, auditData);
}