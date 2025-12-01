/**
 * DORA Metrics Types
 * DevOps Research and Assessment metrics for measuring software delivery performance
 */

/**
 * Time period for metrics aggregation
 */
export type MetricPeriod = 'day' | 'week' | 'month' | 'quarter' | 'year';

/**
 * Performance levels based on DORA classifications
 */
export type PerformanceLevel = 'elite' | 'high' | 'medium' | 'low';

/**
 * Deployment Frequency metric
 * Measures how often code is deployed to production
 */
export interface DeploymentFrequency {
  value: number;
  unit: 'per_day' | 'per_week' | 'per_month';
  performanceLevel: PerformanceLevel;
  trend: MetricTrend;
  history: MetricDataPoint[];
  breakdown?: {
    byTeam?: Record<string, number>;
    byService?: Record<string, number>;
    byEnvironment?: Record<string, number>;
  };
}

/**
 * Lead Time for Changes metric
 * Measures time from commit to production deployment
 */
export interface LeadTimeForChanges {
  value: number;
  unit: 'hours' | 'days';
  performanceLevel: PerformanceLevel;
  trend: MetricTrend;
  history: MetricDataPoint[];
  breakdown?: {
    codeReviewTime: number;
    buildTime: number;
    testTime: number;
    deploymentTime: number;
    waitTime: number;
  };
  percentiles?: {
    p50: number;
    p75: number;
    p90: number;
    p95: number;
  };
}

/**
 * Mean Time to Recovery metric
 * Measures time to recover from production incidents
 */
export interface MeanTimeToRecovery {
  value: number;
  unit: 'minutes' | 'hours';
  performanceLevel: PerformanceLevel;
  trend: MetricTrend;
  history: MetricDataPoint[];
  breakdown?: {
    detectionTime: number;
    triageTime: number;
    resolutionTime: number;
    verificationTime: number;
  };
  incidentCount: number;
  bySeverity?: Record<string, { mttr: number; count: number }>;
}

/**
 * Change Failure Rate metric
 * Measures percentage of deployments causing failures
 */
export interface ChangeFailureRate {
  value: number; // percentage
  performanceLevel: PerformanceLevel;
  trend: MetricTrend;
  history: MetricDataPoint[];
  failedDeployments: number;
  totalDeployments: number;
  breakdown?: {
    byFailureType?: Record<string, number>;
    byTeam?: Record<string, number>;
    byService?: Record<string, number>;
  };
}

/**
 * Metric trend information
 */
export interface MetricTrend {
  direction: 'improving' | 'stable' | 'declining';
  percentageChange: number;
  comparedTo: string; // e.g., "previous month"
}

/**
 * Data point for time series
 */
export interface MetricDataPoint {
  timestamp: string;
  value: number;
  metadata?: Record<string, unknown>;
}

/**
 * Complete DORA metrics snapshot
 */
export interface DORAMetrics {
  period: {
    start: string;
    end: string;
    type: MetricPeriod;
  };
  deploymentFrequency: DeploymentFrequency;
  leadTimeForChanges: LeadTimeForChanges;
  meanTimeToRecovery: MeanTimeToRecovery;
  changeFailureRate: ChangeFailureRate;
  overallPerformance: PerformanceLevel;
  lastUpdated: string;
}

/**
 * Team-level DORA metrics
 */
export interface TeamDORAMetrics extends DORAMetrics {
  teamId: string;
  teamName: string;
  memberCount: number;
  serviceCount: number;
  comparisonToOrg?: {
    deploymentFrequency: number; // relative to org average
    leadTimeForChanges: number;
    meanTimeToRecovery: number;
    changeFailureRate: number;
  };
}

/**
 * Service-level DORA metrics
 */
export interface ServiceDORAMetrics extends DORAMetrics {
  serviceId: string;
  serviceName: string;
  owner: string;
  lifecycle: string;
  tier?: string;
}

/**
 * Organization-level DORA metrics
 */
export interface OrgDORAMetrics extends DORAMetrics {
  teamBreakdown: Record<string, DORAMetrics>;
  topPerformers: {
    teams: Array<{ id: string; name: string; score: number }>;
    services: Array<{ id: string; name: string; score: number }>;
  };
  areasForImprovement: DORAInsight[];
}

/**
 * DORA insight/recommendation
 */
export interface DORAInsight {
  id: string;
  metric: 'deploymentFrequency' | 'leadTimeForChanges' | 'meanTimeToRecovery' | 'changeFailureRate';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  recommendation: string;
  impact: 'low' | 'medium' | 'high';
  affectedEntities?: string[];
  relatedActions?: string[];
}

/**
 * DORA benchmark data
 */
export interface DORABenchmark {
  source: 'dora-report' | 'industry' | 'internal';
  year: number;
  levels: {
    elite: DORABenchmarkLevel;
    high: DORABenchmarkLevel;
    medium: DORABenchmarkLevel;
    low: DORABenchmarkLevel;
  };
}

/**
 * Benchmark level thresholds
 */
export interface DORABenchmarkLevel {
  deploymentFrequency: { min?: number; max?: number; unit: string };
  leadTimeForChanges: { min?: number; max?: number; unit: string };
  meanTimeToRecovery: { min?: number; max?: number; unit: string };
  changeFailureRate: { min?: number; max?: number };
}

/**
 * DORA metrics query options
 */
export interface DORAMetricsQuery {
  entityRef?: string;
  teamId?: string;
  period?: MetricPeriod;
  startDate?: string;
  endDate?: string;
  includeHistory?: boolean;
  includeBreakdown?: boolean;
  includeBenchmarks?: boolean;
}

// ============================================
// Developer Productivity Metrics
// ============================================

/**
 * Developer activity metrics
 */
export interface DeveloperActivityMetrics {
  developerId: string;
  period: {
    start: string;
    end: string;
  };
  commits: {
    total: number;
    byRepository: Record<string, number>;
    byDay: MetricDataPoint[];
  };
  pullRequests: {
    opened: number;
    merged: number;
    reviewed: number;
    avgTimeToMerge: number;
    avgReviewTime: number;
  };
  codeReviews: {
    total: number;
    avgComments: number;
    avgTurnaroundTime: number;
  };
  deployments: {
    total: number;
    byService: Record<string, number>;
  };
  incidents: {
    triggered: number;
    resolved: number;
    avgResolutionTime: number;
  };
}

/**
 * Team productivity metrics
 */
export interface TeamProductivityMetrics {
  teamId: string;
  teamName: string;
  period: {
    start: string;
    end: string;
  };
  velocity: {
    current: number;
    trend: MetricTrend;
    history: MetricDataPoint[];
  };
  throughput: {
    features: number;
    bugFixes: number;
    techDebt: number;
    incidents: number;
  };
  quality: {
    codeReviewCoverage: number;
    testCoverage: number;
    bugEscapeRate: number;
    technicalDebtRatio: number;
  };
  collaboration: {
    crossTeamPRs: number;
    sharedCodeContributions: number;
    knowledgeSharing: number; // docs, internal talks, etc.
  };
  health: {
    onCallLoadBalance: number;
    ptoUsage: number;
    meetingLoad: number;
    focusTime: number;
  };
}

/**
 * Engineering KPIs
 */
export interface EngineeringKPIs {
  period: {
    start: string;
    end: string;
    type: MetricPeriod;
  };
  delivery: {
    featuresShipped: number;
    bugsFixed: number;
    techDebtResolved: number;
    customerRequests: number;
  };
  quality: {
    productionIncidents: number;
    customerReportedBugs: number;
    securityVulnerabilities: number;
    codeQualityScore: number;
  };
  efficiency: {
    cycleTime: number;
    utilization: number;
    wastedEffort: number;
    rework: number;
  };
  innovation: {
    experiments: number;
    newTechnologies: number;
    processImprovements: number;
    automationSavings: number;
  };
}

// ============================================
// Cost Analytics
// ============================================

/**
 * Infrastructure cost metrics
 */
export interface InfrastructureCostMetrics {
  period: {
    start: string;
    end: string;
  };
  total: number;
  currency: string;
  byProvider: Record<string, ProviderCost>;
  byService: Record<string, ServiceCost>;
  byTeam: Record<string, TeamCost>;
  byCategory: {
    compute: number;
    storage: number;
    network: number;
    database: number;
    monitoring: number;
    other: number;
  };
  trend: MetricTrend;
  forecast?: CostForecast;
  anomalies?: CostAnomaly[];
  optimizationOpportunities?: CostOptimization[];
}

/**
 * Provider cost breakdown
 */
export interface ProviderCost {
  provider: string;
  total: number;
  byService: Record<string, number>;
  trend: MetricTrend;
}

/**
 * Service cost breakdown
 */
export interface ServiceCost {
  serviceId: string;
  serviceName: string;
  owner: string;
  total: number;
  perUnit?: {
    value: number;
    unit: string; // e.g., "per request", "per GB"
  };
  breakdown: {
    compute: number;
    storage: number;
    network: number;
    other: number;
  };
  trend: MetricTrend;
}

/**
 * Team cost breakdown
 */
export interface TeamCost {
  teamId: string;
  teamName: string;
  total: number;
  serviceCount: number;
  costPerService: number;
  trend: MetricTrend;
}

/**
 * Cost forecast
 */
export interface CostForecast {
  nextMonth: number;
  nextQuarter: number;
  endOfYear: number;
  confidence: number;
  assumptions: string[];
}

/**
 * Cost anomaly
 */
export interface CostAnomaly {
  id: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high';
  type: 'spike' | 'unusual_growth' | 'unexpected_resource';
  description: string;
  amount: number;
  expectedAmount: number;
  service?: string;
  resource?: string;
  recommendation?: string;
}

/**
 * Cost optimization opportunity
 */
export interface CostOptimization {
  id: string;
  type: 'rightsizing' | 'reserved_instances' | 'spot_instances' | 'unused_resources' | 'architecture';
  title: string;
  description: string;
  estimatedSavings: number;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  affectedResources: string[];
  implementationSteps?: string[];
}
