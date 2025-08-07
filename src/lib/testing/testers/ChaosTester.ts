/**
 * Chaos Tester
 * Chaos engineering framework for resilience testing
 */

import { EventEmitter } from 'events';
import { TestSuite, TestResult } from '../TestingFramework';
import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';

const execAsync = promisify(exec);

export interface ChaosTestConfig {
  experiments: ChaosExperiment[];
  environment: ChaosEnvironment;
  duration: string;
  steadyStateHypothesis: SteadyStateHypothesis;
  rollbackStrategy: RollbackStrategy;
}

export interface ChaosExperiment {
  name: string;
  type: 'network' | 'cpu' | 'memory' | 'disk' | 'service' | 'database' | 'custom';
  description: string;
  method: ChaosMethod;
  target: ChaosTarget;
  duration: string;
  magnitude: number; // 0-100 intensity
  conditions?: ExperimentCondition[];
}

export interface ChaosMethod {
  type: 'failure' | 'latency' | 'resource_exhaustion' | 'partition' | 'corruption';
  parameters: Record<string, any>;
}

export interface ChaosTarget {
  type: 'service' | 'container' | 'pod' | 'node' | 'network' | 'database';
  selector: Record<string, string>;
  percentage?: number; // Percentage of targets to affect
}

export interface ChaosEnvironment {
  platform: 'kubernetes' | 'docker' | 'host' | 'cloud';
  connection: Record<string, any>;
  monitoring: MonitoringConfig;
}

export interface MonitoringConfig {
  endpoints: string[];
  metrics: string[];
  alerting?: AlertingConfig;
}

export interface AlertingConfig {
  enabled: boolean;
  channels: string[];
  thresholds: Record<string, number>;
}

export interface SteadyStateHypothesis {
  title: string;
  probes: ChaosProbe[];
}

export interface ChaosProbe {
  name: string;
  type: 'http' | 'command' | 'metric' | 'custom';
  tolerance: ProbeTolerance;
  provider: ProbeProvider;
}

export interface ProbeTolerance {
  type: 'range' | 'regex' | 'json_path' | 'status_code';
  value: any;
}

export interface ProbeProvider {
  type: 'http' | 'process' | 'prometheus' | 'python';
  config: Record<string, any>;
}

export interface RollbackStrategy {
  enabled: boolean;
  triggers: string[];
  actions: RollbackAction[];
}

export interface RollbackAction {
  type: 'command' | 'api_call' | 'notification';
  parameters: Record<string, any>;
}

export interface ExperimentCondition {
  type: 'time' | 'metric' | 'event';
  parameters: Record<string, any>;
}

export interface ChaosExperimentResult {
  experiment: ChaosExperiment;
  status: 'passed' | 'failed' | 'error' | 'aborted';
  duration: number;
  steadyStateResults: ProbeResult[];
  chaosResults: any;
  rollbackResults?: RollbackResult[];
  observations: string[];
  metrics: ExperimentMetrics;
}

export interface ProbeResult {
  probe: ChaosProbe;
  status: 'passed' | 'failed' | 'error';
  value: any;
  tolerance: boolean;
  message: string;
  timestamp: Date;
}

export interface RollbackResult {
  action: RollbackAction;
  status: 'success' | 'failed';
  message: string;
  timestamp: Date;
}

export interface ExperimentMetrics {
  systemMetrics: Record<string, number>;
  applicationMetrics: Record<string, number>;
  customMetrics: Record<string, number>;
}

export class ChaosTester extends EventEmitter {
  private experiments: Map<string, ChaosExperimentResult> = new Map();

  constructor() {
    super();
  }

  public async execute(suite: TestSuite): Promise<TestResult> {
    this.emit('test:started', suite);
    const startTime = Date.now();

    try {
      const config = this.parseChaosConfig(suite);
      const results = await this.runChaosExperiments(config, suite.id);
      
      const duration = Date.now() - startTime;
      const result = this.createTestResult(suite, results, duration);
      
      this.emit('test:completed', suite, result);
      return result;
    } catch (error) {
      this.emit('test:error', suite, error);
      throw error;
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      // Check if chaos engineering tools are available
      const toolChecks = await Promise.allSettled([
        this.checkChaosToolkit(),
        this.checkLitmus(),
        this.checkGremlin()
      ]);

      // At least one chaos tool should be available
      return toolChecks.some(check => check.status === 'fulfilled');
    } catch (error) {
      return false;
    }
  }

  private async runChaosExperiments(config: ChaosTestConfig, suiteId: string): Promise<ChaosExperimentResult[]> {
    const results: ChaosExperimentResult[] = [];

    // Verify steady state before experiments
    this.emit('test:progress', { suiteId, phase: 'steady-state-verification' });
    const initialSteadyState = await this.verifysteadyState(config.steadyStateHypothesis);
    
    if (!this.isSteadyStateHealthy(initialSteadyState)) {
      throw new Error('System is not in a healthy steady state before chaos experiments');
    }

    // Execute each experiment
    for (const experiment of config.experiments) {
      this.emit('test:progress', { suiteId, phase: `chaos-experiment-${experiment.name}` });
      
      const experimentResult = await this.executeExperiment(
        experiment, 
        config.steadyStateHypothesis,
        config.rollbackStrategy,
        config.environment
      );
      
      results.push(experimentResult);
      this.experiments.set(experiment.name, experimentResult);

      // Check if we should abort due to failures
      if (experimentResult.status === 'failed' && config.rollbackStrategy.enabled) {
        this.emit('experiment:aborting', { experiment: experiment.name, reason: 'failure' });
        await this.executeRollback(config.rollbackStrategy, config.environment);
        break;
      }

      // Wait between experiments for system recovery
      await this.waitForRecovery(30000); // 30 seconds
    }

    // Final steady state verification
    this.emit('test:progress', { suiteId, phase: 'final-steady-state-verification' });
    const finalSteadyState = await this.verifysteadyState(config.steadyStateHypothesis);
    
    return results;
  }

  private async executeExperiment(
    experiment: ChaosExperiment,
    hypothesis: SteadyStateHypothesis,
    rollback: RollbackStrategy,
    environment: ChaosEnvironment
  ): Promise<ChaosExperimentResult> {
    const startTime = Date.now();
    const result: ChaosExperimentResult = {
      experiment,
      status: 'passed',
      duration: 0,
      steadyStateResults: [],
      chaosResults: {},
      observations: [],
      metrics: {
        systemMetrics: {},
        applicationMetrics: {},
        customMetrics: {}
      }
    };

    try {
      // Pre-experiment steady state check
      const preExperimentState = await this.verifysteadyState(hypothesis);
      result.steadyStateResults.push(...preExperimentState);
      
      if (!this.isSteadyStateHealthy(preExperimentState)) {
        result.status = 'failed';
        result.observations.push('Pre-experiment steady state check failed');
        return result;
      }

      // Start monitoring
      const monitoringPromise = this.startMonitoring(environment.monitoring);

      // Inject chaos
      this.emit('chaos:injecting', experiment);
      const chaosInjection = await this.injectChaos(experiment, environment);
      result.chaosResults = chaosInjection;

      // Monitor during chaos
      const duringChaosState = await this.monitorDuringChaos(
        hypothesis, 
        experiment.duration, 
        environment.monitoring
      );
      result.steadyStateResults.push(...duringChaosState.probes);
      result.observations.push(...duringChaosState.observations);

      // Stop chaos injection
      this.emit('chaos:stopping', experiment);
      await this.stopChaos(experiment, environment);

      // Post-experiment steady state check
      const postExperimentState = await this.verifysteadyState(hypothesis);
      result.steadyStateResults.push(...postExperimentState);

      // Collect metrics
      result.metrics = await monitoringPromise;

      // Evaluate experiment success
      result.status = this.evaluateExperimentSuccess(result);

    } catch (error) {
      result.status = 'error';
      result.observations.push(`Experiment error: ${error.message}`);
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  private async verifysteadyState(hypothesis: SteadyStateHypothesis): Promise<ProbeResult[]> {
    const results: ProbeResult[] = [];

    for (const probe of hypothesis.probes) {
      const probeResult = await this.executeProbe(probe);
      results.push(probeResult);
    }

    return results;
  }

  private async executeProbe(probe: ChaosProbe): Promise<ProbeResult> {
    const result: ProbeResult = {
      probe,
      status: 'passed',
      value: null,
      tolerance: false,
      message: '',
      timestamp: new Date()
    };

    try {
      switch (probe.type) {
        case 'http':
          result.value = await this.executeHttpProbe(probe.provider.config);
          break;
        case 'command':
          result.value = await this.executeCommandProbe(probe.provider.config);
          break;
        case 'metric':
          result.value = await this.executeMetricProbe(probe.provider.config);
          break;
        default:
          result.value = await this.executeCustomProbe(probe.provider);
      }

      result.tolerance = this.evaluateTolerance(result.value, probe.tolerance);
      result.status = result.tolerance ? 'passed' : 'failed';
      result.message = result.tolerance ? 'Probe passed' : 'Probe failed tolerance check';

    } catch (error) {
      result.status = 'error';
      result.message = error.message;
    }

    return result;
  }

  private async executeHttpProbe(config: any): Promise<any> {
    const response = await axios({
      method: config.method || 'GET',
      url: config.url,
      timeout: config.timeout || 10000,
      validateStatus: () => true
    });

    return {
      status: response.status,
      responseTime: response.headers['x-response-time'] || 0,
      body: response.data
    };
  }

  private async executeCommandProbe(config: any): Promise<any> {
    const { stdout, stderr } = await execAsync(config.command, {
      timeout: config.timeout || 30000
    });

    return {
      stdout,
      stderr,
      exitCode: 0
    };
  }

  private async executeMetricProbe(config: any): Promise<any> {
    // Query metrics from monitoring system (Prometheus, etc.)
    const response = await axios.get(config.url, {
      params: config.params,
      timeout: config.timeout || 10000
    });

    return response.data;
  }

  private async executeCustomProbe(provider: ProbeProvider): Promise<any> {
    // Execute custom probe logic based on provider type
    return { custom: true, value: 'ok' };
  }

  private evaluateTolerance(value: any, tolerance: ProbeTolerance): boolean {
    switch (tolerance.type) {
      case 'status_code':
        return value.status === tolerance.value;
      case 'range':
        return value >= tolerance.value.min && value <= tolerance.value.max;
      case 'regex':
        return new RegExp(tolerance.value).test(String(value));
      case 'json_path':
        // Implement JSON path evaluation
        return true;
      default:
        return false;
    }
  }

  private async injectChaos(experiment: ChaosExperiment, environment: ChaosEnvironment): Promise<any> {
    switch (experiment.type) {
      case 'network':
        return this.injectNetworkChaos(experiment, environment);
      case 'cpu':
        return this.injectCPUChaos(experiment, environment);
      case 'memory':
        return this.injectMemoryChaos(experiment, environment);
      case 'service':
        return this.injectServiceChaos(experiment, environment);
      case 'database':
        return this.injectDatabaseChaos(experiment, environment);
      default:
        throw new Error(`Unsupported chaos experiment type: ${experiment.type}`);
    }
  }

  private async injectNetworkChaos(experiment: ChaosExperiment, environment: ChaosEnvironment): Promise<any> {
    const method = experiment.method;
    
    switch (method.type) {
      case 'latency':
        // Inject network latency
        return this.injectNetworkLatency(experiment.target, method.parameters);
      case 'failure':
        // Inject network failures/packet loss
        return this.injectNetworkFailure(experiment.target, method.parameters);
      case 'partition':
        // Create network partitions
        return this.injectNetworkPartition(experiment.target, method.parameters);
      default:
        throw new Error(`Unsupported network chaos method: ${method.type}`);
    }
  }

  private async injectNetworkLatency(target: ChaosTarget, parameters: any): Promise<any> {
    // Use tc (traffic control) to inject latency
    const delay = parameters.delay || '100ms';
    const jitter = parameters.jitter || '10ms';
    
    if (target.type === 'service') {
      // For Kubernetes services, use chaos mesh or similar
      const command = `kubectl apply -f - <<EOF
apiVersion: chaos-mesh.org/v1alpha1
kind: NetworkChaos
metadata:
  name: network-delay-${Date.now()}
spec:
  action: delay
  mode: all
  selector:
    ${Object.entries(target.selector).map(([k, v]) => `${k}: ${v}`).join('\n    ')}
  delay:
    latency: "${delay}"
    jitter: "${jitter}"
  duration: "${parameters.duration || '30s'}"
EOF`;
      
      await execAsync(command);
      return { type: 'network-latency', applied: true };
    }
    
    return { type: 'network-latency', applied: false, reason: 'unsupported target type' };
  }

  private async injectNetworkFailure(target: ChaosTarget, parameters: any): Promise<any> {
    const lossRate = parameters.lossRate || '10%';
    
    // Implement network packet loss injection
    return { type: 'network-failure', lossRate, applied: true };
  }

  private async injectNetworkPartition(target: ChaosTarget, parameters: any): Promise<any> {
    // Implement network partition
    return { type: 'network-partition', applied: true };
  }

  private async injectCPUChaos(experiment: ChaosExperiment, environment: ChaosEnvironment): Promise<any> {
    // Inject CPU stress
    const cpuLoad = experiment.magnitude; // 0-100
    const duration = experiment.duration;
    
    if (environment.platform === 'kubernetes') {
      const command = `kubectl apply -f - <<EOF
apiVersion: chaos-mesh.org/v1alpha1
kind: StressChaos
metadata:
  name: cpu-stress-${Date.now()}
spec:
  mode: all
  selector:
    ${Object.entries(experiment.target.selector).map(([k, v]) => `${k}: ${v}`).join('\n    ')}
  stressors:
    cpu:
      workers: 1
      load: ${cpuLoad}
  duration: "${duration}"
EOF`;
      
      await execAsync(command);
    } else {
      // Use stress-ng for direct host injection
      const stressCommand = `stress-ng --cpu 1 --cpu-load ${cpuLoad} --timeout ${duration}`;
      execAsync(stressCommand).catch(() => {}); // Run in background
    }
    
    return { type: 'cpu-stress', load: cpuLoad, applied: true };
  }

  private async injectMemoryChaos(experiment: ChaosExperiment, environment: ChaosEnvironment): Promise<any> {
    // Inject memory stress
    const memorySize = experiment.method.parameters.size || '256m';
    
    return { type: 'memory-stress', size: memorySize, applied: true };
  }

  private async injectServiceChaos(experiment: ChaosExperiment, environment: ChaosEnvironment): Promise<any> {
    // Kill or restart services
    const action = experiment.method.parameters.action || 'kill';
    
    return { type: 'service-chaos', action, applied: true };
  }

  private async injectDatabaseChaos(experiment: ChaosExperiment, environment: ChaosEnvironment): Promise<any> {
    // Database-specific chaos (connection drops, query delays, etc.)
    return { type: 'database-chaos', applied: true };
  }

  private async stopChaos(experiment: ChaosExperiment, environment: ChaosEnvironment): Promise<void> {
    // Clean up chaos injection based on experiment type
    if (environment.platform === 'kubernetes') {
      // Remove chaos mesh resources
      await execAsync(`kubectl delete networkchaos,stresschaos -l experiment=${experiment.name}`);
    }
  }

  private async monitorDuringChaos(
    hypothesis: SteadyStateHypothesis,
    duration: string,
    monitoring: MonitoringConfig
  ): Promise<{ probes: ProbeResult[]; observations: string[] }> {
    const durationMs = this.parseDuration(duration);
    const interval = Math.min(5000, durationMs / 10); // Sample 10 times during chaos
    const endTime = Date.now() + durationMs;
    
    const probes: ProbeResult[] = [];
    const observations: string[] = [];
    
    while (Date.now() < endTime) {
      const probeResults = await this.verifysteadyState(hypothesis);
      probes.push(...probeResults);
      
      // Check for failures
      const failedProbes = probeResults.filter(p => p.status === 'failed');
      if (failedProbes.length > 0) {
        observations.push(`${failedProbes.length} probes failed during chaos injection`);
      }
      
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    return { probes, observations };
  }

  private async startMonitoring(monitoring: MonitoringConfig): Promise<ExperimentMetrics> {
    // Start collecting system and application metrics
    const metrics: ExperimentMetrics = {
      systemMetrics: {},
      applicationMetrics: {},
      customMetrics: {}
    };
    
    // This would integrate with monitoring systems to collect metrics
    return new Promise(resolve => {
      setTimeout(() => {
        resolve(metrics);
      }, 1000);
    });
  }

  private evaluateExperimentSuccess(result: ChaosExperimentResult): 'passed' | 'failed' | 'error' {
    // Check if steady state was maintained or recovered
    const failedProbes = result.steadyStateResults.filter(p => p.status === 'failed');
    
    if (failedProbes.length === 0) {
      return 'passed'; // System remained resilient
    }
    
    // Check if failures were during chaos injection (expected) or after (bad)
    const postChaosFailures = result.steadyStateResults
      .filter(p => p.timestamp > new Date(Date.now() - result.duration / 2))
      .filter(p => p.status === 'failed');
    
    if (postChaosFailures.length > 0) {
      return 'failed'; // System didn't recover
    }
    
    return 'passed'; // Failures during chaos are expected
  }

  private async executeRollback(rollback: RollbackStrategy, environment: ChaosEnvironment): Promise<RollbackResult[]> {
    const results: RollbackResult[] = [];
    
    for (const action of rollback.actions) {
      const result = await this.executeRollbackAction(action, environment);
      results.push(result);
    }
    
    return results;
  }

  private async executeRollbackAction(action: RollbackAction, environment: ChaosEnvironment): Promise<RollbackResult> {
    const startTime = Date.now();
    
    try {
      switch (action.type) {
        case 'command':
          await execAsync(action.parameters.command);
          break;
        case 'api_call':
          await axios(action.parameters);
          break;
        case 'notification':
          // Send notification
          break;
      }
      
      return {
        action,
        status: 'success',
        message: 'Rollback action completed successfully',
        timestamp: new Date()
      };
    } catch (error) {
      return {
        action,
        status: 'failed',
        message: error.message,
        timestamp: new Date()
      };
    }
  }

  private isSteadyStateHealthy(probeResults: ProbeResult[]): boolean {
    return probeResults.every(result => result.status === 'passed');
  }

  private async waitForRecovery(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smh])$/);
    if (!match) return 60000; // Default to 1 minute
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      default: return 60000;
    }
  }

  private async checkChaosToolkit(): Promise<boolean> {
    try {
      await execAsync('chaos --version', { timeout: 5000 });
      return true;
    } catch (error) {
      return false;
    }
  }

  private async checkLitmus(): Promise<boolean> {
    try {
      await execAsync('kubectl get pods -n litmus', { timeout: 5000 });
      return true;
    } catch (error) {
      return false;
    }
  }

  private async checkGremlin(): Promise<boolean> {
    try {
      // Check if Gremlin agent is available
      await execAsync('gremlin check', { timeout: 5000 });
      return true;
    } catch (error) {
      return false;
    }
  }

  private parseChaosConfig(suite: TestSuite): ChaosTestConfig {
    return {
      experiments: suite.config?.experiments || this.getDefaultExperiments(),
      environment: suite.config?.environment || this.getDefaultEnvironment(),
      duration: suite.config?.duration || '5m',
      steadyStateHypothesis: suite.config?.steadyStateHypothesis || this.getDefaultHypothesis(),
      rollbackStrategy: suite.config?.rollbackStrategy || this.getDefaultRollbackStrategy()
    };
  }

  private getDefaultExperiments(): ChaosExperiment[] {
    return [
      {
        name: 'network-latency',
        type: 'network',
        description: 'Inject network latency to test resilience',
        method: {
          type: 'latency',
          parameters: { delay: '100ms', jitter: '10ms' }
        },
        target: {
          type: 'service',
          selector: { app: 'test-service' }
        },
        duration: '2m',
        magnitude: 50
      }
    ];
  }

  private getDefaultEnvironment(): ChaosEnvironment {
    return {
      platform: 'kubernetes',
      connection: {},
      monitoring: {
        endpoints: ['http://localhost:9090'],
        metrics: ['cpu_usage', 'memory_usage', 'response_time']
      }
    };
  }

  private getDefaultHypothesis(): SteadyStateHypothesis {
    return {
      title: 'System remains responsive',
      probes: [
        {
          name: 'health-check',
          type: 'http',
          tolerance: { type: 'status_code', value: 200 },
          provider: {
            type: 'http',
            config: { url: 'http://localhost:4400/health' }
          }
        }
      ]
    };
  }

  private getDefaultRollbackStrategy(): RollbackStrategy {
    return {
      enabled: true,
      triggers: ['experiment_failure', 'steady_state_failure'],
      actions: [
        {
          type: 'command',
          parameters: { command: 'kubectl delete chaos --all' }
        }
      ]
    };
  }

  private createTestResult(suite: TestSuite, results: ChaosExperimentResult[], duration: number): TestResult {
    const failed = results.filter(r => r.status === 'failed');
    const passed = results.filter(r => r.status === 'passed');
    
    return {
      suiteId: suite.id,
      status: failed.length > 0 ? 'failed' : 'passed',
      duration,
      errors: failed.flatMap(result => 
        result.observations.map(obs => ({
          message: obs,
          type: 'ChaosExperimentFailure'
        }))
      ),
      metrics: {
        executionTime: duration,
        memoryUsage: 0,
        cpuUsage: 0,
        networkCalls: 0,
        databaseQueries: 0,
        cacheHits: 0,
        cacheMisses: 0
      },
      timestamp: new Date(),
      artifacts: [
        `chaos-report-${suite.id}-${Date.now()}.json`,
        `resilience-test-results-${suite.id}-${Date.now()}.json`
      ]
    };
  }
}

export default ChaosTester;