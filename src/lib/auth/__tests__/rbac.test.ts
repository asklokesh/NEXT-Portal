import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Set environment to use mock database
process.env.USE_MOCK_DB = 'true';
process.env.NODE_ENV = 'test';

// Mock the database client module before importing any modules that use it
const mockServiceFindUnique = jest.fn();
const mockTemplateFindUnique = jest.fn();
const mockServiceCostFindFirst = jest.fn();
const mockUserFindUnique = jest.fn();

jest.mock('../../db/client', () => {
 return {
 __esModule: true,
 prisma: {
 service: {
 findUnique: jest.fn(),
 findFirst: jest.fn(),
 findMany: jest.fn(),
 },
 template: {
 findUnique: jest.fn(),
 findFirst: jest.fn(),
 findMany: jest.fn(),
 },
 serviceCost: {
 findFirst: jest.fn(),
 findMany: jest.fn(),
 },
 user: {
 findUnique: jest.fn(),
 findFirst: jest.fn(),
 findMany: jest.fn(),
 },
 $queryRaw: jest.fn(),
 $disconnect: jest.fn(),
 },
 redis: {},
 sessionRedis: {},
 checkDatabaseHealth: jest.fn(),
 checkRedisHealth: jest.fn(),
 };
});

// Now import the modules that use the mocked dependencies
import { RBACSystem } from '../rbac';
import type { RBACContext, Permission } from '../rbac';
import { prisma } from '../../db/client';

describe('RBACSystem', () => {
 let rbacSystem: RBACSystem;
 let mockContext: RBACContext;

 beforeEach(() => {
 jest.clearAllMocks();
 rbacSystem = new RBACSystem();
 mockContext = {
 userId: 'test-user-id',
 userRole: 'USER',
 teamIds: ['team-1', 'team-2'],
 };
 });

 describe('hasPermission', () => {
 it('should grant all permissions to ADMIN role', async () => {
 const adminContext: RBACContext = {
 ...mockContext,
 userRole: 'ADMIN',
 };

 const hasPermission = await rbacSystem.hasPermission(
 adminContext,
 'catalog',
 'write',
 'resource-id'
 );

 expect(hasPermission).toBe(true);
 });

 it('should check USER permissions correctly', async () => {
 // USER can read catalog
 expect(await rbacSystem.hasPermission(mockContext, 'catalog', 'read')).toBe(true);
 
 // USER cannot write catalog
 expect(await rbacSystem.hasPermission(mockContext, 'catalog', 'write')).toBe(false);
 
 // USER can execute templates
 expect(await rbacSystem.hasPermission(mockContext, 'template', 'execute')).toBe(true);
 });

 it('should check MANAGER permissions correctly', async () => {
 const managerContext: RBACContext = {
 ...mockContext,
 userRole: 'MANAGER',
 };

 // MANAGER can write catalog
 expect(await rbacSystem.hasPermission(managerContext, 'catalog', 'write')).toBe(true);
 
 // MANAGER can manage team
 expect(await rbacSystem.hasPermission(managerContext, 'team', 'manage')).toBe(true);
 });

 it('should check ownership for own resources', async () => {
 const mockService = { id: 'service-1', ownerId: 'test-user-id' };
 (prisma.service.findUnique as jest.MockedFunction<any>).mockResolvedValueOnce(mockService);

 const hasPermission = await rbacSystem.hasPermission(
 mockContext,
 'service',
 'read:own',
 'service-1'
 );

 expect(hasPermission).toBe(true);
 expect(prisma.service.findUnique).toHaveBeenCalledWith({
 where: { id: 'service-1' },
 select: { ownerId: true },
 });
 });

 it('should deny access to resources not owned by user', async () => {
 const mockService = { id: 'service-1', ownerId: 'other-user-id' };
 (prisma.service.findUnique as jest.MockedFunction<any>).mockResolvedValueOnce(mockService);

 const hasPermission = await rbacSystem.hasPermission(
 mockContext,
 'service',
 'read:own',
 'service-1'
 );

 expect(hasPermission).toBe(false);
 });

 it('should check team membership for team resources', async () => {
 const mockService = { id: 'service-1', teamId: 'team-1' };
 (prisma.service.findUnique as jest.MockedFunction<any>).mockResolvedValueOnce(mockService);

 const managerContext: RBACContext = {
 ...mockContext,
 userRole: 'MANAGER',
 };

 const hasPermission = await rbacSystem.hasPermission(
 managerContext,
 'service',
 'write:team',
 'service-1'
 );

 expect(hasPermission).toBe(true);
 });

 it('should deny access to resources from other teams', async () => {
 const mockService = { id: 'service-1', teamId: 'team-3' };
 (prisma.service.findUnique as jest.MockedFunction<any>).mockResolvedValueOnce(mockService);

 const managerContext: RBACContext = {
 ...mockContext,
 userRole: 'MANAGER',
 };

 const hasPermission = await rbacSystem.hasPermission(
 managerContext,
 'service',
 'write:team',
 'service-1'
 );

 expect(hasPermission).toBe(false);
 });
 });

 describe('getRolePermissions', () => {
 it('should return correct permissions for each role', () => {
 const adminPermissions = rbacSystem.getRolePermissions('ADMIN');
 expect(adminPermissions).toHaveLength(1);
 expect(adminPermissions[0].resource).toBe('*');
 expect(adminPermissions[0].action).toBe('*');

 const userPermissions = rbacSystem.getRolePermissions('USER');
 expect(userPermissions.length).toBeGreaterThan(0);
 expect(userPermissions.some(p => p.resource === 'catalog' && p.action === 'read')).toBe(true);

 const managerPermissions = rbacSystem.getRolePermissions('MANAGER');
 expect(managerPermissions.length).toBeGreaterThan(userPermissions.length);
 expect(managerPermissions.some(p => p.resource === 'team' && p.action === 'manage')).toBe(true);

 const viewerPermissions = rbacSystem.getRolePermissions('VIEWER');
 expect(viewerPermissions.some(p => p.action === 'read:all')).toBe(true);
 });

 it('should return empty array for unknown role', () => {
 const permissions = rbacSystem.getRolePermissions('UNKNOWN_ROLE');
 expect(permissions).toEqual([]);
 });
 });

 describe('filterResources', () => {
 it('should return all resources for ADMIN', async () => {
 const adminContext: RBACContext = {
 ...mockContext,
 userRole: 'ADMIN',
 };

 const resources = [
 { id: '1', ownerId: 'user1', teamId: 'team1' },
 { id: '2', ownerId: 'user2', teamId: 'team2' },
 { id: '3', ownerId: 'user3', teamId: 'team3' },
 ];

 const filtered = await rbacSystem.filterResources(
 adminContext,
 resources,
 'service',
 'read'
 );

 expect(filtered).toEqual(resources);
 });

 it('should filter resources by ownership for USER role', async () => {
 const resources = [
 { id: '1', ownerId: 'test-user-id', teamId: 'team1' },
 { id: '2', ownerId: 'other-user', teamId: 'team2' },
 { id: '3', ownerId: 'test-user-id', teamId: 'team3' },
 ];

 const filtered = await rbacSystem.filterResources(
 mockContext,
 resources,
 'service',
 'read'
 );

 expect(filtered).toHaveLength(2);
 expect(filtered.every(r => r.ownerId === 'test-user-id')).toBe(true);
 });

 it('should filter resources by team for MANAGER role', async () => {
 const managerContext: RBACContext = {
 ...mockContext,
 userRole: 'MANAGER',
 };

 const resources = [
 { id: '1', ownerId: 'user1', teamId: 'team-1' },
 { id: '2', ownerId: 'user2', teamId: 'team-3' },
 { id: '3', ownerId: 'user3', teamId: 'team-2' },
 ];

 const filtered = await rbacSystem.filterResources(
 managerContext,
 resources,
 'service',
 'read'
 );

 expect(filtered).toHaveLength(2);
 expect(filtered.every(r => mockContext.teamIds.includes(r.teamId!))).toBe(true);
 });

 it('should return all resources for VIEWER role', async () => {
 const viewerContext: RBACContext = {
 ...mockContext,
 userRole: 'VIEWER',
 };

 const resources = [
 { id: '1', ownerId: 'user1' },
 { id: '2', ownerId: 'user2' },
 { id: '3', ownerId: 'user3' },
 ];

 const filtered = await rbacSystem.filterResources(
 viewerContext,
 resources,
 'service',
 'read'
 );

 expect(filtered).toEqual(resources);
 });
 });

 describe('canPerformBulkOperation', () => {
 it('should check permissions for all resources', async () => {
 const mockServices = [
 { id: 'service-1', ownerId: 'test-user-id' },
 { id: 'service-2', ownerId: 'test-user-id' },
 { id: 'service-3', ownerId: 'other-user' },
 ];

 (prisma.service.findUnique as jest.MockedFunction<any>)
 .mockResolvedValueOnce(mockServices[0])
 .mockResolvedValueOnce(mockServices[1])
 .mockResolvedValueOnce(mockServices[2]);

 const canPerform = await rbacSystem.canPerformBulkOperation(
 mockContext,
 'service',
 'read:own',
 ['service-1', 'service-2', 'service-3']
 );

 expect(canPerform).toBe(false); // Because service-3 is not owned by user
 expect(prisma.service.findUnique).toHaveBeenCalledTimes(3);
 });

 it('should return true if user has permission for all resources', async () => {
 const mockServices = [
 { id: 'service-1', ownerId: 'test-user-id' },
 { id: 'service-2', ownerId: 'test-user-id' },
 ];

 (prisma.service.findUnique as jest.MockedFunction<any>)
 .mockResolvedValueOnce(mockServices[0])
 .mockResolvedValueOnce(mockServices[1]);

 const canPerform = await rbacSystem.canPerformBulkOperation(
 mockContext,
 'service',
 'read:own',
 ['service-1', 'service-2']
 );

 expect(canPerform).toBe(true);
 });
 });

 describe('createAuthorizationMiddleware', () => {
 it('should create middleware that checks authorization', async () => {
 const middleware = rbacSystem.createAuthorizationMiddleware('catalog', 'write');
 
 const req = {
 user: {
 id: 'test-user',
 role: 'MANAGER',
 teamIds: ['team-1'],
 },
 params: { id: 'resource-1' },
 };
 const res = {
 status: jest.fn().mockReturnThis(),
 json: jest.fn(),
 };
 const next = jest.fn();

 await middleware(req, res, next);

 expect(next).toHaveBeenCalled();
 expect(res.status).not.toHaveBeenCalled();
 });

 it('should return 401 if no user', async () => {
 const middleware = rbacSystem.createAuthorizationMiddleware('catalog', 'write');
 
 const req = { user: null };
 const res = {
 status: jest.fn().mockReturnThis(),
 json: jest.fn(),
 };
 const next = jest.fn();

 await middleware(req, res, next);

 expect(res.status).toHaveBeenCalledWith(401);
 expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
 expect(next).not.toHaveBeenCalled();
 });

 it('should return 403 if user lacks permission', async () => {
 const middleware = rbacSystem.createAuthorizationMiddleware('catalog', 'write');
 
 const req = {
 user: {
 id: 'test-user',
 role: 'USER', // USER cannot write catalog
 teamIds: [],
 },
 params: { id: 'resource-1' },
 };
 const res = {
 status: jest.fn().mockReturnThis(),
 json: jest.fn(),
 };
 const next = jest.fn();

 await middleware(req, res, next);

 expect(res.status).toHaveBeenCalledWith(403);
 expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden' });
 expect(next).not.toHaveBeenCalled();
 });
 });

 describe('getUserPermissions', () => {
 it('should fetch user permissions from database', async () => {
 const mockUser = { id: 'test-user', role: 'MANAGER' };
 (prisma.user.findUnique as jest.MockedFunction<any>).mockResolvedValueOnce(mockUser);

 const permissions = await rbacSystem.getUserPermissions('test-user');

 expect(prisma.user.findUnique).toHaveBeenCalledWith({
 where: { id: 'test-user' },
 select: { role: true },
 });
 expect(permissions.length).toBeGreaterThan(0);
 expect(permissions.some(p => p.resource === 'team' && p.action === 'manage')).toBe(true);
 });

 it('should return empty permissions for non-existent user', async () => {
 (prisma.user.findUnique as jest.MockedFunction<any>).mockResolvedValueOnce(null);

 const permissions = await rbacSystem.getUserPermissions('non-existent');

 expect(permissions).toEqual([]);
 });
 });

 describe('createBackstagePolicy', () => {
 it('should create policy compatible with Backstage', async () => {
 const policy = rbacSystem.createBackstagePolicy();
 
 const user = {
 id: 'test-user',
 role: 'MANAGER',
 teams: ['team-1'],
 };

 const mockService = { id: 'service-1', teamId: 'team-1' };
 (prisma.service.findUnique as jest.MockedFunction<any>).mockResolvedValueOnce(mockService);

 const isAllowed = await policy.isAllowed(
 user,
 'service.write',
 { id: 'service-1' }
 );

 expect(isAllowed).toBe(true);
 });
 });
});