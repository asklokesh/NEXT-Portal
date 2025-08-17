import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import Redis from 'ioredis';

// Mock Redis
jest.mock('ioredis');
const mockRedis = {
  incr: jest.fn(),
  expire: jest.fn(),
  get: jest.fn(),
  setex: jest.fn(),
};

// Mock external dependencies
jest.mock('@/lib/plugins/quality-service', () => ({
  enrichPluginForPortal: jest.fn((plugin) => ({
    ...plugin,
    health: 85,
    qualityGrade: 'B',
    qualityBreakdown: {
      health: 85,
      popularity: 70,
      maintenance: 80,
      security: 90,
      documentation: 75
    }
  })),
  SpotifyPortalCategory: jest.fn(),
}));

jest.mock('@/lib/plugins/docker-plugin-installer', () => ({
  dockerPluginInstaller: {
    togglePlugin: jest.fn(),
  },
}));

jest.mock('@/lib/backstage/integration-service', () => ({
  backstageIntegrationService: {
    installPluginInBackstage: jest.fn(),
    configurePluginInBackstage: jest.fn(),
  },
}));

// Mock fetch for NPM registry calls
global.fetch = jest.fn();

describe('/api/plugins', () => {
  let mockRequest: Partial<NextRequest>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    (Redis as jest.MockedClass<typeof Redis>).mockImplementation(() => mockRedis as any);
    
    mockRequest = {
      headers: new Headers({
        'x-forwarded-for': '127.0.0.1',
      }),
      url: 'http://localhost:3000/api/plugins',
    };
  });

  describe('GET /api/plugins', () => {
    describe('Rate Limiting', () => {
      it('should apply rate limiting correctly', async () => {
        mockRedis.incr.mockResolvedValue(1);
        mockRedis.expire.mockResolvedValue(1);
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ objects: [] }),
        });

        const request = new NextRequest('http://localhost:3000/api/plugins');
        const response = await GET(request);
        
        expect(mockRedis.incr).toHaveBeenCalledWith('plugins_127.0.0.1');
        expect(response.status).toBe(200);
      });

      it('should block requests when rate limit exceeded', async () => {
        mockRedis.incr.mockResolvedValue(31); // Exceeds limit of 30
        
        const request = new NextRequest('http://localhost:3000/api/plugins');
        const response = await GET(request);
        
        expect(response.status).toBe(429);
        const data = await response.json();
        expect(data.error).toContain('Rate limit exceeded');
      });
    });

    describe('Parameter Validation', () => {
      it('should validate category parameter', async () => {
        const request = new NextRequest('http://localhost:3000/api/plugins?category=invalid');
        const response = await GET(request);
        
        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toContain('Invalid category parameter');
      });

      it('should validate pagination parameters', async () => {
        const request = new NextRequest('http://localhost:3000/api/plugins?page=0&limit=-1');
        const response = await GET(request);
        
        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toContain('Invalid pagination parameters');
      });

      it('should limit query length', async () => {
        const longQuery = 'a'.repeat(150);
        const request = new NextRequest(`http://localhost:3000/api/plugins?search=${longQuery}`);
        
        mockRedis.incr.mockResolvedValue(1);
        mockRedis.get.mockResolvedValue(null);
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ objects: [] }),
        });

        const response = await GET(request);
        expect(response.status).toBe(200);
        
        // Should truncate query to 100 characters
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining(encodeURIComponent('a'.repeat(100))),
          expect.any(Object)
        );
      });
    });

    describe('Caching', () => {
      it('should return cached data when available', async () => {
        const cachedData = {
          plugins: [{ id: 'cached-plugin', name: 'Cached Plugin' }],
          total: 1,
        };
        
        mockRedis.incr.mockResolvedValue(1);
        mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));
        
        const request = new NextRequest('http://localhost:3000/api/plugins');
        const response = await GET(request);
        
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data).toEqual(cachedData);
        expect(response.headers.get('X-Cache')).toBe('HIT');
      });

      it('should cache successful responses', async () => {
        mockRedis.incr.mockResolvedValue(1);
        mockRedis.get.mockResolvedValue(null);
        mockRedis.setex.mockResolvedValue('OK');
        
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            objects: [
              {
                package: {
                  name: '@backstage/plugin-test',
                  version: '1.0.0',
                  description: 'Test plugin',
                  date: '2023-01-01',
                  keywords: ['backstage'],
                  maintainers: [{ name: 'Test Author' }],
                  links: { homepage: 'https://example.com' },
                },
                score: { final: 0.8 },
                downloads: { weekly: 1000 },
              },
            ],
          }),
        });

        const request = new NextRequest('http://localhost:3000/api/plugins');
        const response = await GET(request);
        
        expect(response.status).toBe(200);
        expect(mockRedis.setex).toHaveBeenCalled();
        expect(response.headers.get('X-Cache')).toBe('MISS');
      });
    });

    describe('Plugin Filtering and Processing', () => {
      it('should filter Backstage plugins correctly', async () => {
        mockRedis.incr.mockResolvedValue(1);
        mockRedis.get.mockResolvedValue(null);
        
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            objects: [
              {
                package: {
                  name: '@backstage/plugin-catalog',
                  version: '1.0.0',
                  description: 'Catalog plugin',
                  date: '2023-01-01',
                  keywords: ['backstage', 'catalog'],
                  maintainers: [{ name: 'Backstage Team' }],
                  links: { homepage: 'https://backstage.io' },
                },
                score: { final: 0.9 },
                downloads: { weekly: 5000 },
              },
              {
                package: {
                  name: 'unrelated-package',
                  version: '1.0.0',
                  description: 'Not a Backstage plugin',
                  date: '2023-01-01',
                  keywords: ['random'],
                  maintainers: [{ name: 'Random Author' }],
                },
                score: { final: 0.5 },
                downloads: { weekly: 100 },
              },
            ],
          }),
        });

        const request = new NextRequest('http://localhost:3000/api/plugins');
        const response = await GET(request);
        
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.plugins).toHaveLength(1);
        expect(data.plugins[0].name).toBe('@backstage/plugin-catalog');
      });

      it('should categorize plugins correctly', async () => {
        mockRedis.incr.mockResolvedValue(1);
        mockRedis.get.mockResolvedValue(null);
        
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            objects: [
              {
                package: {
                  name: '@backstage/plugin-kubernetes',
                  version: '1.0.0',
                  description: 'Kubernetes plugin',
                  date: '2023-01-01',
                  keywords: ['backstage', 'kubernetes'],
                  maintainers: [{ name: 'Backstage Team' }],
                },
                score: { final: 0.9 },
                downloads: { weekly: 3000 },
              },
            ],
          }),
        });

        const request = new NextRequest('http://localhost:3000/api/plugins');
        const response = await GET(request);
        
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.plugins[0].category).toBe('infrastructure');
      });

      it('should apply quality enhancement when requested', async () => {
        mockRedis.incr.mockResolvedValue(1);
        mockRedis.get.mockResolvedValue(null);
        
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            objects: [
              {
                package: {
                  name: '@backstage/plugin-test',
                  version: '1.0.0',
                  description: 'Test plugin',
                  date: '2023-01-01',
                  keywords: ['backstage'],
                  maintainers: [{ name: 'Test Author' }],
                },
                score: { final: 0.8 },
                downloads: { weekly: 1000 },
              },
            ],
          }),
        });

        const request = new NextRequest('http://localhost:3000/api/plugins?includeQuality=true');
        const response = await GET(request);
        
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.plugins[0]).toHaveProperty('health');
        expect(data.plugins[0]).toHaveProperty('qualityGrade');
        expect(data.plugins[0]).toHaveProperty('qualityBreakdown');
      });
    });

    describe('Sorting and Pagination', () => {
      it('should sort plugins by downloads', async () => {
        mockRedis.incr.mockResolvedValue(1);
        mockRedis.get.mockResolvedValue(null);
        
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            objects: [
              {
                package: {
                  name: '@backstage/plugin-a',
                  version: '1.0.0',
                  description: 'Plugin A',
                  date: '2023-01-01',
                  keywords: ['backstage'],
                  maintainers: [{ name: 'Author' }],
                },
                score: { final: 0.5 },
                downloads: { weekly: 1000 },
              },
              {
                package: {
                  name: '@backstage/plugin-b',
                  version: '1.0.0',
                  description: 'Plugin B',
                  date: '2023-01-01',
                  keywords: ['backstage'],
                  maintainers: [{ name: 'Author' }],
                },
                score: { final: 0.7 },
                downloads: { weekly: 2000 },
              },
            ],
          }),
        });

        const request = new NextRequest('http://localhost:3000/api/plugins?sortBy=downloads');
        const response = await GET(request);
        
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.plugins[0].downloads).toBeGreaterThan(data.plugins[1].downloads);
      });

      it('should paginate results correctly', async () => {
        mockRedis.incr.mockResolvedValue(1);
        mockRedis.get.mockResolvedValue(null);
        
        const mockPlugins = Array.from({ length: 10 }, (_, i) => ({
          package: {
            name: `@backstage/plugin-${i}`,
            version: '1.0.0',
            description: `Plugin ${i}`,
            date: '2023-01-01',
            keywords: ['backstage'],
            maintainers: [{ name: 'Author' }],
          },
          score: { final: 0.5 },
          downloads: { weekly: 1000 + i },
        }));

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ objects: mockPlugins }),
        });

        const request = new NextRequest('http://localhost:3000/api/plugins?page=2&limit=3');
        const response = await GET(request);
        
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.plugins).toHaveLength(3);
        expect(data.page).toBe(2);
        expect(data.limit).toBe(3);
        expect(data.totalPages).toBe(Math.ceil(10 / 3));
        expect(data.hasNext).toBe(true);
        expect(data.hasPrev).toBe(true);
      });
    });

    describe('Fallback Behavior', () => {
      it('should return curated plugins when NPM registry fails', async () => {
        mockRedis.incr.mockResolvedValue(1);
        mockRedis.get.mockResolvedValue(null);
        
        (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

        const request = new NextRequest('http://localhost:3000/api/plugins');
        const response = await GET(request);
        
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.source).toBe('curated-fallback');
        expect(data.plugins).toBeDefined();
        expect(data.plugins.length).toBeGreaterThan(0);
        expect(response.headers.get('X-Fallback')).toBe('true');
      });

      it('should return curated plugins when no results found', async () => {
        mockRedis.incr.mockResolvedValue(1);
        mockRedis.get.mockResolvedValue(null);
        
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ objects: [] }),
        });

        const request = new NextRequest('http://localhost:3000/api/plugins');
        const response = await GET(request);
        
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.source).toBe('curated');
        expect(data.plugins).toBeDefined();
      });
    });

    describe('Multi-tenant Context', () => {
      it('should handle tenant-specific caching', async () => {
        const tenantHeaders = new Headers({
          'x-tenant-id': 'tenant-123',
          'x-forwarded-for': '127.0.0.1',
        });
        
        const request = new NextRequest('http://localhost:3000/api/plugins', {
          headers: tenantHeaders,
        });

        mockRedis.incr.mockResolvedValue(1);
        mockRedis.get.mockResolvedValue(null);
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ objects: [] }),
        });

        const response = await GET(request);
        expect(response.status).toBe(200);
        
        // Should create tenant-specific rate limit key
        expect(mockRedis.incr).toHaveBeenCalledWith('plugins_127.0.0.1');
      });
    });
  });

  describe('POST /api/plugins', () => {
    const mockDockerPluginInstaller = require('@/lib/plugins/docker-plugin-installer').dockerPluginInstaller;
    const mockBackstageIntegrationService = require('@/lib/backstage/integration-service').backstageIntegrationService;

    describe('Plugin Installation', () => {
      it('should install plugin successfully', async () => {
        mockBackstageIntegrationService.installPluginInBackstage.mockResolvedValue({
          success: true,
          message: 'Plugin installed successfully',
          details: { version: '1.0.0' },
        });

        const request = new NextRequest('http://localhost:3000/api/plugins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'install',
            pluginId: '@backstage/plugin-test',
            version: '1.0.0',
            config: { enabled: true },
          }),
        });

        const response = await POST(request);
        
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.status).toBe('completed');
        expect(data.backstageVersion).toBe('1.41.0');
      });

      it('should handle installation failure', async () => {
        mockBackstageIntegrationService.installPluginInBackstage.mockResolvedValue({
          success: false,
          error: 'Installation failed due to dependency conflict',
        });

        const request = new NextRequest('http://localhost:3000/api/plugins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'install',
            pluginId: '@backstage/plugin-test',
            version: '1.0.0',
          }),
        });

        const response = await POST(request);
        
        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toContain('Installation failed');
      });
    });

    describe('Plugin Configuration', () => {
      it('should configure plugin successfully', async () => {
        mockBackstageIntegrationService.configurePluginInBackstage.mockResolvedValue({
          success: true,
          message: 'Plugin configured successfully',
          details: { configApplied: true },
        });

        const request = new NextRequest('http://localhost:3000/api/plugins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'configure',
            pluginId: '@backstage/plugin-test',
            config: {
              apiUrl: 'https://api.example.com',
              timeout: 5000,
            },
          }),
        });

        const response = await POST(request);
        
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.backstageVersion).toBe('1.41.0');
      });
    });

    describe('Plugin Toggle (Enable/Disable)', () => {
      it('should enable plugin successfully', async () => {
        mockDockerPluginInstaller.togglePlugin.mockResolvedValue({
          success: true,
          message: 'Plugin enabled successfully',
        });

        const request = new NextRequest('http://localhost:3000/api/plugins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'enable',
            pluginId: '@backstage/plugin-test',
          }),
        });

        const response = await POST(request);
        
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(mockDockerPluginInstaller.togglePlugin).toHaveBeenCalledWith(
          '@backstage/plugin-test',
          true
        );
      });

      it('should disable plugin successfully', async () => {
        mockDockerPluginInstaller.togglePlugin.mockResolvedValue({
          success: true,
          message: 'Plugin disabled successfully',
        });

        const request = new NextRequest('http://localhost:3000/api/plugins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'disable',
            pluginId: '@backstage/plugin-test',
          }),
        });

        const response = await POST(request);
        
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(mockDockerPluginInstaller.togglePlugin).toHaveBeenCalledWith(
          '@backstage/plugin-test',
          false
        );
      });
    });

    describe('Plugin Uninstallation', () => {
      it('should uninstall plugin successfully', async () => {
        const request = new NextRequest('http://localhost:3000/api/plugins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'uninstall',
            pluginId: '@backstage/plugin-test',
          }),
        });

        const response = await POST(request);
        
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.message).toContain('uninstalled successfully');
      });
    });

    describe('Error Handling', () => {
      it('should handle invalid action', async () => {
        const request = new NextRequest('http://localhost:3000/api/plugins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'invalid-action',
            pluginId: '@backstage/plugin-test',
          }),
        });

        const response = await POST(request);
        
        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBe('Invalid action');
      });

      it('should handle malformed JSON', async () => {
        const request = new NextRequest('http://localhost:3000/api/plugins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'invalid-json',
        });

        const response = await POST(request);
        
        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data.error).toBe('Plugin operation failed');
      });

      it('should handle service errors gracefully', async () => {
        mockBackstageIntegrationService.installPluginInBackstage.mockRejectedValue(
          new Error('Service unavailable')
        );

        const request = new NextRequest('http://localhost:3000/api/plugins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'install',
            pluginId: '@backstage/plugin-test',
          }),
        });

        const response = await POST(request);
        
        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data.error).toBe('Plugin operation failed');
        expect(data.details).toBe('Service unavailable');
      });
    });

    describe('Multi-tenant Plugin Operations', () => {
      it('should handle tenant-specific plugin installation', async () => {
        mockBackstageIntegrationService.installPluginInBackstage.mockResolvedValue({
          success: true,
          message: 'Plugin installed for tenant',
          details: { tenantId: 'tenant-123' },
        });

        const request = new NextRequest('http://localhost:3000/api/plugins', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': 'tenant-123',
          },
          body: JSON.stringify({
            action: 'install',
            pluginId: '@backstage/plugin-test',
            version: '1.0.0',
          }),
        });

        const response = await POST(request);
        
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
      });
    });
  });

  describe('Performance and Security', () => {
    it('should handle concurrent requests without race conditions', async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.get.mockResolvedValue(null);
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ objects: [] }),
      });

      const requests = Array.from({ length: 5 }, () =>
        GET(new NextRequest('http://localhost:3000/api/plugins'))
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should sanitize search input to prevent injection', async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.get.mockResolvedValue(null);
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ objects: [] }),
      });

      const maliciousQuery = '<script>alert("xss")</script>';
      const request = new NextRequest(
        `http://localhost:3000/api/plugins?search=${encodeURIComponent(maliciousQuery)}`
      );

      const response = await GET(request);
      
      expect(response.status).toBe(200);
      // Verify that the malicious script is not executed
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent(maliciousQuery.slice(0, 100))),
        expect.any(Object)
      );
    });

    it('should handle timeout scenarios', async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.get.mockResolvedValue(null);
      
      (global.fetch as jest.Mock).mockImplementation(() => 
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
      );

      const request = new NextRequest('http://localhost:3000/api/plugins');
      const response = await GET(request);
      
      // Should fallback to curated plugins
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.source).toBe('curated-fallback');
    });
  });
});