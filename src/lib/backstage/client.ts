/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import axios from 'axios';
import { toast } from 'react-hot-toast';

import {
 EnrichedEntity 
} from './types';

import type { 
 Entity, 
 ServiceEntity, 
 CatalogFilters, 
 CatalogListResponse,
 TemplateEntityV1beta3 
} from './types';
import type { AxiosInstance, AxiosError } from 'axios';

// Configuration
const BACKSTAGE_URL = process.env.NEXT_PUBLIC_BACKSTAGE_URL || process.env.BACKSTAGE_BACKEND_URL || 'http://localhost:7007';
const API_TIMEOUT = 30000;
const ENABLE_DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
const USE_PROXY = typeof window !== 'undefined'; // Use proxy in browser, direct in server

// Custom error class for Backstage API errors
export class BackstageApiError extends Error {
 constructor(
 message: string,
 public statusCode?: number,
 public details?: any
 ) {
 super(message);
 this.name = 'BackstageApiError';
 }
}

// Helper to parse entity reference
export function parseEntityRef(entityRef: string): { kind: string; namespace: string; name: string } {
 const parts = entityRef.split(':');
 if (parts.length === 2) {
 // Format: kind:namespace/name
 const [kind, namespaceName] = parts;
 const [namespace, name] = namespaceName.split('/');
 return { kind, namespace, name };
 } else if (parts.length === 3) {
 // Format: kind:namespace:name
 return { kind: parts[0], namespace: parts[1], name: parts[2] };
 } else {
 // Check for URL format: namespace/kind/name or namespace/name
 const urlParts = entityRef.split('/');
 if (urlParts.length === 3) {
 return { namespace: urlParts[0], kind: urlParts[1], name: urlParts[2] };
 } else if (urlParts.length === 2) {
 // Format: namespace/name (assume Component kind)
 return { namespace: urlParts[0], kind: 'Component', name: urlParts[1] };
 }
 }
 throw new Error(`Invalid entity reference: ${entityRef}`);
}

// Helper to create entity reference
export function stringifyEntityRef(entity: { kind: string; metadata: { namespace?: string; name: string } }): string {
 const namespace = entity.metadata.namespace || 'default';
 return `${entity.kind}:${namespace}/${entity.metadata.name}`;
}

// Backstage API Client
class BackstageClient {
 private api: AxiosInstance;
 private authToken?: string;
 private demoMode: boolean = ENABLE_DEMO_MODE;

 constructor() {
 this.api = axios.create({
 baseURL: USE_PROXY ? '' : BACKSTAGE_URL, // Use relative URLs for proxy
 timeout: API_TIMEOUT,
 headers: {
 'Content-Type': 'application/json',
 'Accept': 'application/json',
 },
 });

 // Request interceptor for auth
 this.api.interceptors.request.use(
 (config) => {
 if (this.authToken) {
 config.headers.Authorization = `Bearer ${this.authToken}`;
 }
 console.log('Backstage API Request:', config.method?.toUpperCase(), config.url);
 return config;
 },
 (error) => Promise.reject(error)
 );

 // Response interceptor for error handling
 this.api.interceptors.response.use(
 (response) => {
 console.log('Backstage API Response:', response.status, response.config.url);
 return response;
 },
 (error: AxiosError) => {
 const message = this.getErrorMessage(error);
 console.error('Backstage API Error:', error.response?.status, error.config?.url, message);
 
 // Show user-friendly error messages
 if (error.code === 'ECONNREFUSED') {
 toast.error('Cannot connect to Backstage. Make sure it is running on ' + BACKSTAGE_URL);
 } else if (error.response?.status === 401) {
 toast.error('Authentication required. Please log in.');
 } else if (error.response?.status === 403) {
 toast.error('You don\'t have permission to perform this action.');
 } else if (error.response?.status === 404) {
 // Don't show toast for 404s, handle in component
 } else if (error.code === 'ECONNABORTED') {
 toast.error('Request timed out. Please try again.');
 } else if (!this.demoMode) {
 toast.error(message);
 }

 throw new BackstageApiError(
 message,
 error.response?.status,
 error.response?.data
 );
 }
 );
 }

 private getErrorMessage(error: AxiosError): string {
 if (error.response?.data) {
 const data = error.response.data as any;
 return data.error?.message || data.message || 'An error occurred';
 }
 if (error.code === 'ECONNREFUSED') {
 return 'Cannot connect to Backstage API';
 }
 return error.message || 'Network error';
 }

 setAuthToken(token: string) {
 this.authToken = token;
 }

 // Catalog API Implementation
 async getCatalogEntities(filters?: CatalogFilters): Promise<Entity[]> {
 try {
 // Build filter query parameters
 const params = new URLSearchParams();
 
 if (filters) {
 // Handle different filter formats
 Object.entries(filters).forEach(([key, value]) => {
 if (value === undefined || value === null) return;
 
 if (Array.isArray(value)) {
 value.forEach(v => params.append('filter', `${key}=${v}`));
 } else {
 params.append('filter', `${key}=${value}`);
 }
 });
 }

 const queryString = params.toString();
 const apiPath = USE_PROXY ? '/api/backstage/catalog/entities' : '/api/catalog/entities';
 const url = `${apiPath}${queryString ? `?${queryString}` : ''}`;
 
 const response = await this.api.get<CatalogListResponse>(url);
 return response.data.items || [];
 } catch (error) {
 if (this.demoMode || (error as BackstageApiError).statusCode === undefined) {
 console.log('Using demo data due to API error:', error);
 return this.getDemoEntities(filters);
 }
 throw error;
 }
 }

 async getEntityByRef(entityRef: string): Promise<Entity> {
 try {
 const { namespace, kind, name } = parseEntityRef(entityRef);
 const apiPath = USE_PROXY ? '/api/backstage/catalog/entities' : '/api/catalog/entities';
 const url = `${apiPath}/by-name/${kind}/${namespace}/${name}`;
 
 const response = await this.api.get<Entity>(url);
 return response.data;
 } catch (error) {
 if (this.demoMode || (error as BackstageApiError).statusCode === 404) {
 return this.getDemoEntity(entityRef);
 }
 throw error;
 }
 }

 async getEntityByUrl(namespace: string, kind: string, name: string): Promise<Entity> {
 try {
 const url = `/api/catalog/entities/by-name/${kind}/${namespace}/${name}`;
 const response = await this.api.get<Entity>(url);
 return response.data;
 } catch (error) {
 if (this.demoMode || (error as BackstageApiError).statusCode === 404) {
 return this.getDemoEntity(`${kind}:${namespace}/${name}`);
 }
 throw error;
 }
 }

 async createEntity(entity: Entity): Promise<Entity> {
 try {
 const apiPath = USE_PROXY ? '/api/backstage/catalog/entities' : '/api/catalog/entities';
 const response = await this.api.post<Entity>(
 apiPath,
 entity
 );
 toast.success('Service created successfully!');
 return response.data;
 } catch (error) {
 if (this.demoMode) {
 toast.success('Service created successfully (demo mode)!');
 return { ...entity, metadata: { ...entity.metadata, uid: Date.now().toString() } };
 }
 throw error;
 }
 }

 async updateEntity(entityRef: string, entity: Entity): Promise<Entity> {
 try {
 const { namespace, kind, name } = parseEntityRef(entityRef);
 const response = await this.api.put<Entity>(
 `/api/catalog/entities/by-name/${kind}/${namespace}/${name}`,
 entity
 );
 toast.success('Service updated successfully!');
 return response.data;
 } catch (error) {
 if (this.demoMode) {
 toast.success('Service updated successfully (demo mode)!');
 return entity;
 }
 throw error;
 }
 }

 async deleteEntity(entityRef: string): Promise<void> {
 try {
 const { namespace, kind, name } = parseEntityRef(entityRef);
 await this.api.delete(
 `/api/catalog/entities/by-name/${kind}/${namespace}/${name}`
 );
 toast.success('Service deleted successfully!');
 } catch (error) {
 if (this.demoMode) {
 toast.success('Service deleted successfully (demo mode)!');
 return;
 }
 throw error;
 }
 }

 async refreshEntity(entityRef: string): Promise<void> {
 try {
 const { namespace, kind, name } = parseEntityRef(entityRef);
 await this.api.post(
 `/api/catalog/entities/by-name/${kind}/${namespace}/${name}/refresh`
 );
 toast.success('Service refresh initiated!');
 } catch (error) {
 if (this.demoMode) {
 toast.success('Service refresh initiated (demo mode)!');
 return;
 }
 throw error;
 }
 }

 // Get entity facets (available values for filters)
 async getEntityFacets(): Promise<{
 facets: Record<string, Array<{ count: number; value: string }>>;
 }> {
 try {
 const response = await this.api.get('/api/catalog/entity-facets');
 return response.data;
 } catch (error) {
 if (this.demoMode) {
 return {
 facets: {
 kind: [
 { value: 'Component', count: 15 },
 { value: 'API', count: 8 },
 { value: 'System', count: 3 },
 ],
 'spec.type': [
 { value: 'service', count: 10 },
 { value: 'website', count: 3 },
 { value: 'library', count: 2 },
 ],
 'spec.lifecycle': [
 { value: 'production', count: 8 },
 { value: 'experimental', count: 5 },
 { value: 'deprecated', count: 2 },
 ],
 },
 };
 }
 throw error;
 }
 }

 // Template API Implementation
 async getTemplates(): Promise<TemplateEntityV1beta3[]> {
 try {
 const apiPath = USE_PROXY ? '/api/backstage/catalog/entities' : '/api/catalog/entities';
 const response = await this.api.get<CatalogListResponse>(
 `${apiPath}?filter=kind=Template`
 );
 return response.data.items as TemplateEntityV1beta3[];
 } catch (error) {
 if (this.demoMode) {
 return this.getDemoTemplates();
 }
 throw error;
 }
 }

 async getTemplate(templateRef: string): Promise<TemplateEntityV1beta3> {
 try {
 const { namespace, kind, name } = parseEntityRef(templateRef);
 const response = await this.api.get<TemplateEntityV1beta3>(
 `/api/catalog/entities/by-name/${kind}/${namespace}/${name}`
 );
 return response.data;
 } catch (error) {
 if (this.demoMode) {
 return this.getDemoTemplate(templateRef);
 }
 throw error;
 }
 }

 async executeTemplate(
 templateRef: string,
 values: Record<string, any>
 ): Promise<string> {
 try {
 const response = await this.api.post<{ id: string }>(
 '/api/scaffolder/v2/tasks',
 {
 templateRef,
 values,
 }
 );
 toast.success('Template execution started!');
 return response.data.id;
 } catch (error) {
 if (this.demoMode) {
 const taskId = `demo-task-${Date.now()}`;
 toast.success('Template execution started (demo mode)!');
 return taskId;
 }
 throw error;
 }
 }

 // Health check
 async getHealth(): Promise<{ status: string; details: any }> {
 try {
 const response = await this.api.get('/api/catalog/health');
 return response.data;
 } catch (error) {
 if (this.demoMode) {
 return { status: 'healthy', details: { mode: 'demo' } };
 }
 throw error;
 }
 }

 // Demo data providers
 private getDemoEntities(filters?: CatalogFilters): Entity[] {
 const demoEntities: ServiceEntity[] = [
 {
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'Component',
 metadata: {
 name: 'user-service',
 namespace: 'default',
 title: 'User Service',
 description: 'Handles user authentication and profile management',
 tags: ['backend', 'api', 'typescript', 'auth'],
 annotations: {
 'backstage.io/managed-by-location': 'url:https://github.com/company/user-service/blob/main/catalog-info.yaml',
 'backstage.io/techdocs-ref': 'dir:.',
 'github.com/project-slug': 'company/user-service',
 },
 links: [
 {
 url: 'https://github.com/company/user-service',
 title: 'GitHub',
 icon: 'github',
 },
 {
 url: 'https://user-service.company.com/docs',
 title: 'API Docs',
 icon: 'docs',
 },
 ],
 },
 spec: {
 type: 'service',
 lifecycle: 'production',
 owner: 'team-platform',
 system: 'user-management',
 providesApis: ['user-api-v1', 'user-api-v2'],
 dependsOn: ['Component:default/auth-service', 'Resource:default/user-database'],
 },
 status: {
 items: [
 {
 type: 'health',
 level: 'info',
 message: 'Service is healthy',
 },
 {
 type: 'deployment', 
 level: 'info',
 message: 'Deployed version 1.2.3',
 },
 ],
 },
 relations: [
 {
 type: 'dependsOn',
 targetRef: 'Component:default/auth-service',
 },
 {
 type: 'dependsOn',
 targetRef: 'Resource:default/user-database',
 },
 {
 type: 'providesApi',
 targetRef: 'API:default/user-api-v1',
 },
 {
 type: 'ownedBy',
 targetRef: 'Group:default/team-platform',
 },
 ],
 },
 {
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'Component',
 metadata: {
 name: 'payment-service',
 namespace: 'default',
 title: 'Payment Service',
 description: 'Processes payments and handles billing operations with PCI compliance',
 tags: ['backend', 'api', 'python', 'payments', 'pci'],
 annotations: {
 'backstage.io/managed-by-location': 'url:https://github.com/company/payment-service/blob/main/catalog-info.yaml',
 'pagerduty.com/integration-key': 'payment-service-key',
 },
 links: [
 {
 url: 'https://github.com/company/payment-service',
 title: 'GitHub',
 },
 {
 url: 'https://payment-dashboard.company.com',
 title: 'Dashboard',
 },
 ],
 },
 spec: {
 type: 'service',
 lifecycle: 'production',
 owner: 'team-payments',
 system: 'commerce',
 providesApis: ['payment-api'],
 dependsOn: [
 'Component:default/user-service',
 'Component:default/notification-service',
 'Resource:default/payment-database',
 ],
 },
 status: {
 items: [
 {
 type: 'health',
 level: 'warning',
 message: 'High latency detected in payment processing',
 },
 ],
 },
 },
 {
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'Component',
 metadata: {
 name: 'frontend-app',
 namespace: 'default',
 title: 'Frontend Application',
 description: 'Main customer-facing web application built with React',
 tags: ['frontend', 'react', 'typescript', 'web'],
 annotations: {
 'backstage.io/managed-by-location': 'url:https://github.com/company/frontend-app/blob/main/catalog-info.yaml',
 'sonarqube.org/project-key': 'frontend-app',
 },
 },
 spec: {
 type: 'website',
 lifecycle: 'production',
 owner: 'team-frontend',
 system: 'customer-portal',
 consumesApis: ['user-api-v2', 'payment-api', 'catalog-api'],
 dependsOn: ['Component:default/design-system'],
 },
 status: {
 items: [
 {
 type: 'health',
 level: 'info',
 message: 'All systems operational',
 },
 ],
 },
 },
 {
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'Component',
 metadata: {
 name: 'notification-service',
 namespace: 'default',
 title: 'Notification Service',
 description: 'Sends emails, SMS, and push notifications to users',
 tags: ['backend', 'messaging', 'node', 'notifications'],
 annotations: {
 'backstage.io/managed-by-location': 'url:https://github.com/company/notification-service/blob/main/catalog-info.yaml',
 },
 },
 spec: {
 type: 'service',
 lifecycle: 'experimental',
 owner: 'team-platform',
 system: 'communication',
 providesApis: ['notification-api'],
 dependsOn: ['Component:default/queue-service', 'Resource:default/notification-templates'],
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
 {
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'Component',
 metadata: {
 name: 'analytics-service',
 namespace: 'default',
 title: 'Analytics Service',
 description: 'Collects and processes user behavior data for insights',
 tags: ['backend', 'analytics', 'java', 'bigdata'],
 annotations: {
 'backstage.io/managed-by-location': 'url:https://github.com/company/analytics-service/blob/main/catalog-info.yaml',
 },
 },
 spec: {
 type: 'service',
 lifecycle: 'production',
 owner: 'team-data',
 system: 'analytics',
 providesApis: ['analytics-api'],
 dependsOn: ['Resource:default/data-warehouse', 'Component:default/event-streaming'],
 },
 status: {
 items: [
 {
 type: 'health',
 level: 'error',
 message: 'Database connection issues detected',
 },
 ],
 },
 },
 ];

 // Apply filters
 let filtered = demoEntities as Entity[];
 
 if (filters?.kind) {
 const kinds = Array.isArray(filters.kind) ? filters.kind : [filters.kind];
 filtered = filtered.filter(e => kinds.includes(e.kind));
 }
 
 if (filters?.type) {
 const types = Array.isArray(filters.type) ? filters.type : [filters.type];
 filtered = filtered.filter(e => types.includes((e.spec as any).type));
 }
 
 if (filters?.owner) {
 const owners = Array.isArray(filters.owner) ? filters.owner : [filters.owner];
 filtered = filtered.filter(e => owners.includes((e.spec as any).owner));
 }
 
 if (filters?.lifecycle) {
 const lifecycles = Array.isArray(filters.lifecycle) ? filters.lifecycle : [filters.lifecycle];
 filtered = filtered.filter(e => lifecycles.includes((e.spec as any).lifecycle));
 }
 
 if (filters?.tag) {
 const tags = Array.isArray(filters.tag) ? filters.tag : [filters.tag];
 filtered = filtered.filter(e => {
 const entityTags = e.metadata.tags || [];
 return tags.some(tag => entityTags.includes(tag));
 });
 }

 return filtered;
 }

 private getDemoEntity(entityRef: string): Entity {
 const entities = this.getDemoEntities();
 
 try {
 const { namespace, kind, name } = parseEntityRef(entityRef);
 
 const entity = entities.find(e => 
 e.metadata.namespace === namespace &&
 e.kind === kind &&
 e.metadata.name === name
 );
 
 if (entity) {
 return entity;
 }
 } catch (error) {
 console.log('Failed to parse entity ref, trying direct name match:', entityRef);
 }
 
 // Try to find by name only as fallback
 const entity = entities.find(e => 
 e.metadata.name === entityRef || 
 e.metadata.name === entityRef.split('/').pop()
 );
 
 if (!entity) {
 // Return a default entity to prevent errors
 console.log('Entity not found, returning placeholder:', entityRef);
 return {
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'Component',
 metadata: {
 name: entityRef.split('/').pop() || 'unknown',
 namespace: 'default',
 title: 'New Service',
 description: 'This service is being created',
 },
 spec: {
 type: 'service',
 lifecycle: 'experimental',
 owner: 'guest',
 }
 } as Entity;
 }
 
 return entity;
 }

 private getDemoTemplates(): TemplateEntityV1beta3[] {
 return [
 {
 apiVersion: 'scaffolder.backstage.io/v1beta3',
 kind: 'Template',
 metadata: {
 name: 'nodejs-service',
 namespace: 'default',
 title: 'Node.js Service',
 description: 'Create a new Node.js microservice with TypeScript, Express, and best practices',
 tags: ['nodejs', 'typescript', 'service', 'backend'],
 annotations: {
 'backstage.io/managed-by-location': 'url:https://github.com/company/backstage-templates/blob/main/nodejs-service/template.yaml',
 },
 },
 spec: {
 owner: 'team-platform',
 type: 'service',
 parameters: [
 {
 title: 'Service Information',
 required: ['name', 'description'],
 properties: {
 name: {
 title: 'Name',
 type: 'string',
 description: 'Unique name of the service',
 pattern: '^[a-z0-9-]+$',
 maxLength: 50,
 },
 description: {
 title: 'Description',
 type: 'string',
 description: 'What does this service do?',
 },
 owner: {
 title: 'Owner',
 type: 'string',
 description: 'Team responsible for this service',
 ui: {
 field: 'OwnerPicker',
 options: {
 catalogFilter: {
 kind: ['Group', 'User'],
 },
 },
 },
 },
 },
 },
 {
 title: 'Choose Repository',
 required: ['repoUrl'],
 properties: {
 repoUrl: {
 title: 'Repository Location',
 type: 'string',
 ui: {
 field: 'RepoUrlPicker',
 options: {
 allowedHosts: ['github.com'],
 },
 },
 },
 },
 },
 ],
 steps: [
 {
 id: 'fetch',
 name: 'Fetch Base',
 action: 'fetch:template',
 input: {
 url: './content',
 values: {
 name: '${{ parameters.name }}',
 description: '${{ parameters.description }}',
 owner: '${{ parameters.owner }}',
 },
 },
 },
 {
 id: 'publish',
 name: 'Publish to GitHub',
 action: 'publish:github',
 input: {
 repoUrl: '${{ parameters.repoUrl }}',
 description: 'This is ${{ parameters.name }}',
 defaultBranch: 'main',
 },
 },
 {
 id: 'register',
 name: 'Register in Catalog',
 action: 'catalog:register',
 input: {
 repoContentsUrl: '${{ steps["publish"].output.repoContentsUrl }}',
 catalogInfoPath: '/catalog-info.yaml',
 },
 },
 ],
 output: {
 links: [
 {
 title: 'Repository',
 url: '${{ steps["publish"].output.remoteUrl }}',
 },
 {
 title: 'Open in catalog',
 icon: 'catalog',
 entityRef: '${{ steps["register"].output.entityRef }}',
 },
 ],
 },
 },
 },
 {
 apiVersion: 'scaffolder.backstage.io/v1beta3',
 kind: 'Template',
 metadata: {
 name: 'react-app',
 namespace: 'default',
 title: 'React Application',
 description: 'Create a new React application with TypeScript, Vite, and modern tooling',
 tags: ['react', 'frontend', 'typescript', 'vite'],
 },
 spec: {
 owner: 'team-frontend',
 type: 'website',
 parameters: [
 {
 title: 'Application Information',
 required: ['name', 'description'],
 properties: {
 name: {
 title: 'Name',
 type: 'string',
 description: 'Unique name of the application',
 },
 description: {
 title: 'Description',
 type: 'string',
 },
 },
 },
 ],
 steps: [],
 output: {},
 },
 },
 ];
 }

 private getDemoTemplate(templateRef: string): TemplateEntityV1beta3 {
 const templates = this.getDemoTemplates();
 
 // Handle simple template name or full entity ref
 let templateName: string;
 if (templateRef.includes(':') || templateRef.includes('/')) {
 try {
 const { name } = parseEntityRef(templateRef);
 templateName = name;
 } catch {
 // If parsing fails, use the ref as is
 templateName = templateRef;
 }
 } else {
 templateName = templateRef;
 }
 
 const template = templates.find(t => 
 t.metadata.name === templateName
 );
 
 if (!template) {
 throw new BackstageApiError('Template not found', 404);
 }
 
 return template;
 }
}

// Export singleton instance
export const backstageClient = new BackstageClient();

// Re-export types
export type { Entity, ServiceEntity, EnrichedEntity, TemplateEntityV1beta3 } from './types';