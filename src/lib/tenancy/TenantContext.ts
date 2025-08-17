/**
 * Tenant Context Management and Middleware
 * Request-level tenant identification and context injection
 */

import { NextRequest, NextResponse } from 'next/server';
import { tenantManager } from './TenantManager';
import type { Tenant, TenantContext, TenantUser, TenantRole } from './TenantManager';
import { validateInput } from '@/lib/security/input-validation';

// Tenant identification strategies
enum TenantIdentificationStrategy {
  SUBDOMAIN = 'subdomain',
  DOMAIN = 'domain',
  HEADER = 'header',
  PATH = 'path',
  TOKEN = 'token'
}

interface TenantIdentificationConfig {
  strategy: TenantIdentificationStrategy;
  fallbackStrategy?: TenantIdentificationStrategy;
  enableMultiStrategy?: boolean;
  headerName?: string;
  pathPrefix?: string;
  defaultTenant?: string;
}

interface TenantMiddlewareOptions {
  identification: TenantIdentificationConfig;
  requireTenant?: boolean;
  allowedTenantStatuses?: string[];
  skipRoutes?: string[];
  enableCaching?: boolean;
  cacheTTL?: number;
}

// Tenant context cache for performance
const tenantContextCache = new Map<string, {
  context: TenantContext;
  expiry: number;
}>();

/**
 * Tenant Context Manager
 * Handles tenant identification and context management
 */
export class TenantContextManager {
  private config: TenantMiddlewareOptions;
  private cache = new Map<string, { tenant: Tenant; expiry: number }>();

  constructor(config: TenantMiddlewareOptions) {
    this.config = {
      requireTenant: true,
      allowedTenantStatuses: ['active'],
      enableCaching: true,
      cacheTTL: 5 * 60 * 1000, // 5 minutes
      ...config
    };
  }

  /**
   * Identify tenant from request
   */
  async identifyTenant(request: NextRequest): Promise<Tenant | null> {
    const { identification } = this.config;
    let tenant: Tenant | null = null;

    // Try primary strategy
    tenant = await this.identifyByStrategy(request, identification.strategy);

    // Try fallback strategy if enabled and primary failed
    if (!tenant && identification.fallbackStrategy) {
      tenant = await this.identifyByStrategy(request, identification.fallbackStrategy);
    }

    // Try multi-strategy if enabled
    if (!tenant && identification.enableMultiStrategy) {
      const strategies = Object.values(TenantIdentificationStrategy);
      for (const strategy of strategies) {
        if (strategy !== identification.strategy && strategy !== identification.fallbackStrategy) {
          tenant = await this.identifyByStrategy(request, strategy);
          if (tenant) break;
        }
      }
    }

    // Use default tenant if specified and no tenant found
    if (!tenant && identification.defaultTenant) {
      tenant = tenantManager.getTenantBySlug(identification.defaultTenant) ||
               tenantManager.getTenantById(identification.defaultTenant);
    }

    return tenant;
  }

  /**
   * Identify tenant by specific strategy
   */
  private async identifyByStrategy(
    request: NextRequest, 
    strategy: TenantIdentificationStrategy
  ): Promise<Tenant | null> {
    const cacheKey = `${strategy}:${request.url}`;
    
    // Check cache first
    if (this.config.enableCaching) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiry > Date.now()) {
        return cached.tenant;
      }
    }

    let tenant: Tenant | null = null;

    switch (strategy) {
      case TenantIdentificationStrategy.SUBDOMAIN:
        tenant = this.identifyBySubdomain(request);
        break;

      case TenantIdentificationStrategy.DOMAIN:
        tenant = this.identifyByDomain(request);
        break;

      case TenantIdentificationStrategy.HEADER:
        tenant = this.identifyByHeader(request);
        break;

      case TenantIdentificationStrategy.PATH:
        tenant = this.identifyByPath(request);
        break;

      case TenantIdentificationStrategy.TOKEN:
        tenant = await this.identifyByToken(request);
        break;
    }

    // Cache result if caching is enabled
    if (tenant && this.config.enableCaching) {
      this.cache.set(cacheKey, {
        tenant,
        expiry: Date.now() + this.config.cacheTTL!
      });
    }

    return tenant;
  }

  /**
   * Identify tenant by subdomain
   */
  private identifyBySubdomain(request: NextRequest): Tenant | null {
    const host = request.headers.get('host') || request.nextUrl.hostname;
    
    if (!host || host === 'localhost') {
      return null;
    }

    // Extract subdomain
    const parts = host.split('.');
    if (parts.length < 3) {
      return null; // No subdomain
    }

    const subdomain = parts[0];
    
    // Validate subdomain format
    const validation = validateInput.text(subdomain, {
      customPattern: /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,
      minLength: 2,
      maxLength: 63
    });

    if (!validation.valid) {
      return null;
    }

    // Find tenant by subdomain
    const tenants = tenantManager.getAllTenants();
    return tenants.find(t => t.subdomain === subdomain) || null;
  }

  /**
   * Identify tenant by custom domain
   */
  private identifyByDomain(request: NextRequest): Tenant | null {
    const host = request.headers.get('host') || request.nextUrl.hostname;
    
    if (!host) {
      return null;
    }

    // Validate domain format
    const validation = validateInput.text(host, {
      customPattern: /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/,
      maxLength: 253
    });

    if (!validation.valid) {
      return null;
    }

    return tenantManager.getTenantByDomain(host);
  }

  /**
   * Identify tenant by header
   */
  private identifyByHeader(request: NextRequest): Tenant | null {
    const headerName = this.config.identification.headerName || 'X-Tenant-ID';
    const tenantId = request.headers.get(headerName);

    if (!tenantId) {
      return null;
    }

    // Validate tenant ID format
    const validation = validateInput.uuid(tenantId);
    if (validation.valid) {
      return tenantManager.getTenantById(tenantId);
    }

    // Try as slug if not UUID
    const slugValidation = validateInput.text(tenantId, {
      customPattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      maxLength: 50
    });

    if (slugValidation.valid) {
      return tenantManager.getTenantBySlug(tenantId);
    }

    return null;
  }

  /**
   * Identify tenant by path prefix
   */
  private identifyByPath(request: NextRequest): Tenant | null {
    const pathname = request.nextUrl.pathname;
    const pathPrefix = this.config.identification.pathPrefix || '/tenant/';

    if (!pathname.startsWith(pathPrefix)) {
      return null;
    }

    const tenantIdentifier = pathname.substring(pathPrefix.length).split('/')[0];
    
    if (!tenantIdentifier) {
      return null;
    }

    // Validate identifier
    const validation = validateInput.text(tenantIdentifier, {
      customPattern: /^[a-zA-Z0-9_-]+$/,
      maxLength: 50
    });

    if (!validation.valid) {
      return null;
    }

    // Try UUID first, then slug
    if (validateInput.uuid(tenantIdentifier).valid) {
      return tenantManager.getTenantById(tenantIdentifier);
    }

    return tenantManager.getTenantBySlug(tenantIdentifier);
  }

  /**
   * Identify tenant by JWT token
   */
  private async identifyByToken(request: NextRequest): Promise<Tenant | null> {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Try cookie fallback
      const accessToken = request.cookies.get('access-token')?.value;
      if (!accessToken) {
        return null;
      }
      return this.extractTenantFromToken(accessToken);
    }

    const token = authHeader.substring(7);
    return this.extractTenantFromToken(token);
  }

  /**
   * Extract tenant information from JWT token
   */
  private async extractTenantFromToken(token: string): Promise<Tenant | null> {
    try {
      // Import secure auth to verify token
      const { secureAuth } = await import('@/lib/auth/security-hardened');
      
      const payload = await secureAuth.verifyAccessToken(token);
      if (!payload || !payload.tenantId) {
        return null;
      }

      return tenantManager.getTenantById(payload.tenantId);
    } catch (error) {
      console.error('Error extracting tenant from token:', error);
      return null;
    }
  }

  /**
   * Create tenant context from tenant and request
   */
  async createTenantContext(
    tenant: Tenant, 
    request: NextRequest,
    user?: TenantUser
  ): Promise<TenantContext> {
    // Get user permissions
    let permissions: string[] = [];
    let tenantUser: TenantUser | undefined = user;

    if (!tenantUser) {
      // Try to extract user from token
      tenantUser = await this.extractUserFromRequest(request, tenant.id);
    }

    if (tenantUser) {
      permissions = tenantUser.permissions || [];
      
      // Add role-based permissions
      permissions = [...permissions, ...this.getRolePermissions(tenantUser.role)];
    }

    // Remove duplicates
    permissions = [...new Set(permissions)];

    return {
      tenant,
      user: tenantUser,
      permissions,
      limits: tenant.limits,
      features: tenant.features,
      customization: tenant.customization
    };
  }

  /**
   * Extract user information from request
   */
  private async extractUserFromRequest(
    request: NextRequest, 
    tenantId: string
  ): Promise<TenantUser | undefined> {
    try {
      const { secureAuth } = await import('@/lib/auth/security-hardened');
      
      // Try to get access token
      let token = request.headers.get('authorization')?.substring(7);
      
      if (!token) {
        token = request.cookies.get('access-token')?.value;
      }

      if (!token) {
        return undefined;
      }

      const payload = await secureAuth.verifyAccessToken(token);
      if (!payload || payload.tenantId !== tenantId) {
        return undefined;
      }

      // Create user object from token payload
      return {
        id: payload.userId,
        tenantId: payload.tenantId,
        email: payload.email || 'unknown',
        name: payload.name || 'Unknown User',
        role: (payload.role as TenantRole) || TenantRole.USER,
        permissions: payload.permissions || [],
        organizations: payload.organizations || [],
        isActive: true,
        metadata: payload.metadata || {}
      };
    } catch (error) {
      console.error('Error extracting user from request:', error);
      return undefined;
    }
  }

  /**
   * Get permissions for a role
   */
  private getRolePermissions(role: TenantRole): string[] {
    const rolePermissions = {
      [TenantRole.OWNER]: [
        'tenant:manage',
        'users:manage',
        'settings:manage',
        'billing:manage',
        'security:manage',
        'plugins:manage',
        'analytics:view'
      ],
      [TenantRole.ADMIN]: [
        'users:manage',
        'settings:manage',
        'plugins:manage',
        'analytics:view',
        'projects:manage'
      ],
      [TenantRole.USER]: [
        'projects:view',
        'projects:create',
        'analytics:view'
      ],
      [TenantRole.VIEWER]: [
        'projects:view',
        'analytics:view'
      ],
      [TenantRole.GUEST]: [
        'projects:view'
      ]
    };

    return rolePermissions[role] || [];
  }

  /**
   * Validate tenant context
   */
  validateTenantContext(context: TenantContext): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check tenant status
    if (this.config.allowedTenantStatuses?.length) {
      if (!this.config.allowedTenantStatuses.includes(context.tenant.status)) {
        errors.push(`Tenant status '${context.tenant.status}' is not allowed`);
      }
    }

    // Check if tenant is within limits
    if (context.tenant.limits.maxUsers > 0) {
      // In a real implementation, you'd check current usage
      // For now, we'll assume it's valid
    }

    // Check feature access
    if (context.user && !context.features.sso && context.user.role === TenantRole.OWNER) {
      // Allow owners access even if features are limited
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    tenantContextCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    entries: number;
  } {
    return {
      size: this.cache.size,
      hitRate: 0, // Would track this in a real implementation
      entries: tenantContextCache.size
    };
  }
}

/**
 * Tenant Context Middleware
 * Injects tenant context into requests
 */
export async function tenantContextMiddleware(
  request: NextRequest,
  config: TenantMiddlewareOptions
): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname;

  // Skip routes if configured
  if (config.skipRoutes?.some(route => pathname.startsWith(route))) {
    return null;
  }

  const contextManager = new TenantContextManager(config);

  try {
    // Identify tenant
    const tenant = await contextManager.identifyTenant(request);

    if (!tenant && config.requireTenant) {
      console.log(`[TENANT] No tenant found for request: ${request.url}`);
      
      return NextResponse.json({
        error: 'Tenant not found',
        message: 'This resource requires a valid tenant context'
      }, { 
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    if (tenant) {
      // Create tenant context
      const context = await contextManager.createTenantContext(tenant, request);

      // Validate context
      const validation = contextManager.validateTenantContext(context);
      if (!validation.valid) {
        console.log(`[TENANT] Invalid tenant context: ${validation.errors.join(', ')}`);
        
        return NextResponse.json({
          error: 'Tenant access denied',
          message: validation.errors.join(', ')
        }, { 
          status: 403,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }

      // Cache context for the request
      const contextKey = `${tenant.id}:${request.url}`;
      tenantContextCache.set(contextKey, {
        context,
        expiry: Date.now() + (config.cacheTTL || 5 * 60 * 1000)
      });

      // Add tenant headers to response
      const response = NextResponse.next();
      response.headers.set('X-Tenant-ID', tenant.id);
      response.headers.set('X-Tenant-Slug', tenant.slug);
      response.headers.set('X-Tenant-Tier', tenant.tier);
      
      return response;
    }

    return null;

  } catch (error) {
    console.error('Tenant context middleware error:', error);
    
    if (config.requireTenant) {
      return NextResponse.json({
        error: 'Tenant identification failed',
        message: 'Unable to determine tenant context'
      }, { 
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    return null;
  }
}

/**
 * Get tenant context for current request
 */
export function getTenantContext(request: NextRequest): TenantContext | null {
  const contextKey = `${request.url}`;
  
  // Look for cached context
  for (const [key, cached] of tenantContextCache.entries()) {
    if (key.endsWith(contextKey) && cached.expiry > Date.now()) {
      return cached.context;
    }
  }

  return null;
}

/**
 * Utility function to check tenant permissions
 */
export function hasPermission(
  context: TenantContext | null, 
  permission: string
): boolean {
  if (!context || !context.permissions) {
    return false;
  }

  return context.permissions.includes(permission) ||
         context.permissions.includes('*') ||
         (context.user?.role === TenantRole.OWNER);
}

/**
 * Utility function to check tenant features
 */
export function hasFeature(
  context: TenantContext | null, 
  feature: keyof typeof context.features
): boolean {
  if (!context) {
    return false;
  }

  return context.features[feature] === true;
}

/**
 * Default tenant identification configuration
 */
export const defaultTenantConfig: TenantMiddlewareOptions = {
  identification: {
    strategy: TenantIdentificationStrategy.SUBDOMAIN,
    fallbackStrategy: TenantIdentificationStrategy.HEADER,
    enableMultiStrategy: true,
    headerName: 'X-Tenant-ID'
  },
  requireTenant: true,
  allowedTenantStatuses: ['active'],
  enableCaching: true,
  cacheTTL: 5 * 60 * 1000, // 5 minutes
  skipRoutes: [
    '/_next',
    '/favicon.ico',
    '/robots.txt',
    '/sitemap.xml',
    '/api/health',
    '/api/metrics'
  ]
};

export default TenantContextManager;