/**
 * Pipeline Manager
 * Multi-stage deployment pipeline orchestration with approval gates and quality checks
 */

import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import {
  PipelineConfig,
  PipelineStage,
  PipelineTask,
  PipelineTrigger,
  ApprovalConfig,
  DeploymentEventEmitter,
  ArtifactConfig,
  RetryPolicy
} from './deployment-config';

export interface PipelineExecution {
  id: string;
  pipelineId: string;
  configVersion: string;
  status: PipelineExecutionStatus;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  triggeredBy: string;
  triggerType: string;
  stages: StageExecution[];
  artifacts: ExecutionArtifact[];
  variables: Record<string, any>;
  approvals: ApprovalExecution[];
  metrics: PipelineExecutionMetrics;
}

export type PipelineExecutionStatus = 
  | 'pending'
  | 'running'
  | 'waiting-approval'
  | 'paused'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'skipped';

export interface StageExecution {
  id: string;
  stageId: string;
  name: string;
  status: PipelineExecutionStatus;
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  tasks: TaskExecution[];
  approvals: ApprovalExecution[];
  conditions: StageCondition[];
  retryCount: number;
  maxRetries: number;
}

export interface TaskExecution {
  id: string;
  taskId: string;
  name: string;
  type: string;
  status: PipelineExecutionStatus;
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  logs: TaskLog[];
  artifacts: ExecutionArtifact[];
  retryCount: number;
  maxRetries: number;
  exitCode?: number;
  error?: string;
}

export interface TaskLog {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  source: string;
}

export interface ExecutionArtifact {
  name: string;
  type: string;
  location: string;
  size?: number;
  checksum?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface ApprovalExecution {
  id: string;
  approvalId: string;
  status: ApprovalStatus;
  requestedAt: Date;
  respondedAt?: Date;
  approver?: string;
  comments?: string;
  expiresAt?: Date;
}

export type ApprovalStatus = 
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'cancelled';

export interface StageCondition {
  type: string;
  status: 'True' | 'False' | 'Unknown';
  lastTransitionTime: Date;
  reason: string;
  message: string;
}

export interface PipelineExecutionMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  skippedTasks: number;
  averageTaskDuration: number;
  queueTime: number;
  executionTime: number;
  approvalTime?: number;
}

export interface PipelineMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  cancelledExecutions: number;
  averageExecutionTime: number;
  averageApprovalTime: number;
  successRate: number;
  failureRate: number;
  throughput: number;
  leadTime: number;
}

export interface QualityGate {
  id: string;
  name: string;
  type: QualityGateType;
  criteria: QualityGateCriteria[];
  required: boolean;
  timeout?: number;
}

export type QualityGateType = 
  | 'security-scan'
  | 'code-quality'
  | 'performance-test'
  | 'compliance-check'
  | 'custom';

export interface QualityGateCriteria {
  metric: string;
  operator: 'lt' | 'le' | 'gt' | 'ge' | 'eq' | 'ne';
  threshold: number;
  required: boolean;
}

export interface QualityGateResult {
  gateId: string;
  status: 'passed' | 'failed' | 'warning';
  score?: number;
  criteria: QualityGateCriteriaResult[];
  details?: Record<string, any>;
}

export interface QualityGateCriteriaResult {
  metric: string;
  value: number;
  threshold: number;
  status: 'passed' | 'failed' | 'warning';
  message?: string;
}

export class PipelineManager extends EventEmitter {
  private pipelines: Map<string, PipelineConfig> = new Map();
  private executions: Map<string, PipelineExecution> = new Map();
  private eventEmitter: DeploymentEventEmitter;
  private logger: any;
  private executionQueue: PipelineExecution[] = [];
  private runningExecutions: Map<string, PipelineExecution> = new Map();
  private metrics: PipelineMetrics = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    cancelledExecutions: 0,
    averageExecutionTime: 0,
    averageApprovalTime: 0,
    successRate: 0,
    failureRate: 0,
    throughput: 0,
    leadTime: 0
  };
  private qualityGates: Map<string, QualityGate> = new Map();
  private processingInterval: NodeJS.Timeout | null = null;
  private maxConcurrentExecutions: number;

  constructor(
    eventEmitter: DeploymentEventEmitter,
    maxConcurrentExecutions = 10,
    logger?: any
  ) {
    super();
    this.eventEmitter = eventEmitter;
    this.maxConcurrentExecutions = maxConcurrentExecutions;
    this.logger = logger || console;
    this.setupProcessingInterval();
  }

  /**
   * Register a pipeline configuration
   */
  async registerPipeline(config: PipelineConfig): Promise<void> {
    try {
      this.logger.info(`Registering pipeline: ${config.name} (${config.id})`);

      // Validate pipeline configuration
      await this.validatePipelineConfig(config);

      // Store pipeline configuration
      this.pipelines.set(config.id, config);

      this.eventEmitter.emitDeploymentEvent({
        id: this.generateEventId(),
        deploymentId: config.id,
        type: 'deployment-progressing',
        timestamp: new Date(),
        data: {
          phase: 'pipeline-registered',
          pipelineName: config.name,
          stageCount: config.stages.length
        },
        source: 'pipeline-manager'
      });

      this.logger.info(`Pipeline registered successfully: ${config.name}`);
    } catch (error) {
      this.logger.error(`Failed to register pipeline: ${config.name}`, error);
      throw error;
    }
  }

  /**
   * Execute a pipeline
   */
  async executePipeline(
    pipelineId: string,
    triggeredBy: string,
    triggerType: string,
    variables?: Record<string, any>
  ): Promise<string> {
    try {
      const config = this.pipelines.get(pipelineId);
      if (!config) {
        throw new Error(`Pipeline not found: ${pipelineId}`);
      }

      this.logger.info(`Executing pipeline: ${config.name} (${pipelineId})`);

      // Create pipeline execution
      const execution = await this.createPipelineExecution(
        config,
        triggeredBy,
        triggerType,
        variables
      );

      // Add to execution queue
      this.executionQueue.push(execution);

      this.eventEmitter.emitDeploymentEvent({
        id: this.generateEventId(),
        deploymentId: execution.id,
        type: 'deployment-started',
        timestamp: new Date(),
        data: {
          pipelineId,
          pipelineName: config.name,
          triggeredBy,
          triggerType,
          stageCount: config.stages.length
        },
        source: 'pipeline-manager'
      });

      this.logger.info(`Pipeline execution queued: ${execution.id}`);
      return execution.id;
    } catch (error) {
      this.logger.error(`Failed to execute pipeline: ${pipelineId}`, error);
      throw error;
    }
  }

  /**
   * Cancel a pipeline execution
   */
  async cancelExecution(executionId: string): Promise<void> {
    try {
      const execution = this.executions.get(executionId);
      if (!execution) {
        throw new Error(`Pipeline execution not found: ${executionId}`);
      }

      this.logger.info(`Cancelling pipeline execution: ${executionId}`);

      // Cancel running tasks
      await this.cancelRunningTasks(execution);

      // Update execution status
      execution.status = 'cancelled';
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();

      // Remove from running executions
      this.runningExecutions.delete(executionId);

      // Update metrics
      this.metrics.cancelledExecutions++;

      this.eventEmitter.emitDeploymentEvent({
        id: this.generateEventId(),
        deploymentId: executionId,
        type: 'deployment-failed',
        timestamp: new Date(),
        data: {
          phase: 'cancelled',
          duration: execution.duration,
          reason: 'user-cancelled'
        },
        source: 'pipeline-manager'
      });

      this.logger.info(`Pipeline execution cancelled: ${executionId}`);
    } catch (error) {
      this.logger.error(`Failed to cancel pipeline execution: ${executionId}`, error);
      throw error;
    }
  }

  /**
   * Pause a pipeline execution
   */
  async pauseExecution(executionId: string): Promise<void> {
    try {
      const execution = this.executions.get(executionId);
      if (!execution) {
        throw new Error(`Pipeline execution not found: ${executionId}`);
      }

      this.logger.info(`Pausing pipeline execution: ${executionId}`);

      execution.status = 'paused';

      this.eventEmitter.emitDeploymentEvent({
        id: this.generateEventId(),
        deploymentId: executionId,
        type: 'deployment-progressing',
        timestamp: new Date(),
        data: {
          phase: 'paused'
        },
        source: 'pipeline-manager'
      });

      this.logger.info(`Pipeline execution paused: ${executionId}`);
    } catch (error) {
      this.logger.error(`Failed to pause pipeline execution: ${executionId}`, error);
      throw error;
    }
  }

  /**
   * Resume a pipeline execution
   */
  async resumeExecution(executionId: string): Promise<void> {
    try {
      const execution = this.executions.get(executionId);
      if (!execution || execution.status !== 'paused') {
        throw new Error(`Cannot resume pipeline execution: ${executionId}`);
      }

      this.logger.info(`Resuming pipeline execution: ${executionId}`);

      execution.status = 'running';

      this.eventEmitter.emitDeploymentEvent({
        id: this.generateEventId(),
        deploymentId: executionId,
        type: 'deployment-progressing',
        timestamp: new Date(),
        data: {
          phase: 'resumed'
        },
        source: 'pipeline-manager'
      });

      this.logger.info(`Pipeline execution resumed: ${executionId}`);
    } catch (error) {
      this.logger.error(`Failed to resume pipeline execution: ${executionId}`, error);
      throw error;
    }
  }

  /**
   * Process approval request
   */
  async processApproval(
    executionId: string,
    approvalId: string,
    approved: boolean,
    approver: string,
    comments?: string
  ): Promise<void> {
    try {
      const execution = this.executions.get(executionId);
      if (!execution) {
        throw new Error(`Pipeline execution not found: ${executionId}`);
      }

      this.logger.info(`Processing approval: ${approvalId} for execution: ${executionId}`);

      // Find and update approval
      const approval = this.findApprovalExecution(execution, approvalId);
      if (!approval) {
        throw new Error(`Approval not found: ${approvalId}`);
      }

      approval.status = approved ? 'approved' : 'rejected';
      approval.respondedAt = new Date();
      approval.approver = approver;
      approval.comments = comments;

      // Update execution status if needed
      if (approved && execution.status === 'waiting-approval') {
        const allApprovalsComplete = this.checkAllApprovalsComplete(execution);
        if (allApprovalsComplete) {
          execution.status = 'running';
        }
      } else if (!approved) {
        execution.status = 'failed';
        execution.endTime = new Date();
        execution.duration = execution.endTime.getTime() - execution.startTime.getTime();
      }

      this.eventEmitter.emitDeploymentEvent({
        id: this.generateEventId(),
        deploymentId: executionId,
        type: approved ? 'approval-granted' : 'approval-denied',
        timestamp: new Date(),
        data: {
          approvalId,
          approver,
          comments,
          status: execution.status
        },
        source: 'pipeline-manager'
      });

      this.logger.info(`Approval processed: ${approvalId} - ${approved ? 'approved' : 'rejected'}`);
    } catch (error) {
      this.logger.error(`Failed to process approval: ${approvalId}`, error);
      throw error;
    }
  }

  /**
   * Register a quality gate
   */
  async registerQualityGate(qualityGate: QualityGate): Promise<void> {
    try {
      this.logger.info(`Registering quality gate: ${qualityGate.name} (${qualityGate.id})`);

      this.qualityGates.set(qualityGate.id, qualityGate);

      this.logger.info(`Quality gate registered: ${qualityGate.name}`);
    } catch (error) {
      this.logger.error(`Failed to register quality gate: ${qualityGate.name}`, error);
      throw error;
    }
  }

  /**
   * Get pipeline execution
   */
  getExecution(executionId: string): PipelineExecution | null {
    return this.executions.get(executionId) || null;
  }

  /**
   * Get pipeline executions by status
   */
  getExecutionsByStatus(status: PipelineExecutionStatus): PipelineExecution[] {
    return Array.from(this.executions.values()).filter(e => e.status === status);
  }

  /**
   * Get pipeline metrics
   */
  getMetrics(): PipelineMetrics {
    return { ...this.metrics };
  }

  /**
   * Get execution metrics
   */
  getExecutionMetrics(executionId: string): PipelineExecutionMetrics | null {
    const execution = this.executions.get(executionId);
    return execution ? execution.metrics : null;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    // Cancel all running executions
    for (const execution of this.runningExecutions.values()) {
      await this.cancelExecution(execution.id);
    }

    this.logger.info('Pipeline manager cleanup completed');
  }

  // Private methods

  private setupProcessingInterval(): void {
    this.processingInterval = setInterval(async () => {
      await this.processExecutionQueue();
      await this.monitorRunningExecutions();
    }, 5000); // 5 seconds
  }

  private async processExecutionQueue(): Promise<void> {
    while (
      this.executionQueue.length > 0 &&
      this.runningExecutions.size < this.maxConcurrentExecutions
    ) {
      const execution = this.executionQueue.shift()!;
      this.runningExecutions.set(execution.id, execution);

      // Start execution asynchronously
      this.startExecution(execution).catch(error => {
        this.logger.error(`Execution failed: ${execution.id}`, error);
      });
    }
  }

  private async monitorRunningExecutions(): Promise<void> {
    for (const execution of this.runningExecutions.values()) {
      try {
        await this.updateExecutionProgress(execution);
      } catch (error) {
        this.logger.error(`Failed to update execution progress: ${execution.id}`, error);
      }
    }
  }

  private async validatePipelineConfig(config: PipelineConfig): Promise<void> {
    // Validate basic structure
    if (!config.id) throw new Error('Pipeline ID is required');
    if (!config.name) throw new Error('Pipeline name is required');
    if (!config.stages || config.stages.length === 0) {
      throw new Error('At least one stage is required');
    }

    // Validate stage dependencies
    const stageIds = new Set(config.stages.map(s => s.id));
    for (const stage of config.stages) {
      if (stage.dependsOn) {
        for (const dependency of stage.dependsOn) {
          if (!stageIds.has(dependency)) {
            throw new Error(`Stage ${stage.id} depends on non-existent stage ${dependency}`);
          }
        }
      }
    }

    // Validate tasks
    for (const stage of config.stages) {
      if (!stage.tasks || stage.tasks.length === 0) {
        throw new Error(`Stage ${stage.id} must have at least one task`);
      }
    }
  }

  private async createPipelineExecution(
    config: PipelineConfig,
    triggeredBy: string,
    triggerType: string,
    variables?: Record<string, any>
  ): Promise<PipelineExecution> {
    const executionId = this.generateEventId();
    
    const execution: PipelineExecution = {
      id: executionId,
      pipelineId: config.id,
      configVersion: '1.0.0', // Would be derived from config versioning
      status: 'pending',
      startTime: new Date(),
      triggeredBy,
      triggerType,
      stages: this.createStageExecutions(config.stages),
      artifacts: [],
      variables: { ...config.variables, ...variables },
      approvals: [],
      metrics: {
        totalTasks: this.countTotalTasks(config.stages),
        completedTasks: 0,
        failedTasks: 0,
        skippedTasks: 0,
        averageTaskDuration: 0,
        queueTime: 0,
        executionTime: 0
      }
    };

    this.executions.set(executionId, execution);
    this.metrics.totalExecutions++;

    return execution;
  }

  private createStageExecutions(stages: PipelineStage[]): StageExecution[] {
    return stages.map(stage => ({
      id: this.generateEventId(),
      stageId: stage.id,
      name: stage.name,
      status: 'pending',
      tasks: stage.tasks.map(task => ({
        id: this.generateEventId(),
        taskId: task.id,
        name: task.name,
        type: task.type,
        status: 'pending',
        logs: [],
        artifacts: [],
        retryCount: 0,
        maxRetries: task.retryPolicy?.limit || 0
      })),
      approvals: stage.approvals ? stage.approvals.map(approval => ({
        id: this.generateEventId(),
        approvalId: approval.id,
        status: 'pending',
        requestedAt: new Date(),
        expiresAt: approval.timeout ? new Date(Date.now() + approval.timeout * 1000) : undefined
      })) : [],
      conditions: [],
      retryCount: 0,
      maxRetries: stage.retryPolicy?.limit || 0
    }));
  }

  private countTotalTasks(stages: PipelineStage[]): number {
    return stages.reduce((total, stage) => total + stage.tasks.length, 0);
  }

  private async startExecution(execution: PipelineExecution): Promise<void> {
    try {
      this.logger.info(`Starting pipeline execution: ${execution.id}`);

      execution.status = 'running';
      execution.startTime = new Date();

      // Execute stages in dependency order
      await this.executeStagesInOrder(execution);

      // Check final status
      const allStagesCompleted = execution.stages.every(s => 
        s.status === 'succeeded' || s.status === 'skipped'
      );

      if (allStagesCompleted) {
        execution.status = 'succeeded';
        this.metrics.successfulExecutions++;
      } else {
        execution.status = 'failed';
        this.metrics.failedExecutions++;
      }

      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();

      // Update metrics
      this.updateExecutionMetrics(execution);

      // Remove from running executions
      this.runningExecutions.delete(execution.id);

      this.eventEmitter.emitDeploymentEvent({
        id: this.generateEventId(),
        deploymentId: execution.id,
        type: execution.status === 'succeeded' ? 'deployment-succeeded' : 'deployment-failed',
        timestamp: new Date(),
        data: {
          status: execution.status,
          duration: execution.duration,
          stagesCompleted: execution.stages.filter(s => s.status === 'succeeded').length,
          totalStages: execution.stages.length
        },
        source: 'pipeline-manager'
      });

      this.logger.info(`Pipeline execution completed: ${execution.id} with status: ${execution.status}`);
    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();

      this.runningExecutions.delete(execution.id);
      this.metrics.failedExecutions++;

      this.logger.error(`Pipeline execution failed: ${execution.id}`, error);
      throw error;
    }
  }

  private async executeStagesInOrder(execution: PipelineExecution): Promise<void> {
    const config = this.pipelines.get(execution.pipelineId)!;
    const executedStages = new Set<string>();

    while (executedStages.size < execution.stages.length) {
      const readyStages = this.findReadyStages(config.stages, executedStages);
      
      if (readyStages.length === 0) {
        // No more stages can be executed
        break;
      }

      // Execute ready stages in parallel
      await Promise.all(readyStages.map(async stageConfig => {
        const stageExecution = execution.stages.find(s => s.stageId === stageConfig.id)!;
        
        try {
          await this.executeStage(execution, stageExecution, stageConfig);
          executedStages.add(stageConfig.id);
        } catch (error) {
          this.logger.error(`Stage execution failed: ${stageConfig.name}`, error);
        }
      }));
    }
  }

  private findReadyStages(stages: PipelineStage[], executedStages: Set<string>): PipelineStage[] {
    return stages.filter(stage => {
      // Skip already executed stages
      if (executedStages.has(stage.id)) return false;

      // Check if all dependencies are satisfied
      if (stage.dependsOn) {
        return stage.dependsOn.every(dep => executedStages.has(dep));
      }

      return true;
    });
  }

  private async executeStage(
    execution: PipelineExecution,
    stageExecution: StageExecution,
    stageConfig: PipelineStage
  ): Promise<void> {
    try {
      this.logger.info(`Executing stage: ${stageConfig.name} (${stageConfig.id})`);

      stageExecution.status = 'running';
      stageExecution.startTime = new Date();

      // Check stage condition
      if (stageConfig.condition && !this.evaluateCondition(stageConfig.condition, execution.variables)) {
        stageExecution.status = 'skipped';
        stageExecution.endTime = new Date();
        stageExecution.duration = stageExecution.endTime.getTime() - stageExecution.startTime.getTime();
        return;
      }

      // Request approvals if required
      if (stageConfig.approvals && stageConfig.approvals.length > 0) {
        await this.requestStageApprovals(execution, stageExecution, stageConfig.approvals);
        
        // Wait for approvals
        execution.status = 'waiting-approval';
        
        this.eventEmitter.emitDeploymentEvent({
          id: this.generateEventId(),
          deploymentId: execution.id,
          type: 'approval-required',
          timestamp: new Date(),
          data: {
            stageId: stageConfig.id,
            stageName: stageConfig.name,
            approvals: stageConfig.approvals.length
          },
          source: 'pipeline-manager'
        });

        return; // Will be resumed after approval
      }

      // Execute tasks
      for (const taskExecution of stageExecution.tasks) {
        const taskConfig = stageConfig.tasks.find(t => t.id === taskExecution.taskId)!;
        await this.executeTask(execution, stageExecution, taskExecution, taskConfig);
        
        if (taskExecution.status === 'failed') {
          throw new Error(`Task failed: ${taskConfig.name}`);
        }
      }

      // Run quality gates
      await this.runQualityGates(execution, stageExecution, stageConfig);

      stageExecution.status = 'succeeded';
      stageExecution.endTime = new Date();
      stageExecution.duration = stageExecution.endTime.getTime() - stageExecution.startTime.getTime();

      this.logger.info(`Stage completed: ${stageConfig.name}`);
    } catch (error) {
      stageExecution.status = 'failed';
      stageExecution.endTime = new Date();
      stageExecution.duration = stageExecution.startTime ? 
        stageExecution.endTime.getTime() - stageExecution.startTime.getTime() : 0;

      this.logger.error(`Stage failed: ${stageConfig.name}`, error);
      throw error;
    }
  }

  private async executeTask(
    execution: PipelineExecution,
    stageExecution: StageExecution,
    taskExecution: TaskExecution,
    taskConfig: PipelineTask
  ): Promise<void> {
    try {
      this.logger.info(`Executing task: ${taskConfig.name} (${taskConfig.type})`);

      taskExecution.status = 'running';
      taskExecution.startTime = new Date();

      // Execute based on task type
      switch (taskConfig.type) {
        case 'script':
          await this.executeScriptTask(execution, taskExecution, taskConfig);
          break;
        case 'docker-build':
          await this.executeDockerBuildTask(execution, taskExecution, taskConfig);
          break;
        case 'kubernetes-deploy':
          await this.executeKubernetesDeployTask(execution, taskExecution, taskConfig);
          break;
        case 'helm-deploy':
          await this.executeHelmDeployTask(execution, taskExecution, taskConfig);
          break;
        case 'security-scan':
          await this.executeSecurityScanTask(execution, taskExecution, taskConfig);
          break;
        case 'load-test':
          await this.executeLoadTestTask(execution, taskExecution, taskConfig);
          break;
        case 'notification':
          await this.executeNotificationTask(execution, taskExecution, taskConfig);
          break;
        default:
          throw new Error(`Unknown task type: ${taskConfig.type}`);
      }

      taskExecution.status = 'succeeded';
      taskExecution.endTime = new Date();
      taskExecution.duration = taskExecution.endTime.getTime() - taskExecution.startTime!.getTime();
      taskExecution.exitCode = 0;

      execution.metrics.completedTasks++;

      this.logger.info(`Task completed: ${taskConfig.name}`);
    } catch (error) {
      taskExecution.status = 'failed';
      taskExecution.endTime = new Date();
      taskExecution.duration = taskExecution.startTime ? 
        taskExecution.endTime.getTime() - taskExecution.startTime.getTime() : 0;
      taskExecution.exitCode = 1;
      taskExecution.error = error.message;

      execution.metrics.failedTasks++;

      // Log error
      taskExecution.logs.push({
        timestamp: new Date(),
        level: 'error',
        message: error.message,
        source: 'task-executor'
      });

      // Retry if configured
      if (taskExecution.retryCount < taskExecution.maxRetries) {
        taskExecution.retryCount++;
        this.logger.info(`Retrying task: ${taskConfig.name} (attempt ${taskExecution.retryCount})`);
        
        // Reset task state
        taskExecution.status = 'pending';
        taskExecution.error = undefined;
        
        // Wait before retry
        await this.sleep(this.getRetryDelay(taskConfig.retryPolicy, taskExecution.retryCount));
        
        // Retry execution
        await this.executeTask(execution, stageExecution, taskExecution, taskConfig);
        return;
      }

      this.logger.error(`Task failed: ${taskConfig.name}`, error);
      throw error;
    }
  }

  private async executeScriptTask(
    execution: PipelineExecution,
    taskExecution: TaskExecution,
    taskConfig: PipelineTask
  ): Promise<void> {
    // Mock implementation
    taskExecution.logs.push({
      timestamp: new Date(),
      level: 'info',
      message: `Executing script: ${taskConfig.config.script}`,
      source: 'script-executor'
    });

    // Simulate execution time
    await this.sleep(Math.random() * 5000 + 1000);
  }

  private async executeDockerBuildTask(
    execution: PipelineExecution,
    taskExecution: TaskExecution,
    taskConfig: PipelineTask
  ): Promise<void> {
    // Mock implementation
    taskExecution.logs.push({
      timestamp: new Date(),
      level: 'info',
      message: `Building Docker image: ${taskConfig.config.image}`,
      source: 'docker-builder'
    });

    // Create artifact
    taskExecution.artifacts.push({
      name: `${taskConfig.config.image}:${execution.variables.version || 'latest'}`,
      type: 'image',
      location: `registry.example.com/${taskConfig.config.image}:${execution.variables.version || 'latest'}`,
      createdAt: new Date()
    });

    await this.sleep(Math.random() * 10000 + 5000);
  }

  private async executeKubernetesDeployTask(
    execution: PipelineExecution,
    taskExecution: TaskExecution,
    taskConfig: PipelineTask
  ): Promise<void> {
    // Mock implementation
    taskExecution.logs.push({
      timestamp: new Date(),
      level: 'info',
      message: `Deploying to Kubernetes: ${taskConfig.config.namespace}/${taskConfig.config.deployment}`,
      source: 'kubectl'
    });

    await this.sleep(Math.random() * 8000 + 3000);
  }

  private async executeHelmDeployTask(
    execution: PipelineExecution,
    taskExecution: TaskExecution,
    taskConfig: PipelineTask
  ): Promise<void> {
    // Mock implementation
    taskExecution.logs.push({
      timestamp: new Date(),
      level: 'info',
      message: `Installing Helm chart: ${taskConfig.config.chart}`,
      source: 'helm'
    });

    await this.sleep(Math.random() * 6000 + 2000);
  }

  private async executeSecurityScanTask(
    execution: PipelineExecution,
    taskExecution: TaskExecution,
    taskConfig: PipelineTask
  ): Promise<void> {
    // Mock implementation
    taskExecution.logs.push({
      timestamp: new Date(),
      level: 'info',
      message: `Running security scan: ${taskConfig.config.scanner}`,
      source: 'security-scanner'
    });

    // Create scan report artifact
    taskExecution.artifacts.push({
      name: 'security-scan-report.json',
      type: 'report',
      location: `/artifacts/${execution.id}/security-scan-report.json`,
      createdAt: new Date()
    });

    await this.sleep(Math.random() * 15000 + 10000);
  }

  private async executeLoadTestTask(
    execution: PipelineExecution,
    taskExecution: TaskExecution,
    taskConfig: PipelineTask
  ): Promise<void> {
    // Mock implementation
    taskExecution.logs.push({
      timestamp: new Date(),
      level: 'info',
      message: `Running load test: ${taskConfig.config.testPlan}`,
      source: 'load-tester'
    });

    // Create test report artifact
    taskExecution.artifacts.push({
      name: 'load-test-report.html',
      type: 'report',
      location: `/artifacts/${execution.id}/load-test-report.html`,
      createdAt: new Date()
    });

    await this.sleep(Math.random() * 20000 + 15000);
  }

  private async executeNotificationTask(
    execution: PipelineExecution,
    taskExecution: TaskExecution,
    taskConfig: PipelineTask
  ): Promise<void> {
    // Mock implementation
    taskExecution.logs.push({
      timestamp: new Date(),
      level: 'info',
      message: `Sending notification: ${taskConfig.config.channel}`,
      source: 'notifier'
    });

    await this.sleep(1000);
  }

  private async requestStageApprovals(
    execution: PipelineExecution,
    stageExecution: StageExecution,
    approvalConfigs: ApprovalConfig[]
  ): Promise<void> {
    for (const approvalConfig of approvalConfigs) {
      const approval = stageExecution.approvals.find(a => a.approvalId === approvalConfig.id);
      if (approval) {
        approval.status = 'pending';
        approval.requestedAt = new Date();
        
        if (approvalConfig.timeout) {
          approval.expiresAt = new Date(Date.now() + approvalConfig.timeout * 1000);
        }

        execution.approvals.push(approval);
      }
    }
  }

  private async runQualityGates(
    execution: PipelineExecution,
    stageExecution: StageExecution,
    stageConfig: PipelineStage
  ): Promise<void> {
    // Mock quality gate execution
    this.logger.info(`Running quality gates for stage: ${stageConfig.name}`);
    
    for (const qualityGate of this.qualityGates.values()) {
      const result = await this.executeQualityGate(qualityGate, execution);
      
      if (result.status === 'failed' && qualityGate.required) {
        throw new Error(`Quality gate failed: ${qualityGate.name}`);
      }
    }
  }

  private async executeQualityGate(
    qualityGate: QualityGate,
    execution: PipelineExecution
  ): Promise<QualityGateResult> {
    // Mock implementation
    const criteriaResults: QualityGateCriteriaResult[] = qualityGate.criteria.map(criteria => ({
      metric: criteria.metric,
      value: Math.random() * 100,
      threshold: criteria.threshold,
      status: Math.random() > 0.8 ? 'failed' : 'passed'
    }));

    const passed = criteriaResults.every(c => c.status === 'passed');

    return {
      gateId: qualityGate.id,
      status: passed ? 'passed' : 'failed',
      score: criteriaResults.reduce((sum, c) => sum + (c.status === 'passed' ? 1 : 0), 0) / criteriaResults.length * 100,
      criteria: criteriaResults
    };
  }

  private evaluateCondition(condition: string, variables: Record<string, any>): boolean {
    // Simple condition evaluation - would implement more sophisticated logic
    try {
      // Replace variables in condition
      let evaluatedCondition = condition;
      for (const [key, value] of Object.entries(variables)) {
        evaluatedCondition = evaluatedCondition.replace(`\${${key}}`, String(value));
      }

      // Simple boolean evaluation
      return evaluatedCondition.toLowerCase() === 'true';
    } catch {
      return false;
    }
  }

  private findApprovalExecution(
    execution: PipelineExecution,
    approvalId: string
  ): ApprovalExecution | null {
    return execution.approvals.find(a => a.approvalId === approvalId) || null;
  }

  private checkAllApprovalsComplete(execution: PipelineExecution): boolean {
    return execution.approvals.every(a => a.status === 'approved');
  }

  private async cancelRunningTasks(execution: PipelineExecution): Promise<void> {
    for (const stage of execution.stages) {
      for (const task of stage.tasks) {
        if (task.status === 'running') {
          task.status = 'cancelled';
          task.endTime = new Date();
        }
      }
    }
  }

  private async updateExecutionProgress(execution: PipelineExecution): Promise<void> {
    // Update execution metrics
    const totalTasks = execution.stages.reduce((sum, stage) => sum + stage.tasks.length, 0);
    const completedTasks = execution.stages.reduce((sum, stage) => 
      sum + stage.tasks.filter(t => t.status === 'succeeded').length, 0);
    const failedTasks = execution.stages.reduce((sum, stage) => 
      sum + stage.tasks.filter(t => t.status === 'failed').length, 0);

    execution.metrics.totalTasks = totalTasks;
    execution.metrics.completedTasks = completedTasks;
    execution.metrics.failedTasks = failedTasks;

    // Check if execution is complete
    if (completedTasks + failedTasks === totalTasks && execution.status === 'running') {
      const allTasksSuccessful = failedTasks === 0;
      execution.status = allTasksSuccessful ? 'succeeded' : 'failed';
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();

      this.runningExecutions.delete(execution.id);
      this.updateExecutionMetrics(execution);
    }
  }

  private updateExecutionMetrics(execution: PipelineExecution): void {
    if (execution.status === 'succeeded') {
      this.metrics.successfulExecutions++;
    } else if (execution.status === 'failed') {
      this.metrics.failedExecutions++;
    }

    this.metrics.successRate = (this.metrics.successfulExecutions / this.metrics.totalExecutions) * 100;
    this.metrics.failureRate = (this.metrics.failedExecutions / this.metrics.totalExecutions) * 100;

    if (execution.duration) {
      this.metrics.averageExecutionTime = (this.metrics.averageExecutionTime + execution.duration) / 2;
    }

    // Update approval time
    const approvalTime = this.calculateApprovalTime(execution);
    if (approvalTime > 0) {
      this.metrics.averageApprovalTime = (this.metrics.averageApprovalTime + approvalTime) / 2;
    }
  }

  private calculateApprovalTime(execution: PipelineExecution): number {
    let totalApprovalTime = 0;
    
    for (const approval of execution.approvals) {
      if (approval.respondedAt && approval.requestedAt) {
        totalApprovalTime += approval.respondedAt.getTime() - approval.requestedAt.getTime();
      }
    }

    return totalApprovalTime;
  }

  private getRetryDelay(retryPolicy?: RetryPolicy, attempt?: number): number {
    if (!retryPolicy || !attempt) return 1000;

    const baseDelay = this.parseDuration(retryPolicy.backoff.duration);
    const maxDelay = this.parseDuration(retryPolicy.backoff.maxDuration);
    
    const delay = baseDelay * Math.pow(retryPolicy.backoff.factor, attempt - 1);
    
    return Math.min(delay, maxDelay);
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smh])$/);
    if (!match) return 1000;

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      default: return 1000;
    }
  }

  private async sleep(milliseconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }

  private generateEventId(): string {
    return crypto.randomBytes(16).toString('hex');
  }
}

export default PipelineManager;