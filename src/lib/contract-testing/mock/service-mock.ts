import { PactContract, PactInteraction, MockService, MockServiceConfig } from '../types';
import { ContractValidator } from '../core/contract-validator';
import { Logger } from 'winston';
import express, { Express, Request, Response } from 'express';
import { Server } from 'http';
import cors from 'cors';
import { readFileSync } from 'fs';

export interface MockServiceState {
  [stateName: string]: {
    isActive: boolean;
    params?: Record<string, any>;
    setupAt?: Date;
  };
}

export interface MockInteractionMatch {
  interaction: PactInteraction;
  score: number;
  mismatches: string[];
}

export class ContractMockService implements MockService {
  private logger: Logger;
  private validator: ContractValidator;
  private app: Express;
  private server?: Server;
  private config: MockServiceConfig;
  private activeInteractions: PactInteraction[] = [];
  private providerStates: MockServiceState = {};
  private interactionHistory: {
    timestamp: Date;
    interaction: PactInteraction;
    request: any;
    response: any;
    matched: boolean;
  }[] = [];

  constructor(config: MockServiceConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.validator = new ContractValidator(logger);
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Start the mock service
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Load Pact files if configured
      if (this.config.pactFiles && this.config.pactFiles.length > 0) {
        this.loadPactFiles(this.config.pactFiles);
      }

      this.server = this.app.listen(this.config.port, this.config.host || 'localhost', () => {
        this.logger.info('Mock service started', {
          name: this.config.name,
          host: this.config.host || 'localhost',
          port: this.config.port,
          interactions: this.activeInteractions.length
        });
        resolve();
      });

      this.server.on('error', (error: Error) => {
        this.logger.error('Mock service failed to start', { error });
        reject(error);
      });
    });
  }

  /**
   * Stop the mock service
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.logger.info('Mock service stopped', { name: this.config.name });
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Reset mock service state
   */
  async reset(): Promise<void> {
    this.activeInteractions = [];
    this.providerStates = {};
    this.interactionHistory = [];
    
    this.logger.debug('Mock service reset', { name: this.config.name });
  }

  /**
   * Add interactions to mock service
   */
  async addInteractions(interactions: PactInteraction[]): Promise<void> {
    // Validate interactions before adding
    for (const interaction of interactions) {
      const validation = this.validator.validateInteraction(interaction);
      if (!validation.isValid) {
        throw new Error(`Invalid interaction: ${validation.errors.join(', ')}`);
      }
    }

    this.activeInteractions.push(...interactions);
    
    this.logger.debug('Added interactions to mock service', {
      name: this.config.name,
      count: interactions.length,
      total: this.activeInteractions.length
    });
  }

  /**
   * Verify that all interactions have been used
   */
  async verifyInteractions(): Promise<boolean> {
    const unusedInteractions = this.activeInteractions.filter(interaction => {
      return !this.interactionHistory.some(history => 
        this.interactionsMatch(history.interaction, interaction)
      );
    });

    if (unusedInteractions.length > 0) {
      this.logger.warn('Unused interactions found', {
        name: this.config.name,
        unusedCount: unusedInteractions.length,
        unused: unusedInteractions.map(i => i.description)
      });
      return false;
    }

    this.logger.debug('All interactions verified', {
      name: this.config.name,
      totalInteractions: this.activeInteractions.length
    });
    return true;
  }

  /**
   * Get mock service configuration
   */
  getConfig(): MockServiceConfig {
    return { ...this.config };
  }

  /**
   * Get interaction history
   */
  getInteractionHistory(): any[] {
    return [...this.interactionHistory];
  }

  /**
   * Get current provider states
   */
  getProviderStates(): MockServiceState {
    return { ...this.providerStates };
  }

  /**
   * Set provider state
   */
  async setProviderState(stateName: string, params?: Record<string, any>): Promise<void> {
    this.providerStates[stateName] = {
      isActive: true,
      params,
      setupAt: new Date()
    };

    this.logger.debug('Provider state set', {
      name: this.config.name,
      state: stateName,
      params
    });
  }

  /**
   * Clear provider state
   */
  async clearProviderState(stateName?: string): Promise<void> {
    if (stateName) {
      delete this.providerStates[stateName];
      this.logger.debug('Provider state cleared', {
        name: this.config.name,
        state: stateName
      });
    } else {
      this.providerStates = {};
      this.logger.debug('All provider states cleared', {
        name: this.config.name
      });
    }
  }

  private setupMiddleware(): void {
    // CORS support
    if (this.config.mockOptions?.cors !== false) {
      this.app.use(cors());
    }

    // JSON parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      this.logger.debug('Mock service request', {
        method: req.method,
        path: req.path,
        query: req.query,
        headers: req.headers
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Admin routes
    this.app.get('/_pact/interactions', (req, res) => {
      res.json({
        interactions: this.activeInteractions.length,
        history: this.interactionHistory.length,
        states: Object.keys(this.providerStates)
      });
    });

    this.app.post('/_pact/interactions', (req, res) => {
      const interactions = req.body.interactions || [req.body];
      this.addInteractions(interactions)
        .then(() => res.json({ message: 'Interactions added', count: interactions.length }))
        .catch(error => res.status(400).json({ error: error.message }));
    });

    this.app.delete('/_pact/interactions', (req, res) => {
      this.reset()
        .then(() => res.json({ message: 'Interactions reset' }))
        .catch(error => res.status(500).json({ error: error.message }));
    });

    this.app.post('/_pact/provider-states/:stateName', (req, res) => {
      const { stateName } = req.params;
      const { params } = req.body;
      
      this.setProviderState(stateName, params)
        .then(() => res.json({ message: 'Provider state set', state: stateName }))
        .catch(error => res.status(500).json({ error: error.message }));
    });

    this.app.delete('/_pact/provider-states/:stateName?', (req, res) => {
      const { stateName } = req.params;
      
      this.clearProviderState(stateName)
        .then(() => res.json({ message: 'Provider state cleared', state: stateName }))
        .catch(error => res.status(500).json({ error: error.message }));
    });

    this.app.get('/_pact/verification', (req, res) => {
      this.verifyInteractions()
        .then(verified => res.json({ verified, summary: this.getVerificationSummary() }))
        .catch(error => res.status(500).json({ error: error.message }));
    });

    // Catch-all route for mock responses
    this.app.all('*', (req, res) => this.handleMockRequest(req, res));
  }

  private async handleMockRequest(req: Request, res: Response): Promise<void> {
    try {
      const matchResult = this.findMatchingInteraction(req);
      
      if (!matchResult || matchResult.score < 0.8) {
        // No matching interaction found
        this.recordUnmatchedRequest(req, matchResult);
        
        const availableInteractions = this.activeInteractions.map(i => 
          `${i.request.method} ${i.request.path}`
        );
        
        res.status(404).json({
          error: 'No matching interaction found',
          request: {
            method: req.method,
            path: req.path,
            query: req.query,
            headers: req.headers
          },
          availableInteractions,
          suggestion: matchResult ? `Best match: ${matchResult.interaction.description} (score: ${matchResult.score})` : 'No similar interactions found'
        });
        return;
      }

      const { interaction } = matchResult;

      // Check provider states
      if (interaction.providerStates && interaction.providerStates.length > 0) {
        const stateValidation = this.validateProviderStates(interaction.providerStates);
        if (!stateValidation.isValid) {
          res.status(409).json({
            error: 'Provider state mismatch',
            required: interaction.providerStates,
            current: Object.keys(this.providerStates),
            details: stateValidation.errors
          });
          return;
        }
      }

      // Record successful match
      this.recordMatchedRequest(req, interaction);

      // Send mock response
      const mockResponse = interaction.response;
      
      // Set response status
      res.status(mockResponse.status);

      // Set response headers
      if (mockResponse.headers) {
        Object.entries(mockResponse.headers).forEach(([key, value]) => {
          res.set(key, Array.isArray(value) ? value[0] : value);
        });
      }

      // Send response body
      if (mockResponse.body !== undefined && mockResponse.body !== null) {
        if (typeof mockResponse.body === 'string') {
          res.send(mockResponse.body);
        } else {
          res.json(mockResponse.body);
        }
      } else {
        res.end();
      }

      this.logger.debug('Mock response sent', {
        interaction: interaction.description,
        status: mockResponse.status,
        responseTime: Date.now()
      });

    } catch (error) {
      this.logger.error('Mock request handling failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        method: req.method,
        path: req.path
      });

      res.status(500).json({
        error: 'Mock service internal error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private findMatchingInteraction(req: Request): MockInteractionMatch | null {
    let bestMatch: MockInteractionMatch | null = null;
    let bestScore = 0;

    for (const interaction of this.activeInteractions) {
      const match = this.scoreInteractionMatch(req, interaction);
      
      if (match.score > bestScore) {
        bestScore = match.score;
        bestMatch = match;
      }
    }

    return bestMatch;
  }

  private scoreInteractionMatch(req: Request, interaction: PactInteraction): MockInteractionMatch {
    let score = 0;
    const mismatches: string[] = [];
    const maxScore = 4; // method + path + headers + body

    // Method matching (required)
    if (req.method.toUpperCase() === interaction.request.method.toUpperCase()) {
      score += 1;
    } else {
      mismatches.push(`Method mismatch: expected ${interaction.request.method}, got ${req.method}`);
      return { interaction, score: 0, mismatches }; // Early exit for method mismatch
    }

    // Path matching (required)
    if (this.pathMatches(req.path, interaction.request.path)) {
      score += 1;
    } else {
      mismatches.push(`Path mismatch: expected ${interaction.request.path}, got ${req.path}`);
      return { interaction, score: 0, mismatches }; // Early exit for path mismatch
    }

    // Query parameter matching (partial)
    if (interaction.request.query) {
      const queryScore = this.scoreQueryMatch(req.query, interaction.request.query);
      score += queryScore * 0.5; // Reduced weight for query params
      if (queryScore < 0.8) {
        mismatches.push('Query parameter mismatch');
      }
    } else {
      score += 0.5; // Bonus for no required query params
    }

    // Header matching (partial)
    if (interaction.request.headers) {
      const headerScore = this.scoreHeaderMatch(req.headers, interaction.request.headers);
      score += headerScore * 0.5; // Reduced weight for headers
      if (headerScore < 0.8) {
        mismatches.push('Header mismatch');
      }
    } else {
      score += 0.5; // Bonus for no required headers
    }

    // Body matching (for POST/PUT/PATCH)
    if (interaction.request.body !== undefined) {
      const bodyScore = this.scoreBodyMatch(req.body, interaction.request.body);
      score += bodyScore * 1; // Full weight for body
      if (bodyScore < 0.8) {
        mismatches.push('Body mismatch');
      }
    } else if (!req.body || Object.keys(req.body).length === 0) {
      score += 1; // Bonus for no body when none expected
    }

    return {
      interaction,
      score: score / maxScore, // Normalize to 0-1
      mismatches
    };
  }

  private pathMatches(requestPath: string, interactionPath: string): boolean {
    // Exact match
    if (requestPath === interactionPath) {
      return true;
    }

    // Pattern matching for parameterized paths
    const pattern = interactionPath.replace(/\{[^}]+\}/g, '[^/]+');
    const regex = new RegExp(`^${pattern}$`);
    return regex.test(requestPath);
  }

  private scoreQueryMatch(requestQuery: any, interactionQuery: Record<string, any>): number {
    const interactionKeys = Object.keys(interactionQuery);
    if (interactionKeys.length === 0) return 1;

    let matches = 0;
    for (const key of interactionKeys) {
      if (requestQuery[key] === interactionQuery[key]) {
        matches++;
      }
    }

    return matches / interactionKeys.length;
  }

  private scoreHeaderMatch(requestHeaders: any, interactionHeaders: Record<string, any>): number {
    const interactionKeys = Object.keys(interactionHeaders);
    if (interactionKeys.length === 0) return 1;

    let matches = 0;
    for (const key of interactionKeys) {
      const requestValue = this.findHeaderValue(requestHeaders, key);
      const interactionValue = interactionHeaders[key];
      
      if (requestValue && this.normalizeHeaderValue(requestValue) === this.normalizeHeaderValue(interactionValue)) {
        matches++;
      }
    }

    return matches / interactionKeys.length;
  }

  private scoreBodyMatch(requestBody: any, interactionBody: any): number {
    if (interactionBody === undefined || interactionBody === null) {
      return (requestBody === undefined || requestBody === null) ? 1 : 0.5;
    }

    try {
      // Deep comparison for objects
      if (typeof interactionBody === 'object' && typeof requestBody === 'object') {
        return this.scoreObjectMatch(requestBody, interactionBody);
      }

      // Direct comparison for primitives
      return requestBody === interactionBody ? 1 : 0;
    } catch (error) {
      this.logger.warn('Body matching failed', { error });
      return 0;
    }
  }

  private scoreObjectMatch(requestObj: any, interactionObj: any, depth: number = 0): number {
    if (depth > 10) return 0; // Prevent infinite recursion

    if (requestObj === interactionObj) return 1;
    if (typeof requestObj !== typeof interactionObj) return 0;
    if (requestObj === null || interactionObj === null) return 0;

    const interactionKeys = Object.keys(interactionObj);
    if (interactionKeys.length === 0) return 1;

    let matches = 0;
    for (const key of interactionKeys) {
      if (!(key in requestObj)) {
        continue; // Missing key
      }

      const requestValue = requestObj[key];
      const interactionValue = interactionObj[key];

      if (typeof interactionValue === 'object' && interactionValue !== null) {
        matches += this.scoreObjectMatch(requestValue, interactionValue, depth + 1);
      } else if (requestValue === interactionValue) {
        matches++;
      }
    }

    return matches / interactionKeys.length;
  }

  private validateProviderStates(requiredStates: any[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const requiredState of requiredStates) {
      const stateName = requiredState.name;
      const currentState = this.providerStates[stateName];

      if (!currentState || !currentState.isActive) {
        errors.push(`Required provider state '${stateName}' is not active`);
        continue;
      }

      // Validate state parameters if provided
      if (requiredState.params && currentState.params) {
        const paramValidation = this.validateStateParams(requiredState.params, currentState.params);
        if (!paramValidation.isValid) {
          errors.push(...paramValidation.errors.map(e => `State '${stateName}': ${e}`));
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private validateStateParams(required: Record<string, any>, current: Record<string, any>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    Object.entries(required).forEach(([key, expectedValue]) => {
      if (!(key in current)) {
        errors.push(`Missing parameter '${key}'`);
      } else if (current[key] !== expectedValue) {
        errors.push(`Parameter '${key}' mismatch: expected ${expectedValue}, got ${current[key]}`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private recordMatchedRequest(req: Request, interaction: PactInteraction): void {
    this.interactionHistory.push({
      timestamp: new Date(),
      interaction,
      request: {
        method: req.method,
        path: req.path,
        query: req.query,
        headers: req.headers,
        body: req.body
      },
      response: interaction.response,
      matched: true
    });
  }

  private recordUnmatchedRequest(req: Request, matchResult: MockInteractionMatch | null): void {
    this.interactionHistory.push({
      timestamp: new Date(),
      interaction: matchResult?.interaction || {} as PactInteraction,
      request: {
        method: req.method,
        path: req.path,
        query: req.query,
        headers: req.headers,
        body: req.body
      },
      response: { status: 404, body: 'No matching interaction' },
      matched: false
    });
  }

  private getVerificationSummary(): any {
    const total = this.activeInteractions.length;
    const used = new Set(
      this.interactionHistory
        .filter(h => h.matched)
        .map(h => h.interaction.description)
    ).size;

    return {
      totalInteractions: total,
      usedInteractions: used,
      unusedInteractions: total - used,
      usageRate: total > 0 ? (used / total) * 100 : 0,
      requestHistory: this.interactionHistory.length
    };
  }

  private loadPactFiles(pactFiles: string[]): void {
    for (const filePath of pactFiles) {
      try {
        const content = readFileSync(filePath, 'utf8');
        const pact: PactContract = JSON.parse(content);
        
        const validation = this.validator.validateContract(pact);
        if (validation.isValid) {
          this.activeInteractions.push(...pact.interactions);
          this.logger.info('Loaded Pact file', {
            filePath,
            interactions: pact.interactions.length,
            consumer: pact.consumer.name,
            provider: pact.provider.name
          });
        } else {
          this.logger.error('Invalid Pact file', {
            filePath,
            errors: validation.errors
          });
        }
      } catch (error) {
        this.logger.error('Failed to load Pact file', {
          filePath,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  private findHeaderValue(headers: any, headerName: string): string | null {
    const normalizedName = headerName.toLowerCase();
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === normalizedName) {
        return Array.isArray(value) ? value[0] : String(value);
      }
    }
    return null;
  }

  private normalizeHeaderValue(value: any): string {
    if (Array.isArray(value)) {
      return value[0];
    }
    return String(value).trim().toLowerCase();
  }

  private interactionsMatch(interaction1: PactInteraction, interaction2: PactInteraction): boolean {
    return (
      interaction1.description === interaction2.description &&
      interaction1.request.method === interaction2.request.method &&
      interaction1.request.path === interaction2.request.path
    );
  }
}