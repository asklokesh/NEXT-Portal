/**
 * Service Health Scorecards
 * Spotify Soundcheck-like service health and maturity scoring
 */

export { ScorecardService, getScorecardService } from './ScorecardService';
export { RuleEngine } from './RuleEngine';

// Export all types
export type {
  // Core Types
  Scorecard,
  ScorecardCheck,
  CheckCategory,
  CheckRule,
  CheckRuleType,
  RuleConfig,
  RuleOperator,
  PassingCondition,
  AutoRemediation,

  // Level Types
  ScorecardLevel,
  LevelRequirement,

  // Result Types
  ScorecardResult,
  CheckResult,
  CheckStatus,
  CheckEvidence,
  ScoreTrend,

  // Schedule
  EvaluationSchedule,

  // Metadata
  ScorecardMetadata,

  // Aggregations
  TeamScorecardSummary,
  OrgScorecardSummary,
  EntityScoreSummary,

  // API Types
  EvaluateScorecardRequest,
  EvaluateScorecardResponse,
  ScorecardFilterOptions,
  BulkEvaluationRequest,
  BulkEvaluationResponse,

  // Alert Types
  ScorecardAlert,
  AlertType,
  AlertCondition,
  AlertChannel,
} from './types';
