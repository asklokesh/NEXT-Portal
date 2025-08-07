import { BackstageClient } from '../client/backstage-client';
import { ClientConfig } from '../types';

/**
 * Create a Backstage client with default configuration
 */
export function createBackstageClient(config: Partial<ClientConfig> = {}): BackstageClient {
  const defaultConfig: ClientConfig = {
    baseURL: 'http://localhost:4400/api',
    timeout: 30000,
    retries: 3,
    retryDelay: 1000,
    circuitBreakerOptions: {
      threshold: 5,
      timeout: 60000,
      resetTimeout: 30000,
    },
    rateLimit: {
      requests: 100,
      window: 60000, // 1 minute
    },
  };

  const finalConfig = { ...defaultConfig, ...config };
  return new BackstageClient(finalConfig);
}

/**
 * Create a client with API key authentication
 */
export function createBackstageClientWithApiKey(
  apiKey: string,
  baseURL?: string,
  options?: Partial<ClientConfig>
): BackstageClient {
  return createBackstageClient({
    apiKey,
    baseURL: baseURL || 'http://localhost:4400/api',
    ...options,
  });
}

/**
 * Create a client with Bearer token authentication
 */
export function createBackstageClientWithToken(
  bearerToken: string,
  baseURL?: string,
  options?: Partial<ClientConfig>
): BackstageClient {
  return createBackstageClient({
    bearerToken,
    baseURL: baseURL || 'http://localhost:4400/api',
    ...options,
  });
}

/**
 * Create a production-ready client with optimized settings
 */
export function createProductionClient(config: Partial<ClientConfig> = {}): BackstageClient {
  const productionConfig: ClientConfig = {
    baseURL: config.baseURL || 'https://portal.company.com/api',
    timeout: 45000,
    retries: 5,
    retryDelay: 2000,
    circuitBreakerOptions: {
      threshold: 10,
      timeout: 120000,
      resetTimeout: 60000,
    },
    rateLimit: {
      requests: 1000,
      window: 60000,
    },
    ...config,
  };

  return new BackstageClient(productionConfig);
}

/**
 * Create a development client with debug settings
 */
export function createDevClient(config: Partial<ClientConfig> = {}): BackstageClient {
  const devConfig: ClientConfig = {
    baseURL: config.baseURL || 'http://localhost:4400/api',
    timeout: 10000,
    retries: 1,
    retryDelay: 500,
    circuitBreakerOptions: {
      threshold: 3,
      timeout: 30000,
      resetTimeout: 15000,
    },
    ...config,
  };

  const client = new BackstageClient(devConfig);

  // Add debug event listeners
  client.on('requestStart', ({ url, method }) => {
    console.debug(`[BackstageClient] ${method} ${url}`);
  });

  client.on('requestError', ({ url, method, error }) => {
    console.debug(`[BackstageClient] ${method} ${url} - Error:`, error);
  });

  client.on('connected', () => {
    console.debug('[BackstageClient] WebSocket connected');
  });

  client.on('disconnected', (data) => {
    console.debug('[BackstageClient] WebSocket disconnected:', data);
  });

  return client;
}