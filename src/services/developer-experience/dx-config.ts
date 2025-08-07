/**
 * Developer Experience Configuration and Types
 * Comprehensive configuration for AI-powered developer experience optimization
 */

export interface DeveloperProfile {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: 'junior' | 'senior' | 'lead' | 'architect' | 'manager';
  team: string;
  skills: Skill[];
  preferences: DeveloperPreferences;
  experienceLevel: ExperienceLevel;
  workingHours: WorkingHours;
  timezone: string;
  languagePreferences: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Skill {
  name: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  category: 'programming' | 'framework' | 'tool' | 'methodology' | 'domain';
  yearsOfExperience: number;
  lastUsed: Date;
  certifications?: string[];
}

export interface DeveloperPreferences {
  communicationStyle: 'detailed' | 'concise' | 'visual';
  learningStyle: 'hands-on' | 'theoretical' | 'collaborative';
  toolPreferences: ToolPreference[];
  notificationSettings: NotificationSettings;
  workflowPreferences: WorkflowPreferences;
  uiPreferences: UIPreferences;
}

export interface ToolPreference {
  category: 'ide' | 'terminal' | 'browser' | 'database' | 'deployment' | 'monitoring';
  preferred: string[];
  avoided: string[];
  integrations: IntegrationPreference[];
}

export interface IntegrationPreference {
  tool: string;
  priority: 'high' | 'medium' | 'low';
  configuration: Record<string, any>;
}

export interface NotificationSettings {
  channels: NotificationChannel[];
  quietHours: { start: string; end: string };
  priorities: NotificationPriority[];
  frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
}

export interface NotificationChannel {
  type: 'email' | 'slack' | 'teams' | 'webhook' | 'in-app';
  enabled: boolean;
  configuration: Record<string, any>;
}

export interface NotificationPriority {
  type: 'error' | 'warning' | 'info' | 'success';
  enabled: boolean;
  threshold?: number;
}

export interface WorkflowPreferences {
  automationLevel: 'minimal' | 'moderate' | 'aggressive';
  approvalRequired: boolean;
  batchOperations: boolean;
  parallelExecution: boolean;
  retryMechanism: RetryConfiguration;
}

export interface RetryConfiguration {
  enabled: boolean;
  maxAttempts: number;
  backoffStrategy: 'linear' | 'exponential' | 'fixed';
  delayMs: number;
}

export interface UIPreferences {
  theme: 'light' | 'dark' | 'auto';
  density: 'compact' | 'comfortable' | 'spacious';
  layout: 'sidebar' | 'topbar' | 'hybrid';
  animations: boolean;
  shortcuts: KeyboardShortcut[];
}

export interface KeyboardShortcut {
  action: string;
  keys: string[];
  context: string[];
}

export interface ExperienceLevel {
  overall: number; // 1-10 scale
  categories: Record<string, number>;
  trajectory: 'ascending' | 'stable' | 'transitioning';
  confidenceScore: number;
}

export interface WorkingHours {
  timezone: string;
  schedule: DaySchedule[];
  flexibility: 'strict' | 'flexible' | 'very-flexible';
  focusHours: TimeBlock[];
  collaborativeHours: TimeBlock[];
}

export interface DaySchedule {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  start: string; // HH:MM format
  end: string;
  breaks: TimeBlock[];
}

export interface TimeBlock {
  start: string;
  end: string;
  type: 'focus' | 'collaboration' | 'break' | 'learning';
}

export interface DeveloperJourney {
  id: string;
  developerId: string;
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  activities: JourneyActivity[];
  context: JourneyContext;
  outcomes: JourneyOutcome[];
  satisfaction: SatisfactionMetrics;
  productivity: ProductivityMetrics;
}

export interface JourneyActivity {
  id: string;
  type: ActivityType;
  startTime: Date;
  endTime?: Date;
  duration: number;
  tool: string;
  action: string;
  context: Record<string, any>;
  success: boolean;
  errors?: ActivityError[];
  metrics: ActivityMetrics;
}

export type ActivityType = 
  | 'coding'
  | 'debugging'
  | 'testing'
  | 'documentation'
  | 'review'
  | 'deployment'
  | 'monitoring'
  | 'research'
  | 'meeting'
  | 'planning';

export interface ActivityError {
  type: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolution?: string;
  timeToResolve?: number;
}

export interface ActivityMetrics {
  efficiency: number;
  quality: number;
  effort: number;
  context_switches: number;
  interruptions: number;
}

export interface JourneyContext {
  project: string;
  repository: string;
  branch: string;
  task: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  deadline?: Date;
  blockers: string[];
  collaborators: string[];
}

export interface JourneyOutcome {
  type: 'completed' | 'blocked' | 'deferred' | 'failed';
  description: string;
  impact: 'positive' | 'neutral' | 'negative';
  learnings: string[];
  recommendations: string[];
}

export interface SatisfactionMetrics {
  overall: number; // 1-5 scale
  toolSatisfaction: Record<string, number>;
  processSatisfaction: Record<string, number>;
  feedback?: string;
}

export interface ProductivityMetrics {
  linesOfCode: number;
  commits: number;
  pullRequests: number;
  issuesResolved: number;
  timeInFlow: number;
  interruptionCount: number;
  contextSwitches: number;
  focusTime: number;
}

export interface AIRecommendation {
  id: string;
  type: RecommendationType;
  title: string;
  description: string;
  rationale: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  confidence: number; // 0-1 scale
  impact: ImpactAssessment;
  implementation: ImplementationGuide;
  metrics: RecommendationMetrics;
  validUntil?: Date;
  dependencies: string[];
  alternatives: string[];
}

export type RecommendationType =
  | 'tool'
  | 'workflow'
  | 'configuration'
  | 'learning'
  | 'optimization'
  | 'integration'
  | 'automation'
  | 'security'
  | 'performance';

export interface ImpactAssessment {
  productivity: number;
  quality: number;
  satisfaction: number;
  learning: number;
  timeToValue: number; // days
  effort: number; // hours
}

export interface ImplementationGuide {
  steps: ImplementationStep[];
  estimatedTime: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  prerequisites: string[];
  resources: string[];
  rollbackPlan: string;
}

export interface ImplementationStep {
  id: string;
  title: string;
  description: string;
  estimatedTime: number;
  dependencies: string[];
  validation: string;
  rollback?: string;
}

export interface RecommendationMetrics {
  views: number;
  implementations: number;
  successRate: number;
  averageRating: number;
  feedback: RecommendationFeedback[];
}

export interface RecommendationFeedback {
  userId: string;
  rating: number;
  comment?: string;
  implemented: boolean;
  outcome?: string;
  timestamp: Date;
}

export interface WorkflowAutomation {
  id: string;
  name: string;
  description: string;
  triggers: AutomationTrigger[];
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  status: 'active' | 'inactive' | 'testing' | 'error';
  configuration: AutomationConfiguration;
  metrics: AutomationMetrics;
  approval: ApprovalWorkflow;
}

export interface AutomationTrigger {
  type: TriggerType;
  configuration: Record<string, any>;
  conditions: TriggerCondition[];
}

export type TriggerType =
  | 'schedule'
  | 'event'
  | 'webhook'
  | 'manual'
  | 'condition'
  | 'threshold'
  | 'pattern';

export interface TriggerCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'regex';
  value: any;
  type: 'and' | 'or';
}

export interface AutomationCondition {
  id: string;
  type: 'time' | 'user' | 'resource' | 'metric' | 'dependency';
  configuration: Record<string, any>;
  required: boolean;
}

export interface AutomationAction {
  id: string;
  type: ActionType;
  configuration: Record<string, any>;
  timeout: number;
  retries: number;
  rollback?: AutomationAction;
}

export type ActionType =
  | 'api_call'
  | 'notification'
  | 'deployment'
  | 'configuration'
  | 'data_sync'
  | 'report'
  | 'cleanup'
  | 'backup';

export interface AutomationConfiguration {
  parallelExecution: boolean;
  maxConcurrent: number;
  timeoutMs: number;
  retryPolicy: RetryConfiguration;
  logging: LoggingConfiguration;
  monitoring: MonitoringConfiguration;
}

export interface LoggingConfiguration {
  level: 'debug' | 'info' | 'warn' | 'error';
  destination: string[];
  retention: number; // days
  structured: boolean;
}

export interface MonitoringConfiguration {
  enabled: boolean;
  alerts: AlertConfiguration[];
  dashboards: string[];
  metrics: string[];
}

export interface AlertConfiguration {
  name: string;
  condition: string;
  severity: 'info' | 'warning' | 'critical';
  channels: string[];
  cooldown: number; // minutes
}

export interface AutomationMetrics {
  executions: number;
  successRate: number;
  averageExecutionTime: number;
  errorRate: number;
  costSavings: number;
  timesSaved: number;
}

export interface ApprovalWorkflow {
  required: boolean;
  approvers: string[];
  autoApprove: AutoApproveConfiguration;
  timeout: number; // hours
  escalation: EscalationConfiguration;
}

export interface AutoApproveConfiguration {
  enabled: boolean;
  conditions: string[];
  riskThreshold: 'low' | 'medium' | 'high';
}

export interface EscalationConfiguration {
  enabled: boolean;
  levels: EscalationLevel[];
  timeoutAction: 'approve' | 'reject' | 'escalate';
}

export interface EscalationLevel {
  level: number;
  approvers: string[];
  timeout: number; // hours
}

export interface PerformanceBottleneck {
  id: string;
  type: BottleneckType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: PerformanceImpact;
  root_cause: RootCause;
  predictions: BottleneckPrediction[];
  mitigation: MitigationStrategy[];
  timeline: PerformanceTimeline[];
}

export type BottleneckType =
  | 'resource_contention'
  | 'process_inefficiency'
  | 'tool_performance'
  | 'knowledge_gap'
  | 'communication'
  | 'dependency_wait'
  | 'context_switching'
  | 'approval_delay';

export interface PerformanceImpact {
  developersAffected: number;
  timeWasted: number; // hours per week
  qualityImpact: number; // 1-10 scale
  satisfactionImpact: number; // 1-10 scale
  businessImpact: string;
}

export interface RootCause {
  category: string;
  factors: string[];
  confidence: number;
  evidenceStrength: number;
  analysis: string;
}

export interface BottleneckPrediction {
  probability: number;
  timeframe: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  triggers: string[];
  prevention: string[];
}

export interface MitigationStrategy {
  id: string;
  type: 'immediate' | 'short_term' | 'long_term';
  description: string;
  estimatedEffort: number; // hours
  expectedImpact: number; // percentage improvement
  cost: number;
  risks: string[];
  dependencies: string[];
}

export interface PerformanceTimeline {
  timestamp: Date;
  metric: string;
  value: number;
  threshold: number;
  status: 'normal' | 'warning' | 'critical';
}

export interface PersonalizationProfile {
  id: string;
  developerId: string;
  preferences: PersonalizationPreferences;
  behavioral_patterns: BehavioralPattern[];
  adaptations: Adaptation[];
  learning_model: LearningModel;
  feedback_history: FeedbackHistory[];
}

export interface PersonalizationPreferences {
  interface: InterfacePreferences;
  content: ContentPreferences;
  workflow: WorkflowPersonalization;
  communication: CommunicationPreferences;
}

export interface InterfacePreferences {
  layout: string;
  shortcuts: Record<string, string>;
  widgets: WidgetConfiguration[];
  customizations: Record<string, any>;
}

export interface WidgetConfiguration {
  id: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  visible: boolean;
  configuration: Record<string, any>;
}

export interface ContentPreferences {
  languages: string[];
  topics: string[];
  difficulty_level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  formats: string[];
  sources: string[];
}

export interface WorkflowPersonalization {
  templates: string[];
  automations: string[];
  shortcuts: string[];
  integrations: string[];
}

export interface CommunicationPreferences {
  style: 'formal' | 'casual' | 'technical';
  frequency: 'immediate' | 'batched' | 'digest';
  channels: string[];
  language: string;
}

export interface BehavioralPattern {
  pattern_type: string;
  description: string;
  frequency: number;
  confidence: number;
  triggers: string[];
  outcomes: string[];
  seasonal_variations: SeasonalVariation[];
}

export interface SeasonalVariation {
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  pattern: string;
  strength: number;
}

export interface Adaptation {
  id: string;
  type: string;
  description: string;
  trigger: string;
  implementation: Date;
  effectiveness: number;
  user_rating?: number;
}

export interface LearningModel {
  model_type: string;
  version: string;
  accuracy: number;
  last_trained: Date;
  parameters: Record<string, any>;
  performance_metrics: ModelPerformanceMetrics;
}

export interface ModelPerformanceMetrics {
  precision: number;
  recall: number;
  f1_score: number;
  accuracy: number;
  confusion_matrix: number[][];
}

export interface FeedbackHistory {
  timestamp: Date;
  type: 'explicit' | 'implicit';
  category: string;
  rating?: number;
  comment?: string;
  context: Record<string, any>;
}

export interface IntegrationRecommendation {
  id: string;
  source_tool: string;
  target_tool: string;
  integration_type: IntegrationType;
  benefits: IntegrationBenefit[];
  implementation: IntegrationImplementation;
  compatibility: CompatibilityAssessment;
  cost_analysis: CostAnalysis;
  risk_assessment: RiskAssessment;
}

export type IntegrationType =
  | 'data_sync'
  | 'workflow_automation'
  | 'authentication'
  | 'notification'
  | 'reporting'
  | 'monitoring'
  | 'deployment'
  | 'testing';

export interface IntegrationBenefit {
  type: string;
  description: string;
  quantified_impact: number;
  metrics: string[];
}

export interface IntegrationImplementation {
  complexity: 'low' | 'medium' | 'high' | 'very_high';
  estimated_hours: number;
  required_skills: string[];
  dependencies: string[];
  milestones: Milestone[];
  testing_strategy: string;
}

export interface Milestone {
  name: string;
  description: string;
  estimated_completion: number; // days
  deliverables: string[];
  success_criteria: string[];
}

export interface CompatibilityAssessment {
  technical_compatibility: number; // 0-1 scale
  version_support: VersionSupport[];
  limitations: string[];
  workarounds: string[];
}

export interface VersionSupport {
  tool: string;
  supported_versions: string[];
  recommended_version: string;
  end_of_life: Date | null;
}

export interface CostAnalysis {
  implementation_cost: number;
  maintenance_cost: number; // annual
  license_cost: number; // annual
  training_cost: number;
  total_cost_of_ownership: number; // 3 years
  roi_timeline: number; // months
}

export interface RiskAssessment {
  overall_risk: 'low' | 'medium' | 'high' | 'critical';
  risks: Risk[];
  mitigation_strategies: MitigationStrategy[];
  contingency_plan: string;
}

export interface Risk {
  category: string;
  description: string;
  probability: number; // 0-1 scale
  impact: number; // 0-1 scale
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface MLModelConfiguration {
  model_name: string;
  model_type: 'classification' | 'regression' | 'clustering' | 'recommendation';
  framework: 'tensorflow' | 'pytorch' | 'scikit-learn' | 'xgboost';
  version: string;
  hyperparameters: Record<string, any>;
  training_config: TrainingConfiguration;
  deployment_config: DeploymentConfiguration;
  monitoring_config: ModelMonitoringConfiguration;
}

export interface TrainingConfiguration {
  dataset: DatasetConfiguration;
  validation_split: number;
  batch_size: number;
  epochs: number;
  learning_rate: number;
  optimizer: string;
  loss_function: string;
  early_stopping: EarlyStoppingConfiguration;
  checkpointing: CheckpointConfiguration;
}

export interface DatasetConfiguration {
  source: string;
  features: FeatureConfiguration[];
  preprocessing: PreprocessingStep[];
  augmentation: AugmentationStrategy[];
  quality_checks: QualityCheck[];
}

export interface FeatureConfiguration {
  name: string;
  type: 'categorical' | 'numerical' | 'text' | 'datetime' | 'boolean';
  encoding: string;
  scaling: string;
  importance: number;
}

export interface PreprocessingStep {
  type: string;
  parameters: Record<string, any>;
  order: number;
}

export interface AugmentationStrategy {
  type: string;
  probability: number;
  parameters: Record<string, any>;
}

export interface QualityCheck {
  type: string;
  threshold: number;
  action: 'warn' | 'exclude' | 'transform';
}

export interface EarlyStoppingConfiguration {
  enabled: boolean;
  metric: string;
  patience: number;
  min_delta: number;
}

export interface CheckpointConfiguration {
  enabled: boolean;
  frequency: number;
  save_best_only: boolean;
  metric: string;
}

export interface DeploymentConfiguration {
  environment: 'development' | 'staging' | 'production';
  infrastructure: InfrastructureConfiguration;
  scaling: ScalingConfiguration;
  security: SecurityConfiguration;
}

export interface InfrastructureConfiguration {
  provider: 'aws' | 'gcp' | 'azure' | 'local';
  instance_type: string;
  gpu_enabled: boolean;
  memory_limit: number;
  cpu_limit: number;
}

export interface ScalingConfiguration {
  auto_scaling: boolean;
  min_instances: number;
  max_instances: number;
  target_cpu: number;
  target_memory: number;
}

export interface SecurityConfiguration {
  encryption: boolean;
  access_control: string[];
  audit_logging: boolean;
  data_privacy: DataPrivacyConfiguration;
}

export interface DataPrivacyConfiguration {
  anonymization: boolean;
  retention_period: number; // days
  deletion_policy: string;
  compliance: string[];
}

export interface ModelMonitoringConfiguration {
  performance_monitoring: PerformanceMonitoringConfiguration;
  drift_detection: DriftDetectionConfiguration;
  alerting: ModelAlertingConfiguration;
  retraining: RetrainingConfiguration;
}

export interface PerformanceMonitoringConfiguration {
  metrics: string[];
  thresholds: Record<string, number>;
  frequency: string;
  dashboard: boolean;
}

export interface DriftDetectionConfiguration {
  enabled: boolean;
  methods: string[];
  threshold: number;
  window_size: number;
  frequency: string;
}

export interface ModelAlertingConfiguration {
  channels: string[];
  severity_levels: string[];
  escalation: boolean;
  cooldown: number; // minutes
}

export interface RetrainingConfiguration {
  automatic: boolean;
  trigger_conditions: string[];
  schedule: string;
  approval_required: boolean;
}

export const DEFAULT_DX_CONFIG = {
  analytics: {
    retention_days: 90,
    sampling_rate: 0.1,
    batch_size: 1000,
    real_time_processing: true
  },
  recommendations: {
    max_per_user: 10,
    confidence_threshold: 0.7,
    refresh_interval_hours: 4,
    personalization_weight: 0.3
  },
  automation: {
    max_concurrent_workflows: 5,
    timeout_minutes: 30,
    retry_attempts: 3,
    approval_timeout_hours: 24
  },
  performance: {
    monitoring_interval_minutes: 5,
    bottleneck_threshold: 0.8,
    prediction_horizon_days: 7,
    alert_cooldown_minutes: 15
  },
  personalization: {
    adaptation_rate: 0.1,
    min_data_points: 10,
    feedback_weight: 0.5,
    behavioral_weight: 0.3
  },
  machine_learning: {
    model_update_frequency: 'weekly',
    training_data_retention_days: 180,
    feature_importance_threshold: 0.05,
    cross_validation_folds: 5
  }
} as const;