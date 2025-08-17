/**
 * Production Backstage Client
 * Real implementation for connecting to Backstage API with comprehensive error handling
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { Entity, CompoundEntityRef } from '@backstage/catalog-model';
import { prisma } from '../db/client';
import NodeCache from 'node-cache';

export interface BackstageConfig {
  baseUrl: string;
  token?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  cacheEnabled?: boolean;
  cacheTtl?: number;
}

export interface CatalogEntityRequest {
  kind?: string;
  namespace?: string;
  name?: string;
  limit?: number;
  offset?: number;
  filter?: Record<string, any>;
}

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  version?: string;
  uptime?: number;
  services: {
    catalog: 'healthy' | 'unhealthy';
    scaffolder: 'healthy' | 'unhealthy';
    techdocs: 'healthy' | 'unhealthy';
    kubernetes: 'healthy' | 'unhealthy';
  };
  lastCheck: string;
}

export interface PluginInfo {
  name: string;
  version: string;
  enabled: boolean;
  configuration?: Record<string, any>;
  dependencies: string[];
  healthStatus: 'healthy' | 'warning' | 'critical';
  lastHealthCheck: string;
}

/**
 * Production-ready Backstage client with real API integration
 */
export class ProductionBackstageClient {
  private readonly client: AxiosInstance;
  private readonly cache?: NodeCache;
  private readonly config: Required<BackstageConfig>;
  private healthStatus: HealthCheckResult | null = null;

  constructor(config: BackstageConfig) {
    this.config = {
      retryAttempts: 3,
      retryDelay: 1000,
      cacheEnabled: true,
      cacheTtl: 300, // 5 minutes
      timeout: 30000,
      ...config,
    };

    // Initialize cache if enabled
    if (this.config.cacheEnabled) {
      this.cache = new NodeCache({ 
        stdTTL: this.config.cacheTtl,
        checkperiod: this.config.cacheTtl * 0.2,
        useClones: false
      });
    }

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SaaS-IDP/1.0',
        ...(this.config.token && { Authorization: `Bearer ${this.config.token}` }),
      },
    });

    this.setupInterceptors();
    this.startHealthMonitoring();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        console.log(`[Backstage API] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('[Backstage API] Request error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor with retry logic
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const config = error.config;
        
        // Don't retry if we've already retried max times
        if (!config || config.__retryCount >= this.config.retryAttempts) {
          return Promise.reject(error);
        }

        config.__retryCount = (config.__retryCount || 0) + 1;

        // Only retry on network errors or 5xx status codes
        if (
          error.code === 'ECONNREFUSED' ||
          error.code === 'ENOTFOUND' ||
          error.code === 'ETIMEDOUT' ||
          (error.response && error.response.status >= 500)
        ) {
          console.log(`[Backstage API] Retrying request (${config.__retryCount}/${this.config.retryAttempts})`);
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
          
          return this.client.request(config);
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Start periodic health monitoring
   */
  private startHealthMonitoring() {
    // Initial health check
    this.performHealthCheck().catch(console.error);
    
    // Periodic health checks every 2 minutes
    setInterval(() => {
      this.performHealthCheck().catch(console.error);
    }, 120000);
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    try {
      const startTime = Date.now();
      
      // Check main API health
      const healthResponse = await this.client.get('/api/health', { timeout: 10000 });
      const catalogHealth = await this.checkServiceHealth('/api/catalog/health');
      const scaffolderHealth = await this.checkServiceHealth('/api/scaffolder/v2/health');
      const techDocsHealth = await this.checkServiceHealth('/api/techdocs/health');
      const kubernetesHealth = await this.checkServiceHealth('/api/kubernetes/health');

      this.healthStatus = {
        status: 'healthy',
        version: healthResponse.data.version || 'unknown',
        uptime: Date.now() - startTime,
        services: {
          catalog: catalogHealth ? 'healthy' : 'unhealthy',
          scaffolder: scaffolderHealth ? 'healthy' : 'unhealthy',
          techdocs: techDocsHealth ? 'healthy' : 'unhealthy',
          kubernetes: kubernetesHealth ? 'healthy' : 'unhealthy',
        },
        lastCheck: new Date().toISOString(),
      };

      // Store health status in database
      await this.storeHealthStatus(this.healthStatus);

      return this.healthStatus;
    } catch (error) {
      console.error('[Backstage API] Health check failed:', error);
      
      this.healthStatus = {
        status: 'unhealthy',
        services: {
          catalog: 'unhealthy',
          scaffolder: 'unhealthy',
          techdocs: 'unhealthy',
          kubernetes: 'unhealthy',
        },
        lastCheck: new Date().toISOString(),
      };

      await this.storeHealthStatus(this.healthStatus);
      return this.healthStatus;
    }
  }

  private async checkServiceHealth(endpoint: string): Promise<boolean> {
    try {
      await this.client.get(endpoint, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  private async storeHealthStatus(health: HealthCheckResult) {
    try {
      await prisma.systemHealth.upsert({
        where: { service: 'backstage' },
        update: {
          status: health.status.toUpperCase() as any,
          metadata: health as any,
          checkedAt: new Date(),
        },
        create: {
          service: 'backstage',
          status: health.status.toUpperCase() as any,
          metadata: health as any,
          checkedAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Failed to store health status:', error);
    }
  }

  /**
   * Get current health status
   */
  getHealthStatus(): HealthCheckResult | null {
    return this.healthStatus;
  }

  /**
   * Get catalog entities with caching and fallback
   */
  async getCatalogEntities(request: CatalogEntityRequest = {}): Promise<Entity[]> {
    const cacheKey = `catalog-entities-${JSON.stringify(request)}`;
    
    // Check cache first
    if (this.cache) {
      const cached = this.cache.get<Entity[]>(cacheKey);
      if (cached) {
        console.log(`[Backstage API] Cache hit for ${cacheKey}`);
        return cached;
      }
    }

    try {
      const params = new URLSearchParams();
      
      if (request.kind) params.append('filter', `kind=${request.kind}`);
      if (request.namespace) params.append('filter', `metadata.namespace=${request.namespace}`);
      if (request.limit) params.append('limit', request.limit.toString());
      if (request.offset) params.append('offset', request.offset.toString());

      // Add additional filters
      if (request.filter) {
        Object.entries(request.filter).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            value.forEach(v => params.append('filter', `${key}=${v}`));
          } else {
            params.append('filter', `${key}=${value}`);
          }
        });
      }

      const response: AxiosResponse<{ items: Entity[] }> = await this.client.get(
        `/api/catalog/entities?${params.toString()}`
      );

      const entities = response.data.items || [];

      // Cache the result
      if (this.cache && entities.length > 0) {
        this.cache.set(cacheKey, entities);
      }

      // Sync to database asynchronously
      this.syncEntitiesToDatabase(entities).catch(console.error);

      return entities;
    } catch (error) {
      console.error('Failed to fetch catalog entities:', error);
      
      // Try fallback from database
      return this.getFallbackEntitiesFromDatabase(request);
    }
  }

  /**
   * Get entity by reference with caching
   */
  async getEntityByRef(entityRef: string | CompoundEntityRef): Promise<Entity | null> {
    const ref = typeof entityRef === 'string' ? entityRef : this.stringifyEntityRef(entityRef);
    const cacheKey = `entity-${ref}`;
    
    // Check cache first
    if (this.cache) {
      const cached = this.cache.get<Entity>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const encodedRef = encodeURIComponent(ref);
      const response: AxiosResponse<Entity> = await this.client.get(
        `/api/catalog/entities/by-name/${encodedRef}`
      );

      const entity = response.data;
      
      // Cache the result
      if (this.cache) {
        this.cache.set(cacheKey, entity);
      }

      return entity;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      console.error('Failed to fetch entity by ref:', error);
      
      // Try fallback from database
      return this.getFallbackEntityFromDatabase(ref);
    }
  }

  /**
   * Get templates with real Backstage integration
   */
  async getTemplates(): Promise<Entity[]> {
    const cacheKey = 'templates';
    
    if (this.cache) {
      const cached = this.cache.get<Entity[]>(cacheKey);
      if (cached) return cached;
    }

    try {
      const params = new URLSearchParams();
      params.append('filter', 'kind=Template');

      const response: AxiosResponse<{ items: Entity[] }> = await this.client.get(
        `/api/catalog/entities?${params.toString()}`
      );

      const templates = response.data.items || [];
      
      if (this.cache) {
        this.cache.set(cacheKey, templates);
      }

      return templates;
    } catch (error) {
      console.error('Failed to fetch templates:', error);
      return this.getFallbackTemplatesFromDatabase();
    }
  }

  /**
   * Get installed plugins with real health monitoring
   */
  async getInstalledPlugins(): Promise<PluginInfo[]> {
    const cacheKey = 'installed-plugins';
    
    if (this.cache) {
      const cached = this.cache.get<PluginInfo[]>(cacheKey);
      if (cached) return cached;
    }

    try {
      // Get dynamic plugins configuration
      const configResponse = await this.client.get('/api/app/config');
      const config = configResponse.data;
      
      const plugins: PluginInfo[] = [];
      
      // Extract plugins from dynamic plugins configuration
      if (config.dynamicPlugins?.frontend) {
        for (const [pluginName, pluginConfig] of Object.entries(config.dynamicPlugins.frontend)) {
          const plugin: PluginInfo = {
            name: pluginName,
            version: await this.getPluginVersion(pluginName),
            enabled: pluginConfig.enabled !== false,
            configuration: pluginConfig,
            dependencies: await this.getPluginDependencies(pluginName),
            healthStatus: await this.checkPluginHealth(pluginName),
            lastHealthCheck: new Date().toISOString(),
          };
          plugins.push(plugin);
        }
      }

      // Check backend plugins
      if (config.dynamicPlugins?.backend) {
        for (const [pluginName, pluginConfig] of Object.entries(config.dynamicPlugins.backend)) {
          const plugin: PluginInfo = {
            name: pluginName,
            version: await this.getPluginVersion(pluginName),
            enabled: pluginConfig.enabled !== false,
            configuration: pluginConfig,
            dependencies: await this.getPluginDependencies(pluginName),
            healthStatus: await this.checkPluginHealth(pluginName),
            lastHealthCheck: new Date().toISOString(),
          };
          plugins.push(plugin);
        }
      }

      if (this.cache) {
        this.cache.set(cacheKey, plugins);
      }

      return plugins;
    } catch (error) {
      console.error('Failed to fetch installed plugins:', error);
      return this.getFallbackPluginsFromDatabase();
    }
  }

  private async getPluginVersion(pluginName: string): Promise<string> {
    try {
      // Try to get version from package.json or plugin manifest
      const response = await this.client.get(`/api/plugins/${encodeURIComponent(pluginName)}/manifest`);
      return response.data.version || '1.0.0';
    } catch {
      return '1.0.0';
    }
  }

  private async getPluginDependencies(pluginName: string): Promise<string[]> {
    try {
      const response = await this.client.get(`/api/plugins/${encodeURIComponent(pluginName)}/dependencies`);
      return response.data.dependencies || [];
    } catch {
      return [];
    }
  }

  private async checkPluginHealth(pluginName: string): Promise<'healthy' | 'warning' | 'critical'> {
    try {
      const response = await this.client.get(`/api/plugins/${encodeURIComponent(pluginName)}/health`);
      return response.data.status === 'ok' ? 'healthy' : 'warning';
    } catch {
      return 'critical';
    }
  }

  /**
   * Fallback methods for database integration
   */
  private async getFallbackEntitiesFromDatabase(request: CatalogEntityRequest): Promise<Entity[]> {
    try {
      const services = await prisma.service.findMany({
        take: request.limit,
        skip: request.offset,
        include: {
          owner: true,
          team: true,
        },
      });

      return services.map(service => this.serviceToEntity(service));
    } catch (error) {
      console.error('Failed to get fallback entities from database:', error);
      return [];
    }
  }

  private async getFallbackEntityFromDatabase(entityRef: string): Promise<Entity | null> {
    try {
      // Parse entity reference
      const [kind, namespaceAndName] = entityRef.split(':');
      const [namespace, name] = namespaceAndName?.split('/') || ['default', namespaceAndName];

      const service = await prisma.service.findFirst({
        where: {
          name: name,
          namespace: namespace,
        },
        include: {
          owner: true,
          team: true,
        },
      });

      return service ? this.serviceToEntity(service) : null;
    } catch (error) {
      console.error('Failed to get fallback entity from database:', error);
      return null;
    }
  }

  private async getFallbackTemplatesFromDatabase(): Promise<Entity[]> {
    try {
      const templates = await prisma.template.findMany({
        where: { isActive: true },
      });

      return templates.map(template => ({
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Template',
        metadata: {
          name: template.name,
          title: template.displayName,
          description: template.description,
          tags: template.tags,
          namespace: 'default',
        },
        spec: template.content as any,
      }));
    } catch (error) {
      console.error('Failed to get fallback templates from database:', error);
      return [];
    }
  }

  private async getFallbackPluginsFromDatabase(): Promise<PluginInfo[]> {
    try {
      const plugins = await prisma.plugin.findMany({
        where: { isInstalled: true },
      });

      return plugins.map(plugin => ({
        name: plugin.name,
        version: plugin.version,
        enabled: plugin.isEnabled,
        configuration: plugin.configuration as any,
        dependencies: plugin.dependencies as string[] || [],
        healthStatus: 'warning' as const,
        lastHealthCheck: plugin.updatedAt.toISOString(),
      }));
    } catch (error) {
      console.error('Failed to get fallback plugins from database:', error);
      return [];
    }
  }

  private async syncEntitiesToDatabase(entities: Entity[]): Promise<void> {
    try {
      for (const entity of entities) {
        if (entity.kind === 'Component') {
          await this.syncComponentToDatabase(entity);
        }
      }
    } catch (error) {
      console.error('Failed to sync entities to database:', error);
    }
  }

  private async syncComponentToDatabase(entity: Entity): Promise<void> {
    try {
      const serviceData = {
        name: entity.metadata.name,
        displayName: entity.metadata.title || entity.metadata.name,
        description: entity.metadata.description || '',
        type: ((entity.spec?.type as string) || 'service').toUpperCase() as any,
        lifecycle: ((entity.spec?.lifecycle as string) || 'experimental').toUpperCase() as any,
        namespace: entity.metadata.namespace || 'default',
        tags: entity.metadata.tags || [],
        labels: entity.metadata.labels,
        annotations: entity.metadata.annotations,
      };

      await prisma.service.upsert({
        where: { name: entity.metadata.name },
        update: serviceData,
        create: {
          ...serviceData,
          ownerId: await this.getDefaultUserId(),
          teamId: await this.getDefaultTeamId(),
        },
      });
    } catch (error) {
      console.error(`Failed to sync component ${entity.metadata.name}:`, error);
    }
  }

  private serviceToEntity(service: any): Entity {
    return {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: service.name,
        title: service.displayName,
        description: service.description,
        namespace: service.namespace || 'default',
        tags: service.tags || [],
        labels: service.labels || {},
        annotations: service.annotations || {},
      },
      spec: {
        type: service.type?.toLowerCase() || 'service',
        lifecycle: service.lifecycle?.toLowerCase() || 'production',
        owner: service.team?.name || service.owner?.name || 'guest',
      },
    };
  }

  private async getDefaultUserId(): Promise<string> {
    const user = await prisma.user.findFirst();
    return user?.id || '';
  }

  private async getDefaultTeamId(): Promise<string> {
    const team = await prisma.team.findFirst();
    return team?.id || '';
  }

  private stringifyEntityRef(ref: CompoundEntityRef): string {
    const parts = [];
    if (ref.kind) parts.push(ref.kind);
    if (ref.namespace && ref.namespace !== 'default') {
      parts.push(ref.namespace);
    }
    parts.push(ref.name);
    return parts.join(':');
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    if (this.cache) {
      this.cache.flushAll();
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.cache) {
      this.cache.flushAll();
      this.cache.close();
    }
  }
}

// Factory function for creating production client
export function createProductionBackstageClient(token?: string): ProductionBackstageClient {
  return new ProductionBackstageClient({
    baseUrl: process.env.BACKSTAGE_BACKEND_URL || 'http://localhost:4402',
    token: token || process.env.BACKSTAGE_API_TOKEN,
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
    cacheEnabled: process.env.NODE_ENV === 'production',
    cacheTtl: 300, // 5 minutes
  });
}

// Default instance
export const productionBackstageClient = createProductionBackstageClient();