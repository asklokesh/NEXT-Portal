/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';

import { authClient } from '../clients/auth.client';

import type { 
 UserInfo,
 SessionInfo,
 AuthorizeRequest,
 AuthorizeResponse,
 BatchAuthorizeRequest,
 AllPermissionTypes,
 AuthProviderInfo,
 ApiKey,
 CreateApiKeyRequest,
 OAuthStartRequest,
 BackstageCredentials,
} from '../types/auth';
import type { RequestOptions } from '../types/common';

// Hook options with common configurations
interface UseAuthOptions extends Omit<UseQueryOptions<any, Error>, 'queryKey' | 'queryFn'> {
 requestOptions?: RequestOptions;
}

interface UseAuthMutationOptions<TData, TVariables> extends UseMutationOptions<TData, Error, TVariables> {
 requestOptions?: RequestOptions;
}

// Get current user hook
export function useCurrentUser(options: UseAuthOptions = {}) {
 const { requestOptions, ...queryOptions } = options;
 
 return useQuery({
 queryKey: ['auth', 'user', 'current'],
 queryFn: () => authClient.getCurrentUser(requestOptions),
 staleTime: 5 * 60 * 1000, // 5 minutes
 retry: (failureCount, error: any) => {
 // Don't retry on 401/403 errors
 if (error?.status === 401 || error?.status === 403) {
 return false;
 }
 return failureCount < 3;
 },
 ...queryOptions,
 });
}

// Get session info hook
export function useSession(options: UseAuthOptions = {}) {
 const { requestOptions, ...queryOptions } = options;
 
 return useQuery({
 queryKey: ['auth', 'session'],
 queryFn: () => authClient.getSessionInfo(requestOptions),
 staleTime: 2 * 60 * 1000, // 2 minutes
 retry: (failureCount, error: any) => {
 if (error?.status === 401 || error?.status === 403) {
 return false;
 }
 return failureCount < 3;
 },
 ...queryOptions,
 });
}

// Check permission hook
export function usePermission(
 permission: AllPermissionTypes,
 resourceRef?: string,
 options: UseAuthOptions = {}
) {
 const { requestOptions, ...queryOptions } = options;
 
 return useQuery({
 queryKey: ['auth', 'permission', permission, resourceRef],
 queryFn: () => authClient.hasPermission(permission, resourceRef, requestOptions),
 enabled: !!permission,
 staleTime: 2 * 60 * 1000, // 2 minutes
 ...queryOptions,
 });
}

// Check multiple permissions hook
export function usePermissions(
 permissions: Array<{ permission: AllPermissionTypes; resourceRef?: string }>,
 options: UseAuthOptions = {}
) {
 const { requestOptions, ...queryOptions } = options;
 
 return useQuery({
 queryKey: ['auth', 'permissions', permissions],
 queryFn: () => authClient.checkMultiplePermissions(permissions, requestOptions),
 enabled: permissions.length > 0,
 staleTime: 2 * 60 * 1000, // 2 minutes
 ...queryOptions,
 });
}

// Get auth providers hook
export function useAuthProviders(
 query: { provider?: string; scope?: string } = {},
 options: UseAuthOptions = {}
) {
 const { requestOptions, ...queryOptions } = options;
 
 return useQuery({
 queryKey: ['auth', 'providers', query],
 queryFn: () => authClient.getAuthProviders(query, requestOptions),
 staleTime: 15 * 60 * 1000, // 15 minutes
 ...queryOptions,
 });
}

// Get user's API keys hook
export function useApiKeys(
 query: { includeExpired?: boolean; limit?: number; offset?: number } = {},
 options: UseAuthOptions = {}
) {
 const { requestOptions, ...queryOptions } = options;
 
 return useQuery({
 queryKey: ['auth', 'api-keys', query],
 queryFn: () => authClient.getApiKeys(query, requestOptions),
 staleTime: 1 * 60 * 1000, // 1 minute
 ...queryOptions,
 });
}

// Get API key hook
export function useApiKey(
 apiKeyId: string,
 options: UseAuthOptions = {}
) {
 const { requestOptions, ...queryOptions } = options;
 
 return useQuery({
 queryKey: ['auth', 'api-key', apiKeyId],
 queryFn: () => authClient.getApiKey(apiKeyId, requestOptions),
 enabled: !!apiKeyId,
 staleTime: 5 * 60 * 1000, // 5 minutes
 ...queryOptions,
 });
}

// Get user permissions hook
export function useUserPermissions(
 userEntityRef?: string,
 options: UseAuthOptions = {}
) {
 const { requestOptions, ...queryOptions } = options;
 
 return useQuery({
 queryKey: ['auth', 'user-permissions', userEntityRef],
 queryFn: () => authClient.getUserPermissions(userEntityRef, requestOptions),
 staleTime: 5 * 60 * 1000, // 5 minutes
 ...queryOptions,
 });
}

// Get user groups hook
export function useUserGroups(
 userEntityRef?: string,
 options: UseAuthOptions = {}
) {
 const { requestOptions, ...queryOptions } = options;
 
 return useQuery({
 queryKey: ['auth', 'user-groups', userEntityRef],
 queryFn: () => authClient.getUserGroups(userEntityRef, requestOptions),
 staleTime: 5 * 60 * 1000, // 5 minutes
 ...queryOptions,
 });
}

// Mutation hooks
export function useRefreshSession(
 options: UseAuthMutationOptions<SessionInfo, void> = {}
) {
 const queryClient = useQueryClient();
 const { requestOptions, ...mutationOptions } = options;
 
 return useMutation({
 mutationFn: () => authClient.refreshSession(requestOptions),
 onSuccess: (data, variables, context) => {
 // Update session cache
 queryClient.setQueryData(['auth', 'session'], data);
 options.onSuccess?.(data, variables, context);
 },
 ...mutationOptions,
 });
}

export function useLogout(
 options: UseAuthMutationOptions<void, void> = {}
) {
 const queryClient = useQueryClient();
 const { requestOptions, ...mutationOptions } = options;
 
 return useMutation({
 mutationFn: () => authClient.logout(requestOptions),
 onSuccess: (data, variables, context) => {
 // Clear all auth-related cache
 queryClient.removeQueries({ queryKey: ['auth'] });
 options.onSuccess?.(data, variables, context);
 },
 ...mutationOptions,
 });
}

export function useCreateApiKey(
 options: UseAuthMutationOptions<any, CreateApiKeyRequest> = {}
) {
 const queryClient = useQueryClient();
 const { requestOptions, ...mutationOptions } = options;
 
 return useMutation({
 mutationFn: (request) => authClient.createApiKey(request, requestOptions),
 onSuccess: (data, variables, context) => {
 // Invalidate API keys queries
 queryClient.invalidateQueries({ queryKey: ['auth', 'api-keys'] });
 options.onSuccess?.(data, variables, context);
 },
 ...mutationOptions,
 });
}

export function useRevokeApiKey(
 options: UseAuthMutationOptions<void, string> = {}
) {
 const queryClient = useQueryClient();
 const { requestOptions, ...mutationOptions } = options;
 
 return useMutation({
 mutationFn: (apiKeyId) => authClient.revokeApiKey(apiKeyId, requestOptions),
 onSuccess: (data, variables, context) => {
 // Invalidate API keys queries and remove specific key
 queryClient.invalidateQueries({ queryKey: ['auth', 'api-keys'] });
 queryClient.removeQueries({ queryKey: ['auth', 'api-key', variables] });
 options.onSuccess?.(data, variables, context);
 },
 ...mutationOptions,
 });
}

export function useStartOAuthFlow(
 options: UseAuthMutationOptions<any, OAuthStartRequest> = {}
) {
 const { requestOptions, ...mutationOptions } = options;
 
 return useMutation({
 mutationFn: (request) => authClient.startOAuthFlow(request, requestOptions),
 ...mutationOptions,
 });
}

export function useImpersonateUser(
 options: UseAuthMutationOptions<SessionInfo, string> = {}
) {
 const queryClient = useQueryClient();
 const { requestOptions, ...mutationOptions } = options;
 
 return useMutation({
 mutationFn: (userEntityRef) => authClient.impersonateUser(userEntityRef, requestOptions),
 onSuccess: (data, variables, context) => {
 // Update session cache
 queryClient.setQueryData(['auth', 'session'], data);
 // Invalidate user-related queries since we're now impersonating
 queryClient.invalidateQueries({ queryKey: ['auth', 'user'] });
 options.onSuccess?.(data, variables, context);
 },
 ...mutationOptions,
 });
}

export function useStopImpersonation(
 options: UseAuthMutationOptions<SessionInfo, void> = {}
) {
 const queryClient = useQueryClient();
 const { requestOptions, ...mutationOptions } = options;
 
 return useMutation({
 mutationFn: () => authClient.stopImpersonation(requestOptions),
 onSuccess: (data, variables, context) => {
 // Update session cache
 queryClient.setQueryData(['auth', 'session'], data);
 // Invalidate user-related queries since we stopped impersonating
 queryClient.invalidateQueries({ queryKey: ['auth', 'user'] });
 options.onSuccess?.(data, variables, context);
 },
 ...mutationOptions,
 });
}

// Custom hooks for common patterns
export function useIsAuthenticated() {
 const { data: session, isLoading, error } = useSession();
 
 return {
 isAuthenticated: !!session && !error,
 isLoading,
 session,
 error,
 };
}

export function useCurrentUserEntityRef() {
 const { data: user } = useCurrentUser();
 return user?.entityRef;
}

export function useHasAnyPermission(permissions: string[]) {
 const { data: userPermissions = [] } = useUserPermissions();
 
 return permissions.some(permission => userPermissions.includes(permission));
}

export function useHasAllPermissions(permissions: string[]) {
 const { data: userPermissions = [] } = useUserPermissions();
 
 return permissions.every(permission => userPermissions.includes(permission));
}

export function useIsMemberOfGroup(groupEntityRef: string) {
 const { data: groups = { memberships: [] } } = useUserGroups();
 
 return groups.memberships.some(membership => membership.groupEntityRef === groupEntityRef);
}

export function useIsMemberOfAnyGroup(groupEntityRefs: string[]) {
 const { data: groups = { memberships: [] } } = useUserGroups();
 
 return groupEntityRefs.some(groupRef => 
 groups.memberships.some(membership => membership.groupEntityRef === groupRef)
 );
}

// Catalog-specific permission hooks
export function useCanCreateEntity() {
 const permission = {
 type: 'permission' as const,
 name: 'catalog.entity.create',
 attributes: { action: 'create' as const },
 };
 
 return usePermission(permission);
}

export function useCanReadEntity(entityRef?: string) {
 const permission = {
 type: 'resource' as const,
 name: 'catalog.entity.read',
 attributes: { action: 'read' as const },
 };
 
 return usePermission(permission, entityRef);
}

export function useCanUpdateEntity(entityRef?: string) {
 const permission = {
 type: 'resource' as const,
 name: 'catalog.entity.update',
 attributes: { action: 'update' as const },
 };
 
 return usePermission(permission, entityRef);
}

export function useCanDeleteEntity(entityRef?: string) {
 const permission = {
 type: 'resource' as const,
 name: 'catalog.entity.delete',
 attributes: { action: 'delete' as const },
 };
 
 return usePermission(permission, entityRef);
}

// Scaffolder-specific permission hooks
export function useCanExecuteScaffolderActions() {
 const permission = {
 type: 'permission' as const,
 name: 'scaffolder.action.execute',
 attributes: { action: 'create' as const },
 };
 
 return usePermission(permission);
}

export function useCanReadTasks() {
 const permission = {
 type: 'permission' as const,
 name: 'scaffolder.task.read',
 attributes: { action: 'read' as const },
 };
 
 return usePermission(permission);
}

// TechDocs-specific permission hooks
export function useCanReadDocs(entityRef?: string) {
 const permission = {
 type: 'resource' as const,
 name: 'techdocs.entity.read',
 attributes: { action: 'read' as const },
 };
 
 return usePermission(permission, entityRef);
}

export function useCanBuildDocs(entityRef?: string) {
 const permission = {
 type: 'resource' as const,
 name: 'techdocs.entity.build',
 attributes: { action: 'update' as const },
 };
 
 return usePermission(permission, entityRef);
}

// Session management hook
export function useSessionManagement() {
 const queryClient = useQueryClient();
 
 // Auto-refresh session before expiry
 useEffect(() => {
 const interval = setInterval(async () => {
 try {
 await authClient.ensureValidSession();
 // Update session cache
 const session = authClient.getCurrentSession();
 if (session) {
 queryClient.setQueryData(['auth', 'session'], session);
 }
 } catch (error) {
 console.warn('Failed to ensure valid session:', error);
 // Clear auth cache on session failure
 queryClient.removeQueries({ queryKey: ['auth'] });
 }
 }, 2 * 60 * 1000); // Check every 2 minutes
 
 return () => clearInterval(interval);
 }, [queryClient]);
 
 return {
 clearSessionCache: () => authClient.clearSessionCache(),
 getCurrentSession: () => authClient.getCurrentSession(),
 };
}

// Hook for clearing auth cache
export function useClearAuthCache() {
 const queryClient = useQueryClient();
 
 return useCallback(() => {
 authClient.clearCache();
 queryClient.removeQueries({ queryKey: ['auth'] });
 }, [queryClient]);
}