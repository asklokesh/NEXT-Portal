import { OpenAPISpec, PactContract, PactInteraction } from '../types';
import { JSONSchema7 } from 'json-schema';
import { Logger } from 'winston';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

export interface OpenAPIGeneratorOptions {
  format?: 'json' | 'yaml';
  includeExamples?: boolean;
  includeServers?: boolean;
  generateSchemas?: boolean;
  groupByTags?: boolean;
  addDefaultResponses?: boolean;
  securitySchemes?: Record<string, any>;
  contact?: {
    name?: string;
    email?: string;
    url?: string;
  };
  license?: {
    name: string;
    url?: string;
  };
}

export interface OpenAPITemplateConfig {
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: {
    url: string;
    description?: string;
  }[];
  tags?: {
    name: string;
    description?: string;
  }[];
  externalDocs?: {
    description?: string;
    url: string;
  };
}

export class OpenAPIGenerator {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Generate OpenAPI specification from Pact contracts
   */
  async generateFromContracts(
    contracts: PactContract[],
    templateConfig: OpenAPITemplateConfig,
    options: OpenAPIGeneratorOptions = {}
  ): Promise<OpenAPISpec> {
    if (contracts.length === 0) {
      throw new Error('No contracts provided for OpenAPI generation');
    }

    this.logger.info('Starting OpenAPI generation', {
      contractCount: contracts.length,
      format: options.format || 'json'
    });

    // Create base specification
    const spec: OpenAPISpec = {
      openapi: '3.0.3',
      info: {
        ...templateConfig.info,
        contact: options.contact,
        license: options.license
      },
      paths: {},
      components: {
        schemas: {},
        responses: {},
        parameters: {},
        securitySchemes: options.securitySchemes || {}
      }
    };

    // Add servers if configured
    if (options.includeServers && templateConfig.servers) {
      spec.servers = templateConfig.servers;
    }

    // Add external docs if configured
    if (templateConfig.externalDocs) {
      spec.externalDocs = templateConfig.externalDocs;
    }

    // Add tags if configured
    if (templateConfig.tags) {
      spec.tags = templateConfig.tags;
    }

    // Generate paths from contracts
    const schemaRegistry = new Map<string, JSONSchema7>();
    const operationIdRegistry = new Set<string>();

    for (const contract of contracts) {
      await this.processContract(contract, spec, schemaRegistry, operationIdRegistry, options);
    }

    // Add generated schemas to components
    if (options.generateSchemas) {
      schemaRegistry.forEach((schema, name) => {
        spec.components!.schemas![name] = schema;
      });
    }

    // Add default responses if configured
    if (options.addDefaultResponses) {
      this.addDefaultResponses(spec);
    }

    this.logger.info('OpenAPI generation completed', {
      pathCount: Object.keys(spec.paths).length,
      schemaCount: Object.keys(spec.components?.schemas || {}).length,
      contractsProcessed: contracts.length
    });

    return spec;
  }

  /**
   * Generate client SDK configuration
   */
  generateClientConfig(
    spec: OpenAPISpec,
    language: 'typescript' | 'javascript' | 'python' | 'java' | 'go' = 'typescript'
  ): any {
    const config = {
      openapi: spec,
      generatorName: this.getGeneratorName(language),
      outputDir: `./generated-clients/${language}`,
      packageName: this.getPackageName(spec.info.title, language),
      packageVersion: spec.info.version,
      additionalProperties: this.getLanguageSpecificProperties(language)
    };

    this.logger.info('Generated client configuration', {
      language,
      packageName: config.packageName,
      outputDir: config.outputDir
    });

    return config;
  }

  /**
   * Save OpenAPI specification to file
   */
  async saveSpecification(
    spec: OpenAPISpec,
    filePath: string,
    options: OpenAPIGeneratorOptions = {}
  ): Promise<string> {
    const format = options.format || 'json';
    const fullPath = filePath.endsWith(`.${format}`) ? filePath : `${filePath}.${format}`;
    
    // Ensure directory exists
    const dir = join(fullPath, '..');
    mkdirSync(dir, { recursive: true });

    let content: string;
    if (format === 'yaml') {
      content = yaml.dump(spec, {
        indent: 2,
        lineWidth: -1,
        noRefs: false
      });
    } else {
      content = JSON.stringify(spec, null, 2);
    }

    writeFileSync(fullPath, content, 'utf8');

    this.logger.info('OpenAPI specification saved', {
      filePath: fullPath,
      format,
      size: content.length
    });

    return fullPath;
  }

  /**
   * Generate mock server configuration
   */
  generateMockServerConfig(spec: OpenAPISpec): any {
    const config = {
      specification: spec,
      mock: {
        dynamic: true,
        validateRequest: true,
        validateResponse: true,
        cors: true,
        preferExamples: true
      },
      server: {
        port: 3001,
        host: 'localhost'
      },
      logging: {
        level: 'info',
        prettyPrint: true
      }
    };

    this.logger.info('Generated mock server configuration', {
      pathCount: Object.keys(spec.paths).length,
      port: config.server.port
    });

    return config;
  }

  /**
   * Validate generated specification
   */
  async validateGeneratedSpec(spec: OpenAPISpec): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Basic validation
    if (!spec.openapi) {
      errors.push('Missing openapi version');
    }

    if (!spec.info?.title) {
      errors.push('Missing info.title');
    }

    if (!spec.info?.version) {
      errors.push('Missing info.version');
    }

    if (!spec.paths || Object.keys(spec.paths).length === 0) {
      errors.push('No paths defined');
    }

    // Validate operation IDs are unique
    const operationIds = new Set<string>();
    Object.values(spec.paths).forEach(pathItem => {
      Object.values(pathItem).forEach((operation: any) => {
        if (operation?.operationId) {
          if (operationIds.has(operation.operationId)) {
            errors.push(`Duplicate operationId: ${operation.operationId}`);
          }
          operationIds.add(operation.operationId);
        }
      });
    });

    // Validate schema references
    Object.values(spec.paths).forEach(pathItem => {
      Object.values(pathItem).forEach((operation: any) => {
        this.validateSchemaReferences(operation, spec, errors);
      });
    });

    const isValid = errors.length === 0;
    this.logger.info('Generated specification validation completed', {
      isValid,
      errorCount: errors.length
    });

    return { isValid, errors };
  }

  private async processContract(
    contract: PactContract,
    spec: OpenAPISpec,
    schemaRegistry: Map<string, JSONSchema7>,
    operationIdRegistry: Set<string>,
    options: OpenAPIGeneratorOptions
  ): Promise<void> {
    this.logger.debug('Processing contract', {
      consumer: contract.consumer.name,
      provider: contract.provider.name,
      interactionCount: contract.interactions.length
    });

    for (const interaction of contract.interactions) {
      await this.processInteraction(
        interaction,
        contract,
        spec,
        schemaRegistry,
        operationIdRegistry,
        options
      );
    }
  }

  private async processInteraction(
    interaction: PactInteraction,
    contract: PactContract,
    spec: OpenAPISpec,
    schemaRegistry: Map<string, JSONSchema7>,
    operationIdRegistry: Set<string>,
    options: OpenAPIGeneratorOptions
  ): Promise<void> {
    const path = interaction.request.path;
    const method = interaction.request.method.toLowerCase();

    // Initialize path if not exists
    if (!spec.paths[path]) {
      spec.paths[path] = {};
    }

    // Generate operation
    const operation: any = {
      summary: interaction.description,
      description: `Generated from Pact contract between ${contract.consumer.name} and ${contract.provider.name}`,
      operationId: this.generateUniqueOperationId(method, path, operationIdRegistry),
      tags: options.groupByTags ? [contract.provider.name] : undefined,
      responses: {}
    };

    // Add parameters
    const parameters = this.generateParameters(interaction, schemaRegistry, options);
    if (parameters.length > 0) {
      operation.parameters = parameters;
    }

    // Add request body
    if (['post', 'put', 'patch'].includes(method) && interaction.request.body) {
      operation.requestBody = this.generateRequestBody(interaction, schemaRegistry, options);
    }

    // Add responses
    operation.responses = this.generateResponses(interaction, schemaRegistry, options);

    // Add security if present
    if (interaction.request.headers?.authorization || interaction.request.headers?.Authorization) {
      operation.security = [{ bearerAuth: [] }];
      
      // Add security scheme to components
      if (!spec.components?.securitySchemes?.bearerAuth) {
        spec.components!.securitySchemes!.bearerAuth = {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        };
      }
    }

    spec.paths[path][method] = operation;

    this.logger.debug('Processed interaction', {
      path,
      method,
      operationId: operation.operationId
    });
  }

  private generateParameters(
    interaction: PactInteraction,
    schemaRegistry: Map<string, JSONSchema7>,
    options: OpenAPIGeneratorOptions
  ): any[] {
    const parameters: any[] = [];

    // Query parameters
    if (interaction.request.query) {
      Object.entries(interaction.request.query).forEach(([name, value]) => {
        const schema = this.inferSchema(value, schemaRegistry, options);
        parameters.push({
          name,
          in: 'query',
          required: false,
          schema,
          example: options.includeExamples ? (Array.isArray(value) ? value[0] : value) : undefined
        });
      });
    }

    // Header parameters
    if (interaction.request.headers) {
      Object.entries(interaction.request.headers).forEach(([name, value]) => {
        if (!this.isStandardHttpHeader(name)) {
          const schema = this.inferSchema(value, schemaRegistry, options);
          parameters.push({
            name,
            in: 'header',
            required: false,
            schema,
            example: options.includeExamples ? (Array.isArray(value) ? value[0] : value) : undefined
          });
        }
      });
    }

    // Path parameters
    const pathParams = this.extractPathParameters(interaction.request.path);
    pathParams.forEach(paramName => {
      parameters.push({
        name: paramName,
        in: 'path',
        required: true,
        schema: { type: 'string' },
        example: options.includeExamples ? 'example-value' : undefined
      });
    });

    return parameters;
  }

  private generateRequestBody(
    interaction: PactInteraction,
    schemaRegistry: Map<string, JSONSchema7>,
    options: OpenAPIGeneratorOptions
  ): any {
    if (!interaction.request.body) {
      return undefined;
    }

    const contentType = this.getContentType(interaction.request.headers) || 'application/json';
    const schema = this.inferSchema(interaction.request.body, schemaRegistry, options);

    const requestBody: any = {
      description: 'Request body',
      required: true,
      content: {
        [contentType]: {
          schema
        }
      }
    };

    if (options.includeExamples) {
      requestBody.content[contentType].example = interaction.request.body;
    }

    return requestBody;
  }

  private generateResponses(
    interaction: PactInteraction,
    schemaRegistry: Map<string, JSONSchema7>,
    options: OpenAPIGeneratorOptions
  ): any {
    const responses: any = {};
    const statusCode = interaction.response.status.toString();

    const response: any = {
      description: this.getResponseDescription(interaction.response.status)
    };

    // Add headers
    if (interaction.response.headers) {
      response.headers = {};
      Object.entries(interaction.response.headers).forEach(([name, value]) => {
        if (!this.isStandardHttpHeader(name)) {
          response.headers[name] = {
            description: `${name} header`,
            schema: this.inferSchema(value, schemaRegistry, options)
          };
        }
      });
    }

    // Add content
    if (interaction.response.body) {
      const contentType = this.getContentType(interaction.response.headers) || 'application/json';
      const schema = this.inferSchema(interaction.response.body, schemaRegistry, options);

      response.content = {
        [contentType]: {
          schema
        }
      };

      if (options.includeExamples) {
        response.content[contentType].example = interaction.response.body;
      }
    }

    responses[statusCode] = response;

    return responses;
  }

  private inferSchema(
    value: any,
    schemaRegistry: Map<string, JSONSchema7>,
    options: OpenAPIGeneratorOptions,
    schemaName?: string
  ): JSONSchema7 {
    if (value === null) {
      return { type: 'null' };
    }

    if (Array.isArray(value)) {
      const itemSchema = value.length > 0 
        ? this.inferSchema(value[0], schemaRegistry, options)
        : { type: 'string' };
      
      return {
        type: 'array',
        items: itemSchema
      };
    }

    const type = typeof value;
    switch (type) {
      case 'string':
        return this.inferStringSchema(value);
      case 'number':
        return Number.isInteger(value) ? { type: 'integer' } : { type: 'number' };
      case 'boolean':
        return { type: 'boolean' };
      case 'object':
        return this.inferObjectSchema(value, schemaRegistry, options, schemaName);
      default:
        return { type: 'string' };
    }
  }

  private inferStringSchema(value: string): JSONSchema7 {
    // Detect common string formats
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      return { type: 'string', format: 'date-time' };
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return { type: 'string', format: 'date' };
    }
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return { type: 'string', format: 'email' };
    }
    if (/^https?:\/\//.test(value)) {
      return { type: 'string', format: 'uri' };
    }
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      return { type: 'string', format: 'uuid' };
    }

    return { type: 'string' };
  }

  private inferObjectSchema(
    value: Record<string, any>,
    schemaRegistry: Map<string, JSONSchema7>,
    options: OpenAPIGeneratorOptions,
    schemaName?: string
  ): JSONSchema7 {
    const properties: Record<string, JSONSchema7> = {};
    const required: string[] = [];

    Object.entries(value).forEach(([key, val]) => {
      properties[key] = this.inferSchema(val, schemaRegistry, options);
      if (val !== null && val !== undefined) {
        required.push(key);
      }
    });

    const schema: JSONSchema7 = {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
      additionalProperties: options.generateSchemas ? false : true
    };

    // Register schema if name provided and schema generation is enabled
    if (schemaName && options.generateSchemas) {
      schemaRegistry.set(schemaName, schema);
      return { $ref: `#/components/schemas/${schemaName}` };
    }

    return schema;
  }

  private generateUniqueOperationId(
    method: string,
    path: string,
    operationIdRegistry: Set<string>
  ): string {
    let baseId = this.generateOperationId(method, path);
    let counter = 1;
    let operationId = baseId;

    while (operationIdRegistry.has(operationId)) {
      operationId = `${baseId}${counter}`;
      counter++;
    }

    operationIdRegistry.add(operationId);
    return operationId;
  }

  private generateOperationId(method: string, path: string): string {
    const cleanPath = path
      .replace(/\{([^}]+)\}/g, 'By$1')
      .replace(/[^a-zA-Z0-9]/g, '')
      .replace(/^./, char => char.toUpperCase());
    
    return `${method}${cleanPath}`;
  }

  private extractPathParameters(path: string): string[] {
    const matches = path.match(/\{([^}]+)\}/g);
    return matches ? matches.map(match => match.slice(1, -1)) : [];
  }

  private getContentType(headers?: Record<string, string | string[]>): string | null {
    if (!headers) return null;
    
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === 'content-type') {
        return Array.isArray(value) ? value[0] : value;
      }
    }
    
    return null;
  }

  private getResponseDescription(statusCode: number): string {
    const descriptions: Record<number, string> = {
      200: 'OK',
      201: 'Created',
      202: 'Accepted',
      204: 'No Content',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      422: 'Unprocessable Entity',
      500: 'Internal Server Error'
    };

    return descriptions[statusCode] || `HTTP ${statusCode}`;
  }

  private isStandardHttpHeader(headerName: string): boolean {
    const standardHeaders = [
      'accept', 'accept-encoding', 'accept-language', 'authorization',
      'cache-control', 'content-length', 'content-type', 'cookie',
      'host', 'user-agent', 'referer', 'connection'
    ];

    return standardHeaders.includes(headerName.toLowerCase());
  }

  private addDefaultResponses(spec: OpenAPISpec): void {
    const defaultResponses = {
      '400': { description: 'Bad Request' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden' },
      '404': { description: 'Not Found' },
      '500': { description: 'Internal Server Error' }
    };

    Object.values(spec.paths).forEach(pathItem => {
      Object.values(pathItem).forEach((operation: any) => {
        if (operation?.responses) {
          Object.entries(defaultResponses).forEach(([code, response]) => {
            if (!operation.responses[code]) {
              operation.responses[code] = response;
            }
          });
        }
      });
    });
  }

  private getGeneratorName(language: string): string {
    const generators = {
      typescript: 'typescript-axios',
      javascript: 'javascript',
      python: 'python',
      java: 'java',
      go: 'go'
    };

    return generators[language as keyof typeof generators] || 'typescript-axios';
  }

  private getPackageName(title: string, language: string): string {
    const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '-');
    
    switch (language) {
      case 'java':
        return `com.example.${cleanTitle.replace(/-/g, '.')}`;
      case 'python':
        return cleanTitle.replace(/-/g, '_');
      default:
        return cleanTitle;
    }
  }

  private getLanguageSpecificProperties(language: string): Record<string, any> {
    switch (language) {
      case 'typescript':
        return {
          npmName: '@company/api-client',
          supportsES6: true,
          withInterfaces: true,
          typescriptThreePlus: true
        };
      case 'java':
        return {
          artifactId: 'api-client',
          groupId: 'com.company',
          artifactVersion: '1.0.0',
          library: 'okhttp-gson'
        };
      case 'python':
        return {
          packageName: 'api_client',
          packageVersion: '1.0.0',
          library: 'urllib3'
        };
      default:
        return {};
    }
  }

  private validateSchemaReferences(operation: any, spec: OpenAPISpec, errors: string[]): void {
    const checkReference = (obj: any, path: string = '') => {
      if (typeof obj !== 'object' || obj === null) return;

      if (obj.$ref && typeof obj.$ref === 'string') {
        if (obj.$ref.startsWith('#/components/schemas/')) {
          const schemaName = obj.$ref.replace('#/components/schemas/', '');
          if (!spec.components?.schemas?.[schemaName]) {
            errors.push(`Schema reference not found: ${obj.$ref} at ${path}`);
          }
        }
      }

      Object.entries(obj).forEach(([key, value]) => {
        checkReference(value, `${path}.${key}`);
      });
    };

    checkReference(operation);
  }
}