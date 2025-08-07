/**
 * Feature Flag Management System - Core Types
 * Comprehensive type definitions for the feature flag system
 */

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description?: string;
  enabled: boolean;
  defaultValue: boolean;
  environment: string;
  projectId?: string;
  type: FlagType;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
  archived: boolean;
  expiresAt?: Date;
  
  // Rollout configuration
  rollout: RolloutConfig;
  
  // Targeting rules
  targeting: TargetingConfig;
  
  // Variations for A/B testing
  variations?: FlagVariation[];
  
  // Audit trail
  auditLog?: AuditEntry[];
}

export type FlagType = 'boolean' | 'string' | 'number' | 'json' | 'kill_switch';

export interface FlagVariation {
  id: string;
  key: string;
  name: string;
  value: any;
  weight: number; // Percentage allocation (0-100)
  description?: string;
}

export interface RolloutConfig {
  enabled: boolean;
  percentage: number; // 0-100
  strategy: RolloutStrategy;
  segments?: string[];
  startDate?: Date;
  endDate?: Date;
  
  // Gradual rollout
  phaseRollout?: PhaseRollout;
  
  // Kill switch configuration
  killSwitchConfig?: KillSwitchConfig;
}

export type RolloutStrategy = 
  | 'percentage' 
  | 'user_id' 
  | 'segment' 
  | 'sticky' 
  | 'gradual' 
  | 'canary'
  | 'blue_green';

export interface PhaseRollout {
  phases: RolloutPhase[];
  currentPhase: number;
  autoAdvance: boolean;
  advanceMetricThreshold?: MetricThreshold;
}

export interface RolloutPhase {
  id: string;
  name: string;
  percentage: number;
  duration?: number; // Duration in minutes
  conditions?: AdvanceCondition[];
}

export interface AdvanceCondition {
  metric: string;
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
  threshold: number;
  window: number; // Time window in minutes
}

export interface KillSwitchConfig {
  triggers: KillSwitchTrigger[];
  autoRecover: boolean;
  recoveryConditions?: RecoveryCondition[];
  notificationChannels: string[];
}

export interface KillSwitchTrigger {
  id: string;
  name: string;
  metric: string;
  operator: 'gt' | 'lt' | 'gte' | 'lte';
  threshold: number;
  window: number; // Time window in minutes
  enabled: boolean;
}

export interface RecoveryCondition {
  metric: string;
  operator: 'gt' | 'lt' | 'gte' | 'lte';
  threshold: number;
  duration: number; // Minutes to wait in stable state
}

export interface TargetingConfig {
  enabled: boolean;
  rules: TargetingRule[];
  defaultVariation?: string;
  fallback: FallbackConfig;
}

export interface TargetingRule {
  id: string;
  name?: string;
  description?: string;
  enabled: boolean;
  conditions: TargetingCondition[];
  operator: 'and' | 'or';
  variation?: string;
  percentage?: number;
  priority: number;
}

export interface TargetingCondition {
  attribute: string;
  operator: ConditionOperator;
  values: string[];
  negate?: boolean;
}

export type ConditionOperator = 
  | 'equals' 
  | 'not_equals' 
  | 'contains' 
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'in'
  | 'not_in'
  | 'regex'
  | 'greater_than'
  | 'less_than'
  | 'greater_equal'
  | 'less_equal'
  | 'exists'
  | 'not_exists';

export interface FallbackConfig {
  variation?: string;
  value?: any;
  strategy: 'default' | 'variation' | 'off';
}

export interface UserContext {
  userId?: string;
  sessionId?: string;
  email?: string;
  groups?: string[];
  attributes: Record<string, any>;
  location?: {
    country?: string;
    region?: string;
    city?: string;
  };
  device?: {
    type?: string;
    os?: string;
    browser?: string;
  };
  custom?: Record<string, any>;
}

export interface FlagEvaluation {
  flagKey: string;
  value: any;
  variation?: string;
  reason: EvaluationReason;
  ruleIndex?: number;
  timestamp: Date;
  debugInfo?: any;
}

export interface EvaluationReason {
  kind: 'OFF' | 'FALLTHROUGH' | 'TARGET_MATCH' | 'RULE_MATCH' | 'PREREQUISITE_FAILED' | 'ERROR';
  ruleIndex?: number;
  ruleId?: string;
  inExperiment?: boolean;
  errorKind?: string;
}

export interface AuditEntry {
  id: string;
  action: AuditAction;
  flagKey: string;
  userId: string;
  userName?: string;
  timestamp: Date;
  changes?: ChangeEntry[];
  reason?: string;
  metadata?: Record<string, any>;
}

export type AuditAction = 
  | 'CREATED'
  | 'UPDATED' 
  | 'DELETED'
  | 'ARCHIVED'
  | 'RESTORED'
  | 'ROLLOUT_STARTED'
  | 'ROLLOUT_STOPPED'
  | 'KILL_SWITCH_ACTIVATED'
  | 'KILL_SWITCH_DEACTIVATED';

export interface ChangeEntry {
  field: string;
  oldValue?: any;
  newValue?: any;
}

export interface FlagMetrics {
  flagKey: string;
  timestamp: Date;
  evaluations: number;
  variations: Record<string, number>;
  errorRate: number;
  latency: LatencyMetrics;
  businessMetrics?: BusinessMetrics;
}

export interface LatencyMetrics {
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  avg: number;
}

export interface BusinessMetrics {
  conversionRate?: number;
  revenue?: number;
  clickThroughRate?: number;
  bounceRate?: number;
  customMetrics?: Record<string, number>;
}

export interface MetricThreshold {
  metric: string;
  operator: 'gt' | 'lt' | 'gte' | 'lte';
  threshold: number;
  window: number;
}

export interface FeatureFlagSDKConfig {
  apiKey: string;
  baseUrl: string;
  environment: string;
  userId?: string;
  pollInterval?: number;
  streamingEnabled?: boolean;
  timeout?: number;
  cacheEnabled?: boolean;
  cacheTTL?: number;
  offlineMode?: boolean;
  debugMode?: boolean;
}

export interface SDKEvaluationContext extends UserContext {
  flagKeys?: string[];
  waitForInit?: boolean;
  timeout?: number;
}

export interface FeatureFlagApproval {
  id: string;
  flagKey: string;
  requestedBy: string;
  approvedBy?: string;
  status: ApprovalStatus;
  requestedChanges: any;
  reason?: string;
  createdAt: Date;
  approvedAt?: Date;
  expiresAt?: Date;
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface FeatureFlagWorkflow {
  id: string;
  name: string;
  environment: string;
  approvalRequired: boolean;
  approvers: string[];
  autoApproveRules?: AutoApprovalRule[];
  notificationChannels: string[];
}

export interface AutoApprovalRule {
  condition: string;
  value: any;
  operator: string;
}

export interface FeatureFlagEvent {
  id: string;
  type: FlagEventType;
  flagKey: string;
  environment: string;
  userId?: string;
  timestamp: Date;
  data: any;
}

export type FlagEventType = 
  | 'flag_evaluated'
  | 'flag_updated'
  | 'rollout_started'
  | 'rollout_completed'
  | 'kill_switch_triggered'
  | 'approval_requested'
  | 'approval_granted';

// Error types
export class FeatureFlagError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'FeatureFlagError';
  }
}

export class FlagEvaluationError extends FeatureFlagError {
  constructor(message: string, public flagKey: string, details?: any) {
    super(message, 'EVALUATION_ERROR', details);
    this.name = 'FlagEvaluationError';
  }
}

export class FlagConfigurationError extends FeatureFlagError {
  constructor(message: string, details?: any) {
    super(message, 'CONFIGURATION_ERROR', details);
    this.name = 'FlagConfigurationError';
  }
}

// Service interfaces
export interface IFeatureFlagService {
  // Flag management
  createFlag(flag: Partial<FeatureFlag>): Promise<FeatureFlag>;
  updateFlag(flagKey: string, updates: Partial<FeatureFlag>): Promise<FeatureFlag>;
  deleteFlag(flagKey: string): Promise<void>;
  getFlag(flagKey: string): Promise<FeatureFlag | null>;
  listFlags(filters?: FlagFilters): Promise<FeatureFlag[]>;
  archiveFlag(flagKey: string): Promise<void>;
  restoreFlag(flagKey: string): Promise<void>;
  
  // Flag evaluation
  evaluateFlag(flagKey: string, context: UserContext): Promise<FlagEvaluation>;
  evaluateFlags(flagKeys: string[], context: UserContext): Promise<Record<string, FlagEvaluation>>;
  
  // Bulk operations
  bulkUpdateFlags(updates: BulkFlagUpdate[]): Promise<FeatureFlag[]>;
  bulkEvaluateFlags(request: BulkEvaluationRequest): Promise<BulkEvaluationResponse>;
}

export interface FlagFilters {
  environment?: string;
  enabled?: boolean;
  type?: FlagType;
  tags?: string[];
  archived?: boolean;
  search?: string;
  createdBy?: string;
  limit?: number;
  offset?: number;
}

export interface BulkFlagUpdate {
  flagKey: string;
  updates: Partial<FeatureFlag>;
}

export interface BulkEvaluationRequest {
  flagKeys: string[];
  context: UserContext;
  includeReasons?: boolean;
}

export interface BulkEvaluationResponse {
  evaluations: Record<string, FlagEvaluation>;
  timestamp: Date;
}