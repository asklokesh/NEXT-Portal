/**
 * Saga Orchestration Pattern
 * Manages distributed transactions across multiple services
 */

import { v4 as uuidv4 } from 'uuid';
import { EventBus } from '../core/event-bus';
import { DomainEvent, EventMetadata } from '../core/event-types';
import { CommandBus, Command } from '../../cqrs/commands/command-bus';
import { Logger } from '../../monitoring/logger';
import { MetricsCollector } from '../../monitoring/metrics';

export interface SagaStep {
  name: string;
  command: Command;
  compensationCommand?: Command;
  timeout?: number;
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;
  };
}

export interface SagaDefinition {
  name: string;
  steps: SagaStep[];
  timeout?: number;
  compensationStrategy?: 'sequential' | 'parallel';
}

export enum SagaStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  COMPENSATING = 'COMPENSATING',
  COMPENSATED = 'COMPENSATED',
  COMPENSATION_FAILED = 'COMPENSATION_FAILED'
}

export interface SagaExecution {
  id: string;
  sagaName: string;
  status: SagaStatus;
  currentStep: number;
  completedSteps: string[];
  failedStep?: string;
  startedAt: Date;
  completedAt?: Date;
  error?: Error;
  context: Map<string, any>;
}

export class SagaOrchestrator {
  private eventBus: EventBus;
  private commandBus: CommandBus;
  private sagas: Map<string, SagaDefinition>;
  private executions: Map<string, SagaExecution>;
  private logger: Logger;
  private metrics: MetricsCollector;

  constructor(eventBus: EventBus, commandBus: CommandBus) {
    this.eventBus = eventBus;
    this.commandBus = commandBus;
    this.sagas = new Map();
    this.executions = new Map();
    this.logger = new Logger('SagaOrchestrator');
    this.metrics = new MetricsCollector('saga_orchestrator');
  }

  /**
   * Register a saga definition
   */
  registerSaga(saga: SagaDefinition): void {
    if (this.sagas.has(saga.name)) {
      throw new Error(`Saga already registered: ${saga.name}`);
    }

    this.sagas.set(saga.name, saga);
    this.logger.info(`Saga registered: ${saga.name}`, {
      steps: saga.steps.length
    });
  }

  /**
   * Start a saga execution
   */
  async startSaga(
    sagaName: string,
    initialContext: Record<string, any> = {}
  ): Promise<string> {
    const saga = this.sagas.get(sagaName);
    if (!saga) {
      throw new Error(`Saga not found: ${sagaName}`);
    }

    const executionId = uuidv4();
    const execution: SagaExecution = {
      id: executionId,
      sagaName,
      status: SagaStatus.PENDING,
      currentStep: 0,
      completedSteps: [],
      startedAt: new Date(),
      context: new Map(Object.entries(initialContext))
    };

    this.executions.set(executionId, execution);

    // Emit saga started event
    await this.emitSagaEvent('saga.started', execution);

    // Start execution
    this.executeSaga(executionId).catch(error => {
      this.logger.error(`Saga execution failed: ${executionId}`, error);
    });

    return executionId;
  }

  /**
   * Execute saga steps
   */
  private async executeSaga(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    const saga = this.sagas.get(execution.sagaName);
    if (!saga) {
      throw new Error(`Saga not found: ${execution.sagaName}`);
    }

    execution.status = SagaStatus.RUNNING;
    const startTime = Date.now();

    try {
      // Execute each step
      for (let i = 0; i < saga.steps.length; i++) {
        execution.currentStep = i;
        const step = saga.steps[i];

        this.logger.debug(`Executing saga step: ${step.name}`, {
          sagaId: executionId,
          step: i + 1,
          total: saga.steps.length
        });

        // Execute step with retry
        const success = await this.executeStep(step, execution);

        if (!success) {
          execution.failedStep = step.name;
          throw new Error(`Step failed: ${step.name}`);
        }

        execution.completedSteps.push(step.name);

        // Emit step completed event
        await this.emitSagaEvent('saga.step.completed', execution, {
          stepName: step.name,
          stepIndex: i
        });
      }

      // Saga completed successfully
      execution.status = SagaStatus.COMPLETED;
      execution.completedAt = new Date();

      // Emit saga completed event
      await this.emitSagaEvent('saga.completed', execution);

      // Track metrics
      this.metrics.recordHistogram('saga_execution_time', Date.now() - startTime);
      this.metrics.incrementCounter('sagas_completed', {
        sagaName: execution.sagaName
      });

      this.logger.info(`Saga completed: ${executionId}`);
    } catch (error) {
      execution.status = SagaStatus.FAILED;
      execution.error = error as Error;

      this.logger.error(`Saga failed: ${executionId}`, error as Error);

      // Start compensation
      await this.compensateSaga(executionId);

      // Track metrics
      this.metrics.incrementCounter('sagas_failed', {
        sagaName: execution.sagaName,
        failedStep: execution.failedStep || 'unknown'
      });
    }
  }

  /**
   * Execute a single saga step
   */
  private async executeStep(
    step: SagaStep,
    execution: SagaExecution
  ): Promise<boolean> {
    const retryPolicy = step.retryPolicy || { maxRetries: 3, backoffMs: 1000 };
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retryPolicy.maxRetries; attempt++) {
      try {
        // Apply context to command
        const command = this.applyContext(step.command, execution.context);

        // Execute command with timeout
        const timeout = step.timeout || 30000;
        const result = await this.executeWithTimeout(
          () => this.commandBus.execute(command),
          timeout
        );

        if (result.success) {
          // Store result in context
          if (result.aggregateId) {
            execution.context.set(`${step.name}.aggregateId`, result.aggregateId);
          }
          if (result.version) {
            execution.context.set(`${step.name}.version`, result.version);
          }

          return true;
        }

        lastError = result.error;
      } catch (error) {
        lastError = error as Error;
      }

      // Wait before retry
      if (attempt < retryPolicy.maxRetries) {
        await this.sleep(retryPolicy.backoffMs * Math.pow(2, attempt));
        this.logger.warn(`Retrying step ${step.name}, attempt ${attempt + 1}`);
      }
    }

    this.logger.error(`Step failed after ${retryPolicy.maxRetries} retries: ${step.name}`, lastError!);
    return false;
  }

  /**
   * Compensate failed saga
   */
  private async compensateSaga(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      return;
    }

    const saga = this.sagas.get(execution.sagaName);
    if (!saga) {
      return;
    }

    execution.status = SagaStatus.COMPENSATING;
    const startTime = Date.now();

    this.logger.info(`Starting saga compensation: ${executionId}`);

    // Emit compensation started event
    await this.emitSagaEvent('saga.compensation.started', execution);

    try {
      const strategy = saga.compensationStrategy || 'sequential';
      
      if (strategy === 'sequential') {
        await this.compensateSequential(execution, saga);
      } else {
        await this.compensateParallel(execution, saga);
      }

      execution.status = SagaStatus.COMPENSATED;

      // Emit compensation completed event
      await this.emitSagaEvent('saga.compensation.completed', execution);

      // Track metrics
      this.metrics.recordHistogram('saga_compensation_time', Date.now() - startTime);
      this.metrics.incrementCounter('sagas_compensated', {
        sagaName: execution.sagaName
      });

      this.logger.info(`Saga compensated: ${executionId}`);
    } catch (error) {
      execution.status = SagaStatus.COMPENSATION_FAILED;
      
      // Emit compensation failed event
      await this.emitSagaEvent('saga.compensation.failed', execution, {
        error: (error as Error).message
      });

      this.metrics.incrementCounter('saga_compensation_failures', {
        sagaName: execution.sagaName
      });

      this.logger.error(`Saga compensation failed: ${executionId}`, error as Error);
    }
  }

  /**
   * Sequential compensation
   */
  private async compensateSequential(
    execution: SagaExecution,
    saga: SagaDefinition
  ): Promise<void> {
    // Compensate in reverse order
    const stepsToCompensate = execution.completedSteps.slice().reverse();

    for (const stepName of stepsToCompensate) {
      const step = saga.steps.find(s => s.name === stepName);
      if (!step || !step.compensationCommand) {
        continue;
      }

      try {
        const command = this.applyContext(step.compensationCommand, execution.context);
        await this.commandBus.execute(command);

        this.logger.debug(`Compensated step: ${stepName}`);
      } catch (error) {
        this.logger.error(`Failed to compensate step: ${stepName}`, error as Error);
        throw error;
      }
    }
  }

  /**
   * Parallel compensation
   */
  private async compensateParallel(
    execution: SagaExecution,
    saga: SagaDefinition
  ): Promise<void> {
    const compensationPromises = execution.completedSteps.map(async stepName => {
      const step = saga.steps.find(s => s.name === stepName);
      if (!step || !step.compensationCommand) {
        return;
      }

      try {
        const command = this.applyContext(step.compensationCommand, execution.context);
        await this.commandBus.execute(command);
        this.logger.debug(`Compensated step: ${stepName}`);
      } catch (error) {
        this.logger.error(`Failed to compensate step: ${stepName}`, error as Error);
        throw error;
      }
    });

    await Promise.all(compensationPromises);
  }

  /**
   * Apply context to command
   */
  private applyContext(command: Command, context: Map<string, any>): Command {
    // Replace context placeholders in payload
    const payload = JSON.parse(JSON.stringify(command.payload));
    
    const replacePlaceholders = (obj: any): any => {
      if (typeof obj === 'string' && obj.startsWith('${') && obj.endsWith('}')) {
        const key = obj.slice(2, -1);
        return context.get(key) || obj;
      }
      
      if (typeof obj === 'object' && obj !== null) {
        for (const key in obj) {
          obj[key] = replacePlaceholders(obj[key]);
        }
      }
      
      return obj;
    };

    return {
      ...command,
      payload: replacePlaceholders(payload)
    };
  }

  /**
   * Emit saga event
   */
  private async emitSagaEvent(
    eventType: string,
    execution: SagaExecution,
    additionalData?: any
  ): Promise<void> {
    const metadata: EventMetadata = {
      eventId: uuidv4(),
      eventType,
      aggregateId: execution.id,
      aggregateType: 'Saga',
      timestamp: new Date(),
      version: 1,
      correlationId: execution.id,
      source: 'SagaOrchestrator',
      schemaVersion: '1.0'
    };

    const event = new DomainEvent(metadata, {
      sagaId: execution.id,
      sagaName: execution.sagaName,
      status: execution.status,
      currentStep: execution.currentStep,
      completedSteps: execution.completedSteps,
      ...additionalData
    });

    await this.eventBus.publish(event);
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timeout: ${timeout}ms`));
      }, timeout);

      fn()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Get saga execution status
   */
  getExecution(executionId: string): SagaExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Get all executions
   */
  getAllExecutions(): SagaExecution[] {
    return Array.from(this.executions.values());
  }

  /**
   * Get metrics
   */
  getMetrics(): any {
    const statusCounts = new Map<SagaStatus, number>();
    
    for (const execution of this.executions.values()) {
      statusCounts.set(
        execution.status,
        (statusCounts.get(execution.status) || 0) + 1
      );
    }

    return {
      totalSagas: this.sagas.size,
      totalExecutions: this.executions.size,
      statusCounts: Object.fromEntries(statusCounts),
      ...this.metrics.getMetrics()
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}