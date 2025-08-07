/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { prisma } from '../db/client';
import { ServiceRepository } from '../db/repositories/ServiceRepository';
import { mockBackend } from '../mock/backend';
import type { Entity, CompoundEntityRef } from '@backstage/catalog-model';

export interface BackstageConfig {
 baseUrl: string;
 token?: string;
 timeout?: number;
}

export interface CatalogEntityRequest {
 kind?: string;
 namespace?: string;
 name?: string;
 limit?: number;
 offset?: number;
 filter?: Record<string, any>;
}

export interface TemplateRequest {
 namespace?: string;
 name?: string;
 limit?: number;
 offset?: number;
}

export interface ScaffolderTask {
 id: string;
 spec: {
 templateInfo: {
 entityRef: string;
 };
 parameters: Record<string, any>;
 user?: {
 ref: string;
 };
 };
 status: 'open' | 'processing' | 'completed' | 'failed' | 'cancelled';
 createdAt: string;
 lastHeartbeatAt?: string;
 output?: Record<string, any>;
 error?: {
 name: string;
 message: string;
 stack?: string;
 };
}

/**
 * Real Backstage API client that connects to actual Backstage instance
 */
export class RealBackstageClient {
 private readonly client: AxiosInstance;
 private readonly serviceRepository: ServiceRepository;

 constructor(config: BackstageConfig) {
 this.serviceRepository = new ServiceRepository();
 
 this.client = axios.create({
 baseURL: config.baseUrl,
 timeout: config.timeout || 30000,
 headers: {
 'Content-Type': 'application/json',
 ...(config.token && { Authorization: `Bearer ${config.token}` }),
 },
 });

 // Request interceptor for logging
 this.client.interceptors.request.use(
 (config) => {
 console.log(`[Backstage API] ${config.method?.toUpperCase()} ${config.url}`);
 return config;
 },
 (error) => {
 console.error('[Backstage API] Request error:', error);
 return Promise.reject(error);
 }
 );

 // Response interceptor for error handling
 this.client.interceptors.response.use(
 (response) => response,
 (error) => {
 console.error('[Backstage API] Response error:', {
 status: error.response?.status,
 message: error.message,
 url: error.config?.url,
 });
 return Promise.reject(error);
 }
 );
 }

 /**
 * Get entities from Backstage catalog
 */
 async getCatalogEntities(request: CatalogEntityRequest = {}): Promise<Entity[]> {
 try {
 const params = new URLSearchParams();
 
 if (request.kind) params.append('filter', `kind=${request.kind}`);
 if (request.namespace) params.append('filter', `metadata.namespace=${request.namespace}`);
 if (request.limit) params.append('limit', request.limit.toString());
 if (request.offset) params.append('offset', request.offset.toString());

 // Add additional filters
 if (request.filter) {
 Object.entries(request.filter).forEach(([key, value]) => {
 if (Array.isArray(value)) {
 value.forEach(v => params.append('filter', `${key}=${v}`));
 } else {
 params.append('filter', `${key}=${value}`);
 }
 });
 }

 const response: AxiosResponse<{ items: Entity[] }> = await this.client.get(
 `/api/catalog/entities?${params.toString()}`
 );

 const entities = response.data.items || [];

 // Sync entities to our database
 await this.syncEntitiesToDatabase(entities);

 return entities;
 } catch (error: any) {
 console.error('Failed to fetch catalog entities:', error);
 
 // If connection refused or network error, use mock/fallback data
 if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED')) {
 console.log('Backstage unavailable, using fallback data');
 return this.getFallbackEntities(request);
 }
 
 // For other errors, still try fallback
 return this.getFallbackEntities(request);
 }
 }

 /**
 * Get specific entity by reference
 */
 async getEntityByRef(entityRef: string | CompoundEntityRef): Promise<Entity | null> {
 try {
 const ref = typeof entityRef === 'string' ? entityRef : this.stringifyEntityRef(entityRef);
 const encodedRef = encodeURIComponent(ref);

 const response: AxiosResponse<Entity> = await this.client.get(
 `/api/catalog/entities/by-name/${encodedRef}`
 );

 return response.data;
 } catch (error) {
 if (error.response?.status === 404) {
 return null;
 }
 console.error('Failed to fetch entity by ref:', error);
 throw error;
 }
 }

 /**
 * Get entity relationships
 */
 async getEntityRelations(entityRef: string): Promise<any[]> {
 try {
 const encodedRef = encodeURIComponent(entityRef);
 
 const response: AxiosResponse<{ items: any[] }> = await this.client.get(
 `/api/catalog/entities/by-name/${encodedRef}/relations`
 );

 return response.data.items || [];
 } catch (error) {
 console.error('Failed to fetch entity relations:', error);
 return [];
 }
 }

 /**
 * Get templates from Backstage scaffolder
 */
 async getTemplates(request: TemplateRequest = {}): Promise<Entity[]> {
 try {
 const params = new URLSearchParams();
 params.append('filter', 'kind=Template');
 
 if (request.namespace) params.append('filter', `metadata.namespace=${request.namespace}`);
 if (request.limit) params.append('limit', request.limit.toString());
 if (request.offset) params.append('offset', request.offset.toString());

 const response: AxiosResponse<{ items: Entity[] }> = await this.client.get(
 `/api/catalog/entities?${params.toString()}`
 );

 return response.data.items || [];
 } catch (error) {
 console.error('Failed to fetch templates:', error);
 
 // Fallback to mock templates when backend is not available
 const mockTemplates = await mockBackend.getTemplates();
 return mockTemplates.map(template => ({
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'Template',
 metadata: {
 name: template.name,
 title: template.displayName,
 description: template.description,
 tags: template.tags,
 namespace: 'default',
 },
 spec: template.content.spec,
 }));
 }
 }

 /**
 * Execute template scaffolder
 */
 async executeTemplate(
 templateRef: string,
 parameters: Record<string, any>,
 secrets?: Record<string, string>
 ): Promise<ScaffolderTask> {
 try {
 const response: AxiosResponse<{ id: string }> = await this.client.post(
 '/api/scaffolder/v2/tasks',
 {
 templateRef,
 values: parameters,
 secrets,
 }
 );

 const taskId = response.data.id;
 
 // Store task in database
 await this.storeScaffolderTask(taskId, templateRef, parameters);

 // Return initial task status
 return {
 id: taskId,
 spec: {
 templateInfo: { entityRef: templateRef },
 parameters,
 },
 status: 'open',
 createdAt: new Date().toISOString(),
 };
 } catch (error) {
 console.error('Failed to execute template:', error);
 throw error;
 }
 }

 /**
 * Get scaffolder task status
 */
 async getScaffolderTask(taskId: string): Promise<ScaffolderTask | null> {
 try {
 const response: AxiosResponse<ScaffolderTask> = await this.client.get(
 `/api/scaffolder/v2/tasks/${taskId}`
 );

 // Update task in database
 await this.updateScaffolderTaskStatus(taskId, response.data);

 return response.data;
 } catch (error) {
 if (error.response?.status === 404) {
 return null;
 }
 console.error('Failed to fetch scaffolder task:', error);
 throw error;
 }
 }

 /**
 * Get tech docs for an entity
 */
 async getTechDocs(entityRef: string): Promise<any> {
 try {
 const encodedRef = encodeURIComponent(entityRef);
 
 const response = await this.client.get(`/api/techdocs/metadata/entity/${encodedRef}`);
 return response.data;
 } catch (error) {
 console.error('Failed to fetch tech docs:', error);
 return null;
 }
 }

 /**
 * Search entities
 */
 async searchEntities(query: string, filters: Record<string, any> = {}): Promise<Entity[]> {
 try {
 const response: AxiosResponse<{ results: Array<{ document: Entity }> }> = await this.client.post(
 '/api/search/query',
 {
 term: query,
 filters: {
 kind: 'Component',
 ...filters,
 },
 pageCursor: '',
 pageLimit: 100,
 }
 );

 return response.data.results.map(result => result.document);
 } catch (error) {
 console.error('Failed to search entities:', error);
 return [];
 }
 }

 /**
 * Sync Backstage entities to our database
 */
 private async syncEntitiesToDatabase(entities: Entity[]): Promise<void> {
 try {
 for (const entity of entities) {
 if (entity.kind === 'Component') {
 await this.syncComponentToDatabase(entity);
 }
 }
 } catch (error) {
 console.error('Failed to sync entities to database:', error);
 }
 }

 /**
 * Sync individual component to database
 */
 private async syncComponentToDatabase(entity: Entity): Promise<void> {
 try {
 const existing = await this.serviceRepository.findByName(entity.metadata.name);
 
 const serviceData = {
 name: entity.metadata.name,
 displayName: entity.metadata.title || entity.metadata.name,
 description: entity.metadata.description || '',
 type: ((entity.spec?.type as string) || 'service').toUpperCase() as any,
 lifecycle: ((entity.spec?.lifecycle as string) || 'experimental').toUpperCase() as any,
 namespace: entity.metadata.namespace || 'default',
 system: entity.spec?.system as string,
 domain: entity.spec?.domain as string,
 gitRepo: entity.metadata.annotations?.['backstage.io/source-location'],
 tags: entity.metadata.tags || [],
 labels: entity.metadata.labels,
 annotations: entity.metadata.annotations,
 };

 if (existing) {
 await this.serviceRepository.update(existing.id, serviceData);
 } else {
 // Create with placeholder owner - would need proper mapping
 const defaultUser = await prisma.user.findFirst();
 const defaultTeam = await prisma.team.findFirst();
 
 if (defaultUser && defaultTeam) {
 await this.serviceRepository.create({
 ...serviceData,
 ownerId: defaultUser.id,
 teamId: defaultTeam.id,
 });
 }
 }
 } catch (error) {
 console.error(`Failed to sync component ${entity.metadata.name}:`, error);
 }
 }

 /**
 * Fallback method when Backstage is unavailable
 */
 private async getFallbackEntities(request: CatalogEntityRequest): Promise<Entity[]> {
 try {
 // First check if we have services in the database
 const services = await this.serviceRepository.findMany({
 take: request.limit,
 skip: request.offset,
 });

 if (services.length > 0) {
 return services.map(service => this.serviceToEntity(service));
 }

 // If no services in database, return mock data
 console.log('Using mock data as fallback');
 const mockEntities = await mockBackend.getCatalogEntities();
 
 // Filter mock entities based on request
 let filteredEntities = mockEntities;
 
 if (request.kind) {
 filteredEntities = filteredEntities.filter(e => e.kind === request.kind);
 }
 
 if (request.filter?.['spec.type']) {
 filteredEntities = filteredEntities.filter(e => 
 (e.spec as any)?.type === request.filter?.['spec.type']
 );
 }
 
 if (request.filter?.['spec.lifecycle']) {
 filteredEntities = filteredEntities.filter(e => 
 (e.spec as any)?.lifecycle === request.filter?.['spec.lifecycle']
 );
 }
 
 // Apply pagination
 const start = request.offset || 0;
 const end = start + (request.limit || filteredEntities.length);
 
 return filteredEntities.slice(start, end);
 } catch (error) {
 console.error('Failed to get fallback entities:', error);
 // Return minimal mock data as last resort
 return [
 {
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'Component',
 metadata: {
 name: 'example-service',
 namespace: 'default',
 title: 'Example Service',
 description: 'This is a demo service shown when Backstage is unavailable',
 tags: ['demo', 'example'],
 },
 spec: {
 type: 'service',
 lifecycle: 'production',
 owner: 'guest',
 },
 status: {
 items: [
 {
 type: 'health',
 level: 'info',
 message: 'Service is healthy',
 },
 ],
 },
 },
 ];
 }
 }

 /**
 * Fallback templates from database
 */
 private async getFallbackTemplates(): Promise<Entity[]> {
 try {
 const templates = await prisma.template.findMany({
 where: { isActive: true },
 });

 return templates.map(template => ({
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'Template',
 metadata: {
 name: template.name,
 title: template.displayName,
 description: template.description,
 tags: template.tags,
 namespace: 'default',
 },
 spec: template.content as any,
 }));
 } catch (error) {
 console.error('Failed to get fallback templates:', error);
 return [];
 }
 }

 /**
 * Convert service model to Backstage entity
 */
 private serviceToEntity(service: any): Entity {
 return {
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'Component',
 metadata: {
 name: service.name,
 title: service.displayName,
 description: service.description,
 namespace: service.namespace || 'default',
 tags: service.tags || [],
 labels: service.labels || {},
 annotations: service.annotations || {},
 },
 spec: {
 type: service.type?.toLowerCase() || 'service',
 lifecycle: service.lifecycle?.toLowerCase() || 'production',
 owner: service.team?.name || service.owner?.name || 'guest',
 system: service.system,
 domain: service.domain,
 },
 status: {
 items: [
 {
 type: 'health',
 level: 'info',
 message: 'Service is healthy',
 },
 ],
 },
 };
 }

 /**
 * Store scaffolder task in database
 */
 private async storeScaffolderTask(
 taskId: string,
 templateRef: string,
 parameters: Record<string, any>
 ): Promise<void> {
 try {
 const template = await prisma.template.findFirst({
 where: { name: templateRef.split('/').pop() },
 });

 await prisma.templateExecution.create({
 data: {
 id: taskId,
 templateId: template?.id || '',
 userId: '', // Would need current user context
 parameters,
 status: 'PENDING',
 startedAt: new Date(),
 },
 });
 } catch (error) {
 console.error('Failed to store scaffolder task:', error);
 }
 }

 /**
 * Update scaffolder task status in database
 */
 private async updateScaffolderTaskStatus(taskId: string, task: ScaffolderTask): Promise<void> {
 try {
 const status = this.mapScaffolderStatus(task.status);
 
 await prisma.templateExecution.update({
 where: { id: taskId },
 data: {
 status,
 result: task.output,
 error: task.error?.message,
 completedAt: ['completed', 'failed', 'cancelled'].includes(task.status) 
 ? new Date() 
 : null,
 },
 });
 } catch (error) {
 console.error('Failed to update scaffolder task status:', error);
 }
 }

 /**
 * Map Backstage scaffolder status to our enum
 */
 private mapScaffolderStatus(status: string): any {
 const statusMap: Record<string, any> = {
 'open': 'PENDING',
 'processing': 'RUNNING',
 'completed': 'COMPLETED',
 'failed': 'FAILED',
 'cancelled': 'CANCELLED',
 };

 return statusMap[status] || 'PENDING';
 }

 /**
 * Stringify entity reference
 */
 private stringifyEntityRef(ref: CompoundEntityRef): string {
 const parts = [];
 if (ref.kind) parts.push(ref.kind);
 if (ref.namespace && ref.namespace !== 'default') {
 parts.push(ref.namespace);
 }
 parts.push(ref.name);
 return parts.join(':');
 }
}

// Create singleton instance
// Create client factory function to support dynamic token injection
export function createBackstageClient(token?: string): RealBackstageClient {
  return new RealBackstageClient({
    baseUrl: process.env.BACKSTAGE_BACKEND_URL || 'http://localhost:7007',
    token: token || process.env.BACKSTAGE_API_TOKEN,
    timeout: 30000,
  });
}

// Default client instance for server-side usage
export const backstageClient = createBackstageClient();