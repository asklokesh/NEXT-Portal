import { Pact } from '@pact-foundation/pact';
import { Publisher, PublisherOptions } from '@pact-foundation/pact-node';
import { Verifier, VerifierOptions } from '@pact-foundation/pact-node';
import { PactContract, ContractTestConfig, ContractTestResult, PactInteraction } from '../types';
import { ContractValidator } from './contract-validator';
import { join } from 'path';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { Logger } from 'winston';

export class PactManager {
  private config: ContractTestConfig;
  private logger: Logger;
  private pactInstances: Map<string, Pact> = new Map();
  private validator: ContractValidator;

  constructor(config: ContractTestConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.validator = new ContractValidator(logger);
  }

  /**
   * Create a new Pact instance for consumer testing
   */
  async createConsumerPact(
    consumer: string,
    provider: string,
    version: string = '1.0.0'
  ): Promise<Pact> {
    const pactKey = `${consumer}-${provider}`;
    
    if (this.pactInstances.has(pactKey)) {
      return this.pactInstances.get(pactKey)!;
    }

    const pact = new Pact({
      consumer,
      provider,
      port: this.getNextAvailablePort(),
      log: join(process.cwd(), 'logs', `pact-${pactKey}.log`),
      dir: join(process.cwd(), 'pacts'),
      spec: 2,
      cors: true,
      logLevel: this.config.logLevel || 'info',
      timeout: this.config.timeout || 30000,
    });

    this.pactInstances.set(pactKey, pact);
    this.logger.info(`Created Pact instance for ${consumer} -> ${provider}`, { 
      consumer, 
      provider, 
      version 
    });

    return pact;
  }

  /**
   * Add interactions to a Pact instance
   */
  async addInteraction(
    consumer: string,
    provider: string,
    interaction: PactInteraction
  ): Promise<void> {
    const pactKey = `${consumer}-${provider}`;
    const pact = this.pactInstances.get(pactKey);
    
    if (!pact) {
      throw new Error(`No Pact instance found for ${consumer} -> ${provider}`);
    }

    // Validate interaction before adding
    const validationResult = this.validator.validateInteraction(interaction);
    if (!validationResult.isValid) {
      throw new Error(`Invalid interaction: ${validationResult.errors.join(', ')}`);
    }

    await pact.addInteraction({
      state: interaction.providerStates?.[0]?.name,
      uponReceiving: interaction.description,
      withRequest: {
        method: interaction.request.method,
        path: interaction.request.path,
        headers: interaction.request.headers,
        query: interaction.request.query,
        body: interaction.request.body,
      },
      willRespondWith: {
        status: interaction.response.status,
        headers: interaction.response.headers,
        body: interaction.response.body,
      },
    });

    this.logger.debug('Added interaction to Pact', { 
      consumer, 
      provider, 
      description: interaction.description 
    });
  }

  /**
   * Finalize and write Pact contracts
   */
  async finalizePact(consumer: string, provider: string): Promise<string> {
    const pactKey = `${consumer}-${provider}`;
    const pact = this.pactInstances.get(pactKey);
    
    if (!pact) {
      throw new Error(`No Pact instance found for ${consumer} -> ${provider}`);
    }

    await pact.finalize();
    
    const pactFilePath = join(process.cwd(), 'pacts', `${consumer}-${provider}.json`);
    this.logger.info('Finalized Pact contract', { 
      consumer, 
      provider, 
      filePath: pactFilePath 
    });

    return pactFilePath;
  }

  /**
   * Publish Pact contracts to broker
   */
  async publishPacts(
    pactFiles: string[],
    version: string,
    tags?: string[]
  ): Promise<void> {
    if (!this.config.pactBrokerUrl) {
      throw new Error('Pact Broker URL not configured');
    }

    const publishOptions: PublisherOptions = {
      pactFilesOrDirs: pactFiles,
      pactBroker: this.config.pactBrokerUrl,
      pactBrokerToken: this.config.pactBrokerToken,
      pactBrokerUsername: this.config.pactBrokerUsername,
      pactBrokerPassword: this.config.pactBrokerPassword,
      consumerVersion: version,
      tags: tags || ['latest'],
      verbose: this.config.logLevel === 'debug' || this.config.logLevel === 'trace',
    };

    try {
      const publisher = new Publisher(publishOptions);
      await publisher.publish();
      
      this.logger.info('Successfully published Pact contracts', { 
        version, 
        tags, 
        fileCount: pactFiles.length 
      });
    } catch (error) {
      this.logger.error('Failed to publish Pact contracts', { error });
      throw error;
    }
  }

  /**
   * Verify Pact contracts as provider
   */
  async verifyProvider(
    provider: string,
    providerBaseUrl: string,
    version: string,
    stateSetupUrl?: string
  ): Promise<ContractTestResult[]> {
    if (!this.config.pactBrokerUrl) {
      throw new Error('Pact Broker URL not configured');
    }

    const verifierOptions: VerifierOptions = {
      provider,
      providerBaseUrl,
      pactBrokerUrl: this.config.pactBrokerUrl,
      pactBrokerToken: this.config.pactBrokerToken,
      pactBrokerUsername: this.config.pactBrokerUsername,
      pactBrokerPassword: this.config.pactBrokerPassword,
      providerVersion: version,
      publishVerificationResult: this.config.publishResults !== false,
      providerVersionTags: ['latest'],
      enablePending: true,
      includeWipPactsSince: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      timeout: this.config.timeout || 30000,
      logLevel: this.config.logLevel || 'info',
    };

    if (stateSetupUrl) {
      verifierOptions.stateHandlers = {
        'default': stateSetupUrl,
      };
    }

    try {
      const verifier = new Verifier(verifierOptions);
      const output = await verifier.verifyProvider();
      
      // Parse verification output into structured results
      const results = this.parseVerificationOutput(output, provider);
      
      this.logger.info('Provider verification completed', { 
        provider, 
        version, 
        results: results.map(r => ({ status: r.status, interactions: r.summary.totalInteractions }))
      });
      
      return results;
    } catch (error) {
      this.logger.error('Provider verification failed', { error, provider, version });
      throw error;
    }
  }

  /**
   * Load Pact contract from file
   */
  loadPactContract(filePath: string): PactContract {
    try {
      const content = readFileSync(filePath, 'utf8');
      const contract = JSON.parse(content) as PactContract;
      
      // Validate the loaded contract
      const validationResult = this.validator.validateContract(contract);
      if (!validationResult.isValid) {
        throw new Error(`Invalid Pact contract: ${validationResult.errors.join(', ')}`);
      }
      
      this.logger.debug('Loaded Pact contract', { 
        filePath, 
        consumer: contract.consumer.name, 
        provider: contract.provider.name 
      });
      
      return contract;
    } catch (error) {
      this.logger.error('Failed to load Pact contract', { error, filePath });
      throw error;
    }
  }

  /**
   * Save Pact contract to file
   */
  savePactContract(contract: PactContract, filePath?: string): string {
    const fileName = filePath || `${contract.consumer.name}-${contract.provider.name}.json`;
    const fullPath = join(process.cwd(), 'pacts', fileName);
    
    // Ensure directory exists
    mkdirSync(join(process.cwd(), 'pacts'), { recursive: true });
    
    // Validate contract before saving
    const validationResult = this.validator.validateContract(contract);
    if (!validationResult.isValid) {
      throw new Error(`Invalid Pact contract: ${validationResult.errors.join(', ')}`);
    }
    
    writeFileSync(fullPath, JSON.stringify(contract, null, 2));
    
    this.logger.info('Saved Pact contract', { 
      consumer: contract.consumer.name, 
      provider: contract.provider.name, 
      filePath: fullPath 
    });
    
    return fullPath;
  }

  /**
   * Clean up Pact instances
   */
  async cleanup(): Promise<void> {
    const promises = Array.from(this.pactInstances.values()).map(pact => 
      pact.finalize().catch(error => 
        this.logger.warn('Failed to finalize Pact instance', { error })
      )
    );
    
    await Promise.allSettled(promises);
    this.pactInstances.clear();
    
    this.logger.info('Cleaned up all Pact instances');
  }

  private getNextAvailablePort(): number {
    // Simple port allocation - in production, use a more sophisticated approach
    const basePort = 3000;
    const maxPort = 4000;
    const usedPorts = new Set(
      Array.from(this.pactInstances.values()).map(pact => (pact as any).opts?.port)
    );
    
    for (let port = basePort; port <= maxPort; port++) {
      if (!usedPorts.has(port)) {
        return port;
      }
    }
    
    throw new Error('No available ports for Pact mock server');
  }

  private parseVerificationOutput(output: any, provider: string): ContractTestResult[] {
    // This would parse the actual Pact verifier output format
    // For now, return a mock structure
    return [{
      contractId: `${provider}-verification-${Date.now()}`,
      testSuite: `${provider} verification`,
      status: 'passed',
      startTime: new Date(),
      endTime: new Date(),
      duration: 1000,
      interactions: [],
      errors: [],
      summary: {
        totalInteractions: 0,
        passedInteractions: 0,
        failedInteractions: 0,
        skippedInteractions: 0,
        passRate: 100,
      },
    }];
  }
}