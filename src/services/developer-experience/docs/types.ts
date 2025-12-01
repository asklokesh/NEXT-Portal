/**
 * API Documentation Types
 * Auto-generated API documentation and SDK generation
 */

// ============================================================================
// API Documentation Types
// ============================================================================

export interface APIDocumentation {
  id: string;
  name: string;
  version: string;
  description: string;
  baseUrl: string;
  specification: APISpecification;
  endpoints: APIEndpoint[];
  models: APIModel[];
  authentication: APIAuthentication[];
  changelog: APIChangelogEntry[];
  metadata: APIDocMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface APISpecification {
  format: 'openapi3' | 'openapi2' | 'asyncapi' | 'graphql' | 'grpc';
  version: string;
  rawSpec?: string;
  parsedSpec?: any;
  validationErrors?: APIValidationError[];
}

export interface APIValidationError {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

// ============================================================================
// API Endpoint Types
// ============================================================================

export interface APIEndpoint {
  id: string;
  method: HTTPMethod;
  path: string;
  summary: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  deprecated?: boolean;
  deprecationMessage?: string;
  parameters: APIParameter[];
  requestBody?: APIRequestBody;
  responses: APIResponse[];
  security?: APISecurityRequirement[];
  examples?: APIExample[];
  rateLimit?: APIRateLimit;
}

export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface APIParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  description?: string;
  required: boolean;
  deprecated?: boolean;
  schema: APISchema;
  example?: any;
  examples?: Record<string, APIExampleValue>;
}

export interface APIRequestBody {
  description?: string;
  required: boolean;
  content: Record<string, APIMediaType>;
}

export interface APIResponse {
  statusCode: number | 'default';
  description: string;
  content?: Record<string, APIMediaType>;
  headers?: Record<string, APIParameter>;
}

export interface APIMediaType {
  schema: APISchema;
  example?: any;
  examples?: Record<string, APIExampleValue>;
}

export interface APISchema {
  type?: string;
  format?: string;
  title?: string;
  description?: string;
  required?: string[];
  properties?: Record<string, APISchema>;
  items?: APISchema;
  enum?: any[];
  default?: any;
  nullable?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  $ref?: string;
  allOf?: APISchema[];
  oneOf?: APISchema[];
  anyOf?: APISchema[];
}

export interface APIExample {
  name: string;
  summary?: string;
  description?: string;
  request?: {
    headers?: Record<string, string>;
    body?: any;
    queryParams?: Record<string, string>;
  };
  response?: {
    statusCode: number;
    headers?: Record<string, string>;
    body?: any;
  };
}

export interface APIExampleValue {
  summary?: string;
  description?: string;
  value: any;
}

export interface APIRateLimit {
  limit: number;
  window: string;
  scope: 'user' | 'ip' | 'api_key' | 'global';
}

// ============================================================================
// API Model Types
// ============================================================================

export interface APIModel {
  name: string;
  description?: string;
  schema: APISchema;
  examples?: Record<string, any>;
  usedIn?: string[]; // Endpoint IDs that use this model
}

// ============================================================================
// API Authentication Types
// ============================================================================

export interface APIAuthentication {
  type: APIAuthType;
  name: string;
  description?: string;
  scheme?: string;
  bearerFormat?: string;
  flows?: OAuthFlows;
  openIdConnectUrl?: string;
  apiKeyLocation?: 'header' | 'query' | 'cookie';
  apiKeyName?: string;
}

export type APIAuthType = 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';

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

export interface APISecurityRequirement {
  name: string;
  scopes?: string[];
}

// ============================================================================
// API Changelog Types
// ============================================================================

export interface APIChangelogEntry {
  version: string;
  date: string;
  type: 'major' | 'minor' | 'patch';
  changes: APIChange[];
}

export interface APIChange {
  type: ChangeType;
  description: string;
  path?: string;
  breaking?: boolean;
  migration?: string;
}

export type ChangeType =
  | 'added'
  | 'changed'
  | 'deprecated'
  | 'removed'
  | 'fixed'
  | 'security';

// ============================================================================
// Documentation Metadata Types
// ============================================================================

export interface APIDocMetadata {
  owner: string;
  team?: string;
  contact?: {
    name?: string;
    email?: string;
    url?: string;
  };
  license?: {
    name: string;
    url?: string;
  };
  termsOfService?: string;
  externalDocs?: {
    description: string;
    url: string;
  };
  servers?: APIServer[];
  tags?: APITag[];
}

export interface APIServer {
  url: string;
  description?: string;
  environment?: string;
  variables?: Record<string, {
    default: string;
    enum?: string[];
    description?: string;
  }>;
}

export interface APITag {
  name: string;
  description?: string;
  externalDocs?: {
    description: string;
    url: string;
  };
}

// ============================================================================
// SDK Generation Types
// ============================================================================

export interface SDKConfig {
  name: string;
  version: string;
  language: SDKLanguage;
  packageName?: string;
  description?: string;
  author?: string;
  license?: string;
  repository?: string;
  options: SDKOptions;
}

export type SDKLanguage =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'go'
  | 'java'
  | 'csharp'
  | 'ruby'
  | 'php'
  | 'swift'
  | 'kotlin'
  | 'rust';

export interface SDKOptions {
  // TypeScript/JavaScript options
  useAxios?: boolean;
  useFetch?: boolean;
  generateTypes?: boolean;
  moduleType?: 'esm' | 'commonjs';

  // Python options
  asyncSupport?: boolean;
  pythonVersion?: string;

  // Go options
  goModulePath?: string;

  // Java options
  groupId?: string;
  artifactId?: string;
  javaVersion?: string;

  // Common options
  generateTests?: boolean;
  generateDocs?: boolean;
  generateExamples?: boolean;
  includeReadme?: boolean;
  customTemplates?: string;
}

export interface SDKGenerationResult {
  id: string;
  config: SDKConfig;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  progress?: number;
  files?: SDKGeneratedFile[];
  downloadUrl?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface SDKGeneratedFile {
  path: string;
  content: string;
  type: 'source' | 'test' | 'doc' | 'config';
}

// ============================================================================
// Documentation Search Types
// ============================================================================

export interface DocSearchQuery {
  text: string;
  apiId?: string;
  tags?: string[];
  types?: ('endpoint' | 'model' | 'parameter')[];
  limit?: number;
}

export interface DocSearchResult {
  items: DocSearchHit[];
  total: number;
  suggestions?: string[];
}

export interface DocSearchHit {
  type: 'endpoint' | 'model' | 'parameter' | 'description';
  apiId: string;
  apiName: string;
  id: string;
  title: string;
  description?: string;
  path?: string;
  method?: HTTPMethod;
  highlights: string[];
  score: number;
}

// ============================================================================
// Try It Out Types
// ============================================================================

export interface APITryItRequest {
  endpointId: string;
  server?: string;
  authentication?: {
    type: APIAuthType;
    value: string;
  };
  parameters?: Record<string, any>;
  headers?: Record<string, string>;
  body?: any;
}

export interface APITryItResponse {
  success: boolean;
  statusCode: number;
  statusText: string;
  headers: Record<string, string>;
  body: any;
  duration: number;
  size: number;
  error?: string;
}
