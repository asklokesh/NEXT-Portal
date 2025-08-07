/**
 * Multi-Source Discovery Engine
 * 
 * Core orchestration engine for automated service discovery and registration.
 * Provides pluggable architecture for multiple discovery sources with
 * intelligent aggregation, deduplication, and relationship inference.
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { z } from 'zod';

// Core Types and Schemas
export const ServiceDiscoveryEventSchema = z.object({
  type: z.enum(['service_discovered', 'service_updated', 'service_removed', 'discovery_error']),
  source: z.string(),
  timestamp: z.date(),
  data: z.any(),
  metadata: z.record(z.any()).optional(),
});

export const DiscoveredServiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['api', 'web', 'database', 'queue', 'microservice', 'function', 'storage', 'other']),
  source: z.string(),
  discoveredAt: z.date(),
  lastSeen: z.date(),
  confidence: z.number().min(0).max(1),
  metadata: z.record(z.any()),
  endpoints: z.array(z.object({
    url: z.string(),
    type: z.enum(['http', 'grpc', 'tcp', 'udp']),
    protocol: z.string(),
    health: z.enum(['healthy', 'unhealthy', 'unknown']).optional(),
  })).optional(),
  dependencies: z.array(z.string()).optional(),
  owner: z.object({
    team: z.string().optional(),
    individual: z.string().optional(),
    email: z.string().email().optional(),
  }).optional(),
  repository: z.object({
    url: z.string(),
    branch: z.string().optional(),
    commit: z.string().optional(),
  }).optional(),
  deployment: z.object({
    environment: z.string(),
    cluster: z.string().optional(),
    namespace: z.string().optional(),
    region: z.string().optional(),
  }).optional(),
  metrics: z.object({
    cpu: z.number().optional(),
    memory: z.number().optional(),
    requests: z.number().optional(),
    errors: z.number().optional(),
    latency: z.number().optional(),
  }).optional(),
});

export type ServiceDiscoveryEvent = z.infer<typeof ServiceDiscoveryEventSchema>;
export type DiscoveredService = z.infer<typeof DiscoveredServiceSchema>;

// Discovery Source Interface
export interface IDiscoverySource {
  readonly name: string;
  readonly version: string;
  readonly priority: number;
  
  initialize(config: any): Promise<void>;
  discover(): Promise<DiscoveredService[]>;
  healthCheck(): Promise<boolean>;
  dispose(): Promise<void>;
}

// Discovery Configuration
export interface DiscoveryEngineConfig {
  sources: {
    [key: string]: {
      enabled: boolean;
      config: any;
      priority: number;
      schedule?: string; // Cron expression
    };
  };
  aggregation: {
    deduplicationStrategy: 'merge' | 'latest' | 'highest_confidence';
    relationshipInference: boolean;
    confidenceThreshold: number;
  };
  storage: {
    type: 'memory' | 'redis' | 'database';
    config: any;
  };
  notifications: {
    enabled: boolean;
    channels: string[];
  };
}

// Discovery Engine Implementation
export class ServiceDiscoveryEngine extends EventEmitter {
  private sources: Map<string, IDiscoverySource> = new Map();
  private discoveredServices: Map<string, DiscoveredService> = new Map();
  private discoverySchedules: Map<string, NodeJS.Timer> = new Map();
  private isRunning = false;

  constructor(
    private config: DiscoveryEngineConfig,
    private logger: Logger
  ) {
    super();
    this.setupErrorHandling();
  }

  /**
   * Initialize the discovery engine and all configured sources
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing Service Discovery Engine');

    try {
      // Initialize storage
      await this.initializeStorage();

      // Initialize discovery sources
      for (const [sourceKey, sourceConfig] of Object.entries(this.config.sources)) {
        if (sourceConfig.enabled) {
          await this.initializeSource(sourceKey, sourceConfig);
        }
      }

      this.isRunning = true;
      this.logger.info(`Discovery engine initialized with ${this.sources.size} sources`);

    } catch (error) {
      this.logger.error('Failed to initialize discovery engine', error);
      throw error;
    }
  }

  /**
   * Register a discovery source
   */
  registerSource(source: IDiscoverySource): void {
    if (this.sources.has(source.name)) {
      throw new Error(`Discovery source ${source.name} already registered`);
    }

    this.sources.set(source.name, source);
    this.logger.info(`Registered discovery source: ${source.name} v${source.version}`);
  }

  /**
   * Start discovery process for all enabled sources
   */
  async startDiscovery(): Promise<void> {
    if (!this.isRunning) {
      throw new Error('Discovery engine not initialized');
    }

    this.logger.info('Starting service discovery');

    const discoveryPromises: Promise<void>[] = [];

    for (const [sourceKey, sourceConfig] of Object.entries(this.config.sources)) {
      if (sourceConfig.enabled) {
        const source = this.sources.get(sourceKey);
        if (source) {
          discoveryPromises.push(this.startSourceDiscovery(sourceKey, source, sourceConfig));
        }
      }
    }

    await Promise.allSettled(discoveryPromises);
    this.logger.info('Discovery processes started');
  }

  /**
   * Perform immediate discovery across all sources
   */
  async discoverNow(): Promise<DiscoveredService[]> {
    this.logger.info('Performing immediate discovery');

    const allServices: DiscoveredService[] = [];
    const discoveryPromises: Promise<DiscoveredService[]>[] = [];

    for (const [sourceKey, source] of this.sources.entries()) {
      discoveryPromises.push(this.discoverFromSource(sourceKey, source));
    }

    const results = await Promise.allSettled(discoveryPromises);

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allServices.push(...result.value);
      }
    }

    // Process discovered services
    const processedServices = await this.processDiscoveredServices(allServices);
    
    this.logger.info(`Discovery completed: ${processedServices.length} services processed`);
    return processedServices;
  }

  /**
   * Get all discovered services
   */
  getDiscoveredServices(): DiscoveredService[] {
    return Array.from(this.discoveredServices.values());
  }

  /**
   * Get discovered services by type
   */
  getServicesByType(type: DiscoveredService['type']): DiscoveredService[] {
    return this.getDiscoveredServices().filter(service => service.type === type);
  }

  /**
   * Get discovered services by source
   */
  getServicesBySource(source: string): DiscoveredService[] {
    return this.getDiscoveredServices().filter(service => service.source === source);
  }

  /**
   * Stop discovery engine
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping discovery engine');

    // Clear scheduled discoveries
    for (const timer of this.discoverySchedules.values()) {
      clearInterval(timer);
    }
    this.discoverySchedules.clear();

    // Dispose sources
    const disposePromises: Promise<void>[] = [];
    for (const source of this.sources.values()) {
      disposePromises.push(source.dispose());
    }

    await Promise.allSettled(disposePromises);

    this.isRunning = false;
    this.logger.info('Discovery engine stopped');
  }

  /**
   * Get engine health status
   */
  async getHealthStatus(): Promise<{
    engine: boolean;
    sources: { [key: string]: boolean };
    servicesCount: number;
    lastDiscovery: Date | null;
  }> {
    const sourceHealth: { [key: string]: boolean } = {};

    for (const [name, source] of this.sources.entries()) {
      try {
        sourceHealth[name] = await source.healthCheck();
      } catch {
        sourceHealth[name] = false;
      }
    }

    return {
      engine: this.isRunning,
      sources: sourceHealth,
      servicesCount: this.discoveredServices.size,
      lastDiscovery: null, // TODO: Track last discovery time
    };
  }

  // Private Methods

  private async initializeStorage(): Promise<void> {
    // TODO: Implement storage initialization based on config
    this.logger.info('Storage initialized (in-memory for now)');
  }

  private async initializeSource(sourceKey: string, sourceConfig: any): Promise<void> {
    const source = this.sources.get(sourceKey);
    if (!source) {
      this.logger.warn(`Source ${sourceKey} not found in registered sources`);
      return;
    }

    try {
      await source.initialize(sourceConfig.config);
      this.logger.info(`Initialized source: ${sourceKey}`);
    } catch (error) {
      this.logger.error(`Failed to initialize source ${sourceKey}`, error);
      throw error;
    }
  }

  private async startSourceDiscovery(
    sourceKey: string,
    source: IDiscoverySource,
    config: any
  ): Promise<void> {
    // Initial discovery
    await this.discoverFromSource(sourceKey, source);

    // Schedule periodic discovery if configured
    if (config.schedule) {
      // TODO: Implement cron-based scheduling
      // For now, use a simple interval
      const interval = 300000; // 5 minutes
      const timer = setInterval(async () => {
        await this.discoverFromSource(sourceKey, source);
      }, interval);

      this.discoverySchedules.set(sourceKey, timer);
    }
  }

  private async discoverFromSource(
    sourceKey: string,
    source: IDiscoverySource
  ): Promise<DiscoveredService[]> {
    try {
      this.logger.debug(`Starting discovery from source: ${sourceKey}`);
      
      const services = await source.discover();
      
      this.emit('discovery_completed', {
        source: sourceKey,
        servicesFound: services.length,
        timestamp: new Date(),
      });

      return services;

    } catch (error) {
      this.logger.error(`Discovery failed for source ${sourceKey}`, error);
      
      this.emit('discovery_error', {
        source: sourceKey,
        error,
        timestamp: new Date(),
      });

      return [];
    }
  }

  private async processDiscoveredServices(services: DiscoveredService[]): Promise<DiscoveredService[]> {
    this.logger.debug(`Processing ${services.length} discovered services`);

    // Validate services
    const validServices = services.filter(service => {
      try {
        DiscoveredServiceSchema.parse(service);
        return true;
      } catch (error) {
        this.logger.warn(`Invalid service discovered: ${service.id}`, error);
        return false;
      }
    });

    // Apply confidence threshold
    const confidenceFiltered = validServices.filter(
      service => service.confidence >= this.config.aggregation.confidenceThreshold
    );

    // Deduplicate services
    const deduplicated = await this.deduplicateServices(confidenceFiltered);

    // Infer relationships if enabled
    if (this.config.aggregation.relationshipInference) {
      await this.inferRelationships(deduplicated);
    }

    // Update internal store
    for (const service of deduplicated) {
      this.discoveredServices.set(service.id, service);
    }

    // Emit events for each processed service
    for (const service of deduplicated) {
      this.emit('service_discovered', {
        type: 'service_discovered',
        source: service.source,
        timestamp: new Date(),
        data: service,
      });
    }

    return deduplicated;
  }

  private async deduplicateServices(services: DiscoveredService[]): Promise<DiscoveredService[]> {
    const serviceGroups = new Map<string, DiscoveredService[]>();

    // Group services by potential duplicates (by name and endpoints)
    for (const service of services) {
      const key = this.generateDeduplicationKey(service);
      if (!serviceGroups.has(key)) {
        serviceGroups.set(key, []);
      }
      serviceGroups.get(key)!.push(service);
    }

    const deduplicated: DiscoveredService[] = [];

    for (const [key, group] of serviceGroups.entries()) {
      if (group.length === 1) {
        deduplicated.push(group[0]);
      } else {
        // Apply deduplication strategy
        const merged = await this.mergeServices(group);
        deduplicated.push(merged);
      }
    }

    this.logger.debug(`Deduplicated ${services.length} services to ${deduplicated.length}`);
    return deduplicated;
  }

  private generateDeduplicationKey(service: DiscoveredService): string {
    // Create a key based on service name and primary endpoint
    const primaryEndpoint = service.endpoints?.[0]?.url || '';
    return `${service.name.toLowerCase()}:${primaryEndpoint}`;
  }

  private async mergeServices(services: DiscoveredService[]): Promise<DiscoveredService> {
    switch (this.config.aggregation.deduplicationStrategy) {
      case 'latest':
        return services.reduce((latest, current) => 
          current.lastSeen > latest.lastSeen ? current : latest
        );
      
      case 'highest_confidence':
        return services.reduce((highest, current) => 
          current.confidence > highest.confidence ? current : highest
        );
      
      case 'merge':
      default:
        return this.deepMergeServices(services);
    }
  }

  private deepMergeServices(services: DiscoveredService[]): DiscoveredService {
    // Start with the highest confidence service as base
    const base = services.reduce((highest, current) => 
      current.confidence > highest.confidence ? current : highest
    );

    // Merge metadata, endpoints, and other fields
    const merged: DiscoveredService = {
      ...base,
      metadata: {},
      endpoints: [],
      dependencies: [],
    };

    // Merge all metadata
    for (const service of services) {
      Object.assign(merged.metadata, service.metadata);
      
      if (service.endpoints) {
        merged.endpoints!.push(...service.endpoints);
      }
      
      if (service.dependencies) {
        merged.dependencies!.push(...service.dependencies);
      }
    }

    // Remove duplicates from arrays
    merged.endpoints = merged.endpoints!.filter(
      (endpoint, index, arr) => arr.findIndex(e => e.url === endpoint.url) === index
    );
    
    merged.dependencies = [...new Set(merged.dependencies!)];

    return merged;
  }

  private async inferRelationships(services: DiscoveredService[]): Promise<void> {
    this.logger.debug('Inferring service relationships');

    for (const service of services) {
      // Simple relationship inference based on endpoints and dependencies
      for (const otherService of services) {
        if (service.id === otherService.id) continue;

        // Check if service calls other service based on endpoints
        if (this.hasRelationship(service, otherService)) {
          if (!service.dependencies) service.dependencies = [];
          if (!service.dependencies.includes(otherService.id)) {
            service.dependencies.push(otherService.id);
          }
        }
      }
    }
  }

  private hasRelationship(service1: DiscoveredService, service2: DiscoveredService): boolean {
    // Simple heuristic: check if service1's dependencies mention service2's name
    if (service1.dependencies?.includes(service2.name)) {
      return true;
    }

    // Check if service1's metadata mentions service2's endpoints
    if (service2.endpoints) {
      const metadataStr = JSON.stringify(service1.metadata).toLowerCase();
      for (const endpoint of service2.endpoints) {
        const hostname = new URL(endpoint.url).hostname.toLowerCase();
        if (metadataStr.includes(hostname) || metadataStr.includes(service2.name.toLowerCase())) {
          return true;
        }
      }
    }

    return false;
  }

  private setupErrorHandling(): void {
    this.on('error', (error) => {
      this.logger.error('Discovery engine error', error);
    });

    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception in discovery engine', error);
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled rejection in discovery engine', { reason, promise });
    });
  }
}

// Discovery Source Registry
export class DiscoverySourceRegistry {
  private sources: Map<string, () => IDiscoverySource> = new Map();

  register(name: string, factory: () => IDiscoverySource): void {
    this.sources.set(name, factory);
  }

  create(name: string): IDiscoverySource | null {
    const factory = this.sources.get(name);
    return factory ? factory() : null;
  }

  getAvailable(): string[] {
    return Array.from(this.sources.keys());
  }
}

// Global registry instance
export const discoverySourceRegistry = new DiscoverySourceRegistry();