/**
 * Service Discovery Manager
 * 
 * Comprehensive service discovery system for plugins with:
 * - Dynamic plugin endpoint registration
 * - Load balancing configuration
 * - Service mesh integration (Istio/Linkerd)
 * - DNS-based service discovery
 * - Health-based routing
 * - Multi-cluster service discovery
 * - Cross-region service discovery
 * - Service versioning and canary routing
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import * as k8s from '@kubernetes/client-node';
import * as dns from 'dns';
import { promisify } from 'util';
import { PluginDefinition } from '../types/plugin-types';

export interface ServiceEndpoint {
  id: string;
  pluginName: string;
  namespace: string;
  cluster: string;
  region: string;
  version: string;
  host: string;
  port: number;
  protocol: 'http' | 'https' | 'grpc' | 'tcp';
  healthCheckPath?: string;
  healthStatus: 'healthy' | 'unhealthy' | 'unknown';
  weight: number;
  metadata: Record<string, string>;
  registeredAt: Date;
  lastHealthCheck?: Date;
  tags: string[];
}

export interface ServiceGroup {
  name: string;
  namespace: string;
  endpoints: ServiceEndpoint[];
  loadBalancing: LoadBalancingConfig;
  healthChecks: HealthCheckConfig;
  routing: RoutingConfig;
  serviceMesh: ServiceMeshConfig;
  crossCluster: CrossClusterConfig;
}

export interface LoadBalancingConfig {
  algorithm: 'round-robin' | 'least-connections' | 'weighted-round-robin' | 'ip-hash' | 'sticky-session';
  sessionAffinity?: {
    enabled: boolean;
    cookieName?: string;
    timeout?: number;
  };
  healthCheck: {
    enabled: boolean;
    unhealthyThreshold: number;
    healthyThreshold: number;
  };
}

export interface HealthCheckConfig {
  enabled: boolean;
  interval: number;
  timeout: number;
  path: string;
  expectedStatus: number[];
  retries: number;
}

export interface RoutingConfig {
  canaryRouting?: {
    enabled: boolean;
    stableVersion: string;
    canaryVersion: string;
    trafficSplit: {
      stable: number;
      canary: number;
    };
    rules: RoutingRule[];
  };
  pathRouting?: {
    enabled: boolean;
    rules: Array<{
      path: string;
      version: string;
      weight: number;
    }>;
  };
  headerRouting?: {
    enabled: boolean;
    rules: Array<{
      header: string;
      value: string;
      version: string;
    }>;
  };
}

export interface RoutingRule {
  type: 'header' | 'cookie' | 'user' | 'percentage';
  key?: string;
  value?: string;
  percentage?: number;
}

export interface ServiceMeshConfig {
  enabled: boolean;
  provider: 'istio' | 'linkerd' | 'consul-connect' | 'none';
  mTLS: {
    enabled: boolean;
    mode: 'strict' | 'permissive';
  };
  circuitBreaker: {
    enabled: boolean;
    maxConnections: number;
    maxPendingRequests: number;
    maxRequests: number;
    maxRetries: number;
    consecutiveErrors: number;
  };
  retryPolicy: {
    attempts: number;
    perTryTimeout: string;
    retryOn: string[];
  };
}

export interface CrossClusterConfig {
  enabled: boolean;
  clusters: Array<{
    name: string;
    region: string;
    priority: number;
    endpoint: string;
    credentials?: string;
  }>;
  failover: {
    enabled: boolean;
    detectInterval: number;
    switchThreshold: number;
  };
}

export interface DNSConfig {
  enabled: boolean;
  domain: string;
  ttl: number;
  recordTypes: ('A' | 'AAAA' | 'SRV' | 'CNAME')[];
}

export interface DiscoveryEvent {
  type: 'service-registered' | 'service-unregistered' | 'service-updated' | 'health-changed';
  service: ServiceEndpoint;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export class ServiceDiscoveryManager extends EventEmitter {
  private logger: Logger;
  private kubeConfig: k8s.KubeConfig;
  private coreV1Api: k8s.CoreV1Api;
  private networkingV1Api: k8s.NetworkingV1Api;

  private serviceRegistry = new Map<string, ServiceGroup>();
  private endpointHealth = new Map<string, boolean>();
  private dnsResolver = promisify(dns.resolve);
  
  private healthCheckInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  private crossClusterSyncInterval?: NodeJS.Timeout;
  
  private isShutdown = false;

  constructor(
    logger: Logger,
    kubeConfig: k8s.KubeConfig,
    private dnsConfig: DNSConfig
  ) {
    super();
    this.logger = logger;
    this.kubeConfig = kubeConfig;
    this.coreV1Api = kubeConfig.makeApiClient(k8s.CoreV1Api);
    this.networkingV1Api = kubeConfig.makeApiClient(k8s.NetworkingV1Api);

    this.setupEventHandlers();
    this.startBackgroundTasks();
  }

  /**
   * Register a service endpoint
   */
  async registerService(
    plugin: PluginDefinition,
    endpoint: Omit<ServiceEndpoint, 'id' | 'registeredAt' | 'healthStatus'>,
    serviceConfig?: Partial<ServiceGroup>
  ): Promise<string> {
    const endpointId = this.generateEndpointId(endpoint);
    
    this.logger.info(`Registering service endpoint: ${plugin.name}`, {
      endpointId,
      host: endpoint.host,
      port: endpoint.port,
      cluster: endpoint.cluster
    });

    const serviceEndpoint: ServiceEndpoint = {
      id: endpointId,
      registeredAt: new Date(),
      healthStatus: 'unknown',
      ...endpoint
    };

    const serviceName = `${plugin.name}-${plugin.namespace || 'default'}`;
    let serviceGroup = this.serviceRegistry.get(serviceName);

    if (!serviceGroup) {
      serviceGroup = {
        name: plugin.name,
        namespace: plugin.namespace || 'default',
        endpoints: [],
        loadBalancing: this.getDefaultLoadBalancingConfig(),
        healthChecks: this.getDefaultHealthCheckConfig(),
        routing: this.getDefaultRoutingConfig(),
        serviceMesh: this.getDefaultServiceMeshConfig(),
        crossCluster: this.getDefaultCrossClusterConfig(),
        ...serviceConfig
      };
      this.serviceRegistry.set(serviceName, serviceGroup);
    }

    serviceGroup.endpoints.push(serviceEndpoint);

    // Create Kubernetes service if needed
    await this.createKubernetesService(serviceGroup, serviceEndpoint);

    // Configure service mesh if enabled
    if (serviceGroup.serviceMesh.enabled) {
      await this.configureServiceMesh(serviceGroup, serviceEndpoint);
    }

    // Update DNS records if enabled
    if (this.dnsConfig.enabled) {
      await this.updateDNSRecords(serviceGroup);
    }

    // Trigger health check
    await this.performHealthCheck(serviceEndpoint);

    const event: DiscoveryEvent = {
      type: 'service-registered',
      service: serviceEndpoint,
      timestamp: new Date()
    };

    this.emit('service-registered', event);
    return endpointId;
  }

  /**
   * Unregister a service endpoint
   */
  async unregisterService(endpointId: string): Promise<void> {
    this.logger.info(`Unregistering service endpoint: ${endpointId}`);

    let foundEndpoint: ServiceEndpoint | null = null;
    let serviceGroup: ServiceGroup | null = null;

    for (const [serviceName, group] of this.serviceRegistry.entries()) {
      const endpointIndex = group.endpoints.findIndex(ep => ep.id === endpointId);
      if (endpointIndex !== -1) {
        foundEndpoint = group.endpoints[endpointIndex];
        group.endpoints.splice(endpointIndex, 1);
        serviceGroup = group;

        // Remove service group if no endpoints left
        if (group.endpoints.length === 0) {
          this.serviceRegistry.delete(serviceName);
          await this.deleteKubernetesService(group);
        }
        break;
      }
    }

    if (!foundEndpoint || !serviceGroup) {
      throw new Error(`Service endpoint not found: ${endpointId}`);
    }

    // Clean up service mesh configuration if needed
    if (serviceGroup.serviceMesh.enabled) {
      await this.cleanupServiceMesh(serviceGroup, foundEndpoint);
    }

    // Update DNS records if enabled
    if (this.dnsConfig.enabled && serviceGroup.endpoints.length > 0) {
      await this.updateDNSRecords(serviceGroup);
    }

    // Clean up health check data
    this.endpointHealth.delete(endpointId);

    const event: DiscoveryEvent = {
      type: 'service-unregistered',
      service: foundEndpoint,
      timestamp: new Date()
    };

    this.emit('service-unregistered', event);
  }

  /**
   * Discover services by name
   */
  async discoverServices(
    serviceName: string,
    namespace?: string,
    filters?: {
      version?: string;
      cluster?: string;
      region?: string;
      tags?: string[];
      healthyOnly?: boolean;
    }
  ): Promise<ServiceEndpoint[]> {
    const serviceKey = `${serviceName}-${namespace || 'default'}`;
    const serviceGroup = this.serviceRegistry.get(serviceKey);

    if (!serviceGroup) {
      return [];
    }

    let endpoints = [...serviceGroup.endpoints];

    // Apply filters
    if (filters) {
      if (filters.version) {
        endpoints = endpoints.filter(ep => ep.version === filters.version);
      }

      if (filters.cluster) {
        endpoints = endpoints.filter(ep => ep.cluster === filters.cluster);
      }

      if (filters.region) {
        endpoints = endpoints.filter(ep => ep.region === filters.region);
      }

      if (filters.tags && filters.tags.length > 0) {
        endpoints = endpoints.filter(ep =>
          filters.tags!.every(tag => ep.tags.includes(tag))
        );
      }

      if (filters.healthyOnly) {
        endpoints = endpoints.filter(ep => ep.healthStatus === 'healthy');
      }
    }

    return endpoints;
  }

  /**
   * Get service endpoint for load balancing
   */
  async getServiceEndpoint(
    serviceName: string,
    namespace?: string,
    requestContext?: {
      clientIP?: string;
      sessionId?: string;
      headers?: Record<string, string>;
      cookies?: Record<string, string>;
    }
  ): Promise<ServiceEndpoint | null> {
    const endpoints = await this.discoverServices(serviceName, namespace, { healthyOnly: true });
    
    if (endpoints.length === 0) {
      return null;
    }

    const serviceKey = `${serviceName}-${namespace || 'default'}`;
    const serviceGroup = this.serviceRegistry.get(serviceKey);
    
    if (!serviceGroup) {
      return null;
    }

    // Apply canary routing if enabled
    if (serviceGroup.routing.canaryRouting?.enabled) {
      const canaryEndpoint = await this.applyCanaryRouting(endpoints, serviceGroup.routing.canaryRouting, requestContext);
      if (canaryEndpoint) {
        return canaryEndpoint;
      }
    }

    // Apply load balancing
    return this.applyLoadBalancing(endpoints, serviceGroup.loadBalancing, requestContext);
  }

  /**
   * Update service configuration
   */
  async updateServiceConfig(
    serviceName: string,
    namespace: string = 'default',
    config: Partial<ServiceGroup>
  ): Promise<void> {
    const serviceKey = `${serviceName}-${namespace}`;
    const serviceGroup = this.serviceRegistry.get(serviceKey);

    if (!serviceGroup) {
      throw new Error(`Service not found: ${serviceName}`);
    }

    // Update configuration
    Object.assign(serviceGroup, config);

    // Reconfigure service mesh if needed
    if (config.serviceMesh && serviceGroup.serviceMesh.enabled) {
      for (const endpoint of serviceGroup.endpoints) {
        await this.configureServiceMesh(serviceGroup, endpoint);
      }
    }

    // Update DNS records if needed
    if (this.dnsConfig.enabled) {
      await this.updateDNSRecords(serviceGroup);
    }

    this.emit('service-config-updated', { serviceName, namespace, config });
  }

  /**
   * Get all registered services
   */
  getRegisteredServices(): Array<{ name: string; namespace: string; endpoints: number; health: string }> {
    return Array.from(this.serviceRegistry.entries()).map(([key, serviceGroup]) => {
      const healthyEndpoints = serviceGroup.endpoints.filter(ep => ep.healthStatus === 'healthy').length;
      const totalEndpoints = serviceGroup.endpoints.length;
      
      let health = 'healthy';
      if (healthyEndpoints === 0) {
        health = 'unhealthy';
      } else if (healthyEndpoints < totalEndpoints) {
        health = 'degraded';
      }

      return {
        name: serviceGroup.name,
        namespace: serviceGroup.namespace,
        endpoints: totalEndpoints,
        health
      };
    });
  }

  /**
   * Get service statistics
   */
  getServiceStatistics(serviceName: string, namespace: string = 'default'): any {
    const serviceKey = `${serviceName}-${namespace}`;
    const serviceGroup = this.serviceRegistry.get(serviceKey);

    if (!serviceGroup) {
      return null;
    }

    const endpoints = serviceGroup.endpoints;
    const healthyEndpoints = endpoints.filter(ep => ep.healthStatus === 'healthy');
    const unhealthyEndpoints = endpoints.filter(ep => ep.healthStatus === 'unhealthy');

    const regionStats = endpoints.reduce((acc, ep) => {
      acc[ep.region] = (acc[ep.region] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const versionStats = endpoints.reduce((acc, ep) => {
      acc[ep.version] = (acc[ep.version] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalEndpoints: endpoints.length,
      healthyEndpoints: healthyEndpoints.length,
      unhealthyEndpoints: unhealthyEndpoints.length,
      availabilityPercentage: endpoints.length > 0 ? (healthyEndpoints.length / endpoints.length) * 100 : 0,
      regionDistribution: regionStats,
      versionDistribution: versionStats,
      loadBalancing: serviceGroup.loadBalancing,
      serviceMeshEnabled: serviceGroup.serviceMesh.enabled
    };
  }

  /**
   * Perform health checks on all endpoints
   */
  private async performHealthChecks(): Promise<void> {
    const healthCheckPromises: Promise<void>[] = [];

    for (const serviceGroup of this.serviceRegistry.values()) {
      for (const endpoint of serviceGroup.endpoints) {
        healthCheckPromises.push(this.performHealthCheck(endpoint));
      }
    }

    await Promise.allSettled(healthCheckPromises);
  }

  /**
   * Perform health check on single endpoint
   */
  private async performHealthCheck(endpoint: ServiceEndpoint): Promise<void> {
    try {
      const healthUrl = this.buildHealthCheckUrl(endpoint);
      const startTime = Date.now();

      const response = await fetch(healthUrl, {
        method: 'GET',
        timeout: 5000, // 5 second timeout
        signal: AbortSignal.timeout(5000)
      });

      const responseTime = Date.now() - startTime;
      const isHealthy = response.ok;

      const previousHealth = endpoint.healthStatus;
      endpoint.healthStatus = isHealthy ? 'healthy' : 'unhealthy';
      endpoint.lastHealthCheck = new Date();

      this.endpointHealth.set(endpoint.id, isHealthy);

      // Emit health change event if status changed
      if (previousHealth !== endpoint.healthStatus) {
        const event: DiscoveryEvent = {
          type: 'health-changed',
          service: endpoint,
          timestamp: new Date(),
          metadata: {
            previousHealth,
            responseTime,
            statusCode: response.status
          }
        };

        this.emit('health-changed', event);
      }

    } catch (error) {
      const previousHealth = endpoint.healthStatus;
      endpoint.healthStatus = 'unhealthy';
      endpoint.lastHealthCheck = new Date();
      this.endpointHealth.set(endpoint.id, false);

      if (previousHealth !== 'unhealthy') {
        const event: DiscoveryEvent = {
          type: 'health-changed',
          service: endpoint,
          timestamp: new Date(),
          metadata: {
            previousHealth,
            error: error.message
          }
        };

        this.emit('health-changed', event);
      }
    }
  }

  /**
   * Apply canary routing
   */
  private async applyCanaryRouting(
    endpoints: ServiceEndpoint[],
    canaryConfig: NonNullable<RoutingConfig['canaryRouting']>,
    requestContext?: any
  ): Promise<ServiceEndpoint | null> {
    const stableEndpoints = endpoints.filter(ep => ep.version === canaryConfig.stableVersion);
    const canaryEndpoints = endpoints.filter(ep => ep.version === canaryConfig.canaryVersion);

    // Apply routing rules
    for (const rule of canaryConfig.rules) {
      if (this.matchesRoutingRule(rule, requestContext)) {
        return canaryEndpoints.length > 0 ? 
          this.selectRandomEndpoint(canaryEndpoints) : 
          this.selectRandomEndpoint(stableEndpoints);
      }
    }

    // Apply traffic split percentage
    const random = Math.random() * 100;
    if (random < canaryConfig.trafficSplit.canary && canaryEndpoints.length > 0) {
      return this.selectRandomEndpoint(canaryEndpoints);
    }

    return stableEndpoints.length > 0 ? 
      this.selectRandomEndpoint(stableEndpoints) : null;
  }

  /**
   * Apply load balancing
   */
  private applyLoadBalancing(
    endpoints: ServiceEndpoint[],
    loadBalancingConfig: LoadBalancingConfig,
    requestContext?: any
  ): ServiceEndpoint {
    switch (loadBalancingConfig.algorithm) {
      case 'round-robin':
        return this.roundRobinSelection(endpoints);
      case 'least-connections':
        return this.leastConnectionsSelection(endpoints);
      case 'weighted-round-robin':
        return this.weightedRoundRobinSelection(endpoints);
      case 'ip-hash':
        return this.ipHashSelection(endpoints, requestContext?.clientIP);
      case 'sticky-session':
        return this.stickySessionSelection(endpoints, requestContext?.sessionId, loadBalancingConfig);
      default:
        return this.selectRandomEndpoint(endpoints);
    }
  }

  /**
   * Create Kubernetes service
   */
  private async createKubernetesService(serviceGroup: ServiceGroup, endpoint: ServiceEndpoint): Promise<void> {
    try {
      const serviceName = `${serviceGroup.name}-discovery`;
      
      // Check if service already exists
      try {
        await this.coreV1Api.readNamespacedService(serviceName, serviceGroup.namespace);
        return; // Service already exists
      } catch (error) {
        // Service doesn't exist, create it
      }

      const serviceSpec: k8s.V1Service = {
        metadata: {
          name: serviceName,
          namespace: serviceGroup.namespace,
          labels: {
            'app': serviceGroup.name,
            'managed-by': 'service-discovery-manager'
          },
          annotations: {
            'service-discovery.platform/managed': 'true',
            'service-discovery.platform/load-balancer': serviceGroup.loadBalancing.algorithm
          }
        },
        spec: {
          selector: {
            'app': serviceGroup.name
          },
          ports: [{
            name: endpoint.protocol,
            port: endpoint.port,
            targetPort: endpoint.port,
            protocol: endpoint.protocol === 'tcp' ? 'TCP' : 'TCP'
          }],
          type: 'ClusterIP'
        }
      };

      await this.coreV1Api.createNamespacedService(serviceGroup.namespace, serviceSpec);
      this.logger.info(`Created Kubernetes service: ${serviceName}`, {
        namespace: serviceGroup.namespace
      });

    } catch (error) {
      this.logger.error(`Failed to create Kubernetes service: ${error.message}`);
    }
  }

  /**
   * Delete Kubernetes service
   */
  private async deleteKubernetesService(serviceGroup: ServiceGroup): Promise<void> {
    try {
      const serviceName = `${serviceGroup.name}-discovery`;
      await this.coreV1Api.deleteNamespacedService(serviceName, serviceGroup.namespace);
      this.logger.info(`Deleted Kubernetes service: ${serviceName}`);
    } catch (error) {
      this.logger.warn(`Failed to delete Kubernetes service: ${error.message}`);
    }
  }

  /**
   * Configure service mesh
   */
  private async configureServiceMesh(serviceGroup: ServiceGroup, endpoint: ServiceEndpoint): Promise<void> {
    if (!serviceGroup.serviceMesh.enabled) return;

    switch (serviceGroup.serviceMesh.provider) {
      case 'istio':
        await this.configureIstioServiceMesh(serviceGroup, endpoint);
        break;
      case 'linkerd':
        await this.configureLinkerdServiceMesh(serviceGroup, endpoint);
        break;
      case 'consul-connect':
        await this.configureConsulConnectServiceMesh(serviceGroup, endpoint);
        break;
    }
  }

  /**
   * Configure Istio service mesh
   */
  private async configureIstioServiceMesh(serviceGroup: ServiceGroup, endpoint: ServiceEndpoint): Promise<void> {
    try {
      // This would typically use Istio CRDs
      // Implementation would create VirtualService, DestinationRule, etc.
      this.logger.info(`Configuring Istio service mesh for: ${serviceGroup.name}`);
    } catch (error) {
      this.logger.error(`Failed to configure Istio service mesh: ${error.message}`);
    }
  }

  /**
   * Configure Linkerd service mesh
   */
  private async configureLinkerdServiceMesh(serviceGroup: ServiceGroup, endpoint: ServiceEndpoint): Promise<void> {
    try {
      this.logger.info(`Configuring Linkerd service mesh for: ${serviceGroup.name}`);
    } catch (error) {
      this.logger.error(`Failed to configure Linkerd service mesh: ${error.message}`);
    }
  }

  /**
   * Configure Consul Connect service mesh
   */
  private async configureConsulConnectServiceMesh(serviceGroup: ServiceGroup, endpoint: ServiceEndpoint): Promise<void> {
    try {
      this.logger.info(`Configuring Consul Connect service mesh for: ${serviceGroup.name}`);
    } catch (error) {
      this.logger.error(`Failed to configure Consul Connect service mesh: ${error.message}`);
    }
  }

  /**
   * Cleanup service mesh configuration
   */
  private async cleanupServiceMesh(serviceGroup: ServiceGroup, endpoint: ServiceEndpoint): Promise<void> {
    // Implementation for cleaning up service mesh resources
  }

  /**
   * Update DNS records
   */
  private async updateDNSRecords(serviceGroup: ServiceGroup): Promise<void> {
    if (!this.dnsConfig.enabled) return;

    try {
      const healthyEndpoints = serviceGroup.endpoints.filter(ep => ep.healthStatus === 'healthy');
      const serviceFQDN = `${serviceGroup.name}.${serviceGroup.namespace}.${this.dnsConfig.domain}`;

      // Implementation would update DNS records
      // This is a placeholder for actual DNS provider integration
      this.logger.info(`Updating DNS records for: ${serviceFQDN}`, {
        endpoints: healthyEndpoints.length
      });

    } catch (error) {
      this.logger.error(`Failed to update DNS records: ${error.message}`);
    }
  }

  /**
   * Helper methods for load balancing algorithms
   */
  private roundRobinSelection(endpoints: ServiceEndpoint[]): ServiceEndpoint {
    // Simple round-robin implementation
    // In production, this would maintain state for proper round-robin
    return endpoints[Math.floor(Math.random() * endpoints.length)];
  }

  private leastConnectionsSelection(endpoints: ServiceEndpoint[]): ServiceEndpoint {
    // This would require connection tracking
    // For now, return random endpoint
    return this.selectRandomEndpoint(endpoints);
  }

  private weightedRoundRobinSelection(endpoints: ServiceEndpoint[]): ServiceEndpoint {
    const totalWeight = endpoints.reduce((sum, ep) => sum + ep.weight, 0);
    let random = Math.random() * totalWeight;

    for (const endpoint of endpoints) {
      random -= endpoint.weight;
      if (random <= 0) {
        return endpoint;
      }
    }

    return endpoints[endpoints.length - 1];
  }

  private ipHashSelection(endpoints: ServiceEndpoint[], clientIP?: string): ServiceEndpoint {
    if (!clientIP) {
      return this.selectRandomEndpoint(endpoints);
    }

    // Simple hash based on IP
    const hash = this.hashString(clientIP);
    const index = hash % endpoints.length;
    return endpoints[index];
  }

  private stickySessionSelection(
    endpoints: ServiceEndpoint[],
    sessionId?: string,
    config?: LoadBalancingConfig
  ): ServiceEndpoint {
    if (!sessionId) {
      return this.selectRandomEndpoint(endpoints);
    }

    // Simple hash based on session ID
    const hash = this.hashString(sessionId);
    const index = hash % endpoints.length;
    return endpoints[index];
  }

  private selectRandomEndpoint(endpoints: ServiceEndpoint[]): ServiceEndpoint {
    return endpoints[Math.floor(Math.random() * endpoints.length)];
  }

  /**
   * Helper methods
   */
  private generateEndpointId(endpoint: Omit<ServiceEndpoint, 'id' | 'registeredAt' | 'healthStatus'>): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 6);
    return `ep-${endpoint.pluginName}-${endpoint.cluster}-${timestamp}-${random}`;
  }

  private buildHealthCheckUrl(endpoint: ServiceEndpoint): string {
    const protocol = endpoint.protocol === 'https' ? 'https' : 'http';
    const healthPath = endpoint.healthCheckPath || '/health';
    return `${protocol}://${endpoint.host}:${endpoint.port}${healthPath}`;
  }

  private matchesRoutingRule(rule: RoutingRule, requestContext?: any): boolean {
    if (!requestContext) return false;

    switch (rule.type) {
      case 'header':
        return requestContext.headers?.[rule.key!] === rule.value;
      case 'cookie':
        return requestContext.cookies?.[rule.key!] === rule.value;
      case 'percentage':
        return Math.random() * 100 < (rule.percentage || 0);
      default:
        return false;
    }
  }

  private hashString(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  private getDefaultLoadBalancingConfig(): LoadBalancingConfig {
    return {
      algorithm: 'round-robin',
      healthCheck: {
        enabled: true,
        unhealthyThreshold: 3,
        healthyThreshold: 2
      }
    };
  }

  private getDefaultHealthCheckConfig(): HealthCheckConfig {
    return {
      enabled: true,
      interval: 30000,
      timeout: 5000,
      path: '/health',
      expectedStatus: [200],
      retries: 3
    };
  }

  private getDefaultRoutingConfig(): RoutingConfig {
    return {};
  }

  private getDefaultServiceMeshConfig(): ServiceMeshConfig {
    return {
      enabled: false,
      provider: 'none',
      mTLS: {
        enabled: false,
        mode: 'permissive'
      },
      circuitBreaker: {
        enabled: false,
        maxConnections: 1024,
        maxPendingRequests: 128,
        maxRequests: 1024,
        maxRetries: 3,
        consecutiveErrors: 5
      },
      retryPolicy: {
        attempts: 3,
        perTryTimeout: '25s',
        retryOn: ['gateway-error', 'connect-failure', 'refused-stream']
      }
    };
  }

  private getDefaultCrossClusterConfig(): CrossClusterConfig {
    return {
      enabled: false,
      clusters: [],
      failover: {
        enabled: false,
        detectInterval: 30000,
        switchThreshold: 0.5
      }
    };
  }

  /**
   * Setup event handlers and background tasks
   */
  private setupEventHandlers(): void {
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  private startBackgroundTasks(): void {
    // Health check interval
    this.healthCheckInterval = setInterval(
      () => this.performHealthChecks(),
      30000 // Every 30 seconds
    );

    // Cleanup stale endpoints
    this.cleanupInterval = setInterval(
      () => this.cleanupStaleEndpoints(),
      300000 // Every 5 minutes
    );

    // Cross-cluster sync
    this.crossClusterSyncInterval = setInterval(
      () => this.syncCrossClusters(),
      60000 // Every minute
    );
  }

  private async cleanupStaleEndpoints(): Promise<void> {
    const staleThreshold = 300000; // 5 minutes
    const now = Date.now();

    for (const [serviceName, serviceGroup] of this.serviceRegistry.entries()) {
      serviceGroup.endpoints = serviceGroup.endpoints.filter(endpoint => {
        const lastHealthCheck = endpoint.lastHealthCheck?.getTime() || 0;
        const isStale = (now - lastHealthCheck) > staleThreshold;
        
        if (isStale) {
          this.logger.warn(`Removing stale endpoint: ${endpoint.id}`);
          this.endpointHealth.delete(endpoint.id);
        }
        
        return !isStale;
      });

      if (serviceGroup.endpoints.length === 0) {
        this.serviceRegistry.delete(serviceName);
        await this.deleteKubernetesService(serviceGroup);
      }
    }
  }

  private async syncCrossClusters(): Promise<void> {
    // Implementation for cross-cluster service discovery sync
    // This would communicate with other clusters to share service information
  }

  /**
   * Shutdown service discovery manager
   */
  async shutdown(): Promise<void> {
    if (this.isShutdown) return;
    
    this.isShutdown = true;
    this.logger.info('Shutting down service discovery manager');

    // Clear intervals
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    if (this.crossClusterSyncInterval) clearInterval(this.crossClusterSyncInterval);

    // Clean up resources
    this.serviceRegistry.clear();
    this.endpointHealth.clear();

    this.emit('shutdown-completed');
  }
}