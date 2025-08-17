/**
 * Chaos Engineering Framework
 * Automated failure injection and resilience testing
 */

export interface ChaosExperiment {
  id: string;
  name: string;
  description: string;
  scope: 'service' | 'network' | 'database' | 'infrastructure';
  target: string;
  faultType: FaultType;
  parameters: Record<string, any>;
  duration: number; // seconds
  schedule?: ChaosSchedule;
  safeguards: ChaosSafeguard[];
  metrics: string[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChaosSchedule {
  type: 'manual' | 'cron' | 'interval';
  expression?: string; // cron expression
  intervalMs?: number;
  timezone?: string;
}

export interface ChaosSafeguard {
  type: 'slo_breach' | 'error_rate' | 'response_time' | 'dependency_health';
  threshold: number;
  metric: string;
  action: 'abort' | 'pause' | 'rollback';
}

export interface ChaosExecution {
  id: string;
  experimentId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'aborted';
  startTime: Date;
  endTime?: Date;
  faultInjected: boolean;
  safeguardTriggered?: string;
  metrics: ChaosMetric[];
  logs: ChaosLog[];
  hypothesis: {
    before: string;
    during: string;
    after: string;
  };
  result: {
    systemBehavior: string;
    resilienceScore: number;
    recommendations: string[];
  };
}

export interface ChaosMetric {
  name: string;
  value: number;
  timestamp: Date;
  phase: 'before' | 'during' | 'after';
}

export interface ChaosLog {
  timestamp: Date;
  level: 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, any>;
}

export type FaultType = 
  | 'latency_injection'
  | 'error_injection'
  | 'resource_exhaustion'
  | 'network_partition'
  | 'service_shutdown'
  | 'database_slowdown'
  | 'cpu_stress'
  | 'memory_stress'
  | 'disk_stress'
  | 'packet_loss'
  | 'dependency_failure';

/**
 * Chaos Engineering Engine
 */
export class ChaosEngineeringEngine {
  private experiments: Map<string, ChaosExperiment> = new Map();
  private executions: Map<string, ChaosExecution> = new Map();
  private scheduledJobs: Map<string, NodeJS.Timeout> = new Map();
  private activeFaults: Map<string, any> = new Map();

  constructor() {
    this.initializeDefaultExperiments();
  }

  /**
   * Register a chaos experiment
   */
  registerExperiment(experiment: ChaosExperiment): void {
    this.experiments.set(experiment.id, experiment);
    
    if (experiment.enabled && experiment.schedule) {
      this.scheduleExperiment(experiment);
    }
    
    console.log(`Registered chaos experiment: ${experiment.name}`);
  }

  /**
   * Execute chaos experiment
   */
  async executeExperiment(experimentId: string, hypothesis?: {
    before: string;
    during: string;
    after: string;
  }): Promise<string> {
    const experiment = this.experiments.get(experimentId);
    
    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }

    if (!experiment.enabled) {
      throw new Error(`Experiment is disabled: ${experimentId}`);
    }

    const executionId = this.generateExecutionId();
    const execution: ChaosExecution = {
      id: executionId,
      experimentId,
      status: 'pending',
      startTime: new Date(),
      faultInjected: false,
      metrics: [],
      logs: [],
      hypothesis: hypothesis || {
        before: 'System is stable and responsive',
        during: 'System will handle the fault gracefully',
        after: 'System will recover automatically'
      },
      result: {
        systemBehavior: '',
        resilienceScore: 0,
        recommendations: []
      }
    };

    this.executions.set(executionId, execution);
    
    // Execute asynchronously
    this.runExperiment(execution).catch(error => {
      console.error(`Chaos experiment failed: ${executionId}`, error);
    });

    return executionId;
  }

  /**
   * Get experiment execution status
   */
  getExecution(executionId: string): ChaosExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Get all executions for an experiment
   */
  getExperimentExecutions(experimentId: string): ChaosExecution[] {
    return Array.from(this.executions.values())
      .filter(execution => execution.experimentId === experimentId);
  }

  /**
   * Abort running experiment
   */
  async abortExperiment(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    
    if (!execution || execution.status !== 'running') {
      throw new Error('No running experiment found with this ID');
    }

    execution.status = 'aborted';
    execution.endTime = new Date();
    
    // Remove fault if injected
    if (execution.faultInjected) {
      await this.removeFault(execution.experimentId);
    }

    this.addLog(execution, 'warn', 'Experiment aborted manually');
  }

  /**
   * Run chaos experiment
   */
  private async runExperiment(execution: ChaosExecution): Promise<void> {
    const experiment = this.experiments.get(execution.experimentId)!;
    
    try {
      execution.status = 'running';
      this.addLog(execution, 'info', `Starting chaos experiment: ${experiment.name}`);

      // Phase 1: Baseline measurement (before)
      await this.measureBaseline(execution, experiment);
      await this.sleep(5000); // 5 second baseline

      // Phase 2: Inject fault
      this.addLog(execution, 'info', 'Injecting fault');
      await this.injectFault(execution, experiment);
      
      // Phase 3: Monitor during fault
      const faultDuration = experiment.duration * 1000;
      await this.monitorDuringFault(execution, experiment, faultDuration);

      // Phase 4: Remove fault
      this.addLog(execution, 'info', 'Removing fault');
      await this.removeFault(execution.experimentId);

      // Phase 5: Recovery measurement (after)
      await this.sleep(10000); // 10 second recovery period
      await this.measureRecovery(execution, experiment);

      // Phase 6: Analyze results
      await this.analyzeResults(execution, experiment);

      execution.status = 'completed';
      execution.endTime = new Date();
      
      this.addLog(execution, 'info', 'Chaos experiment completed successfully');

    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date();
      
      this.addLog(execution, 'error', `Experiment failed: ${error}`);
      
      // Ensure fault is removed
      if (execution.faultInjected) {
        await this.removeFault(execution.experimentId);
      }
    }
  }

  /**
   * Measure baseline metrics
   */
  private async measureBaseline(execution: ChaosExecution, experiment: ChaosExperiment): Promise<void> {
    for (const metricName of experiment.metrics) {
      const value = await this.getMetricValue(metricName, experiment.target);
      execution.metrics.push({
        name: metricName,
        value,
        timestamp: new Date(),
        phase: 'before'
      });
    }
    
    this.addLog(execution, 'info', 'Baseline metrics collected');
  }

  /**
   * Inject fault based on experiment type
   */
  private async injectFault(execution: ChaosExecution, experiment: ChaosExperiment): Promise<void> {
    const faultId = `fault_${execution.id}`;
    
    switch (experiment.faultType) {
      case 'latency_injection':
        await this.injectLatency(faultId, experiment.target, experiment.parameters);
        break;
      case 'error_injection':
        await this.injectErrors(faultId, experiment.target, experiment.parameters);
        break;
      case 'resource_exhaustion':
        await this.exhaustResources(faultId, experiment.target, experiment.parameters);
        break;
      case 'network_partition':
        await this.partitionNetwork(faultId, experiment.target, experiment.parameters);
        break;
      case 'service_shutdown':
        await this.shutdownService(faultId, experiment.target, experiment.parameters);
        break;
      case 'database_slowdown':
        await this.slowdownDatabase(faultId, experiment.target, experiment.parameters);
        break;
      case 'cpu_stress':
        await this.stressCPU(faultId, experiment.target, experiment.parameters);
        break;
      case 'memory_stress':
        await this.stressMemory(faultId, experiment.target, experiment.parameters);
        break;
      case 'dependency_failure':
        await this.failDependency(faultId, experiment.target, experiment.parameters);
        break;
      default:
        throw new Error(`Unsupported fault type: ${experiment.faultType}`);
    }

    this.activeFaults.set(execution.experimentId, faultId);
    execution.faultInjected = true;
    
    this.addLog(execution, 'info', `Fault injected: ${experiment.faultType}`);
  }

  /**
   * Monitor system during fault injection
   */
  private async monitorDuringFault(
    execution: ChaosExecution, 
    experiment: ChaosExperiment, 
    duration: number
  ): Promise<void> {
    const startTime = Date.now();
    const monitorInterval = 5000; // 5 seconds
    
    while (Date.now() - startTime < duration) {
      // Check safeguards
      for (const safeguard of experiment.safeguards) {
        const violated = await this.checkSafeguard(safeguard, experiment.target);
        
        if (violated) {
          execution.safeguardTriggered = safeguard.type;
          this.addLog(execution, 'warn', `Safeguard triggered: ${safeguard.type}`);
          
          if (safeguard.action === 'abort') {
            throw new Error(`Safeguard abort: ${safeguard.type}`);
          }
        }
      }

      // Collect metrics
      for (const metricName of experiment.metrics) {
        const value = await this.getMetricValue(metricName, experiment.target);
        execution.metrics.push({
          name: metricName,
          value,
          timestamp: new Date(),
          phase: 'during'
        });
      }

      await this.sleep(monitorInterval);
    }
  }

  /**
   * Measure recovery metrics
   */
  private async measureRecovery(execution: ChaosExecution, experiment: ChaosExperiment): Promise<void> {
    for (const metricName of experiment.metrics) {
      const value = await this.getMetricValue(metricName, experiment.target);
      execution.metrics.push({
        name: metricName,
        value,
        timestamp: new Date(),
        phase: 'after'
      });
    }
    
    this.addLog(execution, 'info', 'Recovery metrics collected');
  }

  /**
   * Analyze experiment results
   */
  private async analyzeResults(execution: ChaosExecution, experiment: ChaosExperiment): Promise<void> {
    const beforeMetrics = execution.metrics.filter(m => m.phase === 'before');
    const duringMetrics = execution.metrics.filter(m => m.phase === 'during');
    const afterMetrics = execution.metrics.filter(m => m.phase === 'after');

    // Calculate resilience score (0-100)
    let resilienceScore = 100;
    
    // Check if system maintained availability
    const errorRateMetrics = duringMetrics.filter(m => m.name.includes('error_rate'));
    if (errorRateMetrics.length > 0) {
      const avgErrorRate = errorRateMetrics.reduce((sum, m) => sum + m.value, 0) / errorRateMetrics.length;
      if (avgErrorRate > 5) resilienceScore -= 30; // High error rate
      else if (avgErrorRate > 1) resilienceScore -= 10; // Moderate error rate
    }

    // Check response time degradation
    const responseTimeMetrics = duringMetrics.filter(m => m.name.includes('response_time'));
    if (responseTimeMetrics.length > 0) {
      const beforeAvg = beforeMetrics.filter(m => m.name.includes('response_time'))
        .reduce((sum, m) => sum + m.value, 0) / beforeMetrics.filter(m => m.name.includes('response_time')).length;
      const duringAvg = responseTimeMetrics.reduce((sum, m) => sum + m.value, 0) / responseTimeMetrics.length;
      
      const degradation = (duringAvg - beforeAvg) / beforeAvg;
      if (degradation > 2) resilienceScore -= 20; // More than 2x slower
      else if (degradation > 0.5) resilienceScore -= 10; // More than 50% slower
    }

    // Check recovery time
    const afterErrorRate = afterMetrics.filter(m => m.name.includes('error_rate'));
    if (afterErrorRate.length > 0) {
      const avgAfterErrorRate = afterErrorRate.reduce((sum, m) => sum + m.value, 0) / afterErrorRate.length;
      if (avgAfterErrorRate > 1) resilienceScore -= 15; // Poor recovery
    }

    // Safeguard penalties
    if (execution.safeguardTriggered) {
      resilienceScore -= 25;
    }

    execution.result = {
      systemBehavior: this.generateBehaviorSummary(execution),
      resilienceScore: Math.max(0, resilienceScore),
      recommendations: this.generateRecommendations(execution, experiment)
    };
  }

  /**
   * Generate behavior summary
   */
  private generateBehaviorSummary(execution: ChaosExecution): string {
    const duringMetrics = execution.metrics.filter(m => m.phase === 'during');
    const errorRate = duringMetrics.filter(m => m.name.includes('error_rate'));
    const responseTime = duringMetrics.filter(m => m.name.includes('response_time'));

    let summary = 'System ';
    
    if (errorRate.length > 0) {
      const avgErrorRate = errorRate.reduce((sum, m) => sum + m.value, 0) / errorRate.length;
      if (avgErrorRate > 5) {
        summary += 'experienced significant errors ';
      } else if (avgErrorRate > 1) {
        summary += 'had some errors ';
      } else {
        summary += 'maintained low error rates ';
      }
    }

    if (responseTime.length > 0) {
      const beforeAvg = execution.metrics.filter(m => m.phase === 'before' && m.name.includes('response_time'))
        .reduce((sum, m) => sum + m.value, 0) / execution.metrics.filter(m => m.phase === 'before' && m.name.includes('response_time')).length;
      const duringAvg = responseTime.reduce((sum, m) => sum + m.value, 0) / responseTime.length;
      
      const degradation = (duringAvg - beforeAvg) / beforeAvg;
      if (degradation > 1) {
        summary += 'and showed significant performance degradation';
      } else if (degradation > 0.3) {
        summary += 'and had moderate performance impact';
      } else {
        summary += 'and maintained good performance';
      }
    }

    return summary + ' during the fault injection.';
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(execution: ChaosExecution, experiment: ChaosExperiment): string[] {
    const recommendations: string[] = [];
    
    if (execution.result.resilienceScore < 70) {
      recommendations.push('Consider implementing circuit breakers for better fault tolerance');
      recommendations.push('Add retry logic with exponential backoff');
      recommendations.push('Implement graceful degradation patterns');
    }

    if (execution.safeguardTriggered) {
      recommendations.push('Review alerting thresholds - system may need tuning');
      recommendations.push('Consider implementing auto-scaling to handle load spikes');
    }

    const duringMetrics = execution.metrics.filter(m => m.phase === 'during');
    const errorRate = duringMetrics.filter(m => m.name.includes('error_rate'));
    
    if (errorRate.length > 0) {
      const avgErrorRate = errorRate.reduce((sum, m) => sum + m.value, 0) / errorRate.length;
      if (avgErrorRate > 5) {
        recommendations.push('Implement health checks and automatic failover');
        recommendations.push('Add redundancy for critical components');
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('System showed good resilience - continue regular chaos testing');
    }

    return recommendations;
  }

  // Fault injection implementations (simplified - would integrate with actual infrastructure)
  private async injectLatency(faultId: string, target: string, params: Record<string, any>): Promise<void> {
    console.log(`Injecting latency: ${params.delay}ms to ${target}`);
    // Implementation would integrate with service mesh or proxy
  }

  private async injectErrors(faultId: string, target: string, params: Record<string, any>): Promise<void> {
    console.log(`Injecting errors: ${params.errorRate}% to ${target}`);
    // Implementation would configure error injection in proxy/middleware
  }

  private async exhaustResources(faultId: string, target: string, params: Record<string, any>): Promise<void> {
    console.log(`Exhausting resources: ${params.resourceType} on ${target}`);
    // Implementation would stress test resources
  }

  private async partitionNetwork(faultId: string, target: string, params: Record<string, any>): Promise<void> {
    console.log(`Partitioning network for ${target}`);
    // Implementation would configure network rules
  }

  private async shutdownService(faultId: string, target: string, params: Record<string, any>): Promise<void> {
    console.log(`Shutting down service: ${target}`);
    // Implementation would stop/restart services
  }

  private async slowdownDatabase(faultId: string, target: string, params: Record<string, any>): Promise<void> {
    console.log(`Slowing down database queries for ${target}`);
    // Implementation would inject database latency
  }

  private async stressCPU(faultId: string, target: string, params: Record<string, any>): Promise<void> {
    console.log(`Stressing CPU on ${target}`);
    // Implementation would run CPU stress test
  }

  private async stressMemory(faultId: string, target: string, params: Record<string, any>): Promise<void> {
    console.log(`Stressing memory on ${target}`);
    // Implementation would allocate memory
  }

  private async failDependency(faultId: string, target: string, params: Record<string, any>): Promise<void> {
    console.log(`Failing dependency: ${params.dependency} for ${target}`);
    // Implementation would simulate dependency failures
  }

  private async removeFault(experimentId: string): Promise<void> {
    const faultId = this.activeFaults.get(experimentId);
    if (faultId) {
      console.log(`Removing fault: ${faultId}`);
      this.activeFaults.delete(experimentId);
      // Implementation would clean up fault injection
    }
  }

  private async getMetricValue(metricName: string, target: string): Promise<number> {
    // Mock implementation - would integrate with metrics system
    switch (metricName) {
      case 'error_rate':
        return Math.random() * 5;
      case 'response_time':
        return 100 + Math.random() * 200;
      case 'throughput':
        return 100 + Math.random() * 50;
      default:
        return Math.random() * 100;
    }
  }

  private async checkSafeguard(safeguard: ChaosSafeguard, target: string): Promise<boolean> {
    const value = await this.getMetricValue(safeguard.metric, target);
    return value > safeguard.threshold;
  }

  private scheduleExperiment(experiment: ChaosExperiment): void {
    if (!experiment.schedule) return;

    if (experiment.schedule.type === 'interval' && experiment.schedule.intervalMs) {
      const interval = setInterval(() => {
        this.executeExperiment(experiment.id).catch(console.error);
      }, experiment.schedule.intervalMs);
      
      this.scheduledJobs.set(experiment.id, interval);
    }
    // Cron scheduling would require additional library
  }

  private addLog(execution: ChaosExecution, level: 'info' | 'warn' | 'error', message: string): void {
    execution.logs.push({
      timestamp: new Date(),
      level,
      message
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateExecutionId(): string {
    return `chaos_exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeDefaultExperiments(): void {
    // Latency injection experiment
    this.registerExperiment({
      id: 'latency-injection-api',
      name: 'API Latency Injection',
      description: 'Inject latency into API responses to test timeout handling',
      scope: 'service',
      target: 'next-portal',
      faultType: 'latency_injection',
      parameters: { delay: 2000 },
      duration: 60,
      safeguards: [
        {
          type: 'error_rate',
          threshold: 10,
          metric: 'error_rate',
          action: 'abort'
        }
      ],
      metrics: ['response_time', 'error_rate', 'throughput'],
      enabled: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Database slowdown experiment
    this.registerExperiment({
      id: 'database-slowdown',
      name: 'Database Slowdown',
      description: 'Slow down database queries to test connection pooling',
      scope: 'database',
      target: 'postgres',
      faultType: 'database_slowdown',
      parameters: { delay: 1000 },
      duration: 120,
      safeguards: [
        {
          type: 'response_time',
          threshold: 5000,
          metric: 'response_time',
          action: 'abort'
        }
      ],
      metrics: ['response_time', 'error_rate', 'db_connections'],
      enabled: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  /**
   * Get experiment statistics
   */
  getStatistics(): {
    totalExperiments: number;
    enabledExperiments: number;
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    avgResilienceScore: number;
  } {
    const executions = Array.from(this.executions.values());
    const completedExecutions = executions.filter(e => e.status === 'completed');
    
    return {
      totalExperiments: this.experiments.size,
      enabledExperiments: Array.from(this.experiments.values()).filter(e => e.enabled).length,
      totalExecutions: executions.length,
      successfulExecutions: completedExecutions.length,
      failedExecutions: executions.filter(e => e.status === 'failed').length,
      avgResilienceScore: completedExecutions.length > 0 
        ? completedExecutions.reduce((sum, e) => sum + e.result.resilienceScore, 0) / completedExecutions.length
        : 0
    };
  }
}

// Global chaos engineering instance
export const chaosEngine = new ChaosEngineeringEngine();

export default chaosEngine;