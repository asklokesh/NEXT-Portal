import { JSONSchema7 } from 'json-schema';

export interface ContractTestConfig {
  pactBrokerUrl?: string;
  pactBrokerToken?: string;
  pactBrokerUsername?: string;
  pactBrokerPassword?: string;
  publishResults?: boolean;
  logLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  timeout?: number;
  providerVersion?: string;
  consumerVersion?: string;
}

export interface PactContract {
  consumer: {
    name: string;
    version?: string;
  };
  provider: {
    name: string;
    version?: string;
  };
  interactions: PactInteraction[];
  metadata: {
    pactSpecification: {
      version: string;
    };
    'pact-js'?: {
      version: string;
    };
  };
}

export interface PactInteraction {
  description: string;
  providerStates?: ProviderState[];
  request: PactRequest;
  response: PactResponse;
}

export interface ProviderState {
  name: string;
  params?: Record<string, any>;
}

export interface PactRequest {
  method: string;
  path: string;
  headers?: Record<string, string | string[]>;
  query?: Record<string, string | string[]>;
  body?: any;
}

export interface PactResponse {
  status: number;
  headers?: Record<string, string | string[]>;
  body?: any;
}

export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: {
    url: string;
    description?: string;
  }[];
  paths: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, JSONSchema7>;
    responses?: Record<string, ResponseObject>;
    parameters?: Record<string, ParameterObject>;
    securitySchemes?: Record<string, SecurityScheme>;
  };
  security?: SecurityRequirement[];
}

export interface PathItem {
  get?: OperationObject;
  post?: OperationObject;
  put?: OperationObject;
  delete?: OperationObject;
  patch?: OperationObject;
  options?: OperationObject;
  head?: OperationObject;
  trace?: OperationObject;
}

export interface OperationObject {
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses: Record<string, ResponseObject>;
  security?: SecurityRequirement[];
  tags?: string[];
}

export interface ParameterObject {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  required?: boolean;
  schema: JSONSchema7;
  description?: string;
}

export interface RequestBodyObject {
  description?: string;
  content: Record<string, MediaTypeObject>;
  required?: boolean;
}

export interface ResponseObject {
  description: string;
  headers?: Record<string, HeaderObject>;
  content?: Record<string, MediaTypeObject>;
}

export interface MediaTypeObject {
  schema?: JSONSchema7;
  example?: any;
  examples?: Record<string, ExampleObject>;
}

export interface ExampleObject {
  summary?: string;
  description?: string;
  value?: any;
}

export interface HeaderObject {
  description?: string;
  schema: JSONSchema7;
  required?: boolean;
}

export interface SecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  description?: string;
  name?: string;
  in?: 'query' | 'header' | 'cookie';
  scheme?: string;
  bearerFormat?: string;
  flows?: OAuthFlows;
  openIdConnectUrl?: string;
}

export interface OAuthFlows {
  implicit?: OAuthFlow;
  password?: OAuthFlow;
  clientCredentials?: OAuthFlow;
  authorizationCode?: OAuthFlow;
}

export interface OAuthFlow {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

export interface SecurityRequirement {
  [key: string]: string[];
}

export interface ContractVersion {
  version: string;
  majorVersion: number;
  minorVersion: number;
  patchVersion: number;
  preRelease?: string;
  build?: string;
}

export interface CompatibilityResult {
  isCompatible: boolean;
  breakingChanges: BreakingChange[];
  warnings: Warning[];
  compatibilityScore: number;
}

export interface BreakingChange {
  type: 'request' | 'response' | 'endpoint' | 'schema';
  severity: 'major' | 'minor' | 'patch';
  description: string;
  path: string;
  oldValue?: any;
  newValue?: any;
}

export interface Warning {
  type: 'deprecation' | 'schema' | 'performance';
  description: string;
  path: string;
  recommendation?: string;
}

export interface ContractTestResult {
  contractId: string;
  testSuite: string;
  status: 'passed' | 'failed' | 'pending' | 'skipped';
  startTime: Date;
  endTime: Date;
  duration: number;
  interactions: InteractionTestResult[];
  errors: ContractError[];
  summary: TestSummary;
}

export interface InteractionTestResult {
  description: string;
  status: 'passed' | 'failed' | 'skipped';
  request: PactRequest;
  expectedResponse: PactResponse;
  actualResponse?: PactResponse;
  error?: string;
  duration: number;
}

export interface ContractError {
  type: 'validation' | 'network' | 'timeout' | 'schema';
  message: string;
  details?: any;
  stack?: string;
}

export interface TestSummary {
  totalInteractions: number;
  passedInteractions: number;
  failedInteractions: number;
  skippedInteractions: number;
  passRate: number;
}

export interface MockServiceConfig {
  name: string;
  port: number;
  host?: string;
  pactFiles?: string[];
  mockOptions?: {
    cors?: boolean;
    ssl?: boolean;
    sslCert?: string;
    sslKey?: string;
    logLevel?: string;
  };
}

export interface MockService {
  start(): Promise<void>;
  stop(): Promise<void>;
  reset(): Promise<void>;
  addInteractions(interactions: PactInteraction[]): Promise<void>;
  verifyInteractions(): Promise<boolean>;
  getConfig(): MockServiceConfig;
}

export interface ContractGovernanceConfig {
  approvalRequired: boolean;
  approvers: string[];
  autoApproveMinor: boolean;
  maxApprovalTime: number;
  breakingChangePolicy: 'block' | 'warn' | 'allow';
}

export interface ApprovalRequest {
  id: string;
  contractId: string;
  requester: string;
  version: string;
  changes: BreakingChange[];
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  comments?: string;
}

export interface PipelineIntegrationConfig {
  provider: 'github' | 'gitlab' | 'jenkins' | 'azure-devops';
  webhook?: {
    url: string;
    secret?: string;
  };
  notifications?: {
    slack?: {
      webhook: string;
      channel: string;
    };
    email?: {
      recipients: string[];
      smtp: {
        host: string;
        port: number;
        secure: boolean;
        auth: {
          user: string;
          pass: string;
        };
      };
    };
  };
}

export interface ContractMetrics {
  totalContracts: number;
  activeContracts: number;
  testCoverage: number;
  averageTestDuration: number;
  failureRate: number;
  breakingChangeRate: number;
  trendsOverTime: {
    date: string;
    coverage: number;
    failures: number;
    duration: number;
  }[];
}