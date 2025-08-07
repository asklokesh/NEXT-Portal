/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
export interface BaseEntity {
 id: string;
 createdAt: Date;
 updatedAt: Date;
}

export interface User extends BaseEntity {
 email: string;
 name: string;
 avatar?: string;
 role: UserRole;
 teams: Team[];
}

export enum UserRole {
 ADMIN = 'ADMIN',
 DEVELOPER = 'DEVELOPER',
 VIEWER = 'VIEWER',
}

export interface Team extends BaseEntity {
 name: string;
 description?: string;
 members: User[];
 services: Service[];
}

export interface Service extends BaseEntity {
 name: string;
 description?: string;
 owner: Team;
 repository?: string;
 documentation?: string;
 tags: string[];
 dependencies: Service[];
 status: ServiceStatus;
}

export enum ServiceStatus {
 ACTIVE = 'ACTIVE',
 DEPRECATED = 'DEPRECATED',
 BETA = 'BETA',
 ALPHA = 'ALPHA',
}

export interface ApiResponse<T> {
 data: T;
 error?: string;
 status: number;
}

export interface PaginatedResponse<T> {
 items: T[];
 total: number;
 page: number;
 pageSize: number;
 hasMore: boolean;
}

// Plugin Certification Types
export interface CertificationRequest {
  pluginId: string;
  pluginName: string;
  version: string;
  sourceUrl?: string;
  packagePath?: string;
  testCommands?: string[];
  performanceThresholds?: {
    bundleSize?: number;
    loadTime?: number;
    memoryUsage?: number;
  };
}

export interface SecurityScanResult {
  vulnerabilities: {
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  details: SecurityIssue[];
  tools: string[];
  scanDuration: number;
}

export interface SecurityIssue {
  id: string;
  severity: 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  file?: string;
  line?: number;
  recommendation: string;
}

export interface PerformanceBenchmark {
  bundleSize: {
    compressed: number;
    uncompressed: number;
    treeshakable: boolean;
  };
  loadTime: {
    initial: number;
    interactive: number;
    complete: number;
  };
  memoryUsage: {
    heap: number;
    external: number;
    peak: number;
  };
  renderingMetrics: {
    firstContentfulPaint: number;
    largestContentfulPaint: number;
    cumulativeLayoutShift: number;
  };
  score: number;
}

export interface CodeQualityAnalysis {
  complexity: {
    cyclomatic: number;
    cognitive: number;
    maintainabilityIndex: number;
  };
  coverage: {
    lines: number;
    functions: number;
    branches: number;
    statements: number;
  };
  issues: {
    blocker: number;
    critical: number;
    major: number;
    minor: number;
    info: number;
  };
  duplications: {
    blocks: number;
    files: number;
    lines: number;
    density: number;
  };
  techDebt: {
    minutes: number;
    hours: number;
    days: number;
  };
  score: number;
}

export interface ComplianceCheck {
  ruleId: string;
  status: 'passed' | 'failed' | 'warning';
  severity: 'error' | 'warning' | 'info';
  category: 'security' | 'performance' | 'compatibility' | 'quality';
  description: string;
  details?: string;
  recommendation?: string;
}

export interface TestResults {
  unit: TestSuite;
  integration: TestSuite;
  e2e: TestSuite;
  coverage: {
    overall: number;
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  failures: TestFailure[];
}

export interface TestSuite {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
}

export interface TestFailure {
  test: string;
  error: string;
  stack?: string;
}

export interface CertificationBadge {
  id: string;
  level: 'bronze' | 'silver' | 'gold' | 'platinum';
  score: number;
  validUntil: string;
  criteria: {
    security: boolean;
    performance: boolean;
    quality: boolean;
    compliance: boolean;
    testing: boolean;
  };
  badgeUrl: string;
  metadata: {
    certifiedAt: string;
    certifiedBy: string;
    version: string;
  };
}

export interface CertificationResult {
  pluginId: string;
  pluginName: string;
  version: string;
  certificationId: string;
  status: 'certified' | 'expired' | 'revoked' | 'pending';
  badge: CertificationBadge;
  results: {
    security: SecurityScanResult;
    performance: PerformanceBenchmark;
    quality: CodeQualityAnalysis;
    compliance: ComplianceCheck[];
    testing: TestResults;
  };
  recommendations: string[];
  certifiedAt: string;
}

// Plugin SDK Types
export interface SDKGenerationRequest {
  projectName: string;
  pluginId: string;
  description?: string;
  author?: string;
  license: string;
  backstageVersion: string;
  features: PluginFeature[];
  framework: 'react' | 'vue' | 'angular' | 'vanilla';
  bundler: 'webpack' | 'vite' | 'rollup' | 'esbuild';
  testing: 'jest' | 'vitest' | 'mocha' | 'playwright';
  linting: 'eslint' | 'biome' | 'none';
  styling: 'css' | 'scss' | 'tailwind' | 'styled-components' | 'emotion';
  typescript: boolean;
  includeExamples: boolean;
  includeDocs: boolean;
  includeCI: boolean;
}

export type PluginFeature = 
  | 'frontend'
  | 'backend'
  | 'catalog'
  | 'scaffolder'
  | 'search'
  | 'techdocs'
  | 'permissions'
  | 'analytics'
  | 'notifications';

export interface SDKTemplate {
  name: string;
  description: string;
  category: 'frontend' | 'backend' | 'fullstack' | 'utility';
  files: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  config: Record<string, any>;
}

export interface CLICommand {
  description: string;
  usage: string;
  options: Record<string, CLIOption>;
  handler: string;
}

export interface CLIOption {
  description: string;
  type: 'string' | 'boolean' | 'number' | 'array';
  default?: any;
  required?: boolean;
}

export interface CLITool {
  version: string;
  commands: Record<string, CLICommand>;
  globalConfig: Record<string, any>;
}

export interface DevServerConfig {
  port: number;
  host: string;
  hotReload: boolean;
  proxy?: Record<string, string>;
  env?: Record<string, string>;
  watch: string[];
  ignore: string[];
}

export interface DevServer {
  port: number;
  host: string;
  status: 'stopped' | 'starting' | 'running' | 'error';
  config: DevServerConfig;
  logs: string[];
  watchers: string[];
}

export interface DocumentationOptions {
  format: 'markdown' | 'html' | 'json';
  includeAPI: boolean;
  includeExamples: boolean;
  outputPath: string;
}

export interface GeneratedDocumentation {
  readme: string;
  api?: string;
  examples?: string;
  contributing: string;
  changelog: string;
}

// Plugin Management Types
export interface Plugin {
  id: string;
  name: string;
  title: string;
  description: string;
  version: string;
  author: string;
  category: string;
  tags: string[];
  downloads: number;
  stars: number;
  lastUpdated: string;
  npm: string;
  homepage?: string;
  repository?: string;
  installed: boolean;
  enabled: boolean;
  configurable: boolean;
  certification?: CertificationResult;
}

export interface PluginInstallation {
  pluginId: string;
  version: string;
  status: 'pending' | 'installing' | 'installed' | 'failed';
  progress: number;
  logs: string[];
  error?: string;
}

export interface PluginConfiguration {
  pluginId: string;
  config: Record<string, any>;
  schema?: Record<string, any>;
  validation?: {
    isValid: boolean;
    errors: string[];
  };
}

// Certification Statistics Types
export interface CertificationStatistics {
  totalCertifications: number;
  activeCertifications: number;
  expiredCertifications: number;
  levelDistribution: {
    platinum: number;
    gold: number;
    silver: number;
    bronze: number;
  };
  averageScore: number;
  certificationTrends: {
    thisMonth: number;
    lastMonth: number;
    growthRate: number;
  };
}

// SDK Statistics Types
export interface SDKStatistics {
  totalProjects: number;
  templatesUsed: Record<string, number>;
  featuresPopularity: Record<PluginFeature, number>;
  frameworkDistribution: Record<string, number>;
  activeDevServers: number;
  generationTrends: {
    daily: number[];
    weekly: number[];
    monthly: number[];
  };
}