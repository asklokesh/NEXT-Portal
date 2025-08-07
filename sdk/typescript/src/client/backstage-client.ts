import { EventEmitter } from 'eventemitter3';

import { AuthManager, AuthConfig } from '../auth/auth-manager';
import { HttpClient, HttpClientConfig } from './http-client';
import { BackstageGraphQLClient, GraphQLClientConfig } from '../graphql/graphql-client';
import { BackstageWebSocketClient, WebSocketClientConfig } from '../websocket/websocket-client';
import { 
  ClientConfig,
  HealthCheck,
  Plugin,
  PluginInstallRequest,
  PluginInstallResponse,
  Workflow,
  WorkflowRequest,
  WorkflowExecution,
  WorkflowExecutionRequest,
  Tenant,
  TenantRequest,
  TenantAnalytics,
  Notification,
  NotificationRequest,
  Metrics,
  SearchResponse,
  RequestOptions,
  PaginatedResponse,
  QueryParams
} from '../types';

export class BackstageClient extends EventEmitter {
  private authManager: AuthManager;
  private httpClient: HttpClient;
  private graphqlClient: BackstageGraphQLClient;
  private wsClient: BackstageWebSocketClient;

  constructor(config: ClientConfig) {
    super();

    // Initialize auth manager
    const authConfig: AuthConfig = {
      baseURL: config.baseURL,
      apiKey: config.apiKey,
      bearerToken: config.bearerToken,
      autoRefresh: true,
    };
    this.authManager = new AuthManager(authConfig);

    // Initialize HTTP client
    const httpConfig: HttpClientConfig = {
      baseURL: config.baseURL,
      timeout: config.timeout,
      retries: config.retries,
      retryDelay: config.retryDelay,
      circuitBreakerOptions: config.circuitBreakerOptions,
      rateLimit: config.rateLimit,
    };
    this.httpClient = new HttpClient(httpConfig, this.authManager);

    // Initialize GraphQL client
    const graphqlConfig: GraphQLClientConfig = {
      endpoint: `${config.baseURL}/graphql`,
      wsEndpoint: `${config.baseURL.replace('http', 'ws')}/graphql`,
      timeout: config.timeout,
    };
    this.graphqlClient = new BackstageGraphQLClient(graphqlConfig, this.authManager);

    // Initialize WebSocket client
    const wsConfig: WebSocketClientConfig = {
      url: `${config.baseURL.replace('http', 'ws')}/ws`,
      reconnect: true,
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
    };
    this.wsClient = new BackstageWebSocketClient(wsConfig, this.authManager);

    this.setupEventForwarding();
  }

  /**
   * Setup event forwarding from sub-clients
   */
  private setupEventForwarding(): void {
    // Forward auth events
    this.authManager.on('tokensUpdated', (tokens) => this.emit('tokensUpdated', tokens));
    this.authManager.on('authError', (error) => this.emit('authError', error));

    // Forward HTTP client events
    this.httpClient.on('requestStart', (data) => this.emit('requestStart', data));
    this.httpClient.on('requestSuccess', (data) => this.emit('requestSuccess', data));
    this.httpClient.on('requestError', (data) => this.emit('requestError', data));

    // Forward WebSocket events
    this.wsClient.on('connected', () => this.emit('connected'));
    this.wsClient.on('disconnected', (data) => this.emit('disconnected', data));
    this.wsClient.on('event', (event) => this.emit('event', event));
  }

  /**
   * Connect WebSocket client
   */
  public async connect(): Promise<void> {
    return this.wsClient.connect();
  }

  /**
   * Disconnect WebSocket client
   */
  public disconnect(): void {
    this.wsClient.disconnect();
  }

  /**
   * Authentication methods
   */
  public auth = {
    /**
     * Set API key for authentication
     */
    setApiKey: (apiKey: string): void => {
      this.authManager.setTokens({
        accessToken: apiKey,
        tokenType: 'api-key',
      });
    },

    /**
     * Set bearer token for authentication
     */
    setBearerToken: (token: string, refreshToken?: string): void => {
      this.authManager.setTokens({
        accessToken: token,
        refreshToken,
        tokenType: 'bearer',
      });
    },

    /**
     * Clear authentication tokens
     */
    clearAuth: (): void => {
      this.authManager.clearTokens();
    },

    /**
     * Check if authenticated
     */
    isAuthenticated: (): boolean => {
      return this.authManager.isAuthenticated();
    },

    /**
     * Get current access token
     */
    getAccessToken: (): string | null => {
      return this.authManager.getAccessToken();
    },
  };

  /**
   * System health and status
   */
  public system = {
    /**
     * Get system health status
     */
    getHealth: async (verbose = false, options?: RequestOptions): Promise<HealthCheck> => {
      return this.httpClient.get<HealthCheck>('/health', { verbose }, options);
    },

    /**
     * Get system metrics
     */
    getMetrics: async (
      timerange: '1h' | '24h' | '7d' | '30d' = '1h',
      format: 'json' | 'prometheus' = 'json',
      options?: RequestOptions
    ): Promise<Metrics> => {
      return this.httpClient.get<Metrics>('/metrics', { timerange, format }, options);
    },
  };

  /**
   * Tenant management
   */
  public tenants = {
    /**
     * Get current tenant information
     */
    getCurrent: async (options?: RequestOptions): Promise<{ tenant: Tenant; userRole?: string; isOwner?: boolean }> => {
      return this.httpClient.get('/tenants', { action: 'current' }, options);
    },

    /**
     * List user's tenants
     */
    list: async (options?: RequestOptions): Promise<{ tenants: Tenant[] }> => {
      return this.httpClient.get('/tenants', { action: 'list' }, options);
    },

    /**
     * Get tenant analytics
     */
    getAnalytics: async (days = 30, options?: RequestOptions): Promise<{ analytics: TenantAnalytics }> => {
      return this.httpClient.get('/tenants', { action: 'analytics', days }, options);
    },

    /**
     * Create new tenant
     */
    create: async (request: TenantRequest, options?: RequestOptions): Promise<Tenant> => {
      return this.httpClient.post('/tenants', request, options);
    },

    /**
     * Update tenant
     */
    update: async (request: TenantRequest, options?: RequestOptions): Promise<Tenant> => {
      return this.httpClient.post('/tenants', request, options);
    },
  };

  /**
   * Plugin management
   */
  public plugins = {
    /**
     * List available plugins
     */
    list: async (params: QueryParams = {}, options?: RequestOptions): Promise<PaginatedResponse<Plugin>> => {
      const response = await this.httpClient.get<{
        plugins: Plugin[];
        total: number;
        limit: number;
        offset: number;
      }>('/plugins', params, options);
      
      return {
        items: response.plugins,
        total: response.total,
        limit: response.limit,
        offset: response.offset,
        hasMore: response.offset + response.plugins.length < response.total,
      };
    },

    /**
     * Get plugin details
     */
    get: async (pluginId: string, options?: RequestOptions): Promise<Plugin> => {
      return this.httpClient.get<Plugin>(`/plugins/${pluginId}`, undefined, options);
    },

    /**
     * Install plugin
     */
    install: async (request: PluginInstallRequest, options?: RequestOptions): Promise<PluginInstallResponse> => {
      return this.httpClient.post<PluginInstallResponse>('/plugins', request, options);
    },

    /**
     * Uninstall plugin
     */
    uninstall: async (pluginId: string, options?: RequestOptions): Promise<void> => {
      return this.httpClient.delete(`/plugins/${pluginId}`, options);
    },

    /**
     * Search plugins
     */
    search: async (query: string, category?: string, options?: RequestOptions): Promise<PaginatedResponse<Plugin>> => {
      return this.plugins.list({ search: query, category }, options);
    },
  };

  /**
   * Workflow management
   */
  public workflows = {
    /**
     * List workflows
     */
    list: async (params: QueryParams = {}, options?: RequestOptions): Promise<PaginatedResponse<Workflow>> => {
      const response = await this.httpClient.get<{
        workflows: Workflow[];
        total: number;
      }>('/workflows', params, options);
      
      return {
        items: response.workflows,
        total: response.total,
        limit: params.limit || 50,
        offset: params.offset || 0,
        hasMore: (params.offset || 0) + response.workflows.length < response.total,
      };
    },

    /**
     * Get workflow details
     */
    get: async (workflowId: string, options?: RequestOptions): Promise<Workflow> => {
      return this.httpClient.get<Workflow>(`/workflows/${workflowId}`, undefined, options);
    },

    /**
     * Create workflow
     */
    create: async (request: WorkflowRequest, options?: RequestOptions): Promise<Workflow> => {
      return this.httpClient.post<Workflow>('/workflows', request, options);
    },

    /**
     * Update workflow
     */
    update: async (workflowId: string, request: WorkflowRequest, options?: RequestOptions): Promise<Workflow> => {
      return this.httpClient.put<Workflow>(`/workflows/${workflowId}`, request, options);
    },

    /**
     * Execute workflow
     */
    execute: async (
      workflowId: string,
      request: WorkflowExecutionRequest = {},
      options?: RequestOptions
    ): Promise<WorkflowExecution> => {
      return this.httpClient.post<WorkflowExecution>(`/workflows/${workflowId}/execute`, request, options);
    },

    /**
     * Delete workflow
     */
    delete: async (workflowId: string, options?: RequestOptions): Promise<void> => {
      return this.httpClient.delete(`/workflows/${workflowId}`, options);
    },
  };

  /**
   * Notification management
   */
  public notifications = {
    /**
     * List notifications
     */
    list: async (unreadOnly = false, limit = 20, options?: RequestOptions): Promise<{
      notifications: Notification[];
      total: number;
      unreadCount: number;
    }> => {
      return this.httpClient.get('/notifications', { unread_only: unreadOnly, limit }, options);
    },

    /**
     * Create notification
     */
    create: async (request: NotificationRequest, options?: RequestOptions): Promise<Notification> => {
      return this.httpClient.post<Notification>('/notifications', request, options);
    },

    /**
     * Mark notification as read
     */
    markAsRead: async (notificationId: string, options?: RequestOptions): Promise<void> => {
      return this.httpClient.patch(`/notifications/${notificationId}`, { read: true }, options);
    },
  };

  /**
   * Search functionality
   */
  public search = async (
    query: string,
    type?: 'plugin' | 'workflow' | 'service' | 'documentation',
    limit = 20,
    options?: RequestOptions
  ): Promise<SearchResponse> => {
    return this.httpClient.get<SearchResponse>('/search', { q: query, type, limit }, options);
  };

  /**
   * GraphQL client access
   */
  public graphql = this.graphqlClient;

  /**
   * WebSocket client access
   */
  public websocket = this.wsClient;

  /**
   * Event subscription methods
   */
  public events = {
    /**
     * Subscribe to plugin events
     */
    onPluginEvent: (handler: (event: any) => void) => {
      return this.wsClient.subscribe(['plugin.installed', 'plugin.uninstalled', 'plugin.updated'], handler);
    },

    /**
     * Subscribe to workflow events
     */
    onWorkflowEvent: (handler: (event: any) => void) => {
      return this.wsClient.subscribe(['workflow.started', 'workflow.completed', 'workflow.failed'], handler);
    },

    /**
     * Subscribe to system events
     */
    onSystemEvent: (handler: (event: any) => void) => {
      return this.wsClient.subscribe(['system.health_change'], handler);
    },

    /**
     * Subscribe to all events
     */
    onAnyEvent: (handler: (event: any) => void) => {
      this.wsClient.on('event', handler);
      return () => this.wsClient.off('event', handler);
    },
  };

  /**
   * Batch operations
   */
  public batch = {
    /**
     * Execute multiple operations in a single request
     */
    execute: async (operations: Array<{
      method: 'GET' | 'POST' | 'PUT' | 'DELETE';
      path: string;
      data?: any;
    }>, options?: RequestOptions) => {
      return this.httpClient.post('/batch', { operations }, options);
    },
  };

  /**
   * Utility methods
   */
  public utils = {
    /**
     * Get connection status
     */
    getConnectionStatus: () => ({
      http: true, // HTTP client doesn't maintain persistent connection
      websocket: this.wsClient.getStatus(),
      auth: this.authManager.isAuthenticated(),
    }),

    /**
     * Get client statistics
     */
    getStatistics: () => ({
      subscriptions: this.wsClient.getSubscriptionsCount(),
      circuitBreaker: this.httpClient.getCircuitBreakerStatus(),
    }),
  };

  /**
   * Dispose of the client and clean up resources
   */
  public dispose(): void {
    this.authManager.dispose();
    this.httpClient.dispose();
    this.graphqlClient.dispose();
    this.wsClient.dispose();
    this.removeAllListeners();
  }
}