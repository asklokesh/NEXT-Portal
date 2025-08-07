// Core API Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// Health Types
export interface ServiceHealth {
  status: 'ok' | 'degraded' | 'error';
  message: string;
  responseTime?: number;
  details?: Record<string, any>;
}

export interface HealthCheck {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  version: string;
  uptime: number;
  services: {
    database: ServiceHealth;
    backstage: ServiceHealth;
    cache: ServiceHealth;
    memory: ServiceHealth;
  };
  environment?: Record<string, any>;
}

// Tenant Types
export interface Tenant {
  id: string;
  name: string;
  domain: string;
  status: 'active' | 'suspended' | 'pending';
  settings?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface TenantAnalytics {
  userCount: number;
  pluginCount: number;
  workflowCount: number;
  apiRequests: number;
  storageUsed: number;
  period: string;
}

export interface TenantRequest {
  action: 'create' | 'update' | 'suspend' | 'activate';
  name?: string;
  domain?: string;
  settings?: Record<string, any>;
}

// Plugin Types
export interface Plugin {
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

// Workflow Types
export interface WorkflowStep {
  id: string;
  name: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  config?: Record<string, any>;
  output?: Record<string, any>;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  status: 'running' | 'completed' | 'failed' | 'pending';
  config?: Record<string, any>;
  steps?: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface WorkflowRequest {
  name: string;
  description?: string;
  steps: WorkflowStep[];
  config?: Record<string, any>;
}

export interface WorkflowExecution {
  executionId: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  result?: Record<string, any>;
}

// Metrics Types
export interface SystemMetrics {
  cpu: number;
  memory: number;
  disk: number;
  uptime: number;
}

export interface PerformanceMetrics {
  averageResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
}

export interface UsageMetrics {
  activeUsers: number;
  apiCalls: number;
  pluginsInstalled: number;
  workflowsExecuted: number;
}

export interface Metrics {
  timestamp: string;
  timerange: string;
  data: {
    system?: SystemMetrics;
    performance?: PerformanceMetrics;
    usage?: UsageMetrics;
  };
}

// Notification Types
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  read: boolean;
  createdAt: string;
  metadata?: Record<string, any>;
}

export interface NotificationRequest {
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  recipientId?: string;
  metadata?: Record<string, any>;
}

// Search Types
export interface SearchResult {
  id: string;
  title: string;
  description?: string;
  type: string;
  url?: string;
  score: number;
  metadata?: Record<string, any>;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  took: number;
}

// WebSocket Types
export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: string;
}

export interface WebSocketEvent {
  event: string;
  data: any;
}

// Authentication Types
export interface AuthConfig {
  apiKey?: string;
  bearerToken?: string;
  refreshToken?: string;
  baseURL: string;
  timeout?: number;
}

// Client Configuration
export interface ClientConfig {
  baseURL: string;
  apiKey?: string;
  bearerToken?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  circuitBreakerOptions?: {
    threshold: number;
    timeout: number;
    resetTimeout: number;
  };
  rateLimit?: {
    requests: number;
    window: number;
  };
}

// Error Types
export interface SDKError {
  code: string;
  message: string;
  details?: Record<string, any>;
  status?: number;
  timestamp: string;
}

// Request Options
export interface RequestOptions {
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

// GraphQL Types
export interface GraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: Array<string | number>;
  }>;
}

export interface GraphQLRequest {
  query: string;
  variables?: Record<string, any>;
  operationName?: string;
}

// Webhook Types
export interface WebhookEvent {
  id: string;
  type: string;
  source: string;
  timestamp: string;
  data: Record<string, any>;
}

export interface WebhookHandler {
  eventType: string;
  handler: (event: WebhookEvent) => Promise<void> | void;
}

// Filter and Query Types
export interface QueryParams {
  search?: string;
  category?: string;
  status?: string;
  limit?: number;
  offset?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

// Batch Operation Types
export interface BatchRequest<T> {
  operations: Array<{
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    path: string;
    data?: T;
  }>;
}

export interface BatchResponse {
  results: Array<{
    status: number;
    data?: any;
    error?: string;
  }>;
}

// Export all types as a namespace
export * from './api';
export * from './events';