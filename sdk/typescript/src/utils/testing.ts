import { EventEmitter } from 'eventemitter3';
import { 
  BackstageClient,
  HealthCheck,
  Plugin,
  Workflow,
  Tenant,
  Notification,
  Metrics,
  SearchResponse,
  PaginatedResponse,
  RequestOptions,
  ClientConfig
} from '../index';

/**
 * Mock client for testing purposes
 */
export class MockBackstageClient extends EventEmitter implements Partial<BackstageClient> {
  private mockData: MockData;
  private authenticated = true;

  constructor(mockData: Partial<MockData> = {}) {
    super();
    this.mockData = {
      health: createMockHealth(),
      plugins: createMockPlugins(),
      workflows: createMockWorkflows(),
      tenants: createMockTenants(),
      notifications: createMockNotifications(),
      metrics: createMockMetrics(),
      searchResults: createMockSearchResults(),
      ...mockData,
    };
  }

  // Auth methods
  auth = {
    setApiKey: (apiKey: string): void => {
      this.authenticated = !!apiKey;
      this.emit('tokensUpdated', { accessToken: apiKey, tokenType: 'api-key' });
    },
    
    setBearerToken: (token: string): void => {
      this.authenticated = !!token;
      this.emit('tokensUpdated', { accessToken: token, tokenType: 'bearer' });
    },
    
    clearAuth: (): void => {
      this.authenticated = false;
      this.emit('tokensCleared');
    },
    
    isAuthenticated: (): boolean => this.authenticated,
    
    getAccessToken: (): string | null => this.authenticated ? 'mock-token' : null,
  };

  // System methods
  system = {
    getHealth: async (verbose = false, options?: RequestOptions): Promise<HealthCheck> => {
      await this.simulateDelay();
      return this.mockData.health;
    },
    
    getMetrics: async (): Promise<Metrics> => {
      await this.simulateDelay();
      return this.mockData.metrics;
    },
  };

  // Tenant methods
  tenants = {
    getCurrent: async (): Promise<{ tenant: Tenant }> => {
      await this.simulateDelay();
      return { tenant: this.mockData.tenants[0] };
    },
    
    list: async (): Promise<{ tenants: Tenant[] }> => {
      await this.simulateDelay();
      return { tenants: this.mockData.tenants };
    },
    
    getAnalytics: async () => {
      await this.simulateDelay();
      return {
        analytics: {
          userCount: 150,
          pluginCount: 25,
          workflowCount: 12,
          apiRequests: 10500,
          storageUsed: 2048,
          period: '30d',
        },
      };
    },
    
    create: async (request: any): Promise<Tenant> => {
      await this.simulateDelay();
      const newTenant: Tenant = {
        id: `tenant-${Date.now()}`,
        name: request.name,
        domain: request.domain,
        status: 'active',
        settings: request.settings,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.mockData.tenants.push(newTenant);
      return newTenant;
    },
    
    update: async (request: any): Promise<Tenant> => {
      await this.simulateDelay();
      const tenant = this.mockData.tenants[0];
      return { ...tenant, ...request, updatedAt: new Date().toISOString() };
    },
  };

  // Plugin methods
  plugins = {
    list: async (params = {}): Promise<PaginatedResponse<Plugin>> => {
      await this.simulateDelay();
      let filteredPlugins = [...this.mockData.plugins];
      
      if (params.search) {
        filteredPlugins = filteredPlugins.filter(p => 
          p.name.toLowerCase().includes(params.search!.toLowerCase()) ||
          p.description?.toLowerCase().includes(params.search!.toLowerCase())
        );
      }
      
      if (params.category && params.category !== 'all') {
        filteredPlugins = filteredPlugins.filter(p => p.category === params.category);
      }
      
      const offset = params.offset || 0;
      const limit = params.limit || 50;
      const items = filteredPlugins.slice(offset, offset + limit);
      
      return {
        items,
        total: filteredPlugins.length,
        limit,
        offset,
        hasMore: offset + items.length < filteredPlugins.length,
      };
    },
    
    get: async (pluginId: string): Promise<Plugin> => {
      await this.simulateDelay();
      const plugin = this.mockData.plugins.find(p => p.id === pluginId);
      if (!plugin) {
        throw new Error(`Plugin ${pluginId} not found`);
      }
      return plugin;
    },
    
    install: async (request: any) => {
      await this.simulateDelay();
      const plugin = this.mockData.plugins.find(p => p.id === request.pluginId);
      if (!plugin) {
        throw new Error(`Plugin ${request.pluginId} not found`);
      }
      
      plugin.status = 'installed';
      plugin.installDate = new Date().toISOString();
      
      this.emit('event', {
        type: 'plugin.installed',
        data: { pluginId: plugin.id, pluginName: plugin.name, version: plugin.version },
        timestamp: new Date().toISOString(),
      });
      
      return {
        success: true,
        pluginId: plugin.id,
        installationId: `install-${Date.now()}`,
        status: 'installed',
      };
    },
    
    uninstall: async (pluginId: string): Promise<void> => {
      await this.simulateDelay();
      const plugin = this.mockData.plugins.find(p => p.id === pluginId);
      if (plugin) {
        plugin.status = 'available';
        delete plugin.installDate;
        
        this.emit('event', {
          type: 'plugin.uninstalled',
          data: { pluginId, pluginName: plugin.name },
          timestamp: new Date().toISOString(),
        });
      }
    },
    
    search: async (query: string, category?: string): Promise<PaginatedResponse<Plugin>> => {
      return this.plugins.list({ search: query, category });
    },
  };

  // Workflow methods
  workflows = {
    list: async (params = {}): Promise<PaginatedResponse<Workflow>> => {
      await this.simulateDelay();
      let filteredWorkflows = [...this.mockData.workflows];
      
      if (params.status) {
        filteredWorkflows = filteredWorkflows.filter(w => w.status === params.status);
      }
      
      const offset = params.offset || 0;
      const limit = params.limit || 50;
      const items = filteredWorkflows.slice(offset, offset + limit);
      
      return {
        items,
        total: filteredWorkflows.length,
        limit,
        offset,
        hasMore: offset + items.length < filteredWorkflows.length,
      };
    },
    
    get: async (workflowId: string): Promise<Workflow> => {
      await this.simulateDelay();
      const workflow = this.mockData.workflows.find(w => w.id === workflowId);
      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }
      return workflow;
    },
    
    create: async (request: any): Promise<Workflow> => {
      await this.simulateDelay();
      const newWorkflow: Workflow = {
        id: `workflow-${Date.now()}`,
        name: request.name,
        description: request.description,
        status: 'pending',
        config: request.config,
        steps: request.steps,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.mockData.workflows.push(newWorkflow);
      return newWorkflow;
    },
    
    update: async (workflowId: string, request: any): Promise<Workflow> => {
      await this.simulateDelay();
      const workflow = this.mockData.workflows.find(w => w.id === workflowId);
      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }
      
      Object.assign(workflow, request, { updatedAt: new Date().toISOString() });
      return workflow;
    },
    
    execute: async (workflowId: string, request = {}) => {
      await this.simulateDelay();
      const workflow = this.mockData.workflows.find(w => w.id === workflowId);
      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }
      
      const executionId = `exec-${Date.now()}`;
      
      this.emit('event', {
        type: 'workflow.started',
        data: { workflowId, workflowName: workflow.name, executionId },
        timestamp: new Date().toISOString(),
      });
      
      return {
        executionId,
        workflowId,
        status: 'running',
        startedAt: new Date().toISOString(),
        result: {},
      };
    },
    
    delete: async (workflowId: string): Promise<void> => {
      await this.simulateDelay();
      const index = this.mockData.workflows.findIndex(w => w.id === workflowId);
      if (index !== -1) {
        this.mockData.workflows.splice(index, 1);
      }
    },
  };

  // Notification methods
  notifications = {
    list: async (): Promise<{ notifications: Notification[]; total: number; unreadCount: number }> => {
      await this.simulateDelay();
      return {
        notifications: this.mockData.notifications,
        total: this.mockData.notifications.length,
        unreadCount: this.mockData.notifications.filter(n => !n.read).length,
      };
    },
    
    create: async (request: any): Promise<Notification> => {
      await this.simulateDelay();
      const notification: Notification = {
        id: `notif-${Date.now()}`,
        title: request.title,
        message: request.message,
        type: request.type,
        read: false,
        createdAt: new Date().toISOString(),
        metadata: request.metadata,
      };
      this.mockData.notifications.push(notification);
      return notification;
    },
    
    markAsRead: async (notificationId: string): Promise<void> => {
      await this.simulateDelay();
      const notification = this.mockData.notifications.find(n => n.id === notificationId);
      if (notification) {
        notification.read = true;
      }
    },
  };

  // Search method
  search = async (query: string, type?: string, limit = 20): Promise<SearchResponse> => {
    await this.simulateDelay();
    let results = [...this.mockData.searchResults];
    
    if (type) {
      results = results.filter(r => r.type === type);
    }
    
    // Simple text matching
    if (query) {
      results = results.filter(r => 
        r.title.toLowerCase().includes(query.toLowerCase()) ||
        r.description?.toLowerCase().includes(query.toLowerCase())
      );
    }
    
    return {
      results: results.slice(0, limit),
      total: results.length,
      query,
      took: 50,
    };
  };

  // Connection methods
  async connect(): Promise<void> {
    await this.simulateDelay(100);
    this.emit('connected');
  }

  disconnect(): void {
    this.emit('disconnected', { code: 1000, reason: 'Client disconnect' });
  }

  // Utility methods
  utils = {
    getConnectionStatus: () => ({
      http: true,
      websocket: { connected: true, reconnecting: false, attempts: 0 },
      auth: this.authenticated,
    }),
    
    getStatistics: () => ({
      subscriptions: 0,
      circuitBreaker: { state: 'closed' as const, failures: 0 },
    }),
  };

  dispose(): void {
    this.removeAllListeners();
  }

  private async simulateDelay(ms = 50): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Allow setting mock data for specific tests
  setMockData(data: Partial<MockData>): void {
    this.mockData = { ...this.mockData, ...data };
  }
}

interface MockData {
  health: HealthCheck;
  plugins: Plugin[];
  workflows: Workflow[];
  tenants: Tenant[];
  notifications: Notification[];
  metrics: Metrics;
  searchResults: any[];
}

// Factory function for creating mock client
export function createMockClient(mockData?: Partial<MockData>): MockBackstageClient {
  return new MockBackstageClient(mockData);
}

// Mock data generators
function createMockHealth(): HealthCheck {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: 86400,
    services: {
      database: { status: 'ok', message: 'Connected', responseTime: 5 },
      backstage: { status: 'ok', message: 'Running', responseTime: 10 },
      cache: { status: 'ok', message: 'Connected', responseTime: 2 },
      memory: { status: 'ok', message: 'Normal usage', responseTime: 1 },
    },
  };
}

function createMockPlugins(): Plugin[] {
  return [
    {
      id: 'catalog-plugin',
      name: '@backstage/plugin-catalog',
      version: '1.15.0',
      description: 'Software catalog plugin for Backstage',
      author: 'Spotify',
      category: 'catalog',
      status: 'installed',
      dependencies: ['@backstage/core-plugin-api'],
      config: {},
      metadata: { tags: ['core', 'catalog'] },
      installDate: '2024-01-01T00:00:00Z',
    },
    {
      id: 'techdocs-plugin',
      name: '@backstage/plugin-techdocs',
      version: '1.10.0',
      description: 'Documentation plugin for Backstage',
      author: 'Spotify',
      category: 'documentation',
      status: 'available',
      dependencies: ['@backstage/core-plugin-api'],
      config: {},
      metadata: { tags: ['documentation', 'mkdocs'] },
    },
  ];
}

function createMockWorkflows(): Workflow[] {
  return [
    {
      id: 'deploy-workflow',
      name: 'Deployment Workflow',
      description: 'Automated deployment pipeline',
      status: 'completed',
      config: { environment: 'production' },
      steps: [
        {
          id: 'build',
          name: 'Build Application',
          type: 'build',
          status: 'completed',
          config: { dockerfile: 'Dockerfile' },
          output: { image: 'app:latest' },
        },
        {
          id: 'deploy',
          name: 'Deploy to Kubernetes',
          type: 'deploy',
          status: 'completed',
          config: { namespace: 'production' },
          output: { deployed: true },
        },
      ],
      createdAt: '2024-01-01T10:00:00Z',
      updatedAt: '2024-01-01T10:30:00Z',
      completedAt: '2024-01-01T10:30:00Z',
    },
  ];
}

function createMockTenants(): Tenant[] {
  return [
    {
      id: 'tenant-1',
      name: 'Company Inc',
      domain: 'company.example.com',
      status: 'active',
      settings: { theme: 'light', plugins: ['catalog', 'techdocs'] },
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T12:00:00Z',
    },
  ];
}

function createMockNotifications(): Notification[] {
  return [
    {
      id: 'notif-1',
      title: 'Plugin Installed',
      message: 'Successfully installed @backstage/plugin-catalog',
      type: 'success',
      read: false,
      createdAt: '2024-01-01T12:00:00Z',
      metadata: { pluginId: 'catalog-plugin' },
    },
  ];
}

function createMockMetrics(): Metrics {
  return {
    timestamp: new Date().toISOString(),
    timerange: '1h',
    data: {
      system: {
        cpu: 45.2,
        memory: 68.5,
        disk: 35.8,
        uptime: 86400,
      },
      performance: {
        averageResponseTime: 120,
        requestsPerSecond: 150,
        errorRate: 0.2,
      },
      usage: {
        activeUsers: 25,
        apiCalls: 1500,
        pluginsInstalled: 12,
        workflowsExecuted: 8,
      },
    },
  };
}

function createMockSearchResults(): any[] {
  return [
    {
      id: 'catalog-plugin',
      title: '@backstage/plugin-catalog',
      description: 'Software catalog plugin',
      type: 'plugin',
      url: '/plugins/catalog-plugin',
      score: 0.95,
      metadata: { category: 'catalog' },
    },
    {
      id: 'deploy-workflow',
      title: 'Deployment Workflow',
      description: 'Automated deployment pipeline',
      type: 'workflow',
      url: '/workflows/deploy-workflow',
      score: 0.85,
      metadata: { status: 'completed' },
    },
  ];
}