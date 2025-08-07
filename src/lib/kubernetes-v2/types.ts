/**
 * Kubernetes V2 Plugin - Advanced Types
 * Comprehensive type definitions for the next-generation Kubernetes plugin
 */

export interface CloudProvider {
  type: 'aws' | 'gcp' | 'azure' | 'bare-metal' | 'hybrid';
  name: string;
  region: string;
  config: Record<string, any>;
  authentication: {
    method: 'service-account' | 'oauth' | 'iam' | 'certificate';
    credentials: Record<string, any>;
  };
}

export interface KubernetesClusterV2 {
  id: string;
  name: string;
  displayName: string;
  version: string;
  provider: CloudProvider;
  environment: 'development' | 'staging' | 'production' | 'test';
  
  // Connection details
  endpoint: string;
  dashboardUrl?: string;
  region: string;
  zones: string[];
  
  // Status and health
  status: 'healthy' | 'warning' | 'error' | 'unknown';
  lastSeen: string;
  uptime: number;
  
  // Capacity and metrics
  capacity: {
    nodes: number;
    cpu: string;
    memory: string;
    storage: string;
    pods: number;
  };
  
  usage: {
    cpu: number;
    memory: number;
    storage: number;
    pods: number;
    networkIO: number;
  };
  
  // Cost information
  cost: {
    daily: number;
    monthly: number;
    currency: string;
    breakdown: {
      compute: number;
      storage: number;
      network: number;
      other: number;
    };
  };
  
  // Security and compliance
  security: {
    rbacEnabled: boolean;
    podSecurityStandards: boolean;
    networkPolicies: boolean;
    encryptionAtRest: boolean;
    vulnerabilityCount: number;
    complianceScore: number;
  };
  
  // Metadata
  labels: Record<string, string>;
  annotations: Record<string, string>;
  tags: Record<string, string>;
  created: string;
  updated: string;
}

export interface KubernetesNamespace {
  name: string;
  cluster: string;
  status: 'active' | 'terminating';
  phase: string;
  
  // Resource quotas
  quotas: {
    cpu: { limit: string; used: string };
    memory: { limit: string; used: string };
    storage: { limit: string; used: string };
    pods: { limit: number; used: number };
  };
  
  // Cost tracking
  cost: {
    daily: number;
    monthly: number;
    trend: 'up' | 'down' | 'stable';
  };
  
  // Security
  security: {
    networkPolicies: number;
    podSecurityPolicies: number;
    serviceAccounts: number;
    secrets: number;
  };
  
  labels: Record<string, string>;
  annotations: Record<string, string>;
  created: string;
}

export interface KubernetesWorkloadV2 {
  id: string;
  name: string;
  namespace: string;
  cluster: string;
  type: 'deployment' | 'statefulset' | 'daemonset' | 'job' | 'cronjob' | 'replicaset';
  
  // Status
  status: {
    phase: string;
    replicas: {
      desired: number;
      available: number;
      ready: number;
      updated: number;
    };
    conditions: Array<{
      type: string;
      status: string;
      reason?: string;
      message?: string;
      lastTransition: string;
    }>;
  };
  
  // Performance metrics
  metrics: {
    cpu: { current: number; limit: number; request: number };
    memory: { current: number; limit: number; request: number };
    network: { rx: number; tx: number };
    restarts: number;
    uptime: number;
  };
  
  // Cost analysis
  cost: {
    hourly: number;
    daily: number;
    monthly: number;
    efficiency: number; // 0-100 score
    recommendations: CostOptimizationRecommendation[];
  };
  
  // Security
  security: {
    vulnerabilities: SecurityVulnerability[];
    complianceScore: number;
    privileged: boolean;
    capabilities: string[];
    seLinuxContext?: string;
  };
  
  // Health and observability
  health: {
    score: number; // 0-100
    checks: HealthCheck[];
    alerts: Alert[];
    logs: LogEntry[];
  };
  
  // Images and containers
  containers: Array<{
    name: string;
    image: string;
    imageTag: string;
    vulnerabilities: number;
    size: number;
    lastUpdated: string;
  }>;
  
  // Relationships
  dependencies: string[];
  dependents: string[];
  services: string[];
  configMaps: string[];
  secrets: string[];
  
  labels: Record<string, string>;
  annotations: Record<string, string>;
  created: string;
  updated: string;
}

export interface CostOptimizationRecommendation {
  id: string;
  type: 'rightsizing' | 'scheduling' | 'storage' | 'network' | 'spot-instances';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: {
    cost: number;
    performance: number;
    reliability: number;
  };
  effort: 'low' | 'medium' | 'high';
  implementation: {
    automated: boolean;
    steps: string[];
    estimatedTime: string;
  };
  created: string;
}

export interface SecurityVulnerability {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'cve' | 'configuration' | 'rbac' | 'network' | 'image';
  title: string;
  description: string;
  component: string;
  version?: string;
  fixAvailable: boolean;
  fix?: {
    version?: string;
    steps: string[];
  };
  references: string[];
  discovered: string;
}

export interface HealthCheck {
  id: string;
  name: string;
  type: 'liveness' | 'readiness' | 'startup' | 'custom';
  status: 'passing' | 'failing' | 'warning';
  message: string;
  lastCheck: string;
  frequency: string;
}

export interface Alert {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  description: string;
  source: string;
  labels: Record<string, string>;
  state: 'firing' | 'pending' | 'resolved';
  created: string;
  resolved?: string;
}

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  source: string;
  labels: Record<string, string>;
}

export interface NetworkPolicy {
  id: string;
  name: string;
  namespace: string;
  cluster: string;
  
  spec: {
    podSelector: Record<string, any>;
    policyTypes: string[];
    ingress?: Array<{
      from?: Array<{
        podSelector?: Record<string, any>;
        namespaceSelector?: Record<string, any>;
        ipBlock?: {
          cidr: string;
          except?: string[];
        };
      }>;
      ports?: Array<{
        protocol: string;
        port: number | string;
        endPort?: number;
      }>;
    }>;
    egress?: Array<{
      to?: Array<{
        podSelector?: Record<string, any>;
        namespaceSelector?: Record<string, any>;
        ipBlock?: {
          cidr: string;
          except?: string[];
        };
      }>;
      ports?: Array<{
        protocol: string;
        port: number | string;
        endPort?: number;
      }>;
    }>;
  };
  
  status: {
    appliedTo: number;
    violations: number;
    lastUpdated: string;
  };
  
  visualization: {
    connections: Array<{
      from: string;
      to: string;
      protocol: string;
      port: number;
      allowed: boolean;
    }>;
  };
  
  created: string;
  updated: string;
}

export interface CustomResourceDefinition {
  id: string;
  name: string;
  group: string;
  version: string;
  kind: string;
  plural: string;
  cluster: string;
  
  spec: {
    scope: 'Namespaced' | 'Cluster';
    versions: Array<{
      name: string;
      served: boolean;
      storage: boolean;
      schema: any;
    }>;
    subresources?: {
      status?: any;
      scale?: any;
    };
  };
  
  instances: number;
  status: 'active' | 'deprecated' | 'removed';
  
  documentation: {
    description: string;
    examples: any[];
    fields: Array<{
      name: string;
      type: string;
      description: string;
      required: boolean;
    }>;
  };
  
  created: string;
  updated: string;
}

export interface GitOpsApplication {
  id: string;
  name: string;
  namespace: string;
  cluster: string;
  
  source: {
    repoUrl: string;
    path: string;
    targetRevision: string;
    helm?: {
      valueFiles: string[];
      parameters: Record<string, string>;
    };
    kustomize?: {
      namePrefix: string;
      nameSuffix: string;
      images: string[];
    };
  };
  
  destination: {
    server: string;
    namespace: string;
  };
  
  status: {
    sync: {
      status: 'synced' | 'out-of-sync' | 'unknown';
      revision: string;
      comparedTo: {
        source: any;
        destination: any;
      };
    };
    health: {
      status: 'healthy' | 'progressing' | 'degraded' | 'suspended' | 'missing' | 'unknown';
      message?: string;
    };
    resources: Array<{
      group: string;
      kind: string;
      name: string;
      namespace?: string;
      status: string;
      health: string;
    }>;
    operationState?: {
      phase: string;
      startedAt: string;
      finishedAt?: string;
      message?: string;
    };
  };
  
  automation: {
    syncPolicy?: {
      automated?: {
        prune: boolean;
        selfHeal: boolean;
      };
      syncOptions?: string[];
    };
  };
  
  created: string;
  updated: string;
}

export interface TroubleshootingSession {
  id: string;
  title: string;
  cluster: string;
  namespace?: string;
  resource?: {
    type: string;
    name: string;
  };
  
  status: 'active' | 'resolved' | 'escalated';
  priority: 'low' | 'medium' | 'high' | 'critical';
  
  symptoms: string[];
  analysis: {
    rootCause?: string;
    confidence: number;
    recommendations: string[];
    relatedIssues: string[];
  };
  
  timeline: Array<{
    timestamp: string;
    event: string;
    details: string;
    user?: string;
  }>;
  
  aiInsights: {
    suggestedActions: string[];
    knowledgeBaseArticles: string[];
    similarIncidents: string[];
  };
  
  created: string;
  updated: string;
  resolved?: string;
}

export interface DisasterRecoveryBackup {
  id: string;
  name: string;
  cluster: string;
  
  scope: {
    namespaces: string[];
    resources: string[];
    excludeResources?: string[];
  };
  
  schedule: {
    frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
    cron?: string;
    retention: {
      days: number;
      count: number;
    };
  };
  
  storage: {
    provider: 'aws-s3' | 'gcs' | 'azure-blob' | 'nfs' | 'local';
    location: string;
    encryption: boolean;
    compression: boolean;
  };
  
  status: {
    phase: 'scheduled' | 'running' | 'completed' | 'failed' | 'deleted';
    lastBackup?: string;
    nextBackup?: string;
    size?: number;
    duration?: number;
    errors?: string[];
  };
  
  created: string;
  updated: string;
}

// AI and ML specific types
export interface AIInsight {
  id: string;
  type: 'anomaly' | 'prediction' | 'optimization' | 'security' | 'cost';
  confidence: number;
  impact: 'low' | 'medium' | 'high' | 'critical';
  
  title: string;
  description: string;
  recommendations: string[];
  
  data: {
    metrics: Record<string, number>;
    trends: Array<{ timestamp: string; value: number }>;
    correlations: Record<string, number>;
  };
  
  created: string;
  expires: string;
}

export interface ResourceOptimization {
  id: string;
  cluster: string;
  namespace?: string;
  resource: string;
  
  current: {
    requests: { cpu: string; memory: string };
    limits: { cpu: string; memory: string };
    usage: { cpu: number; memory: number };
  };
  
  recommended: {
    requests: { cpu: string; memory: string };
    limits: { cpu: string; memory: string };
    reasoning: string;
  };
  
  impact: {
    costSaving: number;
    performanceChange: number;
    reliabilityScore: number;
  };
  
  confidence: number;
  created: string;
}

// Query and filter types
export interface ClusterFilter {
  providers?: string[];
  environments?: string[];
  statuses?: string[];
  regions?: string[];
  costRange?: { min: number; max: number };
  labels?: Record<string, string>;
}

export interface WorkloadFilter {
  clusters?: string[];
  namespaces?: string[];
  types?: string[];
  statuses?: string[];
  healthScores?: { min: number; max: number };
  costRange?: { min: number; max: number };
  labels?: Record<string, string>;
}

export interface KubernetesV2Config {
  clusters: KubernetesClusterV2[];
  features: {
    aiInsights: boolean;
    costOptimization: boolean;
    securityScanning: boolean;
    networkPolicyVisualization: boolean;
    gitopsIntegration: boolean;
    disasterRecovery: boolean;
    troubleshooting: boolean;
  };
  integrations: {
    prometheus?: string;
    grafana?: string;
    jaeger?: string;
    argocd?: string;
    flux?: string;
    velero?: string;
  };
  ui: {
    defaultView: 'clusters' | 'workloads' | 'namespaces';
    refreshInterval: number;
    metricsHistory: number; // days
  };
}

// API Response types
export interface KubernetesV2Response<T> {
  data: T;
  meta: {
    total: number;
    page: number;
    pageSize: number;
    timestamp: string;
  };
  errors?: Array<{
    code: string;
    message: string;
    details?: any;
  }>;
}

export interface ClusterHealthSummary {
  total: number;
  healthy: number;
  warning: number;
  error: number;
  unknown: number;
  trends: {
    period: string;
    data: Array<{
      timestamp: string;
      healthy: number;
      issues: number;
    }>;
  };
}

export interface CostSummary {
  total: {
    daily: number;
    monthly: number;
    yearly: number;
  };
  breakdown: {
    compute: number;
    storage: number;
    network: number;
    other: number;
  };
  trends: Array<{
    date: string;
    cost: number;
  }>;
  savings: {
    potential: number;
    achieved: number;
  };
}

export interface SecuritySummary {
  vulnerabilities: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  compliance: {
    score: number;
    checks: {
      passed: number;
      failed: number;
      total: number;
    };
  };
  trends: Array<{
    date: string;
    vulnerabilities: number;
    compliance: number;
  }>;
}