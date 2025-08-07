import { PactContract, PactInteraction, OpenAPISpec } from '../types';
import { Logger } from 'winston';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface TestGenerationOptions {
  outputDir: string;
  testFramework: 'jest' | 'mocha' | 'vitest';
  language: 'typescript' | 'javascript';
  includeSetup?: boolean;
  includeTeardown?: boolean;
  generateMocks?: boolean;
  mockFramework?: 'msw' | 'nock' | 'sinon';
  includeExamples?: boolean;
  groupByProvider?: boolean;
  asyncTestGeneration?: boolean;
}

export interface GeneratedTest {
  fileName: string;
  filePath: string;
  content: string;
  testCount: number;
  framework: string;
}

export class ConsumerTestGenerator {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Generate consumer tests from Pact contracts
   */
  async generateTestsFromContracts(
    contracts: PactContract[],
    options: TestGenerationOptions
  ): Promise<GeneratedTest[]> {
    this.logger.info('Generating consumer tests from contracts', {
      contractCount: contracts.length,
      framework: options.testFramework,
      language: options.language
    });

    // Ensure output directory exists
    mkdirSync(options.outputDir, { recursive: true });

    const generatedTests: GeneratedTest[] = [];

    if (options.groupByProvider) {
      // Group contracts by provider
      const contractsByProvider = this.groupContractsByProvider(contracts);
      
      for (const [providerName, providerContracts] of contractsByProvider.entries()) {
        const test = await this.generateProviderTestSuite(
          providerName,
          providerContracts,
          options
        );
        generatedTests.push(test);
      }
    } else {
      // Generate separate test file for each contract
      for (const contract of contracts) {
        const test = await this.generateContractTest(contract, options);
        generatedTests.push(test);
      }
    }

    // Generate setup/utility files if requested
    if (options.includeSetup) {
      const setupFile = this.generateSetupFile(options);
      generatedTests.push(setupFile);
    }

    if (options.generateMocks) {
      const mockFiles = await this.generateMockFiles(contracts, options);
      generatedTests.push(...mockFiles);
    }

    this.logger.info('Consumer test generation completed', {
      totalFiles: generatedTests.length,
      totalTests: generatedTests.reduce((sum, test) => sum + test.testCount, 0)
    });

    return generatedTests;
  }

  /**
   * Generate tests from OpenAPI specification
   */
  async generateTestsFromOpenAPI(
    spec: OpenAPISpec,
    consumerName: string,
    options: TestGenerationOptions
  ): Promise<GeneratedTest[]> {
    this.logger.info('Generating consumer tests from OpenAPI spec', {
      title: spec.info.title,
      version: spec.info.version,
      pathCount: Object.keys(spec.paths).length
    });

    // Convert OpenAPI to Pact-like structure for test generation
    const contract = this.convertOpenAPIToPactContract(spec, consumerName);
    
    return this.generateTestsFromContracts([contract], options);
  }

  private async generateProviderTestSuite(
    providerName: string,
    contracts: PactContract[],
    options: TestGenerationOptions
  ): Promise<GeneratedTest> {
    const fileName = `${this.sanitizeFileName(providerName)}.contract.${options.language === 'typescript' ? 'ts' : 'js'}`;
    const filePath = join(options.outputDir, fileName);

    const imports = this.generateImports(options);
    const setupCode = this.generateTestSetup(providerName, options);
    const testSuites = contracts.map(contract => 
      this.generateContractTestSuite(contract, options)
    ).join('\n\n');
    const teardownCode = options.includeTeardown ? this.generateTeardown(options) : '';

    const content = [
      imports,
      setupCode,
      testSuites,
      teardownCode
    ].filter(Boolean).join('\n\n');

    writeFileSync(filePath, content, 'utf8');

    const totalTestCount = contracts.reduce(
      (sum, contract) => sum + contract.interactions.length, 
      0
    );

    this.logger.debug('Generated provider test suite', {
      provider: providerName,
      fileName,
      testCount: totalTestCount
    });

    return {
      fileName,
      filePath,
      content,
      testCount: totalTestCount,
      framework: options.testFramework
    };
  }

  private async generateContractTest(
    contract: PactContract,
    options: TestGenerationOptions
  ): Promise<GeneratedTest> {
    const fileName = `${this.sanitizeFileName(contract.consumer.name)}-${this.sanitizeFileName(contract.provider.name)}.contract.${options.language === 'typescript' ? 'ts' : 'js'}`;
    const filePath = join(options.outputDir, fileName);

    const imports = this.generateImports(options);
    const setupCode = this.generateTestSetup(contract.provider.name, options);
    const testSuite = this.generateContractTestSuite(contract, options);
    const teardownCode = options.includeTeardown ? this.generateTeardown(options) : '';

    const content = [
      imports,
      setupCode,
      testSuite,
      teardownCode
    ].filter(Boolean).join('\n\n');

    writeFileSync(filePath, content, 'utf8');

    this.logger.debug('Generated contract test', {
      consumer: contract.consumer.name,
      provider: contract.provider.name,
      fileName,
      testCount: contract.interactions.length
    });

    return {
      fileName,
      filePath,
      content,
      testCount: contract.interactions.length,
      framework: options.testFramework
    };
  }

  private generateImports(options: TestGenerationOptions): string {
    const imports: string[] = [];

    // Test framework imports
    switch (options.testFramework) {
      case 'jest':
        imports.push("import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';");
        break;
      case 'vitest':
        imports.push("import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';");
        break;
      case 'mocha':
        imports.push("import { describe, it, beforeAll, afterAll, beforeEach, afterEach } from 'mocha';");
        imports.push("import { expect } from 'chai';");
        break;
    }

    // HTTP client imports
    imports.push("import axios from 'axios';");

    // Mock framework imports
    if (options.generateMocks) {
      switch (options.mockFramework) {
        case 'msw':
          imports.push("import { rest } from 'msw';");
          imports.push("import { setupServer } from 'msw/node';");
          break;
        case 'nock':
          imports.push("import nock from 'nock';");
          break;
        case 'sinon':
          imports.push("import sinon from 'sinon';");
          break;
      }
    }

    // Pact imports
    imports.push("import { Pact } from '@pact-foundation/pact';");

    return imports.join('\n');
  }

  private generateTestSetup(providerName: string, options: TestGenerationOptions): string {
    const lines: string[] = [];

    // Mock server setup
    if (options.generateMocks) {
      switch (options.mockFramework) {
        case 'msw':
          lines.push('const server = setupServer();');
          lines.push('');
          lines.push('beforeAll(() => server.listen());');
          lines.push('afterEach(() => server.resetHandlers());');
          lines.push('afterAll(() => server.close());');
          break;
        case 'nock':
          lines.push('let nockScope: nock.Scope;');
          lines.push('');
          lines.push('beforeEach(() => {');
          lines.push('  nockScope = nock("http://localhost:3001");');
          lines.push('});');
          lines.push('');
          lines.push('afterEach(() => {');
          lines.push('  nock.cleanAll();');
          lines.push('});');
          break;
      }
    }

    // Pact setup
    lines.push(`const pact = new Pact({`);
    lines.push(`  consumer: process.env.CONSUMER_NAME || 'test-consumer',`);
    lines.push(`  provider: '${providerName}',`);
    lines.push(`  port: 3001,`);
    lines.push(`  log: './pact.log',`);
    lines.push(`  dir: './pacts',`);
    lines.push(`  logLevel: 'info'`);
    lines.push(`});`);
    lines.push('');
    lines.push('beforeAll(async () => {');
    lines.push('  await pact.setup();');
    lines.push('});');
    lines.push('');
    lines.push('afterEach(async () => {');
    lines.push('  await pact.verify();');
    lines.push('});');
    lines.push('');
    lines.push('afterAll(async () => {');
    lines.push('  await pact.finalize();');
    lines.push('});');

    return lines.join('\n');
  }

  private generateContractTestSuite(contract: PactContract, options: TestGenerationOptions): string {
    const lines: string[] = [];

    lines.push(`describe('${contract.consumer.name} -> ${contract.provider.name} Contract', () => {`);

    contract.interactions.forEach(interaction => {
      const testCode = this.generateInteractionTest(interaction, options);
      lines.push(this.indent(testCode, 2));
      lines.push('');
    });

    lines.push('});');

    return lines.join('\n');
  }

  private generateInteractionTest(interaction: PactInteraction, options: TestGenerationOptions): string {
    const lines: string[] = [];

    const testFunction = options.asyncTestGeneration ? 'it' : 'it';
    lines.push(`${testFunction}('${interaction.description}', async () => {`);

    // Add provider state setup if needed
    if (interaction.providerStates && interaction.providerStates.length > 0) {
      lines.push('  // Setup provider state');
      interaction.providerStates.forEach(state => {
        lines.push(`  // State: ${state.name}`);
        if (state.params) {
          lines.push(`  // Params: ${JSON.stringify(state.params, null, 2)}`);
        }
      });
      lines.push('');
    }

    // Add interaction to Pact
    lines.push('  // Setup interaction');
    lines.push('  await pact.addInteraction({');
    
    if (interaction.providerStates && interaction.providerStates.length > 0) {
      lines.push(`    state: '${interaction.providerStates[0].name}',`);
    }
    
    lines.push(`    uponReceiving: '${interaction.description}',`);
    lines.push('    withRequest: {');
    lines.push(`      method: '${interaction.request.method}',`);
    lines.push(`      path: '${interaction.request.path}',`);
    
    if (interaction.request.headers) {
      lines.push(`      headers: ${JSON.stringify(interaction.request.headers, null, 6)},`);
    }
    
    if (interaction.request.query) {
      lines.push(`      query: ${JSON.stringify(interaction.request.query, null, 6)},`);
    }
    
    if (interaction.request.body) {
      lines.push(`      body: ${JSON.stringify(interaction.request.body, null, 6)},`);
    }
    
    lines.push('    },');
    lines.push('    willRespondWith: {');
    lines.push(`      status: ${interaction.response.status},`);
    
    if (interaction.response.headers) {
      lines.push(`      headers: ${JSON.stringify(interaction.response.headers, null, 6)},`);
    }
    
    if (interaction.response.body) {
      lines.push(`      body: ${JSON.stringify(interaction.response.body, null, 6)},`);
    }
    
    lines.push('    }');
    lines.push('  });');
    lines.push('');

    // Generate actual HTTP request
    lines.push('  // Make actual request');
    const requestConfig = this.generateRequestConfig(interaction);
    lines.push(`  const response = await axios(${requestConfig});`);
    lines.push('');

    // Generate assertions
    const assertions = this.generateAssertions(interaction, options);
    lines.push(assertions);

    lines.push('});');

    return lines.join('\n');
  }

  private generateRequestConfig(interaction: PactInteraction): string {
    const config: any = {
      method: interaction.request.method.toLowerCase(),
      url: `http://localhost:3001${interaction.request.path}`,
      validateStatus: () => true // Don't throw on non-2xx status codes
    };

    if (interaction.request.headers) {
      config.headers = interaction.request.headers;
    }

    if (interaction.request.query) {
      config.params = interaction.request.query;
    }

    if (interaction.request.body) {
      config.data = interaction.request.body;
    }

    return JSON.stringify(config, null, 2);
  }

  private generateAssertions(interaction: PactInteraction, options: TestGenerationOptions): string {
    const lines: string[] = [];

    lines.push('  // Verify response');
    lines.push(`  expect(response.status).toBe(${interaction.response.status});`);

    if (interaction.response.headers) {
      Object.entries(interaction.response.headers).forEach(([headerName, headerValue]) => {
        const normalizedHeaderName = headerName.toLowerCase();
        lines.push(`  expect(response.headers['${normalizedHeaderName}']).toBe('${headerValue}');`);
      });
    }

    if (interaction.response.body) {
      if (typeof interaction.response.body === 'object') {
        lines.push(`  expect(response.data).toMatchObject(${JSON.stringify(interaction.response.body, null, 2)});`);
      } else {
        lines.push(`  expect(response.data).toBe(${JSON.stringify(interaction.response.body)});`);
      }
    }

    return lines.join('\n');
  }

  private generateTeardown(options: TestGenerationOptions): string {
    const lines: string[] = [];

    if (options.generateMocks) {
      switch (options.mockFramework) {
        case 'nock':
          lines.push('// Ensure all nock interceptors were used');
          lines.push('afterEach(() => {');
          lines.push('  if (!nockScope.isDone()) {');
          lines.push("    console.warn('Not all nock interceptors were used');");
          lines.push('  }');
          lines.push('});');
          break;
      }
    }

    return lines.join('\n');
  }

  private generateSetupFile(options: TestGenerationOptions): GeneratedTest {
    const fileName = `setup.${options.language === 'typescript' ? 'ts' : 'js'}`;
    const filePath = join(options.outputDir, fileName);

    const lines: string[] = [];

    lines.push('// Test setup file');
    lines.push('// This file contains common setup and utilities for contract tests');
    lines.push('');

    // Environment setup
    lines.push('// Environment configuration');
    lines.push('process.env.NODE_ENV = "test";');
    lines.push('process.env.PACT_LOG_LEVEL = process.env.PACT_LOG_LEVEL || "info";');
    lines.push('');

    // Common utilities
    lines.push('// Common test utilities');
    lines.push('export const createTestHeaders = (overrides = {}) => ({');
    lines.push('  "Content-Type": "application/json",');
    lines.push('  "Accept": "application/json",');
    lines.push('  ...overrides');
    lines.push('});');
    lines.push('');

    lines.push('export const createAuthHeaders = (token: string) => ({');
    lines.push('  ...createTestHeaders(),');
    lines.push('  "Authorization": `Bearer ${token}`');
    lines.push('});');
    lines.push('');

    // Test data factories
    lines.push('// Test data factories');
    lines.push('export const createTestUser = (overrides = {}) => ({');
    lines.push('  id: 1,');
    lines.push('  name: "Test User",');
    lines.push('  email: "test@example.com",');
    lines.push('  ...overrides');
    lines.push('});');

    const content = lines.join('\n');
    writeFileSync(filePath, content, 'utf8');

    return {
      fileName,
      filePath,
      content,
      testCount: 0,
      framework: options.testFramework
    };
  }

  private async generateMockFiles(
    contracts: PactContract[],
    options: TestGenerationOptions
  ): Promise<GeneratedTest[]> {
    const mockFiles: GeneratedTest[] = [];

    if (options.mockFramework === 'msw') {
      // Generate MSW handlers
      const handlersFile = this.generateMSWHandlers(contracts, options);
      mockFiles.push(handlersFile);
    }

    return mockFiles;
  }

  private generateMSWHandlers(contracts: PactContract[], options: TestGenerationOptions): GeneratedTest {
    const fileName = `handlers.${options.language === 'typescript' ? 'ts' : 'js'}`;
    const filePath = join(options.outputDir, fileName);

    const lines: string[] = [];

    lines.push("import { rest } from 'msw';");
    lines.push('');
    lines.push('export const handlers = [');

    contracts.forEach(contract => {
      contract.interactions.forEach(interaction => {
        const handlerCode = this.generateMSWHandler(interaction);
        lines.push(this.indent(handlerCode, 2) + ',');
      });
    });

    lines.push('];');

    const content = lines.join('\n');
    writeFileSync(filePath, content, 'utf8');

    const totalHandlers = contracts.reduce(
      (sum, contract) => sum + contract.interactions.length, 
      0
    );

    return {
      fileName,
      filePath,
      content,
      testCount: totalHandlers,
      framework: 'msw'
    };
  }

  private generateMSWHandler(interaction: PactInteraction): string {
    const method = interaction.request.method.toLowerCase();
    const path = interaction.request.path;

    return `rest.${method}('${path}', (req, res, ctx) => {
  return res(
    ctx.status(${interaction.response.status}),
    ${interaction.response.headers ? `ctx.set(${JSON.stringify(interaction.response.headers)}),` : ''}
    ${interaction.response.body ? `ctx.json(${JSON.stringify(interaction.response.body)})` : 'ctx.body("")'}
  );
})`;
  }

  private convertOpenAPIToPactContract(spec: OpenAPISpec, consumerName: string): PactContract {
    const interactions: PactInteraction[] = [];

    Object.entries(spec.paths).forEach(([path, pathItem]) => {
      Object.entries(pathItem).forEach(([method, operation]: [string, any]) => {
        if (!operation || typeof operation !== 'object') return;

        const interaction: PactInteraction = {
          description: operation.summary || `${method.toUpperCase()} ${path}`,
          request: {
            method: method.toUpperCase(),
            path,
            headers: {},
            query: {}
          },
          response: {
            status: 200, // Default, would need to be determined from operation.responses
            headers: {},
            body: null
          }
        };

        // Add query parameters
        if (operation.parameters) {
          operation.parameters
            .filter((param: any) => param.in === 'query')
            .forEach((param: any) => {
              interaction.request.query![param.name] = param.example || 'example-value';
            });
        }

        // Add request body for applicable methods
        if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && operation.requestBody) {
          const jsonContent = operation.requestBody.content?.['application/json'];
          if (jsonContent?.example) {
            interaction.request.body = jsonContent.example;
          }
        }

        // Set response from first 2xx response
        const successResponse = Object.entries(operation.responses)
          .find(([status]) => status.startsWith('2'));
        
        if (successResponse) {
          const [status, responseObj] = successResponse as [string, any];
          interaction.response.status = parseInt(status);
          
          const jsonContent = responseObj.content?.['application/json'];
          if (jsonContent?.example) {
            interaction.response.body = jsonContent.example;
          }
        }

        interactions.push(interaction);
      });
    });

    return {
      consumer: {
        name: consumerName
      },
      provider: {
        name: spec.info.title
      },
      interactions,
      metadata: {
        pactSpecification: {
          version: '2.0.0'
        }
      }
    };
  }

  private groupContractsByProvider(contracts: PactContract[]): Map<string, PactContract[]> {
    const grouped = new Map<string, PactContract[]>();

    contracts.forEach(contract => {
      const providerName = contract.provider.name;
      if (!grouped.has(providerName)) {
        grouped.set(providerName, []);
      }
      grouped.get(providerName)!.push(contract);
    });

    return grouped;
  }

  private sanitizeFileName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private indent(text: string, spaces: number): string {
    const indentation = ' '.repeat(spaces);
    return text.split('\n').map(line => line ? indentation + line : line).join('\n');
  }
}