import { Redis } from 'ioredis';
import { CircuitBreaker } from './rate-limiter';

export interface HealthCheckConfig {
  endpoint: string;
  method: 'GET' | 'POST' | 'HEAD';
  timeout: number;
  interval: number;
  retries: number;
  healthyThreshold: number; // consecutive successes to mark healthy
  unhealthyThreshold: number; // consecutive failures to mark unhealthy
  headers?: Record<string, string>;
  body?: any;
  expectedStatusCodes: number[];
  expectedResponseTime?: number; // max acceptable response time
  customValidator?: (response: any) => boolean;
}

export interface HealthStatus {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded' | 'unknown';
  lastCheck: Date;
  responseTime?: number;
  statusCode?: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  uptime: number; // percentage
  details: {
    endpoint: string;
    error?: string;
    metadata?: Record<string, any>;
  };
}

export interface ServiceDependency {
  name: string;
  type: 'database' | 'cache' | 'api' | 'queue' | 'storage';
  critical: boolean; // if true, service failure affects overall health
  config: HealthCheckConfig;
}

export class HealthChecker {
  private redis: Redis;
  private checks: Map<string, NodeJS.Timeout> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private healthStatuses: Map<string, HealthStatus> = new Map();

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Register health check for a service
   */
  registerHealthCheck(
    serviceName: string,
    dependency: ServiceDependency
  ): void {
    // Stop existing check if any
    this.stopHealthCheck(serviceName);

    // Create circuit breaker for this service
    const circuitBreaker = new CircuitBreaker(this.redis, {
      failureThreshold: dependency.config.unhealthyThreshold,
      timeout: dependency.config.timeout * 2,
      monitoringWindow: dependency.config.interval * 5,
    });
    this.circuitBreakers.set(serviceName, circuitBreaker);

    // Initialize health status
    this.healthStatuses.set(serviceName, {
      service: serviceName,
      status: 'unknown',
      lastCheck: new Date(),
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      uptime: 100,
      details: {
        endpoint: dependency.config.endpoint,
      },
    });

    // Start health check interval
    const intervalId = setInterval(async () => {
      await this.performHealthCheck(serviceName, dependency);
    }, dependency.config.interval);

    this.checks.set(serviceName, intervalId);

    // Perform initial check
    setImmediate(() => this.performHealthCheck(serviceName, dependency));
  }

  /**
   * Stop health check for a service
   */
  stopHealthCheck(serviceName: string): void {
    const intervalId = this.checks.get(serviceName);
    if (intervalId) {
      clearInterval(intervalId);
      this.checks.delete(serviceName);
    }
  }

  /**
   * Get health status for a service
   */
  getHealthStatus(serviceName: string): HealthStatus | null {
    return this.healthStatuses.get(serviceName) || null;
  }

  /**
   * Get health status for all services
   */
  getAllHealthStatuses(): Record<string, HealthStatus> {
    const statuses: Record<string, HealthStatus> = {};
    for (const [service, status] of this.healthStatuses) {
      statuses[service] = status;
    }
    return statuses;
  }

  /**
   * Get overall system health
   */
  getOverallHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, HealthStatus>;
    summary: {
      total: number;
      healthy: number;
      unhealthy: number;
      degraded: number;
      critical_unhealthy: number;
    };
  } {
    const services = this.getAllHealthStatuses();
    const summary = {
      total: 0,
      healthy: 0,
      unhealthy: 0,
      degraded: 0,
      critical_unhealthy: 0,
    };

    for (const status of Object.values(services)) {
      summary.total++;
      switch (status.status) {
        case 'healthy':
          summary.healthy++;
          break;
        case 'unhealthy':
          summary.unhealthy++;
          break;
        case 'degraded':
          summary.degraded++;
          break;
      }
    }

    // Determine overall status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (summary.critical_unhealthy > 0 || summary.unhealthy > summary.healthy) {
      overallStatus = 'unhealthy';
    } else if (summary.degraded > 0 || summary.unhealthy > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    return {
      status: overallStatus,
      services,
      summary,
    };
  }

  /**
   * Perform health check for a specific service
   */
  private async performHealthCheck(
    serviceName: string,
    dependency: ServiceDependency
  ): Promise<void> {
    const config = dependency.config;
    const circuitBreaker = this.circuitBreakers.get(serviceName);
    let currentStatus = this.healthStatuses.get(serviceName);

    if (!currentStatus) return;

    try {
      // Check if circuit breaker is open
      if (circuitBreaker && await circuitBreaker.isOpen(serviceName)) {
        this.updateHealthStatus(serviceName, {
          status: 'unhealthy',
          error: 'Circuit breaker is open',
          statusCode: 0,
          responseTime: 0,
        });
        return;
      }

      const startTime = Date.now();
      
      // Perform HTTP health check
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout);

      const response = await fetch(config.endpoint, {
        method: config.method,
        headers: config.headers,
        body: config.body ? JSON.stringify(config.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      
      const responseTime = Date.now() - startTime;
      const isStatusCodeValid = config.expectedStatusCodes.includes(response.status);
      const isResponseTimeValid = !config.expectedResponseTime || 
        responseTime <= config.expectedResponseTime;

      let isCustomValidationValid = true;
      if (config.customValidator) {
        try {
          const responseData = await response.json();
          isCustomValidationValid = config.customValidator(responseData);
        } catch (error) {
          isCustomValidationValid = false;
        }
      }

      const isHealthy = isStatusCodeValid && isResponseTimeValid && isCustomValidationValid;

      if (isHealthy) {
        if (circuitBreaker) {
          await circuitBreaker.recordSuccess(serviceName);
        }

        this.updateHealthStatus(serviceName, {
          status: isResponseTimeValid ? 'healthy' : 'degraded',
          statusCode: response.status,
          responseTime,
        });
      } else {
        if (circuitBreaker) {
          await circuitBreaker.recordFailure(serviceName);
        }

        this.updateHealthStatus(serviceName, {
          status: 'unhealthy',
          statusCode: response.status,
          responseTime,
          error: `Health check failed: status=${response.status}, responseTime=${responseTime}ms`,
        });
      }

    } catch (error) {
      if (circuitBreaker) {
        await circuitBreaker.recordFailure(serviceName);
      }

      this.updateHealthStatus(serviceName, {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 0,
        responseTime: Date.now() - Date.now(),
      });
    }
  }

  /**
   * Update health status for a service
   */
  private updateHealthStatus(
    serviceName: string,
    update: {
      status: 'healthy' | 'unhealthy' | 'degraded';
      statusCode?: number;
      responseTime?: number;
      error?: string;
    }
  ): void {
    const currentStatus = this.healthStatuses.get(serviceName);
    if (!currentStatus) return;

    const wasHealthy = currentStatus.status === 'healthy';
    const isNowHealthy = update.status === 'healthy';

    // Update consecutive counters
    if (isNowHealthy) {
      currentStatus.consecutiveSuccesses++;
      currentStatus.consecutiveFailures = 0;
    } else {
      currentStatus.consecutiveFailures++;
      currentStatus.consecutiveSuccesses = 0;
    }

    // Update status
    currentStatus.status = update.status;
    currentStatus.lastCheck = new Date();
    currentStatus.responseTime = update.responseTime;
    currentStatus.statusCode = update.statusCode;
    
    if (update.error) {
      currentStatus.details.error = update.error;
    } else {
      delete currentStatus.details.error;
    }

    // Calculate uptime (simplified - in production, you'd want more sophisticated tracking)
    const totalChecks = currentStatus.consecutiveSuccesses + currentStatus.consecutiveFailures;
    if (totalChecks > 0) {
      currentStatus.uptime = (currentStatus.consecutiveSuccesses / totalChecks) * 100;
    }

    // Store in Redis for persistence
    this.storeHealthStatus(serviceName, currentStatus);

    // Trigger alerts if status changed
    if (wasHealthy && !isNowHealthy) {
      this.triggerHealthAlert(serviceName, currentStatus, 'degraded');
    } else if (!wasHealthy && isNowHealthy) {
      this.triggerHealthAlert(serviceName, currentStatus, 'recovered');
    }
  }

  /**
   * Store health status in Redis
   */
  private async storeHealthStatus(
    serviceName: string,
    status: HealthStatus
  ): Promise<void> {
    await this.redis.hset(
      'health_statuses',
      serviceName,
      JSON.stringify({
        ...status,
        lastCheck: status.lastCheck.toISOString(),
      })
    );

    // Also store in time series for historical analysis
    await this.redis.zadd(
      `health_history:${serviceName}`,
      status.lastCheck.getTime(),
      JSON.stringify({
        status: status.status,
        responseTime: status.responseTime,
        statusCode: status.statusCode,
        timestamp: status.lastCheck.toISOString(),
      })
    );

    // Clean up old history (keep 7 days)
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    await this.redis.zremrangebyscore(
      `health_history:${serviceName}`,
      '-inf',
      sevenDaysAgo
    );
  }

  /**
   * Load health statuses from Redis on startup
   */
  async loadHealthStatuses(): Promise<void> {
    const statuses = await this.redis.hgetall('health_statuses');
    
    for (const [serviceName, statusData] of Object.entries(statuses)) {
      try {
        const status = JSON.parse(statusData);
        status.lastCheck = new Date(status.lastCheck);
        this.healthStatuses.set(serviceName, status);
      } catch (error) {
        console.error(`Error loading health status for ${serviceName}:`, error);
      }
    }
  }

  /**
   * Get health check history for a service
   */
  async getHealthHistory(
    serviceName: string,
    startTime?: Date,
    endTime?: Date
  ): Promise<Array<{
    status: string;
    responseTime?: number;
    statusCode?: number;
    timestamp: Date;
  }>> {
    const start = startTime ? startTime.getTime() : Date.now() - (24 * 60 * 60 * 1000);
    const end = endTime ? endTime.getTime() : Date.now();

    const history = await this.redis.zrangebyscore(
      `health_history:${serviceName}`,
      start,
      end
    );

    return history.map(data => {
      const parsed = JSON.parse(data);
      return {
        ...parsed,
        timestamp: new Date(parsed.timestamp),
      };
    });
  }

  /**
   * Trigger health alert
   */
  private async triggerHealthAlert(
    serviceName: string,
    status: HealthStatus,
    alertType: 'degraded' | 'recovered'
  ): Promise<void> {
    const alert = {
      type: `health_${alertType}`,
      service: serviceName,
      status: status.status,
      message: alertType === 'degraded' 
        ? `Service ${serviceName} is now ${status.status}`
        : `Service ${serviceName} has recovered`,
      details: status.details,
      timestamp: new Date().toISOString(),
    };

    // Store alert for processing
    await this.redis.lpush('health_alerts', JSON.stringify(alert));
    
    console.log(`Health Alert [${serviceName}]: ${alert.message}`);
  }

  /**
   * Register multiple health checks at once
   */
  registerMultipleHealthChecks(dependencies: ServiceDependency[]): void {
    for (const dependency of dependencies) {
      this.registerHealthCheck(dependency.name, dependency);
    }
  }

  /**
   * Cleanup resources
   */
  shutdown(): void {
    for (const [serviceName, intervalId] of this.checks) {
      clearInterval(intervalId);
    }
    this.checks.clear();
    this.circuitBreakers.clear();
    this.healthStatuses.clear();
  }
}

/**
 * Pre-configured health checks for common services
 */
export const CommonHealthChecks = {
  postgres: (host: string, port: number = 5432): ServiceDependency => ({
    name: 'postgresql',
    type: 'database',
    critical: true,
    config: {
      endpoint: `http://${host}:${port}/health`, // Assuming health endpoint
      method: 'GET',
      timeout: 5000,
      interval: 30000,
      retries: 3,
      healthyThreshold: 2,
      unhealthyThreshold: 3,
      expectedStatusCodes: [200],
      expectedResponseTime: 1000,
    },
  }),

  redis: (host: string, port: number = 6379): ServiceDependency => ({
    name: 'redis',
    type: 'cache',
    critical: true,
    config: {
      endpoint: `http://${host}:${port}/health`, // Assuming health endpoint
      method: 'GET',
      timeout: 2000,
      interval: 15000,
      retries: 3,
      healthyThreshold: 2,
      unhealthyThreshold: 3,
      expectedStatusCodes: [200],
      expectedResponseTime: 500,
    },
  }),

  backstage: (baseUrl: string): ServiceDependency => ({
    name: 'backstage',
    type: 'api',
    critical: true,
    config: {
      endpoint: `${baseUrl}/api/catalog/health`,
      method: 'GET',
      timeout: 10000,
      interval: 30000,
      retries: 2,
      healthyThreshold: 2,
      unhealthyThreshold: 3,
      expectedStatusCodes: [200],
      expectedResponseTime: 2000,
    },
  }),

  nextPortal: (baseUrl: string): ServiceDependency => ({
    name: 'next-portal',
    type: 'api',
    critical: true,
    config: {
      endpoint: `${baseUrl}/api/health`,
      method: 'GET',
      timeout: 5000,
      interval: 30000,
      retries: 2,
      healthyThreshold: 2,
      unhealthyThreshold: 3,
      expectedStatusCodes: [200],
      expectedResponseTime: 1000,
      customValidator: (response: any) => {
        return response && response.status === 'ok';
      },
    },
  }),

  prometheus: (host: string, port: number = 9090): ServiceDependency => ({
    name: 'prometheus',
    type: 'api',
    critical: false,
    config: {
      endpoint: `http://${host}:${port}/-/healthy`,
      method: 'GET',
      timeout: 5000,
      interval: 60000,
      retries: 2,
      healthyThreshold: 2,
      unhealthyThreshold: 3,
      expectedStatusCodes: [200],
    },
  }),

  grafana: (host: string, port: number = 3000): ServiceDependency => ({
    name: 'grafana',
    type: 'api',
    critical: false,
    config: {
      endpoint: `http://${host}:${port}/api/health`,
      method: 'GET',
      timeout: 5000,
      interval: 60000,
      retries: 2,
      healthyThreshold: 2,
      unhealthyThreshold: 3,
      expectedStatusCodes: [200],
    },
  }),
};