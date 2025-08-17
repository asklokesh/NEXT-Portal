/**
 * Enterprise Performance Guarantee System
 * Contractual performance guarantees with adaptive optimization and resource isolation
 */

import { EventEmitter } from 'events';

// Performance SLA definition
export interface PerformanceSLA {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  
  // SLA terms
  terms: {
    // Response time guarantees
    responseTime: {
      p50: number; // milliseconds
      p95: number; // milliseconds
      p99: number; // milliseconds
      p99_9: number; // milliseconds
    };
    
    // Throughput guarantees
    throughput: {
      requestsPerSecond: number;
      transactionsPerSecond: number;
      concurrentUsers: number;
    };
    
    // Availability guarantees
    availability: {
      uptime: number; // percentage (99.9, 99.95, 99.99, etc.)
      maxDowntime: number; // minutes per month
      maintenanceWindows: Array<{
        day: 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';
        startTime: string; // HH:MM format
        duration: number; // minutes
      }>;
    };
    
    // Resource guarantees
    resources: {
      cpu: {
        reserved: number; // vCPU cores
        burst: number; // max burst vCPU cores
        utilization: number; // max % utilization
      };
      memory: {
        reserved: number; // GB
        burst: number; // max burst GB
        utilization: number; // max % utilization
      };
      storage: {
        iops: number; // guaranteed IOPS
        throughput: number; // MB/s
        capacity: number; // GB
      };
      network: {
        bandwidth: number; // Mbps
        latency: number; // max milliseconds
        packetLoss: number; // max % loss
      };
    };
    
    // Scaling guarantees
    scaling: {
      autoScalingEnabled: boolean;
      scaleUpTime: number; // seconds to scale up
      scaleDownTime: number; // seconds to scale down
      minInstances: number;
      maxInstances: number;
      targetUtilization: number; // percentage
    };
  };
  
  // SLA violations and penalties
  violations: {
    responseTimeBreach: {
      threshold: number; // consecutive minutes
      penalty: 'credit' | 'discount' | 'refund';
      amount: number; // percentage or fixed amount
    };
    availabilityBreach: {
      threshold: number; // percentage points below SLA
      penalty: 'credit' | 'discount' | 'refund';
      amount: number;
    };
    throughputBreach: {
      threshold: number; // percentage below guaranteed throughput
      penalty: 'credit' | 'discount' | 'refund';
      amount: number;
    };
  };
  
  // Monitoring and measurement
  measurement: {
    measurementPeriod: number; // minutes (5, 15, 60)
    reportingPeriod: 'daily' | 'weekly' | 'monthly';
    excludeMaintenanceWindows: boolean;
    excludePlannedDowntime: boolean;
    monitoringLocations: string[];
  };
  
  // Contract details
  contract: {
    effectiveDate: Date;
    expirationDate: Date;
    reviewDate: Date;
    autoRenew: boolean;
    terminationNotice: number; // days
    escalationContacts: string[];
  };
  
  // Status
  status: 'active' | 'suspended' | 'expired' | 'terminated';
  createdAt: Date;
  updatedAt: Date;
}

// Performance metrics snapshot
export interface PerformanceSnapshot {
  timestamp: Date;
  tenantId: string;
  slaId: string;
  measurementPeriod: number; // minutes
  
  // Measured performance
  measured: {
    responseTime: {
      p50: number;
      p95: number;
      p99: number;
      p99_9: number;
      mean: number;
      min: number;
      max: number;
      samples: number;
    };
    
    throughput: {
      requestsPerSecond: number;
      transactionsPerSecond: number;
      concurrentUsers: number;
      peakConcurrentUsers: number;
    };
    
    availability: {
      uptime: number; // percentage for the period
      incidents: Array<{
        startTime: Date;
        endTime: Date;
        duration: number; // minutes
        cause: string;
        impact: 'partial' | 'full';
      }>;
    };
    
    resources: {
      cpu: {
        utilization: number; // average %
        peak: number; // peak %
        reserved: number; // allocated cores
      };
      memory: {
        utilization: number; // average %
        peak: number; // peak %
        reserved: number; // allocated GB
      };
      storage: {
        iops: number; // measured IOPS
        throughput: number; // measured MB/s
        utilization: number; // % of capacity used
      };
      network: {
        bandwidth: number; // measured Mbps
        latency: number; // average ms
        packetLoss: number; // % loss
      };
    };
    
    errors: {
      total: number;
      rate: number; // percentage
      byType: Record<string, number>;
      httpErrors: Record<string, number>;
    };
  };
  
  // SLA compliance status
  compliance: {
    responseTime: {
      p50: { met: boolean; actual: number; target: number; deviation: number };
      p95: { met: boolean; actual: number; target: number; deviation: number };
      p99: { met: boolean; actual: number; target: number; deviation: number };
      p99_9: { met: boolean; actual: number; target: number; deviation: number };
    };
    
    throughput: {
      requestsPerSecond: { met: boolean; actual: number; target: number; deviation: number };
      transactionsPerSecond: { met: boolean; actual: number; target: number; deviation: number };
      concurrentUsers: { met: boolean; actual: number; target: number; deviation: number };
    };
    
    availability: {
      uptime: { met: boolean; actual: number; target: number; deviation: number };
      incidents: number;
    };
    
    resources: {
      cpu: { met: boolean; actual: number; target: number; withinReservation: boolean };
      memory: { met: boolean; actual: number; target: number; withinReservation: boolean };
      storage: { met: boolean; iops: number; throughput: number };
      network: { met: boolean; bandwidth: number; latency: number; packetLoss: number };
    };
    
    overallCompliance: number; // 0-100 percentage
    breaches: Array<{
      metric: string;
      severity: 'warning' | 'breach' | 'critical';
      duration: number; // minutes
      impact: number; // 0-100 severity score
    }>;
  };
}

// Performance optimization action
export interface PerformanceOptimization {
  id: string;
  tenantId: string;
  slaId: string;
  
  // Optimization details
  type: 'scaling' | 'caching' | 'database' | 'network' | 'code' | 'infrastructure';
  priority: 'low' | 'medium' | 'high' | 'critical';
  
  // Problem identification
  problem: {
    metric: string;
    threshold: number;
    actual: number;
    trend: 'improving' | 'stable' | 'degrading';
    confidence: number; // 0-1
  };
  
  // Optimization action
  action: {
    description: string;
    automated: boolean;
    estimatedImpact: {
      responseTimeImprovement: number; // percentage
      throughputIncrease: number; // percentage
      resourceReduction: number; // percentage
      cost: number; // monthly cost impact
    };
    implementation: {
      script?: string;
      parameters: Record<string, any>;
      rollbackPlan: string;
      testingRequired: boolean;
      approvalRequired: boolean;
    };
  };
  
  // Execution status
  execution: {
    status: 'pending' | 'approved' | 'executing' | 'completed' | 'failed' | 'rolled-back';
    startTime?: Date;
    endTime?: Date;
    executedBy?: string;
    approvedBy?: string;
    logs: Array<{
      timestamp: Date;
      level: 'info' | 'warn' | 'error';
      message: string;
    }>;
  };
  
  // Results
  results?: {
    beforeMetrics: PerformanceSnapshot;
    afterMetrics: PerformanceSnapshot;
    actualImpact: {
      responseTimeImprovement: number;
      throughputIncrease: number;
      resourceReduction: number;
      costImpact: number;
    };
    success: boolean;
    summary: string;
  };
  
  createdAt: Date;
  updatedAt: Date;
}

// Resource reservation
export interface ResourceReservation {
  id: string;
  tenantId: string;
  slaId: string;
  
  // Resource allocation
  resources: {
    cpu: {
      reserved: number; // cores
      burstable: number; // additional cores
      priority: 'guaranteed' | 'burstable' | 'best-effort';
    };
    memory: {
      reserved: number; // GB
      burstable: number; // additional GB
      priority: 'guaranteed' | 'burstable' | 'best-effort';
    };
    storage: {
      size: number; // GB
      type: 'ssd' | 'nvme' | 'hdd';
      iops: number;
      throughput: number; // MB/s
    };
    network: {
      bandwidth: number; // Mbps
      priority: 'guaranteed' | 'standard';
      dedicatedConnection: boolean;
    };
  };
  
  // Placement constraints
  placement: {
    region?: string;
    availabilityZone?: string;
    nodeSelector?: Record<string, string>;
    antiAffinity?: string[]; // avoid co-location with these tenants
    affinity?: string[]; // prefer co-location with these services
  };
  
  // Reservation status
  status: 'pending' | 'allocated' | 'active' | 'released';
  allocatedAt?: Date;
  releasedAt?: Date;
  
  // Usage tracking
  usage: {
    cpu: {
      average: number;
      peak: number;
      efficiency: number; // usage / reserved
    };
    memory: {
      average: number;
      peak: number;
      efficiency: number;
    };
    storage: {
      used: number;
      efficiency: number;
    };
    network: {
      average: number;
      peak: number;
      efficiency: number;
    };
  };
  
  createdAt: Date;
  updatedAt: Date;
}

// Load testing configuration
export interface LoadTestConfiguration {
  id: string;
  tenantId: string;
  slaId: string;
  name: string;
  
  // Test configuration
  configuration: {
    testType: 'load' | 'stress' | 'spike' | 'volume' | 'endurance';
    duration: number; // minutes
    
    // Load profile
    load: {
      users: {
        min: number;
        max: number;
        rampUpTime: number; // minutes
        rampDownTime: number; // minutes
      };
      requests: {
        rps: number; // requests per second
        distribution: 'constant' | 'linear' | 'exponential' | 'custom';
      };
      patterns: Array<{
        operation: string;
        weight: number; // percentage
        parameters: Record<string, any>;
      }>;
    };
    
    // Performance targets
    targets: {
      responseTime: {
        p95: number;
        p99: number;
      };
      throughput: {
        minRps: number;
      };
      errorRate: {
        maxPercentage: number;
      };
      resources: {
        maxCpuUtilization: number;
        maxMemoryUtilization: number;
      };
    };
    
    // Test environment
    environment: {
      region: string;
      endpoints: string[];
      dataSize: number; // MB of test data
      cleanup: boolean;
    };
  };
  
  // Scheduling
  schedule: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string; // HH:MM format
    timezone: string;
  };
  
  // Results
  lastRun?: {
    timestamp: Date;
    status: 'passed' | 'failed' | 'error';
    duration: number; // actual minutes
    summary: {
      totalRequests: number;
      successfulRequests: number;
      failedRequests: number;
      averageResponseTime: number;
      p95ResponseTime: number;
      p99ResponseTime: number;
      maxConcurrentUsers: number;
      throughput: number;
      errorRate: number;
    };
    slaCompliance: {
      responseTime: boolean;
      throughput: boolean;
      errorRate: boolean;
      resources: boolean;
      overall: boolean;
    };
    recommendations: string[];
  };
  
  createdAt: Date;
  updatedAt: Date;
}

// Performance guarantee configuration
export interface PerformanceGuaranteeConfig {
  // Global settings
  global: {
    defaultMeasurementPeriod: number; // minutes
    defaultReportingPeriod: 'daily' | 'weekly' | 'monthly';
    autoOptimizationEnabled: boolean;
    loadTestingEnabled: boolean;
    resourceReservationEnabled: boolean;
  };
  
  // Optimization settings
  optimization: {
    algorithms: Array<'predictive-scaling' | 'cache-optimization' | 'database-tuning' | 'network-optimization'>;
    aggressiveness: 'conservative' | 'moderate' | 'aggressive';
    approvalRequired: boolean;
    rollbackThreshold: number; // performance degradation % to trigger rollback
    cooldownPeriod: number; // minutes between optimizations
  };
  
  // Resource management
  resources: {
    overcommitRatio: number; // allow overcommit of resources
    burstAllowance: number; // % additional resources for bursting
    isolationLevel: 'none' | 'soft' | 'hard';
    priorityClasses: string[];
  };
  
  // Load testing
  loadTesting: {
    defaultTestDuration: number; // minutes
    maxConcurrentTests: number;
    resourceLimits: {
      maxLoadGenerators: number;
      maxTestDuration: number; // minutes
    };
  };
  
  // Alerting and notifications
  alerting: {
    slaBreachNotifications: boolean;
    performanceDegradationThreshold: number; // % degradation to alert
    channels: Array<{
      type: 'email' | 'slack' | 'webhook' | 'pagerduty';
      config: Record<string, any>;
    }>;
    escalationRules: Array<{
      condition: string;
      delay: number; // minutes
      recipients: string[];
    }>;
  };
}

// Main enterprise performance guarantee system
export class EnterprisePerformanceGuaranteeSystem extends EventEmitter {
  private slas: Map<string, PerformanceSLA> = new Map();
  private snapshots: Map<string, PerformanceSnapshot[]> = new Map();
  private optimizations: Map<string, PerformanceOptimization> = new Map();
  private reservations: Map<string, ResourceReservation> = new Map();
  private loadTests: Map<string, LoadTestConfiguration> = new Map();
  
  private config: PerformanceGuaranteeConfig;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private optimizationInterval: NodeJS.Timeout | null = null;
  private loadTestInterval: NodeJS.Timeout | null = null;

  constructor(config: PerformanceGuaranteeConfig) {
    super();
    this.config = config;
    this.initializePerformanceGuarantees();
  }

  /**
   * Initialize performance guarantee system
   */
  private initializePerformanceGuarantees(): void {
    console.log('Initializing Enterprise Performance Guarantee System...');
    
    this.startPerformanceMonitoring();
    
    if (this.config.global.autoOptimizationEnabled) {
      this.startPerformanceOptimization();
    }
    
    if (this.config.global.loadTestingEnabled) {
      this.startLoadTesting();
    }
    
    console.log('Performance guarantee system initialized');
    this.emit('performance-guarantees:initialized');
  }

  /**
   * Create a new performance SLA
   */
  async createPerformanceSLA(
    tenantId: string,
    slaDefinition: Omit<PerformanceSLA, 'id' | 'status' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    const slaId = `sla_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const sla: PerformanceSLA = {
      ...slaDefinition,
      id: slaId,
      tenantId,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Validate SLA terms
    await this.validateSLATerms(sla);
    
    // Create resource reservation
    if (this.config.resources.isolationLevel !== 'none') {
      await this.createResourceReservation(sla);
    }
    
    // Initialize performance monitoring
    this.slas.set(slaId, sla);
    this.snapshots.set(slaId, []);
    
    this.emit('sla:created', { slaId, tenantId });
    
    // Start baseline performance measurement
    await this.startBaselineMeasurement(slaId);
    
    return slaId;
  }

  /**
   * Record performance metrics
   */
  async recordPerformanceMetrics(
    tenantId: string,
    slaId: string,
    metrics: {
      responseTime: { samples: number[]; };
      throughput: { requestsPerSecond: number; transactionsPerSecond: number; concurrentUsers: number; };
      availability: { uptime: number; incidents?: PerformanceSnapshot['measured']['availability']['incidents']; };
      resources: PerformanceSnapshot['measured']['resources'];
      errors: { total: number; byType: Record<string, number>; httpErrors: Record<string, number>; };
    }
  ): Promise<void> {
    const sla = this.slas.get(slaId);
    if (!sla || sla.tenantId !== tenantId) {
      throw new Error(`SLA not found: ${slaId}`);
    }
    
    // Calculate response time percentiles
    const sortedTimes = [...metrics.responseTime.samples].sort((a, b) => a - b);
    const responseTime = {
      p50: this.calculatePercentile(sortedTimes, 50),
      p95: this.calculatePercentile(sortedTimes, 95),
      p99: this.calculatePercentile(sortedTimes, 99),
      p99_9: this.calculatePercentile(sortedTimes, 99.9),
      mean: sortedTimes.reduce((sum, val) => sum + val, 0) / sortedTimes.length,
      min: sortedTimes[0] || 0,
      max: sortedTimes[sortedTimes.length - 1] || 0,
      samples: sortedTimes.length
    };
    
    // Create performance snapshot
    const snapshot: PerformanceSnapshot = {
      timestamp: new Date(),
      tenantId,
      slaId,
      measurementPeriod: sla.measurement.measurementPeriod,
      measured: {
        responseTime,
        throughput: {
          ...metrics.throughput,
          peakConcurrentUsers: Math.max(metrics.throughput.concurrentUsers, 0)
        },
        availability: metrics.availability,
        resources: metrics.resources,
        errors: {
          ...metrics.errors,
          rate: metrics.errors.total > 0 ? (metrics.errors.total / responseTime.samples) * 100 : 0
        }
      },
      compliance: await this.calculateSLACompliance(sla, responseTime, metrics)
    };
    
    // Store snapshot
    const slaSnapshots = this.snapshots.get(slaId) || [];
    slaSnapshots.push(snapshot);
    
    // Retain only necessary snapshots based on reporting period
    const retentionPeriod = this.getRetentionPeriod(sla.measurement.reportingPeriod);
    const cutoffDate = new Date(Date.now() - retentionPeriod);
    const filteredSnapshots = slaSnapshots.filter(s => s.timestamp > cutoffDate);
    
    this.snapshots.set(slaId, filteredSnapshots);
    
    // Check for SLA breaches
    await this.checkSLABreaches(sla, snapshot);
    
    // Trigger performance optimizations if needed
    if (this.config.global.autoOptimizationEnabled) {
      await this.evaluateOptimizationOpportunities(sla, snapshot);
    }
    
    this.emit('performance:recorded', { tenantId, slaId, compliance: snapshot.compliance.overallCompliance });
  }

  /**
   * Create resource reservation for SLA
   */
  private async createResourceReservation(sla: PerformanceSLA): Promise<string> {
    const reservationId = `reservation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const reservation: ResourceReservation = {
      id: reservationId,
      tenantId: sla.tenantId,
      slaId: sla.id,
      resources: {
        cpu: {
          reserved: sla.terms.resources.cpu.reserved,
          burstable: sla.terms.resources.cpu.burst - sla.terms.resources.cpu.reserved,
          priority: this.config.resources.isolationLevel === 'hard' ? 'guaranteed' : 'burstable'
        },
        memory: {
          reserved: sla.terms.resources.memory.reserved,
          burstable: sla.terms.resources.memory.burst - sla.terms.resources.memory.reserved,
          priority: this.config.resources.isolationLevel === 'hard' ? 'guaranteed' : 'burstable'
        },
        storage: {
          size: sla.terms.resources.storage.capacity,
          type: 'ssd',
          iops: sla.terms.resources.storage.iops,
          throughput: sla.terms.resources.storage.throughput
        },
        network: {
          bandwidth: sla.terms.resources.network.bandwidth,
          priority: 'guaranteed',
          dedicatedConnection: sla.terms.resources.network.bandwidth > 1000 // Dedicated for high bandwidth
        }
      },
      placement: {
        // Would be determined based on tenant requirements and resource availability
      },
      status: 'pending',
      usage: {
        cpu: { average: 0, peak: 0, efficiency: 0 },
        memory: { average: 0, peak: 0, efficiency: 0 },
        storage: { used: 0, efficiency: 0 },
        network: { average: 0, peak: 0, efficiency: 0 }
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Allocate resources
    try {
      await this.allocateResources(reservation);
      reservation.status = 'allocated';
      reservation.allocatedAt = new Date();
    } catch (error) {
      console.error(`Failed to allocate resources for reservation ${reservationId}:`, error);
      reservation.status = 'pending';
    }
    
    this.reservations.set(reservationId, reservation);
    
    this.emit('reservation:created', {
      reservationId,
      tenantId: sla.tenantId,
      slaId: sla.id,
      status: reservation.status
    });
    
    return reservationId;
  }

  /**
   * Run performance optimization
   */
  private async runPerformanceOptimization(): Promise<void> {
    console.log('Running performance optimization cycle...');
    
    for (const [slaId, sla] of this.slas.entries()) {
      if (sla.status !== 'active') continue;
      
      const recentSnapshots = this.getRecentSnapshots(slaId, 5); // Last 5 measurements
      if (recentSnapshots.length < 3) continue; // Need enough data
      
      // Identify optimization opportunities
      const opportunities = await this.identifyOptimizationOpportunities(sla, recentSnapshots);
      
      for (const opportunity of opportunities) {
        if (await this.shouldExecuteOptimization(opportunity)) {
          await this.executeOptimization(opportunity);
        }
      }
    }
  }

  /**
   * Identify optimization opportunities
   */
  private async identifyOptimizationOpportunities(
    sla: PerformanceSLA,
    snapshots: PerformanceSnapshot[]
  ): Promise<PerformanceOptimization[]> {
    const opportunities: PerformanceOptimization[] = [];
    
    const latest = snapshots[snapshots.length - 1];
    const trend = this.calculatePerformanceTrend(snapshots);
    
    // Response time optimization
    if (!latest.compliance.responseTime.p95.met || trend.responseTime === 'degrading') {
      opportunities.push(await this.createResponseTimeOptimization(sla, latest, trend));
    }
    
    // Throughput optimization
    if (!latest.compliance.throughput.requestsPerSecond.met || trend.throughput === 'degrading') {
      opportunities.push(await this.createThroughputOptimization(sla, latest, trend));
    }
    
    // Resource optimization
    if (latest.measured.resources.cpu.utilization > 80 || latest.measured.resources.memory.utilization > 85) {
      opportunities.push(await this.createResourceOptimization(sla, latest, trend));
    }
    
    // Cache optimization
    const cacheHitRate = this.calculateCacheHitRate(snapshots);
    if (cacheHitRate < 0.8) { // Less than 80% hit rate
      opportunities.push(await this.createCacheOptimization(sla, latest, cacheHitRate));
    }
    
    // Database optimization
    const dbPerformance = this.analyzeDatabasePerformance(snapshots);
    if (dbPerformance.needsOptimization) {
      opportunities.push(await this.createDatabaseOptimization(sla, latest, dbPerformance));
    }
    
    return opportunities.filter(op => op !== null);
  }

  /**
   * Create response time optimization
   */
  private async createResponseTimeOptimization(
    sla: PerformanceSLA,
    snapshot: PerformanceSnapshot,
    trend: any
  ): Promise<PerformanceOptimization> {
    const optimizationId = `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      id: optimizationId,
      tenantId: sla.tenantId,
      slaId: sla.id,
      type: 'scaling',
      priority: snapshot.compliance.responseTime.p95.actual > sla.terms.responseTime.p95 * 1.5 ? 'critical' : 'high',
      problem: {
        metric: 'response-time-p95',
        threshold: sla.terms.responseTime.p95,
        actual: snapshot.compliance.responseTime.p95.actual,
        trend: trend.responseTime,
        confidence: 0.9
      },
      action: {
        description: 'Scale out application instances to improve response time',
        automated: true,
        estimatedImpact: {
          responseTimeImprovement: 30,
          throughputIncrease: 25,
          resourceReduction: -20, // Will use more resources
          cost: 150 // Additional monthly cost
        },
        implementation: {
          script: 'scale-out-instances.sh',
          parameters: {
            targetInstances: Math.ceil(snapshot.measured.resources.cpu.utilization / 70), // Target 70% CPU
            scaleUpStep: 2,
            cooldownPeriod: 5
          },
          rollbackPlan: 'Scale back to previous instance count if performance degrades',
          testingRequired: false,
          approvalRequired: this.config.optimization.approvalRequired
        }
      },
      execution: {
        status: 'pending',
        logs: []
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Execute performance optimization
   */
  private async executeOptimization(optimization: PerformanceOptimization): Promise<void> {
    console.log(`Executing optimization: ${optimization.id} (${optimization.type})`);
    
    optimization.execution.status = 'executing';
    optimization.execution.startTime = new Date();
    optimization.execution.logs.push({
      timestamp: new Date(),
      level: 'info',
      message: `Starting ${optimization.type} optimization`
    });
    
    try {
      // Take before metrics
      const beforeMetrics = await this.getLatestSnapshot(optimization.slaId);
      
      // Execute the optimization
      if (optimization.action.automated) {
        await this.executeAutomatedOptimization(optimization);
      } else {
        await this.scheduleManualOptimization(optimization);
        return; // Manual optimizations are handled separately
      }
      
      // Wait for stabilization
      await new Promise(resolve => setTimeout(resolve, this.config.optimization.cooldownPeriod * 60 * 1000));
      
      // Take after metrics
      const afterMetrics = await this.getLatestSnapshot(optimization.slaId);
      
      // Calculate actual impact
      const actualImpact = this.calculateOptimizationImpact(beforeMetrics!, afterMetrics!);
      
      // Determine success
      const success = this.evaluateOptimizationSuccess(optimization, actualImpact);
      
      // Update optimization record
      optimization.execution.status = success ? 'completed' : 'failed';
      optimization.execution.endTime = new Date();
      optimization.results = {
        beforeMetrics: beforeMetrics!,
        afterMetrics: afterMetrics!,
        actualImpact,
        success,
        summary: this.generateOptimizationSummary(optimization, actualImpact, success)
      };
      
      optimization.execution.logs.push({
        timestamp: new Date(),
        level: success ? 'info' : 'error',
        message: success ? 'Optimization completed successfully' : 'Optimization failed to meet targets'
      });
      
      this.optimizations.set(optimization.id, optimization);
      
      // Rollback if optimization failed
      if (!success && this.shouldRollbackOptimization(actualImpact)) {
        await this.rollbackOptimization(optimization);
      }
      
      this.emit('optimization:completed', {
        optimizationId: optimization.id,
        success,
        impact: actualImpact
      });
      
    } catch (error) {
      console.error(`Optimization ${optimization.id} failed:`, error);
      
      optimization.execution.status = 'failed';
      optimization.execution.endTime = new Date();
      optimization.execution.logs.push({
        timestamp: new Date(),
        level: 'error',
        message: `Optimization failed: ${error.message}`
      });
      
      this.optimizations.set(optimization.id, optimization);
      
      this.emit('optimization:failed', {
        optimizationId: optimization.id,
        error: error.message
      });
    }
  }

  /**
   * Create and run load test
   */
  async createLoadTest(
    tenantId: string,
    slaId: string,
    testConfig: Omit<LoadTestConfiguration, 'id' | 'tenantId' | 'slaId' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    const testId = `loadtest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const loadTest: LoadTestConfiguration = {
      ...testConfig,
      id: testId,
      tenantId,
      slaId,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.loadTests.set(testId, loadTest);
    
    this.emit('load-test:created', { testId, tenantId, slaId });
    
    // Run test immediately if not scheduled
    if (!loadTest.schedule.enabled) {
      await this.runLoadTest(testId);
    }
    
    return testId;
  }

  /**
   * Run load test
   */
  private async runLoadTest(testId: string): Promise<void> {
    const loadTest = this.loadTests.get(testId);
    if (!loadTest) return;
    
    console.log(`Running load test: ${loadTest.name} (${testId})`);
    
    try {
      const startTime = Date.now();
      
      // Execute load test (mock implementation)
      const results = await this.executeLoadTest(loadTest);
      
      const duration = (Date.now() - startTime) / (1000 * 60); // minutes
      
      // Check SLA compliance
      const sla = this.slas.get(loadTest.slaId);
      const slaCompliance = sla ? await this.checkLoadTestSLACompliance(results, sla) : {
        responseTime: false,
        throughput: false,
        errorRate: false,
        resources: false,
        overall: false
      };
      
      // Generate recommendations
      const recommendations = this.generateLoadTestRecommendations(results, slaCompliance, sla);
      
      // Update load test with results
      loadTest.lastRun = {
        timestamp: new Date(),
        status: slaCompliance.overall ? 'passed' : 'failed',
        duration,
        summary: results,
        slaCompliance,
        recommendations
      };
      
      loadTest.updatedAt = new Date();
      this.loadTests.set(testId, loadTest);
      
      this.emit('load-test:completed', {
        testId,
        status: loadTest.lastRun.status,
        slaCompliance: slaCompliance.overall
      });
      
    } catch (error) {
      console.error(`Load test ${testId} failed:`, error);
      
      loadTest.lastRun = {
        timestamp: new Date(),
        status: 'error',
        duration: 0,
        summary: {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          averageResponseTime: 0,
          p95ResponseTime: 0,
          p99ResponseTime: 0,
          maxConcurrentUsers: 0,
          throughput: 0,
          errorRate: 100
        },
        slaCompliance: {
          responseTime: false,
          throughput: false,
          errorRate: false,
          resources: false,
          overall: false
        },
        recommendations: ['Fix test configuration or infrastructure issues']
      };
      
      this.loadTests.set(testId, loadTest);
      
      this.emit('load-test:failed', { testId, error: error.message });
    }
  }

  /**
   * Get performance dashboard data
   */
  getPerformanceDashboard(tenantId?: string): {
    overview: {
      totalSLAs: number;
      activeSLAs: number;
      overallCompliance: number;
      criticalBreaches: number;
      activeOptimizations: number;
    };
    slaCompliance: Array<{
      slaId: string;
      slaName: string;
      compliance: number;
      status: 'meeting' | 'at-risk' | 'breaching';
      lastMeasured: Date;
    }>;
    recentOptimizations: PerformanceOptimization[];
    resourceUtilization: Record<string, {
      cpu: number;
      memory: number;
      storage: number;
      network: number;
    }>;
    loadTestResults: Array<{
      testId: string;
      testName: string;
      lastRun: Date;
      status: 'passed' | 'failed' | 'error';
      compliance: boolean;
    }>;
  } {
    const slas = Array.from(this.slas.values())
      .filter(sla => !tenantId || sla.tenantId === tenantId);
    
    const activeSLAs = slas.filter(sla => sla.status === 'active');
    
    // Calculate overall compliance
    let totalCompliance = 0;
    let criticalBreaches = 0;
    const slaCompliance = [];
    
    for (const sla of activeSLAs) {
      const snapshots = this.snapshots.get(sla.id) || [];
      const latest = snapshots[snapshots.length - 1];
      
      if (latest) {
        totalCompliance += latest.compliance.overallCompliance;
        
        const status = latest.compliance.overallCompliance >= 95 ? 'meeting' :
                      latest.compliance.overallCompliance >= 85 ? 'at-risk' : 'breaching';
        
        if (status === 'breaching') criticalBreaches++;
        
        slaCompliance.push({
          slaId: sla.id,
          slaName: sla.name,
          compliance: latest.compliance.overallCompliance,
          status,
          lastMeasured: latest.timestamp
        });
      }
    }
    
    const overallCompliance = activeSLAs.length > 0 ? totalCompliance / activeSLAs.length : 100;
    
    // Get active optimizations
    const activeOptimizations = Array.from(this.optimizations.values())
      .filter(opt => ['pending', 'approved', 'executing'].includes(opt.execution.status))
      .filter(opt => !tenantId || opt.tenantId === tenantId);
    
    // Get recent optimizations
    const recentOptimizations = Array.from(this.optimizations.values())
      .filter(opt => opt.createdAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) // Last 7 days
      .filter(opt => !tenantId || opt.tenantId === tenantId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10);
    
    // Calculate resource utilization
    const resourceUtilization: Record<string, any> = {};
    for (const reservation of this.reservations.values()) {
      if (tenantId && reservation.tenantId !== tenantId) continue;
      
      resourceUtilization[reservation.tenantId] = {
        cpu: reservation.usage.cpu.average,
        memory: reservation.usage.memory.average,
        storage: reservation.usage.storage.efficiency * 100,
        network: reservation.usage.network.average
      };
    }
    
    // Get load test results
    const loadTestResults = Array.from(this.loadTests.values())
      .filter(test => !tenantId || test.tenantId === tenantId)
      .filter(test => test.lastRun)
      .map(test => ({
        testId: test.id,
        testName: test.name,
        lastRun: test.lastRun!.timestamp,
        status: test.lastRun!.status,
        compliance: test.lastRun!.slaCompliance.overall
      }))
      .sort((a, b) => b.lastRun.getTime() - a.lastRun.getTime())
      .slice(0, 5);
    
    return {
      overview: {
        totalSLAs: slas.length,
        activeSLAs: activeSLAs.length,
        overallCompliance,
        criticalBreaches,
        activeOptimizations: activeOptimizations.length
      },
      slaCompliance,
      recentOptimizations,
      resourceUtilization,
      loadTestResults
    };
  }

  // Private helper methods

  private async validateSLATerms(sla: PerformanceSLA): Promise<void> {
    // Validate that SLA terms are realistic and achievable
    if (sla.terms.responseTime.p99_9 < sla.terms.responseTime.p99) {
      throw new Error('P99.9 response time cannot be less than P99');
    }
    
    if (sla.terms.availability.uptime > 99.99) {
      console.warn('SLA uptime target above 99.99% requires significant infrastructure investment');
    }
    
    // Validate resource requirements
    if (sla.terms.resources.cpu.reserved <= 0) {
      throw new Error('CPU reservation must be greater than 0');
    }
    
    if (sla.terms.resources.memory.reserved <= 0) {
      throw new Error('Memory reservation must be greater than 0');
    }
  }

  private async startBaselineMeasurement(slaId: string): Promise<void> {
    // Start collecting baseline performance metrics for the SLA
    console.log(`Starting baseline measurement for SLA: ${slaId}`);
  }

  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedArray[lower];
    }
    
    const weight = index - lower;
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  private async calculateSLACompliance(
    sla: PerformanceSLA,
    responseTime: PerformanceSnapshot['measured']['responseTime'],
    metrics: any
  ): Promise<PerformanceSnapshot['compliance']> {
    const compliance: PerformanceSnapshot['compliance'] = {
      responseTime: {
        p50: {
          met: responseTime.p50 <= sla.terms.responseTime.p50,
          actual: responseTime.p50,
          target: sla.terms.responseTime.p50,
          deviation: ((responseTime.p50 - sla.terms.responseTime.p50) / sla.terms.responseTime.p50) * 100
        },
        p95: {
          met: responseTime.p95 <= sla.terms.responseTime.p95,
          actual: responseTime.p95,
          target: sla.terms.responseTime.p95,
          deviation: ((responseTime.p95 - sla.terms.responseTime.p95) / sla.terms.responseTime.p95) * 100
        },
        p99: {
          met: responseTime.p99 <= sla.terms.responseTime.p99,
          actual: responseTime.p99,
          target: sla.terms.responseTime.p99,
          deviation: ((responseTime.p99 - sla.terms.responseTime.p99) / sla.terms.responseTime.p99) * 100
        },
        p99_9: {
          met: responseTime.p99_9 <= sla.terms.responseTime.p99_9,
          actual: responseTime.p99_9,
          target: sla.terms.responseTime.p99_9,
          deviation: ((responseTime.p99_9 - sla.terms.responseTime.p99_9) / sla.terms.responseTime.p99_9) * 100
        }
      },
      throughput: {
        requestsPerSecond: {
          met: metrics.throughput.requestsPerSecond >= sla.terms.throughput.requestsPerSecond,
          actual: metrics.throughput.requestsPerSecond,
          target: sla.terms.throughput.requestsPerSecond,
          deviation: ((sla.terms.throughput.requestsPerSecond - metrics.throughput.requestsPerSecond) / sla.terms.throughput.requestsPerSecond) * 100
        },
        transactionsPerSecond: {
          met: metrics.throughput.transactionsPerSecond >= sla.terms.throughput.transactionsPerSecond,
          actual: metrics.throughput.transactionsPerSecond,
          target: sla.terms.throughput.transactionsPerSecond,
          deviation: ((sla.terms.throughput.transactionsPerSecond - metrics.throughput.transactionsPerSecond) / sla.terms.throughput.transactionsPerSecond) * 100
        },
        concurrentUsers: {
          met: metrics.throughput.concurrentUsers >= sla.terms.throughput.concurrentUsers,
          actual: metrics.throughput.concurrentUsers,
          target: sla.terms.throughput.concurrentUsers,
          deviation: ((sla.terms.throughput.concurrentUsers - metrics.throughput.concurrentUsers) / sla.terms.throughput.concurrentUsers) * 100
        }
      },
      availability: {
        uptime: {
          met: metrics.availability.uptime >= sla.terms.availability.uptime,
          actual: metrics.availability.uptime,
          target: sla.terms.availability.uptime,
          deviation: sla.terms.availability.uptime - metrics.availability.uptime
        },
        incidents: metrics.availability.incidents?.length || 0
      },
      resources: {
        cpu: {
          met: metrics.resources.cpu.utilization <= sla.terms.resources.cpu.utilization,
          actual: metrics.resources.cpu.utilization,
          target: sla.terms.resources.cpu.utilization,
          withinReservation: metrics.resources.cpu.reserved <= sla.terms.resources.cpu.reserved
        },
        memory: {
          met: metrics.resources.memory.utilization <= sla.terms.resources.memory.utilization,
          actual: metrics.resources.memory.utilization,
          target: sla.terms.resources.memory.utilization,
          withinReservation: metrics.resources.memory.reserved <= sla.terms.resources.memory.reserved
        },
        storage: {
          met: true, // Mock implementation
          iops: metrics.resources.storage.iops,
          throughput: metrics.resources.storage.throughput
        },
        network: {
          met: metrics.resources.network.bandwidth <= sla.terms.resources.network.bandwidth,
          bandwidth: metrics.resources.network.bandwidth,
          latency: metrics.resources.network.latency,
          packetLoss: metrics.resources.network.packetLoss
        }
      },
      overallCompliance: 0,
      breaches: []
    };
    
    // Calculate overall compliance score
    const metrics_count = 11; // Total number of metrics we check
    let met_count = 0;
    
    met_count += Object.values(compliance.responseTime).filter(m => m.met).length;
    met_count += Object.values(compliance.throughput).filter(m => m.met).length;
    met_count += compliance.availability.uptime.met ? 1 : 0;
    met_count += Object.values(compliance.resources).filter(m => m.met).length;
    
    compliance.overallCompliance = (met_count / metrics_count) * 100;
    
    // Identify breaches
    const breaches = [];
    
    for (const [metric, result] of Object.entries(compliance.responseTime)) {
      if (!result.met) {
        breaches.push({
          metric: `response-time-${metric}`,
          severity: result.deviation > 50 ? 'critical' : result.deviation > 25 ? 'breach' : 'warning',
          duration: 1, // Mock duration
          impact: Math.min(result.deviation, 100)
        });
      }
    }
    
    for (const [metric, result] of Object.entries(compliance.throughput)) {
      if (!result.met) {
        breaches.push({
          metric: `throughput-${metric}`,
          severity: result.deviation > 50 ? 'critical' : result.deviation > 25 ? 'breach' : 'warning',
          duration: 1,
          impact: Math.min(result.deviation, 100)
        });
      }
    }
    
    compliance.breaches = breaches;
    
    return compliance;
  }

  private async checkSLABreaches(sla: PerformanceSLA, snapshot: PerformanceSnapshot): Promise<void> {
    const breaches = snapshot.compliance.breaches.filter(b => b.severity === 'critical' || b.severity === 'breach');
    
    if (breaches.length > 0) {
      this.emit('sla:breach', {
        slaId: sla.id,
        tenantId: sla.tenantId,
        breaches,
        snapshot
      });
      
      // Trigger alerts
      if (this.config.alerting.slaBreachNotifications) {
        await this.triggerSLABreachAlert(sla, breaches, snapshot);
      }
    }
  }

  private async evaluateOptimizationOpportunities(sla: PerformanceSLA, snapshot: PerformanceSnapshot): Promise<void> {
    if (snapshot.compliance.overallCompliance < 90) { // Below 90% compliance
      const opportunities = await this.identifyOptimizationOpportunities(sla, [snapshot]);
      
      for (const opportunity of opportunities) {
        if (await this.shouldExecuteOptimization(opportunity)) {
          this.optimizations.set(opportunity.id, opportunity);
          this.emit('optimization:identified', { optimizationId: opportunity.id, type: opportunity.type });
        }
      }
    }
  }

  private getRetentionPeriod(reportingPeriod: string): number {
    switch (reportingPeriod) {
      case 'daily': return 7 * 24 * 60 * 60 * 1000; // 7 days
      case 'weekly': return 30 * 24 * 60 * 60 * 1000; // 30 days
      case 'monthly': return 365 * 24 * 60 * 60 * 1000; // 1 year
      default: return 30 * 24 * 60 * 60 * 1000;
    }
  }

  private startPerformanceMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      // This would collect metrics from actual monitoring systems
      console.log('Collecting performance metrics...');
    }, this.config.global.defaultMeasurementPeriod * 60 * 1000);
  }

  private startPerformanceOptimization(): void {
    this.optimizationInterval = setInterval(async () => {
      await this.runPerformanceOptimization();
    }, 15 * 60 * 1000); // Every 15 minutes
  }

  private startLoadTesting(): void {
    this.loadTestInterval = setInterval(async () => {
      const scheduledTests = Array.from(this.loadTests.values())
        .filter(test => test.schedule.enabled && this.isTestDue(test));
      
      for (const test of scheduledTests) {
        await this.runLoadTest(test.id);
      }
    }, 60 * 1000); // Check every minute
  }

  private isTestDue(test: LoadTestConfiguration): boolean {
    if (!test.lastRun) return true;
    
    const now = new Date();
    const lastRun = test.lastRun.timestamp;
    
    switch (test.schedule.frequency) {
      case 'daily':
        return now.getTime() - lastRun.getTime() >= 24 * 60 * 60 * 1000;
      case 'weekly':
        return now.getTime() - lastRun.getTime() >= 7 * 24 * 60 * 60 * 1000;
      case 'monthly':
        return now.getTime() - lastRun.getTime() >= 30 * 24 * 60 * 60 * 1000;
      default:
        return false;
    }
  }

  // Mock implementations for complex operations
  private async allocateResources(reservation: ResourceReservation): Promise<void> {
    // Mock resource allocation
    console.log(`Allocating resources for reservation: ${reservation.id}`);
  }

  private getRecentSnapshots(slaId: string, count: number): PerformanceSnapshot[] {
    const snapshots = this.snapshots.get(slaId) || [];
    return snapshots.slice(-count);
  }

  private calculatePerformanceTrend(snapshots: PerformanceSnapshot[]): any {
    // Mock trend calculation
    return {
      responseTime: 'stable',
      throughput: 'stable',
      availability: 'stable'
    };
  }

  private async createThroughputOptimization(sla: PerformanceSLA, snapshot: PerformanceSnapshot, trend: any): Promise<PerformanceOptimization> {
    // Mock throughput optimization creation
    return this.createResponseTimeOptimization(sla, snapshot, trend);
  }

  private async createResourceOptimization(sla: PerformanceSLA, snapshot: PerformanceSnapshot, trend: any): Promise<PerformanceOptimization> {
    // Mock resource optimization creation
    return this.createResponseTimeOptimization(sla, snapshot, trend);
  }

  private calculateCacheHitRate(snapshots: PerformanceSnapshot[]): number {
    // Mock cache hit rate calculation
    return 0.75; // 75% hit rate
  }

  private async createCacheOptimization(sla: PerformanceSLA, snapshot: PerformanceSnapshot, hitRate: number): Promise<PerformanceOptimization> {
    // Mock cache optimization creation
    return this.createResponseTimeOptimization(sla, snapshot, {});
  }

  private analyzeDatabasePerformance(snapshots: PerformanceSnapshot[]): any {
    // Mock database performance analysis
    return { needsOptimization: false };
  }

  private async createDatabaseOptimization(sla: PerformanceSLA, snapshot: PerformanceSnapshot, dbPerformance: any): Promise<PerformanceOptimization> {
    // Mock database optimization creation
    return this.createResponseTimeOptimization(sla, snapshot, {});
  }

  private async shouldExecuteOptimization(optimization: PerformanceOptimization): Promise<boolean> {
    // Check if optimization should be executed based on policies
    return optimization.priority === 'critical' || 
           (optimization.priority === 'high' && !this.config.optimization.approvalRequired);
  }

  private async executeAutomatedOptimization(optimization: PerformanceOptimization): Promise<void> {
    // Mock automated optimization execution
    console.log(`Executing automated optimization: ${optimization.action.script}`);
    
    // Simulate execution time
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  private async scheduleManualOptimization(optimization: PerformanceOptimization): Promise<void> {
    // Schedule manual optimization for approval
    optimization.execution.status = 'pending';
    this.emit('optimization:approval-required', { optimizationId: optimization.id });
  }

  private async getLatestSnapshot(slaId: string): Promise<PerformanceSnapshot | null> {
    const snapshots = this.snapshots.get(slaId) || [];
    return snapshots[snapshots.length - 1] || null;
  }

  private calculateOptimizationImpact(before: PerformanceSnapshot, after: PerformanceSnapshot): any {
    return {
      responseTimeImprovement: ((before.measured.responseTime.p95 - after.measured.responseTime.p95) / before.measured.responseTime.p95) * 100,
      throughputIncrease: ((after.measured.throughput.requestsPerSecond - before.measured.throughput.requestsPerSecond) / before.measured.throughput.requestsPerSecond) * 100,
      resourceReduction: ((before.measured.resources.cpu.utilization - after.measured.resources.cpu.utilization) / before.measured.resources.cpu.utilization) * 100,
      costImpact: 0
    };
  }

  private evaluateOptimizationSuccess(optimization: PerformanceOptimization, actualImpact: any): boolean {
    const expectedImprovement = optimization.action.estimatedImpact.responseTimeImprovement;
    const actualImprovement = actualImpact.responseTimeImprovement;
    
    return actualImprovement >= expectedImprovement * 0.7; // Success if within 70% of expected
  }

  private generateOptimizationSummary(optimization: PerformanceOptimization, impact: any, success: boolean): string {
    return `${optimization.type} optimization ${success ? 'succeeded' : 'failed'}. ` +
           `Response time improved by ${impact.responseTimeImprovement.toFixed(1)}%, ` +
           `throughput increased by ${impact.throughputIncrease.toFixed(1)}%.`;
  }

  private shouldRollbackOptimization(impact: any): boolean {
    return impact.responseTimeImprovement < -this.config.optimization.rollbackThreshold;
  }

  private async rollbackOptimization(optimization: PerformanceOptimization): Promise<void> {
    console.log(`Rolling back optimization: ${optimization.id}`);
    
    optimization.execution.status = 'rolled-back';
    optimization.execution.logs.push({
      timestamp: new Date(),
      level: 'warn',
      message: 'Optimization rolled back due to performance degradation'
    });
    
    this.emit('optimization:rolled-back', { optimizationId: optimization.id });
  }

  private async executeLoadTest(loadTest: LoadTestConfiguration): Promise<LoadTestConfiguration['lastRun']['summary']> {
    // Mock load test execution
    const config = loadTest.configuration;
    
    // Simulate test execution
    await new Promise(resolve => setTimeout(resolve, Math.min(config.duration * 1000, 10000))); // Max 10s for mock
    
    const totalRequests = config.load.requests.rps * config.duration * 60;
    const successRate = 0.95 + Math.random() * 0.05; // 95-100% success rate
    
    return {
      totalRequests,
      successfulRequests: Math.floor(totalRequests * successRate),
      failedRequests: Math.floor(totalRequests * (1 - successRate)),
      averageResponseTime: 150 + Math.random() * 100,
      p95ResponseTime: 300 + Math.random() * 200,
      p99ResponseTime: 500 + Math.random() * 300,
      maxConcurrentUsers: config.load.users.max,
      throughput: config.load.requests.rps * successRate,
      errorRate: (1 - successRate) * 100
    };
  }

  private async checkLoadTestSLACompliance(results: any, sla: PerformanceSLA): Promise<any> {
    return {
      responseTime: results.p95ResponseTime <= sla.terms.responseTime.p95,
      throughput: results.throughput >= sla.terms.throughput.requestsPerSecond,
      errorRate: results.errorRate <= 5, // Max 5% error rate
      resources: true, // Mock
      overall: results.p95ResponseTime <= sla.terms.responseTime.p95 && 
               results.throughput >= sla.terms.throughput.requestsPerSecond &&
               results.errorRate <= 5
    };
  }

  private generateLoadTestRecommendations(results: any, compliance: any, sla?: PerformanceSLA): string[] {
    const recommendations = [];
    
    if (!compliance.responseTime) {
      recommendations.push('Consider scaling out application instances to improve response time');
    }
    
    if (!compliance.throughput) {
      recommendations.push('Optimize database queries and implement caching to increase throughput');
    }
    
    if (!compliance.errorRate) {
      recommendations.push('Investigate and fix errors causing high failure rate');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('System is performing within SLA targets');
    }
    
    return recommendations;
  }

  private async triggerSLABreachAlert(sla: PerformanceSLA, breaches: any[], snapshot: PerformanceSnapshot): Promise<void> {
    this.emit('alert:sla-breach', {
      slaId: sla.id,
      tenantId: sla.tenantId,
      breaches,
      compliance: snapshot.compliance.overallCompliance
    });
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
      this.optimizationInterval = null;
    }
    
    if (this.loadTestInterval) {
      clearInterval(this.loadTestInterval);
      this.loadTestInterval = null;
    }
    
    this.slas.clear();
    this.snapshots.clear();
    this.optimizations.clear();
    this.reservations.clear();
    this.loadTests.clear();
    
    this.removeAllListeners();
  }
}

// Export singleton instance with default configuration
export const performanceGuaranteeSystem = new EnterprisePerformanceGuaranteeSystem({
  global: {
    defaultMeasurementPeriod: 5, // 5 minutes
    defaultReportingPeriod: 'daily',
    autoOptimizationEnabled: true,
    loadTestingEnabled: true,
    resourceReservationEnabled: true
  },
  optimization: {
    algorithms: ['predictive-scaling', 'cache-optimization', 'database-tuning', 'network-optimization'],
    aggressiveness: 'moderate',
    approvalRequired: false, // Auto-approve optimizations
    rollbackThreshold: 10, // 10% performance degradation triggers rollback
    cooldownPeriod: 5 // 5 minutes between optimizations
  },
  resources: {
    overcommitRatio: 1.2, // 20% overcommit allowed
    burstAllowance: 50, // 50% additional resources for bursting
    isolationLevel: 'soft', // Soft isolation with priority
    priorityClasses: ['guaranteed', 'burstable', 'best-effort']
  },
  loadTesting: {
    defaultTestDuration: 10, // 10 minutes
    maxConcurrentTests: 3,
    resourceLimits: {
      maxLoadGenerators: 10,
      maxTestDuration: 60 // 1 hour max
    }
  },
  alerting: {
    slaBreachNotifications: true,
    performanceDegradationThreshold: 15, // 15% degradation triggers alert
    channels: [
      {
        type: 'email',
        config: { recipients: ['sre-team@company.com'] }
      },
      {
        type: 'slack',
        config: { channel: '#performance-alerts' }
      }
    ],
    escalationRules: [
      {
        condition: 'critical-breach',
        delay: 0,
        recipients: ['oncall@company.com']
      },
      {
        condition: 'sla-breach',
        delay: 15,
        recipients: ['engineering-leads@company.com']
      }
    ]
  }
});

// Export types
export type {
  PerformanceSLA,
  PerformanceSnapshot,
  PerformanceOptimization,
  ResourceReservation,
  LoadTestConfiguration,
  PerformanceGuaranteeConfig
};