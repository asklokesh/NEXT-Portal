/**
 * Global Load Balancing with Health-Based Routing
 * Multi-region load balancing with intelligent health monitoring and failover
 */

export interface LoadBalancerConfig {
  id: string;
  name: string;
  algorithm: 'round_robin' | 'weighted_round_robin' | 'least_connections' | 'health_weighted' | 'geographic';
  healthCheck: HealthCheckConfig;
  failover: FailoverConfig;
  enabled: boolean;
}

export interface HealthCheckConfig {
  enabled: boolean;
  interval: number; // seconds
  timeout: number; // seconds
  retries: number;
  healthyThreshold: number;
  unhealthyThreshold: number;
  path: string;
  expectedStatus: number[];
  expectedBody?: string;
}

export interface FailoverConfig {
  enabled: boolean;
  mode: 'automatic' | 'manual';
  threshold: number; // percentage of healthy backends required
  cooldownPeriod: number; // seconds
  maxFailovers: number;
  notificationThreshold: number; // seconds to notify about prolonged outage
}

export interface LoadBalancerTarget {
  id: string;
  region: string;
  endpoint: string;
  weight: number;
  priority: number; // 1 = highest priority
  status: 'healthy' | 'unhealthy' | 'draining' | 'maintenance';
  healthScore: number; // 0-100
  metrics: TargetMetrics;
  lastHealthCheck: Date;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
}

export interface TargetMetrics {
  responseTime: number;
  connectionsActive: number;
  connectionsTotal: number;
  requestsPerSecond: number;
  errorRate: number;
  cpuUsage: number;
  memoryUsage: number;
  uptime: number;
}

export interface RoutingDecision {
  targetId: string;
  reason: string;
  algorithm: string;
  latency: number;
  healthScore: number;
  alternativeTargets: string[];
  timestamp: Date;
}

export interface LoadBalancingRequest {
  id: string;
  clientIP: string;
  userAgent: string;
  path: string;
  method: string;
  headers: Record<string, string>;
  clientLocation?: {
    country: string;
    region: string;
    coordinates: { latitude: number; longitude: number };
  };
  timestamp: Date;
}

export interface LoadBalancingResponse {
  requestId: string;
  targetUsed: string;
  responseTime: number;
  statusCode: number;
  bytesSent: number;
  routing: RoutingDecision;
  timestamp: Date;
}

export interface FailoverEvent {
  id: string;
  timestamp: Date;
  triggeredBy: 'health_check' | 'manual' | 'threshold_breach';
  failedTargets: string[];
  activeTargets: string[];
  duration?: number;
  reason: string;
  impact: {
    affectedRequests: number;
    trafficRerouted: number;
  };
}

/**
 * Global Load Balancer Manager
 */
export class GlobalLoadBalancer {
  private configs: Map<string, LoadBalancerConfig> = new Map();
  private targets: Map<string, LoadBalancerTarget> = new Map();
  private targetsByRegion: Map<string, string[]> = new Map();
  private routingHistory: RoutingDecision[] = [];
  private requestHistory: LoadBalancingRequest[] = [];
  private responseHistory: LoadBalancingResponse[] = [];
  private failoverHistory: FailoverEvent[] = [];
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();
  private routingCounters: Map<string, number> = new Map(); // For round-robin

  constructor() {
    this.initializeDefaultConfig();
    this.initializeTargets();
    this.startHealthChecks();
    this.startMetricsCollection();
  }

  /**
   * Route request to optimal target
   */
  async routeRequest(request: Omit<LoadBalancingRequest, 'id' | 'timestamp'>): Promise<{
    response: LoadBalancingResponse;
    routing: RoutingDecision;
  }> {
    const requestId = this.generateRequestId();
    const timestamp = new Date();

    const loadBalancingRequest: LoadBalancingRequest = {
      ...request,
      id: requestId,
      timestamp
    };

    const config = this.configs.get('default') || this.getDefaultConfig();
    const routing = await this.selectTarget(loadBalancingRequest, config);

    if (!routing) {
      throw new Error('No healthy targets available');
    }

    const target = this.targets.get(routing.targetId);
    if (!target) {
      throw new Error(`Target not found: ${routing.targetId}`);
    }

    // Execute request
    const response = await this.executeRequest(loadBalancingRequest, target, routing);

    // Record request and response
    this.requestHistory.push(loadBalancingRequest);
    this.responseHistory.push(response);
    this.routingHistory.push(routing);

    // Keep history bounded
    if (this.requestHistory.length > 10000) {
      this.requestHistory = this.requestHistory.slice(-5000);
      this.responseHistory = this.responseHistory.slice(-5000);
      this.routingHistory = this.routingHistory.slice(-5000);
    }

    // Update target metrics
    this.updateTargetMetrics(target.id, {
      requestsPerSecond: target.metrics.requestsPerSecond + 1,
      connectionsActive: target.metrics.connectionsActive + 1,
      responseTime: (target.metrics.responseTime * 0.9 + response.responseTime * 0.1)
    });

    return { response, routing };
  }

  /**
   * Register load balancing target
   */
  registerTarget(target: Omit<LoadBalancerTarget, 'lastHealthCheck' | 'consecutiveFailures' | 'consecutiveSuccesses'>): void {
    const loadBalancerTarget: LoadBalancerTarget = {
      ...target,
      lastHealthCheck: new Date(),
      consecutiveFailures: 0,
      consecutiveSuccesses: 0
    };

    this.targets.set(target.id, loadBalancerTarget);

    // Update region mapping
    let regionTargets = this.targetsByRegion.get(target.region) || [];
    regionTargets.push(target.id);
    this.targetsByRegion.set(target.region, regionTargets);

    // Start health checks for this target
    this.startTargetHealthCheck(target.id);

    console.log(`Registered load balancer target: ${target.id} in region ${target.region}`);
  }

  /**
   * Remove target from rotation
   */
  deregisterTarget(targetId: string): void {
    const target = this.targets.get(targetId);
    if (target) {
      // Stop health checks
      const interval = this.healthCheckIntervals.get(targetId);
      if (interval) {
        clearInterval(interval);
        this.healthCheckIntervals.delete(targetId);
      }

      // Remove from region mapping
      const regionTargets = this.targetsByRegion.get(target.region) || [];
      this.targetsByRegion.set(
        target.region,
        regionTargets.filter(id => id !== targetId)
      );

      this.targets.delete(targetId);
      console.log(`Deregistered load balancer target: ${targetId}`);
    }
  }

  /**
   * Trigger manual failover
   */
  async triggerFailover(
    reason: string,
    targetIds?: string[]
  ): Promise<FailoverEvent> {
    const startTime = Date.now();
    const failedTargets = targetIds || Array.from(this.targets.values())
      .filter(t => t.status === 'unhealthy')
      .map(t => t.id);

    // Mark targets as unhealthy
    for (const targetId of failedTargets) {
      const target = this.targets.get(targetId);
      if (target) {
        target.status = 'unhealthy';
        target.healthScore = 0;
      }
    }

    const activeTargets = Array.from(this.targets.values())
      .filter(t => t.status === 'healthy')
      .map(t => t.id);

    const failoverEvent: FailoverEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      triggeredBy: 'manual',
      failedTargets,
      activeTargets,
      duration: Date.now() - startTime,
      reason,
      impact: {
        affectedRequests: this.estimateAffectedRequests(failedTargets),
        trafficRerouted: 100 // percentage
      }
    };

    this.failoverHistory.push(failoverEvent);

    // Keep history bounded
    if (this.failoverHistory.length > 100) {
      this.failoverHistory = this.failoverHistory.slice(-50);
    }

    console.warn(`Manual failover triggered:`, failoverEvent);
    return failoverEvent;
  }

  /**
   * Get load balancing analytics
   */
  getAnalytics(timeRange?: { start: Date; end: Date }): {
    totalRequests: number;
    requestsByTarget: Array<{ targetId: string; requests: number; avgResponseTime: number }>;
    routingAlgorithmStats: Record<string, number>;
    healthStatus: Array<{ targetId: string; status: string; healthScore: number }>;
    failoverEvents: number;
    avgResponseTime: number;
    errorRate: number;
    throughput: number;
    geographicDistribution: Array<{ region: string; requests: number }>;
  } {
    let requests = this.requestHistory;
    let responses = this.responseHistory;
    let routing = this.routingHistory;

    if (timeRange) {
      requests = requests.filter(r => 
        r.timestamp >= timeRange.start && r.timestamp <= timeRange.end
      );
      responses = responses.filter(r => 
        r.timestamp >= timeRange.start && r.timestamp <= timeRange.end
      );
      routing = routing.filter(r => 
        r.timestamp >= timeRange.start && r.timestamp <= timeRange.end
      );
    }

    const totalRequests = requests.length;

    // Requests by target
    const targetStats = new Map<string, { count: number; totalResponseTime: number }>();
    for (const response of responses) {
      const stats = targetStats.get(response.targetUsed) || { count: 0, totalResponseTime: 0 };
      stats.count++;
      stats.totalResponseTime += response.responseTime;
      targetStats.set(response.targetUsed, stats);
    }

    const requestsByTarget = Array.from(targetStats.entries())
      .map(([targetId, stats]) => ({
        targetId,
        requests: stats.count,
        avgResponseTime: stats.totalResponseTime / stats.count
      }))
      .sort((a, b) => b.requests - a.requests);

    // Routing algorithm statistics
    const algorithmStats: Record<string, number> = {};
    for (const decision of routing) {
      algorithmStats[decision.algorithm] = (algorithmStats[decision.algorithm] || 0) + 1;
    }

    // Health status
    const healthStatus = Array.from(this.targets.values())
      .map(target => ({
        targetId: target.id,
        status: target.status,
        healthScore: target.healthScore
      }));

    // Performance metrics
    const avgResponseTime = responses.length > 0 ?
      responses.reduce((sum, r) => sum + r.responseTime, 0) / responses.length : 0;

    const errorCount = responses.filter(r => r.statusCode >= 400).length;
    const errorRate = totalRequests > 0 ? errorCount / totalRequests : 0;

    const timeSpan = timeRange ? 
      (timeRange.end.getTime() - timeRange.start.getTime()) / 1000 : 3600; // 1 hour default
    const throughput = totalRequests / timeSpan;

    // Geographic distribution
    const regionStats = new Map<string, number>();
    for (const response of responses) {
      const target = this.targets.get(response.targetUsed);
      if (target) {
        const count = regionStats.get(target.region) || 0;
        regionStats.set(target.region, count + 1);
      }
    }

    const geographicDistribution = Array.from(regionStats.entries())
      .map(([region, requests]) => ({ region, requests }))
      .sort((a, b) => b.requests - a.requests);

    return {
      totalRequests,
      requestsByTarget,
      routingAlgorithmStats: algorithmStats,
      healthStatus,
      failoverEvents: this.failoverHistory.length,
      avgResponseTime,
      errorRate,
      throughput,
      geographicDistribution
    };
  }

  /**
   * Select optimal target based on load balancing algorithm
   */
  private async selectTarget(
    request: LoadBalancingRequest,
    config: LoadBalancerConfig
  ): Promise<RoutingDecision | null> {
    const startTime = Date.now();
    const healthyTargets = Array.from(this.targets.values())
      .filter(target => target.status === 'healthy');

    if (healthyTargets.length === 0) {
      return null;
    }

    let selectedTarget: LoadBalancerTarget;
    let reason: string;

    switch (config.algorithm) {
      case 'round_robin':
        selectedTarget = this.selectRoundRobin(healthyTargets);
        reason = 'Round-robin distribution';
        break;

      case 'weighted_round_robin':
        selectedTarget = this.selectWeightedRoundRobin(healthyTargets);
        reason = 'Weighted round-robin distribution';
        break;

      case 'least_connections':
        selectedTarget = this.selectLeastConnections(healthyTargets);
        reason = 'Least connections algorithm';
        break;

      case 'health_weighted':
        selectedTarget = this.selectHealthWeighted(healthyTargets);
        reason = 'Health-weighted selection';
        break;

      case 'geographic':
        selectedTarget = this.selectGeographic(healthyTargets, request.clientLocation);
        reason = 'Geographic proximity';
        break;

      default:
        selectedTarget = healthyTargets[0];
        reason = 'Default selection';
    }

    const routingLatency = Date.now() - startTime;
    const alternatives = healthyTargets
      .filter(t => t.id !== selectedTarget.id)
      .sort((a, b) => b.healthScore - a.healthScore)
      .slice(0, 2)
      .map(t => t.id);

    return {
      targetId: selectedTarget.id,
      reason,
      algorithm: config.algorithm,
      latency: routingLatency,
      healthScore: selectedTarget.healthScore,
      alternativeTargets: alternatives,
      timestamp: new Date()
    };
  }

  /**
   * Round-robin target selection
   */
  private selectRoundRobin(targets: LoadBalancerTarget[]): LoadBalancerTarget {
    const currentCount = this.routingCounters.get('round_robin') || 0;
    const selectedIndex = currentCount % targets.length;
    this.routingCounters.set('round_robin', currentCount + 1);
    return targets[selectedIndex];
  }

  /**
   * Weighted round-robin target selection
   */
  private selectWeightedRoundRobin(targets: LoadBalancerTarget[]): LoadBalancerTarget {
    const totalWeight = targets.reduce((sum, target) => sum + target.weight, 0);
    const random = Math.random() * totalWeight;
    
    let cumulativeWeight = 0;
    for (const target of targets) {
      cumulativeWeight += target.weight;
      if (random <= cumulativeWeight) {
        return target;
      }
    }
    
    return targets[0];
  }

  /**
   * Least connections target selection
   */
  private selectLeastConnections(targets: LoadBalancerTarget[]): LoadBalancerTarget {
    return targets.reduce((least, current) => 
      current.metrics.connectionsActive < least.metrics.connectionsActive ? current : least
    );
  }

  /**
   * Health-weighted target selection
   */
  private selectHealthWeighted(targets: LoadBalancerTarget[]): LoadBalancerTarget {
    const totalHealthScore = targets.reduce((sum, target) => sum + target.healthScore, 0);
    const random = Math.random() * totalHealthScore;
    
    let cumulativeScore = 0;
    for (const target of targets) {
      cumulativeScore += target.healthScore;
      if (random <= cumulativeScore) {
        return target;
      }
    }
    
    return targets[0];
  }

  /**
   * Geographic proximity target selection
   */
  private selectGeographic(
    targets: LoadBalancerTarget[],
    clientLocation?: { coordinates: { latitude: number; longitude: number } }
  ): LoadBalancerTarget {
    if (!clientLocation) {
      return this.selectHealthWeighted(targets);
    }

    // Regional coordinates (simplified)
    const regionCoords: Record<string, { latitude: number; longitude: number }> = {
      'us-east-1': { latitude: 38.13, longitude: -78.45 },
      'us-west-1': { latitude: 37.35, longitude: -121.96 },
      'eu-west-1': { latitude: 53.41, longitude: -8.24 },
      'ap-southeast-1': { latitude: 1.37, longitude: 103.8 },
      'ap-northeast-1': { latitude: 35.41, longitude: 139.42 }
    };

    let closestTarget = targets[0];
    let minDistance = Infinity;

    for (const target of targets) {
      const targetCoords = regionCoords[target.region];
      if (targetCoords) {
        const distance = this.calculateDistance(clientLocation.coordinates, targetCoords);
        // Factor in health score
        const score = distance * (1 - target.healthScore / 100);
        
        if (score < minDistance) {
          minDistance = score;
          closestTarget = target;
        }
      }
    }

    return closestTarget;
  }

  /**
   * Calculate geographic distance
   */
  private calculateDistance(
    point1: { latitude: number; longitude: number },
    point2: { latitude: number; longitude: number }
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
    const dLon = (point2.longitude - point1.longitude) * Math.PI / 180;
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Execute request against selected target
   */
  private async executeRequest(
    request: LoadBalancingRequest,
    target: LoadBalancerTarget,
    routing: RoutingDecision
  ): Promise<LoadBalancingResponse> {
    const startTime = Date.now();

    try {
      // Simulate request execution
      const baseLatency = target.metrics.responseTime;
      const variability = baseLatency * 0.2;
      const responseTime = baseLatency + (Math.random() - 0.5) * variability;

      await new Promise(resolve => setTimeout(resolve, Math.max(10, responseTime)));

      // Simulate occasional errors based on target error rate
      const statusCode = Math.random() < target.metrics.errorRate ? 500 : 200;
      const bytesSent = 1000 + Math.random() * 5000;

      return {
        requestId: request.id,
        targetUsed: target.id,
        responseTime: Math.round(responseTime),
        statusCode,
        bytesSent: Math.round(bytesSent),
        routing,
        timestamp: new Date()
      };

    } catch (error) {
      // Handle request failure
      return {
        requestId: request.id,
        targetUsed: target.id,
        responseTime: Date.now() - startTime,
        statusCode: 503,
        bytesSent: 0,
        routing,
        timestamp: new Date()
      };
    }
  }

  /**
   * Perform health check on target
   */
  private async performHealthCheck(targetId: string): Promise<boolean> {
    const target = this.targets.get(targetId);
    const config = this.configs.get('default') || this.getDefaultConfig();
    
    if (!target || !config.healthCheck.enabled) {
      return true;
    }

    try {
      // Simulate health check request
      const startTime = Date.now();
      const timeout = config.healthCheck.timeout * 1000;
      
      // Simulate network delay
      const delay = 50 + Math.random() * 200;
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, delay);
        setTimeout(() => {
          clearTimeout(timer);
          reject(new Error('Health check timeout'));
        }, timeout);
      });

      const responseTime = Date.now() - startTime;
      
      // Simulate occasional health check failures
      const isHealthy = Math.random() > 0.05; // 5% failure rate

      if (isHealthy) {
        target.consecutiveSuccesses++;
        target.consecutiveFailures = 0;
        
        if (target.consecutiveSuccesses >= config.healthCheck.healthyThreshold) {
          target.status = 'healthy';
          target.healthScore = Math.min(100, target.healthScore + 10);
        }
      } else {
        target.consecutiveFailures++;
        target.consecutiveSuccesses = 0;
        
        if (target.consecutiveFailures >= config.healthCheck.unhealthyThreshold) {
          target.status = 'unhealthy';
          target.healthScore = Math.max(0, target.healthScore - 20);
        }
      }

      target.lastHealthCheck = new Date();
      target.metrics.responseTime = (target.metrics.responseTime * 0.8 + responseTime * 0.2);

      return isHealthy;

    } catch (error) {
      target.consecutiveFailures++;
      target.consecutiveSuccesses = 0;
      
      if (target.consecutiveFailures >= config.healthCheck.unhealthyThreshold) {
        target.status = 'unhealthy';
        target.healthScore = Math.max(0, target.healthScore - 20);
      }

      target.lastHealthCheck = new Date();
      return false;
    }
  }

  /**
   * Start health checks for target
   */
  private startTargetHealthCheck(targetId: string): void {
    const config = this.configs.get('default') || this.getDefaultConfig();
    
    if (!config.healthCheck.enabled) return;

    const interval = setInterval(async () => {
      await this.performHealthCheck(targetId);
    }, config.healthCheck.interval * 1000);

    this.healthCheckIntervals.set(targetId, interval);
  }

  /**
   * Start health checks for all targets
   */
  private startHealthChecks(): void {
    for (const targetId of this.targets.keys()) {
      this.startTargetHealthCheck(targetId);
    }
  }

  /**
   * Update target metrics
   */
  private updateTargetMetrics(targetId: string, updates: Partial<TargetMetrics>): void {
    const target = this.targets.get(targetId);
    if (target) {
      target.metrics = { ...target.metrics, ...updates };
    }
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    setInterval(() => {
      for (const target of this.targets.values()) {
        // Simulate realistic metric updates
        target.metrics = {
          ...target.metrics,
          cpuUsage: Math.max(10, Math.min(90, target.metrics.cpuUsage + (Math.random() - 0.5) * 10)),
          memoryUsage: Math.max(20, Math.min(85, target.metrics.memoryUsage + (Math.random() - 0.5) * 5)),
          connectionsActive: Math.max(0, target.metrics.connectionsActive + Math.floor((Math.random() - 0.5) * 10)),
          errorRate: Math.max(0, Math.min(0.1, target.metrics.errorRate + (Math.random() - 0.5) * 0.01))
        };

        // Update health score based on metrics
        target.healthScore = this.calculateHealthScore(target);
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Calculate target health score
   */
  private calculateHealthScore(target: LoadBalancerTarget): number {
    if (target.status === 'unhealthy' || target.status === 'maintenance') {
      return 0;
    }

    const responseTimeScore = Math.max(0, 100 - target.metrics.responseTime / 10);
    const errorRateScore = Math.max(0, 100 - target.metrics.errorRate * 1000);
    const cpuScore = Math.max(0, 100 - target.metrics.cpuUsage);
    const memoryScore = Math.max(0, 100 - target.metrics.memoryUsage);

    return (responseTimeScore + errorRateScore + cpuScore + memoryScore) / 4;
  }

  /**
   * Estimate affected requests for failover impact
   */
  private estimateAffectedRequests(failedTargets: string[]): number {
    const recentRequests = this.responseHistory.filter(r => 
      Date.now() - r.timestamp.getTime() < 60000 // Last minute
    );

    return recentRequests.filter(r => failedTargets.includes(r.targetUsed)).length;
  }

  /**
   * Initialize default configuration
   */
  private initializeDefaultConfig(): void {
    const defaultConfig: LoadBalancerConfig = {
      id: 'default',
      name: 'Default Load Balancer',
      algorithm: 'health_weighted',
      healthCheck: {
        enabled: true,
        interval: 30,
        timeout: 5,
        retries: 3,
        healthyThreshold: 2,
        unhealthyThreshold: 3,
        path: '/health',
        expectedStatus: [200, 204]
      },
      failover: {
        enabled: true,
        mode: 'automatic',
        threshold: 50,
        cooldownPeriod: 300,
        maxFailovers: 5,
        notificationThreshold: 900
      },
      enabled: true
    };

    this.configs.set('default', defaultConfig);
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): LoadBalancerConfig {
    return this.configs.get('default')!;
  }

  /**
   * Initialize default targets
   */
  private initializeTargets(): void {
    const targets: Omit<LoadBalancerTarget, 'lastHealthCheck' | 'consecutiveFailures' | 'consecutiveSuccesses'>[] = [
      {
        id: 'lb-target-us-east-1',
        region: 'us-east-1',
        endpoint: 'https://lb-us-east-1.nextportal.com',
        weight: 100,
        priority: 1,
        status: 'healthy',
        healthScore: 95,
        metrics: {
          responseTime: 120,
          connectionsActive: 45,
          connectionsTotal: 150,
          requestsPerSecond: 50,
          errorRate: 0.01,
          cpuUsage: 45,
          memoryUsage: 60,
          uptime: 99.9
        }
      },
      {
        id: 'lb-target-us-west-1',
        region: 'us-west-1',
        endpoint: 'https://lb-us-west-1.nextportal.com',
        weight: 80,
        priority: 2,
        status: 'healthy',
        healthScore: 92,
        metrics: {
          responseTime: 100,
          connectionsActive: 35,
          connectionsTotal: 120,
          requestsPerSecond: 45,
          errorRate: 0.008,
          cpuUsage: 40,
          memoryUsage: 55,
          uptime: 99.95
        }
      },
      {
        id: 'lb-target-eu-west-1',
        region: 'eu-west-1',
        endpoint: 'https://lb-eu-west-1.nextportal.com',
        weight: 75,
        priority: 2,
        status: 'healthy',
        healthScore: 90,
        metrics: {
          responseTime: 95,
          connectionsActive: 30,
          connectionsTotal: 100,
          requestsPerSecond: 40,
          errorRate: 0.005,
          cpuUsage: 38,
          memoryUsage: 52,
          uptime: 99.8
        }
      },
      {
        id: 'lb-target-ap-southeast-1',
        region: 'ap-southeast-1',
        endpoint: 'https://lb-ap-southeast-1.nextportal.com',
        weight: 60,
        priority: 3,
        status: 'healthy',
        healthScore: 88,
        metrics: {
          responseTime: 110,
          connectionsActive: 25,
          connectionsTotal: 80,
          requestsPerSecond: 35,
          errorRate: 0.012,
          cpuUsage: 50,
          memoryUsage: 65,
          uptime: 99.7
        }
      }
    ];

    for (const target of targets) {
      this.registerTarget(target);
    }

    console.log(`Initialized ${this.targets.size} load balancer targets`);
  }

  private generateRequestId(): string {
    return `lb_req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEventId(): string {
    return `lb_event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get system statistics
   */
  getStatistics(): {
    totalTargets: number;
    healthyTargets: number;
    totalRequests: number;
    avgResponseTime: number;
    errorRate: number;
    failoverEvents: number;
    routingDistribution: Record<string, number>;
  } {
    const analytics = this.getAnalytics();
    const healthyTargets = Array.from(this.targets.values()).filter(t => t.status === 'healthy');

    return {
      totalTargets: this.targets.size,
      healthyTargets: healthyTargets.length,
      totalRequests: analytics.totalRequests,
      avgResponseTime: analytics.avgResponseTime,
      errorRate: analytics.errorRate,
      failoverEvents: analytics.failoverEvents,
      routingDistribution: analytics.routingAlgorithmStats
    };
  }
}

// Global load balancer instance
export const globalLoadBalancer = new GlobalLoadBalancer();

export default globalLoadBalancer;