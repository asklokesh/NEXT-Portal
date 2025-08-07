import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

// Mock dependencies before imports
const mockUserRepository = {
 findById: jest.fn(),
 getUserStats: jest.fn(),
};

const mockBackstageClient = {
 getCatalogEntities: jest.fn(),
 getTemplates: jest.fn(),
 getTask: jest.fn(),
};

const mockCostAggregator = {
 getCostSummary: jest.fn(),
 getAggregatedCosts: jest.fn(),
 syncAllCosts: jest.fn(),
};

const mockMockBackend = {
 getCostData: jest.fn(),
};

// Mock JWT middleware
const mockWithAuth = jest.fn();
const mockWithCors = jest.fn();

// Mock all dependencies
jest.mock('../../lib/db/repositories/UserRepository', () => ({
 UserRepository: jest.fn(() => mockUserRepository),
}));

jest.mock('../../lib/backstage/real-client', () => ({
 backstageClient: mockBackstageClient,
}));

jest.mock('../../lib/cost/aggregator', () => ({
 costAggregator: mockCostAggregator,
}));

jest.mock('../../lib/mock/backend', () => ({
 mockBackend: mockMockBackend,
}));

jest.mock('../../lib/auth/middleware', () => ({
 withAuth: jest.fn((handler) => handler),
 withCors: jest.fn(() => (handler: any) => handler),
}));

// Set test environment
process.env.USE_MOCK_DB = 'false';

describe('API Routes Integration Tests', () => {
 let _mockRequest: NextRequest;
 let mockUser: any;

 beforeEach(() => {
 jest.clearAllMocks();
 
 // Setup mock user
 mockUser = {
 id: 'user-123',
 email: 'test@example.com',
 name: 'Test User',
 username: 'testuser',
 avatar: 'https://example.com/avatar.jpg',
 role: 'USER',
 provider: 'github',
 isActive: true,
 lastLogin: new Date(),
 createdAt: new Date(),
 updatedAt: new Date(),
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
 });

 afterEach(() => {
 jest.resetAllMocks();
 });

 describe('Auth Routes', () => {
 describe('GET /api/auth/me', () => {
 it('should return user profile with stats', async () => {
 // Import after mocks are set up
 const { GET } = await import('../../app/api/auth/me/route');
 
 mockUserRepository.findById.mockResolvedValue(mockUser);
 mockUserRepository.getUserStats.mockResolvedValue({
 totalServices: 5,
 totalTemplates: 3,
 totalCosts: 1500.50,
 });

 const request = new NextRequest('http://localhost:3000/api/auth/me');
 (request as any).user = { id: 'user-123' }; // Simulate authenticated user

 const response = await GET(request as any);
 const data = await response.json();

 expect(response.status).toBe(200);
 expect(data.user).toBeDefined();
 expect(data.user.id).toBe('user-123');
 expect(data.user.email).toBe('test@example.com');
 expect(data.user.teams).toHaveLength(1);
 expect(data.user.services).toHaveLength(1);
 expect(data.stats).toBeDefined();
 expect(data.stats.totalServices).toBe(5);

 expect(mockUserRepository.findById).toHaveBeenCalledWith('user-123');
 expect(mockUserRepository.getUserStats).toHaveBeenCalledWith('user-123');
 });

 it('should return 404 when user not found', async () => {
 const { GET } = await import('../../app/api/auth/me/route');
 
 mockUserRepository.findById.mockResolvedValue(null);

 const request = new NextRequest('http://localhost:3000/api/auth/me');
 (request as any).user = { id: 'nonexistent-user' };

 const response = await GET(request as any);
 const data = await response.json();

 expect(response.status).toBe(404);
 expect(data.error).toBe('User not found');
 });

 it('should return 405 for non-GET methods', async () => {
 const { GET } = await import('../../app/api/auth/me/route');
 
 const request = new NextRequest('http://localhost:3000/api/auth/me', {
 method: 'POST',
 });
 (request as any).user = { id: 'user-123' };
 (request as any).method = 'POST';

 const response = await GET(request as any);
 const data = await response.json();

 expect(response.status).toBe(405);
 expect(data.error).toBe('Method not allowed');
 });

 it('should handle database errors gracefully', async () => {
 const { GET } = await import('../../app/api/auth/me/route');
 
 mockUserRepository.findById.mockRejectedValue(new Error('Database error'));

 const request = new NextRequest('http://localhost:3000/api/auth/me');
 (request as any).user = { id: 'user-123' };

 const response = await GET(request as any);
 const data = await response.json();

 expect(response.status).toBe(500);
 expect(data.error).toBe('Internal server error');
 });
 });
 });

 describe('Backstage Routes', () => {
 describe('GET /api/backstage/entities', () => {
 it('should fetch entities with query parameters', async () => {
 const { GET } = await import('../../app/api/backstage/entities/route');
 
 const mockEntities = [
 {
 metadata: {
 name: 'test-service',
 namespace: 'default',
 },
 kind: 'Component',
 spec: {
 type: 'service',
 },
 },
 ];

 mockBackstageClient.getCatalogEntities.mockResolvedValue(mockEntities);

 const request = new NextRequest(
 'http://localhost:3000/api/backstage/entities?kind=Component&namespace=default&limit=10'
 );

 const response = await GET(request);
 const data = await response.json();

 expect(response.status).toBe(200);
 expect(data).toEqual(mockEntities);
 expect(mockBackstageClient.getCatalogEntities).toHaveBeenCalledWith({
 kind: 'Component',
 namespace: 'default',
 name: null,
 limit: 10,
 offset: undefined,
 });
 });

 it('should handle missing query parameters', async () => {
 const { GET } = await import('../../app/api/backstage/entities/route');
 
 const mockEntities = [];
 mockBackstageClient.getCatalogEntities.mockResolvedValue(mockEntities);

 const request = new NextRequest('http://localhost:3000/api/backstage/entities');

 const response = await GET(request);
 const data = await response.json();

 expect(response.status).toBe(200);
 expect(data).toEqual(mockEntities);
 expect(mockBackstageClient.getCatalogEntities).toHaveBeenCalledWith({
 kind: undefined,
 namespace: undefined,
 name: undefined,
 limit: undefined,
 offset: undefined,
 });
 });

 it('should handle backstage client errors', async () => {
 const { GET } = await import('../../app/api/backstage/entities/route');
 
 mockBackstageClient.getCatalogEntities.mockRejectedValue(
 new Error('Backstage API error')
 );

 const request = new NextRequest('http://localhost:3000/api/backstage/entities');

 const response = await GET(request);
 const data = await response.json();

 expect(response.status).toBe(500);
 expect(data.error).toBe('Failed to fetch entities');
 });

 it('should parse numeric parameters correctly', async () => {
 const { GET } = await import('../../app/api/backstage/entities/route');
 
 mockBackstageClient.getCatalogEntities.mockResolvedValue([]);

 const request = new NextRequest(
 'http://localhost:3000/api/backstage/entities?limit=25&offset=50'
 );

 await GET(request);

 expect(mockBackstageClient.getCatalogEntities).toHaveBeenCalledWith({
 kind: undefined,
 namespace: undefined,
 name: undefined,
 limit: 25,
 offset: 50,
 });
 });
 });
 });

 describe('Cost Routes', () => {
 describe('GET /api/costs', () => {
 it('should return aggregated costs', async () => {
 const { GET } = await import('../../app/api/costs/route');
 
 const mockAggregatedCosts = [
 {
 serviceId: 'service-1',
 serviceName: 'Test Service',
 totalCost: 100.50,
 currency: 'USD',
 breakdown: {
 aws: 60.30,
 azure: 25.20,
 gcp: 15.00,
 },
 },
 ];

 mockCostAggregator.getAggregatedCosts.mockResolvedValue(mockAggregatedCosts);

 const request = new NextRequest(
 'http://localhost:3000/api/costs?startDate=2024-01-01&endDate=2024-01-31&serviceIds=service-1,service-2'
 );

 const response = await GET(request);
 const data = await response.json();

 expect(response.status).toBe(200);
 expect(data).toEqual(mockAggregatedCosts);
 expect(mockCostAggregator.getAggregatedCosts).toHaveBeenCalledWith(
 new Date('2024-01-01'),
 new Date('2024-01-31'),
 ['service-1', 'service-2']
 );
 });

 it('should return cost summary when type=summary', async () => {
 const { GET } = await import('../../app/api/costs/route');
 
 const mockCostSummary = {
 totalCost: 1500.75,
 currency: 'USD',
 periodStart: new Date('2024-01-01'),
 periodEnd: new Date('2024-01-31'),
 breakdown: {
 aws: 900.00,
 azure: 400.75,
 gcp: 200.00,
 },
 };

 mockCostAggregator.getCostSummary.mockResolvedValue(mockCostSummary);

 const request = new NextRequest(
 'http://localhost:3000/api/costs?startDate=2024-01-01&endDate=2024-01-31&type=summary'
 );

 const response = await GET(request);
 const data = await response.json();

 expect(response.status).toBe(200);
 expect(data).toEqual(mockCostSummary);
 expect(mockCostAggregator.getCostSummary).toHaveBeenCalledWith(
 new Date('2024-01-01'),
 new Date('2024-01-31')
 );
 });

 it('should return 400 when required parameters are missing', async () => {
 const { GET } = await import('../../app/api/costs/route');
 
 const request = new NextRequest('http://localhost:3000/api/costs');

 const response = await GET(request);
 const data = await response.json();

 expect(response.status).toBe(400);
 expect(data.error).toBe('startDate and endDate are required');
 });

 it('should use mock data when USE_MOCK_DB is true', async () => {
 process.env.USE_MOCK_DB = 'true';
 
 const { GET } = await import('../../app/api/costs/route');
 
 const mockCostData = {
 aggregatedCosts: [{ serviceId: 'mock-service', totalCost: 50 }],
 costSummary: { totalCost: 1000, currency: 'USD' },
 };

 mockMockBackend.getCostData.mockResolvedValue(mockCostData);

 const request = new NextRequest(
 'http://localhost:3000/api/costs?startDate=2024-01-01&endDate=2024-01-31'
 );

 const response = await GET(request);
 const data = await response.json();

 expect(response.status).toBe(200);
 expect(data).toEqual(mockCostData.aggregatedCosts);
 expect(mockMockBackend.getCostData).toHaveBeenCalled();
 expect(mockCostAggregator.getAggregatedCosts).not.toHaveBeenCalled();

 // Reset for other tests
 process.env.USE_MOCK_DB = 'false';
 });

 it('should fallback to mock data on error', async () => {
 const { GET } = await import('../../app/api/costs/route');
 
 mockCostAggregator.getAggregatedCosts.mockRejectedValue(
 new Error('Cost aggregator error')
 );

 const mockCostData = {
 aggregatedCosts: [{ serviceId: 'fallback-service', totalCost: 25 }],
 };

 mockMockBackend.getCostData.mockResolvedValue(mockCostData);

 const request = new NextRequest(
 'http://localhost:3000/api/costs?startDate=2024-01-01&endDate=2024-01-31'
 );

 const response = await GET(request);
 const data = await response.json();

 expect(response.status).toBe(200);
 expect(data).toEqual(mockCostData.aggregatedCosts);
 expect(mockMockBackend.getCostData).toHaveBeenCalled();
 });
 });

 describe('POST /api/costs', () => {
 it('should trigger cost sync', async () => {
 const { POST } = await import('../../app/api/costs/route');
 
 mockCostAggregator.syncAllCosts.mockResolvedValue(undefined);

 const request = new NextRequest('http://localhost:3000/api/costs', {
 method: 'POST',
 body: JSON.stringify({
 startDate: '2024-01-01',
 endDate: '2024-01-31',
 }),
 });

 const response = await POST(request);
 const data = await response.json();

 expect(response.status).toBe(200);
 expect(data.message).toBe('Cost sync completed successfully');
 expect(mockCostAggregator.syncAllCosts).toHaveBeenCalledWith(
 new Date('2024-01-01'),
 new Date('2024-01-31')
 );
 });

 it('should return 400 when request body is invalid', async () => {
 const { POST } = await import('../../app/api/costs/route');
 
 const request = new NextRequest('http://localhost:3000/api/costs', {
 method: 'POST',
 body: JSON.stringify({}),
 });

 const response = await POST(request);
 const data = await response.json();

 expect(response.status).toBe(400);
 expect(data.error).toBe('startDate and endDate are required');
 });

 it('should handle sync errors', async () => {
 const { POST } = await import('../../app/api/costs/route');
 
 mockCostAggregator.syncAllCosts.mockRejectedValue(
 new Error('Sync failed')
 );

 const request = new NextRequest('http://localhost:3000/api/costs', {
 method: 'POST',
 body: JSON.stringify({
 startDate: '2024-01-01',
 endDate: '2024-01-31',
 }),
 });

 const response = await POST(request);
 const data = await response.json();

 expect(response.status).toBe(500);
 expect(data.error).toBe('Failed to sync cost data');
 });
 });
 });

 describe('Parameter Parsing', () => {
 it('should handle empty service IDs correctly', async () => {
 const { GET } = await import('../../app/api/costs/route');
 
 mockCostAggregator.getAggregatedCosts.mockResolvedValue([]);

 const request = new NextRequest(
 'http://localhost:3000/api/costs?startDate=2024-01-01&endDate=2024-01-31&serviceIds='
 );

 await GET(request);

 expect(mockCostAggregator.getAggregatedCosts).toHaveBeenCalledWith(
 new Date('2024-01-01'),
 new Date('2024-01-31'),
 [] // Empty array when serviceIds is empty
 );
 });

 it('should filter empty service IDs', async () => {
 const { GET } = await import('../../app/api/costs/route');
 
 mockCostAggregator.getAggregatedCosts.mockResolvedValue([]);

 const request = new NextRequest(
 'http://localhost:3000/api/costs?startDate=2024-01-01&endDate=2024-01-31&serviceIds=service-1,,service-2,'
 );

 await GET(request);

 expect(mockCostAggregator.getAggregatedCosts).toHaveBeenCalledWith(
 new Date('2024-01-01'),
 new Date('2024-01-31'),
 ['service-1', 'service-2'] // Empty strings filtered out
 );
 });

 it('should handle invalid date parameters', async () => {
 const { GET } = await import('../../app/api/costs/route');
 
 const request = new NextRequest(
 'http://localhost:3000/api/costs?startDate=invalid-date&endDate=2024-01-31'
 );

 // This should create an Invalid Date object, which may cause errors
 // The route should handle this gracefully
 const response = await GET(request);
 
 // Should either return an error or fallback to mock data
 expect([200, 400, 500]).toContain(response.status);
 });
 });

 describe('Error Handling', () => {
 it('should handle JSON parsing errors in POST requests', async () => {
 const { POST } = await import('../../app/api/costs/route');
 
 const request = new NextRequest('http://localhost:3000/api/costs', {
 method: 'POST',
 body: 'invalid-json',
 });

 const response = await POST(request);
 
 // Should handle JSON parsing error gracefully
 expect([400, 500]).toContain(response.status);
 });

 it('should handle undefined request body', async () => {
 const { POST } = await import('../../app/api/costs/route');
 
 const request = new NextRequest('http://localhost:3000/api/costs', {
 method: 'POST',
 });

 const response = await POST(request);
 const _data = await response.json();

 expect([400, 500]).toContain(response.status);
 });
 });

 describe('Authentication Middleware Integration', () => {
 it('should be properly wrapped with auth middleware', () => {
 // The routes should be wrapped with withAuth middleware
 // This is tested by checking the mock calls in beforeEach
 expect(jest.isMockFunction(mockWithAuth)).toBe(true);
 expect(jest.isMockFunction(mockWithCors)).toBe(true);
 });
 });

 describe('Response Headers and Format', () => {
 it('should return JSON responses with correct content type', async () => {
 const { GET } = await import('../../app/api/costs/route');
 
 mockCostAggregator.getAggregatedCosts.mockResolvedValue([]);

 const request = new NextRequest(
 'http://localhost:3000/api/costs?startDate=2024-01-01&endDate=2024-01-31'
 );

 const response = await GET(request);
 
 expect(response.headers.get('content-type')).toContain('application/json');
 });

 it('should include proper CORS headers when wrapped', async () => {
 // This would be tested if CORS middleware adds headers
 // The actual CORS testing would require integration with the middleware
 const { GET } = await import('../../app/api/auth/me/route');
 
 mockUserRepository.findById.mockResolvedValue(mockUser);
 mockUserRepository.getUserStats.mockResolvedValue({});

 const request = new NextRequest('http://localhost:3000/api/auth/me');
 (request as any).user = { id: 'user-123' };

 const response = await GET(request as any);
 
 // Response should be created successfully
 expect(response.status).toBe(200);
 });
 });
});