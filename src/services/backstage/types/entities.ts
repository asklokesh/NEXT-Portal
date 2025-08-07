/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { z } from 'zod';

import { BaseEntitySchema, EntityMetadataSchema } from './common';

import type { EntityRefSchema } from './common';

// Component Entity
export const ComponentSpecSchema = z.object({
 type: z.string(),
 lifecycle: z.string(),
 owner: z.string(),
 system: z.string().optional(),
 subcomponentOf: z.string().optional(),
 providesApis: z.array(z.string()).optional(),
 consumesApis: z.array(z.string()).optional(),
 dependsOn: z.array(z.string()).optional(),
});

export const ComponentEntitySchema = BaseEntitySchema.extend({
 kind: z.literal('Component'),
 spec: ComponentSpecSchema,
});

// API Entity
export const ApiSpecSchema = z.object({
 type: z.string(),
 lifecycle: z.string(),
 owner: z.string(),
 system: z.string().optional(),
 definition: z.string(),
});

export const ApiEntitySchema = BaseEntitySchema.extend({
 kind: z.literal('API'),
 spec: ApiSpecSchema,
});

// System Entity
export const SystemSpecSchema = z.object({
 owner: z.string(),
 domain: z.string().optional(),
});

export const SystemEntitySchema = BaseEntitySchema.extend({
 kind: z.literal('System'),
 spec: SystemSpecSchema,
});

// Domain Entity
export const DomainSpecSchema = z.object({
 owner: z.string(),
});

export const DomainEntitySchema = BaseEntitySchema.extend({
 kind: z.literal('Domain'),
 spec: DomainSpecSchema,
});

// Resource Entity
export const ResourceSpecSchema = z.object({
 type: z.string(),
 owner: z.string(),
 dependsOn: z.array(z.string()).optional(),
 dependencyOf: z.array(z.string()).optional(),
});

export const ResourceEntitySchema = BaseEntitySchema.extend({
 kind: z.literal('Resource'),
 spec: ResourceSpecSchema,
});

// Group Entity
export const GroupSpecSchema = z.object({
 type: z.string(),
 profile: z.object({
 displayName: z.string().optional(),
 email: z.string().optional(),
 picture: z.string().optional(),
 }).optional(),
 parent: z.string().optional(),
 children: z.array(z.string()).optional(),
 members: z.array(z.string()).optional(),
});

export const GroupEntitySchema = BaseEntitySchema.extend({
 kind: z.literal('Group'),
 spec: GroupSpecSchema,
});

// User Entity
export const UserSpecSchema = z.object({
 profile: z.object({
 displayName: z.string().optional(),
 email: z.string().optional(),
 picture: z.string().optional(),
 }).optional(),
 memberOf: z.array(z.string()).optional(),
});

export const UserEntitySchema = BaseEntitySchema.extend({
 kind: z.literal('User'),
 spec: UserSpecSchema,
});

// Location Entity
export const LocationSpecSchema = z.object({
 type: z.string(),
 target: z.string(),
 targets: z.array(z.string()).optional(),
});

export const LocationEntitySchema = BaseEntitySchema.extend({
 kind: z.literal('Location'),
 spec: LocationSpecSchema,
});

// Union type for all entities
export const EntitySchema = z.discriminatedUnion('kind', [
 ComponentEntitySchema,
 ApiEntitySchema,
 SystemEntitySchema,
 DomainEntitySchema,
 ResourceEntitySchema,
 GroupEntitySchema,
 UserEntitySchema,
 LocationEntitySchema,
]);

// Entity filters
export const EntityFiltersSchema = z.object({
 kind: z.string().optional(),
 'metadata.namespace': z.string().optional(),
 'metadata.name': z.string().optional(),
 'metadata.labels': z.record(z.string()).optional(),
 'metadata.annotations': z.record(z.string()).optional(),
 'spec.type': z.string().optional(),
 'spec.lifecycle': z.string().optional(),
 'spec.owner': z.string().optional(),
 'spec.system': z.string().optional(),
 'spec.domain': z.string().optional(),
});

// Catalog query parameters
export const CatalogQuerySchema = z.object({
 filter: z.union([z.string(), z.array(z.string())]).optional(),
 fields: z.union([z.string(), z.array(z.string())]).optional(),
 order: z.union([z.string(), z.array(z.string())]).optional(),
 limit: z.number().min(1).max(1000).optional(),
 offset: z.number().min(0).optional(),
 cursor: z.string().optional(),
});

// Entity relationship types
export const RelationshipTypeSchema = z.enum([
 'ownedBy',
 'ownerOf',
 'consumesApi',
 'apiConsumedBy',
 'providesApi',
 'apiProvidedBy',
 'dependsOn',
 'dependencyOf',
 'partOf',
 'hasPart',
 'memberOf',
 'hasMember',
 'childOf',
 'parentOf',
]);

// Entity search result
export const EntitySearchResultSchema = z.object({
 entity: EntitySchema,
 rank: z.number().optional(),
 highlight: z.object({
 fields: z.record(z.array(z.string())),
 }).optional(),
});

// Catalog locations
export const CatalogLocationSchema = z.object({
 id: z.string(),
 type: z.string(),
 target: z.string(),
 message: z.string().optional(),
});

// Type exports
export type ComponentSpec = z.infer<typeof ComponentSpecSchema>;
export type ComponentEntity = z.infer<typeof ComponentEntitySchema>;
export type ApiSpec = z.infer<typeof ApiSpecSchema>;
export type ApiEntity = z.infer<typeof ApiEntitySchema>;
export type SystemSpec = z.infer<typeof SystemSpecSchema>;
export type SystemEntity = z.infer<typeof SystemEntitySchema>;
export type DomainSpec = z.infer<typeof DomainSpecSchema>;
export type DomainEntity = z.infer<typeof DomainEntitySchema>;
export type ResourceSpec = z.infer<typeof ResourceSpecSchema>;
export type ResourceEntity = z.infer<typeof ResourceEntitySchema>;
export type GroupSpec = z.infer<typeof GroupSpecSchema>;
export type GroupEntity = z.infer<typeof GroupEntitySchema>;
export type UserSpec = z.infer<typeof UserSpecSchema>;
export type UserEntity = z.infer<typeof UserEntitySchema>;
export type LocationSpec = z.infer<typeof LocationSpecSchema>;
export type LocationEntity = z.infer<typeof LocationEntitySchema>;

export type Entity = z.infer<typeof EntitySchema>;
export type EntityFilters = z.infer<typeof EntityFiltersSchema>;
export type CatalogQuery = z.infer<typeof CatalogQuerySchema>;
export type RelationshipType = z.infer<typeof RelationshipTypeSchema>;
export type EntitySearchResult = z.infer<typeof EntitySearchResultSchema>;
export type CatalogLocation = z.infer<typeof CatalogLocationSchema>;

// Entity kind type guard helpers
export const isComponentEntity = (entity: Entity): entity is ComponentEntity =>
 entity.kind === 'Component';

export const isApiEntity = (entity: Entity): entity is ApiEntity =>
 entity.kind === 'API';

export const isSystemEntity = (entity: Entity): entity is SystemEntity =>
 entity.kind === 'System';

export const isDomainEntity = (entity: Entity): entity is DomainEntity =>
 entity.kind === 'Domain';

export const isResourceEntity = (entity: Entity): entity is ResourceEntity =>
 entity.kind === 'Resource';

export const isGroupEntity = (entity: Entity): entity is GroupEntity =>
 entity.kind === 'Group';

export const isUserEntity = (entity: Entity): entity is UserEntity =>
 entity.kind === 'User';

export const isLocationEntity = (entity: Entity): entity is LocationEntity =>
 entity.kind === 'Location';

// Entity reference helpers
export function stringifyEntityRef(ref: z.infer<typeof EntityRefSchema>): string {
 const { kind, namespace = 'default', name } = ref;
 return namespace === 'default' ? `${kind}:${name}` : `${kind}:${namespace}/${name}`;
}

export function parseEntityRef(ref: string): z.infer<typeof EntityRefSchema> {
 const [kindPart, ...nameParts] = ref.split(':');
 const namePart = nameParts.join(':');
 
 if (namePart.includes('/')) {
 const [namespace, name] = namePart.split('/');
 return { kind: kindPart, namespace, name };
 }
 
 return { kind: kindPart, name: namePart };
}