import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { UserRepository, CreateUserData, UpdateUserData } from '../UserRepository';

// Mock Prisma client
const mockPrisma = {
 user: {
 create: jest.fn(),
 findUnique: jest.fn(),
 findFirst: jest.fn(),
 findMany: jest.fn(),
 update: jest.fn(),
 delete: jest.fn(),
 count: jest.fn(),
 },
 service: {
 count: jest.fn(),
 },
 template: {
 count: jest.fn(),
 },
 teamMember: {
 count: jest.fn(),
 },
};

// Mock the prisma client
jest.mock('../../client', () => ({
 prisma: mockPrisma,
 default: mockPrisma,
}));

describe('UserRepository', () => {
 let userRepository: UserRepository;

 beforeEach(() => {
 userRepository = new UserRepository();
 jest.clearAllMocks();
 });

 afterEach(() => {
 jest.resetAllMocks();
 });

 describe('create', () => {
 it('should create a new user with default role', async () => {
 const createData: CreateUserData = {
 email: 'test@example.com',
 name: 'Test User',
 provider: 'github',
 providerId: 'github123',
 };

 const expectedUser = {
 id: 'user-1',
 ...createData,
 role: 'DEVELOPER',
 createdAt: new Date(),
 updatedAt: new Date(),
 };

 mockPrisma.user.create.mockResolvedValue(expectedUser);

 const result = await userRepository.create(createData);

 expect(mockPrisma.user.create).toHaveBeenCalledWith({
 data: {
 ...createData,
 role: 'DEVELOPER',
 },
 });
 expect(result).toEqual(expectedUser);
 });

 it('should create a user with specified role', async () => {
 const createData: CreateUserData = {
 email: 'admin@example.com',
 name: 'Admin User',
 provider: 'okta',
 providerId: 'okta456',
 role: 'ADMIN',
 };

 const expectedUser = {
 id: 'user-2',
 ...createData,
 createdAt: new Date(),
 updatedAt: new Date(),
 };

 mockPrisma.user.create.mockResolvedValue(expectedUser);

 const result = await userRepository.create(createData);

 expect(mockPrisma.user.create).toHaveBeenCalledWith({
 data: createData,
 });
 expect(result).toEqual(expectedUser);
 });

 it('should create user with optional fields', async () => {
 const createData: CreateUserData = {
 email: 'user@example.com',
 name: 'Complete User',
 username: 'completeuser',
 avatar: 'https://example.com/avatar.jpg',
 provider: 'azure',
 providerId: 'azure789',
 role: 'PLATFORM_ADMIN',
 };

 const expectedUser = {
 id: 'user-3',
 ...createData,
 createdAt: new Date(),
 updatedAt: new Date(),
 };

 mockPrisma.user.create.mockResolvedValue(expectedUser);

 const result = await userRepository.create(createData);

 expect(mockPrisma.user.create).toHaveBeenCalledWith({
 data: createData,
 });
 expect(result).toEqual(expectedUser);
 });
 });

 describe('findById', () => {
 it('should find user by ID with relations', async () => {
 const userId = 'user-1';
 const expectedUser = {
 id: userId,
 email: 'test@example.com',
 name: 'Test User',
 teamMemberships: [
 {
 team: {
 id: 'team-1',
 name: 'team-alpha',
 displayName: 'Team Alpha',
 },
 role: 'MEMBER',
 },
 ],
 ownedServices: [
 {
 id: 'service-1',
 name: 'test-service',
 displayName: 'Test Service',
 },
 ],
 };

 mockPrisma.user.findUnique.mockResolvedValue(expectedUser);

 const result = await userRepository.findById(userId);

 expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
 where: { id: userId },
 include: {
 teamMemberships: {
 include: {
 team: true,
 },
 },
 ownedServices: true,
 },
 });
 expect(result).toEqual(expectedUser);
 });

 it('should return null when user not found', async () => {
 const userId = 'nonexistent-user';

 mockPrisma.user.findUnique.mockResolvedValue(null);

 const result = await userRepository.findById(userId);

 expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
 where: { id: userId },
 include: {
 teamMemberships: {
 include: {
 team: true,
 },
 },
 ownedServices: true,
 },
 });
 expect(result).toBeNull();
 });
 });

 describe('findByEmail', () => {
 it('should find user by email with team relations', async () => {
 const email = 'test@example.com';
 const expectedUser = {
 id: 'user-1',
 email,
 name: 'Test User',
 teamMemberships: [
 {
 team: {
 id: 'team-1',
 name: 'team-alpha',
 displayName: 'Team Alpha',
 },
 role: 'MEMBER',
 },
 ],
 };

 mockPrisma.user.findUnique.mockResolvedValue(expectedUser);

 const result = await userRepository.findByEmail(email);

 expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
 where: { email },
 include: {
 teamMemberships: {
 include: {
 team: true,
 },
 },
 },
 });
 expect(result).toEqual(expectedUser);
 });

 it('should return null when user with email not found', async () => {
 const email = 'nonexistent@example.com';

 mockPrisma.user.findUnique.mockResolvedValue(null);

 const result = await userRepository.findByEmail(email);

 expect(result).toBeNull();
 });
 });

 describe('findByProvider', () => {
 it('should find user by provider and providerId', async () => {
 const provider = 'github';
 const providerId = 'github123';
 const expectedUser = {
 id: 'user-1',
 email: 'test@example.com',
 name: 'Test User',
 provider,
 providerId,
 };

 mockPrisma.user.findFirst.mockResolvedValue(expectedUser);

 const result = await userRepository.findByProvider(provider, providerId);

 expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
 where: {
 provider,
 providerId,
 },
 });
 expect(result).toEqual(expectedUser);
 });

 it('should return null when user with provider not found', async () => {
 const provider = 'gitlab';
 const providerId = 'gitlab456';

 mockPrisma.user.findFirst.mockResolvedValue(null);

 const result = await userRepository.findByProvider(provider, providerId);

 expect(result).toBeNull();
 });
 });

 describe('findByUsername', () => {
 it('should find user by username', async () => {
 const username = 'testuser';
 const expectedUser = {
 id: 'user-1',
 username,
 email: 'test@example.com',
 name: 'Test User',
 };

 mockPrisma.user.findUnique.mockResolvedValue(expectedUser);

 const result = await userRepository.findByUsername(username);

 expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
 where: { username },
 });
 expect(result).toEqual(expectedUser);
 });

 it('should return null when username not found', async () => {
 const username = 'nonexistentuser';

 mockPrisma.user.findUnique.mockResolvedValue(null);

 const result = await userRepository.findByUsername(username);

 expect(result).toBeNull();
 });
 });

 describe('update', () => {
 it('should update user data', async () => {
 const userId = 'user-1';
 const updateData: UpdateUserData = {
 name: 'Updated Name',
 username: 'updateduser',
 role: 'ADMIN',
 isActive: true,
 };

 const expectedUser = {
 id: userId,
 ...updateData,
 email: 'test@example.com',
 updatedAt: new Date(),
 };

 mockPrisma.user.update.mockResolvedValue(expectedUser);

 const result = await userRepository.update(userId, updateData);

 expect(mockPrisma.user.update).toHaveBeenCalledWith({
 where: { id: userId },
 data: updateData,
 });
 expect(result).toEqual(expectedUser);
 });

 it('should update partial user data', async () => {
 const userId = 'user-1';
 const updateData: UpdateUserData = {
 lastLogin: new Date('2024-01-01'),
 };

 const expectedUser = {
 id: userId,
 email: 'test@example.com',
 name: 'Test User',
 lastLogin: updateData.lastLogin,
 updatedAt: new Date(),
 };

 mockPrisma.user.update.mockResolvedValue(expectedUser);

 const result = await userRepository.update(userId, updateData);

 expect(mockPrisma.user.update).toHaveBeenCalledWith({
 where: { id: userId },
 data: updateData,
 });
 expect(result).toEqual(expectedUser);
 });
 });

 describe('updateLastLogin', () => {
 it('should update user last login timestamp', async () => {
 const userId = 'user-1';
 const expectedUser = {
 id: userId,
 email: 'test@example.com',
 name: 'Test User',
 lastLogin: expect.any(Date),
 updatedAt: new Date(),
 };

 mockPrisma.user.update.mockResolvedValue(expectedUser);

 const result = await userRepository.updateLastLogin(userId);

 expect(mockPrisma.user.update).toHaveBeenCalledWith({
 where: { id: userId },
 data: {
 lastLogin: expect.any(Date),
 },
 });
 expect(result).toEqual(expectedUser);
 });
 });

 describe('findMany', () => {
 it('should find users with default options', async () => {
 const expectedUsers = [
 {
 id: 'user-1',
 email: 'user1@example.com',
 name: 'User 1',
 teamMemberships: [],
 ownedServices: [],
 },
 {
 id: 'user-2',
 email: 'user2@example.com',
 name: 'User 2',
 teamMemberships: [],
 ownedServices: [],
 },
 ];

 mockPrisma.user.findMany.mockResolvedValue(expectedUsers);

 const result = await userRepository.findMany();

 expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
 include: {
 teamMemberships: {
 include: {
 team: true,
 },
 },
 ownedServices: {
 select: {
 id: true,
 name: true,
 displayName: true,
 },
 },
 },
 });
 expect(result).toEqual(expectedUsers);
 });

 it('should find users with pagination and filters', async () => {
 const options = {
 skip: 10,
 take: 5,
 where: { isActive: true },
 orderBy: { createdAt: 'desc' as const },
 };

 const expectedUsers = [
 {
 id: 'user-3',
 email: 'user3@example.com',
 name: 'User 3',
 },
 ];

 mockPrisma.user.findMany.mockResolvedValue(expectedUsers);

 const result = await userRepository.findMany(options);

 expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
 ...options,
 include: {
 teamMemberships: {
 include: {
 team: true,
 },
 },
 ownedServices: {
 select: {
 id: true,
 name: true,
 displayName: true,
 },
 },
 },
 });
 expect(result).toEqual(expectedUsers);
 });
 });

 describe('count', () => {
 it('should count all users', async () => {
 const expectedCount = 42;

 mockPrisma.user.count.mockResolvedValue(expectedCount);

 const result = await userRepository.count();

 expect(mockPrisma.user.count).toHaveBeenCalledWith({ where: undefined });
 expect(result).toBe(expectedCount);
 });

 it('should count users with filters', async () => {
 const where = { isActive: true, role: 'DEVELOPER' };
 const expectedCount = 15;

 mockPrisma.user.count.mockResolvedValue(expectedCount);

 const result = await userRepository.count(where);

 expect(mockPrisma.user.count).toHaveBeenCalledWith({ where });
 expect(result).toBe(expectedCount);
 });
 });

 describe('delete', () => {
 it('should soft delete user by updating isActive and email', async () => {
 const userId = 'user-1';
 const deletedUser = {
 id: userId,
 email: `deleted_${Date.now()}_${userId}@deleted.local`,
 isActive: false,
 username: null,
 updatedAt: new Date(),
 };

 mockPrisma.user.update.mockResolvedValue(deletedUser);

 const result = await userRepository.delete(userId);

 expect(mockPrisma.user.update).toHaveBeenCalledWith({
 where: { id: userId },
 data: {
 isActive: false,
 email: expect.stringMatching(new RegExp(`deleted_\\d+_${userId}@deleted\\.local`)),
 username: null,
 },
 });
 expect(result).toEqual(deletedUser);
 });
 });

 describe('hardDelete', () => {
 it('should permanently delete user', async () => {
 const userId = 'user-1';
 const deletedUser = {
 id: userId,
 email: 'test@example.com',
 name: 'Test User',
 };

 mockPrisma.user.delete.mockResolvedValue(deletedUser);

 const result = await userRepository.hardDelete(userId);

 expect(mockPrisma.user.delete).toHaveBeenCalledWith({
 where: { id: userId },
 });
 expect(result).toEqual(deletedUser);
 });
 });

 describe('search', () => {
 it('should search users by name, email, and username', async () => {
 const query = 'john';
 const expectedUsers = [
 {
 id: 'user-1',
 name: 'John Doe',
 email: 'john@example.com',
 username: 'johndoe',
 teamMemberships: [],
 },
 ];

 mockPrisma.user.findMany.mockResolvedValue(expectedUsers);

 const result = await userRepository.search(query);

 expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
 where: {
 OR: [
 { name: { contains: query, mode: 'insensitive' } },
 { email: { contains: query, mode: 'insensitive' } },
 { username: { contains: query, mode: 'insensitive' } },
 ],
 isActive: true,
 },
 include: {
 teamMemberships: {
 include: {
 team: true,
 },
 },
 },
 });
 expect(result).toEqual(expectedUsers);
 });

 it('should search users with pagination options', async () => {
 const query = 'test';
 const options = { skip: 5, take: 10 };

 const expectedUsers = [
 {
 id: 'user-2',
 name: 'Test User',
 },
 ];

 mockPrisma.user.findMany.mockResolvedValue(expectedUsers);

 const result = await userRepository.search(query, options);

 expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
 where: {
 OR: [
 { name: { contains: query, mode: 'insensitive' } },
 { email: { contains: query, mode: 'insensitive' } },
 { username: { contains: query, mode: 'insensitive' } },
 ],
 isActive: true,
 },
 ...options,
 include: {
 teamMemberships: {
 include: {
 team: true,
 },
 },
 },
 });
 expect(result).toEqual(expectedUsers);
 });
 });

 describe('getUserStats', () => {
 it('should get comprehensive user statistics', async () => {
 const userId = 'user-1';
 const mockStats = {
 servicesOwned: 5,
 templatesCreated: 3,
 teamCount: 2,
 lastLogin: new Date('2024-01-01'),
 };

 mockPrisma.service.count.mockResolvedValue(mockStats.servicesOwned);
 mockPrisma.template.count.mockResolvedValue(mockStats.templatesCreated);
 mockPrisma.teamMember.count.mockResolvedValue(mockStats.teamCount);
 mockPrisma.user.findUnique.mockResolvedValue({
 lastLogin: mockStats.lastLogin,
 });

 const result = await userRepository.getUserStats(userId);

 expect(mockPrisma.service.count).toHaveBeenCalledWith({
 where: { ownerId: userId, isActive: true },
 });
 expect(mockPrisma.template.count).toHaveBeenCalledWith({
 where: { ownerId: userId, isActive: true },
 });
 expect(mockPrisma.teamMember.count).toHaveBeenCalledWith({
 where: { userId },
 });
 expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
 where: { id: userId },
 select: { lastLogin: true },
 });

 expect(result).toEqual({
 servicesOwned: mockStats.servicesOwned,
 templatesCreated: mockStats.templatesCreated,
 teamCount: mockStats.teamCount,
 lastLogin: mockStats.lastLogin,
 });
 });

 it('should handle user with no last login', async () => {
 const userId = 'user-1';

 mockPrisma.service.count.mockResolvedValue(2);
 mockPrisma.template.count.mockResolvedValue(1);
 mockPrisma.teamMember.count.mockResolvedValue(1);
 mockPrisma.user.findUnique.mockResolvedValue({
 lastLogin: null,
 });

 const result = await userRepository.getUserStats(userId);

 expect(result).toEqual({
 servicesOwned: 2,
 templatesCreated: 1,
 teamCount: 1,
 lastLogin: null,
 });
 });

 it('should handle user not found', async () => {
 const userId = 'nonexistent-user';

 mockPrisma.service.count.mockResolvedValue(0);
 mockPrisma.template.count.mockResolvedValue(0);
 mockPrisma.teamMember.count.mockResolvedValue(0);
 mockPrisma.user.findUnique.mockResolvedValue(null);

 const result = await userRepository.getUserStats(userId);

 expect(result).toEqual({
 servicesOwned: 0,
 templatesCreated: 0,
 teamCount: 0,
 lastLogin: null,
 });
 });
 });

 describe('Error Handling', () => {
 it('should handle database errors in create', async () => {
 const createData: CreateUserData = {
 email: 'test@example.com',
 name: 'Test User',
 provider: 'github',
 providerId: 'github123',
 };

 const dbError = new Error('Database connection failed');
 mockPrisma.user.create.mockRejectedValue(dbError);

 await expect(userRepository.create(createData)).rejects.toThrow('Database connection failed');
 });

 it('should handle database errors in findById', async () => {
 const userId = 'user-1';
 const dbError = new Error('Database query failed');
 mockPrisma.user.findUnique.mockRejectedValue(dbError);

 await expect(userRepository.findById(userId)).rejects.toThrow('Database query failed');
 });

 it('should handle database errors in update', async () => {
 const userId = 'user-1';
 const updateData: UpdateUserData = { name: 'Updated Name' };
 const dbError = new Error('Update failed');
 mockPrisma.user.update.mockRejectedValue(dbError);

 await expect(userRepository.update(userId, updateData)).rejects.toThrow('Update failed');
 });

 it('should handle database errors in search', async () => {
 const query = 'test';
 const dbError = new Error('Search failed');
 mockPrisma.user.findMany.mockRejectedValue(dbError);

 await expect(userRepository.search(query)).rejects.toThrow('Search failed');
 });
 });
});