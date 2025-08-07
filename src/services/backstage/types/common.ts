/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { z } from 'zod';

// Base Backstage types
export const EntityRefSchema = z.object({
 kind: z.string(),
 namespace: z.string().optional(),
 name: z.string(),
});

export const EntityMetadataSchema = z.object({
 uid: z.string().optional(),
 etag: z.string().optional(),
 generation: z.number().optional(),
 name: z.string(),
 namespace: z.string().optional(),
 labels: z.record(z.string()).optional(),
 annotations: z.record(z.string()).optional(),
 tags: z.array(z.string()).optional(),
 title: z.string().optional(),
 description: z.string().optional(),
 links: z.array(
 z.object({
 url: z.string(),
 title: z.string().optional(),
 icon: z.string().optional(),
 })
 ).optional(),
});

export const EntitySpecSchema = z.record(z.unknown());

export const EntityRelationSchema = z.object({
 type: z.string(),
 targetRef: z.string(),
 target: EntityRefSchema.optional(),
});

export const EntityStatusSchema = z.object({
 items: z.array(
 z.object({
 type: z.string(),
 level: z.enum(['info', 'warning', 'error']),
 message: z.string(),
 error: z.object({
 name: z.string(),
 message: z.string(),
 stack: z.string().optional(),
 }).optional(),
 })
 ).optional(),
});

export const BaseEntitySchema = z.object({
 apiVersion: z.string(),
 kind: z.string(),
 metadata: EntityMetadataSchema,
 spec: EntitySpecSchema.optional(),
 relations: z.array(EntityRelationSchema).optional(),
 status: EntityStatusSchema.optional(),
});

// API Response wrappers
export const PaginatedResponseSchema = z.object({
 items: z.array(z.unknown()),
 totalItems: z.number().optional(),
 pageInfo: z.object({
 nextCursor: z.string().optional(),
 prevCursor: z.string().optional(),
 hasNextPage: z.boolean().optional(),
 hasPrevPage: z.boolean().optional(),
 }).optional(),
});

export const ErrorResponseSchema = z.object({
 error: z.object({
 name: z.string(),
 message: z.string(),
 stack: z.string().optional(),
 details: z.record(z.unknown()).optional(),
 }),
 request: z.object({
 method: z.string(),
 url: z.string(),
 }).optional(),
 response: z.object({
 statusCode: z.number(),
 }).optional(),
});

// Type exports
export type EntityRef = z.infer<typeof EntityRefSchema>;
export type EntityMetadata = z.infer<typeof EntityMetadataSchema>;
export type EntitySpec = z.infer<typeof EntitySpecSchema>;
export type EntityRelation = z.infer<typeof EntityRelationSchema>;
export type EntityStatus = z.infer<typeof EntityStatusSchema>;
export type BaseEntity = z.infer<typeof BaseEntitySchema>;
export type PaginatedResponse<T> = Omit<z.infer<typeof PaginatedResponseSchema>, 'items'> & {
 items: T[];
};
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// Request options
export interface RequestOptions {
 signal?: AbortSignal;
 timeout?: number;
 retries?: number;
 cache?: boolean;
 cacheTTL?: number;
}

// Backstage specific query parameters
export interface CatalogQueryParams {
 filter?: string | string[];
 fields?: string | string[];
 order?: string | string[];
 limit?: number;
 offset?: number;
 cursor?: string;
}

export interface SearchQueryParams extends CatalogQueryParams {
 term?: string;
 types?: string[];
 owner?: string;
 lifecycle?: string;
}