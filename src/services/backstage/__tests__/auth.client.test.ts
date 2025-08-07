/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { authClient } from '../clients/auth.client';
import { enableMocking, disableMocking, resetMocks } from '../mocks/server';

import type { UserInfo, SessionInfo, AuthorizeRequest } from '../types/auth';

// Setup MSW for tests
beforeAll(() => enableMocking());
afterEach(() => resetMocks());
afterAll(() => disableMocking());

describe('AuthClient', () => {
 describe('getCurrentUser', () => {
 it('should fetch current user info', async () => {
 const userInfo = await authClient.getCurrentUser();
 
 expect(userInfo).toBeDefined();
 expect(userInfo.entityRef).toBeDefined();
 expect(userInfo.profile).toBeDefined();
 expect(userInfo.identity).toBeDefined();
 expect(userInfo.profile.displayName).toBeDefined();
 expect(userInfo.profile.email).toBeDefined();
 });
 });

 describe('getSessionInfo', () => {
 it('should fetch session information', async () => {
 const session = await authClient.getSessionInfo();
 
 expect(session).toBeDefined();
 expect(session.userEntityRef).toBeDefined();
 expect(session.profile).toBeDefined();
 expect(session.permissions).toBeInstanceOf(Array);
 expect(session.groups).toBeInstanceOf(Array);
 });
 });

 describe('authorize', () => {
 it('should authorize valid permission', async () => {
 const request: AuthorizeRequest = {
 permission: {
 type: 'permission',
 name: 'catalog.entity.read',
 attributes: { action: 'read' },
 },
 };

 const response = await authClient.authorize(request);
 
 expect(response).toBeDefined();
 expect(response.result).toBeDefined();
 expect(['ALLOW', 'DENY', 'CONDITIONAL']).toContain(response.result);
 });

 it('should handle resource-specific permissions', async () => {
 const request: AuthorizeRequest = {
 permission: {
 type: 'resource',
 name: 'catalog.entity.update',
 attributes: { action: 'update' },
 },
 resourceRef: 'component:default/test-service',
 };

 const response = await authClient.authorize(request);
 
 expect(response).toBeDefined();
 expect(response.result).toBeDefined();
 });
 });

 describe('batchAuthorize', () => {
 it('should authorize multiple permissions', async () => {
 const requests = [
 {
 permission: {
 type: 'permission' as const,
 name: 'catalog.entity.read',
 attributes: { action: 'read' as const },
 },
 },
 {
 permission: {
 type: 'permission' as const,
 name: 'scaffolder.action.execute',
 attributes: { action: 'create' as const },
 },
 },
 ];

 const response = await authClient.batchAuthorize({ requests });
 
 expect(response).toBeDefined();
 expect(response.responses).toBeInstanceOf(Array);
 expect(response.responses).toHaveLength(2);
 response.responses.forEach(res => {
 expect(['ALLOW', 'DENY', 'CONDITIONAL']).toContain(res.result);
 });
 });
 });

 describe('hasPermission', () => {
 it('should check if user has permission', async () => {
 const permission = {
 type: 'permission' as const,
 name: 'catalog.entity.read',
 attributes: { action: 'read' as const },
 };

 const hasPermission = await authClient.hasPermission(permission);
 
 expect(typeof hasPermission).toBe('boolean');
 });
 });

 describe('convenience methods', () => {
 it('should check catalog entity access', async () => {
 const canRead = await authClient.canAccessEntity('read');
 const canCreate = await authClient.canAccessEntity('create');
 const canUpdate = await authClient.canAccessEntity('update', 'component:default/test');
 const canDelete = await authClient.canAccessEntity('delete', 'component:default/test');
 
 expect(typeof canRead).toBe('boolean');
 expect(typeof canCreate).toBe('boolean');
 expect(typeof canUpdate).toBe('boolean');
 expect(typeof canDelete).toBe('boolean');
 });

 it('should check scaffolder permissions', async () => {
 const canExecute = await authClient.canExecuteTemplate();
 const canExecuteSpecific = await authClient.canExecuteTemplate('template:default/react-service');
 
 expect(typeof canExecute).toBe('boolean');
 expect(typeof canExecuteSpecific).toBe('boolean');
 });

 it('should check TechDocs permissions', async () => {
 const canRead = await authClient.canAccessDocs('read');
 const canBuild = await authClient.canAccessDocs('build', 'component:default/test');
 const canSync = await authClient.canAccessDocs('sync', 'component:default/test');
 
 expect(typeof canRead).toBe('boolean');
 expect(typeof canBuild).toBe('boolean');
 expect(typeof canSync).toBe('boolean');
 });
 });

 describe('getApiKeys', () => {
 it('should fetch user API keys', async () => {
 const apiKeysResponse = await authClient.getApiKeys();
 
 expect(apiKeysResponse).toBeDefined();
 expect(apiKeysResponse.items).toBeInstanceOf(Array);
 expect(typeof apiKeysResponse.total).toBe('number');
 });

 it('should filter API keys', async () => {
 const apiKeysResponse = await authClient.getApiKeys({
 includeExpired: false,
 limit: 5,
 });
 
 expect(apiKeysResponse.items.length).toBeLessThanOrEqual(5);
 });
 });

 describe('createApiKey', () => {
 it('should create new API key', async () => {
 const request = {
 name: 'Test API Key',
 description: 'API key for testing',
 permissions: ['catalog.entity.read'],
 };

 const response = await authClient.createApiKey(request);
 
 expect(response).toBeDefined();
 expect(response.apiKey).toBeDefined();
 expect(response.secret).toBeDefined();
 expect(response.apiKey.name).toBe(request.name);
 });
 });

 describe('getUserPermissions', () => {
 it('should fetch user permissions', async () => {
 const permissions = await authClient.getUserPermissions();
 
 expect(permissions).toBeInstanceOf(Array);
 expect(permissions.length).toBeGreaterThan(0);
 permissions.forEach(permission => {
 expect(typeof permission).toBe('string');
 });
 });

 it('should fetch permissions for specific user', async () => {
 const userEntityRef = 'user:default/john-doe';
 const permissions = await authClient.getUserPermissions(userEntityRef);
 
 expect(permissions).toBeInstanceOf(Array);
 });
 });

 describe('getUserGroups', () => {
 it('should fetch user group memberships', async () => {
 const groups = await authClient.getUserGroups();
 
 expect(groups).toBeDefined();
 expect(groups.memberships).toBeInstanceOf(Array);
 groups.memberships.forEach(membership => {
 expect(membership.groupEntityRef).toBeDefined();
 });
 });
 });

 describe('checkMultiplePermissions', () => {
 it('should check multiple permissions efficiently', async () => {
 const permissions = [
 {
 permission: {
 type: 'permission' as const,
 name: 'catalog.entity.read',
 attributes: { action: 'read' as const },
 },
 },
 {
 permission: {
 type: 'permission' as const,
 name: 'scaffolder.action.execute',
 attributes: { action: 'create' as const },
 },
 },
 ];

 const results = await authClient.checkMultiplePermissions(permissions);
 
 expect(results).toBeDefined();
 expect(typeof results).toBe('object');
 Object.values(results).forEach(result => {
 expect(typeof result).toBe('boolean');
 });
 });
 });

 describe('session management', () => {
 it('should ensure valid session', async () => {
 const session = await authClient.ensureValidSession();
 
 expect(session).toBeDefined();
 expect(session.userEntityRef).toBeDefined();
 });

 it('should get current session from cache', () => {
 const session = authClient.getCurrentSession();
 // May be null if no session cached yet
 if (session) {
 expect(session.userEntityRef).toBeDefined();
 }
 });

 it('should clear session cache', () => {
 expect(() => authClient.clearSessionCache()).not.toThrow();
 });
 });

 describe('token validation', () => {
 it('should validate token', async () => {
 const mockToken = 'test-token-123';
 const result = await authClient.validateToken(mockToken);
 
 expect(result).toBeDefined();
 expect(typeof result.valid).toBe('boolean');
 });
 });

 describe('caching', () => {
 it('should cache authorization responses', async () => {
 const permission = {
 type: 'permission' as const,
 name: 'catalog.entity.read',
 attributes: { action: 'read' as const },
 };

 const startTime = Date.now();
 
 // First request
 await authClient.hasPermission(permission);
 const firstRequestTime = Date.now() - startTime;
 
 const cacheStartTime = Date.now();
 
 // Second request (should be cached)
 await authClient.hasPermission(permission);
 const secondRequestTime = Date.now() - cacheStartTime;
 
 // Cached request should be faster
 expect(secondRequestTime).toBeLessThan(firstRequestTime);
 });

 it('should clear all cached data', () => {
 expect(() => authClient.clearCache()).not.toThrow();
 });
 });

 describe('error handling', () => {
 it('should handle authorization errors gracefully', async () => {
 // Test with malformed permission
 const invalidPermission = {
 type: 'invalid' as any,
 name: 'invalid.permission',
 attributes: { action: 'invalid' as any },
 };

 // Should either throw or return DENY
 try {
 const result = await authClient.hasPermission(invalidPermission);
 expect(typeof result).toBe('boolean');
 } catch (error) {
 expect(error).toBeInstanceOf(Error);
 }
 });
 });
});