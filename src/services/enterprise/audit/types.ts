/**
 * Audit Logging Types
 * Comprehensive audit trail for enterprise compliance
 */

// ============================================================================
// Core Audit Event Types
// ============================================================================

export interface AuditEvent {
  id: string;
  timestamp: string;
  eventType: AuditEventType;
  category: AuditCategory;
  severity: AuditSeverity;
  actor: AuditActor;
  target: AuditTarget;
  action: string;
  outcome: AuditOutcome;
  details: AuditDetails;
  metadata: AuditMetadata;
}

export type AuditEventType =
  // Authentication events
  | 'auth.login'
  | 'auth.logout'
  | 'auth.login_failed'
  | 'auth.password_change'
  | 'auth.mfa_enabled'
  | 'auth.mfa_disabled'
  | 'auth.session_revoked'
  | 'auth.api_key_created'
  | 'auth.api_key_revoked'
  // Authorization events
  | 'authz.permission_granted'
  | 'authz.permission_denied'
  | 'authz.role_assigned'
  | 'authz.role_revoked'
  | 'authz.access_requested'
  | 'authz.access_approved'
  | 'authz.access_denied'
  // Resource events
  | 'resource.created'
  | 'resource.updated'
  | 'resource.deleted'
  | 'resource.viewed'
  | 'resource.exported'
  | 'resource.imported'
  // User management events
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'user.suspended'
  | 'user.activated'
  | 'user.group_added'
  | 'user.group_removed'
  // Configuration events
  | 'config.updated'
  | 'config.integration_added'
  | 'config.integration_removed'
  | 'config.policy_created'
  | 'config.policy_updated'
  | 'config.policy_deleted'
  // Action events
  | 'action.executed'
  | 'action.failed'
  | 'action.approved'
  | 'action.rejected'
  // Template events
  | 'template.executed'
  | 'template.created'
  | 'template.updated'
  | 'template.deleted'
  // System events
  | 'system.startup'
  | 'system.shutdown'
  | 'system.error'
  | 'system.backup'
  | 'system.restore';

export type AuditCategory =
  | 'authentication'
  | 'authorization'
  | 'resource'
  | 'user_management'
  | 'configuration'
  | 'action'
  | 'template'
  | 'system'
  | 'compliance'
  | 'security';

export type AuditSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type AuditOutcome = 'success' | 'failure' | 'error' | 'denied' | 'pending';

// ============================================================================
// Actor and Target Types
// ============================================================================

export interface AuditActor {
  type: ActorType;
  id: string;
  displayName?: string;
  email?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  impersonatedBy?: string;
}

export type ActorType = 'user' | 'service_account' | 'api_key' | 'system' | 'anonymous';

export interface AuditTarget {
  type: TargetType;
  id: string;
  name?: string;
  kind?: string;
  namespace?: string;
  path?: string;
}

export type TargetType =
  | 'entity'
  | 'user'
  | 'group'
  | 'role'
  | 'policy'
  | 'template'
  | 'action'
  | 'integration'
  | 'api_key'
  | 'setting'
  | 'system';

// ============================================================================
// Audit Details Types
// ============================================================================

export interface AuditDetails {
  description: string;
  changes?: AuditChange[];
  request?: AuditRequest;
  response?: AuditResponse;
  error?: AuditError;
  context?: Record<string, any>;
}

export interface AuditChange {
  field: string;
  oldValue?: any;
  newValue?: any;
  operation: 'add' | 'remove' | 'modify';
}

export interface AuditRequest {
  method: string;
  path: string;
  query?: Record<string, string>;
  body?: Record<string, any>;
  headers?: Record<string, string>;
}

export interface AuditResponse {
  statusCode: number;
  body?: Record<string, any>;
  duration?: number;
}

export interface AuditError {
  code: string;
  message: string;
  stack?: string;
}

// ============================================================================
// Audit Metadata Types
// ============================================================================

export interface AuditMetadata {
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  requestId?: string;
  tenantId?: string;
  organizationId?: string;
  environment?: string;
  version?: string;
  source?: string;
  tags?: string[];
  retention?: AuditRetention;
}

export interface AuditRetention {
  policy: 'standard' | 'extended' | 'permanent';
  expiresAt?: string;
  reason?: string;
}

// ============================================================================
// Audit Query Types
// ============================================================================

export interface AuditQuery {
  startTime?: string;
  endTime?: string;
  eventTypes?: AuditEventType[];
  categories?: AuditCategory[];
  severities?: AuditSeverity[];
  outcomes?: AuditOutcome[];
  actorIds?: string[];
  actorTypes?: ActorType[];
  targetIds?: string[];
  targetTypes?: TargetType[];
  searchText?: string;
  correlationId?: string;
  tenantId?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'timestamp' | 'severity' | 'eventType';
  sortOrder?: 'asc' | 'desc';
}

export interface AuditQueryResult {
  items: AuditEvent[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  aggregations?: AuditAggregations;
}

export interface AuditAggregations {
  byEventType: Record<string, number>;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  byOutcome: Record<string, number>;
  byActor: Array<{ id: string; name: string; count: number }>;
  byHour: Array<{ hour: string; count: number }>;
}

// ============================================================================
// Audit Export Types
// ============================================================================

export interface AuditExportConfig {
  format: 'json' | 'csv' | 'parquet';
  query: AuditQuery;
  destination: ExportDestination;
  schedule?: ExportSchedule;
  encryption?: ExportEncryption;
}

export interface ExportDestination {
  type: 's3' | 'gcs' | 'azure-blob' | 'sftp' | 'webhook';
  config: Record<string, any>;
}

export interface ExportSchedule {
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  timezone: string;
  time?: string; // HH:mm format
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
}

export interface ExportEncryption {
  enabled: boolean;
  algorithm?: 'AES-256' | 'AES-128';
  keyId?: string;
}

export interface AuditExport {
  id: string;
  config: AuditExportConfig;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress?: number;
  result?: {
    recordCount: number;
    fileSize: number;
    filePath: string;
    downloadUrl?: string;
    expiresAt?: string;
  };
  error?: AuditError;
  createdAt: string;
  completedAt?: string;
}

// ============================================================================
// Audit Alert Types
// ============================================================================

export interface AuditAlert {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  conditions: AuditAlertCondition[];
  actions: AuditAlertAction[];
  cooldown?: number; // Minutes between alerts
  metadata: {
    createdBy: string;
    createdAt: string;
    updatedAt: string;
  };
}

export interface AuditAlertCondition {
  type: 'event_type' | 'severity' | 'outcome' | 'frequency' | 'pattern';
  operator: 'eq' | 'neq' | 'in' | 'gt' | 'lt' | 'matches';
  value: any;
  window?: number; // Time window in minutes for frequency conditions
}

export interface AuditAlertAction {
  type: 'email' | 'slack' | 'webhook' | 'pagerduty' | 'opsgenie';
  config: Record<string, any>;
}

export interface AuditAlertTriggered {
  id: string;
  alertId: string;
  triggeredAt: string;
  matchingEvents: string[]; // Event IDs
  notificationsSent: Array<{
    channel: string;
    status: 'sent' | 'failed';
    error?: string;
  }>;
}

// ============================================================================
// Compliance Report Types
// ============================================================================

export interface ComplianceReport {
  id: string;
  type: ComplianceReportType;
  framework: ComplianceFramework;
  period: {
    start: string;
    end: string;
  };
  status: 'generating' | 'completed' | 'failed';
  summary: ComplianceReportSummary;
  sections: ComplianceReportSection[];
  metadata: {
    generatedAt: string;
    generatedBy: string;
    version: string;
  };
}

export type ComplianceReportType =
  | 'access_review'
  | 'activity_summary'
  | 'security_incidents'
  | 'data_access'
  | 'privileged_access'
  | 'full_audit';

export type ComplianceFramework =
  | 'SOC2'
  | 'GDPR'
  | 'HIPAA'
  | 'PCI-DSS'
  | 'ISO27001'
  | 'FedRAMP'
  | 'custom';

export interface ComplianceReportSummary {
  totalEvents: number;
  uniqueUsers: number;
  uniqueResources: number;
  securityIncidents: number;
  policyViolations: number;
  highlights: string[];
}

export interface ComplianceReportSection {
  title: string;
  description?: string;
  findings: ComplianceFinding[];
  charts?: ComplianceChart[];
}

export interface ComplianceFinding {
  id: string;
  severity: AuditSeverity;
  title: string;
  description: string;
  recommendation?: string;
  evidence: string[];
  status: 'open' | 'acknowledged' | 'resolved';
}

export interface ComplianceChart {
  type: 'bar' | 'line' | 'pie' | 'table';
  title: string;
  data: any[];
}
