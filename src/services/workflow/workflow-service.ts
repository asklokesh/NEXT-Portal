import { EventEmitter } from 'events';
import {
 WorkflowDefinition,
 WorkflowExecution,
 WorkflowStep,
 StepExecution,
 WorkflowTrigger,
 ApprovalStepConfig,
 ActionStepConfig,
 NotificationStepConfig,
 ConditionStepConfig,
 ParallelStepConfig,
 WaitStepConfig,
 ApprovalRecord,
 WorkflowCondition,
 WorkflowTemplate,
} from '@/types/workflow';
import { notificationService } from '@/services/notifications/notification-service';

export class WorkflowService extends EventEmitter {
 private workflows: Map<string, WorkflowDefinition> = new Map();
 private executions: Map<string, WorkflowExecution> = new Map();
 private executionEngine: WorkflowExecutionEngine;
 private templates: Map<string, WorkflowTemplate> = new Map();

 constructor() {
 super();
 this.executionEngine = new WorkflowExecutionEngine(this);
 this.loadDefaultTemplates();
 }

 // Workflow Management
 async createWorkflow(workflow: Omit<WorkflowDefinition, 'id' | 'metadata'>): Promise<WorkflowDefinition> {
 const id = `wf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
 const newWorkflow: WorkflowDefinition = {
 ...workflow,
 id,
 metadata: {
 createdBy: 'current-user', // TODO: Get from auth context
 createdAt: new Date(),
 updatedAt: new Date(),
 version: 1,
 tags: [],
 },
 status: 'draft',
 };

 this.workflows.set(id, newWorkflow);
 this.emit('workflow_created', newWorkflow);
 return newWorkflow;
 }

 async updateWorkflow(id: string, updates: Partial<WorkflowDefinition>): Promise<WorkflowDefinition> {
 const workflow = this.workflows.get(id);
 if (!workflow) {
 throw new Error(`Workflow ${id} not found`);
 }

 const updatedWorkflow: WorkflowDefinition = {
 ...workflow,
 ...updates,
 metadata: {
 ...workflow.metadata,
 updatedAt: new Date(),
 version: workflow.metadata.version + 1,
 },
 };

 this.workflows.set(id, updatedWorkflow);
 this.emit('workflow_updated', updatedWorkflow);
 return updatedWorkflow;
 }

 async deleteWorkflow(id: string): Promise<void> {
 const workflow = this.workflows.get(id);
 if (!workflow) {
 throw new Error(`Workflow ${id} not found`);
 }

 this.workflows.delete(id);
 this.emit('workflow_deleted', workflow);
 }

 getWorkflow(id: string): WorkflowDefinition | undefined {
 return this.workflows.get(id);
 }

 listWorkflows(filter?: {
 category?: string;
 status?: string;
 tags?: string[];
 }): WorkflowDefinition[] {
 let workflows = Array.from(this.workflows.values());

 if (filter) {
 if (filter.category) {
 workflows = workflows.filter(w => w.category === filter.category);
 }
 if (filter.status) {
 workflows = workflows.filter(w => w.status === filter.status);
 }
 if (filter.tags?.length) {
 workflows = workflows.filter(w => 
 filter.tags!.some(tag => w.metadata.tags.includes(tag))
 );
 }
 }

 return workflows;
 }

 // Workflow Execution
 async executeWorkflow(
 workflowId: string,
 context: Record<string, any> = {},
 triggeredBy: { type: 'user' | 'system' | 'schedule' | 'event'; id: string; name: string }
 ): Promise<WorkflowExecution> {
 const workflow = this.workflows.get(workflowId);
 if (!workflow) {
 throw new Error(`Workflow ${workflowId} not found`);
 }

 if (workflow.status !== 'active') {
 throw new Error(`Workflow ${workflowId} is not active`);
 }

 const execution: WorkflowExecution = {
 id: `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
 workflowId,
 workflowVersion: workflow.metadata.version,
 status: 'pending',
 startedAt: new Date(),
 triggeredBy,
 context,
 stepExecutions: [],
 };

 this.executions.set(execution.id, execution);
 this.emit('execution_started', execution);

 // Start execution asynchronously
 this.executionEngine.execute(execution, workflow).catch(error => {
 console.error('Workflow execution failed:', error);
 this.updateExecution(execution.id, {
 status: 'failed',
 error: {
 message: error.message,
 stepId: execution.currentStep || 'unknown',
 timestamp: new Date(),
 },
 });
 });

 return execution;
 }

 getExecution(id: string): WorkflowExecution | undefined {
 return this.executions.get(id);
 }

 listExecutions(filter?: {
 workflowId?: string;
 status?: string;
 startDate?: Date;
 endDate?: Date;
 }): WorkflowExecution[] {
 let executions = Array.from(this.executions.values());

 if (filter) {
 if (filter.workflowId) {
 executions = executions.filter(e => e.workflowId === filter.workflowId);
 }
 if (filter.status) {
 executions = executions.filter(e => e.status === filter.status);
 }
 if (filter.startDate) {
 executions = executions.filter(e => e.startedAt >= filter.startDate!);
 }
 if (filter.endDate) {
 executions = executions.filter(e => e.startedAt <= filter.endDate!);
 }
 }

 return executions.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
 }

 async cancelExecution(executionId: string): Promise<void> {
 const execution = this.executions.get(executionId);
 if (!execution) {
 throw new Error(`Execution ${executionId} not found`);
 }

 if (execution.status === 'completed' || execution.status === 'failed' || execution.status === 'cancelled') {
 throw new Error(`Execution ${executionId} is already ${execution.status}`);
 }

 this.updateExecution(executionId, {
 status: 'cancelled',
 completedAt: new Date(),
 });

 this.emit('execution_cancelled', execution);
 }

 // Approval Management
 async submitApproval(
 executionId: string,
 stepId: string,
 decision: 'approved' | 'rejected',
 approverId: string,
 approverName: string,
 comment?: string,
 fields?: Record<string, any>
 ): Promise<void> {
 const execution = this.executions.get(executionId);
 if (!execution) {
 throw new Error(`Execution ${executionId} not found`);
 }

 const stepExecution = execution.stepExecutions.find(s => s.stepId === stepId);
 if (!stepExecution) {
 throw new Error(`Step ${stepId} not found in execution`);
 }

 if (stepExecution.status !== 'waiting_approval') {
 throw new Error(`Step ${stepId} is not waiting for approval`);
 }

 const approval: ApprovalRecord = {
 approverId,
 approverName,
 decision,
 timestamp: new Date(),
 comment,
 fields,
 };

 if (!stepExecution.approvals) {
 stepExecution.approvals = [];
 }
 stepExecution.approvals.push(approval);

 this.emit('approval_submitted', { executionId, stepId, approval });

 // Check if approval requirements are met
 const workflow = this.workflows.get(execution.workflowId);
 if (workflow) {
 const step = workflow.steps.find(s => s.id === stepId);
 if (step && step.type === 'approval') {
 const config = step.configuration as ApprovalStepConfig;
 const approved = this.checkApprovalRequirements(stepExecution.approvals, config);
 
 if (approved !== null) {
 // Approval decision reached
 stepExecution.status = approved ? 'completed' : 'failed';
 stepExecution.completedAt = new Date();
 stepExecution.output = { approved, approvals: stepExecution.approvals };
 
 // Continue workflow execution
 this.executionEngine.continueExecution(execution, workflow, step);
 }
 }
 }
 }

 private checkApprovalRequirements(
 approvals: ApprovalRecord[],
 config: ApprovalStepConfig
 ): boolean | null {
 const approved = approvals.filter(a => a.decision === 'approved').length;
 const rejected = approvals.filter(a => a.decision === 'rejected').length;

 switch (config.approvalType) {
 case 'all':
 if (rejected > 0) return false;
 if (approved === config.approvers.length) return true;
 return null; // Still waiting

 case 'any':
 if (approved > 0) return true;
 if (rejected === config.approvers.length) return false;
 return null;

 case 'threshold':
 const threshold = config.threshold || 1;
 if (approved >= threshold) return true;
 if (config.approvers.length - rejected < threshold) return false;
 return null;

 default:
 return null;
 }
 }

 // Internal methods
 updateExecution(id: string, updates: Partial<WorkflowExecution>): void {
 const execution = this.executions.get(id);
 if (execution) {
 Object.assign(execution, updates);
 this.emit('execution_updated', execution);
 }
 }

 // Template Management
 getTemplates(): WorkflowTemplate[] {
 return Array.from(this.templates.values());
 }

 getTemplate(id: string): WorkflowTemplate | undefined {
 return this.templates.get(id);
 }

 private loadDefaultTemplates(): void {
 // Service Approval Template
 this.templates.set('service-approval', {
 id: 'service-approval',
 name: 'Service Approval Workflow',
 description: 'Approval workflow for new service creation',
 category: 'approval',
 icon: 'CheckCircle',
 definition: {
 name: 'Service Creation Approval',
 category: 'approval',
 triggers: [{
 id: 'trigger-1',
 type: 'event',
 configuration: {
 eventType: 'entity.created',
 entityKind: 'Component',
 },
 }],
 steps: [
 {
 id: 'approval-1',
 name: 'Team Lead Approval',
 type: 'approval',
 configuration: {
 type: 'approval',
 approvers: [{ type: 'role', value: 'team-lead' }],
 approvalType: 'any',
 expiresIn: 48,
 template: {
 title: 'New Service Approval Required',
 description: 'A new service "${context.entity.metadata.name}" requires your approval.',
 fields: [
 {
 id: 'reason',
 label: 'Reason for decision',
 type: 'textarea',
 required: true,
 },
 ],
 },
 } as ApprovalStepConfig,
 onSuccess: ['notification-1'],
 onFailure: ['notification-2'],
 },
 {
 id: 'notification-1',
 name: 'Notify Success',
 type: 'notification',
 configuration: {
 type: 'notification',
 channels: ['email', 'in_app'],
 recipients: [{ type: 'owner', value: '${context.entity.spec.owner}' }],
 template: {
 subject: 'Service Approved',
 body: 'Your service "${context.entity.metadata.name}" has been approved.',
 priority: 'medium',
 },
 } as NotificationStepConfig,
 },
 {
 id: 'notification-2',
 name: 'Notify Rejection',
 type: 'notification',
 configuration: {
 type: 'notification',
 channels: ['email', 'in_app'],
 recipients: [{ type: 'owner', value: '${context.entity.spec.owner}' }],
 template: {
 subject: 'Service Rejected',
 body: 'Your service "${context.entity.metadata.name}" has been rejected. Reason: ${step.approval-1.approvals[0].comment}',
 priority: 'high',
 },
 } as NotificationStepConfig,
 },
 ],
 },
 parameters: [],
 });

 // Deployment Approval Template
 this.templates.set('deployment-approval', {
 id: 'deployment-approval',
 name: 'Production Deployment Approval',
 description: 'Multi-stage approval for production deployments',
 category: 'deployment',
 icon: 'Rocket',
 definition: {
 name: 'Production Deployment Approval',
 category: 'deployment',
 triggers: [{
 id: 'trigger-1',
 type: 'manual',
 configuration: {},
 }],
 steps: [
 {
 id: 'check-1',
 name: 'Pre-deployment Checks',
 type: 'action',
 configuration: {
 type: 'action',
 actionType: 'api_call',
 apiCall: {
 method: 'GET',
 url: '${context.healthCheckUrl}',
 headers: {
 'Content-Type': 'application/json',
 },
 },
 } as ActionStepConfig,
 onSuccess: ['approval-1'],
 onFailure: ['notification-fail'],
 },
 {
 id: 'approval-1',
 name: 'QA Approval',
 type: 'approval',
 configuration: {
 type: 'approval',
 approvers: [{ type: 'group', value: 'qa-team' }],
 approvalType: 'threshold',
 threshold: 2,
 expiresIn: 24,
 template: {
 title: 'Production Deployment Approval',
 description: 'Please review and approve the deployment to production.',
 fields: [
 {
 id: 'tests_passed',
 label: 'All tests passed?',
 type: 'checkbox',
 required: true,
 },
 {
 id: 'notes',
 label: 'Additional notes',
 type: 'textarea',
 required: false,
 },
 ],
 },
 } as ApprovalStepConfig,
 onSuccess: ['approval-2'],
 onFailure: ['notification-fail'],
 },
 {
 id: 'approval-2',
 name: 'Manager Approval',
 type: 'approval',
 configuration: {
 type: 'approval',
 approvers: [{ type: 'role', value: 'engineering-manager' }],
 approvalType: 'any',
 expiresIn: 12,
 template: {
 title: 'Final Production Deployment Approval',
 description: 'QA has approved. Please provide final approval for production deployment.',
 },
 escalation: {
 after: 6,
 to: [{ type: 'role', value: 'cto' }],
 },
 } as ApprovalStepConfig,
 onSuccess: ['deploy-1'],
 onFailure: ['notification-fail'],
 },
 {
 id: 'deploy-1',
 name: 'Deploy to Production',
 type: 'action',
 configuration: {
 type: 'action',
 actionType: 'api_call',
 apiCall: {
 method: 'POST',
 url: '${context.deploymentUrl}',
 headers: {
 'Content-Type': 'application/json',
 'Authorization': 'Bearer ${secrets.deploymentToken}',
 },
 body: {
 environment: 'production',
 version: '${context.version}',
 },
 },
 } as ActionStepConfig,
 onSuccess: ['notification-success'],
 onFailure: ['rollback-1'],
 retryPolicy: {
 maxAttempts: 3,
 delaySeconds: 30,
 },
 },
 {
 id: 'rollback-1',
 name: 'Rollback Deployment',
 type: 'action',
 configuration: {
 type: 'action',
 actionType: 'api_call',
 apiCall: {
 method: 'POST',
 url: '${context.rollbackUrl}',
 headers: {
 'Content-Type': 'application/json',
 'Authorization': 'Bearer ${secrets.deploymentToken}',
 },
 },
 } as ActionStepConfig,
 onSuccess: ['notification-rollback'],
 },
 {
 id: 'notification-success',
 name: 'Notify Success',
 type: 'notification',
 configuration: {
 type: 'notification',
 channels: ['email', 'slack', 'in_app'],
 recipients: [
 { type: 'group', value: 'engineering' },
 { type: 'group', value: 'qa-team' },
 ],
 template: {
 subject: 'Production Deployment Successful',
 body: 'Version ${context.version} has been successfully deployed to production.',
 priority: 'medium',
 },
 } as NotificationStepConfig,
 },
 {
 id: 'notification-fail',
 name: 'Notify Failure',
 type: 'notification',
 configuration: {
 type: 'notification',
 channels: ['email', 'slack', 'in_app'],
 recipients: [
 { type: 'user', value: '${context.initiator}' },
 { type: 'group', value: 'oncall' },
 ],
 template: {
 subject: 'Production Deployment Failed',
 body: 'Deployment failed at step: ${context.failedStep}. Error: ${context.error}',
 priority: 'urgent',
 },
 } as NotificationStepConfig,
 },
 {
 id: 'notification-rollback',
 name: 'Notify Rollback',
 type: 'notification',
 configuration: {
 type: 'notification',
 channels: ['email', 'slack', 'in_app'],
 recipients: [
 { type: 'group', value: 'engineering' },
 { type: 'group', value: 'oncall' },
 ],
 template: {
 subject: 'Production Deployment Rolled Back',
 body: 'Deployment was rolled back due to failure. Please investigate.',
 priority: 'high',
 },
 } as NotificationStepConfig,
 },
 ],
 },
 parameters: [
 {
 id: 'healthCheckUrl',
 name: 'Health Check URL',
 type: 'string',
 required: true,
 description: 'URL to check service health before deployment',
 },
 {
 id: 'deploymentUrl',
 name: 'Deployment API URL',
 type: 'string',
 required: true,
 },
 {
 id: 'rollbackUrl',
 name: 'Rollback API URL',
 type: 'string',
 required: true,
 },
 {
 id: 'version',
 name: 'Version to Deploy',
 type: 'string',
 required: true,
 },
 ],
 });
 }
}

// Workflow Execution Engine
class WorkflowExecutionEngine {
 constructor(private workflowService: WorkflowService) {}

 async execute(execution: WorkflowExecution, workflow: WorkflowDefinition): Promise<void> {
 execution.status = 'running';
 this.workflowService.updateExecution(execution.id, { status: 'running' });

 try {
 // Find the first step(s) to execute
 const firstSteps = this.getInitialSteps(workflow);
 
 for (const step of firstSteps) {
 await this.executeStep(execution, workflow, step);
 }
 } catch (error) {
 console.error('Workflow execution error:', error);
 execution.status = 'failed';
 execution.completedAt = new Date();
 execution.error = {
 message: error instanceof Error ? error.message : 'Unknown error',
 stepId: execution.currentStep || 'unknown',
 timestamp: new Date(),
 };
 this.workflowService.updateExecution(execution.id, execution);
 }
 }

 private getInitialSteps(workflow: WorkflowDefinition): WorkflowStep[] {
 // Find steps that are not referenced as next steps by any other step
 const allNextSteps = new Set<string>();
 workflow.steps.forEach(step => {
 step.onSuccess?.forEach(id => allNextSteps.add(id));
 step.onFailure?.forEach(id => allNextSteps.add(id));
 });

 return workflow.steps.filter(step => !allNextSteps.has(step.id));
 }

 async executeStep(
 execution: WorkflowExecution,
 workflow: WorkflowDefinition,
 step: WorkflowStep
 ): Promise<void> {
 execution.currentStep = step.id;
 this.workflowService.updateExecution(execution.id, { currentStep: step.id });

 const stepExecution: StepExecution = {
 stepId: step.id,
 status: 'running',
 startedAt: new Date(),
 };

 execution.stepExecutions.push(stepExecution);

 try {
 switch (step.type) {
 case 'approval':
 await this.executeApprovalStep(execution, step, stepExecution);
 break;
 case 'action':
 await this.executeActionStep(execution, step, stepExecution);
 break;
 case 'notification':
 await this.executeNotificationStep(execution, step, stepExecution);
 break;
 case 'condition':
 await this.executeConditionStep(execution, step, stepExecution);
 break;
 case 'parallel':
 await this.executeParallelStep(execution, workflow, step, stepExecution);
 break;
 case 'wait':
 await this.executeWaitStep(execution, step, stepExecution);
 break;
 }

 // Execute next steps if this step completed successfully
 if (stepExecution.status === 'completed' && step.onSuccess) {
 for (const nextStepId of step.onSuccess) {
 const nextStep = workflow.steps.find(s => s.id === nextStepId);
 if (nextStep) {
 await this.executeStep(execution, workflow, nextStep);
 }
 }
 } else if (stepExecution.status === 'failed' && step.onFailure) {
 for (const nextStepId of step.onFailure) {
 const nextStep = workflow.steps.find(s => s.id === nextStepId);
 if (nextStep) {
 await this.executeStep(execution, workflow, nextStep);
 }
 }
 }

 // Check if workflow is complete
 if (this.isWorkflowComplete(execution, workflow)) {
 execution.status = 'completed';
 execution.completedAt = new Date();
 this.workflowService.updateExecution(execution.id, execution);
 }
 } catch (error) {
 stepExecution.status = 'failed';
 stepExecution.completedAt = new Date();
 stepExecution.error = error instanceof Error ? error.message : 'Unknown error';
 
 if (step.retryPolicy && (!stepExecution.retryCount || stepExecution.retryCount < step.retryPolicy.maxAttempts)) {
 // Retry the step
 stepExecution.retryCount = (stepExecution.retryCount || 0) + 1;
 await new Promise(resolve => setTimeout(resolve, step.retryPolicy!.delaySeconds * 1000));
 await this.executeStep(execution, workflow, step);
 } else {
 throw error;
 }
 }
 }

 private async executeApprovalStep(
 execution: WorkflowExecution,
 step: WorkflowStep,
 stepExecution: StepExecution
 ): Promise<void> {
 const config = step.configuration as ApprovalStepConfig;
 stepExecution.status = 'waiting_approval';
 
 // Send notifications to approvers
 const notification = {
 title: config.template?.title || 'Approval Required',
 message: this.interpolateString(
 config.template?.description || 'Your approval is required for workflow execution',
 execution.context
 ),
 type: 'approval' as const,
 category: 'approval' as const,
 priority: 'high' as const,
 metadata: {
 workflowId: execution.workflowId,
 executionId: execution.id,
 stepId: step.id,
 },
 actions: [
 {
 id: 'approve',
 label: 'Approve',
 action: 'workflow.approve',
 style: 'primary' as const,
 },
 {
 id: 'reject',
 label: 'Reject',
 action: 'workflow.reject',
 style: 'danger' as const,
 },
 ],
 };

 // Notify approvers
 for (const approver of config.approvers) {
 if (approver.type === 'user') {
 notificationService.handleNotification(notification);
 } else if (approver.type === 'group' || approver.type === 'role') {
 // In real implementation, resolve group/role to users
 notificationService.handleNotification(notification);
 }
 }

 // Set up escalation if configured
 if (config.escalation) {
 setTimeout(() => {
 if (stepExecution.status === 'waiting_approval') {
 // Escalate to additional approvers
 for (const escalationApprover of config.escalation!.to) {
 notificationService.handleNotification({
 ...notification,
 title: `[ESCALATED] ${notification.title}`,
 priority: 'urgent' as const,
 });
 }
 }
 }, config.escalation.after * 60 * 60 * 1000);
 }

 // Set expiration timer
 if (config.expiresIn) {
 setTimeout(() => {
 if (stepExecution.status === 'waiting_approval') {
 stepExecution.status = 'failed';
 stepExecution.completedAt = new Date();
 stepExecution.error = 'Approval expired';
 }
 }, config.expiresIn * 60 * 60 * 1000);
 }
 }

 private async executeActionStep(
 execution: WorkflowExecution,
 step: WorkflowStep,
 stepExecution: StepExecution
 ): Promise<void> {
 const config = step.configuration as ActionStepConfig;
 
 switch (config.actionType) {
 case 'api_call':
 if (config.apiCall) {
 // Interpolate URL and body with context
 const url = this.interpolateString(config.apiCall.url, execution.context);
 const headers = this.interpolateObject(config.apiCall.headers || {}, execution.context);
 const body = config.apiCall.body ? 
 this.interpolateObject(config.apiCall.body, execution.context) : undefined;

 try {
 const response = await fetch(url, {
 method: config.apiCall.method,
 headers: headers as HeadersInit,
 body: body ? JSON.stringify(body) : undefined,
 });

 if (!response.ok) {
 throw new Error(`API call failed: ${response.statusText}`);
 }

 const result = await response.json();
 stepExecution.output = result;
 stepExecution.status = 'completed';
 stepExecution.completedAt = new Date();
 } catch (error) {
 stepExecution.status = 'failed';
 stepExecution.error = error instanceof Error ? error.message : 'API call failed';
 stepExecution.completedAt = new Date();
 throw error;
 }
 }
 break;

 case 'script':
 // In real implementation, execute script in sandboxed environment
 stepExecution.status = 'completed';
 stepExecution.completedAt = new Date();
 break;

 case 'backstage_action':
 // Execute Backstage-specific actions
 if (config.backstageAction) {
 // Implementation would call Backstage APIs
 stepExecution.status = 'completed';
 stepExecution.completedAt = new Date();
 }
 break;

 default:
 stepExecution.status = 'completed';
 stepExecution.completedAt = new Date();
 }
 }

 private async executeNotificationStep(
 execution: WorkflowExecution,
 step: WorkflowStep,
 stepExecution: StepExecution
 ): Promise<void> {
 const config = step.configuration as NotificationStepConfig;
 
 const notification = {
 title: this.interpolateString(config.template.subject || 'Workflow Notification', execution.context),
 message: this.interpolateString(config.template.body, execution.context),
 type: 'info' as const,
 category: 'system' as const,
 priority: config.template.priority || 'medium' as const,
 metadata: {
 workflowId: execution.workflowId,
 executionId: execution.id,
 stepId: step.id,
 },
 };

 // Send notifications through configured channels
 for (const channel of config.channels) {
 if (channel === 'in_app') {
 notificationService.handleNotification(notification);
 }
 // Other channels would be implemented here
 }

 stepExecution.status = 'completed';
 stepExecution.completedAt = new Date();
 }

 private async executeConditionStep(
 execution: WorkflowExecution,
 step: WorkflowStep,
 stepExecution: StepExecution
 ): Promise<void> {
 const config = step.configuration as ConditionStepConfig;
 
 const result = this.evaluateConditions(
 config.conditions,
 config.operator,
 execution.context
 );

 stepExecution.output = { conditionMet: result };
 stepExecution.status = result ? 'completed' : 'failed';
 stepExecution.completedAt = new Date();
 }

 private async executeParallelStep(
 execution: WorkflowExecution,
 workflow: WorkflowDefinition,
 step: WorkflowStep,
 stepExecution: StepExecution
 ): Promise<void> {
 const config = step.configuration as ParallelStepConfig;
 
 const branchPromises = config.branches.map(async branch => {
 for (const stepId of branch.steps) {
 const branchStep = workflow.steps.find(s => s.id === stepId);
 if (branchStep) {
 await this.executeStep(execution, workflow, branchStep);
 }
 }
 });

 if (config.waitForAll) {
 await Promise.all(branchPromises);
 } else {
 await Promise.race(branchPromises);
 }

 stepExecution.status = 'completed';
 stepExecution.completedAt = new Date();
 }

 private async executeWaitStep(
 execution: WorkflowExecution,
 step: WorkflowStep,
 stepExecution: StepExecution
 ): Promise<void> {
 const config = step.configuration as WaitStepConfig;
 
 if (config.duration) {
 await new Promise(resolve => setTimeout(resolve, config.duration * 1000));
 }

 stepExecution.status = 'completed';
 stepExecution.completedAt = new Date();
 }

 continueExecution(
 execution: WorkflowExecution,
 workflow: WorkflowDefinition,
 completedStep: WorkflowStep
 ): void {
 // Find the step execution
 const stepExecution = execution.stepExecutions.find(
 se => se.stepId === completedStep.id
 );

 if (!stepExecution) return;

 // Continue with next steps based on the outcome
 const nextStepIds = stepExecution.status === 'completed' 
 ? completedStep.onSuccess 
 : completedStep.onFailure;

 if (nextStepIds) {
 for (const nextStepId of nextStepIds) {
 const nextStep = workflow.steps.find(s => s.id === nextStepId);
 if (nextStep) {
 this.executeStep(execution, workflow, nextStep).catch(error => {
 console.error('Error executing next step:', error);
 });
 }
 }
 }

 // Check if workflow is complete
 if (this.isWorkflowComplete(execution, workflow)) {
 execution.status = 'completed';
 execution.completedAt = new Date();
 this.workflowService.updateExecution(execution.id, execution);
 }
 }

 private isWorkflowComplete(
 execution: WorkflowExecution,
 workflow: WorkflowDefinition
 ): boolean {
 // Check if all reachable steps have been executed
 const executedSteps = new Set(execution.stepExecutions.map(se => se.stepId));
 const pendingSteps = workflow.steps.filter(
 step => !executedSteps.has(step.id) && this.isStepReachable(step, execution, workflow)
 );

 return pendingSteps.length === 0 && 
 !execution.stepExecutions.some(se => 
 se.status === 'running' || se.status === 'waiting_approval'
 );
 }

 private isStepReachable(
 step: WorkflowStep,
 execution: WorkflowExecution,
 workflow: WorkflowDefinition
 ): boolean {
 // Check if this step can be reached based on executed steps
 // This is a simplified version - real implementation would be more complex
 return true;
 }

 private evaluateConditions(
 conditions: WorkflowCondition[],
 operator: 'and' | 'or',
 context: Record<string, any>
 ): boolean {
 const results = conditions.map(condition => 
 this.evaluateCondition(condition, context)
 );

 return operator === 'and' 
 ? results.every(r => r) 
 : results.some(r => r);
 }

 private evaluateCondition(
 condition: WorkflowCondition,
 context: Record<string, any>
 ): boolean {
 const value = this.getValueFromPath(condition.field, context);

 switch (condition.operator) {
 case 'equals':
 return value === condition.value;
 case 'not_equals':
 return value !== condition.value;
 case 'contains':
 return String(value).includes(String(condition.value));
 case 'starts_with':
 return String(value).startsWith(String(condition.value));
 case 'ends_with':
 return String(value).endsWith(String(condition.value));
 case 'greater_than':
 return Number(value) > Number(condition.value);
 case 'less_than':
 return Number(value) < Number(condition.value);
 case 'in':
 return Array.isArray(condition.value) && condition.value.includes(value);
 case 'not_in':
 return Array.isArray(condition.value) && !condition.value.includes(value);
 default:
 return false;
 }
 }

 private getValueFromPath(path: string, obj: Record<string, any>): any {
 return path.split('.').reduce((current, key) => current?.[key], obj);
 }

 private interpolateString(template: string, context: Record<string, any>): string {
 return template.replace(/\${([^}]+)}/g, (match, path) => {
 const value = this.getValueFromPath(path, context);
 return value !== undefined ? String(value) : match;
 });
 }

 private interpolateObject(obj: any, context: Record<string, any>): any {
 if (typeof obj === 'string') {
 return this.interpolateString(obj, context);
 }
 if (Array.isArray(obj)) {
 return obj.map(item => this.interpolateObject(item, context));
 }
 if (typeof obj === 'object' && obj !== null) {
 const result: Record<string, any> = {};
 for (const [key, value] of Object.entries(obj)) {
 result[key] = this.interpolateObject(value, context);
 }
 return result;
 }
 return obj;
 }

 private retryCount?: number;
}

// Export singleton instance
export const workflowService = new WorkflowService();