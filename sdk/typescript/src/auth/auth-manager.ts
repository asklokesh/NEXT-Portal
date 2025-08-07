import { EventEmitter } from 'eventemitter3';

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  tokenType: 'bearer' | 'api-key';
}

export interface AuthConfig {
  baseURL: string;
  apiKey?: string;
  bearerToken?: string;
  refreshToken?: string;
  autoRefresh?: boolean;
  onTokenRefresh?: (tokens: AuthTokens) => void;
  onAuthError?: (error: AuthError) => void;
}

export interface AuthError {
  code: string;
  message: string;
  status: number;
}

export class AuthManager extends EventEmitter {
  private tokens: AuthTokens | null = null;
  private config: AuthConfig;
  private refreshPromise: Promise<AuthTokens> | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(config: AuthConfig) {
    super();
    this.config = config;
    
    // Initialize with provided tokens
    if (config.apiKey) {
      this.tokens = {
        accessToken: config.apiKey,
        tokenType: 'api-key'
      };
    } else if (config.bearerToken) {
      this.tokens = {
        accessToken: config.bearerToken,
        refreshToken: config.refreshToken,
        tokenType: 'bearer'
      };
    }

    this.setupAutoRefresh();
  }

  /**
   * Get current access token
   */
  public getAccessToken(): string | null {
    return this.tokens?.accessToken || null;
  }

  /**
   * Get authorization header value
   */
  public getAuthHeader(): string | null {
    if (!this.tokens) return null;
    
    if (this.tokens.tokenType === 'api-key') {
      return this.tokens.accessToken;
    } else {
      return `Bearer ${this.tokens.accessToken}`;
    }
  }

  /**
   * Check if currently authenticated
   */
  public isAuthenticated(): boolean {
    return this.tokens !== null && this.isTokenValid();
  }

  /**
   * Check if token is valid (not expired)
   */
  private isTokenValid(): boolean {
    if (!this.tokens) return false;
    
    // API keys don't expire
    if (this.tokens.tokenType === 'api-key') return true;
    
    // Check if bearer token is expired
    if (this.tokens.expiresAt) {
      return Date.now() < this.tokens.expiresAt - 60000; // 1 minute buffer
    }
    
    return true;
  }

  /**
   * Set authentication tokens
   */
  public setTokens(tokens: AuthTokens): void {
    this.tokens = tokens;
    this.setupAutoRefresh();
    this.emit('tokensUpdated', tokens);
    
    if (this.config.onTokenRefresh) {
      this.config.onTokenRefresh(tokens);
    }
  }

  /**
   * Clear authentication tokens
   */
  public clearTokens(): void {
    this.tokens = null;
    this.clearRefreshTimer();
    this.emit('tokensCleared');
  }

  /**
   * Refresh access token
   */
  public async refreshToken(): Promise<AuthTokens> {
    // Return existing refresh promise if one is in progress
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    // Can't refresh without a refresh token
    if (!this.tokens?.refreshToken) {
      throw new AuthError('NO_REFRESH_TOKEN', 'No refresh token available', 401);
    }

    this.refreshPromise = this.performTokenRefresh();
    
    try {
      const newTokens = await this.refreshPromise;
      this.setTokens(newTokens);
      return newTokens;
    } catch (error) {
      this.handleAuthError(error);
      throw error;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Ensure token is valid, refresh if necessary
   */
  public async ensureValidToken(): Promise<string> {
    if (!this.tokens) {
      throw new AuthError('NOT_AUTHENTICATED', 'No authentication tokens available', 401);
    }

    if (this.isTokenValid()) {
      return this.tokens.accessToken;
    }

    // Try to refresh if possible
    if (this.tokens.refreshToken && this.config.autoRefresh !== false) {
      const refreshedTokens = await this.refreshToken();
      return refreshedTokens.accessToken;
    }

    throw new AuthError('TOKEN_EXPIRED', 'Token expired and cannot be refreshed', 401);
  }

  /**
   * Perform the actual token refresh
   */
  private async performTokenRefresh(): Promise<AuthTokens> {
    const response = await fetch(`${this.config.baseURL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refreshToken: this.tokens!.refreshToken,
      }),
    });

    if (!response.ok) {
      throw new AuthError(
        'REFRESH_FAILED',
        `Token refresh failed: ${response.statusText}`,
        response.status
      );
    }

    const data = await response.json();
    
    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken || this.tokens!.refreshToken,
      expiresAt: data.expiresAt ? Date.now() + (data.expiresIn * 1000) : undefined,
      tokenType: 'bearer'
    };
  }

  /**
   * Setup auto refresh timer
   */
  private setupAutoRefresh(): void {
    this.clearRefreshTimer();
    
    if (!this.tokens || this.tokens.tokenType === 'api-key' || !this.config.autoRefresh) {
      return;
    }

    if (this.tokens.expiresAt) {
      const refreshTime = this.tokens.expiresAt - Date.now() - 300000; // 5 minutes before expiry
      
      if (refreshTime > 0) {
        this.refreshTimer = setTimeout(async () => {
          try {
            await this.refreshToken();
          } catch (error) {
            this.handleAuthError(error);
          }
        }, refreshTime);
      }
    }
  }

  /**
   * Clear refresh timer
   */
  private clearRefreshTimer(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Handle authentication errors
   */
  private handleAuthError(error: any): void {
    const authError: AuthError = {
      code: error.code || 'AUTH_ERROR',
      message: error.message || 'Authentication error occurred',
      status: error.status || 401
    };

    this.emit('authError', authError);
    
    if (this.config.onAuthError) {
      this.config.onAuthError(authError);
    }

    // Clear tokens if auth error is unrecoverable
    if (authError.status === 401) {
      this.clearTokens();
    }
  }

  /**
   * Dispose of the auth manager
   */
  public dispose(): void {
    this.clearRefreshTimer();
    this.removeAllListeners();
  }
}

// Auth error class
class AuthError extends Error {
  public code: string;
  public status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.status = status;
  }
}