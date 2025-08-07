import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

// Rate Limiting Implementation
interface RateLimitEntry {
  count: number;
  resetTime: number;
  blocked: boolean;
}

class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private windowSize: number = 60000; // 1 minute window
  private maxRequests: number = 100; // 100 requests per minute
  private cleanupInterval: NodeJS.Timeout;

  constructor(windowSize: number = 60000, maxRequests: number = 100) {
    this.windowSize = windowSize;
    this.maxRequests = maxRequests;
    
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  isAllowed(identifier: string, customLimit?: number): boolean {
    const now = Date.now();
    const limit = customLimit || this.maxRequests;
    let entry = this.limits.get(identifier);

    if (!entry || now > entry.resetTime) {
      // Create new entry or reset expired one
      entry = {
        count: 1,
        resetTime: now + this.windowSize,
        blocked: false
      };
      this.limits.set(identifier, entry);
      return true;
    }

    if (entry.blocked && now < entry.resetTime) {
      return false;
    }

    entry.count++;
    
    if (entry.count > limit) {
      entry.blocked = true;
      return false;
    }

    return true;
  }

  getRemainingRequests(identifier: string): number {
    const entry = this.limits.get(identifier);
    if (!entry) return this.maxRequests;
    
    return Math.max(0, this.maxRequests - entry.count);
  }

  getResetTime(identifier: string): number {
    const entry = this.limits.get(identifier);
    return entry?.resetTime || Date.now() + this.windowSize;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.limits.entries()) {
      if (now > entry.resetTime) {
        this.limits.delete(key);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Circuit Breaker Implementation
enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

interface CircuitConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
}

interface ServiceStats {
  requests: number;
  failures: number;
  successes: number;
  lastFailureTime: number;
  consecutiveFailures: number;
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private stats: Map<string, ServiceStats> = new Map();
  private config: CircuitConfig;
  private stateChangeTime: number = Date.now();

  constructor(config: Partial<CircuitConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold || 5,
      recoveryTimeout: config.recoveryTimeout || 60000, // 1 minute
      monitoringPeriod: config.monitoringPeriod || 300000 // 5 minutes
    };
  }

  async execute<T>(
    serviceId: string,
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    const stats = this.getStats(serviceId);
    
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptRecovery()) {
        this.state = CircuitState.HALF_OPEN;
        this.stateChangeTime = Date.now();
      } else {
        if (fallback) {
          return await fallback();
        }
        throw new Error(`Circuit breaker is OPEN for service ${serviceId}`);
      }
    }

    try {
      const result = await operation();
      this.recordSuccess(serviceId);
      
      if (this.state === CircuitState.HALF_OPEN) {
        this.state = CircuitState.CLOSED;
        this.stateChangeTime = Date.now();
      }
      
      return result;
    } catch (error) {
      this.recordFailure(serviceId);
      
      if (this.shouldOpenCircuit(serviceId)) {
        this.state = CircuitState.OPEN;
        this.stateChangeTime = Date.now();
      }
      
      if (fallback) {
        return await fallback();
      }
      
      throw error;
    }
  }

  private getStats(serviceId: string): ServiceStats {
    if (!this.stats.has(serviceId)) {
      this.stats.set(serviceId, {
        requests: 0,
        failures: 0,
        successes: 0,
        lastFailureTime: 0,
        consecutiveFailures: 0
      });
    }
    return this.stats.get(serviceId)!;
  }

  private recordSuccess(serviceId: string): void {
    const stats = this.getStats(serviceId);
    stats.requests++;
    stats.successes++;
    stats.consecutiveFailures = 0;
  }

  private recordFailure(serviceId: string): void {
    const stats = this.getStats(serviceId);
    stats.requests++;
    stats.failures++;
    stats.consecutiveFailures++;
    stats.lastFailureTime = Date.now();
  }

  private shouldOpenCircuit(serviceId: string): boolean {
    const stats = this.getStats(serviceId);
    return stats.consecutiveFailures >= this.config.failureThreshold;
  }

  private shouldAttemptRecovery(): boolean {
    return Date.now() - this.stateChangeTime >= this.config.recoveryTimeout;
  }

  getState(): CircuitState {
    return this.state;
  }

  getServiceStats(serviceId: string): ServiceStats {
    return this.getStats(serviceId);
  }

  reset(serviceId?: string): void {
    if (serviceId) {
      this.stats.delete(serviceId);
    } else {
      this.stats.clear();
      this.state = CircuitState.CLOSED;
      this.stateChangeTime = Date.now();
    }
  }
}

// Load Balancer Implementation
enum LoadBalancingStrategy {
  ROUND_ROBIN = 'ROUND_ROBIN',
  LEAST_CONNECTIONS = 'LEAST_CONNECTIONS',
  WEIGHTED_ROUND_ROBIN = 'WEIGHTED_ROUND_ROBIN',
  RANDOM = 'RANDOM',
  HEALTH_BASED = 'HEALTH_BASED'
}

interface ServiceEndpoint {
  id: string;
  url: string;
  weight: number;
  healthy: boolean;
  activeConnections: number;
  responseTime: number;
  lastHealthCheck: number;
}

class LoadBalancer {
  private endpoints: Map<string, ServiceEndpoint[]> = new Map();
  private roundRobinCounters: Map<string, number> = new Map();
  private strategy: LoadBalancingStrategy;

  constructor(strategy: LoadBalancingStrategy = LoadBalancingStrategy.ROUND_ROBIN) {
    this.strategy = strategy;
    
    // Start health checking
    setInterval(() => {
      this.performHealthChecks();
    }, 30000); // Health check every 30 seconds
  }

  addService(serviceId: string, endpoints: Omit<ServiceEndpoint, 'activeConnections' | 'lastHealthCheck'>[]): void {
    const serviceEndpoints = endpoints.map(ep => ({
      ...ep,
      activeConnections: 0,
      lastHealthCheck: Date.now()
    }));
    
    this.endpoints.set(serviceId, serviceEndpoints);
    this.roundRobinCounters.set(serviceId, 0);
  }

  getEndpoint(serviceId: string): ServiceEndpoint | null {
    const endpoints = this.endpoints.get(serviceId);
    if (!endpoints || endpoints.length === 0) {
      return null;
    }

    const healthyEndpoints = endpoints.filter(ep => ep.healthy);
    if (healthyEndpoints.length === 0) {
      // Return any endpoint if none are healthy (desperate fallback)
      return endpoints[0];
    }

    switch (this.strategy) {
      case LoadBalancingStrategy.ROUND_ROBIN:
        return this.roundRobinSelect(serviceId, healthyEndpoints);
      
      case LoadBalancingStrategy.LEAST_CONNECTIONS:
        return this.leastConnectionsSelect(healthyEndpoints);
      
      case LoadBalancingStrategy.WEIGHTED_ROUND_ROBIN:
        return this.weightedRoundRobinSelect(serviceId, healthyEndpoints);
      
      case LoadBalancingStrategy.RANDOM:
        return healthyEndpoints[Math.floor(Math.random() * healthyEndpoints.length)];
      
      case LoadBalancingStrategy.HEALTH_BASED:
        return this.healthBasedSelect(healthyEndpoints);
      
      default:
        return healthyEndpoints[0];
    }
  }

  private roundRobinSelect(serviceId: string, endpoints: ServiceEndpoint[]): ServiceEndpoint {
    const counter = this.roundRobinCounters.get(serviceId) || 0;
    const selected = endpoints[counter % endpoints.length];
    this.roundRobinCounters.set(serviceId, counter + 1);
    return selected;
  }

  private leastConnectionsSelect(endpoints: ServiceEndpoint[]): ServiceEndpoint {
    return endpoints.reduce((min, current) => 
      current.activeConnections < min.activeConnections ? current : min
    );
  }

  private weightedRoundRobinSelect(serviceId: string, endpoints: ServiceEndpoint[]): ServiceEndpoint {
    const totalWeight = endpoints.reduce((sum, ep) => sum + ep.weight, 0);
    if (totalWeight === 0) return endpoints[0];

    const counter = this.roundRobinCounters.get(serviceId) || 0;
    let accumulatedWeight = 0;
    const targetWeight = counter % totalWeight;

    for (const endpoint of endpoints) {
      accumulatedWeight += endpoint.weight;
      if (targetWeight < accumulatedWeight) {
        this.roundRobinCounters.set(serviceId, counter + 1);
        return endpoint;
      }
    }

    return endpoints[0];
  }

  private healthBasedSelect(endpoints: ServiceEndpoint[]): ServiceEndpoint {
    // Select based on response time and health score
    const scored = endpoints.map(ep => ({
      endpoint: ep,
      score: this.calculateHealthScore(ep)
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored[0].endpoint;
  }

  private calculateHealthScore(endpoint: ServiceEndpoint): number {
    let score = 100;
    
    // Penalize high response times
    if (endpoint.responseTime > 1000) score -= 30;
    else if (endpoint.responseTime > 500) score -= 15;
    
    // Penalize high connection count
    if (endpoint.activeConnections > 50) score -= 20;
    else if (endpoint.activeConnections > 20) score -= 10;
    
    // Penalize stale health checks
    const staleness = Date.now() - endpoint.lastHealthCheck;
    if (staleness > 60000) score -= 25; // > 1 minute
    
    return Math.max(0, score);
  }

  incrementConnections(serviceId: string, endpointId: string): void {
    const endpoints = this.endpoints.get(serviceId);
    if (endpoints) {
      const endpoint = endpoints.find(ep => ep.id === endpointId);
      if (endpoint) {
        endpoint.activeConnections++;
      }
    }
  }

  decrementConnections(serviceId: string, endpointId: string): void {
    const endpoints = this.endpoints.get(serviceId);
    if (endpoints) {
      const endpoint = endpoints.find(ep => ep.id === endpointId);
      if (endpoint) {
        endpoint.activeConnections = Math.max(0, endpoint.activeConnections - 1);
      }
    }
  }

  updateResponseTime(serviceId: string, endpointId: string, responseTime: number): void {
    const endpoints = this.endpoints.get(serviceId);
    if (endpoints) {
      const endpoint = endpoints.find(ep => ep.id === endpointId);
      if (endpoint) {
        // Exponential moving average
        endpoint.responseTime = endpoint.responseTime * 0.7 + responseTime * 0.3;
      }
    }
  }

  private async performHealthChecks(): Promise<void> {
    for (const [serviceId, endpoints] of this.endpoints.entries()) {
      for (const endpoint of endpoints) {
        try {
          const startTime = Date.now();
          const response = await fetch(`${endpoint.url}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000) // 5 second timeout
          });
          
          const responseTime = Date.now() - startTime;
          endpoint.healthy = response.ok;
          endpoint.responseTime = responseTime;
          endpoint.lastHealthCheck = Date.now();
        } catch (error) {
          endpoint.healthy = false;
          endpoint.lastHealthCheck = Date.now();
        }
      }
    }
  }

  getServiceStats(serviceId: string): ServiceEndpoint[] | undefined {
    return this.endpoints.get(serviceId);
  }
}

// Request/Response Transformation
interface TransformationRule {
  id: string;
  serviceId: string;
  type: 'request' | 'response';
  path: string;
  method?: string;
  transform: (data: any) => any;
  condition?: (data: any) => boolean;
}

class RequestTransformer {
  private rules: Map<string, TransformationRule[]> = new Map();

  addRule(rule: TransformationRule): void {
    const serviceRules = this.rules.get(rule.serviceId) || [];
    serviceRules.push(rule);
    this.rules.set(rule.serviceId, serviceRules);
  }

  transformRequest(serviceId: string, path: string, method: string, data: any): any {
    const rules = this.rules.get(serviceId) || [];
    const applicableRules = rules.filter(rule => 
      rule.type === 'request' &&
      this.pathMatches(rule.path, path) &&
      (!rule.method || rule.method.toLowerCase() === method.toLowerCase()) &&
      (!rule.condition || rule.condition(data))
    );

    let transformedData = data;
    for (const rule of applicableRules) {
      transformedData = rule.transform(transformedData);
    }

    return transformedData;
  }

  transformResponse(serviceId: string, path: string, method: string, data: any): any {
    const rules = this.rules.get(serviceId) || [];
    const applicableRules = rules.filter(rule => 
      rule.type === 'response' &&
      this.pathMatches(rule.path, path) &&
      (!rule.method || rule.method.toLowerCase() === method.toLowerCase()) &&
      (!rule.condition || rule.condition(data))
    );

    let transformedData = data;
    for (const rule of applicableRules) {
      transformedData = rule.transform(transformedData);
    }

    return transformedData;
  }

  private pathMatches(pattern: string, path: string): boolean {
    // Simple glob pattern matching
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  removeRule(ruleId: string): void {
    for (const [serviceId, rules] of this.rules.entries()) {
      const filteredRules = rules.filter(rule => rule.id !== ruleId);
      this.rules.set(serviceId, filteredRules);
    }
  }

  getRules(serviceId?: string): TransformationRule[] {
    if (serviceId) {
      return this.rules.get(serviceId) || [];
    }
    
    const allRules: TransformationRule[] = [];
    for (const rules of this.rules.values()) {
      allRules.push(...rules);
    }
    return allRules;
  }
}

// Authentication & Authorization
interface AuthConfig {
  requireAuth: boolean;
  allowedRoles: string[];
  allowedApiKeys: string[];
}

class AuthManager {
  private configs: Map<string, AuthConfig> = new Map();

  setAuthConfig(serviceId: string, config: AuthConfig): void {
    this.configs.set(serviceId, config);
  }

  async authenticate(serviceId: string, request: NextRequest): Promise<{authorized: boolean; user?: any; error?: string}> {
    const config = this.configs.get(serviceId);
    if (!config || !config.requireAuth) {
      return { authorized: true };
    }

    // Check API Key authentication
    const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '');
    if (apiKey && config.allowedApiKeys.includes(apiKey)) {
      return { authorized: true, user: { type: 'api-key', key: apiKey } };
    }

    // Check JWT token (simplified)
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        // In a real implementation, you'd verify the JWT properly
        const payload = JSON.parse(atob(token.split('.')[1]));
        
        if (config.allowedRoles.length === 0 || config.allowedRoles.some(role => payload.roles?.includes(role))) {
          return { authorized: true, user: payload };
        } else {
          return { authorized: false, error: 'Insufficient privileges' };
        }
      } catch (error) {
        return { authorized: false, error: 'Invalid token' };
      }
    }

    return { authorized: false, error: 'Authentication required' };
  }
}

// API Versioning
interface VersionConfig {
  version: string;
  deprecated: boolean;
  supportedUntil?: Date;
  migrationGuide?: string;
}

class VersionManager {
  private versions: Map<string, VersionConfig[]> = new Map();

  addVersion(serviceId: string, config: VersionConfig): void {
    const serviceVersions = this.versions.get(serviceId) || [];
    serviceVersions.push(config);
    this.versions.set(serviceId, serviceVersions);
  }

  getVersion(serviceId: string, requestedVersion?: string): VersionConfig | null {
    const versions = this.versions.get(serviceId) || [];
    
    if (requestedVersion) {
      return versions.find(v => v.version === requestedVersion) || null;
    }
    
    // Return latest non-deprecated version
    const activeVersions = versions.filter(v => !v.deprecated);
    return activeVersions.sort((a, b) => b.version.localeCompare(a.version))[0] || null;
  }

  isVersionSupported(serviceId: string, version: string): boolean {
    const versionConfig = this.getVersion(serviceId, version);
    if (!versionConfig) return false;
    
    if (versionConfig.supportedUntil && new Date() > versionConfig.supportedUntil) {
      return false;
    }
    
    return true;
  }

  getVersionHeaders(serviceId: string, version: string): Record<string, string> {
    const versionConfig = this.getVersion(serviceId, version);
    const headers: Record<string, string> = {
      'X-API-Version': version
    };
    
    if (versionConfig?.deprecated) {
      headers['X-API-Deprecated'] = 'true';
      if (versionConfig.migrationGuide) {
        headers['X-Migration-Guide'] = versionConfig.migrationGuide;
      }
    }
    
    return headers;
  }
}

// Global instances
const rateLimiter = new RateLimiter();
const circuitBreaker = new CircuitBreaker();
const loadBalancer = new LoadBalancer(LoadBalancingStrategy.HEALTH_BASED);
const requestTransformer = new RequestTransformer();
const authManager = new AuthManager();
const versionManager = new VersionManager();

// Initialize some demo services and configurations
loadBalancer.addService('backstage-api', [
  { id: 'backstage-1', url: 'http://localhost:7007', weight: 3, healthy: true, responseTime: 100 },
  { id: 'backstage-2', url: 'http://localhost:7008', weight: 2, healthy: true, responseTime: 150 },
  { id: 'backstage-3', url: 'http://localhost:7009', weight: 1, healthy: false, responseTime: 300 }
]);

// Add some transformation rules
requestTransformer.addRule({
  id: 'add-timestamp',
  serviceId: 'backstage-api',
  type: 'request',
  path: '/api/*',
  transform: (data) => ({
    ...data,
    timestamp: new Date().toISOString(),
    gateway_version: '1.0.0'
  })
});

requestTransformer.addRule({
  id: 'normalize-response',
  serviceId: 'backstage-api',
  type: 'response',
  path: '/api/*',
  transform: (data) => ({
    success: true,
    data,
    metadata: {
      processed_by: 'plugin-gateway',
      processed_at: new Date().toISOString()
    }
  })
});

// Configure authentication
authManager.setAuthConfig('backstage-api', {
  requireAuth: true,
  allowedRoles: ['admin', 'developer', 'user'],
  allowedApiKeys: ['demo-api-key-123', 'admin-key-456']
});

// Add API versions
versionManager.addVersion('backstage-api', {
  version: '1.0.0',
  deprecated: false
});

versionManager.addVersion('backstage-api', {
  version: '0.9.0',
  deprecated: true,
  supportedUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  migrationGuide: 'https://docs.example.com/migration/v1.0.0'
});

export async function GET(req: NextRequest) {
  try {
    const searchParams = new URL(req.url).searchParams;
    const action = searchParams.get('action') || 'proxy';
    const serviceId = searchParams.get('service') || 'backstage-api';
    const path = searchParams.get('path') || '/api/catalog/entities';
    const version = searchParams.get('version');

    // Get client identifier for rate limiting
    const clientId = req.headers.get('x-client-id') || 
                    req.headers.get('x-forwarded-for') || 
                    req.ip || 
                    'anonymous';

    switch (action) {
      case 'status':
        return NextResponse.json({
          success: true,
          data: {
            services: Object.fromEntries(
              Array.from(loadBalancer.getServiceStats(serviceId) || []).map(ep => [
                ep.id, {
                  healthy: ep.healthy,
                  activeConnections: ep.activeConnections,
                  responseTime: ep.responseTime,
                  lastHealthCheck: ep.lastHealthCheck
                }
              ])
            ),
            circuitBreaker: {
              state: circuitBreaker.getState(),
              stats: circuitBreaker.getServiceStats(serviceId)
            },
            rateLimiter: {
              remaining: rateLimiter.getRemainingRequests(clientId),
              resetTime: rateLimiter.getResetTime(clientId)
            }
          }
        });

      case 'health':
        const healthEndpoint = loadBalancer.getEndpoint(serviceId);
        if (!healthEndpoint) {
          return NextResponse.json(
            { success: false, error: 'No healthy endpoints available' },
            { status: 503 }
          );
        }

        return NextResponse.json({
          success: true,
          data: {
            service: serviceId,
            endpoint: healthEndpoint.id,
            healthy: healthEndpoint.healthy,
            responseTime: healthEndpoint.responseTime
          }
        });

      case 'proxy':
      default:
        // Rate limiting check
        if (!rateLimiter.isAllowed(clientId)) {
          return NextResponse.json(
            { 
              error: 'Rate limit exceeded',
              retryAfter: Math.ceil((rateLimiter.getResetTime(clientId) - Date.now()) / 1000)
            },
            { 
              status: 429,
              headers: {
                'Retry-After': Math.ceil((rateLimiter.getResetTime(clientId) - Date.now()) / 1000).toString(),
                'X-RateLimit-Remaining': rateLimiter.getRemainingRequests(clientId).toString()
              }
            }
          );
        }

        // Authentication check
        const authResult = await authManager.authenticate(serviceId, req);
        if (!authResult.authorized) {
          return NextResponse.json(
            { error: authResult.error || 'Unauthorized' },
            { status: 401 }
          );
        }

        // Version check
        const requestedVersion = version || req.headers.get('x-api-version') || '1.0.0';
        if (!versionManager.isVersionSupported(serviceId, requestedVersion)) {
          return NextResponse.json(
            { error: 'Unsupported API version' },
            { status: 400 }
          );
        }

        // Load balancing - get healthy endpoint
        const endpoint = loadBalancer.getEndpoint(serviceId);
        if (!endpoint) {
          return NextResponse.json(
            { error: 'No healthy endpoints available' },
            { status: 503 }
          );
        }

        // Circuit breaker execution
        try {
          const result = await circuitBreaker.execute(
            serviceId,
            async () => {
              const startTime = Date.now();
              loadBalancer.incrementConnections(serviceId, endpoint.id);

              try {
                // Transform request data
                const searchParamsObj = Object.fromEntries(searchParams.entries());
                const transformedParams = requestTransformer.transformRequest(
                  serviceId, 
                  path, 
                  'GET', 
                  searchParamsObj
                );

                // Build target URL
                const targetUrl = new URL(path, endpoint.url);
                Object.entries(transformedParams).forEach(([key, value]) => {
                  if (key !== 'action' && key !== 'service' && key !== 'path' && key !== 'version') {
                    targetUrl.searchParams.set(key, String(value));
                  }
                });

                // Forward request
                const response = await fetch(targetUrl.toString(), {
                  method: 'GET',
                  headers: {
                    ...Object.fromEntries(req.headers.entries()),
                    'X-Forwarded-By': 'plugin-gateway',
                    'X-Client-Id': clientId,
                    ...versionManager.getVersionHeaders(serviceId, requestedVersion)
                  },
                  signal: AbortSignal.timeout(30000) // 30 second timeout
                });

                const responseTime = Date.now() - startTime;
                loadBalancer.updateResponseTime(serviceId, endpoint.id, responseTime);

                if (!response.ok) {
                  throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const responseData = await response.json();
                
                // Transform response data
                const transformedResponse = requestTransformer.transformResponse(
                  serviceId,
                  path,
                  'GET',
                  responseData
                );

                return {
                  data: transformedResponse,
                  status: response.status,
                  headers: Object.fromEntries(response.headers.entries()),
                  endpoint: endpoint.id,
                  responseTime
                };

              } finally {
                loadBalancer.decrementConnections(serviceId, endpoint.id);
              }
            },
            // Fallback function
            async () => {
              return {
                data: { error: 'Service temporarily unavailable' },
                status: 503,
                headers: {},
                endpoint: 'fallback',
                responseTime: 0
              };
            }
          );

          const responseHeaders = new Headers();
          responseHeaders.set('X-Gateway-Endpoint', result.endpoint);
          responseHeaders.set('X-Response-Time', result.responseTime.toString());
          responseHeaders.set('X-Circuit-State', circuitBreaker.getState());
          responseHeaders.set('X-RateLimit-Remaining', rateLimiter.getRemainingRequests(clientId).toString());
          
          // Add version headers
          const versionHeaders = versionManager.getVersionHeaders(serviceId, requestedVersion);
          Object.entries(versionHeaders).forEach(([key, value]) => {
            responseHeaders.set(key, value);
          });

          return NextResponse.json(result.data, {
            status: result.status,
            headers: responseHeaders
          });

        } catch (error) {
          console.error('Gateway proxy error:', error);
          return NextResponse.json(
            { 
              error: 'Gateway error',
              details: error instanceof Error ? error.message : 'Unknown error',
              endpoint: endpoint.id,
              circuitState: circuitBreaker.getState()
            },
            { status: 502 }
          );
        }
    }
  } catch (error) {
    console.error('Plugin gateway error:', error);
    return NextResponse.json(
      { 
        error: 'Gateway error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, serviceId, data } = body;

    const clientId = req.headers.get('x-client-id') || 
                    req.headers.get('x-forwarded-for') || 
                    req.ip || 
                    'anonymous';

    switch (action) {
      case 'configure-service':
        const { endpoints, authConfig, transformRules, versions } = data;
        
        // Configure load balancer
        if (endpoints) {
          loadBalancer.addService(serviceId, endpoints);
        }
        
        // Configure authentication
        if (authConfig) {
          authManager.setAuthConfig(serviceId, authConfig);
        }
        
        // Add transformation rules
        if (transformRules) {
          transformRules.forEach((rule: any) => {
            requestTransformer.addRule({ ...rule, serviceId });
          });
        }
        
        // Add versions
        if (versions) {
          versions.forEach((version: VersionConfig) => {
            versionManager.addVersion(serviceId, version);
          });
        }

        return NextResponse.json({
          success: true,
          message: `Service ${serviceId} configured successfully`
        });

      case 'update-rate-limit':
        // Rate limiting configuration is handled per request
        return NextResponse.json({
          success: true,
          message: 'Rate limiting updated'
        });

      case 'circuit-breaker-reset':
        circuitBreaker.reset(serviceId);
        return NextResponse.json({
          success: true,
          message: `Circuit breaker reset for ${serviceId}`
        });

      case 'proxy':
        // Rate limiting check
        if (!rateLimiter.isAllowed(clientId)) {
          return NextResponse.json(
            { 
              error: 'Rate limit exceeded',
              retryAfter: Math.ceil((rateLimiter.getResetTime(clientId) - Date.now()) / 1000)
            },
            { status: 429 }
          );
        }

        // Authentication check
        const authResult = await authManager.authenticate(serviceId, req);
        if (!authResult.authorized) {
          return NextResponse.json(
            { error: authResult.error || 'Unauthorized' },
            { status: 401 }
          );
        }

        const { path, method = 'POST', requestData, version } = data;
        
        // Version check
        const requestedVersion = version || req.headers.get('x-api-version') || '1.0.0';
        if (!versionManager.isVersionSupported(serviceId, requestedVersion)) {
          return NextResponse.json(
            { error: 'Unsupported API version' },
            { status: 400 }
          );
        }

        // Get endpoint through load balancer
        const endpoint = loadBalancer.getEndpoint(serviceId);
        if (!endpoint) {
          return NextResponse.json(
            { error: 'No healthy endpoints available' },
            { status: 503 }
          );
        }

        // Execute through circuit breaker
        try {
          const result = await circuitBreaker.execute(
            serviceId,
            async () => {
              const startTime = Date.now();
              loadBalancer.incrementConnections(serviceId, endpoint.id);

              try {
                // Transform request data
                const transformedData = requestTransformer.transformRequest(
                  serviceId,
                  path,
                  method,
                  requestData
                );

                const targetUrl = new URL(path, endpoint.url);
                
                const response = await fetch(targetUrl.toString(), {
                  method,
                  headers: {
                    'Content-Type': 'application/json',
                    ...Object.fromEntries(req.headers.entries()),
                    'X-Forwarded-By': 'plugin-gateway',
                    'X-Client-Id': clientId,
                    ...versionManager.getVersionHeaders(serviceId, requestedVersion)
                  },
                  body: method !== 'GET' ? JSON.stringify(transformedData) : undefined,
                  signal: AbortSignal.timeout(30000)
                });

                const responseTime = Date.now() - startTime;
                loadBalancer.updateResponseTime(serviceId, endpoint.id, responseTime);

                if (!response.ok) {
                  throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const responseData = await response.json();
                
                // Transform response data
                const transformedResponse = requestTransformer.transformResponse(
                  serviceId,
                  path,
                  method,
                  responseData
                );

                return {
                  data: transformedResponse,
                  status: response.status,
                  headers: Object.fromEntries(response.headers.entries()),
                  endpoint: endpoint.id,
                  responseTime
                };

              } finally {
                loadBalancer.decrementConnections(serviceId, endpoint.id);
              }
            }
          );

          const responseHeaders = new Headers();
          responseHeaders.set('X-Gateway-Endpoint', result.endpoint);
          responseHeaders.set('X-Response-Time', result.responseTime.toString());
          responseHeaders.set('X-Circuit-State', circuitBreaker.getState());
          
          // Add version headers
          const versionHeaders = versionManager.getVersionHeaders(serviceId, requestedVersion);
          Object.entries(versionHeaders).forEach(([key, value]) => {
            responseHeaders.set(key, value);
          });

          return NextResponse.json(result.data, {
            status: result.status,
            headers: responseHeaders
          });

        } catch (error) {
          console.error('Gateway POST proxy error:', error);
          return NextResponse.json(
            { 
              error: 'Gateway error',
              details: error instanceof Error ? error.message : 'Unknown error',
              endpoint: endpoint.id,
              circuitState: circuitBreaker.getState()
            },
            { status: 502 }
          );
        }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Plugin gateway POST error:', error);
    return NextResponse.json(
      { 
        error: 'Gateway error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}