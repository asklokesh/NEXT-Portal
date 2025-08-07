/**
 * Advanced ABAC Permission Framework v2 Types
 * Enterprise-grade attribute-based access control with zero-trust architecture
 */

import { User } from '@prisma/client';

// Core ABAC Attributes
export interface SubjectAttributes {
  id: string;
  email: string;
  roles: string[];
  department: string;
  clearanceLevel: number;
  location: GeoLocation;
  deviceTrust: DeviceTrustLevel;
  temporaryAccess?: TemporaryAccess[];
  customAttributes: Record<string, any>;
  riskScore: number;
  lastActiveAt: Date;
  mfaVerified: boolean;
  activeSessionCount: number;
}

export interface ResourceAttributes {
  id: string;
  type: ResourceType;
  classification: SecurityClassification;
  owner: string;
  sensitivity: SensitivityLevel;
  businessCriticality: BusinessCriticality;
  complianceRequirements: ComplianceRequirement[];
  customAttributes: Record<string, any>;
  lastModified: Date;
  accessHistory: AccessHistoryEntry[];
}

export interface EnvironmentAttributes {
  requestTime: Date;
  location: GeoLocation;
  network: NetworkContext;
  device: DeviceContext;
  session: SessionContext;
  riskFactors: RiskFactor[];
  complianceContext: ComplianceContext;
  businessHours: boolean;
  emergencyMode: boolean;
}

export interface ActionAttributes {
  type: ActionType;
  riskLevel: RiskLevel;
  requiresMfa: boolean;
  auditRequired: boolean;
  businessJustificationRequired: boolean;
  approvalRequired: boolean;
  reversible: boolean;
  dataExposure: DataExposureLevel;
}

// Advanced Types
export interface GeoLocation {
  country: string;
  region: string;
  city: string;
  coordinates?: [number, number];
  timezone: string;
  isHighRiskLocation: boolean;
}

export interface DeviceContext {
  id: string;
  type: DeviceType;
  trustLevel: DeviceTrustLevel;
  isManaged: boolean;
  lastSecurityScan: Date;
  compliance: DeviceComplianceStatus;
  biometricCapable: boolean;
}

export interface NetworkContext {
  ip: string;
  type: NetworkType;
  trustLevel: NetworkTrustLevel;
  vpnUsed: boolean;
  proxyUsed: boolean;
  threatIntelligence: ThreatIntelligenceResult;
}

export interface SessionContext {
  id: string;
  startTime: Date;
  lastActivity: Date;
  mfaLevel: MfaLevel;
  stepUpAuthRequired: boolean;
  riskAssessment: SessionRiskAssessment;
}

// Enums
export enum SecurityClassification {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  RESTRICTED = 'restricted',
  TOP_SECRET = 'top_secret'
}

export enum SensitivityLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum BusinessCriticality {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  MISSION_CRITICAL = 'mission_critical'
}

export enum DeviceType {
  DESKTOP = 'desktop',
  LAPTOP = 'laptop',
  MOBILE = 'mobile',
  TABLET = 'tablet',
  SERVER = 'server'
}

export enum DeviceTrustLevel {
  UNKNOWN = 'unknown',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  TRUSTED = 'trusted'
}

export enum NetworkType {
  CORPORATE = 'corporate',
  HOME = 'home',
  PUBLIC = 'public',
  MOBILE = 'mobile',
  UNKNOWN = 'unknown'
}

export enum NetworkTrustLevel {
  UNTRUSTED = 'untrusted',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  TRUSTED = 'trusted'
}

export enum MfaLevel {
  NONE = 'none',
  SMS = 'sms',
  APP = 'app',
  HARDWARE = 'hardware',
  BIOMETRIC = 'biometric'
}

export enum RiskLevel {
  VERY_LOW = 'very_low',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum DataExposureLevel {
  NONE = 'none',
  MINIMAL = 'minimal',
  MODERATE = 'moderate',
  HIGH = 'high',
  MASSIVE = 'massive'
}

export enum ActionType {
  READ = 'read',
  write = 'write',
  delete = 'delete',
  execute = 'execute',
  approve = 'approve',
  export = 'export',
  import = 'import',
  share = 'share',
  modify_permissions = 'modify_permissions',
  emergency_access = 'emergency_access'
}

export enum ResourceType {
  catalog = 'catalog',
  entity = 'entity',
  template = 'template',
  plugin = 'plugin',
  user = 'user',
  role = 'role',
  policy = 'policy',
  audit = 'audit',
  configuration = 'configuration',
  secret = 'secret',
  credential = 'credential',
  api_key = 'api_key',
  certificate = 'certificate',
  workflow = 'workflow',
  deployment = 'deployment',
  monitoring = 'monitoring',
  cost = 'cost',
  compliance_report = 'compliance_report',
  security_scan = 'security_scan'
}

// ABAC Policy Types
export interface ABACPolicy {
  id: string;
  name: string;
  description: string;
  version: string;
  priority: number;
  effect: PolicyEffect;
  rules: PolicyRule[];
  conditions: PolicyCondition[];
  obligations?: PolicyObligation[];
  isActive: boolean;
  validFrom: Date;
  validTo?: Date;
  createdBy: string;
  createdAt: Date;
  lastModified: Date;
  tags: string[];
  metadata: Record<string, any>;
}

export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  subject: AttributeExpression;
  resource: AttributeExpression;
  action: AttributeExpression;
  environment: AttributeExpression;
  effect: PolicyEffect;
  confidence: number;
}

export interface PolicyCondition {
  id: string;
  expression: string;
  type: ConditionType;
  parameters: Record<string, any>;
  dynamicEvaluation: boolean;
}

export interface PolicyObligation {
  id: string;
  type: ObligationType;
  action: string;
  parameters: Record<string, any>;
  fulfillmentRequired: boolean;
}

export interface AttributeExpression {
  field: string;
  operator: ComparisonOperator;
  value: any;
  valueType: ValueType;
  dynamicValue?: DynamicValueExpression;
}

export interface DynamicValueExpression {
  source: ValueSource;
  expression: string;
  cacheSeconds?: number;
}

export enum PolicyEffect {
  PERMIT = 'permit',
  DENY = 'deny',
  NOT_APPLICABLE = 'not_applicable',
  INDETERMINATE = 'indeterminate'
}

export enum ConditionType {
  TIME_RANGE = 'time_range',
  GEO_FENCE = 'geo_fence',
  BUSINESS_HOURS = 'business_hours',
  RISK_THRESHOLD = 'risk_threshold',
  CUSTOM_FUNCTION = 'custom_function',
  ML_PREDICTION = 'ml_prediction'
}

export enum ObligationType {
  AUDIT_LOG = 'audit_log',
  NOTIFICATION = 'notification',
  MFA_REQUIRED = 'mfa_required',
  APPROVAL_REQUIRED = 'approval_required',
  TIME_LIMIT = 'time_limit',
  DATA_MASKING = 'data_masking'
}

export enum ComparisonOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  GREATER_EQUAL = 'greater_equal',
  LESS_EQUAL = 'less_equal',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  IN = 'in',
  NOT_IN = 'not_in',
  MATCHES_REGEX = 'matches_regex',
  EXISTS = 'exists',
  NOT_EXISTS = 'not_exists',
  IS_SUBSET = 'is_subset',
  IS_SUPERSET = 'is_superset',
  INTERSECTS = 'intersects'
}

export enum ValueType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  ARRAY = 'array',
  OBJECT = 'object',
  DATE = 'date',
  REGEX = 'regex'
}

export enum ValueSource {
  CONTEXT = 'context',
  DATABASE = 'database',
  API = 'api',
  CALCULATED = 'calculated',
  EXTERNAL_SERVICE = 'external_service'
}

// Decision and Evaluation Types
export interface ABACDecision {
  decision: PolicyEffect;
  permit: boolean;
  reason: string;
  appliedPolicies: ABACPolicy[];
  evaluatedRules: PolicyRule[];
  obligations: PolicyObligation[];
  confidence: number;
  evaluationTime: number;
  riskScore: number;
  recommendations?: SecurityRecommendation[];
  nextReviewAt?: Date;
}

export interface SecurityRecommendation {
  type: RecommendationType;
  message: string;
  priority: Priority;
  actionRequired: boolean;
  autoRemediable: boolean;
}

export enum RecommendationType {
  MFA_UPGRADE = 'mfa_upgrade',
  DEVICE_COMPLIANCE = 'device_compliance',
  LOCATION_REVIEW = 'location_review',
  ACCESS_REVIEW = 'access_review',
  RISK_MITIGATION = 'risk_mitigation'
}

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Advanced Features
export interface TemporaryAccess {
  id: string;
  resource: ResourceAttributes;
  action: ActionType;
  grantedBy: string;
  grantedAt: Date;
  expiresAt: Date;
  justification: string;
  approvalChain: ApprovalRecord[];
}

export interface ApprovalRecord {
  approver: string;
  approvedAt: Date;
  justification: string;
  conditions?: string[];
}

export interface RiskFactor {
  type: RiskFactorType;
  severity: RiskLevel;
  description: string;
  detectedAt: Date;
  mitigated: boolean;
}

export enum RiskFactorType {
  ANOMALOUS_LOCATION = 'anomalous_location',
  UNUSUAL_TIME = 'unusual_time',
  HIGH_PRIVILEGE_REQUEST = 'high_privilege_request',
  MULTIPLE_FAILED_ATTEMPTS = 'multiple_failed_attempts',
  SUSPICIOUS_DEVICE = 'suspicious_device',
  THREAT_INTELLIGENCE_MATCH = 'threat_intelligence_match'
}

export interface ComplianceRequirement {
  framework: ComplianceFramework;
  requirement: string;
  description: string;
  mandatory: boolean;
}

export enum ComplianceFramework {
  SOX = 'sox',
  GDPR = 'gdpr',
  HIPAA = 'hipaa',
  PCI_DSS = 'pci_dss',
  SOC2 = 'soc2',
  ISO27001 = 'iso27001',
  NIST = 'nist'
}

export interface ComplianceContext {
  activeFrameworks: ComplianceFramework[];
  dataSubjectRights: boolean;
  auditMode: boolean;
  retentionPolicies: RetentionPolicy[];
}

export interface RetentionPolicy {
  dataType: string;
  retentionPeriod: number;
  deletionRequired: boolean;
}

export interface AccessHistoryEntry {
  userId: string;
  timestamp: Date;
  action: ActionType;
  granted: boolean;
  riskScore: number;
  anomalous: boolean;
}

export interface SessionRiskAssessment {
  score: number;
  factors: RiskFactor[];
  recommendedActions: string[];
  stepUpRequired: boolean;
}

export interface ThreatIntelligenceResult {
  malicious: boolean;
  reputation: number;
  categories: string[];
  lastSeen?: Date;
  confidence: number;
}

export interface DeviceComplianceStatus {
  compliant: boolean;
  lastCheck: Date;
  violations: ComplianceViolation[];
}

export interface ComplianceViolation {
  type: string;
  severity: RiskLevel;
  description: string;
  remediation: string;
}

// Zero Trust and Continuous Validation
export interface ZeroTrustContext {
  trustScore: number;
  verificationLevel: VerificationLevel;
  continuousValidationEnabled: boolean;
  lastValidation: Date;
  nextValidationDue: Date;
  validationFrequency: number;
}

export enum VerificationLevel {
  NONE = 'none',
  BASIC = 'basic',
  ENHANCED = 'enhanced',
  HIGH_ASSURANCE = 'high_assurance'
}

// JIT Access
export interface JITAccessRequest {
  id: string;
  userId: string;
  resource: ResourceAttributes;
  action: ActionType;
  justification: string;
  duration: number;
  approvalRequired: boolean;
  approvers?: string[];
  emergencyAccess: boolean;
  riskAssessment: JITRiskAssessment;
  status: JITAccessStatus;
}

export interface JITRiskAssessment {
  score: number;
  factors: RiskFactor[];
  autoApprovalEligible: boolean;
  maxDuration: number;
  conditions: string[];
}

export enum JITAccessStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  DENIED = 'denied',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  REVOKED = 'revoked'
}

// ML and AI Integration
export interface MLAnomalyDetection {
  enabled: boolean;
  model: string;
  version: string;
  confidence: number;
  lastTraining: Date;
  anomalyThreshold: number;
  features: MLFeature[];
}

export interface MLFeature {
  name: string;
  type: string;
  importance: number;
  value: any;
}

// Performance and Caching
export interface PermissionCacheEntry {
  key: string;
  decision: ABACDecision;
  attributes: AttributeSnapshot;
  expiresAt: Date;
  invalidationTriggers: string[];
}

export interface AttributeSnapshot {
  subject: SubjectAttributes;
  resource: ResourceAttributes;
  environment: EnvironmentAttributes;
  action: ActionAttributes;
}

// Policy as Code
export interface PolicyVersion {
  id: string;
  version: string;
  policies: ABACPolicy[];
  checksum: string;
  deployedAt: Date;
  deployedBy: string;
  gitCommit?: string;
  testing: PolicyTestResults;
}

export interface PolicyTestResults {
  passed: number;
  failed: number;
  coverage: number;
  testCases: PolicyTestCase[];
}

export interface PolicyTestCase {
  id: string;
  name: string;
  input: PolicyTestInput;
  expectedDecision: PolicyEffect;
  actualDecision?: PolicyEffect;
  passed: boolean;
  error?: string;
}

export interface PolicyTestInput {
  subject: Partial<SubjectAttributes>;
  resource: Partial<ResourceAttributes>;
  action: ActionAttributes;
  environment: Partial<EnvironmentAttributes>;
}

// Audit and Analytics
export interface PermissionAnalytics {
  totalRequests: number;
  permitRate: number;
  denyRate: number;
  averageEvaluationTime: number;
  topPoliciesUsed: PolicyUsageStatistic[];
  riskDistribution: RiskDistribution;
  anomalies: AnomalyEvent[];
}

export interface PolicyUsageStatistic {
  policyId: string;
  policyName: string;
  usageCount: number;
  permitRate: number;
  averageEvaluationTime: number;
}

export interface RiskDistribution {
  veryLow: number;
  low: number;
  medium: number;
  high: number;
  critical: number;
}

export interface AnomalyEvent {
  id: string;
  type: AnomalyType;
  severity: RiskLevel;
  description: string;
  detectedAt: Date;
  userId?: string;
  resourceId?: string;
  attributes: Record<string, any>;
}

export enum AnomalyType {
  UNUSUAL_ACCESS_PATTERN = 'unusual_access_pattern',
  PRIVILEGE_ESCALATION = 'privilege_escalation',
  MASS_ACCESS = 'mass_access',
  GEOGRAPHIC_ANOMALY = 'geographic_anomaly',
  TIME_BASED_ANOMALY = 'time_based_anomaly',
  DEVICE_ANOMALY = 'device_anomaly'
}

// Request and Response Types
export interface ABACRequest {
  subject: SubjectAttributes;
  resource: ResourceAttributes;
  action: ActionAttributes;
  environment: EnvironmentAttributes;
  requestId?: string;
  traceId?: string;
}

export interface ABACResponse {
  decision: ABACDecision;
  obligations: PolicyObligation[];
  recommendations: SecurityRecommendation[];
  nextReviewAt?: Date;
  requestId?: string;
  traceId?: string;
}

// Configuration
export interface ABACConfiguration {
  evaluationTimeout: number;
  cacheEnabled: boolean;
  cacheTtl: number;
  continuousValidation: boolean;
  validationFrequency: number;
  riskThresholds: RiskThresholds;
  mlModelsEnabled: boolean;
  auditLevel: AuditLevel;
  performanceLogging: boolean;
}

export interface RiskThresholds {
  low: number;
  medium: number;
  high: number;
  critical: number;
}

export enum AuditLevel {
  NONE = 'none',
  BASIC = 'basic',
  DETAILED = 'detailed',
  FULL = 'full'
}

// Export main interfaces
export type {
  SubjectAttributes,
  ResourceAttributes,
  EnvironmentAttributes,
  ActionAttributes,
  ABACPolicy,
  ABACDecision,
  ABACRequest,
  ABACResponse,
  ABACConfiguration
};