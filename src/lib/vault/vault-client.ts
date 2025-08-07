/**
 * Enterprise-grade HashiCorp Vault Client
 * Superior secret management implementation that surpasses Backstage's basic env vars
 */

import * as vault from 'node-vault';
import { EventEmitter } from 'events';
import { Logger } from '../monitoring/logger';
import crypto from 'crypto';
import { promisify } from 'util';
import * as https from 'https';

interface VaultConfig {
  endpoint: string;
  token?: string;
  namespace?: string;
  apiVersion?: string;
  requestTimeout?: number;
  caCert?: string;
  clientCert?: string;
  clientKey?: string;
  autoRenew?: boolean;
  renewThreshold?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

interface SecretEngineConfig {
  path: string;
  type: 'kv-v2' | 'database' | 'pki' | 'transit' | 'totp' | 'aws' | 'azure' | 'gcp' | 'ssh';
  config?: Record<string, any>;
}

interface DynamicCredential {
  username: string;
  password: string;
  leaseId: string;
  leaseDuration: number;
  renewable: boolean;
  expirationTime: Date;
}

interface EncryptionResult {
  ciphertext: string;
  keyVersion: number;
  nonce?: string;
}

interface PKICertificate {
  certificate: string;
  privateKey: string;
  certificateChain: string;
  caChain: string[];
  serialNumber: string;
  expiration: Date;
}

export class VaultClient extends EventEmitter {
  private client: any;
  private config: VaultConfig;
  private logger: Logger;
  private tokenRenewalTimer?: NodeJS.Timeout;
  private leaseRenewalTimers: Map<string, NodeJS.Timeout> = new Map();
  private secretCache: Map<string, { data: any; expiry: number }> = new Map();
  private metricsCollector: Map<string, number> = new Map();
  private isInitialized: boolean = false;

  constructor(config: VaultConfig) {
    super();
    this.config = {
      apiVersion: 'v1',
      requestTimeout: 5000,
      autoRenew: true,
      renewThreshold: 0.7,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config,
    };
    this.logger = new Logger('VaultClient');
    this.initializeClient();
  }

  private initializeClient(): void {
    const httpsAgent = new https.Agent({
      ca: this.config.caCert,
      cert: this.config.clientCert,
      key: this.config.clientKey,
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    });

    this.client = vault({
      endpoint: this.config.endpoint,
      token: this.config.token,
      apiVersion: this.config.apiVersion,
      namespace: this.config.namespace,
      requestOptions: {
        timeout: this.config.requestTimeout,
        agent: httpsAgent,
      },
    });

    if (this.config.autoRenew && this.config.token) {
      this.scheduleTokenRenewal();
    }

    this.isInitialized = true;
    this.emit('initialized');
  }

  /**
   * Initialize Vault with root token (first-time setup only)
   */
  async initialize(shares: number = 5, threshold: number = 3): Promise<{
    keys: string[];
    rootToken: string;
  }> {
    try {
      const result = await this.client.init({
        secret_shares: shares,
        secret_threshold: threshold,
        stored_shares: 0,
        recovery_shares: 0,
        recovery_threshold: 0,
      });

      this.logger.info('Vault initialized successfully');
      return {
        keys: result.keys,
        rootToken: result.root_token,
      };
    } catch (error) {
      this.logger.error('Failed to initialize Vault', error);
      throw error;
    }
  }

  /**
   * Unseal Vault using unseal keys
   */
  async unseal(keys: string[]): Promise<void> {
    try {
      for (const key of keys) {
        const result = await this.client.unseal({ key });
        if (!result.sealed) {
          this.logger.info('Vault unsealed successfully');
          break;
        }
      }
    } catch (error) {
      this.logger.error('Failed to unseal Vault', error);
      throw error;
    }
  }

  /**
   * KV v2 Secret Engine - Advanced key-value storage
   */
  async writeSecret(path: string, data: Record<string, any>, metadata?: Record<string, any>): Promise<void> {
    try {
      await this.retryOperation(async () => {
        await this.client.write(`secret/data/${path}`, {
          data,
          options: {
            cas: 0, // Check-and-set for concurrent access control
          },
          metadata,
        });
      });

      this.logger.info(`Secret written to path: ${path}`);
      this.invalidateCache(path);
      this.recordMetric('secrets_written', 1);
    } catch (error) {
      this.logger.error(`Failed to write secret to ${path}`, error);
      throw error;
    }
  }

  async readSecret(path: string, version?: number): Promise<Record<string, any>> {
    const cacheKey = `${path}:${version || 'latest'}`;
    
    // Check cache first
    const cached = this.secretCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      this.recordMetric('cache_hits', 1);
      return cached.data;
    }

    try {
      const result = await this.retryOperation(async () => {
        const versionPath = version ? `?version=${version}` : '';
        return await this.client.read(`secret/data/${path}${versionPath}`);
      });

      const secretData = result.data.data;
      
      // Cache with 5-minute TTL
      this.secretCache.set(cacheKey, {
        data: secretData,
        expiry: Date.now() + 300000,
      });

      this.recordMetric('secrets_read', 1);
      return secretData;
    } catch (error) {
      this.logger.error(`Failed to read secret from ${path}`, error);
      throw error;
    }
  }

  async deleteSecret(path: string, versions?: number[]): Promise<void> {
    try {
      if (versions) {
        await this.client.delete(`secret/delete/${path}`, { versions });
      } else {
        await this.client.delete(`secret/metadata/${path}`);
      }
      
      this.logger.info(`Secret deleted from path: ${path}`);
      this.invalidateCache(path);
    } catch (error) {
      this.logger.error(`Failed to delete secret from ${path}`, error);
      throw error;
    }
  }

  /**
   * Database Secret Engine - Dynamic database credentials
   */
  async configureDatabaseEngine(config: {
    name: string;
    plugin: 'postgresql-database-plugin' | 'mysql-database-plugin' | 'mongodb-database-plugin';
    connectionUrl: string;
    username: string;
    password: string;
    maxOpenConnections?: number;
    maxIdleConnections?: number;
    maxConnectionLifetime?: string;
  }): Promise<void> {
    try {
      await this.client.write(`database/config/${config.name}`, {
        plugin_name: config.plugin,
        connection_url: config.connectionUrl,
        allowed_roles: ['*'],
        username: config.username,
        password: config.password,
        max_open_connections: config.maxOpenConnections || 4,
        max_idle_connections: config.maxIdleConnections || 0,
        max_connection_lifetime: config.maxConnectionLifetime || '0s',
      });

      this.logger.info(`Database engine configured: ${config.name}`);
    } catch (error) {
      this.logger.error('Failed to configure database engine', error);
      throw error;
    }
  }

  async createDatabaseRole(roleName: string, config: {
    dbName: string;
    creationStatements: string[];
    defaultTTL?: string;
    maxTTL?: string;
  }): Promise<void> {
    try {
      await this.client.write(`database/roles/${roleName}`, {
        db_name: config.dbName,
        creation_statements: config.creationStatements,
        default_ttl: config.defaultTTL || '1h',
        max_ttl: config.maxTTL || '24h',
      });

      this.logger.info(`Database role created: ${roleName}`);
    } catch (error) {
      this.logger.error(`Failed to create database role: ${roleName}`, error);
      throw error;
    }
  }

  async getDynamicDatabaseCredentials(roleName: string): Promise<DynamicCredential> {
    try {
      const result = await this.client.read(`database/creds/${roleName}`);
      
      const credential: DynamicCredential = {
        username: result.data.username,
        password: result.data.password,
        leaseId: result.lease_id,
        leaseDuration: result.lease_duration,
        renewable: result.renewable,
        expirationTime: new Date(Date.now() + result.lease_duration * 1000),
      };

      // Schedule automatic renewal
      if (credential.renewable && this.config.autoRenew) {
        this.scheduleLeaseRenewal(credential.leaseId, credential.leaseDuration);
      }

      this.recordMetric('dynamic_credentials_generated', 1);
      return credential;
    } catch (error) {
      this.logger.error(`Failed to get dynamic credentials for role: ${roleName}`, error);
      throw error;
    }
  }

  /**
   * PKI Secret Engine - Certificate management
   */
  async configurePKIEngine(config: {
    mountPath?: string;
    maxLeaseTTL?: string;
    defaultLeaseTTL?: string;
  }): Promise<void> {
    const mountPath = config.mountPath || 'pki';
    
    try {
      // Enable PKI engine
      await this.client.mount({
        mount_point: mountPath,
        type: 'pki',
        config: {
          max_lease_ttl: config.maxLeaseTTL || '87600h', // 10 years
          default_lease_ttl: config.defaultLeaseTTL || '8760h', // 1 year
        },
      });

      this.logger.info(`PKI engine mounted at: ${mountPath}`);
    } catch (error) {
      this.logger.error('Failed to configure PKI engine', error);
      throw error;
    }
  }

  async generateRootCA(config: {
    commonName: string;
    ttl?: string;
    organization?: string;
    country?: string;
  }): Promise<PKICertificate> {
    try {
      const result = await this.client.write('pki/root/generate/internal', {
        common_name: config.commonName,
        ttl: config.ttl || '87600h',
        organization: config.organization,
        country: config.country,
        key_type: 'rsa',
        key_bits: 4096,
      });

      return {
        certificate: result.data.certificate,
        privateKey: result.data.private_key,
        certificateChain: result.data.certificate,
        caChain: [result.data.certificate],
        serialNumber: result.data.serial_number,
        expiration: new Date(result.data.expiration * 1000),
      };
    } catch (error) {
      this.logger.error('Failed to generate root CA', error);
      throw error;
    }
  }

  async issueCertificate(config: {
    roleName: string;
    commonName: string;
    altNames?: string[];
    ttl?: string;
  }): Promise<PKICertificate> {
    try {
      const result = await this.client.write(`pki/issue/${config.roleName}`, {
        common_name: config.commonName,
        alt_names: config.altNames?.join(','),
        ttl: config.ttl || '720h',
      });

      return {
        certificate: result.data.certificate,
        privateKey: result.data.private_key,
        certificateChain: result.data.certificate_chain,
        caChain: result.data.ca_chain,
        serialNumber: result.data.serial_number,
        expiration: new Date(result.data.expiration * 1000),
      };
    } catch (error) {
      this.logger.error('Failed to issue certificate', error);
      throw error;
    }
  }

  /**
   * Transit Secret Engine - Encryption as a service
   */
  async configureTransitEngine(): Promise<void> {
    try {
      await this.client.mount({
        mount_point: 'transit',
        type: 'transit',
      });

      this.logger.info('Transit engine configured');
    } catch (error) {
      this.logger.error('Failed to configure transit engine', error);
      throw error;
    }
  }

  async createEncryptionKey(keyName: string, config?: {
    type?: 'aes128-gcm96' | 'aes256-gcm96' | 'chacha20-poly1305' | 'rsa-2048' | 'rsa-4096';
    derived?: boolean;
    convergentEncryption?: boolean;
    exportable?: boolean;
    allowPlaintextBackup?: boolean;
  }): Promise<void> {
    try {
      await this.client.write(`transit/keys/${keyName}`, {
        type: config?.type || 'aes256-gcm96',
        derived: config?.derived || false,
        convergent_encryption: config?.convergentEncryption || false,
        exportable: config?.exportable || false,
        allow_plaintext_backup: config?.allowPlaintextBackup || false,
      });

      this.logger.info(`Encryption key created: ${keyName}`);
    } catch (error) {
      this.logger.error(`Failed to create encryption key: ${keyName}`, error);
      throw error;
    }
  }

  async encrypt(keyName: string, plaintext: string, context?: string): Promise<EncryptionResult> {
    try {
      const base64Plaintext = Buffer.from(plaintext).toString('base64');
      
      const result = await this.client.write(`transit/encrypt/${keyName}`, {
        plaintext: base64Plaintext,
        context: context ? Buffer.from(context).toString('base64') : undefined,
      });

      this.recordMetric('encryption_operations', 1);
      
      return {
        ciphertext: result.data.ciphertext,
        keyVersion: result.data.key_version || 1,
      };
    } catch (error) {
      this.logger.error('Encryption failed', error);
      throw error;
    }
  }

  async decrypt(keyName: string, ciphertext: string, context?: string): Promise<string> {
    try {
      const result = await this.client.write(`transit/decrypt/${keyName}`, {
        ciphertext,
        context: context ? Buffer.from(context).toString('base64') : undefined,
      });

      this.recordMetric('decryption_operations', 1);
      
      return Buffer.from(result.data.plaintext, 'base64').toString();
    } catch (error) {
      this.logger.error('Decryption failed', error);
      throw error;
    }
  }

  /**
   * TOTP Secret Engine - Time-based one-time passwords
   */
  async configureTOTPEngine(): Promise<void> {
    try {
      await this.client.mount({
        mount_point: 'totp',
        type: 'totp',
      });

      this.logger.info('TOTP engine configured');
    } catch (error) {
      this.logger.error('Failed to configure TOTP engine', error);
      throw error;
    }
  }

  async createTOTPKey(keyName: string, config: {
    issuer: string;
    accountName: string;
    period?: number;
    algorithm?: 'SHA1' | 'SHA256' | 'SHA512';
    digits?: number;
    skew?: number;
  }): Promise<{ url: string; key: string }> {
    try {
      const result = await this.client.write(`totp/keys/${keyName}`, {
        issuer: config.issuer,
        account_name: config.accountName,
        period: config.period || 30,
        algorithm: config.algorithm || 'SHA256',
        digits: config.digits || 6,
        skew: config.skew || 1,
        generate: true,
      });

      return {
        url: result.data.url,
        key: result.data.key,
      };
    } catch (error) {
      this.logger.error(`Failed to create TOTP key: ${keyName}`, error);
      throw error;
    }
  }

  async generateTOTPCode(keyName: string): Promise<string> {
    try {
      const result = await this.client.read(`totp/code/${keyName}`);
      return result.data.code;
    } catch (error) {
      this.logger.error(`Failed to generate TOTP code for: ${keyName}`, error);
      throw error;
    }
  }

  async validateTOTPCode(keyName: string, code: string): Promise<boolean> {
    try {
      const result = await this.client.write(`totp/code/${keyName}`, { code });
      return result.data.valid;
    } catch (error) {
      this.logger.error('TOTP validation failed', error);
      return false;
    }
  }

  /**
   * Kubernetes Auth Method
   */
  async configureKubernetesAuth(config: {
    kubernetesHost: string;
    kubernetesCACert: string;
    tokenReviewerJWT?: string;
  }): Promise<void> {
    try {
      await this.client.write('auth/kubernetes/config', {
        kubernetes_host: config.kubernetesHost,
        kubernetes_ca_cert: config.kubernetesCACert,
        token_reviewer_jwt: config.tokenReviewerJWT,
      });

      this.logger.info('Kubernetes auth configured');
    } catch (error) {
      this.logger.error('Failed to configure Kubernetes auth', error);
      throw error;
    }
  }

  async createKubernetesRole(roleName: string, config: {
    boundServiceAccountNames: string[];
    boundServiceAccountNamespaces: string[];
    policies: string[];
    ttl?: string;
  }): Promise<void> {
    try {
      await this.client.write(`auth/kubernetes/role/${roleName}`, {
        bound_service_account_names: config.boundServiceAccountNames,
        bound_service_account_namespaces: config.boundServiceAccountNamespaces,
        policies: config.policies,
        ttl: config.ttl || '1h',
      });

      this.logger.info(`Kubernetes role created: ${roleName}`);
    } catch (error) {
      this.logger.error(`Failed to create Kubernetes role: ${roleName}`, error);
      throw error;
    }
  }

  /**
   * Policy Management
   */
  async createPolicy(name: string, policy: string): Promise<void> {
    try {
      await this.client.write(`sys/policies/acl/${name}`, { policy });
      this.logger.info(`Policy created: ${name}`);
    } catch (error) {
      this.logger.error(`Failed to create policy: ${name}`, error);
      throw error;
    }
  }

  /**
   * Audit Management
   */
  async enableAudit(path: string, type: 'file' | 'syslog' | 'socket', options: Record<string, any>): Promise<void> {
    try {
      await this.client.write(`sys/audit/${path}`, {
        type,
        options,
      });
      
      this.logger.info(`Audit device enabled: ${path}`);
    } catch (error) {
      this.logger.error(`Failed to enable audit device: ${path}`, error);
      throw error;
    }
  }

  /**
   * Token Management
   */
  private async scheduleTokenRenewal(): Promise<void> {
    try {
      const tokenInfo = await this.client.tokenLookupSelf();
      const ttl = tokenInfo.data.ttl;
      
      if (ttl > 0) {
        const renewTime = ttl * this.config.renewThreshold! * 1000;
        
        this.tokenRenewalTimer = setTimeout(async () => {
          try {
            await this.client.tokenRenewSelf();
            this.logger.info('Token renewed successfully');
            this.scheduleTokenRenewal(); // Reschedule
          } catch (error) {
            this.logger.error('Token renewal failed', error);
            this.emit('token-renewal-failed', error);
          }
        }, renewTime);
      }
    } catch (error) {
      this.logger.error('Failed to schedule token renewal', error);
    }
  }

  private scheduleLeaseRenewal(leaseId: string, leaseDuration: number): void {
    const renewTime = leaseDuration * this.config.renewThreshold! * 1000;
    
    const timer = setTimeout(async () => {
      try {
        await this.client.leaseRenew(leaseId);
        this.logger.info(`Lease renewed: ${leaseId}`);
        
        // Get new lease duration and reschedule
        const leaseInfo = await this.client.write('sys/leases/lookup', { lease_id: leaseId });
        this.scheduleLeaseRenewal(leaseId, leaseInfo.data.ttl);
      } catch (error) {
        this.logger.error(`Lease renewal failed for: ${leaseId}`, error);
        this.emit('lease-renewal-failed', { leaseId, error });
        this.leaseRenewalTimers.delete(leaseId);
      }
    }, renewTime);
    
    // Clean up old timer if exists
    const oldTimer = this.leaseRenewalTimers.get(leaseId);
    if (oldTimer) {
      clearTimeout(oldTimer);
    }
    
    this.leaseRenewalTimers.set(leaseId, timer);
  }

  /**
   * Helper Methods
   */
  private async retryOperation<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: any;
    
    for (let i = 0; i < this.config.retryAttempts!; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (i < this.config.retryAttempts! - 1) {
          await this.sleep(this.config.retryDelay! * Math.pow(2, i));
        }
      }
    }
    
    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private invalidateCache(path: string): void {
    for (const [key] of this.secretCache) {
      if (key.startsWith(path)) {
        this.secretCache.delete(key);
      }
    }
  }

  private recordMetric(metric: string, value: number): void {
    const current = this.metricsCollector.get(metric) || 0;
    this.metricsCollector.set(metric, current + value);
  }

  /**
   * Get metrics
   */
  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.metricsCollector);
  }

  /**
   * Cleanup
   */
  async destroy(): Promise<void> {
    if (this.tokenRenewalTimer) {
      clearTimeout(this.tokenRenewalTimer);
    }
    
    for (const timer of this.leaseRenewalTimers.values()) {
      clearTimeout(timer);
    }
    
    this.leaseRenewalTimers.clear();
    this.secretCache.clear();
    this.removeAllListeners();
  }
}

export default VaultClient;