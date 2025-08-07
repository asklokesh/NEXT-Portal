/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { z } from 'zod';

// TechDocs metadata schemas
export const TechDocsMetadataSchema = z.object({
 site_name: z.string(),
 site_description: z.string().optional(),
 site_url: z.string().optional(),
 repo_url: z.string().optional(),
 edit_uri: z.string().optional(),
 etag: z.string(),
 build_timestamp: z.number(),
 files: z.array(z.string()),
});

export const TechDocsConfigSchema = z.object({
 builder: z.enum(['local', 'external']),
 generator: z.object({
 runIn: z.enum(['docker', 'local']),
 dockerImage: z.string().optional(),
 pullImage: z.boolean().optional(),
 }).optional(),
 publisher: z.object({
 type: z.enum(['local', 'googleGcs', 'awsS3', 'azureBlobStorage', 'openStackSwift']),
 googleGcs: z.object({
 bucketName: z.string(),
 credentials: z.string().optional(),
 }).optional(),
 awsS3: z.object({
 bucketName: z.string(),
 region: z.string().optional(),
 credentials: z.object({
 accessKeyId: z.string(),
 secretAccessKey: z.string(),
 }).optional(),
 }).optional(),
 }),
});

// TechDocs entity annotation
export const TechDocsAnnotationSchema = z.object({
 'backstage.io/techdocs-ref': z.string(),
 'backstage.io/techdocs-entity': z.string().optional(),
});

// TechDocs build information
export const TechDocsBuildInfoSchema = z.object({
 timestamp: z.string(),
 etag: z.string(),
 entityName: z.string(),
 entityNamespace: z.string(),
 entityKind: z.string(),
});

// TechDocs sync status
export const TechDocsSyncStatusSchema = z.object({
 cached: z.boolean(),
 published: z.boolean(),
 lastCachedAt: z.string().optional(),
 lastPublishedAt: z.string().optional(),
 lastSyncedAt: z.string().optional(),
});

// Search result for docs
export const TechDocsSearchResultSchema = z.object({
 title: z.string(),
 text: z.string(),
 location: z.string(),
 entityRef: z.string(),
 rank: z.number().optional(),
 highlight: z.object({
 preTag: z.string(),
 postTag: z.string(),
 fields: z.record(z.array(z.string())),
 }).optional(),
});

// API response schemas
export const TechDocsMetadataResponseSchema = TechDocsMetadataSchema;

export const TechDocsEntityDocsResponseSchema = z.object({
 content: z.string(),
 contentType: z.string(),
 etag: z.string(),
});

export const TechDocsSearchResponseSchema = z.object({
 results: z.array(TechDocsSearchResultSchema),
 nextPageCursor: z.string().optional(),
 previousPageCursor: z.string().optional(),
 totalResults: z.number().optional(),
});

export const TechDocsBuildLogResponseSchema = z.object({
 log: z.array(z.object({
 timestamp: z.string(),
 level: z.enum(['debug', 'info', 'warn', 'error']),
 message: z.string(),
 })),
});

export const TechDocsStatsResponseSchema = z.object({
 entityRef: z.string(),
 views: z.object({
 total: z.number(),
 lastWeek: z.number(),
 lastMonth: z.number(),
 }),
 popularPages: z.array(z.object({
 path: z.string(),
 title: z.string(),
 views: z.number(),
 })),
 lastUpdated: z.string(),
});

// Type exports
export type TechDocsMetadata = z.infer<typeof TechDocsMetadataSchema>;
export type TechDocsConfig = z.infer<typeof TechDocsConfigSchema>;
export type TechDocsAnnotation = z.infer<typeof TechDocsAnnotationSchema>;
export type TechDocsBuildInfo = z.infer<typeof TechDocsBuildInfoSchema>;
export type TechDocsSyncStatus = z.infer<typeof TechDocsSyncStatusSchema>;
export type TechDocsSearchResult = z.infer<typeof TechDocsSearchResultSchema>;
export type TechDocsEntityDocsResponse = z.infer<typeof TechDocsEntityDocsResponseSchema>;
export type TechDocsSearchResponse = z.infer<typeof TechDocsSearchResponseSchema>;
export type TechDocsBuildLogResponse = z.infer<typeof TechDocsBuildLogResponseSchema>;
export type TechDocsStatsResponse = z.infer<typeof TechDocsStatsResponseSchema>;

// Query parameter types
export interface TechDocsSearchOptions {
 term: string;
 filters?: {
 kind?: string | string[];
 lifecycle?: string | string[];
 owner?: string | string[];
 namespace?: string | string[];
 };
 pageLimit?: number;
 pageCursor?: string;
}

export interface TechDocsEntityOptions {
 entityRef: string;
 path?: string;
}

export interface TechDocsBuildOptions {
 entityRef: string;
 force?: boolean;
}

// Helper functions
export function parseEntityRef(entityRef: string): {
 kind: string;
 namespace: string;
 name: string;
} {
 const [kindPart, ...nameParts] = entityRef.split(':');
 const namePart = nameParts.join(':');
 
 if (namePart.includes('/')) {
 const [namespace, name] = namePart.split('/');
 return { kind: kindPart, namespace, name };
 }
 
 return { kind: kindPart, namespace: 'default', name: namePart };
}

export function buildEntityRef(kind: string, namespace: string, name: string): string {
 return namespace === 'default' ? `${kind}:${name}` : `${kind}:${namespace}/${name}`;
}

export function getTechDocsUrl(entityRef: string, path = ''): string {
 const { kind, namespace, name } = parseEntityRef(entityRef);
 const baseUrl = `/docs/${namespace}/${kind}/${name}`;
 return path ? `${baseUrl}/${path.replace(/^\//, '')}` : baseUrl;
}

export function extractTechDocsRef(annotations: Record<string, string>): string | null {
 return annotations['backstage.io/techdocs-ref'] || null;
}

export function hasTechDocs(annotations: Record<string, string>): boolean {
 return 'backstage.io/techdocs-ref' in annotations;
}

export function isDocumentationCached(syncStatus: TechDocsSyncStatus): boolean {
 return syncStatus.cached;
}

export function isDocumentationPublished(syncStatus: TechDocsSyncStatus): boolean {
 return syncStatus.published;
}

export function getLastSyncTime(syncStatus: TechDocsSyncStatus): Date | null {
 const lastSync = syncStatus.lastSyncedAt || syncStatus.lastPublishedAt || syncStatus.lastCachedAt;
 return lastSync ? new Date(lastSync) : null;
}

export function isDocumentationStale(
 syncStatus: TechDocsSyncStatus,
 staleThreshold = 24 * 60 * 60 * 1000 // 24 hours
): boolean {
 const lastSync = getLastSyncTime(syncStatus);
 if (!lastSync) return true;
 
 return Date.now() - lastSync.getTime() > staleThreshold;
}

// Content type utilities
export function isMarkdownContent(contentType: string): boolean {
 return contentType.includes('text/markdown') || contentType.includes('text/x-markdown');
}

export function isHtmlContent(contentType: string): boolean {
 return contentType.includes('text/html');
}

export function isPdfContent(contentType: string): boolean {
 return contentType.includes('application/pdf');
}

export function isImageContent(contentType: string): boolean {
 return contentType.startsWith('image/');
}

// Search result helpers
export function highlightSearchTerm(
 text: string,
 term: string,
 preTag = '<mark>',
 postTag = '</mark>'
): string {
 if (!term) return text;
 
 const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
 return text.replace(regex, `${preTag}$1${postTag}`);
}

export function extractSearchSnippet(
 text: string,
 term: string,
 maxLength = 200
): string {
 if (!term) return text.substring(0, maxLength);
 
 const termIndex = text.toLowerCase().indexOf(term.toLowerCase());
 if (termIndex === -1) return text.substring(0, maxLength);
 
 const start = Math.max(0, termIndex - Math.floor(maxLength / 2));
 const end = Math.min(text.length, start + maxLength);
 
 let snippet = text.substring(start, end);
 
 if (start > 0) snippet = '...' + snippet;
 if (end < text.length) snippet = snippet + '...';
 
 return snippet;
}