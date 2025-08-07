/**
 * Core types for the enterprise API versioning system
 */

export interface SemanticVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  buildMetadata?: string;
  raw: string;
}

export interface APIVersion {
  version: SemanticVersion;
  releaseDate: Date;
  deprecationDate?: Date;
  sunsetDate?: Date;
  status: 'active' | 'deprecated' | 'sunset';
  breaking: boolean;
  changelog: ChangelogEntry[];
  migrations: Migration[];
}

export interface ChangelogEntry {
  type: 'added' | 'changed' | 'deprecated' | 'removed' | 'fixed' | 'security';
  description: string;
  impact: 'low' | 'medium' | 'high' | 'breaking';
  component: string;
  relatedIssues?: string[];
}

export interface Migration {
  from: string;
  to: string;
  type: 'automatic' | 'manual' | 'assisted';
  description: string;
  steps: MigrationStep[];
  estimatedTime: number; // minutes
  risks: Risk[];
}

export interface MigrationStep {
  title: string;
  description: string;
  type: 'code' | 'data' | 'config' | 'deployment';
  automated: boolean;
  command?: string;
  validation?: ValidationRule;
}

export interface Risk {
  level: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  mitigation: string;
}

export interface CompatibilityMatrix {
  versions: string[];
  compatibility: Record<string, Record<string, CompatibilityStatus>>;
  testResults: TestResult[];
  lastUpdated: Date;
}

export interface CompatibilityStatus {
  compatible: boolean;
  issues: CompatibilityIssue[];
  confidence: number; // 0-100
  testCoverage: number; // 0-100
}

export interface CompatibilityIssue {
  type: 'breaking' | 'deprecated' | 'changed' | 'performance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  component: string;
  description: string;
  workaround?: string;
}

export interface TestResult {
  testId: string;
  fromVersion: string;
  toVersion: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  errors: TestError[];
  timestamp: Date;
}

export interface TestError {
  type: string;
  message: string;
  component: string;
  stack?: string;
}

export interface ValidationRule {
  type: 'schema' | 'data' | 'behavior' | 'performance';
  rule: string;
  message: string;
}

export interface VersioningConfig {
  strategy: 'semantic' | 'calendar' | 'sequential';
  defaultLifetime: number; // days
  deprecationPeriod: number; // days
  sunsetPeriod: number; // days
  breakingChangePolicy: 'major' | 'minor' | 'patch';
  autoMigration: boolean;
  contractTesting: boolean;
  canaryDeployment: boolean;
}

export interface APIEndpoint {
  path: string;
  method: string;
  version: string;
  handler: Function;
  schema?: any;
  deprecated?: boolean;
  sunset?: Date;
  alternatives?: string[];
}

export interface GraphQLVersioning {
  schemaVersion: string;
  fieldVersioning: Record<string, FieldVersion>;
  typeVersioning: Record<string, TypeVersion>;
  directiveVersioning: Record<string, DirectiveVersion>;
}

export interface FieldVersion {
  introducedIn: string;
  deprecatedIn?: string;
  removedIn?: string;
  reason?: string;
  replacement?: string;
}

export interface TypeVersion {
  introducedIn: string;
  deprecatedIn?: string;
  removedIn?: string;
  changes: TypeChange[];
}

export interface DirectiveVersion {
  introducedIn: string;
  deprecatedIn?: string;
  removedIn?: string;
  arguments: Record<string, ArgumentVersion>;
}

export interface ArgumentVersion {
  introducedIn: string;
  deprecatedIn?: string;
  removedIn?: string;
  typeChanged?: boolean;
}

export interface TypeChange {
  version: string;
  type: 'field_added' | 'field_removed' | 'field_type_changed' | 'field_deprecated';
  field?: string;
  description: string;
  breaking: boolean;
}

export interface DeploymentStrategy {
  type: 'blue-green' | 'canary' | 'rolling' | 'recreate';
  config: DeploymentConfig;
  healthChecks: HealthCheck[];
  rollbackTriggers: RollbackTrigger[];
}

export interface DeploymentConfig {
  canaryWeight?: number; // 0-100
  rolloutDuration?: number; // minutes
  simultaneousVersions?: number;
  trafficSplitConfig?: TrafficSplitConfig;
}

export interface TrafficSplitConfig {
  rules: TrafficRule[];
  defaultRoute: string;
  stickyRouting: boolean;
}

export interface TrafficRule {
  condition: string;
  version: string;
  weight: number;
}

export interface HealthCheck {
  type: 'http' | 'tcp' | 'custom';
  endpoint?: string;
  interval: number; // seconds
  timeout: number; // seconds
  successThreshold: number;
  failureThreshold: number;
}

export interface RollbackTrigger {
  type: 'error_rate' | 'latency' | 'custom';
  threshold: number;
  duration: number; // seconds
  action: 'rollback' | 'alert' | 'pause';
}

export interface VersionAnalytics {
  usage: VersionUsage[];
  performance: PerformanceMetrics[];
  errors: ErrorMetrics[];
  adoption: AdoptionMetrics;
}

export interface VersionUsage {
  version: string;
  requests: number;
  uniqueClients: number;
  endpoints: Record<string, number>;
  timestamp: Date;
}

export interface PerformanceMetrics {
  version: string;
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
  throughput: number;
  errorRate: number;
  timestamp: Date;
}

export interface ErrorMetrics {
  version: string;
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsByEndpoint: Record<string, number>;
  timestamp: Date;
}

export interface AdoptionMetrics {
  totalClients: number;
  versionDistribution: Record<string, number>;
  migrationProgress: MigrationProgress[];
  deprecatedVersionUsage: Record<string, number>;
}

export interface MigrationProgress {
  fromVersion: string;
  toVersion: string;
  completedClients: number;
  totalClients: number;
  estimatedCompletion: Date;
}

export interface SDKConfig {
  language: 'typescript' | 'javascript' | 'python' | 'java' | 'go' | 'rust';
  outputPath: string;
  packageName: string;
  version: string;
  features: SDKFeature[];
}

export interface SDKFeature {
  name: string;
  enabled: boolean;
  config?: Record<string, any>;
}

export interface ClientVersionInfo {
  currentVersion: string;
  latestVersion: string;
  compatibleVersions: string[];
  deprecationWarnings: DeprecationWarning[];
  migrationPath?: MigrationPath;
}

export interface DeprecationWarning {
  component: string;
  version: string;
  message: string;
  sunset?: Date;
  alternatives: string[];
}

export interface MigrationPath {
  steps: MigrationPathStep[];
  estimatedDuration: number;
  breakingChanges: boolean;
  automationAvailable: boolean;
}

export interface MigrationPathStep {
  version: string;
  changes: string[];
  breaking: boolean;
  automated: boolean;
}

export interface DocumentationVersion {
  version: string;
  generated: Date;
  formats: DocumentationFormat[];
  changelog: string;
  migrationGuide?: string;
  examples: CodeExample[];
}

export interface DocumentationFormat {
  format: 'openapi' | 'graphql' | 'markdown' | 'html' | 'pdf';
  path: string;
  size: number;
}

export interface CodeExample {
  language: string;
  title: string;
  description: string;
  code: string;
  version: string;
}