// Generated API types from OpenAPI specification

export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  version: string;
  uptime: number;
  services: {
    database: ServiceHealthStatus;
    backstage: ServiceHealthStatus;
    cache: ServiceHealthStatus;
    memory: ServiceHealthStatus;
  };
  environment?: Record<string, any>;
}

export interface ServiceHealthStatus {
  status: 'ok' | 'degraded' | 'error';
  message: string;
  responseTime?: number;
  details?: Record<string, any>;
}

export interface TenantResponse {
  tenant: TenantInfo;
  userRole?: string;
  isOwner?: boolean;
}

export interface TenantInfo {
  id: string;
  name: string;
  domain: string;
  status: 'active' | 'suspended' | 'pending';
  settings?: Record<string, any>;
  createdAt: string;
  updatedAt?: string;
}

export interface TenantListResponse {
  tenants: TenantInfo[];
}

export interface TenantAnalyticsResponse {
  analytics: {
    userCount: number;
    pluginCount: number;
    workflowCount: number;
    apiRequests: number;
    storageUsed: number;
    period: string;
  };
}

export interface PluginListResponse {
  plugins: PluginInfo[];
  total: number;
  limit: number;
  offset: number;
}

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  category?: string;
  status: 'available' | 'installed' | 'deprecated';
  dependencies?: string[];
  config?: Record<string, any>;
  metadata?: Record<string, any>;
  installDate?: string;
}

export interface PluginInstallRequest {
  pluginId: string;
  version?: string;
  config?: Record<string, any>;
}

export interface PluginInstallResponse {
  success: boolean;
  pluginId: string;
  installationId?: string;
  status: string;
}

export interface WorkflowListResponse {
  workflows: WorkflowInfo[];
  total: number;
}

export interface WorkflowInfo {
  id: string;
  name: string;
  description?: string;
  status: 'running' | 'completed' | 'failed' | 'pending';
  config?: Record<string, any>;
  steps?: WorkflowStepInfo[];
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
}

export interface WorkflowStepInfo {
  id: string;
  name: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  config?: Record<string, any>;
  output?: Record<string, any>;
}

export interface WorkflowCreateRequest {
  name: string;
  description?: string;
  steps: WorkflowStepInfo[];
  config?: Record<string, any>;
}

export interface WorkflowExecutionRequest {
  parameters?: Record<string, any>;
}

export interface WorkflowExecutionResponse {
  executionId: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  result?: Record<string, any>;
}

export interface MetricsResponse {
  timestamp: string;
  timerange: string;
  data: {
    system?: {
      cpu: number;
      memory: number;
      disk: number;
      uptime: number;
    };
    performance?: {
      averageResponseTime: number;
      requestsPerSecond: number;
      errorRate: number;
    };
    usage?: {
      activeUsers: number;
      apiCalls: number;
      pluginsInstalled: number;
      workflowsExecuted: number;
    };
  };
}

export interface NotificationListResponse {
  notifications: NotificationInfo[];
  total: number;
  unreadCount?: number;
}

export interface NotificationInfo {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  read: boolean;
  createdAt: string;
  metadata?: Record<string, any>;
}

export interface NotificationCreateRequest {
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  recipientId?: string;
  metadata?: Record<string, any>;
}

export interface SearchResponse {
  results: SearchResultInfo[];
  total: number;
  query: string;
  took: number;
}

export interface SearchResultInfo {
  id: string;
  title: string;
  description?: string;
  type: string;
  url?: string;
  score: number;
  metadata?: Record<string, any>;
}

export interface ErrorResponse {
  error: string;
  message: string;
  code?: number;
  details?: Record<string, any>;
  timestamp?: string;
}

// Query parameter types
export interface ListPluginsParams {
  search?: string;
  category?: string;
  limit?: number;
  offset?: number;
}

export interface ListWorkflowsParams {
  status?: 'running' | 'completed' | 'failed' | 'pending';
  limit?: number;
}

export interface GetHealthParams {
  verbose?: boolean;
}

export interface GetTenantParams {
  action?: 'current' | 'list' | 'analytics';
  days?: number;
}

export interface GetMetricsParams {
  timerange?: '1h' | '24h' | '7d' | '30d';
  format?: 'json' | 'prometheus';
}

export interface GetNotificationsParams {
  unread_only?: boolean;
  limit?: number;
}

export interface SearchParams {
  q: string;
  type?: 'plugin' | 'workflow' | 'service' | 'documentation';
  limit?: number;
}