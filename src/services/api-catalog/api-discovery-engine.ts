import { EventEmitter } from 'events';
import { Logger } from 'pino';
import * as yaml from 'js-yaml';
import SwaggerParser from '@apidevtools/swagger-parser';

interface APISpecification {
  id: string;
  name: string;
  version: string;
  type: 'openapi' | 'graphql' | 'grpc' | 'asyncapi' | 'custom';
  specification: any;
  serviceId: string;
  endpoints: APIEndpoint[];
  metadata: APIMetadata;
  security: APISecurityInfo;
  documentation: APIDocumentation;
  usage: APIUsageMetrics;
  quality: APIQualityScore;
}

interface APIEndpoint {
  id: string;
  method: string;
  path: string;
  summary: string;
  description: string;
  parameters: APIParameter[];
  responses: APIResponse[];
  security: string[];
  tags: string[];
  deprecated: boolean;
  rateLimit?: RateLimit;
  caching?: CachingPolicy;
}

interface APIParameter {
  name: string;
  type: 'query' | 'path' | 'header' | 'body' | 'form';
  dataType: string;
  required: boolean;
  description: string;
  example?: any;
  schema?: any;
}

interface APIResponse {
  statusCode: number;
  description: string;
  schema?: any;
  examples?: Record<string, any>;
  headers?: Record<string, any>;
}

interface APIMetadata {
  serviceId: string;
  serviceName: string;
  owner: string;
  team: string;
  tags: string[];
  categories: string[];
  visibility: 'public' | 'internal' | 'private';
  status: 'active' | 'deprecated' | 'experimental';
  createdAt: Date;
  updatedAt: Date;
  source: APISource;
}

interface APISource {
  type: 'repository' | 'service' | 'gateway' | 'documentation' | 'manual';
  location: string;
  lastScan: Date;
  confidence: number;
}

interface APISecurityInfo {
  authentication: string[];
  authorization: string[];
  rateLimit: RateLimit;
  cors: CORSPolicy;
  vulnerabilities: SecurityVulnerability[];
}

interface RateLimit {
  requests: number;
  window: string;
  scope: 'global' | 'user' | 'ip' | 'api-key';
}

interface CORSPolicy {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  credentials: boolean;
}

interface SecurityVulnerability {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  description: string;
  remediation: string;
  discovered: Date;
}

interface APIDocumentation {
  description: string;
  examples: APIExample[];
  guides: DocumentationGuide[];
  sdks: SDKInfo[];
  changelog: ChangelogEntry[];
}

interface APIExample {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  method: string;
  request: any;
  response: any;
  language: string;
}

interface DocumentationGuide {
  id: string;
  title: string;
  content: string;
  category: string;
  order: number;
}

interface SDKInfo {
  language: string;
  name: string;
  version: string;
  repository: string;
  documentation: string;
  examples: string[];
}

interface ChangelogEntry {
  version: string;
  date: Date;
  changes: string[];
  breaking: boolean;
}

interface APIUsageMetrics {
  requests: {
    total: number;
    daily: number;
    weekly: number;
    monthly: number;
  };
  latency: {
    p50: number;
    p95: number;
    p99: number;
  };
  errors: {
    rate: number;
    total: number;
    byStatusCode: Record<number, number>;
  };
  consumers: {
    total: number;
    active: number;
    topConsumers: ConsumerInfo[];
  };
}

interface ConsumerInfo {
  id: string;
  name: string;
  requests: number;
  lastSeen: Date;
}

interface APIQualityScore {
  overall: number;
  documentation: number;
  security: number;
  reliability: number;
  performance: number;
  compliance: number;
  usability: number;
}

interface APIDiscoveryConfig {
  sources: APIDiscoverySource[];
  scanInterval: number;
  enableRealTimeScanning: boolean;
  qualityRules: QualityRule[];
  securityRules: SecurityRule[];
}

interface APIDiscoverySource {
  type: 'repository' | 'gateway' | 'service-mesh' | 'documentation' | 'registry';
  config: Record<string, any>;
  enabled: boolean;
  scanFrequency: number;
}

export class APIDiscoveryEngine extends EventEmitter {
  private discoveredAPIs: Map<string, APISpecification> = new Map();
  private discoveryInterval: NodeJS.Timeout | null = null;
  private scanInProgress = false;

  constructor(
    private readonly config: APIDiscoveryConfig,
    private readonly logger: Logger
  ) {
    super();
    this.startPeriodicScanning();
  }

  /**
   * Start automatic API discovery
   */
  async start(): Promise<void> {
    this.logger.info('Starting API discovery engine');
    await this.performFullScan();
    this.startPeriodicScanning();
    this.emit('engine-started');
  }

  /**
   * Stop API discovery
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping API discovery engine');
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }
    this.emit('engine-stopped');
  }

  /**
   * Perform full API discovery scan
   */
  async performFullScan(): Promise<DiscoveryResult> {
    if (this.scanInProgress) {
      throw new Error('Scan already in progress');
    }

    this.scanInProgress = true;
    const startTime = Date.now();

    try {
      this.logger.info('Starting full API discovery scan');
      const results: APISpecification[] = [];

      for (const source of this.config.sources) {
        if (!source.enabled) continue;

        try {
          const sourceResults = await this.scanSource(source);
          results.push(...sourceResults);
          this.logger.info(`Discovered ${sourceResults.length} APIs from ${source.type}`);
        } catch (error) {
          this.logger.error({ source: source.type, error }, 'Failed to scan source');
        }
      }

      // Process discovered APIs
      const processedAPIs = await this.processDiscoveredAPIs(results);

      // Update internal state
      for (const api of processedAPIs) {
        this.discoveredAPIs.set(api.id, api);
      }

      const result: DiscoveryResult = {
        totalFound: processedAPIs.length,
        newAPIs: processedAPIs.filter(api => !this.discoveredAPIs.has(api.id)).length,
        updatedAPIs: processedAPIs.filter(api => this.discoveredAPIs.has(api.id)).length,
        duration: Date.now() - startTime,
        timestamp: new Date()
      };

      this.emit('scan-completed', result);
      return result;

    } finally {
      this.scanInProgress = false;
    }
  }

  /**
   * Scan specific API discovery source
   */
  private async scanSource(source: APIDiscoverySource): Promise<APISpecification[]> {
    const scanner = this.createSourceScanner(source);
    return scanner.scan();
  }

  /**
   * Create source-specific scanner
   */
  private createSourceScanner(source: APIDiscoverySource): APISourceScanner {
    switch (source.type) {
      case 'repository':
        return new RepositoryScanner(source.config, this.logger);
      case 'gateway':
        return new GatewayScanner(source.config, this.logger);
      case 'service-mesh':
        return new ServiceMeshScanner(source.config, this.logger);
      case 'documentation':
        return new DocumentationScanner(source.config, this.logger);
      case 'registry':
        return new RegistryScanner(source.config, this.logger);
      default:
        throw new Error(`Unknown source type: ${source.type}`);
    }
  }

  /**
   * Process and enrich discovered APIs
   */
  private async processDiscoveredAPIs(apis: APISpecification[]): Promise<APISpecification[]> {
    const processedAPIs: APISpecification[] = [];

    for (const api of apis) {
      try {
        // Validate API specification
        const validatedAPI = await this.validateAPISpec(api);

        // Enrich with metadata
        const enrichedAPI = await this.enrichAPIMetadata(validatedAPI);

        // Calculate quality score
        const qualityAPI = await this.calculateQualityScore(enrichedAPI);

        // Analyze security
        const securityAPI = await this.analyzeAPISecurity(qualityAPI);

        processedAPIs.push(securityAPI);
      } catch (error) {
        this.logger.warn({ apiId: api.id, error }, 'Failed to process API');
      }
    }

    return processedAPIs;
  }

  /**
   * Validate API specification
   */
  private async validateAPISpec(api: APISpecification): Promise<APISpecification> {
    try {
      if (api.type === 'openapi') {
        await SwaggerParser.validate(api.specification);
      }
      // Add validation for other API types
      return api;
    } catch (error) {
      throw new Error(`Invalid API specification: ${error}`);
    }
  }

  /**
   * Enrich API with additional metadata
   */
  private async enrichAPIMetadata(api: APISpecification): Promise<APISpecification> {
    // Extract additional information from specification
    const enrichedAPI = { ...api };

    if (api.type === 'openapi') {
      enrichedAPI.endpoints = this.extractOpenAPIEndpoints(api.specification);
      enrichedAPI.security = this.extractOpenAPISecurity(api.specification);
      enrichedAPI.documentation = this.extractOpenAPIDocumentation(api.specification);
    }

    // Infer additional metadata
    enrichedAPI.metadata.categories = this.inferAPICategories(api);
    enrichedAPI.metadata.tags = this.inferAPITags(api);

    return enrichedAPI;
  }

  /**
   * Calculate API quality score
   */
  private async calculateQualityScore(api: APISpecification): Promise<APISpecification> {
    const qualityAPI = { ...api };
    
    const scores = {
      documentation: this.scoreDocumentationQuality(api),
      security: this.scoreSecurityQuality(api),
      reliability: this.scoreReliabilityQuality(api),
      performance: this.scorePerformanceQuality(api),
      compliance: this.scoreComplianceQuality(api),
      usability: this.scoreUsabilityQuality(api)
    };

    const weights = {
      documentation: 0.25,
      security: 0.25,
      reliability: 0.20,
      performance: 0.15,
      compliance: 0.10,
      usability: 0.05
    };

    const overall = Object.entries(scores).reduce(
      (sum, [key, score]) => sum + score * weights[key as keyof typeof weights],
      0
    );

    qualityAPI.quality = {
      overall: Math.round(overall * 100) / 100,
      ...scores
    };

    return qualityAPI;
  }

  /**
   * Analyze API security
   */
  private async analyzeAPISecurity(api: APISpecification): Promise<APISpecification> {
    const securityAPI = { ...api };
    
    // Analyze security vulnerabilities
    const vulnerabilities = await this.scanForVulnerabilities(api);
    securityAPI.security.vulnerabilities = vulnerabilities;

    // Check for security best practices
    const securityIssues = this.checkSecurityBestPractices(api);
    
    return securityAPI;
  }

  /**
   * Extract endpoints from OpenAPI spec
   */
  private extractOpenAPIEndpoints(spec: any): APIEndpoint[] {
    const endpoints: APIEndpoint[] = [];

    for (const [path, pathItem] of Object.entries(spec.paths || {})) {
      for (const [method, operation] of Object.entries(pathItem as any)) {
        if (['get', 'post', 'put', 'delete', 'patch', 'head', 'options'].includes(method)) {
          const op = operation as any;
          endpoints.push({
            id: `${method.toUpperCase()}_${path}`.replace(/[^a-zA-Z0-9_]/g, '_'),
            method: method.toUpperCase(),
            path,
            summary: op.summary || '',
            description: op.description || '',
            parameters: this.extractParameters(op.parameters || []),
            responses: this.extractResponses(op.responses || {}),
            security: op.security?.map((s: any) => Object.keys(s)[0]) || [],
            tags: op.tags || [],
            deprecated: op.deprecated || false
          });
        }
      }
    }

    return endpoints;
  }

  private extractParameters(params: any[]): APIParameter[] {
    return params.map(param => ({
      name: param.name,
      type: param.in,
      dataType: param.schema?.type || param.type || 'string',
      required: param.required || false,
      description: param.description || '',
      example: param.example,
      schema: param.schema
    }));
  }

  private extractResponses(responses: any): APIResponse[] {
    return Object.entries(responses).map(([code, response]: [string, any]) => ({
      statusCode: parseInt(code),
      description: response.description || '',
      schema: response.schema || response.content,
      examples: response.examples,
      headers: response.headers
    }));
  }

  /**
   * Extract security info from OpenAPI spec
   */
  private extractOpenAPISecurity(spec: any): APISecurityInfo {
    const securitySchemes = spec.components?.securitySchemes || {};
    const security = spec.security || [];

    return {
      authentication: Object.keys(securitySchemes),
      authorization: security.map((s: any) => Object.keys(s)[0]),
      rateLimit: {
        requests: 1000,
        window: '1h',
        scope: 'user'
      },
      cors: {
        allowedOrigins: ['*'],
        allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: false
      },
      vulnerabilities: []
    };
  }

  /**
   * Extract documentation from OpenAPI spec
   */
  private extractOpenAPIDocumentation(spec: any): APIDocumentation {
    return {
      description: spec.info?.description || '',
      examples: [],
      guides: [],
      sdks: [],
      changelog: []
    };
  }

  /**
   * Quality scoring methods
   */
  private scoreDocumentationQuality(api: APISpecification): number {
    let score = 0;
    
    // Check for basic documentation
    if (api.documentation.description) score += 0.3;
    
    // Check endpoint documentation
    const documntedEndpoints = api.endpoints.filter(e => e.description && e.summary);
    score += (documntedEndpoints.length / api.endpoints.length) * 0.4;
    
    // Check for examples
    if (api.documentation.examples.length > 0) score += 0.2;
    
    // Check for guides
    if (api.documentation.guides.length > 0) score += 0.1;
    
    return Math.min(score, 1.0);
  }

  private scoreSecurityQuality(api: APISpecification): number {
    let score = 0;
    
    // Check for authentication
    if (api.security.authentication.length > 0) score += 0.4;
    
    // Check for authorization
    if (api.security.authorization.length > 0) score += 0.3;
    
    // Check for rate limiting
    if (api.security.rateLimit) score += 0.2;
    
    // Deduct for vulnerabilities
    const criticalVulns = api.security.vulnerabilities.filter(v => v.severity === 'critical').length;
    const highVulns = api.security.vulnerabilities.filter(v => v.severity === 'high').length;
    score -= (criticalVulns * 0.3 + highVulns * 0.1);
    
    return Math.max(0, Math.min(score, 1.0));
  }

  private scoreReliabilityQuality(api: APISpecification): number {
    // Based on error rates and uptime
    const errorRate = api.usage.errors.rate;
    return Math.max(0, 1 - errorRate);
  }

  private scorePerformanceQuality(api: APISpecification): number {
    // Based on latency metrics
    const p95Latency = api.usage.latency.p95;
    if (p95Latency < 100) return 1.0;
    if (p95Latency < 500) return 0.8;
    if (p95Latency < 1000) return 0.6;
    if (p95Latency < 2000) return 0.4;
    return 0.2;
  }

  private scoreComplianceQuality(api: APISpecification): number {
    // Check compliance with organization standards
    return 0.8; // Placeholder
  }

  private scoreUsabilityQuality(api: APISpecification): number {
    // Based on API design patterns and conventions
    let score = 0;
    
    // Check for consistent naming
    const hasConsistentNaming = this.checkNamingConsistency(api);
    if (hasConsistentNaming) score += 0.3;
    
    // Check for proper HTTP methods
    const hasProperMethods = this.checkHTTPMethods(api);
    if (hasProperMethods) score += 0.3;
    
    // Check for error handling
    const hasErrorHandling = this.checkErrorHandling(api);
    if (hasErrorHandling) score += 0.4;
    
    return score;
  }

  private checkNamingConsistency(api: APISpecification): boolean {
    // Check if endpoints follow consistent naming conventions
    return true; // Placeholder
  }

  private checkHTTPMethods(api: APISpecification): boolean {
    // Check if proper HTTP methods are used
    return true; // Placeholder
  }

  private checkErrorHandling(api: APISpecification): boolean {
    // Check if error responses are properly defined
    return api.endpoints.some(e => 
      e.responses.some(r => r.statusCode >= 400 && r.statusCode < 600)
    );
  }

  private async scanForVulnerabilities(api: APISpecification): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];
    
    // Check for common API vulnerabilities
    if (!api.security.authentication.length) {
      vulnerabilities.push({
        id: 'no-auth',
        severity: 'high',
        type: 'Authentication',
        description: 'API has no authentication mechanism',
        remediation: 'Implement proper authentication',
        discovered: new Date()
      });
    }

    // Check for other security issues
    // ... additional security checks

    return vulnerabilities;
  }

  private checkSecurityBestPractices(api: APISpecification): string[] {
    const issues: string[] = [];
    
    // Check various security best practices
    if (!api.security.rateLimit) {
      issues.push('No rate limiting configured');
    }
    
    return issues;
  }

  private inferAPICategories(api: APISpecification): string[] {
    const categories: string[] = [];
    
    // Infer categories from endpoints and tags
    const allTags = api.endpoints.flatMap(e => e.tags);
    const uniqueTags = [...new Set(allTags)];
    
    // Map common patterns to categories
    if (uniqueTags.some(tag => ['user', 'auth', 'account'].includes(tag.toLowerCase()))) {
      categories.push('Authentication');
    }
    
    if (uniqueTags.some(tag => ['payment', 'billing', 'transaction'].includes(tag.toLowerCase()))) {
      categories.push('Finance');
    }
    
    return categories;
  }

  private inferAPITags(api: APISpecification): string[] {
    const tags: string[] = [];
    
    // Extract tags from specification
    const allTags = api.endpoints.flatMap(e => e.tags);
    return [...new Set(allTags)];
  }

  /**
   * Start periodic scanning
   */
  private startPeriodicScanning(): void {
    if (this.config.enableRealTimeScanning && !this.discoveryInterval) {
      this.discoveryInterval = setInterval(() => {
        this.performFullScan().catch(error => {
          this.logger.error(error, 'Periodic scan failed');
        });
      }, this.config.scanInterval);
    }
  }

  /**
   * Get all discovered APIs
   */
  getAllAPIs(): APISpecification[] {
    return Array.from(this.discoveredAPIs.values());
  }

  /**
   * Get API by ID
   */
  getAPI(id: string): APISpecification | undefined {
    return this.discoveredAPIs.get(id);
  }

  /**
   * Search APIs
   */
  searchAPIs(query: APISearchQuery): APISpecification[] {
    let apis = this.getAllAPIs();

    if (query.name) {
      apis = apis.filter(api => 
        api.name.toLowerCase().includes(query.name!.toLowerCase())
      );
    }

    if (query.tags && query.tags.length > 0) {
      apis = apis.filter(api =>
        query.tags!.some(tag => api.metadata.tags.includes(tag))
      );
    }

    if (query.categories && query.categories.length > 0) {
      apis = apis.filter(api =>
        query.categories!.some(cat => api.metadata.categories.includes(cat))
      );
    }

    if (query.minQuality) {
      apis = apis.filter(api => api.quality.overall >= query.minQuality!);
    }

    return apis;
  }
}

// Abstract base class for source scanners
abstract class APISourceScanner {
  constructor(
    protected readonly config: Record<string, any>,
    protected readonly logger: Logger
  ) {}

  abstract scan(): Promise<APISpecification[]>;
}

// Repository scanner implementation
class RepositoryScanner extends APISourceScanner {
  async scan(): Promise<APISpecification[]> {
    const apis: APISpecification[] = [];
    
    // Scan repositories for API specifications
    const repositories = await this.getRepositories();
    
    for (const repo of repositories) {
      try {
        const repoAPIs = await this.scanRepository(repo);
        apis.push(...repoAPIs);
      } catch (error) {
        this.logger.warn({ repo, error }, 'Failed to scan repository');
      }
    }
    
    return apis;
  }

  private async getRepositories(): Promise<Repository[]> {
    // Implementation to fetch repositories
    return [];
  }

  private async scanRepository(repo: Repository): Promise<APISpecification[]> {
    // Implementation to scan repository for API specs
    return [];
  }
}

// Other scanner implementations
class GatewayScanner extends APISourceScanner {
  async scan(): Promise<APISpecification[]> {
    // Implementation for API gateway scanning
    return [];
  }
}

class ServiceMeshScanner extends APISourceScanner {
  async scan(): Promise<APISpecification[]> {
    // Implementation for service mesh scanning
    return [];
  }
}

class DocumentationScanner extends APISourceScanner {
  async scan(): Promise<APISpecification[]> {
    // Implementation for documentation scanning
    return [];
  }
}

class RegistryScanner extends APISourceScanner {
  async scan(): Promise<APISpecification[]> {
    // Implementation for registry scanning
    return [];
  }
}

// Supporting interfaces
interface Repository {
  name: string;
  url: string;
  branch: string;
}

interface DiscoveryResult {
  totalFound: number;
  newAPIs: number;
  updatedAPIs: number;
  duration: number;
  timestamp: Date;
}

interface APISearchQuery {
  name?: string;
  tags?: string[];
  categories?: string[];
  minQuality?: number;
  type?: string;
  serviceId?: string;
}

interface QualityRule {
  id: string;
  name: string;
  description: string;
  weight: number;
  evaluator: (api: APISpecification) => number;
}

interface SecurityRule {
  id: string;
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  check: (api: APISpecification) => boolean;
}

export { APIDiscoveryEngine, type APISpecification, type APIEndpoint };