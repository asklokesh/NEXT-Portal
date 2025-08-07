import { PactContract, ContractTestResult, InteractionTestResult, ContractError, PactInteraction } from '../types';
import { ContractValidator } from '../core/contract-validator';
import { Logger } from 'winston';
import axios, { AxiosResponse, AxiosError } from 'axios';

export interface ProviderVerificationOptions {
  providerBaseUrl: string;
  providerVersion: string;
  stateSetupUrl?: string;
  stateCleanupUrl?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
  publishResults?: boolean;
  logLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  failFast?: boolean;
  parallelism?: number;
  beforeEach?: (interaction: PactInteraction) => Promise<void>;
  afterEach?: (interaction: PactInteraction) => Promise<void>;
  stateHandlers?: Record<string, (params?: any) => Promise<void>>;
}

export interface ProviderStateSetup {
  state: string;
  params?: Record<string, any>;
}

export interface VerificationContext {
  provider: string;
  consumer: string;
  interaction: PactInteraction;
  providerUrl: string;
  stateSetupUrl?: string;
  stateCleanupUrl?: string;
  headers: Record<string, string>;
}

export class ProviderVerifier {
  private logger: Logger;
  private validator: ContractValidator;

  constructor(logger: Logger) {
    this.logger = logger;
    this.validator = new ContractValidator(logger);
  }

  /**
   * Verify provider against Pact contracts
   */
  async verifyProvider(
    contracts: PactContract[],
    options: ProviderVerificationOptions
  ): Promise<ContractTestResult[]> {
    this.logger.info('Starting provider verification', {
      contractCount: contracts.length,
      providerBaseUrl: options.providerBaseUrl,
      providerVersion: options.providerVersion
    });

    const results: ContractTestResult[] = [];

    for (const contract of contracts) {
      const contractResult = await this.verifyContract(contract, options);
      results.push(contractResult);

      // Fail fast if enabled and test failed
      if (options.failFast && contractResult.status === 'failed') {
        this.logger.warn('Failing fast due to contract verification failure', {
          contract: `${contract.consumer.name} -> ${contract.provider.name}`
        });
        break;
      }
    }

    const totalResults = results.length;
    const passedResults = results.filter(r => r.status === 'passed').length;
    const failedResults = results.filter(r => r.status === 'failed').length;

    this.logger.info('Provider verification completed', {
      total: totalResults,
      passed: passedResults,
      failed: failedResults,
      passRate: totalResults > 0 ? (passedResults / totalResults) * 100 : 0
    });

    return results;
  }

  /**
   * Verify single contract
   */
  async verifyContract(
    contract: PactContract,
    options: ProviderVerificationOptions
  ): Promise<ContractTestResult> {
    const startTime = new Date();
    
    this.logger.info('Verifying contract', {
      consumer: contract.consumer.name,
      provider: contract.provider.name,
      interactionCount: contract.interactions.length
    });

    // Validate contract first
    const validation = this.validator.validateContract(contract);
    if (!validation.isValid) {
      return {
        contractId: `${contract.consumer.name}-${contract.provider.name}`,
        testSuite: `${contract.provider.name} verification`,
        status: 'failed',
        startTime,
        endTime: new Date(),
        duration: 0,
        interactions: [],
        errors: [{
          type: 'validation',
          message: `Contract validation failed: ${validation.errors.join(', ')}`
        }],
        summary: {
          totalInteractions: contract.interactions.length,
          passedInteractions: 0,
          failedInteractions: 0,
          skippedInteractions: contract.interactions.length,
          passRate: 0
        }
      };
    }

    const interactionResults: InteractionTestResult[] = [];
    const errors: ContractError[] = [];

    // Process interactions
    const interactions = options.parallelism && options.parallelism > 1
      ? await this.verifyInteractionsInParallel(contract.interactions, contract, options)
      : await this.verifyInteractionsSequentially(contract.interactions, contract, options);

    interactionResults.push(...interactions.results);
    errors.push(...interactions.errors);

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    const passedInteractions = interactionResults.filter(r => r.status === 'passed').length;
    const failedInteractions = interactionResults.filter(r => r.status === 'failed').length;
    const skippedInteractions = interactionResults.filter(r => r.status === 'skipped').length;

    const result: ContractTestResult = {
      contractId: `${contract.consumer.name}-${contract.provider.name}`,
      testSuite: `${contract.provider.name} verification`,
      status: errors.length > 0 || failedInteractions > 0 ? 'failed' : 'passed',
      startTime,
      endTime,
      duration,
      interactions: interactionResults,
      errors,
      summary: {
        totalInteractions: contract.interactions.length,
        passedInteractions,
        failedInteractions,
        skippedInteractions,
        passRate: contract.interactions.length > 0 
          ? (passedInteractions / contract.interactions.length) * 100 
          : 0
      }
    };

    this.logger.info('Contract verification completed', {
      consumer: contract.consumer.name,
      provider: contract.provider.name,
      status: result.status,
      passRate: result.summary.passRate,
      duration
    });

    return result;
  }

  /**
   * Setup provider state before interaction
   */
  async setupProviderState(
    states: ProviderStateSetup[],
    options: ProviderVerificationOptions
  ): Promise<void> {
    if (!states || states.length === 0) {
      return;
    }

    for (const stateSetup of states) {
      this.logger.debug('Setting up provider state', {
        state: stateSetup.state,
        params: stateSetup.params
      });

      try {
        // Use custom state handler if available
        if (options.stateHandlers?.[stateSetup.state]) {
          await options.stateHandlers[stateSetup.state](stateSetup.params);
          continue;
        }

        // Use HTTP state setup endpoint if available
        if (options.stateSetupUrl) {
          await this.callStateSetupEndpoint(
            options.stateSetupUrl,
            stateSetup,
            options
          );
        }
      } catch (error) {
        this.logger.error('Failed to setup provider state', {
          state: stateSetup.state,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw new Error(`Provider state setup failed: ${stateSetup.state}`);
      }
    }
  }

  /**
   * Cleanup provider state after interaction
   */
  async cleanupProviderState(
    states: ProviderStateSetup[],
    options: ProviderVerificationOptions
  ): Promise<void> {
    if (!states || states.length === 0 || !options.stateCleanupUrl) {
      return;
    }

    for (const stateSetup of states) {
      try {
        await this.callStateCleanupEndpoint(
          options.stateCleanupUrl,
          stateSetup,
          options
        );
      } catch (error) {
        this.logger.warn('Failed to cleanup provider state', {
          state: stateSetup.state,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        // Don't throw on cleanup failures
      }
    }
  }

  /**
   * Test single interaction against provider
   */
  async testInteraction(
    interaction: PactInteraction,
    context: VerificationContext,
    options: ProviderVerificationOptions
  ): Promise<InteractionTestResult> {
    const startTime = Date.now();
    
    this.logger.debug('Testing interaction', {
      description: interaction.description,
      method: interaction.request.method,
      path: interaction.request.path
    });

    const result: InteractionTestResult = {
      description: interaction.description,
      status: 'failed',
      request: interaction.request,
      expectedResponse: interaction.response,
      duration: 0
    };

    try {
      // Setup provider state if needed
      const states = interaction.providerStates?.map(state => ({
        state: state.name,
        params: state.params
      })) || [];

      await this.setupProviderState(states, options);

      // Execute beforeEach hook if provided
      if (options.beforeEach) {
        await options.beforeEach(interaction);
      }

      // Make the actual HTTP request
      const actualResponse = await this.makeProviderRequest(
        interaction.request,
        context,
        options
      );

      result.actualResponse = {
        status: actualResponse.status,
        headers: this.normalizeHeaders(actualResponse.headers),
        body: actualResponse.data
      };

      // Verify response
      const verificationResult = this.verifyResponse(
        interaction.response,
        result.actualResponse
      );

      result.status = verificationResult.isValid ? 'passed' : 'failed';
      if (!verificationResult.isValid) {
        result.error = verificationResult.errors.join('; ');
      }

      // Execute afterEach hook if provided
      if (options.afterEach) {
        await options.afterEach(interaction);
      }

      // Cleanup provider state
      await this.cleanupProviderState(states, options);

    } catch (error) {
      result.status = 'failed';
      result.error = error instanceof Error ? error.message : 'Unknown error';
      
      this.logger.error('Interaction test failed', {
        description: interaction.description,
        error: result.error
      });
    }

    result.duration = Date.now() - startTime;

    this.logger.debug('Interaction test completed', {
      description: interaction.description,
      status: result.status,
      duration: result.duration
    });

    return result;
  }

  private async verifyInteractionsSequentially(
    interactions: PactInteraction[],
    contract: PactContract,
    options: ProviderVerificationOptions
  ): Promise<{ results: InteractionTestResult[]; errors: ContractError[] }> {
    const results: InteractionTestResult[] = [];
    const errors: ContractError[] = [];

    const context: VerificationContext = {
      provider: contract.provider.name,
      consumer: contract.consumer.name,
      interaction: interactions[0], // Will be updated for each interaction
      providerUrl: options.providerBaseUrl,
      stateSetupUrl: options.stateSetupUrl,
      stateCleanupUrl: options.stateCleanupUrl,
      headers: options.headers || {}
    };

    for (const interaction of interactions) {
      context.interaction = interaction;
      
      try {
        const result = await this.testInteraction(interaction, context, options);
        results.push(result);
      } catch (error) {
        errors.push({
          type: 'network',
          message: `Interaction test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        });

        results.push({
          description: interaction.description,
          status: 'failed',
          request: interaction.request,
          expectedResponse: interaction.response,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: 0
        });
      }
    }

    return { results, errors };
  }

  private async verifyInteractionsInParallel(
    interactions: PactInteraction[],
    contract: PactContract,
    options: ProviderVerificationOptions
  ): Promise<{ results: InteractionTestResult[]; errors: ContractError[] }> {
    const errors: ContractError[] = [];
    const parallelism = Math.min(options.parallelism || 1, interactions.length);
    
    // Split interactions into batches
    const batches: PactInteraction[][] = [];
    for (let i = 0; i < interactions.length; i += parallelism) {
      batches.push(interactions.slice(i, i + parallelism));
    }

    const allResults: InteractionTestResult[] = [];

    // Process batches sequentially, but interactions within each batch in parallel
    for (const batch of batches) {
      const batchPromises = batch.map(interaction => {
        const context: VerificationContext = {
          provider: contract.provider.name,
          consumer: contract.consumer.name,
          interaction,
          providerUrl: options.providerBaseUrl,
          stateSetupUrl: options.stateSetupUrl,
          stateCleanupUrl: options.stateCleanupUrl,
          headers: options.headers || {}
        };

        return this.testInteraction(interaction, context, options)
          .catch(error => ({
            description: interaction.description,
            status: 'failed' as const,
            request: interaction.request,
            expectedResponse: interaction.response,
            error: error instanceof Error ? error.message : 'Unknown error',
            duration: 0
          }));
      });

      const batchResults = await Promise.all(batchPromises);
      allResults.push(...batchResults);
    }

    return { results: allResults, errors };
  }

  private async makeProviderRequest(
    request: any,
    context: VerificationContext,
    options: ProviderVerificationOptions
  ): Promise<AxiosResponse> {
    const url = `${context.providerUrl}${request.path}`;
    const headers = {
      ...context.headers,
      ...request.headers
    };

    const config = {
      method: request.method.toLowerCase(),
      url,
      headers,
      params: request.query,
      data: request.body,
      timeout: options.timeout || 30000,
      validateStatus: () => true // Don't throw on non-2xx status codes
    };

    let lastError: Error | null = null;
    const retries = options.retries || 0;
    const retryDelay = options.retryDelay || 1000;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await axios(config);
        
        if (attempt > 0) {
          this.logger.debug('Request succeeded after retry', {
            attempt,
            url,
            status: response.status
          });
        }

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt < retries) {
          this.logger.debug('Request failed, retrying', {
            attempt: attempt + 1,
            totalRetries: retries,
            url,
            error: lastError.message
          });
          
          await this.delay(retryDelay);
        }
      }
    }

    throw lastError || new Error('Request failed after all retries');
  }

  private async callStateSetupEndpoint(
    stateSetupUrl: string,
    stateSetup: ProviderStateSetup,
    options: ProviderVerificationOptions
  ): Promise<void> {
    const response = await axios.post(stateSetupUrl, {
      state: stateSetup.state,
      params: stateSetup.params || {}
    }, {
      headers: options.headers,
      timeout: options.timeout || 10000
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`State setup failed with status ${response.status}`);
    }
  }

  private async callStateCleanupEndpoint(
    stateCleanupUrl: string,
    stateSetup: ProviderStateSetup,
    options: ProviderVerificationOptions
  ): Promise<void> {
    await axios.delete(stateCleanupUrl, {
      data: {
        state: stateSetup.state,
        params: stateSetup.params || {}
      },
      headers: options.headers,
      timeout: options.timeout || 10000
    });
  }

  private verifyResponse(expectedResponse: any, actualResponse: any): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Verify status code
    if (expectedResponse.status !== actualResponse.status) {
      errors.push(
        `Status code mismatch: expected ${expectedResponse.status}, got ${actualResponse.status}`
      );
    }

    // Verify headers
    if (expectedResponse.headers) {
      Object.entries(expectedResponse.headers).forEach(([headerName, expectedValue]) => {
        const actualValue = this.findHeaderValue(actualResponse.headers, headerName);
        
        if (actualValue === null) {
          errors.push(`Missing header: ${headerName}`);
        } else if (this.normalizeHeaderValue(actualValue) !== this.normalizeHeaderValue(expectedValue)) {
          errors.push(
            `Header value mismatch for ${headerName}: expected ${expectedValue}, got ${actualValue}`
          );
        }
      });
    }

    // Verify body
    if (expectedResponse.body !== null && expectedResponse.body !== undefined) {
      const bodyVerification = this.verifyResponseBody(expectedResponse.body, actualResponse.body);
      if (!bodyVerification.isValid) {
        errors.push(...bodyVerification.errors);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private verifyResponseBody(expectedBody: any, actualBody: any): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    try {
      // Deep comparison of response bodies
      if (typeof expectedBody !== typeof actualBody) {
        errors.push(
          `Body type mismatch: expected ${typeof expectedBody}, got ${typeof actualBody}`
        );
        return { isValid: false, errors };
      }

      if (typeof expectedBody === 'object' && expectedBody !== null) {
        // For objects, check if actual body contains all expected properties
        const bodyErrors = this.compareObjects(expectedBody, actualBody, 'body');
        errors.push(...bodyErrors);
      } else if (expectedBody !== actualBody) {
        errors.push(`Body value mismatch: expected ${expectedBody}, got ${actualBody}`);
      }
    } catch (error) {
      errors.push(`Body comparison failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private compareObjects(expected: any, actual: any, path: string = ''): string[] {
    const errors: string[] = [];

    if (typeof expected !== 'object' || expected === null) {
      if (expected !== actual) {
        errors.push(`${path}: expected ${expected}, got ${actual}`);
      }
      return errors;
    }

    if (typeof actual !== 'object' || actual === null) {
      errors.push(`${path}: expected object, got ${typeof actual}`);
      return errors;
    }

    // Check all expected properties
    Object.entries(expected).forEach(([key, expectedValue]) => {
      const actualValue = actual[key];
      const currentPath = path ? `${path}.${key}` : key;

      if (!(key in actual)) {
        errors.push(`${currentPath}: property missing`);
      } else if (typeof expectedValue === 'object' && expectedValue !== null) {
        errors.push(...this.compareObjects(expectedValue, actualValue, currentPath));
      } else if (expectedValue !== actualValue) {
        errors.push(`${currentPath}: expected ${expectedValue}, got ${actualValue}`);
      }
    });

    return errors;
  }

  private normalizeHeaders(headers: any): Record<string, string> {
    const normalized: Record<string, string> = {};
    
    if (!headers) return normalized;

    Object.entries(headers).forEach(([key, value]) => {
      const normalizedKey = key.toLowerCase();
      normalized[normalizedKey] = Array.isArray(value) ? value[0] : String(value);
    });

    return normalized;
  }

  private findHeaderValue(headers: Record<string, string>, headerName: string): string | null {
    const normalizedName = headerName.toLowerCase();
    
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === normalizedName) {
        return value;
      }
    }
    
    return null;
  }

  private normalizeHeaderValue(value: any): string {
    if (Array.isArray(value)) {
      return value[0];
    }
    return String(value).trim();
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}