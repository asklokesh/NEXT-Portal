// Event system types for WebSocket and webhook handlers

export type EventType = 
  | 'plugin.installed'
  | 'plugin.uninstalled'
  | 'plugin.updated'
  | 'workflow.started'
  | 'workflow.completed'
  | 'workflow.failed'
  | 'tenant.created'
  | 'tenant.updated'
  | 'notification.created'
  | 'system.health_change'
  | 'user.login'
  | 'user.logout'
  | 'metrics.threshold_exceeded';

export interface BaseEvent {
  id: string;
  type: EventType;
  timestamp: string;
  source: string;
  tenantId?: string;
  userId?: string;
}

export interface PluginInstalledEvent extends BaseEvent {
  type: 'plugin.installed';
  data: {
    pluginId: string;
    pluginName: string;
    version: string;
    installationId: string;
  };
}

export interface PluginUninstalledEvent extends BaseEvent {
  type: 'plugin.uninstalled';
  data: {
    pluginId: string;
    pluginName: string;
  };
}

export interface PluginUpdatedEvent extends BaseEvent {
  type: 'plugin.updated';
  data: {
    pluginId: string;
    pluginName: string;
    fromVersion: string;
    toVersion: string;
  };
}

export interface WorkflowStartedEvent extends BaseEvent {
  type: 'workflow.started';
  data: {
    workflowId: string;
    workflowName: string;
    executionId: string;
  };
}

export interface WorkflowCompletedEvent extends BaseEvent {
  type: 'workflow.completed';
  data: {
    workflowId: string;
    workflowName: string;
    executionId: string;
    duration: number;
    result: Record<string, any>;
  };
}

export interface WorkflowFailedEvent extends BaseEvent {
  type: 'workflow.failed';
  data: {
    workflowId: string;
    workflowName: string;
    executionId: string;
    error: string;
    failedStep?: string;
  };
}

export interface TenantCreatedEvent extends BaseEvent {
  type: 'tenant.created';
  data: {
    tenantId: string;
    tenantName: string;
    domain: string;
    ownerId: string;
  };
}

export interface TenantUpdatedEvent extends BaseEvent {
  type: 'tenant.updated';
  data: {
    tenantId: string;
    tenantName: string;
    changes: Record<string, any>;
  };
}

export interface NotificationCreatedEvent extends BaseEvent {
  type: 'notification.created';
  data: {
    notificationId: string;
    title: string;
    type: 'info' | 'warning' | 'error' | 'success';
    recipientId?: string;
  };
}

export interface SystemHealthChangeEvent extends BaseEvent {
  type: 'system.health_change';
  data: {
    service: string;
    fromStatus: 'ok' | 'degraded' | 'error';
    toStatus: 'ok' | 'degraded' | 'error';
    message: string;
  };
}

export interface UserLoginEvent extends BaseEvent {
  type: 'user.login';
  data: {
    userId: string;
    userEmail: string;
    ipAddress: string;
    userAgent: string;
  };
}

export interface UserLogoutEvent extends BaseEvent {
  type: 'user.logout';
  data: {
    userId: string;
    sessionDuration: number;
  };
}

export interface MetricsThresholdExceededEvent extends BaseEvent {
  type: 'metrics.threshold_exceeded';
  data: {
    metric: string;
    value: number;
    threshold: number;
    severity: 'warning' | 'critical';
  };
}

export type AnyEvent = 
  | PluginInstalledEvent
  | PluginUninstalledEvent
  | PluginUpdatedEvent
  | WorkflowStartedEvent
  | WorkflowCompletedEvent
  | WorkflowFailedEvent
  | TenantCreatedEvent
  | TenantUpdatedEvent
  | NotificationCreatedEvent
  | SystemHealthChangeEvent
  | UserLoginEvent
  | UserLogoutEvent
  | MetricsThresholdExceededEvent;

// Event handler types
export type EventHandler<T extends AnyEvent = AnyEvent> = (event: T) => Promise<void> | void;

export interface EventSubscription {
  id: string;
  eventType: EventType | EventType[];
  handler: EventHandler;
  options?: {
    once?: boolean;
    priority?: number;
  };
}

// WebSocket message types
export interface WebSocketMessage {
  type: 'event' | 'command' | 'response' | 'error';
  payload: any;
  id?: string;
  timestamp: string;
}

export interface WebSocketEventMessage extends WebSocketMessage {
  type: 'event';
  payload: AnyEvent;
}

export interface WebSocketCommandMessage extends WebSocketMessage {
  type: 'command';
  payload: {
    command: string;
    data?: any;
  };
}

export interface WebSocketResponseMessage extends WebSocketMessage {
  type: 'response';
  payload: {
    requestId: string;
    data: any;
    success: boolean;
    error?: string;
  };
}

export interface WebSocketErrorMessage extends WebSocketMessage {
  type: 'error';
  payload: {
    code: string;
    message: string;
    details?: any;
  };
}