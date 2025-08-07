import * as fs from 'fs/promises';
import * as path from 'path';
import SwaggerParser from '@apidevtools/swagger-parser';
import { parse as parseJS } from '@babel/parser';
import traverse from '@babel/traverse';
import { DocumentationExtractor, ExtractedDocumentation } from './DocumentationExtractor';

export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
    contact?: {
      name?: string;
      email?: string;
      url?: string;
    };
    license?: {
      name: string;
      url?: string;
    };
  };
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  paths: Record<string, Record<string, {
    summary?: string;
    description?: string;
    operationId?: string;
    tags?: string[];
    parameters?: Array<{
      name: string;
      in: 'query' | 'path' | 'header' | 'cookie';
      required?: boolean;
      description?: string;
      schema?: any;
    }>;
    requestBody?: {
      description?: string;
      required?: boolean;
      content: Record<string, {
        schema?: any;
      }>;
    };
    responses: Record<string, {
      description: string;
      content?: Record<string, {
        schema?: any;
      }>;
    }>;
    security?: Array<Record<string, string[]>>;
  }>>;
  components?: {
    schemas?: Record<string, any>;
    securitySchemes?: Record<string, any>;
  };
  tags?: Array<{
    name: string;
    description?: string;
  }>;
}

export interface GraphQLSchema {
  types: Array<{
    name: string;
    kind: 'OBJECT' | 'INPUT_OBJECT' | 'INTERFACE' | 'UNION' | 'ENUM' | 'SCALAR';
    description?: string;
    fields?: Array<{
      name: string;
      type: string;
      description?: string;
      args?: Array<{
        name: string;
        type: string;
        description?: string;
        defaultValue?: any;
      }>;
      deprecated?: boolean;
      deprecationReason?: string;
    }>;
    enumValues?: Array<{
      name: string;
      description?: string;
      deprecated?: boolean;
    }>;
    possibleTypes?: string[];
  }>;
  queries: Array<{
    name: string;
    type: string;
    description?: string;
    args?: Array<{
      name: string;
      type: string;
      description?: string;
      defaultValue?: any;
    }>;
    deprecated?: boolean;
  }>;
  mutations: Array<{
    name: string;
    type: string;
    description?: string;
    args?: Array<{
      name: string;
      type: string;
      description?: string;
      defaultValue?: any;
    }>;
    deprecated?: boolean;
  }>;
  subscriptions: Array<{
    name: string;
    type: string;
    description?: string;
    args?: Array<{
      name: string;
      type: string;
      description?: string;
      defaultValue?: any;
    }>;
    deprecated?: boolean;
  }>;
}

export interface APIEndpoint {
  path: string;
  method: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters: Array<{
    name: string;
    type: 'query' | 'path' | 'body' | 'header';
    required: boolean;
    description?: string;
    schema?: any;
    example?: any;
  }>;
  requestBody?: {
    contentType: string;
    schema?: any;
    example?: any;
  };
  responses: Record<string, {
    description: string;
    schema?: any;
    example?: any;
  }>;
  authentication?: Array<{
    type: 'bearer' | 'apiKey' | 'oauth2' | 'basic';
    name?: string;
    location?: 'header' | 'query' | 'cookie';
  }>;
  examples?: Array<{
    name: string;
    request?: any;
    response?: any;
  }>;
}

export class APIDocGenerator {
  private extractor: DocumentationExtractor;
  private cache: Map<string, { spec: OpenAPISpec; lastModified: number }> = new Map();
  private cacheMaxAge = 10 * 60 * 1000; // 10 minutes

  constructor(
    private options: {
      includeExamples?: boolean;
      inferTypes?: boolean;
      includeInternal?: boolean;
      validateResponses?: boolean;
      extractSchemas?: boolean;
    } = {}
  ) {
    this.options = {
      includeExamples: true,
      inferTypes: true,
      includeInternal: false,
      validateResponses: true,
      extractSchemas: true,
      ...options,
    };

    this.extractor = new DocumentationExtractor({
      includePrivate: this.options.includeInternal,
      extractExamples: this.options.includeExamples,
    });
  }

  /**
   * Generate OpenAPI specification from Next.js API routes
   */
  async generateOpenAPIFromRoutes(routesDirectory: string): Promise<OpenAPISpec> {
    const cacheKey = routesDirectory;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.lastModified < this.cacheMaxAge) {
      return cached.spec;
    }

    const routeFiles = await this.findRouteFiles(routesDirectory);
    const endpoints: APIEndpoint[] = [];
    const schemas: Record<string, any> = {};

    // Extract documentation from each route file
    for (const routeFile of routeFiles) {
      const documentation = await this.extractor.extractFromFile(routeFile);
      const routeEndpoints = await this.extractEndpointsFromRoute(routeFile, documentation);
      endpoints.push(...routeEndpoints);

      // Extract schemas from TypeScript interfaces
      if (this.options.extractSchemas) {
        const fileSchemas = await this.extractSchemasFromFile(routeFile);
        Object.assign(schemas, fileSchemas);
      }
    }

    // Build OpenAPI spec
    const spec: OpenAPISpec = {
      openapi: '3.0.3',
      info: {
        title: 'API Documentation',
        version: '1.0.0',
        description: 'Auto-generated API documentation',
      },
      servers: [
        {
          url: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
          description: 'Development server',
        },
      ],
      paths: {},
      components: {
        schemas,
        securitySchemes: await this.detectSecuritySchemes(endpoints),
      },
      tags: this.generateTags(endpoints),
    };

    // Group endpoints by path and method
    for (const endpoint of endpoints) {
      if (!spec.paths[endpoint.path]) {
        spec.paths[endpoint.path] = {};
      }

      spec.paths[endpoint.path][endpoint.method] = {
        summary: endpoint.summary,
        description: endpoint.description,
        operationId: this.generateOperationId(endpoint),
        tags: endpoint.tags,
        parameters: endpoint.parameters.map(param => ({
          name: param.name,
          in: param.type as any,
          required: param.required,
          description: param.description,
          schema: param.schema || { type: 'string' },
        })),
        requestBody: endpoint.requestBody ? {
          description: 'Request body',
          required: true,
          content: {
            [endpoint.requestBody.contentType]: {
              schema: endpoint.requestBody.schema,
            },
          },
        } : undefined,
        responses: Object.entries(endpoint.responses).reduce((acc, [code, response]) => {
          acc[code] = {
            description: response.description,
            content: response.schema ? {
              'application/json': {
                schema: response.schema,
              },
            } : undefined,
          };
          return acc;
        }, {} as any),
        security: endpoint.authentication?.map(auth => ({
          [auth.name || auth.type]: [],
        })),
      };
    }

    // Cache the result
    this.cache.set(cacheKey, {
      spec,
      lastModified: Date.now(),
    });

    return spec;
  }

  /**
   * Extract endpoints from a single route file
   */
  private async extractEndpointsFromRoute(
    filePath: string,
    documentation: ExtractedDocumentation
  ): Promise<APIEndpoint[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const endpoints: APIEndpoint[] = [];

    try {
      const ast = parseJS(content, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
      });

      const routePath = this.extractRoutePathFromFile(filePath);

      traverse(ast, {
        ExportNamedDeclaration: (path) => {
          const declaration = path.node.declaration;
          
          if (declaration?.type === 'FunctionDeclaration' && declaration.id?.name) {
            const methodName = declaration.id.name.toUpperCase();
            
            if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(methodName)) {
              const endpoint = this.createEndpointFromFunction(
                routePath,
                methodName.toLowerCase(),
                declaration,
                documentation,
                content
              );
              
              if (endpoint) {
                endpoints.push(endpoint);
              }
            }
          }
        },
      });
    } catch (error) {
      console.warn(`Error parsing route file ${filePath}:`, error);
    }

    return endpoints;
  }

  /**
   * Create an API endpoint from a function declaration
   */
  private createEndpointFromFunction(
    path: string,
    method: string,
    functionNode: any,
    documentation: ExtractedDocumentation,
    content: string
  ): APIEndpoint | null {
    // Find corresponding function documentation
    const funcDoc = documentation.functions.find(f => 
      f.name.toLowerCase() === method || 
      f.name === functionNode.id?.name
    );

    const endpoint: APIEndpoint = {
      path,
      method,
      summary: funcDoc?.documentation.description?.split('\n')[0] || `${method.toUpperCase()} ${path}`,
      description: funcDoc?.documentation.description,
      tags: this.extractTagsFromPath(path),
      parameters: [],
      responses: {
        '200': {
          description: 'Success',
        },
      },
    };

    // Extract parameters from path
    const pathParams = this.extractPathParameters(path);
    endpoint.parameters.push(...pathParams);

    // Extract query parameters from function
    if (funcDoc?.documentation.params) {
      for (const param of funcDoc.documentation.params) {
        if (param.name !== 'req' && param.name !== 'res' && param.name !== 'request') {
          endpoint.parameters.push({
            name: param.name,
            type: 'query',
            required: !param.optional,
            description: param.description,
            schema: this.inferSchemaFromType(param.type),
          });
        }
      }
    }

    // Try to infer request body schema for POST/PUT/PATCH
    if (['post', 'put', 'patch'].includes(method)) {
      const requestBodySchema = this.inferRequestBodySchema(content, functionNode);
      if (requestBodySchema) {
        endpoint.requestBody = {
          contentType: 'application/json',
          schema: requestBodySchema,
        };
      }
    }

    // Try to infer response schema
    const responseSchema = this.inferResponseSchema(content, functionNode);
    if (responseSchema) {
      endpoint.responses['200'] = {
        description: 'Success',
        schema: responseSchema,
      };
    }

    // Extract authentication requirements
    endpoint.authentication = this.detectAuthentication(content, functionNode);

    // Extract examples if available
    if (this.options.includeExamples && funcDoc?.documentation.examples) {
      endpoint.examples = funcDoc.documentation.examples.map((example, index) => ({
        name: `Example ${index + 1}`,
        request: this.parseExample(example, 'request'),
        response: this.parseExample(example, 'response'),
      }));
    }

    return endpoint;
  }

  /**
   * Extract schemas from TypeScript interfaces and types
   */
  private async extractSchemasFromFile(filePath: string): Promise<Record<string, any>> {
    const documentation = await this.extractor.extractFromFile(filePath);
    const schemas: Record<string, any> = {};

    // Convert interfaces to JSON schemas
    for (const interfaceDoc of documentation.interfaces) {
      const schema: any = {
        type: 'object',
        description: interfaceDoc.documentation.description,
        properties: {},
        required: [],
      };

      for (const prop of interfaceDoc.properties) {
        schema.properties[prop.name] = {
          description: prop.documentation.description,
          ...this.inferSchemaFromType(prop.type),
        };

        if (!prop.optional) {
          schema.required.push(prop.name);
        }
      }

      schemas[interfaceDoc.name] = schema;
    }

    // Convert type aliases to schemas
    for (const typeDoc of documentation.types) {
      schemas[typeDoc.name] = {
        description: typeDoc.documentation.description,
        ...this.inferSchemaFromTypeDefinition(typeDoc.definition),
      };
    }

    return schemas;
  }

  /**
   * Generate GraphQL schema documentation
   */
  async generateGraphQLSchema(schemaFile: string): Promise<GraphQLSchema> {
    const content = await fs.readFile(schemaFile, 'utf-8');
    
    // This is a simplified GraphQL schema parser
    // In a real implementation, you'd use a proper GraphQL schema parser
    const schema: GraphQLSchema = {
      types: [],
      queries: [],
      mutations: [],
      subscriptions: [],
    };

    // Parse GraphQL schema (simplified regex-based approach)
    const typeRegex = /type\s+(\w+)\s*\{([^}]+)\}/g;
    const inputRegex = /input\s+(\w+)\s*\{([^}]+)\}/g;
    const enumRegex = /enum\s+(\w+)\s*\{([^}]+)\}/g;

    let match;

    // Extract types
    while ((match = typeRegex.exec(content)) !== null) {
      const [, name, fieldsStr] = match;
      const fields = this.parseGraphQLFields(fieldsStr);
      
      schema.types.push({
        name,
        kind: 'OBJECT',
        fields,
      });
    }

    // Extract input types
    while ((match = inputRegex.exec(content)) !== null) {
      const [, name, fieldsStr] = match;
      const fields = this.parseGraphQLFields(fieldsStr);
      
      schema.types.push({
        name,
        kind: 'INPUT_OBJECT',
        fields,
      });
    }

    // Extract enums
    while ((match = enumRegex.exec(content)) !== null) {
      const [, name, valuesStr] = match;
      const enumValues = valuesStr
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .map(value => ({ name: value }));
      
      schema.types.push({
        name,
        kind: 'ENUM',
        enumValues,
      });
    }

    // Extract queries, mutations, and subscriptions
    const queryMatch = content.match(/type\s+Query\s*\{([^}]+)\}/s);
    if (queryMatch) {
      schema.queries = this.parseGraphQLFields(queryMatch[1]);
    }

    const mutationMatch = content.match(/type\s+Mutation\s*\{([^}]+)\}/s);
    if (mutationMatch) {
      schema.mutations = this.parseGraphQLFields(mutationMatch[1]);
    }

    const subscriptionMatch = content.match(/type\s+Subscription\s*\{([^}]+)\}/s);
    if (subscriptionMatch) {
      schema.subscriptions = this.parseGraphQLFields(subscriptionMatch[1]);
    }

    return schema;
  }

  /**
   * Validate OpenAPI specification
   */
  async validateOpenAPISpec(spec: OpenAPISpec): Promise<{
    valid: boolean;
    errors: Array<{
      path: string;
      message: string;
      severity: 'error' | 'warning';
    }>;
  }> {
    try {
      await SwaggerParser.validate(spec as any);
      return { valid: true, errors: [] };
    } catch (error: any) {
      const errors = Array.isArray(error) ? error : [error];
      return {
        valid: false,
        errors: errors.map(err => ({
          path: err.path || 'unknown',
          message: err.message || 'Unknown error',
          severity: 'error' as const,
        })),
      };
    }
  }

  // Helper methods
  private async findRouteFiles(directory: string): Promise<string[]> {
    const files: string[] = [];
    
    async function scanDirectory(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await scanDirectory(fullPath);
        } else if (entry.name === 'route.ts' || entry.name === 'route.js') {
          files.push(fullPath);
        }
      }
    }

    await scanDirectory(directory);
    return files;
  }

  private extractRoutePathFromFile(filePath: string): string {
    const apiIndex = filePath.indexOf('/api/');
    if (apiIndex === -1) return '/';
    
    const routePart = filePath.substring(apiIndex + 4);
    const pathWithoutFile = routePart.replace(/\/route\.(ts|js)$/, '');
    
    // Convert Next.js dynamic routes to OpenAPI format
    return '/' + pathWithoutFile
      .replace(/\[([^\]]+)\]/g, '{$1}')
      .replace(/\[\.\.\.([^\]]+)\]/g, '{$1}'); // Handle catch-all routes
  }

  private extractTagsFromPath(path: string): string[] {
    const segments = path.split('/').filter(segment => segment && !segment.startsWith('{'));
    return segments.slice(0, 2); // Use first two segments as tags
  }

  private extractPathParameters(path: string): APIEndpoint['parameters'] {
    const params: APIEndpoint['parameters'] = [];
    const paramRegex = /\{([^}]+)\}/g;
    let match;

    while ((match = paramRegex.exec(path)) !== null) {
      params.push({
        name: match[1],
        type: 'path',
        required: true,
        description: `Path parameter: ${match[1]}`,
        schema: { type: 'string' },
      });
    }

    return params;
  }

  private inferSchemaFromType(type?: string): any {
    if (!type) return { type: 'string' };

    const typeMap: Record<string, any> = {
      'string': { type: 'string' },
      'number': { type: 'number' },
      'boolean': { type: 'boolean' },
      'Date': { type: 'string', format: 'date-time' },
      'object': { type: 'object' },
      'array': { type: 'array' },
    };

    // Handle array types
    if (type.endsWith('[]')) {
      const itemType = type.slice(0, -2);
      return {
        type: 'array',
        items: this.inferSchemaFromType(itemType),
      };
    }

    // Handle union types (simplified)
    if (type.includes('|')) {
      const types = type.split('|').map(t => t.trim());
      return {
        oneOf: types.map(t => this.inferSchemaFromType(t)),
      };
    }

    return typeMap[type] || { type: 'string' };
  }

  private inferSchemaFromTypeDefinition(definition: string): any {
    // Simplified type definition parsing
    if (definition.startsWith('{') && definition.endsWith('}')) {
      return { type: 'object' };
    }
    if (definition.includes('[]')) {
      return { type: 'array' };
    }
    return { type: 'string' };
  }

  private inferRequestBodySchema(content: string, functionNode: any): any | null {
    // Look for JSON.parse or body parsing patterns
    if (content.includes('await request.json()') || content.includes('req.body')) {
      return {
        type: 'object',
        description: 'Request body',
      };
    }
    return null;
  }

  private inferResponseSchema(content: string, functionNode: any): any | null {
    // Look for Response.json or return patterns
    if (content.includes('Response.json') || content.includes('NextResponse.json')) {
      return {
        type: 'object',
        description: 'Response data',
      };
    }
    return null;
  }

  private detectAuthentication(content: string, functionNode: any): APIEndpoint['authentication'] {
    const auth: APIEndpoint['authentication'] = [];

    if (content.includes('Authorization') || content.includes('Bearer')) {
      auth.push({
        type: 'bearer',
        name: 'bearerAuth',
        location: 'header',
      });
    }

    if (content.includes('api-key') || content.includes('x-api-key')) {
      auth.push({
        type: 'apiKey',
        name: 'apiKeyAuth',
        location: 'header',
      });
    }

    return auth.length > 0 ? auth : undefined;
  }

  private async detectSecuritySchemes(endpoints: APIEndpoint[]): Promise<Record<string, any>> {
    const schemes: Record<string, any> = {};

    const hasBearer = endpoints.some(ep => 
      ep.authentication?.some(auth => auth.type === 'bearer')
    );

    const hasApiKey = endpoints.some(ep => 
      ep.authentication?.some(auth => auth.type === 'apiKey')
    );

    if (hasBearer) {
      schemes.bearerAuth = {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      };
    }

    if (hasApiKey) {
      schemes.apiKeyAuth = {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
      };
    }

    return schemes;
  }

  private generateTags(endpoints: APIEndpoint[]): Array<{ name: string; description?: string }> {
    const tagSet = new Set<string>();
    
    for (const endpoint of endpoints) {
      if (endpoint.tags) {
        endpoint.tags.forEach(tag => tagSet.add(tag));
      }
    }

    return Array.from(tagSet).map(tag => ({
      name: tag,
      description: `Operations related to ${tag}`,
    }));
  }

  private generateOperationId(endpoint: APIEndpoint): string {
    const pathParts = endpoint.path.split('/').filter(part => part && !part.startsWith('{'));
    const operation = endpoint.method + pathParts.map(part => 
      part.charAt(0).toUpperCase() + part.slice(1)
    ).join('');
    
    return operation;
  }

  private parseExample(example: string, type: 'request' | 'response'): any {
    try {
      // Try to extract JSON from code block
      const jsonMatch = example.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      
      // Try to parse as direct JSON
      return JSON.parse(example);
    } catch {
      return example;
    }
  }

  private parseGraphQLFields(fieldsStr: string): any[] {
    const fields: any[] = [];
    const lines = fieldsStr.split('\n').map(line => line.trim()).filter(line => line);

    for (const line of lines) {
      if (line.startsWith('#')) continue; // Skip comments
      
      const match = line.match(/(\w+)(?:\(([^)]*)\))?\s*:\s*(.+)/);
      if (match) {
        const [, name, argsStr, type] = match;
        
        fields.push({
          name,
          type: type.replace(/[![\]]/g, '').trim(),
          args: argsStr ? this.parseGraphQLArgs(argsStr) : undefined,
        });
      }
    }

    return fields;
  }

  private parseGraphQLArgs(argsStr: string): any[] {
    const args: any[] = [];
    const argPairs = argsStr.split(',').map(arg => arg.trim());

    for (const arg of argPairs) {
      const match = arg.match(/(\w+)\s*:\s*(.+)/);
      if (match) {
        const [, name, type] = match;
        args.push({
          name,
          type: type.replace(/[![\]]/g, '').trim(),
        });
      }
    }

    return args;
  }

  /**
   * Export OpenAPI spec to file
   */
  async exportOpenAPISpec(spec: OpenAPISpec, outputPath: string): Promise<void> {
    const content = JSON.stringify(spec, null, 2);
    await fs.writeFile(outputPath, content, 'utf-8');
  }

  /**
   * Generate Postman collection from OpenAPI spec
   */
  generatePostmanCollection(spec: OpenAPISpec): any {
    const collection = {
      info: {
        name: spec.info.title,
        description: spec.info.description,
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      item: [] as any[],
    };

    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        const item = {
          name: operation.summary || `${method.toUpperCase()} ${path}`,
          request: {
            method: method.toUpperCase(),
            header: [] as any[],
            url: {
              raw: `{{baseUrl}}${path}`,
              host: ['{{baseUrl}}'],
              path: path.split('/').filter(p => p),
            },
            body: operation.requestBody ? {
              mode: 'raw',
              raw: JSON.stringify({}, null, 2),
              options: {
                raw: {
                  language: 'json',
                },
              },
            } : undefined,
          },
          response: [] as any[],
        };

        collection.item.push(item);
      }
    }

    return collection;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.extractor.clearCache();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxAge: number } {
    return {
      size: this.cache.size,
      maxAge: this.cacheMaxAge,
    };
  }
}

export default APIDocGenerator;