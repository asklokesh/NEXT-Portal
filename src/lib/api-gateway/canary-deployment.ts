import { Redis } from 'ioredis';
import { KongAdminClient } from './kong-admin';
import { GatewayLogger } from './logger';

export interface CanaryConfig {
  id: string;
  serviceName: string;
  productionTarget: {
    host: string;
    port: number;
    weight: number;
    version: string;
  };
  canaryTarget: {
    host: string;
    port: number;
    weight: number;
    version: string;
  };
  trafficSplit: number; // percentage of traffic to canary (0-100)
  strategy: 'weight-based' | 'header-based' | 'user-based' | 'geographic';
  criteria: {
    headers?: Record<string, string>;
    userSegments?: string[];
    geolocations?: string[];
    percentage?: number;
  };
  healthChecks: {
    enabled: boolean;
    endpoint: string;
    successThreshold: number;
    failureThreshold: number;
    timeout: number;
  };
  metrics: {
    successRate: number;
    avgResponseTime: number;
    errorRate: number;
    throughput: number;
  };
  autoPromotionRules: {
    enabled: boolean;
    successRateThreshold: number;
    maxResponseTime: number;
    maxErrorRate: number;
    minObservationTime: number; // minutes
  };
  autoRollbackRules: {
    enabled: boolean;
    errorRateThreshold: number;
    maxResponseTime: number;
    minSuccessRate: number;
  };
  status: 'preparing' | 'active' | 'promoting' | 'rolling_back' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

export interface LoadBalancingConfig {
  upstreamId: string;
  algorithm: 'round-robin' | 'least-connections' | 'consistent-hashing' | 'weighted-round-robin';
  healthChecks: {
    active: {
      enabled: boolean;
      type: 'http' | 'https' | 'tcp';
      timeout: number;
      concurrency: number;
      httpPath: string;
      httpsVerifyCertificate: boolean;
      healthy: {
        interval: number;
        httpStatuses: number[];
        successes: number;
      };
      unhealthy: {
        interval: number;
        httpStatuses: number[];
        tcpFailures: number;
        timeouts: number;
        httpFailures: number;
      };
    };
    passive: {
      enabled: boolean;
      type: 'http' | 'https' | 'tcp';
      healthy: {
        httpStatuses: number[];
        successes: number;
      };
      unhealthy: {
        httpStatuses: number[];
        tcpFailures: number;
        timeouts: number;
        httpFailures: number;
      };
    };
  };
  targets: Array<{
    target: string;
    weight: number;
    tags: string[];
  }>;
  sessionStickiness: {
    enabled: boolean;
    cookieName?: string;
    headerName?: string;
    ipHash?: boolean;
  };
}

export class CanaryDeploymentManager {
  private redis: Redis;
  private kongAdmin: KongAdminClient;
  private logger: GatewayLogger;
  private deployments: Map<string, CanaryConfig> = new Map();

  constructor(redis: Redis, kongAdmin: KongAdminClient, logger: GatewayLogger) {
    this.redis = redis;
    this.kongAdmin = kongAdmin;
    this.logger = logger;
  }

  /**
   * Create a new canary deployment
   */
  async createCanaryDeployment(config: Omit<CanaryConfig, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<CanaryConfig> {
    const canaryConfig: CanaryConfig = {
      ...config,
      id: `canary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'preparing',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Validate configuration
    await this.validateCanaryConfig(canaryConfig);

    // Create upstream with both production and canary targets
    await this.setupCanaryUpstream(canaryConfig);

    // Store configuration
    await this.storeCanaryConfig(canaryConfig);
    this.deployments.set(canaryConfig.id, canaryConfig);

    // Log canary deployment creation
    await this.logger.logAudit({
      action: 'canary_deployment_created',
      resource: 'canary_deployment',
      resourceId: canaryConfig.id,
      userId: 'system',
      ipAddress: '127.0.0.1',
      userAgent: 'CanaryDeploymentManager',
      requestId: `req_${Date.now()}`,
      details: {
        serviceName: canaryConfig.serviceName,
        trafficSplit: canaryConfig.trafficSplit,
        strategy: canaryConfig.strategy,
      },
      outcome: 'success',
      riskLevel: 'medium',
      complianceFlags: [],
    });

    return canaryConfig;
  }

  /**
   * Update canary traffic split
   */
  async updateTrafficSplit(canaryId: string, newSplit: number): Promise<void> {
    if (newSplit < 0 || newSplit > 100) {
      throw new Error('Traffic split must be between 0 and 100');
    }

    const config = this.deployments.get(canaryId);
    if (!config) {
      throw new Error(`Canary deployment ${canaryId} not found`);
    }

    // Update weights in Kong upstream
    await this.updateUpstreamWeights(config, newSplit);

    // Update configuration
    config.trafficSplit = newSplit;
    config.updatedAt = new Date();
    
    await this.storeCanaryConfig(config);
    this.deployments.set(canaryId, config);

    await this.logger.logAudit({
      action: 'canary_traffic_split_updated',
      resource: 'canary_deployment',
      resourceId: canaryId,
      userId: 'system',
      ipAddress: '127.0.0.1',
      userAgent: 'CanaryDeploymentManager',
      requestId: `req_${Date.now()}`,
      details: {
        serviceName: config.serviceName,
        oldSplit: config.trafficSplit,
        newSplit,
      },
      outcome: 'success',
      riskLevel: 'low',
      complianceFlags: [],
    });
  }

  /**
   * Promote canary to production
   */
  async promoteCanary(canaryId: string): Promise<void> {
    const config = this.deployments.get(canaryId);
    if (!config) {
      throw new Error(`Canary deployment ${canaryId} not found`);
    }

    if (config.status !== 'active') {
      throw new Error(`Canary deployment ${canaryId} is not in active state`);
    }

    config.status = 'promoting';
    config.updatedAt = new Date();
    
    try {
      // Gradually shift traffic to 100% canary
      await this.gradualTrafficShift(config, 100, 'promote');

      // Update production target to canary version
      config.productionTarget = { ...config.canaryTarget };
      config.status = 'completed';
      
      await this.storeCanaryConfig(config);
      this.deployments.set(canaryId, config);

      await this.logger.logAudit({
        action: 'canary_promoted',
        resource: 'canary_deployment',
        resourceId: canaryId,
        userId: 'system',
        ipAddress: '127.0.0.1',
        userAgent: 'CanaryDeploymentManager',
        requestId: `req_${Date.now()}`,
        details: {
          serviceName: config.serviceName,
          promotedVersion: config.canaryTarget.version,
        },
        outcome: 'success',
        riskLevel: 'medium',
        complianceFlags: [],
      });
    } catch (error) {
      config.status = 'failed';
      config.updatedAt = new Date();
      await this.storeCanaryConfig(config);
      throw error;
    }
  }

  /**
   * Rollback canary deployment
   */
  async rollbackCanary(canaryId: string): Promise<void> {
    const config = this.deployments.get(canaryId);
    if (!config) {
      throw new Error(`Canary deployment ${canaryId} not found`);
    }

    config.status = 'rolling_back';
    config.updatedAt = new Date();
    
    try {
      // Shift all traffic back to production
      await this.gradualTrafficShift(config, 0, 'rollback');

      config.status = 'completed';
      config.trafficSplit = 0;
      
      await this.storeCanaryConfig(config);
      this.deployments.set(canaryId, config);

      await this.logger.logAudit({
        action: 'canary_rolled_back',
        resource: 'canary_deployment',
        resourceId: canaryId,
        userId: 'system',
        ipAddress: '127.0.0.1',
        userAgent: 'CanaryDeploymentManager',
        requestId: `req_${Date.now()}`,
        details: {
          serviceName: config.serviceName,
          rolledBackFromVersion: config.canaryTarget.version,
        },
        outcome: 'success',
        riskLevel: 'medium',
        complianceFlags: [],
      });
    } catch (error) {
      config.status = 'failed';
      config.updatedAt = new Date();
      await this.storeCanaryConfig(config);
      throw error;
    }
  }

  /**
   * Monitor canary deployment metrics
   */
  async monitorCanaryDeployment(canaryId: string): Promise<CanaryConfig> {
    const config = this.deployments.get(canaryId);
    if (!config) {
      throw new Error(`Canary deployment ${canaryId} not found`);
    }

    // Collect metrics from both production and canary
    const [productionMetrics, canaryMetrics] = await Promise.all([
      this.collectTargetMetrics(config.productionTarget),
      this.collectTargetMetrics(config.canaryTarget),
    ]);

    // Update metrics in config
    config.metrics = {
      successRate: canaryMetrics.successRate,
      avgResponseTime: canaryMetrics.avgResponseTime,
      errorRate: canaryMetrics.errorRate,
      throughput: canaryMetrics.throughput,
    };

    // Check auto-promotion rules
    if (config.autoPromotionRules.enabled) {
      const shouldPromote = await this.shouldAutoPromote(config, canaryMetrics);
      if (shouldPromote) {
        await this.promoteCanary(canaryId);
        return config;
      }
    }

    // Check auto-rollback rules
    if (config.autoRollbackRules.enabled) {
      const shouldRollback = await this.shouldAutoRollback(config, canaryMetrics);
      if (shouldRollback) {
        await this.rollbackCanary(canaryId);
        return config;
      }
    }

    config.updatedAt = new Date();
    await this.storeCanaryConfig(config);
    this.deployments.set(canaryId, config);

    return config;
  }

  /**
   * Get all canary deployments
   */
  async getCanaryDeployments(): Promise<CanaryConfig[]> {
    const keys = await this.redis.keys('canary_deployment:*');
    const deployments: CanaryConfig[] = [];

    for (const key of keys) {
      const data = await this.redis.hget(key, 'data');
      if (data) {
        const config = JSON.parse(data);
        deployments.push({
          ...config,
          createdAt: new Date(config.createdAt),
          updatedAt: new Date(config.updatedAt),
        });
      }
    }

    return deployments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Setup canary upstream with Kong
   */
  private async setupCanaryUpstream(config: CanaryConfig): Promise<void> {
    const upstreamName = `canary-${config.serviceName}`;
    
    // Create upstream
    const upstream = await this.kongAdmin.createUpstream({
      name: upstreamName,
      algorithm: 'weighted-round-robin',
      healthchecks: {
        active: {
          type: 'http',
          timeout: config.healthChecks.timeout,
          concurrency: 10,
          http_path: config.healthChecks.endpoint,
          https_verify_certificate: false,
          healthy: {
            interval: 10,
            http_statuses: [200, 302],
            successes: config.healthChecks.successThreshold,
          },
          unhealthy: {
            interval: 10,
            http_statuses: [429, 404, 500, 501, 502, 503, 504, 505],
            tcp_failures: config.healthChecks.failureThreshold,
            timeouts: config.healthChecks.failureThreshold,
            http_failures: config.healthChecks.failureThreshold,
          },
        },
        passive: {
          type: 'http',
          healthy: {
            http_statuses: [200, 201, 202, 203, 204, 205, 206, 300, 301, 302, 303, 304, 305, 306, 307, 308],
            successes: 5,
          },
          unhealthy: {
            http_statuses: [429, 500, 503],
            tcp_failures: 3,
            timeouts: 3,
            http_failures: 5,
          },
        },
      },
      tags: ['canary', config.serviceName],
    });

    // Add production target
    await this.kongAdmin.createTarget(upstream.id, {
      target: `${config.productionTarget.host}:${config.productionTarget.port}`,
      weight: 100 - config.trafficSplit,
      tags: ['production', config.productionTarget.version],
    });

    // Add canary target
    await this.kongAdmin.createTarget(upstream.id, {
      target: `${config.canaryTarget.host}:${config.canaryTarget.port}`,
      weight: config.trafficSplit,
      tags: ['canary', config.canaryTarget.version],
    });

    // Update service to use the new upstream
    const services = await this.kongAdmin.getServices();
    const service = services.data.find(s => s.name === config.serviceName);
    if (service) {
      await this.kongAdmin.updateService(service.id, {
        host: upstreamName,
      });
    }
  }

  /**
   * Update upstream weights for traffic splitting
   */
  private async updateUpstreamWeights(config: CanaryConfig, newSplit: number): Promise<void> {
    const upstreamName = `canary-${config.serviceName}`;
    const upstream = await this.kongAdmin.getUpstream(upstreamName);
    const targets = await this.kongAdmin.getTargets(upstream.id);

    for (const target of targets.data) {
      const isCanary = target.tags.includes('canary');
      const newWeight = isCanary ? newSplit : 100 - newSplit;
      
      // Delete old target and create new one with updated weight
      await this.kongAdmin.deleteTarget(upstream.id, target.id);
      await this.kongAdmin.createTarget(upstream.id, {
        target: target.target,
        weight: newWeight,
        tags: target.tags,
      });
    }
  }

  /**
   * Gradually shift traffic over time
   */
  private async gradualTrafficShift(
    config: CanaryConfig,
    targetSplit: number,
    operation: 'promote' | 'rollback'
  ): Promise<void> {
    const currentSplit = config.trafficSplit;
    const steps = 5; // Number of steps to reach target
    const stepSize = Math.abs(targetSplit - currentSplit) / steps;
    const stepDelay = 30000; // 30 seconds between steps

    for (let i = 1; i <= steps; i++) {
      let nextSplit: number;
      if (operation === 'promote') {
        nextSplit = Math.min(currentSplit + (stepSize * i), targetSplit);
      } else {
        nextSplit = Math.max(currentSplit - (stepSize * i), targetSplit);
      }

      await this.updateUpstreamWeights(config, nextSplit);
      config.trafficSplit = nextSplit;

      // Monitor metrics during shift
      const metrics = await this.collectTargetMetrics(config.canaryTarget);
      
      // Check if we should abort the operation
      if (operation === 'promote' && config.autoRollbackRules.enabled) {
        const shouldRollback = await this.shouldAutoRollback(config, metrics);
        if (shouldRollback) {
          throw new Error('Auto-rollback triggered during promotion');
        }
      }

      if (i < steps) {
        await new Promise(resolve => setTimeout(resolve, stepDelay));
      }
    }
  }

  /**
   * Collect metrics for a target
   */
  private async collectTargetMetrics(target: { host: string; port: number; version: string }): Promise<{
    successRate: number;
    avgResponseTime: number;
    errorRate: number;
    throughput: number;
  }> {
    // This would integrate with your metrics collection system
    // For now, return mock data
    return {
      successRate: 99.5,
      avgResponseTime: 150,
      errorRate: 0.5,
      throughput: 1000,
    };
  }

  /**
   * Check if canary should be auto-promoted
   */
  private async shouldAutoPromote(config: CanaryConfig, metrics: any): Promise<boolean> {
    const rules = config.autoPromotionRules;
    const observationTime = Date.now() - config.createdAt.getTime();
    const minObservationTimeMs = rules.minObservationTime * 60 * 1000;

    return (
      observationTime >= minObservationTimeMs &&
      metrics.successRate >= rules.successRateThreshold &&
      metrics.avgResponseTime <= rules.maxResponseTime &&
      metrics.errorRate <= rules.maxErrorRate
    );
  }

  /**
   * Check if canary should be auto-rolled back
   */
  private async shouldAutoRollback(config: CanaryConfig, metrics: any): Promise<boolean> {
    const rules = config.autoRollbackRules;

    return (
      metrics.errorRate >= rules.errorRateThreshold ||
      metrics.avgResponseTime >= rules.maxResponseTime ||
      metrics.successRate <= rules.minSuccessRate
    );
  }

  /**
   * Validate canary configuration
   */
  private async validateCanaryConfig(config: CanaryConfig): Promise<void> {
    if (config.trafficSplit < 0 || config.trafficSplit > 100) {
      throw new Error('Traffic split must be between 0 and 100');
    }

    if (!config.productionTarget.host || !config.canaryTarget.host) {
      throw new Error('Both production and canary targets must have valid hosts');
    }

    if (config.productionTarget.port <= 0 || config.canaryTarget.port <= 0) {
      throw new Error('Target ports must be positive integers');
    }
  }

  /**
   * Store canary configuration in Redis
   */
  private async storeCanaryConfig(config: CanaryConfig): Promise<void> {
    await this.redis.hset(
      `canary_deployment:${config.id}`,
      'data',
      JSON.stringify({
        ...config,
        createdAt: config.createdAt.toISOString(),
        updatedAt: config.updatedAt.toISOString(),
      })
    );

    // Set expiration (30 days)
    await this.redis.expire(`canary_deployment:${config.id}`, 30 * 24 * 60 * 60);
  }
}

export class LoadBalancer {
  private redis: Redis;
  private kongAdmin: KongAdminClient;
  private logger: GatewayLogger;

  constructor(redis: Redis, kongAdmin: KongAdminClient, logger: GatewayLogger) {
    this.redis = redis;
    this.kongAdmin = kongAdmin;
    this.logger = logger;
  }

  /**
   * Create a new load balanced upstream
   */
  async createLoadBalancedUpstream(config: LoadBalancingConfig): Promise<string> {
    const upstream = await this.kongAdmin.createUpstream({
      name: `lb-upstream-${Date.now()}`,
      algorithm: config.algorithm,
      healthchecks: {
        active: {
          type: config.healthChecks.active.type,
          timeout: config.healthChecks.active.timeout,
          concurrency: config.healthChecks.active.concurrency,
          http_path: config.healthChecks.active.httpPath,
          https_verify_certificate: config.healthChecks.active.httpsVerifyCertificate,
          healthy: config.healthChecks.active.healthy,
          unhealthy: config.healthChecks.active.unhealthy,
        },
        passive: {
          type: config.healthChecks.passive.type,
          healthy: config.healthChecks.passive.healthy,
          unhealthy: config.healthChecks.passive.unhealthy,
        },
      },
      tags: ['load-balanced'],
    });

    // Add targets
    for (const targetConfig of config.targets) {
      await this.kongAdmin.createTarget(upstream.id, targetConfig);
    }

    // Store configuration
    await this.storeLoadBalancingConfig(upstream.id, config);

    return upstream.id;
  }

  /**
   * Update target weights
   */
  async updateTargetWeights(upstreamId: string, weights: Record<string, number>): Promise<void> {
    const targets = await this.kongAdmin.getTargets(upstreamId);
    
    for (const target of targets.data) {
      const newWeight = weights[target.target];
      if (newWeight !== undefined && newWeight !== target.weight) {
        await this.kongAdmin.deleteTarget(upstreamId, target.id);
        await this.kongAdmin.createTarget(upstreamId, {
          target: target.target,
          weight: newWeight,
          tags: target.tags,
        });
      }
    }
  }

  /**
   * Add target to upstream
   */
  async addTarget(upstreamId: string, target: { target: string; weight: number; tags: string[] }): Promise<void> {
    await this.kongAdmin.createTarget(upstreamId, target);
  }

  /**
   * Remove target from upstream
   */
  async removeTarget(upstreamId: string, targetId: string): Promise<void> {
    await this.kongAdmin.deleteTarget(upstreamId, targetId);
  }

  /**
   * Get upstream health status
   */
  async getUpstreamHealth(upstreamId: string): Promise<any> {
    return this.kongAdmin.getUpstreamHealth(upstreamId);
  }

  /**
   * Set target health manually
   */
  async setTargetHealth(upstreamId: string, targetId: string, healthy: boolean): Promise<void> {
    await this.kongAdmin.setTargetHealth(upstreamId, targetId, healthy);
  }

  /**
   * Store load balancing configuration
   */
  private async storeLoadBalancingConfig(upstreamId: string, config: LoadBalancingConfig): Promise<void> {
    await this.redis.hset(
      `load_balancing_config:${upstreamId}`,
      'data',
      JSON.stringify(config)
    );
  }
}