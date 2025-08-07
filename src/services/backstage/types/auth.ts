/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { z } from 'zod';

// Permission schemas
export const PermissionSchema = z.object({
 type: z.literal('permission'),
 name: z.string(),
 attributes: z.object({
 action: z.enum(['create', 'read', 'update', 'delete']),
 }),
});

export const ResourcePermissionSchema = z.object({
 type: z.literal('resource'),
 name: z.string(),
 attributes: z.object({
 action: z.enum(['create', 'read', 'update', 'delete']),
 }),
});

export const BasicPermissionSchema = z.object({
 type: z.literal('basic'),
 name: z.string(),
 attributes: z.record(z.unknown()).optional(),
});

export const AllPermissionTypesSchema = z.discriminatedUnion('type', [
 PermissionSchema,
 ResourcePermissionSchema,
 BasicPermissionSchema,
]);

// Authorization request/response schemas
export const AuthorizeRequestSchema = z.object({
 permission: AllPermissionTypesSchema,
 resourceRef: z.string().optional(),
});

export const AuthorizeResponseSchema = z.object({
 result: z.enum(['ALLOW', 'DENY', 'CONDITIONAL']),
 conditions: z.array(z.object({
 rule: z.string(),
 resourceType: z.string(),
 params: z.record(z.unknown()),
 })).optional(),
});

export const BatchAuthorizeRequestSchema = z.object({
 requests: z.array(AuthorizeRequestSchema),
});

export const BatchAuthorizeResponseSchema = z.object({
 responses: z.array(AuthorizeResponseSchema),
});

// Identity schemas
export const BackstageIdentitySchema = z.object({
 type: z.literal('user'),
 userEntityRef: z.string(),
 ownershipEntityRefs: z.array(z.string()),
});

export const BackstageCredentialsSchema = z.object({
 token: z.string(),
 expiresAt: z.string().optional(),
 principal: BackstageIdentitySchema,
});

// User profile schemas
export const UserProfileSchema = z.object({
 email: z.string().optional(),
 displayName: z.string().optional(),
 picture: z.string().optional(),
});

export const UserInfoSchema = z.object({
 entityRef: z.string(),
 profile: UserProfileSchema,
 identity: BackstageIdentitySchema,
});

// Auth provider schemas
export const AuthProviderInfoSchema = z.object({
 id: z.string(),
 title: z.string(),
 message: z.string().optional(),
});

export const AuthRequestSchema = z.object({
 providerInfo: AuthProviderInfoSchema,
 profile: UserProfileSchema,
 backstageIdentity: BackstageIdentitySchema.optional(),
});

export const AuthResponseSchema = z.object({
 providerInfo: AuthProviderInfoSchema,
 profile: UserProfileSchema,
 backstageIdentity: BackstageIdentitySchema,
 session: z.object({
 accessToken: z.string(),
 refreshToken: z.string().optional(),
 tokenType: z.string(),
 scope: z.string(),
 expiresIn: z.number().optional(),
 }),
});

// OAuth schemas
export const OAuthStartRequestSchema = z.object({
 provider: z.string(),
 redirectUri: z.string().optional(),
 scope: z.string().optional(),
 state: z.string().optional(),
});

export const OAuthStartResponseSchema = z.object({
 url: z.string(),
 status: z.enum(['redirect']),
});

export const OAuthResultRequestSchema = z.object({
 code: z.string(),
 state: z.string().optional(),
});

// Role and group schemas
export const RoleMetadataSchema = z.object({
 name: z.string(),
 description: z.string().optional(),
 permissions: z.array(z.string()),
 source: z.string().optional(),
});

export const GroupMembershipSchema = z.object({
 groupEntityRef: z.string(),
 role: z.string().optional(),
});

// Session schemas
export const SessionInfoSchema = z.object({
 userEntityRef: z.string(),
 profile: UserProfileSchema,
 expiresAt: z.string().optional(),
 permissions: z.array(z.string()).optional(),
 groups: z.array(GroupMembershipSchema).optional(),
});

// API key schemas
export const ApiKeySchema = z.object({
 id: z.string(),
 name: z.string(),
 description: z.string().optional(),
 prefix: z.string(),
 createdAt: z.string(),
 expiresAt: z.string().optional(),
 lastUsedAt: z.string().optional(),
 permissions: z.array(z.string()).optional(),
});

export const CreateApiKeyRequestSchema = z.object({
 name: z.string(),
 description: z.string().optional(),
 expiresIn: z.number().optional(), // Duration in seconds
 permissions: z.array(z.string()).optional(),
});

export const CreateApiKeyResponseSchema = z.object({
 apiKey: ApiKeySchema,
 secret: z.string(), // Only returned once during creation
});

// Type exports
export type Permission = z.infer<typeof PermissionSchema>;
export type ResourcePermission = z.infer<typeof ResourcePermissionSchema>;
export type BasicPermission = z.infer<typeof BasicPermissionSchema>;
export type AllPermissionTypes = z.infer<typeof AllPermissionTypesSchema>;
export type AuthorizeRequest = z.infer<typeof AuthorizeRequestSchema>;
export type AuthorizeResponse = z.infer<typeof AuthorizeResponseSchema>;
export type BatchAuthorizeRequest = z.infer<typeof BatchAuthorizeRequestSchema>;
export type BatchAuthorizeResponse = z.infer<typeof BatchAuthorizeResponseSchema>;
export type BackstageIdentity = z.infer<typeof BackstageIdentitySchema>;
export type BackstageCredentials = z.infer<typeof BackstageCredentialsSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type UserInfo = z.infer<typeof UserInfoSchema>;
export type AuthProviderInfo = z.infer<typeof AuthProviderInfoSchema>;
export type AuthRequest = z.infer<typeof AuthRequestSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type OAuthStartRequest = z.infer<typeof OAuthStartRequestSchema>;
export type OAuthStartResponse = z.infer<typeof OAuthStartResponseSchema>;
export type OAuthResultRequest = z.infer<typeof OAuthResultRequestSchema>;
export type RoleMetadata = z.infer<typeof RoleMetadataSchema>;
export type GroupMembership = z.infer<typeof GroupMembershipSchema>;
export type SessionInfo = z.infer<typeof SessionInfoSchema>;
export type ApiKey = z.infer<typeof ApiKeySchema>;
export type CreateApiKeyRequest = z.infer<typeof CreateApiKeyRequestSchema>;
export type CreateApiKeyResponse = z.infer<typeof CreateApiKeyResponseSchema>;

// Permission helper types
export type PermissionAction = 'create' | 'read' | 'update' | 'delete';
export type AuthorizationResult = 'ALLOW' | 'DENY' | 'CONDITIONAL';

// Query parameter types
export interface AuthProviderQuery {
 provider?: string;
 scope?: string;
 redirectUri?: string;
}

export interface ApiKeyQuery {
 includeExpired?: boolean;
 limit?: number;
 offset?: number;
}

// Helper functions
export function createPermission(
 name: string, 
 action: PermissionAction,
 type: 'permission' | 'resource' | 'basic' = 'permission'
): AllPermissionTypes {
 switch (type) {
 case 'permission':
 return {
 type: 'permission',
 name,
 attributes: { action },
 };
 case 'resource':
 return {
 type: 'resource',
 name,
 attributes: { action },
 };
 case 'basic':
 return {
 type: 'basic',
 name,
 };
 }
}

export function isAllowed(response: AuthorizeResponse): boolean {
 return response.result === 'ALLOW';
}

export function isDenied(response: AuthorizeResponse): boolean {
 return response.result === 'DENY';
}

export function isConditional(response: AuthorizeResponse): boolean {
 return response.result === 'CONDITIONAL';
}

export function hasPermission(
 sessionInfo: SessionInfo,
 permission: string
): boolean {
 return sessionInfo.permissions?.includes(permission) || false;
}

export function isMemberOfGroup(
 sessionInfo: SessionInfo,
 groupEntityRef: string
): boolean {
 return sessionInfo.groups?.some(group => group.groupEntityRef === groupEntityRef) || false;
}

export function isSessionExpired(sessionInfo: SessionInfo): boolean {
 if (!sessionInfo.expiresAt) return false;
 return new Date(sessionInfo.expiresAt) < new Date();
}

export function getSessionTimeRemaining(sessionInfo: SessionInfo): number {
 if (!sessionInfo.expiresAt) return Infinity;
 return Math.max(0, new Date(sessionInfo.expiresAt).getTime() - Date.now());
}

export function isApiKeyExpired(apiKey: ApiKey): boolean {
 if (!apiKey.expiresAt) return false;
 return new Date(apiKey.expiresAt) < new Date();
}

export function parseUserEntityRef(userEntityRef: string): {
 kind: string;
 namespace: string;
 name: string;
} {
 const [kindPart, ...nameParts] = userEntityRef.split(':');
 const namePart = nameParts.join(':');
 
 if (namePart.includes('/')) {
 const [namespace, name] = namePart.split('/');
 return { kind: kindPart, namespace, name };
 }
 
 return { kind: kindPart, namespace: 'default', name: namePart };
}

export function buildUserEntityRef(
 kind: string = 'User',
 namespace: string = 'default',
 name: string
): string {
 return namespace === 'default' ? `${kind}:${name}` : `${kind}:${namespace}/${name}`;
}

// Permission constants
export const CATALOG_PERMISSIONS = {
 ENTITY_CREATE: 'catalog.entity.create',
 ENTITY_READ: 'catalog.entity.read',
 ENTITY_UPDATE: 'catalog.entity.update',
 ENTITY_DELETE: 'catalog.entity.delete',
 LOCATION_CREATE: 'catalog.location.create',
 LOCATION_READ: 'catalog.location.read',
 LOCATION_DELETE: 'catalog.location.delete',
} as const;

export const SCAFFOLDER_PERMISSIONS = {
 TEMPLATE_PARAMETER_READ: 'scaffolder.template.parameter.read',
 TEMPLATE_STEP_READ: 'scaffolder.template.step.read',
 ACTION_EXECUTE: 'scaffolder.action.execute',
 TASK_READ: 'scaffolder.task.read',
 TASK_CREATE: 'scaffolder.task.create',
 TASK_CANCEL: 'scaffolder.task.cancel',
} as const;

export const TECHDOCS_PERMISSIONS = {
 DOCS_READ: 'techdocs.entity.read',
 DOCS_BUILD: 'techdocs.entity.build',
 DOCS_SYNC: 'techdocs.entity.sync',
} as const;

export type CatalogPermission = typeof CATALOG_PERMISSIONS[keyof typeof CATALOG_PERMISSIONS];
export type ScaffolderPermission = typeof SCAFFOLDER_PERMISSIONS[keyof typeof SCAFFOLDER_PERMISSIONS];
export type TechDocsPermission = typeof TECHDOCS_PERMISSIONS[keyof typeof TECHDOCS_PERMISSIONS];