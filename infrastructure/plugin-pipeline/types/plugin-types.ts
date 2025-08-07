/**
 * Plugin Installation Pipeline Type Definitions
 * 
 * Comprehensive type system for plugin orchestration and lifecycle management
 */

export interface PluginDefinition {
  name: string;
  version: string;
  description: string;
  category: PluginCategory;
  author: string;
  homepage?: string;
  repository?: string;
  license: string;
  
  // Runtime configuration
  runtime: {
    type: 'frontend' | 'backend' | 'fullstack';
    nodeVersion?: string;
    framework?: string;
    buildCommand?: string;
    startCommand?: string;
  };
  
  // Resource requirements
  resources: {
    cpu: {
      request: string;
      limit: string;
    };
    memory: {
      request: string;
      limit: string;
    };
    storage?: {
      size: string;
      type: 'ephemeral' | 'persistent';
    };
  };
  
  // Dependencies
  dependencies?: PluginDependency[];
  peerDependencies?: PluginDependency[];
  
  // Security configuration
  security: {
    runAsNonRoot: boolean;
    runAsUser?: number;
    allowPrivilegeEscalation: boolean;
    capabilities?: {
      add?: string[];
      drop?: string[];
    };
    seccompProfile?: string;
    seLinuxOptions?: any;
  };
  
  // Network configuration
  networking: {
    ports: PluginPort[];
    ingress?: PluginIngress;
    serviceMesh?: {
      enabled: boolean;
      mTLS: boolean;
      retries?: number;
      timeout?: string;
    };
  };
  
  // Health checks
  healthChecks: {
    liveness: HealthCheck;
    readiness: HealthCheck;
    startup?: HealthCheck;
  };
  
  // Configuration and secrets
  configuration?: {
    configMaps?: string[];
    secrets?: string[];
    environment?: { [key: string]: string };
  };
  
  // Persistence
  persistence?: {
    volumes?: VolumeMount[];
    databases?: DatabaseRequirement[];
  };
  
  // Monitoring and observability
  observability: {
    metrics?: {
      enabled: boolean;
      path: string;
      port: number;
    };
    tracing?: {
      enabled: boolean;
      samplingRate?: number;
    };
    logging?: {
      level: string;
      format: string;
    };
  };
  
  // Plugin-specific metadata
  metadata: {
    tags: string[];
    maturity: 'alpha' | 'beta' | 'stable' | 'deprecated';
    supportContact?: string;
    documentation?: string;
    changelog?: string;
  };
}

export interface PluginDependency {
  name: string;
  version: string;
  optional?: boolean;
}

export interface PluginPort {
  name: string;
  port: number;
  targetPort?: number;
  protocol: 'TCP' | 'UDP';
  expose?: boolean;
}

export interface PluginIngress {
  enabled: boolean;
  host?: string;
  path?: string;
  pathType?: 'Prefix' | 'Exact';
  tls?: {
    enabled: boolean;
    secretName?: string;
  };
  annotations?: { [key: string]: string };
}

export interface HealthCheck {
  type: 'http' | 'tcp' | 'exec';
  path?: string;
  port?: number;
  command?: string[];
  initialDelaySeconds: number;
  periodSeconds: number;
  timeoutSeconds: number;
  successThreshold: number;
  failureThreshold: number;
}

export interface VolumeMount {
  name: string;
  mountPath: string;
  readOnly?: boolean;
  size?: string;
  storageClass?: string;
}

export interface DatabaseRequirement {
  type: 'postgresql' | 'mysql' | 'mongodb' | 'redis';
  version: string;
  database?: string;
  user?: string;
  required: boolean;
}

export enum PluginCategory {
  FRONTEND = 'frontend',
  BACKEND = 'backend',
  INFRASTRUCTURE = 'infrastructure',
  MONITORING = 'monitoring',
  SECURITY = 'security',
  CI_CD = 'ci-cd',
  DOCUMENTATION = 'documentation',
  INTEGRATION = 'integration'
}

export enum DeploymentStrategy {
  ROLLING_UPDATE = 'rolling-update',
  BLUE_GREEN = 'blue-green',
  CANARY = 'canary',
  A_B_TEST = 'a-b-test',
  RECREATE = 'recreate'
}

export interface PluginInstallationStatus {
  installationId: string;
  pluginName: string;
  version: string;
  status: 'pending' | 'building' | 'deploying' | 'installed' | 'failed' | 'updating' | 'uninstalling';
  deploymentInfo?: DeploymentInfo;
  error?: string;
  timestamp: Date;
  installationDuration?: number;
  rollbackInfo?: RollbackInfo;
}

export interface DeploymentInfo {
  namespace: string;
  deploymentName: string;
  serviceName: string;
  ingressName?: string;
  replicas: number;
  strategy: DeploymentStrategy;
  imageTag: string;
  resourceAllocation: {
    cpu: string;
    memory: string;
    storage?: string;
  };
  endpoints: {
    internal?: string;
    external?: string;
  };
  createdAt: Date;
  updatedAt?: Date;
}

export interface RollbackInfo {
  previousVersion: string;
  rollbackReason: string;
  rollbackTimestamp: Date;
  rollbackDuration?: number;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'unknown';
  message?: string;
  timestamp: Date;
  checks?: {
    liveness: boolean;
    readiness: boolean;
    startup?: boolean;
  };
  metrics?: {
    cpu: number;
    memory: number;
    requests: number;
    errors: number;
  };
}

export interface PluginRegistry {
  name: string;
  version: string;
  description: string;
  category: PluginCategory;
  installationStatus: 'installed' | 'updating' | 'failed' | 'uninstalled';
  healthStatus: 'healthy' | 'unhealthy' | 'unknown';
  lastUpdated: Date;
  deploymentInfo?: DeploymentInfo;
}

export interface SecurityScanResult {
  pluginName: string;
  version: string;
  hasVulnerabilities: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  vulnerabilities: Vulnerability[];
  scanTimestamp: Date;
  scanner: string;
}

export interface Vulnerability {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  package: string;
  version: string;
  fixedIn?: string;
  references: string[];
}

export interface PluginManifest {
  apiVersion: string;
  kind: 'Plugin';
  metadata: {
    name: string;
    namespace: string;
    labels?: { [key: string]: string };
    annotations?: { [key: string]: string };
  };
  spec: PluginDefinition;
}

export interface PluginOperationEvent {
  type: 'install' | 'update' | 'uninstall' | 'health-check' | 'scale' | 'rollback';
  pluginName: string;
  timestamp: Date;
  userId?: string;
  details: any;
  result: 'success' | 'failure' | 'in-progress';
}

export interface ResourceQuota {
  namespace: string;
  hard: {
    'requests.cpu': string;
    'requests.memory': string;
    'limits.cpu': string;
    'limits.memory': string;
    'requests.storage': string;
    pods: string;
    services: string;
    persistentvolumeclaims: string;
  };
  used?: Partial<ResourceQuota['hard']>;
}

export interface PluginScalingPolicy {
  pluginName: string;
  minReplicas: number;
  maxReplicas: number;
  metrics: ScalingMetric[];
  behavior?: {
    scaleUp?: ScalingBehavior;
    scaleDown?: ScalingBehavior;
  };
}

export interface ScalingMetric {
  type: 'Resource' | 'Pods' | 'Object' | 'External';
  resource?: {
    name: 'cpu' | 'memory';
    target: {
      type: 'Utilization' | 'AverageValue';
      averageUtilization?: number;
      averageValue?: string;
    };
  };
  pods?: {
    metric: {
      name: string;
      selector?: any;
    };
    target: {
      type: 'AverageValue';
      averageValue: string;
    };
  };
}

export interface ScalingBehavior {
  stabilizationWindowSeconds: number;
  selectPolicy: 'Max' | 'Min' | 'Disabled';
  policies: ScalingPolicy[];
}

export interface ScalingPolicy {
  type: 'Pods' | 'Percent';
  value: number;
  periodSeconds: number;
}

export interface PluginBackup {
  pluginName: string;
  version: string;
  backupId: string;
  timestamp: Date;
  size: string;
  type: 'full' | 'incremental';
  storageLocation: string;
  retention: {
    days: number;
    autoDelete: boolean;
  };
  checksum: string;
}

export interface PluginRestorePoint {
  pluginName: string;
  backupId: string;
  version: string;
  timestamp: Date;
  description?: string;
  verified: boolean;
}