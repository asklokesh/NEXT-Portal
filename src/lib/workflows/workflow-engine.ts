import { z } from 'zod';
import winston from 'winston';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'workflows.log' })
  ]
});

// Workflow schemas
export const WorkflowStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum([
    'approval',
    'notification',
    'api_call',
    'condition',
    'delay',
    'script',
    'webhook',
    'template_execution',
    'deployment',
    'user_input'
  ]),
  description: z.string().optional(),
  config: z.record(z.any()).default({}),
  conditions: z.array(z.object({
    field: z.string(),
    operator: z.enum(['equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'exists']),
    value: z.any()
  })).default([]),
  onSuccess: z.string().optional(), // Next step ID
  onFailure: z.string().optional(), // Next step ID
  onTimeout: z.string().optional(), // Next step ID
  timeout: z.number().optional(), // seconds
  retryCount: z.number().default(0),
  retryDelay: z.number().default(60), // seconds
  required: z.boolean().default(true)
});

export const WorkflowDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  version: z.string().default('1.0.0'),
  category: z.enum([
    'deployment',
    'approval',
    'maintenance',
    'compliance',
    'onboarding',
    'incident_response',
    'custom'
  ]),
  trigger: z.object({
    type: z.enum(['manual', 'schedule', 'webhook', 'event', 'api']),
    config: z.record(z.any()).default({})
  }),
  steps: z.array(WorkflowStepSchema),
  variables: z.record(z.any()).default({}),
  permissions: z.object({
    execute: z.array(z.string()).default([]), // User/role IDs
    approve: z.array(z.string()).default([]), // User/role IDs
    view: z.array(z.string()).default([]) // User/role IDs
  }).default({}),
  enabled: z.boolean().default(true),
  createdBy: z.string(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date())
});

export const WorkflowExecutionSchema = z.object({
  id: z.string(),
  workflowId: z.string(),
  workflowVersion: z.string(),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled', 'paused']),
  currentStep: z.string().optional(),
  input: z.record(z.any()).default({}),
  output: z.record(z.any()).default({}),
  variables: z.record(z.any()).default({}),
  executionLog: z.array(z.object({
    stepId: z.string(),
    stepName: z.string(),
    status: z.enum(['pending', 'running', 'completed', 'failed', 'skipped', 'cancelled']),
    startTime: z.date(),
    endTime: z.date().optional(),
    input: z.record(z.any()).default({}),
    output: z.record(z.any()).default({}),
    error: z.string().optional(),
    retryCount: z.number().default(0)
  })).default([]),
  startedBy: z.string(),
  startedAt: z.date(),
  completedAt: z.date().optional(),
  error: z.string().optional(),
  metadata: z.record(z.any()).default({})
});

export const ApprovalRequestSchema = z.object({
  id: z.string(),
  executionId: z.string(),
  stepId: z.string(),
  title: z.string(),
  description: z.string(),
  requestedBy: z.string(),
  approvers: z.array(z.string()), // User IDs
  requiredApprovals: z.number().default(1),
  currentApprovals: z.number().default(0),
  approvals: z.array(z.object({
    userId: z.string(),
    decision: z.enum(['approved', 'rejected']),
    comment: z.string().optional(),
    timestamp: z.date()
  })).default([]),
  status: z.enum(['pending', 'approved', 'rejected', 'expired']),
  expiresAt: z.date().optional(),
  data: z.record(z.any()).default({}),
  createdAt: z.date().default(() => new Date())
});

export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;
export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;
export type WorkflowExecution = z.infer<typeof WorkflowExecutionSchema>;
export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;

// Step executors
interface StepExecutor {
  execute(step: WorkflowStep, execution: WorkflowExecution, context: any): Promise<{
    success: boolean;
    output?: any;
    error?: string;
    nextStep?: string;
  }>;
}

class ApprovalStepExecutor implements StepExecutor {
  constructor(private workflowEngine: WorkflowEngine) {}

  async execute(step: WorkflowStep, execution: WorkflowExecution, context: any) {
    try {
      const approvalRequest: ApprovalRequest = {
        id: uuidv4(),
        executionId: execution.id,
        stepId: step.id,
        title: step.config.title || `Approval required for ${execution.workflowId}`,
        description: step.config.description || 'Please review and approve this request',
        requestedBy: execution.startedBy,
        approvers: step.config.approvers || [],
        requiredApprovals: step.config.requiredApprovals || 1,
        currentApprovals: 0,
        status: 'pending',
        expiresAt: step.config.expirationHours ? 
          new Date(Date.now() + step.config.expirationHours * 60 * 60 * 1000) : undefined,
        data: step.config.data || {},
        createdAt: new Date()
      };

      // Store approval request
      this.workflowEngine.addApprovalRequest(approvalRequest);

      // Send notifications to approvers
      await this.sendApprovalNotifications(approvalRequest);

      logger.info('Approval step initiated', {
        executionId: execution.id,
        stepId: step.id,
        approvalId: approvalRequest.id,
        approvers: approvalRequest.approvers
      });

      // Return pending status - execution will be paused until approval
      return {
        success: false, // Indicates step is not complete
        output: { approvalId: approvalRequest.id, status: 'pending_approval' }
      };
    } catch (error) {
      logger.error('Approval step execution failed', {
        executionId: execution.id,
        stepId: step.id,
        error: error.message
      });
      return {
        success: false,
        error: error.message
      };
    }
  }

  private async sendApprovalNotifications(approvalRequest: ApprovalRequest) {
    // This would integrate with your notification system
    for (const approverId of approvalRequest.approvers) {
      logger.info('Sending approval notification', {
        approverId,
        approvalId: approvalRequest.id,
        title: approvalRequest.title
      });
      
      // In a real implementation, send email/Slack notification
      // await notificationService.send(approverId, {
      //   type: 'approval_request',
      //   data: approvalRequest
      // });
    }
  }
}

class NotificationStepExecutor implements StepExecutor {
  async execute(step: WorkflowStep, execution: WorkflowExecution, context: any) {
    try {
      const recipients = step.config.recipients || [];
      const message = this.interpolateMessage(step.config.message || '', execution.variables);
      const subject = this.interpolateMessage(step.config.subject || '', execution.variables);

      logger.info('Sending notifications', {
        executionId: execution.id,
        stepId: step.id,
        recipients: recipients.length,
        subject
      });

      // In a real implementation, integrate with notification service
      // await notificationService.sendBulk(recipients, { subject, message });

      return {
        success: true,
        output: { sent: recipients.length, subject, message }
      };
    } catch (error) {
      logger.error('Notification step execution failed', {
        executionId: execution.id,
        stepId: step.id,
        error: error.message
      });
      return {
        success: false,
        error: error.message
      };
    }
  }

  private interpolateMessage(template: string, variables: Record<string, any>): string {
    return template.replace(/{{(.*?)}}/g, (match, key) => {
      return variables[key.trim()] || match;
    });
  }
}

class ApiCallStepExecutor implements StepExecutor {
  async execute(step: WorkflowStep, execution: WorkflowExecution, context: any) {
    try {
      const { method = 'GET', url, headers = {}, body } = step.config;
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: method !== 'GET' ? JSON.stringify(body) : undefined
      });

      const responseData = await response.json().catch(() => ({}));

      logger.info('API call completed', {
        executionId: execution.id,
        stepId: step.id,
        method,
        url,
        status: response.status
      });

      if (!response.ok) {
        return {
          success: false,
          error: `API call failed with status ${response.status}`,
          output: { status: response.status, data: responseData }
        };
      }

      return {
        success: true,
        output: { status: response.status, data: responseData }
      };
    } catch (error) {
      logger.error('API call step execution failed', {
        executionId: execution.id,
        stepId: step.id,
        error: error.message
      });
      return {
        success: false,
        error: error.message
      };
    }
  }
}

class ConditionalStepExecutor implements StepExecutor {
  async execute(step: WorkflowStep, execution: WorkflowExecution, context: any) {
    try {
      let conditionMet = true;

      for (const condition of step.conditions) {
        const fieldValue = this.getFieldValue(condition.field, execution.variables);
        const conditionResult = this.evaluateCondition(fieldValue, condition.operator, condition.value);
        
        if (!conditionResult) {
          conditionMet = false;
          break;
        }
      }

      logger.info('Condition evaluated', {
        executionId: execution.id,
        stepId: step.id,
        conditionMet,
        conditions: step.conditions.length
      });

      return {
        success: true,
        output: { conditionMet },
        nextStep: conditionMet ? step.onSuccess : step.onFailure
      };
    } catch (error) {
      logger.error('Conditional step execution failed', {
        executionId: execution.id,
        stepId: step.id,
        error: error.message
      });
      return {
        success: false,
        error: error.message
      };
    }
  }

  private getFieldValue(field: string, variables: Record<string, any>): any {
    return field.split('.').reduce((obj, key) => obj?.[key], variables);
  }

  private evaluateCondition(fieldValue: any, operator: string, expectedValue: any): boolean {
    switch (operator) {
      case 'equals':
        return fieldValue === expectedValue;
      case 'not_equals':
        return fieldValue !== expectedValue;
      case 'contains':
        return String(fieldValue).includes(String(expectedValue));
      case 'greater_than':
        return Number(fieldValue) > Number(expectedValue);
      case 'less_than':
        return Number(fieldValue) < Number(expectedValue);
      case 'exists':
        return fieldValue !== undefined && fieldValue !== null;
      default:
        return false;
    }
  }
}

class DelayStepExecutor implements StepExecutor {
  async execute(step: WorkflowStep, execution: WorkflowExecution, context: any) {
    try {
      const delaySeconds = step.config.delaySeconds || 60;
      
      logger.info('Delay step initiated', {
        executionId: execution.id,
        stepId: step.id,
        delaySeconds
      });

      await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));

      return {
        success: true,
        output: { delayed: delaySeconds }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Main workflow engine
export class WorkflowEngine extends EventEmitter {
  private workflows: Map<string, WorkflowDefinition> = new Map();
  private executions: Map<string, WorkflowExecution> = new Map();
  private approvalRequests: Map<string, ApprovalRequest> = new Map();
  private stepExecutors: Map<string, StepExecutor> = new Map();
  private isRunning: boolean = false;

  constructor() {
    super();
    this.initializeStepExecutors();
    logger.info('Workflow Engine initialized');
  }

  private initializeStepExecutors() {
    this.stepExecutors.set('approval', new ApprovalStepExecutor(this));
    this.stepExecutors.set('notification', new NotificationStepExecutor());
    this.stepExecutors.set('api_call', new ApiCallStepExecutor());
    this.stepExecutors.set('condition', new ConditionalStepExecutor());
    this.stepExecutors.set('delay', new DelayStepExecutor());
  }

  // Workflow definition management
  createWorkflow(workflow: WorkflowDefinition): void {
    try {
      const validatedWorkflow = WorkflowDefinitionSchema.parse(workflow);
      this.workflows.set(validatedWorkflow.id, validatedWorkflow);
      
      logger.info('Workflow created', {
        workflowId: validatedWorkflow.id,
        name: validatedWorkflow.name,
        stepsCount: validatedWorkflow.steps.length
      });
      
      this.emit('workflow:created', validatedWorkflow);
    } catch (error) {
      logger.error('Failed to create workflow', { error: error.message });
      throw error;
    }
  }

  updateWorkflow(workflowId: string, updates: Partial<WorkflowDefinition>): void {
    const existingWorkflow = this.workflows.get(workflowId);
    if (!existingWorkflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const updatedWorkflow = {
      ...existingWorkflow,
      ...updates,
      updatedAt: new Date()
    };

    try {
      const validatedWorkflow = WorkflowDefinitionSchema.parse(updatedWorkflow);
      this.workflows.set(workflowId, validatedWorkflow);
      
      logger.info('Workflow updated', { workflowId, name: validatedWorkflow.name });
      this.emit('workflow:updated', validatedWorkflow);
    } catch (error) {
      logger.error('Failed to update workflow', { workflowId, error: error.message });
      throw error;
    }
  }

  deleteWorkflow(workflowId: string): void {
    if (!this.workflows.has(workflowId)) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    // Check for active executions
    const activeExecutions = Array.from(this.executions.values())
      .filter(exec => exec.workflowId === workflowId && 
        ['pending', 'running', 'paused'].includes(exec.status));

    if (activeExecutions.length > 0) {
      throw new Error(`Cannot delete workflow ${workflowId}: ${activeExecutions.length} active executions`);
    }

    this.workflows.delete(workflowId);
    logger.info('Workflow deleted', { workflowId });
    this.emit('workflow:deleted', { workflowId });
  }

  getWorkflow(workflowId: string): WorkflowDefinition | undefined {
    return this.workflows.get(workflowId);
  }

  getAllWorkflows(): WorkflowDefinition[] {
    return Array.from(this.workflows.values());
  }

  // Workflow execution
  async startExecution(
    workflowId: string,
    input: Record<string, any> = {},
    startedBy: string,
    metadata: Record<string, any> = {}
  ): Promise<string> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    if (!workflow.enabled) {
      throw new Error(`Workflow ${workflowId} is disabled`);
    }

    const executionId = uuidv4();
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId,
      workflowVersion: workflow.version,
      status: 'pending',
      currentStep: workflow.steps[0]?.id,
      input,
      output: {},
      variables: { ...workflow.variables, ...input },
      executionLog: [],
      startedBy,
      startedAt: new Date(),
      metadata
    };

    this.executions.set(executionId, execution);
    
    logger.info('Workflow execution started', {
      executionId,
      workflowId,
      startedBy,
      inputKeys: Object.keys(input)
    });
    
    this.emit('execution:started', execution);
    
    // Start execution asynchronously
    this.executeWorkflow(executionId).catch(error => {
      logger.error('Workflow execution failed', {
        executionId,
        workflowId,
        error: error.message
      });
    });

    return executionId;
  }

  private async executeWorkflow(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    const workflow = this.workflows.get(execution.workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${execution.workflowId} not found`);
    }

    execution.status = 'running';
    this.emit('execution:running', execution);

    let currentStepId = execution.currentStep;
    
    while (currentStepId && execution.status === 'running') {
      const step = workflow.steps.find(s => s.id === currentStepId);
      if (!step) {
        execution.status = 'failed';
        execution.error = `Step ${currentStepId} not found`;
        break;
      }

      const result = await this.executeStep(step, execution);
      
      if (result.success) {
        currentStepId = result.nextStep || this.getNextStep(workflow, currentStepId);
        if (!currentStepId) {
          // Workflow completed
          execution.status = 'completed';
          execution.completedAt = new Date();
          execution.currentStep = undefined;
        } else {
          execution.currentStep = currentStepId;
        }
      } else if (result.output?.status === 'pending_approval') {
        // Pause for approval
        execution.status = 'paused';
        execution.currentStep = currentStepId;
        break;
      } else {
        // Step failed
        execution.status = 'failed';
        execution.error = result.error;
        execution.completedAt = new Date();
        break;
      }
    }

    this.emit(`execution:${execution.status}`, execution);
    
    logger.info('Workflow execution completed', {
      executionId,
      workflowId: execution.workflowId,
      status: execution.status,
      duration: execution.completedAt ? 
        execution.completedAt.getTime() - execution.startedAt.getTime() : undefined
    });
  }

  private async executeStep(step: WorkflowStep, execution: WorkflowExecution) {
    const logEntry = {
      stepId: step.id,
      stepName: step.name,
      status: 'running' as const,
      startTime: new Date(),
      input: execution.variables,
      output: {},
      retryCount: 0
    };

    execution.executionLog.push(logEntry);

    logger.info('Executing workflow step', {
      executionId: execution.id,
      stepId: step.id,
      stepName: step.name,
      stepType: step.type
    });

    try {
      const executor = this.stepExecutors.get(step.type);
      if (!executor) {
        throw new Error(`No executor found for step type: ${step.type}`);
      }

      const result = await executor.execute(step, execution, {});
      
      logEntry.status = result.success ? 'completed' : 'failed';
      logEntry.endTime = new Date();
      logEntry.output = result.output || {};
      logEntry.error = result.error;

      // Update execution variables with step output
      if (result.output) {
        execution.variables[`step_${step.id}`] = result.output;
      }

      return result;
    } catch (error) {
      logEntry.status = 'failed';
      logEntry.endTime = new Date();
      logEntry.error = error.message;
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  private getNextStep(workflow: WorkflowDefinition, currentStepId: string): string | undefined {
    const currentIndex = workflow.steps.findIndex(s => s.id === currentStepId);
    return workflow.steps[currentIndex + 1]?.id;
  }

  // Approval management
  addApprovalRequest(approvalRequest: ApprovalRequest): void {
    this.approvalRequests.set(approvalRequest.id, approvalRequest);
    this.emit('approval:requested', approvalRequest);
  }

  async processApproval(
    approvalId: string,
    userId: string,
    decision: 'approved' | 'rejected',
    comment?: string
  ): Promise<void> {
    const approval = this.approvalRequests.get(approvalId);
    if (!approval) {
      throw new Error(`Approval request ${approvalId} not found`);
    }

    if (approval.status !== 'pending') {
      throw new Error(`Approval request ${approvalId} is not pending`);
    }

    if (!approval.approvers.includes(userId)) {
      throw new Error(`User ${userId} is not authorized to approve this request`);
    }

    // Check if user already approved/rejected
    const existingApproval = approval.approvals.find(a => a.userId === userId);
    if (existingApproval) {
      throw new Error(`User ${userId} has already provided a decision for this request`);
    }

    // Add approval/rejection
    approval.approvals.push({
      userId,
      decision,
      comment: comment || '',
      timestamp: new Date()
    });

    if (decision === 'approved') {
      approval.currentApprovals++;
    }

    // Check if approval requirements are met
    if (decision === 'rejected') {
      approval.status = 'rejected';
    } else if (approval.currentApprovals >= approval.requiredApprovals) {
      approval.status = 'approved';
    }

    logger.info('Approval processed', {
      approvalId,
      userId,
      decision,
      status: approval.status,
      currentApprovals: approval.currentApprovals,
      requiredApprovals: approval.requiredApprovals
    });

    this.emit('approval:processed', { approval, decision, userId });

    // Resume workflow if approved or rejected
    if (approval.status !== 'pending') {
      await this.resumeExecutionAfterApproval(approval);
    }
  }

  private async resumeExecutionAfterApproval(approval: ApprovalRequest): Promise<void> {
    const execution = this.executions.get(approval.executionId);
    if (!execution || execution.status !== 'paused') {
      return;
    }

    // Update execution variables with approval result
    execution.variables[`approval_${approval.stepId}`] = {
      status: approval.status,
      approvals: approval.approvals,
      approvedBy: approval.approvals.filter(a => a.decision === 'approved').map(a => a.userId)
    };

    logger.info('Resuming workflow execution after approval', {
      executionId: approval.executionId,
      approvalId: approval.id,
      approvalStatus: approval.status
    });

    // Resume execution
    this.executeWorkflow(approval.executionId).catch(error => {
      logger.error('Failed to resume workflow after approval', {
        executionId: approval.executionId,
        error: error.message
      });
    });
  }

  // Status and control methods
  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId);
  }

  getAllExecutions(workflowId?: string): WorkflowExecution[] {
    const executions = Array.from(this.executions.values());
    return workflowId ? executions.filter(e => e.workflowId === workflowId) : executions;
  }

  getApprovalRequest(approvalId: string): ApprovalRequest | undefined {
    return this.approvalRequests.get(approvalId);
  }

  getPendingApprovals(userId?: string): ApprovalRequest[] {
    const approvals = Array.from(this.approvalRequests.values())
      .filter(a => a.status === 'pending');
    
    return userId ? approvals.filter(a => a.approvers.includes(userId)) : approvals;
  }

  async cancelExecution(executionId: string, cancelledBy: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    if (!['pending', 'running', 'paused'].includes(execution.status)) {
      throw new Error(`Cannot cancel execution in status: ${execution.status}`);
    }

    execution.status = 'cancelled';
    execution.completedAt = new Date();
    execution.metadata.cancelledBy = cancelledBy;

    logger.info('Workflow execution cancelled', {
      executionId,
      workflowId: execution.workflowId,
      cancelledBy
    });

    this.emit('execution:cancelled', execution);
  }

  getStats(): {
    totalWorkflows: number;
    activeWorkflows: number;
    totalExecutions: number;
    runningExecutions: number;
    pendingApprovals: number;
    executionsByStatus: Record<string, number>;
  } {
    const executions = Array.from(this.executions.values());
    const executionsByStatus = executions.reduce((acc, exec) => {
      acc[exec.status] = (acc[exec.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalWorkflows: this.workflows.size,
      activeWorkflows: Array.from(this.workflows.values()).filter(w => w.enabled).length,
      totalExecutions: this.executions.size,
      runningExecutions: executions.filter(e => e.status === 'running').length,
      pendingApprovals: Array.from(this.approvalRequests.values()).filter(a => a.status === 'pending').length,
      executionsByStatus
    };
  }
}

// Singleton instance
let workflowEngine: WorkflowEngine | null = null;

export function getWorkflowEngine(): WorkflowEngine {
  if (!workflowEngine) {
    workflowEngine = new WorkflowEngine();
  }
  return workflowEngine;
}

export default WorkflowEngine;