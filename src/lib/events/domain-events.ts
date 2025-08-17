/**
 * Domain Events for Enterprise Platform
 * Defines all business events that occur in the platform
 */

import { EventMessage } from './event-bus';

// Base domain event interface
export interface DomainEvent extends Omit<EventMessage, 'id' | 'timestamp'> {
  aggregateId: string;
  aggregateType: string;
  eventVersion: number;
}

// Plugin Events
export interface PluginInstalledEvent extends DomainEvent {
  type: 'plugin.installed';
  data: {
    pluginId: string;
    version: string;
    installedBy: string;
    installationMethod: 'marketplace' | 'manual' | 'automated';
    configuration?: Record<string, any>;
    dependencies: string[];
  };
}

export interface PluginUninstalledEvent extends DomainEvent {
  type: 'plugin.uninstalled';
  data: {
    pluginId: string;
    version: string;
    uninstalledBy: string;
    reason: string;
    cleanupCompleted: boolean;
  };
}

export interface PluginUpdatedEvent extends DomainEvent {
  type: 'plugin.updated';
  data: {
    pluginId: string;
    fromVersion: string;
    toVersion: string;
    updatedBy: string;
    updateMethod: 'automatic' | 'manual';
    migrationRequired: boolean;
  };
}

export interface PluginHealthChangedEvent extends DomainEvent {
  type: 'plugin.health_changed';
  data: {
    pluginId: string;
    previousStatus: string;
    currentStatus: string;
    healthScore: number;
    metrics: Record<string, number>;
    alertLevel: 'info' | 'warning' | 'error' | 'critical';
  };
}

// User Events
export interface UserRegisteredEvent extends DomainEvent {
  type: 'user.registered';
  data: {
    userId: string;
    email: string;
    name: string;
    registrationMethod: 'email' | 'google' | 'github' | 'sso';
    tenantId?: string;
    invitationToken?: string;
  };
}

export interface UserLoggedInEvent extends DomainEvent {
  type: 'user.logged_in';
  data: {
    userId: string;
    sessionId: string;
    loginMethod: 'password' | 'google' | 'github' | 'sso';
    clientIP: string;
    userAgent: string;
    location?: {
      country: string;
      city: string;
    };
  };
}

export interface UserPermissionChangedEvent extends DomainEvent {
  type: 'user.permission_changed';
  data: {
    userId: string;
    tenantId: string;
    changedBy: string;
    previousRoles: string[];
    newRoles: string[];
    previousPermissions: string[];
    newPermissions: string[];
    effectiveAt: Date;
  };
}

// Tenant Events
export interface TenantCreatedEvent extends DomainEvent {
  type: 'tenant.created';
  data: {
    tenantId: string;
    name: string;
    slug: string;
    tier: string;
    ownerId: string;
    dataResidency: string;
    complianceLevel: string;
    isolationMode: string;
  };
}

export interface TenantSuspendedEvent extends DomainEvent {
  type: 'tenant.suspended';
  data: {
    tenantId: string;
    suspendedBy: string;
    reason: string;
    suspensionType: 'billing' | 'compliance' | 'abuse' | 'maintenance';
    expectedResolution?: Date;
  };
}

export interface TenantDataExportedEvent extends DomainEvent {
  type: 'tenant.data_exported';
  data: {
    tenantId: string;
    exportId: string;
    requestedBy: string;
    exportType: 'full' | 'partial' | 'gdpr';
    dataTypes: string[];
    exportFormat: 'json' | 'csv' | 'sql';
    fileSize: number;
    downloadUrl: string;
    expiresAt: Date;
  };
}

// Billing Events
export interface BillingCycleStartedEvent extends DomainEvent {
  type: 'billing.cycle_started';
  data: {
    tenantId: string;
    billingPeriodId: string;
    periodStart: Date;
    periodEnd: Date;
    plan: string;
    estimatedCost: number;
  };
}

export interface UsageRecordedEvent extends DomainEvent {
  type: 'billing.usage_recorded';
  data: {
    tenantId: string;
    metricName: string;
    metricValue: number;
    unit: string;
    recordedAt: Date;
    cost: number;
    metadata?: Record<string, any>;
  };
}

export interface PaymentProcessedEvent extends DomainEvent {
  type: 'billing.payment_processed';
  data: {
    tenantId: string;
    paymentId: string;
    amount: number;
    currency: string;
    paymentMethod: string;
    status: 'succeeded' | 'failed' | 'pending';
    failureReason?: string;
    invoiceId?: string;
  };
}

// Security Events
export interface SecurityIncidentDetectedEvent extends DomainEvent {
  type: 'security.incident_detected';
  data: {
    incidentId: string;
    incidentType: 'unauthorized_access' | 'data_breach' | 'malware' | 'ddos' | 'privilege_escalation';
    severity: 'low' | 'medium' | 'high' | 'critical';
    affectedAssets: string[];
    sourceIP?: string;
    userId?: string;
    tenantId?: string;
    detectionMethod: string;
    evidence: Record<string, any>;
  };
}

export interface ComplianceViolationEvent extends DomainEvent {
  type: 'security.compliance_violation';
  data: {
    violationId: string;
    complianceFramework: 'GDPR' | 'SOC2' | 'HIPAA' | 'PCI_DSS';
    violationType: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    tenantId: string;
    description: string;
    evidence: string[];
    remediation: string[];
    dueDate?: Date;
  };
}

// System Events
export interface ServiceStartedEvent extends DomainEvent {
  type: 'system.service_started';
  data: {
    serviceName: string;
    version: string;
    region: string;
    instanceId: string;
    healthStatus: string;
    dependencies: string[];
  };
}

export interface ServiceFailedEvent extends DomainEvent {
  type: 'system.service_failed';
  data: {
    serviceName: string;
    instanceId: string;
    errorMessage: string;
    errorStack?: string;
    lastHealthCheck: Date;
    failureCount: number;
    autoRecovery: boolean;
  };
}

export interface BackupCompletedEvent extends DomainEvent {
  type: 'system.backup_completed';
  data: {
    backupId: string;
    backupType: 'full' | 'incremental' | 'differential';
    dataSize: number;
    duration: number;
    location: string;
    encryption: boolean;
    retention: number; // days
    tenantIds?: string[];
  };
}

// Analytics Events
export interface AnalyticsEventRecorded extends DomainEvent {
  type: 'analytics.event_recorded';
  data: {
    eventName: string;
    properties: Record<string, any>;
    userId?: string;
    sessionId?: string;
    timestamp: Date;
    source: string;
    platform: string;
    version: string;
  };
}

export interface FeatureUsageTrackedEvent extends DomainEvent {
  type: 'analytics.feature_usage_tracked';
  data: {
    featureName: string;
    userId: string;
    tenantId: string;
    usageType: 'view' | 'click' | 'complete' | 'error';
    duration?: number;
    context: Record<string, any>;
  };
}

// Workflow Events
export interface WorkflowStartedEvent extends DomainEvent {
  type: 'workflow.started';
  data: {
    workflowId: string;
    workflowType: string;
    triggeredBy: string;
    triggerType: 'manual' | 'scheduled' | 'event' | 'webhook';
    input: Record<string, any>;
    expectedDuration?: number;
  };
}

export interface WorkflowCompletedEvent extends DomainEvent {
  type: 'workflow.completed';
  data: {
    workflowId: string;
    status: 'success' | 'failed' | 'cancelled';
    duration: number;
    output?: Record<string, any>;
    errorMessage?: string;
    stepsCompleted: number;
    totalSteps: number;
  };
}

// Integration Events
export interface IntegrationConnectedEvent extends DomainEvent {
  type: 'integration.connected';
  data: {
    integrationId: string;
    integrationType: string;
    tenantId: string;
    connectedBy: string;
    configuration: Record<string, any>;
    permissions: string[];
    healthStatus: string;
  };
}

export interface IntegrationSyncCompletedEvent extends DomainEvent {
  type: 'integration.sync_completed';
  data: {
    integrationId: string;
    syncType: 'full' | 'incremental';
    itemsProcessed: number;
    itemsCreated: number;
    itemsUpdated: number;
    itemsDeleted: number;
    errors: number;
    duration: number;
  };
}

// Export all event types for type checking
export type PlatformDomainEvent = 
  | PluginInstalledEvent
  | PluginUninstalledEvent
  | PluginUpdatedEvent
  | PluginHealthChangedEvent
  | UserRegisteredEvent
  | UserLoggedInEvent
  | UserPermissionChangedEvent
  | TenantCreatedEvent
  | TenantSuspendedEvent
  | TenantDataExportedEvent
  | BillingCycleStartedEvent
  | UsageRecordedEvent
  | PaymentProcessedEvent
  | SecurityIncidentDetectedEvent
  | ComplianceViolationEvent
  | ServiceStartedEvent
  | ServiceFailedEvent
  | BackupCompletedEvent
  | AnalyticsEventRecorded
  | FeatureUsageTrackedEvent
  | WorkflowStartedEvent
  | WorkflowCompletedEvent
  | IntegrationConnectedEvent
  | IntegrationSyncCompletedEvent;

// Event type constants
export const EventTypes = {
  // Plugin Events
  PLUGIN_INSTALLED: 'plugin.installed',
  PLUGIN_UNINSTALLED: 'plugin.uninstalled',
  PLUGIN_UPDATED: 'plugin.updated',
  PLUGIN_HEALTH_CHANGED: 'plugin.health_changed',

  // User Events
  USER_REGISTERED: 'user.registered',
  USER_LOGGED_IN: 'user.logged_in',
  USER_PERMISSION_CHANGED: 'user.permission_changed',

  // Tenant Events
  TENANT_CREATED: 'tenant.created',
  TENANT_SUSPENDED: 'tenant.suspended',
  TENANT_DATA_EXPORTED: 'tenant.data_exported',

  // Billing Events
  BILLING_CYCLE_STARTED: 'billing.cycle_started',
  USAGE_RECORDED: 'billing.usage_recorded',
  PAYMENT_PROCESSED: 'billing.payment_processed',

  // Security Events
  SECURITY_INCIDENT_DETECTED: 'security.incident_detected',
  COMPLIANCE_VIOLATION: 'security.compliance_violation',

  // System Events
  SERVICE_STARTED: 'system.service_started',
  SERVICE_FAILED: 'system.service_failed',
  BACKUP_COMPLETED: 'system.backup_completed',

  // Analytics Events
  ANALYTICS_EVENT_RECORDED: 'analytics.event_recorded',
  FEATURE_USAGE_TRACKED: 'analytics.feature_usage_tracked',

  // Workflow Events
  WORKFLOW_STARTED: 'workflow.started',
  WORKFLOW_COMPLETED: 'workflow.completed',

  // Integration Events
  INTEGRATION_CONNECTED: 'integration.connected',
  INTEGRATION_SYNC_COMPLETED: 'integration.sync_completed'
} as const;