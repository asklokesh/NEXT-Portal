/**
 * Service Discovery Orchestrator
 * 
 * Main orchestration service that coordinates all discovery sources,
 * manages the discovery lifecycle, and provides the unified interface
 * for the automated service discovery and registration system.
 */

import { Logger } from 'winston';
import { z } from 'zod';
import { ServiceDiscoveryEngine, discoverySourceRegistry, DiscoveredService } from './core/discovery-engine';
import { GitRepositoryAnalyzer } from './sources/git-repository-analyzer';
import { KubernetesScanner } from './sources/kubernetes-scanner';
import { AWSResourceScanner } from './sources/aws-resource-scanner';
import { AzureResourceScanner } from './sources/azure-resource-scanner';
import { GCPResourceScanner } from './sources/gcp-resource-scanner';
import { CICDPipelineScanner } from './sources/cicd-pipeline-scanner';

// Configuration schema
const ServiceDiscoveryOrchestratorConfigSchema = z.object({
  engine: z.object({
    aggregation: z.object({
      deduplicationStrategy: z.enum(['merge', 'latest', 'highest_confidence']).default('merge'),
      relationshipInference: z.boolean().default(true),
      confidenceThreshold: z.number().min(0).max(1).default(0.5),
    }),
    storage: z.object({
      type: z.enum(['memory', 'redis', 'database']).default('memory'),
      config: z.record(z.any()).default({}),
    }),
    notifications: z.object({
      enabled: z.boolean().default(false),
      channels: z.array(z.string()).default([]),
    }),
  }),
  sources: z.object({
    'git-repository-analyzer': z.object({
      enabled: z.boolean().default(false),
      priority: z.number().min(0).max(100).default(100),
      schedule: z.string().optional(),
      config: z.any(),
    }).optional(),
    'kubernetes-scanner': z.object({
      enabled: z.boolean().default(false),
      priority: z.number().min(0).max(100).default(90),
      schedule: z.string().optional(),
      config: z.any(),
    }).optional(),
    'aws-resource-scanner': z.object({
      enabled: z.boolean().default(false),
      priority: z.number().min(0).max(100).default(80),
      schedule: z.string().optional(),
      config: z.any(),
    }).optional(),
    'azure-resource-scanner': z.object({
      enabled: z.boolean().default(false),
      priority: z.number().min(0).max(100).default(80),
      schedule: z.string().optional(),
      config: z.any(),
    }).optional(),
    'gcp-resource-scanner': z.object({
      enabled: z.boolean().default(false),
      priority: z.number().min(0).max(100).default(80),
      schedule: z.string().optional(),
      config: z.any(),
    }).optional(),
    'cicd-pipeline-scanner': z.object({
      enabled: z.boolean().default(false),
      priority: z.number().min(0).max(100).default(70),
      schedule: z.string().optional(),
      config: z.any(),
    }).optional(),
  }),
  monitoring: z.object({
    enabled: z.boolean().default(true),
    metricsPort: z.number().min(1000).max(65535).default(9090),
    healthCheckInterval: z.number().min(10000).default(60000),
  }),
  webhooks: z.object({
    enabled: z.boolean().default(false),
    endpoints: z.array(z.object({
      url: z.string().url(),
      events: z.array(z.enum(['service_discovered', 'service_updated', 'service_removed'])),
      headers: z.record(z.string()).optional(),
      retries: z.number().min(0).max(10).default(3),
    })).default([]),
  }),
});

type ServiceDiscoveryOrchestratorConfig = z.infer<typeof ServiceDiscoveryOrchestratorConfigSchema>;

// Discovery metrics interface
interface DiscoveryMetrics {
  totalServices: number;
  servicesBySource: Record<string, number>;
  servicesByType: Record<string, number>;
  averageConfidence: number;
  lastDiscoveryTime: Date | null;
  discoveryDuration: number | null;
  healthStatus: {
    engine: boolean;
    sources: Record<string, boolean>;
  };
}

// Discovery event interface
interface DiscoveryEvent {
  type: 'service_discovered' | 'service_updated' | 'service_removed' | 'discovery_completed' | 'discovery_error';
  source?: string;
  service?: DiscoveredService;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Service Discovery Orchestrator
 * 
 * Coordinates all discovery sources and manages the overall discovery lifecycle
 */
export class ServiceDiscoveryOrchestrator {
  private engine!: ServiceDiscoveryEngine;
  private config!: ServiceDiscoveryOrchestratorConfig;
  private isRunning = false;
  private discoveryInterval?: NodeJS.Timer;
  private healthCheckInterval?: NodeJS.Timer;
  private metrics: DiscoveryMetrics = {
    totalServices: 0,
    servicesBySource: {},
    servicesByType: {},
    averageConfidence: 0,
    lastDiscoveryTime: null,
    discoveryDuration: null,
    healthStatus: {
      engine: false,
      sources: {},
    },
  };

  constructor(private logger: Logger) {
    this.setupEventHandlers();
  }

  /**
   * Initialize the orchestrator with configuration
   */
  async initialize(config: ServiceDiscoveryOrchestratorConfig): Promise<void> {
    this.config = ServiceDiscoveryOrchestratorConfigSchema.parse(config);
    
    // Register all discovery sources
    this.registerDiscoverySources();

    // Create discovery engine
    this.engine = new ServiceDiscoveryEngine(
      {
        sources: this.buildEngineSourceConfig(),
        aggregation: this.config.engine.aggregation,
        storage: this.config.engine.storage,
        notifications: this.config.engine.notifications,
      },
      this.logger
    );

    // Initialize enabled sources
    await this.initializeEnabledSources();

    // Initialize engine
    await this.engine.initialize();

    this.logger.info('Service Discovery Orchestrator initialized');
  }

  /**
   * Start the discovery process
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Discovery orchestrator already running');
    }

    try {
      // Start discovery engine
      await this.engine.startDiscovery();

      // Start health monitoring
      if (this.config.monitoring.enabled) {
        this.startHealthMonitoring();
      }

      this.isRunning = true;
      this.logger.info('Service Discovery Orchestrator started');

    } catch (error) {
      this.logger.error('Failed to start Service Discovery Orchestrator', error);
      throw error;
    }
  }

  /**
   * Stop the discovery process
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Stop intervals
      if (this.discoveryInterval) {
        clearInterval(this.discoveryInterval);
        this.discoveryInterval = undefined;
      }

      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = undefined;
      }

      // Stop engine
      await this.engine.stop();

      this.isRunning = false;
      this.logger.info('Service Discovery Orchestrator stopped');

    } catch (error) {
      this.logger.error('Error stopping Service Discovery Orchestrator', error);
    }
  }

  /**
   * Trigger immediate discovery across all sources
   */
  async discoverNow(): Promise<DiscoveredService[]> {
    this.logger.info('Starting immediate service discovery');
    const startTime = Date.now();

    try {
      const services = await this.engine.discoverNow();
      
      const duration = Date.now() - startTime;
      this.updateMetrics(services, duration);

      this.logger.info(`Discovery completed: ${services.length} services discovered in ${duration}ms`);
      
      // Send webhooks
      await this.sendWebhookNotification({
        type: 'discovery_completed',
        timestamp: new Date(),
        metadata: {
          servicesDiscovered: services.length,
          duration,
        },
      });

      return services;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Discovery failed', error);
      
      // Send error webhook
      await this.sendWebhookNotification({
        type: 'discovery_error',
        timestamp: new Date(),
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          duration,
        },
      });

      throw error;
    }
  }

  /**
   * Get all discovered services
   */
  getDiscoveredServices(): DiscoveredService[] {
    return this.engine.getDiscoveredServices();
  }

  /**
   * Get discovered services by type
   */
  getServicesByType(type: DiscoveredService['type']): DiscoveredService[] {
    return this.engine.getServicesByType(type);
  }

  /**
   * Get discovered services by source
   */
  getServicesBySource(source: string): DiscoveredService[] {
    return this.engine.getServicesBySource(source);
  }

  /**
   * Get discovery metrics
   */
  getMetrics(): DiscoveryMetrics {
    return { ...this.metrics };
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<DiscoveryMetrics['healthStatus']> {
    return await this.engine.getHealthStatus().then(status => ({
      engine: status.engine,
      sources: status.sources,
    }));
  }

  /**
   * Add a new discovery source at runtime
   */
  async addDiscoverySource(name: string, sourceConfig: any): Promise<void> {
    // This would require extending the engine to support dynamic source addition
    this.logger.warn('Dynamic source addition not yet implemented');
  }

  /**
   * Remove a discovery source at runtime
   */
  async removeDiscoverySource(name: string): Promise<void> {
    // This would require extending the engine to support dynamic source removal
    this.logger.warn('Dynamic source removal not yet implemented');
  }

  // Private methods

  private registerDiscoverySources(): void {
    // Register all available discovery sources
    discoverySourceRegistry.register('git-repository-analyzer', () => new GitRepositoryAnalyzer(this.logger));
    discoverySourceRegistry.register('kubernetes-scanner', () => new KubernetesScanner(this.logger));
    discoverySourceRegistry.register('aws-resource-scanner', () => new AWSResourceScanner(this.logger));
    discoverySourceRegistry.register('azure-resource-scanner', () => new AzureResourceScanner(this.logger));
    discoverySourceRegistry.register('gcp-resource-scanner', () => new GCPResourceScanner(this.logger));
    discoverySourceRegistry.register('cicd-pipeline-scanner', () => new CICDPipelineScanner(this.logger));

    this.logger.debug('Discovery sources registered', {
      sources: discoverySourceRegistry.getAvailable(),
    });
  }

  private buildEngineSourceConfig(): Record<string, any> {
    const sourceConfig: Record<string, any> = {};

    for (const [sourceName, config] of Object.entries(this.config.sources)) {
      if (config?.enabled) {
        sourceConfig[sourceName] = {
          enabled: true,
          config: config.config,
          priority: config.priority,
          schedule: config.schedule,
        };
      }
    }

    return sourceConfig;
  }

  private async initializeEnabledSources(): Promise<void> {
    const enabledSources = Object.entries(this.config.sources)
      .filter(([_, config]) => config?.enabled);

    for (const [sourceName, _] of enabledSources) {
      const source = discoverySourceRegistry.create(sourceName);
      if (source) {
        this.engine.registerSource(source);
        this.logger.debug(`Registered source: ${sourceName}`);
      } else {
        this.logger.warn(`Failed to create source: ${sourceName}`);
      }
    }
  }

  private setupEventHandlers(): void {
    // Set up event handlers for the engine
    // This would be called after engine initialization
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const healthStatus = await this.getHealthStatus();
        this.metrics.healthStatus = healthStatus;
        
        // Log health issues
        if (!healthStatus.engine) {
          this.logger.warn('Discovery engine health check failed');
        }
        
        for (const [source, healthy] of Object.entries(healthStatus.sources)) {
          if (!healthy) {
            this.logger.warn(`Discovery source health check failed: ${source}`);
          }
        }

      } catch (error) {
        this.logger.error('Health check failed', error);
      }
    }, this.config.monitoring.healthCheckInterval);
  }

  private updateMetrics(services: DiscoveredService[], duration: number): void {
    this.metrics.totalServices = services.length;
    this.metrics.lastDiscoveryTime = new Date();
    this.metrics.discoveryDuration = duration;

    // Calculate services by source
    this.metrics.servicesBySource = {};
    for (const service of services) {
      this.metrics.servicesBySource[service.source] = 
        (this.metrics.servicesBySource[service.source] || 0) + 1;
    }

    // Calculate services by type
    this.metrics.servicesByType = {};
    for (const service of services) {
      this.metrics.servicesByType[service.type] = 
        (this.metrics.servicesByType[service.type] || 0) + 1;
    }

    // Calculate average confidence
    if (services.length > 0) {
      this.metrics.averageConfidence = 
        services.reduce((sum, service) => sum + service.confidence, 0) / services.length;
    } else {
      this.metrics.averageConfidence = 0;
    }
  }

  private async sendWebhookNotification(event: DiscoveryEvent): Promise<void> {
    if (!this.config.webhooks.enabled) {
      return;
    }

    const webhookPromises = this.config.webhooks.endpoints
      .filter(endpoint => endpoint.events.includes(event.type))
      .map(endpoint => this.sendWebhook(endpoint, event));

    await Promise.allSettled(webhookPromises);
  }

  private async sendWebhook(endpoint: any, event: DiscoveryEvent): Promise<void> {
    const maxRetries = endpoint.retries || 3;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        const response = await fetch(endpoint.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...endpoint.headers,
          },
          body: JSON.stringify(event),
        });

        if (response.ok) {
          this.logger.debug(`Webhook sent successfully to ${endpoint.url}`);
          return;
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

      } catch (error) {
        attempt++;
        this.logger.warn(`Webhook attempt ${attempt} failed for ${endpoint.url}`, error);
        
        if (attempt <= maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    this.logger.error(`All webhook attempts failed for ${endpoint.url}`);
  }
}

/**
 * Factory function to create a configured orchestrator
 */
export async function createServiceDiscoveryOrchestrator(
  config: ServiceDiscoveryOrchestratorConfig,
  logger: Logger
): Promise<ServiceDiscoveryOrchestrator> {
  const orchestrator = new ServiceDiscoveryOrchestrator(logger);
  await orchestrator.initialize(config);
  return orchestrator;
}

/**
 * Default configuration for quick setup
 */
export const defaultDiscoveryConfig: ServiceDiscoveryOrchestratorConfig = {
  engine: {
    aggregation: {
      deduplicationStrategy: 'merge',
      relationshipInference: true,
      confidenceThreshold: 0.5,
    },
    storage: {
      type: 'memory',
      config: {},
    },
    notifications: {
      enabled: false,
      channels: [],
    },
  },
  sources: {
    'git-repository-analyzer': {
      enabled: false,
      priority: 100,
      config: {},
    },
    'kubernetes-scanner': {
      enabled: false,
      priority: 90,
      config: {},
    },
  },
  monitoring: {
    enabled: true,
    metricsPort: 9090,
    healthCheckInterval: 60000,
  },
  webhooks: {
    enabled: false,
    endpoints: [],
  },
};