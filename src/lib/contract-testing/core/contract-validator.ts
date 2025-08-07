import { PactContract, PactInteraction, PactRequest, PactResponse, OpenAPISpec, OperationObject } from '../types';
import { JSONSchema7, validate } from 'json-schema';
import { Logger } from 'winston';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class ContractValidator {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Validate a complete Pact contract
   */
  validateContract(contract: PactContract): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate basic structure
    if (!contract.consumer?.name) {
      errors.push('Contract must have a consumer name');
    }

    if (!contract.provider?.name) {
      errors.push('Contract must have a provider name');
    }

    if (!Array.isArray(contract.interactions)) {
      errors.push('Contract must have an interactions array');
    } else if (contract.interactions.length === 0) {
      warnings.push('Contract has no interactions defined');
    }

    // Validate metadata
    if (!contract.metadata?.pactSpecification?.version) {
      errors.push('Contract must specify Pact specification version');
    } else {
      const version = contract.metadata.pactSpecification.version;
      if (!['2.0.0', '3.0.0', '4.0.0'].includes(version)) {
        warnings.push(`Unsupported Pact specification version: ${version}`);
      }
    }

    // Validate each interaction
    contract.interactions?.forEach((interaction, index) => {
      const interactionResult = this.validateInteraction(interaction);
      interactionResult.errors.forEach(error => 
        errors.push(`Interaction ${index + 1}: ${error}`)
      );
      interactionResult.warnings.forEach(warning => 
        warnings.push(`Interaction ${index + 1}: ${warning}`)
      );
    });

    const result = {
      isValid: errors.length === 0,
      errors,
      warnings
    };

    this.logger.debug('Contract validation completed', {
      consumer: contract.consumer?.name,
      provider: contract.provider?.name,
      isValid: result.isValid,
      errorCount: errors.length,
      warningCount: warnings.length
    });

    return result;
  }

  /**
   * Validate a single Pact interaction
   */
  validateInteraction(interaction: PactInteraction): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate description
    if (!interaction.description || typeof interaction.description !== 'string') {
      errors.push('Interaction must have a description');
    }

    // Validate request
    const requestResult = this.validateRequest(interaction.request);
    errors.push(...requestResult.errors.map(e => `Request: ${e}`));
    warnings.push(...requestResult.warnings.map(w => `Request: ${w}`));

    // Validate response
    const responseResult = this.validateResponse(interaction.response);
    errors.push(...responseResult.errors.map(e => `Response: ${e}`));
    warnings.push(...responseResult.warnings.map(w => `Response: ${w}`));

    // Validate provider states
    if (interaction.providerStates) {
      interaction.providerStates.forEach((state, index) => {
        if (!state.name || typeof state.name !== 'string') {
          errors.push(`Provider state ${index + 1} must have a name`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate a Pact request
   */
  validateRequest(request: PactRequest): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate method
    if (!request.method || typeof request.method !== 'string') {
      errors.push('Request must have a method');
    } else {
      const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
      if (!validMethods.includes(request.method.toUpperCase())) {
        warnings.push(`Unusual HTTP method: ${request.method}`);
      }
    }

    // Validate path
    if (!request.path || typeof request.path !== 'string') {
      errors.push('Request must have a path');
    } else if (!request.path.startsWith('/')) {
      errors.push('Request path must start with /');
    }

    // Validate headers
    if (request.headers) {
      this.validateHeaders(request.headers, 'request').forEach(error => errors.push(error));
    }

    // Validate query parameters
    if (request.query) {
      Object.entries(request.query).forEach(([key, value]) => {
        if (typeof key !== 'string') {
          errors.push('Query parameter keys must be strings');
        }
        if (value !== null && typeof value !== 'string' && !Array.isArray(value)) {
          errors.push(`Query parameter ${key} must be string, array, or null`);
        }
      });
    }

    // Validate body for appropriate methods
    const methodsWithBody = ['POST', 'PUT', 'PATCH'];
    if (methodsWithBody.includes(request.method?.toUpperCase()) && !request.body) {
      warnings.push(`${request.method} request typically has a body`);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate a Pact response
   */
  validateResponse(response: PactResponse): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate status
    if (typeof response.status !== 'number') {
      errors.push('Response must have a numeric status code');
    } else if (response.status < 100 || response.status >= 600) {
      errors.push('Response status code must be between 100-599');
    }

    // Validate headers
    if (response.headers) {
      this.validateHeaders(response.headers, 'response').forEach(error => errors.push(error));
    }

    // Content-Type validation
    if (response.body && response.headers) {
      const contentType = this.findHeaderValue(response.headers, 'content-type');
      if (!contentType) {
        warnings.push('Response with body should have Content-Type header');
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate against OpenAPI specification
   */
  validateAgainstOpenAPI(
    interaction: PactInteraction,
    openApiSpec: OpenAPISpec
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const { request, response } = interaction;

    // Find matching path in OpenAPI spec
    const pathMatch = this.findMatchingPath(request.path, openApiSpec.paths);
    if (!pathMatch) {
      errors.push(`Path ${request.path} not found in OpenAPI specification`);
      return { isValid: false, errors, warnings };
    }

    const { pathPattern, pathItem } = pathMatch;
    const operation = pathItem[request.method.toLowerCase() as keyof typeof pathItem] as OperationObject;

    if (!operation) {
      errors.push(`Method ${request.method} not allowed for path ${request.path}`);
      return { isValid: false, errors, warnings };
    }

    // Validate request against OpenAPI operation
    const requestValidation = this.validateRequestAgainstOperation(request, operation, openApiSpec);
    errors.push(...requestValidation.errors);
    warnings.push(...requestValidation.warnings);

    // Validate response against OpenAPI operation
    const responseValidation = this.validateResponseAgainstOperation(response, operation, openApiSpec);
    errors.push(...responseValidation.errors);
    warnings.push(...responseValidation.warnings);

    this.logger.debug('OpenAPI validation completed', {
      path: request.path,
      method: request.method,
      isValid: errors.length === 0,
      errorCount: errors.length,
      warningCount: warnings.length
    });

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate JSON schema
   */
  validateJsonSchema(data: any, schema: JSONSchema7): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const validationResult = validate(data, schema);
      if (validationResult.errors) {
        validationResult.errors.forEach(error => {
          errors.push(`${error.property}: ${error.message}`);
        });
      }
    } catch (error) {
      errors.push(`Schema validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateHeaders(
    headers: Record<string, string | string[]>, 
    context: 'request' | 'response'
  ): string[] {
    const errors: string[] = [];

    Object.entries(headers).forEach(([key, value]) => {
      if (typeof key !== 'string') {
        errors.push(`${context} header keys must be strings`);
      }
      if (value !== null && typeof value !== 'string' && !Array.isArray(value)) {
        errors.push(`${context} header ${key} must be string, array, or null`);
      }
      if (Array.isArray(value)) {
        value.forEach((v, i) => {
          if (typeof v !== 'string') {
            errors.push(`${context} header ${key}[${i}] must be string`);
          }
        });
      }
    });

    return errors;
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

  private findMatchingPath(requestPath: string, paths: Record<string, any>): {
    pathPattern: string;
    pathItem: any;
  } | null {
    // First try exact match
    if (paths[requestPath]) {
      return { pathPattern: requestPath, pathItem: paths[requestPath] };
    }

    // Try pattern matching for parameterized paths
    for (const [pathPattern, pathItem] of Object.entries(paths)) {
      if (this.pathMatches(requestPath, pathPattern)) {
        return { pathPattern, pathItem };
      }
    }

    return null;
  }

  private pathMatches(requestPath: string, pathPattern: string): boolean {
    // Convert OpenAPI path parameters to regex
    const regexPattern = pathPattern
      .replace(/\{[^}]+\}/g, '[^/]+')
      .replace(/\//g, '\\/');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(requestPath);
  }

  private validateRequestAgainstOperation(
    request: PactRequest,
    operation: OperationObject,
    spec: OpenAPISpec
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate parameters
    if (operation.parameters) {
      operation.parameters.forEach(param => {
        const { name, in: paramIn, required, schema } = param;
        let value: any;

        switch (paramIn) {
          case 'query':
            value = request.query?.[name];
            break;
          case 'header':
            value = this.findHeaderValue(request.headers || {}, name);
            break;
          case 'path':
            // Extract path parameter value - simplified implementation
            value = 'path-param-value'; // In real implementation, extract from actual path
            break;
        }

        if (required && (value === undefined || value === null)) {
          errors.push(`Required ${paramIn} parameter '${name}' is missing`);
        }

        if (value !== undefined && schema) {
          const schemaValidation = this.validateJsonSchema(value, schema);
          errors.push(...schemaValidation.errors.map(e => `Parameter ${name}: ${e}`));
        }
      });
    }

    // Validate request body
    if (operation.requestBody && request.body) {
      const contentType = this.findHeaderValue(request.headers || {}, 'content-type') || 'application/json';
      const mediaType = operation.requestBody.content[contentType];
      
      if (!mediaType) {
        warnings.push(`Content type ${contentType} not defined in operation`);
      } else if (mediaType.schema) {
        const bodyValidation = this.validateJsonSchema(request.body, mediaType.schema);
        errors.push(...bodyValidation.errors.map(e => `Request body: ${e}`));
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateResponseAgainstOperation(
    response: PactResponse,
    operation: OperationObject,
    spec: OpenAPISpec
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const statusCode = response.status.toString();
    const responseSpec = operation.responses[statusCode] || operation.responses['default'];

    if (!responseSpec) {
      errors.push(`Response status ${statusCode} not defined in operation`);
      return { isValid: false, errors, warnings };
    }

    // Validate response headers
    if (responseSpec.headers && response.headers) {
      Object.entries(responseSpec.headers).forEach(([headerName, headerSpec]) => {
        const headerValue = this.findHeaderValue(response.headers!, headerName);
        if (headerSpec.required && !headerValue) {
          errors.push(`Required response header '${headerName}' is missing`);
        }
        if (headerValue && headerSpec.schema) {
          const headerValidation = this.validateJsonSchema(headerValue, headerSpec.schema);
          errors.push(...headerValidation.errors.map(e => `Response header ${headerName}: ${e}`));
        }
      });
    }

    // Validate response body
    if (responseSpec.content && response.body) {
      const contentType = this.findHeaderValue(response.headers || {}, 'content-type') || 'application/json';
      const mediaType = responseSpec.content[contentType];
      
      if (!mediaType) {
        warnings.push(`Response content type ${contentType} not defined in operation`);
      } else if (mediaType.schema) {
        const bodyValidation = this.validateJsonSchema(response.body, mediaType.schema);
        errors.push(...bodyValidation.errors.map(e => `Response body: ${e}`));
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }
}