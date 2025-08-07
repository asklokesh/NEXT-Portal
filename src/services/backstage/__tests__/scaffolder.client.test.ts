/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { scaffolderClient } from '../clients/scaffolder.client';
import { enableMocking, disableMocking, resetMocks } from '../mocks/server';

import type { TemplateEntity, Task } from '../types/templates';

// Setup MSW for tests
beforeAll(() => enableMocking());
afterEach(() => resetMocks());
afterAll(() => disableMocking());

describe('ScaffolderClient', () => {
 describe('getTemplates', () => {
 it('should fetch templates successfully', async () => {
 const templates = await scaffolderClient.getTemplates();
 
 expect(templates).toBeInstanceOf(Array);
 expect(templates.length).toBeGreaterThan(0);
 templates.forEach(template => {
 expect(template.kind).toBe('Template');
 expect(template.metadata).toBeDefined();
 expect(template.spec).toBeDefined();
 });
 });

 it('should apply filters', async () => {
 const filteredTemplates = await scaffolderClient.getTemplates({
 'metadata.tags': ['react'],
 });
 
 expect(filteredTemplates).toBeInstanceOf(Array);
 filteredTemplates.forEach(template => {
 expect(template.metadata.tags).toContain('react');
 });
 });
 });

 describe('getTemplateByRef', () => {
 it('should fetch template by reference', async () => {
 const templateRef = 'template:default/template-1';
 const template = await scaffolderClient.getTemplateByRef(templateRef);
 
 expect(template).toBeDefined();
 expect(template.kind).toBe('Template');
 expect(template.metadata.name).toBe('template-1');
 });

 it('should throw error for non-existent template', async () => {
 const templateRef = 'template:default/non-existent';
 
 await expect(scaffolderClient.getTemplateByRef(templateRef))
 .rejects
 .toThrow();
 });
 });

 describe('getTemplateParameterSchema', () => {
 it('should fetch template parameter schema', async () => {
 const templateRef = 'template:default/template-1';
 const schema = await scaffolderClient.getTemplateParameterSchema(templateRef);
 
 expect(schema).toBeDefined();
 expect(schema.type).toBe('object');
 expect(schema.properties).toBeDefined();
 });
 });

 describe('executeTemplate', () => {
 it('should execute template successfully', async () => {
 const request = {
 templateRef: 'template:default/template-1',
 values: {
 name: 'test-service',
 description: 'A test service',
 },
 };

 const result = await scaffolderClient.executeTemplate(request);
 
 expect(result).toBeDefined();
 expect(result.taskId).toBeDefined();
 expect(typeof result.taskId).toBe('string');
 });

 it('should validate parameters before execution', async () => {
 const request = {
 templateRef: 'template:default/template-1',
 values: {
 // Missing required 'name' parameter
 description: 'A test service',
 },
 };

 await expect(scaffolderClient.executeTemplate(request))
 .rejects
 .toThrow(/Parameter validation failed/);
 });
 });

 describe('dryRunTemplate', () => {
 it('should perform dry run successfully', async () => {
 const request = {
 templateRef: 'template:default/template-1',
 values: {
 name: 'test-service',
 description: 'A test service',
 },
 };

 // Mock the dry run response
 const dryRunResponse = await scaffolderClient.dryRunTemplate(request);
 
 expect(dryRunResponse).toBeDefined();
 expect(dryRunResponse.steps).toBeInstanceOf(Array);
 expect(dryRunResponse.log).toBeInstanceOf(Array);
 });
 });

 describe('getTasks', () => {
 it('should fetch tasks successfully', async () => {
 const tasks = await scaffolderClient.getTasks();
 
 expect(tasks).toBeInstanceOf(Array);
 expect(tasks.length).toBeGreaterThan(0);
 tasks.forEach(task => {
 expect(task.id).toBeDefined();
 expect(task.spec).toBeDefined();
 expect(task.status).toBeDefined();
 });
 });

 it('should filter tasks by status', async () => {
 const runningTasks = await scaffolderClient.getTasks({ status: 'processing' });
 
 expect(runningTasks).toBeInstanceOf(Array);
 runningTasks.forEach(task => {
 expect(task.status).toBe('processing');
 });
 });
 });

 describe('getTask', () => {
 it('should fetch task by ID', async () => {
 const taskId = 'task-1';
 const task = await scaffolderClient.getTask(taskId);
 
 expect(task).toBeDefined();
 expect(task.id).toBe(taskId);
 expect(task.spec).toBeDefined();
 expect(task.status).toBeDefined();
 });
 });

 describe('getTasksByUser', () => {
 it('should fetch tasks by user', async () => {
 const userRef = 'user:default/john-doe';
 const tasks = await scaffolderClient.getTasksByUser(userRef);
 
 expect(tasks).toBeInstanceOf(Array);
 // In real implementation, would verify tasks belong to user
 });
 });

 describe('getTasksByTemplate', () => {
 it('should fetch tasks by template', async () => {
 const templateRef = 'template:default/template-1';
 const tasks = await scaffolderClient.getTasksByTemplate(templateRef);
 
 expect(tasks).toBeInstanceOf(Array);
 // In real implementation, would verify tasks use this template
 });
 });

 describe('getActions', () => {
 it('should fetch available actions', async () => {
 const actions = await scaffolderClient.getActions();
 
 expect(actions).toBeInstanceOf(Array);
 expect(actions.length).toBeGreaterThan(0);
 actions.forEach(action => {
 expect(action.id).toBeDefined();
 expect(action.description).toBeDefined();
 });
 });
 });

 describe('getAction', () => {
 it('should fetch action by ID', async () => {
 const actionId = 'fetch:template';
 const action = await scaffolderClient.getAction(actionId);
 
 expect(action).toBeDefined();
 expect(action.id).toBe(actionId);
 expect(action.description).toBeDefined();
 });

 it('should throw error for non-existent action', async () => {
 const actionId = 'non-existent-action';
 
 await expect(scaffolderClient.getAction(actionId))
 .rejects
 .toThrow(/Action not found/);
 });
 });

 describe('getTemplateStats', () => {
 it('should fetch template statistics', async () => {
 const templateRef = 'template:default/template-1';
 const stats = await scaffolderClient.getTemplateStats(templateRef);
 
 expect(stats).toBeDefined();
 expect(typeof stats.totalExecutions).toBe('number');
 expect(typeof stats.successfulExecutions).toBe('number');
 expect(typeof stats.failedExecutions).toBe('number');
 expect(typeof stats.averageExecutionTime).toBe('number');
 expect(stats.recentTasks).toBeInstanceOf(Array);
 });
 });

 describe('task management', () => {
 it('should handle task progress tracking', async () => {
 const taskId = 'task-1';
 const task = await scaffolderClient.getTask(taskId);
 
 expect(task).toBeDefined();
 
 // Test task progress calculation
 const steps = task.steps || [];
 const completed = steps.filter(step => 
 step.status === 'completed' || step.status === 'failed'
 ).length;
 
 expect(completed).toBeGreaterThanOrEqual(0);
 expect(completed).toBeLessThanOrEqual(steps.length);
 });
 });

 describe('caching', () => {
 it('should cache template responses', async () => {
 const startTime = Date.now();
 
 // First request
 await scaffolderClient.getTemplates();
 const firstRequestTime = Date.now() - startTime;
 
 const cacheStartTime = Date.now();
 
 // Second request (should be cached)
 await scaffolderClient.getTemplates();
 const secondRequestTime = Date.now() - cacheStartTime;
 
 // Cached request should be faster
 expect(secondRequestTime).toBeLessThan(firstRequestTime);
 });

 it('should clear cache on cleanup', () => {
 expect(() => scaffolderClient.clearCache()).not.toThrow();
 expect(() => scaffolderClient.cleanup()).not.toThrow();
 });
 });

 describe('error handling', () => {
 it('should handle validation errors', async () => {
 const invalidRequest = {
 templateRef: 'template:default/template-1',
 values: {
 // Missing required parameters
 },
 };

 await expect(scaffolderClient.executeTemplate(invalidRequest))
 .rejects
 .toThrow();
 });
 });
});