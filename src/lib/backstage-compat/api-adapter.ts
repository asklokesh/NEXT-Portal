import { versionManager } from './version-manager';

export interface ApiRequest {
 path: string;
 method: string;
 params?: Record<string, any>;
 body?: any;
 headers?: Record<string, string>;
}

export interface ApiResponse<T = any> {
 data: T;
 status: number;
 headers: Headers;
}

export class BackstageApiAdapter {
 private baseUrl: string;
 private static instance: BackstageApiAdapter;

 private constructor(baseUrl: string = '/api/backstage') {
 this.baseUrl = baseUrl;
 }

 static getInstance(baseUrl?: string): BackstageApiAdapter {
 if (!BackstageApiAdapter.instance) {
 BackstageApiAdapter.instance = new BackstageApiAdapter(baseUrl);
 }
 return BackstageApiAdapter.instance;
 }

 async request<T = any>(request: ApiRequest): Promise<ApiResponse<T>> {
 // Translate API endpoint based on current Backstage version
 const translated = versionManager.translateApiCall(request.path, request.method);
 
 if (translated.deprecated) {
 console.warn(
 `API endpoint ${request.method} ${request.path} is deprecated. ` +
 `Using ${translated.path} instead.`
 );
 }

 // Build the full URL
 const url = new URL(`${this.baseUrl}${translated.path}`, window.location.origin);
 
 // Add query parameters if present
 if (request.params) {
 Object.entries(request.params).forEach(([key, value]) => {
 if (value !== undefined && value !== null) {
 url.searchParams.append(key, String(value));
 }
 });
 }

 // Prepare headers
 const headers = new Headers(request.headers || {});
 if (!headers.has('Content-Type') && request.body && typeof request.body === 'object') {
 headers.set('Content-Type', 'application/json');
 }

 // Make the request
 const response = await fetch(url.toString(), {
 method: request.method,
 headers,
 body: request.body ? JSON.stringify(request.body) : undefined,
 credentials: 'include'
 });

 // Handle response
 const contentType = response.headers.get('content-type');
 let data: T;

 if (contentType?.includes('application/json')) {
 data = await response.json();
 } else if (contentType?.includes('text/')) {
 data = await response.text() as T;
 } else {
 data = await response.blob() as T;
 }

 if (!response.ok) {
 throw new ApiError(
 `API request failed: ${response.status} ${response.statusText}`,
 response.status,
 data
 );
 }

 return {
 data,
 status: response.status,
 headers: response.headers
 };
 }

 // Catalog API methods with version compatibility
 async getCatalogEntities(params?: {
 filter?: string;
 fields?: string[];
 offset?: number;
 limit?: number;
 }): Promise<ApiResponse> {
 return this.request({
 path: '/catalog/entities',
 method: 'GET',
 params
 });
 }

 async getCatalogEntityByName(
 kind: string,
 namespace: string,
 name: string
 ): Promise<ApiResponse> {
 const version = versionManager.getVersion();
 
 // Use new endpoint for versions >= 1.20.0
 if (version && parseFloat(version) >= 1.20) {
 // First get entities and find by name to get UID
 const entities = await this.getCatalogEntities({
 filter: `kind=${kind},metadata.namespace=${namespace},metadata.name=${name}`
 });
 
 if (entities.data.items && entities.data.items.length > 0) {
 const uid = entities.data.items[0].metadata.uid;
 return this.getCatalogEntityByUid(uid);
 }
 
 throw new ApiError('Entity not found', 404, null);
 }
 
 // Use old endpoint for older versions
 return this.request({
 path: `/catalog/entities/by-name/${kind}/${namespace}/${name}`,
 method: 'GET'
 });
 }

 async getCatalogEntityByUid(uid: string): Promise<ApiResponse> {
 return this.request({
 path: `/catalog/entities/by-uid/${uid}`,
 method: 'GET'
 });
 }

 async createCatalogEntity(entity: any): Promise<ApiResponse> {
 return this.request({
 path: '/catalog/entities',
 method: 'POST',
 body: entity
 });
 }

 async updateCatalogEntity(uid: string, entity: any): Promise<ApiResponse> {
 return this.request({
 path: `/catalog/entities/by-uid/${uid}`,
 method: 'PUT',
 body: entity
 });
 }

 async deleteCatalogEntity(uid: string): Promise<ApiResponse> {
 return this.request({
 path: `/catalog/entities/by-uid/${uid}`,
 method: 'DELETE'
 });
 }

 // Scaffolder API methods with version compatibility
 async getTemplates(): Promise<ApiResponse> {
 const version = versionManager.getVersion();
 
 // Use v2 endpoint for versions >= 1.22.0
 if (version && parseFloat(version) >= 1.22) {
 return this.request({
 path: '/scaffolder/v2/templates',
 method: 'GET'
 });
 }
 
 // Use v1 endpoint for older versions
 return this.request({
 path: '/scaffolder/v1/templates',
 method: 'GET'
 });
 }

 async getTemplate(templateRef: string): Promise<ApiResponse> {
 const version = versionManager.getVersion();
 
 if (version && parseFloat(version) >= 1.22) {
 return this.request({
 path: `/scaffolder/v2/templates/${encodeURIComponent(templateRef)}`,
 method: 'GET'
 });
 }
 
 return this.request({
 path: `/scaffolder/v1/templates/${encodeURIComponent(templateRef)}`,
 method: 'GET'
 });
 }

 async executeTemplate(
 templateRef: string,
 values: Record<string, any>
 ): Promise<ApiResponse> {
 const version = versionManager.getVersion();
 
 if (version && parseFloat(version) >= 1.22) {
 return this.request({
 path: '/scaffolder/v2/tasks',
 method: 'POST',
 body: {
 templateRef,
 values
 }
 });
 }
 
 return this.request({
 path: '/scaffolder/v1/tasks',
 method: 'POST',
 body: {
 templateRef,
 values
 }
 });
 }

 // TechDocs API methods
 async getTechDocsMetadata(
 namespace: string,
 kind: string,
 name: string
 ): Promise<ApiResponse> {
 return this.request({
 path: `/techdocs/metadata/entity/${namespace}/${kind}/${name}`,
 method: 'GET'
 });
 }

 async getTechDocsPage(
 namespace: string,
 kind: string,
 name: string,
 path: string
 ): Promise<ApiResponse> {
 return this.request({
 path: `/techdocs/docs/${namespace}/${kind}/${name}/${path}`,
 method: 'GET'
 });
 }

 // Permission API methods
 async checkPermission(permission: string, resourceRef?: string): Promise<ApiResponse> {
 return this.request({
 path: '/permissions/check',
 method: 'POST',
 body: {
 permission,
 resourceRef
 }
 });
 }

 // Search API methods
 async search(query: string, options?: {
 types?: string[];
 filters?: Record<string, string[]>;
 pageCursor?: string;
 }): Promise<ApiResponse> {
 return this.request({
 path: '/search/query',
 method: 'GET',
 params: {
 term: query,
 types: options?.types?.join(','),
 filters: options?.filters ? JSON.stringify(options.filters) : undefined,
 pageCursor: options?.pageCursor
 }
 });
 }

 // Version compatibility check
 async checkVersionCompatibility(): Promise<{
 supported: boolean;
 currentVersion: string;
 supportedRange: { min: string; max: string };
 recommendations: string[];
 }> {
 const currentVersion = await versionManager.detectBackstageVersion();
 const supportedRange = versionManager.getSupportedVersionRange();
 const supported = versionManager.isVersionSupported(currentVersion);
 
 const recommendations: string[] = [];
 
 if (!supported) {
 recommendations.push(
 `Your Backstage version (${currentVersion}) is outside the supported range ` +
 `(${supportedRange.min} - ${supportedRange.max})`
 );
 
 if (currentVersion < supportedRange.min) {
 recommendations.push('Consider upgrading your Backstage instance');
 } else {
 recommendations.push(
 'This wrapper may not support all features of your Backstage version'
 );
 }
 }
 
 return {
 supported,
 currentVersion,
 supportedRange,
 recommendations
 };
 }
}

export class ApiError extends Error {
 constructor(
 message: string,
 public status: number,
 public data: any
 ) {
 super(message);
 this.name = 'ApiError';
 }
}

export const apiAdapter = BackstageApiAdapter.getInstance();