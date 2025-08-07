/**
 * Governance Services Index
 * Exports all governance and compliance automation components
 */

// Core Services
export { PolicyEngine, PolicyBuilder, PolicyDefinitionSchema } from './policy-engine';
export { 
  ComplianceAutomationService, 
  ComplianceFramework,
  type ComplianceAssessment,
  type ControlMapping,
  type Evidence,
  type ComplianceGap
} from './compliance-automation';
export { 
  SecurityGovernanceService,
  type SecurityPolicy,
  type VulnerabilityReport,
  type VulnerabilityFinding,
  type RemediationPlan,
  type AccessPolicy,
  type ContainerSecurityProfile,
  type SecurityMetrics
} from './security-governance';
export { 
  QualityGatesService,
  type QualityGate,
  type QualityGateExecution,
  type ArchitectureReview,
  type PerformanceStandards,
  type DocumentationRequirement
} from './quality-gates';
export { 
  MonitoringReportingService,
  type Dashboard,
  type GovernanceMetrics,
  type Alert,
  type Report,
  type AuditLogEntry
} from './monitoring-reporting';
export { 
  IntegrationAPIService,
  type APIConfig,
  type WebhookConfig,
  type ExternalIntegration,
  type APIResponse
} from './integration-api';

// Main Orchestrator
export { 
  GovernanceOrchestrator as default,
  type GovernanceConfig,
  type GovernanceStatus,
  type GovernanceEvent
} from './governance-orchestrator';

// Utility function to create a complete governance system
import { GovernanceOrchestrator, GovernanceConfig } from './governance-orchestrator';

export function createGovernanceSystem(config: GovernanceConfig): GovernanceOrchestrator {
  return new GovernanceOrchestrator(config);
}

// Default configuration template
export const defaultGovernanceConfig: Partial<GovernanceConfig> = {
  api: {
    version: 'v1',
    basePath: '/api/governance',
    rateLimit: {
      windowMs: 900000, // 15 minutes
      maxRequests: 1000,
      skipSuccessfulRequests: false
    },
    authentication: {
      required: true,
      methods: ['bearer'],
    },
    cors: {
      enabled: true,
      origins: ['*'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      headers: ['Content-Type', 'Authorization']
    },
    webhooks: {
      enabled: true,
      timeout: 30000,
      retries: 3
    }
  },
  compliance: {
    frameworks: ['gdpr', 'hipaa', 'soc2', 'pci-dss', 'iso27001'] as any,
    assessmentSchedule: '0 2 * * 1', // Weekly at 2 AM Monday
    reportRetentionDays: 2555 // 7 years
  },
  security: {
    scanners: {},
    policies: {
      enforceNonRoot: true,
      enforceReadOnlyFs: true,
      blockPrivileged: true
    }
  },
  qualityGates: {
    defaultTimeout: 1800, // 30 minutes
    retryPolicy: {
      maxRetries: 3,
      backoffMultiplier: 1.5
    }
  },
  monitoring: {
    collectionInterval: 300, // 5 minutes
    retentionDays: 90,
    notifications: {
      email: { enabled: false },
      slack: { enabled: false },
      webhook: { enabled: false }
    }
  }
};

// Export types for external use
export type {
  GovernanceConfig,
  GovernanceStatus,
  GovernanceEvent
} from './governance-orchestrator';

export type {
  PolicyDefinition,
  PolicyContext,
  PolicyEvaluationResult
} from './policy-engine';

export type {
  ComplianceAssessment,
  ControlMapping,
  Evidence,
  ComplianceGap,
  RemediationAction as ComplianceRemediationAction
} from './compliance-automation';

export type {
  SecurityPolicy,
  VulnerabilityReport,
  VulnerabilityFinding,
  RemediationPlan,
  RemediationAction as SecurityRemediationAction,
  AccessPolicy,
  AccessRule,
  AccessEvent,
  ContainerSecurityProfile,
  SecurityMetrics
} from './security-governance';

export type {
  QualityGate,
  QualityGateExecution,
  QualityGateResult,
  ArchitectureReview,
  ArchitectureReviewCriteria,
  PerformanceStandards,
  PerformanceReport,
  DocumentationRequirement,
  DocumentationCheck
} from './quality-gates';

export type {
  MonitoringConfig,
  Dashboard,
  DashboardWidget,
  GovernanceMetrics,
  Alert,
  AlertRule,
  Report,
  ReportData,
  AuditLogEntry
} from './monitoring-reporting';

export type {
  APIConfig,
  WebhookConfig,
  WebhookEvent,
  ExternalIntegration,
  APIResponse,
  PaginatedResponse
} from './integration-api';