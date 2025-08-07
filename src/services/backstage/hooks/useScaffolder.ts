/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';

import { scaffolderClient } from '../clients/scaffolder.client';

import type { RequestOptions } from '../types/common';
import type { 
 TemplateEntity,
 Task,
 Action,
 TaskEvent,
 TaskQueryOptions,
 ExecuteTemplateRequest,
 DryRunRequest,
 DryRunResponse,
 TaskLogResponse,
} from '../types/templates';

// Hook options with common configurations
interface UseScaffolderOptions extends Omit<UseQueryOptions<any, Error>, 'queryKey' | 'queryFn'> {
 requestOptions?: RequestOptions;
}

interface UseScaffolderMutationOptions<TData, TVariables> extends UseMutationOptions<TData, Error, TVariables> {
 requestOptions?: RequestOptions;
}

// Get templates hook
export function useTemplates(
 filters: Record<string, unknown> = {},
 options: UseScaffolderOptions = {}
) {
 const { requestOptions, ...queryOptions } = options;
 
 return useQuery({
 queryKey: ['scaffolder', 'templates', filters],
 queryFn: () => scaffolderClient.getTemplates(filters, requestOptions),
 staleTime: 10 * 60 * 1000, // 10 minutes
 ...queryOptions,
 });
}

// Get template by reference hook
export function useTemplate(
 templateRef: string,
 options: UseScaffolderOptions = {}
) {
 const { requestOptions, ...queryOptions } = options;
 
 return useQuery({
 queryKey: ['scaffolder', 'template', templateRef],
 queryFn: () => scaffolderClient.getTemplateByRef(templateRef, requestOptions),
 enabled: !!templateRef,
 staleTime: 15 * 60 * 1000, // 15 minutes (templates change less frequently)
 ...queryOptions,
 });
}

// Get template parameter schema hook
export function useTemplateParameterSchema(
 templateRef: string,
 options: UseScaffolderOptions = {}
) {
 const { requestOptions, ...queryOptions } = options;
 
 return useQuery({
 queryKey: ['scaffolder', 'template', templateRef, 'parameters'],
 queryFn: () => scaffolderClient.getTemplateParameterSchema(templateRef, requestOptions),
 enabled: !!templateRef,
 staleTime: 15 * 60 * 1000, // 15 minutes
 ...queryOptions,
 });
}

// Get task hook
export function useTask(
 taskId: string,
 options: UseScaffolderOptions = {}
) {
 const { requestOptions, ...queryOptions } = options;
 
 return useQuery({
 queryKey: ['scaffolder', 'task', taskId],
 queryFn: () => scaffolderClient.getTask(taskId, requestOptions),
 enabled: !!taskId,
 staleTime: 5 * 1000, // 5 seconds (tasks change frequently)
 refetchInterval: (data) => {
 // Auto-refresh running tasks every 2 seconds
 return data?.status === 'processing' ? 2000 : false;
 },
 ...queryOptions,
 });
}

// Get tasks hook
export function useTasks(
 queryOptions: TaskQueryOptions = {},
 options: UseScaffolderOptions = {}
) {
 const { requestOptions, ...hookOptions } = options;
 
 return useQuery({
 queryKey: ['scaffolder', 'tasks', queryOptions],
 queryFn: () => scaffolderClient.getTasks(queryOptions, requestOptions),
 staleTime: 30 * 1000, // 30 seconds
 ...hookOptions,
 });
}

// Get tasks by user hook
export function useTasksByUser(
 userRef: string,
 queryOptions: Omit<TaskQueryOptions, 'user'> = {},
 options: UseScaffolderOptions = {}
) {
 const { requestOptions, ...hookOptions } = options;
 
 return useQuery({
 queryKey: ['scaffolder', 'tasks', 'user', userRef, queryOptions],
 queryFn: () => scaffolderClient.getTasksByUser(userRef, queryOptions, requestOptions),
 enabled: !!userRef,
 staleTime: 30 * 1000, // 30 seconds
 ...hookOptions,
 });
}

// Get tasks by template hook
export function useTasksByTemplate(
 templateRef: string,
 queryOptions: Omit<TaskQueryOptions, 'template'> = {},
 options: UseScaffolderOptions = {}
) {
 const { requestOptions, ...hookOptions } = options;
 
 return useQuery({
 queryKey: ['scaffolder', 'tasks', 'template', templateRef, queryOptions],
 queryFn: () => scaffolderClient.getTasksByTemplate(templateRef, queryOptions, requestOptions),
 enabled: !!templateRef,
 staleTime: 30 * 1000, // 30 seconds
 ...hookOptions,
 });
}

// Get task events hook
export function useTaskEvents(
 taskId: string,
 options: UseScaffolderOptions = {}
) {
 const { requestOptions, ...queryOptions } = options;
 
 return useQuery({
 queryKey: ['scaffolder', 'task', taskId, 'events'],
 queryFn: () => scaffolderClient.getTaskEvents(taskId, requestOptions),
 enabled: !!taskId,
 staleTime: 10 * 1000, // 10 seconds
 refetchInterval: 10000, // Refresh every 10 seconds
 ...queryOptions,
 });
}

// Get task logs hook
export function useTaskLogs(
 taskId: string,
 logOptions: { after?: string; stepId?: string } = {},
 options: UseScaffolderOptions = {}
) {
 const { requestOptions, ...queryOptions } = options;
 
 return useQuery({
 queryKey: ['scaffolder', 'task', taskId, 'logs', logOptions],
 queryFn: () => scaffolderClient.getTaskLogs(taskId, logOptions, requestOptions),
 enabled: !!taskId,
 staleTime: 5 * 1000, // 5 seconds
 ...queryOptions,
 });
}

// Get actions hook
export function useActions(options: UseScaffolderOptions = {}) {
 const { requestOptions, ...queryOptions } = options;
 
 return useQuery({
 queryKey: ['scaffolder', 'actions'],
 queryFn: () => scaffolderClient.getActions(requestOptions),
 staleTime: 30 * 60 * 1000, // 30 minutes (actions rarely change)
 ...queryOptions,
 });
}

// Get action hook
export function useAction(
 actionId: string,
 options: UseScaffolderOptions = {}
) {
 const { requestOptions, ...queryOptions } = options;
 
 return useQuery({
 queryKey: ['scaffolder', 'action', actionId],
 queryFn: () => scaffolderClient.getAction(actionId, requestOptions),
 enabled: !!actionId,
 staleTime: 30 * 60 * 1000, // 30 minutes
 ...queryOptions,
 });
}

// Get template stats hook
export function useTemplateStats(
 templateRef: string,
 options: UseScaffolderOptions = {}
) {
 const { requestOptions, ...queryOptions } = options;
 
 return useQuery({
 queryKey: ['scaffolder', 'template', templateRef, 'stats'],
 queryFn: () => scaffolderClient.getTemplateStats(templateRef, requestOptions),
 enabled: !!templateRef,
 staleTime: 5 * 60 * 1000, // 5 minutes
 ...queryOptions,
 });
}

// Mutation hooks
export function useExecuteTemplate(
 options: UseScaffolderMutationOptions<{ taskId: string; task?: Task }, ExecuteTemplateRequest> = {}
) {
 const queryClient = useQueryClient();
 const { requestOptions, ...mutationOptions } = options;
 
 return useMutation({
 mutationFn: (request) => scaffolderClient.executeTemplate(request, { ...requestOptions, dryRun: false }),
 onSuccess: (data, variables, context) => {
 // Invalidate tasks queries
 queryClient.invalidateQueries({ queryKey: ['scaffolder', 'tasks'] });
 // Add the new task to cache if available
 if (data.task) {
 queryClient.setQueryData(['scaffolder', 'task', data.taskId], data.task);
 }
 options.onSuccess?.(data, variables, context);
 },
 ...mutationOptions,
 });
}

export function useDryRunTemplate(
 options: UseScaffolderMutationOptions<DryRunResponse, DryRunRequest> = {}
) {
 const { requestOptions, ...mutationOptions } = options;
 
 return useMutation({
 mutationFn: (request) => scaffolderClient.dryRunTemplate(request, requestOptions),
 ...mutationOptions,
 });
}

export function useCancelTask(
 options: UseScaffolderMutationOptions<void, string> = {}
) {
 const queryClient = useQueryClient();
 const { requestOptions, ...mutationOptions } = options;
 
 return useMutation({
 mutationFn: (taskId) => scaffolderClient.cancelTask(taskId, requestOptions),
 onSuccess: (data, variables, context) => {
 // Invalidate the specific task and tasks list
 queryClient.invalidateQueries({ queryKey: ['scaffolder', 'task', variables] });
 queryClient.invalidateQueries({ queryKey: ['scaffolder', 'tasks'] });
 options.onSuccess?.(data, variables, context);
 },
 ...mutationOptions,
 });
}

// Custom hooks for advanced functionality
export function useTaskProgress(taskId: string) {
 const { data: task } = useTask(taskId);
 
 return {
 task,
 isRunning: task?.status === 'processing',
 isCompleted: task?.status === 'completed',
 isFailed: task?.status === 'failed',
 isCancelled: task?.status === 'cancelled',
 progress: task ? (() => {
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
 })() : { completed: 0, total: 0, percentage: 0 },
 };
}

// Hook for streaming task logs
export function useTaskLogStream(
 taskId: string,
 options: {
 enabled?: boolean;
 onLog?: (log: { body: string; level: string; createdAt: string; stepId?: string }) => void;
 onError?: (error: Error) => void;
 } = {}
) {
 const stopStreamRef = useRef<(() => void) | null>(null);
 const { enabled = true, onLog, onError } = options;
 
 useEffect(() => {
 if (!taskId || !enabled) return;
 
 const startStream = async () => {
 try {
 const stopStream = await scaffolderClient.streamTaskLogs(
 taskId,
 onLog || (() => {}),
 onError,
 1000 // Poll every second
 );
 stopStreamRef.current = stopStream;
 } catch (error) {
 onError?.(error instanceof Error ? error : new Error('Unknown error'));
 }
 };
 
 startStream();
 
 return () => {
 if (stopStreamRef.current) {
 stopStreamRef.current();
 stopStreamRef.current = null;
 }
 };
 }, [taskId, enabled, onLog, onError]);
 
 return useCallback(() => {
 if (stopStreamRef.current) {
 stopStreamRef.current();
 stopStreamRef.current = null;
 }
 }, []);
}

// Hook for waiting for task completion
export function useTaskCompletion(
 taskId: string,
 options: {
 enabled?: boolean;
 timeout?: number;
 onProgress?: (task: Task) => void;
 onComplete?: (task: Task) => void;
 onError?: (error: Error) => void;
 } = {}
) {
 const { enabled = true, timeout = 300000, onProgress, onComplete, onError } = options;
 
 const mutation = useMutation({
 mutationFn: () => scaffolderClient.waitForTaskCompletion(taskId, {
 timeout,
 onProgress,
 }),
 onSuccess: onComplete,
 onError,
 });
 
 useEffect(() => {
 if (taskId && enabled && !mutation.isLoading) {
 mutation.mutate();
 }
 }, [taskId, enabled]);
 
 return {
 isWaiting: mutation.isLoading,
 error: mutation.error,
 task: mutation.data,
 };
}

// Hook for template validation
export function useTemplateValidation() {
 return useCallback(async (templateRef: string, values: Record<string, unknown>) => {
 try {
 const template = await scaffolderClient.getTemplateByRef(templateRef);
 const parametersSchema = Array.isArray(template.spec.parameters) 
 ? template.spec.parameters[0] 
 : template.spec.parameters;
 
 // Basic validation
 const required = parametersSchema.required || [];
 const missing = required.filter(key => !(key in values));
 
 if (missing.length > 0) {
 return {
 valid: false,
 errors: missing.map(key => `Required parameter '${key}' is missing`),
 };
 }
 
 return { valid: true, errors: [] };
 } catch (error) {
 return { 
 valid: false, 
 errors: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`] 
 };
 }
 }, []);
}

// Hook for clearing scaffolder cache
export function useClearScaffolderCache() {
 const queryClient = useQueryClient();
 
 return useCallback(() => {
 scaffolderClient.clearCache();
 queryClient.invalidateQueries({ queryKey: ['scaffolder'] });
 }, [queryClient]);
}

// Hook for scaffolder cleanup
export function useScaffolderCleanup() {
 useEffect(() => {
 return () => {
 scaffolderClient.cleanup();
 };
 }, []);
}

// Custom hooks for common templates
export function useReactTemplates(
 options: UseScaffolderOptions = {}
) {
 return useTemplates(
 { 'metadata.tags': ['react'], 'spec.type': 'service' },
 options
 );
}

export function useNodeTemplates(
 options: UseScaffolderOptions = {}
) {
 return useTemplates(
 { 'metadata.tags': ['nodejs'], 'spec.type': 'service' },
 options
 );
}

export function useLibraryTemplates(
 options: UseScaffolderOptions = {}
) {
 return useTemplates(
 { 'spec.type': 'library' },
 options
 );
}

// Hook for recent tasks
export function useRecentTasks(
 limit: number = 10,
 options: UseScaffolderOptions = {}
) {
 return useTasks(
 { 
 limit,
 orderBy: 'createdAt',
 orderDirection: 'desc'
 },
 options
 );
}

// Hook for running tasks
export function useRunningTasks(
 options: UseScaffolderOptions = {}
) {
 return useTasks(
 { status: 'processing' },
 {
 refetchInterval: 5000, // Refresh every 5 seconds
 ...options,
 }
 );
}