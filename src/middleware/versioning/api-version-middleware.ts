/**
 * API Version Middleware
 * 
 * Next.js middleware for automatic API versioning, request routing,
 * and version negotiation
 */

import { NextRequest, NextResponse } from 'next/server';
import { ContentNegotiationEngine, ContentNegotiationConfig } from '../../src/lib/api-versioning/rest/content-negotiation';
import { SemanticVersionEngine } from '../../src/lib/api-versioning/core/semantic-version';
import { VERSION_HEADERS, ERROR_CODES, DEFAULT_CONFIG } from '../../src/lib/api-versioning/constants';

export interface VersionMiddlewareConfig extends ContentNegotiationConfig {
  enabled: boolean;
  routeMapping: Record<string, RouteVersionConfig>;
  fallbackHandling: 'redirect' | 'error' | 'latest';
  enableMetrics: boolean;
  enableCaching: boolean;
  cacheMaxAge: number;
}

export interface RouteVersionConfig {
  supportedVersions: string[];
  defaultVersion: string;
  deprecationWarnings: boolean;
  requiresAuth: boolean;
  rateLimit?: RateLimitConfig;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message: string;
}

export interface VersionMetrics {
  requestCount: number;
  errorCount: number;
  avgLatency: number;
  versionDistribution: Record<string, number>;
}

export class ApiVersionMiddleware {
  private contentNegotiator: ContentNegotiationEngine;
  private config: VersionMiddlewareConfig;
  private metrics: Map<string, VersionMetrics> = new Map();
  private requestCache = new Map<string, any>();
  private rateLimitStore = new Map<string, { count: number; resetTime: number }>();

  constructor(config: VersionMiddlewareConfig) {
    this.config = config;
    this.contentNegotiator = new ContentNegotiationEngine(config);
  }

  /**
   * Main middleware function for Next.js
   */
  async middleware(request: NextRequest): Promise<NextResponse> {
    if (!this.config.enabled) {
      return NextResponse.next();
    }

    const startTime = Date.now();

    try {
      // Skip non-API routes
      if (!this.isApiRoute(request.nextUrl.pathname)) {
        return NextResponse.next();
      }

      // Extract route and version information
      const route = this.extractRoute(request.nextUrl.pathname);
      const routeConfig = this.config.routeMapping[route];

      if (!routeConfig) {
        return NextResponse.next(); // No versioning config for this route
      }

      // Negotiate version
      const versionRequest = this.contentNegotiator.negotiateVersion(request);

      // Validate version support for this route
      if (!this.isVersionSupportedForRoute(versionRequest.version, routeConfig)) {
        return this.handleUnsupportedVersion(request, versionRequest.version, routeConfig);
      }

      // Apply rate limiting
      if (routeConfig.rateLimit) {
        const rateLimitResponse = this.applyRateLimit(request, routeConfig.rateLimit);
        if (rateLimitResponse) {
          return rateLimitResponse;
        }
      }

      // Check for cached response
      if (this.config.enableCaching) {
        const cachedResponse = this.getCachedResponse(request, versionRequest);
        if (cachedResponse) {
          return cachedResponse;
        }
      }

      // Rewrite request URL to include version
      const rewrittenUrl = this.rewriteUrlWithVersion(request.nextUrl, versionRequest.version, route);
      
      // Create request headers with version information
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set(VERSION_HEADERS.VERSION, versionRequest.version);
      requestHeaders.set('x-route-version-config', JSON.stringify(routeConfig));

      // Create the rewritten request
      const rewrittenRequest = new Request(rewrittenUrl, {
        method: request.method,
        headers: requestHeaders,
        body: request.body
      });

      // Continue to the actual API handler
      const response = await this.forwardRequest(rewrittenRequest);

      // Add versioning headers to response
      const versionedResponse = this.addVersionHeaders(response, versionRequest, routeConfig);

      // Record metrics
      if (this.config.enableMetrics) {
        this.recordMetrics(route, versionRequest.version, Date.now() - startTime, response.status);
      }

      // Cache response if enabled
      if (this.config.enableCaching && response.ok) {
        this.cacheResponse(request, versionRequest, versionedResponse);
      }

      return versionedResponse;

    } catch (error) {
      console.error('API Version Middleware Error:', error);
      return this.handleError(error, request);
    }
  }

  /**
   * Handle version-specific request routing
   */
  private async forwardRequest(request: Request): Promise<Response> {
    // In a real implementation, this would forward to the appropriate version handler
    // For now, we'll continue with the normal Next.js flow
    return fetch(request);
  }

  /**
   * Check if path is an API route
   */
  private isApiRoute(pathname: string): boolean {
    return pathname.startsWith('/api/');
  }

  /**
   * Extract base route from pathname
   */
  private extractRoute(pathname: string): string {
    // Remove version prefix if present (e.g., /api/v1/users -> /api/users)
    const cleanPath = pathname.replace(/\/api\/v\d+(\.\d+)*/, '/api');
    return cleanPath;
  }

  /**
   * Check if version is supported for specific route
   */
  private isVersionSupportedForRoute(version: string, routeConfig: RouteVersionConfig): boolean {
    return routeConfig.supportedVersions.includes(version) ||
           routeConfig.supportedVersions.includes('*'); // Wildcard support
  }

  /**
   * Handle unsupported version requests
   */
  private handleUnsupportedVersion(
    request: NextRequest,
    version: string,
    routeConfig: RouteVersionConfig
  ): NextResponse {
    const errorResponse = {
      error: ERROR_CODES.VERSION_NOT_SUPPORTED,
      message: `API version ${version} is not supported for this endpoint`,
      supportedVersions: routeConfig.supportedVersions,
      defaultVersion: routeConfig.defaultVersion
    };

    switch (this.config.fallbackHandling) {
      case 'redirect':
        const redirectUrl = new URL(request.url);
        redirectUrl.searchParams.set('version', routeConfig.defaultVersion);
        return NextResponse.redirect(redirectUrl, 302);

      case 'latest':
        const latestVersion = this.getLatestVersion(routeConfig.supportedVersions);
        const latestUrl = this.rewriteUrlWithVersion(request.nextUrl, latestVersion, this.extractRoute(request.nextUrl.pathname));
        return NextResponse.rewrite(latestUrl);

      case 'error':
      default:
        return NextResponse.json(errorResponse, { status: 400 });
    }
  }

  /**
   * Apply rate limiting
   */
  private applyRateLimit(request: NextRequest, rateLimit: RateLimitConfig): NextResponse | null {
    const clientKey = this.getClientKey(request);
    const now = Date.now();
    const windowStart = now - rateLimit.windowMs;

    let clientData = this.rateLimitStore.get(clientKey);
    
    if (!clientData || clientData.resetTime < windowStart) {
      clientData = { count: 0, resetTime: now + rateLimit.windowMs };
    }

    clientData.count++;
    this.rateLimitStore.set(clientKey, clientData);

    if (clientData.count > rateLimit.maxRequests) {
      const retryAfter = Math.ceil((clientData.resetTime - now) / 1000);
      
      return NextResponse.json(
        { 
          error: 'RATE_LIMIT_EXCEEDED',
          message: rateLimit.message,
          retryAfter 
        },
        { 
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': rateLimit.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.ceil(clientData.resetTime / 1000).toString()
          }
        }
      );
    }

    return null;
  }

  /**
   * Get client key for rate limiting
   */
  private getClientKey(request: NextRequest): string {
    return request.headers.get('x-client-id') ||
           request.headers.get('x-forwarded-for') ||
           request.headers.get('x-real-ip') ||
           'anonymous';
  }

  /**
   * Get cached response
   */
  private getCachedResponse(request: NextRequest, versionRequest: any): NextResponse | null {
    const cacheKey = this.generateCacheKey(request, versionRequest);
    const cached = this.requestCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.config.cacheMaxAge * 1000) {
      const response = NextResponse.json(cached.data, { status: cached.status });
      response.headers.set('X-Cache', 'HIT');
      return response;
    }

    return null;
  }

  /**
   * Cache response
   */
  private cacheResponse(request: NextRequest, versionRequest: any, response: NextResponse): void {
    const cacheKey = this.generateCacheKey(request, versionRequest);
    
    // Don't cache if response is not cacheable
    if (!this.isCacheable(response)) {
      return;
    }

    this.requestCache.set(cacheKey, {
      data: response.body,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      timestamp: Date.now()
    });

    // Clean up old cache entries
    this.cleanupCache();
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(request: NextRequest, versionRequest: any): string {
    const url = new URL(request.url);
    url.searchParams.sort(); // Normalize query parameters
    
    return `${request.method}:${url.pathname}:${url.search}:${versionRequest.version}:${versionRequest.format}`;
  }

  /**
   * Check if response is cacheable
   */
  private isCacheable(response: NextResponse): boolean {
    return response.status === 200 && 
           response.headers.get('Cache-Control') !== 'no-cache' &&
           !response.headers.get('Set-Cookie');
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    const maxAge = this.config.cacheMaxAge * 1000;

    for (const [key, value] of this.requestCache.entries()) {
      if (now - value.timestamp > maxAge) {
        this.requestCache.delete(key);
      }
    }
  }

  /**
   * Rewrite URL with version information
   */
  private rewriteUrlWithVersion(url: URL, version: string, route: string): URL {
    const newUrl = new URL(url);
    
    // Add version to path if not already present
    if (!newUrl.pathname.includes(`/v${version}/`)) {
      newUrl.pathname = newUrl.pathname.replace('/api/', `/api/v${version}/`);
    }

    return newUrl;
  }

  /**
   * Add version headers to response
   */
  private addVersionHeaders(
    response: Response,
    versionRequest: any,
    routeConfig: RouteVersionConfig
  ): NextResponse {
    const newResponse = new NextResponse(response.body, response);

    // Copy original headers
    response.headers.forEach((value, key) => {
      newResponse.headers.set(key, value);
    });

    // Add version headers
    newResponse.headers.set(VERSION_HEADERS.VERSION, versionRequest.version);
    newResponse.headers.set(VERSION_HEADERS.CONTENT_VERSION, versionRequest.version);

    // Add deprecation warnings
    if (routeConfig.deprecationWarnings && this.isVersionDeprecated(versionRequest.version)) {
      const deprecationInfo = this.getDeprecationInfo(versionRequest.version);
      newResponse.headers.set(
        VERSION_HEADERS.DEPRECATED,
        `true; date="${deprecationInfo.date.toISOString()}"; reason="${deprecationInfo.reason}"`
      );
    }

    // Add supported versions
    newResponse.headers.set(
      'X-Supported-Versions',
      routeConfig.supportedVersions.join(', ')
    );

    // Add CORS headers for version negotiation
    newResponse.headers.set(
      'Access-Control-Expose-Headers',
      Object.values(VERSION_HEADERS).join(', ') + ', X-Supported-Versions'
    );

    return newResponse;
  }

  /**
   * Record metrics
   */
  private recordMetrics(route: string, version: string, latency: number, status: number): void {
    const key = `${route}:${version}`;
    let metrics = this.metrics.get(key);

    if (!metrics) {
      metrics = {
        requestCount: 0,
        errorCount: 0,
        avgLatency: 0,
        versionDistribution: {}
      };
    }

    metrics.requestCount++;
    if (status >= 400) {
      metrics.errorCount++;
    }

    // Update average latency
    metrics.avgLatency = (metrics.avgLatency * (metrics.requestCount - 1) + latency) / metrics.requestCount;

    // Update version distribution
    metrics.versionDistribution[version] = (metrics.versionDistribution[version] || 0) + 1;

    this.metrics.set(key, metrics);
  }

  /**
   * Handle middleware errors
   */
  private handleError(error: any, request: NextRequest): NextResponse {
    console.error('API Versioning Error:', error);

    const errorResponse = {
      error: 'VERSION_MIDDLEWARE_ERROR',
      message: 'An error occurred in the version middleware',
      details: error.message,
      path: request.nextUrl.pathname
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }

  /**
   * Get latest version from supported versions
   */
  private getLatestVersion(supportedVersions: string[]): string {
    return supportedVersions
      .filter(v => v !== '*')
      .sort((a, b) => SemanticVersionEngine.compare(b, a))[0];
  }

  /**
   * Check if version is deprecated
   */
  private isVersionDeprecated(version: string): boolean {
    return version in this.config.deprecatedVersions;
  }

  /**
   * Get deprecation information
   */
  private getDeprecationInfo(version: string): any {
    return this.config.deprecatedVersions[version] || {
      date: new Date(),
      reason: 'Version deprecated'
    };
  }

  /**
   * Get middleware metrics
   */
  getMetrics(): Map<string, VersionMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Clear middleware cache
   */
  clearCache(): void {
    this.requestCache.clear();
    this.rateLimitStore.clear();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<VersionMiddlewareConfig>): void {
    this.config = { ...this.config, ...config };
    this.contentNegotiator = new ContentNegotiationEngine(this.config);
  }
}

// Create default middleware instance
export function createVersionMiddleware(config: VersionMiddlewareConfig): ApiVersionMiddleware {
  return new ApiVersionMiddleware(config);
}

// Default configuration
export const defaultConfig: VersionMiddlewareConfig = {
  enabled: true,
  defaultVersion: '1.0.0',
  supportedVersions: ['1.0.0', '1.1.0', '2.0.0'],
  deprecatedVersions: {},
  sunsetVersions: {},
  versionAliases: {
    'latest': '2.0.0',
    'stable': '1.1.0',
    'legacy': '1.0.0'
  },
  formatTransformers: {},
  compatibilityMatrix: {},
  routeMapping: {},
  fallbackHandling: 'error',
  enableMetrics: true,
  enableCaching: true,
  cacheMaxAge: 300 // 5 minutes
};

export default ApiVersionMiddleware;