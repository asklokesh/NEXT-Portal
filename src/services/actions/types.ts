/**
 * Self-Service Actions Types
 * Defines types for triggerable actions in the portal
 */

/**
 * Action categories
 */
export type ActionCategory =
  | 'deployment'
  | 'infrastructure'
  | 'ci-cd'
  | 'database'
  | 'security'
  | 'observability'
  | 'maintenance'
  | 'notifications'
  | 'integrations'
  | 'custom';

/**
 * Action execution context
 */
export type ActionContext = 'service' | 'team' | 'environment' | 'global';

/**
 * Action trigger type
 */
export type ActionTriggerType = 'manual' | 'scheduled' | 'webhook' | 'event' | 'api';

/**
 * Action parameter types
 */
export type ActionParameterType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'entity-picker'
  | 'environment-picker'
  | 'secret'
  | 'json'
  | 'file';

/**
 * Action execution status
 */
export type ActionExecutionStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timed_out';

/**
 * Self-service action definition
 */
export interface SelfServiceAction {
  id: string;
  name: string;
  description: string;
  category: ActionCategory;
  context: ActionContext;
  icon?: string;

  // Visibility and permissions
  enabled: boolean;
  visibility: 'public' | 'private' | 'restricted';
  allowedRoles?: string[];
  allowedTeams?: string[];
  allowedEntityTypes?: string[];

  // Execution configuration
  execution: ActionExecutionConfig;

  // Input parameters
  parameters: ActionParameter[];

  // Validation and approval
  requiresApproval?: boolean;
  approvers?: string[];
  validation?: ActionValidation;

  // Execution limits
  limits?: ActionLimits;

  // Scheduling
  schedule?: ActionSchedule;

  // UI configuration
  ui?: ActionUIConfig;

  // Metadata
  metadata: ActionMetadata;

  // Tags for filtering
  tags: string[];
}

/**
 * Action execution configuration
 */
export interface ActionExecutionConfig {
  type: 'http' | 'github-workflow' | 'gitlab-pipeline' | 'jenkins' | 'argo-workflow' |
        'kubernetes' | 'terraform' | 'ansible' | 'script' | 'lambda' | 'custom';

  // HTTP webhook configuration
  http?: {
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    headers?: Record<string, string>;
    body?: Record<string, unknown>;
    timeout?: number;
    retries?: number;
  };

  // GitHub Actions configuration
  githubWorkflow?: {
    owner: string;
    repo: string;
    workflow: string;
    ref?: string;
    inputs?: Record<string, string>;
  };

  // GitLab CI/CD configuration
  gitlabPipeline?: {
    projectId: string;
    ref?: string;
    variables?: Record<string, string>;
  };

  // Jenkins configuration
  jenkins?: {
    url: string;
    job: string;
    parameters?: Record<string, string>;
  };

  // Argo Workflows configuration
  argoWorkflow?: {
    namespace: string;
    workflowTemplate: string;
    parameters?: Record<string, string>;
  };

  // Kubernetes configuration
  kubernetes?: {
    cluster?: string;
    namespace: string;
    resource: 'deployment' | 'job' | 'cronjob' | 'pod';
    action: 'create' | 'apply' | 'delete' | 'scale' | 'restart' | 'rollback';
    manifest?: string;
  };

  // Terraform configuration
  terraform?: {
    workspace: string;
    operation: 'plan' | 'apply' | 'destroy';
    variables?: Record<string, unknown>;
  };

  // Custom script configuration
  script?: {
    runtime: 'bash' | 'python' | 'node' | 'go';
    code: string;
    timeout?: number;
  };

  // AWS Lambda configuration
  lambda?: {
    functionName: string;
    region?: string;
    payload?: Record<string, unknown>;
  };

  // Polling configuration for status checks
  polling?: {
    enabled: boolean;
    interval: number; // ms
    maxAttempts: number;
    statusEndpoint?: string;
  };
}

/**
 * Action parameter definition
 */
export interface ActionParameter {
  name: string;
  title: string;
  description?: string;
  type: ActionParameterType;
  required: boolean;
  default?: unknown;

  // For select/multiselect
  options?: ActionParameterOption[];
  dynamicOptions?: {
    endpoint: string;
    valuePath: string;
    labelPath: string;
    dependsOn?: string[];
  };

  // For entity-picker
  entityType?: string;

  // For environment-picker
  environments?: string[];

  // Validation
  validation?: {
    pattern?: string;
    message?: string;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
  };

  // UI hints
  ui?: {
    placeholder?: string;
    helpText?: string;
    widget?: 'input' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'slider' | 'code-editor';
    hidden?: boolean;
    dependsOn?: {
      parameter: string;
      value: unknown;
    };
  };
}

/**
 * Parameter option
 */
export interface ActionParameterOption {
  label: string;
  value: string | number | boolean;
  description?: string;
  icon?: string;
}

/**
 * Action validation configuration
 */
export interface ActionValidation {
  // Pre-execution checks
  preChecks?: ActionPreCheck[];

  // Confirmation requirements
  confirmationMessage?: string;
  requiresConfirmation?: boolean;
  requiresReasonInput?: boolean;

  // Risk assessment
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  warningMessage?: string;
}

/**
 * Pre-execution check
 */
export interface ActionPreCheck {
  name: string;
  description: string;
  type: 'http' | 'entity-exists' | 'scorecard-passing' | 'custom';
  config: Record<string, unknown>;
  failureAction: 'block' | 'warn';
}

/**
 * Action execution limits
 */
export interface ActionLimits {
  // Rate limiting
  maxConcurrent?: number;
  maxPerHour?: number;
  maxPerDay?: number;

  // Timeout
  timeout?: number; // ms

  // Cooldown between executions
  cooldown?: number; // ms

  // Entity-specific limits
  perEntity?: {
    maxConcurrent?: number;
    maxPerHour?: number;
    cooldown?: number;
  };
}

/**
 * Action scheduling configuration
 */
export interface ActionSchedule {
  enabled: boolean;
  cron?: string;
  timezone?: string;
  nextRun?: string;
  lastRun?: string;
}

/**
 * Action UI configuration
 */
export interface ActionUIConfig {
  // Display order in action list
  order?: number;

  // Custom icon
  icon?: string;
  iconColor?: string;

  // Button style
  buttonVariant?: 'primary' | 'secondary' | 'danger' | 'warning';
  buttonText?: string;

  // Grouping
  group?: string;

  // Show in quick actions
  quickAction?: boolean;

  // Custom result renderer
  resultTemplate?: string;
}

/**
 * Action metadata
 */
export interface ActionMetadata {
  owner: string;
  ownerEmail?: string;
  createdAt: string;
  updatedAt: string;
  version: string;
  documentationUrl?: string;
  supportChannel?: string;

  // Usage stats
  totalExecutions: number;
  successRate: number;
  averageExecutionTime?: number;
  lastExecutedAt?: string;
}

/**
 * Action execution record
 */
export interface ActionExecution {
  id: string;
  actionId: string;
  actionName: string;

  // Context
  entityRef?: string;
  environment?: string;

  // Execution details
  status: ActionExecutionStatus;
  triggeredBy: string;
  triggerType: ActionTriggerType;
  parameters: Record<string, unknown>;

  // Timing
  startedAt: string;
  completedAt?: string;
  duration?: number;

  // Results
  result?: ActionExecutionResult;

  // Approval
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvalReason?: string;

  // Logs
  logs?: ActionExecutionLog[];
}

/**
 * Action execution result
 */
export interface ActionExecutionResult {
  success: boolean;
  message?: string;
  outputs?: Record<string, unknown>;
  links?: ActionResultLink[];
  artifacts?: ActionResultArtifact[];
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Result link
 */
export interface ActionResultLink {
  label: string;
  url: string;
  icon?: string;
}

/**
 * Result artifact
 */
export interface ActionResultArtifact {
  name: string;
  type: 'file' | 'report' | 'log' | 'image';
  url?: string;
  content?: string;
  size?: number;
}

/**
 * Execution log entry
 */
export interface ActionExecutionLog {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: Record<string, unknown>;
}

/**
 * Action approval request
 */
export interface ActionApprovalRequest {
  id: string;
  executionId: string;
  action: SelfServiceAction;
  requestedBy: string;
  requestedAt: string;
  parameters: Record<string, unknown>;
  entityRef?: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewComment?: string;
  expiresAt: string;
}

/**
 * Action group for organization
 */
export interface ActionGroup {
  id: string;
  name: string;
  description: string;
  icon?: string;
  order: number;
  actions: string[]; // Action IDs
}

/**
 * Quick action for entity pages
 */
export interface QuickAction {
  actionId: string;
  entityTypes: string[];
  position: 'header' | 'sidebar' | 'menu';
  label?: string;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'danger';
}
