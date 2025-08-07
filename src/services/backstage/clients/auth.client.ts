/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import, @typescript-eslint/no-base-to-string */
import { z } from 'zod';

import {
 AuthorizeRequestSchema,
 AuthorizeResponseSchema,
 BatchAuthorizeRequestSchema,
 BatchAuthorizeResponseSchema,
 BackstageCredentialsSchema,
 UserInfoSchema,
 AuthProviderInfoSchema,
 SessionInfoSchema,
 ApiKeySchema,
 CreateApiKeyRequestSchema,
 CreateApiKeyResponseSchema,
 OAuthStartRequestSchema,
 OAuthStartResponseSchema,
 OAuthResultRequestSchema,
 createPermission,
 isAllowed,
 parseUserEntityRef,
 buildUserEntityRef,
} from '../types/auth';
import { createBackstageClient } from '../utils/api-client';

import type {
 AllPermissionTypes,
 AuthorizeRequest,
 AuthorizeResponse,
 BatchAuthorizeRequest,
 BatchAuthorizeResponse,
 BackstageCredentials,
 UserInfo,
 AuthProviderInfo,
 SessionInfo,
 ApiKey,
 CreateApiKeyRequest,
 CreateApiKeyResponse,
 OAuthStartRequest,
 OAuthStartResponse,
 OAuthResultRequest,
 AuthProviderQuery,
 ApiKeyQuery} from '../types/auth';
import type { RequestOptions } from '../types/common';
import type { BackstageApiClient} from '../utils/api-client';

// Additional response schemas
const AuthProvidersResponseSchema = z.object({
 providers: z.array(AuthProviderInfoSchema),
});

const ApiKeysResponseSchema = z.object({
 items: z.array(ApiKeySchema),
 total: z.number(),
});

const PermissionsResponseSchema = z.object({
 permissions: z.array(z.string()),
});

const GroupMembershipsResponseSchema = z.object({
 memberships: z.array(z.object({
 groupEntityRef: z.string(),
 role: z.string().optional(),
 })),
});

// Type definitions
export type AuthProvidersResponse = z.infer<typeof AuthProvidersResponseSchema>;
export type ApiKeysResponse = z.infer<typeof ApiKeysResponseSchema>;
export type PermissionsResponse = z.infer<typeof PermissionsResponseSchema>;
export type GroupMembershipsResponse = z.infer<typeof GroupMembershipsResponseSchema>;

export interface AuthClientConfig {
 enableTokenRefresh?: boolean;
 tokenRefreshThreshold?: number; // Minutes before expiry to refresh
}

export class AuthClient {
 private readonly client: BackstageApiClient;
 private readonly config: AuthClientConfig;
 private currentSession: SessionInfo | null = null;

 constructor(config: AuthClientConfig = {}) {
 this.client = createBackstageClient('auth');
 this.config = {
 enableTokenRefresh: true,
 tokenRefreshThreshold: 5, // 5 minutes
 ...config,
 };
 }

 // Get current user info
 async getCurrentUser(options: RequestOptions = {}): Promise<UserInfo> {
 return this.client.request(
 {
 method: 'GET',
 url: '/v1/user-info',
 },
 UserInfoSchema,
 options
 );
 }

 // Get current session info
 async getSessionInfo(options: RequestOptions = {}): Promise<SessionInfo> {
 const sessionInfo = await this.client.request(
 {
 method: 'GET',
 url: '/v1/session',
 },
 SessionInfoSchema,
 options
 );

 this.currentSession = sessionInfo;
 return sessionInfo;
 }

 // Refresh current session
 async refreshSession(options: RequestOptions = {}): Promise<SessionInfo> {
 const sessionInfo = await this.client.request(
 {
 method: 'POST',
 url: '/v1/session/refresh',
 },
 SessionInfoSchema,
 { ...options, cache: false }
 );

 this.currentSession = sessionInfo;
 return sessionInfo;
 }

 // Logout current session
 async logout(options: RequestOptions = {}): Promise<void> {
 await this.client.post('/v1/session/logout', {}, { ...options, cache: false });
 this.currentSession = null;
 }

 // Check single permission
 async authorize(
 request: AuthorizeRequest,
 options: RequestOptions = {}
 ): Promise<AuthorizeResponse> {
 const validatedRequest = AuthorizeRequestSchema.parse(request);
 
 return this.client.request(
 {
 method: 'POST',
 url: '/v1/authorize',
 data: validatedRequest,
 },
 AuthorizeResponseSchema,
 { ...options, cache: false }
 );
 }

 // Check multiple permissions at once
 async batchAuthorize(
 request: BatchAuthorizeRequest,
 options: RequestOptions = {}
 ): Promise<BatchAuthorizeResponse> {
 const validatedRequest = BatchAuthorizeRequestSchema.parse(request);
 
 return this.client.request(
 {
 method: 'POST',
 url: '/v1/authorize/batch',
 data: validatedRequest,
 },
 BatchAuthorizeResponseSchema,
 { ...options, cache: false }
 );
 }

 // Check if user has specific permission
 async hasPermission(
 permission: AllPermissionTypes,
 resourceRef?: string,
 options: RequestOptions = {}
 ): Promise<boolean> {
 const response = await this.authorize({ permission, resourceRef }, options);
 return isAllowed(response);
 }

 // Check catalog entity permissions
 async canAccessEntity(
 action: 'create' | 'read' | 'update' | 'delete',
 entityRef?: string,
 options: RequestOptions = {}
 ): Promise<boolean> {
 const permission = createPermission('catalog.entity', action, 'resource');
 return this.hasPermission(permission, entityRef, options);
 }

 // Check scaffolder permissions
 async canExecuteTemplate(
 templateRef?: string,
 options: RequestOptions = {}
 ): Promise<boolean> {
 const permission = createPermission('scaffolder.action', 'create');
 return this.hasPermission(permission, templateRef, options);
 }

 // Check TechDocs permissions
 async canAccessDocs(
 action: 'read' | 'build' | 'sync',
 entityRef?: string,
 options: RequestOptions = {}
 ): Promise<boolean> {
 const permission = createPermission('techdocs.entity', action === 'read' ? 'read' : 'update');
 return this.hasPermission(permission, entityRef, options);
 }

 // Get available auth providers
 async getAuthProviders(
 query: AuthProviderQuery = {},
 options: RequestOptions = {}
 ): Promise<AuthProviderInfo[]> {
 const params = this.buildProviderQuery(query);
 
 const response = await this.client.request(
 {
 method: 'GET',
 url: '/v1/providers',
 params,
 },
 AuthProvidersResponseSchema,
 options
 );

 return response.providers;
 }

 // Start OAuth flow
 async startOAuthFlow(
 request: OAuthStartRequest,
 options: RequestOptions = {}
 ): Promise<OAuthStartResponse> {
 const validatedRequest = OAuthStartRequestSchema.parse(request);
 
 return this.client.request(
 {
 method: 'POST',
 url: `/v1/oauth/${request.provider}/start`,
 data: validatedRequest,
 },
 OAuthStartResponseSchema,
 { ...options, cache: false }
 );
 }

 // Complete OAuth flow
 async completeOAuthFlow(
 provider: string,
 request: OAuthResultRequest,
 options: RequestOptions = {}
 ): Promise<BackstageCredentials> {
 const validatedRequest = OAuthResultRequestSchema.parse(request);
 
 return this.client.request(
 {
 method: 'POST',
 url: `/v1/oauth/${provider}/handler/frame`,
 data: validatedRequest,
 },
 BackstageCredentialsSchema,
 { ...options, cache: false }
 );
 }

 // Get user's API keys
 async getApiKeys(
 query: ApiKeyQuery = {},
 options: RequestOptions = {}
 ): Promise<ApiKeysResponse> {
 const params = this.buildApiKeyQuery(query);
 
 return this.client.request(
 {
 method: 'GET',
 url: '/v1/api-keys',
 params,
 },
 ApiKeysResponseSchema,
 options
 );
 }

 // Create new API key
 async createApiKey(
 request: CreateApiKeyRequest,
 options: RequestOptions = {}
 ): Promise<CreateApiKeyResponse> {
 const validatedRequest = CreateApiKeyRequestSchema.parse(request);
 
 return this.client.request(
 {
 method: 'POST',
 url: '/v1/api-keys',
 data: validatedRequest,
 },
 CreateApiKeyResponseSchema,
 { ...options, cache: false }
 );
 }

 // Revoke API key
 async revokeApiKey(
 apiKeyId: string,
 options: RequestOptions = {}
 ): Promise<void> {
 await this.client.delete(`/v1/api-keys/${apiKeyId}`, { ...options, cache: false });
 }

 // Get API key details
 async getApiKey(
 apiKeyId: string,
 options: RequestOptions = {}
 ): Promise<ApiKey> {
 return this.client.request(
 {
 method: 'GET',
 url: `/v1/api-keys/${apiKeyId}`,
 },
 ApiKeySchema,
 options
 );
 }

 // Get user's permissions
 async getUserPermissions(
 userEntityRef?: string,
 options: RequestOptions = {}
 ): Promise<string[]> {
 const url = userEntityRef 
 ? `/v1/permissions/user/${encodeURIComponent(userEntityRef)}`
 : '/v1/permissions/user';
 
 const response = await this.client.request(
 {
 method: 'GET',
 url,
 },
 PermissionsResponseSchema,
 options
 );

 return response.permissions;
 }

 // Get user's group memberships
 async getUserGroups(
 userEntityRef?: string,
 options: RequestOptions = {}
 ): Promise<GroupMembershipsResponse> {
 const url = userEntityRef 
 ? `/v1/groups/user/${encodeURIComponent(userEntityRef)}`
 : '/v1/groups/user';
 
 return this.client.request(
 {
 method: 'GET',
 url,
 },
 GroupMembershipsResponseSchema,
 options
 );
 }

 // Impersonate user (admin only)
 async impersonateUser(
 userEntityRef: string,
 options: RequestOptions = {}
 ): Promise<SessionInfo> {
 const sessionInfo = await this.client.request(
 {
 method: 'POST',
 url: '/v1/impersonate',
 data: { userEntityRef },
 },
 SessionInfoSchema,
 { ...options, cache: false }
 );

 this.currentSession = sessionInfo;
 return sessionInfo;
 }

 // Stop impersonation
 async stopImpersonation(options: RequestOptions = {}): Promise<SessionInfo> {
 const sessionInfo = await this.client.request(
 {
 method: 'POST',
 url: '/v1/impersonate/stop',
 },
 SessionInfoSchema,
 { ...options, cache: false }
 );

 this.currentSession = sessionInfo;
 return sessionInfo;
 }

 // Validate token
 async validateToken(
 token: string,
 options: RequestOptions = {}
 ): Promise<{ valid: boolean; userEntityRef?: string; expiresAt?: string }> {
 const response = await this.client.post<any>(
 '/v1/token/validate',
 { token },
 { ...options, cache: false }
 );

 return response;
 }

 // Get identity from token
 async getIdentityFromToken(
 token: string,
 options: RequestOptions = {}
 ): Promise<UserInfo> {
 return this.client.request(
 {
 method: 'POST',
 url: '/v1/token/identity',
 data: { token },
 },
 UserInfoSchema,
 { ...options, cache: false }
 );
 }

 // Utility methods
 async checkMultiplePermissions(
 permissions: Array<{ permission: AllPermissionTypes; resourceRef?: string }>,
 options: RequestOptions = {}
 ): Promise<Record<string, boolean>> {
 const requests = permissions.map(({ permission, resourceRef }) => ({
 permission,
 resourceRef,
 }));

 const response = await this.batchAuthorize({ requests }, options);
 
 const results: Record<string, boolean> = {};
 permissions.forEach((perm, index) => {
 const key = `${perm.permission.name}:${perm.permission.attributes?.action || 'default'}`;
 results[key] = isAllowed(response.responses[index]);
 });

 return results;
 }

 // Session management
 async ensureValidSession(): Promise<SessionInfo> {
 if (!this.currentSession) {
 this.currentSession = await this.getSessionInfo();
 }

 // Check if session needs refresh
 if (this.config.enableTokenRefresh && this.shouldRefreshSession()) {
 try {
 this.currentSession = await this.refreshSession();
 } catch (error) {
 console.warn('Failed to refresh session:', error);
 // Continue with existing session
 }
 }

 return this.currentSession;
 }

 private shouldRefreshSession(): boolean {
 if (!this.currentSession?.expiresAt || !this.config.tokenRefreshThreshold) {
 return false;
 }

 const expiryTime = new Date(this.currentSession.expiresAt).getTime();
 const now = Date.now();
 const thresholdMs = this.config.tokenRefreshThreshold * 60 * 1000;

 return (expiryTime - now) <= thresholdMs;
 }

 // Helper methods
 private buildProviderQuery(query: AuthProviderQuery): Record<string, unknown> {
 const params: Record<string, unknown> = {};

 if (query.provider) {
 params.provider = query.provider;
 }

 if (query.scope) {
 params.scope = query.scope;
 }

 if (query.redirectUri) {
 params.redirectUri = query.redirectUri;
 }

 return params;
 }

 private buildApiKeyQuery(query: ApiKeyQuery): Record<string, unknown> {
 const params: Record<string, unknown> = {};

 if (query.includeExpired !== undefined) {
 params.includeExpired = query.includeExpired;
 }

 if (query.limit) {
 params.limit = query.limit;
 }

 if (query.offset) {
 params.offset = query.offset;
 }

 return params;
 }

 // Get current session (cached)
 getCurrentSession(): SessionInfo | null {
 return this.currentSession;
 }

 // Clear session cache
 clearSessionCache(): void {
 this.currentSession = null;
 }

 // Clear all cached data
 clearCache(): void {
 this.client.clearCache();
 this.clearSessionCache();
 }
}

// Export singleton instance
export const authClient = new AuthClient();