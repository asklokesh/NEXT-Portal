/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { z } from 'zod';

import {
 TechDocsMetadataResponseSchema,
 TechDocsEntityDocsResponseSchema,
 TechDocsSearchResponseSchema,
 TechDocsBuildLogResponseSchema,
 TechDocsStatsResponseSchema,
 parseEntityRef,
 buildEntityRef,
 getTechDocsUrl,
} from '../types/techdocs';
import { createBackstageClient } from '../utils/api-client';

import type { RequestOptions } from '../types/common';
import type {
 TechDocsMetadata,
 TechDocsEntityDocsResponse,
 TechDocsSearchResponse,
 TechDocsBuildLogResponse,
 TechDocsStatsResponse,
 TechDocsSearchOptions,
 TechDocsEntityOptions,
 TechDocsBuildOptions} from '../types/techdocs';
import type { BackstageApiClient} from '../utils/api-client';

// Additional response schemas
const TechDocsBuildResponseSchema = z.object({
 buildId: z.string(),
 status: z.enum(['pending', 'building', 'completed', 'failed']),
 startedAt: z.string(),
 completedAt: z.string().optional(),
 errorMessage: z.string().optional(),
});

const TechDocsEntityListResponseSchema = z.object({
 entities: z.array(z.object({
 entityRef: z.string(),
 kind: z.string(),
 namespace: z.string(),
 name: z.string(),
 title: z.string().optional(),
 hasDocumentation: z.boolean(),
 lastUpdated: z.string().optional(),
 })),
});

const TechDocsSyncResponseSchema = z.object({
 status: z.enum(['success', 'error', 'not_found']),
 message: z.string(),
 timestamp: z.string(),
});

// Type definitions
export type TechDocsBuildResponse = z.infer<typeof TechDocsBuildResponseSchema>;
export type TechDocsEntityListResponse = z.infer<typeof TechDocsEntityListResponseSchema>;
export type TechDocsSyncResponse = z.infer<typeof TechDocsSyncResponseSchema>;

export interface TechDocsDownloadOptions extends RequestOptions {
 format?: 'html' | 'pdf' | 'zip';
}

export interface TechDocsAnalyticsOptions {
 timeRange?: '1d' | '7d' | '30d' | '90d';
 includePopularPages?: boolean;
}

export class TechDocsClient {
 private readonly client: BackstageApiClient;

 constructor() {
 this.client = createBackstageClient('techdocs');
 }

 // Get metadata for entity documentation
 async getEntityMetadata(
 entityRef: string,
 options: RequestOptions = {}
 ): Promise<TechDocsMetadata> {
 const { kind, namespace, name } = parseEntityRef(entityRef);
 
 return this.client.request(
 {
 method: 'GET',
 url: `/metadata/${namespace}/${kind}/${name}`,
 },
 TechDocsMetadataResponseSchema,
 options
 );
 }

 // Get documentation content for entity
 async getEntityDocs(
 entityOptions: TechDocsEntityOptions,
 options: RequestOptions = {}
 ): Promise<TechDocsEntityDocsResponse> {
 const { kind, namespace, name } = parseEntityRef(entityOptions.entityRef);
 const path = entityOptions.path || 'index.html';
 
 return this.client.request(
 {
 method: 'GET',
 url: `/static/docs/${namespace}/${kind}/${name}/${path}`,
 },
 TechDocsEntityDocsResponseSchema,
 options
 );
 }

 // Get raw documentation file
 async getDocumentationFile(
 entityRef: string,
 filePath: string,
 options: RequestOptions = {}
 ): Promise<string> {
 const { kind, namespace, name } = parseEntityRef(entityRef);
 
 const response = await this.client.get<string>(
 `/static/docs/${namespace}/${kind}/${name}/${filePath}`,
 {},
 options
 );

 return response;
 }

 // Search across all documentation
 async searchDocumentation(
 searchOptions: TechDocsSearchOptions,
 options: RequestOptions = {}
 ): Promise<TechDocsSearchResponse> {
 const params = this.buildSearchParams(searchOptions);
 
 return this.client.request(
 {
 method: 'GET',
 url: '/search',
 params,
 },
 TechDocsSearchResponseSchema,
 options
 );
 }

 // Get list of entities with documentation
 async getDocumentedEntities(
 filters: {
 kind?: string | string[];
 namespace?: string | string[];
 hasDocumentation?: boolean;
 } = {},
 options: RequestOptions = {}
 ): Promise<TechDocsEntityListResponse> {
 const params = this.buildEntityFilters(filters);
 
 return this.client.request(
 {
 method: 'GET',
 url: '/entities',
 params,
 },
 TechDocsEntityListResponseSchema,
 options
 );
 }

 // Trigger documentation build
 async buildDocumentation(
 buildOptions: TechDocsBuildOptions,
 options: RequestOptions = {}
 ): Promise<TechDocsBuildResponse> {
 const { kind, namespace, name } = parseEntityRef(buildOptions.entityRef);
 
 return this.client.request(
 {
 method: 'POST',
 url: `/build/${namespace}/${kind}/${name}`,
 data: {
 force: buildOptions.force || false,
 },
 },
 TechDocsBuildResponseSchema,
 { ...options, cache: false }
 );
 }

 // Get build status
 async getBuildStatus(
 entityRef: string,
 options: RequestOptions = {}
 ): Promise<TechDocsBuildResponse> {
 const { kind, namespace, name } = parseEntityRef(entityRef);
 
 return this.client.request(
 {
 method: 'GET',
 url: `/build/${namespace}/${kind}/${name}/status`,
 },
 TechDocsBuildResponseSchema,
 options
 );
 }

 // Get build logs
 async getBuildLogs(
 entityRef: string,
 options: RequestOptions = {}
 ): Promise<TechDocsBuildLogResponse> {
 const { kind, namespace, name } = parseEntityRef(entityRef);
 
 return this.client.request(
 {
 method: 'GET',
 url: `/build/${namespace}/${kind}/${name}/logs`,
 },
 TechDocsBuildLogResponseSchema,
 options
 );
 }

 // Sync documentation from source
 async syncDocumentation(
 entityRef: string,
 options: RequestOptions = {}
 ): Promise<TechDocsSyncResponse> {
 const { kind, namespace, name } = parseEntityRef(entityRef);
 
 return this.client.request(
 {
 method: 'POST',
 url: `/sync/${namespace}/${kind}/${name}`,
 },
 TechDocsSyncResponseSchema,
 { ...options, cache: false }
 );
 }

 // Download documentation
 async downloadDocumentation(
 entityRef: string,
 downloadOptions: TechDocsDownloadOptions = {}
 ): Promise<Blob> {
 const { kind, namespace, name } = parseEntityRef(entityRef);
 const format = downloadOptions.format || 'zip';
 
 const response = await this.client.client.get(
 `/download/${namespace}/${kind}/${name}`,
 {
 params: { format },
 responseType: 'blob',
 signal: downloadOptions.signal,
 timeout: downloadOptions.timeout,
 }
 );

 return response.data;
 }

 // Get documentation statistics
 async getDocumentationStats(
 entityRef: string,
 analyticsOptions: TechDocsAnalyticsOptions = {},
 options: RequestOptions = {}
 ): Promise<TechDocsStatsResponse> {
 const { kind, namespace, name } = parseEntityRef(entityRef);
 const params = this.buildAnalyticsParams(analyticsOptions);
 
 return this.client.request(
 {
 method: 'GET',
 url: `/stats/${namespace}/${kind}/${name}`,
 params,
 },
 TechDocsStatsResponseSchema,
 options
 );
 }

 // Get global documentation analytics
 async getGlobalStats(
 analyticsOptions: TechDocsAnalyticsOptions = {},
 options: RequestOptions = {}
 ): Promise<{
 totalDocuments: number;
 totalViews: number;
 popularDocuments: Array<{
 entityRef: string;
 title: string;
 views: number;
 }>;
 recentlyUpdated: Array<{
 entityRef: string;
 title: string;
 lastUpdated: string;
 }>;
 }> {
 const params = this.buildAnalyticsParams(analyticsOptions);
 
 const response = await this.client.get<any>(
 '/stats/global',
 params,
 options
 );

 return response;
 }

 // Search within specific entity documentation
 async searchEntityDocs(
 entityRef: string,
 term: string,
 options: RequestOptions = {}
 ): Promise<TechDocsSearchResponse> {
 const { kind, namespace, name } = parseEntityRef(entityRef);
 
 return this.client.request(
 {
 method: 'GET',
 url: `/search/${namespace}/${kind}/${name}`,
 params: { term },
 },
 TechDocsSearchResponseSchema,
 options
 );
 }

 // Get documentation tree/navigation
 async getDocumentationTree(
 entityRef: string,
 options: RequestOptions = {}
 ): Promise<{
 tree: Array<{
 name: string;
 path: string;
 type: 'file' | 'directory';
 children?: Array<any>;
 }>;
 }> {
 const { kind, namespace, name } = parseEntityRef(entityRef);
 
 const response = await this.client.get<any>(
 `/tree/${namespace}/${kind}/${name}`,
 {},
 options
 );

 return response;
 }

 // Validate documentation configuration
 async validateConfiguration(
 entityRef: string,
 options: RequestOptions = {}
 ): Promise<{
 valid: boolean;
 errors: string[];
 warnings: string[];
 }> {
 const { kind, namespace, name } = parseEntityRef(entityRef);
 
 const response = await this.client.get<any>(
 `/validate/${namespace}/${kind}/${name}`,
 {},
 options
 );

 return response;
 }

 // Get documentation health status
 async getHealthStatus(
 entityRef?: string,
 options: RequestOptions = {}
 ): Promise<{
 status: 'healthy' | 'degraded' | 'unhealthy';
 checks: Array<{
 name: string;
 status: 'pass' | 'fail' | 'warn';
 message: string;
 }>;
 }> {
 const url = entityRef 
 ? `/health/${parseEntityRef(entityRef).namespace}/${parseEntityRef(entityRef).kind}/${parseEntityRef(entityRef).name}`
 : '/health';
 
 const response = await this.client.get<any>(url, {}, options);
 return response;
 }

 // Cache management methods
 async invalidateCache(
 entityRef: string,
 options: RequestOptions = {}
 ): Promise<{ success: boolean; message: string }> {
 const { kind, namespace, name } = parseEntityRef(entityRef);
 
 const response = await this.client.post<any>(
 `/cache/invalidate/${namespace}/${kind}/${name}`,
 {},
 { ...options, cache: false }
 );

 return response;
 }

 // Wait for build completion
 async waitForBuildCompletion(
 entityRef: string,
 options: {
 timeout?: number;
 pollInterval?: number;
 onProgress?: (status: TechDocsBuildResponse) => void;
 } = {}
 ): Promise<TechDocsBuildResponse> {
 const { timeout = 300000, pollInterval = 5000, onProgress } = options;
 const startTime = Date.now();

 return new Promise((resolve, reject) => {
 const poll = async () => {
 try {
 const status = await this.getBuildStatus(entityRef);
 onProgress?.(status);

 if (status.status === 'completed') {
 resolve(status);
 return;
 }

 if (status.status === 'failed') {
 reject(new Error(`Build failed: ${status.errorMessage || 'Unknown error'}`));
 return;
 }

 if (Date.now() - startTime > timeout) {
 reject(new Error(`Build timeout after ${timeout}ms`));
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

 // Helper method to build search parameters
 private buildSearchParams(searchOptions: TechDocsSearchOptions): Record<string, unknown> {
 const params: Record<string, unknown> = {
 term: searchOptions.term,
 };

 if (searchOptions.filters) {
 Object.entries(searchOptions.filters).forEach(([key, value]) => {
 if (value) {
 params[`filter[${key}]`] = Array.isArray(value) ? value.join(',') : value;
 }
 });
 }

 if (searchOptions.pageLimit) {
 params.pageLimit = searchOptions.pageLimit;
 }

 if (searchOptions.pageCursor) {
 params.pageCursor = searchOptions.pageCursor;
 }

 return params;
 }

 // Helper method to build entity filters
 private buildEntityFilters(filters: {
 kind?: string | string[];
 namespace?: string | string[];
 hasDocumentation?: boolean;
 }): Record<string, unknown> {
 const params: Record<string, unknown> = {};

 if (filters.kind) {
 params.kind = Array.isArray(filters.kind) ? filters.kind.join(',') : filters.kind;
 }

 if (filters.namespace) {
 params.namespace = Array.isArray(filters.namespace) ? filters.namespace.join(',') : filters.namespace;
 }

 if (filters.hasDocumentation !== undefined) {
 params.hasDocumentation = filters.hasDocumentation;
 }

 return params;
 }

 // Helper method to build analytics parameters
 private buildAnalyticsParams(analyticsOptions: TechDocsAnalyticsOptions): Record<string, unknown> {
 const params: Record<string, unknown> = {};

 if (analyticsOptions.timeRange) {
 params.timeRange = analyticsOptions.timeRange;
 }

 if (analyticsOptions.includePopularPages !== undefined) {
 params.includePopularPages = analyticsOptions.includePopularPages;
 }

 return params;
 }

 // Clear all cached data
 clearCache(): void {
 this.client.clearCache();
 }

 // Get cache statistics
 getCacheStats(): { size: number; entries: string[] } {
 return this.client.getCacheStats();
 }
}

// Export singleton instance
export const techDocsClient = new TechDocsClient();