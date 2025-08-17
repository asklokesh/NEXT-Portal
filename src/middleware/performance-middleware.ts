/**
 * API Performance Optimization Middleware
 * Enterprise-grade middleware for compression, rate limiting, and performance optimization
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Redis from 'ioredis';
import { createHash } from 'crypto';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

// Performance configuration
const PERFORMANCE_CONFIG = {
  // Compression settings
  compression: {
    threshold: 1024, // Compress responses larger than 1KB
    level: 6, // Compression level (1-9)
    contentTypes: [
      'application/json',
      'text/html',
      'text/css',
      'text/javascript',
      'application/javascript',
      'text/plain',
      'application/xml',
      'text/xml'
    ]
  },
  
  // Rate limiting configuration
  rateLimiting: {
    // Per endpoint limits
    endpoints: {
      '/api/plugins': { windowMs: 60000, max: 100 }, // 100 requests per minute
      '/api/catalog': { windowMs: 60000, max: 200 },
      '/api/auth': { windowMs: 300000, max: 10 }, // 10 requests per 5 minutes
      '/api/webhooks': { windowMs: 60000, max: 1000 },
      '/api/health': { windowMs: 10000, max: 100 },
    },
    // Global limits
    global: { windowMs: 60000, max: 1000 }, // 1000 requests per minute per IP
    // Tenant-specific limits
    tenant: { windowMs: 60000, max: 5000 }, // 5000 requests per minute per tenant
  },
  
  // Caching configuration
  caching: {
    // Static endpoints
    static: {
      '/api/plugins': 300, // 5 minutes
      '/api/templates': 600, // 10 minutes
      '/api/health': 30, // 30 seconds
    },
    // Dynamic endpoints (shorter TTL)
    dynamic: {
      '/api/catalog/entities': 60, // 1 minute
      '/api/monitoring': 30, // 30 seconds
    }
  },
  
  // Request optimization
  optimization: {
    maxRequestSize: 10 * 1024 * 1024, // 10MB
    timeout: 30000, // 30 seconds
    keepAlive: true,
    maxSockets: 100,
  }
};

interface RateLimitConfig {
  windowMs: number;
  max: number;
}

interface PerformanceMetrics {
  requestCount: number;
  responseTime: number[];
  errorCount: number;
  cacheHits: number;
  cacheMisses: number;
  compressionSavings: number;
  rateLimitHits: number;
}

class PerformanceMiddleware {
  private redis: Redis;
  private metrics: Map<string, PerformanceMetrics> = new Map();

  constructor(redis: Redis) {
    this.redis = redis;
    this.initializeMetrics();
  }

  /**
   * Main middleware handler
   */
  async handle(request: NextRequest): Promise<NextResponse | null> {
    const startTime = Date.now();
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;
    const ip = this.getClientIP(request);
    const tenantId = this.extractTenantId(request);
    
    try {
      // 1. Request size validation
      if (!this.validateRequestSize(request)) {
        return new NextResponse('Request too large', { status: 413 });
      }

      // 2. Rate limiting
      const rateLimitResult = await this.checkRateLimit(request, ip, tenantId);
      if (rateLimitResult.blocked) {
        return new NextResponse('Rate limit exceeded', {
          status: 429,
          headers: {
            'Retry-After': Math.ceil(rateLimitResult.resetTime! / 1000).toString(),
            'X-RateLimit-Limit': rateLimitResult.limit!.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining!.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetTime!.toString()
          }
        });
      }

      // 3. Cache check for GET requests
      if (method === 'GET') {
        const cachedResponse = await this.getCachedResponse(request);
        if (cachedResponse) {
          this.updateMetrics(pathname, 'cacheHits');
          return cachedResponse;
        }
        this.updateMetrics(pathname, 'cacheMisses');
      }

      // Continue to next middleware/handler
      return null;

    } catch (error) {
      console.error('Performance middleware error:', error);
      this.updateMetrics(pathname, 'errorCount');
      return null; // Let request continue
    }
  }

  /**
   * Response handler for compression and caching
   */
  async handleResponse(
    request: NextRequest, 
    response: NextResponse
  ): Promise<NextResponse> {
    const startTime = Date.now();
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;

    try {
      // 1. Add performance headers
      response.headers.set('X-Response-Time', `${Date.now() - startTime}ms`);
      response.headers.set('X-Powered-By', 'SaaS-IDP-Platform');

      // 2. Compression
      const compressedResponse = await this.compressResponse(request, response);

      // 3. Cache successful GET responses
      if (method === 'GET' && response.status === 200) {
        await this.cacheResponse(request, compressedResponse);
      }

      // 4. Add cache control headers
      this.addCacheHeaders(compressedResponse, pathname);

      // 5. Add security headers
      this.addSecurityHeaders(compressedResponse);

      // 6. Update metrics
      this.updateMetrics(pathname, 'requestCount');
      this.updateResponseTimeMetrics(pathname, Date.now() - startTime);

      return compressedResponse;

    } catch (error) {
      console.error('Response handling error:', error);
      this.updateMetrics(pathname, 'errorCount');
      return response;
    }
  }

  /**
   * Rate limiting implementation
   */
  private async checkRateLimit(
    request: NextRequest,
    ip: string,
    tenantId?: string
  ): Promise<{
    blocked: boolean;
    limit?: number;
    remaining?: number;
    resetTime?: number;
  }> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    // Check endpoint-specific limits
    const endpointConfig = this.getEndpointRateLimit(pathname);
    const endpointResult = await this.checkSingleRateLimit(
      `endpoint:${pathname}:${ip}`,
      endpointConfig
    );
    
    if (endpointResult.blocked) {
      this.updateMetrics(pathname, 'rateLimitHits');
      return endpointResult;
    }

    // Check global IP limits
    const globalResult = await this.checkSingleRateLimit(
      `global:${ip}`,
      PERFORMANCE_CONFIG.rateLimiting.global
    );
    
    if (globalResult.blocked) {
      this.updateMetrics(pathname, 'rateLimitHits');
      return globalResult;
    }

    // Check tenant limits if available
    if (tenantId) {
      const tenantResult = await this.checkSingleRateLimit(
        `tenant:${tenantId}`,
        PERFORMANCE_CONFIG.rateLimiting.tenant
      );
      
      if (tenantResult.blocked) {
        this.updateMetrics(pathname, 'rateLimitHits');
        return tenantResult;
      }
    }

    return { blocked: false };
  }

  /**
   * Single rate limit check
   */
  private async checkSingleRateLimit(
    key: string,
    config: RateLimitConfig
  ): Promise<{
    blocked: boolean;
    limit?: number;
    remaining?: number;
    resetTime?: number;
  }> {
    try {
      const current = await this.redis.incr(key);
      
      if (current === 1) {
        await this.redis.expire(key, Math.ceil(config.windowMs / 1000));
      }
      
      const ttl = await this.redis.ttl(key);
      const resetTime = Date.now() + (ttl * 1000);
      
      if (current > config.max) {
        return {
          blocked: true,
          limit: config.max,
          remaining: 0,
          resetTime
        };
      }
      
      return {
        blocked: false,
        limit: config.max,
        remaining: config.max - current,
        resetTime
      };
    } catch (error) {
      console.error('Rate limit check error:', error);
      return { blocked: false }; // Fail open
    }
  }

  /**
   * Response compression
   */
  private async compressResponse(
    request: NextRequest,
    response: NextResponse
  ): Promise<NextResponse> {
    const acceptEncoding = request.headers.get('accept-encoding') || '';
    const contentType = response.headers.get('content-type') || '';
    const contentLength = parseInt(response.headers.get('content-length') || '0');

    // Check if compression should be applied
    if (
      !acceptEncoding.includes('gzip') ||
      contentLength < PERFORMANCE_CONFIG.compression.threshold ||
      !this.shouldCompressContentType(contentType)
    ) {
      return response;
    }

    try {
      const text = await response.text();
      const originalSize = Buffer.byteLength(text, 'utf8');
      
      if (originalSize < PERFORMANCE_CONFIG.compression.threshold) {
        return new NextResponse(text, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
      }

      const compressed = await gzipAsync(Buffer.from(text, 'utf8'));
      const compressedSize = compressed.length;
      
      // Update compression metrics
      const savings = originalSize - compressedSize;
      this.updateCompressionMetrics(new URL(request.url).pathname, savings);

      const newHeaders = new Headers(response.headers);
      newHeaders.set('Content-Encoding', 'gzip');
      newHeaders.set('Content-Length', compressedSize.toString());
      newHeaders.set('X-Original-Size', originalSize.toString());
      newHeaders.set('X-Compressed-Size', compressedSize.toString());
      newHeaders.set('X-Compression-Ratio', ((savings / originalSize) * 100).toFixed(2) + '%');

      return new NextResponse(compressed, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    } catch (error) {
      console.error('Compression error:', error);
      return response;
    }
  }

  /**
   * Response caching
   */
  private async cacheResponse(
    request: NextRequest,
    response: NextResponse
  ): Promise<void> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const ttl = this.getCacheTTL(pathname);
    
    if (ttl <= 0) return;

    try {
      const cacheKey = this.generateCacheKey(request);
      const responseData = {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: await response.text()
      };

      await this.redis.setex(
        `response:${cacheKey}`,
        ttl,
        JSON.stringify(responseData)
      );
    } catch (error) {
      console.error('Response caching error:', error);
    }
  }

  /**
   * Get cached response
   */
  private async getCachedResponse(request: NextRequest): Promise<NextResponse | null> {
    try {
      const cacheKey = this.generateCacheKey(request);
      const cached = await this.redis.get(`response:${cacheKey}`);
      
      if (!cached) return null;

      const responseData = JSON.parse(cached);
      const headers = new Headers(responseData.headers);
      headers.set('X-Cache', 'HIT');
      
      return new NextResponse(responseData.body, {
        status: responseData.status,
        statusText: responseData.statusText,
        headers
      });
    } catch (error) {
      console.error('Cache retrieval error:', error);
      return null;
    }
  }

  /**
   * Generate cache key for request
   */
  private generateCacheKey(request: NextRequest): string {
    const url = new URL(request.url);
    const keyData = {
      pathname: url.pathname,
      search: url.search,
      method: request.method,
      userAgent: request.headers.get('user-agent'),
      tenantId: this.extractTenantId(request)
    };
    
    return createHash('md5').update(JSON.stringify(keyData)).digest('hex');
  }

  /**
   * Add cache control headers
   */
  private addCacheHeaders(response: NextResponse, pathname: string): void {
    const ttl = this.getCacheTTL(pathname);
    
    if (ttl > 0) {
      response.headers.set('Cache-Control', `public, max-age=${ttl}`);
    } else {
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
    
    response.headers.set('Vary', 'Accept-Encoding, User-Agent');
  }

  /**
   * Add security headers
   */
  private addSecurityHeaders(response: NextResponse): void {
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  }

  /**
   * Utility methods
   */
  private getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    const clientIP = request.headers.get('x-client-ip');
    
    return (
      forwarded?.split(',')[0] ||
      realIP ||
      clientIP ||
      'unknown'
    );
  }

  private extractTenantId(request: NextRequest): string | undefined {
    // Extract tenant ID from various sources
    const header = request.headers.get('x-tenant-id');
    const subdomain = new URL(request.url).hostname.split('.')[0];
    
    return header || (subdomain !== 'localhost' && subdomain !== 'www' ? subdomain : undefined);
  }

  private validateRequestSize(request: NextRequest): boolean {
    const contentLength = request.headers.get('content-length');
    if (!contentLength) return true;
    
    return parseInt(contentLength) <= PERFORMANCE_CONFIG.optimization.maxRequestSize;
  }

  private getEndpointRateLimit(pathname: string): RateLimitConfig {
    for (const [pattern, config] of Object.entries(PERFORMANCE_CONFIG.rateLimiting.endpoints)) {
      if (pathname.startsWith(pattern)) {
        return config;
      }
    }
    return PERFORMANCE_CONFIG.rateLimiting.global;
  }

  private getCacheTTL(pathname: string): number {
    // Check static endpoints
    for (const [pattern, ttl] of Object.entries(PERFORMANCE_CONFIG.caching.static)) {
      if (pathname.startsWith(pattern)) {
        return ttl;
      }
    }
    
    // Check dynamic endpoints
    for (const [pattern, ttl] of Object.entries(PERFORMANCE_CONFIG.caching.dynamic)) {
      if (pathname.startsWith(pattern)) {
        return ttl;
      }
    }
    
    return 0; // No caching by default
  }

  private shouldCompressContentType(contentType: string): boolean {
    return PERFORMANCE_CONFIG.compression.contentTypes.some(type =>
      contentType.includes(type)
    );
  }

  /**
   * Metrics management
   */
  private initializeMetrics(): void {
    this.metrics.set('global', {
      requestCount: 0,
      responseTime: [],
      errorCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
      compressionSavings: 0,
      rateLimitHits: 0
    });
  }

  private updateMetrics(pathname: string, metric: keyof PerformanceMetrics, value: number = 1): void {
    if (!this.metrics.has(pathname)) {
      this.metrics.set(pathname, {
        requestCount: 0,
        responseTime: [],
        errorCount: 0,
        cacheHits: 0,
        cacheMisses: 0,
        compressionSavings: 0,
        rateLimitHits: 0
      });
    }
    
    const pathMetrics = this.metrics.get(pathname)!;
    const globalMetrics = this.metrics.get('global')!;
    
    if (metric === 'responseTime') {
      pathMetrics.responseTime.push(value);
      globalMetrics.responseTime.push(value);
      
      // Keep only last 1000 response times
      if (pathMetrics.responseTime.length > 1000) {
        pathMetrics.responseTime = pathMetrics.responseTime.slice(-1000);
      }
      if (globalMetrics.responseTime.length > 1000) {
        globalMetrics.responseTime = globalMetrics.responseTime.slice(-1000);
      }
    } else {
      (pathMetrics[metric] as number) += value;
      (globalMetrics[metric] as number) += value;
    }
  }

  private updateResponseTimeMetrics(pathname: string, responseTime: number): void {
    this.updateMetrics(pathname, 'responseTime', responseTime);
  }

  private updateCompressionMetrics(pathname: string, savings: number): void {
    this.updateMetrics(pathname, 'compressionSavings', savings);
  }

  /**
   * Get performance metrics
   */
  getMetrics(): Map<string, PerformanceMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary(): any {
    const summary: any = {};
    
    this.metrics.forEach((metrics, path) => {
      const responseTimes = metrics.responseTime;
      summary[path] = {
        requestCount: metrics.requestCount,
        errorRate: metrics.requestCount > 0 ? (metrics.errorCount / metrics.requestCount) * 100 : 0,
        avgResponseTime: responseTimes.length > 0 ? 
          responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0,
        p95ResponseTime: responseTimes.length > 0 ? 
          responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)] : 0,
        cacheHitRate: (metrics.cacheHits + metrics.cacheMisses) > 0 ? 
          (metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)) * 100 : 0,
        compressionSavings: metrics.compressionSavings,
        rateLimitHits: metrics.rateLimitHits
      };
    });
    
    return summary;
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.initializeMetrics();
  }
}

export default PerformanceMiddleware;
export { PERFORMANCE_CONFIG };