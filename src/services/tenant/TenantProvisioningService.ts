/**
 * Tenant Provisioning and Lifecycle Management Service
 * Handles automated tenant creation, configuration, and management workflows
 */

import { PrismaClient } from '@prisma/client';
import { TenantAwareDatabase } from '@/lib/database/TenantAwareDatabase';
import { tenantManager, Tenant, TenantStatus, TenantTier } from '@/lib/tenancy/TenantManager';
import { validateInput } from '@/lib/security/input-validation';
import { generateSecureId } from '@/lib/utils/id-generation';
import { sendEmail } from '@/lib/email/EmailService';
import { createAuditLog } from '@/lib/audit/AuditService';

export interface TenantProvisioningRequest {
  organizationName: string;
  adminEmail: string;
  adminName: string;
  tier: TenantTier;
  customDomain?: string;
  initialConfiguration?: TenantConfiguration;
  features?: string[];
  metadata?: Record<string, any>;
}

export interface TenantConfiguration {
  authentication?: {
    providers: string[];
    ssoEnabled: boolean;
    mfaRequired: boolean;
    customLoginPage?: string;
  };
  plugins?: {
    allowedCategories: string[];
    autoInstall: string[];
    restrictedPlugins: string[];
  };
  branding?: {
    logo?: string;
    primaryColor?: string;
    customCss?: string;
    favicon?: string;
  };
  security?: {
    ipWhitelist: string[];
    sessionTimeout: number;
    dataRetention: number;
  };
  integrations?: {
    github?: { enabled: boolean; orgWhitelist?: string[] };
    slack?: { enabled: boolean; workspaces?: string[] };
    jira?: { enabled: boolean; projects?: string[] };
  };
}

export interface TenantProvisioningResult {
  success: boolean;
  tenant?: Tenant;
  credentials?: {
    tenantId: string;
    adminUserId: string;
    initialPassword?: string;
    apiKeys?: string[];
  };
  setupUrl?: string;
  error?: string;
  validationErrors?: string[];
}

export interface TenantLifecycleEvent {
  id: string;
  tenantId: string;
  eventType: 'CREATED' | 'ACTIVATED' | 'SUSPENDED' | 'ARCHIVED' | 'DELETED' | 'UPGRADED' | 'DOWNGRADED';
  timestamp: Date;
  triggeredBy: string;
  metadata?: Record<string, any>;
  rollbackData?: Record<string, any>;
}

/**
 * Comprehensive tenant provisioning and lifecycle management
 */
export class TenantProvisioningService {
  private prisma: PrismaClient;
  private systemDb: TenantAwareDatabase;

  constructor() {
    this.prisma = new PrismaClient();
    this.systemDb = new TenantAwareDatabase(this.prisma);
    this.systemDb.createSystemContext();
  }

  /**
   * Provision new tenant with complete setup
   */
  async provisionTenant(request: TenantProvisioningRequest): Promise<TenantProvisioningResult> {
    try {
      // Validate request
      const validation = await this.validateProvisioningRequest(request);
      if (!validation.valid) {
        return {
          success: false,
          error: 'Invalid provisioning request',
          validationErrors: validation.errors
        };
      }

      // Check for existing tenant with same organization name or email
      const existingTenant = await this.checkTenantExists(request.organizationName, request.adminEmail);
      if (existingTenant) {
        return {
          success: false,
          error: 'Tenant with this organization name or admin email already exists'
        };
      }

      const result = await this.systemDb.transaction(async (client) => {
        // Generate tenant identifiers
        const tenantId = generateSecureId('tenant');
        const slug = this.generateTenantSlug(request.organizationName);
        
        // Create tenant record
        const tenant = await this.createTenantRecord(client, {
          id: tenantId,
          name: request.organizationName,
          slug,
          tier: request.tier,
          adminEmail: request.adminEmail,
          customDomain: request.customDomain,
          metadata: request.metadata || {}
        });

        // Create admin user
        const adminUser = await this.createAdminUser(client, {
          tenantId,
          email: request.adminEmail,
          name: request.adminName
        });

        // Setup initial configuration
        const configuration = await this.setupTenantConfiguration(client, tenantId, request.initialConfiguration);

        // Setup default resources
        await this.setupDefaultResources(client, tenantId, request.features || []);

        // Initialize tenant database context
        await this.initializeTenantDatabase(tenantId);

        // Record provisioning event
        await this.recordLifecycleEvent(client, {
          tenantId,
          eventType: 'CREATED',
          triggeredBy: 'system',
          metadata: {
            request: {
              organizationName: request.organizationName,
              adminEmail: request.adminEmail,
              tier: request.tier
            }
          }
        });

        return {
          tenant,
          adminUser,
          configuration
        };
      });

      // Generate setup credentials
      const credentials = await this.generateSetupCredentials(result.tenant, result.adminUser);

      // Send welcome email
      await this.sendWelcomeEmail(result.tenant, result.adminUser, credentials);

      // Schedule post-provisioning tasks
      await this.schedulePostProvisioningTasks(result.tenant.id);

      return {
        success: true,
        tenant: result.tenant,
        credentials,
        setupUrl: this.generateSetupUrl(result.tenant)
      };

    } catch (error) {
      console.error('Tenant provisioning failed:', error);
      
      return {
        success: false,
        error: 'Internal error during tenant provisioning'
      };
    }
  }

  /**
   * Validate provisioning request
   */
  private async validateProvisioningRequest(request: TenantProvisioningRequest): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    // Validate organization name
    if (!request.organizationName || request.organizationName.length < 2) {
      errors.push('Organization name must be at least 2 characters long');
    }

    if (request.organizationName && request.organizationName.length > 100) {
      errors.push('Organization name cannot exceed 100 characters');
    }

    // Validate admin email
    const emailValidation = validateInput.email(request.adminEmail);
    if (!emailValidation.valid) {
      errors.push('Invalid admin email format');
    }

    // Validate admin name
    if (!request.adminName || request.adminName.length < 1) {
      errors.push('Admin name is required');
    }

    // Validate tier
    const validTiers: TenantTier[] = ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'];
    if (!validTiers.includes(request.tier)) {
      errors.push('Invalid tenant tier');
    }

    // Validate custom domain if provided
    if (request.customDomain) {
      const domainValidation = validateInput.domain(request.customDomain);
      if (!domainValidation.valid) {
        errors.push('Invalid custom domain format');
      }

      // Check if domain is already in use
      const existingDomain = await tenantManager.findTenantByDomain(request.customDomain);
      if (existingDomain) {
        errors.push('Custom domain is already in use');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if tenant already exists
   */
  private async checkTenantExists(organizationName: string, adminEmail: string): Promise<boolean> {
    const existingByName = await tenantManager.findTenantByName(organizationName);
    const existingByEmail = await this.systemDb.findFirst('user', {
      where: { 
        email: adminEmail,
        role: 'OWNER'
      }
    });

    return !!(existingByName || existingByEmail);
  }

  /**
   * Generate tenant slug from organization name
   */
  private generateTenantSlug(organizationName: string): string {
    const baseSlug = organizationName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

    // Ensure uniqueness
    return `${baseSlug}-${generateSecureId('slug', 6)}`;
  }

  /**
   * Create tenant record
   */
  private async createTenantRecord(client: TenantAwareDatabase, tenantData: {
    id: string;
    name: string;
    slug: string;
    tier: TenantTier;
    adminEmail: string;
    customDomain?: string;
    metadata: Record<string, any>;
  }): Promise<Tenant> {
    const tenant = await client.create('organization', {
      data: {
        id: tenantData.id,
        name: tenantData.name,
        slug: tenantData.slug,
        tier: tenantData.tier,
        status: 'ACTIVE' as TenantStatus,
        customDomain: tenantData.customDomain,
        adminEmail: tenantData.adminEmail,
        metadata: tenantData.metadata,
        settings: {
          allowUserRegistration: false,
          requireEmailVerification: true,
          maxUsers: this.getMaxUsersForTier(tenantData.tier),
          maxPlugins: this.getMaxPluginsForTier(tenantData.tier)
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Register with tenant manager
    await tenantManager.registerTenant({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      tier: tenant.tier,
      status: tenant.status,
      customDomain: tenant.customDomain,
      metadata: tenant.metadata
    });

    return tenant;
  }

  /**
   * Create admin user for tenant
   */
  private async createAdminUser(client: TenantAwareDatabase, userData: {
    tenantId: string;
    email: string;
    name: string;
  }): Promise<any> {
    const userId = generateSecureId('user');
    const username = userData.email.split('@')[0];

    return await client.create('user', {
      data: {
        id: userId,
        tenantId: userData.tenantId,
        email: userData.email,
        name: userData.name,
        username,
        role: 'OWNER',
        isActive: true,
        isEmailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
  }

  /**
   * Setup tenant configuration
   */
  private async setupTenantConfiguration(
    client: TenantAwareDatabase, 
    tenantId: string, 
    config?: TenantConfiguration
  ): Promise<any> {
    const defaultConfig: TenantConfiguration = {
      authentication: {
        providers: ['email', 'github'],
        ssoEnabled: false,
        mfaRequired: false
      },
      plugins: {
        allowedCategories: ['ALL'],
        autoInstall: ['@backstage/plugin-catalog'],
        restrictedPlugins: []
      },
      security: {
        ipWhitelist: [],
        sessionTimeout: 24 * 60, // 24 hours in minutes
        dataRetention: 90 // days
      },
      integrations: {
        github: { enabled: true },
        slack: { enabled: false },
        jira: { enabled: false }
      }
    };

    const finalConfig = { ...defaultConfig, ...config };

    return await client.create('tenantConfiguration', {
      data: {
        tenantId,
        configuration: finalConfig,
        version: '1.0.0',
        isActive: true,
        createdAt: new Date()
      }
    });
  }

  /**
   * Setup default resources for tenant
   */
  private async setupDefaultResources(
    client: TenantAwareDatabase,
    tenantId: string,
    features: string[]
  ): Promise<void> {
    // Create default team
    await client.create('team', {
      data: {
        tenantId,
        name: 'Default Team',
        description: 'Default team for organization members',
        isDefault: true,
        createdAt: new Date()
      }
    });

    // Setup default plugins based on tier and requested features
    const defaultPlugins = this.getDefaultPluginsForFeatures(features);
    
    for (const plugin of defaultPlugins) {
      await client.create('plugin', {
        data: {
          tenantId,
          name: plugin.name,
          displayName: plugin.displayName,
          description: plugin.description,
          category: plugin.category,
          isInstalled: false,
          isEnabled: false,
          status: 'AVAILABLE',
          version: plugin.version || 'latest',
          source: 'MARKETPLACE',
          installSource: 'AUTO_PROVISION'
        }
      });
    }

    // Create resource usage tracking
    await this.initializeResourceTracking(client, tenantId);
  }

  /**
   * Initialize tenant database context
   */
  private async initializeTenantDatabase(tenantId: string): Promise<void> {
    // Set tenant context for database operations
    await this.prisma.$executeRaw`SELECT set_tenant_context(${tenantId})`;

    // Run tenant-specific database initialization
    await this.prisma.$executeRaw`
      INSERT INTO tenant_metrics_daily (tenant_id, metric_date, plugin_count, installed_plugin_count, enabled_plugin_count, avg_health_score, operations_count, successful_operations)
      VALUES (${tenantId}, CURRENT_DATE, 0, 0, 0, 100.0, 0, 0)
      ON CONFLICT (tenant_id, metric_date) DO NOTHING
    `;
  }

  /**
   * Generate setup credentials
   */
  private async generateSetupCredentials(tenant: any, adminUser: any): Promise<{
    tenantId: string;
    adminUserId: string;
    initialPassword: string;
    apiKeys: string[];
  }> {
    const initialPassword = generateSecureId('password', 16);
    const apiKey = generateSecureId('api_key', 32);

    // Store encrypted credentials
    await this.systemDb.create('userCredential', {
      data: {
        userId: adminUser.id,
        type: 'INITIAL_PASSWORD',
        value: initialPassword, // Should be hashed in production
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        isActive: true
      }
    });

    await this.systemDb.create('apiKey', {
      data: {
        tenantId: tenant.id,
        userId: adminUser.id,
        key: apiKey, // Should be hashed in production
        name: 'Initial Setup Key',
        permissions: ['tenant:setup', 'plugin:install', 'user:manage'],
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        isActive: true
      }
    });

    return {
      tenantId: tenant.id,
      adminUserId: adminUser.id,
      initialPassword,
      apiKeys: [apiKey]
    };
  }

  /**
   * Send welcome email to admin
   */
  private async sendWelcomeEmail(tenant: any, adminUser: any, credentials: any): Promise<void> {
    const setupUrl = this.generateSetupUrl(tenant);
    
    try {
      await sendEmail({
        to: adminUser.email,
        subject: `Welcome to ${process.env.PLATFORM_NAME || 'Developer Portal'} - Setup Required`,
        template: 'tenant-welcome',
        data: {
          tenantName: tenant.name,
          adminName: adminUser.name,
          setupUrl,
          initialPassword: credentials.initialPassword,
          expiryHours: 24
        }
      });
    } catch (error) {
      console.error('Failed to send welcome email:', error);
    }
  }

  /**
   * Generate setup URL for tenant
   */
  private generateSetupUrl(tenant: any): string {
    const baseUrl = process.env.PLATFORM_URL || 'http://localhost:3000';
    const setupToken = generateSecureId('setup_token', 32);
    
    // Store setup token with expiry
    this.systemDb.create('tenantSetupToken', {
      data: {
        tenantId: tenant.id,
        token: setupToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        isUsed: false
      }
    }).catch(console.error);

    return `${baseUrl}/setup/${tenant.slug}?token=${setupToken}`;
  }

  /**
   * Record lifecycle event
   */
  private async recordLifecycleEvent(
    client: TenantAwareDatabase,
    event: Omit<TenantLifecycleEvent, 'id' | 'timestamp'>
  ): Promise<void> {
    await client.create('tenantLifecycleEvent', {
      data: {
        id: generateSecureId('event'),
        tenantId: event.tenantId,
        eventType: event.eventType,
        triggeredBy: event.triggeredBy,
        metadata: event.metadata || {},
        rollbackData: event.rollbackData || {},
        timestamp: new Date()
      }
    });

    // Create audit log entry
    await createAuditLog({
      action: `tenant_lifecycle:${event.eventType.toLowerCase()}`,
      resource: 'tenant',
      resourceId: event.tenantId,
      metadata: event.metadata
    });
  }

  /**
   * Schedule post-provisioning tasks
   */
  private async schedulePostProvisioningTasks(tenantId: string): Promise<void> {
    // Schedule health check after 1 hour
    setTimeout(async () => {
      await this.performTenantHealthCheck(tenantId);
    }, 60 * 60 * 1000);

    // Schedule configuration validation after 24 hours
    setTimeout(async () => {
      await this.validateTenantConfiguration(tenantId);
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Tenant lifecycle management methods
   */

  /**
   * Suspend tenant (reversible)
   */
  async suspendTenant(tenantId: string, reason: string, suspendedBy: string): Promise<TenantProvisioningResult> {
    try {
      const tenant = await tenantManager.getTenant(tenantId);
      if (!tenant) {
        return { success: false, error: 'Tenant not found' };
      }

      await this.systemDb.transaction(async (client) => {
        // Update tenant status
        await client.update('organization', {
          where: { id: tenantId },
          data: { 
            status: 'SUSPENDED',
            suspendedAt: new Date(),
            suspensionReason: reason
          }
        });

        // Record lifecycle event
        await this.recordLifecycleEvent(client, {
          tenantId,
          eventType: 'SUSPENDED',
          triggeredBy: suspendedBy,
          metadata: { reason },
          rollbackData: { previousStatus: tenant.status }
        });
      });

      // Update tenant manager cache
      await tenantManager.updateTenantStatus(tenantId, 'SUSPENDED');

      return { success: true };
    } catch (error) {
      console.error('Failed to suspend tenant:', error);
      return { success: false, error: 'Failed to suspend tenant' };
    }
  }

  /**
   * Reactivate suspended tenant
   */
  async reactivateTenant(tenantId: string, reactivatedBy: string): Promise<TenantProvisioningResult> {
    try {
      const tenant = await tenantManager.getTenant(tenantId);
      if (!tenant) {
        return { success: false, error: 'Tenant not found' };
      }

      if (tenant.status !== 'SUSPENDED') {
        return { success: false, error: 'Tenant is not suspended' };
      }

      await this.systemDb.transaction(async (client) => {
        // Update tenant status
        await client.update('organization', {
          where: { id: tenantId },
          data: { 
            status: 'ACTIVE',
            suspendedAt: null,
            suspensionReason: null,
            reactivatedAt: new Date()
          }
        });

        // Record lifecycle event
        await this.recordLifecycleEvent(client, {
          tenantId,
          eventType: 'ACTIVATED',
          triggeredBy: reactivatedBy,
          metadata: { reactivation: true }
        });
      });

      // Update tenant manager cache
      await tenantManager.updateTenantStatus(tenantId, 'ACTIVE');

      return { success: true };
    } catch (error) {
      console.error('Failed to reactivate tenant:', error);
      return { success: false, error: 'Failed to reactivate tenant' };
    }
  }

  /**
   * Upgrade tenant tier
   */
  async upgradeTenantTier(tenantId: string, newTier: TenantTier, upgradedBy: string): Promise<TenantProvisioningResult> {
    try {
      const tenant = await tenantManager.getTenant(tenantId);
      if (!tenant) {
        return { success: false, error: 'Tenant not found' };
      }

      const tierOrder: Record<TenantTier, number> = {
        'FREE': 1, 'STARTER': 2, 'PROFESSIONAL': 3, 'ENTERPRISE': 4
      };

      if (tierOrder[newTier] <= tierOrder[tenant.tier]) {
        return { success: false, error: 'New tier must be higher than current tier' };
      }

      await this.systemDb.transaction(async (client) => {
        // Update tenant tier
        await client.update('organization', {
          where: { id: tenantId },
          data: { 
            tier: newTier,
            upgradeDate: new Date(),
            settings: {
              ...tenant.settings,
              maxUsers: this.getMaxUsersForTier(newTier),
              maxPlugins: this.getMaxPluginsForTier(newTier)
            }
          }
        });

        // Record lifecycle event
        await this.recordLifecycleEvent(client, {
          tenantId,
          eventType: 'UPGRADED',
          triggeredBy: upgradedBy,
          metadata: { 
            fromTier: tenant.tier,
            toTier: newTier
          },
          rollbackData: { previousTier: tenant.tier }
        });
      });

      // Update tenant manager cache
      await tenantManager.updateTenantTier(tenantId, newTier);

      return { success: true };
    } catch (error) {
      console.error('Failed to upgrade tenant tier:', error);
      return { success: false, error: 'Failed to upgrade tenant tier' };
    }
  }

  /**
   * Archive tenant (data preserved but inaccessible)
   */
  async archiveTenant(tenantId: string, archivedBy: string): Promise<TenantProvisioningResult> {
    try {
      const tenant = await tenantManager.getTenant(tenantId);
      if (!tenant) {
        return { success: false, error: 'Tenant not found' };
      }

      await this.systemDb.transaction(async (client) => {
        // Update tenant status
        await client.update('organization', {
          where: { id: tenantId },
          data: { 
            status: 'ARCHIVED',
            archivedAt: new Date()
          }
        });

        // Deactivate all users
        await client.updateMany('user', {
          where: { tenantId },
          data: { isActive: false }
        });

        // Record lifecycle event
        await this.recordLifecycleEvent(client, {
          tenantId,
          eventType: 'ARCHIVED',
          triggeredBy: archivedBy,
          rollbackData: { 
            previousStatus: tenant.status,
            activeUserCount: await client.count('user', {
              where: { tenantId, isActive: true }
            })
          }
        });
      });

      // Update tenant manager cache
      await tenantManager.updateTenantStatus(tenantId, 'ARCHIVED');

      return { success: true };
    } catch (error) {
      console.error('Failed to archive tenant:', error);
      return { success: false, error: 'Failed to archive tenant' };
    }
  }

  /**
   * Utility methods
   */

  private getMaxUsersForTier(tier: TenantTier): number {
    const limits = {
      'FREE': 5,
      'STARTER': 25,
      'PROFESSIONAL': 100,
      'ENTERPRISE': -1 // unlimited
    };
    return limits[tier];
  }

  private getMaxPluginsForTier(tier: TenantTier): number {
    const limits = {
      'FREE': 10,
      'STARTER': 50,
      'PROFESSIONAL': 200,
      'ENTERPRISE': -1 // unlimited
    };
    return limits[tier];
  }

  private getDefaultPluginsForFeatures(features: string[]): Array<{
    name: string;
    displayName: string;
    description: string;
    category: string;
    version?: string;
  }> {
    const pluginMap: Record<string, any> = {
      'catalog': {
        name: '@backstage/plugin-catalog',
        displayName: 'Service Catalog',
        description: 'Browse and manage services',
        category: 'CATALOG'
      },
      'scaffolder': {
        name: '@backstage/plugin-scaffolder',
        displayName: 'Software Templates',
        description: 'Create new software projects',
        category: 'DEVELOPER_TOOLS'
      },
      'techdocs': {
        name: '@backstage/plugin-techdocs',
        displayName: 'Tech Docs',
        description: 'Documentation as code',
        category: 'DOCUMENTATION'
      }
    };

    return features
      .map(feature => pluginMap[feature])
      .filter(Boolean)
      .concat([pluginMap.catalog]); // Always include catalog
  }

  private async initializeResourceTracking(client: TenantAwareDatabase, tenantId: string): Promise<void> {
    const resourceTypes = ['STORAGE_GB', 'API_CALLS', 'USERS', 'PLUGINS'];
    
    for (const resourceType of resourceTypes) {
      await client.create('resourceUsage', {
        data: {
          organizationId: tenantId,
          resourceType,
          quantity: 0,
          period: new Date(),
          createdAt: new Date()
        }
      });
    }
  }

  private async performTenantHealthCheck(tenantId: string): Promise<void> {
    // Implementation for tenant health check
    console.log(`Performing health check for tenant: ${tenantId}`);
  }

  private async validateTenantConfiguration(tenantId: string): Promise<void> {
    // Implementation for configuration validation
    console.log(`Validating configuration for tenant: ${tenantId}`);
  }

  /**
   * Cleanup and disconnect
   */
  async disconnect(): Promise<void> {
    await this.systemDb.disconnect();
  }
}

export default TenantProvisioningService;