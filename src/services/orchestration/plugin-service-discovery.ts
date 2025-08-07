/**
 * Plugin Service Discovery and Registration System
 * Enterprise-grade service discovery for plugin orchestration with load balancing,
 * health monitoring, and automatic service registration/deregistration
 */

import { EventEmitter } from 'events';
import { z } from 'zod';
import crypto from 'crypto';

// Service registration schema
export const ServiceRegistrationSchema = z.object({
  serviceId: z.string(),
  pluginId: z.string(),
  serviceName: z.string(),
  serviceType: z.enum(['frontend', 'backend', 'api', 'worker', 'proxy']),
  version: z.string(),
  host: z.string(),
  port: z.number(),
  protocol: z.enum(['http', 'https', 'grpc', 'ws', 'wss']).default('http'),
  baseUrl: z.string().optional(),
  endpoints: z.array(z.object({
    path: z.string(),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']).optional(),
    description: z.string().optional()
  })).optional(),
  metadata: z.record(z.any()).optional(),
  tags: z.array(z.string()).default([]),
  environment: z.enum(['development', 'staging', 'production']).default('development'),
  tenantId: z.string().optional(),
  healthCheck: z.object({
    endpoint: z.string(),
    interval: z.number().default(30000),
    timeout: z.number().default(5000),
    retries: z.number().default(3)
  }).optional(),
  loadBalancing: z.object({
    weight: z.number().default(100),
    maxConnections: z.number().optional(),
    priority: z.number().default(1)
  }).optional(),
  resources: z.object({
    cpu: z.number().optional(),
    memory: z.number().optional(),
    connections: z.number().optional()
  }).optional(),
  security: z.object({
    requireAuth: z.boolean().default(false),
    allowedOrigins: z.array(z.string()).optional(),
    rateLimits: z.record(z.number()).optional()
  }).optional()
});

export type ServiceRegistration = z.infer<typeof ServiceRegistrationSchema>;

// Service instance representing a running service
export interface ServiceInstance {
  registration: ServiceRegistration;
  status: 'healthy' | 'unhealthy' | 'starting' | 'stopping' | 'unknown';
  lastHealthCheck: Date;
  consecutiveFailures: number;
  registeredAt: Date;
  lastUpdated: Date;
  metrics: {
    requestCount: number;
    errorRate: number;
    avgResponseTime: number;
    activeConnections: number;
    resourceUsage: {
      cpu: number;
      memory: number;
    };
  };
}

// Load balancing strategies
export enum LoadBalancingStrategy {
  ROUND_ROBIN = 'round_robin',
  WEIGHTED_ROUND_ROBIN = 'weighted_round_robin',
  LEAST_CONNECTIONS = 'least_connections',
  IP_HASH = 'ip_hash',
  RANDOM = 'random',
  HEALTH_WEIGHTED = 'health_weighted'
}

// Service discovery configuration
export const ServiceDiscoveryConfigSchema = z.object({
  enableHealthChecks: z.boolean().default(true),
  healthCheckInterval: z.number().default(30000),
  healthCheckTimeout: z.number().default(5000),
  maxConsecutiveFailures: z.number().default(3),
  serviceTimeout: z.number().default(120000), // 2 minutes
  enableLoadBalancing: z.boolean().default(true),
  defaultLoadBalancingStrategy: z.nativeEnum(LoadBalancingStrategy).default(LoadBalancingStrategy.ROUND_ROBIN),
  enableServiceMesh: z.boolean().default(false),
  enableMetrics: z.boolean().default(true),
  enableAutoDeregistration: z.boolean().default(true),
  tenantIsolation: z.boolean().default(false),
  cacheTimeout: z.number().default(60000)
});

export type ServiceDiscoveryConfig = z.infer<typeof ServiceDiscoveryConfigSchema>;

// Service query interface
export interface ServiceQuery {
  serviceName?: string;
  pluginId?: string;
  serviceType?: string;
  tags?: string[];
  environment?: string;
  tenantId?: string;
  status?: string[];
  metadata?: Record<string, any>;
}

// Load balancer interface
export interface LoadBalancer {
  strategy: LoadBalancingStrategy;
  selectInstance(instances: ServiceInstance[], clientInfo?: any): ServiceInstance | null;
  updateMetrics(serviceId: string, metrics: Partial<ServiceInstance['metrics']>): void;
}

/**
 * Plugin Service Discovery Registry
 * Centralized service registry with health monitoring and load balancing
 */
export class PluginServiceDiscovery extends EventEmitter {
  private config: ServiceDiscoveryConfig;
  private services: Map<string, ServiceInstance> = new Map();
  private servicesByName: Map<string, Set<string>> = new Map();
  private servicesByPlugin: Map<string, Set<string>> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private loadBalancers: Map<string, LoadBalancer> = new Map();
  private roundRobinCounters: Map<string, number> = new Map();
  private metricsCache: Map<string, any> = new Map();
  private lastCacheUpdate: Date = new Date(0);

  constructor(config?: Partial<ServiceDiscoveryConfig>) {
    super();
    this.config = ServiceDiscoveryConfigSchema.parse(config || {});
    this.initializeDiscovery();
  }

  // Initialize service discovery
  private initializeDiscovery(): void {
    // Initialize load balancers
    this.initializeLoadBalancers();

    // Start health checking if enabled
    if (this.config.enableHealthChecks) {
      this.startHealthChecking();
    }

    // Start metrics collection if enabled
    if (this.config.enableMetrics) {
      this.startMetricsCollection();
    }

    // Cleanup expired services
    setInterval(() => {
      this.cleanupExpiredServices();
    }, 60000); // Check every minute
  }

  // Register a service
  async registerService(registration: ServiceRegistration): Promise<void> {
    try {
      // Validate registration
      ServiceRegistrationSchema.parse(registration);
    } catch (error) {
      throw new Error(`Invalid service registration: ${error}`);
    }

    // Check for tenant isolation
    if (this.config.tenantIsolation && !registration.tenantId) {
      throw new Error('Tenant ID required when tenant isolation is enabled');
    }

    // Create service instance
    const serviceInstance: ServiceInstance = {
      registration,
      status: 'starting',
      lastHealthCheck: new Date(),
      consecutiveFailures: 0,
      registeredAt: new Date(),
      lastUpdated: new Date(),
      metrics: {
        requestCount: 0,
        errorRate: 0,
        avgResponseTime: 0,
        activeConnections: 0,
        resourceUsage: {
          cpu: 0,
          memory: 0
        }
      }
    };

    // Register service
    this.services.set(registration.serviceId, serviceInstance);

    // Update indices
    this.updateServiceIndices(registration, true);

    // Perform initial health check
    if (this.config.enableHealthChecks && registration.healthCheck) {
      await this.performHealthCheck(serviceInstance);
    } else {
      serviceInstance.status = 'healthy';
    }

    this.emit('serviceRegistered', serviceInstance);
    this.invalidateCache();
  }

  // Deregister a service
  async deregisterService(serviceId: string): Promise<boolean> {
    const serviceInstance = this.services.get(serviceId);
    if (!serviceInstance) {
      return false;
    }

    // Update indices
    this.updateServiceIndices(serviceInstance.registration, false);

    // Remove service
    this.services.delete(serviceId);

    this.emit('serviceDeregistered', serviceInstance);
    this.invalidateCache();

    return true;
  }

  // Update service registration
  async updateService(serviceId: string, updates: Partial<ServiceRegistration>): Promise<boolean> {
    const serviceInstance = this.services.get(serviceId);
    if (!serviceInstance) {
      return false;
    }

    // Update registration
    serviceInstance.registration = { ...serviceInstance.registration, ...updates };
    serviceInstance.lastUpdated = new Date();

    // Re-validate updated registration
    try {
      ServiceRegistrationSchema.parse(serviceInstance.registration);
    } catch (error) {
      throw new Error(`Invalid service update: ${error}`);
    }

    // Update indices if service name or plugin ID changed
    if (updates.serviceName || updates.pluginId) {
      this.updateServiceIndices(serviceInstance.registration, false);
      this.updateServiceIndices(serviceInstance.registration, true);
    }

    this.emit('serviceUpdated', serviceInstance);
    this.invalidateCache();

    return true;
  }

  // Discover services by query
  async discoverServices(query: ServiceQuery = {}): Promise<ServiceInstance[]> {
    const cacheKey = JSON.stringify(query);
    
    // Check cache
    if (this.metricsCache.has(cacheKey) && 
        Date.now() - this.lastCacheUpdate.getTime() < this.config.cacheTimeout) {
      return this.metricsCache.get(cacheKey);
    }

    let services = Array.from(this.services.values());

    // Apply filters
    if (query.serviceName) {
      const serviceIds = this.servicesByName.get(query.serviceName);
      if (serviceIds) {
        services = services.filter(s => serviceIds.has(s.registration.serviceId));
      } else {
        services = [];
      }
    }

    if (query.pluginId) {
      const serviceIds = this.servicesByPlugin.get(query.pluginId);
      if (serviceIds) {
        services = services.filter(s => serviceIds.has(s.registration.serviceId));
      } else {
        services = [];
      }
    }

    if (query.serviceType) {
      services = services.filter(s => s.registration.serviceType === query.serviceType);
    }

    if (query.environment) {
      services = services.filter(s => s.registration.environment === query.environment);
    }

    if (query.tenantId) {
      services = services.filter(s => s.registration.tenantId === query.tenantId);
    }

    if (query.status && query.status.length > 0) {
      services = services.filter(s => query.status!.includes(s.status));
    }

    if (query.tags && query.tags.length > 0) {
      services = services.filter(s => 
        query.tags!.some(tag => s.registration.tags.includes(tag))
      );
    }

    if (query.metadata) {
      services = services.filter(s => {
        if (!s.registration.metadata) return false;
        return Object.entries(query.metadata!).every(([key, value]) => 
          s.registration.metadata![key] === value
        );
      });
    }

    // Cache result
    this.metricsCache.set(cacheKey, services);
    this.lastCacheUpdate = new Date();

    return services;
  }

  // Get service instance by ID
  getService(serviceId: string): ServiceInstance | null {
    return this.services.get(serviceId) || null;
  }

  // Get load-balanced service instance
  async getLoadBalancedService(
    serviceName: string,
    clientInfo?: any,
    strategy?: LoadBalancingStrategy
  ): Promise<ServiceInstance | null> {
    const services = await this.discoverServices({ 
      serviceName, 
      status: ['healthy'] 
    });

    if (services.length === 0) {
      return null;
    }

    if (services.length === 1) {
      return services[0];
    }

    const loadBalancer = this.getLoadBalancer(strategy || this.config.defaultLoadBalancingStrategy);
    return loadBalancer.selectInstance(services, clientInfo);
  }

  // Get all services for a plugin
  async getPluginServices(pluginId: string): Promise<ServiceInstance[]> {
    return this.discoverServices({ pluginId });
  }

  // Get service health status
  getServiceHealth(serviceId: string): {
    status: ServiceInstance['status'];
    lastCheck: Date;
    consecutiveFailures: number;
    uptime: number;
  } | null {
    const service = this.services.get(serviceId);
    if (!service) {
      return null;
    }

    return {
      status: service.status,
      lastCheck: service.lastHealthCheck,
      consecutiveFailures: service.consecutiveFailures,
      uptime: Date.now() - service.registeredAt.getTime()
    };
  }

  // Update service metrics
  updateServiceMetrics(serviceId: string, metrics: Partial<ServiceInstance['metrics']>): void {
    const service = this.services.get(serviceId);
    if (!service) {
      return;
    }

    service.metrics = { ...service.metrics, ...metrics };
    service.lastUpdated = new Date();

    // Update load balancer metrics
    for (const loadBalancer of this.loadBalancers.values()) {
      loadBalancer.updateMetrics(serviceId, metrics);
    }

    this.emit('serviceMetricsUpdated', { serviceId, metrics: service.metrics });
  }

  // Get discovery statistics
  getStatistics(): {
    totalServices: number;
    healthyServices: number;
    unhealthyServices: number;
    servicesByType: Record<string, number>;
    servicesByPlugin: Record<string, number>;
    averageResponseTime: number;
    totalRequests: number;
    errorRate: number;
  } {
    const services = Array.from(this.services.values());
    const healthy = services.filter(s => s.status === 'healthy').length;
    const unhealthy = services.filter(s => s.status === 'unhealthy').length;

    const byType: Record<string, number> = {};
    const byPlugin: Record<string, number> = {};
    let totalRequests = 0;
    let totalErrors = 0;
    let totalResponseTime = 0;
    let responseTimeCount = 0;

    services.forEach(service => {
      const type = service.registration.serviceType;
      const plugin = service.registration.pluginId;

      byType[type] = (byType[type] || 0) + 1;
      byPlugin[plugin] = (byPlugin[plugin] || 0) + 1;

      totalRequests += service.metrics.requestCount;
      totalErrors += service.metrics.requestCount * (service.metrics.errorRate / 100);
      
      if (service.metrics.avgResponseTime > 0) {
        totalResponseTime += service.metrics.avgResponseTime;
        responseTimeCount++;
      }
    });

    return {
      totalServices: services.length,
      healthyServices: healthy,
      unhealthyServices: unhealthy,
      servicesByType: byType,
      servicesByPlugin: byPlugin,
      averageResponseTime: responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0,
      totalRequests,
      errorRate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0
    };
  }

  // Initialize load balancers
  private initializeLoadBalancers(): void {
    // Round Robin Load Balancer
    this.loadBalancers.set(LoadBalancingStrategy.ROUND_ROBIN, {
      strategy: LoadBalancingStrategy.ROUND_ROBIN,
      selectInstance: (instances: ServiceInstance[]): ServiceInstance | null => {
        if (instances.length === 0) return null;
        
        const key = instances[0].registration.serviceName;
        const counter = this.roundRobinCounters.get(key) || 0;
        const index = counter % instances.length;
        this.roundRobinCounters.set(key, counter + 1);
        
        return instances[index];
      },
      updateMetrics: () => {} // No metrics needed for round robin
    });

    // Weighted Round Robin Load Balancer
    this.loadBalancers.set(LoadBalancingStrategy.WEIGHTED_ROUND_ROBIN, {
      strategy: LoadBalancingStrategy.WEIGHTED_ROUND_ROBIN,
      selectInstance: (instances: ServiceInstance[]): ServiceInstance | null => {
        if (instances.length === 0) return null;
        
        // Create weighted list
        const weightedInstances: ServiceInstance[] = [];
        instances.forEach(instance => {
          const weight = instance.registration.loadBalancing?.weight || 100;
          for (let i = 0; i < weight / 10; i++) {
            weightedInstances.push(instance);
          }
        });
        
        if (weightedInstances.length === 0) return instances[0];
        
        const key = instances[0].registration.serviceName + '_weighted';
        const counter = this.roundRobinCounters.get(key) || 0;
        const index = counter % weightedInstances.length;
        this.roundRobinCounters.set(key, counter + 1);
        
        return weightedInstances[index];
      },
      updateMetrics: () => {}
    });

    // Least Connections Load Balancer
    this.loadBalancers.set(LoadBalancingStrategy.LEAST_CONNECTIONS, {
      strategy: LoadBalancingStrategy.LEAST_CONNECTIONS,
      selectInstance: (instances: ServiceInstance[]): ServiceInstance | null => {
        if (instances.length === 0) return null;
        
        return instances.reduce((least, current) => 
          current.metrics.activeConnections < least.metrics.activeConnections ? current : least
        );
      },
      updateMetrics: () => {}
    });

    // Random Load Balancer
    this.loadBalancers.set(LoadBalancingStrategy.RANDOM, {
      strategy: LoadBalancingStrategy.RANDOM,
      selectInstance: (instances: ServiceInstance[]): ServiceInstance | null => {
        if (instances.length === 0) return null;
        return instances[Math.floor(Math.random() * instances.length)];
      },
      updateMetrics: () => {}
    });

    // IP Hash Load Balancer
    this.loadBalancers.set(LoadBalancingStrategy.IP_HASH, {
      strategy: LoadBalancingStrategy.IP_HASH,
      selectInstance: (instances: ServiceInstance[], clientInfo?: any): ServiceInstance | null => {
        if (instances.length === 0) return null;
        
        const clientIP = clientInfo?.ip || 'unknown';
        const hash = crypto.createHash('md5').update(clientIP).digest('hex');
        const index = parseInt(hash.substring(0, 8), 16) % instances.length;
        
        return instances[index];
      },
      updateMetrics: () => {}
    });

    // Health Weighted Load Balancer
    this.loadBalancers.set(LoadBalancingStrategy.HEALTH_WEIGHTED, {
      strategy: LoadBalancingStrategy.HEALTH_WEIGHTED,
      selectInstance: (instances: ServiceInstance[]): ServiceInstance | null => {
        if (instances.length === 0) return null;
        
        // Score instances based on health metrics
        const scoredInstances = instances.map(instance => {
          let score = 100; // Base score
          
          // Deduct for consecutive failures
          score -= instance.consecutiveFailures * 20;
          
          // Deduct for high error rate
          score -= instance.metrics.errorRate;
          
          // Deduct for high response time
          if (instance.metrics.avgResponseTime > 1000) {
            score -= 20;
          }
          
          // Deduct for high resource usage
          score -= instance.metrics.resourceUsage.cpu / 4;
          
          return { instance, score: Math.max(0, score) };
        });
        
        // Select instance with highest score
        const best = scoredInstances.reduce((best, current) => 
          current.score > best.score ? current : best
        );
        
        return best.instance;
      },
      updateMetrics: () => {}
    });
  }

  // Get load balancer
  private getLoadBalancer(strategy: LoadBalancingStrategy): LoadBalancer {
    const loadBalancer = this.loadBalancers.get(strategy);
    if (!loadBalancer) {
      throw new Error(`Unknown load balancing strategy: ${strategy}`);
    }
    return loadBalancer;
  }

  // Update service indices
  private updateServiceIndices(registration: ServiceRegistration, add: boolean): void {
    const serviceId = registration.serviceId;

    // Update by service name
    let nameSet = this.servicesByName.get(registration.serviceName);
    if (!nameSet) {
      nameSet = new Set();
      this.servicesByName.set(registration.serviceName, nameSet);
    }
    
    if (add) {
      nameSet.add(serviceId);
    } else {
      nameSet.delete(serviceId);
      if (nameSet.size === 0) {
        this.servicesByName.delete(registration.serviceName);
      }
    }

    // Update by plugin ID
    let pluginSet = this.servicesByPlugin.get(registration.pluginId);
    if (!pluginSet) {
      pluginSet = new Set();
      this.servicesByPlugin.set(registration.pluginId, pluginSet);
    }
    
    if (add) {
      pluginSet.add(serviceId);
    } else {
      pluginSet.delete(serviceId);
      if (pluginSet.size === 0) {
        this.servicesByPlugin.delete(registration.pluginId);
      }
    }
  }

  // Start health checking
  private startHealthChecking(): void {
    this.healthCheckInterval = setInterval(async () => {
      const healthCheckPromises: Promise<void>[] = [];
      
      for (const service of this.services.values()) {
        if (service.registration.healthCheck) {
          healthCheckPromises.push(this.performHealthCheck(service));
        }
      }
      
      await Promise.allSettled(healthCheckPromises);
    }, this.config.healthCheckInterval);
  }

  // Perform health check on a service
  private async performHealthCheck(service: ServiceInstance): Promise<void> {
    const { registration } = service;
    const healthCheck = registration.healthCheck;
    
    if (!healthCheck) return;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), healthCheck.timeout);
      
      const healthUrl = `${registration.protocol}://${registration.host}:${registration.port}${healthCheck.endpoint}`;
      
      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Plugin-Service-Discovery/1.0'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        // Health check passed
        const previousStatus = service.status;
        service.status = 'healthy';
        service.consecutiveFailures = 0;
        service.lastHealthCheck = new Date();
        
        if (previousStatus !== 'healthy') {
          this.emit('serviceHealthy', service);
        }
      } else {
        this.handleHealthCheckFailure(service, new Error(`HTTP ${response.status}`));
      }
      
    } catch (error) {
      this.handleHealthCheckFailure(service, error as Error);
    }
  }

  // Handle health check failure
  private handleHealthCheckFailure(service: ServiceInstance, error: Error): void {
    service.consecutiveFailures++;
    service.lastHealthCheck = new Date();
    
    const previousStatus = service.status;
    
    if (service.consecutiveFailures >= this.config.maxConsecutiveFailures) {
      service.status = 'unhealthy';
      
      if (previousStatus !== 'unhealthy') {
        this.emit('serviceUnhealthy', { service, error });
        
        // Auto-deregister if enabled
        if (this.config.enableAutoDeregistration) {
          setTimeout(() => {
            if (service.consecutiveFailures >= this.config.maxConsecutiveFailures * 2) {
              this.deregisterService(service.registration.serviceId);
            }
          }, this.config.serviceTimeout);
        }
      }
    }
  }

  // Start metrics collection
  private startMetricsCollection(): void {
    setInterval(() => {
      this.collectServiceMetrics();
    }, 30000); // Collect every 30 seconds
  }

  // Collect service metrics
  private async collectServiceMetrics(): Promise<void> {
    for (const service of this.services.values()) {
      // Simulate metrics collection - in production, integrate with actual monitoring
      if (service.status === 'healthy') {
        const metrics = {
          requestCount: service.metrics.requestCount + Math.floor(Math.random() * 100),
          errorRate: Math.random() * 5,
          avgResponseTime: 100 + Math.random() * 400,
          activeConnections: Math.floor(Math.random() * 50),
          resourceUsage: {
            cpu: Math.random() * 80,
            memory: Math.random() * 70
          }
        };
        
        this.updateServiceMetrics(service.registration.serviceId, metrics);
      }
    }
  }

  // Cleanup expired services
  private cleanupExpiredServices(): void {
    const now = Date.now();
    const expiredServices: string[] = [];
    
    for (const [serviceId, service] of this.services.entries()) {
      const timeSinceUpdate = now - service.lastUpdated.getTime();
      
      if (timeSinceUpdate > this.config.serviceTimeout) {
        expiredServices.push(serviceId);
      }
    }
    
    for (const serviceId of expiredServices) {
      this.deregisterService(serviceId);
      this.emit('serviceExpired', { serviceId });
    }
  }

  // Invalidate cache
  private invalidateCache(): void {
    this.metricsCache.clear();
    this.lastCacheUpdate = new Date(0);
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    // Deregister all services
    const serviceIds = Array.from(this.services.keys());
    for (const serviceId of serviceIds) {
      await this.deregisterService(serviceId);
    }
    
    // Clean up resources
    this.services.clear();
    this.servicesByName.clear();
    this.servicesByPlugin.clear();
    this.loadBalancers.clear();
    this.roundRobinCounters.clear();
    this.metricsCache.clear();
    
    this.removeAllListeners();
    this.emit('shutdown');
  }
}

// Export singleton instance
let serviceDiscoveryInstance: PluginServiceDiscovery | null = null;

export function getPluginServiceDiscovery(config?: Partial<ServiceDiscoveryConfig>): PluginServiceDiscovery {
  if (!serviceDiscoveryInstance) {
    serviceDiscoveryInstance = new PluginServiceDiscovery(config);
  }
  return serviceDiscoveryInstance;
}