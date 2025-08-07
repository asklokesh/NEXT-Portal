export interface AITemplateRequest {
  naturalLanguageDescription: string;
  context?: {
    technology?: string[];
    platform?: 'web' | 'mobile' | 'api' | 'microservice' | 'library';
    cloudProvider?: 'aws' | 'gcp' | 'azure' | 'multi-cloud';
    teamSize?: number;
    complexity?: 'simple' | 'medium' | 'complex';
    compliance?: string[];
  };
  preferences?: {
    testingFramework?: string;
    cicd?: string;
    monitoring?: boolean;
    security?: boolean;
  };
}

export interface AITemplateResponse {
  template: ScaffolderTemplate;
  confidence: number;
  reasoning: string;
  suggestions: string[];
  alternatives: ScaffolderTemplate[];
}

export interface ScaffolderTemplate {
  id: string;
  name: string;
  description: string;
  version: string;
  category: string;
  tags: string[];
  author: {
    name: string;
    email: string;
    avatar?: string;
  };
  metadata: {
    created: string;
    updated: string;
    downloads: number;
    rating: number;
    complexity: 'simple' | 'medium' | 'complex';
    estimatedTime: string;
  };
  spec: {
    parameters: TemplateParameter[];
    steps: TemplateStep[];
    outputs: TemplateOutput[];
  };
  visual?: {
    components: VisualComponent[];
    connections: Connection[];
  };
  ai?: {
    generatedFrom?: string;
    confidence?: number;
    learningData?: any;
  };
}

export interface TemplateParameter {
  name: string;
  title: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'select' | 'multiselect';
  required?: boolean;
  default?: any;
  enum?: string[];
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    custom?: string;
  };
  ui?: {
    widget?: 'text' | 'textarea' | 'number' | 'checkbox' | 'select' | 'radio' | 'date' | 'file';
    placeholder?: string;
    help?: string;
    conditional?: {
      field: string;
      value: any;
    };
  };
  ai?: {
    suggestions?: string[];
    autoFill?: boolean;
    smartValidation?: boolean;
  };
}

export interface TemplateStep {
  id: string;
  name: string;
  action: string;
  input: Record<string, any>;
  condition?: string;
  retry?: {
    attempts: number;
    delay: number;
  };
  rollback?: TemplateStep;
  ai?: {
    optimized?: boolean;
    alternatives?: string[];
  };
}

export interface TemplateOutput {
  name: string;
  description: string;
  type: 'url' | 'file' | 'repository' | 'service' | 'data';
  value: string;
}

export interface VisualComponent {
  id: string;
  type: 'input' | 'action' | 'condition' | 'output';
  position: { x: number; y: number };
  data: any;
  size?: { width: number; height: number };
}

export interface Connection {
  id: string;
  source: string;
  target: string;
  type?: 'success' | 'error' | 'conditional';
}

export interface TemplateRecommendation {
  template: ScaffolderTemplate;
  score: number;
  reasoning: string;
  context: {
    similarUsage: number;
    teamMatch: number;
    technologyFit: number;
    projectMatch: number;
  };
}

export interface TemplateExecution {
  id: string;
  templateId: string;
  templateVersion: string;
  userId: string;
  parameters: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: {
    currentStep: number;
    totalSteps: number;
    percentage: number;
    message: string;
  };
  outputs: TemplateOutput[];
  logs: ExecutionLog[];
  startTime: string;
  endTime?: string;
  error?: {
    message: string;
    step: string;
    code: string;
  };
}

export interface ExecutionLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  step?: string;
  data?: any;
}

export interface TemplateMarketplace {
  templates: ScaffolderTemplate[];
  categories: TemplateCategory[];
  featured: string[];
  trending: string[];
  recent: string[];
}

export interface TemplateCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  templateCount: number;
}

export interface TemplateRating {
  templateId: string;
  userId: string;
  rating: number;
  review?: string;
  timestamp: string;
}

export interface TemplateAnalytics {
  templateId: string;
  period: 'day' | 'week' | 'month' | 'year';
  metrics: {
    views: number;
    downloads: number;
    executions: number;
    successRate: number;
    avgExecutionTime: number;
    userSatisfaction: number;
  };
  trends: {
    timestamp: string;
    value: number;
  }[];
}

export interface CloudDeploymentTemplate extends ScaffolderTemplate {
  cloudConfig: {
    aws?: {
      services: string[];
      regions: string[];
      estimatedCost: number;
    };
    gcp?: {
      services: string[];
      regions: string[];
      estimatedCost: number;
    };
    azure?: {
      services: string[];
      regions: string[];
      estimatedCost: number;
    };
  };
  infrastructure: {
    terraform?: string;
    cloudFormation?: string;
    arm?: string;
    pulumi?: string;
  };
}

export interface TemplateVersion {
  version: string;
  changes: string[];
  breaking: boolean;
  migration?: {
    from: string;
    to: string;
    script: string;
    automated: boolean;
  };
  compatibility: {
    backstageVersion: string;
    nodeVersion: string;
    dependencies: Record<string, string>;
  };
}

export interface SmartParameter {
  parameter: TemplateParameter;
  suggestions: string[];
  validation: ValidationResult;
  autoComplete: boolean;
  context: {
    relatedFields: string[];
    businessRules: string[];
    constraints: string[];
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface TemplateTestResult {
  templateId: string;
  version: string;
  testSuite: {
    unit: TestResult;
    integration: TestResult;
    e2e: TestResult;
    performance: TestResult;
    security: TestResult;
  };
  overall: {
    passed: boolean;
    score: number;
    coverage: number;
  };
}

export interface TestResult {
  passed: boolean;
  failed: number;
  total: number;
  duration: number;
  details: TestCase[];
}

export interface TestCase {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  output?: string;
}

export type TemplateEvent = 
  | { type: 'TEMPLATE_CREATED'; payload: ScaffolderTemplate }
  | { type: 'TEMPLATE_UPDATED'; payload: ScaffolderTemplate }
  | { type: 'TEMPLATE_DELETED'; payload: { templateId: string } }
  | { type: 'EXECUTION_STARTED'; payload: TemplateExecution }
  | { type: 'EXECUTION_PROGRESS'; payload: { executionId: string; progress: number; message: string } }
  | { type: 'EXECUTION_COMPLETED'; payload: TemplateExecution }
  | { type: 'EXECUTION_FAILED'; payload: TemplateExecution };