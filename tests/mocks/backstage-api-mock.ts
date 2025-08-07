/**
 * Backstage API Mock Service
 * Comprehensive mock implementation of Backstage APIs for testing
 */

import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { ALL_PLUGINS, PLUGIN_CATEGORIES, SEARCH_FILTERS } from '../fixtures/plugin-marketplace-fixtures';
import { ALL_USERS, ALL_ROLES, ALL_PERMISSIONS } from '../fixtures/user-fixtures';

export interface BackstageApiConfig {
  baseUrl?: string;
  delayMs?: number;
  errorRate?: number; // 0-1, probability of returning errors
  enableAuth?: boolean;
  enableRateLimit?: boolean;
}

export class BackstageApiMock {
  private server: ReturnType<typeof setupServer>;
  private config: BackstageApiConfig;
  private requestCount = 0;
  private currentUser: any = ALL_USERS[0]; // Default to admin user

  constructor(config: BackstageApiConfig = {}) {
    this.config = {
      baseUrl: 'http://localhost:7007',
      delayMs: 100,
      errorRate: 0,
      enableAuth: true,
      enableRateLimit: false,
      ...config
    };

    this.server = setupServer(...this.createHandlers());
  }

  private createHandlers() {
    const { baseUrl } = this.config;
    
    return [
      // Plugin Marketplace API
      rest.get(`${baseUrl}/api/plugins`, async (req, res, ctx) => {
        await this.simulateDelay();
        
        if (this.shouldReturnError()) {
          return res(ctx.status(500), ctx.json({ error: 'Internal server error' }));
        }

        const url = new URL(req.url);
        const search = url.searchParams.get('search') || '';
        const category = url.searchParams.get('category');
        const tag = url.searchParams.get('tag');
        const minRating = parseFloat(url.searchParams.get('minRating') || '0');
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '20');

        let filteredPlugins = ALL_PLUGINS.filter(plugin => {
          if (search && !plugin.name.toLowerCase().includes(search.toLowerCase()) && 
              !plugin.displayName.toLowerCase().includes(search.toLowerCase())) {
            return false;
          }
          if (category && plugin.category !== category) {
            return false;
          }
          if (tag && !plugin.tags.includes(tag)) {
            return false;
          }
          if (plugin.metadata.rating < minRating) {
            return false;
          }
          return true;
        });

        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedPlugins = filteredPlugins.slice(startIndex, endIndex);

        return res(ctx.json({
          plugins: paginatedPlugins,
          pagination: {
            page,
            limit,
            total: filteredPlugins.length,
            pages: Math.ceil(filteredPlugins.length / limit)
          },
          facets: {
            categories: PLUGIN_CATEGORIES.map(cat => ({
              name: cat,
              count: ALL_PLUGINS.filter(p => p.category === cat).length
            })),
            tags: SEARCH_FILTERS.tags.map(tag => ({
              name: tag,
              count: ALL_PLUGINS.filter(p => p.tags.includes(tag)).length
            }))
          }
        }));
      }),

      rest.get(`${baseUrl}/api/plugins/:pluginId`, async (req, res, ctx) => {
        await this.simulateDelay();
        
        if (this.shouldReturnError()) {
          return res(ctx.status(500), ctx.json({ error: 'Plugin not found' }));
        }

        const { pluginId } = req.params;
        const plugin = ALL_PLUGINS.find(p => p.id === pluginId);
        
        if (!plugin) {
          return res(ctx.status(404), ctx.json({ error: 'Plugin not found' }));
        }

        return res(ctx.json({ plugin }));
      }),

      // Plugin Installation API
      rest.post(`${baseUrl}/api/plugins/:pluginId/install`, async (req, res, ctx) => {
        await this.simulateDelay();
        
        if (!this.hasPermission('plugins:install')) {
          return res(ctx.status(403), ctx.json({ error: 'Insufficient permissions' }));
        }

        if (this.shouldReturnError()) {
          return res(ctx.status(500), ctx.json({ error: 'Installation failed' }));
        }

        const { pluginId } = req.params;
        const body = await req.json();
        const plugin = ALL_PLUGINS.find(p => p.id === pluginId);
        
        if (!plugin) {
          return res(ctx.status(404), ctx.json({ error: 'Plugin not found' }));
        }

        const installationId = `install-${Date.now()}`;
        
        return res(ctx.json({
          installationId,
          plugin: plugin,
          configuration: body.configuration || {},
          status: 'started',
          estimatedDuration: 300000, // 5 minutes
          steps: [
            { name: 'Validate plugin', status: 'completed' },
            { name: 'Download package', status: 'in-progress' },
            { name: 'Install dependencies', status: 'pending' },
            { name: 'Configure plugin', status: 'pending' },
            { name: 'Start plugin', status: 'pending' }
          ]
        }));
      }),

      rest.get(`${baseUrl}/api/installations/:installationId`, async (req, res, ctx) => {
        await this.simulateDelay();
        
        const { installationId } = req.params;
        const progress = Math.min(100, Math.floor(Math.random() * 100));
        
        return res(ctx.json({
          installationId,
          status: progress === 100 ? 'completed' : 'in-progress',
          progress,
          currentStep: progress < 50 ? 'Installing dependencies' : 'Configuring plugin',
          logs: [
            { timestamp: new Date().toISOString(), level: 'info', message: 'Starting installation...' },
            { timestamp: new Date().toISOString(), level: 'info', message: 'Downloaded plugin package' },
            { timestamp: new Date().toISOString(), level: 'info', message: 'Installing dependencies...' }
          ],
          resourceUsage: {
            cpu: Math.random() * 100,
            memory: Math.random() * 500,
            disk: Math.random() * 1000
          }
        }));
      }),

      // Plugin Configuration API
      rest.get(`${baseUrl}/api/plugins/:pluginId/schema`, async (req, res, ctx) => {
        await this.simulateDelay();
        
        const { pluginId } = req.params;
        const plugin = ALL_PLUGINS.find(p => p.id === pluginId);
        
        if (!plugin) {
          return res(ctx.status(404), ctx.json({ error: 'Plugin not found' }));
        }

        return res(ctx.json({
          schema: plugin.configuration,
          uiSchema: this.generateUISchema(plugin.configuration)
        }));
      }),

      rest.post(`${baseUrl}/api/plugins/:pluginId/validate-config`, async (req, res, ctx) => {
        await this.simulateDelay();
        
        const { pluginId } = req.params;
        const configuration = await req.json();
        const plugin = ALL_PLUGINS.find(p => p.id === pluginId);
        
        if (!plugin) {
          return res(ctx.status(404), ctx.json({ error: 'Plugin not found' }));
        }

        const validation = this.validateConfiguration(plugin.configuration, configuration);
        
        return res(ctx.json({
          valid: validation.valid,
          errors: validation.errors,
          warnings: validation.warnings
        }));
      }),

      // User Authentication API
      rest.get(`${baseUrl}/api/auth/user`, async (req, res, ctx) => {
        await this.simulateDelay();
        
        if (!this.config.enableAuth) {
          return res(ctx.status(401), ctx.json({ error: 'Authentication disabled' }));
        }

        return res(ctx.json({ user: this.currentUser }));
      }),

      rest.post(`${baseUrl}/api/auth/login`, async (req, res, ctx) => {
        await this.simulateDelay();
        
        const credentials = await req.json();
        const user = ALL_USERS.find(u => u.email === credentials.email);
        
        if (!user || !user.metadata.active) {
          return res(ctx.status(401), ctx.json({ error: 'Invalid credentials' }));
        }

        this.currentUser = user;
        
        return res(ctx.json({
          token: `mock-token-${user.id}`,
          user: user
        }));
      }),

      // RBAC API
      rest.get(`${baseUrl}/api/permissions/check`, async (req, res, ctx) => {
        await this.simulateDelay();
        
        const url = new URL(req.url);
        const permission = url.searchParams.get('permission');
        const resource = url.searchParams.get('resource');
        
        const hasPermission = this.hasPermission(permission, resource);
        
        return res(ctx.json({
          permission,
          resource,
          allowed: hasPermission,
          user: this.currentUser.id
        }));
      }),

      rest.get(`${baseUrl}/api/roles`, async (req, res, ctx) => {
        await this.simulateDelay();
        
        if (!this.hasPermission('roles:read')) {
          return res(ctx.status(403), ctx.json({ error: 'Insufficient permissions' }));
        }

        return res(ctx.json({ roles: ALL_ROLES }));
      }),

      // Catalog API
      rest.get(`${baseUrl}/api/catalog/entities`, async (req, res, ctx) => {
        await this.simulateDelay();
        
        if (!this.hasPermission('catalog:read')) {
          return res(ctx.status(403), ctx.json({ error: 'Insufficient permissions' }));
        }

        return res(ctx.json({
          entities: [
            {
              apiVersion: 'backstage.io/v1alpha1',
              kind: 'Component',
              metadata: { name: 'test-service', namespace: 'default' },
              spec: { type: 'service', lifecycle: 'production', owner: 'team-a' }
            }
          ]
        }));
      }),

      // Health Check API
      rest.get(`${baseUrl}/api/health`, async (req, res, ctx) => {
        await this.simulateDelay();
        
        return res(ctx.json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '1.38.0',
          services: {
            database: { status: 'healthy', latency: 50 },
            cache: { status: 'healthy', latency: 10 },
            storage: { status: 'healthy', latency: 25 }
          }
        }));
      }),

      // Error simulation endpoints
      rest.get(`${baseUrl}/api/test/error/:code`, async (req, res, ctx) => {
        const { code } = req.params;
        return res(ctx.status(parseInt(code as string)), ctx.json({ 
          error: `Test error ${code}`,
          message: `This is a test error response with status ${code}`
        }));
      }),

      rest.get(`${baseUrl}/api/test/slow`, async (req, res, ctx) => {
        await this.delay(5000); // 5 second delay
        return res(ctx.json({ message: 'This endpoint is intentionally slow' }));
      }),

      rest.get(`${baseUrl}/api/test/timeout`, async (req, res, ctx) => {
        await this.delay(60000); // 1 minute delay to trigger timeout
        return res(ctx.json({ message: 'This should timeout' }));
      }),

      // Catch-all for unmocked endpoints
      rest.all(`${baseUrl}/*`, async (req, res, ctx) => {
        console.warn(`Unmocked API call: ${req.method} ${req.url.pathname}`);
        return res(ctx.status(404), ctx.json({ 
          error: 'API endpoint not mocked',
          method: req.method,
          path: req.url.pathname
        }));
      })
    ];
  }

  private async simulateDelay() {
    if (this.config.delayMs > 0) {
      await this.delay(this.config.delayMs);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private shouldReturnError(): boolean {
    return Math.random() < this.config.errorRate;
  }

  private hasPermission(permission: string, resource?: string): boolean {
    if (!this.currentUser) return false;
    
    // Admin has all permissions
    if (this.currentUser.permissions.includes('*')) return true;
    
    // Check specific permission
    return this.currentUser.permissions.includes(permission);
  }

  private generateUISchema(schema: any): any {
    const uiSchema: any = {};
    
    for (const [key, prop] of Object.entries(schema.properties || {})) {
      const property = prop as any;
      
      if (property.type === 'boolean') {
        uiSchema[key] = { 'ui:widget': 'checkbox' };
      } else if (property.type === 'string' && property.enum) {
        uiSchema[key] = { 'ui:widget': 'select' };
      } else if (property.type === 'string' && property.format === 'password') {
        uiSchema[key] = { 'ui:widget': 'password' };
      } else if (property.description?.includes('URL')) {
        uiSchema[key] = { 'ui:widget': 'uri' };
      }
    }
    
    return uiSchema;
  }

  private validateConfiguration(schema: any, config: any): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check required fields
    for (const required of schema.required || []) {
      if (!config.hasOwnProperty(required)) {
        errors.push(`Missing required field: ${required}`);
      }
    }
    
    // Validate field types
    for (const [key, value] of Object.entries(config)) {
      const property = schema.properties?.[key];
      if (!property) {
        warnings.push(`Unknown configuration field: ${key}`);
        continue;
      }
      
      if (property.type === 'string' && typeof value !== 'string') {
        errors.push(`Field ${key} must be a string`);
      } else if (property.type === 'number' && typeof value !== 'number') {
        errors.push(`Field ${key} must be a number`);
      } else if (property.type === 'boolean' && typeof value !== 'boolean') {
        errors.push(`Field ${key} must be a boolean`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Control methods
  setCurrentUser(user: any) {
    this.currentUser = user;
  }

  setErrorRate(rate: number) {
    this.config.errorRate = Math.max(0, Math.min(1, rate));
  }

  setDelay(ms: number) {
    this.config.delayMs = Math.max(0, ms);
  }

  getRequestCount(): number {
    return this.requestCount;
  }

  resetRequestCount() {
    this.requestCount = 0;
  }

  // Server lifecycle
  listen(options?: Parameters<typeof this.server.listen>[0]) {
    this.server.listen(options);
  }

  close() {
    this.server.close();
  }

  resetHandlers() {
    this.server.resetHandlers();
  }

  // Utility methods for tests
  simulateNetworkFailure() {
    this.setErrorRate(1);
    this.setDelay(0);
  }

  simulateSlowNetwork() {
    this.setErrorRate(0);
    this.setDelay(2000);
  }

  simulateNormalOperation() {
    this.setErrorRate(0);
    this.setDelay(100);
  }

  simulateIntermittentFailures() {
    this.setErrorRate(0.1); // 10% failure rate
    this.setDelay(200);
  }
}

// Singleton instance for easy testing
export const backstageApiMock = new BackstageApiMock();

export default BackstageApiMock;