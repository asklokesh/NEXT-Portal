/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { z } from 'zod';

import {
 TemplateEntitySchema,
 TaskSchema,
 ActionSchema,
 TaskEventSchema,
 TaskFilters,
 DryRunRequestSchema,
 DryRunResponseSchema,
 TemplatesResponseSchema,
 TaskResponseSchema,
 TasksResponseSchema,
 ActionsResponseSchema,
 TaskEventsResponseSchema,
 validateTemplateParameters,
 getTemplateRef
} from '../types/templates';
import { createBackstageClient } from '../utils/api-client';

import type { RequestOptions } from '../types/common';
import type {
 TemplateEntity,
 Task,
 Action,
 TaskEvent,
 ExecuteTemplateRequest,
 DryRunRequest,
 DryRunResponse,
 TaskStatus} from '../types/templates';
import type { BackstageApiClient} from '../utils/api-client';

// Additional response schemas
const ExecuteTemplateResponseSchema = z.object({
 taskId: z.string(),
});

const TaskLogResponseSchema = z.object({
 log: z.array(z.object({
 body: z.string(),
 createdAt: z.string(),
 level: z.enum(['debug', 'info', 'warn', 'error']),
 stepId: z.string().optional(),
 })),
});

// Type definitions
export type ExecuteTemplateResponse = z.infer<typeof ExecuteTemplateResponseSchema>;
export type TaskLogResponse = z.infer<typeof TaskLogResponseSchema>;

export interface TemplateExecutionOptions extends RequestOptions {
 dryRun?: boolean;
 secrets?: Record<string, string>;
}

export interface TaskQueryOptions {
 status?: TaskStatus | TaskStatus[];
 user?: string;
 template?: string;
 limit?: number;
 offset?: number;
 orderBy?: 'createdAt' | 'status';
 orderDirection?: 'asc' | 'desc';
}

export interface TaskLogOptions {
 after?: string;
 follow?: boolean;
 stepId?: string;
}

export class ScaffolderClient {
 private readonly client: BackstageApiClient;
 private readonly taskPollingIntervals = new Map<string, NodeJS.Timeout>();

 constructor() {
 this.client = createBackstageClient('scaffolder');
 }

 // Get all available templates
 async getTemplates(
 filters: Record<string, unknown> = {},
 options: RequestOptions = {}
 ): Promise<TemplateEntity[]> {
 const params = this.buildTemplateFilters(filters);
 
 const response = await this.client.request(
 {
 method: 'GET',
 url: '/v2/templates',
 params,
 },
 TemplatesResponseSchema,
 options
 );

 return response.items;
 }

 // Get template by reference
 async getTemplateByRef(
 templateRef: string,
 options: RequestOptions = {}
 ): Promise<TemplateEntity> {
 return this.client.request(
 {
 method: 'GET',
 url: `/v2/templates/${encodeURIComponent(templateRef)}`,
 },
 TemplateEntitySchema,
 options
 );
 }

 // Get template parameters schema
 async getTemplateParameterSchema(
 templateRef: string,
 options: RequestOptions = {}
 ): Promise<any> {
 const template = await this.getTemplateByRef(templateRef, options);
 return template.spec.parameters;
 }

 // Execute template (create new project/component)
 async executeTemplate(
 request: ExecuteTemplateRequest,
 options: TemplateExecutionOptions = {}
 ): Promise<{ taskId: string; task?: Task }> {
 // Validate template parameters if not dry run
 if (!options.dryRun) {
 const template = await this.getTemplateByRef(request.templateRef, options);
 const parametersSchema = Array.isArray(template.spec.parameters) 
 ? template.spec.parameters[0] 
 : template.spec.parameters;
 
 const validation = validateTemplateParameters(request.values, parametersSchema);
 if (!validation.valid) {
 throw new Error(`Parameter validation failed: ${validation.errors.join(', ')}`);
 }
 }

 const response = await this.client.request(
 {
 method: 'POST',
 url: '/v2/tasks',
 data: {
 templateRef: request.templateRef,
 values: request.values,
 secrets: request.secrets || options.secrets,
 dryRun: options.dryRun,
 },
 },
 ExecuteTemplateResponseSchema,
 { ...options, cache: false }
 );

 // If not dry run, optionally return the created task
 let task: Task | undefined;
 if (!options.dryRun) {
 try {
 task = await this.getTask(response.taskId, options);
 } catch (error) {
 console.warn('Could not fetch created task:', error);
 }
 }

 return {
 taskId: response.taskId,
 task,
 };
 }

 // Dry run template execution
 async dryRunTemplate(
 request: DryRunRequest,
 options: RequestOptions = {}
 ): Promise<DryRunResponse> {
 const validatedRequest = DryRunRequestSchema.parse(request);
 
 return this.client.request(
 {
 method: 'POST',
 url: '/v2/dry-run',
 data: validatedRequest,
 },
 DryRunResponseSchema,
 { ...options, cache: false }
 );
 }

 // Get task by ID
 async getTask(
 taskId: string,
 options: RequestOptions = {}
 ): Promise<Task> {
 return this.client.request(
 {
 method: 'GET',
 url: `/v2/tasks/${taskId}`,
 },
 TaskResponseSchema,
 options
 );
 }

 // Get all tasks with filtering
 async getTasks(
 queryOptions: TaskQueryOptions = {},
 options: RequestOptions = {}
 ): Promise<Task[]> {
 const params = this.buildTaskFilters(queryOptions);
 
 const response = await this.client.request(
 {
 method: 'GET',
 url: '/v2/tasks',
 params,
 },
 TasksResponseSchema,
 options
 );

 return response.tasks;
 }

 // Get tasks by user
 async getTasksByUser(
 userRef: string,
 queryOptions: Omit<TaskQueryOptions, 'user'> = {},
 options: RequestOptions = {}
 ): Promise<Task[]> {
 return this.getTasks({ ...queryOptions, user: userRef }, options);
 }

 // Get tasks by template
 async getTasksByTemplate(
 templateRef: string,
 queryOptions: Omit<TaskQueryOptions, 'template'> = {},
 options: RequestOptions = {}
 ): Promise<Task[]> {
 return this.getTasks({ ...queryOptions, template: templateRef }, options);
 }

 // Cancel task
 async cancelTask(
 taskId: string,
 options: RequestOptions = {}
 ): Promise<void> {
 await this.client.post(
 `/v2/tasks/${taskId}/cancel`,
 {},
 { ...options, cache: false }
 );
 }

 // Get task events
 async getTaskEvents(
 taskId: string,
 options: RequestOptions = {}
 ): Promise<TaskEvent[]> {
 const response = await this.client.request(
 {
 method: 'GET',
 url: `/v2/tasks/${taskId}/events`,
 },
 TaskEventsResponseSchema,
 options
 );

 return response.events;
 }

 // Get task logs
 async getTaskLogs(
 taskId: string,
 logOptions: TaskLogOptions = {},
 options: RequestOptions = {}
 ): Promise<TaskLogResponse> {
 const params: Record<string, unknown> = {};
 
 if (logOptions.after) {
 params.after = logOptions.after;
 }
 
 if (logOptions.stepId) {
 params.stepId = logOptions.stepId;
 }

 return this.client.request(
 {
 method: 'GET',
 url: `/v2/tasks/${taskId}/logs`,
 params,
 },
 TaskLogResponseSchema,
 options
 );
 }

 // Stream task logs with polling
 async streamTaskLogs(
 taskId: string,
 onLog: (log: { body: string; level: string; createdAt: string; stepId?: string }) => void,
 onError?: (error: Error) => void,
 pollInterval = 1000
 ): Promise<() => void> {
 let lastLogTime: string | undefined;
 let isPolling = true;

 const poll = async () => {
 if (!isPolling) return;

 try {
 const logs = await this.getTaskLogs(taskId, { after: lastLogTime });
 
 for (const log of logs.log) {
 onLog(log);
 lastLogTime = log.createdAt;
 }

 // Check if task is still running
 const task = await this.getTask(taskId);
 if (task.status !== 'processing') {
 isPolling = false;
 return;
 }

 setTimeout(poll, pollInterval);
 } catch (error) {
 isPolling = false;
 onError?.(error instanceof Error ? error : new Error('Unknown error'));
 }
 };

 poll();

 return () => {
 isPolling = false;
 };
 }

 // Wait for task completion
 async waitForTaskCompletion(
 taskId: string,
 options: {
 timeout?: number;
 pollInterval?: number;
 onProgress?: (task: Task) => void;
 } = {}
 ): Promise<Task> {
 const { timeout = 300000, pollInterval = 2000, onProgress } = options;
 const startTime = Date.now();

 return new Promise((resolve, reject) => {
 const poll = async () => {
 try {
 const task = await this.getTask(taskId);
 onProgress?.(task);

 if (task.status === 'completed') {
 resolve(task);
 return;
 }

 if (task.status === 'failed' || task.status === 'cancelled') {
 reject(new Error(`Task ${task.status}: ${task.id}`));
 return;
 }

 if (Date.now() - startTime > timeout) {
 reject(new Error(`Task timeout after ${timeout}ms`));
 return;
 }

 setTimeout(poll, pollInterval);
 } catch (error) {
 reject(error);
 }
 };

 poll();
 });
 }

 // Get available scaffolder actions
 async getActions(options: RequestOptions = {}): Promise<Action[]> {
 const response = await this.client.request(
 {
 method: 'GET',
 url: '/v2/actions',
 },
 ActionsResponseSchema,
 options
 );

 return response.actions;
 }

 // Get action by ID
 async getAction(
 actionId: string,
 options: RequestOptions = {}
 ): Promise<Action> {
 const actions = await this.getActions(options);
 const action = actions.find(a => a.id === actionId);
 
 if (!action) {
 throw new Error(`Action not found: ${actionId}`);
 }
 
 return action;
 }

 // Get template usage statistics
 async getTemplateStats(
 templateRef: string,
 options: RequestOptions = {}
 ): Promise<{
 totalExecutions: number;
 successfulExecutions: number;
 failedExecutions: number;
 averageExecutionTime: number;
 recentTasks: Task[];
 }> {
 const tasks = await this.getTasksByTemplate(templateRef, { limit: 100 }, options);
 
 const totalExecutions = tasks.length;
 const successfulExecutions = tasks.filter(t => t.status === 'completed').length;
 const failedExecutions = tasks.filter(t => t.status === 'failed').length;
 
 const completedTasks = tasks.filter(t => 
 t.status === 'completed' && t.steps && t.steps.length > 0
 );
 
 const averageExecutionTime = completedTasks.length > 0
 ? completedTasks.reduce((sum, task) => {
 const firstStep = task.steps?.[0];
 const lastStep = task.steps?.[task.steps.length - 1];
 if (firstStep?.startedAt && lastStep?.endedAt) {
 return sum + (new Date(lastStep.endedAt).getTime() - new Date(firstStep.startedAt).getTime());
 }
 return sum;
 }, 0) / completedTasks.length
 : 0;

 return {
 totalExecutions,
 successfulExecutions,
 failedExecutions,
 averageExecutionTime,
 recentTasks: tasks.slice(0, 10),
 };
 }

 // Build template filter parameters
 private buildTemplateFilters(filters: Record<string, unknown>): Record<string, unknown> {
 const params: Record<string, unknown> = {};

 if (filters.kind) {
 params['filter[kind]'] = filters.kind;
 }
 
 if (filters.type) {
 params['filter[spec.type]'] = filters.type;
 }
 
 if (filters.owner) {
 params['filter[spec.owner]'] = filters.owner;
 }

 if (filters.tags) {
 params['filter[metadata.tags]'] = filters.tags;
 }

 return params;
 }

 // Build task filter parameters
 private buildTaskFilters(queryOptions: TaskQueryOptions): Record<string, unknown> {
 const params: Record<string, unknown> = {};

 if (queryOptions.status) {
 params.status = Array.isArray(queryOptions.status) 
 ? queryOptions.status.join(',')
 : queryOptions.status;
 }
 
 if (queryOptions.user) {
 params.user = queryOptions.user;
 }
 
 if (queryOptions.template) {
 params.template = queryOptions.template;
 }
 
 if (queryOptions.limit) {
 params.limit = queryOptions.limit;
 }
 
 if (queryOptions.offset) {
 params.offset = queryOptions.offset;
 }
 
 if (queryOptions.orderBy) {
 params.orderBy = queryOptions.orderBy;
 }
 
 if (queryOptions.orderDirection) {
 params.orderDirection = queryOptions.orderDirection;
 }

 return params;
 }

 // Clear all cached data
 clearCache(): void {
 this.client.clearCache();
 }

 // Clean up polling intervals
 cleanup(): void {
 for (const interval of this.taskPollingIntervals.values()) {
 clearInterval(interval);
 }
 this.taskPollingIntervals.clear();
 }
}

// Export singleton instance
export const scaffolderClient = new ScaffolderClient();