/**
 * Dynamic Secret Generation and Rotation System for Vault Integration
 * Provides automatic secret generation, rotation, and lifecycle management
 */

import axios, { AxiosInstance } from 'axios';
import { EventEmitter } from 'events';

export interface VaultConfig {
  address: string;
  token?: string;
  namespace?: string;
  tlsConfig?: {
    skipVerify?: boolean;
    caCert?: string;
    clientCert?: string;
    clientKey?: string;
  };
}

export interface SecretMetadata {
  path: string;
  version: number;
  created: Date;
  ttl: number;
  renewable: boolean;
  leaseId?: string;
}

export interface DatabaseCredentials {
  username: string;
  password: string;
  ttl: number;
  renewable: boolean;
  leaseId: string;
}

export interface RotationSchedule {
  secretPath: string;
  interval: number; // milliseconds
  maxAge: number; // milliseconds
  gracePeriod: number; // milliseconds
  retryAttempts: number;
  notifyBeforeExpiry: number; // milliseconds
}

export interface SecretRotationEvent {
  type: 'rotation_started' | 'rotation_completed' | 'rotation_failed' | 'expiry_warning';
  secretPath: string;
  timestamp: Date;
  oldVersion?: number;
  newVersion?: number;
  error?: Error;
  metadata?: any;
}

/**
 * Advanced Dynamic Secrets Manager with automatic rotation and lifecycle management
 */
export class DynamicSecretsManager extends EventEmitter {
  private client: AxiosInstance;
  private config: VaultConfig;
  private rotationSchedules: Map<string, NodeJS.Timeout> = new Map();
  private secretCache: Map<string, any> = new Map();
  private rotationHistory: Map<string, SecretRotationEvent[]> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(config: VaultConfig) {
    super();
    this.config = config;
    this.client = this.createVaultClient();
    this.startHealthCheck();
  }

  private createVaultClient(): AxiosInstance {
    const client = axios.create({
      baseURL: `${this.config.address}/v1`,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.token && { 'X-Vault-Token': this.config.token }),
        ...(this.config.namespace && { 'X-Vault-Namespace': this.config.namespace })
      }
    });

    // Request interceptor for token refresh
    client.interceptors.request.use(async (config) => {
      if (this.config.token) {
        config.headers['X-Vault-Token'] = this.config.token;
      }
      return config;
    });

    // Response interceptor for error handling
    client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 403) {
          this.emit('token_expired', { timestamp: new Date() });
        }
        return Promise.reject(error);
      }
    );

    return client;
  }

  /**
   * Generate dynamic database credentials with automatic rotation
   */
  async generateDatabaseCredentials(
    roleName: string,
    ttl?: number,
    enableAutoRotation = true
  ): Promise<DatabaseCredentials> {
    try {
      const response = await this.client.get(`/database/creds/${roleName}`, {
        params: ttl ? { ttl: `${ttl}s` } : undefined
      });

      const { data } = response.data;
      const credentials: DatabaseCredentials = {
        username: data.username,
        password: data.password,
        ttl: data.lease_duration,
        renewable: data.renewable,
        leaseId: response.data.lease_id
      };

      // Cache credentials for rotation tracking
      const secretPath = `database/creds/${roleName}`;
      this.secretCache.set(secretPath, {
        ...credentials,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + (credentials.ttl * 1000))
      });

      // Setup automatic rotation if enabled
      if (enableAutoRotation && credentials.renewable) {
        this.scheduleRotation({
          secretPath,
          interval: (credentials.ttl * 0.7) * 1000, // Rotate at 70% of TTL
          maxAge: credentials.ttl * 1000,
          gracePeriod: 300000, // 5 minutes grace period
          retryAttempts: 3,
          notifyBeforeExpiry: 600000 // 10 minutes warning
        });
      }

      this.emit('secret_generated', {
        type: 'database_credentials',
        path: secretPath,
        ttl: credentials.ttl,
        timestamp: new Date()
      });

      return credentials;
    } catch (error) {
      this.emit('secret_generation_failed', {
        type: 'database_credentials',
        path: `database/creds/${roleName}`,
        error,
        timestamp: new Date()
      });
      throw error;
    }
  }

  /**
   * Generate dynamic cloud credentials (AWS, GCP, Azure)
   */
  async generateCloudCredentials(
    provider: 'aws' | 'gcp' | 'azure',
    roleName: string,
    ttl?: number
  ): Promise<any> {
    try {
      let endpoint: string;
      
      switch (provider) {
        case 'aws':
          endpoint = `/aws/creds/${roleName}`;
          break;
        case 'gcp':
          endpoint = `/gcp/roleset/${roleName}/token`;
          break;
        case 'azure':
          endpoint = `/azure/creds/${roleName}`;
          break;
        default:
          throw new Error(`Unsupported cloud provider: ${provider}`);
      }

      const response = await this.client.get(endpoint, {
        params: ttl ? { ttl: `${ttl}s` } : undefined
      });

      const { data } = response.data;
      const secretPath = `${provider}/creds/${roleName}`;

      // Cache for rotation tracking
      this.secretCache.set(secretPath, {
        ...data,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + (data.lease_duration * 1000))
      });

      this.emit('secret_generated', {
        type: 'cloud_credentials',
        path: secretPath,
        provider,
        ttl: data.lease_duration,
        timestamp: new Date()
      });

      return data;
    } catch (error) {
      this.emit('secret_generation_failed', {
        type: 'cloud_credentials',
        path: `${provider}/creds/${roleName}`,
        error,
        timestamp: new Date()
      });
      throw error;
    }
  }

  /**
   * Generate PKI certificates with automatic renewal
   */
  async generateCertificate(
    pkiPath: string,
    roleName: string,
    commonName: string,
    altNames?: string[],
    ttl?: number
  ): Promise<any> {
    try {
      const requestData = {
        common_name: commonName,
        ...(altNames && { alt_names: altNames.join(',') }),
        ...(ttl && { ttl: `${ttl}s` })
      };

      const response = await this.client.post(
        `/${pkiPath}/issue/${roleName}`,
        requestData
      );

      const { data } = response.data;
      const secretPath = `${pkiPath}/issue/${roleName}`;

      // Schedule certificate renewal at 80% of TTL
      if (data.lease_duration > 0) {
        this.scheduleRotation({
          secretPath: `${secretPath}/${commonName}`,
          interval: (data.lease_duration * 0.8) * 1000,
          maxAge: data.lease_duration * 1000,
          gracePeriod: 3600000, // 1 hour grace period
          retryAttempts: 5,
          notifyBeforeExpiry: 86400000 // 24 hours warning
        });
      }

      this.emit('certificate_generated', {
        type: 'pki_certificate',
        path: secretPath,
        commonName,
        ttl: data.lease_duration,
        timestamp: new Date()
      });

      return data;
    } catch (error) {
      this.emit('certificate_generation_failed', {
        type: 'pki_certificate',
        path: `${pkiPath}/issue/${roleName}`,
        commonName,
        error,
        timestamp: new Date()
      });
      throw error;
    }
  }

  /**
   * Schedule automatic secret rotation
   */
  scheduleRotation(schedule: RotationSchedule): void {
    // Clear existing schedule if any
    if (this.rotationSchedules.has(schedule.secretPath)) {
      clearTimeout(this.rotationSchedules.get(schedule.secretPath)!);
    }

    // Schedule expiry warning
    const warningTimeout = setTimeout(() => {
      this.emit('expiry_warning', {
        type: 'expiry_warning',
        secretPath: schedule.secretPath,
        timestamp: new Date()
      });
    }, schedule.interval - schedule.notifyBeforeExpiry);

    // Schedule rotation
    const rotationTimeout = setTimeout(async () => {
      await this.rotateSecret(schedule);
    }, schedule.interval);

    this.rotationSchedules.set(schedule.secretPath, rotationTimeout);

    this.emit('rotation_scheduled', {
      secretPath: schedule.secretPath,
      nextRotation: new Date(Date.now() + schedule.interval),
      timestamp: new Date()
    });
  }

  /**
   * Rotate a secret according to its schedule
   */
  private async rotateSecret(schedule: RotationSchedule): Promise<void> {
    const { secretPath, retryAttempts } = schedule;
    let attempts = 0;

    const rotationEvent: SecretRotationEvent = {
      type: 'rotation_started',
      secretPath,
      timestamp: new Date()
    };

    this.emit('rotation_started', rotationEvent);
    this.addToRotationHistory(secretPath, rotationEvent);

    while (attempts < retryAttempts) {
      try {
        await this.performRotation(secretPath);
        
        const completedEvent: SecretRotationEvent = {
          type: 'rotation_completed',
          secretPath,
          timestamp: new Date()
        };

        this.emit('rotation_completed', completedEvent);
        this.addToRotationHistory(secretPath, completedEvent);

        // Schedule next rotation
        this.scheduleRotation(schedule);
        return;
      } catch (error) {
        attempts++;
        
        if (attempts >= retryAttempts) {
          const failedEvent: SecretRotationEvent = {
            type: 'rotation_failed',
            secretPath,
            timestamp: new Date(),
            error: error as Error
          };

          this.emit('rotation_failed', failedEvent);
          this.addToRotationHistory(secretPath, failedEvent);
        } else {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
        }
      }
    }
  }

  /**
   * Perform the actual secret rotation
   */
  private async performRotation(secretPath: string): Promise<void> {
    const cachedSecret = this.secretCache.get(secretPath);
    if (!cachedSecret) {
      throw new Error(`No cached secret found for path: ${secretPath}`);
    }

    if (secretPath.startsWith('database/creds/')) {
      // Renew database lease
      const response = await this.client.put(`/sys/leases/renew`, {
        lease_id: cachedSecret.leaseId
      });

      // Update cache
      this.secretCache.set(secretPath, {
        ...cachedSecret,
        ttl: response.data.lease_duration,
        expiresAt: new Date(Date.now() + (response.data.lease_duration * 1000))
      });
    } else if (secretPath.includes('/issue/')) {
      // Regenerate certificate
      const pathParts = secretPath.split('/');
      const pkiPath = pathParts[0];
      const roleName = pathParts[2];
      const commonName = pathParts[3];

      await this.generateCertificate(pkiPath, roleName, commonName);
    }
  }

  /**
   * Revoke a secret or lease
   */
  async revokeSecret(leaseId: string): Promise<void> {
    try {
      await this.client.put('/sys/leases/revoke', { lease_id: leaseId });
      
      this.emit('secret_revoked', {
        leaseId,
        timestamp: new Date()
      });
    } catch (error) {
      this.emit('secret_revocation_failed', {
        leaseId,
        error,
        timestamp: new Date()
      });
      throw error;
    }
  }

  /**
   * Batch rotate multiple secrets
   */
  async batchRotate(secretPaths: string[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    const rotationPromises = secretPaths.map(async (secretPath) => {
      try {
        await this.performRotation(secretPath);
        results.set(secretPath, true);
      } catch (error) {
        results.set(secretPath, false);
        this.emit('batch_rotation_error', {
          secretPath,
          error,
          timestamp: new Date()
        });
      }
    });

    await Promise.allSettled(rotationPromises);
    
    this.emit('batch_rotation_completed', {
      results,
      timestamp: new Date()
    });

    return results;
  }

  /**
   * Get secret rotation history
   */
  getRotationHistory(secretPath: string): SecretRotationEvent[] {
    return this.rotationHistory.get(secretPath) || [];
  }

  /**
   * Get all active secrets with their expiry information
   */
  getActiveSecrets(): Map<string, any> {
    const activeSecrets = new Map();
    
    for (const [path, secret] of this.secretCache.entries()) {
      if (secret.expiresAt > new Date()) {
        activeSecrets.set(path, {
          ...secret,
          timeToExpiry: secret.expiresAt.getTime() - Date.now()
        });
      }
    }
    
    return activeSecrets;
  }

  /**
   * Get secrets expiring soon
   */
  getExpiringSoon(thresholdMs: number = 3600000): Map<string, any> {
    const expiringSoon = new Map();
    const threshold = new Date(Date.now() + thresholdMs);
    
    for (const [path, secret] of this.secretCache.entries()) {
      if (secret.expiresAt <= threshold && secret.expiresAt > new Date()) {
        expiringSoon.set(path, {
          ...secret,
          timeToExpiry: secret.expiresAt.getTime() - Date.now()
        });
      }
    }
    
    return expiringSoon;
  }

  /**
   * Health check for Vault connectivity and token validity
   */
  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      const [healthResponse, tokenResponse] = await Promise.all([
        this.client.get('/sys/health'),
        this.client.get('/auth/token/lookup-self')
      ]);

      const tokenInfo = tokenResponse.data.data;
      const tokenExpiry = tokenInfo.expire_time ? new Date(tokenInfo.expire_time) : null;

      return {
        healthy: true,
        details: {
          vault: healthResponse.data,
          token: {
            valid: true,
            ttl: tokenInfo.ttl,
            renewable: tokenInfo.renewable,
            expiresAt: tokenExpiry,
            policies: tokenInfo.policies
          }
        }
      };
    } catch (error) {
      return {
        healthy: false,
        details: { error: (error as Error).message }
      };
    }
  }

  private addToRotationHistory(secretPath: string, event: SecretRotationEvent): void {
    if (!this.rotationHistory.has(secretPath)) {
      this.rotationHistory.set(secretPath, []);
    }
    
    const history = this.rotationHistory.get(secretPath)!;
    history.push(event);
    
    // Keep only last 50 events
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      const health = await this.healthCheck();
      this.emit('health_check', health);
      
      if (!health.healthy) {
        this.emit('vault_unhealthy', health);
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Cleanup and shutdown
   */
  destroy(): void {
    // Clear all rotation schedules
    for (const timeout of this.rotationSchedules.values()) {
      clearTimeout(timeout);
    }
    this.rotationSchedules.clear();

    // Clear health check interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Clear cache
    this.secretCache.clear();
    this.rotationHistory.clear();

    // Remove all listeners
    this.removeAllListeners();
  }
}

/**
 * Factory function to create a configured DynamicSecretsManager
 */
export function createDynamicSecretsManager(config: VaultConfig): DynamicSecretsManager {
  return new DynamicSecretsManager(config);
}

/**
 * Utility functions for secret management
 */
export const SecretUtils = {
  /**
   * Parse TTL string to milliseconds
   */
  parseTTL(ttl: string): number {
    const match = ttl.match(/^(\d+)([smhd])$/);
    if (!match) throw new Error(`Invalid TTL format: ${ttl}`);
    
    const [, value, unit] = match;
    const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    
    return parseInt(value) * multipliers[unit as keyof typeof multipliers];
  },

  /**
   * Format milliseconds to human-readable duration
   */
  formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  },

  /**
   * Validate secret path
   */
  validateSecretPath(path: string): boolean {
    return /^[a-zA-Z0-9/_-]+$/.test(path) && !path.includes('..') && path.length > 0;
  }
};