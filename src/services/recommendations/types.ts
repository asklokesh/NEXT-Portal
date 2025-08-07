// Service Recommendations Types

export interface ServiceMetrics {
  performance: {
    responseTime: number;
    throughput: number;
    errorRate: number;
    availability: number;
    latency: number[];
    p50: number;
    p95: number;
    p99: number;
  };
  resource: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkBandwidth: number;
    containerCount: number;
  };
  cost: {
    monthlySpend: number;
    perRequestCost: number;
    infrastructureCost: number;
    operationalCost: number;
  };
  quality: {
    codeComplexity: number;
    testCoverage: number;
    technicalDebt: number;
    securityScore: number;
    documentationScore: number;
  };
}

export interface ServicePattern {
  id: string;
  name: string;
  type: 'performance' | 'security' | 'cost' | 'architecture' | 'quality';
  indicators: string[];
  threshold: number;
  confidence: number;
}

export interface Anomaly {
  id: string;
  serviceId: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  value: number;
  expectedRange: [number, number];
  description: string;
}

export interface Recommendation {
  id: string;
  serviceId: string;
  category: RecommendationCategory;
  type: RecommendationType;
  title: string;
  description: string;
  impact: Impact;
  effort: EffortEstimate;
  priority: number;
  score: number;
  evidence: Evidence[];
  implementation: ImplementationGuide;
  risks: Risk[];
  dependencies: string[];
  status: RecommendationStatus;
  createdAt: Date;
  updatedAt: Date;
}

export enum RecommendationCategory {
  PERFORMANCE = 'performance',
  SECURITY = 'security',
  COST = 'cost',
  ARCHITECTURE = 'architecture',
  QUALITY = 'quality',
  COLLABORATION = 'collaboration',
  TECHNOLOGY = 'technology'
}

export enum RecommendationType {
  // Performance
  CACHING_OPTIMIZATION = 'caching_optimization',
  DATABASE_INDEXING = 'database_indexing',
  QUERY_OPTIMIZATION = 'query_optimization',
  LOAD_BALANCING = 'load_balancing',
  ASYNC_PROCESSING = 'async_processing',
  
  // Security
  VULNERABILITY_PATCH = 'vulnerability_patch',
  ACCESS_CONTROL = 'access_control',
  ENCRYPTION_UPGRADE = 'encryption_upgrade',
  SECRETS_MANAGEMENT = 'secrets_management',
  
  // Cost
  RESOURCE_RIGHTSIZING = 'resource_rightsizing',
  RESERVED_INSTANCES = 'reserved_instances',
  UNUSED_RESOURCE_CLEANUP = 'unused_resource_cleanup',
  SERVICE_CONSOLIDATION = 'service_consolidation',
  
  // Architecture
  MICROSERVICE_DECOMPOSITION = 'microservice_decomposition',
  API_GATEWAY_IMPLEMENTATION = 'api_gateway_implementation',
  EVENT_DRIVEN_MIGRATION = 'event_driven_migration',
  CIRCUIT_BREAKER = 'circuit_breaker',
  
  // Quality
  TEST_COVERAGE_INCREASE = 'test_coverage_increase',
  CODE_REFACTORING = 'code_refactoring',
  DEPENDENCY_UPDATE = 'dependency_update',
  DOCUMENTATION_IMPROVEMENT = 'documentation_improvement',
  
  // Collaboration
  OWNERSHIP_CLARIFICATION = 'ownership_clarification',
  TEAM_RESTRUCTURING = 'team_restructuring',
  COMMUNICATION_IMPROVEMENT = 'communication_improvement',
  
  // Technology
  FRAMEWORK_UPGRADE = 'framework_upgrade',
  LANGUAGE_MIGRATION = 'language_migration',
  TOOL_ADOPTION = 'tool_adoption'
}

export interface Impact {
  performance: number; // 0-100
  security: number;
  cost: number;
  reliability: number;
  maintainability: number;
  userExperience: number;
  businessValue: number;
  description: string;
}

export interface EffortEstimate {
  hours: number;
  teamSize: number;
  complexity: 'low' | 'medium' | 'high';
  skills: string[];
  timeline: string;
}

export interface Evidence {
  type: 'metric' | 'log' | 'trace' | 'alert' | 'benchmark';
  source: string;
  timestamp: Date;
  data: any;
  confidence: number;
}

export interface ImplementationGuide {
  steps: ImplementationStep[];
  codeExamples?: CodeExample[];
  resources: Resource[];
  estimatedDuration: number;
  rollbackPlan?: string;
}

export interface ImplementationStep {
  order: number;
  title: string;
  description: string;
  commands?: string[];
  validation?: string;
}

export interface CodeExample {
  language: string;
  title: string;
  before?: string;
  after: string;
  explanation: string;
}

export interface Resource {
  type: 'documentation' | 'tutorial' | 'tool' | 'library';
  title: string;
  url: string;
  description: string;
}

export interface Risk {
  type: string;
  probability: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  description: string;
  mitigation: string;
}

export enum RecommendationStatus {
  PENDING = 'pending',
  REVIEWED = 'reviewed',
  ACCEPTED = 'accepted',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
  DEFERRED = 'deferred'
}

export interface FeedbackData {
  recommendationId: string;
  userId: string;
  helpful: boolean;
  implemented: boolean;
  actualImpact?: Impact;
  actualEffort?: number;
  comments?: string;
  timestamp: Date;
}

export interface LearningMetrics {
  recommendationId: string;
  acceptanceRate: number;
  implementationRate: number;
  successRate: number;
  averageImpact: Impact;
  feedbackScore: number;
  confidenceAdjustment: number;
}

export interface ModelConfig {
  version: string;
  features: string[];
  hyperparameters: Record<string, any>;
  thresholds: Record<string, number>;
  weights: Record<string, number>;
  lastTraining: Date;
  accuracy: number;
}

export interface ABTestConfig {
  id: string;
  name: string;
  variants: ABTestVariant[];
  metrics: string[];
  startDate: Date;
  endDate: Date;
  status: 'active' | 'completed' | 'cancelled';
}

export interface ABTestVariant {
  id: string;
  name: string;
  allocation: number;
  config: Record<string, any>;
  results?: ABTestResults;
}

export interface ABTestResults {
  sampleSize: number;
  conversionRate: number;
  averageImpact: number;
  confidence: number;
  pValue: number;
}