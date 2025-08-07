/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { z } from 'zod';

import { BaseEntitySchema, EntityMetadataSchema } from './common';

// Template parameter schemas
export const TemplateParameterPropertySchema = z.object({
 title: z.string(),
 type: z.enum(['string', 'number', 'integer', 'boolean', 'array', 'object']),
 description: z.string().optional(),
 default: z.unknown().optional(),
 enum: z.array(z.unknown()).optional(),
 pattern: z.string().optional(),
 format: z.string().optional(),
 minLength: z.number().optional(),
 maxLength: z.number().optional(),
 minimum: z.number().optional(),
 maximum: z.number().optional(),
 items: z.lazy(() => TemplateParameterPropertySchema).optional(),
 properties: z.record(z.lazy(() => TemplateParameterPropertySchema)).optional(),
 required: z.array(z.string()).optional(),
 'ui:field': z.string().optional(),
 'ui:widget': z.string().optional(),
 'ui:options': z.record(z.unknown()).optional(),
 'ui:help': z.string().optional(),
 'ui:placeholder': z.string().optional(),
});

export const TemplateParametersSchema = z.object({
 title: z.string().optional(),
 description: z.string().optional(),
 type: z.literal('object'),
 properties: z.record(TemplateParameterPropertySchema),
 required: z.array(z.string()).optional(),
 dependencies: z.record(z.unknown()).optional(),
});

// Template step schemas
export const TemplateStepSchema = z.object({
 id: z.string(),
 name: z.string(),
 action: z.string(),
 input: z.record(z.unknown()).optional(),
 if: z.string().optional(),
});

// Template entity spec
export const TemplateSpecSchema = z.object({
 type: z.string(),
 parameters: z.union([
 TemplateParametersSchema,
 z.array(TemplateParametersSchema),
 ]),
 steps: z.array(TemplateStepSchema),
 output: z.record(z.unknown()).optional(),
 owner: z.string(),
});

// Template entity
export const TemplateEntitySchema = BaseEntitySchema.extend({
 kind: z.literal('Template'),
 spec: TemplateSpecSchema,
});

// Scaffolder task schemas
export const TaskSpecSchema = z.object({
 templateInfo: z.object({
 entityRef: z.string(),
 baseUrl: z.string().optional(),
 }),
 parameters: z.record(z.unknown()),
 user: z.object({
 entity: z.string(),
 ref: z.string(),
 }).optional(),
 secrets: z.record(z.string()).optional(),
});

export const TaskStatusSchema = z.enum([
 'open',
 'processing',
 'failed',
 'completed',
 'cancelled',
]);

export const TaskStepSchema = z.object({
 id: z.string(),
 name: z.string(),
 action: z.string(),
 startedAt: z.string().optional(),
 endedAt: z.string().optional(),
 status: TaskStatusSchema,
 log: z.array(z.object({
 body: z.string(),
 createdAt: z.string(),
 level: z.enum(['debug', 'info', 'warn', 'error']),
 })).optional(),
});

export const TaskSchema = z.object({
 id: z.string(),
 spec: TaskSpecSchema,
 status: TaskStatusSchema,
 lastHeartbeatAt: z.string().optional(),
 createdAt: z.string(),
 steps: z.array(TaskStepSchema).optional(),
});

// Action schemas
export const ActionParameterSchema = z.object({
 title: z.string(),
 type: z.string(),
 description: z.string().optional(),
 required: z.boolean().optional(),
 default: z.unknown().optional(),
 enum: z.array(z.unknown()).optional(),
 examples: z.array(z.unknown()).optional(),
});

export const ActionSchema = z.object({
 id: z.string(),
 description: z.string(),
 supportsDryRun: z.boolean().optional(),
 schema: z.object({
 input: z.object({
 type: z.literal('object'),
 properties: z.record(ActionParameterSchema),
 required: z.array(z.string()).optional(),
 }).optional(),
 output: z.object({
 type: z.literal('object'),
 properties: z.record(ActionParameterSchema),
 required: z.array(z.string()).optional(),
 }).optional(),
 }).optional(),
});

// Scaffolder task event
export const TaskEventSchema = z.object({
 id: z.number(),
 taskId: z.string(),
 body: z.record(z.unknown()),
 eventType: z.enum(['completion', 'log']),
 createdAt: z.string(),
});

// API response schemas
export const TemplatesResponseSchema = z.object({
 items: z.array(TemplateEntitySchema),
});

export const TaskResponseSchema = TaskSchema;

export const TasksResponseSchema = z.object({
 tasks: z.array(TaskSchema),
});

export const ActionsResponseSchema = z.object({
 actions: z.array(ActionSchema),
});

export const TaskEventsResponseSchema = z.object({
 events: z.array(TaskEventSchema),
});

// Dry run schemas
export const DryRunRequestSchema = z.object({
 templateRef: z.string(),
 values: z.record(z.unknown()),
});

export const DryRunResponseSchema = z.object({
 steps: z.array(z.object({
 id: z.string(),
 name: z.string(),
 action: z.string(),
 input: z.record(z.unknown()),
 output: z.record(z.unknown()).optional(),
 })),
 log: z.array(z.object({
 body: z.string(),
 level: z.enum(['debug', 'info', 'warn', 'error']),
 })),
});

// Type exports
export type TemplateParameterProperty = z.infer<typeof TemplateParameterPropertySchema>;
export type TemplateParameters = z.infer<typeof TemplateParametersSchema>;
export type TemplateStep = z.infer<typeof TemplateStepSchema>;
export type TemplateSpec = z.infer<typeof TemplateSpecSchema>;
export type TemplateEntity = z.infer<typeof TemplateEntitySchema>;
export type TaskSpec = z.infer<typeof TaskSpecSchema>;
export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export type TaskStep = z.infer<typeof TaskStepSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type ActionParameter = z.infer<typeof ActionParameterSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type TaskEvent = z.infer<typeof TaskEventSchema>;
export type DryRunRequest = z.infer<typeof DryRunRequestSchema>;
export type DryRunResponse = z.infer<typeof DryRunResponseSchema>;

// Response types
export type TemplatesResponse = z.infer<typeof TemplatesResponseSchema>;
export type TaskResponse = z.infer<typeof TaskResponseSchema>;
export type TasksResponse = z.infer<typeof TasksResponseSchema>;
export type ActionsResponse = z.infer<typeof ActionsResponseSchema>;
export type TaskEventsResponse = z.infer<typeof TaskEventsResponseSchema>;

// Query parameter types
export interface TemplateFilters {
 kind?: string;
 'metadata.name'?: string;
 'metadata.namespace'?: string;
 'metadata.tags'?: string[];
 'spec.type'?: string;
 'spec.owner'?: string;
}

export interface TaskFilters {
 status?: TaskStatus | TaskStatus[];
 user?: string;
 template?: string;
 createdAfter?: string;
 createdBefore?: string;
}

export interface ExecuteTemplateRequest {
 templateRef: string;
 values: Record<string, unknown>;
 secrets?: Record<string, string>;
 dryRun?: boolean;
}

// Template validation helpers
export function validateTemplateParameters(
 parameters: Record<string, unknown>,
 schema: TemplateParameters
): { valid: boolean; errors: string[] } {
 try {
 // Basic validation - in real implementation, use JSON Schema validator
 const required = schema.required || [];
 const missing = required.filter(key => !(key in parameters));
 
 if (missing.length > 0) {
 return {
 valid: false,
 errors: missing.map(key => `Required parameter '${key}' is missing`),
 };
 }
 
 return { valid: true, errors: [] };
 } catch (error) {
 return { valid: false, errors: ['Parameter validation failed'] };
 }
}

// Template helper functions
export function getTemplateRef(template: TemplateEntity): string {
 const { kind, metadata } = template;
 const namespace = metadata.namespace || 'default';
 return `${kind}:${namespace}/${metadata.name}`;
}

export function isTaskCompleted(task: Task): boolean {
 return task.status === 'completed';
}

export function isTaskFailed(task: Task): boolean {
 return task.status === 'failed';
}

export function isTaskRunning(task: Task): boolean {
 return task.status === 'processing';
}

export function getTaskProgress(task: Task): { completed: number; total: number; percentage: number } {
 const steps = task.steps || [];
 const total = steps.length;
 const completed = steps.filter(step => 
 step.status === 'completed' || step.status === 'failed'
 ).length;
 
 return {
 completed,
 total,
 percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
 };
}

export function getLatestTaskLog(task: Task): string | null {
 const steps = task.steps || [];
 const logsWithTimestamp = steps
 .flatMap(step => (step.log || []).map(log => ({ ...log, stepId: step.id })))
 .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
 
 return logsWithTimestamp.length > 0 ? logsWithTimestamp[0].body : null;
}