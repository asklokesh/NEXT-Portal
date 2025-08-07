import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { EventEmitter } from 'eventemitter3';
import { CircuitBreaker } from 'circuit-breaker-js';
import retry from 'retry';

import { AuthManager } from '../auth/auth-manager';
import { RequestOptions, SDKError } from '../types';

export interface HttpClientConfig {
  baseURL: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  circuitBreakerOptions?: {
    threshold: number;
    timeout: number;
    resetTimeout: number;
  };
  rateLimit?: {
    requests: number;
    window: number;
  };
  defaultHeaders?: Record<string, string>;
}

export class HttpClient extends EventEmitter {
  private axiosInstance: AxiosInstance;
  private authManager: AuthManager;
  private circuitBreaker: CircuitBreaker;
  private rateLimitQueue: Array<() => void> = [];
  private requestCounts: Map<number, number> = new Map();
  
  constructor(
    config: HttpClientConfig,
    authManager: AuthManager
  ) {
    super();
    
    this.authManager = authManager;
    
    // Create axios instance
    this.axiosInstance = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': '@backstage-idp/sdk-typescript/1.0.0',
        ...config.defaultHeaders,
      },
    });

    // Setup circuit breaker
    const cbOptions = config.circuitBreakerOptions || {
      threshold: 5,
      timeout: 60000,
      resetTimeout: 30000
    };
    
    this.circuitBreaker = new CircuitBreaker({
      ...cbOptions,
      onOpen: () => this.emit('circuitBreakerOpen'),
      onHalfOpen: () => this.emit('circuitBreakerHalfOpen'),
      onClose: () => this.emit('circuitBreakerClose'),
    });

    // Setup interceptors
    this.setupRequestInterceptors(config);
    this.setupResponseInterceptors(config);
    
    // Setup rate limiting
    if (config.rateLimit) {
      this.setupRateLimit(config.rateLimit);
    }
  }

  /**
   * Setup request interceptors
   */
  private setupRequestInterceptors(config: HttpClientConfig): void {
    this.axiosInstance.interceptors.request.use(
      async (requestConfig) => {
        // Add authentication header
        try {
          const authHeader = this.authManager.getAuthHeader();
          if (authHeader) {
            if (this.authManager.getAccessToken()?.includes('bearer')) {
              requestConfig.headers['Authorization'] = authHeader;
            } else {
              requestConfig.headers['X-API-Key'] = authHeader;
            }
          }
        } catch (error) {
          // Token refresh failed, continue without auth
        }

        // Add request ID for tracing
        requestConfig.headers['X-Request-ID'] = this.generateRequestId();
        
        this.emit('requestStart', { url: requestConfig.url, method: requestConfig.method });
        
        return requestConfig;
      },
      (error) => {
        this.emit('requestError', error);
        return Promise.reject(this.transformError(error));
      }
    );
  }

  /**
   * Setup response interceptors
   */
  private setupResponseInterceptors(config: HttpClientConfig): void {
    this.axiosInstance.interceptors.response.use(
      (response) => {
        this.emit('requestSuccess', {
          url: response.config.url,
          method: response.config.method,
          status: response.status,
          duration: response.headers['x-response-time']
        });
        
        return response;
      },
      async (error) => {
        const originalRequest = error.config;
        
        // Handle 401 errors with token refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          try {
            await this.authManager.refreshToken();
            const authHeader = this.authManager.getAuthHeader();
            if (authHeader) {
              if (this.authManager.getAccessToken()?.includes('bearer')) {
                originalRequest.headers['Authorization'] = authHeader;
              } else {
                originalRequest.headers['X-API-Key'] = authHeader;
              }
            }
            
            return this.axiosInstance(originalRequest);
          } catch (refreshError) {
            this.emit('authError', refreshError);
            return Promise.reject(this.transformError(error));
          }
        }

        this.emit('requestError', {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          error: error.message
        });
        
        return Promise.reject(this.transformError(error));
      }
    );
  }

  /**
   * Setup rate limiting
   */
  private setupRateLimit(rateLimit: { requests: number; window: number }): void {
    const windowStart = Math.floor(Date.now() / rateLimit.window);
    this.requestCounts.set(windowStart, 0);

    // Clean up old windows periodically
    setInterval(() => {
      const now = Math.floor(Date.now() / rateLimit.window);
      for (const [window] of this.requestCounts) {
        if (window < now - 10) {
          this.requestCounts.delete(window);
        }
      }
    }, rateLimit.window);
  }

  /**
   * Check rate limit
   */
  private async checkRateLimit(rateLimit?: { requests: number; window: number }): Promise<void> {
    if (!rateLimit) return;

    const now = Date.now();
    const windowStart = Math.floor(now / rateLimit.window);
    const currentCount = this.requestCounts.get(windowStart) || 0;

    if (currentCount >= rateLimit.requests) {
      const waitTime = rateLimit.window - (now % rateLimit.window);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.requestCounts.set(windowStart, currentCount + 1);
  }

  /**
   * Make HTTP request with retry and circuit breaker
   */
  public async request<T>(
    config: AxiosRequestConfig,
    options: RequestOptions = {}
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const operation = retry.operation({
        retries: options.retries || 3,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 5000,
        randomize: true,
      });

      operation.attempt(async () => {
        try {
          const response = await this.circuitBreaker.execute(async () => {
            return this.axiosInstance.request<T>({
              ...config,
              timeout: options.timeout,
              signal: options.signal,
              headers: {
                ...config.headers,
                ...options.headers,
              },
            });
          });

          resolve(response.data);
        } catch (error) {
          if (operation.retry(error as Error)) {
            return;
          }
          
          reject(this.transformError(error));
        }
      });
    });
  }

  /**
   * GET request
   */
  public async get<T>(
    url: string,
    params?: any,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>({
      method: 'GET',
      url,
      params,
    }, options);
  }

  /**
   * POST request
   */
  public async post<T>(
    url: string,
    data?: any,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>({
      method: 'POST',
      url,
      data,
    }, options);
  }

  /**
   * PUT request
   */
  public async put<T>(
    url: string,
    data?: any,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>({
      method: 'PUT',
      url,
      data,
    }, options);
  }

  /**
   * DELETE request
   */
  public async delete<T>(
    url: string,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>({
      method: 'DELETE',
      url,
    }, options);
  }

  /**
   * PATCH request
   */
  public async patch<T>(
    url: string,
    data?: any,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>({
      method: 'PATCH',
      url,
      data,
    }, options);
  }

  /**
   * Upload file
   */
  public async upload<T>(
    url: string,
    file: File | Buffer,
    options?: RequestOptions
  ): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);

    return this.request<T>({
      method: 'POST',
      url,
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }, options);
  }

  /**
   * Transform axios error to SDK error
   */
  private transformError(error: any): SDKError {
    if (error.isAxiosError) {
      const axiosError = error as AxiosError;
      return {
        code: axiosError.code || 'HTTP_ERROR',
        message: axiosError.message,
        status: axiosError.response?.status,
        details: axiosError.response?.data,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: error.message || 'An unknown error occurred',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get circuit breaker status
   */
  public getCircuitBreakerStatus(): {
    state: 'closed' | 'open' | 'half-open';
    failures: number;
    nextAttempt?: number;
  } {
    return {
      state: this.circuitBreaker.state,
      failures: this.circuitBreaker.failures,
      nextAttempt: this.circuitBreaker.nextAttempt,
    };
  }

  /**
   * Reset circuit breaker
   */
  public resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
  }

  /**
   * Dispose of the client
   */
  public dispose(): void {
    this.removeAllListeners();
  }
}