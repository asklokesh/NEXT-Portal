/**
 * Tenant Configuration Service
 * Handles tenant-specific configuration, customization, and feature management
 */

import { PrismaClient } from '@prisma/client';
import { TenantAwareDatabase } from '@/lib/database/TenantAwareDatabase';
import { getTenantContext, TenantContext } from '@/lib/tenancy/TenantContext';
import { validateInput } from '@/lib/security/input-validation';
import { createAuditLog } from '@/lib/audit/AuditService';
import { NextRequest } from 'next/server';

export interface TenantConfiguration {
  authentication: {
    providers: AuthProvider[];
    ssoEnabled: boolean;
    mfaRequired: boolean;
    mfaProviders: string[];
    customLoginPage?: string;
    sessionTimeout: number; // minutes
    passwordPolicy: PasswordPolicy;
  };
  branding: {
    organizationName: string;
    logoUrl?: string;
    faviconUrl?: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    customCSS?: string;
    customJS?: string;
    footerText?: string;
    supportEmail?: string;
  };
  features: {
    enabledFeatures: FeatureToggle[];
    pluginCategories: PluginCategory[];
    maxUsers: number;
    maxPlugins: number;
    maxStorage: number; // GB
    maxApiCalls: number; // per month
    customDomainEnabled: boolean;
    whitelabelEnabled: boolean;
    advancedAnalytics: boolean;
    prioritySupport: boolean;
  };
  security: {
    ipWhitelist: string[];
    domainWhitelist: string[];
    contentSecurityPolicy?: string;
    dataRetentionDays: number;
    auditLogRetentionDays: number;
    encryptionAtRest: boolean;
    backupFrequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  };
  integrations: {
    github: GitHubIntegration;
    slack: SlackIntegration;
    jira: JiraIntegration;
    azure: AzureIntegration;
    aws: AWSIntegration;
    customWebhooks: CustomWebhook[];
  };
  notifications: {
    emailEnabled: boolean;
    slackEnabled: boolean;
    webhookEnabled: boolean;
    notificationTypes: NotificationType[];
    escalationRules: EscalationRule[];
  };
  portal: {
    sidebarLayout: 'EXPANDED' | 'COLLAPSED' | 'MINIMAL';
    darkMode: boolean;
    customPages: CustomPage[];
    navigation: NavigationItem[];
    dashboard: DashboardConfiguration;
    catalog: CatalogConfiguration;
  };
}

export interface AuthProvider {
  type: 'GITHUB' | 'GOOGLE' | 'AZURE' | 'SAML' | 'LDAP' | 'OIDC';
  enabled: boolean;
  config: Record<string, any>;
  displayName: string;
  order: number;
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSymbols: boolean;
  maxAge: number; // days
  historySize: number;
}

export interface FeatureToggle {
  key: string;
  enabled: boolean;
  rolloutPercentage: number;
  conditions?: Record<string, any>;
}

export interface PluginCategory {
  category: string;
  enabled: boolean;
  autoInstall: boolean;
  restrictions?: string[];
}

export interface GitHubIntegration {
  enabled: boolean;
  orgWhitelist: string[];
  appId?: string;
  installationId?: string;
  webhookSecret?: string;
}

export interface SlackIntegration {
  enabled: boolean;
  workspaces: string[];
  botToken?: string;
  signingSecret?: string;
  channels: string[];
}

export interface JiraIntegration {
  enabled: boolean;
  baseUrl?: string;
  projects: string[];
  username?: string;
  apiToken?: string;
}

export interface AzureIntegration {
  enabled: boolean;
  tenantId?: string;
  clientId?: string;
  subscriptions: string[];
}

export interface AWSIntegration {
  enabled: boolean;
  accountIds: string[];
  regions: string[];
  accessKeyId?: string;
  roleArn?: string;
}

export interface CustomWebhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  headers: Record<string, string>;
  enabled: boolean;
}

export interface NotificationType {
  type: string;
  channels: ('EMAIL' | 'SLACK' | 'WEBHOOK')[];
  enabled: boolean;
}

export interface EscalationRule {
  trigger: string;
  delay: number; // minutes
  actions: string[];
}

export interface CustomPage {
  id: string;
  title: string;
  path: string;
  content: string;
  enabled: boolean;
  order: number;
}

export interface NavigationItem {
  id: string;
  title: string;
  path: string;
  icon?: string;
  order: number;
  parentId?: string;
  enabled: boolean;
  permissions?: string[];
}

export interface DashboardConfiguration {
  widgets: DashboardWidget[];
  layout: 'GRID' | 'MASONRY';
  refreshInterval: number;
}

export interface DashboardWidget {
  id: string;
  type: string;
  title: string;
  config: Record<string, any>;
  position: { x: number; y: number; w: number; h: number };
  enabled: boolean;
}

export interface CatalogConfiguration {
  defaultFilters: Record<string, any>;
  customFields: CustomField[];
  templates: CatalogTemplate[];
}

export interface CustomField {
  key: string;
  label: string;
  type: 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'SELECT' | 'MULTI_SELECT';
  options?: string[];
  required: boolean;
}

export interface CatalogTemplate {
  id: string;
  name: string;
  description: string;
  spec: Record<string, any>;
  enabled: boolean;
}

export interface ConfigurationUpdateResult {
  success: boolean;
  error?: string;
  validationErrors?: string[];
  updatedFields?: string[];
  requiresRestart?: boolean;
}

/**
 * Tenant Configuration Management Service
 */
export class TenantConfigurationService {
  private systemDb: TenantAwareDatabase;
  private tenantDb: TenantAwareDatabase;

  constructor() {
    this.systemDb = new TenantAwareDatabase();
    this.systemDb.createSystemContext();
    this.tenantDb = new TenantAwareDatabase();
  }

  /**
   * Initialize service with tenant context
   */
  async initializeWithRequest(request: NextRequest): Promise<boolean> {
    const tenantContext = getTenantContext(request);
    if (!tenantContext) {
      return false;
    }

    const dbContext = {
      tenantId: tenantContext.tenant.id,
      userId: tenantContext.user?.id,
      userPermissions: tenantContext.permissions,
      isSystemOperation: false
    };

    this.tenantDb.setTenantContext(dbContext);
    return true;
  }

  /**
   * Get complete tenant configuration
   */
  async getTenantConfiguration(tenantId: string): Promise<TenantConfiguration | null> {
    try {
      const config = await this.systemDb.findFirst('tenantConfiguration', {
        where: {
          tenantId,
          isActive: true
        },
        orderBy: { createdAt: 'desc' }
      });

      if (!config) {
        return this.getDefaultConfiguration(tenantId);
      }

      return this.parseConfiguration(config.configuration);
    } catch (error) {
      console.error('Failed to get tenant configuration:', error);
      return null;
    }
  }

  /**
   * Update tenant configuration
   */
  async updateTenantConfiguration(
    tenantId: string,
    updates: Partial<TenantConfiguration>,
    userId?: string
  ): Promise<ConfigurationUpdateResult> {
    try {
      // Get current configuration
      const currentConfig = await this.getTenantConfiguration(tenantId);
      if (!currentConfig) {
        return {
          success: false,
          error: 'Current configuration not found'
        };
      }

      // Validate updates
      const validation = await this.validateConfiguration(updates, tenantId);
      if (!validation.valid) {
        return {
          success: false,
          error: 'Configuration validation failed',
          validationErrors: validation.errors
        };
      }

      // Merge configurations
      const mergedConfig = this.mergeConfigurations(currentConfig, updates);

      // Save new configuration version
      await this.systemDb.transaction(async (client) => {
        // Deactivate current configuration
        await client.updateMany('tenantConfiguration', {
          where: {
            tenantId,
            isActive: true
          },
          data: {
            isActive: false,
            deactivatedAt: new Date()
          }
        });

        // Create new configuration version
        await client.create('tenantConfiguration', {
          data: {
            tenantId,
            configuration: mergedConfig,
            version: this.generateConfigVersion(),
            isActive: true,
            updatedBy: userId,
            createdAt: new Date()
          }
        });
      });

      // Create audit log
      await createAuditLog({
        userId,
        tenantId,
        action: 'tenant_config:update',
        resource: 'tenant_configuration',
        resourceId: tenantId,
        metadata: {
          updatedFields: Object.keys(updates),
          configVersion: this.generateConfigVersion()
        }
      });

      // Check if restart is required
      const requiresRestart = this.checkRestartRequired(currentConfig, mergedConfig);

      return {
        success: true,
        updatedFields: Object.keys(updates),
        requiresRestart
      };

    } catch (error) {
      console.error('Failed to update tenant configuration:', error);
      return {
        success: false,
        error: 'Failed to update configuration'
      };
    }
  }

  /**
   * Get branding configuration for tenant
   */
  async getTenantBranding(tenantId: string): Promise<TenantConfiguration['branding'] | null> {
    try {
      const config = await this.getTenantConfiguration(tenantId);
      return config?.branding || null;
    } catch (error) {
      console.error('Failed to get tenant branding:', error);
      return null;
    }
  }

  /**
   * Update tenant branding
   */
  async updateTenantBranding(
    tenantId: string,
    branding: Partial<TenantConfiguration['branding']>,
    userId?: string
  ): Promise<ConfigurationUpdateResult> {
    // Validate branding configuration
    const validation = this.validateBranding(branding);
    if (!validation.valid) {
      return {
        success: false,
        error: 'Invalid branding configuration',
        validationErrors: validation.errors
      };
    }

    return await this.updateTenantConfiguration(tenantId, { branding }, userId);
  }

  /**
   * Get feature toggles for tenant
   */
  async getFeatureToggles(tenantId: string): Promise<FeatureToggle[]> {
    try {
      const config = await this.getTenantConfiguration(tenantId);
      return config?.features.enabledFeatures || [];
    } catch (error) {
      console.error('Failed to get feature toggles:', error);
      return [];
    }
  }

  /**
   * Update feature toggle
   */
  async updateFeatureToggle(
    tenantId: string,
    featureKey: string,
    enabled: boolean,
    rolloutPercentage: number = 100,
    userId?: string
  ): Promise<ConfigurationUpdateResult> {
    try {
      const config = await this.getTenantConfiguration(tenantId);
      if (!config) {
        return { success: false, error: 'Configuration not found' };
      }

      const features = config.features.enabledFeatures;
      const existingFeatureIndex = features.findIndex(f => f.key === featureKey);

      if (existingFeatureIndex >= 0) {
        features[existingFeatureIndex] = {
          ...features[existingFeatureIndex],
          enabled,
          rolloutPercentage
        };
      } else {
        features.push({
          key: featureKey,
          enabled,
          rolloutPercentage
        });
      }

      return await this.updateTenantConfiguration(tenantId, {
        features: {
          ...config.features,
          enabledFeatures: features
        }
      }, userId);

    } catch (error) {
      console.error('Failed to update feature toggle:', error);
      return {
        success: false,
        error: 'Failed to update feature toggle'
      };
    }
  }

  /**
   * Check if feature is enabled for tenant
   */
  async isFeatureEnabled(tenantId: string, featureKey: string, userId?: string): Promise<boolean> {
    try {
      const features = await this.getFeatureToggles(tenantId);
      const feature = features.find(f => f.key === featureKey);

      if (!feature || !feature.enabled) {
        return false;
      }

      // Check rollout percentage
      if (feature.rolloutPercentage < 100 && userId) {
        const hash = this.hashUserId(userId);
        return (hash % 100) < feature.rolloutPercentage;
      }

      return feature.enabled;
    } catch (error) {
      console.error('Failed to check feature toggle:', error);
      return false;
    }
  }

  /**
   * Get integration configuration
   */
  async getIntegrationConfig<T extends keyof TenantConfiguration['integrations']>(
    tenantId: string,
    integration: T
  ): Promise<TenantConfiguration['integrations'][T] | null> {
    try {
      const config = await this.getTenantConfiguration(tenantId);
      return config?.integrations[integration] || null;
    } catch (error) {
      console.error(`Failed to get ${integration} integration config:`, error);
      return null;
    }
  }

  /**
   * Update integration configuration
   */
  async updateIntegrationConfig<T extends keyof TenantConfiguration['integrations']>(
    tenantId: string,
    integration: T,
    config: Partial<TenantConfiguration['integrations'][T]>,
    userId?: string
  ): Promise<ConfigurationUpdateResult> {
    try {
      const currentConfig = await this.getTenantConfiguration(tenantId);
      if (!currentConfig) {
        return { success: false, error: 'Configuration not found' };
      }

      const updatedIntegrations = {
        ...currentConfig.integrations,
        [integration]: {
          ...currentConfig.integrations[integration],
          ...config
        }
      };

      return await this.updateTenantConfiguration(tenantId, {
        integrations: updatedIntegrations
      }, userId);

    } catch (error) {
      console.error(`Failed to update ${integration} integration:`, error);
      return {
        success: false,
        error: `Failed to update ${integration} integration`
      };
    }
  }

  /**
   * Export tenant configuration
   */
  async exportConfiguration(tenantId: string): Promise<{
    configuration: TenantConfiguration;
    metadata: {
      exportedAt: Date;
      version: string;
      tenantId: string;
    };
  } | null> {
    try {
      const config = await this.getTenantConfiguration(tenantId);
      if (!config) {
        return null;
      }

      return {
        configuration: config,
        metadata: {
          exportedAt: new Date(),
          version: this.generateConfigVersion(),
          tenantId
        }
      };
    } catch (error) {
      console.error('Failed to export configuration:', error);
      return null;
    }
  }

  /**
   * Import tenant configuration
   */
  async importConfiguration(
    tenantId: string,
    configData: any,
    userId?: string,
    validateOnly: boolean = false
  ): Promise<ConfigurationUpdateResult> {
    try {
      // Validate import data
      const validation = await this.validateConfiguration(configData.configuration, tenantId);
      if (!validation.valid) {
        return {
          success: false,
          error: 'Invalid configuration data',
          validationErrors: validation.errors
        };
      }

      if (validateOnly) {
        return { success: true };
      }

      // Import configuration
      return await this.updateTenantConfiguration(
        tenantId,
        configData.configuration,
        userId
      );

    } catch (error) {
      console.error('Failed to import configuration:', error);
      return {
        success: false,
        error: 'Failed to import configuration'
      };
    }
  }

  /**
   * Private helper methods
   */

  private getDefaultConfiguration(tenantId: string): TenantConfiguration {
    return {
      authentication: {
        providers: [
          { type: 'GITHUB', enabled: true, config: {}, displayName: 'GitHub', order: 1 }
        ],
        ssoEnabled: false,
        mfaRequired: false,
        mfaProviders: [],
        sessionTimeout: 1440, // 24 hours
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSymbols: false,
          maxAge: 90,
          historySize: 5
        }
      },
      branding: {
        organizationName: 'Developer Portal',
        primaryColor: '#1976d2',
        secondaryColor: '#424242',
        accentColor: '#ff4081'
      },
      features: {
        enabledFeatures: [
          { key: 'catalog', enabled: true, rolloutPercentage: 100 },
          { key: 'scaffolder', enabled: true, rolloutPercentage: 100 }
        ],
        pluginCategories: [
          { category: 'CATALOG', enabled: true, autoInstall: true },
          { category: 'DEVELOPER_TOOLS', enabled: true, autoInstall: false }
        ],
        maxUsers: 10,
        maxPlugins: 20,
        maxStorage: 5,
        maxApiCalls: 10000,
        customDomainEnabled: false,
        whitelabelEnabled: false,
        advancedAnalytics: false,
        prioritySupport: false
      },
      security: {
        ipWhitelist: [],
        domainWhitelist: [],
        dataRetentionDays: 90,
        auditLogRetentionDays: 365,
        encryptionAtRest: true,
        backupFrequency: 'DAILY'
      },
      integrations: {
        github: { enabled: true, orgWhitelist: [] },
        slack: { enabled: false, workspaces: [], channels: [] },
        jira: { enabled: false, projects: [] },
        azure: { enabled: false, subscriptions: [] },
        aws: { enabled: false, accountIds: [], regions: [] },
        customWebhooks: []
      },
      notifications: {
        emailEnabled: true,
        slackEnabled: false,
        webhookEnabled: false,
        notificationTypes: [
          { type: 'PLUGIN_INSTALLED', channels: ['EMAIL'], enabled: true },
          { type: 'USER_ADDED', channels: ['EMAIL'], enabled: true }
        ],
        escalationRules: []
      },
      portal: {
        sidebarLayout: 'EXPANDED',
        darkMode: false,
        customPages: [],
        navigation: [],
        dashboard: {
          widgets: [],
          layout: 'GRID',
          refreshInterval: 300
        },
        catalog: {
          defaultFilters: {},
          customFields: [],
          templates: []
        }
      }
    };
  }

  private parseConfiguration(configData: any): TenantConfiguration {
    // Parse and validate configuration data
    return configData as TenantConfiguration;
  }

  private mergeConfigurations(
    current: TenantConfiguration,
    updates: Partial<TenantConfiguration>
  ): TenantConfiguration {
    // Deep merge configurations
    return {
      ...current,
      ...updates,
      authentication: { ...current.authentication, ...updates.authentication },
      branding: { ...current.branding, ...updates.branding },
      features: { ...current.features, ...updates.features },
      security: { ...current.security, ...updates.security },
      integrations: { ...current.integrations, ...updates.integrations },
      notifications: { ...current.notifications, ...updates.notifications },
      portal: { ...current.portal, ...updates.portal }
    };
  }

  private async validateConfiguration(
    config: Partial<TenantConfiguration>,
    tenantId: string
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Validate branding
    if (config.branding) {
      const brandingValidation = this.validateBranding(config.branding);
      if (!brandingValidation.valid) {
        errors.push(...brandingValidation.errors);
      }
    }

    // Validate feature limits based on tenant tier
    if (config.features) {
      const tenant = await this.systemDb.findUnique('organization', {
        where: { id: tenantId }
      });

      if (tenant && config.features.maxUsers !== undefined) {
        const tierLimits = this.getTierLimits(tenant.tier);
        if (config.features.maxUsers > tierLimits.maxUsers && tierLimits.maxUsers !== -1) {
          errors.push(`Max users exceeds tier limit of ${tierLimits.maxUsers}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private validateBranding(branding: Partial<TenantConfiguration['branding']>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (branding.primaryColor && !this.isValidColor(branding.primaryColor)) {
      errors.push('Invalid primary color format');
    }

    if (branding.secondaryColor && !this.isValidColor(branding.secondaryColor)) {
      errors.push('Invalid secondary color format');
    }

    if (branding.accentColor && !this.isValidColor(branding.accentColor)) {
      errors.push('Invalid accent color format');
    }

    if (branding.logoUrl && !this.isValidUrl(branding.logoUrl)) {
      errors.push('Invalid logo URL');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private isValidColor(color: string): boolean {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private getTierLimits(tier: string) {
    const limits = {
      FREE: { maxUsers: 5, maxPlugins: 10, maxStorage: 1 },
      STARTER: { maxUsers: 25, maxPlugins: 50, maxStorage: 10 },
      PROFESSIONAL: { maxUsers: 100, maxPlugins: 200, maxStorage: 100 },
      ENTERPRISE: { maxUsers: -1, maxPlugins: -1, maxStorage: -1 }
    };
    return limits[tier as keyof typeof limits] || limits.FREE;
  }

  private generateConfigVersion(): string {
    return `v${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  }

  private checkRestartRequired(
    current: TenantConfiguration,
    updated: TenantConfiguration
  ): boolean {
    // Check if changes require portal restart
    const criticalFields = [
      'authentication.providers',
      'security.contentSecurityPolicy',
      'integrations'
    ];

    return criticalFields.some(field => {
      const currentValue = this.getNestedValue(current, field);
      const updatedValue = this.getNestedValue(updated, field);
      return JSON.stringify(currentValue) !== JSON.stringify(updatedValue);
    });
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Cleanup and disconnect
   */
  async disconnect(): Promise<void> {
    await Promise.all([
      this.systemDb.disconnect(),
      this.tenantDb.disconnect()
    ]);
  }
}

export default TenantConfigurationService;