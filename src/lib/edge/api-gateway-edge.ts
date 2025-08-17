/**
 * Edge-Based API Gateway System
 * Multi-region API gateways with intelligent routing and edge processing
 */

export interface EdgeAPIGateway {
  id: string;
  region: string;
  endpoint: string;
  status: 'active' | 'degraded' | 'offline' | 'maintenance';
  capabilities: {
    authentication: boolean;
    rateLimit: boolean;
    caching: boolean;
    transformation: boolean;
    analytics: boolean;
  };
  metrics: {
    requestsPerSecond: number;
    averageLatency: number;
    errorRate: number;
    cpuUsage: number;
    memoryUsage: number;
    uptime: number;
    lastHealthCheck: Date;
  };
  routes: EdgeRoute[];
  rateLimit: {
    enabled: boolean;
    rules: RateLimitRule[];
  };
  cache: {
    enabled: boolean;
    policies: CachePolicy[];
  };
}

export interface EdgeRoute {
  id: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  upstream: {
    service: string;
    url: string;
    timeout: number;
    retries: number;
  };
  middleware: EdgeMiddleware[];
  cache: {
    enabled: boolean;
    ttl: number;
    varyBy: string[];
  };
  rateLimit: {
    enabled: boolean;
    requestsPerMinute: number;
    burstSize: number;
  };
  authentication: {
    required: boolean;
    methods: ('jwt' | 'api_key' | 'oauth2')[];
    scopes?: string[];
  };
  transformations: {
    request?: RequestTransformation;
    response?: ResponseTransformation;
  };
}

export interface EdgeMiddleware {
  type: 'auth' | 'rateLimit' | 'cache' | 'transform' | 'logging' | 'metrics';
  enabled: boolean;
  config: Record<string, any>;
  order: number;
}

export interface RateLimitRule {
  id: string;
  pattern: string;
  limit: number;
  window: number; // seconds
  scope: 'global' | 'tenant' | 'user' | 'ip';
  action: 'block' | 'throttle' | 'queue';
}

export interface CachePolicy {
  id: string;
  pattern: string;
  ttl: number;
  varyBy: string[];
  conditions: Array<{
    header?: string;
    query?: string;
    method?: string;
    value: string;
    operator: 'equals' | 'contains' | 'regex';
  }>;
}

export interface RequestTransformation {
  headers?: {
    add?: Record<string, string>;
    remove?: string[];
    modify?: Record<string, string>;
  };
  query?: {
    add?: Record<string, string>;
    remove?: string[];
    modify?: Record<string, string>;
  };
  body?: {
    template?: string;
    jsonPath?: Record<string, string>;
  };
}

export interface ResponseTransformation {
  headers?: {
    add?: Record<string, string>;
    remove?: string[];
  };
  body?: {
    template?: string;
    filter?: string[];
    transform?: Record<string, string>;
  };
  statusCode?: {
    map?: Record<number, number>;
  };
}

export interface APIRequest {
  id: string;
  gatewayId: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body?: any;
  clientIP: string;
  userAgent: string;
  tenantId?: string;
  userId?: string;
  timestamp: Date;
}

export interface APIResponse {
  requestId: string;
  statusCode: number;
  headers: Record<string, string>;
  body?: any;
  latency: number;
  cacheStatus: 'hit' | 'miss' | 'bypass';
  gatewayProcessingTime: number;
  upstreamResponseTime: number;
  totalTime: number;
}

export interface RoutingDecision {
  selectedGateway: string;
  reason: string;
  alternativeGateways: string[];
  routingLatency: number;
  healthScore: number;
}

/**
 * Edge API Gateway Manager
 */
export class EdgeAPIGatewayManager {
  private gateways: Map<string, EdgeAPIGateway> = new Map();
  private routingTable: Map<string, string[]> = new Map(); // path -> gateway IDs
  private globalRoutes: Map<string, EdgeRoute> = new Map();
  private requestLog: APIRequest[] = [];
  private responseLog: APIResponse[] = [];
  private routingDecisions: Map<string, RoutingDecision> = new Map();

  constructor() {
    this.initializeEdgeGateways();
    this.initializeGlobalRoutes();
    this.startHealthChecks();
    this.startMetricsCollection();
  }

  /**
   * Route API request to optimal edge gateway
   */
  async routeRequest(
    request: Omit<APIRequest, 'id' | 'timestamp'>,
    clientLocation?: {
      country: string;
      region: string;
      coordinates: { latitude: number; longitude: number };
    }
  ): Promise<{
    response: APIResponse;
    routing: RoutingDecision;
  }> {
    const requestId = this.generateRequestId();
    const timestamp = new Date();

    const apiRequest: APIRequest = {
      ...request,
      id: requestId,
      timestamp
    };

    // Find matching route
    const route = this.findMatchingRoute(request.path, request.method);
    if (!route) {
      throw new Error(`No route found for ${request.method} ${request.path}`);
    }

    // Select optimal gateway
    const routing = await this.selectOptimalGateway(apiRequest, route, clientLocation);
    const gateway = this.gateways.get(routing.selectedGateway);
    
    if (!gateway) {
      throw new Error(`Gateway not available: ${routing.selectedGateway}`);
    }

    // Process request through edge gateway
    const response = await this.processRequest(apiRequest, route, gateway);

    // Log request and response
    this.requestLog.push(apiRequest);
    this.responseLog.push(response);
    this.routingDecisions.set(requestId, routing);

    // Keep logs bounded
    if (this.requestLog.length > 10000) {
      this.requestLog = this.requestLog.slice(-5000);
      this.responseLog = this.responseLog.slice(-5000);
    }

    return { response, routing };
  }

  /**
   * Register a new edge route
   */
  registerRoute(route: EdgeRoute): void {
    this.globalRoutes.set(`${route.method}:${route.path}`, route);
    
    // Update routing table for all active gateways
    const activeGateways = Array.from(this.gateways.values())
      .filter(g => g.status === 'active')
      .map(g => g.id);
    
    this.routingTable.set(route.path, activeGateways);
    
    console.log(`Registered route ${route.method} ${route.path} on ${activeGateways.length} gateways`);
  }

  /**
   * Update rate limit rules
   */
  updateRateLimitRules(gatewayId: string, rules: RateLimitRule[]): void {
    const gateway = this.gateways.get(gatewayId);
    if (gateway) {
      gateway.rateLimit.rules = rules;
      console.log(`Updated rate limit rules for gateway ${gatewayId}`);
    }
  }

  /**
   * Update cache policies
   */
  updateCachePolicies(gatewayId: string, policies: CachePolicy[]): void {
    const gateway = this.gateways.get(gatewayId);
    if (gateway) {
      gateway.cache.policies = policies;
      console.log(`Updated cache policies for gateway ${gatewayId}`);
    }
  }

  /**
   * Get gateway analytics
   */
  getGatewayAnalytics(timeRange?: { start: Date; end: Date }): {
    totalRequests: number;
    requestsByGateway: Array<{ gatewayId: string; requests: number }>;
    avgLatency: number;
    errorRate: number;
    cacheHitRate: number;
    topRoutes: Array<{ route: string; requests: number }>;
    geographicDistribution: Array<{ region: string; requests: number }>;
    statusCodeDistribution: Record<number, number>;
  } {
    let requests = this.requestLog;
    let responses = this.responseLog;
    
    if (timeRange) {
      requests = requests.filter(r => 
        r.timestamp >= timeRange.start && r.timestamp <= timeRange.end
      );
      responses = responses.filter(r => {
        const request = this.requestLog.find(req => req.id === r.requestId);
        return request && request.timestamp >= timeRange.start && request.timestamp <= timeRange.end;
      });
    }

    const totalRequests = requests.length;
    
    // Requests by gateway
    const gatewayStats = new Map<string, number>();
    for (const response of responses) {
      const request = requests.find(r => r.id === response.requestId);
      if (request) {
        const routing = this.routingDecisions.get(request.id);
        if (routing) {
          const count = gatewayStats.get(routing.selectedGateway) || 0;
          gatewayStats.set(routing.selectedGateway, count + 1);
        }
      }
    }

    const requestsByGateway = Array.from(gatewayStats.entries())
      .map(([gatewayId, requests]) => ({ gatewayId, requests }))
      .sort((a, b) => b.requests - a.requests);

    // Average latency
    const avgLatency = responses.length > 0 ?
      responses.reduce((sum, r) => sum + r.totalTime, 0) / responses.length : 0;

    // Error rate
    const errorCount = responses.filter(r => r.statusCode >= 400).length;
    const errorRate = totalRequests > 0 ? errorCount / totalRequests : 0;

    // Cache hit rate
    const cacheHits = responses.filter(r => r.cacheStatus === 'hit').length;
    const cacheHitRate = responses.length > 0 ? cacheHits / responses.length : 0;

    // Top routes
    const routeStats = new Map<string, number>();
    for (const request of requests) {
      const routeKey = `${request.method} ${request.path}`;
      const count = routeStats.get(routeKey) || 0;
      routeStats.set(routeKey, count + 1);
    }

    const topRoutes = Array.from(routeStats.entries())
      .map(([route, requests]) => ({ route, requests }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);

    // Geographic distribution (simplified)
    const regions = Array.from(this.gateways.values()).map(g => g.region);
    const geoDistribution = regions.map(region => ({
      region,
      requests: Math.floor(totalRequests / regions.length + Math.random() * 100)
    }));

    // Status code distribution
    const statusCodeDistribution: Record<number, number> = {};
    for (const response of responses) {
      statusCodeDistribution[response.statusCode] = 
        (statusCodeDistribution[response.statusCode] || 0) + 1;
    }

    return {
      totalRequests,
      requestsByGateway,
      avgLatency,
      errorRate,
      cacheHitRate,
      topRoutes,
      geographicDistribution: geoDistribution,
      statusCodeDistribution
    };
  }

  /**
   * Process request through edge gateway
   */
  private async processRequest(
    request: APIRequest,
    route: EdgeRoute,
    gateway: EdgeAPIGateway
  ): Promise<APIResponse> {
    const startTime = Date.now();
    let processingTime = 0;
    let upstreamTime = 0;
    let cacheStatus: 'hit' | 'miss' | 'bypass' = 'bypass';

    try {
      // Apply middleware in order
      const middlewares = route.middleware.sort((a, b) => a.order - b.order);
      
      for (const middleware of middlewares) {
        if (!middleware.enabled) continue;
        
        const middlewareStart = Date.now();
        await this.executeMiddleware(middleware, request, route, gateway);
        processingTime += Date.now() - middlewareStart;
      }

      // Check cache
      if (route.cache.enabled && request.method === 'GET') {
        const cacheResult = await this.checkCache(request, route, gateway);
        if (cacheResult) {
          cacheStatus = 'hit';
          processingTime += 50; // Cache lookup time
          
          return {
            requestId: request.id,
            statusCode: 200,
            headers: cacheResult.headers,
            body: cacheResult.body,
            latency: Date.now() - startTime,
            cacheStatus,
            gatewayProcessingTime: processingTime,
            upstreamResponseTime: 0,
            totalTime: Date.now() - startTime
          };
        } else {
          cacheStatus = 'miss';
        }
      }

      // Forward to upstream
      const upstreamStart = Date.now();
      const upstreamResponse = await this.forwardToUpstream(request, route);
      upstreamTime = Date.now() - upstreamStart;

      // Cache response if applicable
      if (route.cache.enabled && upstreamResponse.statusCode < 400) {
        await this.cacheResponse(request, route, upstreamResponse, gateway);
      }

      // Apply response transformations
      const transformedResponse = await this.transformResponse(upstreamResponse, route);

      return {
        requestId: request.id,
        statusCode: transformedResponse.statusCode,
        headers: transformedResponse.headers,
        body: transformedResponse.body,
        latency: Date.now() - startTime,
        cacheStatus,
        gatewayProcessingTime: processingTime,
        upstreamResponseTime: upstreamTime,
        totalTime: Date.now() - startTime
      };

    } catch (error) {
      console.error(`Gateway processing error:`, error);
      
      return {
        requestId: request.id,
        statusCode: 500,
        headers: { 'content-type': 'application/json' },
        body: { error: 'Internal gateway error' },
        latency: Date.now() - startTime,
        cacheStatus,
        gatewayProcessingTime: processingTime,
        upstreamResponseTime: upstreamTime,
        totalTime: Date.now() - startTime
      };
    }
  }

  /**
   * Execute middleware
   */
  private async executeMiddleware(
    middleware: EdgeMiddleware,
    request: APIRequest,
    route: EdgeRoute,
    gateway: EdgeAPIGateway
  ): Promise<void> {
    switch (middleware.type) {
      case 'auth':
        await this.executeAuthMiddleware(request, route, middleware.config);
        break;
      case 'rateLimit':
        await this.executeRateLimitMiddleware(request, route, gateway);
        break;
      case 'logging':
        this.executeLoggingMiddleware(request, middleware.config);
        break;
      case 'metrics':
        this.executeMetricsMiddleware(request, gateway);
        break;
      default:
        console.warn(`Unknown middleware type: ${middleware.type}`);
    }
  }

  /**
   * Execute authentication middleware
   */
  private async executeAuthMiddleware(
    request: APIRequest,
    route: EdgeRoute,
    config: Record<string, any>
  ): Promise<void> {
    if (!route.authentication.required) return;

    const authHeader = request.headers.authorization;
    if (!authHeader) {
      throw new Error('Authentication required');
    }

    // Simplified JWT validation
    if (route.authentication.methods.includes('jwt')) {
      if (!authHeader.startsWith('Bearer ')) {
        throw new Error('Invalid authentication format');
      }
      // In production, this would validate the JWT
    }
  }

  /**
   * Execute rate limiting middleware
   */
  private async executeRateLimitMiddleware(
    request: APIRequest,
    route: EdgeRoute,
    gateway: EdgeAPIGateway
  ): Promise<void> {
    if (!route.rateLimit.enabled) return;

    // Simplified rate limiting check
    const key = `${request.clientIP}:${route.path}`;
    const now = Date.now();
    const windowStart = now - (60 * 1000); // 1 minute window
    
    const recentRequests = this.requestLog.filter(r => 
      r.clientIP === request.clientIP &&
      r.path === request.path &&
      r.timestamp.getTime() > windowStart
    );

    if (recentRequests.length >= route.rateLimit.requestsPerMinute) {
      throw new Error('Rate limit exceeded');
    }
  }

  /**
   * Execute logging middleware
   */
  private executeLoggingMiddleware(request: APIRequest, config: Record<string, any>): void {
    if (config.level === 'debug') {
      console.log(`API Request: ${request.method} ${request.path}`, {
        id: request.id,
        clientIP: request.clientIP,
        userAgent: request.userAgent,
        tenantId: request.tenantId
      });
    }
  }

  /**
   * Execute metrics middleware
   */
  private executeMetricsMiddleware(request: APIRequest, gateway: EdgeAPIGateway): void {
    gateway.metrics.requestsPerSecond += 1;
    // Additional metrics collection would go here
  }

  /**
   * Check cache for response
   */
  private async checkCache(
    request: APIRequest,
    route: EdgeRoute,
    gateway: EdgeAPIGateway
  ): Promise<{ headers: Record<string, string>; body: any } | null> {
    // Simplified cache check
    const cacheKey = `${request.method}:${request.path}:${JSON.stringify(request.query)}`;
    
    // In production, this would check Redis or similar cache
    return null; // Cache miss for simulation
  }

  /**
   * Cache response
   */
  private async cacheResponse(
    request: APIRequest,
    route: EdgeRoute,
    response: any,
    gateway: EdgeAPIGateway
  ): Promise<void> {
    // Simplified cache storage
    const cacheKey = `${request.method}:${request.path}:${JSON.stringify(request.query)}`;
    
    // In production, this would store in Redis with TTL
    console.log(`Caching response for key: ${cacheKey}`);
  }

  /**
   * Forward request to upstream service
   */
  private async forwardToUpstream(request: APIRequest, route: EdgeRoute): Promise<any> {
    // Simulate upstream call
    const delay = 100 + Math.random() * 200; // 100-300ms
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Simulate occasional errors
    if (Math.random() < 0.05) { // 5% error rate
      return {
        statusCode: 500,
        headers: { 'content-type': 'application/json' },
        body: { error: 'Upstream service error' }
      };
    }

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: { message: 'Success', data: { path: request.path } }
    };
  }

  /**
   * Transform response based on route configuration
   */
  private async transformResponse(response: any, route: EdgeRoute): Promise<any> {
    if (!route.transformations?.response) return response;

    const transformation = route.transformations.response;
    let transformedResponse = { ...response };

    // Apply header transformations
    if (transformation.headers) {
      if (transformation.headers.add) {
        transformedResponse.headers = {
          ...transformedResponse.headers,
          ...transformation.headers.add
        };
      }
      
      if (transformation.headers.remove) {
        for (const header of transformation.headers.remove) {
          delete transformedResponse.headers[header];
        }
      }
    }

    // Apply status code mappings
    if (transformation.statusCode?.map) {
      const mappedStatus = transformation.statusCode.map[response.statusCode];
      if (mappedStatus) {
        transformedResponse.statusCode = mappedStatus;
      }
    }

    return transformedResponse;
  }

  /**
   * Find matching route for request
   */
  private findMatchingRoute(path: string, method: string): EdgeRoute | null {
    const exactMatch = this.globalRoutes.get(`${method}:${path}`);
    if (exactMatch) return exactMatch;

    // Check for pattern matches
    for (const [routeKey, route] of this.globalRoutes.entries()) {
      const [routeMethod, routePath] = routeKey.split(':');
      if (routeMethod === method && this.pathMatches(path, routePath)) {
        return route;
      }
    }

    return null;
  }

  /**
   * Check if path matches route pattern
   */
  private pathMatches(path: string, pattern: string): boolean {
    // Simple pattern matching (in production, use more sophisticated routing)
    const patternRegex = pattern.replace(/:\w+/g, '[^/]+').replace(/\*/g, '.*');
    return new RegExp(`^${patternRegex}$`).test(path);
  }

  /**
   * Select optimal gateway for request
   */
  private async selectOptimalGateway(
    request: APIRequest,
    route: EdgeRoute,
    clientLocation?: {
      country: string;
      region: string;
      coordinates: { latitude: number; longitude: number };
    }
  ): Promise<RoutingDecision> {
    const availableGateways = Array.from(this.gateways.values())
      .filter(g => g.status === 'active');

    if (availableGateways.length === 0) {
      throw new Error('No available gateways');
    }

    const startTime = Date.now();
    let selectedGateway: EdgeAPIGateway;
    let reason: string;

    if (clientLocation) {
      // Select based on geographic proximity and health
      let bestScore = -1;
      selectedGateway = availableGateways[0];
      
      for (const gateway of availableGateways) {
        const healthScore = this.calculateGatewayHealth(gateway);
        const proximityScore = this.calculateProximityScore(gateway, clientLocation);
        const totalScore = healthScore * 0.7 + proximityScore * 0.3;
        
        if (totalScore > bestScore) {
          bestScore = totalScore;
          selectedGateway = gateway;
        }
      }
      
      reason = 'Geographic proximity and health optimization';
    } else {
      // Select based on health and load
      selectedGateway = availableGateways.reduce((best, current) => {
        const bestHealth = this.calculateGatewayHealth(best);
        const currentHealth = this.calculateGatewayHealth(current);
        return currentHealth > bestHealth ? current : best;
      });
      
      reason = 'Health and load balancing';
    }

    const routingLatency = Date.now() - startTime;
    const healthScore = this.calculateGatewayHealth(selectedGateway);
    
    return {
      selectedGateway: selectedGateway.id,
      reason,
      alternativeGateways: availableGateways
        .filter(g => g.id !== selectedGateway.id)
        .slice(0, 2)
        .map(g => g.id),
      routingLatency,
      healthScore
    };
  }

  /**
   * Calculate gateway health score
   */
  private calculateGatewayHealth(gateway: EdgeAPIGateway): number {
    const cpuScore = Math.max(0, 100 - gateway.metrics.cpuUsage);
    const memoryScore = Math.max(0, 100 - gateway.metrics.memoryUsage);
    const latencyScore = Math.max(0, 100 - gateway.metrics.averageLatency / 10);
    const errorScore = Math.max(0, 100 - gateway.metrics.errorRate * 100);
    
    return (cpuScore + memoryScore + latencyScore + errorScore) / 4;
  }

  /**
   * Calculate proximity score (simplified)
   */
  private calculateProximityScore(
    gateway: EdgeAPIGateway,
    location: { coordinates: { latitude: number; longitude: number } }
  ): number {
    // Simplified: assume each region has representative coordinates
    const regionCoords: Record<string, { latitude: number; longitude: number }> = {
      'us-east-1': { latitude: 38.13, longitude: -78.45 },
      'us-west-1': { latitude: 37.35, longitude: -121.96 },
      'eu-west-1': { latitude: 53.41, longitude: -8.24 },
      'ap-southeast-1': { latitude: 1.37, longitude: 103.8 },
      'ap-northeast-1': { latitude: 35.41, longitude: 139.42 }
    };

    const gatewayCoords = regionCoords[gateway.region];
    if (!gatewayCoords) return 50; // Default score

    const distance = this.calculateDistance(location.coordinates, gatewayCoords);
    return Math.max(0, 100 - distance / 100); // Normalize distance to score
  }

  /**
   * Calculate geographic distance
   */
  private calculateDistance(
    point1: { latitude: number; longitude: number },
    point2: { latitude: number; longitude: number }
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
    const dLon = (point2.longitude - point1.longitude) * Math.PI / 180;
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Initialize edge gateways
   */
  private initializeEdgeGateways(): void {
    const gateways: EdgeAPIGateway[] = [
      {
        id: 'gateway-us-east-1',
        region: 'us-east-1',
        endpoint: 'https://api-us-east-1.nextportal.com',
        status: 'active',
        capabilities: {
          authentication: true,
          rateLimit: true,
          caching: true,
          transformation: true,
          analytics: true
        },
        metrics: {
          requestsPerSecond: 0,
          averageLatency: 150,
          errorRate: 0.02,
          cpuUsage: 45,
          memoryUsage: 60,
          uptime: 99.9,
          lastHealthCheck: new Date()
        },
        routes: [],
        rateLimit: {
          enabled: true,
          rules: []
        },
        cache: {
          enabled: true,
          policies: []
        }
      },
      {
        id: 'gateway-eu-west-1',
        region: 'eu-west-1',
        endpoint: 'https://api-eu-west-1.nextportal.com',
        status: 'active',
        capabilities: {
          authentication: true,
          rateLimit: true,
          caching: true,
          transformation: true,
          analytics: true
        },
        metrics: {
          requestsPerSecond: 0,
          averageLatency: 120,
          errorRate: 0.015,
          cpuUsage: 38,
          memoryUsage: 55,
          uptime: 99.95,
          lastHealthCheck: new Date()
        },
        routes: [],
        rateLimit: {
          enabled: true,
          rules: []
        },
        cache: {
          enabled: true,
          policies: []
        }
      },
      {
        id: 'gateway-ap-southeast-1',
        region: 'ap-southeast-1',
        endpoint: 'https://api-ap-southeast-1.nextportal.com',
        status: 'active',
        capabilities: {
          authentication: true,
          rateLimit: true,
          caching: true,
          transformation: true,
          analytics: true
        },
        metrics: {
          requestsPerSecond: 0,
          averageLatency: 180,
          errorRate: 0.025,
          cpuUsage: 52,
          memoryUsage: 65,
          uptime: 99.8,
          lastHealthCheck: new Date()
        },
        routes: [],
        rateLimit: {
          enabled: true,
          rules: []
        },
        cache: {
          enabled: true,
          policies: []
        }
      }
    ];

    for (const gateway of gateways) {
      this.gateways.set(gateway.id, gateway);
    }

    console.log(`Initialized ${this.gateways.size} edge API gateways`);
  }

  /**
   * Initialize global routes
   */
  private initializeGlobalRoutes(): void {
    const routes: EdgeRoute[] = [
      {
        id: 'plugins-list',
        path: '/api/plugins',
        method: 'GET',
        upstream: {
          service: 'plugin-service',
          url: 'http://plugin-service:3000',
          timeout: 5000,
          retries: 2
        },
        middleware: [
          { type: 'auth', enabled: true, config: {}, order: 1 },
          { type: 'rateLimit', enabled: true, config: {}, order: 2 },
          { type: 'cache', enabled: true, config: {}, order: 3 },
          { type: 'logging', enabled: true, config: { level: 'info' }, order: 4 }
        ],
        cache: {
          enabled: true,
          ttl: 300,
          varyBy: ['tenant-id']
        },
        rateLimit: {
          enabled: true,
          requestsPerMinute: 100,
          burstSize: 20
        },
        authentication: {
          required: true,
          methods: ['jwt'],
          scopes: ['plugins:read']
        },
        transformations: {}
      },
      {
        id: 'catalog-entities',
        path: '/api/catalog/entities',
        method: 'GET',
        upstream: {
          service: 'catalog-service',
          url: 'http://catalog-service:3000',
          timeout: 3000,
          retries: 1
        },
        middleware: [
          { type: 'auth', enabled: true, config: {}, order: 1 },
          { type: 'cache', enabled: true, config: {}, order: 2 },
          { type: 'logging', enabled: true, config: { level: 'debug' }, order: 3 }
        ],
        cache: {
          enabled: true,
          ttl: 600,
          varyBy: ['tenant-id', 'user-id']
        },
        rateLimit: {
          enabled: true,
          requestsPerMinute: 200,
          burstSize: 50
        },
        authentication: {
          required: true,
          methods: ['jwt', 'api_key']
        },
        transformations: {}
      }
    ];

    for (const route of routes) {
      this.registerRoute(route);
    }
  }

  /**
   * Start health checks
   */
  private startHealthChecks(): void {
    setInterval(() => {
      for (const gateway of this.gateways.values()) {
        // Simulate health check
        const healthScore = this.calculateGatewayHealth(gateway);
        
        if (healthScore < 30) {
          gateway.status = 'degraded';
        } else if (healthScore < 10) {
          gateway.status = 'offline';
        } else {
          gateway.status = 'active';
        }
        
        gateway.metrics.lastHealthCheck = new Date();
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    setInterval(() => {
      for (const gateway of this.gateways.values()) {
        // Simulate metric updates
        gateway.metrics.requestsPerSecond = Math.max(0, 
          gateway.metrics.requestsPerSecond + (Math.random() - 0.5) * 10
        );
        
        gateway.metrics.averageLatency = Math.max(50,
          gateway.metrics.averageLatency + (Math.random() - 0.5) * 20
        );
        
        gateway.metrics.cpuUsage = Math.max(10, Math.min(90,
          gateway.metrics.cpuUsage + (Math.random() - 0.5) * 5
        ));
        
        gateway.metrics.memoryUsage = Math.max(20, Math.min(85,
          gateway.metrics.memoryUsage + (Math.random() - 0.5) * 3
        ));
      }
    }, 10000); // Every 10 seconds
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get system statistics
   */
  getStatistics(): {
    totalGateways: number;
    activeGateways: number;
    totalRoutes: number;
    totalRequests: number;
    avgResponseTime: number;
    errorRate: number;
    cacheHitRate: number;
  } {
    const analytics = this.getGatewayAnalytics();
    
    return {
      totalGateways: this.gateways.size,
      activeGateways: Array.from(this.gateways.values()).filter(g => g.status === 'active').length,
      totalRoutes: this.globalRoutes.size,
      totalRequests: analytics.totalRequests,
      avgResponseTime: analytics.avgLatency,
      errorRate: analytics.errorRate,
      cacheHitRate: analytics.cacheHitRate
    };
  }
}

// Global edge API gateway manager instance
export const edgeAPIGateway = new EdgeAPIGatewayManager();

export default edgeAPIGateway;