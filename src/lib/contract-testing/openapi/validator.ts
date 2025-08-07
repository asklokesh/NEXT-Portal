import SwaggerParser from '@apidevtools/swagger-parser';
import { OpenAPISpec, ValidationResult, PactContract, PactInteraction } from '../types';
import { JSONSchema7 } from 'json-schema';
import { Logger } from 'winston';
import { readFileSync } from 'fs';

export interface OpenAPIValidationOptions {
  strict?: boolean;
  validateExamples?: boolean;
  validateSecurity?: boolean;
  allowAdditionalProperties?: boolean;
}

export class OpenAPIValidator {
  private logger: Logger;
  private parser: SwaggerParser;

  constructor(logger: Logger) {
    this.logger = logger;
    this.parser = new SwaggerParser();
  }

  /**
   * Validate OpenAPI specification file
   */
  async validateSpecification(
    specPath: string,
    options: OpenAPIValidationOptions = {}
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Parse and validate the OpenAPI specification
      const spec = await this.parser.validate(specPath);
      
      this.logger.info('OpenAPI specification parsed successfully', {
        title: spec.info?.title,
        version: spec.info?.version,
        pathCount: Object.keys(spec.paths || {}).length
      });

      // Perform additional validations
      const additionalValidation = this.performAdditionalValidations(spec as OpenAPISpec, options);
      errors.push(...additionalValidation.errors);
      warnings.push(...additionalValidation.warnings);

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`OpenAPI specification validation failed: ${errorMessage}`);
      
      this.logger.error('OpenAPI specification validation failed', { error, specPath });
      
      return {
        isValid: false,
        errors,
        warnings
      };
    }
  }

  /**
   * Load and parse OpenAPI specification
   */
  async loadSpecification(specPath: string): Promise<OpenAPISpec> {
    try {
      const spec = await this.parser.dereference(specPath) as OpenAPISpec;
      
      this.logger.debug('OpenAPI specification loaded', {
        title: spec.info?.title,
        version: spec.info?.version,
        specPath
      });

      return spec;
    } catch (error) {
      this.logger.error('Failed to load OpenAPI specification', { error, specPath });
      throw new Error(`Failed to load OpenAPI specification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert Pact contract to OpenAPI specification
   */
  convertPactToOpenAPI(
    contract: PactContract,
    baseInfo?: { title?: string; version?: string; description?: string }
  ): OpenAPISpec {
    const spec: OpenAPISpec = {
      openapi: '3.0.0',
      info: {
        title: baseInfo?.title || `${contract.provider.name} API`,
        version: baseInfo?.version || contract.provider.version || '1.0.0',
        description: baseInfo?.description || `API specification generated from Pact contract for ${contract.provider.name}`
      },
      paths: {},
      components: {
        schemas: {},
        responses: {},
        parameters: {}
      }
    };

    // Convert each Pact interaction to OpenAPI path
    contract.interactions.forEach((interaction, index) => {
      const path = interaction.request.path;
      const method = interaction.request.method.toLowerCase();

      // Initialize path if not exists
      if (!spec.paths[path]) {
        spec.paths[path] = {};
      }

      // Create operation object
      const operation: any = {
        summary: interaction.description,
        description: `Generated from Pact interaction: ${interaction.description}`,
        operationId: this.generateOperationId(method, path, index),
        responses: {}
      };

      // Add parameters from query and headers
      const parameters: any[] = [];

      // Query parameters
      if (interaction.request.query) {
        Object.entries(interaction.request.query).forEach(([name, value]) => {
          parameters.push({
            name,
            in: 'query',
            required: false,
            schema: this.inferSchemaFromValue(value),
            example: Array.isArray(value) ? value[0] : value
          });
        });
      }

      // Header parameters (excluding standard HTTP headers)
      if (interaction.request.headers) {
        Object.entries(interaction.request.headers).forEach(([name, value]) => {
          if (!this.isStandardHttpHeader(name)) {
            parameters.push({
              name,
              in: 'header',
              required: false,
              schema: this.inferSchemaFromValue(value),
              example: Array.isArray(value) ? value[0] : value
            });
          }
        });
      }

      if (parameters.length > 0) {
        operation.parameters = parameters;
      }

      // Add request body for methods that typically have one
      if (['post', 'put', 'patch'].includes(method) && interaction.request.body) {
        operation.requestBody = {
          description: 'Request body',
          content: {
            'application/json': {
              schema: this.inferSchemaFromValue(interaction.request.body),
              example: interaction.request.body
            }
          }
        };
      }

      // Add response
      const statusCode = interaction.response.status.toString();
      operation.responses[statusCode] = {
        description: this.getResponseDescription(interaction.response.status),
        content: interaction.response.body ? {
          'application/json': {
            schema: this.inferSchemaFromValue(interaction.response.body),
            example: interaction.response.body
          }
        } : undefined
      };

      // Add default error responses if not present
      if (!operation.responses['400']) {
        operation.responses['400'] = { description: 'Bad Request' };
      }
      if (!operation.responses['500']) {
        operation.responses['500'] = { description: 'Internal Server Error' };
      }

      spec.paths[path][method] = operation;
    });

    this.logger.info('Converted Pact contract to OpenAPI specification', {
      consumer: contract.consumer.name,
      provider: contract.provider.name,
      pathCount: Object.keys(spec.paths).length,
      interactionCount: contract.interactions.length
    });

    return spec;
  }

  /**
   * Generate OpenAPI specification from multiple Pact contracts
   */
  generateOpenAPIFromContracts(
    contracts: PactContract[],
    baseInfo?: { title?: string; version?: string; description?: string }
  ): OpenAPISpec {
    if (contracts.length === 0) {
      throw new Error('No contracts provided for OpenAPI generation');
    }

    // Use the first contract's provider as the base
    const baseContract = contracts[0];
    let spec = this.convertPactToOpenAPI(baseContract, baseInfo);

    // Merge additional contracts
    contracts.slice(1).forEach(contract => {
      if (contract.provider.name !== baseContract.provider.name) {
        this.logger.warn('Merging contracts from different providers', {
          base: baseContract.provider.name,
          current: contract.provider.name
        });
      }

      const contractSpec = this.convertPactToOpenAPI(contract);
      spec = this.mergeOpenAPISpecs(spec, contractSpec);
    });

    return spec;
  }

  /**
   * Validate Pact contract against OpenAPI specification
   */
  async validateContractAgainstSpec(
    contract: PactContract,
    specPath: string
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const spec = await this.loadSpecification(specPath);

      contract.interactions.forEach((interaction, index) => {
        const interactionValidation = this.validateInteractionAgainstSpec(interaction, spec);
        interactionValidation.errors.forEach(error =>
          errors.push(`Interaction ${index + 1} (${interaction.description}): ${error}`)
        );
        interactionValidation.warnings.forEach(warning =>
          warnings.push(`Interaction ${index + 1} (${interaction.description}): ${warning}`)
        );
      });

      this.logger.info('Contract validation against OpenAPI completed', {
        consumer: contract.consumer.name,
        provider: contract.provider.name,
        specTitle: spec.info.title,
        isValid: errors.length === 0,
        errorCount: errors.length,
        warningCount: warnings.length
      });

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Failed to validate contract against specification: ${errorMessage}`);
      
      return {
        isValid: false,
        errors,
        warnings
      };
    }
  }

  private performAdditionalValidations(
    spec: OpenAPISpec,
    options: OpenAPIValidationOptions
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate required fields
    if (!spec.info?.title) {
      errors.push('OpenAPI specification must have a title');
    }

    if (!spec.info?.version) {
      errors.push('OpenAPI specification must have a version');
    }

    // Validate paths
    if (!spec.paths || Object.keys(spec.paths).length === 0) {
      warnings.push('OpenAPI specification has no paths defined');
    }

    // Validate operation IDs are unique
    if (options.strict) {
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
    }

    // Validate security schemes if security validation is enabled
    if (options.validateSecurity && spec.security) {
      spec.security.forEach(requirement => {
        Object.keys(requirement).forEach(schemeName => {
          if (!spec.components?.securitySchemes?.[schemeName]) {
            errors.push(`Security scheme '${schemeName}' not defined in components`);
          }
        });
      });
    }

    // Validate examples if enabled
    if (options.validateExamples) {
      this.validateExamples(spec, errors, warnings);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateInteractionAgainstSpec(
    interaction: PactInteraction,
    spec: OpenAPISpec
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const path = interaction.request.path;
    const method = interaction.request.method.toLowerCase();

    // Find matching path in spec
    const pathItem = this.findMatchingPath(path, spec.paths);
    if (!pathItem) {
      errors.push(`Path ${path} not found in OpenAPI specification`);
      return { isValid: false, errors, warnings };
    }

    const operation = pathItem[method as keyof typeof pathItem] as any;
    if (!operation) {
      errors.push(`Method ${method.toUpperCase()} not allowed for path ${path}`);
      return { isValid: false, errors, warnings };
    }

    // Validate request parameters
    if (operation.parameters) {
      const paramValidation = this.validateParametersAgainstSpec(interaction, operation.parameters);
      errors.push(...paramValidation.errors);
      warnings.push(...paramValidation.warnings);
    }

    // Validate request body
    if (operation.requestBody && interaction.request.body) {
      const bodyValidation = this.validateRequestBodyAgainstSpec(interaction.request.body, operation.requestBody);
      errors.push(...bodyValidation.errors);
      warnings.push(...bodyValidation.warnings);
    }

    // Validate response
    const responseValidation = this.validateResponseAgainstSpec(interaction.response, operation.responses);
    errors.push(...responseValidation.errors);
    warnings.push(...responseValidation.warnings);

    return { isValid: errors.length === 0, errors, warnings };
  }

  private findMatchingPath(requestPath: string, paths: Record<string, any>): any {
    // First try exact match
    if (paths[requestPath]) {
      return paths[requestPath];
    }

    // Try pattern matching for parameterized paths
    for (const [pathPattern, pathItem] of Object.entries(paths)) {
      if (this.pathMatches(requestPath, pathPattern)) {
        return pathItem;
      }
    }

    return null;
  }

  private pathMatches(requestPath: string, pathPattern: string): boolean {
    const regexPattern = pathPattern
      .replace(/\{[^}]+\}/g, '[^/]+')
      .replace(/\//g, '\\/');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(requestPath);
  }

  private validateParametersAgainstSpec(
    interaction: PactInteraction,
    parameters: any[]
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    parameters.forEach(param => {
      let value: any;

      switch (param.in) {
        case 'query':
          value = interaction.request.query?.[param.name];
          break;
        case 'header':
          value = this.findHeaderValue(interaction.request.headers || {}, param.name);
          break;
        case 'path':
          // Path parameter validation would require path parsing
          value = 'extracted-path-value';
          break;
      }

      if (param.required && (value === undefined || value === null)) {
        errors.push(`Required ${param.in} parameter '${param.name}' is missing`);
      }
    });

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateRequestBodyAgainstSpec(body: any, requestBodySpec: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!requestBodySpec.content) {
      warnings.push('Request body specification has no content defined');
      return { isValid: true, errors, warnings };
    }

    // For now, assume JSON content type
    const jsonContent = requestBodySpec.content['application/json'];
    if (!jsonContent) {
      warnings.push('Request body does not specify application/json content type');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateResponseAgainstSpec(response: any, responsesSpec: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const statusCode = response.status.toString();
    const responseSpec = responsesSpec[statusCode] || responsesSpec['default'];

    if (!responseSpec) {
      errors.push(`Response status ${statusCode} not defined in OpenAPI specification`);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateExamples(spec: OpenAPISpec, errors: string[], warnings: string[]): void {
    // Validate examples in components
    if (spec.components?.schemas) {
      Object.entries(spec.components.schemas).forEach(([schemaName, schema]) => {
        if (typeof schema === 'object' && 'example' in schema) {
          // Validate example against schema
          // Implementation would use JSON schema validation
        }
      });
    }

    // Validate examples in paths
    Object.entries(spec.paths).forEach(([path, pathItem]) => {
      Object.entries(pathItem).forEach(([method, operation]: [string, any]) => {
        if (operation?.requestBody?.content) {
          Object.entries(operation.requestBody.content).forEach(([mediaType, mediaObj]: [string, any]) => {
            if (mediaObj.example && mediaObj.schema) {
              // Validate example against schema
            }
          });
        }
      });
    });
  }

  private mergeOpenAPISpecs(spec1: OpenAPISpec, spec2: OpenAPISpec): OpenAPISpec {
    const merged = { ...spec1 };

    // Merge paths
    Object.entries(spec2.paths).forEach(([path, pathItem]) => {
      if (merged.paths[path]) {
        merged.paths[path] = { ...merged.paths[path], ...pathItem };
      } else {
        merged.paths[path] = pathItem;
      }
    });

    // Merge components
    if (spec2.components) {
      if (!merged.components) {
        merged.components = {};
      }

      ['schemas', 'responses', 'parameters', 'securitySchemes'].forEach(componentType => {
        if (spec2.components![componentType as keyof typeof spec2.components]) {
          if (!merged.components![componentType as keyof typeof merged.components]) {
            (merged.components as any)[componentType] = {};
          }
          Object.assign(
            (merged.components as any)[componentType],
            (spec2.components as any)[componentType]
          );
        }
      });
    }

    return merged;
  }

  private inferSchemaFromValue(value: any): JSONSchema7 {
    if (value === null) {
      return { type: 'null' };
    }

    if (Array.isArray(value)) {
      return {
        type: 'array',
        items: value.length > 0 ? this.inferSchemaFromValue(value[0]) : { type: 'string' }
      };
    }

    const type = typeof value;
    switch (type) {
      case 'string':
        return { type: 'string' };
      case 'number':
        return { type: 'number' };
      case 'boolean':
        return { type: 'boolean' };
      case 'object':
        const properties: Record<string, JSONSchema7> = {};
        Object.entries(value).forEach(([key, val]) => {
          properties[key] = this.inferSchemaFromValue(val);
        });
        return {
          type: 'object',
          properties,
          required: Object.keys(properties)
        };
      default:
        return { type: 'string' };
    }
  }

  private generateOperationId(method: string, path: string, index: number): string {
    const cleanPath = path
      .replace(/\{[^}]+\}/g, 'By')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase();
    
    return `${method}${cleanPath}${index}`;
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
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable'
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

  private findHeaderValue(headers: Record<string, string | string[]>, headerName: string): string | null {
    const normalizedName = headerName.toLowerCase();
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === normalizedName) {
        return Array.isArray(value) ? value[0] : value;
      }
    }
    return null;
  }
}