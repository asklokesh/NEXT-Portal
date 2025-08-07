/**
 * Dynamic Plugin Configuration Management System
 * Enterprise-grade configuration management with versioning, rollback, 
 * environment-specific overlays, and secret management
 */

import { EventEmitter } from 'events';
import { z } from 'zod';
import crypto from 'crypto';
import { deepMerge, deepClone, validateJsonSchema } from '../../../lib/utils';

// Configuration schema validation
export const ConfigurationValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.any()),
  z.record(z.any()),
  z.null()
]);

export const ConfigurationItemSchema = z.object({
  key: z.string(),
  value: z.unknown(),
  type: z.enum(['string', 'number', 'boolean', 'array', 'object', 'secret']),
  description: z.string().optional(),
  required: z.boolean().default(false),
  sensitive: z.boolean().default(false),
  validation: z.object({
    schema: z.any().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional(),
    enum: z.array(z.any()).optional()
  }).optional(),
  metadata: z.record(z.any()).optional()
});

export type ConfigurationItem = z.infer<typeof ConfigurationItemSchema>;

// Configuration version schema
export const ConfigurationVersionSchema = z.object({
  versionId: z.string(),
  pluginId: z.string(),
  environment: z.enum(['development', 'staging', 'production', 'global']),
  tenantId: z.string().optional(),
  configuration: z.array(ConfigurationItemSchema),
  checksum: z.string(),
  createdAt: z.date(),
  createdBy: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  active: z.boolean().default(false),
  rollbackData: z.record(z.any()).optional(),
  dependencies: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional()
});

export type ConfigurationVersion = z.infer<typeof ConfigurationVersionSchema>;

// Configuration change schema
export const ConfigurationChangeSchema = z.object({
  changeId: z.string(),
  pluginId: z.string(),
  environment: z.enum(['development', 'staging', 'production', 'global']),
  tenantId: z.string().optional(),
  changeType: z.enum(['create', 'update', 'delete', 'rollback', 'migrate']),
  fromVersionId: z.string().optional(),
  toVersionId: z.string(),
  changes: z.array(z.object({
    operation: z.enum(['add', 'remove', 'modify']),
    path: z.string(),
    oldValue: z.unknown().optional(),
    newValue: z.unknown().optional()
  })),
  appliedAt: z.date().optional(),
  appliedBy: z.string().optional(),
  status: z.enum(['pending', 'applied', 'failed', 'rolled_back']).default('pending'),
  error: z.string().optional()
});

export type ConfigurationChange = z.infer<typeof ConfigurationChangeSchema>;

// Configuration manager configuration
export const ConfigManagerConfigSchema = z.object({
  enableVersioning: z.boolean().default(true),
  enableEncryption: z.boolean().default(true),
  enableValidation: z.boolean().default(true),
  enableAuditLogging: z.boolean().default(true),
  maxVersionHistory: z.number().default(100),
  encryptionKey: z.string().optional(),
  secretRotationInterval: z.number().default(86400000), // 24 hours
  configReloadInterval: z.number().default(30000), // 30 seconds
  enableHotReload: z.boolean().default(true),
  enableBackup: z.boolean().default(true),
  backupInterval: z.number().default(3600000), // 1 hour
  environmentHierarchy: z.array(z.string()).default(['global', 'production', 'staging', 'development'])
});

export type ConfigManagerConfig = z.infer<typeof ConfigManagerConfigSchema>;

// Environment overlay
export interface EnvironmentOverlay {
  environment: string;
  precedence: number;
  configuration: ConfigurationItem[];
  conditions: {
    tenantId?: string;
    featureFlags?: string[];
    customConditions?: Record<string, any>;
  };
}

// Secret management
export interface SecretDefinition {
  secretId: string;
  key: string;
  encryptedValue: string;
  algorithm: string;
  salt: string;
  rotationPolicy: {
    enabled: boolean;
    intervalMs: number;
    notifyBefore: number;
  };
  accessPolicy: {
    allowedEnvironments: string[];
    allowedTenants: string[];
    requireApproval: boolean;
  };
  metadata: {
    createdAt: Date;
    lastRotated: Date;
    lastAccessed: Date;
    accessCount: number;
  };
}

/**
 * Plugin Configuration Manager
 * Manages dynamic configuration with versioning, rollback, and environment overlays
 */
export class PluginConfigurationManager extends EventEmitter {
  private config: ConfigManagerConfig;
  private configVersions: Map<string, ConfigurationVersion[]> = new Map();
  private activeVersions: Map<string, ConfigurationVersion> = new Map();
  private environmentOverlays: Map<string, EnvironmentOverlay[]> = new Map();
  private secrets: Map<string, SecretDefinition> = new Map();
  private configurationChanges: Map<string, ConfigurationChange> = new Map();
  private watchers: Map<string, Set<(config: any) => void>> = new Map();
  private reloadInterval: NodeJS.Timeout | null = null;
  private secretRotationInterval: NodeJS.Timeout | null = null;
  private backupInterval: NodeJS.Timeout | null = null;
  private encryptionKey: Buffer;

  constructor(config?: Partial<ConfigManagerConfig>) {
    super();
    this.config = ConfigManagerConfigSchema.parse(config || {});
    this.initializeManager();
  }

  // Initialize configuration manager
  private initializeManager(): void {
    // Initialize encryption key
    this.encryptionKey = this.config.encryptionKey 
      ? Buffer.from(this.config.encryptionKey, 'hex')
      : crypto.randomBytes(32);

    // Start hot reload monitoring
    if (this.config.enableHotReload) {
      this.startHotReloadMonitoring();
    }

    // Start secret rotation
    if (this.config.enableEncryption) {
      this.startSecretRotation();
    }

    // Start backup process
    if (this.config.enableBackup) {
      this.startBackupProcess();
    }
  }

  // Create or update plugin configuration
  async setPluginConfiguration(
    pluginId: string,
    configuration: ConfigurationItem[],
    options: {
      environment?: string;
      tenantId?: string;
      userId: string;
      description?: string;
      tags?: string[];
      validateOnly?: boolean;
    }
  ): Promise<ConfigurationVersion> {
    const {
      environment = 'development',
      tenantId,
      userId,
      description,
      tags = [],
      validateOnly = false
    } = options;

    // Validate configuration items
    if (this.config.enableValidation) {
      await this.validateConfiguration(configuration);
    }

    // Generate version ID and checksum
    const versionId = this.generateVersionId();
    const checksum = this.calculateChecksum(configuration);

    // Create configuration version
    const configVersion: ConfigurationVersion = {
      versionId,
      pluginId,
      environment: environment as any,
      tenantId,
      configuration: deepClone(configuration),
      checksum,
      createdAt: new Date(),
      createdBy: userId,
      description,
      tags,
      active: !validateOnly
    };

    // Validate against schema if provided
    ConfigurationVersionSchema.parse(configVersion);

    if (validateOnly) {
      return configVersion;
    }

    // Store version
    const versionKey = this.getVersionKey(pluginId, environment, tenantId);
    let versions = this.configVersions.get(versionKey) || [];
    versions.push(configVersion);

    // Maintain version history limit
    if (versions.length > this.config.maxVersionHistory) {
      versions = versions.slice(-this.config.maxVersionHistory);
    }

    this.configVersions.set(versionKey, versions);

    // Deactivate previous version and activate new one
    const previousActive = this.activeVersions.get(versionKey);
    if (previousActive) {
      previousActive.active = false;
    }
    this.activeVersions.set(versionKey, configVersion);

    // Create configuration change record
    await this.recordConfigurationChange({
      pluginId,
      environment: environment as any,
      tenantId,
      changeType: previousActive ? 'update' : 'create',
      fromVersionId: previousActive?.versionId,
      toVersionId: versionId,
      userId
    });

    // Encrypt sensitive values
    if (this.config.enableEncryption) {
      await this.encryptSensitiveValues(configVersion);
    }

    // Notify watchers
    this.notifyWatchers(pluginId, environment, tenantId);

    // Emit events
    this.emit('configurationUpdated', {
      pluginId,
      environment,
      tenantId,
      versionId,
      previous: previousActive
    });

    return configVersion;
  }

  // Get plugin configuration with environment overlays
  async getPluginConfiguration(
    pluginId: string,
    options: {
      environment?: string;
      tenantId?: string;
      includeSecrets?: boolean;
      resolveReferences?: boolean;
    } = {}
  ): Promise<Record<string, any>> {
    const {
      environment = 'development',
      tenantId,
      includeSecrets = false,
      resolveReferences = true
    } = options;

    // Build configuration from environment hierarchy
    const mergedConfig = await this.buildMergedConfiguration(
      pluginId,
      environment,
      tenantId
    );

    // Decrypt sensitive values if requested
    if (includeSecrets && this.config.enableEncryption) {
      await this.decryptSensitiveValues(mergedConfig);
    }

    // Resolve configuration references
    if (resolveReferences) {
      await this.resolveConfigurationReferences(mergedConfig, environment, tenantId);
    }

    // Convert to key-value pairs
    const result: Record<string, any> = {};
    for (const item of mergedConfig) {
      if (!item.sensitive || includeSecrets) {
        result[item.key] = item.value;
      }
    }

    return result;
  }

  // Get configuration version
  getConfigurationVersion(
    pluginId: string,
    versionId: string,
    environment = 'development',
    tenantId?: string
  ): ConfigurationVersion | null {
    const versionKey = this.getVersionKey(pluginId, environment, tenantId);
    const versions = this.configVersions.get(versionKey) || [];
    return versions.find(v => v.versionId === versionId) || null;
  }

  // Get configuration history
  getConfigurationHistory(
    pluginId: string,
    environment = 'development',
    tenantId?: string,
    limit = 50
  ): ConfigurationVersion[] {
    const versionKey = this.getVersionKey(pluginId, environment, tenantId);
    const versions = this.configVersions.get(versionKey) || [];
    return versions.slice(-limit).reverse();
  }

  // Rollback to previous configuration version
  async rollbackConfiguration(
    pluginId: string,
    toVersionId: string,
    options: {
      environment?: string;
      tenantId?: string;
      userId: string;
      description?: string;
    }
  ): Promise<ConfigurationVersion> {
    const { environment = 'development', tenantId, userId, description } = options;
    
    const targetVersion = this.getConfigurationVersion(pluginId, toVersionId, environment, tenantId);
    if (!targetVersion) {
      throw new Error(`Configuration version ${toVersionId} not found`);
    }

    // Create rollback version
    const rollbackVersion = await this.setPluginConfiguration(
      pluginId,
      targetVersion.configuration,
      {
        environment,
        tenantId,
        userId,
        description: description || `Rollback to version ${toVersionId}`,
        tags: ['rollback', ...targetVersion.tags]
      }
    );

    // Record rollback change
    await this.recordConfigurationChange({
      pluginId,
      environment: environment as any,
      tenantId,
      changeType: 'rollback',
      fromVersionId: this.activeVersions.get(this.getVersionKey(pluginId, environment, tenantId))?.versionId,
      toVersionId: rollbackVersion.versionId,
      userId
    });

    this.emit('configurationRolledBack', {
      pluginId,
      environment,
      tenantId,
      fromVersionId: toVersionId,
      toVersionId: rollbackVersion.versionId
    });

    return rollbackVersion;
  }

  // Set environment overlay
  async setEnvironmentOverlay(
    pluginId: string,
    overlay: EnvironmentOverlay
  ): Promise<void> {
    // Validate overlay configuration
    if (this.config.enableValidation) {
      await this.validateConfiguration(overlay.configuration);
    }

    let overlays = this.environmentOverlays.get(pluginId) || [];
    
    // Remove existing overlay for the same environment
    overlays = overlays.filter(o => o.environment !== overlay.environment);
    
    // Add new overlay
    overlays.push(overlay);
    
    // Sort by precedence
    overlays.sort((a, b) => b.precedence - a.precedence);
    
    this.environmentOverlays.set(pluginId, overlays);

    // Notify watchers
    this.notifyWatchersForPlugin(pluginId);

    this.emit('overlayUpdated', { pluginId, overlay });
  }

  // Remove environment overlay
  async removeEnvironmentOverlay(
    pluginId: string,
    environment: string
  ): Promise<boolean> {
    const overlays = this.environmentOverlays.get(pluginId);
    if (!overlays) {
      return false;
    }

    const initialLength = overlays.length;
    const filteredOverlays = overlays.filter(o => o.environment !== environment);
    
    if (filteredOverlays.length === initialLength) {
      return false;
    }

    if (filteredOverlays.length === 0) {
      this.environmentOverlays.delete(pluginId);
    } else {
      this.environmentOverlays.set(pluginId, filteredOverlays);
    }

    // Notify watchers
    this.notifyWatchersForPlugin(pluginId);

    this.emit('overlayRemoved', { pluginId, environment });
    return true;
  }

  // Watch configuration changes
  watchConfiguration(
    pluginId: string,
    environment = 'development',
    tenantId: string | undefined,
    callback: (config: Record<string, any>) => void
  ): () => void {
    const watchKey = this.getVersionKey(pluginId, environment, tenantId);
    
    if (!this.watchers.has(watchKey)) {
      this.watchers.set(watchKey, new Set());
    }
    
    this.watchers.get(watchKey)!.add(callback);

    // Return unwatch function
    return () => {
      const watchers = this.watchers.get(watchKey);
      if (watchers) {
        watchers.delete(callback);
        if (watchers.size === 0) {
          this.watchers.delete(watchKey);
        }
      }
    };
  }

  // Manage secrets
  async setSecret(
    secretId: string,
    key: string,
    value: string,
    options: {
      rotationPolicy?: SecretDefinition['rotationPolicy'];
      accessPolicy?: SecretDefinition['accessPolicy'];
    } = {}
  ): Promise<void> {
    if (!this.config.enableEncryption) {
      throw new Error('Encryption is not enabled');
    }

    const {
      rotationPolicy = {
        enabled: false,
        intervalMs: this.config.secretRotationInterval,
        notifyBefore: 3600000 // 1 hour
      },
      accessPolicy = {
        allowedEnvironments: ['development', 'staging', 'production'],
        allowedTenants: [],
        requireApproval: false
      }
    } = options;

    // Generate encryption parameters
    const salt = crypto.randomBytes(16);
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    
    // Encrypt value
    const cipher = crypto.createCipher(algorithm, Buffer.concat([this.encryptionKey, salt]));
    let encryptedValue = cipher.update(value, 'utf8', 'hex');
    encryptedValue += cipher.final('hex');

    const secretDefinition: SecretDefinition = {
      secretId,
      key,
      encryptedValue,
      algorithm,
      salt: salt.toString('hex'),
      rotationPolicy,
      accessPolicy,
      metadata: {
        createdAt: new Date(),
        lastRotated: new Date(),
        lastAccessed: new Date(),
        accessCount: 0
      }
    };

    this.secrets.set(secretId, secretDefinition);
    
    this.emit('secretCreated', { secretId, key });
  }

  // Get secret value
  async getSecret(
    secretId: string,
    environment: string,
    tenantId?: string
  ): Promise<string | null> {
    const secret = this.secrets.get(secretId);
    if (!secret) {
      return null;
    }

    // Check access policy
    if (!this.checkSecretAccess(secret, environment, tenantId)) {
      throw new Error(`Access denied to secret ${secretId}`);
    }

    // Update access metadata
    secret.metadata.lastAccessed = new Date();
    secret.metadata.accessCount++;

    // Decrypt value
    try {
      const salt = Buffer.from(secret.salt, 'hex');
      const decipher = crypto.createDecipher(secret.algorithm, Buffer.concat([this.encryptionKey, salt]));
      let decryptedValue = decipher.update(secret.encryptedValue, 'hex', 'utf8');
      decryptedValue += decipher.final('utf8');
      
      return decryptedValue;
    } catch (error) {
      this.emit('secretDecryptionFailed', { secretId, error });
      return null;
    }
  }

  // Compare configurations
  async compareConfigurations(
    pluginId: string,
    fromVersionId: string,
    toVersionId: string,
    environment = 'development',
    tenantId?: string
  ): Promise<{
    added: ConfigurationItem[];
    removed: ConfigurationItem[];
    modified: Array<{
      key: string;
      oldValue: any;
      newValue: any;
    }>;
  }> {
    const fromVersion = this.getConfigurationVersion(pluginId, fromVersionId, environment, tenantId);
    const toVersion = this.getConfigurationVersion(pluginId, toVersionId, environment, tenantId);

    if (!fromVersion || !toVersion) {
      throw new Error('One or both configuration versions not found');
    }

    const fromItems = new Map(fromVersion.configuration.map(item => [item.key, item]));
    const toItems = new Map(toVersion.configuration.map(item => [item.key, item]));

    const added: ConfigurationItem[] = [];
    const removed: ConfigurationItem[] = [];
    const modified: Array<{ key: string; oldValue: any; newValue: any }> = [];

    // Find added and modified items
    for (const [key, toItem] of toItems) {
      const fromItem = fromItems.get(key);
      if (!fromItem) {
        added.push(toItem);
      } else if (JSON.stringify(fromItem.value) !== JSON.stringify(toItem.value)) {
        modified.push({
          key,
          oldValue: fromItem.value,
          newValue: toItem.value
        });
      }
    }

    // Find removed items
    for (const [key, fromItem] of fromItems) {
      if (!toItems.has(key)) {
        removed.push(fromItem);
      }
    }

    return { added, removed, modified };
  }

  // Build merged configuration from environment hierarchy
  private async buildMergedConfiguration(
    pluginId: string,
    environment: string,
    tenantId?: string
  ): Promise<ConfigurationItem[]> {
    const mergedConfig = new Map<string, ConfigurationItem>();

    // Apply configurations in hierarchy order (lowest to highest precedence)
    for (const env of this.config.environmentHierarchy) {
      const versionKey = this.getVersionKey(pluginId, env, tenantId);
      const activeVersion = this.activeVersions.get(versionKey);
      
      if (activeVersion) {
        for (const item of activeVersion.configuration) {
          mergedConfig.set(item.key, { ...item });
        }
      }

      // If we've reached the target environment, stop
      if (env === environment) {
        break;
      }
    }

    // Apply environment overlays
    const overlays = this.environmentOverlays.get(pluginId) || [];
    for (const overlay of overlays) {
      if (this.shouldApplyOverlay(overlay, environment, tenantId)) {
        for (const item of overlay.configuration) {
          mergedConfig.set(item.key, { ...item });
        }
      }
    }

    return Array.from(mergedConfig.values());
  }

  // Check if overlay should be applied
  private shouldApplyOverlay(
    overlay: EnvironmentOverlay,
    environment: string,
    tenantId?: string
  ): boolean {
    // Check environment match
    if (overlay.environment !== environment && overlay.environment !== 'global') {
      return false;
    }

    // Check tenant conditions
    if (overlay.conditions.tenantId && overlay.conditions.tenantId !== tenantId) {
      return false;
    }

    // Add more condition checks as needed
    return true;
  }

  // Validate configuration
  private async validateConfiguration(configuration: ConfigurationItem[]): Promise<void> {
    for (const item of configuration) {
      try {
        ConfigurationItemSchema.parse(item);
        
        // Validate against custom schema if provided
        if (item.validation?.schema) {
          if (!validateJsonSchema(item.value, item.validation.schema)) {
            throw new Error(`Value validation failed for ${item.key}`);
          }
        }

        // Validate constraints
        if (item.validation) {
          const { min, max, pattern, enum: enumValues } = item.validation;
          
          if (typeof item.value === 'number') {
            if (min !== undefined && item.value < min) {
              throw new Error(`Value for ${item.key} is below minimum ${min}`);
            }
            if (max !== undefined && item.value > max) {
              throw new Error(`Value for ${item.key} is above maximum ${max}`);
            }
          }
          
          if (typeof item.value === 'string' && pattern) {
            if (!new RegExp(pattern).test(item.value)) {
              throw new Error(`Value for ${item.key} does not match pattern`);
            }
          }
          
          if (enumValues && !enumValues.includes(item.value)) {
            throw new Error(`Value for ${item.key} is not in allowed values`);
          }
        }

      } catch (error) {
        throw new Error(`Configuration validation failed for ${item.key}: ${error}`);
      }
    }
  }

  // Encrypt sensitive values
  private async encryptSensitiveValues(configVersion: ConfigurationVersion): Promise<void> {
    for (const item of configVersion.configuration) {
      if (item.sensitive && typeof item.value === 'string') {
        const secretId = `${configVersion.pluginId}:${item.key}:${configVersion.versionId}`;
        await this.setSecret(secretId, item.key, item.value);
        
        // Replace value with secret reference
        item.value = `{{secret:${secretId}}}`;
      }
    }
  }

  // Decrypt sensitive values
  private async decryptSensitiveValues(configuration: ConfigurationItem[]): Promise<void> {
    for (const item of configuration) {
      if (item.sensitive && typeof item.value === 'string') {
        const secretMatch = item.value.match(/\{\{secret:([^}]+)\}\}/);
        if (secretMatch) {
          const secretId = secretMatch[1];
          const decryptedValue = await this.getSecret(secretId, 'development'); // Default to development
          if (decryptedValue) {
            item.value = decryptedValue;
          }
        }
      }
    }
  }

  // Resolve configuration references
  private async resolveConfigurationReferences(
    configuration: ConfigurationItem[],
    environment: string,
    tenantId?: string
  ): Promise<void> {
    for (const item of configuration) {
      if (typeof item.value === 'string') {
        // Resolve environment variable references
        item.value = item.value.replace(/\$\{env:([^}]+)\}/g, (_, envVar) => {
          return process.env[envVar] || '';
        });

        // Resolve configuration references
        item.value = item.value.replace(/\$\{config:([^}]+)\}/g, (_, configKey) => {
          const referencedItem = configuration.find(c => c.key === configKey);
          return referencedItem ? String(referencedItem.value) : '';
        });
      }
    }
  }

  // Record configuration change
  private async recordConfigurationChange(options: {
    pluginId: string;
    environment: string;
    tenantId?: string;
    changeType: 'create' | 'update' | 'delete' | 'rollback' | 'migrate';
    fromVersionId?: string;
    toVersionId: string;
    userId: string;
  }): Promise<void> {
    const changeId = crypto.randomUUID();
    const change: ConfigurationChange = {
      changeId,
      ...options,
      environment: options.environment as any,
      changes: [], // Will be populated by comparing versions
      appliedAt: new Date(),
      appliedBy: options.userId,
      status: 'applied'
    };

    // Calculate changes if this is an update
    if (options.changeType === 'update' && options.fromVersionId) {
      const comparison = await this.compareConfigurations(
        options.pluginId,
        options.fromVersionId,
        options.toVersionId,
        options.environment,
        options.tenantId
      );

      change.changes = [
        ...comparison.added.map(item => ({
          operation: 'add' as const,
          path: item.key,
          newValue: item.value
        })),
        ...comparison.removed.map(item => ({
          operation: 'remove' as const,
          path: item.key,
          oldValue: item.value
        })),
        ...comparison.modified.map(item => ({
          operation: 'modify' as const,
          path: item.key,
          oldValue: item.oldValue,
          newValue: item.newValue
        }))
      ];
    }

    this.configurationChanges.set(changeId, change);

    if (this.config.enableAuditLogging) {
      this.emit('configurationChangeRecorded', change);
    }
  }

  // Check secret access
  private checkSecretAccess(
    secret: SecretDefinition,
    environment: string,
    tenantId?: string
  ): boolean {
    const { accessPolicy } = secret;

    // Check environment access
    if (accessPolicy.allowedEnvironments.length > 0 && 
        !accessPolicy.allowedEnvironments.includes(environment)) {
      return false;
    }

    // Check tenant access
    if (accessPolicy.allowedTenants.length > 0 && 
        (!tenantId || !accessPolicy.allowedTenants.includes(tenantId))) {
      return false;
    }

    return true;
  }

  // Generate version ID
  private generateVersionId(): string {
    return `v${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  }

  // Calculate configuration checksum
  private calculateChecksum(configuration: ConfigurationItem[]): string {
    const configString = JSON.stringify(configuration, null, 0);
    return crypto.createHash('sha256').update(configString).digest('hex');
  }

  // Get version key for storage
  private getVersionKey(pluginId: string, environment: string, tenantId?: string): string {
    return tenantId ? `${pluginId}:${environment}:${tenantId}` : `${pluginId}:${environment}`;
  }

  // Notify watchers
  private notifyWatchers(pluginId: string, environment: string, tenantId?: string): void {
    const watchKey = this.getVersionKey(pluginId, environment, tenantId);
    const watchers = this.watchers.get(watchKey);
    
    if (watchers && watchers.size > 0) {
      // Get updated configuration
      this.getPluginConfiguration(pluginId, { environment, tenantId })
        .then(config => {
          watchers.forEach(callback => {
            try {
              callback(config);
            } catch (error) {
              this.emit('watcherError', { watchKey, error });
            }
          });
        })
        .catch(error => {
          this.emit('watcherError', { watchKey, error });
        });
    }
  }

  // Notify watchers for all environments of a plugin
  private notifyWatchersForPlugin(pluginId: string): void {
    for (const watchKey of this.watchers.keys()) {
      if (watchKey.startsWith(`${pluginId}:`)) {
        const [, environment, tenantId] = watchKey.split(':');
        this.notifyWatchers(pluginId, environment, tenantId);
      }
    }
  }

  // Start hot reload monitoring
  private startHotReloadMonitoring(): void {
    this.reloadInterval = setInterval(() => {
      this.checkForConfigurationUpdates();
    }, this.config.configReloadInterval);
  }

  // Check for configuration updates (for external config sources)
  private async checkForConfigurationUpdates(): Promise<void> {
    // This would integrate with external configuration sources
    // like Kubernetes ConfigMaps, Consul, etc.
    this.emit('configurationReloadCheck');
  }

  // Start secret rotation
  private startSecretRotation(): void {
    this.secretRotationInterval = setInterval(() => {
      this.rotateExpiredSecrets();
    }, this.config.secretRotationInterval);
  }

  // Rotate expired secrets
  private async rotateExpiredSecrets(): Promise<void> {
    const now = new Date();
    
    for (const [secretId, secret] of this.secrets) {
      if (secret.rotationPolicy.enabled) {
        const timeSinceRotation = now.getTime() - secret.metadata.lastRotated.getTime();
        
        if (timeSinceRotation >= secret.rotationPolicy.intervalMs) {
          this.emit('secretRotationRequired', { secretId, secret });
        } else if (timeSinceRotation >= (secret.rotationPolicy.intervalMs - secret.rotationPolicy.notifyBefore)) {
          this.emit('secretRotationWarning', { secretId, secret });
        }
      }
    }
  }

  // Start backup process
  private startBackupProcess(): void {
    this.backupInterval = setInterval(() => {
      this.performBackup();
    }, this.config.backupInterval);
  }

  // Perform configuration backup
  private async performBackup(): Promise<void> {
    try {
      const backupData = {
        timestamp: new Date().toISOString(),
        configVersions: Object.fromEntries(this.configVersions),
        activeVersions: Object.fromEntries(this.activeVersions),
        environmentOverlays: Object.fromEntries(this.environmentOverlays),
        secrets: Object.fromEntries(this.secrets),
        configurationChanges: Object.fromEntries(this.configurationChanges)
      };

      this.emit('configurationBackup', backupData);
    } catch (error) {
      this.emit('backupFailed', error);
    }
  }

  // Get configuration statistics
  getStatistics(): {
    totalConfigurations: number;
    totalVersions: number;
    totalSecrets: number;
    totalWatchers: number;
    configurationsByEnvironment: Record<string, number>;
    activeVersionsByPlugin: Record<string, number>;
  } {
    const configurationsByEnvironment: Record<string, number> = {};
    const activeVersionsByPlugin: Record<string, number> = {};
    
    let totalVersions = 0;
    for (const versions of this.configVersions.values()) {
      totalVersions += versions.length;
    }

    for (const version of this.activeVersions.values()) {
      configurationsByEnvironment[version.environment] = 
        (configurationsByEnvironment[version.environment] || 0) + 1;
      
      activeVersionsByPlugin[version.pluginId] = 
        (activeVersionsByPlugin[version.pluginId] || 0) + 1;
    }

    return {
      totalConfigurations: this.activeVersions.size,
      totalVersions,
      totalSecrets: this.secrets.size,
      totalWatchers: Array.from(this.watchers.values()).reduce((sum, set) => sum + set.size, 0),
      configurationsByEnvironment,
      activeVersionsByPlugin
    };
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    if (this.reloadInterval) {
      clearInterval(this.reloadInterval);
      this.reloadInterval = null;
    }

    if (this.secretRotationInterval) {
      clearInterval(this.secretRotationInterval);
      this.secretRotationInterval = null;
    }

    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = null;
    }

    // Final backup
    if (this.config.enableBackup) {
      await this.performBackup();
    }

    // Clear watchers
    this.watchers.clear();

    // Clean up resources
    this.configVersions.clear();
    this.activeVersions.clear();
    this.environmentOverlays.clear();
    this.secrets.clear();
    this.configurationChanges.clear();

    this.removeAllListeners();
    this.emit('shutdown');
  }
}

// Export singleton instance
let configManagerInstance: PluginConfigurationManager | null = null;

export function getPluginConfigurationManager(config?: Partial<ConfigManagerConfig>): PluginConfigurationManager {
  if (!configManagerInstance) {
    configManagerInstance = new PluginConfigurationManager(config);
  }
  return configManagerInstance;
}