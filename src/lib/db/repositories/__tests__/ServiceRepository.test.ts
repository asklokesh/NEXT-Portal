import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ServiceRepository, CreateServiceData, UpdateServiceData } from '../ServiceRepository';

// Mock Prisma client
const mockPrisma = {
 service: {
 create: jest.fn(),
 findUnique: jest.fn(),
 findMany: jest.fn(),
 update: jest.fn(),
 delete: jest.fn(),
 count: jest.fn(),
 groupBy: jest.fn(),
 },
 serviceDependency: {
 create: jest.fn(),
 deleteMany: jest.fn(),
 },
 healthCheckResult: {
 groupBy: jest.fn(),
 },
};

// Mock the prisma client
jest.mock('../../client', () => ({
 prisma: mockPrisma,
 default: mockPrisma,
}));

describe('ServiceRepository', () => {
 let serviceRepository: ServiceRepository;

 beforeEach(() => {
 serviceRepository = new ServiceRepository();
 jest.clearAllMocks();
 });

 afterEach(() => {
 jest.resetAllMocks();
 });

 describe('create', () => {
 it('should create a new service with default values', async () => {
 const createData: CreateServiceData = {
 name: 'test-service',
 displayName: 'Test Service',
 description: 'A test service',
 type: 'SERVICE',
 lifecycle: 'PRODUCTION',
 ownerId: 'user-1',
 teamId: 'team-1',
 gitRepo: 'https://github.com/example/test-service',
 };

 const expectedService = {
 id: 'service-1',
 ...createData,
 namespace: 'default',
 gitBranch: 'main',
 tags: [],
 createdAt: new Date(),
 updatedAt: new Date(),
 };

 mockPrisma.service.create.mockResolvedValue(expectedService);

 const result = await serviceRepository.create(createData);

 expect(mockPrisma.service.create).toHaveBeenCalledWith({
 data: {
 ...createData,
 namespace: 'default',
 gitBranch: 'main',
 tags: [],
 },
 });
 expect(result).toEqual(expectedService);
 });

 it('should create service with custom namespace and branch', async () => {
 const createData: CreateServiceData = {
 name: 'custom-service',
 displayName: 'Custom Service',
 type: 'LIBRARY',
 lifecycle: 'EXPERIMENTAL',
 namespace: 'custom-namespace',
 ownerId: 'user-2',
 teamId: 'team-2',
 gitBranch: 'develop',
 tags: ['backend', 'api'],
 labels: { env: 'staging' },
 annotations: { version: '1.0.0' },
 };

 const expectedService = {
 id: 'service-2',
 ...createData,
 createdAt: new Date(),
 updatedAt: new Date(),
 };

 mockPrisma.service.create.mockResolvedValue(expectedService);

 const result = await serviceRepository.create(createData);

 expect(mockPrisma.service.create).toHaveBeenCalledWith({
 data: createData,
 });
 expect(result).toEqual(expectedService);
 });
 });

 describe('findById', () => {
 it('should find service by ID with all relations', async () => {
 const serviceId = 'service-1';
 const expectedService = {
 id: serviceId,
 name: 'test-service',
 displayName: 'Test Service',
 type: 'SERVICE',
 owner: {
 id: 'user-1',
 name: 'Test User',
 email: 'test@example.com',
 },
 team: {
 id: 'team-1',
 name: 'team-alpha',
 displayName: 'Team Alpha',
 },
 dependencies: [
 {
 id: 'dep-1',
 dependsOnId: 'service-2',
 dependencyType: 'HARD',
 dependsOn: {
 id: 'service-2',
 name: 'dependency-service',
 displayName: 'Dependency Service',
 type: 'DATABASE',
 },
 },
 ],
 dependents: [
 {
 id: 'dep-2',
 serviceId: 'service-3',
 dependencyType: 'SOFT',
 service: {
 id: 'service-3',
 name: 'dependent-service',
 displayName: 'Dependent Service',
 type: 'WEBSITE',
 },
 },
 ],
 healthChecks: [
 {
 id: 'hc-1',
 name: 'HTTP Health Check',
 type: 'HTTP',
 isEnabled: true,
 results: [
 {
 status: 'HEALTHY',
 responseTime: 150,
 checkedAt: new Date(),
 },
 ],
 },
 ],
 metrics: [
 {
 id: 'metric-1',
 name: 'cpu_usage',
 value: 75.5,
 unit: 'percent',
 timestamp: new Date(),
 },
 ],
 costs: [
 {
 id: 'cost-1',
 provider: 'AWS',
 cost: 125.50,
 currency: 'USD',
 date: new Date(),
 },
 ],
 };

 mockPrisma.service.findUnique.mockResolvedValue(expectedService);

 const result = await serviceRepository.findById(serviceId);

 expect(mockPrisma.service.findUnique).toHaveBeenCalledWith({
 where: { id: serviceId },
 include: {
 owner: {
 select: {
 id: true,
 name: true,
 email: true,
 },
 },
 team: {
 select: {
 id: true,
 name: true,
 displayName: true,
 },
 },
 dependencies: {
 include: {
 dependsOn: {
 select: {
 id: true,
 name: true,
 displayName: true,
 type: true,
 },
 },
 },
 },
 dependents: {
 include: {
 service: {
 select: {
 id: true,
 name: true,
 displayName: true,
 type: true,
 },
 },
 },
 },
 healthChecks: {
 where: { isEnabled: true },
 include: {
 results: {
 take: 1,
 orderBy: { checkedAt: 'desc' },
 },
 },
 },
 metrics: {
 take: 10,
 orderBy: { timestamp: 'desc' },
 },
 costs: {
 take: 30,
 orderBy: { date: 'desc' },
 },
 },
 });
 expect(result).toEqual(expectedService);
 });

 it('should return null when service not found', async () => {
 const serviceId = 'nonexistent-service';

 mockPrisma.service.findUnique.mockResolvedValue(null);

 const result = await serviceRepository.findById(serviceId);

 expect(result).toBeNull();
 });
 });

 describe('findByName', () => {
 it('should find service by name', async () => {
 const serviceName = 'test-service';
 const expectedService = {
 id: 'service-1',
 name: serviceName,
 displayName: 'Test Service',
 type: 'SERVICE',
 };

 mockPrisma.service.findUnique.mockResolvedValue(expectedService);

 const result = await serviceRepository.findByName(serviceName);

 expect(mockPrisma.service.findUnique).toHaveBeenCalledWith({
 where: { name: serviceName },
 });
 expect(result).toEqual(expectedService);
 });

 it('should return null when service name not found', async () => {
 const serviceName = 'nonexistent-service';

 mockPrisma.service.findUnique.mockResolvedValue(null);

 const result = await serviceRepository.findByName(serviceName);

 expect(result).toBeNull();
 });
 });

 describe('findMany', () => {
 it('should find services with default relations', async () => {
 const expectedServices = [
 {
 id: 'service-1',
 name: 'service-1',
 displayName: 'Service 1',
 owner: {
 id: 'user-1',
 name: 'User 1',
 email: 'user1@example.com',
 },
 team: {
 id: 'team-1',
 name: 'team-alpha',
 displayName: 'Team Alpha',
 },
 healthChecks: [],
 metrics: [],
 },
 ];

 mockPrisma.service.findMany.mockResolvedValue(expectedServices);

 const result = await serviceRepository.findMany();

 expect(mockPrisma.service.findMany).toHaveBeenCalledWith({
 include: {
 owner: {
 select: {
 id: true,
 name: true,
 email: true,
 },
 },
 team: {
 select: {
 id: true,
 name: true,
 displayName: true,
 },
 },
 healthChecks: {
 where: { isEnabled: true },
 include: {
 results: {
 take: 1,
 orderBy: { checkedAt: 'desc' },
 },
 },
 },
 metrics: {
 take: 5,
 orderBy: { timestamp: 'desc' },
 },
 },
 });
 expect(result).toEqual(expectedServices);
 });

 it('should find services with custom options', async () => {
 const options = {
 skip: 10,
 take: 5,
 where: { isActive: true, type: 'SERVICE' },
 orderBy: { updatedAt: 'desc' as const },
 include: { costs: true },
 };

 const expectedServices = [
 {
 id: 'service-2',
 name: 'service-2',
 displayName: 'Service 2',
 costs: [],
 },
 ];

 mockPrisma.service.findMany.mockResolvedValue(expectedServices);

 const result = await serviceRepository.findMany(options);

 expect(mockPrisma.service.findMany).toHaveBeenCalledWith({
 ...options,
 include: {
 owner: {
 select: {
 id: true,
 name: true,
 email: true,
 },
 },
 team: {
 select: {
 id: true,
 name: true,
 displayName: true,
 },
 },
 healthChecks: {
 where: { isEnabled: true },
 include: {
 results: {
 take: 1,
 orderBy: { checkedAt: 'desc' },
 },
 },
 },
 metrics: {
 take: 5,
 orderBy: { timestamp: 'desc' },
 },
 costs: true,
 },
 });
 expect(result).toEqual(expectedServices);
 });
 });

 describe('findByOwner', () => {
 it('should find active services by owner', async () => {
 const ownerId = 'user-1';
 const expectedServices = [
 {
 id: 'service-1',
 name: 'service-1',
 ownerId,
 isActive: true,
 },
 ];

 mockPrisma.service.findMany.mockResolvedValue(expectedServices);

 const result = await serviceRepository.findByOwner(ownerId);

 expect(mockPrisma.service.findMany).toHaveBeenCalledWith({
 where: {
 ownerId,
 isActive: true,
 },
 orderBy: { updatedAt: 'desc' },
 });
 expect(result).toEqual(expectedServices);
 });
 });

 describe('findByTeam', () => {
 it('should find active services by team with owner info', async () => {
 const teamId = 'team-1';
 const expectedServices = [
 {
 id: 'service-1',
 name: 'service-1',
 teamId,
 isActive: true,
 owner: {
 id: 'user-1',
 name: 'User 1',
 email: 'user1@example.com',
 },
 },
 ];

 mockPrisma.service.findMany.mockResolvedValue(expectedServices);

 const result = await serviceRepository.findByTeam(teamId);

 expect(mockPrisma.service.findMany).toHaveBeenCalledWith({
 where: {
 teamId,
 isActive: true,
 },
 include: {
 owner: {
 select: {
 id: true,
 name: true,
 email: true,
 },
 },
 },
 orderBy: { updatedAt: 'desc' },
 });
 expect(result).toEqual(expectedServices);
 });
 });

 describe('update', () => {
 it('should update service data', async () => {
 const serviceId = 'service-1';
 const updateData: UpdateServiceData = {
 displayName: 'Updated Service',
 description: 'Updated description',
 lifecycle: 'DEPRECATED',
 tags: ['updated', 'service'],
 isActive: false,
 };

 const expectedService = {
 id: serviceId,
 name: 'test-service',
 ...updateData,
 updatedAt: new Date(),
 };

 mockPrisma.service.update.mockResolvedValue(expectedService);

 const result = await serviceRepository.update(serviceId, updateData);

 expect(mockPrisma.service.update).toHaveBeenCalledWith({
 where: { id: serviceId },
 data: updateData,
 });
 expect(result).toEqual(expectedService);
 });

 it('should update partial service data', async () => {
 const serviceId = 'service-1';
 const updateData: UpdateServiceData = {
 gitBranch: 'develop',
 };

 const expectedService = {
 id: serviceId,
 name: 'test-service',
 gitBranch: 'develop',
 updatedAt: new Date(),
 };

 mockPrisma.service.update.mockResolvedValue(expectedService);

 const result = await serviceRepository.update(serviceId, updateData);

 expect(mockPrisma.service.update).toHaveBeenCalledWith({
 where: { id: serviceId },
 data: updateData,
 });
 expect(result).toEqual(expectedService);
 });
 });

 describe('delete', () => {
 it('should soft delete service by setting isActive to false', async () => {
 const serviceId = 'service-1';
 const deletedService = {
 id: serviceId,
 name: 'test-service',
 isActive: false,
 updatedAt: new Date(),
 };

 mockPrisma.service.update.mockResolvedValue(deletedService);

 const result = await serviceRepository.delete(serviceId);

 expect(mockPrisma.service.update).toHaveBeenCalledWith({
 where: { id: serviceId },
 data: {
 isActive: false,
 },
 });
 expect(result).toEqual(deletedService);
 });
 });

 describe('hardDelete', () => {
 it('should permanently delete service', async () => {
 const serviceId = 'service-1';
 const deletedService = {
 id: serviceId,
 name: 'test-service',
 };

 mockPrisma.service.delete.mockResolvedValue(deletedService);

 const result = await serviceRepository.hardDelete(serviceId);

 expect(mockPrisma.service.delete).toHaveBeenCalledWith({
 where: { id: serviceId },
 });
 expect(result).toEqual(deletedService);
 });
 });

 describe('count', () => {
 it('should count all services', async () => {
 const expectedCount = 25;

 mockPrisma.service.count.mockResolvedValue(expectedCount);

 const result = await serviceRepository.count();

 expect(mockPrisma.service.count).toHaveBeenCalledWith({ where: undefined });
 expect(result).toBe(expectedCount);
 });

 it('should count services with filters', async () => {
 const where = { isActive: true, type: 'SERVICE' };
 const expectedCount = 15;

 mockPrisma.service.count.mockResolvedValue(expectedCount);

 const result = await serviceRepository.count(where);

 expect(mockPrisma.service.count).toHaveBeenCalledWith({ where });
 expect(result).toBe(expectedCount);
 });
 });

 describe('search', () => {
 it('should search services by name, displayName, description, and tags', async () => {
 const query = 'auth';
 const expectedServices = [
 {
 id: 'service-1',
 name: 'auth-service',
 displayName: 'Authentication Service',
 description: 'Handles user authentication',
 tags: ['auth', 'security'],
 },
 ];

 // Mock the findMany method that will be called by search
 const repositoryFindManySpy = jest.spyOn(serviceRepository, 'findMany')
 .mockResolvedValue(expectedServices as any);

 const result = await serviceRepository.search(query);

 expect(repositoryFindManySpy).toHaveBeenCalledWith({
 where: {
 AND: [
 {
 OR: [
 { name: { contains: query, mode: 'insensitive' } },
 { displayName: { contains: query, mode: 'insensitive' } },
 { description: { contains: query, mode: 'insensitive' } },
 { tags: { has: query } },
 ],
 },
 { isActive: true },
 ],
 },
 skip: undefined,
 take: undefined,
 orderBy: { updatedAt: 'desc' },
 });
 expect(result).toEqual(expectedServices);

 repositoryFindManySpy.mockRestore();
 });

 it('should search services with filters and options', async () => {
 const query = 'web';
 const options = {
 skip: 5,
 take: 10,
 type: 'WEBSITE' as const,
 lifecycle: 'PRODUCTION' as const,
 ownerId: 'user-1',
 teamId: 'team-1',
 };

 const expectedServices = [
 {
 id: 'service-2',
 name: 'web-app',
 type: 'WEBSITE',
 lifecycle: 'PRODUCTION',
 },
 ];

 const repositoryFindManySpy = jest.spyOn(serviceRepository, 'findMany')
 .mockResolvedValue(expectedServices as any);

 const result = await serviceRepository.search(query, options);

 expect(repositoryFindManySpy).toHaveBeenCalledWith({
 where: {
 AND: [
 {
 OR: [
 { name: { contains: query, mode: 'insensitive' } },
 { displayName: { contains: query, mode: 'insensitive' } },
 { description: { contains: query, mode: 'insensitive' } },
 { tags: { has: query } },
 ],
 },
 { isActive: true },
 { type: options.type },
 { lifecycle: options.lifecycle },
 { ownerId: options.ownerId },
 { teamId: options.teamId },
 ],
 },
 skip: options.skip,
 take: options.take,
 orderBy: { updatedAt: 'desc' },
 });
 expect(result).toEqual(expectedServices);

 repositoryFindManySpy.mockRestore();
 });
 });

 describe('getServiceStats', () => {
 it('should get comprehensive service statistics', async () => {
 const mockGroupByServices = [
 { type: 'SERVICE', lifecycle: 'PRODUCTION', _count: 10 },
 { type: 'LIBRARY', lifecycle: 'PRODUCTION', _count: 5 },
 { type: 'WEBSITE', lifecycle: 'EXPERIMENTAL', _count: 2 },
 ];

 const mockHealthStats = [
 { status: 'HEALTHY', _count: 12 },
 { status: 'DEGRADED', _count: 3 },
 { status: 'UNHEALTHY', _count: 2 },
 ];

 mockPrisma.service.count.mockResolvedValue(17);
 mockPrisma.service.groupBy.mockResolvedValue(mockGroupByServices);
 mockPrisma.healthCheckResult.groupBy.mockResolvedValue(mockHealthStats);

 const result = await serviceRepository.getServiceStats();

 expect(mockPrisma.service.count).toHaveBeenCalledWith({ isActive: true });
 expect(mockPrisma.service.groupBy).toHaveBeenCalledWith({
 by: ['type', 'lifecycle'],
 where: { isActive: true },
 _count: true,
 });
 expect(mockPrisma.healthCheckResult.groupBy).toHaveBeenCalledWith({
 by: ['status'],
 where: {
 checkedAt: {
 gte: expect.any(Date), // Last 24 hours
 },
 },
 _count: true,
 });

 expect(result).toEqual({
 total: 17,
 byType: {
 SERVICE: 10,
 LIBRARY: 5,
 WEBSITE: 2,
 },
 byLifecycle: {
 PRODUCTION: 15,
 EXPERIMENTAL: 2,
 },
 healthy: 12,
 unhealthy: 5, // DEGRADED + UNHEALTHY
 });
 });

 it('should handle empty statistics', async () => {
 mockPrisma.service.count.mockResolvedValue(0);
 mockPrisma.service.groupBy.mockResolvedValue([]);
 mockPrisma.healthCheckResult.groupBy.mockResolvedValue([]);

 const result = await serviceRepository.getServiceStats();

 expect(result).toEqual({
 total: 0,
 byType: {},
 byLifecycle: {},
 healthy: 0,
 unhealthy: 0,
 });
 });
 });

 describe('addDependency', () => {
 it('should add a service dependency', async () => {
 const serviceId = 'service-1';
 const dependsOnId = 'service-2';
 const type = 'HARD';
 const description = 'API dependency';

 await serviceRepository.addDependency(serviceId, dependsOnId, type, description);

 expect(mockPrisma.serviceDependency.create).toHaveBeenCalledWith({
 data: {
 serviceId,
 dependsOnId,
 dependencyType: type,
 description,
 },
 });
 });

 it('should add dependency without description', async () => {
 const serviceId = 'service-1';
 const dependsOnId = 'service-2';
 const type = 'SOFT';

 await serviceRepository.addDependency(serviceId, dependsOnId, type);

 expect(mockPrisma.serviceDependency.create).toHaveBeenCalledWith({
 data: {
 serviceId,
 dependsOnId,
 dependencyType: type,
 description: undefined,
 },
 });
 });
 });

 describe('removeDependency', () => {
 it('should remove a service dependency', async () => {
 const serviceId = 'service-1';
 const dependsOnId = 'service-2';

 await serviceRepository.removeDependency(serviceId, dependsOnId);

 expect(mockPrisma.serviceDependency.deleteMany).toHaveBeenCalledWith({
 where: {
 serviceId,
 dependsOnId,
 },
 });
 });
 });

 describe('getDependencyGraph', () => {
 it('should build dependency graph with limited depth', async () => {
 const serviceId = 'service-1';
 const mockService = {
 id: serviceId,
 name: 'root-service',
 dependencies: [
 {
 dependsOnId: 'service-2',
 dependsOn: {
 id: 'service-2',
 name: 'dep-service',
 },
 },
 ],
 };

 const mockDepService = {
 id: 'service-2',
 name: 'dep-service',
 dependencies: [],
 };

 mockPrisma.service.findUnique
 .mockResolvedValueOnce(mockService)
 .mockResolvedValueOnce(mockDepService);

 const result = await serviceRepository.getDependencyGraph(serviceId, 2);

 expect(mockPrisma.service.findUnique).toHaveBeenCalledTimes(2);
 expect(mockPrisma.service.findUnique).toHaveBeenNthCalledWith(1, {
 where: { id: serviceId },
 include: {
 dependencies: {
 include: {
 dependsOn: true,
 },
 },
 },
 });

 expect(result).toEqual({
 ...mockService,
 dependencies: [
 {
 ...mockDepService,
 dependencies: [],
 },
 ],
 });
 });

 it('should return null for non-existent service', async () => {
 const serviceId = 'nonexistent-service';

 mockPrisma.service.findUnique.mockResolvedValue(null);

 const result = await serviceRepository.getDependencyGraph(serviceId);

 expect(result).toBeNull();
 });

 it('should handle circular dependencies', async () => {
 const serviceId = 'service-1';
 const mockService = {
 id: serviceId,
 name: 'service-1',
 dependencies: [
 {
 dependsOnId: 'service-2',
 dependsOn: {
 id: 'service-2',
 name: 'service-2',
 },
 },
 ],
 };

 const mockDepService = {
 id: 'service-2',
 name: 'service-2',
 dependencies: [
 {
 dependsOnId: serviceId, // Circular dependency
 dependsOn: {
 id: serviceId,
 name: 'service-1',
 },
 },
 ],
 };

 mockPrisma.service.findUnique
 .mockResolvedValueOnce(mockService)
 .mockResolvedValueOnce(mockDepService);

 const result = await serviceRepository.getDependencyGraph(serviceId, 5);

 // Should handle circular dependency without infinite recursion
 expect(result).toBeDefined();
 expect(result.id).toBe(serviceId);
 });
 });

 describe('Error Handling', () => {
 it('should handle database errors in create', async () => {
 const createData: CreateServiceData = {
 name: 'test-service',
 displayName: 'Test Service',
 type: 'SERVICE',
 lifecycle: 'PRODUCTION',
 ownerId: 'user-1',
 teamId: 'team-1',
 };

 const dbError = new Error('Database connection failed');
 mockPrisma.service.create.mockRejectedValue(dbError);

 await expect(serviceRepository.create(createData)).rejects.toThrow('Database connection failed');
 });

 it('should handle database errors in findById', async () => {
 const serviceId = 'service-1';
 const dbError = new Error('Database query failed');
 mockPrisma.service.findUnique.mockRejectedValue(dbError);

 await expect(serviceRepository.findById(serviceId)).rejects.toThrow('Database query failed');
 });

 it('should handle database errors in getServiceStats', async () => {
 const dbError = new Error('Stats query failed');
 mockPrisma.service.count.mockRejectedValue(dbError);

 await expect(serviceRepository.getServiceStats()).rejects.toThrow('Stats query failed');
 });

 it('should handle database errors in addDependency', async () => {
 const serviceId = 'service-1';
 const dependsOnId = 'service-2';
 const type = 'HARD';
 const dbError = new Error('Dependency creation failed');
 mockPrisma.serviceDependency.create.mockRejectedValue(dbError);

 await expect(serviceRepository.addDependency(serviceId, dependsOnId, type))
 .rejects.toThrow('Dependency creation failed');
 });

 it('should handle database errors in getDependencyGraph', async () => {
 const serviceId = 'service-1';
 const dbError = new Error('Graph query failed');
 mockPrisma.service.findUnique.mockRejectedValue(dbError);

 await expect(serviceRepository.getDependencyGraph(serviceId))
 .rejects.toThrow('Graph query failed');
 });
 });
});