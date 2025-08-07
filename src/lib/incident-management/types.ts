export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'investigating' | 'identified' | 'monitoring' | 'resolved' | 'closed';
  priority: 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
  affectedServices: string[];
  incidentCommander: User;
  team: User[];
  createdAt: Date;
  updatedAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  closedAt?: Date;
  timeline: TimelineEvent[];
  rootCause?: string;
  resolution?: string;
  actionItems?: ActionItem[];
  relatedIncidents?: string[];
  impactedUsers?: number;
  slaStatus: 'within' | 'warning' | 'breached';
  tags: string[];
  source: 'manual' | 'alert' | 'monitoring' | 'webhook';
  externalId?: string;
  alertRuleId?: string;
  runbooks: Runbook[];
  metrics: IncidentMetrics;
  communicationChannels: CommunicationChannel[];
  statusPageUpdate?: StatusPageUpdate;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  status?: 'online' | 'offline' | 'busy';
  contactMethods: ContactMethod[];
  escalationLevel: number;
  timezone: string;
}

export interface ContactMethod {
  type: 'email' | 'phone' | 'slack' | 'pagerduty' | 'webhook';
  value: string;
  verified: boolean;
  priority: number;
}

export interface TimelineEvent {
  id: string;
  timestamp: Date;
  type: 'created' | 'updated' | 'comment' | 'status_change' | 'escalation' | 'notification' | 'runbook_executed' | 'alert_received';
  user: User;
  description: string;
  metadata?: Record<string, any>;
  severity?: 'info' | 'warning' | 'error';
  automated: boolean;
}

export interface ActionItem {
  id: string;
  title: string;
  description?: string;
  assignee: User;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  dueDate?: Date;
  completedAt?: Date;
  estimatedEffort?: number; // in minutes
  actualEffort?: number; // in minutes
  type: 'investigation' | 'mitigation' | 'communication' | 'monitoring' | 'postmortem';
}

export interface Runbook {
  id: string;
  name: string;
  description: string;
  steps: RunbookStep[];
  triggers: RunbookTrigger[];
  automationLevel: 'manual' | 'semi-automated' | 'fully-automated';
  lastExecuted?: Date;
  successRate: number;
  averageExecutionTime: number;
}

export interface RunbookStep {
  id: string;
  name: string;
  description: string;
  type: 'manual' | 'script' | 'api_call' | 'notification';
  command?: string;
  expectedOutput?: string;
  timeout: number;
  retries: number;
  onSuccess?: string; // Next step ID
  onFailure?: string; // Next step ID
  automated: boolean;
}

export interface RunbookTrigger {
  condition: string;
  severity: string[];
  services: string[];
  keywords: string[];
}

export interface IncidentMetrics {
  detectionTime: number; // Time to detect in minutes
  acknowledgmentTime: number; // Time to acknowledge in minutes
  resolutionTime?: number; // Time to resolve in minutes
  customerImpactTime: number; // Time customers were impacted in minutes
  escalations: number;
  communicationsSent: number;
  runbooksExecuted: number;
  falseAlarmScore?: number; // 0-1 score
}

export interface CommunicationChannel {
  type: 'slack' | 'teams' | 'email' | 'sms' | 'webhook' | 'status_page';
  identifier: string;
  config: Record<string, any>;
  active: boolean;
}

export interface StatusPageUpdate {
  id: string;
  title: string;
  message: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  affectedComponents: string[];
  publishedAt: Date;
  updatedAt: Date;
}

export interface Alert {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  source: string;
  timestamp: Date;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  fingerprint: string;
  status: 'firing' | 'resolved';
  incidentId?: string;
  suppressed: boolean;
  suppressedUntil?: Date;
  groupKey: string;
}

export interface AlertRule {
  id: string;
  name: string;
  query: string;
  severity: 'critical' | 'warning' | 'info';
  description: string;
  enabled: boolean;
  conditions: AlertCondition[];
  actions: AlertAction[];
  suppression: AlertSuppression;
  routing: AlertRouting;
}

export interface AlertCondition {
  metric: string;
  operator: '>' | '<' | '=' | '>=' | '<=' | '!=';
  threshold: number;
  duration: string; // e.g., "5m", "1h"
}

export interface AlertAction {
  type: 'create_incident' | 'notify_team' | 'execute_runbook' | 'scale_service';
  config: Record<string, any>;
  delay?: number;
}

export interface AlertSuppression {
  enabled: boolean;
  duration: number; // in minutes
  conditions: string[];
}

export interface AlertRouting {
  teams: string[];
  escalationPolicy: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  autoCreateIncident: boolean;
}

export interface EscalationPolicy {
  id: string;
  name: string;
  description: string;
  levels: EscalationLevel[];
  repeatCount: number;
  active: boolean;
}

export interface EscalationLevel {
  id: string;
  level: number;
  delayMinutes: number;
  targets: EscalationTarget[];
}

export interface EscalationTarget {
  type: 'user' | 'team' | 'webhook' | 'external';
  identifier: string;
  config: Record<string, any>;
}

export interface OnCallSchedule {
  id: string;
  name: string;
  description: string;
  timezone: string;
  rotations: OnCallRotation[];
  overrides: OnCallOverride[];
  active: boolean;
}

export interface OnCallRotation {
  id: string;
  name: string;
  users: string[];
  rotationType: 'daily' | 'weekly' | 'monthly';
  startTime: string; // HH:MM format
  duration: number; // in hours
  handoffTime: string; // HH:MM format
}

export interface OnCallOverride {
  id: string;
  userId: string;
  startTime: Date;
  endTime: Date;
  reason: string;
}

export interface PostMortem {
  id: string;
  incidentId: string;
  title: string;
  summary: string;
  timeline: PostMortemTimelineItem[];
  rootCause: RootCauseAnalysis;
  impact: ImpactAnalysis;
  actionItems: PostMortemActionItem[];
  lessons: string[];
  contributors: string[];
  reviewers: string[];
  status: 'draft' | 'under_review' | 'approved' | 'published';
  createdAt: Date;
  publishedAt?: Date;
}

export interface PostMortemTimelineItem {
  timestamp: Date;
  event: string;
  impact: string;
  source: string;
}

export interface RootCauseAnalysis {
  primaryCause: string;
  contributingFactors: string[];
  whyAnalysis: string[]; // 5 Whys
  category: 'human_error' | 'system_failure' | 'process_gap' | 'external_dependency' | 'unknown';
}

export interface ImpactAnalysis {
  usersAffected: number;
  servicesAffected: string[];
  revenueImpact?: number;
  durationMinutes: number;
  severityJustification: string;
}

export interface PostMortemActionItem extends ActionItem {
  category: 'prevention' | 'detection' | 'response' | 'recovery';
  estimatedImpact: 'low' | 'medium' | 'high';
  implementationCost: 'low' | 'medium' | 'high';
}

export interface SLADefinition {
  id: string;
  name: string;
  description: string;
  targets: SLATarget[];
  applicableServices: string[];
  escalationThresholds: SLAThreshold[];
  active: boolean;
}

export interface SLATarget {
  metric: 'mttr' | 'mtta' | 'uptime' | 'response_time';
  value: number;
  unit: 'minutes' | 'hours' | 'percentage';
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly';
}

export interface SLAThreshold {
  level: 'warning' | 'breach';
  percentage: number; // e.g., 80% of target = warning, 100% = breach
  actions: SLAAction[];
}

export interface SLAAction {
  type: 'notify' | 'escalate' | 'create_ticket' | 'webhook';
  config: Record<string, any>;
}

export interface IncidentStatistics {
  period: {
    start: Date;
    end: Date;
  };
  totalIncidents: number;
  incidentsByStatus: Record<string, number>;
  incidentsBySeverity: Record<string, number>;
  incidentsByService: Record<string, number>;
  mttr: {
    overall: number;
    bySeverity: Record<string, number>;
    byService: Record<string, number>;
  };
  mtta: {
    overall: number;
    bySeverity: Record<string, number>;
    byService: Record<string, number>;
  };
  mtbf: {
    overall: number;
    byService: Record<string, number>;
  };
  slaCompliance: Record<string, number>;
  trends: {
    daily: TrendDataPoint[];
    weekly: TrendDataPoint[];
    monthly: TrendDataPoint[];
  };
}

export interface TrendDataPoint {
  date: string;
  incidents: number;
  resolved: number;
  mttr: number;
  mtta: number;
}

export interface IntegrationConfig {
  pagerDuty: {
    enabled: boolean;
    apiKey: string;
    serviceId: string;
    webhookSecret: string;
    routingKey: string;
  };
  opsgenie: {
    enabled: boolean;
    apiKey: string;
    teamId: string;
    webhookUrl: string;
  };
  slack: {
    enabled: boolean;
    botToken: string;
    channels: SlackChannelConfig[];
  };
  grafana: {
    enabled: boolean;
    url: string;
    apiKey: string;
    dashboards: GrafanaDashboardConfig[];
  };
  prometheus: {
    enabled: boolean;
    url: string;
    queries: PrometheusQuery[];
  };
}

export interface SlackChannelConfig {
  channelId: string;
  purpose: 'incidents' | 'alerts' | 'updates' | 'postmortems';
  severity: string[];
  services: string[];
}

export interface GrafanaDashboardConfig {
  id: string;
  url: string;
  panels: string[];
  services: string[];
}

export interface PrometheusQuery {
  name: string;
  query: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  services: string[];
}

export interface ChaosExperiment {
  id: string;
  name: string;
  description: string;
  type: 'network' | 'cpu' | 'memory' | 'disk' | 'service' | 'database';
  target: ChaosTarget;
  parameters: ChaosParameters;
  schedule?: ChaosSchedule;
  status: 'draft' | 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled';
  results?: ChaosResults;
  createdAt: Date;
  executedAt?: Date;
  completedAt?: Date;
}

export interface ChaosTarget {
  type: 'service' | 'host' | 'container' | 'database';
  identifier: string;
  environment: 'staging' | 'production' | 'development';
  filters: Record<string, string>;
}

export interface ChaosParameters {
  duration: number; // in minutes
  intensity: 'low' | 'medium' | 'high';
  config: Record<string, any>;
  safeguards: ChaosSafeguard[];
}

export interface ChaosSafeguard {
  type: 'metric_threshold' | 'service_health' | 'user_impact';
  condition: string;
  action: 'pause' | 'stop' | 'alert';
}

export interface ChaosSchedule {
  frequency: 'once' | 'daily' | 'weekly' | 'monthly';
  time: string; // HH:MM format
  timezone: string;
  enabled: boolean;
}

export interface ChaosResults {
  success: boolean;
  metrics: ChaosMetric[];
  incidents: string[];
  observations: string[];
  recommendations: string[];
}

export interface ChaosMetric {
  name: string;
  before: number;
  during: number;
  after: number;
  unit: string;
  threshold: number;
  passed: boolean;
}