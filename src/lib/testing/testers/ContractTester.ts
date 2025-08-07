/**
 * Contract Tester
 * Advanced contract testing for API compatibility validation
 */

import { EventEmitter } from 'events';
import { TestSuite, TestResult } from '../TestingFramework';
import axios, { AxiosResponse } from 'axios';
import { OpenAPIV3 } from 'openapi-types';

export interface ContractTest {
  id: string;
  name: string;
  provider: string;
  consumer: string;
  version: string;
  specification: OpenAPIV3.Document | any;
  interactions: ContractInteraction[];
  config: ContractTestConfig;
}

export interface ContractInteraction {
  id: string;
  description: string;
  request: {
    method: string;
    path: string;
    headers?: Record<string, string>;
    query?: Record<string, any>;
    body?: any;
  };
  response: {
    status: number;
    headers?: Record<string, string>;
    body?: any;
    schema?: any;
  };
  state?: string;
}

export interface ContractTestConfig {
  providerBaseUrl: string;
  consumerVersion: string;
  providerVersion: string;
  verificationTimeout: number;
  schemaValidation: boolean;
  compatibilityMode: 'strict' | 'loose' | 'backward' | 'forward';
}

export interface ContractVerificationResult {
  interaction: ContractInteraction;
  status: 'passed' | 'failed';
  duration: number;
  actualResponse?: any;
  errors?: string[];
  schemaValidation?: {
    valid: boolean;
    errors?: string[];
  };
}

export class ContractTester extends EventEmitter {
  private contracts: Map<string, ContractTest> = new Map();
  
  constructor() {
    super();
  }

  /**
   * Execute contract tests for a test suite
   */
  public async execute(suite: TestSuite): Promise<TestResult> {
    this.emit('test:started', suite);
    const startTime = Date.now();

    try {
      const contractTest = this.loadContractTest(suite);
      const verificationResults = await this.verifyContract(contractTest);
      
      const duration = Date.now() - startTime;
      const result = this.createTestResult(suite, verificationResults, duration);
      
      this.emit('test:completed', suite, result);
      return result;
    } catch (error) {
      this.emit('test:error', suite, error);
      throw error;
    }
  }

  /**
   * Health check for the contract tester
   */
  public async healthCheck(): Promise<boolean> {
    try {
      // Check if we can validate a simple contract
      const simpleContract: ContractTest = {
        id: 'health-check',
        name: 'Health Check Contract',
        provider: 'test-provider',
        consumer: 'test-consumer',
        version: '1.0.0',
        specification: this.createHealthCheckSpec(),
        interactions: [{
          id: 'health-check-interaction',
          description: 'Health check endpoint',
          request: {
            method: 'GET',
            path: '/health'
          },
          response: {
            status: 200,
            body: { status: 'ok' }
          }
        }],
        config: {
          providerBaseUrl: 'http://localhost:3000',
          consumerVersion: '1.0.0',
          providerVersion: '1.0.0',
          verificationTimeout: 5000,
          schemaValidation: true,
          compatibilityMode: 'strict'
        }
      };

      const isValid = this.validateContractStructure(simpleContract);
      return isValid;
    } catch (error) {
      return false;
    }
  }

  /**
   * Register a contract for testing
   */
  public registerContract(contract: ContractTest): void {
    this.contracts.set(contract.id, contract);
    this.emit('contract:registered', contract);
  }

  /**
   * Generate contract from OpenAPI specification
   */
  public generateContractFromOpenAPI(spec: OpenAPIV3.Document, config: Partial<ContractTestConfig>): ContractTest {
    const interactions: ContractInteraction[] = [];
    
    Object.entries(spec.paths || {}).forEach(([path, pathItem]) => {
      Object.entries(pathItem || {}).forEach(([method, operation]) => {
        if (typeof operation !== 'object' || !operation) return;
        
        const interaction: ContractInteraction = {
          id: `${method.toUpperCase()}-${path.replace(/[^a-zA-Z0-9]/g, '_')}`,
          description: operation.summary || `${method.toUpperCase()} ${path}`,
          request: {
            method: method.toUpperCase(),
            path: path,
            headers: this.extractRequestHeaders(operation),
            query: this.extractQueryParameters(operation),
            body: this.extractRequestBody(operation)
          },
          response: this.extractResponseFromSpec(operation)
        };
        
        interactions.push(interaction);
      });
    });

    return {
      id: `contract-${spec.info.title?.toLowerCase().replace(/\s+/g, '-')}`,
      name: `Contract for ${spec.info.title}`,
      provider: spec.info.title || 'Unknown Provider',
      consumer: 'Generated Consumer',
      version: spec.info.version,
      specification: spec,
      interactions,
      config: {
        providerBaseUrl: 'http://localhost:3000',
        consumerVersion: '1.0.0',
        providerVersion: spec.info.version,
        verificationTimeout: 30000,
        schemaValidation: true,
        compatibilityMode: 'strict',
        ...config
      }
    };
  }

  private loadContractTest(suite: TestSuite): ContractTest {
    const contractTest = this.contracts.get(suite.id) || 
                        this.contracts.get(suite.config?.contractId) ||
                        this.createContractFromSuiteConfig(suite);
    
    if (!contractTest) {
      throw new Error(`No contract test found for suite: ${suite.id}`);
    }
    
    return contractTest;
  }

  private async verifyContract(contract: ContractTest): Promise<ContractVerificationResult[]> {
    const results: ContractVerificationResult[] = [];
    
    for (const interaction of contract.interactions) {
      this.emit('interaction:started', interaction);
      const result = await this.verifyInteraction(interaction, contract.config);
      results.push(result);
      this.emit('interaction:completed', interaction, result);
    }
    
    return results;
  }

  private async verifyInteraction(
    interaction: ContractInteraction, 
    config: ContractTestConfig
  ): Promise<ContractVerificationResult> {
    const startTime = Date.now();
    
    try {
      const actualResponse = await this.makeRequest(interaction, config);
      const isValid = this.validateResponse(interaction, actualResponse, config);
      
      return {
        interaction,
        status: isValid ? 'passed' : 'failed',
        duration: Date.now() - startTime,
        actualResponse: {
          status: actualResponse.status,
          headers: actualResponse.headers,
          data: actualResponse.data
        },
        errors: isValid ? [] : this.extractValidationErrors(interaction, actualResponse),
        schemaValidation: config.schemaValidation ? 
          this.validateResponseSchema(interaction, actualResponse) : undefined
      };
    } catch (error) {
      return {
        interaction,
        status: 'failed',
        duration: Date.now() - startTime,
        errors: [error.message]
      };
    }
  }

  private async makeRequest(interaction: ContractInteraction, config: ContractTestConfig): Promise<AxiosResponse> {
    const url = `${config.providerBaseUrl}${interaction.request.path}`;
    
    const requestConfig = {
      method: interaction.request.method.toLowerCase() as any,
      url,
      headers: interaction.request.headers,
      params: interaction.request.query,
      data: interaction.request.body,
      timeout: config.verificationTimeout,
      validateStatus: () => true // Accept all status codes for validation
    };

    return await axios(requestConfig);
  }

  private validateResponse(
    interaction: ContractInteraction, 
    actualResponse: AxiosResponse, 
    config: ContractTestConfig
  ): boolean {
    const expected = interaction.response;
    
    // Status code validation
    if (actualResponse.status !== expected.status) {
      return false;
    }
    
    // Headers validation
    if (expected.headers) {
      const actualHeaders = actualResponse.headers || {};
      for (const [key, value] of Object.entries(expected.headers)) {
        if (actualHeaders[key.toLowerCase()] !== value) {
          return false;
        }
      }
    }
    
    // Body validation based on compatibility mode
    if (expected.body !== undefined) {
      return this.validateResponseBody(expected.body, actualResponse.data, config.compatibilityMode);
    }
    
    return true;
  }

  private validateResponseBody(expected: any, actual: any, mode: string): boolean {
    switch (mode) {
      case 'strict':
        return JSON.stringify(expected) === JSON.stringify(actual);
      
      case 'loose':
        return this.validateLoose(expected, actual);
      
      case 'backward':
        return this.validateBackwardCompatibility(expected, actual);
      
      case 'forward':
        return this.validateForwardCompatibility(expected, actual);
      
      default:
        return this.validateLoose(expected, actual);
    }
  }

  private validateLoose(expected: any, actual: any): boolean {
    if (typeof expected !== typeof actual) return false;
    if (expected === null || actual === null) return expected === actual;
    if (typeof expected !== 'object') return expected === actual;
    if (Array.isArray(expected) !== Array.isArray(actual)) return false;
    
    if (Array.isArray(expected)) {
      return expected.length === actual.length &&
             expected.every((item, index) => this.validateLoose(item, actual[index]));
    }
    
    // Object validation - check if all expected properties exist
    for (const key in expected) {
      if (!this.validateLoose(expected[key], actual[key])) {
        return false;
      }
    }
    
    return true;
  }

  private validateBackwardCompatibility(expected: any, actual: any): boolean {
    // In backward compatibility, actual can have more fields than expected
    if (typeof expected !== typeof actual) return false;
    if (expected === null || actual === null) return expected === actual;
    if (typeof expected !== 'object') return expected === actual;
    if (Array.isArray(expected) !== Array.isArray(actual)) return false;
    
    if (Array.isArray(expected)) {
      return expected.every((item, index) => 
        index < actual.length && this.validateBackwardCompatibility(item, actual[index])
      );
    }
    
    // Object validation - all expected properties must exist in actual
    for (const key in expected) {
      if (!(key in actual) || !this.validateBackwardCompatibility(expected[key], actual[key])) {
        return false;
      }
    }
    
    return true;
  }

  private validateForwardCompatibility(expected: any, actual: any): boolean {
    // In forward compatibility, expected can have more fields than actual
    return this.validateBackwardCompatibility(actual, expected);
  }

  private validateResponseSchema(
    interaction: ContractInteraction, 
    actualResponse: AxiosResponse
  ): { valid: boolean; errors?: string[] } {
    if (!interaction.response.schema) {
      return { valid: true };
    }
    
    try {
      // Simple JSON schema validation (in production, use ajv or similar)
      const isValid = this.validateJsonSchema(actualResponse.data, interaction.response.schema);
      return { valid: isValid };
    } catch (error) {
      return { 
        valid: false, 
        errors: [error.message] 
      };
    }
  }

  private validateJsonSchema(data: any, schema: any): boolean {
    // Basic JSON schema validation
    // In production, use proper JSON schema validator like AJV
    if (schema.type) {
      const actualType = Array.isArray(data) ? 'array' : typeof data;
      if (actualType !== schema.type) return false;
    }
    
    if (schema.properties && typeof data === 'object' && data !== null) {
      for (const [prop, propSchema] of Object.entries(schema.properties)) {
        if (schema.required?.includes(prop) && !(prop in data)) {
          return false;
        }
        if (prop in data && !this.validateJsonSchema(data[prop], propSchema)) {
          return false;
        }
      }
    }
    
    return true;
  }

  private extractValidationErrors(interaction: ContractInteraction, actualResponse: AxiosResponse): string[] {
    const errors: string[] = [];
    const expected = interaction.response;
    
    if (actualResponse.status !== expected.status) {
      errors.push(`Status mismatch: expected ${expected.status}, got ${actualResponse.status}`);
    }
    
    if (expected.headers) {
      const actualHeaders = actualResponse.headers || {};
      for (const [key, value] of Object.entries(expected.headers)) {
        if (actualHeaders[key.toLowerCase()] !== value) {
          errors.push(`Header mismatch for ${key}: expected ${value}, got ${actualHeaders[key.toLowerCase()]}`);
        }
      }
    }
    
    if (expected.body !== undefined) {
      errors.push('Response body validation failed');
    }
    
    return errors;
  }

  private createTestResult(
    suite: TestSuite, 
    verificationResults: ContractVerificationResult[], 
    duration: number
  ): TestResult {
    const failed = verificationResults.filter(r => r.status === 'failed');
    const passed = verificationResults.filter(r => r.status === 'passed');
    
    return {
      suiteId: suite.id,
      status: failed.length > 0 ? 'failed' : 'passed',
      duration,
      errors: failed.flatMap(r => (r.errors || []).map(error => ({
        message: error,
        type: 'ContractValidationError'
      }))),
      metrics: {
        executionTime: duration,
        memoryUsage: 0,
        cpuUsage: 0,
        networkCalls: verificationResults.length,
        databaseQueries: 0,
        cacheHits: 0,
        cacheMisses: 0
      },
      timestamp: new Date(),
      artifacts: this.generateArtifacts(verificationResults)
    };
  }

  private generateArtifacts(results: ContractVerificationResult[]): string[] {
    const artifacts: string[] = [];
    
    // Generate contract verification report
    const report = {
      summary: {
        total: results.length,
        passed: results.filter(r => r.status === 'passed').length,
        failed: results.filter(r => r.status === 'failed').length
      },
      interactions: results.map(r => ({
        id: r.interaction.id,
        description: r.interaction.description,
        status: r.status,
        duration: r.duration,
        errors: r.errors
      }))
    };
    
    artifacts.push(`contract-verification-report-${Date.now()}.json`);
    
    return artifacts;
  }

  private createContractFromSuiteConfig(suite: TestSuite): ContractTest | null {
    if (!suite.config?.contract) return null;
    
    const contractConfig = suite.config.contract;
    
    return {
      id: suite.id,
      name: suite.name,
      provider: contractConfig.provider || 'Unknown Provider',
      consumer: contractConfig.consumer || 'Unknown Consumer',
      version: contractConfig.version || '1.0.0',
      specification: contractConfig.specification,
      interactions: contractConfig.interactions || [],
      config: {
        providerBaseUrl: contractConfig.providerBaseUrl || 'http://localhost:3000',
        consumerVersion: contractConfig.consumerVersion || '1.0.0',
        providerVersion: contractConfig.providerVersion || '1.0.0',
        verificationTimeout: contractConfig.timeout || 30000,
        schemaValidation: contractConfig.schemaValidation !== false,
        compatibilityMode: contractConfig.compatibilityMode || 'strict'
      }
    };
  }

  private validateContractStructure(contract: ContractTest): boolean {
    return !!(
      contract.id &&
      contract.name &&
      contract.provider &&
      contract.consumer &&
      contract.version &&
      contract.interactions &&
      Array.isArray(contract.interactions) &&
      contract.config &&
      contract.config.providerBaseUrl
    );
  }

  private createHealthCheckSpec(): OpenAPIV3.Document {
    return {
      openapi: '3.0.0',
      info: {
        title: 'Health Check API',
        version: '1.0.0'
      },
      paths: {
        '/health': {
          get: {
            summary: 'Health check endpoint',
            responses: {
              '200': {
                description: 'Service is healthy',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        status: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    };
  }

  private extractRequestHeaders(operation: any): Record<string, string> | undefined {
    const parameters = operation.parameters || [];
    const headerParams = parameters.filter((p: any) => p.in === 'header');
    
    if (headerParams.length === 0) return undefined;
    
    const headers: Record<string, string> = {};
    headerParams.forEach((param: any) => {
      headers[param.name] = param.example || 'test-value';
    });
    
    return headers;
  }

  private extractQueryParameters(operation: any): Record<string, any> | undefined {
    const parameters = operation.parameters || [];
    const queryParams = parameters.filter((p: any) => p.in === 'query');
    
    if (queryParams.length === 0) return undefined;
    
    const query: Record<string, any> = {};
    queryParams.forEach((param: any) => {
      query[param.name] = param.example || this.generateExampleValue(param.schema?.type);
    });
    
    return query;
  }

  private extractRequestBody(operation: any): any {
    if (!operation.requestBody?.content) return undefined;
    
    const content = operation.requestBody.content;
    const jsonContent = content['application/json'];
    
    if (!jsonContent?.schema) return undefined;
    
    return this.generateExampleFromSchema(jsonContent.schema);
  }

  private extractResponseFromSpec(operation: any): ContractInteraction['response'] {
    const responses = operation.responses || {};
    const successResponse = responses['200'] || responses['201'] || responses['204'];
    
    if (!successResponse) {
      return { status: 200 };
    }
    
    const status = parseInt(Object.keys(responses)[0]);
    const content = successResponse.content?.['application/json'];
    
    return {
      status,
      body: content?.schema ? this.generateExampleFromSchema(content.schema) : undefined,
      schema: content?.schema
    };
  }

  private generateExampleValue(type?: string): any {
    switch (type) {
      case 'string': return 'test-string';
      case 'number': return 42;
      case 'integer': return 42;
      case 'boolean': return true;
      case 'array': return [];
      case 'object': return {};
      default: return 'test-value';
    }
  }

  private generateExampleFromSchema(schema: any): any {
    if (schema.example) return schema.example;
    
    switch (schema.type) {
      case 'object':
        const obj: any = {};
        if (schema.properties) {
          Object.entries(schema.properties).forEach(([key, propSchema]: [string, any]) => {
            obj[key] = this.generateExampleFromSchema(propSchema);
          });
        }
        return obj;
      
      case 'array':
        return schema.items ? [this.generateExampleFromSchema(schema.items)] : [];
      
      default:
        return this.generateExampleValue(schema.type);
    }
  }
}

export default ContractTester;