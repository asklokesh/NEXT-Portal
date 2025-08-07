export interface ProgressiveDeploymentConfig {
  strategy: 'canary' | 'blue-green' | 'feature-flag' | 'ab-testing';
  service: {
    name: string;
    namespace: string;
    version: string;
    image: string;
    port: number;
  };
  analysis: {
    interval: string; // e.g., "30s", "1m", "5m"
    threshold: number; // error rate threshold (e.g., 0.01 for 1%)
    metrics: MetricQuery[];
    successConditions: string[];
    failureConditions: string[];
  };
  traffic: {
    canaryWeight: number; // percentage for canary
    maxWeight: number; // maximum traffic to canary
    stepWeight: number; // increment for each step
    stepWeightPromotion: number; // promotion step
  };
  approval: {
    required: boolean;
    approvers: string[];
    timeout: string;
    gates: ApprovalGate[];
  };
  rollback: {
    automatic: boolean;
    threshold: number;
    timeout: string;
  };
  multiRegion: {
    enabled: boolean;
    regions: string[];
    strategy: 'sequential' | 'parallel' | 'canary-first';
  };
}

export interface MetricQuery {
  name: string;
  query: string;
  provider: 'prometheus' | 'datadog' | 'newrelic' | 'custom';
  threshold: number;
  comparison: '>' | '<' | '>=' | '<=' | '==';
  interval: string;
}

export interface ApprovalGate {
  name: string;
  type: 'manual' | 'automated' | 'conditional';
  condition?: string;
  timeout: string;
  required: boolean;
}

export interface DeploymentPhase {
  name: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'paused';
  startTime?: Date;
  endTime?: Date;
  metrics?: MetricResult[];
  conditions?: ConditionResult[];
  traffic: TrafficSplit;
  canaryWeight: number;
}

export interface MetricResult {
  name: string;
  value: number;
  threshold: number;
  status: 'success' | 'failure' | 'unknown';
  timestamp: Date;
}

export interface ConditionResult {
  type: string;
  status: 'success' | 'failure' | 'progressing';
  reason: string;
  message: string;
  timestamp: Date;
}

export interface TrafficSplit {
  stable: number;
  canary: number;
  preview?: number;
}

export interface ProgressiveDeployment {
  id: string;
  name: string;
  namespace: string;
  config: ProgressiveDeploymentConfig;
  status: 'initializing' | 'running' | 'succeeded' | 'failed' | 'paused' | 'terminated';
  currentPhase: number;
  phases: DeploymentPhase[];
  createdAt: Date;
  updatedAt: Date;
  metadata: {
    gitCommit?: string;
    gitBranch?: string;
    triggeredBy: string;
    reason?: string;
  };
}

export interface FlaggerCanary {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec: {
    targetRef: {
      apiVersion: string;
      kind: string;
      name: string;
    };
    autoscalerRef?: {
      apiVersion: string;
      kind: string;
      name: string;
    };
    service: {
      port: number;
      targetPort?: number;
      portName?: string;
      portDiscovery?: boolean;
      gateways?: string[];
      hosts?: string[];
      match?: Array<{
        headers?: Record<string, any>;
        uri?: any;
      }>;
      rewrite?: {
        uri: string;
      };
      timeout?: string;
      retries?: {
        attempts: number;
        perTryTimeout: string;
        retryOn: string;
      };
    };
    analysis: {
      interval: string;
      threshold: number;
      maxWeight: number;
      stepWeight: number;
      stepWeightPromotion?: number;
      stepWeights?: number[];
      iterations?: number;
      match?: Array<{
        headers?: Record<string, any>;
        sourceLabels?: Record<string, string>;
      }>;
      sessionAffinity?: {
        cookieName: string;
        maxAge: number;
      };
      metrics: Array<{
        name: string;
        interval?: string;
        thresholdRange?: {
          min?: number;
          max?: number;
        };
        query?: string;
      }>;
      webhooks?: Array<{
        name: string;
        url: string;
        timeout?: string;
        metadata?: Record<string, string>;
      }>;
    };
  };
  status?: {
    phase: string;
    canaryWeight: number;
    iterations: number;
    lastAppliedSpec: string;
    lastTransitionTime: string;
    conditions: Array<{
      type: string;
      status: string;
      lastUpdateTime: string;
      lastTransitionTime: string;
      reason: string;
      message: string;
    }>;
  };
}

export interface ArgoRollout {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec: {
    replicas?: number;
    strategy: {
      canary?: {
        maxSurge?: string | number;
        maxUnavailable?: string | number;
        steps?: Array<{
          setWeight?: number;
          pause?: {
            duration?: string;
          };
          setCanaryScale?: {
            weight?: number;
            matchTrafficWeight?: boolean;
            replicas?: number;
          };
          analysis?: {
            templates: Array<{
              templateName: string;
              clusterScope?: boolean;
              args?: Array<{
                name: string;
                value?: string;
                valueFrom?: {
                  podTemplateHashValue?: string;
                  fieldRef?: {
                    fieldPath: string;
                  };
                };
              }>;
            }>;
            args?: Array<{
              name: string;
              value?: string;
            }>;
          };
        }>;
        canaryService?: string;
        stableService?: string;
        trafficRouting?: {
          istio?: {
            virtualService?: {
              name: string;
              routes?: string[];
            };
            destinationRule?: {
              name: string;
              canarySubsetName?: string;
              stableSubsetName?: string;
            };
          };
          nginx?: {
            stableIngress: string;
            annotationPrefix?: string;
            additionalIngressAnnotations?: Record<string, string>;
          };
          alb?: {
            ingress: string;
            servicePort: number;
            annotationPrefix?: string;
          };
        };
        analysis?: {
          templates: Array<{
            templateName: string;
            clusterScope?: boolean;
          }>;
          args?: Array<{
            name: string;
            value: string;
          }>;
        };
      };
      blueGreen?: {
        activeService: string;
        previewService: string;
        autoPromotionEnabled?: boolean;
        scaleDownDelaySeconds?: number;
        prePromotionAnalysis?: {
          templates: Array<{
            templateName: string;
            clusterScope?: boolean;
          }>;
          args?: Array<{
            name: string;
            value: string;
          }>;
        };
        postPromotionAnalysis?: {
          templates: Array<{
            templateName: string;
            clusterScope?: boolean;
          }>;
          args?: Array<{
            name: string;
            value: string;
          }>;
        };
        previewReplicaCount?: number;
        antiAffinity?: {
          requiredDuringSchedulingIgnoredDuringExecution?: any;
          preferredDuringSchedulingIgnoredDuringExecution?: any;
        };
      };
    };
    selector: {
      matchLabels: Record<string, string>;
    };
    template: {
      metadata: {
        labels: Record<string, string>;
      };
      spec: any; // Pod spec
    };
    revisionHistoryLimit?: number;
    progressDeadlineSeconds?: number;
    restartAt?: string;
  };
  status?: {
    observedGeneration: number;
    phase: string;
    message?: string;
    currentPodHash: string;
    stableRS?: string;
    canaryRS?: string;
    currentStepIndex?: number;
    currentStepHash?: string;
    currentExperiment?: {
      name: string;
      phase: string;
      message?: string;
    };
    conditions: Array<{
      type: string;
      status: string;
      lastUpdateTime: string;
      lastTransitionTime: string;
      reason: string;
      message: string;
    }>;
    canaryRevision?: string;
    stableRevision?: string;
    restartedAt?: string;
    HPAReplicas?: number;
    selector?: string;
    availableReplicas?: number;
    readyReplicas?: number;
    replicas?: number;
    updatedReplicas?: number;
  };
}

export interface AnalysisTemplate {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace?: string;
    labels?: Record<string, string>;
  };
  spec: {
    args?: Array<{
      name: string;
      value?: string;
      valueFrom?: {
        podTemplateHashValue?: string;
        fieldRef?: {
          fieldPath: string;
        };
      };
    }>;
    metrics: Array<{
      name: string;
      interval?: string;
      initialDelay?: string;
      count?: number;
      successCondition?: string;
      failureCondition?: string;
      failureLimit?: number;
      inconclusiveLimit?: number;
      consecutiveErrorLimit?: number;
      provider: {
        prometheus?: {
          address: string;
          query: string;
          authentication?: {
            oauth2?: {
              tokenUrl: string;
              clientId: string;
              clientSecret: string;
              scopes?: string[];
            };
          };
        };
        datadog?: {
          address: string;
          apiVersion?: string;
          query: string;
          apiKey: string;
          appKey: string;
          interval?: string;
        };
        wavefront?: {
          address: string;
          query: string;
          token: string;
        };
        newRelic?: {
          profile: string;
          query: string;
        };
        job?: {
          spec: any; // Job spec
        };
        web?: {
          url: string;
          headers?: Array<{
            key: string;
            value: string;
          }>;
          timeoutSeconds?: number;
          jsonPath?: string;
          insecure?: boolean;
          method?: string;
          body?: string;
        };
      };
    }>;
    dryRun?: Array<{
      metricName: string;
    }>;
  };
}

export interface FeatureFlagConfig {
  name: string;
  enabled: boolean;
  rules: Array<{
    conditions: Array<{
      attribute: string;
      operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than';
      value: string;
    }>;
    percentage: number;
    variant?: string;
  }>;
  variants?: Array<{
    name: string;
    value: any;
    weight: number;
  }>;
  targeting?: {
    enabled: boolean;
    rules: Array<{
      attribute: string;
      operator: string;
      values: string[];
      percentage?: number;
    }>;
  };
}

export interface ABTestConfig {
  name: string;
  description: string;
  hypothesis: string;
  variants: Array<{
    name: string;
    weight: number;
    config: Record<string, any>;
  }>;
  metrics: Array<{
    name: string;
    type: 'conversion' | 'numeric' | 'retention';
    query: string;
    goal: 'increase' | 'decrease';
  }>;
  audience: {
    percentage: number;
    filters: Array<{
      attribute: string;
      operator: string;
      value: string;
    }>;
  };
  duration: {
    startDate: Date;
    endDate: Date;
    minRuntime: string;
  };
  statistics: {
    confidenceLevel: number; // 0.95 for 95%
    minimumDetectableEffect: number; // 0.05 for 5%
    power: number; // 0.8 for 80%
  };
}

export interface ABTestResult {
  variant: string;
  metrics: Array<{
    name: string;
    value: number;
    variance: number;
    sampleSize: number;
  }>;
  significance: {
    pValue: number;
    confidenceInterval: [number, number];
    isSignificant: boolean;
    effect: number;
  };
}

export interface ProgressiveDeliveryEvent {
  id: string;
  deploymentId: string;
  type: 'phase_started' | 'phase_completed' | 'phase_failed' | 'approval_required' | 'rollback_triggered' | 'deployment_completed';
  timestamp: Date;
  phase?: string;
  data: Record<string, any>;
  metadata: {
    triggeredBy: string;
    reason?: string;
    automated: boolean;
  };
}

export interface DeploymentApproval {
  id: string;
  deploymentId: string;
  phase: string;
  approver: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  reason?: string;
  timestamp: Date;
  expiresAt: Date;
}

export interface MultiRegionDeployment {
  id: string;
  name: string;
  regions: Array<{
    name: string;
    status: 'pending' | 'running' | 'succeeded' | 'failed';
    deployment?: ProgressiveDeployment;
    dependsOn?: string[];
  }>;
  strategy: 'sequential' | 'parallel' | 'canary-first';
  globalStatus: 'pending' | 'running' | 'succeeded' | 'failed' | 'partial';
}