/**
 * Plugin System Types
 * 
 * Comprehensive type definitions for the plugin dependency resolver,
 * compatibility checker, and version manager systems.
 */

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  type?: 'core' | 'frontend' | 'backend' | 'extension' | 'integration';
  author?: string;
  homepage?: string;
  repository?: string;
  license?: string;
  tags?: string[];
  category?: string;
  
  // Version constraints
  backstageVersion?: string;
  
  // Dependencies
  dependencies?: PluginDependency[];
  peerDependencies?: PluginDependency[];
  optionalDependencies?: PluginDependency[];
  
  // Incompatibilities
  incompatibleWith?: string[];
  
  // System requirements
  requirements?: SystemRequirements;
  
  // Configuration
  configuration?: PluginConfiguration;
  
  // Installation info
  installationStatus?: 'installed' | 'available' | 'updating' | 'error';
  installPath?: string;
  
  // Metadata
  createdAt?: string;
  updatedAt?: string;
  downloads?: number;
  rating?: number;
  verified?: boolean;
}

export interface PluginDependency {
  id: string;
  version: string;
  versionConstraint?: string;
  optional?: boolean;
  reason?: string;
  scope?: 'runtime' | 'build' | 'dev';
}

export interface SystemRequirements {
  nodeVersion?: string;
  npmVersion?: string;
  backstageVersion?: string;
  operatingSystem?: string[];
  architecture?: string[];
  memory?: number; // MB
  cpu?: number; // cores
  diskSpace?: number; // MB
  networkAccess?: boolean;
  nodeFeatures?: string[];
}

export interface PluginConfiguration {
  schema?: any; // JSON Schema
  defaults?: Record<string, any>;
  required?: string[];
  sections?: ConfigSection[];
}

export interface ConfigSection {
  name: string;
  title: string;
  description?: string;
  fields: ConfigField[];
}

export interface ConfigField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'select' | 'multiselect';
  label: string;
  description?: string;
  required?: boolean;
  default?: any;
  options?: Array<{ label: string; value: any }>;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
  };
}

// Dependency Resolution Types

export interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphNode {
  id: string;
  label: string;
  version: string;
  type: string;
  resolved: boolean;
  conflicts: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: 'required' | 'optional' | 'peer';
}

export type ResolutionStrategy = 'strict' | 'permissive' | 'latest' | 'compatible';

export interface ConflictResolution {
  strategy: ResolutionStrategy;
  autoResolve: boolean;
  userChoice?: string;
}

// Compatibility Types

export interface CompatibilityReport {
  pluginId: string;
  compatible: boolean;
  issues: CompatibilityIssue[];
  warnings: string[];
  performanceImpact: PerformanceMetrics;
  recommendations: string[];
  checkTime: number;
  systemInfo: SystemInfo;
}

export interface CompatibilityIssue {
  type: 'version' | 'system' | 'resource' | 'performance' | 'plugin';
  severity: 'critical' | 'warning' | 'info';
  component: string;
  issue: string;
  currentValue?: string;
  requiredValue?: string;
  suggestion: string;
  autoFixable: boolean;
}

export interface CompatibilityRule {
  id: string;
  name: string;
  condition: (plugin: Plugin) => boolean;
  severity: 'critical' | 'warning' | 'info';
  message: string;
}

export interface SystemInfo {
  nodeVersion: string;
  npmVersion: string;
  operatingSystem: string;
  architecture: string;
  availableMemory: number;
  cpuCores: number;
  backstageVersion: string;
  installedPlugins: string[];
}

export interface PerformanceMetrics {
  memoryUsage: number; // MB
  cpuUsage: number; // percentage
  bundleSize: number; // KB
  startupTime: number; // ms
  loadTime: number; // ms
  impactScore: number; // 1-10 scale
}

// Version Management Types

export interface VersionConstraint {
  range: string;
  source: string;
  preferLts?: boolean;
  allowPrerelease?: boolean;
}

export interface UpgradePath {
  from: string;
  to: string;
  type: 'major' | 'minor' | 'patch';
  description: string;
  estimatedTime: number; // hours
  breakingChanges: string[];
}

export interface BreakingChange {
  version: string;
  type: 'api' | 'config' | 'dependency' | 'major';
  description: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  migrationPath: string;
  autoFixable: boolean;
  codeExample?: {
    before: string;
    after: string;
  };
}

export interface MigrationGuide {
  id: string;
  title: string;
  overview: string;
  steps: MigrationStep[];
  codeExamples: CodeExample[];
  warnings: string[];
  estimatedTime: number; // hours
  difficulty: 'easy' | 'medium' | 'hard';
  automatedSteps: number;
  manualSteps: number;
}

export interface MigrationStep {
  title: string;
  description: string;
  code?: {
    before: string;
    after: string;
  };
}

export interface CodeExample {
  title: string;
  before: string;
  after: string;
}

// Installation Types

export interface InstallationOptions {
  strategy?: ResolutionStrategy;
  skipOptional?: boolean;
  force?: boolean;
  dryRun?: boolean;
  autoResolveConflicts?: boolean;
}

export interface InstallationResult {
  success: boolean;
  installedPlugins: string[];
  skippedPlugins: string[];
  errors: InstallationError[];
  warnings: string[];
  installationTime: number;
}

export interface InstallationError {
  pluginId: string;
  error: string;
  code: string;
  recoverable: boolean;
  suggestion?: string;
}

export interface InstallationProgress {
  pluginId: string;
  stage: 'downloading' | 'installing' | 'configuring' | 'testing' | 'completed' | 'error';
  progress: number; // 0-100
  message: string;
  error?: string;
}

// Registry Types

export interface PluginRegistry {
  name: string;
  url: string;
  type: 'official' | 'community' | 'private';
  authenticated: boolean;
  trusted: boolean;
}

export interface PluginSearchResult {
  plugins: Plugin[];
  total: number;
  page: number;
  pageSize: number;
  filters: SearchFilters;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export interface SearchFilters {
  query?: string;
  category?: string;
  type?: string[];
  tags?: string[];
  author?: string;
  verified?: boolean;
  minRating?: number;
  backstageVersion?: string;
}

// Configuration Types

export interface PluginConfig {
  enabled: boolean;
  configuration: Record<string, any>;
  overrides?: Record<string, any>;
  environment?: 'development' | 'staging' | 'production';
}

export interface GlobalPluginConfig {
  registries: PluginRegistry[];
  defaultStrategy: ResolutionStrategy;
  autoUpdate: boolean;
  allowPrerelease: boolean;
  maxConcurrentInstalls: number;
  cacheSettings: CacheSettings;
}

export interface CacheSettings {
  enabled: boolean;
  ttl: number; // seconds
  maxSize: number; // MB
  cleanupInterval: number; // seconds
}

// API Response Types

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Event Types

export interface PluginEvent {
  type: 'install' | 'uninstall' | 'update' | 'enable' | 'disable' | 'configure';
  pluginId: string;
  timestamp: string;
  userId?: string;
  details?: Record<string, any>;
}

export interface DependencyEvent {
  type: 'resolved' | 'conflict' | 'missing' | 'circular';
  pluginId: string;
  dependencyId?: string;
  details: Record<string, any>;
  timestamp: string;
}

// UI Component Types

export interface DependencyGraphProps {
  plugins: Plugin[];
  selectedPlugin?: string;
  onPluginSelect?: (pluginId: string) => void;
  onConflictResolve?: (conflict: any, resolution: ConflictResolution) => void;
  showConflicts?: boolean;
  interactive?: boolean;
  layout?: 'hierarchical' | 'force' | 'circular';
}

export interface CompatibilityCheckProps {
  plugin: Plugin;
  onIssueResolve?: (issue: CompatibilityIssue) => void;
  showRecommendations?: boolean;
  autoFix?: boolean;
}

export interface VersionManagerProps {
  plugin: Plugin;
  targetVersion?: string;
  onUpgrade?: (plugin: Plugin, targetVersion: string) => void;
  showMigrationGuide?: boolean;
}

// Utility Types

export type PluginStatus = 'installed' | 'available' | 'updating' | 'error' | 'disabled';

export type ConflictType = 'version' | 'circular' | 'missing' | 'incompatible';

export type CompatibilityLevel = 'compatible' | 'warning' | 'incompatible';

export type InstallationStage = 
  | 'validating'
  | 'resolving'
  | 'downloading'
  | 'installing'
  | 'configuring'
  | 'testing'
  | 'completed'
  | 'error';

// Error Types

export class PluginError extends Error {
  constructor(
    message: string,
    public code: string,
    public pluginId?: string,
    public recoverable: boolean = false
  ) {
    super(message);
    this.name = 'PluginError';
  }
}

export class DependencyError extends PluginError {
  constructor(
    message: string,
    public dependencyId: string,
    pluginId?: string
  ) {
    super(message, 'DEPENDENCY_ERROR', pluginId, false);
    this.name = 'DependencyError';
  }
}

export class CompatibilityError extends PluginError {
  constructor(
    message: string,
    public issue: CompatibilityIssue,
    pluginId?: string
  ) {
    super(message, 'COMPATIBILITY_ERROR', pluginId, issue.autoFixable);
    this.name = 'CompatibilityError';
  }
}

export class VersionError extends PluginError {
  constructor(
    message: string,
    public currentVersion: string,
    public requiredVersion: string,
    pluginId?: string
  ) {
    super(message, 'VERSION_ERROR', pluginId, false);
    this.name = 'VersionError';
  }
}