import { EventEmitter } from 'events';
import { prisma } from '@/lib/prisma';
import { PipelineEngine } from './pipeline-engine';

interface ETLJob {
  id: string;
  name: string;
  description: string;
  pipelineId: string;
  schedule: {
    type: 'cron' | 'event' | 'manual';
    expression?: string;
    dependencies?: string[];
  };
  priority: 'low' | 'medium' | 'high' | 'critical';
  retryPolicy: {
    maxAttempts: number;
    backoffStrategy: 'linear' | 'exponential';
    baseDelay: number;
  };
  resources: {
    cpu: number;
    memory: number;
    maxDuration: number;
  };
  tags: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface JobExecution {
  id: string;
  jobId: string;
  pipelineExecutionId: string;
  status: 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  startTime?: Date;
  endTime?: Date;
  resources: {
    cpuUsed: number;
    memoryUsed: number;
    duration: number;
  };
  attempts: number;
  errors: any[];
  metrics: {
    recordsProcessed: number;
    throughput: number;
    cost: number;
  };
}

interface ResourcePool {
  id: string;
  type: 'cpu' | 'memory' | 'storage';
  total: number;
  available: number;
  allocated: Map<string, number>;
  reservations: Array<{
    jobId: string;
    amount: number;
    timestamp: Date;
  }>;
}

export class ETLOrchestrator extends EventEmitter {
  private jobs: Map<string, ETLJob> = new Map();
  private executions: Map<string, JobExecution> = new Map();
  private resourcePools: Map<string, ResourcePool> = new Map();
  private queue: JobExecution[] = [];
  private runningJobs: Map<string, JobExecution> = new Map();
  private scheduledJobs: Map<string, NodeJS.Timeout> = new Map();
  private pipelineEngine: PipelineEngine;

  constructor(pipelineEngine: PipelineEngine) {
    super();
    this.pipelineEngine = pipelineEngine;
    this.initializeResourcePools();
    this.startScheduler();
    this.startExecutor();
    this.startResourceMonitor();
  }

  private initializeResourcePools() {
    this.resourcePools.set('cpu', {
      id: 'cpu',
      type: 'cpu',
      total: 16,
      available: 16,
      allocated: new Map(),
      reservations: []
    });

    this.resourcePools.set('memory', {
      id: 'memory',
      type: 'memory',
      total: 64,
      available: 64,
      allocated: new Map(),
      reservations: []
    });

    this.resourcePools.set('storage', {
      id: 'storage',
      type: 'storage',
      total: 1000,
      available: 1000,
      allocated: new Map(),
      reservations: []
    });
  }

  async createJob(job: Omit<ETLJob, 'id' | 'createdAt' | 'updatedAt'>): Promise<ETLJob> {
    const newJob: ETLJob = {
      ...job,
      id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.validateJob(newJob);
    this.jobs.set(newJob.id, newJob);
    await this.persistJob(newJob);

    if (newJob.isActive) {
      this.scheduleJob(newJob);
    }

    this.emit('job-created', newJob);
    return newJob;
  }

  private async validateJob(job: ETLJob): Promise<void> {
    const errors = [];

    if (!job.pipelineId) {
      errors.push('Job must reference a pipeline');
    }

    if (job.resources.cpu <= 0 || job.resources.memory <= 0) {
      errors.push('Job must specify positive resource requirements');
    }

    if (job.schedule.type === 'cron' && !job.schedule.expression) {
      errors.push('Cron jobs must specify expression');
    }

    if (errors.length > 0) {
      throw new Error(`Job validation failed: ${errors.join(', ')}`);
    }
  }

  private scheduleJob(job: ETLJob) {
    if (job.schedule.type === 'cron' && job.schedule.expression) {
      const cronJob = this.createCronJob(job.schedule.expression, () => {
        this.executeJob(job.id);
      });
      
      this.scheduledJobs.set(job.id, cronJob);
    }
  }

  private createCronJob(expression: string, callback: () => void): NodeJS.Timeout {
    return setInterval(callback, this.parseCronInterval(expression));
  }

  private parseCronInterval(expression: string): number {
    return 60 * 1000;
  }

  async executeJob(
    jobId: string,
    options: {
      priority?: number;
      context?: any;
    } = {}
  ): Promise<JobExecution> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (!job.isActive) {
      throw new Error(`Job ${jobId} is not active`);
    }

    const canExecute = await this.checkDependencies(job);
    if (!canExecute) {
      throw new Error(`Job dependencies not satisfied`);
    }

    const execution: JobExecution = {
      id: `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      jobId,
      pipelineExecutionId: '',
      status: 'queued',
      priority: options.priority || this.calculatePriority(job),
      resources: {
        cpuUsed: 0,
        memoryUsed: 0,
        duration: 0
      },
      attempts: 0,
      errors: [],
      metrics: {
        recordsProcessed: 0,
        throughput: 0,
        cost: 0
      }
    };

    this.executions.set(execution.id, execution);
    this.addToQueue(execution);

    this.emit('job-queued', execution);
    return execution;
  }

  private async checkDependencies(job: ETLJob): Promise<boolean> {
    if (!job.schedule.dependencies || job.schedule.dependencies.length === 0) {
      return true;
    }

    for (const depJobId of job.schedule.dependencies) {
      const lastExecution = await this.getLastExecution(depJobId);
      if (!lastExecution || lastExecution.status !== 'completed') {
        return false;
      }

      const timeSinceCompletion = Date.now() - (lastExecution.endTime?.getTime() || 0);
      if (timeSinceCompletion > 24 * 60 * 60 * 1000) {
        return false;
      }
    }

    return true;
  }

  private async getLastExecution(jobId: string): Promise<JobExecution | null> {
    const executions = Array.from(this.executions.values())
      .filter(e => e.jobId === jobId)
      .sort((a, b) => (b.startTime?.getTime() || 0) - (a.startTime?.getTime() || 0));

    return executions[0] || null;
  }

  private calculatePriority(job: ETLJob): number {
    const basePriority = {
      'critical': 1000,
      'high': 750,
      'medium': 500,
      'low': 250
    }[job.priority];

    const agingFactor = Math.floor((Date.now() - job.createdAt.getTime()) / (60 * 1000));
    return basePriority + agingFactor;
  }

  private addToQueue(execution: JobExecution) {
    this.queue.push(execution);
    this.queue.sort((a, b) => b.priority - a.priority);
    this.processQueue();
  }

  private async processQueue() {
    while (this.queue.length > 0 && this.canProcessNext()) {
      const execution = this.queue.shift()!;
      await this.startExecution(execution);
    }
  }

  private canProcessNext(): boolean {
    const maxConcurrent = 5;
    return this.runningJobs.size < maxConcurrent;
  }

  private async startExecution(execution: JobExecution) {
    const job = this.jobs.get(execution.jobId)!;
    
    const resourcesAllocated = await this.allocateResources(execution.id, job.resources);
    if (!resourcesAllocated) {
      this.addToQueue(execution);
      return;
    }

    execution.status = 'running';
    execution.startTime = new Date();
    execution.attempts++;
    
    this.runningJobs.set(execution.id, execution);

    try {
      const pipelineExecution = await this.pipelineEngine.executePipeline(job.pipelineId);
      execution.pipelineExecutionId = pipelineExecution.id;

      await this.monitorExecution(execution, job);

      execution.status = 'completed';
      execution.endTime = new Date();
      execution.resources.duration = execution.endTime.getTime() - execution.startTime.getTime();

      this.emit('job-completed', execution);
    } catch (error: any) {
      await this.handleExecutionError(execution, job, error);
    } finally {
      this.runningJobs.delete(execution.id);
      await this.releaseResources(execution.id);
      await this.persistExecution(execution);
      this.processQueue();
    }
  }

  private async allocateResources(
    executionId: string,
    requirements: { cpu: number; memory: number; maxDuration: number }
  ): Promise<boolean> {
    const cpuPool = this.resourcePools.get('cpu')!;
    const memoryPool = this.resourcePools.get('memory')!;

    if (cpuPool.available < requirements.cpu || memoryPool.available < requirements.memory) {
      return false;
    }

    cpuPool.available -= requirements.cpu;
    cpuPool.allocated.set(executionId, requirements.cpu);

    memoryPool.available -= requirements.memory;
    memoryPool.allocated.set(executionId, requirements.memory);

    return true;
  }

  private async releaseResources(executionId: string) {
    for (const pool of this.resourcePools.values()) {
      const allocated = pool.allocated.get(executionId) || 0;
      if (allocated > 0) {
        pool.available += allocated;
        pool.allocated.delete(executionId);
      }
    }
  }

  private async monitorExecution(execution: JobExecution, job: ETLJob) {
    const startTime = Date.now();
    const maxDuration = job.resources.maxDuration * 1000;

    const monitor = setInterval(() => {
      const elapsed = Date.now() - startTime;
      
      if (elapsed > maxDuration) {
        clearInterval(monitor);
        throw new Error('Job exceeded maximum duration');
      }

      execution.resources.cpuUsed = Math.random() * job.resources.cpu;
      execution.resources.memoryUsed = Math.random() * job.resources.memory;
      execution.resources.duration = elapsed;

      this.emit('job-progress', {
        executionId: execution.id,
        progress: Math.min(elapsed / maxDuration, 1),
        resources: execution.resources
      });
    }, 5000);

    return new Promise<void>((resolve) => {
      const cleanup = () => {
        clearInterval(monitor);
        resolve();
      };

      this.once(`job-completed-${execution.id}`, cleanup);
      this.once(`job-failed-${execution.id}`, cleanup);
    });
  }

  private async handleExecutionError(
    execution: JobExecution,
    job: ETLJob,
    error: Error
  ) {
    execution.errors.push({
      message: error.message,
      timestamp: new Date(),
      attempt: execution.attempts
    });

    if (execution.attempts < job.retryPolicy.maxAttempts) {
      const delay = this.calculateRetryDelay(execution.attempts, job.retryPolicy);
      
      setTimeout(() => {
        execution.status = 'queued';
        this.addToQueue(execution);
      }, delay);

      this.emit('job-retry-scheduled', {
        executionId: execution.id,
        attempt: execution.attempts,
        delay
      });
    } else {
      execution.status = 'failed';
      execution.endTime = new Date();
      
      this.emit('job-failed', execution);
      await this.handleJobFailure(execution, job);
    }
  }

  private calculateRetryDelay(attempt: number, retryPolicy: any): number {
    const baseDelay = retryPolicy.baseDelay || 1000;
    
    if (retryPolicy.backoffStrategy === 'exponential') {
      return baseDelay * Math.pow(2, attempt - 1);
    }
    
    return baseDelay * attempt;
  }

  private async handleJobFailure(execution: JobExecution, job: ETLJob) {
    await this.sendFailureAlert(execution, job);
    
    if (job.schedule.type === 'event') {
      job.isActive = false;
      await this.persistJob(job);
    }
  }

  private async sendFailureAlert(execution: JobExecution, job: ETLJob) {
    console.log(`Job ${job.name} (${execution.id}) failed after ${execution.attempts} attempts`);
  }

  async pauseJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    job.isActive = false;
    await this.persistJob(job);

    const scheduledJob = this.scheduledJobs.get(jobId);
    if (scheduledJob) {
      clearInterval(scheduledJob);
      this.scheduledJobs.delete(jobId);
    }

    const runningExecution = Array.from(this.runningJobs.values())
      .find(e => e.jobId === jobId);
    
    if (runningExecution) {
      await this.cancelExecution(runningExecution.id);
    }

    this.emit('job-paused', { jobId });
  }

  async resumeJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    job.isActive = true;
    await this.persistJob(job);
    
    this.scheduleJob(job);
    this.emit('job-resumed', { jobId });
  }

  async cancelExecution(executionId: string): Promise<void> {
    const execution = this.runningJobs.get(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not running`);
    }

    execution.status = 'cancelled';
    execution.endTime = new Date();
    
    this.runningJobs.delete(executionId);
    await this.releaseResources(executionId);
    await this.persistExecution(execution);

    this.emit('job-cancelled', execution);
    this.processQueue();
  }

  async getJobMetrics(jobId: string): Promise<any> {
    const executions = Array.from(this.executions.values())
      .filter(e => e.jobId === jobId)
      .sort((a, b) => (b.startTime?.getTime() || 0) - (a.startTime?.getTime() || 0));

    const recentExecutions = executions.slice(0, 30);
    
    const successRate = executions.length > 0
      ? executions.filter(e => e.status === 'completed').length / executions.length
      : 0;

    const avgDuration = recentExecutions
      .filter(e => e.resources.duration > 0)
      .reduce((sum, e) => sum + e.resources.duration, 0) / recentExecutions.length || 0;

    const avgThroughput = recentExecutions
      .filter(e => e.metrics.throughput > 0)
      .reduce((sum, e) => sum + e.metrics.throughput, 0) / recentExecutions.length || 0;

    const totalCost = recentExecutions
      .reduce((sum, e) => sum + e.metrics.cost, 0);

    return {
      totalExecutions: executions.length,
      successRate,
      avgDuration,
      avgThroughput,
      totalCost,
      recentExecutions: recentExecutions.slice(0, 10)
    };
  }

  async optimizeSchedule(): Promise<void> {
    const jobs = Array.from(this.jobs.values()).filter(j => j.isActive);
    const resourceUsageHistory = await this.getResourceUsageHistory();
    
    const optimization = this.calculateOptimalSchedule(jobs, resourceUsageHistory);
    
    for (const recommendation of optimization.recommendations) {
      await this.applyScheduleOptimization(recommendation);
    }

    this.emit('schedule-optimized', optimization);
  }

  private async getResourceUsageHistory(): Promise<any[]> {
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const executions = Array.from(this.executions.values())
      .filter(e => (e.startTime?.getTime() || 0) >= last30Days.getTime());

    return executions.map(e => ({
      timestamp: e.startTime,
      cpuUsed: e.resources.cpuUsed,
      memoryUsed: e.resources.memoryUsed,
      duration: e.resources.duration
    }));
  }

  private calculateOptimalSchedule(jobs: ETLJob[], history: any[]): any {
    const recommendations = [];
    
    const hourlyUsage = new Map<number, { cpu: number; memory: number }>();
    
    history.forEach(record => {
      const hour = new Date(record.timestamp).getHours();
      const current = hourlyUsage.get(hour) || { cpu: 0, memory: 0 };
      current.cpu += record.cpuUsed;
      current.memory += record.memoryUsed;
      hourlyUsage.set(hour, current);
    });

    const lowUsageHours = Array.from(hourlyUsage.entries())
      .filter(([hour, usage]) => usage.cpu < 2 && usage.memory < 8)
      .map(([hour]) => hour)
      .sort();

    for (const job of jobs) {
      if (job.priority === 'low' && lowUsageHours.length > 0) {
        const recommendedHour = lowUsageHours[0];
        recommendations.push({
          jobId: job.id,
          type: 'reschedule',
          recommendation: `Schedule during low usage hour: ${recommendedHour}:00`,
          expectedImprovement: 'Reduced resource contention'
        });
      }
    }

    return {
      recommendations,
      peakHours: Array.from(hourlyUsage.entries())
        .sort(([, a], [, b]) => (b.cpu + b.memory) - (a.cpu + a.memory))
        .slice(0, 5)
        .map(([hour]) => hour)
    };
  }

  private async applyScheduleOptimization(recommendation: any): Promise<void> {
    console.log(`Applying optimization for job ${recommendation.jobId}: ${recommendation.recommendation}`);
  }

  async createCheckpoint(executionId: string, data: any): Promise<void> {
    await prisma.etlCheckpoint.create({
      data: {
        executionId,
        checkpointData: data,
        timestamp: new Date()
      }
    });
  }

  async restoreFromCheckpoint(executionId: string): Promise<any> {
    const checkpoint = await prisma.etlCheckpoint.findFirst({
      where: { executionId },
      orderBy: { timestamp: 'desc' }
    });

    return checkpoint?.checkpointData;
  }

  async partitionData(
    data: any[],
    strategy: 'size' | 'time' | 'hash',
    options: any = {}
  ): Promise<any[][]> {
    switch (strategy) {
      case 'size':
        return this.partitionBySize(data, options.size || 1000);
      case 'time':
        return this.partitionByTime(data, options.field, options.interval);
      case 'hash':
        return this.partitionByHash(data, options.field, options.buckets || 4);
      default:
        return [data];
    }
  }

  private partitionBySize(data: any[], size: number): any[][] {
    const partitions = [];
    for (let i = 0; i < data.length; i += size) {
      partitions.push(data.slice(i, i + size));
    }
    return partitions;
  }

  private partitionByTime(data: any[], timeField: string, interval: number): any[][] {
    const partitions = new Map<number, any[]>();
    
    data.forEach(record => {
      const timestamp = new Date(record[timeField]).getTime();
      const partition = Math.floor(timestamp / interval);
      
      if (!partitions.has(partition)) {
        partitions.set(partition, []);
      }
      partitions.get(partition)!.push(record);
    });

    return Array.from(partitions.values());
  }

  private partitionByHash(data: any[], field: string, buckets: number): any[][] {
    const partitions: any[][] = Array(buckets).fill(null).map(() => []);
    
    data.forEach(record => {
      const hash = this.simpleHash(String(record[field]));
      const bucket = hash % buckets;
      partitions[bucket].push(record);
    });

    return partitions;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private startScheduler() {
    setInterval(() => {
      this.processScheduledJobs();
    }, 60000);
  }

  private processScheduledJobs() {
    for (const job of this.jobs.values()) {
      if (job.isActive && job.schedule.type === 'event') {
        this.checkEventTriggers(job);
      }
    }
  }

  private async checkEventTriggers(job: ETLJob) {
    const events = await prisma.etlEvent.findMany({
      where: {
        jobId: job.id,
        processed: false
      }
    });

    for (const event of events) {
      await this.executeJob(job.id, { context: event.data });
      
      await prisma.etlEvent.update({
        where: { id: event.id },
        data: { processed: true }
      });
    }
  }

  private startExecutor() {
    setInterval(() => {
      this.processQueue();
    }, 5000);
  }

  private startResourceMonitor() {
    setInterval(() => {
      this.monitorResources();
    }, 30000);
  }

  private monitorResources() {
    const usage = {
      timestamp: new Date(),
      pools: Array.from(this.resourcePools.values()).map(pool => ({
        type: pool.type,
        total: pool.total,
        available: pool.available,
        utilization: (pool.total - pool.available) / pool.total
      })),
      runningJobs: this.runningJobs.size,
      queuedJobs: this.queue.length
    };

    this.emit('resource-usage', usage);

    if (usage.pools.some(p => p.utilization > 0.9)) {
      this.emit('resource-pressure', usage);
    }
  }

  private async persistJob(job: ETLJob): Promise<void> {
    await prisma.etlJob.upsert({
      where: { id: job.id },
      update: {
        name: job.name,
        description: job.description,
        pipelineId: job.pipelineId,
        schedule: job.schedule,
        priority: job.priority,
        retryPolicy: job.retryPolicy,
        resources: job.resources,
        tags: job.tags,
        isActive: job.isActive,
        updatedAt: job.updatedAt
      },
      create: {
        id: job.id,
        name: job.name,
        description: job.description,
        pipelineId: job.pipelineId,
        schedule: job.schedule,
        priority: job.priority,
        retryPolicy: job.retryPolicy,
        resources: job.resources,
        tags: job.tags,
        isActive: job.isActive,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
      }
    });
  }

  private async persistExecution(execution: JobExecution): Promise<void> {
    await prisma.etlExecution.create({
      data: {
        id: execution.id,
        jobId: execution.jobId,
        pipelineExecutionId: execution.pipelineExecutionId,
        status: execution.status,
        priority: execution.priority,
        startTime: execution.startTime,
        endTime: execution.endTime,
        resources: execution.resources,
        attempts: execution.attempts,
        errors: execution.errors,
        metrics: execution.metrics
      }
    });
  }

  async getSystemStatus(): Promise<any> {
    return {
      jobs: {
        total: this.jobs.size,
        active: Array.from(this.jobs.values()).filter(j => j.isActive).length,
        inactive: Array.from(this.jobs.values()).filter(j => !j.isActive).length
      },
      executions: {
        running: this.runningJobs.size,
        queued: this.queue.length,
        total: this.executions.size
      },
      resources: Array.from(this.resourcePools.values()).map(pool => ({
        type: pool.type,
        utilization: ((pool.total - pool.available) / pool.total) * 100,
        available: pool.available,
        total: pool.total
      }))
    };
  }
}