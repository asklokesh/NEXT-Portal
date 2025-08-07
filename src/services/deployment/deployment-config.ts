/**
 * Comprehensive deployment configuration and type definitions
 * Enterprise-grade deployment automation system
 */

import { EventEmitter } from 'events';

// Base deployment configuration
export interface DeploymentConfig {
  id: string;
  name: string;
  version: string;
  environment: string;
  namespace?: string;
  strategy: DeploymentStrategy;
  rollback?: RollbackConfig;
  healthCheck?: HealthCheckConfig;
  resources?: ResourceConfig;
  security?: SecurityConfig;
  monitoring?: MonitoringConfig;
  gitops?: GitOpsConfig;
  approvals?: ApprovalConfig[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Deployment strategy types
export type DeploymentStrategy = 
  | 'rolling'
  | 'blue-green'
  | 'canary'
  | 'a-b-testing'
  | 'recreate'
  | 'immutable';

export interface DeploymentStrategyConfig {
  type: DeploymentStrategy;
  parameters: Record<string, any>;
  timeout?: number;
  maxUnavailable?: string | number;
  maxSurge?: string | number;
}

// Progressive delivery configurations
export interface CanaryConfig {
  steps: CanaryStep[];
  trafficSplitting: TrafficSplittingConfig;
  analysisTemplate?: AnalysisTemplate;
  autoPromotion?: boolean;
  autoRollback?: boolean;
}

export interface CanaryStep {
  weight: number;
  duration: string;
  pause?: boolean;
  analysis?: AnalysisConfig;
}

export interface BlueGreenConfig {
  activeService: string;
  previewService: string;
  autoPromotion?: boolean;
  scaleDownDelay?: string;
  prePromotionAnalysis?: AnalysisConfig;
  postPromotionAnalysis?: AnalysisConfig;
}

export interface ABTestingConfig {
  variants: ABVariant[];
  trafficSplitting: TrafficSplittingConfig;
  duration: string;
  successMetrics: string[];
}

export interface ABVariant {
  name: string;
  weight: number;
  config: Record<string, any>;
}

export interface TrafficSplittingConfig {
  type: 'weighted' | 'header' | 'cookie' | 'geographic';
  rules: TrafficRule[];
}

export interface TrafficRule {
  match: Record<string, any>;
  destination: string;
  weight?: number;
}

// GitOps configuration
export interface GitOpsConfig {
  repository: GitRepository;
  branch: string;
  path: string;
  syncPolicy: SyncPolicy;
  autoSync: boolean;
  selfHeal: boolean;
  prune: boolean;
  allowEmpty: boolean;
  webhook?: WebhookConfig;
}

export interface GitRepository {
  url: string;
  type: 'git' | 'helm' | 'kustomize';
  credentials?: GitCredentials;
  revision?: string;
}

export interface GitCredentials {
  username?: string;
  password?: string;
  sshPrivateKey?: string;
  caCert?: string;
  insecure?: boolean;
}

export interface SyncPolicy {
  automated?: boolean;
  syncOptions?: string[];
  retry?: RetryPolicy;
}

export interface RetryPolicy {
  limit: number;
  backoff: BackoffPolicy;
}

export interface BackoffPolicy {
  duration: string;
  factor: number;
  maxDuration: string;
}

export interface WebhookConfig {
  enabled: boolean;
  url: string;
  secret?: string;
  events: string[];
}

// Pipeline configuration
export interface PipelineConfig {
  id: string;
  name: string;
  stages: PipelineStage[];
  triggers: PipelineTrigger[];
  variables?: Record<string, any>;
  timeout?: number;
  parallelism?: number;
  retryPolicy?: RetryPolicy;
}

export interface PipelineStage {
  id: string;
  name: string;
  type: StageType;
  dependsOn?: string[];
  condition?: string;
  timeout?: number;
  retryPolicy?: RetryPolicy;
  approvals?: ApprovalConfig[];
  tasks: PipelineTask[];
}

export type StageType = 
  | 'build'
  | 'test'
  | 'security-scan'
  | 'deploy'
  | 'validation'
  | 'promotion'
  | 'rollback'
  | 'cleanup';

export interface PipelineTask {
  id: string;
  name: string;
  type: TaskType;
  config: Record<string, any>;
  timeout?: number;
  retryPolicy?: RetryPolicy;
  artifacts?: ArtifactConfig[];
}

export type TaskType = 
  | 'script'
  | 'docker-build'
  | 'kubernetes-deploy'
  | 'helm-deploy'
  | 'security-scan'
  | 'load-test'
  | 'approval'
  | 'notification';

export interface PipelineTrigger {
  type: TriggerType;
  config: Record<string, any>;
  enabled: boolean;
}

export type TriggerType = 
  | 'git'
  | 'webhook'
  | 'schedule'
  | 'manual'
  | 'artifact';

// Environment configuration
export interface EnvironmentConfig {
  id: string;
  name: string;
  type: EnvironmentType;
  cloud: CloudProvider;
  region: string;
  kubernetes?: KubernetesConfig;
  networking?: NetworkingConfig;
  monitoring?: MonitoringConfig;
  security?: SecurityConfig;
  resources?: ResourceQuota;
  policies?: PolicyConfig[];
}

export type EnvironmentType = 
  | 'development'
  | 'staging'
  | 'production'
  | 'testing'
  | 'preview';

export type CloudProvider = 
  | 'aws'
  | 'gcp'
  | 'azure'
  | 'kubernetes'
  | 'local';

export interface KubernetesConfig {
  cluster: string;
  context: string;
  namespace: string;
  serviceAccount?: string;
  rbac?: RBACConfig;
}

export interface RBACConfig {
  enabled: boolean;
  rules?: RBACRule[];
}

export interface RBACRule {
  apiGroups: string[];
  resources: string[];
  verbs: string[];
}

export interface NetworkingConfig {
  ingress?: IngressConfig;
  serviceMesh?: ServiceMeshConfig;
  networkPolicies?: NetworkPolicy[];
}

export interface IngressConfig {
  enabled: boolean;
  className?: string;
  annotations?: Record<string, string>;
  tls?: TLSConfig[];
}

export interface TLSConfig {
  secretName: string;
  hosts: string[];
}

export interface ServiceMeshConfig {
  enabled: boolean;
  provider: 'istio' | 'linkerd' | 'consul';
  config?: Record<string, any>;
}

export interface NetworkPolicy {
  name: string;
  spec: Record<string, any>;
}

// Health check configuration
export interface HealthCheckConfig {
  enabled: boolean;
  httpGet?: HTTPHealthCheck;
  tcpSocket?: TCPHealthCheck;
  exec?: ExecHealthCheck;
  initialDelaySeconds?: number;
  periodSeconds?: number;
  timeoutSeconds?: number;
  successThreshold?: number;
  failureThreshold?: number;
}

export interface HTTPHealthCheck {
  path: string;
  port: number;
  scheme?: 'HTTP' | 'HTTPS';
  headers?: Record<string, string>;
}

export interface TCPHealthCheck {
  port: number;
}

export interface ExecHealthCheck {
  command: string[];
}

// Resource configuration
export interface ResourceConfig {
  requests?: ResourceRequests;
  limits?: ResourceLimits;
  hpa?: HPAConfig;
  vpa?: VPAConfig;
}

export interface ResourceRequests {
  cpu?: string;
  memory?: string;
  storage?: string;
}

export interface ResourceLimits {
  cpu?: string;
  memory?: string;
  storage?: string;
}

export interface HPAConfig {
  enabled: boolean;
  minReplicas: number;
  maxReplicas: number;
  targetCPUUtilization?: number;
  targetMemoryUtilization?: number;
  customMetrics?: CustomMetric[];
}

export interface VPAConfig {
  enabled: boolean;
  updateMode: 'Off' | 'Initial' | 'Recreation' | 'Auto';
}

export interface CustomMetric {
  name: string;
  target: number;
  type: 'Pods' | 'Object' | 'External';
}

export interface ResourceQuota {
  hard?: Record<string, string>;
}

// Security configuration
export interface SecurityConfig {
  podSecurityPolicy?: string;
  securityContext?: SecurityContext;
  networkPolicies?: NetworkPolicy[];
  serviceAccount?: string;
  imagePullSecrets?: string[];
  secrets?: SecretConfig[];
}

export interface SecurityContext {
  runAsUser?: number;
  runAsGroup?: number;
  runAsNonRoot?: boolean;
  readOnlyRootFilesystem?: boolean;
  allowPrivilegeEscalation?: boolean;
  capabilities?: CapabilitiesConfig;
}

export interface CapabilitiesConfig {
  add?: string[];
  drop?: string[];
}

export interface SecretConfig {
  name: string;
  type: string;
  data: Record<string, string>;
}

// Monitoring configuration
export interface MonitoringConfig {
  enabled: boolean;
  metrics?: MetricsConfig;
  logging?: LoggingConfig;
  tracing?: TracingConfig;
  alerting?: AlertingConfig;
}

export interface MetricsConfig {
  enabled: boolean;
  port?: number;
  path?: string;
  scrapeInterval?: string;
  labels?: Record<string, string>;
}

export interface LoggingConfig {
  enabled: boolean;
  level?: string;
  format?: string;
  destination?: string;
}

export interface TracingConfig {
  enabled: boolean;
  sampler?: TracingSampler;
  jaeger?: JaegerConfig;
}

export interface TracingSampler {
  type: 'const' | 'probabilistic' | 'rateLimiting';
  param: number;
}

export interface JaegerConfig {
  endpoint: string;
  agent?: string;
}

export interface AlertingConfig {
  enabled: boolean;
  rules: AlertRule[];
  receivers: AlertReceiver[];
}

export interface AlertRule {
  name: string;
  condition: string;
  severity: 'info' | 'warning' | 'critical';
  duration?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface AlertReceiver {
  name: string;
  type: 'email' | 'slack' | 'pagerduty' | 'webhook';
  config: Record<string, any>;
}

// Rollback configuration
export interface RollbackConfig {
  enabled: boolean;
  automatic?: boolean;
  triggers: RollbackTrigger[];
  strategy?: RollbackStrategy;
  timeout?: number;
  preserveResources?: boolean;
}

export interface RollbackTrigger {
  type: 'health-check' | 'metric' | 'manual' | 'time-based';
  config: Record<string, any>;
  threshold?: number;
  duration?: string;
}

export interface RollbackStrategy {
  type: 'immediate' | 'gradual';
  steps?: RollbackStep[];
}

export interface RollbackStep {
  percentage: number;
  duration: string;
}

// Analysis configuration
export interface AnalysisConfig {
  enabled: boolean;
  templates: AnalysisTemplate[];
  successCondition?: string;
  failureCondition?: string;
  interval?: string;
  count?: number;
}

export interface AnalysisTemplate {
  name: string;
  spec: AnalysisTemplateSpec;
}

export interface AnalysisTemplateSpec {
  metrics: AnalysisMetric[];
  args?: AnalysisArgument[];
}

export interface AnalysisMetric {
  name: string;
  provider: MetricProvider;
  query: string;
  successCondition?: string;
  failureCondition?: string;
  interval?: string;
  count?: number;
}

export interface MetricProvider {
  prometheus?: PrometheusProvider;
  datadog?: DatadogProvider;
  newRelic?: NewRelicProvider;
  cloudWatch?: CloudWatchProvider;
}

export interface PrometheusProvider {
  address: string;
  query: string;
}

export interface DatadogProvider {
  apiKey: string;
  appKey: string;
  query: string;
}

export interface NewRelicProvider {
  apiKey: string;
  query: string;
}

export interface CloudWatchProvider {
  region: string;
  metricName: string;
  namespace: string;
  dimensions?: Record<string, string>;
  statistic: string;
}

export interface AnalysisArgument {
  name: string;
  value?: string;
  valueFrom?: ValueFromSource;
}

export interface ValueFromSource {
  fieldRef?: FieldRef;
  secretKeyRef?: SecretKeyRef;
  configMapKeyRef?: ConfigMapKeyRef;
}

export interface FieldRef {
  fieldPath: string;
}

export interface SecretKeyRef {
  name: string;
  key: string;
}

export interface ConfigMapKeyRef {
  name: string;
  key: string;
}

// Approval configuration
export interface ApprovalConfig {
  id: string;
  name: string;
  type: ApprovalType;
  required: boolean;
  approvers: ApprovalUser[];
  timeout?: number;
  conditions?: ApprovalCondition[];
}

export type ApprovalType = 
  | 'manual'
  | 'automatic'
  | 'policy-based'
  | 'consensus';

export interface ApprovalUser {
  id: string;
  name: string;
  email: string;
  role?: string;
}

export interface ApprovalCondition {
  type: string;
  value: any;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'not-in';
}

// Artifact configuration
export interface ArtifactConfig {
  name: string;
  type: ArtifactType;
  location: string;
  optional?: boolean;
  metadata?: Record<string, any>;
}

export type ArtifactType = 
  | 'image'
  | 'helm-chart'
  | 'manifest'
  | 'binary'
  | 'report'
  | 'logs';

// Policy configuration
export interface PolicyConfig {
  name: string;
  type: PolicyType;
  spec: Record<string, any>;
  enforcement: PolicyEnforcement;
}

export type PolicyType = 
  | 'security'
  | 'compliance'
  | 'resource'
  | 'network'
  | 'governance';

export type PolicyEnforcement = 
  | 'strict'
  | 'warn'
  | 'disabled';

// Deployment status and events
export interface DeploymentStatus {
  phase: DeploymentPhase;
  message?: string;
  startTime?: Date;
  endTime?: Date;
  conditions: DeploymentCondition[];
  health?: HealthStatus;
  sync?: SyncStatus;
  resources?: ResourceStatus[];
}

export type DeploymentPhase = 
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'rollback'
  | 'suspended';

export interface DeploymentCondition {
  type: string;
  status: 'True' | 'False' | 'Unknown';
  lastTransitionTime: Date;
  reason?: string;
  message?: string;
}

export interface HealthStatus {
  status: 'Healthy' | 'Degraded' | 'Progressing' | 'Suspended' | 'Missing' | 'Unknown';
  message?: string;
}

export interface SyncStatus {
  status: 'Synced' | 'OutOfSync' | 'Unknown';
  revision?: string;
  comparedTo?: ComparedTo;
}

export interface ComparedTo {
  source: ApplicationSource;
  destination: ApplicationDestination;
}

export interface ApplicationSource {
  repoURL: string;
  path?: string;
  targetRevision?: string;
}

export interface ApplicationDestination {
  server: string;
  namespace: string;
}

export interface ResourceStatus {
  name: string;
  kind: string;
  namespace?: string;
  version?: string;
  status: 'Synced' | 'OutOfSync' | 'Unknown';
  health?: HealthStatus;
}

// Event types
export interface DeploymentEvent {
  id: string;
  deploymentId: string;
  type: EventType;
  timestamp: Date;
  data: Record<string, any>;
  source: string;
}

export type EventType = 
  | 'deployment-started'
  | 'deployment-progressing'
  | 'deployment-succeeded'
  | 'deployment-failed'
  | 'rollback-triggered'
  | 'rollback-completed'
  | 'approval-required'
  | 'approval-granted'
  | 'approval-denied'
  | 'health-check-failed'
  | 'sync-failed'
  | 'drift-detected';

// Integration configurations
export interface IntegrationConfig {
  type: IntegrationType;
  name: string;
  enabled: boolean;
  config: Record<string, any>;
  credentials?: IntegrationCredentials;
}

export type IntegrationType = 
  | 'kubernetes'
  | 'docker'
  | 'helm'
  | 'terraform'
  | 'github-actions'
  | 'gitlab-ci'
  | 'jenkins'
  | 'argocd'
  | 'flux'
  | 'tekton'
  | 'spinnaker';

export interface IntegrationCredentials {
  type: 'basic' | 'token' | 'oauth' | 'certificate' | 'service-account';
  data: Record<string, string>;
}

// Default configurations
export const DEFAULT_DEPLOYMENT_CONFIG: Partial<DeploymentConfig> = {
  strategy: 'rolling',
  healthCheck: {
    enabled: true,
    initialDelaySeconds: 30,
    periodSeconds: 10,
    timeoutSeconds: 5,
    successThreshold: 1,
    failureThreshold: 3
  },
  resources: {
    requests: {
      cpu: '100m',
      memory: '128Mi'
    },
    limits: {
      cpu: '500m',
      memory: '512Mi'
    }
  },
  rollback: {
    enabled: true,
    automatic: true,
    triggers: [{
      type: 'health-check',
      config: { enabled: true },
      threshold: 3
    }],
    timeout: 300
  },
  monitoring: {
    enabled: true,
    metrics: {
      enabled: true,
      port: 9090,
      path: '/metrics'
    },
    logging: {
      enabled: true,
      level: 'info'
    }
  }
};

export const DEFAULT_GITOPS_CONFIG: Partial<GitOpsConfig> = {
  autoSync: true,
  selfHeal: true,
  prune: true,
  allowEmpty: false,
  syncPolicy: {
    automated: true,
    syncOptions: ['CreateNamespace=true'],
    retry: {
      limit: 5,
      backoff: {
        duration: '5s',
        factor: 2,
        maxDuration: '3m'
      }
    }
  }
};

export const DEFAULT_PIPELINE_CONFIG: Partial<PipelineConfig> = {
  timeout: 3600,
  parallelism: 1,
  retryPolicy: {
    limit: 3,
    backoff: {
      duration: '30s',
      factor: 2,
      maxDuration: '5m'
    }
  }
};

// Event emitter for deployment events
export class DeploymentEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
  }

  emitDeploymentEvent(event: DeploymentEvent): void {
    this.emit('deployment-event', event);
    this.emit(event.type, event);
  }
}

// Configuration validation
export class ConfigValidator {
  static validateDeploymentConfig(config: DeploymentConfig): string[] {
    const errors: string[] = [];

    if (!config.id) errors.push('Deployment ID is required');
    if (!config.name) errors.push('Deployment name is required');
    if (!config.version) errors.push('Deployment version is required');
    if (!config.environment) errors.push('Environment is required');

    // Validate strategy-specific configuration
    if (config.strategy === 'canary' && !config.metadata?.canary) {
      errors.push('Canary configuration is required for canary strategy');
    }

    if (config.strategy === 'blue-green' && !config.metadata?.blueGreen) {
      errors.push('Blue-green configuration is required for blue-green strategy');
    }

    return errors;
  }

  static validatePipelineConfig(config: PipelineConfig): string[] {
    const errors: string[] = [];

    if (!config.id) errors.push('Pipeline ID is required');
    if (!config.name) errors.push('Pipeline name is required');
    if (!config.stages || config.stages.length === 0) {
      errors.push('At least one stage is required');
    }

    // Validate stage dependencies
    const stageIds = new Set(config.stages.map(s => s.id));
    for (const stage of config.stages) {
      if (stage.dependsOn) {
        for (const dependency of stage.dependsOn) {
          if (!stageIds.has(dependency)) {
            errors.push(`Stage ${stage.id} depends on non-existent stage ${dependency}`);
          }
        }
      }
    }

    return errors;
  }
}

export * from './types';