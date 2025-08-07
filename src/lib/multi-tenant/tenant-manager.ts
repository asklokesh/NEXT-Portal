import { prisma } from '@/lib/db/client';
import crypto from 'crypto';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  subdomain: string;
  settings: TenantSettings;
  subscription: {
    plan: 'free' | 'starter' | 'professional' | 'enterprise';
    status: 'active' | 'suspended' | 'cancelled';
    expiresAt?: Date;
    limits: ResourceLimits;
  };
  branding: {
    logoUrl?: string;
    primaryColor: string;
    secondaryColor: string;
    customCss?: string;
  };
  features: {
    [key: string]: boolean;
  };
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  ownerId: string;
  status: 'active' | 'inactive' | 'suspended';
}

export interface TenantSettings {
  authentication: {
    allowSelfRegistration: boolean;
    requireEmailVerification: boolean;
    passwordPolicy: {
      minLength: number;
      requireUppercase: boolean;
      requireLowercase: boolean;
      requireNumbers: boolean;
      requireSpecialChars: boolean;
    };
    sessionTimeout: number; // minutes
    maxConcurrentSessions: number;
  };
  security: {
    ipWhitelist: string[];
    requireMFA: boolean;
    allowedDomains: string[];
    apiKeyExpiry: number; // days
  };
  data: {
    retentionPeriod: number; // days
    backupEnabled: boolean;
    encryptionEnabled: boolean;
    dataResidency: string; // region code
  };
  notifications: {
    defaultChannels: string[];
    webhookRetries: number;
    emailQuotaDaily: number;
  };
  integrations: {
    allowedProviders: string[];
    maxConnections: number;
  };
}

export interface ResourceLimits {
  maxUsers: number;
  maxServices: number;
  maxTemplates: number;
  maxAPIKeys: number;
  maxWebhooks: number;
  maxNotifications: number; // per day
  storageGB: number;
  bandwidthGB: number; // per month
  maxConcurrentJobs: number;
}

export interface TenantUser {
  id: string;
  tenantId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  permissions: string[];
  status: 'active' | 'inactive' | 'pending';
  invitedBy?: string;
  joinedAt: Date;
  lastActive?: Date;
}

export interface TenantInvitation {
  id: string;
  tenantId: string;
  email: string;
  role: string;
  invitedBy: string;
  token: string;
  expiresAt: Date;
  acceptedAt?: Date;
  createdAt: Date;
}

export class TenantManager {
  private static instance: TenantManager;
  private tenantCache = new Map<string, Tenant>();
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes

  static getInstance(): TenantManager {
    if (!TenantManager.instance) {
      TenantManager.instance = new TenantManager();
    }
    return TenantManager.instance;
  }

  /**
   * Create a new tenant
   */
  async createTenant(data: {
    name: string;
    slug?: string;
    domain?: string;
    ownerId: string;
    plan?: 'free' | 'starter' | 'professional' | 'enterprise';
    settings?: Partial<TenantSettings>;
    branding?: Partial<Tenant['branding']>;
  }): Promise<Tenant> {
    // Generate unique slug if not provided
    const slug = data.slug || this.generateSlug(data.name);
    const subdomain = await this.generateUniqueSubdomain(slug);

    // Validate slug/subdomain uniqueness
    await this.validateTenantUniqueness(slug, subdomain, data.domain);

    const tenant: Tenant = {
      id: crypto.randomUUID(),
      name: data.name,
      slug,
      domain: data.domain,
      subdomain,
      settings: this.getDefaultSettings(data.settings),
      subscription: {
        plan: data.plan || 'free',
        status: 'active',
        limits: this.getPlanLimits(data.plan || 'free')
      },
      branding: {
        primaryColor: '#2563eb',
        secondaryColor: '#64748b',
        ...data.branding
      },
      features: this.getPlanFeatures(data.plan || 'free'),
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      ownerId: data.ownerId,
      status: 'active'
    };

    // Store tenant
    await this.storeTenant(tenant);

    // Add owner as first user
    await this.addUserToTenant(tenant.id, data.ownerId, 'owner');

    // Initialize tenant resources
    await this.initializeTenantResources(tenant.id);

    // Clear cache
    this.tenantCache.delete(tenant.id);

    return tenant;
  }

  /**
   * Get tenant by ID
   */
  async getTenant(tenantId: string): Promise<Tenant | null> {
    // Check cache first
    const cached = this.tenantCache.get(tenantId);
    if (cached) {
      return cached;
    }

    try {
      const tenant = await prisma.tenant?.findUnique({
        where: { id: tenantId },
        include: {
          users: true,
          invitations: true
        }
      }) as any;

      if (tenant) {
        const formattedTenant = this.formatTenant(tenant);
        this.tenantCache.set(tenantId, formattedTenant);
        
        // Set cache expiry
        setTimeout(() => {
          this.tenantCache.delete(tenantId);
        }, this.cacheExpiry);

        return formattedTenant;
      }

      return null;
    } catch (error) {
      console.error('Failed to get tenant:', error);
      return null;
    }
  }

  /**
   * Get tenant by domain or subdomain
   */
  async getTenantByDomain(domain: string): Promise<Tenant | null> {
    try {
      // Check if it's a subdomain (format: tenant.domain.com)
      const isSubdomain = domain.split('.').length > 2;
      
      let tenant;
      if (isSubdomain) {
        const subdomain = domain.split('.')[0];
        tenant = await prisma.tenant?.findFirst({
          where: { subdomain },
          include: { users: true }
        });
      } else {
        tenant = await prisma.tenant?.findFirst({
          where: { domain },
          include: { users: true }
        });
      }

      return tenant ? this.formatTenant(tenant) : null;
    } catch (error) {
      console.error('Failed to get tenant by domain:', error);
      return null;
    }
  }

  /**
   * Update tenant
   */
  async updateTenant(tenantId: string, updates: Partial<Tenant>): Promise<Tenant | null> {
    try {
      const existingTenant = await this.getTenant(tenantId);
      if (!existingTenant) return null;

      const updatedTenant = {
        ...existingTenant,
        ...updates,
        updatedAt: new Date()
      };

      await this.storeTenant(updatedTenant);

      // Clear cache
      this.tenantCache.delete(tenantId);

      return updatedTenant;
    } catch (error) {
      console.error('Failed to update tenant:', error);
      return null;
    }
  }

  /**
   * Delete tenant (soft delete)
   */
  async deleteTenant(tenantId: string): Promise<boolean> {
    try {
      await prisma.tenant?.update({
        where: { id: tenantId },
        data: {
          status: 'inactive',
          updatedAt: new Date()
        }
      });

      // Clear cache
      this.tenantCache.delete(tenantId);

      return true;
    } catch (error) {
      console.error('Failed to delete tenant:', error);
      return false;
    }
  }

  /**
   * Add user to tenant
   */
  async addUserToTenant(
    tenantId: string,
    userId: string,
    role: TenantUser['role'],
    permissions: string[] = []
  ): Promise<TenantUser> {
    const tenantUser: TenantUser = {
      id: crypto.randomUUID(),
      tenantId,
      userId,
      role,
      permissions: permissions.length > 0 ? permissions : this.getDefaultPermissions(role),
      status: 'active',
      joinedAt: new Date()
    };

    await this.storeTenantUser(tenantUser);
    return tenantUser;
  }

  /**
   * Remove user from tenant
   */
  async removeUserFromTenant(tenantId: string, userId: string): Promise<boolean> {
    try {
      await prisma.tenantUser?.deleteMany({
        where: { tenantId, userId }
      });
      return true;
    } catch (error) {
      console.error('Failed to remove user from tenant:', error);
      return false;
    }
  }

  /**
   * Get user's tenant memberships
   */
  async getUserTenants(userId: string): Promise<Array<Tenant & { userRole: string }>> {
    try {
      const memberships = await prisma.tenantUser?.findMany({
        where: { userId, status: 'active' },
        include: {
          tenant: true
        }
      }) as any[];

      return memberships.map((membership: any) => ({
        ...this.formatTenant(membership.tenant),
        userRole: membership.role
      }));
    } catch (error) {
      console.error('Failed to get user tenants:', error);
      return [];
    }
  }

  /**
   * Get tenant users
   */
  async getTenantUsers(tenantId: string): Promise<TenantUser[]> {
    try {
      const users = await prisma.tenantUser?.findMany({
        where: { tenantId },
        include: { user: true }
      }) as any[];

      return users.map((user: any) => this.formatTenantUser(user));
    } catch (error) {
      console.error('Failed to get tenant users:', error);
      return [];
    }
  }

  /**
   * Invite user to tenant
   */
  async inviteUserToTenant(
    tenantId: string,
    email: string,
    role: string,
    invitedBy: string
  ): Promise<TenantInvitation> {
    const invitation: TenantInvitation = {
      id: crypto.randomUUID(),
      tenantId,
      email,
      role,
      invitedBy,
      token: crypto.randomBytes(32).toString('hex'),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      createdAt: new Date()
    };

    await this.storeTenantInvitation(invitation);

    // Send invitation email (implement email service)
    await this.sendInvitationEmail(invitation);

    return invitation;
  }

  /**
   * Accept tenant invitation
   */
  async acceptInvitation(token: string, userId: string): Promise<boolean> {
    try {
      const invitation = await prisma.tenantInvitation?.findFirst({
        where: { 
          token, 
          expiresAt: { gt: new Date() },
          acceptedAt: null 
        }
      }) as any;

      if (!invitation) return false;

      // Add user to tenant
      await this.addUserToTenant(invitation.tenantId, userId, invitation.role);

      // Mark invitation as accepted
      await prisma.tenantInvitation?.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() }
      });

      return true;
    } catch (error) {
      console.error('Failed to accept invitation:', error);
      return false;
    }
  }

  /**
   * Check if user has access to tenant
   */
  async hasUserAccess(userId: string, tenantId: string): Promise<boolean> {
    try {
      const membership = await prisma.tenantUser?.findFirst({
        where: { userId, tenantId, status: 'active' }
      });

      return !!membership;
    } catch (error) {
      console.error('Failed to check user access:', error);
      return false;
    }
  }

  /**
   * Get user role in tenant
   */
  async getUserRole(userId: string, tenantId: string): Promise<string | null> {
    try {
      const membership = await prisma.tenantUser?.findFirst({
        where: { userId, tenantId, status: 'active' }
      });

      return membership?.role || null;
    } catch (error) {
      console.error('Failed to get user role:', error);
      return null;
    }
  }

  /**
   * Check resource limits
   */
  async checkResourceLimit(
    tenantId: string, 
    resource: keyof ResourceLimits
  ): Promise<{ allowed: boolean; current: number; limit: number }> {
    const tenant = await this.getTenant(tenantId);
    if (!tenant) {
      return { allowed: false, current: 0, limit: 0 };
    }

    const limit = tenant.subscription.limits[resource];
    const current = await this.getCurrentResourceUsage(tenantId, resource);

    return {
      allowed: current < limit,
      current,
      limit
    };
  }

  /**
   * Get tenant analytics
   */
  async getTenantAnalytics(tenantId: string, days = 30): Promise<{
    users: { total: number; active: number; growth: number };
    resources: { services: number; templates: number; deployments: number };
    activity: { logins: number; apiCalls: number; notifications: number };
    storage: { used: number; limit: number; percentage: number };
  }> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    // Implement analytics queries based on your audit log structure
    return {
      users: {
        total: await this.getTenantUserCount(tenantId),
        active: await this.getActiveTenantUserCount(tenantId, days),
        growth: await this.getUserGrowthRate(tenantId, days)
      },
      resources: {
        services: await this.getResourceCount(tenantId, 'service'),
        templates: await this.getResourceCount(tenantId, 'template'),
        deployments: await this.getResourceCount(tenantId, 'deployment')
      },
      activity: {
        logins: await this.getActivityCount(tenantId, 'login', days),
        apiCalls: await this.getActivityCount(tenantId, 'api_call', days),
        notifications: await this.getActivityCount(tenantId, 'notification', days)
      },
      storage: {
        used: await this.getStorageUsage(tenantId),
        limit: (await this.getTenant(tenantId))?.subscription.limits.storageGB || 0,
        percentage: 0 // Calculate percentage
      }
    };
  }

  /**
   * Private helper methods
   */

  private generateSlug(name: string): string {
    return name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private async generateUniqueSubdomain(baseSlug: string): Promise<string> {
    let subdomain = baseSlug;
    let counter = 1;

    while (await this.isSubdomainTaken(subdomain)) {
      subdomain = `${baseSlug}-${counter}`;
      counter++;
    }

    return subdomain;
  }

  private async isSubdomainTaken(subdomain: string): Promise<boolean> {
    try {
      const existing = await prisma.tenant?.findFirst({
        where: { subdomain }
      });
      return !!existing;
    } catch (error) {
      return false;
    }
  }

  private async validateTenantUniqueness(slug: string, subdomain: string, domain?: string): Promise<void> {
    const checks = [
      prisma.tenant?.findFirst({ where: { slug } }),
      prisma.tenant?.findFirst({ where: { subdomain } })
    ];

    if (domain) {
      checks.push(prisma.tenant?.findFirst({ where: { domain } }));
    }

    const results = await Promise.all(checks);
    
    if (results[0]) throw new Error('Slug already exists');
    if (results[1]) throw new Error('Subdomain already exists');
    if (domain && results[2]) throw new Error('Domain already exists');
  }

  private getDefaultSettings(overrides?: Partial<TenantSettings>): TenantSettings {
    const defaults: TenantSettings = {
      authentication: {
        allowSelfRegistration: true,
        requireEmailVerification: true,
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: false
        },
        sessionTimeout: 480, // 8 hours
        maxConcurrentSessions: 5
      },
      security: {
        ipWhitelist: [],
        requireMFA: false,
        allowedDomains: [],
        apiKeyExpiry: 365
      },
      data: {
        retentionPeriod: 90,
        backupEnabled: true,
        encryptionEnabled: true,
        dataResidency: 'us-east-1'
      },
      notifications: {
        defaultChannels: ['email', 'inApp'],
        webhookRetries: 3,
        emailQuotaDaily: 1000
      },
      integrations: {
        allowedProviders: ['github', 'gitlab', 'slack'],
        maxConnections: 10
      }
    };

    return { ...defaults, ...overrides };
  }

  private getPlanLimits(plan: string): ResourceLimits {
    const limits: Record<string, ResourceLimits> = {
      free: {
        maxUsers: 5,
        maxServices: 10,
        maxTemplates: 5,
        maxAPIKeys: 3,
        maxWebhooks: 2,
        maxNotifications: 100,
        storageGB: 1,
        bandwidthGB: 10,
        maxConcurrentJobs: 2
      },
      starter: {
        maxUsers: 25,
        maxServices: 50,
        maxTemplates: 25,
        maxAPIKeys: 10,
        maxWebhooks: 10,
        maxNotifications: 1000,
        storageGB: 10,
        bandwidthGB: 100,
        maxConcurrentJobs: 5
      },
      professional: {
        maxUsers: 100,
        maxServices: 200,
        maxTemplates: 100,
        maxAPIKeys: 25,
        maxWebhooks: 25,
        maxNotifications: 10000,
        storageGB: 100,
        bandwidthGB: 1000,
        maxConcurrentJobs: 15
      },
      enterprise: {
        maxUsers: 1000,
        maxServices: 1000,
        maxTemplates: 500,
        maxAPIKeys: 100,
        maxWebhooks: 100,
        maxNotifications: 100000,
        storageGB: 1000,
        bandwidthGB: 10000,
        maxConcurrentJobs: 50
      }
    };

    return limits[plan] || limits.free;
  }

  private getPlanFeatures(plan: string): Record<string, boolean> {
    const features: Record<string, Record<string, boolean>> = {
      free: {
        basicCatalog: true,
        basicTemplates: true,
        basicNotifications: true,
        api: false,
        customDomain: false,
        sso: false,
        rbac: false,
        audit: false,
        compliance: false,
        advancedAnalytics: false
      },
      starter: {
        basicCatalog: true,
        basicTemplates: true,
        basicNotifications: true,
        api: true,
        customDomain: false,
        sso: false,
        rbac: true,
        audit: true,
        compliance: false,
        advancedAnalytics: false
      },
      professional: {
        basicCatalog: true,
        basicTemplates: true,
        basicNotifications: true,
        api: true,
        customDomain: true,
        sso: true,
        rbac: true,
        audit: true,
        compliance: true,
        advancedAnalytics: true
      },
      enterprise: {
        basicCatalog: true,
        basicTemplates: true,
        basicNotifications: true,
        api: true,
        customDomain: true,
        sso: true,
        rbac: true,
        audit: true,
        compliance: true,
        advancedAnalytics: true
      }
    };

    return features[plan] || features.free;
  }

  private getDefaultPermissions(role: string): string[] {
    const permissions: Record<string, string[]> = {
      owner: ['*'],
      admin: [
        'tenant.manage',
        'users.manage',
        'services.manage',
        'templates.manage',
        'deployments.manage',
        'settings.manage',
        'audit.view'
      ],
      member: [
        'services.read',
        'services.create',
        'services.update',
        'templates.read',
        'templates.use',
        'deployments.read',
        'deployments.create'
      ],
      viewer: [
        'services.read',
        'templates.read',
        'deployments.read'
      ]
    };

    return permissions[role] || permissions.viewer;
  }

  private async initializeTenantResources(tenantId: string): Promise<void> {
    // Initialize default resources for the tenant
    // This could include default templates, settings, etc.
    console.log(`Initializing resources for tenant: ${tenantId}`);
  }

  private formatTenant(tenant: any): Tenant {
    return {
      ...tenant,
      settings: typeof tenant.settings === 'string' ? JSON.parse(tenant.settings) : tenant.settings,
      subscription: typeof tenant.subscription === 'string' ? JSON.parse(tenant.subscription) : tenant.subscription,
      branding: typeof tenant.branding === 'string' ? JSON.parse(tenant.branding) : tenant.branding,
      features: typeof tenant.features === 'string' ? JSON.parse(tenant.features) : tenant.features,
      metadata: typeof tenant.metadata === 'string' ? JSON.parse(tenant.metadata) : tenant.metadata
    };
  }

  private formatTenantUser(user: any): TenantUser {
    return {
      ...user,
      permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions
    };
  }

  private async storeTenant(tenant: Tenant): Promise<void> {
    // In production, store in database
    console.log('Storing tenant:', tenant.id);
  }

  private async storeTenantUser(tenantUser: TenantUser): Promise<void> {
    // In production, store in database
    console.log('Storing tenant user:', tenantUser.id);
  }

  private async storeTenantInvitation(invitation: TenantInvitation): Promise<void> {
    // In production, store in database
    console.log('Storing invitation:', invitation.id);
  }

  private async sendInvitationEmail(invitation: TenantInvitation): Promise<void> {
    // In production, send actual email
    console.log('Sending invitation email to:', invitation.email);
  }

  private async getCurrentResourceUsage(tenantId: string, resource: keyof ResourceLimits): Promise<number> {
    // Implement actual resource counting
    return 0;
  }

  private async getTenantUserCount(tenantId: string): Promise<number> {
    return 0;
  }

  private async getActiveTenantUserCount(tenantId: string, days: number): Promise<number> {
    return 0;
  }

  private async getUserGrowthRate(tenantId: string, days: number): Promise<number> {
    return 0;
  }

  private async getResourceCount(tenantId: string, resource: string): Promise<number> {
    return 0;
  }

  private async getActivityCount(tenantId: string, activity: string, days: number): Promise<number> {
    return 0;
  }

  private async getStorageUsage(tenantId: string): Promise<number> {
    return 0;
  }
}

// Export singleton instance
export const tenantManager = TenantManager.getInstance();