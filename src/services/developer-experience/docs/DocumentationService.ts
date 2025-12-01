/**
 * API Documentation Service
 * Generate, manage, and serve API documentation
 */

import {
  APIDocumentation,
  APISpecification,
  APIEndpoint,
  APIModel,
  APIAuthentication,
  APIChangelogEntry,
  SDKConfig,
  SDKGenerationResult,
  SDKLanguage,
  DocSearchQuery,
  DocSearchResult,
  APITryItRequest,
  APITryItResponse,
} from './types';

// ============================================================================
// Documentation Service
// ============================================================================

export class DocumentationService {
  private docs: Map<string, APIDocumentation> = new Map();
  private sdkJobs: Map<string, SDKGenerationResult> = new Map();

  constructor() {
    this.initializeSampleDocs();
  }

  // ============================================================================
  // Documentation Management
  // ============================================================================

  async createDocumentation(
    spec: APISpecification,
    metadata?: Partial<APIDocumentation>
  ): Promise<APIDocumentation> {
    const parsed = await this.parseSpecification(spec);
    const doc: APIDocumentation = {
      id: `api-${Date.now()}`,
      name: metadata?.name || parsed.name || 'Untitled API',
      version: metadata?.version || parsed.version || '1.0.0',
      description: metadata?.description || parsed.description || '',
      baseUrl: parsed.baseUrl,
      specification: spec,
      endpoints: parsed.endpoints,
      models: parsed.models,
      authentication: parsed.authentication,
      changelog: [],
      metadata: {
        owner: metadata?.metadata?.owner || 'unknown',
        ...metadata?.metadata,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.docs.set(doc.id, doc);
    return doc;
  }

  async updateDocumentation(
    docId: string,
    updates: Partial<APIDocumentation>
  ): Promise<APIDocumentation | null> {
    const doc = this.docs.get(docId);
    if (!doc) return null;

    const updated = {
      ...doc,
      ...updates,
      id: doc.id,
      updatedAt: new Date().toISOString(),
    };

    this.docs.set(docId, updated);
    return updated;
  }

  async deleteDocumentation(docId: string): Promise<boolean> {
    return this.docs.delete(docId);
  }

  async getDocumentation(docId: string): Promise<APIDocumentation | null> {
    return this.docs.get(docId) || null;
  }

  async listDocumentation(owner?: string): Promise<APIDocumentation[]> {
    const docs = Array.from(this.docs.values());
    if (owner) {
      return docs.filter(d => d.metadata.owner === owner);
    }
    return docs;
  }

  // ============================================================================
  // Specification Parsing
  // ============================================================================

  private async parseSpecification(spec: APISpecification): Promise<{
    name: string;
    version: string;
    description: string;
    baseUrl: string;
    endpoints: APIEndpoint[];
    models: APIModel[];
    authentication: APIAuthentication[];
  }> {
    // In production, use proper OpenAPI/AsyncAPI/GraphQL parsers
    // This is a simplified implementation
    const parsed: any = spec.parsedSpec || {};

    return {
      name: parsed.info?.title || 'API',
      version: parsed.info?.version || '1.0.0',
      description: parsed.info?.description || '',
      baseUrl: parsed.servers?.[0]?.url || 'https://api.example.com',
      endpoints: this.extractEndpoints(parsed),
      models: this.extractModels(parsed),
      authentication: this.extractAuthentication(parsed),
    };
  }

  private extractEndpoints(spec: any): APIEndpoint[] {
    const endpoints: APIEndpoint[] = [];
    const paths = spec.paths || {};

    for (const [path, pathItem] of Object.entries(paths)) {
      for (const method of ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']) {
        const operation = (pathItem as any)[method];
        if (operation) {
          endpoints.push({
            id: `${method}-${path}`.replace(/[^a-zA-Z0-9]/g, '-'),
            method: method.toUpperCase() as any,
            path,
            summary: operation.summary || '',
            description: operation.description,
            operationId: operation.operationId,
            tags: operation.tags,
            deprecated: operation.deprecated,
            parameters: (operation.parameters || []).map((p: any) => ({
              name: p.name,
              in: p.in,
              description: p.description,
              required: p.required || false,
              schema: p.schema || { type: 'string' },
            })),
            requestBody: operation.requestBody ? {
              description: operation.requestBody.description,
              required: operation.requestBody.required || false,
              content: operation.requestBody.content,
            } : undefined,
            responses: Object.entries(operation.responses || {}).map(([code, resp]: [string, any]) => ({
              statusCode: code === 'default' ? 'default' : parseInt(code, 10),
              description: resp.description || '',
              content: resp.content,
            })),
          });
        }
      }
    }

    return endpoints;
  }

  private extractModels(spec: any): APIModel[] {
    const models: APIModel[] = [];
    const schemas = spec.components?.schemas || spec.definitions || {};

    for (const [name, schema] of Object.entries(schemas)) {
      models.push({
        name,
        description: (schema as any).description,
        schema: schema as any,
      });
    }

    return models;
  }

  private extractAuthentication(spec: any): APIAuthentication[] {
    const auth: APIAuthentication[] = [];
    const securitySchemes = spec.components?.securitySchemes || spec.securityDefinitions || {};

    for (const [name, scheme] of Object.entries(securitySchemes)) {
      const s = scheme as any;
      auth.push({
        type: s.type,
        name,
        description: s.description,
        scheme: s.scheme,
        bearerFormat: s.bearerFormat,
        flows: s.flows,
        apiKeyLocation: s.in,
        apiKeyName: s.name,
      });
    }

    return auth;
  }

  // ============================================================================
  // SDK Generation
  // ============================================================================

  async generateSDK(docId: string, config: SDKConfig): Promise<SDKGenerationResult> {
    const doc = this.docs.get(docId);
    if (!doc) {
      throw new Error('Documentation not found');
    }

    const job: SDKGenerationResult = {
      id: `sdk-${Date.now()}`,
      config,
      status: 'pending',
      startedAt: new Date().toISOString(),
    };

    this.sdkJobs.set(job.id, job);

    // Start async generation
    this.processSDKGeneration(job.id, doc);

    return job;
  }

  private async processSDKGeneration(jobId: string, doc: APIDocumentation): Promise<void> {
    const job = this.sdkJobs.get(jobId);
    if (!job) return;

    job.status = 'generating';
    job.progress = 0;

    try {
      const files: SDKGenerationResult['files'] = [];

      // Generate files based on language
      switch (job.config.language) {
        case 'typescript':
          files.push(...this.generateTypeScriptSDK(doc, job.config));
          break;
        case 'python':
          files.push(...this.generatePythonSDK(doc, job.config));
          break;
        default:
          files.push(...this.generateGenericSDK(doc, job.config));
      }

      job.progress = 100;
      job.status = 'completed';
      job.files = files;
      job.completedAt = new Date().toISOString();
      job.downloadUrl = `/api/docs/sdk/${job.id}/download`;
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  private generateTypeScriptSDK(doc: APIDocumentation, config: SDKConfig): SDKGenerationResult['files'] {
    const files: NonNullable<SDKGenerationResult['files']> = [];

    // Generate types
    const types = this.generateTypeScriptTypes(doc);
    files.push({
      path: 'src/types.ts',
      content: types,
      type: 'source',
    });

    // Generate client
    const client = this.generateTypeScriptClient(doc, config);
    files.push({
      path: 'src/client.ts',
      content: client,
      type: 'source',
    });

    // Generate index
    files.push({
      path: 'src/index.ts',
      content: `export * from './types';\nexport * from './client';\n`,
      type: 'source',
    });

    // Generate package.json
    files.push({
      path: 'package.json',
      content: JSON.stringify({
        name: config.packageName || `@portal/${doc.name.toLowerCase().replace(/\s+/g, '-')}-sdk`,
        version: config.version,
        description: config.description || `SDK for ${doc.name}`,
        main: 'dist/index.js',
        types: 'dist/index.d.ts',
        scripts: {
          build: 'tsc',
          test: 'jest',
        },
        dependencies: config.options.useAxios
          ? { axios: '^1.6.0' }
          : {},
        devDependencies: {
          typescript: '^5.0.0',
        },
      }, null, 2),
      type: 'config',
    });

    // Generate README
    if (config.options.includeReadme) {
      files.push({
        path: 'README.md',
        content: this.generateReadme(doc, config),
        type: 'doc',
      });
    }

    return files;
  }

  private generateTypeScriptTypes(doc: APIDocumentation): string {
    let content = '// Auto-generated types\n\n';

    for (const model of doc.models) {
      content += `/**\n * ${model.description || model.name}\n */\n`;
      content += `export interface ${model.name} {\n`;

      const props = model.schema.properties || {};
      const required = model.schema.required || [];

      for (const [propName, propSchema] of Object.entries(props)) {
        const isRequired = required.includes(propName);
        const tsType = this.schemaToTypeScript(propSchema as any);
        content += `  ${propName}${isRequired ? '' : '?'}: ${tsType};\n`;
      }

      content += '}\n\n';
    }

    return content;
  }

  private generateTypeScriptClient(doc: APIDocumentation, config: SDKConfig): string {
    let content = `// Auto-generated API client
import { ${doc.models.map(m => m.name).join(', ')} } from './types';

export interface ClientConfig {
  baseUrl?: string;
  apiKey?: string;
  timeout?: number;
}

export class ${doc.name.replace(/\s+/g, '')}Client {
  private baseUrl: string;
  private apiKey?: string;
  private timeout: number;

  constructor(config: ClientConfig = {}) {
    this.baseUrl = config.baseUrl || '${doc.baseUrl}';
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 30000;
  }

  private async request<T>(
    method: string,
    path: string,
    options: { body?: any; params?: Record<string, string> } = {}
  ): Promise<T> {
    const url = new URL(path, this.baseUrl);
    if (options.params) {
      Object.entries(options.params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const response = await fetch(url.toString(), {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { 'Authorization': \`Bearer \${this.apiKey}\` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
    }

    return response.json();
  }

`;

    // Generate methods for each endpoint
    for (const endpoint of doc.endpoints) {
      const methodName = this.generateMethodName(endpoint);
      const params = endpoint.parameters.filter(p => p.in === 'query' || p.in === 'path');
      const hasBody = !!endpoint.requestBody;

      content += `  /**\n   * ${endpoint.summary}\n   */\n`;
      content += `  async ${methodName}(`;

      // Method parameters
      const methodParams: string[] = [];
      for (const param of params.filter(p => p.required)) {
        methodParams.push(`${param.name}: ${this.schemaToTypeScript(param.schema)}`);
      }
      if (hasBody) {
        methodParams.push('body: any');
      }
      if (params.some(p => !p.required)) {
        methodParams.push(`options?: { ${params.filter(p => !p.required).map(p => `${p.name}?: ${this.schemaToTypeScript(p.schema)}`).join('; ')} }`);
      }

      content += methodParams.join(', ');
      content += `): Promise<any> {\n`;

      // Build path with parameters
      let path = endpoint.path;
      for (const param of params.filter(p => p.in === 'path')) {
        path = path.replace(`{${param.name}}`, `\${${param.name}}`);
      }

      content += `    return this.request('${endpoint.method}', \`${path}\``;
      if (hasBody || params.some(p => p.in === 'query')) {
        content += `, { `;
        if (hasBody) content += 'body, ';
        if (params.some(p => p.in === 'query')) {
          content += `params: { ${params.filter(p => p.in === 'query').map(p => p.required ? p.name : `...options?.${p.name} && { ${p.name}: options.${p.name} }`).join(', ')} }`;
        }
        content += ` }`;
      }
      content += `);\n  }\n\n`;
    }

    content += '}\n';
    return content;
  }

  private generatePythonSDK(doc: APIDocumentation, config: SDKConfig): SDKGenerationResult['files'] {
    const files: NonNullable<SDKGenerationResult['files']> = [];

    // Generate models
    let models = `"""Auto-generated data models."""
from dataclasses import dataclass
from typing import Optional, List, Dict, Any

`;

    for (const model of doc.models) {
      models += `@dataclass\nclass ${model.name}:\n    """${model.description || model.name}"""\n`;
      const props = model.schema.properties || {};
      for (const [propName, propSchema] of Object.entries(props)) {
        const pyType = this.schemaToPython(propSchema as any);
        models += `    ${propName}: ${pyType}\n`;
      }
      models += '\n';
    }

    files.push({
      path: `${config.packageName || 'sdk'}/models.py`,
      content: models,
      type: 'source',
    });

    // Generate client
    let client = `"""Auto-generated API client."""
import requests
from typing import Optional, Dict, Any

class ${doc.name.replace(/\s+/g, '')}Client:
    """Client for ${doc.name} API."""

    def __init__(self, base_url: str = "${doc.baseUrl}", api_key: Optional[str] = None):
        self.base_url = base_url
        self.api_key = api_key
        self.session = requests.Session()
        if api_key:
            self.session.headers["Authorization"] = f"Bearer {api_key}"

`;

    for (const endpoint of doc.endpoints) {
      const methodName = this.generateMethodName(endpoint).replace(/([A-Z])/g, '_$1').toLowerCase();
      client += `    def ${methodName}(self`;

      for (const param of endpoint.parameters.filter(p => p.required)) {
        client += `, ${param.name}: ${this.schemaToPython(param.schema)}`;
      }
      if (endpoint.requestBody) {
        client += ', body: Dict[str, Any]';
      }

      client += `) -> Dict[str, Any]:\n`;
      client += `        """${endpoint.summary}"""\n`;
      client += `        return self.session.${endpoint.method.toLowerCase()}(\n`;
      client += `            f"{self.base_url}${endpoint.path}"\n`;
      if (endpoint.requestBody) {
        client += `            , json=body\n`;
      }
      client += `        ).json()\n\n`;
    }

    files.push({
      path: `${config.packageName || 'sdk'}/client.py`,
      content: client,
      type: 'source',
    });

    // Generate __init__.py
    files.push({
      path: `${config.packageName || 'sdk'}/__init__.py`,
      content: `from .client import ${doc.name.replace(/\s+/g, '')}Client\nfrom .models import *\n`,
      type: 'source',
    });

    return files;
  }

  private generateGenericSDK(doc: APIDocumentation, config: SDKConfig): SDKGenerationResult['files'] {
    return [{
      path: 'README.md',
      content: this.generateReadme(doc, config),
      type: 'doc',
    }];
  }

  private generateReadme(doc: APIDocumentation, config: SDKConfig): string {
    return `# ${doc.name} SDK

${doc.description}

## Installation

\`\`\`bash
npm install ${config.packageName || `@portal/${doc.name.toLowerCase().replace(/\s+/g, '-')}-sdk`}
\`\`\`

## Usage

\`\`\`typescript
import { ${doc.name.replace(/\s+/g, '')}Client } from '${config.packageName || `@portal/${doc.name.toLowerCase().replace(/\s+/g, '-')}-sdk`}';

const client = new ${doc.name.replace(/\s+/g, '')}Client({
  baseUrl: '${doc.baseUrl}',
  apiKey: 'your-api-key',
});

// Example usage
const result = await client.someMethod();
\`\`\`

## Available Methods

${doc.endpoints.map(e => `- \`${this.generateMethodName(e)}()\` - ${e.summary}`).join('\n')}

## Documentation

For full API documentation, visit [${doc.baseUrl}/docs](${doc.baseUrl}/docs)

## License

${config.license || 'MIT'}
`;
  }

  // ============================================================================
  // Search
  // ============================================================================

  async search(query: DocSearchQuery): Promise<DocSearchResult> {
    const results: DocSearchResult['items'] = [];
    const searchText = query.text.toLowerCase();

    for (const doc of this.docs.values()) {
      if (query.apiId && doc.id !== query.apiId) continue;

      // Search endpoints
      for (const endpoint of doc.endpoints) {
        if (query.types && !query.types.includes('endpoint')) continue;

        const matchScore = this.calculateMatchScore(searchText, [
          endpoint.summary,
          endpoint.description || '',
          endpoint.path,
          endpoint.operationId || '',
        ]);

        if (matchScore > 0) {
          results.push({
            type: 'endpoint',
            apiId: doc.id,
            apiName: doc.name,
            id: endpoint.id,
            title: `${endpoint.method} ${endpoint.path}`,
            description: endpoint.summary,
            path: endpoint.path,
            method: endpoint.method,
            highlights: this.extractHighlights(searchText, endpoint.summary + ' ' + (endpoint.description || '')),
            score: matchScore,
          });
        }
      }

      // Search models
      for (const model of doc.models) {
        if (query.types && !query.types.includes('model')) continue;

        const matchScore = this.calculateMatchScore(searchText, [
          model.name,
          model.description || '',
        ]);

        if (matchScore > 0) {
          results.push({
            type: 'model',
            apiId: doc.id,
            apiName: doc.name,
            id: model.name,
            title: model.name,
            description: model.description,
            highlights: this.extractHighlights(searchText, model.name + ' ' + (model.description || '')),
            score: matchScore,
          });
        }
      }
    }

    // Sort by score
    results.sort((a, b) => b.score - a.score);

    return {
      items: results.slice(0, query.limit || 20),
      total: results.length,
    };
  }

  private calculateMatchScore(query: string, texts: string[]): number {
    let score = 0;
    for (const text of texts) {
      if (text.toLowerCase().includes(query)) {
        score += text.toLowerCase().split(query).length - 1;
        if (text.toLowerCase().startsWith(query)) score += 2;
      }
    }
    return score;
  }

  private extractHighlights(query: string, text: string): string[] {
    const highlights: string[] = [];
    const words = text.split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      if (words[i].toLowerCase().includes(query)) {
        const start = Math.max(0, i - 3);
        const end = Math.min(words.length, i + 4);
        highlights.push(words.slice(start, end).join(' '));
      }
    }
    return highlights.slice(0, 3);
  }

  // ============================================================================
  // Try It Out
  // ============================================================================

  async tryEndpoint(request: APITryItRequest): Promise<APITryItResponse> {
    const startTime = Date.now();

    try {
      // Find the endpoint
      let endpoint: APIEndpoint | undefined;
      let doc: APIDocumentation | undefined;

      for (const d of this.docs.values()) {
        endpoint = d.endpoints.find(e => e.id === request.endpointId);
        if (endpoint) {
          doc = d;
          break;
        }
      }

      if (!endpoint || !doc) {
        return {
          success: false,
          statusCode: 0,
          statusText: 'Not Found',
          headers: {},
          body: null,
          duration: Date.now() - startTime,
          size: 0,
          error: 'Endpoint not found',
        };
      }

      // Build URL
      let url = (request.server || doc.baseUrl) + endpoint.path;
      for (const param of endpoint.parameters.filter(p => p.in === 'path')) {
        url = url.replace(`{${param.name}}`, request.parameters?.[param.name] || '');
      }

      // Add query parameters
      const queryParams = new URLSearchParams();
      for (const param of endpoint.parameters.filter(p => p.in === 'query')) {
        if (request.parameters?.[param.name]) {
          queryParams.set(param.name, request.parameters[param.name]);
        }
      }
      if (queryParams.toString()) {
        url += '?' + queryParams.toString();
      }

      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...request.headers,
      };

      if (request.authentication) {
        if (request.authentication.type === 'apiKey') {
          headers['X-API-Key'] = request.authentication.value;
        } else {
          headers['Authorization'] = `Bearer ${request.authentication.value}`;
        }
      }

      // Make request
      const response = await fetch(url, {
        method: endpoint.method,
        headers,
        body: request.body ? JSON.stringify(request.body) : undefined,
      });

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const responseBody = await response.text();
      let parsedBody;
      try {
        parsedBody = JSON.parse(responseBody);
      } catch {
        parsedBody = responseBody;
      }

      return {
        success: response.ok,
        statusCode: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: parsedBody,
        duration: Date.now() - startTime,
        size: responseBody.length,
      };
    } catch (error) {
      return {
        success: false,
        statusCode: 0,
        statusText: 'Error',
        headers: {},
        body: null,
        duration: Date.now() - startTime,
        size: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private schemaToTypeScript(schema: any): string {
    if (!schema) return 'any';
    if (schema.$ref) {
      return schema.$ref.split('/').pop() || 'any';
    }
    switch (schema.type) {
      case 'string':
        return schema.enum ? schema.enum.map((e: any) => `'${e}'`).join(' | ') : 'string';
      case 'integer':
      case 'number':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'array':
        return `${this.schemaToTypeScript(schema.items)}[]`;
      case 'object':
        return 'Record<string, any>';
      default:
        return 'any';
    }
  }

  private schemaToPython(schema: any): string {
    if (!schema) return 'Any';
    switch (schema.type) {
      case 'string':
        return 'str';
      case 'integer':
        return 'int';
      case 'number':
        return 'float';
      case 'boolean':
        return 'bool';
      case 'array':
        return `List[${this.schemaToPython(schema.items)}]`;
      case 'object':
        return 'Dict[str, Any]';
      default:
        return 'Any';
    }
  }

  private generateMethodName(endpoint: APIEndpoint): string {
    if (endpoint.operationId) {
      return endpoint.operationId;
    }

    const pathParts = endpoint.path
      .replace(/\{[^}]+\}/g, '')
      .split('/')
      .filter(Boolean);

    const method = endpoint.method.toLowerCase();
    const resource = pathParts.pop() || '';

    return method + resource.charAt(0).toUpperCase() + resource.slice(1);
  }

  async getSDKGenerationStatus(jobId: string): Promise<SDKGenerationResult | null> {
    return this.sdkJobs.get(jobId) || null;
  }

  // ============================================================================
  // Sample Data
  // ============================================================================

  private initializeSampleDocs(): void {
    const sampleDoc: APIDocumentation = {
      id: 'api-sample',
      name: 'Developer Portal API',
      version: '1.0.0',
      description: 'API for the Internal Developer Portal',
      baseUrl: 'https://api.portal.example.com',
      specification: {
        format: 'openapi3',
        version: '3.0.3',
      },
      endpoints: [
        {
          id: 'get-catalog-entities',
          method: 'GET',
          path: '/api/catalog/entities',
          summary: 'List catalog entities',
          description: 'Returns a paginated list of entities in the software catalog',
          tags: ['Catalog'],
          parameters: [
            { name: 'kind', in: 'query', description: 'Filter by entity kind', required: false, schema: { type: 'string' } },
            { name: 'page', in: 'query', description: 'Page number', required: false, schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', description: 'Items per page', required: false, schema: { type: 'integer', default: 20 } },
          ],
          responses: [
            { statusCode: 200, description: 'List of entities' },
            { statusCode: 401, description: 'Unauthorized' },
          ],
        },
        {
          id: 'get-entity',
          method: 'GET',
          path: '/api/catalog/entities/{ref}',
          summary: 'Get entity by reference',
          description: 'Returns a single entity by its reference',
          tags: ['Catalog'],
          parameters: [
            { name: 'ref', in: 'path', description: 'Entity reference', required: true, schema: { type: 'string' } },
          ],
          responses: [
            { statusCode: 200, description: 'Entity details' },
            { statusCode: 404, description: 'Entity not found' },
          ],
        },
        {
          id: 'execute-template',
          method: 'POST',
          path: '/api/templates/{templateId}/execute',
          summary: 'Execute a template',
          description: 'Creates resources from a software template',
          tags: ['Templates'],
          parameters: [
            { name: 'templateId', in: 'path', description: 'Template ID', required: true, schema: { type: 'string' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { type: 'object' },
              },
            },
          },
          responses: [
            { statusCode: 201, description: 'Template execution started' },
            { statusCode: 400, description: 'Invalid parameters' },
          ],
        },
      ],
      models: [
        {
          name: 'Entity',
          description: 'A catalog entity',
          schema: {
            type: 'object',
            required: ['apiVersion', 'kind', 'metadata'],
            properties: {
              apiVersion: { type: 'string' },
              kind: { type: 'string' },
              metadata: { type: 'object' },
              spec: { type: 'object' },
            },
          },
        },
      ],
      authentication: [
        {
          type: 'http',
          name: 'bearerAuth',
          description: 'JWT Bearer token',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        {
          type: 'apiKey',
          name: 'apiKeyAuth',
          description: 'API key authentication',
          apiKeyLocation: 'header',
          apiKeyName: 'X-API-Key',
        },
      ],
      changelog: [
        {
          version: '1.0.0',
          date: '2024-01-15',
          type: 'major',
          changes: [
            { type: 'added', description: 'Initial API release' },
          ],
        },
      ],
      metadata: {
        owner: 'platform-team',
        contact: {
          name: 'Platform Team',
          email: 'platform@example.com',
        },
        servers: [
          { url: 'https://api.portal.example.com', description: 'Production', environment: 'production' },
          { url: 'https://api.staging.portal.example.com', description: 'Staging', environment: 'staging' },
        ],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.docs.set(sampleDoc.id, sampleDoc);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let documentationServiceInstance: DocumentationService | null = null;

export function getDocumentationService(): DocumentationService {
  if (!documentationServiceInstance) {
    documentationServiceInstance = new DocumentationService();
  }
  return documentationServiceInstance;
}
