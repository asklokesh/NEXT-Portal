/**
 * Performance Testing Type Definitions
 */

export interface PerformanceMetrics {
  // Core Web Vitals
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  fcp: number; // First Contentful Paint
  ttfb: number; // Time to First Byte
  tti: number; // Time to Interactive
  inp: number; // Interaction to Next Paint
  
  // Custom Metrics
  pageLoadTime: number;
  apiResponseTime: number;
  databaseQueryTime: number;
  bundleSize: number;
  memoryUsage: number;
  cpuUsage: number;
  throughput: number;
  errorRate: number;
  cacheHitRatio: number;
}

export interface PerformanceTarget {
  metric: keyof PerformanceMetrics;
  target: number;
  unit: 'ms' | 's' | 'MB' | 'KB' | '%' | 'score' | 'rps';
  comparison?: 'backstage' | 'industry';
  backstageValue?: number;
}

export interface LoadTestConfig {
  virtualUsers: number;
  duration: number; // seconds
  rampUpTime: number; // seconds
  scenarios: LoadTestScenario[];
  thresholds: PerformanceThreshold[];
}

export interface LoadTestScenario {
  name: string;
  weight: number; // percentage
  flow: TestStep[];
}

export interface TestStep {
  type: 'navigate' | 'api' | 'interaction' | 'wait';
  target: string;
  action?: string;
  payload?: any;
  assertions?: Assertion[];
}

export interface Assertion {
  type: 'responseTime' | 'statusCode' | 'contentCheck' | 'metric';
  operator: '<' | '>' | '=' | '<=' | '>=' | 'contains';
  expected: any;
}

export interface PerformanceThreshold {
  metric: string;
  threshold: number;
  abortOnFail?: boolean;
}

export interface MemoryProfile {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  arrayBuffers: number;
  leaks: MemoryLeak[];
}

export interface MemoryLeak {
  location: string;
  size: number;
  count: number;
  growth: number;
  stackTrace: string[];
}

export interface BundleAnalysis {
  totalSize: number;
  gzippedSize: number;
  chunks: ChunkInfo[];
  duplicates: DuplicateModule[];
  recommendations: OptimizationRecommendation[];
}

export interface ChunkInfo {
  name: string;
  size: number;
  gzippedSize: number;
  modules: ModuleInfo[];
}

export interface ModuleInfo {
  name: string;
  size: number;
  reasons: string[];
}

export interface DuplicateModule {
  name: string;
  versions: string[];
  locations: string[];
  potentialSavings: number;
}

export interface OptimizationRecommendation {
  type: 'code-split' | 'tree-shake' | 'lazy-load' | 'dedupe' | 'minify';
  description: string;
  impact: 'high' | 'medium' | 'low';
  estimatedSavings: number;
}

export interface DatabaseQueryMetrics {
  query: string;
  executionTime: number;
  rowsExamined: number;
  rowsReturned: number;
  indexUsed: boolean;
  slowQuery: boolean;
  recommendations: string[];
}

export interface APIEndpointMetrics {
  endpoint: string;
  method: string;
  p50: number;
  p95: number;
  p99: number;
  averageResponseTime: number;
  throughput: number;
  errorRate: number;
  statusCodes: Record<number, number>;
}

export interface PerformanceComparison {
  timestamp: Date;
  portal: 'next' | 'backstage';
  environment: 'development' | 'staging' | 'production';
  metrics: PerformanceMetrics;
  loadTestResults?: LoadTestResults;
  bundleAnalysis?: BundleAnalysis;
}

export interface LoadTestResults {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughput: number;
  peakConcurrentUsers: number;
  scenarios: ScenarioResult[];
}

export interface ScenarioResult {
  name: string;
  iterations: number;
  failures: number;
  averageDuration: number;
  p95Duration: number;
  steps: StepResult[];
}

export interface StepResult {
  name: string;
  averageDuration: number;
  failures: number;
  assertions: AssertionResult[];
}

export interface AssertionResult {
  passed: boolean;
  message: string;
  actual: any;
  expected: any;
}

export interface PerformanceReport {
  id: string;
  generatedAt: Date;
  summary: PerformanceSummary;
  detailedMetrics: PerformanceMetrics;
  comparison: ComparisonResult;
  recommendations: string[];
  evidence: Evidence[];
}

export interface PerformanceSummary {
  overallScore: number; // 0-100
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  improvements: string[];
  regressions: string[];
  keyHighlights: string[];
}

export interface ComparisonResult {
  versusBackstage: {
    pageLoadSpeed: number; // multiplier (e.g., 10x)
    apiResponseSpeed: number;
    bundleSizeReduction: number; // percentage
    memoryEfficiency: number; // percentage
    concurrentUsersSupport: number; // multiplier
  };
  versusIndustryAverage: {
    performance: number; // percentile
    reliability: number;
    scalability: number;
  };
}

export interface Evidence {
  type: 'screenshot' | 'chart' | 'table' | 'log';
  title: string;
  description: string;
  data: any;
}

export interface PerformanceConfig {
  targets: PerformanceTarget[];
  monitoring: {
    enabled: boolean;
    interval: number; // seconds
    retention: number; // days
  };
  alerting: {
    enabled: boolean;
    thresholds: PerformanceThreshold[];
    channels: AlertChannel[];
  };
  reporting: {
    automated: boolean;
    schedule: string; // cron expression
    recipients: string[];
  };
}

export interface AlertChannel {
  type: 'email' | 'slack' | 'webhook';
  config: Record<string, any>;
}

export interface RealTimeMetrics {
  timestamp: number;
  activeUsers: number;
  requestsPerSecond: number;
  averageResponseTime: number;
  errorRate: number;
  cpuUsage: number;
  memoryUsage: number;
  networkIO: {
    bytesIn: number;
    bytesOut: number;
  };
}