/* eslint-disable @typescript-eslint/no-unused-vars */
import { backstageClient } from './real-client';
import { mockBackend } from '../mock/backend';
import type { 
 Entity, 
 CompoundEntityRef,
 CatalogEntityRequest,
 TemplateRequest,
 ScaffolderTask
} from './real-client';

/**
 * Unified Backstage service that provides a consistent interface
 * for all Backstage operations with automatic fallback to mock data
 */
export class BackstageService {
 private static instance: BackstageService;
 private isBackstageAvailable: boolean = false;
 private lastHealthCheck: Date | null = null;
 private healthCheckInterval = 30000; // 30 seconds

 private constructor() {
 this.checkBackstageHealth();
 }

 static getInstance(): BackstageService {
 if (!BackstageService.instance) {
 BackstageService.instance = new BackstageService();
 }
 return BackstageService.instance;
 }

 /**
 * Check if Backstage is available
 */
 private async checkBackstageHealth(): Promise<void> {
 try {
 const entities = await backstageClient.getCatalogEntities({ limit: 1 });
 this.isBackstageAvailable = true;
 this.lastHealthCheck = new Date();
 } catch (error: any) {
 if (error.message?.includes('ECONNREFUSED')) {
 this.isBackstageAvailable = false;
 }
 }
 }

 /**
 * Get health status
 */
 async getHealthStatus(): Promise<{
 backstage: boolean;
 database: boolean;
 lastCheck: Date | null;
 }> {
 // Check if we need to refresh health status
 if (!this.lastHealthCheck || 
 Date.now() - this.lastHealthCheck.getTime() > this.healthCheckInterval) {
 await this.checkBackstageHealth();
 }

 return {
 backstage: this.isBackstageAvailable,
 database: true, // Always true for now
 lastCheck: this.lastHealthCheck
 };
 }

 /**
 * Get catalog entities with automatic fallback
 */
 async getCatalogEntities(request?: CatalogEntityRequest): Promise<Entity[]> {
 try {
 const entities = await backstageClient.getCatalogEntities(request);
 this.isBackstageAvailable = true;
 return entities;
 } catch (error: any) {
 console.log('Backstage unavailable, using mock data');
 return this.getMockEntities(request);
 }
 }

 /**
 * Get entity by reference
 */
 async getEntityByRef(entityRef: string | CompoundEntityRef): Promise<Entity | null> {
 try {
 const entity = await backstageClient.getEntityByRef(entityRef);
 this.isBackstageAvailable = true;
 return entity;
 } catch (error: any) {
 console.log('Backstage unavailable, using mock entity');
 return this.getMockEntityByRef(entityRef);
 }
 }

 /**
 * Get entity relationships
 */
 async getEntityRelations(entityRef: string): Promise<any[]> {
 try {
 const relations = await backstageClient.getEntityRelations(entityRef);
 this.isBackstageAvailable = true;
 return relations;
 } catch (error: any) {
 console.log('Backstage unavailable, using mock relations');
 return this.getMockRelations(entityRef);
 }
 }

 /**
 * Get templates
 */
 async getTemplates(request?: TemplateRequest): Promise<Entity[]> {
 try {
 const templates = await backstageClient.getTemplates(request);
 this.isBackstageAvailable = true;
 return templates;
 } catch (error: any) {
 console.log('Backstage unavailable, using mock templates');
 return this.getMockTemplates();
 }
 }

 /**
 * Execute template
 */
 async executeTemplate(
 templateRef: string,
 parameters: Record<string, any>,
 secrets?: Record<string, string>
 ): Promise<ScaffolderTask> {
 try {
 const task = await backstageClient.executeTemplate(templateRef, parameters, secrets);
 this.isBackstageAvailable = true;
 return task;
 } catch (error: any) {
 console.log('Backstage unavailable, using mock execution');
 return this.mockExecuteTemplate(templateRef, parameters);
 }
 }

 /**
 * Get scaffolder task status
 */
 async getScaffolderTask(taskId: string): Promise<ScaffolderTask | null> {
 try {
 const task = await backstageClient.getScaffolderTask(taskId);
 this.isBackstageAvailable = true;
 return task;
 } catch (error: any) {
 console.log('Backstage unavailable, using mock task');
 return this.getMockScaffolderTask(taskId);
 }
 }

 /**
 * Get tech docs
 */
 async getTechDocs(entityRef: string): Promise<any> {
 try {
 const docs = await backstageClient.getTechDocs(entityRef);
 this.isBackstageAvailable = true;
 return docs;
 } catch (error: any) {
 console.log('Backstage unavailable, using mock docs');
 return this.getMockTechDocs(entityRef);
 }
 }

 /**
 * Search entities
 */
 async searchEntities(query: string, filters: Record<string, any> = {}): Promise<Entity[]> {
 try {
 const results = await backstageClient.searchEntities(query, filters);
 this.isBackstageAvailable = true;
 return results;
 } catch (error: any) {
 console.log('Backstage unavailable, searching mock data');
 return this.searchMockEntities(query, filters);
 }
 }

 // Mock data methods
 private async getMockEntities(request?: CatalogEntityRequest): Promise<Entity[]> {
 const services = await mockBackend.getServices();
 
 let entities = services.map(service => ({
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'Component' as const,
 metadata: {
 name: service.name,
 namespace: service.namespace || 'default',
 title: service.displayName,
 description: service.description,
 tags: service.tags,
 annotations: service.annotations || {},
 labels: service.labels || {},
 uid: service.id,
 },
 spec: {
 type: service.type?.toLowerCase() || 'service',
 lifecycle: service.lifecycle?.toLowerCase() || 'production',
 owner: `team-${service.teamId || 'platform'}`,
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
 }));

 // Apply filters
 if (request?.kind) {
 entities = entities.filter(e => e.kind === request.kind);
 }

 return entities;
 }

 private async getMockEntityByRef(entityRef: string | CompoundEntityRef): Promise<Entity | null> {
 const entities = await this.getMockEntities();
 const ref = typeof entityRef === 'string' ? entityRef : this.stringifyEntityRef(entityRef);
 
 return entities.find(e => {
 const eRef = this.stringifyEntityRef({
 kind: e.kind,
 namespace: e.metadata.namespace || 'default',
 name: e.metadata.name
 });
 return eRef === ref;
 }) || null;
 }

 private getMockRelations(entityRef: string): any[] {
 return [
 {
 type: 'ownedBy',
 targetRef: 'group:default/platform-team',
 target: {
 kind: 'Group',
 namespace: 'default',
 name: 'platform-team',
 },
 },
 {
 type: 'partOf',
 targetRef: 'system:default/platform-system',
 target: {
 kind: 'System',
 namespace: 'default',
 name: 'platform-system',
 },
 },
 ];
 }

 private async getMockTemplates(): Promise<Entity[]> {
 const templates = await mockBackend.getTemplates();
 
 return templates.map(template => ({
 apiVersion: 'scaffolder.backstage.io/v1beta3',
 kind: 'Template' as const,
 metadata: {
 name: template.name,
 namespace: 'default',
 title: template.displayName,
 description: template.description,
 tags: template.tags,
 uid: template.id,
 },
 spec: template.content.spec,
 }));
 }

 private async mockExecuteTemplate(
 templateRef: string,
 parameters: Record<string, any>
 ): Promise<ScaffolderTask> {
 const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
 
 return {
 id: taskId,
 spec: {
 templateInfo: {
 entityRef: templateRef,
 },
 parameters,
 },
 status: 'open',
 createdAt: new Date().toISOString(),
 };
 }

 private getMockScaffolderTask(taskId: string): ScaffolderTask {
 // Simulate task progress
 const createdAt = new Date(Date.now() - 30000); // 30 seconds ago
 const now = new Date();
 const elapsed = now.getTime() - createdAt.getTime();
 
 let status: ScaffolderTask['status'] = 'open';
 let output = {};
 
 if (elapsed > 60000) {
 status = 'completed';
 output = {
 entityRef: 'component:default/my-new-service',
 remoteUrl: 'https://github.com/company/my-new-service',
 };
 } else if (elapsed > 10000) {
 status = 'processing';
 }
 
 return {
 id: taskId,
 spec: {
 templateInfo: {
 entityRef: 'template:default/nodejs-service',
 },
 parameters: {},
 },
 status,
 createdAt: createdAt.toISOString(),
 lastHeartbeatAt: now.toISOString(),
 output: status === 'completed' ? output : undefined,
 };
 }

 private getMockTechDocs(entityRef: string): any {
 return {
 entityRef,
 kind: 'Component',
 namespace: 'default',
 name: entityRef.split('/').pop() || 'unknown',
 site_name: 'Documentation',
 site_description: 'Technical documentation',
 etag: '1234567890',
 build_timestamp: new Date().toISOString(),
 files: ['index.html', 'getting-started.html', 'api-reference.html'],
 has_docs: true,
 };
 }

 private async searchMockEntities(query: string, filters: Record<string, any>): Promise<Entity[]> {
 const entities = await this.getMockEntities();
 const lowerQuery = query.toLowerCase();
 
 return entities.filter(entity => {
 const matchesQuery = !query || 
 entity.metadata.name.toLowerCase().includes(lowerQuery) ||
 entity.metadata.title?.toLowerCase().includes(lowerQuery) ||
 entity.metadata.description?.toLowerCase().includes(lowerQuery) ||
 entity.metadata.tags?.some(tag => tag.toLowerCase().includes(lowerQuery));
 
 const matchesFilters = Object.entries(filters).every(([key, value]) => {
 if (key === 'kind') return entity.kind === value;
 if (key === 'type') return (entity.spec as any).type === value;
 if (key === 'lifecycle') return (entity.spec as any).lifecycle === value;
 return true;
 });
 
 return matchesQuery && matchesFilters;
 });
 }

 private stringifyEntityRef(ref: any): string {
 if (typeof ref === 'string') return ref;
 
 const { kind, namespace = 'default', name } = ref;
 return `${kind}:${namespace}/${name}`;
 }
}

// Export singleton instance
export const backstageService = BackstageService.getInstance();