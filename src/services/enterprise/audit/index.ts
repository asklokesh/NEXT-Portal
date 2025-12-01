/**
 * Audit Logging Service
 * Enterprise audit trail and compliance reporting
 */

export { AuditService, getAuditService } from './AuditService';
export type {
  // Core types
  AuditEvent,
  AuditEventType,
  AuditCategory,
  AuditSeverity,
  AuditOutcome,

  // Actor and target types
  AuditActor,
  ActorType,
  AuditTarget,
  TargetType,

  // Detail types
  AuditDetails,
  AuditChange,
  AuditRequest,
  AuditResponse,
  AuditError,

  // Metadata types
  AuditMetadata,
  AuditRetention,

  // Query types
  AuditQuery,
  AuditQueryResult,
  AuditAggregations,

  // Export types
  AuditExportConfig,
  ExportDestination,
  ExportSchedule,
  ExportEncryption,
  AuditExport,

  // Alert types
  AuditAlert,
  AuditAlertCondition,
  AuditAlertAction,
  AuditAlertTriggered,

  // Compliance types
  ComplianceReport,
  ComplianceReportType,
  ComplianceFramework,
  ComplianceReportSummary,
  ComplianceReportSection,
  ComplianceFinding,
  ComplianceChart,
} from './types';
