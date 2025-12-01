/**
 * Software Templates Types
 * Type definitions for the Golden Paths & Template system
 */

// ============================================================================
// Core Template Types
// ============================================================================

export interface SoftwareTemplate {
  id: string;
  name: string;
  title: string;
  description: string;
  owner: string;
  category: TemplateCategory;
  type: TemplateType;
  tags: string[];
  steps: TemplateStep[];
  parameters: TemplateParameter[];
  outputs: TemplateOutput[];
  requirements?: TemplateRequirement[];
  goldenPath?: GoldenPathConfig;
  metadata: TemplateMetadata;
}

export type TemplateCategory =
  | 'service'
  | 'frontend'
  | 'backend'
  | 'library'
  | 'infrastructure'
  | 'data-pipeline'
  | 'ml-model'
  | 'documentation'
  | 'custom';

export type TemplateType =
  | 'create'       // Create new resource
  | 'migrate'      // Migrate existing resource
  | 'configure'    // Configure existing resource
  | 'promote'      // Promote to higher environment
  | 'action';      // Self-service action

export interface TemplateMetadata {
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  version: string;
  status: 'draft' | 'published' | 'deprecated';
  popularity: number;
  usageCount: number;
  averageExecutionTime?: number;
  successRate?: number;
}

// ============================================================================
// Template Parameters
// ============================================================================

export interface TemplateParameter {
  id: string;
  name: string;
  title: string;
  description?: string;
  type: ParameterType;
  required: boolean;
  default?: unknown;
  ui: ParameterUI;
  validation?: ParameterValidation;
  dependsOn?: ParameterDependency[];
  group?: string;
}

export type ParameterType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object'
  | 'entity-ref'
  | 'user-ref'
  | 'group-ref'
  | 'repo-picker'
  | 'owner-picker'
  | 'component-picker'
  | 'secret';

export interface ParameterUI {
  component: ParameterUIComponent;
  placeholder?: string;
  helperText?: string;
  options?: Array<{ label: string; value: string }>;
  multiselect?: boolean;
  rows?: number;
  entityKind?: string;
  catalogFilter?: Record<string, string>;
  allowArbitrary?: boolean;
  allowedHosts?: string[];
}

export type ParameterUIComponent =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'switch'
  | 'entity-picker'
  | 'owner-picker'
  | 'repo-picker'
  | 'secret-input'
  | 'json-editor'
  | 'yaml-editor';

export interface ParameterValidation {
  pattern?: string;
  patternMessage?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  enum?: string[];
  uniqueItems?: boolean;
  custom?: string; // Custom validation function
}

export interface ParameterDependency {
  parameter: string;
  condition: 'equals' | 'not_equals' | 'contains' | 'exists';
  value?: unknown;
}

// ============================================================================
// Template Steps
// ============================================================================

export interface TemplateStep {
  id: string;
  name: string;
  title: string;
  description?: string;
  action: StepAction;
  input: Record<string, unknown>;
  if?: string; // Conditional expression
  continueOnError?: boolean;
  timeout?: number;
}

export type StepAction =
  | 'fetch:template'
  | 'fetch:plain'
  | 'catalog:register'
  | 'catalog:write'
  | 'github:repo:create'
  | 'github:repo:push'
  | 'github:actions:dispatch'
  | 'github:pr:create'
  | 'gitlab:project:create'
  | 'gitlab:pipeline:trigger'
  | 'azure:repo:create'
  | 'bitbucket:repo:create'
  | 'publish:github'
  | 'publish:gitlab'
  | 'publish:bitbucket'
  | 'kubernetes:apply'
  | 'kubernetes:helm'
  | 'terraform:apply'
  | 'ansible:run'
  | 'shell:exec'
  | 'http:request'
  | 'slack:notify'
  | 'email:send'
  | 'jira:create'
  | 'custom:action';

export interface StepActionConfig {
  action: StepAction;
  name: string;
  description: string;
  inputSchema: Record<string, ParameterSchema>;
  outputSchema?: Record<string, ParameterSchema>;
}

export interface ParameterSchema {
  type: string;
  description?: string;
  required?: boolean;
  default?: unknown;
}

// ============================================================================
// Template Outputs
// ============================================================================

export interface TemplateOutput {
  id: string;
  name: string;
  title: string;
  description?: string;
  type: OutputType;
  value: string; // Expression to compute output
}

export type OutputType =
  | 'link'
  | 'text'
  | 'entity-ref'
  | 'json'
  | 'file';

// ============================================================================
// Template Requirements
// ============================================================================

export interface TemplateRequirement {
  type: RequirementType;
  value: string;
  message?: string;
}

export type RequirementType =
  | 'role'           // User must have role
  | 'group'          // User must be in group
  | 'scorecard'      // Entity must meet scorecard level
  | 'integration'    // Integration must be configured
  | 'approval';      // Requires approval from

// ============================================================================
// Golden Path Configuration
// ============================================================================

export interface GoldenPathConfig {
  enabled: boolean;
  recommended: boolean;
  maturityLevel: 'basic' | 'intermediate' | 'advanced';
  compliance: string[];
  features: GoldenPathFeature[];
  presets?: GoldenPathPreset[];
}

export interface GoldenPathFeature {
  name: string;
  description: string;
  included: boolean;
  optional: boolean;
  parameter?: string;
}

export interface GoldenPathPreset {
  id: string;
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

// ============================================================================
// Template Execution
// ============================================================================

export interface TemplateExecution {
  id: string;
  templateId: string;
  templateVersion: string;
  userId: string;
  status: ExecutionStatus;
  parameters: Record<string, unknown>;
  steps: StepExecution[];
  outputs?: Record<string, unknown>;
  error?: string;
  startedAt: string;
  completedAt?: string;
  duration?: number;
}

export type ExecutionStatus =
  | 'pending'
  | 'running'
  | 'waiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface StepExecution {
  stepId: string;
  stepName: string;
  status: StepStatus;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  output?: unknown;
  error?: string;
  logs?: string[];
}

export type StepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

// ============================================================================
// Template Catalog
// ============================================================================

export interface TemplateCatalog {
  templates: SoftwareTemplate[];
  categories: CategoryInfo[];
  featuredTemplates: string[];
  popularTemplates: string[];
  recentTemplates: string[];
}

export interface CategoryInfo {
  id: TemplateCategory;
  name: string;
  description: string;
  icon: string;
  templateCount: number;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface CreateTemplateRequest {
  template: Omit<SoftwareTemplate, 'id' | 'metadata'>;
}

export interface ExecuteTemplateRequest {
  templateId: string;
  parameters: Record<string, unknown>;
  dryRun?: boolean;
}

export interface ExecuteTemplateResponse {
  execution: TemplateExecution;
  dryRunResult?: DryRunResult;
}

export interface DryRunResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
  estimatedSteps: number;
  estimatedDuration?: number;
  resourcesCreated?: string[];
}

export interface TemplateFilterOptions {
  category?: TemplateCategory;
  type?: TemplateType;
  owner?: string;
  status?: string;
  search?: string;
  tags?: string[];
  goldenPath?: boolean;
}

export interface TemplateListResponse {
  templates: SoftwareTemplate[];
  total: number;
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}
