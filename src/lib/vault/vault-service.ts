/**
 * Vault Service - Production-ready secret management service
 * Integrates HashiCorp Vault with the developer portal
 */

import { VaultClient } from './vault-client';
import { Logger } from '../monitoring/logger';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';

interface VaultServiceConfig {
  endpoint: string;
  token?: string;
  roleId?: string;
  secretId?: string;
  namespace?: string;
  caCertPath?: string;
  clientCertPath?: string;
  clientKeyPath?: string;
  autoInit?: boolean;
  unsealKeys?: string[];
}

interface SecretRotationConfig {
  path: string;
  rotationInterval: number; // in milliseconds
  rotationFunction: () => Promise<Record<string, any>>;
  notificationChannels?: string[];
}

interface SecretPolicy {
  name: string;
  rules: string;
  description?: string;
}

interface SecretTemplate {
  name: string;
  engine: string;
  config: Record<string, any>;
  policies?: string[];
}

export class VaultService extends EventEmitter {
  private client: VaultClient;
  private logger: Logger;
  private config: VaultServiceConfig;
  private rotationSchedules: Map<string, NodeJS.Timeout> = new Map();
  private secretWatchers: Map<string, Set<(data: any) => void>> = new Map();
  private healthCheckTimer?: NodeJS.Timeout;
  private isHealthy: boolean = false;
  private secretVersions: Map<string, number> = new Map();

  constructor(config: VaultServiceConfig) {
    super();
    this.config = config;
    this.logger = new Logger('VaultService');
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Load certificates if paths provided
      const caCert = this.config.caCertPath 
        ? await fs.readFile(this.config.caCertPath, 'utf-8')
        : undefined;
      const clientCert = this.config.clientCertPath
        ? await fs.readFile(this.config.clientCertPath, 'utf-8')
        : undefined;
      const clientKey = this.config.clientKeyPath
        ? await fs.readFile(this.config.clientKeyPath, 'utf-8')
        : undefined;

      // Initialize Vault client
      this.client = new VaultClient({
        endpoint: this.config.endpoint,
        token: this.config.token,
        namespace: this.config.namespace,
        caCert,
        clientCert,
        clientKey,
        autoRenew: true,
        renewThreshold: 0.7,
      });

      // Authenticate using AppRole if configured
      if (this.config.roleId && this.config.secretId) {
        await this.authenticateWithAppRole();
      }

      // Auto-unseal if keys provided
      if (this.config.autoInit && this.config.unsealKeys) {
        await this.autoUnseal();
      }

      // Start health monitoring
      this.startHealthMonitoring();

      this.logger.info('Vault service initialized successfully');
      this.emit('initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Vault service', error);
      throw error;
    }
  }

  /**
   * AppRole Authentication
   */
  private async authenticateWithAppRole(): Promise<void> {
    try {
      const response = await fetch(`${this.config.endpoint}/v1/auth/approle/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role_id: this.config.roleId,
          secret_id: this.config.secretId,
        }),
      });

      const data = await response.json();
      this.config.token = data.auth.client_token;
      
      // Reinitialize client with new token
      await this.initialize();
      
      this.logger.info('Authenticated with AppRole successfully');
    } catch (error) {
      this.logger.error('AppRole authentication failed', error);
      throw error;
    }
  }

  /**
   * Auto-unseal Vault
   */
  private async autoUnseal(): Promise<void> {
    if (!this.config.unsealKeys || this.config.unsealKeys.length === 0) {
      return;
    }

    try {
      await this.client.unseal(this.config.unsealKeys);
      this.logger.info('Vault auto-unsealed successfully');
    } catch (error) {
      this.logger.error('Auto-unseal failed', error);
      throw error;
    }
  }

  /**
   * Health Monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(async () => {
      try {
        const response = await fetch(`${this.config.endpoint}/v1/sys/health`);
        this.isHealthy = response.ok;
        
        if (!this.isHealthy) {
          this.emit('unhealthy', { status: response.status });
          this.logger.warn(`Vault health check failed: ${response.status}`);
        }
      } catch (error) {
        this.isHealthy = false;
        this.emit('unhealthy', { error });
        this.logger.error('Vault health check error', error);
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Application Secrets Management
   */
  async getApplicationSecret(appName: string, environment: string): Promise<Record<string, any>> {
    const path = `apps/${appName}/${environment}`;
    
    try {
      const secret = await this.client.readSecret(path);
      this.emit('secret-accessed', { appName, environment });
      return secret;
    } catch (error) {
      this.logger.error(`Failed to get secret for ${appName}/${environment}`, error);
      throw error;
    }
  }

  async setApplicationSecret(
    appName: string,
    environment: string,
    secrets: Record<string, any>,
    metadata?: Record<string, any>
  ): Promise<void> {
    const path = `apps/${appName}/${environment}`;
    
    try {
      await this.client.writeSecret(path, secrets, {
        ...metadata,
        app: appName,
        environment,
        created_by: 'vault-service',
        created_at: new Date().toISOString(),
      });
      
      this.emit('secret-updated', { appName, environment });
      this.notifyWatchers(path, secrets);
    } catch (error) {
      this.logger.error(`Failed to set secret for ${appName}/${environment}`, error);
      throw error;
    }
  }

  /**
   * Database Credentials Management
   */
  async setupDatabaseCredentialRotation(dbName: string, config: {
    plugin: 'postgresql' | 'mysql' | 'mongodb';
    connectionUrl: string;
    username: string;
    password: string;
    rotationPeriod?: string;
  }): Promise<void> {
    try {
      // Configure database engine
      await this.client.configureDatabaseEngine({
        name: dbName,
        plugin: `${config.plugin}-database-plugin` as any,
        connectionUrl: config.connectionUrl,
        username: config.username,
        password: config.password,
      });

      // Create rotation role
      await this.client.createDatabaseRole(`${dbName}-rotate`, {
        dbName,
        creationStatements: this.getDatabaseCreationStatements(config.plugin),
        defaultTTL: config.rotationPeriod || '1h',
        maxTTL: '24h',
      });

      this.logger.info(`Database credential rotation configured for: ${dbName}`);
    } catch (error) {
      this.logger.error(`Failed to setup database rotation for: ${dbName}`, error);
      throw error;
    }
  }

  private getDatabaseCreationStatements(plugin: string): string[] {
    switch (plugin) {
      case 'postgresql':
        return [
          'CREATE USER "{{name}}" WITH PASSWORD \'{{password}}\' VALID UNTIL \'{{expiration}}\';',
          'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "{{name}}";',
        ];
      case 'mysql':
        return [
          'CREATE USER \'{{name}}\'@\'%\' IDENTIFIED BY \'{{password}}\';',
          'GRANT SELECT, INSERT, UPDATE, DELETE ON *.* TO \'{{name}}\'@\'%\';',
        ];
      case 'mongodb':
        return [
          '{ "db": "admin", "roles": [{"role": "readWrite", "db": "{{name}}"}] }',
        ];
      default:
        throw new Error(`Unsupported database plugin: ${plugin}`);
    }
  }

  async getDatabaseCredentials(dbName: string): Promise<{
    username: string;
    password: string;
    connectionString: string;
  }> {
    try {
      const creds = await this.client.getDynamicDatabaseCredentials(`${dbName}-rotate`);
      
      // Build connection string
      const connectionString = this.buildConnectionString(dbName, creds.username, creds.password);
      
      return {
        username: creds.username,
        password: creds.password,
        connectionString,
      };
    } catch (error) {
      this.logger.error(`Failed to get database credentials for: ${dbName}`, error);
      throw error;
    }
  }

  private buildConnectionString(dbName: string, username: string, password: string): string {
    // This would be customized based on your actual database configurations
    const dbConfig = this.getDatabaseConfig(dbName);
    
    switch (dbConfig.type) {
      case 'postgresql':
        return `postgresql://${username}:${password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;
      case 'mysql':
        return `mysql://${username}:${password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;
      case 'mongodb':
        return `mongodb://${username}:${password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;
      default:
        throw new Error(`Unknown database type: ${dbConfig.type}`);
    }
  }

  private getDatabaseConfig(dbName: string): any {
    // This would fetch from your configuration
    return {
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: dbName,
    };
  }

  /**
   * PKI Certificate Management
   */
  async issueTLSCertificate(config: {
    serviceName: string;
    commonName: string;
    altNames?: string[];
    ttl?: string;
  }): Promise<{
    certificate: string;
    privateKey: string;
    caChain: string[];
  }> {
    try {
      const cert = await this.client.issueCertificate({
        roleName: 'service-cert',
        commonName: config.commonName,
        altNames: config.altNames,
        ttl: config.ttl || '720h', // 30 days default
      });

      // Store certificate metadata
      await this.client.writeSecret(`pki/issued/${config.serviceName}`, {
        serial_number: cert.serialNumber,
        common_name: config.commonName,
        expiration: cert.expiration.toISOString(),
        issued_at: new Date().toISOString(),
      });

      return {
        certificate: cert.certificate,
        privateKey: cert.privateKey,
        caChain: cert.caChain,
      };
    } catch (error) {
      this.logger.error(`Failed to issue certificate for: ${config.serviceName}`, error);
      throw error;
    }
  }

  /**
   * Encryption as a Service
   */
  async encryptData(keyName: string, data: any, context?: string): Promise<string> {
    try {
      const plaintext = typeof data === 'string' ? data : JSON.stringify(data);
      const result = await this.client.encrypt(keyName, plaintext, context);
      return result.ciphertext;
    } catch (error) {
      this.logger.error('Failed to encrypt data', error);
      throw error;
    }
  }

  async decryptData(keyName: string, ciphertext: string, context?: string): Promise<any> {
    try {
      const plaintext = await this.client.decrypt(keyName, ciphertext, context);
      
      try {
        return JSON.parse(plaintext);
      } catch {
        return plaintext;
      }
    } catch (error) {
      this.logger.error('Failed to decrypt data', error);
      throw error;
    }
  }

  /**
   * Secret Rotation Management
   */
  async scheduleSecretRotation(config: SecretRotationConfig): Promise<void> {
    const rotationId = this.generateRotationId(config.path);
    
    // Clear existing rotation if any
    this.cancelSecretRotation(config.path);
    
    const rotate = async () => {
      try {
        this.logger.info(`Rotating secret at path: ${config.path}`);
        
        // Generate new secret
        const newSecret = await config.rotationFunction();
        
        // Write new secret
        await this.client.writeSecret(config.path, newSecret, {
          rotated_at: new Date().toISOString(),
          rotation_version: (this.secretVersions.get(config.path) || 0) + 1,
        });
        
        // Update version counter
        this.secretVersions.set(config.path, (this.secretVersions.get(config.path) || 0) + 1);
        
        // Notify
        this.emit('secret-rotated', { path: config.path, version: this.secretVersions.get(config.path) });
        
        // Notify configured channels
        if (config.notificationChannels) {
          await this.notifyRotation(config.path, config.notificationChannels);
        }
        
        this.logger.info(`Secret rotated successfully at path: ${config.path}`);
      } catch (error) {
        this.logger.error(`Secret rotation failed for path: ${config.path}`, error);
        this.emit('rotation-failed', { path: config.path, error });
      }
    };
    
    // Execute immediately
    await rotate();
    
    // Schedule periodic rotation
    const timer = setInterval(rotate, config.rotationInterval);
    this.rotationSchedules.set(rotationId, timer);
  }

  cancelSecretRotation(path: string): void {
    const rotationId = this.generateRotationId(path);
    const timer = this.rotationSchedules.get(rotationId);
    
    if (timer) {
      clearInterval(timer);
      this.rotationSchedules.delete(rotationId);
      this.logger.info(`Secret rotation cancelled for path: ${path}`);
    }
  }

  private generateRotationId(path: string): string {
    return createHash('sha256').update(path).digest('hex');
  }

  private async notifyRotation(path: string, channels: string[]): Promise<void> {
    // Implement notification logic (Slack, email, etc.)
    for (const channel of channels) {
      this.logger.info(`Notifying ${channel} about secret rotation at ${path}`);
      // Actual notification implementation would go here
    }
  }

  /**
   * Secret Watching
   */
  watchSecret(path: string, callback: (data: any) => void): () => void {
    const watchers = this.secretWatchers.get(path) || new Set();
    watchers.add(callback);
    this.secretWatchers.set(path, watchers);
    
    // Return unwatch function
    return () => {
      watchers.delete(callback);
      if (watchers.size === 0) {
        this.secretWatchers.delete(path);
      }
    };
  }

  private notifyWatchers(path: string, data: any): void {
    const watchers = this.secretWatchers.get(path);
    if (watchers) {
      watchers.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          this.logger.error(`Watcher callback error for path ${path}`, error);
        }
      });
    }
  }

  /**
   * Compliance and Governance
   */
  async createSecretPolicy(policy: SecretPolicy): Promise<void> {
    try {
      await this.client.createPolicy(policy.name, policy.rules);
      
      // Store policy metadata
      await this.client.writeSecret(`policies/metadata/${policy.name}`, {
        description: policy.description,
        created_at: new Date().toISOString(),
        created_by: 'vault-service',
      });
      
      this.logger.info(`Policy created: ${policy.name}`);
    } catch (error) {
      this.logger.error(`Failed to create policy: ${policy.name}`, error);
      throw error;
    }
  }

  async applySecretTemplate(template: SecretTemplate): Promise<void> {
    try {
      // Create policies if specified
      if (template.policies) {
        for (const policyName of template.policies) {
          const policy = await this.getDefaultPolicy(policyName);
          await this.createSecretPolicy(policy);
        }
      }
      
      // Configure secret engine based on template
      switch (template.engine) {
        case 'kv-v2':
          // KV engine is usually pre-configured
          break;
        case 'database':
          await this.client.configureDatabaseEngine(template.config as any);
          break;
        case 'pki':
          await this.client.configurePKIEngine(template.config);
          break;
        case 'transit':
          await this.client.configureTransitEngine();
          break;
        case 'totp':
          await this.client.configureTOTPEngine();
          break;
        default:
          throw new Error(`Unknown engine type: ${template.engine}`);
      }
      
      this.logger.info(`Secret template applied: ${template.name}`);
    } catch (error) {
      this.logger.error(`Failed to apply template: ${template.name}`, error);
      throw error;
    }
  }

  private async getDefaultPolicy(policyName: string): Promise<SecretPolicy> {
    // Return default policies based on name
    const policies: Record<string, SecretPolicy> = {
      'read-only': {
        name: 'read-only',
        rules: `
          path "secret/data/*" {
            capabilities = ["read", "list"]
          }
        `,
        description: 'Read-only access to secrets',
      },
      'developer': {
        name: 'developer',
        rules: `
          path "secret/data/apps/{{identity.entity.aliases.auth_kubernetes_*.metadata.service_account_namespace}}/*" {
            capabilities = ["create", "read", "update", "delete", "list"]
          }
          path "database/creds/{{identity.entity.aliases.auth_kubernetes_*.metadata.service_account_namespace}}-*" {
            capabilities = ["read"]
          }
        `,
        description: 'Developer access to namespace secrets',
      },
      'admin': {
        name: 'admin',
        rules: `
          path "*" {
            capabilities = ["create", "read", "update", "delete", "list", "sudo"]
          }
        `,
        description: 'Full administrative access',
      },
    };
    
    return policies[policyName] || {
      name: policyName,
      rules: '',
      description: 'Custom policy',
    };
  }

  /**
   * Metrics and Monitoring
   */
  getMetrics(): Record<string, any> {
    return {
      ...this.client.getMetrics(),
      health: this.isHealthy,
      activeRotations: this.rotationSchedules.size,
      watchedSecrets: this.secretWatchers.size,
    };
  }

  /**
   * Cleanup
   */
  async destroy(): Promise<void> {
    // Clear all timers
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    for (const timer of this.rotationSchedules.values()) {
      clearInterval(timer);
    }
    
    this.rotationSchedules.clear();
    this.secretWatchers.clear();
    
    await this.client.destroy();
    this.removeAllListeners();
    
    this.logger.info('Vault service destroyed');
  }
}

export default VaultService;