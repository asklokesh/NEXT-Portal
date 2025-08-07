import { ChaosExperiment, ChaosTarget, ChaosParameters, ChaosResults, ChaosMetric, ChaosSafeguard } from '../incident-management/types';

interface ExperimentExecutor {
  canExecute(experiment: ChaosExperiment): boolean;
  execute(experiment: ChaosExperiment): Promise<ChaosResults>;
  stop(experimentId: string): Promise<void>;
}

interface SafeguardMonitor {
  check(experiment: ChaosExperiment, safeguard: ChaosSafeguard): Promise<boolean>;
}

export class ChaosEngine {
  private experiments: Map<string, ChaosExperiment> = new Map();
  private runningExperiments: Set<string> = new Set();
  private executors: Map<string, ExperimentExecutor> = new Map();
  private safeguardMonitors: Map<string, SafeguardMonitor> = new Map();
  private scheduleIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.initializeExecutors();
    this.initializeSafeguardMonitors();
  }

  async createExperiment(experiment: Omit<ChaosExperiment, 'id' | 'createdAt'>): Promise<ChaosExperiment> {
    const id = this.generateExperimentId();
    const now = new Date();

    const fullExperiment: ChaosExperiment = {
      id,
      ...experiment,
      createdAt: now,
      status: 'draft'
    };

    // Validate experiment
    await this.validateExperiment(fullExperiment);

    this.experiments.set(id, fullExperiment);

    // Schedule if needed
    if (fullExperiment.schedule) {
      this.scheduleExperiment(fullExperiment);
    }

    console.log(`Chaos experiment created: ${fullExperiment.name}`);
    return fullExperiment;
  }

  async executeExperiment(experimentId: string): Promise<ChaosResults> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    if (this.runningExperiments.has(experimentId)) {
      throw new Error(`Experiment ${experimentId} is already running`);
    }

    // Pre-execution validation
    await this.preExecutionChecks(experiment);

    try {
      // Mark as running
      experiment.status = 'running';
      experiment.executedAt = new Date();
      this.runningExperiments.add(experimentId);

      console.log(`Starting chaos experiment: ${experiment.name}`);

      // Find appropriate executor
      const executor = this.findExecutor(experiment);
      if (!executor) {
        throw new Error(`No executor found for experiment type: ${experiment.type}`);
      }

      // Execute with monitoring
      const results = await this.executeWithMonitoring(experiment, executor);

      // Update experiment
      experiment.results = results;
      experiment.status = results.success ? 'completed' : 'failed';
      experiment.completedAt = new Date();

      console.log(`Chaos experiment completed: ${experiment.name} (success: ${results.success})`);
      return results;

    } catch (error) {
      experiment.status = 'failed';
      experiment.completedAt = new Date();
      
      console.error(`Chaos experiment failed: ${experiment.name}`, error);
      throw error;

    } finally {
      this.runningExperiments.delete(experimentId);
    }
  }

  async stopExperiment(experimentId: string): Promise<void> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    if (!this.runningExperiments.has(experimentId)) {
      throw new Error(`Experiment ${experimentId} is not running`);
    }

    const executor = this.findExecutor(experiment);
    if (executor) {
      await executor.stop(experimentId);
    }

    experiment.status = 'cancelled';
    experiment.completedAt = new Date();
    this.runningExperiments.delete(experimentId);

    console.log(`Chaos experiment stopped: ${experiment.name}`);
  }

  async scheduleExperiment(experiment: ChaosExperiment): Promise<void> {
    if (!experiment.schedule?.enabled) return;

    const schedule = experiment.schedule;
    let intervalMs: number;

    switch (schedule.frequency) {
      case 'daily':
        intervalMs = 24 * 60 * 60 * 1000;
        break;
      case 'weekly':
        intervalMs = 7 * 24 * 60 * 60 * 1000;
        break;
      case 'monthly':
        intervalMs = 30 * 24 * 60 * 60 * 1000;
        break;
      default:
        return; // 'once' doesn't need scheduling
    }

    // Calculate next execution time
    const now = new Date();
    const [hours, minutes] = schedule.time.split(':').map(Number);
    const nextExecution = new Date(now);
    nextExecution.setHours(hours, minutes, 0, 0);

    if (nextExecution <= now) {
      nextExecution.setTime(nextExecution.getTime() + intervalMs);
    }

    const timeout = nextExecution.getTime() - now.getTime();

    const intervalId = setTimeout(async () => {
      try {
        await this.executeExperiment(experiment.id);
      } catch (error) {
        console.error(`Scheduled experiment failed: ${experiment.name}`, error);
      }

      // Schedule next execution
      if (schedule.frequency !== 'once') {
        this.scheduleExperiment(experiment);
      }
    }, timeout);

    this.scheduleIntervals.set(experiment.id, intervalId);

    console.log(`Chaos experiment scheduled: ${experiment.name} (next: ${nextExecution.toISOString()})`);
  }

  private async validateExperiment(experiment: ChaosExperiment): Promise<void> {
    // Check target validity
    if (!this.isValidTarget(experiment.target)) {
      throw new Error('Invalid experiment target');
    }

    // Check environment restrictions
    if (experiment.target.environment === 'production' && !this.isProductionAllowed(experiment)) {
      throw new Error('Production experiments require special approval');
    }

    // Validate parameters
    if (experiment.parameters.duration <= 0 || experiment.parameters.duration > 60) {
      throw new Error('Experiment duration must be between 1 and 60 minutes');
    }

    // Check for conflicting experiments
    const conflicting = Array.from(this.experiments.values()).find(exp => 
      exp.status === 'running' && this.hasTargetOverlap(exp.target, experiment.target)
    );

    if (conflicting) {
      throw new Error(`Conflicting experiment already running: ${conflicting.name}`);
    }
  }

  private async preExecutionChecks(experiment: ChaosExperiment): Promise<void> {
    // Check system health
    const isHealthy = await this.checkSystemHealth(experiment.target);
    if (!isHealthy) {
      throw new Error('System health check failed - experiment aborted');
    }

    // Check business hours (if configured)
    if (experiment.target.environment === 'production') {
      const now = new Date();
      const hour = now.getHours();
      
      // Avoid peak hours (9 AM - 5 PM)
      if (hour >= 9 && hour < 17) {
        console.warn('Executing chaos experiment during business hours');
      }
    }

    // Verify safeguards are operational
    for (const safeguard of experiment.parameters.safeguards) {
      const monitor = this.safeguardMonitors.get(safeguard.type);
      if (!monitor) {
        throw new Error(`No monitor available for safeguard type: ${safeguard.type}`);
      }
    }
  }

  private async executeWithMonitoring(experiment: ChaosExperiment, executor: ExperimentExecutor): Promise<ChaosResults> {
    const startTime = Date.now();
    const baselineMetrics = await this.collectBaselineMetrics(experiment);

    // Start safeguard monitoring
    const safeguardInterval = setInterval(async () => {
      for (const safeguard of experiment.parameters.safeguards) {
        const monitor = this.safeguardMonitors.get(safeguard.type);
        if (monitor) {
          const triggered = await monitor.check(experiment, safeguard);
          if (triggered) {
            console.warn(`Safeguard triggered: ${safeguard.type} - ${safeguard.action}`);
            
            switch (safeguard.action) {
              case 'pause':
                // Pause experiment (not stopping completely)
                console.log('Pausing experiment due to safeguard');
                break;
              case 'stop':
                await this.stopExperiment(experiment.id);
                return;
              case 'alert':
                // Send alert to chaos engineering team
                console.log('Safeguard alert sent');
                break;
            }
          }
        }
      }
    }, 30000); // Check every 30 seconds

    try {
      // Execute the actual chaos experiment
      const results = await executor.execute(experiment);
      
      // Collect post-experiment metrics
      const postMetrics = await this.collectPostExperimentMetrics(experiment);
      
      // Analyze results
      const analysis = this.analyzeResults(experiment, baselineMetrics, postMetrics);
      
      return {
        ...results,
        metrics: analysis.metrics,
        observations: analysis.observations,
        recommendations: analysis.recommendations
      };

    } finally {
      clearInterval(safeguardInterval);
    }
  }

  private async collectBaselineMetrics(experiment: ChaosExperiment): Promise<ChaosMetric[]> {
    const metrics: ChaosMetric[] = [];

    // Collect basic system metrics
    metrics.push(
      await this.collectMetric('cpu_usage', experiment.target),
      await this.collectMetric('memory_usage', experiment.target),
      await this.collectMetric('response_time', experiment.target),
      await this.collectMetric('error_rate', experiment.target),
      await this.collectMetric('request_rate', experiment.target)
    );

    return metrics;
  }

  private async collectPostExperimentMetrics(experiment: ChaosExperiment): Promise<ChaosMetric[]> {
    // Wait a bit for metrics to stabilize
    await this.delay(30000);

    return this.collectBaselineMetrics(experiment);
  }

  private async collectMetric(name: string, target: ChaosTarget): Promise<ChaosMetric> {
    // Mock implementation - in real system, query monitoring system
    const baseValue = Math.random() * 100;
    
    return {
      name,
      before: baseValue,
      during: baseValue * (1 + (Math.random() - 0.5) * 0.2), // ±10% variation
      after: baseValue * (1 + (Math.random() - 0.5) * 0.1), // ±5% variation
      unit: this.getMetricUnit(name),
      threshold: this.getMetricThreshold(name),
      passed: true // Will be calculated based on actual values
    };
  }

  private analyzeResults(experiment: ChaosExperiment, before: ChaosMetric[], after: ChaosMetric[]): {
    metrics: ChaosMetric[];
    observations: string[];
    recommendations: string[];
  } {
    const observations: string[] = [];
    const recommendations: string[] = [];
    const analyzedMetrics: ChaosMetric[] = [];

    for (let i = 0; i < before.length; i++) {
      const beforeMetric = before[i];
      const afterMetric = after[i];

      const metric: ChaosMetric = {
        name: beforeMetric.name,
        before: beforeMetric.before,
        during: beforeMetric.during,
        after: afterMetric.after,
        unit: beforeMetric.unit,
        threshold: beforeMetric.threshold,
        passed: Math.abs(beforeMetric.during - beforeMetric.before) <= beforeMetric.threshold
      };

      analyzedMetrics.push(metric);

      // Generate observations
      const changePercent = ((beforeMetric.during - beforeMetric.before) / beforeMetric.before) * 100;
      if (Math.abs(changePercent) > 5) {
        observations.push(`${metric.name} changed by ${changePercent.toFixed(1)}% during the experiment`);
      }

      if (!metric.passed) {
        observations.push(`${metric.name} exceeded acceptable threshold during experiment`);
        recommendations.push(`Investigate ${metric.name} performance degradation`);
      }

      // Recovery analysis
      const recoveryPercent = ((afterMetric.after - beforeMetric.before) / beforeMetric.before) * 100;
      if (Math.abs(recoveryPercent) > 2) {
        observations.push(`${metric.name} did not fully recover after experiment (${recoveryPercent.toFixed(1)}% difference)`);
        recommendations.push(`Monitor ${metric.name} for extended recovery time`);
      }
    }

    // Experiment-specific observations
    switch (experiment.type) {
      case 'network':
        observations.push('Network chaos experiment completed - check for retry mechanisms');
        recommendations.push('Consider implementing circuit breakers if not present');
        break;
      case 'cpu':
        observations.push('CPU stress test completed - verify auto-scaling behavior');
        recommendations.push('Review CPU limits and requests for containers');
        break;
      case 'memory':
        observations.push('Memory pressure test completed - check for memory leaks');
        recommendations.push('Verify garbage collection and memory cleanup processes');
        break;
      case 'service':
        observations.push('Service failure test completed - validate graceful degradation');
        recommendations.push('Ensure dependent services handle failures gracefully');
        break;
    }

    return {
      metrics: analyzedMetrics,
      observations,
      recommendations
    };
  }

  private findExecutor(experiment: ChaosExperiment): ExperimentExecutor | undefined {
    return this.executors.get(experiment.type);
  }

  private isValidTarget(target: ChaosTarget): boolean {
    return target.identifier && target.environment && target.type;
  }

  private isProductionAllowed(experiment: ChaosExperiment): boolean {
    // In a real system, check permissions, approval status, etc.
    return experiment.parameters.intensity === 'low';
  }

  private hasTargetOverlap(target1: ChaosTarget, target2: ChaosTarget): boolean {
    return target1.identifier === target2.identifier && target1.environment === target2.environment;
  }

  private async checkSystemHealth(target: ChaosTarget): Promise<boolean> {
    // Mock health check - in real system, query monitoring systems
    return Math.random() > 0.1; // 90% success rate
  }

  private getMetricUnit(name: string): string {
    switch (name) {
      case 'cpu_usage':
      case 'memory_usage':
      case 'error_rate':
        return '%';
      case 'response_time':
        return 'ms';
      case 'request_rate':
        return 'req/s';
      default:
        return '';
    }
  }

  private getMetricThreshold(name: string): number {
    switch (name) {
      case 'cpu_usage':
        return 20; // 20% increase threshold
      case 'memory_usage':
        return 15; // 15% increase threshold
      case 'response_time':
        return 100; // 100ms increase threshold
      case 'error_rate':
        return 5; // 5% increase threshold
      case 'request_rate':
        return 10; // 10% decrease threshold
      default:
        return 10;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateExperimentId(): string {
    return 'chaos_' + Math.random().toString(36).substr(2, 12);
  }

  private initializeExecutors(): void {
    // Network chaos executor
    this.executors.set('network', new NetworkChaosExecutor());
    
    // CPU chaos executor
    this.executors.set('cpu', new CpuChaosExecutor());
    
    // Memory chaos executor
    this.executors.set('memory', new MemoryChaosExecutor());
    
    // Service chaos executor
    this.executors.set('service', new ServiceChaosExecutor());
    
    // Database chaos executor
    this.executors.set('database', new DatabaseChaosExecutor());

    console.log('Chaos executors initialized');
  }

  private initializeSafeguardMonitors(): void {
    this.safeguardMonitors.set('metric_threshold', new MetricThresholdMonitor());
    this.safeguardMonitors.set('service_health', new ServiceHealthMonitor());
    this.safeguardMonitors.set('user_impact', new UserImpactMonitor());

    console.log('Safeguard monitors initialized');
  }

  // Public methods
  public getExperiment(id: string): ChaosExperiment | undefined {
    return this.experiments.get(id);
  }

  public getExperiments(): ChaosExperiment[] {
    return Array.from(this.experiments.values());
  }

  public getRunningExperiments(): ChaosExperiment[] {
    return Array.from(this.experiments.values()).filter(exp => 
      this.runningExperiments.has(exp.id)
    );
  }

  public async deleteExperiment(id: string): Promise<void> {
    const experiment = this.experiments.get(id);
    if (!experiment) {
      throw new Error(`Experiment ${id} not found`);
    }

    if (this.runningExperiments.has(id)) {
      await this.stopExperiment(id);
    }

    // Cancel scheduled execution
    const intervalId = this.scheduleIntervals.get(id);
    if (intervalId) {
      clearTimeout(intervalId);
      this.scheduleIntervals.delete(id);
    }

    this.experiments.delete(id);
    console.log(`Chaos experiment deleted: ${experiment.name}`);
  }

  public getExperimentHistory(targetId?: string, days = 30): ChaosExperiment[] {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    return Array.from(this.experiments.values()).filter(exp => {
      const matchesTarget = !targetId || exp.target.identifier === targetId;
      const withinTimeframe = exp.createdAt >= cutoff;
      const isCompleted = ['completed', 'failed', 'cancelled'].includes(exp.status);
      
      return matchesTarget && withinTimeframe && isCompleted;
    });
  }
}

// Executor implementations
class NetworkChaosExecutor implements ExperimentExecutor {
  canExecute(experiment: ChaosExperiment): boolean {
    return experiment.type === 'network';
  }

  async execute(experiment: ChaosExperiment): Promise<ChaosResults> {
    console.log(`Executing network chaos: ${experiment.name}`);
    
    // Mock network disruption
    await this.delay(experiment.parameters.duration * 60000);
    
    return {
      success: true,
      metrics: [],
      incidents: [],
      observations: ['Network latency increased as expected'],
      recommendations: ['Consider implementing retry logic with exponential backoff']
    };
  }

  async stop(experimentId: string): Promise<void> {
    console.log(`Stopping network chaos: ${experimentId}`);
    // In real implementation, restore network conditions
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

class CpuChaosExecutor implements ExperimentExecutor {
  canExecute(experiment: ChaosExperiment): boolean {
    return experiment.type === 'cpu';
  }

  async execute(experiment: ChaosExperiment): Promise<ChaosResults> {
    console.log(`Executing CPU chaos: ${experiment.name}`);
    
    // Mock CPU stress
    await this.delay(experiment.parameters.duration * 60000);
    
    return {
      success: true,
      metrics: [],
      incidents: [],
      observations: ['CPU usage increased to expected levels'],
      recommendations: ['Verify auto-scaling triggers are configured correctly']
    };
  }

  async stop(experimentId: string): Promise<void> {
    console.log(`Stopping CPU chaos: ${experimentId}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

class MemoryChaosExecutor implements ExperimentExecutor {
  canExecute(experiment: ChaosExperiment): boolean {
    return experiment.type === 'memory';
  }

  async execute(experiment: ChaosExperiment): Promise<ChaosResults> {
    console.log(`Executing memory chaos: ${experiment.name}`);
    
    await this.delay(experiment.parameters.duration * 60000);
    
    return {
      success: true,
      metrics: [],
      incidents: [],
      observations: ['Memory pressure applied successfully'],
      recommendations: ['Check for memory leaks and optimize garbage collection']
    };
  }

  async stop(experimentId: string): Promise<void> {
    console.log(`Stopping memory chaos: ${experimentId}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

class ServiceChaosExecutor implements ExperimentExecutor {
  canExecute(experiment: ChaosExperiment): boolean {
    return experiment.type === 'service';
  }

  async execute(experiment: ChaosExperiment): Promise<ChaosResults> {
    console.log(`Executing service chaos: ${experiment.name}`);
    
    await this.delay(experiment.parameters.duration * 60000);
    
    return {
      success: true,
      metrics: [],
      incidents: [],
      observations: ['Service disruption completed as planned'],
      recommendations: ['Validate circuit breaker patterns and graceful degradation']
    };
  }

  async stop(experimentId: string): Promise<void> {
    console.log(`Stopping service chaos: ${experimentId}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

class DatabaseChaosExecutor implements ExperimentExecutor {
  canExecute(experiment: ChaosExperiment): boolean {
    return experiment.type === 'database';
  }

  async execute(experiment: ChaosExperiment): Promise<ChaosResults> {
    console.log(`Executing database chaos: ${experiment.name}`);
    
    await this.delay(experiment.parameters.duration * 60000);
    
    return {
      success: true,
      metrics: [],
      incidents: [],
      observations: ['Database stress test completed'],
      recommendations: ['Review connection pooling and query optimization']
    };
  }

  async stop(experimentId: string): Promise<void> {
    console.log(`Stopping database chaos: ${experimentId}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Safeguard monitor implementations
class MetricThresholdMonitor implements SafeguardMonitor {
  async check(experiment: ChaosExperiment, safeguard: ChaosSafeguard): Promise<boolean> {
    // Mock threshold check
    return Math.random() > 0.95; // 5% chance of triggering
  }
}

class ServiceHealthMonitor implements SafeguardMonitor {
  async check(experiment: ChaosExperiment, safeguard: ChaosSafeguard): Promise<boolean> {
    // Mock health check
    return Math.random() > 0.98; // 2% chance of triggering
  }
}

class UserImpactMonitor implements SafeguardMonitor {
  async check(experiment: ChaosExperiment, safeguard: ChaosSafeguard): Promise<boolean> {
    // Mock user impact check
    return Math.random() > 0.99; // 1% chance of triggering
  }
}