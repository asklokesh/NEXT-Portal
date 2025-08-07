import { EventEmitter } from 'events';
import { Logger } from 'pino';
import { z } from 'zod';

export enum ChaosExperimentType {
  CPU_STRESS = 'CPU_STRESS',
  MEMORY_HOG = 'MEMORY_HOG',
  LATENCY = 'LATENCY',
  PACKET_LOSS = 'PACKET_LOSS',
  NETWORK_PARTITION = 'NETWORK_PARTITION',
  DISK_FILL = 'DISK_FILL',
  PROCESS_KILL = 'PROCESS_KILL',
  SERVICE_STOP = 'SERVICE_STOP',
}

export enum ChaosExperimentStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  ROLLING_BACK = 'ROLLING_BACK',
  ROLLED_BACK = 'ROLLED_BACK',
}

export const ChaosExperimentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  type: z.nativeEnum(ChaosExperimentType),
  duration: z.number().positive(), // seconds
  target: z.string(), // e.g., service name, pod name, IP address
  parameters: z.record(z.any()).optional(), // type-specific parameters
  status: z.nativeEnum(ChaosExperimentStatus).default(ChaosExperimentStatus.PENDING),
  startTime: z.date().optional(),
  endTime: z.date().optional(),
  results: z.record(z.any()).optional(),
  rollbackPlan: z.array(z.string()).optional(),
  metricsBefore: z.record(z.any()).optional(),
  metricsAfter: z.record(z.any()).optional(),
});

export type ChaosExperiment = z.infer<typeof ChaosExperimentSchema>;

export class ChaosPlatform extends EventEmitter {
  private experiments: Map<string, ChaosExperiment> = new Map();
  private activeExperiments: Set<string> = new Set();

  constructor(private logger: Logger) {
    super();
  }

  async runExperiment(experimentData: Omit<ChaosExperiment, 'id' | 'status' | 'startTime' | 'endTime' | 'results'>): Promise<ChaosExperiment> {
    const experiment = ChaosExperimentSchema.parse({
      id: crypto.randomUUID(),
      ...experimentData,
      status: ChaosExperimentStatus.PENDING,
      startTime: new Date(),
    });
    this.experiments.set(experiment.id, experiment);
    this.activeExperiments.add(experiment.id);

    this.logger.info(`Running chaos experiment: ${experiment.id} - ${experiment.name}`);
    this.emit('experimentStarted', experiment);

    try {
      // 1. Collect baseline metrics
      experiment.metricsBefore = await this.collectMetrics(experiment.target);

      // 2. Execute the experiment
      experiment.status = ChaosExperimentStatus.RUNNING;
      await this.executeChaosAction(experiment);

      // 3. Wait for the duration
      await new Promise(resolve => setTimeout(resolve, experiment.duration * 1000));

      // 4. Collect post-experiment metrics
      experiment.metricsAfter = await this.collectMetrics(experiment.target);

      // 5. Analyze results (simplified)
      experiment.results = { success: true, message: 'Experiment completed successfully' };
      experiment.status = ChaosExperimentStatus.COMPLETED;

      this.logger.info(`Chaos experiment finished: ${experiment.id} - ${experiment.name}`);
      this.emit('experimentFinished', experiment);

    } catch (error) {
      this.logger.error(`Chaos experiment failed: ${experiment.id} - ${experiment.name}`, error);
      experiment.status = ChaosExperimentStatus.FAILED;
      experiment.results = { success: false, message: error.message };
      this.emit('experimentFailed', experiment);

      // Attempt rollback on failure
      if (experiment.rollbackPlan && experiment.rollbackPlan.length > 0) {
        await this.rollbackExperiment(experiment);
      }

    } finally {
      experiment.endTime = new Date();
      this.activeExperiments.delete(experiment.id);
    }

    return experiment;
  }

  async getExperiment(id: string): Promise<ChaosExperiment | undefined> {
    return this.experiments.get(id);
  }

  getActiveExperiments(): ChaosExperiment[] {
    return Array.from(this.activeExperiments).map(id => this.experiments.get(id)!);
  }

  private async executeChaosAction(experiment: ChaosExperiment): Promise<void> {
    this.logger.info(`Executing chaos action ${experiment.type} on ${experiment.target}`);
    // This is where actual chaos injection would happen (e.g., calling a chaos agent)
    switch (experiment.type) {
      case ChaosExperimentType.CPU_STRESS:
        // Simulate CPU stress
        break;
      case ChaosExperimentType.LATENCY:
        // Simulate network latency
        break;
      case ChaosExperimentType.PACKET_LOSS:
        // Simulate packet loss
        break;
      case ChaosExperimentType.MEMORY_HOG:
        // Simulate memory consumption
        break;
      case ChaosExperimentType.NETWORK_PARTITION:
        // Simulate network partition
        break;
      case ChaosExperimentType.DISK_FILL:
        // Simulate disk filling
        break;
      case ChaosExperimentType.PROCESS_KILL:
        // Simulate process termination
        break;
      case ChaosExperimentType.SERVICE_STOP:
        // Simulate service stop
        break;
      default:
        throw new Error(`Unknown chaos experiment type: ${experiment.type}`);
    }
    // Simulate some delay for the action to take effect
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  private async rollbackExperiment(experiment: ChaosExperiment): Promise<void> {
    this.logger.warn(`Attempting rollback for failed experiment: ${experiment.id}`);
    experiment.status = ChaosExperimentStatus.ROLLING_BACK;
    this.emit('experimentRollingBack', experiment);

    try {
      for (const step of experiment.rollbackPlan || []) {
        this.logger.info(`Executing rollback step: ${step}`);
        // Execute rollback command/action
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate rollback action
      }
      experiment.status = ChaosExperimentStatus.ROLLED_BACK;
      this.logger.info(`Rollback completed for experiment: ${experiment.id}`);
      this.emit('experimentRolledBack', experiment);
    } catch (rollbackError) {
      this.logger.error(`Rollback failed for experiment: ${experiment.id}`, rollbackError);
      // If rollback fails, the experiment remains in FAILED state, or a new status could be introduced
    }
  }

  private async collectMetrics(target: string): Promise<Record<string, any>> {
    // In a real scenario, this would integrate with a monitoring system (e.g., Prometheus, Datadog)
    // to collect relevant metrics (CPU, memory, network, error rates, etc.) for the target.
    this.logger.debug(`Collecting metrics for target: ${target}`);
    return {
      cpu_usage: Math.random() * 100,
      memory_usage: Math.random() * 1024,
      network_latency: Math.random() * 50,
      error_rate: Math.random() * 5,
    };
  }

  // Pre-defined experiment templates
  static getExperimentTemplates(): Omit<ChaosExperiment, 'id' | 'status' | 'startTime' | 'endTime' | 'results'>[] {
    return [
      {
        name: 'High CPU Stress',
        description: 'Injects high CPU load on a target service.',
        type: ChaosExperimentType.CPU_STRESS,
        duration: 60,
        target: 'my-service-1',
        parameters: { cores: 2, load: 0.8 },
        rollbackPlan: ['reduce_cpu_load'],
      },
      {
        name: 'Network Latency Injection',
        description: 'Introduces network latency to a target service.',
        type: ChaosExperimentType.LATENCY,
        duration: 30,
        target: 'my-service-2',
        parameters: { delay_ms: 200, jitter_ms: 50 },
        rollbackPlan: ['remove_network_latency'],
      },
      {
        name: 'Service Process Kill',
        description: 'Randomly kills a process of a target service.',
        type: ChaosExperimentType.PROCESS_KILL,
        duration: 10,
        target: 'my-service-3',
        parameters: { process_name: 'node' },
        rollbackPlan: ['restart_service_process'],
      },
    ];
  }
}
