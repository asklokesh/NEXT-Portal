/**
 * Enhanced Multi-Tenant Middleware
 * High-performance tenant routing with sub-100ms switching and comprehensive isolation
 */

import { NextRequest, NextResponse } from 'next/server';
import { enhancedTenantIsolation, TenantContext } from '@/lib/database/enhanced-tenant-isolation';

export interface TenantRouteConfig {
  requiresTenant: boolean;
  allowedTiers: string[];
  requiredFeatures: string[];
  requiredPermissions: string[];
  bypassRules?: string[];
  cacheStrategy: 'none' | 'short' | 'medium' | 'long';
  rateLimitKey?: string;
}

export interface PerformanceMetrics {
  tenantResolution: number;
  contextSetup: number;
  permissionCheck: number;
  totalLatency: number;
}

/**
 * Route configurations for different API endpoints
 */
const ROUTE_CONFIGS: Record<string, TenantRouteConfig> = {
  // Public routes
  '/api/health': {
    requiresTenant: false,
    allowedTiers: ['*'],
    requiredFeatures: [],
    requiredPermissions: [],
    cacheStrategy: 'short',
  },
  '/api/auth/login': {
    requiresTenant: false,
    allowedTiers: ['*'],
    requiredFeatures: [],
    requiredPermissions: [],
    cacheStrategy: 'none',
  },

  // Tenant-aware routes
  '/api/plugins': {
    requiresTenant: true,
    allowedTiers: ['starter', 'professional', 'enterprise'],
    requiredFeatures: [],
    requiredPermissions: ['plugins:read'],
    cacheStrategy: 'medium',
  },
  '/api/plugins/install': {
    requiresTenant: true,
    allowedTiers: ['professional', 'enterprise'],
    requiredFeatures: ['apiAccess'],
    requiredPermissions: ['plugins:install'],
    cacheStrategy: 'none',
  },
  '/api/admin': {
    requiresTenant: true,
    allowedTiers: ['enterprise'],
    requiredFeatures: ['advancedSecurity'],
    requiredPermissions: ['admin:*'],
    cacheStrategy: 'none',
  },

  // Default configuration
  '/api/*': {
    requiresTenant: true,
    allowedTiers: ['*'],
    requiredFeatures: [],
    requiredPermissions: ['api:access'],
    cacheStrategy: 'short',
  },
};

/**
 * Enhanced Tenant Middleware Manager
 * Optimized for sub-100ms tenant switching performance
 */
export class EnhancedTenantMiddleware {
  private readonly tenantCache = new Map<string, { tenant: any; expires: number }>();
  private readonly routeCache = new Map<string, { config: TenantRouteConfig; expires: number }>();
  private readonly performanceMetrics = new Map<string, PerformanceMetrics[]>();

  /**
   * Main middleware handler with performance optimization
   */
  async handle(request: NextRequest): Promise<NextResponse> {
    const startTime = Date.now();
    const pathname = request.nextUrl.pathname;
    
    try {
      // Fast route configuration lookup
      const routeConfig = this.getRouteConfig(pathname);
      
      // Skip tenant resolution for public routes
      if (!routeConfig.requiresTenant) {
        return this.handlePublicRoute(request, routeConfig);
      }

      // High-performance tenant resolution
      const tenantResolutionStart = Date.now();
      const tenantContext = await this.resolveTenantContext(request);
      const tenantResolutionTime = Date.now() - tenantResolutionStart;

      if (!tenantContext) {
        return this.createErrorResponse('TENANT_REQUIRED', 'Tenant context required for this endpoint', 400);
      }

      // Fast context setup
      const contextSetupStart = Date.now();
      await this.setupTenantContext(tenantContext);
      const contextSetupTime = Date.now() - contextSetupStart;

      // Optimized permission checking
      const permissionCheckStart = Date.now();
      const hasAccess = await this.validateTenantAccess(tenantContext, routeConfig);
      const permissionCheckTime = Date.now() - permissionCheckStart;

      if (!hasAccess.allowed) {
        return this.createErrorResponse('ACCESS_DENIED', hasAccess.reason, 403);
      }

      // Record performance metrics
      const totalLatency = Date.now() - startTime;
      this.recordPerformanceMetrics(tenantContext.tenantId, {
        tenantResolution: tenantResolutionTime,
        contextSetup: contextSetupTime,
        permissionCheck: permissionCheckTime,
        totalLatency,
      });

      // Create enhanced request with tenant context
      return this.createTenantAwareResponse(request, tenantContext, routeConfig);

    } catch (error) {
      console.error('Enhanced tenant middleware error:', error);
      return this.createErrorResponse(
        'MIDDLEWARE_ERROR',
        error instanceof Error ? error.message : 'Unknown middleware error',
        500
      );
    }
  }

  /**
   * High-performance tenant context resolution with caching
   */
  private async resolveTenantContext(request: NextRequest): Promise<TenantContext | null> {
    let tenantId: string | null = null;
    let tenantSlug: string | null = null;

    // Strategy 1: Subdomain-based (fastest)
    const host = request.headers.get('host') || '';
    if (host.includes('.') && !host.startsWith('localhost')) {
      tenantSlug = host.split('.')[0];
    } else if (host.startsWith('localhost:')) {
      // Special localhost handling
      tenantId = 'tenant-localhost:4400';
    }

    // Strategy 2: Header-based (second fastest)
    if (!tenantId) {
      tenantId = request.headers.get('x-tenant-id');
    }

    // Strategy 3: URL path parameter
    if (!tenantId && !tenantSlug) {
      const pathSegments = request.nextUrl.pathname.split('/');
      if (pathSegments[1] === 'tenant' && pathSegments[2]) {
        tenantSlug = pathSegments[2];
      }
    }

    // Strategy 4: Query parameter (slowest)
    if (!tenantId && !tenantSlug) {
      tenantId = request.nextUrl.searchParams.get('tenant');
    }

    // Strategy 5: JWT token extraction
    if (!tenantId && !tenantSlug) {
      const authHeader = request.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        tenantId = this.extractTenantFromJWT(authHeader.substring(7));
      }
    }

    // Resolve tenant ID from slug if needed
    if (tenantSlug && !tenantId) {
      tenantId = await this.resolveTenantIdFromSlug(tenantSlug);
    }

    if (!tenantId) {
      return null;
    }

    // Get user context
    const userId = await this.extractUserIdFromRequest(request);
    const sessionId = await this.extractSessionIdFromRequest(request);

    // Create optimized tenant context
    return {
      tenantId,
      userId,
      sessionId,
      requestId: this.generateRequestId(),
      clientIP: this.getClientIP(request),
      userAgent: request.headers.get('user-agent') || 'unknown',
      permissions: await this.getUserPermissions(tenantId, userId),
      isolationLevel: 'READ_COMMITTED',
    };
  }

  /**
   * Fast tenant ID resolution from slug with caching
   */
  private async resolveTenantIdFromSlug(slug: string): Promise<string | null> {
    const cacheKey = `slug:${slug}`;
    const cached = this.tenantCache.get(cacheKey);
    
    if (cached && cached.expires > Date.now()) {
      return cached.tenant.id;
    }

    // In production, this would query the database
    // For now, use a simple mapping
    const slugMapping: Record<string, string> = {
      'localhost': 'tenant-localhost:4400',
      'demo': 'tenant-demo',
      'system': 'tenant-system',
    };

    const tenantId = slugMapping[slug] || null;
    
    if (tenantId) {
      // Cache for 5 minutes
      this.tenantCache.set(cacheKey, {
        tenant: { id: tenantId, slug },
        expires: Date.now() + 300000,
      });
    }

    return tenantId;
  }

  /**
   * Setup tenant context with performance optimization
   */
  private async setupTenantContext(context: TenantContext): Promise<void> {
    try {
      await enhancedTenantIsolation.setTenantContext(context);
    } catch (error) {
      console.error('Failed to setup tenant context:', error);
      throw new Error(`Tenant context setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fast tenant access validation with caching
   */
  private async validateTenantAccess(
    context: TenantContext,
    config: TenantRouteConfig
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      // Get tenant configuration (cached)
      const tenant = await enhancedTenantIsolation.getTenantMetrics(context.tenantId);
      
      if (!tenant) {
        return { allowed: false, reason: 'Tenant not found or inactive' };
      }

      // Check tier restrictions
      if (config.allowedTiers.length > 0 && !config.allowedTiers.includes('*')) {
        // This would check actual tenant tier from configuration
        const tenantTier = 'enterprise'; // Placeholder
        if (!config.allowedTiers.includes(tenantTier)) {
          return { allowed: false, reason: `Tenant tier '${tenantTier}' not allowed for this endpoint` };
        }
      }

      // Check required features
      if (config.requiredFeatures.length > 0) {
        // This would check actual tenant features
        const hasRequiredFeatures = true; // Placeholder
        if (!hasRequiredFeatures) {
          return { allowed: false, reason: 'Tenant missing required features' };
        }
      }

      // Check user permissions (fast lookup)
      if (config.requiredPermissions.length > 0) {
        const hasPermissions = this.checkPermissions(context.permissions, config.requiredPermissions);
        if (!hasPermissions) {
          return { allowed: false, reason: 'Insufficient permissions' };
        }
      }

      return { allowed: true };

    } catch (error) {
      return { allowed: false, reason: `Access validation error: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  /**
   * Fast permission checking
   */
  private checkPermissions(userPermissions: string[], requiredPermissions: string[]): boolean {
    if (requiredPermissions.length === 0) return true;
    if (userPermissions.includes('*:*')) return true; // Super admin

    return requiredPermissions.every(required => {
      // Check exact match
      if (userPermissions.includes(required)) return true;
      
      // Check wildcard patterns
      const [action, resource] = required.split(':');
      return userPermissions.some(permission => {
        const [userAction, userResource] = permission.split(':');
        return (userAction === '*' || userAction === action) &&
               (userResource === '*' || userResource === resource);
      });
    });
  }

  /**
   * Get route configuration with caching
   */
  private getRouteConfig(pathname: string): TenantRouteConfig {
    const cached = this.routeCache.get(pathname);
    if (cached && cached.expires > Date.now()) {
      return cached.config;
    }

    // Find matching route configuration
    let config = ROUTE_CONFIGS[pathname];
    
    if (!config) {
      // Try pattern matching
      for (const [pattern, routeConfig] of Object.entries(ROUTE_CONFIGS)) {
        if (pattern.includes('*') && this.matchesPattern(pathname, pattern)) {
          config = routeConfig;
          break;
        }
      }
    }

    // Use default if no match found
    if (!config) {
      config = ROUTE_CONFIGS['/api/*'];
    }

    // Cache for 10 minutes
    this.routeCache.set(pathname, {
      config,
      expires: Date.now() + 600000,
    });

    return config;
  }

  /**
   * Handle public routes that don't require tenant context
   */
  private handlePublicRoute(request: NextRequest, config: TenantRouteConfig): NextResponse {
    const response = NextResponse.next();
    
    // Add public route headers
    response.headers.set('X-Route-Type', 'public');
    response.headers.set('X-Cache-Strategy', config.cacheStrategy);
    
    return response;
  }

  /**
   * Create tenant-aware response with optimized headers
   */
  private createTenantAwareResponse(
    request: NextRequest,
    context: TenantContext,
    config: TenantRouteConfig
  ): NextResponse {
    // Create request headers with tenant context
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-tenant-id', context.tenantId);
    requestHeaders.set('x-user-id', context.userId || 'anonymous');
    requestHeaders.set('x-session-id', context.sessionId || context.requestId);
    requestHeaders.set('x-request-id', context.requestId);
    requestHeaders.set('x-client-ip', context.clientIP);

    // Create response
    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

    // Add tenant context headers to response
    response.headers.set('X-Tenant-ID', context.tenantId);
    response.headers.set('X-Request-ID', context.requestId);
    response.headers.set('X-Route-Type', 'tenant-aware');
    response.headers.set('X-Cache-Strategy', config.cacheStrategy);

    // Add performance headers if available
    const metrics = this.getLatestMetrics(context.tenantId);
    if (metrics) {
      response.headers.set('X-Tenant-Latency', metrics.totalLatency.toString());
      response.headers.set('X-Tenant-Performance', metrics.totalLatency < 100 ? 'optimal' : 'degraded');
    }

    return response;
  }

  /**
   * Create standardized error response
   */
  private createErrorResponse(
    errorCode: string,
    message: string,
    statusCode: number
  ): NextResponse {
    return new NextResponse(
      JSON.stringify({
        error: errorCode,
        message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: statusCode,
        headers: {
          'Content-Type': 'application/json',
          'X-Error-Code': errorCode,
        },
      }
    );
  }

  /**
   * Extract tenant from JWT token
   */
  private extractTenantFromJWT(token: string): string | null {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.tenant_id || payload.tenant || null;
    } catch {
      return null;
    }
  }

  /**
   * Extract user ID from request
   */
  private async extractUserIdFromRequest(request: NextRequest): Promise<string | undefined> {
    // Try session cookie first
    const sessionCookie = request.cookies.get('session-token');
    if (sessionCookie) {
      // This would decode the session to get user ID
      return 'user-from-session';
    }

    // Try Authorization header
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.user_id || payload.sub;
      } catch {
        return undefined;
      }
    }

    return undefined;
  }

  /**
   * Extract session ID from request
   */
  private async extractSessionIdFromRequest(request: NextRequest): Promise<string | undefined> {
    return request.cookies.get('session-id')?.value;
  }

  /**
   * Get user permissions with caching
   */
  private async getUserPermissions(tenantId: string, userId?: string): Promise<string[]> {
    if (!userId) {
      return ['api:access']; // Anonymous user permissions
    }

    // This would fetch from the database with caching
    // For now, return default permissions
    return ['api:access', 'plugins:read', 'plugins:install'];
  }

  /**
   * Get client IP address
   */
  private getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    const clientIP = request.headers.get('x-client-ip');

    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }

    return realIP || clientIP || request.ip || 'unknown';
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Pattern matching for route configuration
   */
  private matchesPattern(pathname: string, pattern: string): boolean {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return regex.test(pathname);
  }

  /**
   * Record performance metrics
   */
  private recordPerformanceMetrics(tenantId: string, metrics: PerformanceMetrics): void {
    if (!this.performanceMetrics.has(tenantId)) {
      this.performanceMetrics.set(tenantId, []);
    }

    const tenantMetrics = this.performanceMetrics.get(tenantId)!;
    tenantMetrics.push(metrics);

    // Keep only last 100 entries per tenant
    if (tenantMetrics.length > 100) {
      tenantMetrics.splice(0, tenantMetrics.length - 100);
    }

    // Alert if performance degrades
    if (metrics.totalLatency > 100) {
      console.warn(`Performance alert: Tenant ${tenantId} context switch took ${metrics.totalLatency}ms`);
    }
  }

  /**
   * Get latest performance metrics for tenant
   */
  private getLatestMetrics(tenantId: string): PerformanceMetrics | null {
    const metrics = this.performanceMetrics.get(tenantId);
    return metrics && metrics.length > 0 ? metrics[metrics.length - 1] : null;
  }

  /**
   * Get performance statistics for monitoring
   */
  getPerformanceStats(tenantId: string): {
    avgLatency: number;
    maxLatency: number;
    minLatency: number;
    sampleCount: number;
    sub100msRate: number;
  } | null {
    const metrics = this.performanceMetrics.get(tenantId);
    if (!metrics || metrics.length === 0) return null;

    const latencies = metrics.map(m => m.totalLatency);
    const sub100ms = latencies.filter(l => l < 100).length;

    return {
      avgLatency: latencies.reduce((sum, l) => sum + l, 0) / latencies.length,
      maxLatency: Math.max(...latencies),
      minLatency: Math.min(...latencies),
      sampleCount: latencies.length,
      sub100msRate: (sub100ms / latencies.length) * 100,
    };
  }

  /**
   * Clear performance caches
   */
  clearCaches(): void {
    this.tenantCache.clear();
    this.routeCache.clear();
    this.performanceMetrics.clear();
  }
}

// Global instance
export const enhancedTenantMiddleware = new EnhancedTenantMiddleware();

export default enhancedTenantMiddleware;