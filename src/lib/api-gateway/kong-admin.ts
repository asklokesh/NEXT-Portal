import { z } from 'zod';

// Kong Admin API Types
export interface KongService {
  id: string;
  name: string;
  protocol: 'http' | 'https' | 'grpc' | 'grpcs' | 'tcp' | 'tls';
  host: string;
  port: number;
  path?: string;
  connect_timeout: number;
  write_timeout: number;
  read_timeout: number;
  retries: number;
  tags: string[];
  created_at: number;
  updated_at: number;
}

export interface KongRoute {
  id: string;
  name: string;
  protocols: string[];
  methods: string[];
  hosts?: string[];
  paths?: string[];
  headers?: Record<string, string[]>;
  https_redirect_status_code: number;
  strip_path: boolean;
  preserve_host: boolean;
  regex_priority: number;
  service: { id: string };
  tags: string[];
  created_at: number;
  updated_at: number;
}

export interface KongPlugin {
  id: string;
  name: string;
  config: Record<string, any>;
  enabled: boolean;
  protocols: string[];
  consumer?: { id: string };
  service?: { id: string };
  route?: { id: string };
  tags: string[];
  created_at: number;
  updated_at: number;
}

export interface KongConsumer {
  id: string;
  username: string;
  custom_id?: string;
  tags: string[];
  created_at: number;
  updated_at: number;
}

export interface KongUpstream {
  id: string;
  name: string;
  algorithm: 'round-robin' | 'consistent-hashing' | 'least-connections';
  hash_on: string;
  hash_fallback: string;
  healthchecks: {
    active: {
      type: string;
      timeout: number;
      concurrency: number;
      http_path: string;
      https_verify_certificate: boolean;
      healthy: {
        interval: number;
        http_statuses: number[];
        successes: number;
      };
      unhealthy: {
        interval: number;
        http_statuses: number[];
        tcp_failures: number;
        timeouts: number;
        http_failures: number;
      };
    };
    passive: {
      type: string;
      healthy: {
        http_statuses: number[];
        successes: number;
      };
      unhealthy: {
        http_statuses: number[];
        tcp_failures: number;
        timeouts: number;
        http_failures: number;
      };
    };
  };
  tags: string[];
  created_at: number;
  updated_at: number;
}

export interface KongTarget {
  id: string;
  target: string;
  weight: number;
  upstream: { id: string };
  tags: string[];
  created_at: number;
  updated_at: number;
}

const CreateServiceSchema = z.object({
  name: z.string(),
  protocol: z.enum(['http', 'https', 'grpc', 'grpcs', 'tcp', 'tls']),
  host: z.string(),
  port: z.number().min(1).max(65535),
  path: z.string().optional(),
  connect_timeout: z.number().default(60000),
  write_timeout: z.number().default(60000),
  read_timeout: z.number().default(60000),
  retries: z.number().default(5),
  tags: z.array(z.string()).default([]),
});

const CreateRouteSchema = z.object({
  name: z.string(),
  protocols: z.array(z.string()).default(['http', 'https']),
  methods: z.array(z.string()).optional(),
  hosts: z.array(z.string()).optional(),
  paths: z.array(z.string()).optional(),
  headers: z.record(z.array(z.string())).optional(),
  https_redirect_status_code: z.number().default(426),
  strip_path: z.boolean().default(true),
  preserve_host: z.boolean().default(false),
  regex_priority: z.number().default(0),
  service: z.object({ id: z.string() }),
  tags: z.array(z.string()).default([]),
});

const CreatePluginSchema = z.object({
  name: z.string(),
  config: z.record(z.any()).default({}),
  enabled: z.boolean().default(true),
  protocols: z.array(z.string()).default(['http', 'https']),
  consumer: z.object({ id: z.string() }).optional(),
  service: z.object({ id: z.string() }).optional(),
  route: z.object({ id: z.string() }).optional(),
  tags: z.array(z.string()).default([]),
});

export class KongAdminClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl: string, apiKey?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = apiKey;
  }

  /**
   * Make authenticated request to Kong Admin API
   */
  private async request<T = any>(
    method: string,
    endpoint: string,
    data?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Kong-Admin-Token'] = this.apiKey;
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Kong Admin API error: ${response.status} ${error}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      throw new Error(`Kong Admin API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get Kong node information
   */
  async getNodeInfo(): Promise<{
    hostname: string;
    node_id: string;
    version: string;
    lua_version: string;
    configuration: Record<string, any>;
  }> {
    return this.request('GET', '/');
  }

  /**
   * Get Kong node status
   */
  async getNodeStatus(): Promise<{
    database: { reachable: boolean };
    server: { connections_accepted: number; connections_active: number; connections_handled: number; connections_reading: number; connections_waiting: number; connections_writing: number; total_requests: number };
  }> {
    return this.request('GET', '/status');
  }

  // Services Management
  /**
   * Create a new service
   */
  async createService(serviceData: z.infer<typeof CreateServiceSchema>): Promise<KongService> {
    const validatedData = CreateServiceSchema.parse(serviceData);
    return this.request('POST', '/services', validatedData);
  }

  /**
   * Get all services
   */
  async getServices(options?: { tags?: string; offset?: string; size?: number }): Promise<{
    data: KongService[];
    next?: string;
    offset?: string;
  }> {
    const params = new URLSearchParams();
    if (options?.tags) params.append('tags', options.tags);
    if (options?.offset) params.append('offset', options.offset);
    if (options?.size) params.append('size', options.size.toString());

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request('GET', `/services${query}`);
  }

  /**
   * Get service by ID or name
   */
  async getService(serviceId: string): Promise<KongService> {
    return this.request('GET', `/services/${serviceId}`);
  }

  /**
   * Update service
   */
  async updateService(serviceId: string, updateData: Partial<z.infer<typeof CreateServiceSchema>>): Promise<KongService> {
    return this.request('PATCH', `/services/${serviceId}`, updateData);
  }

  /**
   * Delete service
   */
  async deleteService(serviceId: string): Promise<void> {
    return this.request('DELETE', `/services/${serviceId}`);
  }

  // Routes Management
  /**
   * Create a new route
   */
  async createRoute(routeData: z.infer<typeof CreateRouteSchema>): Promise<KongRoute> {
    const validatedData = CreateRouteSchema.parse(routeData);
    return this.request('POST', '/routes', validatedData);
  }

  /**
   * Get all routes
   */
  async getRoutes(options?: { tags?: string; offset?: string; size?: number }): Promise<{
    data: KongRoute[];
    next?: string;
    offset?: string;
  }> {
    const params = new URLSearchParams();
    if (options?.tags) params.append('tags', options.tags);
    if (options?.offset) params.append('offset', options.offset);
    if (options?.size) params.append('size', options.size.toString());

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request('GET', `/routes${query}`);
  }

  /**
   * Get route by ID
   */
  async getRoute(routeId: string): Promise<KongRoute> {
    return this.request('GET', `/routes/${routeId}`);
  }

  /**
   * Get routes for a service
   */
  async getRoutesForService(serviceId: string): Promise<{
    data: KongRoute[];
    next?: string;
  }> {
    return this.request('GET', `/services/${serviceId}/routes`);
  }

  /**
   * Update route
   */
  async updateRoute(routeId: string, updateData: Partial<z.infer<typeof CreateRouteSchema>>): Promise<KongRoute> {
    return this.request('PATCH', `/routes/${routeId}`, updateData);
  }

  /**
   * Delete route
   */
  async deleteRoute(routeId: string): Promise<void> {
    return this.request('DELETE', `/routes/${routeId}`);
  }

  // Plugins Management
  /**
   * Create a new plugin
   */
  async createPlugin(pluginData: z.infer<typeof CreatePluginSchema>): Promise<KongPlugin> {
    const validatedData = CreatePluginSchema.parse(pluginData);
    return this.request('POST', '/plugins', validatedData);
  }

  /**
   * Get all plugins
   */
  async getPlugins(options?: { name?: string; service_id?: string; route_id?: string; consumer_id?: string }): Promise<{
    data: KongPlugin[];
    next?: string;
  }> {
    const params = new URLSearchParams();
    if (options?.name) params.append('name', options.name);
    if (options?.service_id) params.append('service_id', options.service_id);
    if (options?.route_id) params.append('route_id', options.route_id);
    if (options?.consumer_id) params.append('consumer_id', options.consumer_id);

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request('GET', `/plugins${query}`);
  }

  /**
   * Get plugin by ID
   */
  async getPlugin(pluginId: string): Promise<KongPlugin> {
    return this.request('GET', `/plugins/${pluginId}`);
  }

  /**
   * Update plugin
   */
  async updatePlugin(pluginId: string, updateData: Partial<z.infer<typeof CreatePluginSchema>>): Promise<KongPlugin> {
    return this.request('PATCH', `/plugins/${pluginId}`, updateData);
  }

  /**
   * Delete plugin
   */
  async deletePlugin(pluginId: string): Promise<void> {
    return this.request('DELETE', `/plugins/${pluginId}`);
  }

  // Consumers Management
  /**
   * Create a new consumer
   */
  async createConsumer(consumerData: { username: string; custom_id?: string; tags?: string[] }): Promise<KongConsumer> {
    return this.request('POST', '/consumers', consumerData);
  }

  /**
   * Get all consumers
   */
  async getConsumers(options?: { custom_id?: string; username?: string; tags?: string }): Promise<{
    data: KongConsumer[];
    next?: string;
  }> {
    const params = new URLSearchParams();
    if (options?.custom_id) params.append('custom_id', options.custom_id);
    if (options?.username) params.append('username', options.username);
    if (options?.tags) params.append('tags', options.tags);

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request('GET', `/consumers${query}`);
  }

  /**
   * Get consumer by ID or username
   */
  async getConsumer(consumerId: string): Promise<KongConsumer> {
    return this.request('GET', `/consumers/${consumerId}`);
  }

  /**
   * Update consumer
   */
  async updateConsumer(consumerId: string, updateData: { username?: string; custom_id?: string; tags?: string[] }): Promise<KongConsumer> {
    return this.request('PATCH', `/consumers/${consumerId}`, updateData);
  }

  /**
   * Delete consumer
   */
  async deleteConsumer(consumerId: string): Promise<void> {
    return this.request('DELETE', `/consumers/${consumerId}`);
  }

  // Consumer Credentials Management
  /**
   * Create JWT credential for consumer
   */
  async createJWTCredential(consumerId: string, credentialData: {
    key?: string;
    algorithm?: 'HS256' | 'HS384' | 'HS512' | 'RS256' | 'RS384' | 'RS512';
    rsa_public_key?: string;
    secret?: string;
    tags?: string[];
  }): Promise<any> {
    return this.request('POST', `/consumers/${consumerId}/jwt`, credentialData);
  }

  /**
   * Create API key credential for consumer
   */
  async createKeyAuthCredential(consumerId: string, credentialData: {
    key?: string;
    tags?: string[];
  }): Promise<any> {
    return this.request('POST', `/consumers/${consumerId}/key-auth`, credentialData);
  }

  /**
   * Create OAuth2 credential for consumer
   */
  async createOAuth2Credential(consumerId: string, credentialData: {
    name: string;
    client_id?: string;
    client_secret?: string;
    redirect_uris: string[];
    tags?: string[];
  }): Promise<any> {
    return this.request('POST', `/consumers/${consumerId}/oauth2`, credentialData);
  }

  // Upstreams Management
  /**
   * Create upstream
   */
  async createUpstream(upstreamData: {
    name: string;
    algorithm?: 'round-robin' | 'consistent-hashing' | 'least-connections';
    hash_on?: string;
    hash_fallback?: string;
    healthchecks?: any;
    tags?: string[];
  }): Promise<KongUpstream> {
    return this.request('POST', '/upstreams', upstreamData);
  }

  /**
   * Get all upstreams
   */
  async getUpstreams(): Promise<{ data: KongUpstream[]; next?: string }> {
    return this.request('GET', '/upstreams');
  }

  /**
   * Get upstream by ID or name
   */
  async getUpstream(upstreamId: string): Promise<KongUpstream> {
    return this.request('GET', `/upstreams/${upstreamId}`);
  }

  /**
   * Update upstream
   */
  async updateUpstream(upstreamId: string, updateData: any): Promise<KongUpstream> {
    return this.request('PATCH', `/upstreams/${upstreamId}`, updateData);
  }

  /**
   * Delete upstream
   */
  async deleteUpstream(upstreamId: string): Promise<void> {
    return this.request('DELETE', `/upstreams/${upstreamId}`);
  }

  /**
   * Create target for upstream
   */
  async createTarget(upstreamId: string, targetData: {
    target: string;
    weight?: number;
    tags?: string[];
  }): Promise<KongTarget> {
    return this.request('POST', `/upstreams/${upstreamId}/targets`, targetData);
  }

  /**
   * Get targets for upstream
   */
  async getTargets(upstreamId: string): Promise<{ data: KongTarget[]; next?: string }> {
    return this.request('GET', `/upstreams/${upstreamId}/targets`);
  }

  /**
   * Delete target
   */
  async deleteTarget(upstreamId: string, targetId: string): Promise<void> {
    return this.request('DELETE', `/upstreams/${upstreamId}/targets/${targetId}`);
  }

  // Health and Status
  /**
   * Get upstream health
   */
  async getUpstreamHealth(upstreamId: string): Promise<any> {
    return this.request('GET', `/upstreams/${upstreamId}/health`);
  }

  /**
   * Set target health status
   */
  async setTargetHealth(upstreamId: string, targetId: string, healthy: boolean): Promise<void> {
    const action = healthy ? 'healthy' : 'unhealthy';
    return this.request('PUT', `/upstreams/${upstreamId}/targets/${targetId}/${action}`);
  }

  // Certificates Management
  /**
   * Create certificate
   */
  async createCertificate(certData: {
    cert: string;
    key: string;
    snis?: string[];
    tags?: string[];
  }): Promise<any> {
    return this.request('POST', '/certificates', certData);
  }

  /**
   * Get all certificates
   */
  async getCertificates(): Promise<{ data: any[]; next?: string }> {
    return this.request('GET', '/certificates');
  }

  // SNIs Management
  /**
   * Create SNI
   */
  async createSNI(sniData: {
    name: string;
    certificate: { id: string };
    tags?: string[];
  }): Promise<any> {
    return this.request('POST', '/snis', sniData);
  }

  // Clustering and Configuration
  /**
   * Get cluster status
   */
  async getClusterStatus(): Promise<any> {
    return this.request('GET', '/clustering/status');
  }

  /**
   * Reload declarative configuration
   */
  async reloadDeclarativeConfig(): Promise<void> {
    return this.request('POST', '/config', { config: 'reload' });
  }

  // Metrics and Monitoring
  /**
   * Get metrics (if prometheus plugin is enabled)
   */
  async getMetrics(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/metrics`, {
      headers: this.apiKey ? { 'Kong-Admin-Token': this.apiKey } : {},
    });
    return response.text();
  }

  // Bulk Operations
  /**
   * Export configuration
   */
  async exportConfiguration(): Promise<any> {
    return this.request('GET', '/config');
  }

  /**
   * Import configuration
   */
  async importConfiguration(config: any): Promise<void> {
    return this.request('POST', '/config', config);
  }

  /**
   * Backup Kong configuration
   */
  async backupConfiguration(): Promise<{
    services: KongService[];
    routes: KongRoute[];
    plugins: KongPlugin[];
    consumers: KongConsumer[];
    upstreams: KongUpstream[];
    certificates: any[];
  }> {
    const [services, routes, plugins, consumers, upstreams, certificates] = await Promise.all([
      this.getServices({ size: 1000 }),
      this.getRoutes({ size: 1000 }),
      this.getPlugins(),
      this.getConsumers(),
      this.getUpstreams(),
      this.getCertificates(),
    ]);

    return {
      services: services.data,
      routes: routes.data,
      plugins: plugins.data,
      consumers: consumers.data,
      upstreams: upstreams.data,
      certificates: certificates.data,
    };
  }

  /**
   * Restore Kong configuration
   */
  async restoreConfiguration(backup: {
    services: KongService[];
    routes: KongRoute[];
    plugins: KongPlugin[];
    consumers: KongConsumer[];
    upstreams: KongUpstream[];
    certificates: any[];
  }): Promise<void> {
    // Import in dependency order
    
    // First, create services and upstreams
    for (const service of backup.services) {
      const { id, created_at, updated_at, ...serviceData } = service;
      await this.createService(serviceData);
    }

    for (const upstream of backup.upstreams) {
      const { id, created_at, updated_at, ...upstreamData } = upstream;
      await this.createUpstream(upstreamData);
    }

    // Then routes (depend on services)
    for (const route of backup.routes) {
      const { id, created_at, updated_at, ...routeData } = route;
      await this.createRoute(routeData);
    }

    // Then consumers
    for (const consumer of backup.consumers) {
      const { id, created_at, updated_at, ...consumerData } = consumer;
      await this.createConsumer(consumerData);
    }

    // Finally plugins (can depend on services, routes, consumers)
    for (const plugin of backup.plugins) {
      const { id, created_at, updated_at, ...pluginData } = plugin;
      await this.createPlugin(pluginData);
    }

    // Certificates
    for (const cert of backup.certificates) {
      const { id, created_at, updated_at, ...certData } = cert;
      await this.createCertificate(certData);
    }
  }
}