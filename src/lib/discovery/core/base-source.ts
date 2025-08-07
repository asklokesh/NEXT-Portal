/**
 * Base Discovery Source Implementation
 * 
 * Provides common functionality and patterns for all discovery sources.
 * Includes rate limiting, caching, error handling, and retry logic.
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { z } from 'zod';
import { IDiscoverySource, DiscoveredService } from './discovery-engine';

// Base configuration schema
export const BaseSourceConfigSchema = z.object({
  enabled: z.boolean().default(true),
  retryAttempts: z.number().min(0).max(10).default(3),
  retryDelay: z.number().min(100).max(60000).default(1000),
  timeout: z.number().min(1000).max(300000).default(30000),
  rateLimit: z.object({
    maxRequests: z.number().min(1).default(100),
    windowMs: z.number().min(1000).default(60000),
  }).optional(),
  cache: z.object({
    enabled: z.boolean().default(true),
    ttl: z.number().min(0).default(300000), // 5 minutes
  }).optional(),
  healthCheck: z.object({
    enabled: z.boolean().default(true),
    interval: z.number().min(10000).default(60000), // 1 minute
  }).optional(),
});

export type BaseSourceConfig = z.infer<typeof BaseSourceConfigSchema>;

// Rate limiting implementation
class RateLimiter {
  private requests: number[] = [];

  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}

  async checkLimit(): Promise<void> {
    const now = Date.now();
    
    // Remove old requests outside the window
    this.requests = this.requests.filter(timestamp => now - timestamp < this.windowMs);
    
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = this.windowMs - (now - oldestRequest);
      
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    this.requests.push(now);
  }
}

// Simple in-memory cache
class MemoryCache<T> {
  private cache = new Map<string, { value: T; expires: number }>();

  set(key: string, value: T, ttl: number): void {
    this.cache.set(key, {
      value,
      expires: Date.now() + ttl,
    });
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value;
  }

  clear(): void {
    this.cache.clear();
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  size(): number {
    return this.cache.size;
  }
}

// Abstract base class for all discovery sources
export abstract class BaseDiscoverySource extends EventEmitter implements IDiscoverySource {
  protected config!: BaseSourceConfig;
  protected rateLimiter?: RateLimiter;
  protected cache = new MemoryCache<DiscoveredService[]>();
  protected healthCheckTimer?: NodeJS.Timer;
  protected isInitialized = false;
  protected lastError?: Error;
  protected lastHealthCheck?: Date;
  protected healthStatus = true;

  constructor(
    public readonly name: string,
    public readonly version: string,
    public readonly priority: number,
    protected logger: Logger
  ) {
    super();
    this.setupErrorHandling();
  }

  /**
   * Initialize the discovery source
   */
  async initialize(config: any): Promise<void> {
    try {
      // Validate base configuration
      this.config = BaseSourceConfigSchema.parse(config);
      
      // Setup rate limiting
      if (this.config.rateLimit) {
        this.rateLimiter = new RateLimiter(
          this.config.rateLimit.maxRequests,
          this.config.rateLimit.windowMs
        );
      }

      // Setup health check
      if (this.config.healthCheck?.enabled) {
        this.startHealthCheck();
      }

      // Call source-specific initialization
      await this.initializeSource(config);

      this.isInitialized = true;
      this.logger.info(`Discovery source ${this.name} initialized`);

    } catch (error) {
      this.logger.error(`Failed to initialize discovery source ${this.name}`, error);
      throw error;
    }
  }

  /**
   * Discover services from this source
   */
  async discover(): Promise<DiscoveredService[]> {
    if (!this.isInitialized) {
      throw new Error(`Discovery source ${this.name} not initialized`);
    }

    // Check cache first
    if (this.config.cache?.enabled) {
      const cacheKey = this.getCacheKey();
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.logger.debug(`Returning cached results for ${this.name}`);
        return cached;
      }
    }

    // Apply rate limiting
    if (this.rateLimiter) {
      await this.rateLimiter.checkLimit();
    }

    // Perform discovery with retry logic
    const services = await this.discoverWithRetry();

    // Cache results
    if (this.config.cache?.enabled && services.length > 0) {
      const cacheKey = this.getCacheKey();
      this.cache.set(cacheKey, services, this.config.cache.ttl);
    }

    return services;
  }

  /**
   * Health check implementation
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        return false;
      }

      const isHealthy = await this.performHealthCheck();
      this.healthStatus = isHealthy;
      this.lastHealthCheck = new Date();
      
      if (!isHealthy) {
        this.logger.warn(`Health check failed for discovery source ${this.name}`);
      }

      return isHealthy;

    } catch (error) {
      this.logger.error(`Health check error for discovery source ${this.name}`, error);
      this.healthStatus = false;
      this.lastHealthCheck = new Date();
      return false;
    }
  }

  /**
   * Dispose resources and cleanup
   */
  async dispose(): Promise<void> {
    this.logger.info(`Disposing discovery source ${this.name}`);

    // Stop health check
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }

    // Clear cache
    this.cache.clear();

    // Call source-specific cleanup
    await this.disposeSource();

    this.isInitialized = false;
    this.removeAllListeners();
  }

  /**
   * Get source metrics
   */
  getMetrics(): {
    name: string;
    version: string;
    priority: number;
    isInitialized: boolean;
    healthStatus: boolean;
    lastHealthCheck?: Date;
    cacheSize: number;
    lastError?: string;
  } {
    return {
      name: this.name,
      version: this.version,
      priority: this.priority,
      isInitialized: this.isInitialized,
      healthStatus: this.healthStatus,
      lastHealthCheck: this.lastHealthCheck,
      cacheSize: this.cache.size(),
      lastError: this.lastError?.message,
    };
  }

  // Abstract methods to be implemented by concrete sources

  /**
   * Source-specific initialization logic
   */
  protected abstract initializeSource(config: any): Promise<void>;

  /**
   * Core discovery logic implementation
   */
  protected abstract performDiscovery(): Promise<DiscoveredService[]>;

  /**
   * Source-specific health check logic
   */
  protected abstract performHealthCheck(): Promise<boolean>;

  /**
   * Source-specific cleanup logic
   */
  protected abstract disposeSource(): Promise<void>;

  // Protected helper methods

  protected getCacheKey(): string {
    return `${this.name}:discovery:${Date.now()}`;
  }

  protected async discoverWithRetry(): Promise<DiscoveredService[]> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.config.retryAttempts; attempt++) {
      try {
        this.logger.debug(`Discovery attempt ${attempt + 1}/${this.config.retryAttempts + 1} for ${this.name}`);
        
        // Set timeout for discovery
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Discovery timeout')), this.config.timeout);
        });

        const discoveryPromise = this.performDiscovery();
        const services = await Promise.race([discoveryPromise, timeoutPromise]);

        this.logger.debug(`Discovery completed for ${this.name}: ${services.length} services found`);
        return services;

      } catch (error) {
        lastError = error as Error;
        this.lastError = lastError;
        
        this.logger.warn(`Discovery attempt ${attempt + 1} failed for ${this.name}`, error);
        
        if (attempt < this.config.retryAttempts) {
          const delay = this.config.retryDelay * Math.pow(2, attempt); // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    this.logger.error(`All discovery attempts failed for ${this.name}`, lastError);
    throw lastError || new Error('Discovery failed after all retries');
  }

  protected startHealthCheck(): void {
    if (this.config.healthCheck?.enabled) {
      this.healthCheckTimer = setInterval(async () => {
        await this.healthCheck();
      }, this.config.healthCheck.interval);
    }
  }

  protected setupErrorHandling(): void {
    this.on('error', (error) => {
      this.logger.error(`Error in discovery source ${this.name}`, error);
      this.lastError = error;
      this.healthStatus = false;
    });
  }

  // Utility methods for service creation

  protected createService(params: {
    id: string;
    name: string;
    type: DiscoveredService['type'];
    metadata?: Record<string, any>;
    endpoints?: DiscoveredService['endpoints'];
    dependencies?: string[];
    owner?: DiscoveredService['owner'];
    repository?: DiscoveredService['repository'];
    deployment?: DiscoveredService['deployment'];
    metrics?: DiscoveredService['metrics'];
    confidence?: number;
  }): DiscoveredService {
    return {
      id: params.id,
      name: params.name,
      type: params.type,
      source: this.name,
      discoveredAt: new Date(),
      lastSeen: new Date(),
      confidence: params.confidence || 0.8,
      metadata: params.metadata || {},
      endpoints: params.endpoints,
      dependencies: params.dependencies,
      owner: params.owner,
      repository: params.repository,
      deployment: params.deployment,
      metrics: params.metrics,
    };
  }

  protected generateServiceId(source: string, identifier: string): string {
    // Create a consistent ID for services across discoveries
    return `${source}:${identifier}`.replace(/[^a-zA-Z0-9:-]/g, '-').toLowerCase();
  }

  protected inferServiceType(metadata: any): DiscoveredService['type'] {
    // Simple heuristics for service type inference
    const meta = JSON.stringify(metadata).toLowerCase();
    
    if (meta.includes('api') || meta.includes('rest') || meta.includes('graphql')) {
      return 'api';
    }
    
    if (meta.includes('web') || meta.includes('frontend') || meta.includes('ui')) {
      return 'web';
    }
    
    if (meta.includes('database') || meta.includes('db') || meta.includes('sql') || meta.includes('mongo')) {
      return 'database';
    }
    
    if (meta.includes('queue') || meta.includes('kafka') || meta.includes('rabbitmq') || meta.includes('sqs')) {
      return 'queue';
    }
    
    if (meta.includes('function') || meta.includes('lambda') || meta.includes('serverless')) {
      return 'function';
    }
    
    if (meta.includes('storage') || meta.includes('s3') || meta.includes('blob')) {
      return 'storage';
    }
    
    return 'microservice';
  }

  protected calculateConfidence(factors: {
    hasDocumentation?: boolean;
    hasOwner?: boolean;
    hasHealthCheck?: boolean;
    hasMetrics?: boolean;
    hasRepository?: boolean;
    isActive?: boolean;
  }): number {
    let confidence = 0.5; // Base confidence
    
    if (factors.hasDocumentation) confidence += 0.1;
    if (factors.hasOwner) confidence += 0.15;
    if (factors.hasHealthCheck) confidence += 0.1;
    if (factors.hasMetrics) confidence += 0.1;
    if (factors.hasRepository) confidence += 0.1;
    if (factors.isActive) confidence += 0.05;
    
    return Math.min(confidence, 1.0);
  }
}

// Utility functions for discovery sources

export function createHttpEndpoint(
  url: string,
  health: 'healthy' | 'unhealthy' | 'unknown' = 'unknown'
): DiscoveredService['endpoints'][0] {
  return {
    url,
    type: 'http',
    protocol: url.startsWith('https') ? 'https' : 'http',
    health,
  };
}

export function createGrpcEndpoint(
  url: string,
  health: 'healthy' | 'unhealthy' | 'unknown' = 'unknown'
): DiscoveredService['endpoints'][0] {
  return {
    url,
    type: 'grpc',
    protocol: 'grpc',
    health,
  };
}

export function extractOwnerFromGit(commitHistory: any[]): DiscoveredService['owner'] | undefined {
  if (!commitHistory || commitHistory.length === 0) {
    return undefined;
  }

  // Find the most frequent committer
  const committers = commitHistory.map(commit => ({
    email: commit.author?.email || commit.committer?.email,
    name: commit.author?.name || commit.committer?.name,
  }));

  const committerCounts = committers.reduce((counts, committer) => {
    const key = committer.email || committer.name;
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);

  const mostFrequent = Object.entries(committerCounts)
    .sort(([, a], [, b]) => b - a)[0];

  if (mostFrequent) {
    const [email] = mostFrequent;
    const committer = committers.find(c => c.email === email || c.name === email);
    
    return {
      email: committer?.email,
      individual: committer?.name,
    };
  }

  return undefined;
}