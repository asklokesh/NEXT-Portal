/**
 * Service Health Scorecards Types
 * Type definitions for the scorecard system (similar to Spotify Soundcheck)
 */

// ============================================================================
// Core Scorecard Types
// ============================================================================

export interface Scorecard {
  id: string;
  name: string;
  description?: string;
  owner: string;
  entityTypes: string[]; // Component, API, etc.
  checks: ScorecardCheck[];
  levels?: ScorecardLevel[];
  schedule?: EvaluationSchedule;
  metadata: ScorecardMetadata;
}

export interface ScorecardCheck {
  id: string;
  name: string;
  description?: string;
  category: CheckCategory;
  weight: number;
  rule: CheckRule;
  remediationUrl?: string;
  autoRemediation?: AutoRemediation;
  tags?: string[];
  enabled: boolean;
}

export type CheckCategory =
  | 'security'
  | 'reliability'
  | 'quality'
  | 'documentation'
  | 'operations'
  | 'compliance'
  | 'cost'
  | 'performance'
  | 'observability'
  | 'custom';

export interface CheckRule {
  type: CheckRuleType;
  config: RuleConfig;
  passingCondition: PassingCondition;
}

export type CheckRuleType =
  | 'metadata'
  | 'annotation'
  | 'label'
  | 'relation'
  | 'api'
  | 'github'
  | 'sonarqube'
  | 'snyk'
  | 'pagerduty'
  | 'datadog'
  | 'prometheus'
  | 'custom';

export interface RuleConfig {
  // For metadata rules
  field?: string;
  operator?: RuleOperator;
  value?: unknown;

  // For API rules
  endpoint?: string;
  method?: string;
  headers?: Record<string, string>;
  jsonPath?: string;

  // For GitHub rules
  repository?: string;
  checkType?: 'has_readme' | 'has_codeowners' | 'branch_protection' | 'ci_passing' | 'dependabot_enabled';

  // For integration rules
  integrationId?: string;
  query?: string;
  threshold?: number;

  // For custom rules
  script?: string;
  timeout?: number;
}

export type RuleOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'regex'
  | 'exists'
  | 'not_exists'
  | 'greater_than'
  | 'less_than'
  | 'between'
  | 'in'
  | 'not_in';

export interface PassingCondition {
  type: 'boolean' | 'threshold' | 'percentage';
  value?: number;
  comparison?: 'gte' | 'lte' | 'gt' | 'lt' | 'eq';
}

export interface AutoRemediation {
  enabled: boolean;
  type: 'pr' | 'workflow' | 'action' | 'notification';
  config: Record<string, unknown>;
}

// ============================================================================
// Scorecard Levels (like Spotify's Bronze/Silver/Gold/Platinum)
// ============================================================================

export interface ScorecardLevel {
  id: string;
  name: string;
  color: string;
  icon?: string;
  requirements: LevelRequirement[];
  benefits?: string[];
  order: number;
}

export interface LevelRequirement {
  type: 'min_score' | 'category_score' | 'specific_checks';
  value: number | string[];
  category?: CheckCategory;
}

// ============================================================================
// Evaluation Results
// ============================================================================

export interface ScorecardResult {
  id: string;
  scorecardId: string;
  entityRef: string;
  score: number;
  maxScore: number;
  percentage: number;
  level?: string;
  checkResults: CheckResult[];
  evaluatedAt: string;
  nextEvaluation?: string;
  trend?: ScoreTrend;
}

export interface CheckResult {
  checkId: string;
  checkName: string;
  category: CheckCategory;
  status: CheckStatus;
  score: number;
  maxScore: number;
  message?: string;
  details?: Record<string, unknown>;
  evidence?: CheckEvidence;
  evaluatedAt: string;
}

export type CheckStatus = 'pass' | 'fail' | 'warning' | 'error' | 'skipped';

export interface CheckEvidence {
  type: 'link' | 'json' | 'text' | 'image';
  data: unknown;
  label?: string;
}

export interface ScoreTrend {
  direction: 'up' | 'down' | 'stable';
  change: number;
  period: string;
  history: Array<{
    date: string;
    score: number;
    percentage: number;
  }>;
}

// ============================================================================
// Evaluation Schedule
// ============================================================================

export interface EvaluationSchedule {
  enabled: boolean;
  frequency: 'realtime' | 'hourly' | 'daily' | 'weekly';
  cron?: string;
  timezone?: string;
}

// ============================================================================
// Metadata
// ============================================================================

export interface ScorecardMetadata {
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  version: number;
  status: 'draft' | 'active' | 'archived';
}

// ============================================================================
// Team/Org Level Aggregations
// ============================================================================

export interface TeamScorecardSummary {
  teamRef: string;
  teamName: string;
  entityCount: number;
  averageScore: number;
  averagePercentage: number;
  levelDistribution: Record<string, number>;
  categoryScores: Record<CheckCategory, number>;
  trend: ScoreTrend;
  topPerformers: EntityScoreSummary[];
  needsAttention: EntityScoreSummary[];
}

export interface EntityScoreSummary {
  entityRef: string;
  entityName: string;
  entityType: string;
  score: number;
  percentage: number;
  level?: string;
  failingChecks: number;
}

export interface OrgScorecardSummary {
  totalEntities: number;
  evaluatedEntities: number;
  averageScore: number;
  averagePercentage: number;
  levelDistribution: Record<string, number>;
  categoryScores: Record<CheckCategory, number>;
  teamRankings: Array<{
    teamRef: string;
    teamName: string;
    averageScore: number;
    entityCount: number;
  }>;
  improvementOpportunities: Array<{
    checkId: string;
    checkName: string;
    failingEntities: number;
    potentialScoreGain: number;
  }>;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface EvaluateScorecardRequest {
  scorecardId: string;
  entityRef: string;
  force?: boolean;
}

export interface EvaluateScorecardResponse {
  result: ScorecardResult;
  cached: boolean;
}

export interface ScorecardFilterOptions {
  entityType?: string;
  owner?: string;
  status?: string;
  category?: CheckCategory;
}

export interface BulkEvaluationRequest {
  scorecardId: string;
  entityRefs?: string[];
  filter?: ScorecardFilterOptions;
  async?: boolean;
}

export interface BulkEvaluationResponse {
  jobId?: string;
  results?: ScorecardResult[];
  total: number;
  completed: number;
  failed: number;
}

// ============================================================================
// Notification Types
// ============================================================================

export interface ScorecardAlert {
  id: string;
  scorecardId: string;
  type: AlertType;
  condition: AlertCondition;
  channels: AlertChannel[];
  enabled: boolean;
}

export type AlertType =
  | 'score_drop'
  | 'check_failure'
  | 'level_change'
  | 'threshold';

export interface AlertCondition {
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  value: number;
  duration?: string;
}

export interface AlertChannel {
  type: 'slack' | 'email' | 'pagerduty' | 'webhook';
  config: Record<string, unknown>;
}
