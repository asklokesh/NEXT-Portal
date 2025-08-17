/**
 * Distributed Saga Orchestration Engine
 * Manages complex multi-service transactions with compensation patterns
 */

export interface SagaStep {
  id: string;
  serviceName: string;
  action: string;
  compensationAction: string;
  timeout: number;
  retryPolicy?: RetryPolicy;
  dependencies?: string[];
  metadata?: Record<string, any>;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffStrategy: 'linear' | 'exponential' | 'fixed';
  baseDelay: number;
  maxDelay: number;
}

export interface SagaDefinition {
  id: string;
  name: string;
  description: string;
  steps: SagaStep[];
  compensationOrder: 'reverse' | 'custom';
  timeout: number;
  version: string;
}

export interface SagaExecution {
  id: string;
  sagaId: string;
  tenantId: string;
  status: SagaStatus;
  currentStep: number;
  stepResults: Record<string, any>;
  compensationResults: Record<string, any>;
  startTime: Date;
  endTime?: Date;
  error?: string;
  context: Record<string, any>;
}

export type SagaStatus = 
  | 'pending'
  | 'running' 
  | 'completed'
  | 'compensating'
  | 'compensated'
  | 'failed'
  | 'timeout';

export interface SagaEvent {
  id: string;
  sagaExecutionId: string;
  stepId: string;
  type: 'step_started' | 'step_completed' | 'step_failed' | 'compensation_started' | 'compensation_completed';
  timestamp: Date;
  data: any;
  error?: string;
}

class SagaOrchestrator {
  private sagas: Map<string, SagaDefinition> = new Map();
  private executions: Map<string, SagaExecution> = new Map();
  private events: SagaEvent[] = [];
  private serviceClients: Map<string, any> = new Map();

  /**
   * Register a saga definition
   */
  registerSaga(saga: SagaDefinition): void {
    this.validateSagaDefinition(saga);
    this.sagas.set(saga.id, saga);
    console.log(`Registered saga: ${saga.name} (${saga.id})`);
  }

  /**
   * Register a service client for saga step execution
   */
  registerServiceClient(serviceName: string, client: any): void {
    this.serviceClients.set(serviceName, client);
  }

  /**
   * Start a new saga execution
   */
  async startSaga(
    sagaId: string, 
    tenantId: string, 
    context: Record<string, any>
  ): Promise<string> {
    const saga = this.sagas.get(sagaId);
    if (!saga) {
      throw new Error(`Saga not found: ${sagaId}`);
    }

    const executionId = this.generateExecutionId();
    const execution: SagaExecution = {
      id: executionId,
      sagaId,
      tenantId,
      status: 'pending',
      currentStep: 0,
      stepResults: {},
      compensationResults: {},
      startTime: new Date(),
      context
    };

    this.executions.set(executionId, execution);
    
    // Start execution asynchronously
    this.executeSaga(executionId).catch(error => {
      console.error(`Saga execution failed: ${executionId}`, error);
    });

    return executionId;
  }

  /**
   * Get saga execution status
   */
  getExecution(executionId: string): SagaExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Get all executions for a tenant
   */
  getTenantExecutions(tenantId: string): SagaExecution[] {
    return Array.from(this.executions.values())
      .filter(execution => execution.tenantId === tenantId);
  }

  /**
   * Get saga execution events
   */
  getExecutionEvents(executionId: string): SagaEvent[] {
    return this.events.filter(event => event.sagaExecutionId === executionId);
  }

  /**
   * Execute a saga
   */
  private async executeSaga(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    const saga = this.sagas.get(execution.sagaId);
    if (!saga) {
      throw new Error(`Saga not found: ${execution.sagaId}`);
    }

    try {
      execution.status = 'running';
      this.updateExecution(execution);

      // Execute steps in order
      for (let i = 0; i < saga.steps.length; i++) {
        execution.currentStep = i;
        const step = saga.steps[i];

        try {
          await this.executeStep(execution, step);
        } catch (error) {
          console.error(`Step failed: ${step.id}`, error);
          
          // Start compensation
          await this.compensateSaga(execution, i - 1);
          return;
        }
      }

      // All steps completed successfully
      execution.status = 'completed';
      execution.endTime = new Date();
      this.updateExecution(execution);

      this.emitEvent({
        id: this.generateEventId(),
        sagaExecutionId: executionId,
        stepId: 'saga',
        type: 'step_completed',
        timestamp: new Date(),
        data: { saga: saga.name, duration: execution.endTime.getTime() - execution.startTime.getTime() }
      });

    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : String(error);
      execution.endTime = new Date();
      this.updateExecution(execution);
    }
  }

  /**
   * Execute a single saga step
   */
  private async executeStep(execution: SagaExecution, step: SagaStep): Promise<void> {
    const startTime = Date.now();
    
    this.emitEvent({
      id: this.generateEventId(),
      sagaExecutionId: execution.id,
      stepId: step.id,
      type: 'step_started',
      timestamp: new Date(),
      data: { action: step.action, serviceName: step.serviceName }
    });

    // Check dependencies
    if (step.dependencies) {
      for (const dep of step.dependencies) {
        if (!execution.stepResults[dep]) {
          throw new Error(`Dependency not satisfied: ${dep}`);
        }
      }
    }

    const serviceClient = this.serviceClients.get(step.serviceName);
    if (!serviceClient) {
      throw new Error(`Service client not found: ${step.serviceName}`);
    }

    let result: any;
    let attempts = 0;
    const maxAttempts = step.retryPolicy?.maxAttempts || 1;

    while (attempts < maxAttempts) {
      try {
        // Prepare context for step execution
        const stepContext = {
          ...execution.context,
          stepResults: execution.stepResults,
          tenantId: execution.tenantId,
          sagaExecutionId: execution.id,
          stepId: step.id
        };

        // Execute step with timeout
        result = await Promise.race([
          serviceClient[step.action](stepContext),
          this.createTimeoutPromise(step.timeout)
        ]);

        break; // Success, exit retry loop

      } catch (error) {
        attempts++;
        console.warn(`Step ${step.id} attempt ${attempts} failed:`, error);

        if (attempts >= maxAttempts) {
          throw error;
        }

        // Wait before retry
        if (step.retryPolicy) {
          const delay = this.calculateRetryDelay(step.retryPolicy, attempts);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // Store step result
    execution.stepResults[step.id] = result;
    this.updateExecution(execution);

    this.emitEvent({
      id: this.generateEventId(),
      sagaExecutionId: execution.id,
      stepId: step.id,
      type: 'step_completed',
      timestamp: new Date(),
      data: { 
        result, 
        duration: Date.now() - startTime,
        attempts 
      }
    });
  }

  /**
   * Compensate a saga (rollback completed steps)
   */
  private async compensateSaga(execution: SagaExecution, lastCompletedStep: number): Promise<void> {
    execution.status = 'compensating';
    this.updateExecution(execution);

    const saga = this.sagas.get(execution.sagaId)!;
    
    // Compensate in reverse order
    for (let i = lastCompletedStep; i >= 0; i--) {
      const step = saga.steps[i];
      
      try {
        await this.compensateStep(execution, step);
      } catch (error) {
        console.error(`Compensation failed for step: ${step.id}`, error);
        // Continue with other compensations even if one fails
      }
    }

    execution.status = 'compensated';
    execution.endTime = new Date();
    this.updateExecution(execution);
  }

  /**
   * Compensate a single step
   */
  private async compensateStep(execution: SagaExecution, step: SagaStep): Promise<void> {
    if (!step.compensationAction) {
      console.warn(`No compensation action defined for step: ${step.id}`);
      return;
    }

    this.emitEvent({
      id: this.generateEventId(),
      sagaExecutionId: execution.id,
      stepId: step.id,
      type: 'compensation_started',
      timestamp: new Date(),
      data: { compensationAction: step.compensationAction }
    });

    const serviceClient = this.serviceClients.get(step.serviceName);
    if (!serviceClient) {
      throw new Error(`Service client not found for compensation: ${step.serviceName}`);
    }

    const compensationContext = {
      ...execution.context,
      stepResults: execution.stepResults,
      compensationResults: execution.compensationResults,
      originalResult: execution.stepResults[step.id],
      tenantId: execution.tenantId,
      sagaExecutionId: execution.id,
      stepId: step.id
    };

    try {
      const result = await Promise.race([
        serviceClient[step.compensationAction](compensationContext),
        this.createTimeoutPromise(step.timeout)
      ]);

      execution.compensationResults[step.id] = result;
      this.updateExecution(execution);

      this.emitEvent({
        id: this.generateEventId(),
        sagaExecutionId: execution.id,
        stepId: step.id,
        type: 'compensation_completed',
        timestamp: new Date(),
        data: { result }
      });

    } catch (error) {
      this.emitEvent({
        id: this.generateEventId(),
        sagaExecutionId: execution.id,
        stepId: step.id,
        type: 'compensation_completed',
        timestamp: new Date(),
        data: {},
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Validate saga definition
   */
  private validateSagaDefinition(saga: SagaDefinition): void {
    if (!saga.id || !saga.name || !saga.steps || saga.steps.length === 0) {
      throw new Error('Invalid saga definition: missing required fields');
    }

    // Check for circular dependencies
    const stepIds = new Set(saga.steps.map(s => s.id));
    for (const step of saga.steps) {
      if (step.dependencies) {
        for (const dep of step.dependencies) {
          if (!stepIds.has(dep)) {
            throw new Error(`Invalid dependency: ${dep} not found in saga steps`);
          }
        }
      }
    }

    // Validate step order respects dependencies
    const processed = new Set<string>();
    for (const step of saga.steps) {
      if (step.dependencies) {
        for (const dep of step.dependencies) {
          if (!processed.has(dep)) {
            throw new Error(`Dependency order violation: ${step.id} depends on ${dep} which comes later`);
          }
        }
      }
      processed.add(step.id);
    }
  }

  /**
   * Calculate retry delay based on policy
   */
  private calculateRetryDelay(policy: RetryPolicy, attempt: number): number {
    let delay: number;

    switch (policy.backoffStrategy) {
      case 'linear':
        delay = policy.baseDelay * attempt;
        break;
      case 'exponential':
        delay = policy.baseDelay * Math.pow(2, attempt - 1);
        break;
      case 'fixed':
      default:
        delay = policy.baseDelay;
        break;
    }

    return Math.min(delay, policy.maxDelay);
  }

  /**
   * Create a timeout promise
   */
  private createTimeoutPromise(timeout: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Operation timeout')), timeout);
    });
  }

  /**
   * Update execution in storage
   */
  private updateExecution(execution: SagaExecution): void {
    this.executions.set(execution.id, { ...execution });
  }

  /**
   * Emit saga event
   */
  private emitEvent(event: SagaEvent): void {
    this.events.push(event);
    
    // Keep only recent events (last 10000)
    if (this.events.length > 10000) {
      this.events = this.events.slice(-10000);
    }

    // Emit to external event system if available
    this.publishEvent(event);
  }

  /**
   * Publish event to external system
   */
  private publishEvent(event: SagaEvent): void {
    // This would integrate with your event streaming system
    // (Kafka, AWS Kinesis, etc.)
    console.log('Saga Event:', {
      type: event.type,
      sagaExecutionId: event.sagaExecutionId,
      stepId: event.stepId,
      timestamp: event.timestamp
    });
  }

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `saga_exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `saga_event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get saga execution statistics
   */
  getStatistics(): {
    totalExecutions: number;
    statusBreakdown: Record<SagaStatus, number>;
    averageDuration: number;
    successRate: number;
  } {
    const executions = Array.from(this.executions.values());
    const statusBreakdown: Record<SagaStatus, number> = {
      pending: 0,
      running: 0,
      completed: 0,
      compensating: 0,
      compensated: 0,
      failed: 0,
      timeout: 0
    };

    let totalDuration = 0;
    let completedCount = 0;

    executions.forEach(execution => {
      statusBreakdown[execution.status]++;
      
      if (execution.endTime) {
        totalDuration += execution.endTime.getTime() - execution.startTime.getTime();
        completedCount++;
      }
    });

    const successful = statusBreakdown.completed;
    const total = executions.length;

    return {
      totalExecutions: total,
      statusBreakdown,
      averageDuration: completedCount > 0 ? totalDuration / completedCount : 0,
      successRate: total > 0 ? successful / total : 0
    };
  }
}

// Global saga orchestrator instance
export const sagaOrchestrator = new SagaOrchestrator();

export default sagaOrchestrator;