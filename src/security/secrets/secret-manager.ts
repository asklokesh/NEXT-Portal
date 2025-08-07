/**
 * Secret Management System
 * Provides secure secret storage, encryption, and lifecycle management
 * Integrates with external secret managers and implements zero-trust principles
 */

import { randomBytes, createCipher, createDecipher, createHash, scrypt, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { AuditLogger } from '../logging/audit-logger';
import { RBACSystem } from '../auth/rbac-system';

// External secret manager interfaces
export interface ExternalSecretManager {
  type: 'vault' | 'aws' | 'azure' | 'gcp';
  config: Record<string, any>;
  isAvailable(): Promise<boolean>;
  getSecret(key: string): Promise<string>;
  setSecret(key: string, value: string, metadata?: Record<string, any>): Promise<void>;
  deleteSecret(key: string): Promise<void>;
  listSecrets(): Promise<string[]>;
  rotateSecret(key: string): Promise<void>;
}

// Schema definitions
export const SecretSchema = z.object({
  secretId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  type: z.enum(['password', 'api_key', 'certificate', 'private_key', 'connection_string', 'token', 'custom']),
  category: z.enum(['database', 'api', 'oauth', 'encryption', 'signing', 'infrastructure', 'application']),
  encryptedValue: z.string(),
  encryptionKeyId: z.string(),
  metadata: z.record(z.any()),
  tags: z.array(z.string()),
  accessPolicy: z.object({
    allowedServices: z.array(z.string()),
    allowedEnvironments: z.array(z.enum(['development', 'staging', 'production'])),
    requiresMFA: z.boolean(),
    maxAccessCount: z.number().optional(),
    allowedTimeWindows: z.array(z.object({
      startTime: z.string(),
      endTime: z.string(),
      timezone: z.string()
    })).optional()
  }),
  lifecycle: z.object({
    createdAt: z.date(),
    updatedAt: z.date(),
    expiresAt: z.date().optional(),
    lastAccessedAt: z.date().optional(),
    accessCount: z.number().default(0),
    rotationInterval: z.number().optional(), // days
    nextRotation: z.date().optional(),
    autoRotate: z.boolean().default(false)
  }),
  version: z.number().default(1),
  status: z.enum(['active', 'expired', 'revoked', 'rotating']),
  ownerService: z.string(),
  createdBy: z.string(),
  isActive: z.boolean(),
  compliance: z.object({
    classification: z.enum(['public', 'internal', 'confidential', 'restricted']),
    retentionPeriod: z.number().optional(), // days
    jurisdiction: z.string().optional(),
    encryptionRequired: z.boolean(),
    auditRequired: z.boolean()
  })
});

export const EncryptionKeySchema = z.object({
  keyId: z.string().uuid(),
  algorithm: z.enum(['AES-256-GCM', 'ChaCha20-Poly1305', 'RSA-4096']),
  purpose: z.enum(['secret_encryption', 'data_encryption', 'key_encryption']),
  encryptedKey: z.string(),
  salt: z.string(),
  iv: z.string(),
  status: z.enum(['active', 'deprecated', 'revoked']),
  createdAt: z.date(),
  expiresAt: z.date().optional(),
  rotationSchedule: z.object({
    interval: z.number(), // days
    nextRotation: z.date()
  }).optional(),
  metadata: z.record(z.any())
});

export const SecretAccessRequestSchema = z.object({
  requestId: z.string().uuid(),
  secretId: z.string().uuid(),
  requestedBy: z.string(),
  serviceId: z.string(),
  purpose: z.string(),
  environment: z.enum(['development', 'staging', 'production']),
  requestedAt: z.date(),
  approvedBy: z.string().optional(),
  approvedAt: z.date().optional(),
  status: z.enum(['pending', 'approved', 'denied', 'expired']),
  justification: z.string(),
  temporaryAccess: z.object({
    startTime: z.date(),
    endTime: z.date(),
    maxAccessCount: z.number()
  }).optional(),
  metadata: z.record(z.any())
});

export type Secret = z.infer<typeof SecretSchema>;
export type EncryptionKey = z.infer<typeof EncryptionKeySchema>;
export type SecretAccessRequest = z.infer<typeof SecretAccessRequestSchema>;

export interface SecretOperationContext {
  userId: string;
  serviceId: string;
  operation: 'read' | 'write' | 'delete' | 'rotate';
  environment: 'development' | 'staging' | 'production';
  clientIP?: string;
  userAgent?: string;
  requestId: string;
  timestamp: Date;
}

export interface SecretScanResult {
  scanId: string;
  timestamp: Date;
  secretsFound: {
    secretId: string;
    location: string;
    type: 'hardcoded' | 'configuration' | 'environment' | 'log';
    severity: 'low' | 'medium' | 'high' | 'critical';
    recommendation: string;
  }[];
  summary: {
    totalFiles: number;
    totalSecrets: number;
    criticalSecrets: number;
    complianceScore: number;
  };
}

export class SecretManager {
  private secrets: Map<string, Secret> = new Map();
  private encryptionKeys: Map<string, EncryptionKey> = new Map();
  private accessRequests: Map<string, SecretAccessRequest> = new Map();
  private auditLogger: AuditLogger;
  private rbacSystem: RBACSystem;
  private externalManagers: Map<string, ExternalSecretManager> = new Map();
  private masterKey: Buffer;
  private keyDerivationSalt: Buffer;

  constructor(masterKey?: string) {
    this.auditLogger = new AuditLogger();
    this.rbacSystem = new RBACSystem();
    
    // Initialize master key
    if (masterKey) {
      this.masterKey = Buffer.from(masterKey, 'hex');
    } else {
      this.masterKey = randomBytes(32);
    }
    this.keyDerivationSalt = randomBytes(16);

    this.initializeDefaultEncryptionKeys();
  }

  /**
   * Create a new secret
   */
  async createSecret(
    secretData: Omit<Secret, 'secretId' | 'encryptedValue' | 'encryptionKeyId' | 'lifecycle' | 'version' | 'isActive'>,
    plainValue: string,
    context: SecretOperationContext
  ): Promise<Secret> {
    // Check permissions
    const hasPermission = await this.checkPermission(context, 'secret', 'create');
    if (!hasPermission) {
      throw new Error('Permission denied: cannot create secrets');
    }

    // Validate secret data
    const secretId = crypto.randomUUID();
    const encryptionKeyId = await this.getActiveEncryptionKey();
    const encryptedValue = await this.encryptSecret(plainValue, encryptionKeyId);

    const secret: Secret = {
      secretId,
      ...secretData,
      encryptedValue,
      encryptionKeyId,
      lifecycle: {
        createdAt: new Date(),
        updatedAt: new Date(),
        accessCount: 0,
        autoRotate: secretData.type === 'api_key' || secretData.type === 'password'
      },
      version: 1,
      status: 'active',
      isActive: true
    };

    // Set rotation schedule if applicable
    if (secret.lifecycle.autoRotate && secretData.type === 'api_key') {
      secret.lifecycle.rotationInterval = 90; // 90 days default
      secret.lifecycle.nextRotation = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    }

    // Validate schema
    const validationResult = SecretSchema.safeParse(secret);
    if (!validationResult.success) {
      throw new Error(`Invalid secret schema: ${validationResult.error.message}`);
    }

    // Store secret
    this.secrets.set(secretId, secret);

    // Store in external manager if configured
    await this.syncToExternalManagers(secret, 'create');

    // Audit log
    await this.auditLogger.logSecurityEvent({
      eventType: 'SECRET_CREATED',
      secretId,
      userId: context.userId,
      serviceId: context.serviceId,
      details: {
        name: secret.name,
        type: secret.type,
        category: secret.category,
        environment: context.environment,
        compliance: secret.compliance
      }
    });

    // Schedule automatic rotation if enabled
    if (secret.lifecycle.autoRotate && secret.lifecycle.nextRotation) {
      await this.scheduleRotation(secretId, secret.lifecycle.nextRotation);
    }

    return secret;
  }

  /**
   * Retrieve a secret (with access control)
   */
  async getSecret(
    secretId: string,
    context: SecretOperationContext
  ): Promise<{ value: string; metadata: Record<string, any> }> {
    // Get secret metadata
    const secret = this.secrets.get(secretId);
    if (!secret || !secret.isActive) {
      throw new Error('Secret not found or inactive');
    }

    // Check permissions
    const hasPermission = await this.checkSecretAccess(secret, context);
    if (!hasPermission) {
      throw new Error('Access denied to secret');
    }

    // Check secret status
    if (secret.status !== 'active') {
      throw new Error(`Secret is ${secret.status}`);
    }

    // Check expiration
    if (secret.lifecycle.expiresAt && secret.lifecycle.expiresAt <= new Date()) {
      secret.status = 'expired';
      this.secrets.set(secretId, secret);
      throw new Error('Secret has expired');
    }

    // Check access count limits
    if (secret.accessPolicy.maxAccessCount && 
        secret.lifecycle.accessCount >= secret.accessPolicy.maxAccessCount) {
      throw new Error('Secret access limit exceeded');
    }

    // Check time window restrictions
    if (!this.isWithinAllowedTimeWindow(secret.accessPolicy.allowedTimeWindows)) {
      throw new Error('Secret access not allowed at this time');
    }

    try {
      // Decrypt secret value
      const decryptedValue = await this.decryptSecret(secret.encryptedValue, secret.encryptionKeyId);

      // Update access tracking
      secret.lifecycle.lastAccessedAt = new Date();
      secret.lifecycle.accessCount += 1;
      secret.lifecycle.updatedAt = new Date();
      this.secrets.set(secretId, secret);

      // Audit log
      await this.auditLogger.logSecurityEvent({
        eventType: 'SECRET_ACCESSED',
        secretId,
        userId: context.userId,
        serviceId: context.serviceId,
        details: {
          name: secret.name,
          accessCount: secret.lifecycle.accessCount,
          environment: context.environment,
          clientIP: context.clientIP
        }
      });

      return {
        value: decryptedValue,
        metadata: {
          ...secret.metadata,
          version: secret.version,
          lastRotated: secret.lifecycle.updatedAt,
          nextRotation: secret.lifecycle.nextRotation
        }
      };
    } catch (error) {
      await this.auditLogger.logSecurityEvent({
        eventType: 'SECRET_ACCESS_FAILED',
        secretId,
        userId: context.userId,
        serviceId: context.serviceId,
        error: error.message,
        details: { environment: context.environment }
      });
      throw new Error(`Failed to decrypt secret: ${error.message}`);
    }
  }

  /**
   * Update a secret
   */
  async updateSecret(
    secretId: string,
    updates: Partial<Pick<Secret, 'name' | 'description' | 'metadata' | 'tags' | 'accessPolicy'>>,
    newValue?: string,
    context?: SecretOperationContext
  ): Promise<Secret> {
    const secret = this.secrets.get(secretId);
    if (!secret || !secret.isActive) {
      throw new Error('Secret not found or inactive');
    }

    if (context) {
      const hasPermission = await this.checkPermission(context, 'secret', 'update');
      if (!hasPermission) {
        throw new Error('Permission denied: cannot update secrets');
      }
    }

    // Create updated secret
    const updatedSecret: Secret = {
      ...secret,
      ...updates,
      lifecycle: {
        ...secret.lifecycle,
        updatedAt: new Date()
      }
    };

    // Update encrypted value if provided
    if (newValue) {
      updatedSecret.encryptedValue = await this.encryptSecret(newValue, secret.encryptionKeyId);
      updatedSecret.version += 1;
    }

    // Validate updated secret
    const validationResult = SecretSchema.safeParse(updatedSecret);
    if (!validationResult.success) {
      throw new Error(`Invalid secret update: ${validationResult.error.message}`);
    }

    // Store updated secret
    this.secrets.set(secretId, updatedSecret);

    // Sync to external managers
    await this.syncToExternalManagers(updatedSecret, 'update');

    // Audit log
    if (context) {
      await this.auditLogger.logSecurityEvent({
        eventType: 'SECRET_UPDATED',
        secretId,
        userId: context.userId,
        serviceId: context.serviceId,
        details: {
          name: updatedSecret.name,
          changes: updates,
          valueChanged: !!newValue,
          version: updatedSecret.version
        }
      });
    }

    return updatedSecret;
  }

  /**
   * Rotate a secret
   */
  async rotateSecret(
    secretId: string,
    context: SecretOperationContext,
    customGenerator?: () => Promise<string>
  ): Promise<Secret> {
    const secret = this.secrets.get(secretId);
    if (!secret || !secret.isActive) {
      throw new Error('Secret not found or inactive');
    }

    const hasPermission = await this.checkPermission(context, 'secret', 'rotate');
    if (!hasPermission) {
      throw new Error('Permission denied: cannot rotate secrets');
    }

    // Generate new secret value
    const newValue = customGenerator ? 
      await customGenerator() : 
      await this.generateSecretValue(secret.type);

    // Update secret with new value
    secret.encryptedValue = await this.encryptSecret(newValue, secret.encryptionKeyId);
    secret.version += 1;
    secret.status = 'active';
    secret.lifecycle.updatedAt = new Date();

    // Schedule next rotation
    if (secret.lifecycle.autoRotate && secret.lifecycle.rotationInterval) {
      secret.lifecycle.nextRotation = new Date(
        Date.now() + secret.lifecycle.rotationInterval * 24 * 60 * 60 * 1000
      );
    }

    this.secrets.set(secretId, secret);

    // Sync to external managers
    await this.syncToExternalManagers(secret, 'rotate');

    // Audit log
    await this.auditLogger.logSecurityEvent({
      eventType: 'SECRET_ROTATED',
      secretId,
      userId: context.userId,
      serviceId: context.serviceId,
      details: {
        name: secret.name,
        version: secret.version,
        nextRotation: secret.lifecycle.nextRotation
      }
    });

    return secret;
  }

  /**
   * Delete a secret
   */
  async deleteSecret(secretId: string, context: SecretOperationContext): Promise<void> {
    const secret = this.secrets.get(secretId);
    if (!secret) {
      throw new Error('Secret not found');
    }

    const hasPermission = await this.checkPermission(context, 'secret', 'delete');
    if (!hasPermission) {
      throw new Error('Permission denied: cannot delete secrets');
    }

    // Mark as inactive instead of deleting for audit trail
    secret.isActive = false;
    secret.status = 'revoked';
    secret.lifecycle.updatedAt = new Date();
    this.secrets.set(secretId, secret);

    // Remove from external managers
    await this.syncToExternalManagers(secret, 'delete');

    // Audit log
    await this.auditLogger.logSecurityEvent({
      eventType: 'SECRET_DELETED',
      secretId,
      userId: context.userId,
      serviceId: context.serviceId,
      details: {
        name: secret.name,
        type: secret.type
      }
    });
  }

  /**
   * Scan for exposed secrets in code/configuration
   */
  async scanForSecrets(
    paths: string[],
    options: {
      includePatterns?: RegExp[];
      excludePatterns?: RegExp[];
      maxFileSize?: number;
      scanDepth?: number;
    } = {}
  ): Promise<SecretScanResult> {
    const scanId = crypto.randomUUID();
    const secretsFound: SecretScanResult['secretsFound'] = [];

    // Common secret patterns
    const defaultPatterns = [
      /([a-zA-Z0-9_-]*api[_-]?key[a-zA-Z0-9_-]*)\s*[:=]\s*["']?([a-zA-Z0-9_-]{20,})["']?/gi,
      /([a-zA-Z0-9_-]*password[a-zA-Z0-9_-]*)\s*[:=]\s*["']?([^"'\s]{8,})["']?/gi,
      /([a-zA-Z0-9_-]*secret[a-zA-Z0-9_-]*)\s*[:=]\s*["']?([a-zA-Z0-9_-]{16,})["']?/gi,
      /([a-zA-Z0-9_-]*token[a-zA-Z0-9_-]*)\s*[:=]\s*["']?([a-zA-Z0-9._-]{20,})["']?/gi,
      /(-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----)/gi
    ];

    const patterns = options.includePatterns || defaultPatterns;
    let totalFiles = 0;

    // Mock implementation - would implement real file scanning
    for (const path of paths) {
      totalFiles++;
      
      // Simulate finding secrets
      if (Math.random() < 0.1) { // 10% chance of finding a secret
        secretsFound.push({
          secretId: crypto.randomUUID(),
          location: `${path}:${Math.floor(Math.random() * 100)}`,
          type: ['hardcoded', 'configuration', 'environment'][Math.floor(Math.random() * 3)] as any,
          severity: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)] as any,
          recommendation: 'Move secret to secure secret manager'
        });
      }
    }

    const criticalSecrets = secretsFound.filter(s => s.severity === 'critical').length;
    const complianceScore = Math.max(0, 100 - (secretsFound.length * 10));

    const result: SecretScanResult = {
      scanId,
      timestamp: new Date(),
      secretsFound,
      summary: {
        totalFiles,
        totalSecrets: secretsFound.length,
        criticalSecrets,
        complianceScore
      }
    };

    // Audit log
    await this.auditLogger.logSecurityEvent({
      eventType: 'SECRET_SCAN_COMPLETED',
      scanId,
      details: {
        pathsScanned: paths.length,
        secretsFound: secretsFound.length,
        criticalSecrets,
        complianceScore
      }
    });

    return result;
  }

  /**
   * Request access to a secret
   */
  async requestSecretAccess(
    requestData: Omit<SecretAccessRequest, 'requestId' | 'requestedAt' | 'status'>,
    context: SecretOperationContext
  ): Promise<SecretAccessRequest> {
    const request: SecretAccessRequest = {
      requestId: crypto.randomUUID(),
      ...requestData,
      requestedBy: context.userId,
      requestedAt: new Date(),
      status: 'pending',
      metadata: {}
    };

    // Validate request
    const validationResult = SecretAccessRequestSchema.safeParse(request);
    if (!validationResult.success) {
      throw new Error(`Invalid access request: ${validationResult.error.message}`);
    }

    // Store request
    this.accessRequests.set(request.requestId, request);

    // Audit log
    await this.auditLogger.logSecurityEvent({
      eventType: 'SECRET_ACCESS_REQUESTED',
      secretId: request.secretId,
      requestId: request.requestId,
      userId: context.userId,
      details: {
        purpose: request.purpose,
        justification: request.justification,
        environment: request.environment
      }
    });

    return request;
  }

  /**
   * Approve/deny secret access request
   */
  async approveSecretAccess(
    requestId: string,
    approved: boolean,
    approverContext: SecretOperationContext,
    reason?: string
  ): Promise<SecretAccessRequest> {
    const request = this.accessRequests.get(requestId);
    if (!request) {
      throw new Error('Access request not found');
    }

    if (request.status !== 'pending') {
      throw new Error(`Request is already ${request.status}`);
    }

    // Check approver permissions
    const hasPermission = await this.checkPermission(approverContext, 'secret', 'approve');
    if (!hasPermission) {
      throw new Error('Permission denied: cannot approve secret access requests');
    }

    // Update request
    request.status = approved ? 'approved' : 'denied';
    request.approvedBy = approverContext.userId;
    request.approvedAt = new Date();
    if (reason) {
      request.metadata.approvalReason = reason;
    }

    this.accessRequests.set(requestId, request);

    // Audit log
    await this.auditLogger.logSecurityEvent({
      eventType: approved ? 'SECRET_ACCESS_APPROVED' : 'SECRET_ACCESS_DENIED',
      secretId: request.secretId,
      requestId,
      userId: approverContext.userId,
      details: {
        requestedBy: request.requestedBy,
        reason,
        environment: request.environment
      }
    });

    return request;
  }

  /**
   * List secrets (filtered by access permissions)
   */
  async listSecrets(context: SecretOperationContext, filters?: {
    type?: Secret['type'];
    category?: Secret['category'];
    environment?: string;
    tags?: string[];
    status?: Secret['status'];
  }): Promise<Omit<Secret, 'encryptedValue' | 'encryptionKeyId'>[]> {
    const hasPermission = await this.checkPermission(context, 'secret', 'list');
    if (!hasPermission) {
      throw new Error('Permission denied: cannot list secrets');
    }

    let secrets = Array.from(this.secrets.values())
      .filter(secret => secret.isActive)
      .filter(secret => this.canAccessSecret(secret, context));

    // Apply filters
    if (filters) {
      if (filters.type) {
        secrets = secrets.filter(s => s.type === filters.type);
      }
      if (filters.category) {
        secrets = secrets.filter(s => s.category === filters.category);
      }
      if (filters.environment) {
        secrets = secrets.filter(s => 
          s.accessPolicy.allowedEnvironments.includes(filters.environment as any)
        );
      }
      if (filters.tags && filters.tags.length > 0) {
        secrets = secrets.filter(s => 
          filters.tags!.some(tag => s.tags.includes(tag))
        );
      }
      if (filters.status) {
        secrets = secrets.filter(s => s.status === filters.status);
      }
    }

    // Remove sensitive fields
    return secrets.map(({ encryptedValue, encryptionKeyId, ...secret }) => secret);
  }

  /**
   * Get secret statistics
   */
  getSecretStatistics(): {
    total: number;
    active: number;
    expired: number;
    byType: Record<string, number>;
    byCategory: Record<string, number>;
    byEnvironment: Record<string, number>;
    rotationStats: {
      dueForRotation: number;
      autoRotationEnabled: number;
      neverRotated: number;
    };
    complianceScore: number;
  } {
    const activeSecrets = Array.from(this.secrets.values()).filter(s => s.isActive);
    const expiredSecrets = activeSecrets.filter(s => 
      s.lifecycle.expiresAt && s.lifecycle.expiresAt <= new Date()
    );

    const byType: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const byEnvironment: Record<string, number> = {};

    for (const secret of activeSecrets) {
      byType[secret.type] = (byType[secret.type] || 0) + 1;
      byCategory[secret.category] = (byCategory[secret.category] || 0) + 1;
      
      for (const env of secret.accessPolicy.allowedEnvironments) {
        byEnvironment[env] = (byEnvironment[env] || 0) + 1;
      }
    }

    const dueForRotation = activeSecrets.filter(s => 
      s.lifecycle.nextRotation && s.lifecycle.nextRotation <= new Date()
    ).length;

    const autoRotationEnabled = activeSecrets.filter(s => s.lifecycle.autoRotate).length;
    const neverRotated = activeSecrets.filter(s => s.version === 1).length;

    // Calculate compliance score based on various factors
    let complianceScore = 100;
    if (expiredSecrets.length > 0) complianceScore -= 20;
    if (dueForRotation > 0) complianceScore -= 15;
    if (neverRotated / activeSecrets.length > 0.5) complianceScore -= 10;

    return {
      total: this.secrets.size,
      active: activeSecrets.length,
      expired: expiredSecrets.length,
      byType,
      byCategory,
      byEnvironment,
      rotationStats: {
        dueForRotation,
        autoRotationEnabled,
        neverRotated
      },
      complianceScore: Math.max(0, complianceScore)
    };
  }

  /**
   * Register external secret manager
   */
  registerExternalManager(name: string, manager: ExternalSecretManager): void {
    this.externalManagers.set(name, manager);
  }

  // Private helper methods
  private async initializeDefaultEncryptionKeys(): Promise<void> {
    // Create master encryption key
    const keyId = crypto.randomUUID();
    const salt = randomBytes(16);
    const iv = randomBytes(16);
    
    const encryptionKey: EncryptionKey = {
      keyId,
      algorithm: 'AES-256-GCM',
      purpose: 'secret_encryption',
      encryptedKey: this.masterKey.toString('hex'),
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      status: 'active',
      createdAt: new Date(),
      metadata: { default: true }
    };

    this.encryptionKeys.set(keyId, encryptionKey);
  }

  private async getActiveEncryptionKey(): Promise<string> {
    const activeKey = Array.from(this.encryptionKeys.values())
      .find(key => key.status === 'active' && key.purpose === 'secret_encryption');
    
    if (!activeKey) {
      throw new Error('No active encryption key found');
    }
    
    return activeKey.keyId;
  }

  private async encryptSecret(plainValue: string, keyId: string): Promise<string> {
    const encryptionKey = this.encryptionKeys.get(keyId);
    if (!encryptionKey) {
      throw new Error('Encryption key not found');
    }

    // Derive key from master key
    const derivedKey = await this.deriveKey(this.masterKey, Buffer.from(encryptionKey.salt, 'hex'));
    
    // Encrypt with AES-256-GCM
    const iv = randomBytes(16);
    const cipher = createCipher('aes-256-gcm', derivedKey);
    cipher.setAAD(Buffer.from(keyId)); // Additional authenticated data
    
    let encrypted = cipher.update(plainValue, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return JSON.stringify({
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      algorithm: encryptionKey.algorithm
    });
  }

  private async decryptSecret(encryptedValue: string, keyId: string): Promise<string> {
    const encryptionKey = this.encryptionKeys.get(keyId);
    if (!encryptionKey) {
      throw new Error('Encryption key not found');
    }

    const { encrypted, iv, authTag, algorithm } = JSON.parse(encryptedValue);
    
    // Derive key from master key
    const derivedKey = await this.deriveKey(this.masterKey, Buffer.from(encryptionKey.salt, 'hex'));
    
    // Decrypt with AES-256-GCM
    const decipher = createDecipher('aes-256-gcm', derivedKey);
    decipher.setAAD(Buffer.from(keyId));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  private async deriveKey(masterKey: Buffer, salt: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      scrypt(masterKey, salt, 32, (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      });
    });
  }

  private async checkPermission(context: SecretOperationContext, resource: string, action: string): Promise<boolean> {
    try {
      const accessRequest = {
        userId: context.userId,
        resource,
        action,
        context: {
          serviceId: context.serviceId,
          environment: context.environment,
          clientIP: context.clientIP,
          userAgent: context.userAgent,
          requestId: context.requestId,
          timestamp: context.timestamp
        }
      };

      const decision = await this.rbacSystem.checkAccess(accessRequest);
      return decision.decision === 'allow';
    } catch {
      return false;
    }
  }

  private async checkSecretAccess(secret: Secret, context: SecretOperationContext): Promise<boolean> {
    // Check basic permission
    const hasPermission = await this.checkPermission(context, 'secret', 'read');
    if (!hasPermission) return false;

    // Check service allowlist
    if (!secret.accessPolicy.allowedServices.includes('*') && 
        !secret.accessPolicy.allowedServices.includes(context.serviceId)) {
      return false;
    }

    // Check environment allowlist
    if (!secret.accessPolicy.allowedEnvironments.includes(context.environment)) {
      return false;
    }

    return true;
  }

  private canAccessSecret(secret: Secret, context: SecretOperationContext): boolean {
    return secret.accessPolicy.allowedServices.includes('*') || 
           secret.accessPolicy.allowedServices.includes(context.serviceId);
  }

  private isWithinAllowedTimeWindow(timeWindows?: Secret['accessPolicy']['allowedTimeWindows']): boolean {
    if (!timeWindows || timeWindows.length === 0) {
      return true; // No restrictions
    }

    const now = new Date();
    return timeWindows.some(window => {
      // Simplified time window check
      const startTime = parseInt(window.startTime.split(':')[0]);
      const endTime = parseInt(window.endTime.split(':')[0]);
      const currentHour = now.getHours();
      
      return currentHour >= startTime && currentHour <= endTime;
    });
  }

  private async generateSecretValue(type: Secret['type']): Promise<string> {
    switch (type) {
      case 'password':
        return this.generatePassword(32);
      case 'api_key':
        return this.generateApiKey();
      case 'token':
        return randomBytes(32).toString('base64url');
      default:
        return randomBytes(16).toString('hex');
    }
  }

  private generatePassword(length: number): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    return password;
  }

  private generateApiKey(): string {
    const prefix = 'sk_';
    const key = randomBytes(24).toString('base64url');
    return prefix + key;
  }

  private async syncToExternalManagers(secret: Secret, operation: 'create' | 'update' | 'rotate' | 'delete'): Promise<void> {
    for (const [name, manager] of this.externalManagers.entries()) {
      try {
        if (!(await manager.isAvailable())) continue;

        const key = `${secret.ownerService}/${secret.name}`;
        
        switch (operation) {
          case 'create':
          case 'update':
          case 'rotate':
            const decryptedValue = await this.decryptSecret(secret.encryptedValue, secret.encryptionKeyId);
            await manager.setSecret(key, decryptedValue, {
              type: secret.type,
              version: secret.version,
              tags: secret.tags
            });
            break;
          case 'delete':
            await manager.deleteSecret(key);
            break;
        }
      } catch (error) {
        await this.auditLogger.logSecurityEvent({
          eventType: 'EXTERNAL_SYNC_FAILED',
          secretId: secret.secretId,
          details: { manager: name, operation, error: error.message }
        });
      }
    }
  }

  private async scheduleRotation(secretId: string, rotationDate: Date): Promise<void> {
    // In production, would integrate with job scheduler
    setTimeout(async () => {
      try {
        const context: SecretOperationContext = {
          userId: 'system',
          serviceId: 'secret-manager',
          operation: 'rotate',
          environment: 'production',
          requestId: crypto.randomUUID(),
          timestamp: new Date()
        };
        
        await this.rotateSecret(secretId, context);
      } catch (error) {
        await this.auditLogger.logSecurityEvent({
          eventType: 'AUTO_ROTATION_FAILED',
          secretId,
          error: error.message
        });
      }
    }, rotationDate.getTime() - Date.now());
  }
}

export { SecretManager };