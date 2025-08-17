/**
 * Geo-Distributed Read Replicas with Intelligent Routing
 * Multi-region database architecture with automated failover
 */

export interface DatabaseReplica {
  id: string;
  region: string;
  endpoint: string;
  type: 'primary' | 'read_replica' | 'standby';
  status: 'online' | 'offline' | 'syncing' | 'failed' | 'maintenance';
  replicationLag: number; // milliseconds
  lastSync: Date;
  connections: {
    active: number;
    max: number;
    poolSize: number;
  };
  metrics: {
    queryLatency: number;
    throughput: number;
    errorRate: number;
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkIO: number;
  };
  capabilities: {
    readQueries: boolean;
    writeQueries: boolean;
    analyticsQueries: boolean;
    backupSource: boolean;
  };
  priority: number; // Lower number = higher priority
  healthScore: number; // 0-100
}

export interface ReplicationTopology {
  primary: string;
  readReplicas: string[];
  standbyNodes: string[];
  crossRegionLinks: Array<{
    source: string;
    target: string;
    latency: number;
    bandwidth: number;
  }>;
}

export interface QueryRoute {
  replicaId: string;
  reason: string;
  latency: number;
  confidence: number;
  alternatives: string[];
}

export interface QueryRequest {
  id: string;
  type: 'read' | 'write' | 'analytics';
  query: string;
  tenantId?: string;
  userId?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  consistency: 'eventual' | 'strong' | 'bounded_staleness';
  maxStaleness?: number; // milliseconds
  timeout: number;
  clientRegion?: string;
  timestamp: Date;
}

export interface QueryResult {
  requestId: string;
  replicaUsed: string;
  executionTime: number;
  rowsAffected?: number;
  cacheHit: boolean;
  replicationLag: number;
  consistency: 'eventual' | 'strong';
  error?: string;
}

export interface FailoverEvent {
  id: string;
  timestamp: Date;
  failedReplica: string;
  newPrimary?: string;
  reason: string;
  duration: number;
  affectedQueries: number;
  recoveryAction: string;
}

/**
 * Geo-Distributed Database Manager
 */
export class GeoDistributedDatabaseManager {
  private replicas: Map<string, DatabaseReplica> = new Map();
  private topology: ReplicationTopology = {
    primary: '',
    readReplicas: [],
    standbyNodes: [],
    crossRegionLinks: []
  };
  private queryHistory: QueryResult[] = [];
  private failoverHistory: FailoverEvent[] = [];
  private readOnlyQueries: Set<string> = new Set();
  private replicationMonitor: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeReplicas();
    this.setupReplicationTopology();
    this.startHealthMonitoring();
    this.startReplicationMonitoring();
    this.initializeReadOnlyQueries();
  }

  /**
   * Route query to optimal database replica
   */
  async routeQuery(request: QueryRequest): Promise<{
    result: QueryResult;
    route: QueryRoute;
  }> {
    const startTime = Date.now();
    
    // Determine optimal replica
    const route = await this.selectOptimalReplica(request);
    const replica = this.replicas.get(route.replicaId);
    
    if (!replica) {
      throw new Error(`Replica not available: ${route.replicaId}`);
    }

    // Execute query
    try {
      const result = await this.executeQuery(request, replica);
      
      // Record query result
      this.queryHistory.push(result);
      
      // Keep history bounded
      if (this.queryHistory.length > 10000) {
        this.queryHistory = this.queryHistory.slice(-5000);
      }

      return { result, route };

    } catch (error) {
      // Handle failover if needed
      if (this.isConnectionError(error)) {
        console.warn(`Connection error to replica ${route.replicaId}, attempting failover`);
        return this.handleQueryFailover(request, route);
      }
      
      throw error;
    }
  }

  /**
   * Handle automatic failover for failed queries
   */
  private async handleQueryFailover(
    request: QueryRequest, 
    failedRoute: QueryRoute
  ): Promise<{
    result: QueryResult;
    route: QueryRoute;
  }> {
    // Mark replica as potentially failed
    const failedReplica = this.replicas.get(failedRoute.replicaId);
    if (failedReplica) {
      failedReplica.status = 'failed';
      failedReplica.healthScore = 0;
    }

    // Select alternative replica
    const alternativeReplicaId = failedRoute.alternatives[0];
    if (!alternativeReplicaId) {
      throw new Error('No alternative replicas available');
    }

    const alternativeReplica = this.replicas.get(alternativeReplicaId);
    if (!alternativeReplica) {
      throw new Error(`Alternative replica not found: ${alternativeReplicaId}`);
    }

    // Execute on alternative
    const result = await this.executeQuery(request, alternativeReplica);
    
    const newRoute: QueryRoute = {
      replicaId: alternativeReplicaId,
      reason: 'Failover from failed replica',
      latency: result.executionTime,
      confidence: 0.8, // Lower confidence due to failover
      alternatives: failedRoute.alternatives.slice(1)
    };

    // Record failover event
    this.recordFailoverEvent(failedRoute.replicaId, alternativeReplicaId, 'Query execution failure');

    return { result, route: newRoute };
  }

  /**
   * Select optimal replica for query execution
   */
  private async selectOptimalReplica(request: QueryRequest): Promise<QueryRoute> {
    const startTime = Date.now();
    
    // Filter replicas based on query type and requirements
    let candidateReplicas = Array.from(this.replicas.values()).filter(replica => {
      // Must be online
      if (replica.status !== 'online') return false;
      
      // Check capabilities
      switch (request.type) {
        case 'write':
          return replica.capabilities.writeQueries;
        case 'read':
          return replica.capabilities.readQueries;
        case 'analytics':
          return replica.capabilities.analyticsQueries;
        default:
          return false;
      }
    });

    if (candidateReplicas.length === 0) {
      throw new Error('No available replicas for query type');
    }

    // Apply consistency requirements
    if (request.consistency === 'strong') {
      // Strong consistency requires primary or up-to-date replicas
      candidateReplicas = candidateReplicas.filter(replica => 
        replica.type === 'primary' || replica.replicationLag < 100
      );
    } else if (request.consistency === 'bounded_staleness' && request.maxStaleness) {
      // Bounded staleness allows replicas within staleness threshold
      candidateReplicas = candidateReplicas.filter(replica => 
        replica.replicationLag <= request.maxStaleness!
      );
    }

    if (candidateReplicas.length === 0) {
      throw new Error('No replicas meet consistency requirements');
    }

    // Score and rank replicas
    let bestReplica: DatabaseReplica | null = null;
    let bestScore = -1;
    const scores: Array<{ replica: DatabaseReplica; score: number }> = [];

    for (const replica of candidateReplicas) {
      const score = this.calculateReplicaScore(replica, request);
      scores.push({ replica, score });
      
      if (score > bestScore) {
        bestScore = score;
        bestReplica = replica;
      }
    }

    if (!bestReplica) {
      throw new Error('Failed to select optimal replica');
    }

    // Sort alternatives by score
    const alternatives = scores
      .filter(s => s.replica.id !== bestReplica!.id)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(s => s.replica.id);

    const routingLatency = Date.now() - startTime;
    
    return {
      replicaId: bestReplica.id,
      reason: this.getSelectionReason(bestReplica, request),
      latency: routingLatency,
      confidence: this.calculateConfidence(bestScore, candidateReplicas.length),
      alternatives
    };
  }

  /**
   * Calculate replica score for query routing
   */
  private calculateReplicaScore(replica: DatabaseReplica, request: QueryRequest): number {
    let score = 0;

    // Health score (40% weight)
    score += replica.healthScore * 0.4;

    // Latency score (25% weight)
    const latencyScore = Math.max(0, 100 - replica.metrics.queryLatency / 10);
    score += latencyScore * 0.25;

    // Load score (20% weight)
    const loadScore = Math.max(0, 100 - (replica.connections.active / replica.connections.max) * 100);
    score += loadScore * 0.2;

    // Replication lag penalty (10% weight)
    const lagPenalty = Math.min(100, replica.replicationLag / 10);
    score += (100 - lagPenalty) * 0.1;

    // Priority bonus (5% weight)
    const priorityScore = Math.max(0, 100 - replica.priority * 10);
    score += priorityScore * 0.05;

    // Regional preference bonus
    if (request.clientRegion && replica.region === request.clientRegion) {
      score += 10; // Regional proximity bonus
    }

    // Query type optimization
    switch (request.type) {
      case 'analytics':
        if (replica.capabilities.analyticsQueries) {
          score += 5; // Analytics-optimized replica bonus
        }
        break;
      case 'write':
        if (replica.type === 'primary') {
          score += 15; // Primary replica bonus for writes
        }
        break;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get human-readable selection reason
   */
  private getSelectionReason(replica: DatabaseReplica, request: QueryRequest): string {
    const reasons = [];

    if (replica.type === 'primary' && request.type === 'write') {
      reasons.push('Primary replica for write operations');
    } else if (replica.region === request.clientRegion) {
      reasons.push('Regional proximity');
    } else if (replica.healthScore > 90) {
      reasons.push('High health score');
    } else if (replica.metrics.queryLatency < 50) {
      reasons.push('Low latency');
    } else if (replica.replicationLag < 100) {
      reasons.push('Low replication lag');
    } else {
      reasons.push('Best available option');
    }

    return reasons.join(', ');
  }

  /**
   * Calculate routing confidence
   */
  private calculateConfidence(bestScore: number, candidateCount: number): number {
    // Higher confidence with higher score and fewer alternatives
    const scoreConfidence = bestScore / 100;
    const choiceConfidence = Math.min(1, 1 / Math.sqrt(candidateCount));
    
    return (scoreConfidence * 0.7 + choiceConfidence * 0.3);
  }

  /**
   * Execute query on selected replica
   */
  private async executeQuery(request: QueryRequest, replica: DatabaseReplica): Promise<QueryResult> {
    const startTime = Date.now();
    
    // Simulate query execution
    const baseLatency = replica.metrics.queryLatency;
    const variability = baseLatency * 0.3; // 30% variability
    const executionTime = baseLatency + (Math.random() - 0.5) * variability;
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, Math.max(10, executionTime)));

    // Simulate occasional errors
    if (Math.random() < replica.metrics.errorRate) {
      throw new Error('Database query failed');
    }

    // Update replica metrics
    this.updateReplicaMetrics(replica.id, {
      queryLatency: (replica.metrics.queryLatency * 0.9 + executionTime * 0.1),
      throughput: replica.metrics.throughput + 1
    });

    const result: QueryResult = {
      requestId: request.id,
      replicaUsed: replica.id,
      executionTime: Math.round(executionTime),
      rowsAffected: request.type === 'read' ? Math.floor(Math.random() * 100) : undefined,
      cacheHit: Math.random() < 0.3, // 30% cache hit rate
      replicationLag: replica.replicationLag,
      consistency: request.consistency === 'strong' ? 'strong' : 'eventual'
    };

    return result;
  }

  /**
   * Trigger manual failover
   */
  async triggerFailover(
    failedReplicaId: string, 
    targetReplicaId?: string, 
    reason = 'Manual failover'
  ): Promise<FailoverEvent> {
    const startTime = Date.now();
    const failedReplica = this.replicas.get(failedReplicaId);
    
    if (!failedReplica) {
      throw new Error(`Replica not found: ${failedReplicaId}`);
    }

    // Mark as failed
    failedReplica.status = 'failed';
    failedReplica.healthScore = 0;

    let newPrimary: string | undefined;

    if (failedReplica.type === 'primary') {
      // Primary failover - promote standby
      const targetReplica = targetReplicaId ? 
        this.replicas.get(targetReplicaId) :
        this.selectBestStandby();

      if (!targetReplica) {
        throw new Error('No suitable standby replica for promotion');
      }

      // Promote to primary
      targetReplica.type = 'primary';
      targetReplica.capabilities.writeQueries = true;
      targetReplica.priority = 1;
      newPrimary = targetReplica.id;

      // Update topology
      this.topology.primary = targetReplica.id;
      this.topology.standbyNodes = this.topology.standbyNodes.filter(id => id !== targetReplica.id);

      console.log(`Promoted replica ${targetReplica.id} to primary`);
    }

    // Record failover event
    const failoverEvent = this.recordFailoverEvent(
      failedReplicaId, 
      newPrimary, 
      reason, 
      Date.now() - startTime
    );

    return failoverEvent;
  }

  /**
   * Select best standby replica for promotion
   */
  private selectBestStandby(): DatabaseReplica | null {
    const standbyReplicas = Array.from(this.replicas.values())
      .filter(replica => 
        replica.type === 'standby' && 
        replica.status === 'online' &&
        replica.healthScore > 70
      )
      .sort((a, b) => {
        // Sort by replication lag (lower is better) then health score
        if (a.replicationLag !== b.replicationLag) {
          return a.replicationLag - b.replicationLag;
        }
        return b.healthScore - a.healthScore;
      });

    return standbyReplicas[0] || null;
  }

  /**
   * Record failover event
   */
  private recordFailoverEvent(
    failedReplica: string,
    newPrimary?: string,
    reason = 'Unknown',
    duration = 0
  ): FailoverEvent {
    const event: FailoverEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      failedReplica,
      newPrimary,
      reason,
      duration,
      affectedQueries: this.queryHistory.filter(q => 
        q.replicaUsed === failedReplica && 
        Date.now() - new Date(q.requestId.split('_')[1]).getTime() < 60000
      ).length,
      recoveryAction: newPrimary ? 'Failover completed' : 'Replica marked as failed'
    };

    this.failoverHistory.push(event);
    
    // Keep history bounded
    if (this.failoverHistory.length > 100) {
      this.failoverHistory = this.failoverHistory.slice(-50);
    }

    console.warn(`Failover event recorded:`, event);
    return event;
  }

  /**
   * Get database analytics
   */
  getDatabaseAnalytics(timeRange?: { start: Date; end: Date }): {
    totalQueries: number;
    queriesByType: Record<string, number>;
    queriesByReplica: Array<{ replicaId: string; queries: number; avgLatency: number }>;
    avgExecutionTime: number;
    replicationLagStats: {
      avg: number;
      max: number;
      p95: number;
    };
    failoverEvents: number;
    consistencyBreakdown: Record<string, number>;
    regionalDistribution: Array<{ region: string; queries: number }>;
  } {
    let queries = this.queryHistory;
    
    if (timeRange) {
      // Filter by timestamp (simplified - would need proper timestamp parsing)
      queries = queries.slice(-1000); // Last 1000 queries for demo
    }

    const totalQueries = queries.length;
    
    // Queries by type
    const queriesByType: Record<string, number> = {};
    const queriesByReplica = new Map<string, { count: number; totalLatency: number }>();
    const consistencyBreakdown: Record<string, number> = {};
    const regionalStats = new Map<string, number>();

    for (const query of queries) {
      // Extract type from query (simplified)
      const type = query.requestId.includes('read') ? 'read' : 
                   query.requestId.includes('write') ? 'write' : 'analytics';
      queriesByType[type] = (queriesByType[type] || 0) + 1;

      // Replica stats
      const replicaStats = queriesByReplica.get(query.replicaUsed) || { count: 0, totalLatency: 0 };
      replicaStats.count++;
      replicaStats.totalLatency += query.executionTime;
      queriesByReplica.set(query.replicaUsed, replicaStats);

      // Consistency breakdown
      consistencyBreakdown[query.consistency] = (consistencyBreakdown[query.consistency] || 0) + 1;

      // Regional distribution
      const replica = this.replicas.get(query.replicaUsed);
      if (replica) {
        const count = regionalStats.get(replica.region) || 0;
        regionalStats.set(replica.region, count + 1);
      }
    }

    // Convert replica stats
    const replicaAnalytics = Array.from(queriesByReplica.entries())
      .map(([replicaId, stats]) => ({
        replicaId,
        queries: stats.count,
        avgLatency: stats.totalLatency / stats.count
      }))
      .sort((a, b) => b.queries - a.queries);

    // Replication lag stats
    const replicationLags = Array.from(this.replicas.values()).map(r => r.replicationLag);
    const avgLag = replicationLags.reduce((sum, lag) => sum + lag, 0) / replicationLags.length;
    const maxLag = Math.max(...replicationLags);
    const sortedLags = replicationLags.sort((a, b) => a - b);
    const p95Lag = sortedLags[Math.floor(sortedLags.length * 0.95)];

    // Average execution time
    const avgExecutionTime = queries.length > 0 ?
      queries.reduce((sum, q) => sum + q.executionTime, 0) / queries.length : 0;

    // Regional distribution
    const regionalDistribution = Array.from(regionalStats.entries())
      .map(([region, queries]) => ({ region, queries }))
      .sort((a, b) => b.queries - a.queries);

    return {
      totalQueries,
      queriesByType,
      queriesByReplica: replicaAnalytics,
      avgExecutionTime,
      replicationLagStats: {
        avg: avgLag,
        max: maxLag,
        p95: p95Lag
      },
      failoverEvents: this.failoverHistory.length,
      consistencyBreakdown,
      regionalDistribution
    };
  }

  /**
   * Check if error is connection-related
   */
  private isConnectionError(error: any): boolean {
    const connectionErrors = [
      'connection refused',
      'timeout',
      'network error',
      'connection reset'
    ];
    
    const errorMessage = error.message?.toLowerCase() || '';
    return connectionErrors.some(pattern => errorMessage.includes(pattern));
  }

  /**
   * Update replica metrics
   */
  private updateReplicaMetrics(replicaId: string, updates: Partial<DatabaseReplica['metrics']>): void {
    const replica = this.replicas.get(replicaId);
    if (replica) {
      replica.metrics = { ...replica.metrics, ...updates };
      
      // Recalculate health score
      replica.healthScore = this.calculateHealthScore(replica);
    }
  }

  /**
   * Calculate replica health score
   */
  private calculateHealthScore(replica: DatabaseReplica): number {
    if (replica.status !== 'online') return 0;

    const latencyScore = Math.max(0, 100 - replica.metrics.queryLatency / 10);
    const errorScore = Math.max(0, 100 - replica.metrics.errorRate * 1000);
    const cpuScore = Math.max(0, 100 - replica.metrics.cpuUsage);
    const memoryScore = Math.max(0, 100 - replica.metrics.memoryUsage);
    const connectionScore = Math.max(0, 100 - (replica.connections.active / replica.connections.max) * 100);
    const lagScore = Math.max(0, 100 - replica.replicationLag / 100);

    return (latencyScore + errorScore + cpuScore + memoryScore + connectionScore + lagScore) / 6;
  }

  /**
   * Initialize database replicas
   */
  private initializeReplicas(): void {
    const replicas: DatabaseReplica[] = [
      {
        id: 'db-primary-us-east-1',
        region: 'us-east-1',
        endpoint: 'postgres://primary.us-east-1.nextportal.com:5432',
        type: 'primary',
        status: 'online',
        replicationLag: 0,
        lastSync: new Date(),
        connections: { active: 45, max: 100, poolSize: 20 },
        metrics: {
          queryLatency: 120,
          throughput: 150,
          errorRate: 0.001,
          cpuUsage: 65,
          memoryUsage: 70,
          diskUsage: 55,
          networkIO: 250
        },
        capabilities: {
          readQueries: true,
          writeQueries: true,
          analyticsQueries: false,
          backupSource: true
        },
        priority: 1,
        healthScore: 85
      },
      {
        id: 'db-replica-us-west-1',
        region: 'us-west-1',
        endpoint: 'postgres://replica.us-west-1.nextportal.com:5432',
        type: 'read_replica',
        status: 'online',
        replicationLag: 250,
        lastSync: new Date(Date.now() - 250),
        connections: { active: 30, max: 80, poolSize: 15 },
        metrics: {
          queryLatency: 95,
          throughput: 120,
          errorRate: 0.0008,
          cpuUsage: 45,
          memoryUsage: 60,
          diskUsage: 50,
          networkIO: 180
        },
        capabilities: {
          readQueries: true,
          writeQueries: false,
          analyticsQueries: true,
          backupSource: false
        },
        priority: 2,
        healthScore: 92
      },
      {
        id: 'db-replica-eu-west-1',
        region: 'eu-west-1',
        endpoint: 'postgres://replica.eu-west-1.nextportal.com:5432',
        type: 'read_replica',
        status: 'online',
        replicationLag: 180,
        lastSync: new Date(Date.now() - 180),
        connections: { active: 25, max: 80, poolSize: 15 },
        metrics: {
          queryLatency: 85,
          throughput: 100,
          errorRate: 0.0005,
          cpuUsage: 40,
          memoryUsage: 55,
          diskUsage: 48,
          networkIO: 160
        },
        capabilities: {
          readQueries: true,
          writeQueries: false,
          analyticsQueries: true,
          backupSource: false
        },
        priority: 3,
        healthScore: 95
      },
      {
        id: 'db-standby-us-east-2',
        region: 'us-east-2',
        endpoint: 'postgres://standby.us-east-2.nextportal.com:5432',
        type: 'standby',
        status: 'online',
        replicationLag: 50,
        lastSync: new Date(Date.now() - 50),
        connections: { active: 5, max: 50, poolSize: 10 },
        metrics: {
          queryLatency: 110,
          throughput: 20,
          errorRate: 0.0002,
          cpuUsage: 25,
          memoryUsage: 40,
          diskUsage: 52,
          networkIO: 80
        },
        capabilities: {
          readQueries: true,
          writeQueries: false,
          analyticsQueries: false,
          backupSource: true
        },
        priority: 10,
        healthScore: 98
      }
    ];

    for (const replica of replicas) {
      this.replicas.set(replica.id, replica);
    }

    console.log(`Initialized ${this.replicas.size} database replicas`);
  }

  /**
   * Setup replication topology
   */
  private setupReplicationTopology(): void {
    const primary = Array.from(this.replicas.values()).find(r => r.type === 'primary');
    const readReplicas = Array.from(this.replicas.values()).filter(r => r.type === 'read_replica');
    const standbyNodes = Array.from(this.replicas.values()).filter(r => r.type === 'standby');

    this.topology = {
      primary: primary?.id || '',
      readReplicas: readReplicas.map(r => r.id),
      standbyNodes: standbyNodes.map(r => r.id),
      crossRegionLinks: [
        { source: 'us-east-1', target: 'us-west-1', latency: 80, bandwidth: 1000 },
        { source: 'us-east-1', target: 'eu-west-1', latency: 150, bandwidth: 500 },
        { source: 'us-east-1', target: 'us-east-2', latency: 20, bandwidth: 2000 }
      ]
    };
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    setInterval(() => {
      for (const replica of this.replicas.values()) {
        // Simulate health check
        if (replica.status === 'online') {
          replica.healthScore = this.calculateHealthScore(replica);
          
          // Simulate occasional issues
          if (Math.random() < 0.01) { // 1% chance of issues
            replica.status = 'failed';
            replica.healthScore = 0;
            console.warn(`Replica ${replica.id} failed health check`);
          }
        }
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Start replication monitoring
   */
  private startReplicationMonitoring(): void {
    this.replicationMonitor = setInterval(() => {
      const primary = this.replicas.get(this.topology.primary);
      if (!primary) return;

      for (const replicaId of [...this.topology.readReplicas, ...this.topology.standbyNodes]) {
        const replica = this.replicas.get(replicaId);
        if (!replica || replica.status !== 'online') continue;

        // Simulate replication lag changes
        const change = (Math.random() - 0.5) * 100;
        replica.replicationLag = Math.max(0, replica.replicationLag + change);
        replica.lastSync = new Date(Date.now() - replica.replicationLag);

        // Update metrics
        replica.metrics.queryLatency += (Math.random() - 0.5) * 10;
        replica.metrics.cpuUsage = Math.max(10, Math.min(90, 
          replica.metrics.cpuUsage + (Math.random() - 0.5) * 5
        ));
        replica.metrics.memoryUsage = Math.max(20, Math.min(85,
          replica.metrics.memoryUsage + (Math.random() - 0.5) * 3
        ));
      }
    }, 10000); // Every 10 seconds
  }

  /**
   * Initialize read-only query patterns
   */
  private initializeReadOnlyQueries(): void {
    const readOnlyPatterns = [
      'SELECT',
      'WITH',
      'EXPLAIN',
      'SHOW',
      'DESCRIBE'
    ];

    for (const pattern of readOnlyPatterns) {
      this.readOnlyQueries.add(pattern.toUpperCase());
    }
  }

  private generateEventId(): string {
    return `failover_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get system statistics
   */
  getStatistics(): {
    totalReplicas: number;
    onlineReplicas: number;
    primaryReplicas: number;
    readReplicas: number;
    standbyReplicas: number;
    avgReplicationLag: number;
    totalQueries: number;
    avgQueryTime: number;
    failoverEvents: number;
  } {
    const replicas = Array.from(this.replicas.values());
    const onlineReplicas = replicas.filter(r => r.status === 'online');
    
    const avgReplicationLag = replicas.length > 0 ?
      replicas.reduce((sum, r) => sum + r.replicationLag, 0) / replicas.length : 0;

    const analytics = this.getDatabaseAnalytics();

    return {
      totalReplicas: replicas.length,
      onlineReplicas: onlineReplicas.length,
      primaryReplicas: replicas.filter(r => r.type === 'primary').length,
      readReplicas: replicas.filter(r => r.type === 'read_replica').length,
      standbyReplicas: replicas.filter(r => r.type === 'standby').length,
      avgReplicationLag,
      totalQueries: analytics.totalQueries,
      avgQueryTime: analytics.avgExecutionTime,
      failoverEvents: this.failoverHistory.length
    };
  }
}

// Global geo-distributed database manager instance
export const geoDistributedDB = new GeoDistributedDatabaseManager();

export default geoDistributedDB;