/**
 * Feature Flag SDK Client
 * Production-ready SDK for feature flag evaluation with caching and real-time updates
 */

import { 
  FeatureFlagSDKConfig, 
  UserContext, 
  FlagEvaluation,
  SDKEvaluationContext,
  BulkEvaluationResponse
} from './types';

export class FeatureFlagSDK {
  private config: FeatureFlagSDKConfig;
  private cache = new Map<string, { evaluation: FlagEvaluation; timestamp: number }>();
  private eventListeners = new Map<string, ((evaluation: FlagEvaluation) => void)[]>();
  private webSocket: WebSocket | null = null;
  private retryCount = 0;
  private maxRetries = 3;
  private backoffMultiplier = 2;
  private baseRetryDelay = 1000;

  constructor(config: FeatureFlagSDKConfig) {
    this.config = {
      pollInterval: 60000, // 1 minute default
      streamingEnabled: true,
      timeout: 5000,
      cacheEnabled: true,
      cacheTTL: 60000, // 1 minute default
      offlineMode: false,
      debugMode: false,
      ...config
    };

    this.initialize();
  }

  /**
   * Initialize SDK
   */
  private async initialize(): Promise<void> {
    if (this.config.debugMode) {
      console.log('Initializing Feature Flag SDK with config:', this.config);
    }

    // Set up streaming connection if enabled
    if (this.config.streamingEnabled && !this.config.offlineMode) {
      this.setupWebSocketConnection();
    }

    // Set up polling as fallback
    if (this.config.pollInterval && this.config.pollInterval > 0) {
      this.setupPolling();
    }
  }

  /**
   * Evaluate a single feature flag
   */
  async evaluateFlag(
    flagKey: string,
    context: SDKEvaluationContext = {}
  ): Promise<FlagEvaluation> {
    try {
      // Check cache first if enabled
      if (this.config.cacheEnabled) {
        const cached = this.getCachedEvaluation(flagKey, context);
        if (cached) {
          if (this.config.debugMode) {
            console.log(`Cache hit for flag: ${flagKey}`);
          }
          return cached;
        }
      }

      // If offline mode, return default value
      if (this.config.offlineMode) {
        return this.getOfflineEvaluation(flagKey);
      }

      // Fetch from API
      const evaluation = await this.fetchFlagEvaluation(flagKey, context);

      // Cache the result
      if (this.config.cacheEnabled) {
        this.cacheEvaluation(flagKey, context, evaluation);
      }

      // Notify listeners
      this.notifyListeners(flagKey, evaluation);

      return evaluation;

    } catch (error) {
      if (this.config.debugMode) {
        console.error(`Error evaluating flag ${flagKey}:`, error);
      }

      // Return cached value if available
      const cached = this.getCachedEvaluation(flagKey, context);
      if (cached) {
        return cached;
      }

      // Return default evaluation
      return this.getOfflineEvaluation(flagKey);
    }
  }

  /**
   * Evaluate multiple flags at once
   */
  async evaluateFlags(
    flagKeys: string[],
    context: SDKEvaluationContext = {}
  ): Promise<Record<string, FlagEvaluation>> {
    if (flagKeys.length === 0) {
      return {};
    }

    try {
      const evaluations: Record<string, FlagEvaluation> = {};

      // Check cache for each flag
      const uncachedFlags: string[] = [];
      
      if (this.config.cacheEnabled) {
        for (const flagKey of flagKeys) {
          const cached = this.getCachedEvaluation(flagKey, context);
          if (cached) {
            evaluations[flagKey] = cached;
          } else {
            uncachedFlags.push(flagKey);
          }
        }
      } else {
        uncachedFlags.push(...flagKeys);
      }

      // Fetch uncached flags
      if (uncachedFlags.length > 0 && !this.config.offlineMode) {
        const bulkResult = await this.fetchBulkEvaluations(uncachedFlags, context);
        
        for (const [flagKey, evaluation] of Object.entries(bulkResult.evaluations)) {
          evaluations[flagKey] = evaluation;
          
          // Cache the result
          if (this.config.cacheEnabled) {
            this.cacheEvaluation(flagKey, context, evaluation);
          }

          // Notify listeners
          this.notifyListeners(flagKey, evaluation);
        }
      }

      // For offline mode or remaining flags, use defaults
      for (const flagKey of flagKeys) {
        if (!evaluations[flagKey]) {
          evaluations[flagKey] = this.getOfflineEvaluation(flagKey);
        }
      }

      return evaluations;

    } catch (error) {
      if (this.config.debugMode) {
        console.error('Error evaluating multiple flags:', error);
      }

      // Return cached or default evaluations for all flags
      const evaluations: Record<string, FlagEvaluation> = {};
      for (const flagKey of flagKeys) {
        const cached = this.getCachedEvaluation(flagKey, context);
        evaluations[flagKey] = cached || this.getOfflineEvaluation(flagKey);
      }

      return evaluations;
    }
  }

  /**
   * Get boolean value for a flag
   */
  async getBooleanFlag(
    flagKey: string,
    defaultValue: boolean = false,
    context: SDKEvaluationContext = {}
  ): Promise<boolean> {
    const evaluation = await this.evaluateFlag(flagKey, context);
    return typeof evaluation.value === 'boolean' ? evaluation.value : defaultValue;
  }

  /**
   * Get string value for a flag
   */
  async getStringFlag(
    flagKey: string,
    defaultValue: string = '',
    context: SDKEvaluationContext = {}
  ): Promise<string> {
    const evaluation = await this.evaluateFlag(flagKey, context);
    return typeof evaluation.value === 'string' ? evaluation.value : defaultValue;
  }

  /**
   * Get number value for a flag
   */
  async getNumberFlag(
    flagKey: string,
    defaultValue: number = 0,
    context: SDKEvaluationContext = {}
  ): Promise<number> {
    const evaluation = await this.evaluateFlag(flagKey, context);
    return typeof evaluation.value === 'number' ? evaluation.value : defaultValue;
  }

  /**
   * Get JSON value for a flag
   */
  async getJSONFlag<T = any>(
    flagKey: string,
    defaultValue: T,
    context: SDKEvaluationContext = {}
  ): Promise<T> {
    const evaluation = await this.evaluateFlag(flagKey, context);
    return evaluation.value !== undefined ? evaluation.value : defaultValue;
  }

  /**
   * Subscribe to flag changes
   */
  onFlagChange(flagKey: string, callback: (evaluation: FlagEvaluation) => void): () => void {
    const listeners = this.eventListeners.get(flagKey) || [];
    listeners.push(callback);
    this.eventListeners.set(flagKey, listeners);

    // Return unsubscribe function
    return () => {
      const currentListeners = this.eventListeners.get(flagKey) || [];
      const index = currentListeners.indexOf(callback);
      if (index > -1) {
        currentListeners.splice(index, 1);
        this.eventListeners.set(flagKey, currentListeners);
      }
    };
  }

  /**
   * Wait for SDK to be ready
   */
  async waitUntilReady(timeoutMs: number = 10000): Promise<void> {
    if (this.config.offlineMode) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('SDK initialization timeout'));
      }, timeoutMs);

      // For simplicity, resolve immediately if streaming is disabled
      if (!this.config.streamingEnabled) {
        clearTimeout(timeout);
        resolve();
        return;
      }

      // Wait for WebSocket connection
      const checkConnection = () => {
        if (this.webSocket?.readyState === WebSocket.OPEN) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkConnection, 100);
        }
      };

      checkConnection();
    });
  }

  /**
   * Manually refresh all cached flags
   */
  async refresh(): Promise<void> {
    if (this.config.offlineMode) {
      return;
    }

    // Clear cache
    this.cache.clear();

    if (this.config.debugMode) {
      console.log('SDK cache cleared and refreshing...');
    }
  }

  /**
   * Close SDK and cleanup resources
   */
  close(): void {
    if (this.webSocket) {
      this.webSocket.close();
      this.webSocket = null;
    }

    this.cache.clear();
    this.eventListeners.clear();

    if (this.config.debugMode) {
      console.log('Feature Flag SDK closed');
    }
  }

  // Private methods

  private async fetchFlagEvaluation(
    flagKey: string,
    context: SDKEvaluationContext
  ): Promise<FlagEvaluation> {
    const userContext: UserContext = this.buildUserContext(context);

    const response = await this.makeAPIRequest(`/api/feature-flags/${encodeURIComponent(flagKey)}/evaluate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey,
      },
      body: JSON.stringify(userContext)
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || 'Flag evaluation failed');
    }

    return result.data;
  }

  private async fetchBulkEvaluations(
    flagKeys: string[],
    context: SDKEvaluationContext
  ): Promise<BulkEvaluationResponse> {
    const userContext: UserContext = this.buildUserContext(context);

    const response = await this.makeAPIRequest('/api/feature-flags/evaluate/bulk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey,
      },
      body: JSON.stringify({
        flagKeys,
        ...userContext
      })
    });

    if (!response.ok) {
      throw new Error(`Bulk API request failed: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || 'Bulk evaluation failed');
    }

    return result.data;
  }

  private buildUserContext(context: SDKEvaluationContext): UserContext {
    return {
      userId: context.userId || this.config.userId,
      sessionId: context.sessionId,
      email: context.email,
      groups: context.groups || [],
      attributes: {
        ...context.attributes,
        sdk: 'typescript',
        version: '1.0.0',
        timestamp: new Date().toISOString()
      },
      location: context.location,
      device: context.device,
      custom: context.custom
    };
  }

  private async makeAPIRequest(url: string, options: RequestInit): Promise<Response> {
    const fullUrl = `${this.config.baseUrl}${url}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(fullUrl, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private getCachedEvaluation(
    flagKey: string,
    context: SDKEvaluationContext
  ): FlagEvaluation | null {
    const cacheKey = this.buildCacheKey(flagKey, context);
    const cached = this.cache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp) < this.config.cacheTTL!) {
      return cached.evaluation;
    }

    return null;
  }

  private cacheEvaluation(
    flagKey: string,
    context: SDKEvaluationContext,
    evaluation: FlagEvaluation
  ): void {
    const cacheKey = this.buildCacheKey(flagKey, context);
    this.cache.set(cacheKey, {
      evaluation,
      timestamp: Date.now()
    });
  }

  private buildCacheKey(flagKey: string, context: SDKEvaluationContext): string {
    // Create a deterministic cache key from flag key and relevant context
    const contextStr = JSON.stringify({
      userId: context.userId || this.config.userId,
      environment: this.config.environment,
      // Add other relevant context fields that affect evaluation
    });
    return `${flagKey}:${this.hashString(contextStr)}`;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  private getOfflineEvaluation(flagKey: string): FlagEvaluation {
    return {
      flagKey,
      value: false,
      reason: {
        kind: 'ERROR',
        errorKind: 'OFFLINE_MODE'
      },
      timestamp: new Date()
    };
  }

  private notifyListeners(flagKey: string, evaluation: FlagEvaluation): void {
    const listeners = this.eventListeners.get(flagKey);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(evaluation);
        } catch (error) {
          if (this.config.debugMode) {
            console.error('Error in flag change listener:', error);
          }
        }
      });
    }
  }

  private setupWebSocketConnection(): void {
    if (typeof window === 'undefined') {
      return; // Server-side, skip WebSocket
    }

    try {
      const protocol = this.config.baseUrl.startsWith('https://') ? 'wss://' : 'ws://';
      const host = this.config.baseUrl.replace(/^https?:\/\//, '');
      const wsUrl = `${protocol}${host}/api/ws?apiKey=${this.config.apiKey}&environment=${this.config.environment}`;

      this.webSocket = new WebSocket(wsUrl);

      this.webSocket.onopen = () => {
        this.retryCount = 0;
        if (this.config.debugMode) {
          console.log('WebSocket connected for real-time flag updates');
        }
      };

      this.webSocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleWebSocketMessage(message);
        } catch (error) {
          if (this.config.debugMode) {
            console.error('Error parsing WebSocket message:', error);
          }
        }
      };

      this.webSocket.onclose = () => {
        if (this.config.debugMode) {
          console.log('WebSocket connection closed');
        }
        this.retryWebSocketConnection();
      };

      this.webSocket.onerror = (error) => {
        if (this.config.debugMode) {
          console.error('WebSocket error:', error);
        }
      };

    } catch (error) {
      if (this.config.debugMode) {
        console.error('Failed to setup WebSocket connection:', error);
      }
    }
  }

  private handleWebSocketMessage(message: any): void {
    switch (message.type) {
      case 'flag_updated':
        // Invalidate cache for the updated flag
        this.invalidateCache(message.flagKey);
        
        if (this.config.debugMode) {
          console.log(`Flag updated: ${message.flagKey}`);
        }
        break;

      case 'flag_deleted':
        // Invalidate cache for the deleted flag
        this.invalidateCache(message.flagKey);
        break;

      default:
        if (this.config.debugMode) {
          console.log('Unknown WebSocket message type:', message.type);
        }
    }
  }

  private invalidateCache(flagKey: string): void {
    // Remove all cache entries for this flag
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${flagKey}:`)) {
        this.cache.delete(key);
      }
    }
  }

  private retryWebSocketConnection(): void {
    if (this.retryCount >= this.maxRetries) {
      if (this.config.debugMode) {
        console.log('Max WebSocket retry attempts reached');
      }
      return;
    }

    const delay = this.baseRetryDelay * Math.pow(this.backoffMultiplier, this.retryCount);
    this.retryCount++;

    setTimeout(() => {
      if (this.config.debugMode) {
        console.log(`Retrying WebSocket connection (attempt ${this.retryCount})`);
      }
      this.setupWebSocketConnection();
    }, delay);
  }

  private setupPolling(): void {
    // Implement periodic cache refresh as fallback
    setInterval(() => {
      if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
        // Only poll if WebSocket is not connected
        this.refresh().catch(error => {
          if (this.config.debugMode) {
            console.error('Error during polling refresh:', error);
          }
        });
      }
    }, this.config.pollInterval!);
  }
}

// Export convenience factory function
export function createFeatureFlagClient(config: FeatureFlagSDKConfig): FeatureFlagSDK {
  return new FeatureFlagSDK(config);
}